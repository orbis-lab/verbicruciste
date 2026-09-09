import BaseComponent from '../../BaseComponent.js';

export default class CustomAlert extends BaseComponent {

    static path = "components/interactive-screen/custom-alert"
    
    constructor(app, container) {
        super(app, container);

        this.modalEl = null

    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {


        this.modalEl = document.getElementById('customAlertModal');
        const okBtn = document.getElementById('customAlertOkBtn');

        if (okBtn) {
            okBtn.addEventListener('click', () => this.close());
        }

        if (this.modalEl) {
            this.modalEl.addEventListener('click', (e) => {
                if (e.target === this.modalEl) this.close();
            });
        }


    }

    show(message) {
        if (!this.modalEl) return;
        const msgEl = document.getElementById('customAlertMessage');
        if (msgEl) msgEl.textContent = message;
        this.modalEl.classList.add('active');
    }

    close() {
        if (this.modalEl) {
            this.modalEl.classList.remove('active');
        }
    }
}






