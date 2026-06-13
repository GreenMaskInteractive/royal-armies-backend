"""Resolve per-city SVG/PNG assets under Season 0/regions/."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEASON_0_REGIONS = ROOT / "Season 0" / "regions"
LEGACY_IMAGES = ROOT / "public" / "images"
LEGACY_MAP_FILES = LEGACY_IMAGES / "Map Image Files"


def resolve_nation_city_assets_dir(nation_id: str) -> Path | None:
    if not SEASON_0_REGIONS.is_dir():
        return None
    nation_key = str(nation_id or "").strip().lower()
    if not nation_key:
        return None
    for region_dir in sorted(SEASON_0_REGIONS.iterdir()):
        if not region_dir.is_dir():
            continue
        nation_dir = region_dir / nation_key
        if nation_dir.is_dir():
            return nation_dir
    return None


def iter_season_0_city_assets() -> list[Path]:
    if not SEASON_0_REGIONS.is_dir():
        return []
    assets: list[Path] = []
    for path in sorted(SEASON_0_REGIONS.rglob("*")):
        if path.is_file() and path.suffix.lower() in {".svg", ".png"}:
            assets.append(path)
    return assets


def legacy_duplicate_paths(asset_name: str) -> list[Path]:
    name = Path(asset_name).name
    matches: list[Path] = []
    for base in (LEGACY_IMAGES, LEGACY_MAP_FILES):
        candidate = base / name
        if candidate.is_file():
            matches.append(candidate)
    return matches
