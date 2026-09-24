/* ==========================================================================
   EDID-X-LAB — edid-validator.js
   Standards-aware structural and semantic validation of an EDID image.
   Produces errors / warnings / info messages with severities.
   ========================================================================== */
(function (global) {
  'use strict';

  var C = global.EDIDCore;
  var D = global.EDIDDecoder;

  function Report() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }
  Report.prototype.error = function (type, message, details) {
    this.errors.push({ type: type, message: message, severity: 'error', details: details || null });
  };
  Report.prototype.warn = function (type, message, details) {
    this.warnings.push({ type: type, message: message, severity: 'warning', details: details || null });
  };
  Report.prototype.note = function (type, message, details) {
    this.info.push({ type: type, message: message, severity: 'info', details: details || null });
  };

  function isPrintableAscii(s) {
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x20 || c > 0x7E) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------- validation */
  function validate(input) {
    var bytes = C.toBytes(input);
    var report = new Report();

    if (!bytes) {
      report.error('structure', 'The supplied data is neither an EDID binary nor a valid hexadecimal string.');
      return summarise(report, null);
    }
    if (bytes.length < 128) {
      report.error('structure', 'EDID must contain complete 128-byte blocks; received ' + bytes.length + ' byte(s).');
      return summarise(report, null);
    }
    if (bytes.length % 128 !== 0) {
      report.error('structure', 'Total length ' + bytes.length + ' bytes is not a multiple of 128.');
    }
    if (bytes.length > 128 * 256) {
      report.error('structure', 'EDID exceeds the 32 KiB (256 block) maximum.');
    }

    var blockCount = Math.floor(bytes.length / 128);
    report.note('structure', 'EDID structure: ' + blockCount + ' block(s), ' + bytes.length + ' bytes total');

    /* -------------------------------------------------- header + checksums */
    if (C.isHeaderOk(bytes, 0)) {
      report.note('header', 'EDID base block header is valid (00 FF FF FF FF FF FF 00)');
    } else {
      report.error('header', 'Base block header is invalid — expected 00 FF FF FF FF FF FF 00 at offset 0');
    }

    for (var i = 0; i < blockCount; i++) {
      var stored = bytes[i * 128 + 127];
      var computed = C.makeChecksum(bytes.subarray(i * 128, i * 128 + 128), 0);
      if (stored === computed) {
        report.note('checksum', (i === 0 ? 'Base block' : 'Block ' + i) + ' checksum is valid');
      } else {
        report.error('checksum', (i === 0 ? 'Base block' : 'Block ' + i) +
          ' checksum mismatch: stored 0x' + C.hex(stored, 2) + ', calculated 0x' + C.hex(computed, 2));
      }
    }

    /* ------------------------------------------------------- decode + check */
    var decoded = D.decode(bytes);
    if (!decoded.ok) {
      report.error('structure', decoded.error);
      return summarise(report, null);
    }
    var base = decoded.base;

    /* Extension count */
    if (base.extensionCount !== blockCount - 1) {
      report.error('structure', 'Extension flag says ' + base.extensionCount +
        ' extension block(s) but the file contains ' + (blockCount - 1));
    } else if (base.extensionCount > 0) {
      report.note('structure', 'Extension flag matches the ' + base.extensionCount + ' extension block(s) present');
    }

    /* ------------------------------------------------------- base identity */
    if (!base.manufacturer.valid) {
      report.error('manufacturer', 'Manufacturer ID contains non-alphabetic characters');
    } else if (base.manufacturer.vendor) {
      report.note('manufacturer', 'Manufacturer ID: ' + base.manufacturer.code + ' (' + base.manufacturer.vendor + ')');
    } else {
      report.note('manufacturer', 'Manufacturer ID: ' + base.manufacturer.code + ' (unregistered / unknown)');
      report.warn('manufacturer', 'Manufacturer ID ' + base.manufacturer.code + ' is not a registered PNP vendor identifier');
    }
    report.note('product', 'Product Code: 0x' + base.productCode);
    report.note('product', 'Serial Number: 0x' + base.serialNumber);

    /* Date */
    if (base.weekRaw > 54 && base.weekRaw !== 0xFF) {
      report.error('manufacture-date', 'Week of manufacture ' + base.weekRaw + ' is outside the valid 1–54 range');
    }
    if (base.year < 1990 || base.year > 2245) {
      report.error('manufacture-date', 'Year of manufacture ' + base.year + ' is outside the EDID range 1990–2245');
    } else if (base.weekRaw === 0) {
      report.note('manufacture-date', 'Manufacture date: year only (' + base.year + '), week not specified');
    } else {
      report.note('manufacture-date', 'Manufactured: ' + base.manufactureDate);
    }

    /* Version */
    if (base.versionMajor === 1 && (base.versionMinor === 3 || base.versionMinor === 4)) {
      report.note('version', 'EDID Version: ' + base.edidVersion);
    } else if (base.versionMajor === 1 && base.versionMinor < 3) {
      report.warn('version', 'EDID 1.' + base.versionMinor + ' is obsolete; 1.3 or 1.4 is expected for modern displays');
    } else {
      report.error('version', 'Unsupported EDID version ' + base.edidVersion + ' (expected 1.3 or 1.4)');
    }

    /* Video input */
    if (base.videoInput.digital) {
      report.note('display-params', 'Digital input interface', {
        bitDepth: C.BIT_DEPTH[base.videoInput.bitDepth] || 'undefined',
        interface: base.videoInput.interfaceName
      });
      if (base.videoInput.bitDepth === 0) {
        report.warn('display-params', 'Digital bit depth is "undefined"; 8 bits per primary is expected in practice');
      }
      if (base.videoInput.interface === 0) {
        report.warn('display-params', 'Digital interface is "undefined"; the host cannot tell DVI from HDMI or DisplayPort');
      }
      if (base.edidVersion === '1.3' && base.videoInput.interface >= 2) {
        report.warn('display-params', 'EDID 1.3 with interface "' + base.videoInput.interfaceName +
          '"; interface codes 2 and above are only defined from EDID 1.4');
      }
    } else {
      report.note('display-params', 'Analog input interface', {
        videoLevel: base.videoInput.videoLevelName,
        sync: [base.videoInput.separateSync && 'separate', base.videoInput.compositeSync && 'composite',
          base.videoInput.syncOnGreen && 'sync-on-green', base.videoInput.serratedVSync && 'serrated']
          .filter(Boolean).join(', ') || 'none signalled'
      });
      if (!base.videoInput.separateSync && !base.videoInput.compositeSync && !base.videoInput.syncOnGreen) {
        report.error('display-params', 'No analog sync type is signalled; the display cannot be driven');
      }
    }

    /* Screen size */
    if (base.screenSize.mode === 'physical') {
      if (base.screenSize.widthCm > 255 || base.screenSize.heightCm > 255) {
        report.error('screen-size', 'Screen size exceeds the 255 cm maximum encodable value');
      }
      var diag = base.screenSize.diagonalInches;
      report.note('screen-size', 'Physical size: ' + base.screenSize.widthCm + '×' + base.screenSize.heightCm +
        ' cm (' + diag.toFixed(1) + '" diagonal, ' + base.screenSize.aspectRatio.toFixed(3) + ':1)');
      if (base.screenSize.widthCm === 0 || base.screenSize.heightCm === 0) {
        report.warn('screen-size', 'Screen size reports zero in one axis');
      }
      if (base.screenSize.widthCm < base.screenSize.heightCm) {
        report.warn('screen-size', 'Reported as portrait, but EDID screen size should describe the landscape orientation');
      }
    } else if (base.screenSize.mode === 'aspect-ratio') {
      report.note('screen-size', 'Screen size not reported; an aspect ratio of ' + base.screenSize.aspectRatio.toFixed(2) + ':1 is declared instead');
    } else {
      report.note('screen-size', 'Screen size uses the landscape aspect-ratio encoding (' + base.screenSize.aspectRatio.toFixed(3) + ':1)');
    }

    /* Gamma */
    if (base.gammaDefinedInExtension) {
      report.note('gamma', 'Gamma is defined by an extension block (byte 0x17 = 0xFF)');
      var hasGammaExt = decoded.extensions.some(function (e) { return e.tag === 0x02 && e.revision >= 4; });
      if (!hasGammaExt) {
        report.warn('gamma', 'Gamma is deferred to an extension block, but no extension declares one');
      }
    } else {
      report.note('gamma', 'Gamma: ' + base.gamma.toFixed(2));
      if (base.gammaRaw === 0) {
        report.warn('gamma', 'Gamma byte is 0x00, which implies a gamma of 1.00 — usually a placeholder');
      } else if (base.gammaRaw === 0xFF) {
        report.warn('gamma', 'Gamma byte is 0xFF; use the "defined in extension" convention explicitly instead');
      } else if (base.gamma < 1.8 || base.gamma > 2.6) {
        report.warn('gamma', 'Gamma ' + base.gamma.toFixed(2) + ' is unusual for a display (1.8–2.6 expected)');
      }
    }

    /* Chromaticity */
    var keys = ['red', 'green', 'blue', 'white'];
    keys.forEach(function (k) {
      var p = base.chromaticity[k];
      if (p.x > 0.8 || p.y > 0.8) {
        report.error('color', 'Chromaticity ' + k + ' coordinates (' + p.x.toFixed(3) + ', ' + p.y.toFixed(3) +
          ') are outside the CIE 1931 gamut');
      }
    });
    if (base.chromaticity.whiteTempK) {
      report.note('color', 'White point: x=' + base.chromaticity.white.x.toFixed(3) +
        ' y=' + base.chromaticity.white.y.toFixed(3) + ' (≈' + base.chromaticity.whiteTempK + ' K)');
    }
    var allZero = keys.every(function (k) { return base.chromaticity[k].x === 0 && base.chromaticity[k].y === 0; });
    if (allZero) {
      report.warn('color', 'All chromaticity coordinates are zero; a colour-managed host may mis-detect the gamut');
    }
    if (base.features.sRGB) {
      if (base.chromaticity.srgbMatch) {
        report.note('color', 'sRGB is signalled and the chromaticity bytes match the EDID sRGB reference values');
      } else {
        report.error('color', 'sRGB is signalled, but the chromaticity bytes do not match the EDID sRGB values');
      }
    } else if (base.chromaticity.srgbMatch) {
      report.note('color', 'Chromaticity matches sRGB but the sRGB flag is not set');
    }

    /* Features */
    report.note('features', 'Feature support byte: 0x' + C.hex(base.featuresRaw, 2));
    if (!base.features.standby && !base.features.suspend && !base.features.activeOff) {
      report.warn('features', 'No power management (DPMS) states are declared');
    }
    if (base.features.preferredTiming && !base.preferredTiming) {
      report.error('descriptor', 'The preferred-timing flag is set but the first descriptor is not a detailed timing');
    }
    if (!base.features.preferredTiming && base.preferredTiming) {
      report.warn('descriptor', 'The first descriptor is a detailed timing but the preferred-timing flag is clear');
    }
    if (base.preferredTiming) {
      report.note('timing', 'Preferred timing: ' + base.preferredTiming.hActive + '×' + base.preferredTiming.vActive +
        ' @ ' + base.preferredTiming.refreshRate.toFixed(2) + ' Hz (' +
        (base.preferredTiming.pixelClockKHz / 1000).toFixed(2) + ' MHz)');
    }
    if (base.edidVersion === '1.4' && !base.features.continuousFrequency && base.rangeLimits &&
      base.rangeLimits.timingFormula === 1) {
      report.error('descriptor', 'Display Range Limits declares GTF, but the continuous-frequency/GTF feature flag is clear');
    }

    /* Established timings */
    if (base.establishedTimings.length) {
      report.note('timing', 'Established timings present: ' + base.establishedTimings.map(function (t) { return t.label; }).join(', '));
    } else {
      report.note('timing', 'No established timings are declared');
    }

    /* Standard timings */
    var used = 0;
    base.standardTimings.forEach(function (st) {
      if (st.unused) return;
      used++;
      if (st.raw[1] === 0x00 && st.raw[0] === 0x00) {
        report.warn('timing', 'Standard timing ' + (st.slot + 1) + ' uses the legacy 0x00 0x00 unused marker; 0x01 0x01 is the defined convention');
      }
      if (st.width < 256 || st.width > 2288) {
        report.error('timing', 'Standard timing ' + (st.slot + 1) + ' width ' + st.width + ' px is outside the 256–2288 range');
      }
      if (st.refreshRate < 60 || st.refreshRate > 123) {
        report.error('timing', 'Standard timing ' + (st.slot + 1) + ' refresh rate ' + st.refreshRate + ' Hz is outside the 60–123 range');
      }
    });
    /* A slot that is neither 0x01 0x01 nor a usable timing is suspicious. */
    base.standardTimings.forEach(function (st) {
      if (!st.unused) return;
      if (st.raw && (st.raw[0] !== 0x01 || st.raw[1] !== 0x01)) {
        report.note('timing', 'Standard timing ' + (st.slot + 1) + ' is unused');
      }
    });
    report.note('timing', used + ' of 8 standard timing slot(s) in use');

    /* Descriptors */
    var dummyCount = 0;
    base.descriptors.forEach(function (desc, idx) {
      var slot = idx + 1;
      if (desc.type === 'detailed') {
        checkDTD(report, desc, 'Detailed timing descriptor ' + slot);
        return;
      }
      switch (desc.kind) {
        case 'text': {
          var name = desc.tagName;
          if (desc.text.length === 0) {
            report.warn('descriptor', name + ' descriptor (slot ' + slot + ') is empty');
          } else if (!isPrintableAscii(desc.text)) {
            report.error('descriptor', name + ' contains non-printable characters');
          } else {
            report.note('descriptor', name + ' descriptor present: "' + desc.text + '"');
          }
          var trailingNonSpace = desc.trailing.some(function (b) { return b !== 0x20 && b !== 0x00; });
          if (trailingNonSpace) {
            report.error('descriptor', name + ' contains non-space data after its newline; pad with 0x20');
          } else if (!desc.terminated && desc.text.length === 13) {
            report.warn('descriptor', name + ' fills all 13 bytes, leaving no line-feed terminator');
          } else if (!desc.terminated) {
            report.warn('descriptor', name + ' is not terminated by a line feed (0x0A)');
          }
          if (desc.tag === 0xFC && desc.text && !/[\x20-\x7E]/.test(desc.text)) {
            report.warn('descriptor', 'Monitor Name is not usable as a display name');
          }
          break;
        }
        case 'range': {
          report.note('descriptor', 'Display Range Limits descriptor present: ' +
            desc.minVRate + '–' + desc.maxVRate + ' Hz vertical, ' +
            desc.minHRate + '–' + desc.maxHRate + ' kHz horizontal, up to ' +
            desc.maxPixelClock + ' MHz pixel clock, timing support: ' + desc.timingFormulaName);
          if (desc.minVRate === 0 || desc.maxVRate === 0 || desc.minHRate === 0 || desc.maxHRate === 0) {
            report.error('descriptor', 'Display Range Limits contains a zero rate field');
          }
          if (desc.minVRate > desc.maxVRate) {
            report.error('descriptor', 'Display Range Limits: minimum vertical rate ' + desc.minVRate +
              ' Hz exceeds the maximum ' + desc.maxVRate + ' Hz');
          }
          if (desc.minHRate > desc.maxHRate) {
            report.error('descriptor', 'Display Range Limits: minimum horizontal rate ' + desc.minHRate +
              ' kHz exceeds the maximum ' + desc.maxHRate + ' kHz');
          }
          if (desc.maxPixelClock === 0) {
            report.warn('descriptor', 'Display Range Limits declares a maximum pixel clock of 0 MHz');
          }
          if (desc.timingFormula === 0x00) {
            report.warn('descriptor', 'Display Range Limits uses the default GTF timing formula, which is ambiguous in EDID 1.4');
          }
          if (base.edidVersion === '1.4' && desc.timingFormula >= 0x02 &&
            !base.features.continuousFrequency) {
            report.error('descriptor', 'Display Range Limits declares ' + desc.timingFormulaName +
              ' but the continuous-frequency/GTF feature flag is clear');
          }
          /* For the "default GTF" and "range limits only" cases the last seven
             bytes carry no data and must be LF + six spaces. */
          if ((desc.timingFormula === 0x00 || desc.timingFormula === 0x01) && desc.terminator === false) {
            report.error('descriptor', 'Display Range Limits: expected line feed followed by six spaces in the unused bytes');
          }
          if (desc.cvt) {
            if (desc.cvt.preferredAspect && desc.cvt.aspectRatios.length &&
              desc.cvt.aspectRatios.indexOf(desc.cvt.preferredAspect) < 0) {
              report.error('descriptor', 'Display Range Limits: the preferred CVT aspect ratio ' +
                desc.cvt.preferredAspect + ' is not among the supported aspect ratios');
            }
            if (!desc.cvt.standardBlanking && !desc.cvt.reducedBlanking) {
              report.warn('descriptor', 'Display Range Limits: CVT declares no blanking support');
            }
            report.note('descriptor', 'CVT support: ' +
              (desc.cvt.maxActivePixelsPerLine ? 'up to ' + desc.cvt.maxActivePixelsPerLine + ' px per line, ' : '') +
              'aspect ratios ' + (desc.cvt.aspectRatios.join(', ') || 'none signalled') +
              ', preferred ' + (desc.cvt.preferredAspect || 'n/a') +
              (desc.cvt.standardBlanking ? ', standard blanking' : '') +
              (desc.cvt.reducedBlanking ? ', reduced blanking' : ''));
          }
          if (desc.gtf2) {
            report.note('descriptor', 'Secondary GTF: start frequency ' + desc.gtf2.startFrequencyKHz +
              ' kHz, C=' + desc.gtf2.c + ', M=' + desc.gtf2.m + ', K=' + desc.gtf2.k + ', J=' + desc.gtf2.j);
          }
          if (desc.maxPixelClock && base.preferredTiming &&
            base.preferredTiming.pixelClockKHz / 1000 > desc.maxPixelClock) {
            report.warn('descriptor', 'Preferred timing pixel clock ' + (base.preferredTiming.pixelClockKHz / 1000).toFixed(2) +
              ' MHz exceeds the range-limit maximum of ' + desc.maxPixelClock + ' MHz');
          }
          break;
        }
        case 'dummy':
          dummyCount++;
          report.note('descriptor', 'Dummy descriptor (slot ' + slot + ') properly formatted');
          break;
        case 'whitepoint':
          report.note('descriptor', 'Additional White Point descriptor present (slot ' + slot + ')');
          break;
        case 'std':
          report.note('descriptor', 'Additional Standard Timings descriptor present (slot ' + slot + ')');
          break;
        default:
          report.warn('descriptor', 'Descriptor ' + slot + ' has an unrecognised tag 0x' + C.hex(desc.tag, 2));
      }
    });
    if (dummyCount > 0 && dummyCount < 4) {
      report.note('descriptor', dummyCount + ' of 4 descriptor slots are unused');
    }
    if (dummyCount === 4) {
      report.error('descriptor', 'All four descriptor slots are dummy — no timing, name, or range information is present');
    }

    /* ------------------------------------------------------------ extensions */
    decoded.extensions.forEach(function (ext) {
      var label = 'Extension block ' + ext.index + ' (' + ext.tagName + ')';
      if (ext.tag === 0x02) checkCEA(report, ext, label, base);
      else if (ext.tag === 0x70) checkDisplayID(report, ext, label);
      else if (ext.tag === 0x10) report.note('extension', label + ': ' + (ext.descriptorCount || 0) + ' timing descriptor(s)');
      else if (ext.tag === 0xF0 || ext.tag === 0xAF) {
        report.note('extension', label + ': ' + ext.tags.length + ' block tag(s) defined');
        if (ext.numberOfBlocks && ext.numberOfBlocks !== decoded.blockCount) {
          report.warn('extension', label + ': block map declares ' + ext.numberOfBlocks +
            ' total blocks but the image has ' + decoded.blockCount);
        }
      } else {
        report.warn('extension', label + ': no structural checks are defined for this tag');
      }
    });

    if (base.extensionCount > 0 && decoded.extensions.length === 0) {
      report.error('extension', 'The base block declares extensions but none could be parsed');
    }

    /* A CEA extension is expected on HDMI/DisplayPort capable displays. */
    if (base.videoInput.digital && (base.videoInput.interface === 2 || base.videoInput.interface === 3 || base.videoInput.interface === 5)) {
      var hasCEA = decoded.extensions.some(function (e) { return e.tag === 0x02; });
      if (!hasCEA) {
        report.warn('extension', 'HDMI/DisplayPort input is declared but there is no CEA-861 extension block; ' +
          'many sources ignore resolution and audio capability without one');
      }
    }

    return summarise(report, decoded);
  }

  /* ---------------------------------------------------------------- DTD box */
  function checkDTD(report, d, label) {
    if (d.pixelClockKHz === 0) {
      report.error('timing', label + ': pixel clock is zero');
      return;
    }
    if (d.hActive === 0 || d.vActive === 0) {
      report.error('timing', label + ': active area is zero');
      return;
    }
    report.note('timing', label + ': ' + d.hActive + '×' + d.vActive + (d.interlaced ? 'i' : 'p') +
      ' @ ' + d.refreshRate.toFixed(2) + ' Hz, ' + (d.pixelClockKHz / 1000).toFixed(3) + ' MHz');

    if (d.hBlanking === 0) report.error('timing', label + ': horizontal blanking is zero');
    if (d.vBlanking === 0) report.error('timing', label + ': vertical blanking is zero');
    if (d.hSyncOffset + d.hSyncWidth > d.hBlanking) {
      report.error('timing', label + ': horizontal sync extends past the blanking interval (front porch ' +
        d.hSyncOffset + ' + sync ' + d.hSyncWidth + ' > blanking ' + d.hBlanking + ')');
    }
    if (d.vSyncOffset + d.vSyncWidth > d.vBlanking) {
      report.error('timing', label + ': vertical sync extends past the blanking interval (front porch ' +
        d.vSyncOffset + ' + sync ' + d.vSyncWidth + ' > blanking ' + d.vBlanking + ')');
    }
    if (d.hSyncWidth < 8) report.warn('timing', label + ': horizontal sync width ' + d.hSyncWidth + ' px is unusually small');
    if (d.vSyncWidth < 2) report.warn('timing', label + ': vertical sync width ' + d.vSyncWidth + ' lines is unusually small');
    if (d.refreshRate < 20 || d.refreshRate > 400) {
      report.warn('timing', label + ': derived refresh rate ' + d.refreshRate.toFixed(2) + ' Hz looks implausible');
    }
    if (d.hActive % 8 !== 0) {
      report.warn('timing', label + ': horizontal active ' + d.hActive + ' is not a multiple of 8');
    }
    if (d.syncType === 3 && !d.hSyncPositive && !d.vSyncPositive) {
      report.note('timing', label + ': digital separate sync with negative polarity on both axes');
    }
    return d;
  }

  /* ------------------------------------------------------------- CEA checks */
  function checkCEA(report, ext, label, base) {
    if (ext.revision >= 1 && ext.revision <= 3) {
      report.note('extension', label + ': CEA-861 revision ' + ext.revision);
    } else {
      report.warn('extension', label + ': unusual CEA-861 revision ' + ext.revision);
    }
    if (ext.dtdOffset === 0 && ext.nativeDTDCount > 0) {
      report.error('extension', label + ': native DTD count is non-zero but the DTD offset is zero');
    }
    if (ext.dtdOffset !== 0 && ext.dtdOffset < 4) {
      report.error('extension', label + ': DTD offset ' + ext.dtdOffset + ' overlaps the data block collection header');
    }
    if (ext.dtdOffset > 127) {
      report.error('extension', label + ': DTD offset ' + ext.dtdOffset + ' is outside the 128-byte block');
    }
    (ext.issues || []).forEach(function (m) { report.error('extension', label + ': ' + m); });

    if (ext.dataBlocks.length) {
      report.note('extension', label + ': ' + ext.dataBlocks.length + ' data block(s)');
    }
    ext.dataBlocks.forEach(function (b) {
      if (b.name === 'Audio Data Block') {
        if (b.length % 3 !== 0) {
          report.error('extension', label + ': audio data block length ' + b.length + ' is not a multiple of 3');
        }
        (b.audio || []).forEach(function (a) {
          if (!a.channels || a.channels > 8) {
            report.warn('extension', label + ': audio channel count ' + a.channels + ' is unusual');
          }
          if (!a.sampleRates.length) {
            report.error('extension', label + ': an audio descriptor declares no supported sample rate');
          }
          if (!a.bitDepths.length) {
            report.warn('extension', label + ': an audio descriptor declares no supported bit depth');
          }
        });
      } else if (b.name === 'Video Data Block') {
        (b.video || []).forEach(function (v) {
          if (v.outOfTable) {
            report.warn('extension', label + ': video code ' + v.code + ' is beyond the highest defined VIC (107)');
          }
        });
        if (!(b.video || []).some(function (v) { return v.native; })) {
          report.note('extension', label + ': no native video format is flagged (interpretation depends on revision)');
        }
      } else if (b.name === 'Extended Data Block' && b.hdrStatic) {
        var e = b.hdrStatic.eotf;
        var eotfs = [e.traditionalSDR && 'SDR', e.traditionalHDR && 'HDR (traditional)',
          e.smpte2084 && 'SMPTE ST 2084 (PQ)', e.hlg && 'HLG'].filter(Boolean);
        report.note('extension', label + ': HDR static metadata — EOTF support: ' + (eotfs.join(', ') || 'none signalled') +
          ', static metadata type 1: ' + (b.hdrStatic.staticMetadataType1 ? 'yes' : 'no'));
        if (!eotfs.length) {
          report.warn('extension', label + ': HDR static metadata declares no EOTF');
        }
        if (ext.revision < 3) {
          report.warn('extension', label + ': HDR static metadata requires CEA-861 revision 3 or later');
        }
      } else if (b.name === 'Extended Data Block' && b.colorimetry) {
        var cm = b.colorimetry;
        var spaces = Object.keys(cm).filter(function (k) { return cm[k]; });
        report.note('extension', label + ': colorimetry — ' + (spaces.join(', ') || 'none signalled'));
      } else if (b.name === 'Vendor Specific Data Block' && b.hdmi) {
        report.note('extension', label + ': HDMI 1.4 VSDB, physical address ' + (b.hdmi.physicalAddress || 'n/a'));
        if (!b.hdmi.physicalAddress || b.hdmi.physicalAddress === '0.0.0.0') {
          report.warn('extension', label + ': HDMI VSDB physical address is 0.0.0.0');
        }
        if (b.hdmi.maxTmdsClockMHz && base.preferredTiming &&
          base.preferredTiming.pixelClockKHz / 1000 > b.hdmi.maxTmdsClockMHz) {
          report.warn('extension', label + ': preferred timing ' + (base.preferredTiming.pixelClockKHz / 1000).toFixed(2) +
            ' MHz exceeds the HDMI VSDB TMDS clock limit of ' + b.hdmi.maxTmdsClockMHz + ' MHz');
        }
      }
    });

    (ext.detailedTimings || []).forEach(function (d, i) {
      checkDTD(report, d, 'CEA-861 descriptor ' + (i + 1));
    });
    if (ext.nativeDTDCount > (ext.detailedTimings || []).length) {
      report.error('extension', label + ': native DTD count ' + ext.nativeDTDCount +
        ' exceeds the ' + (ext.detailedTimings || []).length + ' descriptor(s) present');
    }
    if (ext.dtdOffset && (ext.detailedTimings || []).length === 0) {
      report.warn('extension', label + ': a DTD offset is set but no complete descriptor follows');
    }
  }

  /* ------------------------------------------------------- DisplayID checks */
  function checkDisplayID(report, ext, label) {
    var known = [0x12, 0x13, 0x20];
    if (known.indexOf(ext.version) < 0) {
      report.warn('extension', label + ': DisplayID version 0x' + C.hex(ext.version, 2) + ' is not recognised');
    } else {
      report.note('extension', label + ': DisplayID version 0x' + C.hex(ext.version, 2) +
        ', ' + ext.sections.length + ' section(s)');
    }
    if (ext.sectionSize > 121) {
      report.error('extension', label + ': section size ' + ext.sectionSize + ' exceeds the available block space');
    }
    ext.sections.forEach(function (s) {
      report.note('extension', label + ': ' + s.name + ' section (' + s.length + ' bytes) at offset ' + s.offset);
    });
    (ext.issues || []).forEach(function (m) { report.error('extension', label + ': ' + m); });
  }

  /* -------------------------------------------------------------- summary */
  function summarise(report, decoded) {
    var total = report.errors.length + report.warnings.length;
    var status = report.errors.length ? 'invalid' : (report.warnings.length ? 'warnings' : 'valid');
    var messages = [];
    if (status === 'valid') messages.push('All checks passed.');
    else if (status === 'warnings') messages.push(report.warnings.length + ' warning(s) found; the EDID is structurally usable.');
    else messages.push(report.errors.length + ' error(s) found; the EDID will not be handled reliably.');

    return {
      isValid: report.errors.length === 0,
      status: status,
      errors: report.errors,
      warnings: report.warnings,
      info: report.info,
      summary: {
        totalIssues: total,
        errors: report.errors.length,
        warnings: report.warnings.length,
        infoMessages: report.info.length,
        isValid: report.errors.length === 0,
        overallStatus: status
      },
      messages: messages,
      decoded: decoded
    };
  }

  global.EDIDValidator = {
    validate: validate,
    checkDTD: checkDTD
  };
})(typeof window !== 'undefined' ? window : this);
