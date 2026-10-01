// ---------------------------------------------------------------------------
// Skater controller: arcade physics over the heightfield + the trick system
// ---------------------------------------------------------------------------
const G = 16, PUSH_ACC = 7.5, PUSH_MAX = 9.6, MAX_SPEED = 15.5, BRAKE = 10;
const OLLIE_MIN = 5.0, OLLIE_MAX = 7.0, CHARGE_TIME = 0.45, TURN_RATE = 2.6, AIR_SPIN = 7.4;
const FLIPS = { none: ['Kickflip', 100], left: ['Heelflip', 100], right: ['Pop Shove-It', 100], up: ['Hardflip', 250], down: ['Impossible', 250] };
const FLIP_AXES = {
  Kickflip: [[0, 0, 1, 1]], Heelflip: [[0, 0, 1, -1]], 'Pop Shove-It': [[0, 1, 0, 0.5]],
  Hardflip: [[0, 1, 0, -0.5], [0, 0, 1, 1]], Impossible: [[1, 0, 0, 1]],
};
const GRABS = { none: ['Indy', 200], left: ['Melon', 200], right: ['Stalefish', 300], up: ['Nosegrab', 250], down: ['Tailgrab', 250] };
const GRINDS = { none: ['50-50', 100], up: ['Nosegrind', 150], down: ['5-0', 150], left: ['Boardslide', 150], right: ['Lipslide', 200] };
const SPIN_PTS = { 180: 100, 360: 300, 540: 600, 720: 1000, 900: 2000, 1080: 3000, 1260: 4000 };
const REPEAT = [1, 0.75, 0.5, 0.25, 0.1];

const sk = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(0, 0, 1),
  n: new THREE.Vector3(0, 1, 0), surf: 'concrete', mode: 'ground', stance: 1,
  charging: false, chargeT: 0, airT: 0, groundLostT: 0, ollied: false, spinRate: 0, spinTotal: 0,
  vertAir: false, vertN: new THREE.Vector3(), takeoff: new THREE.Vector3(),
  flip: null, flipQ: new THREE.Quaternion(), grab: null, grind: null, manual: null,
  bailT: 0, landCrouch: 0, graceT: 0, pushing: false, turn: 0, railCool: null, railCoolT: 0,
  airTricks: 0, landSoon: 0, visQ: new THREE.Quaternion(), jointT: 0,
};
const combo = { tricks: [], base: 0, mult: 0, counts: {}, live: null };
let special = 0;

function resetSkater(pos, dir) {
  sk.pos.copy(pos || world.spawn); sk.vel.set(0, 0, 0);
  sk.fwd.copy(dir || world.spawnDir); sk.up.set(0, 1, 0); sk.n.set(0, 1, 0);
  sk.mode = 'ground'; sk.stance = 1; sk.flip = null; sk.grab = null; sk.grind = null; sk.manual = null;
  sk.charging = false; sk.chargeT = 0; sk.spinRate = 0; sk.bailT = 0; sk.flipQ.identity();
  sampleGround(sk.pos.x, sk.pos.z); sk.pos.y = S.h;
  clearCombo();
  orientQuat(sk.visQ);
  audio.setGrind(false, 0, false);
}

function orientQuat(out) {
  const x = _v1.crossVectors(sk.up, sk.fwd).normalize();
  const f = _v2.crossVectors(x, sk.up).normalize();
  _m1.makeBasis(x, sk.up, f);
  return out.setFromRotationMatrix(_m1);
}

