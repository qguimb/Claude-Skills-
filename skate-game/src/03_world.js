// ---------------------------------------------------------------------------
// Renderer, scene, sky, lights
// ---------------------------------------------------------------------------
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOG = new THREE.Color('#d9926e');
scene.fog = new THREE.Fog(FOG, 70, 290);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 900);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

const SUN_DIR = new THREE.Vector3(-0.62, 0.30, 0.55).normalize();

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(600, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR }, time: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 sunDir; uniform float time; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 horizon = vec3(1.0,.64,.34), mid = vec3(.93,.45,.42), zenith = vec3(.20,.15,.40);
        vec3 col = mix(horizon, mid, smoothstep(.0,.16,h));
        col = mix(col, zenith, smoothstep(.12,.62,h));
        float s = max(dot(d, sunDir), 0.);
        col += vec3(1.,.55,.22) * pow(s, 8.) * .5 + vec3(1.,.7,.4) * pow(s, 90.) * .5 + vec3(1.,.9,.7) * smoothstep(.99965,.99985,s) * 1.6;
        if (h > 0.) {
          vec2 uv = d.xz / (h + .12);
          float c = fbm(uv * 1.3 + vec2(time * .006, 0.));
          c = smoothstep(.52, .82, c) * smoothstep(0., .2, h);
          vec3 cc = mix(vec3(.86,.42,.48), vec3(1.,.82,.55), pow(s, 3.));
          col = mix(col, cc, c * .6);
        } else {
          col = mix(horizon * .75, vec3(.25,.15,.22), clamp(-h * 5., 0., 1.));
        }
        gl_FragColor = vec4(pow(col, vec3(2.2)), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
);
sky.renderOrder = -1;
scene.add(sky);

const hemi = new THREE.HemisphereLight('#ffc9a0', '#5a3f5e', 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffb070', 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const TEX = {};
const MAT = {};
function buildMaterials() {
  TEX.concrete = concreteTexture();
  TEX.wood = plywoodTexture();
  MAT.concrete = new THREE.MeshStandardMaterial({ map: TEX.concrete, roughness: 0.92, metalness: 0 });
  MAT.wood = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.75 });
  MAT.sideA = new THREE.MeshStandardMaterial({ map: sidePanelTexture('#e0552e', '#ffd23f'), roughness: 0.8, side: THREE.DoubleSide });
  MAT.sideB = new THREE.MeshStandardMaterial({ map: sidePanelTexture('#2f7f8f', '#ff8a1f'), roughness: 0.8, side: THREE.DoubleSide });
  MAT.sideC = new THREE.MeshStandardMaterial({ map: sidePanelTexture('#5a3f8e', '#6ff0c2'), roughness: 0.8, side: THREE.DoubleSide });
  MAT.metal = new THREE.MeshStandardMaterial({ color: '#d8d8e0', roughness: 0.3, metalness: 0.9 });
  MAT.railRed = new THREE.MeshStandardMaterial({ color: '#e8392f', roughness: 0.45, metalness: 0.4 });
  MAT.railYellow = new THREE.MeshStandardMaterial({ color: '#ffc21f', roughness: 0.45, metalness: 0.4 });
  MAT.curb = new THREE.MeshStandardMaterial({ color: '#d93a3a', roughness: 0.7 });
  MAT.dumpster = new THREE.MeshStandardMaterial({ color: '#2f6b45', roughness: 0.6, metalness: 0.3 });
  MAT.asphalt = new THREE.MeshStandardMaterial({ color: '#5b4a4c', roughness: 1 });
  MAT.wallTop = new THREE.MeshStandardMaterial({ color: '#7d7672', roughness: 0.95 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: '#2a2230', roughness: 0.9 });
}

function addMesh(geo, mat, parent = scene, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  parent.add(m); return m;
}
function uvScale(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return geo;
}

// ---------------------------------------------------------------------------
// The park is a heightfield built from analytic features (max of all).
// Each feature also emits its grind lines and its meshes.
// ---------------------------------------------------------------------------
const world = { features: [], rails: [], gaps: [], letters: [], spawn: new THREE.Vector3(20, 0, 6), spawnDir: new THREE.Vector3(-1, 0, 0), half: 40 };
const S = { h: 0, nx: 0, ny: 1, nz: 0, surf: 'concrete', feat: null };

