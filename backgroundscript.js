/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

let previous = {};
let popupData = {};
if (browser.menus && browser.menus.getTargetElement) { // A bit dirty? But an easy way to use Firefox extended API while preserving Chrome (an older Firefox) compatibility.
  browser.contextMenus = browser.menus;
}

function createPopup(request) {
  browser.windows.create({
    url: browser.extension.getURL("/popup/popup.html"),
    type: "popup",
    width: 650, // Should maybe depend on screen(/browser) size (screen.width?)
    height: 500, // Should maybe depend on screen(/browser) size (screen.height?)
    left: 10,
    top: 10
  }).then(win => {
    previous.winId = win.id;
    previous.imgURL = request.data.URL;
    // Todo: Positioning popup options!
    // browser.windows.update(win.id, {
    //   left: 10, // https://bugzilla.mozilla.org/show_bug.cgi?id=1271047
    //   top: 10
    // });
  });
}

browser.contextMenus.create({ // Can I prevent it on about: pages?
  id: "viewexif",
  title: browser.i18n.getMessage("contextMenuText"),
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/ContextType
  contexts: browser.menus && browser.menus.getTargetElement ? ["editable", "frame", "image", "link", "page", "video", "audio"] : ["image"] // Firefox 63+ supports getTargetElement()/targetElementId  // include "video" & "audio" ?
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "viewexif") {
    console.debug("Context menu clicked. mediaType=" + info.mediaType);
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/OnClickData
    if ((info.mediaType && info.mediaType === "image" && info.srcUrl) || info.targetElementId) {
      var scripts = [
        "/lib/mozilla/browser-polyfill.js",
        "/stringBundle.js",
        "/contentscript.js",
        "/parseJpeg.js",
        "/fxifUtils.js",
        "/binExif.js",
        "/binIptc.js",
        "/xmp.js"
      ];

      var scriptLoadPromises = scripts.map(script => {
        return browser.tabs.executeScript(null, {
          frameId : info.frameId,
          file: script
        });
      });

      Promise.all(scriptLoadPromises).then(() => {
        console.debug("All scripts started from background is ready...");
        browser.tabs.sendMessage(tab.id, {
          message: "parseImage",
          imageURL: info.srcUrl,
          mediaType: info.mediaType,
          targetId: info.targetElementId,
          supportsDeepSearch: !!(info.targetElementId && info.modifiers),  // "deep-search" supported in Firefox 63+
          deepSearch: info.modifiers && info.modifiers.includes("Shift"),
          frameId : info.frameId, // related to globalThis/window/frames ?
          frameUrl : info.frameUrl
        });
      });
    }
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "EXIFready") { // 1st, create popup
    popupData.infos = request.infos;
    popupData.warnings = request.warnings;
    popupData.errors = request.errors;
    popupData.properties = request.properties;
    if (Object.keys(request.data).length === 0) {
      popupData.infos.push(browser.i18n.getMessage("noEXIFdata"));
    }
    popupData.data = request.data;

    if (previous.imgURL && previous.imgURL === request.properties.URL) {
      console.debug("Previous popup was same - Focus to previous if still open...");
      browser.windows.update(previous.winId, {focused: true}).then(() => {console.debug("Existing popup was attempted REfocused.")}).catch(() => {console.debug("REfocusing didn't succeed. Creating a new popup..."); createPopup(request)});
    } else {
      if (previous.winId) {
        browser.windows.remove(previous.winId);
      }
      createPopup(request);
    }

  } else if (request.message === "popupReady") { // 2nd, populate popup
    sendResponse(popupData);
  }
});
