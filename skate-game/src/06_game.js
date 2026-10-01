// ---------------------------------------------------------------------------
// Particles: grind sparks and landing dust
// ---------------------------------------------------------------------------
function makeParticles(count, size, texFn, blending, color) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3).fill(-999), col = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: texFn(), transparent: true, depthWrite: false, blending, vertexColors: true, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  return { pts, pos, col, vel: new Float32Array(count * 3), life: new Float32Array(count), max: new Float32Array(count), i: 0, count, base: new THREE.Color(color) };
}
const _col = new THREE.Color();
const dotTex = () => canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const fx = {
  init() {
    this.spark = makeParticles(400, 0.09, dotTex, THREE.AdditiveBlending, 0xffc46b);
    this.dust = makeParticles(160, 0.55, dotTex, THREE.NormalBlending, 0xb9a48f);
    this.dust.pts.material.opacity = 0.35;
  },
  emit(sys, p, v, life, color) {
    const i = sys.i = (sys.i + 1) % sys.count;
    sys.pos.set([p.x, p.y, p.z], i * 3); sys.vel.set([v.x, v.y, v.z], i * 3);
    sys.life[i] = sys.max[i] = life;
    _col.set(color).toArray(sys.col, i * 3);
  },
  sparks(p, color, along) {
    for (let k = 0; k < 2; k++) {
      _a.set(-along.x * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2, Math.random() * 2.5, -along.z * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2);
      this.emit(this.spark, p, _a, 0.25 + Math.random() * 0.25, color);
    }
  },
  dustPuff(p, k) {
    for (let i = 0; i < 10 * k; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.5 * k;
      this.emit(this.dust, _b.set(p.x, p.y + 0.1, p.z), _a.set(Math.cos(a) * s, 0.3 + Math.random() * 0.8, Math.sin(a) * s), 0.5 + Math.random() * 0.4, 0xb9a48f);
    }
  },
  update(dt) {
    for (const sys of [this.spark, this.dust]) {
      const g = sys === this.spark ? -12 : 0.4, drag = sys === this.spark ? 0.98 : 0.92;
      for (let i = 0; i < sys.count; i++) {
        if (sys.life[i] <= 0) continue;
        sys.life[i] -= dt;
        const j = i * 3;
        if (sys.life[i] <= 0) { sys.pos[j + 1] = -999; continue; }
        sys.vel[j + 1] += g * dt; sys.vel[j] *= drag; sys.vel[j + 2] *= drag;
        sys.pos[j] += sys.vel[j] * dt; sys.pos[j + 1] += sys.vel[j + 1] * dt; sys.pos[j + 2] += sys.vel[j + 2] * dt;
        const f = sys.life[i] / sys.max[i];
        if (sys === this.spark) { sys.col[j] = 1; sys.col[j + 1] = 0.55 + f * 0.4; sys.col[j + 2] = 0.2 + f * 0.3; }
      }
      sys.pts.geometry.attributes.position.needsUpdate = true;
      sys.pts.geometry.attributes.color.needsUpdate = true;
    }
  },
};

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const ui = {
  dirty: true,
  combo() { this.dirty = true; },
  toast(text, cls = '') {
    const box = $('hud-toast');
    while (box.children.length > 2) box.firstChild.remove();
    const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = text;
    box.appendChild(d); setTimeout(() => d.remove(), 1700);
  },
  render() {
    if (this.dirty) {
      this.dirty = false;
      const names = combo.tricks.map(t => t.name);
      const shown = names.length > 7 ? ['…', ...names.slice(-7)] : names;
      $('combo-tricks').textContent = shown.join(' + ');
      $('combo-points').innerHTML = combo.tricks.length ? `${fmt(combo.base)} <span class="x">× ${combo.mult}</span>` : '';
    }
    $('score-val').textContent = fmt(game.score);
    const sp = $('hud-special'); sp.firstChild.style.width = (special * 100).toFixed(1) + '%'; sp.classList.toggle('full', special >= 1);
    $('speed-val').textContent = Math.round((sk.grind ? sk.grind.speed : sk.vel.length()) * 3.6);
    const g = sk.grind, m = sk.manual;
    $('hud-balance').hidden = !(g || m);
    $('bal-h').hidden = !g; $('bal-v').hidden = !m;
    if (g) $('bal-h').firstChild.style.left = `calc(${50 + g.balance * 50}% - 9px)`;
    if (m) $('bal-v').firstChild.style.top = `calc(${50 - m.balance * 50}% - 9px)`;
    if (game.mode === 'run') {
      const t = Math.max(0, Math.ceil(game.timeLeft));
      $('hud-timer').textContent = game.timeLeft > 0 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : 'LAST COMBO';
      $('hud-timer').classList.toggle('low', game.timeLeft < 15);
    } else $('hud-timer').textContent = 'FREE SKATE';
  },
  letters() { [...$('hud-letters').children].forEach((s, i) => s.classList.toggle('got', world.letters[i].got)); },
  goals() {
    const html = GOALS.map(g => `<div class="g${game.done.has(g.id) ? ' done' : ''}"><b>${game.done.has(g.id) ? '✓' : '·'}</b><span>${g.text}</span></div>`).join('');
    $('hud-goals').innerHTML = html; $('pause-goals').innerHTML = html;
  },
  showHud(on) { for (const id of ['hud-score', 'hud-right', 'hud-combo', 'hud-special', 'hud-speed']) $(id).hidden = !on; $('hud-keys').hidden = !on || !game.showKeys; },
};

