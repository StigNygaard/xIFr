function init() {

  document.querySelectorAll('.verstr').forEach((elm) => {
    elm.textContent = browser.runtime.getManifest().version;
  });
  document.querySelectorAll('.settings').forEach((elm) => {
    elm.addEventListener('click', () => browser.runtime.openOptionsPage())
  });
  document.querySelectorAll('#introlink a').forEach((elm) => {
    const url = new URL(elm.href);
    url.searchParams.set(elm.dataset.context, browser.runtime.getManifest().version);
    elm.href = url.href;
  });

  if (document.querySelector('body.onboard')) {
    // onboarding only...
    const initialOnboard = (new URL(window.location.href)).searchParams.get('initialOnboard');
    if (initialOnboard) {
      context.setOption('initialOnboard', initialOnboard);
      if (initialOnboard === '2') {
        document.querySelector('.secondOnboard').style.display = 'revert';
      }
    }
  } else {
    // upboarding only...
    const previousVersion = (new URL(window.location.href)).searchParams.get('previousVersion');
    if (previousVersion) {
      // ...
    }
  }

}

window.addEventListener('DOMContentLoaded', init);
