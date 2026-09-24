/* ==========================================================================
   EDID-X-LAB — edid-report.js
   Turns engine output (decode / validate / timing) into DOM fragments.
   Zero dependencies.  Plain text values are escaped; rows that carry HTML
   must pass the raw flag so nothing user-supplied is ever injected.
   ========================================================================== */
(function (global) {
  'use strict';

  var C = global.EDIDCore;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function card(title, inner, headerExtra, cardClass) {
    return '<div class="card' + (cardClass ? ' ' + cardClass : '') + '">' +
      '<header><h3>' + title + '</h3><span class="spacer"></span>' + (headerExtra || '') + '</header>' +
      '<div class="body">' + inner + '</div></div>';
  }

  function chip(text, kind) {
    return '<span class="chip ' + (kind || '') + '">' + text + '</span>';
  }

  function yesNo(v) {
    return v ? chip('是', 'ok') : chip('否');
  }

  /* rows: [label, value, valueClass?, raw?] — raw:true keeps the value HTML. */
  function kv(rows) {
    return '<dl class="kv">' + rows.map(function (r) {
      return '<dt>' + r[0] + '</dt><dd class="' + (r[2] || '') + '">' +
        (r[3] ? r[1] : esc(r[1])) + '</dd>';
    }).join('') + '</dl>';
  }

  function tableHtml(head, rows) {
    if (!rows.length) return '<div class="empty">无</div>';
    return '<div class="table-scroll"><table><thead><tr>' +
      head.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function hexByte(v) { return C.hex(v, 2); }
  function fixed(v, n) { return (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n); }

  /* ==================================================================== hex */
  var REGIONS_BASE = [
    [0, 8, '固定头'], [8, 10, '厂商标识'], [10, 12, '产品代码'], [12, 16, '序列号'],
    [16, 17, '制造周'], [17, 18, '制造年'], [18, 19, 'EDID 版本'], [19, 20, '修订号'],
    [20, 21, '视频输入'], [21, 22, '横向尺寸'], [22, 23, '纵向尺寸'], [23, 24, 'Gamma'],
    [24, 25, '特性支持'], [25, 35, '色度坐标'], [35, 38, '既定时序'], [38, 54, '标准时序'],
    [54, 72, '描述符 1'], [72, 90, '描述符 2'], [90, 108, '描述符 3'], [108, 126, '描述符 4'],
    [126, 127, '扩展块数量'], [127, 128, '校验和']
  ];

  function regionAt(blockIndex, byteInBlock) {
    if (blockIndex === 0) {
      for (var i = 0; i < REGIONS_BASE.length; i++) {
        if (byteInBlock >= REGIONS_BASE[i][0] && byteInBlock < REGIONS_BASE[i][1]) return REGIONS_BASE[i][2];
      }
      return '基础块';
    }
    if (byteInBlock === 0) return '扩展标签';
    if (byteInBlock === 1) return '修订号';
    if (byteInBlock === 2) return 'DTD 偏移';
    if (byteInBlock === 3) return '原生 DTD 数 / 标志';
    if (byteInBlock === 127) return '校验和';
    return '扩展数据';
  }

  function hexViewer(bytes, opts) {
    opts = opts || {};
    var perPage = opts.perPage || 256;
    var total = bytes.length;
    var pages = Math.max(1, Math.ceil(total / perPage));
    var page = Math.min(Math.max(0, opts.page || 0), pages - 1);
    var start = page * perPage;
    var end = Math.min(total, start + perPage);
    var out = [];

    out.push('<div class="hex-head">');
    out.push('<span>' + total + ' 字节 / ' + (total / 128) + ' 块</span>');
    out.push('<span class="dim">·</span><span>每行 16 字节，悬停查看字段</span>');
    if (total > perPage) {
      out.push('<span class="spacer right btn-row">');
      out.push('<button class="sm" data-hexpage="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>上一页</button>');
      out.push('<span class="small dim">' + (page + 1) + ' / ' + pages + '</span>');
      out.push('<button class="sm" data-hexpage="' + (page + 1) + '"' + (page >= pages - 1 ? ' disabled' : '') + '>下一页</button>');
      out.push('</span>');
    }
    out.push('</div>');

    out.push('<div class="hex">');
    for (var i = start; i < end; i += 16) {
      var b = Math.floor(i / 128);
      if (i % 128 === 0) {
        out.push('<div class="row" style="color:var(--text-dim)"><span class="off">' +
          (b === 0 ? '基础块' : '扩展块 ' + b) + '</span></div>');
      }
      var line = [];
      var ascii = '';
      for (var j = 0; j < 16; j++) {
        var idx = i + j;
        if (idx >= end) { line.push('  '); continue; }
        var v = bytes[idx];
        line.push('<span class="byt" title="' + esc(regionAt(b, idx % 128)) + ' @ 0x' + C.hex(idx, 4) +
          ' = 0x' + hexByte(v) + ' (' + v + ')" data-off="' + idx + '">' + hexByte(v) + '</span>');
        ascii += (v >= 0x20 && v <= 0x7E) ? esc(String.fromCharCode(v)) : '.';
      }
      out.push('<div class="row"><span class="off">' + C.hex(i, 4) + '</span>' +
        '<span class="bytes">' + line.join(' ') + '</span>' +
        '<span class="ascii">' + ascii + '</span></div>');
    }
    out.push('</div>');
    return out.join('');
  }

  /* ================================================================ decode */
  function timingTable(list, caption) {
    var rows = list.map(function (t, i) {
      return [
        '<span class="dim">' + (i + 1) + '</span>',
        '<b>' + t.hActive + '×' + t.vActive + (t.interlaced ? 'i' : 'p') + '</b>',
        fixed(t.refreshRate, 2) + ' Hz',
        fixed(t.pixelClockKHz / 1000, 3) + ' MHz',
        t.hTotal + ' × ' + t.vTotal,
        t.hSyncOffset + '/' + t.hSyncWidth + ' · ' + t.vSyncOffset + '/' + t.vSyncWidth,
        (t.hSyncPositive ? '+' : '−') + '/' + (t.vSyncPositive ? '+' : '−'),
        (t.hSize || t.vSize) ? (t.hSize + '×' + t.vSize + ' mm') : '—'
      ];
    });
    return card(caption || '详细时序（DTD）',
      tableHtml(['#', '分辨率', '刷新率', '像素时钟', '行×场总数', '同步偏移/宽度', '极性', '图像尺寸'], rows),
      list.length ? chip(list.length + ' 项', 'accent') : '');
  }

  function chromaPlot(ch) {
    var W = 260, H = 260, pad = 26;
    function px(x) { return pad + (x / 0.8) * (W - pad * 2); }
    function py(y) { return H - pad - (y / 0.8) * (H - pad * 2); }
    var pts = [['红', ch.red, 'var(--err)'], ['绿', ch.green, 'var(--ok)'],
      ['蓝', ch.blue, 'var(--accent)'], ['白', ch.white, 'var(--text)']];
    var poly = [ch.red, ch.green, ch.blue].map(function (p) { return px(p.x) + ',' + py(p.y); }).join(' ');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:280px" role="img" aria-label="CIE 1931 色度图">' +
      '<rect x="' + pad + '" y="' + pad + '" width="' + (W - pad * 2) + '" height="' + (H - pad * 2) +
      '" fill="var(--surface-2)" stroke="var(--border)"/>' +
      '<polygon points="' + poly + '" fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--border-strong)"/>' +
      [0.2, 0.4, 0.6].map(function (g) {
        return '<line x1="' + px(g).toFixed(1) + '" y1="' + pad + '" x2="' + px(g).toFixed(1) + '" y2="' + (H - pad) + '" stroke="var(--border)"/>' +
          '<line x1="' + pad + '" y1="' + py(g).toFixed(1) + '" x2="' + (W - pad) + '" y2="' + py(g).toFixed(1) + '" stroke="var(--border)"/>';
      }).join('') +
      pts.map(function (p) {
        return '<circle cx="' + px(p[1].x).toFixed(1) + '" cy="' + py(p[1].y).toFixed(1) +
          '" r="5" fill="' + p[2] + '" stroke="var(--surface)" stroke-width="1.5"/>' +
          '<text x="' + (px(p[1].x) + 8).toFixed(1) + '" y="' + (py(p[1].y) - 6).toFixed(1) +
          '" font-size="11" fill="var(--text-soft)">' + p[0] + '</text>';
      }).join('') +
      '<text x="' + pad + '" y="' + (H - 8) + '" font-size="10" fill="var(--text-dim)">CIE 1931 · x 从 0 到 0.8</text>' +
      '</svg>';
  }

  function descriptorCard(desc, slot) {
    var title = '描述符 ' + slot;
    var inner;
    if (desc.type === 'detailed') {
      inner = kv([
        ['类型', '<b>详细时序描述符（DTD）</b>' + (slot === 1 ? ' ' + chip('首选时序', 'accent') : ''), '', true],
        ['分辨率', desc.hActive + ' × ' + desc.vActive + (desc.interlaced ? ' 隔行' : ' 逐行')],
        ['刷新率', fixed(desc.refreshRate, 3) + ' Hz'],
        ['像素时钟', fixed(desc.pixelClockKHz / 1000, 3) + ' MHz'],
        ['行', '有效 ' + desc.hActive + ' + 消隐 ' + desc.hBlanking + ' = ' + desc.hTotal +
          '（前肩 ' + desc.hSyncOffset + ' / 同步 ' + desc.hSyncWidth + ' / 后肩 ' + desc.hBackPorch + '）'],
        ['场', '有效 ' + desc.vActive + ' + 消隐 ' + desc.vBlanking + ' = ' + desc.vTotal +
          '（前肩 ' + desc.vSyncOffset + ' / 同步 ' + desc.vSyncWidth + ' / 后肩 ' + desc.vBackPorch + '）'],
        ['同步', esc(desc.syncTypeName) + '，行 ' + (desc.hSyncPositive ? '正' : '负') + ' / 场 ' + (desc.vSyncPositive ? '正' : '负')],
        ['图像尺寸', (desc.hSize || desc.vSize)
          ? desc.hSize + ' × ' + desc.vSize + ' mm（约 ' + fixed(desc.diagonalInches, 2) + '″，' + desc.aspectRatio + '）'
          : '未报告'],
        ['边框', desc.hBorder + ' / ' + desc.vBorder + ' 像素'],
        ['原始字节', C.bytesToHex(desc.raw)]
      ]);
    } else if (desc.kind === 'text') {
      inner = kv([
        ['类型', '<b>' + esc(desc.tagName) + '</b>（标签 0x' + hexByte(desc.tag) + '）', '', true],
        ['内容', desc.text ? '"' + esc(desc.text) + '"' : '<span class="dim">（空）</span>', '', true],
        ['长度', desc.text.length + ' 字符'],
        ['结束符', desc.terminated
          ? '<code>0x' + hexByte(desc.terminator) + '</code>' + (desc.terminator === 0x0A ? '（LF，规范要求）' : '（0x00，常见变体）')
          : chip('缺失', 'warn'), '', true],
        ['原始字节', C.bytesToHex(desc.raw)]
      ]);
    } else if (desc.kind === 'range') {
      var rows = [
        ['类型', '<b>行频 / 场频范围限制</b>（标签 0xFD）', '', true],
        ['场频', desc.minVRate + ' – ' + desc.maxVRate + ' Hz'],
        ['行频', desc.minHRate + ' – ' + desc.maxHRate + ' kHz'],
        ['最大像素时钟', desc.maxPixelClock + ' MHz'],
        ['时序支持', esc(desc.timingFormulaName) + '（0x' + hexByte(desc.timingFormula) + '）']
      ];
      if (desc.cvt) {
        rows.push(['CVT 最大有效像素', desc.cvt.maxActivePixelsPerLine ? desc.cvt.maxActivePixelsPerLine + ' px/行' : '未声明']);
        rows.push(['CVT 支持的宽高比', desc.cvt.aspectRatios.length ? esc(desc.cvt.aspectRatios.join('、')) : '未声明']);
        rows.push(['CVT 首选宽高比', desc.cvt.preferredAspect || '未声明']);
        rows.push(['CVT 消隐方式', [desc.cvt.standardBlanking ? '标准消隐' : null, desc.cvt.reducedBlanking ? '缩减消隐' : null]
          .filter(Boolean).join(' + ') || '未声明']);
      }
      if (desc.gtf2) {
        rows.push(['次级 GTF', '起始频率 ' + desc.gtf2.startFrequencyKHz + ' kHz, C=' + desc.gtf2.c +
          ', M=' + desc.gtf2.m + ', K=' + desc.gtf2.k + ', J=' + desc.gtf2.j]);
      }
      rows.push(['未用字节', (desc.timingFormula === 0 || desc.timingFormula === 1)
        ? (desc.padded ? chip('LF + 6 空格', 'ok') : chip('格式不符', 'err'))
        : '<span class="dim">—</span>', '', true]);
      rows.push(['原始字节', C.bytesToHex(desc.raw)]);
      inner = kv(rows);
    } else if (desc.kind === 'dummy') {
      inner = kv([
        ['类型', '<b>空描述符</b>（0x10）', '', true],
        ['用途', '占位，该槽位未使用'],
        ['原始字节', C.bytesToHex(desc.raw)]
      ]);
    } else {
      inner = kv([
        ['类型', esc(desc.tagName || '未知描述符')],
        ['标签', '0x' + hexByte(desc.tag)],
        ['原始字节', C.bytesToHex(desc.raw)]
      ]);
    }
    return card(title, inner);
  }

  function extCard(ext) {
    var label = '扩展块 ' + ext.index + ' · ' + esc(ext.tagName);
    var head = chip('标签 0x' + hexByte(ext.tag), 'accent') +
      (ext.checksumValid ? chip('校验和 ✓', 'ok') : chip('校验和 ✗', 'err'));
    var inner = '';

    if (ext.tag === 0x02) {
      inner += kv([
        ['CEA-861 修订', ext.revision],
        ['数据块集合', ext.dataBlocks.length + ' 个' + (ext.dtdOffset ? '（结束于偏移 ' + ext.dtdOffset + '）' : '')],
        ['原生 DTD 数', ext.nativeDTDCount],
        ['基本音频', yesNo(ext.supportsBasicAudio), '', true],
        ['YCbCr 4:4:4 / 4:2:2', yesNo(ext.supportsYCbCr444) + ' ' + yesNo(ext.supportsYCbCr422), '', true],
        ['欠扫描支持', yesNo(ext.underscan), '', true]
      ]);
      if (ext.issues && ext.issues.length) {
        inner += ext.issues.map(function (m) {
          return '<div class="msg warning"><span class="dot"></span><div class="txt">' + esc(m) + '</div></div>';
        }).join('');
      }
      ext.dataBlocks.forEach(function (b, i) {
        inner += '<div style="margin-top:14px"><h4>数据块 ' + (i + 1) + ' · ' + esc(b.name) +
          ' <span class="dim tiny">(' + esc(b.raw) + ')</span></h4>';
        if (b.video) {
          inner += '<div class="pill-list">' + b.video.map(function (v) {
            return chip('VIC ' + v.code + ' · ' + esc(v.label) + (v.native ? ' ★' : ''), v.native ? 'accent' : '');
          }).join('') + '</div>';
        } else if (b.audio) {
          inner += tableHtml(['格式', '声道', '采样率 (kHz)', '位深'], b.audio.map(function (a) {
            return [esc(a.formatName), a.channels, esc(a.sampleRates.join(', ')), esc(a.bitDepths.join(', '))];
          }));
        } else if (b.speakers) {
          inner += '<div class="pill-list">' + b.speakers.map(function (s) { return chip(esc(s)); }).join('') + '</div>';
        } else if (b.hdmi) {
          inner += kv([
            ['厂商 OUI', esc(b.oui) + ' — ' + esc(b.vendor || '')],
            ['物理地址', esc(b.hdmi.physicalAddress || '—') +
              (b.hdmi.physicalAddress === '0.0.0.0' ? ' ' + chip('未连接', 'warn') : ''), '', true],
            ['最大 TMDS 时钟', b.hdmi.maxTmdsClockMHz ? b.hdmi.maxTmdsClockMHz + ' MHz' : '未声明'],
            ['深色支持', ['30bit', '36bit', '48bit'].map(function (k) {
              return b.hdmi.deepColor && b.hdmi.deepColor[k] ? k : null;
            }).filter(Boolean).join(', ') || '无'],
            ['AI / 双链路 DVI', yesNo(b.hdmi.supportsAI) + ' / ' + yesNo(b.hdmi.dviDual), '', true],
            ['延迟字段', yesNo(b.hdmi.latencyFieldsPresent), '', true]
          ]);
        } else if (b.hdmiForum) {
          inner += kv([['厂商 OUI', esc(b.oui)], ['HF-VSDB 版本', b.hdmiForum.version]]);
        } else if (b.hdrStatic) {
          var e = b.hdrStatic.eotf;
          inner += kv([
            ['SDR / HDR 传统伽马', yesNo(e.traditionalSDR) + ' / ' + yesNo(e.traditionalHDR), '', true],
            ['SMPTE ST 2084 (HDR10)', yesNo(e.smpte2084), '', true],
            ['HLG', yesNo(e.hlg), '', true],
            ['静态元数据 Type 1', yesNo(b.hdrStatic.staticMetadataType1), '', true],
            ['期望最大亮度', b.hdrStatic.desiredContentMaxLuminance || '未声明'],
            ['期望最小亮度', b.hdrStatic.desiredContentMinLuminance || '未声明']
          ]);
        } else if (b.colorimetry) {
          var on = Object.keys(b.colorimetry).filter(function (k) { return b.colorimetry[k]; });
          inner += '<div class="pill-list">' +
            (on.length ? on.map(function (k) { return chip(esc(k), 'ok'); }).join('') : chip('未声明', 'warn')) + '</div>';
        } else if (b.videoCapability) {
          inner += kv([
            ['量化范围（YCC / RGB）', yesNo(b.videoCapability.quantRangeYcc) + ' / ' + yesNo(b.videoCapability.quantRangeRgb), '', true],
            ['IT 内容', yesNo(b.videoCapability.itContent), '', true],
            ['过扫描', b.videoCapability.overscan]
          ]);
        } else if (b.extName) {
          inner += kv([['扩展标签', esc(b.extName) + '（0x' + hexByte(b.extTag) + '）'],
            ['字节', C.bytesToHex(b.bytes)]]);
        } else {
          inner += '<div class="small dim mono">' + C.bytesToHex(b.bytes) + '</div>';
        }
        inner += '</div>';
      });
      if (ext.detailedTimings && ext.detailedTimings.length) {
        inner += '<div style="margin-top:14px"><h4>扩展中的详细时序</h4>' +
          tableHtml(['#', '分辨率', '刷新率', '像素时钟'], ext.detailedTimings.map(function (t, i) {
            return [i + 1, '<b>' + t.hActive + '×' + t.vActive + '</b>',
              fixed(t.refreshRate, 2) + ' Hz', fixed(t.pixelClockKHz / 1000, 3) + ' MHz'];
          })) + '</div>';
      }
    } else if (ext.tag === 0x70) {
      inner += kv([
        ['DisplayID 版本', '0x' + hexByte(ext.version)],
        ['产品类型', ext.productType],
        ['分节字节数', ext.sectionSize]
      ]);
      if (ext.sections.length) {
        inner += tableHtml(['分节', '标签', '版本', '长度', '偏移'], ext.sections.map(function (s) {
          return [esc(s.name), '0x' + hexByte(s.tag), s.revision, s.length + ' B', '0x' + hexByte(s.offset)];
        }));
      }
      inner += '<div class="small dim mono" style="margin-top:8px">原始：' + C.bytesToHex(ext.raw.slice(5, 40)) + ' …</div>';
    } else if (ext.tag === 0x10) {
      inner += kv([
        ['VTB 版本', ext.version],
        ['描述符数量', ext.descriptorCount],
        ['描述符字节', ext.descriptors.length
          ? ext.descriptors.map(function (d) { return C.bytesToHex(d.bytes); }).join('<br>')
          : '—', 'mono', true]
      ]);
    } else if (ext.tag === 0xF0 || ext.tag === 0xAF) {
      inner += kv([
        ['声明的总块数', ext.numberOfBlocks],
        ['块标签', ext.tags.length ? esc(ext.tags.map(function (t) { return t.index + ':' + t.name; }).join('、')) : '未声明']
      ]);
    } else {
      inner += '<div class="small dim">尚未针对该扩展标签实现详细解析。原始数据：<span class="mono">' +
        C.bytesToHex(ext.raw.slice(0, 32)) + ' …</span></div>';
    }
    return card(label, inner, head);
  }

  function decodeReport(decoded) {
    if (!decoded || !decoded.ok) {
      return card('解析失败', '<div class="msg error"><span class="dot"></span><div class="txt">' +
        esc(decoded ? decoded.error : '无数据') + '</div></div>');
    }
    var b = decoded.base;
    var out = [];

    out.push(card('概览', kv([
      ['厂商', '<b>' + esc(b.manufacturer.code) + '</b>' + (b.manufacturer.vendor ? ' · ' + esc(b.manufacturer.vendor) : ' · 未注册厂商代码'), '', true],
      ['产品代码', '0x' + esc(b.productCode) + ' <span class="dim">(十进制 ' + b.productCodeRaw + ')</span>', '', true],
      ['序列号', '0x' + esc(b.serialNumber) + ' <span class="dim">(十进制 ' + b.serialRaw + ')</span>', '', true],
      ['制造日期', esc(b.manufactureDate) + ' <span class="dim">（周/年字节 0x' + hexByte(b.weekRaw) + ' / 0x' + hexByte(b.yearRaw) + '）</span>', '', true],
      ['EDID 版本', '<b>' + esc(b.edidVersion) + '</b>', '', true],
      ['总长度', decoded.byteLength + ' 字节 · ' + decoded.blockCount + ' 块'],
      ['校验和', '存储 0x' + hexByte(b.checksumStored) + ' / 计算 0x' + hexByte(b.checksumComputed)],
      ['扩展块', b.extensionCount + ' 个' + (b.extensionTags.length
        ? '：' + esc(b.extensionTags.map(function (t) { return t.name; }).join('、')) : '')]
    ]), (decoded.headerOk ? chip('固定头 ✓', 'ok') : chip('固定头 ✗', 'err')) +
      (b.checksumValid ? chip('校验和 ✓', 'ok') : chip('校验和 ✗', 'err'))));

    var vi = b.videoInput;
    var viRows = [['输入类型', vi.digital ? '<b>数字</b>' : '<b>模拟</b>', '', true]];
    if (vi.digital) {
      viRows.push(['位深', esc(vi.bitDepthName || ('保留值 ' + vi.bitDepth))]);
      viRows.push(['接口', '<b>' + esc(vi.interfaceName) + '</b>（代码 ' + vi.interface + '）', '', true]);
      viRows.push(['DFP 1.x 兼容', vi.dfi ? chip('是') : chip('否'), '', true]);
      viRows.push(['颜色编码', esc(b.features.colorEncodingName || '—')]);
    } else {
      viRows.push(['电平标准', esc(vi.videoLevelName || '—')]);
      viRows.push(['消隐到黑', yesNo(vi.blankToBlack), '', true]);
      viRows.push(['同步方式', [vi.separateSync && '分离同步', vi.compositeSync && '复合同步',
        vi.syncOnGreen && '绿同步 (SOG)', vi.serratedVSync && '锯齿场同步']
        .filter(Boolean).map(function (s) { return chip(s); }).join(' ') || chip('未声明', 'warn'), '', true]);
    }
    var ss = b.screenSize;
    viRows.push(['屏幕尺寸', ss.mode === 'physical'
      ? ss.widthCm + ' × ' + ss.heightCm + ' cm · 对角 ' + fixed(ss.diagonalInches, 2) + '″ · ' +
        fixed(ss.aspectRatio, 3) + ':1（' + ss.orientation + '）'
      : (ss.mode === 'aspect-ratio' ? '未报告，声明宽高比 ' + fixed(ss.aspectRatio, 2) + ':1'
        : '使用横向宽高比编码 ' + fixed(ss.aspectRatio, 3) + ':1')]);
    viRows.push(['Gamma', b.gammaDefinedInExtension
      ? '由扩展块定义 (0xFF)'
      : fixed(b.gamma, 2) + ' <span class="dim">(字节 0x' + hexByte(b.gammaRaw) + ')</span>', '', true]);
    viRows.push(['电源管理', b.features.dpmsLevels.length
      ? b.features.dpmsLevels.map(function (s) { return chip(s, 'ok'); }).join(' ')
      : chip('未声明', 'warn'), '', true]);
    viRows.push(['sRGB', yesNo(b.features.sRGB), '', true]);
    viRows.push(['首选时序标志', yesNo(b.features.preferredTiming), '', true]);
    viRows.push(['连续频率', yesNo(b.features.continuousFrequency), '', true]);
    out.push(card('显示参数', kv(viRows), chip('字节 0x14 – 0x18')));

    var ch = b.chromaticity;
    out.push(card('色度坐标（CIE 1931）',
      '<div class="grid cols-2" style="gap:18px;align-items:center">' +
      '<div>' + kv([
        ['红', ch.red.x.toFixed(4) + ', ' + ch.red.y.toFixed(4)],
        ['绿', ch.green.x.toFixed(4) + ', ' + ch.green.y.toFixed(4)],
        ['蓝', ch.blue.x.toFixed(4) + ', ' + ch.blue.y.toFixed(4)],
        ['白点', ch.white.x.toFixed(4) + ', ' + ch.white.y.toFixed(4)],
        ['色温', ch.whiteTempK ? '≈ ' + ch.whiteTempK + ' K' : '无法估算'],
        ['sRGB 一致性', ch.srgbMatch
          ? chip('与 sRGB 参考值一致', 'ok')
          : (b.features.sRGB ? chip('声明了 sRGB 但数值不符', 'err') : chip('非 sRGB 色域')), '', true]
      ]) + '<div class="tiny dim mono" style="margin-top:8px">原始：' + C.bytesToHex(b.raw.slice(25, 35)) + '</div></div>' +
      '<div>' + chromaPlot(ch) + '</div></div>'));

    var tInner = '<h4>既定时序（Established Timings）</h4>';
    tInner += b.establishedTimings.length
      ? '<div class="pill-list">' + b.establishedTimings.map(function (t) { return chip(esc(t.label), 'accent'); }).join('') + '</div>'
      : '<div class="empty">未声明</div>';
    tInner += '<h4 style="margin-top:16px">标准时序（Standard Timings）</h4>';
    tInner += tableHtml(['槽位', '分辨率', '宽高比', '刷新率', '原始字节'], b.standardTimings.map(function (s, i) {
      if (s.unused) {
        return ['<span class="dim">' + (i + 1) + '</span>', '<span class="dim">未使用</span>', '—', '—',
          '<span class="mono dim">01 01</span>'];
      }
      return [i + 1, '<b>' + s.width + ' × ' + s.height + '</b>', esc(s.aspectRatio), s.refreshRate + ' Hz',
        '<span class="mono">' + esc(C.bytesToHex(s.raw)) + '</span>'];
    }));
    tInner += '<div class="tiny dim mono" style="margin-top:8px">原始（0x23–0x35）：' + C.bytesToHex(b.raw.slice(35, 54)) + '</div>';
    out.push(card('时序总表', tInner, chip(b.establishedTimings.length + ' 既定时序 · ' +
      b.standardTimings.filter(function (s) { return !s.unused; }).length + ' 标准时序', 'accent')));

    if (decoded.allDetailedTimings && decoded.allDetailedTimings.length) {
      out.push(timingTable(decoded.allDetailedTimings, '详细时序（含扩展块）'));
    }

    out.push('<div class="grid cols-2">' + b.descriptors.map(function (d, i) {
      return descriptorCard(d, i + 1);
    }).join('') + '</div>');

    if (decoded.extensions.length) {
      out.push('<div class="stack">' + decoded.extensions.map(extCard).join('') + '</div>');
    }

    return out.join('');
  }

  /* ============================================================= validate */
  function validationReport(report) {
    if (!report) return card('校验', '<div class="empty">无数据</div>');
    var s = report.summary;
    var out = [];

    out.push(
      '<div class="verdict ' + s.overallStatus + '">' +
      '<div class="score">' + (s.overallStatus === 'valid' ? '✓' : s.overallStatus === 'warnings' ? '!' : '✗') + '</div>' +
      '<div><h3 style="margin:0 0 2px">' +
      (s.overallStatus === 'valid' ? '校验通过' : s.overallStatus === 'warnings' ? '可用，但有警告' : '存在错误') +
      '</h3><div class="small muted">' + esc(report.messages.join(' ')) + '</div></div>' +
      '<div class="right counts">' +
      chip(s.errors + ' 错误', s.errors ? 'err' : 'ok') +
      chip(s.warnings + ' 警告', s.warnings ? 'warn' : 'ok') +
      chip(s.infoMessages + ' 提示', 'info') +
      '</div></div>');

    function section(title, list, kind, emptyText) {
      var inner = list.length
        ? '<div class="stack">' + list.map(function (m) {
          return '<div class="msg ' + kind + '"><span class="dot"></span><div class="txt">' +
            '<div>' + esc(m.message) + '</div>' +
            '<div class="cat">' + esc(m.type || '') + '</div></div></div>';
        }).join('') + '</div>'
        : '<div class="empty">' + emptyText + '</div>';
      return card(title, inner, chip(list.length + ' 项',
        list.length ? (kind === 'error' ? 'err' : kind === 'warning' ? 'warn' : 'info') : 'ok'));
    }

    out.push(section('错误 · 影响可用性', report.errors, 'error', '没有错误。'));
    out.push(section('警告 · 建议修正', report.warnings, 'warning', '没有警告。'));
    out.push(section('提示 · 结构信息', report.info, 'info', '无提示。'));
    return out.join('');
  }

  /* =============================================================== timing */
  function timingReport(t, ctx) {
    var E = global.EDIDEncoder, T = global.EDIDTiming;
    ctx = ctx || {};
    if (!t) return card('时序', '<div class="empty">无结果</div>');
    var out = [];

    out.push(card(ctx.label || '计算结果', kv([
      ['像素时钟', '<b>' + t.pixelClock.toFixed(3) + ' MHz</b>', '', true],
      ['刷新率', t.refreshRate.toFixed(4) + ' Hz', '', true],
      ['行频', (t.hFreq / 1000).toFixed(3) + ' kHz'],
      ['行总数', t.hActive + ' + ' + t.hBlank + ' = ' + t.hTotal],
      ['场总数', t.vActive + ' + ' + t.vBlank + ' = ' + t.vTotal + (t.interlaced ? '（按场）' : '')],
      ['消隐方式', esc(t.modeName || '')],
      ['同步极性', (t.hSyncPositive ? '行正' : '行负') + ' / ' + (t.vSyncPositive ? '场正' : '场负')]
    ]), chip(t.algorithm + (t.rbVersion ? ' · RB v' + t.rbVersion : ''), 'accent')));

    function bar(label, active, fp, sync, bp, total) {
      var p = function (v) { return (v / total * 100).toFixed(3) + '%'; };
      var show = function (v) { return v > total / 40 ? v : ''; };
      return '<div class="bar"><span class="dim">' + label + '</span><div class="track">' +
        '<span class="active" style="width:' + p(active) + '" title="有效 ' + active + '">' + active + '</span>' +
        '<span class="fp" style="width:' + p(fp) + '" title="前肩 ' + fp + '">' + show(fp) + '</span>' +
        '<span class="sync" style="width:' + p(sync) + '" title="同步 ' + sync + '">' + show(sync) + '</span>' +
        '<span class="bp" style="width:' + p(bp) + '" title="后肩 ' + bp + '">' + show(bp) + '</span>' +
        '</div></div>';
    }
    out.push(card('消隐结构', '<div class="bars">' +
      bar('行（像素）', t.hActive, t.hFrontPorch, t.hSync, t.hBackPorch, t.hTotal) +
      bar('场（行）', t.vActive, t.vFrontPorch, t.vSync, t.vBackPorch, t.vTotal) +
      '</div><div class="flex tiny dim" style="margin-top:10px">' +
      '<span class="chip" style="background:var(--accent);color:#fff;border-color:transparent">有效</span>' +
      '<span class="chip" style="background:var(--teal);color:#fff;border-color:transparent">前肩</span>' +
      '<span class="chip" style="background:#f59e0b;color:#fff;border-color:transparent">同步</span>' +
      '<span class="chip">后肩</span></div>'));

    out.push(card('全部参数', tableHtml(['参数', '数值'], T.timingRows(t).map(function (r) {
      return [esc(r.label), '<span class="mono">' + esc(r.value) + '</span>'];
    }))));

    var modeline = T.modeline(t);
    var xrandr = T.xrandrNewmode(t);
    var dtd = E.packDTD(E.dtdFromTiming(t));
    out.push(card('可复制的结果', kv([
      ['X11 Modeline', '<span class="mono">' + esc(modeline) + '</span>', '', true],
      ['新建模式', '<span class="mono">' + esc(xrandr) + '</span>', '', true],
      ['绑定输出', '<span class="mono">' + esc(T.xrandrAddOutput(t)) + '</span>', '', true],
      ['DTD 字节（18 B）', '<span class="mono">' + esc(C.bytesToHex(dtd)) + '</span>', '', true]
    ]), '<button class="sm" data-copy="' + esc(modeline) + '">复制 Modeline</button>' +
      '<button class="sm" data-copy="' + esc(xrandr) + '">复制 xrandr</button>'));

    return out.join('');
  }

  global.EDIDReport = {
    esc: esc,
    card: card,
    chip: chip,
    kv: kv,
    tableHtml: tableHtml,
    hexViewer: hexViewer,
    decodeReport: decodeReport,
    validationReport: validationReport,
    timingReport: timingReport,
    chromaPlot: chromaPlot
  };
})(typeof window !== 'undefined' ? window : this);
