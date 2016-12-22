/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

browser.contextMenus.create({
  id: "viewexif",
  title: browser.i18n.getMessage("contextMenuText"),
  contexts: ["image"],
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "viewexif") {
    if (info.mediaType !== "image") {
      return;
    }

    if (info.srcUrl) {
      var scripts = [
        "/stringBundle.js",
        "/contentscript.js",
        "/parseJpeg.js",
        "/fxifUtils.js",
        "/binExif.js",
        "/binIptc.js",
        "/xmp.js"
      ];

      var promiseArray = scripts.map(script => {
        return browser.tabs.executeScript(null, {
          file: script
        });
      })

      Promise.all(promiseArray);

      browser.tabs.sendMessage(tab.id, {
        message: "parseImage",
        imageURL: info.srcUrl
      });
    }
  }
});

var popupData;

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message == "EXIFready") {
    if (Object.keys(request.data).length == 0) {
      popupData = {
        "": browser.i18n.getMessage("noEXIFdata")
      }
    } else {
      popupData = request.data;
    }
    var popupURL = browser.extension.getURL("/popup/popup.html");
    browser.windows.create({
      url: popupURL,
      type: "popup",
      width: 400,
      height: 550
    });
  } else if (request.message == "popupready") {
    sendResponse(popupData);
  }
});