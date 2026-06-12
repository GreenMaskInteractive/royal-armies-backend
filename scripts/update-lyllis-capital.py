"""Apply Duskrell/Caelithar SVG geometry and set Caelithar as Lyllis capital."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "age-world-cities.json"
ADJACENCY_PAD = 4

UPDATES = {
    "lyllis-c10": ROOT / "public" / "images" / "lyllis_duskrell.svg",
    "lyllis-c15": ROOT / "public" / "images" / "lyllis_caelithar_capital.svg",
}


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
    data = json.loads(OUT.read_text(encoding="utf-8"))
    by_id = {city["id"]: city for city in data["cities"]}

    for city_id, svg_path in UPDATES.items():
        if not svg_path.exists():
            raise SystemExit(f"Missing SVG: {svg_path}")
        geom = cluster_from_svg(svg_path)
        city = by_id[city_id]
        city["outlinePath"] = geom["outlinePath"]
        city["centroid"] = geom["centroid"]
        city["bbox"] = geom["bbox"]

    lyllis = [city for city in data["cities"] if city["nationId"] == "lyllis"]
    for city in lyllis:
        is_capital = city["id"] == "lyllis-c15"
        city["isCapital"] = is_capital
        if is_capital:
            city["settlementTier"] = "kingdom"
            city["name"] = "Caelithar"
        elif city["id"] == "lyllis-c10":
            city["name"] = "Duskrell"

    for city in lyllis:
        city["neighbors"] = [
            other["id"]
            for other in lyllis
            if other["id"] != city["id"] and boxes_touch(city, other)
        ]

    for city in lyllis:
        for other in data["cities"]:
            if other["nationId"] == city["nationId"]:
                continue
            if boxes_touch(city, other):
                if other["id"] not in city["neighbors"]:
                    city["neighbors"].append(other["id"])
                if city["id"] not in other["neighbors"]:
                    other["neighbors"].append(city["id"])

    OUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    capital = by_id["lyllis-c15"]
    print(f"Capital set: {capital['name']} ({capital['id']}) tier={capital['settlementTier']}")
    print(f"Updated geometry from: {', '.join(p.name for p in UPDATES.values())}")


if __name__ == "__main__":
    main()
