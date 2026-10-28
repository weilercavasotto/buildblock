"""
Builds the two logos with the name (public/logo-horizontal.svg and public/logo-stacked.svg) from the brick icon (public/logo-mark.svg) and the
Orbitron font of the game (Black weight, turned into paths so the logos need no font): the letters have a darker underside like the brick,
"Build" is light and "Block" brick red. Run it again after changing the icon or the colours:

    python3 -m venv .venv && .venv/bin/pip install fonttools brotli && .venv/bin/python packaging/make-logo.py
"""
import os, re, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
font = instancer.instantiateVariableFont(TTFont(f'{root}/node_modules/@fontsource-variable/orbitron/files/orbitron-latin-wght-normal.woff2'), {'wght': 900})
gs = font.getGlyphSet(); cmap = font.getBestCmap()

icon_src = open(f'{root}/public/logo-mark.svg').read()
icon_inner = re.search(r'<svg[^>]*>(.*)</svg>', icon_src, re.S).group(1)
icon_inner = re.sub(r'\s*<title>.*?</title>', '', icon_inner, flags=re.S).strip()

TRACK = -14          # font units between letters
GAP = 30             # extra between "Build" and "Block"
EXTRUDE = 44         # depth of the letters' darker underside, in font units
WORDS = [('Build', '#f3f5f9', '#8c95a7'), ('Block', '#ef6a5f', '#a9322b')]

def layout():
    """The letters of the wordmark as (kind, x, path/None, colours), in font units (y up, baseline 0), and the total width."""
    x = 0
    items = []
    for w, (word, top, side) in enumerate(WORDS):
        for ch in word:
            g = cmap[ord(ch)]
            adv = gs[g].width
            pen = SVGPathPen(gs)
            gs[g].draw(pen)
            items.append(('glyph', x, pen.getCommands(), (top, side), adv))
            x += adv + TRACK
        if w == 0:
            x += GAP
    return items, x - TRACK

ITEMS, WIDTH = layout()

def wordmark(scale, ox, baseline):
    """The wordmark as SVG, its left edge at ox and its baseline at `baseline` (px)."""
    out = [f'<g transform="translate({ox} {baseline}) scale({scale} {-scale})">']
    # the undersides first (shifted down in the picture = negative y in font units), then the faces
    for kind, x, d, (top, side), adv in ITEMS:
        if kind == 'glyph':
            out.append(f'<path transform="translate({x} {-EXTRUDE})" d="{d}" fill="{side}"/>')
    for kind, x, d, (top, side), adv in ITEMS:
        if kind == 'glyph':
            out.append(f'<path transform="translate({x} 0)" d="{d}" fill="{top}"/>')
    out.append('</g>')
    return '\n'.join(out)

def svg(width, height, body, desc):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img">\n'
            f'  <title>BuildBlock</title>\n  <desc>{desc}</desc>\n{body}\n</svg>\n')

# --- horizontal: icon on the left, wordmark on the right, centred on the same line
S = 0.09
text_w = WIDTH * S
icon_scale = 1.0
gap = 22
H_W = round(128 * icon_scale + gap + text_w + 12)
H_H = 128
icon_h = f'<g>{icon_inner}</g>'
base_h = 65 + (770 * S) / 2 - 2   # the ascender line and the baseline centred on the middle of the brick
horizontal = svg(H_W, H_H, f'  <g transform="translate(0 0)">{icon_h}</g>\n' + wordmark(S, 128 + gap, round(base_h, 2)), 'BuildBlock logo: the brick with a wheel, and the name beside it')
open(f'{root}/public/logo-horizontal.svg', 'w').write(horizontal)

# --- stacked: the brick above, the wordmark under it, both centred
S2 = 0.085
text_w2 = WIDTH * S2
ICON = 1.25
S_W = round(max(text_w2, 128 * ICON) + 40)
icon_x = (S_W - 128 * ICON) / 2
S_H = round(128 * ICON - 10 + 22 + 770 * S2 + 22)
base2 = round(128 * ICON - 10 + 22 + 770 * S2, 2)
stacked = svg(S_W, S_H, f'  <g transform="translate({round(icon_x,2)} -8) scale({ICON})">{icon_inner}</g>\n' + wordmark(S2, round((S_W - text_w2) / 2, 2), base2), 'BuildBlock logo: the brick with a wheel, and the name under it')
open(f'{root}/public/logo-stacked.svg', 'w').write(stacked)
print(H_W, H_H, S_W, S_H, round(text_w), round(text_w2))
