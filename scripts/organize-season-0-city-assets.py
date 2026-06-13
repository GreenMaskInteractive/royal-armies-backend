"""Organize per-city SVG/PNG assets into Season 0/regions/{region}/{nation}/."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "public" / "images"
MAP_FILES = IMAGES / "Map Image Files"
OUT_ROOT = ROOT / "Season 0" / "regions"

REGIONS = [
    ("region-1", "caldera-highlands", ["trex", "gorz", "lyllis"]),
    ("region-2", "north-gale-woodlands", ["aethelgard", "krall", "saelthine"]),
    ("region-3", "crescent-ridge", ["dravic", "aesthene", "vaerenth"]),
    ("region-4", "verdant-basin", ["thruun", "zevros"]),
    ("region-5", "wyrmtooth-gulf", ["vaelior", "skaros"]),
    ("region-6", "dreadforge-reach", ["mynor", "khaerant"]),
]

# Nation id -> filename prefix for per-city assets (matches extract-age-city-paths.py).
NATION_PREFIX = {
    "aesthene": "aesthine_",
    "lyllis": "lyllis_",
    "dravic": "dravic_",
    "vaerenth": "vaerenth_",
    "trex": "trex_",
    "gorz": "gorz_",
    "krall": "krall_",
    "aethelgard": "aethelgard_",
    "saelthine": "saelthine_",
    "thruun": "thruun_",
    "zevros": "zevros_",
    "vaelior": "vaelior_",
    "skaros": "skaros_",
    "mynor": "mynor_",
    "khaerant": "khaerant_",
}

CITIES_SHEET = re.compile(r"cities\.(png|svg)$", re.I)


def is_city_asset(path: Path, prefix: str) -> bool:
    name = path.name.lower()
    if not name.startswith(prefix.lower()):
        return False
    if CITIES_SHEET.search(name):
        return False
    if path.suffix.lower() not in {".png", ".svg"}:
        return False
    return True


def collect_sources(prefix: str) -> list[Path]:
    found: dict[str, Path] = {}
    for base in (IMAGES, MAP_FILES):
        if not base.is_dir():
            continue
        for path in base.iterdir():
            if not path.is_file() or not is_city_asset(path, prefix):
                continue
            key = path.name.lower()
            # Prefer public/images over Map Image Files when both exist.
            if key not in found or base == IMAGES:
                found[key] = path
    return sorted(found.values(), key=lambda p: p.name.lower())


def main() -> None:
    summary: list[str] = []
    total_files = 0

    for region_id, region_slug, nations in REGIONS:
        region_dir = OUT_ROOT / f"{region_id}-{region_slug}"
        region_dir.mkdir(parents=True, exist_ok=True)

        for nation_id in nations:
            nation_dir = region_dir / nation_id
            nation_dir.mkdir(parents=True, exist_ok=True)
            prefix = NATION_PREFIX[nation_id]
            sources = collect_sources(prefix)

            for src in sources:
                dest = nation_dir / src.name
                shutil.copy2(src, dest)
                total_files += 1

            summary.append(f"  {region_id}/{nation_id}: {len(sources)} file(s)")

    print(f"Season 0 asset tree -> {OUT_ROOT}")
    print(f"Copied {total_files} city asset(s) across {sum(len(n) for _, _, n in REGIONS)} nation folders.\n")
    for line in summary:
        print(line)


if __name__ == "__main__":
    main()
