import BaseComponent from '../BaseComponent.js';

export default class MysteryWordSection extends BaseComponent {

    static path = "components/mystery-word-section"

    constructor(app, container) {
        super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const openMysterySettingsBtn = document.getElementById('openMysterySettingsBtn');
        const mysteryCloseModalBtn = document.getElementById('mysteryCloseModalBtn');
       
        if (openMysterySettingsBtn) {
            openMysterySettingsBtn.addEventListener('click', () => {
                this.app.state.ui.components.InteractiveScreen.Modals.open("mystery");
            });
        }
        if (mysteryCloseModalBtn) {
            mysteryCloseModalBtn.addEventListener('click', () => {
                this.app.closeAllSectionModals();
            });
        }


    
    }

    updateDisplay() {
        const displayEl = document.getElementById("mysteryWordDisplay");
        if (!displayEl) return;

        const len = this.app.state.grid.mysteryWordConfig.length || 9;
        let wordArr = Array(len).fill("_");

        this.app.state.grid.cells.forEach((cell) => {
            if (cell.isMystery && cell.mysteryPosition) {
                const pos = parseInt(cell.mysteryPosition, 10) - 1;
                if (pos >= 0 && pos < len) {
                    const letter = cell.letter ? cell.letter.toUpperCase() : "_";
                    wordArr[pos] = letter !== "" ? letter : "_";
                }
            }
        });

        displayEl.textContent = wordArr.join(" ");
    }
}