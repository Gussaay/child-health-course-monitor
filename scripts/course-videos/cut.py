"""Rebuilds the YouTube parts of the course videos from the Drive source clips.

The parts were cut on 2026-11-18 (see the video-transcribe README in project
files): black trimmed from the start of each clip, then consecutive parts. The
exact length of every part is known from YouTube (parts.json, `ms`), so each
part starts where the one before it ended. A part YouTube gives no exact length
for is the last of its clip and runs to the clip's trimmed end.

sources.json says which Drive file each clip number is, and how the two ETAT
videos are made. Writes out/<YouTube id>.mp4 and out/built.json, and fails if
any part's length differs from YouTube's by more than 0.1 s.
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
parts = json.load(open(os.path.join(HERE, 'parts.json')))
sources = json.load(open(os.path.join(HERE, 'sources.json')))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
ENC = ['-vf', "scale=-2:'min(480,ih)'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p',
       '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart']


def src_path(fid):
    for d in ('drive-imci', 'drive-etat'):
        p = os.path.join(HERE, d, fid)
        if os.path.exists(p):
            return p
    sys.exit(f'missing Drive file {fid}')


def duration(path):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                                capture_output=True, text=True).stdout.strip() or 0)


def blacks(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-vf', 'blackdetect=d=0.3:pix_th=0.1', '-an', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return [(float(a), float(b)) for a, b in re.findall(r'black_start:([\d.]+) black_end:([\d.]+)', err)]


def silences(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=n=-35dB:d=1.0', '-vn', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]


def encode(src, start, length, dest):
    cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{start:.3f}', '-t', f'{length:.3f}', '-i', src] + ENC + [dest]
    subprocess.run(cmd, check=True)


built, problems = {}, []
by_clip = {}
for p in parts:
    if p['clip'] is not None:
        by_clip.setdefault(p['clip'], []).append(p)

for clip, items in sorted(by_clip.items()):
    fid = sources['clips'].get(str(clip))
    if not fid:
        problems.append(f'clip {clip}: no Drive file in sources.json')
        continue
    src = src_path(fid)
    total = duration(src)
    bl = blacks(src)
    lead = next((b for a, b in bl if a < 0.05), 0.0)
    tail = next((a for a, b in bl if b > total - 0.3), total)
    items.sort(key=lambda x: x['part'])
    pos = lead
    known = {x['part']: x for x in items}
    # A clip whose first part never reached YouTube: start its later part
    # counting back from the end, at the nearest pause.
    if 1 not in known:
        last = items[-1]
        guess = tail - last['approxSeconds']
        cands = [s - 0.4 for s in silences(src) if abs(s - 0.4 - guess) < 1.5]
        pos = min(cands, key=lambda s: abs(s - guess)) if cands else guess
        print(f'clip {clip}: part 1 missing, part {last["part"]} starts at {pos:.2f} (guess {guess:.2f})')
    for x in items:
        if x['ms']:
            length = x['ms'] / 1000
        else:
            length = tail - pos
        dest = os.path.join(OUT, f"{x['id']}.mp4")
        encode(src, pos, length, dest)
        got = duration(dest)
        want = x['ms'] / 1000 if x['ms'] else x['approxSeconds']
        # Without an exact length YouTube gives whole seconds, rounded up.
        ok = abs(got - want) <= 0.1 if x['ms'] else (want - 1.1 <= got <= want + 0.1)
        flag = '' if ok else '  <-- LENGTH DIFFERS'
        if flag:
            problems.append(f"{x['id']} {x['file']}: built {got:.2f}s, YouTube {want:.2f}s")
        print(f"{x['file']:>8} {x['id']}  {pos:8.2f} +{length:7.2f}  built {got:7.2f}  youtube {want:7.2f}  {os.path.getsize(dest)/1048576:5.1f} MB{flag}", flush=True)
        built[x['id']] = {'seconds': round(got, 2), 'bytes': os.path.getsize(dest), 'title': x['title']}
        pos += length
    if all(x['ms'] for x in items) and 1 in known:
        print(f'clip {clip}: parts end at {pos:.2f}, trimmed clip ends at {tail:.2f} (difference {tail - pos:+.2f} s)')

# ETAT: ET2.3 is three silent clips joined; "signs for oxygen" is one clip.
for x in parts:
    if x['clip'] is not None:
        continue
    recipe = sources['etat'].get(x['id'])
    if not recipe:
        problems.append(f"{x['id']} {x['file']}: no recipe in sources.json")
        continue
    files = [src_path(f) for f in recipe]
    dest = os.path.join(OUT, f"{x['id']}.mp4")
    if len(files) == 1:
        encode(files[0], 0, duration(files[0]), dest)
    else:
        inputs = []
        for f in files:
            inputs += ['-i', f]
        n = len(files)
        chain = ''.join(f'[{i}:v]scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25[v{i}];[{i}:a]aresample=44100[a{i}];' for i in range(n))
        chain += ''.join(f'[v{i}][a{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=1[v][a]'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y'] + inputs + ['-filter_complex', chain, '-map', '[v]', '-map', '[a]',
                        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
                        '-movflags', '+faststart', dest], check=True)
    got = duration(dest)
    want = x['ms'] / 1000 if x['ms'] else x['approxSeconds']
    flag = '' if abs(got - want) <= 1.5 else '  <-- LENGTH DIFFERS'
    if flag:
        problems.append(f"{x['id']} {x['file']}: built {got:.2f}s, YouTube {want:.2f}s")
    print(f"{x['file']:>26} {x['id']}  built {got:7.2f}  youtube {want:7.2f}  {os.path.getsize(dest)/1048576:5.1f} MB{flag}")
    built[x['id']] = {'seconds': round(got, 2), 'bytes': os.path.getsize(dest), 'title': x['title']}

json.dump(built, open(os.path.join(OUT, 'built.json'), 'w'), indent=1)
total = sum(v['bytes'] for v in built.values())
print(f'\n{len(built)} videos, {total/1048576:.1f} MB')
if problems:
    print('\nPROBLEMS:\n' + '\n'.join(problems))
    sys.exit(1)
