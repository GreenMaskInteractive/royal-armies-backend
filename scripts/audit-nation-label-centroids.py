"""Audit nation labelCentroid vs JSON centroid, named mapof PNG/SVG, and world-map path bbox."""
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


def path_metrics(d: str) -> dict[str, float] | None:
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)]
    xs, ys = nums[0::2], nums[1::2]
    count = min(len(xs), len(ys))
    if count < 2:
        return None
    min_x, max_x = min(xs[:count]), max(xs[:count])
    min_y, max_y = min(ys[:count]), max(ys[:count])
    return {
        "vertex_x": sum(xs[:count]) / count,
        "vertex_y": sum(ys[:count]) / count,
        "bbox_x": (min_x + max_x) / 2,
        "bbox_y": (min_y + max_y) / 2,
    }


def png_centroid(path: Path) -> tuple[float, float, int, int] | None:
    img = Image.open(path).convert("RGBA")
    xs = ys = count = 0.0
    px = img.load()
    width, height = img.size
    c = 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a > 10 and (r + g + b) > 30:
                xs += x
                ys += y
                c += 1
    if not c:
        return None
    return round(xs / c, 1), round(ys / c, 1), width, height


def svg_world_centroid(svg_path: Path) -> tuple[float, float] | None:
    tree = ET.parse(svg_path)
    best = None
    for path_el in tree.getroot().findall(".//svg:path", SVG_NS):
        fill = (path_el.get("fill") or "").strip().lower()
        if fill in {"", "none", "transparent", "#000", "#000000", "black"}:
            continue
        nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", path_el.get("d") or "")]
        xs, ys = nums[0::2], nums[1::2]
        count = min(len(xs), len(ys))
        if count < 2:
            continue
        cx = sum(xs[:count]) / count
        cy = sum(ys[:count]) / count
        span = max(max(xs[:count]) - min(xs[:count]), max(ys[:count]) - min(ys[:count]))
        if best is None or span > best[2]:
            best = (cx, cy, span)
    if not best:
        return None
    return round(best[0], 1), round(best[1], 1)


def dist(ax: float, ay: float, bx: float, by: float) -> float:
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    majors = [n for n in data["nations"] if n.get("kind") == "major"]

    print(f"{'Nation':<12} {'centroid':>14} {'labelCentroid':>16} {'path bbox':>14} {'named SVG@world':>16} {'PNG px c':>14}")
    print("-" * 100)

    for nation in sorted(majors, key=lambda n: n["id"]):
        nid = nation["id"]
        slug = NATION_ASSET_SLUG.get(nid, nid)
        jc = nation["centroid"]
        lc = nation.get("labelCentroid", jc)
        metrics = path_metrics(nation["d"])
        bbox = f"({metrics['bbox_x']:.0f},{metrics['bbox_y']:.0f})" if metrics else "n/a"

        svg_path = IMAGES / f"mapof{slug}.svg"
        png_path = IMAGES / f"mapof{slug}.png"
        svg_c = svg_world_centroid(svg_path) if svg_path.exists() else None
        png_c = png_centroid(png_path) if png_path.exists() else None

        svg_str = f"({svg_c[0]:6.1f},{svg_c[1]:6.1f})" if svg_c else "missing"
        png_str = f"({png_c[0]:5.0f},{png_c[1]:5.0f}) {png_c[2]}²" if png_c else "missing"

        d_label_json = dist(lc["x"], lc["y"], jc["x"], jc["y"])
        flag = " ***" if d_label_json > 25 else ""

        print(
            f"{nid:<12} ({jc['x']:6.1f},{jc['y']:6.1f})"
            f" ({lc['x']:6.1f},{lc['y']:6.1f}){flag}"
            f" {bbox:>14} {svg_str:>16} {png_str:>14}"
        )

        if svg_c:
            d_svg_j = dist(svg_c[0], svg_c[1], jc["x"], jc["y"])
            if d_svg_j > 40:
                print(f"             named SVG world coords differ from JSON centroid by {d_svg_j:.0f}px")
        if png_c and metrics:
            d_png_j = dist(png_c[0], png_c[1], jc["x"], jc["y"])
            if d_png_j > 90:
                print(f"             PNG pixel centroid is NOT world-map coords (delta {d_png_j:.0f}px from JSON)")


if __name__ == "__main__":
    main()
