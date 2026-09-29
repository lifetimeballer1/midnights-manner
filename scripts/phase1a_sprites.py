"""Generate only the ten original Phase 1A frontier sprites (Python + Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'sprites'
INK = '#0b1220'
WOOD = '#987046'
PALE = '#d9c8a1'


def canvas():
    image = Image.new('RGBA', (32, 32))
    return image, ImageDraw.Draw(image)


def save(image, name):
    original = image.copy().load()
    pixels = image.load()
    solid = lambda x, y: 0 <= x < 32 and 0 <= y < 32 and original[x, y][3] >= 200
    for y in range(32):
        for x in range(32):
            if pixels[x, y][3] < 40 and any(solid(a, b) for a, b in ((x-1, y), (x+1, y), (x, y-1), (x, y+1))):
                pixels[x, y] = (11, 18, 32, 255)
    rows = [y for y in range(32) for x in range(32) if pixels[x, y][3] >= 200]
    mid = (min(rows) + max(rows)) // 2
    for y in range(32):
        for x in range(32):
            r, g, b, a = pixels[x, y]
            if a >= 200:
                pixels[x, y] = tuple(min(255, int(c * 1.07 + 6)) if y <= mid else int(c * .84) for c in (r, g, b)) + (a,)
    image.save(OUT / (name + '.png'))
    print('saved', name)


for tier in (1, 2):
    im, d = canvas()
    for x, y in ((9, 22), (23, 19)):
        d.rectangle((x-1, y-8, x+1, y+4), fill=WOOD)
        d.polygon([(x, y-19), (x-7, y-5), (x+7, y-5)], fill='#385a3e', outline=INK)
        d.polygon([(x, y-14), (x-6, y), (x+6, y)], fill='#648252', outline=INK)
        for cut in (y+1, y+3):
            d.line((x-1, cut, x+1, cut), fill=PALE)
    for y in range(27, 27-tier*3, -3):
        d.rectangle((4, y, 18, y+2), fill=WOOD, outline=INK)
        d.point((5, y+1), fill=PALE)
    if tier == 2:
        d.line((3, 23, 3, 30), fill=WOOD, width=2)
        d.line((20, 23, 20, 30), fill=WOOD, width=2)
        d.polygon([(1, 23), (11, 18), (22, 23)], fill='#60897b', outline=INK)
        d.line((24, 25, 29, 30), fill=WOOD, width=2)
        d.line((29, 25, 24, 30), fill=WOOD, width=2)
    save(im, f'whisper-grove-{tier}')

im, d = canvas()
d.rectangle((11, 23, 14, 29), fill=INK)
d.rectangle((20, 23, 23, 29), fill=INK)
d.polygon([(9, 24), (12, 12), (23, 12), (26, 24)], fill='#a2683e', outline=INK)
d.rectangle((13, 6, 22, 13), fill='#e1b68b', outline=INK)
d.polygon([(10, 8), (17, 1), (25, 8)], fill='#a2683e', outline=INK)
d.line((10, 7, 10, 16), fill='#a2683e', width=2)
d.line((7, 15, 7, 29), fill=WOOD, width=2)
d.polygon([(7, 14), (2, 11), (1, 18), (7, 18)], fill='#b7c8ca', outline=INK)
d.line((14, 18, 20, 18), fill=PALE)
d.line((14, 20, 20, 20), fill=PALE)
save(im, 'troop_heartwarden_32x32')

im, d = canvas()
d.line((11, 29, 16, 5), fill=WOOD, width=3)
d.polygon([(16, 5), (27, 2), (29, 13), (15, 11)], fill='#b7c8ca', outline=INK)
d.line((12, 21, 16, 21), fill=PALE)
d.line((12, 24, 15, 24), fill=PALE)
save(im, 'item-heartwood-axe')

im, d = canvas()
d.polygon([(9, 8), (14, 4), (18, 4), (23, 8), (28, 19), (23, 21), (22, 29), (10, 29), (9, 21), (4, 19)], fill='#b08349', outline=INK)
d.line((16, 8, 16, 28), fill=INK)
for y in (12, 17, 22):
    d.point((18, y), fill=PALE)
d.line((10, 24, 22, 24), fill=PALE)
d.line((10, 26, 22, 26), fill=PALE)
save(im, 'item-whisper-coat')

for tier in (1, 2):
    im, d = canvas()
    d.ellipse((2, 17, 30, 30), fill='#385f68', outline=INK)
    for x in (5, 10, 15, 20, 25):
        d.line((x, 16, x, 27), fill=WOOD, width=2)
    d.line((4, 17, 26, 17), fill=PALE, width=2)
    d.rectangle((3, 26, 28, 28), fill=WOOD, outline=INK)
    d.line((25, 10, 25, 27), fill=WOOD, width=2)
    d.line((26, 12, 28, 18), fill='#eee5d0', width=2)
    if tier == 2:
        d.line((5, 13, 5, 23), fill=WOOD, width=2)
        d.line((18, 13, 18, 23), fill=WOOD, width=2)
        d.line((4, 13, 19, 13), fill=WOOD, width=2)
        d.rectangle((7, 14, 16, 20), fill='#8d7654', outline=INK)
        d.polygon([(18, 25), (24, 22), (30, 25)], fill='#60897b', outline=INK)
    save(im, f'blackwater-weir-{tier}')

im, d = canvas()
d.rectangle((12, 22, 15, 29), fill=INK)
d.rectangle((20, 22, 23, 29), fill=INK)
d.polygon([(9, 25), (12, 12), (23, 12), (26, 25)], fill='#385f68', outline=INK)
d.rectangle((13, 6, 22, 13), fill='#e1b68b', outline=INK)
d.rectangle((8, 5, 27, 8), fill=PALE, outline=INK)
d.polygon([(12, 5), (16, 1), (23, 5)], fill=PALE, outline=INK)
d.line((5, 14, 5, 30), fill=WOOD, width=2)
d.ellipse((1, 9, 9, 20), outline='#7eac9b', width=2)
d.rectangle((22, 21, 29, 27), fill=WOOD, outline=INK)
save(im, 'troop_mudlark_32x32')

im, d = canvas()
d.line((10, 29, 19, 10), fill=WOOD, width=3)
d.ellipse((11, 2, 29, 19), fill='#385f6855', outline=PALE, width=2)
for x in (16, 20, 24):
    d.line((x, 5, x, 16), fill='#7eac9b')
for y in (7, 11, 15):
    d.line((15, y, 25, y), fill='#7eac9b')
save(im, 'item-blackwater-net')

im, d = canvas()
d.polygon([(8, 8), (13, 3), (19, 3), (24, 8), (29, 20), (23, 21), (25, 29), (7, 29), (9, 21), (3, 20)], fill='#385f68', outline=INK)
d.rectangle((12, 5, 20, 10), fill=PALE, outline=INK)
d.line((16, 10, 16, 28), fill=INK)
d.line((8, 26, 24, 26), fill='#7eac9b', width=2)
save(im, 'item-mire-coat')
