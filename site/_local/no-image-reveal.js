(function(){
  function revealImages(){
    var nodes = document.querySelectorAll(
      '[data-animation-role="image"], .fluid-image-animation-wrapper, .sqs-block-image [class*="pre"], .image-wrapper, .sqs-gallery-container .image-wrapper, img.preFade, img.preSlide'
    );
    nodes.forEach(function(el){
      el.classList.remove('preFade','preSlide');
      el.classList.add('fadeIn','slideIn');
      el.setAttribute('data-override-initial-global-animation','');
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.transition = 'none';
      el.style.visibility = 'visible';
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealImages);
  } else {
    revealImages();
  }
  // Re-run after Squarespace animation boot
  window.addEventListener('load', revealImages);
  setTimeout(revealImages, 0);
  setTimeout(revealImages, 300);
  setTimeout(revealImages, 1000);
})();
