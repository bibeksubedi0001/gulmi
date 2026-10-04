/* Lakes field portal: apply the saved (or system) colour theme before first paint. */
'use strict';
(function () {
  let t = null;
  try { t = localStorage.getItem('tt-theme'); } catch (e) { /* storage blocked */ }
  if (t !== 'dark' && t !== 'light') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
})();
