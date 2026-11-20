# Sudan ETAT: the two ETAT videos placed next to the text they show (2026-11-20).
# ET2.3 (z5a8yLa83p8) joins three silent WHO clips: central cyanosis 0:00-0:52, severe chest indrawing
# 0:52-2:06, stridor 2:06-3:22 (the lengths of the three Drive files). Each part goes after its sign.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "imnci-practice"))
import restructure as R

def C(vid, a, b, title, caption=""):
    return R.clip(f"https://youtu.be/{vid}", a, b, title, caption)

def apply(pkg):
    R.drop_videos(pkg, ["z5a8yLa83p8", "nQ4FGkblHoY"])
    P = lambda *a, **k: R.place(pkg, *a, **k)
    P(2, "Is the child breathing? Central cyanosis", "Cyanosis occurs when there is an abnormally low level of oxygen",
      [C("z5a8yLa83p8", 0, 52, "Central cyanosis", "A silent video: look at the colour of the tongue and the inside of the mouth.")])
    P(2, "Does the child have severe respiratory distress?", "If the child is talking, drinking or feeding comfortably",
      [C("z5a8yLa83p8", 52, 126, "Severe lower chest wall indrawing", "A silent video: look at the lower chest wall when the child breathes in.")])
    P(2, "Does the child have severe respiratory distress?", "Are there any noises heard when breathing in?",
      [C("z5a8yLa83p8", 126, 202, "Stridor", "Listen for the harsh noise when the child breathes in.")])
    P(2, "Give oxygen: sources of oxygen", "For all children who have any problem with their airway or breathing, always give oxygen first",
      [C("nQ4FGkblHoY", 0, 102, "Signs that a child needs oxygen")])
