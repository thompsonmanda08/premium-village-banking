(function () {
  var root = document.documentElement;
  var pref = null;
  try {
    pref = localStorage.getItem('pvb-theme');
  } catch {
    // Storage access denied; pref stays null
  }

  var dark = false;
  try {
    dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    // matchMedia unavailable; dark stays false (light mode)
  }

  var theme = dark ? 'dark' : 'light';
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0F1113' : '#EEF0F2');
})();