// ---- combo bookkeeping ------------------------------------------------------
function clearCombo() { combo.tricks = []; combo.base = 0; combo.mult = 0; combo.counts = {}; combo.live = null; ui.combo(); }
function addTrick(name, pts, live) {
  const n = combo.counts[name] = (combo.counts[name] || 0) + 1;
  const factor = REPEAT[Math.min(n - 1, REPEAT.length - 1)] * (special >= 1 ? 1.5 : 1);
  const t = { name, pts: pts * factor, base: pts * factor, factor };
  combo.tricks.push(t); combo.mult += 1; combo.base += t.pts;
  if (live) combo.live = t;
  ui.combo();
  return t;
}
function liveAdd(t, pts) { const d = pts * t.factor; t.pts += d; combo.base += d; }
function bankCombo() {
  if (!combo.tricks.length) return;
  const total = Math.round(combo.base * combo.mult);
  game.addScore(total, combo);
  special = clamp(special + total / 6000, 0, 1);
  clearCombo();
}
function loseCombo() {
  const lost = Math.round(combo.base * combo.mult);
  clearCombo();
  special = 0;
  return lost;
}

// ---- helpers -------------------------------------------------------------------
function rotateAround(v, axis, ang) { return v.applyQuaternion(_q1.setFromAxisAngle(axis, ang)); }
function projectOnPlane(v, n) { return v.addScaledVector(n, -v.dot(n)); }
function inZone(z, p) { return p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1; }

function bail(reason) {
  if (sk.mode === 'bail') return;
  const lost = loseCombo();
  sk.mode = 'bail'; sk.bailT = 0; sk.flip = null; sk.grab = null; sk.grind = null; sk.manual = null; sk.charging = false;
  audio.bail(); audio.setGrind(false, 0, false);
  ui.toast(lost > 0 ? `BAILED  −${fmt(lost)}` : 'BAILED', 'bail');
  game.onBail(reason);
}

// ---- takeoff / landing ----------------------------------------------------------
function leaveGround(fromRail) {
  sk.mode = 'air'; sk.airT = 0; sk.spinRate = 0; sk.spinTotal = 0; sk.airTricks = 0;
  sk.takeoff.copy(sk.pos); sk.groundLostT = clockNow;
  sk.vertAir = false;
  if (!fromRail && sk.n.y < 0.45 && sk.vel.y > 0) {
    const hx = sk.n.x, hz = sk.n.z, hl = Math.hypot(hx, hz);
    const nx = hx / hl, nz = hz / hl, vn = sk.vel.x * nx + sk.vel.z * nz;
    if (vn < 0.5) {
      const drift = clamp(0.14 / (2 * Math.max(sk.vel.y, 0.5) / G), 0.08, 0.9); // come back down just below the coping
      sk.vel.x += nx * (drift - vn); sk.vel.z += nz * (drift - vn);
      sk.vertAir = true; sk.vertN.copy(sk.n);
    }
  }
  if (sk.manual) { sk.manual = null; combo.live = null; }
  // buffered trick presses right after the pop
  if (input.recent('flip', 0.2, clockNow)) { startFlip(input.lastDir.flip || 'none'); input.consume('flip'); }
  else if (input.recent('grab', 0.2, clockNow)) { startGrab(input.lastDir.grab || 'none'); input.consume('grab'); }
}

function ollie(power) {
  if (sk.mode === 'ground' && sk.graceT > 0) { sk.graceT = 0; bankCombo(); }
  const v = lerp(OLLIE_MIN, OLLIE_MAX, power) * (special >= 1 ? 1.08 : 1);
  _v3.copy(UP).lerp(sk.n, 0.6).normalize();
  sk.vel.addScaledVector(_v3, v);
  sk.ollied = true;
  audio.pop();
  leaveGround(false);
}

