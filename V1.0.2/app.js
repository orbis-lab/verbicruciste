let currentGridId = null; // ID de la grille active dans la base de données
let COLS = 13;
let ROWS = 17;
let currentGridName = "Ma Grille";
let isCreatingNewGrid = false;
let sessionRestorePending = false;
let pendingSessionData = null;

let cells = [];
let selected = null;
let activeWordTarget = null;
let hoveredWordIndexes = [];
let currentInputDir = "E";

const DIR_OFFSETS = {
  S: { r: 1, c: 0 },
  E: { r: 0, c: 1 }
};

let panzoomInstance = null;
let scale = 0.8;
let pointX = 50;
let pointY = 40;
let isPanning = false;
let startX = 0, startY = 0;

let hasMoved = false;
let clickStartX = 0;
let clickStartY = 0;
let USER = {}

window.init = async function () {
  const startTime = Date.now();

  applyStoredTheme();
  checkUserSession();

  cells = Array.from({ length: COLS * ROWS }, emptyCell);

  // Vérifie si une grille précédente a été sauvegardée avant de lancer le
  // premier rendu : si c'est le cas, la persistance automatique de la
  // session est mise en pause (sessionRestorePending) le temps que
  // l'utilisateur choisisse de la restaurer ou non, pour ne pas l'écraser
  // avec la grille vierge fraîchement créée ci-dessus.
  checkPreviousSession();

  updateGridDisplay();

  // Appel de la fonction pour le zoom et le déplacement
  initPanAndZoomGrid();

  // Calcul du temps écoulé pour garantir un minimum de 2 secondes (2000 ms)
  const elapsedTime = Date.now() - startTime;
  const remainingTime = Math.max(0, 2000 - elapsedTime);

  setTimeout(() => {
    const loader = document.getElementById('appLoader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.remove();
      }, 500); // Correspond au temps de transition CSS (0.5s)
    }
  }, remainingTime);

  // NOTE impression : l'échelle et la position utilisées à l'impression sont
  // désormais entièrement gérées en CSS (voir la règle `@media print` dans
  // style.css, qui force `transform: none !important` sur `.grid`). Cela
  // garantit une échelle d'impression toujours indépendante du zoom/
  // déplacement appliqués à l'écran, sans avoir besoin de manipuler `scale`,
  // `pointX`/`pointY` ni le `transform` inline en JavaScript.

  // --- Menu burger mobile : refermé automatiquement dès qu'une action de la
  // toolbar est déclenchée (chaque bouton ouvre de toute façon son propre
  // modal, inutile de laisser le tiroir latéral ouvert par-dessus). ---
  const topbarEl = document.querySelector('.topbar');
  if (topbarEl) {
    topbarEl.addEventListener('click', (event) => {
      if (event.target.closest('.icon-btn')) closeMobileMenu();
    });
  }
};


// S'assure de lancer l'initialisation au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  window.init();
});

function updateZoomDisplay() {
  const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
  if (zoomLevelDisplay) {
    zoomLevelDisplay.textContent = `${Math.round(scale * 100)}%`;
  }

}

// Fonction dédiée à la gestion du Pan (glissement) et du Zoom de la grille
// Fonction dédiée à la gestion du Pan (glissement) et du Zoom de la grille
// Variable globale pour stocker la distance initiale lors d'un pincement tactile (zoom)
let initialTouchDistance = null;
let setTransform = null; // Variable globale pour stocker la fonction de transformation

