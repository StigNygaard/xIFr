/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

"use strict";

/*
 *  Some utility functions for FxIF/xIFr.
 */

function fxifUtilsClass() {
  var prefInstance = null;

  this.exifDone = false;
  this.iptcDone = false;
  this.xmpDone = false;

  this.read16 = function (data, offset, swapbytes) {
    if (!swapbytes)
      return (data[offset] << 8) | data[offset + 1];

    return data[offset] | (data[offset + 1] << 8);
  };

  this.read32 = function (data, offset, swapbytes) {
    if (!swapbytes)
      return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];

    return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
  };

  /* charWidth should normally be 1 and this function thus reads
   * the bytes one by one. But reading Unicode needs reading
   * 16 Bit values.
   * Stops at the first null byte.
   */
  this.bytesToString = function (data, offset, num, swapbytes, charWidth) {
    var s = "";

    if (charWidth == 1) {
      for (let i = offset; i < offset + num; i++) {
        let charval = data[i];
        if (charval == 0)
          break;

        s += String.fromCharCode(charval);
      }
    } else {
      for (let i = offset; i < offset + num; i += 2) {
        let charval = this.read16(data, i, swapbytes);
        if (charval == 0)
          break;

        s += String.fromCharCode(charval);
      }
    }

    return s;
  };

  /* Doesn’t stop at null bytes. */
  this.bytesToStringWithNull = function (data, offset, num) {
    var s = "";

    for (var i = offset; i < offset + num; i++)
      s += String.fromCharCode(data[i]);

    return s;
  };

  this.dd2dms = function (gpsval) {
    // a bit unconventional calculation to get input edge cases
    // like 0x31 / 0x01, 0x0a / 0x01, 0x3c / 0x01 to 49°11'0" instead of 49°10'60"
    var gpsDeg = Math.floor(gpsval / 3600);
    gpsval -= gpsDeg * 3600.0;
    var gpsMin = Math.floor(gpsval / 60);
    // round to 2 digits after the comma
    var gpsSec = (gpsval - gpsMin * 60.0).toFixed(2);
    return new Array(gpsDeg, gpsMin, gpsSec);
  };

  this.dd2dm = function (gpsval) {
    // a bit unconventional calculation to get input edge cases
    // like 0x31 / 0x01, 0x0a / 0x01, 0x3c / 0x01 to 49°11'0" instead of 49°10'60"
    var gpsDeg = Math.floor(gpsval / 3600);
    gpsval -= gpsDeg * 3600.0;
    // round to 2 digits after the comma
    var gpsMin = (gpsval / 60).toFixed(4);
    return new Array(gpsDeg, gpsMin);
  };

  this.dd2dd = function (gpsval) {
    // round to 6 digits after the comma
    var gpsArr = new Array();
    gpsArr.push((gpsval / 3600).toFixed(6));
    return gpsArr;
  };

  this.getPreferences = function () {
    // console.log("getPreferences");
  };

  // Retrieves the language which is likely to be the users favourite one.
  // Currently we end up using only the first language code.
  this.getLang = function () {
    return browser.i18n.getUILanguage();
  }
}

var fxifUtils = new fxifUtilsClass();