// ---------------------------------------------------------------------------
// Goals and session flow
// ---------------------------------------------------------------------------
const GOALS = [
  { id: 's1', text: 'Score 10,000', score: 10000 },
  { id: 's2', text: 'Score 40,000', score: 40000 },
  { id: 's3', text: 'Score 100,000', score: 100000 },
  { id: 'skate', text: 'Collect S-K-A-T-E' },
  { id: 'combo', text: 'Land a 5,000 point combo' },
  { id: 'stairs', text: 'Ollie the Stair Set' },
  { id: 'rail', text: 'Grind the Handrail' },
  { id: 'gap', text: 'Clear the Dumpster Gap' },
];
const game = {
  state: 'menu', mode: 'run', score: 0, timeLeft: 120, done: new Set(), bestCombo: 0, showKeys: true, shakeAmt: 0,
  best() { return +(store('ghs-best-' + this.mode) || 0); },
  complete(id) {
    if (this.done.has(id)) return;
    this.done.add(id);
    const g = GOALS.find(x => x.id === id);
    setTimeout(() => { ui.toast('Goal: ' + g.text, 'goal'); audio.goal(); }, 350);
    ui.goals();
  },
  addScore(total, c) {
    this.score += total;
    this.bestCombo = Math.max(this.bestCombo, total);
    ui.toast('+' + fmt(total), total >= 5000 ? '' : 'small');
    audio.bank(total >= 2500);
    if (total >= 5000) this.complete('combo');
    for (const g of GOALS) if (g.score && this.score >= g.score) this.complete(g.id);
  },
  onGap(name) { if (name === 'Stair Set') this.complete('stairs'); if (name === 'Dumpster Gap') this.complete('gap'); },
  onGrind(r) { if (r.name === 'Handrail') this.complete('rail'); },
  onBail() { this.shake(0.5); fx.dustPuff(sk.pos, 1); },
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); },
  start(mode) {
    audio.init();
    this.mode = mode; this.state = 'play'; this.score = 0; this.timeLeft = 120; this.done = new Set(); this.bestCombo = 0;
    special = 0;
    for (const l of world.letters) { l.got = false; l.sprite.visible = true; }
    resetSkater();
    camState.yaw = Math.atan2(world.spawnDir.x, world.spawnDir.z);
    $('menu').hidden = true; $('results').hidden = true; $('pause').hidden = true;
    $('hud-letters').hidden = false; $('hud-goals').hidden = false;
    ui.showHud(true); ui.letters(); ui.goals();
    const b = this.best(); $('score-best').textContent = b ? `Best ${fmt(b)}` : '';
    ui.toast(mode === 'run' ? '2:00 on the clock. Go!' : 'Free skate', 'small');
    input.queue.length = 0;
  },
  pause(on) {
    if (this.state !== 'play' && this.state !== 'pause') return;
    this.state = on ? 'pause' : 'play';
    $('pause').hidden = !on;
    if (on) { audio.setRoll(0, false); audio.setGrind(false, 0, false); $('btn-resume').focus(); }
  },
  end() {
    if (sk.mode === 'ground' || sk.mode === 'manual') bankCombo();
    this.state = 'results';
    audio.setRoll(0, false); audio.setGrind(false, 0, false);
    const prev = this.best(), isBest = this.score > prev;
    if (isBest) store('ghs-best-' + this.mode, String(Math.round(this.score)));
    $('res-title').textContent = this.mode === 'run' ? (isBest && this.score > 0 ? 'New Best!' : "Time's Up") : 'Session Over';
    $('res-score').textContent = fmt(this.score);
    $('res-detail').innerHTML = `Goals ${this.done.size} / ${GOALS.length} &nbsp;·&nbsp; Best combo ${fmt(this.bestCombo)} &nbsp;·&nbsp; Letters ${world.letters.filter(l => l.got).length} / 5` + (prev && !isBest ? `<br>Your best: ${fmt(prev)}` : '');
    $('results').hidden = false; ui.showHud(false); $('hud-balance').hidden = true;
    $('btn-again').focus();
  },
  menu() {
    this.state = 'menu'; $('results').hidden = true; $('pause').hidden = true; $('menu').hidden = false;
    ui.showHud(false); $('hud-balance').hidden = true; clearCombo(); resetSkater();
    $('btn-run').focus();
  },
};

