function init() {
  document.getElementById('verstr').textContent = browser.runtime.getManifest().version;
  document.getElementById('settings').addEventListener('click', () => browser.runtime.openOptionsPage());
}
window.addEventListener('DOMContentLoaded', init);
