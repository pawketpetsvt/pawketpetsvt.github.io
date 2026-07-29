/* PawketPetsVT — Paw cursor only. No trail, no particles. */
(function () {
  var style = document.createElement('style');
  style.textContent = '*, *::before, *::after { cursor: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'%3E%3Ctext y=\'26\' font-size=\'26\'%3E%F0%9F%90%BE%3C/text%3E%3C/svg%3E") 4 2, auto !important; } a, button, [role="button"], .btn, input[type="submit"], label[for], select, .sidebar-nav-btn, .clickable { cursor: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'%3E%3Ctext y=\'26\' font-size=\'26\'%3E%F0%9F%90%BE%3C/text%3E%3C/svg%3E") 4 2, pointer !important; }';
  document.head.appendChild(style);
})();