function land() {
  const n = sk.n;
  const vn = sk.vel.dot(n);
  const vt = projectOnPlane(_v1.copy(sk.vel), n);
  const st = vt.length();
  const f = projectOnPlane(_v2.copy(sk.fwd), n).normalize();
  const cosA = st > 1.2 ? f.dot(vt) / st : 1;
  if (sk.flip && sk.flip.angle < sk.flip.target - 0.25) return bail('flip');
  if (sk.grab && sk.grab.amt > 0.45) return bail('grab');
  if (Math.abs(cosA) < 0.72) return bail('sideways');
  if (sk.up.dot(n) < 0.5) return bail('angle');
  // good landing
  sk.flip = null; sk.grab = null; sk.flipQ.identity();
  sk.stance = cosA >= 0 ? 1 : -1;
  sk.vel.copy(vt);
  if (n.y < 0.97 && st > 1) sk.vel.multiplyScalar(1 + Math.min(-vn, 12) * 0.02); // transition landings keep their speed
  if (st > 0.5) sk.fwd.copy(vt).normalize().multiplyScalar(sk.stance); else sk.fwd.copy(f);
  sk.up.copy(n);
  sk.landCrouch = clamp(-vn / 9, 0.25, 1);
  audio.land(-vn / 9);
  const spin = Math.round(Math.abs(sk.spinTotal) * 180 / Math.PI / 180) * 180;
  if (spin >= 180) addTrick(`${sk.spinTotal < 0 ? 'FS' : 'BS'} ${spin}`, SPIN_PTS[Math.min(spin, 1260)] || 4000);
  for (const g of world.gaps) {
    if (inZone(g.from, sk.takeoff) && (g.from.y === undefined || sk.takeoff.y >= g.from.y) && inZone(g.to, sk.pos)) {
      addTrick(g.name, g.pts); ui.toast(g.name, 'small'); game.onGap(g.name);
    }
  }
  if (sk.airT > 1.6 && combo.tricks.length) addTrick('Big Air', 200);
  sk.mode = 'ground';
  sk.graceT = 0.34;
  if (combo.tricks.length && input.recent('manual', 0.3, clockNow)) { input.consume('manual'); startManual(input.lastDir.manual === 'up'); }
}

// ---- tricks -------------------------------------------------------------------------
function startFlip(dir) {
  const [name, pts] = FLIPS[dir];
  if (sk.flip && sk.flip.name === name && sk.flip.count < 3 && sk.flip.angle < sk.flip.target) {
    sk.flip.count++; sk.flip.target += 1;
    const t = combo.live && combo.live.flip ? combo.live : null;
    if (t) { t.name = (sk.flip.count === 2 ? 'Double ' : 'Triple ') + name; liveAdd(t, pts * 1.5); ui.combo(); }
    audio.whoosh();
    return;
  }
  if (sk.flip && sk.flip.angle < sk.flip.target) return;
  if (sk.grab && sk.grab.amt > 0.2) return;
  sk.flip = { name, angle: 0, target: 1, count: 1 };
  const t = addTrick((sk.stance < 0 ? 'Fakie ' : '') + name, pts, true); t.flip = true;
  sk.airTricks++;
  audio.whoosh();
}
function startGrab(dir) {
  if (sk.flip && sk.flip.angle < sk.flip.target - 0.3) return;
  const [name, pts] = GRABS[dir];
  sk.grab = { name, amt: 0, held: true, time: 0, trick: addTrick(name, pts, true) };
  sk.airTricks++;
}

