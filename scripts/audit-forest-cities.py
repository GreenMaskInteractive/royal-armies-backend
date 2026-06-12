"""Audit cities labeled Forest — share of canopy-like pixels vs overlay."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "t", ROOT / "scripts" / "age-terrain-from-map.py"
)
t = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t)

OVERLAY = {
    "Forest": (52, 128, 68),
    "Plains": (126, 186, 78),
    "Desert": (210, 165, 90),
    "Mountains": (136, 118, 96),
}


def overlay_label(ov, x: int, y: int) -> str:
    r, g, b, a = ov.getpixel((x, y))
    if a < 32:
        return "none"
    return min(
        OVERLAY.items(),
        key=lambda item: (r - item[1][0]) ** 2 + (g - item[1][1]) ** 2 + (b - item[1][2]) ** 2,
    )[0]


def overlay_counts_for_path(outline: str, ov) -> dict[str, int]:
    w, h = ov.size
    mask = t.polygon_core_mask((w, h), outline)
    if not mask.any():
        mask = t.polygon_mask((w, h), outline)
    counts: dict[str, int] = {}
    for y, x in zip(*__import__("numpy").where(mask)):
        label = overlay_label(ov, int(x), int(y))
        if label in t.LIVE_TERRAINS:
            counts[label] = counts.get(label, 0) + 1
    return counts


def main() -> None:
    rgb = t.load_map_rgb(ROOT / "public/images/amnekmap.png")
    ov = Image.open(ROOT / "public/images/amnekmap-terrain-overlay.png").convert("RGBA")
    data = json.loads((ROOT / "public/data/age-world-cities.json").read_text(encoding="utf-8"))
    forest_cities = [c for c in data["cities"] if c.get("terrain") == "Forest"]
    print(f"Forest-labeled cities: {len(forest_cities)}")
    suspicious: list[tuple] = []
    for city in sorted(forest_cities, key=lambda c: (c["nationId"], c["name"])):
        counts = dict(t.terrain_counts_for_path(city["outlinePath"], rgb))
        total = sum(counts.values()) or 1
        forest_share = counts.get("Forest", 0) / total
        ocounts = overlay_counts_for_path(city["outlinePath"], ov)
        ototal = sum(ocounts.values()) or 1
        overlay_forest = ocounts.get("Forest", 0) / ototal
        cx = int(round(city["centroid"]["x"]))
        cy = int(round(city["centroid"]["y"]))
        cent = overlay_label(ov, cx, cy)
        if forest_share < 0.5 or overlay_forest < 0.35:
            suspicious.append(
                (city["nationId"], city["name"], forest_share, overlay_forest, cent, counts, ocounts)
            )
    print(f"Suspicious (low forest share): {len(suspicious)}")
    for nation, name, fs, ofs, cent, counts, ocounts in suspicious:
        print(
            f"  {nation:12} {name:16} sampler_forest={fs:.0%} overlay_forest={ofs:.0%} "
            f"centroid_overlay={cent} sampler={counts} overlay={ocounts}"
        )


if __name__ == "__main__":
    main()
