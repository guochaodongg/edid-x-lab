/* ==========================================================================
   EDID-X-LAB — edid-decoder.js
   Full structural decode of a base block plus every extension block.
   ========================================================================== */
(function (global) {
  'use strict';

  var C = global.EDIDCore;

  /* ------------------------------------------------------------ descriptor */
  function parseDTD(b, off) {
    var pixelClock10kHz = b[off] | (b[off + 1] << 8);
    var hActive = b[off + 2] | ((b[off + 4] & 0xF0) << 4);
    var hBlanking = b[off + 3] | ((b[off + 4] & 0x0F) << 8);
    var vActive = b[off + 5] | ((b[off + 7] & 0xF0) << 4);
    var vBlanking = b[off + 6] | ((b[off + 7] & 0x0F) << 8);
    var hSyncOffset = b[off + 8] | ((b[off + 11] & 0xC0) << 2);
    var hSyncWidth = b[off + 9] | ((b[off + 11] & 0x30) << 4);
    var vSyncOffset = ((b[off + 10] & 0xF0) >> 4) | ((b[off + 11] & 0x0C) << 2);
    var vSyncWidth = (b[off + 10] & 0x0F) | ((b[off + 11] & 0x03) << 4);
    var hSize = b[off + 12] | ((b[off + 14] & 0xF0) << 4);
    var vSize = b[off + 13] | ((b[off + 14] & 0x0F) << 8);
    var flags = b[off + 17];
    var syncType = (flags >> 3) & 0x03;
    var hTotal = hActive + hBlanking;
    var vTotal = vActive + vBlanking;
    var pixelClockKHz = pixelClock10kHz * 10;
    var refresh = (pixelClockKHz > 0 && hTotal > 0 && vTotal > 0)
      ? (pixelClockKHz * 1000) / (hTotal * vTotal) : 0;

    return {
      type: 'detailed',
      offset: off,
      pixelClock10kHz: pixelClock10kHz,
      pixelClockKHz: pixelClockKHz,
      hActive: hActive,
      hBlanking: hBlanking,
      hTotal: hTotal,
      hSyncOffset: hSyncOffset,
      hSyncWidth: hSyncWidth,
      hBackPorch: hBlanking - hSyncOffset - hSyncWidth,
      vActive: vActive,
      vBlanking: vBlanking,
      vTotal: vTotal,
      vSyncOffset: vSyncOffset,
      vSyncWidth: vSyncWidth,
      vBackPorch: vBlanking - vSyncOffset - vSyncWidth,
      hSize: hSize,
      vSize: vSize,
      hBorder: b[off + 15],
      vBorder: b[off + 16],
      interlaced: !!(flags & 0x80),
      stereo: (flags >> 5) & 0x03,
      syncType: syncType,
      syncTypeName: ['Analog composite', 'Bipolar analog composite',
        'Digital composite', 'Digital separate'][syncType],
      hSyncPositive: !!(flags & 0x04),
      vSyncPositive: !!(flags & 0x02),
      refreshRate: refresh,
      aspectRatio: (hSize && vSize) ? C.aspectRatioLabel(hSize, vSize) : null,
      diagonalInches: C.diagonalInches(hSize, vSize),
      raw: Array.prototype.slice.call(b, off, off + 18)
    };
  }

  function parseDescriptor(b, off) {
    /* A display descriptor is identified by 0x0000 in the first two bytes,
       0x00 in bytes 2 and 4, with the tag in byte 3.  A detailed timing with
       a zero pixel clock still has a non-zero byte 2 (h-active LSB), so the
       extra bytes must be checked or such a DTD would be misread. */
    var isMonitor = b[off] === 0 && b[off + 1] === 0 && b[off + 2] === 0 && b[off + 4] === 0;
    if (!isMonitor) {
      var dtd = parseDTD(b, off);
      return dtd;
    }
    var tag = b[off + 3];
    var meta = C.DESCRIPTOR_TAGS[tag] || { name: 'Unknown descriptor 0x' + C.hex(tag, 2), kind: 'unknown' };
    var out = { type: 'monitor', tag: tag, tagName: meta.name, kind: meta.kind, offset: off, raw: Array.prototype.slice.call(b, off, off + 18) };

    if (meta.kind === 'text') {
      var s = C.parseEdidString(b, off + 5, 13);
      out.text = s.text;
      out.padded = s.rawLength < 13;
      out.terminated = s.terminated;
      out.terminator = s.terminator;
      out.trailing = s.trailing;
    } else if (tag === 0xFD) {
      out.minVRate = b[off + 5];
      out.maxVRate = b[off + 6];
      out.minHRate = b[off + 7];
      out.maxHRate = b[off + 8];
      out.maxPixelClock = b[off + 9] * 10;   /* MHz */
      /* Byte 10 selects the video timing support for this range:
         0x00 default GTF, 0x01 range limits only, 0x02 secondary GTF, 0x04 CVT. */
      var support = b[off + 10];
      out.timingSupport = support;
      out.timingFormula = support;
      out.timingFormulaName = support === 0x00 ? 'Default GTF'
        : support === 0x01 ? 'Range limits only'
          : support === 0x02 ? 'Secondary GTF'
            : (support & 0x04) ? 'CVT' : ('Reserved (0x' + C.hex(support, 2) + ')');

      if (support === 0x00 || support === 0x01) {
        /* The remaining seven bytes must be LF + six spaces. */
        out.unusedBytes = Array.prototype.slice.call(b, off + 11, off + 18);
        out.padded = out.unusedBytes[0] === 0x0A &&
          out.unusedBytes.slice(1).every(function (x) { return x === 0x20; });
        out.terminator = out.padded;
      } else if (support === 0x02) {
        out.gtf2 = {
          reserved: b[off + 11],
          startFrequencyKHz: b[off + 12] * 10,
          c: b[off + 13] / 2,
          m: b[off + 14] | (b[off + 15] << 8),
          k: b[off + 16],
          j: b[off + 17] / 2
        };
        out.terminator = true;
      } else if (support & 0x04) {
        var maxPixels = b[off + 13] * 8;
        out.cvt = {
          reserved: b[off + 11],
          maxPixelClockMHz: b[off + 12] * 10,
          maxActivePixelsPerLine: maxPixels || null,
          aspectRatios: ['4:3', '16:9', '16:10', '5:4', '15:9']
            .filter(function (_, i) { return b[off + 14] & (1 << (7 - i)); }),
          preferredAspect: ['4:3', '16:9', '16:10', '5:4', '15:9'][b[off + 15]] || null,
          standardBlanking: !!(b[off + 16] & 0x08),
          reducedBlanking: !!(b[off + 16] & 0x04),
          reserved2: b[off + 17]
        };
        out.terminator = true;
      } else {
        out.terminator = true;
      }
    } else if (tag === 0xFB) {
      out.whitePoints = [5, 7, 9].map(function (p) {
        var idx = p - 5;
        var raw = b[off + p] | (b[off + p + 1] << 8);
        var x = raw >> 10, y = raw & 0x3FF;
        return { index: idx, x: x / 1024, y: y / 1024, gamma: (b[off + p + 2] + 100) / 100 };
      });
    } else if (tag === 0xF7) {
      out.established3 = [];
      for (var byte = 6; byte <= 11; byte++) {
        for (var bit = 7; bit >= 0; bit--) {
          if (b[off + byte] & (1 << bit)) out.established3.push('b' + byte + '.b' + bit);
        }
      }
    }
    return out;
  }

  /* -------------------------------------------------------- CEA-861 blocks */
  function parseCEA(b, off) {
    var rev = b[off + 1];
    var dtdOffset = b[off + 2];
    var nativeCount = (b[off + 3] >> 4) & 0x0F;
    var flags = b[off + 3] & 0x0F;
    var dtdCount = 0;
    var out = {
      tag: 0x02, tagName: 'CEA-861 Extension', offset: off,
      revision: rev, dtdOffset: dtdOffset, nativeDTDCount: nativeCount,
      flags: flags,
      supportsBasicAudio: !!(flags & 0x04),
      supportsYCbCr444: !!(flags & 0x02),
      supportsYCbCr422: !!(flags & 0x01),
      underscan: !!(flags & 0x08),
      dataBlocks: [],
      detailedTimings: [],
      issues: []
    };

    var end = dtdOffset ? off + dtdOffset : off + 127;
    var p = off + 4;
    var guard = 0;
    while (p < end && guard++ < 200) {
      var header = b[p];
      if (header === 0) { p++; continue; }
      var tag = (header >> 5) & 0x07;
      var len = header & 0x1F;
      if (p + 1 + len > off + 128) {
        out.issues.push('Data block at offset ' + (p - off) + ' overruns the 128-byte block');
        break;
      }
      var body = Array.prototype.slice.call(b, p + 1, p + 1 + len);
      out.dataBlocks.push(parseDataBlock(tag, header, body, p - off));
      p += 1 + len;
    }

    if (dtdOffset) {
      var d = off + dtdOffset;
      var limit = off + 127;
      while (d + 18 <= limit && b[d] !== 0 && dtdCount < 8) {
        out.detailedTimings.push(parseDTD(b, d));
        d += 18; dtdCount++;
      }
      if (dtdOffset < 4) out.issues.push('DTD offset points inside the data block collection');
      if (dtdCount < nativeCount) out.issues.push('Native DTD count (' + nativeCount + ') exceeds the number of descriptors present (' + dtdCount + ')');
    } else if (nativeCount > 0) {
      out.issues.push('Native DTD count is non-zero but the DTD offset is zero');
    }
    if (rev < 1 || rev > 3) out.issues.push('Unusual CEA-861 revision ' + rev);
    return out;
  }

  function parseDataBlock(tag, header, body, offset) {
    var block = { tag: tag, header: header, offset: offset, length: body.length, bytes: body, raw: ('0x' + C.hex(header, 2)) };
    switch (tag) {
      case 1: /* Audio Data Block */
        block.name = 'Audio Data Block';
        block.audio = [];
        for (var i = 0; i + 2 < body.length + 1 && i + 2 <= body.length - 1; i += 3) {
          var d = body[i];
          var format = (d >> 3) & 0x0F;
          block.audio.push({
            format: format,
            formatName: C.CEA_AUDIO_FORMATS[format] || ('Format ' + format),
            channels: (d & 0x07) + 1,
            sampleRates: [192, 176.4, 96, 88.2, 48, 44.1, 32].filter(function (_, idx) {
              return body[i + 1] & (1 << (6 - idx));
            }),
            bitDepths: [24, 20, 16].filter(function (_, idx) {
              return body[i + 2] & (1 << (2 - idx));
            }),
            raw: [body[i], body[i + 1], body[i + 2]]
          });
        }
        break;
      case 2: /* Video Data Block */
        block.name = 'Video Data Block';
        block.video = body.map(function (v) {
          var code = v & 0x7F;
          var info = C.CEA_VIDEO_CODES[code] || null;
          return {
            code: code, native: !!(v & 0x80),
            label: C.ceaVideoLabel(code),
            detail: info && !info.reserved ? info : null,
            reserved: !!(info && info.reserved),
            outOfTable: code > C.CEA_MAX_VIC
          };
        });
        break;
      case 3: { /* Vendor Specific Data Block */
        block.name = 'Vendor Specific Data Block';
        if (body.length >= 3) {
          var oui = body[0] | (body[1] << 8) | (body[2] << 16);
          block.oui = '0x' + (oui >>> 0).toString(16).toUpperCase();
          if (oui === 0x000C03) { block.vendor = 'HDMI Licensing (HDMI 1.4 VSDB)'; block.hdmi = parseHdmiVsdb(body); }
          else if (oui === 0xC45DD8) { block.vendor = 'HDMI Forum (HF-VSDB)'; block.hdmiForum = parseHdmiForum(body); }
          else if (oui === 0x001A11) block.vendor = 'Google';
          else if (oui === 0x00001A) block.vendor = 'AMD / ATI';
          else if (oui === 0x000044) block.vendor = 'NVIDIA';
          else if (oui === 0x00D046) block.vendor = 'Dolby Laboratories';
          else block.vendor = 'Unknown OUI';
        }
        break;
      }
      case 4: /* Speaker Allocation */
        block.name = 'Speaker Allocation Data Block';
        if (body.length >= 3) {
          var mask = body[0] | (body[1] << 8) | (body[2] << 16);
          block.speakers = C.SPEAKER_ALLOCATION
            .filter(function (s) { return mask & (1 << s[0]); })
            .map(function (s) { return s[1]; });
        }
        break;
      case 5:
        block.name = 'VESA DTC Data Block';
        break;
      case 6:
        block.name = 'Reserved Data Block';
        break;
      case 7: {
        block.name = 'Extended Data Block';
        var extTag = body[0];
        var extNames = {
          0x00: 'Video Capability (VCDB)', 0x01: 'Vendor-Specific Video (VSVDB)',
          0x02: 'VESA Video Display Device (VESA-DDB)', 0x03: 'VESA Video Timing Block (VTB-EXT)',
          0x04: 'Reserved (HDMI VIC)', 0x05: 'Colorimetry Data Block',
          0x06: 'HDR Static Metadata Data Block', 0x07: 'HDR Dynamic Metadata Data Block',
          0x0D: 'Video Format Preference Data Block', 0x0E: 'YCbCr 4:2:0 Video Data Block',
          0x0F: 'YCbCr 4:2:0 Capability Map Data Block', 0x10: 'Reserved',
          0x11: 'Vendor-Specific Audio Data Block', 0x12: 'HDMI Audio Data Block',
          0x13: 'Room Configuration Data Block', 0x14: 'Speaker Location Data Block',
          0x15: 'InfoFrame Data Block', 0x20: 'Colorimetry (legacy)'
        };
        block.extTag = extTag;
        block.extName = extNames[extTag] || ('Extended tag 0x' + C.hex(extTag, 2));
        if (extTag === 0x00 && body.length >= 2) {
          block.videoCapability = {
            quantRangeYcc: !!(body[1] & 0x80), quantRangeRgb: !!(body[1] & 0x40),
            scanInfo: !!(body[1] & 0x20), itContent: !!(body[1] & 0x10),
            overscan: body[1] & 0x03
          };
        }
        if (extTag === 0x06 && body.length >= 3) {
          /* body[0] = extended tag, [1] = EOTF flags, [2] = static metadata flags,
             [3..5] = optional desired content luminance values */
          var eotf = body[1] || 0;
          block.hdrStatic = {
            eotf: {
              traditionalSDR: !!(eotf & 0x01), traditionalHDR: !!(eotf & 0x02),
              smpte2084: !!(eotf & 0x04), hlg: !!(eotf & 0x08)
            },
            staticMetadataType1: !!(body[2] & 0x01),
            desiredContentMaxLuminance: body.length > 3 ? body[3] : null,
            desiredContentMaxFrameAverage: body.length > 4 ? body[4] : null,
            desiredContentMinLuminance: body.length > 5 ? body[5] : null
          };
        }
        if (extTag === 0x05 && body.length >= 3) {
          var cm = body[1] | (body[2] << 8);
          block.colorimetry = {
            xvYCC601: !!(cm & 1), xvYCC709: !!(cm & 2), sYCC601: !!(cm & 4),
            opYCC601: !!(cm & 8), opRGB: !!(cm & 16), bt2020cYCC: !!(cm & 32),
            bt2020YCC: !!(cm & 64), bt2020RGB: !!(cm & 128), dciP3: !!(cm & 256)
          };
        }
        break;
      }
      default:
        block.name = 'Data Block ' + tag;
    }
    return block;
  }

  function parseHdmiVsdb(body) {
    var out = { raw: body };
    if (body.length >= 5) {
      out.physicalAddress = ((body[3] & 0xF0) >> 4) + '.' + (body[3] & 0x0F) + '.' + ((body[4] & 0xF0) >> 4) + '.' + (body[4] & 0x0F);
    }
    if (body.length >= 6) {
      out.supportsAI = !!(body[5] & 0x80);
      out.dviDual = !!(body[5] & 0x01);
      out.deepColor = {
        '30bit': !!(body[5] & 0x10), '36bit': !!(body[5] & 0x08), '48bit': !!(body[5] & 0x04)
      };
      out.maxTmdsClockMHz = body.length >= 7 ? body[6] * 5 : null;
      out.latencyFieldsPresent = !!(body[5] & 0x02);
    }
    return out;
  }

  function parseHdmiForum(body) {
    return { raw: body, version: body.length >= 3 ? body[2] : null };
  }

  function parseDisplayID(b, off) {
    var version = b[off + 1];
    var sectionBytes = b[off + 2];
    var productType = b[off + 3];
    var out = {
      tag: 0x70, tagName: 'DisplayID Extension', offset: off,
      version: version, sectionSize: sectionBytes, productType: productType,
      sections: [], issues: []
    };
    if (version !== 0x12 && version !== 0x13 && version !== 0x20) {
      out.issues.push('Unknown DisplayID version 0x' + C.hex(version, 2));
    }
    var p = off + 5;
    var guard = 0;
    while (p + 3 <= off + 128 && guard++ < 40) {
      var tag = b[p];
      if (tag === 0) break;
      var rev = b[p + 1];
      var len = b[p + 2];
      if (len === 0 || p + 3 + len > off + 128) {
        out.issues.push('DisplayID section at offset ' + (p - off) + ' runs past the end of the block');
        break;
      }
      var names = {
        0x00: 'Product Identification', 0x01: 'Display Parameters',
        0x02: 'Color Characteristics', 0x03: 'Video Timing Modes (Type I)',
        0x04: 'Video Timing Modes (Type II)', 0x05: 'Video Timing Modes (Type III)',
        0x06: 'Video Timing Modes (Type IV)', 0x07: 'Dynamic Video Timing Range Limits',
        0x08: 'Display Interface Features', 0x09: 'Stereo Display Interface',
        0x0A: 'Tiled Display Topology', 0x0B: 'Container ID',
        0x0C: 'Audio Capabilities', 0x0D: 'Audio Speaker Allocation',
        0x0E: 'Audio Processing', 0x0F: 'Audio Formats',
        0x10: 'Video Enhancement', 0x11: 'Data Block Sequence',
        0x12: 'Multi-Config Extension', 0x13: 'Power Sequencing',
        0x14: 'Display Luminance Characteristics', 0x15: 'DisplayID Type VII Timing',
        0x20: 'Type VIII Timing', 0x21: 'Type IX Timing', 0x22: 'Type X Timing',
        0x81: 'Vendor-Specific'
      };
      out.sections.push({
        tag: tag, revision: rev, length: len, offset: p - off,
        name: names[tag] || ('Section 0x' + C.hex(tag, 2)),
        bytes: Array.prototype.slice.call(b, p + 3, p + 3 + len)
      });
      p += 3 + len;
    }
    return out;
  }

  function parseVTB(b, off) {
    var out = { tag: 0x10, tagName: 'Video Timing Block Extension', offset: off, descriptors: [] };
    out.version = b[off + 1];
    out.descriptorCount = b[off + 2];
    var p = off + 3;
    for (var i = 0; i < out.descriptorCount && p + 18 <= off + 128; i++, p += 18) {
      out.descriptors.push({
        offset: p,
        type: 'VTB descriptor',
        bytes: Array.prototype.slice.call(b, p, p + 18)
      });
    }
    return out;
  }

  function parseBlockMap(b, off) {
    var out = { tag: b[off], tagName: 'Block Map Extension', offset: off, tags: [] };
    out.numberOfBlocks = b[off + 1];
    for (var i = 0; i < 126 && (off + 2 + i) < off + 128; i++) {
      var t = b[off + 2 + i];
      if (t === 0) break;
      out.tags.push({ index: i, tag: t, name: C.EXT_TAGS[t] || ('Block tag 0x' + C.hex(t, 2)) });
    }
    return out;
  }

  /* ------------------------------------------------------------- base block */
  function parseBase(b, off) {
    var o = off || 0;
    var base = {
      offset: o,
      header: b[o] === 0 && C.isHeaderOk(b, o),
      checksumStored: b[o + 127],
      checksumComputed: C.makeChecksum(b.subarray(o, o + 128), 0),
      manufacturer: C.manufacturerFromBytes(b[o + 8], b[o + 9]),
      productCodeRaw: b[o + 10] | (b[o + 11] << 8),
      serialRaw: (b[o + 12] | (b[o + 13] << 8) | (b[o + 14] << 16) | (b[o + 15] << 24)) >>> 0,
      weekRaw: b[o + 16],
      yearRaw: b[o + 17],
      versionMajor: b[o + 18],
      versionMinor: b[o + 19],
      videoInputRaw: b[o + 20],
      widthCm: b[o + 21],
      heightCm: b[o + 22],
      gammaRaw: b[o + 23],
      featuresRaw: b[o + 24],
      extensionCount: b[o + 126]
    };
    base.blockCount = 1 + base.extensionCount;
    base.checksumValid = base.checksumStored === base.checksumComputed;
    base.productCode = ('0000' + base.productCodeRaw.toString(16).toUpperCase()).slice(-4);
    base.serialNumber = ('00000000' + base.serialRaw.toString(16).toUpperCase()).slice(-8);
    base.edidVersion = base.versionMajor + '.' + base.versionMinor;
    base.year = base.yearRaw + 1990;

    /* Week / model year */
    if (base.weekRaw === 0) { base.week = null; base.modelYearFlag = false; base.weekLabel = 'Not specified'; }
    else if (base.weekRaw === 0xFF) { base.week = null; base.modelYearFlag = true; base.weekLabel = 'Model year'; }
    else { base.week = base.weekRaw; base.modelYearFlag = false; base.weekLabel = 'Week ' + base.weekRaw; }
    base.manufactureDate = base.modelYearFlag
      ? ('Model year ' + base.year)
      : (base.week ? ('Week ' + base.week + ', ' + base.year) : String(base.year));

    /* Video input definition */
    var vi = base.videoInputRaw;
    var digital = !!(vi & 0x80);
    base.videoInput = { digital: digital, rawValue: vi };
    if (digital) {
      var depth = (vi >> 4) & 0x07;
      var iface = vi & 0x0F;
      base.videoInput.bitDepth = depth;
      base.videoInput.bitDepthName = C.BIT_DEPTH[depth] || ('Reserved (' + depth + ')');
      base.videoInput.interface = iface;
      base.videoInput.interfaceName = C.DIGITAL_INTERFACE[iface] || ('Reserved (' + iface + ')');
      base.videoInput.dfi = iface === 0;
    } else {
      var level = (vi >> 5) & 0x03;
      base.videoInput.videoLevel = level;
      base.videoInput.videoLevelName = C.VIDEO_LEVEL[level];
      base.videoInput.blankToBlack = !!(vi & 0x10);
      base.videoInput.separateSync = !!(vi & 0x08);
      base.videoInput.compositeSync = !!(vi & 0x04);
      base.videoInput.syncOnGreen = !!(vi & 0x02);
      base.videoInput.serratedVSync = !!(vi & 0x01);
    }

    /* Screen size */
    var w = base.widthCm, h = base.heightCm;
    if (w === 0 && h === 0) {
      base.screenSize = { mode: 'aspect-ratio', widthCm: null, heightCm: null, aspectRatio: 1.0, diagonalInches: null };
    } else if (w === 0 || h === 0) {
      base.screenSize = { mode: 'landscape-aspect', widthCm: null, heightCm: null, aspectRatio: (w === 0 ? (h === 0 ? 1 : (100 / h)) : (w / 100)), diagonalInches: null };
    } else {
      base.screenSize = {
        mode: 'physical', widthCm: w, heightCm: h,
        aspectRatio: w / h, orientation: w >= h ? 'landscape' : 'portrait',
        diagonalInches: C.diagonalInches(w, h)
      };
    }
    base.screenSize.rawWidthByte = w;
    base.screenSize.rawHeightByte = h;

    /* Gamma */
    base.gammaRaw = b[o + 23];
    base.gamma = (b[o + 23] + 100) / 100;
    base.gammaDefinedInExtension = (b[o + 23] === 0xFF);

    /* Features */
    var f = base.featuresRaw;
    base.features = {
      rawValue: f,
      standby: !!(f & 0x80),
      suspend: !!(f & 0x40),
      activeOff: !!(f & 0x20),
      colorEncoding: digital ? ((f >> 3) & 0x03) : null,
      colorEncodingName: digital ? C.COLOR_ENCODING[(f >> 3) & 0x03] : null,
      displayType: digital ? null : ((f >> 3) & 0x03),
      sRGB: !!(f & 0x04),
      preferredTiming: !!(f & 0x02),
      continuousFrequency: !!(f & 0x01)
    };
    base.features.dpmsLevels = [base.features.standby && 'Standby', base.features.suspend && 'Suspend',
      base.features.activeOff && 'Active Off'].filter(Boolean);

    /* Chromaticity */
    function chr(xb, yb, x2b, y2b) {
      var x = ((b[o + xb] << 2) | ((b[o + x2b] >> 6) & 3)) / 1024;
      var y = ((b[o + yb] << 2) | ((b[o + x2b] >> 4) & 3)) / 1024;
      return { x: x, y: y };
    }
    base.chromaticity = {
      red: chr(25, 26, 33, 33),
      green: chr(27, 28, 33, 33),
      blue: chr(29, 30, 34, 34),
      white: chr(31, 32, 34, 34)
    };
    /* Re-derive with the correct low-bit pair per axis. */
    function axis(xByte, yByte, lowByte, shiftX, shiftY) {
      var x = ((b[o + xByte] << 2) | ((b[o + lowByte] >> shiftX) & 3)) / 1024;
      var y = ((b[o + yByte] << 2) | ((b[o + lowByte] >> shiftY) & 3)) / 1024;
      return { x: x, y: y };
    }
    base.chromaticity = {
      red: axis(25, 26, 33, 6, 4),
      green: axis(27, 28, 33, 2, 0),
      blue: axis(29, 30, 34, 6, 4),
      white: axis(31, 32, 34, 2, 0)
    };
    base.chromaticity.whiteTempK = C.tempKFromXy(base.chromaticity.white.x, base.chromaticity.white.y);
    var srgb = C.sRGBChromaticity();
    base.chromaticity.srgbMatch = ['red', 'green', 'blue', 'white'].every(function (k) {
      return Math.abs(base.chromaticity[k].x - srgb[k].x) <= 0.002 &&
        Math.abs(base.chromaticity[k].y - srgb[k].y) <= 0.002;
    });

    /* Established timings */
    base.establishedTimings = [];
    base.establishedTimingBytes = [b[o + 35], b[o + 36], b[o + 37]];
    C.ESTABLISHED.forEach(function (e) {
      if (b[o + 35 + e[0]] & (1 << e[1])) {
        base.establishedTimings.push({
          label: e[2], width: e[3], height: e[4], refresh: e[5], interlaced: e[6],
          clockKHz: e[7], hTotal: e[8], vTotal: e[9],
          byte: 35 + e[0], bit: e[1]
        });
      }
    });
    base.manufacturerTimingBits = b[o + 37] & 0x7F;

    /* Standard timings */
    base.standardTimings = [];
    for (var i = 0; i < 8; i++) {
      var b0 = b[o + 38 + i * 2], b1 = b[o + 39 + i * 2];
      if (b0 === 0x01 && b1 === 0x01) { base.standardTimings.push({ slot: i, unused: true }); continue; }
      var width = (b0 + 31) * 8;
      var aspectCode = (b1 >> 6) & 0x03;
      var aspect = C.ASPECTS[aspectCode];
      var refresh = (b1 & 0x3F) + 60;
      var height = Math.round(width / aspect.ratio);
      base.standardTimings.push({
        slot: i, unused: false, raw: [b0, b1],
        width: width, height: height, aspectRatio: aspect.label,
        aspectCode: aspectCode, refreshRate: refresh,
        offset: 38 + i * 2
      });
    }

    /* Descriptors */
    base.descriptors = [];
    for (var d = 0; d < 4; d++) base.descriptors.push(parseDescriptor(b, o + 54 + d * 18));
    var firstDTD = base.descriptors[0];
    base.preferredTiming = (firstDTD && firstDTD.type === 'detailed') ? firstDTD : null;
    base.preferredDeclared = base.features.preferredTiming;
    base.preferredMatchesDeclaration = base.preferredDeclared === !!base.preferredTiming;

    base.monitorName = (base.descriptors.find(function (x) { return x.tag === 0xFC; }) || {}).text || null;
    base.monitorSerial = (base.descriptors.find(function (x) { return x.tag === 0xFF; }) || {}).text || null;
    base.rangeLimits = base.descriptors.find(function (x) { return x.tag === 0xFD; }) || null;

    /* Extension tags */
    base.extensionTags = [];
    base.declaredExtensionCount = base.extensionCount;
    var present = (b.length / C.BLOCK_SIZE) - 1;
    base.extensionBlocksPresent = present;
    for (var e = 1; e < base.blockCount && e * C.BLOCK_SIZE < b.length; e++) {
      var et = b[e * C.BLOCK_SIZE];
      base.extensionTags.push({ index: e, tag: et, name: C.EXT_TAGS[et] || ('Unknown 0x' + C.hex(et, 2)) });
    }

    base.raw = Array.prototype.slice.call(b, o, o + 128);
    return base;
  }

  /* -------------------------------------------------------------- top level */
  function decode(input) {
    var bytes = C.toBytes(input);
    if (!bytes) return { ok: false, error: 'The data could not be interpreted as EDID bytes or hex.' };
    if (bytes.length < 128) return { ok: false, error: 'EDID must be at least 128 bytes; received ' + bytes.length + '.' };
    if (bytes.length % 128 !== 0) return { ok: false, error: 'EDID length must be a multiple of 128 bytes; received ' + bytes.length + '.' };
    if (bytes.length > 128 * 256) return { ok: false, error: 'EDID is larger than the 32 KiB maximum.' };

    var result = {
      ok: true,
      byteLength: bytes.length,
      blockCount: bytes.length / 128,
      headerOk: C.isHeaderOk(bytes, 0),
      base: null,
      extensions: [],
      blocks: []
    };

    result.base = parseBase(bytes, 0);
    result.blocks.push({ index: 0, tag: 0x00, name: 'Base EDID Block', checksumStored: bytes[127], checksumComputed: C.makeChecksum(bytes.subarray(0, 128), 0) });

    for (var i = 1; i < result.blockCount; i++) {
      var off = i * 128;
      var tag = bytes[off];
      var ext;
      if (tag === 0x02) ext = parseCEA(bytes, off);
      else if (tag === 0x70) ext = parseDisplayID(bytes, off);
      else if (tag === 0x10) ext = parseVTB(bytes, off);
      else if (tag === 0xF0 || tag === 0xAF) ext = parseBlockMap(bytes, off);
      else ext = { tag: tag, tagName: C.EXT_TAGS[tag] || ('Unknown extension 0x' + C.hex(tag, 2)), offset: off };
      ext.index = i;
      ext.checksumStored = bytes[off + 127];
      ext.checksumComputed = C.makeChecksum(bytes.subarray(off, off + 128), 0);
      ext.checksumValid = ext.checksumStored === ext.checksumComputed;
      ext.raw = Array.prototype.slice.call(bytes, off, off + 128);
      result.extensions.push(ext);
      result.blocks.push({ index: i, tag: tag, name: ext.tagName, checksumStored: ext.checksumStored, checksumComputed: ext.checksumComputed, checksumValid: ext.checksumValid });
    }

    /* Aggregate all detailed timings, marking extension ones as not preferred. */
    result.allDetailedTimings = [];
    if (result.base.preferredTiming) result.allDetailedTimings.push(result.base.preferredTiming);
    result.base.descriptors.forEach(function (d, idx) {
      if (d.type === 'detailed' && idx > 0) result.allDetailedTimings.push(d);
    });
    result.extensions.forEach(function (e) {
      (e.detailedTimings || []).forEach(function (d) { result.allDetailedTimings.push(d); });
    });

    return result;
  }

  function decodeHexString(hex) { return decode(hex); }

  global.EDIDDecoder = {
    decode: decode,
    decodeHexString: decodeHexString,
    parseDTD: parseDTD,
    parseDescriptor: parseDescriptor,
    parseBase: parseBase
  };
})(typeof window !== 'undefined' ? window : this);
