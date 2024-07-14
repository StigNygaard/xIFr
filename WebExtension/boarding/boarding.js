globalThis.browser ??= chrome;

function init() {

  const initialOnboard = (new URL(window.location.href)).searchParams.get('initialOnboard');
  const currentVersion = versionnumber.validOr(versionnumber.current(), '');
  const previousVersion = versionnumber.validOr((new URL(window.location.href)).searchParams.get('previousVersion'), '');

  document.querySelectorAll('.verstr').forEach((elm) => {
    elm.textContent = currentVersion;
  });
  document.querySelectorAll('.settings').forEach((elm) => {
    elm.addEventListener('click', (ev) => {
      ev.preventDefault();
      browser.runtime.openOptionsPage();
    })
  });
  let vboarding = currentVersion;
  if (previousVersion) vboarding += (',' + previousVersion);
  document.querySelectorAll('.introlink a').forEach((elm) => {
    const url = new URL(elm.href);
    if (context.isFirefox() && (context.firefoxExtId() !== browser.runtime.id) && !browser.runtime.id.endsWith('@temporary-addon')) {
      url.searchParams.set('extid', browser.runtime.id);
    }
    url.searchParams.set(elm.dataset.context, vboarding);
    elm.href = url.href;
  });

  if (document.querySelector('body.onboard')) {
    // onboarding only...
    if (initialOnboard) {
      context.setOption('initialOnboard', initialOnboard);
      if (initialOnboard === '2') {
        document.querySelector('.secondOnboard').style.display = 'revert';
      }
    }
  } else {
    // upboarding only...
    if (previousVersion) {
      // ...
    }
  }

}

window.addEventListener('DOMContentLoaded', init);
