class FacetFiltersForm extends HTMLElement {
    constructor() {
      super();
  
      this.onActiveFilterClick = this.onActiveFilterClick.bind(this);
      this.debouncedOnSubmit = debounce((event) => {
        this.onSubmitHandler(event);
      }, 500);
      this.sortingWidth = 0
      this.buttonWidth = 0
      this.elementsWidth = 0
      this.columnGap = 0
      this.querySelectorAll('form').forEach(form => {
        form.addEventListener('change', this.debouncedOnSubmit.bind(this));
      })
      this.addEventListener('price-range-change', this.debouncedOnSubmit.bind(this));
    }

    static setListeners() {
      const onHistoryChange = (event) => {
        const searchParams = event.state ? event.state.searchParams : FacetFiltersForm.searchParamsInitial;
        if (searchParams === FacetFiltersForm.searchParamsPrev) return;
        FacetFiltersForm.renderPage(searchParams, null, false);
      }
      window.addEventListener('popstate', onHistoryChange);
    }
  
    static renderPage(searchParams, event, updateURLHash = true, updateCountsContent = false) {
      const targetSection = event.target.closest('.shopify-section');
      FacetFiltersForm.searchParamsPrev = searchParams;
      FacetFiltersForm.shouldUpdateCountsContent = updateCountsContent; 
      const sections = FacetFiltersForm.getSections(targetSection);
      const facetDrawer = targetSection.querySelector('#FacetFiltersFormMobile');
      const loader = facetDrawer.querySelector('.results-toast.button .loading-overlay__spinner');
      loader.classList.remove('hidden');
      const countContainer = targetSection.querySelector('[id^="ProductCount--"]');
      targetSection.querySelector('[id^="ProductGridContainer--"]').querySelector('.collection').classList.add('loading');
      if (countContainer) countContainer.classList.add('loading');  
      if (facetDrawer) facetDrawer.classList.add('loading');
  
      sections.forEach((section) => {
        const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
        const filterDataUrl = element => element.url === url;
        const cachedSection = FacetFiltersForm.filterData.find(filterDataUrl);

        if (!cachedSection) {
          FacetFiltersForm.renderSectionFromFetch(url, event, targetSection);
          return;
        }

        const cachedSectionGridSwitcher = new DOMParser().parseFromString(cachedSection.html, 'text/html').querySelector('.grid-switcher');
        const hasCurrentGridType = !cachedSectionGridSwitcher || cachedSectionGridSwitcher.dataset.gridType === localStorage.getItem("product-grid-type");

        if (hasCurrentGridType) {
          FacetFiltersForm.renderSectionFromCache(filterDataUrl, event, targetSection) 
        } else {
          FacetFiltersForm.renderSectionFromFetch(url, event, targetSection);
        }
      });

      if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);
      document.dispatchEvent(new CustomEvent('page:reloaded'));
    }
  
    static renderSectionFromFetch(url, event, targetSection) {
      fetch(url)
        .then(response => response.text())
        .then((responseText) => {
          const html = responseText;
          FacetFiltersForm.filterData.push({ html, url });
          FacetFiltersForm.renderFilters(html, event, targetSection);
          FacetFiltersForm.renderProductGridContainer(html, targetSection);
          FacetFiltersForm.renderProductCount(html, targetSection);
        })
        .catch((e) => {
          console.error(e);
        });
    }
    
    static renderSectionFromCache(filterDataUrl, event, targetSection) {
      const html = FacetFiltersForm.filterData.find(filterDataUrl).html;
      FacetFiltersForm.renderFilters(html, event, targetSection);
      FacetFiltersForm.renderProductGridContainer(html, targetSection);
      FacetFiltersForm.renderProductCount(html, targetSection);
    }
  
    static renderProductGridContainer(html, targetSection) {
      targetSection.querySelector('[id^="ProductGridContainer--"]').innerHTML = new DOMParser().parseFromString(html, 'text/html').querySelector('[id^="ProductGridContainer--"]').innerHTML;
      document.dispatchEvent(new CustomEvent('filters-ajax-page-load'));
    }
  
    static renderProductCount(html, targetSection) {
      const count = new DOMParser().parseFromString(html, 'text/html').querySelector('[id^="ProductCount--"]').innerHTML
      const container = targetSection.querySelector('[id^="ProductCount--"]');

      if (container) {
        container.innerHTML = count;
        container.classList.remove('loading');
      }
    }
  
    static renderFilters(html, event, targetSection) {
      const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
  
      const facetDetailsElements =
        parsedHTML.querySelectorAll('#FacetSortForm .js-filter, #FacetFiltersFormMobile .js-filter');
      
      const matchesId = (element) => { 
        const jsFilter = event ? event.target.closest('.js-filter') : undefined;
        return jsFilter ? element.id === jsFilter.id : false; 
      }
      const facetsToRender = Array.from(facetDetailsElements).filter(element => !matchesId(element));
      const countsToRender = Array.from(facetDetailsElements).find(matchesId);
  
      facetsToRender.forEach((element) => {
        if(element.querySelector('.facets__price')) {
          document.querySelector(`.js-filter[id="${element.id}"]`).querySelector('.accordion__panel').innerHTML = element.querySelector('.accordion__panel').innerHTML;
        } else {
          document.querySelector(`.js-filter[id="${element.id}"]`).innerHTML = element.innerHTML;
        }
      });
      document.dispatchEvent(new CustomEvent('filters:rerendered'));
      FacetFiltersForm.renderActiveFacets(parsedHTML);
      FacetFiltersForm.renderAdditionalElements(parsedHTML);
  
      if (countsToRender) FacetFiltersForm.renderCounts(countsToRender, event.target.closest('.js-filter'));
  
      const facetDrawer = targetSection.querySelector('#FacetFiltersFormMobile');
      if (facetDrawer) facetDrawer.classList.remove('loading');
    }
  
    static renderActiveFacets(html) {
      const activeFacetElementSelectors = ['.active-facets', '.active-facets-drawer', '.results-toast', '.facets-header__container', '#FacetSortForm .facets-header__container', '#FacetSortForm .facet-filters-form-wrapper'];
  
      activeFacetElementSelectors.forEach((selector) => {
        const activeFacetsElement = html.querySelector(selector);
        if (!activeFacetsElement) return;
        document.querySelector(selector).innerHTML = activeFacetsElement.innerHTML;
      })
    }
  
    static renderAdditionalElements(html) {
      const mobileElementSelectors = ['.facets__open', '.sorting'];
  
      mobileElementSelectors.forEach((selector) => {
        if (!html.querySelector(selector)) return;
        document.querySelector(selector).innerHTML = html.querySelector(selector).innerHTML;
      });
    }

    static renderCounts(source, target) {
      const targetElement = target.querySelector('.accordion__footer');
      const sourceElement = source.querySelector('.accordion__footer');
      if (sourceElement && targetElement) {
        target.querySelector('.accordion__footer').outerHTML = source.querySelector('.accordion__footer').outerHTML;
      } 

      if (!FacetFiltersForm.shouldUpdateCountsContent) {
        return;
      }
      
      const targetElement2 = target.querySelector('.accordion__content');
      const sourceElement2 = source.querySelector('.accordion__content');
      if (sourceElement2 && targetElement2) {
        target.querySelector('.accordion__content').outerHTML = source.querySelector('.accordion__content').outerHTML;
      } 
    }
  
    static updateURLHash(searchParams) {
      history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
    }
  
    static getSections(targetSection = document) {
      return [
        {
          section: targetSection.querySelector('[id^="product-grid--"]').dataset.id,
        }
      ]
    }
  
    onSubmitHandler(event) {
      event.preventDefault();

      const formElement = event.target.closest('form');
      if (!formElement) return;

      const formData = new FormData(formElement);
      const searchParams = new URLSearchParams(formData).toString();
      FacetFiltersForm.renderPage(searchParams, event);
    }
  
    onActiveFilterClick(event) {
      event.preventDefault();
      const url = new URL(event.currentTarget.href);
      const formElement = this.querySelector('form');
      if (!formElement) return;
      const searchParams = url.searchParams.toString();
      FacetFiltersForm.renderPage(searchParams, event, undefined, true);
    }
}
FacetFiltersForm.filterData = [];
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);
customElements.define('facet-filters-form', FacetFiltersForm);
FacetFiltersForm.setListeners();
  
