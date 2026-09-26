"""Original 32px placeholder sprites; run with Python + Pillow to regenerate."""
from PIL import Image, ImageDraw
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'assets'/'sprites'
out.mkdir(parents=True,exist_ok=True)
ink='#202b36'; stone='#929b9c'; light='#d2c7a4'; timber='#9e6c45'; dark='#65472f'; roof='#698b8c'; gold='#edc878'
def canvas():
 im=Image.new('RGBA',(32,32)); return im,ImageDraw.Draw(im)
def save(im,name): im.save(out/(name+'.png'))
for kind in ['hall','farm','lumber','mine','barracks','wall','tower','trap']:
 for t in range(1,4):
  im,d=canvas()
  if kind=='hall':
   d.rectangle((5,14,26,29),fill=timber if t==1 else stone,outline=ink)
   d.polygon([(3,14),(15,3),(29,14)],fill=roof,outline=ink)
   d.rectangle((13,22,18,29),fill=ink); d.rectangle((8,17,11,20),fill=gold)
   if t>=2:
    d.rectangle((22,8,28,29),fill=stone,outline=ink); d.polygon([(21,8),(25,1),(29,8)],fill='#627888')
   if t==3:
    d.rectangle((2,10,8,29),fill=light,outline=ink)
    for x in [2,5,8]: d.rectangle((x,7,x+1,11),fill=light)
    d.line((16,3,16,0),fill=gold); d.rectangle((17,0,22,2),fill='#a26b7e')
  elif kind=='farm':
   d.polygon([(1,14),(18,6),(31,17),(14,30)],fill='#6f5039',outline=ink)
   for y in range(13,26,4):
    for x in range(6,25,5):
     d.line((x,y+2,x,y-2),fill='#c7bd72',width=1); d.point((x-1,y-1),fill=gold)
   if t>=2: d.rectangle((22,3,28,13),fill=timber,outline=ink); d.polygon([(21,3),(25,0),(29,3)],fill=roof)
   if t==3:
    d.rectangle((3,3,7,15),fill=light); d.line((0,1,12,10),fill=light,width=2); d.line((12,1,0,10),fill=light,width=2)
  elif kind=='lumber':
   for x in range(3,20,6):
    d.rectangle((x,19,x+5,28),fill=timber,outline=ink); d.ellipse((x,18,x+5,23),fill=light,outline=dark)
   d.rectangle((21,9,24,27),fill=dark); d.polygon([(15,18),(23,1),(31,18)],fill='#547b60',outline=ink)
   if t>=2: d.rectangle((2,11,17,14),fill=stone); d.line((4,8,16,8),fill=light,width=2)
   if t==3: d.polygon([(0,7),(9,1),(19,7)],fill=roof); d.line((1,7,1,25),fill=timber,width=2)
  elif kind=='mine':
   d.polygon([(1,28),(5,10),(15,3),(24,8),(31,28)],fill='#78778c',outline=ink)
   d.rectangle((10,16,22,29),fill=ink); d.line((9,28,9,14,23,14,23,28),fill=timber,width=3)
   d.polygon([(4,16),(6,11),(9,16),(6,20)],fill='#ba9bd5')
   if t>=2: d.line((13,28,11,31),fill=stone,width=2); d.line((20,28,22,31),fill=stone,width=2)
   if t==3: d.rectangle((22,21,30,27),fill=gold,outline=ink); d.ellipse((23,27,26,30),fill=ink); d.ellipse((28,27,31,30),fill=ink)
  elif kind=='barracks':
   d.polygon([(2,27),(14,5),(29,27)],fill='#8b6675',outline=ink); d.polygon([(10,27),(15,15),(21,27)],fill=ink)
   if t>=2: d.rectangle((1,23,30,29),fill=stone); d.rectangle((13,23,18,29),fill=ink)
   if t==3: d.rectangle((2,11,7,28),fill=stone,outline=ink); d.rectangle((25,11,30,28),fill=stone,outline=ink)
   d.line((15,6,15,0),fill=light); d.polygon([(16,0),(24,2),(16,4)],fill=gold)
  elif kind=='wall':
   for x in range(2,31,5):
    if t==1: d.polygon([(x,29),(x,10),(x+2,6),(x+4,10),(x+4,29)],fill=timber,outline=ink)
    else: d.rectangle((x,13,x+5,29),fill=stone,outline=ink); d.rectangle((x,9,x+3,14),fill=light)
   if t==3: d.rectangle((1,22,31,26),fill=light,outline=ink); d.rectangle((12,6,21,28),fill=stone,outline=ink)
  elif kind=='tower':
   d.polygon([(6,29),(10,10),(22,10),(27,29)],fill=timber if t==1 else stone,outline=ink)
   d.rectangle((5,9,26,14),fill=light,outline=ink)
   if t==1: d.polygon([(3,9),(15,1),(28,9)],fill=roof,outline=ink)
   else:
    for x in range(5,27,5): d.rectangle((x,4,x+2,10),fill=light)
   d.rectangle((14,16,18,22),fill=ink)
   if t==3: d.line((9,4,24,0),fill=gold,width=3); d.line((18,0,18,8),fill=ink,width=2)
  elif kind=='trap':
   d.ellipse((2,16,30,29),fill=dark,outline=ink)
   for x in range(5,29,5): d.polygon([(x-2,25),(x,11-t*2),(x+2,25)],fill=stone if t>1 else timber,outline=ink)
   if t==3: d.line((1,28,30,28),fill=gold,width=2)
  save(im,f'{kind}-{t}')
