// ---------------------------------------------------------------------------
// Low-detail fallback renderer for browsers that cannot create a WebGL context
// (GPU blocked or hardware acceleration turned off). It draws the same scene graph
// as flat-shaded polygons on a 2D canvas, sorted back to front (painter's algorithm).
// ---------------------------------------------------------------------------
function createSoftRenderer(container, skipRoot) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  const SCALE = 0.75, NEAR = 0.15, FAR = 150, FOG0 = 45;
  let W = 1, H = 1;
  function resize() {
    W = canvas.width = Math.max(1, Math.round(innerWidth * SCALE));
    H = canvas.height = Math.max(1, Math.round(innerHeight * SCALE));
  }
  resize();
  addEventListener('resize', resize);

  const FOG_RGB = (() => { const c = FOG.clone().convertLinearToSRGB(); return [c.r * 255, c.g * 255, c.b * 255]; })();
  const L = SUN_DIR;

  // ---- per-material flat colours (texture maps contribute their average colour) ----
  const texAvg = new Map();
  function avgOf(tex) {
    if (!tex || !tex.image) return [255, 255, 255];
    if (texAvg.has(tex)) return texAvg.get(tex);
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); g.drawImage(tex.image, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    const v = n ? [r / n, gg / n, b / n] : [255, 255, 255];
    texAvg.set(tex, v); return v;
  }
  function matInfo(mat) {
    if (mat.userData.soft) return mat.userData.soft;
    const c = mat.color ? mat.color.clone().convertLinearToSRGB() : new THREE.Color(1, 1, 1);
    const t = avgOf(mat.map);
    const info = { rgb: [c.r * t[0], c.g * t[1], c.b * t[2]], unlit: !!mat.isMeshBasicMaterial, dbl: mat.side === THREE.DoubleSide };
    mat.userData.soft = info;
    return info;
  }
  function shade(rgb, unlit, nx, ny, nz, out, o) {
    if (unlit) { out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2]; return; }
    const ndl = Math.max(0, nx * L.x + ny * L.y + nz * L.z), amb = 0.52 + 0.16 * ny;
    out[o] = Math.min(255, rgb[0] * (amb * 0.95 + ndl * 0.9));
    out[o + 1] = Math.min(255, rgb[1] * (amb * 0.86 + ndl * 0.66));
    out[o + 2] = Math.min(255, rgb[2] * (amb * 0.95 + ndl * 0.42));
  }

  // ---- mesh -> local triangle cache --------------------------------------------------
  function prep(mesh) {
    if (mesh.userData.softTris) return mesh.userData.softTris;
    const geo = mesh.geometry, P = geo.attributes.position, I = geo.index;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const total = (I ? I.count : P.count) / 3;
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: total * 3, materialIndex: 0 }];
    const pos = new Float32Array(total * 9), info = new Array(total);
    let n = 0;
    for (const gr of groups) {
      const m = matInfo(mats[gr.materialIndex] || mats[0]);
      const end = Math.min(gr.start + gr.count, total * 3);
      for (let k = gr.start; k < end; k += 3) {
        for (let v = 0; v < 3; v++) {
          const idx = I ? I.getX(k + v) : k + v;
          pos[n * 9 + v * 3] = P.getX(idx); pos[n * 9 + v * 3 + 1] = P.getY(idx); pos[n * 9 + v * 3 + 2] = P.getZ(idx);
        }
        info[n++] = m;
      }
    }
    return (mesh.userData.softTris = { pos, info, n });
  }

  // world-space triangle store: positions, front/back colours, double-sided flag
  function makeStore(cap) { return { pos: new Float32Array(cap * 9), col: new Float32Array(cap * 6), dbl: new Uint8Array(cap), n: 0, cap }; }
  function grow(st, need) {
    if (st.n + need <= st.cap) return;
    const cap = Math.max(st.cap * 2, st.n + need);
    const p = new Float32Array(cap * 9); p.set(st.pos); st.pos = p;
    const c = new Float32Array(cap * 6); c.set(st.col); st.col = c;
    const d = new Uint8Array(cap); d.set(st.dbl); st.dbl = d; st.cap = cap;
  }
  function addMeshTo(st, mesh) {
    const t = prep(mesh), e = mesh.matrixWorld.elements;
    grow(st, t.n);
    for (let i = 0; i < t.n; i++) {
      const o = st.n * 9;
      for (let v = 0; v < 3; v++) {
        const x = t.pos[i * 9 + v * 3], y = t.pos[i * 9 + v * 3 + 1], z = t.pos[i * 9 + v * 3 + 2];
        st.pos[o + v * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
        st.pos[o + v * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        st.pos[o + v * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      const p = st.pos;
      const ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2];
      const vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const m = t.info[i];
      shade(m.rgb, m.unlit, nx, ny, nz, st.col, st.n * 6);
      shade(m.rgb, m.unlit, -nx, -ny, -nz, st.col, st.n * 6 + 3);
      st.dbl[st.n] = m.dbl ? 1 : 0;
      st.n++;
    }
  }

  function walk(o, fn) {
    if (!o.visible || o === skipRoot || o.userData.skip || o.isPoints || o.isSprite) return;
    if (o.isMesh) fn(o);
    for (const c of o.children) walk(c, fn);
  }
  scene.updateMatrixWorld(true);
  const floor = makeStore(64), world3 = makeStore(4096), dyn = makeStore(2048);
  const floors = [];
  walk(scene, (m) => (m.userData.floor ? floors.push(m) : addMeshTo(world3, m)));
  floors.sort((a, b) => a.position.y - b.position.y).forEach((m) => addMeshTo(floor, m)); // lowest layer first

  // ---- per-frame projection --------------------------------------------------------------
  const vp = new THREE.Matrix4();
  let e = vp.elements;
  const pool = [];
  let used = 0;
  const order = [];
  const cx = new Float32Array(8), cy = new Float32Array(8), cw = new Float32Array(8);
  function item() {
    if (used === pool.length) pool.push({ d: 0, n: 0, xs: new Float32Array(5), ys: new Float32Array(5), fill: '' });
    return pool[used++];
  }
  function clipPush(st, i, list, fog) {
    const p = st.pos, o = i * 9;
    let inside = 0, wsum = 0;
    for (let v = 0; v < 3; v++) {
      const x = p[o + v * 3], y = p[o + v * 3 + 1], z = p[o + v * 3 + 2];
      cx[v] = e[0] * x + e[4] * y + e[8] * z + e[12];
      cy[v] = e[1] * x + e[5] * y + e[9] * z + e[13];
      cw[v] = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (cw[v] > NEAR) inside++;
      wsum += cw[v];
    }
    if (!inside) return;
    const depth = wsum / 3;
    if (fog && depth > FAR) return;
    let n = 3;
    if (inside < 3) { // clip against the near plane (Sutherland-Hodgman, one plane)
      const ox = [], oy = [], ow = [];
      for (let v = 0; v < 3; v++) {
        const u = (v + 1) % 3, a = cw[v] > NEAR, b = cw[u] > NEAR;
        if (a) { ox.push(cx[v]); oy.push(cy[v]); ow.push(cw[v]); }
        if (a !== b) {
          const t = (NEAR - cw[v]) / (cw[u] - cw[v]);
          ox.push(cx[v] + (cx[u] - cx[v]) * t); oy.push(cy[v] + (cy[u] - cy[v]) * t); ow.push(NEAR);
        }
      }
      n = ox.length;
      for (let v = 0; v < n; v++) { cx[v] = ox[v]; cy[v] = oy[v]; cw[v] = ow[v]; }
    }
    const it = item();
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let v = 0; v < n; v++) {
      const sx = (cx[v] / cw[v] * 0.5 + 0.5) * W, sy = (0.5 - cy[v] / cw[v] * 0.5) * H;
      it.xs[v] = sx; it.ys[v] = sy;
      if (sx < minX) minX = sx; if (sx > maxX) maxX = sx; if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    }
    if (maxX < 0 || minX > W || maxY < 0 || minY > H) { used--; return; }
    const area = (it.xs[1] - it.xs[0]) * (it.ys[2] - it.ys[0]) - (it.xs[2] - it.xs[0]) * (it.ys[1] - it.ys[0]);
    const front = area < 0;
    if (!front && !st.dbl[i]) { used--; return; }
    const c = i * 6 + (front ? 0 : 3);
    let r = st.col[c], g = st.col[c + 1], b = st.col[c + 2];
    if (fog) {
      const f = clamp((depth - FOG0) / (FAR - FOG0), 0, 1);
      r += (FOG_RGB[0] - r) * f; g += (FOG_RGB[1] - g) * f; b += (FOG_RGB[2] - b) * f;
    }
    it.d = depth; it.n = n; it.fill = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
    list.push(it);
  }
  function drawPoly(it) {
    ctx.beginPath(); ctx.moveTo(it.xs[0], it.ys[0]);
    for (let v = 1; v < it.n; v++) ctx.lineTo(it.xs[v], it.ys[v]);
    ctx.closePath();
    ctx.fillStyle = it.fill; ctx.strokeStyle = it.fill;
    ctx.fill(); ctx.stroke();
  }
  const byDepth = (a, b) => b.d - a.d;
  const _p = new THREE.Vector3(), _fw = new THREE.Vector3();
  function toScreen(x, y, z) {
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (w <= NEAR) return null;
    return [((e[0] * x + e[4] * y + e[8] * z + e[12]) / w * 0.5 + 0.5) * W, (0.5 - (e[1] * x + e[5] * y + e[9] * z + e[13]) / w * 0.5) * H, w];
  }

  function render(scene, cam) {
    scene.updateMatrixWorld();
    cam.updateMatrixWorld();
    vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); e = vp.elements;
    used = 0;
    ctx.lineWidth = 1; ctx.lineJoin = 'round';
    // sky: gradient down to the horizon line, sun glow
    cam.getWorldDirection(_fw); _fw.y = 0; _fw.normalize();
    const hz = toScreen(cam.position.x + _fw.x * 1000, cam.position.y, cam.position.z + _fw.z * 1000);
    const hy = hz ? hz[1] : H * 0.5;
    const sky = ctx.createLinearGradient(0, Math.min(hy - H * 0.9, 0), 0, hy);
    sky.addColorStop(0, '#3a2a63'); sky.addColorStop(0.55, '#e7787a'); sky.addColorStop(1, '#ffc58a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const sp = toScreen(cam.position.x + L.x * 1000, cam.position.y + L.y * 1000, cam.position.z + L.z * 1000);
    if (sp) {
      const gl = ctx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], H * 0.35);
      gl.addColorStop(0, 'rgba(255,240,200,0.95)'); gl.addColorStop(0.06, 'rgba(255,220,160,0.7)'); gl.addColorStop(1, 'rgba(255,170,110,0)');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    }
    // floor slabs, then 4 m expansion joints, then distance haze
    const fl = [];
    for (let i = 0; i < floor.n; i++) clipPush(floor, i, fl, false);
    for (const it of fl) drawPoly(it);
    ctx.strokeStyle = 'rgba(60,45,45,0.35)'; ctx.beginPath();
    const half = world.half;
    for (let k = -half; k <= half; k += 4) {
      seg(k, -half, k, half); seg(-half, k, half, k);
    }
    ctx.stroke();
    if (hz) {
      const near = toScreen(cam.position.x + _fw.x * FOG0, 0, cam.position.z + _fw.z * FOG0);
      if (near && near[1] > hy) {
        const haze = ctx.createLinearGradient(0, hy, 0, near[1]);
        haze.addColorStop(0, `rgba(${FOG_RGB.map(v => v | 0).join(',')},1)`); haze.addColorStop(1, `rgba(${FOG_RGB.map(v => v | 0).join(',')},0)`);
        ctx.fillStyle = haze; ctx.fillRect(0, hy - 2, W, near[1] - hy + 2);
      }
    }
    // the park, far to near
    order.length = 0;
    for (let i = 0; i < world3.n; i++) clipPush(world3, i, order, true);
    order.sort(byDepth);
    for (const it of order) drawPoly(it);
    // blob shadow, then the skater on top
    if (skipRoot && skipRoot.visible) {
      const s = skipRoot.position, gh = heightAt(s.x, s.z) + 0.03;
      ctx.fillStyle = 'rgba(40,20,40,0.35)'; ctx.beginPath();
      let ok = true;
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2, q = toScreen(s.x + Math.cos(a) * 0.45, gh, s.z + Math.sin(a) * 0.45);
        if (!q) { ok = false; break; }
        k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      if (ok) ctx.fill();
      dyn.n = 0;
      walk2(skipRoot);
      order.length = 0;
      for (let i = 0; i < dyn.n; i++) clipPush(dyn, i, order, true);
      order.sort(byDepth);
      for (const it of order) drawPoly(it);
    }
    // S-K-A-T-E letters as billboards
    const k = H / (2 * Math.tan(cam.fov * Math.PI / 360));
    for (const l of world.letters) {
      if (!l.sprite.visible) continue;
      const q = toScreen(l.sprite.position.x, l.sprite.position.y, l.sprite.position.z);
      if (!q || q[2] > FAR) continue;
      const size = 1.6 * k / q[2];
      ctx.drawImage(l.sprite.material.map.image, q[0] - size / 2, q[1] - size / 2, size, size);
    }
  }
  function seg(x0, z0, x1, z1) {
    let w0 = e[3] * x0 + e[11] * z0 + e[15], w1 = e[3] * x1 + e[11] * z1 + e[15];
    if (w0 <= NEAR && w1 <= NEAR) return;
    if (w0 <= NEAR || w1 <= NEAR) { // move the clipped end onto the near plane
      const t = (NEAR - w0) / (w1 - w0);
      const xm = x0 + (x1 - x0) * t, zm = z0 + (z1 - z0) * t;
      if (w0 <= NEAR) { x0 = xm; z0 = zm; } else { x1 = xm; z1 = zm; }
    }
    const a = toScreen(x0, 0.01, z0), b = toScreen(x1, 0.01, z1);
    if (a && b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  }
  function walk2(o) {
    if (!o.visible) return;
    if (o.isMesh) addMeshTo(dyn, o);
    for (const c of o.children) walk2(c);
  }
  return { render, domElement: canvas };
}