// ---------------------------------------------------------------------------
// Camera: chase cam that swings behind the direction of travel
// ---------------------------------------------------------------------------
const camState = { yaw: 0, y: 2, pos: new THREE.Vector3(), look: new THREE.Vector3(), menuT: 0 };
function angleDamp(a, b, rate, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-rate * dt));
}
function updateCamera(dt) {
  if (game.camOverride) { camera.position.copy(game.camOverride.pos); camera.lookAt(game.camOverride.look); return; }
  if (game.state === 'menu') {
    camState.menuT += dt * 0.06;
    const a = camState.menuT + 0.6;
    camera.position.set(Math.sin(a) * 34, 13, Math.cos(a) * 34);
    camera.lookAt(0, 1.5, 0);
    return;
  }
  const hv = Math.hypot(sk.vel.x, sk.vel.z);
  let target = camState.yaw, rate = 3;
  if (sk.mode === 'grind') { const r = sk.grind.rail; target = Math.atan2(r.dir.x * sk.grind.sign, r.dir.z * sk.grind.sign); rate = 4; }
  else if (sk.mode === 'air' && sk.vertAir) rate = 0;
  else if (hv > 1.2) { target = Math.atan2(sk.vel.x, sk.vel.z); rate = sk.mode === 'air' ? 1.2 : 3.2; }
  else if (sk.mode === 'ground' && hv < 0.3) { target = Math.atan2(sk.fwd.x * sk.stance, sk.fwd.z * sk.stance); rate = 2; }
  camState.yaw = angleDamp(camState.yaw, target, rate, dt);
  const speed = sk.vel.length();
  const dist = 4.4 + Math.min(speed / MAX_SPEED, 1) * 1.2, height = 1.8;
  const bx = Math.sin(camState.yaw), bz = Math.cos(camState.yaw);
  camState.y = damp(camState.y, sk.pos.y + height, sk.mode === 'air' ? 3 : 8, dt);
  const want = _a.set(sk.pos.x - bx * dist, camState.y, sk.pos.z - bz * dist);
  const lim = world.half - 0.6;
  want.x = clamp(want.x, -lim, lim); want.z = clamp(want.z, -lim, lim);
  want.y = Math.max(want.y, heightAt(want.x, want.z) + 0.7);
  camState.pos.lerp(want, 1 - Math.exp(-12 * dt));
  if (camState.pos.distanceTo(sk.pos) > 20) camState.pos.copy(want);
  camera.position.copy(camState.pos);
  if (game.shakeAmt > 0) {
    camera.position.x += (Math.random() - 0.5) * game.shakeAmt * 0.4;
    camera.position.y += (Math.random() - 0.5) * game.shakeAmt * 0.4;
    game.shakeAmt = Math.max(0, game.shakeAmt - dt * 2);
  }
  camState.look.lerp(_b.set(sk.pos.x + bx * 1.4, sk.pos.y + 1.0, sk.pos.z + bz * 1.4), 1 - Math.exp(-14 * dt));
  camera.lookAt(camState.look);
  const fov = 66 + Math.min(speed / MAX_SPEED, 1) * 10;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const STEP = 1 / 120;
let rig, acc = 0, lastT = performance.now(), wasMode = 'ground';
const _tq = new THREE.Quaternion();

function globalKeys() {
  for (const ev of input.queue) {
    if (ev.up) continue;
    if (ev.a === 'music') { const on = audio.toggleMusic(); ui.toast(on ? 'Music on' : 'Music off', 'small'); }
    if (ev.a === 'help' && game.state === 'play') { game.showKeys = !game.showKeys; $('hud-keys').hidden = !game.showKeys; }
    if (ev.a === 'pause') game.pause(game.state === 'play');
    if (ev.a === 'reset' && game.state === 'play') { const lost = loseCombo(); if (lost) ui.toast('Reset', 'small'); resetSkater(); }
    if (ev.a === 'ollie' && game.state === 'menu') { game.start('run'); break; }
    if (ev.a === 'ollie' && game.state === 'results') { game.start(game.mode); break; }
  }
}

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min((t - lastT) / 1000, 0.05); lastT = t;
  globalKeys();
  if (game.state === 'play' && !game.freeze) {
    clockNow += dt;
    handleInput();
    acc += dt;
    while (acc >= STEP) { physicsStep(STEP); acc -= STEP; }
    if (wasMode === 'air' && sk.mode === 'ground') fx.dustPuff(sk.pos, sk.landCrouch);
    wasMode = sk.mode;
    // letters
    const body = _c.copy(sk.pos).addScaledVector(sk.up, 0.9);
    for (const l of world.letters) {
      if (!l.got && body.distanceTo(l.pos) < 1.6) {
        l.got = true; l.sprite.visible = false; audio.collect(); ui.letters();
        ui.toast(l.ch, 'small');
        if (world.letters.every(x => x.got)) game.complete('skate');
      }
    }
    if (game.mode === 'run') {
      game.timeLeft -= dt;
      if (game.timeLeft <= 0 && (sk.mode === 'ground' && !combo.tricks.length || sk.mode === 'bail' || game.timeLeft < -12)) game.end();
    }
    audio.setRoll(sk.vel.length(), sk.mode === 'ground' || sk.mode === 'manual', sk.surf);
    if (sk.mode !== 'grind') audio.setGrind(false, 0, false);
  } else {
    input.queue.length = 0;
  }
  // skater visuals
  rig.root.position.copy(sk.pos);
  orientQuat(_tq);
  sk.visQ.slerp(_tq, 1 - Math.exp(-(sk.mode === 'air' ? 30 : 18) * dt));
  rig.root.quaternion.copy(sk.visQ);
  rig.update(dt, animState());
  // letters bob and spin
  for (const l of world.letters) { l.sprite.position.y = l.pos.y + Math.sin(t / 400 + l.pos.x) * 0.12; l.sprite.material.rotation = Math.sin(t / 700 + l.pos.z) * 0.15; }
  updateCamera(dt);
  fx.update(dt);
  sky.material.uniforms.time.value = t / 1000;
  sky.position.copy(camera.position);
  sun.position.copy(sk.pos).addScaledVector(SUN_DIR, 60);
  sun.target.position.copy(sk.pos);
  if (game.state === 'play' || game.state === 'pause') ui.render();
  renderer.render(scene, camera);
}

async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('64px Bungee'), document.fonts.load('64px "Permanent Marker"'), document.fonts.load('16px "Barlow Condensed"')]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fall back to system fonts */ }
  buildPark();
  fx.init();
  rig = createSkater();
  resetSkater();
  ui.goals();
  if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('touch-note').hidden = false;
  $('btn-run').onclick = () => game.start('run');
  $('btn-free').onclick = () => game.start('free');
  $('btn-resume').onclick = () => game.pause(false);
  $('btn-quit').onclick = () => { game.pause(false); game.end(); };
  $('btn-again').onclick = () => game.start(game.mode);
  $('btn-menu').onclick = () => game.menu();
  $('btn-run').focus();
  // test hook: advance the simulation deterministically
  window.__skate = { sk, world, game, combo, input, special: () => special,
    step(n) { for (let i = 0; i < n; i++) { clockNow += STEP; handleInput(); physicsStep(STEP); } },
    key(a, down, dir = 'none') { input.held[a] = down; input.queue.push(down ? { a, dir } : { a, up: true }); } };
  requestAnimationFrame(frame);
}
boot();
