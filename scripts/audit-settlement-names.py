"""Cross-reference settlement names across nations for exact and near duplicates."""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
WORLD_CITIES_PATH = DATA / "age-world-cities.json"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def compact_stem(s: str) -> str:
    """Collapse likely suffix variants to catch Palevat/Palecrux-style pairs."""
    n = norm(s)
    suffixes = (
        "areth",
        "aron",
        "elis",
        "ellen",
        "gram",
        "grim",
        "iron",
        "alis",
        "aris",
        "athon",
        "crux",
        "crest",
        "vault",
        "vat",
        "rek",
        "rell",
        "thor",
        "var",
        "ven",
        "von",
        "wyn",
        "rix",
        "is",
        "on",
        "or",
        "el",
        "en",
        "ar",
        "eth",
        "ix",
        "us",
        "am",
        "an",
    )
    for suffix in suffixes:
        if n.endswith(suffix) and len(n) > len(suffix) + 3:
            return n[: -len(suffix)]
    return n


def levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        return levenshtein(b, a)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            curr.append(
                min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (ca != cb))
            )
        prev = curr
    return prev[-1]


def load_entries(world_path: Path | None = None) -> list[dict]:
    entries: list[dict] = []
    world_file = world_path or WORLD_CITIES_PATH

    if world_file.exists():
        world = json.loads(world_file.read_text(encoding="utf-8"))
        for city in world.get("cities", []):
            entries.append(
                {
                    "name": city["name"],
                    "nationId": city.get("nationId", ""),
                    "source": "age-world-cities.json",
                    "id": city.get("id", ""),
                }
            )
        for nation in world.get("nations", []):
            entries.append(
                {
                    "name": nation["name"],
                    "nationId": nation.get("id", ""),
                    "source": "age-world-cities.json:nation",
                    "id": nation.get("id", ""),
                }
            )

    for seeds_path in sorted(DATA.glob("*-city-name-seeds.json")):
        seeds = json.loads(seeds_path.read_text(encoding="utf-8"))
        source = seeds_path.name
        nation_id = seeds.get("nationId", "")
        for city in seeds.get("cities", []):
            entries.append(
                {
                    "name": city["name"],
                    "nationId": nation_id,
                    "source": source,
                    "id": city.get("slot", ""),
                }
            )

    amp_path = ROOT / "public" / "age-movement-panel.js"
    if amp_path.exists():
        amp = amp_path.read_text(encoding="utf-8")
        for match in re.finditer(
            r"\{ id: '([^']+)', name: '([^']+)', nationId: '([^']+)'", amp
        ):
            entries.append(
                {
                    "name": match.group(2),
                    "nationId": match.group(3),
                    "source": "age-movement-panel.js",
                    "id": match.group(1),
                }
            )

    return entries


def find_conflicts(entries: list[dict]) -> list[dict]:
    conflicts: list[dict] = []
    for i, a in enumerate(entries):
        for b in entries[i + 1 :]:
            if a["name"] == b["name"] and a["source"] == b["source"]:
                continue
            # Same settlement mirrored in world JSON + movement panel is expected.
            if (
                a["nationId"]
                and a["nationId"] == b["nationId"]
                and norm(a["name"]) == norm(b["name"])
            ):
                continue
            an, bn = norm(a["name"]), norm(b["name"])
            # City must not mirror another nation's name (e.g. "Krall" as a Dravic town).
            if a["source"].endswith(":nation") and not b["source"].endswith(":nation"):
                if an == bn or an in bn or bn in an:
                    conflicts.append({"a": a, "b": b, "reasons": ["nation-name-collision"]})
                    continue
            if b["source"].endswith(":nation") and not a["source"].endswith(":nation"):
                if an == bn or an in bn or bn in an:
                    conflicts.append({"a": a, "b": b, "reasons": ["nation-name-collision"]})
                    continue
            reasons: list[str] = []
            if an == bn:
                reasons.append("exact-normalized")
            elif an in bn or bn in an:
                shorter, longer = (an, bn) if len(an) <= len(bn) else (bn, an)
                if len(shorter) >= 5 and shorter != longer:
                    reasons.append("substring")
            if compact_stem(a["name"]) == compact_stem(b["name"]) and an != bn:
                reasons.append("shared-stem")
            if len(an) >= 6 and len(bn) >= 6:
                dist = levenshtein(an, bn)
                if dist <= 2 and an != bn:
                    reasons.append(f"edit-distance-{dist}")
            if reasons:
                conflicts.append({"a": a, "b": b, "reasons": reasons})
    return conflicts


def format_conflict(item: dict) -> str:
    a, b = item["a"], item["b"]
    return (
        f"- {a['name']} ({a['nationId']}, {a['source']})"
        f" <-> {b['name']} ({b['nationId']}, {b['source']})"
        f" [{', '.join(item['reasons'])}]"
    )


def audit_settlement_names(
    *,
    world_path: Path | None = None,
    print_report: bool = True,
    exit_on_conflict: bool = False,
) -> list[dict]:
    entries = load_entries(world_path=world_path)
    conflicts = find_conflicts(entries)
    if print_report:
        print(f"Loaded {len(entries)} settlement/nation name entries.")
        print(f"Found {len(conflicts)} potential cross-nation conflicts.")
        if conflicts:
            print()
            for item in conflicts:
                print(format_conflict(item))
    if exit_on_conflict and conflicts:
        sys.exit(1)
    return conflicts


def main() -> None:
    audit_settlement_names(exit_on_conflict=True)


if __name__ == "__main__":
    main()
