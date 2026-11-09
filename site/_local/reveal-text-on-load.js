/**
 * Trigger Squarespace's native text animations on open (not on scroll).
 * Timing matched exactly to Story Highlights:
 *   duration 0.6s, ease, stagger 0.017647s,
 *   first body text at 0.176471s (after 10 header slots),
 *   animation clock starting ~120ms in.
 */
(function () {
  var root = document.documentElement;
  root.classList.add('local-text-reveal-pending');

  var TEXT_SELECTOR =
    '.sqs-html-content h1, .sqs-html-content h2, .sqs-html-content h3, .sqs-html-content h4,' +
    '.sqs-html-content p, .sqs-html-content li, .sqs-html-content pre, .sqs-html-content blockquote';

  // Measured from Story Highlights.
  var STAGGER = 0.017647;
  var HEADER_SLOTS = 10;
  var BASE_DELAY = HEADER_SLOTS * STAGGER; // 0.17647s
  var DURATION = 0.6;
  var START_AT_MS = 120;

  var played = false;
  var revealing = false;
  var obs = null;

  function hasPre(el) {
    return el.classList.contains('preFade') || el.classList.contains('preSlide');
  }

  function isSlide(el) {
    return el.classList.contains('preSlide') || el.classList.contains('slideIn');
  }

  function isAnimatable(el) {
    if (!(el.textContent || '').trim()) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return true;
  }

  function textNodes() {
    var nodes = document.querySelectorAll(TEXT_SELECTOR);
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      if (isAnimatable(nodes[i])) out.push(nodes[i]);
    }
    return out;
  }

  function sqsReady(nodes) {
    var pre = 0;
    var slides = 0;
    var fades = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (hasPre(el)) pre++;
      if (el.classList.contains('preSlide')) slides++;
      if (el.classList.contains('preFade')) fades++;
    }
    return pre >= Math.min(6, nodes.length) && slides + fades > 0;
  }

  function armHidden(el) {
    var slide = isSlide(el);
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.classList.remove('fadeIn', 'slideIn');
    if (slide) {
      el.classList.add('preSlide');
      el.classList.remove('preFade');
      el.style.removeProperty('transform');
    } else {
      el.classList.add('preFade');
      el.classList.remove('preSlide');
      el.style.transform = 'none';
    }
  }

  function lockTiming(el, delaySec, slide) {
    // !important so Squarespace can't re-stamp shorter delays mid-animation.
    el.style.setProperty('transition-timing-function', 'ease', 'important');
    el.style.setProperty('transition-duration', DURATION + 's', 'important');
    el.style.setProperty('transition-delay', delaySec + 's', 'important');
    el.style.setProperty(
      'transition-property',
      slide ? 'transform, opacity' : 'opacity',
      'important'
    );
  }

  function enableTransition(el, delaySec) {
    var slide = el.classList.contains('preSlide');
    el.style.transition = '';
    lockTiming(el, delaySec, slide);
    el.style.opacity = '0';
    if (!slide) el.style.transform = 'none';
  }

  function fireReveal(el, delaySec) {
    var slide = el.classList.contains('preSlide');
    el.classList.remove('preFade', 'preSlide');
    if (slide) el.classList.add('slideIn', 'fadeIn');
    else el.classList.add('fadeIn');
    el.setAttribute('data-override-initial-global-animation', '');
    lockTiming(el, delaySec, slide);
    el.style.opacity = '1';
    el.style.transform = 'none';
  }

  function markDone(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var slide = isSlide(el);
      el.classList.remove('preFade', 'preSlide');
      el.classList.add('fadeIn');
      if (slide) el.classList.add('slideIn');
      el.setAttribute('data-override-initial-global-animation', '');
      el.style.opacity = '1';
      el.style.transform = 'none';
    }
  }

  function play() {
    if (played || revealing) return;
    var nodes = textNodes();
    if (!nodes.length || !sqsReady(nodes)) return;

    // Story Highlights doesn't apply body delays until ~120ms in.
    var elapsed = performance.now();
    if (elapsed < START_AT_MS) {
      setTimeout(play, Math.ceil(START_AT_MS - elapsed));
      return;
    }

    played = true;
    revealing = true;
    if (obs) {
      try { obs.disconnect(); } catch (e) {}
    }

    // Align the first heading to Story Highlights' title slot (0.176471s).
    // Eyebrow/date lines before the title share that same first beat.
    var firstHeading = 0;
    for (var h = 0; h < nodes.length; h++) {
      if (/^H[1-4]$/.test(nodes[h].tagName)) {
        firstHeading = h;
        break;
      }
    }

    var delays = [];
    var maxDelay = 0;
    for (var i = 0; i < nodes.length; i++) {
      var slot = i <= firstHeading ? 0 : i - firstHeading;
      var delay = BASE_DELAY + slot * STAGGER;
      delays.push(delay);
      if (delay > maxDelay) maxDelay = delay;
    }

    for (var j = 0; j < nodes.length; j++) {
      armHidden(nodes[j]);
    }

    root.classList.remove('local-text-reveal-pending');
    void root.offsetWidth;

    requestAnimationFrame(function () {
      for (var k = 0; k < nodes.length; k++) {
        enableTransition(nodes[k], delays[k]);
      }
      void root.offsetWidth;

      requestAnimationFrame(function () {
        for (var m = 0; m < nodes.length; m++) {
          fireReveal(nodes[m], delays[m]);
        }

        // Re-assert Story Highlights timing if SQS mutates inline styles.
        var guard = setInterval(function () {
          for (var g = 0; g < nodes.length; g++) {
            lockTiming(nodes[g], delays[g], nodes[g].classList.contains('slideIn'));
          }
        }, 50);

        setTimeout(function () {
          clearInterval(guard);
          revealing = false;
          var late = document.querySelectorAll(
            '.sqs-html-content .preFade, .sqs-html-content .preSlide'
          );
          if (late.length) markDone(late);
          watchLate();
        }, Math.ceil((maxDelay + DURATION) * 1000) + 100);
      });
    });
  }

  function watchLate() {
    try {
      obs = new MutationObserver(function () {
        if (revealing) return;
        var late = document.querySelectorAll(
          '.sqs-html-content .preFade, .sqs-html-content .preSlide'
        );
        if (late.length) markDone(late);
      });
      obs.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class']
      });
      setTimeout(function () {
        try { obs.disconnect(); } catch (e) {}
      }, 3000);
    } catch (e) {}
  }

  function start() {
    var attempts = 0;
    (function wait() {
      attempts += 1;
      play();
      if (!played && attempts < 80) setTimeout(wait, 50);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (!played) play();
    }, 0);
  });

  try {
    obs = new MutationObserver(function () {
      if (!played) play();
    });
    obs.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  } catch (e) {}
})();
