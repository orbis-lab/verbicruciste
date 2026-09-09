import BaseComponent from '../../BaseComponent.js';

export default class CustomConfirm extends BaseComponent {

    static path = "components/interactive-screen/custom-confirm"
    
    constructor(app, container) {
        super(app, container);

        this.modalEl = null
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {


        this.modalEl = document.getElementById('customConfirmModal');
        const okBtn = document.getElementById('customConfirmOkBtn');
        const cancelBtn = document.getElementById('customConfirmCancelBtn');

        if (okBtn) {
            okBtn.addEventListener('click', () => {
                this.close();
                if (this.resolveCallback) this.resolveCallback(true);
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.close();
                if (this.resolveCallback) this.resolveCallback(false);
            });
        }

        if (this.modalEl) {
            this.modalEl.addEventListener('click', (e) => {
                if (e.target === this.modalEl) {
                    this.close();
                    if (this.resolveCallback) this.resolveCallback(false);
                }
            });
        }


    }

    show(message) {
        return new Promise((resolve) => {
            this.resolveCallback = resolve;
            if (!this.modalEl) return resolve(false);

            const msgEl = document.getElementById('customConfirmMessage');
            if (msgEl) msgEl.textContent = message;

            this.modalEl.classList.add('active');
        });
    }

    close() {
        if (this.modalEl) {
            this.modalEl.classList.remove('active');
        }
    }
}

