function initPanAndZoomGrid() {
  const editorContainer = document.querySelector('.editor');
  const elementEditor = document.querySelector('.grid');

  if (!elementEditor || !editorContainer) return;

  setTransform = function () {
    elementEditor.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    elementEditor.style.transformOrigin = "0 0";
    updateZoomDisplay();
  };

  // On délègue le centrage géométrique à une fonction externe réutilisable
  updateGridGeometry();

  // --- GESTION DU ZOOM À LA MOLETTE (PC) ---
  editorContainer.addEventListener('wheel', (event) => {
    event.preventDefault();

    const zoomIntensity = 0.1;
    const prevScale = scale;

    if (event.deltaY < 0) {
      scale = Math.min(scale + zoomIntensity, 2.5);
    } else {
      scale = Math.max(scale - zoomIntensity, 0.4);
    }

    const rect = editorContainer.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    pointX = mouseX - (mouseX - pointX) * (scale / prevScale);
    pointY = mouseY - (mouseY - pointY) * (scale / prevScale);

    if (setTransform) setTransform();
  }, { passive: false });

  // --- FONCTIONS DE GESTION DE DÉPLACEMENT (PAN) ---
  function startPan(clientX, clientY) {
    isPanning = true;
    hasMoved = false;
    startX = clientX - pointX;
    startY = clientY - pointY;
    clickStartX = clientX;
    clickStartY = clientY;
    editorContainer.style.cursor = 'grabbing';
  }

  function movePan(clientX, clientY) {
    if (!isPanning) return;
    const moveDistance = Math.hypot(clientX - clickStartX, clientY - clickStartY);
    if (moveDistance > 5) hasMoved = true;

    if (hasMoved) {
      pointX = clientX - startX;
      pointY = clientY - startY;
      if (setTransform) setTransform();
    }
  }

  function endPan() {
    if (isPanning) {
      isPanning = false;
      if (editorContainer) editorContainer.style.cursor = 'default';
    }
  }

  // --- ÉVÉNEMENTS SOURIS (PC) ---
  editorContainer.addEventListener('mousedown', (event) => {
    startPan(event.clientX, event.clientY);
  });

  window.addEventListener('mousemove', (event) => {
    movePan(event.clientX, event.clientY);
  });

  window.addEventListener('mouseup', () => {
    endPan();
  });

  // --- ÉVÉNEMENTS TACTILES (Mobile / Tablettes : 1 ou 2 doigts) ---
  editorContainer.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
      // 1 doigt : Glissement de la grille (Pan)
      const touch = event.touches[0];
      startPan(touch.clientX, touch.clientY);
    } else if (event.touches.length === 2) {
      // 2 doigts : On stoppe le pan et on initialise la distance pour le zoom
      isPanning = false;
      initialTouchDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
    }
  }, { passive: true });

  window.addEventListener('touchmove', (event) => {
    if (event.touches.length === 1 && isPanning) {
      const touch = event.touches[0];
      movePan(touch.clientX, touch.clientY);
    } else if (event.touches.length === 2 && initialTouchDistance !== null) {
      // Bloque le comportement natif du smartphone (qui fait sortir de l'app ou zoomer la page)
      event.preventDefault();

      const currentDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );

      const factor = currentDistance / initialTouchDistance;
      initialTouchDistance = currentDistance;

      const prevScale = scale;
      scale = Math.max(0.4, Math.min(2.5, scale * factor));

      // Centre le zoom pile entre les deux doigts
      const rect = editorContainer.getBoundingClientRect();
      const centerX = ((event.touches[0].clientX + event.touches[1].clientX) / 2) - rect.left;
      const centerY = ((event.touches[0].clientY + event.touches[1].clientY) / 2) - rect.top;

      pointX = centerX - (centerX - pointX) * (scale / prevScale);
      pointY = centerY - (centerY - pointY) * (scale / prevScale);

      if (setTransform) setTransform();
    }
  }, { passive: false }); // Nécessaire pour autoriser le preventDefault()

  window.addEventListener('touchend', (event) => {
    if (event.touches.length < 2) {
      initialTouchDistance = null;
    }
    if (event.touches.length === 0) {
      endPan();
    }
  });

  // --- BLOCAGE DU GESTE NATIF DE PINCEMENT (iOS/Safari) ---
  // Sur iOS, en plus des événements `touch*` standards ci-dessus, Safari émet
  // ses propres événements `gesture*` (non standards) pour le pincement à
  // deux doigts, et peut faire zoomer nativement toute la PAGE si rien ne
  // s'y oppose — même si `event.preventDefault()` est déjà appelé sur
  // `touchmove`. On bloque donc explicitement ces gestes sur la zone de
  // l'éditeur pour laisser notre propre gestion du zoom (ci-dessus) prendre
  // seule la main.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
    editorContainer.addEventListener(evt, (event) => { event.preventDefault(); }, { passive: false });
  });
}
// Nouvelle fonction pour recalculer dynamiquement la taille et le centrage de la grille
function updateGridGeometry() {
  const editorContainer = document.querySelector('.editor');
  const elementEditor = document.querySelector('.grid');
  if (!elementEditor || !editorContainer) return;

  const containerRect = editorContainer.getBoundingClientRect();
  const computedCellSize = parseFloat(getComputedStyle(elementEditor).getPropertyValue('--cell')) || 54;

  const gridPixelWidth = COLS * computedCellSize;
  const gridPixelHeight = ROWS * computedCellSize;

  // --- ÉCHELLE AUTOMATIQUE ---
  // Plutôt qu'une échelle fixe, on calcule le zoom qui permet à la grille de
  // tenir entièrement (horizontalement ET verticalement) dans l'espace
  // disponible de .editor, en conservant une petite marge esthétique tout
  // autour. Fonctionne aussi bien sur desktop que sur mobile puisque tout
  // est dérivé de la taille réelle (getBoundingClientRect) de .editor.
  const margin = 24; // marge esthétique (px) conservée entre la grille et les bords de .editor
  const availableWidth = Math.max(containerRect.width - margin * 2, 50);
  const availableHeight = Math.max(containerRect.height - margin * 2, 50);
  const autoScale = Math.min(availableWidth / gridPixelWidth, availableHeight / gridPixelHeight);
  scale = Math.max(0.2, Math.min(autoScale, 2.5));

  // --- CENTRAGE ---
  pointX = (containerRect.width - (gridPixelWidth * scale)) / 2;
  pointY = (containerRect.height - (gridPixelHeight * scale)) / 2;

  if (setTransform) setTransform();
}


