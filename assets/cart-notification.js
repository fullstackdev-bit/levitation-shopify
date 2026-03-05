class CartNotification extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.cartDrawerID = document.querySelector('.shopify-section-cart-drawer').id.replace('shopify-section-', '')
      this.headerID = document.querySelector('.shopify-section-header').id.replace('shopify-section-', '')
      this.overlay = document.querySelector('body > .overlay')
      this.overlay.addEventListener('click', this.close.bind(this));
      this.notification = document.getElementById('cart-notification');
      this.onBodyClick = this.handleBodyClick.bind(this);
  
      this.notification.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
      this.querySelectorAll('button[type="button"]').forEach((closeButton) =>
        closeButton.addEventListener('click', this.close.bind(this))
      );
    }
  
    open() {
      if(document.body.classList.contains('quick-view-open')) {
        document.body.classList.remove('hidden', 'quick-view-open', 'quick-view-load')
        let openedQuickView = document.querySelector('.popup-wrapper__quick-view.open')
        if(openedQuickView) {
          openedQuickView.closest('details').removeAttribute('open')
          openedQuickView.closest('.quick-view__content').classList.remove('hide-cover');
          document.querySelector('body > .quick-view-overlay').classList.remove('open')
          openedQuickView.classList.remove('open')
          openedQuickView.closest('.quick-view__content').innerHTML = '';
        }
      }
      this.notification.classList.add('open');
      this.overlay.classList.add('open');
  
      this.notification.addEventListener('transitionend', () => {
        this.notification.focus();
        trapFocus(this.notification, this.notification.querySelector('.button-close'));
      }, { once: true });
  
      document.body.classList.add('hidden', 'overlay-opened');
      document.body.addEventListener('click', this.onBodyClick);
    }
  
    close() {
      this.notification.classList.remove('open');
      this.overlay.classList.remove('open');
      document.body.classList.remove('hidden', 'overlay-opened');
      document.dispatchEvent(new CustomEvent('modal:after-hide'))
      document.dispatchEvent(new CustomEvent('body:visible'));
      document.body.removeEventListener('click', this.onBodyClick);
      removeTrapFocus(this.activeElement);
      const wrapper = document.getElementById('cart-notification-wrapper');
      if (wrapper) wrapper.innerHTML = '';
    }
  
    renderContents(parsedState) {
      if (!parsedState || !parsedState.sections) {
        return;
      }
    
      this.cartItemKey = parsedState.key;
    
      this.getSectionsToRender().forEach((section) => {
        const html = parsedState.sections?.[section.id];
        if (!html) return;
    
        if (section.id === this.headerID) {
          const bubble = document.querySelector(section.selector);
          if (bubble) bubble.innerHTML = this.getSectionInnerHTML(html, section.selector);
          return;
        }
    
        if (section.id === this.cartDrawerID) {
          const wrapper = document.getElementById('cart-notification-wrapper');
          if (wrapper) {
            let notificationHTML = '';
            if (this.cartItemKey) {
              const safeKey = CSS.escape(this.cartItemKey);
              const productSelector = `#cart-notification-product-${safeKey}`;
              const element = new DOMParser().parseFromString(html, 'text/html').querySelector(productSelector);

              if (element) {
                notificationHTML = element.innerHTML;
              } else {
                notificationHTML = this.getSectionInnerHTML(html, '#cart-notification .cart-item');
              }
            } else {
              notificationHTML = this.getSectionInnerHTML(html, '#cart-notification .cart-item');
            }
            if (notificationHTML) {
              wrapper.innerHTML = notificationHTML;
            }
          }
          return;
        }
    
        const elements = document.querySelectorAll(section.selector);
        elements.forEach((el) => {
          el.innerHTML = this.getSectionInnerHTML(html, section.selector);
        });
      });
    
      this.open();
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
        },
        {
          id: this.headerID,
          selector: `.header-segment-mobile #cart-icon-bubble-${this.headerID}`
        }
      ];
      return arraySections
    }
  
    getSectionInnerHTML(html, selector = '.shopify-section') {
      return new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector(selector).innerHTML;
    }
  
    handleBodyClick(evt) {
      const target = evt.target;
      if (target !== this.notification && !target.closest('cart-notification')) this.close();
    }
  
    setActiveElement(element) {
      this.activeElement = element;
      if (element.closest('.popup-wrapper__quick-view') && element.closest('.card-product')) this.activeElement = element.closest('.card-product').querySelector('.card-quick-view')
    }
}

customElements.define('cart-notification', CartNotification);