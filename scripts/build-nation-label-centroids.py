"""Build canonical label centroids for major nations from mapof SVG references."""
from __future__ import annotations

import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "game-nation-paths.json"
IMAGES = ROOT / "public" / "images"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}
MATCH_RADIUS = 45.0


def _load_season_0_assets_module():
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "season_0_city_assets", ROOT / "scripts" / "season-0-city-assets.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


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
    from PIL import Image

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

    asset_refs: list[tuple[str, float, float]] = []
    season_0 = _load_season_0_assets_module()
    for nation_id, svg_path in season_0.iter_nation_map_svgs():
        slug = season_0.nation_asset_slug(nation_id)
        centroid = svg_primary_centroid(svg_path)
        if centroid:
            asset_refs.append((slug, centroid[0], centroid[1]))

    print("Canonical labelCentroid assignments:")
    for nation in sorted(majors, key=lambda row: row["id"]):
        nation_id = nation["id"]
        jx = nation["centroid"]["x"]
        jy = nation["centroid"]["y"]
        best = min(
            asset_refs,
            key=lambda ref: ((ref[1] - jx) ** 2 + (ref[2] - jy) ** 2) ** 0.5,
        )
        slug, sx, sy = best
        dist = ((sx - jx) ** 2 + (sy - jy) ** 2) ** 0.5
        png_path = season_0.resolve_nation_map_png(nation_id)
        png = png_centroid(png_path) if png_path and png_path.exists() else None
        png_text = f" png=({png[0]},{png[1]})" if png else ""
        print(
            f"  {nation_id:<12} json=({jx},{jy}) ref=mapof{slug} ({sx},{sy}) dist={dist:.1f}{png_text}"
        )


if __name__ == "__main__":
    main()