function sampleGround(x, z) {
  S.h = 0; S.nx = 0; S.ny = 1; S.nz = 0; S.surf = 'concrete'; S.feat = null;
  const F = world.features;
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;
    f.sample(x, z, S);
  }
  return S;
}
function heightAt(x, z) { return sampleGround(x, z).h; }

function setOut(out, h, nx, ny, nz, surf, feat) {
  if (h <= out.h + 1e-6) return;
  const il = 1 / Math.hypot(nx, ny, nz);
  out.h = h; out.nx = nx * il; out.ny = ny * il; out.nz = nz * il; out.surf = surf; out.feat = feat;
}

function addRail(a, b, kind, opts = {}) {
  const r = { a: a.clone(), b: b.clone(), kind, name: opts.name || (kind === 'rail' ? 'Rail' : kind === 'coping' ? 'Coping' : 'Ledge'), metal: kind !== 'ledge' || !!opts.metal, outward: opts.outward || null };
  r.dir = new THREE.Vector3().subVectors(b, a); r.len = r.dir.length(); r.dir.normalize();
  world.rails.push(r);
  return r;
}

// Local frame helper for oriented features: f = uphill direction, l = lateral.
class Oriented {
  constructor(o) {
    this.ox = o.x; this.oz = o.z; this.fx = o.fx; this.fz = o.fz; this.lx = -o.fz; this.lz = o.fx;
    this.W = o.W; this.surf = o.surf || 'wood';
  }
  local(x, z) { const dx = x - this.ox, dz = z - this.oz; return [dx * this.fx + dz * this.fz, dx * this.lx + dz * this.lz]; }
  world(d, w, y = 0) { return new THREE.Vector3(this.ox + this.fx * d + this.lx * w, y, this.oz + this.fz * d + this.lz * w); }
  bounds(len) {
    const pts = [this.world(0, -this.W / 2), this.world(0, this.W / 2), this.world(len, -this.W / 2), this.world(len, this.W / 2)];
    this.minX = Math.min(...pts.map(p => p.x)) - 0.01; this.maxX = Math.max(...pts.map(p => p.x)) + 0.01;
    this.minZ = Math.min(...pts.map(p => p.z)) - 0.01; this.maxZ = Math.max(...pts.map(p => p.z)) + 0.01;
  }
  group() {
    const g = new THREE.Group();
    g.position.set(this.ox, 0, this.oz);
    g.rotation.y = Math.atan2(-this.fz, this.fx);
    scene.add(g); return g;
  }
}

// Quarter pipe / kicker: circular transition of radius R up to angle A, then a flat deck.
class Transition extends Oriented {
  constructor(o) {
    super(o);
    this.R = o.R; this.A = o.A * Math.PI / 180; this.D = o.D || 0;
    this.dLip = this.R * Math.sin(this.A); this.hLip = this.R * (1 - Math.cos(this.A));
    this.vert = o.A >= 60;
    this.bounds(this.dLip + this.D);
    this.build(o);
  }
  sample(x, z, out) {
    const [d, w] = this.local(x, z);
    if (d < 0 || w < -this.W / 2 || w > this.W / 2) return;
    if (d <= this.dLip) {
      const s = Math.sqrt(this.R * this.R - d * d), slope = d / s;
      setOut(out, this.R - s, -slope * this.fx, 1, -slope * this.fz, this.surf, this);
    } else if (d <= this.dLip + this.D) setOut(out, this.hLip, 0, 1, 0, this.surf, this);
  }
  build(o) {
    const g = this.group(), N = 28, W = this.W, R = this.R, A = this.A;
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = A * i / N, d = R * Math.sin(t), h = R * (1 - Math.cos(t));
      for (const w of [-W / 2, W / 2]) { pos.push(d, h, w); nor.push(-Math.sin(t), Math.cos(t), 0); uv.push(w / 1.22, R * t / 1.22); }
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    addMesh(geo, this.surf === 'wood' ? MAT.wood : MAT.concrete, g);
    const shape = new THREE.Shape(); shape.moveTo(0, 0);
    for (let i = 0; i <= N; i++) { const t = A * i / N; shape.lineTo(R * Math.sin(t), R * (1 - Math.cos(t))); }
    shape.lineTo(this.dLip + this.D, this.hLip); shape.lineTo(this.dLip + this.D, 0); shape.closePath();
    const sg = uvScale(new THREE.ShapeGeometry(shape), 1 / 4, 1 / 2.5);
    const side = o.side || MAT.sideA;
    addMesh(sg, side, g).position.z = W / 2;
    addMesh(sg, side, g).position.z = -W / 2;
    if (this.D > 0) {
      const deck = addMesh(uvScale(new THREE.BoxGeometry(this.D, this.hLip, W), 1, W / 1.22), MAT.wood, g);
      deck.position.set(this.dLip + this.D / 2, this.hLip / 2, 0);
    } else {
      addMesh(new THREE.BoxGeometry(0.05, this.hLip, W), side, g).position.set(this.dLip - 0.025, this.hLip / 2, 0);
    }
    if (o.coping !== false && this.D > 0) {
      const cop = addMesh(new THREE.CylinderGeometry(0.045, 0.045, W, 10), MAT.metal, g);
      cop.rotation.x = Math.PI / 2; cop.position.set(this.dLip, this.hLip, 0);
      addRail(this.world(this.dLip - 0.02, -W / 2 + 0.2, this.hLip + 0.03), this.world(this.dLip - 0.02, W / 2 - 0.2, this.hLip + 0.03), 'coping',
        { outward: new THREE.Vector3(-this.fx, 0, -this.fz), name: o.copingName || 'Coping' });
    }
  }
}

