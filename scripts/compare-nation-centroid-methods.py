"""Compute bbox-center vs vertex-centroid for major nation paths."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "game-nation-paths.json"


def path_metrics(d: str) -> dict[str, float] | None:
    nums = [float(x) for x in re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)]
    xs, ys = nums[0::2], nums[1::2]
    count = min(len(xs), len(ys))
    if count < 2:
        return None
    min_x, max_x = min(xs[:count]), max(xs[:count])
    min_y, max_y = min(ys[:count]), max(ys[:count])
    return {
        "vertex_x": sum(xs[:count]) / count,
        "vertex_y": sum(ys[:count]) / count,
        "bbox_x": (min_x + max_x) / 2,
        "bbox_y": (min_y + max_y) / 2,
    }


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    majors = [n for n in data["nations"] if n.get("kind") == "major"]
    print(f"{'Nation':<12} {'vertex':<18} {'bbox center':<18} {'delta':>8}")
    for nation in sorted(majors, key=lambda row: row["id"]):
        metrics = path_metrics(nation["d"])
        if not metrics:
            continue
        dx = metrics["bbox_x"] - metrics["vertex_x"]
        dy = metrics["bbox_y"] - metrics["vertex_y"]
        delta = (dx * dx + dy * dy) ** 0.5
        print(
            f"{nation['id']:<12}"
            f" ({metrics['vertex_x']:7.1f},{metrics['vertex_y']:7.1f})"
            f"  ({metrics['bbox_x']:7.1f},{metrics['bbox_y']:7.1f})"
            f"  {delta:7.1f}"
        )


if __name__ == "__main__":
    main()