class FacetRemove extends HTMLElement {
    constructor() {
      super();
  
      this.querySelector('a').addEventListener('click', (event) => {
        event.preventDefault();
        const form = this.closest('facet-filters-form') || document.querySelector('facet-filters-form');
        const currentPanel = event.target.closest('.accordion__panel');
        form.onActiveFilterClick(event);
        const onFiltersRerendered = () => {
          if (!currentPanel) return;
  
          const priceRangeEl = currentPanel.querySelector('price-range');
          if (!priceRangeEl) return;
  
          const inputs = priceRangeEl.querySelectorAll('input');
          const minInput = inputs[0];
          const maxInput = inputs[1];
  
          const min = Number(priceRangeEl.dataset.min);
          const max = Number(priceRangeEl.dataset.max);
  
          minInput.value = min;
          maxInput.value = max;
  
          priceRangeEl.style.setProperty('--progress-lower', '0%');
          priceRangeEl.style.setProperty('--progress-upper', '100%');
  
          const handles = priceRangeEl.querySelectorAll('.price-range__thumbs');
          handles[0].ariaValueNow = min;
          handles[1].ariaValueNow = max;
  
          minInput.setAttribute('max', max);
          maxInput.setAttribute('min', min);
        };
        setTimeout(() => onFiltersRerendered(), 300)
      });
    }
}
customElements.define('facet-remove', FacetRemove);

