/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

if (browser.menus?.getTargetElement) { // An easy way to use Firefox extended API while preserving Chrome (and older Firefox) compatibility.
  browser.contextMenus = browser.menus;
}
context.log(" *** xIFr backgroundscript has (re)started! *** ");

function createPopup(request, {popupPos, winvp}) { // Called when 'EXIFready'

  // context.info("window.screen.width: " + window.screen.width + " (" + window.screen.width + ")");
  // context.info("window.screen.availWidth: " + window.screen.availWidth);
  // context.info("window.screen.height: " + window.screen.height);
  // context.info("window.screen.availHeight: " + window.screen.availHeight);
  // context.info("browser.windows.Window.width: " + winvp.width);
  // context.info("browser.windows.Window.height: " + winvp.height);
  // context.info("browser.windows.Window.top: " + winvp.top);
  // context.info("browser.windows.Window.left: " + winvp.left);

  let pos = {};
  const width = 650;
  const height = 500;
  switch (popupPos) {
    case "center":
      pos = {
        left: Math.floor(window.screen.availWidth / 2) - 325,
        top: Math.floor(window.screen.availHeight / 2) - 250
      };
      break;
    case "centerBrowser":
      pos = {left: winvp.left + Math.floor(winvp.width / 2) - 325, top: winvp.top + Math.floor(winvp.height / 2) - 250};
      break;
    case "topLeft":
      pos = {left: 10, top: 10};
      break;
    case "topRight":
      pos = {left: window.screen.availWidth - 650 - 10, top: 10};
      break;
    case "topLeftBrowser":
      pos = {left: winvp.left + 10, top: winvp.top + 10};
      break;
    case "topRightBrowser":
      pos = {left: winvp.left + winvp.width - 650 - 10, top: winvp.top + 10};
      break;
    case "leftish":
      pos = {left: Math.max(winvp.left - 200, 10), top: Math.max(winvp.top + Math.floor(winvp.height / 2) - 350, 10)};
      break;
    case "rightish":
      pos = {
        left: Math.min(winvp.left + winvp.width - 450, window.screen.availWidth - 650 - 10),
        top: Math.max(winvp.top + Math.floor(winvp.height / 2) - 350, 10)
      };
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
    }, pos))
    .then((popwin) => {
        sessionStorage.set("previous", {"winId": popwin.id, "imgURL": request.properties.URL});
      }
    );
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "viewexif") {
    context.debug("Context menu clicked. mediaType=" + info.mediaType);
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/OnClickData
    if ((info.mediaType && info.mediaType === "image" && info.srcUrl) || info.targetElementId) {

      // console.log(' *** tab.id: ' + tab.id + ' *** ');
      // console.log(' *** tab.status: ' + tab.status + ' *** ');
      // console.log(' *** tab.title: ' + tab.title + ' *** ');
      // console.log(' *** tab.url: ' + tab.url + ' *** ');
      // console.log(' *** info.frameId: ' + info.frameId + ' *** ');
      // console.log(' *** info.srcUrl: ' + info.srcUrl + ' *** ');
      // console.log(' *** info.frameUrl: ' + info.frameUrl + ' *** ');
      // console.log(' *** info.targetElementId: ' + info.targetElementId + ' *** ');

      const scripts = [
        "lib/mozilla/browser-polyfill.js",
        "context.js",
        "stringBundle.js",
        "fxifUtils.js",
        "binExif.js",
        "binIptc.js",
        "xmp.js",
        "parseJpeg.js",
        "contentscript.js"
      ];

      if (browser.scripting?.executeScript) {
        // *** FOR FUTURE USE... - Firefox MV2 or Firefox+Chromium MV3 compatible ***
        // TODO: Working, but requires "scripting" (or "activeTab") added to manifest permissions!
        const scriptsInjecting = browser.scripting.executeScript({
          target: {
            tabId: tab.id,
            frameIds: [info.frameId] // For a "flat" webpage, frameId is typically 0.
          },
          files: scripts,
          injectImmediately: true
        });
        Promise.all([context.getOptions(), browser.windows.getCurrent(), scriptsInjecting])
          .then((values) => {
              context.debug("All scripts started from background is ready...");
              const options = values[0];
              const winpop = {"winvp": values[1], "popupPos": options.popupPos};
              if (!values[2].length || !values[2][0].result) {
                console.error('There was an error loading contentscripts: ' + JSON.stringify(values[2]));
                // TODO: throw?
              }
            sessionStorage.set("winpop", winpop)
              .then(
                () => {
                  browser.tabs.sendMessage(
                    tab.id,
                    {
                      message: "parseImage",
                      imageURL: info.srcUrl,
                      mediaType: info.mediaType,
                      targetId: info.targetElementId,
                      supportsDeepSearch: !!(info.targetElementId && info.modifiers),  // "deep-search" supported in Firefox 63+
                      deepSearchBigger: info.modifiers && info.modifiers.includes("Shift"),
                      deepSearchBiggerLimit: options.deepSearchBiggerLimit,
                      frameId: info.frameId, // related to globalThis/window/frames ?
                      frameUrl: info.frameUrl
                    }
                  );
                }
              )
              .catch((err) => {
                console.error(`sessionStorage or sendMessage(parseImage) error: ${err}`);
              });
            }
          )
          .catch((err) => {
            console.error(`Failed getting data or injecting scripts: ${err}`);
          });
      } else {
        // *** DEPRECATED BUT STILL USED SO FAR - Firefox+Chromium MV2 compatible ***
        // TODO: Replace this with above use of new Scripting API
        const scriptsInjecting = scripts.map(script => {
          return browser.tabs.executeScript(null, {
            frameId: info.frameId,
            file: script
          });
        });
        Promise.all([context.getOptions(), browser.windows.getCurrent(), ...scriptsInjecting]).then(
          (values) => {
            context.debug("All scripts started from background is ready...");
            const options = values[0];
            const winpop = {"winvp": values[1], "popupPos": options.popupPos};
            sessionStorage.set("winpop", winpop)
              .then(
                () => {
                  browser.tabs.sendMessage(tab.id, {
                    message: "parseImage",
                    imageURL: info.srcUrl,
                    mediaType: info.mediaType,
                    targetId: info.targetElementId,
                    supportsDeepSearch: !!(info.targetElementId && info.modifiers),  // "deep-search" supported in Firefox 63+
                    deepSearchBigger: info.modifiers && info.modifiers.includes("Shift"),
                    deepSearchBiggerLimit: options.deepSearchBiggerLimit,
                    frameId: info.frameId, // related to globalThis/window/frames ?
                    frameUrl: info.frameUrl
                  });
                }
              );
          }
        );
      }

    }
  }
});

