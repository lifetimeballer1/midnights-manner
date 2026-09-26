"""Art pass: crisp 32x32 retro-SNES sprites, one consistent moonlit style.

Run: python scripts/generate_art_pass.py  (requires Pillow)
Filenames are data contracts (data/*.json + renderer 'raider.png') — never rename.
Style: 1px ink outer outline (auto), moonlight top-left (auto top-light /
bottom-shade), tier = silhouette change, never recolor.
Palette core: ink/pine/moss/timber/straw/gold/ember + situational stone/water/foam.
"""
from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'sprites'
OUT.mkdir(parents=True, exist_ok=True)

INK = '#0b1220'; PINE = '#2f5240'; MOSS = '#4c805f'; LEAF = '#7fbf7a'
TIMBER = '#96592c'; DARK = '#5d4430'; STRAW = '#e9dab2'; GOLD = '#f2c96e'
EMBER = '#c05a4e'; STONE = '#7e93a8'; WATER = '#2e6b7a'; FOAM = '#9fd8e4'
SKIN = '#d9a878'; HIDE = '#c79175'; GLOW = '#ffe9a8'
OUTLINE = (11, 18, 32, 255)


def C():
    im = Image.new('RGBA', (32, 32))
    return im, ImageDraw.Draw(im)


def finish(im, name):
    px = im.load()
    w, h = im.size
    solid = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] >= 200
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 40 and (solid(x + 1, y) or solid(x - 1, y)
                                     or solid(x, y + 1) or solid(x, y - 1)):
                px[x, y] = OUTLINE
    ys = [y for y in range(h) for x in range(w) if px[x, y][3] >= 200]
    if ys:
        mid = (min(ys) + max(ys)) // 2
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a >= 200:
                    if y <= mid:
                        px[x, y] = (min(255, int(r * 1.07 + 6)),
                                    min(255, int(g * 1.07 + 6)),
                                    min(255, int(b * 1.07 + 6)), a)
                    else:
                        px[x, y] = (int(r * .84), int(g * .84), int(b * .84), a)
    im.save(OUT / (name + '.png'))


def shade(hexcolor, f):
    from PIL import ImageColor
    r, g, b = ImageColor.getrgb(hexcolor)
    return (max(0, min(255, int(r * f))), max(0, min(255, int(g * f))),
            max(0, min(255, int(b * f))), 255)


# ---------------------------------------------------------------- troops
# Figure faces right, feet at y=30. cx = center x. tunic/pants/hat/tool vary.
def body(d, cx, tunic, pants, trim, hat=None, tool=None):
    d.rectangle((cx - 3, 22, cx + 3, 29), fill=pants)            # legs
    d.line((cx, 22, cx, 29), fill=INK)                           # leg split
    d.rectangle((cx - 4, 14, cx + 4, 22), fill=tunic)            # torso
    d.rectangle((cx - 4, 18, cx + 4, 20), fill=DARK)             # belt
    d.point((cx, 19), fill=GOLD)                                 # buckle
    d.rectangle((cx - 5, 14, cx - 4, 16), fill=trim)             # pauldrons
    d.rectangle((cx + 4, 14, cx + 5, 16), fill=trim)
    d.rectangle((cx - 3, 8, cx + 3, 14), fill=SKIN)              # head
    d.point((cx + 2, 11), fill=INK)                              # eye
    if hat:
        hat(d, cx)
    if tool:
        tool(d, cx)


def troop(name, tunic, pants, trim, hat=None, tool=None):
    im, d = C()
    body(d, 15, tunic, pants, trim, hat, tool)
    finish(im, name)


# ---- hats / headgear (each a distinct silhouette) ----
def helm(d, cx):
    d.rectangle((cx - 4, 5, cx + 4, 9), fill=STONE)
    d.rectangle((cx - 1, 5, cx + 1, 9), fill=INK)
    d.line((cx - 4, 5, cx + 4, 5), fill=FOAM, width=1)


def hood(color):
    def f(d, cx):
        d.polygon([(cx - 5, 14), (cx - 4, 4), (cx + 4, 4), (cx + 5, 14),
                   (cx + 3, 9), (cx - 3, 9)], fill=color)
    return f


def straw_hat(d, cx):
    d.rectangle((cx - 2, 5, cx + 2, 8), fill=STRAW)
    d.polygon([(cx - 7, 9), (cx + 7, 9), (cx + 2, 7), (cx - 2, 7)], fill=STRAW)
    d.line((cx - 2, 8, cx + 2, 8), fill=EMBER, width=1)


def lantern_helm(d, cx):
    d.rectangle((cx - 4, 5, cx + 4, 8), fill=DARK)
    d.rectangle((cx - 1, 3, cx + 1, 5), fill=GOLD)
    d.point((cx, 4), fill=GLOW)


