# Lesson restructuring shared by the Sudan IMNCI (classic) and Sudan ETAT course builds.
#
# Run at the end of a build, after the book text has been placed. It never changes a word of the book:
#   1. drops the "In this lesson" summaries (they were written for the course, not taken from the book);
#   2. moves a check question that comes BEFORE the text it tests to just after that text;
#   3. drops a check question that repeats one already asked in the same lesson;
#   4. puts each video clip right after the text it shows (place()), instead of whole videos at the start;
#   5. reports book text that is out of the book's order (order_report()).
#
# A clip is a video block with "start" and "end" (seconds): the app plays only that part.
import re, json

def plain(b):
    if b.get("type") == "list":
        t = " ".join(map(str, b.get("items", [])))
    else:
        t = str(b.get("text", ""))
    t = re.sub(r"<[^>]+>", " ", t).replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", t).strip()

READ = ("paragraph", "list", "rich", "heading", "note", "table")
ACT = ("question", "reveal")

def words(s):
    return [w for w in re.findall(r"[a-z]{4,}", s.lower()) if w not in STOP]
STOP = set("that this with have when from they will your what does then there their them been into only more than also must should".split())

def clip(url, start, end, title, caption=""):
    b = {"type": "video", "url": url, "title": title, "start": int(start), "end": int(end)}
    if caption: b["caption"] = caption
    return b

def drop_goals(pkg):
    n = 0
    for m in pkg["modules"]:
        for s in m["sections"]:
            before = len(s["read"])
            s["read"] = [b for b in s["read"] if not (b["type"] == "note" and b.get("label") == "In this lesson")]
            n += before - len(s["read"])
    return n

def merge_broken(pkg):
    """A sentence the PDF layout broke in two (the end of it shown as a separate heading or paragraph, sometimes after
    a page picture) is joined back, so a paragraph never starts in the middle of a sentence. Words and order kept."""
    merged = []
    END = re.compile(r"[.?!:;)\]”\"]\s*$")
    for m in pkg["modules"]:
        for s in m["sections"]:
            rd = s["read"]
            i = 1
            while i < len(rd):
                b = rd[i]
                t = plain(b)
                cont = False
                if b["type"] in ("paragraph", "heading") and t:
                    caps_tail = b["type"] == "heading" and len(t) < 45 and t.endswith(".") and t.upper() == t
                    cont = t[0].islower() or caps_tail
                if cont:
                    j = i - 1
                    while j >= 0 and rd[j]["type"] in ("page", "image"): j -= 1
                    p = rd[j] if j >= 0 else None
                    if p and p["type"] in ("paragraph", "list", "heading") and not END.search(plain(p)) and plain(p):
                        if p["type"] == "list":
                            p["items"][-1] = p["items"][-1].rstrip() + " " + b["text"].strip()
                        else:
                            p["text"] = p["text"].rstrip() + " " + b["text"].strip()
                        merged.append((s["title"][:40], plain(p)[-70:]))
                        rd.pop(i)
                        continue
                i += 1
    return merged

def _act_text(b):
    parts = [b.get("explanation", ""), b.get("answer", "") if isinstance(b.get("answer"), str) else ""]
    fb = b.get("feedback")
    if isinstance(fb, list): parts += [str(x) for x in fb]
    return " ".join(parts)

def activities_after_text(pkg, min_ratio=0.6):
    """A question or reveal whose explanation is taken from a paragraph that comes later in the lesson is
    moved to just after that paragraph, so the learner reads before being asked."""
    moved = []
    for m in pkg["modules"]:
        for s in m["sections"]:
            rd = s["read"]
            changed = True
            guard = 0
            while changed and guard < 50:
                changed = False; guard += 1
                for i, b in enumerate(rd):
                    if b["type"] not in ACT: continue
                    w = set(words(_act_text(b))) | set(re.findall(r"\d+", _act_text(b)))
                    if len(w) < 4: continue
                    def score(x):
                        if x["type"] not in READ: return 0
                        have = set(words(plain(x)))
                        return len(w & have) / len(w)
                    best_before = max([score(x) for x in rd[:i]] or [0])
                    later = [(score(x), j) for j, x in enumerate(rd) if j > i]
                    if not later: continue
                    sc, j = max(later, key=lambda t: (t[0], -t[1]))
                    if sc >= min_ratio and sc > best_before + 0.05:
                        blk = rd.pop(i)
                        if blk.get("label") == "Before you start": blk.pop("label")
                        rd.insert(j, blk)   # j shifted by the pop: lands right after block j
                        moved.append((m["title"][:40], s["title"][:50], (blk.get("text") or "")[:60]))
                        changed = True
                        break
    return moved

def drop_pre_questions(pkg):
    """A "Before you start" question left at the start of a lesson asks about what the lesson has not taught yet; it goes,
    except in practice lessons, where it recalls what was taught before."""
    gone = []
    for m in pkg["modules"]:
        for s in m["sections"]:
            if s["title"].startswith("Practise"): continue
            keep = []
            for b in s["read"]:
                if b.get("label") == "Before you start":
                    gone.append((s["title"][:50], (b.get("text") or "")[:60])); continue
                keep.append(b)
            s["read"] = keep
    return gone