function emptyCell() {
  return {
    type: "letter", letter: "", definition: "", arrow: "E",
    top: { definition: "", arrow: "E" },
    bottom: { definition: "", arrow: "S" }
  };
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

  // On énumère explicitement chaque piste plutôt que d'utiliser
  // `repeat(N, var(--cell))` : certains moteurs de rendu (notamment lors de
  // l'impression) accumulent de très légers écarts d'arrondi entre pistes
  // répétées, écart qui se retrouve entièrement absorbé par la DERNIÈRE
  // ligne/colonne et la rend visiblement plus haute/large que les autres.
  // Une liste explicite fixe chaque piste indépendamment, sans accumulation
  // possible.
  grid.style.gridTemplateColumns = Array(COLS).fill('var(--cell)').join(' ');
  grid.style.gridTemplateRows = Array(ROWS).fill('var(--cell)').join(' ');

  // On fige également une largeur/hauteur explicite, égale à la somme EXACTE
  // des pistes, pour empêcher le conteneur `.grid` de redistribuer un
  // éventuel reliquat d'espace (dû à l'arrondi) dans la dernière ligne.
  const computedCellSize = parseFloat(getComputedStyle(grid).getPropertyValue('--cell')) || 54;
  grid.style.width = `${COLS * computedCellSize}px`;
  grid.style.height = `${ROWS * computedCellSize}px`;

  render();

  // --- AJOUT : Recalcule la taille physique et le centrage lors du changement de dimensions ---
  updateGridGeometry();
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
      input.maxLength = 1;
      input.value = cell.letter || "";
      input.setAttribute("autocomplete", "off");
      input.readOnly = true; // Reste en lecture seule pour bloquer le clavier au toucher direct de la case

      // Au clic direct sur la case, on sélectionne et on affiche le bouton, PAS de clavier
      input.addEventListener("click", (e) => {
        e.preventDefault();
        selectCellSilently(index);
        showKeyboardPromptButton(true);
      });

      input.addEventListener("focus", () => {
        selectCellSilently(index);
        showKeyboardPromptButton(true);
      });

      input.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") { currentInputDir = "S"; moveToNextLetter(1); return; }
        else if (e.key === "ArrowRight") { currentInputDir = "E"; moveToNextLetter(1); return; }
        else if (e.key === "ArrowUp") { currentInputDir = "S"; moveToNextLetter(-1); return; }
        else if (e.key === "ArrowLeft") { currentInputDir = "E"; moveToNextLetter(-1); return; }

        if (e.key === "Backspace") {
          e.preventDefault(); cell.letter = ""; input.value = "";
          updatePanel(); updatePlacedWordsList(); persistSession(); moveToNextLetter(-1);
        } else if (e.key.length === 1 && /[a-zA-ZÀ-ÿ]/.test(e.key)) {
          e.preventDefault(); const char = e.key.toUpperCase(); cell.letter = char; input.value = char;
          updatePanel(); updatePlacedWordsList(); persistSession(); moveToNextLetter(1);
        }
      });
      el.appendChild(input);
    }

    if (cell.type === "definition") {
      const editable = document.createElement("div");
      editable.className = "def-content";
      editable.contentEditable = "true";
      editable.innerText = cell.definition;
      editable.addEventListener("focus", () => {
        currentInputDir = cell.arrow;
        selectCellSilently(index);
        showKeyboardPromptButton(false); // Masque le bouton lettre si on édite une définition
      });
      editable.addEventListener("input", e => { cell.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("definitionInput"); if (sideInput) sideInput.value = cell.definition; persistSession(); });
      el.appendChild(editable);
      const svg = createArrowSVG(cell.arrow, "full");
      if (svg) el.appendChild(svg);
    }

    if (cell.type === "double") {
      el.innerHTML = `<div class="half"><div class="def-editable" contenteditable="true"></div></div><div class="half"><div class="def-editable" contenteditable="true"></div></div>`;
      const halves = el.querySelectorAll(".half"); const editables = el.querySelectorAll(".def-editable");
      editables[0].innerText = cell.top.definition; editables[1].innerText = cell.bottom.definition;

      editables[0].addEventListener("focus", () => { currentInputDir = "E"; selectCellSilently(index); showKeyboardPromptButton(false); const sideInput = document.getElementById("topDefinitionInput"); if (sideInput) sideInput.value = cell.top.definition; });
      editables[1].addEventListener("focus", () => { currentInputDir = "S"; selectCellSilently(index); showKeyboardPromptButton(false); const sideInput = document.getElementById("bottomDefinitionInput"); if (sideInput) sideInput.value = cell.bottom.definition; });

      editables[0].addEventListener("input", e => { cell.top.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("topDefinitionInput"); if (sideInput) sideInput.value = cell.top.definition; persistSession(); });
      editables[1].addEventListener("input", e => { cell.bottom.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("bottomDefinitionInput"); if (sideInput) sideInput.value = cell.bottom.definition; persistSession(); });

      const svgTop = createArrowSVG("E", "top"); if (svgTop) halves[0].appendChild(svgTop);
      const svgBottom = createArrowSVG("S", "bottom"); if (svgBottom) halves[1].appendChild(svgBottom);
    }

    el.dataset.index = index;
    el.addEventListener("click", () => {
      if (cell.type !== "double" && cell.type !== "definition" && cell.type !== "letter") {
        selectCell(index);
        showKeyboardPromptButton(false);
      }
    });
    grid.appendChild(el);
  });

  updatePanel();
  updatePlacedWordsList();
  persistSession();
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

  if (labelText === "Mot formé" || labelText === "Mot associé" || labelText === "Mot du haut" || labelText === "Mot du bas") {
    const badge = document.createElement("span");
    badge.className = "unstable-api-badge";
    badge.title = "Fonctionnalités en cours de fiabilisation : les appels API de cet encart (correction, suggestions, définition, synonymes) peuvent être instables.";
    badge.innerHTML = `<span>bêta</span>&nbsp<span class="material-symbols-outlined">construction</span>`;
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

function updateDefinition(value) { if (selected !== null) { cells[selected].definition = value.toUpperCase(); const grid = document.getElementById("grid"); if (grid.children[selected]) { const def = grid.children[selected].querySelector(".def-content"); if (def && def !== document.activeElement) def.innerText = cells[selected].definition; } persistSession(); } }
function setArrow(direction) { if (selected !== null && cells[selected].type === "definition") { cells[selected].arrow = direction; currentInputDir = direction; render(); } }
function updateHalfDefinition(which, value) { if (selected !== null && cells[selected].type === "double") { cells[selected][which].definition = value.toUpperCase(); const grid = document.getElementById("grid"); if (grid.children[selected]) { const editables = grid.children[selected].querySelectorAll(".def-editable"); const idx = which === "top" ? 0 : 1; if (editables[idx] && editables[idx] !== document.activeElement) editables[idx].innerText = cells[selected][which].definition; } persistSession(); } }

function clearCell() { if (selected === null) return; cells[selected] = emptyCell(); render(); }

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
// Fonction pour sauvegarder la grille dans le cloud via save_grid.php
const saveGridToCloud = (gridData) => {
  const payload = {
    id: currentGridId, // <--- On envoie l'ID actuel au serveur
    name: currentGridName,
    cols: COLS,
    rows: ROWS,
    version: gridData.version || 2,
    cells: gridData.cells || cells
  };

  fetch('api/save_grid.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // <--- On met à jour l'ID avec celui retourné (essentiel après un premier INSERT)
        if (data.grid_id) {
          currentGridId = data.grid_id;
        }
        console.log("Grille sauvegardée dans le cloud avec succès !");
      } else {
        alert("Erreur : " + (data.error || "Impossible de sauvegarder la grille."));
      }
    })
    .catch(error => {
      console.error("Erreur réseau :", error);
    });
};

