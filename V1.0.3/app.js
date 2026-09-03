/* ===================================================================== */
/* 1. VARIABLES GLOBALES ET ÉTAT DE L'APPLICATION                    */
/* ===================================================================== */

let currentGridId = null;
let COLS = 13;
let ROWS = 18;
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
let USER = {};

let initialTouchDistance = null;
let setTransform = null;
let isSaveAsMode = false;
let openSectionId = null;

let hasUnsavedChanges = false;
let openedFromStartup = false; // Indique si le modal secondaire vient du démarrage


/* ===================================================================== */
/* 2. INITIALISATION ET CYCLE DE VIE                                     */
/* ===================================================================== */

async function init() {
  const startTime = Date.now();

  applyStoredTheme();
  checkUserSession();

  cells = createDefaultGridCells(COLS, ROWS);

  checkPreviousSession();
  updateGridDisplay();
  initPanAndZoomGrid();

  const elapsedTime = Date.now() - startTime;
  const remainingTime = Math.max(0, 2000 - elapsedTime);

  setTimeout(() => {
    const loader = document.getElementById('appLoader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.remove();
      }, 500);
    }
  }, remainingTime);

  const topbarEl = document.querySelector('.topbar');
  if (topbarEl) {
    topbarEl.addEventListener('click', (event) => {
      if (event.target.closest('.icon-btn')) closeMobileMenu();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  init();
});


/* ===================================================================== */
/* 3. GÉOMÉTRIE DE LA GRILLE, PAN & ZOOM                                 */
/* ===================================================================== */

function updateZoomDisplay() {
  const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
  if (zoomLevelDisplay) {
    zoomLevelDisplay.textContent = `${Math.round(scale * 100)}%`;
  }
}

function initPanAndZoomGrid() {
  const editorContainer = document.querySelector('.editor');
  const elementEditor = document.querySelector('.grid');

  if (!elementEditor || !editorContainer) return;

  setTransform = function () {
    elementEditor.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    elementEditor.style.transformOrigin = "0 0";
    updateZoomDisplay();
  };

  updateGridGeometry();

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

  editorContainer.addEventListener('mousedown', (event) => {
    startPan(event.clientX, event.clientY);
  });

  window.addEventListener('mousemove', (event) => {
    movePan(event.clientX, event.clientY);
  });

  window.addEventListener('mouseup', () => {
    endPan();
  });

  editorContainer.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      startPan(touch.clientX, touch.clientY);
    } else if (event.touches.length === 2) {
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
      event.preventDefault();

      const currentDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );

      const factor = currentDistance / initialTouchDistance;
      initialTouchDistance = currentDistance;

      const prevScale = scale;
      scale = Math.max(0.4, Math.min(2.5, scale * factor));

      const rect = editorContainer.getBoundingClientRect();
      const centerX = ((event.touches[0].clientX + event.touches[1].clientX) / 2) - rect.left;
      const centerY = ((event.touches[0].clientY + event.touches[1].clientY) / 2) - rect.top;

      pointX = centerX - (centerX - pointX) * (scale / prevScale);
      pointY = centerY - (centerY - pointY) * (scale / prevScale);

      if (setTransform) setTransform();
    }
  }, { passive: false });

  window.addEventListener('touchend', (event) => {
    if (event.touches.length < 2) {
      initialTouchDistance = null;
    }
    if (event.touches.length === 0) {
      endPan();
    }
  });

  ['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
    editorContainer.addEventListener(evt, (event) => { event.preventDefault(); }, { passive: false });
  });
}

function updateGridGeometry() {
  const editorContainer = document.querySelector('.editor');
  const elementEditor = document.querySelector('.grid');
  if (!elementEditor || !editorContainer) return;

  const containerRect = editorContainer.getBoundingClientRect();
  const computedCellSize = parseFloat(getComputedStyle(elementEditor).getPropertyValue('--cell')) || 54;

  const gridPixelWidth = COLS * computedCellSize;
  const gridPixelHeight = ROWS * computedCellSize;

  const margin = 24;
  const availableWidth = Math.max(containerRect.width - margin * 2, 50);
  const availableHeight = Math.max(containerRect.height - margin * 2, 50);
  const autoScale = Math.min(availableWidth / gridPixelWidth, availableHeight / gridPixelHeight);
  scale = Math.max(0.2, Math.min(autoScale, 2.5));

  pointX = (containerRect.width - (gridPixelWidth * scale)) / 2;
  pointY = (containerRect.height - (gridPixelHeight * scale)) / 2;

  if (setTransform) setTransform();
}

function resetZoom() {
  if (typeof updateGridGeometry === 'function') {
    updateGridGeometry();
  }
}

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

function zoomIn() {
  zoomStep(0.15);
}

function zoomOut() {
  zoomStep(-0.15);
}


/* ===================================================================== */
/* 4. SELECTION, ANALYSE DE MOTS ET NAVIGATION                          */
/* ===================================================================== */

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

