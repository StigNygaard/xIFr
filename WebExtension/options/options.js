globalThis.browser ??= chrome;

function setDisplayMode(dispMode) {
  if (context.prefersDark(dispMode)) {
    document.body.classList.replace("light", "dark"); // If light, then swap with dark
    document.body.classList.add("dark"); // But also set dark if light wasn't set
  } else {
    document.body.classList.replace("dark", "light"); // If dark, then swap with light
    document.body.classList.add("light"); // But also set light if dark wasn't set
  }
}

function updateDeepSearchSize() {
  const inp = document.getElementById("deepSearchBiggerLimit");
  const out = document.getElementById("deepSearchBiggerLimitEx");
  out.textContent = "";
  let d = parseInt(inp.value, 10);
  if (!Number.isNaN(d)) {
    d = Math.sqrt(d);
    if (!Number.isNaN(d)) {
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
    deepSearchBiggerLimit: document.querySelector("form#xIFroptions #deepSearchBiggerLimit").value,
    mlinkOSM: document.querySelector("form#xIFroptions #mlinkOSM").checked,
    mlinkGoogle: document.querySelector("form#xIFroptions #mlinkGoogle").checked,
    mlinkBing: document.querySelector("form#xIFroptions #mlinkBing").checked,
    mlinkMapQuest: document.querySelector("form#xIFroptions #mlinkMapQuest").checked,
    mlinkHere: document.querySelector("form#xIFroptions #mlinkHere").checked,
    mlinkFlickr: document.querySelector("form#xIFroptions #mlinkFlickr").checked,
    mlinkGeoHack: document.querySelector("form#xIFroptions #mlinkGeoHack").checked,
    devDisableDeepSearch: document.querySelector("form#xIFroptions #devDisableDeepSearch").checked,
    devClickThumbnailBeta: document.querySelector("form#xIFroptions #devClickThumbnailBeta").checked,
    devFetchMode: document.forms[0].devFetchMode.value
    //     initialOnboard: 0
  }).then(
    () => {
      setDisplayMode(document.forms[0].dispMode.value);
      updateDeepSearchSize()
    }, (error) => {
      console.error('xIFr: Failed saving options: ' + error)
    }
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
  document.getElementById("initialOnboard").textContent = options["initialOnboard"];
  document.getElementById("logo").addEventListener("dblclick", function () {
    document.body.classList.toggle("developermode")
  });
  // save on input event:
  document.querySelector("form#xIFroptions").addEventListener("input", saveOptions);
}

function updateAllowsPrivate(allows) { // Allowed to run in private/incognito-mode ?
  document.getElementById('allowsPrivate').textContent = allows;
}

function initializeOptionsPage() {
  document.querySelector('div#xIFroptionspage #verstr').textContent = browser.runtime.getManifest().version;
  if (context.isFirefox()) {
    document.body.classList.add("isFirefox");
  } else {
    document.body.classList.add("notFirefox");
  }
  document.getElementById('supportsDeepSearch').textContent = context.supportsDeepSearch();
  if (context.supportsDeepSearch()) {
    document.body.classList.add("supportsDeepSearch");
  }
  document.querySelectorAll('.aboutlinks a').forEach((elm) => {
    const url = new URL(elm.href);
    if (context.isFirefox() && (context.firefoxExtId() !== browser.runtime.id) && !browser.runtime.id.endsWith('@temporary-addon')) {
      url.searchParams.set('extid', browser.runtime.id);
    }
    url.searchParams.set('version', browser.runtime.getManifest().version);
    elm.href = url.href;
  });
  context.getOptions().then(handlerInitOptionsForm);
  browser.extension.isAllowedIncognitoAccess().then(updateAllowsPrivate)
}

window.addEventListener("DOMContentLoaded", initializeOptionsPage);