def cap(color):
    def f(d, cx):
        d.rectangle((cx - 3, 5, cx + 3, 8), fill=color)
        d.rectangle((cx + 3, 7, cx + 6, 8), fill=color)
    return f


def circlet(d, cx):
    d.line((cx - 3, 6, cx + 3, 6), fill=GOLD, width=1)
    d.point((cx, 5), fill=EMBER)


def feather_cap(d, cx):
    d.rectangle((cx - 3, 5, cx + 3, 8), fill=PINE)
    d.line((cx + 1, 5, cx + 4, 1), fill=LEAF, width=2)


def veil(d, cx):
    d.rectangle((cx - 4, 4, cx + 4, 13), fill=FOAM)
    d.rectangle((cx - 2, 8, cx + 2, 12), fill=SKIN)
    d.point((cx + 1, 10), fill=INK)


def visor(d, cx):
    d.rectangle((cx - 4, 5, cx + 4, 8), fill=DARK)
    d.line((cx - 4, 8, cx + 4, 8), fill=EMBER, width=1)


def greathelm(d, cx):
    d.rectangle((cx - 4, 4, cx + 4, 12), fill=STONE)
    d.line((cx + 1, 4, cx + 1, 12), fill=INK)
    d.line((cx - 4, 6, cx + 4, 6), fill=FOAM, width=1)


def beanie(d, cx):
    d.rectangle((cx - 3, 5, cx + 3, 9), fill=EMBER)
    d.point((cx, 4), fill=STRAW)


def bandana(d, cx):
    d.rectangle((cx - 3, 6, cx + 3, 8), fill=HIDE)
    d.line((cx + 3, 7, cx + 5, 9), fill=HIDE, width=1)


def goggles(d, cx):
    d.rectangle((cx - 3, 5, cx + 3, 7), fill=DARK)
    d.point((cx - 1, 6), fill=GLOW)
    d.point((cx + 2, 6), fill=GLOW)


# ---- hand tools / props (drawn at the figure's right side) ----
def sword(d, cx):
    d.line((cx + 5, 22, cx + 5, 26), fill=TIMBER, width=2)
    d.line((cx + 4, 21, cx + 6, 21), fill=GOLD, width=1)
    d.line((cx + 5, 10, cx + 5, 21), fill=STONE, width=3)
    d.line((cx + 5, 10, cx + 5, 12), fill=FOAM, width=1)


def halberd(d, cx):
    d.line((cx + 6, 8, cx + 6, 28), fill=TIMBER, width=2)
    d.polygon([(cx + 6, 4), (cx + 9, 9), (cx + 6, 9)], fill=STONE)
    d.point((cx + 7, 7), fill=EMBER)


def longbow(d, cx):
    d.arc((cx + 3, 10, cx + 9, 26), 270, 90, fill=TIMBER, width=2)
    d.line((cx + 6, 10, cx + 6, 26), fill=STRAW, width=1)


def shortbow(d, cx):
    d.arc((cx + 4, 13, cx + 8, 24), 270, 90, fill=DARK, width=2)
    d.line((cx + 6, 13, cx + 6, 24), fill=STRAW, width=1)


def pickaxe(d, cx):
    d.line((cx + 5, 12, cx + 5, 24), fill=TIMBER, width=2)
    d.arc((cx + 1, 8, cx + 9, 14), 180, 360, fill=STONE, width=2)


def hammer(d, cx):
    d.line((cx + 5, 14, cx + 5, 24), fill=TIMBER, width=2)
    d.rectangle((cx + 3, 11, cx + 8, 14), fill=STONE)


def sickle(d, cx):
    d.line((cx + 5, 18, cx + 5, 24), fill=TIMBER, width=2)
    d.arc((cx + 1, 13, cx + 8, 20), 90, 270, fill=STONE, width=2)


def rod(d, cx):
    d.line((cx + 5, 6, cx + 7, 24), fill=TIMBER, width=1)
    d.line((cx + 5, 6, cx + 3, 10), fill=STRAW, width=1)
    d.point((cx + 3, 11), fill=GOLD)


def crook(d, cx):
    d.line((cx + 5, 10, cx + 5, 26), fill=TIMBER, width=2)
    d.arc((cx + 2, 6, cx + 8, 12), 180, 360, fill=TIMBER, width=2)


def felling_axe(d, cx):
    d.line((cx + 5, 10, cx + 5, 26), fill=TIMBER, width=2)
    d.polygon([(cx + 5, 10), (cx + 10, 12), (cx + 5, 15)], fill=STONE)
    d.line((cx + 6, 11, cx + 9, 12), fill=EMBER, width=1)


def cleaver(d, cx):
    d.line((cx + 5, 18, cx + 5, 24), fill=TIMBER, width=2)
    d.rectangle((cx + 3, 13, cx + 8, 18), fill=STONE)
    d.line((cx + 3, 17, cx + 8, 17), fill=FOAM, width=1)