function selectCell(index) {
  selected = Number(index);
  render();
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
    else if (cell.type === "double") {
      processWord((cell.top && cell.top.arrow) || "E");
      processWord((cell.bottom && cell.bottom.arrow) || "S");
    }
  });

  wordCounts.forEach((occurrences, word) => {
    if (occurrences.length > 1) {
      duplicateWordStrings.add(word);
      occurrences.forEach(indexes => { indexes.forEach(i => duplicateIndexes.add(i)); });
    }
  });

  return { duplicateIndexes: Array.from(duplicateIndexes), duplicateWordStrings };
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
        if (defCell.type === "double" && ((defCell.top && defCell.top.arrow === "E") || (defCell.bottom && defCell.bottom.arrow === "E"))) return { dir: "E", data: getWordData(defIdx, "E") };
      }
    } else if (dir === "S") {
      let r = row - 1; while (r >= 0 && cells[r * COLS + col].type === "letter") r--;
      if (r >= 0) {
        const defIdx = r * COLS + col; const defCell = cells[defIdx];
        if (defCell.type === "definition" && defCell.arrow === "S") return { dir: "S", data: getWordData(defIdx, "S") };
        if (defCell.type === "double" && ((defCell.top && defCell.top.arrow === "S") || (defCell.bottom && defCell.bottom.arrow === "S"))) return { dir: "S", data: getWordData(defIdx, "S") };
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
    const topDir = (cell.top && cell.top.arrow) || "E";
    const botDir = (cell.bottom && cell.bottom.arrow) || "S";
    const topIdx = getWordData(selected, topDir).indexes;
    const botIdx = getWordData(selected, botDir).indexes;
    const all = Array.from(new Set([...topIdx, ...botIdx]));
    activeWordTarget = { direction: currentInputDir, indexes: currentInputDir === botDir ? botIdx : topIdx };
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

function moveToNextLetter(step) {
  if (selected === null || !activeWordTarget || activeWordTarget.indexes.length === 0) return;
  const currentIndex = activeWordTarget.indexes.indexOf(selected);
  if (currentIndex !== -1) {
    const nextPos = currentIndex + step;
    if (nextPos >= 0 && nextPos < activeWordTarget.indexes.length) selectCellAndFocus(activeWordTarget.indexes[nextPos]);
  }
}


/* ===================================================================== */
/* 5. AFFICHAGE, RENDU ET INTERFACE GRILLE                               */
/* ===================================================================== */

function updateGridDisplay() {
  document.getElementById('gridNameDisplay').textContent = currentGridName;
  document.getElementById('printTitle').textContent = currentGridName;
  document.getElementById('gridDimensionsDisplay').textContent = `Grille de ${COLS} colonnes × ${ROWS} lignes`;

  const grid = document.getElementById("grid");

  grid.style.gridTemplateColumns = Array(COLS).fill('var(--cell)').join(' ');
  grid.style.gridTemplateRows = Array(ROWS).fill('var(--cell)').join(' ');

  const computedCellSize = parseFloat(getComputedStyle(grid).getPropertyValue('--cell')) || 54;
  grid.style.width = `${COLS * computedCellSize}px`;
  grid.style.height = `${ROWS * computedCellSize}px`;

  render();
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

      input.addEventListener("click", () => {
        selectCellSilently(index);
        input.focus();
        input.select();
      });

      input.addEventListener("focus", () => {
        selectCellSilently(index);
      });

      input.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") { currentInputDir = "S"; moveToNextLetter(1); return; }
        else if (e.key === "ArrowRight") { currentInputDir = "E"; moveToNextLetter(1); return; }
        else if (e.key === "ArrowUp") { currentInputDir = "S"; moveToNextLetter(-1); return; }
        else if (e.key === "ArrowLeft") { currentInputDir = "E"; moveToNextLetter(-1); return; }

        if (e.key === "Backspace") {
          e.preventDefault();
          cell.letter = "";
          input.value = "";
          updatePanel();
          updatePlacedWordsList();
          persistSession();
          moveToNextLetter(-1);
        } else if (e.key.length === 1 && /[a-zA-ZÀ-ÿ]/.test(e.key)) {
          e.preventDefault();
          const char = e.key.toUpperCase();
          cell.letter = char;
          input.value = char;
          updatePanel();
          updatePlacedWordsList();
          markAsDirty()
          persistSession();
          moveToNextLetter(1);
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
      });
      editable.addEventListener("input", e => {
        cell.definition = e.target.innerText.toUpperCase();
        const sideInput = document.getElementById("definitionInput");
        if (sideInput) sideInput.value = cell.definition;
        markAsDirty()
        persistSession();
      });
      el.appendChild(editable);
      const svg = createArrowElement(cell.arrow, "full");
      if (svg) el.appendChild(svg);
    }

    if (cell.type === "double") {
      const topDir = (cell.top && cell.top.arrow) || "E";
      const botDir = (cell.bottom && cell.bottom.arrow) || "S";
      el.innerHTML = `<div class="half"><div class="def-editable" contenteditable="true"></div></div><div class="half"><div class="def-editable" contenteditable="true"></div></div>`;
      const halves = el.querySelectorAll(".half");
      const editables = el.querySelectorAll(".def-editable");
      editables[0].innerText = cell.top.definition;
      editables[1].innerText = cell.bottom.definition;

      editables[0].addEventListener("focus", () => { currentInputDir = topDir; selectCellSilently(index); const sideInput = document.getElementById("topDefinitionInput"); if (sideInput) sideInput.value = cell.top.definition; });
      editables[1].addEventListener("focus", () => { currentInputDir = botDir; selectCellSilently(index); const sideInput = document.getElementById("bottomDefinitionInput"); if (sideInput) sideInput.value = cell.bottom.definition; });

      editables[0].addEventListener("input", e => { cell.top.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("topDefinitionInput"); if (sideInput) sideInput.value = cell.top.definition; markAsDirty(); persistSession(); });
      editables[1].addEventListener("input", e => { cell.bottom.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("bottomDefinitionInput"); if (sideInput) sideInput.value = cell.bottom.definition; markAsDirty(); persistSession(); });

      const svgTop = createArrowElement(topDir, "top"); if (svgTop) halves[0].appendChild(svgTop);
      const svgBottom = createArrowElement(botDir, "bottom"); if (svgBottom) halves[1].appendChild(svgBottom);
    }

    el.dataset.index = index;
    el.addEventListener("click", () => {
      if (cell.type !== "double" && cell.type !== "definition" && cell.type !== "letter") {
        selectCell(index);
      }
    });
    grid.appendChild(el);
  });

  updatePanel();
  updatePlacedWordsList();
  markAsDirty();
  persistSession();
}

function createArrowElement(dir, zone) {
  const img = document.createElement("img");
  img.className = "arrow-svg";
  img.draggable = false;
  img.setAttribute("alt", "flèche");

  if (zone === "full") {
    if (dir === "S") {
      img.src = "./media/arrows/common-def-down-arrow.svg";
      img.classList.add("arrow-common-down", "arrow-full-down");
    } else {
      img.src = "./media/arrows/common-def-right-arrow.svg";
      img.classList.add("arrow-common-right", "arrow-full-right");
    }
  } else if (zone === "top") {
    img.classList.add("arrow-top");
    if (dir === "S") {
      img.src = "./media/arrows/top-def-down-arrow.svg";
      img.classList.add("arrow-top-down");
    } else {
      img.src = "./media/arrows/common-def-right-arrow.svg";
      img.classList.add("arrow-common-right", "arrow-top-right");
    }
  } else if (zone === "bottom") {
    img.classList.add("arrow-bottom");
    if (dir === "E") {
      img.src = "./media/arrows/bottom-def-right-arrow.svg";
      img.classList.add("arrow-bottom-right");
    } else {
      img.src = "./media/arrows/common-def-down-arrow.svg";
      img.classList.add("arrow-common-down", "arrow-bottom-down");
    }
  }
  return img;
}