function tryGrind(dir) {
  let best = null, bestScore = 1e9, bestS = 0;
  for (const r of world.rails) {
    if (r === sk.railCool && clockNow - sk.railCoolT < 0.5) continue;
    const s = _v1.subVectors(sk.pos, r.a).dot(r.dir);
    if (s < 0.05 || s > r.len - 0.05) continue;
    const c = _v2.copy(r.a).addScaledVector(r.dir, s);
    const horiz = Math.hypot(sk.pos.x - c.x, sk.pos.z - c.z), dy = sk.pos.y - c.y;
    if (horiz > 1.15 || dy < -0.6 || dy > 1.5) continue;
    if (sk.vel.y > 2 && dy < 0) continue;
    const score = horiz + Math.abs(dy) * 0.4;
    if (score < bestScore) { bestScore = score; best = r; bestS = s; }
  }
  if (!best) return false;
  startGrind(best, bestS, dir);
  return true;
}
function startGrind(r, s, dir) {
  const along = sk.vel.dot(r.dir);
  const sign = Math.abs(along) > 0.8 ? Math.sign(along) : (sk.fwd.dot(r.dir) >= 0 ? 1 : -1);
  const hs = Math.hypot(sk.vel.x, sk.vel.z);
  const [name, pts] = GRINDS[dir];
  if (sk.flip && sk.flip.angle < sk.flip.target - 0.25) { bail('flip'); return; }
  sk.flip = null; sk.flipQ.identity();
  if (sk.grab) { sk.grab = null; }
  const spin = Math.round(Math.abs(sk.spinTotal) * 180 / Math.PI / 180) * 180;
  if (spin >= 180) addTrick(`${spin} ${sk.spinTotal < 0 ? 'FS' : 'BS'}`, SPIN_PTS[Math.min(spin, 1260)] || 4000);
  const label = r.kind === 'rail' ? name : r.kind === 'coping' ? `${name} (Coping)` : name;
  sk.grind = { rail: r, s, sign, speed: Math.max(Math.abs(along), hs * 0.7, 4.2), type: name, time: 0, balance: (Math.random() - 0.5) * 0.3, balVel: 0, seed: Math.random() * 10, trick: addTrick(label, pts, true) };
  sk.mode = 'grind'; sk.vel.set(0, 0, 0);
  game.onGrind(r);
  audio.clack();
}
function startManual(nose) {
  sk.manual = { nose, time: 0, balance: (Math.random() - 0.5) * 0.2, balVel: 0, trick: addTrick(nose ? 'Nose Manual' : 'Manual', nose ? 75 : 50, true) };
  sk.mode = 'manual';
}

// ---- input events (per frame) ----------------------------------------------------
input.lastDir = {};
function handleInput() {
  for (const ev of input.queue) {
    if (ev.up) {
      if (ev.a === 'ollie' && sk.charging) {
        sk.charging = false;
        if (sk.mode === 'ground' || sk.mode === 'manual') ollie(clamp(sk.chargeT / CHARGE_TIME, 0, 1));
        else if (sk.mode === 'air' && !sk.ollied && clockNow - sk.groundLostT < 0.14 && !sk.vertAir) { sk.vel.y = Math.max(sk.vel.y, 0) + lerp(OLLIE_MIN, OLLIE_MAX, clamp(sk.chargeT / CHARGE_TIME, 0, 1)) * 0.85; sk.ollied = true; audio.pop(); }
      }
      if (ev.a === 'grab' && sk.grab) sk.grab.held = false;
      continue;
    }
    if (game.state !== 'play') continue;
    input.lastDir[ev.a] = ev.dir;
    input.pressedAt[ev.a] = clockNow;
    switch (ev.a) {
      case 'ollie':
        if (sk.mode === 'ground') { sk.charging = true; sk.chargeT = 0; }
        else if (sk.mode === 'manual') { sk.charging = true; sk.chargeT = CHARGE_TIME * 0.6; }
        else if (sk.mode === 'grind') grindOllie();
        else if (sk.mode === 'air') { sk.charging = true; sk.chargeT = 0; }
        break;
      case 'flip': if (sk.mode === 'air') { startFlip(ev.dir); input.consume('flip'); } break;
      case 'grab': if (sk.mode === 'air') { startGrab(ev.dir); input.consume('grab'); } break;
      case 'grind':
        if (sk.mode === 'air') { if (tryGrind(ev.dir)) input.consume('grind'); }
        else if (sk.mode === 'grind' && GRINDS[ev.dir][0] !== sk.grind.type) {
          const [name, pts] = GRINDS[ev.dir];
          sk.grind.type = name; sk.grind.trick = addTrick(name, pts, true); audio.clack();
        }
        break;
      case 'manual':
        if (sk.mode === 'ground' && sk.vel.length() > 1) { startManual(ev.dir === 'up'); input.consume('manual'); }
        else if (sk.mode === 'manual') { sk.manual = null; combo.live = null; sk.mode = 'ground'; sk.graceT = 0.05; }
        break;
    }
  }
  input.queue.length = 0;
}

