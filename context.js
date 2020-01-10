var context = (function Context() {

  let defaults = {
    dispMode: "defaultMode",
    popupPos: "defaultPos",
    deepSearchBigMinSize: 175 * 175, // forceLargerThanSize 30625   deepSearchBiggerLimit? // Go bigger than this when "force larger size" (shift-select in context menu - Firefox 63+ feature) to avoid overlayed icons and logos
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

  function isFirefox() {
    return !!((typeof browser !== 'undefined') && browser.runtime && browser.runtime.getURL("./").includes("moz-extension://"));
  }

  function supportsDeepSearch() {
    return !!(typeof browser !== 'undefined' && browser.menus && browser.menus.getTargetElement); // Well, might not be enough. But for the time being this check should tell. In practice Firefox 63+ supports...
  }

  function prefersDark(dispMode) {
    return dispMode === "darkMode" || (window && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // API
  return {
    setOptions: setOptions,
    getOptions: getOptions,
    isFirefox: isFirefox,
    supportsDeepSearch: supportsDeepSearch,
    prefersDark: prefersDark
  };

})();