// Straight bank / stair run: linear rise H over run L, optional flat deck. Stairs render as steps.
class Bank extends Oriented {
  constructor(o) {
    super(o);
    this.L = o.L; this.H = o.H; this.D = o.D || 0; this.steps = o.steps || 0;
    this.bounds(this.L + this.D);
    this.build(o);
  }
  sample(x, z, out) {
    const [d, w] = this.local(x, z);
    if (d < 0 || w < -this.W / 2 || w > this.W / 2) return;
    const s = this.H / this.L;
    if (this.steps && d <= this.L) { const i = Math.min(Math.floor(d / (this.L / this.steps)), this.steps - 1); setOut(out, this.H * (i + 1) / this.steps, 0, 1, 0, this.surf, this); }
    else if (d <= this.L) setOut(out, d * s, -s * this.fx, 1, -s * this.fz, this.surf, this);
    else if (d <= this.L + this.D) setOut(out, this.H, 0, 1, 0, this.surf, this);
  }
  build(o) {
    const g = this.group(), W = this.W, L = this.L, H = this.H, mat = this.surf === 'wood' ? MAT.wood : MAT.concrete;
    if (o.steps) {
      const n = o.steps, run = L / n, rise = H / n;
      for (let i = 0; i < n; i++) {
        const b = addMesh(uvScale(new THREE.BoxGeometry(run, rise * (i + 1), W), W / 4, 0.25), mat, g);
        b.position.set(run * (i + 0.5), rise * (i + 1) / 2, 0);
        const nose = addMesh(new THREE.BoxGeometry(0.06, 0.04, W), MAT.metal, g, false);
        nose.position.set(run * i + 0.03, rise * (i + 1) - 0.02, 0);
      }
    } else {
      const len = Math.hypot(L, H);
      const tile = this.surf === 'wood' ? 1.22 : 4;
      const geo = uvScale(new THREE.PlaneGeometry(len, W), len / tile, W / tile);
      geo.rotateX(-Math.PI / 2); geo.rotateZ(Math.atan2(H, L));
      addMesh(geo, mat, g).position.set(L / 2, H / 2, 0);
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(L, H); shape.lineTo(L + this.D, H); shape.lineTo(L + this.D, 0); shape.closePath();
      const sg = uvScale(new THREE.ShapeGeometry(shape), 1 / 4, 1 / 2.5);
      const side = o.side || MAT.sideB;
      addMesh(sg, side, g).position.z = W / 2;
      addMesh(sg, side, g).position.z = -W / 2;
      if (this.D > 0) addMesh(new THREE.BoxGeometry(this.D, H, W), mat, g).position.set(L + this.D / 2, H / 2, 0);
      else addMesh(new THREE.BoxGeometry(0.05, H, W), side, g).position.set(L - 0.025, H / 2, 0);
    }
  }
}

