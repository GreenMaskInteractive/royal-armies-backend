"""Organize per-city SVG/PNG assets into Season 0/regions/{region}/{nation}/.

Season 0 is the canonical source for per-city assets. This script copies any
remaining legacy files from public/images into Season 0 when missing there.
Run scripts/prune-legacy-city-asset-duplicates.py afterward to remove duplicates.
"""
from __future__ import annotations

import importlib.util
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "public" / "images"
MAP_FILES = IMAGES / "Map Image Files"


def _load_season_0_module():
    spec = importlib.util.spec_from_file_location(
        "season_0_city_assets", ROOT / "scripts" / "season-0-city-assets.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

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
    season_0 = _load_season_0_module()
    OUT_ROOT = season_0.SEASON_0_REGIONS
    summary: list[str] = []
    total_files = 0

    for region_id, region_slug, nations, _region_num in season_0.REGION_REGISTRY:
        region_dir = OUT_ROOT / season_0.region_folder_name(region_id, region_slug)
        region_dir.mkdir(parents=True, exist_ok=True)

        for nation_id in nations:
            nation_dir = region_dir / nation_id
            nation_dir.mkdir(parents=True, exist_ok=True)
            prefix = "aesthine_" if nation_id == "aesthene" else f"{nation_id}_"
            sources = collect_sources(prefix)

            for src in sources:
                dest = nation_dir / src.name
                if dest.exists():
                    continue
                shutil.copy2(src, dest)
                total_files += 1

            summary.append(f"  {region_id}/{nation_id}: {len(sources)} file(s)")

    print(f"Season 0 asset tree -> {OUT_ROOT}")
    print(f"Copied {total_files} city asset(s) across {sum(len(n) for _, _, n, _ in season_0.REGION_REGISTRY)} nation folders.\n")
    for line in summary:
        print(line)


if __name__ == "__main__":
    main()
