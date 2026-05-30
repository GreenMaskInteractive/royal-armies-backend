"""Inject filtered region paths from Regionmap1.svg into game.html #game-region-map-svg."""
from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "public" / "game.html"
SOURCE_SVG = ROOT / "public" / "images" / "Regionmap1.svg"
EXTRACT_SCRIPT = ROOT / "scripts" / "extract-major-region-paths.py"

SVG_PATTERN = re.compile(
    r'(<svg\s[^>]*id="game-region-map-svg"[^>]*>)(.*?)(</svg>)',
    re.S,
)


def load_extract_module():
    spec = importlib.util.spec_from_file_location("extract_major_region_paths", EXTRACT_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["extract_major_region_paths"] = mod
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    if not SOURCE_SVG.is_file():
        raise SystemExit(f"Region map SVG not found: {SOURCE_SVG}")

    mod = load_extract_module()
    text = SOURCE_SVG.read_text(encoding="utf-8")
    labeled, _path_count, _subpath_count, _dropped = mod.extract_labeled_regions(text)
    if not labeled:
        raise SystemExit(f"No major region paths extracted from {SOURCE_SVG.name}")

    fragment = mod.build_fragment(labeled)

    html = GAME.read_text(encoding="utf-8")
    match = SVG_PATTERN.search(html)
    if not match:
        raise SystemExit("game-region-map-svg block not found in game.html")

    updated = SVG_PATTERN.sub(
        lambda m: f"{m.group(1)}\n{fragment}\n                        {m.group(3)}",
        html,
        count=1,
    )
    GAME.write_text(updated, encoding="utf-8")
    print(f"Injected {len(labeled)} paths from {SOURCE_SVG.name} into {GAME}")
    for rid, _attrs, d in labeled:
        print(f"  {rid} (d_len={len(d)})")


if __name__ == "__main__":
    main()
