import BaseComponent from '../BaseComponent.js';

export default class ZoomControls extends BaseComponent {

    static path = "components/zoom-controls"
    
    constructor(app, container) {
       super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const zoomResetBtn = document.getElementById('zoomResetBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn'); 
        const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');

        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => {
                this.app.resetZoom('light');
            });
        }

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.app.zoomIn();
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.app.zoomOut();
            });
        }
    }
}