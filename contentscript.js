/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

function addByteStreamIF(arr) {
  arr.bisOffset = 0;
  arr.read16 = () => {
    var val = arr[arr.bisOffset] << 8 | arr[arr.bisOffset + 1];
    arr.bisOffset += 2;
    return val;
  };
  arr.readBytes = byteCount => {
    var retval = "";
    for (var i = 0; i < byteCount; i++) {
      retval += String.fromCharCode(arr[arr.bisOffset]);
      arr.bisOffset++;
    }
    return retval;
  };
  arr.readByteArray = len => {
    var retval = arr.subarray(arr.bisOffset, arr.bisOffset + len);
    arr.bisOffset += len;
    return retval;
  }
}

function translateFields(data) {
  var newdata = {};
  Object.keys(data).forEach(key_v => {
    var key = key_v;
    var val = data[key_v];
    if (typeof key == "string") {
      key = stringBundle.getString(key);
    }
    if (typeof val == "string") {
      val = stringBundle.getString(val);
    }
    newdata[key] = val;
  });

  return newdata;
}

if (typeof contentListenerAdded === 'undefined') {
  browser.runtime.onMessage.addListener(request => {
    if (request.message == "parseImage" &&
      typeof request.imageURL !== 'undefined') {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", request.imageURL, true);
      xhr.responseType = "arraybuffer";
      xhr.addEventListener("load", () => {
        var arrayBuffer = xhr.response;
        if (arrayBuffer) {
          var byteArray = new Uint8Array(arrayBuffer);
          addByteStreamIF(byteArray);
          var dataObj = fxifObj.gatherData(byteArray);
          xlatData = translateFields(dataObj);
          browser.runtime.sendMessage({
            message: "EXIFready",
            data: xlatData
          });
        }
      });

      xhr.addEventListener("error", () => {
        console.log("wxIF xhr error:" + xhr.statusText);
      });

      xhr.send();
    }
  });
}

var contentListenerAdded = true;
