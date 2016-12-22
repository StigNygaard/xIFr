browser.runtime.sendMessage({
  message: "popupReady"
}, response => {
  var table = document.getElementById("data");
  Object.keys(response).forEach(key_v => {
    var row = table.insertRow(-1);
    var label = row.insertCell(0);
    var value = row.insertCell(1);
    if (key_v != "GPSPureDdLat" && key_v != "GPSPureDdLon") {
      label.innerText = key_v;
      value.innerText = response[key_v];
    }
  });
  if (response.GPSPureDdLat && response.GPSPureDdLon) {
    var mapbutton = document.createElement("button");
    mapbutton.type = "button";
    mapbutton.innerText = "Locate on OpenStreetMap";
    mapbutton.onclick = () => {
      var href = 'https://www.openstreetmap.org/?mlat=%lat%&mlon=%lon%&layers=M';
      href = href.replace(/%lat%/, response.GPSPureDdLat);
      href = href.replace(/%lon%/, response.GPSPureDdLon);
      href = href.replace(/%lang%/, browser.i18n.getUILanguage());
      window.open(href);
    }
    var btns = document.getElementById("buttonzone");
    btns.insertBefore(mapbutton, btns.childNodes[0]);
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