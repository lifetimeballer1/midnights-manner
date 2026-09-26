"""One-off: 7 distinct placeholder sprites for extended-pass content."""
from PIL import Image, ImageDraw
from pathlib import Path
out = Path('assets/sprites')
ink = '#0b1220'
OUTLINE = (11, 18, 32, 255)

def canvas():
    im = Image.new('RGBA', (32, 32))
    return im, ImageDraw.Draw(im)

def save(im, name):
    # Immutable-mask outline: read solidity from a copy so fresh ink never
    # counts as solid (fixes the +x/+y cascade; see generate_art_pass.py).
    original = im.copy().load()
    px = im.load(); w, h = im.size
    solid = lambda x, y: 0 <= x < w and 0 <= y < h and original[x, y][3] >= 200
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 40 and (solid(x+1, y) or solid(x-1, y) or solid(x, y+1) or solid(x, y-1)):
                px[x, y] = OUTLINE
    ys = [y for y in range(h) for x in range(w) if px[x, y][3] >= 200]
    if ys:
        mid = (min(ys) + max(ys)) // 2
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a >= 200:
                    if y <= mid: px[x, y] = (min(255, int(r*1.07+6)), min(255, int(g*1.07+6)), min(255, int(b*1.07+6)), a)
                    else: px[x, y] = (int(r*.84), int(g*.84), int(b*.84), a)
    im.save(out / (name + '.png'))
    print('saved', name)

# WARDEN: bulky tower-shield tank, slate blue + bronze boss
im, d = canvas()
d.ellipse((9, 26, 24, 30), fill='#17272b88')
d.rectangle((12, 21, 15, 28), fill=ink); d.rectangle((19, 21, 22, 28), fill=ink)
d.rectangle((4, 10, 15, 26), fill='#5f7b96', outline=ink)  # tower shield
d.ellipse((8, 16, 12, 20), fill='#f2c96e', outline=ink)   # shield boss
d.rectangle((16, 12, 26, 23), fill='#4d5f78', outline=ink)  # plate body
d.rectangle((17, 5, 25, 12), fill='#e1b68b', outline=ink)  # helm face
d.rectangle((16, 2, 26, 6), fill='#5f7b96', outline=ink)   # helm cap
d.point((23, 8), fill=ink)
save(im, 'warden')

# RANGER: hooded long-range skirmisher, deep green + leather
im, d = canvas()
d.ellipse((9, 26, 24, 30), fill='#17272b88')
d.rectangle((12, 21, 15, 28), fill=ink); d.rectangle((19, 21, 22, 28), fill=ink)
d.polygon([(9, 24), (12, 12), (22, 12), (25, 24)], fill='#3f6b4e', outline=ink)
d.rectangle((14, 7, 22, 13), fill='#e1b68b', outline=ink)
d.polygon([(10, 9), (17, 1), (25, 9)], fill='#2c4e3d', outline=ink)  # hood
d.point((20, 10), fill=ink)
d.arc((24, 4, 31, 27), 270, 90, fill='#96592c', width=2)  # longbow
d.line((27, 4, 27, 27), fill='#e9dab2')
save(im, 'ranger')

# FORAGER: basket carrier, russet + wicker
im, d = canvas()
d.ellipse((9, 26, 24, 30), fill='#17272b88')
d.rectangle((12, 21, 15, 28), fill=ink); d.rectangle((19, 21, 22, 28), fill=ink)
d.polygon([(11, 24), (13, 13), (21, 13), (23, 24)], fill='#a85f3f', outline=ink)
d.rectangle((13, 6, 22, 13), fill='#e1b68b', outline=ink)
d.rectangle((11, 3, 24, 6), fill='#7a4a2e', outline=ink)  # headwrap
d.rectangle((24, 16, 30, 24), fill='#c7a05a', outline=ink)  # basket
d.point((26, 18), fill='#7a2e3f'); d.point((28, 20), fill='#3f6b4e'); d.point((25, 21), fill='#f2c96e')
d.point((20, 9), fill=ink)
save(im, 'forager')

# GROVE tier 1: moonberry bushes
im, d = canvas()
d.polygon([(1, 14), (18, 6), (31, 17), (14, 30)], fill='#2c4e3d', outline=ink)
for cx, cy in [(9, 16), (16, 13), (21, 19), (12, 22)]:
    d.ellipse((cx-4, cy-4, cx+4, cy+4), fill='#3f6b4e', outline=ink)
    d.point((cx-1, cy-1), fill='#7a5f9e'); d.point((cx+2, cy+1), fill='#9a7fc9'); d.point((cx, cy+2), fill='#7a5f9e')
save(im, 'grove-1')

# GROVE tier 2: bushes + lantern post
im, d = canvas()
d.polygon([(1, 14), (18, 6), (31, 17), (14, 30)], fill='#2c4e3d', outline=ink)
for cx, cy in [(8, 17), (15, 13), (22, 18)]:
    d.ellipse((cx-5, cy-5, cx+5, cy+5), fill='#4c805f', outline=ink)
    d.point((cx-1, cy-1), fill='#9a7fc9'); d.point((cx+2, cy+1), fill='#c9a9e8')
d.rectangle((24, 4, 27, 20), fill='#5d4430', outline=ink)
d.rectangle((22, 1, 29, 6), fill='#f2c96e', outline=ink)
save(im, 'grove-2')

# WATCHFIRE tier 1: stone brazier
im, d = canvas()
d.polygon([(6, 29), (10, 18), (22, 18), (26, 29)], fill='#78778c', outline=ink)
d.rectangle((8, 14, 24, 19), fill='#3d2c22', outline=ink)
d.polygon([(13, 14), (16, 5), (19, 14)], fill='#e8873f', outline=ink)
d.polygon([(15, 14), (16, 9), (17, 14)], fill='#ffe9a8')
save(im, 'watchfire-1')

# WATCHFIRE tier 2: taller + gold trim + bigger flame
im, d = canvas()
d.polygon([(5, 29), (9, 14), (23, 14), (27, 29)], fill='#78778c', outline=ink)
d.rectangle((5, 24, 27, 27), fill='#f2c96e', outline=ink)
d.rectangle((7, 10, 25, 15), fill='#3d2c22', outline=ink)
d.polygon([(11, 10), (16, 0), (21, 10)], fill='#e8873f', outline=ink)
d.polygon([(14, 10), (16, 4), (18, 10)], fill='#fff3c0')
save(im, 'watchfire-2')
print('done')
