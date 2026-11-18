# Figures for the Sudan ETAT course, from the WHO ETAT manual for participants (PDF).
#   python3 figures.py <manual.pdf> <out dir>
# Drawings: taken from the PDF (pdfimages; they are stored as masks, so they are
# inverted to black on white). Figures printed as two drawings are put side by side.
# Charts (Annex 3): each chart page rendered as printed.
import os, subprocess, sys, tempfile, glob
from PIL import Image, ImageOps

PDF, OUT = sys.argv[1], sys.argv[2]
OFFSET = 5   # PDF page = printed page + 5
FIGS = {  # figure: [(pdf page, image index)]
    1: [(12, 1)], 2: [(19, 2), (19, 3)], 3: [(20, 6), (20, 5)], 4: [(20, 4)], 5: [(21, 8)], 6: [(21, 7)],
    7: [(21, 9)], 8: [(22, 11), (22, 12)], 9: [(22, 10)], 10: [(23, 13)], 11: [(24, 14)], 12: [(24, 15)],
    13: [(24, 16)], 14: [(24, 17)], 15: [(25, 20), (25, 21)], 16: [(25, 18)], 17: [(25, 19)], 18: [(26, 24)],
    19: [(26, 22)], 20: [(26, 23)], 21: [(27, 25)], 22: [(31, 26)], 23: [(32, 27)], 24: [(33, 28), (33, 29)],
    25: [(34, 31)], 26: [(34, 30)], 27: [(42, 32)], 28: [(43, 34)], 29: [(43, 33)], 30: [(43, 35)],
    31: [(49, 36)], 32: [(49, 37), (49, 38)], 33: [(64, 39)], 34: [(64, 40)], 35: [(65, 41)], 36: [(65, 42)],
    37: [(66, 43)], 38: [(68, 44)],
}
CHARTS = {"02a": 67, "02b": 68, "03": 69, "04": 70, "05": 71, "06": 72, "07": 73, "08": 74, "09": 75, "10": 76, "11": 77}

os.makedirs(OUT, exist_ok=True)
tmp = tempfile.mkdtemp()
subprocess.run(["pdfimages", "-p", "-png", PDF, os.path.join(tmp, "m")], check=True)

def load(pg, idx):
    f = os.path.join(tmp, f"m-{pg:03d}-{idx:03d}.png")
    im = ImageOps.invert(Image.open(f).convert("L"))
    im.thumbnail((900, 900))
    return im

for n, parts in FIGS.items():
    ims = [load(p, i) for p, i in parts]
    h = max(i.height for i in ims)
    ims = [i.resize((int(i.width * h / i.height), h)) for i in ims]
    gap = 30
    out = Image.new("L", (sum(i.width for i in ims) + gap * (len(ims) - 1), h), 255)
    x = 0
    for i in ims:
        out.paste(i, (x, 0)); x += i.width + gap
    out.save(os.path.join(OUT, f"fig-{n:02d}.png"), optimize=True)

for name, page in CHARTS.items():
    pg = page + OFFSET
    base = os.path.join(tmp, f"c{name}")
    subprocess.run(["pdftoppm", "-r", "130", "-f", str(pg), "-l", str(pg), "-singlefile", "-png", PDF, base], check=True)
    im = Image.open(base + ".png").convert("RGB")
    im = im.crop((0, int(im.height * 0.035), im.width, int(im.height * 0.93)))   # page header and folio left out
    box = ImageOps.invert(im.convert("L")).getbbox()
    if box:
        im = im.crop((max(0, box[0] - 15), max(0, box[1] - 15), min(im.width, box[2] + 15), min(im.height, box[3] + 15)))
    im.save(os.path.join(OUT, f"chart-{name}.png"), optimize=True)
print("figures:", len(FIGS), "charts:", len(CHARTS))
