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
