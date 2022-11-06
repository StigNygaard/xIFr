function init() {
  document.getElementById('verstr').textContent = browser.runtime.getManifest().version;
  document.querySelectorAll('.settings').forEach((elm) => {
    elm.addEventListener('click', () => browser.runtime.openOptionsPage())
  });
}
window.addEventListener('DOMContentLoaded', init);
