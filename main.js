const grid = document.getElementById("projectGrid");
const search = document.getElementById("search");
const tagFilters = document.getElementById("tagFilters");

const state = {
  q: "",
  tag: "All"
};

function uniqueTags(projects){
  const set = new Set();
  projects.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return ["All", ...Array.from(set).sort((a,b)=>a.localeCompare(b))];
}

function makeTagButton(tag){
  const el = document.createElement("div");
  el.className = "tag" + (state.tag === tag ? " active" : "");
  el.textContent = tag;
  el.onclick = () => {
    state.tag = tag;
    render();
  };
  return el;
}

function matches(project){
  const q = state.q.trim().toLowerCase();
  const inTag = state.tag === "All" || (project.tags || []).includes(state.tag);

  if (!q) return inTag;

  const hay = [
    project.title,
    project.description,
    (project.tags || []).join(" "),
    project.year
  ].join(" ").toLowerCase();

  return inTag && hay.includes(q);
}

function card(project){
  const el = document.createElement("div");
  el.className = "card";

  const img = document.createElement("img");
  img.className = "card-media";
  img.src = project.image || "";
  img.alt = project.title;
  img.onerror = () => { img.style.display = "none"; };

  const body = document.createElement("div");
  body.className = "card-body";

  const h = document.createElement("h3");
  h.textContent = project.title;

  const p = document.createElement("p");
  p.textContent = project.description || "";

  const meta = document.createElement("div");
  meta.className = "meta";

  const year = document.createElement("span");
  year.className = "pill";
  year.textContent = project.year || "";

  meta.appendChild(year);

  (project.tags || []).forEach(t => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = t;
    meta.appendChild(pill);
  });

  const links = document.createElement("div");
  links.className = "links";

  (project.links || []).forEach(l => {
    const a = document.createElement("a");
    a.className = "small-link";
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = l.label;
    links.appendChild(a);
  });

  body.appendChild(h);
  body.appendChild(p);
  body.appendChild(meta);
  body.appendChild(links);

  el.appendChild(img);
  el.appendChild(body);
  return el;
}

function renderTags(){
  tagFilters.innerHTML = "";
  uniqueTags(window.PROJECTS).forEach(t => tagFilters.appendChild(makeTagButton(t)));
}

function render(){
  // refresh tag buttons active state
  renderTags();

  grid.innerHTML = "";
  const results = window.PROJECTS.filter(matches);

  if (results.length === 0){
    const empty = document.createElement("div");
    empty.className = "card";
    empty.style.padding = "16px";
    empty.innerHTML = `<p class="muted" style="margin:0">No projects match that search/filter.</p>`;
    grid.appendChild(empty);
    return;
  }

  results.forEach(proj => grid.appendChild(card(proj)));
}

search.addEventListener("input", (e) => {
  state.q = e.target.value;
  render();
});

document.getElementById("year").textContent = new Date().getFullYear();

render();
