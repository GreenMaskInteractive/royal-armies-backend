"""Analyze nation SVG files — count paths and clusters by span threshold."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "public" / "images" / "northernnations.svg",
    ROOT / "public" / "images" / "centralnations.svg",
    ROOT / "public" / "images" / "southernnations.svg",
]
MIN_SPAN = 25
DEDUP_DIST = 70


def parse_path_elements(text: str) -> list[str]:
    blocks = re.findall(r"<path\s+([^>]*?)\s*/>", text, re.S | re.I)
    out: list[str] = []
    for attrs in blocks:
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


def centroid_span(d: str) -> tuple[float, float, float]:
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)]
    xs, ys = nums[0::2], nums[1::2]
    n = min(len(xs), len(ys))
    if n < 2:
        return 0.0, 0.0, 0.0
    cx = sum(xs[:n]) / n
    cy = sum(ys[:n]) / n
    span = max(max(xs[:n]) - min(xs[:n]), max(ys[:n]) - min(ys[:n]))
    return cx, cy, span


def dedupe(cands: list[tuple[float, float, float]], dist: float) -> list[tuple[float, float, float]]:
    kept: list[tuple[float, float, float]] = []
    for cx, cy, span in sorted(cands, key=lambda x: x[2], reverse=True):
        if any(((cx - x) ** 2 + (cy - y) ** 2) ** 0.5 < dist for x, y, _ in kept):
            continue
        kept.append((cx, cy, span))
    return kept


def main() -> None:
    total = 0
    for svg_path in FILES:
        text = svg_path.read_text(encoding="utf-8")
        cands: list[tuple[float, float, float]] = []
        for d in parse_path_elements(text):
            for sub in split_subpaths(d):
                cx, cy, span = centroid_span(sub)
                if span >= MIN_SPAN:
                    cands.append((cx, cy, span))
        clusters = dedupe(cands, DEDUP_DIST)
        total += len(clusters)
        print(f"\n=== {svg_path.name} — {len(clusters)} clusters (span>={MIN_SPAN}) ===")
        for i, (cx, cy, span) in enumerate(sorted(clusters, key=lambda x: (x[1], x[0]))):
            print(f"  {i:02d}: span={span:6.1f}  centroid=({cx:7.1f}, {cy:7.1f})")
    print(f"\nTOTAL: {total}")


if __name__ == "__main__":
    main()
