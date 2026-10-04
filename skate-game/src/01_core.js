// three.js (r159 UMD build) is loaded by a script tag and exposed as window.THREE.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const UP = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = mulberry32(1337);

function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

function store(key, val) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, val);
  } catch (e) { /* storage blocked: play without saving */ }
  return null;
}

// ---------------------------------------------------------------------------
// Keyboard input. Arrows or WASD to ride, J/K/L/I are the four "face buttons".
// ---------------------------------------------------------------------------
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'ollie', KeyJ: 'flip', KeyK: 'grab', KeyL: 'grind', KeyI: 'manual',
  KeyP: 'pause', Escape: 'pause', KeyM: 'music', KeyH: 'help', KeyR: 'reset',
};
const input = {
  held: {}, pressedAt: {}, queue: [],
  down(a) { return !!this.held[a]; },
  // true if the action was pressed within `win` seconds (input buffering)
  recent(a, win, now) { return this.pressedAt[a] !== undefined && now - this.pressedAt[a] <= win; },
  consume(a) { delete this.pressedAt[a]; },
  dirX() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); },
  dirY() { return (this.held.up ? 1 : 0) - (this.held.down ? 1 : 0); },
  // the d-pad direction held at the moment a trick button goes down
  dirName() {
    if (this.held.up && !this.held.down) return 'up';
    if (this.held.down && !this.held.up) return 'down';
    if (this.held.left && !this.held.right) return 'left';
    if (this.held.right && !this.held.left) return 'right';
    return 'none';
  },
};
let clockNow = 0;
addEventListener('keydown', (e) => {
  const a = KEYMAP[e.code];
  if (!a) return;
  e.preventDefault();
  if (e.repeat) return;
  input.held[a] = true;
  input.queue.push({ a, dir: input.dirName() });
});
addEventListener('keyup', (e) => {
  const a = KEYMAP[e.code];
  if (!a) return;
  e.preventDefault();
  input.held[a] = false;
  input.queue.push({ a, up: true });
});
addEventListener('blur', () => { input.held = {}; });

