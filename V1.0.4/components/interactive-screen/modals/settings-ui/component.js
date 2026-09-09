import BaseComponent from '../../../BaseComponent.js';

export default class SettingsUI extends BaseComponent {

    static path = "components/interactive-screen/modals/settings-ui"
    
    constructor(app, container, name, cols, rows) {
       super(app, container);

        this.name = name
        this.cols = cols
        this.rows = rows

    }

   
    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const settingName = document.getElementById('settingName')
        const settingCols = document.getElementById('settingCols')
        const settingRows = document.getElementById('settingRows')
        const applySettingsBtn = document.getElementById('applySettingsBtn');

        settingName.value = this.name
        settingCols.value = this.cols;
        settingRows.value = this.rows;


        if (applySettingsBtn) {
            applySettingsBtn.addEventListener('click', () => {
                this.app.applySettings();
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