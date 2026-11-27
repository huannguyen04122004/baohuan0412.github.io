/*
  3D board view built straight from the parsed .kicad_pcb (kicad.js).
  Board body, drill holes and surface artwork come from the file; component bodies are
  simplified shapes chosen from the footprint name (see RULES), and can be tuned per part
  from project.js ("parts").
*/
import * as THREE from "../vendor/three-lite.js";
import { paintSurface } from "./draw.js";

const DEG = Math.PI / 180;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- part rules: first match wins ---------- */
const RULES = [
  [/MountingHole|(^|:)LOGO$|lightning|Fiducial|NetTie|Logo/i, { kind: "none" }],
  [/TestPoint/i, { kind: "testpoint" }],
  [/Resistor_SMD:R_|(^|:)R_\d{4}/i, { kind: "chip", color: "#1b1b1b", height: 0.45 }],
  [/Capacitor_SMD:C_|(^|:)C_\d{4}/i, { kind: "chip", color: "#9e6c45" }],
  [/Fuse|0466/i, { kind: "chip", color: "#e6e0d1", height: 0.6 }],
  [/Crystal|ABM8/i, { kind: "crystal", height: 0.8 }],
  [/PinSocket/i, { kind: "socket", height: 8.5 }],
  [/LED_SMD|(^|:)LED_\d{4}/i, { kind: "chip", color: "#f2f0e8", height: 0.6 }],
  [/SOIC|SSOP|TSSOP|MSOP|SOP|SOT|QFN|DFN|QFP|SON|TO-252|TO-263/i, { kind: "ic" }]
];
const CHIP_HEIGHT = { "0201": 0.3, "0402": 0.5, "0603": 0.8, "0805": 1.1, "1206": 1.4, "1210": 1.8, "1812": 2.0, "2220": 2.2 };

function ruleFor(fp, overrides) {
  if (overrides && (overrides[fp.ref] || overrides[fp.value])) return { ...(overrides[fp.ref] || overrides[fp.value]) };
  const name = `${fp.lib} ${fp.models.join(" ")}`;
  for (const [re, r] of RULES) if (re.test(name)) {
    const out = { ...r };
    if (out.kind === "chip" && !out.height) { const m = name.match(/_(\d{4})_\d{4}Metric/); out.height = (m && CHIP_HEIGHT[m[1]]) || 0.8; }
    if (out.kind === "ic" && !out.height) {
      const ipc = name.match(/P\d+X(\d{3})/i);       // IPC-7351 names carry the height, e.g. SOT65P280X110
      out.height = ipc ? Number(ipc[1]) / 100 : /SOIC/i.test(name) ? 1.55 : /QFN|DFN|SON/i.test(name) ? 0.9 : 1.1;
    }
    return out;
  }
  return fp.pads.length ? { kind: "box", height: 1.2, color: "#2a2a2a" } : { kind: "none" };
}

/* ---------- materials ---------- */
function makeMaterials() {
  const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...o });
  return {
    fr4: m("#b9a874", { roughness: 0.85 }),
    plating: m("#d6ad57", { metalness: 1, roughness: 0.32, side: THREE.DoubleSide }),
    tin: m("#c9ccd1", { metalness: 1, roughness: 0.3 }),
    gold: m("#d9b25a", { metalness: 1, roughness: 0.28 }),
    black: m("#1d1d1f", { roughness: 0.6 }),
    plastic: m("#151517", { roughness: 0.75 }),
    hole: m("#050505", { roughness: 1 }),
    shield: m("#b9bdc2", { metalness: 1, roughness: 0.38 }),
    ceramic: m("#e3dccb", { roughness: 0.7 })
  };
}

