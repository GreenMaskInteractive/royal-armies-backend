"""Audit and optionally repair city neighbor links in age-world-cities.json."""
from __future__ import annotations

import importlib.util
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD_CITIES_PATH = ROOT / "public" / "data" / "age-world-cities.json"


def _load_border_geometry_module():
    spec = importlib.util.spec_from_file_location(
        "age_city_border_geometry", ROOT / "scripts" / "age-city-border-geometry.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def audit_world_cities(path: Path = WORLD_CITIES_PATH):
    border_geometry = _load_border_geometry_module()
    payload = json.loads(path.read_text(encoding="utf-8"))
    cities = payload["cities"]
    by_id = {city["id"]: city for city in cities}
    valid = border_geometry.compute_valid_neighbors(cities)

    false_positives: list[dict] = []
    false_negatives: list[dict] = []

    for city in cities:
        city_id = city["id"]
        listed = set(city.get("neighbors") or [])
        expected = set(valid[city_id])

        for neighbor_id in sorted(listed - expected):
            neighbor = by_id.get(neighbor_id)
            gap = (
                border_geometry.min_outline_gap(city["outlinePath"], neighbor["outlinePath"])
                if neighbor and neighbor.get("outlinePath") and city.get("outlinePath")
                else float("inf")
            )
            false_positives.append(
                {
                    "cityId": city_id,
                    "cityName": city.get("name", city_id),
                    "neighborId": neighbor_id,
                    "neighborName": neighbor.get("name", neighbor_id) if neighbor else neighbor_id,
                    "gapPx": round(gap, 2) if math.isfinite(gap) else None,
                    "reason": "missing-target" if not neighbor else "gap-too-wide",
                }
            )

        for neighbor_id in sorted(expected - listed):
            neighbor = by_id[neighbor_id]
            gap = border_geometry.min_outline_gap(city["outlinePath"], neighbor["outlinePath"])
            false_negatives.append(
                {
                    "cityId": city_id,
                    "cityName": city.get("name", city_id),
                    "neighborId": neighbor_id,
                    "neighborName": neighbor.get("name", neighbor_id),
                    "gapPx": round(gap, 2),
                }
            )

    return false_positives, false_negatives, valid


def repair_world_cities(path: Path = WORLD_CITIES_PATH) -> dict[str, int]:
    border_geometry = _load_border_geometry_module()
    payload = json.loads(path.read_text(encoding="utf-8"))
    cities = payload["cities"]
    valid = border_geometry.compute_valid_neighbors(cities)

    removed = 0
    added = 0
    for city in cities:
        before = set(city.get("neighbors") or [])
        after = set(valid[city["id"]])
        removed += len(before - after)
        added += len(after - before)
        city["neighbors"] = valid[city["id"]]

    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return {"removed": removed, "added": added, "cities": len(cities)}


def print_city_report(path: Path = WORLD_CITIES_PATH) -> None:
    border_geometry = _load_border_geometry_module()
    payload = json.loads(path.read_text(encoding="utf-8"))
    cities = sorted(payload["cities"], key=lambda city: (city.get("nationId", ""), city.get("name", "")))
    by_id = {city["id"]: city for city in cities}

    print("[report] Per-city neighbor borders (sampled outline gap):")
    for city in cities:
        neighbor_names = []
        for neighbor_id in city.get("neighbors") or []:
            neighbor = by_id.get(neighbor_id)
            if not neighbor:
                neighbor_names.append(f"{neighbor_id} (missing)")
                continue
            gap = border_geometry.min_outline_gap(city["outlinePath"], neighbor["outlinePath"])
            neighbor_names.append(f"{neighbor.get('name', neighbor_id)} ({gap:.2f}px)")
        label = ", ".join(neighbor_names) if neighbor_names else "(none)"
        print(f"  {city.get('name', city['id'])} [{city['id']}]: {label}")


def main() -> int:
    repair = "--repair" in sys.argv
    verbose = "--verbose" in sys.argv
    false_positives, false_negatives, valid = audit_world_cities()

    print(f"[audit] False positives (listed but not bordering): {len(false_positives)}")
    for row in false_positives:
        gap = row["gapPx"]
        gap_label = "n/a" if gap is None else f"{gap:.2f}px"
        print(
            f"  {row['cityName']} ({row['cityId']}) -> "
            f"{row['neighborName']} ({row['neighborId']}) [{row['reason']}, gap={gap_label}]"
        )

    print(f"[audit] False negatives (bordering but not listed): {len(false_negatives)}")
    for row in false_negatives:
        print(
            f"  {row['cityName']} ({row['cityId']}) -> "
            f"{row['neighborName']} ({row['neighborId']}) [gap={row['gapPx']:.2f}px]"
        )

    payload = json.loads(WORLD_CITIES_PATH.read_text(encoding="utf-8"))
    listed_links = sum(len(city.get("neighbors") or []) for city in payload["cities"])
    valid_links = sum(len(neighbors) for neighbors in valid.values())
    print(f"[audit] Listed directed links: {listed_links}")
    print(f"[audit] Valid directed links: {valid_links}")

    if verbose:
        print()
        print_city_report()

    if not false_positives and not false_negatives:
        print("[audit] All city neighbor links match outline borders.")
        return 0

    if repair:
        stats = repair_world_cities()
        print(
            f"[repair] Updated {stats['cities']} cities "
            f"(removed {stats['removed']} links, added {stats['added']} links)."
        )
        false_positives, false_negatives, _ = audit_world_cities()
        if false_positives or false_negatives:
            print("[repair] Remaining mismatches after repair — investigate extract pipeline.")
            return 1
        print("[repair] Neighbor graph is now fully consistent.")
        return 0

    print("[audit] Run with --repair to rewrite age-world-cities.json from outline borders.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