for kind,c in [('warrior','#c79175'),('archer','#9fc782'),('miner','#ad98d0'),('builder','#e7c77c'),('farmer','#73b7a7'),('raider','#ca7375')]:
 im,d=canvas(); d.ellipse((9,26,24,30),fill='#17272b88')
 d.rectangle((12,21,15,28),fill=ink); d.rectangle((19,21,22,28),fill=ink)
 if kind=='archer': d.polygon([(8,24),(12,10),(23,10),(26,25)],fill=c,outline=ink)
 elif kind=='miner': d.rectangle((10,13,24,24),fill=c,outline=ink); d.rectangle((6,15,10,23),fill=timber)
 elif kind=='warrior': d.rectangle((11,13,24,23),fill=stone,outline=ink); d.polygon([(7,16),(13,15),(14,22),(10,26),(6,22)],fill=c,outline=ink)
 elif kind=='farmer': d.polygon([(10,24),(12,13),(22,13),(26,24)],fill=c,outline=ink)
 else: d.rectangle((10,13,23,23),fill=c,outline=ink)
 d.rectangle((13,6,22,13),fill='#e1b68b',outline=ink)
 if kind=='archer': d.polygon([(10,8),(17,0),(24,8)],fill=c,outline=ink)
 elif kind=='farmer': d.rectangle((8,5,27,8),fill=gold); d.rectangle((14,2,21,5),fill=gold)
 elif kind=='miner': d.rectangle((11,3,24,7),fill=c); d.rectangle((16,3,19,6),fill=gold)
 elif kind=='warrior': d.rectangle((12,3,23,8),fill=stone); d.rectangle((16,0,19,4),fill=c)
 elif kind=='builder': d.rectangle((11,4,24,7),fill=gold)
 else: d.polygon([(11,5),(13,0),(16,5),(21,5),(24,0),(24,9)],fill=c)
 d.point((20,9),fill=ink); save(im,kind)
for kind in ['sword','axe','warhammer','bow','hammer','toolkit','pickaxe','cart','sickle','scythe']:
 im,d=canvas()
 if kind in ['sword','axe','warhammer','hammer','pickaxe','sickle','scythe']:
  d.line((15,28,15,8),fill=timber,width=3)
  if kind=='sword': d.polygon([(13,20),(13,5),(15,1),(17,5),(17,20)],fill=light,outline=ink); d.line((10,21,20,21),fill=gold,width=2)
  if kind=='axe': d.polygon([(15,6),(25,3),(27,14),(15,12)],fill=stone,outline=ink)
  if kind=='warhammer': d.rectangle((7,3,26,12),fill=stone,outline=ink); d.rectangle((7,3,10,12),fill=gold)
  if kind=='hammer': d.rectangle((10,6,22,11),fill=light,outline=ink)
  if kind=='pickaxe': d.line((5,12,12,6,20,7,27,12),fill=stone,width=3)
  if kind in ['sickle','scythe']: d.arc((7,2,27,18),180,345,fill=light,width=3)
 elif kind=='bow': d.arc((6,2,25,29),270,90,fill=timber,width=3); d.line((16,2,16,29),fill=light)
 elif kind=='cart':
  d.polygon([(3,12),(27,12),(24,23),(7,23)],fill=timber,outline=ink)
  for x in [7,22]: d.ellipse((x-3,23,x+3,29),fill=ink); d.point((x,26),fill=light)
  d.polygon([(7,12),(12,6),(18,11),(23,7),(25,12)],fill='#ba9bd5')
 else: d.rectangle((5,13,26,27),fill=timber,outline=ink); d.line((10,13,10,6,21,6,21,13),fill=gold,width=2)
 save(im,'item-'+kind)
print('Generated',len(list(out.glob('*.png'))),'distinct sprites')
