import BaseComponent from '../../../BaseComponent.js';

export default class OpenUI extends BaseComponent {

    static path = "components/interactive-screen/modals/open-ui"
    
    constructor(app, container) {
       super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const importJSON = document.getElementById('importJSON');


        if (importJSON) {
            importJSON.addEventListener('click', () => {
                this.app.loadFileInput();
            });
        }


    }

    // Construit la liste des grilles sauvegardées dans #gridList.
    // - savedGrids : objet { nomDeGrille: { id, ... } } renvoyé par l'API
    // - currentGrid : { name, id } de la grille actuellement ouverte, pour
    //   la marquer et empêcher sa suppression
    // - callbacks.onSelect(name) / callbacks.onDelete(name, gridId)
    renderGridList(savedGrids, currentGrid, { onSelect, onDelete } = {}) {
        const gridList = document.getElementById("gridList");
        if (!gridList) return;

        gridList.innerHTML = "";

        const names = savedGrids ? Object.keys(savedGrids) : [];

        if (names.length === 0) {
            gridList.innerHTML = "<div class='modal-empty'>Aucune grille sauvegardée dans le cloud pour le moment.</div>";
            return;
        }

        names.forEach(name => {
            const gridInfo = savedGrids[name];
            const gridId = gridInfo.id || null;

            const isOpen = (name === currentGrid.name) || (gridId && currentGrid.id && gridId === currentGrid.id);

            const row = document.createElement("div");
            row.className = "grid-item-row";
            if (isOpen) {
                row.classList.add("current-grid");
            }

            const nameSpan = document.createElement("span");
            nameSpan.className = "grid-item-name";
            nameSpan.textContent = name;

            if (isOpen) {
                nameSpan.style.pointerEvents = "none";
                nameSpan.title = "Grille actuellement ouverte";

                const badge = document.createElement("span");
                badge.textContent = " (Ouverte)";
                badge.style.fontSize = "12px";
                badge.style.color = "#666";
                badge.style.fontStyle = "italic";
                nameSpan.appendChild(badge);
            } else {
                nameSpan.onclick = () => onSelect && onSelect(name);
            }

            const delBtn = document.createElement("button");
            delBtn.className = "grid-item-delete";
            delBtn.title = isOpen ? "Impossible de supprimer la grille ouverte" : "Supprimer";
            delBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:17px;">delete</span>`;

            if (isOpen) {
                delBtn.disabled = true;
                delBtn.style.cursor = "not-allowed";
                delBtn.style.pointerEvents = "none";
            } else {
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    onDelete && onDelete(name, gridId);
                };
            }

            row.appendChild(nameSpan);
            row.appendChild(delBtn);
            gridList.appendChild(row);
        });
    }

    destroy() {
        const targetContainer = typeof this.container === 'string'
            ? document.querySelector(this.container)
            : this.container;


        targetContainer.innerHTML = "htmlContent";
    }
}