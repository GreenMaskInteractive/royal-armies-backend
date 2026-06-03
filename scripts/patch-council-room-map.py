#!/usr/bin/env python3
"""Replace Headquarters workspace block in agealpha.html with Council Room MAP."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "public" / "agealpha.html"
FRAG = ROOT / "public" / "council-room-workspace.fragment.html"

START = '            <div id="age-headquarters-workspace"'
END = '            <div id="age-hq-dispatch-panel"'

def main():
    text = HTML.read_text(encoding="utf-8")
    frag = FRAG.read_text(encoding="utf-8").strip() + "\n\n"
    i = text.find(START)
    j = text.find(END)
    if i < 0 or j < 0 or j <= i:
        raise SystemExit(f"markers not found: start={i} end={j}")
    HTML.write_text(text[:i] + frag + text[j:], encoding="utf-8")
    print("patched", HTML)

if __name__ == "__main__":
    main()
