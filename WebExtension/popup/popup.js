function createRichElement(tagName, attributes, ...content) {
  let element = document.createElement(tagName);
  if (attributes) {
    for (const [attr, value] of Object.entries(attributes)) {
      element.setAttribute(attr, value);
    }
  }
  if (content && content.length) {
    element.append(...content);
  }
  return element;
}
function populate(response) {
  if (response.properties.URL) {
    var image = document.querySelector("#image img");
    if (response.properties.naturalWidth) {
      let w;
      let h;
      if (response.properties.naturalWidth > response.properties.naturalHeight) {
        w = Math.min(200, response.properties.naturalWidth);
        h = Math.round((w / response.properties.naturalWidth) * response.properties.naturalHeight);
      } else {
        h = Math.min(200, response.properties.naturalHeight);
        w = Math.round((h / response.properties.naturalHeight) * response.properties.naturalWidth);
      }
      image.style.width = w + 'px';
      image.style.height = h + 'px';
    }
    image.src = response.properties.URL;
    let url = createRichElement('a', {href: response.properties.URL});
    if (response.properties.URL.startsWith("data:")) {
      document.getElementById("filename").textContent = "[ inline imagedata ]";
      document.getElementById("filename").title = "";
    } else if (response.properties.URL.startsWith("blob:")) {
      document.getElementById("filename").textContent = "[ blob imagedata ]";
      document.getElementById("filename").title = response.properties.URL;
    } else {
      document.getElementById("filename").textContent = (url.pathname.length > 1 ? url.pathname.substring(url.pathname.lastIndexOf("/") + 1) : url.hostname || url.host) || "[ ./ ]";
      document.getElementById("filename").title = response.properties.URL;
    }
    document.getElementById("filename").href = response.properties.URL;
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
    document.getElementById("dimensions").textContent = response.properties.naturalWidth + "x" + response.properties.naturalHeight + " pixels";
  }
  function addMessages(list, icon, alt) {
    list.forEach(function (item) {
      let msg = createRichElement('i', {}, item);
      let sign = createRichElement('img', {src: icon, alt: alt});
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
        let row = elm.parentNode.parentNode;
        row.removeAttribute('title');
        row.classList.remove('clickable');
        row.removeEventListener("click", gpsRowClick, {capture: true, once: true});
      });
  }
  function softwareRowClick(event) {
    event.preventDefault();
    document.body.classList.add('expandSoftware');
    let elm = document.querySelector('.software.expandable');
    if (elm) {
      let row = elm.parentNode.parentNode;
      row.removeAttribute('title');
      row.classList.remove('clickable');
    }
  }
  function arrayToNodeAppendables(arr) {
    let ret = [];
    arr.forEach(function(item) {ret.push(item); ret.push(document.createElement('br'))});
    return ret;
  }
  function formattedTextToNodeAppendables(s) {
    if (s.indexOf("\\r") > -1) {
      s = s.split("\\n").join("");
    } else {
      s = s.split("\\n").join("\\r");
    }
    let lines = s.split("\\r");
    for (let i = lines.length - 1; i > 0; i--) {
      lines.splice(i, 0, document.createElement('br'));
    }
    return lines;
  }
  var table = document.getElementById("data");
  function addDataRow(key_v) {
    if (key_v !== "GPSPureDdLat" && key_v !== "GPSPureDdLon" && key_v !== "AdditionalSoftware" && response.data[key_v].value !== null && response.data[key_v].value !== "") {
      var row = table.insertRow(-1);
      var label = row.insertCell(0);
      var value = row.insertCell(1);
      label.textContent = response.data[key_v].label;
      label.id = key_v + "LabelCell";
      value.textContent = response.data[key_v].value;
      value.id = key_v + "ValueCell";
      if (key_v === "Caption") {
        let description = value.textContent.trim();
        value.textContent = ''; // clear
        value.append(...formattedTextToNodeAppendables(description));  // Description with linebreaks
      } else if (key_v === "Keywords") {
        row.classList.add('scsv');
      } else if (key_v === 'GPSLat') {
        value.insertBefore(createRichElement('div', {id: 'maplinks'}), value.firstChild);
        value.insertAdjacentElement("beforeend", createRichElement('span', {class: 'gps expandable'}, document.createElement('br'), response.data['GPSPureDdLat'].value + " (decimal)"));
        row.title = "Click for decimal latitude and longitude values";
        row.classList.add('clickable');
        row.addEventListener("click", gpsRowClick, {capture: true, once: true});
      } else if (key_v === 'GPSLon') {
        value.insertAdjacentElement("beforeend", createRichElement('span', {class: 'gps expandable'}, document.createElement('br'), response.data['GPSPureDdLon'].value + " (decimal)"));
        row.title = "Click for decimal latitude and longitude values";
        row.addEventListener("click", gpsRowClick, {capture: true, once: true});
        row.classList.add('clickable');
      } else if (key_v === "Software" && response.data['AdditionalSoftware'] && response.data['AdditionalSoftware'].value && response.data['AdditionalSoftware'].value.length) {
        value.insertAdjacentElement("afterbegin", createRichElement('span', {class: 'software expandable'}, ...arrayToNodeAppendables(response.data['AdditionalSoftware'].value)));
        row.title = "Click for additional software used";
        row.addEventListener("click", softwareRowClick, {capture: true, once: true});
        row.classList.add('clickable');
      } else if (key_v === 'ColorSpace') {
        row.title = "Notice: Color space given in Exif and XMP meta-data, might not be the same as actual image color space used!";
      }
    }
  }
  let orderedKeys = [ "Headline", "Caption", "ObjectName", "Creditline", "Copyright", "UsageTerms",
                    "Creator", "CreatorAddress", "CreatorCity", "CreatorRegion", "CreatorPostalCode", "CreatorCountry", "CreatorPhoneNumbers", "CreatorEmails", "CreatorURLs",
                    "Date", "Make", "Model", "Lens", "FocalLengthText", "DigitalZoomRatio", "ApertureFNumber", "ExposureTime", "ISOequivalent", "FlashUsed", "WhiteBalance", "Distance",
                    "GPSLat", "GPSLon", "GPSAlt", "GPSImgDir", "CountryName", "ProvinceState", "City", "Sublocation" ];
  let foundKeys = Object.keys(response.data);
  orderedKeys.filter(x => foundKeys.includes(x)).forEach(addDataRow);  // First the orderedKeys (Headline, Description, Creator, Copyright, Credit Line,...)
  foundKeys.filter(x => !orderedKeys.includes(x)).forEach(addDataRow); // Then the rest...
  if (response.data.GPSPureDdLat && response.data.GPSPureDdLon && typeof response.data.GPSPureDdLat.value === 'number' && typeof response.data.GPSPureDdLon.value === 'number') {
    document.getElementById("maintab").onclick = () => {
      document.body.classList.replace("mapmode", "mainmode")
    };
    document.getElementById("maptab").onclick = () => {
      document.body.classList.replace("mainmode", "mapmode");
      // bbox calculation is a hack. Can do better with:
      // Destination point given distance and bearing from start point
      // https://www.movable-type.co.uk/scripts/latlong.html
      // Bearing
      // https://rechneronline.de/geo-coordinates/
      document.getElementById("osmap").src = "https://www.openstreetmap.org/export/embed.html?bbox=" + (response.data.GPSPureDdLon.value - 0.003) + "%2C" + (response.data.GPSPureDdLat.value - 0.007) + "%2C" + (response.data.GPSPureDdLon.value + 0.003) + "%2C" + (response.data.GPSPureDdLat.value + 0.007) + "&layer=mapnik&marker=" + response.data.GPSPureDdLat.value + "%2C" + response.data.GPSPureDdLon.value;
      document.getElementById("largermap").href = "https://www.openstreetmap.org/?mlat=" + response.data.GPSPureDdLat.value + "&mlon=" + response.data.GPSPureDdLon.value + "#map=15/" + response.data.GPSPureDdLat.value + "/" + response.data.GPSPureDdLon.value;
    };
    var maplinks = document.getElementById('maplinks');
    function maplink(title, className, url, letter) {
      let link = createRichElement('a', {href: url}, letter);
      return createRichElement('div', {title: title, class: className}, link);
    }
    if (maplinks) {
      let lat = response.data.GPSPureDdLat.value;
      let lon = response.data.GPSPureDdLon.value;
      let lang = browser.i18n.getUILanguage();
      let titleString = encodeURIComponent('Photo location').replace(/_/gu, ' '); // Used by Bing. Could potentially be filename or title, but underscores means trouble :-/ ...
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
  document.getElementById("settings").addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    browser.runtime.openOptionsPage();
    self.close();
  }, true);
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