def tome(d, cx):
    d.rectangle((cx + 3, 16, cx + 8, 22), fill=STRAW)
    d.line((cx + 5, 16, cx + 5, 22), fill=INK)
    d.point((cx + 6, 18), fill=EMBER)


def compass(d, cx):
    d.ellipse((cx + 3, 16, cx + 8, 21), fill=GOLD)
    d.line((cx + 4, 20, cx + 7, 17), fill=EMBER, width=1)


def chalice(d, cx):
    d.polygon([(cx + 3, 15), (cx + 8, 15), (cx + 6, 19), (cx + 5, 19)], fill=GOLD)
    d.line((cx + 5, 19, cx + 5, 22), fill=GOLD, width=1)
    d.point((cx + 5, 15), fill=GLOW)


def forge_hammer(d, cx):
    d.line((cx + 5, 12, cx + 5, 24), fill=DARK, width=2)
    d.rectangle((cx + 2, 9, cx + 9, 13), fill=STONE)
    d.line((cx + 2, 9, cx + 9, 9), fill=EMBER, width=1)


def plate(d, cx):
    d.rectangle((cx + 3, 15, cx + 8, 22), fill=STONE)
    d.line((cx + 3, 15, cx + 8, 15), fill=FOAM, width=1)
    d.point((cx + 5, 18), fill=INK)


def gears(d, cx):
    d.ellipse((cx + 3, 15, cx + 7, 19), fill=GOLD)
    d.ellipse((cx + 6, 18, cx + 9, 21), fill=STONE)
    d.point((cx + 5, 17), fill=INK)


def awl(d, cx):
    d.line((cx + 5, 19, cx + 5, 23), fill=TIMBER, width=2)
    d.line((cx + 5, 14, cx + 5, 19), fill=STONE, width=1)


def trowel(d, cx):
    d.line((cx + 5, 19, cx + 5, 23), fill=TIMBER, width=2)
    d.polygon([(cx + 5, 14), (cx + 8, 19), (cx + 2, 19)], fill=STONE)


def basket(d, cx):
    d.polygon([(cx + 3, 19), (cx + 8, 19), (cx + 7, 23), (cx + 4, 23)], fill=TIMBER)
    d.line((cx + 3, 20, cx + 8, 20), fill=DARK, width=1)
    d.point((cx + 5, 18), fill=LEAF)
    d.point((cx + 6, 17), fill=GOLD)


def shield_pine(d, cx):
    d.line((cx - 7, 14, cx - 7, 24), fill=INK, width=1)
    d.polygon([(cx - 9, 14), (cx - 5, 14), (cx - 5, 22), (cx - 7, 25)], fill=PINE)
    d.point((cx - 7, 18), fill=GOLD)


def make_troops():
    E = EMBER  # combat trim
    G = GOLD   # collector trim
    B = TIMBER  # builder trim
    K = FOAM   # keeper trim
    troop('warrior', PINE, DARK, E, helm, sword)
    troop('archer', MOSS, DARK, E, hood(PINE), shortbow)
    troop('miner', DARK, STONE, G, lantern_helm, pickaxe)
    troop('builder', TIMBER, DARK, B, cap(STRAW), hammer)
    troop('farmer', MOSS, DARK, G, straw_hat, sickle)
    troop('fisherman', WATER, DARK, G, cap(WATER), rod)
    troop('shepherd', HIDE, DARK, G, hood(HIDE), crook)
    troop('lumberjack', EMBER, DARK, G, beanie, felling_axe)
    troop('butcher', STONE, DARK, G, bandana, cleaver)
    troop('scholar', STRAW, PINE, K, circlet, tome)
    troop('scout', PINE, DARK, K, feather_cap, compass)
    troop('healer', FOAM, STRAW, K, veil, chalice)
    troop('weaponsmith', DARK, STONE, K, visor, forge_hammer)
    troop('armorer', STONE, DARK, K, helm, plate)
    troop('toolsmith', TIMBER, DARK, K, goggles, gears)
    troop('leatherworker', HIDE, TIMBER, K, bandana, awl)
    troop('mason', STONE, DARK, B, cap(STONE), trowel)
    troop('warden', PINE, STONE, E, greathelm, halberd)
    troop('ranger', MOSS, DARK, E, hood(MOSS), longbow)
    troop('forager', LEAF, DARK, G, straw_hat, basket)


