(() => {
  const projects = window.PROJECTS || [];
  const CATEGORIES = ["PCB design", "Semiconductor devices", "Software & simulation"];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const list = document.getElementById("project-list");
  const filtersEl = document.getElementById("filters");
  const searchEl = document.getElementById("search");
  const emptyEl = document.getElementById("empty");
  const statusEl = document.getElementById("results-status");

  const state = { category: "All", query: "" };

  /* ---------- Small helpers ---------- */
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
    [].concat(children).forEach((c) => c && node.append(c));
    return node;
  };
  const icon = (paths, viewBox = "0 0 20 20") =>
    el("span", { html: `<svg viewBox="${viewBox}" aria-hidden="true">${paths}</svg>` }).firstChild;
  const ICONS = {
    photos: '<rect x="2.5" y="4" width="15" height="12" rx="2"/><circle cx="7.5" cy="8.5" r="1.5"/><path d="M17.5 13l-4-4-7 7"/>',
    play: '<circle cx="10" cy="10" r="7.5"/><path d="M8.5 7.2v5.6l4.5-2.8z"/>',
    doc: '<path d="M11.5 2.5H5.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V7z"/><path d="M11.5 2.5V7H16"/>',
    external: '<path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V12"/><path d="M11 3h6v6M17 3l-8 8"/>',
    chevron: '<path d="M5 8l5 5 5-5"/>'
  };
  const isPdf = (url) => /\.pdf($|[?#])/i.test(url);
  const href = (url) => (/^https?:/i.test(url) ? url : encodeURI(url));
  const searchText = (p) =>
    [p.title, p.category, p.year, p.org, p.status, p.summary, p.details, (p.tags || []).join(" "), (p.specs || []).flat().join(" ")]
      .join(" ")
      .toLowerCase();

  /* ---------- Build project rows ---------- */
  function buildProject(p, index) {
    const gallery = p.gallery || [];
    let media;
    const img = el("img", { src: href(p.cover || ""), alt: "", loading: index < 2 ? "eager" : "lazy", decoding: "async" });
    img.addEventListener("error", () => { img.style.visibility = "hidden"; });

    if (gallery.length) {
      media = el("button", {
        class: "project-media",
        type: "button",
        "aria-label": `View ${gallery.length} ${gallery.length === 1 ? "image" : "images"} of ${p.title}`
      }, [img, el("span", { class: "media-tag" }, [icon(ICONS.photos), `${gallery.length} ${gallery.length === 1 ? "image" : "images"}`])]);
      media.addEventListener("click", () => Lightbox.open(gallery, 0, media));
    } else if (p.coverLink) {
      media = el("a", { class: "project-media is-link", href: p.coverLink, target: "_blank", rel: "noopener", "aria-label": `Watch ${p.title}` },
        [img, el("span", { class: "media-tag" }, [icon(ICONS.play), "Watch video"])]);
    } else {
      media = el("div", { class: "project-media is-static" }, [img]);
    }
    if (p.coverFit === "contain") media.classList.add("fit-contain");

    const meta = el("div", { class: "project-meta" });
    meta.append(el("span", { class: "year", text: p.year }));
    if (p.status) {
      meta.append(el("span", { class: "sep", "aria-hidden": "true" }));
      meta.append(el("span", { class: "status", "data-status": p.status.toLowerCase(), text: p.status }));
    }
    if (p.org) {
      meta.append(el("span", { class: "sep", "aria-hidden": "true" }));
      meta.append(el("span", { text: p.org }));
    }

    const specs = (p.specs || []).length
      ? el("dl", { class: "specs" }, p.specs.map(([k, v]) => el("div", {}, [el("dt", { text: k }), el("dd", { text: v })])))
      : null;

    const tags = (p.tags || []).length ? el("ul", { class: "tags", "aria-label": "Tools and skills" }, p.tags.map((t) => el("li", { text: t }))) : null;

    const actions = el("div", { class: "project-actions" });
    (p.links || []).forEach((l) => {
      actions.append(el("a", { class: "doc-link", href: href(l.url), target: "_blank", rel: "noopener" },
        [icon(isPdf(l.url) ? ICONS.doc : ICONS.external), l.label]));
    });

    let details = null;
    if (p.details && p.details !== p.summary) {
      const id = `details-${index}`;
      const toggle = el("button", { class: "details-toggle", type: "button", "aria-expanded": "false", "aria-controls": id },
        [el("span", { text: "Read full description" }), icon(ICONS.chevron)]);
      details = el("div", { class: "details", id }, [el("div", {}, [el("p", { text: p.details })])]);
      details.inert = true;
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(open));
        toggle.firstChild.textContent = open ? "Hide full description" : "Read full description";
        details.classList.toggle("is-open", open);
        details.inert = !open;
      });
      actions.append(toggle);
    }

    const body = el("div", { class: "project-body" }, [
      el("div", { class: "project-head" }, [el("h3", { text: p.title })]),
      meta,
      el("p", { class: "project-summary", text: p.summary || "" }),
      specs,
      tags,
      actions,
      details
    ]);

    const article = el("article", { class: "project", "data-category": p.category, "aria-label": p.title }, [media, body]);
    article.style.viewTransitionName = `project-${index}`;
    article._search = searchText(p);
    return article;
  }

  const rows = projects.map(buildProject);
  list.append(...rows);

  /* ---------- Filters ---------- */
  const counts = CATEGORIES.map((c) => [c, projects.filter((p) => p.category === c).length]).filter(([, n]) => n > 0);
  const buttons = [["All", projects.length], ...counts].map(([name, n]) => {
    const b = el("button", { class: "filter", type: "button", "aria-pressed": String(name === state.category), "data-category": name },
      [el("span", { text: name }), el("span", { class: "count", text: String(n) })]);
    b.addEventListener("click", () => {
      state.category = name;
      buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      update();
    });
    filtersEl.append(b);
    return b;
  });

  function apply(initial = false) {
    const q = state.query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    let shown = 0;
    rows.forEach((row) => {
      const inCat = state.category === "All" || row.dataset.category === state.category;
      const inQuery = words.every((w) => row._search.includes(w));
      const visible = inCat && inQuery;
      row.hidden = !visible;
      if (visible) { shown++; if (!initial) row.classList.add("is-visible"); }
    });
    emptyEl.hidden = shown !== 0;
    document.getElementById("empty-query").textContent = state.query.trim();
    statusEl.textContent = `${shown} ${shown === 1 ? "project" : "projects"} shown`;
  }

  function update() {
    if (document.startViewTransition && !reduceMotion.matches) document.startViewTransition(() => apply());
    else apply();
  }

  let searchTimer;
  searchEl.addEventListener("input", (e) => {
    state.query = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(update, 120);
  });
  document.getElementById("clear-search").addEventListener("click", () => {
    searchEl.value = "";
    state.query = "";
    update();
    searchEl.focus();
  });

  /* ---------- Reveal rows as they scroll into view ---------- */
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    rows.forEach((row) => { row.classList.add("will-reveal"); io.observe(row); });
  }

  /* ---------- Lightbox ---------- */
  const Lightbox = (() => {
    const dlg = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    const cap = document.getElementById("lightbox-caption");
    const count = document.getElementById("lightbox-count");
    const prev = document.getElementById("lightbox-prev");
    const next = document.getElementById("lightbox-next");
    let items = [], i = 0, opener = null;

    function show(n, animate) {
      i = (n + items.length) % items.length;
      const item = items[i];
      const set = () => {
        img.src = href(item.src);
        img.alt = item.caption || "";
        cap.textContent = item.caption || "";
        count.textContent = items.length > 1 ? `${i + 1} / ${items.length}` : "";
      };
      if (animate && !reduceMotion.matches) {
        img.classList.add("is-swapping");
        setTimeout(() => {
          set();
          const done = () => img.classList.remove("is-swapping");
          if (img.complete) requestAnimationFrame(done); else img.addEventListener("load", done, { once: true });
        }, 180);
      } else set();
    }
    function open(list, start, from) {
      items = list; opener = from;
      prev.hidden = next.hidden = list.length < 2;
      show(start, false);
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      document.body.style.overflow = "hidden";
    }
    function close() { dlg.close ? dlg.close() : dlg.removeAttribute("open"); }

    dlg.addEventListener("close", () => {
      document.body.style.overflow = "";
      if (opener) opener.focus();
    });
    document.getElementById("lightbox-close").addEventListener("click", close);
    prev.addEventListener("click", () => show(i - 1, true));
    next.addEventListener("click", () => show(i + 1, true));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener("keydown", (e) => {
      if (items.length < 2) return;
      if (e.key === "ArrowRight") { e.preventDefault(); show(i + 1, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(i - 1, true); }
    });
    let touchX = null;
    dlg.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener("touchend", (e) => {
      if (touchX === null || items.length < 2) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1), true);
      touchX = null;
    });
    return { open };
  })();

  /* ---------- Hero board follows the pointer a little ---------- */
  const board = document.querySelector(".board");
  const hero = document.querySelector(".hero");
  if (board && hero && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion.matches) {
    hero.addEventListener("pointermove", (e) => {
      const r = board.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      board.style.setProperty("--ry", `${(x * 14).toFixed(2)}deg`);
      board.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
    });
    hero.addEventListener("pointerleave", () => {
      board.style.setProperty("--ry", "0deg");
      board.style.setProperty("--rx", "0deg");
    });
  }

  /* ---------- Nav border once the page scrolls ---------- */
  const nav = document.querySelector(".site-nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.getElementById("year").textContent = new Date().getFullYear();
  apply(true);
})();
