/**
 * 16-Bit Retro FX Engine:
 * - Parabolic Missile / Bomb Arc Flight Animation across Battlegrounds
 * - Smoke & Fire Rocket Particle Trail
 * - Impact Explosions & Water Splashes
 * - Retro Speech Bubble Reactions on Battleground & Warships
 */

class RetroNavalFX {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.projectiles = [];
    this.animId = null;
    this.speechTimeouts = { left: null, right: null };
    this.smokeEmitters = new Map();
  }

  init() {
    this.canvas = document.getElementById('fxCanvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'fxCanvas';
      this.canvas.className = 'fx-overlay-canvas';
      document.body.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.startLoop();
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  startLoop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    const loop = () => {
      this.updateAndDraw();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  updateAndDraw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const now = performance.now();

    // Update and draw projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const elapsed = now - p.startTime;
      const progress = Math.min(1.0, elapsed / p.duration);

      // Parabolic calculation
      const curX = p.startX + (p.destX - p.startX) * progress;
      const linearY = p.startY + (p.destY - p.startY) * progress;
      const arc = Math.sin(progress * Math.PI) * p.arcHeight;
      const curY = linearY - arc;

      // Next position for tangent angle
      const nextProgress = Math.min(1.0, progress + 0.02);
      const nextX = p.startX + (p.destX - p.startX) * nextProgress;
      const nextLinearY = p.startY + (p.destY - p.startY) * nextProgress;
      const nextArc = Math.sin(nextProgress * Math.PI) * p.arcHeight;
      const nextY = nextLinearY - nextArc;
      const angle = Math.atan2(nextY - curY, nextX - curX);

      // Emit rocket exhaust particles
      if (Math.random() < 0.75) {
        this.addParticle({
          x: curX - Math.cos(angle) * 10,
          y: curY - Math.sin(angle) * 10,
          vx: (Math.random() - 0.5) * 1.5 - Math.cos(angle) * 2,
          vy: (Math.random() - 0.5) * 1.5 - Math.sin(angle) * 2,
          size: Math.random() * 5 + 3,
          color: Math.random() < 0.4 ? '#ffcc00' : (Math.random() < 0.5 ? '#ff3344' : '#667788'),
          alpha: 0.9,
          decay: 0.035
        });
      }

      // Draw Rocket Shell
      this.ctx.save();
      this.ctx.translate(curX, curY);
      this.ctx.rotate(angle);

      // Glowing missile body
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 10;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.moveTo(12, 0);
      this.ctx.lineTo(-6, -4);
      this.ctx.lineTo(-10, -5);
      this.ctx.lineTo(-6, 0);
      this.ctx.lineTo(-10, 5);
      this.ctx.lineTo(-6, 4);
      this.ctx.closePath();
      this.ctx.fill();

      // Rocket flame
      this.ctx.fillStyle = '#ff7700';
      this.ctx.beginPath();
      this.ctx.moveTo(-6, -2);
      this.ctx.lineTo(-14 - Math.random() * 6, 0);
      this.ctx.lineTo(-6, 2);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.restore();

      if (progress >= 1.0) {
        // Impact reached!
        this.projectiles.splice(i, 1);
        this.createImpactBurst(p.destX, p.destY, p.isHit, p.isSunk);
        if (p.onImpact) p.onImpact();
      }
    }

    // Ongoing organic smoke plumes and fire embers from damaged and sunken warships
    if (this.smokeEmitters.size > 0 && Math.random() < 0.7) {
      for (const [id, emitter] of this.smokeEmitters) {
        if (!emitter.element || !emitter.element.isConnected) continue;
        if (Math.random() < (emitter.isSunk ? 0.35 : 0.22)) {
          const rect = emitter.element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const isSunk = emitter.isSunk;

            this.addParticle({
              x: cx + (Math.random() - 0.5) * 12,
              y: cy + (Math.random() - 0.5) * 6,
              vx: (Math.random() - 0.5) * 0.45 + 0.2, // soft drift
              vy: -Math.random() * 0.9 - 0.6,         // rising smoothly
              size: Math.random() * 6 + 5,
              color: isSunk ? (Math.random() < 0.5 ? '#11141a' : '#1e222a') : (Math.random() < 0.25 ? '#ff5500' : '#262b35'),
              alpha: isSunk ? 0.65 : 0.75,
              decay: 0.012
            });

            if (!isSunk && Math.random() < 0.25) {
              this.addParticle({
                x: cx + (Math.random() - 0.5) * 8,
                y: cy,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -Math.random() * 1.8 - 0.8,
                size: Math.random() * 2.5 + 1.5,
                color: Math.random() < 0.5 ? '#ffcc00' : '#ff3300',
                alpha: 1.0,
                decay: 0.045
              });
            }
          }
        }
      }
    }

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= pt.decay;
      pt.size = Math.max(0.5, pt.size * 0.98);

      if (pt.alpha <= 0 || pt.size <= 0.5) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = pt.alpha;
      this.ctx.fillStyle = pt.color;
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  addParticle(p) {
    this.particles.push(p);
  }

  registerSmokeEmitter(id, element, isSunk = false) {
    this.smokeEmitters.set(id, { element, isSunk });
  }

  clearSmokeEmitters() {
    this.smokeEmitters.clear();
  }

  /**
   * Spawns an animated projectile arcing between elements
   */
  launchArtillery({ fromEl, toEl, isHit, isSunk, onImpact }) {
    if (!fromEl || !toEl) {
      if (onImpact) onImpact();
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.top + fromRect.height / 2;
    const destX = toRect.left + toRect.width / 2;
    const destY = toRect.top + toRect.height / 2;

    const distance = Math.hypot(destX - startX, destY - startY);
    const duration = Math.min(850, Math.max(480, distance * 0.8));
    const arcHeight = Math.min(180, Math.max(90, distance * 0.3));

    this.projectiles.push({
      startX,
      startY,
      destX,
      destY,
      duration,
      arcHeight,
      startTime: performance.now(),
      isHit,
      isSunk,
      onImpact
    });
  }

  /**
   * Spawns impact explosion sparks or water splash burst
   */
  createImpactBurst(x, y, isHit, isSunk) {
    const count = isSunk ? 45 : (isHit ? 25 : 18);
    const colors = isHit 
      ? ['#ff0055', '#ffaa00', '#ffffff', '#ffcc00', '#ff3300']
      : ['#00f0ff', '#3388ff', '#ffffff', '#aaddff'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isSunk ? 8 : (isHit ? 6 : 4)) + 1;
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isHit ? 1 : 2),
        size: Math.random() * (isSunk ? 6 : 4) + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }

    // Add shockwave ring
    const ringColor = isHit ? 'rgba(255, 60, 0, 0.8)' : 'rgba(0, 240, 255, 0.8)';
    let radius = 2;
    const maxRadius = isSunk ? 48 : (isHit ? 30 : 20);
    const ringLoop = () => {
      if (radius >= maxRadius) return;
      this.ctx.save();
      this.ctx.strokeStyle = ringColor;
      this.ctx.lineWidth = 2.5 * (1 - radius / maxRadius);
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
      radius += 2.5;
      requestAnimationFrame(ringLoop);
    };
    requestAnimationFrame(ringLoop);
  }

  /**
   * Shows a naval crew reaction dialogue bubble over the specified battleground board
   */
  showSpeechBubble({ boardSide = 'right', role = 'weapons', speaker = '', text = '', meta = '', duration = 3800 }) {
    const bubbleEl = document.getElementById(`speechBubble${boardSide.toUpperCase()}`);
    if (!bubbleEl) return;

    if (this.speechTimeouts[boardSide]) {
      clearTimeout(this.speechTimeouts[boardSide]);
    }

    const CREW_ROLES = {
      captain: { tag: '👨‍✈️ CAPTAIN VANCE', cls: 'bubble-captain' },
      sonar: { tag: '🎧 SONAR OFFICER HENDERSON', cls: 'bubble-sonar' },
      weapons: { tag: '🎯 WEAPONS OFFICER KOWALSKI', cls: 'bubble-weapons' },
      damage: { tag: '🚨 DAMAGE CONTROL CHIEF MILLER', cls: 'bubble-damage' },
      radar: { tag: '📡 RADAR SPECIALIST CHEN', cls: 'bubble-radar' },
      lookout: { tag: '🔭 LOOKOUT MARTINEZ', cls: 'bubble-lookout' },
      helmsman: { tag: '⚓ HELMSMAN TORRES', cls: 'bubble-helmsman' }
    };

    let crewInfo = CREW_ROLES[role] || CREW_ROLES.weapons;
    let speakerTag = speaker || crewInfo.tag;
    let bubbleClass = crewInfo.cls;

    if (boardSide === 'left') {
      bubbleClass += ' bubble-side-left';
    } else {
      bubbleClass += ' bubble-side-right';
    }

    bubbleEl.className = `speech-bubble-box ${bubbleClass} visible`;
    bubbleEl.innerHTML = `
      <div class="bubble-header">
        <span class="bubble-speaker">${speakerTag}</span>
        ${meta ? `<span class="bubble-meta">${meta}</span>` : ''}
      </div>
      <div class="bubble-body">${text}</div>
      <div class="bubble-pointer"></div>
    `;

    this.speechTimeouts[boardSide] = setTimeout(() => {
      bubbleEl.classList.remove('visible');
    }, duration);
  }
}

window.retroNavalFX = new RetroNavalFX();
