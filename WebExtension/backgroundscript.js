/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

// import '/lib/mozilla/browser-polyfill.js';
// import '/context.js';

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
        if (versionnumber.compare(previousVersion, '2.15.0') < 0) { // Only show "upboarding" if previous version LESS than 2.15.0
          browser.tabs.create({url: "boarding/upboard.html?previousVersion=" + previousVersion});
        }
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

// Attempt to fix missing menu-item right after an installation where support for use in Private mode was enabled.
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
        Promise.all([context.getOptions(), scriptsInjecting])
          .then((values) => {
              context.debug("All scripts started from background is ready...");
              const options = values[0];
              if (!values[1].length || !values[1][0]) {
                console.error('xIFr: There was an error loading contentscripts: ' + JSON.stringify(values[1]));
                // TODO: throw?
              }
              sessionStorage.set("winpop", options.popupPos)
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
                        deepSearchBigger: !!info.modifiers?.includes("Shift"),
                        deepSearchBiggerLimit: options.deepSearchBiggerLimit,
                        fetchMode : options.devFetchMode,
                        frameId: info.frameId, // related to globalThis/window/frames ?
                        frameUrl: info.frameUrl
                      }
                    );
                  }
                )
                .catch((err) => {
                  console.error(`xIFr: sessionStorage or sendMessage(parseImage) error: ${err}`);
                });
            }
          )
          .catch((err) => {
            console.error(`xIFr: Failed getting data or injecting scripts: ${err}`);
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
        Promise.all([context.getOptions(), ...scriptsInjecting]).then(
          (values) => {
            context.debug("All scripts started from background is ready...");
            const options = values[0];
            sessionStorage.set("winpop", options.popupPos)
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
                    deepSearchBigger: !!info.modifiers?.includes("Shift"),
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

function convertBlobToBase64(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
  });
}

browser.runtime.onMessage.addListener(
  function messageHandler(message, sender, sendResponse) {

    if (["fetchdata", "fetchdataBase64"].includes(message.message)) { // backend fetch

      // TODO: Maybe consider how this could be refactored? ...

      const result = {};
      const url = new URL(message.href); // image.src
      function fetchdata_error(error) {
        console.error('xIFr: Background ' + message.message + ' error!', error);
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          console.error("xIFr: Abort - likely timeout - when reading image-data from " + url);
          result.error = browser.i18n.getMessage('fetchImageAbortError');
        } else {
          console.error("xIFr: fetch-ERROR trying to read image-data from " + url + " : " + error);
          result.error = browser.i18n.getMessage('fetchImageError');
          result.info = browser.i18n.getMessage('fetchFileWorkAroundInfo');
        }
        // context.debug("xIFr: fetch-ERROR Event.lengthComputable:" + error.lengthComputable);
        result.byteLength = '';
        result.contentType = '';
        result.lastModified = '';
        sendResponse(result);
      }
      const fetchOptions = message.fetchOptions;
      fetchOptions.credentials = 'omit'; // Recommended by Mozilla
      fetchOptions.cache = 'no-cache'; // Recommended by Mozilla
      if (!fetchOptions.headers) {
        // https://developer.mozilla.org/en-US/docs/Web/API/Request/headers
        fetchOptions.headers = new Headers({'Accept': 'image/*'});
      } // or use Headers.append() !?
      const fetchTimeout = 8000; // 8 seconds
      if (AbortSignal?.timeout) {
        fetchOptions.signal = AbortSignal.timeout(fetchTimeout);
      }

      if (message.message === "fetchdata") { // Probably Firefox

        fetch(url.href, fetchOptions)
          .then(
            function(response) {
              if (response.ok) { // 200ish
                result.byteLength = response.headers.get('Content-Length') ?? '';
                result.contentType = response.headers.get('Content-Type') || ''; // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
                result.lastModified = response.headers.get('Last-Modified') || '';
                return response.arrayBuffer(); // Promise<ArrayBuffer>
              } else {
                console.error('xIFr: Network response was not ok.');
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
                result.byteLength = arrayBuffer.byteLength ?? result.byteLength; // TODO: I guess these ain't both header values...
              }
              sendResponse(result);
            }
          )
          .catch(fetchdata_error);
        return true;

      } else if (message.message === "fetchdataBase64") { // Probably a Chromium browser

        fetch(url.href, fetchOptions)
          .then(
            function(response) {
              if (response.ok) { // 200ish
                result.byteLength = response.headers.get('Content-Length') ?? '';
                result.contentType = response.headers.get('Content-Type') || ''; // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
                result.lastModified = response.headers.get('Last-Modified') || '';
                return response.blob(); // Promise<Blob>
              } else {
                console.error('xIFr: Network response was not ok.');
                throw new Error('Network response was not ok.');
              }
            }
          )
          .then(convertBlobToBase64)
          .then(
            function(base64) {
              if (base64) {
                context.debug("Looking at the fetch response (base64)...");
                context.info("headers.byteLength: " + result.byteLength);
                result.base64 = base64;
              } else {
                console.error('xIFr: base64 data missing');
              }
              sendResponse(result);
            }
          )
          .catch(fetchdata_error);
        return true;

      }

    } else if (message.message === "EXIFready") { // 1st msg, create popup

      const popupData = {};
      popupData.infos = message.infos;
      popupData.warnings = message.warnings;
      popupData.errors = message.errors;
      popupData.properties = message.properties;
      if (Object.keys(message.data).length === 0) {
        popupData.infos.push(browser.i18n.getMessage("noEXIFdata"));
      }
      if (popupData.properties.URL?.startsWith('blob:http')) {
        popupData.warnings.push(browser.i18n.getMessage('displayBlobTrouble'));
      }
      if (popupData.properties.URL?.startsWith('file:') && context.isFirefox()) {
        popupData.warnings.push(browser.i18n.getMessage('displayFileTrouble'));
        // TODO: Er det faktisk muligt at vise lokalt image med URL.createObjectURL(blob) ?
        //  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Working_with_files#retrieving_stored_images_for_display
      }
      popupData.data = message.data;
      sessionStorage.set("popupData", popupData).then(() => {
        sessionStorage.get()
          .then(({previous, winpop}) => {
            if (previous?.imgURL && previous.imgURL === message.properties.URL && !message.properties.URL.startsWith('file:')) {
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

function createPopup(request, popupPos) { // Called when 'EXIFready'
  const win = request.properties.wprop.win;
  const scr = request.properties.wprop.scr;
  let pos = {};
  const width = 650;
  const height = 500;
  if (!win?.width) {
    console.error('xIFr: Current browser-window properties not received by backgroundscript');
  }
  if (!scr?.availWidth) {
    console.error('xIFr: window.screen properties not received by backgroundscript');
  }
  switch (popupPos) {
    case "center":
      if (scr?.availWidth) {
        pos = {
          left: Math.floor(scr.availWidth / 2) - 325,
          top: Math.floor(scr.availHeight / 2) - 250
        };
      }
      break;
    case "centerBrowser":
      if (win?.width) {
        pos = {
          left: win.left + Math.floor(win.width / 2) - 325,
          top: win.top + Math.floor(win.height / 2) - 250
        };
      }
      break;
    case "topLeft":
      pos = {left: 10, top: 10};
      break;
    case "topRight":
      if (scr?.availWidth) {
        pos = {left: scr.availWidth - 650 - 10, top: 10};
      }
      break;
    case "topLeftBrowser":
      if (win?.width) {
        pos = {left: win.left + 10, top: win.top + 10};
      }
      break;
    case "topRightBrowser":
      if (win?.width) {
        pos = {left: win.left + win.width - 650 - 10, top: win.top + 10};
      }
      break;
    case "leftish":
      if (win?.width) {
        pos = {
          left: Math.max(win.left - 200, 10),
          top: Math.max(win.top + Math.floor(win.height / 2) - 350, 10)
        };
      }
      break;
    case "rightish":
      if (win?.width || scr?.availWidth) {
        pos = {
          left: Math.min(win.left + win.width - 450, scr.availWidth - 650 - 10),
          top: Math.max(win.top + Math.floor(win.height / 2) - 350, 10)
        };
      }
      break;
    case "snapLeft":
      if (scr?.availWidth) {
        pos = {left: 0, top: 0, height: scr.availHeight};
      }
      break;
    case "snapRight":
      if (scr?.availWidth) {
        pos = {left: scr.availWidth - width, top: 0, height: scr.availHeight};
      }
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
  // TODO: Also see https://bugzilla.mozilla.org/show_bug.cgi?id=1527979
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

// TODO: Firefox 115+ supports storage.session: https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/storage/session
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