// Axis-aligned block: ledges, manual pads, the stair plaza, the dumpster.
class Block {
  constructor(o) {
    Object.assign(this, { x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1, H: o.H, surf: o.surf || 'concrete' });
    this.minX = o.x0; this.maxX = o.x1; this.minZ = o.z0; this.maxZ = o.z1;
    const w = o.x1 - o.x0, d = o.z1 - o.z0;
    const m = addMesh(uvScale(new THREE.BoxGeometry(w, o.H, d), w / 4, d / 4), o.mat || MAT.concrete);
    m.position.set((o.x0 + o.x1) / 2, o.H / 2, (o.z0 + o.z1) / 2);
    const e = 0.03, y = o.H + 0.02;
    const edges = { n: [[o.x0, o.z0], [o.x1, o.z0]], s: [[o.x0, o.z1], [o.x1, o.z1]], w: [[o.x0, o.z0], [o.x0, o.z1]], e: [[o.x1, o.z0], [o.x1, o.z1]] };
    for (const k of o.edges || []) {
      const [[ax, az], [bx, bz]] = edges[k];
      const inset = 0.15;
      const a = new THREE.Vector3(ax, y, az), b = new THREE.Vector3(bx, y, bz);
      const dir = b.clone().sub(a).normalize();
      addRail(a.clone().addScaledVector(dir, inset), b.clone().addScaledVector(dir, -inset), 'ledge', { name: o.edgeName || 'Ledge', metal: true });
      const len = a.distanceTo(b);
      const iron = addMesh(new THREE.BoxGeometry(k === 'n' || k === 's' ? len : 0.08, 0.06, k === 'n' || k === 's' ? 0.08 : len), MAT.metal, scene, false);
      iron.position.set((ax + bx) / 2 + (k === 'e' ? -e : k === 'w' ? e : 0), o.H - 0.02, (az + bz) / 2 + (k === 's' ? -e : k === 'n' ? e : 0));
    }
  }
  sample(x, z, out) { setOut(out, this.H, 0, 1, 0, this.surf, this); }
}

// Funbox: flat top with four sloped sides (a truncated pyramid).
class Funbox {
  constructor(o) {
    Object.assign(this, o);
    this.minX = o.x - o.ax - o.s; this.maxX = o.x + o.ax + o.s; this.minZ = o.z - o.az - o.s; this.maxZ = o.z + o.az + o.s;
    this.surf = 'concrete';
    this.build();
  }
  sample(x, z, out) {
    const lx = x - this.x, lz = z - this.z, k = this.H / this.s;
    const ex = this.ax + this.s - Math.abs(lx), ez = this.az + this.s - Math.abs(lz);
    if (ex < 0 || ez < 0) return;
    const hx = Math.min(this.H, ex * k), hz = Math.min(this.H, ez * k);
    if (hx >= this.H && hz >= this.H) setOut(out, this.H, 0, 1, 0, 'concrete', this);
    else if (hx < hz) setOut(out, hx, Math.sign(lx) * k, 1, 0, 'concrete', this);
    else setOut(out, hz, 0, 1, Math.sign(lz) * k, 'concrete', this);
  }
  build() {
    const { x, z, ax, az, s, H } = this;
    const T = [[-ax, -az], [ax, -az], [ax, az], [-ax, az]], B = [[-ax - s, -az - s], [ax + s, -az - s], [ax + s, az + s], [-ax - s, az + s]];
    const pos = [], uv = [];
    const quad = (p) => { // p: 4 points [x,y,z], triangulated 0-1-2, 0-2-3
      for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); uv.push(p[i][0] / 4, p[i][2] / 4); }
    };
    quad([[T[0][0], H, T[0][1]], [T[3][0], H, T[3][1]], [T[2][0], H, T[2][1]], [T[1][0], H, T[1][1]]]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad([[B[i][0], 0, B[i][1]], [B[j][0], 0, B[j][1]], [T[j][0], H, T[j][1]], [T[i][0], H, T[i][1]]]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const m = addMesh(geo, MAT.concrete); m.position.set(x, 0, z);
    m.material = MAT.concrete.clone(); m.material.side = THREE.DoubleSide; m.material.color.set('#e6ddd2');
    const y = H + 0.02;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const a = new THREE.Vector3(x + T[i][0], y, z + T[i][1]), b = new THREE.Vector3(x + T[j][0], y, z + T[j][1]);
      const dir = b.clone().sub(a).normalize();
      addRail(a.clone().addScaledVector(dir, 0.2), b.clone().addScaledVector(dir, -0.2), 'ledge', { name: 'Funbox Ledge', metal: true });
      const len = a.distanceTo(b);
      const iron = addMesh(new THREE.BoxGeometry(len, 0.05, 0.08), MAT.metal, scene, false);
      iron.position.copy(a).lerp(b, 0.5); iron.position.y = H - 0.01;
      iron.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    }
  }
}

