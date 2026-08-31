let COLS = 13;
let ROWS = 17;
let currentGridName = "Ma Grille";
let isCreatingNewGrid = false;

let cells = [];
let selected = null;
let activeWordTarget = null;
let hoveredWordIndexes = [];
let currentInputDir = "E";

const DIR_OFFSETS = {
  S: { r: 1, c: 0 },
  E: { r: 0, c: 1 }
};

function emptyCell() {
  return {
    type: "letter", letter: "", definition: "", arrow: "E",
    top: { definition: "", arrow: "E" },
    bottom: { definition: "", arrow: "S" }
  };
}

function init() {
  cells = Array.from({length: COLS * ROWS}, emptyCell);
  updateGridDisplay();
}

function selectCellSilently(index) {
  const grid = document.getElementById("grid");
  if (selected !== null && grid.children[selected]) grid.children[selected].classList.remove("selected");
  selected = index;
  if (grid.children[selected]) grid.children[selected].classList.add("selected");
  updateHighlights();
  updatePanel();
}

function selectCellAndFocus(index) {
  selectCellSilently(index);
  const grid = document.getElementById("grid");
  const el = grid.children[index];
  if (el) {
    const input = el.querySelector("input");
    if (input) { input.focus(); input.select(); }
  }
}

function findDuplicateWords() {
  const wordCounts = new Map();
  const duplicateIndexes = new Set();
  const duplicateWordStrings = new Set();

  cells.forEach((cell, idx) => {
    const processWord = (dir) => {
      const data = getWordData(idx, dir);
      if (data.indexes.length >= 2 && data.word && !data.word.includes("_")) {
        if (!wordCounts.has(data.word)) wordCounts.set(data.word, []);
        wordCounts.get(data.word).push(data.indexes);
      }
    };
    if (cell.type === "definition") processWord(cell.arrow);
    else if (cell.type === "double") { processWord("E"); processWord("S"); }
  });

  wordCounts.forEach((occurrences, word) => {
    if (occurrences.length > 1) {
      duplicateWordStrings.add(word);
      occurrences.forEach(indexes => { indexes.forEach(i => duplicateIndexes.add(i)); });
    }
  });

  return { duplicateIndexes: Array.from(duplicateIndexes), duplicateWordStrings };
}

function updateHighlights() {
  const grid = document.getElementById("grid");
  const highlightedIndexes = getHighlightedCells();
  const combined = Array.from(new Set([...highlightedIndexes, ...hoveredWordIndexes]));
  const { duplicateIndexes } = findDuplicateWords();

  Array.from(grid.children).forEach((el, idx) => {
    el.classList.toggle("word-highlighted", combined.includes(idx));
    el.classList.toggle("word-duplicate", duplicateIndexes.includes(idx));
  });
}

function updateGridDisplay() {
  document.getElementById('gridNameDisplay').textContent = currentGridName;
  document.getElementById('printTitle').textContent = currentGridName;
  document.getElementById('gridDimensionsDisplay').textContent = `Grille de ${COLS} colonnes × ${ROWS} lignes`;
  
  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = `repeat(${COLS}, var(--cell))`;
  grid.style.gridTemplateRows = `repeat(${ROWS}, var(--cell))`;
  
  render();
}

