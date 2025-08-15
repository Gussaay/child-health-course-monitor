import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { migrateLocalToFirestore } from './migrate';


// NEW: Firestore data helpers
import {
  listCoursesByType,
  upsertCourse,
  listParticipants as fetchParticipants,
  upsertParticipant as saveParticipant,
  addObservations as saveObservations,
  addCase as saveCase,
  listObservationsByCourse,
  listCasesByCourse,
} from './data';

/** =============================================================================
 * National Child Health Program - Courses Monitoring System
 * Firestore wiring (minimal edits):
 *  - Courses & participants loaded/saved via Firestore
 *  - Observations & cases saved to Firestore on submit
 *  - Reports read from Firestore
 *  - Local in-memory tables preserved for session UX & CSV export
 * ============================================================================ */

// ----------------------------- CONFIG & STORAGE ------------------------------
const API_BASE = ""; // keep empty for offline-first (unchanged)
const LS_COURSES = "imci_courses_v9";
const LS_PARTS   = "imci_participants_v9";
const LS_OBS     = "imci_observations_v9";
const LS_CASES   = "imci_cases_v2";

const uid = () => Math.random().toString(36).slice(2, 10);
const persist = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const restore = (k, d) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch { return d; } };

const STATE_LOCALITIES = {
  "الجزيرة": ["أم القرى","الحصاحيصا","المناقل","الكاملين","ود مدني"],
  "الخرطوم": ["محلية الخرطوم","جبل أولياء","شرق النيل","بحري","أمدرمان"],
  "القضارف": ["القضارف","باسندة","قلع النحل"],
  "الشمالية": ["دنقلا","مروي","الدبة"],
  "كسلا": ["مدينة كسلا","خشم القربة","حلفا الجديدة"],
  "سنار": ["سنار","سنجة","السوكي"],
  "نهر النيل": ["شندي","الدامر","عطبرة"],
  "شمال دارفور": ["الفاشر","كتم","كبكابية"],
  "جنوب دارفور": ["نيالا","كاس","قريضة"],
  "البحر الأحمر": ["بورتسودان","طوكر","سواكن"],
};

// ----------------------------- CLASSIFICATIONS ------------------------------
// 2-59 months
const CLASS_2_59M = {
  danger: ["Any Danger Sign"],
  respiratory: [
    "Severe pneumonia'disease",
    "Pneumonia",
    "Cough/cold",
    "Severe pneumonia/disease (Wheeze)",
    "Pneumonia (Wheeze)",
    "Cough/cold (Wheeze)"
  ],
  diarrhoea: [
    "Severe dehydration",
    "Some dehydration",
    "No dehydration",
    "Severe persistent",
    "Persistent",
    "Dysentery"
  ],
  fever_malaria: [
    "Very severe febrile disease",
    "Malaria",
    "fever - malaria unlikly",
    "Severe complicated measles",
    "Measles - Eye/mouth complications",
    "Measles"
  ],
  ear: [
    "Mastoiditis",
    "Acute ear infection",
    "Chronic ear infection",
    "No ear infection"
  ],
  malnutrition: [
    "Complicated Severe Acute malnutrition SAM",
    "Un-complicated Severe Acute malnutrition SAM",
    "Moderate Acute malnutrition MAM",
    "No Acute Malnutrition"
  ],
  anaemia: [
    "Severe Anaemia",
    "Anemia",
    "No anaemia"
  ],
  treatment_2_59m: [
    "ORAL DRUGS",
    "PLAN A",
    "PLAN B",
    "LOCAL INFECTION"
  ],
  counsel: [
    "assess and council for vaacination",
    "Asks feeding questions",
    "Feeding problems identified",
    "Gives advice on feeding problems",
    "COUNSEL WHEN TO RETURN"
  ],
};

// 0-59 days
const CLASS_0_59D = {
  bacterial: [
    "Possible serious bacterial infection",
    "Local bacterial infection",
    "bacterial infection Unlikely"
  ],
  jaundice: [
    "Severe Jundice",
    "Jaundice",
    "No Jundice"
  ],
  vyi_diarrhoea: [
    "Severe dehydration",
    "Some dehydration",
    "No dehydration",
    "Persistent diarrhea",
    "Blood in Stool"
  ],
  feeding: [
    "Breastfeeding attachment and suckling assessed",
    "Feeding problem or low weight",
    "No feeding problem"
  ],
  treatment_0_59d: [
    "Teach correct positioning and attachment",
    "Advise on home care"
  ],
};

