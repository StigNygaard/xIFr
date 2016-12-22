/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

function fxifClass() {
  const SOI_MARKER = 0xFFD8; // start of image
  const SOS_MARKER = 0xFFDA; // start of stream
  const EOI_MARKER = 0xFFD9; // end of image
  const APP1_MARKER = 0xFFE1; // start of binary EXIF data
  const APP13_MARKER = 0xFFED; // start of IPTC-NAA data
  const COM_MARKER = 0xFFFE; // start of JFIF comment data

  const INTEL_BYTE_ORDER = 0x4949;

  this.gatherData = bis => {
    var dataObj = {};
    var swapbytes = false;
    var marker = bis.read16();
    var len;

    if (marker == SOI_MARKER) {
      marker = bis.read16();
      // reading SOS marker indicates start of image stream
      while (marker != SOS_MARKER &&
        (!fxifUtils.exifDone || !fxifUtils.iptcDone || !fxifUtils.xmpDone)) {
        // length includes the length bytes
        len = bis.read16() - 2;

        if (marker == APP1_MARKER && len >= 6) {
          // for EXIF the first 6 bytes should be 'Exif\0\0'
          var header = bis.readBytes(6);
          // Is it EXIF?
          if (header == 'Exif\0\0') {
            // 8 byte TIFF header
            // first two determine byte order
            var exifData = bis.readByteArray(len - 6);

            swapbytes = fxifUtils.read16(exifData, 0, false) == INTEL_BYTE_ORDER;

            // next two bytes are always 0x002A
            // offset to Image File Directory (includes the previous 8 bytes)
            var ifd_ofs = fxifUtils.read32(exifData, 4, swapbytes);
            var exifReader = new exifClass();
            try {
              exifReader.readExifDir(dataObj, exifData, ifd_ofs, swapbytes);
            } catch (ex) {
              pushError(dataObj, "EXIF", ex);
            }
            fxifUtils.exifDone = true;
          } else {
            if (len > 28) {
              // Maybe it's XMP. If it is, it starts with the XMP namespace URI
              // 'http://ns.adobe.com/xap/1.0/\0'.
              // see http://partners.adobe.com/public/developer/en/xmp/sdk/XMPspecification.pdf
              header += bis.readBytes(22); // 6 bytes read means 22 more to go
              if (header == 'http://ns.adobe.com/xap/1.0/') {
                // There is at least one programm which writes spaces behind the namespace URI.
                // Overread up to 5 bytes of such garbage until a '\0'. I deliberately don't read
                // until reaching len bytes.
                var a;
                var j = 0;
                do {
                  a = bis.readBytes(1);
                } while (++j < 5 && a == ' ');
                if (a == '\0') {
                  var xmpData = bis.readByteArray(len - (28 + j));
                  try {
                    var xmpReader = new xmpClass();
                    xmpReader.parseXML(dataObj, xmpData);
                  } catch (ex) {
                    pushError(dataObj, "XMP", ex);
                  }
                  fxifUtils.xmpDone = true;
                } else
                  bis.readBytes(len - (28 + j));
              } else
                bis.readBytes(len - 28);
            } else {
              bis.readBytes(len - 6);
            }
          }
        } else
        // Or is it IPTC-NAA record as IIM?
        if (marker == APP13_MARKER && len > 14) {
          // 6 bytes, 'Photoshop 3.0\0'
          var psString = bis.readBytes(14);
          var psData = bis.readByteArray(len - 14);
          if (psString == 'Photoshop 3.0\0') {
            var iptcReader = new iptcClass(stringBundle);
            try {
              iptcReader.readPsSection(dataObj, psData);
            } catch (ex) {
              pushError(dataObj, "IPTC", ex);
            }
            fxifUtils.iptcDone = true;
          }
        } else
        // Or perhaps a JFIF comment?
        if (marker == COM_MARKER && len >= 1) {
          dataObj.UserComment = fxifUtils.bytesToString(bis.readByteArray(len), 0, len, false, 1);
        } else {
          // read and discard data ...
          bis.readBytes(len);
        }

        marker = bis.read16();
      }
    }

    return dataObj;
  }

  function pushError(dataObj, type, message)
  {
    if (dataObj.error)
      dataObj.error += '\n';
    else
      dataObj.error = '';
    dataObj.error += stringBundle.getFormattedString("specialError", [type, type]) + ' ' + message;
  }
}

var fxifObj = new fxifClass();