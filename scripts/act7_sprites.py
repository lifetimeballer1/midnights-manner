"""Act VII: Oath, Song & Siege-Craft — 25 original sprites, house conventions.

Run on the box (Pillow lives there): python3 scripts/act7_sprites.py
Troops read as distinct silhouettes at 32px; buildings tier up visibly;
items are simple centered icons. Same ink/shadow/moon-shade pass as every
prior generator — see scripts/generate_sprites.py::save.
"""
from PIL import Image, ImageDraw
from pathlib import Path

out = Path(__file__).resolve().parents[1] / 'assets' / 'sprites'
out.mkdir(parents=True, exist_ok=True)
ink = '#0b1220'
OUTLINE = (11, 18, 32, 255)

GOLD = '#f2c96e'
GLOW = '#ffe9a8'
FLAME = '#e8873f'
TIMBER = '#96592c'
DARK = '#5d4430'
STONE = '#78778c'
RIM = '#bcd3e0'
LIGHT = '#e9dab2'
SKIN = '#e1b68b'


def canvas():
    im = Image.new('RGBA', (32, 32))
    return im, ImageDraw.Draw(im)


def save(im, name):
    original = im.copy().load()
    px = im.load()
    w, h = im.size
    solid = lambda x, y: 0 <= x < w and 0 <= y < h and original[x, y][3] >= 200
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 40 and (solid(x + 1, y) or solid(x - 1, y) or solid(x, y + 1) or solid(x, y - 1)):
                px[x, y] = OUTLINE
    ys = [y for y in range(h) for x in range(w) if px[x, y][3] >= 200]
    if ys:
        mid = (min(ys) + max(ys)) // 2
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a >= 200:
                    if y <= mid:
                        px[x, y] = (min(255, int(r * 1.07 + 6)), min(255, int(g * 1.07 + 6)), min(255, int(b * 1.07 + 6)), a)
                    else:
                        px[x, y] = (int(r * .84), int(g * .84), int(b * .84), a)
    im.save(out / (name + '.png'))
    print('saved', name)


def legs(d, fill=ink):
    d.rectangle((12, 21, 15, 28), fill=fill)
    d.rectangle((19, 21, 22, 28), fill=fill)


def shadow(d):
    d.ellipse((9, 26, 24, 30), fill='#17272b88')


# ---- TROOPS ----
# OATHSWORN: heavy pale-plate guard, long oathblade held upright
im, d = canvas()
shadow(d); legs(d)
d.rectangle((11, 12, 23, 24), fill='#8fa3bd', outline=ink)  # plate torso
d.line((11, 16, 23, 16), fill=RIM, width=1)  # plate band
d.rectangle((13, 5, 21, 12), fill=SKIN, outline=ink)  # helm face
d.rectangle((12, 2, 22, 6), fill='#8fa3bd', outline=ink)  # helm cap
d.point((19, 8), fill=ink)
d.rectangle((25, 2, 27, 24), fill=RIM, outline=ink)  # oathblade
d.rectangle((23, 20, 29, 22), fill=GOLD, outline=ink)  # crossguard
save(im, 'oathsworn')

# CHORISTER: pale-robed singer, open hymnal with gold notes
im, d = canvas()
shadow(d); legs(d)
d.polygon([(10, 24), (13, 12), (21, 12), (24, 24)], fill='#cfd8ea', outline=ink)
d.rectangle((14, 6, 20, 12), fill=SKIN, outline=ink)
d.rectangle((12, 3, 22, 6), fill='#9aa7c4', outline=ink)  # circlet cap
d.point((18, 9), fill=ink)
d.polygon([(22, 18), (27, 16), (27, 22), (22, 24)], fill=LIGHT, outline=ink)  # hymnal
d.point((24, 18), fill=GOLD); d.point((25, 20), fill=GOLD)
save(im, 'chorister')

