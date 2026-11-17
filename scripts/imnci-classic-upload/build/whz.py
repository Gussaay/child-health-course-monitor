# Weight-for-length/height category, the same method as the app's whz.js.
import json, os
D = json.load(open(os.path.join(os.path.dirname(__file__), "zscore_reference_data.json")))
def wfl(sex, age, kg, cm):
    g = ("boys" if sex == "male" else "girls") + ("_0_2" if age < 24 else "_2_5")
    row = D[g].get(f"{round(cm * 2) / 2:.1f}")
    if not row: return None
    if kg < row["-3"]: return "Less than -3 z-scores"
    if kg < row["-2"]: return "Between -3 and -2 z-scores"
    return "-2 z-scores or more"
