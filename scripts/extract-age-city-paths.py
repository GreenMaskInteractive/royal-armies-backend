"""Extract 15 city polygons per nation from *cities.svg → public/data/age-world-cities.json."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "age-world-cities.json"
NATION_PATHS = ROOT / "public" / "data" / "game-nation-paths.json"
MAP_PATH = ROOT / "public" / "images" / "amnekmap.png"


def _load_terrain_module():
    spec = importlib.util.spec_from_file_location(
        "age_terrain_from_map", ROOT / "scripts" / "age-terrain-from-map.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

CITY_SVGS = {
    "dravic": "draviccities.svg",
    "khaerant": "khaerantcities.svg",
    "mynor": "mynorcities.svg",
    "trex": "trexcities.svg",
    "vaerenth": "vaerenthcities.svg",
    "skaros": "skaroscities.svg",
    "vaelior": "vaeliorcities.svg",
    "zevros": "zevroscities.svg",
    "gorz": "gorzcities.svg",
    "krall": "krallcities.svg",
    "thruun": "thruuncities.svg",
    "saelthine": "saelthinecities.svg",
    "aethelgard": "aethelgardcities.svg",
    "lyllis": "lylliscities.svg",
}

# Nations whose cities ship as one SVG per settlement (public/images/{prefix}{slug}.svg).
INDIVIDUAL_CITY_NATIONS: dict[str, dict[str, str]] = {
    "aesthene": {"glob": "aesthine_*.svg", "prefix": "aesthine_"},
}

NATION_REGION = {
    "trex": "region-1",
    "gorz": "region-1",
    "lyllis": "region-1",
    "aethelgard": "region-2",
    "krall": "region-2",
    "saelthine": "region-2",
    "dravic": "region-3",
    "aesthene": "region-3",
    "vaerenth": "region-3",
    "thruun": "region-4",
    "zevros": "region-4",
    "vaelior": "region-5",
    "skaros": "region-5",
    "mynor": "region-6",
    "khaerant": "region-6",
}

SETTLEMENT_TIER_RATIOS = {
    "village": 0.10,
    "town": 0.25,
    "city": 0.40,
    "citadel": 0.15,
    "kingdom": 0.10,
}

TIER_RANK = {
    "village": 0,
    "town": 1,
    "city": 2,
    "citadel": 3,
    "kingdom": 4,
}

STRUCTURE_POOL = [
    "Heavy Ballista Matrix",
    "Reinforced Slate Rampart",
    "Arcane Ward Spire",
    "Siege Breaker Turret",
    "Moat Gate Complex",
    "Obsidian Bulwark",
    "Storm Lantern Bastion",
]

MIN_PATH_SPAN = 8
CITIES_PER_NATION = 15
ADJACENCY_PAD = 4


def is_filled_landmass(fill: str | None) -> bool:
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
            out.append(re.sub(r"\s+", " ", dm.group(1)).strip())
    return out


def path_metrics(d: str) -> tuple[float, float, float, float, float, float]:
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)]
    xs, ys = nums[0::2], nums[1::2]
    n = min(len(xs), len(ys))
    if n < 2:
        return 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    min_x, max_x = min(xs[:n]), max(xs[:n])
    min_y, max_y = min(ys[:n]), max(ys[:n])
    cx = sum(xs[:n]) / n
    cy = sum(ys[:n]) / n
    span = max(max_x - min_x, max_y - min_y)
    return cx, cy, span, min_x, min_y, max_x, max_y


def cluster_paths(paths: list[str]) -> list[dict]:
    items = []
    for d in paths:
        cx, cy, span, min_x, min_y, max_x, max_y = path_metrics(d)
        if span < MIN_PATH_SPAN:
            continue
        items.append(
            {
                "d": d,
                "cx": cx,
                "cy": cy,
                "span": span,
                "min_x": min_x,
                "min_y": min_y,
                "max_x": max_x,
                "max_y": max_y,
            }
        )

    if not items:
        return []

    items.sort(key=lambda x: x["span"], reverse=True)
    seeds = items[:CITIES_PER_NATION]
    clusters: list[dict] = [
        {
            "paths": [],
            "cx": 0.0,
            "cy": 0.0,
            "weight": 0.0,
            "min_x": seed["min_x"],
            "min_y": seed["min_y"],
            "max_x": seed["max_x"],
            "max_y": seed["max_y"],
        }
        for seed in seeds
    ]

    for item in items:
        best = min(
            range(len(seeds)),
            key=lambda i: (item["cx"] - seeds[i]["cx"]) ** 2 + (item["cy"] - seeds[i]["cy"]) ** 2,
        )
        cluster = clusters[best]
        cluster["paths"].append(item["d"])
        w = max(item["span"], 1.0)
        cluster["cx"] += item["cx"] * w
        cluster["cy"] += item["cy"] * w
        cluster["weight"] += w
        cluster["min_x"] = min(cluster["min_x"], item["min_x"])
        cluster["min_y"] = min(cluster["min_y"], item["min_y"])
        cluster["max_x"] = max(cluster["max_x"], item["max_x"])
        cluster["max_y"] = max(cluster["max_y"], item["max_y"])

    out: list[dict] = []
    for cluster in clusters:
        if cluster["weight"] <= 0:
            continue
        out.append(
            {
                "paths": cluster["paths"],
                "centroid": {
                    "x": round(cluster["cx"] / cluster["weight"], 1),
                    "y": round(cluster["cy"] / cluster["weight"], 1),
                },
                "bbox": {
                    "minX": round(cluster["min_x"], 1),
                    "minY": round(cluster["min_y"], 1),
                    "maxX": round(cluster["max_x"], 1),
                    "maxY": round(cluster["max_y"], 1),
                },
            }
        )

    out.sort(key=lambda c: (c["centroid"]["y"], c["centroid"]["x"]))
    trimmed = out[:CITIES_PER_NATION]
    for cluster in trimmed:
        if cluster["paths"]:
            cluster["outlinePath"] = max(cluster["paths"], key=lambda d: path_metrics(d)[2])
            cluster["span"] = path_metrics(cluster["outlinePath"])[2]
    return trimmed


def boxes_touch(a: dict, b: dict) -> bool:
    pad = ADJACENCY_PAD
    return not (
        a["maxX"] + pad < b["minX"] - pad
        or b["maxX"] + pad < a["minX"] - pad
        or a["maxY"] + pad < b["minY"] - pad
        or b["maxY"] + pad < a["minY"] - pad
    )


def distribute_tier_counts(city_count: int) -> dict[str, int]:
    raw = {tier: city_count * ratio for tier, ratio in SETTLEMENT_TIER_RATIOS.items()}
    counts = {tier: int(value) for tier, value in raw.items()}
    shortfall = city_count - sum(counts.values())
    if shortfall:
        order = sorted(
            SETTLEMENT_TIER_RATIOS.keys(),
            key=lambda tier: raw[tier] - counts[tier],
            reverse=True,
        )
        for tier in order[:shortfall]:
            counts[tier] += 1
    return counts


def assign_settlement_tiers(
    cities: list[dict],
    capital_index: int,
    nation_cx: float,
    nation_cy: float,
) -> None:
    import math

    counts = distribute_tier_counts(len(cities))
    cities[capital_index]["settlementTier"] = "kingdom"
    counts["kingdom"] = max(0, counts["kingdom"] - 1)

    tier_pool: list[str] = []
    for tier in ("kingdom", "citadel", "city", "town", "village"):
        tier_pool.extend([tier] * counts[tier])
    tier_pool.sort(key=lambda tier: TIER_RANK[tier], reverse=True)

    remaining_indices = [index for index in range(len(cities)) if index != capital_index]
    if not tier_pool or not remaining_indices:
        return

    def angle_for(index: int) -> float:
        centroid = cities[index]["centroid"]
        return math.atan2(centroid["y"] - nation_cy, centroid["x"] - nation_cx)

    sector_count = min(5, len(remaining_indices))
    sectors: list[list[int]] = [[] for _ in range(sector_count)]
    for index in remaining_indices:
        angle = angle_for(index)
        bucket = int((angle + math.pi) / (2 * math.pi) * sector_count)
        bucket = min(sector_count - 1, max(0, bucket))
        sectors[bucket].append(index)

    for bucket in sectors:
        bucket.sort(key=lambda index: cities[index].get("span", 0), reverse=True)

    picks: list[int] = []
    cursor = 0
    while len(picks) < len(tier_pool):
        progressed = False
        for bucket in sectors:
            if cursor < len(bucket):
                picks.append(bucket[cursor])
                progressed = True
        if not progressed:
            break
        cursor += 1

    for index, tier in zip(picks, tier_pool):
        cities[index]["settlementTier"] = tier


def parse_individual_city_stem(prefix: str, stem: str) -> tuple[str, str, bool]:
    if not stem.startswith(prefix):
        raise ValueError(f"Expected stem {stem!r} to start with {prefix!r}")
    slug = stem[len(prefix) :]
    is_capital = slug.endswith("_capital")
    if is_capital:
        slug = slug[: -len("_capital")]
    slug = slug.replace("_", "-")
    display = slug.replace("-", " ").title()
    return slug, display, is_capital


def cluster_from_paths(paths: list[str], *, min_span: float = 0.0) -> dict | None:
    items = []
    for d in paths:
        cx, cy, span, min_x, min_y, max_x, max_y = path_metrics(d)
        if span < min_span:
            continue
        items.append(
            {
                "d": d,
                "cx": cx,
                "cy": cy,
                "span": span,
                "min_x": min_x,
                "min_y": min_y,
                "max_x": max_x,
                "max_y": max_y,
            }
        )
    if not items:
        return None

    min_x = min(item["min_x"] for item in items)
    min_y = min(item["min_y"] for item in items)
    max_x = max(item["max_x"] for item in items)
    max_y = max(item["max_y"] for item in items)
    weight = sum(max(item["span"], 1.0) for item in items)
    cx = sum(item["cx"] * max(item["span"], 1.0) for item in items) / weight
    cy = sum(item["cy"] * max(item["span"], 1.0) for item in items) / weight
    path_ds = [item["d"] for item in items]
    outline = max(path_ds, key=lambda d: path_metrics(d)[2])
    return {
        "paths": path_ds,
        "outlinePath": outline,
        "span": path_metrics(outline)[2],
        "centroid": {"x": round(cx, 1), "y": round(cy, 1)},
        "bbox": {
            "minX": round(min_x, 1),
            "minY": round(min_y, 1),
            "maxX": round(max_x, 1),
            "maxY": round(max_y, 1),
        },
    }


def load_individual_nation_clusters(nation_id: str, config: dict[str, str]) -> list[dict]:
    images_dir = ROOT / "public" / "images"
    prefix = config["prefix"]
    clusters: list[dict] = []
    for svg_path in sorted(images_dir.glob(config["glob"])):
        slug, display, is_capital = parse_individual_city_stem(prefix, svg_path.stem)
        paths = parse_path_elements(svg_path.read_text(encoding="utf-8"))
        cluster = cluster_from_paths(paths, min_span=0.0)
        if not cluster:
            print(f"[WARN] No filled paths in {svg_path.name}; skipping.")
            continue
        cluster["slug"] = slug
        cluster["displayName"] = display
        cluster["isCapital"] = is_capital
        clusters.append(cluster)

    if len(clusters) != CITIES_PER_NATION:
        print(
            f"[WARN] {nation_id}: expected {CITIES_PER_NATION} individual city SVGs, found {len(clusters)}."
        )

    clusters.sort(key=lambda c: (c["centroid"]["y"], c["centroid"]["x"]))
    return clusters


def main() -> None:
    terrain_mod = _load_terrain_module()
    map_rgb = terrain_mod.load_map_rgb(MAP_PATH)
    nation_meta = {n["id"]: n for n in json.loads(NATION_PATHS.read_text(encoding="utf-8"))["nations"]}
    nations_out: list[dict] = []
    cities_out: list[dict] = []

    nation_sources = {**CITY_SVGS, **{nation_id: "individual" for nation_id in INDIVIDUAL_CITY_NATIONS}}

    for nation_id, filename in nation_sources.items():
        if nation_id in INDIVIDUAL_CITY_NATIONS:
            clusters = load_individual_nation_clusters(nation_id, INDIVIDUAL_CITY_NATIONS[nation_id])
        else:
            svg_path = ROOT / "public" / "images" / filename
            text = svg_path.read_text(encoding="utf-8")
            clusters = cluster_paths(parse_path_elements(text))

        region_id = NATION_REGION[nation_id]
        meta = nation_meta.get(nation_id, {"name": nation_id.title(), "centroid": {"x": 821, "y": 821}})
        nation_cx = meta.get("centroid", {}).get("x", 821)
        nation_cy = meta.get("centroid", {}).get("y", 821)

        capital_index = 0
        if nation_id in INDIVIDUAL_CITY_NATIONS:
            for index, cluster in enumerate(clusters):
                if cluster.get("isCapital"):
                    capital_index = index
                    break
        else:
            best_dist = float("inf")
            for index, cluster in enumerate(clusters):
                cx = cluster["centroid"]["x"]
                cy = cluster["centroid"]["y"]
                dist = (cx - nation_cx) ** 2 + (cy - nation_cy) ** 2
                if dist < best_dist:
                    best_dist = dist
                    capital_index = index

        terrain_mod.assign_terrains_from_map(clusters, map_rgb)
        assign_settlement_tiers(clusters, capital_index, nation_cx, nation_cy)

        nation_cities: list[dict] = []
        for index, cluster in enumerate(clusters):
            if nation_id in INDIVIDUAL_CITY_NATIONS:
                slug = cluster["slug"]
                city_id = f"{nation_id}-{slug}"
                city_name = cluster["displayName"]
            else:
                city_id = f"{nation_id}-c{index + 1:02d}"
                city_name = f"{meta.get('name', nation_id.title())} — City {index + 1:02d}"

            city = {
                "id": city_id,
                "nationId": nation_id,
                "regionId": region_id,
                "name": city_name,
                "outlinePath": cluster.get("outlinePath") or cluster["paths"][0],
                "centroid": cluster["centroid"],
                "bbox": cluster["bbox"],
                "terrain": cluster["terrain"],
                "settlementTier": cluster["settlementTier"],
                "isCapital": index == capital_index,
                "neighbors": [],
                "holderNationId": nation_id,
                "loserNationId": "",
                "defensiveStructures": [],
            }
            nation_cities.append(city)
            cities_out.append(city)

        for i, a in enumerate(nation_cities):
            for j, b in enumerate(nation_cities):
                if i != j and boxes_touch(a["bbox"], b["bbox"]):
                    a["neighbors"].append(b["id"])

        for i, city in enumerate(nation_cities):
            structures = STRUCTURE_POOL[: 2 + (i % 3)]
            city["defensiveStructures"] = [{"id": f"{city['id']}-s{k}", "label": label} for k, label in enumerate(structures)]

        terrain_types = sorted({c["terrain"] for c in nation_cities})
        nations_out.append(
            {
                "id": nation_id,
                "name": meta.get("name", nation_id.title()),
                "regionId": region_id,
                "centroid": meta.get("centroid", {"x": nation_cx, "y": nation_cy}),
                "terrainTypes": terrain_types,
                "cityIds": [c["id"] for c in nation_cities],
            }
        )

    for i, a in enumerate(cities_out):
        for j, b in enumerate(cities_out):
            if i >= j or a["nationId"] == b["nationId"]:
                continue
            if boxes_touch(a["bbox"], b["bbox"]):
                if b["id"] not in a["neighbors"]:
                    a["neighbors"].append(b["id"])
                if a["id"] not in b["neighbors"]:
                    b["neighbors"].append(a["id"])

    payload = {
        "viewBox": "0 0 1642 1642",
        "nativeWidth": 1642,
        "nativeHeight": 1642,
        "continent": {"id": "amnek", "name": "Amnek"},
        "nations": nations_out,
        "cities": cities_out,
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(cities_out)} cities across {len(nations_out)} nations -> {OUT}")


if __name__ == "__main__":
    main()
