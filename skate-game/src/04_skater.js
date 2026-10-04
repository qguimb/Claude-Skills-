// ---------------------------------------------------------------------------
// Skater rig: primitives + two-bone IK. Board frame: +Z nose, +X heel edge.
// The rider stands sideways (regular stance: left foot forward) facing -X.
// ---------------------------------------------------------------------------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _e = new THREE.Vector3(), _f = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const NEG_Y = new THREE.Vector3(0, -1, 0);

function solveTwoBone(upper, lower, L1, L2, target, pole) {
  const root = upper.position;
  const D = _a.subVectors(target, root);
  const d = clamp(D.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  const dir = D.normalize();
  const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const p = _b.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (p.lengthSq() < 1e-8) p.set(0, 0, 1);
  p.normalize();
  const upperDir = _c.copy(dir).multiplyScalar(Math.cos(a)).addScaledVector(p, Math.sin(a));
  const y = _d.copy(upperDir).negate();
  const z = _e.copy(p).addScaledVector(y, -p.dot(y)).normalize();
  const x = _f.crossVectors(y, z);
  _m1.makeBasis(x, y, z);
  upper.quaternion.setFromRotationMatrix(_m1);
  // lower bone direction, expressed in the upper bone's local frame
  const knee = _a.copy(root).addScaledVector(upperDir, L1);
  const ld = _b.subVectors(target, knee).normalize();
  _qa.copy(upper.quaternion).invert();
  ld.applyQuaternion(_qa);
  lower.quaternion.setFromUnitVectors(NEG_Y, ld);
}

function createSkater() {
  const C = {
    skin: new THREE.MeshStandardMaterial({ color: '#c88a62', roughness: 0.7 }),
    shirt: new THREE.MeshStandardMaterial({ color: '#1fa3a0', roughness: 0.85 }),
    pants: new THREE.MeshStandardMaterial({ color: '#2a2732', roughness: 0.9 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#f1ece4', roughness: 0.7 }),
    sole: new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.8 }),
    beanie: new THREE.MeshStandardMaterial({ color: '#e8392f', roughness: 0.9 }),
    hair: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 1 }),
    truck: new THREE.MeshStandardMaterial({ color: '#b8bcc6', roughness: 0.35, metalness: 0.85 }),
    wheel: new THREE.MeshStandardMaterial({ color: '#fff1c9', roughness: 0.5 }),
    deckSide: new THREE.MeshStandardMaterial({ color: '#e0b27a', roughness: 0.7 }),
  };
  const mk = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = false; parent.add(m); return m; };
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10).translate(0, -len / 2 - r * 0.2, 0);

  const root = new THREE.Group(); scene.add(root);
  const lean = new THREE.Group(); root.add(lean);

  // ---- board ----
  const boardRoot = new THREE.Group(); lean.add(boardRoot);
  const boardPivot = new THREE.Group(); boardPivot.position.y = 0.075; boardRoot.add(boardPivot);
  const deckShape = new THREE.Shape();
  const bw = 0.105, bl = 0.4, rr = 0.1;
  deckShape.moveTo(-bw, -bl + rr); deckShape.lineTo(-bw, bl - rr); deckShape.quadraticCurveTo(-bw, bl, 0, bl); deckShape.quadraticCurveTo(bw, bl, bw, bl - rr);
  deckShape.lineTo(bw, -bl + rr); deckShape.quadraticCurveTo(bw, -bl, 0, -bl); deckShape.quadraticCurveTo(-bw, -bl, -bw, -bl + rr);
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 0.014, bevelEnabled: false, curveSegments: 8 });
  deckGeo.rotateX(Math.PI / 2); // shape y -> -z; extrude z -> y (downwards)
  const pa = deckGeo.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const z = pa.getZ(i), k = Math.abs(z) - 0.27;
    if (k > 0) pa.setY(i, pa.getY(i) + k * 0.36);
  }
  deckGeo.computeVertexNormals();
  const grip = gripTexture(); grip.repeat.set(1 / (2 * bw), 1 / (2 * bl)); grip.offset.set(0.5, 0.5);
  const deck = mk(deckGeo, [new THREE.MeshStandardMaterial({ map: grip, roughness: 0.95, side: THREE.DoubleSide }), C.deckSide], boardPivot);
  deck.position.y = 0.114 - 0.075;
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(2 * bw * 0.96, 0.54), new THREE.MeshStandardMaterial({ map: boardBottomTexture(), roughness: 0.6 }));
  bottom.rotation.x = Math.PI / 2; bottom.position.y = 0.1 - 0.075 - 0.001; boardPivot.add(bottom);
  for (const tz of [-0.215, 0.215]) {
    const base = mk(new THREE.BoxGeometry(0.06, 0.016, 0.08), C.truck, boardPivot); base.position.set(0, 0.092 - 0.075, tz);
    const hanger = mk(new THREE.CylinderGeometry(0.012, 0.016, 0.17, 8), C.truck, boardPivot); hanger.rotation.z = Math.PI / 2; hanger.position.set(0, 0.03 - 0.075 + 0.005, tz);
    const king = mk(new THREE.BoxGeometry(0.03, 0.05, 0.03), C.truck, boardPivot); king.position.set(0, 0.06 - 0.075, tz);
    for (const wx of [-0.09, 0.09]) {
      const w = mk(new THREE.CylinderGeometry(0.027, 0.027, 0.032, 14), C.wheel, boardPivot);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.027 - 0.075, tz);
    }
  }
  const anchor = (x, y, z, parent) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  const grabPts = {
    toe: anchor(-0.1, 0.03, 0.02, boardPivot), heel: anchor(0.1, 0.03, 0.02, boardPivot),
    heelBack: anchor(0.1, 0.03, -0.12, boardPivot), nose: anchor(0, 0.08, 0.37, boardPivot), tail: anchor(0, 0.08, -0.37, boardPivot),
  };
  const footFront = anchor(-0.01, 0.2, 0.19, boardRoot), footBack = anchor(-0.01, 0.2, -0.24, boardRoot);

  // ---- rider ----
  const rider = new THREE.Group(); rider.rotation.y = -Math.PI / 2; lean.add(rider);
  const pelvis = new THREE.Group(); rider.add(pelvis);
  mk(new THREE.CapsuleGeometry(0.13, 0.12, 4, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.75), C.pants, pelvis);
  const L1 = 0.44, L2 = 0.44;
  const legs = [];
  for (const side of [1, -1]) {
    const hip = new THREE.Group(); hip.position.set(0.1 * side, -0.02, 0); pelvis.add(hip);
    mk(cap(0.075, L1 - 0.06), C.pants, hip);
    const knee = new THREE.Group(); knee.position.y = -L1; hip.add(knee);
    mk(cap(0.062, L2 - 0.06), C.pants, knee);
    const foot = new THREE.Group(); foot.position.y = -L2; knee.add(foot);
    mk(new THREE.BoxGeometry(0.11, 0.075, 0.27).translate(0, -0.035, 0.04), C.shoe, foot);
    mk(new THREE.BoxGeometry(0.115, 0.02, 0.28).translate(0, -0.075, 0.04), C.sole, foot);
    legs.push({ hip, knee, foot, side });
  }
  const spine = new THREE.Group(); spine.position.y = 0.04; pelvis.add(spine);
  mk(new THREE.CapsuleGeometry(0.16, 0.3, 4, 12).translate(0, 0.26, 0).scale(1, 1, 0.68), C.shirt, spine);
  const neck = new THREE.Group(); neck.position.y = 0.55; spine.add(neck);
  mk(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 8).translate(0, 0.03, 0), C.skin, neck);
  const head = new THREE.Group(); head.position.y = 0.08; neck.add(head);
  mk(new THREE.SphereGeometry(0.115, 16, 12).scale(0.92, 1.05, 1).translate(0, 0.11, 0.01), C.skin, head);
  mk(new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.13, -0.005), C.beanie, head);
  mk(new THREE.TorusGeometry(0.112, 0.02, 6, 16).rotateX(Math.PI / 2).translate(0, 0.14, -0.005), C.beanie, head);
  mk(new THREE.SphereGeometry(0.035, 8, 6).translate(0, 0.25, -0.01), C.beanie, head);
  mk(new THREE.BoxGeometry(0.2, 0.06, 0.12).translate(0, 0.08, -0.07), C.hair, head);
  mk(new THREE.BoxGeometry(0.03, 0.02, 0.02).translate(0.045, 0.12, 0.11), C.hair, head);
  mk(new THREE.BoxGeometry(0.03, 0.02, 0.02).translate(-0.045, 0.12, 0.11), C.hair, head);
  const A1 = 0.29, A2 = 0.3;
  const arms = [];
  for (const side of [1, -1]) {
    const sh = new THREE.Group(); sh.position.set(0.21 * side, 0.47, 0); spine.add(sh);
    mk(cap(0.06, A1 - 0.05), C.shirt, sh);
    const el = new THREE.Group(); el.position.y = -A1; sh.add(el);
    mk(cap(0.045, A2 - 0.06), C.skin, el);
    mk(new THREE.SphereGeometry(0.05, 8, 6).translate(0, -A2, 0), C.skin, el);
    arms.push({ sh, el, side, target: new THREE.Vector3(0.35 * side, 0.05, 0.1), pole: new THREE.Vector3() });
  }

  const P = { hipY: 0.98, tuck: 0, bend: 0.15, twist: 0, headYaw: 1.1, roll: 0, boardPitch: 0, boardYaw: 0, boardLift: 0, boardShift: 0, footLift: 0, armOut: 0.2 };
  const tmp = new THREE.Vector3();
  let pushPhase = 0;

  function boardPoint(obj, out, space) { obj.getWorldPosition(out); return space.worldToLocal(out); }

  return {
    root, lean, boardRoot, boardPivot, rider, pelvis, spine, head, grabPts, footFront, footBack, arms, P,
    // st: per-frame animation state from the controller
    update(dt, st) {
      const k = (rate) => clamp(1 - Math.exp(-rate * dt), 0, 1);
      const T = { hipY: 0.98, tuck: 0, bend: 0.18, twist: 0.25, headYaw: st.fakie ? -1.25 : 1.15, roll: 0, boardPitch: 0, boardYaw: 0, boardLift: 0, footLift: 0, armOut: 0.25 };
      let pushing = false;
      const crouch = Math.max(st.charge || 0, st.landCrouch || 0);
      if (st.mode === 'ground') {
        T.hipY = 0.97 - crouch * 0.3 - Math.min(st.speed / 40, 0.06);
        T.bend = 0.15 + crouch * 0.35;
        T.roll = clamp(st.turn * Math.min(st.speed / 8, 1) * 0.3, -0.35, 0.35);
        pushing = st.pushing;
        T.armOut = 0.25 + Math.abs(st.turn) * 0.2;
      } else if (st.mode === 'air') {
        const pop = clamp(1 - st.airT / 0.22, 0, 1);
        T.tuck = clamp(st.airT / 0.12, 0, 1) * (0.55 + st.grabAmt * 0.35) * (1 - st.landSoon * 0.5);
        T.boardLift = T.tuck * 0.36;
        T.boardPitch = -0.45 * pop * pop;
        T.hipY = 0.98 - T.tuck * 0.12;
        T.bend = 0.2 + T.tuck * 0.25 + st.grabAmt * 0.45;
        T.footLift = st.flipT > 0 && st.flipT < 1 ? 0.14 * Math.sin(Math.PI * st.flipT) + 0.06 : 0;
        T.armOut = 0.6;
      } else if (st.mode === 'grind') {
        T.hipY = 0.88; T.bend = 0.3; T.armOut = 1;
        T.roll = st.balance * 0.45;
        T.boardPitch = st.grindType === 'Nosegrind' ? 0.22 : st.grindType === '5-0' ? -0.22 : 0;
        T.boardLift = 0.0;
      } else if (st.mode === 'manual') {
        T.hipY = 0.92; T.bend = -0.05 + st.balance * 0.15; T.armOut = 0.8;
        T.boardPitch = -(0.24 + st.balance * 0.12) * (st.nose ? -1 : 1);
      } else if (st.mode === 'bail') {
        const b = clamp(st.bailT / 0.45, 0, 1);
        T.hipY = 0.98 - b * 0.62; T.bend = -0.5 * b; T.roll = b * 1.35; T.armOut = 1.2; T.headYaw = 0;
      }
      if (st.mode === 'grind' && (st.grindType === 'Boardslide' || st.grindType === 'Lipslide')) T.twist = 0.1;
      for (const key in T) P[key] = lerp(P[key], T[key], k(key === 'boardPitch' ? 22 : 14));

      lean.rotation.z = P.roll;
      lean.position.y = st.mode === 'bail' ? 0.0 : 0;
      // board placement: lift and pitch about the rear truck for manuals, centre otherwise
      const piv = _c.set(0, 0.02, st.mode === 'manual' ? (st.nose ? 0.215 : -0.215) : 0);
      _qb.setFromEuler(new THREE.Euler(P.boardPitch, 0, 0));
      boardRoot.quaternion.copy(_qb);
      boardRoot.position.copy(piv).sub(piv.clone().applyQuaternion(_qb));
      boardRoot.position.y += P.boardLift;
      if (st.mode === 'bail') {
        const b = clamp(st.bailT / 0.8, 0, 1);
        boardRoot.position.z += b * 1.6; boardRoot.position.x += b * 0.5;
        boardPivot.rotation.set(b * 6, 0, b * 3.1);
      } else boardPivot.quaternion.copy(st.flipQ || _qa.identity());
      footFront.position.set(-0.01, 0.2 + P.footLift, 0.19);
      footBack.position.set(-0.01, 0.2 + P.footLift * 0.7, -0.24);

      pelvis.position.set(0, P.hipY, -P.bend * 0.12);
      pelvis.rotation.set(0, P.twist * 0.3, 0);
      spine.rotation.set(P.bend, P.twist, 0);
      head.rotation.set(-P.bend * 0.6, P.headYaw, 0);

      root.updateMatrixWorld(true);
      // legs: IK feet to the board (back foot pushes on the ground when pushing)
      if (pushing) pushPhase = (pushPhase + dt / 0.62) % 1; else pushPhase = 0;
      for (const leg of legs) {
        const front = leg.side === 1;
        if (!front && pushing && pushPhase > 0.12) {
          const ph = (pushPhase - 0.12) / 0.88;
          const zz = lerp(0.15, -0.55, Math.min(ph / 0.6, 1)) + (ph > 0.6 ? lerp(-0.55, 0.15, (ph - 0.6) / 0.4) + 0.55 : 0);
          const yy = ph > 0.6 ? 0.08 + Math.sin((ph - 0.6) / 0.4 * Math.PI) * 0.15 : 0.08;
          tmp.set(-0.24, yy, zz); boardRoot.localToWorld(tmp); pelvis.worldToLocal(tmp);
        } else boardPoint(front ? footFront : footBack, tmp, pelvis);
        if (st.mode === 'bail') tmp.set(leg.side * 0.25, -0.75, 0.25);
        solveTwoBone(leg.hip, leg.knee, L1, L2, tmp, _e.set(leg.side * 0.35, 0.1, 1));
        leg.foot.quaternion.copy(leg.hip.quaternion).multiply(leg.knee.quaternion).invert();
        leg.foot.quaternion.multiply(_qa.setFromEuler(new THREE.Euler(0, front ? 0.5 : (pushing ? 1.4 : -0.1), 0)));
      }
      // arms: either reach for a grab point or hold a balance pose
      for (const arm of arms) {
        const front = arm.side === 1;
        let target = null;
        if (st.mode === 'air' && st.grabAmt > 0.05 && st.grab) {
          const g = st.grab;
          const useFront = g === 'Melon' || g === 'Nosegrab';
          if (useFront === front) { target = boardPoint(grabPts[GRAB_POINTS[g]], tmp, spine); }
        }
        const rest = _d.set(arm.side * (0.3 + P.armOut * 0.35), 0.12 + P.armOut * 0.3, 0.08 + (st.mode === 'manual' ? 0.15 : 0));
        if (st.mode === 'ground' && pushing && !front) rest.set(-0.35, 0.05, -0.2);
        if (st.mode === 'bail') rest.set(arm.side * 0.6, 0.6 + Math.sin(st.bailT * 18 + arm.side) * 0.2, 0.3);
        if (target) rest.lerp(target, clamp(st.grabAmt, 0, 1));
        arm.target.lerp(rest, target ? 1 : k(12));
        solveTwoBone(arm.sh, arm.el, A1, A2, arm.target, _e.set(arm.side * 0.5, -0.3, -1));
      }
    },
  };
}
const GRAB_POINTS = { Indy: 'toe', Melon: 'heel', Stalefish: 'heelBack', Nosegrab: 'nose', Tailgrab: 'tail' };
