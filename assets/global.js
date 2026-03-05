window.theme = window.theme || {};

theme.config = {
  mqlSmall: false,
  mediaQuerySmall: 'screen and (max-width: 749px)',
  isTouch: ('ontouchstart' in window) || window.DocumentTouch && window.document instanceof DocumentTouch || window.navigator.maxTouchPoints || window.navigator.msMaxTouchPoints ? true : false,
  isRTL: document.documentElement.getAttribute('dir') === 'rtl',
};

(() => {
  const style = document.createElement('style');
  style.textContent = `
    html[data-pinch-disable] * {
      scroll-snap-type: none !important;
      scroll-behavior: auto !important;
      filter: none !important;
    }`;
  document.head.append(style);

  let zooming = false;

  const onStart = e => {
    if (e.touches.length > 1 && !zooming) {
      zooming = true;
      document.documentElement.setAttribute('data-pinch-disable', '');
    }
  };

  const onEnd = e => {
    if (zooming && e.touches.length === 0) {
      zooming = false;
      document.documentElement.removeAttribute('data-pinch-disable');
    }
  };

  window.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchend',   onEnd,   { passive: true });
})();

function configurePageFadeInOnLoad() {
  const fadeInElement = document.querySelector('.fade-in');

  document.body.classList.add("loaded");

  if (!fadeInElement) return;

  if (fadeInElement.classList.contains('fade-in--content')) {
    const allHeaders = document.querySelectorAll('.shopify-section-group-header-group');
    const lastHeaderGroupElement = allHeaders.length ? allHeaders[allHeaders.length - 1] : null;

    if (lastHeaderGroupElement) {
      const rect = lastHeaderGroupElement.getBoundingClientRect();
      document.documentElement.style.setProperty('--header-group-height', `${rect.bottom + window.scrollY}px`);
    }
  }

  const handleTransitionEnd = (e) => {
    if (e.target === fadeInElement) {
      document.body.style.setProperty("--fade-in-element-display", "none");
      fadeInElement.removeEventListener('transitionend', handleTransitionEnd);
    }
  };

  fadeInElement.addEventListener('transitionend', handleTransitionEnd);

  setTimeout(() => {
    document.body.style.setProperty("--fade-in-element-display", "none");
  }, 3500); 
}

document.addEventListener("DOMContentLoaded", configurePageFadeInOnLoad);

const PUB_SUB_EVENTS = {
  cartUpdate: 'cart-update',
  quantityUpdate: 'quantity-update',
  variantChange: 'variant-change',
  cartError: 'cart-error',
};

const SECTION_REFRESH_RESOURCE_TYPE = {
  product: 'product',
};

let subscribers = {};

function subscribe(eventName, callback) {
  if (subscribers[eventName] === undefined) {
    subscribers[eventName] = [];
  }

  subscribers[eventName] = [...subscribers[eventName], callback];

  return function unsubscribe() {
    subscribers[eventName] = subscribers[eventName].filter((cb) => {
      return cb !== callback;
    });
  };
}

function publish(eventName, data) {
  if (subscribers[eventName]) {
    subscribers[eventName].forEach((callback) => {
      callback(data);
    });
  }
}

function filterShopifyEvent(event, domElement, callback) {
  let executeCallback = false;
  if (event.type.includes('shopify:section')) {
    if (domElement.hasAttribute('data-section-id') && domElement.getAttribute('data-section-id') === event.detail.sectionId) {
      executeCallback = true;
    }
  }
  else if (event.type.includes('shopify:block') && event.target === domElement) {
    executeCallback = true;
  }
  if (executeCallback) {
    callback(event);
  }
}

// Init section function when it's visible, then disable observer
theme.initWhenVisible = function(options) {
  const threshold = options.threshold ? options.threshold : 0;

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (typeof options.callback === 'function') {
          options.callback();
          observer.unobserve(entry.target);
        }
      }
    });
  }, {rootMargin: `0px 0px ${threshold}px 0px`});

  observer.observe(options.element);
};

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href]:not([tabindex^='-']), button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object:not([tabindex^='-']), iframe, color-swatch"
    )
  );
}

class HTMLUpdateUtility {
  #preProcessCallbacks = [];
  #postProcessCallbacks = [];

  constructor() {}

  addPreProcessCallback(callback) {
    this.#preProcessCallbacks.push(callback);
  }

  addPostProcessCallback(callback) {
    this.#postProcessCallbacks.push(callback);
  }

  /**
    * Used to swap an HTML node with a new node.
    * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
    *
    * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
    */
  viewTransition(oldNode, newContent) {
    this.#preProcessCallbacks.forEach((callback) => callback(newContent));

    const newNode = oldNode.cloneNode();
    HTMLUpdateUtility.setInnerHTML(newNode, newContent.innerHTML);
    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = 'none';

    this.#postProcessCallbacks.forEach((callback) => callback(newNode));

    setTimeout(() => oldNode.remove(), 1000);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    element.querySelectorAll('script').forEach((oldScriptTag) => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}

if (window.Shopify && window.Shopify.designMode) {
  document.documentElement.style.setProperty(
      "--scrollbar-width",
      `${window.innerWidth - document.documentElement.clientWidth}px`
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const ltrInputs = document.querySelectorAll('input[type="email"], input[type="tel"], input[type="number"], input[type="url"]');

  ltrInputs.forEach(ltrInput => {
    const placeholder = ltrInput.getAttribute('placeholder');

    if (placeholder) {
      const isPlaceholderRTL = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(placeholder); 

      ltrInput.style.setProperty("--placeholder-align", isPlaceholderRTL ? "right" : "left");
    }
  })
});

document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));

  if(summary.nextElementSibling.getAttribute('id')) {
    summary.setAttribute('aria-controls', summary.nextElementSibling.id);
  }

  summary.addEventListener('click', (event) => {
    event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
  });

  if (summary.closest('header-drawer')) return;
  summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});

document.addEventListener("DOMContentLoaded", function () {
  function animateHighlights() {
      const highlights = document.querySelectorAll(".custom-heading .highlight");

      const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
              if (entry.intersectionRatio > 0.75) {
                  entry.target.classList.add("visible");
                  const promo = entry.target.closest('.scrolling-promotion') || entry.target.querySelector('.scrolling-promotion');
                  if (promo) {
                    promo.querySelectorAll('.highlight').forEach(text => text.classList.add('visible'));
                  }
              }
          });
      }, { threshold: 0.75 });

      highlights.forEach(highlight => {
        highlight.closest('.section-scrolling-promotion-banner') ? observer.observe(highlight.closest('.section-scrolling-promotion-banner').querySelector('.banner__content-wrapper')) : observer.observe(highlight)
      });
  }

  animateHighlights();

  document.addEventListener("shopify:section:load", function () {
      animateHighlights();
  });
});

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {

  if(!container) return
  var elements = getFocusableElements(container);
  
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
      event.target !== container &&
      event.target !== last &&
      event.target !== first
    )
      return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function() {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function(event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
      (event.target === container || event.target === first) &&
      event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  if (elementToFocus) elementToFocus.focus();
}
focusVisiblePolyfill()

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(":focus-visible");
} catch(e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'TAB', 'ENTER', 'SPACE', 'ESCAPE', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN']
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener('keydown', (event) => {
    if(event.code && navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener('mousedown', (event) => {
    mouseClick = true;
  });

  window.addEventListener('focus', () => {
    if (currentFocusedElement) {
      currentFocusedElement.classList.remove('focused')
      if(currentFocusedElement.closest('.product_options-hover') && currentFocusedElement.closest('.product_options-hover').className.includes('focused-elements')) currentFocusedElement.closest('.product_options-hover').classList.remove('focused-elements')
    };
    if (mouseClick) return;
    currentFocusedElement = document.activeElement;
    currentFocusedElement.classList.add('focused');
    if(currentFocusedElement.closest('.product_options-hover') && !currentFocusedElement.closest('.product_options-hover').className.includes('focused-elements')) {
      currentFocusedElement.closest('.product_options-hover').classList.add('focused-elements')
    }

  }, true);
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
  
function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': `application/${type}` }
  };
}

function preloadImages(element) {
  if (!element) element = document;

  element.querySelectorAll('.card-product img').forEach(img => {
    img.addEventListener('load', () => {img.classList.add('loaded')})
    if (img.complete) img.classList.add('loaded')
  })
}
preloadImages()

function getMediaType(media) {
  if (!media) {
    return null;
  }

  const mediaType =
    media.tagName.toUpperCase() === "VIDEO"
      ? "VIDEO"
      : media.tagName.toUpperCase() === "IMG"
      ? "IMAGE"
      : media.classList.contains("js-youtube")
      ? "YOUTUBE"
      : media.classList.contains("js-vimeo")
      ? "VIMEO"
      : media.tagName.toUpperCase() === 'PRODUCT-MODEL'
      ? 'MODEL'
      : null;

  return mediaType;
}

function pauseAllMedia() {
  document.querySelector('body').querySelectorAll('.js-youtube').forEach(video => {
    if(video.closest('main') || video.closest('.shopify-section-group-footer-group') || video.closest('.product-media-modal')) pauseYoutubeVideo(video)
  });
  document.querySelector('body').querySelectorAll('.js-vimeo').forEach(video => {
    if(video.closest('main') || video.closest('.shopify-section-group-footer-group') || video.closest('.product-media-modal')) pauseVimeoVideo(video)
  });
  document.querySelector('body').querySelectorAll('video').forEach(video => {
    if(video.closest('main') || video.closest('.shopify-section-group-footer-group') || video.closest('.product-media-modal')) pauseVideo(video)
  });
  document.querySelector('body').querySelectorAll('product-model').forEach(model => {
    if (model.modelViewerUI) pauseModel(model)
  });
}

function handleMediaAction(media, actions, isAutoplayEnabled = false) {
  if (!media) {
    return;
  }

  const mediaType = getMediaType(media);
  const action = actions[mediaType];

  if (action) {
    action(media, isAutoplayEnabled);
  }
}

function pauseMedia(media, isAutoplayEnabled = false) {
  handleMediaAction(media, {
    'VIDEO': pauseVideo,
    'YOUTUBE': pauseYoutubeVideo,
    'VIMEO': pauseVimeoVideo,
    'MODEL': pauseModel
  }, isAutoplayEnabled);
}

function playMedia(media, isAutoplayEnabled = false, forcePlay = false) {
  if (!forcePlay && media && media.dataset.pausedByScript === 'false' && isAutoplayEnabled) {
    return;
  }

  handleMediaAction(media, {
    'VIDEO': playVideo,
    'YOUTUBE': playYoutubeVideo,
    'VIMEO': playVimeoVideo,
    'MODEL': playModel
  }, isAutoplayEnabled);
}

async function playYoutubeVideo(video, isAutoplayEnabled = false) {
  if (!video || video.tagName !== 'IFRAME') {
    console.warn('Invalid video element provided');
    return;
  }

  try {
    await loadScript('youtube');

    const youtubePlayer = await getYoutubePlayer(video);

    if (isAutoplayEnabled) {
      youtubePlayer.mute();
    }

    youtubePlayer.playVideo();
  } catch (error) {
    console.error('Error handling YouTube video play:', error);
  }
}

async function pauseYoutubeVideo(video, isAutoplayEnabled = false) {
  if (!video || video.tagName !== 'IFRAME') {
    console.warn('Invalid video element provided');
    return;
  }

  try {
    await loadScript('youtube');

    const youtubePlayer = await getYoutubePlayer(video);
    const playerState = youtubePlayer.getPlayerState();

    if (playerState === YT.PlayerState.PAUSED) {
      return; 
    }

    youtubePlayer.pauseVideo();

    if (isAutoplayEnabled) {
      video.setAttribute('data-paused-by-script', 'true');

      // Attach a one-time event listener for the play event
      const handleStateChange = (event) => {
        if (event.data === YT.PlayerState.PLAYING) {
          video.setAttribute('data-paused-by-script', 'false');
          youtubePlayer.removeEventListener('onStateChange', handleStateChange);
        }
      };

      youtubePlayer.addEventListener('onStateChange', handleStateChange);
    }
  } catch (error) {
    console.error('Error handling YouTube video pause:', error);
  }
}

function getYoutubePlayer(video) {
  return new Promise((resolve) => {
    window.YT.ready(() => {
      const existingPlayer = YT.get(video.id);

      if (existingPlayer) {
        resolve(existingPlayer);
      } else {
        const playerInstance = new YT.Player(video, {
          events: {
            onReady: (event) => resolve(event.target),
          },
        });
      }
    });
  });
}

function removeYoutubePlayer(videoId) {
  const existingPlayer = YT.get(videoId);

  if (existingPlayer) {
    existingPlayer.destroy(); 
  }
}

function playVimeoVideo(video, isAutoplayEnabled = false) {
  if (!video || video.tagName !== 'IFRAME') {
    return;
  }

  if (isAutoplayEnabled) {
    video.contentWindow?.postMessage(
      JSON.stringify({ method: 'setVolume', value: 0 }),
      '*'
    );
  }

  video.contentWindow?.postMessage('{"method":"play"}', '*');
}

async function pauseVimeoVideo(video, isAutoplayEnabled = false) {
  if (!video || video.tagName !== 'IFRAME') {
    return;
  }

  try {
    await loadScript('vimeo');

    const vimeoPlayer = new Vimeo.Player(video);
    const isPaused = await vimeoPlayer.getPaused();

    if (isPaused) {
      return; 
    }

    video.contentWindow?.postMessage('{"method":"pause"}', '*');
    
    if (isAutoplayEnabled) { 
      video.setAttribute('data-paused-by-script', 'true');  

      const handlePlay = () => {
        video.setAttribute('data-paused-by-script', 'false');
        vimeoPlayer.off('play', handlePlay);
      };

      vimeoPlayer.on('play', handlePlay);
    }
  } catch (error) {
    console.error('Error handling Vimeo video pause:', error);
  }
}

function playVideo(video, isAutoplayEnabled = false) {
  if (!video || !(video instanceof HTMLVideoElement)) {
    return;
  }

  if (isAutoplayEnabled) {
    video.muted = true;
  }

  video.play();
}

function pauseVideo(video, isAutoplayEnabled = false) {
  if (!video || !(video instanceof HTMLVideoElement)) {
    return;
  }

  if (video.paused) { 
    return;
  } 

  video.pause();
  
  if (isAutoplayEnabled) {  
    video.setAttribute('data-paused-by-script', 'true');  

    video.addEventListener('play', () => { 
      video.setAttribute('data-paused-by-script', 'false');
    }, { once: true })
  }
}

function playModel(model) {
  if (model.modelViewerUI) model.modelViewerUI.play();
}

function pauseModel(model) {
  if (model.modelViewerUI) model.modelViewerUI.pause();
}

function loadScript(mediaType) {
  return new Promise((resolve, reject) => {
    let scriptId;

    switch (mediaType) {
      case 'youtube':
        scriptId = 'youtube-iframe-api';
        break;
      case 'vimeo':
        scriptId = 'vimeo-player-api';
        break;
      default:
        reject();
        return;
    }

    if (document.getElementById(scriptId)) {
      resolve();

      return;
    }

    const script = document.createElement('script');
    script.id = scriptId; 
    document.body.appendChild(script);

    script.onload = resolve;
    script.onerror = reject;
    script.async = true;

    switch (mediaType) {
      case 'youtube':
        script.src = 'https://www.youtube.com/iframe_api';
        break;
      case 'vimeo':
        script.src = '//player.vimeo.com/api/player.js';
        break;
      default:
        reject();
        return;
    }
  });
}

// Play or pause a video/product model if it’s visible or not
(() => {
  const ROOTS_SELECTOR = 'main, .shopify-section-group-footer-group, .product-media-modal';

  const IO_OPTIONS = {
    root: null,
    rootMargin: '0px 0px 0px 0px',
    threshold: 0.0
  };

  // ---------- utils ----------
  function inAllowedRoot(el) {
    return !!el.closest(ROOTS_SELECTOR);
  }

  function isExcludedVideo(video) {
    if (video.closest('.none-autoplay')) return true;
    return false;
  }

  function isExcludedFromScrollLogic(video) {
    if (video.closest('.stories-slideshow')) return true;
    return false;
  }

  function isPausedByControls(video) {
    const wrap = video.closest('.video-controls-js');
    if (!wrap) return false;
    return !!wrap.querySelector('.button--pause.pause');
  }

  function isPlaying(video) {
    return (
      video.currentTime > 0 &&
      !video.paused &&
      !video.ended &&
      video.readyState > video.HAVE_CURRENT_DATA
    );
  }

  async function safePlay(video) {
    try {
      const p = video.play();
      if (p && typeof p.then === 'function') await p;
    } catch (e) {
    }
  }

  function safePause(video) {
    try { video.pause(); } catch (e) {}
  }

  // ---------- registries ----------
  const observedVideos = new Set();
  const observedModels = new Set();

  // ---------- IntersectionObserver callbacks ----------
  const videoIO = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target;

      if (!video.isConnected) {
        observedVideos.delete(video);
        continue;
      }

      if (!inAllowedRoot(video)) continue;
      if (isExcludedVideo(video)) continue;
      if (isExcludedFromScrollLogic(video)) continue;

      if (isPausedByControls(video)) {
        if (!entry.isIntersecting) safePause(video);
        continue;
      }

      if (entry.isIntersecting) {
        if (!isPlaying(video)) safePlay(video);
      } else {
        safePause(video);
      }
    }
  }, IO_OPTIONS);

  const modelIO = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const model = entry.target;

      if (!model.isConnected) {
        observedModels.delete(model);
        continue;
      }

      if (!inAllowedRoot(model)) continue;

      const ui = model.modelViewerUI;
      if (!ui) continue;

      try {
        entry.isIntersecting ? ui.play() : ui.pause();
      } catch (e) {}
    }
  }, IO_OPTIONS);

  // ---------- observe / unobserve ----------
  function observeVideo(video) {
    if (!video || observedVideos.has(video)) return;
    observedVideos.add(video);
    videoIO.observe(video);

    const onLoaded = () => {
    };
    if (!video.__autoPlayBound) {
      video.__autoPlayBound = true;
      video.addEventListener('loadeddata', onLoaded, { passive: true });
    }
  }

  function observeModel(model) {
    if (!model || observedModels.has(model)) return;
    observedModels.add(model);
    modelIO.observe(model);
  }

  // ---------- scanning (NO scroll) ----------
  function scanAndObserve(root = document) {
    root.querySelectorAll('video').forEach((video) => {
      if (!inAllowedRoot(video)) return;
      if (isExcludedVideo(video)) return;
      if (isExcludedFromScrollLogic(video)) return;
      observeVideo(video);
    });

    // product-model
    root.querySelectorAll('product-model').forEach((model) => {
      if (!inAllowedRoot(model)) return;
      observeModel(model);
    });
  }

  // ---------- MutationObserver for dynamic content ----------
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;

        if (node.tagName === 'VIDEO') {
          scanAndObserve(node.parentNode || document);
          continue;
        }
        if (node.tagName === 'PRODUCT-MODEL') {
          scanAndObserve(node.parentNode || document);
          continue;
        }

        if (node.querySelector) {
          if (node.querySelector('video, product-model')) {
            scanAndObserve(node);
          }
        }
      }
    }
  });

  function init() {
    scanAndObserve(document);

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(init), { once: true });
  } else {
    requestAnimationFrame(init);
  }

  if (window.Shopify && Shopify.designMode) {
    document.addEventListener('shopify:section:load', (e) => {
      const root = e?.target || document;
      requestAnimationFrame(() => scanAndObserve(root));
    });
  }
})();

function isStorageSupported (type) {
  if (window.self !== window.top) {
    return false;
  }
  const testKey = 'volume-theme:test';
  let storage;
  if (type === 'session') {
    storage = window.sessionStorage;
  }
  if (type === 'local') {
    storage = window.localStorage;
  }

  try {
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  }
  catch (error) {
    // Do nothing, this may happen in Safari in incognito mode
    return false;
  }
}

/*
  * Shopify Common JS
  */
if ((typeof window.Shopify) == 'undefined') {
  window.Shopify = {};
}
Shopify.bind = function(fn, scope) {
  return function() {
    return fn.apply(scope, arguments);
  }
};
  
Shopify.setSelectorByValue = function(selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};
  
Shopify.addListener = function(target, eventName, callback) {
  if(target) target.addEventListener ? target.addEventListener(eventName, callback, false) : target.attachEvent('on'+eventName, callback);
};
  
Shopify.postLink = function(path, options) {
  options = options || {};
  var method = options['method'] || 'post';
  var params = options['parameters'] || {};
  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for(var key in params) {
    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};
  
Shopify.CountryProvinceSelector = function(country_domid, province_domid, options) {
  this.countryEl 
  this.provinceEl
  this.provinceContainer

  this.shippingCalculators = document.querySelectorAll('shipping-calculator');

  if (this.shippingCalculators.length > 0) {
    this.shippingCalculators.forEach(shippingCalculator => {
      this.countryEl         = shippingCalculator.querySelector(`#${country_domid}`);
      this.provinceEl        = shippingCalculator.querySelector(`#${province_domid}`);
      this.provinceContainer = shippingCalculator.querySelector(`#${options['hideElement']}` || `#${province_domid}`);

      if(!this.countryEl) return
      Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));
  
      this.initCountry();
      this.initProvince();
    })
  } else {
    this.countryEl         = document.getElementById(country_domid);
    this.provinceEl        = document.getElementById(province_domid);
    this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

    Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));

    this.initCountry();
    this.initProvince();
  }
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function() {
    var value = this.countryEl.getAttribute('data-default');
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function() {
    var value = this.provinceEl.getAttribute('data-default');
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function(e) {
    var opt       = this.countryEl.options[this.countryEl.selectedIndex];
    var raw       = opt.getAttribute('data-provinces');
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = 'none';
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement('option');
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }
      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function(selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function(selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement('option');
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  }
};

document.addEventListener('quickview:loaded', () => {
  window.ProductModel = {
    loadShopifyXR() {
      Shopify.loadFeatures([
        {
          name: 'shopify-xr',
          version: '1.0',
          onLoad: this.setupShopifyXR.bind(this),
        },
      ]);
    },
  
    setupShopifyXR(errors) {
      if (errors) return;
  
      if (!window.ShopifyXR) {
        document.addEventListener('shopify_xr_initialized', () =>
          this.setupShopifyXR()
        );
        return;
      }
  
      document.querySelectorAll('[id^="ProductJSON-"]').forEach((modelJSON) => {
        window.ShopifyXR.addModels(JSON.parse(modelJSON.textContent));
        modelJSON.remove();
      });
      window.ShopifyXR.setupXRElements();
    },
  };
  if (window.ProductModel) {
      window.ProductModel.loadShopifyXR();
  }
});


function initStoriesSlideshow() {
  const runIdle = (fn, timeout = 1500) => {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout });
    else setTimeout(fn, 0);
  };

  const STATE = new WeakMap();

  function getState(root) {
    let s = STATE.get(root);
    if (!s) {
      s = {
        root,
        inited: false,
        lazyArmed: false,
        initScheduled: false,

        autoplaySpeed: 8000,

        mainSliderEl: null,
        storiesSlider: null,
        thumbnailsWrapper: null,
        thumbnails: [],
        slides: [],

        // Swipers
        mainSwiper: null,
        innerSwipers: [],

        // autoplay / timers
        autoplayTimeout: null,
        autoplayRemainingTime: 0,
        autoplayStartTime: 0,

        holdTimeout: null,
        isHolding: false,
        wasHolding: false,
        swipe: false,

        // observers / listeners
        thumbsIO: null,
        lazyIO: null,
        firstIntent: null,
        onDocClick: null,
        onKeyUp: null,
        onResize: null,
        resizeTimer: 0,

        // per-inner meta
        autoplayMeta: new WeakMap(),
      };
      STATE.set(root, s);
    }
    return s;
  }

  function isOpen(s) {
    return !!(s.storiesSlider && s.storiesSlider.classList.contains('stories-slider-in'));
  }

  function clearAutoplayTimeout(s) {
    if (s.autoplayTimeout) {
      clearTimeout(s.autoplayTimeout);
      s.autoplayTimeout = null;
    }
  }

  function getMeta(s, swiper) {
    let meta = s.autoplayMeta.get(swiper);
    if (!meta) {
      meta = { remaining: 0, endTimeout: null, startedAt: 0 };
      s.autoplayMeta.set(swiper, meta);
    }
    return meta;
  }

  function clearEndTimeout(s, swiper) {
    const meta = getMeta(s, swiper);
    if (meta.endTimeout) {
      clearTimeout(meta.endTimeout);
      meta.endTimeout = null;
    }
  }

  function resetBulletProgress(innerSwiper) {
    if (!innerSwiper?.el) return;
    const active = innerSwiper.el.querySelector('.swiper-pagination-bullet-active');
    if (!active) return;

    active.classList.remove('paused');
    active.classList.remove('swiper-pagination-bullet-active');
    void active.offsetWidth;
    active.classList.add('swiper-pagination-bullet-active');
  }

  function pauseInnerSwiper(s, innerSwiper) {
    if (!innerSwiper) return;

    const baseDelay = innerSwiper.params.autoplay?.delay ?? s.autoplaySpeed;
    const elapsed = Math.max(0, Date.now() - (s.autoplayStartTime || Date.now()));
    s.autoplayRemainingTime = Math.max(0, baseDelay - elapsed);

    const meta = getMeta(s, innerSwiper);
    meta.remaining = s.autoplayRemainingTime;

    try { innerSwiper.autoplay.stop(); } catch (e) {}
    clearAutoplayTimeout(s);
    clearEndTimeout(s, innerSwiper);
  }

  function startInnerSwiperWithDelay(s, innerSwiper, delayMs) {
    if (!innerSwiper) return;

    innerSwiper.params.autoplay.delay = delayMs;
    try { innerSwiper.autoplay.start(); } catch (e) {}

    s.autoplayStartTime = Date.now();
    const meta = getMeta(s, innerSwiper);
    meta.startedAt = s.autoplayStartTime;

    if (innerSwiper.slides?.length === 1) {
      clearAutoplayTimeout(s);

      s.autoplayTimeout = setTimeout(() => {
        const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
        const activeInnerEl = activeOuterSlide?.querySelector('.swiper-story-inner');
        const productsOpen = activeInnerEl?.querySelector('.stories__products.open');
        if (!productsOpen) handleNextOuterSlide(s, s.mainSwiper.realIndex);
      }, delayMs);

      return;
    }

    if (innerSwiper.isEnd && s.mainSwiper) {
      const idx = s.mainSwiper.realIndex;
      clearEndTimeout(s, innerSwiper);

      meta.endTimeout = setTimeout(() => {
        const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
        const activeInnerEl = activeOuterSlide?.querySelector('.swiper-story-inner');
        const productsOpen = activeInnerEl?.querySelector('.stories__products.open');

        if (!productsOpen && innerSwiper.isEnd && s.mainSwiper.realIndex === idx) {
          handleNextOuterSlide(s, idx);
          try { innerSwiper.autoplay.stop(); } catch (e) {}
        }
        meta.endTimeout = null;
      }, delayMs);
    }
  }

  function customAutoplayResume(s) {
    if (!s.mainSwiper) return;

    const activeOuterSlide = s.mainSwiper.slides[s.mainSwiper.activeIndex];
    const activeInnerEl = activeOuterSlide?.querySelector('.swiper-story-inner');
    const inner = activeInnerEl?.swiper;
    if (!inner) return;

    const meta = getMeta(s, inner);
    const remaining =
      (meta.remaining > 0 ? meta.remaining : (s.autoplayRemainingTime > 0 ? s.autoplayRemainingTime : s.autoplaySpeed));

    clearAutoplayTimeout(s);
    clearEndTimeout(s, inner);

    startInnerSwiperWithDelay(s, inner, remaining);
  }

  function handleNextOuterSlide(s, index) {
    if (!s.mainSwiper || !s.slides?.length) return;

    if (index < s.slides.length - 1) {
      s.mainSwiper.slideNext();
      const next = s.innerSwipers[index + 1];
      if (next) resetBulletProgress(next);
    } else {
      s.mainSwiper.slideTo(0, 0);
    }
  }

  function delayedHandleNextOuter(s, innerSwiper, index) {
    if (!innerSwiper || innerSwiper._endTimeout) return;
    innerSwiper._endTimeout = true;

    clearAutoplayTimeout(s);

    const delay = innerSwiper.params.autoplay?.delay ?? s.autoplaySpeed;
    s.autoplayRemainingTime = delay;
    s.autoplayStartTime = Date.now();

    const meta = getMeta(s, innerSwiper);
    clearEndTimeout(s, innerSwiper);

    meta.endTimeout = setTimeout(() => {
      const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
      const activeInnerEl = activeOuterSlide?.querySelector('.swiper-story-inner');
      const productsOpen = activeInnerEl?.querySelector('.stories__products.open');

      if (!productsOpen && innerSwiper.isEnd) {
        handleNextOuterSlide(s, index);
        try { innerSwiper.autoplay.stop(); } catch (e) {}
      }

      innerSwiper._endTimeout = false;
      meta.endTimeout = null;
    }, s.autoplayRemainingTime);
  }

  function handleHoldStart(s, innerSwiper) {
    clearTimeout(s.holdTimeout);
    s.holdTimeout = setTimeout(() => {
      s.isHolding = true;
      s.wasHolding = true;

      pauseInnerSwiper(s, innerSwiper);

      const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
      const activeInnerEl = activeOuterSlide?.querySelector('.swiper-story-inner');
      const bulletActive = activeInnerEl?.querySelector('.swiper-pagination-bullet-active');
      bulletActive?.classList.add('paused');

      if (s.mainSwiper) s.mainSwiper.allowTouchMove = false;
    }, 200);
  }

  function handleHoldEnd(s, innerSwiper) {
    clearTimeout(s.holdTimeout);
    if (!s.isHolding) return;

    s.isHolding = false;

    const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
    const activeInnerEl = activeOuterSlide?.querySelector('.swiper-story-inner');
    const bulletActive = activeInnerEl?.querySelector('.swiper-pagination-bullet-active');

    if (s.mainSwiper) s.mainSwiper.allowTouchMove = true;

    bulletActive?.classList.remove('paused');
    customAutoplayResume(s);

    setTimeout(() => { s.wasHolding = false; }, 150);
  }

  function closeStories(s) {
    if (!s) return;

    try {
      if (s.mainSwiper) {
        s.mainSwiper.autoplay?.stop?.();
        s.mainSwiper.allowTouchMove = false;
      }
    } catch (e) {}

    s.innerSwipers.forEach((sw) => {
      if (!sw) return;
      try {
        sw.autoplay?.stop?.();
        sw.allowTouchMove = false;
      } catch (e) {}
      clearEndTimeout(s, sw);
    });

    clearAutoplayTimeout(s);

    if (s.storiesSlider) {
      s.storiesSlider.classList.remove('stories-slider-in');
      s.storiesSlider.classList.add('visually-hidden');
    }

    const overlay = document.querySelector('body > .overlay');
    overlay?.classList.remove('open');
    document.body.classList.remove('hidden', 'overlay-opened');

    s.root.querySelectorAll('.stories__products.open').forEach((productsEl) => {
      productsEl.classList.remove('open');
      productsEl.closest('.swiper-story-inner')?.classList.remove('products-open');
    });

    s.root.querySelectorAll('.swiper-pagination-bullet.paused').forEach((b) => b.classList.remove('paused'));
  }

  function setupThumbnailsAnimationIO(s) {
    if (!s.thumbnailsWrapper || !('IntersectionObserver' in window)) return;

    if (s.thumbsIO) {
      try { s.thumbsIO.disconnect(); } catch (e) {}
      s.thumbsIO = null;
    }

    s.thumbsIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const thumbs = entry.target.querySelectorAll('.stories-slideshow__thumbnail');
        if (!thumbs.length) return;

        if (entry.isIntersecting) {
          thumbs.forEach((thumb, idx) => {
            setTimeout(() => thumb.classList.add('visible'), idx * 2000);
          });
        } else {
          thumbs.forEach((thumb) => thumb.classList.remove('visible'));
        }
      });
    }, { threshold: 0.9 });

    s.thumbsIO.observe(s.thumbnailsWrapper);
  }

  function ensureMainSwiper(s) {
    if (s.mainSwiper) return;

    if (!s.mainSliderEl) s.mainSliderEl = s.root.querySelector('.swiper-stories');
    if (!s.mainSliderEl) return;

    s.mainSwiper = new Swiper(s.mainSliderEl, {
      slidesPerView: 'auto',
      centeredSlides: true,
      modules: [EffectCarousel],
      loop: false,
      effect: 'carousel',
      carouselEffect: {
        opacityStep: 0.33,
        scaleStep: 0.09,
        sideSlides: 8,
      },
      on: {
        slideChange: function () {
          const oldIndex = s.mainSwiper.previousIndex;
          const newIndex = s.mainSwiper.realIndex;

          const oldInner = s.innerSwipers[oldIndex];
          const nextInner = s.innerSwipers[newIndex];

          if (oldInner) {
            pauseInnerSwiper(s, oldInner);
            try { oldInner.slideTo(0, 0); } catch (e) {}
          }

          if (!nextInner) return;

          try { nextInner.slideTo(0, 0); } catch (e) {}
          resetBulletProgress(nextInner);

          nextInner.params.autoplay.delay = s.autoplaySpeed;
          s.autoplayRemainingTime = s.autoplaySpeed;
          s.mainSliderEl.style.setProperty('--active-slide-duration', `${s.autoplaySpeed / 1000}s`);

          startInnerSwiperWithDelay(s, nextInner, s.autoplayRemainingTime);
        }
      }
    });
  }

  function ensureInnerSwipers(s) {
    if (s.innerSwipers && s.innerSwipers.length) return;

    if (!s.slides?.length) s.slides = Array.from(s.root.querySelectorAll('.stories-slides'));
    if (!s.slides.length) return;

    s.innerSwipers = [];

    s.slides.forEach((slide, index) => {
      const innerEl = slide.querySelector('.swiper-story-inner');
      if (!innerEl) {
        s.innerSwipers.push(null);
        return;
      }

      const innerSwiper = new Swiper(innerEl, {
        slidesPerView: 1,
        spaceBetween: 0,
        loop: false,
        pagination: {
          el: innerEl.querySelector('.stories-slider-pagination'),
          type: 'bullets',
          clickable: true,
        },
        autoplay: {
          delay: s.autoplaySpeed,
          disableOnInteraction: false,
        },
        observer: true,
        observeParents: true,
        observeSlideChildren: true,
      });

      s.innerSwipers.push(innerSwiper);

      try { innerSwiper.autoplay.stop(); } catch (e) {}
      innerSwiper.allowTouchMove = false;

      innerSwiper.on('slideChange', () => {
        if (!s.mainSwiper) return;

        const isActiveOuter = (s.mainSwiper.realIndex === index);
        if (!isActiveOuter) {
          pauseInnerSwiper(s, innerSwiper);
          return;
        }

        s.mainSliderEl?.style?.setProperty('--active-slide-duration', `${s.autoplaySpeed / 1000}s`);
        innerSwiper.params.autoplay.delay = s.autoplaySpeed;

        resetBulletProgress(innerSwiper);
        startInnerSwiperWithDelay(s, innerSwiper, s.autoplaySpeed);

        if (innerSwiper.slides.length === 1) {
          clearAutoplayTimeout(s);

          s.autoplayRemainingTime = innerSwiper.params.autoplay.delay;
          s.autoplayStartTime = Date.now();

          s.autoplayTimeout = setTimeout(() => {
            const productsOpen = slide.querySelector('.stories__products.open');
            if (!productsOpen) handleNextOuterSlide(s, index);
          }, s.autoplayRemainingTime);
        } else if (innerSwiper.isEnd) {
          delayedHandleNextOuter(s, innerSwiper, index);
        }
      });

      innerSwiper.on('autoplayStart', () => {
        s.autoplayStartTime = Date.now();
        const meta = getMeta(s, innerSwiper);
        meta.startedAt = s.autoplayStartTime;
      });

      innerSwiper.on('autoplayStop', () => {
        const baseDelay = innerSwiper.params.autoplay?.delay ?? s.autoplaySpeed;
        const elapsed = Math.max(0, Date.now() - (s.autoplayStartTime || Date.now()));
        s.autoplayRemainingTime = Math.max(0, baseDelay - elapsed);

        const meta = getMeta(s, innerSwiper);
        meta.remaining = s.autoplayRemainingTime;

        clearAutoplayTimeout(s);
        clearEndTimeout(s, innerSwiper);
      });

      slide.querySelectorAll('.swiper-slide').forEach((swSlide) => {
        const nextBtn = swSlide.querySelector('.stories-slider-button-next');
        const prevBtn = swSlide.querySelector('.stories-slider-button-prev');

        if (nextBtn) {
          nextBtn.addEventListener('click', (e) => {
            if (s.wasHolding || s.swipe) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            !innerSwiper.isEnd ? innerSwiper.slideNext() : handleNextOuterSlide(s, index);
          }, { passive: false });
        }

        if (prevBtn) {
          prevBtn.addEventListener('click', (e) => {
            if (s.wasHolding) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }

            if (!innerSwiper.isBeginning) {
              innerSwiper.slidePrev();
            } else {
              s.mainSwiper?.slidePrev?.();
              const prevInner = s.innerSwipers[s.mainSwiper?.realIndex || 0];
              if (prevInner) resetBulletProgress(prevInner);
            }
          }, { passive: false });
        }

        swSlide.querySelectorAll('.stories-slider-button').forEach((btn) => {
          btn.addEventListener('pointerdown', () => handleHoldStart(s, innerSwiper), { passive: true });
          btn.addEventListener('pointerup',   () => handleHoldEnd(s, innerSwiper),   { passive: true });
          btn.addEventListener('pointercancel', () => handleHoldEnd(s, innerSwiper), { passive: true });
        });

        const title = swSlide.querySelector('.stories__products-title');
        const productsEl = swSlide.querySelector('.stories__products');

        if (title && productsEl) {
          title.addEventListener('click', (e) => {
            const isActiveOuter = (s.mainSwiper?.realIndex === index);
            const isActiveInner =
              (innerSwiper.activeIndex === Array.from(swSlide.parentNode.children).indexOf(swSlide));

            if (!isActiveOuter || !isActiveInner) return;

            productsEl.classList.toggle('open');
            productsEl.closest('.swiper-story-inner')?.classList.toggle('products-open');

            const bulletActive = swSlide.closest('.swiper-story-inner')
              ?.querySelector('.swiper-pagination-bullet-active');

            if (productsEl.classList.contains('open')) {
              productsEl.style.transitionDelay = '0s';
              pauseInnerSwiper(s, innerSwiper);
              bulletActive?.classList.add('paused');
              if (s.mainSwiper) s.mainSwiper.allowTouchMove = false;
            } else {
              bulletActive?.classList.remove('paused');
              if (s.mainSwiper) s.mainSwiper.allowTouchMove = true;

              setTimeout(() => {
                if (productsEl.style.transitionDelay === '0s') {
                  productsEl.style.removeProperty('transition-delay');
                }
              }, 100);

              customAutoplayResume(s);
            }
          });
        }
      });
    });
  }

  function openStoriesAtIndex(s, index) {
    if (!s.storiesSlider) s.storiesSlider = s.root.querySelector('.stories-slider');
    if (!s.storiesSlider) return;

    s.storiesSlider.classList.add('stories-slider-in');
    s.storiesSlider.classList.remove('visually-hidden');

    const overlay = document.querySelector('body > .overlay');
    overlay?.classList.add('open');
    document.body.classList.add('hidden', 'overlay-opened');

    ensureMainSwiper(s);

    ensureInnerSwipers(s);

    if (!s.mainSwiper) return;

    s.innerSwipers.forEach((sw) => {
      if (!sw) return;
      pauseInnerSwiper(s, sw);
      try { sw.slideTo(0, 0); } catch (e) {}
    });

    s.mainSwiper.slideTo(index, 0);

    const inner = s.innerSwipers[index];
    if (!inner) return;

    try { inner.slideTo(0, 0); } catch (e) {}
    resetBulletProgress(inner);

    inner.params.autoplay.delay = s.autoplaySpeed;
    s.autoplayRemainingTime = s.autoplaySpeed;
    s.mainSliderEl?.style?.setProperty('--active-slide-duration', `${s.autoplaySpeed / 1000}s`);

    inner.allowTouchMove = true;
    if (s.mainSwiper) s.mainSwiper.allowTouchMove = true;

    startInnerSwiperWithDelay(s, inner, s.autoplaySpeed);

    setTimeout(() => {
      if (!isOpen(s)) return;
      if (!inner.slides?.length) return;

      if (inner.slides.length === 1) {
        clearAutoplayTimeout(s);
        s.autoplayRemainingTime = inner.params.autoplay.delay;
        s.autoplayStartTime = Date.now();

        s.autoplayTimeout = setTimeout(() => {
          const productsOpen = s.root.querySelector('.stories__products.open');
          if (!productsOpen) handleNextOuterSlide(s, index);
        }, s.autoplayRemainingTime);
      } else if (inner.isEnd) {
        delayedHandleNextOuter(s, inner, index);
      }
    }, 50);
  }

  function ensureGlobalHandlers(s) {
    if (!s.onDocClick) {
      s.onDocClick = (e) => {
        if (!isOpen(s)) return;
        if (e.target.closest('.video-controls')) return;

        const clickedClose = e.target.closest('.stories-slider-close-button');
        const clickedBackdrop =
          (e.target.classList?.contains('swiper-stories') || e.target.classList?.contains('swiper-wrapper-stories')) &&
          !s.storiesSlider.querySelector('.products-open');

        if (clickedClose || clickedBackdrop) {
          closeStories(s);
          return;
        }

        const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
        const activeInnerEl = activeOuterSlide?.querySelector('.swiper-story-inner');
        const activeInner = activeInnerEl?.swiper;
        if (!activeInner) return;

        const activeInnerSlide = activeInner.slides[activeInner.activeIndex];
        if (!activeInnerSlide) return;

        const productsEl = activeInnerSlide.querySelector('.stories__products');
        const bulletActive = activeInnerEl.querySelector('.swiper-pagination-bullet-active');

        const isInsideProducts = !!e.target.closest('.stories__products');
        const isOnTitle = !!e.target.closest('.stories__products-title');

        if (productsEl && productsEl.classList.contains('open') && !isInsideProducts && !isOnTitle) {
          productsEl.classList.remove('open');
          productsEl.closest('.swiper-story-inner')?.classList.remove('products-open');
          bulletActive?.classList.remove('paused');
          if (s.mainSwiper) s.mainSwiper.allowTouchMove = true;
          customAutoplayResume(s);
        }

        if (!e.target.closest('.stories-slider-button') && !e.target.closest('.stories__products') && !e.target.closest('.stories__products-title')) {
          const clicked = s.mainSwiper?.clickedSlide;
          if (clicked && !clicked.classList.contains('swiper-slide-active')) {
            const idx = Array.from(s.mainSwiper.slides).indexOf(clicked);
            if (idx >= 0) s.mainSwiper.slideTo(idx, 300);
          }
        }
      };

      document.addEventListener('click', s.onDocClick, { passive: false });
    }

    if (!s.onKeyUp) {
      s.onKeyUp = (event) => {
        if (!isOpen(s)) return;
        if ((event.code || '').toUpperCase() === 'ESCAPE') closeStories(s);
      };
      document.addEventListener('keyup', s.onKeyUp);
    }

    if (!s.onResize) {
      s.onResize = () => {
        clearTimeout(s.resizeTimer);
        s.resizeTimer = setTimeout(() => {
          if (!s.mainSliderEl) return;

          if (s.mainSwiper) {
            try { s.mainSwiper.destroy(true, true); } catch (e) {}
            s.mainSwiper = null;
          }

          runIdle(() => {
            ensureMainSwiper(s);

            if (isOpen(s) && s.mainSwiper) {
              const idx = Math.min(s.slides.length - 1, Math.max(0, s.mainSwiper.realIndex || 0));
              s.mainSwiper.slideTo(idx, 0);
            }
          }, 1200);
        }, 200);
      };

      window.addEventListener('resize', s.onResize, { passive: true });
    }
  }

  function armLazyInit(s) {
    if (s.lazyArmed) return;
    s.lazyArmed = true;

    const startInitSoon = () => {
      if (s.initScheduled) return;
      s.initScheduled = true;

      disarmLazyInit(s);

      runIdle(() => {
        s.initScheduled = false;
        ensureMainSwiper(s);
      }, 1500);
    };

    s.firstIntent = () => startInitSoon();
    s.root.addEventListener('pointerenter', s.firstIntent, { once: true, passive: true });
    s.root.addEventListener('pointerdown', s.firstIntent, { once: true, passive: true });
    s.root.addEventListener('focusin', s.firstIntent, { once: true, passive: true });

    if ('IntersectionObserver' in window) {
      s.lazyIO = new IntersectionObserver((entries) => {
        const e = entries && entries[0];
        if (e && e.isIntersecting) startInitSoon();
      }, { root: null, rootMargin: '600px 0px', threshold: 0.01 });

      s.lazyIO.observe(s.root);
    } else {
      startInitSoon();
    }
  }

  function disarmLazyInit(s) {
    if (s.firstIntent) {
      s.root.removeEventListener('pointerenter', s.firstIntent);
      s.root.removeEventListener('pointerdown', s.firstIntent);
      s.root.removeEventListener('focusin', s.firstIntent);
      s.firstIntent = null;
    }
    if (s.lazyIO) {
      try { s.lazyIO.disconnect(); } catch (e) {}
      s.lazyIO = null;
    }
    s.lazyArmed = false;
  }

  function initOne(root) {
    const s = getState(root);
    if (s.inited) return;
    s.inited = true;

    s.autoplaySpeed = Number(root.dataset.autoplaySpeed || 8000) || 8000;

    s.mainSliderEl = root.querySelector('.swiper-stories');
    s.storiesSlider = root.querySelector('.stories-slider');
    s.thumbnailsWrapper = root.querySelector('.stories-slideshow__thumbnails');
    s.thumbnails = Array.from(root.querySelectorAll('.stories-slideshow__thumbnail'));
    s.slides = Array.from(root.querySelectorAll('.stories-slides'));

    setupThumbnailsAnimationIO(s);

    armLazyInit(s);

    ensureGlobalHandlers(s);

    s.thumbnails.forEach((thumbnail, index) => {
      thumbnail.addEventListener('click', (e) => {
        e.preventDefault();

        ensureMainSwiper(s);

        openStoriesAtIndex(s, index);
      }, { passive: false });
    });
  }

  document.querySelectorAll('.stories-slideshow').forEach((root) => {
    if (root.dataset.storiesInited === '1') return;
    root.dataset.storiesInited = '1';
    initOne(root);
  });
}

document.addEventListener('DOMContentLoaded', initStoriesSlideshow);
document.addEventListener('shopify:section:load', (event) => {
  if (event.target?.classList?.contains('section-stories-slideshow')) initStoriesSlideshow();
});

class MultiSwiper {
  constructor(selector, options) {
    this.selector = selector;
    this.options = options;

    this.instances = new Map();

    this._inited = false;
    this._refreshScheduled = false;
    this._resizeRaf = 0;

    this._onResize = this._onResize.bind(this);
    this._refresh = this._refresh.bind(this);

    document.addEventListener('swiper:update', this._refresh, { passive: true });
    document.addEventListener('shopify:section:load', this._refresh, { passive: true });

    window.addEventListener('resize', this._onResize, { passive: true });

    this._scheduleRefresh('boot');
  }

  removeSlide(index, swiperIndex = 0) {
    const swipers = Array.from(this.instances.values()).map(v => v.swiper);
    const swiper = swipers[swiperIndex];
    if (!swiper) return;

    swiper.removeSlide(index);
    swiper.update();
    swiper.slideTo(0, 0, false);
  }

  destroyAllSwipers() {
    for (const [el] of this.instances) {
      this._destroyOne(el);
    }
    this.instances.clear();
  }

  _scheduleRefresh(reason) {
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;

    const run = () => {
      this._refreshScheduled = false;
      this._initOrUpdate();
    };

    requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 1500 });
      } else {
        setTimeout(run, 0);
      }
    });
  }

  _refresh() {
    this._scheduleRefresh('event');
  }

  _onResize() {
    if (this._resizeRaf) return;
    this._resizeRaf = requestAnimationFrame(() => {
      this._resizeRaf = 0;
      for (const [el, data] of this.instances) {
        this._applyAutoplay(el, data.swiper, data.handlers);
        this._applyBullets(el, data.swiper);
      }
    });
  }

  _initOrUpdate() {
    const nodes = Array.from(document.querySelectorAll(this.selector));

    for (const el of Array.from(this.instances.keys())) {
      if (!nodes.includes(el)) this._destroyOne(el);
    }

    for (const el of nodes) {
      if (!this.instances.has(el)) {
        this._createOne(el);
      } else {
        const { swiper, handlers } = this.instances.get(el);
        this._applyAutoplay(el, swiper, handlers);
        this._applyBullets(el, swiper);
      }
    }

    this._inited = true;
  }

  _createOne(container) {
    const swiper = new Swiper(container, this.options);

    const handlers = {
      onEnter: null,
      onLeave: null,
      onOver: null,
      onOut: null
    };

    this.instances.set(container, { swiper, handlers });

    this._applyAutoplay(container, swiper, handlers);
    this._applyBullets(container, swiper);
  }

  _destroyOne(container) {
    const data = this.instances.get(container);
    if (!data) return;

    const { swiper, handlers } = data;

    if (handlers?.onEnter) container.removeEventListener('mouseenter', handlers.onEnter);
    if (handlers?.onLeave) container.removeEventListener('mouseleave', handlers.onLeave);
    if (handlers?.onOver) container.removeEventListener('mouseover', handlers.onOver);
    if (handlers?.onOut) container.removeEventListener('mouseleave', handlers.onOut);

    try { swiper.destroy(true, true); } catch (e) {}

    this.instances.delete(container);
  }

  _applyAutoplay(container, swiper, handlers) {
    if (!swiper || !swiper.params) return;

    const autoplay = container.dataset.autoplay === 'true';
    const hoverAutoplay = container.dataset.hoverAutoplay === 'true';
    const autoplaySpeed = parseInt(container.dataset.autoplaySpeed, 10) || 5000;

    if (handlers.onEnter) {
      container.removeEventListener('mouseenter', handlers.onEnter);
      handlers.onEnter = null;
    }
    if (handlers.onLeave) {
      container.removeEventListener('mouseleave', handlers.onLeave);
      handlers.onLeave = null;
    }
    if (handlers.onOver) {
      container.removeEventListener('mouseover', handlers.onOver);
      handlers.onOver = null;
    }
    if (handlers.onOut) {
      container.removeEventListener('mouseleave', handlers.onOut);
      handlers.onOut = null;
    }

    try {
      if (swiper.autoplay?.running) swiper.autoplay.stop();
    } catch (e) {}

    if (!autoplay) {
      swiper.params.autoplay = false;
      return;
    }

    if (hoverAutoplay) {
      swiper.params.autoplay = { delay: autoplaySpeed, disableOnInteraction: false };

      handlers.onEnter = () => {
        if (window.innerWidth <= 768) return;
        if (!swiper.params) return;
        swiper.params.autoplay = { delay: autoplaySpeed, disableOnInteraction: false };
        try { swiper.autoplay.start(); } catch (e) {}
      };

      handlers.onLeave = () => {
        try {
          if (swiper.autoplay?.running) swiper.autoplay.stop();
        } catch (e) {}
      };

      container.addEventListener('mouseenter', handlers.onEnter, { passive: true });
      container.addEventListener('mouseleave', handlers.onLeave, { passive: true });

      return;
    }

    swiper.params.autoplay = { delay: autoplaySpeed, pauseOnMouseEnter: true };

    try { swiper.autoplay.start(); } catch (e) {}

    handlers.onOver = () => {
      if (!swiper.params) return;
      swiper.params.autoplay = { delay: autoplaySpeed, pauseOnMouseEnter: true };
      try { swiper.autoplay.stop(); } catch (e) {}
    };

    handlers.onOut = () => {
      if (!swiper.params) return;
      swiper.params.autoplay = { delay: autoplaySpeed, pauseOnMouseEnter: true };
      try { swiper.autoplay.start(); } catch (e) {}
    };

    container.addEventListener('mouseover', handlers.onOver, { passive: true });
    container.addEventListener('mouseleave', handlers.onOut, { passive: true });
  }

  _applyBullets(container, swiper) {
    if (!swiper || !swiper.params) return;

    if (container.dataset.paginationType !== 'bullets') return;

    if (swiper.params.pagination && swiper.params.pagination.dynamicBullets === false && swiper.pagination?.bullets?.length) {
      try { swiper.pagination.update(); } catch (e) {}
      return;
    }

    if (swiper.params.pagination) {
      swiper.params.pagination.dynamicBullets = false;
    }

    requestAnimationFrame(() => {
      try {
        swiper.pagination?.render?.();
        swiper.pagination?.update?.();
      } catch (e) {}
    });
  }
}

function validateFormInput (inputElement) {
  const inputType = inputElement.getAttribute('type');
  let isValid = false;

  switch (inputType) {
    case 'checkbox':
      const fieldWrapper = inputElement.closest('label');
      if (fieldWrapper.dataset.group) {
        const groupWrapper = fieldWrapper.parentElement;
        const minSelection = parseInt(groupWrapper.dataset.min) > 0 ? parseInt(groupWrapper.dataset.min) : 1;
        const checkedElms = groupWrapper.querySelectorAll('input[type=checkbox]:checked');
        const errorMessage = groupWrapper.parentElement.querySelector('.input-error-message');

        if (checkedElms.length < minSelection) {
          isValid = false;
          if (errorMessage) errorMessage.classList.remove('visually-hidden');
          const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
          const headerOffset = parseInt(headerHeight.replace('px', '')) || 0;
          const topOffset = errorMessage.closest('.custom-options').getBoundingClientRect().top + window.pageYOffset - headerOffset;
          window.scrollTo({ top: topOffset, behavior: 'smooth' });

        } else {
          isValid = true;
          if (errorMessage) errorMessage.classList.add('visually-hidden');
        }
      } else {
        isValid = inputElement.checked;
      }

      break;
    case 'file':
      isValid = inputElement.value !== '';
      const dropZone = inputElement.closest('.drop-zone-wrap');
      const errorMessage = dropZone.querySelector('.input-error-message');

      if (dropZone && !isValid) {
        dropZone.classList.add('drop-zone-wrap--error');
        if (errorMessage) {
          errorMessage.textContent = window.variantStrings.fileRequiredError;
          errorMessage.classList.remove('visually-hidden');
          const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
          const headerOffset = parseInt(headerHeight.replace('px', '')) || 0;
          const topOffset = errorMessage.closest('.custom-options').getBoundingClientRect().top + window.pageYOffset - headerOffset;
          window.scrollTo({ top: topOffset, behavior: 'smooth' });
        }
      }

      break;
    default:
      isValid = inputElement.value !== '';

      if ( inputElement.name === 'address[country]' || inputElement.name === 'country') {
        isValid = inputElement.value !== '---';
      }
  }

  if (!isValid) {
    const fieldWrapper = inputElement.parentElement;
    const hasErrorMessage = fieldWrapper.querySelector('.input-error-message');

    if (hasErrorMessage) {
      hasErrorMessage.classList.remove('visually-hidden');
      const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
      const headerOffset = parseInt(headerHeight.replace('px', '')) || 0;
      const topOffset = hasErrorMessage.closest('.custom-options').getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }

    inputElement.classList.add('invalid');
    inputElement.setAttribute('aria_invalid', 'true');
    inputElement.setAttribute('aria_describedby', `${inputElement.id}-error`);
  }

  return isValid;
}

function removeErrorStyle (inputElem) {
  const fieldWrapper = inputElem.parentElement;
  const hasErrorMessage = fieldWrapper.querySelector('.input-error-message');


  if (hasErrorMessage) {
    hasErrorMessage.classList.add('visually-hidden');
  }

  inputElem.classList.remove('invalid');
  inputElem.removeAttribute('aria_invalid');
  inputElem.removeAttribute('aria_describedby');
}

class ModalDialog extends HTMLElement {
  static get observedAttributes() { return ['open']; }

  constructor() {
    super();

    this.tpl = document.getElementById(this.dataset.templateId);
    this.targetSel = this.dataset.target;

    this.overlay = document.body.querySelector('body > .overlay');
    this.originalParent = this.parentElement;

    this._renderedFromTemplate = false;

    this.addEventListener('click',  this.#delegateClicks.bind(this));
    this.overlay.addEventListener('click', () => this.hide());
    this.addEventListener('keyup',  e => e.code === 'Escape' && this.hide());

    if (this.classList.contains('media-modal')) {
      this.addEventListener('pointerup', e => {
        if (e.pointerType === 'mouse' && !e.target.closest('deferred-media, product-model'))
          this.hide(e);
      });
    }

    document.addEventListener('shopify:section:load', () => this.hide());
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name !== 'open') return;

    if (newVal !== null) {
      if (this.tpl && !this.querySelector('[data-rendered="true"]')) {
        const clone = this.tpl.content.cloneNode(true);
        const first = clone?.firstElementChild;
        if (first) first.setAttribute('data-rendered', 'true');

        const target = this.targetSel ? this.querySelector(this.targetSel) : this;
        if (target) {
          target.appendChild(clone);
          this._renderedFromTemplate = true;
        }
      }

      return;
    }

    if (!this._renderedFromTemplate) return;

    setTimeout(() => {
      this.querySelectorAll('[data-rendered="true"]').forEach(node => node.remove());
      this._renderedFromTemplate = false;
    }, 300);
  }

  show(opener) {
    this.openedBy = opener;
    this.overlay?.classList.add('open');

    if (this.parentElement !== document.body) document.body.appendChild(this);

    document.body.classList.add('hidden', 'overlay-opened');
    this.setAttribute('open', '');

    this.querySelector('.modal')?.classList.add('open');
    const closeBtn = this.querySelector('.button-close');
    if (closeBtn) setTimeout(() => trapFocus(closeBtn), 1);
    document.dispatchEvent(new CustomEvent('modal:open'));
  }

  hide() {
    document.body.classList.remove('hidden', 'overlay-opened');
    this.overlay?.classList.remove('open');
    this.removeAttribute('open');
    this.querySelector('.modal')?.classList.remove('open');
    removeTrapFocus(this.openedBy);

    if (this.originalParent && this.parentElement === document.body) {
      this.originalParent.appendChild(this);
    }
    this._resumeViewportVideos();
  }

  _resumeViewportVideos() {
    requestAnimationFrame(() => {
      if (document.querySelector('modal-dialog[open]')) return;

      const videos = Array.from(document.querySelectorAll('video'));

      for (const video of videos) {
        if (video.closest('modal-dialog')) continue;
        if (video.closest('.none-autoplay')) continue;

        if (!video.paused && !video.ended) continue;

        const rect = video.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const vw = window.innerWidth || document.documentElement.clientWidth;

        const inView =
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < vh &&
          rect.left < vw;

        if (!inView) continue;

        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    });
  }

  #delegateClicks(e) {
    const closeBtn = e.target.closest('[id^="ModalClose-"]');
    if (closeBtn) {
      const slider = closeBtn.closest('.product-media-modal')?.querySelector('[id^="Slider-"]');
      if (slider) slider.style.scrollBehavior = 'auto';
      this.hide();
      document.dispatchEvent(new CustomEvent('product-modal:close'));
      return;
    }
    if (!this.classList.contains('media-modal') && e.target === this) this.hide();
  }
}
customElements.define('modal-dialog', ModalDialog);

class ModalWindow extends HTMLElement {
    constructor() {
      super();
      this.overlay = this.querySelector('#FacetFiltersFormMobile .overlay') || document.body.querySelector('body > .overlay')
      this.init()
      if (this.closest('.filters-container')) {
        window.addEventListener('resize', () => {
          this.elements.modal.classList.add('disabled-transition')
          setTimeout(() => this.elements.modal.classList.remove('disabled-transition'), 500)
          if(!this.closest('.drawer-filter')) this.hide()
        })
      }
      document.addEventListener('shopify:section:load', (event) => {
        if (event.target.closest('section') && event.target.closest('section').querySelector('modal-window') && this.closest('body.hidden') && !this.closest('body.quick-view-open')) {
          this.init()
          this.hide(event)
        }
      })

      document.addEventListener('keyup', (event) => {
        if(event.code && event.code.toUpperCase() === 'ESCAPE' && this.elements.modal.className.includes('open')) this.hide()
      });
    }

    init() {
      this.elements = {
        // overlay: this.querySelector('.overlay'),
        modal: this.querySelector('.modal')
      }
      this.classes = {
          hidden: 'hidden',
          open: 'open'
      }

      this.querySelectorAll('[data-modal-toggle]').forEach((button) => {
          button.addEventListener('click', this.show.bind(this));
          if (button.closest('.button-close') || button.closest('.overlay')) button.addEventListener('click', this.hide.bind(this));
      })

      this.overlay?.addEventListener('click', this.hide.bind(this));
      // if (button.closest('.button-close') || button.closest('.overlay')) button.addEventListener('click', this.hide.bind(this))
    }
    
    show(event) {
        if (event) this.setActiveElement(event.target)
        if(!this.elements.modal.closest('localization-form') && !this.elements.modal.closest('.section-menu-dawer')) document.body.classList.add(this.classes.hidden)
        if(this.elements.modal.closest('localization-form')) document.body.classList.add('drawer-is-open')
        this.elements.modal.classList.add(this.classes.open)
        if(this.closest('.drawer-filter')) document.body.classList.add('filter-drawer-opened')
        this.overlay?.classList.add(this.classes.open)
        if(this.overlay) document.body.classList.add('overlay-opened')
        this.elements.modal.setAttribute('tabindex', '-1');
        this.elements.modal.focus();
        setTimeout(() => trapFocus(this.elements.modal, this.elements.modal.querySelector('.button-close')),1)
        if(this.elements.modal.closest('localization-form') && this.querySelector('.localization-search__input')) {
          setTimeout(() => this.querySelector('.localization-search__input').focus(), 300)
        }
        document.dispatchEvent(new CustomEvent('modal:after-show'))
    }
  
    hide(event) {
        if(event && event.target && event.target.closest('a')) event.preventDefault()
        if(!this.elements.modal.closest('localization-form') && !this.elements.modal.closest('.section-menu-dawer')) document.body.classList.remove(this.classes.hidden)
        if(this.elements.modal.closest('localization-form')) document.body.classList.remove('drawer-is-open')
        this.elements.modal.classList.remove(this.classes.open)
        this.overlay?.classList.remove(this.classes.open)
        if(this.closest('.drawer-filter')) document.body.classList.remove('filter-drawer-opened')
        if(this.overlay) document.body.classList.remove('overlay-opened')
        this.elements.modal.removeAttribute('tabindex');
        removeTrapFocus(this.activeElement);
        document.dispatchEvent(new CustomEvent('modal:after-hide'))
    }

    setActiveElement(element) {
      this.activeElement = element;
    }
}
customElements.define('modal-window', ModalWindow);

class Drawer extends HTMLElement {
  constructor(selector, toggleSelector, openerSelector) {
    super();

    this.selector = selector;
    this.toggleSelector = toggleSelector;
    this.openerSelector = openerSelector;

    this.elements = null;
    this.classes = { hidden: 'hidden', open: 'open' };
    this.activeElement = null;

    // bind-once guards
    this._bound = false;

    // pinned height pipeline (NO forced layout in alignMenu)
    this._pinnedRO = null;

    this._pendingPinnedPx = null;     // number (px) from RO
    this._lastAppliedPinnedPx = null; // number (px)
    this._rafApplyPinned = 0;

    // Optional: do ONE forced measure on first open if RO hasn't fired yet.
    // This moves any forced layout out of page load and into user action.
    this._didFirstOpenMeasure = false;
    this._rafFirstOpenMeasure = 0;

    // binds (stable references)
    this._onResize = this._onResize.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onOverlayClick = this._onOverlayClick.bind(this);

    this._onSectionLoad = this._onSectionLoad.bind(this);
    this._onBlockSelect = this._onBlockSelect.bind(this);
    this._onSectionSelect = this._onSectionSelect.bind(this);
    this._onSectionDeselect = this._onSectionDeselect.bind(this);

    if (!document.querySelector(this.selector)) return;

    // Shopify/theme editor listeners
    document.addEventListener('shopify:section:load', this._onSectionLoad);
    document.addEventListener('shopify:block:select', this._onBlockSelect);
    document.addEventListener('shopify:section:select', this._onSectionSelect);
    document.addEventListener('shopify:section:deselect', this._onSectionDeselect);

    // global listeners
    window.addEventListener('resize', this._onResize, { passive: true });
    document.addEventListener('keyup', this._onKeyUp);

    const overlay = document.querySelector('body > .overlay');
    if (overlay) overlay.addEventListener('click', this._onOverlayClick);

    // init once
    this.init();
    this._setupPinnedResizeObserver();
  }

  _onSectionLoad(event) {
    if (!event?.target?.closest) return;

    if (Shopify.designMode && event.target.closest(this.selector)) {
      document.body.classList.add('disable-scroll-body');
    }

    if (
      event.target.closest(this.selector) &&
      document.querySelector(`${this.selector} .modal:not(.open)`)
    ) {
      this.init();
      this._setupPinnedResizeObserver();
      this.alignMenu();
      this.show();
    }
  }

  _onBlockSelect() {
    this.init();
    this._setupPinnedResizeObserver();
    this.alignMenu();
  }

  _onSectionSelect(event) {
    if (!event?.target?.closest) return;

    if (Shopify.designMode && event.target.closest(this.selector)) {
      document.body.classList.add('disable-scroll-body');
    }

    if (event.target.closest(this.selector)) {
      this.init();
      this._setupPinnedResizeObserver();
      this.show();
    }
  }

  _onSectionDeselect(event) {
    if (!event?.target?.closest) return;

    if (event.target.closest(this.selector)) {
      this.init();
      this.hide();
    }
  }

  init() {
    const modal = document.querySelector(`${this.selector} .modal`);
    const overlay = document.querySelector('body > .overlay');
    const toggles = document.querySelectorAll(`${this.selector} ${this.toggleSelector}`);

    this.elements = {
      overlay,
      modal,
      toggles,
      pinned: document.querySelector(`${this.selector} .pinned-block`),
      nested: document.querySelector(`${this.selector} .nested-submenu`)
    };

    if (this._bound) return;
    this._bound = true;

    const allToggleButtons = document.querySelectorAll(this.toggleSelector);

    allToggleButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.setActiveElement(button);
        this.show();
      });

      if (button.closest('.button-close') || button.closest('.overlay')) {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          this.hide();
        });
      }

      button.addEventListener('keydown', (event) => {
        if ((event.code || '').toUpperCase() === 'ENTER') {
          this.setActiveElement(button);
          this.show();
        }
      });
    });

    if (this.querySelector(this.openerSelector)) {
      this.elements.toggles.forEach((button) => {
        button.addEventListener('click', () => {
          if (this.elements?.modal?.classList.contains(this.classes.open)) {
            this.hide();
          }
        });
      });
    }
  }

  setActiveElement(element) {
    this.activeElement = element;
  }

  _setupPinnedResizeObserver() {
    if (this._pinnedRO) {
      try { this._pinnedRO.disconnect(); } catch(e) {}
      this._pinnedRO = null;
    }

    if (!this.elements) this.init();

    const modal = this.elements?.modal;
    const pinned = this.elements?.pinned;
    const nested = this.elements?.nested;

    if (!modal || !pinned || !nested) return;
    if (!('ResizeObserver' in window)) return;

    this._pinnedRO = new ResizeObserver((entries) => {
      const e = entries && entries[0];
      if (!e) return;

      let h = 0;
      const bbs = e.borderBoxSize;
      if (bbs && bbs.length) {
        h = bbs[0].blockSize;
      } else {
        h = e.contentRect?.height || 0;
      }

      const nextPx = Math.round(h) + 16;
      this._pendingPinnedPx = nextPx;
      this.alignMenu();
    });

    this._pinnedRO.observe(pinned);
  }

  alignMenu() {
    if (this._rafApplyPinned) return;

    this._rafApplyPinned = requestAnimationFrame(() => {
      this._rafApplyPinned = 0;

      if (!this.elements) this.init();
      const modal = this.elements?.modal;
      if (!modal) return;

      const next = this._pendingPinnedPx;
      if (typeof next !== 'number') return;

      if (this._lastAppliedPinnedPx === next) return;
      this._lastAppliedPinnedPx = next;

      modal.style.setProperty('--height-pinned-block', `${next}px`);
    });
  }

  _onResize() {
    this.alignMenu();
  }

  _measurePinnedOnFirstOpenIfNeeded() {
    if (this._didFirstOpenMeasure) return;
    if (typeof this._pendingPinnedPx === 'number') return;

    if (!this.elements) this.init();
    const modal = this.elements?.modal;
    const pinned = this.elements?.pinned;
    const nested = this.elements?.nested;

    if (!modal || !pinned || !nested) return;

    if (this._rafFirstOpenMeasure) return;
    this._rafFirstOpenMeasure = requestAnimationFrame(() => {
      this._rafFirstOpenMeasure = 0;
      if (!this.elements?.pinned) return;

      const nextPx = this.elements.pinned.offsetHeight + 16;
      this._pendingPinnedPx = nextPx;
      this._didFirstOpenMeasure = true;
      this.alignMenu();
    });
  }

  show() {
    if (!this.elements) this.init();
    const { modal, overlay } = this.elements;
    if (!modal || !overlay) return;

    document.body.classList.add(this.classes.hidden);
    modal.classList.add(this.classes.open);
    overlay.classList.add(this.classes.open);
    document.body.classList.add('overlay-opened')

    this.alignMenu();

    this._measurePinnedOnFirstOpenIfNeeded();

    modal.setAttribute('tabindex', '0');

    setTimeout(() => {
      if (!this.elements?.modal) return;

      const firstFocusable = this.elements.modal.querySelector(
        'button, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) firstFocusable.focus();

      trapFocus(this.elements.modal);
    }, 300);
    document.dispatchEvent(new CustomEvent('modal:after-show', {
      detail: { targetTag: this.tagName.toLowerCase() }
    }));
  }

  hide() {
    if (!this.elements) this.init();
    const { modal, overlay } = this.elements;
    if (!modal || !overlay) return;

    if (Shopify.designMode) {
      document.body.classList.remove('disable-scroll-body');
    }

    document.body.classList.remove(this.classes.hidden);
    modal.classList.remove(this.classes.open);
    overlay.classList.remove(this.classes.open);
    document.body.classList.remove('overlay-opened')

    modal.querySelectorAll('[open="true"]').forEach(el => el.setAttribute('open', 'false'));
    modal.setAttribute('tabindex', '-1');

    if (this.activeElement) this.activeElement.focus();
    removeTrapFocus();
    document.dispatchEvent(new CustomEvent('modal:after-hide', {
      detail: { targetTag: this.tagName.toLowerCase() }
    }));
  }

  _onKeyUp(event) {
    const code = (event.code || '').toUpperCase();
    if (code !== 'ESCAPE') return;

    if (this.elements?.modal?.className?.includes(this.classes.open)) {
      this.hide();
    }
  }

  _onOverlayClick() {
    this.hide();
  }
}

class MenuDrawer extends Drawer {
  constructor() {
    super('[id$="__menu-drawer"]', '[data-modal-toggle-menu-dawer]', '.burger-js');
  }

  connectedCallback() {
    this.setEventListeners();
  }

  setEventListeners() {
    document.addEventListener('modal:after-show', (e) => {
      if (e.detail?.targetTag === 'store-selector-drawer' && this.elements.modal.classList.contains('open')) {
        this.hide();
      }
    });
  }
}
customElements.define('menu-drawer', MenuDrawer);

class StoreSelectorDrawer extends Drawer {
  constructor() {
    super('.section-store-selector-drawer', '[data-modal-toggle-store-selector-drawer]', '.store-selector');
  }

  connectedCallback() {
    this.init();
  }

  init() {
    super.init();
    
    this.changeStoreButton = document.querySelector('.store-selector-drawer .change-store-button');
    
    if (!this.changeStoreButton) {
      return;
    }
    
    this.storeCheckboxes = document.querySelectorAll('.store-selector-drawer .store-accordion__checkbox');
    this.currentStore = Array.from(this.storeCheckboxes).find(cb => cb.checked)?.value;

    if (!this.currentStore) {
      this.resetSavedStore();
    }

    this.toggleChangeButtonState();
    this.setEventListeners();
  }

  async resetSavedStore() {
    try {
      await this.updateCartAttribute("store", '');

      const storeSelectorText = this.querySelector('.store-selector__text');
      if (storeSelectorText) {
        storeSelectorText.innerHTML = storeSelectorText.dataset.placeholder;
      }

      const pickUpAvailabilities= document.querySelectorAll('.pickup-availability');
      pickUpAvailabilities.forEach(pickUpAvailability => {
        pickUpAvailability.classList.remove('pickup-availability--available');
        pickUpAvailability.classList.add('pickup-availability--unavailable');

        const text = pickUpAvailability.querySelector('.pickup-availability__text');
        text.innerHTML = text.dataset.placeholder;
      })     
    } catch (error) {
      console.error("Error updating store cart attribute:", error);
    }
  }

  toggleChangeButtonState() {
    const hasChecked = Array.from(this.storeCheckboxes).some(checkbox => checkbox.checked);
    this.changeStoreButton.disabled = !hasChecked;
  }

  setEventListeners() {
    this.storeCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handleCheckboxChange(checkbox));
    });

    this.changeStoreButton.addEventListener('click', () => this.handleChangeStore());

    document.addEventListener('modal:after-hide', (e) => {
      if (e.detail?.targetTag === 'store-selector-drawer') {
        this.restoreCheckedState();
      }
    });

    document.addEventListener('shopify:section:unload', (event) => {
      if (event.target.closest('.section-store-selector-drawer')) {
        this.resetSavedStore();
      }
    })
  }

  handleCheckboxChange(changedCheckbox) {
    if (changedCheckbox.checked) {
      this.storeCheckboxes.forEach((checkbox) => {
        if (checkbox !== changedCheckbox) {
          checkbox.checked = false;
          checkbox.removeAttribute('checked');
        }
      });

      changedCheckbox.setAttribute('checked', 'checked');
      this.changeStoreButton.disabled = false;
    } else {
      changedCheckbox.checked = true;
      changedCheckbox.setAttribute('checked', 'checked');
    }
  }

  async handleChangeStore() {
    const selectedCheckbox = Array.from(this.storeCheckboxes).find(cb => cb.checked);
    if (!selectedCheckbox) return;

    const storeName = selectedCheckbox.value;

    if (storeName === this.currentStore) {
      this.hide();
      return;
    }

    let loader;
    try {
      loader = this.changeStoreButton.querySelector('.change-store-button__loader');
      if (loader) loader.classList.remove('hidden');

      await this.updateCartAttribute("store", storeName);   
      window.location.reload();
    } catch (error) {
      if (loader) loader.classList.add('hidden');
      console.error("Error updating store cart attribute:", error);
    } 
  }

  restoreCheckedState() {
    this.storeCheckboxes.forEach((checkbox) => {
      const isMatch = checkbox.value === this.currentStore;
      checkbox.checked = isMatch;
      checkbox.toggleAttribute('checked', isMatch);
    });

    this.toggleChangeButtonState();
  }

  async updateCartAttribute(attribute, value) {
    return fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributes: { [attribute]: value } }),
    });
  }
}

customElements.define('store-selector-drawer', StoreSelectorDrawer);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    this.button = this.querySelector('.button--modal-opener');
    this.posX1 
    this.posInit 
    this.posX2
    this.posY1
    this.posY2 
    this.posInitY
    if (this.classList.contains('zoom-disabled')) return
    if (!this.button) return;
    this.button.addEventListener('mousedown', this.mouseDown.bind(this))
    this.button.addEventListener('mousemove', this.mouseMove.bind(this))
    this.button.addEventListener('mouseup', this.mouseUp.bind(this))
    document.addEventListener('shopify:section:load', () => {
      this.button = this.querySelector('.button--modal-opener');
    })
    this.button.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'ENTER') this.mouseUp()
    })
  }

  getEvent (event) {
    return event.type.search('touch') !== -1 ? event.touches[0] : event;
  }

  mouseDown(event) {
    let evt = this.getEvent(event);
    this.posInit = this.posX1 = evt.clientX;
    this.posInitY = this.posY1 = evt.clientY
  }

  mouseMove() {
    let evt = this.getEvent(event)
    this.posX2 = this.posX1 - evt.clientX;
    this.posX1 = evt.clientX;
    this.posY2 = this.posY1 - evt.clientY;
    this.posY1 = evt.clientY;
  }

  mouseUp(event) {
    if ((Math.abs(this.posInit - this.posX1) - Math.abs(this.posInitY - this.posY1) > 5)) return;
    const modal = document.querySelector(this.getAttribute('data-modal'));

    if (!modal) return;
    if (event.target.closest('.icons_with_text__description') && event.target.closest('a')) return;

    modal.show(this.button);
  }
}
customElements.define('modal-opener', ModalOpener);

class Breadcrumbs extends HTMLElement {
  constructor() {
    super();

    this.template = this.dataset.currentTemplate
    if (this.template != 'product' && this.template != 'collection') return
    this.cookieName = 'volume-theme:active-category'
    this.cookieUrl = 'volume-theme:active-category-url'
    this.storageItem = this.querySelector('.breadcrumbs__item--storage')
    this.metafieldItem = this.querySelector('.breadcrumbs__item--metafield')
    this.menuItems = document.querySelectorAll('.menu__list a')
    this.collectionItem = this.querySelector('.breadcrumbs__item--collection')
    if (this.metafieldItem && this.metafieldItem.dataset.tags) this.tagItems = this.metafieldItem.dataset.tags.split(',')

    this.setMetafieldLink()
    setTimeout(() => this.setStorageCategory(), 0)

    document.addEventListener('shopify:section-load', () => {
      this.setMetafieldLink()
    })
  }

  setMetafieldLink() {
    this.menuItems.forEach(menuItem => {
      let dataTitle = menuItem.dataset.title
      if (dataTitle) dataTitle.toLowerCase()
      if (this.metafieldItem && this.metafieldItem.querySelector('a').innerHTML == dataTitle) this.metafieldItem.querySelector('a').setAttribute('href', `${menuItem.href}`)
      if (this.tagItems && this.tagItems.length > 0) {
        this.tagItems.forEach(tagItem => {
          if (dataTitle && tagItem == dataTitle.toLowerCase()) {
            this.metafieldItem.querySelector('a').setAttribute('href', `${menuItem.href}`)
            this.metafieldItem.querySelector('a').innerHTML = dataTitle
            setTimeout( () => {
              if (this.collectionItem && this.collectionItem.querySelector('a').innerHTML == this.metafieldItem.querySelector('a').innerHTML) this.collectionItem.style.display = 'none'
            }, 10)
          }
        })
      }
    })
  }

  setStorageCategory() {
    if (isStorageSupported('local')) {
      const activeCategory = window.localStorage.getItem(this.cookieName);
      const activeCategoryUrl = window.localStorage.getItem(this.cookieUrl);

      if (this.storageItem && activeCategory && activeCategoryUrl) {
        const nextToStorageItemElement = this.storageItem.nextElementSibling.querySelector('a');
        const nextToStorageItemElementTitle = nextToStorageItemElement.textContent.trim();
        const nextToStorageItemElementUrl = nextToStorageItemElement.getAttribute('href');
        const isSimilarBreadcrumb = nextToStorageItemElementTitle.toLowerCase() === activeCategory.toLowerCase().trim() && activeCategoryUrl.endsWith(nextToStorageItemElementUrl);

        if (isSimilarBreadcrumb) {
          return;
        } 

        this.storageItem.querySelector('a').setAttribute('href', `${activeCategoryUrl}`);
        this.storageItem.querySelector('a').innerHTML = `${activeCategory}`;

        if (this.collectionItem && this.collectionItem.querySelector('a').innerHTML == activeCategory) this.collectionItem.style.display = 'none';
      }
    }
  }
}

customElements.define('breadcrumbs-component', Breadcrumbs);

class AccordionToggle extends HTMLElement {
  constructor() {
    super();
    
    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 0
    });
  }

  init() {
    this.toggle = this.querySelector('.accordion-toggle')
    this.panel = this.querySelector('.accordion__panel')
    this.toggles = document.querySelectorAll('.accordion-toggle')
    this.links = this.panel.querySelectorAll('a')
    this.textareas = this.panel.querySelectorAll('textarea')
    this.inputs = this.panel.querySelectorAll('input')
    this.selects = this.panel.querySelectorAll('select')
    this.buttons = this.panel.querySelectorAll('button')
    this.arrayOpenCollapsible = []

    if (!this.toggle.classList.contains('is-open')) this.blurElements()

    this.toggle.querySelector('.accordion__summary > input[type="checkbox"]') ? this.toggle = this.querySelector('.accordion__summary > input[type="checkbox"]') : this.toggle = this.querySelector('.accordion-toggle')
    this.toggle.addEventListener('click', this.toggleAccordion.bind(this, event))

    if(this.closest('.filter-form--horizontal')) {
      if(window.innerWidth > 768 && this.toggle.className.includes('open_collapsible')) {
        this.arrayOpenCollapsible.push(this.toggle)
        this.toggle.classList.remove('open_collapsible', 'is-open')
      }
      document.addEventListener('click', (event) => {
        if(window.innerWidth > 768) {
          this.toggles.forEach(toggle => {
            if(toggle.classList.contains('is-open') && (event.target.closest('.accordion-toggle') != toggle || event.target.closest('.facets__save') || event.target.closest('.facets__reset'))) {
              if(event.target.closest('.facets__reset') && event.target.closest('.accordion__panel').querySelectorAll('[checked]').size == 0) event.preventDefault()
              toggle.classList.remove('is-open')
              toggle.querySelector('.accordion__panel').style.maxHeight = 0
              this.blurElements()
            }
          })
        }
      })
    }

    if(this.toggle.classList.contains('js-filter')) {
      if((!this.closest('.filter-form--horizontal') || window.innerWidth < 769) && this.toggle.className.includes('open_collapsible')) {
        this.panel.style.maxHeight = this.panel.scrollHeight + "px"
        this.focusElements()
      }
      document.addEventListener('filters:rerendered', ()=> {
        if(this.closest('.filter-form--horizontal') && window.innerWidth > 768) return
        let filters = this.querySelectorAll('.accordion-toggle')
        filters.forEach((filter) => {
          this.panel = filter.querySelector('.accordion__panel')
          this.panel.style.transitionDuration = '0s'
          !filter.classList.contains('is-open') ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panel.scrollHeight + "px"
          filter.classList.contains('is-open') ? this.focusElements(filter) : this.blurElements(filter)
          setTimeout(() => {this.panel.style.transitionDuration = '0.3s'})
        })
      })
    } else {
      if(this.toggle.className.includes('open_collapsible')) {
        this.panel.style.maxHeight = this.panel.scrollHeight + "px"
      }
    }

    this.toggle.addEventListener('keydown', (event) => {
      if (event.code?.toUpperCase() === 'ENTER') {
        this.panel = this.querySelector('.accordion__panel')
        if(this.closest('.filter-form--horizontal') && window.innerWidth > 768) {
          let facets = this.closest('.filter-form--horizontal')
          facets.querySelectorAll('.accordion-toggle').forEach(item => {
            if(item.classList.contains('is-open') && event.target.closest('.accordion-toggle') != item) item.classList.remove('is-open')
          })
        }
        if (event.target.closest('.accordion__panel')) return
        
        this.toggle.classList.toggle('is-open')
        if(this.closest('.filter-form--horizontal') && window.innerWidth > 768) return
        this.panelHeight = this.panel.scrollHeight + "px"
        this.panel.style.setProperty('--max-height', `${this.panelHeight}`)
        !this.toggle.classList.contains('is-open') ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panelHeight
      }
      if (event.code?.toUpperCase() === 'ESCAPE') {
        this.toggle.classList.remove('is-open')
        this.panel.style.maxHeight = null
      }
      this.toggle.classList.contains('is-open') ? this.focusElements() : this.blurElements()
    })

    this.querySelectorAll('.store-accordion__toggle-area').forEach(toggle => {
      toggle.addEventListener('click', (event) => {
        const checkbox = toggle.querySelector('.store-accordion__checkbox');

        if (event.target === checkbox) return;

        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    window.addEventListener('resize', this.actionHorizontalFilters.bind(this))
  }

  actionHorizontalFilters() {
    if(this.closest('.filter-form--horizontal') && window.innerWidth > 768) {
      if(this.toggle.className.includes('open_collapsible')) this.toggle.classList.remove('open_collapsible')
      this.toggles.forEach(toggle => {
        if(toggle.classList.contains('is-open')) {
          toggle.classList.remove('is-open')
          toggle.querySelector('.accordion__panel').style.maxHeight = 0
          this.blurElements()
        }
      })
    }
    if(this.closest('.filter-form--horizontal') && window.innerWidth < 769 && this.arrayOpenCollapsible.length > 0) {
      this.arrayOpenCollapsible.forEach(item => {
        item.classList.add('open_collapsible', 'is-open')
        item.querySelector('.accordion__panel').style.maxHeight = this.panel.scrollHeight + "px"
      })
    }
  }

  toggleAccordion() {
    if (this.closest('.store-accordion') && !event.target.closest('.icon-accordion')) {
      return;
    }

    if (event.target.closest('.accordion__panel')) return

    !this.toggle.classList.contains('is-open') ? this.toggle.classList.add('is-open') : this.toggle.classList.remove('is-open')
    if(this.closest('.filter-form--horizontal') && window.innerWidth > 768) return
    this.panel = this.querySelector('.accordion__panel')
    !this.toggle.classList.contains('is-open') ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panel.scrollHeight + 1 + "px"
    this.toggle.classList.contains('is-open') ? this.focusElements() : this.blurElements()
  }

  blurElements(rerender = false) {
    if (rerender) {
      this.links = rerender.querySelectorAll('a')
      this.textareas = rerender.querySelectorAll('textarea')
      this.inputs = rerender.querySelectorAll('input')
      this.selects = rerender.querySelectorAll('select')
      this.buttons = rerender.querySelectorAll('button')
    }
    this.links.forEach(link => link.setAttribute('tabindex', '-1'))
    this.textareas.forEach(textarea => textarea.setAttribute('tabindex', '-1'))
    this.inputs.forEach(input => input.setAttribute('tabindex', '-1'))
    this.selects.forEach(select => select.setAttribute('tabindex', '-1'))
    this.buttons.forEach(button => button.setAttribute('tabindex', '-1'))
  }
  focusElements() {
    this.links.forEach(link => link.setAttribute('tabindex', '0'))
    this.textareas.forEach(textarea => textarea.setAttribute('tabindex', '0'))
    this.inputs.forEach(input => input.setAttribute('tabindex', '0'))
    this.selects.forEach(select => select.setAttribute('tabindex', '0'))
    this.buttons.forEach(button => button.setAttribute('tabindex', '0'))
  }
}
customElements.define('accordion-toggle', AccordionToggle);

class FormState extends HTMLElement {
  constructor() {
    super();

    this.formInputs = this.querySelectorAll('input.required, select[required]');
    this.form = this.querySelector('form');
    if (this.form) this.buttonSubmit = this.form.querySelector('button[type="submit"]') || this.form.querySelector('.button--submit');

    this.formInputs.forEach((input) => {
      input.addEventListener('input', this.onInputChange.bind(this));
    });
    if (this.buttonSubmit) this.buttonSubmit.addEventListener('click', this.onSubmitHandler.bind(this));
  }

  onInputChange(event) {
    if(event.target.closest('.invalid')) event.target.classList.remove('invalid');
    event.target.classList.add('valid');
  }

  onSubmitHandler() {
    let formIsValid = true;
    if (!this.form.checkValidity()) {
      this.form.reportValidity();
    }

    this.formInputs.forEach((input) => {
      if (input.hasAttribute('type')) {
        const inputType = input.getAttribute('type');

        if (inputType === 'password' || inputType === 'text') {
          input.value.trim().length === 0 ? this.invalidInput(input) : this.validInput(input)
        }

        if (inputType === 'email') {
          if (!this.isValidEmail(input.value)) {
            this.invalidInput(input);
            formIsValid = false;
            if (this.querySelector('.email-no-valid')) this.querySelector('.email-no-valid').classList.remove('visually-hidden');
          } else {
            this.validInput(input);
            formIsValid = true
            if (this.querySelector('.email-no-valid')) this.querySelector('.email-no-valid').classList.add('visually-hidden');
          }
        }
      } else {
        input.value === input.dataset.empty ? this.invalidInput(input) : this.validInput(input)
      }
    });

    if (!formIsValid) {
      event.preventDefault();
    }
  }

  isValidEmail(email) {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email.trim());
  }

  invalidInput(input) {
    if(input.closest('.valid')) input.classList.remove('valid');
    input.classList.add('invalid');
  }
  validInput(input) {
    if(input.closest('.invalid')) input.classList.remove('invalid');
    input.classList.add('valid');
  }
}
customElements.define('form-state', FormState);  

class ColorSwatch extends HTMLElement {
  constructor() {
    super();

    // lightweight state only
    this.cached = Object.create(null);
    this._pendingFetch = Object.create(null);

    this._mounted = false;
    this._active = false;

    // observer
    this._io = null;
    this._intentArmed = false;

    // data
    this.variantId = this.dataset.variantId || null;

    // refs (resolved lazily)
    this.colorsContainer = null;
    this.tooltip = null;
    this.productCard = null;
    this.cardProduct = null;
    this.quickViewButton = null;
    this.quickViewButtonEl = null;
    this.image = null;
    this.secondImage = null;
    this.productHref = null;

    // original sources
    this.imageSrc = null;
    this.imageSrcset = null;
    this.secondImageSrc = null;
    this.secondImageSrcset = null;

    // handlers
    this._onClick = null;
    this._onKeyup = null;
    this._onMouseEnter = null;

    // tooltip align cache
    this._alignRaf = 0;
    this._lastTooltipShift = null;
    this._viewportEl = null;

    // intent (wake early if user interacts before IO fires)
    this._onIntentPointerDown = this._onIntentPointerDown.bind(this);
    this._onIntentKeyDown = this._onIntentKeyDown.bind(this);
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    this._armIntent();
    this._setupIntersectionObserver();
  }

  disconnectedCallback() {
    this._mounted = false;

    if (this._alignRaf) cancelAnimationFrame(this._alignRaf);
    this._alignRaf = 0;

    this._disarmIntent();
    this._teardownObserver();
    this._teardownActive();
  }

  _setupIntersectionObserver() {
    if (this._io) return;

    this._io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          this._activate();
          break;
        }
      }
    }, { root: null, threshold: 0.01, rootMargin: '200px 0px' });

    this._io.observe(this);
  }

  _teardownObserver() {
    if (!this._io) return;
    this._io.disconnect();
    this._io = null;
  }

  _activate() {
    if (this._active) return;
    this._active = true;

    // no longer need IO or intent
    this._teardownObserver();
    this._disarmIntent();

    // resolve refs only now
    this._resolveRefs();

    // bind handlers once
    this._onClick = (event) => {
      event.preventDefault();
      if (!this.productCard) return;

      if (this._hasSwiperWrapper()) {
        this.updateSlider();
      } else {
        this.onClickHandler();
      }

      if (event.target.closest('a')) return false;
    };

    this._onKeyup = (event) => {
      if (event.code && event.code.toUpperCase() === 'ENTER') {
        event.preventDefault();
        if (!this.productCard) return;

        if (this._hasSwiperWrapper()) {
          this.updateSlider();
        } else {
          this.onClickHandler();
        }

        if (event.target.closest('a')) return false;
      }
    };

    // mouseenter align
    const swatchHost = this.closest('.color-swatch') || this;
    this._onMouseEnter = () => this._scheduleAlignSwatches();

    // attach listeners only now
    this.addEventListener('click', this._onClick);
    this.addEventListener('keyup', this._onKeyup);
    swatchHost.addEventListener('mouseenter', this._onMouseEnter, { passive: true });
  }

  _teardownActive() {
    if (!this._active) return;
    this._active = false;

    // remove listeners
    if (this._onClick) this.removeEventListener('click', this._onClick);
    if (this._onKeyup) this.removeEventListener('keyup', this._onKeyup);

    const swatchHost = this.closest('.color-swatch') || this;
    if (this._onMouseEnter) swatchHost.removeEventListener('mouseenter', this._onMouseEnter);

    this._onClick = null;
    this._onKeyup = null;
    this._onMouseEnter = null;

    // refs cleanup (optional)
    this.colorsContainer = null;
    this.tooltip = null;
    this.productCard = null;
    this.cardProduct = null;
    this.quickViewButton = null;
    this.quickViewButtonEl = null;
    this.image = null;
    this.secondImage = null;
    this.productHref = null;

    this._viewportEl = null;
    this._lastTooltipShift = null;
  }

  _armIntent() {
    if (this._intentArmed) return;
    this._intentArmed = true;

    this.addEventListener('pointerdown', this._onIntentPointerDown, { capture: true, passive: true });
    this.addEventListener('keydown', this._onIntentKeyDown, { capture: true, passive: true });
  }

  _disarmIntent() {
    if (!this._intentArmed) return;
    this._intentArmed = false;

    this.removeEventListener('pointerdown', this._onIntentPointerDown, { capture: true });
    this.removeEventListener('keydown', this._onIntentKeyDown, { capture: true });
  }

  _onIntentPointerDown() {
    this._activate();
  }

  _onIntentKeyDown(e) {
    if (!e || !e.code) {
      this._activate();
      return;
    }
    const code = e.code.toUpperCase();
    if (code === 'ENTER' || code === 'SPACE') this._activate();
  }


  _resolveRefs() {
    this.colorsContainer = this.closest('.card__colors') || null;
    this.tooltip = this.querySelector('.color-swatch__title') || null;

    this.productCard = this.closest('.card') || null;
    this.cardProduct = this.closest('.card-product') || null;

    this.quickViewButton = this.cardProduct?.querySelector('.quick-view') || null;
    this.quickViewButtonEl = this.cardProduct?.querySelector('quick-view-button') || null;

    this.image = this.productCard?.querySelector('.card__product-image img') || null;
    this.secondImage = this.productCard?.querySelector('.card__image--second') || null;

    this.productHref = this.productCard?.getAttribute('href') || this.productCard?.href || null;

    if (this.image) {
      this.imageSrc = this.image.getAttribute('src');
      this.imageSrcset = this.image.getAttribute('srcset');
    }
    if (this.secondImage) {
      this.secondImageSrc = this.secondImage.getAttribute('src');
      this.secondImageSrcset = this.secondImage.getAttribute('srcset');
    }
  }

  _hasSwiperWrapper() {
    return !!this.productCard?.querySelector('.swiper-wrapper');
  }

  _isPlaceholderImage() {
    return !!(this.image && this.image.classList.contains('card__image-placeholder'));
  }

  _getSwiperCardEl() {
    return this.productCard?.querySelector('.swiper-product-card') || null;
  }

  _getActiveSwatch() {
    return this.colorsContainer?.querySelector('.active-swatch') || null;
  }

  onClickHandler() {
    if (!this.colorsContainer || !this.productCard) return;

    if (this._hasSwiperWrapper()) {
      this.activeColorSwatch();
      this.updateURL();
      this.updateSlider();
      if (this.closest('.show-selected-value')) this.colorSwatchFetch();
    }

    if (this.closest('.active-swatch')) {
      this.classList.remove('active-swatch');
      if (this.productHref) this.productCard.href = this.productHref;

      if (this.image && !this._isPlaceholderImage()) {
        if (this.imageSrc) this.image.src = this.imageSrc;
        if (this.imageSrcset != null) this.image.srcset = this.imageSrcset;
      }
      if (this.secondImage && this.secondImageSrc) {
        this.secondImage.src = this.secondImageSrc;
        if (this.secondImageSrcset != null) this.secondImage.srcset = this.secondImageSrcset;
      }
      return;
    }

    this.activeColorSwatch();
    this.updateURL();

    if (this.image && !this._isPlaceholderImage()) {
      this.image.src = this.dataset.src || this.image.src;
      if (this.dataset.srcset != null) this.image.srcset = this.dataset.srcset;
    }

    if (this.secondImage && this.dataset.srcSecond) {
      this.secondImage.src = this.dataset.srcSecond;
      if (this.dataset.srcsetSecond != null) this.secondImage.srcset = this.dataset.srcsetSecond;
    }

    if (this.closest('.show-selected-value')) this.colorSwatchFetch();
  }

  updateSlider() {
    if (!this.colorsContainer || !this.productCard) return;

    let currentAlt = `(${this.dataset.colorName || ''})`;

    if (this.closest('.active-swatch')) {
      this.classList.remove('active-swatch');
      if (this.productHref) this.productCard.href = this.productHref;
      currentAlt = 'all';
    } else {
      this.activeColorSwatch();
    }

    this.updateURL();

    if (this._isPlaceholderImage()) {
      if (this.closest('.show-selected-value')) this.colorSwatchFetch();
      return;
    }

    const swiperEl = this._getSwiperCardEl();
    if (swiperEl) {
      swiperEl.dispatchEvent(new CustomEvent('swiper:update', {
        detail: {
          currentAlt,
          index: this.dataset.currentImgIndex
        }
      }));
    }

    if (this.closest('.show-selected-value')) this.colorSwatchFetch();
  }

  colorSwatchFetch() {
    const collectionHandle = this.dataset.collectionHandle || '';
    let productHandle = this.dataset.productHandle || '';
    const productUrlPart = (this.dataset.productUrl || '').split('?')[2];

    if (productUrlPart && productHandle !== productUrlPart) productHandle = productUrlPart;

    let sectionUrl = `${window.routes.root_url}/products/${productHandle}?variant=${this.variantId}&view=card`;
    if (collectionHandle.length > 0) {
      sectionUrl = `${window.routes.root_url}/collections/${collectionHandle}/products/${productHandle}?variant=${this.variantId}&view=card`;
    }
    sectionUrl = sectionUrl.replace('//', '/');

    if (this.cached[sectionUrl]) {
      this.renderProductInfo(this.cached[sectionUrl]);
      return;
    }

    if (this._pendingFetch[sectionUrl]) {
      this._pendingFetch[sectionUrl].then((html) => html && this.renderProductInfo(html));
      return;
    }

    this._pendingFetch[sectionUrl] = fetch(sectionUrl)
      .then(r => r.text())
      .then(text => {
        const html = new DOMParser().parseFromString(text, 'text/html');
        this.cached[sectionUrl] = html;
        return html;
      })
      .catch(e => {
        console.error(e);
        return null;
      })
      .finally(() => {
        delete this._pendingFetch[sectionUrl];
      });

    this._pendingFetch[sectionUrl].then((html) => html && this.renderProductInfo(html));
  }

  renderProductInfo(html) {
    if (!html || !this.productCard) return;
    this.updatePrice(html);
    this.updateSize(html);
    this.updateBadge(html);
    this.updateTitle(html);
  }

  updatePrice(html) {
    const destination = this.productCard.querySelector('.price');
    const source = html.querySelector('main .price');
    if (source && destination) destination.innerHTML = source.innerHTML;
  }

  updateSize(html) {
    const destination = this.productCard.querySelector('.card__sizes');
    const source = html.querySelector('main .card__sizes');
    if (source && destination) destination.innerHTML = source.innerHTML;
  }

  updateBadge(html) {
    const destination = this.productCard.querySelector('.card__badges');
    const source = html.querySelector('main .card__badges');
    if (source && destination) destination.innerHTML = source.innerHTML;
  }

  updateTitle(html) {
    const destination = this.productCard.querySelector('.card__title-js');
    const source = html.querySelector('main .card__title-js');
    if (!source || !destination) return;

    const wrap = destination.closest('.card-product__title');
    const limit = wrap?.dataset?.nameCharacters ? +wrap.dataset.nameCharacters : 0;

    let out = source.innerHTML;
    if (limit > 0) {
      const plainLen = source.innerHTML.trim().length;
      if (plainLen > limit) out = source.innerHTML.trim().slice(0, limit) + '...';
    }
    destination.innerHTML = out;
  }

  activeColorSwatch() {
    if (!this.colorsContainer) return;
    const prev = this.colorsContainer.querySelector('.active-swatch');
    if (prev && prev !== this) prev.classList.remove('active-swatch');
    this.classList.add('active-swatch');
  }

  updateURL() {
    if (!this.colorsContainer || !this.productCard) return;

    const activeSwatch = this._getActiveSwatch();
    if (!activeSwatch) return;

    const link = activeSwatch.querySelector('.color-swatch__link');
    const activeVariantURL = link?.getAttribute('href');
    if (!activeVariantURL) return;

    this.productCard.setAttribute('href', activeVariantURL);

    if (this.quickViewButton) this.quickViewButton.dataset.productUrl = activeVariantURL;
    if (this.quickViewButtonEl) this.quickViewButtonEl.dataset.productUrl = activeVariantURL;
  }

  _scheduleAlignSwatches() {
    if (!this.tooltip) return;
    if (this._alignRaf) return;

    this._alignRaf = requestAnimationFrame(() => {
      this._alignRaf = 0;
      this.alignSwatches();
    });
  }

  alignSwatches() {
    if (!this.tooltip) return;

    if (!this._viewportEl) {
      this._viewportEl =
        this.tooltip.closest('.slider__viewport') ||
        this.tooltip.closest('.section') ||
        null;
    }
    const viewport = this._viewportEl;
    if (!viewport) return;

    if (this._lastTooltipShift !== null) {
      this.tooltip.style.left = '';
      this.tooltip.style.right = '';
      this._lastTooltipShift = null;
    }

    const rtl = !!theme?.config?.isRTL;
    const vRect = viewport.getBoundingClientRect();
    const tRect = this.tooltip.getBoundingClientRect();

    const overflowsViewport = rtl
      ? (vRect.right < tRect.right)
      : (vRect.left >= tRect.left);

    if (!overflowsViewport) return;

    const shift = rtl
      ? Math.abs(tRect.right - vRect.right) * -1
      : Math.abs(tRect.left - vRect.left);

    if (this._lastTooltipShift === shift) return;
    this._lastTooltipShift = shift;

    if (rtl) this.tooltip.style.left = `${shift}px`;
    else this.tooltip.style.right = `calc(50% - ${shift}px)`;
  }
}

customElements.define('color-swatch', ColorSwatch);

class VideoSection extends HTMLElement {
  constructor() {
    super();
    this.overlay = document.body.querySelector('body > .overlay')
    this.init();
  }

  init() {
    this.popup = this.closest('modal-window') || this.closest('modal-dialog')
    if(this.popup) {
      this.buttonClose = this.popup.querySelector('.close-popup')
      
      this.openPopup = this.popup.querySelector('.open-popup')
      if(!this.openPopup) {
        this.modalId = this.popup.id
        this.openPopup = document.querySelector(`[data-modal="#${this.modalId}"]`).querySelector('.button--modal-opener')
      }
      this.buttonClose.addEventListener('click', () => { 
        if(this.player && this.dataset.type == 'youtube') {
          this.player.pauseVideo()
        } else if (this.player) {
          this.player.pause()
        }
      })
      this.buttonClose.addEventListener('keydown', (event) => { 
        if (event.code.toUpperCase() === 'ENTER') {
          if(this.player && this.dataset.type == 'youtube') {
            this.player.pauseVideo()
          } else if (this.player) {
            this.player.pause()
          }
        }
      })
      this.overlay.addEventListener('click', () => {
        if(this.player && this.dataset.type == 'youtube') {
          this.player.pauseVideo()
        } else if (this.player) {
          this.player.pause()
        }
      })
      this.openPopup.addEventListener('click', () => {
        if(this.player && this.dataset.type == 'youtube') {
          this.player.playVideo()
        } else if (this.player) {
          this.player.play()
        }
      })
      this.openPopup.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          if(this.player && this.dataset.type == 'youtube') {
            this.player.playVideo()
          } else if (this.player) {
            this.player.play()
          }
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ESCAPE' && this.player) {
          if(this.player && this.dataset.type == 'youtube') {
            this.player.pauseVideo()
          } else if (this.player) {
            this.player.pause()
          }
        }
      })
    }

    this.parentSelector = this.dataset.parent || '.deferred-media';
    this.parent = this.closest(this.parentSelector);
    if(!this.parent) this.parent = this.closest('.popup-video').querySelector(this.parentSelector)

    switch(this.dataset.type) {
      case 'youtube':
        this.initYoutubeVideo();
        break;

      case 'vimeo':
        this.initVimeoVideo();
        break;

      case 'mp4':
        this.initMp4Video();
        break;
    }
  }

  initYoutubeVideo() {
    this.loadScript('youtube').then(this.setupYoutubePlayer.bind(this));
  }

  initVimeoVideo() {
    this.loadScript('vimeo').then(this.setupVimeoPlayer.bind(this));
  }

  initMp4Video() {
    const player = this.querySelector('video');

    if (player) {
      const promise = player.play();

      // Edge does not return a promise (video still plays)
      if (typeof promise !== 'undefined') {
        promise.then(function() {
          // playback normal
        }).catch(function() {
          player.setAttribute('controls', '');
        });
      }
    }
  }

  loadScript(videoType) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      document.body.appendChild(script);
      script.onload = resolve;
      script.onerror = reject;
      script.async = true;
      script.src = videoType === 'youtube' ? 'https://www.youtube.com/iframe_api' : '//player.vimeo.com/api/player.js';
    });
  }

  setAsLoaded() {
    this.parent.setAttribute('loaded', true);
  }

  setupYoutubePlayer() {
    const videoId = this.dataset.videoId;
    
    const playerInterval = setInterval(() => {
      if (window.YT) {
        window.YT.ready(() => {
          const element = document.createElement('div');
          this.appendChild(element);

          this.player = new YT.Player(element, {
            videoId: videoId,
            playerVars: {
              showinfo: 0,
              controls: !this.background,
              fs: !this.background,
              rel: 0,
              height: '100%',
              width: '100%',
              iv_load_policy: 3,
              html5: 1,
              loop: 1,
              playsinline: 1,
              modestbranding: 1,
              disablekb: 1
            },
            events: {
              onReady: this.onYoutubeReady.bind(this),
              onStateChange: this.onYoutubeStateChange.bind(this)
            }
          });
          clearInterval(playerInterval);
        });
      }
    }, 50);
  }

  onYoutubeReady() {
    this.iframe = this.querySelector('iframe'); // iframe once YT loads
    this.iframe.classList.add('js-youtube')
    this.iframe.setAttribute('tabindex', '-1');

    if(theme.config.isTouch) this.player.mute();
    if(this.closest('.video-button-block')) {
      this.youtubePause()
      return
    } 
    if (typeof this.player.playVideo === 'function') this.player.playVideo();

    this.setAsLoaded();

    // pause when out of view
    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        entry.isIntersecting ? this.youtubePlay() : this.youtubePause();
      });
    }, {rootMargin: '0px 0px 50px 0px'});

    observer.observe(this.iframe);
  }

  onYoutubeStateChange(event) {
    switch (event.data) {
      case -1: // unstarted
        // Handle low power state on iOS by checking if
        // video is reset to unplayed after attempting to buffer
        if (this.attemptedToPlay) {
          this.setAsLoaded();
        }
        break;
      case 0: // ended, loop it
        this.youtubePlay();
        break;
      case 1: // playing
        this.setAsLoaded();
        break;
      case 3: // buffering
        this.attemptedToPlay = true;
        break;
    }
  }

  youtubePlay() {
    if (this.background && this.player && typeof this.player.playVideo === 'function') {
      this.player.playVideo();
    }
  }

  youtubePause() {
    if (this.background && this.player && typeof this.player.pauseVideo === 'function') {
      this.player.pauseVideo();
    }
  }

  setupVimeoPlayer() {
    const videoId = this.dataset.videoId;

    const playerInterval = setInterval(() => {
      if (window.Vimeo) {
        this.player = new Vimeo.Player(this, {
          id: videoId,
          autoplay: true,
          autopause: false,
          background: this.background,
          controls: !this.background,
          loop: true,
          height: '100%',
          width: '100%'
        });
        this.player.ready().then(this.onVimeoReady.bind(this));

        clearInterval(playerInterval);
      }
    }, 50);
  }

  onVimeoReady() {
    this.iframe = this.querySelector('iframe');
    this.iframe.classList.add('js-vimeo')
    this.iframe.setAttribute('tabindex', '-1');

    if(theme.config.isTouch) this.player.setMuted(true);
    if(this.closest('.video-button-block')) {
      this.vimeoPause();
      return
    } 
    this.setAsLoaded();

    // pause when out of view
    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.vimeoPlay();
        } else {
          this.vimeoPause();
        }
      });
    }, {rootMargin: '0px 0px 50px 0px'});

    observer.observe(this.iframe);
  }

  vimeoPlay() {
    if (this.background && this.player && typeof this.player.play === 'function') {
      this.player.play();
    }
  }

  vimeoPause() {
    if (this.background && this.player && typeof this.player.pause === 'function') {
      this.player.pause();
    }
  }
  
}
customElements.define('video-section', VideoSection);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();

    if (this.closest('modal-dialog')) {
      this.init()
    } else {
      theme.initWhenVisible({
        element: this,
        callback: this.init.bind(this),
        threshold: 600
      });
    }
  }

  init() {
    this.poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (this.closest('modal-dialog')) {
      this.modalId = this.closest('modal-dialog').id
      this.poster = this.closest('.video-button-block').querySelector('[id^="Deferred-Poster-"]')
    }
    if (!this.poster) return;
    this.popupVideo = this.querySelector('.popup-video') || this.closest('.popup-video')
    this.enableAutoplay = this.dataset.enableAutoplay === "true";
    this.mediaVisibilityWhenScrollByInMs = 300;
    this.poster.addEventListener('click', this.actionDefferedMedia.bind(this)); 
    this.poster.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'ENTER') this.actionDefferedMedia.bind(this);
    });

    if (this.enableAutoplay) {
      this.autoplayMediaWhenFirstVisible();
    }
  }

  getObserverOptions(targetElement) {
    const isMediaTwiceLargerThanScreen = targetElement.offsetHeight / 2 > window.innerHeight;

    const observerOptions = isMediaTwiceLargerThanScreen
    ? { rootMargin: `-${window.innerHeight / 2}px 0px -${window.innerHeight / 2}px 0px` }
    : { threshold: 0.5 };

    return observerOptions;
  }

  autoplayMediaWhenFirstVisible() {
    const mediaWrapper = this.closest('.product__media-item') || this.closest('.global-media-settings');
 
    if (!mediaWrapper) return;
  
    const observer = new IntersectionObserver((entries, observerInstance) => {
      entries.forEach(entry => {
        const isVisible = entry.isIntersecting;
        const element = entry.target;
  
        if (isVisible) {
          if (!element.intersectTimeout) {
            // Set a timeout to ensure the element remains visible for 500ms before triggering
            element.intersectTimeout = setTimeout(() => {
              if (!element.dataset.intersected) {
                element.dataset.intersected = 'true';
                this.triggerPosterEvents();
                observerInstance.unobserve(mediaWrapper); // Stop observing after the first interaction
              }
            }, 500);
          }
        } else {
          // Clear timeout if the element is no longer visible
          if (element.intersectTimeout) {
            clearTimeout(element.intersectTimeout);
            element.intersectTimeout = null;
          }
        }
      });
    }, this.getObserverOptions(mediaWrapper));
  
    observer.observe(mediaWrapper);
  }
  
  triggerPosterEvents() {
    if (!this.poster) return;
  
    const events = [
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
      new MouseEvent('mousemove', { bubbles: true, cancelable: true }),
      new MouseEvent('click', { bubbles: true, cancelable: true }),
      new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'Enter' }),
    ];
  
    events.forEach(event => this.poster.dispatchEvent(event));
  }

  setPauseMediaWhenNotVisible(media, mediaWrapperToObserve) {
    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          media.dataset.visible = true;
        } else if (media.dataset.visible) {         
          window.pauseMedia(media);

          media.dataset.visible = false;
        }
      });
    }, this.getObserverOptions(mediaWrapperToObserve || media));  

    observer.observe(mediaWrapperToObserve || media);
  }

  observeMediaVisibility(media, mediaWrapperToObserve) {
    media.dataset.visible = true;

    const observer = new IntersectionObserver((entries, _observer) => {
      entries.forEach(entry => {
        const element = entry.target;

        if (entry.isIntersecting) {
          if (!element.intersectTimeout) {
            element.intersectTimeout = setTimeout(() => {
              window.playMedia(media, this.enableAutoplay);

              media.dataset.visible = true;
            }, this.mediaVisibilityWhenScrollByInMs); 
          }
        } else {   
          if (element.intersectTimeout) {
            clearTimeout(element.intersectTimeout);
            element.intersectTimeout = null;
          }

          if (media.dataset.visible) {     
            window.pauseMedia(media, this.enableAutoplay);

            media.dataset.visible = false;
          }
        }
      });
    }, this.getObserverOptions(mediaWrapperToObserve || media));  

    observer.observe(mediaWrapperToObserve || media);
  }

  loadContent(focus = true) {
    const isProductOverviewSection = !!this.closest('.product-overview-section') || !!this.closest('.product-media-modal');

    if (!isProductOverviewSection) {
      window.pauseAllMedia(); 
    }
    let thisVideo = this.querySelector('video')
    if(thisVideo && thisVideo.dataset.videoPlay == 'true') {
      thisVideo.dataset.videoPlay = false
      return
    }
    if(thisVideo && thisVideo.dataset.videoPlay == 'false') {
      thisVideo.play()
      thisVideo.dataset.videoPlay = true
    }
    if(this.getAttribute('loaded')) return
    if(this.querySelector('.template-video')) return
    const content = document.createElement('div');
    content.classList.add('template-video')
    const template = this.querySelector('template');
    const media = template.content.firstElementChild.cloneNode(true)
    content.appendChild(media);
    if (content.querySelector('video-section')) {
      this.popupVideo ? this.popupVideo.appendChild(content).focus() : this.appendChild(content).focus();
    } else {
      this.setAttribute('loaded', true);
      const deferredElement = this.appendChild(content.querySelector('video, model-viewer, iframe'));
      if (focus) deferredElement.focus();
    }
    thisVideo = this.querySelector('video')
    if(thisVideo) {
      thisVideo.play();
      thisVideo.dataset.videoPlay = true
    }

    if (isProductOverviewSection && media) {
      const mediaWrapper = template.closest('.product__media-item') || template.closest('.global-media-settings');

      if (this.enableAutoplay) {
        this.observeMediaVisibility(media, mediaWrapper);
      } else {
        this.setPauseMediaWhenNotVisible(media, mediaWrapper);
      }
    }
    
    window.playMedia(media, this.enableAutoplay);
  }

  actionDefferedMedia(event) {
    if(event) event.preventDefault()
    this.loadContent();
  }
}
customElements.define('deferred-media', DeferredMedia);

class QuantityInput extends HTMLElement {
  constructor() {
    super();

    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true });
    this.input.addEventListener('change', this.onInputChange.bind(this));
    this.querySelectorAll('button').forEach((button) =>
      button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  quantityUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.quantityUpdate, this.validateQtyRules.bind(this));
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    event.target.closest('[name="plus"]') ? this.input.stepUp() : this.input.stepDown();
    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const min = parseInt(this.input.min);
      const buttonMinus = this.querySelector(".quantity__button[name='minus']");
      buttonMinus.classList.toggle('disabled', value <= min);
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector(".quantity__button[name='plus']");
      buttonPlus.classList.toggle('disabled', value >= max);
    }
  }
}
customElements.define('quantity-input', QuantityInput);

class ComponentTabs extends HTMLElement {
  constructor() {
    super();

    // state
    this._inited = false;
    this.blockSelect = false;

    this.tabs = [];
    this.contents = [];
    this._contentByTabId = new Map();

    this._activeTab = null;
    this._activeContent = null;

    // tabindex lazy
    this._tabindexReady = false;
    this._tabindexScheduled = false;
    this._io = null;
    this._idleId = 0;
    this._rafId = 0;

    this._focusablesCache = new WeakMap();
    this._panelTabState = new WeakMap();

    // binds
    this._onClick = this._onClick.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
    this._onBlockSelect = this._onBlockSelect.bind(this);
    this._onIntersect = this._onIntersect.bind(this);

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });

    document.addEventListener('shopify:block:select', this._onBlockSelect);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeydown);
    document.removeEventListener('shopify:block:select', this._onBlockSelect);

    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }

    if (this._idleId && 'cancelIdleCallback' in window) {
      cancelIdleCallback(this._idleId);
    }
    this._idleId = 0;

    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;

    this._inited = false;
    this._contentByTabId.clear();
    this._focusablesCache = new WeakMap();
    this._panelTabState = new WeakMap();
    this._tabindexReady = false;
    this._tabindexScheduled = false;
  }

  init() {
    if (this._inited) {
      this._rebuildCache();
      this._ensureInitialActive();
      this._armTabindexNearViewport();
      return;
    }

    this._inited = true;
    this.blockSelect = false;

    this._rebuildCache();
    this._ensureInitialActive();

    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeydown);

    this._armTabindexNearViewport();
  }

  _rebuildCache() {
    this.tabs = Array.from(this.querySelectorAll('.tab-js'));

    const container = this.closest('.tabs-container-js');
    this.contents = container ? Array.from(container.querySelectorAll('.tab-content-js')) : [];

    this._contentByTabId.clear();
    for (const content of this.contents) {
      const id = content.getAttribute('id') || '';
      const tabId = id.includes('content-') ? id.split('content-')[1] : null;
      if (tabId) this._contentByTabId.set(tabId, content);
    }

    this._activeTab = this.querySelector('.tab-js.active') || null;

    const containerActive = container ? container.querySelector('.tab-content-js.active') : null;
    const mapped = (this._activeTab && this._contentByTabId.get(this._activeTab.id)) || null;
    this._activeContent = mapped || containerActive || null;
  }

  _ensureInitialActive() {
    if (!this.tabs.length || !this.contents.length) return;

    const isPredictive = !!this.closest('.tabs-container-js.predictive-search-results');

    if (!this._activeTab || isPredictive) {
      const firstTab = this.tabs[0];
      const firstContent = this._contentByTabId.get(firstTab.id) || this.contents[0];
      this._setActive(firstTab, firstContent, /*blockSelect*/ false);
      return;
    }

    if (this._activeTab && !this._activeContent) {
      const c = this._contentByTabId.get(this._activeTab.id);
      if (c) this._activeContent = c;
    }

    if (this._activeTab) {
      const c = this._contentByTabId.get(this._activeTab.id) || this._activeContent;
      if (c) this._setActive(this._activeTab, c, /*blockSelect*/ false);
    }
  }

  _armTabindexNearViewport() {
    if (this._tabindexReady) return;
    if (this._io) return;

    if (!('IntersectionObserver' in window)) {
      this._scheduleAllTabindex();
      return;
    }

    this._io = new IntersectionObserver(this._onIntersect, {
      root: null,
      rootMargin: '600px 0px',
      threshold: 0.01
    });

    this._io.observe(this);
  }

  _onIntersect(entries) {
    const e = entries && entries[0];
    if (!e) return;
    if (!e.isIntersecting) return;

    this._scheduleAllTabindex();

    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
  }

  _scheduleAllTabindex() {
    if (this._tabindexReady) return;
    if (this._tabindexScheduled) return;
    this._tabindexScheduled = true;

    const run = () => {
      this._tabindexScheduled = false;
      this._applyAllTabindex();
    };

    this._rafId = requestAnimationFrame(() => {
      this._rafId = 0;

      if ('requestIdleCallback' in window) {
        this._idleId = requestIdleCallback(run, { timeout: 1000 });
      } else {
        setTimeout(run, 0);
      }
    });
  }

  _applyAllTabindex() {
    if (!this.contents.length) return;

    const activePanel = this._activeContent || this._inferActiveContentFromDOM();

    const panels = this.contents.slice();
    let i = 0;

    const step = (deadline) => {
      const hasDeadline = !!deadline && typeof deadline.timeRemaining === 'function';

      while (i < panels.length) {
        if (hasDeadline && deadline.timeRemaining() < 6) break;

        const panel = panels[i++];
        const shouldBeActive = panel === activePanel;

        this._setPanelFocusable(panel, shouldBeActive ? '0' : '-1');
      }

      if (i < panels.length) {
        if ('requestIdleCallback' in window) {
          this._idleId = requestIdleCallback(step, { timeout: 1000 });
        } else {
          setTimeout(() => step(null), 0);
        }
      } else {
        this._tabindexReady = true;
      }
    };

    if ('requestIdleCallback' in window) {
      this._idleId = requestIdleCallback(step, { timeout: 1000 });
    } else {
      setTimeout(() => step(null), 0);
    }
  }

  _inferActiveContentFromDOM() {
    const container = this.closest('.tabs-container-js');
    const active = container ? container.querySelector('.tab-content-js.active') : null;
    return active || null;
  }

  _setPanelFocusable(panel, value) {
    if (!panel) return;

    const prev = this._panelTabState.get(panel);
    if (prev === value) return;
    this._panelTabState.set(panel, value);

    const focusables = this._getFocusables(panel);
    for (const el of focusables) {
      if (el.getAttribute('tabindex') === value) continue;
      el.setAttribute('tabindex', value);
    }
  }

  _getFocusables(rootEl) {
    let cached = this._focusablesCache.get(rootEl);
    if (cached) return cached;

    let list = [];
    if (typeof window.getFocusableElements === 'function') {
      list = Array.from(window.getFocusableElements(rootEl));
    } else {
      list = Array.from(this._getFocusableElementsFast(rootEl));
    }

    this._focusablesCache.set(rootEl, list);
    return list;
  }

  _getFocusableElementsFast(rootEl) {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]'
    ].join(',');

    const nodes = rootEl.querySelectorAll(selector);
    const out = [];
    nodes.forEach((el) => {
      if (el.getAttribute('tabindex') === '-1') {
        out.push(el);
        return;
      }
      if (el.hasAttribute('disabled')) return;
      if (el.getAttribute('aria-hidden') === 'true') return;
      out.push(el);
    });
    return out;
  }

  _onClick(event) {
    const tab = event.target.closest('.tab-js');
    if (!tab || !this.contains(tab)) return;
    this._activateTab(tab, false);
  }

  _onKeydown(event) {
    if ((event.code || '').toUpperCase() !== 'ENTER') return;

    const tab = event.target.closest('.tab-js');
    if (!tab || !this.contains(tab)) return;

    event.preventDefault();
    this._activateTab(tab, false);
  }

  _onBlockSelect(event) {
    const activeTab = event.target;
    if (!activeTab?.getAttribute) return;

    const activeElemID = activeTab.getAttribute('id');
    if (!activeElemID) return;

    const section = this.closest('section');
    if (!section || !section.querySelector(`#${CSS.escape(activeElemID)}`)) return;

    this.init();

    this.blockSelect = true;

    const tab = this.querySelector(`#${CSS.escape(activeElemID)}`)?.closest('.tab-js') || null;
    if (!tab) return;

    this._activateTab(tab, true);
  }

  _activateTab(tabEl, blockSelect) {
    if (!tabEl || tabEl.classList.contains('disabled')) return;

    const tabId = tabEl.getAttribute('id');
    const contentEl = tabId ? this._contentByTabId.get(tabId) : null;

    if (!contentEl && this.contents.length === 0) {
      this._setActiveTabOnly(tabEl);
      return;
    }

    this._setActive(tabEl, contentEl, blockSelect);
  }

  _setActiveTabOnly(tabEl) {
    for (const t of this.tabs) t.classList.remove('active');
    tabEl.classList.add('active');
    this._activeTab = tabEl;
  }

  _setActive(tabEl, contentEl, blockSelect) {
    for (const t of this.tabs) t.classList.remove('active');
    tabEl.classList.add('active');

    if (this.contents && this.contents.length) {
      for (const panel of this.contents) {
        if (panel === contentEl) continue;
        if (!panel.classList.contains('active')) continue;

        panel.classList.remove('active');
        if (this._tabindexReady && !blockSelect) this._setPanelFocusable(panel, '-1');
      }
    }

    if (contentEl) {
      contentEl.classList.add('active');
      if (this._tabindexReady && !blockSelect) this._setPanelFocusable(contentEl, '0');

      const slider = contentEl.querySelector('.section-tabs__slider');
      if (slider && typeof slider.updateSliderNavigation === 'function') {
        slider.updateSliderNavigation();
      }
    }

    this._activeTab = tabEl;
    this._activeContent = contentEl || null;

    if (!this._tabindexReady) {
      this._armTabindexNearViewport();
    }
  }
}
customElements.define('component-tabs', ComponentTabs);

class ScrollingPromotion extends HTMLElement {
  constructor() {
    super();

    this._mounted = false;
    this._inited = false;

    this.config = {
      moveTime: parseFloat(this.dataset.speed) || 1,
      space: 100,
    };

    this.promotion = null;

    this._resizeRaf = 0;
    this._buildRaf = 0;
    this._pauseObserver = null;
    this._visibleObserver = null;
    this._resizeObserver = null;

    this._lastWidth = 0;
    this._lastDuration = '';

    this._rtl = false;

    this._onResizeFallback = this._onResizeFallback.bind(this);
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    this.promotion = this.querySelector('.promotion');
    if (!this.promotion) return;

    this._rtl = !!theme?.config?.isRTL;

    theme.initWhenVisible({
      element: this,
      callback: () => this.init(),
      threshold: 300,
    });

    this._setupVisibleObserver();
  }

  disconnectedCallback() {
    this._mounted = false;

    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
    this._resizeRaf = 0;

    if (this._buildRaf) cancelAnimationFrame(this._buildRaf);
    this._buildRaf = 0;

    window.removeEventListener('resize', this._onResizeFallback);

    if (this._pauseObserver) {
      this._pauseObserver.disconnect();
      this._pauseObserver = null;
    }

    if (this._visibleObserver) {
      this._visibleObserver.disconnect();
      this._visibleObserver = null;
    }

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    this._inited = false;
  }

  init() {
    if (this._inited) return;
    this._inited = true;

    if (this.childElementCount !== 1) {
      this._setupPauseObserver();
      this._setupResizeObserver();
      return;
    }

    this.promotion.classList.add('promotion--animated');

    const totalClones = 10;
    let i = 0;

    const buildChunk = () => {
      const chunkSize = 2;
      const frag = document.createDocumentFragment();

      for (let n = 0; n < chunkSize && i < totalClones; n++, i++) {
        const clone = this.promotion.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');

        if (i > 1) {
          try {
            getFocusableElements(clone).forEach(el => el.setAttribute('tabindex', '-1'));
          } catch (e) {}
        }

        const imageWrapper = clone.querySelector('.promotion__item');
        if (imageWrapper) imageWrapper.classList.remove('loading');

        frag.appendChild(clone);
      }

      if (this._rtl) {
        this.insertBefore(frag, this.firstChild);
      } else {
        this.appendChild(frag);
      }

      if (i < totalClones) {
        this._buildRaf = requestAnimationFrame(buildChunk);
      } else {
        this._buildRaf = 0;
        this._setupPauseObserver();
        this._setupResizeObserver();
      }
    };

    this._buildRaf = requestAnimationFrame(buildChunk);
  }

  _setupVisibleObserver() {
    if (this._visibleObserver) return;

    this._visibleObserver = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e) return;

      if (e.isIntersecting) {
        this._scheduleUpdateDuration();
      }
    }, {
      root: null,
      rootMargin: '0px',
      threshold: 0.01
    });

    this._visibleObserver.observe(this);
  }

  _setupResizeObserver() {
    if (this._resizeObserver) return;

    if ('ResizeObserver' in window && this.promotion) {
      this._resizeObserver = new ResizeObserver(() => {
        this._scheduleUpdateDuration();
      });
      this._resizeObserver.observe(this.promotion);
      return;
    }

    window.addEventListener('resize', this._onResizeFallback, { passive: true });
  }

  _onResizeFallback() {
    this._scheduleUpdateDuration();
  }

  _scheduleUpdateDuration() {
    if (!this._inited) return;

    if (this._resizeRaf) return;
    this._resizeRaf = requestAnimationFrame(() => {
      this._resizeRaf = 0;
      this._updateDuration();
    });
  }

  _updateDuration() {
    if (!this.promotion) return;

    const w = Math.round(this.promotion.clientWidth || 0);
    if (!w) return;

    if (w === this._lastWidth) return;
    this._lastWidth = w;

    const durationNum = (w / this.config.space) * this.config.moveTime;
    const duration = `${durationNum}s`;

    if (duration === this._lastDuration) return;
    this._lastDuration = duration;

    this.style.setProperty('--duration', duration);
  }

  _setupPauseObserver() {
    if (this._pauseObserver) return;

    this._pauseObserver = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e) return;

      if (e.isIntersecting) this.scrollingPlay();
      else this.scrollingPause();
    }, {
      root: null,
      rootMargin: '0px 0px 50px 0px',
      threshold: 0.01
    });

    this._pauseObserver.observe(this);
  }

  scrollingPlay() {
    if (!this.classList.contains('scrolling-promotion--paused')) return;
    this.classList.remove('scrolling-promotion--paused');
  }

  scrollingPause() {
    if (this.classList.contains('scrolling-promotion--paused')) return;
    this.classList.add('scrolling-promotion--paused');
  }
}

customElements.define('scrolling-promotion', ScrollingPromotion);

class ImageComparison extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    this.range = this.querySelector('.image-comparison__range');

    this.range.addEventListener('input', (e) => {
      const position = theme.config.isRTL ? 100 - e.target.value : e.target.value;
      this.style.setProperty('--position', `${position}%`);
    });

    this.range.addEventListener('change', (e) => {
      const position = theme.config.isRTL ? 100 - e.target.value : e.target.value;
      this.style.setProperty('--position', `${position}%`);
    });

    this.setValue()
    window.addEventListener('resize', this.setValue.bind(this))
  }

  setValue () {
    this.width = this.offsetWidth;
    this.min = Math.max(Math.ceil(14 * 100 / this.width * 10) / 10, 0)
    this.max = 100 - this.min
    this.range.setAttribute('min', this.min)
    this.range.setAttribute('max', this.max)
  }
}
customElements.define('image-comparison', ImageComparison);

class ImageWithHotspots extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    this.timeout
    this.dots = this.querySelectorAll('.image-with-hotspots__dot');
    this.dropdowns = this.querySelectorAll('.image-with-hotspots__dot ~ .image-with-hotspots__content');
    this.dots.forEach(dot => dot.addEventListener('mouseenter', (event) => {
      if(!dot.nextElementSibling) return
      if (event.target.closest('.image-with-hotspots__dot')) this.openDropdown(event.target.closest('.image-with-hotspots__dot')) 
    }))

    this.dots.forEach(dot => dot.addEventListener('mousemove', (event) => {
      if(!dot.nextElementSibling) return
      if (event.target.closest('.image-with-hotspots__dot')) this.openDropdown(event.target.closest('.image-with-hotspots__dot')) 
    }))

    this.dots.forEach(dot => dot.addEventListener('mouseleave', (event) => {
      if(!dot.nextElementSibling) return
      if (event.relatedTarget && !event.relatedTarget.closest('.image-with-hotspots__content')) this.closeDropdown(dot)
    }))

    this.dropdowns.forEach(dropdown => dropdown.addEventListener('mouseleave', (event) => {
      if (event.relatedTarget != dropdown.previousElementSibling) this.closeDropdown(dropdown.previousElementSibling)
    }))

    this.dropdowns.forEach(dropdown => dropdown.addEventListener('click', (event) => {
      if(event.target.closest('quick-view-button') && event.target.closest('quick-view-button').previousElementSibling.closest('.open')) this.closeDropdown(event.target.closest('quick-view-button').previousElementSibling)
    }))
  }

  openDropdown(item) {
    this.stopAnimation()
    this.alignDropdown(item.nextElementSibling)
    item.classList.add('open', 'active')
    item.classList.remove('closing')
    item.closest('.image-with-hotspots__hotspot').style.zIndex = 6
  }

  closeDropdown(item) {
    item.classList.add('closing')
    this.timeout = setTimeout(() => {
      item.classList.remove('closing')
      item.classList.remove('open')
      item.closest('.image-with-hotspots__hotspot').removeAttribute('style')
      this.content = item.nextElementSibling
      this.content.removeAttribute('style')
    }, 300);

    item.classList.remove('active')
  }

  alignDropdown(item) {
    this.itemCoordinate = item.getBoundingClientRect();
    this.itemWidth = item.offsetWidth
    this.viewportWidth = window.innerWidth
    this.dotPosition = Math.round(item.closest('.image-with-hotspots__hotspot').getBoundingClientRect().left)
    if(this.itemCoordinate.left < 0) {
      item.style.left = 0 - this.dotPosition + 'px';
      item.style.right = 'auto';
    } else if (this.itemCoordinate.right  > this.viewportWidth) {
      item.style.right = 'auto';
      item.style.left = this.viewportWidth - this.dotPosition - this.itemWidth + 'px';
    } 
  }

  stopAnimation() {
    clearTimeout(this.timeout)
    this.querySelectorAll('.image-with-hotspots__hotspot').forEach(item => item.removeAttribute('style'))
  }
}
customElements.define('image-with-hotspots', ImageWithHotspots);

class ProductRecentlyViewed extends HTMLElement {
  constructor() {
    super();
    
    // Save the product ID in local storage to be eventually used for recently viewed section
    if (isStorageSupported('local')) {
      const productId = parseInt(this.dataset.productId);
      const cookieName = 'volume-theme:recently-viewed';
      const items = JSON.parse(window.localStorage.getItem(cookieName) || '[]');

      // Check if the current product already exists, and if it does not, add it at the start
      if (!items.includes(productId)) {
        items.unshift(productId);
      }

      // By keeping only the 10 most recent
      window.localStorage.setItem(cookieName, JSON.stringify(items.slice(0, 10)));
    }
  }
}
customElements.define('product-recently-viewed', ProductRecentlyViewed);

class RecentlyViewedProducts extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    if (Shopify.designMode) {
      return;
    }

    fetch(this.dataset.url + this.getQueryString())
      .then(response => response.text())
      .then(text => {
        const html = document.createElement('div');
        html.innerHTML = text; 

        const recentlyViewedContent = html.querySelector('slider-component') || html.querySelector('.product__grid-container');

        if ((recentlyViewedContent && recentlyViewedContent.innerHTML.trim().length) || Shopify.designMode) {
          const recommendations = html.querySelector('recently-viewed-products');

          this.innerHTML = recommendations.innerHTML;
        } else {
          this.handleNoRecentlyProductsFound();
        }
        document.dispatchEvent(new CustomEvent('recommendations:loaded'));
      })
      .catch(e => {
        console.error(e);
      });     
  }

  handleNoRecentlyProductsFound() {
    const tabs = this.closest('.tabs-block');

    if (tabs) {
      const placeholder = this.querySelector('.no-viewed-products-placeholder');

      placeholder.removeAttribute('hidden');

      return;
    } 

    this.remove();   
  }

  getQueryString() {
    const cookieName = 'volume-theme:recently-viewed';
    let items = JSON.parse(window.localStorage.getItem(cookieName) || "[]");
    items = items.filter(item => item != null)
    if (this.dataset.productId && items.includes(parseInt(this.dataset.productId))) {
      items.splice(items.indexOf(parseInt(this.dataset.productId)), 1);
    }
    return items.map((item) => "id:" + item).slice(0, 10).join(" OR ");
  }
}
customElements.define('recently-viewed-products', RecentlyViewedProducts);

class ProductGallery extends HTMLElement {
  constructor() {
    super();

    // flags
    this._mounted = false;
    this._inited = false;
    this._initScheduled = false;

    // refs
    this.slider = null;
    this.sliderItems = null;
    this.thumbnails = null;

    this.pages = null;
    this.sliderViewport = null;

    this.currentPageElement = null;
    this.pageTotal = null;

    this.prevButtons = null;
    this.nextButtons = null;

    this.scrollbar = null;
    this.scrollbarTrack = null;
    this.scrollbarThumb = null;

    // state
    this.isOnButtonClick = false;
    this.gap = 4;
    this.lastWindowWidth = 0;

    // pages calc
    this.sliderItemsToShow = [];
    this.sliderItemOffset = 0;
    this.slidesPerPage = 1;
    this.totalPages = 1;
    this.currentPage = 1;

    // scrollbar drag
    this.isDragging = true;
    this.isDown = false;
    this.initialLeft = 0;
    this.initialX = 0;

    // rAF / timers
    this._rafInit = 0;
    this._rafResize = 0;
    this._rafScroll = 0;
    this._rafPages = 0;
    this._rafHeight = 0;
    this._rafScrollbar = 0;

    // observers
    this._io = null;
    this._ro = null;

    // intent handler
    this._firstIntent = null;

    // bound handlers (bind once)
    this._onResize = this._onResize.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onQuickviewLoaded = this._onQuickviewLoaded.bind(this);
    this._onSectionLoad = this._onSectionLoad.bind(this);
    this._onVariantChange = this._onVariantChange.bind(this);
    this._onUpdateVariantMedia = this._onUpdateVariantMedia.bind(this);

    // scrollbar bound handlers
    this._onScrollbarScroll = this._onScrollbarScroll.bind(this);
    this._onTrackMouseDown = this._onTrackMouseDown.bind(this);
    this._onScrollbarClick = this._onScrollbarClick.bind(this);
    this._onDocMouseUp = this._onDocMouseUp.bind(this);
    this._onDocMouseMove = this._onDocMouseMove.bind(this);
    this._scrollbarBound = false;

    // wheel/touch resets (to release isOnButtonClick)
    this._onWheelReset = () => { this.isOnButtonClick = false; };

    // click handlers factories (avoid bind in loop)
    this._onPrevClick = (e) => { e.preventDefault(); this.onButtonClick('previous'); };
    this._onNextClick = (e) => { e.preventDefault(); this.onButtonClick('next'); };
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    // lightweight refs (no layout reads!)
    this._refreshRefsLight();

    if (!this.slider) return;

    // lazy init: viewport or first intent
    this._armLazyInit();

    document.addEventListener('updateVariantMedia', this._onUpdateVariantMedia);
    document.addEventListener('quickview:loaded', this._onQuickviewLoaded);
    document.addEventListener('shopify:section:load', this._onSectionLoad);
    document.addEventListener('variant:change', this._onVariantChange);
  }

  disconnectedCallback() {
    this._mounted = false;
    this._disarmLazyInit();
    this._teardown();
  }

  _armLazyInit() {
    if (this._io || this._firstIntent) return;

    this._firstIntent = () => this._scheduleInit('intent');

    // first user intent
    this.addEventListener('pointerenter', this._firstIntent, { once: true, passive: true });
    this.addEventListener('pointerdown',  this._firstIntent, { once: true, passive: true });
    this.addEventListener('focusin',      this._firstIntent, { once: true, passive: true });

    // viewport
    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        const entry = entries && entries[0];
        if (!entry) return;
        if (entry.isIntersecting) this._scheduleInit('viewport');
      }, { root: null, rootMargin: '500px 0px', threshold: 0.01 });

      this._io.observe(this);
    } else {
      // fallback: after load
      window.addEventListener('load', () => this._scheduleInit('fallback'), { once: true });
    }
  }

  _disarmLazyInit() {
    if (this._firstIntent) {
      this.removeEventListener('pointerenter', this._firstIntent);
      this.removeEventListener('pointerdown',  this._firstIntent);
      this.removeEventListener('focusin',      this._firstIntent);
      this._firstIntent = null;
    }
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
  }

  _scheduleInit(_reason) {
    if (this._inited || this._initScheduled) return;
    this._initScheduled = true;

    this._disarmLazyInit();

    const run = () => {
      this._initScheduled = false;
      this._initHard();
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 1200 });
    } else {
      // still async, not blocking initial paint
      setTimeout(run, 0);
    }
  }

  _refreshRefsLight() {
    this.slider = this.querySelector('[id^="Slider-Gallery"]') || this.querySelector('[id^="Slider-"]');
    if (!this.slider) return;

    this.sliderItems = this.slider.querySelectorAll('[id^="Slide-"]');
    this.thumbnails = this.querySelector('[id^="Slider-Thumbnails"]');

    this.pages = this.querySelector('.slider-counter');
    this.sliderViewport = this.querySelector('.slider__viewport');

    this.currentPageElement = this.querySelector('.slider-counter--current');
    this.pageTotal = this.querySelector('.slider-counter--total');

    this.prevButtons = this.querySelectorAll('button[name="previous"]');
    this.nextButtons = this.querySelectorAll('button[name="next"]');

    this.scrollbar = this.querySelector('.slider-scrollbar');
    this.scrollbarTrack = this.querySelector('.slider-scrollbar__track');
    this.scrollbarThumb = this.querySelector('.slider-scrollbar__thumb');
  }

  _initHard() {
    if (this._inited) return;

    this._refreshRefsLight();
    if (!this.slider) return;

    // if only 1 slide -> no heavy stuff
    if (!this.sliderItems || this.sliderItems.length < 2) {
      this._inited = true;
      this._setupPreloadImagesLight(); // safe: events only
      return;
    }

    this._inited = true;
    this.lastWindowWidth = window.innerWidth;

    // preload images (events only)
    this._setupPreloadImagesLight();

    // variant-specific items setup (no layout reads)
    this._syncVariantItemsLight();

    // product media alternative_2 marker (class writes, but only once and async)
    this._schedule(() => this._applyAlternative2Markers(), 'pages');

    // buttons
    if (this.prevButtons?.length || this.nextButtons?.length) {
      this.prevButtons.forEach(btn => btn.addEventListener('click', this._onPrevClick, { passive: false }));
      this.nextButtons.forEach(btn => btn.addEventListener('click', this._onNextClick, { passive: false }));
    }

    // scroll listener (passive)
    this.slider.addEventListener('scroll', this._onScroll, { passive: true });

    // release isOnButtonClick on interactions
    this.slider.addEventListener('wheel', this._onWheelReset, { passive: true });
    this.slider.addEventListener('touchstart', this._onWheelReset, { passive: true });
    this.slider.addEventListener('touchmove', this._onWheelReset, { passive: true });
    this.slider.addEventListener('touchend', this._onWheelReset, { passive: true });

    // resize (passive)
    window.addEventListener('resize', this._onResize, { passive: true });

    // ResizeObserver for pages (batched)
    if (this.pages && 'ResizeObserver' in window) {
      this._ro = new ResizeObserver(() => this._schedulePages(true));
      this._ro.observe(this.slider);
    }

    // initial compute BUT deferred (so reload doesn't block)
    this._schedule(() => {
      // set initial active if missing (cheap)
      if (!this.slider.querySelector('.is-active')) this.sliderItems?.[0]?.classList.add('is-active');

      // pages / buttons / height / scrollbar only once we are ready
      this._schedulePages(true);
      this._scheduleHeight(true);
      this._scheduleScrollbar(true);

      // organize_images behavior (scrollLeft write) — defer to after paint
      if (this.closest('.product__media-wrapper') && this.slider.classList.contains('organize_images')) {
        this._initProductGalleryDeferred();
      }
    }, 'init');
  }

  _teardown() {
    // remove global listeners
    document.removeEventListener('updateVariantMedia', this._onUpdateVariantMedia);
    document.removeEventListener('quickview:loaded', this._onQuickviewLoaded);
    document.removeEventListener('shopify:section:load', this._onSectionLoad);
    document.removeEventListener('variant:change', this._onVariantChange);

    // cancel rAFs
    if (this._rafInit) cancelAnimationFrame(this._rafInit);
    if (this._rafResize) cancelAnimationFrame(this._rafResize);
    if (this._rafScroll) cancelAnimationFrame(this._rafScroll);
    if (this._rafPages) cancelAnimationFrame(this._rafPages);
    if (this._rafHeight) cancelAnimationFrame(this._rafHeight);
    if (this._rafScrollbar) cancelAnimationFrame(this._rafScrollbar);

    this._rafInit = this._rafResize = this._rafScroll = this._rafPages = this._rafHeight = this._rafScrollbar = 0;

    // observers
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }

    // remove slider listeners
    if (this.slider) {
      this.slider.removeEventListener('scroll', this._onScroll);
      this.slider.removeEventListener('wheel', this._onWheelReset);
      this.slider.removeEventListener('touchstart', this._onWheelReset);
      this.slider.removeEventListener('touchmove', this._onWheelReset);
      this.slider.removeEventListener('touchend', this._onWheelReset);
    }

    window.removeEventListener('resize', this._onResize);

    // remove button listeners
    if (this.prevButtons?.length) this.prevButtons.forEach(btn => btn.removeEventListener('click', this._onPrevClick));
    if (this.nextButtons?.length) this.nextButtons.forEach(btn => btn.removeEventListener('click', this._onNextClick));

    // remove scrollbar listeners (if attached)
    this._removeScrollbarListeners();

    // clear refs
    this._inited = false;
    this._initScheduled = false;

    this.slider = null;
    this.sliderItems = null;
    this.thumbnails = null;

    this.pages = null;
    this.sliderViewport = null;

    this.currentPageElement = null;
    this.pageTotal = null;

    this.prevButtons = null;
    this.nextButtons = null;

    this.scrollbar = null;
    this.scrollbarTrack = null;
    this.scrollbarThumb = null;
  }

  _schedule(fn, key) {
    // small helper to batch on next frame
    // key used to avoid duplicating work in same frame
    const rafKey = `_raf_${key}`;
    if (this[rafKey]) return;
    this[rafKey] = requestAnimationFrame(() => {
      this[rafKey] = 0;
      if (!this._inited || !this.slider) return;
      fn();
    });
  }

  _onResize() {
    if (!this._inited) return;
    if (this._rafResize) return;

    this._rafResize = requestAnimationFrame(() => {
      this._rafResize = 0;
      if (!this.slider) return;

      // only do heavy recalcs if width really changed
      const w = window.innerWidth;
      const changed = w !== this.lastWindowWidth;
      this.lastWindowWidth = w;

      // height only if needs
      this._scheduleHeight(false);

      if (changed) {
        this._schedulePages(true);
        this._scheduleScrollbar(true);
      }
    });
  }

  _onScroll() {
    if (!this._inited || !this.slider) return;
    if (this._rafScroll) return;

    this._rafScroll = requestAnimationFrame(() => {
      this._rafScroll = 0;
      if (!this.slider) return;

      if (!this.isOnButtonClick && !this.slider.classList.contains('disable-scroll')) {
        this.changeActiveSlideOnScroll();
      }

      // keep scrollbar cursor in sync (cheap write)
      this._scheduleScrollbar(false);
    });
  }

  _onQuickviewLoaded() {
    // quickview opens -> scrollbar may become needed
    this._scheduleScrollbar(true);
  }

  _onSectionLoad() {
    // re-render section -> refresh refs & re-init light
    if (!this._mounted) return;
    this._refreshRefsLight();
    if (!this.slider) return;

    // do not force heavy sync here; schedule
    this._scheduleInit('section');
    this._schedule(() => {
      this._syncVariantItemsLight();
      this._applyAlternative2Markers();
      this._schedulePages(true);
      this._scheduleHeight(true);
      this._scheduleScrollbar(true);
    }, 'init');
  }

  _onVariantChange() {
    // after variant change, scrollbar may change
    this._scheduleScrollbar(true);
    // pages/buttons/height can change too, but schedule (cheap)
    this._schedulePages(true);
    this._scheduleHeight(true);
  }

  _onUpdateVariantMedia() {
    // update refs + variant items
    this._refreshRefsLight();
    if (!this.slider) return;

    this._syncVariantItemsLight();

    // ensure lazy images show as loaded (class writes only)
    this._schedule(() => {
      if (!this.sliderItems) return;
      this.sliderItems.forEach(item => {
        const li = item.querySelector('.lazy-image');
        if (li && !li.classList.contains('lazyloaded')) li.classList.add('lazyloaded');
      });
    }, 'init');

    // re-run calculates (deferred)
    this._schedulePages(true);
    this._scheduleHeight(true);
    this._scheduleScrollbar(true);
  }

  _setupPreloadImagesLight() {
    if (!this.slider) return;
    const imgs = this.slider.querySelectorAll('img');
    imgs.forEach(img => {
      // avoid adding multiple listeners on re-init
      if (img.__pgBound) return;
      img.__pgBound = true;

      img.addEventListener('load', () => img.classList.add('loaded'), { passive: true });
      if (img.complete) img.classList.add('loaded');
    });
  }

  _syncVariantItemsLight() {
    if (!this.slider) return;

    // variant-images mode
    if (
      this.slider.classList.contains('variant-images') &&
      this.slider.querySelectorAll('.product__media-item-image.product__media-item--variant-alt').length > 0
    ) {
      this.sliderItems = this.querySelectorAll('[id^="Slide-"].product__media-item.product__media-item--variant-alt');

      // hide buttons if <=2
      if (this.prevButtons?.length && this.nextButtons?.length) {
        const total = this.sliderItems.length;
        const hide = total <= 2;
        this.prevButtons.forEach(btn => btn.classList.toggle('visually-hidden', hide));
        this.nextButtons.forEach(btn => btn.classList.toggle('visually-hidden', hide));
      }

      // alt_1 first-el
      if (this.slider.classList.contains('product__media-list--alternative_1')) {
        const first = this.slider.querySelectorAll('.product__media-item--variant-alt')[0];
        if (first) first.classList.add('first-el');
      }
    } else {
      // default
      this.sliderItems = this.slider.querySelectorAll('[id^="Slide-"]');
    }
  }

  _applyAlternative2Markers() {
    if (!this.slider) return;
    if (
      this.slider.classList.contains('product__media-list--alternative_2') &&
      this.slider.classList.contains('media_attached_to_variant')
    ) {
      const items = this.slider.querySelectorAll('.product__media-item--variant-alt');
      items.forEach((elem, index) => {
        const should = (index === 0 || index % 3 === 0);
        elem.classList.toggle('third-el', should);
      });
    }
  }

  _initProductGalleryDeferred() {
    if (!this.slider) return;

    // avoids immediate layout thrash at load; do after first paint
    this.slider.style.scrollBehavior = 'unset';

    requestAnimationFrame(() => {
      if (!this.slider) return;
      const active = this.slider.querySelector('.is-active');
      if (!active) return;

      // scrollLeft write - yes causes style/layout, but deferred
      this.slider.scrollLeft = active.offsetLeft;

      requestAnimationFrame(() => {
        if (!this.slider) return;
        this.slider.style.scrollBehavior = 'smooth';
      });
    });
  }

  _scheduleHeight(force) {
    if (!this.slider) return;
    if (this._rafHeight) return;

    this._rafHeight = requestAnimationFrame(() => {
      this._rafHeight = 0;
      if (!this.slider) return;

      const active = this.slider.querySelector('.is-active') || this.sliderItems?.[0];
      this.resizeImage(active, force);
    });
  }

  resizeImage(activeElem) {
    if (!this.slider) return;
    if (!activeElem) return;

    const isDesktopOriginal = this.slider.classList.contains('product__media-list-desktop-original') && window.innerWidth > 768;
    const isMobileOriginal = this.slider.classList.contains('product__media-list-mobile-original') && window.innerWidth < 769;

    // Only write style if needed; avoid bouncing between auto/px in same state
    if (isDesktopOriginal || isMobileOriginal) {
      const h = activeElem.offsetHeight; // layout read (deferred)
      const next = `${h}px`;
      if (this.slider.style.height !== next) this.slider.style.height = next;
    } else {
      if (this.slider.style.height !== 'auto') this.slider.style.height = 'auto';
    }

    if (activeElem.dataset && activeElem.dataset.mediaId) {
      this.toggleXrButton(activeElem.dataset.mediaId);
    }
  }

  _schedulePages(force) {
    if (!this.pages || !this.slider) return;
    if (this._rafPages) return;

    this._rafPages = requestAnimationFrame(() => {
      this._rafPages = 0;
      if (!this.pages || !this.slider) return;
      this.initPages();
      this.update();
    });
  }

  initPages() {
    if (!this.sliderItems || !this.sliderItems.length) return;

    // filter visible slides
    this.sliderItemsToShow = Array.from(this.sliderItems).filter(el => el.clientWidth > 0);
    if (this.sliderItemsToShow.length < 2) return;

    // measure offsets (layout reads, but batched)
    this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
    if (!this.sliderItemOffset) return;

    this.slidesPerPage = Math.max(1, Math.floor(this.slider.clientWidth / this.sliderItemOffset));
    this.totalPages = this.sliderItemsToShow.length;
  }

  update() {
    if (!this.pages || !this.slider) return;

    // refresh items for variant images if needed (light)
    if (this.slider.querySelectorAll('.product__media-item-image.product__media-item--variant-alt').length > 0) {
      this.sliderItems = this.querySelectorAll('[id^="Slide-"].product__media-item.product__media-item--variant-alt');
    }

    const active = this.slider.querySelector('.is-active');
    if (!active) return;

    const totalVisible = Array.from(this.sliderItems).filter(el => el.clientWidth > 0).length;
    this.totalPages = totalVisible || 1;

    const activeIndex = Array.from(this.sliderItems).indexOf(active);
    if (this.sliderItemOffset) {
      this.currentPage = Math.round(active.offsetLeft / this.sliderItemOffset) + 1;
    } else {
      this.currentPage = activeIndex + 1;
    }

    if (this.currentPageElement && this.pageTotal) {
      if (`${this.currentPageElement.textContent}` !== `${this.currentPage}`) this.currentPageElement.textContent = this.currentPage;
      if (`${this.pageTotal.textContent}` !== `${this.totalPages}`) this.pageTotal.textContent = this.totalPages;
    }

    const buttonsWrap = this.pages.closest('.slider-buttons');
    if (buttonsWrap) buttonsWrap.classList.toggle('visually-hidden', this.totalPages === 1);

    // prev/next disable state (no extra reads)
    if (this.prevButtons?.length && this.nextButtons?.length) {
      const disablePrev = activeIndex <= 0;
      const disableNext = activeIndex >= (this.totalPages - 1);

      this.prevButtons.forEach(btn => btn.toggleAttribute('disabled', disablePrev));
      this.nextButtons.forEach(btn => btn.toggleAttribute('disabled', disableNext));
    }
  }

  disableButtons() {
    if (!this.prevButtons?.length || !this.nextButtons?.length || !this.sliderItems?.length) return;

    const active = this.slider.querySelector('.is-active') || this.sliderItems[0];
    const activeIndex = Array.from(this.sliderItems).indexOf(active);

    const disablePrev = activeIndex <= 0;
    const disableNext = activeIndex >= (this.sliderItems.length - 1);

    this.prevButtons.forEach(btn => btn.toggleAttribute('disabled', disablePrev));
    this.nextButtons.forEach(btn => btn.toggleAttribute('disabled', disableNext));
  }

  changeActiveSlideOnScroll() {
    if (!this.slider || !this.sliderItems?.length) return;

    if (window.pauseAllMedia) window.pauseAllMedia();

    const gallery = this.slider.closest('.gallery-slider');
    if (!gallery) return;

    const sliderLeft = Math.round(gallery.getBoundingClientRect().left);
    let found = null;

    // minimize class toggles: only switch when found
    for (const item of this.sliderItems) {
      const itemLeft = Math.round(item.getBoundingClientRect().left);
      if (Math.abs(sliderLeft - itemLeft) < 7) {
        found = item;
        break;
      }
    }

    if (!found) return;

    const prev = this.slider.querySelector('.is-active');
    if (prev && prev !== found) prev.classList.remove('is-active');
    if (!found.classList.contains('is-active')) found.classList.add('is-active');

    this._scheduleHeight(false);

    if (this.thumbnails) this.scrollThumbnail();

    this.disableButtons();
    this.update();

    const activeIndex = Array.from(this.sliderItems).indexOf(found);
    this.setActiveModel(activeIndex);
  }

  setActiveModel(activeSlideIndex) {
    if (!this.classList.contains('product-gallery')) return;
    if (window.pauseAllMedia) window.pauseAllMedia();

    const item = this.sliderItems?.[activeSlideIndex];
    const activeMediaId = item?.dataset?.mediaId;
    if (activeMediaId) this.toggleXrButton(activeMediaId);
  }

  scrollThumbnail() {
    if (!this.thumbnails || !this.slider) return;

    let mainSlider = this.querySelectorAll('[id^="Slide-"].product__media-item');
    let thumbItems = this.querySelectorAll('[id^="Slide-"].thumbnail-list__item');

    if (this.thumbnails.querySelectorAll('.product__media-item--variant-alt').length > 0) {
      mainSlider = this.querySelectorAll('[id^="Slide-"].product__media-item.product__media-item--variant-alt');
      thumbItems = this.querySelectorAll('[id^="Slide-"].thumbnail-list__item.product__media-item--variant-alt');
    }

    const activeMain = this.slider.querySelector('.is-active');
    const idx = Array.from(mainSlider).indexOf(activeMain);
    const activeThumb = thumbItems[idx];
    if (!activeThumb) return;

    const prev = this.thumbnails.querySelector('.is-active');
    if (prev) prev.classList.remove('is-active');
    activeThumb.classList.add('is-active');

    if (this.thumbnails.classList.contains('flex--column') || this.thumbnails.closest('.thumbnail-slider--top')) {
      const scroller = this.querySelector('.thumbnail-slider');
      if (!scroller) return;
      scroller.scrollTo({
        top: activeThumb.offsetTop - activeThumb.offsetHeight - this.gap,
        behavior: 'smooth'
      });
    } else {
      this.thumbnails.scrollTo({
        left: activeThumb.offsetLeft - activeThumb.offsetWidth - this.gap,
        behavior: 'smooth'
      });
    }
  }

  onButtonClick(direction) {
    if (!this.slider || !this.sliderItems?.length) return;

    // refresh items in variant mode
    if (
      this.slider.classList.contains('variant-images') &&
      this.slider.querySelectorAll('.product__media-item-image.product__media-item--variant-alt').length > 0
    ) {
      this.sliderItems = this.querySelectorAll('[id^="Slide-"].product__media-item.product__media-item--variant-alt');
    }

    const active = this.slider.querySelector('.is-active') || this.sliderItems[0];
    let activeIndex = Array.from(this.sliderItems).indexOf(active);
    if (activeIndex < 0) activeIndex = 0;

    const step = 1;

    let nextIndex = activeIndex;
    if (direction === 'next') {
      nextIndex = Math.min(this.sliderItems.length - 1, activeIndex + step);
    } else {
      nextIndex = Math.max(0, activeIndex - step);
    }

    if (nextIndex === activeIndex) return;

    // toggle classes minimally
    if (active) active.classList.remove('is-active');
    const next = this.sliderItems[nextIndex];
    if (next) next.classList.add('is-active');

    // do scroll write in rAF to batch
    requestAnimationFrame(() => {
      if (!this.slider || !next) return;
      this.resizeImage(next);
      const scrollPosition = theme.config.isRTL ? (this.getBoundingClientRect().width - next.offsetLeft - next.offsetWidth) * -1 : next.offsetLeft;
      this.slider.scrollLeft = scrollPosition;

      if (this.thumbnails) this.scrollThumbnail();
      this.update();
      this.disableButtons();
      this.setActiveModel(nextIndex);
    });

    this.isOnButtonClick = true;
  }

  _needsScrollbarNow() {
    if (!this.scrollbar || !this.scrollbarTrack || !this.scrollbarThumb || !this.slider) return false;
    if (window.innerWidth >= 1025) return false;
    // layout reads (deferred by schedule)
    return this.slider.offsetWidth < this.slider.scrollWidth;
  }

  _scheduleScrollbar(force) {
    if (!this.scrollbar || !this.slider) return;
    if (this._rafScrollbar) return;

    this._rafScrollbar = requestAnimationFrame(() => {
      this._rafScrollbar = 0;
      if (!this.scrollbar || !this.slider) return;

      const need = this._needsScrollbarNow();
      this.scrollbar.classList.toggle('visually-hidden', !need);

      if (!need) {
        this._removeScrollbarListeners();
        return;
      }

      this.setScrollbarWidth();
      this._addScrollbarListeners();
      this.cursorMove();
    });
  }

  _addScrollbarListeners() {
    if (this._scrollbarBound) return;
    if (!this.scrollbar || !this.scrollbarTrack || !this.scrollbarThumb || !this.slider) return;

    this._scrollbarBound = true;

    this.slider.addEventListener('scroll', this._onScrollbarScroll, { passive: true });
    this.scrollbarTrack.addEventListener('mousedown', this._onTrackMouseDown);
    this.scrollbar.addEventListener('click', this._onScrollbarClick);

    document.addEventListener('mouseup', this._onDocMouseUp);
    document.addEventListener('mousemove', this._onDocMouseMove);
  }

  _removeScrollbarListeners() {
    if (!this._scrollbarBound) return;
    this._scrollbarBound = false;

    if (this.slider) this.slider.removeEventListener('scroll', this._onScrollbarScroll);
    if (this.scrollbarTrack) this.scrollbarTrack.removeEventListener('mousedown', this._onTrackMouseDown);
    if (this.scrollbar) this.scrollbar.removeEventListener('click', this._onScrollbarClick);

    document.removeEventListener('mouseup', this._onDocMouseUp);
    document.removeEventListener('mousemove', this._onDocMouseMove);

    this.isDown = false;
    this.isDragging = true;
  }

  _onScrollbarScroll() {
    this.isDragging = true;
    this.cursorMove();
  }

  cursorMaxLeft() {
    if (!this.scrollbarThumb || !this.scrollbarTrack) return 0;
    const thumbW = this.scrollbarThumb.offsetWidth;
    const trackW = this.scrollbarTrack.offsetWidth;
    return Math.max(0, trackW - thumbW);
  }

  cursorMove() {
    if (!this.slider || !this.scrollbarThumb || !this.scrollbarTrack) return;
    if (!this.isDragging) return;

    const denom = (this.slider.scrollWidth - this.slider.clientWidth);
    if (denom <= 0) return;
    const max = this.cursorMaxLeft();
    if (max <= 0) return;

    const scrollRatio = this.slider.scrollLeft / denom;

    if (theme.config.isRTL) {
      const pos = -1 * max * scrollRatio;
      this.scrollbarThumb.style.right = pos + 'px';
      this.scrollbarThumb.style.left = ''; 
    } else {
      const pos = max * scrollRatio;
      this.scrollbarThumb.style.left = pos + 'px';
      this.scrollbarThumb.style.right = '';
    }
  }

  _onTrackMouseDown(e) {
    if (!e.target.closest('.slider-scrollbar__thumb')) return;

    e.preventDefault();
    this.isDragging = false;
    this.isDown = true;

    const max = this.cursorMaxLeft();
    if (theme.config.isRTL) {
      const rightPx = parseFloat(this.scrollbarThumb.style.right) || 0;
      const trackRect = this.scrollbarTrack.getBoundingClientRect();
      const thumbRect = this.scrollbarThumb.getBoundingClientRect();
      const leftInside = thumbRect.left - trackRect.left;
      this.initialLeft = Math.min(Math.max(leftInside, 0), max);
    } else {
      this.initialLeft = this.scrollbarThumb.offsetLeft;
    }
    this.initialX = e.clientX;

    this.slider.style.scrollBehavior = 'unset';
    this.scrollbarThumb.classList.add('dragging');
  }

  _onDocMouseUp() {
    if (!this.isDown) return;

    this.isDown = false;
    this.isDragging = true;

    if (this.slider) this.slider.style.scrollBehavior = 'smooth';
    if (this.scrollbarThumb) this.scrollbarThumb.classList.remove('dragging');
  }

  _onDocMouseMove(e) {
    if (!this.isDown) return;
    if (!this.slider || !this.scrollbarThumb || !this.scrollbarTrack) return;

    e.preventDefault();

    const mouseDeltaX = e.clientX - this.initialX;
    let newLeft = mouseDeltaX + this.initialLeft;

    const max = this.cursorMaxLeft();
    if (max <= 0) return;

    newLeft = Math.min(newLeft, max);
    newLeft = Math.max(newLeft, 0);

    const scrollRatio = max ? (newLeft / max) : 0;

    const denom = (this.slider.scrollWidth - this.slider.clientWidth);
    if (denom <= 0) return;

    if (theme.config.isRTL) {
      this.slider.scrollLeft = - (1 - scrollRatio) * denom;

      const trackW = this.scrollbarTrack.getBoundingClientRect().width || this.scrollbarTrack.offsetWidth || 0;
      const thumbW = this.scrollbarThumb.offsetWidth || 0;
      this.scrollbarThumb.style.right = (trackW - thumbW - newLeft) + 'px';
      this.scrollbarThumb.style.left = '';
    } else {
      this.slider.scrollLeft = scrollRatio * denom;
      this.scrollbarThumb.style.left = newLeft + 'px';
      this.scrollbarThumb.style.right = '';
    }
  }

  setScrollbarWidth() {
    if (!this.slider || !this.scrollbar || !this.scrollbarThumb) return;

    const need = this.slider.offsetWidth < this.slider.scrollWidth;
    this.scrollbar.classList.toggle('visually-hidden', !need);
    if (!need) return;

    const percent = Math.round((this.slider.offsetWidth / this.slider.scrollWidth) * 100);
    this.scrollbarThumb.style.width = percent + '%';
  }

  _onScrollbarClick(e) {
    if (!this.slider || !this.scrollbarThumb || !this.scrollbarTrack) return;
    if (this.isDown) return;
    if (!(e.target === this.scrollbar || e.target === this.scrollbarTrack)) return;

    const trackRect = this.scrollbarTrack.getBoundingClientRect();
    const trackW = trackRect.width || this.scrollbarTrack.offsetWidth || 0;
    const thumbW = this.scrollbarThumb.offsetWidth || 0;

    const clickX = e.clientX - trackRect.left;
    let newLeft = clickX - (thumbW / 2);

    const max = this.cursorMaxLeft();
    if (max <= 0) return;
    newLeft = Math.min(newLeft, max);
    newLeft = Math.max(newLeft, 0);

    const scrollRatio = max ? (newLeft / max) : 0;
    const denom = (this.slider.scrollWidth - this.slider.clientWidth);
    if (denom <= 0) return;

    if (theme.config.isRTL) {
      this.slider.scrollLeft = -1 * (1 - scrollRatio) * denom;
    } else {
      this.slider.scrollLeft = scrollRatio * denom;
    }

    this.cursorMove();
    this.isOnButtonClick = false;
  }

  toggleXrButton(activeMediaId) {
    const xrButtons = document.querySelectorAll('.gallery-slider > .product__xr-button');
    if (!xrButtons || xrButtons.length === 0) return;

    xrButtons.forEach(button => {
      if (!button.classList.contains('product__xr-button--hidden')) {
        button.classList.add('product__xr-button--hidden');
      }
    });

    const activeXrButton = document.querySelector(`.gallery-slider > .product__xr-button[data-media-id="${activeMediaId}"]`);
    if (activeXrButton) activeXrButton.classList.remove('product__xr-button--hidden');
  }
}

customElements.define('product-gallery', ProductGallery);

class ProductRecommendations extends HTMLElement {
  static get observedAttributes() {
    return ['data-url'];
  }

  constructor() {
    super();

    this.observer = null;
    this.isLoading = false;
    this.isLoaded = false;
    this.controller = null;
    this.hasBoundEditorListeners = false;
    this.classList.add('is-loading');
  }

  connectedCallback() {
    const inEditor = !!(window.Shopify && Shopify.designMode);
    if (inEditor) {
      this.bindEditorEventsOnce();
    } else {
      this.ensureObserver();
    }
  }

  disconnectedCallback() {
    this.disconnectObserver();
    this.abortOngoingFetch();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'data-url' && oldVal !== newVal) {
      this.reload();
    }
  }

  bindEditorEventsOnce() {
    if (this.hasBoundEditorListeners) return;
    this.hasBoundEditorListeners = true;

    document.addEventListener('shopify:section:load', (event) => {
      const section = event.target?.closest('section');
      if (!section) return;

      const containsThis = section.contains(this);
      const isRecommendationsSection = section.matches('section.product-recommendations');

      if (containsThis || isRecommendationsSection) {
        this.reload();
      }
    });

    this.ensureObserver();
  }

  ensureObserver() {
    if (this.observer) return;

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      { rootMargin: '0px 0px 400px 0px' }
    );

    this.observer.observe(this);
  }

  disconnectObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  handleIntersection(entries) {
    if (!entries[0].isIntersecting) return;

    this.disconnectObserver();
    this.fetchAndRender();
  }

  reload() {
    this.abortOngoingFetch();
    this.isLoaded = false;
    this.isLoading = false;
    this.classList.add('is-loading');
    this.ensureObserver();
  }

  abortOngoingFetch() {
    if (this.controller) {
      try { this.controller.abort(); } catch (_) {}
      this.controller = null;
    }
  }

  async fetchAndRender() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;

    const url = this.dataset.url;
    if (!url) {
      this.handleNoProductRecommendationsFound();
      this.finishLoading();
      return;
    }

    this.controller = new AbortController();

    try {
      const response = await fetch(url, { signal: this.controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();

      const html = document.createElement('div');
      html.innerHTML = text;

      const recommendations = html.querySelector('product-recommendations');

      const hasContent =
        recommendations &&
        recommendations.innerHTML.trim().length &&
        (!recommendations.querySelector('.section-container') ||
          recommendations.querySelector('.section-container').innerHTML.trim().length);

      if (hasContent) {
        const frag = document.createDocumentFragment();
        const tmp = document.createElement('div');
        tmp.innerHTML = recommendations.innerHTML;

        while (tmp.firstChild) frag.appendChild(tmp.firstChild);

        this.replaceChildren(frag);
      } else {
        this.handleNoProductRecommendationsFound();
      }

      document.dispatchEvent(new CustomEvent('recommendations:loaded'));
      this.isLoaded = true;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('[product-recommendations] fetch error:', e);
      }
    } finally {
      this.finishLoading();
    }
  }

  finishLoading() {
    this.isLoading = false;
    this.controller = null;
    requestAnimationFrame(() => {
      this.classList.remove('is-loading');
    });
  }

  handleNoProductRecommendationsFound() {
    const removeIfEmpty = (element) => {
      if (element && element.childElementCount === 0) {
        element.remove();
      }
    };

    const handleTabSwitching = (tabsBlock, recommendationsId, restId) => {
      const recommendationsTab = tabsBlock.querySelector(`.component-tabs__tab[id^='${recommendationsId}']`);
      const restTab = tabsBlock.querySelector(`.component-tabs__tab[id^='${restId}']`);
      const recommendationsContent = tabsBlock.querySelector(`.component-tabs__content[id^='content-${recommendationsId}']`);
      const restContent = tabsBlock.querySelector(`.component-tabs__content[id^='content-${restId}']`);

      if (restTab && !restTab.classList.contains('disabled')) {
        recommendationsTab?.classList.remove('active');
        recommendationsContent?.classList.remove('active');
        recommendationsTab?.classList.add('disabled');

        recommendationsTab?.remove();
        recommendationsContent?.remove();

        restTab.classList.add('active');
        restContent.classList.add('active');

        if (restTab && tabsBlock.querySelectorAll('.component-tabs__tab').length === 1) {         
          handleFallbackHeading(tabsBlock, restTab);
        }
      } else {
        tabsBlock.remove();
        removeIfEmpty(tabsBlock.closest('.cart-drawer__side-panel') || tabsBlock.closest('.drawer-recommendations'));
      }
    };

    const handleFallbackHeading = (tabsBlock, restTab) => {
      const fallbackHeading = tabsBlock.querySelector('.tabs-block__fallback-heading b') || tabsBlock.querySelector('.tabs-block__fallback-heading');
      const restTabHeading = restTab.querySelector('.tabs-block__heading-wrapper')?.innerHTML;

      if (fallbackHeading) {
        fallbackHeading.innerHTML = restTabHeading || '';
        restTab.remove();
        fallbackHeading.style.display = 'block';
      }
    };

    const sidePanel = this.closest('.cart-drawer__side-panel');

    if (sidePanel) {
      const sidePanelWithoutTabs = this.closest('.cart-drawer__side-panel:has(> product-recommendations)');
      if (sidePanelWithoutTabs) {
        this.remove();
        if (sidePanelWithoutTabs.childElementCount === 0) {
          sidePanelWithoutTabs.remove();
        }
        return;
      }

      const sidePanelProductRecommendationsTabs = this.closest('.tabs-block');
      if (sidePanelProductRecommendationsTabs) {
        handleTabSwitching(sidePanelProductRecommendationsTabs, 'block-1', 'block-2');
        return;
      }
      return;
    }

    const drawerRecommendationsTabs = this.closest('.drawer-recommendations .tabs-block');
    if (drawerRecommendationsTabs) {
      handleTabSwitching(drawerRecommendationsTabs, 'block-1', 'block-2');
      return;
    } 

    const drawerRecommendations = this.closest('.drawer-recommendations');
    if (drawerRecommendations && drawerRecommendations.children.length === 1 && drawerRecommendations.children[0] === this) {
      drawerRecommendations.remove();
      return;
    } 

    this.remove();   
  }
}
customElements.define('product-recommendations', ProductRecommendations);

class SliderComponent extends HTMLElement {
  constructor() {
    super();

    // state
    this._mounted = false;
    this._started = false;
    this._inited = false;
    this._scrollbarBound = false;

    // refs
    this.slider = null;
    this.sliderItems = null;
    this.thumbnails = null;
    this.sliderViewport = null;
    this.prevButton = null;
    this.nextButton = null;

    this.scrollbar = null;
    this.scrollbarTrack = null;
    this.scrollbarThumb = null;

    // flags
    this._isModal = false;
    this._hasButtons = false;
    this._hasScrollbar = false;

    // state
    this.isOnButtonClick = 0;

    // drag state
    this.isDown = false;
    this.isDragging = true;
    this.initialLeft = 0;
    this.initialX = 0;

    // computed
    this.scrollValue = 0;
    this.mobileCount = 1;

    // timers/rafs
    this._rafScroll = 0;
    this._rafResize = 0;
    this._rafActive = 0;
    this._rafDrag = 0;
    this._rafBtn = 0;
    this._rafMeasure = 0;
    this._rafApply = 0;

    this._scrollTimer = null;
    this.adaptSlideHeightTimeout = null;

    // metrics cache (filled after wake)
    this._metrics = {
      clientWidth: 0,
      scrollWidth: 0,
      canScroll: false,
      denom: 0,             // scrollWidth - clientWidth
      parentWidth: 0,
      gap: 0,
      trackWidth: 0,
      thumbPercent: 100,
      cursorMax: 0
    };

    // gap cache (avoid getComputedStyle every time)
    this._gapCached = null; // number|null

    // cache for button state
    this._lastBtnState = { prevDisabled: null, nextDisabled: null, hidden: null };
    this._lastScrollbarWidth = null;

    // wake handlers (NO layout reads)
    this._wake = this._wake.bind(this);
    this._wakeOnPointer = this._wakeOnPointer.bind(this);
    this._wakeOnKey = this._wakeOnKey.bind(this);

    // binds
    this._onResize = this._onResize.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onWheelReset = this._onWheelReset.bind(this);

    // button handlers
    this._onPrevClick = (e) => { e.preventDefault(); e.stopPropagation(); this.onButtonClick('previous'); };
    this._onNextClick = (e) => { e.preventDefault(); e.stopPropagation(); this.onButtonClick('next'); };

    // scrollbar binds
    this._onScrollbarScroll = this._onScrollbarScroll.bind(this);
    this._onScrollbarTrackDown = this._onScrollbarTrackDown.bind(this);
    this._onScrollbarClick = this._onScrollbarClick.bind(this);
    this._onDocMouseUp = this._onDocMouseUp.bind(this);
    this._onDocMouseMove = this._onDocMouseMove.bind(this);

    // shopify hooks
    this._onSectionLoad = null;
    this._onRecommendationsLoaded = null;
    this._onBlockSelect = null;
    this._onImageShow = null;

    // apply scheduler
    this._dirtyButtons = false;
    this._dirtyScrollbar = false;
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    // arm wake listeners only (no init / no measure)
    window.addEventListener('pointerdown', this._wakeOnPointer, { passive: true, once: true });
    window.addEventListener('touchstart', this._wakeOnPointer, { passive: true, once: true });
    window.addEventListener('keydown', this._wakeOnKey, { passive: true, once: true });
    this.addEventListener('focusin', this._wake, { passive: true, once: true });

    this._io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          this._wake();
          break;
        }
      }
    }, { root: null, threshold: 0.01, rootMargin: '100px 0px' });
  
    this._io.observe(this);
  }

  disconnectedCallback() {
    this._mounted = false;

    window.removeEventListener('pointerdown', this._wakeOnPointer);
    window.removeEventListener('touchstart', this._wakeOnPointer);
    window.removeEventListener('keydown', this._wakeOnKey);
    this.removeEventListener('focusin', this._wake);

    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }

    this._teardown();

    this._started = false;
    this._inited = false;
  }

  _wakeOnPointer() { this._wake(); }
  _wakeOnKey() { this._wake(); }

  _wake() {
    if (this._started) return;
    this._started = true;

    window.removeEventListener('pointerdown', this._wakeOnPointer);
    window.removeEventListener('touchstart', this._wakeOnPointer);
    window.removeEventListener('keydown', this._wakeOnKey);

    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }

    this._initHard();
  }

  updateSliderNavigation() {
    if (!this._started) return;

    if (!this._inited) this._initHard();
    if (!this.slider) return;

    this._scheduleMeasure();
    this._dirtyButtons = this._hasButtons;
    this._dirtyScrollbar = this._hasScrollbar;
    this._scheduleApply();
  }

  _initHard() {
    if (this._inited) return;

    this.slider = this.querySelector('[id^="Slider-"]');
    if (!this.slider) return;

    this._inited = true;

    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.thumbnails = this.querySelector('[id^="Slider-Thumbnails"]');
    this.sliderViewport = this.querySelector('.slider__viewport');

    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');

    this.scrollbar = this.querySelector('.slider-scrollbar');
    this.scrollbarTrack = this.querySelector('.slider-scrollbar__track');
    this.scrollbarThumb = this.querySelector('.slider-scrollbar__thumb');

    this._isModal = !!this.slider.closest('.product-media-modal');
    this._isOriginalRatioSlideshowModal = !!this.slider.closest('.product-media-modal--original-ratio-slideshow');
    this._hasButtons = !!(this.prevButton && this.nextButton);
    this._hasScrollbar = !!(this.scrollbar && this.scrollbarTrack && this.scrollbarThumb);

    if (this._isModal) {
      this.slider.style.scrollBehavior = 'auto';

      const filterVariantAltSlides = () => {
        if (!this.slider) return;
        const hasVariantAlt = !!this.slider.querySelector('.product__media-item--variant-alt');
        if (!hasVariantAlt) return;

        const all = Array.from(this.querySelectorAll('[id^="Slide-"]'));
        const filtered = all.filter(el => el.querySelector('.product__media-item--variant-alt'));
        if (filtered.length) this.sliderItems = filtered;
      };

      requestAnimationFrame(filterVariantAltSlides);

      this._onImageShow = () => {
        filterVariantAltSlides();
        this._scheduleMeasure();
        this._dirtyButtons = this._hasButtons;
        this._dirtyScrollbar = this._hasScrollbar;
        this._scheduleApply();
      };
      document.addEventListener('image:show', this._onImageShow);
    }

    if (!this.slider.querySelector('.is-active')) {
      this.sliderItems?.[0]?.classList.add('is-active');
    }

    if (this._hasButtons) {
      this.prevButton.addEventListener('click', this._onPrevClick);
      this.nextButton.addEventListener('click', this._onNextClick);
    }

    window.addEventListener('resize', this._onResize, { passive: true });
    this.slider.addEventListener('scroll', this._onScroll, { passive: true });

    this.slider.addEventListener('wheel', this._onWheelReset, { passive: true });
    this.slider.addEventListener('touchstart', this._onWheelReset, { passive: true });
    this.slider.addEventListener('touchmove', this._onWheelReset, { passive: true });

    this._onSectionLoad = () => {
      if (!this._started) return;
      this._scheduleMeasure();
      this._dirtyButtons = this._hasButtons;
      this._dirtyScrollbar = this._hasScrollbar;
      this._scheduleApply();
    };
    document.addEventListener('shopify:section:load', this._onSectionLoad);

    this._onRecommendationsLoaded = () => {
      if (!this._started) return;
      this._scheduleMeasure();
      this._dirtyButtons = this._hasButtons;
      this._dirtyScrollbar = this._hasScrollbar;
      this._scheduleApply();
    };
    document.addEventListener('recommendations:loaded', this._onRecommendationsLoaded);

    if (this.closest('.scroll-to-block') && Shopify.designMode) {
      this._onBlockSelect = (event) => {
        const activeBlock = event.target;
        if (!activeBlock?.getAttribute) return;
        if (!this.querySelector(`#${activeBlock.getAttribute('id')}`)) return;

        const activeSlide = this.slider.querySelector('.is-active');
        if (!activeSlide) return;

        activeSlide.classList.remove('is-active');
        activeBlock.classList.add('is-active');

        const idx = Array.from(this.sliderItems).indexOf(activeBlock);
        if (idx >= 0 && this.sliderItems[idx]) {
          this.slider.scrollLeft = this.sliderItems[idx].offsetLeft;
        }

        this._scheduleMeasure();
        this._dirtyButtons = this._hasButtons;
        this._dirtyScrollbar = this._hasScrollbar;
        this._scheduleApply();
      };
      document.addEventListener('shopify:block:select', this._onBlockSelect);
    }

    this._scheduleMeasure();
    this._dirtyButtons = this._hasButtons;
    this._dirtyScrollbar = this._hasScrollbar;
    this._scheduleApply();
  }

  _teardown() {
    if (!this.slider) return;

    if (this._hasButtons) {
      this.prevButton?.removeEventListener('click', this._onPrevClick);
      this.nextButton?.removeEventListener('click', this._onNextClick);
    }

    window.removeEventListener('resize', this._onResize);

    this.slider.removeEventListener('scroll', this._onScroll);
    this.slider.removeEventListener('wheel', this._onWheelReset);
    this.slider.removeEventListener('touchstart', this._onWheelReset);
    this.slider.removeEventListener('touchmove', this._onWheelReset);

    if (this._hasScrollbar) this._removeScrollbarListeners();

    if (this._onSectionLoad) {
      document.removeEventListener('shopify:section:load', this._onSectionLoad);
      this._onSectionLoad = null;
    }
    if (this._onRecommendationsLoaded) {
      document.removeEventListener('recommendations:loaded', this._onRecommendationsLoaded);
      this._onRecommendationsLoaded = null;
    }
    if (this._onBlockSelect) {
      document.removeEventListener('shopify:block:select', this._onBlockSelect);
      this._onBlockSelect = null;
    }
    if (this._onImageShow) {
      document.removeEventListener('image:show', this._onImageShow);
      this._onImageShow = null;
    }

    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
      this._scrollTimer = null;
    }
    if (this.adaptSlideHeightTimeout) {
      clearTimeout(this.adaptSlideHeightTimeout);
      this.adaptSlideHeightTimeout = null;
    }

    if (this._rafScroll) cancelAnimationFrame(this._rafScroll);
    if (this._rafResize) cancelAnimationFrame(this._rafResize);
    if (this._rafActive) cancelAnimationFrame(this._rafActive);
    if (this._rafDrag) cancelAnimationFrame(this._rafDrag);
    if (this._rafBtn) cancelAnimationFrame(this._rafBtn);
    if (this._rafMeasure) cancelAnimationFrame(this._rafMeasure);
    if (this._rafApply) cancelAnimationFrame(this._rafApply);

    this._rafScroll = this._rafResize = this._rafActive = this._rafDrag = this._rafBtn = this._rafMeasure = this._rafApply = 0;

    this.slider = null;
    this.sliderItems = null;
    this.thumbnails = null;
    this.sliderViewport = null;
    this.prevButton = null;
    this.nextButton = null;
    this.scrollbar = null;
    this.scrollbarTrack = null;
    this.scrollbarThumb = null;

    this._metrics = {
      clientWidth: 0,
      scrollWidth: 0,
      canScroll: false,
      denom: 0,
      parentWidth: 0,
      gap: 0,
      trackWidth: 0,
      thumbPercent: 100,
      cursorMax: 0
    };
    this._gapCached = null;

    this._lastBtnState = { prevDisabled: null, nextDisabled: null, hidden: null };
    this._lastScrollbarWidth = null;

    this._dirtyButtons = false;
    this._dirtyScrollbar = false;
  }

  _scheduleMeasure() {
    if (this._rafMeasure) return;
    this._rafMeasure = requestAnimationFrame(() => {
      this._rafMeasure = 0;
      this._measureOnly();
    });
  }

  _scheduleApply() {
    if (this._rafApply) return;
    this._rafApply = requestAnimationFrame(() => {
      this._rafApply = 0;
      this._applyOnly();
    });
  }

  _measureOnly() {
    if (!this.slider) return;

    const clientWidth = this.slider.clientWidth;
    const scrollWidth = this.slider.scrollWidth;

    const parentWidth = this.slider.parentElement?.clientWidth || clientWidth || 0;

    let gap = 0;

    const dataGap = this.slider.dataset.gap;
    if (dataGap != null && dataGap !== '') {
      gap = +dataGap || 0;
    } else {
      const cssVar = this.slider.style.getPropertyValue('--slider-column-gap') || this.style?.getPropertyValue?.('--slider-column-gap');
      if (cssVar) {
        const n = parseFloat(cssVar);
        gap = Number.isFinite(n) ? n : 0;
      } else if (this._gapCached != null) {
        gap = this._gapCached;
      } else {
        try {
          const v = window.getComputedStyle(this.slider).getPropertyValue('column-gap');
          const n = parseFloat(v);
          gap = Number.isFinite(n) ? n : 0;
          this._gapCached = gap;
        } catch (e) {
          gap = 0;
          this._gapCached = 0;
        }
      }
    }

    let trackWidth = 0;
    if (this._hasScrollbar && this.scrollbarTrack) {
      trackWidth = this.scrollbarTrack.getBoundingClientRect().width || 0;
    }

    this._metrics.clientWidth = clientWidth;
    this._metrics.scrollWidth = scrollWidth;
    this._metrics.canScroll = (clientWidth + 1 < scrollWidth);
    this._metrics.denom = Math.max(0, scrollWidth - clientWidth);

    this._metrics.parentWidth = parentWidth;
    this._metrics.gap = gap;
    this._metrics.trackWidth = trackWidth;

    this._setMobileCountFromCache();

    if (this._hasScrollbar) {
      const percent = scrollWidth
        ? Math.round((clientWidth / scrollWidth) * 100)
        : 100;

      this._metrics.thumbPercent = percent;

      const thumbPx = trackWidth ? (trackWidth * (percent / 100)) : 0;
      this._metrics.cursorMax = Math.max(0, trackWidth - thumbPx);
    }
  }

  _setMobileCountFromCache() {
    if (!this.slider) return;

    const mobileItemWidth = +this.slider.dataset.mobileWidth || 1;
    const parentWidth = this._metrics.parentWidth || this._metrics.clientWidth || 0;
    const gap = this._metrics.gap || 0;

    const items = parentWidth / mobileItemWidth;
    const gaps = gap * Math.round(items - 1);

    this.mobileCount = Math.max(1, Math.floor((parentWidth - gaps) / mobileItemWidth));

    if (this.slider.closest('.slider-in-product-modal')) {
      this.mobileCount = +this.slider.dataset.countMobile || this.mobileCount;
    }
  }

  _applyOnly() {
    if (!this.slider) return;

    if (this._dirtyButtons && this._hasButtons) {
      this._dirtyButtons = false;
      this._applyButtonsFromCache();
    }

    if (this._dirtyScrollbar && this._hasScrollbar) {
      this._dirtyScrollbar = false;
      this._applyScrollbarFromCache();
    }
  }

  _applyButtonsFromCache() {
    if (!this._hasButtons || !this.slider) return;

    const canScroll = this._metrics.canScroll;

    const hidden = !canScroll;
    if (this._lastBtnState.hidden !== hidden) {
      this._lastBtnState.hidden = hidden;
      this.prevButton.classList.toggle('visually-hidden', hidden);
      this.nextButton.classList.toggle('visually-hidden', hidden);
    }

    if (!canScroll) {
      if (this._lastBtnState.prevDisabled !== true) {
        this._lastBtnState.prevDisabled = true;
        this.prevButton.toggleAttribute('disabled', true);
      }
      if (this._lastBtnState.nextDisabled !== true) {
        this._lastBtnState.nextDisabled = true;
        this.nextButton.toggleAttribute('disabled', true);
      }
      return;
    }

    const isRTL = !!theme?.config?.isRTL;
    const left = this.slider.scrollLeft;

    const cw = this._metrics.clientWidth;
    const sw = this._metrics.scrollWidth;

    let disablePrev = false;
    let disableNext = false;

    if (isRTL) {
      disablePrev = Math.ceil(left) === 0;
      disableNext = (Math.abs(Math.round(left)) + cw + 1) >= sw;
    } else {
      disablePrev = left <= 0;
      disableNext = (Math.round(left) + cw + 1) >= sw;
    }

    if (this._lastBtnState.prevDisabled !== disablePrev) {
      this._lastBtnState.prevDisabled = disablePrev;
      this.prevButton.toggleAttribute('disabled', disablePrev);
    }
    if (this._lastBtnState.nextDisabled !== disableNext) {
      this._lastBtnState.nextDisabled = disableNext;
      this.nextButton.toggleAttribute('disabled', disableNext);
    }
  }

  _scheduleButtonUpdate() {
    if (!this._hasButtons) return;
    this._dirtyButtons = true;
    this._scheduleApply();
  }

  _applyScrollbarFromCache() {
    if (!this._hasScrollbar || !this.slider) return;

    const needs = this._metrics.canScroll;

    this.scrollbar.classList.toggle('visually-hidden', !needs);

    if (!needs) {
      this._removeScrollbarListeners();
      return;
    }

    const percent = this._metrics.thumbPercent || 100;

    if (this._lastScrollbarWidth !== percent) {
      this._lastScrollbarWidth = percent;
      this.scrollbarThumb.style.width = percent + '%';
    }

    this._addScrollbarListeners();
    this._scheduleScrollbarCursorMove();
  }

  _onResize() {
    if (this._rafResize) return;
    this._rafResize = requestAnimationFrame(() => {
      this._rafResize = 0;
      this._scheduleMeasure();
      this._dirtyButtons = this._hasButtons;
      this._dirtyScrollbar = this._hasScrollbar;
      this._scheduleApply();
    });
  }

  _onWheelReset() {
    this.isOnButtonClick = 0;
  }

  _onScroll() {
    if (!this.slider) return;

    if (this._rafScroll) return;
    this._rafScroll = requestAnimationFrame(() => {
      this._rafScroll = 0;

      if (this.isOnButtonClick === 0) {
        this._scheduleActiveOnScroll();
      }

      if (this._hasButtons) this._scheduleButtonUpdate();

      if (this._isModal && this.isOnButtonClick == 0) {
        if (!this._modalScrollStarted) {
          this._modalScrollStarted = true;
          this.resetModalScroll();
        }

        if (this._modalScrollEndTimer) clearTimeout(this._modalScrollEndTimer);
        this._modalScrollEndTimer = setTimeout(() => {
          this._modalScrollStarted = false;
        }, 150);
      }

      if (this._hasScrollbar) this._scheduleScrollbarCursorMove();
    });
  }

  _scheduleActiveOnScroll() {
    if (this._rafActive) return;
    this._rafActive = requestAnimationFrame(() => {
      this._rafActive = 0;
      this.changeActiveSlideOnScroll();
    });
  }

  changeActiveSlideOnScroll() {
    if (!this.sliderViewport || !this.sliderItems?.length) return;

    let sliderLeft = Math.round(this.sliderViewport.getBoundingClientRect().left);
    let newActiveSlide = null;
  
    this.sliderItems.forEach((item) => {
      let sliderItemLeft = Math.round(item.getBoundingClientRect().left);
  
      if (Math.abs(sliderLeft - sliderItemLeft) < (item.offsetWidth / 2)) {
        newActiveSlide = item;
      }
    });
  
    if (!newActiveSlide) return;
    if (this._lastActiveSlide === newActiveSlide) return;

    this.sliderItems.forEach((item) => item.classList.remove('is-active'));
    newActiveSlide.classList.add('is-active');
  
    this._lastActiveSlide = newActiveSlide;
  
    if (this._isOriginalRatioSlideshowModal) {
      this.adaptSliderHeight(newActiveSlide);
    }
  }

  resetModalScroll() {
    clearTimeout(this.adaptSlideHeightTimeout);
    const modalContent = this.closest('.product-media-modal__content');
    if (!modalContent) return;
    modalContent.scrollTo({ top: 0, behavior: 'smooth' });
  }

  adaptSliderHeight(activeSlide) {
    const slideTransitionSpeed = 450;

    if (typeof activeSlide === 'number') {
      activeSlide = this.sliderItems?.[activeSlide];
    }
    if (!activeSlide) return;

    this.adaptSlideHeightTimeout = setTimeout(() => {
      const grid = this.querySelector('.slider__grid');
      if (!grid) return;
      grid.style.setProperty('height', activeSlide.offsetHeight + 'px');
    }, slideTransitionSpeed);
  }

  onButtonClick(direction) {
    if (!this._started) this._wake();
    if (!this.slider || !this.sliderItems?.length) return;

    if (this._isModal) this.resetModalScroll();

    this.slider.style.scrollBehavior = 'smooth';

    this.activeSlide = this.slider.querySelector('.is-active') || this.sliderItems[0];
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide);
    if (activeSlideIndex < 0) activeSlideIndex = 0;

    let dataCount = +this.slider.dataset.count || 1;
    if (this.slider.dataset.count == 8 && window.innerWidth < 1601) dataCount = 7;
    if ((this.slider.dataset.count >= 7) && window.innerWidth < 1401) dataCount = 6;
    if ((this.slider.dataset.count >= 6) && window.innerWidth < 1301) dataCount = 5;
    if ((this.slider.dataset.count >= 5) && window.innerWidth < 1101) dataCount = 4;
    if (window.innerWidth < 1025) dataCount = this.mobileCount;

    const step = Math.max(1, +dataCount);
    const isRTL = !!theme?.config?.isRTL;

    if (direction === 'next') {
      const last = this.sliderItems.length - 1;
      activeSlideIndex = Math.min(last, activeSlideIndex + step);
      activeSlideIndex = Math.min(activeSlideIndex, this.sliderItems.length - step);

      this.activeSlide?.classList.remove('is-active');
      this.sliderItems[activeSlideIndex]?.classList.add('is-active');

      requestAnimationFrame(() => {
        const target = this.sliderItems?.[activeSlideIndex];
        if (!target) return;

        const scrollPosition = isRTL
          ? (this.getBoundingClientRect().width - target.offsetLeft - target.offsetWidth) * -1
          : target.offsetLeft;

        this.slider.scrollLeft = scrollPosition;
        this._scheduleButtonUpdate();
      });
    }

    if (direction === 'previous') {
      activeSlideIndex = Math.max(0, activeSlideIndex - step);

      this.activeSlide?.classList.remove('is-active');
      this.sliderItems[activeSlideIndex]?.classList.add('is-active');

      const target = this.sliderItems?.[activeSlideIndex];
      if (target) {
        const scrollPosition = isRTL
          ? (this.getBoundingClientRect().width - target.offsetLeft - target.offsetWidth) * -1
          : target.offsetLeft;

        this.slider.scrollLeft = scrollPosition;
        this._scheduleButtonUpdate();
      }
    }

    this.isOnButtonClick = 'onButtonClick';

    if (this._isOriginalRatioSlideshowModal) this.adaptSliderHeight(activeSlideIndex);
    if (this._hasScrollbar) this._scheduleScrollbarCursorMove();
  }

  _addScrollbarListeners() {
    if (this._scrollbarBound) return;
    this._scrollbarBound = true;

    this.slider.addEventListener('scroll', this._onScrollbarScroll, { passive: true });
    this.scrollbarTrack.addEventListener('mousedown', this._onScrollbarTrackDown);
    this.scrollbar.addEventListener('click', this._onScrollbarClick);

    document.addEventListener('mouseup', this._onDocMouseUp);
    document.addEventListener('mousemove', this._onDocMouseMove);
  }

  _removeScrollbarListeners() {
    if (!this._scrollbarBound) return;
    this._scrollbarBound = false;

    this.slider.removeEventListener('scroll', this._onScrollbarScroll);
    this.scrollbarTrack.removeEventListener('mousedown', this._onScrollbarTrackDown);
    this.scrollbar.removeEventListener('click', this._onScrollbarClick);

    document.removeEventListener('mouseup', this._onDocMouseUp);
    document.removeEventListener('mousemove', this._onDocMouseMove);

    this.isDown = false;
    this.isDragging = true;
  }

  _onScrollbarScroll() {
    this._scheduleScrollbarCursorMove();
  }

  _scheduleScrollbarCursorMove() {
    if (!this._hasScrollbar || !this.slider) return;
    if (this._rafDrag) return;

    this._rafDrag = requestAnimationFrame(() => {
      this._rafDrag = 0;
      this.cursorMove();
    });
  }

  cursorMove() {
    if (!this.slider || !this.scrollbarThumb || !this.scrollbarTrack) return;
    if (!this.isDragging) return;

    const denom = this._metrics.denom;
    if (denom <= 0) return;

    const scrollRatio = this.slider.scrollLeft / denom;
    const max = this._metrics.cursorMax || 0;
    if (max <= 0) return;

    if (theme?.config?.isRTL) {
      const pos = -1 * max * scrollRatio;
      this.scrollbarThumb.style.right = pos + 'px';
    } else {
      const pos = max * scrollRatio;
      this.scrollbarThumb.style.left = pos + 'px';
    }
  }

  _onScrollbarTrackDown(e) {
    if (!e.target.closest('.slider-scrollbar__thumb')) return;

    e.preventDefault();

    this.isDragging = false;
    this.isDown = true;

    this.initialLeft = this.scrollbarThumb.offsetLeft; // ok on drag start only
    this.initialX = e.clientX;

    this.slider.style.scrollBehavior = 'unset';
    this.scrollbarThumb.classList.add('dragging');
  }

  _onDocMouseUp() {
    if (!this.isDown) return;

    this.isDown = false;
    this.isDragging = true;

    this.slider.style.scrollBehavior = 'smooth';
    this.scrollbarThumb.classList.remove('dragging');
  }

  _onDocMouseMove(e) {
    if (!this.isDown) return;
    if (!this.slider || !this.scrollbarThumb || !this.scrollbarTrack) return;

    e.preventDefault();

    const mouseDeltaX = e.clientX - this.initialX;

    let newLeft = mouseDeltaX + this.initialLeft;
    const max = this._metrics.cursorMax || 0;
    if (max <= 0) return;

    newLeft = Math.min(newLeft, max);
    newLeft = Math.max(newLeft, 0);

    const scrollRatio = max ? (newLeft / max) : 0;

    const denom = this._metrics.denom;
    if (denom <= 0) return;

    if (theme?.config?.isRTL) {
      this.slider.scrollLeft = - (1 - scrollRatio) * denom;
      const trackWidth = this._metrics.trackWidth || 0;
      const thumbPx = trackWidth ? (trackWidth * ((this._metrics.thumbPercent || 100) / 100)) : 0;
      this.scrollbarThumb.style.right = (trackWidth - thumbPx - newLeft) + 'px';
    } else {
      this.slider.scrollLeft = scrollRatio * denom;
      this.scrollbarThumb.style.left = newLeft + 'px';
    }
  }

  _onScrollbarClick(e) {
    if (!this.slider || !this.scrollbarThumb || !this.scrollbarTrack) return;

    if (this.isDown) return;
    if (!(e.target === this.scrollbar || e.target === this.scrollbarTrack)) return;

    const trackWidth = this._metrics.trackWidth || this.scrollbarTrack.getBoundingClientRect().width || 0;
    const thumbPx = trackWidth ? (trackWidth * ((this._metrics.thumbPercent || 100) / 100)) : 0;

    let newLeft = e.clientX - (thumbPx / 2);

    const max = this._metrics.cursorMax || 0;
    if (max <= 0) return;

    newLeft = Math.min(newLeft, max);
    newLeft = Math.max(newLeft, 0);

    const scrollRatio = max ? (newLeft / max) : 0;

    const denom = this._metrics.denom;
    if (denom <= 0) return;

    if (theme?.config?.isRTL) {
      this.slider.scrollLeft = -1 * (1 - scrollRatio) * denom;
    } else {
      this.slider.scrollLeft = scrollRatio * denom;
    }

    this.cursorMove();
    this.isOnButtonClick = 0;
  }
}

customElements.define('slider-component', SliderComponent);

class LocalizationForm extends HTMLElement {
  constructor() {
    super();
    this.elements = {
      input: this.querySelector('input[name="locale_code"], input[name="country_code"]'),
      searchInput: this.querySelector('.localization-search__input'),
      inputLanguage: this.querySelector('input[name="locale_code"]'),
      button: this.querySelector('button'),
      panel: this.querySelector('.disclosure__list-wrapper'),
      listItems: this.querySelectorAll('.disclosure__item'),
      localizations: document.querySelectorAll('.disclosure'),
      clearButton: this.querySelector('.localization-search__button'),
      clearButtonText: this.querySelector('.localization-search__button-text')
    };
    if (!this.className.includes('localization-form-drawer')) {
      this.elements.button.addEventListener('click', this.toggleSelector.bind(this));
      this.addEventListener('keyup', this.onContainerKeyUp.bind(this));
    this.addEventListener('focusout', this.closeSelector.bind(this));
      this.parent = this.elements.button.closest('.shopify-section').querySelector('div')
      if(this.elements.button.closest('.shopify-section').querySelector('.scroll-area')) this.parent = this.elements.button.closest('.shopify-section').querySelector('.scroll-area')
      this.parent.addEventListener('scroll', this.hidePanel.bind(this))
      document.addEventListener('scroll', this.hidePanel.bind(this))
      document.addEventListener('click', (event) => {
        this.elements.localizations.forEach(localization => {
          if(localization.querySelector('button').getAttribute('aria-expanded') == 'true' && (event.target.closest('.disclosure') != localization)) {
              localization.querySelector('button').setAttribute('aria-expanded', 'false');
              localization.querySelector('.disclosure__list-wrapper').style.top = 'auto'
              localization.querySelector('.disclosure__list-wrapper').style.left = 'auto'
              if(document.body.className.includes('localization-opened')) document.body.classList.remove('localization-opened')
          }
        })
      })
    }
    this.querySelectorAll('a').forEach(item => item.addEventListener('click', this.onItemClick.bind(this)));
    if (this.elements.searchInput) this.elements.searchInput.addEventListener('input', this.filterCountries.bind(this));
    
  }

  filterCountries(event) {
    const searchTerm = event.target.value.toLowerCase();
    const spinner = this.querySelector('.loading-overlay__spinner');
    spinner.classList.remove('hidden');

    if(!this.elements.clearButtonText.className.includes('visually-hidden')) this.elements.clearButtonText.classList.add('visually-hidden')

    setTimeout(() => {
      this.elements.listItems.forEach(item => {
        const countryName = item.querySelector('a').dataset.country;
        if (countryName.includes(searchTerm)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
      spinner.classList.add('hidden');
      if (searchTerm !== '') this.elements.clearButtonText.classList.remove('visually-hidden');
    }, 500);

    this.elements.clearButton.addEventListener('click', this.clearSearch.bind(this));
  }

  clearSearch() {
    const searchInput = this.querySelector('.localization-search__input');
    searchInput.value = '';
    this.elements.clearButtonText.classList.add('visually-hidden');
    this.elements.listItems.forEach(item => item.style.display = '');
  }
  
  alignPanel() {
    this.isOpen = JSON.parse(this.elements.button.getAttribute('aria-expanded'))
    this.buttonCoordinate = this.elements.button.getBoundingClientRect()
    this.viewportHeight = window.innerHeight
    this.viewportWidth = window.innerWidth
    this.elementCoordinate = this.elements.panel.getBoundingClientRect()
    const panelHeight = this.elements.panel.offsetHeight;
    const panelWidth = this.elements.panel.offsetWidth;
    const spaceBelow = this.viewportHeight - this.buttonCoordinate.bottom;
    const spaceAbove = this.buttonCoordinate.top;

    if (this.closest('.header--disable-stick') || this.closest('.footer')) {
      if (theme.config.isRTL) {
        if (this.elementCoordinate.right > this.viewportWidth - 16) this.elements.panel.style.left = this.viewportWidth - this.elementCoordinate.left - panelWidth - 16 + 'px'
      } else {
        if (this.elementCoordinate.left < 0) this.elements.panel.style.right = this.elementCoordinate.left - 16 + 'px'
      }

      if (this.elementCoordinate.bottom > this.viewportHeight) {
        this.elements.panel.style.bottom = '100%'
        this.elements.panel.style.top = 'auto'
      }
    } else {
      if (spaceBelow >= panelHeight) {
        this.elements.panel.style.top = `${this.buttonCoordinate.bottom}px`;
      } else if (spaceAbove >= panelHeight) {
        this.elements.panel.style.top = `${this.buttonCoordinate.top - panelHeight}px`;
      } else {
        this.elements.panel.style.top = spaceBelow > spaceAbove
            ? `${this.buttonCoordinate.bottom}px`
            : `${this.buttonCoordinate.top - panelHeight}px`;
      }

      if (theme.config.isRTL) {
        this.elementCoordinate.right > this.viewportWidth - 30
          ? this.elements.panel.style.left = `${this.viewportWidth - panelWidth  - 24}px`
          : this.elements.panel.style.left = `${this.buttonCoordinate.left}px`;
      } else {
        this.elementCoordinate.left < 30 
          ? this.elements.panel.style.left = 24 + 'px'  
          : this.elements.panel.style.left = this.buttonCoordinate.right - this.elements.panel.offsetWidth + 'px'
      }

      if (this.elementCoordinate.left < 30 && !this.isOpen) {
        this.elements.panel.style.left = '24px'
      }
      
      if (!this.isOpen) {
        this.elements.panel.style.top = 'auto'
        this.elements.panel.style.left = 'auto'
      }
    }
  }

  hidePanel() {
    if (this.elements.button.getAttribute('aria-expanded') == 'false') return
    this.elements.button.setAttribute('aria-expanded', 'false');
    if(document.body.className.includes('localization-opened')) document.body.classList.remove('localization-opened')
  }

  onContainerKeyUp(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;
    this.hidePanel();
    this.elements.button.focus();
  }

  onItemClick(event) {
    event.preventDefault();
    const form = this.querySelector('form');
    this.elements.input.value = event.currentTarget.dataset.value;
    if (form) form.submit();
  }

  toggleSelector() {
    if (event.target.closest('.disclosure__list-wrapper')) return
    this.elements.button.focus();
    if(this.elements.button.getAttribute('aria-expanded') == 'false') {
      this.elements.button.setAttribute('aria-expanded', 'true')
      if(this.closest('.header')) document.body.classList.add('localization-opened')
      if (this.elements.searchInput) this.elements.searchInput.focus()
    } else {
      this.elements.button.setAttribute('aria-expanded', 'false')
      if(this.closest('.header')) document.body.classList.remove('localization-opened')
    }
    setTimeout(this.alignPanel(), 20)
  }
  closeSelector(event) {
    if (event.relatedTarget && !event.relatedTarget.closest('.disclosure__list-wrapper')) {
      this.hidePanel();
      this.elements.button.querySelectorAll('.disclosure__button-icon').forEach(item => item.classList.remove('open'));
    }
  }
}
customElements.define('localization-form', LocalizationForm);

const lockDropdownCount = new WeakMap();
class DetailsDropdown extends HTMLElement {
  constructor() {
    super();

    // refs
    this.summaryElement = null;
    this.contentElement = null;
    this.button = null;
    this.megaMenu = null;
    this.header = null;

    // state
    this.isOpen = this.hasAttribute('open');
    this.hoverTimeout = null;

    // storage
    this.cookieName = 'volume-theme:active-category';
    this.cookieUrl = 'volume-theme:active-category-url';

    // header groups
    this.headerGroup1 = null;
    this.headerGroup2 = null;
    this.headerGroup3 = null;
    this.headerGroupHeight = 0;

    this._cache = {
      scrollHeight: null,          // --scroll-height
      headerStickyHeight: null,    // --header-sticky-height
      announcementBarHeight: null, // --announcement-bar-height
      offsetTop: null,             // --offset-top
      megaMenuTop: null,           // boolean
      _zone: null                  // internal state machine for alignedMenu
    };

    // rAF
    this._rafAligned = 0;
    this._rafSticky = 0;
    this._rafInit = 0;

    // scroll
    this._pendingScrollTop = 0;
    this.SCROLL_QUANT = 4;

    // one-time init guard
    this._didInit = false;

    // binds
    this.onSummaryClickedBound = this.onSummaryClicked.bind(this);
    this.onSummaryKeydownBound = this.onSummaryKeydown.bind(this);

    this.detectClickOutsideListener = this.detectClickOutside.bind(this);
    this.detectEscKeyboardListener = this.detectEscKeyboard.bind(this);
    this.detectFocusOutListener = this.detectFocusOut.bind(this);
    this.detectHoverListenerBound = this.detectHover.bind(this);

    this.onMegaMenuClickedBound = this.onMegaMenuClicked.bind(this);
    this.initBound = this.init.bind(this);

    this._onAlignedScroll = this._onAlignedScroll.bind(this);
    this.closeAnnouncementBarMenuHandler = this.closeAnnouncementBarMenu.bind(this);

    this._onDropdownIconKeyup = () => {
      document.dispatchEvent(new CustomEvent('menu-visible'));
    };

    // lazy intent init
    this._wakeInitOnce = () => this._ensureInit('intent');

    if (lockDropdownCount.get(DetailsDropdown) == null) {
      lockDropdownCount.set(DetailsDropdown, 0);
    }
  }

  connectedCallback() {
    this.summaryElement = this.firstElementChild;
    this.contentElement = this.lastElementChild;
    if (!this.summaryElement || !this.contentElement) return;

    this.button = this.contentElement.querySelector('button');
    this.megaMenu = this.querySelector('.mega-menu');
    this.header = document.querySelector('.shopify-section-header');

    this.summaryElement.addEventListener('click', this.onSummaryClickedBound);
    this.summaryElement.addEventListener('menu-visible', this.onSummaryClickedBound);
    this.summaryElement.addEventListener('keyup', this.onSummaryKeydownBound);

    const icon = this.summaryElement.querySelector('.dropdown-icon');
    if (icon) icon.addEventListener('keyup', this._onDropdownIconKeyup);

    if (this.button) this.button.addEventListener('click', this.onSummaryClickedBound);

    this.addEventListener('mouseenter', this.detectHoverListenerBound);
    this.addEventListener('mouseleave', this.detectHoverListenerBound);

    window.addEventListener('resize', this.initBound, { passive: true });

    this._onSectionLoad = (event) => {
      if (event.target.closest('.shopify-section-header') || event.target.closest('.shopify-section-announcement-bar')) {
        this._didInit = false;
        this.init();
      }
    };
    this._onSectionUnload = (event) => {
      if (event.target.closest('.shopify-section-header') || event.target.closest('.shopify-section-announcement-bar')) {
        this._didInit = false;
        this.init();
      }
    };

    document.addEventListener('shopify:section:load', this._onSectionLoad);
    document.addEventListener('shopify:section:unload', this._onSectionUnload);

    this.currentLink = document.querySelector('[data-status="parent"] .active-parent-link.link--current');
    if (this.currentLink) this.setActiveCategory(this.currentLink);

    setTimeout(() => this.initActiveCategory(), 0);
    if (this.isOpen) {
      this._ensureInit('open-on-load');
      this._scheduleAlignedMenu(true);
      this._scheduleMeasureStickyBottom(true);
      if (this.contentElement.classList.contains('mega-menu')) this._addAlignedScrollListener();
    } else {
      this.summaryElement.addEventListener('pointerenter', this._wakeInitOnce, { once: true, passive: true });
      this.summaryElement.addEventListener('pointerdown', this._wakeInitOnce, { once: true, passive: true });
      this.summaryElement.addEventListener('focusin', this._wakeInitOnce, { once: true, passive: true });
    }
  }

  disconnectedCallback() {
    if (this._rafAligned) cancelAnimationFrame(this._rafAligned);
    if (this._rafSticky) cancelAnimationFrame(this._rafSticky);
    if (this._rafInit) cancelAnimationFrame(this._rafInit);
    this._rafAligned = 0;
    this._rafSticky = 0;
    this._rafInit = 0;

    if (this.summaryElement) {
      this.summaryElement.removeEventListener('click', this.onSummaryClickedBound);
      this.summaryElement.removeEventListener('menu-visible', this.onSummaryClickedBound);
      this.summaryElement.removeEventListener('keyup', this.onSummaryKeydownBound);

      this.summaryElement.removeEventListener('pointerenter', this._wakeInitOnce);
      this.summaryElement.removeEventListener('pointerdown', this._wakeInitOnce);
      this.summaryElement.removeEventListener('focusin', this._wakeInitOnce);

      const icon = this.summaryElement.querySelector('.dropdown-icon');
      if (icon) icon.removeEventListener('keyup', this._onDropdownIconKeyup);
    }

    if (this.button) this.button.removeEventListener('click', this.onSummaryClickedBound);

    this.removeEventListener('mouseenter', this.detectHoverListenerBound);
    this.removeEventListener('mouseleave', this.detectHoverListenerBound);

    window.removeEventListener('resize', this.initBound);

    document.removeEventListener('click', this.detectClickOutsideListener);
    document.removeEventListener('keydown', this.detectEscKeyboardListener);
    document.removeEventListener('focusout', this.detectFocusOutListener);

    document.removeEventListener('scroll', this.closeAnnouncementBarMenuHandler);
    this._removeAlignedScrollListener();

    if (this.megaMenu) this.megaMenu.removeEventListener('click', this.onMegaMenuClickedBound);

    if (this._onSectionLoad) document.removeEventListener('shopify:section:load', this._onSectionLoad);
    if (this._onSectionUnload) document.removeEventListener('shopify:section:unload', this._onSectionUnload);
    this._onSectionLoad = null;
    this._onSectionUnload = null;
  }

  _ensureInit(_reason) {
    if (this._didInit) return;
    this._didInit = true;

    if (this._rafInit) return;
    this._rafInit = requestAnimationFrame(() => {
      this._rafInit = 0;
      this.init();
    });
  }

  init() {
    this.megaMenu = this.querySelector('.mega-menu');
    this.header = document.querySelector('.shopify-section-header');
    if (!this.megaMenu || !this.header) return;

    this.megaMenu.removeEventListener('click', this.onMegaMenuClickedBound);
    this.megaMenu.addEventListener('click', this.onMegaMenuClickedBound);

    this._measureHeaderGroups();
    if (this.isOpen && this.contentElement.classList.contains('mega-menu')) {
      this._measureAnnouncementBarVars();
    }

    if (this.isOpen && this._needsStickyHeightVar()) {
      this._scheduleMeasureStickyBottom(true);
    }
  }

  _needsStickyHeightVar() {
    return (
      (this.closest('.header--on_scroll-stick') || this.closest('.header--always-stick')) &&
      this.contentElement.classList.contains('mega-menu')
    );
  }

  _measureHeaderGroups() {
    const header = this.header;
    if (!header) return;

    this.headerGroup1 = header.previousElementSibling || null;
    this.headerGroup2 = this.headerGroup1 ? this.headerGroup1.previousElementSibling : null;
    this.headerGroup3 = this.headerGroup2 ? this.headerGroup2.previousElementSibling : null;

    const headerInner = header.querySelector('.header');
    let total = headerInner ? headerInner.offsetHeight : 0;
    if (this.headerGroup1) total += this.headerGroup1.offsetHeight;
    if (this.headerGroup2) total += this.headerGroup2.offsetHeight;
    if (this.headerGroup3) total += this.headerGroup3.offsetHeight;

    this.headerGroupHeight = total;
  }

  _measureAnnouncementBarVars() {
    const announcementBar = this.closest('.shopify-section-announcement-bar');
    if (!announcementBar) return;

    requestAnimationFrame(() => {
      const barRect = announcementBar.getBoundingClientRect();
      const li = this.contentElement.closest('li');
      if (!li) return;

      const liRect = li.getBoundingClientRect();

      const announcementBarHeight = barRect.bottom + window.scrollY;
      const offsetTop = liRect.bottom - barRect.bottom;

      this._setVar('--announcement-bar-height', `${announcementBarHeight}px`, 'announcementBarHeight');
      this._setVar('--offset-top', `${offsetTop}px`, 'offsetTop');
    });
  }

  _setVar(name, value, cacheKey) {
    if (this._cache[cacheKey] === value) return;
    this._cache[cacheKey] = value;
    this.style.setProperty(name, value);
  }

  _scheduleMeasureStickyBottom(force) {
    if (!this._needsStickyHeightVar()) return;
    if (this._rafSticky) return;

    this._rafSticky = requestAnimationFrame(() => {
      this._rafSticky = 0;

      const headerInner = this.header?.querySelector('.header');
      if (!headerInner) return;

      const bottom = headerInner.getBoundingClientRect().bottom;
      const next = `${bottom.toFixed(1)}px`;

      if (!force && this._cache.headerStickyHeight === next) return;
      this._setVar('--header-sticky-height', next, 'headerStickyHeight');
    });
  }

  onMegaMenuClicked(event) {
    if (event.target.closest('a.mega-menu__banner-wrapper')) {
      this.setActiveCategory(event.target, true);
    }
  }

  closeAnnouncementBarMenu() {
    if (this.closest('.announcement-bar') && this.open) {
      this.open = false;
    }
  }

  set open(value) {
    if (value !== this.isOpen) {
      this.isOpen = value;

      if (this.isOpen) {
        document.addEventListener('scroll', this.closeAnnouncementBarMenuHandler, { passive: true });
      } else {
        document.removeEventListener('scroll', this.closeAnnouncementBarMenuHandler);
      }

      if (this.isConnected) {
        this.transition(value);
      } else {
        value ? this.setAttribute('open', '') : this.removeAttribute('open');
      }
    }
  }

  get open() {
    return this.isOpen;
  }

  get trigger() {
    return this.hasAttribute('trigger') ? this.getAttribute('trigger') : 'click';
  }

  get level() {
    return this.hasAttribute('level') ? this.getAttribute('level') : 'top';
  }

  onSummaryKeydown(event) {
    if (
      (event.code === 'Enter' && event.target === this.summaryElement) ||
      (event.code === 'Enter' && event.target.classList.contains('dropdown-icon'))
    ) {
      event.preventDefault();
      this.onSummaryClicked(event);
    }
  }

  onSummaryClicked(event) {
    this._ensureInit('click');

    if (!event.target.closest('a')) {
      this.open = !this.open;
    }
    this.setActiveCategory(event.target);
  }

  async transition(value, event = null) {
    if (value) {
      this._ensureInit('open');

      lockDropdownCount.set(DetailsDropdown, (lockDropdownCount.get(DetailsDropdown) || 0) + 1);
      this.setAttribute('open', '');

      if (this.contentElement.classList.contains('mega-menu')) {
        document.body.classList.add('mega-menu-opened');
      } else {
        document.body.classList.add('menu-opened');
      }

      this.summaryElement.setAttribute('open', '');
      setTimeout(() => this.contentElement.setAttribute('open', ''), 100);

      document.addEventListener('click', this.detectClickOutsideListener);
      document.addEventListener('keydown', this.detectEscKeyboardListener);
      document.addEventListener('focusout', this.detectFocusOutListener);

      requestAnimationFrame(() => {
        if (this.contentElement.classList.contains('mega-menu')) {
          this._measureAnnouncementBarVars();
        }

        this.shouldAligned();
        this._scheduleAlignedMenu(true);
        this._scheduleMeasureStickyBottom(true);

        if (this.contentElement.classList.contains('mega-menu')) {
          this._addAlignedScrollListener();
        }
      });

    } else {
      let isInOpenDropdown = false;
      if (event) isInOpenDropdown = event.target.closest('.popover[open]') || event.target.closest('.mega-menu[open]');

      lockDropdownCount.set(DetailsDropdown, (lockDropdownCount.get(DetailsDropdown) || 0) - 1);

      this.summaryElement.removeAttribute('open');
      this.contentElement.removeAttribute('open');
      if (!isInOpenDropdown) document.body.classList.remove('menu-opened', 'mega-menu-opened');
      document.removeEventListener('click', this.detectClickOutsideListener);
      document.removeEventListener('keydown', this.detectEscKeyboardListener);
      document.removeEventListener('focusout', this.detectFocusOutListener);
      if (!this.open) this.removeAttribute('open');

      this._removeAlignedScrollListener();

      this._scheduleAlignedMenu(true);
    }
  }

  _addAlignedScrollListener() {
    document.removeEventListener('scroll', this._onAlignedScroll);
    document.addEventListener('scroll', this._onAlignedScroll, { passive: true });
  }

  _removeAlignedScrollListener() {
    document.removeEventListener('scroll', this._onAlignedScroll);
  }

  _onAlignedScroll() {
    if (!this.open) return;
    if (!this.contentElement?.classList?.contains('mega-menu')) return;

    this._pendingScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;

    this._scheduleMeasureStickyBottom(false);
    this._scheduleAlignedMenu(false);
  }

  _scheduleAlignedMenu(force) {
    if (!this.contentElement || !this.contentElement.classList.contains('mega-menu')) return;
    if (!this.megaMenu) return;
    if (!force && !this.open) return;

    if (this._rafAligned) return;
    this._rafAligned = requestAnimationFrame(() => {
      this._rafAligned = 0;
      this.alignedMenu(force);
    });
  }

  alignedMenu(force) {
    const scrollTop = this._pendingScrollTop || window.pageYOffset || document.documentElement.scrollTop || 0;

    if (this._needsStickyHeightVar()) return;

    const disableStick = !!this.closest('.header--disable-stick');
    const onScrollStick = !!this.closest('.header--on_scroll-stick');

    let zone = 1;
    if ((scrollTop > 0 && scrollTop < this.headerGroupHeight) || disableStick) zone = 0;
    if (!onScrollStick && scrollTop === 0) zone = 2;

    if (!force && this._cache._zone === zone) {
      if (zone !== 0) return;
    }
    this._cache._zone = zone;

    if (zone === 0) {
      if (this._cache.megaMenuTop !== true) {
        this._cache.megaMenuTop = true;
        this.megaMenu.classList.add('mega-menu--top');
      }

      const quant = this.SCROLL_QUANT > 0 ? this.SCROLL_QUANT : 1;
      const q = Math.round(scrollTop / quant) * quant;
      const next = `${q}px`;

      if (!force && this._cache.scrollHeight === next) return;
      this._setVar('--scroll-height', next, 'scrollHeight');
      return;
    }

    if (!onScrollStick && scrollTop > this.headerGroupHeight) {
      this._setVar('--scroll-height', `0px`, 'scrollHeight');
    }

    if (zone === 2) {
      if (this._cache.megaMenuTop === true) {
        this._cache.megaMenuTop = false;
        this.megaMenu.classList.remove('mega-menu--top');
      }
    }
  }

  detectClickOutside(event) {
    if (!this.contains(event.target)) {
      this.open = false;
    }
  }

  detectEscKeyboard(event) {
    if (event.code === 'Escape' && this.open) {
      this.open = false;
      document.removeEventListener('keydown', this.detectEscKeyboardListener);
      this.summaryElement.focus();
    }
  }

  detectFocusOut(event) {
    if (event.relatedTarget && !this.contains(event.relatedTarget)) {
      this.open = false;
    }
  }

  detectHover(event) {
    if (this.trigger !== 'hover') return;
    this._ensureInit('hover');

    if (event.type === 'mouseenter') {
      if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
      this.hoverTimeout = setTimeout(() => {
        this.open = true;
      }, 50);
      return;
    }

    if (event.type === 'mouseleave') {
      if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
      this.hoverTimeout = setTimeout(() => {
        const isHovered = this.matches(':hover') || this.contentElement.matches(':hover');
        if (!isHovered) this.open = false;
      }, 80);
    }
  }

  shouldAligned() {
    if (this.contentElement) {
      this.contentElement.style.left = '';
      this.contentElement.style.right = '';
    }

    const isRTL = !!theme?.config?.isRTL;
    const isMegaMenu = this.contentElement.classList.contains('mega-menu');
    const isShortMegaMenu = this.contentElement.classList.contains('mega-menu-short');
    const isSecondNested = !!this.contentElement.closest('.second-nested__list');

    const li = this.contentElement.closest('li');
    if (!li) return;

    const listItemRect = li.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    const contentWidth = this.contentElement.offsetWidth;
    const contentRightEdge = listItemRect.left + contentWidth;

    if (isMegaMenu && this.closest('.shopify-section-header')) {
      const headerInner = this.header?.querySelector?.('.header');
      if (!headerInner) return;
    
      if (!this.header?.previousElementSibling) {
        this.headerGroupHeight = headerInner.offsetHeight;
      } else {
        if (this.header && this.header.previousElementSibling) this.headerGroup1 = this.header.previousElementSibling;
        if (this.headerGroup1 && this.headerGroup1.previousElementSibling) this.headerGroup2 = this.headerGroup1.previousElementSibling;
        if (this.headerGroup2 && this.headerGroup2.previousElementSibling) this.headerGroup3 = this.headerGroup2.previousElementSibling;
    
        this.headerGroupHeight = headerInner.offsetHeight;
        if (this.headerGroup1) this.headerGroupHeight = this.headerGroupHeight + this.headerGroup1.offsetHeight;
        if (this.headerGroup2) this.headerGroupHeight = this.headerGroupHeight + this.headerGroup2.offsetHeight;
        if (this.headerGroup3) this.headerGroupHeight = this.headerGroupHeight + this.headerGroup3.offsetHeight;
      }
      this.style.setProperty('--header-height', `${this.headerGroupHeight}px`);
    }

    if (isMegaMenu && !isShortMegaMenu) {
      const headerInner = this.header?.querySelector('.header');
      if (!headerInner) return;

      const headerBottom = headerInner.getBoundingClientRect().bottom;
      const offsetTop = listItemRect.bottom - headerBottom;

      this._setVar('--offset-top', `${offsetTop}px`, 'offsetTop');
      return;
    }

    if (isRTL) {
      const leftOverflow = (listItemRect.left - contentWidth) < 0;

      if (leftOverflow || (isShortMegaMenu && leftOverflow)) {
        this.contentElement.style.right = `${listItemRect.left - contentWidth + 16}px`;
      }

      if (isSecondNested && leftOverflow) {
        this.contentElement.style.right = '-320px';
      }
    } else {
      const rightOverflow = contentRightEdge > viewportWidth;

      if (rightOverflow || (isShortMegaMenu && rightOverflow)) {
        this.contentElement.style.left = `${viewportWidth - contentRightEdge - 16}px`;
      }

      const nestedRightEdge = contentRightEdge + contentWidth;
      if (isSecondNested && nestedRightEdge > viewportWidth) {
        this.contentElement.style.left = '-320px';
      }
    }
  }

  setActiveCategory(targetEl, forceSet = false) {
    if (this.dataset.status == 'parent' || forceSet) {
      const a = targetEl?.closest?.('a');
      if (!a) return;

      const activeCategory = a.dataset.title;
      const activeCategoryUrl = a.href;

      if (isStorageSupported('local')) window.localStorage.setItem(this.cookieName, activeCategory);
      if (isStorageSupported('local')) window.localStorage.setItem(this.cookieUrl, activeCategoryUrl);
    }
  }

  initActiveCategory() {
    if (!isStorageSupported('local')) return;

    const activeCategory = window.localStorage.getItem(this.cookieName);
    if (activeCategory == null) return;

    const activeLink = this.querySelector(`[data-title="${activeCategory}"]`);
    if (activeLink) activeLink.classList.add('active-parent-link');
  }
}
if (!customElements.get('details-dropdown')) {
  customElements.define('details-dropdown', DetailsDropdown);
}
if (lockDropdownCount.get(DetailsDropdown) == null) {
  lockDropdownCount.set(DetailsDropdown, 0);
}

class DrawerMenu extends HTMLElement {
  constructor() {
    super();

    this.cookieName = 'volume-theme:active-category';
    this.cookieUrl = 'volume-theme:active-category-url';

    this.summaryElement = this.firstElementChild
    this.contentElement = this.summaryElement.nextElementSibling
    this.isKeyboardNavigation = false
    this.summaryElement.addEventListener('click', this.onSummaryClicked.bind(this))
    if (this.contentElement) this.button = this.contentElement.querySelector('button')
    if (this.button) this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.isKeyboardNavigation = false
      this.isOpen = JSON.parse(this.getAttribute('open'))
      if (this.isOpen) {
        this.button.closest('.nested-submenu').previousElementSibling.setAttribute('open', 'false')
        this.button.closest('.nested-submenu').previousElementSibling.closest('drawer-menu').setAttribute('open', 'false')
        this.button.closest('.nested-submenu').previousElementSibling.classList.add('closing') 
        this.updateTabIndex(this.contentElement, false)
        setTimeout(() => {
          this.button.closest('.nested-submenu').previousElementSibling.classList.remove('closing')
        }, 450)
      }
    })

    this.viewCollectionButton = this.querySelector('.collection-button');
    if (this.viewCollectionButton) {
      this.viewCollectionButton.addEventListener('click', this.onViewCollectionButtonClick.bind(this))
      this.viewCollectionButton.addEventListener('keydown', (event) => {
        if (event.code === 'Enter') this.onViewCollectionButtonClick();
      });
    }

    this.detectClickOutsideListener = this.detectClickOutside.bind(this)
    this.detectEscKeyboardListener = this.detectEscKeyboard.bind(this)
    this.detectFocusOutListener = this.detectFocusOut.bind(this)
    this.addEventListener('keydown', this.onKeyDown.bind(this));
    this.addEventListener('keydown', (event) => {
      if (event.code === 'Enter') this.onSummaryKeydown()
    });
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    setTimeout(() => this.initActiveCategory(), 0)
  }

  initActiveCategory() {
    if (isStorageSupported('local')) {
      const activeCategory = window.localStorage.getItem(this.cookieName)

      if (activeCategory !== null) {
        let activeLink

        if (this.querySelector(`[data-title="${activeCategory}"]`)) activeLink = this.querySelector(`[data-title="${activeCategory}"]`)
        if (activeLink) activeLink.classList.add('active-parent-link', 'active-item')
      }
    }
  }

  setActiveCategory(targetEl, forceSet = false) {
    if (this.dataset.status == 'parent' || forceSet) {
      const el = targetEl.closest('a') || targetEl.querySelector('a')

      if (el) {
        const handle = el.closest('.menu').dataset.handle;
        const parentLink = el.closest('.menu-drawer').querySelector(`a.link-${handle}`)

        let activeCategory = parentLink.dataset.title
        let activeCategoryUrl = parentLink.href

        if (isStorageSupported('local')) {
          window.localStorage.setItem(this.cookieName, activeCategory)
        }

        if (isStorageSupported('local')) window.localStorage.setItem(this.cookieUrl, activeCategoryUrl)
      }
    }
  }

  onViewCollectionButtonClick(event) {
    this.setActiveCategory(event.target, true)
  }

  onSummaryClicked(event) {
    if (event && event.target && event.target.closest('a')) {
      this.setActiveCategory(event.target, true)

      return
    }

    event.stopPropagation();
    this.isKeyboardNavigation = false
    if (this.summaryElement.closest('.menu--parent')) {
      this.links = this.summaryElement.closest('.menu--parent').querySelectorAll('.menu__item-title a')
      this.links.forEach(link => link.classList.remove('active-item'))
      if (event && event.target && event.target.querySelector('a')) event.target.querySelector('a').classList.add('active-item')
    }
    this.isOpen = JSON.parse(this.summaryElement.getAttribute('open'))

    if (this.isOpen) {
      this.summaryElement.setAttribute('open', 'false')
      this.setAttribute('open', 'false')
      this.updateTabIndex(this.contentElement, false);
      
    } else {
      this.summaryElement.setAttribute('open', 'true')
      this.setAttribute('open', 'true')
      this.updateTabIndex(this.contentElement, true);
    }
  }

  onSummaryKeydown() {
    if (this.summaryElement.closest('.menu--parent')) {
      event.preventDefault()
      this.links = this.summaryElement.closest('.menu--parent').querySelectorAll('.menu__item-title a')
      this.links.forEach(link => link.classList.remove('active-item'))
      document.activeElement.classList.add('active-item')
    }
  }

  detectClickOutside(event) {
    if (!this.contains(event.target) && !(event.target.closest('details') instanceof DetailsDropdown)) {
      this.open = false
    } 
  }

  detectEscKeyboard(event) {
    if (event.code === 'Escape') {
      const targetMenu = event.target.closest('details[open]')
      if (targetMenu) {
        targetMenu.open = false
      }
    }
  }

  onKeyDown(event) {
    const currentFocus = document.activeElement;
    this.isKeyboardNavigation = true

    switch (event.code) {
      case 'Enter':
        if (currentFocus === this.summaryElement) {
          event.preventDefault();
          this.onSummaryClicked();
        }
        break;

      case 'Escape':
        this.updateTabIndex(this.contentElement, false)
        break;
    }
  }

  updateTabIndex(menuElement, isOpen) {
    if (!menuElement) return;

    const directFocusableElements = Array.from(
      menuElement.querySelectorAll(
        ':scope > ul > li > drawer-menu > summary > .menu__item-title > a[href], :scope > ul > li > drawer-menu > summary > .menu__item-title > button:not([disabled]), :scope > .menu-drawer__header button, :scope > ul > li > a[href'
      )
    );

    directFocusableElements.forEach(element => {
      isOpen ? element.setAttribute('tabindex', '0') : element.setAttribute('tabindex', '-1')
    });
  }

  closeSubMenu() {
    this.summaryElement.setAttribute('open', 'false');
    this.setAttribute('open', 'false');
    this.updateTabIndex(this.contentElement, false);
  }

  onFocusOut(event) {
    if (!this.isKeyboardNavigation) return
    setTimeout(() => {
      if (!this.contains(document.activeElement)) {
        this.closeSubMenu();
      }
    }, 50);
  }

  getFocusableElements() {
    if (!menuElement) return []
    return Array.from(
      this.contentElement?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []
    );
  }

  detectFocusOut(event) {
    if (event.relatedTarget && !this.contains(event.relatedTarget)) {
      this.open = false
    }
  }

  detectHover(event) {
    if (this.trigger !== 'hover') return;

    if (event.type === 'mouseenter') {
      this.open = true
    } else {
      this.open = false
    }
  }
}
customElements.define('drawer-menu', DrawerMenu)

class AddToCart extends HTMLElement {
  constructor() {
    super();

    if(document.querySelector('.shopify-section-cart-drawer')) this.cartDrawerID = document.querySelector('.shopify-section-cart-drawer').id.replace('shopify-section-', '')
    this.headerID = document.querySelector('.shopify-section-header').id.replace('shopify-section-', '')
    if (this.classList.contains('cart-drawer')) this.miniCart = document.querySelector('cart-drawer');
    if (this.classList.contains('cart-notification')) this.miniCart = document.querySelector('cart-notification');
    this.addEventListener('click', (event) => {
      event.preventDefault()
      if (this.querySelector('button[disabled]')) return
      if(this.querySelector('.loading-overlay__spinner')) {
        this.querySelector('.loading-overlay__spinner').classList.remove('hidden')
        setTimeout(() => {
          this.querySelector('.loading-overlay__spinner').classList.add('hidden')
        }, 2000)
      }
      this.onClickHandler(this)
    }) 
  }

  onClickHandler() {
    const variantId = this.dataset.variantId;

    if (variantId) {
      if (document.body.classList.contains('template-cart') ) {
        Shopify.postLink(window.routes.cart_add_url, {
          parameters: {
            id: variantId,
            quantity: 1
          },
        });
        return;
      }

      this.setAttribute('disabled', true);
      this.classList.add('loading');
      const sections = this.miniCart ? this.miniCart.getSectionsToRender().map((section) => section.id) : this.getSectionsToRender().map((section) => section.id);

      const body = JSON.stringify({
        id: variantId,
        quantity: 1,
        sections: sections,
        sections_url: window.location.pathname
      });

      fetch(`${window.routes.cart_add_url}`, { ...fetchConfig('json'), body })
        .then((response) => response.json())
        .then((parsedState) => {
          if (parsedState.status === 422) {
             document.dispatchEvent(new CustomEvent('ajaxProduct:error', {
                detail: {
                  errorMessage: parsedState.description
                }
              }));
           }
           else {
            this.miniCart && this.miniCart.renderContents(parsedState);
            this.renderContents(parsedState)
             document.dispatchEvent(new CustomEvent('ajaxProduct:added', {
              detail: {
                product: parsedState
              }
            }));
          }
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          this.classList.remove('loading');
          this.removeAttribute('disabled');
        });
    }
  }
  getSectionsToRender() {
    let arraySections = []
    arraySections = [
      {
        id: this.cartDrawerID,
          selector: '#CartDrawer'
      },
      {
        id: this.headerID,
        selector: `#cart-icon-bubble-${this.headerID}`
      }
    ];
    return arraySections
  }
  renderContents(parsedState) {
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section => {
      const sectionElements = document.querySelectorAll(section.selector);
      if(sectionElements) {
        Array.from(sectionElements).forEach(sectionElement => {
          sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
        })
      } 
    }));
  }
  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }
}
customElements.define('add-to-cart', AddToCart);


const announcementBarSwiper = new MultiSwiper('.swiper-announcement', {
  a11y: {
    slideRole: 'listitem'
  },
  loop: true,
  navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
  }
})

const tabsSwiper = new MultiSwiper('.swiper-tabs', {
  loop: false,
  slidesPerView: 'auto'
})

class ShowMoreButton extends HTMLElement {
  constructor() {
    super();

    this.debounceTimeout = null;
    this.arrayContainer = this.closest('.section').querySelector('.show-more-array')
    this.arrayElements = this.arrayContainer.querySelectorAll('.show-more-element')
    this.showMoreButton = this
    this.elemOnDesktop = Number(this.dataset.showDesktop)
    this.elemOnMobile = Number(this.dataset.showMobile)
    this.mobileBreakpoint = isNaN(Number(this.dataset.breakpoint)) ? 1024 : Number(this.dataset.breakpoint);
    this.limit = this.elemOnMobile <= this.elemOnDesktop ? this.elemOnMobile : this.elemOnDesktop

    this.lastWindowWidth = window.innerWidth;
    this.truncateElements = this.truncateElements.bind(this);
    this.debouncedResize = this.debounce(this.truncateElements, 200);
    
    if (this.isMobileDevice()) {
      window.addEventListener('orientationchange', this.truncateElements);
    } else {
      window.addEventListener('resize', this.debouncedResize);
    }
    this.truncateElements();
  }

  debounce(func, wait) {
    return (...args) => {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  isMobileDevice() {
    return 'ontouchstart' in document.documentElement && navigator.userAgent.match(/Mobi/);
  }

  truncateElements() {
    if (window.innerWidth <= this.mobileBreakpoint && this.showMoreButton.className.includes('visually-hidden')) {
      if (this.arrayElements.length > this.limit) {
        Array.from(this.arrayElements).slice(this.limit).forEach((el) => el.classList.add('visually-hidden'));
        this.showMoreButton.classList.remove('visually-hidden')
        this.showMoreButton.querySelector('.button').setAttribute('tabindex', '0')
        this.showMoreButton.addEventListener('click', (evt) => {
          evt.preventDefault();
          this.arrayElements.forEach((el) => el.classList.remove('visually-hidden'));
          this.showMoreButton.classList.add('visually-hidden')
        });
      }
    } else {
      if (!this.showMoreButton.className.includes('visually-hidden')) {
        this.arrayElements.forEach((el) => el.classList.remove('visually-hidden'));
        this.showMoreButton.classList.add('visually-hidden')
        this.showMoreButton.querySelector('.button').setAttribute('tabindex', '-1')
      }
    }
  }
}
customElements.define('show-more-button', ShowMoreButton);
class OverlapHeader extends HTMLElement {
  constructor() {
    super();
    this.header = this.querySelector('.shopify-section-header')
    this.passwordHeader = this.querySelector('.shopify-section-password-header')
    this.section = this.querySelectorAll('main .shopify-section')[0]
    this.sectionWrapper = this.querySelector('main .shopify-section:first-child .section')
    this.toggleDesktopOverlap()
    document.addEventListener('shopify:section:load', () => {
      this.header = this.querySelector('.shopify-section-header')
      this.passwordHeader = this.querySelector('.shopify-section-password-header')
      this.sectionWrapper = this.querySelector('main .shopify-section:first-child .section')
      this.toggleDesktopOverlap()
    })
    document.addEventListener('shopify:section:unload', () => {
      setTimeout(() => {
        this.header = this.querySelector('.shopify-section-header')
        this.passwordHeader = this.querySelector('.shopify-section-password-header')
        this.sectionWrapper = this.querySelector('main .shopify-section:first-child .section')
        this.toggleDesktopOverlap()
      }, 10)
    })
    document.addEventListener('shopify:section:reorder', () => {
      this.header = this.querySelector('.shopify-section-header')
      this.passwordHeader = this.querySelector('.shopify-section-password-header')
      this.sectionWrapper = this.querySelector('main .shopify-section:first-child .section')
      this.toggleDesktopOverlap()
    })
  }

  toggleDesktopOverlap() {
    if (this.sectionWrapper && this.header) {
      this.sectionWrapper.classList.contains('section-overlap--enable') ? this.header.classList.add('overlap-enable') : this.header.classList.remove('overlap-enable')
      this.sectionWrapper.classList.contains('section-overlap--desktop') ? this.header.classList.add('overlap-desktop') : this.header.classList.remove('overlap-desktop')
      this.sectionWrapper.classList.contains('section-overlap--mobile') ? this.header.classList.add('overlap-mobile') : this.header.classList.remove('overlap-mobile')
      if (this.passwordHeader) {
        this.sectionWrapper.classList.contains('section-overlap--enable') ? this.passwordHeader.classList.add('overlap-enable') : this.passwordHeader.classList.remove('overlap-enable')
        this.sectionWrapper.classList.contains('section-overlap--desktop') ? this.passwordHeader.classList.add('overlap-desktop') : this.passwordHeader.classList.remove('overlap-desktop')
        this.sectionWrapper.classList.contains('section-overlap--mobile') ? this.passwordHeader.classList.add('overlap-mobile') : this.passwordHeader.classList.remove('overlap-mobile')
      }
    }
  }
}
customElements.define('overlap-header', OverlapHeader);

class PromoPopup extends HTMLElement {
  constructor() {
    super();

    // Prevent popup on Shopify robot challenge page
    if (window.location.pathname === '/challenge') {
      return;
    }

    this.cookieName = this.closest('section').getAttribute('id');

    this.classes = {
      bodyClass: 'hidden',
      openClass: 'open',
      closingClass: 'is-closing',
      showImage: 'show-image'
    };

    this.popup = this.querySelector('.popup')
    this.stickyTab = this.querySelector('.promo-sticky-tab')
    this.openTabButton = this.querySelector('.open-sticky-tab')
    this.closeTabButton = this.querySelector('.close-sticky-tab')
    this.overlay = document.body.querySelector('body > .overlay')
    if (this.querySelector('.age-verification')) this.overlay = this.querySelector('.overlay')
    this.hasPopupedUp = false

    this.querySelectorAll('[data-popup-toggle]').forEach((button) => {
      button.addEventListener('click', this.onButtonClick.bind(this));
    });
    this.openStickyTab()
    if (!this.getCookie(this.cookieName)) {
      this.init();
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target !== this.overlay) return;
        if (this.querySelector('.age-verification')) return;
        if (this.popup && this.popup.classList.contains(this.classes.openClass)) {
          this.closePopup();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.code && event.code.toUpperCase() === 'ESCAPE' && this.querySelector('.popup--popup.open')) this.closePopup()
    })
    
    if (this.closeTabButton) this.closeTabButton.addEventListener('click', this.closeStickyTab.bind(this))
  }

  connectedCallback() {
    if (Shopify.designMode) {
      this.onShopifySectionLoad = this.onSectionLoad.bind(this);
      this.onShopifySectionSelect = this.onSectionSelect.bind(this);
      this.onShopifySectionDeselect = this.onSectionDeselect.bind(this);
      document.addEventListener('shopify:section:load', this.onShopifySectionLoad);
      document.addEventListener('shopify:section:select', this.onShopifySectionSelect);
      document.addEventListener('shopify:section:deselect', this.onShopifySectionDeselect);
    }
  }
  disconnectedCallback() {
    if (Shopify.designMode) {
      document.removeEventListener('shopify:section:load', this.onShopifySectionLoad);
      document.removeEventListener('shopify:section:select', this.onShopifySectionSelect);
      document.removeEventListener('shopify:section:deselect', this.onShopifySectionDeselect);

      document.body.classList.remove(this.classes.bodyClass);
    }
  }
  onSectionLoad(event) {
    filterShopifyEvent(event, this, () => this.openPopup.bind(this));
  }
  onSectionSelect(event) {
    filterShopifyEvent(event, this, () => {
      if (Shopify.designMode && this.closest('.shopify-section-group-overlay-group') && !this.querySelector('.flyout')) {
        document.body.classList.add('disable-scroll-body');
      }

      this.openPopup.call(this)
    });
  }
  onSectionDeselect(event) {
    filterShopifyEvent(event, this, this.closePopup.bind(this));
  }

  init() {
    if (Shopify && Shopify.designMode) {
      return;
    }

    let delayValue;

    switch (this.dataset.delayType) {
      case 'timer':
        Shopify.designMode ? delayValue = 0 : delayValue = parseInt(this.dataset.delay)

        setTimeout(function() {
          if(!document.body.className.includes('hidden')) {
            this.openPopup()
          } else if (!this.getCookie(this.cookieName)) {
            document.addEventListener('body:visible', () => {
              if(!document.body.className.includes('hidden')) setTimeout(() => this.openPopup(), 1000)
            })
          }
        }.bind(this), delayValue * 1000)

        break
      case 'scroll':
        delayValue = parseInt(this.dataset.delay.slice(10).slice(0, -1), 10)

        const scrollPercent = delayValue / 100;
        let scrollTarget;

        window.addEventListener('load', () => {
          scrollTarget = (document.body.scrollHeight - window.innerHeight) * scrollPercent;
          document.addEventListener('scroll', () => {
            if (window.scrollY >= scrollTarget && !this.hasPopupedUp) this.openPopup()
          })
        })

        break
      case 'cursor-top':
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouchDevice) return;

        const handleMouseOut = (e) => {
          if (
            !this.hasPopupedUp &&
            !this.getCookie(this.cookieName) &&
            e.relatedTarget === null &&
            e.clientY <= 0
          ) {
            this.openPopup();
            this.setCookie(this.cookieName, this.dataset.frequency);
            document.removeEventListener('mouseout', handleMouseOut);
          }
        };

        document.addEventListener('mouseout', handleMouseOut);
        break;
    }
  }

  onButtonClick(event) {
    event.preventDefault();
    this.popup.classList.contains(this.classes.openClass) ? this.closePopup() : this.openPopup();
  }

  openPopup() {
    document.body.classList.remove(this.classes.bodyClass)
    this.popup.classList.add(this.classes.openClass)
    if (!this.popup.classList.contains('flyout') && this.overlay && !this.overlay.classList.contains(this.classes.openClass)) {
      this.overlay.classList.add(this.classes.openClass);
      document.body.classList.add('overlay-opened');
    }

    if(this.popup.closest('.age-verification')) document.body.classList.add('age-verification-opened')

    if (this.popup.dataset.position === 'popup') {
      document.body.classList.add(this.classes.bodyClass);
    }
    if (this.stickyTab) this.closeStickyTab()
    this.hasPopupedUp = true
    document.querySelectorAll('promo-popup').forEach(item => {
      if(!item.querySelector('.popup').closest('.open') && !item.querySelector('.age-verification')) item.closest('section').style.zIndex = '27'
    })
  }

  closePopup() {
    if (Shopify.designMode && this.closest('.shopify-section-group-overlay-group')) {
      document.body.classList.remove('disable-scroll-body');
    }

    this.popup.classList.add(this.classes.closingClass)

    setTimeout(() => {
      this.popup.classList.remove(this.classes.openClass)
      if (this.overlay){
        this.overlay.classList.remove(this.classes.openClass)
        document.body.classList.remove('overlay-opened');
      }
      this.popup.classList.remove(this.classes.closingClass)
      this.popup.classList.remove(this.classes.showImage)
      this.openStickyTab()
      document.querySelectorAll('promo-popup').forEach(item => {
        if(item.closest('section').getAttribute('style')) item.closest('section').removeAttribute('style')
      })
      if (this.popup.dataset.position === 'popup') document.body.classList.remove(this.classes.bodyClass)
      if (this.querySelector('.age-verification')) {
        document.dispatchEvent(new CustomEvent('body:visible'));
        document.body.classList.remove('age-verification-opened')
      }
    })
    if (Shopify.designMode) {
      this.removeCookie(this.cookieName)
      return;
    }
    this.setCookie(this.cookieName, this.dataset.frequency)
  }

  openStickyTab() {
    if (!this.stickyTab) return
    this.stickyTab.classList.add(this.classes.openClass)
  }

  closeStickyTab() {
    if (!this.stickyTab) return
    this.stickyTab.classList.remove(this.classes.openClass)
  }

  getCookie(name) {
    let match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match[2] : null;
  }

  setCookie(name, frequency) {
    document.cookie = `${name}=true; max-age=${(frequency * 60 * 60)}; path=/`;
  }

  removeCookie(name) {
    document.cookie = `${name}=; max-age=0`;
  }
}
customElements.define('promo-popup', PromoPopup);

class VideoControls extends HTMLElement {
  constructor() {
    super();

    this.videoElement = this.closest('.video-controls-js').querySelector('video');
    this.pauseButton = this.querySelector('.button--pause');
    this.muteButton = this.querySelector('.button--mute');
    this.cookieName = 'isStoriesMuted'
    
    if(this.pauseButton) this.updatePauseButton.bind(this);
    if(this.muteButton) this.updateMuteButton.bind(this);

    if(this.pauseButton) this.pauseButton.addEventListener('click', (event) => this.togglePlayPause(event));
    if(this.muteButton) this.muteButton.addEventListener('click', (event) => this.toggleMuteUnmute(event));

    if(this.videoElement) this.videoElement.muted = true;
    if(this.closest('.stories-slideshow')) this.toggleMuteStories()
  }

  togglePlayPause(event) {
    event.preventDefault()
    if (this.videoElement.paused) {
      this.videoElement.play();
    } else {
      this.videoElement.pause();
    }
    this.updatePauseButton();
  }

  toggleMuteUnmute(event) {
    event.preventDefault()
    this.videoElement.muted = !this.videoElement.muted;
    this.updateMuteButton();
  }

  updatePauseButton() {
    if (this.videoElement.paused) {
      this.pauseButton.classList.add('pause');
      this.pauseButton.classList.remove('play');
      this.pauseButton.setAttribute('aria-label', `${window.accessibilityStrings.play}`)
    } else {
      this.pauseButton.classList.add('play');
      this.pauseButton.classList.remove('pause');
      this.pauseButton.setAttribute('aria-label', `${window.accessibilityStrings.pause}`)
    }
  }

  updateMuteButton() {
    if (this.videoElement.muted) {
      this.muteButton.classList.add('mute');
      this.muteButton.classList.remove('unmute');
      this.muteButton.setAttribute('aria-label', `${window.accessibilityStrings.unmute}`)
      if(this.videoElement?.closest('.stories-slideshow')) {
        this.slideshow = this.closest('.stories-slideshow')
        this.muteButtons = this.slideshow.querySelectorAll('.button--mute')
        this.muteButtons.forEach(button => {
          button.classList.add('mute');
          button.classList.remove('unmute');
          button.setAttribute('aria-label', `${window.accessibilityStrings.unmute}`)
          this.slideshow.querySelectorAll('video').forEach(video => {video.muted = true})
        })
        if (isStorageSupported('local')) window.localStorage.setItem(this.cookieName, 'muted')
      }
    } else {
      this.muteButton.classList.add('unmute');
      this.muteButton.classList.remove('mute');
      this.muteButton.setAttribute('aria-label', `${window.accessibilityStrings.mute}`)
      if(this.videoElement?.closest('.stories-slideshow')) {
        this.slideshow = this.closest('.stories-slideshow')
        this.muteButtons = this.slideshow.querySelectorAll('.button--mute')
        this.muteButtons.forEach(button => {
          button.classList.add('unmute');
          button.classList.remove('mute');
          button.setAttribute('aria-label', `${window.accessibilityStrings.mute}`)
          this.slideshow.querySelectorAll('video').forEach(video => {video.muted = false})
        })
        if (isStorageSupported('local')) window.localStorage.setItem(this.cookieName, 'unmuted')
      }
    }
  }

  toggleMuteStories() {
    this.slideshow = this.closest('.stories-slideshow')

    if (isStorageSupported('local')) {
      const activeState = window.localStorage.getItem(this.cookieName)
      if (activeState !== null) {
        if (activeState == 'muted') {
          this.slideshow = this.closest('.stories-slideshow')
          this.muteButtons = this.slideshow.querySelectorAll('.button--mute')
          this.muteButtons.forEach(button => {
            button.classList.add('mute');
            button.classList.remove('unmute');
            button.setAttribute('aria-label', `${window.accessibilityStrings.unmute}`)
            this.slideshow.querySelectorAll('video').forEach(video => {video.muted = true})
          })
        } else if (activeState == 'unmuted') {
          this.slideshow = this.closest('.stories-slideshow')
          this.muteButtons = this.slideshow.querySelectorAll('.button--mute')
          this.muteButtons.forEach(button => {
            button.classList.add('unmute');
            button.classList.remove('mute');
            button.setAttribute('aria-label', `${window.accessibilityStrings.mute}`)
            this.slideshow.querySelectorAll('video').forEach(video => {video.muted = false})
          })
        }
      } else {
        this.slideshow.querySelectorAll('video').forEach(video => {
          if (video.muted && video.closest('.stories-slider-content').dataset.muted == 'false') video.muted = false;
          if (video.closest('.stories-slider-content').dataset.muted == 'true') {
            this.muteButtons = this.slideshow.querySelectorAll('.button--mute')
            this.muteButtons.forEach(button => {
              button.classList.add('mute');
              button.classList.remove('unmute');
              button.setAttribute('aria-label', `${window.accessibilityStrings.unmute}`)
              this.slideshow.querySelectorAll('video').forEach(video => {video.muted = true})
            })
          }
        })
      }
    } else {
      this.slideshow.querySelectorAll('video').forEach(video => {
        if (video.muted && video.closest('.stories-slider-content').dataset.muted == 'false') video.muted = false
        if (video.closest('.stories-slider-content').dataset.muted == 'true') {
          this.muteButtons = this.slideshow.querySelectorAll('.button--mute')
          this.muteButtons.forEach(button => {
            button.classList.add('mute');
            button.classList.remove('unmute');
            button.setAttribute('aria-label', `${window.accessibilityStrings.unmute}`)
            this.slideshow.querySelectorAll('video').forEach(video => {video.muted = true})
          })
        }
      })
    }
  }
}
customElements.define('video-controls', VideoControls);

class CascadingGrid extends HTMLElement {
  constructor() {
    super();

    this.masonryInstance = null;
    this._mo = null;
    this._io = null;
    this._ro = null;
    this._inited = false;
    this._initScheduled = false;

    this._layoutRaf = 0;
    this._pendingRelayout = false;

    this._grid = null;

    this._onSectionLoad = this._onSectionLoad.bind(this);
    this._startInitSoon = this._startInitSoon.bind(this);
    this._initHard = this._initHard.bind(this);
    this._scheduleLayout = this._scheduleLayout.bind(this);
    this._observeLazyContent = this._observeLazyContent.bind(this);

    this._firstIntent = null;
  }

  connectedCallback() {
    document.addEventListener('shopify:section:load', this._onSectionLoad);
    this._armLazyInit();
  }

  disconnectedCallback() {
    document.removeEventListener('shopify:section:load', this._onSectionLoad);

    this._disarmLazyInit();

    if (this._mo) {
      this._mo.disconnect();
      this._mo = null;
    }

    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }

    if (this._layoutRaf) {
      cancelAnimationFrame(this._layoutRaf);
      this._layoutRaf = 0;
    }

    if (this.masonryInstance) {
      try { this.masonryInstance.destroy(); } catch (e) {}
      this.masonryInstance = null;
    }

    if (this._grid) {
      delete this._grid.masonryInstance;
      this._grid = null;
    }

    this._inited = false;
    this._initScheduled = false;
    this._pendingRelayout = false;
  }

  _armLazyInit() {
    if (this._lazyArmed) return;
    this._lazyArmed = true;

    this._firstIntent = () => this._startInitSoon('intent');
    this.addEventListener('pointerenter', this._firstIntent, { once: true, passive: true });
    this.addEventListener('pointerdown',  this._firstIntent, { once: true, passive: true });
    this.addEventListener('focusin',      this._firstIntent, { once: true, passive: true });

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        const e = entries && entries[0];
        if (e && e.isIntersecting) this._startInitSoon('viewport');
      }, {
        root: null,
        rootMargin: '600px 0px',
        threshold: 0.01
      });
      this._io.observe(this);
    } else {
      this._startInitSoon('fallback');
    }
  }

  _disarmLazyInit() {
    if (this._firstIntent) {
      this.removeEventListener('pointerenter', this._firstIntent);
      this.removeEventListener('pointerdown',  this._firstIntent);
      this.removeEventListener('focusin',      this._firstIntent);
      this._firstIntent = null;
    }
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
    this._lazyArmed = false;
  }

  _startInitSoon(reason) {
    if (this._inited || this._initScheduled) return;
    this._initScheduled = true;

    this._disarmLazyInit();

    const run = () => {
      this._initScheduled = false;
      this._initHard();
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 1500 });
    } else {
      requestAnimationFrame(run);
    }
  }

  _onSectionLoad(event) {
    if (!event?.target) return;
    if (!event.target.contains(this) && !this.contains(event.target)) return;

    if (!this._inited) {
      this._startInitSoon('section-load');
      return;
    }

    this._reinit();
  }

  _initHard() {
    if (this._inited) return;

    const grid = this.querySelector('.grid');
    if (!grid) return;

    this._inited = true;
    this._grid = grid;

    this.masonryInstance = new Masonry(grid, {
      itemSelector: '.grid-item'
    });

    grid.masonryInstance = this.masonryInstance;

    this._observeLazyContent(grid);

    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(() => this._scheduleLayout());
      this._ro.observe(grid);
    }

    this._scheduleLayout();
  }

  _reinit() {
    const grid = this.querySelector('.grid');
    if (!grid) return;

    if (this._grid !== grid) {
      if (this.masonryInstance) {
        try { this.masonryInstance.destroy(); } catch (e) {}
        this.masonryInstance = null;
      }

      if (this._mo) { this._mo.disconnect(); this._mo = null; }
      if (this._ro) { this._ro.disconnect(); this._ro = null; }

      this._grid = grid;

      this.masonryInstance = new Masonry(grid, {
        itemSelector: '.grid-item'
      });

      grid.masonryInstance = this.masonryInstance;

      this._observeLazyContent(grid);

      if ('ResizeObserver' in window) {
        this._ro = new ResizeObserver(() => this._scheduleLayout());
        this._ro.observe(grid);
      }

      this._scheduleLayout();
      return;
    }

    this._scheduleLayout();
  }

  _observeLazyContent(target) {
    if (this._mo) this._mo.disconnect();

    this._mo = new MutationObserver((mutations) => {
      let shouldRelayout = false;

      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
          shouldRelayout = true;
          break;
        }

        if (m.type === 'attributes' && m.attributeName === 'class') {
          const el = m.target;
          if (el && el.classList && el.classList.contains('lazyloaded')) {
            shouldRelayout = true;
            break;
          }
        }
      }

      if (shouldRelayout) this._scheduleLayout();
    });

    this._mo.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  _scheduleLayout() {
    if (!this.masonryInstance) return;

    this._pendingRelayout = true;
    if (this._layoutRaf) return;

    this._layoutRaf = requestAnimationFrame(() => {
      this._layoutRaf = 0;

      if (!this._pendingRelayout || !this.masonryInstance) return;
      this._pendingRelayout = false;

      try {
        this.masonryInstance.layout();
      } catch (e) {}
    });
  }
}

customElements.define('cascading-grid', CascadingGrid);

class GridSwitcher extends HTMLElement {
  constructor() {
    super();

    this.gridType = this.dataset.gridType;

    this.addEventListener('click', (e) => this.handleClick(e));
    this.addEventListener('keydown', (e) => this.handleKeyPress(e));

    window.addEventListener('resize', () => this.hideSecondaryOptionOnMobile());
  }

  connectedCallback() {
    this.setSectionElementsRefs();
    this.hideSecondaryOptionOnMobile();

    if (!this.gridTypeOptionExists(this.gridType)) {
      this.updateGridTypeAndReloadSection();
    }
  }

  setSectionElementsRefs() {
    this.section = this.closest('section');
    this.sectionId = this.section.id.split('shopify-section-')[1];
    this.productGrid = document.querySelector(`#product-grid--${this.sectionId}`);
    this.options = Array.from(this.querySelectorAll('.grid-switcher__option:not(.grid-switcher__option--hidden)'));
  }

  gridTypeOptionExists(gridType) {
    return this.options.some(option => option.dataset.gridType === gridType);
  }

  async updateGridTypeAndReloadSection(setGridSwitcherOptionLoader = false) {
    const savedGridType = localStorage.getItem("product-grid-type");
    const gridType = this.gridTypeOptionExists(savedGridType) ? savedGridType : "default";
  
    try {
      await this.updateCartAttribute("grid_type", gridType);
      await this.reloadSection(setGridSwitcherOptionLoader);
    } catch (error) {
      console.error("Error updating grid style:", error);
    }
  }
  
  async updateCartAttribute(attribute, value) {
    return fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributes: { [attribute]: value } }),
    });
  }
  
  async reloadSection(setGridSwitcherOptionLoader = false) {
    let gridType, nextActiveOption;

    if (setGridSwitcherOptionLoader) {
      gridType = localStorage.getItem("product-grid-type") || "default";
      nextActiveOption = this.querySelector(`.grid-switcher__option:not(.grid-switcher__option--hidden)[data-grid-type='${gridType}']`);

      nextActiveOption.classList.add('grid-switcher__option--loading');
      this.closest('section').classList.add('grid-switcher-loading')
    }

    const url = new URL(window.location.href);
    url.searchParams.set("section_id", this.sectionId);
    if (url.searchParams.has("page")) {
      url.searchParams.delete("page");
    }

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Failed to fetch section HTML");
  
    const html = await response.text();
    const dom = new DOMParser().parseFromString(html, "text/html");
    const updatedSection = dom.getElementById(`shopify-section-${this.sectionId}`);
  
    if (!updatedSection) throw new Error("Updated section not found");
  
    if (setGridSwitcherOptionLoader) {
      nextActiveOption.classList.remove('grid-switcher__option--loading');
      this.closest('section').classList.remove('grid-switcher-loading')
    }

    this.section.replaceWith(updatedSection);
    this.removeSearchParam('page');
    preloadImages(updatedSection);
    const newSliders = updatedSection.querySelectorAll('.swiper-product-card');
    newSliders.forEach(initializeSwiper);
  }

  removeSearchParam(param) {
    const url = new URL(window.location.href);

    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      window.history.replaceState({}, "", url.toString());
    }
  }

  getCurrentGridType() {
    const activeOptions = this.querySelectorAll('.grid-switcher__option--active');
    const activeOption = Array.from(activeOptions).at(-1);

    return activeOption.dataset.gridType;
  }

  handleClick() {    
    const currentGridType = this.getCurrentGridType();
    const nextGridType = this.getNextGridType(currentGridType);
    
    localStorage.setItem("product-grid-type", nextGridType);

    this.updateGridTypeAndReloadSection(true);
  }

  handleKeyPress(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.handleClick(); 
    }
  }
  
  hideSecondaryOptionOnMobile() {
    const mobileBreakpoint = 768;
    const isSmallScreen = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches;
    if (this.wasSmallScreen === isSmallScreen) {
      return;
    }

    this.wasSmallScreen = isSmallScreen;

    const secondaryOption = this.querySelector('.grid-switcher__option[data-grid-type="secondary"]');
    if (!secondaryOption) {
      return;
    }
    
    secondaryOption.classList.toggle('grid-switcher__option--hidden', isSmallScreen);
    this.options = Array.from(this.querySelectorAll('.grid-switcher__option:not(.grid-switcher__option--hidden)'));

    if (this.getCurrentGridType() === 'secondary' && isSmallScreen) {
      localStorage.setItem("product-grid-type", 'default');
      this.updateGridTypeAndReloadSection();
    }
  }

  getNextGridType(gridType) {
    const gridTypesSequence = this.options.map(option => option.dataset.gridType);
    const currentGridTypeIndex = gridTypesSequence.indexOf(gridType);
    const isLastInSequence = currentGridTypeIndex === (gridTypesSequence.length - 1);

    return isLastInSequence ? gridTypesSequence[0] : gridTypesSequence[currentGridTypeIndex + 1];
  }
}

customElements.define('grid-switcher', GridSwitcher);

class VariantPicker extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('change', (event) => this.handleProductUpdate(event));
    this.initializeProductSwapUtility();
    this.productWrapper = this.closest('.main-product')
    this.priceInsideButton = false
    this.buttonIcon = false
    if(this.productWrapper?.querySelector('.price-inside-button')) this.priceInsideButton = true
    if(document.querySelector('.product-sticky-cart')) this.buttonIcon = true
    this.productDetailsMobile = this.productWrapper?.querySelector('.product-details--only-mobile.product-details--second_below_media.product-details-mobile--first')
    this.productDetailsDesktop = this.productWrapper?.querySelector('.product-details--second_below_media.product-details-mobile--first:not(.product-details--only-mobile)')
    if (this.productDetailsMobile && this.productDetailsDesktop) {
      requestAnimationFrame(() => this.updatedElementsId());
      let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        requestAnimationFrame(() => this.updatedElementsId());
      }, 100);
    });
    }
  }

  initializeProductSwapUtility() {
    this.swapProductUtility = new HTMLUpdateUtility();
    this.swapProductUtility.addPreProcessCallback((html) => {
      return html;
    });
    this.swapProductUtility.addPostProcessCallback((newNode) => {
      window?.Shopify?.PaymentButton?.init();
      window?.ProductModel?.loadShopifyXR();
      publish(PUB_SUB_EVENTS.sectionRefreshed, {
        data: {
          sectionId: this.dataset.section,
          resource: {
            type: SECTION_REFRESH_RESOURCE_TYPE.product,
            id: newNode.querySelector('variant-picker').dataset.productId,
          },
        },
      });
    });
  }

  updatedElementsId() {
    const toggleAttributes = (source, add = false) => {
      const idElems = source.querySelectorAll('[data-place-for-id]');
      const formElems = source.querySelectorAll('[data-form-input]');
      const forElems = source.querySelectorAll('[data-place-for]');

      idElems.forEach(elem => {
        const val = elem.getAttribute('data-place-for-id');
        if (add && !elem.hasAttribute('id')) elem.setAttribute('id', val);
        else if (!add && elem.hasAttribute('id')) elem.removeAttribute('id');
      });

      formElems.forEach(elem => {
        const val = elem.getAttribute('data-form-input');
        if (add && !elem.hasAttribute('form')) elem.setAttribute('form', val);
        else if (!add && elem.hasAttribute('form')) elem.removeAttribute('form');
      });

      forElems.forEach(elem => {
        const val = elem.getAttribute('data-place-for');
        if (add && !elem.hasAttribute('for')) elem.setAttribute('for', val);
        else if (!add && elem.hasAttribute('for')) elem.removeAttribute('for');
      });
    };

    if (window.innerWidth > 1024) {
      toggleAttributes(this.productDetailsMobile, false);
      toggleAttributes(this.productDetailsDesktop, true);
    } else {
      toggleAttributes(this.productDetailsDesktop, false);
      toggleAttributes(this.productDetailsMobile, true);
    }
  }

  handleProductUpdate(event) {
    let loader 
    if (this.productWrapper.querySelector(`#product-form-${this.dataset.section} .product-form__submit .loading-overlay__spinner`)) loader = this.productWrapper.querySelector(`#product-form-${this.dataset.section} .product-form__submit .loading-overlay__spinner`).innerHTML
    const addButton = this.productWrapper.querySelector(`#product-form-${this.dataset.section} .product-form__submit[name="add"]`);
    if (addButton) addButton.innerHTML = `<div class="loading-overlay__spinner">${loader}</div>`
    this.handleFunctionProductUpdate(event)
    
    document.dispatchEvent(new CustomEvent('variant:change', {
      detail: {
        variant: this.currentVariant
      }
    }))
  }

  handleFunctionProductUpdate(event) {
    const input = this.getInputForEventTarget(event.target);
    const targetId = input.id;
    let targetUrl = input.dataset.productUrl;
    this.currentVariant = this.getVariantData(targetId);
    const sectionId = this.dataset.originalSection || this.dataset.section;
    this.updateSelectedSwatchValue(event);
    this.toggleAddButton(true, '', false);
    this.removeErrorMessage();

    let callback = () => {};
    if (!this.currentVariant) {
      this.toggleAddButton(true, '', true);
      this.setUnavailable();
      if(this.querySelector('.product-combined-listings')) callback = this.handleSwapProduct(sectionId, true)
    } else if (this.dataset.url !== targetUrl) {
      this.updateMedia();
      this.updateURL(targetUrl);
      this.updateVariantInput();
      this.querySelector('.product-combined-listings') ? callback = this.handleSwapProduct(sectionId) : callback = this.handleUpdateProductInfo(sectionId);
    }

    this.renderProductInfo(sectionId, targetUrl, targetId, callback);
  }

  updateSelectedSwatchValue({ target }) {
    const { value, tagName } = target;
    if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = target.closest(`.product-form__input`).querySelector('[data-selected-value]');
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
    }
  }

  updateMedia() {
    if (!this.currentVariant) return;
    if (this.currentVariant.featured_media) {
      const mediaGallery = document.getElementById(`MediaGallery-${this.dataset.section}`);
      mediaGallery.setActiveMedia(`${this.dataset.section}-${this.currentVariant.featured_media.id}`, true);
    }
    document.dispatchEvent(new CustomEvent('updateVariantMedia'))
  }

  updateURL(url) {
    if (this.dataset.updateUrl === 'false') return;
    window.history.replaceState({ }, '', `${url}${this.currentVariant?.id ? `?variant=${this.currentVariant.id}` : ''}`);
  }

  updateVariantInput() {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-${this.dataset.section}--alt, #product-form-installment`);
    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = this.currentVariant ? this.currentVariant.id : ''
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  updatePickupAvailability() {
    const pickUpAvailability = document.querySelector('pickup-availability');
    if (!pickUpAvailability) return;
    if (this.currentVariant && this.currentVariant.available) {
      pickUpAvailability.fetchAvailability(this.currentVariant.id);
    } else {
      pickUpAvailability.removeAttribute('available');
      pickUpAvailability.innerHTML = '';
    }
  }

  getInputForEventTarget(target) {
    return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
  }

  getVariantData(inputId) {
    return JSON.parse(this.getVariantDataElement(inputId).textContent);
  }

  getVariantDataElement(inputId) {
    return this.querySelector(`script[type="application/json"][data-resource="${inputId}"]`);
  }

  removeErrorMessage() {
    const section = this.closest('section');
    if (!section) return;

    const productForm = section.querySelector('product-form');
    if (productForm) productForm.handleErrorMessage();
  }

  getWrappingSection(sectionId) {
    return (
      this.closest(`section[data-section="${sectionId}"]`) || // main-product
      this.closest(`#shopify-section-${sectionId}`) || // featured-product
      null
    );
  }

  handleSwapProduct(sectionId, unavailableProduct = false)  {
    return (html) => {
      const oldContent = this.getWrappingSection(sectionId);
      if (!oldContent) {
        return;
      }
      document.getElementById(`ProductModal-${sectionId}`)?.remove();

      const response =
        html.querySelector(`section[data-section="${sectionId}"]`) /* main/quick-view */ ||
        html.getElementById(`shopify-section-${sectionId}`); /* featured product*/

      this.swapProductUtility.viewTransition(oldContent, response);
      this.updateCurrentVariant(html)
      this.updateVariantImage(html)
      if(unavailableProduct) {
        this.toggleAddButton(true, '', true);
        this.setUnavailable();
      } 
      else {
        if (this.currentVariant) this.toggleAddButton(!this.currentVariant.available, variantStrings.soldOut);
      }
    };
  }

  handleUpdateProductInfo(sectionId) {
    return (html) => {
      this.updatePickupAvailability();
      this.updateSKU(html);
      this.updateStoreLocator(html);
      this.updatePrice(html);
      this.updatePriceAlt(html);
      this.updateCurrentVariant(html);
      this.updateVariantImage(html);
      this.updateColorName(html);
      this.updateInventoryStatus(html);
      if (this.currentVariant) this.toggleAddButton(!this.currentVariant.available, variantStrings.soldOut);
      this.updateOptionValues(html);
      this.updateProductUrl(html);
      publish(PUB_SUB_EVENTS.variantChange, {
        data: {
          sectionId,
          html,
          variant: this.currentVariant,
        },
      });
    };
  }

  updateOptionValues(html) {
    const variantSelects = html.querySelector('variant-picker');
    if (variantSelects) this.innerHTML = variantSelects.innerHTML;
  }

  getSelectedOptionValues() {
    const elements = this.querySelectorAll('select option[selected], .product-form__input input:checked');

    let selectedValues = Array.from(elements).map(
      (element) => element.dataset.optionValueId
    );

    this.optionsSize = this.dataset.optionsSize
    if (selectedValues.length < this.optionsSize) {
      const fieldsets = this.querySelectorAll('.product-form__input');
      fieldsets.forEach((fieldset) => {
        const checkedInput = fieldset.querySelector('input:checked');
        if (!checkedInput) {
          const fallbackInput = fieldset.querySelector('input[checked]');
          if (fallbackInput) {
            const value = fallbackInput.dataset.optionValueId;
            if (value && !selectedValues.includes(value)) selectedValues.push(value);
          }
        }
      });
    }

    return selectedValues;
  }

  renderProductInfo(sectionId, url, targetId, callback) {
    const variantParam = this.currentVariant?.id
    ? `variant=${this.currentVariant.id}`
    : '';
    if(!url) url = this.dataset.url
    const fetchUrl = variantParam
    ? `${url}?${variantParam}&section_id=${sectionId}`
    : `${url}?section_id=${sectionId}`;
    fetch(fetchUrl)
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        callback(html);
      })
      .then(() => {
        // set focus to last clicked option value
        document.getElementById(targetId).focus();
      })
  }

  updateSKU(html) {
    const id = `sku-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
    if (!source && destination) destination.classList.add('visually-hidden')
  }

  updateStoreLocator(html) {
    const id = `store_locator-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
    if (!source && destination) destination.classList.add('visually-hidden')
  }

  updatePrice(html) {
    const id = `price-${this.dataset.section}`;
    const destination = document.getElementById(id).querySelector('.price-block__price');
    const source = html.getElementById(id).querySelector('.price-block__price');
    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) document.getElementById(id).classList.remove('visually-hidden');
  }

  updateCurrentVariant(html) {
    const id = `current-variant-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateVariantImage(html) {
    const id = `variant-image-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updatePriceAlt(html) {
    const id = `price-${this.dataset.section}--alt`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateColorName(html) {
    const id = `color-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateInventoryStatus(html) {
    const id = `inventory-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateProductUrl(html) {
    const currentUrl = window.location.href;
    const id = `#product-url-${this.dataset.section} input`;
    const destination = document.querySelector(id);
    const source = html.querySelector(id);
    if (source && destination) destination.setAttribute('value', `${currentUrl}`);
    if (destination) destination.classList.remove('visually-hidden');
  }

  toggleAddButton(disable = true, text, modifyClass = true) {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-${this.dataset.section}--alt`);
    const loader = this.productWrapper.querySelector('.loading-overlay__spinner').innerHTML
    productForms.forEach((productForm) => {
      const addButton = productForm.querySelector('[name="add"]');
      if (!addButton) return;
      let priceContent = ''
      let buttonIcon = ''
      if(this.buttonIcon) buttonIcon = document.querySelector('.product-form__buttons-icon').innerHTML
      if(this.priceInsideButton) priceContent = document.getElementById(`price-${this.dataset.section}`).querySelector('.price-block__price').innerHTML
      if (disable) {
        addButton.setAttribute('disabled', true);
        addButton.setAttribute('data-sold-out', true);
        if (text) addButton.innerHTML = `<span class="price-inside-button">${priceContent}</span><span>${text}</span><span class="product-form__buttons-icon">${buttonIcon}</span> <div class="loading-overlay__spinner hidden">${loader}</div>`;
      }
      else {
        addButton.removeAttribute('disabled');
        addButton.removeAttribute('data-sold-out');
        addButton.innerHTML = addButton.dataset.preOrder === 'true' ? `<span class="price-inside-button">${priceContent}</span><span>${variantStrings.preOrder}</span><span class="product-form__buttons-icon">${buttonIcon}</span> <div class="loading-overlay__spinner hidden">${loader}</div>` : `<span class="price-inside-button">${priceContent}</span><span>${variantStrings.addToCart}</span><span class="product-form__buttons-icon">${buttonIcon}</span> <div class="loading-overlay__spinner hidden">${loader}</div>`;
      }
      if (!modifyClass) return;
    });
  }

  setUnavailable() {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-${this.dataset.section}--alt`);
    const loader = this.productWrapper.querySelector('.loading-overlay__spinner').innerHTML
    productForms.forEach((productForm) => {
      const addButton = productForm.querySelector('[name="add"]');
      if (!addButton) return;
      addButton.removeAttribute('data-sold-out');
      let priceContent = ''
      let buttonIcon = ''
      if(this.buttonIcon) buttonIcon = document.querySelector('.product-form__buttons-icon').innerHTML
      if(this.priceInsideButton) priceContent = document.getElementById(`price-${this.dataset.section}`).querySelector('.price').innerHTML
      addButton.innerHTML = `<span class="price-inside-button">${priceContent}</span><span>${variantStrings.unavailable}</span> <span class="product-form__buttons-icon">${buttonIcon}</span> <div class="loading-overlay__spinner hidden">${loader}</div>`;

      const price = document.getElementById(`price-${this.dataset.section}`);
      if (price) price.classList.add('visually-hidden');

      const priceAlt = document.getElementById(`price-${this.dataset.section}--alt`);
      if (priceAlt) priceAlt.classList.add('visually-hidden');

      const inventory = document.getElementById(`inventory-${this.dataset.section}`);
      if (inventory) inventory.classList.add('visually-hidden');

      const sku = document.getElementById(`sku-${this.dataset.section}`);
      if (sku) sku.classList.add('visually-hidden');
      
      const storeLocator = document.getElementById(`store_locator-${this.dataset.section}`);
      if (storeLocator) storeLocator.classList.add('visually-hidden');
    });
  }
}

customElements.define('variant-picker', VariantPicker);

class CountdownTimer extends HTMLElement {
  constructor() {
    super();

    this.endDate = this.getAttribute('end-date');
    this.endTime = this.getAttribute('end-time') || "00:00";
    this.timezoneOffset = this.getAttribute('timezone-offset');
    this.expirationAction = this.getAttribute('expiration-action');
    this.enableAnimation = this.getAttribute('enable-animation') === "true";
    this.sectionId = this.getAttribute('section-id');
    this.productHandle = this.getAttribute('product-handle');
    this.animationDuration = 300;

    this.timeState = {
      days: ['0', '0'],
      hours: ['0', '0'],
      minutes: ['0', '0'],
      seconds: ['0', '0']
    };

    this.elements = {};

    this.init = this.init.bind(this);
    this.onSectionLoad = this.onSectionLoad.bind(this);
    this.updateTimer = this.updateTimer.bind(this);

    if (Shopify.designMode) {
      document.addEventListener('shopify:section:load', this.onSectionLoad);
    }
  }

  connectedCallback() {
    requestAnimationFrame(this.init);
  }

  disconnectedCallback() {
    if (this.updateTimerIntervalId) clearInterval(this.updateTimerIntervalId);
    
    if (Shopify.designMode) {
      document.removeEventListener('shopify:section:load', this.onSectionLoad);
    }
  }

  onSectionLoad(e) {
    const sectionElement = document.getElementById('shopify-section-' + e.detail.sectionId);
    if (sectionElement && (sectionElement.contains(this) || sectionElement.classList.contains('shopify-section-announcement-bar'))) {
      this.init();
    }
  }

  async init() {
    if (this.updateTimerIntervalId) clearInterval(this.updateTimerIntervalId);

    if (!this.endDate && this.productHandle) {
      await this.fetchEndDateTimeAndMessage();
    }

    this.deadlineTimestamp = new Date(`${this.endDate}T${this.endTime}`).getTime();
    
    const isValid = this.isDateValid(this.endDate) && this.isTimeValid(this.endTime) && this.deadlineTimestamp;
    const remainingTime = this.getRemainingTime(this.deadlineTimestamp);

    if (!isValid || remainingTime.days > 99) {      
      if (Shopify.designMode) {
        this.classList.add('countdown--visible');
        return;
      } 
      this.removeCountdownTimer();
      return;
    }

    this.cacheElements();

    if (remainingTime.total > 0) {
      this.updateTimer(true); 
      this.updateTimerIntervalId = setInterval(this.updateTimer, 1000);
    } else {
      this.onTimerExpire();
    }

    this.classList.add('countdown--visible');   
  }

  cacheElements() {
    const q = (selector) => this.querySelector(selector);
    const timer = q('.countdown__timer');

    this.elements = {
      timer,
      message: q('.countdown-complete-message'),
      wrapper: this.closest('.countdown-timer-wrapper'),
      digits: timer ? {
        days: [q('.countdown-days-tens'), q('.countdown-days-ones')],
        hours: [q('.countdown-hours-tens'), q('.countdown-hours-ones')],
        minutes: [q('.countdown-minutes-tens'), q('.countdown-minutes-ones')],
        seconds: [q('.countdown-seconds-tens'), q('.countdown-seconds-ones')]
      } : null
    };
  }

  async fetchEndDateTimeAndMessage() {
    try {
      const response = await fetch(`/products/${this.productHandle}`);
      const html = await response.text();
      const parser = new DOMParser();
      const timerOnProductPage = parser.parseFromString(html, 'text/html').querySelector('.countdown');

      if (!timerOnProductPage) throw new Error("No timer found");

      const endDate = timerOnProductPage.getAttribute('end-date');
      const endTime = timerOnProductPage.getAttribute('end-time');
      
      this.setAttribute('end-date', endDate);
      this.setAttribute('end-time', endTime);
      
      const completeMessage = timerOnProductPage.getAttribute('complete-message');
      const completeMessageElement = this.querySelector('.countdown__complete-message');

      if (completeMessageElement) {
        completeMessageElement.innerHTML = completeMessage;
        this.setAttribute('complete-message', completeMessage);
      }
      
      this.endDate = endDate;
      this.endTime = endTime;
      
      this.deadlineTimestamp = new Date(`${this.endDate}T${this.endTime}`).getTime();
    } catch (err) { 
      this.removeCountdownTimer();
    }
  }

  updateTimer(firstRun = false) {
    const remainingTime = this.getRemainingTime(this.deadlineTimestamp);

    if (remainingTime.total <= 0) {
      clearInterval(this.updateTimerIntervalId);
      this.onTimerExpire();
      return;
    }

    const pad = (num) => num.toString().padStart(2, '0');
    
    const nextValues = {
      days: pad(remainingTime.days),
      hours: pad(remainingTime.hours),
      minutes: pad(remainingTime.minutes),
      seconds: pad(remainingTime.seconds)
    };

    if (!this.elements.digits) {
      this.cacheElements();
      if (!this.elements.digits) return;
    }

    Object.keys(nextValues).forEach(unit => {
      const nextStr = nextValues[unit];
      const currentStr = this.timeState[unit].join('');

      if (firstRun || nextStr !== currentStr) {
        if (firstRun || nextStr[0] !== this.timeState[unit][0]) {
          this.animateDigit(this.elements.digits[unit][0], nextStr[0], this.timeState[unit][0], firstRun);
          this.timeState[unit][0] = nextStr[0];
        }

        if (firstRun || nextStr[1] !== this.timeState[unit][1]) {
          this.animateDigit(this.elements.digits[unit][1], nextStr[1], this.timeState[unit][1], firstRun);
          this.timeState[unit][1] = nextStr[1];
        }
      }
    });
  }
  
  animateDigit(wrapper, newValue, oldValue, skipAnimation) {
    if (!wrapper) return;

    const currentNumber = wrapper.querySelector('.countdown__number--current');
    
    if (!this.enableAnimation || skipAnimation) {
      currentNumber.innerText = newValue; 
      return;
    }

    const previousNumber = wrapper.querySelector('.countdown__number--previous');
  
    previousNumber.innerText = oldValue; 
    currentNumber.innerText = newValue; 
  
    previousNumber.classList.add('countdown__number--animated');
    currentNumber.classList.add('countdown__number--animated');
  
    setTimeout(() => {
      previousNumber.classList.remove('countdown__number--animated');
      currentNumber.classList.remove('countdown__number--animated');
    }, this.animationDuration); 
  }

  onTimerExpire() {
    switch (this.expirationAction) {
      case "hide_timer":
        this.removeCountdownTimer();

        break;
      case "show_message":
        if (!this.elements.message) {
          this.removeCountdownTimer();
          break;
        }

        if (this.elements.timer) this.elements.timer.remove();
        this.elements.message.removeAttribute('hidden'); 

        break;
      case "show_zeros_and_message":
        if (this.elements.message) {
          this.elements.message.removeAttribute('hidden');
        }

        this.updateTimer(true); 

        break;
    }
  }

  removeCountdownParent() {
    const sectionElement = document.getElementById('shopify-section-' + this.sectionId);

    if (!sectionElement) return;
    
    const sectionAssociationsMap = new Map([
      ['media-with-text', {
        contentWrapperClass: '.media-with-text__content-wrapper',
        removalTargetClass: '.section:has(.placeholder-svg)'
      }],
      ['section-image-banner', {
        contentWrapperClass: '.banner__content-wrapper',
        removalTargetClass: '.banner__content-wrapper'
      }],
      ['section-newsletter', {
        contentWrapperClass: '.banner__content-wrapper',
        removalTargetClass: '.banner__content-wrapper'
      }],
      ['section-video-banner', {
        contentWrapperClass: '.banner__content-wrapper',
        removalTargetClass: '.banner__content-wrapper'
      }],    
      ['rich-text', {
        contentWrapperClass: '.section-container',
        removalTargetClass: '.section-container'
      }],
      ['shopify-section-announcement-bar', {
        contentWrapperClass: '.announcement-block',
        removalTargetClass: '.announcement-block',
        sliderInstance: typeof announcementBarSwiper !== 'undefined' ? announcementBarSwiper : null,
        sectionWrapperClass: '.announcement-bar',
      }],
    ]);
    
    const matchingEntry = Array.from(sectionAssociationsMap).find(([sectionClass]) =>
      sectionElement.classList.contains(sectionClass)
    );

    if (matchingEntry) {
      const { contentWrapperClass, removalTargetClass, sliderInstance, sectionWrapperClass } = matchingEntry[1];
      const contentWrapper = sliderInstance ? this.closest(contentWrapperClass) : sectionElement.querySelector(contentWrapperClass);

      if (contentWrapper && this.getElementContentHeight(contentWrapper) === 0) {
        const elementToRemove = sliderInstance ? this.closest(removalTargetClass) : sectionElement.querySelector(removalTargetClass);

        if (!sliderInstance) {
          elementToRemove?.remove();
          return;
        }
        
        const sectionWrapper = sectionElement.querySelector(sectionWrapperClass);
        const isLastSlide = sectionElement.querySelectorAll(contentWrapperClass).length === 1;

        if (sliderInstance && elementToRemove) {
          sliderInstance.removeSlide(elementToRemove.dataset.swiperSlideIndex);
        }

        if (sectionWrapper && this.getElementContentHeight(sectionWrapper) === 0 && isLastSlide) {          
          sectionWrapper.remove();
        }
      }
    }    
  }  

  removeCountdownTimer() {
    const wrapper = this.closest('.countdown-timer-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    this.removeCountdownParent();
    if (wrapper) wrapper.remove();
  }

  getRemainingTime(deadline) {
    const total = deadline - this.getTimestampInStoreTimezone();
    if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    return {
      total,
      days: Math.floor(total / (1000 * 60 * 60 * 24)),
      hours: Math.floor((total / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((total / 1000 / 60) % 60),
      seconds: Math.floor((total / 1000) % 60)
    };
  }

  getTimestampInStoreTimezone() {
    const match = this.timezoneOffset.match(/([+-]?)(\d{2})(\d{2})/);
    if (!match) return Date.now();
  
    const now = new Date();
    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3], 10);
    const offsetMilliseconds = sign * ((hours * 60 + minutes) * 60000);
    
    return now.getTime() + (now.getTimezoneOffset() * 60000) + offsetMilliseconds;
  }

  getElementContentHeight(element) {
    const style = getComputedStyle(element);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);

    return element.clientHeight - paddingTop - paddingBottom;
  }

  isDatePatternValid(dateString) {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateString); 
  }

  isTimePatternValid(timeString) {
    return /^\d{2}:\d{2}$/.test(timeString); 
  }

  isDateValid(dateString) {
    if (!this.isDatePatternValid(dateString)) return false;

    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day;
  }

  isTimeValid(timeString) {
    if (!this.isTimePatternValid(timeString)) return false;

    const [hours, minutes] = timeString.split(":").map(Number);

    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }
}

customElements.define('countdown-timer', CountdownTimer);

(() => {
  const sliders = document.querySelectorAll('.swiper-product-card');
  const STATE = new WeakMap();

  const isRTL = () => (document.documentElement.dir || '').toLowerCase() === 'rtl';

  const runIdle = (fn, timeout = 1500) => {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout });
    else setTimeout(fn, 0);
  };

  function slideToIndex(s, idx, speed = 0) {
    if (!s?.swiper) return;
    if (s.loop && typeof s.swiper.slideToLoop === 'function') {
      s.swiper.slideToLoop(idx, speed);
    } else {
      s.swiper.slideTo(idx, speed);
    }
  }

  function invalidateHoverCache(s) {
    s.hoverRect = null;
    s.hoverWidth = 0;
    s.hoverTotalSlides = s.wrapper ? s.wrapper.children.length : 0;
  }

  const goNext = (s, speed) => {
    if (!s?.swiper) return;
    return isRTL() ? s.swiper.slidePrev(speed) : s.swiper.slideNext(speed);
  };

  const goPrev = (s, speed) => {
    if (!s?.swiper) return;
    return isRTL() ? s.swiper.slideNext(speed) : s.swiper.slidePrev(speed);
  };

  function resetToFirstSlide(s) {
    if (!s?.swiper) return;
    s.pendingSlide = null;
    slideToIndex(s, 0, 0);
  }

  function getState(slider) {
    let s = STATE.get(slider);
    if (!s) {
      s = {
        inited: false,
        initScheduled: false,

        slider,
        swiper: null,

        speed: 300,
        autoplaySpeed: 5000,
        autoplayEnabled: false,
        hoverSlider: false,
        loop: false,

        slidesLoaded: false,
        isDragging: false,

        isSlideReady: true,
        pendingSlide: null,

        wrapper: null,
        nextBtn: null,
        prevBtn: null,
        paginationEl: null,

        hoverRAF: 0,
        hoverClientX: 0,
        hoverRect: null,
        hoverWidth: 0,
        hoverTotalSlides: 0,

        onIntent: null,
        onNextClick: null,
        onPrevClick: null,
        onNextKey: null,
        onPrevKey: null,
        onMouseMove: null,
        onMouseLeave: null,
        onMouseEnter: null,
        onCardClick: null,
        onSwiperUpdate: null,

        ro: null,

        onTouchStart: null,
        onPointerDown: null,
      };
      STATE.set(slider, s);
    }
    return s;
  }

  function initializeSwiper(slider) {
    if (!slider || slider.dataset.initialized === 'true') return;
    slider.dataset.initialized = 'true';

    const s = getState(slider);

    s.speed = parseInt(slider.dataset.transitionDuration, 10) || 300;
    s.autoplaySpeed = parseInt(slider.dataset.autoplaySpeed, 10) || 5000;
    s.autoplayEnabled = slider.dataset.autoplay === 'true';
    s.hoverSlider = slider.dataset.hoverAutoplay === 'true';
    s.loop = slider.dataset.loop === 'true';

    s.wrapper = slider.querySelector('.swiper-wrapper');
    s.paginationEl = slider.querySelector('.swiper-pagination');
    s.nextBtn = slider.querySelector('.swiper-button-next');
    s.prevBtn = slider.querySelector('.swiper-button-prev');

    scheduleInitLight(s);
    armIntent(s);
    armTouchPreload(s);

    s.onSwiperUpdate = (event) => onSwiperUpdate(s, event);
    slider.addEventListener('swiper:update', s.onSwiperUpdate);
  }

  function scheduleInitLight(s) {
    if (s.inited || s.initScheduled) return;
    s.initScheduled = true;

    const run = () => {
      s.initScheduled = false;
      initLightSwiper(s);
      bindControls(s);
      bindAutoplayHover(s);
      bindHoverSlider(s);
      bindDraggingGuard(s);
      observeSizeCache(s);
    };

    requestAnimationFrame(() => runIdle(run, 1200));
  }

  function initLightSwiper(s) {
    if (s.inited) return;
    if (!s.slider || !s.wrapper) return;

    s.inited = true;

    s.swiper = new Swiper(s.slider, {
      a11y: { slideRole: 'listitem' },
      slidesPerView: 1,
      loop: s.loop,
      pagination: {
        el: s.paginationEl,
        type: 'bullets'
      },
      navigation: {
        nextEl: s.nextBtn,
        prevEl: s.prevBtn
      },
      speed: s.speed,
      autoplay: s.autoplayEnabled ? { delay: s.autoplaySpeed, disableOnInteraction: false } : false,
      lazy: { loadPrevNext: true },
      roundLengths: false,

      on: {
        touchMove: () => { s.isDragging = true; },
        touchEnd:  () => { setTimeout(() => { s.isDragging = false; }, 0); }
      }
    });

    invalidateHoverCache(s);
  }

  function bindControls(s) {
    const next = s.nextBtn;
    const prev = s.prevBtn;

    if (next) {
      s.onNextClick = () => {
        ensureAllSlidesLoaded(s, 1, true);
        if (!s.swiper) return;

        if (s.isSlideReady) goNext(s);
        else s.pendingSlide = 'next';
      };
      next.addEventListener('click', s.onNextClick, { passive: true });

      s.onNextKey = (e) => {
        if ((e.code || '').toUpperCase() !== 'ENTER') return;
        ensureAllSlidesLoaded(s, 1, true);
        if (!s.swiper) return;

        if (s.isSlideReady) goNext(s);
        else s.pendingSlide = 'next';
      };
      next.addEventListener('keyup', s.onNextKey);
    }

    if (prev) {
      s.onPrevClick = (e) => {
        e.preventDefault();
        ensureAllSlidesLoaded(s, 1, true);
        if (!s.swiper) return;

        if (s.isSlideReady) goPrev(s);
        else s.pendingSlide = 'prev';
      };
      prev.addEventListener('click', s.onPrevClick, { passive: false });

      s.onPrevKey = (e) => {
        if ((e.code || '').toUpperCase() !== 'ENTER') return;
        e.preventDefault();
        ensureAllSlidesLoaded(s, 1, true);
        if (!s.swiper) return;

        if (s.isSlideReady) goPrev(s);
        else s.pendingSlide = 'prev';
      };
      prev.addEventListener('keyup', s.onPrevKey);
    }
  }

  function bindAutoplayHover(s) {
    if (!(window.innerWidth > 768 && s.autoplayEnabled)) return;

    const onEnter = () => {
      ensureAllSlidesLoaded(s, 1, true);
      if (!s.swiper) return;

      s.swiper.params.autoplay = { delay: s.autoplaySpeed, disableOnInteraction: false };
      s.swiper.autoplay?.start?.();
    };

    const onLeave = () => {
      if (!s.swiper?.autoplay?.running) return;
      s.swiper.autoplay.stop();
    };

    s.slider.addEventListener('mouseenter', onEnter, { passive: true });
    s.slider.addEventListener('mouseleave', onLeave, { passive: true });
  }

  function bindHoverSlider(s) {
    if (!(window.innerWidth > 768 && s.hoverSlider)) return;

    const onEnter = () => {
      ensureAllSlidesLoaded(s, 1, true);
      invalidateHoverCache(s);
    };

    const onMove = (e) => {
      if (!s.swiper) return;
      s.hoverClientX = e.clientX;

      if (s.hoverRAF) return;
      s.hoverRAF = requestAnimationFrame(() => {
        s.hoverRAF = 0;
        if (!s.swiper) return;

        if (!s.hoverRect) s.hoverRect = s.slider.getBoundingClientRect();
        const rect = s.hoverRect;

        const width = s.hoverWidth || rect.width || s.slider.clientWidth;
        if (!width) return;

        const x = s.hoverClientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / width));

        const total = s.hoverTotalSlides || (s.wrapper ? s.wrapper.children.length : 0);
        if (!total) return;

        const idxRaw = isRTL() ? Math.floor((1 - pct) * total) : Math.floor(pct * total);
        const idx = Math.max(0, Math.min(total - 1, idxRaw));

        slideToIndex(s, idx, 0);
      });
    };

    const onLeave = () => {
      s.hoverRect = null;
      slideToIndex(s, 0, 0);
    };

    s.slider.addEventListener('mouseenter', onEnter, { passive: true });
    s.slider.addEventListener('mousemove', onMove, { passive: true });
    s.slider.addEventListener('mouseleave', onLeave, { passive: true });
  }

  function bindDraggingGuard(s) {
    const card = s.slider.closest('.card');
    if (!card) return;

    const onCardClick = (e) => {
      if (s.isDragging) e.preventDefault();
    };
    card.addEventListener('click', onCardClick, { passive: false });
  }

  function observeSizeCache(s) {
    if (!('ResizeObserver' in window)) return;

    s.ro = new ResizeObserver(() => {
      invalidateHoverCache(s);
    });

    s.ro.observe(s.slider);
  }

  function armIntent(s) {
    if (s.onIntent) return;

    s.onIntent = () => {
      scheduleInitLight(s);
      ensureAllSlidesLoaded(s, 1, false);
    };

    s.slider.addEventListener('pointerenter', s.onIntent, { once: true, passive: true });
    s.slider.addEventListener('pointerdown',  s.onIntent, { once: true, passive: true });
    s.slider.addEventListener('focusin',      s.onIntent, { once: true, passive: true });

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        const e = entries && entries[0];
        if (!e || !e.isIntersecting) return;
        io.disconnect();
        scheduleInitLight(s);
        runIdle(() => ensureAllSlidesLoaded(s, 1, false), 1200);
      }, { root: null, rootMargin: '400px 0px', threshold: 0.01 });

      io.observe(s.slider);
    }
  }

  function armTouchPreload(s) {
    if (s.onTouchStart || s.onPointerDown) return;

    s.onTouchStart = () => {
      scheduleInitLight(s);
      ensureAllSlidesLoaded(s, 1, true);
    };

    s.onPointerDown = () => {
      scheduleInitLight(s);
      ensureAllSlidesLoaded(s, 1, true);
    };

    s.slider.addEventListener('touchstart', s.onTouchStart, { once: true, passive: true });
    s.slider.addEventListener('pointerdown', s.onPointerDown, { once: true, passive: true });
  }

  function ensureAllSlidesLoaded(s, fromIndex, immediate = false) {
    if (!s || s.slidesLoaded) return;
    if (!s.slider || !s.wrapper) return;

    if (immediate) {
      setTimeout(() => loadAllSlides(s, fromIndex), 0);
    } else {
      runIdle(() => loadAllSlides(s, fromIndex), 1500);
    }
  }

  function loadAllSlides(s, index) {
    if (s.slidesLoaded) return;

    const slider = s.slider;
    if (!slider.classList.contains('swiper-loaded')) slider.classList.add('swiper-loaded');

    const totalSlides = parseInt(slider.dataset.totalSlides, 10) || 0;
    const productImages = (slider.getAttribute('data-imgs') || '').split(',').filter(Boolean);
    const productImageAlts = (slider.getAttribute('data-img-alts') || '').split(',');
    const productImageSizes = (slider.getAttribute('data-img-sizes') || '').split('||');
    const productImageSrcsets = (slider.getAttribute('data-img-srcsets') || '').split('||');

    let imagesLoading = '';
    let preloadImgs = [];

    if (slider.hasAttribute('data-images-loading')) {
      imagesLoading = slider.getAttribute('data-images-loading') || '';
      preloadImgs = (slider.getAttribute('data-preload-imgs') || '').split(',').filter(Boolean);
    }

    if (
      imagesLoading === '' ||
      imagesLoading === 'fade_scale' ||
      imagesLoading === 'loader' ||
      imagesLoading === 'disable' ||
      imagesLoading === 'pixelate'
    ) {
      s.isSlideReady = true;
    }

    const frag = document.createDocumentFragment();

    for (let i = index; i < totalSlides; i++) {
      const image = productImages[i] || '';
      const alt = productImageAlts[i] || '';
      const sizes = productImageSizes[i] || '';
      const srcset = productImageSrcsets[i] || '';

      const newSlide = document.createElement('li');
      newSlide.classList.add('card__product-image', 'swiper-slide', 'aspect-ratio');

      const preloadImage =
        (imagesLoading && preloadImgs.length > 0) ? (preloadImgs[i] || preloadImgs[0] || '') : '';

      if (imagesLoading && imagesLoading !== 'fade_scale') {
        newSlide.innerHTML =
          `<figure class="lazy-image lazy-image--${imagesLoading}">
            <div class="lazy-image__preloader lazy-image__preloader--full lazy-image__preloader-${imagesLoading}" aria-hidden="true">
              <img src="${preloadImage}" loading="eager" width="10" height="10" alt="${alt}">
            </div>
            <img src="${image}" srcset="${srcset}" sizes="${sizes}" loading="lazy"
              onload="this.parentNode.classList.add('lazyloaded');" alt="${alt}">
          </figure>`;
      } else if (imagesLoading === 'fade_scale') {
        newSlide.innerHTML =
          `<figure class="lazy-image lazy-image--${imagesLoading}">
            <img src="${image}" srcset="${srcset}" sizes="${sizes}" loading="lazy"
              onload="this.parentNode.classList.add('lazyloaded');" alt="${alt}">
          </figure>`;
      } else {
        newSlide.innerHTML = `<img src="${image}" srcset="${srcset}" sizes="${sizes}" alt="${alt}">`;
      }

      frag.appendChild(newSlide);

      if (
        imagesLoading &&
        imagesLoading !== 'fade_scale' &&
        imagesLoading !== 'loader' &&
        imagesLoading !== 'pixelate'
      ) {
        const preloadImg = newSlide.querySelector('.lazy-image__preloader img');
        if (preloadImg) {
          s.isSlideReady = false;

          const done = () => {
            s.isSlideReady = true;

            if (s.pendingSlide === 'next') goNext(s);
            else if (s.pendingSlide === 'prev') goPrev(s);

            s.pendingSlide = null;
          };

          if (preloadImg.complete) done();
          else preloadImg.addEventListener('load', done, { once: true });
        }
      }
    }

    s.wrapper.appendChild(frag);
    s.slidesLoaded = true;

    safeSwiperUpdate(s);
    invalidateHoverCache(s);
  }

  function safeSwiperUpdate(s) {
    if (!s.swiper) return;

    if (s.loop && s.swiper.loopDestroy && s.swiper.loopCreate) {
      try { s.swiper.loopDestroy(); } catch (e) {}
    }

    try {
      s.swiper.update();
      s.swiper.updateSlides?.();
      s.swiper.updateSize?.();
      s.swiper.updateProgress?.();
      s.swiper.updateSlidesClasses?.();
    } catch (e) {}

    if (s.loop && s.swiper.loopCreate) {
      try {
        s.swiper.loopCreate();
        s.swiper.update();
      } catch (e) {}
    }
  }

  function onSwiperUpdate(s, event) {
    const slider = s.slider;
    const wrapper = s.wrapper;
    if (!slider || !wrapper) return;
    if (!event?.detail) return;

    setTimeout(() => {
      const currentAlt = event.detail.currentAlt;
      const swatchIndex = event.detail.index;

      if (currentAlt === 'all') {
        wrapper.innerHTML = '';
        s.slidesLoaded = false;
        loadAllSlides(s, 0);
        s.slidesLoaded = true;

        resetToFirstSlide(s);
        invalidateHoverCache(s);
        return;
      }

      loadAllSlidesByVariant(s, currentAlt, swatchIndex);
      resetToFirstSlide(s);
      invalidateHoverCache(s);

      if (!slider.querySelector('.swiper-wrapper-only-variant')) {
        let variantFirstImageIndex = swatchIndex;

        if (!variantFirstImageIndex) {
          const productImageAlts = (slider.getAttribute('data-img-alts') || '').split(',');
          variantFirstImageIndex = productImageAlts.findIndex((alt) => alt && alt.includes(currentAlt));
        }

        wrapper.innerHTML = '';
        s.slidesLoaded = false;
        loadAllSlides(s, 0);
        s.slidesLoaded = true;

        slideToIndex(s, variantFirstImageIndex || 0, 0);
        invalidateHoverCache(s);
      }
    }, 0);
  }

  function loadAllSlidesByVariant(s, currentAlt, swatchImageIndex) {
    const slider = s.slider;
    const wrapper = s.wrapper;
    if (!slider || !wrapper) return;

    if (!slider.classList.contains('swiper-loaded')) slider.classList.add('swiper-loaded');

    const productImages = (slider.getAttribute('data-imgs') || '').split(',');
    const productImageAlts = (slider.getAttribute('data-img-alts') || '').split(',');
    const productImageSizes = (slider.getAttribute('data-img-sizes') || '').split('||');
    const productImageSrcsets = (slider.getAttribute('data-img-srcsets') || '').split('||');

    wrapper.innerHTML = '';

    const allImages = productImages.map((image, idx) => ({
      image,
      alt: productImageAlts[idx] || '',
      sizes: productImageSizes[idx] || '',
      srcset: productImageSrcsets[idx] || ''
    }));

    let filtered = allImages.filter(({ alt }) => alt && alt.includes(currentAlt));

    if (filtered.length === 0) {
      if (swatchImageIndex !== undefined && allImages[swatchImageIndex]) filtered = [allImages[swatchImageIndex]];
      else filtered = allImages;
    }

    const frag = document.createDocumentFragment();

    filtered.forEach(({ image, alt, sizes, srcset }) => {
      const li = document.createElement('li');
      li.classList.add('card__product-image', 'swiper-slide', 'aspect-ratio');
      li.innerHTML = `<img src="${image}" srcset="${srcset}" sizes="${sizes}" alt="${alt}" loading="lazy"><div class="swiper-lazy-preloader"></div>`;
      frag.appendChild(li);
    });

    wrapper.appendChild(frag);

    s.slidesLoaded = true;
    safeSwiperUpdate(s);

    slider.style.setProperty('--total-slides', String(wrapper.children.length));

    resetToFirstSlide(s);
    invalidateHoverCache(s);
  }

  sliders.forEach(initializeSwiper);

  document.addEventListener('shopify:section:load', (event) => {
    const local = event.target?.querySelectorAll?.('.swiper-product-card') || [];
    local.forEach(initializeSwiper);
    if (typeof preloadImages === 'function') preloadImages();
  });

  document.addEventListener('ajax-page-load', (event) => {
    const sectionId = event.detail?.sectionId;
    if (!sectionId) return;

    const local = document.querySelectorAll(`#shopify-section-${sectionId} .swiper-product-card`);
    local.forEach(initializeSwiper);
    if (typeof preloadImages === 'function') preloadImages();
  });

  document.addEventListener('filters-ajax-page-load', () => {
    document.querySelectorAll('.swiper-product-card').forEach(initializeSwiper);
    if (typeof preloadImages === 'function') preloadImages();
  });

  document.addEventListener('recommendations:loaded', () => {
    document.querySelectorAll('.product-recommendations .swiper-product-card').forEach(initializeSwiper);
    if (typeof preloadImages === 'function') preloadImages();
  });
})();

  class InfiniteScroll extends HTMLElement {
    constructor() {
      super();
  
      this.sectionId = this.closest('section').id.split('shopify-section-')[1]
      if(this.closest('.section-collection-tabs')) {
        this.sectionId = this.closest('.component-tabs__content').id.split('content-')[1]
      }
      this.querySelector('button').addEventListener('click', this.onClickHandler.bind(this));
      if (this.dataset.trigger == 'infinite') {
        new IntersectionObserver(this.handleIntersection.bind(this), {rootMargin: '0px 0px 200px 0px'}).observe(this);
      }
    }
  
    onClickHandler() {
      if (this.classList.contains('loading') || this.classList.contains('disabled')) return;
      this.classList.add('loading');
      this.classList.add('disabled');
      if (this.querySelector('.loading-overlay__spinner')) {
        this.querySelector('button').appendChild(this.querySelector('.loading-overlay__spinner'))
        this.querySelector('.loading-overlay__spinner').classList.remove('hidden')
      }
      const sections = InfiniteScroll.getSections(this.sectionId);
      sections.forEach(() => {
        const url = this.dataset.url;
        InfiniteScroll.renderSectionFromFetch(url, this.sectionId);
      });
    }
  
    handleIntersection(entries, observer) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          this.onClickHandler();
        }
      });
    }
  
    static getSections(sectionID) {
      return [
        {
          section: document.getElementById(`product-grid--${sectionID}`).dataset.id,
        }
      ]
    }
  
    static renderSectionFromFetch(url, sectionId) {
      fetch(url)
        .then(response => response.text())
        .then((responseText) => {
          const html = responseText;
          InfiniteScroll.renderPagination(html, sectionId);
          InfiniteScroll.renderProductGridContainer(html, sectionId);
        })
        .catch((e) => {
          console.error(e);
        });
    }
  
    static renderPagination(html, sectionId) {
      const container = document.getElementById(`ProductGridContainer--${sectionId}`).querySelector('.pagination-wrapper');
      const pagination = new DOMParser().parseFromString(html, 'text/html').getElementById(`ProductGridContainer--${sectionId}`).querySelector('.pagination-wrapper');
      if (pagination) {
        container.innerHTML = pagination.innerHTML;
      } else {
        container.remove();
      }
    }
  
    static renderProductGridContainer(html, sectionId) {
      const container = document.getElementById(`product-grid--${sectionId}`);
      const products = new DOMParser().parseFromString(html, 'text/html').getElementById(`product-grid--${sectionId}`);
      container.insertAdjacentHTML('beforeend', products.innerHTML);
      document.dispatchEvent(new CustomEvent('ajax-page-load', {
        detail: {
          sectionId: sectionId
        }
      }))
    }
  }
  customElements.define('infinite-scroll', InfiniteScroll);  

  class InputCheckbox extends HTMLElement {
    constructor() {
      super();
  
      theme.initWhenVisible({
        element: this,
        callback: this.init.bind(this),
        threshold: 600
      });
    }
  
    init() {
      this.querySelector('input').addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          this.querySelector('input').hasAttribute('checked') ? this.querySelector('input').removeAttribute('checked') : this.querySelector('input').setAttribute('checked', 'checked')
        }
      });
    }
  }
  customElements.define('input-checkbox', InputCheckbox);

  class AnimateSticky extends HTMLElement {
    constructor() {
      super();
  
      // state
      this._inited = false;
      this._initScheduled = false;
  
      this._topObserver = null;
      this._bottomObserver = null;
  
      this._topSentinel = null;
      this._bottomSentinel = null;
  
      this._buttonsVisible = true;
      this._atBottom = false;
  
      this._shown = false;
  
      // fallback
      this._buttons = null;
      this._buttonsTop = 0;
      this._raf = 0;
  
      this._reveal = () => {
        if (this._shown) return;
        this._shown = true;
        this.setAttribute('animate', '');
      };
  
      this._hide = () => {
        if (!this._shown) return;
        this._shown = false;
        this.removeAttribute('animate');
      };
    }
  
    connectedCallback() {
      this._deferInitAfterLoad();
    }
  
    disconnectedCallback() {
      this.destroy();
    }
  
    _deferInitAfterLoad() {
      if (this._inited || this._initScheduled) return;
      this._initScheduled = true;
  
      const run = () => {
        this._initScheduled = false;
        this.init();
      };
  
      const schedule = () => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(run, { timeout: 2000 });
        } else {
          setTimeout(run, 0);
        }
      };
  
      if (document.readyState === 'complete') schedule();
      else window.addEventListener('load', schedule, { once: true });
    }
  
    init() {
      if (this._inited) return;
      this._inited = true;
  
      const section = this.closest('section');
      if (!section) return;
  
      const buttons = section.querySelector('.product-form__buttons');
      if (!buttons) return;
  
      if ('IntersectionObserver' in window) {
        this._initIO(buttons);
      } else {
        this._initFallback(buttons);
      }
    }
  
    _initIO(buttons) {
      const topSentinel = document.createElement('span');
      topSentinel.className = 'animate-sticky-sentinel';
      topSentinel.setAttribute('aria-hidden', 'true');
      topSentinel.style.cssText = 'display:block;width:1px;height:1px;margin:0;padding:0;';
      buttons.parentNode.insertBefore(topSentinel, buttons);
      this._topSentinel = topSentinel;
  
      const bottomSentinel = document.createElement('span');
      bottomSentinel.className = 'animate-sticky-bottom-sentinel';
      bottomSentinel.setAttribute('aria-hidden', 'true');
      bottomSentinel.style.cssText = 'display:block;width:1px;height:1px;margin:0;padding:0;';
  
      const footer = document.querySelector('.shopify-section-footer') || document.querySelector('footer');
      if (footer && footer.parentNode) {
        footer.parentNode.insertBefore(bottomSentinel, footer.nextSibling);
      } else {
        document.body.appendChild(bottomSentinel);
      }
      this._bottomSentinel = bottomSentinel;
  
      this._topObserver = new IntersectionObserver((entries) => {
        const e = entries && entries[0];
        if (!e) return;
        this._buttonsVisible = !!e.isIntersecting;
        this._apply();
      }, { root: null, threshold: 0, rootMargin: '0px' });
  
      this._bottomObserver = new IntersectionObserver((entries) => {
        const e = entries && entries[0];
        if (!e) return;
        this._atBottom = !!e.isIntersecting;
        this._apply();
      }, { root: null, threshold: 0, rootMargin: '0px' });
  
      this._topObserver.observe(topSentinel);
      this._bottomObserver.observe(bottomSentinel);
  
      this._apply();
    }
  
    _apply() {
      if (this._buttonsVisible) return this._hide();
      if (this._atBottom) return this._hide();
      return this._reveal();
    }
  
    _initFallback(buttons) {
      this._buttons = buttons;
  
      const recalcButtonsTop = () => {
        const doc = document.documentElement;
        const scrollTop = window.pageYOffset || doc.scrollTop || 0;
        const rectTop = this._buttons.getBoundingClientRect().top;
        this._buttonsTop = rectTop + scrollTop;
      };
  
      const tick = () => {
        this._raf = 0;
  
        const doc = document.documentElement;
        const scrollTop = window.pageYOffset || doc.scrollTop || 0;
  
        const remaining = doc.scrollHeight - (doc.scrollTop + doc.clientHeight);
        const isNearBottom = remaining <= 100;
  
        if (scrollTop > this._buttonsTop && !isNearBottom) this._reveal();
        else this._hide();
      };
  
      this._onScroll = () => {
        if (this._raf) return;
        this._raf = requestAnimationFrame(tick);
      };
  
      this._onResize = () => {
        recalcButtonsTop();
        this._onScroll();
      };
  
      const initMeasure = () => {
        recalcButtonsTop();
        this._onScroll();
      };
  
      if (document.readyState === 'complete') initMeasure();
      else window.addEventListener('load', initMeasure, { once: true });
  
      window.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._onResize, { passive: true });
    }
  
    destroy() {
      if (this._topObserver) {
        this._topObserver.disconnect();
        this._topObserver = null;
      }
      if (this._bottomObserver) {
        this._bottomObserver.disconnect();
        this._bottomObserver = null;
      }
  
      if (this._topSentinel?.parentNode) this._topSentinel.parentNode.removeChild(this._topSentinel);
      this._topSentinel = null;
  
      if (this._bottomSentinel?.parentNode) this._bottomSentinel.parentNode.removeChild(this._bottomSentinel);
      this._bottomSentinel = null;
  
      if (this._onScroll) {
        window.removeEventListener('scroll', this._onScroll);
        this._onScroll = null;
      }
      if (this._onResize) {
        window.removeEventListener('resize', this._onResize);
        this._onResize = null;
      }
  
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
  
      this._buttons = null;
      this._buttonsTop = 0;
  
      this._inited = false;
      this._initScheduled = false;
  
      this._buttonsVisible = true;
      this._atBottom = false;
  
      this._shown = false;
      this._hide();
    }
  }

  customElements.define('animate-sticky', AnimateSticky);

  class TooltipComponent extends HTMLElement {
    static _vars = {
      animationDurationMs: 0,
      sideMarginPx: 0
    };
    static _varsReady = false;
    static _varsScheduled = false;
  
    static _scheduleReadVars() {
      if (TooltipComponent._varsReady || TooltipComponent._varsScheduled) return;
      TooltipComponent._varsScheduled = true;
  
      const run = () => {
        TooltipComponent._varsScheduled = false;
        const root = document.documentElement;
        const cs = getComputedStyle(root);
  
        const anim = (cs.getPropertyValue('--animation-duration') || '').trim();
        const side = (cs.getPropertyValue('--side-margin') || '').trim();
  
        const animNum = parseFloat(anim) || 0;
        const sideNum = parseFloat(side) || 0;
  
        TooltipComponent._vars.animationDurationMs = animNum * 1000;
        TooltipComponent._vars.sideMarginPx = sideNum;
  
        TooltipComponent._varsReady = true;
      };
  
      if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 2000 });
      } else {
        window.addEventListener('load', () => {
          setTimeout(run, 0);
        }, { once: true });
      }
    }
  
    constructor() {
      super();
  
      this.leaveTimeout = null;
  
      this.tooltipContent = null;
      this.tooltipParent = null;
  
      this._sideMarginValue = 0;
  
      this._pendingAdjust = 0;
      this._lastTransform = '';
  
      this.onTransitionStart = this.onTransitionStart.bind(this);
      this.onTransitionEnd = this.onTransitionEnd.bind(this);
      this._adjustNow = this._adjustNow.bind(this);
    }
  
    connectedCallback() {
      this.tooltipContent = this.querySelector('.tooltip__text');
      if (!this.tooltipContent) return;
  
      this.tooltipParent = this.closest('.form__label');
  
      TooltipComponent._scheduleReadVars();
  
      this.tooltipContent.addEventListener('transitionstart', this.onTransitionStart);
      this.tooltipContent.addEventListener('transitionend', this.onTransitionEnd);
    }
  
    disconnectedCallback() {
      if (this.tooltipContent) {
        this.tooltipContent.removeEventListener('transitionstart', this.onTransitionStart);
        this.tooltipContent.removeEventListener('transitionend', this.onTransitionEnd);
      }
  
      if (this.leaveTimeout) {
        clearTimeout(this.leaveTimeout);
        this.leaveTimeout = null;
      }
  
      if (this._pendingAdjust) {
        cancelAnimationFrame(this._pendingAdjust);
        this._pendingAdjust = 0;
      }
    }
  
    onTransitionStart(e) {
      if (e.propertyName !== 'opacity') return;
      if (!this.matches(':hover')) return;
  
      if (this.leaveTimeout) {
        clearTimeout(this.leaveTimeout);
        this.leaveTimeout = null;
      }
  
      if (!TooltipComponent._varsReady) return;
  
      this._sideMarginValue = TooltipComponent._vars.sideMarginPx;
  
      if (this._pendingAdjust) cancelAnimationFrame(this._pendingAdjust);
      this._pendingAdjust = requestAnimationFrame(this._adjustNow);
    }
  
    onTransitionEnd(e) {
      if (e.propertyName !== 'opacity') return;
  
      if (this.matches(':hover')) return;
  
      this._lastTransform = '';
      this.tooltipContent.style.transform = '';
      this.tooltipParent?.classList.remove('overflow-x-visible');
    }
  
    _adjustNow() {
      this._pendingAdjust = 0;
      if (!this.tooltipContent) return;
  
      this.adjustTooltipPosition(this.tooltipContent, this._sideMarginValue);
    }
  
    adjustTooltipPosition(tooltipContent, sideMargin) {
      const rect = tooltipContent.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
  
      let nextTransform = '';
  
      if (rect.left < 0) {
        const shift = -rect.left;
        nextTransform = `translateX(${shift + sideMargin}px)`;
      } else if (rect.right > viewportWidth) {
        const shift = viewportWidth - rect.right;
        nextTransform = `translateX(${shift - sideMargin}px)`;
      }
  
      if (nextTransform !== this._lastTransform) {
        this._lastTransform = nextTransform;
        tooltipContent.style.transform = nextTransform;
      }
  
      if (this.tooltipParent && !this.tooltipParent.classList.contains('overflow-x-visible')) {
        this.tooltipParent.classList.add('overflow-x-visible');
      }
    }
  }
  
  customElements.define('tooltip-component', TooltipComponent);

  // Slideshow
  function initializeSlideshowSwiper(slideshow) {
    let effect = slideshow.dataset.effect;
    let speed = parseInt(slideshow.dataset.transitionDuration, 10) || 300
    let autoplaySpeed = parseInt(slideshow.dataset.autoplaySpeed, 10) || 5000
    let autoplay = slideshow.dataset.autoplay === "true"
    let isAutoplayRunning = !!autoplay;
    let progressCircle = slideshow.querySelector(".autoplay-progress__progress-circle");
    let autoplayProgress = slideshow.querySelector(".autoplay-progress");
    let progressIconPause = autoplayProgress?.querySelector(".autoplay-progress__video-control-icon--pause");
    let progressIconPlay = autoplayProgress?.querySelector(".autoplay-progress__video-control-icon--play");

    const slideshowSwiper = new Swiper(slideshow, {
        loop: true,
        slidesPerView: 1,
        pagination: {
            el: slideshow.querySelector('.swiper-pagination'),
            type: 'bullets',
            clickable: true,
        },
        navigation: {
            nextEl: slideshow.querySelector('.swiper-button-next'),
            prevEl: slideshow.querySelector('.swiper-button-prev'),
        },
        effect: effect,
        speed: speed,
        autoplay: autoplay ? {
            delay: autoplaySpeed,
            disableOnInteraction: false,
        } : false,
        creativeEffect: {
            prev: {
                shadow: true,
                translate: ["-20%", 0, -1],
            },
            next: {
                translate: ["100%", 0, 0],
            },
        },
        cardsEffect: {
            perSlideOffset: 5,
            perSlideRotate: 1
        },
        coverflowEffect: {
            slideShadows: false
        },
        flipEffect: {
            slideShadows: false
        },
        on: {
          autoplayTimeLeft(s, time, progress) {
            progressCircle.style.setProperty("--progress", 1 - progress);
          },
          slideChange() {
            progressIconPlay?.classList.add('hidden');
            progressIconPause?.classList.remove('hidden');
            isAutoplayRunning = true;
          }
        }
    })
    slideshow.querySelectorAll('video').forEach(video => video.load())

    autoplayProgress?.addEventListener("click", () => {
        if (isAutoplayRunning) {
            slideshowSwiper.autoplay.pause();
            progressIconPause?.classList.add('hidden');
            progressIconPlay?.classList.remove('hidden');
        } else {
            slideshowSwiper.autoplay.resume();
            progressIconPlay?.classList.add('hidden');
            progressIconPause?.classList.remove('hidden');
        }

        isAutoplayRunning = !isAutoplayRunning;
    });
  }

  function initAllSlideshowSwipers() {
    document.querySelectorAll('.swiper-slideshow').forEach(initializeSlideshowSwiper);
  }
  
  document.addEventListener('DOMContentLoaded', initAllSlideshowSwipers);
  
  document.addEventListener('shopify:section:load', (event) => {
    const slideshow = event.target.querySelector('.swiper-slideshow');
    if (slideshow) {
      initializeSlideshowSwiper(slideshow);
    }
  });
