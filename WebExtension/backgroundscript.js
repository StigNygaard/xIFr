/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

let options = {};
let win = {};
let previous = {};
let popupData = {};
if (browser.menus?.getTargetElement) { // An easy way to use Firefox extended API while preserving Chrome (and older Firefox) compatibility.
  browser.contextMenus = browser.menus;
}

function createPopup(request) {

  context.info("window.screen.width: " + window.screen.width);
  context.info("window.screen.availWidth: " + window.screen.availWidth);
  context.info("window.screen.height: " + window.screen.height);
  context.info("window.screen.availHeight: " + window.screen.availHeight);
  context.info("browser.windows.Window.width: " + win.width);
  context.info("browser.windows.Window.height: " + win.height);
  context.info("browser.windows.Window.top: " + win.top);
  context.info("browser.windows.Window.left: " + win.left);
  let pos = {};
  let width = 650;
  let height = 500;
  switch (options["popupPos"]) {
    case "center":
      pos = {left: Math.floor(window.screen.availWidth/2) - 325, top: Math.floor(window.screen.availHeight/2) - 250};
      break;
    case "centerBrowser":
      pos = {left: win.left + Math.floor(win.width/2) - 325, top: win.top + Math.floor(win.height/2) - 250};
      break;
    case "topLeft":
      pos = {left: 10, top: 10};
      break;
    case "topRight":
      pos = {left: window.screen.availWidth - 650 - 10, top: 10};
      break;
    case "topLeftBrowser":
      pos = {left: win.left + 10, top: win.top + 10};
      break;
    case "topRightBrowser":
      pos = {left: win.left + win.width - 650 - 10 , top: win.top + 10};
      break;
    case "leftish":
      pos = {left: Math.max(win.left - 200, 10), top: Math.max(win.top + Math.floor(win.height/2) - 350, 10)};
      break;
    case "rightish":
      pos = {left: Math.min(win.left + win.width - 450, window.screen.availWidth - 650 - 10), top: Math.max(win.top + Math.floor(win.height/2) - 350, 10)};
      break;
    case "snapLeft":
      pos = {left: 0, top: 0, height: window.screen.availHeight};
      break;
    case "snapRight":
      pos = {left: window.screen.availWidth - width, top: 0, height: window.screen.availHeight};
      break;
  }
  browser.windows.create(Object.assign(
    {
      url: browser.runtime.getURL("/popup/popup.html"),
      type: "popup",
      width: width,
      height: height
    }, pos)).then(win => {
    previous.winId = win.id;
    previous.imgURL = request.data.URL;
    if (options["popupPos"] !== "defaultPos" && context.isFirefox()) {  // https://bugzilla.mozilla.org/show_bug.cgi?id=1271047
      browser.windows.update(win.id, pos);
    }
  });
}

browser.contextMenus.create({ // Can I somehow prevent it on about: and AMO pages?
  id: "viewexif",
  title: browser.i18n.getMessage("contextMenuText"),
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/ContextType
  contexts: browser.contextMenus.getTargetElement ? ["image", "link", "page", "frame", "editable", "video", "audio"] : ["image"] // Firefox 63+ supports getTargetElement()/targetElementId
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "viewexif") {
    context.debug("Context menu clicked. mediaType=" + info.mediaType);

    // todo: Sidebar option!? But it would require some refactoring to be an alternative to popups...

    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/OnClickData
    if ((info.mediaType && info.mediaType === "image" && info.srcUrl) || info.targetElementId) {

      var scripts = [
        "/lib/mozilla/browser-polyfill.js",
        "/context.js",
        "/stringBundle.js",
        "/contentscript.js",
        "/fxifUtils.js",
        "/parseJpeg.js",
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
      Promise.all([context.getOptions(), browser.windows.getCurrent(), ...scriptLoadPromises]).then((values) => {
        context.debug("All scripts started from background is ready...");
        options = values[0];
        win = values[1];
        browser.tabs.sendMessage(tab.id, {
          message: "parseImage",
          imageURL: info.srcUrl,
          mediaType: info.mediaType,
          targetId: info.targetElementId,
          supportsDeepSearch: !!(info.targetElementId && info.modifiers),  // "deep-search" supported in Firefox 63+
          deepSearchBigger: info.modifiers && info.modifiers.includes("Shift"),
          deepSearchBiggerLimit: options["deepSearchBiggerLimit"],
          frameId : info.frameId, // related to globalThis/window/frames ?
          frameUrl : info.frameUrl
        });
      });

    }
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "EXIFready") { // 1st msg, create popup
    popupData.infos = request.infos;
    popupData.warnings = request.warnings;
    popupData.errors = request.errors;
    popupData.properties = request.properties;
    if (Object.keys(request.data).length === 0) {
      popupData.infos.push(browser.i18n.getMessage("noEXIFdata"));
    }
    if (popupData.properties.URL && popupData.properties.URL.startsWith('file:') && context.isFirefox()) {
      popupData.warnings.push("Images from file system might not be shown in this popup, but meta data should still be correctly read.");
    }
    popupData.data = request.data;

    if (previous.imgURL && previous.imgURL === request.properties.URL) {
      context.debug("Previous popup was same - Focus to previous if still open...");
      browser.windows.update(previous.winId, {focused: true}).then(() => {context.debug("Existing popup was attempted REfocused.")}).catch(() => {context.debug("REfocusing didn't succeed. Creating a new popup..."); createPopup(request)});
    } else {
      if (previous.winId) {
        browser.windows.remove(previous.winId)
          .then(() => {context.debug("Popup with id=" + previous.winId + " was closed.")})
          .catch((err) => {context.debug("Closing xIFr popup with id=" + previous.winId + " failed: " + err)});
      }
      createPopup(request);
    }
  } else if (request.message === "popupReady") { // 2nd msg, populate popup
    return Promise.resolve(popupData); // WAS: sendResponse(popupData);  // but sendResponse() is deprecated
  }
});

// https://extensionworkshop.com/documentation/develop/onboard-upboard-offboard-users/
function handleInstalled({ reason, temporary, previousVersion }) {
  // context.info("Reason: " + reason + ". Temporary: " + temporary + ". previousVersion: " + previousVersion);
  // if (details.temporary) return; // Skip during development
  switch (reason) {
    case "install": // "onboarding"
      browser.tabs.create({ url: "onboard/onboard.html"});
      break;
    case "update": // "upboarding"
      browser.tabs.create({ url: "onboard/onboard.html"});
      break;
  }
}
browser.runtime.onInstalled.addListener(handleInstalled);
