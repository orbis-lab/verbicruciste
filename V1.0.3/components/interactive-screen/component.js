import BaseComponent from '../BaseComponent.js';

import Modals from "./modals/component.js";
import ApiLoader from "./api-loader/component.js";
import AuthForm from "./auth-form/component.js";
import StartupDialog from "./startup-dialog/component.js";
import CustomAlert from "./custom-alert/component.js";
import CustomConfirm from "./custom-confirm/component.js";

export default class InteractiveScreen extends BaseComponent {

    static path = "components/interactive-screen"

    constructor(app, container) {
        super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    async init() {

        this.Modals = new Modals(this.app, "#ModalTemplate")
        this.ApiLoader = new ApiLoader(this.app, "#ApiLoader")
        this.AuthForm = new AuthForm(this.app, "#AuthForm")
        this.StartupDialog = new StartupDialog(this.app, "#StartupDialog")
        this.CustomAlert = new CustomAlert(this.app, "#CustomAlert")
        this.CustomConfirm = new CustomConfirm(this.app, "#CustomConfirm")


        await Promise.all([
            this.Modals.ready,
            this.ApiLoader.ready,
            this.AuthForm.ready,
            this.StartupDialog.ready,
            this.CustomAlert.ready,
            this.CustomConfirm.ready
        ]);




        this.Modals.onClose = (name) => {

            switch (name) {
                case "settings":
                    this.app.checkIfSettingsISopenedFromStartup()
                    break;
                case "open":
                    this.app.checkIfSettingsISopenedFromStartup()
                    break;
            }
        }
    }
}