def make_raider():
    im, d = C()
    d.rectangle((12, 20, 20, 29), fill=INK)                      # legs
    d.line((16, 20, 16, 29), fill=EMBER, width=1)
    d.polygon([(11, 12), (21, 12), (20, 22), (12, 22)], fill=DARK)  # cloak
    d.rectangle((13, 7, 19, 12), fill=SKIN)
    d.polygon([(11, 7), (21, 7), (19, 3), (13, 3)], fill=INK)    # hood
    d.point((14, 10), fill=EMBER)
    d.point((18, 10), fill=EMBER)                                # ember eyes
    d.line((22, 10, 22, 26), fill=TIMBER, width=2)               # jagged axe
    d.polygon([(22, 8), (27, 11), (22, 14)], fill=STONE)
    d.line((23, 10, 26, 11), fill=EMBER, width=1)
    finish(im, 'raider')

# ---------------------------------------------------------------- items
# Large diagonal tools; each a unique silhouette + reach read.
def item(name, fn):
    im, d = C()
    fn(d)
    finish(im, name)


def i_sword(d):
    d.line((8, 26, 22, 12), fill=TIMBER, width=3)
    d.line((22, 12, 28, 6), fill=STONE, width=4)
    d.line((22, 12, 28, 6), fill=FOAM, width=1)
    d.line((19, 14, 23, 10), fill=GOLD, width=3)


def i_axe(d):
    d.line((10, 28, 20, 8), fill=TIMBER, width=3)
    d.polygon([(20, 8), (28, 10), (22, 16), (18, 13)], fill=STONE)
    d.line((21, 10, 26, 11), fill=FOAM, width=1)


def i_warhammer(d):
    d.line((10, 28, 20, 8), fill=DARK, width=3)
    d.rectangle((15, 4, 25, 11), fill=STONE)
    d.line((15, 4, 25, 4), fill=EMBER, width=2)


def i_bow(d):
    d.arc((8, 4, 24, 28), 300, 60, fill=TIMBER, width=3)
    d.line((17, 5, 17, 27), fill=STRAW, width=1)
    d.line((17, 16, 24, 16), fill=STONE, width=1)
    d.polygon([(24, 14), (27, 16), (24, 18)], fill=FOAM)


def i_hammer(d):
    d.line((12, 28, 18, 10), fill=TIMBER, width=3)
    d.rectangle((13, 6, 23, 12), fill=STONE)
    d.line((13, 6, 23, 6), fill=FOAM, width=1)


def i_toolkit(d):
    d.rectangle((8, 14, 24, 26), fill=DARK)
    d.rectangle((8, 14, 24, 18), fill=TIMBER)
    d.line((12, 10, 12, 14), fill=STONE, width=2)
    d.line((17, 8, 17, 14), fill=GOLD, width=2)
    d.line((21, 11, 21, 14), fill=STONE, width=2)


def i_pickaxe(d):
    d.line((14, 28, 18, 10), fill=TIMBER, width=3)
    d.arc((9, 4, 27, 14), 180, 360, fill=STONE, width=3)
    d.point((13, 6), fill=FOAM)


def i_cart(d):
    d.polygon([(7, 14), (23, 14), (20, 23), (10, 23)], fill=TIMBER)
    d.line((7, 14, 23, 14), fill=DARK, width=2)
    d.ellipse((9, 21, 14, 26), fill=DARK)
    d.ellipse((18, 21, 23, 26), fill=DARK)
    d.point((11, 23), fill=STONE)
    d.point((20, 23), fill=STONE)
    d.point((14, 17), fill=STONE)
    d.point((17, 18), fill=GOLD)


def i_sickle(d):
    d.line((12, 28, 16, 14), fill=TIMBER, width=3)
    d.arc((10, 6, 26, 20), 80, 270, fill=STONE, width=3)
    d.arc((10, 6, 26, 20), 80, 270, fill=FOAM, width=1)


def i_scythe(d):
    d.line((10, 28, 22, 6), fill=TIMBER, width=2)
    d.arc((14, 2, 30, 14), 100, 260, fill=STONE, width=2)
    d.line((16, 5, 26, 9), fill=FOAM, width=1)


def i_rod(d):
    d.line((8, 28, 24, 4), fill=TIMBER, width=2)
    d.line((24, 4, 24, 12), fill=STRAW, width=1)
    d.arc((22, 12, 26, 16), 0, 180, fill=GOLD, width=1)


def i_crook(d):
    d.line((14, 28, 14, 10), fill=TIMBER, width=3)
    d.arc((10, 4, 18, 12), 180, 360, fill=TIMBER, width=3)


def i_cleaver(d):
    d.line((10, 28, 14, 18), fill=TIMBER, width=3)
    d.rectangle((12, 8, 26, 19), fill=STONE)
    d.line((12, 17, 26, 17), fill=FOAM, width=1)
    d.point((15, 11), fill=INK)


def i_tome(d):
    d.rectangle((8, 10, 24, 24), fill=STRAW)
    d.line((16, 10, 16, 24), fill=INK)
    d.line((10, 13, 14, 13), fill=EMBER, width=1)
    d.line((10, 16, 14, 16), fill=DARK, width=1)
    d.line((18, 13, 22, 13), fill=DARK, width=1)
    d.line((18, 16, 22, 16), fill=DARK, width=1)