async function applySettings() {
  const newName = document.getElementById('settingName').value.trim() || "Grille Sans Nom";
  const newCols = parseInt(document.getElementById('settingCols').value, 10) || 13;
  const newRows = parseInt(document.getElementById('settingRows').value, 10) || 17;

  const oldCols = COLS;
  const oldRows = ROWS;

  currentGridName = newName;
  COLS = newCols;
  ROWS = newRows;

  // --- RECONSTRUCTION PROPRE DU TABLEAU DE CELLULES ---
  // On recrée toujours un tableau exact de la nouvelle taille (newCols * newRows)
  const newCells = Array.from({ length: COLS * ROWS }, emptyCell);

  // On récupère les anciennes données dans la limite des nouvelles dimensions
  for (let r = 0; r < Math.min(oldRows, ROWS); r++) {
    for (let c = 0; c < Math.min(oldCols, COLS); c++) {
      const oldIndex = r * oldCols + c;
      const newIndex = r * COLS + c;
      if (cells[oldIndex]) {
        newCells[newIndex] = { ...cells[oldIndex] }; // Copie propre de la cellule
      }
    }
  }

  cells = newCells;
  selected = null;

  if (isCreatingNewGrid) {
    // Nouvelle grille non encore enregistrée
    currentGridId = null;
  } else {
    // --- ENVOI DE LA MISE À JOUR COMPLÈTE AU CLOUD ---
    // Pour que le backend enregistre bien la nouvelle taille ET les cellules redimensionnées sans décalage
    if (currentGridId) {
      try {
        const response = await fetch('./api/save_grid.php', { // Utilise save_grid pour persister dimensions + cellules d'un coup
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            id: currentGridId,
            name: currentGridName,
            cols: COLS,
            rows: ROWS,
            cells: cells
          })
        });
        const data = await response.json();
        if (!data.success) {
          console.error("Erreur lors de la mise à jour des paramètres :", data.error);
          alert("Erreur lors de l'enregistrement des paramètres dans le cloud.");
        }
      } catch (err) {
        console.error("Erreur réseau :", err);
        alert("Impossible de contacter le serveur pour mettre à jour les paramètres.");
      }
    } else {
      saveGridToCloud({ version: 2, cols: COLS, rows: ROWS, cells: cells });
    }
  }

  updateGridDisplay();
  closeSettingsModal();
}


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

