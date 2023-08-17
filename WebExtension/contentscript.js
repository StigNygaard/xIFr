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
    const val = arr[arr.bisOffset] << 8 | arr[arr.bisOffset + 1];
    arr.bisOffset += 2;
    return val;
  };
  arr.readBytes = byteCount => {
    if (byteCount < 0) {
      context.error("readBytes(byteCount): Can't read negative byteCount=" + byteCount);
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


// Finding and loading backgrounds is slightly modified code from https://blog.crimx.com/2017/03/09/get-all-images-in-dom-including-background-en/ (by CRIMX) ...
function getBgImgs(elem) {
  const srcChecker = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/giu;
  return Array.from(
    (elem instanceof Element ? [elem] : []).concat(Array.from(elem.querySelectorAll('*'))) // Includes elem (itself) unless elem is (f.ex.) document
      .reduce((collection, node) => {
        const cstyle = window.getComputedStyle(node, null);
        const display = cstyle.getPropertyValue('display');
        const visibility = cstyle.getPropertyValue('visibility');
        const appleHack = location.hostname.endsWith('apple.com');
        if (display !== 'none' && visibility !== 'hidden') {
          let bgimage = cstyle.getPropertyValue('background-image');
          if (bgimage === 'none' && appleHack) {
            // A site-specific hack for apple.music.com...
            // I don't know how they do it (will have to investigate), but this works to
            // get the background-image in headers of "itunes" artist pages (as of 08/2023):
            bgimage = cstyle.getPropertyValue('--background-image');
          }
          let match;
          while ((match = srcChecker.exec(bgimage)) !== null) { // There might actually be multiple. Like:  background-image: url("img_tree.gif"), url("paper.gif");
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
    (elem.nodeName === 'image' ? [elem] : []).concat(Array.from(elem.querySelectorAll('svg image, svg feImage'))) // Includes elem (itself) unless elem is document
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
}
// But also: https://www.petercollingridge.co.uk/tutorials/svg/interactive/javascript/ ?

function loadImg(src, timeout = 500) {
  let imgPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => {
      resolve({
        src: src,
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    });
    img.addEventListener("error", function () {
      context.error("Deep Search load image error for " + src);
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
  if (!fetchOptions.headers) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Request/headers
    fetchOptions.headers = new Headers({'Accept': 'image/*'});
  } // or use Headers.append() !?
  if (AbortSignal?.timeout) {
    fetchOptions.signal = AbortSignal.timeout(fetchTimeout);
  }
  return fetch(url, fetchOptions)
    .then(
      function(response) {
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
      function(arrayBuffer) {
        if (arrayBuffer) {
          context.debug("Looking at the fetch response (arrayBuffer)...");
          context.info("headers.byteLength: " + result.byteLength);
          context.info("arraybuffer.byteLength: " + arrayBuffer.byteLength);
          result.byteArray = new Uint8Array(arrayBuffer);

          result.byteLength = arrayBuffer.byteLength || result.byteLength; // TODO: I guess these ain't both header values?

        }
        return result;
      }
    )
    .catch(
      function(error) {
        console.error('Error from frontend fetch', error.message, error)
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
        return result;
      }
    );
}

function loadparseshow(imgrequest) { // handleChosenOne
                                     // console.log('Properties for ' + imgrequest.imageURL + '... \n srcset=' + imgrequest.srcset + ' \n crossOrigin=' + imgrequest.crossOrigin + ' \n referrerPolicy=' + imgrequest.referrerPolicy + ' (' + (typeof imgrequest.referrerPolicy) + ')' + ' \n baseURI=' + imgrequest.baseURI);
  if (!imgrequest) {
    context.debug("Exit loadparseshow. Nothing to show!");
    context.error("Exit loadparseshow. Nothing to show!");
    return;
  }
  const propertiesObj = {};
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
  const errorsArr = []; // Messages to show as errors
  const warningsArr = []; // Messages to show as warnings
  const infosArr = []; // Messages to show as info

  // https://javascript.info/fetch
  // https://javascript.info/fetch-api
  // https://javascript.info/fetch-crossorigin
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts // In Firefox, make sure you are using absolute URLs !!!

  // Issues with cross-domain in Chrome: https://www.chromium.org/Home/chromium-security/extension-content-script-fetches
  // https://www.gmass.co/blog/send-cookie-cross-origin-xmlhttprequest-chrome-extension/ ,
  // https://blog.danawoodman.com/articles/send-session-cookies-using-a-chrome-extension ?
  // Access to fetch at 'https://cdn.fstoppers.com/styles/medium/s3/photos/286085/03/13/5398dd4c9fe90a471be6a9099d71eceb.jpg' from origin 'https://fstoppers.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource. If an opaque response serves your needs, set the request's mode to 'no-cors' to fetch the resource with CORS disabled.
  // Future Firefox?: https://bugzilla.mozilla.org/show_bug.cgi?id=1578405 (Deprecate Cross-Origin requests from content scripts ahead of Manifest v3)
  // Chrome Manifest V2-V3 timeline: https://www.bleepingcomputer.com/news/google/google-manifest-v2-chrome-extensions-to-stop-working-in-2023/
  // https://developers.google.com/web/updates/2020/07/referrer-policy-new-chrome-default
  // https://web.dev/referrer-best-practices/
  // Facebook img referrerPolicy = origin-when-cross-origin
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img
  // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement
  // A discussion if moving to backend: https://stackoverflow.com/questions/8593896/chrome-extension-how-to-pass-arraybuffer-or-blob-from-content-script-to-the-bac

  // TODO CORS preflighted requests ?! https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflighted_requests

  if (imgrequest.proxyURL) {
    infosArr.push('Image shown on webpage is in ' + imgrequest.imageType.replace('image/', '') + ' format. Found alternative (assumed similar) ' + (imgrequest.proxyType ? imgrequest.proxyType.replace('image/', '') : '') + ' image to look for meta-data in...');
    propertiesObj.pageShownURL = imgrequest.imageURL;
    propertiesObj.pageShownType = imgrequest.imageType;
    propertiesObj.URL = imgrequest.proxyURL;
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
      result.error = "Error trying to load image-file for parsing of the metadata!";
      result.info = "Possible work-around for error: Try opening image directly from above link, and open xIFr again directly from the displayed image";
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
      console.warn("fetch response (arrayBuffer) is empty!...");
      context.error("fetch response (arrayBuffer) is empty!...");
    }
  }


  // TODO: I'm trying to understand this sh*t to make it work in Chrome, but...
  // https://stackoverflow.com/questions/8593896/chrome-extension-how-to-pass-arraybuffer-or-blob-from-content-script-to-the-bac
  // https://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers

  // Firefox currently uses a better data-cloning algorithm than Chrome:
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities#data_cloning_algorithm
  // but maybe that could change in the future?:
  // https://bugs.chromium.org/p/chromium/issues/detail?id=248548

  context.debug(' *** fetchMode: ' + imgrequest.fetchMode + ' ***');

  // TODO: If file:, always do frontend fetch !?
  if (imgrequest.fetchMode === 'devFrontendFetch' || imgrequest.fetchMode === 'devAutoFetch' && context.isFirefox()) { // Do frontend fetch...
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
          (error) => console.error('fetchdata backend fetch - There has been a problem with your fetch operation: ', error.message, error)
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
          (error) => console.error('fetchdataBase64 backend fetch - There has been a problem with your fetch operation: ', error.message, error)
        );
    }

  }

}

globalThis.deepSearchGenericLimit = 10 * 10; // Just not relevant if that small
function blacklistedImage(src) { // todo: Make blacklist configurable!
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
  context.debug("imageSearch(): Looking for img elements on/below " + elem.nodeName.toLowerCase());
  let candidate;

  // If target-elem is a candidate, just set it now. If we are in shadowDOM we will not find it later (TODO: Better handling of shadowDOMs !)
  if (elem.nodeName && elem.nodeName.toLowerCase() === 'img' && elem.naturalWidth && !blacklistedImage(elem.currentSrc)) {
    if (((request.deepSearchBigger && (elem.naturalWidth * elem.naturalHeight) > request.deepSearchBiggerLimit) || (!request.deepSearchBigger && (elem.naturalWidth * elem.naturalHeight) > deepSearchGenericLimit))) {
      const propDisplay = window.getComputedStyle(elem, null).getPropertyValue('display');
      const propVisibility = window.getComputedStyle(elem, null).getPropertyValue('visibility');
      if (propDisplay !== 'none' && propVisibility !== 'hidden') {
        candidate = elem;
      }
    }
  }

  // https://time2hack.com/checking-overlap-between-elements/
  // https://www.youtube.com/watch?v=cUZ2r6C2skA
  // https://css-tricks.com/how-to-stack-elements-in-css/
  for (const img of document.images) {
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
              context.debug("Setting new candidate. -  document.images.length = " + document.images.length);
              candidate = img;
            }
          } else {
            context.debug("Setting first candidate. -  document.images.length = " + document.images.length);
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
    image.source = candidate.nodeName.toLowerCase() + " element";  // 'img element';
    image.context = request.nodeName + " element"; // (not really anything to de with found image)

    image.srcset = candidate.srcset;
    image.crossOrigin = candidate.crossOrigin;
    image.referrerPolicy = candidate.referrerPolicy; // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement
    image.baseURI = candidate.baseURI;
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
              const parts = found.trim().split(/\s+/);
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
              const parts = found.trim().split(/\s+/);
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
            const parts = found.trim().split(/\s+/);
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
              image.proxyURL = potential.url;
              image.proxyType = potential.type;
              return image;
            }
          }
          // If no exact descriptor-match in potentials, then use the one with "highest descriptor" (probably largest image)...
          const potential = potentials.reduce((max, other) => max.sortWeight > other.sortWeight ? max : other); // Find item with highest sortWeight (descriptor-value)
          image.proxyURL = potential.url;
          image.proxyType = potential.type;
          return image;
        }
        // If no potentials at all, use fallback img.src...
        image.proxyURL = candidate.src;
      }
      // If we arrive here, we are probably already using img fallback. Cannot do any better.
    }
    context.debug("imageSearch(): Returning found image (img) " + JSON.stringify(image));
    return image;
  }
  // nothing found by simple search
}

function extraSearch(request, elem, xtrSizes) {
  context.debug("extraSearch(): Looking for backgrounds/svg on/below " + elem.nodeName.toLowerCase());
  const xtrImgs = Array.from(new Set([...getBgImgs(elem), ...getSVGEmbeddedImages(elem)]))
  context.debug("extraSearch(): Following xtrImgs are found on/below: " + JSON.stringify(xtrImgs));
  if (xtrImgs && xtrImgs.length > 0) {
    context.debug("Found extra svg or background image: " + xtrImgs[0]);
    context.debug("Looking for dimensions of extra-images via " + JSON.stringify(xtrSizes));
    for (const xSrc of xtrImgs) {
      const imgData = xtrSizes.find(xs => xs.src === xSrc);
      if (imgData.width && !blacklistedImage(imgData.src) && ((request.deepSearchBigger && ((imgData.width * imgData.height) > request.deepSearchBiggerLimit)) || (!request.deepSearchBigger && ((imgData.width * imgData.height) > deepSearchGenericLimit)))) {
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
    if (elem.nodeName.toLowerCase() === 'html' || elem.nodeName.toLowerCase() === '#document' || elem instanceof HTMLDocument || !elem.parentNode) {
      context.debug("deeperSearch(): Cannot go higher from " + elem.nodeName.toLowerCase() + ", return without image!  typeof elem.parentNode = " + typeof elem.parentNode);
      return; // no image found
    }
    context.debug("deeperSearch(): Going from " + elem.nodeName + " element, up to " + elem.parentNode?.nodeName + " element...");
    elem = elem.parentNode;
    image = imageSearch(request, elem);
  }
  if (image) {
    context.debug("deeperSearch(): Return with image");
    return image;
  } else {
    return deeperSearch(request, elem, xtrSizes);
  }
}

if (typeof contentListenerAdded === 'undefined') {
  browser.runtime.onMessage.addListener(request => {

    if (request.message === "parseImage") {

      if (request.goDeepSearch) {

        /**************************************************************/
        /*  ***  Advanced mode with "deep-search" (Firefox 63+)  ***  */
        /**************************************************************/

        context.debug(" *** ADVANCED MODE WITH DEEP SEARCH *** ");
        const elem = browser.menus.getTargetElement(request.targetId);
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/getTargetElement
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/OnClickData
        if (elem) {
          request.nodeName = elem.nodeName.toLowerCase(); // node name of context (right-click) target
          const extraImages = loadImgAll(Array.from(new Set([...getBgImgs(document), ...getSVGEmbeddedImages(document)]))); // start finding and downloading images in svg and backgrounds to find the dimensions
          const image = imageSearch(request, elem);
          if (image) {
            loadparseshow(image);
          } else {
            extraImages.then(xtrSizes => {
              context.debug("Going deep search with preloaded backgrounds and images in svg: " + JSON.stringify(xtrSizes));
              loadparseshow(deeperSearch(request, elem, xtrSizes))
            });
          }
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
          // Is it possible to arrive here? I don't think so, but...
          // If so, maybe: New Image(request.imageURL); load promise -> dimensions
        }
        loadparseshow(image);

      }
    }
  });
}

globalThis.contentListenerAdded = true;
