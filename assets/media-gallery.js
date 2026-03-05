if (!customElements.get('media-gallery')) {
    customElements.define('media-gallery', class MediaGallery extends HTMLElement {
      constructor() {
        super();
        this.elements = {
          liveRegion: this.querySelector('[id^="GalleryStatus"]'),
          viewer: this.querySelector('[id^="GalleryViewer"]'),
          thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
          slider: this.querySelector('[id^="Slider-Thumbnails"]'),
          sliderMedia: this.querySelector('[id^="Slider-Gallery"]'),
          thumbnailsArray: this.querySelectorAll('[id^="Slide-Thumbnails"]'),
          prevButton: this.querySelectorAll('button[name="previous"]'),
          nextButton: this.querySelectorAll('button[name="next"]')
        }
        this.elements.sliderItems = this.elements.sliderMedia
        ? this.elements.sliderMedia.querySelectorAll('[id^="Slide-"]')
        : [];
        this.mql = window.matchMedia('(min-width: 769px)');
        if (!this.elements.thumbnails) return;
        this.elements.slider.addEventListener('click', this.setActiveThumbnail.bind(this))
        this.elements.slider.addEventListener('keyup', (event) => {
          if (event.code.toUpperCase() === 'ENTER') this.setActiveThumbnail(event)
        })
      }
  
      setActiveMedia(mediaId) { 
        const activeMedia = this.elements.viewer.querySelector(`[data-media-id="${ mediaId }"]`)
        const prevActiv = this.elements.viewer.querySelector(`.is-active`)
        if(prevActiv) prevActiv.classList.remove('is-active');
        if (activeMedia) activeMedia.classList.add('is-active');
        if (this.elements.viewer.querySelectorAll(`.product__media-item--hide`).length > 0 && activeMedia) {
          let activeMediaAlt = activeMedia.dataset.mediaAlt
          this.elements.viewer.querySelectorAll(`.product__media-item-image`).forEach(media => {
            media.classList.remove('product__media-item--variant-alt', 'product__media-item--show')
            if (media.dataset.mediaAlt == activeMediaAlt) media.classList.add('product__media-item--variant-alt')
          })
        } 
        else if (this.elements.viewer.querySelectorAll(`.product__media-item--hide`).length < 1) {
          const prevActiv = this.elements.viewer.querySelector(`.is-active`)
          if(prevActiv) prevActiv.classList.remove('is-active');
          if (activeMedia) activeMedia.classList.add('is-active');
        }
        if (!activeMedia) return
        if (activeMedia) {
          if(this.elements.sliderMedia.classList.contains('gallery__grid-original')) {
            let height = activeMedia.offsetHeight
            this.elements.sliderMedia.style.height = height + 'px'
          }
          this.elements.sliderMedia.scrollTo({
            left: activeMedia.offsetLeft,
            behavior: 'smooth'
          })
        }
        if (this.querySelector('[id^="GalleryThumbnails"]')) {
          const prevActiveThumbnail = this.elements.thumbnails.querySelector(`.is-active`)
          if (prevActiveThumbnail) prevActiveThumbnail.classList.remove('is-active')
          let activeMediaAlt
          let mediaIdValue
          if (activeMedia) {
            activeMediaAlt = activeMedia.dataset.mediaAlt
            mediaIdValue = activeMedia.dataset.mediaId
          }
          const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaIdValue }"]`)
          if (activeThumbnail) activeThumbnail.classList.add('is-active')
          if (this.elements.viewer.querySelectorAll(`.product__media-item--hide`).length > 0 && activeMedia) {
            this.elements.thumbnails.querySelectorAll(`.thumbnail-list__item-image`).forEach(thumbnail => {
              thumbnail.classList.remove('product__media-item--variant-alt', 'product__media-item--show')
              if (thumbnail.dataset.mediaAlt == activeMediaAlt) thumbnail.classList.add('product__media-item--variant-alt')
            })
          } 
          this.elements.slider.scrollTo({
            left: activeThumbnail.offsetLeft - activeThumbnail.offsetWidth - 8,
            behavior: 'smooth'
          })
          if (activeThumbnail.parentElement.classList.contains('thumbnail-list--column')) {
            this.elements.thumbnails.scrollTo({
              top: activeThumbnail.offsetTop - activeThumbnail.offsetHeight - 8,
              behavior: 'smooth'
            })
          }
        }
        if (!activeMedia) return
        this.preventStickyHeader();
        if (window.innerWidth > 768) window.setTimeout(() => {
          if (this.dataset.desktopLayout === 'stack' || this.dataset.desktopLayout === 'grid' || this.dataset.desktopLayout === 'alternative_1' || this.dataset.desktopLayout === 'alternative_2') {
            activeMedia.scrollIntoView({behavior: 'smooth'});
          }
        });
        this.playActiveMedia(activeMedia);
        if (!this.elements.thumbnails) return;
        this.announceLiveRegion(activeMedia, this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`).dataset.mediaPosition);
      }
  
      setActiveThumbnail(event) {
        this.elements.sliderMedia.classList.add('disable-scroll')
        if(!event.target.closest('.thumbnail-list__item')) return
        this.elements.thumbnails.querySelectorAll('button').forEach((element) => element.removeAttribute('aria-current'));
        this.elements.thumbnails.querySelectorAll('li').forEach(item => item.classList.remove('is-active'))
        this.elements.sliderMedia.querySelectorAll('li').forEach(item => item.classList.remove('is-active'))
        let newActiveThumb = event.target.closest('.thumbnail-list__item')
        let activeThumbData = newActiveThumb.dataset.target
        
        let newActiveMedia = this.elements.sliderMedia.querySelector(`[data-media-id="${ activeThumbData }"]`)
        setTimeout(() => {
          newActiveThumb.classList.add('is-active')
          newActiveThumb.querySelector('button').setAttribute('aria-current', true);
          newActiveMedia.classList.add('is-active')
          if (this.dataset.desktopLayout === 'stack' || this.dataset.desktopLayout === 'grid' || this.dataset.desktopLayout === 'alternative_1' || this.dataset.desktopLayout === 'alternative_2') {
            let newActiveMediaTop = newActiveMedia.getBoundingClientRect().top + pageYOffset
            document.documentElement.scrollTo({
              top: newActiveMediaTop,
              behavior: 'smooth'
            })
          }
          if(this.elements.sliderMedia.classList.contains('gallery__grid-original')) {
            let height = newActiveMedia.offsetHeight
            this.elements.sliderMedia.style.height = height + 'px'
          }
            this.elements.sliderMedia.scrollTo({
            left: newActiveMedia.offsetLeft
          })
          if (this.elements.slider.classList.contains('thumbnail-list--column')) {
            this.elements.slider.closest('.thumbnail-slider--column').scrollTo({
              top: newActiveThumb.offsetTop - newActiveThumb.offsetHeight - 8,
              behavior: 'smooth'
            })
          } else {
            this.elements.slider.scrollTo({
              left: newActiveThumb.offsetLeft - newActiveThumb.offsetWidth - 8,
              behavior: 'smooth'
            })
          }
          if (this.elements.prevButton || this.elements.nextButton) {
            let activeSlideIndex = Array.from(this.elements.sliderItems).indexOf(newActiveMedia) 
            let nextActiveSlide = 1
            activeSlideIndex > this.elements.sliderItems.length - 1 - nextActiveSlide ? this.elements.nextButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.elements.nextButton.forEach(button => button.removeAttribute('disabled'))
            activeSlideIndex == 0 ? this.elements.prevButton.forEach(button => button.setAttribute('disabled', 'disabled')) : this.elements.prevButton.forEach(button => button.removeAttribute('disabled'))
          }
        }, 5) 
        setTimeout(() => this.elements.sliderMedia.classList.remove('disable-scroll'), 300)
      }
  
      announceLiveRegion(activeItem, position) {
        const image = activeItem.querySelector('.product__modal-opener--image img');
        if (!image) return;
        image.onload = () => {
          this.elements.liveRegion.setAttribute('aria-hidden', false);
          this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace(
            '[index]',
            position
          );
          setTimeout(() => {
            this.elements.liveRegion.setAttribute('aria-hidden', true);
          }, 2000);
        };
        image.src = image.src;
      }
  
      playActiveMedia(activeItem) {
        window.pauseAllMedia();
        const deferredMedia = activeItem.querySelector('.deferred-media');
        if (deferredMedia) deferredMedia.loadContent(false);
      }
  
      preventStickyHeader() {
        this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
        if (!this.stickyHeader) return;
        this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
      }
  
      removeListSemantic() {
        if (!this.elements.viewer.slider) return;
        this.elements.viewer.slider.setAttribute('role', 'presentation');
        this.elements.viewer.sliderItems.forEach(slide => slide.setAttribute('role', 'presentation'));
      }
    });
}  