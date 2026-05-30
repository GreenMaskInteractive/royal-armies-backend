import re
from pathlib import Path

SVG = Path(__file__).resolve().parents[1] / "public" / "images" / "Regionmap1.svg"
FILL = "#0003f6"
MIN = 100
MAX_SPAN = 1660
text = SVG.read_text(encoding="utf-8")
blocks = re.findall(r"<path\s+([^>]*?)\s*/>", text, re.S | re.I)

for path_index, attrs in enumerate(blocks):
    fill_m = re.search(r'fill="([^"]*)"', attrs, re.I)
    if not fill_m or fill_m.group(1).lower() != FILL:
        continue
    dm = re.search(r'\sd="([\s\S]*?)"', attrs, re.I)
    if not dm:
        continue
    parts = re.split(r"\s+(?=M\s)", " ".join(dm.group(1).split()), flags=re.I)
    for si, part in enumerate(parts):
        nums = [float(x) for x in re.findall(r"[-]?\d*\.?\d+", part)]
        if len(nums) < MIN:
            continue
        xs, ys = nums[0::2], nums[1::2]
        span = max(max(xs) - min(xs), max(ys) - min(ys))
        if span > MAX_SPAN:
            continue
        print(f"{path_index}:{si} c=({sum(xs)/len(xs):.0f},{sum(ys)/len(ys):.0f}) span={span:.0f}")