# HALBERDIER: red-tabard soldier, long halberd
im, d = canvas()
shadow(d); legs(d)
d.rectangle((12, 12, 22, 24), fill='#a33f31', outline=ink)  # red tabard
d.line((12, 15, 22, 15), fill=GOLD, width=1)  # banner trim
d.rectangle((14, 6, 20, 12), fill=SKIN, outline=ink)
d.rectangle((13, 3, 21, 6), fill='#5d4430', outline=ink)  # cap
d.point((18, 9), fill=ink)
d.line((26, 2, 26, 28), fill=TIMBER, width=2)  # haft
d.polygon([(26, 2), (31, 6), (26, 10)], fill=RIM, outline=ink)  # axe blade
save(im, 'halberdier')

# LONGBOWMAN: grey-green cloak, tall bow
im, d = canvas()
shadow(d); legs(d)
d.polygon([(10, 24), (13, 12), (21, 12), (24, 24)], fill='#6b7f5e', outline=ink)
d.rectangle((14, 6, 20, 12), fill=SKIN, outline=ink)
d.polygon([(11, 8), (17, 2), (23, 8)], fill='#4c5a44', outline=ink)  # hood
d.point((18, 9), fill=ink)
d.arc((24, 1, 31, 28), 270, 90, fill=TIMBER, width=2)  # longbow
d.line((27, 1, 27, 28), fill=LIGHT)
save(im, 'longbowman')

# ---- BUILDINGS ----
# OATHSTONE: tall pale standing stone, gold oath-rune
im, d = canvas()
d.ellipse((8, 26, 25, 30), fill='#17272b88')
d.polygon([(10, 28), (11, 6), (16, 1), (21, 6), (22, 28)], fill=RIM, outline=ink)
d.line((15, 8, 15, 20), fill=GOLD, width=1)
d.line((13, 12, 17, 12), fill=GOLD, width=1)
d.line((13, 17, 17, 17), fill=GOLD, width=1)
save(im, 'oathstone-1')

# FIRE-TRAP: dark iron grate, flames licking up
im, d = canvas()
d.rectangle((6, 22, 26, 28), fill='#2b2f38', outline=ink)
for x in (10, 14, 18, 22):
    d.line((x, 22, x, 28), fill='#4c525f', width=1)
d.polygon([(11, 22), (14, 10), (17, 22)], fill=FLAME, outline=ink)
d.polygon([(18, 22), (21, 13), (24, 22)], fill=FLAME, outline=ink)
d.polygon([(13, 22), (14, 16), (15, 22)], fill=GLOW)
d.polygon([(20, 22), (21, 17), (22, 22)], fill=GLOW)
save(im, 'fire-trap-1')

# TOWER tier 4: tallest yet, stone + gold crown trim + pennant
im, d = canvas()
d.ellipse((6, 27, 26, 31), fill='#17272b88')
d.rectangle((10, 8, 22, 29), fill=STONE, outline=ink)
d.rectangle((8, 4, 24, 9), fill='#627888', outline=ink)
d.rectangle((8, 9, 24, 11), fill=GOLD, outline=ink)  # crown trim
d.rectangle((14, 14, 18, 20), fill=GLOW, outline=ink)  # lit window
d.line((16, 4, 16, 0), fill=LIGHT)
d.polygon([(16, 0), (24, 1), (16, 3)], fill=GOLD)  # pennant
save(im, 'tower-4')

# WATCHFIRE tier 3: grand brazier, gold band, tall flame
im, d = canvas()
d.polygon([(4, 29), (8, 12), (24, 12), (28, 29)], fill=STONE, outline=ink)
d.rectangle((4, 23, 28, 26), fill=GOLD, outline=ink)
d.rectangle((6, 8, 26, 13), fill=DARK, outline=ink)
d.polygon([(10, 8), (16, 0), (22, 8)], fill=FLAME, outline=ink)
d.polygon([(13, 8), (16, 2), (19, 8)], fill=GLOW)
save(im, 'watchfire-3')

# CHAPEL tier 3: moonchapel with tall spire and glowing rose window
im, d = canvas()
d.rectangle((6, 16, 26, 29), fill='#7e93a8', outline=ink)
d.polygon([(4, 16), (16, 6), (28, 16)], fill='#3d6f7f', outline=ink)
d.rectangle((14, 0, 18, 8), fill='#627888', outline=ink)  # spire
d.polygon([(13, 1), (16, -1), (19, 1)], fill=GOLD)
d.ellipse((12, 19, 20, 27), fill=GLOW, outline=ink)  # rose window
d.point((16, 23), fill=GOLD)
d.rectangle((7, 24, 10, 29), fill=ink)  # door
save(im, 'chapel-3')

