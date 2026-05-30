"""Extract every distinct landmass/island polygon from nation SVGs → game-nation-paths.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "game-nation-paths.json"

SOURCES = [
    ("northern", ROOT / "public" / "images" / "northernnations.svg"),
    ("central", ROOT / "public" / "images" / "centralnations.svg"),
    ("southern", ROOT / "public" / "images" / "southernnations.svg"),
]

MIN_SPAN = 25
DEDUP_DIST = 70

# Canonical playable nations — matched to nearest extracted polygon centroid.
MAJOR_NATIONS = {
    "krall": {"name": "Krall", "accent": "#8a4a4a", "x": 713, "y": 138},
    "aethelgard": {"name": "Aethelgard", "accent": "#6b8a6b", "x": 1054, "y": 135},
    "saelthine": {"name": "Saelthine", "accent": "#7a8a9a", "x": 1039, "y": 335},
    "trex": {"name": "Trex", "accent": "#8a6a4a", "x": 573, "y": 378},
    "gorz": {"name": "Gorz", "accent": "#6a3050", "x": 1170, "y": 508},
    "lyllis": {"name": "Lyllis", "accent": "#c5b878", "x": 1001, "y": 863},
    "dravic": {"name": "Dravic", "accent": "#5a6a7a", "x": 1060, "y": 706},
    "aesthene": {"name": "Aesthene", "accent": "#6a9eb8", "x": 696, "y": 718},
    "vaerenth": {"name": "Vaerenth", "accent": "#5a8a7a", "x": 363, "y": 731},
    "thruun": {"name": "Thruun", "accent": "#9a6a3a", "x": 1176, "y": 998},
    "zevros": {"name": "Zevros", "accent": "#4a5a8a", "x": 483, "y": 1221},
    "vaelior": {"name": "Vaelior", "accent": "#5a7a9a", "x": 920, "y": 1490},
    "skaros": {"name": "Skaros", "accent": "#4a3a6a", "x": 1213, "y": 1261},
    "mynor": {"name": "Mynor", "accent": "#7a7a8a", "x": 437, "y": 1495},
    "khaerant": {"name": "Khaerant", "accent": "#9a7a4a", "x": 1124, "y": 1600},
}

MINOR_NAME_POOLS: dict[str, list[str]] = {
    "northern": [
        "Rime Cay", "Gale Spur", "Frost Shoal", "Pine Narrows", "Mist Reach",
        "Oracle Foothills", "Ashwick Strand", "Northgate Isle", "Veilwood Key",
        "Stormhorn Atoll", "Boreal Shelf", "Hearthmere Rock", "Glimmer Fjord",
        "Wolfshade Cay", "Silverpine Hold", "Emberwash Isle", "Cloudmere Spit",
        "Ironbark Reach", "Frostvein Shelf", "Hollowpine Key", "Starfall Cay",
        "Windscar Isle", "Grimholt Rock", "Palebay Strand", "Thornmere Atoll",
        "Nightgale Spur", "Sunreach Cay", "Deepwood Fringe", "Coldwater Key",
        "Highcrest Isle", "Brackenmoor Rock", "Snowmelt Shelf", "Ravenspire Cay",
        "Gloomharbor Isle", "Brightfen Atoll", "Stoneveil Reach", "Marrowdeep Key",
        "Kingshollow Rock", "Duskwatch Cay", "Everfrost Shelf",
    ],
    "central": [
        "Ridgefall Cay", "Limestone Reach", "Tradebar Spur", "Glyphshore Isle",
        "Manafort Rock", "Basinward Key", "Rivermere Shelf", "Goldmead Atoll",
        "Sunwheat Cay", "Marshgate Isle", "Crownpass Rock", "Lowland Spit",
        "Harvestmere Key", "Wheatford Shelf", "Meadowfen Isle", "Stonearch Cay",
        "Watchridge Rock", "Chalkcliff Reach", "Windplateau Key", "Deepcanyon Shelf",
        "Fairmead Atoll", "Copperrun Cay", "Greenhollow Isle", "Kingsroad Rock",
        "Silverford Key", "Brightdelta Shelf", "Willowmere Cay", "Ironplain Spur",
        "Dawnfield Isle", "Hearthvale Rock", "Moonridge Key", "Clearwater Shelf",
        "Eastmark Cay", "Highpass Atoll", "Verdant Spit", "Oldweaver Rock",
        "Sunarch Isle", "Greyfen Key", "Southmarch Shelf",
    ],
    "southern": [
        "Saltfang Cay", "Reefspire Rock", "Tidebreak Isle", "Brinecrest Key",
        "Wavehollow Shelf", "Stormreef Atoll", "Deepgulf Spur", "Coralgate Isle",
        "Seabrine Rock", "Cliffharbor Cay", "Forgebay Key", "Ironcoast Shelf",
        "Clockwork Isle", "Deepwork Atoll", "Vanishpit Rock", "Foundry Spit",
        "Hammerdeep Cay", "Coalshoal Isle", "Smokestack Key", "Anvilreach Shelf",
        "Southreef Atoll", "Pearlwater Cay", "Sharktooth Rock", "Wyrm Shoal",
        "Gulfward Isle", "Seawatch Key", "Brasshaven Shelf", "Copperdeep Cay",
        "Tidegrave Rock", "Sunspit Atoll", "Mistgulf Isle",
    ],
}


def is_filled_landmass(fill: str | None) -> bool:
    """Only true SVG land polygons (filled shapes), not stroke outlines or lake holes."""
    if not fill:
        return False
    normalized = fill.strip().lower()
    if normalized in ("none", "transparent"):
        return False
    if normalized in ("#000", "#000000", "black", "rgb(0,0,0)", "rgb(0, 0, 0)"):
        return False
    return True


def parse_path_elements(text: str) -> list[str]:
    blocks = re.findall(r"<path\s+([^>]*?)\s*/>", text, re.S | re.I)
    out: list[str] = []
    for attrs in blocks:
        fill_match = re.search(r'fill="([^"]*)"', attrs, re.I)
        fill_value = fill_match.group(1) if fill_match else "none"
        if not is_filled_landmass(fill_value):
            continue
        dm = re.search(r'\sd="([\s\S]*?)"', attrs, re.I)
        if dm:
            out.append(dm.group(1))
    return out


def split_subpaths(d: str) -> list[str]:
    parts = re.split(r"(?=\sM\s)", d.strip())
    subpaths: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if not part.startswith("M"):
            part = "M " + part
        subpaths.append(part)
    return subpaths


def centroid_span(d: str) -> tuple[float, float, float, int]:
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)]
    xs, ys = nums[0::2], nums[1::2]
    n = min(len(xs), len(ys))
    if n < 2:
        return 0.0, 0.0, 0.0, len(d)
    cx = sum(xs[:n]) / n
    cy = sum(ys[:n]) / n
    span = max(max(xs[:n]) - min(xs[:n]), max(ys[:n]) - min(ys[:n]))
    return cx, cy, span, len(d)


def dedupe_clusters(candidates: list[tuple]) -> list[tuple]:
    kept: list[tuple] = []
    for item in sorted(candidates, key=lambda x: x[1], reverse=True):
        _, span, cx, cy, _ = item
        if any(((cx - ox) ** 2 + (cy - oy) ** 2) ** 0.5 < DEDUP_DIST for _, _, ox, oy, _ in kept):
            continue
        kept.append(item)
    return sorted(kept, key=lambda x: (x[3], x[2]))


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "territory"


MAP_MAJOR_IDS: dict[str, list[str]] = {
    "northern": ["krall", "aethelgard", "saelthine", "trex", "gorz"],
    "central": ["lyllis", "dravic", "aesthene", "vaerenth", "thruun"],
    "southern": ["zevros", "vaelior", "skaros", "mynor", "khaerant"],
}


def assign_major_clusters(map_id: str, clusters: list[tuple]) -> tuple[list[tuple[tuple, str]], list[tuple]]:
    remaining = list(clusters)
    assignments: list[tuple[tuple, str]] = []

    for nation_id in MAP_MAJOR_IDS.get(map_id, []):
        meta = MAJOR_NATIONS[nation_id]
        best_index = None
        best_dist = 140.0
        for index, cluster in enumerate(remaining):
            _, _span, cx, cy, _ = cluster
            dist = ((cx - meta["x"]) ** 2 + (cy - meta["y"]) ** 2) ** 0.5
            if dist < best_dist:
                best_dist = dist
                best_index = index
        if best_index is not None:
            assignments.append((remaining.pop(best_index), nation_id))

    return assignments, remaining


def extract_source(map_id: str, svg_path: Path) -> list[dict]:
    text = svg_path.read_text(encoding="utf-8")
    candidates: list[tuple] = []
    for d in parse_path_elements(text):
        for sub in split_subpaths(d):
            cx, cy, span, dlen = centroid_span(sub)
            if span >= MIN_SPAN:
                candidates.append((dlen, span, cx, cy, sub))

    clusters = dedupe_clusters(candidates)
    major_assignments, minor_clusters = assign_major_clusters(map_id, clusters)

    name_pool = MINOR_NAME_POOLS.get(map_id, [])
    pool_index = 0
    records: list[dict] = []

    def append_record(cluster: tuple, nation_id: str, name: str, accent: str, kind: str) -> None:
        _, span, cx, cy, d = cluster
        records.append({
            "id": nation_id,
            "name": name,
            "accent": accent,
            "kind": kind,
            "mapId": map_id,
            "d": re.sub(r"\s+", " ", d).strip(),
            "centroid": {"x": round(cx, 1), "y": round(cy, 1)},
            "span": round(span, 1),
        })

    for cluster, nation_id in major_assignments:
        meta = MAJOR_NATIONS[nation_id]
        append_record(cluster, nation_id, meta["name"], meta["accent"], "major")

    for cluster in minor_clusters:
        if pool_index < len(name_pool):
            display_name = name_pool[pool_index]
            pool_index += 1
        else:
            display_name = f"{map_id.title()} Reach {pool_index + 1}"
            pool_index += 1
        nation_id = f"{map_id}-{slugify(display_name)}"
        append_record(cluster, nation_id, display_name, "#9a8a6a", "minor")

    return records


def main() -> None:
    nations: list[dict] = []
    for map_id, svg_path in SOURCES:
        nations.extend(extract_source(map_id, svg_path))

    nations.sort(key=lambda row: (
        0 if row.get("kind") == "major" else 1,
        row.get("mapId", ""),
        row.get("centroid", {}).get("y", 0),
        row.get("centroid", {}).get("x", 0),
    ))

    payload = {
        "viewBox": "0 0 1642 1642",
        "nations": nations,
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    majors = sum(1 for n in nations if n.get("kind") == "major")
    print(f"Wrote {len(nations)} territories ({majors} major) to {OUT}")


if __name__ == "__main__":
    main()
