"""Resize gauntlet cursor asset for Royal Armies custom DOM cursor."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "images" / "gamecursor.png"
OUT = ROOT / "public" / "images" / "cursor.png"
TARGET = 56


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    margin = 4
    max_w = TARGET - margin
    max_h = TARGET - margin
    img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (TARGET, TARGET), (0, 0, 0, 0))
    # Anchor bottom-right so the pointing fingertip sits near the top-left hotspot.
    offset_x = TARGET - img.width - margin
    offset_y = TARGET - img.height - margin
    canvas.paste(img, (offset_x, offset_y), img)
    canvas.save(OUT)

    pixels = canvas.load()
    opaque = [
        (x, y)
        for y in range(TARGET)
        for x in range(TARGET)
        if pixels[x, y][3] > 100
    ]
    if opaque:
        opaque.sort(key=lambda point: (point[0] + point[1] * 0.65))
        hotspot_x, hotspot_y = opaque[0]
    else:
        hotspot_x, hotspot_y = margin, margin

    print(f"Saved {OUT} ({TARGET}x{TARGET})")
    print(f"Suggested hotspot: {hotspot_x}, {hotspot_y}")


if __name__ == "__main__":
    main()
