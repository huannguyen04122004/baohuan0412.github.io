import { drawLayers } from "./draw.js";

function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const area = (p) => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return Math.abs(s / 2); };

export class LayoutView {
  constructor(host, board, { onHover } = {}) {
    this.host = host;
    this.board = board;
    this.onHover = onHover;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "pcb-canvas";
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", "PCB layout. Drag to pan, use Control and scroll or pinch to zoom.");
    host.append(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.visible = new Set(["F.Cu", "B.Cu", "F.SilkS", "Edge.Cuts"]);
    this.flip = false;
    this.view = { s: 1, tx: 0, ty: 0 };
    this.hover = null;
    this.parts = board.footprints.filter((f) => f.hit && f.ref && !/^(G\*+|H\d+)$/.test(f.ref) && f.pads.length);
    this.pointers = new Map();
    this.dirty = true;
    this.enabled = true;

    this.resize = this.resize.bind(this);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(host);
    this.bind();
    this.resize();
    this.fit();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return;
    const prevW = this.cssW;
    this.cssW = r.width; this.cssH = r.height; this.dpr = dpr;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    if (prevW && this.fitted) this.fit(); else if (!prevW) this.fit();
    this.dirty = true;
  }

  fit() {
    const { x0, y0, x1, y1 } = this.board.bbox;
    const pad = 28;
    const s = Math.min((this.cssW - pad * 2) / (x1 - x0), (this.cssH - pad * 2) / (y1 - y0));
    this.view.s = s;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    this.view.tx = this.cssW / 2 - (this.flip ? -cx : cx) * s;
    this.view.ty = this.cssH / 2 - cy * s;
    this.fitted = true;
    this.dirty = true;
  }

  toBoard(px, py) {
    const x = (px - this.view.tx) / this.view.s;
    return [this.flip ? -x : x, (py - this.view.ty) / this.view.s];
  }

  zoomAt(px, py, factor) {
    const s = Math.min(Math.max(this.view.s * factor, 1), 400);
    const f = s / this.view.s;
    this.view.tx = px - (px - this.view.tx) * f;
    this.view.ty = py - (py - this.view.ty) * f;
    this.view.s = s;
    this.fitted = false;
    this.dirty = true;
  }

  setLayer(name, on) { on ? this.visible.add(name) : this.visible.delete(name); this.dirty = true; }
  setFlip(on) { this.flip = on; this.fit(); }

  bind() {
    const c = this.canvas;
    const local = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    c.addEventListener("pointerdown", (e) => {
      if (!this.enabled) return;
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, local(e));
      c.classList.add("is-dragging");
    });
    c.addEventListener("pointermove", (e) => {
      const p = local(e);
      if (this.pointers.has(e.pointerId)) {
        const prev = this.pointers.get(e.pointerId);
        if (this.pointers.size === 1) {
          this.view.tx += p[0] - prev[0];
          this.view.ty += p[1] - prev[1];
          this.fitted = false;
        } else if (this.pointers.size === 2) {
          const [a, b] = [...this.pointers.entries()];
          const other = a[0] === e.pointerId ? b[1] : a[1];
          const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]);
          const d1 = Math.hypot(p[0] - other[0], p[1] - other[1]);
          if (d0 > 0) this.zoomAt((p[0] + other[0]) / 2, (p[1] + other[1]) / 2, d1 / d0);
        }
        this.pointers.set(e.pointerId, p);
        this.dirty = true;
      } else if (e.pointerType === "mouse") {
        this.pick(p);
      }
    });
    const end = (e) => { this.pointers.delete(e.pointerId); if (!this.pointers.size) c.classList.remove("is-dragging"); };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("pointerleave", () => { if (this.hover) { this.hover = null; this.dirty = true; this.onHover?.(null); } });
    c.addEventListener("dblclick", () => this.fit());
    c.addEventListener("wheel", (e) => {
      if (!this.enabled) return;
      if (!(e.ctrlKey || e.metaKey || this.wheelFree)) { this.onWheelBlocked?.(); return; }
      e.preventDefault();
      const [px, py] = local(e);
      this.zoomAt(px, py, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022)));
    }, { passive: false });
    c.addEventListener("click", (e) => { if (e.pointerType !== "mouse") this.pick(local(e)); });
  }

  pick(p) {
    const b = this.toBoard(p[0], p[1]);
    const hits = this.parts.filter((f) => pointInPoly(b, f.hit));
    hits.sort((a, c) => area(a.hit) - area(c.hit));
    const h = hits[0] || null;
    if (h !== this.hover) { this.hover = h; this.dirty = true; }
    this.onHover?.(h, p);
  }

  loop() {
    if (this.dirty) { this.draw(); this.dirty = false; }
    this.raf = requestAnimationFrame(this.loop);
  }

  draw() {
    const { ctx, dpr, view } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(view.s * dpr * (this.flip ? -1 : 1), 0, 0, view.s * dpr, view.tx * dpr, view.ty * dpr);
    drawLayers(ctx, this.board, this.visible, { flip: this.flip, highlight: this.hover });
  }

  destroy() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.canvas.remove(); }
}
