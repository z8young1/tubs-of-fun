"""Build the client preview into docs/ for GitHub Pages.

site/index.html is page content only (no doctype/head/body). This wraps it in a full
document, moves its leading <title>/<meta>/<link>/JSON-LD into <head>, adds link-preview
tags, and marks the draft noindex so it never competes with tubsoffun.com in search.

    python3 build.py
"""
import os
import shutil

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "site")
OUT = os.path.join(HERE, "docs")
PUBLIC_URL = "https://z8young1.github.io/tubs-of-fun/"
HEAD_END_MARKER = '<svg width="0" height="0"'

page = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
split = page.index(HEAD_END_MARKER)
head_extra, body = page[:split].strip(), page[split:]
# The artifact keeps its gallery name; the client sees a real site title in the tab
head_extra = head_extra.replace(
    "<title>Tubs of Fun! Redesign</title>",
    "<title>Tubs of Fun! | Hot Tubs &amp; Swim Spas in West Fargo, ND</title>",
)

share_title = "Tubs of Fun! Homepage Preview"
share_desc = "A first look at the new tubsoffun.com: book a test dip, call the showroom, come sit in it."

head = f"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta property="og:type" content="website">
<meta property="og:title" content="{share_title}">
<meta property="og:description" content="{share_desc}">
<meta property="og:image" content="{PUBLIC_URL}og.jpg">
<meta property="og:url" content="{PUBLIC_URL}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>♨️</text></svg>">
{head_extra}"""

html = f'<!doctype html>\n<html lang="en">\n<head>\n{head}\n</head>\n<body>\n{body}\n</body>\n</html>\n'

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)
for name in ("styles.css", "main.js"):
    shutil.copy2(os.path.join(SRC, name), os.path.join(OUT, name))
shutil.copytree(os.path.join(SRC, "img"), os.path.join(OUT, "img"))

# 1200x630 share image cropped from the hero photo
hero = Image.open(os.path.join(SRC, "img", "hero-valley.webp")).convert("RGB")
target = 1200 / 630
w, h = hero.size
if w / h > target:
    nw = int(h * target)
    hero = hero.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
else:
    nh = int(w / target)
    hero = hero.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
hero.resize((1200, 630), Image.LANCZOS).save(os.path.join(OUT, "og.jpg"), quality=85)

with open(os.path.join(OUT, "robots.txt"), "w") as f:
    f.write("User-agent: *\nDisallow: /\n")
open(os.path.join(OUT, ".nojekyll"), "w").close()

print("built", OUT)
