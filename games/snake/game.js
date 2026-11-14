/**
 * 16-Bit Retro Classic Snake Game Engine
 * With Multi-Tile Direction + Distance AI Navigation
 */
class SnakeGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Configurable Grid
    this.gridCols = 10;
    this.gridRows = 10;
    this.cellSize = 40;

    // Game state
    this.snake = [];
    this.dir = 'RIGHT';
    this.foods = []; // Array of active fruits on the board (1 or 2)
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('snake_highscore') || '0', 10);
    this.foodCount = 0;
    this.stepCount = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.aiRunning = false;
    this.isExecutingMultiMove = false;

    // Multi-move animation settings
    this.multiStepSpeedMs = 85; // ms per tile slither
    this.aiPauseBetweenPlans = 200; // ms between consecutive API calls

    // Visual indicators
    this.targetMarker = null; // { x, y, dir, dist }
    this.particles = [];
    this.floatingTexts = [];
    this.tongueTimer = 0;
    this.foodPulse = 0;

    this.initElements();
    this.bindEvents();
    this.resizeCanvas();
    this.resetGame();

    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  initElements() {
    this.elScore = document.getElementById('valScore');
    this.elHighScore = document.getElementById('valHighScore');
    this.elFood = document.getElementById('valFood');
    this.elSteps = document.getElementById('valSteps');
    this.elStatusBadge = document.getElementById('aiStatusBadge');
    this.elLatency = document.getElementById('valLatency');
    this.elConfidence = document.getElementById('valConfidence');
    this.elModelName = document.getElementById('valModelName');
    this.elLogStream = document.getElementById('logStream');
    this.elAsciiMap = document.getElementById('asciiMapPreview');
    this.elProbList = document.getElementById('probListContainer');
  }

  resizeCanvas() {
    const size = 420;
    this.canvas.width = size;
    this.canvas.height = size;
    this.cellSize = Math.floor(size / this.gridCols);
  }

  setGridSize(size) {
    this.gridCols = size;
    this.gridRows = size;
    this.resizeCanvas();
    this.resetGame();
    this.log(`Grid resized to ${size}x${size}`);
  }

  resetGame() {
    const midX = Math.floor(this.gridCols / 2);
    const midY = Math.floor(this.gridRows / 2);

    this.snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY }
    ];
    this.dir = 'RIGHT';
    this.score = 0;
    this.foodCount = 0;
    this.stepCount = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.isExecutingMultiMove = false;
    this.targetMarker = null;
    this.particles = [];
    this.floatingTexts = [];
    this.foods = [];

    this.spawnFoods();
    this.updateHUD();
    this.setStatus('READY', 'status-ready');
    this.log('Game initialized. Select mode and press START AI AUTO.');
  }

  spawnFoods() {
    const getAvailable = () => {
      const available = [];
      for (let x = 0; x < this.gridCols; x++) {
        for (let y = 0; y < this.gridRows; y++) {
          const inSnake = this.snake.some(s => s.x === x && s.y === y);
          const inFoods = this.foods.some(f => f.x === x && f.y === y);
          if (!inSnake && !inFoods) {
            available.push({ x, y });
          }
        }
      }
      return available;
    };

    let avail = getAvailable();
    if (avail.length === 0 && this.foods.length === 0) {
      this.isGameOver = true;
      this.setStatus('VICTORY!', 'status-victory');
      window.retroAudio.playFanfare();
      this.log('VICTORY! Perfect game achieved!');
      return;
    }

    // Ensure at least 1 fruit exists
    if (this.foods.length === 0 && avail.length > 0) {
      const idx = Math.floor(Math.random() * avail.length);
      this.foods.push({ ...avail[idx], type: 'apple' });
      avail.splice(idx, 1);
    }

    // 50% chance to spawn a 2nd fruit if only 1 fruit currently active
    if (this.foods.length === 1 && avail.length > 0 && Math.random() < 0.50) {
      const idx2 = Math.floor(Math.random() * avail.length);
      const isCherry = Math.random() < 0.7; // 70% chance bonus cherry, 30% second apple
      this.foods.push({ ...avail[idx2], type: isCherry ? 'cherry' : 'apple' });
      this.log(`🍒 2 Fruits active on board! (Bonus ${isCherry ? 'Cherry' : 'Apple'})`);
    }
  }

  updateHUD() {
    this.elScore.textContent = String(this.score).padStart(6, '0');
    this.elHighScore.textContent = String(this.highScore).padStart(6, '0');
    this.elFood.textContent = String(this.foodCount).padStart(3, '0');
    this.elSteps.textContent = String(this.stepCount).padStart(4, '0');
  }

  setStatus(text, className) {
    this.elStatusBadge.textContent = text;
    this.elStatusBadge.className = 'status-badge ' + (className || '');
  }

  log(msg, type = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const line = document.createElement('div');
    line.className = `log-line log-${type}`;
    line.textContent = `[${time}] ${msg}`;
    this.elLogStream.appendChild(line);
    this.elLogStream.scrollTop = this.elLogStream.scrollHeight;
  }

  bindEvents() {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (this.isExecutingMultiMove) return;
      const key = e.key;
      let newDir = null;
      if (key === 'ArrowUp' || key === 'w' || key === 'W') newDir = 'UP';
      else if (key === 'ArrowDown' || key === 's' || key === 'S') newDir = 'DOWN';
      else if (key === 'ArrowLeft' || key === 'a' || key === 'A') newDir = 'LEFT';
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') newDir = 'RIGHT';
      else if (key === ' ') {
        this.togglePause();
        e.preventDefault();
        return;
      }

      if (newDir) {
        e.preventDefault();
        this.handleManualMove(newDir);
      }
    });

    document.getElementById('btnStartAi').addEventListener('click', () => this.toggleAiAutoplay());
    document.getElementById('btnStepAi').addEventListener('click', () => this.stepAi());
    document.getElementById('btnReset').addEventListener('click', () => this.resetGame());
    document.getElementById('btnPause').addEventListener('click', () => this.togglePause());

    document.getElementById('gridSizeSelect').addEventListener('change', (e) => {
      this.setGridSize(parseInt(e.target.value, 10));
    });

    // Navigation mode select (multi vs single)
    const selNav = document.getElementById('navModeSelect');
    if (selNav) {
      selNav.addEventListener('change', (e) => {
        window.systemOne.setNavigationMode(e.target.value);
        this.log(`Navigation Mode: ${e.target.value === 'multi' ? 'Multi-Tile (Dir + Distance)' : 'Single-Tile Step'}`);
      });
    }

    // Slither speed select
    const selSpeed = document.getElementById('speedSelect');
    if (selSpeed) {
      selSpeed.addEventListener('change', (e) => {
        const speeds = { turbo: 40, fast: 75, normal: 110, slow: 160 };
        this.multiStepSpeedMs = speeds[e.target.value] || 75;
        this.log(`Speed: ${e.target.value.toUpperCase()} (${this.multiStepSpeedMs}ms/step)`);
      });
    }

    document.getElementById('btnSoundToggle').addEventListener('click', (e) => {
      const isMuted = window.retroAudio.toggleMute();
      e.target.textContent = isMuted ? '🔇 SOUND OFF' : '🔊 SOUND ON';
      e.target.classList.toggle('btn-muted', isMuted);
    });

    document.getElementById('btnCrtToggle').addEventListener('click', (e) => {
      document.body.classList.toggle('crt-active');
      const active = document.body.classList.contains('crt-active');
      e.target.textContent = active ? '📺 CRT: ON' : '📺 CRT: OFF';
    });

    const inputEndpoint = document.getElementById('inputApiEndpoint');
    inputEndpoint.addEventListener('change', (e) => {
      window.systemOne.setEndpoint(e.target.value);
      this.log(`Endpoint updated to: ${e.target.value}`);
    });
  }

  handleManualMove(direction) {
    if (this.isGameOver) return;
    const opp = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    if (direction === opp[this.dir] && this.snake.length > 1) return;

    this.dir = direction;
    this.executeSingleStep();
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.setStatus('PAUSED', 'status-paused');
      this.log('Game paused.');
    } else {
      this.setStatus(this.aiRunning ? 'AI ACTIVE' : 'READY', 'status-ready');
      this.log('Game resumed.');
      if (this.aiRunning && !this.isExecutingMultiMove) {
        this.runAiLoop();
      }
    }
  }

  async toggleAiAutoplay() {
    const btn = document.getElementById('btnStartAi');
    if (this.aiRunning) {
      this.aiRunning = false;
      btn.textContent = '▶ START AI AUTO';
      btn.classList.remove('btn-active');
      this.setStatus('AI STOPPED', 'status-idle');
      this.log('AI Auto-Play stopped.');
    } else {
      if (this.isGameOver) this.resetGame();
      this.aiRunning = true;
      btn.textContent = '⏹ STOP AI AUTO';
      btn.classList.add('btn-active');
      this.setStatus('AI ACTIVE', 'status-thinking');
      this.log('Starting System One Multi-Grid Navigation...');
      this.runAiLoop();
    }
  }

  async runAiLoop() {
    while (this.aiRunning && !this.isGameOver && !this.isPaused) {
      const success = await this.stepAi();
      if (!success) break;
      await new Promise(r => setTimeout(r, this.aiPauseBetweenPlans));
    }
    if (this.isGameOver || !this.aiRunning) {
      this.aiRunning = false;
      const btn = document.getElementById('btnStartAi');
      btn.textContent = '▶ START AI AUTO';
      btn.classList.remove('btn-active');
    }
  }

  /**
   * Request multi-grid move plan and animate slither
   */
  async stepAi() {
    if (this.isGameOver) this.resetGame();
    if (this.isExecutingMultiMove) return false;

    this.setStatus('THINKING...', 'status-thinking');

    try {
      const decision = await window.systemOne.getNextMove({
        gridCols: this.gridCols,
        gridRows: this.gridRows,
        snake: this.snake,
        foods: this.foods,
        currentDir: this.dir
      });

      if (!decision) return false;

      this.updateTelemetry(decision);
      window.retroAudio.playAiBlip();

      const { direction, distance, key, confidence, probabilities, latency, isForcedMove } = decision;
      const probPct = ((probabilities[key] || 0) * 100).toFixed(1);
      if (isForcedMove) {
        this.log(`⚡ [Forced Path] Only 1 safe move: ${direction} x ${distance} tile(s) (0ms)`);
      } else {
        this.log(`System One planned [${key}]: ${direction} x ${distance} tile(s) (prob: ${probPct}%, conf: ${(confidence * 100).toFixed(0)}%) in ${latency}ms`);
      }

      this.setStatus('SLITHERING...', 'status-ready');

      // Set target reticle
      this.targetMarker = {
        x: decision.targetX,
        y: decision.targetY,
        dir: direction,
        dist: distance
      };

      // Set snake heading
      this.dir = direction;

      // Animate multi-grid slither tile by tile
      this.isExecutingMultiMove = true;
      for (let step = 1; step <= distance; step++) {
        if (this.isGameOver) break;

        const ok = this.executeSingleStep();
        if (!ok) break;

        // Check if ANY food was eaten on this step
        if (this.foods.some(f => this.snake[0].x === f.x && this.snake[0].y === f.y)) {
          break;
        }

        if (step < distance) {
          await new Promise(r => setTimeout(r, this.multiStepSpeedMs));
        }
      }

      this.targetMarker = null;
      this.isExecutingMultiMove = false;

      this.setStatus(this.isGameOver ? 'GAME OVER' : 'READY', this.isGameOver ? 'status-dead' : 'status-ready');
      return !this.isGameOver;

    } catch (err) {
      console.error(err);
      this.isExecutingMultiMove = false;
      this.targetMarker = null;
      this.setStatus('API ERROR', 'status-dead');
      this.log(`API Error: ${err.message}`, 'error');
      return false;
    }
  }

  executeSingleStep() {
    if (this.isGameOver) return false;

    const head = this.snake[0];
    let nextX = head.x;
    let nextY = head.y;

    if (this.dir === 'UP') nextY--;
    else if (this.dir === 'DOWN') nextY++;
    else if (this.dir === 'LEFT') nextX--;
    else if (this.dir === 'RIGHT') nextX++;

    // Wall collision
    if (nextX < 0 || nextX >= this.gridCols || nextY < 0 || nextY >= this.gridRows) {
      this.triggerGameOver('Perimeter Wall Collision');
      return false;
    }

    // Body collision
    if (this.snake.some((seg, idx) => idx > 0 && seg.x === nextX && seg.y === nextY)) {
      this.triggerGameOver('Body Collision');
      return false;
    }

    // Advance
    const newHead = { x: nextX, y: nextY };
    this.snake.unshift(newHead);
    this.stepCount++;

    // Food check (handles multiple fruits)
    const eatenIdx = this.foods.findIndex(f => f.x === nextX && f.y === nextY);
    if (eatenIdx !== -1) {
      const eatenFruit = this.foods[eatenIdx];
      this.foods.splice(eatenIdx, 1);

      const isCherry = eatenFruit.type === 'cherry';
      const basePts = isCherry ? 200 : 100;
      const pts = basePts + (this.snake.length * 10);
      this.score += pts;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('snake_highscore', this.highScore.toString());
      }
      this.foodCount++;
      window.retroAudio.playEat();

      this.createFoodBurst(nextX, nextY, eatenFruit.type);
      this.createFloatingText(`+${pts} ${isCherry ? '🍒' : '🍎'}`, nextX, nextY);

      if (this.foods.length === 0) {
        this.spawnFoods();
      } else if (this.foods.length === 1 && Math.random() < 0.45) {
        this.spawnFoods();
      }
    } else {
      this.snake.pop();
      window.retroAudio.playMove();
    }

    this.updateHUD();
    return true;
  }

  triggerGameOver(reason) {
    this.isGameOver = true;
    this.aiRunning = false;
    this.targetMarker = null;
    const btn = document.getElementById('btnStartAi');
    btn.textContent = '▶ START AI AUTO';
    btn.classList.remove('btn-active');

    this.setStatus('GAME OVER', 'status-dead');
    window.retroAudio.playGameOver();
    this.log(`CRASH! Game Over: ${reason}`, 'error');

    const head = this.snake[0];
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: (head.x + 0.5) * this.cellSize,
        y: (head.y + 0.5) * this.cellSize,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        color: ['#ff0055', '#ffaa00', '#ffffff', '#55ff55'][Math.floor(Math.random() * 4)],
        size: Math.random() * 6 + 2,
        life: 1.0,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  }

  createFoodBurst(gx, gy, fruitType = 'apple') {
    const px = (gx + 0.5) * this.cellSize;
    const py = (gy + 0.5) * this.cellSize;
    const palette = fruitType === 'cherry'
      ? ['#ff0080', '#ff66b2', '#ff0055', '#00ffaa', '#ffffff']
      : ['#ff2244', '#ffe600', '#55ff77', '#ffffff'];

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() * 0.4);
      const speed = Math.random() * 5 + 2;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: Math.random() * 4 + 2,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  createFloatingText(text, gx, gy) {
    this.floatingTexts.push({
      text,
      x: (gx + 0.5) * this.cellSize,
      y: (gy + 0.2) * this.cellSize,
      vy: -1.2,
      alpha: 1.0,
      decay: 0.025
    });
  }

  updateTelemetry(decision) {
    const { probabilities, confidence, latency, asciiMap, key, candidateMeta } = decision;

    this.elLatency.textContent = `${latency} ms`;
    this.elConfidence.textContent = `${(confidence * 100).toFixed(1)}%`;
    this.elModelName.textContent = window.systemOne.modelName;

    // Render dynamic candidate probabilities list
    if (this.elProbList) {
      this.elProbList.innerHTML = '';
      const sortedKeys = Object.keys(probabilities).sort((a, b) => (probabilities[b] || 0) - (probabilities[a] || 0));

      sortedKeys.forEach(k => {
        const prob = probabilities[k] || 0;
        const percent = (prob * 100).toFixed(1);
        const isChosen = k === key;
        const meta = candidateMeta[k];
        const dirSymbol = { UP: '▲', DOWN: '▼', LEFT: '◀', RIGHT: '▶' }[meta?.direction || 'RIGHT'];
        const labelText = `${dirSymbol} ${meta?.direction || k} (${meta?.distance || 1} tiles)`;

        const row = document.createElement('div');
        row.className = 'prob-item';
        row.innerHTML = `
          <span class="prob-dir" title="${k}">${labelText}</span>
          <div class="prob-track">
            <div class="prob-fill ${isChosen ? 'prob-fill-chosen' : ''}" style="width: ${percent}%;"></div>
          </div>
          <span class="prob-val">${percent}%</span>
        `;
        this.elProbList.appendChild(row);
      });
    }

    if (this.elAsciiMap) {
      this.elAsciiMap.textContent = asciiMap;
    }
  }

  renderLoop(timestamp) {
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    this.tongueTimer = (this.tongueTimer + dt * 5) % (Math.PI * 2);
    this.foodPulse = (this.foodPulse + dt * 4) % (Math.PI * 2);

    this.draw();
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cs = this.cellSize;

    // Clear board
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, w, h);

    // Subtle checkered grid
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = '#0e131d';
          ctx.fillRect(c * cs, r * cs, cs, cs);
        }
        ctx.strokeStyle = '#151c2b';
        ctx.lineWidth = 1;
        ctx.strokeRect(c * cs, r * cs, cs, cs);
      }
    }

    // Outer glow
    ctx.strokeStyle = '#00ffaa33';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // Draw planned target reticle if slithering
    if (this.targetMarker) {
      this.drawTargetReticle(ctx, this.targetMarker.x, this.targetMarker.y, cs);
    }

    // Draw all active fruits (1 or 2)
    for (const f of this.foods) {
      this.drawPixelFruit(ctx, f, cs);
    }

    // Snake
    this.drawSnake(ctx, cs);

    // Particles
    this.drawParticles(ctx);

    // Floating text
    this.drawFloatingTexts(ctx);

    // Game Over Overlay
    if (this.isGameOver) {
      ctx.fillStyle = 'rgba(10, 0, 15, 0.75)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ff0055';
      ctx.font = 'bold 28px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 15;
      ctx.fillText('CRASH - GAME OVER', w / 2, h / 2 - 20);

      ctx.fillStyle = '#00ffaa';
      ctx.font = '14px "Courier New", monospace';
      ctx.shadowColor = '#00ffaa';
      ctx.shadowBlur = 5;
      ctx.fillText('PRESS RESET OR START AI TO RETRY', w / 2, h / 2 + 25);
      ctx.shadowBlur = 0;
    }
  }

  drawTargetReticle(ctx, gx, gy, cs) {
    if (gx < 0 || gx >= this.gridCols || gy < 0 || gy >= this.gridRows) return;
    const x = gx * cs;
    const y = gy * cs;

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
    ctx.setLineDash([]);

    // Corner crosshairs
    const len = 6;
    ctx.beginPath();
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.moveTo(x + cs - len, y); ctx.lineTo(x + cs, y); ctx.lineTo(x + cs, y + len);
    ctx.moveTo(x + cs, y + cs - len); ctx.lineTo(x + cs, y + cs); ctx.lineTo(x + cs - len, y + cs);
    ctx.moveTo(x + len, y + cs); ctx.lineTo(x, y + cs); ctx.lineTo(x, y + cs - len);
    ctx.stroke();
  }

  drawPixelFruit(ctx, fruit, cs) {
    const x = fruit.x * cs;
    const y = fruit.y * cs;
    const pulse = Math.sin(this.foodPulse) * 1.5;
    const u = cs / 8;

    if (fruit.type === 'cherry') {
      // 16-bit Double Cherries
      // Pink/Magenta soft glow
      ctx.fillStyle = 'rgba(255, 0, 128, 0.25)';
      ctx.beginPath();
      ctx.arc(x + cs / 2, y + cs / 2, cs * 0.45 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Curved brown/green stems meeting at top
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 2.5 * u, y + 5 * u);
      ctx.quadraticCurveTo(x + 3.5 * u, y + 2 * u, x + 4 * u, y + 1.5 * u);
      ctx.moveTo(x + 5.5 * u, y + 4.5 * u);
      ctx.quadraticCurveTo(x + 5 * u, y + 2 * u, x + 4 * u, y + 1.5 * u);
      ctx.stroke();

      // Top Leaf
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(x + 4 * u, y + 1 * u, 2 * u, 1 * u);

      // Cherry 1 (Left)
      ctx.fillStyle = '#e6005c';
      ctx.fillRect(x + 1.5 * u, y + 4.5 * u, 3 * u, 3 * u);
      // Shadow & outline
      ctx.fillStyle = '#800033';
      ctx.fillRect(x + 2 * u, y + 6.5 * u, 2 * u, 1 * u);
      // Shine
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2 * u, y + 5 * u, 1 * u, 1 * u);

      // Cherry 2 (Right)
      ctx.fillStyle = '#ff1a75';
      ctx.fillRect(x + 4.5 * u, y + 4 * u, 3 * u, 3 * u);
      // Shadow
      ctx.fillStyle = '#800033';
      ctx.fillRect(x + 5 * u, y + 6 * u, 2 * u, 1 * u);
      // Shine
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 5 * u, y + 4.5 * u, 1 * u, 1 * u);

    } else {
      // 16-bit Classic Red Apple
      ctx.fillStyle = 'rgba(255, 40, 80, 0.2)';
      ctx.beginPath();
      ctx.arc(x + cs / 2, y + cs / 2, cs * 0.45 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Stem
      ctx.fillStyle = '#654321';
      ctx.fillRect(x + 4 * u, y + 1 * u, 1 * u, 2 * u);
      // Leaf
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(x + 5 * u, y + 1 * u, 2 * u, 1 * u);

      // Apple body (Red with highlights)
      ctx.fillStyle = '#d61b3c';
      ctx.fillRect(x + 2 * u, y + 2 * u, 4 * u, 5 * u);
      ctx.fillRect(x + 1 * u, y + 3 * u, 6 * u, 3 * u);

      // Shading / Shadow
      ctx.fillStyle = '#8a0a20';
      ctx.fillRect(x + 2 * u, y + 6 * u, 4 * u, 1 * u);
      ctx.fillRect(x + 5 * u, y + 3 * u, 1 * u, 3 * u);

      // Specular Highlight
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2 * u, y + 3 * u, 1 * u, 1 * u);
    }
  }

  drawSnake(ctx, cs) {
    const u = cs / 8;

    for (let i = this.snake.length - 1; i >= 1; i--) {
      const seg = this.snake[i];
      const x = seg.x * cs;
      const y = seg.y * cs;

      ctx.fillStyle = '#00cc66';
      ctx.fillRect(x + 1 * u, y + 1 * u, 6 * u, 6 * u);

      ctx.fillStyle = '#33ff99';
      ctx.fillRect(x + 2 * u, y + 2 * u, 3 * u, 3 * u);

      ctx.fillStyle = '#006633';
      ctx.fillRect(x + 4 * u, y + 4 * u, 2 * u, 2 * u);

      ctx.strokeStyle = '#004422';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1 * u, y + 1 * u, 6 * u, 6 * u);
    }

    const head = this.snake[0];
    const hx = head.x * cs;
    const hy = head.y * cs;

    ctx.fillStyle = '#00ff88';
    ctx.fillRect(hx + 1 * u, hy + 1 * u, 6 * u, 6 * u);

    ctx.strokeStyle = '#005522';
    ctx.lineWidth = 2;
    ctx.strokeRect(hx + 1 * u, hy + 1 * u, 6 * u, 6 * u);

    let eye1, eye2, tongueX, tongueY, tongueW, tongueH;
    const isDarting = Math.sin(this.tongueTimer) > 0.3;

    if (this.dir === 'UP') {
      eye1 = { x: hx + 2 * u, y: hy + 2 * u };
      eye2 = { x: hx + 5 * u, y: hy + 2 * u };
      tongueX = hx + 3.5 * u;
      tongueY = hy - (isDarting ? 2 * u : 0.5 * u);
      tongueW = 1 * u;
      tongueH = isDarting ? 2.5 * u : 1 * u;
    } else if (this.dir === 'DOWN') {
      eye1 = { x: hx + 2 * u, y: hy + 5 * u };
      eye2 = { x: hx + 5 * u, y: hy + 5 * u };
      tongueX = hx + 3.5 * u;
      tongueY = hy + 7 * u;
      tongueW = 1 * u;
      tongueH = isDarting ? 2.5 * u : 1 * u;
    } else if (this.dir === 'LEFT') {
      eye1 = { x: hx + 2 * u, y: hy + 2 * u };
      eye2 = { x: hx + 2 * u, y: hy + 5 * u };
      tongueX = hx - (isDarting ? 2 * u : 0.5 * u);
      tongueY = hy + 3.5 * u;
      tongueW = isDarting ? 2.5 * u : 1 * u;
      tongueH = 1 * u;
    } else {
      eye1 = { x: hx + 5 * u, y: hy + 2 * u };
      eye2 = { x: hx + 5 * u, y: hy + 5 * u };
      tongueX = hx + 7 * u;
      tongueY = hy + 3.5 * u;
      tongueW = isDarting ? 2.5 * u : 1 * u;
      tongueH = 1 * u;
    }

    ctx.fillStyle = '#ff0055';
    ctx.fillRect(tongueX, tongueY, tongueW, tongueH);

    [eye1, eye2].forEach(eye => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(eye.x, eye.y, 1.5 * u, 1.5 * u);
      ctx.fillStyle = '#000000';
      ctx.fillRect(eye.x + 0.3 * u, eye.y + 0.3 * u, 0.9 * u, 0.9 * u);
    });
  }

  drawParticles(ctx) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1.0;
  }

  drawFloatingTexts(ctx) {
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= ft.decay;

      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      ctx.fillStyle = `rgba(255, 230, 0, ${ft.alpha})`;
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.snakeGame = new SnakeGame();
});
