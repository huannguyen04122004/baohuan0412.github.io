/*
  Interactive PCB showcase: 3D view + layer view, rendered from a .kicad_pcb file.
  Used by main.js for any project that has a `board` entry in project.js.
*/
import { loadBoard } from "./kicad.js";
import { LAYER_STYLE } from "./draw.js";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const coarse = window.matchMedia("(pointer: coarse)").matches;
const ICON = {
  expand: '<path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4"/>',
  shrink: '<path d="M7.5 3.5v4h-4M12.5 3.5v4h4M7.5 16.5v-4h-4M12.5 16.5v-4h4"/>',
  fit: '<path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4"/><circle cx="10" cy="10" r="2"/>'
};
const svg = (p) => `<svg viewBox="0 0 20 20" aria-hidden="true">${p}</svg>`;

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

export async function mountBoardViewer(root, config) {
  const fileName = config.pcb.split("/").pop();
  root.classList.add("pcb-viewer");
  root.innerHTML = `
    <div class="pcb-bar pcb-bar-top">
      <div class="pcb-tabs" role="tablist" aria-label="Board view">
        <button type="button" role="tab" class="pcb-tab" data-mode="3d" aria-selected="true">3D view</button>
        <button type="button" role="tab" class="pcb-tab" data-mode="2d" aria-selected="false">Layout</button>
      </div>
      <div class="pcb-actions">
        <button type="button" class="pcb-btn pcb-done" hidden>Done</button>
        <button type="button" class="pcb-icon pcb-fs" aria-label="Full screen">${svg(ICON.expand)}</button>
      </div>
    </div>
    <div class="pcb-stage">
      <div class="pcb-pane" data-pane="3d"></div>
      <div class="pcb-pane" data-pane="2d" hidden></div>
      <div class="pcb-tip" hidden></div>
      <div class="pcb-toast" role="status" aria-live="polite"></div>
      <div class="pcb-status"><span class="pcb-spinner" aria-hidden="true"></span><span class="pcb-status-text">Loading ${fileName}</span></div>
      <button type="button" class="pcb-activate" hidden>Tap to explore the board</button>
    </div>
    <div class="pcb-bar pcb-bar-bottom">
      <div class="pcb-controls" data-for="3d">
        <div class="pcb-seg" role="group" aria-label="Camera">
          <button type="button" class="pcb-chip" data-view="angle" aria-pressed="true">Angle</button>
          <button type="button" class="pcb-chip" data-view="top" aria-pressed="false">Top</button>
          <button type="button" class="pcb-chip" data-view="bottom" aria-pressed="false">Bottom</button>
        </div>
        <button type="button" class="pcb-chip pcb-toggle" data-parts aria-pressed="true">Parts</button>
      </div>
      <div class="pcb-controls" data-for="2d" hidden>
        <div class="pcb-layers" role="group" aria-label="Layers"></div>
        <button type="button" class="pcb-chip pcb-toggle" data-flip aria-pressed="false">Flip</button>
        <button type="button" class="pcb-icon" data-fit aria-label="Fit board to view">${svg(ICON.fit)}</button>
      </div>
      <p class="pcb-hint"></p>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const stage = $(".pcb-stage"), status = $(".pcb-status"), statusText = $(".pcb-status-text");
  const tip = $(".pcb-tip"), toast = $(".pcb-toast"), hint = $(".pcb-hint");
  const pane3d = $('[data-pane="3d"]'), pane2d = $('[data-pane="2d"]');
  let mode = "3d", view3d = null, view2d = null, board = null, active = !coarse;

  const hints = {
    "3d": coarse ? "Drag to rotate, pinch to zoom" : `Drag to rotate, right-drag to pan, ${isMac ? "⌘" : "Ctrl"} + scroll to zoom`,
    "2d": coarse ? "Drag to pan, pinch to zoom" : `Drag to pan, ${isMac ? "⌘" : "Ctrl"} + scroll to zoom, hover a part for details`
  };
  hint.textContent = hints["3d"];

  /* ---- load + parse ---- */
  try {
    const res = await fetch(config.pcb);
    if (!res.ok) throw new Error(`Couldn't load ${fileName} (HTTP ${res.status}).`);
    statusText.textContent = `Reading ${fileName}`;
    const text = await res.text();
    await new Promise((r) => setTimeout(r, 0));
    board = loadBoard(text);
  } catch (err) {
    status.classList.add("is-error");
    statusText.textContent = err.message || "This board file couldn't be read.";
    return;
  }

  /* ---- views ---- */
  async function ensure3d() {
    if (view3d || !webglOK()) return view3d;
    statusText.textContent = "Building 3D model";
    const { BoardView3D } = await import("./view3d.js");
    view3d = new BoardView3D(pane3d, board, { parts: config.parts || {} });
    view3d.onInteract = () => root.classList.add("has-interacted");
    view3d.setEnabled(active);
    return view3d;
  }
  async function ensure2d() {
    if (view2d) return view2d;
    const { LayoutView } = await import("./view2d.js");
    view2d = new LayoutView(pane2d, board, { onHover: showTip });
    view2d.wheelFree = true;     // the stage decides whether a wheel event may zoom
    view2d.enabled = active;
    buildLayerChips();
    return view2d;
  }

  function showTip(fp, p) {
    if (!fp) { tip.hidden = true; return; }
    tip.innerHTML = "";
    const b = document.createElement("strong"); b.textContent = fp.ref;
    const v = document.createElement("span"); v.textContent = fp.value;
    tip.append(b, v);
    tip.hidden = false;
    if (p) {
      const r = stage.getBoundingClientRect();
      const x = Math.min(p[0] + 14, r.width - tip.offsetWidth - 8);
      const y = p[1] + 18 + tip.offsetHeight > r.height ? p[1] - tip.offsetHeight - 10 : p[1] + 18;
      tip.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  function buildLayerChips() {
    const wrap = $(".pcb-layers");
    const names = ["F.Cu", ...board.copper.filter((c) => c !== "F.Cu" && c !== "B.Cu"), "B.Cu", "F.SilkS", "B.SilkS", "Edge.Cuts"].filter((n) => board.layers[n] || n === "Edge.Cuts");
    for (const n of names) {
      const st = LAYER_STYLE[n] || { color: "#999", label: n };
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pcb-chip pcb-layer";
      btn.style.setProperty("--swatch", st.color);
      btn.setAttribute("aria-pressed", String(view2d.visible.has(n)));
      btn.innerHTML = `<i aria-hidden="true"></i>`;
      btn.append(st.label || n);
      btn.title = n;
      btn.addEventListener("click", () => {
        const on = btn.getAttribute("aria-pressed") !== "true";
        btn.setAttribute("aria-pressed", String(on));
        view2d.setLayer(n, on);
      });
      wrap.append(btn);
    }
  }

  async function setMode(m) {
    mode = m;
    root.dataset.mode = m;
    root.querySelectorAll(".pcb-tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === m)));
    root.querySelectorAll(".pcb-controls").forEach((c) => (c.hidden = c.dataset.for !== m));
    pane3d.hidden = m !== "3d";
    pane2d.hidden = m !== "2d";
    hint.textContent = hints[m];
    tip.hidden = true;
    if (m === "2d") { await ensure2d(); view2d.resize(); }
    else { await ensure3d(); view3d?.resize(); }
    if (view3d) view3d.paused = m !== "3d";
  }

  root.querySelectorAll(".pcb-tab").forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
  root.querySelector(".pcb-tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = mode === "3d" ? "2d" : "3d";
    setMode(next);
    root.querySelector(`.pcb-tab[data-mode="${next}"]`).focus();
  });

  root.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    view3d?.setView(b.dataset.view);
  }));
  $("[data-parts]").addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
    e.currentTarget.setAttribute("aria-pressed", String(on));
    view3d?.setPartsVisible(on);
  });
  $("[data-flip]").addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
    e.currentTarget.setAttribute("aria-pressed", String(on));
    if (!view2d) return;
    // looking at the back: show bottom silkscreen instead of the (mirrored) top one
    const swap = on ? ["B.SilkS", "F.SilkS"] : ["F.SilkS", "B.SilkS"];
    view2d.setLayer(swap[0], true);
    view2d.setLayer(swap[1], false);
    root.querySelectorAll(".pcb-layer").forEach((b) => b.setAttribute("aria-pressed", String(view2d.visible.has(b.title))));
    view2d.setFlip(on);
  });
  $("[data-fit]").addEventListener("click", () => view2d?.fit());

  /* ---- scroll-wheel etiquette: plain scrolling keeps scrolling the page ---- */
  let toastTimer;
  function flash(msg) {
    toast.textContent = msg;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 1400);
  }
  stage.addEventListener("wheel", (e) => {
    const free = e.ctrlKey || e.metaKey || document.fullscreenElement === root;
    if (!free) { e.stopPropagation(); flash(`Hold ${isMac ? "⌘" : "Ctrl"} and scroll to zoom`); }
  }, { capture: true, passive: true });

  /* ---- touch: explore mode so the board doesn't trap page scrolling ---- */
  const activateBtn = $(".pcb-activate"), doneBtn = $(".pcb-done");
  function setActive(on) {
    active = on;
    root.classList.toggle("is-active", on);
    view3d?.setEnabled(on);
    if (view2d) view2d.enabled = on;
    activateBtn.hidden = on || !coarse;
    doneBtn.hidden = !on || !coarse;
  }
  activateBtn.addEventListener("click", () => setActive(true));
  doneBtn.addEventListener("click", () => setActive(false));

  /* ---- full screen ---- */
  const fsBtn = $(".pcb-fs");
  const canFs = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  if (!canFs) fsBtn.hidden = true;
  fsBtn.addEventListener("click", () => {
    if (document.fullscreenElement === root) document.exitFullscreen();
    else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  });
  document.addEventListener("fullscreenchange", () => {
    const on = document.fullscreenElement === root;
    fsBtn.innerHTML = svg(on ? ICON.shrink : ICON.expand);
    fsBtn.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
    if (on && coarse) setActive(true);
  });

  /* ---- start ---- */
  if (!webglOK()) {
    $('.pcb-tab[data-mode="3d"]').disabled = true;
    await setMode("2d");
    flash("3D needs WebGL, so this shows the layout");
  } else {
    await setMode("3d");
  }
  setActive(active);
  status.classList.add("is-done");
  root.classList.add("is-ready");
  // a single settle-in move the first time the board is on screen
  if (view3d) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { view3d.intro(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(root);
  }
  return { board, setMode };
}