/* ---------- geometry helpers ---------- */
function box(w, d, h, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class BoardView3D {
  constructor(host, board, { parts = {}, onReady } = {}) {
    this.host = host;
    this.board = board;
    this.overrides = parts;
    const { x0, y0, x1, y1 } = board.bbox;
    this.cx = (x0 + x1) / 2;
    this.cy = (y0 + y1) / 2;
    this.t = board.thickness;
    this.size = Math.hypot(x1 - x0, y1 - y0);

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "pcb-canvas";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "3D model of the circuit board. Drag to rotate, use Control and scroll or pinch to zoom.");
    host.append(renderer.domElement);

    const scene = (this.scene = new THREE.Scene());
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;

    const key = new THREE.DirectionalLight("#fff6e8", 1.35);
    key.position.set(-0.6 * this.size, 0.35 * this.size, 1.1 * this.size);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera, half = this.size * 0.62;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = this.size * 4;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 4;
    scene.add(key);
    scene.add(new THREE.HemisphereLight("#eef4ff", "#20302a", 0.35));

    this.camera = new THREE.PerspectiveCamera(30, 1, 1, this.size * 20);
    this.camera.up.set(0, 0, 1);
    this.controls = new THREE.OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = this.size * 0.25;
    this.controls.maxDistance = this.size * 4;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener("start", () => { this.tween = null; this.onInteract?.(); });

    this.mat = makeMaterials();
    this.buildBoard();
    this.parts = new THREE.Group();
    scene.add(this.parts);
    this.buildParts();

    this.resize = this.resize.bind(this);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(host);
    this.resize();
    this.setView("angle", false);
    this.needsRender = true;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    onReady?.();
  }

  /* board coordinates (mm, y down) -> world (x right, y up, z up) */
  w(x, y) { return [x - this.cx, -(y - this.cy)]; }

  buildBoard() {
    const { board, t } = this;
    const shape = new THREE.Shape(board.outline.map(([x, y]) => new THREE.Vector2(...this.w(x, y))));
    for (const c of board.cutouts) shape.holes.push(new THREE.Path(c.map(([x, y]) => new THREE.Vector2(...this.w(x, y)))));
    for (const h of board.holes) {
      const p = new THREE.Path();
      if (h.slot) {
        const [a, b] = h.slot.map(([x, y]) => this.w(x, y));
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        p.absarc(b[0], b[1], h.r, ang - Math.PI / 2, ang + Math.PI / 2, false);
        p.absarc(a[0], a[1], h.r, ang + Math.PI / 2, ang + Math.PI * 1.5, false);
      } else p.absarc(...this.w(h.x, h.y), h.r, 0, Math.PI * 2, true);
      shape.holes.push(p);
    }

    // laminate body (only its edges stay visible)
    const body = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 10 });
    body.translate(0, 0, -t / 2);
    const bodyMesh = new THREE.Mesh(body, [this.mat.fr4, this.mat.fr4]);
    bodyMesh.receiveShadow = true;
    this.scene.add(bodyMesh);

    // painted surfaces
    const maxTex = this.renderer.capabilities.maxTextureSize;
    const { x0, y0, x1, y1 } = board.bbox;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    const ppm = Math.min(small ? 20 : 30, (Math.min(maxTex, 4096) - 2) / Math.max(x1 - x0, y1 - y0));
    const capGeo = new THREE.ShapeGeometry(shape, 10);
    const pos = capGeo.attributes.position, uv = capGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const bx = pos.getX(i) + this.cx, by = this.cy - pos.getY(i);
      uv.setXY(i, (bx - x0) / (x1 - x0), 1 - (by - y0) / (y1 - y0));
    }
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    for (const side of ["F", "B"]) {
      const s = paintSurface(board, side, ppm);
      const map = new THREE.CanvasTexture(s.color);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = aniso;
      const orm = new THREE.CanvasTexture(s.orm);
      orm.anisotropy = aniso;
      const mat = new THREE.MeshPhysicalMaterial({
        map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1,
        clearcoat: 0.2, clearcoatRoughness: 0.55, side: side === "F" ? THREE.FrontSide : THREE.BackSide
      });
      const mesh = new THREE.Mesh(capGeo, mat);
      mesh.position.z = side === "F" ? t / 2 + 0.003 : -t / 2 - 0.003;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    // plated barrels
    const plated = board.holes.filter((h) => h.plated && !h.via && !h.slot);
    if (plated.length) {
      const g = new THREE.CylinderGeometry(1, 1, t + 0.01, 24, 1, true);
      g.rotateX(Math.PI / 2);
      const inst = new THREE.InstancedMesh(g, this.mat.plating, plated.length);
      const m = new THREE.Matrix4();
      plated.forEach((h, i) => {
        const [X, Y] = this.w(h.x, h.y);
        m.makeScale(h.r * 0.995, h.r * 0.995, 1).setPosition(X, Y, 0);
        inst.setMatrixAt(i, m);
      });
      this.scene.add(inst);
    }
  }

  /* ---------- parts ---------- */
  buildParts() {
    for (const fp of this.board.footprints) {
      const rule = ruleFor(fp, this.overrides);
      if (rule.kind === "none" || !this[`part_${rule.kind}`]) continue;
      const g = new THREE.Group();
      this[`part_${rule.kind}`](g, fp, rule);
      // place group: footprint origin, rotation, side
      const [X, Y] = this.w(fp.x, fp.y);
      g.position.set(X, Y, fp.side === "F" ? this.t / 2 : -this.t / 2);
      g.rotation.z = fp.angle * DEG;
      if (fp.side === "B") g.scale.z = -1;
      g.userData.ref = fp.ref;
      this.parts.add(g);
    }
  }

  // footprint-local helpers: local (x right, y down) -> group space (x right, y up)
  L(x, y) { return [x, -y]; }
  bodyBox(fp, prefer = "fab") {
    const pick = (b) => b && b.x1 - b.x0 > 0.2 && b.y1 - b.y0 > 0.2 ? b : null;
    const pb = fp.padBox;
    const fab = pick(fp.fab), crt = pick(fp.courtyard);
    let b = prefer === "fab" ? fab || (crt && shrink(crt, 0.3)) || pb : (crt && shrink(crt, 0.3)) || fab || pb;
    if (b && pb && fab === b) {
      // ignore fab outlines that are offset from the pads (stray drawings)
      const off = Math.hypot((b.x0 + b.x1) / 2 - (pb.x0 + pb.x1) / 2, (b.y0 + b.y1) / 2 - (pb.y0 + pb.y1) / 2);
      if (off > 0.4 && crt) b = shrink(crt, 0.3);
    }
    return b;
    function shrink(x, d) { return { x0: x.x0 + d, y0: x.y0 + d, x1: x.x1 - d, y1: x.y1 - d }; }
  }
  addBox(g, b, z0, h, mat) {
    const mesh = box(b.x1 - b.x0, b.y1 - b.y0, h, mat);
    const [x, y] = this.L((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    mesh.position.set(x, y, z0 + h / 2);
    g.add(mesh);
    return mesh;
  }
  color(c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }); }

  part_box(g, fp, r) { const b = this.bodyBox(fp); if (b) this.addBox(g, b, 0, r.height || 1.2, this.color(r.color || "#2a2a2a")); }

  part_chip(g, fp, r) {
    const pads = fp.pads;
    const b = this.bodyBox(fp, "fab");
    if (!b || pads.length < 2) return this.part_box(g, fp, r);
    const alongX = Math.abs(pads[0].local[0] - pads[1].local[0]) >= Math.abs(pads[0].local[1] - pads[1].local[1]);
    const L = alongX ? b.x1 - b.x0 : b.y1 - b.y0;
    const term = Math.min(L * 0.22, 0.6);
    const h = r.height;
    const body = this.addBox(g, b, 0.02, h, this.color(r.color));
    body.material.roughness = 0.5;
    for (const sgn of [-1, 1]) {
      const tb = alongX
        ? { x0: sgn < 0 ? b.x0 : b.x1 - term, x1: sgn < 0 ? b.x0 + term : b.x1, y0: b.y0 - 0.01, y1: b.y1 + 0.01 }
        : { y0: sgn < 0 ? b.y0 : b.y1 - term, y1: sgn < 0 ? b.y0 + term : b.y1, x0: b.x0 - 0.01, x1: b.x1 + 0.01 };
      this.addBox(g, tb, 0.01, h + 0.02, this.mat.tin);
    }
  }

  part_ic(g, fp, r) {
    const b = this.bodyBox(fp, "fab");
    if (!b) return;
    const h = r.height;
    this.addBox(g, b, 0.1, h - 0.1, this.color(r.color || "#202022"));
    // leads for pads that sit outside the body
    for (const p of fp.pads) {
      const [px, py] = p.local;
      const outsideX = px < b.x0 || px > b.x1, outsideY = py < b.y0 || py > b.y1;
      if (!outsideX && !outsideY) continue;
      const rot = ((p.angle - fp.angle) % 180 + 180) % 180;
      let pw = p.w, ph = p.h;
      if (Math.abs(rot - 90) < 1) [pw, ph] = [ph, pw];
      let lb;
      if (outsideX) { const x0 = px < b.x0 ? px - pw * 0.35 : b.x1, x1 = px < b.x0 ? b.x0 : px + pw * 0.35; lb = { x0, x1, y0: py - ph * 0.28, y1: py + ph * 0.28 }; }
      else { const y0 = py < b.y0 ? py - ph * 0.35 : b.y1, y1 = py < b.y0 ? b.y0 : py + ph * 0.35; lb = { y0, y1, x0: px - pw * 0.28, x1: px + pw * 0.28 }; }
      this.addBox(g, lb, 0.02, Math.min(0.35, h * 0.35), this.mat.tin);
    }
    // pin-1 dot
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 20), this.color("#3a3a3e"));
    dot.rotation.x = Math.PI / 2;
    const p1 = fp.pads.find((p) => p.number === "1") || fp.pads[0];
    const [dx, dy] = this.L(
      Math.min(Math.max(p1.local[0], b.x0 + 0.45), b.x1 - 0.45),
      Math.min(Math.max(p1.local[1], b.y0 + 0.45), b.y1 - 0.45));
    dot.position.set(dx, dy, h + 0.01);
    g.add(dot);
  }

  part_crystal(g, fp, r) {
    const b = this.bodyBox(fp, "fab");
    if (!b) return;
    this.addBox(g, b, 0.02, 0.32, this.mat.ceramic);
    this.addBox(g, { x0: b.x0 + 0.18, x1: b.x1 - 0.18, y0: b.y0 + 0.18, y1: b.y1 - 0.18 }, 0.32, r.height - 0.32, this.mat.shield);
  }

  part_testpoint(g, fp, r) {
    const color = r.color || (/GND|VSS|0V/i.test(fp.ref + fp.value) ? "#202022" : "#c7342c");
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 });
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.2, 12, 32, Math.PI), mat);
    loop.rotation.x = Math.PI / 2;
    loop.position.z = 1.6;
    loop.castShadow = true;
    g.add(loop);
    for (const sgn of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 12), mat);
      leg.rotation.x = Math.PI / 2;
      leg.position.set(sgn * 0.85, 0, 0.8);
      leg.castShadow = true;
      g.add(leg);
    }
  }

  part_connector(g, fp, r) {
    const b = this.bodyBox(fp, "fab");
    if (!b) return;
    const h = r.height || 9;
    const mat = this.color(r.color || "#e4e0d4");
    mat.roughness = 0.7;
    this.addBox(g, b, 0, h, mat);
    const signal = fp.pads.filter((p) => p.type === "thru_hole");
    const pitch = signal.length > 1 ? Math.min(...signal.slice(1).map((p, i) => Math.hypot(p.local[0] - signal[i].local[0], p.local[1] - signal[i].local[1]))) : 3;
    const s = Math.min(pitch * 0.78, (b.y1 - b.y0) * 0.6, (b.x1 - b.x0) * 0.6);
    for (const p of signal) {
      const [x, y] = p.local;
      const cy = Math.min(Math.max(y, b.y0 + s / 2 + 0.4), b.y1 - s / 2 - 0.4);
      this.addBox(g, { x0: x - s / 2, x1: x + s / 2, y0: cy - s / 2, y1: cy + s / 2 }, h - 0.02, 0.04, this.mat.hole);
    }
  }

  part_socket(g, fp, r) { this.sockets(g, fp, r.height || 8.5); }

  sockets(g, fp, h) {
    // one socket strip per column of through-hole pads
    const cols = new Map();
    for (const p of fp.pads.filter((p) => p.type === "thru_hole")) {
      const key = Math.round(p.local[0] * 10) / 10;
      if (!cols.has(key)) cols.set(key, []);
      cols.get(key).push(p);
    }
    const holeGeo = new THREE.BoxGeometry(0.9, 0.9, 0.04);
    for (const [x, pads] of cols) {
      const ys = pads.map((p) => p.local[1]);
      this.addBox(g, { x0: x - 1.27, x1: x + 1.27, y0: Math.min(...ys) - 1.27, y1: Math.max(...ys) + 1.27 }, 0, h, this.mat.plastic);
      for (const y of ys) {
        const hole = new THREE.Mesh(holeGeo, this.mat.hole);
        const [hx, hy] = this.L(x, y);
        hole.position.set(hx, hy, h + 0.001);
        g.add(hole);
      }
    }
    return cols;
  }

  // A dev board plugged into two socket strips, e.g. an ESP32 DevKit
  part_devkit(g, fp, r) {
    const h = r.height || 11.1;
    const cols = this.sockets(g, fp, 8.5);
    const b = this.bodyBox(fp, "fab");
    const W = b.x1 - b.x0, D = b.y1 - b.y0;

    // male header strips between socket and dev board
    for (const [x, pads] of cols) {
      const ys = pads.map((p) => p.local[1]);
      this.addBox(g, { x0: x - 1.27, x1: x + 1.27, y0: Math.min(...ys) - 1.27, y1: Math.max(...ys) + 1.27 }, 8.5, h - 8.5, this.mat.black);
    }

    // dev board with its own little silkscreen
    const ppm = 16;
    const cv = document.createElement("canvas");
    cv.width = Math.round(W * ppm); cv.height = Math.round(D * ppm);
    const c = cv.getContext("2d");
    c.fillStyle = r.color || "#1f4f8a";
    c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(ppm, 0, 0, ppm, -b.x0 * ppm, -b.y0 * ppm);
    c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 0.18;
    for (const [x, pads] of cols) for (const p of pads) {
      c.fillStyle = "#d6ad57"; c.beginPath(); c.arc(x, p.local[1], 0.85, 0, 7); c.fill();
      c.fillStyle = "#151515"; c.beginPath(); c.arc(x, p.local[1], 0.45, 0, 7); c.fill();
    }
    c.save();
    c.translate((b.x0 + b.x1) / 2, b.y0 + D * 0.72);
    c.rotate(-Math.PI / 2);
    c.fillStyle = "rgba(255,255,255,.9)";
    c.font = "600 2.2px Archivo, Arial, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(r.label || fp.value || fp.ref, 0, 0);
    c.restore();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const topMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.55 });
    const edge = this.mat.fr4;
    const slab = box(W, D, 1.6, [edge, edge, edge, edge, topMat, edge]);
    const [sx, sy] = this.L((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    slab.position.set(sx, sy, h + 0.8);
    g.add(slab);
    const top = h + 1.6;

    // pin tips poking through
    const tipGeo = new THREE.BoxGeometry(0.64, 0.64, 1.6);
    for (const [x, pads] of cols) for (const p of pads) {
      const tip = new THREE.Mesh(tipGeo, this.mat.gold);
      const [tx, ty] = this.L(x, p.local[1]);
      tip.position.set(tx, ty, top + 0.6);
      g.add(tip);
    }

    // radio module: PCB carrier + metal shield, at the antenna end (top of the footprint)
    const mw = Math.min(18, W - 6), md = Math.min(25.5, D * 0.45);
    const my0 = b.y0 + 0.6;
    this.addBox(g, { x0: -mw / 2 + (b.x0 + b.x1) / 2, x1: mw / 2 + (b.x0 + b.x1) / 2, y0: my0, y1: my0 + md }, top, 0.8, this.color("#16201c"));
    const sh = { x0: -mw / 2 + 1.1 + (b.x0 + b.x1) / 2, x1: mw / 2 - 1.1 + (b.x0 + b.x1) / 2, y0: my0 + md - 18.2, y1: my0 + md - 0.7 };
    this.addBox(g, sh, top + 0.8, 2.4, this.mat.shield);

    // USB connectors and buttons at the other end
    const cx = (b.x0 + b.x1) / 2;
    for (const dx of [-W * 0.24, W * 0.24]) {
      this.addBox(g, { x0: cx + dx - 4.5, x1: cx + dx + 4.5, y0: b.y1 - 7.2, y1: b.y1 + 0.6 }, top, 3.2, this.mat.shield);
    }
    for (const dx of [-W * 0.33, W * 0.33]) {
      this.addBox(g, { x0: cx + dx - 1.9, x1: cx + dx + 1.9, y0: b.y1 - 13, y1: b.y1 - 10 }, top, 1.4, this.mat.tin);
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.6, 20), this.mat.black);
      btn.rotation.x = Math.PI / 2;
      const [bx, by] = this.L(cx + dx, b.y1 - 11.5);
      btn.position.set(bx, by, top + 1.7);
      g.add(btn);
    }
  }

  /* ---------- camera ---------- */
  fitDistance() {
    // distance at which the whole board fits the current viewport, looking straight down
    const { x0, y0, x1, y1 } = this.board.bbox;
    const vFov = this.camera.fov * DEG, aspect = this.camera.aspect || 1;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    return Math.max((y1 - y0) / 2 / Math.tan(vFov / 2), (x1 - x0) / 2 / Math.tan(hFov / 2)) * 1.12 + 12;
  }

  presetFor(name) {
    const fit = this.fitDistance();
    const d = Math.max(fit * 0.98, this.size * 1.05);
    if (name === "top") return { pos: [0, -0.001, fit], target: [0, 0, 0] };
    if (name === "bottom") return { pos: [0, 0.001, -fit], target: [0, 0, 0] };
    const el = 48 * DEG, az = -28 * DEG;
    return { pos: [Math.sin(az) * Math.cos(el) * d, -Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d], target: [0, 0, 2] };
  }

  setView(name, animate = true) {
    const p = this.presetFor(name);
    if (name === "bottom") this.camera.up.set(0, 1, 0); else if (name === "top") this.camera.up.set(0, 1, 0); else this.camera.up.set(0, 0, 1);
    this.controls.dispose();
    this.controls.object.up.copy(this.camera.up);
    // OrbitControls caches the up vector, so rebuild it when it changes
    const old = this.controls;
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.09, minDistance: old.minDistance, maxDistance: old.maxDistance, zoomToCursor: true, enabled: old.enabled });
    this.controls.addEventListener("start", () => { this.tween = null; this.onInteract?.(); });
    if (!animate || reduceMotion()) {
      this.camera.position.set(...p.pos);
      this.controls.target.set(...p.target);
      this.controls.update();
      this.needsRender = true;
      return;
    }
    this.tween = {
      t0: performance.now(), dur: 900,
      fromPos: this.camera.position.clone(), toPos: new THREE.Vector3(...p.pos),
      fromT: this.controls.target.clone(), toT: new THREE.Vector3(...p.target)
    };
  }

  intro() {
    // one-time settle from a top-down view into the angled view
    if (reduceMotion()) return;
    const top = this.presetFor("top");
    this.camera.position.set(top.pos[0] * 0.9, top.pos[1] - this.size * 0.2, top.pos[2] * 0.9);
    this.controls.target.set(0, 0, 0);
    const p = this.presetFor("angle");
    this.tween = { t0: performance.now(), dur: 1800, fromPos: this.camera.position.clone(), toPos: new THREE.Vector3(...p.pos), fromT: new THREE.Vector3(0, 0, 0), toT: new THREE.Vector3(...p.target) };
  }

  setPartsVisible(on) { this.parts.visible = on; this.needsRender = true; }
  setEnabled(on) { this.controls.enabled = on; }

  resize() {
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    if (this.paused) return;
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e);
      this.controls.target.lerpVectors(this.tween.fromT, this.tween.toT, e);
      if (k >= 1) this.tween = null;
      this.needsRender = true;
    }
    const moved = this.controls.update();
    if (moved || this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  }

  destroy() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