function render() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const highlightedIndexes = getHighlightedCells();
  const { duplicateIndexes } = findDuplicateWords();

  cells.forEach((cell, index) => {
    const el = document.createElement("div");
    el.className = "cell " + cell.type + "-cell";
    
    // Gestion dynamique des bordures
    if ((index + 1) % COLS === 0) el.style.borderRight = "0";
    if (index >= COLS * (ROWS - 1)) el.style.borderBottom = "0";

    if (index === selected) el.classList.add("selected");
    if (highlightedIndexes.includes(index) || hoveredWordIndexes.includes(index)) el.classList.add("word-highlighted");
    if (duplicateIndexes.includes(index)) el.classList.add("word-duplicate");

    if (cell.type === "letter") {
      const input = document.createElement("input");
      input.maxLength = 1; input.value = cell.letter; input.setAttribute("autocomplete", "off");
      input.addEventListener("focus", () => selectCellSilently(index));
      input.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") { currentInputDir = "S"; moveToNextLetter(1); return; }
        else if (e.key === "ArrowRight") { currentInputDir = "E"; moveToNextLetter(1); return; }
        else if (e.key === "ArrowUp") { currentInputDir = "S"; moveToNextLetter(-1); return; }
        else if (e.key === "ArrowLeft") { currentInputDir = "E"; moveToNextLetter(-1); return; }

        if (e.key === "Backspace") {
          e.preventDefault(); cell.letter = ""; input.value = "";
          updatePanel(); updatePlacedWordsList(); moveToNextLetter(-1);
        } else if (e.key.length === 1 && /[a-zA-ZÀ-ÿ]/.test(e.key)) {
          e.preventDefault(); const char = e.key.toUpperCase(); cell.letter = char; input.value = char;
          updatePanel(); updatePlacedWordsList(); moveToNextLetter(1);
        }
      });
      el.appendChild(input);
    }

    if (cell.type === "definition") {
      const editable = document.createElement("div");
      editable.className = "def-content"; editable.contentEditable = "true"; editable.innerText = cell.definition;
      editable.addEventListener("focus", () => { currentInputDir = cell.arrow; selectCellSilently(index); });
      editable.addEventListener("input", e => { cell.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("definitionInput"); if (sideInput) sideInput.value = cell.definition; });
      el.appendChild(editable);
      const svg = createArrowSVG(cell.arrow, "full");
      if (svg) el.appendChild(svg);
    }

    if (cell.type === "double") {
      el.innerHTML = `<div class="half"><div class="def-editable" contenteditable="true"></div></div><div class="half"><div class="def-editable" contenteditable="true"></div></div>`;
      const halves = el.querySelectorAll(".half"); const editables = el.querySelectorAll(".def-editable");
      editables[0].innerText = cell.top.definition; editables[1].innerText = cell.bottom.definition;

      editables[0].addEventListener("focus", () => { currentInputDir = "E"; selectCellSilently(index); const sideInput = document.getElementById("topDefinitionInput"); if (sideInput) sideInput.value = cell.top.definition; });
      editables[1].addEventListener("focus", () => { currentInputDir = "S"; selectCellSilently(index); const sideInput = document.getElementById("bottomDefinitionInput"); if (sideInput) sideInput.value = cell.bottom.definition; });

      editables[0].addEventListener("input", e => { cell.top.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("topDefinitionInput"); if (sideInput) sideInput.value = cell.top.definition; });
      editables[1].addEventListener("input", e => { cell.bottom.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("bottomDefinitionInput"); if (sideInput) sideInput.value = cell.bottom.definition; });

      const svgTop = createArrowSVG("E", "top"); if (svgTop) halves[0].appendChild(svgTop);
      const svgBottom = createArrowSVG("S", "bottom"); if (svgBottom) halves[1].appendChild(svgBottom);
    }

    el.dataset.index = index;
    el.addEventListener("click", () => { if (cell.type !== "double" && cell.type !== "definition" && cell.type !== "letter") selectCell(index); });
    grid.appendChild(el);
  });

  updatePanel(); updatePlacedWordsList();
}

function moveToNextLetter(step) {
  if (selected === null || !activeWordTarget || activeWordTarget.indexes.length === 0) return;
  const currentIndex = activeWordTarget.indexes.indexOf(selected);
  if (currentIndex !== -1) {
    const nextPos = currentIndex + step;
    if (nextPos >= 0 && nextPos < activeWordTarget.indexes.length) selectCellAndFocus(activeWordTarget.indexes[nextPos]);
  }
}

function createArrowSVG(dir, zone) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "arrow-svg");
  let startX = 0, startY = 0, endX = 0, endY = 0, customStyle = "";
  if (zone === "full") {
    if (dir === "S") { startX = 27; startY = 54; endX = 27; endY = 64; }
    else if (dir === "E") { startX = 54; startY = 27; endX = 64; endY = 27; }
  } else if (zone === "top") { startX = 0; startY = 0; endX = 10; endY = 0; customStyle = "left: 48px;"; }
  else if (zone === "bottom") { startX = 0; startY = 0; endX = 0; endY = 10; customStyle = "top: 22px;"; }

  const minX = Math.min(startX, endX) - 5; const minY = Math.min(startY, endY) - 5;
  const maxX = Math.max(startX, endX) + 5; const maxY = Math.max(startY, endY) + 5;

  if (customStyle) svg.setAttribute("style", `${customStyle} width:${maxX - minX}px; height:${maxY - minY}px; overflow:visible;`);
  else svg.setAttribute("style", `left:${minX}px; top:${minY}px; width:${maxX - minX}px; height:${maxY - minY}px; overflow:visible;`);
  svg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  const markerId = `arrowhead-${Math.random().toString(36).substr(2, 9)}`;
  marker.setAttribute("id", markerId); marker.setAttribute("markerWidth", "6"); marker.setAttribute("markerHeight", "6");
  marker.setAttribute("refX", "5"); marker.setAttribute("refY", "3"); marker.setAttribute("orient", "auto");

  const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon.setAttribute("points", "0 0, 6 3, 0 6"); polygon.setAttribute("fill", "#222");
  marker.appendChild(polygon); defs.appendChild(marker); svg.appendChild(defs);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", startX); line.setAttribute("y1", startY); line.setAttribute("x2", endX); line.setAttribute("y2", endY);
  line.setAttribute("stroke", "#222"); line.setAttribute("stroke-width", "2"); line.setAttribute("marker-end", `url(#${markerId})`);
  svg.appendChild(line);
  return svg;
}

function getWordData(fromIndex, dir) {
  if (fromIndex === null || fromIndex < 0) return { word: "", indexes: [] };
  const offset = DIR_OFFSETS[dir];
  if (!offset) return { word: "", indexes: [] };

  const startRow = Math.floor(fromIndex / COLS);
  const startCol = fromIndex % COLS;
  let r = startRow + offset.r; let c = startCol + offset.c;
  let word = ""; let indexes = [];

  while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
    const idx = r * COLS + c;
    if (cells[idx].type !== "letter") break;
    const char = cells[idx].letter ? cells[idx].letter.toUpperCase() : "_";
    word += char; indexes.push(idx); r += offset.r; c += offset.c;
  }
  return { word, indexes };
}

