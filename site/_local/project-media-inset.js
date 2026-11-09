/**
 * Match project media to the intro text content edges.
 * Sets --local-text-left / --local-text-width from the first text section.
 */
(function () {
  function textContentBox() {
    var sections = document.querySelectorAll('#page .page-section');
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      if (section.classList.contains('local-project-nav')) continue;
      var content = section.querySelector('.content');
      if (!content) continue;
      var html = content.querySelector('.sqs-html-content');
      if (!html || !(html.innerText || '').trim()) continue;
      var rect = content.getBoundingClientRect();
      if (rect.width < 40) continue;
      return rect;
    }
    return null;
  }

  function apply() {
    var box = textContentBox();
    if (!box) return;
    var left = Math.max(0, Math.round(box.left));
    var width = Math.max(0, Math.round(box.width));
    var root = document.documentElement;
    root.style.setProperty('--local-text-left', left + 'px');
    root.style.setProperty('--local-text-width', width + 'px');
    root.classList.add('local-media-inset');
  }

  function schedule() {
    window.requestAnimationFrame(apply);
  }

  function boot() {
    apply();
    window.setTimeout(apply, 100);
    window.setTimeout(apply, 500);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(apply).catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', function () {
    window.setTimeout(apply, 50);
  });
  window.addEventListener('resize', schedule);
})();
