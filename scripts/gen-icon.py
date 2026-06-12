#!/usr/bin/env python3
"""
Generate a 512x512 .ico from the face prefab's default expression
(open eyes, smile mouth).  Output defaults to www/static/img/favicon.ico.
Usage: python3 scripts/gen-icon.py [output.ico]
"""
import io
import os
import struct
import sys
from PIL import Image, ImageDraw

SIZE  = 512
SCALE = 0.75   # maps ±300 face coords to ±225 px, comfortably inside ±256
BG    = "#191919"


def to_px(x, y):
    c = SIZE // 2
    return (c + round(x * SCALE), c + round(y * SCALE))


def tri(draw, color, v1, v2, v3):
    draw.polygon([to_px(*v1), to_px(*v2), to_px(*v3)], fill=color)


def quad(draw, color, v1, v2, v3, v4):
    tri(draw, color, v1, v2, v3)
    tri(draw, color, v2, v3, v4)


def render_face(draw):
    # eyes: open
    quad(draw, "#FFFFFF", (-300, -300), (-100, -250), (-300, -100), (-100, -100))
    quad(draw, "#FFFFFF", ( 300, -300), ( 100, -250), ( 300, -100), ( 100, -100))
    # mouth: smile (outer white, then inner dark cutout on top)
    tri( draw, "#FFFFFF", (-100,  100), ( 100,  100), (   0,  300))
    tri( draw, BG,        ( -50,  100), (  50,  100), (   0,  200))


def save_ico(img, path):
    """Write a Vista ICO file with the image PNG-compressed inside.
    Pillow's built-in ICO encoder mishandles sizes above 256px."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    png = buf.getvalue()
    # bWidth/bHeight are 0 for images > 255px; actual size comes from the PNG header.
    header = struct.pack("<HHH", 0, 1, 1)           # reserved, type=1, count=1
    entry  = struct.pack("<BBBBHHII",
        0, 0,        # width, height (0 = read from PNG for >255px)
        0, 0,        # color count, reserved
        1, 32,       # planes, bit depth
        len(png),    # size of PNG data
        22,          # offset = 6 (header) + 16 (one entry)
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(header + entry + png)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "www", "static", "img", "favicon.ico"
    )
    out = os.path.abspath(out)

    img  = Image.new("RGB", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(img)
    render_face(draw)
    save_ico(img, out)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
