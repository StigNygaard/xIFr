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

browser.runtime.onInstalled.addListener(
  function handleInstalled({reason, temporary, previousVersion}) {
    context.getOptions().then(
      function (options) {
        createMenuItem(!options.devDisableDeepSearch && browser.contextMenus.getTargetElement);
      });
    switch (reason) {
      case "update": // "upboarding"
        // browser.tabs.create({url: "boarding/upboard.html?previousVersion=" + previousVersion});
        break;
      case "install": // "onboarding"
        browser.tabs.create({url: "boarding/onboard.html?initialOnboard=1"});
        break;
    }
  }
);

browser.runtime.onStartup.addListener(() => {
  sessionStorage.clear() // Clear any old "sessionStorage" when browser starts... (https://bugzilla.mozilla.org/show_bug.cgi?id=1687778)
    .then (function() {
      context.getOptions().then(
        function (options) {
          createMenuItem(!options.devDisableDeepSearch && browser.contextMenus.getTargetElement); // Try re-define menuitem because of Firefox bug https://bugzilla.mozilla.org/show_bug.cgi?id=1817287
          if (options?.initialOnboard === '1') {
            browser.extension.isAllowedIncognitoAccess().then(
              function (allowsPrivate) {
                if (allowsPrivate && context.isFirefox()) {
                  // Re-show onboarding if risk of was force-closed first time (https://bugzilla.mozilla.org/show_bug.cgi?id=1558336)
                  browser.tabs.create({url: "boarding/onboard.html?initialOnboard=2"}); // show second time
                } else {
                  context.setOption('initialOnboard', 3); // second time not needed
                }
              }
            )
          }
        }
      )
    });
});

// Attempt to fix missing menu-item right after an install where support for use in Private mode was enabled.
// Probably https://bugzilla.mozilla.org/show_bug.cgi?id=1771328
context.getOptions().then(
  function (options) {
    createMenuItem(!options.devDisableDeepSearch && browser.contextMenus.getTargetElement);
  }
);

// MV2. browserAction.onClicked used with "browser_action":{} in manifest.json...
// https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/browserAction/onClicked
browser.browserAction.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});
browser.browserAction.setTitle({ title: "Open Options-page" });

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
        // TODO: Vil browser.windows.getCurrent() virke med MV3 background service worker?
        //  (https://developer.chrome.com/docs/extensions/migrating/to-service-workers/)
        //  (But: https://stackoverflow.com/questions/73778202/using-window-globals-in-manifestv3-service-worker-background-script)
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
                        supportsDeepSearch: !!info.targetElementId,  // "deep-search" supported in Firefox 63+
                        goDeepSearch: !!info.targetElementId && !options.devDisableDeepSearch,
                        supportsDeepSearchModifier: !!info.modifiers,
                        deepSearchBigger: info.modifiers && info.modifiers.includes("Shift"),
                        deepSearchBiggerLimit: options.deepSearchBiggerLimit,
                        fetchMode : options.devFetchMode,
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
                    supportsDeepSearch: !!info.targetElementId,  // "deep-search" supported in Firefox 63+
                    goDeepSearch: !!info.targetElementId && !options.devDisableDeepSearch,
                    supportsDeepSearchModifier: !!info.modifiers,
                    deepSearchBigger: info.modifiers && info.modifiers.includes("Shift"),
                    deepSearchBiggerLimit: options.deepSearchBiggerLimit,                    fetchMode : options.devFetchMode,
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

