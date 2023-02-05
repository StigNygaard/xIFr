function createRichElement(tagName, attributes, ...content) {
  let element = document.createElement(tagName);
  if (attributes) {
    for (const [attr, value] of Object.entries(attributes)) {
      element.setAttribute(attr, value);
    }
  }
  if (content?.length) {
    element.append(...content);
  }
  return element;
}

const PURL = /(?<=[\[:;,({\s]|^)((http|https):\/\/)?[a-z0-9][-a-z0-9.]{1,249}\.[a-z][a-z0-9]{1,62}\b([-a-z0-9@:%_+.~#?&/=]*)/im; // Lookbehind requires Firefox 78+ (Chrome 62+)
const PEMAIL = /(?<=[\[:;,({\s]|^)(mailto:)?([a-z0-9._-]+@[a-z0-9][-a-z0-9.]{1,249}\.[a-z][a-z0-9]{1,62})/im; // Lookbehind requires Firefox 78+ (Chrome 62+)
// Return "Linkified content" as a list of DOMStrings and Nodes, to (spread and) insert with methods like ParentNode.append(), ParentNode.replaceChildren() and ChildNode.replaceWith()
function linkifyWithNodeAppendables(str, anchorattributes) { // Needs a better name? :-)
  function httpLinks(str, anchorattributes) {
    let a = str.match(PURL); // look for webdomains
    if (a === null) {
      return [str];
    } else {
      if (!anchorattributes) anchorattributes = {};
      let durl = a[0].replace(/[:\.]+$/, "");  // remove trailing dots and colons
      anchorattributes.href = durl.search(/^https?:\/\//) === -1 ? "http://" + durl : durl;
      let begin = str.substring(0, str.indexOf(durl));
      let end = str.substring(begin.length + durl.length); // Use "code units" count
      // let end = str.substring([...begin].length + [...durl].length); // Use character count ?
      return [begin, createRichElement('a', anchorattributes, durl), ...httpLinks(end, anchorattributes)]; // recursive
    }
  }
  function mailtoAndHttpLinks(str, anchorattributes) {
    let e = str.match(PEMAIL); // look for emails
    if (e === null) {
      return [...httpLinks(str)];
    } else {
      if (!anchorattributes) anchorattributes = {};
      let demail = e[0];
      anchorattributes.href = demail.search(/^mailto:/) === -1 ? "mailto:" + demail : demail;
      let begin = str.substring(0,str.indexOf(demail));
      let end = str.substring(begin.length + demail.length); // Use "code units" count
      // let end = str.substring([...begin].length + [...demail].length); // Use character count ?
      return [...httpLinks(begin), createRichElement('a', anchorattributes, demail), ...mailtoAndHttpLinks(end, anchorattributes)]; // recursive
    }
  }
  return mailtoAndHttpLinks(str, anchorattributes);
}
// Return "linebreaked and linkified content" as list of DOMStrings and Nodes, to (spread and) insert with ParentNode.append(), ParentNode.replaceChildren() and ChildNode.replaceWith()
// (Will convert both "symbolic" and real linefeeds to actual <br /> DOM elements)
function formatWithNodeAppendables(s) { // Needs a better name? :-)
  s = s.replace(/\x00/g, ""); // Remove confusing nulls
  if (s.indexOf("\\r") > -1) {
    s = s.split("\\n").join("");
  } else {
    s = s.split("\\n").join("\\r");
  }
  s = s.split("\n").join("\\r");
  let lines = s.split("\\r");
  for (let i = lines.length - 1; i > 0; i--) {
    lines.splice(i, 0, document.createElement('br'));
    lines.splice(i + 1, 1, ...linkifyWithNodeAppendables(lines[i + 1]));
  }
  return [...linkifyWithNodeAppendables(lines[0]), ...lines.slice(1)];
}
let keyShortcuts = (function KeyShortcuts() {
  const shortcuts = new Map();
  window.addEventListener("keydown", function keydownListener(event) {
    if (event.defaultPrevented) {
      return; // Do nothing if the event was already processed
    }
    if (!event.repeat && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (shortcuts.has(event.key)) {
        shortcuts.get(event.key)(event); // Do the shortcut handler
        event.preventDefault();
      }
    }
  }, true);
  function register(key, handler) {
    // Add key/handler
    shortcuts.set(key, handler);
  }
  // API:
  return {register};
})();
function populate(response) {
  keyShortcuts.register("Escape", function closePopup(){self.close()});
  function thumbsize(fullwidth, fullheight) {
    let w;
    let h;
    if (fullwidth > fullheight) {
      w = Math.min(200, fullwidth);
      h = Math.round((w / fullwidth) * fullheight);
    } else {
      h = Math.min(200, fullheight);
      w = Math.round((h / fullheight) * fullwidth);
    }
    return {width: w + 'px', height: h + 'px'};
  }
  if (response.properties.URL) {
    const image = document.querySelector("#image img");
    if (response.properties.naturalWidth) {
      const ts = thumbsize(response.properties.naturalWidth, response.properties.naturalHeight);
      image.style.width = ts.width;
      image.style.height = ts.height;
    }
    image.addEventListener("error", function() {
      console.error("Load image error for " + response.properties.URL)
    });
    image.addEventListener("load", function() {
      response.properties.naturalWidth = image.naturalWidth;
      response.properties.naturalHeight = image.naturalHeight;
      // Redo calculation if successfully loaded (Loading might fail if from file:):
      const ts = thumbsize(response.properties.naturalWidth, response.properties.naturalHeight);
      image.style.width = ts.width;
      image.style.height = ts.height;
      if (typeof response.properties.naturalWidth === 'number') {
        document.getElementById("dimensions").textContent = response.properties.naturalWidth + "x" + response.properties.naturalHeight + " pixels";
      }
    });
    image.src = response.properties.URL;

    function linkProperties(imageUrl) {
      const linkElem = createRichElement("a", {href: imageUrl});  // TODO: Can we use URL object here instead?
      let textContent;
      let title = "";
      if (imageUrl.startsWith("data:")) {
        textContent = "[ inline imagedata ]";
      } else if (imageUrl.startsWith("blob:")) {
        textContent = "[ blob imagedata ]";
        title = imageUrl;
      } else {
        textContent = (linkElem.pathname.length > 1 ? linkElem.pathname.substring(linkElem.pathname.lastIndexOf("/") + 1) : linkElem.hostname || linkElem.host) || "[ ./ ]";
        title = imageUrl;
      }
      return {
        url: imageUrl,
        name: textContent,
        title: title
      }
    }

    const linkProps = linkProperties(image.src);
    document.getElementById("filename").textContent = linkProps.name;
    document.getElementById("filename").title = linkProps.title;
    document.getElementById("filename").href = linkProps.url;
    if (response.properties.pageShownURL) {
      const origLinkProps = linkProperties(response.properties.pageShownURL);
      document.getElementById("orig_filename").textContent = origLinkProps.name;
      document.getElementById("orig_filename").title = origLinkProps.title;
      document.getElementById("orig_filename").href = origLinkProps.url;
      if (response.properties.pageShownType) {
        document.getElementById("orig_type").textContent = "(" + response.properties.pageShownType + ")";
      }
      document.getElementById("orig_shown").style.display = 'inline';
    }
    document.getElementById("imgsize").textContent = response.properties.byteLength;
    document.getElementById("imgsize2").textContent = response.properties.byteLength >= 1048576 ? ((response.properties.byteLength / 1048576).toFixed(2)).toString() + " MB" : ((response.properties.byteLength / 1024).toFixed(2)).toString() + " KB";
    if (response.properties.URL.startsWith("file:")) {
      document.getElementById("contenttype").textContent = "";
      document.getElementById("lastmodified").textContent = "";
    } else {
      document.getElementById("contenttype").textContent = response.properties.contentType;
      document.getElementById("lastmodified").textContent = response.properties.lastModified;
    }
    if (typeof response.properties.naturalWidth === 'number') {
      document.getElementById("dimensions").textContent = response.properties.naturalWidth + "x" + response.properties.naturalHeight + " pixels";
    }
  }
  function addMessages(list, icon, alt) {
    list.forEach(function (item) {
      const msg = createRichElement('i', {}, item);
      const sign = createRichElement('img', {src: icon, alt: alt});
      document.getElementById('messages').appendChild(createRichElement('div', {}, sign, ' ', msg));
    });
  }
  if (response.errors.length > 0 || response.warnings.length > 0 || response.infos.length > 0) {
    addMessages(response.errors, '/icons/error-7-32w.png', '!');
    addMessages(response.warnings, '/icons/warn-32w.png', '!');
    addMessages(response.infos, '/icons/info-32w.png', 'i');
    document.getElementById('messages').style.display = 'block';
  }

  function gpsRowClick(event) {
    event.preventDefault();
    document.body.classList.add('expandGps');
    document.querySelectorAll('.gps.expandable').forEach(
      function(elm) {
        const row = elm.parentNode.parentNode;
        row.removeAttribute('title');
        row.classList.remove('clickable', 'notice');
        row.removeEventListener("click", gpsRowClick, {capture: true, once: true});
      });
  }
  function softwareRowClick(event) {
    event.preventDefault();
    document.body.classList.add('expandSoftware');
    const elm = document.querySelector('.software.expandable');
    if (elm) {
      const row = elm.parentNode.parentNode;
      row.removeAttribute('title');
      row.classList.remove('clickable', 'notice');
    }
  }
  function listArrayWithNodeAppendables(arr) { // Inserting linebreaks to get one item pr. line
    const ret = [];
    arr.forEach(function(item) {ret.push(item); ret.push(document.createElement('br'))});
    return ret;
  }
  const table = document.getElementById("data");
  function addDataRow(key_v) {
    if (key_v !== "GPSPureDdLat" && key_v !== "GPSPureDdLon" && key_v !== "AdditionalSoftware" && response.data[key_v].value !== null && response.data[key_v].value !== "") {
      const row = table.insertRow(-1);
      const label = row.insertCell(0);
      const value = row.insertCell(1);
      label.textContent = response.data[key_v].label;
      label.id = key_v + "LabelCell";
      value.textContent = response.data[key_v].value;
      value.id = key_v + "ValueCell";
      if (["LicenseURL", "CreditLine", "Copyright", "CreatorEmails", "CreatorURLs"].includes(key_v)) {
        const text = value.textContent.trim();
        value.replaceChildren(...linkifyWithNodeAppendables(text));  // Text with links - ParentNode.replaceChildren() requires Firefox 78+ (or Chrome/Edge 86+)
      } else
      if (["Caption", "UsageTerms", "DocumentNotes", "UserComment", "Comment", "Instructions"].includes(key_v)) {
        const text = value.textContent.trim();
        value.replaceChildren(...formatWithNodeAppendables(text));  // Text with linebreaks - ParentNode.replaceChildren() requires Firefox 78+ (or Chrome/Edge 86+)
      } else if (key_v === "Keywords") {
        row.classList.add('scsv');
      } else if (key_v === 'GPSLat') {
        value.insertBefore(createRichElement('div', {id: 'maplinks'}), value.firstChild);
        value.insertAdjacentElement("beforeend", createRichElement('span', {class: 'gps expandable'}, document.createElement('br'), response.data['GPSPureDdLat'].value + " (decimal)"));
        row.title = "Click for decimal latitude and longitude values";
        row.classList.add('clickable', 'notice');
        row.addEventListener("click", gpsRowClick, {capture: true, once: true});
      } else if (key_v === 'GPSLon') {
        value.insertAdjacentElement("beforeend", createRichElement('span', {class: 'gps expandable'}, document.createElement('br'), response.data['GPSPureDdLon'].value + " (decimal)"));
        row.title = "Click for decimal latitude and longitude values";
        row.addEventListener("click", gpsRowClick, {capture: true, once: true});
        row.classList.add('clickable', 'notice');
      } else if (key_v === "Software" && response.data['AdditionalSoftware'] && response.data['AdditionalSoftware'].value && response.data['AdditionalSoftware'].value.length) {
        value.insertAdjacentElement("afterbegin", createRichElement('span', {class: 'software expandable'}, ...listArrayWithNodeAppendables(response.data['AdditionalSoftware'].value)));
        row.title = "Click for additional software used";
        row.addEventListener("click", softwareRowClick, {capture: true, once: true});
        row.classList.add('clickable', 'notice');
      } else if (key_v === 'ColorSpace') {
        row.title = "Notice: Color space given in Exif and XMP meta-data, might not be the same as actual image color space used!";
        row.classList.add('notice');
      }
    }
  }
  function showDataTab(event) {
    document.body.classList.replace("mapmode", "mainmode");
  }
  function showMapTab(event) {
    document.body.classList.replace("mainmode", "mapmode");
    // bbox calculation is a hack. Can do better with:
    // Destination point given distance and bearing from start point
    // https://www.movable-type.co.uk/scripts/latlong.html
    // Bearing
    // https://rechneronline.de/geo-coordinates/
    document.getElementById("osmap").src = "https://www.openstreetmap.org/export/embed.html?bbox=" + (response.data.GPSPureDdLon.value - 0.003) + "%2C" + (response.data.GPSPureDdLat.value - 0.007) + "%2C" + (response.data.GPSPureDdLon.value + 0.003) + "%2C" + (response.data.GPSPureDdLat.value + 0.007) + "&layer=mapnik&marker=" + response.data.GPSPureDdLat.value + "%2C" + response.data.GPSPureDdLon.value;
    document.getElementById("largermap").href = "https://www.openstreetmap.org/?mlat=" + response.data.GPSPureDdLat.value + "&mlon=" + response.data.GPSPureDdLon.value + "#map=15/" + response.data.GPSPureDdLat.value + "/" + response.data.GPSPureDdLon.value;
  }
  function openLargeMap(event) {
    if (document.body.classList.contains("mapmode")) {
      document.getElementById("largermap").click();
    }
  }
  function maplink(title, className, url, letter) {
    const link = createRichElement('a', {href: url}, letter);
    return createRichElement('div', {title: title, class: className}, link);
  }
  function openOptions(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    browser.runtime.openOptionsPage();
    self.close();
  }
  function copyPasteContent() {
    let s = 'FILE PROPERTIES\n\n';
    s += document.getElementById('properties').innerText + '\n\n';
    const rows = document.querySelectorAll('table#data tr');
    if (rows && rows.length > 0) {
      document.body.classList.add("copypastemode");
      s += 'IMAGE META DATA\n\n';
      rows.forEach((row) => {
        const tds = row.getElementsByTagName('td');
        if (tds && tds.length > 1) {
          s += tds[0].innerText + ': ' + tds[1].innerText + '\n';
        }
      });
      document.body.classList.remove("copypastemode");
    }
    return s;
  }
  function copyToClipboard(event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    // Copy to clipboard
    navigator.clipboard.writeText(copyPasteContent());
  }

  const orderedKeys = ["Headline", "Caption", "ObjectName", "Creditline", "Copyright", "UsageTerms", "LicenseURL",
    "Creator", "CreatorAddress", "CreatorCity", "CreatorRegion", "CreatorPostalCode", "CreatorCountry", "CreatorPhoneNumbers", "CreatorEmails", "CreatorURLs",
    "Date", "Make", "Model", "Lens", "FocalLengthText", "DigitalZoomRatio", "ApertureFNumber", "ExposureTime", "ISOequivalent", "FlashUsed", "WhiteBalance", "Distance",
    "GPSLat", "GPSLon", "GPSAlt", "GPSImgDir", "CountryName", "ProvinceState", "City", "Sublocation" ];
  const foundKeys = Object.keys(response.data);
  orderedKeys.filter(x => foundKeys.includes(x)).forEach(addDataRow);  // First the orderedKeys (Headline, Description, Creator, Copyright, Credit Line,...)
  foundKeys.filter(x => !orderedKeys.includes(x)).forEach(addDataRow); // Then the rest...
  if (response.data.GPSPureDdLat && response.data.GPSPureDdLon && typeof response.data.GPSPureDdLat.value === 'number' && typeof response.data.GPSPureDdLon.value === 'number') {
    document.getElementById("maintab").onclick = showDataTab;
    keyShortcuts.register("i", showDataTab);
    keyShortcuts.register("I", showDataTab);
    document.getElementById("maptab").onclick = showMapTab;
    keyShortcuts.register("m", showMapTab);
    keyShortcuts.register("M", showMapTab);
    keyShortcuts.register("l", openLargeMap);
    keyShortcuts.register("L", openLargeMap);
    const maplinks = document.getElementById('maplinks');
    if (maplinks) {
      const lat = response.data.GPSPureDdLat.value;
      const lon = response.data.GPSPureDdLon.value;
      const lang = browser.i18n.getUILanguage();
      const titleString = encodeURIComponent('Photo location').replace(/_/gu, ' '); // Used by Bing. Could potentially be filename or title, but underscores means trouble :-/ ...
      maplinks.appendChild(maplink('Locate on OpenStreetMap', 'OSM', `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&layers=M`, 'O'));
      maplinks.appendChild(maplink('Locate on Google Maps', 'Google', `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`, 'G'));
      maplinks.appendChild(maplink('Locate on Bing Maps', 'Bing', `https://www.bing.com/maps/?cp=%lat%~%lon%&lvl=16&sp=point.${lat}_${lon}_${titleString}`, 'B'));
      maplinks.appendChild(maplink('Locate on MapQuest', 'MapQuest', `https://www.mapquest.com/latlng/${lat},${lon}`, 'Q'));
      maplinks.appendChild(maplink('Locate on Here WeGo', 'Here', `https://share.here.com/l/${lat},${lon}`, 'H'));
      maplinks.appendChild(maplink('Explore nearby on Flickr', 'Flickr', `https://www.flickr.com/map/?fLat=${lat}&fLon=${lon}&zl=15`, 'F')); // "https://www.flickr.com/map/?fLat=${lat}&fLon=${lon}&zl=15&everyone_nearby=1"  -  &zl=15&min_upload_date=2019-06-07%2000%3A00%3A00&max_upload_date=2019-07-08%2000%3A00%3A00 ?
    }
  } else {
    // Disable map-tab
    document.getElementById('maptab').classList.add('disabled');
  }
  document.querySelectorAll('a').forEach((elem) => {
    elem.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      window.open(event.target.href, '_blank', 'noopener,noreferrer');
      self.close();
    }, true)
  });
  document.getElementById("settings").addEventListener('click', openOptions, true);
  keyShortcuts.register("o", openOptions);
  keyShortcuts.register("O", openOptions);
  if (navigator.clipboard && navigator.clipboard.writeText) { // Firefox 63+
    document.getElementById("cpClipboard").addEventListener('click', copyToClipboard, true);
    keyShortcuts.register("c", copyToClipboard);
    keyShortcuts.register("C", copyToClipboard);
  } else {
    document.body.classList.add('copyUnsupported'); // Hide copy button
  }
}
function setup(options) {
  if (context.prefersDark(options["dispMode"])) {
    document.body.classList.replace("light", "dark"); // If light, then swap with dark
    document.body.classList.add("dark"); // But also set dark if light wasn't set
  } else {
    document.body.classList.replace("dark", "light"); // If dark, then swap with light
    document.body.classList.add("light"); // But also set light if dark wasn't set
  }
  // Enable selected maplinks...
  ["OSM", "Google", "Bing", "MapQuest", "Here", "Flickr"].forEach((v) => {
    if (options["mlink" + v]) {
      document.body.classList.add("show" + v);
    }
  });
}
function init() {
  context.getOptions().then(setup);
  browser.runtime.sendMessage({
    message: "popupReady"
  }).then(populate);
}
window.addEventListener("DOMContentLoaded", init);
