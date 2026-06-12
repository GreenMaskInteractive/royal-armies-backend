"""Reassign city terrain tags from amnekmap.png without rebuilding city geometry."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "age-world-cities.json"
MAP_PATH = ROOT / "public" / "images" / "amnekmap.png"


def main() -> None:
    spec = importlib.util.spec_from_file_location(
        "age_terrain_from_map", ROOT / "scripts" / "age-terrain-from-map.py"
    )
    terrain = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(terrain)

    rgb = terrain.load_map_rgb(MAP_PATH)
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    for city in payload["cities"]:
        lock = terrain.NATION_TERRAIN_LOCK.get(city["nationId"])
        if lock:
            city["terrain"] = lock
        else:
            city["terrain"] = terrain.terrain_for_path(city["outlinePath"], rgb)

    for nation in payload["nations"]:
        nation_cities = [c for c in payload["cities"] if c["nationId"] == nation["id"]]
        nation["terrainTypes"] = sorted({c["terrain"] for c in nation_cities})

    DATA_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    summary: dict[str, int] = {}
    for city in payload["cities"]:
        summary[city["terrain"]] = summary.get(city["terrain"], 0) + 1
    print(f"Updated terrain for {len(payload['cities'])} cities -> {DATA_PATH}")
    print("Distribution:", summary)


if __name__ == "__main__":
    main()