def i_compass(d):
    d.ellipse((9, 9, 23, 23), fill=GOLD)
    d.ellipse((11, 11, 21, 21), fill=STRAW)
    d.line((13, 19, 19, 13), fill=EMBER, width=2)
    d.point((16, 16), fill=INK)


def i_chalice(d):
    d.polygon([(10, 6), (22, 6), (18, 16), (14, 16)], fill=GOLD)
    d.ellipse((10, 5, 22, 9), fill=GLOW)
    d.line((16, 16, 16, 24), fill=GOLD, width=2)
    d.line((12, 24, 20, 24), fill=GOLD, width=2)


def i_forgehammer(d):
    d.line((10, 28, 20, 8), fill=DARK, width=3)
    d.rectangle((14, 4, 26, 11), fill=STONE)
    d.line((14, 4, 26, 4), fill=EMBER, width=2)
    d.point((17, 7), fill=GLOW)


def i_armorkit(d):
    d.polygon([(11, 6), (21, 6), (23, 14), (20, 26), (12, 26), (9, 14)], fill=STONE)
    d.line((11, 6, 21, 6), fill=FOAM, width=2)
    d.line((16, 8, 16, 24), fill=INK, width=1)
    d.point((16, 12), fill=GOLD)


def i_tinkerkit(d):
    d.rectangle((8, 14, 24, 26), fill=STONE)
    d.ellipse((11, 8, 17, 14), fill=GOLD)
    d.ellipse((17, 9, 22, 14), fill=TIMBER)
    d.point((14, 11), fill=INK)
    d.point((19, 11), fill=INK)


def i_awl(d):
    d.line((13, 28, 15, 20), fill=TIMBER, width=4)
    d.line((14, 6, 14, 20), fill=STONE, width=2)
    d.point((14, 6), fill=FOAM)
    d.ellipse((10, 20, 18, 24), fill=HIDE)


def i_trowel(d):
    d.line((12, 28, 15, 20), fill=TIMBER, width=3)
    d.polygon([(15, 8), (22, 20), (8, 20)], fill=STONE)
    d.line((15, 10, 19, 18), fill=FOAM, width=1)


def i_fellingaxe(d):
    d.line((10, 28, 20, 6), fill=TIMBER, width=3)
    d.polygon([(20, 6), (29, 9), (23, 16), (18, 12)], fill=STONE)
    d.line((21, 8, 27, 10), fill=EMBER, width=2)


def make_items():
    item('item-sword', i_sword)
    item('item-axe', i_axe)
    item('item-warhammer', i_warhammer)
    item('item-bow', i_bow)
    item('item-hammer', i_hammer)
    item('item-toolkit', i_toolkit)
    item('item-pickaxe', i_pickaxe)
    item('item-cart', i_cart)
    item('item-sickle', i_sickle)
    item('item-scythe', i_scythe)
    item('item-rod', i_rod)
    item('item-crook', i_crook)
    item('item-cleaver', i_cleaver)
    item('item-tome', i_tome)
    item('item-compass', i_compass)
    item('item-chalice', i_chalice)
    item('item-forgehammer', i_forgehammer)
    item('item-armorkit', i_armorkit)
    item('item-tinkerkit', i_tinkerkit)
    item('item-awl', i_awl)
    item('item-trowel', i_trowel)
    item('item-fellingaxe', i_fellingaxe)