function createArrowSVG(dir, zone) {
  return createArrowElement(dir, zone);
}

function updatePanel() {
  document.querySelectorAll(".type-buttons button").forEach(btn => {
    btn.classList.toggle("active", selected !== null && btn.dataset.type === cells[selected].type);
  });
  const info = document.getElementById("selectedInfo");
  const single = document.getElementById("singleDefControls");
  const dbl = document.getElementById("doubleDefControls");
  const wordContainer = document.getElementById("wordFormedContainer");

  if (selected === null) {
    info.textContent = "Cliquez sur une case de la grille.";
    single.style.display = "none";
    dbl.style.display = "none";
    wordContainer.innerHTML = "";
    return;
  }

  const row = Math.floor(selected / COLS) + 1;
  const col = selected % COLS + 1;
  info.textContent = `Case : colonne ${col}, ligne ${row}`;
  const cell = cells[selected];
  single.style.display = cell.type === "definition" ? "block" : "none";
  dbl.style.display = cell.type === "double" ? "block" : "none";
  wordContainer.innerHTML = "";

  if (cell.type === "definition") {
    document.getElementById("definitionInput").value = cell.definition;
    document.getElementById("btnArrowE").classList.toggle("active", cell.arrow === "E");
    document.getElementById("btnArrowS").classList.toggle("active", cell.arrow === "S");
    const data = getWordData(selected, cell.arrow);
    renderWordBox(wordContainer, "Mot formé", data.word, data.indexes, "word-def", cell.arrow);
  }

  if (cell.type === "double") {
    const topDir = (cell.top && cell.top.arrow) || "E";
    const botDir = (cell.bottom && cell.bottom.arrow) || "S";
    document.getElementById("topDefinitionInput").value = cell.top.definition;
    document.getElementById("bottomDefinitionInput").value = cell.bottom.definition;

    const btnTopE = document.getElementById("btnTopArrowE");
    const btnTopS = document.getElementById("btnTopArrowS");
    if (btnTopE) btnTopE.classList.toggle("active", topDir === "E");
    if (btnTopS) btnTopS.classList.toggle("active", topDir === "S");

    const btnBotE = document.getElementById("btnBottomArrowE");
    const btnBotS = document.getElementById("btnBottomArrowS");
    if (btnBotE) btnBotE.classList.toggle("active", botDir === "E");
    if (btnBotS) btnBotS.classList.toggle("active", botDir === "S");

    const topIcon = document.getElementById("topDefArrowIcon");
    if (topIcon) topIcon.textContent = topDir === "E" ? "arrow_right_alt" : "south";
    const botIcon = document.getElementById("bottomDefArrowIcon");
    if (botIcon) botIcon.textContent = botDir === "E" ? "arrow_right_alt" : "south";

    const dataTop = getWordData(selected, topDir);
    const dataBot = getWordData(selected, botDir);
    renderWordBox(wordContainer, "Mot du haut", dataTop.word, dataTop.indexes, "word-top", topDir);
    renderWordBox(wordContainer, "Mot du bas", dataBot.word, dataBot.indexes, "word-bot", botDir);
  }

  if (cell.type === "letter") {
    const parent = findParentWordForLetter(selected, currentInputDir);
    if (parent) renderWordBox(wordContainer, "Mot associé", parent.data.word, parent.data.indexes, "word-letter", parent.dir);
  }
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
      const topDir = (cell.top && cell.top.arrow) || "E";
      const botDir = (cell.bottom && cell.bottom.arrow) || "S";
      const dataTop = getWordData(idx, topDir); if (dataTop.indexes.length >= 2 && dataTop.word && !dataTop.word.includes("_")) foundWordsMap.set(dataTop.indexes.join(","), { text: dataTop.word, indexes: dataTop.indexes });
      const dataBot = getWordData(idx, botDir); if (dataBot.indexes.length >= 2 && dataBot.word && !dataBot.word.includes("_")) foundWordsMap.set(dataBot.indexes.join(","), { text: dataBot.word, indexes: dataBot.indexes });
    }
  });

  const wordsArray = Array.from(foundWordsMap.values());
  const { duplicateWordStrings } = findDuplicateWords();

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
      wordEl.addEventListener("mouseenter", () => { hoveredWordIndexes = item.indexes; updateHighlights(); });
      wordEl.addEventListener("mouseleave", () => { hoveredWordIndexes = []; updateHighlights(); });
      wordEl.addEventListener("click", () => { if (item.indexes.length > 0) selectCellAndFocus(item.indexes[0]); });
      groupDiv.appendChild(wordEl);
    });
    wordsListEl.appendChild(groupDiv);
  });
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

  const correctBtn = document.createElement("button");
  correctBtn.className = "word-action-btn";
  correctBtn.innerHTML = `<span class="material-symbols-outlined">spellcheck</span> Corriger l'orthographe`;
  correctBtn.onclick = () => fetchSpellCorrection(word, indexes, `${idPrefix}-correct`);
  box.appendChild(correctBtn);

  const correctList = document.createElement("div");
  correctList.id = `${idPrefix}-correct`;
  correctList.className = "suggestions-list";
  box.appendChild(correctList);

  const sugBtn = document.createElement("button");
  sugBtn.className = "word-action-btn";
  sugBtn.innerHTML = `<span class="material-symbols-outlined">list_alt</span> Suggérer (Même motif)`;
  sugBtn.onclick = () => fetchPatternSuggestions(word, indexes, `${idPrefix}-sug`);
  box.appendChild(sugBtn);

  const sugList = document.createElement("div");
  sugList.id = `${idPrefix}-sug`;
  sugList.className = "suggestions-list";
  box.appendChild(sugList);

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


