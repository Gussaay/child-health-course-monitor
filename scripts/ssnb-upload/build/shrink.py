# Makes every figure a JPEG of at most 1100 px wide (quality 82), so a lesson
# loads quickly on a phone. Run after extract_pdf.py / extract_docx.py.
#   python3 shrink.py ../figures
import os, sys
from PIL import Image
d = sys.argv[1]
for f in sorted(os.listdir(d)):
    p = os.path.join(d, f); base, ext = os.path.splitext(f)
    if ext.lower() not in ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.emf', '.wmf'): continue
    try:
        im = Image.open(p)
    except Exception as e:
        print('cannot read', f, e); continue
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA'); bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[-1]); im = bg
    else:
        im = im.convert('RGB')
    if im.width > 1100: im = im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS)
    out = os.path.join(d, base + '.jpg')
    im.save(out, 'JPEG', quality=82, optimize=True)
    if out != p: os.remove(p)
