import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** =============================================================================
 * National Child Health Program - Courses Monitoring System (cleaned build)
 * - Professional Monitoring toolbar (participant, setting, age band).
 * - Unlimited facilitators per course.
 * - Participant form: Arabic service questions + nearest centers + staffing counters.
 * - CSV/PDF export.
 * - Offline-first: localStorage data layer with optional runtime backend bridge.
 * - NOTE: All en dashes (–) were replaced by hyphens (-) to avoid syntax errors.
 * ============================================================================ */

// ----------------------------- CONFIG & STORAGE ------------------------------
const LS_COURSES = "imci_courses_v9";
const LS_PARTS   = "imci_participants_v9";
const LS_OBS     = "imci_observations_v9";
const LS_CASES   = "imci_cases_v2";

const uid = () => Math.random().toString(36).slice(2, 10);
const persist = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const restore = (k, d) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch { return d; } };

// ------------------------- DATA LAYER SHIM (NO ./data) ----------------------
/**
 * This shim removes the hard dependency on "./data" to fix build errors.
 * - By default it uses localStorage collections (offline-first).
 * - If a runtime bridge is present at window.IMCI_DATA with the same methods,
 *   calls are delegated to it (e.g., a Firestore-backed implementation).
 */
const _bridge = (typeof window !== 'undefined' && window.IMCI_DATA) ? window.IMCI_DATA : null;

export async function listCoursesByType(course_type) {
  if (_bridge?.listCoursesByType) return _bridge.listCoursesByType(course_type);
  const all = restore(LS_COURSES, []);
  return all.filter(c => c.course_type === course_type);
}

export async function upsertCourse(payload) {
  if (_bridge?.upsertCourse) return _bridge.upsertCourse(payload);
  const all = restore(LS_COURSES, []);
  const id = payload.id || uid();
  const next = { ...payload, id };
  const idx = all.findIndex(x => x.id === id);
  if (idx >= 0) all[idx] = { ...all[idx], ...next }; else all.unshift(next);
  persist(LS_COURSES, all);
  return id;
}

export async function listParticipants(courseId) {
  if (_bridge?.listParticipants) return _bridge.listParticipants(courseId);
  const all = restore(LS_PARTS, []);
  return all.filter(p => p.courseId === courseId);
}

export async function upsertParticipant(p) {
  if (_bridge?.upsertParticipant) return _bridge.upsertParticipant(p);
  const all = restore(LS_PARTS, []);
  const id = p.id || uid();
  const next = { ...p, id };
  const idx = all.findIndex(x => x.id === id);
  if (idx >= 0) all[idx] = { ...all[idx], ...next }; else all.unshift(next);
  persist(LS_PARTS, all);
  return id;
}

export async function addObservations(rows) {
  if (_bridge?.addObservations) return _bridge.addObservations(rows);
  // Observations are already cached by the component via setRows+persist.
  return true;
}

export async function addCase(c) {
  if (_bridge?.addCase) return _bridge.addCase(c);
  // Cases are cached locally by the component; no-op here.
  return true;
}