class PriceRange extends HTMLElement {
	constructor() {
    super();

    this.min = Number(this.dataset.min);
		this.max = Number(this.dataset.max);
    this.track = this.querySelector('.price-range__track-active');
		this.handles = [...this.querySelectorAll('.price-range__thumbs')];
		this.startPos = 0;
		this.activeHandle;
    this.isDragging = false;
		
		this.handles.forEach(handle => {
			handle.addEventListener('mousedown', this.startMove.bind(this));
      handle.addEventListener('touchstart', this.startMove.bind(this), { passive: true });
		})
		
		window.addEventListener('mouseup', this.stopMove.bind(this));
    window.addEventListener('touchend', this.stopMove.bind(this));

    this.querySelectorAll('input').forEach(
      element => {
        element.addEventListener('blur', this.onInputBlur.bind(this))
        element.addEventListener('keydown', this.onInputKeydown.bind(this));
      }
    );

	}

  onInputBlur(event) {
    const inputs = this.querySelectorAll('input');
    const minInput = inputs[0];
    const maxInput = inputs[1];
    let minValue = minInput.value === '' ? this.min : Number(minInput.value);
    let maxValue = maxInput.value === '' ? this.max : Number(maxInput.value);
    if (minValue < this.min) minValue = this.min;
    if (maxValue > this.max) maxValue = this.max;
    if (minValue > maxValue) {
      event.currentTarget === minInput ? minValue = maxValue : maxValue = minValue;
    }

    minInput.value = minValue;
    maxInput.value = maxValue;

    const minPercentage = ((minValue - this.min) / (this.max - this.min)) * 100;
    const maxPercentage = ((maxValue - this.min) / (this.max - this.min)) * 100;

    this.style.setProperty('--progress-lower', minPercentage + "%");
    this.style.setProperty('--progress-upper', maxPercentage + "%");

    this.handles[0].ariaValueNow = minValue;
    this.handles[1].ariaValueNow = maxValue;

    this.setMinAndMaxValues();
    this.dispatchEvent(new CustomEvent('price-range-change', { bubbles: true }));
}

onInputKeydown(event) {
  if (event.key === 'Enter') {
    this.onInputBlur(event);
  }
}

