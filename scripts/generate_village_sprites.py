"""Village-sim sprite pass: workplaces, professions, tools. Original 32px placeholders.
Run: python scripts/generate_village_sprites.py (requires Pillow)."""
from PIL import Image, ImageDraw
from pathlib import Path
out = Path(__file__).resolve().parents[1] / 'assets' / 'sprites'
out.mkdir(parents=True, exist_ok=True)
ink = '#0b1220'; stone = '#7e93a8'; light = '#e9dab2'; timber = '#96592c'
dark = '#5d4430'; roof = '#3d6f7f'; gold = '#f2c96e'; rim = '#bcd3e0'
glow = '#ffe9a8'; water = '#2e6b7a'; foam = '#7fc4d4'; leaf = '#547b60'
brick = '#8b6675'; hide = '#c79175'
OUTLINE = (11, 18, 32, 255)

def canvas():
    im = Image.new('RGBA', (32, 32))
    return im, ImageDraw.Draw(im)

def save(im, name):
    px = im.load(); w, h = im.size
    solid = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] >= 200
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

def building(kind, t):
    im, d = canvas()
    if kind == 'cottage':
        d.rectangle((6, 15, 24, 29), fill=light if t == 2 else timber, outline=ink)
        d.polygon([(4, 15), (15, 5), (26, 15)], fill='#a26b7e', outline=ink)
        d.rectangle((24, 8, 27, 14), fill=stone, outline=ink)  # chimney
        d.ellipse((12, 19, 18, 25), fill=roof, outline=ink)  # round window
        d.rectangle((8, 24, 10, 29), fill=ink)  # door
        if t == 2:
            d.rectangle((1, 20, 6, 29), fill=stone, outline=ink)  # side room
            d.polygon([(0, 20), (3, 16), (7, 20)], fill=roof)
            for x in [27, 30]:
                d.line((x, 22, x, 29), fill=timber, width=2)  # fence posts
            d.line((27, 24, 31, 24), fill=timber, width=1)
            d.point((15, 18), fill=glow)
    elif kind == 'pond':
        d.ellipse((2, 15, 29, 29), fill=water, outline=ink)  # water disc
        d.ellipse((6, 18, 25, 26), fill='#3f8a9c')  # inner depth
        d.arc((8, 19, 23, 25), 200, 340, fill=foam, width=1)  # ripple
        for x, h in [(3, 8), (6, 11), (27, 9)]:
            d.line((x, 16, x, 16 - h), fill=leaf, width=2)  # reeds
            d.point((x, 15 - h), fill=gold)
        d.point((16, 22), fill=foam); d.point((19, 23), fill=foam)
        if t == 2:
            for x in [9, 13, 17, 21]:
                d.rectangle((x, 8, x + 2, 20), fill=timber, outline=ink)  # dock piles
            d.rectangle((7, 6, 24, 9), fill=dark, outline=ink)  # dock deck
            d.line((7, 5, 24, 5), fill=rim, width=1)
    elif kind == 'pasture':
        d.ellipse((2, 20, 29, 29), fill='#6f5039', outline=ink)  # dirt pen
        for x in range(3, 30, 4):
            d.line((x, 16, x, 26), fill=timber, width=2)  # fence ring
        d.line((2, 17, 30, 17), fill=dark, width=2)
        d.ellipse((10, 20, 22, 27), fill=gold, outline=ink)  # hay bale
        d.arc((12, 21, 20, 26), 180, 360, fill=dark, width=1)
        if t == 2:
            d.rectangle((18, 4, 30, 14), fill=brick, outline=ink)  # small barn
            d.polygon([(17, 4), (24, 0), (31, 4)], fill=roof)
            d.rectangle((22, 8, 26, 14), fill=ink)
            d.ellipse((4, 21, 10, 26), fill=gold, outline=ink)  # second bale
    elif kind == 'butchery':
        d.rectangle((4, 13, 27, 29), fill=timber, outline=ink)
        for x in range(4, 28, 6):
            d.polygon([(x, 13), (x + 3, 8), (x + 6, 13)], fill='#a53f2a' if (x // 6) % 2 else light)  # striped awning
        d.line((4, 13, 27, 13), fill=ink, width=1)
        d.rectangle((12, 20, 19, 29), fill=ink)  # door
        d.line((22, 4, 26, 8), fill=rim, width=3)  # cleaver sign
        d.line((22, 4, 26, 8), fill=ink, width=1)
        if t == 2:
            d.rectangle((24, 2, 27, 8), fill=stone, outline=ink)  # chimney
            d.ellipse((23, 0, 26, 3), fill='#9db87a')  # smoke puff
            d.ellipse((5, 22, 11, 29), fill=dark, outline=ink)  # barrel
            d.line((5, 25, 11, 25), fill=rim, width=1)
    elif kind == 'scriptorium':
        d.rectangle((9, 10, 22, 29), fill=stone, outline=ink)  # tall study
        d.polygon([(7, 10), (15, 2), (24, 10)], fill=roof, outline=ink)
        d.rectangle((12, 22, 19, 26), fill=light, outline=ink)  # open book
        d.line((15, 22, 15, 26), fill=ink, width=1)
        d.line((19, 14, 19, 18), fill=gold, width=2)  # candle
        d.point((19, 13), fill=glow)
        if t == 2:
            d.ellipse((9, 0, 22, 8), fill='#627888', outline=ink)  # dome
            d.line((15, 0, 15, 4), fill=gold, width=1)
            d.rectangle((2, 20, 9, 29), fill=timber, outline=ink)  # side wing
            d.rectangle((4, 23, 7, 26), fill=glow)
    elif kind == 'scout_post':
        d.line((8, 29, 14, 12), fill=timber, width=3)  # tripod legs
        d.line((24, 29, 18, 12), fill=timber, width=3)
        d.line((16, 29, 16, 12), fill=dark, width=2)
        d.ellipse((11, 6, 21, 13), fill=light, outline=ink)  # lookout basket
        d.line((16, 6, 16, 0), fill=ink, width=1)
        d.polygon([(16, 0), (24, 2), (16, 4)], fill=gold)  # pennant
        if t == 2:
            d.rectangle((4, 20, 28, 24), fill=stone, outline=ink)  # stone base
            d.line((13, 12, 22, 8), fill=rim, width=3)  # telescope
            d.rectangle((21, 7, 24, 10), fill=ink)
            d.polygon([(16, 0), (27, 2), (16, 5)], fill='#a26b7e')
    elif kind == 'chapel':
        d.rectangle((8, 13, 23, 29), fill=light, outline=ink)
        d.polygon([(6, 13), (15, 4), (25, 13)], fill=roof, outline=ink)
        d.line((15, 4, 15, 0), fill=gold, width=2)  # spire
        d.ellipse((12, 17, 18, 24), fill='#3d6f7f', outline=ink)  # moon window
        d.point((15, 19), fill=foam)
        d.rectangle((13, 25, 17, 29), fill=ink)  # arch door
        if t == 2:
            d.rectangle((2, 18, 7, 29), fill=stone, outline=ink)  # bell arch
            d.ellipse((3, 14, 7, 19), fill=gold, outline=ink)
            d.point((5, 16), fill=ink)
            d.rectangle((24, 18, 29, 29), fill=stone, outline=ink)
            d.line((26, 14, 26, 17), fill=gold, width=2)
            d.point((26, 13), fill=glow)
    elif kind == 'forge':
        d.rectangle((4, 18, 27, 29), fill=dark, outline=ink)  # forge block
        d.rectangle((22, 4, 27, 18), fill=stone, outline=ink)  # chimney
        d.ellipse((8, 8, 20, 16), fill='#a53f2a', outline=ink)  # anvil top glow
        d.rectangle((6, 14, 22, 18), fill=rim, outline=ink)  # anvil
        d.rectangle((12, 18, 16, 24), fill=stone)  # anvil base
        d.point((14, 11), fill=gold); d.point((17, 9), fill=glow)
        if t == 2:
            d.polygon([(2, 6), (14, 0), (26, 6)], fill=roof, outline=ink)  # roof
            d.line((2, 6, 2, 18), fill=timber, width=2)
            d.polygon([(24, 22), (30, 19), (30, 25)], fill='#627888')  # bellows
            d.line((21, 24, 24, 22), fill=ink, width=2)
    elif kind == 'armory':
        d.polygon([(4, 12), (15, 6), (27, 12), (25, 29), (6, 29)], fill=stone, outline=ink)  # shield hall
        d.polygon([(10, 14), (15, 11), (20, 14), (15, 26), (10, 14)], fill=roof, outline=ink)  # shield sign
        d.line((11, 20, 19, 16), fill=rim, width=2)  # crossed blades
        d.line((11, 16, 19, 20), fill=rim, width=2)
        d.rectangle((13, 25, 17, 29), fill=ink)
        if t == 2:
            d.ellipse((10, 0, 20, 9), fill='#627888', outline=ink)  # helm dome
            d.line((15, 0, 15, 5), fill=gold, width=1)
            d.line((4, 22, 4, 29), fill=timber, width=2)  # weapon rack
            d.line((27, 22, 27, 29), fill=timber, width=2)
            d.line((3, 23, 28, 23), fill=timber, width=1)
    elif kind == 'workshop':
        d.rectangle((3, 16, 28, 29), fill=timber, outline=ink)  # workbench hall
        d.rectangle((3, 16, 28, 20), fill=dark)  # bench top
        d.line((8, 16, 8, 12), fill=rim, width=2)  # vise
        d.ellipse((19, 4, 29, 14), fill=gold, outline=ink)  # gear sign
        d.ellipse((22, 7, 26, 11), fill=timber)
        if t == 2:
            d.line((26, 16, 26, 2), fill=stone, width=3)  # crane post
            d.line((26, 3, 12, 3), fill=stone, width=2)  # crane arm
            d.line((13, 3, 13, 8), fill=ink, width=1)
            d.rectangle((10, 8, 16, 13), fill=light, outline=ink)  # hanging crate
            d.rectangle((4, 24, 10, 29), fill=light, outline=ink)
    elif kind == 'tannery':
        d.line((5, 8, 5, 26), fill=timber, width=2)  # drying rack
        d.line((26, 8, 26, 26), fill=timber, width=2)
        d.line((5, 8, 26, 8), fill=dark, width=2)
        d.polygon([(9, 8), (9, 22), (14, 25), (20, 22), (20, 8)], fill=hide, outline=ink)  # hanging hide
        d.ellipse((6, 24, 12, 30), fill='#a53f2a', outline=ink)  # dye pot
        d.ellipse((20, 24, 26, 30), fill=roof, outline=ink)
        if t == 2:
            for x in [2, 8, 14, 20, 26]:
                d.polygon([(x, 6), (x + 3, 2), (x + 6, 6)], fill=gold if (x // 6) % 2 else light)  # awning
            d.polygon([(22, 8), (22, 20), (26, 22), (29, 20), (29, 8)], fill='#e1b68b', outline=ink)  # stacked hide
    elif kind == 'mason_yard':
        d.rectangle((4, 22, 14, 29), fill=stone, outline=ink)  # block stack
        d.rectangle((14, 22, 24, 29), fill='#627888', outline=ink)
        d.rectangle((9, 15, 19, 22), fill=stone, outline=ink)
        d.line((9, 18, 19, 18), fill=ink, width=1)
        d.line((24, 10, 28, 16), fill=rim, width=2)  # chisel
        d.rectangle((23, 7, 29, 11), fill=timber, outline=ink)
        if t == 2:
            d.arc((6, 10, 26, 28), 180, 360, fill=light, width=4)  # arch demo
            d.line((2, 12, 2, 26), fill=timber, width=2)  # scaffold
            d.line((2, 14, 10, 14), fill=timber, width=1)
            d.line((2, 20, 10, 20), fill=timber, width=1)
    save(im, f'{kind}-{t}')

for _kind in ['cottage', 'pond', 'pasture', 'butchery', 'scriptorium', 'scout_post', 'chapel', 'forge', 'armory', 'workshop', 'tannery', 'mason_yard']:
    for _t in (1, 2):
        building(_kind, _t)

TROOPS = [
    ('fisherman', '#5f9ea0', 'rod'),
    ('shepherd', '#cfe0c0', 'crook'),
    ('butcher', '#d9a0a0', 'apron'),
    ('scholar', '#8a7fb8', 'hat'),
    ('scout', '#7fa877', 'cloak'),
    ('healer', '#e8e0c8', 'hood'),
    ('weaponsmith', '#b0875a', 'apron'),
    ('armorer', '#9aa8b8', 'helm'),
    ('toolsmith', '#a8b89a', 'goggles'),
    ('leatherworker', '#c79175', 'vest'),
    ('mason', '#a09a8a', 'cap'),
    ('lumberjack', '#7a9a5f', 'beard'),
]
for kind, c, gear in TROOPS:
    im, d = canvas()
    d.ellipse((9, 26, 24, 30), fill='#17272b88')
    d.rectangle((12, 21, 15, 28), fill=ink)
    d.rectangle((19, 21, 22, 28), fill=ink)
    if gear in ('apron', 'vest'):
        d.polygon([(10, 24), (12, 12), (22, 12), (24, 24)], fill=c, outline=ink)
        d.rectangle((13, 15, 20, 24), fill=dark if gear == 'apron' else hide, outline=ink)
    elif gear in ('cloak', 'hood'):
        d.polygon([(8, 25), (12, 11), (22, 11), (26, 25)], fill=c, outline=ink)
        d.polygon([(12, 11), (17, 16), (22, 11)], fill=ink)
    else:
        d.rectangle((10, 13, 23, 23), fill=c, outline=ink)
    d.rectangle((13, 6, 22, 13), fill='#e1b68b', outline=ink)
    d.line((14, 6, 21, 6), fill=rim)
    if gear == 'rod':
        d.line((24, 24, 30, 2), fill=timber, width=2)  # held rod
        d.line((30, 2, 30, 8), fill=rim, width=1)
        d.rectangle((11, 3, 24, 6), fill='#3f8a9c')
    elif gear == 'crook':
        d.line((26, 26, 26, 6), fill=timber, width=2)
        d.arc((22, 2, 30, 10), 180, 360, fill=timber, width=2)
        d.ellipse((12, 21, 22, 27), fill=light, outline=ink)  # wool bundle
    elif gear == 'hat':
        d.polygon([(10, 6), (17, 0), (24, 6)], fill='#3d2c50', outline=ink)
        d.rectangle((15, 8, 19, 12), fill=light, outline=ink)  # book
    elif gear == 'cloak':
        d.polygon([(8, 5, 27, 8)], fill=dark) if False else None
        d.polygon([(10, 8), (17, 1), (24, 8)], fill=c, outline=ink)
        d.line((17, 8, 26, 14), fill=timber, width=2)  # walking staff
    elif gear == 'hood':
        d.ellipse((10, 2, 25, 12), fill=c, outline=ink)
        d.line((15, 13, 15, 20), fill=gold, width=2)  # chalice staff
        d.point((15, 12), fill=glow)
    elif gear == 'helm':
        d.rectangle((11, 2, 24, 8), fill='#627888', outline=ink)
        d.line((17, 2, 17, 8), fill=gold, width=1)
    elif gear == 'goggles':
        d.rectangle((13, 8, 22, 11), fill=ink)
        d.point((15, 9), fill=foam); d.point((20, 9), fill=foam)
        d.rectangle((11, 3, 24, 6), fill=dark)
    elif gear == 'vest':
        d.line((6, 15, 10, 13), fill=hide, width=2)
    elif gear == 'cap':
        d.rectangle((11, 3, 24, 7), fill=light, outline=ink)
        d.rectangle((16, 0, 19, 4), fill=c)
    elif gear == 'beard':
        d.rectangle((13, 10, 22, 15), fill=dark)  # beard
        d.rectangle((11, 2, 24, 6), fill='#a53f2a')  # knit cap
        d.line((5, 26, 10, 16), fill=timber, width=3)  # axe haft
    d.point((20, 9), fill=ink)
    save(im, kind)

ITEMS = {
    'rod': lambda d: (d.line((15, 29, 20, 3), fill=timber, width=2), d.line((20, 3, 20, 9), fill=rim, width=1), d.ellipse((18, 9, 22, 13), fill=gold, outline=ink)),
    'crook': lambda d: (d.line((15, 29, 15, 7), fill=timber, width=3), d.arc((11, 2, 19, 10), 180, 360, fill=timber, width=3)),
    'cleaver': lambda d: (d.line((15, 29, 15, 12), fill=dark, width=3), d.rectangle((8, 4, 24, 13), fill=rim, outline=ink)),
    'tome': lambda d: (d.rectangle((7, 8, 25, 26), fill='#3d2c50', outline=ink), d.rectangle((8, 9, 15, 25), fill=light), d.line((18, 12, 22, 12), fill=gold, width=1), d.line((18, 16, 22, 16), fill=gold, width=1)),
    'compass': lambda d: (d.ellipse((7, 7, 25, 25), fill=gold, outline=ink), d.ellipse((11, 11, 21, 21), fill=ink), d.line((16, 16, 20, 10), fill='#ca7375', width=2)),
    'chalice': lambda d: (d.polygon([(10, 4), (22, 4), (19, 14), (13, 14)], fill=gold, outline=ink), d.line((16, 14, 16, 24), fill=gold, width=2), d.line((11, 26, 21, 26), fill=gold, width=2)),
    'forgehammer': lambda d: (d.line((15, 28, 15, 10), fill=timber, width=3), d.rectangle((7, 4, 25, 11), fill='#627888', outline=ink), d.point((11, 7), fill=gold)),
    'armorkit': lambda d: (d.polygon([(16, 3), (25, 9), (22, 22), (10, 22), (7, 9)], fill=stone, outline=ink), d.line((16, 3, 16, 22), fill=ink, width=1)),
    'tinkerkit': lambda d: (d.rectangle((5, 13, 26, 27), fill=timber, outline=ink), d.ellipse((10, 5, 20, 14), fill=gold, outline=ink), d.line((15, 8, 15, 11), fill=ink, width=1)),
    'awl': lambda d: (d.line((15, 29, 15, 12), fill=timber, width=3), d.line((15, 12, 15, 3), fill=rim, width=2), d.ellipse((7, 18, 13, 24), fill=hide, outline=ink)),
    'trowel': lambda d: (d.line((15, 29, 15, 14), fill=dark, width=3), d.polygon([(15, 14), (24, 6), (24, 12)], fill=rim, outline=ink)),
    'fellingaxe': lambda d: (d.line((15, 28, 15, 6), fill=timber, width=3), d.polygon([(15, 5), (26, 2), (26, 13), (15, 11)], fill=stone, outline=ink)),
}
for kind, paint in ITEMS.items():
    im, d = canvas()
    paint(d)
    save(im, 'item-' + kind)

print('Generated', len(list(out.glob('cottage-*'))) + len(list(out.glob('pond-*'))) + len(list(out.glob('pasture-*'))) + len(list(out.glob('butchery-*'))) + len(list(out.glob('scriptorium-*'))) + len(list(out.glob('scout_post-*'))) + len(list(out.glob('chapel-*'))) + len(list(out.glob('forge-*'))) + len(list(out.glob('armory-*'))) + len(list(out.glob('workshop-*'))) + len(list(out.glob('tannery-*'))) + len(list(out.glob('mason_yard-*'))), 'workplace sprites +', len(TROOPS), 'troops +', len(ITEMS), 'items')
