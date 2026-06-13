"""Extract region border paths from Region1-6 SVGs → public/data/age-world-region-paths.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "age-world-region-paths.json"


def _load_season_0_assets_module():
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "season_0_city_assets", ROOT / "scripts" / "season-0-city-assets.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

REGION_NAMES = {
    1: "Caldera Highlands",
    2: "North-Gale Woodlands",
    3: "Crescent Ridge",
    4: "Verdant Basin",
    5: "Wyrmtooth Gulf",
    6: "Dreadforge Reach",
}


def parse_paths(svg_text: str) -> list[str]:
    blocks = re.findall(r"<path\s+([^>]*?)\s*/>", svg_text, re.S | re.I)
    paths: list[str] = []
    for attrs in blocks:
        dm = re.search(r'\sd="([\s\S]*?)"', attrs, re.I)
        if dm:
            paths.append(re.sub(r"\s+", " ", dm.group(1)).strip())
    return paths


def main() -> None:
    regions = []
    for region_num, name in REGION_NAMES.items():
        season_0 = _load_season_0_assets_module()
        svg_path = season_0.resolve_region_map_svg(region_num)
        if not svg_path or not svg_path.is_file():
            svg_path = ROOT / "public" / "images" / f"Region{region_num}map.svg"
        paths = parse_paths(svg_path.read_text(encoding="utf-8"))
        regions.append(
            {
                "id": f"region-{region_num}",
                "name": name,
                "paths": paths,
            }
        )

    payload = {
        "viewBox": "0 0 1642 1642",
        "regions": regions,
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(regions)} regions to {OUT}")


if __name__ == "__main__":
    main()
