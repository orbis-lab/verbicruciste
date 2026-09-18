import BaseComponent from '../BaseComponent.js';

export default class WordListSection extends BaseComponent {

    static path = "components/word-list-section"

    constructor(app, container) {
        super(app, container);
    }

    // Méthode privée ou secondaire pour les écouteurs
    init() {

        const wordCloseModalBtn = document.getElementById('wordCloseModalBtn');

        if (wordCloseModalBtn) {
            wordCloseModalBtn.addEventListener('click', () => {
                this.app.closeAllSectionModals();
            });
        }

    }

    updateDisplay() {

        const wordsListEl = document.getElementById("wordsList");
        const wordsCountEl = document.getElementById("wordsCount");

        if (!wordsListEl || !wordsCountEl) return;

        const foundWordsMap = new Map();

        this.app.state.grid.cells.forEach((cell, idx) => {
            if (cell.type === "definition") {
                const data = this.app.getWordData(idx, cell.arrow);
                if (data.indexes.length >= 2 && data.word && !data.word.includes("_")) foundWordsMap.set(data.indexes.join(","), { text: data.word, indexes: data.indexes });
            } else if (cell.type === "double") {
                const topDir = (cell.top && cell.top.arrow) || "E";
                const botDir = (cell.bottom && cell.bottom.arrow) || "S";
                const dataTop = this.app.getDoubleHalfWordData(idx, "top", topDir); if (dataTop.indexes.length >= 2 && dataTop.word && !dataTop.word.includes("_")) foundWordsMap.set(dataTop.indexes.join(","), { text: dataTop.word, indexes: dataTop.indexes });
                const dataBot = this.app.getDoubleHalfWordData(idx, "bottom", botDir); if (dataBot.indexes.length >= 2 && dataBot.word && !dataBot.word.includes("_")) foundWordsMap.set(dataBot.indexes.join(","), { text: dataBot.word, indexes: dataBot.indexes });
            }
        });

        const wordsArray = Array.from(foundWordsMap.values());
        const { duplicateWordStrings } = this.app.findDuplicateWords();

        wordsCountEl.textContent = `${wordsArray.length} mot${wordsArray.length > 1 ? 's' : ''} trouvé${wordsArray.length > 1 ? 's' : ''}`;
        wordsListEl.innerHTML = "";

        if (wordsArray.length === 0) {
            wordsListEl.innerHTML = "<div style='font-size:12px;color:#888;font-style:italic;'>Aucun mot dans la grille</div>";
            return;
        }

        const groupedByLength = {};
        wordsArray.forEach(item => { const len = item.text.length; if (!groupedByLength[len]) groupedByLength[len] = []; groupedByLength[len].push(item); });
        const sortedLengths = Object.keys(groupedByLength).map(Number).sort((a, b) => a - b);

        sortedLengths.forEach(len => {
            const groupDiv = document.createElement("div");
            groupDiv.className = "word-group";
            const titleDiv = document.createElement("div");
            titleDiv.className = "word-group-title";
            titleDiv.textContent = `${len} lettres :`;
            groupDiv.appendChild(titleDiv);

            groupedByLength[len].sort((a, b) => a.text.localeCompare(b.text, 'fr'));

            groupedByLength[len].forEach(item => {
                const wordEl = document.createElement("div");
                wordEl.className = "word-item";
                wordEl.textContent = item.text;
                if (duplicateWordStrings.has(item.text)) {
                    wordEl.classList.add("is-duplicate");
                    wordEl.title = "Mot présent plusieurs fois !";
                }
                wordEl.addEventListener("mouseenter", () => { this.app.state.navigation.hoveredWordIndexes = item.indexes; this.app.updateHighlights(); });
                wordEl.addEventListener("mouseleave", () => { this.app.state.navigation.hoveredWordIndexes = []; this.app.updateHighlights(); });
                wordEl.addEventListener("click", () => { if (item.indexes.length > 0) this.app.selectCellAndFocus(item.indexes[0]); });
                groupDiv.appendChild(wordEl);
            });
            wordsListEl.appendChild(groupDiv);
        });
    }

}