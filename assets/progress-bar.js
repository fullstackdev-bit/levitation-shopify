if (!customElements.get('progress-bar')) {
  class ProgressBar extends HTMLElement {
    constructor() {
      super();
  
      theme.initWhenVisible({
        element: this,
        callback: this.init.bind(this),
        threshold: 0
      });
    }
  
    init() {
      setTimeout(() => {
        const quantity = parseInt(this.dataset.quantity);
        const totalQuantity = parseInt(this.dataset.total);
        let percent = quantity / totalQuantity * 100
        if(!quantity || !totalQuantity) percent = 100
        this.style.setProperty('--progress-bar-width', `${percent}%`);
      }, 300);
    }
  }
  customElements.define('progress-bar', ProgressBar);
}