class QuickViewDrawer extends HTMLElement {
    constructor() {
      super();

      this.addEventListener('close', () => {
        const drawerContent = this.querySelector('.quick-view__content');
        drawerContent.innerHTML = '';
        drawerContent.classList.remove('hide-cover');
  
        document.dispatchEvent(new CustomEvent('quickview:close'));
      });
    }
}
customElements.define('quick-view-drawer', QuickViewDrawer);
  
class QuickViewButton extends HTMLElement {
    constructor() {
      super();
  
      this.addEventListener('click', this.toggleQuickViewButton.bind(this));
      this.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') this.toggleQuickViewButton(event)
      });

      document.addEventListener('shopify:section:load', (event) => {
        if (this.closest('body.quick-view-open') && event.target.closest('section').querySelector('.quick-view-button') && !event.target.closest('section').querySelector('.popup-wrapper__quick-view.open')) {
          this.closest('body').classList.remove('hidden', 'quick-view-open')
        }
      })
      
      document.addEventListener('quickview:loaded', () => {
        if (this.querySelector('.loading-overlay__spinner')) {
          this.querySelector('.loading-overlay__spinner').classList.add('hidden');
        }

        if (this.closest('.image-with-hotspots__hotspot--product')) {
          this.closest('.image-with-hotspots__hotspot--product').querySelector('.image-with-hotspots__dot .loading-overlay__spinner').classList.add('hidden')
          this.closest('.image-with-hotspots__hotspot--product').querySelector('.image-with-hotspots__dot').classList.remove('hidden-dot')
        }
      })
    }

    toggleQuickViewButton(event) {
      if ((event && event.target && event.target.closest('.card-quick-view')) || (event && event.code && event.code.toUpperCase() === 'ENTER')) event.preventDefault()
      
        if (this.querySelector('.loading-overlay__spinner')) {
        this.querySelector('.loading-overlay__spinner').classList.remove('hidden')
      }

      if (this.closest('.image-with-hotspots__hotspot--product')) {
        this.closest('.image-with-hotspots__hotspot--product').querySelector('.image-with-hotspots__dot .loading-overlay__spinner').classList.remove('hidden')
        this.closest('.image-with-hotspots__hotspot--product').querySelector('.image-with-hotspots__dot').classList.add('hidden-dot')
      }

      this.closest('body').classList.add('hidden', 'quick-view-open');

      let drawer = document.querySelector('quick-view-drawer')

      if (drawer) {
        drawer.querySelector('quick-view').setAttribute('data-product-url', `${this.dataset.productVariantUrl}`)
        drawer.querySelector('summary').click();
        document.dispatchEvent(new CustomEvent('quickview:open', {
          detail: {
            productUrl: this.dataset.productUrl
          }
        }));
      }
      else if (this.dataset.productUrl) {
        window.location = this.dataset.productUrl;
      }
    }
  }
  customElements.define('quick-view-button', QuickViewButton);
  
  class QuickView extends HTMLElement {
    constructor() {
      super();
      this.overlay = document.body.querySelector('body > .quick-view-overlay')
      this.quickModal = this.querySelector('.popup-wrapper')
      this.closeButton = this.querySelector('.button-close')

      this.addEventListener('click', (event) => {
        if (!event.target.closest('.popup') || event.target.closest('.button-close')) this.closeQuickView()
      })

      document.addEventListener('keyup', (event) => {
        if (event.code && event.code.toUpperCase() === 'ESCAPE' && this.querySelector('.popup.open')) this.closeQuickView()
      })
      if(this.closest('.collection__grid-container')) {
        document.addEventListener('quickview:open', (e) => {
          this.productUrl = e.detail.productUrl;
        })
      }
    }
  
    connectedCallback() {
      new IntersectionObserver(this.handleIntersection.bind(this)).observe(this);
    }
  
    handleIntersection(entries, _observer) {
      if (!entries[0].isIntersecting) return;

      const selector = '.quick-view__content';
      const drawerContent = document.querySelector(selector);
      if(!this.closest('.collection__grid-container')) this.productUrl = this.dataset.productUrl;
      this.sectionUrl = `${this.productUrl}&view=quick-view`;
      
      fetch(this.sectionUrl)
        .then(response => response.text())
        .then(responseText => {
          setTimeout(() => {
            const responseHTML = new DOMParser().parseFromString(responseText, 'text/html');
            const productElement = responseHTML.querySelector(selector);
            this.setInnerHTML(drawerContent, productElement.innerHTML);
  
            if (window.Shopify && Shopify.PaymentButton) {
              Shopify.PaymentButton.init();
            }
          }, 1);
          // this.overlay = document.body.querySelector('body > .overlay')
          this.overlay?.classList.add('open')
          document.body.classList.add('quick-view-load', 'overlay-opened')

          setTimeout(() => {
            drawerContent.classList.add('hide-cover');
            trapFocus(drawerContent, drawerContent.querySelector('.button-close'))
            document.dispatchEvent(new CustomEvent('quickview:loaded', {
              detail: {
                productUrl: this.dataset.productUrl
              }
            }));
          }, 1);
        })
        .catch(e => {
          console.error(e);
        });
    }
  
    setInnerHTML(element, html) {
      element.innerHTML = html;
  
      // Reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
      element.querySelectorAll('script').forEach(oldScriptTag => {
        const newScriptTag = document.createElement('script');
        Array.from(oldScriptTag.attributes).forEach(attribute => {
          newScriptTag.setAttribute(attribute.name, attribute.value)
        });
        newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
        oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
      });
    }

    closeQuickView() {
      if(this.closest('.card-product')) this.focusElement = this.closest('.card-product').querySelector('.quick-view-button')
      removeTrapFocus(this.focusElement);
      const drawerContent = this.querySelector('.quick-view__content');
      drawerContent.innerHTML = '';
      drawerContent.classList.remove('hide-cover');
      // this.overlay = document.body.querySelector('body > .overlay')
      this.overlay?.classList.remove('open')
      this.closest('body').classList.remove('hidden', 'quick-view-open', 'quick-view-load', 'overlay-opened')
      document.dispatchEvent(new CustomEvent('body:visible'));
      document.dispatchEvent(new CustomEvent('quickview:close'));
      this.closest('details').removeAttribute('open')
    }
  }
customElements.define('quick-view', QuickView);
  