import BaseComponent from '../BaseComponent.js';
import Toolbar from './toolbar/component.js';

export default class Header extends BaseComponent {

    static path = "components/header"

    constructor(app, container) {
        super(app, container);
    }

    async init() {

        this.toolbar = new Toolbar(this.app, "#ToolbarContainer")

        const burgerBtn = document.getElementById('burgerBtn');



        burgerBtn.addEventListener('click', (event) => {

            this.app.toggleMobileMenu(event)

        });




    }


}