const DOMAINS_BY_AGE = {
  GE2M_LE5Y: [
    "danger","respiratory","diarrhoea","fever_malaria","ear","malnutrition","anaemia","treatment_2_59m","counsel"
  ],
  LT2M:      ["bacterial","jaundice","vyi_diarrhoea","feeding","treatment_0_59d"],
};

const DOMAIN_LABEL = {
  danger:"Danger signs",
  respiratory:"Respiratory (2-59 m)",
  diarrhoea:"Diarrhoea (2-59 m)",
  fever_malaria:"Fever/Malaria (2-59 m)",
  ear:"Ear (2-59 m)",
  malnutrition:"Malnutrition (2-59 m)",
  anaemia:"Anaemia (2-59 m)",
  treatment_2_59m:"Treatment (2-59 m)",
  counsel:"Counsel (vaccination, feeding, return immediately)",

  bacterial:"Bacterial infection (0-59 d)",
  jaundice:"Jaundice (0-59 d)",
  vyi_diarrhoea:"Diarrhoea (0-59 d)",
  feeding:"Feeding (0-59 d)",
  treatment_0_59d:"Treatment/Counsel (0-59 d)"
};

const getClassList = (age, d) => (age === "GE2M_LE5Y" ? CLASS_2_59M[d] : CLASS_0_59D[d]) || [];

