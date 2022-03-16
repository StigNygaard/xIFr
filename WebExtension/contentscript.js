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
    if (byteCount < 0) {
      context.error("readBytes(byteCount): Can't read negative byteCount=" + byteCount);
      throw "xIFr contentscript.js, readBytes(byteCount): Can't read negative byteCount=" + byteCount;
      // pushError(dataObj, "[xmp]", ex);
      return;
    }
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
    var label = key;
    var val = data[key_v];
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
function getBgImgs (elem) {
  const srcChecker = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/giu;
  return Array.from(
    (elem === document ? [] : [elem]).concat(Array.from(elem.querySelectorAll('*'))) // Includes elem (itself) unless elem is document
      .reduce((collection, node) => {
        let cstyle = window.getComputedStyle(node, null);
        let display = cstyle.getPropertyValue('display');
        let visibility = cstyle.getPropertyValue('visibility');
        if (display !== 'none' && visibility !== 'hidden') {
          let bgimage = cstyle.getPropertyValue('background-image');
          // match 'url(...)'
          let match;
          while((match = srcChecker.exec(bgimage)) !== null ) { // There might actually be multiple. Like:  background-image: url("img_tree.gif"), url("paper.gif");
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
    (elem.nodeName==='image' ? [elem] : []).concat(Array.from(elem.querySelectorAll('svg image'))) // Includes elem (itself) unless elem is document
      .reduce((collection, node) => {
        let cstyle = window.getComputedStyle(node, null);
        let display = cstyle.getPropertyValue('display');
        let visibility = cstyle.getPropertyValue('visibility');
        if (display !== 'none' && visibility !== 'hidden') {
            if (node.href?.baseVal) {
              collection.add(node.href.baseVal);
          }
        }
        return collection;
      }, new Set())
  );
}

function loadImg (src, timeout = 500) {
  var imgPromise = new Promise((resolve, reject) => {
    let img = new Image();
    img.onload = () => { // Could we use https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode ?
      resolve({
        src: src,
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    };
    img.onerror = reject;
    img.src = src;
  });
  var timer = new Promise((resolve, reject) => {
    setTimeout(reject, timeout);
  });
  return Promise.race([imgPromise, timer]);
}
function loadImgAll (imgList, timeout = 500) { // Could we use https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode ?
  return new Promise((resolve, reject) => {
    Promise.all(
      imgList
        .map(src => loadImg(src, timeout))
        .map(p => p.catch(e => false))
    ).then(results => resolve(results.filter(r => r)));
  })
}


function loadparseshow(imgrequest) {
  if (!imgrequest) {
    context.debug("Exit loadparseshow. Nothing to show!");
    return;
  }

  let propertiesObj = {};
  propertiesObj.URL = imgrequest.imageURL;
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
  let errorsArr = []; // Messages to show as errors
  let warningsArr = []; // Messages to show as warnings
  let infosArr = []; // Messages to show as info

  var xhr = new XMLHttpRequest(); // Issues with cross-domain in Chrome: https://www.chromium.org/Home/chromium-security/extension-content-script-fetches
  // Future Firefox?: https://bugzilla.mozilla.org/show_bug.cgi?id=1578405
  // Chrome Manifest V2-V3 timeline: https://www.bleepingcomputer.com/news/google/google-manifest-v2-chrome-extensions-to-stop-working-in-2023/

  xhr.open("GET", imgrequest.imageURL, true);
  xhr.responseType = "arraybuffer";
  xhr.addEventListener("load", () => {
    var arrayBuffer = xhr.response;

    if (arrayBuffer) {
      context.debug("Looking at the xhr response (arrayBuffer)...");

      // This is the raw input from image file

      // DEBUG
      //let utf8decoder = new TextDecoder('utf-8');
      //var raw1 = utf8decoder.decode(arrayBuffer);
      //context.debug("raw1: \n:" + raw1.substr(0,25000));

      var byteArray = new Uint8Array(arrayBuffer);

      // DEBUG
      // let utf8decoder = new TextDecoder('utf-8');
      //var raw2 = utf8decoder.decode(byteArray);
      //context.debug("raw2: \n:" + raw2.substr(0,25000));
      //var dom = parser.parseFromString(raw, 'application/xml');
      //context.debug();

      context.debug("Call addByteStreamIF(byteArray)...");
      addByteStreamIF(byteArray);
      context.debug("Gather data from image header (fxifObj.gatherData(byteArray) = fxifClass.gatherData() in parseJpeg.js)...");
      var dataObj = fxifObj.gatherData(byteArray); // Gather data from header (via "markers" found in file)

      if (dataObj.error && dataObj.error.length > 0) {
        errorsArr.push(...dataObj.error);
        delete dataObj.error;
      }
      if (dataObj.warning && dataObj.warning.length > 0) {
        warningsArr.push(...dataObj.warning);
        delete dataObj.warning;
      }

      context.debug("request: " + JSON.stringify(imgrequest));
      if (imgrequest.naturalWidth && imgrequest.supportsDeepSearch && !imgrequest.deepSearchBigger && (imgrequest.naturalWidth * imgrequest.naturalHeight <= imgrequest.deepSearchBiggerLimit)) {
        infosArr.push('Not the expected image? You can force xIFr to look for a larger image than this, by holding down Shift key when selecting xIFr in the context menu!');
      }

      propertiesObj.byteLength = arrayBuffer.byteLength || xhr.getResponseHeader('Content-Length');
      propertiesObj.contentType = xhr.getResponseHeader('Content-Type'); // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
      propertiesObj.lastModified = xhr.getResponseHeader('Last-Modified');
      context.debug("Gathered data: \n" + JSON.stringify(dataObj));
      let xlatData = translateFields(dataObj);
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
      context.debug("xhr response (arrayBuffer) is empty!...");
    }
  });

  xhr.addEventListener("error", (pEvent) => {
    context.error("xIFr: xhr-ERROR trying to read image-data from url: " + imgrequest.imageURL);
    context.debug("xIFr: xhr-ERROR status:" + xhr.status);
    context.debug("xIFr: xhr-ERROR statusText:" + xhr.statusText);
    context.debug("xIFr: xhr-ERROR Event.lengthComputable:" + pEvent.lengthComputable);

    errorsArr.push("Error trying to load image-file for parsing of the metadata!");
    infosArr.push("Possible work-around for error: Try opening image directly from above link, and open xIFr again directly from the displayed image");
    propertiesObj.byteLength = xhr.getResponseHeader('Content-Length');
    propertiesObj.contentType = xhr.getResponseHeader('Content-Type'); // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
    propertiesObj.lastModified = xhr.getResponseHeader('Last-Modified');
    browser.runtime.sendMessage({
      message: "EXIFready",
      data: {},
      properties: propertiesObj,
      errors: errorsArr,
      warnings: warningsArr,
      infos: infosArr
    });
  });

  context.debug("Read image data (xhr.send())...");
  // xhr.withCredentials = true; // todo ????
  xhr.send(); // todo: Versions 85+ of Chrome/Chromium often fail here doing xhr.send()  (https://www.chromium.org/Home/chromium-security/extension-content-script-fetches)
  // Is this related to the Chrome issue?:
  // https://www.gmass.co/blog/send-cookie-cross-origin-xmlhttprequest-chrome-extension/ ,
  // https://blog.danawoodman.com/articles/send-session-cookies-using-a-chrome-extension ?
}


var deepSearchGenericLimit = 10 * 10; // Just not relevant if that small
function blacklistedImage(src) { // todo: Make blacklist configurable!
  return [{
    url: "https://combo.staticflickr.com/ap/build/images/sprites/icons-cc4be245.png",
    regexp: false
  }, {
    url: "https://combo.staticflickr.com/ap/build/images/fave-test/white@1x.png",
    regexp: false
  }, {
    url: "https://static.kuula.io/prod/assets/sprites-main.png",
    regexp: false
  }, {
    url: "https://www.instagram.com/static/bundles/es6/sprite_core_32f0a4f27407.png/32f0a4f27407.png",
    regexp: false
  }].some(function (item) {
    return src === item.url
  });
}
function imageSearch(request, elem) {
  context.debug("imageSearch(): Looking for img elements on/below " + elem.nodeName.toLowerCase());
  let candidate;
  for (let img of document.images) {
    if (elem.contains(img)) { // img is itself/elem or img is a "sub-node"
      context.debug("Found image within target element! img.src=" + img.src + " and naturalWidth=" + img.naturalWidth + ", naturalHeight=" + img.naturalHeight);
      // We could look for best match, or just continue with the first we find?
      context.debug("Candidate!?");
      let propDisplay = window.getComputedStyle(img, null).getPropertyValue('display'); // none?
      let propVisibility = window.getComputedStyle(img, null).getPropertyValue('visibility'); // hidden?
      // Maybe also look at computed opacity ??!
      context.debug("PROPs! display=" + propDisplay + ", visibility=" + propVisibility);
      if (img.naturalWidth && img.nodeName.toUpperCase() === 'IMG' && propDisplay !== 'none' && propVisibility !== 'hidden' ) {
        if (!blacklistedImage(img.src) && ((request.deepSearchBigger && (img.naturalWidth * img.naturalHeight) > request.deepSearchBiggerLimit) || (!request.deepSearchBigger && (img.naturalWidth * img.naturalHeight) > deepSearchGenericLimit))) {
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
    let image = {}; // result
    image.imageURL = candidate.currentSrc || candidate.src;
    image.mediaType = 'image';
    image.naturalWidth = candidate.naturalWidth;
    image.naturalHeight = candidate.naturalHeight;
    image.supportsDeepSearch = request.supportsDeepSearch;
    image.deepSearchBiggerLimit = request.deepSearchBiggerLimit;
    image.deepSearchBigger = request.deepSearchBigger;
    image.source = candidate.nodeName.toLowerCase() + " element";  // 'img element';
    image.context = request.nodeName + " element"; // (not really anything to de with found image)

    image.srcset = candidate.srcset;
    image.crossOrigin = candidate.crossOrigin;
    image.referrerPolicy = candidate.referrerPolicy; // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement
    image.baseURI = candidate.baseURI;
    image.x = candidate.x;
    image.y = candidate.y;

    context.debug("imageSearch(): Returning found image (img) " + JSON.stringify(image));
    return image;
  }
  // nothing found by simple search
}

function extraSearch(request, elem, xtrSizes) {
  context.debug("extraSearch(): Looking for backgrounds/svg on/below " + elem.nodeName.toLowerCase());
  let xtrImgs = Array.from(new Set([...getBgImgs(elem), ...getSVGEmbeddedImages(elem)]))
  context.debug("extraSearch(): Following xtrImgs are found on/below: " + JSON.stringify(xtrImgs));
  if (xtrImgs && xtrImgs.length > 0) {
    context.debug("Found extra svg or background image: " + xtrImgs[0]);
    context.debug("Looking for dimensions of extra-images via " + JSON.stringify(xtrSizes));
    for (let xSrc of xtrImgs) {
      let imgData = xtrSizes.find(xs => xs.src === xSrc);
      if (imgData.width && !blacklistedImage(imgData.src) && ((request.deepSearchBigger && ((imgData.width * imgData.height) > request.deepSearchBiggerLimit)) || (!request.deepSearchBigger && ((imgData.width * imgData.height) > deepSearchGenericLimit)))) {
        let image = {};
        image.imageURL = xSrc;
        image.mediaType = 'image';
        image.naturalWidth = imgData.width;
        image.naturalHeight = imgData.height;
        image.supportsDeepSearch = request.supportsDeepSearch;
        image.deepSearchBiggerLimit = request.deepSearchBiggerLimit;
        image.deepSearchBigger = request.deepSearchBigger;
        image.source = 'extra-search image'; // probably elem.nodeName, but not for sure
        image.context = request.nodeName + " element"; // (not really anything to de with found image)

        image.baseURI = elem.baseURI;
        //     image.srcset = candidate.srcset;
        //     image.crossOrigin = candidate.crossOrigin;
        //     image.referrerPolicy = candidate.referrerPolicy; // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement
        //     image.baseURI = candidate.baseURI;
        //     image.x = candidate.x;
        //     image.y = candidate.y;

        context.debug("extraSearch(): Returning found image (background or svg) " + JSON.stringify(image));
        return image;
      }
    }
  }
}

function deeperSearch(request, elem, xtrSizes) {
  context.debug("Entering deeperSearch() with elem=" + elem.nodeName + " and elem.parentNode=" + elem.parentNode.nodeName);
  let image = extraSearch(request, elem, xtrSizes);
  if (!image) {
    context.debug("deeperSearch(): No image from extraSearch()");
    if (elem.nodeName.toLowerCase() === 'html' || elem.nodeName.toLowerCase() === '#document' || elem instanceof HTMLDocument || !elem.parentNode) {
      context.debug("deeperSearch(): Cannot go higher from " + elem.nodeName.toLowerCase() + ", return without image!  typeof elem.parentNode = " + typeof elem.parentNode);
      return; // no image found
    }
    context.debug("deeperSearch(): Going from " + elem.nodeName + " element, up to " + elem.parentNode.nodeName + " element...");
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

      if (request.supportsDeepSearch) {

        /**************************************************************/
        /*  ***  Advanced mode with "deep-search" (Firefox 63+)  ***  */
        /**************************************************************/

        context.debug(" *** ADVANCED MODE WITH DEEP SEARCH *** ");
        let elem = browser.menus.getTargetElement(request.targetId);
        if (elem) {
          request.nodeName = elem.nodeName.toLowerCase(); // node name of context (right-click) target
          let extraImages = loadImgAll(Array.from(new Set([...getBgImgs(document), ...getSVGEmbeddedImages(document)]))); // start finding and downloading images in svg and backgrounds to find the dimensions
          let image = imageSearch(request, elem);
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
        /************************************************************************/

        context.debug(" *** SIMPLE 'LEGACY' MODE *** ");
        request.nodeName = 'img'; // node name of context (right-click) target
        context.debug("parseImage message received with URL = " + request.imageURL);
        let image = {};
        image.imageURL = request.imageURL;
        image.mediaType = 'image';
        image.supportsDeepSearch = request.supportsDeepSearch; // false
        image.deepSearchBiggerLimit = request.deepSearchBiggerLimit;
        image.deepSearchBigger = request.deepSearchBigger;
        image.source = "img element";
        image.context = request.nodeName + " element"; // (not really anything to de with found image)
        let img = Array.from(document.images).find(imgElem => imgElem.currentSrc === request.imageURL);
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

var contentListenerAdded = true;
