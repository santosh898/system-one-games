/**
 * 16-Bit Retro Battleship Game Engine v2.0
 * Features:
 * - High-Fidelity SVG Naval Warships
 * - Interactive Drag-and-Drop Fleet Deployment
 * - Parabolic Missile / Bomb Arc Flight Animation
 * - Retro Speech Bubble Reactions on Battleground & Warships
 * - Dynamic Turn Visual Color & Badge Feedback
 */

const SHIPS_CONFIG = [
  { id: 'carrier', name: 'CARRIER', length: 5 },
  { id: 'battleship', name: 'BATTLESHIP', length: 4 },
  { id: 'cruiser', name: 'CRUISER', length: 3 },
  { id: 'submarine', name: 'SUBMARINE', length: 3 },
  { id: 'destroyer', name: 'DESTROYER', length: 2 },
];

const CELL_SIZE = 32;
const CELL_GAP = 2;
const GRID_OFFSET = 26; // 24px header + 2px gap

class BattleshipGame {
  constructor() {
    this.mode = '1P'; // '1P' or 'SPECTATOR'
    this.phase = 'DEPLOYMENT'; // 'DEPLOYMENT', 'BATTLE', 'GAMEOVER'
    this.currentTurn = 'PLAYER'; // 'PLAYER', 'SYSTEM_ONE', 'CPU'
    this.simRunning = false;
    this.simSpeed = 800; // ms
    this.stepTimeout = null;

    // Boards state
    this.boardLeft = this.createEmptyBoard();
    this.fleetLeft = []; // Array of { id, name, length, isVertical, startR, startC, coords, hits, sunk }

    this.boardRight = this.createEmptyBoard();
    this.fleetRight = [];

    // Radar memories
    this.radarLeftAgainstRight = this.createEmptyRadar();
    this.radarRightAgainstLeft = this.createEmptyRadar();

    // Chronological artillery shot histories
    this.shotHistoryAgainstLeft = [];  // Shots fired at Left board
    this.shotHistoryAgainstRight = []; // Shots fired at Right board

    // Drag and Drop state
    this.dragState = {
      isDragging: false,
      shipId: null,
      length: 0,
      isVertical: false,
      source: null, // 'dock' or 'grid'
      originR: null,
      originC: null,
      hoverR: null,
      hoverC: null,
      isValid: false
    };

    this.placementOrientation = false; // false = Horizontal, true = Vertical

    // Stats
    this.stats = {
      turns: 0,
      leftShots: 0,
      leftHits: 0,
      rightShots: 0,
      rightHits: 0
    };

    // DOM & FX
    this.initDOMElements();
    window.retroNavalFX.init();
    this.attachEventListeners();
    this.attachDragEvents();

    // Start in 1P mode
    this.init1PMode();
  }

