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
}
window.addEventListener("DOMContentLoaded", init);

browser.runtime.sendMessage({
  message: "popupReady"
}).then( response => {
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
    if (browser.runtime.getURL("./").startsWith("moz-extension://") && response.properties.URL.startsWith("file:")) { // Firefox won't show images from file: system
      image.src = response.properties.URL; // Todo: Some "dummy"/info image instead?
    } else {
      image.src = response.properties.URL;
    }
    let url = document.createElement('a');
    url.href = response.properties.URL;
    if (response.properties.URL.startsWith("data:")) {
      document.getElementById("filename").textContent = "[ inline imagedata ]";
      document.getElementById("filename").title = "";
    } else if (response.properties.URL.startsWith("blob:")) {
      document.getElementById("filename").textContent = "[ blob imagedata ]";
      document.getElementById("filename").title = response.properties.URL;
    } else {
      document.getElementById("filename").textContent = (url.pathname.length > 1 ? url.pathname.substring(url.pathname.lastIndexOf("/") + 1) : url.hostname || url.host ) || "[ ./ ]";
      document.getElementById("filename").title = response.properties.URL;
    }
    document.getElementById("filename").href = response.properties.URL;
    document.getElementById("imgsize").textContent = response.properties.byteLength;
    document.getElementById("imgsize2").textContent = response.properties.byteLength >= 1048576 ? ((response.properties.byteLength/1048576).toFixed(2)).toString() + " MB" : ((response.properties.byteLength/1024).toFixed(2)).toString() + " kB";
    if (response.properties.URL.startsWith("file:")) {
      document.getElementById("contenttype").textContent = "";
      document.getElementById("lastmodified").textContent = "";
    } else {
      document.getElementById("contenttype").textContent = response.properties.contentType;
      document.getElementById("lastmodified").textContent = response.properties.lastModified;
    }
    if (typeof response.properties.naturalWidth === 'number' ) {
      document.getElementById("dimensions").textContent = response.properties.naturalWidth + "x" + response.properties.naturalHeight + " pixels";
    }
    document.getElementById("dimensions").textContent = response.properties.naturalWidth + "x" + response.properties.naturalHeight + " pixels";
  }

  function addMessages(list, icon, alt) {
    list.forEach(function(item) {
      let msg = document.createElement('i');
      msg.textContent = item;
      let sign = document.createElement('img');
      sign.src = icon;
      sign.alt = alt;
      let div = document.createElement('div');
      div.appendChild(sign);
      div.appendChild(document.createTextNode(' '));
      div.appendChild(msg);
      document.getElementById('messages').appendChild(div);
    });
  }
  if (response.errors.length > 0 || response.warnings.length > 0 || response.infos.length > 0) {
    addMessages(response.errors, '/icons/error-7-32w.png', '!');
    addMessages(response.warnings, '/icons/warn-32w.png', '!');
    addMessages(response.infos, '/icons/info-32w.png', 'i');
    document.getElementById('messages').style.display = 'block';
  }

  // todo: Rewrite? Something not table?
  var table = document.getElementById("data");
  Object.keys(response.data).forEach(key_v => {
    if (key_v !== "GPSPureDdLat" && key_v !== "GPSPureDdLon") { // Ignore GPS _decimal_ values (for now) ...
      var row = table.insertRow(-1);
      var label = row.insertCell(0);
      var value = row.insertCell(1);
      label.textContent = response.data[key_v].label;
      label.id = key_v + "LabelCell";
      value.textContent = response.data[key_v].value;
      value.id = key_v + "ValueCell";
      if (key_v === 'GPSLat') {
        value.insertAdjacentHTML("afterbegin", "<div id='maplinks'></div>");
      }
    }
  });

  // todo: Also find and add direction and height?
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
      let link = document.createElement('a');
      link.href = url;
      link.textContent = letter;
      let div = document.createElement('div');
      div.title = title;
      div.className = className;
      div.appendChild(link);
      return div;
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

  document.querySelectorAll('a').forEach( (elem) => {
    elem.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      window.open(event.target.href, '_blank', 'noopener,noreferrer');
      self.close();
    }, true)
  } );

  document.getElementById("wheel").addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    browser.runtime.openOptionsPage();
    self.close();
  }, true);

});
