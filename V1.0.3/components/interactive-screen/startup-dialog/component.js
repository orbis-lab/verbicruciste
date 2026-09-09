import BaseComponent from '../../BaseComponent.js';

export default class StartupDialog extends BaseComponent {

    static path = "components/interactive-screen/startup-dialog"
    
    constructor(app, container) {
       super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {


        const restorePreviousSessionBtn = document.getElementById('restorePreviousSessionBtn');
        const openSessionBtn = document.getElementById('openSessionBtn');
        const discardPreviousSessionBtn = document.getElementById('discardPreviousSessionBtn');



        restorePreviousSessionBtn.addEventListener('click', (event) => {
            this.app.restorePreviousSession();
        });

        openSessionBtn.addEventListener('click', (event) => {
            this.app.openSession();
        });

        discardPreviousSessionBtn.addEventListener('click', (event) => {
            this.app.discardPreviousSession();
        });



    }
}