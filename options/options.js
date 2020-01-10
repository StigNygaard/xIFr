function setDisplayMode(dispMode) {
  if (context.prefersDark(dispMode)) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

function updateDeepSearchSize() {
  var inp = document.getElementById("deepSearchBigMinSize");
  var out = document.getElementById("deepSearchBigMinSizeEx");
  out.textContent = "";
  var d = parseInt(inp.value);
  if (!isNaN(d)) {
    d = Math.sqrt(d);
    if (!isNaN(d)) {
      d = Math.floor(d);
      out.textContent = d + "x" + d;
    }
  }
}

function saveOptions(e) {
  e.preventDefault();
  context.setOptions({
    dispMode: document.forms[0].dispMode.value,
    popupPos: document.forms[0].popupPos.value,
    deepSearchBigMinSize: document.querySelector("form#xIFroptions #deepSearchBigMinSize").value,
    mlinkOSM: document.querySelector("form#xIFroptions #mlinkOSM").checked,
    mlinkGoogle: document.querySelector("form#xIFroptions #mlinkGoogle").checked,
    mlinkBing: document.querySelector("form#xIFroptions #mlinkBing").checked,
    mlinkMapQuest: document.querySelector("form#xIFroptions #mlinkMapQuest").checked,
    mlinkHere: document.querySelector("form#xIFroptions #mlinkHere").checked,
    mlinkFlickr: document.querySelector("form#xIFroptions #mlinkFlickr").checked
  }).then(
    () => {setDisplayMode(document.forms[0].dispMode.value); updateDeepSearchSize()}, (error) => {console.error('Failed saving xIFr options: ' + error)}
  );
}

function handlerInitOptionsForm(options) {
  setDisplayMode(options["dispMode"]);
  [...document.forms[0].elements].forEach((input) => {
    if (input.type === "radio" && options[input.name] === input.value) {
      input.checked = true;
    } else if (input.type === "checkbox" && options[input.value] !== undefined) {
      input.checked = options[input.value];
    } else if (input.type === "text" && options[input.id] !== undefined) {
      input.value = options[input.id];
    }
  });
  updateDeepSearchSize();
  // Enable Submit:
  document.querySelector("form#xIFroptions").addEventListener("submit", saveOptions);
}

function initializeOptionsPage() {
  document.querySelector('div#xIFroptionspage #verstr').textContent = browser.runtime.getManifest().version;
  if (context.isFirefox()) {
    document.body.classList.add("isFirefox");
  }
  if (context.supportsDeepSearch()) {
    document.body.classList.add("supportsDeepSearch");
    document.getElementById("deepSearchBigMinSize").addEventListener("keyup", updateDeepSearchSize);
  }
  context.getOptions().then(handlerInitOptionsForm);
}

window.addEventListener("DOMContentLoaded", initializeOptionsPage);