// ----------------------------- SMALL HELPERS --------------------------------
const percent = (c, s) => (!s ? "—" : (Math.round((1000 * c) / s) / 10).toFixed(1) + " %");
const calcPct = (c, s) => (!s ? NaN : (c * 100) / s);
const fmtPct = v => (!isFinite(v) ? "—" : (Math.round(v * 10) / 10).toFixed(1) + " %");
const pctBgClass = v => (!isFinite(v) ? "" : v < 50 ? "bg-pink-100" : v <= 80 ? "bg-yellow-100" : "bg-green-100");
const safeCSV = (s) => {
  const v = s == null ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

// -----------------------------------------------------------------------------
// Root App
// -----------------------------------------------------------------------------
export default function App() {
  const [view, setView] = useState("landing");
  // MINIMAL EDIT: start empty; will load from Firestore
  const [courses, setCourses] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [activeCourseType, setActiveCourseType] = useState("IMNCI");

  // Migration: add facilitators[] if missing (for any locally restored data)
  useEffect(() => {
    setCourses(prev => prev.map(c => {
      if (Array.isArray(c.facilitators)) return c;
      const arr = [c.facilitator1,c.facilitator2,c.facilitator3,c.facilitator4,c.facilitator5,c.facilitator6].filter(Boolean);
      return { ...c, facilitators: arr };
    }));
  }, []);

  // REMOVE local persistence effects for courses/participants (now Firestore)
  // useEffect(() => persist(LS_COURSES, courses), [courses]);
  // useEffect(() => persist(LS_PARTS, participants), [participants]);

  // Load courses from Firestore whenever course type changes
  useEffect(() => {
    (async () => {
      const items = await listCoursesByType(activeCourseType);
      setCourses(items);
    })();
  }, [activeCourseType]);

  // Load participants from Firestore when a course is selected
  useEffect(() => {
    (async () => {
      if (!selectedCourseId) { setParticipants([]); return; }
      const list = await fetchParticipants(selectedCourseId);
      setParticipants(list);
    })();
  }, [selectedCourseId]);

  const selectedCourse = useMemo(() => courses.find(c => c.id === selectedCourseId) || null, [courses, selectedCourseId]);
  const courseParticipants = useMemo(() => participants.filter(p => p.courseId === selectedCourseId), [participants, selectedCourseId]);
  const selectedParticipant = useMemo(() => courseParticipants.find(p => p.id === selectedParticipantId) || null, [courseParticipants, selectedParticipantId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProgramLogo />
            <div>
              <h1 className="text-2xl font-semibold">National Child Health Program - Courses Monitoring System</h1>
              <nav className="flex gap-3 mt-3">
                <button className="px-4 py-2 rounded-full bg-blue-600 text-white font-semibold shadow-sm hover:brightness-110" onClick={() => setView('landing')}>Home</button>
                <button className="px-4 py-2 rounded-full bg-green-600 text-white font-semibold shadow-sm hover:brightness-110" onClick={() => setView('courses')}>Courses</button>
                {selectedCourse && <button className="px-4 py-2 rounded-full bg-purple-600 text-white font-semibold shadow-sm hover:brightness-110" onClick={() => setView('participants')}>Participants</button>}
                {selectedCourse && selectedParticipant && <button className="px-4 py-2 rounded-full bg-orange-500 text-white font-semibold shadow-sm hover:brightness-110" onClick={() => setView('observe')}>Monitoring</button>}
                {selectedCourse && <button className="px-4 py-2 rounded-full bg-rose-600 text-white font-semibold shadow-sm hover:brightness-110" onClick={() => setView('reports')}>Reports</button>}
              </nav>
            </div>
          </div>
        </header>

        {view === 'landing' && <Landing active={activeCourseType} onPick={(t) => { setActiveCourseType(t); setView('courses'); }} />}

        {view === 'courses' &&
          <CoursesView
            courses={courses /* already filtered by type */}
            onAdd={() => setView('courseForm')}
            onOpen={(id) => { setSelectedCourseId(id); setSelectedParticipantId(null); setView('participants'); }}
          />}

        {view === 'courseForm' &&
          <CourseForm
            courseType={activeCourseType}
            onCancel={() => setView('courses')}
            onSave={async (payload) => {
              const id = await upsertCourse({ id: undefined, course_type: activeCourseType, ...payload });
              const items = await listCoursesByType(activeCourseType);
              setCourses(items);
              setSelectedCourseId(id);
              setView('participants');
            }}
          />}

        {view === 'participants' && selectedCourse &&
          <ParticipantsView
            course={selectedCourse}
            participants={courseParticipants}
            onAdd={() => setView('participantForm')}
            onOpen={(pid) => { setSelectedParticipantId(pid); setView('observe'); }}
          />}

        {view === 'participantForm' && selectedCourse &&
          <ParticipantForm
            course={selectedCourse}
            onCancel={() => setView('participants')}
            onSave={async (p) => {
              await saveParticipant(p);
              const list = await fetchParticipants(selectedCourse.id);
              setParticipants(list);
              setSelectedParticipantId(p.id);
              setView('observe');
            }}
          />}

        {view === 'observe' && selectedCourse && selectedParticipant &&
          <ObservationView
            allCourses={courses}
            course={selectedCourse}
            participant={selectedParticipant}
            participants={courseParticipants}
            onChangeCourse={(id) => { setSelectedCourseId(id); setSelectedParticipantId(null); setView('participants'); }}
            onChangeParticipant={(id) => setSelectedParticipantId(id)}
          />}

        {view === 'reports' && selectedCourse &&
          <ReportsView course={selectedCourse} participants={participants.filter(p => p.courseId === selectedCourse.id)} />}
      </div>
    </div>
  );
}

// -------------------------------- Landing -----------------------------------
function Landing({ active, onPick }) {
  const items = [
    { key: 'IMNCI', title: 'Integrated Mgmt of Childhood & Newborn Illnesses (IMNCI)' },
    { key: 'ETAT', title: 'Emergency Triage, Assessment & Treatment (ETAT)' },
    { key: 'EENC', title: 'Early Essential Newborn Care (EENC)' },
    { key: 'IPC (Neonatal Unit)', title: 'Infection Prevention & Control (Neonatal Unit)' },
    { key: 'Small & Sick Newborn', title: 'Small & Sick Newborn Case Management' },
  ];

  // --- Temporary migration button state ---
  const [migrating, setMigrating] = React.useState(false);
  const [migrated, setMigrated] = React.useState(() => {
    try { return localStorage.getItem('imci_migration_done') === 'yes'; } catch { return false; }
  });
  const [msg, setMsg] = React.useState('');

  async function runMigration() {
    if (!window.confirm('This will copy local data to Firestore. Continue?')) return;
    if (!window.confirm('Are you absolutely sure? Run once only.')) return;

    setMigrating(true);
    setMsg('Migrating… please wait');
    try {
      const { migrateLocalToFirestore } = await import('./migrate'); // lazy import is fine
      const result = await migrateLocalToFirestore();
      const text =
        `Migrated successfully:
• Courses: ${result.courses}
• Participants: ${result.participants}
• Observations: ${result.observations}
• Cases: ${result.cases}`;
      try { localStorage.setItem('imci_migration_done', 'yes'); } catch {}
      setMigrated(true);
      setMsg(text);
      alert(text);
    } catch (e) {
      console.error(e);
      setMsg(`Migration failed: ${e?.message || e}`);
      alert(`Migration failed: ${e?.message || e}`);
    } finally {
      setMigrating(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-medium">Pick a course package</h2>

        {!migrated && (
          <button
            type="button"
            onClick={runMigration}
            disabled={migrating}
            className={`px-3 py-2 rounded-xl border ${migrating ? 'opacity-60 cursor-not-allowed' : ''}`}
            title="Copies your localStorage data to Firestore once"
          >
            {migrating ? 'Migrating…' : 'Migrate local data → Firestore'}
          </button>
        )}
      </div>

      {msg && <div className="text-sm text-gray-600 whitespace-pre-line">{msg}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(it => (
          <button
            key={it.key}
            className={`border rounded-2xl p-4 text-left hover:shadow transition ${active === it.key ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => onPick(it.key)}
          >
            <div className="flex items-center gap-3">
              <CourseIcon course={it.key} />
              <div>
                <div className="font-semibold">{it.title}</div>
                <div className="text-xs text-gray-500">Tap to manage</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
} // ← end of Landing (no extra curly after this!)

// -------------------------------- Courses -----------------------------------
function CoursesView({ courses, onAdd, onOpen }) {
  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">الدورات المتاحة</h2>
        <button className="px-3 py-2 rounded-xl border" onClick={onAdd}>إضافة دورة جديدة</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left border-b"><th className="py-2 pr-4">الولاية</th><th className="py-2 pr-4">المحلية</th><th className="py-2 pr-4">قاعة الدورة</th><th className="py-2 pr-4">المنسق</th><th className="py-2 pr-4">عدد المشاركين</th><th className="py-2 pr-4">الميسرين</th><th className="py-2 pr-4">الإجراءات</th></tr></thead>
          <tbody>
            {courses.length === 0 && (<tr><td colSpan={7} className="py-6 text-center text-gray-500">لا توجد دورات</td></tr>)}
            {courses.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4">{c.state}</td>
                <td className="py-2 pr-4">{c.locality}</td>
                <td className="py-2 pr-4">{c.hall}</td>
                <td className="py-2 pr-4">{c.coordinator}</td>
                <td className="py-2 pr-4">{c.participants_count}</td>
                <td className="py-2 pr-4">{Array.isArray(c.facilitators) ? c.facilitators.join("، ") : [c.facilitator1,c.facilitator2,c.facilitator3,c.facilitator4,c.facilitator5,c.facilitator6].filter(Boolean).join("، ")}</td>
                <td className="py-2 pr-4"><button className="px-3 py-1 rounded-lg border" onClick={() => onOpen(c.id)}>فتح</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CourseForm({ courseType, onCancel, onSave }) {
  const [state, setState] = useState('');
  const [locality, setLocality] = useState('');
  const [hall, setHall] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [participantsCount, setParticipantsCount] = useState(0);
  const [director, setDirector] = useState('');
  const [clinical, setClinical] = useState('');
  const [supporter, setSupporter] = useState('');
  const [facilitators, setFacilitators] = useState(['', '']); // min two
  const [error, setError] = useState('');

  const addFac = () => setFacilitators(f => [...f, '']);
  const removeFac = (i) => setFacilitators(f => f.length <= 2 ? f : f.filter((_, idx) => idx !== i));
  const setFac = (i, v) => setFacilitators(f => f.map((x, idx) => idx === i ? v : x));

  const submit = () => {
    const facArr = facilitators.map(s => s.trim()).filter(Boolean);
    if (!state || !locality || !hall || !coordinator || !participantsCount || !director || !clinical || facArr.length < 2 || !supporter) {
      setError('الرجاء إكمال جميع الحقول المطلوبة (الحد الأدنى لميسري الدورة: اثنان)');
      return;
    }
    const payload = {
      state, locality, hall, coordinator, participants_count: participantsCount,
      director, clinical_instructor: clinical, supporter,
      facilitators: facArr,
      // legacy for compatibility (first 6)
      facilitator1: facArr[0], facilitator2: facArr[1],
      facilitator3: facArr[2], facilitator4: facArr[3],
      facilitator5: facArr[4], facilitator6: facArr[5],
    };
    onSave(payload);
  };

  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <h2 className="text-lg font-medium">إضافة دورة جديدة — <span className="text-gray-600">{courseType}</span></h2>
      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
      <div className="grid md:grid-cols-3 gap-3">
        <FieldA label="الولاية"><select className="border rounded-lg p-2 w-full" value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— اختر الولاية —</option>{Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{s}</option>)}</select></FieldA>
        <FieldA label="المحلية"><select className="border rounded-lg p-2 w-full" value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— اختر المحلية —</option>{(STATE_LOCALITIES[state] || []).map(l => <option key={l} value={l}>{l}</option>)}</select></FieldA>
        <FieldA label="قاعة الدورة"><input className="border rounded-lg p-2 w-full" value={hall} onChange={(e) => setHall(e.target.value)} /></FieldA>
        <FieldA label="منسق الدورة"><input className="border rounded-lg p-2 w-full" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} /></FieldA>
        <FieldA label="عدد المشاركين"><input type="number" className="border rounded-lg p-2 w-full" value={participantsCount} onChange={(e) => setParticipantsCount(Number(e.target.value))} /></FieldA>
        <FieldA label="مدير الدورة"><input className="border rounded-lg p-2 w-full" value={director} onChange={(e) => setDirector(e.target.value)} /></FieldA>
        <FieldA label="الميسر السريري"><input className="border rounded-lg p-2 w-full" value={clinical} onChange={(e) => setClinical(e.target.value)} /></FieldA>
        <FieldA label="الداعم"><input className="border rounded-lg p-2 w-full" value={supporter} onChange={(e) => setSupporter(e.target.value)} /></FieldA>
        <FieldA label="الميسّرون">
          <div className="grid gap-2">
            {facilitators.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input className="border rounded-lg p-2 w-full" value={v} onChange={(e) => setFac(i, e.target.value)} placeholder={`الميسر رقم ${i + 1}`} />
                <button type="button" className="px-3 py-2 rounded-lg border" onClick={() => removeFac(i)} disabled={facilitators.length <= 2}>−</button>
              </div>
            ))}
            <button type="button" className="px-3 py-2 rounded-lg border" onClick={addFac}>+ إضافة ميسر</button>
          </div>
        </FieldA>
      </div>
      <div className="flex gap-2 justify-end"><button className="px-3 py-2 rounded-xl border" onClick={onCancel}>إلغاء</button><button className="px-3 py-2 rounded-xl bg-black text-white" onClick={submit}>حفظ الدورة</button></div>
    </section>
  );
}

// ----------------------------- Participants ---------------------------------
function ParticipantsView({ course, participants, onAdd, onOpen }) {
  const [groupFilter, setGroupFilter] = useState('All');
  const filtered = groupFilter === 'All' ? participants : participants.filter(p => p.group === groupFilter);
  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">المشاركون — {course.state} / {course.locality}</h2>
        <div className="flex items-center gap-2">
          <select className="border rounded-lg p-2" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="All">كل المجموعات</option><option value="Group A">Group A</option><option value="Group B">Group B</option><option value="Group C">Group C</option><option value="Group D">Group D</option>
          </select>
          <button className="px-3 py-2 rounded-xl border" onClick={onAdd}>إضافة مشارك</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left border-b"><th className="py-2 pr-4">الاسم</th><th className="py-2 pr-4">المجموعة</th><th className="py-2 pr-4">الولاية</th><th className="py-2 pr-4">المحلية</th><th className="py-2 pr-4">المركز</th><th className="py-2 pr-4">الهاتف</th><th className="py-2 pr-4">الإجراءات</th></tr></thead>
          <tbody>
            {filtered.length === 0 && (<tr><td colSpan={7} className="py-6 text-center text-gray-500">لا يوجد مشاركون</td></tr>)}
            {filtered.map(p => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4">{p.name}</td>
                <td className="py-2 pr-4">{p.group}</td>
                <td className="py-2 pr-4">{p.state}</td>
                <td className="py-2 pr-4">{p.locality}</td>
                <td className="py-2 pr-4">{p.center_name}</td>
                <td className="py-2 pr-4">{p.phone}</td>
                <td className="py-2 pr-4"><button className="px-3 py-1 rounded-lg border" onClick={() => onOpen(p.id)}>Monitoring</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ParticipantForm({ course, onCancel, onSave }) {
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [locality, setLocality] = useState('');
  const [center, setCenter] = useState('');
  const [job, setJob] = useState('');
  const [phone, setPhone] = useState('');
  const [trained, setTrained] = useState(false);
  const [lastTrain, setLastTrain] = useState('');
  const [numProv, setNumProv] = useState(0);
  const [numProvIMCI, setNumProvIMCI] = useState(0);
  const [hasNutri, setHasNutri] = useState(false);
  const [nearestNutri, setNearestNutri] = useState('');
  const [hasImm, setHasImm] = useState(false);
  const [nearestImm, setNearestImm] = useState('');
  const [hasORS, setHasORS] = useState(false);
  const [group, setGroup] = useState('Group A');
  const [error, setError] = useState('');

  const submit = () => {
    if (!name || !state || !locality || !center || !job || !phone) {
      setError('الرجاء إكمال جميع الحقول الإلزامية'); return;
    }
    const p = {
      id: uid(), courseId: course.id, name, state, locality,
      center_name: center, job_title: job, phone,
      trained_before: trained, last_imci_training: lastTrain || undefined,
      num_other_providers: numProv, num_other_providers_imci: numProvIMCI,
      has_nutrition_service: hasNutri,
      has_immunization_service: hasImm,
      has_ors_room: hasORS,
      nearest_nutrition_center: hasNutri ? undefined : (nearestNutri || undefined),
      nearest_immunization_center: hasImm ? undefined : (nearestImm || undefined),
      group
    };
    onSave(p);
  };

  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <h2 className="text-lg font-medium">إضافة مشارك للدورة</h2>
      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
      <div className="grid md:grid-cols-3 gap-3">
        <FieldA label="الاسم"><input className="border rounded-lg p-2 w-full" value={name} onChange={(e) => setName(e.target.value)} /></FieldA>
        <FieldA label="المجموعة"><select className="border rounded-lg p-2 w-full" value={group} onChange={(e) => setGroup(e.target.value)}><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></select></FieldA>
        <FieldA label="اسم الولاية"><select className="border rounded-lg p-2 w-full" value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— اختر الولاية —</option>{Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{s}</option>)}</select></FieldA>
        <FieldA label="اسم المحلية"><select className="border rounded-lg p-2 w-full" value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— اختر المحلية —</option>{(STATE_LOCALITIES[state] || []).map(l => <option key={l} value={l}>{l}</option>)}</select></FieldA>
        <FieldA label="اسم المركز"><input className="border rounded-lg p-2 w-full" value={center} onChange={(e) => setCenter(e.target.value)} /></FieldA>
        <FieldA label="الوصف الوظيفي"><input className="border rounded-lg p-2 w-full" value={job} onChange={(e) => setJob(e.target.value)} /></FieldA>
        <FieldA label="رقم الهاتف"><input className="border rounded-lg p-2 w-full" value={phone} onChange={(e) => setPhone(e.target.value)} /></FieldA>
        <FieldA label="هل تم تدريبك سابقا على العلاج المتكامل؟"><select className="border rounded-lg p-2 w-full" value={trained ? "yes" : "no"} onChange={(e) => setTrained(e.target.value === 'yes')}><option value="no">لا</option><option value="yes">نعم</option></select></FieldA>
        <FieldA label="اخر تدريب على العلاج المتكامل"><input type="date" className="border rounded-lg p-2 w-full" value={lastTrain} onChange={(e) => setLastTrain(e.target.value)} /></FieldA>

        <FieldA label="هل توجد خدمة تغذية علاجية؟">
          <select className="border rounded-lg p-2 w-full" value={hasNutri ? 'yes' : 'no'} onChange={e => setHasNutri(e.target.value === 'yes')}>
            <option value="no">لا</option><option value="yes">نعم</option>
          </select>
        </FieldA>
        {!hasNutri && (
          <FieldA label="إذا كانت الإجابة لا، ما هو أقرب مركز تغذية خارجية؟">
            <input className="border rounded-lg p-2 w-full" value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} />
          </FieldA>
        )}

        <FieldA label="هل توجد خدمة تحصين؟">
          <select className="border rounded-lg p-2 w-full" value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}>
            <option value="no">لا</option><option value="yes">نعم</option>
          </select>
        </FieldA>
        {!hasImm && (
          <FieldA label="إذا كانت الإجابة لا، ما هو أقرب مركز تحصين؟">
            <input className="border rounded-lg p-2 w-full" value={nearestImm} onChange={e => setNearestImm(e.target.value)} />
          </FieldA>
        )}

        <FieldA label="هل توجد خدمة ركن الإرواء؟">
          <select className="border rounded-lg p-2 w-full" value={hasORS ? 'yes' : 'no'} onChange={e => setHasORS(e.target.value === 'yes')}>
            <option value="no">لا</option><option value="yes">نعم</option>
          </select>
        </FieldA>

        <FieldA label="عدد الأطباء والمساعدين الذين يعملون في المركز الصحي">
          <input type="number" min="0" className="border rounded-lg p-2 w-full" value={numProv} onChange={(e) => setNumProv(Number(e.target.value || 0))} />
        </FieldA>
        <FieldA label="عدد الأطباء/المساعدين الطبيين الذين تم تدريبهم على العلاج المتكامل">
          <input type="number" min="0" className="border rounded-lg p-2 w-full" value={numProvIMCI} onChange={(e) => setNumProvIMCI(Number(e.target.value || 0))} />
        </FieldA>
      </div>
      <div className="flex gap-2 justify-end"><button className="px-3 py-2 rounded-xl border" onClick={onCancel}>إلغاء</button><button className="px-3 py-2 rounded-xl bg-black text-white" onClick={submit}>حفظ المشارك</button></div>
    </section>
  );
}

// ---------------------------- Monitoring (Observation) ----------------------
function ObservationView({ allCourses, course, participant, participants, onChangeCourse, onChangeParticipant }) {
  const [rows, setRows] = useState(restore(LS_OBS, []).filter(o => o.courseId === course.id && o.participant_id === participant.id));
  const [encounterDate, setEncounterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayOfCourse, setDayOfCourse] = useState(1);
  const [setting, setSetting] = useState("OPD");
  const [age, setAge] = useState("GE2M_LE5Y");
  const [caseSerial, setCaseSerial] = useState(1);
  const [caseAgeMonths, setCaseAgeMonths] = useState('');
  const [buffer, setBuffer] = useState({}); // key "domain|classification" -> 0/1

  useEffect(() => persist(LS_OBS, mergeObsForStorage(rows)), [rows]);

  useEffect(() => {
    const same = rows.filter(o => o.participant_id === participant.id && o.encounter_date === encounterDate && o.setting === setting && o.age_group === age);
    const maxS = same.reduce((m, x) => Math.max(m, x.case_serial || 0), 0);
    setCaseSerial(Math.max(1, maxS + 1));
  }, [rows, participant.id, encounterDate, setting, age]);

  const toggle = (d, cls, v) => {
    const k = `${d}|${cls}`;
    setBuffer(prev => (prev[k] === v ? (({ [k]: _, ...rest }) => rest)(prev) : { ...prev, [k]: v }));
  };

  const submitCase = async () => {
    const entries = Object.entries(buffer);
    if (entries.length === 0) { alert('No classifications selected.'); return; }
    const newObs = entries.map(([k, v]) => {
      const [d, cls] = k.split('|');
      return {
        id: uid(), encounter_date: encounterDate, day_of_course: dayOfCourse, setting,
        participant_code: participant.name, participant_id: participant.id, age_group: age,
        domain: d, classification_recorded: cls, classification_correct: v,
        case_serial: caseSerial, case_age_months: caseAgeMonths === '' ? undefined : Number(caseAgeMonths),
        courseId: course.id
      };
    });
    setRows(r => [...newObs, ...r]);

    // register case (for case summary)
    const reg = restore(LS_CASES, []);
    const allCorrect = entries.every(([, v]) => v === 1);
    reg.push({ courseId: course.id, participant_id: participant.id, encounter_date: encounterDate, setting, age_group: age, case_serial: caseSerial, day_of_course: dayOfCourse, allCorrect });
    persist(LS_CASES, reg);

    // NEW: persist to Firestore
    try {
      await saveObservations(newObs);
      await saveCase({ courseId: course.id, participant_id: participant.id, encounter_date: encounterDate, setting, age_group: age, case_serial: caseSerial, day_of_course: dayOfCourse, allCorrect });
    } catch (e) {
      console.error('Firestore write failed, data remains locally available:', e);
    }

    setBuffer({}); setCaseAgeMonths(''); setCaseSerial(caseSerial + 1);
  };

  return (
    <>
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Monitoring — {participant.name}</h2>
        <Toolbar>
          <Block label="Select participant">
            <select className="border rounded-lg p-2 w-full" value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)}>
              {participants.map(p => <option key={p.id} value={p.id}>{p.name} — {p.group}</option>)}
            </select>
          </Block>
          <Block label="Setting">
            <select className="border rounded-lg p-2 w-full" value={setting} onChange={(e) => setSetting(e.target.value)}>
              <option value="OPD">Out-patient</option><option value="IPD">In-patient</option>
            </select>
          </Block>
          <Block label="Age band">
            <select className="border rounded-lg p-2 w-full" value={age} onChange={(e) => setAge(e.target.value)}>
              <option value="GE2M_LE5Y">Sick child (2-59 months)</option>
              <option value="LT2M">Sick young infant (0-59 days)</option>
            </select>
          </Block>
        </Toolbar>
      </section>

      <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
        <div className="grid md:grid-cols-6 gap-3">
          <FieldA label="Encounter date"><input type="date" className="border rounded-lg p-2 w-full" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} /></FieldA>
          <FieldA label="Course day (1-7)"><select className="border rounded-lg p-2 w-full" value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</select></FieldA>
          <FieldA label="Case age (months)"><input type="number" className="border rounded-lg p-2 w-full" value={caseAgeMonths} onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0-59" /></FieldA>
        </div>
      </section>

      {/* Classification grid */}
      <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
        <h3 className="text-lg font-medium">Select classification and mark correctness</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4 w-64">Item</th>
                <th className="py-2 pr-4 w-40">Action</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {DOMAINS_BY_AGE[age].map(d => {
                const list = getClassList(age, d);
                const title = DOMAIN_LABEL[d] || d;
                return (
                  <React.Fragment key={d}>
                    <tr>
                      <th colSpan={3} className="text-left py-3 pr-4 text-base font-semibold">{title}</th>
                    </tr>
                    {(list && list.length ? list : ["(no items)"]).map((cls, i) => {
                      const k = `${d}|${cls}`;
                      const mark = buffer[k];
                      const rowClass = mark === 1 ? 'bg-green-50' : mark === 0 ? 'bg-pink-50' : '';
                      return (
                        <tr key={`${d}-${i}`} className={`border-b ${rowClass}`}>
                          <td className="py-2 pr-4">{cls}</td>
                          <td className="py-2 pr-4">
                            <div className="flex gap-2">
                              <button className={`px-3 py-1 rounded-lg border ${mark === 1 ? 'bg-green-200' : ''}`} onClick={() => toggle(d, cls, 1)}>Correct</button>
                              <button className={`px-3 py-1 rounded-lg border ${mark === 0 ? 'bg-pink-200' : ''}`} onClick={() => toggle(d, cls, 0)}>Incorrect</button>
                            </div>
                          </td>
                          <td className="py-2 pr-4"></td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white" onClick={submitCase}>Submit case</button>
          <button className="px-4 py-2 rounded-xl bg-slate-700 text-white" onClick={() => { setBuffer({}); setCaseAgeMonths(''); setCaseSerial(caseSerial + 1); }}>Start new case</button>
        </div>
      </section>

      {/* Submitted cases */}
      <SubmittedCases course={course} participant={participant} rows={rows} setRows={setRows} />
    </>
  );
}

function SubmittedCases({ course, participant, rows, setRows }) {
  const caseRows = useMemo(() => {
    const map = new Map();
    for (const o of rows) {
      if (o.participant_id !== participant.id) continue;
      const k = `${o.encounter_date}|${o.setting}|${o.age_group}|${o.case_serial}`;
      if (!map.has(k)) map.set(k, { date: o.encounter_date, setting: o.setting, age: o.age_group, serial: o.case_serial, day: o.day_of_course, total: 0, correct: 0 });
      const r = map.get(k);
      r.total++; if (o.classification_correct === 1) r.correct++;
    }
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1) || b.serial - a.serial);
  }, [rows, participant.id]);

  const editCase = (c) => {
    alert("Editing existing case: load selections in the grid above and resubmit (feature available in previous builds).");
  };
  const deleteCase = (c) => {
    if (!confirm('Delete this case?')) return;
    setRows(prev => prev.filter(o => !(o.participant_id === par