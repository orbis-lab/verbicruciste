import BaseComponent from '../../BaseComponent.js';

export default class Toolbar extends BaseComponent {

    static path = "components/header/toolbar"
    
    constructor(app, container) {
       super(app, container);
    }


    // Méthode privée ou secondaire pour les écouteurs
    init() {


        const newGridBtn = document.getElementById('newGridBtn');        
        const openGridBtn = document.getElementById('openGridBtn');
        const saveGridBtn = document.getElementById('saveGridBtn');        
        const saveAsGridBtn = document.getElementById('saveAsGridBtn');
        const printGridBtn = document.getElementById('printGridBtn');
        const clearCellBtn = document.getElementById('clearCellBtn');
        const clearGridBtn = document.getElementById('clearGridBtn');
        const settingsGridBtn = document.getElementById('settingsGridBtn');
        const themeAppBtn = document.getElementById('themeAppBtn');
        const helpAppBtn = document.getElementById('helpAppBtn');
        const userAppBtn = document.getElementById('userAppBtn');
       


        newGridBtn.addEventListener('click', (event) => {

            this.app.createGrid();
            this.app.closeMobileMenu();
        });

        openGridBtn.addEventListener('click', (event) => {
            this.app.openLoadModal();
            this.app.closeMobileMenu();
        });

        saveGridBtn.addEventListener('click', (event) => {
            this.app.saveGrid();
            this.app.closeMobileMenu();
        });

        saveAsGridBtn.addEventListener('click', (event) => {
            this.app.state.ui.components.InteractiveScreen.Modals.open("save-as");
            this.app.closeMobileMenu();
        });
        printGridBtn.addEventListener('click', (event) => {
            window.print();
            this.app.closeMobileMenu();
        });

        clearCellBtn.addEventListener('click', (event) => {
            this.app.clearCell();
            this.app.closeMobileMenu();
        });

        clearGridBtn.addEventListener('click', (event) => {
            this.app.clearGrid();
            this.app.closeMobileMenu();
        });

        settingsGridBtn.addEventListener('click', (event) => {
            this.app.state.ui.components.InteractiveScreen.Modals.open("settings")
            this.app.closeMobileMenu();
        });
        
        themeAppBtn.addEventListener('click', (event) => {
            this.app.state.ui.components.InteractiveScreen.Modals.open("theme")
            this.app.closeMobileMenu();
        });

        helpAppBtn.addEventListener('click', (event) => {
            this.app.state.ui.components.InteractiveScreen.Modals.open("help")
            this.app.closeMobileMenu();
        });

        userAppBtn.addEventListener('click', (event) => {
            this.app.state.ui.components.InteractiveScreen.Modals.open("account")
            this.app.closeMobileMenu();
        });


    }
}