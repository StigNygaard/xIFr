/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

/*
 *  Interpreter for binary EXIF data.
 */

function exifClass() {
  var fxifUtils = new fxifUtilsClass();
  var loopDetectorArray = new Array();

  // data formats
  const FMT_BYTE       = 1;
  const FMT_STRING     = 2;
  const FMT_USHORT     = 3;
  const FMT_ULONG      = 4;
  const FMT_URATIONAL  = 5;
  const FMT_SBYTE      = 6;
  const FMT_UNDEFINED  = 7;
  const FMT_SSHORT     = 8;
  const FMT_SLONG      = 9;
  const FMT_SRATIONAL  = 10;
  const FMT_SINGLE     = 11;
  const FMT_DOUBLE     = 12;

  // EXIF tags
  const TAG_DESCRIPTION        = 0x010E;
  const TAG_MAKE               = 0x010F;
  const TAG_MODEL              = 0x0110;
  const TAG_ORIENTATION        = 0x0112;
  const TAG_SOFTWARE           = 0x0131;
  const TAG_DATETIME           = 0x0132;
  const TAG_ARTIST             = 0x013B;
  const TAG_THUMBNAIL_OFFSET   = 0x0201;
  const TAG_THUMBNAIL_LENGTH   = 0x0202;
  const TAG_COPYRIGHT          = 0x8298;
  const TAG_EXPOSURETIME       = 0x829A;
  const TAG_FNUMBER            = 0x829D;
  const TAG_EXIF_OFFSET        = 0x8769;
  const TAG_EXPOSURE_PROGRAM   = 0x8822;
  const TAG_GPSINFO            = 0x8825;
  const TAG_ISO_EQUIVALENT     = 0x8827;
  const TAG_DATETIME_ORIGINAL  = 0x9003;
  const TAG_DATETIME_DIGITIZED = 0x9004;
  const TAG_SHUTTERSPEED       = 0x9201;
  const TAG_APERTURE           = 0x9202;
  const TAG_EXPOSURE_BIAS      = 0x9204;
  const TAG_MAXAPERTURE        = 0x9205;
  const TAG_SUBJECT_DISTANCE   = 0x9206;
  const TAG_METERING_MODE      = 0x9207;
  const TAG_LIGHT_SOURCE       = 0x9208;
  const TAG_FLASH              = 0x9209;
  const TAG_FOCALLENGTH        = 0x920A;
  const TAG_MAKER_NOTE         = 0x927C;
  const TAG_USERCOMMENT        = 0x9286;
  const TAG_EXIF_IMAGEWIDTH    = 0xa002;
  const TAG_EXIF_IMAGELENGTH   = 0xa003;
  const TAG_INTEROP_OFFSET     = 0xa005;
  const TAG_FOCALPLANEXRES     = 0xa20E;
  const TAG_FOCALPLANEUNITS    = 0xa210;
  const TAG_EXPOSURE_INDEX     = 0xa215;
  const TAG_EXPOSURE_MODE      = 0xa402;
  const TAG_WHITEBALANCE       = 0xa403;
  const TAG_DIGITALZOOMRATIO   = 0xa404;
  const TAG_FOCALLENGTH_35MM   = 0xa405;
  const TAG_LENS               = 0xfdea;
  const TAG_LENSINFO           = 0xa432;
  const TAG_LENSMAKE           = 0xa433;
  const TAG_LENSMODEL          = 0xa434;
  const TAG_COLORSPACE         = 0xa001;
  const TAG_INTEROPINDEX       = 0x0001;

  const TAG_GPS_LAT_REF    = 0x0001;
  const TAG_GPS_LAT        = 0x0002;
  const TAG_GPS_LON_REF    = 0x0003;
  const TAG_GPS_LON        = 0x0004;
  const TAG_GPS_ALT_REF    = 0x0005;
  const TAG_GPS_ALT        = 0x0006;
  const TAG_GPS_IMG_DIR_REF      = 0x0010;
  const TAG_GPS_IMG_DIR      = 0x0011;

  var BytesPerFormat = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

  // Decodes arrays carrying UTF-8 sequences into Unicode strings.
  // It also validates sequences and throws an error if it encounters
  // invalid encodings.
  function utf8BytesToString(utf8data, offset, num) // NOTICE, this is different from equally named in binIptc.js!!!
  {
    var s = "";
    var c = c1 = c2 = 0;

    for (var i = offset; i < offset + num; ) {
      c = utf8data[i];
      if (c <= 127) {
        if (c !== 0)
          s += String.fromCharCode(c);
        i++;
      } else if ((c >= 194) && (c <= 223)) {
        c2 = utf8data[i + 1];
        if (c2 >> 6 !== 2)
          throw "No valid UTF8-Sequence";
        s += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
        i += 2;
      } else if ((c >= 224) && (c <= 239)) {
        c2 = utf8data[i + 1];
        if (c2 >> 6 !== 2)
          throw "No valid UTF8-Sequence";
        c3 = utf8data[i + 2];
        if (c3 >> 6 !== 2)
          throw "No valid UTF8-Sequence";
        s += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
        i += 3;
      } else if ((c >= 240) && (c <= 244)) {
        c2 = utf8data[i + 1];
        if (c2 >> 6 !== 2)
          throw "No valid UTF8-Sequence";
        c3 = utf8data[i + 2];
        if (c3 >> 6 !== 2)
          throw "No valid UTF8-Sequence";
        c4 = utf8data[i + 3];
        if (c4 >> 6 !== 2)
          throw "No valid UTF8-Sequence";
        s += String.fromCharCode(((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63));
        i += 4;
      } else {
        throw "No valid UTF8-Sequence";
      }
    }

    return s;
  }

  // Checks if the loopDetectorArray already contains an entry
  // which would mean we did already jump there once.
  function checkForLoop(val) {
    for (var i = 0; i < loopDetectorArray.length; i++) {
      if (loopDetectorArray[i] == val)
        return true;
    }

    return false;
  }

  function dir_entry_addr(start, entry) {
    return start + 2 + entry * 12;
  }

  function ConvertAnyFormat(data, format, offset, components, numbytes, swapbytes, charWidth) {
    // centralised check if the data lays within the data array
    if (offset + numbytes > data.length) {
      console.error("Data outside array.");
      // throw "Data outside array.";
      return;
    }

    var value = 0;

    switch (format) {
      case FMT_STRING:
        // try decoding strings as UTF-8, if it fails, handle them 1:1.
        try {
          if (charWidth === 1) // don’t try handling Unicode strings as UTF-8
            value = utf8BytesToString(data, offset, numbytes);
          else
            value = fxifUtils.bytesToString(data, offset, numbytes, swapbytes, charWidth);
        } catch (e) {
          console.error("catch");
          value = fxifUtils.bytesToString(data, offset, numbytes, swapbytes, charWidth);
        }
        // strip trailing whitespace
        value = value.replace(/\s+$/, '');
        break;

      case FMT_UNDEFINED: // treat as string
        value = fxifUtils.bytesToString(data, offset, numbytes, swapbytes, charWidth);
        // strip trailing whitespace
        value = value.replace(/\s+$/, '');
        break;

      case FMT_SBYTE:
        value = data[offset];
        break;
      case FMT_BYTE:
        value = data[offset];
        break;

      case FMT_USHORT:
        value = fxifUtils.read16(data, offset, swapbytes);
        break;
      case FMT_ULONG:
        value = fxifUtils.read32(data, offset, swapbytes);
        break;

      case FMT_URATIONAL:
      case FMT_SRATIONAL: {
        // It sometimes happens that there are multiple rationals contained.
        // So go for multiple here and convert back later.
        var values = new Array();

        for (var i = 0; i < components; i++) {
          var Num, Den;
          Num = fxifUtils.read32(data, offset + i * 8, swapbytes);
          Den = fxifUtils.read32(data, offset + i * 8 + 4, swapbytes);
          if (Den === 0) {
            values[i] = 0;
          } else {
            values[i] = Num / Den;
          }
        }

        if (components === 1)
          value = values[0];
        else
          value = values;
        break;
      }

      case FMT_SSHORT:
        value = fxifUtils.read16(data, offset, swapbytes);
        break;
      case FMT_SLONG:
        value = fxifUtils.read32(data, offset, swapbytes);
        break;

        // ignore, probably never used
      case FMT_SINGLE:
        value = 0;
        break;
      case FMT_DOUBLE:
        value = 0;
        break;
    }

    return value;
  }

  function readGPSDir(dataObj, data, dirStart, swapbytes) {
    var numEntries = fxifUtils.read16(data, dirStart, swapbytes);
    // check if all entries lay within the data array
    if (dirStart + 2 + numEntries * 12 > data.length)
    // so something is wrong – limit numEntries or bail out?
    // let’s try with limiting it
      numEntries = Math.floor((data.length - (dirStart + 2)) / (numEntries * 12));
    var gpsLatHemisphere = 'N',
        gpsLonHemisphere = 'E',
        gpsAltReference = 0,
        gpsImgDirReference = 'M';
    var vals = new Array();

    for (var i = 0; i < numEntries; i++) {
      var entry = dir_entry_addr(dirStart, i);
      var tag = fxifUtils.read16(data, entry, swapbytes);
      var format = fxifUtils.read16(data, entry + 2, swapbytes);
      var components = fxifUtils.read32(data, entry + 4, swapbytes);

      if (format >= BytesPerFormat.length)
        continue;

      var nbytes = components * BytesPerFormat[format];
      var valueoffset;

      if (nbytes <= 4) // stored in the entry
        valueoffset = entry + 8;
      else
        valueoffset = fxifUtils.read32(data, entry + 8, swapbytes);

      //      try
      //      {
      let val = ConvertAnyFormat(data, format, valueoffset, components, nbytes, swapbytes, 1);
      // If ConvertAnyFormat() encounters that data lies
      // outside of the data array, it returns undefined.
      // We don’t want to assign this but to try again with
      // the next tag.
      if (val === undefined)
        continue;

      switch (tag) {
        case TAG_GPS_LAT_REF:
          gpsLatHemisphere = val;
          break;

        case TAG_GPS_LON_REF:
          gpsLonHemisphere = val;
          break;

        case TAG_GPS_ALT_REF:
          gpsAltReference = val;
          break;

        case TAG_GPS_IMG_DIR_REF:
          gpsImgDirReference = val;
          break;

        case TAG_GPS_LAT:
        case TAG_GPS_LON:
          // data is saved as three 64bit rationals -> 24 bytes
          // so we've to do another two ConvertAnyFormat() ourself
          // e.g. 0x0b / 0x01, 0x07 / 0x01, 0x011c4d / 0x0c92
          // but can also be only 0x31 / 0x01, 0x3d8ba / 0x2710, 0x0 / 0x01
          var gpsval = val[0] * 3600 + val[1] * 60 + val[2];
          //        var gpsval = val * 3600;
          //        gpsval += ConvertAnyFormat(data, format, valueoffset+8, nbytes, swapbytes) * 60;
          //        gpsval += ConvertAnyFormat(data, format, valueoffset+16, nbytes, swapbytes);
          vals[tag] = gpsval;
          break;

        case TAG_GPS_ALT:
          vals[tag] = val;
          break;

        case TAG_GPS_IMG_DIR:
          vals[tag] = val;
          break;

        default:
          break;
      }
      //      } catch(e){}
      // so something is wrong – bail out or step over this value?
      // let’s try with just stepping over this value
    }

    // use dms format by default
    var degFormat = "dms";
    var degFormatter = fxifUtils.dd2dms;
    try {
      // 0 = DMS, 1 = DD, 2 = DM
      if (fxifUtils.getPreferences().getIntPref("gpsFormat") == 1) {
        // but dd if the user wants that
        degFormat = "dd";
        degFormatter = fxifUtils.dd2dd;
      } else if (fxifUtils.getPreferences().getIntPref("gpsFormat") == 2) {
        // but dd if the user wants that
        degFormat = "dm";
        degFormatter = fxifUtils.dd2dm;
      }
    } catch (e) {}
    // now output all existing values
    if (vals[TAG_GPS_LAT] !== undefined) {
      let gpsArr = degFormatter(vals[TAG_GPS_LAT]);
      gpsArr.push(gpsLatHemisphere);
      dataObj.GPSLat = stringBundle.getFormattedString("latlon" + degFormat, gpsArr);
    }
    if (vals[TAG_GPS_LON] !== undefined) {
      let gpsArr = degFormatter(vals[TAG_GPS_LON]);
      gpsArr.push(gpsLonHemisphere);
      dataObj.GPSLon = stringBundle.getFormattedString("latlon" + degFormat, gpsArr);
    }
    if (vals[TAG_GPS_ALT] !== undefined) {
      dataObj.GPSAlt = stringBundle.getFormattedString("meters", [vals[TAG_GPS_ALT] * (gpsAltReference ? -1.0 : 1.0)]);
    }
    if (vals[TAG_GPS_IMG_DIR] !== undefined && (gpsImgDirReference === 'M' || gpsImgDirReference === 'T')) {
      dataObj.GPSImgDir = stringBundle.getFormattedString("dir" + gpsImgDirReference, [vals[TAG_GPS_IMG_DIR]]);
    }
    // Get the straight decimal values without rounding.
    // For creating links to map services.
    if (vals[TAG_GPS_LAT] !== undefined &&
        vals[TAG_GPS_LON] !== undefined) {
      dataObj.GPSPureDdLat = vals[TAG_GPS_LAT] / 3600 * (gpsLatHemisphere === 'N' ? 1.0 : -1.0);
      dataObj.GPSPureDdLon = vals[TAG_GPS_LON] / 3600 * (gpsLonHemisphere === 'E' ? 1.0 : -1.0);
    }
  }

  /* Reads the Canon Tags IFD.
  EOS60D_YIMG_0007.JPG
  0x927c at pos 0x22a
  Type undef (7)
  Components 0x1e2c
  Offset 0x0382
  Real MN-Offset: 0x038e

   */
  /* CanonExifDir (MakerNotes) are always in Intel (little endian) byte order,
   * so always do swapbytes.
   */
  function readCanonExifDir(dataObj, data, dirStart, makerNotesLen) {
    // Canon EXIF tags
    const TAG_CAMERA_INFO        = 0x000d;
    const TAG_LENS_MODEL         = 0x0095;
    const TAG_CANON_MODEL_ID     = 0x0010;

    var ntags = 0;
    // Canon MakerNotes are always in Intel (little endian) byte order
    var swapbytes = true;
    var numEntries = fxifUtils.read16(data, dirStart, swapbytes);
    // check if all entries lay within the data array
    if (dirStart + 2 + numEntries * 12 > data.length)
    // so something is wrong – limit numEntries or bail out?
    // let’s try with limiting it
      numEntries = Math.floor((data.length - (dirStart + 2)) / (numEntries * 12));

    var entryOffset = FixCanonMakerNotesBase(data, dirStart, makerNotesLen);

    for (var i = 0; i < numEntries; i++) {
      var entry = dir_entry_addr(dirStart, i);
      var tag = fxifUtils.read16(data, entry, swapbytes);
      var format = fxifUtils.read16(data, entry + 2, swapbytes);
      var components = fxifUtils.read32(data, entry + 4, swapbytes);

      if (format >= BytesPerFormat.length)
        continue;

      var nbytes = components * BytesPerFormat[format];
      var valueoffset;
      if (nbytes <= 4) {
        // stored in the entry
        valueoffset = entry + 8;
      } else {
        // stored in data area
        valueoffset = fxifUtils.read32(data, entry + 8, swapbytes) + entryOffset;
      }

      let val = ConvertAnyFormat(data, format, valueoffset, components, nbytes, swapbytes, 1);
      // If ConvertAnyFormat() encounters that data lies
      // outside of the data array, it returns undefined.
      // We don’t want to assign this but to try again with
      // the next tag.
      if (val === undefined)
        continue;

      ntags++;
      switch (tag) {
        case TAG_CAMERA_INFO:
          dataObj.CameraInfo = val;
          break;
        case TAG_CANON_MODEL_ID:
          dataObj.ModelID = val;
          break;
        case TAG_LENS_MODEL:
          dataObj.Lens = val;
          break;
        default:
          ntags--;
      }
    }

    /* List of Canon Model IDs
    0x80000001 = EOS-1D
    0x80000167 = EOS-1DS
    0x80000168 = EOS 10D
    0x80000169 = EOS-1D Mark III
    0x80000170 = EOS Digital Rebel / 300D / Kiss Digital
    0x80000174 = EOS-1D Mark II
    0x80000175 = EOS 20D
    0x80000176 = EOS Digital Rebel XSi / 450D / Kiss X2
    0x80000188 = EOS-1Ds Mark II
    0x80000189 = EOS Digital Rebel XT / 350D / Kiss Digital N
    0x80000190 = EOS 40D
    0x80000213 = EOS 5D
    0x80000215 = EOS-1Ds Mark III
    0x80000218 = EOS 5D Mark II
    0x80000232 = EOS-1D Mark II N
    0x80000234 = EOS 30D
    0x80000236 = EOS Digital Rebel XTi / 400D / Kiss Digital X
    0x80000250 = EOS 7D
    0x80000252 = EOS Rebel T1i / 500D / Kiss X3
    0x80000254 = EOS Rebel XS / 1000D / Kiss F
    0x80000261 = EOS 50D
    0x80000270 = EOS Rebel T2i / 550D / Kiss X4
    0x80000281 = EOS-1D Mark IV
    0x80000287 = EOS 60D
     */

    return ntags;
  }

  // This functions code is derived from Phil Harveys Image::ExifTool::MakerNotes FixBase()
  function FixCanonMakerNotesBase(data, dirStart, makerNotesLen) {
    var swapbytes = true;
    var fix = 0;

    if (makerNotesLen > 8) {
      var footerPtr = dirStart + makerNotesLen - 8;
      var footer = fxifUtils.bytesToStringWithNull(data, footerPtr, 8);
      if (footer.search(/^(II\x2a\0|MM\0\x2a)/) !== -1) // check for TIFF footer
      //          footer.substr(0, 2) == GetByteOrder()) # validate byte ordering
      {
        var offsetFromFooter = ConvertAnyFormat(data, FMT_ULONG, footerPtr + 4, 0, 0, swapbytes, 1);
        fix = dirStart - offsetFromFooter;
        if (fix === 0)
          return 0;
        // Picasa and ACDSee have a bug where they update other offsets without
        // updating the TIFF footer (PH - 2009/02/25), so test for this case:
        // validate Canon maker note footer fix by checking offset of last value
        //        var maxPt = $valPtrs[-1] + $$valBlock{$valPtrs[-1]};
        // compare to end of maker notes, taking 8-byte footer into account
        //Autumn1.jpg
        //dirStart: 4814, dirLen: 4876, maxPt: 5526, dataPos: 0
        //        var endDiff = footerPtr - (maxPt - dataPos);
        // ignore footer offset only if end difference is exactly correct
        // (allow for possible padding byte, although I have never seen this)
        /*        if (endDiff == 0 || endDiff == 1) {
        alert('Canon maker note footer may be invalid (ignored)');
        //          $exifTool->Warn('Canon maker note footer may be invalid (ignored)', 1);
        return 0;
        }
         */
      }
    }

    return fix;
  }

  /*
  D3S_141805.jpg
  0x927c at pos 0x24b
  Type undef (7)
  Components 0x8612
  Offset 0x0337
  Real MN-Offset: 0x0356

   */

  /* Offsets to Nikon Maker Notes point to the five bytes "Nikon" followed
  by a null. This is followed by two bytes denoting the Exif Version as
  text, e.g. 0x0210, followed by two null.
  Then (after the above 0x0a bytes) a normal TIFF header follows with an IFD
  and all the data. The data in this block is has its own byte order which
  might be different from the one in the rest of the Exif header as denoted
  in this TIFF header (which typically is Motorola byte order for Nikon).
   */
  function readNikonExifDir(dataObj, data, dirStart, swapbytes) {
    // Is it really Nikon?
    if (header === 'Nikon\0') {
      // step over next four bytes denoting the version (e.g. 0x02100000)
      // 8 byte TIFF header
      var exifData = bis.readByteArray(len - 6);

      // first two determine byte order
      swapbytes = fxifUtils.read16(exifData, 0, false) === INTEL_BYTE_ORDER;

      // next two bytes are always 0x002A
      // offset to Image File Directory (includes the previous 8 bytes)
      var ifd_ofs = fxifUtils.read32(exifData, 4, swapbytes);
      var exifReader = new exifClass(stringBundle);
      try {
        exifReader.readExifDir(dataObj, exifData, ifd_ofs, swapbytes);
      } catch (ex) {
        pushError(dataObj, "EXIF", ex);
      }
      fxifUtils.exifDone = true;
    }
  }

  /* Reads the actual EXIF tags.
  Also extracts tags for textual informations like
  By, Caption, Headline, Copyright.
  But doesn't overwrite those fields when already populated
  by IPTC-NAA or IPTC4XMP.
   */
  this.readExifDir = function (dataObj, data, dirStart, swapbytes) {
    loopDetectorArray.push(dirStart);

    var ntags = 0;
    var numEntries = fxifUtils.read16(data, dirStart, swapbytes);
    // check if all entries lay within the data array
    var tst = dirStart + 2 + numEntries * 12;
    if (dirStart + 2 + numEntries * 12 > data.length) {
      // so something is wrong – limit numEntries or bail out?
      // let’s try with limiting it
      numEntries = Math.floor((data.length - (dirStart + 2)) / (numEntries * 12));
    }

    var interopIndex = "";
    var colorSpace = 0;
    var exifDateTime = 0;
    var exifDateTimeOrig = 0;
    var lensInfo;
    for (var i = 0; i < numEntries; i++) {
      var entry = dir_entry_addr(dirStart, i);
      var tag = fxifUtils.read16(data, entry, swapbytes);

      var format = fxifUtils.read16(data, entry + 2, swapbytes);
      var components = fxifUtils.read32(data, entry + 4, swapbytes);

      if (format >= BytesPerFormat.length)
        continue;

      var nbytes = components * BytesPerFormat[format];
      var valueoffset;

      if (nbytes <= 4) {
        // stored in the entry
        valueoffset = entry + 8;
      } else {
        // stored in data area
        valueoffset = fxifUtils.read32(data, entry + 8, swapbytes);
      }

      let val = ConvertAnyFormat(data, format, valueoffset, components, nbytes, swapbytes, 1);
      // If ConvertAnyFormat() encounters that data lies
      // outside of the data array, it returns undefined.
      // We don’t want to assign this but to try again with
      // the next tag.
      if (val === undefined)
        continue;

      ntags++;
      switch (tag) {
        case TAG_MAKE:
          dataObj.Make = val;
          break;

        case TAG_MODEL:
          dataObj.Model = val;
          break;

        case TAG_SOFTWARE:
          dataObj.Software = val;
          break;

        case TAG_DATETIME_ORIGINAL:
          exifDateTimeOrig = val;
          break;

        case TAG_DATETIME_DIGITIZED:
        case TAG_DATETIME:
          exifDateTime = val;
          break;

        case TAG_USERCOMMENT:
          var charWidth = 1;
          if (val.search(/^UNICODE\s*/) >= 0) {
            charWidth = 2;
          }
          // strip leading character code string
          var ccStringLen = 0;
          if (nbytes >= 8) {
            ccStringLen = 8;
          }
          dataObj.UserComment = ConvertAnyFormat(data, format, valueoffset + ccStringLen, components, nbytes - ccStringLen, swapbytes, charWidth);
          break;

        case TAG_FNUMBER:
          dataObj.ApertureFNumber = "ƒ/" + parseFloat(val).toFixed(1);
          break;

          // only use these if we don't have the previous
        case TAG_APERTURE:
          if (!dataObj.ApertureFNumber) {
            dataObj.ApertureFNumber = "ƒ/" + Math.exp((parseFloat(val) * Math.LN2 * 0.5)).toFixed(1);
          }
          break;

          // only use these if we don't have the previous
        case TAG_MAXAPERTURE:
          if (!dataObj.ApertureFNumber) {
            dataObj.ApertureFNumber = "ƒ/" + Math.exp((parseFloat(val) * Math.LN2 * 0.5)).toFixed(1);
          }
          break;

        case TAG_FOCALLENGTH:
          dataObj.FocalLength = parseFloat(val);
          break;

        case TAG_SUBJECT_DISTANCE:
          if (val < 0) {
            dataObj.Distance = stringBundle.getString("infinite");
          } else {
            dataObj.Distance = stringBundle.getFormattedString("meters", [val]);
          }
          break;

        case TAG_EXPOSURETIME:
          var et = "";
          val = parseFloat(val);
          if (val < 0.010) {
            et = stringBundle.getFormattedString("seconds", [val.toFixed(4)]);
          } else {
            et = stringBundle.getFormattedString("seconds", [val.toFixed(3)]);
          }
          if (val <= 0.5) {
            et += " (1/" + Math.floor(0.5 + 1 / val).toFixed(0) + ")";
          }
          dataObj.ExposureTime = et;
          break;

        case TAG_SHUTTERSPEED:
          if (!dataObj.ExposureTime) {
            dataObj.ExposureTime = stringBundle.getFormattedString("seconds", [(1.0 / Math.exp(parseFloat(val) * Math.log(2))).toFixed(4)]);
          }
          break;

        case TAG_FLASH:
          // Bit 0 indicates the flash firing status,
          // bits 1 and 2 indicate the flash return status,
          // bits 3 and 4 indicate the flash mode,
          // bit 5 indicates whether the flash function is present,
          // bit 6 indicates "red eye" mode.
          if (val >= 0) {
            var fu;
            var addfunc = new Array();
            if (val & 0x01) {
              fu = stringBundle.getString("yes");

              if (val & 0x18 === 0x18)
                addfunc.push(stringBundle.getString("auto"));
              else if (val & 0x8)
                addfunc.push(stringBundle.getString("enforced"));

              if (val & 0x40)
                addfunc.push(stringBundle.getString("redeye"));

              if (val & 0x06 === 0x06)
                addfunc.push(stringBundle.getString("returnlight"));
              else if (val & 0x04)
                addfunc.push(stringBundle.getString("noreturnlight"));
            } else {
              fu = stringBundle.getString("no");

              if (val & 0x20)
                addfunc.push(stringBundle.getString("noflash"));
              else if (val & 0x18 === 0x18)
                addfunc.push(stringBundle.getString("auto"));
              else if (val & 0x10)
                addfunc.push(stringBundle.getString("enforced"));
            }

            if (addfunc.length)
              fu += " (" + addfunc.join(", ") + ")";

            dataObj.FlashUsed = fu;
          }
          break;

        case TAG_ORIENTATION:
          if (!dataObj.Orientation && val > 0) {
            if (val <= 8)
              dataObj.Orientation = stringBundle.getString("orientation" + val);
            else
              dataObj.Orientation = stringBundle.getString("unknown") + " (" + val + ")";
          }
          break;
          /*
          case TAG_EXIF_IMAGELENGTH:
          dataObj.Length = val;
          break;

          case TAG_EXIF_IMAGEWIDTH:
          dataObj.Width = val;
          break;
           */
        case TAG_FOCALPLANEXRES:
          dataObj.FocalPlaneXRes = val;
          break;

        case TAG_FOCALPLANEUNITS:
          switch (val) {
            case 1:
              dataObj.FocalPlaneUnits = 25.4;
              break; // inch
            case 2:
              // According to the information I was using, 2 means meters.
              // But looking at the Cannon powershot's files, inches is the only
              // sensible value.
              dataObj.FocalPlaneUnits = 25.4;
              break;

            case 3:
              dataObj.FocalPlaneUnits = 10;
              break; // centimeter
            case 4:
              dataObj.FocalPlaneUnits = 1;
              break; // millimeter
            case 5:
              dataObj.FocalPlaneUnits = .001;
              break; // micrometer
          }
          break;

        case TAG_EXPOSURE_BIAS:
          val = parseFloat(val);
          if (val === 0)
            dataObj.ExposureBias = stringBundle.getString("none");
          else
          // add a + sign before positive values
            dataObj.ExposureBias = (val > 0 ? '+' : '') + stringBundle.getFormattedString("ev", [val.toFixed(2)]);
          break;

        case TAG_WHITEBALANCE:
          switch (val) {
            case 0:
              dataObj.WhiteBalance = stringBundle.getString("auto");
              break;
            case 1:
              dataObj.WhiteBalance = stringBundle.getString("manual");
              break;
          }
          break;

        case TAG_LIGHT_SOURCE:
          switch (val) {
            case 1:
              dataObj.LightSource = stringBundle.getString("daylight");
              break;
            case 2:
              dataObj.LightSource = stringBundle.getString("fluorescent");
              break;
            case 3:
              dataObj.LightSource = stringBundle.getString("incandescent");
              break;
            case 4:
              dataObj.LightSource = stringBundle.getString("flash");
              break;
            case 9:
              dataObj.LightSource = stringBundle.getString("fineweather");
              break;
            case 10:
              dataObj.LightSource = stringBundle.getString("cloudy");
              break;
            case 11:
              dataObj.LightSource = stringBundle.getString("shade");
              break;
            case 12:
              dataObj.LightSource = stringBundle.getString("daylightfluorescent");
              break;
            case 13:
              dataObj.LightSource = stringBundle.getString("daywhitefluorescent");
              break;
            case 14:
              dataObj.LightSource = stringBundle.getString("coolwhitefluorescent");
              break;
            case 15:
              dataObj.LightSource = stringBundle.getString("whitefluorescent");
              break;
            case 24:
              dataObj.LightSource = stringBundle.getString("studiotungsten");
              break;
            default: //Quercus: 17-1-2004 There are many more modes for this, check Exif2.2 specs
              // If it just says 'unknown' or we don't know it, then
              // don't bother showing it - it doesn't add any useful information.
          }
          break;

        case TAG_METERING_MODE:
          switch (val) {
            case 0:
              dataObj.MeteringMode = stringBundle.getString("unknown");
              break;
            case 1:
              dataObj.MeteringMode = stringBundle.getString("average");
              break;
            case 2:
              dataObj.MeteringMode = stringBundle.getString("centerweight");
              break;
            case 3:
              dataObj.MeteringMode = stringBundle.getString("spot");
              break;
            case 4:
              dataObj.MeteringMode = stringBundle.getString("multispot");
              break;
            case 5:
              dataObj.MeteringMode = stringBundle.getString("matrix");
              break;
            case 6:
              dataObj.MeteringMode = stringBundle.getString("partial");
              break;
          }
          break;

        case TAG_EXPOSURE_PROGRAM:
          switch (val) {
            case 1:
              dataObj.ExposureProgram = stringBundle.getString("manual");
              break;
            case 2:
              dataObj.ExposureProgram = stringBundle.getString("program") + " ("
                  + stringBundle.getString("auto") + ")";
              break;
            case 3:
              dataObj.ExposureProgram = stringBundle.getString("apriority")
                  + " (" + stringBundle.getString("semiauto") + ")";
              break;
            case 4:
              dataObj.ExposureProgram = stringBundle.getString("spriority")
                  + " (" + stringBundle.getString("semiauto") + ")";
              break;
            case 5:
              dataObj.ExposureProgram = stringBundle.getString("creative");
              break;
            case 6:
              dataObj.ExposureProgram = stringBundle.getString("action");
              break;
            case 7:
              dataObj.ExposureProgram = stringBundle.getString("portrait");
              break;
            case 8:
              dataObj.ExposureProgram = stringBundle.getString("landscape");
              break;
            default:
              break;
          }
          break;

        case TAG_EXPOSURE_INDEX:
          if (!dataObj.ExposureIndex) {
            try {
              // I know of at least one image where this information
              // is present as string instead of number.
              dataObj.ExposureIndex = val.toFixed(0);
            } catch (e) {
              let tmp = parseInt(val);
              if (!isNaN(tmp))
                dataObj.ExposureIndex = tmp;
            }
          }
          break;

        case TAG_EXPOSURE_MODE:
          switch (val) {
            case 0: //Automatic
              break;
            case 1:
              dataObj.ExposureMode = stringBundle.getString("manual");
              break;
            case 2:
              dataObj.ExposureMode = stringBundle.getString("autobracketing");
              break;
          }
          break;

        case TAG_ISO_EQUIVALENT:
          try {
            // I know of at least one image where this information
            // is present as string instead of number.
            dataObj.ISOequivalent = val.toFixed(0);
          } catch (e) {
            let tmp = parseInt(val);
            if (!isNaN(tmp))
              dataObj.ISOequivalent = tmp;
          }
          break;

        case TAG_DIGITALZOOMRATIO:
          if (val > 1) {
            dataObj.DigitalZoomRatio = val.toFixed(3) + "x";
          }
          break;

        case TAG_THUMBNAIL_OFFSET:
          break;

        case TAG_THUMBNAIL_LENGTH:
          break;

        case TAG_FOCALLENGTH_35MM:
          dataObj.FocalLength35mmEquiv = val;
          break;

        case TAG_LENSINFO:
          lensInfo = val;
          break;

        case TAG_LENSMAKE:
          dataObj.LensMake = val;
          break;

        case TAG_LENSMODEL:
          dataObj.LensModel = val;
          break;

        case TAG_EXIF_OFFSET:
        case TAG_INTEROP_OFFSET:
          // Prevent loops, where we directly or indirectly point to an EXIF directory where
          // we've already been. It has happened that we recursed thousands of times because
          // this tag pointed to its own start.
          if (!checkForLoop(val)) {
            // check if it jumps at least to the beginning of actual data
            // and at most on the last byte of the array
            if (val >= 8 && val < data.length)
              ntags += this.readExifDir(dataObj, data, val, swapbytes);
          }
          break;

        case TAG_GPSINFO:
          // check if jumps at least at the beginning of actual data
          // and at most on the last byte of the array
          if (val >= 8 && val < data.length)
            readGPSDir(dataObj, data, val, swapbytes);
          break;

        case TAG_ARTIST:
          if (!dataObj.Creator)
            dataObj.Creator = val;
          break;

        case TAG_COPYRIGHT:
          if (!dataObj.Copyright)
            dataObj.Copyright = val;
          break;

        case TAG_DESCRIPTION:
          if (!dataObj.Caption)
            dataObj.Caption = val;
          break;

        case TAG_COLORSPACE:
          if (!dataObj.ColorSpace) {
            if (val == 1)
              dataObj.ColorSpace = "sRGB";
            else
              colorSpace = val;
          }
          break;

        case TAG_MAKER_NOTE:
          // Currently only Canon MakerNotes are supported, so filter for this
          // maker.
          if (dataObj.Make === 'Canon') {
            // This tags format is often given as undefined or zero with
            // some weird numbers or zeros as components. This makes the
            // code before this switch to generate strange offsets.
            // Therefore use value at entry + 8 directly.
            // This should work in any case and really does for the available test images.
            let mval = ConvertAnyFormat(data, FMT_ULONG, entry + 8, 0, 0, swapbytes, 1);
            var dirLen = ConvertAnyFormat(data, FMT_ULONG, entry + 4, 0, 0, swapbytes, 1);

            // check if it jumps at least at the beginning of the actual
            // data and at most on the last byte of the array
            if (mval >= 8 && mval + dirLen < data.length)
              ntags += readCanonExifDir(dataObj, data, mval, dirLen);
          }
          break;

        case TAG_INTEROPINDEX:
          interopIndex = val;
          break;

        default:
          ntags--;
      }
    }

    // Now we can be sure to have read all data. So fill
    // some properties which depend on more than one field
    // or a field by various fields ordered by priority.

    if (!dataObj.Date) {
      if (exifDateTimeOrig)
        dataObj.Date = exifDateTimeOrig;
      else if (exifDateTime)
        dataObj.Date = exifDateTime;

      if (dataObj.Date)
        dataObj.Date = dataObj.Date.replace(/:(\d{2}):/, "-$1-") + " " + stringBundle.getString("noTZ");
    }

    if (colorSpace != 0) {
      if (dataObj.ColorSpace == 2 ||
          dataObj.ColorSpace == 65535 && interopIndex.search(/^R03$/))
        dataObj.ColorSpace = "Adobe RGB";
    }

    if (dataObj.FocalLength) {
      dataObj.FocalLength = parseFloat(dataObj.FocalLength);
      var fl = stringBundle.getFormattedString("millimeters", [dataObj.FocalLength.toFixed(1)]);
      if (dataObj.FocalLength35mmEquiv) {
        dataObj.FocalLength35mmEquiv = parseFloat(dataObj.FocalLength35mmEquiv);
        fl += " " + stringBundle.getFormattedString("35mmequiv", [dataObj.FocalLength35mmEquiv.toFixed(0)]);
      }

      dataObj.FocalLengthText = fl;
    }

    if (dataObj.LensMake) {
      dataObj.Lens = dataObj.LensMake;
    }

    if (!dataObj.Lens) {
      if (dataObj.LensModel) {
        if (dataObj.Lens)
          dataObj.Lens += " ";
        else
          dataObj.Lens = "";

        dataObj.Lens += dataObj.LensModel;
      } else
      // 4 rationals giving focal and aperture ranges
      if (lensInfo) {
        if (dataObj.Lens)
          dataObj.Lens += " ";
        else
          dataObj.Lens = "";

        dataObj.Lens += lensInfo[0];
        if (lensInfo[1] > 0)
          dataObj.Lens += "-" + lensInfo[1];
        dataObj.Lens += "mm";

        if (lensInfo[2] > 0) {
          dataObj.Lens += " ƒ/" + lensInfo[2];
          if (lensInfo[3] > 0)
            dataObj.Lens += "-" + lensInfo[3];
        }
      }
    }

    return ntags;
  }
}
