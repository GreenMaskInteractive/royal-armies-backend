"""Summarize Regionmap1.svg paths for nation map overlay."""
import re
from collections import Counter
from pathlib import Path

SVG = Path(__file__).resolve().parents[1] / "public" / "images" / "Regionmap1.svg"
text = SVG.read_text(encoding="utf-8", errors="replace")

vb = re.search(r'viewBox="([^"]+)"', text, re.I)
print("viewBox:", vb.group(1) if vb else "?")

paths = list(re.finditer(r"<path\s+([^>]*?)\s*/>", text, re.S | re.I))
print("path count:", len(paths))

fills = Counter()
for i, m in enumerate(paths):
    attrs = m.group(1)
    fill = re.search(r'fill="([^"]*)"', attrs, re.I)
    fill = fill.group(1).lower() if fill else "(none)"
    fills[fill] += 1
    pid = re.search(r'\bid="([^"]*)"', attrs, re.I)
    dm = re.search(r'\sd="([\s\S]*?)"', attrs, re.I)
    d_len = len(dm.group(1)) if dm else 0
    if i < 8 or d_len > 5000:
        print(f"  {i}: id={pid.group(1) if pid else ''} fill={fill} d_len={d_len}")

print("fills:", fills.most_common(10))
