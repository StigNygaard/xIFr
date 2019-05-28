browser.runtime.sendMessage({
  message: "popupReady"
}, response => {
  var table = document.getElementById("data");
  Object.keys(response).forEach(key_v => {
    var row = table.insertRow(-1);
    var label = row.insertCell(0);
    var value = row.insertCell(1);
    if (key_v !== "GPSPureDdLat" && key_v !== "GPSPureDdLon") {
      label.innerText = key_v;
      value.innerText = response[key_v];
    }
  });
  if (response.GPSPureDdLat && response.GPSPureDdLon) {
    var osMapButton = document.createElement("button");
    osMapButton.type = "button";
    osMapButton.innerText = "Locate on OpenStreetMap";
    osMapButton.onclick = () => {
      var href = 'https://www.openstreetmap.org/?mlat=%lat%&mlon=%lon%&layers=M';
      href = href.replace(/%lat%/, response.GPSPureDdLat);
      href = href.replace(/%lon%/, response.GPSPureDdLon);
      href = href.replace(/%lang%/, browser.i18n.getUILanguage());
      window.open(href);
    };
    var gmMapButton = document.createElement("button");
    gmMapButton.type = "button";
    gmMapButton.innerText = "Locate on Google Maps";
    gmMapButton.onclick = () => {
      var href = 'https://www.google.com/maps/search/?api=1&query=%lat%,%lon%';
      href = href.replace(/%lat%/, response.GPSPureDdLat);
      href = href.replace(/%lon%/, response.GPSPureDdLon);
      href = href.replace(/%lang%/, browser.i18n.getUILanguage());
      window.open(href);
    };
    var btns = document.getElementById("buttonzone");
    btns.insertBefore(osMapButton, btns.childNodes[0]);
    btns.insertBefore(gmMapButton, btns.childNodes[0]);
  }
  document.getElementById("copybutton").onclick = () => {
    var range = document.createRange();
    var sel = window.getSelection();
    range.selectNodeContents(table);
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
  };
});