function findParentWordForLetter(letterIdx, preferredDir = currentInputDir) {
  const row = Math.floor(letterIdx / COLS);
  const col = letterIdx % COLS;

  function checkDir(dir) {
    if (dir === "E") {
      let c = col - 1; while (c >= 0 && cells[row * COLS + c].type === "letter") c--;
      if (c >= 0) {
        const defIdx = row * COLS + c; const defCell = cells[defIdx];
        if (defCell.type === "definition" && defCell.arrow === "E") return { dir: "E", data: getWordData(defIdx, "E") };
        if (defCell.type === "double") return { dir: "E", data: getWordData(defIdx, "E") };
      }
    } else if (dir === "S") {
      let r = row - 1; while (r >= 0 && cells[r * COLS + col].type === "letter") r--;
      if (r >= 0) {
        const defIdx = r * COLS + col; const defCell = cells[defIdx];
        if (defCell.type === "definition" && defCell.arrow === "S") return { dir: "S", data: getWordData(defIdx, "S") };
        if (defCell.type === "double") return { dir: "S", data: getWordData(defIdx, "S") };
      }
    }
    return null;
  }

  let result = checkDir(preferredDir);
  if (result && result.data.indexes.length > 0) return result;
  return checkDir(preferredDir === "E" ? "S" : "E");
}

function getHighlightedCells() {
  if (selected === null) { activeWordTarget = null; return []; }
  const cell = cells[selected];

  if (cell.type === "definition") {
    currentInputDir = cell.arrow;
    const data = getWordData(selected, cell.arrow);
    activeWordTarget = { direction: cell.arrow, indexes: data.indexes };
    return data.indexes;
  }
  
  if (cell.type === "double") {
    const topIdx = getWordData(selected, "E").indexes; const botIdx = getWordData(selected, "S").indexes;
    const all = Array.from(new Set([...topIdx, ...botIdx]));
    activeWordTarget = { direction: currentInputDir, indexes: currentInputDir === "S" ? botIdx : topIdx };
    return all;
  }

  if (cell.type === "letter") {
    const parent = findParentWordForLetter(selected, currentInputDir);
    if (parent && parent.data.indexes.length > 0) {
      currentInputDir = parent.dir; activeWordTarget = { direction: parent.dir, indexes: parent.data.indexes };
      return parent.data.indexes;
    }
  }

  activeWordTarget = null;
  return [];
}

function updatePlacedWordsList() {
  const wordsListEl = document.getElementById("wordsList");
  const wordsCountEl = document.getElementById("wordsCount");
  if (!wordsListEl || !wordsCountEl) return;

  const foundWordsMap = new Map();
  cells.forEach((cell, idx) => {
    if (cell.type === "definition") {
      const data = getWordData(idx, cell.arrow);
      if (data.indexes.length >= 2 && data.word && !data.word.includes("_")) foundWordsMap.set(data.indexes.join(","), { text: data.word, indexes: data.indexes });
    } else if (cell.type === "double") {
      const dataTop = getWordData(idx, "E"); if (dataTop.indexes.length >= 2 && dataTop.word && !dataTop.word.includes("_")) foundWordsMap.set(dataTop.indexes.join(","), { text: dataTop.word, indexes: dataTop.indexes });
      const dataBot = getWordData(idx, "S"); if (dataBot.indexes.length >= 2 && dataBot.word && !dataBot.word.includes("_")) foundWordsMap.set(dataBot.indexes.join(","), { text: dataBot.word, indexes: dataBot.indexes });
    }
  });

  const wordsArray = Array.from(foundWordsMap.values());
  const { duplicateWordStrings } = findDuplicateWords();

  wordsCountEl.textContent = `${wordsArray.length} mot${wordsArray.length > 1 ? 's' : ''} trouvé${wordsArray.length > 1 ? 's' : ''}`;
  wordsListEl.innerHTML = "";

  if (wordsArray.length === 0) { wordsListEl.innerHTML = "<div style='font-size:12px;color:#888;font-style:italic;'>Aucun mot dans la grille</div>"; return; }

  const groupedByLength = {};
  wordsArray.forEach(item => { const len = item.text.length; if (!groupedByLength[len]) groupedByLength[len] = []; groupedByLength[len].push(item); });
  const sortedLengths = Object.keys(groupedByLength).map(Number).sort((a, b) => a - b);

  sortedLengths.forEach(len => {
    const groupDiv = document.createElement("div"); groupDiv.className = "word-group";
    const titleDiv = document.createElement("div"); titleDiv.className = "word-group-title"; titleDiv.textContent = `${len} lettres :`; groupDiv.appendChild(titleDiv);
    groupedByLength[len].sort((a, b) => a.text.localeCompare(b.text, 'fr'));

    groupedByLength[len].forEach(item => {
      const wordEl = document.createElement("div"); wordEl.className = "word-item"; wordEl.textContent = item.text;
      if (duplicateWordStrings.has(item.text)) { wordEl.classList.add("is-duplicate"); wordEl.title = "Mot présent plusieurs fois !"; }
      wordEl.addEventListener("mouseenter", () => { hoveredWordIndexes = item.indexes; updateHighlights(); });
      wordEl.addEventListener("mouseleave", () => { hoveredWordIndexes = []; updateHighlights(); });
      wordEl.addEventListener("click", () => { if (item.indexes.length > 0) selectCellAndFocus(item.indexes[0]); });
      groupDiv.appendChild(wordEl);
    });
    wordsListEl.appendChild(groupDiv);
  });
}

