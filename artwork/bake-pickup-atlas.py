"""Bake the sRGB pickup atlas. The rectangles match PickupArt.js (top-left pixels)."""
from math import cos, exp, pi, sin
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
rng = Random(232)
atlas = Image.new("RGB", (512, 512), (154, 146, 123))


def tile(x, y, im):
    # Duplicate the outer texels into the gutter for bilinear filtering and mipmaps.
    w, h = im.size
    atlas.paste(im.resize((w + 6, h + 6)), (x - 3, y - 3))
    atlas.paste(im, (x, y))


def grain(im, strength, weave=False):
    pixels = im.load()
    for y in range(im.height):
        for x in range(im.width):
            d = rng.uniform(-strength, strength)
            if weave:
                d += (2 if y % 3 == 0 else -1) + (2 if x % 3 == 0 else -1)
            pixels[x, y] = tuple(max(0, min(255, round(c + d))) for c in pixels[x, y])


def flag():
    im = Image.new("RGB", (248, 144))
    d = ImageDraw.Draw(im)
    colors = ["#d73b42", "#f18a35", "#ffcf42", "#34915e", "#326cb8", "#7b448f"]
    for i, color in enumerate(colors):
        y = 24 * i
        d.rectangle((0, y, 247, y + 23), fill=color)
        if i:
            base = im.getpixel((10, y))
            d.line((0, y, 247, y), fill=tuple(int(v*.76) for v in base))
    # The canvas heading is stitched around the pole. A double-needle hem runs down the fly.
    d.rectangle((0, 0, 9, 143), fill="#e7dbbd")
    d.line((9, 0, 9, 144), fill="#a4906f", width=2)
    for y in range(2, 144, 5):
        d.line((5, y, 5, y+2), fill="#9a8c73")
        base = im.getpixel((230, y))
        for x in (240, 244):
            d.line((x,y,x,y+2), fill=tuple(min(255, v+36) for v in base))
    grain(im, 4, True)
    return im


def scarf():
    im = Image.new("RGB", (248,248), "#f3ebd6")
    d = ImageDraw.Draw(im)
    ink, warp = "#24282a", "#57544e"
    # Paired zigzag yarns cross at little dark knots, with pale apertures in the mesh.
    for row in range(-2, 15):
        for col in range(-2, 16):
            x = col*24 + row%2*12
            y = row*19
            d.line([(x-12,y-19),(x,y),(x+12,y-19)],fill=ink,width=4)
            d.line([(x-11,y-15),(x,y+3),(x+11,y-15)],fill=warp,width=1)
            d.polygon([(x-5,y-3),(x+1,y-5),(x+5,y),(x,y+4)],fill=ink)
    # Wider loom bands near the folded edge break up the central net.
    for top in (26, 48):
        d.rectangle((0,top,247,top+8),fill="#e7deca")
        d.line((0,top,247,top),fill=ink,width=2)
        d.line((0,top+8,247,top+8),fill=ink,width=2)
        for x in range(-12,248,8):
            d.line((x,top+2,x+6,top+6),fill=ink,width=2)
    # Woven border along both bias-cut edges: twin dark rails and a row of leaves on a stem.
    for y in range(248):
        left = (y/247)*121
        for side in (-1,1):
            x = left if side==1 else 247-left
            for start, width, color in [(0,20,"#e3dcc8"),(1,3,ink),(6,1,ink),(12,2,ink),(18,2,ink)]:
                d.line((x+side*start,y,x+side*(start+width),y),fill=color)
            if y%9<5:
                a=6+(y%9)*1.3
                d.line((x+side*a,y,x+side*(a+4),y),fill=ink)
    grain(im, 8, True)
    return im


def mask():
    im=Image.new("RGB",(248,104))
    p=im.load()
    for y in range(104):
        for x in range(248):
            shade = 7*cos((x/247-.5)*pi) + 3*sin(y*.7)
            p[x,y] = tuple(round(v+shade) for v in (102,185,204))
    d=ImageDraw.Draw(im)
    for y in [24,48,71]:
        d.line((0,y+2,248,y+2),fill="#5698ae",width=2)
        d.line((0,y,248,y),fill="#b8dfe4",width=2)
    for x in (0,235):
        d.rectangle((x,0,x+12,104),fill="#a4d0d7")
        for y in range(3,103,6):
            for xx in (x+3,x+8):
                d.rounded_rectangle((xx,y,xx+2,y+3),radius=1,fill="#73adb8")
    for y in (4,98):
        d.line((0,y,248,y),fill="#add7db",width=4)
        for x in range(3,247,6):
            d.line((x,y,x+2,y),fill="#629fab")
    grain(im, 5)
    return im


