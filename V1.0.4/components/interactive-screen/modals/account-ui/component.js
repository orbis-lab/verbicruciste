import BaseComponent from '../../../BaseComponent.js';

export default class AccountUI extends BaseComponent {

    static path = "components/interactive-screen/modals/account-ui"
    
    constructor(app, container, firstName, lastName, email) {
        super(app, container);

        this.firstName = firstName
        this.lastName = lastName
        this.email = email
        this.fullName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : "Utilisateur";


        this.colors = this.getColors()

    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const nameModalDisplay = document.getElementById("userNameModalDisplay");
        const emailModalDisplay = document.getElementById("userEmailModalDisplay");
        const avatarDisplay = document.getElementById("userAvatarDisplay");
        const handleLogoutBtn = document.getElementById('handleLogoutBtn');

        nameModalDisplay.textContent = this.fullName;
        emailModalDisplay.textContent = this.email;
        avatarDisplay.textContent = this.getInitials();
        avatarDisplay.style.backgroundColor = this.getBackgroundColor();


        if (handleLogoutBtn) {
            handleLogoutBtn.addEventListener('click', () => {
                this.app.handleLogout();
            });
        }


    }

    getColors() {
        return [
            '#1976d2', '#d32f2f', '#388e3c', '#f57c00',
            '#7b1fa1', '#0097a7', '#c2175b', '#5d4037'
        ];
    }

    getInitials() {
        return `${this.firstName.charAt(0).toUpperCase()}.${this.lastName.charAt(0).toUpperCase()}`
    }

    getBackgroundColor() {
        let hash = 0;
        let str = this.email || this.fullName;

        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        let colorIndex = Math.abs(hash) % this.colors.length;

        return this.colors[colorIndex];
    }

    destroy() {
        const targetContainer = typeof this.container === 'string'
            ? document.querySelector(this.container)
            : this.container;


        targetContainer.innerHTML = "htmlContent";
    }
}