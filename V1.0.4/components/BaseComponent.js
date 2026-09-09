// components/BaseComponent.js
export default class BaseComponent {
    constructor(app, container, path) {

        this.app = app;
        this.container = container;
        this.path = this.constructor.path;

        // Lance automatiquement le chargement et stocke la promesse
        this.ready = this.loadAndInit();
    }

    async loadAndInit() {
        try {
            await Promise.all([
                this.loadHTML(),
                this.loadCSS()
            ]);
            await this.init();
        } catch (error) {
            console.error(`Erreur d'initialisation pour ${this.path} :`, error);
        }
    }

    async loadHTML() {
        const response = await fetch(`${this.path}/index.html`);
        if (!response.ok) {
            throw new Error(`Erreur chargement HTML (${this.path}): ${response.statusText}`);
        }
        const htmlContent = await response.text();

        const targetContainer = typeof this.container === 'string'
            ? document.querySelector(this.container)
            : this.container;

        if (!targetContainer) {
            throw new Error(`Conteneur introuvable pour : ${this.path}`);
        }

        targetContainer.innerHTML = htmlContent;
    }

    async loadCSS() {
        const cssPath = `${this.path}/style.css`;

        return new Promise((resolve, reject) => {
            if (document.querySelector(`link[href="${cssPath}"]`)) {
                return resolve();
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`Impossible de charger le CSS : ${cssPath}`));

            document.head.appendChild(link);
        });
    }

    // Méthode vide par défaut, surchargée par les enfants si besoin
    init() { }

}