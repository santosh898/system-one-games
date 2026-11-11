/**
 * 16-Bit Retro Battleship Game Engine
 * System One vs Player & System One vs Normal Computer Spectator Mode
 */

const SHIPS_CONFIG = [
  { id: 'carrier', name: 'CARRIER', length: 5 },
  { id: 'battleship', name: 'BATTLESHIP', length: 4 },
  { id: 'cruiser', name: 'CRUISER', length: 3 },
  { id: 'submarine', name: 'SUBMARINE', length: 3 },
  { id: 'destroyer', name: 'DESTROYER', length: 2 },
];

class BattleshipGame {
  constructor() {
    this.mode = '1P'; // '1P' or 'SPECTATOR'
    this.phase = 'DEPLOYMENT'; // 'DEPLOYMENT', 'BATTLE', 'GAMEOVER'
    this.currentTurn = 'PLAYER'; // 'PLAYER', 'SYSTEM_ONE', 'CPU'
    this.simRunning = false;
    this.simSpeed = 800; // ms
    this.stepTimeout = null;

    // Board 1: Player (in 1P) or System One (in Spectator)
    this.boardLeft = this.createEmptyBoard();
    this.fleetLeft = [];

    // Board 2: AI / System One (in 1P) or Normal CPU (in Spectator)
    this.boardRight = this.createEmptyBoard();
    this.fleetRight = [];

    // Targeting memory grids (what each player has explored on the opponent)
    this.radarLeftAgainstRight = this.createEmptyRadar();
    this.radarRightAgainstLeft = this.createEmptyRadar();

    // Stats
    this.stats = {
      turns: 0,
      leftShots: 0,
      leftHits: 0,
      rightShots: 0,
      rightHits: 0
    };

    // DOM Elements
    this.initDOMElements();
    this.attachEventListeners();

    // Initial deployment
    this.init1PMode();
  }

