/* ==========================================================================
   EDID Craft Local — timing.js
   VESA CVT 1.1 / 1.2 (standard + reduced blanking v1/v2/v3) and GTF 1.1.
   Every formula here follows the VESA timing-generator equations.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------ constants */
  var CELL_GRAN = 8;
  var MIN_V_PORCH = 3;          /* CVT standard                            */
  var MIN_VSYNC_BP = 550;       /* us, min vertical sync + back porch      */
  var MIN_V_BPORCH = 6;         /* lines                                   */
  var M = 600, C = 40, K = 128, J = 20;
  var C_PRIME = ((C - J) * K / 256) + J;   /* 30  */
  var M_PRIME = M * K / 256;               /* 300 */
  var H_SYNC_PER = 8;           /* % of total pixels                       */

  /* Reduced blanking */
  var RB_MIN_V_BLANK = 460;     /* us                                      */
  var RB_H_SYNC = 32;
  var RB_MIN_V_BPORCH = 6;

  /* GTF */
  var GTF_MIN_VSYNC_BP = 550;
  var GTF_MIN_PORCH = 1;
  var GTF_V_SYNC = 3;
  var GTF_MARGIN_PERCENT = 1.8;

  var CLOCK_STEP_CVT11 = 0.25;  /* MHz */
  var CLOCK_STEP_CVT12 = 0.001; /* MHz */

  /* --------------------------------------------------- aspect / v-sync map */
  /* The CVT vertical sync width is selected from the exact display aspect
     ratio, per the CVT timing-generator lookup.                           */
  function verticalSyncFor(width, height) {
    function rounded(candidate) { return CELL_GRAN * Math.floor(candidate / CELL_GRAN); }
    if (width === rounded(height * 4 / 3)) return { aspect: '4:3', vSync: 4 };
    if (width === rounded(height * 16 / 9)) return { aspect: '16:9', vSync: 5 };
    if (width === rounded(height * 16 / 10)) return { aspect: '16:10', vSync: 6 };
    if (width === rounded(height * 5 / 4)) return { aspect: '5:4', vSync: 7 };
    if (width === rounded(height * 15 / 9)) return { aspect: '15:9', vSync: 7 };
    return { aspect: 'custom', vSync: 10 };
  }

  function floorToStep(value, step) {
    /* The VESA timing generators truncate the pixel clock to the granularity. */
    var n = Math.floor(Math.round(value / step * 1e6) / 1e6);
    return Math.round(n * step * 1e6) / 1e6;
  }

  /* ------------------------------------------------------------------ CVT */
  function computeCVT(options) {
    var width = Math.round(options.width);
    var height = Math.round(options.height);
    var refresh = options.refreshRate;
    var rb = options.rbVersion || 0;      /* 0 standard, 1, 2 or 3         */
    var alt = !!options.alt;
    var isRB = rb > 0;

    var clockStep, cellGran, rbHBlank, rbVFporch, rbVSync, rbVBporch;
    var usesV12 = rb === 2 || rb === 3;

    if (usesV12) {
      clockStep = CLOCK_STEP_CVT12;
      cellGran = 1;
      rbHBlank = 80;
      rbVFporch = 1;
      rbVBporch = RB_MIN_V_BPORCH;
      rbVSync = 8;
      if (rb === 3 && alt) rbHBlank = 160;
    } else {
      clockStep = CLOCK_STEP_CVT11;
      cellGran = CELL_GRAN;
      rbHBlank = 160;
      rbVFporch = 3;
      rbVBporch = RB_MIN_V_BPORCH;
      rbVSync = null;                     /* from aspect ratio             */
    }

    var hPixelsRnd = cellGran * Math.floor(width / cellGran);
    var vLinesRnd = height;

    /* The aspect lookup is performed against the requested width. */
    var aspectInfo = verticalSyncFor(width, height);
    var vSync = rbVSync != null ? rbVSync : aspectInfo.vSync;
    if (!isRB) vSync = aspectInfo.vSync;

    var hPeriodEst, vSyncBp, vBackPorch, vFrontPorch, totalVLines, totalPixels, hBlank;
    var idealDutyCycle = null, dutyCycle = null, pixelClockFactor = 1;

    if (!isRB) {
      /* --- Standard CVT ----------------------------------------------- */
      hPeriodEst = ((1 / refresh) - MIN_VSYNC_BP / 1e6) / (vLinesRnd + MIN_V_PORCH) * 1e6;
      vSyncBp = Math.floor(MIN_VSYNC_BP / hPeriodEst) + 1;
      if (vSyncBp < vSync + MIN_V_BPORCH) vSyncBp = vSync + MIN_V_BPORCH;
      vBackPorch = vSyncBp - vSync;
      vFrontPorch = MIN_V_PORCH;
      totalVLines = vLinesRnd + vSyncBp + MIN_V_PORCH;

      idealDutyCycle = C_PRIME - (M_PRIME * hPeriodEst / 1000);
      dutyCycle = idealDutyCycle < 20 ? 20 : idealDutyCycle;
      hBlank = Math.floor(hPixelsRnd * dutyCycle / (100 - dutyCycle) / (2 * cellGran)) * 2 * cellGran;
      totalPixels = hPixelsRnd + hBlank;

      var pixelClock = floorToStep(totalPixels / hPeriodEst, CLOCK_STEP_CVT11);
      if (pixelClock <= 0) pixelClock = CLOCK_STEP_CVT11;
      return finish(pixelClock);
    }

    /* --- Reduced blanking ------------------------------------------------ */
    hBlank = rbHBlank;
    hPeriodEst = (1e6 / refresh - RB_MIN_V_BLANK) / vLinesRnd;
    var vbiLines = Math.floor(RB_MIN_V_BLANK / hPeriodEst) + 1;
    var rbMinVbi = rbVFporch + vSync + rbVBporch;
    var actVbiLines = vbiLines < rbMinVbi ? rbMinVbi : vbiLines;
    vFrontPorch = (rb === 1) ? rbVFporch : (actVbiLines - rbVBporch - vSync);
    vBackPorch = actVbiLines - vFrontPorch - vSync;
    totalVLines = actVbiLines + vLinesRnd;
    totalPixels = hPixelsRnd + hBlank;

    if (alt && rb === 2) pixelClockFactor = 1000 / 1001;
    var clock = refresh * totalVLines * totalPixels / 1e6 * pixelClockFactor;
    return finish(floorToStep(clock, clockStep));

    /* -------------------------------------------------------- finisher --- */
    function finish(pixelClock) {
      var gran = usesV12 ? 1 : CELL_GRAN;
      var hNSync = isRB ? RB_H_SYNC
        : Math.floor(H_SYNC_PER / 100 * totalPixels / gran) * gran;
      var hBackPorch = hBlank / 2;
      var hFrontPorch = hBlank - hBackPorch - hNSync;
      var hTotal = totalPixels;
      var vTotal = totalVLines;
      var hFreq = pixelClock * 1e6 / hTotal;
      var vFreq = hFreq / vTotal;

      var modeName = rb === 0 ? 'CVT Standard'
        : rb === 1 ? 'CVT-RB v1'
          : rb === 2 ? 'CVT-RB v2'
            : 'CVT-RB v3 (' + (alt ? '160px' : '80px') + ')';

      return {
        algorithm: 'CVT',
        modeName: modeName,
        rbVersion: rb,
        altMode: alt,
        aspectRatio: aspectInfo.aspect,
        requested: { width: width, height: height, refreshRate: refresh },
        interlaced: false,
        margins: false,
        hActive: hPixelsRnd,
        hTotal: hTotal,
        hBlank: hBlank,
        hSync: hNSync,
        hFrontPorch: hFrontPorch,
        hBackPorch: hBackPorch,
        hBorder: 0,
        vActive: height,
        vTotal: vTotal,
        vBlank: totalVLines - height,
        vSync: vSync,
        vFrontPorch: vFrontPorch,
        vBackPorch: vBackPorch,
        vBorder: 0,
        vHalfLine: 0,
        pixelClock: pixelClock,             /* MHz                           */
        hFreq: hFreq,                       /* Hz                            */
        refreshRate: vFreq,                 /* Hz                            */
        frameRate: vFreq,
        fieldRate: vFreq,
        hSyncPositive: isRB,
        vSyncPositive: !isRB,
        idealDutyCycle: idealDutyCycle,
        dutyCycle: dutyCycle,
        hPeriodEst: hPeriodEst
      };
    }
  }

  /* ------------------------------------------------------------------ GTF */
  function computeGTF(options) {
    var width = Math.round(options.width);
    var height = Math.round(options.height);
    var refresh = options.refreshRate;
    var interlaced = !!options.interlaced;
    var margins = !!options.margins;

    var hPixelsRnd = CELL_GRAN * Math.floor(width / CELL_GRAN);
    var vLinesRnd = interlaced ? Math.round(height / 2) : height;
    var vFieldRateRqd = interlaced ? refresh * 2 : refresh;
    var interlaceTerm = interlaced ? 0.5 : 0;

    var topMargin = margins ? Math.round(GTF_MARGIN_PERCENT / 100 * vLinesRnd) : 0;
    var bottomMargin = topMargin;
    var hMargin = margins
      ? CELL_GRAN * Math.round(hPixelsRnd * GTF_MARGIN_PERCENT / 100 / CELL_GRAN)
      : 0;

    var hPeriodEst = ((1 / vFieldRateRqd) - GTF_MIN_VSYNC_BP / 1e6) /
      (vLinesRnd + (2 * topMargin) + GTF_MIN_PORCH + interlaceTerm) * 1e6;
    var vSyncBp = Math.round(GTF_MIN_VSYNC_BP / hPeriodEst);
    if (vSyncBp < GTF_V_SYNC + MIN_V_BPORCH) vSyncBp = GTF_V_SYNC + MIN_V_BPORCH;
    var vBackPorch = vSyncBp - GTF_V_SYNC;
    var totalVLines = vLinesRnd + topMargin + bottomMargin + vSyncBp + interlaceTerm + GTF_MIN_PORCH;

    var vFieldRateEst = 1 / hPeriodEst / totalVLines * 1e6;
    var hPeriod = hPeriodEst / (vFieldRateRqd / vFieldRateEst);
    var vFieldRate = 1 / hPeriod / totalVLines * 1e6;

    var totalActivePixels = hPixelsRnd + 2 * hMargin;
    var idealDutyCycle = C_PRIME - (M_PRIME * hPeriod / 1000);
    var hBlank = Math.round(totalActivePixels * idealDutyCycle / (100 - idealDutyCycle) / (2 * CELL_GRAN)) * 2 * CELL_GRAN;
    var totalPixels = totalActivePixels + hBlank;
    var hSync = Math.round(H_SYNC_PER / 100 * totalPixels / CELL_GRAN) * CELL_GRAN;
    var hBackPorch = hBlank / 2;
    var hFrontPorch = hBlank - hBackPorch - hSync;
    var pixelClock = totalPixels / hPeriod;      /* MHz */
    pixelClock = Math.round(pixelClock * 1000) / 1000;

    var hFreq = pixelClock * 1e6 / totalPixels;
    var frameRate = interlaced ? vFieldRate / 2 : vFieldRate;

    return {
      algorithm: 'GTF',
      modeName: interlaced ? 'GTF Interlaced' : 'GTF Progressive',
      rbVersion: null,
      altMode: false,
      aspectRatio: null,
      requested: { width: width, height: height, refreshRate: refresh },
      interlaced: interlaced,
      margins: margins,
      hActive: hPixelsRnd,
      hTotal: totalPixels,
      hBlank: hBlank,
      hSync: hSync,
      hFrontPorch: hFrontPorch,
      hBackPorch: hBackPorch,
      hBorder: hMargin,
      vActive: vLinesRnd,
      vTotal: totalVLines,
      vBlank: totalVLines - vLinesRnd,
      vSync: GTF_V_SYNC,
      vFrontPorch: GTF_MIN_PORCH,
      vBackPorch: vBackPorch,
      vBorder: topMargin,
      vHalfLine: interlaced ? 0.5 : 0,
      pixelClock: pixelClock,
      hFreq: hFreq,
      refreshRate: vFieldRate,
      frameRate: frameRate,
      fieldRate: vFieldRate,
      hSyncPositive: false,
      vSyncPositive: true,
      idealDutyCycle: idealDutyCycle,
      dutyCycle: idealDutyCycle,
      hPeriodEst: hPeriodEst,
      frameActive: height,
      frameTotal: totalVLines * (interlaced ? 2 : 1)
    };
  }

  /* --------------------------------------------------- formatting helpers */
  /* The mode name used by Modeline / xrandr, e.g. "1920x1080_59.96". */
  function modeName(t) {
    return t.hActive + 'x' + t.vActive + (t.interlaced ? 'i' : '') + '_' +
      (Math.round(t.refreshRate * 100) / 100).toFixed(2);
  }

  function modeline(t) {
    var pol = (t.hSyncPositive ? '+' : '-') + 'HSync ' + (t.vSyncPositive ? '+' : '-') + 'VSync';
    var parts = [
      '"' + (t.hActive + 'x' + t.vActive + '_' + (Math.round(t.refreshRate * 100) / 100).toFixed(2)) + '"',
      (t.pixelClock).toFixed(2),
      t.hActive, (t.hActive + t.hFrontPorch), (t.hActive + t.hFrontPorch + t.hSync), t.hTotal,
      t.vActive, (t.vActive + t.vFrontPorch), (t.vActive + t.vFrontPorch + t.vSync),
      (t.vActive + t.vFrontPorch + t.vSync + t.vBackPorch),
      pol
    ];
    return 'Modeline ' + parts.join(' ');
  }

  function xrandrNewmode(t) {
    return 'xrandr --newmode ' + modeline(t);
  }

  function timingRows(t) {
    return [
      { label: 'Pixel clock', value: t.pixelClock.toFixed(3) + ' MHz' },
      { label: 'Horizontal frequency', value: (t.hFreq / 1000).toFixed(3) + ' kHz' },
      { label: 'Refresh rate', value: t.refreshRate.toFixed(3) + ' Hz' },
      { label: 'Horizontal active', value: t.hActive + ' px' },
      { label: 'Horizontal front porch', value: t.hFrontPorch + ' px' },
      { label: 'Horizontal sync width', value: t.hSync + ' px' },
      { label: 'Horizontal back porch', value: t.hBackPorch + ' px' },
      { label: 'Horizontal blanking', value: t.hBlank + ' px' },
      { label: 'Horizontal total', value: t.hTotal + ' px' },
      { label: 'Vertical active', value: t.vActive + (t.interlaced ? ' lines/field' : ' lines') },
      { label: 'Vertical front porch', value: t.vFrontPorch + ' lines' },
      { label: 'Vertical sync width', value: t.vSync + ' lines' },
      { label: 'Vertical back porch', value: t.vBackPorch + ' lines' },
      { label: 'Vertical blanking', value: t.vBlank + ' lines' },
      { label: 'Vertical total', value: t.vTotal + ' lines' },
      { label: 'Sync polarity', value: (t.hSyncPositive ? '+' : '-') + 'H / ' + (t.vSyncPositive ? '+' : '-') + 'V' }
    ];
  }

  function compare(cvt, gtf) {
    var fields = [
      ['Pixel clock', function (t) { return t.pixelClock; }, 'MHz', 3],
      ['Horizontal total', function (t) { return t.hTotal; }, 'px', 0],
      ['Horizontal blanking', function (t) { return t.hBlank; }, 'px', 0],
      ['Horizontal sync', function (t) { return t.hSync; }, 'px', 0],
      ['Horizontal front porch', function (t) { return t.hFrontPorch; }, 'px', 0],
      ['Horizontal back porch', function (t) { return t.hBackPorch; }, 'px', 0],
      ['Vertical total', function (t) { return t.vTotal; }, 'lines', 0],
      ['Vertical blanking', function (t) { return t.vBlank; }, 'lines', 0],
      ['Vertical sync', function (t) { return t.vSync; }, 'lines', 0],
      ['Horizontal frequency', function (t) { return t.hFreq / 1000; }, 'kHz', 3],
      ['Refresh rate', function (t) { return t.refreshRate; }, 'Hz', 3]
    ];
    var rows = fields.map(function (f) {
      var a = f[1](cvt), b = f[1](gtf);
      return {
        label: f[0],
        cvt: a.toFixed(f[3]) + ' ' + f[2],
        gtf: b.toFixed(f[3]) + ' ' + f[2],
        diff: (b - a).toFixed(f[3]),
        pct: a ? ((b - a) / a * 100).toFixed(2) + '%' : '-'
      };
    });

    var bandwidth = function (t) { return t.pixelClock; };
    var recommendation;
    if (bandwidth(cvt) < bandwidth(gtf)) {
      recommendation = 'CVT uses ' + ((1 - cvt.pixelClock / gtf.pixelClock) * 100).toFixed(1) +
        '% less pixel bandwidth here, which is the better choice for a digital (LCD/OLED) link.';
    } else if (bandwidth(gtf) < bandwidth(cvt)) {
      recommendation = 'GTF uses ' + ((1 - gtf.pixelClock / cvt.pixelClock) * 100).toFixed(1) +
        '% less pixel bandwidth here. GTF is the legacy formula — prefer CVT-RB for modern digital panels.';
    } else {
      recommendation = 'Both formulas produce the same pixel clock for this mode.';
    }
    recommendation += ' GTF is a legacy CRT formula; for modern digital panels prefer CVT reduced blanking.';

    return { rows: rows, recommendation: recommendation };
  }

  /* --------------------------------------------------------------- presets */
  var PRESETS = [
    [1920, 1080, 60, 'Full HD standard'], [1920, 1080, 75, 'Full HD enhanced'],
    [1920, 1080, 120, 'Full HD high refresh'], [1920, 1080, 144, 'Full HD gaming'],
    [1920, 1080, 240, 'Pro esports'],
    [2560, 1440, 60, 'QHD standard'], [2560, 1440, 144, 'QHD gaming'],
    [2560, 1440, 165, 'QHD gaming pro'], [2560, 1440, 240, 'QHD esports'],
    [3840, 2160, 30, '4K UHD 30'], [3840, 2160, 60, '4K UHD'],
    [3840, 2160, 120, '4K high refresh'],
    [2560, 1080, 60, '21:9 ultrawide'], [3440, 1440, 60, '21:9 QHD'],
    [3440, 1440, 120, '21:9 ultrawide gaming'], [3840, 1600, 60, '24:10 ultrawide'],
    [5120, 1440, 120, '32:9 super ultrawide'],
    [5120, 2160, 60, '5K UHD'], [7680, 4320, 60, '8K UHD'],
    [1024, 768, 60, 'XGA legacy'], [1280, 1024, 60, 'SXGA'],
    [1600, 1200, 60, 'UXGA'], [1280, 800, 60, 'WXGA'], [1680, 1050, 60, 'WSXGA+']
  ];

  /* The mode name used by Modeline / xrandr, e.g. "1920x1080_59.96". */
  function modeName(t) {
    return t.hActive + 'x' + t.vActive + (t.interlaced ? 'i' : '') + '_' +
      (Math.round(t.refreshRate * 100) / 100).toFixed(2);
  }

  function xrandrAddMode(t) {
    return 'xrandr --addmode <输出名> ' + modeName(t);
  }

  function xrandrAddOutput(t) {
    return 'xrandr --output <输出名> --mode ' + modeName(t);
  }

  global.EDIDTiming = {
    computeCVT: computeCVT,
    computeGTF: computeGTF,
    verticalSyncFor: verticalSyncFor,
    modeName: modeName,
    modeline: modeline,
    xrandrNewmode: xrandrNewmode,
    xrandrAddMode: xrandrAddMode,
    xrandrAddOutput: xrandrAddOutput,
    timingRows: timingRows,
    compare: compare,
    PRESETS: PRESETS
  };
})(typeof window !== 'undefined' ? window : this);
