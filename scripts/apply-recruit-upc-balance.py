#!/usr/bin/env python3
"""Apply provisions-curve recruit UPC values to unit-purchase-catalog.json."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "public" / "data" / "unit-purchase-catalog.json"

# Locked-in provisions curve: rank 1 = 132 prov, +110/rank, tier-1 rank ref = 11 UPC.
# PvP uses lower UPC so a dedicated PvP buyer fields more units in counter-matchups.
UPC_LADDER = {
    "rank": {"app": 11, "std": 20, "vet": 31, "mst": 44, "leg": 55, "elite": 68},
    "pvp": {"app": 8, "std": 14, "vet": 22, "mst": 31, "leg": 40, "elite": 50},
    "both": {"app": 9, "std": 16, "vet": 25, "mst": 36, "leg": 48, "elite": 59},
}

MAX_BATCH = 15


def resolve_role(unit):
    role = str(unit.get("unitRole") or "rank").strip().lower()
    if role in UPC_LADDER:
        return role
    return "rank"


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    updated = 0

    for unit in catalog.get("units", []):
        role = resolve_role(unit)
        ladder = UPC_LADDER[role]
        stats = unit.get("stats") or {}
        for promo_key in stats:
            if promo_key in ladder:
                if stats[promo_key].get("upc") != ladder[promo_key]:
                    stats[promo_key]["upc"] = ladder[promo_key]
                    updated += 1

    meta = catalog.setdefault("meta", {})
    meta["version"] = 4
    meta["recruitBalance"] = {
        "maxBatchQuantity": MAX_BATCH,
        "swarmRecruitMaxUpc": 11,
        "swarmRecruitMaxBatchQuantity": 999,
        "rank1BaseProvisions": 132,
        "rankUpPayoutProvisions": 110,
        "tier1ReferenceUpc": 11,
        "upcLadderByRole": UPC_LADDER,
        "notes": (
            "Tier-1 rank and PvP swarm units skip the 15 batch cap for training battles. "
            "Stronger tier 2+ recruits stay capped at 15 per purchase."
        ),
    }

    CATALOG_PATH.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Updated {updated} UPC values; catalog version {meta['version']}")


if __name__ == "__main__":
    main()
