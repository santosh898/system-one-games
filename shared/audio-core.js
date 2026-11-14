/**
 * Shared 16-Bit Retro Audio Core Engine
 * Manages Web Audio API context, volume/mute state synchronization across all arcade games,
 * and primitive retro chiptune synthesizers.
 */
class RetroAudioCore {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('arcade_audio_muted') === 'true';
    this.listeners = new Set();
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('arcade_audio_muted', this.muted ? 'true' : 'false');
    this.listeners.forEach((fn) => fn(this.muted));
    window.dispatchEvent(new CustomEvent('arcade:audio-toggle', { detail: { muted: this.muted } }));
    return this.muted;
  }

  setMute(state) {
    this.muted = !!state;
    localStorage.setItem('arcade_audio_muted', this.muted ? 'true' : 'false');
    this.listeners.forEach((fn) => fn(this.muted));
    window.dispatchEvent(new CustomEvent('arcade:audio-toggle', { detail: { muted: this.muted } }));
    return this.muted;
  }

  onMuteChange(fn) {
    this.listeners.add(fn);
  }

  // Primitive: Sine/Square/Triangle tone with exponential decay
  playTone(freq, duration = 0.1, type = 'square', peakGain = 0.15) {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  // Primitive: Pitch sweep (chirp/whistle)
  playChirp(startFreq, endFreq, duration = 0.15, type = 'sawtooth', peakGain = 0.15) {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  // Primitive: Filtered white noise burst (for explosions, water splashes, drum hits)
  playNoiseBurst(duration = 0.25, filterType = 'lowpass', startFilterFreq = 800, endFilterFreq = 100, peakGain = 0.25) {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startFilterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFilterFreq), now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Shared UI Blip
  playAiBlip() {
    this.playChirp(750, 1100, 0.05, 'sine', 0.08);
  }

  // Shared Subtle Click
  playClick() {
    this.playTone(400, 0.025, 'triangle', 0.04);
  }
}

window.RetroAudioCore = RetroAudioCore;
window.arcadeAudioCore = new RetroAudioCore();
