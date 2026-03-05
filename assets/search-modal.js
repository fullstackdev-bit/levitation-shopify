class SearchModal extends HTMLElement {
    constructor() {
      super();

      if (this.isPredictiveSearchDisabled()) {
        return;
      }

      this.modal = this.querySelector('.search-modal');
      this.detailsContainer = this.querySelector('details');
      this.summaryToggle = this.querySelector('summary');
      this.input = this.querySelector('.search__input')
      this.searchField = this.summaryToggle.querySelector('.search-field__text')
      this.overlay = this.detailsContainer.querySelector('.search-modal__overlay')
      !this.modal.className.includes('drawer') ? this.buttonClose = this.querySelector('.button-close--search') : this.buttonClose = this.querySelector('.button-close--search-drawer')
      this.header = document.querySelector('.header')
  
      document.addEventListener('keyup', (event) => {
          if(event.code && event.code.toUpperCase() === 'ESCAPE' && this.modal.className.includes('open')) this.close()
      });
    
      if (this.searchField) {
          this.summaryToggle.querySelector('.search-field__text').addEventListener('focus', (event) => {
            if(this.modal.className.includes('drawer')) {
              this.summaryToggle.querySelector('.search-field__text').readOnly = true;
              setTimeout(() => this.open(this, 'focus'), 100)
            } else {
              this.open(this, 'focus')
            }
          })
          this.summaryToggle.querySelector('.button-close').addEventListener('focusout', this.close.bind(this))
      } else {
        this.summaryToggle.addEventListener('click', this.onSummaryClick.bind(this))
      }
      if (this.overlay) {
        this.overlay.addEventListener('click', (event) => {
          this.reset(event)
          this.close()
        })
      }
      document.querySelector('.search__button').addEventListener(
        'click',
        this.reset.bind(this)
      );
      this.buttonClose.addEventListener(
        'click', (event) => {
          this.reset(event)
          this.close()
        }
      );
      this.header.addEventListener(
        'click', (event) => {
          if(this.modal.closest('.open') && !event.target.closest('.search')) {
            this.reset(event)
            this.close()
          }
        }
      );
      this.summaryToggle.setAttribute('role', 'button');
    }

    isPredictiveSearchDisabled() {
      const shopifyFeatures = document.getElementById("shopify-features");
      const features = shopifyFeatures ? JSON.parse(shopifyFeatures.textContent) : {};
      const isPredictiveSearchSupported = features.predictiveSearch === true;

      /* Check if predictive search is supported via hardcoded array in case API returns 'true' for unsupported language */
      const supportedLanguages = [
        "af",  // Afrikaans
        "sq",  // Albanian
        "hy",  // Armenian
        "bs",  // Bosnian
        "bg",  // Bulgarian
        "ca",  // Catalan
        "hr",  // Croatian
        "cs",  // Czech
        "da",  // Danish
        "nl",  // Dutch
        "en",  // English
        "et",  // Estonian
        "fo",  // Faroese
        "fi",  // Finnish
        "fr",  // French
        "gd",  // Gaelic
        "de",  // German
        "el",  // Greek
        "hu",  // Hungarian
        "is",  // Icelandic
        "id",  // Indonesian
        "it",  // Italian
        "la",  // Latin
        "lv",  // Latvian
        "lt",  // Lithuanian
        "mk",  // Macedonian
        "mo",  // Moldovan
        "no",  // Norwegian
        "nb",  // Norwegian (Bokmål)
        "nn",  // Norwegian (Nynorsk)
        "pl",  // Polish
        "pt-BR",  // Portuguese (Brazil)
        "pt-PT",  // Portuguese (Portugal)
        "ro",  // Romanian
        "ru",  // Russian
        "sr",  // Serbian
        "sh",  // Serbo-Croatian
        "sk",  // Slovak
        "sl",  // Slovenian
        "es",  // Spanish
        "sv",  // Swedish
        "tr",  // Turkish
        "uk",  // Ukrainian
        "vi",  // Vietnamese
        "cy"   // Welsh
      ];
      const currentLanguage = document.documentElement.lang; 

      return !isPredictiveSearchSupported || !supportedLanguages.includes(currentLanguage);
    }

    onSummaryClick(event) {
      event.preventDefault();
      event.target.closest('details').hasAttribute('open')
        ? this.close()
        : this.open(event);
        this.open(event);
    }
  
    onBodyClick(event) {
      if (event.target.classList.contains('search-modal__overlay') || event.target.closest('.button-close--search') || event.target.closest('.button-close--search')) this.close();
    }
  
    open(event, listerner) {
      if(this.summaryToggle.querySelector('.search-field__text') && this.summaryToggle.querySelector('.search-field__text').closest('.focused') && listerner == false) return
      this.focusElement = event.target
      if(this.modal.className.includes('open') || document.querySelector('body > .search-modal.open')) return
      if (this.searchField && !this.modal.className.includes('drawer')) {
        const scrollY = window.scrollY || window.pageYOffset;
        document.body.dataset.scrollY = scrollY;
        document.body.style.top = `-${scrollY}px`;
        document.body.classList.add('disable-scroll')
      }
      document.body.appendChild(this.modal)
      if(!document.querySelector('body > .search-modal__overlay')) {
        this.overlay.classList.remove('open')
        document.body.appendChild(this.overlay)
      }
      this.onBodyClickEvent = this.onBodyClickEvent || this.onBodyClick.bind(this);
      this.detailsContainer.setAttribute('open', true);
      if(this.modal.className.includes('drawer')) {
        setTimeout(() => this.overlay.classList.add('open'), 300)
      } else {
        this.overlay.classList.add('open')
      }
      document.body.addEventListener('click', this.onBodyClickEvent);
      if(this.modal.className.includes('drawer')) {
        requestAnimationFrame(() => {
          this.overlay.classList.add('open');
          document.body.classList.add('hidden', 'overlay-opened');
          this.modal.classList.add('open');
          document.documentElement.setAttribute('style', `--header-offset-height: ${Math.floor(this.closest('.header').getBoundingClientRect().bottom)}px; --header-height: ${Math.floor(this.closest('.header').getBoundingClientRect().bottom)}px;`);
          document.dispatchEvent(new CustomEvent('searchmodal:open'));
  
          if (this.searchField) {
              this.input.setAttribute('value', this.searchField.value);
              this.input.value = this.searchField.value;
              trapFocus(this.searchField, this.input);
              this.input.readOnly = true;
              requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    this.input.focus({ preventScroll: true });
                    this.input.readOnly = false;
                });
              });
          } else {
              trapFocus(this.detailsContainer, this.input);
          }
      });
      } else {
        if (!this.modal.className.includes('drawer')) document.body.classList.add('search-modal--open');
        document.body.classList.add('hidden', 'overlay-opened')
        this.modal.classList.add('open')
        document.documentElement.setAttribute('style', `--header-offset-height: ${Math.floor(this.closest('.header').getBoundingClientRect().bottom)}px; --header-height: ${Math.floor(this.closest('.header').getBoundingClientRect().bottom)}px;`)
        document.dispatchEvent(new CustomEvent('searchmodal:open'));
      }
      if (this.searchField) {
        this.input.setAttribute('value', this.searchField.value)
        this.input.value = this.searchField.value
        trapFocus(
          this.searchField,
          this.input
        );
        if(this.modal.className.includes('drawer')) this.input.readOnly = true;
        setTimeout(() => {
          this.input.focus({ preventScroll: true });
          if(this.modal.className.includes('drawer')) this.input.readOnly = false;
        });
      }
      else {
        trapFocus(
          this.detailsContainer,
          this.input
        );
      }
    }
  
    close() {
      if (this.searchField && document.body.classList.contains('disable-scroll')) {
        document.body.classList.add('after-focusout')
        document.documentElement.style.scrollBehavior = 'auto'
        const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);
        document.body.classList.remove('disable-scroll')
        document.body.style.top = '';
        window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      }
      removeTrapFocus(this.focusElement);
      this.detailsContainer.removeAttribute('open');
      document.body.removeEventListener('click', this.onBodyClickEvent);
      if (!this.modal.className.includes('drawer')) document.body.classList.remove('search-modal--open');
      document.dispatchEvent(new CustomEvent('searchmodal:close'));
      document.body.classList.remove('hidden', 'overlay-opened')
      if(document.querySelector('.search__button-text')) document.querySelector('.search__button-text').classList.add('visually-hidden')
      if (this.modal) this.modal.classList.remove('open')
      document.dispatchEvent(new CustomEvent('body:visible'));
      if (this.modal) this.modal.remove()
      if (document.querySelector('.search-modal__overlay.open')) document.querySelector('.search-modal__overlay.open').remove()
      if (this.summaryToggle.querySelector('.search-field__text')) {
        this.summaryToggle.querySelector('.search-field__text').closest('form').querySelector('.search__button').setAttribute('tabindex', '-1')
      }
      setTimeout(() => document.documentElement.style.scrollBehavior = 'smooth', 10)
      setTimeout(() => document.body.classList.remove('after-focusout'), 200)
      if(this.modal.className.includes('drawer')) this.summaryToggle.querySelector('.search-field__text').readOnly = false;
    }
  
    reset(event) {
      event.preventDefault();
      if(this.querySelector('input[type="search"]') && this.querySelector('input[type="search"]').hasAttribute('value')) this.querySelector('input[type="search"]').value = '';
    }
  }
  
customElements.define('search-modal', SearchModal);