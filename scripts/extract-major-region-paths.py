"""Extract major region paths from Regionmap1.svg (game overlay fragment)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SVG = ROOT / "public" / "images" / "Regionmap1.svg"
OUT_HTML = ROOT / "public" / "data" / "game-region-paths-extract.html"

MIN_D_CHARS = 5000
DEDUP_CENTROID_PX = 95
DEDUP_SPAN_PX = 180


def parse_path_elements(text: str) -> list[tuple[str, str]]:
    """Return (non-d attributes, d) for each <path> in document order."""
    blocks = re.findall(r"<path\s+([^>]*?)\s*/>", text, re.S | re.I)
    out: list[tuple[str, str]] = []
    for attrs in blocks:
        dm = re.search(r'\sd="([\s\S]*?)"', attrs, re.I)
        if not dm:
            continue
        other = re.sub(r'\s+d="[\s\S]*?"', "", attrs, count=1, flags=re.I).strip()
        out.append((other, dm.group(1)))
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


def is_near_duplicate(a: tuple, b: tuple) -> bool:
    _, len_a, cx_a, cy_a, span_a, _, _ = a
    _, len_b, cx_b, cy_b, span_b, _, _ = b
    dist = ((cx_a - cx_b) ** 2 + (cy_a - cy_b) ** 2) ** 0.5
    if dist > DEDUP_CENTROID_PX:
        return False
    if abs(span_a - span_b) > DEDUP_SPAN_PX:
        return False
    ratio = min(len_a, len_b) / max(len_a, len_b)
    return ratio > 0.72


def dedupe_candidates(candidates: list[tuple]) -> list[tuple]:
    kept: list[tuple] = []
    for item in sorted(candidates, key=lambda x: x[1], reverse=True):
        if any(is_near_duplicate(item, other) for other in kept):
            continue
        kept.append(item)
    return sorted(kept, key=lambda x: (x[2], x[3]))


def region_id_for_centroid(cx: float, cy: float, span: float) -> str:
    if span >= 1650:
        if cx >= 850:
            return "far-east"
        if cx >= 600 and cy >= 550:
            return "eastlands"
        if cy >= 500:
            return "southeast"
        return "eastlands"
    if cy < 400 and cx < 400:
        return "northwest"
    if cy < 530 and cx >= 495:
        return "northern-plateau"
    if cy < 560 and cx < 560:
        return "western-reaches"
    if cy >= 850:
        return "south-isles"
    return "central"


def extract_labeled_regions(text: str) -> list[tuple[str, str, str]]:
    """Return [(region_id, path_attrs_without_d, d_verbatim), ...]."""
    elements = parse_path_elements(text)
    total_subpaths = sum(len(split_subpaths(d)) for _a, d in elements)

    candidates: list[tuple] = []
    for path_index, (attrs, d) in enumerate(elements):
        for sub_index, sub in enumerate(split_subpaths(d)):
            if len(sub) < MIN_D_CHARS:
                continue
            cx, cy, span = centroid_span(sub)
            candidates.append((f"{path_index}:{sub_index}", len(sub), cx, cy, span, sub, attrs))

    major = dedupe_candidates(candidates)

    labeled: list[tuple[str, str, str]] = []
    used_ids: set[str] = set()
    for _key, _length, cx, cy, span, d, attrs in major:
        rid = region_id_for_centroid(cx, cy, span)
        base = rid
        n = 2
        while rid in used_ids:
            rid = f"{base}-{n}"
            n += 1
        used_ids.add(rid)
        labeled.append((rid, attrs, d))

    return labeled, len(elements), total_subpaths, total_subpaths - len(major)


def build_fragment(labeled: list[tuple[str, str, str]]) -> str:
    lines: list[str] = []
    for rid, attrs, d in labeled:
        block = [
            "                            <path",
            '                                class="game-region-zone"',
            f'                                data-region-id="{rid}"',
        ]
        if attrs:
            for piece in re.split(r"\s+(?=\w)", attrs.strip()):
                if piece.startswith('class="'):
                    continue
                block.append(f"                                {piece}")
        block.append(f'                                d="{d}"')
        block.append("                            />")
        lines.append("\n".join(block))
    return "\n".join(lines)


def main() -> None:
    if not SOURCE_SVG.is_file():
        raise SystemExit(f"Source SVG not found: {SOURCE_SVG}")

    text = SOURCE_SVG.read_text(encoding="utf-8", errors="replace")
    labeled, path_count, subpath_count, dropped = extract_labeled_regions(text)

    print(f"Source: {SOURCE_SVG.name}")
    print(f"Parsed {path_count} path elements, {subpath_count} subpaths total.")
    print(f"Removed {dropped} micro/duplicate shapes; kept {len(labeled)} major regions.")
    for rid, _attrs, d in labeled:
        cx, cy, span = centroid_span(d)
        print(f"  {rid}: d_len={len(d)} centroid=({cx:.0f},{cy:.0f}) span={span:.0f}")

    fragment = build_fragment(labeled)
    OUT_HTML.parent.mkdir(parents=True, exist_ok=True)
    OUT_HTML.write_text(fragment + "\n", encoding="utf-8")
    print(f"Wrote {OUT_HTML}")


if __name__ == "__main__":
    main()
