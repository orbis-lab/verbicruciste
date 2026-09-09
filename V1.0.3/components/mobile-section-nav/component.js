import BaseComponent from '../BaseComponent.js';

export default class MobileSectionNav extends BaseComponent {

    static path = "components/mobile-section-nav"
    
    constructor(app, container) {
        super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const openSectionSelection = document.getElementById('openSectionSelection');
        const openSectionWords = document.getElementById('openSectionWords');
        const openSectionMystery = document.getElementById('openSectionMystery');



        openSectionSelection.addEventListener('click', (event) => {
            this.app.openSectionModal('selectionMainSection');
        });

        openSectionWords.addEventListener('click', (event) => {
            this.app.openSectionModal('wordsMainSection');
        });

        openSectionMystery.addEventListener('click', (event) => {
            this.app.openSectionModal('MysteryWord');
        });


    }
}