// Pipe rail on posts. Posts drop to whatever surface is under them.
function pipeRail(a, b, mat, name) {
  const r = addRail(a.clone().setY(a.y + 0.035), b.clone().setY(b.y + 0.035), 'rail', { name });
  const mid = a.clone().lerp(b, 0.5);
  const pipe = addMesh(new THREE.CylinderGeometry(0.035, 0.035, r.len, 10), mat);
  pipe.position.copy(mid);
  pipe.quaternion.setFromUnitVectors(UP, r.dir);
  const n = Math.max(2, Math.ceil(r.len / 3) + 1);
  for (let i = 0; i < n; i++) {
    const p = a.clone().lerp(b, i / (n - 1));
    const base = heightAt(p.x, p.z), hgt = p.y - base;
    const post = addMesh(new THREE.CylinderGeometry(0.03, 0.03, hgt, 8), mat);
    post.position.set(p.x, base + hgt / 2, p.z);
  }
  return r;
}

function buildPark() {
  buildMaterials();
  const H = world.half;
  // ground: textured slab inside, asphalt lot beyond
  const ground = addMesh(new THREE.PlaneGeometry(H * 2, H * 2), MAT.concrete, scene, false, true);
  ground.rotation.x = -Math.PI / 2;
  TEX.concrete.repeat.set(H * 2 / 4, H * 2 / 4);
  const lot = addMesh(new THREE.RingGeometry(H * 1.42, 700, 4, 1, Math.PI / 4), MAT.asphalt, scene, false, true);
  lot.rotation.x = -Math.PI / 2; lot.position.y = -0.01;
  const lot2 = addMesh(new THREE.PlaneGeometry(H * 2 + 40, H * 2 + 40), MAT.asphalt, scene, false, true);
  lot2.rotation.x = -Math.PI / 2; lot2.position.y = -0.02;

  // perimeter walls with generated graffiti
  const graffiti = [101, 202, 303, 404, 505, 606, 707].map(graffitiTexture);
  const wallH = 4.6, seg = 16;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < (H * 2) / seg; i++) {
      const t = -H + seg * (i + 0.5);
      const mat = new THREE.MeshStandardMaterial({ map: graffiti[(side * 5 + i * 3) % graffiti.length], roughness: 0.95 });
      const face = addMesh(new THREE.PlaneGeometry(seg, wallH), mat, scene, false, true);
      const back = addMesh(new THREE.BoxGeometry(seg, wallH + 0.3, 0.6), MAT.wallTop, scene, true, true);
      const p = [[t, -H], [H, t], [t, H], [-H, t]][side], ry = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side];
      const off = [[0, -0.31], [0.31, 0], [0, 0.31], [-0.31, 0]][side];
      face.position.set(p[0], wallH / 2, p[1]); face.rotation.y = ry;
      back.position.set(p[0] + off[0], (wallH + 0.3) / 2, p[1] + off[1]); back.rotation.y = ry;
    }
  }

  // --- West: vert half-pipe with a roll-in bank behind it -----------------
  const vert = { R: 3.6, A: 84, D: 1.6, W: 18 };
  const dl = vert.R * Math.sin(vert.A * Math.PI / 180);
  const xW1 = -H + vert.D + dl, xW2 = xW1 + 4;
  world.features.push(new Transition({ x: xW1, z: 0, fx: -1, fz: 0, ...vert, side: MAT.sideC, copingName: 'Vert Coping' }));
  const hp2 = new Transition({ x: xW2, z: 0, fx: 1, fz: 0, ...vert, side: MAT.sideC, copingName: 'Vert Coping' });
  world.features.push(hp2);
  const deckEnd = xW2 + hp2.dLip + vert.D, rollL = hp2.hLip / Math.tan(22 * Math.PI / 180);
  world.features.push(new Bank({ x: deckEnd + rollL, z: 0, fx: -1, fz: 0, W: 18, L: rollL, H: hp2.hLip, surf: 'wood', side: MAT.sideC }));
  world.hp = { lipX: -H + vert.D, lipY: hp2.hLip, x0: xW1, x1: xW2 };

  // --- Perimeter quarter pipes ------------------------------------------------
  const qpN = { R: 3.0, A: 72, D: 1.4, W: 50 }, dN = qpN.R * Math.sin(qpN.A * Math.PI / 180);
  world.features.push(new Transition({ x: 9, z: -H + qpN.D + dN, fx: 0, fz: -1, ...qpN, side: MAT.sideA }));
  world.features.push(new Transition({ x: 9, z: H - qpN.D - dN, fx: 0, fz: 1, ...qpN, side: MAT.sideA }));
  const qpE = { R: 3.4, A: 80, D: 1.4, W: 68 }, dE = qpE.R * Math.sin(qpE.A * Math.PI / 180);
  world.features.push(new Transition({ x: H - qpE.D - dE, z: 0, fx: 1, fz: 0, ...qpE, side: MAT.sideB }));

  // --- Center funbox with a flat rail on top -----------------------------------
  world.features.push(new Funbox({ x: 4, z: -4, ax: 3, az: 2, s: 2.2, H: 0.9 }));
  pipeRail(new THREE.Vector3(1.4, 1.32, -4), new THREE.Vector3(6.6, 1.32, -4), MAT.railYellow, 'Funbox Rail');

  // --- South: stair plaza (8-stair set, handrail, ledges, side banks) ----------
  world.features.push(new Block({ x0: -10, x1: 10, z0: 22, z1: 30, H: 1.4, edges: ['n', 's'], edgeName: 'Plaza Ledge' }));
  world.features.push(new Bank({ x: 0, z: 18, fx: 0, fz: 1, W: 8, L: 4, H: 1.4, surf: 'concrete', steps: 8 }));
  world.features.push(new Bank({ x: 16, z: 26, fx: -1, fz: 0, W: 8, L: 6, H: 1.4, surf: 'concrete', side: MAT.sideB }));
  world.features.push(new Bank({ x: -16, z: 26, fx: 1, fz: 0, W: 8, L: 6, H: 1.4, surf: 'concrete', side: MAT.sideB }));
  pipeRail(new THREE.Vector3(0, 2.25, 22.4), new THREE.Vector3(0, 0.85, 17.9), MAT.railRed, 'Handrail');

  // --- North: long flat rail and a red curb ----------------------------------
  pipeRail(new THREE.Vector3(-12, 0.55, -24), new THREE.Vector3(16, 0.55, -24), MAT.railYellow, 'Long Rail');
  world.features.push(new Block({ x0: -14, x1: -4, z0: -14, z1: -12.6, H: 0.45, edges: ['n', 's'], edgeName: 'Red Curb', mat: MAT.curb }));

  // --- East: kicker over the dumpster to a landing bank, plus a flat bar ---------
  world.features.push(new Transition({ x: 14, z: 12, fx: 1, fz: 0, W: 3.2, R: 5, A: 32, D: 0, side: MAT.sideA }));
  world.features.push(new Block({ x0: 18.4, x1: 21.6, z0: 10.8, z1: 13.2, H: 1.15, mat: MAT.dumpster, surf: 'metal' }));
  world.features.push(new Bank({ x: 26.4, z: 12, fx: -1, fz: 0, W: 4, L: 2.4, H: 0.76, surf: 'wood', side: MAT.sideA }));
  pipeRail(new THREE.Vector3(18, 0.42, -2), new THREE.Vector3(29, 0.42, -2), MAT.railRed, 'Flat Bar');

  // --- Gaps (takeoff zone -> landing zone) --------------------------------------
  world.gaps.push(
    { name: 'Stair Set', pts: 350, from: { x0: -10, x1: 10, z0: 21.4, z1: 30, y: 1.2 }, to: { x0: -9, x1: 9, z0: 6, z1: 17.6 } },
    { name: 'Funbox Transfer', pts: 300, from: { x0: -1.4, x1: 1.2, z0: -8, z1: 0 }, to: { x0: 6.8, x1: 9.4, z0: -8, z1: 0 } },
    { name: 'Funbox Transfer', pts: 300, from: { x0: 6.8, x1: 9.4, z0: -8, z1: 0 }, to: { x0: -1.4, x1: 1.2, z0: -8, z1: 0 } },
    { name: 'Funbox Hop', pts: 250, from: { x0: -1, x1: 9, z0: -8.4, z1: -6 }, to: { x0: -1, x1: 9, z0: -2, z1: 0.4 } },
    { name: 'Funbox Hop', pts: 250, from: { x0: -1, x1: 9, z0: -2, z1: 0.4 }, to: { x0: -1, x1: 9, z0: -8.4, z1: -6 } },
    { name: 'Dumpster Gap', pts: 450, from: { x0: 13.8, x1: 17.2, z0: 10, z1: 14 }, to: { x0: 22, x1: 34, z0: 7, z1: 17 } },
    { name: 'Plaza Drop', pts: 200, from: { x0: -10, x1: 10, z0: 21.4, z1: 30, y: 1.2 }, to: { x0: -14, x1: 14, z0: 30.4, z1: 36 } },
    { name: 'Roll-in Air', pts: 250, from: { x0: deckEnd - 0.2, x1: deckEnd + rollL, z0: -9, z1: 9, y: 0.6 }, to: { x0: xW1, x1: xW2, z0: -9, z1: 9 } },
  );

  // --- S-K-A-T-E letters ------------------------------------------------------------
  const L = [['S', 4, 3.5, -4], ['K', world.hp.lipX + 0.9, world.hp.lipY + 2.6, 4], ['A', 0, 3.4, 16.8], ['T', 8, 1.45, -24], ['E', 20, 3.5, 12]];
  for (const [ch, x, y, z] of L) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(ch), depthWrite: false, fog: false }));
    sp.scale.set(1.6, 1.6, 1); sp.position.set(x, y, z); scene.add(sp);
    world.letters.push({ ch, sprite: sp, pos: sp.position.clone(), got: false });
  }

  buildScenery();
}

