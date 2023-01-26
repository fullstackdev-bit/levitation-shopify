class SingleVideoBarSlider {
  constructor(id) {
    this.cardRow = document.getElementById(id);
    this.videoSlider = this.cardRow.querySelector('.single-video-slider');
    this.cardVideos = this.cardRow.querySelectorAll('.single-card-video');
    this.cardImage = this.cardRow.querySelector('.single-card-image-wide');
    this.chevLeft = this.cardRow.querySelector('.single-chevron.left');
    this.chevRight = this.cardRow.querySelector('.single-chevron.right');

    // Slide Properties
    this.cardsPerSlide = 4;
    this.translateVal = 0;
    this.currentTransVal = 0;
    this.slideIndex = 0;
    this.lockLeft = false;
    this.lockRight = false;
    this.isSliding = false;

    if (this.isMobile()) {
      this.cardRow.style.overflow = 'scroll';
    } else {
      this.init();
      this.chevLeft.addEventListener('click', this.slideLeft.bind(this), false);
      this.chevRight.addEventListener('click', this.slideRight.bind(this), false);

      // Handle Browser Resize
      window.addEventListener('resize', this.init.bind(this), false);
    }

    this.videoSlider.addEventListener('wheel', e => {
      // Ignore vertical scroll
      if (e.deltaY !== 0) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (this.isSliding) return;

      if (e.deltaX >= 0 && !this.lockRight) {
        this.isSliding = true;
        this.slideRight();
      }

      if (e.deltaX < 0 && !this.lockLeft) {
        this.isSliding = true;
        this.slideLeft();
      }
    });
  }

  init() {
    this.chevLeft.style.height = `${this.cardImage.offsetHeight}px`;
    this.chevRight.style.height = `${this.cardImage.offsetHeight}px`;
    this.cardsPerSlide = Math.floor(this.cardRow.clientWidth / this.cardVideos[0].clientWidth);
    this.translateVal = this.cardVideos[0].clientWidth * this.cardsPerSlide + (4 * this.cardsPerSlide);
    this.handleShowChev();
  }

  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    ) || (navigator.userAgent.match(/Mac/) && navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  }

  handleShowChev() {
    const grouped = this.cardVideos.length / this.cardsPerSlide;
    if (this.slideIndex < grouped - 1) {
      this.chevRight.classList.add('active');
      this.lockRight = false;
      this.chevLeft.classList.add('active');
      this.lockLeft = false;
    } else {
      this.chevRight.classList.remove('active');
      this.lockRight = true;
      this.chevLeft.classList.add('active');
      this.lockLeft = false;
    }

    if (this.slideIndex === 0) {
      this.chevLeft.classList.remove('active');
      this.lockLeft = true;
    }

    setTimeout(() => (this.isSliding = false), 1500);
  }

  slideLeft() {
    this.slideIndex -= 1;
    const val = this.currentTransVal - this.translateVal;
    this.videoSlider.style.transform = `translate3d(-${val}px, 0px, 0px)`;
    this.currentTransVal = this.translateVal * this.slideIndex;
    this.handleShowChev();
  }

  slideRight() {
    this.slideIndex += 1;
    this.currentTransVal = this.translateVal * this.slideIndex;
    this.videoSlider.style.transform = `translate3d(-${this.currentTransVal}px, 0px, 0px)`;
    this.handleShowChev();
  }
}
