/**
 * Measure header/footer and enable the locked homepage layout.
 */
(function () {
  function apply() {
    var header = document.getElementById('header');
    var page = document.getElementById('page');
    if (!page) return;

    var sections = page.querySelectorAll('.page-section');
    if (sections.length < 2) return;

    document.documentElement.classList.add('local-home-lock');

    var main = sections[0];
    var footer = sections[sections.length - 1];

    function measure() {
      var headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
      // Temporarily unfix footer to measure natural height if needed
      var footerH = Math.ceil(footer.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--local-header-h', headerH + 'px');
      document.documentElement.style.setProperty('--local-footer-h', footerH + 'px');

      // Keep Selected Work flush with ANGELA / header content edges at any width.
      // Prefer a visible brand (desktop title is display:none / 0-size on mobile).
      var headerInner = document.querySelector('#header .header-inner');
      var brands = document.querySelectorAll('#header .header-title');
      var brandRect = null;
      for (var i = 0; i < brands.length; i++) {
        var rect = brands[i].getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        var style = window.getComputedStyle(brands[i]);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        brandRect = rect;
        break;
      }
      var leftInset = 0;
      var rightInset = 0;
      if (brandRect) {
        leftInset = Math.max(0, Math.round(brandRect.left));
      } else if (headerInner) {
        leftInset = Math.max(0, Math.round(headerInner.getBoundingClientRect().left));
      }
      if (headerInner) {
        rightInset = Math.max(
          0,
          Math.round(window.innerWidth - headerInner.getBoundingClientRect().right)
        );
      } else {
        rightInset = leftInset;
      }
      document.documentElement.style.setProperty('--local-edge-left', leftInset + 'px');
      document.documentElement.style.setProperty('--local-edge-right', rightInset + 'px');
    }

    measure();
    window.addEventListener('resize', measure);
    setTimeout(measure, 100);
    setTimeout(measure, 500);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure).catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
