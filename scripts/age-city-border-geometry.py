"""Shared outline-border geometry for age-world city neighbor detection."""
from __future__ import annotations

import math
import re

ADJACENCY_PREFILTER_PAD = 2
ADJACENCY_MAX_GAP = 4
CURVE_SAMPLE_STEPS = 8

# Art-reviewed borders that sit just outside the auto gap threshold.
FORCED_CITY_BORDER_PAIRS = frozenset(
    {
        frozenset({"trex-trellgar", "lyllis-faelengrove"}),
        frozenset({"aethelgard-ghrenmyr", "dravic-terragrim"}),
        frozenset({"dravic-crenellon", "aethelgard-vaurnheim"}),
        frozenset({"dravic-ballistrek", "aethelgard-ljundvarr"}),
        frozenset({"saelthine-spaeskog", "trex-vehrakhan"}),
        frozenset({"saelthine-wyrdkrend", "trex-vehrakhan"}),
        frozenset({"lyllis-faelengrove", "trex-scorvekh"}),
        frozenset({"thruun-ghuzorn", "zevros-rankhald"}),
    }
)


def _cubic_point(
    p0: tuple[float, float],
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    t: float,
) -> tuple[float, float]:
    mt = 1.0 - t
    mt2 = mt * mt
    t2 = t * t
    x = mt2 * mt * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t2 * t * p3[0]
    y = mt2 * mt * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t2 * t * p3[1]
    return (x, y)


def _sample_cubic(
    p0: tuple[float, float],
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    steps: int = CURVE_SAMPLE_STEPS,
) -> list[tuple[float, float]]:
    return [_cubic_point(p0, p1, p2, p3, i / steps) for i in range(steps + 1)]


def outline_path_polyline(d: str, curve_steps: int = CURVE_SAMPLE_STEPS) -> list[tuple[float, float]]:
    tokens = re.findall(r"[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?", d, re.I)
    if len(tokens) < 3:
        return []

    polyline: list[tuple[float, float]] = []
    i = 0
    cmd = ""
    cx = 0.0
    cy = 0.0
    sx = 0.0
    sy = 0.0
    last_c2: tuple[float, float] | None = None

    def read_num() -> float:
        nonlocal i
        value = float(tokens[i])
        i += 1
        return value

    def append_point(x: float, y: float) -> tuple[float, float]:
        point = (x, y)
        if not polyline or polyline[-1] != point:
            polyline.append(point)
        return point

    def set_cursor(x: float, y: float) -> tuple[float, float]:
        nonlocal cx, cy
        point = append_point(x, y)
        cx, cy = point
        return point

    def append_segment(points: list[tuple[float, float]]) -> None:
        for index, point in enumerate(points):
            if index == 0 and polyline and polyline[-1] == point:
                continue
            polyline.append(point)
        if points:
            nonlocal cx, cy
            cx, cy = points[-1]

    while i < len(tokens):
        token = tokens[i]
        if re.fullmatch(r"[a-zA-Z]", token):
            cmd = token
            i += 1
        elif not cmd:
            i += 1
            continue

        lower = cmd.lower()
        if lower == "m":
            x = read_num()
            y = read_num()
            if cmd == "m":
                set_cursor(cx + x, cy + y)
            else:
                set_cursor(x, y)
            sx, sy = cx, cy
            last_c2 = None
            cmd = "l" if cmd == "m" else "L"
        elif lower == "l":
            x = read_num()
            y = read_num()
            if cmd == "l":
                set_cursor(cx + x, cy + y)
            else:
                set_cursor(x, y)
            last_c2 = None
        elif lower == "h":
            x = read_num()
            set_cursor(cx + x if cmd == "h" else x, cy)
            last_c2 = None
        elif lower == "v":
            y = read_num()
            set_cursor(cx, cy + y if cmd == "v" else y)
            last_c2 = None
        elif lower == "c":
            c1x = read_num()
            c1y = read_num()
            c2x = read_num()
            c2y = read_num()
            x = read_num()
            y = read_num()
            if cmd == "c":
                p1 = (cx + c1x, cy + c1y)
                p2 = (cx + c2x, cy + c2y)
                p3 = (cx + x, cy + y)
            else:
                p1 = (c1x, c1y)
                p2 = (c2x, c2y)
                p3 = (x, y)
            p0 = (cx, cy)
            append_segment(_sample_cubic(p0, p1, p2, p3, curve_steps))
            last_c2 = p2
        elif lower == "s":
            c2x = read_num()
            c2y = read_num()
            x = read_num()
            y = read_num()
            if cmd == "s":
                p2 = (cx + c2x, cy + c2y)
                p3 = (cx + x, cy + y)
            else:
                p2 = (c2x, c2y)
                p3 = (x, y)
            if last_c2 is None:
                p1 = (cx, cy)
            else:
                p1 = (2 * cx - last_c2[0], 2 * cy - last_c2[1])
            p0 = (cx, cy)
            append_segment(_sample_cubic(p0, p1, p2, p3, curve_steps))
            last_c2 = p2
        elif lower == "z":
            if polyline and (cx, cy) != (sx, sy):
                append_segment([(cx, cy), (sx, sy)])
            cx, cy = sx, sy
            last_c2 = None
            cmd = ""
        else:
            i += 1
            cmd = ""

    return polyline


