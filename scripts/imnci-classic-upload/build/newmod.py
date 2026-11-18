# Helpers shared by Modules 4 to 7 (Treat the child, Counsel the mother,
# Sick young infant, Follow-up).
from lib import *
from auto import A, fg, fg_lines

MAX = 20   # blocks per lesson before it is split at a heading

def lessons(title, goal_text, blocks, pages=None):
    """One lesson, or several ("part 2", ...) when it is long: split only at a heading or before an exercise."""
    parts, cur = [], []
    for b in blocks:
        cut = b["type"] in ("heading",) or (b["type"] == "rich" and "<pre" in b.get("text", "") and False)
        if cur and ((len(cur) >= MAX - 6 and cut) or len(cur) >= MAX + 2):
            parts.append(cur); cur = []
        cur.append(b)
    if cur: parts.append(cur)
    if len(parts) > 1 and len(parts[-1]) < 4:
        last = parts.pop(); parts[-1] += last
    out = []
    for i, p in enumerate(parts):
        t = title if i == 0 else f"{title} (part {i + 1})"
        g = goal_text if i == 0 else f"Continue: {goal_text[0].lower() + goal_text[1:]}"
        out.append(lesson(t, g, p, pages))
    return out

class Book:
    def __init__(self, mod, source, prefix, order0):
        self.M, self.source, self.prefix = mod, source, prefix
        self.EXERCISES, self._ord = [], [order0]

    def exo(self, slug, title, intro, fg_a, fg_b, question=None, minutes=10):
        """An exercise in the exercise manager: the learner writes the answers to the book's exercise
        (shown just above it in the lesson), then compares with the facilitator guide's answers."""
        self._ord[0] += 1
        pts = fg_lines(fg_a, fg_b)
        e = quiz(f"{self.prefix}-{slug}", self._ord[0], title, [intro], [
            open_q("answers", question or "Write your answers to each question of the exercise. Then compare them with the answers.",
                   pts, "The answers are the facilitator guide's answer sheet. Check yours point by point.")],
            self.source, minutes)
        self.EXERCISES.append(e)
        return ex(e["id"], e["title"].replace("Sudan IMNCI: ", ""))

def from_fg(a, b, label="From your facilitator"):
    return note(fg(a, b), label)

def discuss(question, a, b):
    """A group discussion or role play from the facilitator guide, as a card the learner opens after thinking."""
    return reveal(question, fg(a, b), "Discuss")
