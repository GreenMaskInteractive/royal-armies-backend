"""Match mapof*.svg asset centroids to game-nation-paths major nations."""
from __future__ import annotations

import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "game-nation-paths.json"
IMAGES = ROOT / "public" / "images"
NATION_ASSET_SLUG = {"aesthene": "aesthine"}
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def largest_filled_centroid(svg_path: Path) -> tuple[float, float, float] | None:
    tree = ET.parse(svg_path)
    best: tuple[float, float, float] | None = None
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
    return best


def nation_id_from_slug(slug: str) -> str:
    if slug == "aesthine":
        return "aesthene"
    return slug


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    majors = {
        nation["id"]: nation
        for nation in data["nations"]
        if nation.get("kind") == "major"
    }

    print("Asset filename -> nearest JSON nation by territory centroid:")
    for svg_path in sorted(IMAGES.glob("mapof*.svg")):
        slug = svg_path.stem.replace("mapof", "")
        centroid = largest_filled_centroid(svg_path)
        if not centroid:
            continue
        cx, cy, _span = centroid
        best_id = min(
            majors,
            key=lambda nation_id: (
                (majors[nation_id]["centroid"]["x"] - cx) ** 2
                + (majors[nation_id]["centroid"]["y"] - cy) ** 2
            )
            ** 0.5,
        )
        nation = majors[best_id]
        dist = (
            (nation["centroid"]["x"] - cx) ** 2
            + (nation["centroid"]["y"] - cy) ** 2
        ) ** 0.5
        expected_id = nation_id_from_slug(slug)
        ok = expected_id == best_id and dist < 40
        print(
            f"  mapof{slug}.svg @ ({cx:6.0f},{cy:6.0f})"
            f" -> {best_id} (dist {dist:4.0f})"
            f"  filename {'OK' if ok else 'MISMATCH (expected ' + expected_id + ')'}"
        )


if __name__ == "__main__":
    main()
