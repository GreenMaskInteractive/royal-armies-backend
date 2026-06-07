"""DEPRECATED — do not run against production data.

mapof*.png centroids are reference-art crops on a 1642 canvas; they do not reliably
match game-nation-paths.json world-map coordinates for the same filename. Labels on
age-world-map use nation.centroid from the JSON border paths instead.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "game-nation-paths.json"
IMAGES = ROOT / "public" / "images"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}
NATION_ASSET_SLUG = {"aesthene": "aesthine"}
MATCH_RADIUS = 55.0
PNG_MATCH_RADIUS = 90.0
BBOX_MIN_VERTEX_DELTA = 22.0


def path_metrics(d: str) -> dict[str, float] | None:
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)]
    xs, ys = nums[0::2], nums[1::2]
    count = min(len(xs), len(ys))
    if count < 2:
        return None
    min_x, max_x = min(xs[:count]), max(xs[:count])
    min_y, max_y = min(ys[:count]), max(ys[:count])
    vertex_x = sum(xs[:count]) / count
    vertex_y = sum(ys[:count]) / count
    bbox_x = (min_x + max_x) / 2
    bbox_y = (min_y + max_y) / 2
    return {
        "vertex_x": vertex_x,
        "vertex_y": vertex_y,
        "bbox_x": bbox_x,
        "bbox_y": bbox_y,
    }


def path_centroid_span(d: str) -> tuple[float, float, float] | None:
    metrics = path_metrics(d)
    if not metrics:
        return None
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)]
    xs, ys = nums[0::2], nums[1::2]
    count = min(len(xs), len(ys))
    span = max(max(xs[:count]) - min(xs[:count]), max(ys[:count]) - min(ys[:count]))
    return metrics["vertex_x"], metrics["vertex_y"], span


def svg_primary_centroid(svg_path: Path) -> tuple[float, float] | None:
    tree = ET.parse(svg_path)
    best: tuple[float, float, float] | None = None
    for path_el in tree.getroot().findall(".//svg:path", SVG_NS):
        fill = (path_el.get("fill") or "").strip().lower()
        if fill in {"", "none", "transparent", "#000", "#000000", "black"}:
            continue
        parsed = path_centroid_span(path_el.get("d") or "")
        if not parsed:
            continue
        cx, cy, span = parsed
        if best is None or span > best[2]:
            best = (cx, cy, span)
    if not best:
        return None
    return round(best[0], 1), round(best[1], 1)


def png_centroid(path: Path) -> tuple[float, float] | None:
    img = Image.open(path).convert("RGBA")
    xs, ys, count = 0.0, 0.0, 0
    px = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a > 10 and (r + g + b) > 30:
                xs += x
                ys += y
                count += 1
    if not count:
        return None
    return round(xs / count, 1), round(ys / count, 1)


def resolve_asset_slug(nation_id: str) -> str:
    return NATION_ASSET_SLUG.get(nation_id, nation_id)


def distance(ax: float, ay: float, bx: float, by: float) -> float:
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def build_asset_refs() -> list[tuple[str, float, float]]:
    refs: list[tuple[str, float, float]] = []
    for svg_path in sorted(IMAGES.glob("mapof*.svg")):
        slug = svg_path.stem.replace("mapof", "")
        svg_centroid = svg_primary_centroid(svg_path)
        png_path = IMAGES / f"mapof{slug}.png"
        png_point = png_centroid(png_path) if png_path.exists() else None
        point = png_point or svg_centroid
        if point:
            refs.append((slug, point[0], point[1]))
    return refs


def resolve_label_centroid(nation: dict, asset_refs: list[tuple[str, float, float]]) -> dict[str, float]:
    metrics = path_metrics(nation["d"])
    if not metrics:
        return dict(nation["centroid"])

    jx = nation["centroid"]["x"]
    jy = nation["centroid"]["y"]

    slug = resolve_asset_slug(nation["id"])
    named_png = IMAGES / f"mapof{slug}.png"
    if named_png.exists():
        named_point = png_centroid(named_png)
        if named_point and distance(named_point[0], named_point[1], jx, jy) <= PNG_MATCH_RADIUS:
            return {"x": named_point[0], "y": named_point[1]}

    best_ref = min(
        asset_refs,
        key=lambda ref: distance(ref[1], ref[2], jx, jy),
    )
    if distance(best_ref[1], best_ref[2], jx, jy) <= MATCH_RADIUS:
        return {"x": best_ref[1], "y": best_ref[2]}

    vertex_delta = distance(metrics["vertex_x"], metrics["vertex_y"], metrics["bbox_x"], metrics["bbox_y"])
    if vertex_delta >= BBOX_MIN_VERTEX_DELTA:
        return {"x": round(metrics["bbox_x"], 1), "y": round(metrics["bbox_y"], 1)}

    return {"x": jx, "y": jy}


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    asset_refs = build_asset_refs()
    updated = 0

    for nation in data["nations"]:
        if nation.get("kind") != "major":
            nation.pop("labelCentroid", None)
            continue
        label_centroid = resolve_label_centroid(nation, asset_refs)
        nation["labelCentroid"] = label_centroid
        if (
            label_centroid["x"] != nation["centroid"]["x"]
            or label_centroid["y"] != nation["centroid"]["y"]
        ):
            updated += 1
            print(
                f"{nation['id']:<12} centroid=({nation['centroid']['x']}, {nation['centroid']['y']})"
                f" -> label=({label_centroid['x']}, {label_centroid['y']})"
            )

    DATA_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"\nWrote labelCentroid for major nations ({updated} adjusted) to {DATA_PATH}")


if __name__ == "__main__":
    main()