async function confirmSave(destination) {
  let targetName = currentGridName;

  if (isSaveAsMode) {
    const newName = document.getElementById("saveAsNameInput").value.trim();
    if (!newName) {
      alert("Veuillez entrer un nom valide.");
      return;
    }
    targetName = newName;

    // --- CORRECTION CLÉ POUR "ENREGISTRER SOUS" ---
    // Puisqu'il s'agit d'un "Enregistrer sous", on doit impérativement 
    // détacher l'ID actuel pour forcer la création d'une nouvelle ligne en BDD.
    currentGridId = null;
  }

  if (destination === "cloud") {
    const savedGrids = await getSavedGrids();

    // Si on fait un "Enregistrer sous" avec un nom qui existe déjà, ou un "Enregistrer" sur un autre nom
    if (savedGrids.hasOwnProperty(targetName) && (isSaveAsMode || targetName !== currentGridName)) {
      const overwrite = confirm(`Une grille portant le nom "${targetName}" existe déjà dans le cloud. Voulez-vous l'écraser ?`);
      if (!overwrite) {
        return;
      }
    }

    currentGridName = targetName;

    const payload = {
      id: currentGridId, // Si null, le PHP comprendra qu'il faut insérer une nouvelle grille
      name: currentGridName,
      cols: COLS,
      rows: ROWS,
      version: 2,
      cells: cells
    };

    saveGridToCloud(payload);

    updateGridDisplay();
    closeSaveModal();
  } else if (destination === "file") {
    currentGridName = targetName;
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




function closeLoadModal() { document.getElementById("loadModal").classList.remove("active"); }
function closeLoadModalOnOverlay(event) { if (event.target.id === "loadModal") closeLoadModal(); }

async function loadSelectedGrid(name) {
  const savedGrids = await getSavedGrids();
  const data = savedGrids[name];

  if (data) {
    if (Array.isArray(data)) {
      // Ancienne structure (simple tableau de cellules)
      COLS = 13;
      ROWS = 17;
      cells = data;
      currentGridId = null;
    } else {
      // Nouvelle structure objet
      COLS = data.cols;
      ROWS = data.rows;
      cells = data.cells;
      currentGridId = data.id || null;
    }

    currentGridName = name;
    selected = null;

    // 1. On met à jour l'affichage de la grille et des dimensions
    updateGridDisplay();

    // 2. On force le recalcul géométrique et le centrage immédiatement après
    if (typeof updateGridGeometry === 'function') {
      updateGridGeometry();
    }

    closeLoadModal();
  }
}



// ==========================================================================
// Restauration de la grille précédente
// ==========================================================================

// Sauvegarde silencieusement l'état courant de la grille (nom, dimensions,
// cases) dans le localStorage, afin de pouvoir proposer sa restauration au
// prochain chargement de la page. Mis en pause tant qu'une décision de
// restauration est en attente (sessionRestorePending), pour ne pas écraser
// la sauvegarde avec la grille vierge affichée en arrière-plan du modal.
function persistSession() {
  if (sessionRestorePending) return;
  try {
    localStorage.setItem("motsFlechesLastSession", JSON.stringify({
      name: currentGridName, cols: COLS, rows: ROWS, cells: cells
    }));
  } catch (e) { /* stockage indisponible : on ignore silencieusement */ }
}

// Vérifie, au démarrage, si une grille précédente a été sauvegardée. Si
// c'est le cas (et qu'elle contient réellement du contenu), affiche le
// modal de restauration et met en pause la persistance automatique.
async function checkPreviousSession() {
  try {
    // On récupère les grilles depuis le cloud via ton mécanisme existant
    const savedGrids = await getSavedGrids();
    const gridNames = Object.keys(savedGrids);

    // S'il n'y a aucune grille dans le cloud, on ne fait rien
    if (gridNames.length === 0) return;

    // Optionnel : on peut trier ou récupérer la dernière modifiée/enregistrée si tu stockes une date, 
    // ou tout simplement prendre la première/dernière de la liste.
    // Prenons par exemple la dernière grille de la liste des grilles enregistrées :
    const lastName = gridNames[gridNames.length - 1];
    const lastGridData = savedGrids[lastName];

    if (!lastGridData || !lastGridData.cells || lastGridData.cells.length === 0) return;

    // On prépare les données pour la restauration potentielle
    sessionRestorePending = true;
    pendingSessionData = {
      name: lastName,
      cols: lastGridData.cols || 13,
      rows: lastGridData.rows || 17,
      cells: lastGridData.cells,
      id: lastGridData.id || null
    };

    // Affichage de la modale de restauration
    const modal = document.getElementById("restoreModal");
    if (modal) modal.classList.add("active");

  } catch (e) {
    console.error("Erreur lors de la vérification des sessions cloud :", e);
  }
}

function restorePreviousSession() {
  if (pendingSessionData) {
    COLS = pendingSessionData.cols || 13;
    ROWS = pendingSessionData.rows || 17;
    cells = pendingSessionData.cells;
    currentGridName = pendingSessionData.name || "Ma Grille";
    currentGridId = pendingSessionData.id || null;
  }
  sessionRestorePending = false;
  pendingSessionData = null;
  selected = null;

  updateGridDisplay();

  // Ajout ici aussi pour la session restaurée au démarrage
  if (typeof updateGridGeometry === 'function') {
    updateGridGeometry();
  }

  closeRestoreModal();
}

function openSession() {
  openLoadModal()
  closeRestoreModal();
}


function discardPreviousSession() {
  sessionRestorePending = false;
  pendingSessionData = null;
  closeRestoreModal();
  persistSession();
  // Ouvre directement le modal de paramètres en mode "Nouvelle grille"
  newGrid();
}

function closeRestoreModal() {
  const modal = document.getElementById("restoreModal");
  if (modal) modal.classList.remove("active");
}

// ==========================================================================
// Sélecteur de thème (clair / sombre)
// ==========================================================================

function toggleThemeMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById("themeMenu");
  if (menu) menu.classList.toggle("active");
  updateThemeMenuUI();
}

async function applyStoredTheme() {
  try {
    const response = await fetch('api/get_user_preferences.php', {
      credentials: 'include'
    });

    if (!response.ok) {
      console.error('Erreur HTTP :', response.status);
      return;
    }

    const data = await response.json();
    if (data.success) {
      // On applique l'attribut ET la classe pour être compatible avec votre CSS actuel
      document.documentElement.setAttribute('data-theme', data.theme);
      document.documentElement.classList.toggle("dark-theme", data.theme === "dark");
    }
  } catch (error) {
    console.error('Erreur réseau :', error);
  }
}

function setTheme(theme) {
  // 1. On met à jour l'attribut HTML (pour l'état global)
  document.documentElement.setAttribute('data-theme', theme);

  // 2. On ajoute/retire la classe CSS (pour que vos styles CSS s'activent immédiatement)
  document.documentElement.classList.toggle("dark-theme", theme === "dark");


  updateThemeMenuUI();
  const menu = document.getElementById("themeMenu");
  if (menu) menu.classList.remove("active");

  changeUserTheme(theme);
}

function updateThemeMenuUI() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  document.querySelectorAll(".theme-menu-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === currentTheme);
  });
}

