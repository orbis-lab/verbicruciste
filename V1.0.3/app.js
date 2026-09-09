import API from "./api.js"

import Header from "./components/header/component.js";
import MobileSectionNav from "./components/mobile-section-nav/component.js";
import ZoomControls from "./components/zoom-controls/component.js";
import InteractiveScreen from "./components/interactive-screen/component.js";

class App {
  constructor() {
    window.API = new API();

    /* ===================================================================== */
    /* 1. ÉTAT GLOBAL DE L'APPLICATION ET CONSTANTES                      */
    /* ===================================================================== */
    this.state = {
      user: {
        profile: {},
        sessionData: {}
      },
      grid: {
        id: null,
        name: "Ma Grille",
        cols: 13,
        rows: 17,
        cells: [],
        isCreatingNewGrid: false,
        sessionRestorePending: false,
        pendingSessionData: null,
        mysteryWordConfig: {
          length: 9
        }
      },
      navigation: {
        selected: null,
        activeWordTarget: null,
        hoveredWordIndexes: [],
        currentInputDir: "E",
        currentDoubleHalf: null
      },
      view: {
        panzoomInstance: null,
        autoFitZoomFactor: 0.93,
        scale: 0.8,
        pointX: 50,
        pointY: 40,
        isPanning: false,
        startX: 0,
        startY: 0,
        hasMoved: false,
        clickStartX: 0,
        clickStartY: 0,
        initialTouchDistance: null,
        setTransform: null,
        dir_offset: {
          S: { r: 1, c: 0 },
          E: { r: 0, c: 1 }
        }
      },
      ui: {
        startTime: Date.now(),
        isSaveAsMode: false,
        openSectionId: null,
        hasUnsavedChanges: false,
        openedFromStartup: false,
        components: {}
      }
    };

  }

  /* ===================================================================== */
  /* 2. INITIALISATION ET CYCLE DE VIE                                     */
  /* ===================================================================== */

  async init() {
    this.state.grid.cells = this.createDefaultGridCells(this.state.grid.cols, this.state.grid.rows);

    await this.loadUi()

    this.applyStoredTheme();
    this.checkUserSession();
    this.checkPreviousSession();
    this.updateGridDisplay();
    this.initPanAndZoomGrid();
    this.fadeAppLoader();
    this.initEventListener();


  }

