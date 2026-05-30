"""Derive city terrain tags by sampling amnekmap.png inside city outline paths."""
from __future__ import annotations

import re
from collections import Counter

import numpy as np
from PIL import Image, ImageDraw

TERRAIN_REFS: dict[str, tuple[int, int, int]] = {
    "Snow": (252, 253, 255),
    "Desert": (128, 121, 86),
    "Plains": (89, 94, 55),
    "Forest": (33, 46, 31),
    "Mountains": (67, 63, 57),
    "Marshlands": (23, 32, 41),
}

# RGBA colors baked into public/images/amnekmap-terrain-overlay.png (legend + build script).
TERRAIN_OVERLAY_COLORS: dict[str, tuple[int, int, int, int]] = {
    "Forest": (52, 128, 68, 168),
    "Plains": (126, 186, 78, 168),
    "Desert": (210, 165, 90, 168),
    "Mountains": (136, 118, 96, 168),
    "Marshlands": (48, 138, 158, 168),
    "Snow": (236, 244, 252, 184),
}

DEFAULT_TERRAIN = "Plains"
VARIANCE_RADIUS = 2
DESERT_MIN_COVERAGE = 0.55
MOUNTAINS_MIN_COVERAGE = 0.25


def local_variance(gray: np.ndarray, radius: int = VARIANCE_RADIUS) -> np.ndarray:
    kernel = radius * 2 + 1
    padded = np.pad(gray.astype(np.float32), radius, mode="edge")
    h, w = gray.shape
    mean = np.zeros((h, w), dtype=np.float32)
    sq = np.zeros((h, w), dtype=np.float32)
    for dy in range(kernel):
        for dx in range(kernel):
            patch = padded[dy : dy + h, dx : dx + w]
            mean += patch
            sq += patch * patch
    mean /= kernel * kernel
    sq /= kernel * kernel
    return sq - mean * mean


def flatten_cubic(
    p0: tuple[float, float],
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    steps: int = 10,
) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def parse_path(d: str) -> list[list[tuple[float, float]]]:
    tokens = re.findall(r"[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)
    i = 0
    polys: list[list[tuple[float, float]]] = []
    cur: list[tuple[float, float]] = []
    x = y = sx = sy = 0.0

    def add(pt: tuple[float, float]) -> None:
        if not cur or pt != cur[-1]:
            cur.append(pt)

    while i < len(tokens):
        cmd = tokens[i]
        i += 1
        if cmd in ("M", "m"):
            if len(cur) >= 3:
                polys.append(cur)
            cur = []
            x = float(tokens[i])
            y = float(tokens[i + 1])
            i += 2
            if cmd == "m":
                x += sx
                y += sy
            sx, sy = x, y
            add((x, y))
        elif cmd in ("L", "l"):
            x = float(tokens[i])
            y = float(tokens[i + 1])
            i += 2
            if cmd == "l":
                x += sx
                y += sy
            sx, sy = x, y
            add((x, y))
        elif cmd in ("C", "c"):
            pts = [float(tokens[i + j]) for j in range(6)]
            i += 6
            if cmd == "c":
                pts = [
                    pts[0] + sx,
                    pts[1] + sy,
                    pts[2] + sx,
                    pts[3] + sy,
                    pts[4] + sx,
                    pts[5] + sy,
                ]
            p0 = (sx, sy)
            p1 = (pts[0], pts[1])
            p2 = (pts[2], pts[3])
            p3 = (pts[4], pts[5])
            for pt in flatten_cubic(p0, p1, p2, p3)[1:]:
                add(pt)
            sx, sy = p3
        elif cmd in ("Z", "z"):
            if cur:
                cur.append(cur[0])
                polys.append(cur)
                cur = []
    if len(cur) >= 3:
        polys.append(cur)
    return polys


def polygon_mask(size: tuple[int, int], outline_path: str) -> np.ndarray:
    polys = parse_path(outline_path)
    mask_img = Image.new("1", size, 0)
    if not polys:
        return np.zeros(size[::-1], dtype=bool)
    poly = max(polys, key=len)
    int_poly = [(int(round(px)), int(round(py))) for px, py in poly]
    ImageDraw.Draw(mask_img).polygon(int_poly, fill=1)
    return np.array(mask_img, dtype=bool)


def is_excluded_pixel(r: int, g: int, b: int) -> bool:
    total = int(r) + int(g) + int(b)
    spread = max(r, g, b) - min(r, g, b)
    if total < 55:
        return True
    if total < 95 and spread < 20:
        return True
    if b >= g >= r and total < 140 and b - r > 10:
        return True
    if b > r + 25 and b > g + 10 and g > r and total > 120:
        return True
    return False


def nearest_terrain(r: int, g: int, b: int) -> str:
    return min(
        TERRAIN_REFS.items(),
        key=lambda item: (r - item[1][0]) ** 2 + (g - item[1][1]) ** 2 + (b - item[1][2]) ** 2,
    )[0]


def classify_pixel(r: int, g: int, b: int, variance: float) -> str | None:
    if is_excluded_pixel(r, g, b):
        return None

    total = int(r) + int(g) + int(b)
    brightness = total / 3
    spread = max(r, g, b) - min(r, g, b)
    green_dom = g >= r and g >= b

    if r > 200 and g > 195 and b > 175 and total > 580:
        return "Snow"

    if r >= 105 and g >= 95 and b <= 95 and r >= b + 12 and abs(r - g) < 25:
        return "Desert"

    if green_dom:
        if variance >= 140:
            return "Forest"
        if brightness < 80 and variance >= 80:
            return "Forest"
        return "Plains"

    if variance >= 280 and spread >= 12 and not (green_dom and brightness >= 85):
        return "Mountains"
    if spread <= 32 and 90 <= total <= 230 and not green_dom:
        return "Mountains"

    if b >= r + 5 and b >= g - 8 and total < 180 and brightness < 85:
        return "Marshlands"

    return nearest_terrain(r, g, b)


def terrain_counts_for_path(outline_path: str, rgb: np.ndarray) -> Counter:
    mask = polygon_mask((rgb.shape[1], rgb.shape[0]), outline_path)
    gray = rgb.mean(axis=2)
    variance = local_variance(gray)
    counts: Counter = Counter()
    for y, x in zip(*np.where(mask)):
        r, g, b = map(int, rgb[y, x])
        label = classify_pixel(r, g, b, float(variance[y, x]))
        if label:
            counts[label] += 1
    return counts


def terrain_for_path(outline_path: str, rgb: np.ndarray) -> str:
    counts = terrain_counts_for_path(outline_path, rgb)
    if not counts:
        return DEFAULT_TERRAIN

    total = sum(counts.values())
    ranked = counts.most_common()
    desert_share = counts.get("Desert", 0) / total
    mountain_share = counts.get("Mountains", 0) / total

    if desert_share >= DESERT_MIN_COVERAGE:
        return "Desert"
    if mountain_share >= MOUNTAINS_MIN_COVERAGE:
        return "Mountains"

    winner, _winner_count = ranked[0]
    if winner == "Desert":
        for terrain, _count in ranked[1:]:
            if terrain != "Desert":
                return terrain
        return DEFAULT_TERRAIN

    return winner


def load_map_rgb(map_path) -> np.ndarray:
    return np.array(Image.open(map_path).convert("RGB"))


def assign_terrains_from_map(cities: list[dict], rgb: np.ndarray) -> None:
    for city in cities:
        outline = city.get("outlinePath") or ""
        city["terrain"] = terrain_for_path(outline, rgb) if outline else DEFAULT_TERRAIN