function grindOllie() {
  const g = sk.grind, r = g.rail;
  sk.vel.copy(r.dir).multiplyScalar(g.sign * g.speed);
  sk.vel.y = Math.max(sk.vel.y, 0) + 6.2;
  if (r.outward) sk.vel.addScaledVector(r.outward, 2.2);
  endGrind();
  sk.ollied = true;
  audio.pop();
  leaveGround(true);
}
function endGrind() {
  sk.railCool = sk.grind.rail; sk.railCoolT = clockNow;
  sk.grind = null; combo.live = null;
  sk.up.set(0, 1, 0);
  audio.setGrind(false, 0, false);
}

// ---- per-substep physics ---------------------------------------------------------
function stepGround(dt) {
  const n = sk.n;
  const manual = sk.mode === 'manual', bailing = sk.mode === 'bail';
  // gravity along the slope
  _v1.set(0, -G, 0); projectOnPlane(_v1, n);
  sk.vel.addScaledVector(_v1, dt * (bailing ? 0.6 : 1));
  let speed = sk.vel.length();
  const dir = speed > 0.05 ? _v2.copy(sk.vel).divideScalar(speed) : projectOnPlane(_v2.copy(sk.fwd), n).normalize().multiplyScalar(sk.stance);
  sk.pushing = false;
  if (!bailing) {
    if (input.down('up') && !manual && !sk.charging) {
      if (speed < PUSH_MAX) { sk.vel.addScaledVector(dir, PUSH_ACC * dt); sk.pushing = n.y > 0.95; if (speed < 0.1) sk.stance = 1; }
      if (n.y < 0.96 && sk.vel.dot(_v1) > 0) sk.vel.addScaledVector(dir, 3.2 * dt); // pump down transitions
    }
    if (input.down('down') && !manual) { speed = sk.vel.length(); if (speed > 0) sk.vel.multiplyScalar(Math.max(0, speed - BRAKE * dt) / speed); }
    if (sk.charging) sk.chargeT += dt;
    // steering
    const turn = input.dirX() * (manual ? 0.5 : 1);
    sk.turn = damp(sk.turn, turn, 10, dt);
    const rate = -sk.turn * TURN_RATE * lerp(1, 0.7, clamp(speed / MAX_SPEED, 0, 1)) * dt;
    rotateAround(sk.vel, n, rate); rotateAround(sk.fwd, n, rate);
  }
  speed = sk.vel.length();
  const fric = (bailing ? 9 : 0.28) + 0.0035 * speed * speed;
  if (speed > 0) sk.vel.multiplyScalar(Math.max(0, speed - fric * dt) / speed);
  if (speed > MAX_SPEED) sk.vel.multiplyScalar(MAX_SPEED / speed);

  // move and resolve against the heightfield
  const px = sk.pos.x, pz = sk.pos.z;
  const nx = px + sk.vel.x * dt, nz = pz + sk.vel.z * dt, ny = sk.pos.y + sk.vel.y * dt;
  const lim = world.half - 0.4;
  if (Math.abs(nx) > lim || Math.abs(nz) > lim) {
    if (Math.abs(nx) > lim) sk.vel.x *= -0.3;
    if (Math.abs(nz) > lim) sk.vel.z *= -0.3;
    return;
  }
  const s = sampleGround(nx, nz);
  if (s.h > ny + 0.12) { wallHit(px, pz, ny, dt); return; }
  // leave the ground over a lip or crest: dropped away, or velocity points out of the new surface
  const out = sk.vel.x * s.nx + sk.vel.y * s.ny + sk.vel.z * s.nz;
  if (!bailing && (s.h < ny - 0.045 || (s.h < ny + 0.01 && out > Math.max(1.5, 0.45 * speed)))) {
    sk.pos.set(nx, ny, nz);
    leaveGround(false);
    return;
  }
  sk.pos.set(nx, s.h, nz);
  const sp = sk.vel.length();
  sk.n.set(s.nx, s.ny, s.nz); sk.surf = s.surf;
  projectOnPlane(sk.vel, sk.n);
  if (sk.vel.lengthSq() > 1e-8) sk.vel.setLength(sp);
  // board follows velocity (fakie when rolling backwards)
  sk.up.copy(sk.n);
  if (sp > 0.3 && !bailing) {
    const fd = projectOnPlane(_v3.copy(sk.fwd), sk.n).normalize();
    const vd = _v1.copy(sk.vel).normalize();
    if (fd.dot(vd) * sk.stance < -0.2) sk.stance = -sk.stance;   // rolled back down a ramp
    sk.fwd.copy(vd).multiplyScalar(sk.stance);
  } else projectOnPlane(sk.fwd, sk.n).normalize();
  // concrete expansion joints every 4 m
  if (s.surf === 'concrete' && s.ny > 0.99) {
    const j = Math.floor(nx / 4) + Math.floor(nz / 4) * 1000;
    if (j !== sk.jointT && sp > 2.5) { audio.clack(); }
    sk.jointT = j;
  }
}

