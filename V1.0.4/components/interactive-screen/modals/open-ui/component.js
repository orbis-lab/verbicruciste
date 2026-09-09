import BaseComponent from '../../../BaseComponent.js';

export default class OpenUI extends BaseComponent {

    static path = "components/interactive-screen/modals/open-ui"
    
    constructor(app, container) {
       super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const importJSON = document.getElementById('importJSON');


        if (importJSON) {
            importJSON.addEventListener('click', () => {
                this.app.loadFileInput();
            });
        }


    }

    destroy() {
        const targetContainer = typeof this.container === 'string'
            ? document.querySelector(this.container)
            : this.container;


        targetContainer.innerHTML = "htmlContent";
    }
}