def _point_segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    abx = bx - ax
    aby = by - ay
    denom = abx * abx + aby * aby
    if denom == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / denom))
    cx = ax + t * abx
    cy = ay + t * aby
    return math.hypot(px - cx, py - cy)


def _segment_segment_distance(
    a1: tuple[float, float],
    a2: tuple[float, float],
    b1: tuple[float, float],
    b2: tuple[float, float],
) -> float:
    best = float("inf")
    for px, py in (a1, a2):
        best = min(best, _point_segment_distance(px, py, b1[0], b1[1], b2[0], b2[1]))
    for px, py in (b1, b2):
        best = min(best, _point_segment_distance(px, py, a1[0], a1[1], a2[0], a2[1]))
    return best


def min_outline_gap(path_a: str, path_b: str) -> float:
    poly_a = outline_path_polyline(path_a)
    poly_b = outline_path_polyline(path_b)
    if len(poly_a) < 2 or len(poly_b) < 2:
        return float("inf")

    best = float("inf")
    for i in range(len(poly_a) - 1):
        for j in range(len(poly_b) - 1):
            gap = _segment_segment_distance(poly_a[i], poly_a[i + 1], poly_b[j], poly_b[j + 1])
            if gap < best:
                best = gap
                if best <= 0:
                    return 0.0
    return best


def boxes_touch(a: dict, b: dict, pad: float = ADJACENCY_PREFILTER_PAD) -> bool:
    return not (
        a["maxX"] + pad < b["minX"] - pad
        or b["maxX"] + pad < a["minX"] - pad
        or a["maxY"] + pad < b["minY"] - pad
        or b["maxY"] + pad < a["minY"] - pad
    )


def cities_border(a: dict, b: dict, max_gap: float = ADJACENCY_MAX_GAP) -> bool:
    if not boxes_touch(a["bbox"], b["bbox"]):
        return False
    path_a = a.get("outlinePath")
    path_b = b.get("outlinePath")
    if not path_a or not path_b:
        return False
    return min_outline_gap(path_a, path_b) <= max_gap


def is_forced_city_border(city_a_id: str, city_b_id: str) -> bool:
    return frozenset({city_a_id, city_b_id}) in FORCED_CITY_BORDER_PAIRS


def compute_valid_neighbors(cities: list[dict], max_gap: float = ADJACENCY_MAX_GAP) -> dict[str, list[str]]:
    valid: dict[str, set[str]] = {city["id"]: set() for city in cities}
    for i, city_a in enumerate(cities):
        for city_b in cities[i + 1 :]:
            if cities_border(city_a, city_b, max_gap=max_gap) or is_forced_city_border(
                city_a["id"], city_b["id"]
            ):
                valid[city_a["id"]].add(city_b["id"])
                valid[city_b["id"]].add(city_a["id"])
    return {city_id: sorted(neighbors) for city_id, neighbors in valid.items()}