function wallHit(px, pz, y, dt) {
  const bx = heightAt(px + sk.vel.x * dt * 2, pz) > y + 0.12;
  const bz = heightAt(px, pz + sk.vel.z * dt * 2) > y + 0.12;
  const impact = Math.hypot(bx ? sk.vel.x : 0, bz ? sk.vel.z : 0);
  if (bx || (!bx && !bz)) sk.vel.x *= -0.35;
  if (bz || (!bx && !bz)) sk.vel.z *= -0.35;
  if (impact > 2.5) { audio.bonk(); game.shake(Math.min(impact / 10, 0.6)); }
  if (sk.mode === 'air' && impact > 6) bail('wall');
}

function stepAir(dt) {
  sk.airT += dt;
  sk.vel.y -= G * dt;
  if (sk.charging) sk.chargeT += dt;
  const target = sk.vertAir ? sk.vertN : UP;
  const ang = sk.up.angleTo(target);
  if (ang > 1e-4) {
    _v1.crossVectors(sk.up, target).normalize();
    if (_v1.lengthSq() > 0.5) { const a = Math.min(ang, 3.5 * dt); rotateAround(sk.up, _v1, a); rotateAround(sk.fwd, _v1, a); }
  }
  const spinIn = -input.dirX() * AIR_SPIN * (special >= 1 ? 1.2 : 1);
  sk.spinRate = damp(sk.spinRate, spinIn, 14, dt);
  rotateAround(sk.fwd, sk.up, sk.spinRate * dt);
  sk.spinTotal += sk.spinRate * dt;
  projectOnPlane(sk.fwd, sk.up).normalize();
  // tricks in progress
  if (sk.flip) {
    sk.flip.angle = Math.min(sk.flip.target, sk.flip.angle + dt / 0.4);
    sk.flipQ.identity();
    for (const [x, y, z, k] of FLIP_AXES[sk.flip.name]) sk.flipQ.multiply(_q1.setFromAxisAngle(_v1.set(x, y, z), sk.flip.angle * k * Math.PI * 2));
    if (sk.flip.angle >= sk.flip.target) { sk.flip = null; sk.flipQ.identity(); combo.live = sk.grab ? sk.grab.trick : null; }
  }
  if (sk.grab) {
    const g = sk.grab;
    g.amt = clamp(g.amt + (g.held ? dt / 0.12 : -dt / 0.1), 0, 1);
    if (g.held && g.amt >= 1) { g.time += dt; if (g.time > 0.25) { liveAdd(g.trick, 260 * dt); ui.combo(); } }
    if (!g.held && g.amt <= 0) { sk.grab = null; combo.live = null; }
  }
  // auto-grind while L is held
  if (input.down('grind') && sk.airT > 0.05 && tryGrind(input.lastDir.grind || 'none')) return;
  const px = sk.pos.x, pz = sk.pos.z, py = sk.pos.y;
  sk.pos.addScaledVector(sk.vel, dt);
  const lim = world.half - 0.4;
  if (Math.abs(sk.pos.x) > lim) { sk.pos.x = Math.sign(sk.pos.x) * lim; sk.vel.x *= -0.3; }
  if (Math.abs(sk.pos.z) > lim) { sk.pos.z = Math.sign(sk.pos.z) * lim; sk.vel.z *= -0.3; }
  const s = sampleGround(sk.pos.x, sk.pos.z);
  // predict landing for the "pull in your tricks" pose
  sk.landSoon = sk.vel.y < 0 && sk.pos.y - s.h < 0.6 ? 1 : 0;
  if (sk.pos.y <= s.h) {
    const step = Math.hypot(sk.pos.x - px, sk.pos.z - pz);
    const slope = Math.sqrt(Math.max(0, 1 - s.ny * s.ny)) / Math.max(s.ny, 0.05);
    if (s.h - py <= 0.12 + step * slope) {
      sk.pos.y = s.h; sk.n.set(s.nx, s.ny, s.nz); sk.surf = s.surf;
      if (sk.mode === 'bail') { sk.vel.copy(projectOnPlane(sk.vel, sk.n)); return; }
      land();
    } else {
      sk.pos.set(px, py, pz);
      wallHit(px, pz, py, dt);
    }
  }
}