// ---------------------------------------------------------------------------
// Audio: every sound is synthesized with WebAudio, including the punk loop.
// ---------------------------------------------------------------------------
const audio = {
  ctx: null, master: null, sfx: null, music: null, musicOn: true, noise: null,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.2; this.music.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.dist = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6) * 0.8; }
    this.dist.curve = curve;
    this.guitarBus = ctx.createBiquadFilter(); this.guitarBus.type = 'lowpass'; this.guitarBus.frequency.value = 2600;
    const gGain = ctx.createGain(); gGain.gain.value = 0.35;
    this.dist.connect(this.guitarBus).connect(gGain).connect(this.music);
    this.initLoops();
    this.startMusic();
  },
  noiseSrc(loop) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = !!loop;
    if (loop) s.loopStart = 0; return s;
  },
  env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  },
  // continuous rolling + grinding beds
  initLoops() {
    const c = this.ctx;
    const roll = this.noiseSrc(true);
    this.rollF = c.createBiquadFilter(); this.rollF.type = 'bandpass'; this.rollF.frequency.value = 500; this.rollF.Q.value = 0.7;
    const rollLow = c.createBiquadFilter(); rollLow.type = 'lowpass'; rollLow.frequency.value = 1400;
    this.rollG = c.createGain(); this.rollG.gain.value = 0;
    roll.connect(this.rollF).connect(rollLow).connect(this.rollG).connect(this.sfx);
    roll.start();
    const grind = this.noiseSrc(true);
    this.grindF = c.createBiquadFilter(); this.grindF.type = 'bandpass'; this.grindF.frequency.value = 2600; this.grindF.Q.value = 4;
    this.grindG = c.createGain(); this.grindG.gain.value = 0;
    grind.connect(this.grindF).connect(this.grindG).connect(this.sfx);
    grind.start();
    const ring = c.createOscillator(); ring.type = 'square'; ring.frequency.value = 1830;
    const ring2 = c.createOscillator(); ring2.type = 'square'; ring2.frequency.value = 2417;
    this.ringG = c.createGain(); this.ringG.gain.value = 0;
    const ringF = c.createBiquadFilter(); ringF.type = 'highpass'; ringF.frequency.value = 1500;
    ring.connect(ringF); ring2.connect(ringF); ringF.connect(this.ringG).connect(this.sfx);
    ring.start(); ring2.start();
  },
  setRoll(speed, grounded, surface) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = grounded ? clamp(speed / 14, 0, 1) : 0;
    this.rollG.gain.setTargetAtTime(v * (surface === 'wood' ? 0.32 : 0.42), t, 0.05);
    this.rollF.frequency.setTargetAtTime((surface === 'wood' ? 260 : 380) + v * 700, t, 0.08);
  },
  setGrind(on, speed, metal) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = on ? 0.25 + clamp(speed / 14, 0, 1) * 0.3 : 0;
    this.grindG.gain.setTargetAtTime(v * (metal ? 1 : 0.8), t, 0.03);
    this.grindF.frequency.setTargetAtTime(metal ? 3200 + Math.random() * 600 : 1300 + Math.random() * 300, t, 0.02);
    this.ringG.gain.setTargetAtTime(on && metal ? 0.012 : 0, t, 0.03);
  },
  tone(type, f0, f1, dur, vol, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = c.createGain(); this.env(g, t, 0.004, vol, dur);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  burst(type, freq, q, dur, vol, when = 0, dest) {
    const c = this.ctx, t = c.currentTime + when;
    const s = this.noiseSrc(false);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this.env(g, t, 0.002, vol, dur);
    s.connect(f).connect(g).connect(dest || this.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  pop() { if (!this.ctx) return; this.burst('highpass', 2500, 0.7, 0.05, 0.6); this.tone('sine', 160, 50, 0.12, 0.6); this.burst('bandpass', 900, 2, 0.08, 0.3, 0.01); },
  land(k) { if (!this.ctx) return; k = clamp(k, 0.2, 1); this.tone('sine', 110, 38, 0.22, 0.8 * k); this.burst('lowpass', 900, 0.8, 0.12, 0.6 * k); this.burst('bandpass', 1800, 3, 0.04, 0.35 * k, 0.015); },
  clack() { if (!this.ctx) return; this.burst('bandpass', 1200, 6, 0.03, 0.16); this.tone('triangle', 420, 300, 0.04, 0.05); },
  whoosh() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime; const s = this.noiseSrc(false); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.25); const g = c.createGain(); this.env(g, t, 0.05, 0.22, 0.22); s.connect(f).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.4); },
  bail() { if (!this.ctx) return; this.burst('lowpass', 500, 1, 0.35, 0.9); this.tone('sine', 90, 30, 0.4, 0.9); this.burst('bandpass', 2400, 2, 0.15, 0.4, 0.08); this.tone('sawtooth', 300, 90, 0.35, 0.08, 0.05); this.burst('bandpass', 1600, 5, 0.05, 0.4, 0.3); },
  bonk() { if (!this.ctx) return; this.tone('square', 220, 110, 0.12, 0.15); this.burst('lowpass', 700, 1, 0.12, 0.5); },
  chime(notes, type = 'triangle', gap = 0.07, vol = 0.22) { if (!this.ctx) return; notes.forEach((n, i) => this.tone(type, n, n * 0.995, 0.35, vol, i * gap)); },
  collect() { this.chime([1046.5, 1318.5, 1568, 2093], 'sine', 0.06, 0.25); },
  bank(big) { this.chime(big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [659.25, 987.77], 'triangle', 0.06, 0.18); },
  goal() { this.chime([392, 523.25, 659.25, 783.99, 1046.5], 'square', 0.09, 0.08); },
  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.music) this.music.gain.setTargetAtTime(this.musicOn ? 0.2 : 0, this.ctx.currentTime, 0.1);
    return this.musicOn;
  },
  // ---- procedural punk loop: E5 C5 G5 D5 power chords, 172 bpm eighths ----
  startMusic() {
    const bpm = 172, eighth = 60 / bpm / 2;
    const roots = [82.41, 65.41, 98.0, 73.42];
    const lead = [659.25, 587.33, 493.88, 440, 392, 440, 493.88, 587.33];
    let step = 0, next = this.ctx.currentTime + 0.1;
    const play = (t, s) => {
      const bar = Math.floor(s / 8) % 8, e = s % 8, root = roots[bar % 4];
      const fill = bar % 4 === 3 && e >= 6;
      if (e === 0 || e === 3 || (e === 4 && bar % 2 === 0)) this.kick(t);
      if (e === 2 || e === 6) this.snare(t, 0.5);
      if (fill) { this.snare(t + eighth / 2, 0.3); }
      this.hat(t, e % 2 ? 0.05 : 0.09);
      this.bass(t, root, eighth * 0.9);
      const open = bar >= 4 && (e === 0 || e === 3 || e === 6);
      if (bar < 4 || open) this.chord(t, root * 2, open ? eighth * 2.6 : eighth * 0.55, open ? 0.5 : 0.32);
      if (bar >= 4 && e % 2 === 0) this.leadNote(t, lead[(bar * 4 + e / 2) % 8], eighth * 1.8);
    };
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.15) { play(next, step); next += eighth; step++; }
    }, 25);
  },
  mk(type, f, t, dur, vol, dest) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02); return o;
  },
  kick(t) { const c = this.ctx, o = c.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); const g = c.createGain(); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.3); },
  snare(t, v) { const c = this.ctx, s = this.noiseSrc(false), f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8; const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); s.connect(f).connect(g).connect(this.music); s.start(t, Math.random()); s.stop(t + 0.2); this.mk('triangle', 190, t, 0.08, v * 0.5, this.music); },
  hat(t, v) { const c = this.ctx, s = this.noiseSrc(false), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500; const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(f).connect(g).connect(this.music); s.start(t, Math.random()); s.stop(t + 0.06); },
  bass(t, f, dur) { const c = this.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(this.music); this.mk('sawtooth', f, t, dur, 0.38, lp); },
  chord(t, f, dur, v) { [1, 1.4983, 2].forEach((m, i) => { this.mk('sawtooth', f * m * (1 + (i - 1) * 0.003), t, dur, v * 0.3, this.dist); }); },
  leadNote(t, f, dur) { const c = this.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(this.music); this.mk('square', f, t, dur, 0.07, lp); },
};