// ==========================================================================
// Modal Aide
// ==========================================================================

function openHelpModal() { document.getElementById("helpModal").classList.add("active"); }
function closeHelpModal() { document.getElementById("helpModal").classList.remove("active"); }
function closeHelpModalOnOverlay(event) { if (event.target.id === "helpModal") closeHelpModal(); }

// ==========================================================================
// Modals mobiles indépendants (Sélection / Grille / Mots)
// ==========================================================================
// Chaque section (`.main-section`) peut être ouverte individuellement en
// superposition de la grille, indépendamment des deux autres, via son propre
// bouton dans la barre de navigation mobile. L'ouverture/fermeture ne touche
// jamais `scale`/`pointX`/`pointY` : le zoom et la position de la grille
// restent donc inchangés pendant que le modal est affiché.

let openSectionId = null;

function openSectionModal(id) {
  closeAllSectionModals();
  const el = document.getElementById(id);
  if (el) el.classList.add("mobile-open");
  const backdrop = document.getElementById("mobileSectionBackdrop");
  if (backdrop) backdrop.classList.add("active");
  openSectionId = id;
}

function closeAllSectionModals() {
  document.querySelectorAll(".main-section.mobile-open").forEach(el => el.classList.remove("mobile-open"));
  const backdrop = document.getElementById("mobileSectionBackdrop");
  if (backdrop) backdrop.classList.remove("active");
  openSectionId = null;
}

// ==========================================================================
// Menu burger mobile (remplace la toolbar visible en permanence sur mobile)
// ==========================================================================

function toggleMobileMenu(event) {
  if (event) event.stopPropagation();
  const topbar = document.querySelector(".topbar");
  const backdrop = document.getElementById("mobileMenuBackdrop");
  if (!topbar) return;
  const isOpen = topbar.classList.toggle("mobile-menu-open");
  if (backdrop) backdrop.classList.toggle("active", isOpen);
}

function closeMobileMenu() {
  const topbar = document.querySelector(".topbar");
  const backdrop = document.getElementById("mobileMenuBackdrop");
  if (topbar) topbar.classList.remove("mobile-menu-open");
  if (backdrop) backdrop.classList.remove("active");
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
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





// Basculer entre les onglets Connexion / Inscription
function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
  }
}

// Gestion de la Connexion
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  errorDiv.textContent = '';

  try {
    const response = await fetch('./api/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    USER = data.user

    if (data.success) {
      document.getElementById('authModal').style.display = 'none';
      checkUserSession(); // Recharge l'état utilisateur
    } else {
      errorDiv.textContent = data.error || 'Erreur de connexion';
    }
  } catch (err) {
    errorDiv.textContent = 'Impossible de contacter le serveur.';
  }
}

// Gestion de l'Inscription
async function handleRegister(event) {
  event.preventDefault();
  const first_name = document.getElementById('regFirstName').value;
  const last_name = document.getElementById('regLastName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const errorDiv = document.getElementById('registerError');
  errorDiv.textContent = '';

  try {
    const response = await fetch('./api/register.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ first_name, last_name, email, password })
    });
    const data = await response.json();

    if (data.success) {
      document.getElementById('authModal').style.display = 'none';
      checkUserSession(); // Recharge l'état utilisateur
    } else {
      errorDiv.textContent = data.error || 'Erreur lors de l\'inscription';
    }
  } catch (err) {
    errorDiv.textContent = 'Impossible de contacter le serveur.';
  }
}

// Gestion de la Déconnexion
async function handleLogout() {
  try {
    await fetch('./api/logout.php');
    location.reload(); // Recharge la page pour réafficher la modale
  } catch (err) {
    console.error('Erreur lors de la déconnexion');
  }
}

