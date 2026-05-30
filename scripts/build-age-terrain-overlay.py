"""Build color-coded terrain overlay PNG from amnekmap.png topography."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "public/images/amnekmap.png"
OUT_PATH = ROOT / "public/images/amnekmap-terrain-overlay.png"


def load_terrain_module():
    spec = importlib.util.spec_from_file_location(
        "age_terrain_from_map", ROOT / "scripts/age-terrain-from-map.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    terrain = load_terrain_module()
    rgb = terrain.load_map_rgb(MAP_PATH)
    gray = rgb.mean(axis=2)
    variance = terrain.local_variance(gray)
    h, w, _ = rgb.shape
    overlay = np.zeros((h, w, 4), dtype=np.uint8)

    for y in range(h):
        for x in range(w):
            r, g, b = map(int, rgb[y, x])
            label = terrain.classify_pixel(r, g, b, float(variance[y, x]))
            if not label:
                continue
            overlay[y, x] = terrain.TERRAIN_OVERLAY_COLORS.get(label, (128, 128, 128, 168))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(overlay, mode="RGBA").save(OUT_PATH, optimize=True)
    print(f"Wrote terrain overlay -> {OUT_PATH}")


if __name__ == "__main__":
    main()