	startMove(e) {
    e.preventDefault();

		this.startPos = e.type === 'mousedown' ? e.offsetX : e.touches[0].clientX - e.target.getBoundingClientRect().left;
		this.activeHandle = e.target;
    this.isDragging = true;
		this.moveListener = this.move.bind(this);
		if (e.type === 'mousedown') {
        window.addEventListener("mousemove", this.moveListener);
    } else {
        window.addEventListener("touchmove", this.moveListener, { passive: true });
    }
	}
	
	move(e) {
    if (!this.isDragging) return;

		const isLower = this.activeHandle.classList.contains('is-lower');
		const property = isLower ? '--progress-lower' : '--progress-upper';
		const parentRect = this.track.getBoundingClientRect();
		const handleRect = this.activeHandle.getBoundingClientRect();

		let newX = (e.type === 'mousemove' ? e.clientX : e.touches[0].clientX) - parentRect.x - this.startPos;
		
    if (isLower) {
			const otherX = parseInt(this.style.getPropertyValue('--progress-upper'));

      if (theme.config.isRTL) {
        const percentageX = parentRect.width - (otherX * parentRect.width / 100);
        newX = Math.max(newX, percentageX);
        newX = Math.min(newX, parentRect.width - handleRect.width / 2);
      } else {
        const percentageX = otherX * parentRect.width / 100;
        newX = Math.min(newX, percentageX - handleRect.width);
        newX = Math.max(newX, 0 - handleRect.width/2);
      }
		}
    else {
      const otherX = parseInt(this.style.getPropertyValue('--progress-lower'));

      if (theme.config.isRTL) {
        const percentageX = parentRect.width - (otherX * parentRect.width / 100);
        newX = Math.min(newX, percentageX - handleRect.width);
        newX = Math.max(newX, 0 - handleRect.width / 2);
      } else {
        const percentageX = otherX * parentRect.width / 100;
        newX = Math.max(newX, percentageX);
        newX = Math.min(newX, parentRect.width - handleRect.width/2);
      }
		}

    let percentage = (newX + handleRect.width/2) / parentRect.width;
    if (theme.config.isRTL) percentage = 1 - percentage;
    const valuenow = this.calcHandleValue(percentage);
    this.style.setProperty(property, percentage * 100 + "%");
		this.activeHandle.ariaValueNow = valuenow;

    const inputs = this.querySelectorAll('input');
    const input = isLower ? inputs[0] : inputs[1];
    input.value = valuenow;
    
    this.adjustToValidValues(input);
    this.setMinAndMaxValues();
	}
	
	calcHandleValue(percentage) {
		return Math.round(percentage * (this.max - this.min) + this.min);
	}
	
	stopMove() {
		if (this.isDragging) {
      this.isDragging = false;
      window.removeEventListener('mousemove', this.moveListener);
      window.removeEventListener('touchmove', this.moveListener, { passive: true });
      this.dispatchEvent(new CustomEvent('price-range-change', { bubbles: true }));
    }
	}

  setMinAndMaxValues() {
    const inputs = this.querySelectorAll('input');
    const minInput = inputs[0];
    const maxInput = inputs[1];
    if (maxInput.value) minInput.setAttribute('max', maxInput.value);
    if (minInput.value) maxInput.setAttribute('min', minInput.value);
    if (minInput.value === '') maxInput.setAttribute('min', 0);
    if (maxInput.value === '') minInput.setAttribute('max', maxInput.getAttribute('max'));
  }

  adjustToValidValues(input) {
    const value = Number(input.value);
    const min = Number(input.getAttribute('min'));
    const max = Number(input.getAttribute('max'));

    if (value < min) input.value = min;
    if (value > max) input.value = max;
  }
}

customElements.define('price-range', PriceRange);