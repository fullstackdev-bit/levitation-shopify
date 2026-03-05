if (!customElements.get('icon-library')) {
  class IconLibrary extends HTMLElement {
    constructor() {
      super();

      theme.initWhenVisible({
        element: this,
        callback: this.init.bind(this),
        threshold: 600
      });
    }

    init() {
    this.icon
      this.addEventListener('click', (event) => {
        if (!event.target.closest('.library-subsection__icon')) return
        this.copyIconName(event)
      }) 
    }

    copyIconName(event) {
        event.preventDefault()
        this.icon = event.target.closest('.library-subsection__icon')
        this.iconName = this.icon.querySelector('.library-subsection__icon-name').textContent
        this.subsectionName = ''
        if(this.icon.closest('.library-subsection').querySelector('.library-subsection__heading')) this.subsectionName = this.icon.closest('.library-subsection').querySelector('.library-subsection__heading').dataset.name
        this.sectionName = this.id.split('content-')[1]
        this.subsectionName != '' ? this.copyName = `${this.sectionName}/${this.subsectionName}/${this.iconName}` :this.copyName = `${this.sectionName}/${this.iconName}`
        navigator.clipboard.writeText(this.copyName).then(function () {
            event.target.closest('.library-subsection__icon').querySelector('.library-subsection__icon-name').style.display = 'none'
            event.target.closest('.library-subsection__icon').querySelector('.copy-success').style.display = 'block'
        })
        setTimeout(() => {
            event.target.closest('.library-subsection__icon').querySelector('.library-subsection__icon-name').style.display = 'block'
            event.target.closest('.library-subsection__icon').querySelector('.copy-success').style.display = 'none'
        }, 1600)
    }
  }
  customElements.define('icon-library', IconLibrary);
}