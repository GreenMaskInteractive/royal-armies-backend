"""Quick report: filled-path clusters per SVG."""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "extract", ROOT / "scripts" / "extract-nation-paths.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

for map_id, svg_path in mod.SOURCES:
    text = svg_path.read_text(encoding="utf-8")
    candidates = []
    for d in mod.parse_path_elements(text):
        for sub in mod.split_subpaths(d):
            cx, cy, span, _ = mod.centroid_span(sub)
            if span >= mod.MIN_SPAN:
                candidates.append((span, cx, cy))
    clusters = mod.dedupe_clusters(
        [(0, span, cx, cy, "") for span, cx, cy in candidates]
    )
    print(f"\n{map_id}: {len(clusters)} filled clusters")
    for span, cx, cy in sorted([(c[1], c[2], c[3]) for c in clusters], key=lambda x: (-x[0])):
        print(f"  span={span:6.1f}  ({cx:7.1f}, {cy:7.1f})")
