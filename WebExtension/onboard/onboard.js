function init() {
  document.getElementById('verstr').textContent = browser.runtime.getManifest().version;
  document.querySelectorAll('.settings').forEach((elm) => {
    elm.addEventListener('click', () => browser.runtime.openOptionsPage())
  });
  const initialOnboard = (new URL(window.location.href)).searchParams.get('initialOnboard');
  if (initialOnboard) {
    context.setOption('initialOnboard', initialOnboard);
    if (initialOnboard === '2') {
      document.querySelector('.secondOnboard').style.display = 'revert';
    }
  }
}
window.addEventListener('DOMContentLoaded', init);
