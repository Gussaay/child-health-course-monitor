# The facilitator guide (sources/fg.txt, pdftotext -raw of "Facilitator guide
# Sick and small newborn", 2026). Finds the answer key and key message the
# guide gives for a case exercise of the manual, by the case's title.
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
FG = open(os.path.join(HERE, 'sources', 'fg.txt'), encoding='utf-8').read().split('\n')
FURNITURE = re.compile(r'^(FACILITATOR GUIDE Sudan Training Course.*|\d+ \| Page)$')
LINES = [(n + 1, l.strip()) for n, l in enumerate(FG) if l.strip() and not FURNITURE.match(l.strip())]
KEY = re.compile(r'^(ANSWER KEY|Facilitator Answer Key.*|Answer key.*)$', re.I)
STOP = re.compile(r'^(KEY MESSAGE|FACILITATOR HINT|GROUP DISCUSSION|CASE-BASED DISCUSSION|EXERCISE / PRACTICE|Case \d+\b|Scenario \d+\b|Station \d+\b|Bed \d+\b|\d+\.\d+ [A-Z])')
LABEL = re.compile(r'^(•|●|o |\d+[.)] |[A-Z][A-Za-z /’\'()\-–]{1,40}:|Q\d)')

def norm(s): return re.sub(r'[^a-z0-9]+', ' ', s.lower().replace('’', "'")).strip()

def _paras(lines):
    out = []
    for l in lines:
        if out and not LABEL.match(l) and not re.search(r'[.:?!]$', out[-1]):
            out[-1] += ' ' + l
        elif out and not LABEL.match(l) and l[:1].islower():
            out[-1] += ' ' + l
        else:
            out.append(l)
    return [re.sub(r'^[•●]\s*', '', p) for p in out]

def answer_key(title, after_line=0, used=set()):
    """(fg line, points [paragraphs], key message, ask [questions]) for the case whose title ends with `title`."""
    want = norm(title)
    for k, (n, l) in enumerate(LINES):
        if n < after_line or n in used: continue
        if not (re.match(r'^(Case|Scenario|Station|Bed|Exercise)\b', l) or norm(l) == want): continue
        if not (norm(l).endswith(want) or (len(want) > 18 and want in norm(l))): continue
        # the key: the first answer-key box before the next case
        j = k + 1; ask = []
        while j < len(LINES) and not KEY.match(LINES[j][1]):
            if j > k + 1 and re.match(r'^(Case|Scenario) \d+\b', LINES[j][1]): break
            if LINES[j][1].startswith('•'): ask.append(LINES[j][1][1:].strip())
            j += 1
        if j >= len(LINES) or not KEY.match(LINES[j][1]): continue
        body, m = [], j + 1
        while m < len(LINES) and not STOP.match(LINES[m][1]):
            body.append(LINES[m][1]); m += 1
        msg = []
        if m < len(LINES) and LINES[m][1].startswith('KEY MESSAGE'):
            m += 1
            while m < len(LINES) and not STOP.match(LINES[m][1]) and len(msg) < 4:
                msg.append(LINES[m][1]); m += 1
                if re.search(r'[.!?]["”’]?$', msg[-1]): break
        return n, _paras(body), ' '.join(msg), ask
    return None

def fg_lines(a, b, drop=()):
    """The guide's own text, lines a..b (page furniture left out), as paragraphs.
    `drop`: line numbers to leave out (a facilitator's aside inside an answer)."""
    return _paras([l for n, l in LINES if a <= n <= b and n not in drop])
