"""Sync all Lyllis city geometry from public/images/lyllis_*.svg into age-world-cities.json."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "age-world-cities.json"
IMAGES = ROOT / "public" / "images"
MAP_PATH = ROOT / "public" / "images" / "amnekmap.png"
ADJACENCY_PAD = 4

SLUG_TO_ID = {
    "auriven": "lyllis-c01",
    "misthalen": "lyllis-c02",
    "silvenor": "lyllis-c03",
    "vantheil": "lyllis-c04",
    "solmareth": "lyllis-c05",
    "palecrux": "lyllis-c06",
    "emberveil": "lyllis-c07",
    "glimmerath": "lyllis-c08",
    "threnoval": "lyllis-c09",
    "duskrell": "lyllis-c10",
    "nyxellen": "lyllis-c11",
    "faelengrove": "lyllis-c12",
    "cinderwane": "lyllis-c13",
    "lustravar": "lyllis-c14",
    "caelithar": "lyllis-c15",
    "caelithar_capital": "lyllis-c15",
}


def _load_terrain_module():
    spec = importlib.util.spec_from_file_location(
        "age_terrain_from_map", ROOT / "scripts" / "age-terrain-from-map.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def parse_path_elements(text: str) -> list[str]:
    blocks = re.findall(r"<path\s+([^>]*?)\s*/>", text, re.S | re.I)
    out: list[str] = []
    for attrs in blocks:
        fill_match = re.search(r'fill="([^"]*)"', attrs, re.I)
        fill_value = fill_match.group(1) if fill_match else "none"
        if not fill_value or fill_value.strip().lower() in (
            "none",
            "transparent",
            "#000",
            "#000000",
            "black",
        ):
            continue
        dm = re.search(r'\sd="([\s\S]*?)"', attrs, re.I)
        if dm:
            out.append(re.sub(r"\s+", " ", dm.group(1)).strip())
    return out


def path_metrics(d: str) -> tuple[float, float, float, float, float, float]:
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)]
    xs, ys = nums[0::2], nums[1::2]
    n = min(len(xs), len(ys))
    if n < 2:
        return 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    min_x, max_x = min(xs[:n]), max(xs[:n])
    min_y, max_y = min(ys[:n]), max(ys[:n])
    cx = sum(xs[:n]) / n
    cy = sum(ys[:n]) / n
    span = max(max_x - min_x, max_y - min_y)
    return cx, cy, span, min_x, min_y, max_x, max_y


def cluster_from_svg(svg_path: Path) -> dict:
    paths = parse_path_elements(svg_path.read_text(encoding="utf-8"))
    if not paths:
        raise SystemExit(f"No filled paths in {svg_path}")
    outline = max(paths, key=lambda d: path_metrics(d)[2])
    cx, cy, _span, min_x, min_y, max_x, max_y = path_metrics(outline)
    return {
        "outlinePath": outline,
        "centroid": {"x": round(cx, 1), "y": round(cy, 1)},
        "bbox": {
            "minX": round(min_x, 1),
            "minY": round(min_y, 1),
            "maxX": round(max_x, 1),
            "maxY": round(max_y, 1),
        },
    }


def boxes_touch(a: dict, b: dict) -> bool:
    pad = ADJACENCY_PAD
    return not (
        a["bbox"]["maxX"] + pad < b["bbox"]["minX"] - pad
        or b["bbox"]["maxX"] + pad < a["bbox"]["minX"] - pad
        or a["bbox"]["maxY"] + pad < b["bbox"]["minY"] - pad
        or b["bbox"]["maxY"] + pad < a["bbox"]["minY"] - pad
    )


def main() -> None:
    terrain_mod = _load_terrain_module()
    map_rgb = terrain_mod.load_map_rgb(MAP_PATH)
    data = json.loads(OUT.read_text(encoding="utf-8"))
    by_id = {city["id"]: city for city in data["cities"]}

    updated: list[str] = []
    for svg_path in sorted(IMAGES.glob("lyllis_*.svg")):
        slug = svg_path.stem.replace("lyllis_", "")
        city_id = SLUG_TO_ID.get(slug)
        if not city_id:
            print(f"[WARN] No city id mapping for {svg_path.name}; skipping.")
            continue
        city = by_id.get(city_id)
        if not city:
            print(f"[WARN] Missing city record {city_id}; skipping {svg_path.name}.")
            continue

        geom = cluster_from_svg(svg_path)
        city["outlinePath"] = geom["outlinePath"]
        city["centroid"] = geom["centroid"]
        city["bbox"] = geom["bbox"]
        updated.append(city_id)

    lyllis = [city for city in data["cities"] if city["nationId"] == "lyllis"]
    terrain_mod.assign_terrains_from_map(lyllis, map_rgb)

    for city in lyllis:
        is_capital = city["id"] == "lyllis-c15"
        city["isCapital"] = is_capital
        if is_capital:
            city["settlementTier"] = "kingdom"
            city["name"] = "Caelithar"

    for city in lyllis:
        city["neighbors"] = [
            other["id"]
            for other in lyllis
            if other["id"] != city["id"] and boxes_touch(city, other)
        ]

    cross_border = [c for c in data["cities"] if c["nationId"] == "aesthene"]
    for city in lyllis:
        for other in cross_border:
            if boxes_touch(city, other):
                if other["id"] not in city["neighbors"]:
                    city["neighbors"].append(other["id"])
                if city["id"] not in other["neighbors"]:
                    other["neighbors"].append(city["id"])

    OUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Synced {len(updated)} Lyllis cities from individual SVGs.")
    print("Updated:", ", ".join(updated))


if __name__ == "__main__":
    main()
