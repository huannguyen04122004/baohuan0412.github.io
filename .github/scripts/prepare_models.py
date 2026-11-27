#!/usr/bin/env python3
"""
Get every 3D model a board needs ready for `kicad-cli pcb export glb`, and record what's missing.

For each boards/*.kicad_pcb:
  * models from KiCad's standard library (${KICADn_3DMODEL_DIR}/...) are downloaded into .kicad-3d/
  * models from the project (${KIPRJMOD}/...) are expected next to the board file, e.g. boards/3D_Models/
  * writes boards/<name>.models.json, which the website reads to decide whether to show the GLB
"""
import json, re, sys, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIB_DIR = ROOT / ".kicad-3d"
LIB_URL = "https://gitlab.com/kicad/libraries/kicad-packages3D/-/raw/{branch}/{path}"
BRANCHES = ["master", "10.0", "9.0"]

def footprints(text):
    # top-level footprint blocks start with a single tab
    parts = re.split(r"\n\t\(footprint ", text)
    for block in parts[1:]:
        ref = re.search(r'\(property "Reference" "([^"]*)"', block)
        models = re.findall(r'\(model "([^"]+)"', block)
        hidden = set(re.findall(r'\(model "([^"]+)"(?:(?!\(model ).)*?\(hide yes\)', block, re.S))
        yield (ref.group(1) if ref else "?"), [m for m in models if m not in hidden]

def candidates(rel):
    stem, ext = rel.rsplit(".", 1) if "." in rel else (rel, "")
    exts = [ext] + [e for e in ("step", "stp", "STEP", "wrl") if e != ext]
    return [f"{stem}.{e}" for e in exts]

def fetch_lib(rel):
    for cand in candidates(rel):
        dest = LIB_DIR / cand
        if dest.exists():
            return True
        for br in BRANCHES:
            url = LIB_URL.format(branch=br, path=urllib.parse.quote(cand))
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    data = r.read()
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
                print(f"  downloaded {cand} ({len(data)//1024} KB, {br})")
                return True
            except Exception:
                continue
    return False

def main():
    boards = sorted((ROOT / "boards").glob("*.kicad_pcb"))
    if not boards:
        print("No boards/*.kicad_pcb files found.")
        return
    for pcb in boards:
        print(f"{pcb.name}:")
        text = pcb.read_text(encoding="utf-8", errors="replace")
        found, missing = {}, {}
        for ref, models in footprints(text):
            for m in models:
                lib = re.match(r"\$\{KICAD\d*_3DMODEL_DIR\}/(.+)", m)
                prj = re.match(r"\$\{KIPRJMOD\}/(.+)", m)
                if lib:
                    ok = fetch_lib(lib.group(1))
                elif prj:
                    ok = any((pcb.parent / c).exists() for c in candidates(prj.group(1)))
                else:
                    ok = Path(m).exists()
                (found if ok else missing).setdefault(ref, []).append(m)
        for ref, ms in missing.items():
            for m in ms:
                print(f"  MISSING {ref}: {m}")
        manifest = {"board": pcb.name, "complete": not missing, "missing": missing,
                    "found": sum(len(v) for v in found.values())}
        pcb.with_suffix(".models.json").write_text(json.dumps(manifest, indent=2))
        print(f"  {manifest['found']} models ready, {sum(len(v) for v in missing.values())} missing")

if __name__ == "__main__":
    sys.exit(main())
