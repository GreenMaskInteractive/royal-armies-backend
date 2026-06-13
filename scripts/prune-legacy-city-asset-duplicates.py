"""Remove public/images duplicates that now live under Season 0."""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "season_0_city_assets", ROOT / "scripts" / "season-0-city-assets.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    season_0 = _load_module()
    removed: list[str] = []

    for asset in season_0.iter_season_0_city_assets():
        for legacy_path in season_0.legacy_duplicate_paths(asset.name):
            legacy_path.unlink()
            removed.append(str(legacy_path.relative_to(ROOT)))

    for _rid, _slug, _nations, region_num in season_0.REGION_REGISTRY:
        for name in (f"Region{region_num}map.svg", f"Region{region_num}map.png"):
            for legacy_path in season_0.legacy_duplicate_paths(name):
                legacy_path.unlink()
                removed.append(str(legacy_path.relative_to(ROOT)))

    for nation_id, svg_path in season_0.iter_nation_map_svgs():
        for legacy_path in season_0.legacy_duplicate_paths(svg_path.name):
            legacy_path.unlink()
            removed.append(str(legacy_path.relative_to(ROOT)))
        png_path = season_0.resolve_nation_map_png(nation_id)
        if png_path:
            for legacy_path in season_0.legacy_duplicate_paths(png_path.name):
                legacy_path.unlink()
                removed.append(str(legacy_path.relative_to(ROOT)))

    print(f"Removed {len(removed)} duplicate Season 0 asset(s) from public/images.")
    for line in removed:
        print(f"  - {line}")


if __name__ == "__main__":
    main()