browser.runtime.onMessage.addListener(
  function messageHandler(message, sender, sendResponse) {

    if (message.message === "fetchdata") {

      const result = {};
      const url = new URL(message.href); // image.src
      const fetchOptions = message.fetchOptions;
      fetchOptions.credentials = 'omit'; // Recommended by Mozilla
      fetchOptions.cache = 'no-cache'; // Recommended by Mozilla
      const fetchTimeout = 8000; // 8 seconds
      if (AbortSignal?.timeout) {
        fetchOptions.signal = AbortSignal.timeout(fetchTimeout);
      }
      fetch(url.href, fetchOptions)
        .then(
          function(response) {
            if (response.ok) { // 200ish
              result.byteLength = response.headers.get('Content-Length') || '';
              result.contentType = response.headers.get('Content-Type') || ''; // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
              result.lastModified = response.headers.get('Last-Modified') || '';
              return response.arrayBuffer(); // Promise<ArrayBuffer>
            } else {
              console.error('Network response was not ok.');
              throw new Error('Network response was not ok.');
            }
          }
        )
        .then(
          function(arrayBuffer) {
            if (arrayBuffer) {
              context.debug("Looking at the fetch response (arrayBuffer)...");
              context.info("headers.byteLength: " + result.byteLength);
              context.info("arraybuffer.byteLength: " + arrayBuffer.byteLength);

              result.byteArray = new Uint8Array(arrayBuffer);
              result.byteLength = arrayBuffer.byteLength || result.byteLength; // TODO: I guess these ain't both header values...
            }

            // It's on purpose we use sendResponse() here. Makes it easier to work with Chrome it seems...
            // https://developer.chrome.com/docs/extensions/reference/runtime/#example-content-msg
            // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#addlistener_syntax

            sendResponse(result);
          }
        )
        .catch(
          function(error) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
              context.error("xIFr: Abort - likely timeout - when reading image-data from " + url);
              result.error = "Abort - likely timeout - when load image-file for parsing.";
            } else {
              context.error("xIFr: fetch-ERROR trying to read image-data from " + url + " : " + error);
              result.error = "Error trying to load image-file for parsing of the metadata!";
              result.info = "Possible work-around for error: Try opening image directly from above link, and open xIFr again directly from the displayed image";
            }
            // context.debug("xIFr: fetch-ERROR Event.lengthComputable:" + error.lengthComputable);
            result.byteLength = '';
            result.contentType = '';
            result.lastModified = '';
            sendResponse(result);
          }
        );
      return true; // Important to tell the browser that we will use the sendResponse argument (in async above) after this listener (messageHandler) has returned

    } else if (message.message === "EXIFready") { // 1st msg, create popup

      const popupData = {};
      popupData.infos = message.infos;
      popupData.warnings = message.warnings;
      popupData.errors = message.errors;
      popupData.properties = message.properties;
      if (Object.keys(message.data).length === 0) {
        popupData.infos.push(browser.i18n.getMessage("noEXIFdata"));
      }
      if (popupData.properties.URL && popupData.properties.URL.startsWith('file:') && context.isFirefox()) {
        popupData.warnings.push("Images from file system might not be shown in this popup, but meta data should still be correctly read.");
      }
      popupData.data = message.data;
      sessionStorage.set("popupData", popupData).then(() => {
        sessionStorage.get()
          .then(({previous, winpop}) => {
            if (previous?.imgURL && previous.imgURL === message.properties.URL) {
              context.debug("Previous popup was same - Focus to previous if still open...");
              browser.windows.update(previous.winId, {focused: true})
                .then(() => {
                    context.debug("Existing popup was attempted REfocused.")
                  }
                )
                .catch(() => {
                    context.debug("REfocusing didn't succeed. Creating a new popup...");
                    createPopup(message, winpop)
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
              createPopup(message, winpop);
            }
          });
      });

    } else if (message.message === "popupReady") { // 2nd msg, populate popup

      sessionStorage.get("popupData")
        .then (
          function (data) {
            sendResponse(data);
          }
        );
      return true;

    }

  }
);

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
        // TODO: window objekt vil ikke være tilgængelig med MV3 background service worker?
        //  (https://developer.chrome.com/docs/extensions/migrating/to-service-workers/)
        //  (But: https://stackoverflow.com/questions/73778202/using-window-globals-in-manifestv3-service-worker-background-script)
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

function createMenuItem(useDeepSearch) {
  // TODO: Remove multiple call to this when possible.
  //  But for now, run "frequently" because:
  //  https://bugzilla.mozilla.org/show_bug.cgi?id=1771328,
  //  https://bugzilla.mozilla.org/show_bug.cgi?id=1817287,
  //  https://discourse.mozilla.org/t/strange-mv3-behaviour-browser-runtime-oninstalled-event-and-menus-create/111208/11
  browser.contextMenus.create({
    id: "viewexif",
    title: browser.i18n.getMessage("contextMenuText"),
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/ContextType
    contexts: useDeepSearch ? ["image", "link", "page", "frame", "editable", "video", "audio"] : ["image"]
    },
    () => {
      if (browser.runtime.lastError) {
        context.log('Menu-item probably already created: ' + browser.runtime.lastError.message);
      } else {
        context.log('Menu-item created.');
      }
    }
  );
}

/* Using a custom-built "sessionStorage" to persist the state when background-script is terminated and restarted, */
/* because Firefox ain't got its own (yet?): https://bugzilla.mozilla.org/show_bug.cgi?id=1687778.                */
/* (Build on-top of context.setOptions() and context.getOptions() from context.js...)                             */
let sessionStorage = (function () {
  let sessionData; // When background-script is restarted sessionData will be (declared but) of undefined value
  function clear() {
    sessionData = {}; // Make sessionData (defined as) empty
    return context.getOptions().then(
      function (options) {
        options.sessionstorage = sessionData;
        return context.setOptions(options); // Persist the cleared sessionData
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