  initEventListener() {
    // Dictionnaire centralisé : ID -> [event, handler]
    const eventsConfig = {
      //'burgerBtn': ['click', (e) => this.toggleMobileMenu(e)],
      'openMysterySettingsBtn': ['click', () => this.state.ui.components.InteractiveScreen.Modals.open("mystery")],
      'fileInput': ['change', (e) => this.importJSON(e)],

      // ------------------------------------------------------------------------------------------------
      // Selection Section ------------------------------------------------------------------------------
      'setTypeLetterBtn': ['click', () => this.setType('letter')],
      'setTypeDefinitionBtn': ['click', () => this.setType('definition')],
      'setTypeDoubleBtn': ['click', () => this.setType('double')],
      'cellIsMysterySwitch': ['change', (e) => this.toggleCellMystery(e.target.checked)],
      'cellIsSeparatorSwitch': ['change', (e) => this.toggleCellSeparator(e.target.checked)],
      'cellBorderRightCheckbox': ['change', (e) => this.toggleCellBorderRight(e.target.checked)],
      'cellBorderBottomCheckbox': ['change', (e) => this.toggleCellBorderBottom(e.target.checked)],
      'definitionInput': ['input', (e) => this.updateDefinition(e.target.value)],
      'btnArrowE': ['click', () => this.setArrow('E')],
      'btnArrowS': ['click', () => this.setArrow('S')],
      'topDefinitionInput': ['input', (e) => this.updateHalfDefinition('top', e.target.value)],
      'btnTopArrowE': ['click', () => this.setHalfArrow('top', 'E')],
      'btnTopArrowS': ['click', () => this.setHalfArrow('top', 'S')],
      'bottomDefinitionInput': ['input', (e) => this.updateHalfDefinition('bottom', e.target.value)],
      'btnBottomArrowE': ['click', () => this.setHalfArrow('bottom', 'E')],
      'btnBottomArrowS': ['click', () => this.setHalfArrow('bottom', 'S')],

      // ------------------------------------------------------------------------------------------------
      // Mobile Action ----------------------------------------------------------------------------------
      'mobileBackdrop': ['click', () => { this.closeMobileMenu(); this.closeAllSectionModals(); }],
      'selectionCloseModalBtn': ['click', () => this.closeAllSectionModals()],
      'mysteryCloseModalBtn': ['click', () => this.closeAllSectionModals()],
      'wordCloseModalBtn': ['click', () => this.closeAllSectionModals()]
    };

    // La boucle se simplifie également avec la déstructuration de tableau [event, handler]
    Object.entries(eventsConfig).forEach(([id, [event, handler]]) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener(event, handler);
      }
    });
  }

  async loadUi() {

    this.state.ui.components.Header = new Header(this, "#Header")    
    this.state.ui.components.MobileSectionNav = new MobileSectionNav(this, "#MobileSectionNav")
    this.state.ui.components.ZoomControls = new ZoomControls(this, "#ZoomControls")
    this.state.ui.components.InteractiveScreen = new InteractiveScreen(this, "#InteractiveScreen")

    await Promise.all([
      this.state.ui.components.Header.ready,
      this.state.ui.components.MobileSectionNav.ready,
      this.state.ui.components.ZoomControls.ready,
      this.state.ui.components.InteractiveScreen.ready

    ]);
  }
  /* ===================================================================== */
  /* 3. GÉOMÉTRIE DE LA GRILLE, PAN & ZOOM                                 */
  /* ===================================================================== */

  updateZoomDisplay() {
    const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
    if (zoomLevelDisplay) {
      zoomLevelDisplay.textContent = `${Math.round(this.state.view.scale * 100)}%`;
    }
  }

  initPanAndZoomGrid() {
    const editorContainer = document.querySelector('.editor');
    const elementEditor = document.querySelector('.grid');

    if (!elementEditor || !editorContainer) return;

    this.state.view.setTransform = () => {
      elementEditor.style.transform = `translate(${this.state.view.pointX}px, ${this.state.view.pointY}px) scale(${this.state.view.scale})`;
      elementEditor.style.transformOrigin = "0 0";
      this.updateZoomDisplay();
    };

    this.updateGridGeometry();

    editorContainer.addEventListener('wheel', (event) => {
      event.preventDefault();

      const zoomIntensity = 0.1;
      const prevScale = this.state.view.scale;

      if (event.deltaY < 0) {
        this.state.view.scale = Math.min(this.state.view.scale + zoomIntensity, 2.5);
      } else {
        this.state.view.scale = Math.max(this.state.view.scale - zoomIntensity, 0.4);
      }

      const rect = editorContainer.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      this.state.view.pointX = mouseX - (mouseX - this.state.view.pointX) * (this.state.view.scale / prevScale);
      this.state.view.pointY = mouseY - (mouseY - this.state.view.pointY) * (this.state.view.scale / prevScale);

      if (this.state.view.setTransform) this.state.view.setTransform();
    }, { passive: false });

    const startPan = (clientX, clientY) => {
      this.state.view.isPanning = true;
      this.state.view.hasMoved = false;
      this.state.view.startX = clientX - this.state.view.pointX;
      this.state.view.startY = clientY - this.state.view.pointY;
      this.state.view.clickStartX = clientX;
      this.state.view.clickStartY = clientY;
      editorContainer.style.cursor = 'grabbing';
    };

    const movePan = (clientX, clientY) => {
      if (!this.state.view.isPanning) return;
      const moveDistance = Math.hypot(clientX - this.state.view.clickStartX, clientY - this.state.view.clickStartY);
      if (moveDistance > 5) this.state.view.hasMoved = true;

      if (this.state.view.hasMoved) {
        this.state.view.pointX = clientX - this.state.view.startX;
        this.state.view.pointY = clientY - this.state.view.startY;
        if (this.state.view.setTransform) this.state.view.setTransform();
      }
    };

    const endPan = () => {
      if (this.state.view.isPanning) {
        this.state.view.isPanning = false;
        if (editorContainer) editorContainer.style.cursor = 'default';
      }
    };

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
        this.state.view.isPanning = false;
        this.state.view.initialTouchDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        );
      }
    }, { passive: true });

    window.addEventListener('touchmove', (event) => {
      if (event.touches.length === 1 && this.state.view.isPanning) {
        const touch = event.touches[0];
        movePan(touch.clientX, touch.clientY);
      } else if (event.touches.length === 2 && this.state.view.initialTouchDistance !== null) {
        event.preventDefault();

        const currentDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        );

        const factor = currentDistance / this.state.view.initialTouchDistance;
        this.state.view.initialTouchDistance = currentDistance;

        const prevScale = this.state.view.scale;
        this.state.view.scale = Math.max(0.4, Math.min(2.5, this.state.view.scale * factor));

        const rect = editorContainer.getBoundingClientRect();
        const centerX = ((event.touches[0].clientX + event.touches[1].clientX) / 2) - rect.left;
        const centerY = ((event.touches[0].clientY + event.touches[1].clientY) / 2) - rect.top;

        this.state.view.pointX = centerX - (centerX - this.state.view.pointX) * (this.state.view.scale / prevScale);
        this.state.view.pointY = centerY - (centerY - this.state.view.pointY) * (this.state.view.scale / prevScale);

        if (this.state.view.setTransform) this.state.view.setTransform();
      }
    }, { passive: false });

    window.addEventListener('touchend', (event) => {
      if (event.touches.length < 2) {
        this.state.view.initialTouchDistance = null;
      }
      if (event.touches.length === 0) {
        endPan();
      }
    });

    ['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
      editorContainer.addEventListener(evt, (event) => { event.preventDefault(); }, { passive: false });
    });
  }

  updateGridGeometry() {
    const editorContainer = document.querySelector('.editor');
    const elementEditor = document.querySelector('.grid');
    if (!elementEditor || !editorContainer) return;

    const containerRect = editorContainer.getBoundingClientRect();
    const computedCellSize = parseFloat(getComputedStyle(elementEditor).getPropertyValue('--cell')) || 54;

    const gridPixelWidth = this.state.grid.cols * computedCellSize;
    const gridPixelHeight = this.state.grid.rows * computedCellSize;

    const headerEl = document.getElementById('grilleMainSection');
    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;

    const margin = 24;
    const availableWidth = Math.max(containerRect.width - margin * 2, 50);
    const availableHeight = Math.max(containerRect.height - headerHeight - margin * 2, 50);
    const autoScale = Math.min(availableWidth / gridPixelWidth, availableHeight / gridPixelHeight) * this.state.view.autoFitZoomFactor;
    this.state.view.scale = Math.max(0.2, Math.min(autoScale, 2.5));

    this.state.view.pointX = (containerRect.width - (gridPixelWidth * this.state.view.scale)) / 2;
    this.state.view.pointY = headerHeight + (containerRect.height - headerHeight - (gridPixelHeight * this.state.view.scale)) / 2;

    if (this.state.view.setTransform) this.state.view.setTransform();
  }

  resetZoom() {
    this.updateGridGeometry();
  }

  zoomStep(delta) {
    const editorContainer = document.querySelector('.editor');
    if (!editorContainer) return;

    const prevScale = this.state.view.scale;
    this.state.view.scale = delta > 0 ? Math.min(this.state.view.scale + delta, 2.5) : Math.max(this.state.view.scale + delta, 0.4);

    const rect = editorContainer.getBoundingClientRect();
    const headerEl = document.getElementById('grilleMainSection');
    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
    const centerX = rect.width / 2;
    const centerY = headerHeight + (rect.height - headerHeight) / 2;

    this.state.view.pointX = centerX - (centerX - this.state.view.pointX) * (this.state.view.scale / prevScale);
    this.state.view.pointY = centerY - (centerY - this.state.view.pointY) * (this.state.view.scale / prevScale);

    if (this.state.view.setTransform) this.state.view.setTransform();
  }

  zoomIn() {
    this.zoomStep(0.15);
  }

  zoomOut() {
    this.zoomStep(-0.15);
  }

  /* ===================================================================== */
  /* 4. SELECTION, ANALYSE DE MOTS ET NAVIGATION                          */
  /* ===================================================================== */

  emptyCell() {
    return {
      type: "letter", letter: "", definition: "", arrow: "E",
      top: { definition: "", arrow: "E" },
      bottom: { definition: "", arrow: "S" },
      isMystery: false,
      mysteryPosition: 1,
      isSeparator: false,
      borderRight: false,
      borderBottom: false
    };
  }

  selectCellSilently(index) {
    const grid = document.getElementById("grid");
    if (this.state.navigation.selected !== null && grid.children[this.state.navigation.selected]) {
      grid.children[this.state.navigation.selected].classList.remove("selected");
    }
    this.state.navigation.selected = index;
    if (grid.children[this.state.navigation.selected]) {
      grid.children[this.state.navigation.selected].classList.add("selected");
    }
    this.updateHighlights();
    this.updatePanel();
  }

  selectCellAndFocus(index) {
    this.selectCellSilently(index);
    const grid = document.getElementById("grid");
    const el = grid.children[index];
    if (el) {
      const input = el.querySelector("input");
      if (input) {
        input.focus();
        input.select();
        requestAnimationFrame(() => {
          if (document.activeElement !== input) {
            input.focus();
            input.select();
          }
        });
      }
    }
  }

  selectCell(index) {
    this.state.navigation.selected = Number(index);
    this.render();
  }

  findDuplicateWords() {
    const wordCounts = new Map();
    const duplicateIndexes = new Set();
    const duplicateWordStrings = new Set();

    this.state.grid.cells.forEach((cell, idx) => {
      const processWord = (dir, half) => {
        const data = half ? this.getDoubleHalfWordData(idx, half, dir) : this.getWordData(idx, dir);
        if (data.indexes.length >= 2 && data.word && !data.word.includes("_")) {
          if (!wordCounts.has(data.word)) wordCounts.set(data.word, []);
          wordCounts.get(data.word).push(data.indexes);
        }
      };
      if (cell.type === "definition") processWord(cell.arrow);
      else if (cell.type === "double") {
        processWord((cell.top && cell.top.arrow) || "E", "top");
        processWord((cell.bottom && cell.bottom.arrow) || "S", "bottom");
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

  getWordData(fromIndex, dir) {
    if (fromIndex === null || fromIndex < 0) return { word: "", indexes: [] };
    const offset = this.state.view.dir_offset[dir];
    if (!offset) return { word: "", indexes: [] };

    const startRow = Math.floor(fromIndex / this.state.grid.cols);
    const startCol = fromIndex % this.state.grid.cols;
    let r = startRow; let c = startCol;
    let word = ""; let indexes = [];

    while (r >= 0 && r < this.state.grid.rows && c >= 0 && c < this.state.grid.cols) {
      const idx = r * this.state.grid.cols + c;
      if (this.state.grid.cells[idx].type !== "letter") break;

      const char = this.state.grid.cells[idx].letter ? this.state.grid.cells[idx].letter.toUpperCase() : "_";
      word += char;
      indexes.push(idx);

      if (this.state.grid.cells[idx].isSeparator) {
        word += "-";
      }

      r += offset.r;
      c += offset.c;
    }
    return { word, indexes };
  }

  getDoubleHalfWordData(defIndex, half, dir) {
    const offset = this.state.view.dir_offset[dir];
    if (!offset) return { word: "", indexes: [] };

    const defRow = Math.floor(defIndex / this.state.grid.cols);
    const defCol = defIndex % this.state.grid.cols;
    const anchorRow = half === "top" ? defRow : defRow + 1;
    const anchorCol = half === "top" ? defCol + 1 : defCol;

    if (anchorRow < 0 || anchorRow >= this.state.grid.rows || anchorCol < 0 || anchorCol >= this.state.grid.cols) return { word: "", indexes: [] };
    const anchorIdx = anchorRow * this.state.grid.cols + anchorCol;
    if (this.state.grid.cells[anchorIdx].type !== "letter") return { word: "", indexes: [] };

    let word = this.state.grid.cells[anchorIdx].letter ? this.state.grid.cells[anchorIdx].letter.toUpperCase() : "_";
    if (this.state.grid.cells[anchorIdx].isSeparator) {
      word += "-";
    }
    let indexes = [anchorIdx];
    let r = anchorRow + offset.r; let c = anchorCol + offset.c;

    while (r >= 0 && r < this.state.grid.rows && c >= 0 && c < this.state.grid.cols) {
      const idx = r * this.state.grid.cols + c;
      if (this.state.grid.cells[idx].type !== "letter") break;

      const char = this.state.grid.cells[idx].letter ? this.state.grid.cells[idx].letter.toUpperCase() : "_";
      word += char;
      if (this.state.grid.cells[idx].isSeparator) {
        word += "-";
      }
      indexes.push(idx);
      r += offset.r;
      c += offset.c;
    }
    return { word, indexes };
  }

  findParentWordForLetter(letterIdx, preferredDir = this.state.navigation.currentInputDir) {
    const findMatch = (dir) => {
      for (let i = 0; i < this.state.grid.cells.length; i++) {
        const c = this.state.grid.cells[i];
        if (c.type === "definition" && c.arrow === dir) {
          const data = this.getWordData(i, dir);
          if (data.indexes.includes(letterIdx)) return { dir, data, defIndex: i, half: null };
        } else if (c.type === "double") {
          const topDir = (c.top && c.top.arrow) || "E";
          const botDir = (c.bottom && c.bottom.arrow) || "S";
          if (topDir === dir) {
            const data = this.getDoubleHalfWordData(i, "top", dir);
            if (data.indexes.includes(letterIdx)) return { dir, data, defIndex: i, half: "top" };
          }
          if (botDir === dir) {
            const data = this.getDoubleHalfWordData(i, "bottom", dir);
            if (data.indexes.includes(letterIdx)) return { dir, data, defIndex: i, half: "bottom" };
          }
        }
      }
      return null;
    };

    let result = findMatch(preferredDir);
    if (result && result.data.indexes.length > 0) return result;
    return findMatch(preferredDir === "E" ? "S" : "E");
  }

  findAllParentWordsForLetter(letterIdx) {
    const results = [];
    ["E", "S"].forEach(dir => {
      const match = this.findParentWordForLetter(letterIdx, dir);
      if (match && match.dir === dir && match.data.indexes.length > 0) {
        results.push(match);
      }
    });
    return results;
  }

  prioritizeDirectionFromDefinitionArrow(defIndex, half, dir) {
    const wordIndexes = half
      ? this.getDoubleHalfWordData(defIndex, half, dir).indexes
      : this.getWordData(defIndex, dir).indexes;
    if (wordIndexes.length === 0) return;

    let targetIndex = null;
    if (this.state.navigation.selected !== null && wordIndexes.includes(this.state.navigation.selected) && this.state.grid.cells[this.state.navigation.selected].type === "letter") {
      targetIndex = this.state.navigation.selected;
    } else {
      targetIndex = wordIndexes.find(idx => this.state.grid.cells[idx] && this.state.grid.cells[idx].type === "letter" && this.findAllParentWordsForLetter(idx).length === 2);
      if (targetIndex === undefined) targetIndex = null;
    }
    if (targetIndex === null) {
      targetIndex = wordIndexes.find(idx => this.state.grid.cells[idx] && this.state.grid.cells[idx].type === "letter");
      if (targetIndex === undefined) targetIndex = null;
    }
    if (targetIndex === null) return;

    this.state.grid.cells[targetIndex].priorityDir = dir;
    this.state.navigation.currentInputDir = dir;
    this.state.navigation.selected = targetIndex;
    this.markAsDirty();
    this.render();
    this.selectCellAndFocus(targetIndex);
  }

  getHighlightedCells() {
    if (this.state.navigation.selected === null) { this.state.navigation.activeWordTarget = null; return []; }
    const cell = this.state.grid.cells[this.state.navigation.selected];

    if (cell.type === "definition") {
      this.state.navigation.currentInputDir = cell.arrow;
      const data = this.getWordData(this.state.navigation.selected, cell.arrow);
      this.state.navigation.activeWordTarget = { direction: cell.arrow, indexes: data.indexes };
      return data.indexes;
    }

    if (cell.type === "double") {
      const topDir = (cell.top && cell.top.arrow) || "E";
      const botDir = (cell.bottom && cell.bottom.arrow) || "S";
      const topIdx = this.getDoubleHalfWordData(this.state.navigation.selected, "top", topDir).indexes;
      const botIdx = this.getDoubleHalfWordData(this.state.navigation.selected, "bottom", botDir).indexes;
      const all = Array.from(new Set([...topIdx, ...botIdx]));

      const useBottom = this.state.navigation.currentDoubleHalf === "bottom";
      this.state.navigation.currentInputDir = useBottom ? botDir : topDir;
      this.state.navigation.activeWordTarget = { direction: this.state.navigation.currentInputDir, indexes: useBottom ? botIdx : topIdx };
      return all;
    }

    if (cell.type === "letter") {
      const parents = this.findAllParentWordsForLetter(this.state.navigation.selected);
      if (parents.length > 0) {
        const wantedDir = cell.priorityDir || this.state.navigation.currentInputDir;
        const preferred = parents.find(p => p.dir === wantedDir) || parents[0];
        this.state.navigation.currentInputDir = preferred.dir;
        this.state.navigation.activeWordTarget = { direction: preferred.dir, indexes: preferred.data.indexes };
        return preferred.data.indexes;
      }
    }

    this.state.navigation.activeWordTarget = null;
    return [];
  }

  getNonPriorityCells() {
    if (this.state.navigation.selected === null) return [];
    const cell = this.state.grid.cells[this.state.navigation.selected];
    if (cell.type === "letter") {
      const parents = this.findAllParentWordsForLetter(this.state.navigation.selected);
      if (parents.length === 2) {
        const wantedDir = cell.priorityDir || this.state.navigation.currentInputDir;
        const preferred = parents.find(p => p.dir === wantedDir) || parents[0];
        const nonPreferred = parents.find(p => p.dir !== preferred.dir);
        if (nonPreferred) {
          return nonPreferred.data.indexes;
        }
      }
    }
    return [];
  }

  updateGridArrowHighlights() {
    const grid = document.getElementById("grid");
    if (!grid) return;

    const activeArrows = grid.querySelectorAll(".arrow-svg.priority-arrow-active, .arrow-svg.arrow-active");
    activeArrows.forEach(img => {
      img.classList.remove("priority-arrow-active", "arrow-active");
    });

    if (this.state.navigation.selected === null || this.state.navigation.selected === undefined || !this.state.grid.cells[this.state.navigation.selected]) return;

    const cell = this.state.grid.cells[this.state.navigation.selected];
    let targetDefIndex = null;
    let targetHalf = null;

    if (cell.type === "letter") {
      const parents = this.findAllParentWordsForLetter(this.state.navigation.selected);
      if (parents.length > 0) {
        const wantedDir = cell.priorityDir || this.state.navigation.currentInputDir;
        const activeParent = parents.find(p => p.dir === wantedDir) || parents.find(p => p.dir === this.state.navigation.currentInputDir) || parents[0];
        if (activeParent && activeParent.defIndex !== undefined && activeParent.defIndex !== null) {
          targetDefIndex = activeParent.defIndex;
          targetHalf = activeParent.half;
        }
      }
    } else if (cell.type === "definition") {
      targetDefIndex = this.state.navigation.selected;
      targetHalf = null;
    } else if (cell.type === "double") {
      targetDefIndex = this.state.navigation.selected;
      targetHalf = this.state.navigation.currentDoubleHalf === "bottom" ? "bottom" : "top";
    }

    if (targetDefIndex !== null && grid.children[targetDefIndex]) {
      const defCellEl = grid.children[targetDefIndex];
      let arrowImg = null;
      if (targetHalf === "top") {
        arrowImg = defCellEl.querySelector(".half:first-child .arrow-svg");
      } else if (targetHalf === "bottom") {
        arrowImg = defCellEl.querySelector(".half:last-child .arrow-svg");
      } else {
        arrowImg = defCellEl.querySelector(".arrow-svg");
      }

      if (arrowImg) {
        arrowImg.classList.add("priority-arrow-active", "arrow-active");
      }
    }
  }

  updateHighlights() {
    const grid = document.getElementById("grid");
    const highlightedIndexes = this.getHighlightedCells();
    const nonPriorityIndexes = this.getNonPriorityCells();
    const combined = Array.from(new Set([...highlightedIndexes, ...this.state.navigation.hoveredWordIndexes]));
    const { duplicateIndexes } = this.findDuplicateWords();

    Array.from(grid.children).forEach((el, idx) => {
      const isHighlighted = combined.includes(idx);
      const isNonPriority = nonPriorityIndexes.includes(idx) && !isHighlighted;

      el.classList.toggle("word-highlighted", isHighlighted);
      el.classList.toggle("word-non-priority", isNonPriority);

      if (isNonPriority) {
        el.style.backgroundColor = "var(--theme-color-light)";
      } else {
        el.style.backgroundColor = "";
      }
      el.classList.toggle("word-duplicate", duplicateIndexes.includes(idx));
    });

    this.updateGridArrowHighlights();
  }

  moveToNextLetter(step) {
    if (this.state.navigation.selected === null || !this.state.navigation.activeWordTarget || this.state.navigation.activeWordTarget.indexes.length === 0) return;
    const currentIndex = this.state.navigation.activeWordTarget.indexes.indexOf(this.state.navigation.selected);
    if (currentIndex !== -1) {
      const nextPos = currentIndex + step;
      if (nextPos >= 0 && nextPos < this.state.navigation.activeWordTarget.indexes.length) {
        this.selectCellAndFocus(this.state.navigation.activeWordTarget.indexes[nextPos]);
      }
    }
  }

  /* ===================================================================== */
  /* 5. AFFICHAGE, RENDU ET INTERFACE GRILLE                               */
  /* ===================================================================== */

  updateGridDisplay() {
    document.getElementById('gridNameDisplay').textContent = this.state.grid.name;
    document.getElementById('printTitle').textContent = this.state.grid.name;
    document.getElementById('gridDimensionsDisplay').textContent = `${this.state.grid.cols}C × ${this.state.grid.rows}L`;

    const grid = document.getElementById("grid");

    grid.style.gridTemplateColumns = Array(this.state.grid.cols).fill('var(--cell)').join(' ');
    grid.style.gridTemplateRows = Array(this.state.grid.rows).fill('var(--cell)').join(' ');

    const computedCellSize = parseFloat(getComputedStyle(grid).getPropertyValue('--cell')) || 54;
    grid.style.width = `${this.state.grid.cols * computedCellSize}px`;
    grid.style.height = `${this.state.grid.rows * computedCellSize}px`;

    this.render();
    this.updateGridGeometry();
    this.updateMysteryWordDisplay();
  }

  render() {
    const grid = document.getElementById("grid");
    grid.innerHTML = "";

    const highlightedIndexes = this.getHighlightedCells();
    const nonPriorityIndexes = this.getNonPriorityCells();
    const { duplicateIndexes } = this.findDuplicateWords();

    this.state.grid.cells.forEach((cell, index) => {
      const el = document.createElement("div");
      el.className = "cell " + cell.type + "-cell";

      if ((index + 1) % this.state.grid.cols === 0) el.style.borderRight = "0";
      if (index >= this.state.grid.cols * (this.state.grid.rows - 1)) el.style.borderBottom = "0";

      const isHighlighted = highlightedIndexes.includes(index) || this.state.navigation.hoveredWordIndexes.includes(index);
      const isNonPriority = nonPriorityIndexes.includes(index) && !isHighlighted;

      if (index === this.state.navigation.selected) el.classList.add("selected");
      if (isHighlighted) el.classList.add("word-highlighted");
      if (isNonPriority) {
        el.classList.add("word-non-priority");
        el.style.backgroundColor = "var(--theme-color-light)";
      }
      if (duplicateIndexes.includes(index)) el.classList.add("word-duplicate");

      if (cell.type === "letter" && cell.isSeparator) {
        if (cell.borderRight) el.style.borderRight = "3px solid var(--theme-color-strong)";
        if (cell.borderBottom) el.style.borderBottom = "3px solid var(--theme-color-strong)";
      }

      if (cell.type === "letter") {
        const input = document.createElement("input");
        input.maxLength = 1;
        input.value = cell.letter || "";
        input.setAttribute("autocomplete", "off");

        if (cell.isMystery && cell.mysteryPosition) {
          const badgeEl = document.createElement("span");
          badgeEl.className = "mystery-badge-corner";
          badgeEl.textContent = cell.mysteryPosition;
          el.appendChild(badgeEl);
        }

        input.addEventListener("click", () => {
          this.selectCellSilently(index);
          input.focus();
          input.select();
        });

        input.addEventListener("focus", () => {
          this.selectCellSilently(index);
        });

        input.addEventListener("keydown", e => {
          if (e.key === "ArrowDown") { this.state.navigation.currentInputDir = "S"; this.moveToNextLetter(1); return; }
          else if (e.key === "ArrowRight") { this.state.navigation.currentInputDir = "E"; this.moveToNextLetter(1); return; }
          else if (e.key === "ArrowUp") { this.state.navigation.currentInputDir = "S"; this.moveToNextLetter(-1); return; }
          else if (e.key === "ArrowLeft") { this.state.navigation.currentInputDir = "E"; this.moveToNextLetter(-1); return; }

          if (e.key === "Backspace") {
            e.preventDefault();
            cell.letter = "";
            input.value = "";
            this.updatePanel();
            this.updatePlacedWordsList();
            this.moveToNextLetter(-1);
          } else if (e.key.length === 1 && /[a-zA-ZÀ-ÿ]/.test(e.key)) {
            e.preventDefault();
            const char = e.key.toUpperCase();
            cell.letter = char;
            input.value = char;
            this.updatePanel();
            this.updatePlacedWordsList();
            this.markAsDirty();
            this.updateMysteryWordDisplay();
            this.moveToNextLetter(1);
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
          this.state.navigation.currentDoubleHalf = null;
          this.state.navigation.currentInputDir = cell.arrow;
          this.selectCellSilently(index);
        });
        editable.addEventListener("input", e => {
          cell.definition = e.target.innerText.toUpperCase();
          const sideInput = document.getElementById("definitionInput");
          if (sideInput) sideInput.value = cell.definition;
          this.markAsDirty();
        });
        el.appendChild(editable);
        const svg = this.createArrowElement(cell.arrow, "full");
        if (svg) {
          svg.style.cursor = "pointer";
          svg.title = "Cliquer pour donner la priorité à ce mot en cas d'intersection";
          svg.addEventListener("mousedown", (e) => {
            e.preventDefault();
          });
          svg.addEventListener("click", (e) => {
            e.stopPropagation();
            this.prioritizeDirectionFromDefinitionArrow(index, null, cell.arrow);
          });
          el.appendChild(svg);
        }
      }

      if (cell.type === "double") {
        const topDir = (cell.top && cell.top.arrow) || "E";
        const botDir = (cell.bottom && cell.bottom.arrow) || "S";
        el.innerHTML = `<div class="half"><div class="def-editable" contenteditable="true"></div></div><div class="half"><div class="def-editable" contenteditable="true"></div></div>`;
        const halves = el.querySelectorAll(".half");
        const editables = el.querySelectorAll(".def-editable");
        editables[0].innerText = cell.top.definition;
        editables[1].innerText = cell.bottom.definition;

        editables[0].addEventListener("focus", () => { this.state.navigation.currentDoubleHalf = "top"; this.state.navigation.currentInputDir = topDir; this.selectCellSilently(index); const sideInput = document.getElementById("topDefinitionInput"); if (sideInput) sideInput.value = cell.top.definition; });
        editables[1].addEventListener("focus", () => { this.state.navigation.currentDoubleHalf = "bottom"; this.state.navigation.currentInputDir = botDir; this.selectCellSilently(index); const sideInput = document.getElementById("bottomDefinitionInput"); if (sideInput) sideInput.value = cell.bottom.definition; });

        editables[0].addEventListener("input", e => { cell.top.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("topDefinitionInput"); if (sideInput) sideInput.value = cell.top.definition; this.markAsDirty(); });
        editables[1].addEventListener("input", e => { cell.bottom.definition = e.target.innerText.toUpperCase(); const sideInput = document.getElementById("bottomDefinitionInput"); if (sideInput) sideInput.value = cell.bottom.definition; this.markAsDirty(); });

        const svgTop = this.createArrowElement(topDir, "top");
        if (svgTop) {
          svgTop.style.cursor = "pointer";
          svgTop.title = "Cliquer pour donner la priorité à ce mot en cas d'intersection";
          svgTop.addEventListener("mousedown", (e) => {
            e.preventDefault();
          });
          svgTop.addEventListener("click", (e) => {
            e.stopPropagation();
            this.prioritizeDirectionFromDefinitionArrow(index, "top", topDir);
          });
          halves[0].appendChild(svgTop);
        }
        const svgBottom = this.createArrowElement(botDir, "bottom");
        if (svgBottom) {
          svgBottom.style.cursor = "pointer";
          svgBottom.title = "Cliquer pour donner la priorité à ce mot en cas d'intersection";
          svgBottom.addEventListener("mousedown", (e) => {
            e.preventDefault();
          });
          svgBottom.addEventListener("click", (e) => {
            e.stopPropagation();
            this.prioritizeDirectionFromDefinitionArrow(index, "bottom", botDir);
          });
          halves[1].appendChild(svgBottom);
        }
      }

      el.dataset.index = index;
      el.addEventListener("click", () => {
        if (cell.type !== "double" && cell.type !== "definition" && cell.type !== "letter") {
          this.selectCell(index);
        }
      });
      grid.appendChild(el);
    });

    this.updatePanel();
    this.updatePlacedWordsList();
    this.markAsDirty();
    this.updateMysteryWordDisplay();
    this.updateGridArrowHighlights();
  }

  createArrowElement(dir, zone) {
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

  updatePanel() {
    document.querySelectorAll(".type-buttons button").forEach(btn => {
      btn.classList.toggle("active", this.state.navigation.selected !== null && btn.dataset.type === this.state.grid.cells[this.state.navigation.selected].type);
    });
    const info = document.getElementById("selectedInfo");
    const single = document.getElementById("singleDefControls");
    const dbl = document.getElementById("doubleDefControls");
    const wordContainer = document.getElementById("wordFormedContainer");

    if (this.state.navigation.selected === null) {
      info.textContent = "Cliquez sur une case de la grille.";
      single.style.display = "none";
      dbl.style.display = "none";
      wordContainer.innerHTML = "";

      const mysterySwitch = document.getElementById("cellIsMysterySwitch");
      const mysterySectionContainer = mysterySwitch ? (mysterySwitch.closest('.option-section') || mysterySwitch.parentElement) : null;
      const mysteryOptionsContainer = document.getElementById("mysteryCellOptionsContainer");
      if (mysterySectionContainer) mysterySectionContainer.style.display = "none";
      if (mysteryOptionsContainer) mysteryOptionsContainer.style.display = "none";
      return;
    }

    const row = Math.floor(this.state.navigation.selected / this.state.grid.cols) + 1;
    const col = this.state.navigation.selected % this.state.grid.cols + 1;
    info.textContent = `Case : colonne ${col}, ligne ${row}`;
    const cell = this.state.grid.cells[this.state.navigation.selected];
    single.style.display = cell.type === "definition" ? "block" : "none";
    dbl.style.display = cell.type === "double" ? "block" : "none";
    wordContainer.innerHTML = "";

    if (cell.type === "definition") {
      document.getElementById("mysterySection").style.display = "none";
      document.getElementById("definitionInput").value = cell.definition;
      document.getElementById("btnArrowE").classList.toggle("active", cell.arrow === "E");
      document.getElementById("btnArrowS").classList.toggle("active", cell.arrow === "S");
    }

    if (cell.type === "double") {
      document.getElementById("mysterySection").style.display = "none";
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
    }

    if (cell.type === "letter") {
      document.getElementById("mysterySection").style.display = "block";
      const parents = this.findAllParentWordsForLetter(this.state.navigation.selected);
      parents.forEach(parent => {
        this.renderWordBox(wordContainer, "Mot associé", parent.data.word, parent.data.indexes, `word-letter-${parent.dir}`, parent.dir, this.state.navigation.selected);
      });
    }

    const separatorOptionsContainer = document.getElementById("separatorOptionsContainer");
    const separatorSwitch = document.getElementById("cellIsSeparatorSwitch");
    const borderRightCheckbox = document.getElementById("cellBorderRightCheckbox");
    const borderBottomCheckbox = document.getElementById("cellBorderBottomCheckbox");

    if (cell.type === "letter") {
      if (separatorOptionsContainer) separatorOptionsContainer.style.display = "block";
      if (separatorSwitch) separatorSwitch.checked = !!cell.isSeparator;

      const detailsContainer = document.getElementById("separatorDetailsContainer");
      if (detailsContainer) {
        detailsContainer.style.display = cell.isSeparator ? "block" : "none";
      }

      if (borderRightCheckbox) borderRightCheckbox.checked = !!cell.borderRight;
      if (borderBottomCheckbox) borderBottomCheckbox.checked = !!cell.borderBottom;
    } else {
      if (separatorOptionsContainer) separatorOptionsContainer.style.display = "none";
    }

    const mysteryOptionsContainer = document.getElementById("mysteryCellOptionsContainer");
    const mysterySwitch = document.getElementById("cellIsMysterySwitch");
    const mysterySectionContainer = mysterySwitch ? (mysterySwitch.closest('.option-section') || mysterySwitch.parentElement) : null;

    if (cell.type === "letter") {
      if (mysterySectionContainer) mysterySectionContainer.style.display = "block";
      if (mysterySwitch) {
        mysterySwitch.checked = !!cell.isMystery;
      }

      if (mysteryOptionsContainer) {
        mysteryOptionsContainer.style.display = cell.isMystery ? "block" : "none";
      }

      if (cell.isMystery) {
        this.renderCellMysteryPositionButtons(cell.mysteryPosition || 1);
      } else {
        const container = document.getElementById('cellMysteryPosButtonsContainer');
        if (container) container.innerHTML = '';
      }
    } else {
      if (mysterySectionContainer) mysterySectionContainer.style.display = "none";
      if (mysteryOptionsContainer) mysteryOptionsContainer.style.display = "none";
      if (mysterySwitch) mysterySwitch.checked = false;
    }
  }

  updatePlacedWordsList() {
    const wordsListEl = document.getElementById("wordsList");
    const wordsCountEl = document.getElementById("wordsCount");
    if (!wordsListEl || !wordsCountEl) return;

    const foundWordsMap = new Map();
    this.state.grid.cells.forEach((cell, idx) => {
      if (cell.type === "definition") {
        const data = this.getWordData(idx, cell.arrow);
        if (data.indexes.length >= 2 && data.word && !data.word.includes("_")) foundWordsMap.set(data.indexes.join(","), { text: data.word, indexes: data.indexes });
      } else if (cell.type === "double") {
        const topDir = (cell.top && cell.top.arrow) || "E";
        const botDir = (cell.bottom && cell.bottom.arrow) || "S";
        const dataTop = this.getDoubleHalfWordData(idx, "top", topDir); if (dataTop.indexes.length >= 2 && dataTop.word && !dataTop.word.includes("_")) foundWordsMap.set(dataTop.indexes.join(","), { text: dataTop.word, indexes: dataTop.indexes });
        const dataBot = this.getDoubleHalfWordData(idx, "bottom", botDir); if (dataBot.indexes.length >= 2 && dataBot.word && !dataBot.word.includes("_")) foundWordsMap.set(dataBot.indexes.join(","), { text: dataBot.word, indexes: dataBot.indexes });
      }
    });

    const wordsArray = Array.from(foundWordsMap.values());
    const { duplicateWordStrings } = this.findDuplicateWords();

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
        wordEl.addEventListener("mouseenter", () => { this.state.navigation.hoveredWordIndexes = item.indexes; this.updateHighlights(); });
        wordEl.addEventListener("mouseleave", () => { this.state.navigation.hoveredWordIndexes = []; this.updateHighlights(); });
        wordEl.addEventListener("click", () => { if (item.indexes.length > 0) this.selectCellAndFocus(item.indexes[0]); });
        groupDiv.appendChild(wordEl);
      });
      wordsListEl.appendChild(groupDiv);
    });
  }

  renderWordBox(container, labelText, word, indexes, idPrefix, dir, priorityLetterIdx) {
    if (!indexes || indexes.length === 0) return;
    const box = document.createElement("div"); box.className = "word-box";
    const titleDiv = document.createElement("div"); titleDiv.className = "word-title";
    const labelSpan = document.createElement("span"); labelSpan.textContent = `${labelText} (${word.length} lettres)`; titleDiv.appendChild(labelSpan);
    if (dir) {
      const iconSpan = document.createElement("span");
      iconSpan.className = "material-symbols-outlined";
      iconSpan.style.fontSize = "16px";
      iconSpan.textContent = dir === "E" ? "arrow_right_alt" : "south";

      if (priorityLetterIdx !== undefined && priorityLetterIdx !== null) {
        iconSpan.classList.add("priority-arrow-toggle");
        if (dir === this.state.navigation.currentInputDir) iconSpan.classList.add("priority-arrow-active");
        iconSpan.title = dir === "E"
          ? "Donner la priorité au mot horizontal pour la saisie"
          : "Donner la priorité au mot vertical pour la saisie";
        iconSpan.addEventListener("mousedown", (e) => {
          e.preventDefault();
        });
        iconSpan.addEventListener("click", (e) => {
          e.stopPropagation();
          this.state.grid.cells[priorityLetterIdx].priorityDir = dir;
          this.state.navigation.currentInputDir = dir;
          this.markAsDirty();
          this.render();
          this.selectCellAndFocus(priorityLetterIdx);
        });
      }
      titleDiv.appendChild(iconSpan);
    }

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
    correctBtn.innerHTML = `<span class="material-symbols-outlined float-r">spellcheck</span> Corriger l'orthographe`;
    correctBtn.onclick = () => this.fetchSpellCorrection(word, indexes, `${idPrefix}-correct`);
    box.appendChild(correctBtn);

    const correctList = document.createElement("div");
    correctList.id = `${idPrefix}-correct`;
    correctList.className = "suggestions-list";
    box.appendChild(correctList);

    const sugBtn = document.createElement("button");
    sugBtn.className = "word-action-btn";
    sugBtn.innerHTML = `<span class="material-symbols-outlined float-r">list_alt</span> Suggérer (Même motif)`;
    sugBtn.onclick = () => this.fetchPatternSuggestions(word, indexes, `${idPrefix}-sug`);
    box.appendChild(sugBtn);

    const sugList = document.createElement("div");
    sugList.id = `${idPrefix}-sug`;
    sugList.className = "suggestions-list";
    box.appendChild(sugList);

    const defBtn = document.createElement("button");
    defBtn.className = "word-action-btn";
    defBtn.innerHTML = `<span class="material-symbols-outlined float-r">menu_book</span> Définition (Wiktionnaire)`;
    defBtn.onclick = () => this.fetchWordDefinition(word, `${idPrefix}-def`);
    box.appendChild(defBtn);

    const defBox = document.createElement("div");
    defBox.id = `${idPrefix}-def`;
    defBox.className = "dict-def-box";
    defBox.style.display = "none";
    box.appendChild(defBox);

    const synBtn = document.createElement("button");
    synBtn.className = "word-action-btn";
    synBtn.innerHTML = `<span class="material-symbols-outlined float-r">sync_alt</span> Synonymes`;
    synBtn.onclick = () => this.fetchSynonyms(word, indexes, `${idPrefix}-syn`);
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

  createDefaultGridCells(cols, rows) {
    let newCells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let cell = this.emptyCell();

        if ((r === 0 && c % 2 === 0) || (c === 0 && r % 2 === 0)) {
          cell.type = "double";

          if (r === 0 && c === 0) {
            cell.bottom.arrow = "E";
            cell.top.arrow = "S";
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

  setType(type) {
    if (this.state.navigation.selected === null || this.state.navigation.selected === undefined || Number.isNaN(Number(this.state.navigation.selected))) {
      this.showCustomAlert("Sélectionnez d'abord une case.");
      return;
    }
    this.state.navigation.selected = Number(this.state.navigation.selected);
    this.state.grid.cells[this.state.navigation.selected].type = type;
    if (type === "double") {
      if (!this.state.grid.cells[this.state.navigation.selected].top) this.state.grid.cells[this.state.navigation.selected].top = { definition: "", arrow: "E" };
      if (!this.state.grid.cells[this.state.navigation.selected].bottom) this.state.grid.cells[this.state.navigation.selected].bottom = { definition: "", arrow: "S" };
      if (!this.state.grid.cells[this.state.navigation.selected].top.arrow) this.state.grid.cells[this.state.navigation.selected].top.arrow = "E";
      if (!this.state.grid.cells[this.state.navigation.selected].bottom.arrow) this.state.grid.cells[this.state.navigation.selected].bottom.arrow = "S";
    }
    this.render();
    if (type === "definition") this.focusDefinitionCell(this.state.navigation.selected);
    else if (type === "double") this.focusDoubleDefinitionCell(this.state.navigation.selected);
    else if (type === "letter") this.selectCellAndFocus(this.state.navigation.selected);
  }

  setHalfArrow(which, dir) {
    if (this.state.navigation.selected === null) return;
    const cell = this.state.grid.cells[this.state.navigation.selected];
    if (cell.type === "double") {
      if (!cell[which]) cell[which] = { definition: "", arrow: dir };
      else cell[which].arrow = dir;
      this.state.navigation.currentDoubleHalf = which;
      this.state.navigation.currentInputDir = dir;
      this.render();
    }
  }

  focusDefinitionCell(index) {
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

  focusDoubleDefinitionCell(index) {
    setTimeout(() => {
      const grid = document.getElementById("grid");
      const cellEl = grid.children[index];
      if (cellEl) {
        const firstEditable = cellEl.querySelector(".def-editable");
        if (firstEditable) firstEditable.focus();
      }
    }, 10);
  }

  fillWordInGrid(word, indexes) {
    for (let i = 0; i < indexes.length; i++) {
      if (i < word.length) this.state.grid.cells[indexes[i]].letter = word[i];
    }
    this.markAsDirty();
    this.render();
  }

  updateDefinition(value) {
    if (this.state.navigation.selected !== null) {
      this.state.grid.cells[this.state.navigation.selected].definition = value.toUpperCase();
      const grid = document.getElementById("grid");
      if (grid.children[this.state.navigation.selected]) {
        const def = grid.children[this.state.navigation.selected].querySelector(".def-content");
        if (def && def !== document.activeElement) def.innerText = this.state.grid.cells[this.state.navigation.selected].definition;
      }
    }
  }

  getCellRowCol(index) {
    return {
      row: Math.floor(index / this.state.grid.cols),
      col: index % this.state.grid.cols
    };
  }

  setArrow(dir) {
    if (this.state.navigation.selected === null) return;
    const cell = this.state.grid.cells[this.state.navigation.selected];
    if (cell.type === "definition") {
      const { row, col } = this.getCellRowCol(this.state.navigation.selected);
      if (row === 0) {
        cell.arrow = "S";
      } else if (col === 0) {
        cell.arrow = "E";
      } else {
        cell.arrow = dir;
      }
      this.render();
    }
  }

  updateHalfDefinition(which, value) {
    if (this.state.navigation.selected !== null && this.state.grid.cells[this.state.navigation.selected].type === "double") {
      this.state.grid.cells[this.state.navigation.selected][which].definition = value.toUpperCase();
      const grid = document.getElementById("grid");
      if (grid.children[this.state.navigation.selected]) {
        const editables = grid.children[this.state.navigation.selected].querySelectorAll(".def-editable");
        const idx = which === "top" ? 0 : 1;
        if (editables[idx] && editables[idx] !== document.activeElement) editables[idx].innerText = this.state.grid.cells[this.state.navigation.selected][which].definition;
      }
    }
  }

  clearCell() {
    if (this.state.navigation.selected === null) return;
    this.state.grid.cells[this.state.navigation.selected] = this.emptyCell();
    this.markAsDirty();
    this.render();
  }

  /* ===================================================================== */
  /* 7. API EXTERNES ET DICTIONNAIRES (WIKTIONAIRE)                         */
  /* ===================================================================== */

  async fetchSpellCorrection(word, indexes, resultContainerId) {
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
        tag.onclick = () => this.fillWordInGrid(wUpper, indexes);
        container.appendChild(tag);
      });
    } catch (e) {
      console.error(e);
      container.innerHTML = "<span style='font-size:11px;color:#d32f2f'>Erreur de correction.</span>";
    }
  }

  async fetchSynonyms(word, indexes, resultContainerId) {
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
        tag.onclick = () => this.fillWordInGrid(wUpper, indexes);

        container.appendChild(tag);
      });

    } catch (e) {
      console.error(e);
      container.innerHTML = "<span style='font-size:11px;color:#d32f2f'>Erreur lors de la recherche des synonymes.</span>";
    }
  }

  async fetchPatternSuggestions(word, indexes, resultContainerId) {
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
        tag.onclick = () => this.fillWordInGrid(wUpper, indexes);
        container.appendChild(tag);
      });

    } catch (e) {
      console.error(e);
      container.innerHTML = "<span style='font-size:11px;color:#d32f2f'>Erreur lors de la recherche par motif.</span>";
    }
  }

  async fetchWordDefinition(word, resultContainerId) {
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

  async getSavedGrids() {
    let onSuccess = function (grids) { }
    let onError = (error) => {
      this.showCustomAlert(error);
    }

    this.state.ui.components.InteractiveScreen.ApiLoader.show()
    const result = await window.API.getGrids();
    this.state.ui.components.InteractiveScreen.ApiLoader.hide()

    switch (result.success) {
      case true:
        onSuccess(result.grids);
        return result.grids;
      case false:
        onError(result.error);
        break;
    }
  }

  async saveGrid() {
    const payload = {
      id: this.state.grid.id,
      name: this.state.grid.name,
      cols: this.state.grid.cols,
      rows: this.state.grid.rows,
      version: 2,
      content: this.state.grid.cells
    };

    this.saveGridToCloud(payload);
    this.updateGridDisplay();
  }

  async saveGridToCloud(gridData) {
    let onSuccess = (gridId) => {
      this.markAsClean();
      this.state.grid.id = gridId;
    }
    let onError = (error) => {
      this.showCustomAlert(error);
    }

    this.state.ui.components.InteractiveScreen.ApiLoader.show()
    const result = await window.API.saveGrid(gridData, this.state.grid.id, this.state.grid.name, this.state.grid.cols, this.state.grid.rows, this.state.grid.mysteryWordConfig, this.state.grid.cells);
    this.state.ui.components.InteractiveScreen.ApiLoader.hide()

    switch (result.success) {
      case true:
        onSuccess(result.id);
        break;
      case false:
        onError(result.error);
        break;
    }
  }

  async deleteSavedGrid(name, gridId) {
    const confirmed = await this.showCustomConfirm(`Supprimer la grille "${name}" du cloud ?`);
    if (!confirmed) return;

    let onSuccess = () => {
      this.openLoadModal();
    }
    let onError = (error) => {
      this.showCustomAlert(error);
    }

    this.state.ui.components.InteractiveScreen.ApiLoader.show()
    const result = await window.API.deleteGrid(gridId);
    this.state.ui.components.InteractiveScreen.ApiLoader.hide()

    switch (result.success) {
      case true:
        onSuccess();
        break;
      case false:
        onError(result.error);
        break;
    }
  }

  async checkPreviousSession() {
    try {
      const savedGrids = await this.getSavedGrids();
      if (!savedGrids) return;
      const gridEntries = Object.entries(savedGrids);

      if (gridEntries.length === 0) return;

      gridEntries.sort((a, b) => {
        return new Date(b[1].updated_at) - new Date(a[1].updated_at);
      });

      const [lastName, lastGridData] = gridEntries[0];

      if (!lastGridData || !lastGridData.cells || lastGridData.cells.length === 0) return;

      this.state.grid.sessionRestorePending = true;
      this.state.grid.pendingSessionData = {
        name: lastName,
        cols: lastGridData.cols || 13,
        rows: lastGridData.rows || 17,
        cells: lastGridData.cells,
        id: lastGridData.id || null,
        mysteryWordConfig: lastGridData.mysteryWordConfig || { length: 9 }
      };

      const modal = document.getElementById("restoreModal");
      if (modal) modal.classList.add("active");

    } catch (e) {
      console.error("Erreur lors de la vérification des sessions cloud :", e);
    }
  }

  restorePreviousSession() {
    if (this.state.grid.pendingSessionData) {
      this.state.grid.cols = this.state.grid.pendingSessionData.cols || 13;
      this.state.grid.rows = this.state.grid.pendingSessionData.rows || 17;
      this.state.grid.cells = this.state.grid.pendingSessionData.cells;
      this.state.grid.name = this.state.grid.pendingSessionData.name || "Ma Grille";
      this.state.grid.id = this.state.grid.pendingSessionData.id || null;

      if (this.state.grid.pendingSessionData.mysteryWordConfig) {
        this.state.grid.mysteryWordConfig = this.state.grid.pendingSessionData.mysteryWordConfig;
      }
    }
    this.state.grid.sessionRestorePending = false;
    this.state.grid.pendingSessionData = null;
    this.state.ui.openedFromStartup = false;
    this.state.navigation.selected = null;

    this.updateGridDisplay();
    this.updateGridGeometry();
    this.markAsClean();
    this.closeRestoreModal();
  }

  discardPreviousSession() {
    this.state.grid.sessionRestorePending = false;
    this.state.grid.pendingSessionData = null;
    this.state.ui.openedFromStartup = true;
    this.closeRestoreModal();
    this.createGrid();
  }

  openSession() {
    this.state.ui.openedFromStartup = true;
    this.openLoadModal();
    this.closeRestoreModal();
  }

  createGrid() {
    this.state.grid.isCreatingNewGrid = true;
    /*     document.getElementById('settingsModalTitle').textContent = "Créer une nouvelle grille";
        document.getElementById('settingName').value = "Ma Nouvelle Grille";
        document.getElementById('settingCols').value = 13;
        document.getElementById('settingRows').value = 17;
        document.getElementById('settingsModal').classList.add('active'); */
    this.state.ui.components.InteractiveScreen.Modals.open("settings")
  }

  async clearGrid() {
    const confirmed = await this.showCustomConfirm("Voulez-vous vraiment vider toute la grille ?");
    if (confirmed) {
      this.executeClearGrid();
    }
  }

  executeClearGrid() {
    this.state.grid.cells = this.createDefaultGridCells(this.state.grid.cols, this.state.grid.rows);
    this.state.navigation.selected = null;
    this.render();
    this.markAsDirty();
  }

  async loadSelectedGrid(name) {
    const savedGrids = await this.getSavedGrids();
    const data = savedGrids[name];

    if (data) {
      if (Array.isArray(data)) {
        this.state.grid.cols = 13;
        this.state.grid.rows = 17;
        this.state.grid.cells = data;
        this.state.grid.id = null;
      } else {
        this.state.grid.cols = data.cols;
        this.state.grid.rows = data.rows;
        this.state.grid.cells = data.cells;
        this.state.grid.id = data.id || null;

        if (data.mysteryWordConfig) {
          this.state.grid.mysteryWordConfig = data.mysteryWordConfig;
        }
      }

      this.state.grid.name = name;
      this.state.navigation.selected = null;
      this.state.ui.openedFromStartup = false;

      this.updateGridDisplay();
      this.updateMysteryWordDisplay();
      this.updateGridGeometry();
      this.markAsClean();
      this.state.ui.components.InteractiveScreen.Modals.close()
    }
  }

  importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.cells) {
          this.state.grid.cells = data.cells;
          this.state.grid.cols = data.cols || 13;
          this.state.grid.rows = data.rows || 17;
          this.state.grid.name = data.name || file.name.replace(".json", "");
          if (data.mysteryWordConfig) {
            this.state.grid.mysteryWordConfig = data.mysteryWordConfig;
          }
        } else if (Array.isArray(data)) {
          this.state.grid.cells = data;
          this.state.grid.cols = 13;
          this.state.grid.rows = 17;
          this.state.grid.name = file.name.replace(".json", "");
        }
        this.state.navigation.selected = null;
        this.state.ui.openedFromStartup = false;
        this.updateGridDisplay();
        this.updateMysteryWordDisplay();
      } catch (err) {
        this.showCustomAlert("Fichier JSON invalide.");
      }
    };
    reader.readAsText(file);
  }

  /* ===================================================================== */
  /* 9. AUTHENTIFICATION UTILISATEUR                                       */
  /* ===================================================================== */



  async handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    let onSuccess = () => {
      //document.getElementById('authModal').style.display = 'none';
      this.checkUserSession();
    }
    let onError = (error) => {
      document.getElementById('loginError').textContent = error;
    }

    this.state.ui.components.InteractiveScreen.ApiLoader.show()
    const result = await window.API.handleLogin(email, password);
    this.state.ui.components.InteractiveScreen.ApiLoader.hide()

    switch (result.success) {
      case true:
        onSuccess();
        break;
      case false:
        onError(result.error);
        break;
    }
  }

  async handleRegister(event) {
    event.preventDefault();
    const first_name = document.getElementById('regFirstName').value;
    const last_name = document.getElementById('regLastName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    let onSuccess = () => {
      //document.getElementById('authModal').style.display = 'none';
      this.checkUserSession();
    }
    let onError = (error) => {
      document.getElementById('registerError').textContent = error;
    }

    this.state.ui.components.InteractiveScreen.ApiLoader.show()
    const result = await window.API.handleRegister(first_name, last_name, email, password);
    this.state.ui.components.InteractiveScreen.ApiLoader.hide()

    switch (result.success) {
      case true:
        onSuccess();
        break;
      case false:
        onError(result.error);
        break;
    }
  }

  async handleLogout() {
    await window.API.handleLogout();
  }

  async checkUserSession() {
    let onSuccess = (user) => {
      this.state.user.profile = user;
      this.state.ui.components.InteractiveScreen.AuthForm.hide()
    }
    let onError = (error) => {
      this.state.ui.components.InteractiveScreen.AuthForm.show()
      this.showCustomAlert(error);
    }


    this.state.ui.components.InteractiveScreen.ApiLoader.show()
    const result = await window.API.checkUserSession();
    this.state.ui.components.InteractiveScreen.ApiLoader.hide()

    switch (result.success) {
      case true:
        onSuccess(result.user);
        break;
      case false:
        onError(result.error);
        break;
    }
  }

  /* ===================================================================== */
  /* 10. THÈMES ET PRÉFÉRENCES                                            */
  /* ===================================================================== */

  async applyStoredTheme() {
    let onSuccess = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle("dark-theme", theme === "dark");
    }
    let onError = (error) => {
      this.showCustomAlert(error);
    }

    this.state.ui.components.InteractiveScreen.ApiLoader.show()
    const result = await window.API.getUserTheme();
    this.state.ui.components.InteractiveScreen.ApiLoader.hide()

    switch (result.success) {
      case true:
        onSuccess(result.theme);
        break;
      case false:
        onError(result.error);
        break;
    }
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle("dark-theme", theme === "dark");
    this.changeUserTheme(theme);
  }

  async changeUserTheme(newTheme) {
    let onSuccess = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
    }
    let onError = (error) => {
      this.showCustomAlert(error);
    }

    this.state.ui.components.InteractiveScreen.ApiLoader.show()
    const result = await window.API.setUserTheme(newTheme);
    this.state.ui.components.InteractiveScreen.ApiLoader.hide()

    switch (result.success) {
      case true:
        onSuccess(result.theme);
        break;
      case false:
        onError(result.error);
        break;
    }
  }

  /* ===================================================================== */
  /* 11. MODALS, PARAMÈTRES ET NAVIGATION MOBILE                           */
  /* ===================================================================== */



  checkIfSettingsISopenedFromStartup() {
    if (this.state.ui.openedFromStartup) {
      const restoreModal = document.getElementById("restoreModal");
      if (restoreModal) {
        restoreModal.classList.add("active");
      }
      this.state.ui.openedFromStartup = false;
    }
  }


  async applySettings() {
    const nameInput = document.getElementById('settingName');
    const colsInput = document.getElementById('settingCols');
    const rowsInput = document.getElementById('settingRows');

    const newName = nameInput ? nameInput.value.trim() : this.state.grid.name;
    if (!newName) {
      this.showCustomAlert("Veuillez entrer un nom valide pour la grille.");
      return;
    }

    const newCols = colsInput ? parseInt(colsInput.value, 10) : this.state.grid.cols;
    const newRows = rowsInput ? parseInt(rowsInput.value, 10) : this.state.grid.rows;

    try {
      const savedGrids = await this.getSavedGrids();
      if (savedGrids && savedGrids.hasOwnProperty(newName)) {
        const existingGrid = savedGrids[newName];
        if (this.state.grid.isCreatingNewGrid || !this.state.grid.id || existingGrid.id !== this.state.grid.id) {
          const overwrite = await this.showCustomConfirm(`Une grille portant le nom "${newName}" existe déjà dans le cloud. Voulez-vous l'écraser ?`);
          if (!overwrite) {
            return;
          } else {
            this.state.grid.id = existingGrid.id;
            this.state.grid.isCreatingNewGrid = false;
          }
        }
      }
    } catch (err) {
      console.error("Erreur lors de la vérification des doublons :", err);
    }

    if (this.state.grid.isCreatingNewGrid) {
      this.state.grid.id = null;
      this.state.grid.name = newName;
      this.state.grid.cols = newCols;
      this.state.grid.rows = newRows;
      this.state.grid.cells = this.createDefaultGridCells(this.state.grid.cols, this.state.grid.rows);
      this.state.navigation.selected = null;
      this.markAsClean();
    } else {
      this.state.grid.name = newName;

      if (newCols !== this.state.grid.cols || newRows !== this.state.grid.rows) {
        this.state.grid.cols = newCols;
        this.state.grid.rows = newRows;
        this.state.grid.cells = this.createDefaultGridCells(this.state.grid.cols, this.state.grid.rows);
        this.state.navigation.selected = null;
      }
      this.markAsDirty();
    }

    const method = this.state.grid.id ? 'PUT' : 'POST';
    const url = this.state.grid.id ? `./api/grids/${this.state.grid.id}` : './api/grids';

    try {
      this.state.ui.components.InteractiveScreen.ApiLoader.show()

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: this.state.grid.name,
          cols: this.state.grid.cols,
          rows: this.state.grid.rows,
          version: 2,
          content: {
            cells: this.state.grid.cells,
            mysteryWordConfig: this.state.grid.mysteryWordConfig
          }
        })
      });

      const data = await response.json();
      this.state.ui.components.InteractiveScreen.ApiLoader.hide()

      if (data.success) {
        if (data.id) {
          this.state.grid.id = data.id;
        }
        if (this.state.grid.isCreatingNewGrid) {
          this.state.grid.isCreatingNewGrid = false;
        }
        this.state.ui.openedFromStartup = false;
      } else {
        const errorMsg = "Erreur lors de l'enregistrement des paramètres : " + (data.error || "Erreur inconnue");
        this.showCustomAlert(errorMsg);
        return;
      }
    } catch (err) {
      console.error("Erreur réseau :", err);
      this.state.ui.components.InteractiveScreen.ApiLoader.hide()
      this.showCustomAlert("Impossible de contacter le serveur.");
      return;
    }

    this.updateGridDisplay();
    this.state.ui.components.InteractiveScreen.Modals.close()
  }




  async confirmSaveAs(destination, targetName) {

    const newName = document.getElementById("saveAsNameInput").value.trim();
    if (!newName) {
      this.showCustomAlert("Veuillez entrer un nom valide.");
      return;
    }
    targetName = newName;
    this.state.grid.id = null;


    if (destination === "cloud") {
      const savedGrids = await this.getSavedGrids();

      if (savedGrids && savedGrids.hasOwnProperty(targetName) && (targetName !== this.state.grid.name)) {
        const overwrite = await this.showCustomConfirm(`Une grille portant le nom "${targetName}" existe déjà dans le cloud. Voulez-vous l'écraser ?`);

        console.log("overwrite", overwrite)
        if (!overwrite) {
          return;
        }
      }

      this.state.grid.name = targetName;

      const payload = {
        id: this.state.grid.id,
        name: this.state.grid.name,
        cols: this.state.grid.cols,
        rows: this.state.grid.rows,
        version: 2,
        content: this.state.grid.cells
      };

      this.saveGridToCloud(payload);

      this.updateGridDisplay();
      this.state.ui.components.InteractiveScreen.Modals.close();
    } else if (destination === "file") {
      this.state.grid.name = targetName;
      const exportData = { version: 2, name: this.state.grid.name, cols: this.state.grid.cols, rows: this.state.grid.rows, cells: this.state.grid.cells };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${this.state.grid.name.replace(/\s+/g, "_")}.json`;
      a.click();
      this.updateGridDisplay();
      this.state.ui.components.InteractiveScreen.Modals.close();
    }
  }

  async openLoadModal() {


    // Ouvre la modale principale
    await this.state.ui.components.InteractiveScreen.Modals.open("open");

    // Récupération de la div #gridList cible
    const gridList = document.getElementById("gridList");

    if (!gridList) return;

    // Nettoyage préalable de la liste
    gridList.innerHTML = "";

    const savedGrids = await this.getSavedGrids();
    const names = savedGrids ? Object.keys(savedGrids) : [];



    if (names.length === 0) {
      gridList.innerHTML = "<div class='modal-empty'>Aucune grille sauvegardée dans le cloud pour le moment.</div>";
    } else {



      // Ajout dynamique de chaque ligne de grille
      names.forEach(name => {
        const gridInfo = savedGrids[name];
        const gridId = gridInfo.id || null;

        const isOpen = (name === this.state.grid.name) || (gridId && this.state.grid.id && gridId === this.state.grid.id);

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
          nameSpan.onclick = () => this.loadSelectedGrid(name);
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
            this.deleteSavedGrid(name, gridId);
          };
        }

        row.appendChild(nameSpan);
        row.appendChild(delBtn);
        gridList.appendChild(row);
      });
    }
  }

  loadFileInput() {
    document.getElementById('fileInput').click();
    this.state.ui.components.InteractiveScreen.Modals.close()
  }




  selectThemeAndClose(themeName) {
    this.setTheme(themeName);
    this.state.ui.components.InteractiveScreen.Modals.close()
  }



  closeRestoreModal() {
    const modal = document.getElementById("restoreModal");
    if (modal) modal.classList.remove("active");
  }

  openSectionModal(id) {
    this.closeAllSectionModals();
    const el = document.getElementById(id);
    if (el) el.classList.add("mobile-open");
    const backdrop = document.getElementById("mobileBackdrop");
    if (backdrop) backdrop.classList.add("active");
    this.state.ui.openSectionId = id;
  }

  closeAllSectionModals() {
    document.querySelectorAll(".main-section.mobile-open").forEach(el => el.classList.remove("mobile-open"));
    const backdrop = document.getElementById("mobileBackdrop");
    if (backdrop) backdrop.classList.remove("active");
    this.state.ui.openSectionId = null;
  }

  toggleMobileMenu(event) {
    if (event) event.stopPropagation();
    const topbar = document.querySelector(".topbar");
    const backdrop = document.getElementById("mobileBackdrop");
    if (!topbar) return;
    const isOpen = topbar.classList.toggle("mobile-menu-open");
    if (backdrop) backdrop.classList.toggle("active", isOpen);
  }

  closeMobileMenu() {
    const topbar = document.querySelector(".topbar");
    const backdrop = document.getElementById("mobileBackdrop");
    if (topbar) topbar.classList.remove("mobile-menu-open");
    if (backdrop) backdrop.classList.remove("active");
  }

  showCustomAlert(message) {
    if (this.state.ui.components.InteractiveScreen.CustomAlert) {
      this.state.ui.components.InteractiveScreen.CustomAlert.show(message);
    } else {
      alert(message); // Solution de secours si non chargé
    }
  }

  showCustomConfirm(message) {
    if (this.state.ui.components.InteractiveScreen.CustomConfirm) {
      return this.state.ui.components.InteractiveScreen.CustomConfirm.show(message);
    }
    else {
      return confirm(message)
    }
    return Promise.resolve(window.confirm(message));
  }


  updateSaveBadge() {
    const saveBtn = document.getElementById('saveBtn');
    if (!saveBtn) return;

    let badge = saveBtn.querySelector('.unsaved-badge');

    if (this.state.ui.hasUnsavedChanges) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'unsaved-badge save-badge';
        saveBtn.style.position = 'relative';
        saveBtn.appendChild(badge);
      }
    } else {
      if (badge) {
        badge.remove();
      }
    }
  }

  markAsDirty() {
    if (!this.state.ui.hasUnsavedChanges) {
      this.state.ui.hasUnsavedChanges = true;
      this.updateSaveBadge();
    }
  }

  markAsClean() {
    if (this.state.ui.hasUnsavedChanges) {
      this.state.ui.hasUnsavedChanges = false;
      this.updateSaveBadge();
    }
  }

  updateMysteryWordDisplay() {
    const displayEl = document.getElementById("mysteryWordDisplay");
    if (!displayEl) return;

    const len = this.state.grid.mysteryWordConfig.length || 9;
    let wordArr = Array(len).fill("_");

    this.state.grid.cells.forEach((cell) => {
      if (cell.isMystery && cell.mysteryPosition) {
        const pos = parseInt(cell.mysteryPosition, 10) - 1;
        if (pos >= 0 && pos < len) {
          const letter = cell.letter ? cell.letter.toUpperCase() : "_";
          wordArr[pos] = letter !== "" ? letter : "_";
        }
      }
    });

    displayEl.textContent = wordArr.join(" ");
  }

  toggleCellMystery(isChecked) {
    let mysteryCellOptionsContainer = document.getElementById("mysteryCellOptionsContainer");
    if (this.state.navigation.selected === null) return;
    this.state.grid.cells[this.state.navigation.selected].isMystery = isChecked;

    if (isChecked) {
      mysteryCellOptionsContainer.style.display = "block";

      const taken = this.getTakenMysteryPositions(this.state.navigation.selected);
      const maxLen = this.state.grid.mysteryWordConfig.length || 9;
      let availablePos = 1;

      for (let i = 1; i <= maxLen; i++) {
        if (!taken.has(i)) {
          availablePos = i;
          break;
        }
      }
      this.state.grid.cells[this.state.navigation.selected].mysteryPosition = availablePos;
    } else {
      mysteryCellOptionsContainer.style.display = "none";
    }

    this.updatePanel();
    this.updateMysteryWordDisplay();
    this.render();
    this.markAsDirty();
  }



  applyMysterySettings() {
    const input = document.getElementById('settingMysteryLength');
    if (input) {
      const newLen = parseInt(input.value, 10);
      if (newLen >= 1 && newLen <= 30) {
        this.state.grid.mysteryWordConfig.length = newLen;
        this.state.ui.components.InteractiveScreen.Modals.close()
        this.updateMysteryWordDisplay();
        this.markAsDirty();
      } else {
        this.showCustomAlert("Veuillez entrer une longueur valide entre 1 et 30.");
        return;
      }
    }
  }

  getTakenMysteryPositions(excludeIndex) {
    const taken = new Set();
    this.state.grid.cells.forEach((cell, idx) => {
      if (cell.isMystery && cell.mysteryPosition && idx !== excludeIndex) {
        taken.add(parseInt(cell.mysteryPosition, 10));
      }
    });
    return taken;
  }

  updateCellMysteryPosition(posValue) {
    if (this.state.navigation.selected === null) return;
    let pos = parseInt(posValue, 10);
    if (isNaN(pos) || pos < 1) pos = 1;

    const maxLen = this.state.grid.mysteryWordConfig.length || 9;
    if (pos > maxLen) {
      pos = maxLen;
    }

    const takenPositions = this.getTakenMysteryPositions(this.state.navigation.selected);
    if (takenPositions.has(pos)) {
      this.showCustomAlert(`La position ${pos} est déjà utilisée par une autre lettre du mot mystère.`);
      return;
    }

    this.state.grid.cells[this.state.navigation.selected].mysteryPosition = pos;

    this.updateMysteryWordDisplay();
    this.render();
    this.markAsDirty();

    this.renderCellMysteryPositionButtons(pos);
  }

  renderCellMysteryPositionButtons(currentPos) {
    const container = document.getElementById('cellMysteryPosButtonsContainer');
    if (!container) return;
    container.innerHTML = '';

    const maxLen = this.state.grid.mysteryWordConfig.length || 9;
    const takenPositions = this.getTakenMysteryPositions(this.state.navigation.selected);

    for (let i = 1; i <= maxLen; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = i;
      btn.className = 'mystery-pos-btn';

      const isTaken = takenPositions.has(i);
      const isCurrent = (i === currentPos);

      if (isTaken) {
        btn.classList.add("not-allowed");
        btn.style.cursor = 'not-allowed';
        btn.disabled = true;
        btn.title = "Cette position est déjà occupée";
      } else {
        if (isCurrent) {
          btn.style.backgroundColor = 'var(--theme-color-strong)';
          btn.style.color = 'white';
        } else {
          btn.style.backgroundColor = '';
        }

        btn.onclick = () => {
          this.updateCellMysteryPosition(i);
        };
      }

      container.appendChild(btn);
    }
  }

  toggleCellSeparator(isChecked) {
    if (this.state.navigation.selected === null || this.state.grid.cells[this.state.navigation.selected].type !== "letter") return;
    this.state.grid.cells[this.state.navigation.selected].isSeparator = isChecked;
    if (!isChecked) {
      this.state.grid.cells[this.state.navigation.selected].borderRight = false;
      this.state.grid.cells[this.state.navigation.selected].borderBottom = false;
    }
    this.updatePanel();
    this.render();
    this.markAsDirty();
  }

  toggleCellBorderRight(isChecked) {
    if (this.state.navigation.selected === null || this.state.grid.cells[this.state.navigation.selected].type !== "letter") return;
    this.state.grid.cells[this.state.navigation.selected].borderRight = isChecked;
    this.render();
    this.markAsDirty();
  }

  toggleCellBorderBottom(isChecked) {
    if (this.state.navigation.selected === null || this.state.grid.cells[this.state.navigation.selected].type !== "letter") return;
    this.state.grid.cells[this.state.navigation.selected].borderBottom = isChecked;
    this.render();
    this.markAsDirty();
  }

  fadeAppLoader() {
    const elapsedTime = Date.now() - this.state.ui.startTime;
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
  }
}

// Initialisation et instanciation globale de l'application
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});