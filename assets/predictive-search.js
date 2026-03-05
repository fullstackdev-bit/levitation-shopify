class PredictiveSearch extends HTMLElement {
    constructor() {
      super();
  
      this.init()
      document.addEventListener('shopify:section:load', (event) => {
        if(event.target.closest('.shopify-section-header')) this.init()
      })
    }

    init() {
      this.modal = this.closest('.search-modal');
      this.cachedResults = {};
      this.input = this.querySelector('.search__input');
      this.loadingSpinner = this.querySelector('.loading-overlay__spinner')
      this.resetButton = this.querySelector('button[type="reset"]')
      this.clearText = this.querySelector('.search__button-text')
      if(!this.modal.className.includes('drawer')) {
        this.buttonClose = document.querySelector('.button-close--search')
        this.mobileButtonClose = document.querySelector('.header-segment-mobile .button-close--search')
      }
      this.overlay = document.querySelector('.search-modal__overlay')
      this.buttonClose = document.querySelector('.search-modal .button-close')
      this.header = document.querySelector('.header')
      this.searchForm = this.querySelector('form.search-modal__form')
      this.predictiveSearchButton
      if(this.modal.closest('.header-search-style-field')) {
        if(this.modal.closest('search-modal')) {
          this.input = this.modal.closest('search-modal').querySelector('.search-field__text');
          this.loadingSpinner = this.modal.closest('search-modal').querySelector('.loading-overlay__spinner')
          this.resetButton = this.modal.closest('search-modal').querySelector('button[type="reset"]')
          this.clearText = this.modal.closest('search-modal').querySelector('.search__button-text')
          this.searchForm = this.modal.closest('search-modal').querySelector('form.search-modal__form')
        }
        if(document.querySelector('.template-search__search .search__input')) {
          let searchValue = document.querySelector('.template-search__search .search__input').value
          if (searchValue) this.input.value = ''
        }
      } else {
        document.addEventListener('searchmodal:open', () => {
          this.open()
          removeTrapFocus();
          if(this.modal.className.includes('drawer') && this.modal.className.includes('open')) {
            this.modal.querySelector('.search__input').readOnly = true;
            setTimeout(() => {
              this.modal.querySelector('.search__input').focus({ preventScroll: true })
              this.input.readOnly = false;
            })
          } else {
            this.input.focus()
          }
        })
      }
      this.predictiveSearchResults = this.querySelector('[data-predictive-search]');
      this.abortController = new AbortController();
      this.setupEventListeners(this.searchForm);
    }
  
    setupEventListeners() {
      this.searchForm.addEventListener('submit', this.onFormSubmit.bind(this));
      this.resetButton.addEventListener('click', this.clear.bind(this));
      if(this.buttonClose) this.buttonClose.addEventListener('click', this.clear.bind(this));
      if(this.mobileButtonClose) this.mobileButtonClose.addEventListener('click', this.clear.bind(this));
      this.header.addEventListener('click', (event) => {
        if(!event.target.closest('.search')) this.clear()
      });
      if(this.overlay) this.overlay.addEventListener('click', this.clear.bind(this));
      this.input.addEventListener('input', debounce((event) => {
        this.onChange(event);
      }, 500).bind(this));
      this.input.addEventListener('focus', this.onFocus.bind(this));
      this.addEventListener('keyup', this.onKeyup.bind(this));
      this.addEventListener('keydown', this.onKeydown.bind(this));
      
    }

    buttonClick(event) {
      if((window.innerWidth <= 1024 && document.querySelector('.header-segment-mobile .search').closest('.search--field')) || (window.innerWidth > 1024 && document.querySelector('.header-segment-desktop .search').closest('.search--field'))) {
        event.preventDefault()
        let headerform
        if(window.innerWidth <= 1024 && document.querySelector('.header-segment-mobile .search').closest('.search--field')) headerform = document.querySelector('.header-segment-mobile .search').querySelector('.search-modal__form')
        if(window.innerWidth > 1024 && document.querySelector('.header-segment-desktop .search').closest('.search--field')) headerform = document.querySelector('.header-segment-desktop .search').querySelector('.search-modal__form')
        headerform.submit()
      }
    }
  
    getQuery() {
      return this.input.value.trim();
    }
  
    onChange() {
      const searchTerm = this.getQuery();
      if (searchTerm.length === 0) {
        this.clear();
        return;
      }
      this.getSearchResults(searchTerm)
    }
  
    onFormSubmit(event) {
      if (!this.getQuery().length || this.querySelector('[aria-selected="true"] a')) event.preventDefault();
    }
  
    onFocus() {
      if(this.input.closest('.focused')) return
      document.body.classList.add('predictive-search--focus');
      const searchTerm = this.getQuery();
  
      if (!searchTerm.length) return;
  
      if (this.getAttribute('results') === 'true') {
        this.open();
      } else {
        this.getSearchResults(searchTerm);
      }
    } 
  
    onKeyup(event) {
      if (!this.getQuery().length) this.clear(event);
      event.preventDefault();
  
      switch (event.code) {
        case 'ArrowUp':
          this.switchOption('up')
          break;
        case 'ArrowDown':
          this.switchOption('down');
          break;
        case 'Enter':
          this.selectOption();
          break;
      }
    }
  
    onKeydown(event) {
      // Prevent the cursor from moving in the input when using the up and down arrow keys
      if (
        event.code === 'ArrowUp' ||
        event.code === 'ArrowDown'
      ) {
        event.preventDefault();
      }
    }
  
    switchOption(direction) {
      if (!this.getAttribute('open')) return;
      
      const moveUp = direction === 'up';
      const selectedElement = this.querySelector('[aria-selected="true"]');
      const allElements = this.querySelectorAll('li');
      let activeElement = this.querySelector('li');
  
      if (moveUp && !selectedElement) return;
  
      this.statusElement.textContent = ''; 
  
      if (!moveUp && selectedElement) {
        activeElement = selectedElement.nextElementSibling || allElements[0];
      } else if (moveUp) {
        activeElement = selectedElement.previousElementSibling || allElements[allElements.length - 1];
      }
  
      if (activeElement === selectedElement) return;
  
      activeElement.setAttribute('aria-selected', true);
      if (selectedElement) selectedElement.setAttribute('aria-selected', false);
   
      this.setLiveRegionText(activeElement.textContent);
      this.input.setAttribute('aria-activedescendant', activeElement.id);
    }
  
    selectOption() {
      const selectedProduct = this.querySelector('[aria-selected="true"] a, [aria-selected="true"] button');
      if (selectedProduct) selectedProduct.click();
    }
  
    getSearchResults(searchTerm) {
      const queryKey = searchTerm.replace(" ", "-").toLowerCase();
      this.setLiveRegionLoadingState();
  
      if (this.cachedResults[queryKey]) {
        this.renderSearchResults(this.cachedResults[queryKey]);
        if (this.modal) this.modal.classList.add('searching');
        return;
      }
  
      fetch(`${window.routes.predictive_search_url}?q=${encodeURIComponent(searchTerm)}&${encodeURIComponent('resources[limit_scope]')}=each&section_id=predictive-search`, {
        signal: this.abortController.signal,
        })
      .then((response) => { 
          if (!response.ok) {
            var error = new Error(response.status);
            throw error;
          }
  
          return response.text();
        })
        .then((text) => {
          const resultsMarkup = new DOMParser().parseFromString(text, 'text/html').querySelector('#shopify-section-predictive-search').innerHTML;
          this.cachedResults[queryKey] = resultsMarkup;
          this.renderSearchResults(resultsMarkup);

          
          if (this.modal) {
            setTimeout(() => {
              this.modal.classList.add('searching')
            }, 100)
          }
        })
        .catch((error) => {
          throw error;
        });

    }
  
    setLiveRegionLoadingState() {
      this.loadingSpinner.classList.remove('hidden')
      this.statusElement = this.statusElement || this.querySelector('.predictive-search-status');
      this.loadingText = this.loadingText || this.getAttribute('data-loading-text');
      this.setLiveRegionText(this.loadingText);
      this.setAttribute('loading', true);
      this.clearText.classList.add('visually-hidden')
    }
  
    setLiveRegionText(statusText) {
      this.statusElement.setAttribute('aria-hidden', 'false');
      this.statusElement.textContent = statusText;
      
      setTimeout(() => {
        this.statusElement.setAttribute('aria-hidden', 'true');
      }, 1000);
    }
  
    renderSearchResults(resultsMarkup) {
      this.predictiveSearchResults.innerHTML = resultsMarkup;
      this.setAttribute('results', true);  
      this.predictiveSearchResults.classList.remove('visually-hidden')
      this.setLiveRegionResults();
      this.open();
      if(this.input.value != '' && this.input.closest('form').querySelector('.search__button').hasAttribute('tabindex') && this.input.closest('form').querySelector('.search__button').getAttribute('tabindex') != '0') {
        this.input.closest('form').querySelector('.search__button').setAttribute('tabindex', '0')
      } else {
        this.input.closest('form').querySelector('.search__button').setAttribute('tabindex', '-1')
      }
      this.predictiveSearchButton = this.querySelector('.predictive-search__button')
      this.predictiveSearchButton?.addEventListener('click', this.buttonClick.bind(this))
    }
  
    setLiveRegionResults() { 
      this.loadingSpinner.classList.add('hidden')
      this.removeAttribute('loading');
      this.clearText.classList.remove('visually-hidden')
      this.setLiveRegionText(this.querySelector('[data-predictive-search-live-region-count-value]').textContent);
    }
  
    open() {
      this.setAttribute('open', true);
      this.input.setAttribute('aria-expanded', true);
      document.body.classList.add('predictive-search--focus');
    }
  
    clear(event) {
      if(event) event.preventDefault();
      this.clearText.classList.add('visually-hidden')
      this.input.value = '';
      if(this.input.closest('form').querySelector('.search__button')) {
        this.input.closest('form').querySelector('.search__button').setAttribute('tabindex', '-1')
      } 
      this.removeAttribute('open');
      this.removeAttribute('results');
      this.predictiveSearchResults.classList.add('visually-hidden')
      if(event && event.target.closest('.search__button')?.querySelector('.search__button-text')) {
        trapFocus(this.input);
        setTimeout( () => this.input.focus(), 100)
      }
  
      if (this.modal) this.modal.classList.remove('searching');
    }
  }
  
customElements.define('predictive-search', PredictiveSearch);