  createEmptyBoard() {
    return Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => ({
        row: r,
        col: c,
        shipId: null,
        state: 'empty' // 'empty', 'miss', 'hit', 'sunk'
      }))
    );
  }

  createEmptyRadar() {
    return Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => ({
        row: r,
        col: c,
        state: 'empty' // 'empty', 'miss', 'hit', 'sunk'
      }))
    );
  }

  initDOMElements() {
    this.gridLeftEl = document.getElementById('gridLeft');
    this.gridRightEl = document.getElementById('gridRight');
    this.titleBoardLeft = document.getElementById('titleBoardLeft');
    this.tagBoardLeft = document.getElementById('tagBoardLeft');
    this.titleBoardRight = document.getElementById('titleBoardRight');
    this.tagBoardRight = document.getElementById('tagBoardRight');
    this.fleetRackLeft = document.getElementById('fleetRackLeft');
    this.fleetRackRight = document.getElementById('fleetRackRight');
    this.statusBanner = document.getElementById('statusBanner');
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

    // Buttons
    this.btnMode1P = document.getElementById('btnMode1P');
    this.btnModeSpectator = document.getElementById('btnModeSpectator');
    this.btnAutoDeploy = document.getElementById('btnAutoDeploy');
    this.btnRotateShip = document.getElementById('btnRotateShip');
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
    // Mode toggles
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

    // 1P buttons
    this.btnAutoDeploy.addEventListener('click', () => {
      window.retroAudio.playSonar();
      this.randomizePlayerFleet();
      this.render();
      this.log('DEFENSE', 'FLEET REDEPLOYED TO NEW COORDINATES.');
    });

    this.btnStartBattle.addEventListener('click', () => {
      window.retroAudio.playLaunch();
      this.start1PBattle();
    });

    // Spectator buttons
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

    // Speed selector
    this.selectSpeed.addEventListener('change', (e) => {
      const speeds = { turbo: 250, fast: 800, normal: 1600, slow: 3000 };
      this.simSpeed = speeds[e.target.value] || 800;
    });

    // Sound toggle
    this.btnSoundToggle.addEventListener('click', () => {
      const muted = window.retroAudio.toggleMute();
      this.btnSoundToggle.textContent = muted ? '🔇 MUTED' : '🔊 SOUND ON';
    });

    // CRT toggle
    this.btnCrtToggle.addEventListener('click', () => {
      const isActive = document.body.classList.toggle('crt-active');
      this.btnCrtToggle.textContent = isActive ? '📺 CRT: ON' : '📺 CRT: OFF';
    });

    // Clear log
    this.btnClearLog.addEventListener('click', () => {
      this.combatLog.innerHTML = '';
      this.log('SYS', 'LOG CLEARED.');
    });
  }

  // --- INITIALIZATION MODES ---

  init1PMode() {
    this.pauseSpectatorSimulation();
    this.mode = '1P';
    this.phase = 'DEPLOYMENT';
    this.currentTurn = 'PLAYER';

    this.btnMode1P.classList.add('active');
    this.btnModeSpectator.classList.remove('active');

    this.deploymentBar.style.display = 'flex';
    this.actionControlsBar.style.display = 'none';

    this.titleBoardLeft.textContent = '🛡️ YOUR FLEET';
    this.tagBoardLeft.textContent = 'PLAYER DEFENSE';
    this.titleBoardRight.textContent = '🎯 SYSTEM ONE RADAR';
    this.tagBoardRight.textContent = 'FOG OF WAR (HIDDEN)';
    this.tagBoardRight.className = 'board-tag';

    this.statusBanner.textContent = 'DEPLOY FLEET: POSITION YOUR WARSHIPS & ENGAGE';

    // Clear boards
    this.boardLeft = this.createEmptyBoard();
    this.boardRight = this.createEmptyBoard();
    this.radarLeftAgainstRight = this.createEmptyRadar();
    this.radarRightAgainstLeft = this.createEmptyRadar();

    // Deploy fleets
    this.randomizePlayerFleet();
    this.fleetRight = this.placeFleetRandomly(this.boardRight);

    this.resetStats();
    this.render();
    this.log('SYS', 'MODE: 1-PLAYER (PLAYER VS SYSTEM ONE).');
    this.log('SYS', 'AI FLEET DEPLOYED IN SECRET SECTORS.');
  }

  initSpectatorMode() {
    this.pauseSpectatorSimulation();
    this.mode = 'SPECTATOR';
    this.phase = 'READY';
    this.currentTurn = 'SYSTEM_ONE';

    this.btnModeSpectator.classList.add('active');
    this.btnMode1P.classList.remove('active');

    this.deploymentBar.style.display = 'none';
    this.actionControlsBar.style.display = 'flex';

    this.titleBoardLeft.textContent = '🧠 SYSTEM ONE FLEET';
    this.tagBoardLeft.textContent = 'SPECTATOR: AI VISIBLE';
    this.tagBoardLeft.className = 'board-tag spectator-tag';

    this.titleBoardRight.textContent = '🤖 NORMAL CPU FLEET';
    this.tagBoardRight.textContent = 'SPECTATOR: CPU VISIBLE';
    this.tagBoardRight.className = 'board-tag spectator-tag';

    this.statusBanner.textContent = 'SPECTATOR MODE: BOTH BATTLEGROUNDS VISIBLE';

    // Clear boards
    this.boardLeft = this.createEmptyBoard();
    this.boardRight = this.createEmptyBoard();
    this.radarLeftAgainstRight = this.createEmptyRadar();
    this.radarRightAgainstLeft = this.createEmptyRadar();

    // Deploy fleets for both AI and CPU
    this.fleetLeft = this.placeFleetRandomly(this.boardLeft);
    this.fleetRight = this.placeFleetRandomly(this.boardRight);

    this.resetStats();
    this.render();
    this.log('SYS', 'MODE: SPECTATOR (SYSTEM ONE AI VS NORMAL CPU).');
    this.log('SYS', 'BOTH BATTLEGROUNDS FULLY REVEALED.');
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

  randomizePlayerFleet() {
    this.boardLeft = this.createEmptyBoard();
    this.fleetLeft = this.placeFleetRandomly(this.boardLeft);
  }

  placeFleetRandomly(board) {
    const fleet = [];

    for (const shipCfg of SHIPS_CONFIG) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 200) {
        attempts++;
        const isHorizontal = Math.random() < 0.5;
        const maxRow = isHorizontal ? 10 : 10 - shipCfg.length;
        const maxCol = isHorizontal ? 10 - shipCfg.length : 10;
        const startR = Math.floor(Math.random() * maxRow);
        const startC = Math.floor(Math.random() * maxCol);

        // Check collision
        let collision = false;
        const coords = [];
        for (let i = 0; i < shipCfg.length; i++) {
          const r = isHorizontal ? startR : startR + i;
          const c = isHorizontal ? startC + i : startC;
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
    this.deploymentBar.style.display = 'none';
    this.actionControlsBar.style.display = 'flex';
    // Hide play/step in 1P mode
    this.btnSpectatorPlay.style.display = 'none';
    this.btnSpectatorPause.style.display = 'none';
    this.btnSpectatorStep.style.display = 'none';
    this.statusBanner.textContent = 'YOUR TURN: SELECT ENEMY RADAR COORDINATE TO FIRE!';
    this.log('SYS', 'BATTLE ENGAGED! COMMENCING ARTILLERY FIRE.');
    this.render();
  }

  async handlePlayerCellClick(col, row) {
    if (this.mode !== '1P' || this.phase !== 'BATTLE' || this.currentTurn !== 'PLAYER') {
      return;
    }

    const cell = this.boardRight[row][col];
    if (cell.state !== 'empty') {
      // Already shot
      window.retroAudio.playClick();
      return;
    }

    this.currentTurn = 'PROCESSING';
    this.stats.leftShots++;
    window.retroAudio.playLaunch();
    const coordName = `${COLS[col]}${row + 1}`;

    await this.delay(260);

    // Evaluate hit or miss
    if (cell.shipId) {
      cell.state = 'hit';
      this.radarLeftAgainstRight[row][col].state = 'hit';
      this.stats.leftHits++;

      // Update fleet
      const hitShip = this.fleetRight.find(s => s.id === cell.shipId);
      hitShip.hits++;

      if (hitShip.hits >= hitShip.length) {
        hitShip.sunk = true;
        hitShip.coords.forEach(({ r, c }) => {
          this.boardRight[r][c].state = 'sunk';
          this.radarLeftAgainstRight[r][c].state = 'sunk';
        });
        window.retroAudio.playSunk();
        this.log('HIT', `DIRECT HIT ON ${coordName}! ENEMY ${hitShip.name} SUNK!`);
        this.statusBanner.textContent = `💥 ENEMY ${hitShip.name} DESTROYED!`;
      } else {
        window.retroAudio.playHit();
        this.log('HIT', `DIRECT HIT AT ${coordName}! ENEMY VESSEL DAMAGED.`);
        this.statusBanner.textContent = `💥 DIRECT HIT AT ${coordName}!`;
      }
    } else {
      cell.state = 'miss';
      this.radarLeftAgainstRight[row][col].state = 'miss';
      window.retroAudio.playMiss();
      this.log('MISS', `SPLASH AT ${coordName}: NO TARGET DETECTED.`);
      this.statusBanner.textContent = `WATER SPLASH AT ${coordName}.`;
    }

    this.render();

    // Check Player Victory
    if (this.fleetRight.every(s => s.sunk)) {
      this.endGame('PLAYER');
      return;
    }

    // AI Turn
    this.currentTurn = 'SYSTEM_ONE';
    this.statusBanner.textContent = '🧠 SYSTEM ONE IS CALCULATING ARTILLERY TARGET...';
    this.lblAiStatus.textContent = 'TARGETING...';
    this.lblAiStatus.style.color = 'var(--accent-gold)';

    await this.delay(600);
    await this.executeSystemOneTurn();
  }

  // --- SYSTEM ONE AI EXECUTION ---

  async executeSystemOneTurn() {
    // Surviving ships for left fleet
    const survivingLeft = this.fleetLeft.filter(s => !s.sunk);

    let decision = null;
    try {
      decision = await window.systemOneAI.getNextShot(this.radarRightAgainstLeft, survivingLeft);
    } catch (err) {
      console.error("System One AI error:", err);
    }

    if (!decision) {
      // Fallback
      decision = window.normalComputerAI.getNextShot(this.radarRightAgainstLeft, survivingLeft);
    }

    // Update telemetry display
    this.updateAiTelemetry(decision);

    const { colIdx, rowIdx } = decision;
    const coordName = coordToKey(colIdx, rowIdx);

    this.stats.rightShots++;
    window.retroAudio.playLaunch();
    await this.delay(350);

    const cell = this.boardLeft[rowIdx][colIdx];
    if (cell.shipId) {
      cell.state = 'hit';
      this.radarRightAgainstLeft[rowIdx][colIdx].state = 'hit';
      this.stats.rightHits++;

      const hitShip = this.fleetLeft.find(s => s.id === cell.shipId);
      hitShip.hits++;

      if (hitShip.hits >= hitShip.length) {
        hitShip.sunk = true;
        hitShip.coords.forEach(({ r, c }) => {
          this.boardLeft[r][c].state = 'sunk';
          this.radarRightAgainstLeft[r][c].state = 'sunk';
        });
        window.retroAudio.playSunk();
        this.log('AI', `SYSTEM ONE STRIKES ${coordName}! YOUR ${hitShip.name} WAS SUNK!`);
        this.statusBanner.textContent = `⚠️ YOUR ${hitShip.name} HAS BEEN SUNK BY SYSTEM ONE!`;
      } else {
        window.retroAudio.playHit();
        this.log('AI', `SYSTEM ONE STRIKES ${coordName}! YOUR SHIP WAS DAMAGED.`);
        this.statusBanner.textContent = `⚠️ INCOMING HIT AT ${coordName}!`;
      }
    } else {
      cell.state = 'miss';
      this.radarRightAgainstLeft[rowIdx][colIdx].state = 'miss';
      window.retroAudio.playMiss();
      this.log('AI', `SYSTEM ONE FIRED AT ${coordName}: MISS.`);
      this.statusBanner.textContent = `SYSTEM ONE MISSED AT ${coordName}. YOUR TURN!`;
    }

    this.render();

    // Check AI Victory
    if (this.fleetLeft.every(s => s.sunk)) {
      this.endGame('SYSTEM_ONE');
      return;
    }

    if (this.mode === '1P') {
      this.currentTurn = 'PLAYER';
      this.lblAiStatus.textContent = 'IDLE';
      this.lblAiStatus.style.color = 'var(--accent-green)';
    }
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
      this.statusBanner.textContent = '🧠 SYSTEM ONE FIRING AT NORMAL CPU...';
      const survivingRight = this.fleetRight.filter(s => !s.sunk);

      let decision = null;
      try {
        decision = await window.systemOneAI.getNextShot(this.radarLeftAgainstRight, survivingRight);
      } catch (e) {
        console.error(e);
      }
      if (!decision) {
        decision = window.normalComputerAI.getNextShot(this.radarLeftAgainstRight, survivingRight);
      }

      this.updateAiTelemetry(decision);

      const { colIdx, rowIdx } = decision;
      const coordName = coordToKey(colIdx, rowIdx);
      this.stats.leftShots++;
      window.retroAudio.playLaunch();
      await this.delay(200);

      const cell = this.boardRight[rowIdx][colIdx];
      if (cell.shipId) {
        cell.state = 'hit';
        this.radarLeftAgainstRight[rowIdx][colIdx].state = 'hit';
        this.stats.leftHits++;

        const hitShip = this.fleetRight.find(s => s.id === cell.shipId);
        hitShip.hits++;
        if (hitShip.hits >= hitShip.length) {
          hitShip.sunk = true;
          hitShip.coords.forEach(({ r, c }) => {
            this.boardRight[r][c].state = 'sunk';
            this.radarLeftAgainstRight[r][c].state = 'sunk';
          });
          window.retroAudio.playSunk();
          this.log('AI', `SYSTEM ONE DESTROYED CPU'S ${hitShip.name} AT ${coordName}!`);
        } else {
          window.retroAudio.playHit();
          this.log('AI', `SYSTEM ONE HIT CPU VESSEL AT ${coordName}.`);
        }
      } else {
        cell.state = 'miss';
        this.radarLeftAgainstRight[rowIdx][colIdx].state = 'miss';
        window.retroAudio.playMiss();
        this.log('AI', `SYSTEM ONE MISS AT ${coordName}.`);
      }

      this.render();

      if (this.fleetRight.every(s => s.sunk)) {
        this.endGame('SYSTEM_ONE');
        return;
      }

      this.currentTurn = 'CPU';

    } else {
      // Normal CPU attacks System One (Board Left)
      this.statusBanner.textContent = '🤖 NORMAL CPU FIRING AT SYSTEM ONE...';
      const survivingLeft = this.fleetLeft.filter(s => !s.sunk);
      const decision = window.normalComputerAI.getNextShot(this.radarRightAgainstLeft, survivingLeft);

      const { colIdx, rowIdx } = decision;
      const coordName = coordToKey(colIdx, rowIdx);
      this.stats.rightShots++;
      window.retroAudio.playLaunch();
      await this.delay(200);

      const cell = this.boardLeft[rowIdx][colIdx];
      if (cell.shipId) {
        cell.state = 'hit';
        this.radarRightAgainstLeft[rowIdx][colIdx].state = 'hit';
        this.stats.rightHits++;

        const hitShip = this.fleetLeft.find(s => s.id === cell.shipId);
        hitShip.hits++;
        if (hitShip.hits >= hitShip.length) {
          hitShip.sunk = true;
          hitShip.coords.forEach(({ r, c }) => {
            this.boardLeft[r][c].state = 'sunk';
            this.radarRightAgainstLeft[r][c].state = 'sunk';
          });
          window.retroAudio.playSunk();
          this.log('CPU', `CPU DESTROYED SYSTEM ONE'S ${hitShip.name} AT ${coordName}!`);
        } else {
          window.retroAudio.playHit();
          this.log('CPU', `CPU HIT SYSTEM ONE VESSEL AT ${coordName}.`);
        }
      } else {
        cell.state = 'miss';
        this.radarRightAgainstLeft[rowIdx][colIdx].state = 'miss';
        window.retroAudio.playMiss();
        this.log('CPU', `CPU MISS AT ${coordName}.`);
      }

      this.render();

      if (this.fleetLeft.every(s => s.sunk)) {
        this.endGame('CPU');
        return;
      }

      this.currentTurn = 'SYSTEM_ONE';
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

    // Probability Meters
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

    // ASCII Radar View
    if (decision.asciiRadar) {
      this.asciiRadarTerminal.textContent = decision.asciiRadar;
    }
  }

  // --- RENDERING ---

  render() {
    this.renderFleetRack(this.fleetLeft, this.fleetRackLeft);
    this.renderFleetRack(this.fleetRight, this.fleetRackRight);

    // Left Board: In 1P, show player's ships. In Spectator, show AI's ships!
    const showShipsLeft = true;
    this.renderGrid(this.boardLeft, this.gridLeftEl, showShipsLeft, false);

    // Right Board: In 1P mode, FOG OF WAR (ships are hidden!). In Spectator, CPU ships ARE visible!
    const showShipsRight = this.mode === 'SPECTATOR';
    const isClickable = this.mode === '1P' && this.phase === 'BATTLE' && this.currentTurn === 'PLAYER';
    this.renderGrid(this.boardRight, this.gridRightEl, showShipsRight, isClickable);

    // Clickable classes
    if (isClickable) {
      this.gridRightEl.classList.add('clickable');
    } else {
      this.gridRightEl.classList.remove('clickable');
    }
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

  renderGrid(board, gridEl, showShips, isInteractive) {
    gridEl.innerHTML = '';

    // Top-left blank header cell
    const emptyCorner = document.createElement('div');
    emptyCorner.className = 'grid-header-cell';
    gridEl.appendChild(emptyCorner);

    // Column headers (A-J)
    for (let c = 0; c < 10; c++) {
      const colHeader = document.createElement('div');
      colHeader.className = 'grid-header-cell';
      colHeader.textContent = COLS[c];
      gridEl.appendChild(colHeader);
    }

    // Grid rows
    for (let r = 0; r < 10; r++) {
      // Row header (1-10)
      const rowHeader = document.createElement('div');
      rowHeader.className = 'grid-header-cell';
      rowHeader.textContent = r + 1;
      gridEl.appendChild(rowHeader);

      for (let c = 0; c < 10; c++) {
        const cell = board[r][c];
        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell';

        if (cell.state === 'empty') {
          cellEl.classList.add('unexplored');
          if (showShips && cell.shipId) {
            cellEl.classList.add('ship');
          }
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

    let titleText = '';
    let isWin = false;

    if (this.mode === '1P') {
      if (winner === 'PLAYER') {
        titleText = '🏆 VICTORY! ENEMY AI FLEET DESTROYED!';
        isWin = true;
        window.retroAudio.playVictory();
      } else {
        titleText = '☠ DEFEAT! SYSTEM ONE ANNIHILATED YOUR FLEET!';
        window.retroAudio.playDefeat();
      }
    } else {
      // Spectator
      if (winner === 'SYSTEM_ONE') {
        titleText = '🧠 SYSTEM ONE AI WINS THE NAVAL DUEL!';
        isWin = true;
        window.retroAudio.playVictory();
      } else {
        titleText = '🤖 NORMAL CPU WINS THE NAVAL DUEL!';
        window.retroAudio.playVictory();
      }
    }

    this.statusBanner.textContent = titleText;
    this.log('SYS', `=== MATCH OVER: ${titleText} ===`);

    // Show full reveal of both boards at match end!
    const showShipsRight = true;
    this.renderGrid(this.boardRight, this.gridRightEl, showShipsRight, false);
  }

  // --- LOGGING ---

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

// Instantiate game on load
window.addEventListener('DOMContentLoaded', () => {
  window.battleshipGame = new BattleshipGame();
});
