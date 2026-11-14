/**
 * 16-Bit Retro Naval Audio Synthesizer via Web Audio API
 * Extends shared RetroAudioCore
 */
class RetroNavalAudio extends RetroAudioCore {
  constructor() {
    super();
  }

  // Sonar Ping (classic submarine radar ping)
  playSonar() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1240, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.6);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.8);
  }

  // Missile Launch (filtered rising whistle + swoosh)
  playLaunch() {
    this.playChirp(160, 880, 0.22, 'sawtooth', 0.16);
  }

  // Water Splash (Miss)
  playMiss() {
    this.playNoiseBurst(0.24, 'bandpass', 450, 120, 0.22);
  }

  // Direct Hit (Explosion & metal impact)
  playHit() {
    if (this.muted) return;
    this.init();
    this.playNoiseBurst(0.34, 'lowpass', 800, 90, 0.35);

    // Sub-bass thump
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  // Ship Sunk (Multi-stage heavy blast & siren)
  playSunk() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    // 3 successive explosions
    [0, 0.12, 0.26].forEach((delay) => {
      setTimeout(() => {
        this.playNoiseBurst(0.3, 'lowpass', 950, 60, 0.28);
      }, delay * 1000);
    });

    // Retro alarm chime
    setTimeout(() => {
      if (this.muted) return;
      const t2 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, t2);
      osc.frequency.setValueAtTime(554, t2 + 0.12);
      osc.frequency.setValueAtTime(659, t2 + 0.24);
      osc.frequency.setValueAtTime(880, t2 + 0.36);

      g.gain.setValueAtTime(0.18, t2);
      g.gain.exponentialRampToValueAtTime(0.001, t2 + 0.55);

      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t2);
      osc.stop(t2 + 0.55);
    }, 280);
  }

  // Victory Fanfare
  playVictory() {
    if (this.muted) return;
    this.init();
    const notes = [261.6, 329.6, 392.0, 523.2, 659.2, 783.9, 1046.5];
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.08;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (idx === notes.length - 1 ? 0.45 : 0.1));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + (idx === notes.length - 1 ? 0.45 : 0.1));
    });
  }

  // Defeat / Game Over Sound
  playDefeat() {
    if (this.muted) return;
    this.init();
    const notes = [440, 415, 392, 349];
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.18;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.25);
    });
  }
}

window.retroAudio = new RetroNavalAudio();
