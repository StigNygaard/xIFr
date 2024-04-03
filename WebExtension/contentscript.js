/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

(function() {

  const logDSEARCH = false; // Some logging to console to trace Deep Search steps?

  // A map to connect non-jpeg background-images and alternative jpeg-versions found in css image-sets:
  const bgAlternatives = new Map(); // Will be updated by updateBgAlternatives
  // Minimum image-size to be relevant:
  const deepSearchGenericLimit = 10 * 10;


  function addByteStreamIF(arr) {
    arr.bisOffset = 0;
    arr.read16 = () => {
      const val = arr[arr.bisOffset] << 8 | arr[arr.bisOffset + 1];
      arr.bisOffset += 2;
      return val;
    };
    arr.readBytes = byteCount => {
      if (byteCount < 0) {
        console.error("xIFr: readBytes(byteCount): Can't read negative byteCount=" + byteCount);
        throw "xIFr contentscript.js, readBytes(byteCount): Can't read negative byteCount=" + byteCount;
        // pushError(dataObj, "[xmp]", ex);
        return;
      }
      let retval = "";
      for (let i = 0; i < byteCount; i++) {
        retval += String.fromCharCode(arr[arr.bisOffset]);
        arr.bisOffset++;
      }
      return retval;
    };
    arr.readByteArray = len => {
      let retval = arr.subarray(arr.bisOffset, arr.bisOffset + len);
      arr.bisOffset += len;
      return retval;
    }
  }

  function translateFields(data) {
    const newdata = {};
    Object.keys(data).forEach(key_v => {
      let key = key_v;
      let label = key;
      let val = data[key_v];
      if (typeof key === "string") {
        label = stringBundle.getString(key.replace('.', '_'));
      }
      if (typeof val === "string") {
        val = stringBundle.getString(val);
      }
      newdata[key] = {label: label, value: val};
    });
    return newdata;
  }

  function updateBgAlternatives(bgimage) {
    // Does getComputedStyle() return exact same format in all browsers? If one day Chromium (or other
    // browsers) starts supporting "deep search", maybe re-visit this to verify the functionality!?...
    // https://developer.mozilla.org/en-US/docs/Web/CSS/background-image
    // https://developer.mozilla.org/en-US/docs/Web/CSS/image/image-set
    const optionsParser = /^(image-set\()?url\("(?<url>[^"]+)"\)\s(?<resolution>\S+)\stype\("(?<type>[^"]+)"\)/iu;
    // console.log('Computed background-image css with some image-set and type: ' + bgimage);
    const imageSets = bgimage.split(/(^\s*|\s+)(?=image-set)/u).filter((part) => part.startsWith('image-set('));
    for (const imageSet of imageSets) {
      // console.log('Looking at imageSet:' + imageSet);
      const imagedefs = imageSet.split(', ').filter((opts) => opts.includes('url(') && opts.includes('type('));
      // console.log('Computed background-image relevant imagedefs count:' + imagedefs.length);
      let jpegs = [];
      let others = [];
      for (const imagedef of imagedefs) {
        // console.log('Now image-def:' + imagedef);
        // Notice, we expect the properties/options of imagedef in order: (absolute)url, resolution, type. Like:
        // url("https://www.rockland.dk/img/test.avif") 1dppx type("image/avif")
        const options = imagedef.trim().match(optionsParser);
        if (options !== null) {
          // console.log('- Matched url: ' + options.groups.url);
          // console.log('- Matched resolution: ' + options.groups.resolution);
          // console.log('- Matched type: ' + options.groups.type);
          let obj = {
            'url': options.groups.url,
            'resolution': options.groups.resolution,
            'type': options.groups.type
          };
          if (options.groups.type === 'image/jpeg') {
            jpegs.push(obj);
          } else {
            others.push(obj);
          }
        }
      }
      for (const other of others) {
        for (const jpeg of jpegs) {
          if (other.resolution === jpeg.resolution) {
            bgAlternatives.set(other.url, {'other': other, 'jpeg': jpeg});
          }
        }
      }
    }
  }

  // Much of following based on code/concept from https://blog.crimx.com/2017/03/09/get-all-images-in-dom-including-background-en/ (by CRIMX) ...
  function getBgImgs(elem) {
    const srcChecker = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/giu;
    let extras = [];
    if (elem instanceof Element) extras.push(elem); // Includes elem (itself) unless elem is (f.ex.) document
    if ((elem instanceof DocumentFragment) && elem.host) extras.push(elem.host); // include host-element if elem is root of a shadowDOM
    return Array.from(
    extras.concat(Array.from(elem.querySelectorAll('*')))
        .reduce((collection, node) => {
          const cstyle = window.getComputedStyle(node, null);
          const display = cstyle.getPropertyValue('display');
          const visibility = cstyle.getPropertyValue('visibility');
          const appleHack = location.hostname.endsWith('.apple.com');
          if (display !== 'none' && visibility !== 'hidden') {
            let bgimage = cstyle.getPropertyValue('background-image');
            if (bgimage === 'none' && appleHack) {
              // An experimental/temporary(?) site-specific hack for apple.music.com...
              // I don't know how they do it (will have to investigate), but this works to
              // get the background-image in headers of "itunes" artist pages (as of 08/2023):
              bgimage = cstyle.getPropertyValue('--background-image');
            }
            if (bgimage.includes('image-set(') && bgimage.includes('type("image/jpeg")')) {
              updateBgAlternatives(bgimage);
            }
            let match;
            while ((match = srcChecker.exec(bgimage)) !== null) { // There might be multiple, like: background-image: url("img_tree.gif"), url("paper.gif");
              collection.add(match[1]);
            }
          }
          return collection;
        }, new Set())
    );
  }

  // Finding and loading image(s) embedded in inline SVG....
  function getSVGEmbeddedImages(elem) {
    return Array.from(
      (['image', 'feimage'].includes(elem.nodeName.toLowerCase()) ? [elem] : []).concat(Array.from(elem.querySelectorAll('svg image, svg feImage')))
        .reduce((collection, node) => {
          const cstyle = window.getComputedStyle(node, null);
          const display = cstyle.getPropertyValue('display');
          const visibility = cstyle.getPropertyValue('visibility');
          if (display !== 'none' && visibility !== 'hidden') {
            if (node.href?.baseVal) {
              collection.add(new URL(node.href.baseVal, node.baseURI).href);
            }
          }
          return collection;
        }, new Set())
    );
  } // But also: https://www.petercollingridge.co.uk/tutorials/svg/interactive/javascript/ ?

  function loadImg(src, timeout = 500) {
    let imgPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.addEventListener("load", () => {
        resolve({
          src: src,
          width: img.naturalWidth,
          height: img.naturalHeight,
          weight: (img.naturalWidth || 1) * (img.naturalHeight || 1)
        })
      });
      img.addEventListener("error", function () {
        console.warn(`xIFr: Error when trying to "pre-fetch" image ${src}.`);
        reject()
      });
      img.src = src;
    });
    const timer = new Promise((resolve, reject) => {
      setTimeout(reject, timeout);
    });
    return Promise.race([imgPromise, timer]);
  }

  function loadImgAll(imgList, timeout = 500) { // Could we use https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode ?
    return new Promise((resolve, reject) => {
      Promise.all(
        imgList
          .map(src => loadImg(src, timeout))
          .map(p => p.catch(e => false))
      ).then(results => resolve(results.filter(r => r)));
    })
  }

  function fetchImage(url, fetchOptions = {}) {
    let result = {};
    const fetchTimeout = 8000; // 8 seconds
    if (AbortSignal?.timeout) {
      fetchOptions.signal = AbortSignal.timeout(fetchTimeout);
    }
    return fetch(url, fetchOptions)
      .then(
        function (response) {
          if (!response.ok) { // 200ish
            throw Error("(" + response.status + ") " + response.statusText);
          }
          result.byteLength = response.headers.get('Content-Length') || '';
          result.contentType = response.headers.get('Content-Type') || ''; // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
          result.lastModified = response.headers.get('Last-Modified') || '';

          return response.arrayBuffer();
        }
      )
      .then(
        function (arrayBuffer) {
          if (arrayBuffer) {
            context.debug("Looking at the fetch response (arrayBuffer)...");
            context.info("headers.byteLength: " + result.byteLength);
            context.info("arraybuffer.byteLength: " + arrayBuffer.byteLength);
            result.byteArray = new Uint8Array(arrayBuffer);

            result.byteLength = arrayBuffer.byteLength || result.byteLength;

          }
          return result;
        }
      )
      .catch(
        function (error) {
          console.error('xIFr: Error from frontend fetch', error.message, error)
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
          return result;
        }
      );
  }

  function loadparseshow(imgrequest) { // handleChosenOne
    // console.log('Properties for ' + imgrequest.imageURL + '... \n srcset=' + imgrequest.srcset + ' \n crossOrigin=' + imgrequest.crossOrigin + ' \n referrerPolicy=' + imgrequest.referrerPolicy + ' (' + (typeof imgrequest.referrerPolicy) + ')' + ' \n baseURI=' + imgrequest.baseURI);
    if (!imgrequest) {
      console.warn("xIFr: Exit loadparseshow. Got nothing to show!");
      return;
    }
    const wprop = {
      scr: { // screen
        width: window.screen.width,
        availWidth: window.screen.availWidth,
        height: window.screen.height,
        availHeight: window.screen.availHeight
      },
      win: { // browser window
        width: window.outerWidth,
        height: window.outerHeight,
        top: window.screenTop,
        left: window.screenLeft
      }
    };
    const propertiesObj = {wprop: wprop};
    propertiesObj.URL = imgrequest.imageURL;
    propertiesObj.crossOrigin = imgrequest.crossOrigin;
    propertiesObj.referrerPolicy = imgrequest.referrerPolicy;
    if (imgrequest.naturalWidth) {
      propertiesObj.naturalWidth = imgrequest.naturalWidth;
      propertiesObj.naturalHeight = imgrequest.naturalHeight;
    }
    if (imgrequest.source) { // ?
      propertiesObj.source = imgrequest.source;
    }
    if (imgrequest.context) { // ?
      propertiesObj.context = imgrequest.context;
    }
    if (imgrequest.tabId) {
      propertiesObj.tabId = imgrequest.tabId;
    }
    propertiesObj.tabUrl = imgrequest.tabUrl || window.location?.href;
    const errorsArr = []; // Messages to show as errors
    const warningsArr = []; // Messages to show as warnings
    const infosArr = []; // Messages to show as info

    if (imgrequest.jpegURL) {
      infosArr.push('Image shown on webpage is in ' + imgrequest.imageType.replace('image/', '') + ' format. An alternative image was detected (assumed similar) to look for meta-data in...' + (imgrequest.proxyType ? imgrequest.proxyType.replace('image/', '') : ''));
      propertiesObj.pageShownURL = imgrequest.imageURL;
      propertiesObj.pageShownType = imgrequest.imageType;
      propertiesObj.URL = imgrequest.jpegURL;
    }
    const fetchOptions = {};
    if (imgrequest.referrerPolicy) {
      fetchOptions.referrerPolicy = imgrequest.referrerPolicy; // But how are referrerPolicy handled if fetch is moved to background-script?
    }
    context.debug("Will now do fetch(" + propertiesObj.URL + ") ...");


    async function handleBase64Result(result) {
      if (result.base64) {
        const response = await fetch(result.base64);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        result.byteArray = new Uint8Array(arrayBuffer);
        delete result.base64;
      } else {
        result.error = browser.i18n.getMessage('fetchImageError');
        result.info = browser.i18n.getMessage('fetchFileWorkAroundInfo');
        result.byteLength = '';
        result.contentType = '';
        result.lastModified = '';
      }
      return result;
    }

    function handleResult(result) {
      if (result.info) {
        infosArr.push(result.info);
      }
      if (result.error) {
        errorsArr.push(result.error);
        propertiesObj.byteLength = '';
        propertiesObj.contentType = '';
        propertiesObj.lastModified = '';
        browser.runtime.sendMessage({
          message: "EXIFready",
          data: {},
          properties: propertiesObj,
          errors: errorsArr,
          warnings: warningsArr,
          infos: infosArr
        });
      }
      if (result.byteArray) {
        // const uint8array = Uint8Array(result.byteArray) //  new Uint8Array(arrayBuffer)
        propertiesObj.byteLength = result.byteLength;
        propertiesObj.contentType = result.contentType;
        propertiesObj.lastModified = result.lastModified;

        context.debug("Call addByteStreamIF(byteArray)...");
        addByteStreamIF(result.byteArray);
        context.debug("Gather data from image header (fxifObj.gatherData(byteArray) = fxifClass.gatherData() in parseJpeg.js)...");
        const dataObj = fxifObj.gatherData(result.byteArray); // Gather data from header (via "markers" found in file)
        if (dataObj.error?.length) {
          errorsArr.push(...dataObj.error);
          delete dataObj.error;
        }
        if (dataObj.warning?.length) {
          warningsArr.push(...dataObj.warning);
          delete dataObj.warning;
        }

        context.debug("request: " + JSON.stringify(imgrequest));
        if (imgrequest.naturalWidth && imgrequest.goDeepSearch && imgrequest.supportsDeepSearchModifier && !imgrequest.deepSearchBigger && (imgrequest.naturalWidth * imgrequest.naturalHeight <= imgrequest.deepSearchBiggerLimit)) {
          infosArr.push('Not the expected image? You can force xIFr to look for a larger image than this, by holding down Shift key when selecting xIFr in the context menu!');
        }

        context.debug("Gathered data: \n" + JSON.stringify(dataObj));
        const xlatData = translateFields(dataObj);
        context.debug("Gathered data after translation: \n" + JSON.stringify(xlatData));

        context.debug("EXIF parsing done. Send EXIFready message...");
        browser.runtime.sendMessage({
          message: "EXIFready",
          data: xlatData,
          properties: propertiesObj,
          errors: errorsArr,
          warnings: warningsArr,
          infos: infosArr
        });
      } else {
        console.warn("xIFr: fetch response (arrayBuffer) is empty!...");
      }
    }


    // https://stackoverflow.com/questions/8593896/chrome-extension-how-to-pass-arraybuffer-or-blob-from-content-script-to-the-bac
    // https://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers

    // Firefox currently uses a better data-cloning algorithm than Chrome:
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities#data_cloning_algorithm
    // but maybe that could change in the future?:
    // https://bugs.chromium.org/p/chromium/issues/detail?id=248548

    context.debug(' *** fetchMode: ' + imgrequest.fetchMode + ' ***');

    const pageHostname = (new URL(imgrequest.baseURI))?.hostname; // TODO ideally check against window.location instead of Node.baseURI ?!?
    const imgHostname = (new URL(imgrequest.imageURL))?.hostname;
    if ( imgrequest.fetchMode === 'devFrontendFetch' ||
      imgrequest.fetchMode === 'devAutoFetch' && ((pageHostname === imgHostname) || propertiesObj.URL.startsWith('data:') || propertiesObj.URL.startsWith('blob:') || propertiesObj.URL.startsWith('file:')) ) { // Do frontend fetch...
      if (imgrequest.fetchMode !== 'devAutoFetch') {
        console.warn(`xIFr: Forced FRONTEND fetch (${imgrequest.fetchMode})`);
      }
      fetchImage(propertiesObj.URL, fetchOptions)
        .then(handleResult);
    } else { // Do backend fetch...
      if (imgrequest.fetchMode !== "devAutoFetch") {
        console.warn(`xIFr: Forced BACKEND fetch (${imgrequest.fetchMode})`);
      }

      if (context.isFirefox()) { // Fastest Structured clone algorithm. Supported by Firefox
        context.debug('fetchdata: Receiving from backend as Uint8Array-arrayBuffer by the Structured clone algorithm (The fastest way, and supported by Firefox)');
        browser.runtime.sendMessage(
          {
            message: 'fetchdata',
            href: propertiesObj.URL,
            fetchOptions: fetchOptions
          }
        )
          .then(handleResult)
          .catch(
            (error) => console.error('xIFr: fetchdata backend fetch - There has been a problem with your fetch operation: ', error.message, error)
          );
      } else { // Slower JSON serialization algorithm. Supported by both Firefox and Chromium...
        context.debug('fetchdataBase64: Receiving from backend as base64 by the JSON serialization algorithm (The widely supported way, and supported by both Chromium and Firefox)');
        browser.runtime.sendMessage(
          {
            message: 'fetchdataBase64',
            href: propertiesObj.URL,
            fetchOptions: fetchOptions
          }
        )
          .then(handleBase64Result)
          .then(handleResult)
          .catch(
            (error) => console.error('xIFr: fetchdataBase64 backend fetch - There has been a problem with your fetch operation: ', error.message, error)
          );
      }

    }

  }

  function blacklistedImage(src) { // todo: Make blacklist configurable!
    if (src.startsWith('data:') && (src.length < 500 || !src.startsWith('data:image/'))) {
        console.warn('xIFr: Skipping ' + src);
      // ignore tiny inline data: images - and those that doesn't have some 'image' mimetype
        return true;
    } else if (src.startsWith('moz-extension:') || src.startsWith('chrome-extension:')) {
      console.warn('xIFr: Skipping ' + src);
      return true; // Apparently we can detect images inserted by other extensions, but we cannot access them
    }
    return [{
      url: "https://combo.staticflickr.com/ap/build/images/sprites/icons-cc4be245.png",
      regexp: false
    }, {
      url: "https://combo.staticflickr.com/ap/build/images/fave-test/white@1x.png",
      regexp: false
    }, {
      url: "https://combo.staticflickr.com/ap/build/images/sprites/icons-87310c47.png",
      regexp: false
    }, {
      url: "https://static.kuula.io/prod/assets/sprites-main.png",
      regexp: false
    }, {
      url: "https://m.media-amazon.com/images/G/01/digital/music/player/web/EQ_accent.gif",
      regexp: false
    }, {
      url: "https://m.media-amazon.com/images/G/01/digital/music/player/web/EQ_accent.webp",
      regexp: false
    }, {
      url: "https://www.instagram.com/static/bundles/es6/sprite_core_32f0a4f27407.png/32f0a4f27407.png",
      regexp: false
    }, {
      url: "https://static.xx.fbcdn.net/rsrc.php/v3/yt/r/pQ6WpMqXLJA.png",
      regexp: false
    }, {
      url: "https://static.cdninstagram.com/rsrc.php/v3/y5/r/TJztmXpWTmS.png",
      regexp: false
    }].some(function (item) {
      return src === item.url
    });
  }

  function imageSearch(request, elem) {
    // TODO: Look if elem has a shadowDOM beneath it?
    //  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/dom/openOrClosedShadowRoot
    //  element.openOrClosedShadowRoot - The Element.openOrClosedShadowRoot read-only property represents the shadow root hosted by the element, regardless if its mode is open or closed (WebExtensions only - Firefox only)
    //  -> Combined: let shadowRoot = chrome.dom?.openOrClosedShadowRoot(element) || element.openOrClosedShadowRoot();
    //  BUT if just looking for *open* shadowRoots:
    //  element.shadowRoot

    context.debug("imageSearch(): Looking for img elements on/below " + elem.nodeName.toLowerCase());

    let candidate;

    // https://time2hack.com/checking-overlap-between-elements/
    // https://www.youtube.com/watch?v=cUZ2r6C2skA
    // https://css-tricks.com/how-to-stack-elements-in-css/
    const documentImages = [];
    const rootNode = elem.getRootNode({composed:false});
    documentImages.push(...Array.from(rootNode.images || rootNode.querySelectorAll('img')).sort( // sort by size descending...
      (a, b) => (b.naturalWidth || 1) * (b.naturalHeight || 1) - (a.naturalWidth || 1) * (a.naturalHeight || 1)
    ));

    logDSEARCH && console.log(`xIFr: *** Doing initial imageSearch with documentImages list (length ${documentImages.length}): ${JSON.stringify(documentImages.map(im => ` (${im.currentSrc}, w=${im.naturalWidth}, s=${(im.naturalWidth||1)*(im.naturalHeight||1)})`))}`);
    for (const img of documentImages) {
      if (elem.contains(img)) { // img is itself/elem or img is a "sub-node"
        context.debug("Found image within target element! img.src=" + img.src + " and naturalWidth=" + img.naturalWidth + ", naturalHeight=" + img.naturalHeight);
        // We could look for best match, or just continue with the first we find?
        context.debug("Candidate!?");
        const propDisplay = window.getComputedStyle(img, null).getPropertyValue('display'); // none?
        const propVisibility = window.getComputedStyle(img, null).getPropertyValue('visibility'); // hidden?
        // TODO: Maybe also look at computed opacity ??!
        context.debug("PROPs! display=" + propDisplay + ", visibility=" + propVisibility);
        if (img.naturalWidth && img.nodeName.toUpperCase() === 'IMG' && propDisplay !== 'none' && propVisibility !== 'hidden') {
          if (!blacklistedImage(img.currentSrc) && ((request.deepSearchBigger && (img.naturalWidth * img.naturalHeight) > request.deepSearchBiggerLimit) || (!request.deepSearchBigger && (img.naturalWidth * img.naturalHeight) > deepSearchGenericLimit))) {
            if (typeof candidate !== "undefined") {
              context.debug("Compare img with candidate: " + img.naturalWidth * img.naturalHeight + " > " + candidate.naturalWidth * candidate.naturalHeight + "? -  document.images.length = " + document.images.length);
              if ((img.naturalWidth * img.naturalHeight) > (candidate.naturalWidth * candidate.naturalHeight)) {
                context.debug("Setting new candidate. -  documentImages.length = " + documentImages.length);
                candidate = img;
              }
            } else {
              context.debug("Setting first candidate. -  documentImages.length = " + documentImages.length);
              candidate = img;
            }
          }
        }
      }
    }
    if (typeof candidate !== "undefined") {
      context.debug("Found! Let's use best candidate: " + candidate.src);
      const image = {}; // result
      image.imageURL = candidate.currentSrc || candidate.src;
      image.imageType = ''; // so far unknown mimetype
      image.mediaType = 'image';
      image.naturalWidth = candidate.naturalWidth;
      image.naturalHeight = candidate.naturalHeight;
      image.supportsDeepSearch = request.supportsDeepSearch;
      image.goDeepSearch = request.goDeepSearch;
      image.supportsDeepSearchModifier = request.supportsDeepSearchModifier;
      image.deepSearchBiggerLimit = request.deepSearchBiggerLimit;
      image.deepSearchBigger = request.deepSearchBigger;
      image.fetchMode = request.fetchMode;
      image.tabId = request.tabId;
      image.tabUrl = request.tabUrl;
      image.source = candidate.nodeName.toLowerCase() + " element";  // 'img element';
      image.context = request.nodeName + " element"; // (not really anything to de with found image)

      image.srcset = candidate.srcset;
      image.crossOrigin = candidate.crossOrigin;
      image.referrerPolicy = candidate.referrerPolicy; // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement
      image.baseURI = candidate.baseURI; // base URL of the document containing the node (might be set by <base>)
      image.x = candidate.x;
      image.y = candidate.y;

      // srcset attribute holds various sizes/resolutions
      // source tag can define alternative formats (but might also hold sizes)
      if (candidate.parentNode?.nodeName && candidate.parentNode.nodeName.toUpperCase() === 'PICTURE') {
        const picture = candidate.parentNode;
        const potentials = [];
        let foundShownInAvoid = false;
        let descriptorToMatch = '1x';
        for (const child of picture.children) {
          if (child.nodeName.toUpperCase() === 'SOURCE' && child.srcset && child.type) { // type is or starts with mimetype;
            if (child.type.startsWith('image/jpeg')) { // We like this being jpeg
              // Populate potentials with jpeg images...
              const findings = child.srcset.split(',');
              for (const found of findings) {
                const parts = found.trim().split(/\s+/u);
                const foundUrl = new URL(parts[0].trim(), child.baseURI).href;
                let foundDescriptor = parts.slice(1).join(' ');
                if (foundDescriptor === '') {
                  foundDescriptor = '1x';
                }
                let foundWeight = parseInt(foundDescriptor, 10);
                if (isNaN(foundWeight)) {
                  foundWeight = 0;
                }
                if (foundUrl === image.imageURL) {
                  image.imageType = 'image/jpeg';
                }
                potentials.push({
                  'url': foundUrl,
                  'descriptor': foundDescriptor,
                  'type': 'image/jpeg',
                  'sortWeight': foundWeight
                });
              }
            } else { // Let's avoid this
              // Detect if use of image to avoid...
              const findings = child.srcset.split(',');
              const foundType = child.type.split(';')[0].trim();
              for (const found of findings) {
                const parts = found.trim().split(/\s+/u);
                const foundUrl = new URL(parts[0].trim(), child.baseURI).href;
                let foundDescriptor = parts.slice(1).join(' ');
                if (foundDescriptor === '') {
                  foundDescriptor = '1x';
                }
                if (foundUrl === image.imageURL) {
                  foundShownInAvoid = true;
                  descriptorToMatch = foundDescriptor;
                  image.imageType = foundType;
                  break;
                }
              }
            }
          }
        }

        if (foundShownInAvoid) { // We like to find an alternative (hopefully jpeg) to parse meta-data from...
          if (potentials.length === 0 && candidate.srcset) {
            // If potentials is empty and img.srcset is defined, add img.srcset to potentials...
            const findings = candidate.srcset.split(',');
            for (const found of findings) {
              const parts = found.trim().split(/\s+/u);
              const foundUrl = new URL(parts[0].trim(), candidate.baseURI).href;
              let foundDescriptor = parts.slice(1).join(' ');
              if (foundDescriptor === '') {
                foundDescriptor = '1x';
              }
              let foundWeight = parseInt(foundDescriptor, 10);
              if (isNaN(foundWeight)) {
                foundWeight = 0;
              }
              potentials.push({
                'url': foundUrl,
                'descriptor': foundDescriptor,
                'type': '',
                'sortWeight': foundWeight
              });
            }
          }
          if (potentials.length > 0) {
            // Replace unwanted image with something from potentials list...
            for (const potential of potentials) {
              if (potential.descriptor === descriptorToMatch) {
                image.jpegURL = potential.url;
                image.jpegType = potential.type;
                return image;
              }
            }
            // If no exact descriptor-match in potentials, then use the one with "highest descriptor" (probably largest image)...
            const potential = potentials.reduce((max, other) => max.sortWeight > other.sortWeight ? max : other); // Find item with highest sortWeight (descriptor-value)
            image.jpegURL = potential.url;
            image.jpegType = potential.type;
            return image;
          }
          // If no potentials at all, use fallback img.src...
          image.jpegURL = candidate.src;
        }
        // If we arrive here, we are probably already using img fallback. Cannot do any better.
      }
      context.debug("imageSearch(): Returning found image (img) " + JSON.stringify(image));
      return image;
    }
    // nothing found by simple search
  }

  function extraSearch(request, elem, xtrSizes) {
    const xtrImgURLsUnsorted = Array.from(new Set([...getBgImgs(elem), ...getSVGEmbeddedImages(elem)]));
    context.debug(`extraSearch(): Following "extra" image urls are found on/below ${elem.nodeName.toLowerCase()}: ${JSON.stringify(xtrImgURLsUnsorted)}.`);
    logDSEARCH && console.log(`xIFr: Found ${xtrImgURLsUnsorted.length} extra background (or in SVG) image URLs to check on/below ${elem.nodeName.toLowerCase()}: \n${JSON.stringify(xtrImgURLsUnsorted)}`);
    if (xtrImgURLsUnsorted.length > 0) {
      const xtrImgURLs = [];
      for (const im of xtrSizes) {
        if (xtrImgURLsUnsorted.find(xSrc => im.src === xSrc)) {
          xtrImgURLs.push(im.src); // same order as in the already sorted xtrSizes
        }
      }
      logDSEARCH && console.log(`xIFr: - Same list sorted: ${JSON.stringify(xtrImgURLs)}`);
      if (xtrImgURLsUnsorted.length > xtrImgURLs.length) {
        const difference = xtrImgURLsUnsorted.filter((element) => !xtrImgURLs.includes(element));
        console.warn(`xIFr: Something fell out the loop: ${difference}.`);
      }
      context.debug("First extra background (or in SVG) image to check in SORTED list: " + xtrImgURLs[0]);
      for (const xSrc of xtrImgURLs) {
        const imgData = xtrSizes.find(xs => xs.src === xSrc);
        if (imgData?.width && !blacklistedImage(imgData.src) && ((request.deepSearchBigger && ((imgData.width * imgData.height) > request.deepSearchBiggerLimit)) || (!request.deepSearchBigger && ((imgData.width * imgData.height) > deepSearchGenericLimit)))) {
          const image = {};
          image.imageURL = xSrc;
          image.mediaType = 'image';
          image.naturalWidth = imgData.width;
          image.naturalHeight = imgData.height;
          image.supportsDeepSearch = request.supportsDeepSearch;
          image.supportsDeepSearchModifier = request.supportsDeepSearchModifier;
          image.goDeepSearch = request.goDeepSearch;
          image.deepSearchBiggerLimit = request.deepSearchBiggerLimit;
          image.deepSearchBigger = request.deepSearchBigger;
          image.fetchMode = request.fetchMode;
          image.tabId = request.tabId;
          image.tabUrl = request.tabUrl;
          image.source = 'extra-search image'; // probably elem.nodeName, but not for sure
          image.context = request.nodeName + " element"; // (not really anything to de with found image)
          image.baseURI = elem.baseURI;
          context.debug("extraSearch(): Returning found image (background or svg) " + JSON.stringify(image));
          return image;
        }
      }
    }
  }

  function deeperSearch(request, elem, xtrSizes) {
    context.debug("Entering deeperSearch() with elem=" + elem.nodeName + " and elem.parentNode=" + elem.parentNode?.nodeName);
    let image = extraSearch(request, elem, xtrSizes);
    if (!image) {
      context.debug("deeperSearch(): No image from extraSearch()");
      let parentElem = elem.parentNode;
      if (!parentElem && elem.host) {
        parentElem = elem.host;
        logDSEARCH && console.log(`xIFr/deeperSearch(): Using shadowDOM host element (${parentElem.nodeName.toLowerCase()}) as "parent elem" for next imageSearch()...`);
      }
      if (!parentElem) {
        context.debug("deeperSearch(): Cannot go higher from " + elem.nodeName.toLowerCase() + ", return without image! typeof elem.parentNode = " + typeof elem.parentNode);
        logDSEARCH && console.log(`xIFr/deeperSearch(): Cannot go higher from ${elem.nodeName.toLowerCase()}, return without image! typeof elem.parentNode = ${typeof elem.parentNode}.`);
        return; // no image found
      }
      context.debug("deeperSearch(): Going from " + elem.nodeName?.toLowerCase() + " element, up to " + parentElem.nodeName?.toLowerCase() + " element...");
      logDSEARCH && console.log(`xIFr/deeperSearch(): Going from ${elem.nodeName} element, up to ${parentElem.nodeName} element...`);
      elem = parentElem;
      image = imageSearch(request, elem);
    }
    if (image) {
      context.debug("deeperSearch(): Return with image");
      // Check if bgAlternatives holds a better (jpeg-)alternative:
      let related = bgAlternatives.get(image.imageURL);
      if (related) {
        image.jpegURL = related.jpeg.url;
        image.jpegType = related.jpeg.type;
        image.imageType = related.other.type;
      }
      return image;
    } else {
      return deeperSearch(request, elem, xtrSizes);
    }
  }

  if (typeof globalThis.contentListenerAdded === 'undefined') {
    browser.runtime.onMessage.addListener(request => {

      if (request.message === "parseImage") {

        if (request.goDeepSearch) {

          /**************************************************************/
          /*  ***  Advanced mode with "deep-search" (Firefox 63+)  ***  */
          /**************************************************************/

          context.debug(" *** ADVANCED MODE WITH DEEP SEARCH *** ");
          /**
           * The right-clicked node/element
           * @type {?Element}
           */
          const elem = browser.menus.getTargetElement(request.targetId); // TODO can I use focused element instead if it fails? (but that requires there is only ONE contentscript running!)
          // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/getTargetElement
          // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/OnClickData
          if (elem) {
            request.nodeName = elem.nodeName?.toLowerCase(); // node name of context (right-click) target
            logDSEARCH && console.log(`xIFr: The righclicked element is a <${request.nodeName} /> (${elem}) found on ${elem.ownerDocument.documentURI} (${elem.ownerDocument}).`);
            logDSEARCH && console.log(`xIFr: The DocumentElement is a : <${elem.ownerDocument.documentElement?.nodeName?.toLowerCase()} /> (${elem.ownerDocument.documentElement})`);
            // console.log(`xIFr: OwnerDocument.images: (${JSON.stringify(Array.from(elem.ownerDocument.images).map(im => im.currentSrc))})`);
            if (elem.shadowRoot) {
              logDSEARCH && console.warn('xIFr: The rightclicked element hosts a shadowDOM which may be invisible for current version of the Deep Search algorithm!');
            }
            const extraLoads = [];
            let rootNode = elem.getRootNode({composed:false});
            if (rootNode instanceof ShadowRoot) {
              logDSEARCH && console.warn(`xIFr: We are in a shadowDOM (Host element: <${rootNode.host.nodeName?.toLowerCase()} />). Current version of xIFr might have limited Deep Search support here.`);
            }
            while (rootNode) {
              logDSEARCH && console.log(`xIFr: Finding "extras" to preload below root ${rootNode.nodeName?.toLowerCase()}...`);
              extraLoads.push(...getBgImgs(rootNode), ...getSVGEmbeddedImages(rootNode));
              rootNode = rootNode.host?.getRootNode({composed:false});
            }

            // Start finding and downloading images found in svg and in backgrounds, to find the dimensions...
            const extraImages = loadImgAll(Array.from(new Set(extraLoads)));
            const image = imageSearch(request, elem);
            if (image) {
              loadparseshow(image);
            } else {
              extraImages.then(xtrSizes => {
                context.debug("Going deep search with preloaded backgrounds plus images in svg and shadowDOM: " + JSON.stringify(xtrSizes));
                logDSEARCH && console.log(`xIFr: *** Doing deeperSearch with "extras": ${JSON.stringify([...extraLoads])}`);
                loadparseshow(deeperSearch(request, elem, xtrSizes.sort((a, b) => (b.weight || 1) - (a.weight || 1))))
              });
            }
          } else {
            logDSEARCH && console.log(`xIFr: A contextscript running on ${document.documentURI} (${document}) did not get a target element id!`);
            context.debug(`xIFr: A contextscript running on ${document.documentURI} (${document}) did not get a target element id`);
            // TODO but the focused element on page is...
          }

        } else if (typeof request.imageURL !== 'undefined' && request.mediaType === 'image') {

          /************************************************************************/
          /*  ***  Simple "legacy mode" (Chrome and older Firefox versions)  ***  */
          /*  ***      (or "deep search" forced disabled in options)         ***  */
          /************************************************************************/

          context.debug(" *** SIMPLE 'LEGACY' MODE *** ");
          request.nodeName = 'img'; // node name of context (right-click) target
          context.debug("parseImage message received with URL = " + request.imageURL);
          if (request.supportsDeepSearch) console.warn('xIFr: Using simple "legacy mode" even though browser supports Deep Search')
          const image = {};
          image.imageURL = request.imageURL;
          image.mediaType = 'image';
          image.supportsDeepSearch = request.supportsDeepSearch;
          image.goDeepSearch = request.goDeepSearch; // false
          image.supportsDeepSearchModifier = request.supportsDeepSearchModifier;
          image.deepSearchBiggerLimit = request.deepSearchBiggerLimit;
          image.deepSearchBigger = request.deepSearchBigger;
          image.fetchMode = request.fetchMode;
          image.tabId = request.tabId;
          image.tabUrl = request.tabUrl;
          image.source = "img element";
          image.context = request.nodeName + " element"; // (not really anything to de with found image)
          const img = Array.from(document.images).find(imgElem => imgElem.currentSrc === request.imageURL);
          if (img) {
            image.naturalWidth = img.naturalWidth;
            image.naturalHeight = img.naturalHeight;

            image.srcset = img.srcset;
            image.crossOrigin = img.crossOrigin;
            image.referrerPolicy = img.referrerPolicy; // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement
            image.baseURI = img.baseURI;
            image.x = img.x;
            image.y = img.y;
          } else {
            // Is it possible to arrive here? I'm not sure, but maybe if right-clicked image is in a shadowDOM?...
            // TODO: If so, maybe: New Image(request.imageURL); load promise -> dimensions ... ???
            logDSEARCH && console.warn('xIFr: Simple search did not find a match in document.images');
          }
          loadparseshow(image);

      } else {
        // Normally we should NOT get here...
        console.error('xIFr: No image detected in simple search.');
        }
      } else if (request.message === "displayInPage") {

        console.log('xIFr: Received message displayInPage with data ' + JSON.stringify(request.data));

        let dialog = document.querySelector('dialog#xIFr');
        if (dialog) {
          // remove
          dialog.close();
        } else if (document.body && (request.data.URL !== request.data.pageURL)) {
          // insert
          dialog = document.createElement('dialog');
          dialog.setAttribute('id', 'xIFr');
          dialog.setAttribute('style', 'box-sizing:border-box; max-width:90svw; max-height:90svh; padding:0; margin:auto; border:none; box-shadow: rgba(50, 52, 55, 0.2) 0 6px 18px;overflow:auto;pointer-events:auto;user-select:auto;');
          let img = document.createElement('img');
          img.setAttribute('src', request.data.URL);
          img.setAttribute('style', 'padding:0;margin:0;border:none;max-width:90svw;display:block;aspect-ratio:auto;pointer-events:auto;user-select:auto;');
          if (request.data.crossOrigin) {
            img.setAttribute('crossOrigin', request.data.crossOrigin);
          }
          dialog.replaceChildren(img);
          document.body.insertAdjacentElement('afterbegin', dialog);
          dialog.addEventListener("close", (e) => {dialog.remove();img=null;dialog=null}, {once: true});
          // https://stackoverflow.com/questions/21335136/how-to-re-enable-right-click-so-that-i-can-inspect-html-elements-in-chrome
          function bringBackDefault(event) {
            event.returnValue = true;
            event.stopPropagation();
          }
          img.addEventListener('contextmenu', bringBackDefault, true);
          img.addEventListener('dragstart', bringBackDefault, true);
          img.addEventListener('selectstart', bringBackDefault, true);
          img.addEventListener('mousedown', bringBackDefault, true);
          img.addEventListener('mouseup', bringBackDefault, true);
          dialog.addEventListener("click", (ev) => {ev.stopPropagation();ev.preventDefault();dialog.close()}, {once: true});
          dialog.showModal();
        }

      }
      return Promise.resolve(`The contentscript says thanks for the '${request.message}' message! 😊`);
    });
    globalThis.contentListenerAdded = true;
  }

})();
