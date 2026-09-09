import BaseComponent from '../../../BaseComponent.js';

export default class HelpUI extends BaseComponent {

    static path = "components/interactive-screen/modals/help-ui"
    
    constructor(app, container) {
       super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {
      
    }

    destroy() {
        const targetContainer = typeof this.container === 'string'
            ? document.querySelector(this.container)
            : this.container;


        targetContainer.innerHTML = "htmlContent";
    }
}