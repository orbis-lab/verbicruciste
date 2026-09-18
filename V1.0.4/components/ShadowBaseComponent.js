// components/ShadowBaseComponent.js
export default class ShadowBaseComponent {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        
        if (!Object.prototype.hasOwnProperty.call(this.constructor, 'path')) {
            throw new Error(`La classe "${this.constructor.name}" doit déclarer sa propre propriété "static path".`);
        }
        this.path = this.constructor.path;
        this.shadow = null;

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

    getTargetContainer() {
        return typeof this.container === 'string'
            ? document.querySelector(this.container)
            : this.container;
    }

    async loadHTML() {
        const response = await fetch(`${this.path}/index.html`);
        if (!response.ok) {
            throw new Error(`Erreur chargement HTML (${this.path}): ${response.statusText}`);
        }
        const htmlContent = await response.text();

        const targetContainer = this.getTargetContainer();
        if (!targetContainer) {
            throw new Error(`Conteneur introuvable pour : ${this.path}`);
        }

        // Création ou récupération immédiate du Shadow DOM
        this.shadow = targetContainer.shadowRoot || targetContainer.attachShadow({ mode: 'open' });
        this.shadow.innerHTML = htmlContent;
    }

    async loadCSS() {
        const cssPath = `${this.path}/style.css`;

        return new Promise((resolve, reject) => {
            const targetContainer = this.getTargetContainer();
            if (!targetContainer) {
                return reject(new Error(`Conteneur introuvable pour le CSS : ${this.path}`));
            }

            // S'assure que le shadowRoot existe (au cas où loadHTML mettrait une micro-seconde de plus)
            const shadowRoot = targetContainer.shadowRoot || targetContainer.attachShadow({ mode: 'open' });
            this.shadow = shadowRoot;

            if (shadowRoot.querySelector(`link[href="${cssPath}"]`)) {
                return resolve();
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`Impossible de charger le CSS : ${cssPath}`));

            shadowRoot.appendChild(link);
        });
    }

    async init() { }
}