function selectCell(index) { selected = Number(index); render(); }

function setType(type) {
  if (selected === null || selected === undefined || Number.isNaN(Number(selected))) { alert("Sélectionnez d'abord une case."); return; }
  selected = Number(selected);
  cells[selected].type = type;
  if (type === "double") { cells[selected].top.arrow = "E"; cells[selected].bottom.arrow = "S"; }
  render();
  if (type === "definition") focusDefinitionCell(selected);
  else if (type === "double") focusDoubleDefinitionCell(selected);
  else if (type === "letter") selectCellAndFocus(selected);
}

function focusDefinitionCell(index) {
  setTimeout(() => {
    const grid = document.getElementById("grid"); const cellEl = grid.children[index];
    if (cellEl) {
      const defEditable = cellEl.querySelector(".def-content");
      if (defEditable) {
        defEditable.focus(); const range = document.createRange(); const sel = window.getSelection();
        range.selectNodeContents(defEditable); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
      }
    }
  }, 10);
}

function focusDoubleDefinitionCell(index) { setTimeout(() => { const grid = document.getElementById("grid"); const cellEl = grid.children[index]; if (cellEl) { const firstEditable = cellEl.querySelector(".def-editable"); if (firstEditable) firstEditable.focus(); } }, 10); }

function updatePanel() {
  document.querySelectorAll(".type-buttons button").forEach(btn => { btn.classList.toggle("active", selected !== null && btn.dataset.type === cells[selected].type); });
  const info = document.getElementById("selectedInfo");
  const single = document.getElementById("singleDefControls");
  const dbl = document.getElementById("doubleDefControls");
  const wordContainer = document.getElementById("wordFormedContainer");

  if (selected === null) { info.textContent = "Cliquez sur une case de la grille."; single.style.display = "none"; dbl.style.display = "none"; wordContainer.innerHTML = ""; return; }

  const row = Math.floor(selected / COLS) + 1; const col = selected % COLS + 1;
  info.textContent = `Case : colonne ${col}, ligne ${row}`;
  const cell = cells[selected];
  single.style.display = cell.type === "definition" ? "block" : "none";
  dbl.style.display = cell.type === "double" ? "block" : "none";
  wordContainer.innerHTML = "";

  if (cell.type === "definition") {
    document.getElementById("definitionInput").value = cell.definition;
    document.getElementById("btnArrowE").classList.toggle("active", cell.arrow === "E");
    document.getElementById("btnArrowS").classList.toggle("active", cell.arrow === "S");
    const data = getWordData(selected, cell.arrow); renderWordBox(wordContainer, "Mot formé", data.word, data.indexes, "word-def", cell.arrow);
  }

  if (cell.type === "double") {
    document.getElementById("topDefinitionInput").value = cell.top.definition;
    document.getElementById("bottomDefinitionInput").value = cell.bottom.definition;
    const dataTop = getWordData(selected, "E"); const dataBot = getWordData(selected, "S");
    renderWordBox(wordContainer, "Mot du haut", dataTop.word, dataTop.indexes, "word-top", "E");
    renderWordBox(wordContainer, "Mot du bas", dataBot.word, dataBot.indexes, "word-bot", "S");
  }

  if (cell.type === "letter") {
    const parent = findParentWordForLetter(selected, currentInputDir);
    if (parent) renderWordBox(wordContainer, "Mot associé", parent.data.word, parent.data.indexes, "word-letter", parent.dir);
  }
}

