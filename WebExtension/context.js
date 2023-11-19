globalThis.context = globalThis.context || (function Context() {

  globalThis.browser = globalThis.browser || globalThis.chrome;

  // Console:
  const LOG = false; // false
  const INFO = false; // false
  const DEBUG = false; // false
  const WARN = true;
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
  function warn(...arg) {
    if (console && WARN) console.warn(...arg);
  }
  function error(...arg) {
    if (console && ERROR) console.error(...arg);
  }

  // Options:
  let defaults = {
    dispMode: "defaultMode",
    popupPos: "defaultPos",
    deepSearchBiggerLimit: 175 * 175, // 30625
    mlinkOSM: true,
    mlinkGoogle: true,
    mlinkBing: true,
    mlinkMapQuest: false,
    mlinkHere: false,
    mlinkFlickr: true,
    mlinkGeoHack: false,
    devDisableDeepSearch: false,
    devClickThumbnailBeta: false,
    devFetchMode: "devAutoFetch",
    initialOnboard: 0
  };
  function setOptions(o) {
    return browser.storage.local.set(o);
  }
  function setOption(prop, value) {
    const o = {};
    o[prop] = value;
    return setOptions(o);
  }
  function getOptions() {
    function onError(error) {
      console.warning(`xIFr: getOptions() error: ${error}`);
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
    return !!(typeof browser !== 'undefined' && browser.menus?.getTargetElement); // Well, might not be enough. But for the time being this check should tell. In practice Firefox 63+ supports, Chrome does not...
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
    LOG: LOG,
    INFO: INFO,
    DEBUG: DEBUG,
    ERROR: ERROR,
    log: log,
    info: info,
    debug: debug,
    warn: warn,
    error: error,
    setOptions: setOptions,
    setOption: setOption,
    getOptions: getOptions,
    isFirefox: isFirefox,
    isChromium: isChromium,
    supportsDeepSearch: supportsDeepSearch,
    prefersDark: prefersDark
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
    const v1parts = v1.split('.');
    const v2parts = v2.split('.');
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
    const vparts = v.split('.', n);
    vparts.map(function (item) {
      return String(parseInt(item.trim(), 10))
    });
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
  function validate(v) {
    if (typeof v === 'string' || v instanceof String) {
      const vparts = v.split('.');
      if (vparts.length >= 1 && vparts.length <= 3) {
        for (const part of vparts) {
          const parsed = parseInt(part, 10);
          if (isNaN(parsed)) return false;
          if (part !== String(parsed)) return false; // This doesn't allow leading 0s like in yyyy.mm.dd versionnumbers (ok?)
        }
      }
      return true;
    }
    return false;
  }
  function validOr(v, alt) {
    if (validate(v)) {
      return v;
    } else {
      return alt;
    }
  }

  // API:
  return {
    current: current,
    compare: compare,
    major: major,
    minor: minor,
    revision: revision,
    validate: validate,
    validOr: validOr
  };

})();
