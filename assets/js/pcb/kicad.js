/*
  Minimal .kicad_pcb reader (KiCad 6 – 10 file formats).
  Turns the S-expression file into flat, world-space geometry that the 2D and 3D viewers draw.
  Coordinates stay in KiCad's convention: millimetres, x to the right, y pointing down.
*/

/* ---------------- S-expression parser ---------------- */
export function parseSexpr(text) {
  const stack = [[]];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === 40) { stack.push([]); i++; }                       // (
    else if (c === 41) { const done = stack.pop(); stack[stack.length - 1].push(done); i++; } // )
    else if (c === 34) {                                           // "
      let j = i + 1, out = "", start = j;
      while (j < n) {
        const d = text.charCodeAt(j);
        if (d === 92) { out += text.slice(start, j); const e = text[j + 1]; out += e === "n" ? "\n" : e === "t" ? "\t" : e; j += 2; start = j; continue; }
        if (d === 34) break;
        j++;
      }
      out += text.slice(start, j);
      stack[stack.length - 1].push({ s: out });
      i = j + 1;
    } else if (c <= 32) { i++; }
    else {
      let j = i;
      while (j < n) { const d = text.charCodeAt(j); if (d <= 32 || d === 40 || d === 41) break; j++; }
      stack[stack.length - 1].push(text.slice(i, j));
      i = j;
    }
  }
  return stack[0][0];
}

const isList = (x) => Array.isArray(x);
const str = (x) => (x && typeof x === "object" && !isList(x) ? x.s : x);
const child = (node, name) => { for (let k = 1; k < node.length; k++) { const c = node[k]; if (isList(c) && c[0] === name) return c; } return null; };
const children = (node, name) => node.filter((c) => isList(c) && c[0] === name);
const has = (node, atom) => node.some((c) => c === atom || (isList(c) && c[0] === atom && (c.length === 1 || c[1] === "yes")));
const nums = (node) => (node ? node.slice(1).map(Number) : null);
const xy = (node) => (node ? [Number(node[1]), Number(node[2])] : null);

/* ---------------- geometry helpers ---------------- */
const DEG = Math.PI / 180;
// KiCad angles are counter-clockwise on screen, with y pointing down.
export function rot([x, y], deg) {
  if (!deg) return [x, y];
  const a = deg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [x * c + y * s, -x * s + y * c];
}
function arcPoints(a, m, b, segPerMm = 4) {
  // circle through three points
  const [ax, ay] = a, [bx, by] = m, [cx, cy] = b;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return [a, b];
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  let t0 = Math.atan2(ay - uy, ax - ux), t1 = Math.atan2(by - uy, bx - ux), t2 = Math.atan2(cy - uy, cx - ux);
  const norm = (t) => { while (t < 0) t += 2 * Math.PI; while (t >= 2 * Math.PI) t -= 2 * Math.PI; return t; };
  // decide direction so that the mid point lies on the swept arc
  let sweep = norm(t2 - t0);
  if (norm(t1 - t0) > sweep) sweep = sweep - 2 * Math.PI;
  const steps = Math.max(6, Math.ceil(Math.abs(sweep) * r * segPerMm));
  const pts = [];
  for (let k = 0; k <= steps; k++) { const t = t0 + (sweep * k) / steps; pts.push([ux + r * Math.cos(t), uy + r * Math.sin(t)]); }
  return pts;
}
function circlePts(cx, cy, r, steps) {
  steps = steps || Math.max(16, Math.min(96, Math.ceil(r * 12)));
  const p = [];
  for (let k = 0; k < steps; k++) { const t = (k / steps) * 2 * Math.PI; p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return p;
}
function roundRectPts(w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r < 1e-6) return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const pts = [], corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]];
  for (const [cx, cy, a0] of corners) for (let k = 0; k <= 6; k++) { const t = (a0 + (k / 6) * 90) * DEG; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return pts;
}
function polyArea(p) { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return s / 2; }
function bboxOf(points, box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }) {
  for (const [x, y] of points) { if (x < box.x0) box.x0 = x; if (y < box.y0) box.y0 = y; if (x > box.x1) box.x1 = x; if (y > box.y1) box.y1 = y; }
  return box;
}
function readPts(node) {
  const out = [];
  const pts = child(node, "pts");
  if (!pts) return out;
  for (const p of pts.slice(1)) {
    if (p[0] === "xy") out.push(xy(p));
    else if (p[0] === "arc") { const a = arcPoints(xy(child(p, "start")), xy(child(p, "mid")), xy(child(p, "end"))); if (out.length) a.shift(); out.push(...a); }
  }
  return out;
}
const strokeWidth = (node) => { const s = child(node, "stroke"); const w = s ? child(s, "width") : child(node, "width"); return w ? Number(w[1]) : 0; };
const isFilled = (node) => { const f = child(node, "fill"); return !!f && ["yes", "solid"].includes(str(f[1])); };