  createEmptyBoard() {
    return Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => ({
        row: r,
        col: c,
        shipId: null,
        state: 'empty'
      }))
    );
  }

  createEmptyRadar() {
    return Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => ({
        row: r,
        col: c,
        state: 'empty'
      }))
    );
  }

  initDOMElements() {
    this.gridLeftEl = document.getElementById('gridLeft');
    this.gridRightEl = document.getElementById('gridRight');
    this.shipsOverlayLeft = document.getElementById('shipsOverlayLeft');
    this.shipsOverlayRight = document.getElementById('shipsOverlayRight');
    this.boardCardLeft = document.getElementById('boardCardLeft');
    this.boardCardRight = document.getElementById('boardCardRight');
    this.titleBoardLeft = document.getElementById('titleBoardLeft');
    this.tagBoardLeft = document.getElementById('tagBoardLeft');
    this.titleBoardRight = document.getElementById('titleBoardRight');
    this.tagBoardRight = document.getElementById('tagBoardRight');
    this.fleetRackLeft = document.getElementById('fleetRackLeft');
    this.fleetRackRight = document.getElementById('fleetRackRight');
    this.statusBanner = document.getElementById('statusBanner');
    this.shipyardDockContainer = document.getElementById('shipyardDockContainer');
    this.dockShipsRow = document.getElementById('dockShipsRow');
    this.deploymentBar = document.getElementById('deploymentBar');
    this.actionControlsBar = document.getElementById('actionControlsBar');
    this.combatLog = document.getElementById('combatLog');
    this.valLatency = document.getElementById('valLatency');
    this.valConfidence = document.getElementById('valConfidence');
    this.valStrategy = document.getElementById('valStrategy');
    this.valEndpoint = document.getElementById('valEndpoint');
    this.lblAiStatus = document.getElementById('lblAiStatus');
    this.probabilityMeters = document.getElementById('probabilityMeters');
    this.asciiRadarTerminal = document.getElementById('asciiRadarTerminal');
    this.valModelName = document.getElementById('valModelName');

    // Controls
    this.btnMode1P = document.getElementById('btnMode1P');
    this.btnModeSpectator = document.getElementById('btnModeSpectator');
    this.btnAutoDeploy = document.getElementById('btnAutoDeploy');
    this.btnClearFleet = document.getElementById('btnClearFleet');
    this.btnRotateShip = document.getElementById('btnRotateShip');
    this.placementHint = document.getElementById('placementHint');
    this.btnStartBattle = document.getElementById('btnStartBattle');
    this.btnSpectatorPlay = document.getElementById('btnSpectatorPlay');
    this.btnSpectatorPause = document.getElementById('btnSpectatorPause');
    this.btnSpectatorStep = document.getElementById('btnSpectatorStep');
    this.btnResetMatch = document.getElementById('btnResetMatch');
    this.selectSpeed = document.getElementById('selectSpeed');
    this.btnCrtToggle = document.getElementById('btnCrtToggle');
    this.btnSoundToggle = document.getElementById('btnSoundToggle');
    this.btnClearLog = document.getElementById('btnClearLog');
  }

  attachEventListeners() {
    this.btnMode1P.addEventListener('click', () => {
      if (this.mode === '1P') return;
      window.retroAudio.playClick();
      this.init1PMode();
    });

    this.btnModeSpectator.addEventListener('click', () => {
      if (this.mode === 'SPECTATOR') return;
      window.retroAudio.playClick();
      this.initSpectatorMode();
    });

    this.btnAutoDeploy.addEventListener('click', () => {
      window.retroAudio.playSonar();
      this.randomizePlayerFleet();
      this.render();
      this.log('DEFENSE', 'FLEET AUTO-DEPLOYED TO COMBAT STATIONS.');
      window.retroNavalFX.showSpeechBubble({
        boardSide: 'left',
        speaker: 'PLAYER',
        text: 'All 5 warships in optimal formation. Ready for engagement!'
      });
    });

    this.btnClearFleet.addEventListener('click', () => {
      window.retroAudio.playClick();
      this.clearPlayerFleet();
      this.render();
      this.log('DEFENSE', 'FLEET CLEARED. WARSHIPS RETURNED TO DRYDOCK.');
    });

    this.btnRotateShip.addEventListener('click', () => {
      this.togglePlacementOrientation();
    });

    // 'R' key rotates ship
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (this.phase === 'DEPLOYMENT') {
          this.togglePlacementOrientation();
        }
      }
    });

    this.btnStartBattle.addEventListener('click', () => {
      if (this.fleetLeft.length < 5) {
        window.retroAudio.playClick();
        this.statusBanner.textContent = 'DEPLOY ALL 5 SHIPS BEFORE ENGAGING!';
        window.retroNavalFX.showSpeechBubble({
          boardSide: 'left',
          speaker: 'PLAYER',
          text: 'Admiral, we need all 5 warships placed on the grid first!'
        });
        return;
      }
      window.retroAudio.playLaunch();
      this.start1PBattle();
    });

    this.btnSpectatorPlay.addEventListener('click', () => {
      window.retroAudio.playClick();
      this.startSpectatorSimulation();
    });

    this.btnSpectatorPause.addEventListener('click', () => {
      window.retroAudio.playClick();
      this.pauseSpectatorSimulation();
    });

    this.btnSpectatorStep.addEventListener('click', () => {
      window.retroAudio.playClick();
      this.stepSpectatorTurn();
    });

    this.btnResetMatch.addEventListener('click', () => {
      window.retroAudio.playSonar();
      if (this.mode === '1P') {
        this.init1PMode();
      } else {
        this.initSpectatorMode();
      }
    });

    this.selectSpeed.addEventListener('change', (e) => {
      const speeds = { turbo: 250, fast: 800, normal: 1600, slow: 3000 };
      this.simSpeed = speeds[e.target.value] || 800;
    });

    this.btnSoundToggle.addEventListener('click', () => {
      const muted = window.retroAudio.toggleMute();
      this.btnSoundToggle.textContent = muted ? '🔇 MUTED' : '🔊 SOUND ON';
    });

    this.btnCrtToggle.addEventListener('click', () => {
      const isActive = document.body.classList.toggle('crt-active');
      this.btnCrtToggle.textContent = isActive ? '📺 CRT: ON' : '📺 CRT: OFF';
    });

    this.btnClearLog.addEventListener('click', () => {
      this.combatLog.innerHTML = '';
      this.log('SYS', 'LOG CLEARED.');
    });
  }

  togglePlacementOrientation() {
    this.placementOrientation = !this.placementOrientation;
    window.retroAudio.playClick();
    this.placementHint.textContent = `Orientation: ${this.placementOrientation ? 'VERTICAL' : 'HORIZONTAL'}`;
    this.btnRotateShip.textContent = `🔄 ROTATE (${this.placementOrientation ? 'VERT' : 'HORIZ'})`;
    this.renderDock();
  }

  // --- DRAG AND DROP MECHANICS ---

  attachDragEvents() {
    // When pointer moves over gridLeft in deployment phase
    this.gridLeftEl.addEventListener('pointermove', (e) => {
      if (!this.dragState.isDragging || this.phase !== 'DEPLOYMENT') return;

      const cell = e.target.closest('.grid-cell');
      if (cell && cell.dataset.col !== undefined) {
        const c = parseInt(cell.dataset.col, 10);
        const r = parseInt(cell.dataset.row, 10);
        this.handleDragHover(c, r);
      }
    });

    this.gridLeftEl.addEventListener('pointerleave', () => {
      if (this.dragState.isDragging) {
        this.clearGhostHighlight();
      }
    });

    // Drop on window pointerup
    window.addEventListener('pointerup', () => {
      if (this.dragState.isDragging) {
        this.finishDragDrop();
      }
    });
  }

  handleDragHover(col, row) {
    this.dragState.hoverR = row;
    this.dragState.hoverC = col;

    const length = this.dragState.length;
    const isVert = this.dragState.isVertical;

    // Check validity
    let isValid = true;
    const coords = [];

    for (let i = 0; i < length; i++) {
      const r = isVert ? row + i : row;
      const c = isVert ? col : col + i;

      if (r < 0 || r >= 10 || c < 0 || c >= 10) {
        isValid = false;
        break;
      }

      // Check collision with other ships (excluding itself if moving from grid)
      const existing = this.boardLeft[r][c].shipId;
      if (existing && existing !== this.dragState.shipId) {
        isValid = false;
        break;
      }

      coords.push({ r, c });
    }

    this.dragState.isValid = isValid;
    this.renderGhostHighlight(coords, isValid);
  }

  renderGhostHighlight(coords, isValid) {
    this.clearGhostHighlight();
    const className = isValid ? 'drag-ghost-valid' : 'drag-ghost-invalid';

    coords.forEach(({ r, c }) => {
      const cellEl = this.gridLeftEl.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
      if (cellEl) {
        cellEl.classList.add(className);
      }
    });
  }

  clearGhostHighlight() {
    const ghosts = this.gridLeftEl.querySelectorAll('.drag-ghost-valid, .drag-ghost-invalid');
    ghosts.forEach(el => el.classList.remove('drag-ghost-valid', 'drag-ghost-invalid'));
  }

  finishDragDrop() {
    const { shipId, length, isVertical, isValid, hoverR, hoverC, source, originR, originC } = this.dragState;
    this.clearGhostHighlight();

    if (isValid && hoverR !== null && hoverC !== null) {
      // If moving from grid, remove old placement
      if (source === 'grid') {
        this.removeShipFromBoard(shipId, this.boardLeft, this.fleetLeft);
      }

      // Place ship at new coords
      const coords = [];
      for (let i = 0; i < length; i++) {
        const r = isVertical ? hoverR + i : hoverR;
        const c = isVertical ? hoverC : hoverC + i;
        this.boardLeft[r][c].shipId = shipId;
        coords.push({ r, c });
      }

      const shipCfg = SHIPS_CONFIG.find(s => s.id === shipId);
      this.fleetLeft.push({
        id: shipId,
        name: shipCfg.name,
        length,
        isVertical,
        startR: hoverR,
        startC: hoverC,
        coords,
        hits: 0,
        sunk: false
      });

      window.retroAudio.playClick();
      this.log('DEFENSE', `${shipCfg.name} DEPLOYED TO ${COLS[hoverC]}${hoverR + 1}.`);
    } else {
      // Revert if invalid and originated on grid
      if (source === 'grid' && originR !== null && originC !== null) {
        // Already still in fleet
      }
    }

    this.dragState.isDragging = false;
    this.render();
  }

  removeShipFromBoard(shipId, board, fleet) {
    const idx = fleet.findIndex(s => s.id === shipId);
    if (idx !== -1) {
      const ship = fleet[idx];
      ship.coords.forEach(({ r, c }) => {
        board[r][c].shipId = null;
      });
      fleet.splice(idx, 1);
    }
  }

  // --- INITIALIZATION MODES ---

  init1PMode() {
    this.pauseSpectatorSimulation();
    this.mode = '1P';
    this.phase = 'DEPLOYMENT';
    this.currentTurn = 'PLAYER';

    this.btnMode1P.classList.add('active');
    this.btnModeSpectator.classList.remove('active');

    this.shipyardDockContainer.style.display = 'flex';
    this.deploymentBar.style.display = 'flex';
    this.actionControlsBar.style.display = 'none';

    this.titleBoardLeft.textContent = '🛡️ YOUR FLEET';
    this.tagBoardLeft.textContent = 'PLAYER DEFENSE';
    this.titleBoardRight.textContent = '🎯 SYSTEM ONE RADAR';
    this.tagBoardRight.textContent = 'FOG OF WAR (HIDDEN)';
    this.tagBoardRight.className = 'board-tag';

    this.statusBanner.textContent = 'DEPLOY FLEET: DRAG SHIPS TO GRID OR RANDOMIZE';

    this.boardLeft = this.createEmptyBoard();
    this.boardRight = this.createEmptyBoard();
    this.radarLeftAgainstRight = this.createEmptyRadar();
    this.radarRightAgainstLeft = this.createEmptyRadar();
    this.shotHistoryAgainstLeft = [];
    this.shotHistoryAgainstRight = [];

    // Auto-deploy initially for immediate action
    this.randomizePlayerFleet();
    this.fleetRight = this.placeFleetRandomly(this.boardRight);

    this.resetStats();
    this.setTurnVisuals('NONE');
    this.render();

    this.log('SYS', '1-PLAYER MODE ACTIVE: CREW STANDING BY FOR ORDERS.');
    window.retroNavalFX.showSpeechBubble({
      boardSide: 'left',
      role: 'captain',
      text: 'Captain Vance: All departments reporting ready. Awaiting battle stations orders!',
      meta: 'BATTLE READY'
    });
  }

  initSpectatorMode() {
    this.pauseSpectatorSimulation();
    this.mode = 'SPECTATOR';
    this.phase = 'READY';
    this.currentTurn = 'SYSTEM_ONE';

    this.btnModeSpectator.classList.add('active');
    this.btnMode1P.classList.remove('active');

    this.shipyardDockContainer.style.display = 'none';
    this.deploymentBar.style.display = 'none';
    this.actionControlsBar.style.display = 'flex';

    this.titleBoardLeft.textContent = '🧠 SYSTEM ONE FLEET';
    this.tagBoardLeft.className = 'board-tag spectator-tag';

    this.titleBoardRight.textContent = '🤖 NORMAL CPU FLEET';
    this.tagBoardRight.textContent = 'SPECTATOR: CPU VISIBLE';
    this.tagBoardRight.className = 'board-tag spectator-tag';

    this.statusBanner.textContent = 'SPECTATOR DUEL: BOTH BATTLEGROUNDS VISIBLE';

    this.boardLeft = this.createEmptyBoard();
    this.boardRight = this.createEmptyBoard();
    this.radarLeftAgainstRight = this.createEmptyRadar();
    this.radarRightAgainstLeft = this.createEmptyRadar();
    this.shotHistoryAgainstLeft = [];
    this.shotHistoryAgainstRight = [];

    this.fleetLeft = this.placeFleetRandomly(this.boardLeft);
    this.fleetRight = this.placeFleetRandomly(this.boardRight);

    this.resetStats();
    this.setTurnVisuals('SYSTEM_ONE');
    this.render();

    this.log('SYS', 'SPECTATOR MODE ACTIVE: SYSTEM ONE VS NORMAL CPU.');
    window.retroNavalFX.showSpeechBubble({
      boardSide: 'left',
      role: 'sonar',
      text: 'Sonar Officer Henderson: Active sonar scan tracking CPU acoustic profile across open grid.',
      meta: 'RADAR LOCK'
    });
  }

  resetStats() {
    this.stats = {
      turns: 0,
      leftShots: 0,
      leftHits: 0,
      rightShots: 0,
      rightHits: 0
    };
  }

  // --- FLEET PLACEMENT ---

  clearPlayerFleet() {
    this.boardLeft = this.createEmptyBoard();
    this.fleetLeft = [];
  }

  randomizePlayerFleet() {
    this.boardLeft = this.createEmptyBoard();
    this.fleetLeft = this.placeFleetRandomly(this.boardLeft);
  }

  placeFleetRandomly(board) {
    const fleet = [];

    for (const shipCfg of SHIPS_CONFIG) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 250) {
        attempts++;
        const isVertical = Math.random() < 0.5;
        const maxRow = isVertical ? 10 - shipCfg.length : 10;
        const maxCol = isVertical ? 10 : 10 - shipCfg.length;
        const startR = Math.floor(Math.random() * maxRow);
        const startC = Math.floor(Math.random() * maxCol);

        let collision = false;
        const coords = [];
        for (let i = 0; i < shipCfg.length; i++) {
          const r = isVertical ? startR + i : startR;
          const c = isVertical ? startC : startC + i;
          if (board[r][c].shipId !== null) {
            collision = true;
            break;
          }
          coords.push({ r, c });
        }

        if (!collision) {
          coords.forEach(({ r, c }) => {
            board[r][c].shipId = shipCfg.id;
          });
          fleet.push({
            id: shipCfg.id,
            name: shipCfg.name,
            length: shipCfg.length,
            isVertical,
            startR,
            startC,
            coords,
            hits: 0,
            sunk: false
          });
          placed = true;
        }
      }
    }

    return fleet;
  }

  // --- 1-PLAYER BATTLE FLOW ---

  start1PBattle() {
    this.phase = 'BATTLE';
    this.currentTurn = 'PLAYER';
    this.shipyardDockContainer.style.display = 'none';
    this.deploymentBar.style.display = 'none';
    this.actionControlsBar.style.display = 'flex';
    this.btnSpectatorPlay.style.display = 'none';
    this.btnSpectatorPause.style.display = 'none';
    this.btnSpectatorStep.style.display = 'none';

    this.setTurnVisuals('PLAYER');
    this.statusBanner.textContent = 'YOUR TURN: SELECT ENEMY RADAR COORDINATE TO FIRE!';
    this.log('SYS', 'BATTLE ENGAGED! TARGET ENEMY RADAR WITH ARTILLERY.');

    window.retroNavalFX.showSpeechBubble({
      boardSide: 'left',
      role: 'captain',
      text: 'Captain Vance: General quarters! All gun batteries, commence tactical bombardment!',
      meta: 'BATTLE STATIONS'
    });

    this.render();
  }

  async handlePlayerCellClick(col, row) {
    if (this.mode !== '1P' || this.phase !== 'BATTLE' || this.currentTurn !== 'PLAYER') {
      return;
    }

    const cell = this.boardRight[row][col];
    if (cell.state !== 'empty') {
      window.retroAudio.playClick();
      return;
    }

    this.currentTurn = 'PROCESSING';
    this.stats.leftShots++;
    const coordName = `${COLS[col]}${row + 1}`;

    const hitShip = cell.shipId ? this.fleetRight.find(s => s.id === cell.shipId) : null;
    const isHit = !!hitShip;
    const willSink = isHit && (hitShip.hits + 1 >= hitShip.length);

    // Get DOM elements for missile flight arc
    const fromEl = this.boardCardLeft;
    const toEl = this.gridRightEl.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);

    window.retroAudio.playLaunch();
    window.retroNavalFX.showSpeechBubble({
      boardSide: 'left',
      role: 'weapons',
      text: `Weapons Officer Kowalski: Main battery fired on sector ${coordName}!`,
      meta: `LAUNCH -> ${coordName}`
    });

    // Launch artillery projectile arc animation
    window.retroNavalFX.launchArtillery({
      fromEl,
      toEl,
      isHit,
      isSunk: willSink,
      onImpact: async () => {
        const shotResult = isHit ? (willSink ? 'SUNK' : 'HIT') : 'MISS';
        this.shotHistoryAgainstRight.push({
          turn: this.stats.turns,
          shooter: 'PLAYER',
          coord: coordName,
          result: shotResult,
          shipName: hitShip ? hitShip.name : null
        });

        if (isHit) {
          cell.state = 'hit';
          this.radarLeftAgainstRight[row][col].state = 'hit';
          this.stats.leftHits++;
          hitShip.hits++;

          if (willSink) {
            hitShip.sunk = true;
            hitShip.coords.forEach(({ r, c }) => {
              this.boardRight[r][c].state = 'sunk';
              this.radarLeftAgainstRight[r][c].state = 'sunk';
            });
            window.retroAudio.playSunk();
            this.log('HIT', `DIRECT HIT ON ${coordName}! ENEMY ${hitShip.name} DESTROYED!`);
            this.statusBanner.textContent = `💥 ENEMY ${hitShip.name} DESTROYED!`;

            window.retroNavalFX.showSpeechBubble({
              boardSide: 'left',
              role: 'captain',
              text: `Captain Vance: Target destroyed! Hostile ${hitShip.name} confirmed sunk! Outstanding shooting, crew!`,
              meta: 'ENEMY SUNK'
            });
          } else {
            window.retroAudio.playHit();
            this.log('HIT', `DIRECT HIT AT ${coordName}! ENEMY VESSEL DAMAGED.`);
            this.statusBanner.textContent = `💥 DIRECT HIT AT ${coordName}!`;

            window.retroNavalFX.showSpeechBubble({
              boardSide: 'left',
              role: 'lookout',
              text: `Lookout Martinez: Direct hit on hostile vessel at ${coordName}! Heavy black smoke detected!`,
              meta: 'TARGET HIT'
            });
          }
        } else {
          cell.state = 'miss';
          this.radarLeftAgainstRight[row][col].state = 'miss';
          window.retroAudio.playMiss();
          this.log('MISS', `SPLASH AT ${coordName}: NO TARGET DETECTED.`);
          this.statusBanner.textContent = `WATER SPLASH AT ${coordName}.`;

          window.retroNavalFX.showSpeechBubble({
            boardSide: 'left',
            role: 'radar',
            text: `Radar Specialist Chen: Water geyser at ${coordName}. No hull contact confirmed.`,
            meta: 'MISS'
          });
        }

        this.render();

        // Check Player Victory
        if (this.fleetRight.every(s => s.sunk)) {
          this.endGame('PLAYER');
          return;
        }

        // AI Turn
        this.currentTurn = 'SYSTEM_ONE';
        this.setTurnVisuals('SYSTEM_ONE');
        this.statusBanner.textContent = '🧠 SYSTEM ONE IS CALCULATING ARTILLERY TARGET...';
        this.lblAiStatus.textContent = 'TARGETING...';
        this.lblAiStatus.style.color = 'var(--accent-gold)';

        await this.delay(500);
        await this.executeSystemOneTurn();
      }
    });
  }

  // --- SYSTEM ONE AI EXECUTION ---

  async executeSystemOneTurn() {
    const survivingLeft = this.fleetLeft.filter(s => !s.sunk);

    let decision = null;
    try {
      decision = await window.systemOneAI.getNextShot(this.radarRightAgainstLeft, survivingLeft, this.shotHistoryAgainstLeft);
    } catch (err) {
      console.error("System One AI error:", err);
    }

    if (!decision) {
      decision = window.normalComputerAI.getNextShot(this.radarRightAgainstLeft, survivingLeft);
    }

    this.updateAiTelemetry(decision);

    const { colIdx, rowIdx } = decision;
    const coordName = coordToKey(colIdx, rowIdx);

    const probPct = decision.probabilities && decision.probabilities[coordName]
      ? Math.round(decision.probabilities[coordName] * 100)
      : Math.round((decision.confidence || 0.85) * 100);

    let reactionText = '';
    let crewRole = 'weapons';
    if (decision.mode === 'TARGET') {
      reactionText = `Weapons Officer: Active hit confirmed! Firing continuous salvo into ${coordName} (${probPct}% probability)!`;
      crewRole = 'weapons';
    } else {
      reactionText = `Sonar Officer: Strategic scan shows open density at sector ${coordName} (${probPct}% confidence). Salvo launched!`;
      crewRole = 'sonar';
    }

    window.retroNavalFX.showSpeechBubble({
      boardSide: 'right',
      role: crewRole,
      text: reactionText,
      meta: `${coordName} [${probPct}%]`
    });

    await this.delay(350);

    // Projectile Flight Arc from Right (AI) to Left (Player)
    const fromEl = this.boardCardRight;
    const toEl = this.gridLeftEl.querySelector(`.grid-cell[data-row="${rowIdx}"][data-col="${colIdx}"]`);

    const cell = this.boardLeft[rowIdx][colIdx];
    const hitShip = cell.shipId ? this.fleetLeft.find(s => s.id === cell.shipId) : null;
    const isHit = !!hitShip;
    const willSink = isHit && (hitShip.hits + 1 >= hitShip.length);

    this.stats.rightShots++;
    window.retroAudio.playLaunch();

    window.retroNavalFX.launchArtillery({
      fromEl,
      toEl,
      isHit,
      isSunk: willSink,
      onImpact: async () => {
        const shotResult = isHit ? (willSink ? 'SUNK' : 'HIT') : 'MISS';
        this.shotHistoryAgainstLeft.push({
          turn: this.stats.turns,
          shooter: 'SYSTEM_ONE',
          coord: coordName,
          result: shotResult,
          shipName: hitShip ? hitShip.name : null
        });

        if (isHit) {
          cell.state = 'hit';
          this.radarRightAgainstLeft[rowIdx][colIdx].state = 'hit';
          this.stats.rightHits++;
          hitShip.hits++;

          if (willSink) {
            hitShip.sunk = true;
            hitShip.coords.forEach(({ r, c }) => {
              this.boardLeft[r][c].state = 'sunk';
              this.radarRightAgainstLeft[r][c].state = 'sunk';
            });
            window.retroAudio.playSunk();
            this.log('AI', `SYSTEM ONE DESTROYED YOUR ${hitShip.name} AT ${coordName}!`);
            this.statusBanner.textContent = `⚠️ YOUR ${hitShip.name} SUNK BY SYSTEM ONE!`;

            window.retroNavalFX.showSpeechBubble({
              boardSide: 'left',
              role: 'damage',
              text: `Damage Control Chief Miller: Hull breach uncontrollable! All hands abandon our ${hitShip.name}!`,
              meta: 'SHIP LOST'
            });
          } else {
            window.retroAudio.playHit();
            this.log('AI', `SYSTEM ONE STRIKES ${coordName}! VESSEL DAMAGED.`);
            this.statusBanner.textContent = `⚠️ INCOMING HIT AT ${coordName}!`;

            window.retroNavalFX.showSpeechBubble({
              boardSide: 'left',
              role: 'damage',
              text: `Damage Control Chief Miller: BRACE FOR IMPACT! Bulkhead ruptured on our ${hitShip.name} at ${coordName}!`,
              meta: 'HULL BREACH'
            });
          }
        } else {
          cell.state = 'miss';
          this.radarRightAgainstLeft[rowIdx][colIdx].state = 'miss';
          window.retroAudio.playMiss();
          this.log('AI', `SYSTEM ONE FIRED AT ${coordName}: MISS.`);
          this.statusBanner.textContent = `SYSTEM ONE MISSED AT ${coordName}. YOUR TURN!`;

          window.retroNavalFX.showSpeechBubble({
            boardSide: 'left',
            role: 'lookout',
            text: `Lookout Martinez: Splash at ${coordName}! Enemy artillery missed wide!`,
            meta: 'SPLASH'
          });
        }

        // Check AI Victory
        if (this.fleetLeft.every(s => s.sunk)) {
          this.render();
          this.endGame('SYSTEM_ONE');
          return;
        }

        if (this.mode === '1P') {
          this.currentTurn = 'PLAYER';
          this.setTurnVisuals('PLAYER');
          this.lblAiStatus.textContent = 'IDLE';
          this.lblAiStatus.style.color = 'var(--accent-green)';
          this.statusBanner.textContent = 'YOUR TURN: SELECT ENEMY RADAR COORDINATE TO FIRE!';
        }

        this.render();
      }
    });
  }

  // --- SPECTATOR DUEL SIMULATION ---

  startSpectatorSimulation() {
    if (this.simRunning) return;
    this.simRunning = true;
    this.btnSpectatorPlay.disabled = true;
    this.btnSpectatorPause.disabled = false;
    this.btnSpectatorStep.disabled = true;
    this.runSpectatorLoop();
  }

  pauseSpectatorSimulation() {
    this.simRunning = false;
    if (this.stepTimeout) {
      clearTimeout(this.stepTimeout);
      this.stepTimeout = null;
    }
    this.btnSpectatorPlay.disabled = false;
    this.btnSpectatorPause.disabled = true;
    this.btnSpectatorStep.disabled = false;
  }

  async runSpectatorLoop() {
    if (!this.simRunning || this.phase === 'GAMEOVER') return;

    await this.stepSpectatorTurn();

    if (this.simRunning && this.phase !== 'GAMEOVER') {
      this.stepTimeout = setTimeout(() => {
        this.runSpectatorLoop();
      }, this.simSpeed);
    }
  }

  async stepSpectatorTurn() {
    if (this.phase === 'GAMEOVER') return;

    this.stats.turns++;

    if (this.currentTurn === 'SYSTEM_ONE') {
      // System One attacks Normal CPU (Board Right)
      this.setTurnVisuals('SYSTEM_ONE');
      this.statusBanner.textContent = '🧠 SYSTEM ONE FIRING AT NORMAL CPU...';
      const survivingRight = this.fleetRight.filter(s => !s.sunk);

      let decision = null;
      try {
        decision = await window.systemOneAI.getNextShot(this.radarLeftAgainstRight, survivingRight, this.shotHistoryAgainstRight);
      } catch (e) {
        console.error(e);
      }
      if (!decision) {
        decision = window.normalComputerAI.getNextShot(this.radarLeftAgainstRight, survivingRight);
      }

      this.updateAiTelemetry(decision);

      const { colIdx, rowIdx } = decision;
      const coordName = coordToKey(colIdx, rowIdx);

      const probPct = decision.probabilities && decision.probabilities[coordName]
        ? Math.round(decision.probabilities[coordName] * 100)
        : Math.round((decision.confidence || 0.8) * 100);

      const crewRole = decision.mode === 'TARGET' ? 'weapons' : 'sonar';
      const actionText = decision.mode === 'TARGET'
        ? `Weapons Officer: Tracking active hit! Directing battery salvo to ${coordName} (${probPct}% probability)!`
        : `Sonar Officer: Recon sweep identifies open quadrant at ${coordName} (${probPct}% confidence). Salvo away!`;

      window.retroNavalFX.showSpeechBubble({
        boardSide: 'left',
        role: crewRole,
        text: actionText,
        meta: `FIRE -> ${coordName}`
      });

      const cell = this.boardRight[rowIdx][colIdx];
      const hitShip = cell.shipId ? this.fleetRight.find(s => s.id === cell.shipId) : null;
      const isHit = !!hitShip;
      const willSink = isHit && (hitShip.hits + 1 >= hitShip.length);

      const fromEl = this.boardCardLeft;
      const toEl = this.gridRightEl.querySelector(`.grid-cell[data-row="${rowIdx}"][data-col="${colIdx}"]`);

      this.stats.leftShots++;
      window.retroAudio.playLaunch();

      await new Promise(resolve => {
        window.retroNavalFX.launchArtillery({
          fromEl,
          toEl,
          isHit,
          isSunk: willSink,
          onImpact: () => {
            const shotResult = isHit ? (willSink ? 'SUNK' : 'HIT') : 'MISS';
            this.shotHistoryAgainstRight.push({
              turn: this.stats.turns,
              shooter: 'SYSTEM_ONE',
              coord: coordName,
              result: shotResult,
              shipName: hitShip ? hitShip.name : null
            });

            if (isHit) {
              cell.state = 'hit';
              this.radarLeftAgainstRight[rowIdx][colIdx].state = 'hit';
              this.stats.leftHits++;
              hitShip.hits++;

              if (willSink) {
                hitShip.sunk = true;
                hitShip.coords.forEach(({ r, c }) => {
                  this.boardRight[r][c].state = 'sunk';
                  this.radarLeftAgainstRight[r][c].state = 'sunk';
                });
                window.retroAudio.playSunk();
                this.log('AI', `SYSTEM ONE DESTROYED CPU'S ${hitShip.name} AT ${coordName}!`);
                window.retroNavalFX.showSpeechBubble({
                  boardSide: 'right',
                  role: 'damage',
                  text: `Damage Control: Critical structural failure! Our ${hitShip.name} has been destroyed!`,
                  meta: 'CPU SUNK'
                });
              } else {
                window.retroAudio.playHit();
                this.log('AI', `SYSTEM ONE HIT CPU VESSEL AT ${coordName}.`);
                window.retroNavalFX.showSpeechBubble({
                  boardSide: 'left',
                  role: 'lookout',
                  text: `Lookout Martinez: Shell detonation on CPU hull at ${coordName}! Target burning!`,
                  meta: 'HIT'
                });
              }
            } else {
              cell.state = 'miss';
              this.radarLeftAgainstRight[rowIdx][colIdx].state = 'miss';
              window.retroAudio.playMiss();
              this.log('AI', `SYSTEM ONE MISS AT ${coordName}.`);
              window.retroNavalFX.showSpeechBubble({
                boardSide: 'left',
                role: 'radar',
                text: `Radar Specialist Chen: Water geyser at ${coordName}. No contact.`,
                meta: 'MISS'
              });
            }

            this.render();
            resolve();
          }
        });
      });

      if (this.fleetRight.every(s => s.sunk)) {
        this.endGame('SYSTEM_ONE');
        return;
      }

      this.currentTurn = 'CPU';

    } else {
      // Normal CPU attacks System One (Board Left)
      this.setTurnVisuals('CPU');
      this.statusBanner.textContent = '🤖 NORMAL CPU FIRING AT SYSTEM ONE...';
      const survivingLeft = this.fleetLeft.filter(s => !s.sunk);
      const decision = window.normalComputerAI.getNextShot(this.radarRightAgainstLeft, survivingLeft);

      const { colIdx, rowIdx } = decision;
      const coordName = coordToKey(colIdx, rowIdx);

      window.retroNavalFX.showSpeechBubble({
        boardSide: 'right',
        role: 'weapons',
        text: `Weapons Officer: Executing Hunt-and-Target battery salvo towards sector ${coordName}.`,
        meta: `CPU -> ${coordName}`
      });

      const cell = this.boardLeft[rowIdx][colIdx];
      const hitShip = cell.shipId ? this.fleetLeft.find(s => s.id === cell.shipId) : null;
      const isHit = !!hitShip;
      const willSink = isHit && (hitShip.hits + 1 >= hitShip.length);

      const fromEl = this.boardCardRight;
      const toEl = this.gridLeftEl.querySelector(`.grid-cell[data-row="${rowIdx}"][data-col="${colIdx}"]`);

      this.stats.rightShots++;
      window.retroAudio.playLaunch();

      await new Promise(resolve => {
        window.retroNavalFX.launchArtillery({
          fromEl,
          toEl,
          isHit,
          isSunk: willSink,
          onImpact: () => {
            const shotResult = isHit ? (willSink ? 'SUNK' : 'HIT') : 'MISS';
            this.shotHistoryAgainstLeft.push({
              turn: this.stats.turns,
              shooter: 'CPU',
              coord: coordName,
              result: shotResult,
              shipName: hitShip ? hitShip.name : null
            });

            if (isHit) {
              cell.state = 'hit';
              this.radarRightAgainstLeft[rowIdx][colIdx].state = 'hit';
              this.stats.rightHits++;
              hitShip.hits++;

              if (willSink) {
                hitShip.sunk = true;
                hitShip.coords.forEach(({ r, c }) => {
                  this.boardLeft[r][c].state = 'sunk';
                  this.radarRightAgainstLeft[r][c].state = 'sunk';
                });
                window.retroAudio.playSunk();
                this.log('CPU', `CPU DESTROYED SYSTEM ONE'S ${hitShip.name} AT ${coordName}!`);
                window.retroNavalFX.showSpeechBubble({
                  boardSide: 'left',
                  role: 'damage',
                  text: `Damage Control Chief Miller: All bulkheads breached! System One's ${hitShip.name} is lost!`,
                  meta: 'SHIP LOST'
                });
              } else {
                window.retroAudio.playHit();
                this.log('CPU', `CPU HIT SYSTEM ONE VESSEL AT ${coordName}.`);
                window.retroNavalFX.showSpeechBubble({
                  boardSide: 'left',
                  role: 'damage',
                  text: `Damage Control Chief Miller: Incoming shell impact at ${coordName}! Shoring up bulkheads!`,
                  meta: 'DAMAGE'
                });
              }
            } else {
              cell.state = 'miss';
              this.radarRightAgainstLeft[rowIdx][colIdx].state = 'miss';
              window.retroAudio.playMiss();
              this.log('CPU', `CPU MISS AT ${coordName}.`);
              window.retroNavalFX.showSpeechBubble({
                boardSide: 'left',
                role: 'lookout',
                text: `Lookout Martinez: Water geyser at ${coordName}! Enemy missed our warships!`,
                meta: 'SPLASH'
              });
            }

            this.render();
            resolve();
          }
        });
      });

      if (this.fleetLeft.every(s => s.sunk)) {
        this.endGame('CPU');
        return;
      }

      this.currentTurn = 'SYSTEM_ONE';
    }
  }

  // --- TURN VISUAL COLOR FEEDBACK ---

  setTurnVisuals(turn) {
    this.boardCardLeft.classList.remove('turn-attacker', 'turn-defender');
    this.boardCardRight.classList.remove('turn-attacker', 'turn-defender');

    if (turn === 'PLAYER') {
      this.boardCardLeft.classList.add('turn-attacker');
      this.boardCardRight.classList.add('turn-defender');
    } else if (turn === 'SYSTEM_ONE') {
      if (this.mode === '1P') {
        this.boardCardRight.classList.add('turn-attacker');
        this.boardCardLeft.classList.add('turn-defender');
      } else {
        // In spectator, Left is System One
        this.boardCardLeft.classList.add('turn-attacker');
        this.boardCardRight.classList.add('turn-defender');
      }
    } else if (turn === 'CPU') {
      this.boardCardRight.classList.add('turn-attacker');
      this.boardCardLeft.classList.add('turn-defender');
    }
  }

  // --- TELEMETRY RENDERING ---

  updateAiTelemetry(decision) {
    if (!decision) return;

    this.valLatency.textContent = `${decision.latency || 0} ms`;
    this.valConfidence.textContent = `${Math.round((decision.confidence || 0) * 100)} %`;
    this.valStrategy.textContent = decision.mode === 'TARGET' ? 'TARGET TRACK' : 'RECON HUNT';
    this.valStrategy.style.color = decision.mode === 'TARGET' ? 'var(--accent-red)' : 'var(--accent-cyan)';

    if (decision.endpointUsed) {
      this.valEndpoint.textContent = decision.endpointUsed.replace('http://', '');
    }

    if (window.systemOneAI.modelName) {
      this.valModelName.textContent = window.systemOneAI.modelName;
    }

    const probs = decision.probabilities || {};
    const keys = Object.keys(probs);

    if (keys.length > 0) {
      keys.sort((a, b) => probs[b] - probs[a]);
      const maxKey = keys[0];

      let metersHtml = '';
      for (const k of keys.slice(0, 5)) {
        const pct = Math.round(probs[k] * 100);
        const isHighest = k === maxKey;
        metersHtml += `
          <div class="meter-row">
            <div class="meter-label-row">
              <span class="meter-target-name">${k}</span>
              <span class="meter-pct">${pct}%</span>
            </div>
            <div class="meter-bar-track">
              <div class="meter-bar-fill ${isHighest ? 'highest' : ''}" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }
      this.probabilityMeters.innerHTML = metersHtml;
    }

    if (decision.asciiRadar) {
      this.asciiRadarTerminal.textContent = decision.asciiRadar;
    }
  }

  // --- RENDERING ---

  render() {
    this.renderFleetRack(this.fleetLeft, this.fleetRackLeft);
    this.renderFleetRack(this.fleetRight, this.fleetRackRight);

    // Grid rendering
    this.renderGrid(this.boardLeft, this.gridLeftEl, false);
    const isInteractive = this.mode === '1P' && this.phase === 'BATTLE' && this.currentTurn === 'PLAYER';
    this.renderGrid(this.boardRight, this.gridRightEl, isInteractive);

    if (isInteractive) {
      this.gridRightEl.classList.add('clickable');
    } else {
      this.gridRightEl.classList.remove('clickable');
    }

    // Render High-Fidelity Ship Overlays!
    // Left board ships are visible
    this.renderShipsOverlay(this.fleetLeft, this.shipsOverlayLeft, true, this.phase === 'DEPLOYMENT');

    // Right board ships: HIDDEN in 1P mode (Fog of War) until game over! VISIBLE in Spectator mode!
    const showRightShips = this.mode === 'SPECTATOR' || this.phase === 'GAMEOVER';
    this.renderShipsOverlay(this.fleetRight, this.shipsOverlayRight, showRightShips, false);

    // Render drydock
    if (this.phase === 'DEPLOYMENT') {
      this.renderDock();
    }

    // Synchronize organic smoke & fire emitters for damaged and sunken warships
    this.syncSmokeEmitters();
  }

  syncSmokeEmitters() {
    window.retroNavalFX.clearSmokeEmitters();

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const stateL = this.boardLeft[r][c].state;
        if (stateL === 'hit' || stateL === 'sunk') {
          const elL = this.gridLeftEl.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
          if (elL) window.retroNavalFX.registerSmokeEmitter(`L_${r}_${c}`, elL, stateL === 'sunk');
        }

        const stateR = this.boardRight[r][c].state;
        if (stateR === 'hit' || stateR === 'sunk') {
          const elR = this.gridRightEl.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
          if (elR) window.retroNavalFX.registerSmokeEmitter(`R_${r}_${c}`, elR, stateR === 'sunk');
        }
      }
    }
  }

  renderDock() {
    this.dockShipsRow.innerHTML = '';
    const deployedIds = new Set(this.fleetLeft.map(s => s.id));

    SHIPS_CONFIG.forEach(ship => {
      const isDeployed = deployedIds.has(ship.id);
      const card = document.createElement('div');
      card.className = `dock-ship-card ${isDeployed ? 'deployed' : ''}`;
      card.dataset.shipId = ship.id;

      let pips = '';
      for (let i = 0; i < ship.length; i++) pips += '●';

      card.innerHTML = `
        <div class="dock-ship-info">
          <span>${ship.name}</span>
          <span style="color: var(--accent-cyan);">${pips}</span>
        </div>
        <div class="dock-ship-preview">
          ${window.generateShipSVG(ship.id, ship.length, false)}
        </div>
      `;

      if (!isDeployed) {
        card.addEventListener('pointerdown', (e) => {
          this.startDragFromDock(e, ship.id, ship.length);
        });
      }

      this.dockShipsRow.appendChild(card);
    });
  }

  startDragFromDock(e, shipId, length) {
    this.dragState = {
      isDragging: true,
      shipId,
      length,
      isVertical: this.placementOrientation,
      source: 'dock',
      originR: null,
      originC: null,
      hoverR: null,
      hoverC: null,
      isValid: false
    };
    window.retroAudio.playClick();
  }

  renderShipsOverlay(fleet, overlayEl, isVisible, allowDrag) {
    overlayEl.innerHTML = '';
    if (!isVisible) return;

    fleet.forEach(ship => {
      const container = document.createElement('div');
      container.className = `placed-ship-container ${ship.sunk ? 'sunk' : ''} ${allowDrag ? 'draggable' : 'locked'}`;

      const left = GRID_OFFSET + ship.startC * (CELL_SIZE + CELL_GAP);
      const top = GRID_OFFSET + ship.startR * (CELL_SIZE + CELL_GAP);

      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
      container.innerHTML = window.generateShipSVG(ship.id, ship.length, ship.isVertical);

      if (allowDrag) {
        container.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.startDragFromGrid(e, ship);
        });
      }

      overlayEl.appendChild(container);
    });
  }

  startDragFromGrid(e, ship) {
    this.dragState = {
      isDragging: true,
      shipId: ship.id,
      length: ship.length,
      isVertical: ship.isVertical,
      source: 'grid',
      originR: ship.startR,
      originC: ship.startC,
      hoverR: ship.startR,
      hoverC: ship.startC,
      isValid: true
    };
    window.retroAudio.playClick();
  }

  renderFleetRack(fleet, rackEl) {
    let html = '';
    for (const ship of fleet) {
      let pipsHtml = '';
      for (let i = 0; i < ship.length; i++) {
        pipsHtml += `<div class="ship-pip"></div>`;
      }
      html += `
        <div class="fleet-ship ${ship.sunk ? 'sunk' : ''}">
          <span>${ship.name.slice(0, 4)}</span>
          <div class="ship-pips">${pipsHtml}</div>
        </div>
      `;
    }
    rackEl.innerHTML = html;
  }

  renderGrid(board, gridEl, isInteractive) {
    gridEl.innerHTML = '';

    const emptyCorner = document.createElement('div');
    emptyCorner.className = 'grid-header-cell';
    gridEl.appendChild(emptyCorner);

    for (let c = 0; c < 10; c++) {
      const colHeader = document.createElement('div');
      colHeader.className = 'grid-header-cell';
      colHeader.textContent = COLS[c];
      gridEl.appendChild(colHeader);
    }

    for (let r = 0; r < 10; r++) {
      const rowHeader = document.createElement('div');
      rowHeader.className = 'grid-header-cell';
      rowHeader.textContent = r + 1;
      gridEl.appendChild(rowHeader);

      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell';
        cellEl.dataset.row = r;
        cellEl.dataset.col = c;

        if (cell.state === 'empty') {
          cellEl.classList.add('unexplored');
        } else if (cell.state === 'miss') {
          cellEl.classList.add('miss');
        } else if (cell.state === 'hit') {
          cellEl.classList.add('hit');
        } else if (cell.state === 'sunk') {
          cellEl.classList.add('sunk');
        }

        if (isInteractive && cell.state === 'empty') {
          cellEl.addEventListener('click', () => {
            this.handlePlayerCellClick(c, r);
          });
        }

        gridEl.appendChild(cellEl);
      }
    }
  }

  // --- GAME OVER ---

  endGame(winner) {
    this.phase = 'GAMEOVER';
    this.pauseSpectatorSimulation();
    this.setTurnVisuals('NONE');

    let titleText = '';
    if (this.mode === '1P') {
      if (winner === 'PLAYER') {
        titleText = '🏆 VICTORY! ENEMY AI FLEET DESTROYED!';
        window.retroAudio.playVictory();
        window.retroNavalFX.showSpeechBubble({
          boardSide: 'left',
          speaker: 'PLAYER',
          text: 'Victory achieved! The enemy fleet has sunk beneath the waves!',
          duration: 6000
        });
      } else {
        titleText = '☠ DEFEAT! SYSTEM ONE ANNIHILATED YOUR FLEET!';
        window.retroAudio.playDefeat();
        window.retroNavalFX.showSpeechBubble({
          boardSide: 'right',
          speaker: 'AI',
          text: 'Checkmate, Admiral. The deep decision model reigned supreme.',
          duration: 6000
        });
      }
    } else {
      if (winner === 'SYSTEM_ONE') {
        titleText = '🧠 SYSTEM ONE WINS THE NAVAL DUEL!';
        window.retroAudio.playVictory();
        window.retroNavalFX.showSpeechBubble({
          boardSide: 'left',
          speaker: 'AI',
          text: 'Simulation concluded. Superior tactical probability mapping defeated CPU logic.',
          duration: 6000
        });
      } else {
        titleText = '🤖 NORMAL CPU WINS THE NAVAL DUEL!';
        window.retroAudio.playVictory();
        window.retroNavalFX.showSpeechBubble({
          boardSide: 'right',
          speaker: 'CPU',
          text: 'Algorithmic parity strategy emerged victorious in this duel.',
          duration: 6000
        });
      }
    }

    this.statusBanner.textContent = titleText;
    this.log('SYS', `=== MATCH OVER: ${titleText} ===`);

    // Reveal right board ships upon game over
    this.render();
  }

  log(category, message) {
    const time = new Date().toTimeString().split(' ')[0].slice(3, 8);
    const entry = document.createElement('div');
    entry.className = `log-entry ${category.toLowerCase()}`;
    entry.innerHTML = `<span class="log-time">[${time}]</span> <span>${message}</span>`;
    this.combatLog.prepend(entry);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.battleshipGame = new BattleshipGame();
});
