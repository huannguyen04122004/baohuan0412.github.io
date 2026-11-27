/*
  Canvas drawing for a parsed board (see kicad.js).
  - drawLayers(): CAD-style layer view used by the "Layout" tab.
  - paintSurface(): realistic soldermask / copper / silkscreen texture for the 3D board.
*/

export const LAYER_STYLE = {
  "B.Cu":     { color: "#4d7fc4", label: "Bottom copper" },
  "In2.Cu":   { color: "#c2853c", label: "Inner 2" },
  "In1.Cu":   { color: "#5fae6a", label: "Inner 1" },
  "F.Cu":     { color: "#d9463f", label: "Top copper" },
  "B.SilkS":  { color: "#e8b2a7", label: "Bottom silk" },
  "F.SilkS":  { color: "#f2eda1", label: "Top silk" },
  "Edge.Cuts":{ color: "#d0d2cd", label: "Outline" }
};

const pathCache = new WeakMap();

function polyPath(path, pts) {
  if (!pts.length) return;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
}

/* Build (once per board) Path2D objects for every layer. */
export function layerPaths(board) {
  if (pathCache.has(board)) return pathCache.get(board);
  const out = {};
  for (const [name, l] of Object.entries(board.layers)) {
    const fill = new Path2D(), zone = new Path2D();
    for (const p of l.fills) polyPath(fill, p);
    for (const d of l.discs) { fill.moveTo(d.x + d.r, d.y); fill.arc(d.x, d.y, d.r, 0, Math.PI * 2); }
    for (const p of l.zones) polyPath(zone, p);
    const strokes = new Map();
    for (const ln of l.lines) {
      const key = Math.round(ln.w * 1000) / 1000;
      if (!strokes.has(key)) strokes.set(key, new Path2D());
      const sp = strokes.get(key);
      sp.moveTo(ln.pts[0][0], ln.pts[0][1]);
      for (let i = 1; i < ln.pts.length; i++) sp.lineTo(ln.pts[i][0], ln.pts[i][1]);
    }
    out[name] = { fill, zone, strokes, texts: l.texts, hasZones: l.zones.length > 0 };
  }
  const outline = new Path2D();
  polyPath(outline, board.outline);
  for (const c of board.cutouts) polyPath(outline, c);
  const holes = new Path2D();
  for (const h of board.holes) {
    if (h.slot) { const [[x0, y0], [x1, y1]] = h.slot; holes.moveTo(x0, y0); holes.lineTo(x1, y1); }
    else { holes.moveTo(h.x + h.r, h.y); holes.arc(h.x, h.y, h.r, 0, Math.PI * 2); }
  }
  const slots = board.holes.filter((h) => h.slot);
  out.__outline = outline;
  out.__holes = holes;
  out.__slots = slots;
  pathCache.set(board, out);
  return out;
}

