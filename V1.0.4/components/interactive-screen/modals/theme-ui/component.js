import BaseComponent from '../../../BaseComponent.js';

export default class ThemeUI extends BaseComponent {

    static path = "components/interactive-screen/modals/theme-ui"
   
    constructor(app, container) {
        super(app, container);
    }


    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const lightThemeBtn = document.getElementById('selectLightThemeBtn');
        const darkThemeBtn = document.getElementById('selectDarkThemeBtn');

        if (lightThemeBtn) {
            lightThemeBtn.addEventListener('click', () => {
                this.app.selectThemeAndClose('light');
            });
        }

        if (darkThemeBtn) {
            darkThemeBtn.addEventListener('click', () => {
                this.app.selectThemeAndClose('dark');
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