/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import './context.js';

globalThis.browser ??= chrome;

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
    const upboardUrl = new URL(browser.runtime.getURL('boarding/upboard.html'));
    const onboardUrl = new URL(browser.runtime.getURL('boarding/onboard.html'));
    switch (reason) {
      case "update": // "upboarding"
        if (versionnumber.compare(previousVersion, '3.0.0') < 0) { // Only show "upboarding" (and clear old "mv2-sessionStorage") if previous version LESS than 3.0.0...
          if (temporary) {
            upboardUrl.searchParams.set('temporary', temporary);
          }
          upboardUrl.searchParams.set('previousVersion', previousVersion);
          browser.storage.local.remove("sessionstorage")
            .then(function () {
              console.log("xIFr: Old homemade mv2 sessionStorage was cleared on installation/upgrade!");
            })
            .catch((err) => {
              console.error(`xIFr: Failed clearing old mv2 sessionStorage: ${err}`);
            })
            .finally(function () {
              // Show the "upboarding" window:
              browser.tabs.create({url: upboardUrl.pathname + upboardUrl.search});
            });
        }
        break;
      case "install": // "onboarding"
        if (temporary) {
          onboardUrl.searchParams.set('temporary', temporary);
        }
        onboardUrl.searchParams.set('initialOnboard', '1');
        browser.tabs.create({url: onboardUrl.pathname + onboardUrl.search});
        break;
    }
  }
);

browser.runtime.onStartup.addListener(() => {
  context.getOptions().then(function (options) {
    // Try re-define menuitem because of Firefox bug https://bugzilla.mozilla.org/show_bug.cgi?id=1817287
    createMenuItem(!options.devDisableDeepSearch && browser.contextMenus.getTargetElement);
    if (options?.initialOnboard === '1') {
      browser.extension.isAllowedIncognitoAccess().then(function (allowsPrivate) {
        if (allowsPrivate && context.isFirefox()) {
          // Re-show onboarding if risk of was force-closed first time (https://bugzilla.mozilla.org/show_bug.cgi?id=1558336)
          // TODO: 1558336 should be fixed in Firefox 129 !
          browser.tabs.create({url: "boarding/onboard.html?initialOnboard=2"}); // show second time
        } else {
          context.setOption('initialOnboard', 3); // second time not needed
        }
      });
    }
  });
});

// Attempt to fix missing menu-item right after an installation where support for use in Private mode was enabled.
// Probably https://bugzilla.mozilla.org/show_bug.cgi?id=1771328 // TODO: Fixed in 128?
context.getOptions().then(
  function (options) {
    createMenuItem(!options.devDisableDeepSearch && browser.contextMenus.getTargetElement);
  }
);

// action.onClicked used with "action":{} in manifest.json...
// https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/action/onClicked
browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});
browser.action.setTitle({ title: "Open Options-page" });

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
        "context.js", // Some state and options handling, utility functions
        "stringBundle.js", // Translation handling
        "fxifUtils.js", // Some utility functions
        "binExif.js", // Interpreter for binary EXIF data
        "binIptc.js", // Interpreter for binary IPTC-NAA data
        "xmp.js", // Interpreter for XML XMP data
        "parseJpeg.js", // "Master parser" for header-data
        "contentscript.js" // "Conductor" frontend script (frontend-fetch of image, communication with backend, "deep search" functionality)
      ];
      // For CSS, see: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/insertCSS

      if (browser.scripting?.executeScript) {
        // Requires "scripting" (or "activeTab") included in "permission" of the manifest!
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
              browser.storage.session.set({"winpop": options.popupPos})
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
                        fetchMode: options.devFetchMode,
                        frameId: info.frameId,
                        frameUrl: info.frameUrl,
                        tabId: tab.id,
                        tabUrl: tab.url
                      }
                    )
                    .then ((r) => {
                      // console.log(`xIFr: ${r}`)
                    })
                    .catch((e) => {
                      console.error('xIFr: Sending parseImage message failed! \n' + e)
                    });
                  }
                )
                .catch((err) => {
                  console.error(`xIFr: storage.session or sendMessage(parseImage) error: ${err}`);
                });
            }
          )
          .catch((err) => {
            console.error(`xIFr: Failed getting data or injecting scripts: ${err}`);
          });
      } else {
        console.error(`xIFr: Can't run browser.scripting.executeScript. Missing "scripting" or "activeTab" permission?`);
      }
    }
  }
});

/**
 * @param blob
 * @returns {Promise<string>}
 */
function convertBlobToBase64(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
    reader.readAsDataURL(blob);
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
      const fetchTimeout = 8000; // 8 seconds
      if (AbortSignal?.timeout) {
        fetchOptions.signal = AbortSignal.timeout(fetchTimeout);
      }

      if (message.message === "fetchdata") { // Probably Firefox

        fetch(url.href, fetchOptions)
          .then(
            function(response) {
              if (response.ok) { // 200ish
                result.byteLength = response.headers.get('Content-Length') || '';
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
                result.byteLength = arrayBuffer.byteLength || result.byteLength;
              }
              sendResponse(result);
            }
          )
          .catch(fetchdata_error);
        return true; // Tell it to expect a later response (to be sent with sendResponse())

      } else if (message.message === "fetchdataBase64") { // Probably a Chromium browser

        fetch(url.href, fetchOptions)
          .then(
            function(response) {
              if (response.ok) { // 200ish
                result.byteLength = response.headers.get('Content-Length') || '';
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
            /**
             * @param base64 {string} data-url
             */
            function(base64) {
              if (base64) {
                context.debug("Looking at the fetch response (base64)...");
                context.info("headers.byteLength: " + result.byteLength);
                result.byteLength = result.byteLength || Math.round(base64.length / 1.36667); // Approximation
                result.base64 = base64;
              } else {
                console.error('xIFr: base64 data missing');
              }
              sendResponse(result);
            }
          )
          .catch(fetchdata_error);
        return true; // Tell it to expect a later response (to be sent with sendResponse())

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
      browser.storage.session.set({"popupData": popupData}).then(() => {
        browser.storage.session.get()
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

      browser.storage.session.get("popupData")
        .then (
          function (data) {
            sendResponse(data.popupData);
          }
        );
      return true; // tell it to expect a later response (sent with sendResponse())

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
  // TODO: Use an object spread instead of Object.assign!? (also elsewhere?...):...
  browser.windows.create(Object.assign(
    {
      url: browser.runtime.getURL("/popup/popup.html"),
      type: "popup",
      width: width,
      height: height
    }, pos))
    .then((popwin) => {
        browser.storage.session.set({"previous": {"winId": popwin.id, "imgURL": request.properties.URL}});
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