function buildScenery() {
  const H = world.half;
  // skyline ring
  const sk = skylineTexture(); sk.wrapS = THREE.RepeatWrapping; sk.repeat.set(5, 1);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 34, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: sk, transparent: true, opacity: 0.9, side: THREE.BackSide, fog: false, depthWrite: false }));
  ring.position.y = 14; scene.add(ring);
  // palms outside the walls
  const frond = new THREE.MeshStandardMaterial({ map: frondTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  const trunk = new THREE.MeshStandardMaterial({ color: '#6b4b38', roughness: 1 });
  const frondGeo = new THREE.PlaneGeometry(4.2, 1.1).translate(2.1, 0, 0).rotateX(-Math.PI / 2);
  const spots = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 4, t = (rand() * 2 - 1) * (H + 10), off = H + 5 + rand() * 14;
    spots.push([[t, -off], [off, t], [t, off], [-off, t]][side]);
  }
  for (const [x, z] of spots) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const h = 9 + rand() * 7, lean = (rand() - 0.5) * 0.25;
    let y = 0, px = 0;
    for (let k = 0; k < 6; k++) {
      const segH = h / 6, r = 0.32 - k * 0.03;
      const s = addMesh(new THREE.CylinderGeometry(r - 0.02, r, segH, 7), trunk, g, true, false);
      px += lean * segH; s.position.set(px, y + segH / 2, 0); s.rotation.z = -lean; y += segH;
    }
    for (let k = 0; k < 9; k++) {
      const f = addMesh(frondGeo, frond, g, true, false);
      f.position.set(px, y, 0);
      f.rotation.set(0, (k / 9) * Math.PI * 2 + rand() * 0.3, -0.3 - rand() * 0.45, 'YZX');
    }
  }
  // light poles in the corners, sign over the north wall
  for (const [x, z] of [[-37, -37], [37, -37], [37, 37], [-37, 37], [-14, 37.5], [30, 37.5]]) {
    const p = addMesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 8), MAT.dark); p.position.set(x, 4.5, z);
    const lamp = addMesh(new THREE.BoxGeometry(1.2, 0.3, 0.6), MAT.dark); lamp.position.set(x, 9, z);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.4), new THREE.MeshBasicMaterial({ color: '#ffe2b0' }));
    glow.rotation.x = Math.PI / 2; glow.position.set(x, 8.84, z); scene.add(glow);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshStandardMaterial({ map: signTexture('GOLDEN HOUR PARK', '#160f24', '#ff8a1f'), emissive: '#ff8a1f', emissiveIntensity: 0.25, emissiveMap: null }));
  sign.position.set(9, 7.2, -H + 0.2); scene.add(sign);
  for (const sx of [3, 15]) { const leg = addMesh(new THREE.BoxGeometry(0.25, 3, 0.25), MAT.dark); leg.position.set(sx, 4.9, -H + 0.1); }
}