def dedupe_questions(pkg):
    """The same check (same explanation or answer) asked twice in one lesson: keep the first."""
    gone = []
    for m in pkg["modules"]:
        for s in m["sections"]:
            seen, out = [], []
            for b in s["read"]:
                if b["type"] in ACT and not (b["type"] == "reveal" and b.get("label")):
                    w = set(words(_act_text(b))) | set(re.findall(r"\d+", _act_text(b)))
                    qw = set(words(b.get("text", ""))) | set(re.findall(r"\d+", b.get("text", "")))
                    ov = lambda x, y: len(x & y) / max(1, min(len(x), len(y)))
                    same = lambda o: ov(w, o[0]) >= 0.8 and ov(qw, o[1]) >= 0.6
                    if len(w) >= 4 and any(same(o) for o in seen):
                        gone.append((s["title"][:50], (b.get("text") or "")[:60])); continue
                    if len(w) >= 4: seen.append((w, qw))
                out.append(b)
            # a "Check yourself" heading left with nothing after it goes too
            while out and out[-1]["type"] == "heading" and out[-1]["text"].strip().lower() == "check yourself":
                out.pop()
            s["read"] = out
    return gone

def drop_videos(pkg, ids):
    """Remove video blocks that show any of these YouTube ids (the long videos that the clips replace)."""
    n = 0
    for m in pkg["modules"]:
        for s in m["sections"]:
            keep = []
            for b in s["read"]:
                if b["type"] == "video" and any(i in (b.get("url") or "") for i in ids):
                    n += 1; continue
                keep.append(b)
            s["read"] = keep
    return n

def _split_rich(html, item):
    """Split a rich block's top-level <ul><li>..</li></ul> after the <li> that starts with `item`."""
    m = re.match(r"^\s*<ul([^>]*)>(.*)</ul>\s*$", html, re.S)
    if not m: return None
    attrs, body = m.group(1), m.group(2)
    lis, depth, start, i = [], 0, None, 0
    for t in re.finditer(r"<(/?)(li|ul|ol)\b[^>]*>", body):
        close, tag = t.group(1) == "/", t.group(2)
        if tag == "li" and not close and depth == 0: start = t.start()
        if not close: depth += 1
        else:
            depth -= 1
            if tag == "li" and depth == 0: lis.append(body[start:t.end()])
    for k, li in enumerate(lis):
        txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", li)).strip()
        if txt.startswith(item):
            a, b = lis[:k + 1], lis[k + 1:]
            if not b: return [html]
            return [f"<ul{attrs}>{''.join(a)}</ul>", f"<ul{attrs}>{''.join(b)}</ul>"]
    return None

def place(pkg, module, lesson, anchor, blocks, item=None, before=False):
    """Insert blocks after (or before) the block of `lesson` whose text contains `anchor`. With `item`, the
    list is split after the item that starts with `item` (layout only: the words and their order stay)."""
    secs = [s for s in pkg["modules"][module - 1]["sections"] if s["title"] == lesson]
    if len(secs) != 1: raise SystemExit(f"place: module {module} lesson {lesson!r} found {len(secs)} times")
    rd = secs[0]["read"]
    hits = [i for i, b in enumerate(rd) if b["type"] in READ + ("image", "page", "exercise", "video") and anchor in (plain(b) or b.get("exerciseId", "") or b.get("caption", "") or b.get("title", ""))]
    if len(hits) != 1: raise SystemExit(f"place: {lesson!r}: anchor {anchor!r} matches {len(hits)} blocks")
    i = hits[0]
    if item is not None:
        b = rd[i]
        if b["type"] == "list":
            ks = [k for k, x in enumerate(b["items"]) if re.sub(r"\s+", " ", x).strip().startswith(item)]
            if len(ks) != 1: raise SystemExit(f"place: {lesson!r}: item {item!r} matches {len(ks)} items")
            k = ks[0]
            if k + 1 < len(b["items"]):
                rest = dict(b, items=b["items"][k + 1:])
                rd[i] = dict(b, items=b["items"][:k + 1])
                rd.insert(i + 1, rest)
        elif b["type"] == "rich":
            parts = _split_rich(b["text"], item)
            if not parts: raise SystemExit(f"place: {lesson!r}: item {item!r} not found in the rich list")
            if len(parts) == 2:
                rd[i] = dict(b, text=parts[0]); rd.insert(i + 1, dict(b, text=parts[1]))
        else:
            raise SystemExit(f"place: {lesson!r}: item given but block is {b['type']}")
    at = i if before else i + 1
    rd[at:at] = list(blocks)

def long_runs(pkg, limit=3000):
    """Lessons where more than `limit` characters of reading follow each other with no activity."""
    out = []
    for mi, m in enumerate(pkg["modules"]):
        for s in m["sections"]:
            run, best = 0, 0
            for b in s["read"]:
                if b["type"] in READ or b["type"] in ("image", "page"):
                    run += len(plain(b)) if b["type"] != "table" else len(json.dumps(b.get("rows", []))) // 2
                    best = max(best, run)
                else:
                    run = 0
            if best > limit: out.append((mi + 1, s["title"], best))
    return out

def order_report(pkg, book_text_for_module):
    """Book paragraphs that appear in the course in a different order from the book.
    book_text_for_module(module_index) -> the book's text for that module, normalised like plain()."""
    report = []
    for mi, m in enumerate(pkg["modules"]):
        book = book_text_for_module(mi)
        if not book: continue
        norm = lambda t: re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()
        nb = norm(book)
        last, last_t = -1, ""
        for s in m["sections"]:
            for b in s["read"]:
                if b["type"] not in ("paragraph", "list", "heading", "rich"): continue
                t = norm(plain(b))
                if len(t) < 25: continue
                probe = t[:80]
                pos = nb.find(probe, max(0, last - 300))
                if pos < 0:
                    if nb.find(probe) >= 0:
                        report.append((mi + 1, s["title"], plain(b)[:90], last_t[:60]))
                    continue
                last, last_t = pos, plain(b)
    return report