function stepGrind(dt) {
  const g = sk.grind, r = g.rail;
  const along = r.dir.y * g.sign;
  g.speed = clamp(g.speed - G * along * dt - 0.5 * dt, 2.6, MAX_SPEED);
  g.s += g.sign * g.speed * dt;
  g.time += dt;
  // balance: drift grows the longer you grind, arrows push back
  const inst = 1.5 + g.time * 0.32;
  const wander = Math.sin(g.time * 1.9 + g.seed) * 0.7 + Math.sin(g.time * 4.3 + g.seed * 2) * 0.3;
  g.balVel += (g.balance * inst * 2.1 + wander * 0.9) * dt + input.dirX() * 3.4 * dt;
  g.balVel *= 1 - 1.6 * dt;
  g.balance += g.balVel * dt;
  liveAdd(g.trick, 300 * dt);
  if (Math.abs(g.balance) >= 1) { const sp = r.dir.clone().multiplyScalar(g.sign * g.speed); endGrind(); sk.vel.copy(sp); sk.vel.addScaledVector(_v1.set(-r.dir.z, 0, r.dir.x), Math.sign(g.balance) * 1.5); bail('balance'); sk.mode = 'bail'; return; }
  const slide = g.type === 'Boardslide' || g.type === 'Lipslide';
  const p = _v1.copy(r.a).addScaledVector(r.dir, clamp(g.s, 0, r.len));
  sk.pos.copy(p); sk.pos.y -= slide ? 0.1 : 0.035;
  const railFwd = _v2.copy(r.dir).multiplyScalar(g.sign);
  if (slide) { sk.up.set(0, 1, 0); sk.fwd.set(railFwd.z, 0, -railFwd.x).normalize(); }
  else { sk.up.copy(UP).addScaledVector(r.dir, -r.dir.y).normalize(); sk.fwd.copy(railFwd).multiplyScalar(sk.stance); }
  audio.setGrind(true, g.speed, r.metal);
  if (Math.random() < 0.9) fx.sparks(sk.pos, r.metal ? 0xffc46b : 0xf0e0c0, railFwd);
  if (g.s < 0 || g.s > r.len) {
    const exitV = railFwd.clone().multiplyScalar(g.speed);
    endGrind();
    sk.vel.copy(exitV); sk.vel.y += 1.2;
    if (r.outward) sk.vel.addScaledVector(r.outward, 1.5);
    sk.ollied = true;
    leaveGround(true);
  }
}