def glass():
    im = Image.new("RGB",(248,244))
    p=im.load()
    for y in range(244):
        v=1-y/243
        for x in range(248):
            u=x/247
            warm=exp(-((u-.69)/.115)**2)*.68 + exp(-((u-.33)/.099)**2)*.46
            warm*=.63+.37*cos((v-.49)*pi)
            base=[60+137*warm,25+75*warm,15+14*warm]
            # Long reflected windows in the body and neck. The thicker heel has a honey-colored rim.
            for pos,width,power in [(.354,.014,.80),(.383,.006,.44),(.700,.024,.46),(.728,.007,.60),(.09,.06,.34),(.90,.04,.31)]:
                strip=exp(-((u-pos-.006*sin(v*5))/width)**2)
                strip*= (.43+.54*max(0,cos((v-.48)*pi))) * power
                base=[v1+(v2-v1)*strip for v1,v2 in zip(base,[248,206,136])]
            shoulder_glint=exp(-((u-.61-.026*sin(v*12))/.006)**2)*exp(-((v-.66)/.15)**4)
            base=[c+(hl-c)*shoulder_glint*.77 for c,hl in zip(base,(248,224,177))]
            band=exp(-((v-.044)/.012)**2)*.65 + exp(-((v-.889)/.008)**2)*.55
            p[x,y]=tuple(round(min(255,val+band*add)) for val,add in zip(base,(100,64,29)))
    return im


def font(name,px):
    for path in [Path('C:/Windows/Fonts')/name, Path('/usr/share/fonts/truetype/dejavu')/('DejaVuSerif-Bold.ttf' if 'georg' in name else 'DejaVuSans-Bold.ttf')]:
        if path.exists(): return ImageFont.truetype(str(path),px)
    return ImageFont.load_default(size=px)


def label():
    im=Image.new("RGB",(248,120),"#e7d1a5")
    d=ImageDraw.Draw(im)
    ink,red="#382722","#782e27"
    d.rounded_rectangle((2,2,245,117),radius=9,outline=red,width=3)
    d.rounded_rectangle((7,7,240,112),radius=6,outline="#9b713b",width=1)
    for x in (23,225):
        for i in range(9):
            y=25+i*7
            dx=4 if i%2 else -4
            d.line((x,y,x+dx,y-6),fill="#9e773e",width=2)
        d.line((x,21,x,90),fill="#9e773e",width=1)
    d.text((124,19),"B O R O U G H",font=font('georgiab.ttf',15),fill=red,anchor='mm')
    d.line((55,31,193,31),fill=red)
    d.text((124,59),"RYE",font=font('georgiab.ttf',60),fill=ink,anchor='mm')
    d.rectangle((42,82,206,100),fill=red)
    d.text((124,91),"NEW YORK WHISKEY",font=font('arialbd.ttf',12),fill="#f3dfb5",anchor='mm')
    d.text((124,107),"SMALL BATCH   •   90 PROOF",font=font('arialbd.ttf',7),fill=ink,anchor='mm')
    grain(im,4)
    return im


def cap():
    im=Image.new("RGB",(248,72))
    p=im.load()
    for y in range(im.height):
        for x in range(im.width):
            flute=13*cos(x*2*pi/8) if 7<y<59 else 0
            edge=24 if y in (2,3,7,60,61,68) else 0
            gloss=29*cos((x/247-.27)*2*pi)
            p[x,y]=tuple(round(c+flute+edge+gloss) for c in (156,94,45))
    return im


tile(4,4,scarf())
tile(260,4,flag())
tile(260,156,mask())
tile(4,264,glass())
tile(260,270,label())
tile(260,396,cap())
border = Image.new("RGB",(216,30),"#ece2c9")
d = ImageDraw.Draw(border)
for y in (2,4,23,26):
    d.line((0,y,216,y), fill="#363735", width=2)
for x in range(0,220,10):
    d.line((x,16,x+10,13), fill="#383a37", width=2)
    d.polygon([(x+3,15),(x+2,9),(x+7,11),(x+8,14)],fill="#303331")
    d.polygon([(x+6,15),(x+10,19),(x+10,21),(x+5,18)],fill="#303331")
grain(border,6,True)
tile(260,478,border)
tile(488,478,Image.new("RGB",(20,30),"white"))
atlas.save(ROOT/"public/art/pickup-surfaces.webp",quality=87,method=6)