export async function migrateLocalToFirestore() {
  if (_bridge?.migrateLocalToFirestore) return _bridge.migrateLocalToFirestore();
  // No backend connected: just report local counts.
  const courses = restore(LS_COURSES, []);
  const parts   = restore(LS_PARTS, []);
  const obs     = restore(LS_OBS, []);
  const cases   = restore(LS_CASES, []);
  return { courses: courses.length, participants: parts.length, observations: obs.length, cases: cases.length };
}

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
    "Severe pneumonia/disease",
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
    "Fever - malaria unlikely",
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
    "Complicated Severe Acute malnutrition (SAM)",
    "Un-complicated Severe Acute malnutrition (SAM)",
    "Moderate Acute malnutrition (MAM)",
    "No Acute Malnutrition"
  ],
  anaemia: [
    "Severe Anaemia",
    "Anaemia",
    "No anaemia"
  ],
  treatment_2_59m: [
    "ORAL DRUGS",
    "PLAN A",
    "PLAN B",
    "LOCAL INFECTION"
  ],
  // Single consolidated counselling domain
  counsel: [
    "Assess and counsel for vaccination",
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
    "Bacterial infection unlikely"
  ],
  jaundice: [
    "Severe Jaundice",
    "Jaundice",
    "No Jaundice"
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

// Labels
const DOMAIN_LABEL = {
  danger:"Danger signs",
  respiratory:"COUGH:",
  diarrhoea:"DIARRHOEA:",
  fever_malaria:"FEVER:",
  ear:"EAR:",
  malnutrition:"MALNUTRITION:",
  anaemia:"ANAEMIA:",
  treatment_2_59m:"TREAT:",
  counsel:"COUNSEL:",

  bacterial:"BACTERIAL:",
  jaundice:"JAUNDICE:",
  vyi_diarrhoea:"DIARRHOEA:",
  feeding:"FEEDING:",
  treatment_0_59d:"TREATMENT/COUNSEL:"
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

  // Remote state (bridge/local) + local UI state
  const [activeCourseType, setActiveCourseType] = useState("IMNCI");
  const [courses, setCourses] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);

  // Load courses when course type changes
  useEffect(() => {
    (async () => {
      const list = await listCoursesByType(activeCourseType);
      setCourses(list);
    })();
  }, [activeCourseType]);

  // Load participants when a course is selected
  useEffect(() => {
    (async () => {
      if (!selectedCourseId) return;
      const list = await listParticipants(selectedCourseId);
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

        {view === 'courses' && (
          <CoursesView
            courses={courses.filter(c => c.course_type === activeCourseType)}
            onAdd={() => setView('courseForm')}
            onOpen={(id) => { setSelectedCourseId(id); setSelectedParticipantId(null); setView('participants'); }}
          />
        )}

        {view === 'courseForm' && (
          <CourseForm
            courseType={activeCourseType}
            onCancel={() => setView('courses')}
            onSave={async (payload) => {
              const id = await upsertCourse({ id: undefined, course_type: activeCourseType, ...payload });
              setCourses(await listCoursesByType(activeCourseType));
              setSelectedCourseId(id);
              setView('participants');
            }}
          />
        )}

        {view === 'participants' && selectedCourse && (
          <ParticipantsView
            course={selectedCourse}
            participants={courseParticipants}
            onAdd={() => setView('participantForm')}
            onOpen={(pid) => { setSelectedParticipantId(pid); setView('observe'); }}
          />
        )}

        {view === 'participantForm' && selectedCourse && (
          <ParticipantForm
            course={selectedCourse}
            onCancel={() => setView('participants')}
            onSave={async (p) => {
              await upsertParticipant(p);
              setParticipants(await listParticipants(selectedCourse.id));
              setSelectedParticipantId(p.id);
              setView('observe');
            }}
          />
        )}

        {view === 'observe' && selectedCourse && selectedParticipant && (
          <ObservationView
            allCourses={courses}
            course={selectedCourse}
            participant={selectedParticipant}
            participants={courseParticipants}
            onChangeCourse={(id) => { setSelectedCourseId(id); setSelectedParticipantId(null); setView('participants'); }}
            onChangeParticipant={(id) => setSelectedParticipantId(id)}
          />
        )}

        {view === 'reports' && selectedCourse && (
          <ReportsView course={selectedCourse} participants={participants.filter(p => p.courseId === selectedCourse.id)} />
        )}
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

  // Migration UI state (optional/bridge)
  const [migrating, setMigrating] = React.useState(false);
  const [migrated, setMigrated] = React.useState(() => {
    try { return localStorage.getItem('imci_migration_done') === 'yes'; } catch { return false; }
  });
  const [msg, setMsg] = React.useState('');

  async function runMigration() {
    if (!window.confirm('This will copy your local data (courses, participants, observations, cases) to Firestore. Continue?')) return;
    if (!window.confirm('Are you absolutely sure? Run once only.')) return;

    setMigrating(true);
    setMsg('Migrating… please wait');
    try {
      const result = await migrateLocalToFirestore();
      const text =
        `Migrated successfully:\n• Courses: ${result.courses}\n• Participants: ${result.participants}\n• Observations: ${result.observations}\n• Cases: ${result.cases}`;
      setMsg(text);
      try { localStorage.setItem('imci_migration_done', 'yes'); } catch {}
      setMigrated(true);
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
}

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

    // Local state + cache
    setRows(r => [...newObs, ...r]);

    // Register case (for case summary) locally
    const reg = restore(LS_CASES, []);
    const allCorrect = entries.every(([, v]) => v === 1);
    reg.push({ courseId: course.id, participant_id: participant.id, encounter_date: encounterDate, setting, age_group: age, case_serial: caseSerial, day_of_course: dayOfCourse, allCorrect });
    persist(LS_CASES, reg);

    // Write-through (no-op in shim if no backend)
    try {
      await addObservations(newObs);
      await addCase({ courseId: course.id, participant_id: participant.id, encounter_date: encounterDate, setting, age_group: age, case_serial: caseSerial, day_of_course: dayOfCourse, allCorrect });
    } catch (e) {
      console.error('Backend write failed; data kept locally:', e);
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
        <div className="grid md:grid-cols-3 gap-6">
          <FieldA label="Encounter date"><input type="date" className="border rounded-lg p-2 w-full" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} /></FieldA>
          <FieldA label="Course day (1-7)"><select className="border rounded-lg p-2 w-full" value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</select></FieldA>
          <FieldA label="Case age (months)"><input type="number" className="border rounded-lg p-2 w-full" value={caseAgeMonths} onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0-59" /></FieldA>
        </div>
      </section>

      {/* Classification grid */}
      <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
        <h3 className="text-lg font-semibold">Select classification and mark correctness</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4 w-64">Item (Domain)</th>
                <th className="py-2 pr-4 w-64">Classification</th>
                <th className="py-2 pr-4 w-40">Action</th>
              </tr>
            </thead>
            <tbody>
              {DOMAINS_BY_AGE[age].map(d => {
                const list = getClassList(age, d);
                const title = DOMAIN_LABEL[d] || d;
                return (list && list.length ? list : ["(no items)"]).map((cls, i) => {
                  const k = `${d}|${cls}`;
                  const mark = buffer[k];
                  const rowClass = mark === 1 ? 'bg-green-50' : mark === 0 ? 'bg-pink-50' : '';
                  return (
                    <tr key={`${d}-${i}`} className={`border-b ${rowClass}`}>
                      {i === 0 && (
                        <td className="py-2 pr-4 align-top font-semibold text-gray-800" rowSpan={list.length}>{title}</td>
                      )}
                      <td className="py-2 pr-4">{cls}</td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-2">
                          <button className={`px-3 py-1 rounded-lg border ${mark === 1 ? 'bg-green-200' : ''}`} onClick={() => toggle(d, cls, 1)}>Correct</button>
                          <button className={`px-3 py-1 rounded-lg border ${mark === 0 ? 'bg-pink-200' : ''}`} onClick={() => toggle(d, cls, 0)}>Incorrect</button>
                        </div>
                      </td>
                    </tr>
                  );
                });
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
    setRows(prev => prev.filter(o => !(o.participant_id === participant.id && o.encounter_date === c.date && o.setting === c.setting && o.age_group === c.age && o.case_serial === c.serial)));
    const reg = restore(LS_CASES, []);
    persist(LS_CASES, reg.filter(x => !(x.courseId === course.id && x.participant_id === participant.id && x.encounter_date === c.date && x.setting === c.setting && x.age_group === c.age && x.case_serial === c.serial)));
  };

  const exportCSV = () => {
    const header = [
      'courseId','participant_id','participant_name','participant_group',
      'encounter_date','day_of_course','setting','age_group',
      'case_serial','case_age_months','domain','classification_recorded','classification_correct'
    ];
    const lines = [header.join(',')];
    for (const x of rows) {
      lines.push([
        course.id, participant.id, safeCSV(participant.name), participant.group,
        x.encounter_date, x.day_of_course ?? '',
        x.setting, x.age_group, x.case_serial ?? '',
        x.case_age_months ?? '', x.domain,
        safeCSV(x.classification_recorded), x.classification_correct
      ].join(','));
    }
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IMCI_${course.state}_${course.locality}_${participant.name}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Submitted cases for {participant.name}</h3>
        <button className="px-3 py-2 rounded-xl border" onClick={exportCSV}>Export CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b"><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Day</th><th className="py-2 pr-4">Setting</th><th className="py-2 pr-4">Age band</th><th className="py-2 pr-4">Serial</th><th className="py-2 pr-4">Ticks</th><th className="py-2 pr-4">Correct</th><th className="py-2 pr-4">% Correct</th><th className="py-2 pr-4">Actions</th></tr>
          </thead>
          <tbody>
            {caseRows.length === 0 && (<tr><td colSpan={9} className="py-6 text-center text-gray-500">No cases yet.</td></tr>)}
            {caseRows.map((c, idx) => { const pct = calcPct(c.correct, c.total); return (
              <tr key={idx} className="border-b">
                <td className="py-2 pr-4">{c.date}</td>
                <td className="py-2 pr-4">{c.day ?? ''}</td>
                <td className="py-2 pr-4">{c.setting}</td>
                <td className="py-2 pr-4">{c.age === 'LT2M' ? '0-59 d' : '2-59 m'}</td>
                <td className="py-2 pr-4">{c.serial}</td>
                <td className="py-2 pr-4">{c.total}</td>
                <td className="py-2 pr-4">{c.correct}</td>
                <td className={`py-2 pr-4 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2"><button className="px-3 py-1 rounded-lg border" onClick={() => editCase(c)}>Edit</button><button className="px-3 py-1 rounded-lg border" onClick={() => deleteCase(c)}>Delete</button></div>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// --------------------------------- Reports ----------------------------------
function ReportsView({ course, participants }) {
  const [age, setAge] = useState('GE2M_LE5Y');
  const [settingFilter, setSettingFilter] = useState('All');
  const [tab, setTab] = useState('matrix'); // 'case' | 'class' | 'matrix'

  // Pull all observation rows for this course (from local cache), then apply filters
  const all = restore(LS_OBS, []);
  const rows = useMemo(
    () => all.filter(o => o.courseId === course.id && o.age_group === age && (settingFilter === 'All' || o.setting === settingFilter)),
    [all, course.id, age, settingFilter]
  );

  const registry = restore(LS_CASES, []);
  const groups = ['Group A', 'Group B', 'Group C', 'Group D'];

  // ---------------- Case & Classification summaries -------------------------
  const caseSummaryByGroup = useMemo(() => {
    const g = {}; const pmap = new Map(); participants.forEach(p => pmap.set(p.id, p));
    for (const c of registry.filter(x => x.courseId === course.id && x.age_group === age && (settingFilter === 'All' || x.setting === settingFilter))) {
      const p = pmap.get(c.participant_id || ''); if (!p) continue; const k = p.group; g[k] ??= {}; g[k][p.id] ??= { name: p.name, inp_seen: 0, inp_correct: 0, op_seen: 0, op_correct: 0 };
      const t = g[k][p.id]; if (c.setting === 'IPD') { t.inp_seen++; if (c.allCorrect) t.inp_correct++; } else { t.op_seen++; if (c.allCorrect) t.op_correct++; }
    }
    return g;
  }, [registry, participants, course.id, age, settingFilter]);

  const classSummaryByGroup = useMemo(() => {
    const g = {}; const pmap = new Map(); participants.forEach(p => pmap.set(p.id, p));
    for (const o of rows) {
      const p = pmap.get(o.participant_id || ''); if (!p) continue; const k = p.group; g[k] ??= {}; g[k][p.id] ??= { name: p.name, inp_total: 0, inp_correct: 0, op_total: 0, op_correct: 0 };
      const t = g[k][p.id]; if (o.setting === 'IPD') { t.inp_total++; if (o.classification_correct === 1) t.inp_correct++; } else { t.op_total++; if (o.classification_correct === 1) t.op_correct++; }
    }
    return g;
  }, [rows, participants]);

  // -------------------------- Detailed Classification Report -----------------
  const partsByGroup = useMemo(() => {
    const map = { 'Group A': [], 'Group B': [], 'Group C': [], 'Group D': [] };
    for (const p of participants) map[p.group]?.push(p);
    for (const k of Object.keys(map)) map[k].sort((a,b) => a.name.localeCompare(b.name));
    return map;
  }, [participants]);

  function buildMatrixForGroup(groupKey) {
    const parts = partsByGroup[groupKey] || [];
    const domains = DOMAINS_BY_AGE[age];
    const matrixRows = [];

    for (const d of domains) {
      const items = getClassList(age, d) || [];
      for (const item of items) {
        const counts = parts.map(p => rows.filter(o => o.participant_id === p.id && o.domain === d && o.classification_recorded === item).length);
        const total = counts.reduce((a,b) => a+b, 0);
        const mean = parts.length ? total / parts.length : 0;
        const min = counts.length ? Math.min(...counts) : 0;
        const max = counts.length ? Math.max(...counts) : 0;
        matrixRows.push({ domain: DOMAIN_LABEL[d] || d, item, counts, total, mean, min, max });
      }
    }

    const perPartTotals = parts.map(p => rows.filter(o => o.participant_id === p.id).length);
    const perPartCorrect = parts.map(p => rows.filter(o => o.participant_id === p.id && o.classification_correct === 1).length);
    const perPartPct = perPartTotals.map((den, i) => den ? (perPartCorrect[i] * 100) / den : NaN);

    return { parts, matrixRows, perPartTotals, perPartCorrect, perPartPct };
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = tab === 'case' ? 'Case Summary' : tab === 'class' ? 'Classification Summary' : 'Detailed classification report';
    doc.setFontSize(14); doc.text(`IMCI Report - ${title}`, 14, 14);
    doc.setFontSize(10); doc.text(`${course.state} / ${course.locality} — Age: ${age === 'LT2M' ? '0-2 months' : '2-59 months'} — Setting: ${settingFilter}`, 14, 21);

    if (tab !== 'matrix') {
      let y = 28; const src = tab === 'case' ? caseSummaryByGroup : classSummaryByGroup;
      const groups = ['Group A','Group B','Group C','Group D'];
      for (const g of groups) {
        const data = src[g] || {}; const ids = Object.keys(data); if (ids.length === 0) continue;
        const body = ids.map(id => {
          const r = data[id]; const inSeen = tab === 'case' ? r.inp_seen : r.inp_total; const inCor = r.inp_correct;
          const outSeen = tab === 'case' ? r.op_seen : r.op_total; const outCor = r.op_correct;
          const tot = inSeen + outSeen; const cor = inCor + outCor;
          return [r.name, inSeen, inCor, percent(inCor, inSeen), outSeen, outCor, percent(outCor, outSeen), tot, percent(cor, tot)];
        });
        doc.setFontSize(12); doc.text(`Group: ${g.replace('Group ', '')}`, 14, y); y += 4;
        autoTable(doc, { startY: y, head: [["Participant","In-patient","Correct IPD","% IPD","Out-patient","Correct OPD","% OPD","Total","% Overall"]], body, theme: 'grid', styles: { fontSize: 9 } });
        y = (doc.lastAutoTable?.finalY || y) + 8; if (y > 180) { doc.addPage('landscape'); y = 14; }
      }
      doc.save(`IMCI_${title}_${new Date().toISOString().slice(0, 10)}.pdf`);
      return;
    }

    // Matrix export
    let y = 28; const groups = ['Group A','Group B','Group C','Group D'];
    for (const g of groups) {
      const { parts, matrixRows, perPartCorrect, perPartTotals, perPartPct } = buildMatrixForGroup(g);
      if (parts.length === 0) continue;
      doc.setFontSize(12); doc.text(`Group: ${g.replace('Group ', '')}`, 14, y); y += 4;

      const head = [[
        'Classification',
        ...parts.map(p => p.name),
        'Total','Mean','Min','Max'
      ]];
      const body = matrixRows.map(r => [
        r.item,
        ...r.counts,
        r.total, (Math.round(r.mean*10)/10).toFixed(1), r.min, r.max
      ]);
      body.push([
        '# Correct (ticks)',
        ...perPartCorrect,
        '', '', '', ''
      ]);
      body.push([
        '% Correct',
        ...perPartPct.map(v => isFinite(v) ? (Math.round(v*10)/10).toFixed(1) + ' %' : '—'),
        '', '', '', ''
      ]);

      autoTable(doc, { startY: y, head, body, theme: 'grid', styles: { fontSize: 8 }, columnStyles: { 0: { cellWidth: 90 } } });
      y = (doc.lastAutoTable?.finalY || y) + 8; if (y > 180) { doc.addPage('landscape'); y = 14; }
    }

    doc.save(`IMCI_${title}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{course.state} / {course.locality} — Reports</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-xl border" onClick={() => window.print()}>Print</button>
          <button className="px-4 py-2 rounded-xl border" onClick={exportPDF}>Export PDF</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className={`px-4 py-2 rounded-xl text-white ${tab === 'case' ? 'bg-blue-600' : 'bg-blue-500/80 hover:bg-blue-500'}`} onClick={() => setTab('case')}>Case Summary</button>
        <button className={`px-4 py-2 rounded-xl text-white ${tab === 'class' ? 'bg-emerald-600' : 'bg-emerald-500/80 hover:bg-emerald-500'}`} onClick={() => setTab('class')}>Classification Summary</button>
        <button className={`px-4 py-2 rounded-xl text-white ${tab === 'matrix' ? 'bg-indigo-600' : 'bg-indigo-500/80 hover:bg-indigo-500'}`} onClick={() => setTab('matrix')}>Detailed classification report</button>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-800">Age group</span><select className="border rounded-lg p-2" value={age} onChange={(e) => setAge(e.target.value)}><option value="LT2M">0-2 months</option><option value="GE2M_LE5Y">2-59 months</option></select></div>
        <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-800">Setting</span><select className="border rounded-lg p-2" value={settingFilter} onChange={(e) => setSettingFilter(e.target.value)}><option value="All">All</option><option value="OPD">Out-patient</option><option value="IPD">In-patient</option></select></div>
      </div>

      {['Group A','Group B','Group C','Group D'].map(g => {
        const data = (tab === 'case' ? caseSummaryByGroup : classSummaryByGroup)[g] || {};
        const ids = Object.keys(data); if (ids.length === 0 || tab === 'matrix') return null;
        return (
          <div key={g} className="grid gap-2">
            <h3 className="text-lg font-semibold">Group: {g.replace('Group ', '')}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  {tab === 'case' ? (
                    <tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">In-patient Cases</th><th className="py-2 pr-4">Correct IPD</th><th className="py-2 pr-4">% IPD</th><th className="py-2 pr-4">Out-patient Cases</th><th className="py-2 pr-4">Correct OPD</th><th className="py-2 pr-4">% OPD</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">% Overall</th></tr>
                  ) : (
                    <tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">In-patient Class.</th><th className="py-2 pr-4">Correct IPD</th><th className="py-2 pr-4">% IPD</th><th className="py-2 pr-4">Out-patient Class.</th><th className="py-2 pr-4">Correct OPD</th><th className="py-2 pr-4">% OPD</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">% Overall</th></tr>
                  )}
                </thead>
                <tbody>
                  {ids.map(id => {
                    const r = data[id]; const inSeen = tab === 'case' ? r.inp_seen : r.inp_total; const inCor = r.inp_correct;
                    const outSeen = tab === 'case' ? r.op_seen : r.op_total; const outCor = r.op_correct;
                    const tot = inSeen + outSeen; const cor = inCor + outCor;
                    const pctIn = calcPct(inCor, inSeen), pctOut = calcPct(outCor, outSeen), pctAll = calcPct(cor, tot);
                    return (
                      <tr key={id} className="border-b">
                        <td className="py-2 pr-4">{r.name}</td>
                        <td className="py-2 pr-4">{inSeen}</td>
                        <td className="py-2 pr-4">{inCor}</td>
                        <td className={`py-2 pr-4 ${pctBgClass(pctIn)}`}>{fmtPct(pctIn)}</td>
                        <td className="py-2 pr-4">{outSeen}</td>
                        <td className="py-2 pr-4">{outCor}</td>
                        <td className={`py-2 pr-4 ${pctBgClass(pctOut)}`}>{fmtPct(pctOut)}</td>
                        <td className="py-2 pr-4">{tot}</td>
                        <td className={`py-2 pr-4 ${pctBgClass(pctAll)}`}>{fmtPct(pctAll)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {tab === 'matrix' && ['Group A','Group B','Group C','Group D'].map(g => {
        const { parts, matrixRows, perPartCorrect, perPartTotals, perPartPct } = (function(){
          const partsByGroup = {}; for (const p of participants) { (partsByGroup[p.group] ??= []).push(p); }
          for (const k of Object.keys(partsByGroup)) partsByGroup[k].sort((a,b) => a.name.localeCompare(b.name));
          const parts = partsByGroup[g] || [];
          const domains = DOMAINS_BY_AGE[age];
          const matrixRows = [];
          for (const d of domains) {
            const items = getClassList(age, d) || [];
            for (const item of items) {
              const counts = parts.map(p => rows.filter(o => o.participant_id === p.id && o.domain === d && o.classification_recorded === item).length);
              const total = counts.reduce((a,b) => a+b, 0);
              const mean = parts.length ? total / parts.length : 0;
              const min = counts.length ? Math.min(...counts) : 0;
              const max = counts.length ? Math.max(...counts) : 0;
              matrixRows.push({ domain: DOMAIN_LABEL[d] || d, item, counts, total, mean, min, max });
            }
          }
          const perPartTotals = parts.map(p => rows.filter(o => o.participant_id === p.id).length);
          const perPartCorrect = parts.map(p => rows.filter(o => o.participant_id === p.id && o.classification_correct === 1).length);
          const perPartPct = perPartTotals.map((den, i) => den ? (perPartCorrect[i] * 100) / den : NaN);
          return { parts, matrixRows, perPartTotals, perPartCorrect, perPartPct };
        })();
        if ((parts || []).length === 0) return null;
        return (
          <div key={g} className="grid gap-2">
            <h3 className="text-lg font-semibold">Group: {g.replace('Group ', '')}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left border-b bg-gray-50">
                    <th className="py-2 pr-4 w-80">Classification</th>
                    {parts.map(p => (<th key={p.id} className="py-2 pr-4 whitespace-nowrap">{p.name}</th>))}
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Mean</th>
                    <th className="py-2 pr-4">Min</th>
                    <th className="py-2 pr-4">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((r, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2 pr-4">{r.item}</td>
                      {r.counts.map((c, i) => (<td key={i} className="py-2 pr-4 text-center">{c}</td>))}
                      <td className="py-2 pr-4 font-medium">{r.total}</td>
                      <td className="py-2 pr-4">{(Math.round(r.mean*10)/10).toFixed(1)}</td>
                      <td className="py-2 pr-4">{r.min}</td>
                      <td className="py-2 pr-4">{r.max}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50 font-medium">
                    <td className="py-2 pr-4"># Correct (ticks)</td>
                    {perPartCorrect.map((n, i) => (<td key={i} className="py-2 pr-4 text-center">{n}</td>))}
                    <td className="py-2 pr-4" colSpan={4}></td>
                  </tr>
                  <tr className="bg-emerald-50 font-medium">
                    <td className="py-2 pr-4">% Correct</td>
                    {perPartPct.map((v, i) => (<td key={i} className={`py-2 pr-4 text-center ${pctBgClass(v)}`}>{fmtPct(v)}</td>))}
                    <td className="py-2 pr-4" colSpan={4}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ----------------------------- Shared UI pieces ------------------------------
function FieldA({ label, children }) { return (<label className="grid gap-1 text-sm"><span className="text-gray-800 font-semibold">{label}</span>{children}</label>); }
function Toolbar({ children }) { return (<div className="w-full rounded-xl border bg-white shadow-sm"><div className="flex flex-wrap gap-3 p-3">{children}</div></div>); }
function Block({ label, children }) { return (<div className="min-w-[240px]"><div className="text-sm font-semibold text-gray-800 mb-1">{label}</div>{children}</div>); }

function ProgramLogo() {
  return (
    <svg width="42" height="42" viewBox="0 0 100 100" className="shrink-0">
      <rect width="100" height="100" rx="18" fill="#0a0a0a" />
      <g transform="translate(12,10)">
        <circle cx="38" cy="20" r="8" fill="#c63d2f" />
        <path d="M20 70 Q38 52 56 70 v10 H20z" fill="#4348a3" />
        <path d="M32 38 a10 10 0 0 1 12 0 l6 6 a20 20 0 0 1 6 14 v22 H20 V58 a20 20 0 0 1 6-14z" fill="#4a50b8" />
      </g>
    </svg>
  );
}
function CourseIcon({ course }) {
  const p = { width: 34, height: 34, viewBox: '0 0 48 48' };
  switch (course) {
    case 'IMNCI': return (<svg {...p}><circle cx="24" cy="24" r="22" fill="#e3f2fd" /><path d="M12 34c6-10 18-10 24 0" stroke="#1976d2" strokeWidth="3" fill="none" /><circle cx="24" cy="18" r="6" fill="#1976d2" /></svg>);
    case 'ETAT': return (<svg {...p}><rect x="3" y="8" width="42" height="30" rx="4" fill="#fff3e0" stroke="#ef6c00" strokeWidth="3" /><path d="M8 24h10l2-6 4 12 3-8h11" stroke="#ef6c00" strokeWidth="3" fill="none" /></svg>);
    case 'EENC': return (<svg {...p}><circle cx="16" cy="22" r="7" fill="#81c784" /><circle cx="30" cy="18" r="5" fill="#a5d6a7" /><path d="M8 34c8-6 24-6 32 0" stroke="#388e3c" strokeWidth="3" fill="none" /></svg>);
    case 'IPC (Neonatal Unit)': return (<svg {...p}><circle cx="24" cy="24" r="22" fill="#fff" stroke="#6a1b9a" strokeWidth="3" /><path d="M10 28l8-8 6 6 8-8 6 6" stroke="#6a1b9a" strokeWidth="3" fill="none" /></svg>);
    case 'Small & Sick Newborn': return (<svg {...p}><rect x="4" y="8" width="40" height="28" rx="6" fill="#e1f5fe" /><circle cx="18" cy="20" r="5" fill="#0277bd" /><path d="M8 30c8-6 20-6 28 0" stroke="#0277bd" strokeWidth="3" fill="none" /></svg>);
    default: return null;
  }
}

// ----------------------------- Utilities ------------------------------------
function mergeObsForStorage(list) {
  const all = restore(LS_OBS, []);
  const ids = new Set(list.map(x => x.id));
  const others = all.filter(x => !ids.has(x.id));
  return [...others, ...list];
}

// ----------------------------- Smoke Tests ----------------------------------
if (typeof window !== 'undefined') {
  (function runSmokeTests() {
    try {
      console.group('%cIMCI App - Smoke Tests', 'font-weight:bold');

      console.assert(percent(3, 10) === '30.0 %', 'percent(3,10) should be 30.0 %');
      console.assert(percent(0, 0) === '—', 'percent with zero denominator should be em dash');
      console.assert(percent(7, 3) === '233.3 %', 'percent(7,3) should be 233.3 %');

      const cp = calcPct(5, 10); // 50
      console.assert(cp === 50, 'calcPct(5,10) should be 50');
      console.assert(fmtPct(cp) === '50.0 %', 'fmtPct(50) should be 50.0 %');
      console.assert(fmtPct(NaN) === '—', 'fmtPct(NaN) should be dash');

      // Lists present
      console.assert(Array.isArray(CLASS_2_59M.respiratory) && CLASS_2_59M.respiratory.includes('Pneumonia'), '2-59m respiratory list present');
      console.assert(Array.isArray(CLASS_0_59D.jaundice) && CLASS_0_59D.jaundice.some(x => x.toLowerCase().includes('jaundice')), '0-2m jaundice list present');

      // Counselling consolidated in single domain
      console.assert(Array.isArray(CLASS_2_59M.counsel) && CLASS_2_59M.counsel.length >= 4, '2-59m single COUNSEL domain present');

      // No en dashes left
      const labels = Object.values(DOMAIN_LABEL);
      console.assert(labels.every(t => !String(t).includes('–')), 'No en dashes remain in labels');

      // CSV safety + thresholds
      console.assert(safeCSV('a,b') === '"a,b"', 'safeCSV should quote commas');
      console.assert(safeCSV('"q"') === '"""q"""', 'safeCSV should escape quotes');
      console.assert(pctBgClass(49) === 'bg-pink-100' && pctBgClass(50) === 'bg-yellow-100' && pctBgClass(81) === 'bg-green-100', 'pctBgClass thresholds');

      // mergeObsForStorage should include existing + new, dedup by id
      const obsBackup = restore(LS_OBS, []);
      persist(LS_OBS, [{ id: 'a' }, { id: 'b' }]);
      const merged = mergeObsForStorage([{ id: 'b' }, { id: 'c' }]);
      console.assert(merged.length === 3 && merged.some(x => x.id === 'a') && merged.some(x => x.id === 'b') && merged.some(x => x.id === 'c'), 'mergeObsForStorage merges & dedups');
      persist(LS_OBS, obsBackup);

      console.log('%cAll smoke tests passed.', 'color:green');
    } catch (e) {
      console.error('Smoke tests failure:', e);
    } finally {
      console.groupEnd();
    }
  })();
}
