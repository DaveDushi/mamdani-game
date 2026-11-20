"""Paint the original road stencils, police tape and cardboard signs used by the two civic encounters."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

atlas = Image.new("RGB", (768, 512), "#efd799")
d = ImageDraw.Draw(atlas)
ink, cream, gold = "#182333", "#fff4ca", "#ffc640"
try:
    font = ImageFont.truetype("arialbd.ttf", 110)
except OSError:
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", 110)


def text(word, box, color):
    l, t, r, b = font.getbbox(word)
    mask = Image.new("L", (r-l, b-t))
    ImageDraw.Draw(mask).text((-l, -t), word, 255, font)
    l, t, r, b = box
    atlas.paste(color, box, mask.resize((r-l, b-t), Image.Resampling.LANCZOS))


# Top strip folds over the stanchions.
d.rectangle((0, 0, 767, 95), fill=gold)
d.rectangle((0, 5, 767, 10), fill=ink)
d.rectangle((0, 85, 767, 90), fill=ink)
text("NYPD", (24, 21, 193, 76), ink)
text("POLICE LINE", (255, 18, 739, 78), ink)
for x in (210, 225):
    d.polygon([(x, 74), (x+10, 21), (x+19, 21), (x+9, 74)], fill=ink)

# Two signs from the same march. The scarlet underline continues on the fallen one.
for left, top, bottom, paper, accent in (
    (0, "FAIR", "FARES", "#f5deb1", "#c64037"),
    (256, "FREEZE", "RENT", "#deeac4", "#1c7065"),
):
    d.rectangle((left, 96, left+255, 301), fill=paper)
    for y in (100, 106, 291, 297):
        d.line((left+5, y, left+250, y), fill="#c8b28e")
    text(top, (left+16, 114, left+236, 172), ink)
    text(bottom, (left+12, 182, left+244, 263), ink)
    d.polygon([(left+17, 278), (left+234, 270), (left+220, 281), (left+30, 285)], fill=accent)

# A horse in profile pulling a cabriolet. Cut the wheel spokes out of a dark rim.
d.rectangle((512, 96, 767, 301), fill=gold)
d.rounded_rectangle((516, 100, 763, 297), radius=20, outline=ink, width=7)
d.polygon([(532, 173), (574, 172), (577, 138), (594, 142), (609, 169),
           (598, 192), (541, 192)], fill=ink)
for x, y, radius in ((546, 196, 17), (595, 198, 13)):
    d.ellipse((x-radius,y-radius,x+radius,y+radius), fill=ink)
    d.ellipse((x-radius+5,y-radius+5,x+radius-5,y+radius-5), fill=gold)
    d.line((x-radius+3,y,x+radius-3,y), fill=ink, width=3)
    d.line((x,y-radius+3,x,y+radius-3), fill=ink, width=3)
d.polygon([(641,166),(659,157),(693,159),(707,141),(713,125),(718,138),(724,127),
           (726,143),(741,157),(736,165),(721,161),(709,180),(693,185),(702,199),
           (715,209),(712,213),(696,207),(679,188),(666,187),(655,204),(641,212),
           (637,210),(648,195),(651,182),(644,175),(629,188),(626,186)], fill=ink)
d.line((596,179,671,180), fill=ink, width=4)
text("CARRIAGE", (531, 230, 747, 271), ink)

for left, word in ((0, "DUCK"), (256, "JUMP")):
    d.rectangle((left, 304, left+255, 406), fill=ink)
    d.rectangle((left+6, 311, left+249, 399), outline=gold, width=5)
    text(word, (left+26, 325, left+230, 384), cream)

d.rectangle((512,304,767,406), fill="#792939")
d.rounded_rectangle((517,309,762,401), radius=18, outline=gold, width=4)
text("CENTRAL", (539,319,741,348), cream)
text("PARK", (567,356,714,388), gold)

d.rectangle((0,410,767,511), fill="#194b7b")
d.rectangle((0,417,767,423), fill=cream)
d.rectangle((0,496,767,502), fill=cream)
text("NYPD", (21,436,198,485), cream)
text("STREET CLOSED", (243,437,744,484), cream)

atlas.save(Path(__file__).resolve().parents[1] / "public/art/civic-signs.webp",
           method=6, lossless=True)