function renderWordBox(container, labelText, word, indexes, idPrefix, dir) {
  if (!indexes || indexes.length === 0) return;
  const box = document.createElement("div"); box.className = "word-box";
  const titleDiv = document.createElement("div"); titleDiv.className = "word-title";
  const labelSpan = document.createElement("span"); labelSpan.textContent = `${labelText} (${word.length} lettres)`; titleDiv.appendChild(labelSpan);
  if (dir) { const iconSpan = document.createElement("span"); iconSpan.className = "material-symbols-outlined"; iconSpan.style.fontSize = "16px"; iconSpan.textContent = dir === "E" ? "arrow_right_alt" : "south"; titleDiv.appendChild(iconSpan); }

  if (labelText === "Mot formé" || labelText === "Mot associé") {
    const badge = document.createElement("span");
    badge.className = "unstable-api-badge";
    badge.title = "Fonctionnalités en cours de fiabilisation : les appels API de cet encart (correction, suggestions, définition, synonymes) peuvent être instables.";
    badge.innerHTML = `<span class="material-symbols-outlined">construction</span>`;
    titleDiv.appendChild(badge);
  }

  box.appendChild(titleDiv);

  const displayDiv = document.createElement("div"); displayDiv.className = "word-display"; displayDiv.textContent = word; box.appendChild(displayDiv);

  // --- BOUTON 1 : CORRECTION ORTHOGRAPHIQUE ---
  const correctBtn = document.createElement("button"); 
  correctBtn.className = "word-action-btn"; 
  correctBtn.innerHTML = `<span class="material-symbols-outlined">spellcheck</span> Corriger l'orthographe`; 
  correctBtn.onclick = () => fetchSpellCorrection(word, indexes, `${idPrefix}-correct`); 
  box.appendChild(correctBtn);
  
  const correctList = document.createElement("div"); 
  correctList.id = `${idPrefix}-correct`; 
  correctList.className = "suggestions-list"; 
  box.appendChild(correctList);

  // --- BOUTON 2 : SUGGESTION PAR MOTIF (Mêmes lettres / même position) ---
  const sugBtn = document.createElement("button"); 
  sugBtn.className = "word-action-btn"; 
  sugBtn.innerHTML = `<span class="material-symbols-outlined">list_alt</span> Suggérer (Même motif)`; 
  sugBtn.onclick = () => fetchPatternSuggestions(word, indexes, `${idPrefix}-sug`); 
  box.appendChild(sugBtn);
  
  const sugList = document.createElement("div"); 
  sugList.id = `${idPrefix}-sug`; 
  sugList.className = "suggestions-list"; 
  box.appendChild(sugList);

  // --- BOUTON DÉFINITION WIKTIONNAIRE ---
  const defBtn = document.createElement("button"); 
  defBtn.className = "word-action-btn"; 
  defBtn.innerHTML = `<span class="material-symbols-outlined">menu_book</span> Définition (Wiktionnaire)`; 
  defBtn.onclick = () => fetchWordDefinition(word, `${idPrefix}-def`); 
  box.appendChild(defBtn);
  
  const defBox = document.createElement("div"); 
  defBox.id = `${idPrefix}-def`; 
  defBox.className = "dict-def-box"; 
  defBox.style.display = "none"; 
  box.appendChild(defBox);

  // --- BOUTON : SYNONYMES ---
  const synBtn = document.createElement("button"); 
  synBtn.className = "word-action-btn"; 
  synBtn.innerHTML = `<span class="material-symbols-outlined">sync_alt</span> Synonymes`; 
  synBtn.onclick = () => fetchSynonyms(word, `${idPrefix}-syn`); 
  box.appendChild(synBtn);
  
  const synBox = document.createElement("div"); 
  synBox.id = `${idPrefix}-syn`; 
  synBox.className = "dict-def-box"; 
  synBox.style.display = "none"; 
  box.appendChild(synBox);

  container.appendChild(box);
}

// A. CORRECTION ORTHOGRAPHIQUE : Propose le mot le plus probable (gestion des fautes de frappe)
async function fetchSpellCorrection(word, indexes, resultContainerId) {
  const container = document.getElementById(resultContainerId); 
  if (!container) return;
  container.innerHTML = "<span style='font-size:11px;color:#666'>Recherche de correction...</span>";
  
  const cleanWord = word.replace(/_/g, "").trim().toLowerCase();
  if (cleanWord.length < 2) {
    container.innerHTML = "<span style='font-size:11px;color:#888'>Mot trop court pour être corrigé.</span>";
    return;
  }

  try {
    // On augmente la limite à 20 pour s'assurer d'avoir assez de candidats après filtrage
    const searchUrl = `https://fr.wiktionary.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanWord)}&limit=20&format=json&origin=*`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
    const data = await res.json();
    const suggestions = data[1] || [];

    container.innerHTML = "";
    
    // Filtrer pour garder uniquement les mots alphabétiques valides de la même longueur
    const validCorrections = suggestions.filter(w => /^[a-zA-Zà-ÿÀ-Ÿ-]+$/.test(w) && w.length === indexes.length);

    if (validCorrections.length === 0) {
      container.innerHTML = "<span style='font-size:11px;color:#888'>Aucune correction évidente trouvée.</span>";
      return;
    }

    // On limite l'affichage aux 5 premiers résultats pertinents
    validCorrections.slice(0, 5).forEach(item => {
      const tag = document.createElement("span");
      tag.className = "suggestion-tag";
      const wUpper = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      tag.textContent = wUpper;
      tag.onclick = () => fillWordInGrid(wUpper, indexes);
      container.appendChild(tag);
    });
  } catch (e) {
    console.error(e);
    container.innerHTML = "<span style='font-size:11px;color:#d32f2f'>Erreur de correction.</span>";
  }
}

