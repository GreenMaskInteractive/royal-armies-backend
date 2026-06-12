"""Flag cities whose JSON terrain may not match visible amnekmap topology."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "age-world-cities.json"
MAP_PATH = ROOT / "public" / "images" / "amnekmap.png"

INDIVIDUAL_CITY_NATIONS = {
    "aesthene",
    "lyllis",
    "dravic",
    "vaerenth",
    "trex",
    "gorz",
    "krall",
    "aethelgard",
    "saelthine",
}

LIVE_TERRAINS = {"Forest", "Plains", "Desert", "Mountains"}
OVERLAY_TERRAINS = {
    "Forest": (52, 128, 68),
    "Plains": (126, 186, 78),
    "Desert": (210, 165, 90),
    "Mountains": (136, 118, 96),
}


def load_terrain_module():
    spec = importlib.util.spec_from_file_location(
        "age_terrain_from_map", ROOT / "scripts" / "age-terrain-from-map.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def overlay_terrain_at(overlay_rgb, centroid: dict) -> str:
    cx = int(round(centroid["x"]))
    cy = int(round(centroid["y"]))
    h, w = overlay_rgb.shape[:2]
    if not (0 <= cy < h and 0 <= cx < w):
        return "OOB"
    r, g, b = map(int, overlay_rgb[cy, cx, :3])
    if overlay_rgb[cy, cx, 3] < 32:
        return "none"
    return min(
        OVERLAY_TERRAINS.items(),
        key=lambda item: (r - item[1][0]) ** 2 + (g - item[1][1]) ** 2 + (b - item[1][2]) ** 2,
    )[0]


def centroid_terrain(terrain_mod, rgb, centroid: dict) -> str:
    cx = int(round(centroid["x"]))
    cy = int(round(centroid["y"]))
    h, w = rgb.shape[:2]
    if not (0 <= cy < h and 0 <= cx < w):
        return "OOB"
    r, g, b = map(int, rgb[cy, cx])
    gray = rgb.mean(axis=2)
    variance = terrain_mod.local_variance(gray.astype("float32"))
    label = terrain_mod.classify_pixel(r, g, b, float(variance[cy, cx]))
    if label in LIVE_TERRAINS:
        return label
    return terrain_mod.nearest_terrain(r, g, b)


def dominant_polygon_terrain(terrain_mod, outline_path: str, rgb) -> tuple[str, float, dict]:
    counts = terrain_mod.terrain_counts_for_path(outline_path, rgb)
    if not counts:
        return terrain_mod.DEFAULT_TERRAIN, 0.0, {}
    total = sum(counts.values())
    assigned = terrain_mod.terrain_for_path(outline_path, rgb)
    ranked = counts.most_common()
    winner, winner_count = ranked[0]
    share = winner_count / total
    return assigned, share, dict(counts)


def main() -> None:
    terrain_mod = load_terrain_module()
    rgb = terrain_mod.load_map_rgb(MAP_PATH)
    overlay = np.array(Image.open(ROOT / "public" / "images" / "amnekmap-terrain-overlay.png").convert("RGBA"))
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    flagged: list[dict] = []
    reviewed = 0
    for city in payload["cities"]:
        if city["nationId"] not in INDIVIDUAL_CITY_NATIONS:
            continue
        reviewed += 1
        outline = city.get("outlinePath") or ""
        assigned = city.get("terrain", "")
        poly_assigned, top_share, counts = dominant_polygon_terrain(terrain_mod, outline, rgb)
        overlay_at = overlay_terrain_at(overlay, city["centroid"])

        issues: list[str] = []
        if assigned != poly_assigned:
            issues.append(f"json!=sampler({poly_assigned})")
        if overlay_at in LIVE_TERRAINS and assigned != overlay_at:
            issues.append(f"json!=overlay({overlay_at})")
        if top_share < 0.45 and assigned in LIVE_TERRAINS:
            issues.append(f"low-confidence({top_share:.0%})")

        if issues:
            flagged.append(
                {
                    "nation": city["nationId"],
                    "id": city["id"],
                    "name": city["name"],
                    "assigned": assigned,
                    "sampler": poly_assigned,
                    "overlay": overlay_at,
                    "top_share": round(top_share, 3),
                    "counts": counts,
                    "issues": issues,
                }
            )

    print(f"Reviewed {reviewed} per-city-SVG settlements.")
    if not flagged:
        print("All terrains align with amnekmap topology sampling.")
        return

    print(f"Flagged {len(flagged)} settlements:")
    for row in sorted(flagged, key=lambda r: (r["nation"], r["name"])):
        print(
            f"  {row['nation']:12} {row['name']:16} "
            f"json={row['assigned']:10} sampler={row['sampler']:10} "
            f"overlay={row['overlay']:10} share={row['top_share']:.0%} "
            f"issues={','.join(row['issues'])}"
        )


if __name__ == "__main__":
    main()