/* KiCad text, approximated with a sans-serif face. */
export function drawText(ctx, t, color, font = "Archivo, Arial, sans-serif") {
  const lines = String(t.text).split("\n");
  const fontPx = 100;                      // draw large, then scale down: avoids tiny-font rounding
  const k = t.h / 72;                      // cap height of the face is ~0.72 em
  const sx = (t.w / t.h) * 0.92;
  const lineGap = t.h * 1.62;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(-t.angle * Math.PI / 180);
  if (t.mirror) ctx.scale(-1, 1);
  const total = (lines.length - 1) * lineGap;
  let y0 = t.vAlign === "top" ? t.h : t.vAlign === "bottom" ? -total : t.h / 2 - total / 2;
  ctx.fillStyle = color;
  ctx.textAlign = t.hAlign;
  ctx.textBaseline = "alphabetic";
  ctx.font = `${t.italic ? "italic " : ""}${t.bold ? 700 : 560} ${fontPx}px ${font}`;
  for (let i = 0; i < lines.length; i++) {
    ctx.save();
    ctx.translate(0, y0 + i * lineGap);
    ctx.scale(k * sx, k);
    ctx.fillText(lines[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function strokeAll(ctx, strokes) {
  for (const [w, p] of strokes) { ctx.lineWidth = Math.max(w, 0.02); ctx.stroke(p); }
}

/*
  CAD-style view. `visible` is a Set of layer names, drawn back to front.
  Expects ctx already transformed into board millimetres.
*/
export function drawLayers(ctx, board, visible, { flip = false, highlight = null } = {}) {
  const P = layerPaths(board);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // board body
  ctx.fillStyle = "#1a2420";
  ctx.fill(P.__outline, "evenodd");

  const cuOrder = [...board.copper].reverse();     // bottom first
  if (flip) cuOrder.reverse();
  const order = flip
    ? ["F.SilkS", ...cuOrder, "B.SilkS"]
    : ["B.SilkS", ...cuOrder, "F.SilkS"];

  for (const name of order) {
    if (!visible.has(name) || !P[name]) continue;
    const st = LAYER_STYLE[name] || { color: "#999" };
    const p = P[name];
    ctx.fillStyle = st.color;
    ctx.strokeStyle = st.color;
    if (p.hasZones) { ctx.globalAlpha = 0.42; ctx.fill(p.zone); }
    ctx.globalAlpha = name.endsWith(".Cu") ? 0.92 : 1;
    ctx.fill(p.fill);
    strokeAll(ctx, p.strokes);
    for (const t of p.texts) drawText(ctx, t, st.color);
    ctx.globalAlpha = 1;
  }

  // drill holes
  ctx.fillStyle = "#0b100e";
  ctx.fill(P.__holes);
  ctx.strokeStyle = "#0b100e";
  for (const s of P.__slots) { ctx.lineWidth = s.r * 2; ctx.beginPath(); ctx.moveTo(...s.slot[0]); ctx.lineTo(...s.slot[1]); ctx.stroke(); }

  if (visible.has("Edge.Cuts")) {
    ctx.strokeStyle = LAYER_STYLE["Edge.Cuts"].color;
    ctx.lineWidth = 0.2;
    ctx.stroke(P.__outline);
  }

  if (highlight && highlight.hit) {
    ctx.save();
    ctx.beginPath();
    highlight.hit.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();
    ctx.setLineDash([0.5, 0.35]);
    ctx.lineWidth = 0.15;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.restore();
  }
}

/*
  Realistic surface for one side ("F" or "B") of the board, in board millimetres.
  Returns { color, orm } canvases. `orm` packs roughness (G) and metalness (B) for three.js.
*/
export const SURFACE = {
  mask: "#1d5a3c",
  maskOverCopper: "#2c7a51",
  copperEdge: "#3d8f63",
  pad: "#d4aa52",
  silk: "#f1f1ea",
  hole: "#101613"
};

export function paintSurface(board, side, pxPerMm) {
  const P = layerPaths(board);
  const { x0, y0, x1, y1 } = board.bbox;
  const W = Math.ceil((x1 - x0) * pxPerMm), H = Math.ceil((y1 - y0) * pxPerMm);
  const color = document.createElement("canvas");
  const orm = document.createElement("canvas");
  color.width = orm.width = W;
  color.height = orm.height = H;
  const c = color.getContext("2d"), o = orm.getContext("2d");
  for (const ctx of [c, o]) {
    ctx.setTransform(pxPerMm, 0, 0, pxPerMm, -x0 * pxPerMm, -y0 * pxPerMm);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  const cu = P[side + ".Cu"], mask = P[side + ".Mask"], silk = P[side + ".SilkS"];

  // ORM base: AO 1, roughness ~0.38 (glossy mask), metal 0
  o.fillStyle = "rgb(255,97,0)";
  o.fillRect(x0, y0, x1 - x0, y1 - y0);

  // mask over bare laminate
  c.fillStyle = SURFACE.mask;
  c.fillRect(x0, y0, x1 - x0, y1 - y0);

  // copper under the mask reads lighter
  if (cu) {
    c.fillStyle = SURFACE.maskOverCopper;
    c.strokeStyle = SURFACE.maskOverCopper;
    c.fill(cu.zone);
    c.fill(cu.fill);
    strokeAll(c, cu.strokes);
  }

  // mask openings: exposed, plated copper (ENIG gold)
  if (mask) {
    c.fillStyle = SURFACE.pad; c.strokeStyle = SURFACE.pad;
    o.fillStyle = "rgb(255,64,255)"; o.strokeStyle = "rgb(255,64,255)";
    for (const ctx of [c, o]) { ctx.fill(mask.fill); strokeAll(ctx, mask.strokes); }
  }

  // silkscreen
  if (silk) {
    c.fillStyle = SURFACE.silk; c.strokeStyle = SURFACE.silk;
    o.fillStyle = "rgb(255,210,0)"; o.strokeStyle = "rgb(255,210,0)";
    for (const ctx of [c, o]) {
      ctx.fill(silk.fill);
      strokeAll(ctx, silk.strokes);
      for (const t of silk.texts) drawText(ctx, t, ctx.fillStyle);
    }
  }

  // drilled holes (vias show as small dark dots)
  c.fillStyle = SURFACE.hole;
  c.fill(P.__holes);
  return { color, orm, W, H };
}