// Vérifier si l'utilisateur est connecté au chargement de l'application
async function checkUserSession() {
  try {
    const response = await fetch('./api/user.php', {
      method: 'GET',
      credentials: 'include' // Très important pour transmettre le cookie de session
    });

    if (response.status === 401) {
      // Non connecté : on affiche la modale de login
      document.getElementById('authModal').style.display = 'flex';
      document.getElementById('userMenuContainer').style.display = 'none';
      return;
    }

    const data = await response.json();

    if (data.success && data.user) {
      // L'utilisateur est reconnu grâce à sa session, PAS BESOIN de se reloguer !
      USER = data.user;

      document.getElementById('authModal').style.display = 'none';
      document.getElementById('userMenuContainer').style.display = 'inline-block';

      // Ici tu peux aussi rafraîchir l'affichage de son nom dans l'UI si besoin
    }
  } catch (err) {
    console.error("Erreur lors de la vérification de session :", err);
  }
}



// Remplace le localStorage par un appel à l'API load_grids.php
// Remplace le localStorage par un appel à l'API load_grids.php
async function getSavedGrids() {
  try {
    const response = await fetch('./api/load_grids.php', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await response.json();

    if (data.success && data.grids) {
      const gridsMap = {};
      data.grids.forEach(grid => {
        const rawContent = grid.content || grid.grid_data;
        let gridContent = typeof rawContent === 'string'
          ? JSON.parse(rawContent)
          : rawContent;

        // Si le contenu est un objet structuré, on s'assure de récupérer les bonnes dimensions 
        // en priorité depuis les colonnes dédiées de la table SQL (grid.cols et grid.rows)
        let finalCols = grid.cols !== undefined ? parseInt(grid.cols, 10) : (gridContent.cols || 13);
        let finalRows = grid.rows !== undefined ? parseInt(grid.rows, 10) : (gridContent.rows || 17);
        let finalCells = Array.isArray(gridContent) ? gridContent : (gridContent.cells || []);

        gridsMap[grid.name] = {
          id: grid.id,
          cols: finalCols,
          rows: finalRows,
          cells: finalCells
        };
      });
      return gridsMap;
    }
  } catch (err) {
    console.error("Erreur lors du chargement des grilles depuis le cloud :", err);
  }
  return {};
}

// openLoadModal devient async pour attendre le retour de l'API
async function openLoadModal() {
  const modal = document.getElementById("loadModal");
  const body = document.getElementById("modalBody");

  const savedGrids = await getSavedGrids();
  const names = Object.keys(savedGrids);

  let htmlStr = `
    <div class="import-json-btn" onclick="document.getElementById('fileInput').click(); closeLoadModal();">
      <span class="material-symbols-outlined">file_upload</span> Importer une grille depuis un fichier JSON
    </div>
    <div class="modal-separator"></div>
  `;

  if (names.length === 0) {
    htmlStr += "<div class='modal-empty'>Aucune grille sauvegardée dans le cloud pour le moment.</div>";
    body.innerHTML = htmlStr;
  } else {
    body.innerHTML = htmlStr;
    names.forEach(name => {
      const gridInfo = savedGrids[name];
      const gridId = gridInfo.id || null;

      const row = document.createElement("div");
      row.className = "grid-item-row";

      const nameSpan = document.createElement("span");
      nameSpan.className = "grid-item-name";
      nameSpan.textContent = name;
      nameSpan.onclick = () => loadSelectedGrid(name);

      const delBtn = document.createElement("button");
      delBtn.className = "grid-item-delete";
      delBtn.title = "Supprimer";
      delBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">delete</span>`;

      // Transmission correcte du nom et de l'ID à la fonction de suppression
      delBtn.onclick = (e) => {
        e.stopPropagation();
        deleteSavedGrid(name, gridId);
      };

      row.appendChild(nameSpan);
      row.appendChild(delBtn);
      body.appendChild(row);
    });
  }
  modal.classList.add("active");
}



// Fonction de suppression connectée à l'API PHP `delete_grid.php`[cite: 11]
async function deleteSavedGrid(name, gridId) {
  if (!confirm(`Supprimer la grille "${name}" du cloud ?`)) return;

  try {
    const response = await fetch('./api/delete_grid.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: gridId, name: name })
    });

    // Récupération de la réponse brute pour analyser d'éventuelles erreurs PHP
    const rawText = await response.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("Réponse serveur invalide (non-JSON) :", rawText);
      alert("Erreur serveur : Le script PHP a renvoyé du code HTML ou une erreur (voir la console).");
      return;
    }

    if (data.success) {
      openLoadModal();
    } else {
      alert(data.error || "Erreur lors de la suppression.");
    }
  } catch (err) {
    console.error("Erreur réseau :", err);
    alert("Impossible de contacter le serveur pour la suppression.");
  }
}


// Ouvre le modal de confirmation pour vider la grille
function clearGrid() {
  const modal = document.getElementById("clearGridModal");
  if (modal) {
    modal.classList.add("active");
  } else {
    // Fallback de sécurité si le modal HTML n'est pas encore présent
    if (confirm("Vider toute la grille ?")) {
      executeClearGrid();
    }
  }
}