async function fetchSynonyms(word, resultContainerId) {
  const container = document.getElementById(resultContainerId); 
  if (!container) return;
  container.innerHTML = "<span style='font-size:11px;color:#666'>Recherche de synonymes...</span>";
  
  const cleanWord = word.trim().toLowerCase();
  if (cleanWord.length < 2) {
    container.innerHTML = "<span style='font-size:11px;color:#888'>Mot trop court.</span>";
    return;
  }

  try {
    // On interroge directement l'API parse pour obtenir le HTML ou le texte structuré de la page du mot
    const apiUrl = `https://fr.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(cleanWord)}&prop=text&format=json&origin=*`;
    
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);

    const data = await res.json();
    const htmlContent = data?.parse?.text?.["*"];

    container.innerHTML = "";

    if (!htmlContent) {
      container.innerHTML = "<span style='font-size:11px;color:#888'>Aucun synonyme trouvé (mot absent du dictionnaire).</span>";
      return;
    }

    // Création d'un DOM virtuel pour analyser le HTML de la page du Wiktionnaire
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    let synonymsList = [];

    // Sur le Wiktionnaire, les synonymes sont généralement dans une section 
    // ou une liste liée à la classe "synonyms" ou après un titre "Synonymes"
    // Approche robuste : chercher les éléments de listes situés après un titre ou dans un bloc de synonymes
    const synonymHeadings = Array.from(doc.querySelectorAll('h3, h4, h5')).filter(h => 
      h.textContent.toLowerCase().includes('synonyme')
    );

    synonymHeadings.forEach(heading => {
      // Récupérer le prochain élément (souvent une liste <ul>)
      let nextElement = heading.nextElementSibling;
      while (nextElement && nextElement.tagName !== 'UL' && !['H3', 'H4', 'H5'].includes(nextElement.tagName)) {
        nextElement = nextElement.nextElementSibling;
      }
      if (nextElement && nextElement.tagName === 'UL') {
        const links = nextElement.querySelectorAll('a');
        links.forEach(a => {
          const text = a.textContent.trim();
          if (text && /^[a-zA-Zà-ÿÀ-Ÿ-]+$/.test(text) && !synonymsList.includes(text)) {
            synonymsList.push(text);
          }
        });
      }
    });

    // Si la structure spécifique par titre n'a rien donné, on cherche les liens par classe CSS standard du wikitexte converti
    if (synonymsList.length === 0) {
      const synBlocks = doc.querySelectorAll('.synonyms, .lexical-unit-synonyms');
      synBlocks.forEach(block => {
        block.querySelectorAll('a').forEach(a => {
          const text = a.textContent.trim();
          if (text && /^[a-zA-Zà-ÿÀ-Ÿ-]+$/.test(text) && !synonymsList.includes(text)) {
            synonymsList.push(text);
          }
        });
      });
    }

    if (synonymsList.length === 0) {
      container.innerHTML = "<span style='font-size:11px;color:#888'>Aucun synonyme répertorié pour ce mot.</span>";
      return;
    }

    // Affichage des 5 premiers synonymes valides sous forme de tags cliquables
    synonymsList.slice(0, 5).forEach(item => {
      const tag = document.createElement("span");
      tag.className = "suggestion-tag";
      const wUpper = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      tag.textContent = wUpper;
      tag.onclick = () => {
        console.log("Synonyme sélectionné :", wUpper);
        // fillWordInGrid(wUpper);
      };
      
      container.appendChild(tag);
    });

  } catch (e) {
    console.error(e);
    container.innerHTML = "<span style='font-size:11px;color:#d32f2f'>Erreur lors de la recherche des synonymes.</span>";
  }
}