/* ===================================================================== */
/* 6. ÉDITION DES CELLULES ET MODIFICATIONS                              */
/* ===================================================================== */
function createDefaultGridCells(cols, rows) {
  let newCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let cell = emptyCell();

      if ((r === 0 && c % 2 === 0) || (c === 0 && r % 2 === 0)) {
        cell.type = "double";

        if (r === 0 && c === 0) {
          cell.bottom.arrow = "E";
        } else if (r === 0) {
          cell.top.arrow = "S";
        } else if (c === 0) {
          cell.bottom.arrow = "E";
        }
      }
      newCells.push(cell);
    }
  }
  return newCells;
}

function setType(type) {
  if (selected === null || selected === undefined || Number.isNaN(Number(selected))) {
    showCustomAlert("Sélectionnez d'abord une case.");
    return;
  }
  selected = Number(selected);
  cells[selected].type = type;
  if (type === "double") {
    if (!cells[selected].top) cells[selected].top = { definition: "", arrow: "E" };
    if (!cells[selected].bottom) cells[selected].bottom = { definition: "", arrow: "S" };
    if (!cells[selected].top.arrow) cells[selected].top.arrow = "E";
    if (!cells[selected].bottom.arrow) cells[selected].bottom.arrow = "S";
  }
  render();
  if (type === "definition") focusDefinitionCell(selected);
  else if (type === "double") focusDoubleDefinitionCell(selected);
  else if (type === "letter") selectCellAndFocus(selected);
}

function setHalfArrow(which, dir) {
  if (selected === null) return;
  const cell = cells[selected];
  if (cell.type === "double") {
    if (!cell[which]) cell[which] = { definition: "", arrow: dir };
    else cell[which].arrow = dir;
    render();
    persistSession();
  }
}

