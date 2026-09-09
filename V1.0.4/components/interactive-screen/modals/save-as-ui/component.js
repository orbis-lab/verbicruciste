import BaseComponent from '../../../BaseComponent.js';

export default class SaveAsUI extends BaseComponent {

    static path = "components/interactive-screen/modals/save-as-ui"
   
    constructor(app, container, saveAsNAme) {
        super(app, container);

        this.saveAsNAme = saveAsNAme

    }

   
    // Méthode privée ou secondaire pour les écouteurs
    init() {
        
        const saveAsNameInput = document.getElementById("saveAsNameInput")

        saveAsNameInput.value = this.saveAsNAme + " - (Copie)"


        document.getElementById('confirmSaveBtnCloud').addEventListener('click', (event) => {
            this.app.confirmSaveAs('cloud', saveAsNameInput.value);
        });

        document.getElementById('confirmSaveFile').addEventListener('click', (event) => {
            this.app.confirmSaveAs('file', saveAsNameInput.value);
        });

    }

    destroy() {
        const targetContainer = typeof this.container === 'string'
            ? document.querySelector(this.container)
            : this.container;


        targetContainer.innerHTML = "htmlContent";
    }
}