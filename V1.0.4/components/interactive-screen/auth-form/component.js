import BaseComponent from '../../BaseComponent.js';


export default class AuthForm extends BaseComponent {

    static path = "components/interactive-screen/auth-form"
    
    constructor(app, container) {
        super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {

        document.getElementById('tabLoginBtn').addEventListener('click', (event) => {
            this.setTab('login');
        });

        document.getElementById('tabRegisterBtn').addEventListener('click', (event) => {
            this.setTab('register');
        });

        document.getElementById('loginForm').addEventListener('submit', (event) => {
            this.app.handleLogin(event);
        });

        document.getElementById('registerForm').addEventListener('submit', (event) => {
            this.app.handleRegister(event);
        });


    }

    setTab(tab) {

        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const tabLoginBtn = document.getElementById('tabLoginBtn');
        const tabRegisterBtn = document.getElementById('tabRegisterBtn');


        switch (tab) {
            case 'login':
                loginForm.style.display = 'block';
                registerForm.style.display = 'none';
                tabLoginBtn.classList.add('active');
                tabRegisterBtn.classList.remove('active');
                break;

            case 'register':
                loginForm.style.display = 'none';
                registerForm.style.display = 'block';
                tabRegisterBtn.classList.add('active');
                tabLoginBtn.classList.remove('active');
                break;
        }


    }

    show() {
        document.getElementById('authModal').classList.add('active');
    }

    hide() {
        document.getElementById('authModal').classList.remove('active');
    }

}