function focusDefinitionCell(index) {
  setTimeout(() => {
    const grid = document.getElementById("grid");
    const cellEl = grid.children[index];
    if (cellEl) {
      const defEditable = cellEl.querySelector(".def-content");
      if (defEditable) {
        defEditable.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(defEditable);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, 10);
}

function focusDoubleDefinitionCell(index) {
  setTimeout(() => {
    const grid = document.getElementById("grid");
    const cellEl = grid.children[index];
    if (cellEl) {
      const firstEditable = cellEl.querySelector(".def-editable");
      if (firstEditable) firstEditable.focus();
    }
  }, 10);
}

function fillWordInGrid(word, indexes) {
  for (let i = 0; i < indexes.length; i++) {
    if (i < word.length) cells[indexes[i]].letter = word[i];
  }
  markAsDirty()
  render();
}

function updateDefinition(value) {
  if (selected !== null) {
    cells[selected].definition = value.toUpperCase();
    const grid = document.getElementById("grid");
    if (grid.children[selected]) {
      const def = grid.children[selected].querySelector(".def-content");
      if (def && def !== document.activeElement) def.innerText = cells[selected].definition;
    }
    persistSession();
  }
}

function getCellRowCol(index) {
  return {
    row: Math.floor(index / COLS),
    col: index % COLS
  };
}

function setCellType(type) {
  if (selected === null) return;
  const cell = cells[selected];
  cell.type = type;

  if (type === "double" || type === "definition") {
    const { row, col } = getCellRowCol(selected);
    if (row === 0) {
      cell.arrow = "S";
    } else if (col === 0) {
      cell.arrow = "E";
    } else if (!cell.arrow) {
      cell.arrow = "E";
    }
  }
  render();
  markAsDirty()
  persistSession();
}

function setArrow(dir) {
  if (selected === null) return;
  const cell = cells[selected];
  if (cell.type === "definition") {
    const { row, col } = getCellRowCol(selected);
    if (row === 0) {
      cell.arrow = "S";
    } else if (col === 0) {
      cell.arrow = "E";
    } else {
      cell.arrow = dir;
    }
    render();
    persistSession();
  }
}

function updateHalfDefinition(which, value) {
  if (selected !== null && cells[selected].type === "double") {
    cells[selected][which].definition = value.toUpperCase();
    const grid = document.getElementById("grid");
    if (grid.children[selected]) {
      const editables = grid.children[selected].querySelectorAll(".def-editable");
      const idx = which === "top" ? 0 : 1;
      if (editables[idx] && editables[idx] !== document.activeElement) editables[idx].innerText = cells[selected][which].definition;
    }
    persistSession();
  }
}

function clearCell() {
  if (selected === null) return;
  cells[selected] = emptyCell();
  markAsDirty()
  render();
}


/* ===================================================================== */
/* 7. API EXTERNES ET DICTIONNAIRES (WIKTIONAIRE)                         */
/* ===================================================================== */

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
    const searchUrl = `https://fr.wiktionary.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanWord)}&limit=20&format=json&origin=*`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
    const data = await res.json();
    const suggestions = data[1] || [];

    container.innerHTML = "";

    const validCorrections = suggestions.filter(w => /^[a-zA-Zà-ÿÀ-Ÿ-]+$/.test(w) && w.length === indexes.length);

    if (validCorrections.length === 0) {
      container.innerHTML = "<span style='font-size:11px;color:#888'>Aucune correction évidente trouvée.</span>";
      return;
    }

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

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    let synonymsList = [];

    const synonymHeadings = Array.from(doc.querySelectorAll('h3, h4, h5')).filter(h =>
      h.textContent.toLowerCase().includes('synonyme')
    );

    synonymHeadings.forEach(heading => {
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

    synonymsList.slice(0, 5).forEach(item => {
      const tag = document.createElement("span");
      tag.className = "suggestion-tag";
      const wUpper = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      tag.textContent = wUpper;
      tag.onclick = () => {
        console.log("Synonyme sélectionné :", wUpper);
      };

      container.appendChild(tag);
    });

  } catch (e) {
    console.error(e);
    container.innerHTML = "<span style='font-size:11px;color:#d32f2f'>Erreur lors de la recherche des synonymes.</span>";
  }
}

async function fetchPatternSuggestions(word, indexes, resultContainerId) {
  const container = document.getElementById(resultContainerId);
  if (!container) return;
  container.innerHTML = "<span style='font-size:11px;color:#666'>Recherche des mots correspondants...</span>";

  const cleanWord = word.trim().toLowerCase();

  try {
    const regexPattern = "^" + cleanWord.replace(/[_?]/g, ".") + "$";
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
    const apiUrl = `https://fr.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(cleanWord)}&prop=text&format=json&origin=*`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);

    const data = await res.json();
    const htmlContent = data?.parse?.text?.["*"];

    if (!htmlContent) {
      container.innerHTML = "<span style='color:#888;'>Mot introuvable dans le Wiktionnaire.</span>";
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    const items = doc.querySelectorAll('.mw-parser-output > ol > li, .mw-parser-output > p + ol > li, .mw-parser-output dl dd');

    let definitions = [];
    items.forEach(li => {
      const text = li.textContent.trim();
      if (text && text.length > 3 && !definitions.includes(text)) {
        definitions.push(text);
      }
    });

    if (definitions.length > 0) {
      let html = `<strong>${word.toUpperCase()}</strong> (Wiktionnaire) :<ul style="margin:4px 0 0 14px; padding:0;">`;
      definitions.slice(0, 3).forEach(d => {
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


/* ===================================================================== */
/* 8. PERSISTANCE, CLOUD ET GESTION DES GRILLES                          */
/* ===================================================================== */

function persistSession() {
  if (sessionRestorePending) return;
  try {
    localStorage.setItem("motsFlechesLastSession", JSON.stringify({
      name: currentGridName, cols: COLS, rows: ROWS, cells: cells
    }));
  } catch (e) { }
}

async function getSavedGrids() {
  try {
    showApiLoader()

    const response = await fetch('./api/grids', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await response.json();

    hideApiLoader()

    if (data.success && data.grids) {
      const gridsMap = {};
      data.grids.forEach(grid => {
        const rawContent = grid.content || grid.grid_data;
        let gridContent = typeof rawContent === 'string'
          ? JSON.parse(rawContent)
          : rawContent;

        let finalCols = grid.cols !== undefined ? parseInt(grid.cols, 10) : (gridContent.cols || 13);
        let finalRows = grid.rows !== undefined ? parseInt(grid.rows, 10) : (gridContent.rows || 18);
        let finalCells = Array.isArray(gridContent) ? gridContent : (gridContent.cells || gridContent);

        gridsMap[grid.name] = {
          id: grid.id,
          cols: finalCols,
          rows: finalRows,
          cells: finalCells,
          updated_at: grid.updated_at
        };
      });
      return gridsMap;
    }
  } catch (err) {
    console.error("Erreur lors du chargement des grilles depuis le cloud :", err);
  }
  return {};
}

async function directSaveGrid() {
  const payload = {
    id: currentGridId,
    name: currentGridName,
    cols: COLS,
    rows: ROWS,
    version: 2,
    content: cells
  };

  saveGridToCloud(payload);
  updateGridDisplay();
}

function saveGridToCloud(gridData) {
  const payload = {
    id: currentGridId,
    name: currentGridName,
    cols: COLS,
    rows: ROWS,
    version: gridData.version || 2,
    content: gridData.cells || cells
  };

  const method = currentGridId ? 'PUT' : 'POST';
  const url = currentGridId ? `./api/grids/${currentGridId}` : './api/grids';

  showApiLoader()

  fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then(data => {

      hideApiLoader()
      if (data.success) {
        markAsClean()
        if (data.id) {
          currentGridId = data.id;
        }
        console.log("Grille sauvegardée dans le cloud avec succès !");
      } else {
        showCustomAlert("Erreur : " + (data.error || "Impossible de sauvegarder la grille."));
      }
    })
    .catch(error => {
      console.error("Erreur réseau :", error);
      hideApiLoader()
    });
}

async function deleteSavedGrid(name, gridId) {
  const confirmed = await showCustomConfirm(`Supprimer la grille "${name}" du cloud ?`);
  if (!confirmed) return;

  try {
    showApiLoader();

    const response = await fetch(`./api/grids/${gridId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const rawText = await response.text();

    hideApiLoader()

    let data;

    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("Réponse serveur invalide (non-JSON) :", rawText);
      showCustomAlert("Erreur serveur : Le script PHP a renvoyé du code HTML ou une erreur.");
      return;
    }

    if (data.success) {
      openLoadModal();
    } else {
      showCustomAlert(data.error || "Erreur lors de la suppression.");
    }
  } catch (err) {
    console.error("Erreur réseau :", err);
    showCustomAlert("Impossible de contacter le serveur pour la suppression.");
  }
}

async function checkPreviousSession() {
  try {
    const savedGrids = await getSavedGrids();
    const gridEntries = Object.entries(savedGrids);

    if (gridEntries.length === 0) return;

    gridEntries.sort((a, b) => {
      return new Date(b[1].updated_at) - new Date(a[1].updated_at);
    });

    const [lastName, lastGridData] = gridEntries[0];

    if (!lastGridData || !lastGridData.cells || lastGridData.cells.length === 0) return;

    sessionRestorePending = true;
    pendingSessionData = {
      name: lastName,
      cols: lastGridData.cols || 13,
      rows: lastGridData.rows || 18,
      cells: lastGridData.cells,
      id: lastGridData.id || null
    };

    const modal = document.getElementById("restoreModal");
    if (modal) modal.classList.add("active");

  } catch (e) {
    console.error("Erreur lors de la vérification des sessions cloud :", e);
  }
}

function restorePreviousSession() {
  if (pendingSessionData) {
    COLS = pendingSessionData.cols || 13;
    ROWS = pendingSessionData.rows || 18;
    cells = pendingSessionData.cells;
    currentGridName = pendingSessionData.name || "Ma Grille";
    currentGridId = pendingSessionData.id || null;
  }
  sessionRestorePending = false;
  pendingSessionData = null;
  openedFromStartup = false; // Sortie du parcours de démarrage
  selected = null;

  updateGridDisplay();

  if (typeof updateGridGeometry === 'function') {
    updateGridGeometry();
  }

  markAsClean()

  closeRestoreModal();
}

function discardPreviousSession() {
  sessionRestorePending = false;
  pendingSessionData = null;
  openedFromStartup = true; // Provenance du démarrage
  closeRestoreModal();
  persistSession();
  newGrid();
}

function openSession() {
  openedFromStartup = true; // Provenance du démarrage
  openLoadModal();
  closeRestoreModal();
}

function newGrid() {
  isCreatingNewGrid = true;
  document.getElementById('settingsModalTitle').textContent = "Créer une nouvelle grille";
  document.getElementById('settingName').value = "Ma Nouvelle Grille";
  document.getElementById('settingCols').value = 13;
  document.getElementById('settingRows').value = 18;
  document.getElementById('settingsModal').classList.add('active');
}

async function clearGrid() {
  const confirmed = await showCustomConfirm("Voulez-vous vraiment vider toute la grille ?");
  if (confirmed) {
    executeClearGrid();
  }
}

function executeClearGrid() {
  cells = createDefaultGridCells(COLS, ROWS); selected = null;
  render();
  markAsDirty()
  closeClearModal();
}

async function loadSelectedGrid(name) {
  const savedGrids = await getSavedGrids();
  const data = savedGrids[name];

  if (data) {
    if (Array.isArray(data)) {
      COLS = 13;
      ROWS = 18;
      cells = data;
      currentGridId = null;
    } else {
      COLS = data.cols;
      ROWS = data.rows;
      cells = data.cells;
      currentGridId = data.id || null;
    }

    currentGridName = name;
    selected = null;
    openedFromStartup = false; // Grille chargée avec succès

    updateGridDisplay();

    if (typeof updateGridGeometry === 'function') {
      updateGridGeometry();
    }
    markAsClean()
    closeLoadModal();
  }
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
        ROWS = data.rows || 18;
        currentGridName = data.name || file.name.replace(".json", "");
      } else if (Array.isArray(data)) {
        cells = data; COLS = 13; ROWS = 18;
        currentGridName = file.name.replace(".json", "");
      }
      selected = null;
      openedFromStartup = false;
      updateGridDisplay();
    } catch (err) {
      showCustomAlert("Fichier JSON invalide.");
    }
  };
  reader.readAsText(file);
}


/* ===================================================================== */
/* 9. AUTHENTIFICATION UTILISATEUR                                       */
/* ===================================================================== */

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

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  errorDiv.textContent = '';

  try {
    showApiLoader()

    const response = await fetch('./api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();

    hideApiLoader()

    if (data.success) {
      document.getElementById('authModal').style.display = 'none';
      checkUserSession();
    } else {
      errorDiv.textContent = data.error || 'Erreur de connexion';
    }
  } catch (err) {
    errorDiv.textContent = 'Impossible de contacter le serveur.';
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const first_name = document.getElementById('regFirstName').value;
  const last_name = document.getElementById('regLastName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const errorDiv = document.getElementById('registerError');
  errorDiv.textContent = '';

  try {
    showApiLoader()

    const response = await fetch('./api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ first_name, last_name, email, password })
    });
    const data = await response.json();

    hideApiLoader()

    if (data.success) {
      document.getElementById('authModal').style.display = 'none';
      checkUserSession();
    } else {
      errorDiv.textContent = data.error || 'Erreur lors de l\'inscription';
    }
  } catch (err) {
    errorDiv.textContent = 'Impossible de contacter le serveur.';
  }
}

async function handleLogout() {
  try {
    await fetch('./api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    location.reload();
  } catch (err) {
    console.error('Erreur lors de la déconnexion');
  }
}

async function checkUserSession() {
  try {
    showApiLoader()

    const response = await fetch('./api/user', {
      method: 'GET',
      credentials: 'include'
    });

    if (response.status === 401) {
      document.getElementById('authModal').classList.add('active');
      document.getElementById('userMenuContainer').style.display = 'none';
      return;
    }

    const data = await response.json();

    hideApiLoader()

    if (data.success && data.user) {
      USER = data.user;
      document.getElementById('authModal').classList.remove('active');
      document.getElementById('userMenuContainer').style.display = 'block';
    }
  } catch (err) {
    console.error("Erreur lors de la vérification de session :", err);
  }
}


/* ===================================================================== */
/* 10. THÈMES ET PRÉFÉRENCES                                            */
/* ===================================================================== */

async function applyStoredTheme() {
  try {
    showApiLoader()

    const response = await fetch('./api/user/preferences', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) return;

    const data = await response.json();

    hideApiLoader()

    if (data.success && data.preferences) {
      const theme = data.preferences.theme || 'light';
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle("dark-theme", theme === "dark");
    }
  } catch (error) {
    console.error('Erreur réseau :', error);
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
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

function toggleThemeMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById("themeMenu");
  if (menu) menu.classList.toggle("active");
  updateThemeMenuUI();
}

async function changeUserTheme(newTheme) {
  try {
    showApiLoader()

    const response = await fetch('./api/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
      credentials: 'include'
    });

    if (!response.ok) {
      console.error('Erreur HTTP :', response.status);
      return;
    }

    const data = await response.json();

    hideApiLoader()

    if (data.success) {
      document.documentElement.setAttribute('data-theme', data.theme);
    } else {
      console.warn('Impossible de sauvegarder le thème :', data.error);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du thème :', error);
  }
}


/* ===================================================================== */
/* 11. MODALS, PARAMÈTRES ET NAVIGATION MOBILE                           */
/* ===================================================================== */

function openSettingsModal() {
  isCreatingNewGrid = false;
  document.getElementById('settingsModalTitle').textContent = "Paramètres de la grille";
  document.getElementById('settingName').value = currentGridName;
  document.getElementById('settingCols').value = COLS;
  document.getElementById('settingRows').value = ROWS;
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.remove("active");

  // Si on venait du démarrage (création annulée), on réaffiche le modal restoreModal
  if (openedFromStartup) {
    const restoreModal = document.getElementById("restoreModal");
    if (restoreModal) {
      restoreModal.classList.add("active");
    }
    openedFromStartup = false;
  }
}

function closeSettingsModalOnOverlay(event) {
  //if (event.target.id === "settingsModal") closeSettingsModal();
}

async function applySettings() {
  const nameInput = document.getElementById('settingName');
  const colsInput = document.getElementById('settingCols');
  const rowsInput = document.getElementById('settingRows');

  const newName = nameInput ? nameInput.value.trim() : currentGridName;
  if (!newName) {
    showCustomAlert("Veuillez entrer un nom valide pour la grille.");
    return;
  }

  const newCols = colsInput ? parseInt(colsInput.value, 10) : COLS;
  const newRows = rowsInput ? parseInt(rowsInput.value, 10) : ROWS;

  try {
    const savedGrids = await getSavedGrids();
    if (savedGrids.hasOwnProperty(newName)) {
      const existingGrid = savedGrids[newName];
      if (isCreatingNewGrid || !currentGridId || existingGrid.id !== currentGridId) {
        const overwrite = await showCustomConfirm(`Une grille portant le nom "${newName}" existe déjà dans le cloud. Voulez-vous l'écraser ?`);
        if (!overwrite) {
          return;
        } else {
          currentGridId = existingGrid.id;
          isCreatingNewGrid = false;
        }
      }
    }
  } catch (err) {
    console.error("Erreur lors de la vérification des doublons :", err);
  }

  if (isCreatingNewGrid) {
    currentGridId = null;
    currentGridName = newName;
    COLS = newCols;
    ROWS = newRows;
    cells = createDefaultGridCells(COLS, ROWS);
    selected = null;
    markAsClean();
  } else {
    currentGridName = newName;

    if (newCols !== COLS || newRows !== ROWS) {
      COLS = newCols;
      ROWS = newRows;
      if (typeof emptyCell === 'function') {
        cells = createDefaultGridCells(COLS, ROWS);
      }
      selected = null;
    }
    markAsDirty();
  }

  const method = currentGridId ? 'PUT' : 'POST';
  const url = currentGridId ? `./api/grids/${currentGridId}` : './api/grids';

  try {
    if (typeof showApiLoader === 'function') {
      showApiLoader();
    }

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: currentGridName,
        cols: COLS,
        rows: ROWS,
        version: 2,
        content: cells
      })
    });

    const data = await response.json();

    if (typeof hideApiLoader === 'function') {
      hideApiLoader();
    }

    if (data.success) {
      if (data.id) {
        currentGridId = data.id;
      }
      if (isCreatingNewGrid) {
        isCreatingNewGrid = false;
      }
      openedFromStartup = false; // Validation réussie, on sort du parcours de démarrage
    } else {
      const errorMsg = "Erreur lors de l'enregistrement des paramètres : " + (data.error || "Erreur inconnue");
      showCustomAlert(errorMsg);
      return;
    }
  } catch (err) {
    console.error("Erreur réseau :", err);
    if (typeof hideApiLoader === 'function') {
      hideApiLoader();
    }
    showCustomAlert("Impossible de contacter le serveur.");
    return;
  }

  if (typeof updateGridDisplay === 'function') {
    updateGridDisplay();
  }
  if (typeof closeSettingsModal === 'function') {
    closeSettingsModal();
  }
}

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
  //if (event.target.id === "saveModal") closeSaveModal();
}

async function confirmSave(destination) {
  let targetName = currentGridName;

  if (isSaveAsMode) {
    const newName = document.getElementById("saveAsNameInput").value.trim();
    if (!newName) {
      showCustomAlert("Veuillez entrer un nom valide.");
      return;
    }
    targetName = newName;
    currentGridId = null;
  }

  if (destination === "cloud") {
    const savedGrids = await getSavedGrids();

    if (savedGrids.hasOwnProperty(targetName) && (isSaveAsMode || targetName !== currentGridName)) {
      const overwrite = await showCustomConfirm(`Une grille portant le nom "${targetName}" existe déjà dans le cloud. Voulez-vous l'écraser ?`);
      if (!overwrite) {
        return;
      }
    }

    currentGridName = targetName;

    const payload = {
      id: currentGridId,
      name: currentGridName,
      cols: COLS,
      rows: ROWS,
      version: 2,
      content: cells
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
      
      const isOpen = (name === currentGridName) || (gridId && currentGridId && gridId === currentGridId);

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
        nameSpan.onclick = () => loadSelectedGrid(name);
      }

      const delBtn = document.createElement("button");
      delBtn.className = "grid-item-delete";
      delBtn.title = isOpen ? "Impossible de supprimer la grille ouverte" : "Supprimer";
      delBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">delete</span>`;

      if (isOpen) {
        delBtn.disabled = true;
        delBtn.style.cursor = "not-allowed";
        delBtn.style.pointerEvents = "none";
      } else {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          deleteSavedGrid(name, gridId);
        };
      }

      row.appendChild(nameSpan);
      row.appendChild(delBtn);
      body.appendChild(row);
    });
  }
  modal.classList.add("active");
}