// Ferme le modal
function closeClearModal() {
  const modal = document.getElementById("clearGridModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

// Ferme le modal si l'on clique sur l'arrière-plan grisé
function closeClearModalOnOverlay(event) {
  if (event.target.id === "clearGridModal") {
    closeClearModal();
  }
}

// Exécute réellement le nettoyage de la grille après confirmation
function executeClearGrid() {
  cells = Array.from({ length: COLS * ROWS }, emptyCell);
  selected = null;
  render();
  closeClearModal();
}


// Ouvre le modal de sélection du thème
function openThemeModal() {
  const modal = document.getElementById("themeModal");
  if (modal) {
    modal.classList.add("active");
  }
}

// Ferme le modal de sélection du thème
function closeThemeModal() {
  const modal = document.getElementById("themeModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

// Ferme le modal si l'on clique sur l'arrière-plan grisé
function closeThemeModalOnOverlay(event) {
  if (event.target.id === "themeModal") {
    closeThemeModal();
  }
}

// Applique le thème choisi et ferme le modal
function selectThemeAndClose(themeName) {
  setTheme(themeName); // Appelle ta logique existante qui applique le thème (ex: dark-theme)
  closeThemeModal();
}

// Ouvre le modal de gestion du compte et charge les infos
function openUserModal() {

  const modal = document.getElementById("userModal");
  if (modal) {
    modal.classList.add("active");

    // Récupération de l'e-mail
    const emailSpan = document.getElementById("userEmailDisplay");
    const emailModalDisplay = document.getElementById("userEmailModalDisplay");
    if (emailModalDisplay) {
      emailModalDisplay.textContent = USER.email;
    }

    // Récupération du nom / prénom (adapte les clés selon ton système d'authentification)
    const nameModalDisplay = document.getElementById("userNameModalDisplay");
    if (nameModalDisplay) {
      // Exemple : si tu stockes séparément ou dans un objet JSON 'currentUser'
      const firstName = USER.first_name || '';
      const lastName = USER.last_name || '';
      const fullName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : "Utilisateur";

      nameModalDisplay.textContent = fullName;
    }
  }
}

function closeUserModal() {
  const modal = document.getElementById("userModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

function closeUserModalOnOverlay(event) {
  if (event.target.id === "userModal") {
    closeUserModal();
  }
}
// Déclaration de la fonction globale accessible depuis le HTML
function resetZoom() {
  // Appelle la logique de centrage et de réinitialisation de la grille
  if (typeof updateGridGeometry === 'function') {
    updateGridGeometry();
  }
}

// Zoom avant / zoom arrière (boutons du badge de zoom), en conservant le
// centre visuel actuel de la zone d'édition.
function zoomStep(delta) {
  const editorContainer = document.querySelector('.editor');
  if (!editorContainer) return;

  const prevScale = scale;
  scale = delta > 0 ? Math.min(scale + delta, 2.5) : Math.max(scale + delta, 0.4);

  const rect = editorContainer.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  pointX = centerX - (centerX - pointX) * (scale / prevScale);
  pointY = centerY - (centerY - pointY) * (scale / prevScale);

  if (setTransform) setTransform();
}

function zoomIn() { zoomStep(0.15); }
function zoomOut() { zoomStep(-0.15); }



// Optionnel : Fonction pour sauvegarder le changement de thème
async function changeUserTheme(newTheme) {
  try {
    const response = await fetch('api/update_user_preferences.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
      credentials: 'include' // Indispensable ici aussi
    });

    if (!response.ok) {
      console.error('Erreur HTTP :', response.status);
      return;
    }

    const data = await response.json();

    if (data.success) {
      document.documentElement.setAttribute('data-theme', data.theme);
    } else {
      console.warn('Impossible de sauvegarder le thème :', data.error);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du thème :', error);
  }
}

function showKeyboardPromptButton(show) {
  const kbBtn = document.getElementById('openKeyboardBtn');
  if (kbBtn) {
    // N'affiche le bouton que si c'est une case lettre sélectionnée
    if (show && selected !== null && cells[selected].type === "letter") {
      kbBtn.style.display = "inline-flex";
    } else {
      kbBtn.style.display = "none";
    }
  }
}

function requestKeyboardInput() {
  if (selected === null || cells[selected].type !== "letter") return;

  const grid = document.getElementById("grid");
  const el = grid.children[selected];
  if (el) {
    const input = el.querySelector("input");
    if (input) {
      // Sur iOS (notamment iPhone 11), la case était déjà sélectionnée -
      // et donc déjà focus() - au moment du tap précédent sur la case,
      // pendant qu'elle était encore en lecture seule. Si on se contente de
      // retirer le readOnly et de rappeler focus() sur un input déjà actif,
      // Safari ne redéclenche aucun évènement de focus et n'ouvre donc pas
      // le clavier. On force donc explicitement une perte de focus AVANT de
      // repasser l'input en écriture, afin que le focus() qui suit soit
      // bien considéré comme un nouveau focus - tout en restant strictement
      // synchrone, dans la continuité du geste utilisateur (tap sur ce
      // bouton), condition requise par iOS pour autoriser l'ouverture du
      // clavier.
      input.blur();
      input.readOnly = false;
      input.focus();
      input.select();

      // Remet le readOnly à la perte du focus
      const handleBlur = () => {
        input.readOnly = true;
        input.removeEventListener('blur', handleBlur);
      };
      input.addEventListener('blur', handleBlur, { once: true });
    }
  }
}