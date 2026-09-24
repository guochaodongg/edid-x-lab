/*
 * video-timings.js — 多标准视频时序计算器（纯逻辑，不碰 DOM）
 *
 * 实现 VESA CVT v1.1 / CVT-RB v1 / CVT-RB v2 计算、DMT 与 CEA-861(VIC)
 * 标准查表、自定义消隐模式、接口带宽核算与 Xorg Modeline 生成。
 * 算法与数据参考 Tom Verbeure 的 Video Timings Calculator
 * （tomverbeure.github.io/video_timings_calculator），公式出自
 * VESA CVT 标准与 GTF/CVT 公开资料。
 *
 * 依赖: vtc-data.js（global.VTCData）
 * 挂载: global.VTC
 */
(function (global) {
  'use strict';

  var D = global.VTCData;

  /* ------------------------------------------------------------ 常量 */
  var CVT_CONST = {
    CELL_GRAN: 8,            // 单元粒度（像素）
    MIN_V_PORCH: 3,          // 最小垂直前沿
    MIN_VSYNC_BP: 550,       // 最小 VSYNC+BACK PORCH（微秒）
    MIN_V_BPORCH: 6,         // 最小垂直后沿（行）
    RB_H_BLANK_V1: 160,      // CVT-RB v1 水平消隐
    RB_V_BLANK_MIN: 460,     // CVT-RB 最小垂直消隐（微秒）
    MARGIN_PER: 1.8,         // 安全边距百分比
    C_PRIME: 30,             // CVT 责任周期常数 C'
    M_PRIME: 300,            // CVT 责任周期常数 M'
    H_SYNC_PER: 0.08         // 水平同步占空比 8%
  };

  /* 与宽高比对应的 VSYNC 宽度（CVT 标准表 3） */
  var ASPECTS = [
    { name: '4:3',   num: 4,  den: 3,  vsync: 4  },
    { name: '16:9',  num: 16, den: 9,  vsync: 5  },
    { name: '16:10', num: 16, den: 10, vsync: 6  },
    { name: '5:4',   num: 5,  den: 4,  vsync: 7  },
    { name: '15:9',  num: 15, den: 9,  vsync: 7  },
    /* 以下宽高比 CVT 规范未定义，沿用原工具的扩展 */
    { name: '43:18', num: 43, den: 18, vsync: 10 },
    { name: '64:27', num: 64, den: 27, vsync: 10 },
    { name: '12:5',  num: 12, den: 5,  vsync: 10 }
  ];

  /* 接口带宽表（bit/s）。dsc=1 表示该接口支持 DSC 压缩回退。 */
  var TRANSPORTS = [
    /* DisplayPort（4 lane）—— UBR 采用 RS(198,194)，其余 8b/10b */
    { id: 'dp_ubr20',   name: 'DisplayPort UBR20 (20 GHz)',        dsc: 1, bw: 20000000000 * 4 / 132 * 128 / 198 * 194 },
    { id: 'dp_ubr13',   name: 'DisplayPort UBR13.5 (13.5 GHz)',    dsc: 1, bw: 13500000000 * 4 / 132 * 128 / 198 * 194 },
    { id: 'dp_ubr10',   name: 'DisplayPort UBR10 (10 GHz)',        dsc: 1, bw: 10000000000 * 4 / 132 * 128 / 198 * 194 },
    { id: 'dp_hbr3',    name: 'DisplayPort HBR3 (8.1 GHz)',        dsc: 1, bw: 8100000000 * 4 / 10 * 8 },
    { id: 'dp_hbr2',    name: 'DisplayPort HBR2 (5.4 GHz)',        dsc: 1, bw: 5400000000 * 4 / 10 * 8 },
    { id: 'dp_hbr',     name: 'DisplayPort HBR (2.7 GHz)',         dsc: 1, bw: 2700000000 * 4 / 10 * 8 },
    { id: 'dp_rbr',     name: 'DisplayPort RBR (1.64 GHz)',        dsc: 1, bw: 1640000000 * 4 / 10 * 8 },
    /* DisplayPort Type-C Alt Mode（2 lane） */
    { id: 'dpam_ubr20', name: 'DP UBR20 Type-C Alt Mode (20 GHz)', dsc: 1, bw: 20000000000 * 2 / 132 * 128 / 198 * 194 },
    { id: 'dpam_ubr13', name: 'DP UBR13.5 Type-C Alt Mode',        dsc: 1, bw: 13500000000 * 2 / 132 * 128 / 198 * 194 },
    { id: 'dpam_ubr10', name: 'DP UBR10 Type-C Alt Mode (10 GHz)', dsc: 1, bw: 10000000000 * 2 / 132 * 128 / 198 * 194 },
    { id: 'dpam_hbr3',  name: 'DP HBR3 Type-C Alt Mode (8.1 GHz)', dsc: 1, bw: 8100000000 * 2 / 10 * 8 },
    { id: 'dpam_hbr2',  name: 'DP HBR2 Type-C Alt Mode (5.4 GHz)', dsc: 1, bw: 5400000000 * 2 / 10 * 8 },
    { id: 'dpam_hbr',   name: 'DP HBR Type-C Alt Mode (2.7 GHz)',  dsc: 1, bw: 2700000000 * 2 / 10 * 8 },
    { id: 'dpam_rbr',   name: 'DP RBR Type-C Alt Mode (1.64 GHz)', dsc: 1, bw: 1640000000 * 2 / 10 * 8 },
    /* DVI —— 仅 8bpc RGB */
    { id: 'dvi_dl',     name: 'DVI-DL (dual link 330 MHz)',        dsc: 0, bw: 330000000 * 24 },
    { id: 'dvi_d',      name: 'DVI-D (single link 165 MHz)',       dsc: 0, bw: 165000000 * 24 },
    /* HDMI TMDS */
    { id: 'hdmi_2_0',   name: 'HDMI 2.0 (600 MHz)',                dsc: 0, bw: 600000000 * 24 },
    { id: 'hdmi_1_3',   name: 'HDMI 1.3/1.4 (340 MHz)',            dsc: 0, bw: 340000000 * 24 },
    { id: 'hdmi_1_0',   name: 'HDMI 1.0/1.1/1.2 (165 MHz)',        dsc: 0, bw: 165000000 * 24 },
    /* HDMI FRL —— 16b/18b 编码 + 544/514 FEC */
    { id: 'hdmi_2_2_24g', name: 'HDMI 2.2 FRL12 (24 GHz/4 lanes)', dsc: 1, bw: 24000000000 * 4 / 18 * 16 / 544 * 514 },
    { id: 'hdmi_2_2_20g', name: 'HDMI 2.2 FRL10 (20 GHz/4 lanes)', dsc: 1, bw: 20000000000 * 4 / 18 * 16 / 544 * 514 },
    { id: 'hdmi_2_2_16g', name: 'HDMI 2.2 FRL8 (16 GHz/4 lanes)',  dsc: 1, bw: 16000000000 * 4 / 18 * 16 / 544 * 514 },
    { id: 'hdmi_2_1_12g', name: 'HDMI 2.1 FRL6 (12 GHz/4 lanes)',  dsc: 1, bw: 12000000000 * 4 / 18 * 16 / 544 * 514 },
    { id: 'hdmi_2_1_10g', name: 'HDMI 2.1 FRL5 (10 GHz/4 lanes)',  dsc: 1, bw: 10000000000 * 4 / 18 * 16 / 544 * 514 },
    { id: 'hdmi_2_1_8g',  name: 'HDMI 2.1 FRL4 (8 GHz/4 lanes)',   dsc: 1, bw: 8000000000 * 4 / 18 * 16 / 544 * 514 },
    { id: 'hdmi_2_1_6g',  name: 'HDMI 2.1 FRL3 (6 GHz/4 lanes)',   dsc: 1, bw: 6000000000 * 4 / 18 * 16 / 544 * 514 },
    { id: 'hdmi_2_1_6g3', name: 'HDMI 2.1 FRL2 (6 GHz/3 lanes)',   dsc: 1, bw: 6000000000 * 3 / 18 * 16 / 544 * 514 },
    { id: 'hdmi_2_1_3g',  name: 'HDMI 2.1 FRL1 (3 GHz/3 lanes)',   dsc: 1, bw: 3000000000 * 3 / 18 * 16 / 544 * 514 },
    /* SDI */
    { id: 'sdi_12g',    name: '12G-SDI',                           dsc: 0, bw: 11880000000 },
    { id: 'sdi_6g',     name: '6G-SDI',                            dsc: 0, bw: 5940000000 },
    { id: 'sdi_3g',     name: '3G-SDI',                            dsc: 0, bw: 2970000000 },
    { id: 'sdi_hd',     name: 'HD-SDI',                            dsc: 0, bw: 1485000000 },
    { id: 'sdi_sd',     name: 'SD-SDI',                            dsc: 0, bw: 270000000 },
    /* RFC 4175 视频over以太网（含 IP/UDP/RTP 头与 MTU 开销） */
    { id: 'rfc4175_10g', name: 'RFC4175/10 GigE',                  dsc: 0, bw: rfcBw(10000000000) },
    { id: 'rfc4175_1g',  name: 'RFC4175/1 GigE',                   dsc: 0, bw: rfcBw(1000000000) },
    { id: 'rfc4175_100m', name: 'RFC4175/100M Ethernet',           dsc: 0, bw: rfcBw(100000000) }
  ];

  function rfcBw(lineRate) {
    var mtuEff = 1500 / 1542;                    // 含帧间隙
    var overhead = 20 + 8 + 12 + 13;             // IP + UDP + RTP + RFC4175 头
    return lineRate * mtuEff * (1500 - overhead) / 1500;
  }

  /* 预定义模式（与原工具一致，从 16K 到 160x100） */
  var PRESET_MODES = [
    { name: '16K / 60',        h: 15360, v: 8640, r: 60  },
    { name: '12K / 120',       h: 12288, v: 6480, r: 120 },
    { name: '12K / 60',        h: 12288, v: 6480, r: 60  },
    { name: '10K / 120',       h: 10240, v: 4320, r: 120 },
    { name: '10K / 60',        h: 10240, v: 4320, r: 60  },
    { name: '8K / 144',        h: 7680,  v: 4320, r: 144 },
    { name: '8K / 120',        h: 7680,  v: 4320, r: 120 },
    { name: '8K / 60',         h: 7680,  v: 4320, r: 60  },
    { name: '6K / 60',         h: 6016,  v: 3384, r: 60  },
    { name: '6K / 48',         h: 6016,  v: 3384, r: 48  },
    { name: '5K / 144',        h: 5120,  v: 2880, r: 144 },
    { name: '5K / 120',        h: 5120,  v: 2880, r: 120 },
    { name: '5K / 60',         h: 5120,  v: 2880, r: 60  },
    { name: '4K / 480',        h: 3840,  v: 2160, r: 480 },
    { name: '4K / 240',        h: 3840,  v: 2160, r: 240 },
    { name: '4K / 165',        h: 3840,  v: 2160, r: 165 },
    { name: '4K / 144',        h: 3840,  v: 2160, r: 144 },
    { name: '4K / 120',        h: 3840,  v: 2160, r: 120 },
    { name: '4K / 60',         h: 3840,  v: 2160, r: 60  },
    { name: '3440x1440 / 240', h: 3440,  v: 1440, r: 240 },
    { name: '3440x1440 / 200', h: 3440,  v: 1440, r: 200 },
    { name: '3440x1440 / 165', h: 3440,  v: 1440, r: 165 },
    { name: '3440x1440 / 120', h: 3440,  v: 1440, r: 120 },
    { name: '3440x1440 / 60',  h: 3440,  v: 1440, r: 60  },
    { name: '1440p / 360',     h: 2560,  v: 1440, r: 360 },
    { name: '1440p / 240',     h: 2560,  v: 1440, r: 240 },
    { name: '1440p / 165',     h: 2560,  v: 1440, r: 165 },
    { name: '1440p / 120',     h: 2560,  v: 1440, r: 120 },
    { name: '1440p / 60',      h: 2560,  v: 1440, r: 60  },
    { name: '1920x1200 / 60',  h: 1920,  v: 1200, r: 60  },
    { name: '1600x1200 / 60',  h: 1600,  v: 1200, r: 60  },
    { name: '1080p / 500',     h: 1920,  v: 1080, r: 500 },
    { name: '1080p / 360',     h: 1920,  v: 1080, r: 360 },
    { name: '1080p / 240',     h: 1920,  v: 1080, r: 240 },
    { name: '1080p / 144',     h: 1920,  v: 1080, r: 144 },
    { name: '1080p / 120',     h: 1920,  v: 1080, r: 120 },
    { name: '1080p / 60',      h: 1920,  v: 1080, r: 60  },
    { name: '1280x1024 / 60',  h: 1280,  v: 1024, r: 60  },
    { name: '720p / 60',       h: 1280,  v: 720,  r: 60  },
    { name: '1024x768 / 60',   h: 1024,  v: 768,  r: 60  },
    { name: '800x600 / 60',    h: 800,   v: 600,  r: 60  },
    { name: '640x480 / 60',    h: 640,   v: 480,  r: 60  },
    { name: '640x480 / 50',    h: 640,   v: 480,  r: 50  },
    { name: '320x200 / 60',    h: 320,   v: 200,  r: 60  },
    { name: '160x100 / 60',    h: 160,   v: 100,  r: 60  }
  ];

  /* ------------------------------------------------------------ 工具 */
  function aspectOf(h, v, cellGran) {
    for (var i = 0; i < ASPECTS.length; i++) {
      var a = ASPECTS[i];
      if (cellGran * Math.round(v * a.num / a.den) / cellGran === h) return a;
    }
    return null;
  }

  function round100(x) { return Math.round(x * 100) / 100; }

  /* ---------------------------------------------------- CVT 计算
   * variant: 'cvt'（CVT v1.1 标准消隐）| 'cvt_rb'（RB v1）| 'cvt_rb2'（RB v2）
   * 返回完整时序对象；interlaced 时 vActive 为场有效行数（与规范一致）。
   */
  function computeCVT(horiz, vert, refresh, margins, interlaced, variant, videoOpt) {
    var K = CVT_CONST;
    var cell = K.CELL_GRAN;

    var clockStep      = variant === 'cvt_rb2' ? 0.001 : 0.25;
    var clockStepInv   = variant === 'cvt_rb2' ? 1000  : 4;
    var rbHBlank       = variant === 'cvt_rb2' ? 80    : K.RB_H_BLANK_V1;
    var rbVBlankMin    = K.RB_V_BLANK_MIN;
    var rbVFront       = variant === 'cvt_rb2' ? 1     : K.MIN_V_PORCH;  /* RB 垂直前沿 */
    var refreshMult    = (variant === 'cvt_rb2' && videoOpt) ? 1000 / 1001 : 1;

    var hPol, vPol;
    if (variant === 'cvt')            { hPol = '-'; vPol = '+'; }
    else if (variant === 'cvt_rb')    { hPol = '+'; vPol = '-'; }
    else                              { hPol = '+'; vPol = '-'; }

    var vFieldRate = interlaced ? refresh * 2 : refresh;
    var hRnd   = Math.floor(horiz / cell) * cell;
    var lMargin = margins ? Math.floor((hRnd * K.MARGIN_PER / 100) / cell) * cell : 0;
    var totalActive = hRnd + 2 * lMargin;
    var vRnd   = interlaced ? Math.floor(vert / 2) : Math.floor(vert);
    var tMargin = margins ? Math.floor(vRnd * K.MARGIN_PER / 100) : 0;
    var interlace = interlaced ? 0.5 : 0;

    /* 宽高比 + VSYNC 宽度 */
    var aspect = aspectOf(hRnd, interlaced ? 2 * vRnd : vRnd, cell);
    var vSync;
    if (variant === 'cvt_rb2') vSync = 8;
    else if (aspect)           vSync = aspect.vsync;
    else                       vSync = 10;

    var hPeriodEst, hBlank, totalV, totalPix, pclk, vBlank, vFront, vBack, hSync, hBack, hFront;

    if (variant === 'cvt') {
      /* CVT v1.1 标准消隐 */
      hPeriodEst = ((1 / vFieldRate) - K.MIN_VSYNC_BP / 1000000.0) /
                   (vRnd + 2 * tMargin + K.MIN_V_PORCH + interlace) * 1000000.0;

      var vSyncBp = Math.floor(K.MIN_VSYNC_BP / hPeriodEst) + 1;
      if (vSyncBp < vSync + K.MIN_V_BPORCH) vSyncBp = vSync + K.MIN_V_BPORCH;

      vBlank = vSyncBp + K.MIN_V_PORCH;
      vFront = K.MIN_V_PORCH;
      vBack  = vSyncBp - vSync;

      totalV = vRnd + tMargin + tMargin + vSyncBp + interlace + K.MIN_V_PORCH;

      var duty = K.C_PRIME - K.M_PRIME * hPeriodEst / 1000;
      if (duty < 20) {
        hBlank = Math.floor(totalActive * 20 / (100 - 20) / (2 * cell)) * (2 * cell);
      } else {
        hBlank = Math.floor(totalActive * duty / (100 - duty) / (2 * cell)) * (2 * cell);
      }
      totalPix = totalActive + hBlank;

      hSync = Math.floor(K.H_SYNC_PER * totalPix / cell) * cell;
      hBack = hBlank / 2;
      hFront = hBlank - hSync - hBack;

      pclk = clockStep * Math.floor(totalPix / hPeriodEst / clockStep);
    } else {
      /* CVT-RB v1 / v2 */
      hPeriodEst = (1000000 / vFieldRate - rbVBlankMin) / (vRnd + tMargin + tMargin);
      hBlank = rbHBlank;

      var vbiLines = Math.floor(rbVBlankMin / hPeriodEst) + 1;
      var rbMinVbi = rbVFront + vSync + K.MIN_V_BPORCH;
      var actVbi = vbiLines < rbMinVbi ? rbMinVbi : vbiLines;

      totalV = actVbi + vRnd + tMargin + tMargin + interlace;
      totalPix = hBlank + totalActive;

      pclk = Math.floor(vFieldRate * totalV * totalPix * clockStepInv / 1000000) * refreshMult / clockStepInv;

      vBlank = actVbi;
      if (variant === 'cvt_rb2') {
        vFront = actVbi - vSync - 6;
        vBack  = 6;
        hSync  = 32;
        hBack  = 40;
      } else {
        vFront = 3;
        vBack  = actVbi - vFront - vSync;
        hSync  = 32;
        hBack  = 80;
      }
      hFront = hBlank - hSync - hBack;
    }

    var hFreq = 1000 * pclk / totalPix;          /* kHz 量纲 ×像素时钟MHz */
    var fieldRate = 1000 * hFreq / totalV;       /* Hz */
    var frameRate = interlaced ? fieldRate / 2 : fieldRate;

    return {
      standard: variant,
      interlaced: !!interlaced,
      hActive: totalActive, hRnd: hRnd, hBlank: hBlank, hTotal: totalPix,
      hFront: hFront, hSync: hSync, hBack: hBack, hPol: hPol,
      vActive: vRnd, vBlank: vBlank, vTotal: totalV,
      vFront: vFront, vSync: vSync, vBack: vBack, vPol: vPol,
      pclk: pclk,                                   /* MHz */
      aspect: aspect ? aspect.name : '未知',
      margins: margins ? lMargin : 0,
      hFreqKHz: hFreq,
      vFreq: frameRate
    };
  }

  /* ---------------------------------------------------- DMT 查表 */
  function lookupDMT(horiz, vert, refresh, interlaced) {
    var rInt = Math.round(refresh);
    var t = null;
    for (var i = 0; i < D.DMT.length; i++) {
      var d = D.DMT[i];
      /* d = [hA,vA,vF,il,id,b2,b3,type,pc,hpol,vpol,hT,hB,hF,hS,hBk,vT,vB,vF,vS,vBk] */
      if (d[0] === horiz && d[1] === vert && Math.round(d[2]) === rInt && !!d[3] === !!interlaced) {
        /* 同名条目多条时后写入者优先（与原站 forEach 覆盖行为一致） */
        t = buildDMT(d, horiz, vert, refresh, interlaced) || t;
      }
    }
    return t;
  }

  function buildDMT(d, horiz, vert, refresh, interlaced) {
    /* 表内标注来自 CEA-861 的条目（如 DMT 0x55）转 VIC 查找 */
    if (d[7] === 'CEA-861') {
      var v = lookupVIC(horiz, vert, refresh, interlaced);
      if (!v) return null;
      v.dmtId = d[4];
      v.dmtType = d[7];
      return v;
    }
    var t = {
          standard: 'dmt', interlaced: !!interlaced,
          hActive: d[0], hBlank: d[12], hTotal: d[11],
          hFront: d[13], hSync: d[14], hBack: d[15], hPol: d[9] ? '+' : '-',
          vActive: d[1], vBlank: d[17], vTotal: d[16],
          vFront: d[18], vSync: d[19], vBack: d[20], vPol: d[10] ? '+' : '-',
          pclk: d[8], aspect: aspectOf(d[0], d[1], CVT_CONST.CELL_GRAN),
          dmtId: d[4], dmt2Byte: d[5], dmt3Byte: d[6], dmtType: d[7]
        };
        /* 表中标注为 CVT 派生的 DMT 条目按 CVT 重算（与原工具一致） */
        if (d[7] === 'cvt' || d[7] === 'cvt-rb') {
          var c = computeCVT(horiz, vert, refresh, false, interlaced,
                             d[7] === 'cvt' ? 'cvt' : 'cvt_rb', false);
          t.hActive = c.hActive; t.hBlank = c.hBlank; t.hTotal = c.hTotal;
          t.hFront = c.hFront;   t.hSync = c.hSync;   t.hBack = c.hBack;
          t.hPol = c.hPol;
          t.vActive = c.vActive; t.vBlank = c.vBlank; t.vTotal = c.vTotal;
          t.vFront = c.vFront;   t.vSync = c.vSync;   t.vBack = c.vBack;
          t.vPol = c.vPol;
          t.pclk = c.pclk;       t.aspect = c.aspect;
        } else if (t.pclk == null || t.hTotal == null || t.vTotal == null) {
          /* 源数据不完整的条目（如 DMT 0x0F）视为未收录 */
          return null;
        }
        return t;
  }

  /* ---------------------------------------------------- VIC 查表 */
  function lookupVIC(horiz, vert, refresh, interlaced) {
    var rInt = Math.round(refresh);
    var found = null;
    for (var i = 0; i < D.VIC.length; i++) {
      var v = D.VIC[i];
      /* v = [vic,hA,vA,il,pc,hT,hB,hF,hS,hBk,hpol,vT,vB,vF,vS,vBk,vpol,vFreq]
       * 同一 (h,v,刷新率) 有多个 VIC 时后写入者优先（与原站 forEach 覆盖行为一致） */
      if (v[1] === horiz && v[2] === vert && Math.round(v[17]) === rInt && v[3] === (interlaced ? 1 : 0)) {
        found = {
          standard: 'cea', interlaced: !!interlaced,
          vic: v[0],
          hActive: v[1], hBlank: v[6], hTotal: v[5],
          hFront: v[7], hSync: v[8], hBack: v[9], hPol: v[10] ? '+' : '-',
          vActive: v[2], vBlank: v[12], vTotal: v[11],
          vFront: v[13], vSync: v[14], vBack: v[15], vPol: v[16] ? '+' : '-',
          pclk: v[4], aspect: aspectOf(v[1], v[2], CVT_CONST.CELL_GRAN)
        };
      }
    }
    return found;
  }

  /* ---------------------------------------------------- Custom
   * 用户指定 hblank/vblank；前后沿按 CVT-RB 布局分配，
   * 消隐预算不足时按比例缩放。
   */
  function computeCustom(horiz, vert, refresh, hBlank, vBlank) {
    hBlank = Math.max(0, Math.floor(hBlank));
    vBlank = Math.max(0, Math.floor(vBlank));

    var hSync, hBack, hFront;
    if (hBlank >= 160)      { hSync = 32; hBack = 80; }
    else if (hBlank >= 16)  { hSync = Math.max(2, Math.round(hBlank * 0.2)); hBack = Math.round(hBlank * 0.5); }
    else                    { hSync = 1;  hBack = Math.floor(hBlank / 3); }
    hFront = hBlank - hSync - hBack;
    if (hFront < 0) { hBack = Math.max(0, hBack + hFront); hFront = 0; }

    var vSync, vBack, vFront;
    if (vBlank >= 15)      { vSync = 8; vBack = 6; }
    else if (vBlank >= 4)  { vSync = 2; vBack = 1; }
    else                   { vSync = 1; vBack = 0; }
    vFront = vBlank - vSync - vBack;
    if (vFront < 0) { vBack = Math.max(0, vBack + vFront); vFront = 0; }

    var hTotal = horiz + hBlank;
    var vTotal = vert + vBlank;
    var pclk = hTotal * vTotal * refresh / 1000000;   /* MHz */

    return {
      standard: 'custom', interlaced: false,
      hActive: horiz, hBlank: hBlank, hTotal: hTotal,
      hFront: hFront, hSync: hSync, hBack: hBack, hPol: '+',
      vActive: vert, vBlank: vBlank, vTotal: vTotal,
      vFront: vFront, vSync: vSync, vBack: vBack, vPol: '+',
      pclk: pclk, aspect: aspectOf(horiz, vert, CVT_CONST.CELL_GRAN),
      vFreq: refresh
    };
  }

  /* ---------------------------------------------------- 派生量 */
  function derive(t) {
    var pclkHz = t.pclk * 1000000;
    var hFreq = pclkHz / t.hTotal;                   /* Hz */
    var vFreq = pclkHz / (t.vTotal * t.hTotal);      /* Hz（实际场频） */
    t.hFreq = hFreq;                                 /* Hz */
    t.vFreqActual = vFreq;                           /* Hz */
    t.hPeriodUs = 1e6 / hFreq;
    t.vPeriodMs = 1e3 / vFreq;
    t.vBlankUs = t.vBlank * t.hPeriodUs;
    return t;
  }

  /* 计算全部 6 种标准。入参为原始表单值；返回 {cvt, cvt_rb, cvt_rb2, custom, dmt, cea} */
  function computeAll(horiz, vert, refresh, margins, interlaced, videoOpt, customHBlank, customVBlank) {
    var out = {
      cvt:    derive(computeCVT(horiz, vert, refresh, margins, interlaced, 'cvt',    videoOpt)),
      cvt_rb: derive(computeCVT(horiz, vert, refresh, margins, interlaced, 'cvt_rb', videoOpt)),
      cvt_rb2: derive(computeCVT(horiz, vert, refresh, margins, interlaced, 'cvt_rb2', videoOpt)),
      custom: derive(computeCustom(horiz, vert, refresh, customHBlank, customVBlank))
    };
    var dmt = lookupDMT(horiz, vert, refresh, interlaced);   /* CEA-861 型条目内部已转 VIC */
    out.dmt = dmt ? derive(dmt) : null;
    var cea = lookupVIC(horiz, vert, refresh, interlaced);
    out.cea = cea ? derive(cea) : null;
    return out;
  }

  /* ---------------------------------------------------- Modeline */
  function modeline(t) {
    var name = t.hActive + 'x' + t.vActive + '_' + round100(t.vFreqActual) + (t.interlaced ? 'i' : '');
    var s = 'Modeline "' + name + '"';
    s += ' ' + Math.round(t.pclk * 1000000 / 1000) / 1000;
    s += ' ' + t.hActive + ' ' + (t.hActive + t.hFront) + ' ' +
         (t.hActive + t.hFront + t.hSync) + ' ' + t.hTotal;
    s += ' ' + t.vActive + ' ' + (t.vActive + t.vFront) + ' ' +
         (t.vActive + t.vFront + t.vSync) + ' ' + t.vTotal;
    s += t.hPol === '+' ? ' +hsync' : ' -hsync';
    s += t.vPol === '+' ? ' +vsync' : ' -vsync';
    if (t.interlaced) s += ' Interlace';
    return s;
  }

  /* ---------------------------------------------------- 带宽核算
   * bpc: 每分量位数；fmtMult: 色度格式系数（rgb444/yuv444=3, yuv422=2, yuv420=1.5）
   * 返回每个接口: { ok, pct, dscOk, dscBpp, restricted }
   */
  function bandwidth(t, bpc, colorFmt) {
    var fmtMult = colorFmt === 'yuv422' ? 2 : colorFmt === 'yuv420' ? 1.5 : 3;
    var pclkHz = t.pclk * 1000000;
    var peak = pclkHz * bpc * fmtMult;
    var peakDsc = pclkHz * 8;

    return TRANSPORTS.map(function (tr) {
      var res = { id: tr.id, ok: false, pct: 0, dscOk: false, dscBpp: 0, restricted: null };
      if ((tr.id === 'dvi_d' || tr.id === 'dvi_dl') && bpc !== 8) {
        res.restricted = '仅支持 8bpc';
        return res;
      }
      if ((tr.id === 'dvi_d' || tr.id === 'dvi_dl') && colorFmt !== 'rgb444') {
        res.restricted = '仅支持 RGB';
        return res;
      }
      res.ok = peak <= tr.bw;
      res.pct = Math.round(peak / tr.bw * 100);
      if (!res.ok && tr.dsc) {
        res.dscOk = peakDsc <= tr.bw;
        res.dscBpp = Math.round(tr.bw / pclkHz * 4) / 4;
      }
      return res;
    });
  }

  /* ---------------------------------------------------- 导出 */
  global.VTC = {
    CVT_CONST: CVT_CONST,
    PRESET_MODES: PRESET_MODES,
    TRANSPORTS: TRANSPORTS,
    computeCVT: computeCVT,
    computeCustom: computeCustom,
    computeAll: computeAll,
    derive: derive,
    lookupDMT: lookupDMT,
    lookupVIC: lookupVIC,
    bandwidth: bandwidth,
    modeline: modeline,
    aspectOf: function (h, v) { var a = aspectOf(h, v, CVT_CONST.CELL_GRAN); return a ? a.name : '未知'; }
  };

})(typeof window !== 'undefined' ? window : global);
