"""Remove public/images city SVG/PNG duplicates that live under Season 0."""
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
    missing_legacy: list[str] = []

    for asset in season_0.iter_season_0_city_assets():
        for legacy_path in season_0.legacy_duplicate_paths(asset.name):
            legacy_path.unlink()
            removed.append(str(legacy_path.relative_to(ROOT)))

    print(f"Removed {len(removed)} duplicate city asset(s) from public/images.")
    for line in removed:
        print(f"  - {line}")


if __name__ == "__main__":
    main()
