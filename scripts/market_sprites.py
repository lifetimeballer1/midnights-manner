"""Regenerate the six original market fallback sprites (32px, PIL only)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "assets" / "sprites"
INK = "#0b1220"
WOOD = "#725039"
STONE = "#9ca29a"
CANOPIES = ["#a9514c", "#527d68", "#b28b46", "#a9514c", "#527d68", "#b28b46"]

for tier in range(1, 7):
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Packed-earth plinth and three small, readable frontier stalls.
    d.polygon([(3, 25), (16, 19), (29, 25), (16, 31)], fill="#806347", outline=INK)
    count = 1 if tier < 3 else 2 if tier < 5 else 3
    for i in range(count):
        x = 5 + i * 9
        y = 15 + (i % 2)
        canopy = CANOPIES[i]
        d.rectangle((x + 1, y + 5, x + 6, 23), fill="#b38a59" if tier == 1 else WOOD, outline=INK)
        d.rectangle((x, y + 3, x + 1, 22), fill=WOOD, outline=INK)
        d.rectangle((x + 6, y + 3, x + 7, 22), fill=WOOD, outline=INK)
        d.polygon([(x - 1, y + 3), (x + 2, y), (x + 9, y), (x + 7, y + 3)], fill=canopy, outline=INK)
        if tier in (2, 4):
            for stripe in range(x, x + 7, 2):
                d.line((stripe, y + 2, stripe, y + 4), fill="#e9dab2", width=1)
        # Resource goods make the stalls legible at icon size.
        d.rectangle((x + 2, y + 7, x + 4, y + 9), fill="#d8c28e", outline=INK)
    if tier in (3, 5):
        d.rectangle((14, 10, 17, 20), fill=STONE, outline=INK)
        d.polygon([(12, 11), (15, 7), (19, 11)], fill="#e5bd66", outline=INK)
    if tier == 4:
        d.rectangle((13, 9, 18, 19), fill=STONE, outline=INK)
        d.rectangle((14, 10, 17, 12), fill="#e5bd66", outline=INK)
    if tier >= 5:
        d.rectangle((13, 4, 18, 7), fill="#e5bd66", outline=INK)
        d.rectangle((15, 2, 16, 9), fill=WOOD)
    if tier == 6:
        d.rectangle((3, 16, 5, 26), fill=STONE, outline=INK)
        d.rectangle((27, 16, 29, 26), fill=STONE, outline=INK)
    im.save(OUT / f"market-{tier}.png")
