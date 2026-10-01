// ---------------------------------------------------------------------------
// Procedural textures (canvas). No image files are loaded anywhere.
// ---------------------------------------------------------------------------
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}

function speckle(g, w, h, n, colors, rmax = 1.6) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(rand() * colors.length) | 0];
    const r = rand() * rmax + 0.3;
    g.fillRect(rand() * w, rand() * h, r, r);
  }
}

// Broom-finished concrete slab, one tile = 4 m with expansion joints on the edges.
function concreteTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#a49c94'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {           // large soft tonal blotches
      const x = rand() * w, y = rand() * h, r = 80 + rand() * 260;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = rand() < 0.5;
      gr.addColorStop(0, dark ? 'rgba(70,62,58,0.16)' : 'rgba(225,215,200,0.14)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    speckle(g, w, h, 60000, ['rgba(60,55,52,0.35)', 'rgba(230,224,214,0.35)', 'rgba(120,110,104,0.4)'], 1.8);
    g.globalAlpha = 0.07; g.strokeStyle = '#3a3330';
    for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y + rand() * 2); g.lineTo(w, y + rand() * 2); g.stroke(); }
    g.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {            // hairline cracks
      g.strokeStyle = 'rgba(45,40,38,0.5)'; g.lineWidth = 1.2;
      let x = rand() * w, y = rand() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 14; k++) { x += (rand() - 0.5) * 50; y += (rand() - 0.3) * 40; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 7; i++) {            // wheel marks / skids
      g.strokeStyle = 'rgba(30,26,26,0.12)'; g.lineWidth = 5 + rand() * 4;
      const x = rand() * w, y = rand() * h, a = rand() * Math.PI;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 160, y + Math.sin(a) * 40, x + Math.cos(a) * 320, y + Math.sin(a) * 160); g.stroke();
    }
    g.fillStyle = 'rgba(40,36,34,0.85)';     // expansion joints
    g.fillRect(0, 0, w, 5); g.fillRect(0, 0, 5, h);
    g.fillStyle = 'rgba(255,250,240,0.25)';
    g.fillRect(0, 5, w, 2); g.fillRect(5, 0, 2, h);
  }, { repeat: [1, 1] });
}

// Plywood ramp sheets with seams and screw rows (one tile = 1.22 m sheet).
function plywoodTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#c99a62'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = rand() < 0.5 ? 'rgba(120,78,40,0.18)' : 'rgba(240,200,150,0.15)';
      g.lineWidth = 1 + rand() * 3;
      const y = rand() * h; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 6 + (rand() - 0.5) * 3);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) { // knots
      const x = rand() * w, y = rand() * h;
      g.fillStyle = 'rgba(110,70,35,0.35)'; g.beginPath(); g.ellipse(x, y, 10 + rand() * 8, 4 + rand() * 3, 0, 0, 7); g.fill();
    }
    speckle(g, w, h, 4000, ['rgba(80,50,30,0.15)', 'rgba(255,230,190,0.12)']);
    // sun-darkened wear in the middle (wheel paths)
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(70,45,25,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,38,20,0.75)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    g.fillStyle = 'rgba(50,50,55,0.9)';
    for (let i = 1; i < 8; i++) { g.beginPath(); g.arc(i * w / 8, 12, 2.4, 0, 7); g.fill(); g.beginPath(); g.arc(12, i * h / 8, 2.4, 0, 7); g.fill(); }
  }, { repeat: [1, 1] });
}

// Painted ramp side panels: a flat color with stickers and scuffs.
function sidePanelTexture(base, accent) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 3000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.06)'], 2);
    for (let i = 0; i < 9; i++) {
      g.save(); g.translate(rand() * w, rand() * h); g.rotate((rand() - 0.5) * 0.6);
      const s = 14 + rand() * 26;
      g.fillStyle = [accent, '#fff3dc', '#160f24', '#6ff0c2'][(rand() * 4) | 0];
      if (rand() < 0.5) g.fillRect(-s, -s * 0.5, s * 2, s); else { g.beginPath(); g.arc(0, 0, s * 0.6, 0, 7); g.fill(); }
      g.restore();
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  }, { repeat: [1, 1] });
}

const TAGS = ['SK8', 'GRIND', 'POP!', 'OLLIE', 'SHRED', '5-0', 'GNAR', 'RAD', 'OPUS', 'DROP IN', 'NO COMPLY', 'BAIL'];
const SPRAY = ['#ff3f7a', '#ff8a1f', '#ffd23f', '#6ff0c2', '#3fa9ff', '#b26bff', '#fff3dc'];

