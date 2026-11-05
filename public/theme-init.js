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
  // Both tags get the chosen colour, so an in-app theme that differs from the OS one wins over the media queries.
  document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
    meta.setAttribute('content', dark ? '#0F1113' : '#EEF0F2');
  });
})();
