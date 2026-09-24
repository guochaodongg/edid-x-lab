/* ==========================================================================
   EDID Craft Local — edid-encoder.js
   Builds a complete EDID binary (base block + extension blocks) from the
   encoder form model.
   ========================================================================== */
(function (global) {
  'use strict';

  var C = global.EDIDCore;
  var T = global.EDIDTiming;

  /* ------------------------------------------------------- default timings */
  /* A sensible "standard" descriptor for a resolution, using CVT maths. */
  function defaultDTD(width, height, refresh, rbVersion) {
    var t = T.computeCVT({
      width: width, height: height, refreshRate: refresh,
      rbVersion: rbVersion == null ? 1 : rbVersion
    });
    return {
      pixelClock: t.pixelClock * 1000,     /* kHz */
      hActive: t.hActive,
      hBlanking: t.hBlank,
      vActive: t.vActive,
      vBlanking: t.vBlank,
      hSyncOffset: t.hFrontPorch,
      hSyncWidth: t.hSync,
      vSyncOffset: t.vFrontPorch,
      vSyncWidth: t.vSync,
      hSize: 0, vSize: 0,
      hBorder: 0, vBorder: 0,
      interlaced: false,
      stereo: 0,
      hSyncPositive: t.hSyncPositive,
      vSyncPositive: t.vSyncPositive,
      syncType: 3
    };
  }

  /* ------------------------------------------------------------ DTD writer */
  function writeDTD(target, off, d) {
    var pclk = Math.max(0, Math.min(0xFFFF, Math.round((d.pixelClock || 0) / 10)));
    target[off] = pclk & 0xFF;
    target[off + 1] = (pclk >> 8) & 0xFF;

    var ha = d.hActive | 0, hb = d.hBlanking | 0, va = d.vActive | 0, vb = d.vBlanking | 0;
    target[off + 2] = ha & 0xFF;
    target[off + 3] = hb & 0xFF;
    target[off + 4] = (((ha >> 8) & 0x0F) << 4) | ((hb >> 8) & 0x0F);
    target[off + 5] = va & 0xFF;
    target[off + 6] = vb & 0xFF;
    target[off + 7] = (((va >> 8) & 0x0F) << 4) | ((vb >> 8) & 0x0F);

    var hso = d.hSyncOffset | 0, hsw = d.hSyncWidth | 0;
    var vso = d.vSyncOffset | 0, vsw = d.vSyncWidth | 0;
    target[off + 8] = hso & 0xFF;
    target[off + 9] = hsw & 0xFF;
    target[off + 10] = ((vso & 0x0F) << 4) | (vsw & 0x0F);
    /* Byte 11 packs the two high bits of every sync field:
       bits 7-6 h-sync offset, 5-4 h-sync width, 3-2 v-sync offset, 1-0 v-sync width. */
    target[off + 11] = (((hso >> 8) & 0x03) << 6) | (((hsw >> 8) & 0x03) << 4) |
      (((vso >> 4) & 0x03) << 2) | ((vsw >> 4) & 0x03);

    var hs = d.hSize | 0, vs = d.vSize | 0;
    target[off + 12] = hs & 0xFF;
    target[off + 13] = vs & 0xFF;
    target[off + 14] = (((hs >> 8) & 0x0F) << 4) | ((vs >> 8) & 0x0F);
    target[off + 15] = d.hBorder | 0;
    target[off + 16] = d.vBorder | 0;

    var flags = 0;
    if (d.interlaced) flags |= 0x80;
    flags |= ((d.stereo || 0) & 0x03) << 5;
    flags |= ((d.syncType == null ? 3 : d.syncType) & 0x03) << 3;
    if (d.hSyncPositive) flags |= 0x04;
    if (d.vSyncPositive) flags |= 0x02;
    target[off + 17] = flags;
  }

  /* ---------------------------------------------------- descriptor writers */
  /* 13 text bytes: the string, then 0x0A, then 0x20 padding.  A string of 13
     characters leaves no room for the line feed, so it is trimmed to 12. */
  function writeTextDescriptor(target, off, tag, text) {
    var t = (text == null ? '' : String(text)).substring(0, 12);
    var bytes = [];
    for (var i = 0; i < t.length; i++) bytes.push(t.charCodeAt(i) & 0x7F);
    bytes.push(0x0A);
    while (bytes.length < 13) bytes.push(0x20);
    target[off] = 0; target[off + 1] = 0; target[off + 2] = 0; target[off + 3] = tag;
    target[off + 4] = 0;
    for (var j = 0; j < 13; j++) target[off + 5 + j] = bytes[j];
  }

  function writeDummyDescriptor(target, off) {
    target[off] = 0; target[off + 1] = 0; target[off + 2] = 0; target[off + 3] = 0x10;
    for (var i = 4; i < 18; i++) target[off + i] = 0;
  }

  /* Range limits descriptor.  Byte 10 selects the timing support:
     0x00 default GTF / 0x01 range limits only  -> bytes 11..17 are LF + spaces
     0x02 secondary GTF                        -> GTF parameters
     0x04 CVT                                  -> CVT capability fields        */
  var RANGE_SUPPORT = {
    'default-gtf': 0x00, 'default': 0x00, 'gtf': 0x00,
    'range-only': 0x01, 'range': 0x01,
    'gtf2': 0x02, 'secondary-gtf': 0x02,
    'cvt': 0x04
  };

  function rangeSupportValue(v) {
    if (typeof v === 'string') {
      var key = v.toLowerCase();
      if (RANGE_SUPPORT[key] != null) return RANGE_SUPPORT[key];
    }
    var n = parseInt(v, 10);
    return isNaN(n) ? 0x04 : (n & 0xFF);
  }

  function writeRangeLimits(target, off, d) {
    d = d || {};
    target[off] = 0; target[off + 1] = 0; target[off + 2] = 0; target[off + 3] = 0xFD;
    target[off + 4] = 0;
    target[off + 5] = clampByte(d.minVRate == null ? 50 : d.minVRate);
    target[off + 6] = clampByte(d.maxVRate == null ? 75 : d.maxVRate);
    target[off + 7] = clampByte(d.minHRate == null ? 30 : d.minHRate);
    target[off + 8] = clampByte(d.maxHRate == null ? 83 : d.maxHRate);
    target[off + 9] = clampByte(Math.round((d.maxPixelClock == null ? 170 : d.maxPixelClock) / 10));

    var support = rangeSupportValue(d.timingFormula == null ? 'cvt' : d.timingFormula);
    target[off + 10] = support;

    if (support === 0x00 || support === 0x01) {
      target[off + 11] = 0x0A;
      for (var i = 12; i <= 17; i++) target[off + i] = 0x20;
    } else if (support === 0x02) {
      target[off + 11] = 0x00;
      target[off + 12] = clampByte(Math.round((d.gtf2StartKHz == null ? 60 : d.gtf2StartKHz) / 10));
      target[off + 13] = clampByte(Math.round((d.gtf2C == null ? 40 : d.gtf2C) * 2));
      var m = clampByte(d.gtf2M == null ? 600 : d.gtf2M);
      target[off + 14] = m & 0xFF;
      target[off + 15] = (m >> 8) & 0xFF;
      target[off + 16] = clampByte(d.gtf2K == null ? 128 : d.gtf2K);
      target[off + 17] = clampByte(Math.round((d.gtf2J == null ? 20 : d.gtf2J) * 2));
    } else {
      /* CVT */
      var order = ['4:3', '16:9', '16:10', '5:4', '15:9'];
      var ratios = d.cvtAspectRatios || order;
      var mask = 0;
      order.forEach(function (r, idx) { if (ratios.indexOf(r) >= 0) mask |= (1 << (7 - idx)); });
      target[off + 11] = 0x00;
      target[off + 12] = clampByte(Math.round((d.cvtMaxPixelClock == null ? (d.maxPixelClock || 0) : d.cvtMaxPixelClock) / 10));
      target[off + 13] = clampByte(Math.round((d.cvtMaxActivePixels == null ? 0 : d.cvtMaxActivePixels) / 8));
      target[off + 14] = mask;
      var pref = order.indexOf(d.cvtPreferredAspect || '16:9');
      target[off + 15] = pref < 0 ? 0 : pref;
      var blank = 0;
      if (d.cvtStandardBlanking !== false) blank |= 0x08;
      if (d.cvtReducedBlanking !== false) blank |= 0x04;
      target[off + 16] = blank;
      target[off + 17] = 0x00;
    }
  }

  function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v) || 0)); }

  /* --------------------------------------------------------------- features */
  function establishedBits(labels) {
    var bytes = [0, 0, 0];
    var set = {};
    (labels || []).forEach(function (l) { set[C.establishedKey(l)] = true; });
    C.ESTABLISHED.forEach(function (e) {
      if (set[C.establishedKey(e[2])]) bytes[e[0]] |= (1 << e[1]);
    });
    return bytes;
  }

  function aspectCodeFor(width, height, explicit) {
    if (explicit) {
      for (var i = 0; i < C.ASPECTS.length; i++) {
        if (C.ASPECTS[i].label === explicit) return C.ASPECTS[i].code;
      }
    }
    if (!width || !height) return 3;
    var r = width / height;
    var best = 0, bestDiff = Infinity;
    C.ASPECTS.forEach(function (a) {
      var diff = Math.abs(a.ratio - r);
      if (diff < bestDiff) { bestDiff = diff; best = a.code; }
    });
    return best;
  }

  function standardTimingBytes(st) {
    var w = st.width | 0;
    if (w < 248 || w > 2288) return null;
    var b0 = Math.round(w / 8) - 31;
    if (b0 < 0) b0 = 0;
    if (b0 > 255) b0 = 255;
    var code = aspectCodeFor(w, st.height, st.aspectRatio);
    var rate = Math.max(60, Math.min(123, Math.round(st.refreshRate || 60)));
    return [b0, ((code & 0x03) << 6) | (rate - 60)];
  }

  /* --------------------------------------------------------------- encode */
  function encode(model) {
    var warnings = [];
    var bytes = new Uint8Array(128 * (1 + (model.extensions || []).length));

    /* ---- header ---- */
    for (var i = 0; i < 8; i++) bytes[i] = C.HEADER[i];

    /* ---- manufacturer / product ---- */
    var mfg = model.manufacturer || 'ABC';
    if (!/^[A-Za-z]{3}$/.test(mfg)) warnings.push('Manufacturer ID "' + mfg + '" is not three letters; "ABC" was used.');
    var mb = C.manufacturerToBytes(mfg);
    bytes[8] = mb[0]; bytes[9] = mb[1];

    var pc = parseInt(model.productCode, 16);
    if (isNaN(pc)) { pc = 0; warnings.push('Product code is not valid hexadecimal; 0 was used.'); }
    pc = pc & 0xFFFF;
    bytes[10] = pc & 0xFF; bytes[11] = (pc >> 8) & 0xFF;

    var serial = parseInt(model.serialNumber, 16);
    if (model.serialNumber && isNaN(serial)) warnings.push('Serial number is not valid hexadecimal; 0 was used.');
    serial = (isNaN(serial) ? 0 : serial) >>> 0;
    bytes[12] = serial & 0xFF; bytes[13] = (serial >>> 8) & 0xFF;
    bytes[14] = (serial >>> 16) & 0xFF; bytes[15] = (serial >>> 24) & 0xFF;

    /* ---- date / version ---- */
    var week = clampByte(model.weekOfManufacture == null ? 1 : model.weekOfManufacture);
    if (model.modelYearFlag) week = 0xFF;
    bytes[16] = week;
    var year = model.yearOfManufacture | 0;
    if (year < 1990 || year > 2245) {
      warnings.push('Manufacture year must be between 1990 and 2245; ' + year + ' was clamped.');
      year = Math.max(1990, Math.min(2245, year));
    }
    bytes[17] = year - 1990;
    bytes[18] = model.edidVersion || 1;
    bytes[19] = model.edidRevision == null ? 4 : model.edidRevision;

    /* ---- video input definition ---- */
    var vi = 0;
    if (model.isDigital) {
      vi |= 0x80;
      vi |= ((model.bitDepth | 0) & 0x07) << 4;
      vi |= (model.digitalInterface | 0) & 0x0F;
    } else {
      vi |= ((model.videoLevel | 0) & 0x03) << 5;
      if (model.analogSetupExpected) vi |= 0x10;
      var ss = model.syncSupport || {};
      if (ss.separate) vi |= 0x08;
      if (ss.composite) vi |= 0x04;
      if (ss.syncOnGreen) vi |= 0x02;
      if (ss.serrated) vi |= 0x01;
    }
    bytes[20] = vi;

    /* ---- screen size ---- */
    bytes[21] = clampByte(model.width);
    bytes[22] = clampByte(model.height);

    /* ---- gamma ---- */
    if (model.gammaDefinedInExtension) bytes[23] = 0xFF;
    else {
      var g = parseFloat(model.gamma);
      if (isNaN(g)) g = 2.2;
      if (g < 1.0 || g > 3.54) warnings.push('Gamma ' + g + ' is outside the EDID range 1.00–3.54.');
      var gb = Math.round(g * 100) - 100;
      bytes[23] = clampByte(gb);
    }

    /* ---- feature support ---- */
    var f = 0;
    var dpms = model.dpms || {};
    if (dpms.standby) f |= 0x80;
    if (dpms.suspend) f |= 0x40;
    if (dpms.activeOff) f |= 0x20;
    if (model.isDigital) {
      var ce = model.colorEncoding == null ? 1 : model.colorEncoding;
      f |= ((ce - 1) & 0x03) << 3;
    } else {
      f |= ((model.analogDisplayType | 0) & 0x03) << 3;
    }
    if (model.features && model.features.sRGB) f |= 0x04;
    if (model.features && model.features.preferredTiming) f |= 0x02;
    if (model.features && model.features.continuousFrequency) f |= 0x01;
    bytes[24] = f;

    /* ---- chromaticity ---- */
    var cc = model.colorCharacteristics || C.sRGBChromaticity();
    function q(v) { return Math.max(0, Math.min(1023, Math.round((v || 0) * 1024))); }
    var r = cc.red || { x: 0.64, y: 0.33 };
    var gr = cc.green || { x: 0.3, y: 0.6 };
    var bl = cc.blue || { x: 0.15, y: 0.06 };
    var wh = cc.white || { x: 0.3127, y: 0.329 };
    var rx = q(r.x), ry = q(r.y), gx = q(gr.x), gy = q(gr.y);
    var bx = q(bl.x), by = q(bl.y), wx = q(wh.x), wy = q(wh.y);

    bytes[25] = (rx >> 2) & 0xFF;
    bytes[26] = (ry >> 2) & 0xFF;
    bytes[27] = (gx >> 2) & 0xFF;
    bytes[28] = (gy >> 2) & 0xFF;
    bytes[29] = (bx >> 2) & 0xFF;
    bytes[30] = (by >> 2) & 0xFF;
    bytes[31] = (wx >> 2) & 0xFF;
    bytes[32] = (wy >> 2) & 0xFF;
    bytes[33] = ((rx & 3) << 6) | ((ry & 3) << 4) | ((gx & 3) << 2) | (gy & 3);
    bytes[34] = ((bx & 3) << 6) | ((by & 3) << 4) | ((wx & 3) << 2) | (wy & 3);

    /* ---- established timings ---- */
    var est = establishedBits(model.establishedTimings);
    bytes[35] = est[0];
    bytes[36] = est[1];
    bytes[37] = (est[2] & 0x80) | ((model.manufacturerTimingBits | 0) & 0x7F);

    /* ---- standard timings ---- */
    var stds = (model.standardTimings || []).slice(0, 8);
    for (var s = 0; s < 8; s++) {
      var off = 38 + s * 2;
      if (s < stds.length && stds[s] && !stds[s].unused) {
        var pair = standardTimingBytes(stds[s]);
        if (!pair) {
          warnings.push('Standard timing ' + (s + 1) + ' width ' + stds[s].width + ' px is outside the EDID range 248–2288; the slot was left empty.');
          bytes[off] = 0x01; bytes[off + 1] = 0x01;
        } else {
          bytes[off] = pair[0]; bytes[off + 1] = pair[1];
        }
      } else {
        bytes[off] = 0x01; bytes[off + 1] = 0x01;
      }
    }

    /* ---- descriptors ---- */
    var slots = (model.descriptors || []).slice(0, 4);
    while (slots.length < 4) slots.push({ type: 'unused' });

    /* Preferred timing must occupy slot 1 when declared. */
    var hasPreferred = !!(model.features && model.features.preferredTiming);
    if (hasPreferred) {
      var idx = -1;
      for (var k = 0; k < slots.length; k++) if (slots[k] && slots[k].type === 'detailed') { idx = k; break; }
      if (idx > 0) {
        var moved = slots.splice(idx, 1)[0];
        slots.unshift(moved);
        warnings.push('The preferred (first) detailed timing descriptor was moved to slot 1.');
      } else if (idx < 0) {
        warnings.push('Preferred timing mode is enabled but no detailed timing descriptor is present; the flag was cleared.');
        bytes[24] &= ~0x02;
      }
    }

    slots.forEach(function (slot, i) {
      var o = 54 + i * 18;
      if (!slot || slot.type === 'unused' || slot.type === 'dummy') { writeDummyDescriptor(bytes, o); return; }
      switch (slot.type) {
        case 'detailed':
          writeDTD(bytes, o, slot.data || {});
          break;
        case 'product_name':
        case 'monitor_name':
          writeTextDescriptor(bytes, o, 0xFC, slot.text);
          break;
        case 'serial_number':
          writeTextDescriptor(bytes, o, 0xFF, slot.text);
          break;
        case 'ascii_string':
          writeTextDescriptor(bytes, o, 0xFE, slot.text);
          break;
        case 'range_limits':
          writeRangeLimits(bytes, o, slot.data || {});
          break;
        default:
          writeDummyDescriptor(bytes, o);
      }
    });

    /* ---- extension count ---- */
    bytes[126] = (model.extensions || []).length;

    /* ---- base checksum ---- */
    bytes[127] = C.makeChecksum(bytes.subarray(0, 128), 0);

    /* ---- extension blocks ---- */
    (model.extensions || []).forEach(function (ext, i) {
      var off = (i + 1) * 128;
      var block = bytes.subarray(off, off + 128);
      if (ext.type === 'CEA') writeCEA(block, ext, warnings);
      else if (ext.type === 'VTB') writeVTB(block, ext);
      else if (ext.type === 'DISPLAYID') writeDisplayID(block, ext);
      else if (ext.type === 'BLOCK_MAP') writeBlockMap(block, ext, model.extensions.length);
      else block[0] = ext.tag || 0x00;
      block[127] = C.makeChecksum(block, 0);
    });

    return {
      bytes: bytes,
      hex: C.bytesToHexCompact(bytes),
      warnings: warnings
    };
  }

  /* --------------------------------------------------------- CEA-861 block */
  function writeCEA(block, ext, warnings) {
    for (var i = 0; i < 128; i++) block[i] = 0;
    block[0] = 0x02;
    block[1] = ext.revision || 3;

    var flags = 0;
    var feats = ext.features || {};
    if (feats.basicAudio) flags |= 0x04;
    if (feats.ycbcr444) flags |= 0x02;
    if (feats.ycbcr422) flags |= 0x01;
    if (feats.underscan) flags |= 0x08;

    var dtbl = [];
    (ext.dataBlocks || []).forEach(function (db) {
      var bytes = buildDataBlock(db);
      if (bytes && bytes.length) dtbl = dtbl.concat(bytes);
    });

    /* Reserve room for the detailed timing descriptors. */
    var dtdBytes = [];
    (ext.detailedTimings || []).forEach(function (d, i) {
      var tmp = new Uint8Array(18);
      writeDTD(tmp, 0, d);
      dtdBytes = dtdBytes.concat(Array.prototype.slice.call(tmp));
      void i;
    });

    var dtdOffset = 0;
    var nativeCount = Math.min(15, (ext.detailedTimings || []).length);
    if (dtdBytes.length) {
      dtdOffset = 4 + dtbl.length;
      if (dtdOffset % 1 !== 0 || dtdOffset + dtdBytes.length > 127) {
        warnings.push('CEA-861 data blocks leave too little room for ' + (ext.detailedTimings || []).length + ' detailed timing(s); the extra descriptor(s) were dropped.');
        var room = Math.floor((127 - dtdOffset) / 18);
        nativeCount = Math.min(nativeCount, Math.max(0, room));
        dtdBytes = dtdBytes.slice(0, Math.max(0, room) * 18);
        if (!dtdBytes.length) dtdOffset = 0;
      }
    }

    block[2] = dtdOffset;
    block[3] = ((nativeCount & 0x0F) << 4) | (flags & 0x0F);

    for (var j = 0; j < dtbl.length && 4 + j < 127; j++) block[4 + j] = dtbl[j] & 0xFF;

    if (dtdOffset) {
      for (var k = 0; k < dtdBytes.length && dtdOffset + k < 127; k++) block[dtdOffset + k] = dtdBytes[k];
    }
  }

  function buildDataBlock(db) {
    var out = [];
    if (db.type === 'video') {
      var codes = (db.codes || []).slice(0, 31);
      if (!codes.length) return [];
      out.push(0x40 | codes.length);
      codes.forEach(function (c) { out.push((c.native ? 0x80 : 0x00) | (c.code & 0x7F)); });
    } else if (db.type === 'audio') {
      var items = (db.items || []).filter(function (a) { return a; }).slice(0, 10);
      if (!items.length) return [];
      var payload = [];
      items.forEach(function (a) {
        var d = ((a.format & 0x0F) << 3) | ((Math.max(1, a.channels || 2) - 1) & 0x07);
        var rates = 0;
        var rateList = [192, 176.4, 96, 88.2, 48, 44.1, 32];
        rateList.forEach(function (r, idx) {
          if ((a.sampleRates || []).indexOf(r) >= 0) rates |= (1 << (6 - idx));
        });
        var depths = 0;
        var depthList = [24, 20, 16];
        depthList.forEach(function (d2, idx) {
          if ((a.bitDepths || []).indexOf(d2) >= 0) depths |= (1 << (2 - idx));
        });
        payload.push(d, rates, depths);
      });
      out.push(0x20 | payload.length);
      out = out.concat(payload);
    } else if (db.type === 'speaker') {
      var mask = 0;
      (db.speakers || []).forEach(function (bit) { mask |= (1 << bit); });
      out.push(0x80 | 3, mask & 0xFF, (mask >> 8) & 0xFF, (mask >> 16) & 0xFF);
    } else if (db.type === 'hdmi-vsdb') {
      var vsdb = db.data || {};
      var payload2 = [0x03, 0x0C, 0x00];
      payload2.push((((vsdb.a | 0) & 0x0F) << 4) | ((vsdb.b | 0) & 0x0F));
      payload2.push((((vsdb.c | 0) & 0x0F) << 4) | ((vsdb.d | 0) & 0x0F));
      var dcap = 0;
      if (vsdb.supportsAI) dcap |= 0x80;
      if (vsdb.dviDual) dcap |= 0x01;
      if (vsdb.deepColor30) dcap |= 0x10;
      if (vsdb.deepColor36) dcap |= 0x08;
      if (vsdb.deepColor48) dcap |= 0x04;
      payload2.push(dcap);
      payload2.push(clampByte(Math.round((vsdb.maxTmdsClockMHz == null ? 300 : vsdb.maxTmdsClockMHz) / 5)));
      out.push(0x60 | payload2.length);
      out = out.concat(payload2);
    } else if (db.type === 'hdmi-forum') {
      var hf = [0xD8, 0x5D, 0xC4, 0x01, 0x00, 0x00, 0x00];
      if (db.scrambling) hf[6] |= 0x08;
      out.push(0x60 | hf.length);
      out = out.concat(hf);
    } else if (db.type === 'hdr-static') {
      var hm = db.data || {};
      var eotf = 0;
      if (hm.traditionalSDR !== false) eotf |= 0x01;
      if (hm.traditionalHDR) eotf |= 0x02;
      if (hm.hdrPQ) eotf |= 0x04;
      if (hm.hlg) eotf |= 0x08;
      var sm = hm.staticMetadata ? 0x01 : 0x00;
      var payload3 = [0x06, eotf, sm];
      payload3.push(clampByte(hm.desiredMaxLuminance == null ? 0 : hm.desiredMaxLuminance));
      payload3.push(clampByte(hm.desiredMaxFrameAverage == null ? 0 : hm.desiredMaxFrameAverage));
      payload3.push(clampByte(hm.desiredMinLuminance == null ? 0 : hm.desiredMinLuminance));
      out.push(0xE0 | payload3.length);
      out = out.concat(payload3);
    } else if (db.type === 'colorimetry') {
      var cm = db.data || {};
      var cmask = 0;
      if (cm.xvYCC601) cmask |= 0x01;
      if (cm.xvYCC709) cmask |= 0x02;
      if (cm.sYCC601) cmask |= 0x04;
      if (cm.opYCC601) cmask |= 0x08;
      if (cm.opRGB) cmask |= 0x10;
      if (cm.bt2020cYCC) cmask |= 0x20;
      if (cm.bt2020YCC) cmask |= 0x40;
      if (cm.bt2020RGB) cmask |= 0x80;
      var payload4 = [0x05, cmask & 0xFF, (cmask >> 8) & 0xFF];
      out.push(0xE0 | payload4.length);
      out = out.concat(payload4);
    }
    return out;
  }

  function writeVTB(block, ext) {
    for (var i = 0; i < 128; i++) block[i] = 0;
    block[0] = 0x10;
    var src = new Uint8Array(128);
    src[0] = 0x10; src[1] = 1; src[2] = 0;
    block[1] = ext.version || 1;
    block[2] = (ext.descriptors || []).length;
    (ext.descriptors || []).forEach(function (d, i) {
      var o = 3 + i * 18;
      if (o + 18 > 128) return;
      writeDTD(block, o, d);
    });
  }

  function writeDisplayID(block, ext) {
    for (var i = 0; i < 128; i++) block[i] = 0;
    block[0] = 0x70;
    block[1] = ext.version || 0x12;
    block[2] = 0x00;                       /* section bytes, filled below    */
    block[3] = ext.productType == null ? 0x02 : ext.productType;
    var p = 5;
    (ext.sections || []).forEach(function (sec) {
      if (p + 3 + (sec.bytes ? sec.bytes.length : 0) > 127) return;
      block[p] = sec.tag;
      block[p + 1] = sec.revision || 0;
      var body = sec.bytes || [];
      block[p + 2] = body.length;
      for (var j = 0; j < body.length; j++) block[p + 3 + j] = body[j] & 0xFF;
      p += 3 + body.length;
    });
    block[2] = p - 5;
  }

  function writeBlockMap(block, ext, totalBlocks) {
    for (var i = 0; i < 128; i++) block[i] = 0;
    block[0] = 0xF0;
    block[1] = ext.numberOfBlocks == null ? 0 : ext.numberOfBlocks;
    var tags = ext.tags || [];
    for (var j = 0; j < tags.length && j < 126; j++) block[2 + j] = tags[j] & 0xFF;
    void totalBlocks;
  }

  /* ------------------------------------------------------------ new model */
  /* A well-formed CEA-861 extension for a 1080p HDMI sink. */
  function ceaHdExtension() {
    return {
      type: 'CEA', revision: 3,
      features: { basicAudio: true, ycbcr444: true, ycbcr422: true, underscan: true },
      dataBlocks: [
        { type: 'video', codes: [{ code: 16, native: true }, { code: 4 }, { code: 31 }, { code: 19 }] },
        { type: 'audio', items: [{ format: 1, channels: 2, sampleRates: [192, 96, 48, 44.1], bitDepths: [24, 16] }] },
        { type: 'speaker', speakers: [0, 1, 2] },
        { type: 'hdmi-vsdb', data: { a: 1, b: 0, c: 0, d: 0, supportsAI: true, maxTmdsClockMHz: 300 } }
      ],
      detailedTimings: []
    };
  }

  /* A 4K / HDR extension: CTA-861-G video codes, HDR static metadata,
     deep colour and a 600 MHz TMDS limit. */
  function cea4kExtension() {
    return {
      type: 'CEA', revision: 3,
      features: { basicAudio: true, ycbcr444: true, ycbcr422: true, underscan: true },
      dataBlocks: [
        { type: 'video', codes: [{ code: 97, native: true }, { code: 96 }, { code: 95 }, { code: 94 },
          { code: 93 }, { code: 63 }, { code: 16 }, { code: 4 }] },
        { type: 'audio', items: [{ format: 1, channels: 8, sampleRates: [192, 96, 48], bitDepths: [24, 16] }] },
        { type: 'speaker', speakers: [0, 1, 2, 3, 4] },
        { type: 'hdmi-vsdb', data: { a: 1, b: 0, c: 0, d: 0, deepColor30: true, deepColor36: true, maxTmdsClockMHz: 600 } },
        { type: 'hdr-static', data: { traditionalSDR: true, hdrPQ: true, hlg: true, staticMetadata: true } },
        { type: 'colorimetry', data: {} }
      ],
      detailedTimings: []
    };
  }

  function defaultModel() {
    var srgb = C.sRGBChromaticity();
    var dtd = defaultDTD(1920, 1080, 60);
    dtd.hSize = 52; dtd.vSize = 29;
    return {
      manufacturer: 'DEL',
      productCode: '1A3F',
      serialNumber: '01234567',
      weekOfManufacture: 20,
      yearOfManufacture: new Date().getFullYear(),
      modelYearFlag: false,
      edidVersion: 1,
      edidRevision: 4,
      isDigital: true,
      bitDepth: 2,
      digitalInterface: 2,
      colorEncoding: 1,
      dfiFlag: false,
      videoLevel: 0,
      syncSupport: { separate: false, composite: false, syncOnGreen: false, serrated: false },
      analogSetupExpected: false,
      analogDisplayType: 1,
      width: 52,
      height: 29,
      gamma: 2.2,
      gammaDefinedInExtension: false,
      manufacturerTimingBits: 0,
      dpms: { standby: true, suspend: true, activeOff: true },
      features: { sRGB: true, preferredTiming: true, continuousFrequency: true },
      colorCharacteristics: {
        red: { x: srgb.red.x, y: srgb.red.y },
        green: { x: srgb.green.x, y: srgb.green.y },
        blue: { x: srgb.blue.x, y: srgb.blue.y },
        white: { x: srgb.white.x, y: srgb.white.y }
      },
      establishedTimings: ['640x480@60', '800x600@60', '1024x768@60'],
      standardTimings: [
        { width: 1280, height: 720, refreshRate: 60, aspectRatio: '16:9' },
        { width: 1280, height: 1024, refreshRate: 60, aspectRatio: '5:4' },
        { width: 1440, height: 900, refreshRate: 60, aspectRatio: '16:10' },
        { width: 1680, height: 1050, refreshRate: 60, aspectRatio: '16:10' }
      ],
      descriptors: [
        { type: 'detailed', data: dtd },
        {
          type: 'range_limits', data: {
            minVRate: 50, maxVRate: 75, minHRate: 30, maxHRate: 83, maxPixelClock: 170,
            timingFormula: 'cvt', cvtMaxActivePixels: 1920, cvtPreferredAspect: '16:9',
            cvtAspectRatios: ['4:3', '16:9', '16:10', '5:4', '15:9']
          }
        },
        { type: 'product_name', text: 'EDID Craft' },
        { type: 'unused' }
      ],
      extensions: [ceaHdExtension()]
    };
  }

  /* -------------------------------------------------------------- presets */
  var FORMAT_PRESETS = {
    '1080p': {
      label: '1080p 60 Hz — 1920×1080 (HDMI, sRGB)', apply: function (m) {
        m.width = 52; m.height = 29; m.gamma = 2.2;
        m.bitDepth = 2; m.digitalInterface = 2; m.colorEncoding = 1;
        m.isDigital = true;
        m.establishedTimings = ['640x480@60', '800x600@60', '1024x768@60'];
        m.standardTimings = [
          { width: 1280, height: 720, refreshRate: 60, aspectRatio: '16:9' },
          { width: 1280, height: 1024, refreshRate: 60, aspectRatio: '5:4' },
          { width: 1440, height: 900, refreshRate: 60, aspectRatio: '16:10' },
          { width: 1680, height: 1050, refreshRate: 60, aspectRatio: '16:10' }
        ];
        var d = defaultDTD(1920, 1080, 60); d.hSize = 52; d.vSize = 29;
        m.descriptors = [
          { type: 'detailed', data: d },
          {
            type: 'range_limits', data: {
              minVRate: 50, maxVRate: 75, minHRate: 30, maxHRate: 83, maxPixelClock: 170,
              timingFormula: 'cvt', cvtMaxActivePixels: 1920, cvtPreferredAspect: '16:9'
            }
          },
          { type: 'product_name', text: 'Full HD' },
          { type: 'unused' }
        ];
        m.extensions = [ceaHdExtension()];
      }
    },
    '1440p': {
      label: '1440p 60 Hz — 2560×1440 (DisplayPort)', apply: function (m) {
        m.width = 60; m.height = 34; m.isDigital = true;
        m.bitDepth = 2; m.digitalInterface = 5; m.colorEncoding = 1;
        var d = defaultDTD(2560, 1440, 60); d.hSize = 60; d.vSize = 34;
        m.descriptors = [
          { type: 'detailed', data: d },
          {
            type: 'range_limits', data: {
              minVRate: 48, maxVRate: 75, minHRate: 30, maxHRate: 90, maxPixelClock: 300,
              timingFormula: 'cvt', cvtMaxActivePixels: 2560, cvtPreferredAspect: '16:9'
            }
          },
          { type: 'product_name', text: 'QHD Panel' },
          { type: 'unused' }
        ];
        m.standardTimings = [
          { width: 1280, height: 720, refreshRate: 60, aspectRatio: '16:9' },
          { width: 1920, height: 1080, refreshRate: 60, aspectRatio: '16:9' }
        ];
        m.extensions = [];
      }
    },
    '4k': {
      label: '4K UHD — 3840×2160 (HDMI 2.0, deep colour, HDR)', apply: function (m) {
        m.width = 94; m.height = 53; m.isDigital = true;
        m.bitDepth = 3; m.digitalInterface = 3; m.colorEncoding = 3;
        var d = defaultDTD(3840, 2160, 60, 2); d.hSize = 94; d.vSize = 53;
        m.descriptors = [
          { type: 'detailed', data: d },
          {
            type: 'range_limits', data: {
              minVRate: 24, maxVRate: 75, minHRate: 30, maxHRate: 140, maxPixelClock: 600,
              timingFormula: 'cvt', cvtMaxActivePixels: 3840, cvtPreferredAspect: '16:9'
            }
          },
          { type: 'product_name', text: '4K UHD' },
          { type: 'unused' }
        ];
        m.standardTimings = [
          { width: 1920, height: 1080, refreshRate: 60, aspectRatio: '16:9' },
          { width: 2560, height: 1440, refreshRate: 60, aspectRatio: '16:9' }
        ];
        m.extensions = [cea4kExtension()];
      }
    },
    'ultrawide': {
      label: 'Ultrawide — 3440×1440 (21:9)', apply: function (m) {
        m.width = 80; m.height = 34; m.isDigital = true;
        m.bitDepth = 2; m.digitalInterface = 5; m.colorEncoding = 1;
        var d = defaultDTD(3440, 1440, 60); d.hSize = 80; d.vSize = 34;
        m.descriptors = [
          { type: 'detailed', data: d },
          {
            type: 'range_limits', data: {
              minVRate: 48, maxVRate: 100, minHRate: 30, maxHRate: 110, maxPixelClock: 500,
              timingFormula: 'cvt', cvtMaxActivePixels: 3440, cvtPreferredAspect: '16:9'
            }
          },
          { type: 'product_name', text: 'Ultrawide' },
          { type: 'unused' }
        ];
        m.extensions = [];
      }
    },
    'laptop': {
      label: 'Laptop panel — 1920×1080 eDP (no DPMS)', apply: function (m) {
        m.width = 34; m.height = 19; m.isDigital = true;
        m.bitDepth = 2; m.digitalInterface = 5; m.colorEncoding = 1;
        m.dpms = { standby: false, suspend: false, activeOff: false };
        var d = defaultDTD(1920, 1080, 60); d.hSize = 34; d.vSize = 19;
        m.descriptors = [
          { type: 'detailed', data: d },
          {
            type: 'range_limits', data: {
              minVRate: 48, maxVRate: 60, minHRate: 30, maxHRate: 70, maxPixelClock: 160,
              timingFormula: 'range-only'
            }
          },
          { type: 'product_name', text: 'Laptop LCD' },
          { type: 'unused' }
        ];
        m.establishedTimings = [];
        m.standardTimings = [{ width: 1280, height: 720, refreshRate: 60, aspectRatio: '16:9' }];
        m.extensions = [];
      }
    },
    'legacy': {
      label: 'Legacy VGA — analog, 640×480 / 800×600 / 1024×768', apply: function (m) {
        m.isDigital = false;
        m.width = 32; m.height = 24; m.gamma = 2.2;
        m.videoLevel = 0;
        m.syncSupport = { separate: true, composite: false, syncOnGreen: true, serrated: false };
        m.establishedTimings = ['720x400@70', '640x480@60', '640x480@67', '640x480@72', '640x480@75',
          '800x600@56', '800x600@60', '800x600@72', '800x600@75', '832x624@75',
          '1024x768@60', '1024x768@70', '1024x768@75'];
        m.standardTimings = [];
        var d = defaultDTD(1024, 768, 60); d.hSize = 32; d.vSize = 24;
        m.descriptors = [
          { type: 'detailed', data: d },
          {
            type: 'range_limits', data: {
              minVRate: 50, maxVRate: 75, minHRate: 30, maxHRate: 50, maxPixelClock: 80,
              timingFormula: 'default-gtf'
            }
          },
          { type: 'product_name', text: 'Legacy VGA' },
          { type: 'unused' }
        ];
        m.extensions = [];
      }
    },
    'hdr': {
      label: 'HDR gaming — 2560×1440 @ 144 Hz + CEA-861', apply: function (m) {
        m.width = 60; m.height = 34; m.isDigital = true;
        m.bitDepth = 3; m.digitalInterface = 5; m.colorEncoding = 3;
        var d = defaultDTD(2560, 1440, 144, 2); d.hSize = 60; d.vSize = 34;
        m.descriptors = [
          { type: 'detailed', data: d },
          {
            type: 'range_limits', data: {
              minVRate: 48, maxVRate: 165, minHRate: 30, maxHRate: 250, maxPixelClock: 700,
              timingFormula: 'cvt', cvtMaxActivePixels: 2560, cvtPreferredAspect: '16:9'
            }
          },
          { type: 'product_name', text: 'HDR Gaming' },
          { type: 'unused' }
        ];
        m.features.continuousFrequency = true;
        m.extensions = [{
          type: 'CEA', revision: 3,
          features: { basicAudio: true, ycbcr444: true, ycbcr422: true, underscan: true },
          dataBlocks: [
            { type: 'video', codes: [{ code: 97, native: true }, { code: 96 }, { code: 63 }, { code: 16 }, { code: 4 }, { code: 31 }, { code: 19 }, { code: 18 }] },
            { type: 'audio', items: [{ format: 1, channels: 2, sampleRates: [192, 96, 48, 44.1], bitDepths: [24, 16] }] },
            { type: 'speaker', speakers: [0, 1] },
            { type: 'hdmi-vsdb', data: { a: 1, b: 0, c: 0, d: 0, deepColor30: true, deepColor36: true, maxTmdsClockMHz: 600 } }
          ],
          detailedTimings: []
        }];
      }
    }
  };

  /* Map any timing-engine result (CVT or GTF, progressive or interlaced) onto
     the DTD field names.  For interlaced formats the timing engine already
     reports per-field vertical values, which is exactly what a DTD stores. */
  function dtdFromTiming(t) {
    return {
      pixelClock: t.pixelClock * 1000,
      hActive: t.hActive,
      hBlanking: t.hBlank,
      vActive: t.vActive,
      vBlanking: t.vBlank,
      hSyncOffset: t.hFrontPorch,
      hSyncWidth: t.hSync,
      vSyncOffset: t.vFrontPorch,
      vSyncWidth: t.vSync,
      hSize: 0, vSize: 0,
      hBorder: t.hBorder || 0,
      vBorder: t.vBorder || 0,
      interlaced: !!t.interlaced,
      stereo: 0,
      hSyncPositive: !!t.hSyncPositive,
      vSyncPositive: !!t.vSyncPositive,
      syncType: 3
    };
  }

  /* Pack a DTD object into its 18 bytes. */
  function packDTD(d) {
    var out = new Uint8Array(18);
    writeDTD(out, 0, d || {});
    return out;
  }

  global.EDIDEncoder = {
    encode: encode,
    defaultModel: defaultModel,
    defaultDTD: defaultDTD,
    dtdFromTiming: dtdFromTiming,
    packDTD: packDTD,
    FORMAT_PRESETS: FORMAT_PRESETS,
    establishedBits: establishedBits,
    aspectCodeFor: aspectCodeFor,
    ceaHdExtension: ceaHdExtension,
    cea4kExtension: cea4kExtension
  };
})(typeof window !== 'undefined' ? window : this);
