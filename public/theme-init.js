(function () {
  var root = document.documentElement;
  try {
    var pref = localStorage.getItem('pvb-theme');
    var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var theme = dark ? 'dark' : 'light';
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#09090B' : '#F1F5F9');
  } catch {
    root.dataset.theme = 'light';
  }
})();
