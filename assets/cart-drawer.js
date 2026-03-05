class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.sidePanelEnabled = this.dataset.sidePanelEnabled === 'true';
    this.cartDrawerSidePanelBreakpoint = parseInt(this.dataset.sidePanelBreakpoint, 10) || 1024;

    this.cartDrawerID = document
      .querySelector('.shopify-section-cart-drawer')
      ?.id.replace('shopify-section-', '');

    this.headerID = document
      .querySelector('.shopify-section-header')
      ?.id.replace('shopify-section-', '');

    this.CartDrawer = this.closest('.cart-drawer');
    this.drawer = this.CartDrawer?.querySelector('.drawer');
    this.overlay = document.body.querySelector('body > .overlay');

    this.recommendationsBlockHasDifferentBg = this.dataset.recommendationsBlockHasDifferentBg === 'true';
    this.enableShadow = this.dataset.enableShadow === 'true';
    this.enableBorder = this.dataset.enableBorder === 'true';

    this._onResize = this._onResize.bind(this);
    this._onOverlayClick = this._onOverlayClick.bind(this);

    document.addEventListener('keyup', (event) => {
      if (event.code && event.code.toUpperCase() === 'ESCAPE' && this.drawer?.closest('.open')) this.close();
    });

    this.setHeaderCartIconAccessibility();

    document.addEventListener('shopify:section:load', (event) => {
      if (event.target.closest('.shopify-section-cart-drawer')) {
        if (Shopify.designMode) document.body.classList.add('disable-scroll-body');
        this.open();
      }
    });

    document.addEventListener('shopify:section:select', (event) => {
      if (event.target.closest('.shopify-section-cart-drawer')) {
        if (Shopify.designMode) document.body.classList.add('disable-scroll-body');
        this.sectionSelect();
      }
    });

    document.addEventListener('shopify:section:deselect', (event) => {
      if (event.target.closest('.shopify-section-cart-drawer')) this.close();
    });

    if (this.overlay) this.overlay.addEventListener('click', this._onOverlayClick, { passive: true });

    this.refreshRecommendationsUI();

    window.addEventListener('resize', this._onResize, { passive: true });
    document.addEventListener('cart:updated', () => this.refreshRecommendationsUI());
    document.addEventListener('cart:add:success', () => this.refreshRecommendationsUI());
  }

  _onOverlayClick() {
    this.close();
  }

  _onResize() {
    if (this._resizeRaf) return;
    this._resizeRaf = requestAnimationFrame(() => {
      this._resizeRaf = 0;
      this.refreshRecommendationsUI();
    });
  }

  refreshRecommendationsUI() {
    this.drawerRecommendations = this.CartDrawer?.querySelector('.drawer-recommendations') || null;
    if (!this.drawerRecommendations) return;

    const drawerRecommendationsHeader = this.drawerRecommendations.querySelector('.js-cart-drawer-header');
    const drawerRecommendationsTabsResult = this.drawerRecommendations.querySelector('.tabs-block__results');

    const isSmallScreen = window.matchMedia(`(max-width: ${this.cartDrawerSidePanelBreakpoint}px)`).matches;

    const add = (el, cls) => el && el.classList.add(cls);
    const rem = (el, cls) => el && el.classList.remove(cls);
    const toggle = (el, cls, on) => el && el.classList.toggle(cls, !!on);

    const applySidePanelState = (enable) => {
      toggle(this.drawerRecommendations, 'drawer-recommendations--side-panel', enable);
      toggle(this.drawerRecommendations, 'scroll-area', enable);
      toggle(this.drawerRecommendations, 'hide-scrollbar', enable);
      toggle(this.drawerRecommendations, 'modal--shadow', enable && this.enableShadow);
      toggle(this.drawerRecommendations, 'modal--border', enable && this.enableBorder);

      toggle(drawerRecommendationsHeader, 'cart-drawer__header', enable);
      toggle(drawerRecommendationsTabsResult, 'tabs-block__results--allow-height-change', enable);

      if (!enable && this.recommendationsBlockHasDifferentBg) {
        add(this.drawerRecommendations, 'full-width-block');
      } else {
        rem(this.drawerRecommendations, 'full-width-block');
      }
    };

    if (!this.sidePanelEnabled) {
      rem(this.drawerRecommendations, 'drawer-recommendations--side-panel-enabled');
      applySidePanelState(false);
      return;
    }

    applySidePanelState(!isSmallScreen);
  }

  setHeaderCartIconAccessibility() {
    this.cartLinks = document.querySelectorAll('#cart-link');
    Array.from(this.cartLinks).forEach((cartLink) => {
      cartLink.setAttribute('role', 'button');
      cartLink.setAttribute('aria-haspopup', 'dialog');

      cartLink.addEventListener('click', (event) => {
        event.preventDefault();
        this.open(cartLink);
      });

      cartLink.addEventListener('keydown', (event) => {
        if ((event.code || '').toUpperCase() === 'ENTER') {
          event.preventDefault();
          this.open(cartLink);
        }
      });
    });
  }

  sectionSelect() {
    this.cartLink = document.querySelector('#cart-link');
    this.open(this.cartLink);
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);

    if (document.body.classList.contains('quick-view-open')) {
      document.body.classList.remove('hidden', 'quick-view-open', 'quick-view-load');
      const openedQuickView = document.querySelector('.popup-wrapper__quick-view.open');
      if (openedQuickView) {
        openedQuickView.closest('details')?.removeAttribute('open');
        openedQuickView.closest('.quick-view__content')?.classList.remove('hide-cover');
        document.querySelector('body > .quick-view-overlay')?.classList.remove('open');
        openedQuickView.classList.remove('open');
        openedQuickView.closest('.quick-view__content').innerHTML = '';
      }
    }

    setTimeout(() => {
      this.classList.add('animate', 'open');
      this.drawer?.classList.add('open');
      this.overlay?.classList.add('open');
      document.body.classList.add('hidden', 'overlay-opened');

      this.CartDrawer?.setAttribute('tabindex', '-1');

      requestAnimationFrame(() => {
        setTimeout(() => {
          const closeBtn = this.CartDrawer?.querySelector('.button-close');
          closeBtn?.focus();
          if (typeof trapFocus === 'function' && closeBtn) trapFocus(this.CartDrawer, closeBtn);
        }, 10);
      });
    }, 10);
  }

  close() {
    if (Shopify.designMode) document.body.classList.remove('disable-scroll-body');

    this.classList.remove('open');
    this.drawer?.classList.remove('open');
    this.overlay?.classList.remove('open');

    if (typeof removeTrapFocus === 'function') removeTrapFocus(this.activeElement);

    document.body.classList.remove('hidden', 'overlay-opened');
    document.dispatchEvent(new CustomEvent('body:visible'));
  }

  renderContents(parsedState) {
    if (!parsedState || !parsedState.sections) return;

    if (this.classList.contains('is-empty')) this.classList.remove('is-empty');

    this.productId = parsedState.id;

    this.getSectionsToRender().forEach((section) => {
      const sectionElements = document.querySelectorAll(section.selector);
      const sectionHtml = parsedState.sections[section.id];
      if (!sectionHtml) return;

      Array.from(sectionElements).forEach((sectionElement) => {
        const newHtml = this.getSectionInnerHTML(sectionHtml, section.selector);
        sectionElement.innerHTML = newHtml;
      });
    });

    if (this.classList.contains('open-after-adding')) {
      setTimeout(() => {
        this.querySelector('#CartDrawer-Overlay')?.addEventListener('click', this.close.bind(this));
        this.open();
      });
    }

    this.refreshRecommendationsUI();
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector)?.innerHTML || '';
  }

  getSectionsToRender() {
    return [
      { id: this.cartDrawerID, selector: '#CartDrawer' },
      { id: this.headerID, selector: `#cart-icon-bubble-${this.headerID}` }
    ];
  }

  setActiveElement(element) {
    this.activeElement = element;

    if (element?.closest('.cart-icon') && element.querySelector('a.cart')) {
      this.activeElement = element.querySelector('a.cart');
    }

    if (element?.closest('.popup-wrapper__quick-view') && element.closest('.card-product')) {
      this.activeElement = element.closest('.card-product').querySelector('.card-quick-view');
    }
  }
}

customElements.define('cart-drawer', CartDrawer);