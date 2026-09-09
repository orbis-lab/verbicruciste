import BaseComponent from '../../BaseComponent.js';

import AccountUI from "./account-ui/component.js"
import HelpUI from "./help-ui/component.js"
import MysteryUI from "./mystery-ui/component.js"
import SaveAsUI from "./save-as-ui/component.js"
import SettingsUI from "./settings-ui/component.js"
import ThemeUI from "./theme-ui/component.js"
import OpenUI from "./open-ui/component.js"

export default class Modals extends BaseComponent {

    static path = "components/interactive-screen/modals"
    
    constructor(app, container) {
        super(app, container);

        this.UI = null
        this.currentName = null

        this.onClose = () => { }

    }


    // Méthode privée ou secondaire pour les écouteurs
    init() {


        //const modalOverlay = document.getElementById('modalOverlay');
        const modalClose = document.getElementById('modalClose');

        /* if (modalOverlay) {
            modalOverlay.addEventListener('click', () => {
                this.close();
            });
        } */

        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.close();
            });
        }
    }


    async open(modalName) {

        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalOverlay = document.getElementById('modalOverlay');

        modalOverlay.classList.add("active")

        this.currentName = modalName


        switch (modalName) {
            case "account":
                this.UI = new AccountUI(this.app, modalBody, this.app.state.user.profile.first_name, this.app.state.user.profile.last_name, this.app.state.user.profile.email)
                await this.UI.ready
                modalTitle.innerHTML = " Mon compte"
                break;
            case "help":
                this.UI = new HelpUI(this.app, modalBody)
                await this.UI.ready
                modalTitle.innerHTML = " Aide"
                break;
            case "mystery":
                this.UI = new MysteryUI(this.app, modalBody, this.app.state.grid.mysteryWordConfig.length)
                await this.UI.ready
                modalTitle.innerHTML = " Paramètres du mot mystère"
                break;
            case "save-as":
                this.UI = new SaveAsUI(this.app, modalBody, this.app.state.grid.name)
                await this.UI.ready
                modalTitle.innerHTML = " Enregistrer la grille"
                break;
            case "settings":
                this.UI = new SettingsUI(this.app, modalBody, this.app.state.grid.name, this.app.state.grid.cols, this.app.state.grid.rows)
                await this.UI.ready
                modalTitle.innerHTML = " Paramètres de la grille"
                break;
            case "theme":
                this.UI = new ThemeUI(this.app, modalBody)
                await this.UI.ready
                modalTitle.innerHTML = " Choisir le thème"
                break;
            case "open":
                this.UI =  new OpenUI(this.app, modalBody)
                await this.UI.ready
                modalTitle.innerHTML = " Ouvrir une grille"
                break;
        }
    }

    close() {

        const modalOverlay = document.getElementById('modalOverlay');

        modalOverlay.classList.remove("active")

        this.UI.destroy()

        this.onClose(this.currentName)

    }
}

