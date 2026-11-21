# Block and exercise helpers (copied from the ETAT build) for the Sudan Sick & Small Newborn course.
# Block shapes are the app's course-file blocks (course-packages/README.md).
import html as _h

def esc(s): return _h.escape(str(s), quote=False)

def H(text): return {"type": "heading", "text": text}
def Pp(text): return {"type": "paragraph", "text": text}
def L(items): return {"type": "list", "items": list(items)}
def R(html): return {"type": "rich", "text": html}
def note(text, label=None):
    b = {"type": "note", "text": text}
    if label: b["label"] = label
    return b
def goal(text): return note(text, "In this lesson")
def facil(text):
    """What the facilitator guide has the facilitator say or show at this point (Dec 2021 guide)."""
    return note(text, "From your facilitator")
def booklet(cats, caption, part="child"):
    return {"type": "booklet", "part": part, "categories": list(cats), "caption": caption}
def form(sections, caption, part="child"):
    return {"type": "form", "part": part, "sections": list(sections), "caption": caption}
def video(title, caption="", script=None, url=""):
    b = {"type": "video", "url": url, "title": title}
    if caption: b["caption"] = caption
    if script: b["script"] = script
    return b
def ex(eid, note_text=""):
    return {"type": "exercise", "exerciseId": eid, "note": note_text}
def reveal(q, a, label=None):
    b = {"type": "reveal", "text": q, "answer": a}
    if label: b["label"] = label
    return b
def flip(title, cards):
    return {"type": "flip", "title": title, "cards": [{"front": f, "back": b} for f, b in cards]}
def sort(text, groups, items, explanation=""):
    out = []
    for it in items:
        d = {"text": it[0], "group": groups.index(it[1])}
        if len(it) > 2 and it[2]: d["why"] = it[2]
        out.append(d)
    b = {"type": "sort", "text": text, "groups": list(groups), "items": out}
    if explanation: b["explanation"] = explanation
    return b
def steps(title, items):
    return {"type": "steps", "title": title, "steps": [{"title": t, "text": x} for t, x in items]}
def stage(text, question="", options=(), answer=0, explanation="", feedback=None):
    s = {"text": text}
    if question:
        s.update({"question": question, "options": list(options), "answer": answer, "explanation": explanation})
        if feedback: s["feedback"] = list(feedback)
    return s
def story(title, stages, label=None, text=""):
    b = {"type": "story", "title": title, "stages": list(stages)}
    if label: b["label"] = label
    if text: b["text"] = text
    return b
def calc(question, answer, unit="ml", text="", hint="", explanation="", title="", label=None, tolerance=None):
    """Work it out: the learner types a number (calc block in the app)."""
    b = {"type": "calc", "question": question, "answer": answer, "unit": unit}
    for k, v in (("text", text), ("hint", hint), ("explanation", explanation), ("title", title), ("label", label), ("tolerance", tolerance)):
        if v not in (None, ""): b[k] = v
    return b
def q(text, options, answer, explanation=""):
    return {"type": "question", "text": text, "options": list(options), "answer": answer, "explanation": explanation}
def courselink(course, module, lesson, label, text=""):
    """A link to a lesson taught elsewhere (another module or course): opens it in place."""
    b = {"type": "courselink", "course": course, "module": module, "lesson": lesson, "label": label}
    if text: b["text"] = text
    return b
def pagepic(name, page, caption=""):
    b = {"type": "page", "path": f"imnci-classic/{name}.jpg", "page": page}
    if caption: b["caption"] = caption
    return b
def photo(n, caption=""):
    """Photograph n of the IMNCI photograph booklet (Protocol management, Photograph booklet).
    One shared file in Storage: online-courses/imnci-photos/photo-NN.jpg."""
    b = {"type": "image", "path": f"imnci-photos/photo-{int(n):02d}.jpg", "caption": caption or f"Photograph {n}"}
    return b
def table(rows, caption=None):
    """A classification table: rows = [(colour, [signs, classification])]; colour severe | moderate | mild | note."""
    b = {"type": "table", "rows": [{"colour": c, "cells": list(cells)} for c, cells in rows]}
    if caption: b["caption"] = caption
    return b
def pre(text):
    """Text that keeps the book's layout (a chart box, a table or a form): the words as printed, in a fixed-width box."""
    return R('<pre style="white-space: pre; overflow-x: auto; font-size: 12px; line-height: 1.35">' + esc(text) + '</pre>')

def html_table(headers, rows):
    td = lambda x, b=False: f"<td style=\"padding: 4px; border: 1px solid #cbd5e1\">{'<strong>' + str(x) + '</strong>' if b else x}</td>"
    return R("<table style=\"width: 100%; border-collapse: collapse\"><tr>" + "".join(td(h, True) for h in headers) + "</tr>"
             + "".join("<tr>" + "".join(td(c) for c in r) + "</tr>" for r in rows) + "</table>")

def lesson(title, goal_text, blocks, pages=None):
    s = {"title": title, "read": [goal(goal_text)] + list(blocks), "see": [], "practise": []}
    if pages: s["bookFromPage"], s["bookToPage"] = pages
    return s

def module(title, order, lessons):
    for i, l in enumerate(lessons): l["order"] = i + 1
    return {"title": title, "order": order, "sections": lessons}

# ---- exercises (Manage Exercises format) --------------------------------------
SUB = "online IMCI course"   # the online-course exercise list the app loads (ONLINE_SUB_COURSE)
def _base(eid, order, title, narrative, source, minutes):
    return {"id": eid, "order": order, "title": f"Sick & Small Newborn: {title}", "subCourse": SUB, "passMark": 80,
            "estimatedMinutes": minutes, "draft": True, "source": source, "narrative": list(narrative)}

def quiz(eid, order, title, narrative, questions, source, minutes=5):
    e = _base(eid, order, title, narrative, source, minutes)
    e.update({"kind": "quiz", "questions": list(questions)})
    return e

def mcq(qid, text, options, correct, explain=""):
    return {"id": qid, "type": "mcq", "question": text, "options": list(options),
            "correct": correct if isinstance(correct, list) else [correct], "explain": explain}
def tf(qid, text, correct, explain=""):
    return {"id": qid, "type": "tf", "question": text, "correct": bool(correct), "explain": explain}
def open_q(qid, text, points, explain=""):
    return {"id": qid, "type": "open", "question": text, "points": list(points), "explain": explain}

NO_DANGER = {"notAbleToDrink": False, "vomitsEverything": False, "historyOfConvulsions": False,
             "lethargicUnconscious": False, "convulsingNow": False}
C = lambda k: k if k == "no_danger_sign" else f"imci.classifications.{k}"

def case(eid, order, title, narrative, sections, patient, assessments, classifications, points, source, minutes=10):
    """A case on the sick child recording form (2 months up to 5 years): the learner records the signs and classifies."""
    e = _base(eid, order, title, narrative, source, minutes)
    e.update({"expected": {"sections": list(sections), "patientData": patient, "assessments": assessments,
                           "classifications": {k: [C(x) for x in v] for k, v in classifications.items()},
                           "includeTreatment": False, "treatments": {}},
              "learningPoints": list(points), "explain": " ".join(points)})
    return e
