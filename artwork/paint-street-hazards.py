"""Paint the original 4 x 8 street prop atlas. Run with Pillow, numpy and DejaVu Sans or Arial."""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
atlas = Image.new("RGB", (1024, 1024))
rng = random.Random(232)
noise = np.random.default_rng(232)
W, H = 256, 128
navy = "#172729"
ivory = "#fff6db"
yellow = "#ffbc18"
orange = "#f57829"

def face(color):
    global im, d
    im = Image.new("RGB", (W, H), color)
    d = ImageDraw.Draw(im)

def letters(s, x, y, w, h, ink, narrow=False, italic=False):
    win = "arialbi.ttf" if italic else "ARIALNB.TTF" if narrow else "arialbd.ttf"
    try:
        font = ImageFont.truetype(win, 96)
    except OSError:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 96)
    box = font.getbbox(s)
    mask = Image.new("L", (box[2]-box[0], box[3]-box[1]))
    ImageDraw.Draw(mask).text((-box[0],-box[1]), s, fill=255, font=font)
    im.paste(ink, (x,y,x+w,y+h), mask.resize((w,h), Image.Resampling.LANCZOS))

def finish(index, grain=0.65, horizontal=0):
    arr = np.asarray(im, dtype=float)
    n = noise.normal(0, grain, (H,W,1)) + noise.normal(0, horizontal, (H,1,1))
    pic = Image.fromarray(np.uint8(np.clip(arr+n,0,255))).resize((248,120), Image.Resampling.LANCZOS)
    # Extrude four pixels around every island for mipmapped, oblique viewing.
    padded = Image.fromarray(np.pad(np.asarray(pic),((4,4),(4,4),(0,0)),mode="edge"))
    atlas.paste(padded, (index%4*256,index//4*128))

def bolt(x,y):
    d.ellipse((x-3,y-3,x+3,y+3), fill="#545955", outline="#d1d0c3")
    d.line((x-1,y+1,x+1,y-1),fill="#343b39")

def gradient(stops):
    for y in range(H):
        f=y/(H-1)
        for (a,lo),(b,hi) in zip(stops,stops[1:]):
            if a<=f<=b:
                rgb=tuple(round(l+(v-l)*(f-a)/(b-a)) for l,v in zip(lo,hi))
                d.line((0,y,W,y),fill=rgb)
                break

def steel():
    face("gray")
    gradient([(0,(216,225,223)),(.28,(135,155,157)),(.50,(237,237,219)),(.64,(166,178,171)),(1,(117,133,134))])

def border(radius=6):
    d.rounded_rectangle((2,2,253,125),radius,outline=navy,width=3)
    for x in (9,246):
        bolt(x,64)

face("white"); finish(0,0)
# Windshield, with a reflected city block and dashboard under the glass.
face("#314151")
gradient([(0,(24,42,54)),(.35,(99,134,152)),(.68,(130,163,176)),(1,(47,64,71))])
for x in range(-10,265,11):
    top=rng.randint(24,71)
    d.polygon([(x,top),(x+10,top-3),(x+20,110),(x+7,108)],fill=rng.choice(["#586e7b","#627e8a","#6f8994"]))
    for y in range(top+6,88,6):
        d.line((x+3+(y-top)//14,y,x+7+(y-top)//14,y-1),fill="#8c9da1")
d.polygon([(0,110),(29,94),(51,100),(57,76),(74,73),(82,97),(169,99),(173,77),(193,75),(199,97),(239,91),(255,103),(255,128),(0,128)],fill="#37464c")
d.polygon([(117,0),(151,0),(85,116),(69,119)],fill="#a4c0c4")
d.line((19,119,100,106),fill="#1f2527",width=3);d.line((128,115,203,103),fill="#1f2527",width=3)
d.line([(0,126),(0,0),(255,0),(255,126),(0,126)],fill="#3a3f3e",width=6)
finish(1)
# Slab between the real wheel wells. A pair of pressed doors and their pulls.
face(yellow);gradient([(0,(255,214,64)),(.25,(255,193,27)),(.76,(251,178,13)),(1,(207,130,10))])
for x in (4,126,250):
    d.line((x,0,x-3,99,x-8,114),fill="#ac730e",width=2)
for x in (26,150):
    d.rounded_rectangle((x,14,x+24,20),3,fill="#534938");d.line((x+2,15,x+21,15),fill="#fff4b6",width=2)
d.line((4,110,248,110),fill="#ffcf56",width=3)
d.ellipse((154,39,208,91),fill=navy);letters("T",167,49,30,31,ivory)
letters("NYC",117,59,33,15,navy);letters("8K42",12,71,31,12,navy)
finish(2)
# A full-width grille with projector lamps and a New York medallion plate.
face("#ffa914")
for mirrored in (False,True):
    def xy(p): return [(255-x if mirrored else x,y) for x,y in p]
    d.polygon(xy([(0,7),(70,18),(64,53),(8,45)]),fill="#222d35")
    d.polygon(xy([(3,11),(65,22),(58,42),(7,36)]),fill="#c9e6e9")
    for x in (24,46):
        cx=255-x if mirrored else x
        d.ellipse((cx-7,20,cx+7,35),fill="#fff9d4",outline="#8396a1",width=2)
    d.polygon(xy([(1,11),(10,13),(10,41),(2,36)]),fill="#ff910d")
    d.polygon(xy([(4,77),(40,73),(38,101),(6,103)]),fill="#343a39")
d.polygon([(69,17),(187,17),(177,49),(79,49)],fill="#29353a",outline="#ebdbc5",width=3)
for y in [24,33,42]: d.line((78,y,178,y),fill="#88989b",width=2)
d.rounded_rectangle((48,69,208,115),8,fill="#242b2c")
for y in range(75,112,8):d.line((54,y,202,y),fill="#5e6766",width=2)
d.rectangle((103,76,153,106),fill="#ffe3a6",outline="#95805c",width=2)
letters("NEW YORK",108,79,40,5,navy);letters("8K42",111,88,35,13,navy)
finish(3)
face(yellow);gradient([(0,(255,193,29)),(.35,(255,205,42)),(1,(249,171,13))])
for s in (-1,1):
    d.line((128+s*93,0,128+s*112,122),fill="#d69813",width=2);d.line((128+s*88,0,128+s*108,121),fill="#ffdd66",width=2)
letters("8K42",16,96,25,9,navy);finish(4)
face("#282c2a")
for r,c in [(60,"#222627"),(53,"#444746"),(48,"#1e2326"),(43,"#a8b3b3"),(38,"#4b5354"),(29,"#222c30")]:
    d.ellipse((128-r*2,64-r,128+r*2,64+r),fill=c)
for i in range(9):
    a=math.tau*i/9
    poly=[(128+2*r*math.cos(a+b),64+r*math.sin(a+b)) for r,b in [(12,-.24),(40,-.16),(40,.08),(17,.18)]]
    d.polygon(poly,fill="#c1cbca")
d.ellipse((103,51,153,77),fill="#757e7e",outline="#e6e9da",width=2);finish(5)
face("#fff1b6");d.rectangle((0,0,26,128),fill="#393c3c");d.rectangle((230,0,256,128),fill="#393c3c")
letters("8K42",40,13,176,100,navy,narrow=True);finish(6)
face(yellow)
for x in (4,184):
    d.rounded_rectangle((x,14,x+68,59),8,fill="#932e29");d.line((x+5,30,x+62,28),fill="#ff9d70",width=4)
d.rectangle((89,39,167,86),fill=ivory);letters("8K42",96,51,64,24,navy)
d.line((8,106,246,106),fill="#554c42",width=7);finish(7)
def platter(cx,cy,r):
    d.ellipse((cx-r,cy-r,cx+r,cy+r),fill="#e5dfc8",outline="#d3bd8c",width=2)
    for i in range(225):
        a=rng.random()*math.tau; rr=(r-4)*math.sqrt(rng.random());x=cx+math.cos(a)*rr;y=cy+math.sin(a)*rr
        colors=("#ead365","#ffa632","#8e471d","#b95623") if x<cx+4 else ("#689148","#a9bf63","#d34b2e")
        d.ellipse((x-2,y-1,x+3,y+2),fill=rng.choice(colors))
    for k in range(3):
        pts=[(cx-r*.60+i*r*.05,cy-r*.35+k*7+math.sin(i*.42)*3) for i in range(23)]
        d.line(pts,fill="#fff2c9",width=2)
face("#155d55");d.rectangle((0,0,255,12),fill="#e8ab33");d.rectangle((0,107,256,127),fill="#ab3627")
letters("MIDTOWN",10,18,115,13,"#ffe0a0");letters("HALAL",7,39,137,54,ivory,narrow=True)
letters("CHICKEN  Ã¢â‚¬Â¢  GYRO  Ã¢â‚¬Â¢  RICE",9,110,183,14,ivory);platter(201,61,44);finish(8)
steel()
for x in [3,105,249]:d.line((x,3,x,125),fill="#798c8d",width=3)
for y in range(22,111,10):
    d.rounded_rectangle((124,y,230,y+4),2,fill="#455859");d.line((126,y+4,228,y+4),fill="#d6d9d0")
for x in (10,245):
    for y in (9,117):bolt(x,y)
letters("CART  27",14,20,75,14,navy);finish(9,2,2.5)
face("#fff5de")
for x in range(0,260,8):d.line((x,0,x,127),fill="#f2e8d1")
gradient([(0,(245,232,198)),(.56,(255,250,226)),(1,(205,194,166))]);finish(10,2)
steel();finish(11,1.8,3)
face("#285641");d.rectangle((0,92,256,128),fill="#1c402f")
letters("SIDEWALK SHED",11,26,233,40,"#fff3d5",True);letters("W  28  ST     /     MANHATTAN",14,99,210,15,"#e0dfc7")
for x in (6,249):
    for y in (8,84):bolt(x,y)
finish(12)
face("#346449")
for x in range(0,256,45): d.line((x,0,x,127),fill="#244b37",width=3)
d.rectangle((144,19,224,111),fill="#ece9d8",outline="#172c29",width=3)
d.rectangle((147,25,221,48),fill="#225965");letters("WORK NOTICE",149,29,69,12,ivory)
for y in range(56,95,7):d.line((150,y,214-(y%5)*4,y),fill="#5a6358",width=2)
finish(13)
face("#9b825f")
for x in range(0,256,34):
    d.rectangle((x,0,x+31,127),fill=rng.choice(["#ab936e","#ad9373","#978164","#b39b76"]))
    for j in range(7):
        xx=x+rng.randint(1,29);d.line((xx,0,xx+rng.randint(-2,2),128),fill="#9f896a")
finish(14)
steel()
for x in range(6,256,14):
    d.line((x,2,x,126),fill="#819398",width=3);d.line((x+4,2,x+4,126),fill="#cddad8",width=3)
finish(15,1,1)
face("#f5efe2")
for x in range(-152,340,64):d.polygon([(x,0),(x+32,0),(x+105,128),(x+73,128)],fill="#f66a22")
for x in (6,249): bolt(x,64)
finish(16,2)
face(orange);gradient([(0,(255,144,56)),(.27,(255,133,36)),(.7,(239,99,24)),(1,(204,82,26))])
for x in (29,95,161,227):
    d.rounded_rectangle((x-8,30,x+9,107),8,outline="#d65818",width=4)
    d.line((x+8,43,x+8,97),fill="#ffc275",width=2)
finish(17)
face("#37694e")
for x in (0,84,171,252):
    d.line((x,0,x,127),fill="#233f34",width=3)
    for y in (7,57,117):bolt(x+5,y)
for i in range(100):
    x,y=rng.randrange(256),rng.randrange(128);d.line((x,y,x+1,y+rng.randrange(2,13)),fill=rng.choice(["#406f51","#2f6149"]))
finish(19)
face("#e87527");border();letters("STREET",30,15,196,41,navy,True);letters("CLOSED",23,65,210,46,navy,True);finish(20)
face("#f6ebcd");d.rectangle((0,0,33,128),fill="#d76b34");d.rectangle((224,0,256,128),fill="#d76b34")
letters("TICKETS",41,22,173,83,navy,True);finish(21)
for i,word,bg in [(22,"JUMP","#ffdb5c"),(23,"SLIDE","#99edee")]:
    face(bg);border();letters(word,27,26,202,74,navy,True);finish(i)
for i,(bg,ink,heading,first,second) in enumerate([
    ("#f4e9ce","#123e35","LOWER EAST SIDE","FREE PALESTINE","FREE MICS"),
    ("#f6bf48","#332329","BOROUGH ASSEMBLY","PROTEST","THIS PROTEST"),
    ("#f5deca","#7b2a35","SUNNYSIDE SOCIAL CLUB","NATIONALIZE","BRUNCH")]):
    face(bg)
    for _ in range(120):
        x,y=rng.randrange(256),rng.randrange(128);d.point((x,y),fill="#ab997b")
    letters(heading,19,9,201,12,ink,True);d.line((13,28,242,27),fill=ink,width=3)
    letters(first,9,36,237,34,ink,True,True);letters(second,13,77,228,39,ink,True,True)
    d.polygon([(0,0),(17,0),(0,18)],fill="#cdba94");d.line((3,120,239,120),fill=ink,width=2)
    finish(24+i,2.3)
steel();d.rounded_rectangle((3,5,251,123),13,fill="#403c32",outline="#a29e90",width=4)
for x in range(14,250,10):d.line((x,12,x,118),fill="#7a7669",width=2)
for i in range(19):
    x,y=rng.randint(20,225),rng.randint(21,105)
    d.ellipse((x-7,y-5,x+7,y+5),fill=rng.choice(["#9e4723","#b55f33","#b76b34","#c98c53"]),outline="#693a24")
finish(29)
face("#d3b997");letters("BOROUGH",19,34,217,25,"#34554c");letters("ASSEMBLY",27,67,197,20,"#34554c")
d.line((10,103,245,103),fill="#87684f",width=2);finish(30)
face("#566c78")
gradient([(0,(35,57,67)),(.52,(123,152,162)),(.88,(65,81,83)),(1,(41,56,62))])
for x in (36,64,145,193):
    d.polygon([(x,0),(x+14,0),(x-28,128),(x-41,128)],fill="#92a8ab")
d.rectangle((0,118,255,127),fill="#31393b");finish(31)
atlas.resize((1024, 512), Image.Resampling.LANCZOS).save(root/"public/art/street-hazards.webp","WEBP",quality=72,method=6)

