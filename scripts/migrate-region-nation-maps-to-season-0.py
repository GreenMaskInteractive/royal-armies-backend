"""Move region and nation map SVG/PNG assets from public/images into Season 0."""
from __future__ import annotations

import importlib.util
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "public" / "images"


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "season_0_city_assets", ROOT / "scripts" / "season-0-city-assets.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    season_0 = _load_module()
    moved: list[str] = []

    for _rid, slug, _nations, region_num in season_0.REGION_REGISTRY:
        season_0.SEASON_0_REGIONS.mkdir(parents=True, exist_ok=True)
        region_dir = season_0.SEASON_0_REGIONS / season_0.region_folder_name(_rid, slug)
        region_dir.mkdir(parents=True, exist_ok=True)

        region_name = f"Region{region_num}map.svg"
        for src in (
            IMAGES / region_name,
            region_dir / region_name,
        ):
            dest = season_0.SEASON_0_REGIONS / region_name
            if src.is_file() and not dest.exists():
                shutil.move(str(src), str(dest))
                moved.append(str(dest.relative_to(ROOT)))
                break

        region_png_name = f"Region{region_num}map.png"
        for src in (
            IMAGES / region_png_name,
            region_dir / region_png_name,
        ):
            png_dest = season_0.SEASON_0_REGIONS / region_png_name
            if src.is_file() and not png_dest.exists():
                shutil.move(str(src), str(png_dest))
                moved.append(str(png_dest.relative_to(ROOT)))
                break

    season_0.SEASON_0_NATIONS.mkdir(parents=True, exist_ok=True)

    for _rid, region_slug, nation_ids, _num in season_0.REGION_REGISTRY:
        region_dir = season_0.SEASON_0_REGIONS / season_0.region_folder_name(_rid, region_slug)
        for nation_id in nation_ids:
            nation_dir = region_dir / nation_id
            nation_dir.mkdir(parents=True, exist_ok=True)
            asset_slug = season_0.nation_asset_slug(nation_id)
            for ext in (".svg", ".png"):
                name = f"mapof{asset_slug}{ext}"
                dest = season_0.SEASON_0_NATIONS / name
                for src in (IMAGES / name, nation_dir / name):
                    if src.is_file() and not dest.exists():
                        shutil.move(str(src), str(dest))
                        moved.append(str(dest.relative_to(ROOT)))
                        break

    print(f"Moved {len(moved)} region/nation map asset(s) into Season 0.")
    for line in moved:
        print(f"  - {line}")


if __name__ == "__main__":
    main()
