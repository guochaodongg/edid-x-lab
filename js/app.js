/* ==========================================================================
   EDID-X-LAB — app.js
   UI wiring: tabs, theme, file input, decoder / encoder / validator /
   timing calculators, drafts, exports.  No dependencies.
   ========================================================================== */
(function () {
  'use strict';

  var C = window.EDIDCore, T = window.EDIDTiming, D = window.EDIDDecoder,
    E = window.EDIDEncoder, V = window.EDIDValidator, R = window.EDIDReport;

  var LS_KEY = 'edidcraft-local:v1';
  var MAX_FILE = 128 * 256;

  var state = {
    tab: 'decoder',
    theme: 'light',
    dec: { hex: '', page: 0 },
    val: { hex: '' },
    enc: { model: null, page: 0 },
    tm: { standard: 'cvt', rb: 0, width: 1920, height: 1080, refresh: 60, aspect: 'auto', interlaced: false, margins: false },
    printPanel: null
  };

  /* --------------------------------------------------------- tiny helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return R.esc(s); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function toast(title, msg, kind) {
    var box = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = (title ? '<b>' + esc(title) + '</b>' : '') + (msg ? esc(msg) : '');
    box.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(14px)';
      setTimeout(function () { el.remove(); }, 260);
    }, kind === 'err' ? 6000 : 3800);
  }

  function openModal(title, bodyHtml, footHtml) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = bodyHtml;
    $('#modal-foot').innerHTML = footHtml || '<button id="modal-ok">关闭</button>';
    $('#modal').classList.add('open');
  }
  function closeModal() { $('#modal').classList.remove('open'); modalPicker = null; }

  /* A modal can carry a "pick one" list.  Only one picker is ever live, and
     dismissing the modal clears it — so no stale handler survives a re-open. */
  var modalPicker = null;
  function setModalPicker(fn) { modalPicker = fn; }

  function download(name, data, mime) {
    var blob = data instanceof Uint8Array ? new Blob([data], { type: mime || 'application/octet-stream' })
      : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制', '内容已写入剪贴板', 'ok'); },
        function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制', '内容已写入剪贴板', 'ok'); }
    catch (e) { toast('复制失败', '请手动选择文本', 'err'); }
    ta.remove();
  }

  function printPanel(id) {
    state.printPanel = id;
    document.body.setAttribute('data-print', id);
    $$('.panel').forEach(function (p) { p.classList.toggle('print-me', p.id === 'panel-' + id); });
    window.print();
    setTimeout(function () {
      document.body.removeAttribute('data-print');
      $$('.panel').forEach(function (p) { p.classList.remove('print-me'); });
    }, 400);
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        tab: state.tab, theme: state.theme,
        decHex: state.dec.hex, valHex: state.val.hex,
        model: state.enc.model, tm: state.tm
      }));
    } catch (e) { /* storage full or blocked — drafts are a nicety */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------- input handling */
  /* Turn pasted text or a binary file into bytes. */
  function bytesFromText(text) {
    var s = String(text).replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
    if (!s.length) return null;
    if (s.length % 2) s = s.substring(0, s.length - 1);
    if (!s.length) return null;
    var out = new Uint8Array(s.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  function readFile(file, cb) {
    var lower = (file.name || '').toLowerCase();
    var asText = /\.(hex|txt|log|edid)$/.test(lower);
    var fr = new FileReader();
    fr.onerror = function () { toast('读取失败', '无法读取文件 ' + file.name, 'err'); };
    fr.onload = function () {
      var bytes;
      if (asText) {
        bytes = bytesFromText(fr.result);
      } else {
        var raw = new Uint8Array(fr.result);
        /* A .bin that happens to be ASCII hex text is quite common. */
        if (raw.length && raw.length % 128 !== 0) {
          var looksText = true;
          for (var i = 0; i < Math.min(raw.length, 64); i++) {
            var c = raw[i];
            if (!(c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x2c ||
              (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66))) {
              looksText = false; break;
            }
          }
          var guess = looksText ? bytesFromText(new TextDecoder().decode(raw)) : null;
          if (guess) raw = guess;
        }
        bytes = raw;
      }
      if (!bytes || !bytes.length) { toast('无法识别', '文件内容既不是 EDID 二进制也不是十六进制文本', 'err'); return; }
      cb(bytes, file);
    };
    if (asText) fr.readAsText(file); else fr.readAsArrayBuffer(file);
  }

  function dropZone(zone, onBytes) {
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('over'); });
    });
    zone.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f, onBytes);
    });
  }

  /* Byte counter for the side panels. */
  function updateSizeChip(hexText, chipEl) {
    var b = bytesFromText(hexText || '');
    chipEl.textContent = b ? (b.length + ' 字节 / ' + (b.length / 128 % 1 === 0 ? b.length / 128 : '—') + ' 块') : '0 字节';
    chipEl.className = 'chip' + (b && b.length % 128 === 0 && b.length >= 128 ? ' ok' : (b ? ' warn' : ''));
  }

  /* =============================================================== samples */
  function presetHex(key) {
    var m = E.defaultModel();
    E.FORMAT_PRESETS[key].apply(m);
    return E.encode(m);
  }

  var PY_SAMPLE = '00FFFFFFFFFFFF0010AC4034040302011E220104A2341D78E6A3544C99260F5054EE912108' +
    '0081C00101010101010101010101010101023A801871382D40582C4500FD1E1100001E000000FD00324B1E' +
    '53110000000000000000000000FC0053414D504C452D32370A000000000000100000000000000000000000' +
    '0000000023';

  function sampleList() {
    var list = [
      { name: '1080p HDMI 显示器（sRGB + CEA-861）', note: '默认模型：数字 HDMI-a、8 bpc、1920×1080@60 首选时序、CVT 范围限制、含视频/音频/扬声器/VSDB 四个数据块', hex: function () { return E.encode(E.defaultModel()).hex; } },
      { name: '4K UHD + HDR 静态元数据', note: '3840×2160 RBv2、10 bpc、深层彩色、HDR10 + HLG、色度扩展块', hex: function () { return presetHex('4k').hex; } },
      { name: '1440p 144 Hz 游戏屏', note: '2560×1440 RBv2、CVT 范围限制到 165 Hz、CEA-861（含 4K VIC）', hex: function () { return presetHex('hdr').hex; } },
      { name: '1440p 60 Hz（DisplayPort）', note: 'DP 接口、无 CEA 扩展块，可观察“HDMI/DP 缺少 CEA”的警告', hex: function () { return presetHex('1440p').hex; } },
      { name: '21:9 带鱼屏 3440×1440', note: 'DP 接口、缩小边框的宽屏时序', hex: function () { return presetHex('ultrawide').hex; } },
      { name: '笔记本电脑 eDP 面板', note: '无 DPMS 电源状态、范围限制仅声明区间（range limits only）', hex: function () { return presetHex('laptop').hex; } },
      { name: '传统 VGA 显示器（模拟）', note: '模拟输入、13 项既定时序、GTF 范围限制', hex: function () { return presetHex('legacy').hex; } },
      { name: '真实转储样例（含 4 处问题）', note: '手写 EDID：范围限制未按 LF+6 空格补齐、缺少 CEA 扩展块 — 适合练手校验', hex: function () { return PY_SAMPLE; } }
    ];
    return list;
  }

  function showSamples(target) {
    var list = sampleList();
    var body = '<div class="stack">' + list.map(function (s, i) {
      return '<button class="btn" style="width:100%;text-align:left;align-items:flex-start" data-sample="' + i + '">' +
        '<span><b>' + esc(s.name) + '</b><div class="small dim">' + esc(s.note) + '</div></span></button>';
    }).join('') + '</div>';
    openModal('载入示例', body);
    setModalPicker(function (el) {
      var btn = el.closest('[data-sample]');
      if (!btn) return false;
      var s = list[parseInt(btn.getAttribute('data-sample'), 10)];
      if (!s) return false;
      closeModal();
      target(s.hex(), s.name);
      return true;
    });
  }

  /* =============================================================== decoder */
  function decRender(bytes, sourceName) {
    var report = D.decode(bytes);
    var out = $('#dec-out');
    out.innerHTML = report.ok
      ? R.decodeReport(report) +
        R.card('原始字节', R.hexViewer(bytes, { page: state.dec.page }), R.chip(bytes.length + ' 字节'))
      : R.decodeReport(report);
    if (!report.ok) { toast('解析失败', report.error, 'err'); return; }
    var v = V.validate(bytes);
    toast(report.ok ? '解析完成' : '解析失败',
      (sourceName ? sourceName + ' · ' : '') + (report.base.manufacturer.vendor || report.base.manufacturer.code) +
      ' · ' + report.base.edidVersion + ' · ' + (report.base.preferredTiming
        ? report.base.preferredTiming.hActive + '×' + report.base.preferredTiming.vActive : '无首选时序') +
      ' · 校验：' + (v.isValid ? '通过' : v.errors.length + ' 个错误'),
      v.isValid ? 'ok' : 'warn');
    state.dec.bytes = bytes;
  }

  function decRun(sourceName) {
    var hex = $('#dec-hex').value;
    state.dec.hex = hex; state.dec.page = 0;
    var bytes = bytesFromText(hex);
    if (!bytes) { toast('没有数据', '请粘贴十六进制或拖入文件', 'err'); return; }
    decRender(bytes, sourceName);
    save();
  }

  function decSetBytes(bytes, name) {
    $('#dec-hex').value = C.bytesToHex(bytes);
    state.dec.hex = $('#dec-hex').value;
    state.dec.page = 0;
    decRender(bytes, name);
    updateSizeChip(state.dec.hex, $('#dec-size'));
    save();
  }

  /* Decoded EDID -> encoder model (best effort, lossless where possible). */
  function modelFromDecoded(dec) {
    var b = dec.base;
    var m = E.defaultModel();
    m.extensions = [];
    if (b.manufacturer.valid) m.manufacturer = b.manufacturer.code;
    m.productCode = b.productCode;
    m.serialNumber = b.serialNumber;
    m.weekOfManufacture = b.modelYearFlag ? 0xFF : b.weekRaw;
    m.yearOfManufacture = b.year;
    m.modelYearFlag = b.modelYearFlag;
    m.edidVersion = b.versionMajor;
    m.edidRevision = b.versionMinor;
    m.isDigital = b.videoInput.digital;
    if (b.videoInput.digital) {
      m.bitDepth = b.videoInput.bitDepth;
      m.digitalInterface = b.videoInput.interface;
      m.colorEncoding = ((b.featuresRaw >> 3) & 0x03) + 1;
    } else {
      m.videoLevel = b.videoInput.videoLevel;
      m.syncSupport = {
        separate: b.videoInput.separateSync, composite: b.videoInput.compositeSync,
        syncOnGreen: b.videoInput.syncOnGreen, serrated: b.videoInput.serratedVSync
      };
    }
    m.width = b.widthCm; m.height = b.heightCm;
    m.gammaDefinedInExtension = b.gammaDefinedInExtension;
    m.gamma = b.gammaDefinedInExtension ? 2.2 : Math.round(b.gamma * 100) / 100;
    m.dpms = { standby: b.features.standby, suspend: b.features.suspend, activeOff: b.features.activeOff };
    m.features = {
      sRGB: b.features.sRGB, preferredTiming: b.features.preferredTiming,
      continuousFrequency: b.features.continuousFrequency
    };
    m.colorCharacteristics = {
      red: { x: b.chromaticity.red.x, y: b.chromaticity.red.y },
      green: { x: b.chromaticity.green.x, y: b.chromaticity.green.y },
      blue: { x: b.chromaticity.blue.x, y: b.chromaticity.blue.y },
      white: { x: b.chromaticity.white.x, y: b.chromaticity.white.y }
    };
    m.manufacturerTimingBits = b.manufacturerTimingBits || 0;
    m.establishedTimings = b.establishedTimings.map(function (t) { return t.label; });
    m.standardTimings = b.standardTimings.filter(function (s) { return !s.unused; })
      .map(function (s) { return { width: s.width, height: s.height, refreshRate: s.refreshRate, aspectRatio: s.aspectRatio }; });
    m.descriptors = b.descriptors.map(function (d) {
      if (d.type === 'detailed') {
        return {
          type: 'detailed', data: {
            pixelClock: d.pixelClockKHz, hActive: d.hActive, hBlanking: d.hBlanking,
            vActive: d.vActive, vBlanking: d.vBlanking,
            hSyncOffset: d.hSyncOffset, hSyncWidth: d.hSyncWidth,
            vSyncOffset: d.vSyncOffset, vSyncWidth: d.vSyncWidth,
            hSize: d.hSize, vSize: d.vSize, hBorder: d.hBorder, vBorder: d.vBorder,
            interlaced: d.interlaced, stereo: d.stereo, syncType: d.syncType,
            hSyncPositive: d.hSyncPositive, vSyncPositive: d.vSyncPositive
          }
        };
      }
      if (d.kind === 'text') return { type: d.tag === 0xFC ? 'product_name' : d.tag === 0xFF ? 'serial_number' : 'ascii_string', text: d.text };
      if (d.kind === 'range') {
        return {
          type: 'range_limits', data: {
            minVRate: d.minVRate, maxVRate: d.maxVRate, minHRate: d.minHRate, maxHRate: d.maxHRate,
            maxPixelClock: d.maxPixelClock, timingFormula: d.timingFormula,
            cvtMaxPixelClock: d.cvt ? d.cvt.maxPixelClockMHz : undefined,
            cvtMaxActivePixels: d.cvt ? d.cvt.maxActivePixelsPerLine : undefined,
            cvtPreferredAspect: d.cvt ? d.cvt.preferredAspect : undefined,
            cvtAspectRatios: d.cvt ? d.cvt.aspectRatios : undefined
          }
        };
      }
      return { type: 'unused' };
    });
    while (m.descriptors.length < 4) m.descriptors.push({ type: 'unused' });

    var skipped = [];
    dec.extensions.forEach(function (ext) {
      if (ext.tag === 0x02) {
        var cea = {
          type: 'CEA', revision: ext.revision,
          features: {
            basicAudio: ext.supportsBasicAudio, ycbcr444: ext.supportsYCbCr444,
            ycbcr422: ext.supportsYCbCr422, underscan: ext.underscan
          },
          dataBlocks: [], detailedTimings: []
        };
        ext.dataBlocks.forEach(function (blk) {
          if (blk.video) cea.dataBlocks.push({ type: 'video', codes: blk.video.map(function (v) { return { code: v.code, native: v.native }; }) });
          else if (blk.audio) cea.dataBlocks.push({
            type: 'audio', items: blk.audio.map(function (a) {
              return { format: a.format, channels: a.channels, sampleRates: a.sampleRates, bitDepths: a.bitDepths };
            })
          });
          else if (blk.speakers) {
            var bits = [];
            C.SPEAKER_ALLOCATION.forEach(function (s) { if (blk.speakers.indexOf(s[1]) >= 0) bits.push(s[0]); });
            cea.dataBlocks.push({ type: 'speaker', speakers: bits });
          } else if (blk.hdmi) {
            var pa = (blk.hdmi.physicalAddress || '1.0.0.0').split('.').map(Number);
            cea.dataBlocks.push({
              type: 'hdmi-vsdb', data: {
                a: pa[0] || 0, b: pa[1] || 0, c: pa[2] || 0, d: pa[3] || 0,
                supportsAI: !!blk.hdmi.supportsAI, dviDual: !!blk.hdmi.dviDual,
                deepColor30: !!(blk.hdmi.deepColor && blk.hdmi.deepColor['30bit']),
                deepColor36: !!(blk.hdmi.deepColor && blk.hdmi.deepColor['36bit']),
                deepColor48: !!(blk.hdmi.deepColor && blk.hdmi.deepColor['48bit']),
                maxTmdsClockMHz: blk.hdmi.maxTmdsClockMHz || 300
              }
            });
          } else if (blk.hdrStatic) {
            cea.dataBlocks.push({
              type: 'hdr-static', data: {
                traditionalSDR: blk.hdrStatic.eotf.traditionalSDR, traditionalHDR: blk.hdrStatic.eotf.traditionalHDR,
                hdrPQ: blk.hdrStatic.eotf.smpte2084, hlg: blk.hdrStatic.eotf.hlg,
                staticMetadata: blk.hdrStatic.staticMetadataType1
              }
            });
          } else if (blk.colorimetry) {
            cea.dataBlocks.push({ type: 'colorimetry', data: blk.colorimetry });
          }
        });
        (ext.detailedTimings || []).forEach(function (d) { cea.detailedTimings.push(E.dtdFromTiming(d)); });
        m.extensions.push(cea);
      } else {
        skipped.push(ext.tagName);
      }
    });
    return { model: m, skipped: skipped };
  }

  /* ============================================================= validator */
  function valRun() {
    var hex = $('#val-hex').value;
    state.val.hex = hex;
    var bytes = bytesFromText(hex);
    if (!bytes) { toast('没有数据', '请粘贴十六进制或拖入文件', 'err'); return; }
    var report = V.validate(bytes);
    $('#val-out').innerHTML = R.validationReport(report);
    toast('校验完成', report.summary.errors + ' 错误 / ' + report.summary.warnings + ' 警告 / ' +
      report.summary.infoMessages + ' 提示',
      report.summary.errors ? 'err' : (report.summary.warnings ? 'warn' : 'ok'));
    save();
  }

  /* =============================================================== encoder */
  function setPath(obj, path, val) {
    var parts = path.split('.'), o = obj, i;
    for (i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (!o[k] || typeof o[k] !== 'object') o[k] = {};
      o = o[k];
    }
    o[parts[parts.length - 1]] = val;
  }

  function opt(value, label, current) {
    return '<option value="' + esc(value) + '"' + (String(current) === String(value) ? ' selected' : '') + '>' +
      esc(label) + '</option>';
  }

  function num(path, value, opts) {
    opts = opts || {};
    return '<input type="number" data-path="' + path + '" data-type="number" value="' + esc(value) + '"' +
      (opts.min != null ? ' min="' + opts.min + '"' : '') +
      (opts.max != null ? ' max="' + opts.max + '"' : '') +
      (opts.step != null ? ' step="' + opts.step + '"' : '') + '>';
  }

  function text(path, value, placeholder, maxlen) {
    return '<input type="text" data-path="' + path + '" value="' + esc(value == null ? '' : value) + '"' +
      (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') +
      (maxlen ? ' maxlength="' + maxlen + '"' : '') + '>';
  }

  function select(path, value, options) {
    return '<select data-path="' + path + '">' + options.map(function (o) {
      return opt(o[0], o[1], value);
    }).join('') + '</select>';
  }

  function check(path, checked, label) {
    return '<label class="check"><input type="checkbox" data-path="' + path + '" data-type="bool"' +
      (checked ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
  }

  function f(label, control, hint) {
    return '<div class="field"><label>' + esc(label) + '</label>' + control +
      (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  }

  function encFormHtml(m) {
    var html = '';
    var ci = C.DIGITAL_INTERFACE.map(function (n, i) { return [i, i + ' — ' + n]; });
    var bd = C.BIT_DEPTH.map(function (n, i) { return [i, i + ' — ' + n]; });
    var ce = C.COLOR_ENCODING.map(function (n, i) { return [i + 1, (i + 1) + ' — ' + n]; });

    /* ---- identity ---- */
    html += R.card('标识信息',
      '<div class="field-row">' +
      f('厂商代码（3 字母）', text('manufacturer', m.manufacturer, 'DEL', 3), 'EDID 用 5 位压缩编码，需为 A–Z 三个字母') +
      f('产品代码（16 进制）', text('productCode', m.productCode, '1A3F', 4)) +
      f('序列号（16 进制）', text('serialNumber', m.serialNumber, '01234567', 8)) +
      '</div>' +
      '<div class="field-row">' +
      f('制造周 (1–54)', num('weekOfManufacture', m.weekOfManufacture, { min: 0, max: 255 }), m.modelYearFlag ? '已勾选“型号年”，该字节写 0xFF' : '') +
      f('制造年', num('yearOfManufacture', m.yearOfManufacture, { min: 1990, max: 2245 }), '写入时减去 1990') +
      '</div>' + check('modelYearFlag', m.modelYearFlag, '年份表示“型号年”而非制造年（周字节 = 0xFF）') +
      '<div class="field-row">' +
      f('制造商时序位（0x25 b6–b0）', num('manufacturerTimingBits', m.manufacturerTimingBits, { min: 0, max: 127 })) +
      '</div>');

    /* ---- version ---- */
    html += R.card('版本',
      '<div class="field-row">' +
      f('主版本', num('edidVersion', m.edidVersion, { min: 1, max: 2 }), '现代显示器为 1') +
      f('修订号', num('edidRevision', m.edidRevision, { min: 0, max: 4 }), '3 = EDID 1.3，4 = EDID 1.4') +
      '</div>');

    /* ---- video input ---- */
    var viHtml = '<div class="field-row">' + f('输入类型', select('isDigital', m.isDigital ? '1' : '0',
      [[1, '数字（Digital）'], [0, '模拟（Analog）']])) + '</div>';
    if (m.isDigital) {
      viHtml += '<div class="field-row">' +
        f('位深', select('bitDepth', m.bitDepth, bd)) +
        f('数字接口', select('digitalInterface', m.digitalInterface, ci)) +
        f('颜色编码', select('colorEncoding', m.colorEncoding, ce)) +
        '</div>';
    } else {
      viHtml += '<div class="field-row">' +
        f('电平标准', select('videoLevel', m.videoLevel, C.VIDEO_LEVEL.map(function (n, i) { return [i, n]; }))) +
        f('模拟显示类型', select('analogDisplayType', m.analogDisplayType,
          [[0, '单色 / 黑白'], [1, 'RGB 彩色'], [2, '非 RGB 彩色'], [3, '保留']])) +
        '</div>' +
        check('analogSetupExpected', m.analogSetupExpected, '期望消隐电平 / 黑电平（setup pedestal）') +
        '<div class="field-row">' +
        '<fieldset><legend>同步方式</legend>' +
        check('syncSupport.separate', m.syncSupport.separate, '分离行场同步') +
        check('syncSupport.composite', m.syncSupport.composite, '复合同步') +
        check('syncSupport.syncOnGreen', m.syncSupport.syncOnGreen, '绿同步 (SOG)') +
        check('syncSupport.serrated', m.syncSupport.serrated, '锯齿场同步') +
        '</fieldset></div>';
    }
    html += R.card('视频输入', viHtml);

    /* ---- screen and gamma ---- */
    html += R.card('屏幕与 Gamma',
      '<div class="field-row">' +
      f('横向尺寸 (cm)', num('width', m.width, { min: 0, max: 255 })) +
      f('纵向尺寸 (cm)', num('height', m.height, { min: 0, max: 255 })) +
      f('Gamma', num('gamma', m.gamma, { min: 1, max: 3.54, step: 0.01 }), '1.00 – 3.54；字节 = 值×100 − 100') +
      '</div>' +
      check('gammaDefinedInExtension', m.gammaDefinedInExtension, 'Gamma 由扩展块定义（字节写 0xFF）') +
      '<div class="hint">例如 52 × 29 cm ≈ 23.4 英寸 16:9。</div>');

    /* ---- features ---- */
    html += R.card('特性支持',
      '<div class="grid cols-2" style="gap:8px 20px">' +
      '<fieldset><legend>电源管理（DPMS）</legend>' +
      check('dpms.standby', m.dpms.standby, '支持待机') +
      check('dpms.suspend', m.dpms.suspend, '支持挂起') +
      check('dpms.activeOff', m.dpms.activeOff, '支持关闭') +
      '</fieldset>' +
      '<fieldset><legend>显示特性</legend>' +
      check('features.sRGB', m.features.sRGB, '标准 sRGB 色彩空间') +
      check('features.preferredTiming', m.features.preferredTiming, '首选时序可用（第 1 个描述符必须是 DTD）') +
      check('features.continuousFrequency', m.features.continuousFrequency, '连续频率（GTF / CVT）') +
      '</fieldset></div>');

    /* ---- chromaticity ---- */
    function xyRow(name, obj) {
      return '<div class="field-row" style="grid-template-columns:70px 1fr 1fr">' +
        '<div style="align-self:center;font-weight:600;font-size:.85rem">' + name + '</div>' +
        '<input type="number" step="0.0001" min="0" max="0.8" data-path="colorCharacteristics.' + obj + '.x" data-type="number" value="' + m.colorCharacteristics[obj].x + '">' +
        '<input type="number" step="0.0001" min="0" max="0.8" data-path="colorCharacteristics.' + obj + '.y" data-type="number" value="' + m.colorCharacteristics[obj].y + '">' +
        '</div>';
    }
    html += R.card('色度坐标',
      '<div class="small dim" style="margin-bottom:6px">格式：x / y（CIE 1931，10 位精度，存入时会四舍五入到 1/1024）</div>' +
      xyRow('红', 'red') + xyRow('绿', 'green') + xyRow('蓝', 'blue') + xyRow('白点', 'white') +
      '<div class="btn-row" style="margin-top:8px">' +
      '<button class="sm" data-act="color-srgb">重置为 sRGB</button>' +
      '<button class="sm" data-act="color-d65">白点设为 D65</button></div>');

    /* ---- established timings ---- */
    var estHtml = '<div class="grid cols-3" style="gap:2px 14px">' + C.ESTABLISHED.map(function (e) {
      var on = m.establishedTimings.some(function (l) { return C.establishedKey(l) === C.establishedKey(e[2]); });
      return check('est:' + e[2], on, e[2].replace('×', 'x'));
    }).join('') + '</div>' +
      '<div class="hint">对应基础块偏移 0x23–0x25 的三个字节，共可声明 17 项经典时序。</div>';
    html += R.card('既定时序', estHtml,
      '<span class="chip accent" data-est-chip>' + m.establishedTimings.length + ' 项</span>' +
      '<button class="sm" data-act="est-none">清空</button>');

    /* ---- standard timings ---- */
    var stdRows = (m.standardTimings || []).map(function (s, i) {
      return '<tr>' +
        '<td class="dim">' + (i + 1) + '</td>' +
        '<td>' + num('standardTimings.' + i + '.width', s.width, { min: 248, max: 2288, step: 8 }) + '</td>' +
        '<td>' + num('standardTimings.' + i + '.height', s.height, { min: 100, max: 2288 }) + '</td>' +
        '<td>' + num('standardTimings.' + i + '.refreshRate', s.refreshRate, { min: 60, max: 123 }) + '</td>' +
        '<td>' + select('standardTimings.' + i + '.aspectRatio', s.aspectRatio,
          [['auto', '自动']].concat(C.ASPECTS.map(function (a) { return [a.label, a.label]; }))) + '</td>' +
        '<td><button class="sm ghost" data-act="std-del" data-i="' + i + '" title="删除">✕</button></td>' +
        '</tr>';
    }).join('');
    html += R.card('标准时序（最多 8 组）',
      '<div class="table-scroll"><table><thead><tr><th>#</th><th>宽 (px)</th><th>高 (px)</th><th>刷新 (Hz)</th><th>宽高比</th><th></th></tr></thead>' +
      '<tbody>' + (stdRows || '<tr><td colspan="6"><div class="empty">未添加</div></td></tr>') + '</tbody></table></div>' +
      '<div class="hint">宽度会被编码为 (像素/8 − 31)，因此必须是 8 的倍数且落在 248–2288 之间；未使用的槽位写入 01 01。</div>',
      R.chip((m.standardTimings || []).length + ' / 8', 'accent') +
      '<button class="sm" data-act="std-add"' + ((m.standardTimings || []).length >= 8 ? ' disabled' : '') + '>+ 添加</button>');

    /* ---- descriptors ---- */
    var descHtml = '<div class="stack">' + m.descriptors.map(function (d, i) {
      return '<div class="acc" style="border:1px solid var(--border);border-radius:8px">' +
        '<div class="flex" style="padding:10px 12px;gap:10px">' +
        '<b class="nowrap">描述符 ' + (i + 1) + '</b>' +
        (i === 0 && d.type === 'detailed' ? R.chip('首选时序', 'accent') : '') +
        '<span class="right"></span>' +
        '<select data-act="desc-type" data-i="' + i + '" style="width:auto">' +
        opt('detailed', '详细时序（DTD）', d.type) +
        opt('product_name', '显示器名称 (0xFC)', d.type) +
        opt('serial_number', '序列号文本 (0xFF)', d.type) +
        opt('ascii_string', '自由文本 (0xFE)', d.type) +
        opt('range_limits', '范围限制 (0xFD)', d.type) +
        opt('unused', '空描述符 (0x10)', d.type) +
        '</select></div>' +
        '<div class="inner" style="border-top:1px solid var(--border)">' + descBodyHtml(d, i) + '</div></div>';
    }).join('') + '</div>';
    html += R.card('描述符槽位（4 × 18 字节）', descHtml,
      '<button class="sm" data-act="desc-from-cvt">用 CVT 生成首选时序</button>');

    /* ---- extensions ---- */
    html += R.card('扩展块', extListHtml(m),
      R.chip(m.extensions.length + ' 个', m.extensions.length ? 'accent' : '') +
      '<button class="sm" data-act="ext-add" data-kind="CEA">+ CEA-861</button>' +
      '<button class="sm" data-act="ext-add" data-kind="DISPLAYID">+ DisplayID</button>' +
      '<button class="sm" data-act="ext-add" data-kind="VTB">+ VTB</button>' +
      '<button class="sm" data-act="ext-add" data-kind="BLOCK_MAP">+ 块映射</button>');

    return html;
  }

  function descBodyHtml(d, i) {
    var p = 'descriptors.' + i + '.data.';
    if (d.type === 'detailed') {
      var data = d.data || E.defaultDTD(1920, 1080, 60);
      return '<div class="field-row">' +
        f('像素时钟 (kHz)', num(p + 'pixelClock', data.pixelClock, { min: 0, max: 655350, step: 10 })) +
        f('行有效', num(p + 'hActive', data.hActive, { min: 0, max: 4095 })) +
        f('行消隐', num(p + 'hBlanking', data.hBlanking, { min: 0, max: 4095 })) +
        '</div><div class="field-row">' +
        f('场有效', num(p + 'vActive', data.vActive, { min: 0, max: 4095 })) +
        f('场消隐', num(p + 'vBlanking', data.vBlanking, { min: 0, max: 4095 })) +
        '</div><div class="field-row">' +
        f('行同步偏移', num(p + 'hSyncOffset', data.hSyncOffset, { min: 0, max: 1023 })) +
        f('行同步宽度', num(p + 'hSyncWidth', data.hSyncWidth, { min: 0, max: 1023 })) +
        f('场同步偏移', num(p + 'vSyncOffset', data.vSyncOffset, { min: 0, max: 63 })) +
        f('场同步宽度', num(p + 'vSyncWidth', data.vSyncWidth, { min: 0, max: 63 })) +
        '</div><div class="field-row">' +
        f('图像宽 (mm)', num(p + 'hSize', data.hSize, { min: 0, max: 4095 })) +
        f('图像高 (mm)', num(p + 'vSize', data.vSize, { min: 0, max: 4095 })) +
        '</div>' +
        check(p + 'interlaced', data.interlaced, '隔行扫描（场值按单场填写）') +
        check(p + 'hSyncPositive', data.hSyncPositive, '行同步正极性') +
        check(p + 'vSyncPositive', data.vSyncPositive, '场同步正极性') +
        '<div class="hint">刷新率 = 像素时钟 ÷ (行总数 × 场总数) = ' +
        ((data.pixelClock > 0 && (data.hActive + data.hBlanking) > 0 && (data.vActive + data.vBlanking) > 0)
          ? (data.pixelClock * 1000 / ((data.hActive + data.hBlanking) * (data.vActive + data.vBlanking))).toFixed(2) + ' Hz'
          : '—') + '</div>';
    }
    if (d.type === 'range_limits') {
      var rd = d.data || {};
      var formSel = [['default-gtf', '默认 GTF（0x00）'], ['range-only', '仅范围限制（0x01）'],
        ['gtf2', '次级 GTF（0x02）'], ['cvt', 'CVT（0x04）']];
      var inner = '<div class="field-row">' +
        f('最小场频', num(p + 'minVRate', rd.minVRate == null ? 50 : rd.minVRate, { min: 1, max: 255 })) +
        f('最大场频', num(p + 'maxVRate', rd.maxVRate == null ? 75 : rd.maxVRate, { min: 1, max: 255 })) +
        f('最小行频', num(p + 'minHRate', rd.minHRate == null ? 30 : rd.minHRate, { min: 1, max: 255 })) +
        f('最大行频', num(p + 'maxHRate', rd.maxHRate == null ? 83 : rd.maxHRate, { min: 1, max: 255 })) +
        f('最大像素时钟 (MHz)', num(p + 'maxPixelClock', rd.maxPixelClock == null ? 170 : rd.maxPixelClock, { min: 10, max: 2550, step: 10 })) +
        '</div>' +
        f('时序支持', select(p + 'timingFormula', _formulaName(rd.timingFormula), formSel),
          '0x00 / 0x01 时后 7 字节必须是 LF + 6 个空格');
      if (_formulaName(rd.timingFormula) === 'cvt') {
        inner += '<div class="field-row">' +
          f('CVT 最大有效像素', num(p + 'cvtMaxActivePixels', rd.cvtMaxActivePixels || 0, { min: 0, max: 2040, step: 8 }), '0 = 不限制') +
          f('CVT 首选宽高比', select(p + 'cvtPreferredAspect', rd.cvtPreferredAspect || '16:9',
            [['4:3', '4:3'], ['16:9', '16:9'], ['16:10', '16:10'], ['5:4', '5:4'], ['15:9', '15:9']])) +
          '</div>';
      }
      return inner;
    }
    if (d.type === 'unused') return '<div class="small dim">该槽位写入 00 00 00 10 00 … 全 0 的空描述符。</div>';
    return f('文本内容（最多 12 字符，超出会被截断）', text('descriptors.' + i + '.text', d.text, 'MY DISPLAY', 40));
  }

  function _formulaName(v) {
    if (typeof v === 'string') return v;
    if (v === 0x00) return 'default-gtf';
    if (v === 0x01) return 'range-only';
    if (v === 0x02) return 'gtf2';
    if (v === 0x04) return 'cvt';
    return 'cvt';
  }

  function fmtList(arr) { return (arr || []).join(', '); }

  function extListHtml(m) {
    if (!m.extensions.length) {
      return '<div class="empty">未添加扩展块。基础块单独就能工作，但 HDMI / DisplayPort 显示器通常需要 CEA-861 扩展块来声明分辨率与音频能力。</div>';
    }
    return '<div class="stack">' + m.extensions.map(function (ext, i) {
      var title = ext.type === 'CEA' ? 'CEA-861 扩展块' : ext.type === 'DISPLAYID' ? 'DisplayID 扩展块'
        : ext.type === 'VTB' ? 'VTB 时序块' : '块映射表';
      var inner = '';
      if (ext.type === 'CEA') {
        var vids = (ext.dataBlocks || []).filter(function (b) { return b.type === 'video'; })[0];
        var auds = (ext.dataBlocks || []).filter(function (b) { return b.type === 'audio'; });
        var spk = (ext.dataBlocks || []).filter(function (b) { return b.type === 'speaker'; })[0];
        var vsdb = (ext.dataBlocks || []).filter(function (b) { return b.type === 'hdmi-vsdb'; })[0];
        var hdr = (ext.dataBlocks || []).filter(function (b) { return b.type === 'hdr-static'; })[0];
        var col = (ext.dataBlocks || []).filter(function (b) { return b.type === 'colorimetry'; })[0];
        var codes = vids ? vids.codes.map(function (c) { return c.code + (c.native ? 'n' : ''); }).join(', ') : '';
        var spkBits = spk ? spk.speakers : [];
        inner =
          '<div class="field-row">' + f('修订号', num('extensions.' + i + '.revision', ext.revision, { min: 1, max: 3 })) + '</div>' +
          '<fieldset><legend>CEA 标志</legend><div class="grid cols-2" style="gap:2px 14px">' +
          check('extensions.' + i + '.features.basicAudio', ext.features.basicAudio, '支持基本音频') +
          check('extensions.' + i + '.features.ycbcr444', ext.features.ycbcr444, '支持 YCbCr 4:4:4') +
          check('extensions.' + i + '.features.ycbcr422', ext.features.ycbcr422, '支持 YCbCr 4:2:2') +
          check('extensions.' + i + '.features.underscan', ext.features.underscan, '支持欠扫描') +
          '</div></fieldset>' +
          f('视频格式（VIC）', '<textarea rows="2" data-act="videos" data-i="' + i + '" spellcheck="false">' + esc(codes) + '</textarea>',
            '用逗号分隔；结尾加 <code>n</code> 表示原生格式，例如 <code>97n, 96, 63, 16, 4</code>') +
          '<fieldset><legend>音频描述符</legend><div id="audio-' + i + '">' + audioRowsHtml(i, auds) + '</div>' +
          '<button class="sm" data-act="audio-add" data-i="' + i + '">+ 添加音频格式</button></fieldset>' +
          '<fieldset><legend>扬声器布局</legend><div class="grid cols-2" style="gap:2px 14px">' +
          C.SPEAKER_ALLOCATION.slice(0, 8).map(function (s) {
            return check('spk:' + i + ':' + s[0], spkBits.indexOf(s[0]) >= 0, s[1]);
          }).join('') + '</div></fieldset>' +
          check('vsdb:' + i, !!vsdb, '包含 HDMI 1.4 厂商数据块（VSDB）');
        if (vsdb) {
          inner += '<div class="field-row">' +
            f('物理地址', text('extensions.' + i + '.vsdbPhysical', _pa(vsdb.data), '1.0.0.0'), '格式 a.b.c.d，0.0.0.0 表示未连接') +
            f('最大 TMDS 时钟 (MHz，5 的倍数)', num('extensions.' + i + '.vsdbMaxTmds', vsdb.data.maxTmdsClockMHz, { min: 0, max: 1275, step: 5 })) +
            '</div><div class="grid cols-2" style="gap:2px 14px">' +
            check('extensions.' + i + '.vsdbDeep30', vsdb.data.deepColor30, '支持 30 位深色') +
            check('extensions.' + i + '.vsdbDeep36', vsdb.data.deepColor36, '支持 36 位深色') +
            check('extensions.' + i + '.vsdbAI', vsdb.data.supportsAI, '支持 AI（内容类型）') +
            '</div>';
        }
        inner += check('hdr:' + i, !!hdr, '包含 HDR 静态元数据块（扩展标签 0x06）');
        if (hdr) {
          inner += '<div class="grid cols-2" style="gap:2px 14px">' +
            check('extensions.' + i + '.hdrEotfSDR', hdr.data.traditionalSDR, '传统 SDR 伽马') +
            check('extensions.' + i + '.hdrEotfPQ', hdr.data.hdrPQ, 'SMPTE ST 2084 (HDR10)') +
            check('extensions.' + i + '.hdrEotfHLG', hdr.data.hlg, 'HLG') +
            check('extensions.' + i + '.hdrStatic', hdr.data.staticMetadata, '静态元数据 Type 1') +
            '</div>';
        }
        inner += check('cm:' + i, !!col, '包含色度数据块（Colorimetry，0x05）');
      } else if (ext.type === 'DISPLAYID') {
        inner = '<div class="field-row">' +
          f('版本', select('extensions.' + i + '.version', ext.version,
            [[0x12, '1.2 (0x12)'], [0x13, '1.3 (0x13)'], [0x20, '2.0 (0x20)']])) +
          f('产品类型', num('extensions.' + i + '.productType', ext.productType, { min: 0, max: 255 })) +
          '</div>' +
          f('分节（每行：标签, 版本, 十六进制字节）', '<textarea rows="3" data-act="sections" data-i="' + i + '" spellcheck="false">' +
            esc(displayIdSectionsText(ext)) + '</textarea>', '例如 <code>0x00, 1, 4142430A</code>');
      } else if (ext.type === 'VTB') {
        inner = '<div class="field-row">' + f('版本', num('extensions.' + i + '.version', ext.version, { min: 1, max: 255 })) + '</div>' +
          '<div class="small dim">描述符数量：' + (ext.descriptors || []).length +
          '（可用下面的按钮把首选时序复制进来）</div>' +
          '<button class="sm" data-act="vtb-copy" data-i="' + i + '" style="margin-top:8px">从描述符 1 复制 DTD</button>';
      } else {
        inner = f('声明的总块数（0 = 自动）', num('extensions.' + i + '.numberOfBlocks', ext.numberOfBlocks || 0, { min: 0, max: 255 }),
          '实际写入时会按扩展块数量自动补全') +
          f('块标签（十进制或 0x 前缀，逗号分隔）',
            text('extensions.' + i + '.tagsText', (ext.tags || []).map(function (t) { return '0x' + C.hex(t, 2); }).join(', '), '0x02, 0x70'));
      }
      return '<div class="acc" style="border:1px solid var(--border);border-radius:8px">' +
        '<div class="flex" style="padding:10px 12px">' +
        '<b>' + esc(title) + '</b>' + R.chip('块 ' + (i + 1), 'accent') +
        '<span class="right"></span>' +
        '<button class="sm ghost" data-act="ext-del" data-i="' + i + '">删除</button></div>' +
        '<div class="inner" style="border-top:1px solid var(--border)">' + inner + '</div></div>';
    }).join('') + '</div>';
  }

  function _pa(data) {
    return [data.a | 0, data.b | 0, data.c | 0, data.d | 0].join('.');
  }

  function audioRowsHtml(extIndex, auds) {
    if (!auds || !auds.length) return '<div class="small dim">未添加音频格式。</div>';
    var out = [];
    auds.forEach(function (a, ai) {
      (a.items || []).forEach(function (item, ii) {
        out.push('<div class="field-row" style="grid-template-columns:1fr .8fr 1.4fr 1.2fr 34px;margin-bottom:6px">' +
          '<select data-path="extensions.' + extIndex + '.audio.' + ai + '.' + ii + '.format">' +
          C.CEA_AUDIO_FORMATS.map(function (n, fi) {
            return fi ? opt(fi, n, item.format) : '';
          }).join('') + '</select>' +
          '<input type="number" min="1" max="8" data-type="number" data-path="extensions.' + extIndex + '.audio.' + ai + '.' + ii + '.channels" value="' + item.channels + '">' +
          '<input type="text" data-path="extensions.' + extIndex + '.audio.' + ai + '.' + ii + '.rates" value="' + esc((item.sampleRates || []).join(',')) + '" placeholder="192,96,48">' +
          '<input type="text" data-path="extensions.' + extIndex + '.audio.' + ai + '.' + ii + '.depths" value="' + esc((item.bitDepths || []).join(',')) + '" placeholder="24,16">' +
          '<button class="sm ghost" data-act="audio-del" data-i="' + extIndex + '" data-a="' + ai + '" data-x="' + ii + '">✕</button>' +
          '</div>');
      });
    });
    return out.join('');
  }

  function displayIdSectionsText(ext) {
    return (ext.sections || []).map(function (s) {
      return '0x' + C.hex(s.tag, 2) + ', ' + (s.revision || 0) + ', ' + (s.bytes ? C.bytesToHex(s.bytes).replace(/ /g, '') : '');
    }).join('\n');
  }

  /* Encoder: rebuild model from decoded EDID then re-render. */
  function encRender() {
    var m = state.enc.model;
    var encoded = E.encode(m);
    state.enc.bytes = encoded.bytes;

    $('#enc-blocks').textContent = encoded.bytes.length / 128 + ' 块';
    $('#enc-bytes').textContent = encoded.bytes.length + ' 字节';
    $('#enc-hexwrap').innerHTML = R.hexViewer(encoded.bytes, { perPage: 256, page: state.enc.page });
    $('#enc-warn-count').innerHTML = encoded.warnings.length
      ? R.chip(encoded.warnings.length + ' 条生成提示', 'warn') : '';

    $('#enc-warnings').innerHTML = encoded.warnings.map(function (w) {
      return '<div class="msg warning"><span class="dot"></span><div class="txt">' + esc(w) + '</div></div>';
    }).join('');

    var v = V.validate(encoded.bytes);
    $('#enc-preview-verdict').className = 'chip ' + (v.isValid ? (v.warnings.length ? 'warn' : 'ok') : 'err');
    $('#enc-preview-verdict').textContent = v.isValid
      ? (v.warnings.length ? v.warnings.length + ' 警告' : '校验通过') : v.errors.length + ' 错误';
    var dec = D.decode(encoded.bytes);
    $('#enc-preview').innerHTML = dec.ok
      ? R.decodeReport(dec)
      : '<div class="msg error"><span class="dot"></span><div class="txt">' + esc(dec.error) + '</div></div>';
    if (state.needsFormRender) {
      state.needsFormRender = false;
      $('#enc-form').innerHTML = encFormHtml(m);
    }
  }

  function encReencodeOnly() {
    var encoded = E.encode(state.enc.model);
    state.enc.bytes = encoded.bytes;
    $('#enc-blocks').textContent = encoded.bytes.length / 128 + ' 块';
    $('#enc-bytes').textContent = encoded.bytes.length + ' 字节';
    $('#enc-hexwrap').innerHTML = R.hexViewer(encoded.bytes, { perPage: 256, page: state.enc.page });
    $('#enc-warn-count').innerHTML = encoded.warnings.length
      ? R.chip(encoded.warnings.length + ' 条生成提示', 'warn') : '';
    $('#enc-warnings').innerHTML = encoded.warnings.map(function (w) {
      return '<div class="msg warning"><span class="dot"></span><div class="txt">' + esc(w) + '</div></div>';
    }).join('');
    var v = V.validate(encoded.bytes);
    $('#enc-preview-verdict').className = 'chip ' + (v.isValid ? (v.warnings.length ? 'warn' : 'ok') : 'err');
    $('#enc-preview-verdict').textContent = v.isValid
      ? (v.warnings.length ? v.warnings.length + ' 警告' : '校验通过') : v.errors.length + ' 错误';
    var dec = D.decode(encoded.bytes);
    $('#enc-preview').innerHTML = dec.ok ? R.decodeReport(dec)
      : '<div class="msg error"><span class="dot"></span><div class="txt">' + esc(dec.error) + '</div></div>';
  }

  function encReflow() { state.needsFormRender = true; state.enc.page = 0; encRender(); save(); }
  function encTouch() { encReencodeOnly(); save(); }

  /* Field changes inside the encoder form. */
  function encFieldChange(t) {
    var path = t.getAttribute('data-path');
    var type = t.getAttribute('data-type');

    /* Established timings live in an array keyed by label. */
    if (path && path.indexOf('est:') === 0) {
      var label = path.substring(4);
      var key = C.establishedKey(label);
      var list = state.enc.model.establishedTimings.filter(function (l) { return C.establishedKey(l) !== key; });
      if (t.checked) list.push(label);
      state.enc.model.establishedTimings = list;
      var chipEl = $('#enc-form [data-est-chip]');
      if (chipEl) chipEl.textContent = list.length + ' 项';
      encTouch();
      return;
    }
    /* Speaker bits for a CEA extension. */
    if (path && path.indexOf('spk:') === 0) {
      var sp = path.split(':');
      var ext = state.enc.model.extensions[parseInt(sp[1], 10)];
      var db = ext.dataBlocks.filter(function (b) { return b.type === 'speaker'; })[0];
      if (!db) { db = { type: 'speaker', speakers: [] }; ext.dataBlocks.push(db); }
      var bit = parseInt(sp[2], 10);
      var idx = db.speakers.indexOf(bit);
      if (t.checked && idx < 0) db.speakers.push(bit);
      if (!t.checked && idx >= 0) db.speakers.splice(idx, 1);
      db.speakers.sort(function (a, b) { return a - b; });
      encTouch();
      return;
    }
    /* Toggle pseudo-paths (vsdb:0, hdr:0, cm:0) */
    if (path && path.indexOf('vsdb:') === 0) {
      var ei = parseInt(path.split(':')[1], 10);
      var ex = state.enc.model.extensions[ei];
      var has = ex.dataBlocks.filter(function (b) { return b.type === 'hdmi-vsdb'; })[0];
      if (t.checked && !has) ex.dataBlocks.push({ type: 'hdmi-vsdb', data: { a: 1, b: 0, c: 0, d: 0, maxTmdsClockMHz: 300 } });
      if (!t.checked && has) ex.dataBlocks = ex.dataBlocks.filter(function (b) { return b.type !== 'hdmi-vsdb'; });
      encReflow();
      return;
    }
    if (path && path.indexOf('hdr:') === 0) {
      var hi = parseInt(path.split(':')[1], 10);
      var hx = state.enc.model.extensions[hi];
      var hHas = hx.dataBlocks.filter(function (b) { return b.type === 'hdr-static'; })[0];
      if (t.checked && !hHas) hx.dataBlocks.push({ type: 'hdr-static', data: { traditionalSDR: true, hdrPQ: true, hlg: true, staticMetadata: true } });
      if (!t.checked && hHas) hx.dataBlocks = hx.dataBlocks.filter(function (b) { return b.type !== 'hdr-static'; });
      encReflow();
      return;
    }
    if (path && path.indexOf('cm:') === 0) {
      var cix = parseInt(path.split(':')[1], 10);
      var cx = state.enc.model.extensions[cix];
      var cHas = cx.dataBlocks.filter(function (b) { return b.type === 'colorimetry'; })[0];
      if (t.checked && !cHas) cx.dataBlocks.push({ type: 'colorimetry', data: { bt2020RGB: true, dciP3: true } });
      if (!t.checked && cHas) cx.dataBlocks = cx.dataBlocks.filter(function (b) { return b.type !== 'colorimetry'; });
      encReflow();
      return;
    }

    if (!path) return;
    var value;
    if (type === 'bool') value = t.checked;
    else if (type === 'number') {
      value = t.value === '' ? 0 : Number(t.value);
      if (!isFinite(value)) value = 0;
    } else value = t.value;

    setPath(state.enc.model, path, value);

    /* Changing the input type or the descriptor type reshapes the form. */
    if (path === 'isDigital') { encReflow(); return; }
    if (/^extensions\.\d+\.vsdbPhysical$/.test(path)) { encTouch(); return; }
    encTouch();
  }

  /* Non-input actions inside the encoder form. */
  function encAction(btn) {
    var act = btn.getAttribute('data-act');
    var m = state.enc.model;
    var i = parseInt(btn.getAttribute('data-i'), 10);

    if (act === 'est-none') { m.establishedTimings = []; encReflow(); return; }
    if (act === 'std-add') {
      if (m.standardTimings.length >= 8) return;
      m.standardTimings.push({ width: 1280, height: 720, refreshRate: 60, aspectRatio: 'auto' });
      encReflow(); return;
    }
    if (act === 'std-del') { m.standardTimings.splice(i, 1); encReflow(); return; }
    if (act === 'color-srgb') {
      m.colorCharacteristics = C.sRGBChromaticity();
      encReflow(); return;
    }
    if (act === 'color-d65') {
      m.colorCharacteristics.white = { x: 0.3127, y: 0.329 };
      encReflow(); return;
    }
    if (act === 'desc-from-cvt') {
      var pref = m.descriptors[0];
      var w = (pref && pref.type === 'detailed') ? pref.data.hActive : 1920;
      var h = (pref && pref.type === 'detailed') ? pref.data.vActive : 1080;
      var r = (pref && pref.type === 'detailed')
        ? Math.round(pref.data.pixelClock * 1000 / ((pref.data.hActive + pref.data.hBlanking) * (pref.data.vActive + pref.data.vBlanking))) || 60
        : 60;
      m.descriptors[0] = { type: 'detailed', data: E.defaultDTD(w, h, clamp(r, 24, 240), 1) };
      encReflow(); return;
    }
    if (act === 'ext-add') {
      var kind = btn.getAttribute('data-kind');
      if (kind === 'CEA') m.extensions.push(E.ceaHdExtension());
      else if (kind === 'DISPLAYID') m.extensions.push({ type: 'DISPLAYID', version: 0x12, productType: 2, sections: [{ tag: 0x00, revision: 1, bytes: [0x41, 0x42, 0x43, 0x0A] }] });
      else if (kind === 'VTB') m.extensions.push({ type: 'VTB', version: 1, descriptors: [] });
      else m.extensions.push({ type: 'BLOCK_MAP', numberOfBlocks: 0, tags: [] });
      encReflow(); return;
    }
    if (act === 'ext-del') { m.extensions.splice(i, 1); encReflow(); return; }
    if (act === 'vtb-copy') {
      var ext = m.extensions[i];
      var src = m.descriptors[0];
      if (src && src.type === 'detailed') {
        ext.descriptors = (ext.descriptors || []).concat([JSON.parse(JSON.stringify(src.data))]);
        toast('已复制', '描述符 1 的 DTD 已加入 VTB', 'ok');
      } else toast('无法复制', '描述符 1 不是详细时序', 'err');
      encReflow(); return;
    }
    if (act === 'audio-add') {
      var ea = m.extensions[i];
      var adb = ea.dataBlocks.filter(function (b) { return b.type === 'audio'; })[0];
      if (!adb) { adb = { type: 'audio', items: [] }; ea.dataBlocks.push(adb); }
      if (adb.items.length >= 10) { toast('已达到上限', '音频数据块最多 10 个描述符', 'warn'); return; }
      adb.items.push({ format: 1, channels: 2, sampleRates: [48], bitDepths: [16] });
      encReflow(); return;
    }
    if (act === 'audio-del') {
      var exd = m.extensions[i];
      var ai = parseInt(btn.getAttribute('data-a'), 10);
      var xi = parseInt(btn.getAttribute('data-x'), 10);
      var ablk = exd.dataBlocks.filter(function (b) { return b.type === 'audio'; })[ai];
      if (ablk) ablk.items.splice(xi, 1);
      encReflow(); return;
    }
  }

  /* Textareas that need parsing (VIC list, DisplayID sections). */
  function encTextarea(t) {
    var act = t.getAttribute('data-act');
    var i = parseInt(t.getAttribute('data-i'), 10);
    var m = state.enc.model;
    if (act === 'videos') {
      var ext = m.extensions[i];
      var codes = t.value.split(/[\s,;]+/).filter(Boolean).map(function (tok) {
        var native = /n$/i.test(tok);
        var n = parseInt(tok.replace(/[^0-9]/g, ''), 10);
        return isNaN(n) ? null : { code: clamp(n, 0, 127), native: native };
      }).filter(Boolean);
      var db = ext.dataBlocks.filter(function (b) { return b.type === 'video'; })[0];
      if (db) db.codes = codes;
      else if (codes.length) ext.dataBlocks.unshift({ type: 'video', codes: codes });
      encTouch(); return;
    }
    if (act === 'sections') {
      var de = m.extensions[i];
      de.sections = t.value.split('\n').map(function (line) {
        var parts = line.split(',');
        if (parts.length < 3) return null;
        var tag = parseInt(parts[0].replace(/[^0-9a-fA-Fx]/g, '').replace(/^0x/i, ''), 16);
        var rev = parseInt(parts[1].trim(), 10) || 0;
        var bytes = bytesFromText(parts.slice(2).join(','));
        return isNaN(tag) ? null : { tag: tag, revision: rev, bytes: bytes ? Array.prototype.slice.call(bytes) : [] };
      }).filter(Boolean);
      encTouch(); return;
    }
  }

  /* ================================================================ timing */
  function tmRender() {
    var s = state.tm;
    var tmOpt = {
      width: s.width, height: s.height, refreshRate: s.refresh,
      interlaced: s.interlaced, margins: s.margins
    };
    if (s.aspect !== 'auto' && s.aspect !== '21:9') {
      var parts = s.aspect.split(':');
      tmOpt.aspectRatio = parseInt(parts[0], 10) / parseInt(parts[1], 10);
    }
    var t;
    try {
      if (s.standard === 'gtf') t = T.computeGTF(tmOpt);
      else { tmOpt.rbVersion = s.rb; t = T.computeCVT(tmOpt); }
    } catch (e) {
      $('#tm-out').innerHTML = R.card('计算失败', '<div class="msg error"><span class="dot"></span><div class="txt">' +
        esc(e.message) + '</div></div>');
      return;
    }
    var ctx = {
      label: s.standard === 'gtf' ? 'GTF 结果' : 'CVT 结果',
      standardName: s.standard === 'gtf' ? 'VESA GTF' : 'VESA CVT',
      raName: ''
    };
    $('#tm-out').innerHTML = R.timingReport(t, ctx);
    $('#tm-mode-chip').textContent = t.modeName || (s.standard === 'gtf' ? 'GTF' : 'CVT');
    state.tm.last = t;
    save();
  }

  function tmExtraHtml() {
    if (state.tm.standard === 'gtf') {
      return '<fieldset><legend>GTF 选项</legend>' +
        '<label class="check"><input type="checkbox" id="tm-il"' + (state.tm.interlaced ? ' checked' : '') + '><span>隔行扫描</span></label>' +
        '<label class="check"><input type="checkbox" id="tm-mg"' + (state.tm.margins ? ' checked' : '') + '><span>包含边框 (margins)</span></label>' +
        '</fieldset>';
    }
    return '<div class="small dim" style="margin-top:-4px">缩减消隐（RB / RBv2 / RBv3）可显著降低像素时钟，是高刷新率与高分屏的常用选择。</div>';
  }

  function tmSyncFields() {
    $('#tm-w').value = state.tm.width;
    $('#tm-h').value = state.tm.height;
    $('#tm-r').value = state.tm.refresh;
    $('#tm-ar').value = state.tm.aspect;
    $('#tm-standard').value = state.tm.standard;
    $('#tm-rb').value = String(state.tm.rb);
    $('#tm-rb-field').style.display = state.tm.standard === 'gtf' ? 'none' : '';
    $('#tm-extra').innerHTML = tmExtraHtml();
    var il = $('#tm-il'), mg = $('#tm-mg');
    if (il) il.addEventListener('change', function () { state.tm.interlaced = il.checked; tmRender(); });
    if (mg) mg.addEventListener('change', function () { state.tm.margins = mg.checked; tmRender(); });
  }

  /* ================================================================== init */
  function switchTab(name) {
    state.tab = name;
    $$('nav.tabs button').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === name));
    });
    $$('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + name); });
    save();
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    $('#theme-icon').innerHTML = '<use href="#' + (theme === 'dark' ? 'i-sun' : 'i-moon') + '"/>';
    save();
  }

  /* A draft coming back from localStorage may predate a field, or may have been
     hand-edited.  Fill in anything missing before the form reads it, so a stale
     draft can never produce an "undefined" input. */
  function normalizeModel(m) {
    var base = E.defaultModel();
    if (!m || typeof m !== 'object') return base;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(m).forEach(function (k) { if (m[k] !== undefined) out[k] = m[k]; });

    out.dpms = Object.assign({}, base.dpms, out.dpms || {});
    out.features = Object.assign({}, base.features, out.features || {});
    out.syncSupport = Object.assign({}, base.syncSupport, out.syncSupport || {});
    out.colorCharacteristics = Object.assign({}, base.colorCharacteristics, out.colorCharacteristics || {});
    ['red', 'green', 'blue', 'white'].forEach(function (k) {
      out.colorCharacteristics[k] = Object.assign({}, base.colorCharacteristics[k], out.colorCharacteristics[k] || {});
    });

    if (!Array.isArray(out.establishedTimings)) out.establishedTimings = [];
    if (!Array.isArray(out.standardTimings)) out.standardTimings = [];
    if (!Array.isArray(out.extensions)) out.extensions = [];

    var dtdDefaults = E.defaultDTD(1920, 1080, 60);
    var rangeDefaults = {
      minVRate: 50, maxVRate: 75, minHRate: 30, maxHRate: 83,
      maxPixelClock: 170, timingFormula: 'cvt', cvtMaxActivePixels: 1920, cvtPreferredAspect: '16:9'
    };
    var descs = Array.isArray(out.descriptors) ? out.descriptors.slice(0, 4) : [];
    out.descriptors = descs.map(function (d) {
      if (!d || typeof d !== 'object') return { type: 'unused' };
      if (d.type === 'detailed') return { type: 'detailed', data: Object.assign({}, dtdDefaults, d.data || {}) };
      if (d.type === 'range_limits') return { type: 'range_limits', data: Object.assign({}, rangeDefaults, d.data || {}) };
      if (d.type === 'unused') return { type: 'unused' };
      return { type: d.type, text: d.text == null ? '' : String(d.text) };
    });
    while (out.descriptors.length < 4) out.descriptors.push({ type: 'unused' });

    return out;
  }

  function initEncoder() {
    state.enc.model = normalizeModel(state.enc.model);
    state.needsFormRender = true;

    var holder = $('#enc-presets');
    holder.innerHTML = Object.keys(E.FORMAT_PRESETS).map(function (k) {
      return '<button class="sm" data-preset="' + k + '">' + esc(E.FORMAT_PRESETS[k].label.split('—')[0].trim()) + '</button>';
    }).join('') + '<button class="sm primary" data-preset="__default">恢复默认</button>';
    holder.addEventListener('click', function (e) {
      var b = e.target.closest('[data-preset]');
      if (!b) return;
      var k = b.getAttribute('data-preset');
      var m = E.defaultModel();
      if (k !== '__default') E.FORMAT_PRESETS[k].apply(m);
      state.enc.model = m;
      encReflow();
      toast('已套用预设', k === '__default' ? '默认 1080p HDMI 模型' : E.FORMAT_PRESETS[k].label, 'ok');
    });

    var form = $('#enc-form');
    form.addEventListener('input', function (e) {
      if (e.target.matches('textarea[data-act]')) { encTextarea(e.target); return; }
      if (e.target.matches('[data-path]')) encFieldChange(e.target);
    });
    form.addEventListener('change', function (e) {
      if (e.target.matches('select[data-act="desc-type"]')) {
        var i = parseInt(e.target.getAttribute('data-i'), 10);
        var type = e.target.value;
        var old = state.enc.model.descriptors[i] || {};
        var fresh = { type: type };
        if (type === 'detailed') fresh.data = (old.type === 'detailed' && old.data) ? old.data : E.defaultDTD(1920, 1080, 60);
        else if (type === 'range_limits') fresh.data = (old.type === 'range_limits' && old.data) ? old.data
          : { minVRate: 50, maxVRate: 75, minHRate: 30, maxHRate: 83, maxPixelClock: 170, timingFormula: 'cvt', cvtMaxActivePixels: 1920, cvtPreferredAspect: '16:9' };
        else if (type === 'unused') { /* nothing */ }
        else fresh.text = (old.text || (type === 'product_name' ? 'MY DISPLAY' : 'TEXT'));
        state.enc.model.descriptors[i] = fresh;
        encReflow();
        return;
      }
      if (e.target.matches('[data-path]')) encFieldChange(e.target);
    });
    form.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (b) encAction(b);
    });

    $('#enc-validate').addEventListener('click', function () {
      var r = V.validate(state.enc.bytes);
      openModal('生成结果校验', R.validationReport(r));
    });
    $('#enc-copy').addEventListener('click', function () {
      copyText(C.bytesToHex(state.enc.bytes));
    });
    $('#enc-dl-bin').addEventListener('click', function () {
      download('edid-' + state.enc.model.manufacturer + '-' + state.enc.model.productCode + '.bin', state.enc.bytes, 'application/octet-stream');
    });
    $('#enc-dl-hex').addEventListener('click', function () {
      download('edid-' + state.enc.model.manufacturer + '-' + state.enc.model.productCode + '.hex',
        C.bytesToHex(state.enc.bytes) + '\n', 'text/plain;charset=utf-8');
    });
    $('#enc-print').addEventListener('click', function () { printPanel('encoder'); });

    /* First paint: build the form, the hex preview and the validation verdict. */
    encRender();
  }

  function initDecoder() {
    $('#dec-run').addEventListener('click', function () { decRun(); });
    $('#dec-clear').addEventListener('click', function () {
      $('#dec-hex').value = ''; state.dec.hex = '';
      $('#dec-out').innerHTML = '<div class="card"><div class="body"><div class="empty">还没有数据。</div></div></div>';
      updateSizeChip('', $('#dec-size'));
      save();
    });
    $('#dec-open').addEventListener('click', function () { $('#dec-file').click(); });
    $('#dec-sample').addEventListener('click', function () {
      showSamples(function (hex, name) { decSetBytes(bytesFromText(hex), name); });
    });
    $('#dec-file').addEventListener('change', function (e) {
      if (e.target.files[0]) readFile(e.target.files[0], function (bytes, f) { decSetBytes(bytes, f.name); });
      e.target.value = '';
    });
    dropZone($('#dec-drop'), function (bytes, f) { decSetBytes(bytes, f.name); });
    $('#dec-hex').addEventListener('input', function () {
      state.dec.hex = $('#dec-hex').value;
      updateSizeChip(state.dec.hex, $('#dec-size'));
      save();
    });
    $('#dec-to-enc').addEventListener('click', function () {
      var bytes = bytesFromText($('#dec-hex').value);
      if (!bytes) { toast('没有数据', '先解析或粘贴一份 EDID', 'err'); return; }
      var dec = D.decode(bytes);
      if (!dec.ok) { toast('解析失败', dec.error, 'err'); return; }
      var mapped = modelFromDecoded(dec);
      state.enc.model = mapped.model;
      encReflow();
      switchTab('encoder');
      toast('已导入生成器', '基础块字段已映射' + (mapped.skipped.length ? '；未映射的扩展块：' + mapped.skipped.join('、') : ''),
        mapped.skipped.length ? 'warn' : 'ok');
    });
  }

  function initValidator() {
    $('#val-run').addEventListener('click', valRun);
    $('#val-clear').addEventListener('click', function () {
      $('#val-hex').value = ''; state.val.hex = '';
      $('#val-out').innerHTML = '<div class="card"><div class="body"><div class="empty">粘贴数据后点击“开始校验”。</div></div></div>';
      updateSizeChip('', $('#val-size'));
      save();
    });
    $('#val-open').addEventListener('click', function () { $('#val-file').click(); });
    $('#val-sample').addEventListener('click', function () {
      showSamples(function (hex) {
        $('#val-hex').value = hex; state.val.hex = hex;
        updateSizeChip(hex, $('#val-size'));
        valRun();
      });
    });
    $('#val-from-dec').addEventListener('click', function () {
      var hex = $('#dec-hex').value;
      if (!hex) { toast('解析器为空', '先在“解析”页载入数据', 'err'); return; }
      $('#val-hex').value = hex; state.val.hex = hex;
      updateSizeChip(hex, $('#val-size'));
      valRun();
    });
    $('#val-file').addEventListener('change', function (e) {
      if (e.target.files[0]) readFile(e.target.files[0], function (bytes) {
        $('#val-hex').value = C.bytesToHex(bytes);
        state.val.hex = $('#val-hex').value;
        updateSizeChip(state.val.hex, $('#val-size'));
        valRun();
      });
      e.target.value = '';
    });
    dropZone($('#val-drop'), function (bytes) {
      $('#val-hex').value = C.bytesToHex(bytes);
      state.val.hex = $('#val-hex').value;
      updateSizeChip(state.val.hex, $('#val-size'));
      valRun();
    });
    $('#val-hex').addEventListener('input', function () {
      state.val.hex = $('#val-hex').value;
      updateSizeChip(state.val.hex, $('#val-size'));
      save();
    });
  }

  function initTiming() {
    tmSyncFields();
    $('#tm-standard').addEventListener('change', function () {
      state.tm.standard = this.value; tmSyncFields(); tmRender();
    });
    $('#tm-rb').addEventListener('change', function () { state.tm.rb = parseInt(this.value, 10); tmRender(); });
    ['tm-w', 'tm-h', 'tm-r'].forEach(function (id) {
      $('#' + id).addEventListener('input', function () {
        var v = Number(this.value);
        if (!isFinite(v)) return;
        if (id === 'tm-w') state.tm.width = clamp(Math.round(v), 64, 16384);
        if (id === 'tm-h') state.tm.height = clamp(Math.round(v), 64, 16384);
        if (id === 'tm-r') state.tm.refresh = clamp(v, 1, 480);
        tmRender();
      });
    });
    $('#tm-ar').addEventListener('change', function () { state.tm.aspect = this.value; tmRender(); });
    $('#tm-swap').addEventListener('click', function () {
      var w = state.tm.width; state.tm.width = state.tm.height; state.tm.height = w;
      tmSyncFields(); tmRender();
    });
    $('#tm-run').addEventListener('click', tmRender);
    $('#tm-presets').addEventListener('click', function () {
      var body = '<div class="stack">' + T.PRESETS.map(function (p, i) {
        return '<button class="btn" style="width:100%;text-align:left" data-tp="' + i + '">' +
          '<b>' + p.width + ' × ' + p.height + '</b><span class="right dim small">' +
          (p.refreshRate || 60) + ' Hz</span></button>';
      }).join('') + '</div>';
      openModal('常用分辨率', body);
      setModalPicker(function (el) {
        var b = el.closest('[data-tp]');
        if (!b) return false;
        var p = T.PRESETS[parseInt(b.getAttribute('data-tp'), 10)];
        if (!p) return false;
        state.tm.width = p.width; state.tm.height = p.height;
        if (p.refreshRate) state.tm.refresh = p.refreshRate;
        if (p.rbVersion != null) { state.tm.standard = 'cvt'; state.tm.rb = p.rbVersion; }
        closeModal();
        tmSyncFields(); tmRender();
        return true;
      });
    });
    tmRender();
  }

  function init() {
    var draft = load();
    if (draft) {
      state.tab = draft.tab || 'decoder';
      state.theme = draft.theme || state.theme;
      if (draft.decHex) { state.dec.hex = draft.decHex; $('#dec-hex').value = draft.decHex; updateSizeChip(draft.decHex, $('#dec-size')); }
      if (draft.valHex) { state.val.hex = draft.valHex; $('#val-hex').value = draft.valHex; updateSizeChip(draft.valHex, $('#val-size')); }
      if (draft.model && draft.model.descriptors) state.enc.model = draft.model;
      if (draft.tm) state.tm = Object.assign(state.tm, draft.tm);
      if (state.dec.hex) {
        var b = bytesFromText(state.dec.hex);
        if (b) decRender(b, '草稿');
      }
      if (state.val.hex) valRun();
    } else {
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      state.theme = prefersDark ? 'dark' : 'light';
      /* First run: show something useful straight away. */
      decSetBytes(E.encode(E.defaultModel()).bytes, '默认示例');
    }

    setTheme(state.theme);
    switchTab(state.tab);
    initDecoder();
    initEncoder();
    initValidator();
    initTiming();

    $$('nav.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
    $('#theme-toggle').addEventListener('click', function () {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', function (e) { if (e.target === $('#modal')) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (state.tab === 'decoder') decRun();
        else if (state.tab === 'validator') valRun();
        else if (state.tab === 'timing') tmRender();
      }
    });

    /* Delegated actions in rendered reports. */
    document.addEventListener('click', function (e) {
      if (modalPicker && e.target.closest && e.target.closest('#modal-body')) {
        if (modalPicker(e.target)) { modalPicker = null; return; }
      }
      var copy = e.target.closest('[data-copy]');
      if (copy) { copyText(copy.getAttribute('data-copy')); return; }
      var page = e.target.closest('[data-hexpage]');
      if (page) {
        var next = parseInt(page.getAttribute('data-hexpage'), 10);
        if (isNaN(next)) return;
        if (page.closest('#dec-out')) { state.dec.page = next; decRender(state.dec.bytes, ''); }
        else if (page.closest('#enc-hexwrap')) { state.enc.page = next; encReencodeOnly(); }
        return;
      }
      var goto = e.target.closest('[data-goto]');
      if (goto) { e.preventDefault(); switchTab(goto.getAttribute('data-goto')); return; }
      if (e.target.id === 'modal-ok') closeModal();
    });

    $('#about-reset').addEventListener('click', function () {
      try { localStorage.removeItem(LS_KEY); } catch (err) { /* ignore */ }
      toast('已清除', '本地草稿与偏好已删除，刷新后回到初始状态', 'ok');
    });
    $('#about-print').addEventListener('click', function () { printPanel('about'); });

    if (!navigator.clipboard || !window.isSecureContext) {
      /* file:// pages may not expose the async clipboard API — the fallback
         handles it, but tell the user why a permission prompt may appear. */
      void 0;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
