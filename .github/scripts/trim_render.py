#!/usr/bin/env python3
"""Trim the transparent margin around a KiCad render and save it as a web-sized WebP."""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
if box:
    pad = 6
    box = (max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, im.width), min(box[3] + pad, im.height))
    im = im.crop(box)
im.thumbnail((900, 1200), Image.LANCZOS)
im.save(dst, "WEBP", quality=88, method=6)
print(f"{dst}: {im.width}x{im.height}")
