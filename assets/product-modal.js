if (!customElements.get('product-modal')) {
    customElements.define(
      'product-modal',
      class ProductModal extends ModalDialog {
        constructor() {
          super();

          this.overlayClickHandler = this.onOverlayClick.bind(this);

          this._isOriginalRatioSlideshowModal = !!this.classList.contains('product-media-modal--original-ratio-slideshow');
        }
  
        hide(event) {
          if (event) {
            const target = event.target;
  
            const clickInsideAllowedZone =
              target.closest('.product-media-modal__wrapper--lightbox') ||
              target.closest('.slider') ||
              target.closest('.slider-button') ||
              target.closest('.image-magnify-full-size');
  
            if (clickInsideAllowedZone) {
              return;
            }
          }
          super.hide();
        }
  
        show(opener) {
          super.show(opener);
          this.modalOverlay = this.querySelector('.product-media-modal__content');

          if (this.modalOverlay) {
            this.modalOverlay.removeEventListener('click', this.overlayClickHandler);
            this.modalOverlay.addEventListener('click', this.overlayClickHandler);
          }
          this.showActiveMedia(opener);

          if (this._isOriginalRatioSlideshowModal) {
            this.applyVerticalCenteringToSlides();
          }
        }

        applyVerticalCenteringToSlides() {
          const applyMarginToSlide = (slide) => {
            const visualViewportHeight = window.visualViewport.height;
            if (slide.offsetHeight < visualViewportHeight) {
              slide.style.marginTop = `${(visualViewportHeight - slide.offsetHeight) / 2}px`;
            }
          };
    
          const slides = this.querySelectorAll('[id^="Slide-"]');
          if (slides.length === 0) return;
  
          slides.forEach((slide) => {
            const img = slide.querySelector('img');
            if (img && !img.complete) {
              img.addEventListener('load', () => applyMarginToSlide(slide), { once: true });
            } else {
              applyMarginToSlide(slide);
            }
          })
        }

        onOverlayClick(event) {
          this.hide(event);
        }

        showActiveMedia(opener) {
          if (this.querySelector('[id^="Slider-"]')) this.querySelector('[id^="Slider-"]').style.scrollBehavior = 'auto'

          this.querySelectorAll('img').forEach(image => image.removeAttribute('loading'))
          this.querySelectorAll(`[data-media-id]:not([data-media-id="${this.openedBy.getAttribute("data-media-id")}"])`).forEach((element) => {
              element.classList.remove('active');
            }
          )
          this.querySelector('.slider .is-active')?.classList.remove('is-active')

          let activeMedia = this.querySelector(`[data-media-id="${this.openedBy.getAttribute("data-media-id")}"]`);
          let dataMediaAlt = activeMedia.dataset.mediaAlt

          if (opener.closest('.product__media-list.variant-images')) {
            this.querySelectorAll(`[data-media-alt]`).forEach(element => element.classList.remove('product__media-item--variant-alt'))
            this.querySelectorAll(`[data-media-alt="${dataMediaAlt}"]`).forEach(element => element.classList.add('product__media-item--variant-alt'))
          }

          let activeMediaTemplate = activeMedia.querySelector('template');
          let activeMediaContent = activeMediaTemplate ? activeMediaTemplate.content : null;
          
          activeMedia.classList.add('active');
          const activeSlide = activeMedia.closest('li');
          activeSlide?.classList.add('is-active')

          if (activeMedia.closest('.lazy-image')) activeMedia = activeMedia.closest('.lazy-image')

          const scrollToActiveMedia = () => {
            activeMedia.scrollIntoView({ behavior: 'auto' });
            let container = this.querySelector('[role="document"]');
            container.scrollLeft = (activeMedia.width - container.clientWidth) / 2;
          };

          if (this._isOriginalRatioSlideshowModal) {
            this.adaptSliderHeight(activeSlide, scrollToActiveMedia);
          } else {
            setTimeout(scrollToActiveMedia, 10);
          }
    
          if (activeMedia.nodeName == 'DEFERRED-MEDIA' && activeMediaContent && activeMediaContent.querySelector('.js-youtube')) activeMedia.loadContent();

          document.dispatchEvent(new CustomEvent('image:show'));
        }

        adaptSliderHeight(slide, callback) {
          if (!slide) return;

          const adaptHeight = () => {
            this.querySelector('.slider__grid').style.setProperty('height', slide.offsetHeight + 'px');
            if (callback) callback();
          };

          const img = slide.querySelector('img');
          if (img && !img.complete) {
            img.addEventListener('load', () => adaptHeight(), { once: true });
          } else {
            adaptHeight();
          }
        }
      }
    );
  }