# ------------------------------------------------------------- buildings
# Generic moonlit gable hall. Tier reads: T1 low + plain, T2 taller +
# foundation + chimney (+wing for houses), T3 tallest + banner (+spire/tower).
def house(d, t, wdt, wall_c, roof_c, wing=False, frame=False,
          windows=1, chimney=True, banner=False, spire=False):
    x0 = (32 - wdt) // 2
    x1 = x0 + wdt
    base = 30
    wallH = 7 + t * 2
    if t >= 2:  # stone foundation from T2 up
        d.rectangle((x0 - 1, base - 2, x1 + 1, base), fill=STONE)
    d.rectangle((x0, base - wallH, x1, base - (2 if t >= 2 else 0)), fill=wall_c)
    if frame:  # timber framing on T1 walls
        for fx in range(x0 + 3, x1, 5):
            d.line((fx, base - wallH, fx, base - 2), fill=DARK, width=1)
    apex = base - wallH - (5 + t * 2)
    d.polygon([(x0 - 2, base - wallH), (16, apex), (x1 + 2, base - wallH)],
              fill=roof_c)
    d.line((16, apex, x1 + 2, base - wallH), fill=shade(roof_c, 0.7), width=1)
    if spire and t >= 3:
        d.line((16, apex, 16, apex - 5), fill=STONE, width=2)
        d.point((16, apex - 6), fill=GOLD)
    if chimney and t >= 2:
        d.rectangle((x1 - 6, apex + 1, x1 - 3, base - wallH - 2), fill=STONE)
        d.rectangle((x1 - 7, apex, x1 - 2, apex + 1), fill=DARK)
    if wing and t >= 2:
        wx0, wx1 = x0 - 7, x0 - 1
        d.rectangle((wx0, base - 5, wx1, base), fill=wall_c)
        d.polygon([(wx0 - 1, base - 5), ((wx0 + wx1) // 2, base - 9),
                   (wx1 + 1, base - 5)], fill=roof_c)
    for i in range(min(windows + t - 1, 3)):  # windows grow with tier
        wx = x0 + 3 + i * 6
        d.rectangle((wx, base - wallH + 2, wx + 2, base - wallH + 4), fill=GLOW)
    d.rectangle((14, base - 7, 18, base - (2 if t >= 2 else 0)), fill=INK)
    d.point((17, base - 4), fill=GOLD)  # door lamp
    if banner and t >= 3:
        d.line((x0 + 2, apex - 6, x0 + 2, apex + 2), fill=TIMBER, width=1)
        d.polygon([(x0 + 2, apex - 6), (x0 + 7, apex - 4), (x0 + 2, apex - 2)],
                  fill=EMBER)


def building(name, t, fn):
    im, d = C()
    fn(d, t)
    finish(im, f'{name}-{t}')


# ---- 3-tier families ----
def b_hall(d, t):
    house(d, t, 18 + t * 2, TIMBER, DARK, wing=True, frame=(t == 1),
          windows=1, banner=True, spire=(t >= 3))
    if t >= 3:  # side tower on T3
        d.rectangle((22, 12, 27, 29), fill=STONE)
        d.polygon([(21, 12), (24, 7), (28, 12)], fill=EMBER)
        d.rectangle((23, 18, 25, 21), fill=GLOW)


def b_barracks(d, t):
    if t == 1:  # muster tent
        d.polygon([(7, 29), (16, 10), (25, 29)], fill=HIDE)
        d.line((16, 10, 16, 29), fill=DARK, width=1)
        d.line((16, 10, 16, 6), fill=TIMBER, width=1)
        d.polygon([(16, 6), (21, 8), (16, 10)], fill=EMBER)
    else:
        house(d, t, 16 + t * 2, TIMBER, HIDE, frame=True, windows=1,
              banner=(t >= 3))
        for i in range(t):  # shield rack grows per tier
            sx = 6 + i * 5
            d.ellipse((sx, 22, sx + 4, 27), fill=EMBER if i % 2 else PINE)
            d.point((sx + 2, 24), fill=GOLD)


def b_tower(d, t):
    if t == 1:
        for lx in (11, 21):
            d.line((lx, 16, lx - 2, 29), fill=TIMBER, width=2)
            d.line((lx, 16, lx + 2, 29), fill=TIMBER, width=1)
        d.rectangle((8, 11, 24, 16), fill=TIMBER)
        d.polygon([(7, 11), (16, 4), (25, 11)], fill=DARK)
    elif t == 2:
        d.rectangle((11, 16, 21, 29), fill=STONE)
        d.rectangle((9, 11, 23, 16), fill=TIMBER)
        d.polygon([(8, 11), (16, 5), (24, 11)], fill=DARK)
        d.rectangle((14, 18, 18, 22), fill=GLOW)
    else:
        d.rectangle((10, 10, 22, 29), fill=STONE)
        for yy in (16, 22, 27):
            d.line((10, yy, 22, yy), fill=DARK, width=1)
        for cx in (10, 14, 18, 22):  # crenellation
            d.rectangle((cx - 1, 6, cx + 1, 10), fill=STONE)
        d.rectangle((14, 12, 18, 15), fill=EMBER)  # brazier
        d.point((16, 11), fill=GLOW)
        d.line((21, 10, 21, 3), fill=TIMBER, width=1)
        d.polygon([(21, 3), (26, 5), (21, 7)], fill=GOLD)


def b_wall(d, t):
    if t == 1:  # palisade stakes
        for x in range(7, 26, 3):
            d.polygon([(x, 14), (x + 2, 14), (x + 2, 29), (x, 29), (x, 16)],
                      fill=TIMBER)
            d.point((x + 1, 15), fill=STRAW)
        d.line((6, 20, 26, 20), fill=DARK, width=2)
    elif t == 2:
        d.rectangle((6, 14, 26, 29), fill=STONE)
        for yy in (19, 24):
            d.line((6, yy, 26, yy), fill=DARK, width=1)
        for xx in (11, 16, 21):
            d.line((xx, 14, xx, 29), fill=DARK, width=1)
    else:
        d.rectangle((6, 10, 26, 29), fill=STONE)
        for yy in (16, 22, 27):
            d.line((6, yy, 26, yy), fill=DARK, width=1)
        for cx in (6, 11, 16, 21, 26):  # crenels + gold cap
            d.rectangle((cx - 1, 6, cx + 1, 10), fill=STONE)
        d.line((6, 6, 26, 6), fill=GOLD, width=1)


def b_trap(d, t):
    d.ellipse((6, 20, 26, 29), fill=INK)  # the pit is always there
    if t == 1:
        d.ellipse((8, 21, 24, 27), fill=DARK)
        for x in range(9, 24, 4):
            d.line((x, 21, x + 2, 27), fill=STRAW, width=1)
    elif t == 2:
        for x in range(8, 25, 4):
            d.polygon([(x, 27), (x + 2, 16), (x + 4, 27)], fill=STONE)
            d.point((x + 2, 17), fill=FOAM)
    else:
        d.rectangle((5, 12, 27, 15), fill=TIMBER)  # frame
        d.rectangle((5, 12, 8, 29), fill=TIMBER)
        d.rectangle((24, 12, 27, 29), fill=TIMBER)
        for x in range(9, 24, 3):
            d.polygon([(x, 27), (x + 1, 17), (x + 3, 27)], fill=STONE)
            d.line((x + 1, 17, x + 1, 20), fill=EMBER, width=1)


def b_farm(d, t):
    for r in range(3 + t):  # furrows multiply per tier
        y = 16 + r * 3
        d.line((5, y, 27, y), fill=DARK, width=2)
        for x in range(7, 26, 4):
            h = 1 + (t > 1) + (t > 2 and (x + r) % 2)
            d.line((x, y, x, y - h - 1), fill=LEAF if t < 3 else GOLD, width=1)
    if t >= 2:  # fence
        for x in (4, 28):
            d.line((x, 12, x, 28), fill=TIMBER, width=2)
        d.line((4, 14, 28, 14), fill=TIMBER, width=1)
    if t >= 3:  # scarecrow
        d.line((24, 6, 24, 14), fill=TIMBER, width=1)
        d.line((21, 8, 27, 8), fill=TIMBER, width=1)
        d.rectangle((23, 4, 25, 7), fill=STRAW)


def b_lumber(d, t):
    d.ellipse((7, 24, 13, 29), fill=TIMBER)  # stump
    d.ellipse((8, 24, 12, 27), fill=STRAW)
    for i in range(1 + t):  # log stack grows
        y = 26 - i * 3
        d.rectangle((15, y, 15 + 6 + i, y + 2), fill=TIMBER)
        d.point((15, y + 1), fill=STRAW)
    if t >= 2:  # sawbuck
        d.line((22, 20, 26, 28), fill=DARK, width=2)
        d.line((26, 20, 22, 28), fill=DARK, width=2)
    if t >= 3:  # open shed
        d.rectangle((4, 8, 12, 10), fill=DARK)
        d.line((4, 10, 4, 24), fill=TIMBER, width=2)
        d.line((12, 10, 12, 24), fill=TIMBER, width=2)


def b_mine(d, t):
    d.polygon([(8, 29), (12, 16), (20, 16), (24, 29)], fill=INK)  # shaft
    d.polygon([(10, 29), (13, 19), (19, 19), (22, 29)], fill=DARK)
    d.line((8, 16, 24, 16), fill=TIMBER, width=2)  # lintel
    for x in (8, 24):
        d.line((x, 16, x, 29), fill=TIMBER, width=2)
    if t >= 2:  # headframe
        d.line((10, 16, 16, 4), fill=TIMBER, width=2)
        d.line((22, 16, 16, 4), fill=TIMBER, width=2)
        d.line((16, 4, 16, 12), fill=DARK, width=1)
        d.point((16, 13), fill=GOLD)
    if t >= 3:  # rails + lantern
        d.line((2, 28, 10, 28), fill=STONE, width=1)
        d.line((2, 29, 10, 29), fill=STONE, width=1)
        d.rectangle((24, 20, 28, 25), fill=GOLD)
        d.point((26, 22), fill=GLOW)


# ---- 2-tier families ----
def fam_house(wall_c, roof_c, wing=False):
    def f(d, t):
        house(d, t, 16 + t * 2, wall_c, roof_c, wing=wing,
              frame=(wall_c == TIMBER and t == 1), windows=1)
    return f


def b_pond(d, t):
    d.ellipse((3, 16, 29, 29), fill=WATER)
    d.ellipse((7, 19, 25, 27), fill=shade(WATER, 1.25))
    d.arc((9, 20, 23, 26), 200, 340, fill=FOAM, width=1)
    for x, h in [(4, 8), (7, 11), (27, 9)]:
        d.line((x, 17, x, 17 - h), fill=MOSS, width=2)
        d.point((x, 16 - h), fill=GOLD)
    if t >= 2:  # dock + lily
        d.rectangle((18, 12, 27, 15), fill=TIMBER)
        for x in (19, 26):
            d.line((x, 15, x, 22), fill=DARK, width=1)
        d.ellipse((11, 21, 15, 24), fill=LEAF)
        d.point((13, 22), fill=GLOW)


def b_pasture(d, t):
    for x in (4, 12, 20, 28):
        d.line((x, 18, x, 28), fill=TIMBER, width=2)
    d.line((4, 20, 28, 20), fill=TIMBER, width=1)
    d.line((4, 24, 28, 24), fill=TIMBER, width=1)
    for x in (7, 15, 23):
        d.line((x, 28, x, 25), fill=MOSS, width=2)
    if t >= 2:  # shelter + haystack
        d.rectangle((5, 10, 14, 12), fill=DARK)
        d.line((5, 12, 5, 20), fill=TIMBER, width=2)
        d.line((14, 12, 14, 20), fill=TIMBER, width=2)
        d.polygon([(20, 28), (24, 18), (28, 28)], fill=STRAW)
        d.line((24, 18, 24, 28), fill=DARK, width=1)


def b_grove(d, t):
    trees = [(9, 24, 8), (16, 26, 11), (23, 24, 8)] if t == 1 else \
        [(7, 26, 12), (16, 28, 15), (25, 26, 12)]
    for x, base, h in trees:
        d.line((x, base, x, base - h // 3), fill=DARK, width=2)
        for l in range(3):
            top = base - h + l * (h // 4)
            d.polygon([(x, top), (x + 6 - l, top + 9), (x - 6 + l, top + 9)],
                      fill=[PINE, MOSS, LEAF][l])
    if t >= 2:  # fireflies
        for x, y in [(6, 12), (13, 9), (21, 11), (26, 14)]:
            d.point((x, y), fill=GLOW)


def b_watchfire(d, t):
    d.ellipse((9, 24, 23, 30), fill=STONE)  # stone ring
    d.ellipse((12, 25, 20, 29), fill=INK)
    if t == 1:
        d.line((14, 24, 14, 18), fill=TIMBER, width=2)
        d.line((18, 24, 18, 18), fill=TIMBER, width=2)
        d.polygon([(14, 18), (16, 12), (18, 18)], fill=EMBER)
        d.point((16, 15), fill=GLOW)
    else:  # beacon tower
        d.line((13, 25, 13, 10), fill=TIMBER, width=2)
        d.line((19, 25, 19, 10), fill=TIMBER, width=2)
        d.rectangle((11, 6, 21, 10), fill=DARK)
        d.polygon([(12, 6), (16, -1), (20, 6)], fill=EMBER)
        d.polygon([(14, 6), (16, 1), (18, 6)], fill=GOLD)
        d.point((16, 3), fill=GLOW)


def make_buildings():
    three = {'hall': b_hall, 'barracks': b_barracks, 'tower': b_tower,
             'wall': b_wall, 'trap': b_trap, 'farm': b_farm,
             'lumber': b_lumber, 'mine': b_mine}
    for name, fn in three.items():
        for t in (1, 2, 3):
            building(name, t, fn)
    two = {'cottage': fam_house(TIMBER, STRAW, wing=True),
           'chapel': fam_house(STONE, PINE),
           'forge': fam_house(STONE, DARK),
           'workshop': fam_house(TIMBER, TIMBER),
           'butchery': fam_house(TIMBER, HIDE),
           'tannery': fam_house(HIDE, MOSS),
           'armory': fam_house(STONE, STONE),
           'mason_yard': fam_house(STONE, TIMBER),
           'scout_post': fam_house(TIMBER, PINE),
           'scriptorium': fam_house(STRAW, DARK),
           'pond': b_pond, 'pasture': b_pasture, 'grove': b_grove,
           'watchfire': b_watchfire}
    for name, fn in two.items():
        for t in (1, 2):
            building(name, t, fn)
    # chapel spire + forge glow accents so same-family houses still differ
    for t in (1, 2):
        im, d = C()
        fam_house(STONE, PINE)(d, t)
        d.line((16, 12 - t * 2, 16, 6 - t * 2), fill=STONE, width=2)
        d.point((16, 5 - t * 2), fill=GOLD)
        finish(im, f'chapel-{t}')
        im, d = C()
        fam_house(STONE, DARK)(d, t)
        d.rectangle((20, 22, 24, 26), fill=INK)
        d.point((22, 23), fill=EMBER)
        d.point((22, 24), fill=GLOW)
        finish(im, f'forge-{t}')


if __name__ == '__main__':
    make_troops()
    make_raider()
    make_items()
    make_buildings()
    import glob as _g
    print('sprites on disk:', len(_g.glob(str(OUT / '*.png'))))
