"""Remove map city geometry for all nations except Lyllis and Aesthene."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "age-world-cities.json"
KEEP_NATIONS = frozenset({"lyllis", "aesthene"})


def main() -> None:
    data = json.loads(OUT.read_text(encoding="utf-8"))
    kept_cities = [city for city in data["cities"] if city["nationId"] in KEEP_NATIONS]
    kept_ids = {city["id"] for city in kept_cities}

    for city in kept_cities:
        city["neighbors"] = [nid for nid in city.get("neighbors", []) if nid in kept_ids]

    removed = len(data["cities"]) - len(kept_cities)
    data["cities"] = kept_cities

    for nation in data["nations"]:
        if nation["id"] in KEEP_NATIONS:
            nation["cityIds"] = [cid for cid in nation.get("cityIds", []) if cid in kept_ids]
            nation["terrainTypes"] = sorted(
                {city["terrain"] for city in kept_cities if city["nationId"] == nation["id"]}
            )
        else:
            nation["cityIds"] = []
            nation["terrainTypes"] = []

    OUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Removed {removed} city records; kept {len(kept_cities)} (Lyllis + Aesthene).")


if __name__ == "__main__":
    main()