// B. SUGGESTION PAR MOTIF : Respecte strictemebt les lettres aux mêmes positions et la longueur
async function fetchPatternSuggestions(word, indexes, resultContainerId) {
  const container = document.getElementById(resultContainerId); 
  if (!container) return;
  container.innerHTML = "<span style='font-size:11px;color:#666'>Recherche des mots correspondants...</span>";
  
  const cleanWord = word.trim().toLowerCase();

  try {
    const regexPattern = "^" + cleanWord.replace(/[_?]/g, ".") + "$";
    // Augmentation de la limite à 50 pour avoir un plus large bassin avant le filtre strict
    const searchUrl = `https://fr.wiktionary.org/w/api.php?action=query&list=search&srsearch=intitle:/${encodeURIComponent(regexPattern)}/&srnamespace=0&srlimit=50&format=json&origin=*`;
    
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
    const data = await res.json();
    
    const searchResults = data?.query?.search || [];
    const suggestions = searchResults.map(item => item.title);

    container.innerHTML = "";

    const validSuggestions = suggestions.filter(w => {
      const isPureWord = /^[a-zA-Zà-ÿÀ-Ÿ-]+$/.test(w);
      const isCorrectLength = w.length === cleanWord.length;
      return isPureWord && isCorrectLength;
    });

    if (validSuggestions.length === 0) {
      container.innerHTML = "<span style='font-size:11px;color:#888'>Aucun mot ne correspond exactement à ce motif.</span>";
      return;
    }

    // On limite l'affichage aux 5 premiers résultats
    validSuggestions.slice(0, 5).forEach(item => {
      const tag = document.createElement("span");
      tag.className = "suggestion-tag";
      const wUpper = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      tag.textContent = wUpper;
      tag.onclick = () => fillWordInGrid(wUpper, indexes);
      container.appendChild(tag);
    });

  } catch (e) {
    console.error(e);
    container.innerHTML = "<span style='font-size:11px;color:#d32f2f'>Erreur lors de la recherche par motif.</span>";
  }
}
async function fetchWordDefinition(word, resultContainerId) {
  const container = document.getElementById(resultContainerId); 
  if (!container) return; 
  container.style.display = "block";
  
  if (word.includes("_")) { 
    container.innerHTML = "<span style='color:#888;'>Veuillez compléter toutes les lettres.</span>"; 
    return; 
  }
  
  container.innerHTML = "<span style='color:#666;'>Recherche sur le Wiktionnaire...</span>";
  const cleanWord = word.trim().toLowerCase();

  try {
    // Utilisation de l'API 'parse' pour récupérer le rendu HTML de la page
    const apiUrl = `https://fr.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(cleanWord)}&prop=text&format=json&origin=*`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
    
    const data = await res.json();
    const htmlContent = data?.parse?.text?.["*"];

    if (!htmlContent) {
      container.innerHTML = "<span style='color:#888;'>Mot introuvable dans le Wiktionnaire.</span>";
      return;
    }

    // Analyse du HTML reçu via un DOMParser temporaire
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Le Wiktionnaire place généralement les définitions dans des listes à puces (<li>) après les titres de section de langue française
    const items = doc.querySelectorAll('.mw-parser-output > ol > li, .mw-parser-output > p + ol > li, .mw-parser-output dl dd');
    
    let definitions = [];
    items.forEach(li => {
      // Nettoyage du texte (suppression des liens internes superflus, prononciations, etc.)
      const text = li.textContent.trim();
      if (text && text.length > 3 && !definitions.includes(text)) {
        definitions.push(text);
      }
    });

    if (definitions.length > 0) {
      let html = `<strong>${word.toUpperCase()}</strong> (Wiktionnaire) :<ul style="margin:4px 0 0 14px; padding:0;">`;
      definitions.slice(0, 3).forEach(d => { 
        // Tronquer si la définition est trop longue pour l'interface
        const cleanDef = d.length > 120 ? d.substring(0, 120) + '...' : d;
        html += `<li>${cleanDef}</li>`; 
      }); 
      html += `</ul>`; 
      container.innerHTML = html;
    } else {
      container.innerHTML = "<span style='color:#888;'>Définition non disponible pour ce mot.</span>";
    }
  } catch (e) { 
    console.error(e); 
    container.innerHTML = "<span style='color:#888;'>Impossible d'accéder au Wiktionnaire.</span>"; 
  }
}
function fillWordInGrid(word, indexes) { for (let i = 0; i < indexes.length; i++) { if (i < word.length) cells[indexes[i]].letter = word[i]; } render(); }

function updateDefinition(value) { if (selected !== null) { cells[selected].definition = value.toUpperCase(); const grid = document.getElementById("grid"); if (grid.children[selected]) { const def = grid.children[selected].querySelector(".def-content"); if (def && def !== document.activeElement) def.innerText = cells[selected].definition; } } }
function setArrow(direction) { if (selected !== null && cells[selected].type === "definition") { cells[selected].arrow = direction; currentInputDir = direction; render(); } }
function updateHalfDefinition(which, value) { if (selected !== null && cells[selected].type === "double") { cells[selected][which].definition = value.toUpperCase(); const grid = document.getElementById("grid"); if (grid.children[selected]) { const editables = grid.children[selected].querySelectorAll(".def-editable"); const idx = which === "top" ? 0 : 1; if (editables[idx] && editables[idx] !== document.activeElement) editables[idx].innerText = cells[selected][which].definition; } } }

function clearCell() { if (selected === null) return; cells[selected] = emptyCell(); render(); }
function clearGrid() { if (confirm("Vider toute la grille ?")) { cells = Array.from({length: COLS * ROWS}, emptyCell); selected = null; render(); } }

function newGrid() { openSettingsModal(true); }

