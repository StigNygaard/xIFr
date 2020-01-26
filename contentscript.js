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
  var xhr = new XMLHttpRequest(); // Any issues with cross-domain in Chrome? Apparently not despite https://www.chromium.org/Home/chromium-security/extension-content-script-fetches ? I don't understand...
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

      let errorsArr = []; // move errors from dataObj to this
      if (dataObj.error && dataObj.error.length > 0) {
        errorsArr.push(...dataObj.error);
        delete dataObj.error;
      }
      let warningsArr = []; // move warnings from dataObj to this
      if (dataObj.warning && dataObj.warning.length > 0) {
        warningsArr.push(...dataObj.warning);
        delete dataObj.warning;
      }
      let infosArr = [];

      context.debug("request: " + JSON.stringify(imgrequest));
      if (imgrequest.naturalWidth && imgrequest.supportsDeepSearch && !imgrequest.deepSearch && (imgrequest.naturalWidth * imgrequest.naturalHeight <= imgrequest.deepSearchBiggerLimit)) {
        infosArr.push('Not the expected image? You can force xIFr to look for a larger image than this, by holding down Shift key when selecting xIFr in the context menu!');
      }

      let propertiesObj = {};
      propertiesObj.URL = imgrequest.imageURL;
      propertiesObj.byteLength = arrayBuffer.byteLength || xhr.getResponseHeader('Content-Length');
      propertiesObj.contentType = xhr.getResponseHeader('Content-Type'); // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
      propertiesObj.lastModified = xhr.getResponseHeader('Last-Modified');
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

      // Todo: Actually used colorprofile/colorspace would be nice too? How to find?

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

  xhr.addEventListener("error", () => {
    context.debug("wxIF xhr error:" + xhr.statusText);
  });

  context.debug("Read image data (xhr.send())...");
  xhr.send();
}


var deepSearchGenericLimit = 10 * 10; // Just not relevant if that small

function imageSearch(request, elem) {
  context.debug("imageSearch(): Looking for img elements on/below " + elem.nodeName.toLowerCase());
  let candidate;
  for (var img of document.images) {
    if (elem.contains(img)) { // img is itself/elem or img is a "sub-node"
      context.debug("Found image within target element! img.src=" + img.src + " and naturalWidth=" + img.naturalWidth + ", naturalHeight=" + img.naturalHeight);
      // We could look for best match, or just continue with the first we find?
      if (img.naturalWidth > 10) { // Can't remember why I made this check? Superfluous? We compare with deepSearchGenericLimit further down
        context.debug("Candidate!?");
        let propDisplay = window.getComputedStyle(img, null).getPropertyValue('display'); // none?
        let propVisibility = window.getComputedStyle(img, null).getPropertyValue('visibility'); // hidden?
        // Maybe also look at computed opacity ??!
        context.debug("PROPs! display=" + propDisplay + ", visibility=" + propVisibility);
        if (img.naturalWidth && img.nodeName.toUpperCase() === 'IMG' && propDisplay !== 'none' && propVisibility !== 'hidden' ) {
          if ((request.deepSearch && (img.naturalWidth * img.naturalHeight) > request.deepSearchBiggerLimit) || (!request.deepSearch && (img.naturalWidth * img.naturalHeight) > deepSearchGenericLimit)) {
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
    image.deepSearch = request.deepSearch;
    image.source = candidate.nodeName.toLowerCase() + " element";  // 'img element';
    image.context = request.nodeName + " element"; // (not really anything to de with found image)
    context.debug("imageSearch(): Returning found image (img) " + JSON.stringify(image));
    return image;
  }
  // nothing found by simple search
}

function bgSearch(request, elem, bgSizes) {
  context.debug("bgSearch(): Looking for backgrounds on/below " + elem.nodeName.toLowerCase());
  let bgImgs = getBgImgs(elem);
  context.debug("bgSearch(): Following bgImgs are found on/below: " + JSON.stringify(bgImgs));
  if (bgImgs && bgImgs.length > 0) {
    context.debug("Found BACKGROUND-IMAGE: " + bgImgs[0]);
    context.debug("Looking for dimensions of BACKGROUND-IMAGE via " + JSON.stringify(bgSizes));
    for (let bgSrc of bgImgs) {
      let imgData = bgSizes.find(bg => bg.src === bgSrc);
      if (imgData.width && ((request.deepSearch && ((imgData.width * imgData.height) > request.deepSearchBiggerLimit)) || (!request.deepSearch && ((imgData.width * imgData.height) > deepSearchGenericLimit)))) {
        let image = {};
        image.imageURL = bgSrc;
        image.mediaType = 'image';
        image.naturalWidth = imgData.width;
        image.naturalHeight = imgData.height;
        image.supportsDeepSearch = request.supportsDeepSearch;
        image.deepSearchBiggerLimit = request.deepSearchBiggerLimit;
        image.deepSearch = request.deepSearch;
        image.source = 'background-image of an element'; // probably elem.nodeName, but not for sure
        image.context = request.nodeName + " element"; // (not really anything to de with found image)
        context.debug("bgSearch(): Returning found image (background) " + JSON.stringify(image));
        return image;
      }
    }
  }
}

function deeperSearch(request, elem, bgSizes) {
  context.debug("Entering deeperSearch() with elem=" + elem.nodeName + " and elem.parentNode=" + elem.parentNode.nodeName);
  let image = bgSearch(request, elem, bgSizes);
  if (!image) {
    context.debug("deeperSearch(): No image from bgSearch()");
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
    return deeperSearch(request, elem, bgSizes);
  }
}

if (typeof contentListenerAdded === 'undefined') {
  browser.runtime.onMessage.addListener(request => {

    if (request.message === "parseImage") {

      if (request.supportsDeepSearch) {

        /**************************************************************/
        /*  ***  Advanced mode with "deep-search" (Firefox 63+)  ***  */
        /**************************************************************/

        let elem = browser.menus.getTargetElement(request.targetId);
        if (elem) {
          request.nodeName = elem.nodeName.toLowerCase(); // node name of context (right-click) target
          let bgImages = loadImgAll(getBgImgs(document)); // start finding and downloading background images to find the dimensions
          let image = imageSearch(request, elem);
          if (image) {
            loadparseshow(image);
          } else {
            bgImages.then(bgSizes => {context.debug("Going deep search with preloaded backgrounds: " + JSON.stringify(bgSizes)); loadparseshow(deeperSearch(request, elem, bgSizes))});
          }
        }

      } else if (typeof request.imageURL !== 'undefined' && request.mediaType === 'image') {

        /************************************************************************/
        /*  ***  Simple "legacy mode" (Chrome and older Firefox versions)  ***  */
        /************************************************************************/

        request.nodeName = 'img'; // node name of context (right-click) target
        context.debug("parseImage message received with URL = " + request.imageURL);
        let image = {};
        image.imageURL = request.imageURL;
        image.mediaType = 'image';
        image.supportsDeepSearch = request.supportsDeepSearch; // false
        image.deepSearchBiggerLimit = request.deepSearchBiggerLimit;
        image.deepSearch = request.deepSearch;
        image.source = "img element";
        image.context = request.nodeName + " element"; // (not really anything to de with found image)
        let img = Array.from(document.images).find(imgElem => imgElem.currentSrc === request.imageURL);
        if (img) {
          image.naturalWidth = img.naturalWidth;
          image.naturalHeight = img.naturalHeight;
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
