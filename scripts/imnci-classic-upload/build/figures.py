# Figures for the classic course: book pages rendered as JPEG (forms, flowcharts)
# and pictures taken from the PDFs. Writes to the upload folder in the repo.
import os, subprocess, sys
from PIL import Image, ImageOps
UP = "/root/.claude/uploads/43c88e4f-6be9-5f9d-86f1-21ad3d9e2563"
PDF = {"ac": f"{UP}/6fd18fab-assess_and_classify_september_2023.pdf", "it": f"{UP}/60191ec7-identify_treatment_september_2023.pdf"}
IMG = "/tmp/claude-0/img"
OUT = sys.argv[1]
PAGES = {  # name: (book, pdf page) -- the PDF page is the book page + 1
    "ac-p17-fatima": ("ac", 18), "ac-p30-mona": ("ac", 31), "ac-p31-mona": ("ac", 32), "ac-p35-dysentery": ("ac", 36),
    "it-p12-intisar": ("it", 13), "it-p13-intisar": ("it", 14), "it-p20-abbas": ("it", 21), "it-p21-abbas": ("it", 22),
    "it-p26-sulieman": ("it", 27), "it-p27-sulieman": ("it", 28), "it-flowchart": ("it", 5), "it-plan-c": ("it", 8),
}
def render(book, page, out, dpi=110):
    tmp = out + ".tmp"
    subprocess.run(["pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page), "-singlefile", "-png", PDF[book], tmp], check=True)
    im = Image.open(tmp + ".png").convert("RGB")
    bg = Image.new("RGB", im.size, "white"); diff = ImageOps.invert(im.convert("L")).getbbox()
    if diff: im = im.crop((max(0, diff[0] - 20), max(0, diff[1] - 20), min(im.width, diff[2] + 20), min(im.height, diff[3] + 20)))
    os.remove(tmp + ".png")
    return im
for name, (book, page) in PAGES.items():
    im = render(book, page, os.path.join(OUT, name))
    ext = "png" if name in ("it-flowchart", "it-plan-c") else "jpg"
    im.save(os.path.join(OUT, f"{name}.{ext}"), quality=82, optimize=True)
# Pictures from the PDFs. The chest indrawing drawing is stored as a mask: invert it.
ImageOps.invert(Image.open(f"{IMG}/ac-015-007.png").convert("L")).save(os.path.join(OUT, "ac-chest-indrawing.png"), optimize=True)
Image.open(f"{IMG}/ac-074-053.png").convert("RGB").save(os.path.join(OUT, "ac-wfl-graph.png"), optimize=True)
Image.open(f"{IMG}/ac-075-055.png").convert("RGB").save(os.path.join(OUT, "ac-muac.png"), optimize=True)
Image.open(f"{IMG}/ac-080-056.png").convert("RGB").save(os.path.join(OUT, "ac-palm.png"), optimize=True)
