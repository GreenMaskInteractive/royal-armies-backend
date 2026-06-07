"""Compare major-nation label centroids in game-nation-paths.json vs mapof*.png references."""
from __future__ import annotations

import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "game-nation-paths.json"
IMAGES = ROOT / "public" / "images"
NATION_ASSET_SLUG = {"aesthene": "aesthine"}
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def path_centroid_span(d: str) -> tuple[float, float, float] | None:
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)]
    xs, ys = nums[0::2], nums[1::2]
    count = min(len(xs), len(ys))
    if count < 2:
        return None
    cx = sum(xs[:count]) / count
    cy = sum(ys[:count]) / count
    span = max(max(xs[:count]) - min(xs[:count]), max(ys[:count]) - min(ys[:count]))
    return cx, cy, span


def resolve_asset_slug(nation_id: str) -> str:
    return NATION_ASSET_SLUG.get(nation_id, nation_id)


def svg_primary_centroid(nation_id: str) -> tuple[float, float] | None:
    svg_path = IMAGES / f"mapof{resolve_asset_slug(nation_id)}.svg"
    if not svg_path.exists():
        return None

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


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    majors = [n for n in data["nations"] if n.get("kind") == "major"]

    print(f"{'Nation':<12} {'JSON label':<18} {'SVG ref':<18} {'PNG ref':<18} {'dSVG':>7} {'dPNG':>7}")
    print("-" * 86)
    updates: dict[str, tuple[float, float]] = {}
    for nation in sorted(majors, key=lambda row: row["id"]):
        nation_id = nation["id"]
        jx = nation["centroid"]["x"]
        jy = nation["centroid"]["y"]
        slug = resolve_asset_slug(nation_id)
        svg_ref = svg_primary_centroid(nation_id)
        png_path = IMAGES / f"mapof{slug}.png"
        png_ref = png_centroid(png_path) if png_path.exists() else None

        sx, sy = svg_ref if svg_ref else (None, None)
        px, py = png_ref if png_ref else (None, None)
        d_svg = ((sx - jx) ** 2 + (sy - jy) ** 2) ** 0.5 if svg_ref else None
        d_png = ((px - jx) ** 2 + (py - jy) ** 2) ** 0.5 if png_ref else None

        svg_text = f"({sx:7.1f},{sy:7.1f})" if svg_ref else "missing"
        png_text = f"({px:7.1f},{py:7.1f})" if png_ref else "missing"
        d_svg_text = f"{d_svg:7.1f}" if d_svg is not None else "   n/a"
        d_png_text = f"{d_png:7.1f}" if d_png is not None else "   n/a"
        print(f"{nation_id:<12} ({jx:7.1f},{jy:7.1f})  {svg_text}  {png_text}  {d_svg_text}  {d_png_text}")

        ref = svg_ref or png_ref
        if not ref:
            continue
        rx, ry = ref
        delta = ((rx - jx) ** 2 + (ry - jy) ** 2) ** 0.5
        if delta > 25:
            updates[nation_id] = (rx, ry)

    print(f"\nNations needing label update: {len(updates)}")
    for nation_id, (px, py) in sorted(updates.items()):
        print(f"  {nation_id}: {px}, {py}")


if __name__ == "__main__":
    main()
