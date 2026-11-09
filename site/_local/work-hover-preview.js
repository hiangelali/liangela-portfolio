/**
 * Selected Work hover previews.
 * Maps data-work-preview keys to image src + placement.
 */
(function () {
  var PREVIEWS = {
    'ramp-policy-agents': {
      src: '_cdn/local-work-previews/ramp-policy-agents.webp',
      width: '54vw',
      maxWidth: '820px',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    },
    'ramp-travel': {
      src: '_cdn/local-work-previews/ramp-travel.webp',
      width: '44vw',
      maxWidth: '680px',
      top: '46%',
      left: '58%',
      transform: 'translate(-50%, -50%)'
    },
    'dropbox-dash-ai': {
      src: '_cdn/local-work-previews/dropbox-dash-ai.webp',
      width: '56vw',
      maxWidth: '860px',
      top: '70%',
      left: '42%',
      transform: 'translate(-50%, -50%)'
    },
    'airbnb-cohosting': {
      src: '_cdn/local-work-previews/airbnb-cohosting.webp?v=2',
      width: '52vw',
      maxWidth: '800px',
      top: '58%',
      left: '58%',
      transform: 'translate(-50%, -50%)'
    },
    'clearer-fees': {
      src: '_cdn/local-work-previews/clearer-fees.webp?v=5',
      width: '34vw',
      maxWidth: '520px',
      top: '32%',
      left: '78%',
      transform: 'translate(-50%, -50%)'
    },
    'dropbox-sign': {
      src: '_cdn/local-work-previews/dropbox-sign.webp',
      width: '44vw',
      maxWidth: '680px',
      top: '68%',
      left: '32%',
      transform: 'translate(-50%, -50%)'
    },
    'one-days-wages': {
      src: '_cdn/local-work-previews/one-days-wages.webp?v=5',
      width: '40vw',
      maxWidth: '600px',
      top: '72%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    },
    'new-facebook': {
      src: '_cdn/local-work-previews/new-facebook.webp?v=4',
      width: '52vw',
      maxWidth: '800px',
      top: '28%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    },
    'story-highlights': {
      src: '_cdn/local-work-previews/story-highlights.webp',
      width: '22vw',
      maxWidth: '340px',
      top: '72%',
      left: '22%',
      transform: 'translate(-50%, -50%)'
    },
    'marketplace-i18n': {
      src: '_cdn/local-work-previews/marketplace-i18n.webp?v=2',
      width: '42vw',
      maxWidth: '640px',
      top: '70%',
      left: '72%',
      transform: 'translate(-50%, -50%)'
    }
  };

  function siteRoot() {
    var script = document.querySelector('script[src*="work-hover-preview.js"]');
    if (!script) return '';
    var src = script.getAttribute('src') || '';
    return src.replace(/_local\/work-hover-preview\.js.*$/, '');
  }

  function resolveSrc(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//.test(path) || path.charAt(0) === '/') return path;
    return siteRoot() + path;
  }

  function applyPlacement(img, conf) {
    img.style.width = conf.width || '42vw';
    img.style.maxWidth = conf.maxWidth || '640px';
    img.style.top = conf.top || '50%';
    img.style.left = conf.left || '50%';
    img.style.right = conf.right || 'auto';
    img.style.bottom = conf.bottom || 'auto';
    img.style.transform = conf.transform || 'translate(-50%, -50%)';
  }

  function init() {
    var links = document.querySelectorAll('a[data-work-preview]');
    if (!links.length) return;

    document.body.classList.add('local-work-preview-enabled');

    var stage = document.createElement('div');
    stage.className = 'local-work-preview';
    stage.setAttribute('aria-hidden', 'true');

    var img = document.createElement('img');
    img.className = 'local-work-preview__img';
    img.alt = '';
    img.decoding = 'async';
    stage.appendChild(img);
    document.body.insertBefore(stage, document.body.firstChild);

    var activeKey = null;
    var hideTimer = null;

    function setActiveLink(key) {
      for (var i = 0; i < links.length; i++) {
        var linkKey = links[i].getAttribute('data-work-preview');
        links[i].classList.toggle('local-work-preview-active', !!key && linkKey === key);
      }
    }

    function setShowing(on) {
      document.body.classList.toggle('local-work-preview-showing', !!on);
      stage.classList.toggle('is-visible', !!on);
      if (!on) setActiveLink(null);
    }

    function show(key) {
      var conf = PREVIEWS[key];
      if (!conf || !conf.src) return;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      activeKey = key;
      setActiveLink(key);
      var nextSrc = resolveSrc(conf.src);
      applyPlacement(img, conf);
      if (img.getAttribute('src') !== nextSrc) {
        img.onload = function () {
          if (activeKey === key) setShowing(true);
        };
        img.src = nextSrc;
        // If cached, onload may have already fired
        if (img.complete) setShowing(true);
      } else {
        setShowing(true);
      }
    }

    function hide() {
      activeKey = null;
      setShowing(false);
    }

    function scheduleHide() {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, 40);
    }

    for (var i = 0; i < links.length; i++) {
      (function (link) {
        var key = link.getAttribute('data-work-preview');
        if (!PREVIEWS[key]) return;

        link.addEventListener('mouseenter', function () {
          show(key);
        });
        link.addEventListener('mouseleave', scheduleHide);
        link.addEventListener('focus', function () {
          show(key);
        });
        link.addEventListener('blur', scheduleHide);

        // Warm cache
        var warm = new Image();
        warm.src = resolveSrc(PREVIEWS[key].src);
      })(links[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
