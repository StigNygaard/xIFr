globalThis.context = globalThis.context || (function Context() {

  // Console:
  const LOG = false; // false
  const INFO = false; // false
  const DEBUG = false; // false
  const ERROR = true;
  function log(...arg) {
    if (console && LOG) console.log(...arg);
  }
  function info(...arg) {
    if (console && INFO) console.info(...arg);
  }
  function debug(...arg) {
    if (console && DEBUG) console.debug(...arg);
  }
  function error(...arg) {
    if (console && ERROR) console.error(...arg);
  }

  // Options:
  let defaults = {
    dispMode: "defaultMode",
    popupPos: "defaultPos",
    deepSearchBiggerLimit: 175 * 175, // 30625 - Go bigger than this when "force larger size" (shift-select in context menu - Firefox 63+ feature) to avoid overlayered icons and logos
    mlinkOSM: true,
    mlinkGoogle: true,
    mlinkBing: true,
    mlinkMapQuest: true,
    mlinkHere: true,
    mlinkFlickr: true
  };
  function setOptions(o) {
    return browser.storage.local.set(o);
  }
  function getOptions() {
    function onError(error) {
      console.warning(`getOptions() error: ${error}`);
      return defaults;
    }
    function setCurrentChoice(result) {
      // Merge default with loaded values:
      return Object.assign(defaults, result);  // updates defaults and returns it
    }
    return browser.storage.local.get().then(setCurrentChoice, onError);
  }

  // Misc:
  function supportsDeepSearch() {
    return !!(typeof browser !== 'undefined' && browser.menus && browser.menus.getTargetElement); // Well, might not be enough. But for the time being this check should tell. In practice Firefox 63+ supports, Chrome does not...
  }
  function prefersDark(dispMode) {
    return dispMode === "darkMode" || (window?.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function isFirefox() {
    return !!((typeof browser !== 'undefined') && browser.runtime && browser.runtime.getURL("./").startsWith("moz-extension://"));
  }
  function isChromium() { // Besides Chrome, this also includes Edge & Opera. And likely most/all other Chromium based browsers too(?)
    return !!((typeof browser !== 'undefined') && browser.runtime && browser.runtime.getURL("./").startsWith("chrome-extension://"));
  }

  // API:
  return {
    LOG,
    INFO,
    DEBUG,
    ERROR,
    log,
    info,
    debug,
    error,
    setOptions,
    getOptions,
    isFirefox,
    isChromium,
    supportsDeepSearch,
    prefersDark
  };

})();

globalThis.versionnumber = globalThis.versionnumber || (function Versionnumber() {  // major.minor.revision
  function current() {
    if (browser?.runtime) { // webextension versionnumber
      return browser.runtime.getManifest().version;
    }
    // undefined
  }
  function compare(v1, v2) {
    if (typeof v2 === 'undefined') {
      v2 = v1;
      v1 = current();
    }
    let v1parts = v1.split('.');
    let v2parts = v2.split('.');
    while (v1parts.length < v2parts.length) v1parts.push(0);
    while (v2parts.length < v1parts.length) v2parts.push(0);
    for (let i = 0; i < v1parts.length; ++i) {
      if (parseInt(v1parts[i], 10) > parseInt(v2parts[i], 10)) {
        return 1;
      } else if (parseInt(v1parts[i], 10) < parseInt(v2parts[i], 10)) {
        return -1;
      }
    }
    return 0;
  }
  function parts(v, n) {
    if (typeof n === 'undefined') {
      n = v;
      v = current();
    }
    let vparts = v.split('.', n);
    vparts.map( function(item) {return String(parseInt(item.trim(),10))});
    while (vparts.length < n) vparts.push('0');
    return vparts.join('.');
  }
  function major(v) {
    if (typeof v === 'undefined') {
      v = current();
    }
    return parts(v, 1);
  }
  function minor(v) {
    if (typeof v === 'undefined') {
      v = current();
    }
    return parts(v, 2);
  }
  function revision(v) {
    if (typeof v === 'undefined') {
      v = current();
    }
    return parts(v, 3);
  }

  // API:
  return {
    current,
    compare,
    major,
    minor,
    revision
  };

})();
