"""Resolve Season 0 region/nation/city asset paths."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEASON_0_ROOT = ROOT / "Season 0"
SEASON_0_REGIONS = SEASON_0_ROOT / "regions"
LEGACY_IMAGES = ROOT / "public" / "images"
LEGACY_MAP_FILES = LEGACY_IMAGES / "Map Image Files"

# region_id, folder slug, nation ids, region map number
REGION_REGISTRY: list[tuple[str, str, list[str], int]] = [
    ("region-1", "caldera-highlands", ["trex", "gorz", "lyllis"], 1),
    ("region-2", "north-gale-woodlands", ["aethelgard", "krall", "saelthine"], 2),
    ("region-3", "crescent-ridge", ["dravic", "aesthene", "vaerenth"], 3),
    ("region-4", "verdant-basin", ["thruun", "zevros"], 4),
    ("region-5", "wyrmtooth-gulf", ["vaelior", "skaros"], 5),
    ("region-6", "dreadforge-reach", ["mynor", "khaerant"], 6),
]

NATION_ASSET_SLUG: dict[str, str] = {
    "aesthene": "aesthine",
}

NATION_TO_REGION: dict[str, str] = {}
for region_id, region_slug, nation_ids, _region_num in REGION_REGISTRY:
    for nation_id in nation_ids:
        NATION_TO_REGION[nation_id] = region_id


def region_folder_name(region_id: str, region_slug: str | None = None) -> str:
    region_key = str(region_id or "").strip().lower()
    if region_slug:
        return f"{region_key}-{region_slug}"
    for rid, slug, _nations, _num in REGION_REGISTRY:
        if rid == region_key:
            return f"{rid}-{slug}"
    return region_key


def resolve_region_dir(region_id: str) -> Path | None:
    region_key = str(region_id or "").strip().lower()
    if not region_key or not SEASON_0_REGIONS.is_dir():
        return None
    for rid, slug, _nations, _num in REGION_REGISTRY:
        if rid == region_key:
            path = SEASON_0_REGIONS / region_folder_name(rid, slug)
            return path if path.is_dir() else None
    return None


def resolve_region_dir_by_num(region_num: int) -> Path | None:
    for rid, slug, _nations, num in REGION_REGISTRY:
        if num == region_num:
            path = SEASON_0_REGIONS / region_folder_name(rid, slug)
            return path if path.is_dir() else None
    return None


def nation_asset_slug(nation_id: str) -> str:
    nation_key = str(nation_id or "").strip().lower()
    return NATION_ASSET_SLUG.get(nation_key, nation_key)


def resolve_nation_city_assets_dir(nation_id: str) -> Path | None:
    region_id = NATION_TO_REGION.get(str(nation_id or "").strip().lower())
    if not region_id:
        return None
    region_dir = resolve_region_dir(region_id)
    if not region_dir:
        return None
    nation_dir = region_dir / str(nation_id).strip().lower()
    return nation_dir if nation_dir.is_dir() else None


def resolve_region_map_svg(region_num: int) -> Path | None:
    region_dir = resolve_region_dir_by_num(region_num)
    if not region_dir:
        return None
    candidate = region_dir / f"Region{region_num}map.svg"
    return candidate if candidate.is_file() else None


def resolve_nation_map_svg(nation_id: str) -> Path | None:
    nation_dir = resolve_nation_city_assets_dir(nation_id)
    if not nation_dir:
        return None
    slug = nation_asset_slug(nation_id)
    candidate = nation_dir / f"mapof{slug}.svg"
    return candidate if candidate.is_file() else None


def resolve_nation_map_png(nation_id: str) -> Path | None:
    nation_dir = resolve_nation_city_assets_dir(nation_id)
    if not nation_dir:
        return None
    slug = nation_asset_slug(nation_id)
    candidate = nation_dir / f"mapof{slug}.png"
    return candidate if candidate.is_file() else None


def iter_nation_map_svgs() -> list[tuple[str, Path]]:
    found: list[tuple[str, Path]] = []
    for _rid, _slug, nation_ids, _num in REGION_REGISTRY:
        for nation_id in nation_ids:
            svg_path = resolve_nation_map_svg(nation_id)
            if svg_path:
                found.append((nation_id, svg_path))
    return found


def iter_season_0_city_assets() -> list[Path]:
    if not SEASON_0_REGIONS.is_dir():
        return []
    assets: list[Path] = []
    for path in sorted(SEASON_0_REGIONS.rglob("*")):
        if not path.is_file():
            continue
        name = path.name.lower()
        if path.suffix.lower() not in {".svg", ".png"}:
            continue
        if name.startswith("region") and name.endswith("map.svg"):
            continue
        if name.startswith("mapof"):
            continue
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


def public_nation_map_svg_url(nation_id: str) -> str:
    region_id = NATION_TO_REGION.get(str(nation_id or "").strip().lower())
    if not region_id:
        slug = nation_asset_slug(nation_id)
        return f"images/mapof{slug}.svg"
    region_slug = next(slug for rid, slug, _n, _num in REGION_REGISTRY if rid == region_id)
    nation_key = str(nation_id).strip().lower()
    slug = nation_asset_slug(nation_id)
    folder = region_folder_name(region_id, region_slug)
    return f"season-0/regions/{folder}/{nation_key}/mapof{slug}.svg"
