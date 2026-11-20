"""Lists the shared Drive folder of WHO IMCI clips, downloads each file and
prints its name, Drive id, length and size. Usage: drive-list.py <folderId> <outdir>"""
import json, os, re, subprocess, sys, urllib.request

folder, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
html = urllib.request.urlopen(f"https://drive.google.com/embeddedfolderview?id={folder}").read().decode("utf-8", "replace")
files = re.findall(r'<a href="https://drive\.google\.com/file/d/([\w-]+)/[^"]*"[^>]*>.*?flip-entry-title">([^<]+)</div>', html, re.S)
rows = []
for fid, name in files:
    path = os.path.join(out, fid + ".mp4")
    if not os.path.exists(path):
        subprocess.run(["curl", "-sL", "-o", path, f"https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t"], check=False)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    rows.append({"id": fid, "name": name, "seconds": float(dur or 0), "bytes": os.path.getsize(path)})
    print(f"{fid}\t{float(dur or 0):8.2f}\t{os.path.getsize(path):>10}\t{name}", flush=True)
json.dump(rows, open(os.path.join(out, "drive.json"), "w"), indent=1)
print(len(rows), "files")