# BELLCOTE: small stone arch with hanging gold bell
im, d = canvas()
d.ellipse((9, 27, 23, 31), fill='#17272b88')
d.rectangle((8, 12, 12, 29), fill=STONE, outline=ink)
d.rectangle((20, 12, 24, 29), fill=STONE, outline=ink)
d.polygon([(6, 12), (16, 2), (26, 12)], fill='#627888', outline=ink)
d.line((16, 8, 16, 12), fill=ink, width=1)
d.polygon([(12, 18), (16, 12), (20, 18)], fill=GOLD, outline=ink)  # bell
d.point((16, 19), fill=ink)
save(im, 'bellcote-1')

# SCHOOLROOM tier 1: timber school + primer sign
im, d = canvas()
d.rectangle((5, 14, 27, 29), fill=TIMBER, outline=ink)
d.polygon([(3, 14), (16, 4), (29, 14)], fill='#3d6f7f', outline=ink)
d.rectangle((9, 19, 13, 23), fill=GLOW, outline=ink)
d.rectangle((19, 19, 23, 23), fill=GLOW, outline=ink)
d.rectangle((14, 22, 18, 29), fill=ink)  # door
d.rectangle((22, 6, 28, 12), fill=LIGHT, outline=ink)  # primer sign
d.line((24, 8, 26, 8), fill=ink, width=1)
d.line((24, 10, 26, 10), fill=ink, width=1)
save(im, 'schoolroom-1')

# SCHOOLROOM tier 2: stone chimney, warm windows, second book
im, d = canvas()
d.rectangle((5, 14, 27, 29), fill=TIMBER, outline=ink)
d.polygon([(3, 14), (16, 4), (29, 14)], fill='#3d6f7f', outline=ink)
d.rectangle((22, 2, 26, 12), fill=STONE, outline=ink)  # chimney
d.point((24, 0), fill='#9aa7c4'); d.point((25, 1), fill='#9aa7c4')
d.rectangle((9, 19, 13, 23), fill=GLOW, outline=ink)
d.rectangle((19, 19, 23, 23), fill=GLOW, outline=ink)
d.rectangle((14, 22, 18, 29), fill=ink)
d.rectangle((2, 6, 8, 12), fill=LIGHT, outline=ink)
d.rectangle((24, 6, 30, 12), fill=LIGHT, outline=ink)  # two primers now
save(im, 'schoolroom-2')

# FLETCHER: low workshop, arrow bundle on the rack
im, d = canvas()
d.rectangle((4, 16, 28, 29), fill=TIMBER, outline=ink)
d.polygon([(2, 16), (16, 8), (30, 16)], fill=DARK, outline=ink)
d.rectangle((13, 21, 19, 29), fill=ink)  # door
for x, y in ((8, 10), (11, 8), (14, 10)):
    d.line((x, y, x + 3, y + 6), fill=LIGHT, width=1)  # shafts
    d.polygon([(x + 2, y + 4), (x + 4, y + 6), (x + 2, y + 8)], fill=GOLD)  # fletch
save(im, 'fletcher-1')

# SHIELDWALL YARD: post fence, row of round shields
im, d = canvas()
for x in (4, 11, 18, 25):
    d.rectangle((x, 14, x + 3, 29), fill=DARK, outline=ink)
d.line((2, 16, 30, 16), fill=TIMBER, width=2)
for cx, col in ((8, '#5f7b96'), (16, '#a33f31'), (24, '#6b7f5e')):
    d.ellipse((cx - 4, 17, cx + 4, 25), fill=col, outline=ink)
    d.point((cx, 21), fill=GOLD)
save(im, 'shieldwall-yard-1')

# ---- ITEMS ----
# OATHBLADE: long pale sword, upright
im, d = canvas()
d.rectangle((14, 2, 18, 24), fill=RIM, outline=ink)
d.polygon([(14, 2), (16, 0), (18, 2)], fill=RIM)
d.rectangle((11, 24, 21, 26), fill=GOLD, outline=ink)
d.rectangle((15, 26, 17, 30), fill=DARK, outline=ink)
save(im, 'item-oathblade')