/* ---------------- board model ---------------- */
export function loadBoard(text) {
  const root = parseSexpr(text);
  if (!root || root[0] !== "kicad_pcb") throw new Error("This doesn't look like a .kicad_pcb file.");

  const layerDecl = child(root, "layers");
  const copper = layerDecl ? layerDecl.slice(1).map((l) => str(l[1])).filter((n) => /\.Cu$/.test(n)) : ["F.Cu", "B.Cu"];
  const general = child(root, "general");
  const thickness = general && child(general, "thickness") ? Number(child(general, "thickness")[1]) : 1.6;

  const layers = {};       // name -> { fills: [pts], zones: [pts], lines: [{pts,w}], discs: [{x,y,r}], texts: [] }
  const L = (name) => (layers[name] ||= { fills: [], zones: [], lines: [], discs: [], texts: [] });
  const expand = (names) => {
    const out = new Set();
    for (const n of names) {
      if (n === "*.Cu") copper.forEach((c) => out.add(c));
      else if (n.startsWith("*.")) { out.add("F." + n.slice(2)); out.add("B." + n.slice(2)); }
      else if (n.startsWith("F&B.")) { out.add("F." + n.slice(4)); out.add("B." + n.slice(4)); }
      else out.add(n);
    }
    return [...out];
  };

  const holes = [];        // { x, y, r, plated, slot?: [[x,y],[x,y]] }
  const pads = [];         // world-space pad polygons for the 3D view: { side, pts, metal }
  const vias = [];
  const footprints = [];
  const edgeSegs = [];     // open polylines on Edge.Cuts
  const edgeLoops = [];    // closed loops on Edge.Cuts

  /* -- graphic item (board level or inside a footprint) -- */
  function addGraphic(node, T, fpCtx) {
    const kind = node[0].replace(/^(gr|fp)_/, "");
    const layerNode = child(node, "layer");
    if (!layerNode) return;
    const layer = str(layerNode[1]);
    const w = strokeWidth(node);
    const fill = isFilled(node);
    let pts = null, closed = false;

    if (kind === "line") pts = [xy(child(node, "start")), xy(child(node, "end"))];
    else if (kind === "arc") pts = arcPoints(xy(child(node, "start")), xy(child(node, "mid")), xy(child(node, "end")));
    else if (kind === "rect") { const [x0, y0] = xy(child(node, "start")), [x1, y1] = xy(child(node, "end")); pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; closed = true; }
    else if (kind === "circle") { const c = xy(child(node, "center")), e = xy(child(node, "end")); pts = circlePts(c[0], c[1], Math.hypot(e[0] - c[0], e[1] - c[1])); closed = true; }
    else if (kind === "poly") { pts = readPts(node); closed = true; }
    else if (kind === "text" || kind === "text_box") { addText(node, T, layer, fpCtx); return; }
    else return;

    if (fpCtx) fpCtx.local.push({ layer, pts });
    const world = pts.map(T);
    if (layer === "Edge.Cuts") { (closed ? edgeLoops : edgeSegs).push(world); return; }
    const l = L(layer);
    if (closed && (fill || kind === "poly" && w === 0)) l.fills.push(world);
    if (w > 0) l.lines.push({ pts: closed ? [...world, world[0]] : world, w });
  }

  function addText(node, T, layer, fpCtx, overrideText) {
    if (has(node, "hide")) return;
    const effects = child(node, "effects");
    if (effects && has(effects, "hide")) return;
    let text = overrideText ?? str(node[node[0] === "fp_text" ? 2 : 1]);
    if (text == null) return;
    if (fpCtx) text = text.replace(/\$\{REFERENCE\}/gi, fpCtx.ref).replace(/\$\{VALUE\}/gi, fpCtx.value);
    const at = child(node, "at");
    if (!at) return;
    const font = effects && child(effects, "font");
    const size = font && child(font, "size") ? nums(child(font, "size")) : [1, 1];
    const thick = font && child(font, "thickness") ? Number(child(font, "thickness")[1]) : size[0] * 0.15;
    const just = effects && child(effects, "justify") ? child(effects, "justify").slice(1) : [];
    let angle = Number(at[3] || 0);
    if (fpCtx && !has(at, "unlocked")) {
      // footprint text stays readable: KiCad keeps it upright
      let a = ((angle % 360) + 360) % 360;
      if (a > 90 && a <= 270) angle -= 180;
    }
    const [x, y] = T([Number(at[1]), Number(at[2])]);
    L(layer).texts.push({
      text, x, y, angle,
      h: size[0], w: size[1], thick,
      bold: !!(font && has(font, "bold")), italic: !!(font && has(font, "italic")),
      hAlign: just.includes("left") ? "left" : just.includes("right") ? "right" : "center",
      vAlign: just.includes("top") ? "top" : just.includes("bottom") ? "bottom" : "middle",
      mirror: just.includes("mirror") || layer.startsWith("B.")
    });
  }

  /* -- pads -- */
  function addPad(node, fp) {
    const type = node[2], shape = node[3];
    const at = child(node, "at");
    const local = [Number(at[1]), Number(at[2])];
    const angle = Number(at[3] || 0);                  // pad angle in the file is absolute
    const center = fp.T(local);
    const [w, h] = nums(child(node, "size")) || [0, 0];
    const layerNode = child(node, "layers");
    const padLayers = layerNode ? expand(layerNode.slice(1).map(str)) : [];

    // outline in pad-local coordinates
    let shapes = [];
    const rr = child(node, "roundrect_rratio");
    if (shape === "circle") shapes.push({ circle: Math.max(w, h) / 2 });
    else if (shape === "oval") {
      const r = Math.min(w, h) / 2, d = Math.abs(w - h) / 2;
      shapes.push({ poly: roundRectPts(w, h, r) });
      if (!d) shapes = [{ circle: r }];
    } else if (shape === "roundrect" || shape === "chamfered_rect") shapes.push({ poly: roundRectPts(w, h, (rr ? Number(rr[1]) : 0.25) * Math.min(w, h)) });
    else if (shape === "custom") {
      const anchor = child(child(node, "options") || ["options"], "anchor");
      if (anchor && anchor[1] === "circle") shapes.push({ circle: w / 2 }); else shapes.push({ poly: roundRectPts(w, h, 0) });
      const prims = child(node, "primitives");
      if (prims) for (const p of prims.slice(1)) {
        const pw = strokeWidth(p);
        if (p[0] === "gr_poly") shapes.push({ poly: readPts(p), outline: pw });
        else if (p[0] === "gr_circle") { const c = xy(child(p, "center")), e = xy(child(p, "end")); shapes.push({ poly: circlePts(c[0], c[1], Math.hypot(e[0] - c[0], e[1] - c[1])) }); }
        else if (p[0] === "gr_rect") { const [x0, y0] = xy(child(p, "start")), [x1, y1] = xy(child(p, "end")); shapes.push({ poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] }); }
        else if (p[0] === "gr_line" || p[0] === "gr_arc") {
          const pts = p[0] === "gr_line" ? [xy(child(p, "start")), xy(child(p, "end"))] : arcPoints(xy(child(p, "start")), xy(child(p, "mid")), xy(child(p, "end")));
          shapes.push({ line: pts, w: pw });
        }
      }
    } else shapes.push({ poly: roundRectPts(w, h, 0) });  // rect, trapezoid

    const toWorld = (p) => { const r = rot(p, angle); return [center[0] + r[0], center[1] + r[1]]; };
    const worldShapes = shapes.map((s) => s.circle ? { circle: s.circle, c: center } : s.line ? { line: s.line.map(toWorld), w: s.w } : { poly: s.poly.map(toWorld) });

    for (const ln of padLayers) {
      if (!/\.(Cu|Mask|Paste)$/.test(ln)) continue;
      const l = L(ln);
      for (const s of worldShapes) {
        if (s.circle) l.discs.push({ x: s.c[0], y: s.c[1], r: s.circle });
        else if (s.line) l.lines.push({ pts: s.line, w: s.w });
        else l.fills.push(s.poly);
      }
    }
    // pad polygon (for 3D metal + hover)
    const outline = worldShapes.map((s) => s.circle ? circlePts(s.c[0], s.c[1], s.circle, 24) : s.poly || null).filter(Boolean);
    for (const side of ["F", "B"]) if (padLayers.includes(side + ".Mask")) pads.push({ side, polys: outline });

    // drill
    const drill = child(node, "drill");
    if (drill && (type === "thru_hole" || type === "np_thru_hole")) {
      const isOval = drill[1] === "oval";
      const dn = drill.slice(isOval ? 2 : 1).filter((v) => !isList(v)).map(Number);
      const off = child(drill, "offset");
      const c = off ? toWorld([Number(off[1]), Number(off[2])]) : center;
      if (isOval && dn[1] && Math.abs(dn[0] - dn[1]) > 1e-3) {
        const r = Math.min(dn[0], dn[1]) / 2, len = Math.abs(dn[0] - dn[1]) / 2;
        const axis = dn[0] > dn[1] ? [len, 0] : [0, len];
        const a = rot(axis, angle);
        holes.push({ x: c[0], y: c[1], r, plated: type === "thru_hole", slot: [[c[0] - a[0], c[1] - a[1]], [c[0] + a[0], c[1] + a[1]]] });
      } else if (dn[0] > 0) holes.push({ x: c[0], y: c[1], r: dn[0] / 2, plated: type === "thru_hole" });
    }

    fp.pads.push({ local, angle, w, h, shape, type, number: str(node[1]), world: center });
  }

  /* -- footprints -- */
  function addFootprint(node) {
    const at = child(node, "at");
    const fx = Number(at[1]), fy = Number(at[2]), fa = Number(at[3] || 0);
    const T = (p) => { const r = rot(p, fa); return [fx + r[0], fy + r[1]]; };
    const side = str(child(node, "layer")[1]).startsWith("B.") ? "B" : "F";
    const props = {};
    for (const p of children(node, "property")) props[str(p[1])] = str(p[2]);
    for (const t of children(node, "fp_text")) {
      if (t[1] === "reference") props.Reference ??= str(t[2]);
      if (t[1] === "value") props.Value ??= str(t[2]);
    }
    const fp = {
      lib: str(node[1]), ref: props.Reference || "", value: props.Value || "",
      x: fx, y: fy, angle: fa, side, T, pads: [], local: [],
      models: children(node, "model").map((m) => str(m[1]))
    };
    const ctx = { ref: fp.ref, value: fp.value, local: fp.local };
    for (const c of node) {
      if (!isList(c)) continue;
      if (c[0] === "pad") addPad(c, fp);
      else if (c[0] === "property") {
        const layer = child(c, "layer");
        if (layer && child(c, "at")) addText(c, T, str(layer[1]), ctx, str(c[2]));
      } else if (c[0].startsWith("fp_")) addGraphic(c, T, ctx);
    }
    // local bounding boxes by layer group
    const box = (re) => { const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; for (const g of fp.local) if (re.test(g.layer)) bboxOf(g.pts, b); return isFinite(b.x0) ? b : null; };
    fp.fab = box(/^[FB]\.Fab$/);
    fp.courtyard = box(/^[FB]\.CrtYd$/);
    const pb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const p of fp.pads) { const hw = Math.max(p.w, p.h) / 2; bboxOf([[p.local[0] - hw, p.local[1] - hw], [p.local[0] + hw, p.local[1] + hw]], pb); }
    fp.padBox = isFinite(pb.x0) ? pb : null;
    const hb = fp.courtyard || fp.fab || fp.padBox;
    fp.hit = hb ? [[hb.x0, hb.y0], [hb.x1, hb.y0], [hb.x1, hb.y1], [hb.x0, hb.y1]].map(T) : null;
    delete fp.local; // not needed after this point
    fp.localGraphics = ctx.local;
    footprints.push(fp);
  }

  /* -- walk the board -- */
  for (const node of root) {
    if (!isList(node)) continue;
    const tag = node[0];
    if (tag === "footprint" || tag === "module") addFootprint(node);
    else if (tag.startsWith("gr_")) addGraphic(node, (p) => p, null);
    else if (tag === "segment") {
      const layer = str(child(node, "layer")[1]);
      L(layer).lines.push({ pts: [xy(child(node, "start")), xy(child(node, "end"))], w: Number(child(node, "width")[1]) });
    } else if (tag === "arc") {
      const layer = str(child(node, "layer")[1]);
      L(layer).lines.push({ pts: arcPoints(xy(child(node, "start")), xy(child(node, "mid")), xy(child(node, "end"))), w: Number(child(node, "width")[1]) });
    } else if (tag === "via") {
      const [x, y] = xy(child(node, "at"));
      const size = Number(child(node, "size")[1]);
      const drill = Number(child(node, "drill")[1]);
      const vl = child(node, "layers");
      const span = vl ? vl.slice(1).map(str) : ["F.Cu", "B.Cu"];
      const i0 = copper.indexOf(span[0]), i1 = copper.indexOf(span[span.length - 1]);
      const on = i0 >= 0 && i1 >= 0 ? copper.slice(Math.min(i0, i1), Math.max(i0, i1) + 1) : copper;
      for (const ln of on) L(ln).discs.push({ x, y, r: size / 2 });
      vias.push({ x, y, r: size / 2, drill: drill / 2 });
      holes.push({ x, y, r: drill / 2, plated: true, via: true });
    } else if (tag === "zone") {
      for (const fpoly of children(node, "filled_polygon")) {
        const ln = str(child(fpoly, "layer")[1]);
        const pts = readPts(fpoly);
        if (pts.length > 2) L(ln).zones.push(pts);
      }
    }
  }

  /* -- outline: chain Edge.Cuts segments into closed loops -- */
  const loops = [...edgeLoops];
  const segs = edgeSegs.map((s) => s.slice());
  const near = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
  while (segs.length) {
    let chain = segs.pop();
    let grown = true;
    while (grown && !near(chain[0], chain[chain.length - 1])) {
      grown = false;
      for (let k = 0; k < segs.length; k++) {
        const s = segs[k];
        const end = chain[chain.length - 1];
        if (near(end, s[0])) chain = chain.concat(s.slice(1));
        else if (near(end, s[s.length - 1])) chain = chain.concat(s.slice(0, -1).reverse());
        else if (near(chain[0], s[s.length - 1])) chain = s.slice(0, -1).concat(chain);
        else if (near(chain[0], s[0])) chain = s.slice(1).reverse().concat(chain);
        else continue;
        segs.splice(k, 1); grown = true; break;
      }
    }
    if (chain.length > 2) loops.push(chain);
  }
  if (!loops.length) throw new Error("The board file has no Edge.Cuts outline.");
  loops.sort((a, b) => Math.abs(polyArea(b)) - Math.abs(polyArea(a)));
  const outline = loops[0];
  const cutouts = loops.slice(1);
  const bbox = bboxOf(outline);

  return { outline, cutouts, bbox, layers, copper, holes, pads, vias, footprints, thickness };
}
