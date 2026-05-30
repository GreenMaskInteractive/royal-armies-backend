"""List subpaths from Regionmap1.svg."""
import re
from pathlib import Path

SVG = Path(__file__).resolve().parents[1] / "public" / "images" / "Regionmap1.svg"
FILL = "#0003f6"
text = SVG.read_text(encoding="utf-8")
blocks = re.findall(r"<path\s+([^>]*?)\s*/>", text, re.S | re.I)

for path_index, attrs in enumerate(blocks):
    fill_m = re.search(r'fill="([^"]*)"', attrs, re.I)
    if not fill_m or fill_m.group(1).lower() != FILL:
        continue
    dm = re.search(r'\sd="([\s\S]*?)"', attrs, re.I)
    if not dm:
        continue
    raw = dm.group(1)
    parts = re.split(r"(?=\sM\s)", raw.strip())
    for si, part in enumerate(parts):
        part = part.strip()
        nums = re.findall(r"[-]?\d*\.?\d+", part)
        print(f"{path_index}:{si} tokens={len(nums)} chars={len(part)}")