# TOWER SHIELD: tall slate shield, bronze boss
im, d = canvas()
d.rectangle((10, 4, 22, 29), fill='#5f7b96', outline=ink)
d.ellipse((14, 14, 20, 20), fill=GOLD, outline=ink)
d.line((10, 8, 22, 8), fill=RIM, width=1)
save(im, 'item-tower-shield')

# SIEGE TONGS: dark V with rivet
im, d = canvas()
d.line((8, 4, 16, 28), fill='#2b2f38', width=3)
d.line((24, 4, 16, 28), fill='#2b2f38', width=3)
d.line((8, 4, 16, 28), fill='#4c525f', width=1)
d.line((24, 4, 16, 28), fill='#4c525f', width=1)
d.ellipse((13, 5, 19, 11), fill=GOLD, outline=ink)
save(im, 'item-siege-tongs')

# ASHEN CLOAK: grey cloak, ember clasp
im, d = canvas()
d.polygon([(16, 2), (7, 29), (25, 29)], fill='#6e6e7a', outline=ink)
d.point((16, 8), fill=FLAME); d.point((14, 12), fill=GOLD)
d.ellipse((13, 4, 19, 10), fill=GOLD, outline=ink)
save(im, 'item-ashen-cloak')

# HYMNAL: open book, gold notes
im, d = canvas()
d.polygon([(4, 10), (16, 6), (16, 26), (4, 30)], fill=LIGHT, outline=ink)
d.polygon([(28, 10), (16, 6), (16, 26), (28, 30)], fill='#d9cba4', outline=ink)
d.line((16, 6, 16, 26), fill=ink, width=1)
d.point((10, 14), fill=GOLD); d.point((12, 18), fill=GOLD); d.point((10, 22), fill=GOLD)
d.point((22, 14), fill=GOLD); d.point((20, 18), fill=GOLD)
save(im, 'item-hymnal')

# CHOIR ROBE: pale robe mini, gold hem
im, d = canvas()
d.polygon([(11, 28), (14, 6), (18, 6), (21, 28)], fill='#cfd8ea', outline=ink)
d.line((11, 26, 21, 26), fill=GOLD, width=1)
d.point((16, 12), fill=ink)
save(im, 'item-choir-robe')

# PRIMER: small primer, letter mark
im, d = canvas()
d.rectangle((9, 6, 23, 27), fill='#7a5f9e', outline=ink)
d.rectangle((11, 8, 21, 25), fill=LIGHT)
d.line((13, 12, 19, 12), fill=ink, width=1)
d.line((13, 16, 19, 16), fill=ink, width=1)
d.line((13, 20, 17, 20), fill=ink, width=1)
save(im, 'item-primer')

# MASTER'S RING: gold ring, blue gem
im, d = canvas()
d.ellipse((8, 10, 24, 26), fill=GOLD, outline=ink)
d.ellipse((12, 14, 20, 22), fill='#00000000', outline=ink)
d.rectangle((13, 4, 19, 11), fill='#3d6f8f', outline=ink)
d.point((16, 7), fill=GLOW)
save(im, 'item-masters-ring')

# HALBERD: pole, red axe blade
im, d = canvas()
d.line((10, 30, 22, 2), fill=TIMBER, width=2)
d.polygon([(22, 2), (29, 6), (23, 12)], fill='#a33f31', outline=ink)
d.point((16, 16), fill=GOLD)
save(im, 'item-halberd')

# LONGBOW: tall pale bow, string
im, d = canvas()
d.arc((8, 2, 24, 30), 270, 90, fill=TIMBER, width=2)
d.line((16, 2, 16, 30), fill=LIGHT)
d.line((16, 16, 20, 16), fill=GOLD, width=1)
save(im, 'item-longbow')

# BANNER CLOAK: cloak, gold-trimmed hem
im, d = canvas()
d.polygon([(16, 2), (8, 29), (24, 29)], fill='#8b6675', outline=ink)
d.line((9, 26, 23, 26), fill=GOLD, width=2)
d.point((16, 10), fill=GOLD)
save(im, 'item-banner-cloak')

print('done — 25 sprites')
