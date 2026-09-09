import BaseComponent from '../../BaseComponent.js';

export default class ApiLoader extends BaseComponent {

    static path = "components/interactive-screen/api-loader"
    
    constructor(app, container) {
        super(app, container);
    }


    async init() {
        // Vos écouteurs ici
    }

    show() {
        let loader = (typeof this.container === 'string' ? document.querySelector(this.container) : this.container).children[0];
        if (loader) loader.classList.add("active");
    }

    hide() {
        let loader = (typeof this.container === 'string' ? document.querySelector(this.container) : this.container).children[0];
        if (loader) loader.classList.remove("active");
    }
}