function stepManual(dt) {
  const m = sk.manual;
  m.time += dt;
  const inst = 1.1 + m.time * 0.28;
  const wander = Math.sin(m.time * 1.7 + 3) * 0.6;
  m.balVel += (m.balance * inst * 1.9 + wander * 0.8) * dt + input.dirY() * 3.2 * dt;
  m.balVel *= 1 - 1.6 * dt;
  m.balance += m.balVel * dt;
  liveAdd(m.trick, (m.nose ? 175 : 150) * dt);
  if (Math.abs(m.balance) >= 1) { bail('manual'); return; }
  if (sk.vel.length() < 0.6) { sk.manual = null; combo.live = null; sk.mode = 'ground'; sk.graceT = 0; return; }
  stepGround(dt);
}

function stepBail(dt) {
  sk.bailT += dt;
  if (sk.pos.y > heightAt(sk.pos.x, sk.pos.z) + 0.02) {
    const px = sk.pos.x, pz = sk.pos.z, py = sk.pos.y;
    sk.vel.y -= G * dt; sk.pos.addScaledVector(sk.vel, dt);
    const lim = world.half - 0.4;
    sk.pos.x = clamp(sk.pos.x, -lim, lim); sk.pos.z = clamp(sk.pos.z, -lim, lim);
    const s = sampleGround(sk.pos.x, sk.pos.z);
    if (sk.pos.y < s.h) {
      if (s.h - py > 0.3) { sk.pos.set(px, py, pz); sk.vel.x = 0; sk.vel.z = 0; }
      else { sk.pos.y = s.h; sk.n.set(s.nx, s.ny, s.nz); sk.vel.multiplyScalar(0.4); projectOnPlane(sk.vel, sk.n); }
    }
  } else stepGround(dt);
  if (sk.bailT > 1.7) {
    sampleGround(sk.pos.x, sk.pos.z);
    if (S.ny < 0.9 && sk.bailT < 3.5) return;        // let it slide to the flat first
    // step out onto flat ground if we stopped on a ramp
    let tries = 0;
    while (S.ny < 0.95 && tries++ < 60) { sk.pos.x += S.nx * 0.3; sk.pos.z += S.nz * 0.3; sampleGround(sk.pos.x, sk.pos.z); }
    const dir = _v3.set(sk.fwd.x, 0, sk.fwd.z);
    if (dir.lengthSq() < 0.01) dir.copy(world.spawnDir);
    resetSkater(_v1.set(sk.pos.x, 0, sk.pos.z), dir.normalize().clone());
  }
}

function physicsStep(dt) {
  if (sk.mode === 'ground') {
    stepGround(dt);
    if (sk.mode === 'ground') {
      if (sk.graceT > 0) { sk.graceT -= dt; if (sk.graceT <= 0) bankCombo(); }
    }
  } else if (sk.mode === 'air') stepAir(dt);
  else if (sk.mode === 'grind') stepGrind(dt);
  else if (sk.mode === 'manual') stepManual(dt);
  else if (sk.mode === 'bail') stepBail(dt);
  if (sk.mode !== 'air') { sk.ollied = sk.mode === 'grind' ? sk.ollied : false; }
  sk.landCrouch = Math.max(0, sk.landCrouch - dt * 3);
}

function animState() {
  return {
    mode: sk.mode, speed: sk.vel.length(), turn: sk.turn, pushing: sk.pushing && sk.mode === 'ground',
    charge: sk.charging && (sk.mode === 'ground' || sk.mode === 'manual') ? clamp(sk.chargeT / CHARGE_TIME, 0, 1) : 0,
    landCrouch: sk.landCrouch, airT: sk.airT, fakie: sk.stance < 0,
    flipT: sk.flip ? sk.flip.angle % 1 || (sk.flip.angle > 0 ? 1 : 0) : 0, flipQ: sk.flipQ,
    grab: sk.grab ? sk.grab.name : null, grabAmt: sk.grab ? sk.grab.amt : 0, landSoon: sk.landSoon,
    grindType: sk.grind ? sk.grind.type : null,
    balance: sk.grind ? sk.grind.balance : sk.manual ? sk.manual.balance : 0,
    nose: sk.manual ? sk.manual.nose : false, bailT: sk.bailT,
  };
}
