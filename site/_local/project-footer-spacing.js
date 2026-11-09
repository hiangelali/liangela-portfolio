(function () {
  // Ramp Travel uses section-height--small → padding-bottom: 3.3vmax
  var TARGET_VMAX = 3.3;

  function findNavPair() {
    var sections = Array.prototype.slice.call(
      document.querySelectorAll('#page .page-section, .page-regions > .page-section, article .page-section')
    );
    // de-dupe
    sections = sections.filter(function (s, i, arr) { return arr.indexOf(s) === i; });
    for (var i = sections.length - 1; i >= 0; i--) {
      var text = (sections[i].innerText || '').replace(/\s+/g, ' ').trim();
      if (text.length < 250 && (text.indexOf('←') !== -1 || text.indexOf('→') !== -1)) {
        return { nav: sections[i], content: sections[i - 1] || null };
      }
    }
    return null;
  }

  function lastContent(section) {
    var nodes = section.querySelectorAll(
      'img, video, figure, .local-fb-media-item, p, h1, h2, h3, h4, li, .sqs-html-content'
    );
    var best = null;
    var bestBottom = -Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      var r = el.getBoundingClientRect();
      // Prefer real media; allow smaller text nodes as fallback
      var isMedia = /^(IMG|VIDEO|FIGURE)$/.test(el.tagName) || (el.classList && el.classList.contains('local-fb-media-item'));
      if (isMedia && (r.height < 40 || r.width < 40)) continue;
      if (!isMedia && (r.height < 8 || r.width < 8)) continue;
      var bottom = r.bottom + window.scrollY;
      if (bottom > bestBottom) {
        bestBottom = bottom;
        best = el;
      }
    }
    return best;
  }

  function apply() {
    var pair = findNavPair();
    if (!pair || !pair.content || !pair.nav) return;

    var content = pair.content;
    var nav = pair.nav;
    content.classList.add('local-project-media-end');
    nav.classList.add('local-project-nav');

    var wrap = content.querySelector(':scope > .content-wrapper');

    // Clear inherited bottom spacing / min-heights
    content.style.setProperty('min-height', '0px', 'important');
    content.style.setProperty('padding-bottom', '0px', 'important');
    content.style.setProperty('margin-bottom', '0px', 'important');
    if (wrap) {
      wrap.style.setProperty('padding-bottom', '0px', 'important');
      wrap.style.setProperty('min-height', '0px', 'important');
    }

    // Force layout, then measure leftover empty space under last media
    void content.offsetHeight;

    var media = lastContent(content);
    if (!media) {
      // Still apply target padding so pages without detected content aren't flush
      var fallback = TARGET_VMAX * (document.documentElement.clientWidth / 100);
      content.style.setProperty('padding-bottom', fallback + 'px', 'important');
      return;
    }

    var mediaBottom = media.getBoundingClientRect().bottom + window.scrollY;
    var contentBottom = content.getBoundingClientRect().bottom + window.scrollY;
    var internalEmpty = Math.max(0, contentBottom - mediaBottom);

    // Collapse leftover empty space, then add Ramp Travel's gap
    if (internalEmpty > 0.5) {
      content.style.setProperty('margin-bottom', -internalEmpty + 'px', 'important');
    } else {
      content.style.setProperty('margin-bottom', '0px', 'important');
    }

    var targetPx = TARGET_VMAX * (document.documentElement.clientWidth / 100);
    content.style.setProperty('padding-bottom', targetPx + 'px', 'important');
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      apply();
    });
  }

  function boot() {
    apply();
    window.setTimeout(apply, 200);
    window.setTimeout(apply, 800);
    window.setTimeout(apply, 1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', function () {
    window.setTimeout(apply, 50);
    window.setTimeout(apply, 400);
  });
  window.addEventListener('resize', schedule);
})();
