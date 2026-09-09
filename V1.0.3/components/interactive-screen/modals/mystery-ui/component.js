import BaseComponent from '../../../BaseComponent.js';

export default class MysteryUI extends BaseComponent {

    static path = "components/interactive-screen/modals/mystery-ui"
   
    constructor(app, container, mysteryLength) {
        super(app, container);

        this.mysteryLength = mysteryLength

    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const applyMysterySettingsBtn = document.getElementById('applyMysterySettingsBtn');
        const settingMysteryLength = document.getElementById('settingMysteryLength');

        settingMysteryLength.value = this.mysteryLength


        if (applyMysterySettingsBtn) {
            applyMysterySettingsBtn.addEventListener('click', () => {
                this.app.applyMysterySettings();
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