function closeLoadModal() {
  document.getElementById("loadModal").classList.remove("active");

  // Si on venait du démarrage sans charger de grille, on réaffiche restoreModal
  if (openedFromStartup) {
    const restoreModal = document.getElementById("restoreModal");
    if (restoreModal) {
      restoreModal.classList.add("active");
    }
    openedFromStartup = false;
  }
}

function closeLoadModalOnOverlay(event) {
  //if (event.target.id === "loadModal") closeLoadModal();
}

function closeClearModal() {
  const modal = document.getElementById("clearGridModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

function closeClearModalOnOverlay(event) {
  /* if (event.target.id === "clearGridModal") {
    closeClearModal();
  } */
}

function openThemeModal() {
  const modal = document.getElementById("themeModal");
  if (modal) modal.classList.add("active");
}

function closeThemeModal() {
  const modal = document.getElementById("themeModal");
  if (modal) modal.classList.remove("active");
}

function closeThemeModalOnOverlay(event) {
  //if (event.target.id === "themeModal") closeThemeModal();
}

function selectThemeAndClose(themeName) {
  setTheme(themeName);
  closeThemeModal();
}

function openUserModal() {
  const modal = document.getElementById("userModal");
  if (modal) {
    modal.classList.add("active");

    const emailModalDisplay = document.getElementById("userEmailModalDisplay");
    if (emailModalDisplay) {
      emailModalDisplay.textContent = USER.email;
    }

    const firstName = USER.first_name || '';
    const lastName = USER.last_name || '';
    const fullName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : "Utilisateur";

    const nameModalDisplay = document.getElementById("userNameModalDisplay");
    if (nameModalDisplay) {
      nameModalDisplay.textContent = fullName;
    }

    // Gestion de l'avatar Google-like
    const avatarDisplay = document.getElementById("userAvatarDisplay");
    if (avatarDisplay) {
      // 1. Calcul des initiales (ex: "Jean Dupont" -> "JD")
      let initials = "";
      if (firstName) initials += firstName.charAt(0);
      if (lastName) initials += lastName.charAt(0);
      
      if (!initials && USER.email) {
        initials = USER.email.charAt(0);
      }
      initials = (initials || "U").toUpperCase();
      avatarDisplay.textContent = initials;

      // 2. Attribution d'une couleur de fond stable basée sur le nom ou l'email
      const colors = [
        '#1976d2', '#d32f2f', '#388e3c', '#f57c00', 
        '#7b1fa1', '#0097a7', '#c2185b', '#5d4037'
      ];
      let hash = 0;
      const str = USER.email || fullName;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const colorIndex = Math.abs(hash) % colors.length;
      avatarDisplay.style.backgroundColor = colors[colorIndex];
    }
  }
}

function closeUserModal() {
  const modal = document.getElementById("userModal");
  if (modal) modal.classList.remove("active");
}

function closeUserModalOnOverlay(event) {
  //if (event.target.id === "userModal") closeUserModal();
}

function openHelpModal() {
  document.getElementById("helpModal").classList.add("active");
}

function closeHelpModal() {
  document.getElementById("helpModal").classList.remove("active");
}

function closeHelpModalOnOverlay(event) {
  //if (event.target.id === "helpModal") closeHelpModal();
}

function closeRestoreModal() {
  const modal = document.getElementById("restoreModal");
  if (modal) modal.classList.remove("active");
}

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

function showApiLoader() {
  const loader = document.getElementById("apiLoader");
  if (loader) loader.classList.add("active");
}

function hideApiLoader() {
  const loader = document.getElementById("apiLoader");
  if (loader) loader.classList.remove("active");
}

function showCustomAlert(message) {
  let alertModal = document.getElementById('customAlertModal');

  if (!alertModal) {
    alertModal = document.createElement('div');
    alertModal.id = 'customAlertModal';
    alertModal.className = 'modal-overlay';

    alertModal.innerHTML = `
      <div class="modal-card" style="padding: 24px; display: flex; flex-direction: column; gap: 16px; min-width: 320px; max-width: 400px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: #1a1a1a;">Information</h3>
        <p id="customAlertMessage" style="margin: 0; font-size: 0.95rem; color: #4a4a4a; line-height: 1.5;"></p>
        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <button type="button" class="btn-primary" onclick="closeCustomAlert()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; width: 100%;">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(alertModal);
  }

  document.getElementById('customAlertMessage').textContent = message;
  alertModal.style.display = 'flex';
  alertModal.style.justifyContent = 'center';
  alertModal.style.alignItems = 'center';
  alertModal.style.position = 'fixed';
  alertModal.style.top = '0';
  alertModal.style.left = '0';
  alertModal.style.width = '100%';
  alertModal.style.height = '100%';
  alertModal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  alertModal.style.zIndex = '9999';
}

function closeCustomAlert() {
  const alertModal = document.getElementById('customAlertModal');
  if (alertModal) {
    alertModal.style.display = 'none';
  }
}

function showCustomConfirm(message) {
  return new Promise((resolve) => {
    let confirmModal = document.getElementById('customConfirmModal');

    if (!confirmModal) {
      confirmModal = document.createElement('div');
      confirmModal.id = 'customConfirmModal';
      confirmModal.className = 'modal-overlay';

      confirmModal.innerHTML = `
        <div class="modal-card" style="padding: 24px; display: flex; flex-direction: column; gap: 16px; min-width: 320px; max-width: 400px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
          <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: #1a1a1a;">Confirmation</h3>
          <p id="customConfirmMessage" style="margin: 0; font-size: 0.95rem; color: #4a4a4a; line-height: 1.5;"></p>
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
            <button type="button" id="customConfirmCancelBtn" class="btn-danger" style="padding: 10px 20px; font-weight: 500; cursor: pointer; transition: background-color 0.2s ease;">Annuler</button>
            <button type="button" id="customConfirmOkBtn" class="btn-primary" style="padding: 10px 20px;font-weight: 500; cursor: pointer; transition: background-color 0.2s ease;">Confirmer</button>
          </div>
        </div>
      `;
      document.body.appendChild(confirmModal);
    }

    document.getElementById('customConfirmMessage').textContent = message;

    const okBtn = document.getElementById('customConfirmOkBtn');
    const cancelBtn = document.getElementById('customConfirmCancelBtn');

    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

 

    newOkBtn.addEventListener('click', () => {
      closeCustomConfirm();
      resolve(true);
    });

    newCancelBtn.addEventListener('click', () => {
      closeCustomConfirm();
      resolve(false);
    });

    requestAnimationFrame(() => {
      confirmModal.classList.add('active');
    });
  });
}

function closeCustomConfirm() {
  const confirmModal = document.getElementById('customConfirmModal');
  if (confirmModal) {
    confirmModal.classList.remove('active');
  }
}

function updateSaveBadge() {
  const saveBtn = document.getElementById('saveBtn');
  if (!saveBtn) return;

  let badge = saveBtn.querySelector('.unsaved-badge');
  if (hasUnsavedChanges) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'unsaved-badge';
      badge.style.position = 'absolute';
      badge.style.top = '4px';
      badge.style.right = '4px';
      badge.style.width = '8px';
      badge.style.height = '8px';
      badge.style.backgroundColor = '#f97316';
      badge.style.borderRadius = '50%';
      saveBtn.style.position = 'relative';
      saveBtn.appendChild(badge);
    }
  } else {
    if (badge) {
      badge.remove();
    }
  }
}

function markAsDirty() {
  if (!hasUnsavedChanges) {
    hasUnsavedChanges = true;
    updateSaveBadge();
  }
}

function markAsClean() {
  if (hasUnsavedChanges) {
    hasUnsavedChanges = false;
    updateSaveBadge();
  }
}