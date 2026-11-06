// Runs before first paint (same-origin script, allowed by the CSP) so the saved theme and text size
// apply with no flash. Mirrors the logic in src/theme.jsx.
(function () {
  try {
    var t = localStorage.getItem('lms-theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    var s = localStorage.getItem('lms-text');
    if (s) document.documentElement.setAttribute('data-text', s);
  } catch (e) {
    /* storage blocked: defaults apply */
  }
})();