function openSettingsModal(isNew = false) {
  isCreatingNewGrid = isNew;
  document.getElementById('settingsModalTitle').textContent = isNew ? "Nouvelle grille" : "Paramètres de la grille";
  document.getElementById('settingName').value = isNew ? "Nouvelle Grille" : currentGridName;
  document.getElementById('settingCols').value = COLS;
  document.getElementById('settingRows').value = ROWS;
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() { document.getElementById("settingsModal").classList.remove("active"); }
function closeSettingsModalOnOverlay(event) { if (event.target.id === "settingsModal") closeSettingsModal(); }

function applySettings() {
  const newName = document.getElementById('settingName').value.trim() || "Grille Sans Nom";
  const newCols = parseInt(document.getElementById('settingCols').value, 10) || 13;
  const newRows = parseInt(document.getElementById('settingRows').value, 10) || 17;

  if (isCreatingNewGrid) {
    currentGridName = newName; COLS = newCols; ROWS = newRows;
    cells = Array.from({length: COLS * ROWS}, emptyCell);
    selected = null;
  } else {
    // Si le nom a changé, mettre à jour l'entrée existante dans localStorage si elle y figurait
    const savedGrids = getSavedGrids();
    if (newName !== currentGridName) {
      if (savedGrids[currentGridName]) {
        savedGrids[newName] = savedGrids[currentGridName];
        delete savedGrids[currentGridName];
      }
      currentGridName = newName;
    }

    if (newCols !== COLS || newRows !== ROWS) {
      const newCells = Array.from({length: newCols * newRows}, emptyCell);
      for (let r = 0; r < Math.min(ROWS, newRows); r++) {
        for (let c = 0; c < Math.min(COLS, newCols); c++) {
          newCells[r * newCols + c] = cells[r * COLS + c];
        }
      }
      cells = newCells; COLS = newCols; ROWS = newRows; selected = null;
    }
    
    // Sauvegarder automatiquement les changements mis à jour
    if (savedGrids[currentGridName] || Object.keys(savedGrids).length > 0) {
      savedGrids[currentGridName] = { version: 2, cols: COLS, rows: ROWS, cells: cells };
      localStorage.setItem("motsFlechesGrids", JSON.stringify(savedGrids));
    }
  }
  updateGridDisplay();
  closeSettingsModal();
}

function getSavedGrids() { const data = localStorage.getItem("motsFlechesGrids"); return data ? JSON.parse(data) : {}; }

let isSaveAsMode = false;

function openSaveModal(isSaveAs) {
  isSaveAsMode = isSaveAs;
  document.getElementById("saveModalTitle").textContent = isSaveAs ? "Enregistrer la grille sous..." : "Enregistrer la grille";
  document.getElementById("saveAsNameGroup").style.display = isSaveAs ? "block" : "none";
  if (isSaveAs) document.getElementById("saveAsNameInput").value = currentGridName + " (Copie)";
  document.getElementById("saveModal").classList.add("active");
}

function closeSaveModal() {
  document.getElementById("saveModal").classList.remove("active");
}

function closeSaveModalOnOverlay(event) {
  if (event.target.id === "saveModal") closeSaveModal();
}

function confirmSave(destination) {
  let targetName = currentGridName;

  if (isSaveAsMode) {
    const newName = document.getElementById("saveAsNameInput").value.trim();
    if (!newName) {
      alert("Veuillez entrer un nom valide.");
      return;
    }
    targetName = newName;
  }

  currentGridName = targetName;

  if (destination === "browser") {
    const savedGrids = getSavedGrids();
    savedGrids[currentGridName] = { version: 2, cols: COLS, rows: ROWS, cells: cells };
    localStorage.setItem("motsFlechesGrids", JSON.stringify(savedGrids));
    updateGridDisplay();
    closeSaveModal();
    alert(`Grille "${currentGridName}" enregistrée dans le navigateur.`);
  } else if (destination === "file") {
    const exportData = { version: 2, name: currentGridName, cols: COLS, rows: ROWS, cells: cells };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${currentGridName.replace(/\s+/g, "_")}.json`;
    a.click();
    updateGridDisplay();
    closeSaveModal();
  }
}

function openLoadModal() {
  const modal = document.getElementById("loadModal"); const body = document.getElementById("modalBody");
  const savedGrids = getSavedGrids(); const names = Object.keys(savedGrids);

  let htmlStr = `
    <div class="import-json-btn" onclick="document.getElementById('fileInput').click(); closeLoadModal();">
      <span class="material-symbols-outlined">file_upload</span> Importer une grille depuis un fichier JSON
    </div>
    <div class="modal-separator"></div>
  `;

  if (names.length === 0) {
    htmlStr += "<div class='modal-empty'>Aucune grille sauvegardée pour le moment.</div>";
    body.innerHTML = htmlStr;
  } else {
    body.innerHTML = htmlStr;
    names.forEach(name => {
      const row = document.createElement("div"); row.className = "grid-item-row";
      const nameSpan = document.createElement("span"); nameSpan.className = "grid-item-name"; nameSpan.textContent = name; nameSpan.onclick = () => loadSelectedGrid(name);
      const delBtn = document.createElement("button"); delBtn.className = "grid-item-delete"; delBtn.title = "Supprimer"; delBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">delete</span>`;
      delBtn.onclick = (e) => { e.stopPropagation(); deleteSavedGrid(name); };
      row.appendChild(nameSpan); row.appendChild(delBtn); body.appendChild(row);
    });
  }
  modal.classList.add("active");
}

function closeLoadModal() { document.getElementById("loadModal").classList.remove("active"); }
function closeLoadModalOnOverlay(event) { if (event.target.id === "loadModal") closeLoadModal(); }

function loadSelectedGrid(name) {
  const savedGrids = getSavedGrids(); const data = savedGrids[name];
  if (data) {
    if (Array.isArray(data)) { COLS = 13; ROWS = 17; cells = data; }
    else { COLS = data.cols; ROWS = data.rows; cells = data.cells; }
    currentGridName = name; selected = null; updateGridDisplay(); closeLoadModal();
  }
}

function deleteSavedGrid(name) {
  if (confirm(`Supprimer la grille "${name}" ?`)) {
    const savedGrids = getSavedGrids(); delete savedGrids[name];
    localStorage.setItem("motsFlechesGrids", JSON.stringify(savedGrids)); openLoadModal();
  }
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.cells) {
        cells = data.cells;
        COLS = data.cols || 13;
        ROWS = data.rows || 17;
        currentGridName = data.name || file.name.replace(".json", "");
      } else if (Array.isArray(data)) {
        cells = data; COLS = 13; ROWS = 17;
        currentGridName = file.name.replace(".json", "");
      }
      selected = null;
      updateGridDisplay();
    } catch (err) {
      alert("Fichier JSON invalide.");
    }
  };
  reader.readAsText(file);
}