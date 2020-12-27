var context = (function Context() {

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
      console.log(`Error: ${error}`);
      return defaults;
    }
    function setCurrentChoice(result) {
      // Merge default with loaded values:
      return Object.assign(defaults, result);
    }
    return browser.storage.local.get().then(setCurrentChoice, onError);
  }

  // Misc:
  function supportsDeepSearch() {
    return !!(typeof browser !== 'undefined' && browser.menus && browser.menus.getTargetElement); // Well, might not be enough. But for the time being this check should tell. In practice Firefox 63+ supports, Chrome does not...
  }
  function prefersDark(dispMode) {
    return dispMode === "darkMode" || (window && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
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