browser.runtime.onMessage.addListener((request) => {
  if (request.message === "EXIFready") { // 1st msg, create popup
    const popupData = {};
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
    sessionStorage.set("popupData", popupData).then(() => {
      sessionStorage.get()
        .then(({previous, winpop}) => {
          if (previous?.imgURL && previous.imgURL === request.properties.URL) {
            context.debug("Previous popup was same - Focus to previous if still open...");
            browser.windows.update(previous.winId, {focused: true})
              .then(() => {
                  context.debug("Existing popup was attempted REfocused.")
                }
              )
              .catch(() => {
                  context.debug("REfocusing didn't succeed. Creating a new popup...");
                  createPopup(request, winpop)
                }
              );
          } else {
            if (previous?.winId) { // But it would be smarter to just re-use an existing popup than to close previous and open a new?
              browser.windows.remove(previous.winId)
                .then(() => {
                  context.debug("Popup with id=" + previous.winId + " was closed.")
                })
                .catch((err) => {
                  context.debug("Closing xIFr popup with id=" + previous.winId + " failed: " + err)
                });
            }
            createPopup(request, winpop);
          }
        });
    });
  } else if (request.message === "popupReady") { // 2nd msg, populate popup
    return sessionStorage.get("popupData");
  }
});

function createMenuItem() {
  // TODO: Remove multiple call to this when possible.
  //  But for now, run on both onInstalled and onStartup events, because:
  //  https://bugzilla.mozilla.org/show_bug.cgi?id=1771328,
  //  https://bugzilla.mozilla.org/show_bug.cgi?id=1817287,
  //  https://discourse.mozilla.org/t/strange-mv3-behaviour-browser-runtime-oninstalled-event-and-menus-create/111208/11
  browser.contextMenus.create({
    id: "viewexif",
    title: browser.i18n.getMessage("contextMenuText"),
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/ContextType
    contexts: browser.contextMenus.getTargetElement ? ["image", "link", "page", "frame", "editable", "video", "audio"] : ["image"] // Firefox 63+ supports getTargetElement()/targetElementId
  });
}

// https://extensionworkshop.com/documentation/develop/onboard-upboard-offboard-users/
browser.runtime.onInstalled.addListener(
  function handleInstalled({reason, temporary, previousVersion}) {
    // context.info("Reason: " + reason + ". Temporary: " + temporary + ". previousVersion: " + previousVersion);

    createMenuItem();

    // if (details.temporary) return; // Skip during development
    switch (reason) {
      case "update": // "upboarding"
        break; // silent update
      case "install": // "onboarding"
        browser.tabs.create({url: "onboard/onboard.html"});
        break;
    }

  }
);


/* Using a "sessionStorage" to persist the state even when background-script is terminated and restarted... */
/* (Build on-top of context.setOptions() and context.getOptions() from context.js...)                       */
let sessionStorage = (function () {
  let sessionData; // When background-script is restarted sessionData will be (declared but) of undefined value
  function clear() {
    sessionData = {}; // Make sessionData (defined as) empty
    context.getOptions().then(
      function (options) {
        options.sessionstorage = sessionData;
        context.setOptions(options); // Persist the cleared sessionData
      }
    );
  }
  function set(property, value) {
    return context.getOptions().then(
      function (options) {
        sessionData = options.sessionstorage || {};
        sessionData[property] = value;
        options.sessionstorage = sessionData;
        return context.setOptions(options); // Persist updated sessionData
      }
    );
  }
  function get(property) {
    if (sessionData) {
      return Promise.resolve(property ? sessionData[property] : sessionData); // Get "in memory" sessionData
    }
    return context.getOptions().then(
      function (options) {
        sessionData = options.sessionstorage || {}; // Update "in memory" sessionData from persisted
        return property ? sessionData[property] : sessionData; // return sessionData
      }
    );
  }
  return {
    clear: clear,
    set: set,
    get: get
  }
})();

browser.runtime.onStartup.addListener(() => {
  sessionStorage.clear(); // Clear any old "sessionStorage" when browser starts...
  createMenuItem(); // Try re-define menuitem because of Firefox bug https://bugzilla.mozilla.org/show_bug.cgi?id=1817287
});
