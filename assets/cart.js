class CartRemoveButton extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();

    this.headerID = document.querySelector('.shopify-section-header').id.replace('shopify-section-', '')
    this.lineItemStatusElement = document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    this.debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 300);

    this.addEventListener('change', this.debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  onChange(event) {
    this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'));
  }

  onCartUpdate() {
    fetch(`${routes.cart_url}?section_id=main-cart`)
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        const sourceQty = html.querySelector('cart-items');
        this.innerHTML = sourceQty.innerHTML;
      })
      .catch(e => {
        console.error(e);
      });
  }

  getSectionsToRender() {
    let arraySections = []
    arraySections = [
      {
        id: 'main-cart',
        section: document.getElementById('main-cart').dataset.id,
        selector: 'shopify-section',
      },
      {
        id: `cart-icon-bubble-${this.headerID}`,
        section: this.headerID,
        selector: '.cart-icon-bubble-count'
      }
    ];
    return arraySections
  }

  updateQuantity(line, quantity, name) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
    .then((response) => {
      return response.text();
    })
    .then((state) => {
      const parsedState = JSON.parse(state);
      const quantityElement = document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
      const items = document.querySelectorAll('.cart-item');

      if (parsedState.errors) {
        fetch(`${routes.cart_url}.js`)
          .then(res => res.json())
          .then(cart => {
            const cartLineItem = cart.items[line - 1];
            const acceptedQuantity = cartLineItem ? cartLineItem.quantity : 0;

            this.updateQuantity(line, acceptedQuantity, name);
          })
          .catch((err) => {
            console.error("Failed to re-fetch cart:", err);
            this.disableLoading(line);
          });
      
        return;
      }

      this.classList.toggle('is-empty', parsedState.item_count === 0);
      const cartDrawerWrapper = document.querySelector('cart-drawer');
      
      if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);
      
      this.getSectionsToRender().forEach((section => {
        if (document.querySelectorAll(`#${section.id}`)) {
          const elementsToCart = document.querySelectorAll(`#${section.id}`);

          Array.from(elementsToCart).forEach(element => {
            element.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.section], `#${section.id}`);
          })
        }
      }));

      const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
      let message = '';

      if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
        typeof updatedValue === 'undefined' ? message = window.cartStrings.error : message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
      }

      this.updateLiveRegions(line, message);

      const lineItem = document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);

      if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
        cartDrawerWrapper ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`)) : lineItem.querySelector(`[name="${name}"]`).focus();
      } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
        trapFocus(cartDrawerWrapper.querySelector('.cart-drawer__inner-empty'), cartDrawerWrapper.querySelector('a'))
      } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
        trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'))
      }

      publish(PUB_SUB_EVENTS.cartUpdate, {source: 'cart-items'});
      this.disableLoading(line);
      
      document.dispatchEvent(new CustomEvent('cart:updated', {
        detail: {
          cart: state
        }
      }))     
    }).catch(() => {
      this.querySelectorAll('.loading-overlay__spinner').forEach((overlay) => overlay.classList.add('hidden'));
      const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');

      if (errors) {
        errors.textContent = window.cartStrings.error;
        errors.style.marginTop = '16px';
      }
      
      this.disableLoading(line);
    });
  }

  updateLiveRegions(line, message) {
    const lineItemError = document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').innerHTML = message;
    if (this.lineItemStatusElement) this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus = document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    if (cartStatus) {
      cartStatus.setAttribute('aria-hidden', false);
      setTimeout(() => cartStatus.setAttribute('aria-hidden', true), 1e3);
    }
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading-overlay__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading-overlay__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading-overlay__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading-overlay__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}
customElements.define('cart-items', CartItems);

class CartDrawerItems extends CartItems {
  constructor() {
    super();

    this.cartDrawerID = document.querySelector('.shopify-section-cart-drawer').id.replace('shopify-section-', '')
  }

  getSectionsToRender() {
    let arraySections = []
    arraySections = [
      {
        id: 'CartDrawer',
        section: this.cartDrawerID,
        selector: '.cart-drawer__inner'
      },
      {
        id: `cart-icon-bubble-${this.headerID}`,
        section: this.headerID,
        selector: '.cart-icon-bubble-count'
      }
    ];
    return arraySections
  }
}
customElements.define('cart-drawer-items', CartDrawerItems);

class ShippingCalculator extends HTMLElement {
  constructor() {
    super();

    this.setupCountries();
    
    this.errors = this.querySelector('#ShippingCalculatorErrors');
    this.success = this.querySelector('#ShippingCalculatorSuccess');
    this.zip = this.querySelector('#ShippingCalculatorZip');
    this.country = this.querySelector('#ShippingCalculatorCountry');
    this.province = this.querySelector('#ShippingCalculatorProvince');
    this.button = this.querySelector('button');
    this.button.addEventListener('click', this.onSubmitHandler.bind(this));
  }

  setupCountries() {
    if (Shopify && Shopify.CountryProvinceSelector) {
      // eslint-disable-next-line no-new
      new Shopify.CountryProvinceSelector('ShippingCalculatorCountry', 'ShippingCalculatorProvince', {
        hideElement: 'ShippingCalculatorProvinceContainer'
      });
    }
  }

  onSubmitHandler(event) {
    event.preventDefault();
    
    this.errors.classList.add('hidden');
    this.success.classList.add('hidden');
    this.zip.classList.remove('invalid');
    this.country.classList.remove('invalid');
    this.province.classList.remove('invalid');
    this.button.classList.add('loading');
    this.button.setAttribute('disabled', true);
    const body = JSON.stringify({
      shipping_address: {
        zip: this.zip.value,
        country: this.country.value,
        province: this.province.value
      }
    });
    let sectionUrl = `${routes.cart_url}/shipping_rates.json`;

    // remove double `/` in case shop might have /en or language in URL
    sectionUrl = sectionUrl.replace('//', '/');

    fetch(sectionUrl, { ...fetchConfig('javascript'), body })
      .then((response) => response.json())
      .then((parsedState) => {
        if (parsedState.shipping_rates) {
          this.success.classList.remove('hidden');
          this.success.innerHTML = '';
          
          parsedState.shipping_rates.forEach((rate) => {
            const child = document.createElement('p');
            child.innerHTML = `${rate.name}: ${rate.price} ${Shopify.currency.active}`;
            this.success.appendChild(child);
          });
        }
        else {
          let errors = [];
          Object.entries(parsedState).forEach(([attribute, messages]) => {
            errors.push(messages[0]);
          });

          this.errors.classList.remove('hidden');
          this.errors.querySelector('.errors').innerHTML = errors.join('; ');
        }
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        this.button.classList.remove('loading');
        this.button.removeAttribute('disabled');
        if(this.closest('.accordion__panel')) {
          let offset = 0
          if(this.success && !this.success.className.includes('hidden')) offset = this.success.offsetHeight
          if(this.errors && !this.errors.className.includes('hidden')) offset = this.errors.offsetHeight
          this.closest('.accordion__panel').style.maxHeight = this.closest('.accordion__panel').offsetHeight + offset + 'px'
        }
      });
  }
}

customElements.define('shipping-calculator', ShippingCalculator);


function formatMoney(cents) {
  let formatted = new Intl.NumberFormat(Shopify.currency.active, {
      style: 'currency',
      currency: Shopify.currency.active
  }).format(cents / 100);

  formatted = formatted.replace(/[A-Za-z\s]+/g, '').trim();

  return formatted;
}

document.addEventListener("DOMContentLoaded", function () {
  function updateFreeShippingBars() {
    const freeShippingElements = document.querySelectorAll('.free-shipping');
      if (freeShippingElements.length === 0) return;

      freeShippingElements.forEach(freeShippingElement => {
          let threshold = parseFloat(freeShippingElement.dataset.freeShippingAmount) * 100;
          let cartTotal = parseFloat(freeShippingElement.dataset.cartTotal);
          let currencyRate = Shopify.currency.rate || 1;

          let convertedThreshold = Math.round(threshold * currencyRate);

          let freeShippingMessage = freeShippingElement.dataset.freeShippingMessage || "Spend {{ remaining_amount }} more for free shipping!";
          let freeShippingSuccess = freeShippingElement.dataset.freeShippingSuccess || "You've unlocked free shipping!";

          let remainingAmount = Math.max(0, convertedThreshold - cartTotal);

          const progressBar = freeShippingElement.querySelector('.free-shipping__progress');
          const textElement = freeShippingElement.querySelector('.free-shipping__text');

          if (cartTotal >= convertedThreshold) {
              textElement.innerHTML = `<b>${freeShippingSuccess}</b>`;
              progressBar.style.setProperty("--progress", "100%");
              progressBar.classList.add('free-shipping__progress--success');
          } else {
              textElement.innerHTML = `<b>${freeShippingMessage.replace("{{ remaining_amount }}", formatMoney(remainingAmount))}</b>`;
              let progressPercent = Math.min(100, (cartTotal / convertedThreshold) * 100);
              progressBar.style.setProperty("--progress", `${progressPercent}%`);
              progressBar.classList.remove('free-shipping__progress--success');
          }
      });
  }

  updateFreeShippingBars();
});

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${window.routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
          }, 300)
        );
      }
    }
  );
}