// Concrete wall panel covered in generated graffiti.
function graffitiTexture(seed) {
  const r0 = rand; rand = mulberry32(seed);
  const t = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#8f8a86'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 20000, ['rgba(50,45,45,0.3)', 'rgba(220,214,205,0.3)'], 1.6);
    for (let x = 0; x < w; x += 128) { g.fillStyle = 'rgba(40,36,34,0.4)'; g.fillRect(x, 0, 2, h); }
    for (let i = 0; i < 3; i++) { // roller buffs
      g.fillStyle = `rgba(${150 + rand() * 40},${140 + rand() * 40},${130 + rand() * 30},0.8)`;
      g.fillRect(rand() * w, rand() * h * 0.4, 120 + rand() * 200, 60 + rand() * 120);
    }
    const n = 3 + ((rand() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const word = TAGS[(rand() * TAGS.length) | 0];
      const size = 54 + rand() * 60;
      const x = (i + 0.5) * w / n + (rand() - 0.5) * 60, y = h * (0.45 + rand() * 0.25);
      g.save(); g.translate(x, y); g.rotate((rand() - 0.5) * 0.3);
      g.font = `${size}px ${rand() < 0.5 ? 'Bungee, Impact' : '"Permanent Marker", Impact'}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const c1 = SPRAY[(rand() * SPRAY.length) | 0], c2 = SPRAY[(rand() * SPRAY.length) | 0];
      const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.lineJoin = 'round';
      g.lineWidth = size * 0.22; g.strokeStyle = '#160f24'; g.strokeText(word, 0, 0);
      g.lineWidth = size * 0.08; g.strokeStyle = '#fff3dc'; g.strokeText(word, 0, 0);
      g.fillStyle = gr; g.fillText(word, 0, 0);
      g.fillStyle = c1;                       // drips
      for (let d = 0; d < 5; d++) g.fillRect((rand() - 0.5) * size * 2, size * 0.3, 3, 10 + rand() * 40);
      g.restore();
    }
    for (let i = 0; i < 10; i++) { // small throw-up tags
      g.save(); g.translate(rand() * w, rand() * h); g.rotate((rand() - 0.5) * 0.5);
      g.strokeStyle = SPRAY[(rand() * SPRAY.length) | 0]; g.lineWidth = 3;
      g.beginPath(); let x = 0; g.moveTo(0, 0);
      for (let k = 0; k < 8; k++) { x += 8 + rand() * 10; g.quadraticCurveTo(x - 4, (rand() - 0.5) * 40, x, (rand() - 0.5) * 16); }
      g.stroke(); g.restore();
    }
    const gr = g.createLinearGradient(0, 0, 0, h); // grime at the base
    gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,25,20,0.45)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  rand = r0;
  return t;
}

function gripTexture() {
  return canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = '#18161a'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 9000, ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.5)', 'rgba(140,140,150,0.15)'], 1.4);
    g.strokeStyle = 'rgba(255,243,220,0.10)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(10, h * 0.48); g.lineTo(w - 10, h * 0.52); g.stroke();
  });
}

function boardBottomTexture() {
  return canvasTex(128, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ff3f7a'); gr.addColorStop(0.5, '#ff8a1f'); gr.addColorStop(1, '#ffd23f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#160f24'; g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.fill();
    g.fillStyle = '#fff3dc'; g.beginPath(); g.arc(w / 2, h / 2, 30, Math.PI, 0); g.fill();
    for (let i = 0; i < 5; i++) { g.fillStyle = '#160f24'; g.fillRect(w / 2 - 34, h / 2 - 4 - i * 7, 68, 2.5); }
    g.save(); g.translate(w / 2, h * 0.8); g.rotate(-Math.PI / 2);
    g.font = '28px Bungee, Impact'; g.fillStyle = '#160f24'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('GOLDEN', 0, 0); g.restore();
  });
}

// Distant skyline silhouette strip with lit windows, wrapped on a cylinder.
function skylineTexture() {
  return canvasTex(2048, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let layer = 0; layer < 2; layer++) {
      let x = 0;
      while (x < w) {
        const bw = 30 + rand() * 80, bh = (layer ? 40 : 70) + rand() * (layer ? 90 : 150);
        g.fillStyle = layer ? '#3a2440' : '#26182e';
        g.fillRect(x, h - bh, bw, bh);
        if (rand() < 0.15) g.fillRect(x + bw / 2 - 2, h - bh - 30, 4, 30);
        if (!layer) {
          for (let wy = h - bh + 8; wy < h - 6; wy += 9) for (let wx = x + 5; wx < x + bw - 6; wx += 8)
            if (rand() < 0.22) { g.fillStyle = rand() < 0.7 ? 'rgba(255,200,120,0.8)' : 'rgba(255,240,210,0.7)'; g.fillRect(wx, wy, 3, 4); }
        }
        x += bw + rand() * 6;
      }
    }
  });
}

function frondTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#2b3a1e'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, h / 2); g.quadraticCurveTo(w / 2, h / 2 - 6, w, h / 2 + 4); g.stroke();
    g.strokeStyle = '#3d5a26'; g.lineWidth = 2.2;
    for (let x = 6; x < w - 6; x += 5) {
      const l = (1 - x / w) * 26 + 4;
      g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 10, h / 2 - l); g.stroke();
      g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 10, h / 2 + l); g.stroke();
    }
  });
}

function letterTexture(ch) {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,210,63,0.75)'); gr.addColorStop(0.55, 'rgba(255,138,31,0.25)'); gr.addColorStop(1, 'rgba(255,63,122,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.font = '150px Bungee, Impact'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 18; g.strokeStyle = '#160f24'; g.strokeText(ch, w / 2, h / 2 + 8);
    g.fillStyle = '#fff3dc'; g.fillText(ch, w / 2, h / 2 + 8);
  });
}

function signTexture(text, bg, fg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.font = '64px Bungee, Impact'; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}
