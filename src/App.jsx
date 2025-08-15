import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// +++ NEW: Import all data functions from your new data.js file +++
import {
    listCoursesByType,
    upsertCourse,
    deleteCourse,
    listParticipants,
    upsertParticipant,
    deleteParticipant,
    listObservationsForParticipant,
    listCasesForParticipant,
    upsertCaseAndObservations,
    deleteCaseAndObservations,
    listAllDataForCourse
} from './data.js';

/** =============================================================================
 * National Child Health Program - Courses Monitoring System (Firebase Version)
 * - This version is fully connected to a Firebase/Firestore backend.
 * - All data operations (CRUD) are handled by the functions imported from data.js.
 * - The original localStorage "shim" has been completely removed.
 * ============================================================================ */

// ----------------------------- CONFIG (UNCHANGED) ------------------------------
// --- REMOVED: The localStorage constants (LS_COURSES, etc.) and functions (persist, restore) ---

const uid = () => Math.random().toString(36).slice(2, 10);

// ----------------------------- CONSTANTS (UNCHANGED) ------------------------------
// All your constants like STATE_LOCALITIES, SKILLS_EENC, etc., remain here.

const STATE_LOCALITIES = {
    "Blue Nile": ["Ad-Damazin", "Ar-Roseires", "Geissan", "Baw", "Tadamon"],
    "Central Darfur": ["Zalingei", "Azum", "Wadi Salih", "Mukjar", "Bindisi", "Um Dukhun", "Nertiti", "Rokero"],
    "East Darfur": ["Ed Daein", "Abu Jabra", "Bahr el-Arab", "Asalaya", "Yassin", "Fardous", "Abu Karinka"],
    "Gedaref": ["Gedaref", "Basundah", "Qala al-Nahl", "Al-Fashaga", "Al-Rahd", "Al-Hawatah"],
    "Gezira": ["Um Al-Qura", "Al-Hasahisa", "Al-Managil", "Al-Kamilin", "Wad Madani", "South Al Gezira", "East Al Gezira"],
    "Kassala": ["Kassala", "Khashm el-Girba", "New Halfa", "Wagar", "Aroma", "Hamashkoreib", "Telkuk", "North Delta", "Rural Kassala"],
    "Khartoum": ["Khartoum", "Jabal Awliya", "Sharq an-Nil", "Bahri", "Omdurman", "Um Badda", "Karari"],
    "North Darfur": ["Al-Fashir", "Kutum", "Kabkabiya", "Mellit", "Umm Kaddadah", "Al-Tawisha", "Tina", "Al-Waha", "Saraf Omra", "El Laeit"],
    "North Kordofan": ["Sheikan (Al-Ubayyid)", "Bara", "Umm Ruwaba", "Sodari", "Ghebeish", "Wad Banda", "Abu Zabad"],
    "Northern": ["Dongola", "Merowe", "Al Dabbah", "Wadi Halfa", "Delgo", "Al Burgaig", "Al Golid"],
    "Red Sea": ["Port Sudan", "Tokar", "Sawakin", "Halaib", "Dordaib", "Sinkat", "Ageeg"],
    "River Nile": ["Shendi", "Ad-Damir", "Atbara", "Berber", "Abu Hamad", "Al-Matammah"],
    "Sennar": ["Sennar", "Singa", "Ad-Dindir", "Al-Suki", "Abu Hujar"],
    "South Darfur": ["Nyala", "Kas", "Gereida", "Biram", "Tulus", "Al-Salam", "Ed al-Fursan", "Kutum", "Nyala North", "Nyala South"],
    "South Kordofan": ["Kadugli", "Dilling", "Rashad", "Talodi", "Al-Abbassiya", "Habila", "Abu Jubayhah", "Al-Buram"],
    "West Darfur": ["Geneina", "Kulbus", "Jebel Moon", "Sirba", "Beida", "Foro Baranga", "Habila"],
    "West Kordofan": ["Al-Fulah", "Babanusa", "Abyei", "Al-Meiram", "Lagowa", "Al-Nuhud", "Al-Salam"],
    "White Nile": ["Kosti", "Rabak", "Ad-Duwaym", "Al-Jabalain", "Al-Salam", "Um Remta", "Guli", "Al-Gutaina"]
};

// ... (EENC SKILLS, ETAT SKILLS, IMNCI CLASSIFICATIONS constants are unchanged) ...
const SKILLS_EENC_BREATHING = { /* ... */ };
const EENC_DOMAIN_LABEL_BREATHING = { /* ... */ };
const EENC_DOMAINS_BREATHING = Object.keys(SKILLS_EENC_BREATHING);
const SKILLS_EENC_NOT_BREATHING = { /* ... */ };
const EENC_DOMAIN_LABEL_NOT_BREATHING = { /* ... */ };
const EENC_DOMAINS_NOT_BREATHING = Object.keys(SKILLS_EENC_NOT_BREATHING);
const SKILLS_ETAT = { /* ... */ };
const ETAT_DOMAIN_LABEL = { /* ... */ };
const ETAT_DOMAINS = Object.keys(SKILLS_ETAT);
const CLASS_2_59M = { /* ... */ };
const CLASS_0_59D = { /* ... */ };
const DOMAINS_BY_AGE_IMNCI = { /* ... */ };
const DOMAIN_LABEL_IMNCI = { /* ... */ };
const getClassListImnci = (age, d) => (age === "GE2M_LE5Y" ? CLASS_2_59M[d] : CLASS_0_59D[d]) || [];


// ----------------------------- SMALL HELPERS (UNCHANGED) --------------------------------
const percent = (c, s) => (!s ? "—" : (Math.round((1000 * c) / s) / 10).toFixed(1) + " %");
const calcPct = (c, s) => (!s ? NaN : (c * 100) / s);
const fmtPct = v => (!isFinite(v) ? "—" : (Math.round(v * 10) / 10).toFixed(1) + " %");
const pctBgClass = v => (!isFinite(v) ? "" : v < 50 ? "bg-pink-100" : v <= 80 ? "bg-yellow-100" : "bg-green-100");
const safeCSV = (s) => {
  const v = s == null ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

// =============================================================================
// Root App
// =============================================================================
export default function App() {
  const [view, setView] = useState("landing");

  const [activeCourseType, setActiveCourseType] = useState("IMNCI");
  const [courses, setCourses] = useState([]);
  const [participants, setParticipants] = useState([]);
  
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);

  const [editingCourse, setEditingCourse] = useState(null);
  const [editingParticipant, setEditingParticipant] = useState(null);

  // --- UPDATED: These functions now call the async Firestore functions ---
  async function refreshCourses() {
    const list = await listCoursesByType(activeCourseType);
    setCourses(list);
  }

  async function refreshParticipants() {
    if (!selectedCourseId) {
      setParticipants([]); // Clear participants when no course is selected
      return;
    }
    const list = await listParticipants(selectedCourseId);
    setParticipants(list);
  }

  useEffect(() => {
    refreshCourses();
  }, [activeCourseType]);

  useEffect(() => {
    refreshParticipants();
  }, [selectedCourseId]);
    
  // --- REMOVED: The useEffect hook that added mock data to localStorage ---

  const selectedCourse = useMemo(() => courses.find(c => c.id === selectedCourseId) || null, [courses, selectedCourseId]);
  const courseParticipants = useMemo(() => participants.filter(p => p.courseId === selectedCourseId), [participants, selectedCourseId]);
  const selectedParticipant = useMemo(() => courseParticipants.find(p => p.id === selectedParticipantId) || null, [courseParticipants, selectedParticipantId]);

  // Handlers for edit/delete
  const handleEditCourse = (course) => { setEditingCourse(course); setView('courseForm'); };
  const handleDeleteCourse = async (courseId) => {
      if (window.confirm('Are you sure you want to delete this course and all its data? This cannot be undone.')) {
          await deleteCourse(courseId);
          await refreshCourses();
          if (selectedCourseId === courseId) setSelectedCourseId(null);
      }
  };
  const handleEditParticipant = (participant) => { setEditingParticipant(participant); setView('participantForm'); };
  const handleDeleteParticipant = async (participantId) => {
      if (window.confirm('Are you sure you want to delete this participant and all their data?')) {
          await deleteParticipant(participantId);
          await refreshParticipants();
          if (selectedParticipantId === participantId) setSelectedParticipantId(null);
      }
  };

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
                <button className="px-4 py-2 rounded-full bg-green-600 text-white font-semibold shadow-sm hover:brightness-110" onClick={() => { setEditingCourse(null); setView('courses'); }}>Courses</button>
                {selectedCourse && <button className="px-4 py-2 rounded-full bg-purple-600 text-white font-semibold shadow-sm hover:brightness-110" onClick={() => { setEditingParticipant(null); setView('participants'); }}>Participants</button>}
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
            onAdd={() => { setEditingCourse(null); setView('courseForm'); }}
            onOpen={(id) => { setSelectedCourseId(id); setSelectedParticipantId(null); setView('participants'); }}
            onEdit={handleEditCourse}
            onDelete={handleDeleteCourse}
          />
        )}

        {view === 'courseForm' && (
          <CourseForm
            courseType={activeCourseType}
            initialData={editingCourse}
            onCancel={() => { setEditingCourse(null); setView('courses'); }}
            onSave={async (payload) => {
              const id = await upsertCourse({ ...payload, id: editingCourse?.id, course_type: activeCourseType });
              await refreshCourses();
              setEditingCourse(null);
              setSelectedCourseId(id);
              setView('participants');
            }}
          />
        )}

        {view === 'participants' && selectedCourse && (
          <ParticipantsView
            course={selectedCourse}
            participants={courseParticipants}
            onAdd={() => { setEditingParticipant(null); setView('participantForm'); }}
            onOpen={(pid) => { setSelectedParticipantId(pid); setView('observe'); }}
            onEdit={handleEditParticipant}
            onDelete={handleDeleteParticipant}
          />
        )}

        {view === 'participantForm' && selectedCourse && (
          <ParticipantForm
            course={selectedCourse}
            initialData={editingParticipant}
            onCancel={() => { setEditingParticipant(null); setView('participants'); }}
            onSave={async (p) => {
              await upsertParticipant({ ...p, id: editingParticipant?.id, courseId: selectedCourse.id });
              await refreshParticipants();
              setEditingParticipant(null);
              setView('participants');
            }}
          />
        )}

        {view === 'observe' && selectedCourse && selectedParticipant && (
          <ObservationView
            course={selectedCourse}
            participant={selectedParticipant}
            participants={courseParticipants}
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

// -------------------------------- Landing (UNCHANGED) -----------------------------------
function Landing({ active, onPick }) {
  const items = [
    { key: 'IMNCI', title: 'Integrated Mgmt of Childhood & Newborn Illnesses (IMNCI)', enabled: true },
    { key: 'ETAT', title: 'Emergency Triage, Assessment & Treatment (ETAT)', enabled: true },
    { key: 'EENC', title: 'Early Essential Newborn Care (EENC)', enabled: true },
    { key: 'IPC (Neonatal Unit)', title: 'Infection Prevention & Control (Neonatal Unit)', enabled: false },
    { key: 'Small & Sick Newborn', title: 'Small & Sick Newborn Case Management', enabled: false },
  ];

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
      const text = `Migrated successfully:\n• Courses: ${result.courses}\n• Participants: ${result.participants}\n• Observations: ${result.observations}\n• Cases: ${result.cases}`;
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
          <button type="button" onClick={runMigration} disabled={migrating} className={`px-3 py-2 rounded-xl border ${migrating ? 'opacity-60 cursor-not-allowed' : ''}`} title="Copies your localStorage data to Firestore once">
            {migrating ? 'Migrating…' : 'Migrate local data → Firestore'}
          </button>
        )}
      </div>

      {msg && <div className="text-sm text-gray-600 whitespace-pre-line">{msg}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(it => (
          <button key={it.key} disabled={!it.enabled} className={`border rounded-2xl p-4 text-left transition ${active === it.key ? 'ring-2 ring-blue-500' : ''} ${it.enabled ? 'hover:shadow' : 'opacity-50 cursor-not-allowed'}`} onClick={() => it.enabled && onPick(it.key)}>
            <div className="flex items-center gap-3">
              <CourseIcon course={it.key} />
              <div>
                <div className="font-semibold">{it.title}</div>
                <div className="text-xs text-gray-500">{it.enabled ? 'Tap to manage' : 'Coming Soon'}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// -------------------------------- Courses (UNCHANGED) -----------------------------------
function CoursesView({ courses, onAdd, onOpen, onEdit, onDelete }) {
  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Available Courses</h2>
        <button className="px-3 py-2 rounded-xl border" onClick={onAdd}>Add New Course</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left border-b"><th className="py-2 pr-4">State</th><th className="py-2 pr-4">Locality</th><th className="py-2 pr-4">Course Hall</th><th className="py-2 pr-4">Coordinator</th><th className="py-2 pr-4"># Participants</th><th className="py-2 pr-4">Facilitators</th><th className="py-2 pr-4">Actions</th></tr></thead>
          <tbody>
            {courses.length === 0 && (<tr><td colSpan={7} className="py-6 text-center text-gray-500">No courses found</td></tr>)}
            {courses.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4">{c.state}</td>
                <td className="py-2 pr-4">{c.locality}</td>
                <td className="py-2 pr-4">{c.hall}</td>
                <td className="py-2 pr-4">{c.coordinator}</td>
                <td className="py-2 pr-4">{c.participants_count}</td>
                <td className="py-2 pr-4">{Array.isArray(c.facilitators) ? c.facilitators.join(", ") : [c.facilitator1,c.facilitator2,c.facilitator3,c.facilitator4,c.facilitator5,c.facilitator6].filter(Boolean).join(", ")}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded-lg border bg-blue-100" onClick={() => onOpen(c.id)}>Open</button>
                    <button className="px-3 py-1 rounded-lg border bg-yellow-100" onClick={() => onEdit(c)}>Edit</button>
                    <button className="px-3 py-1 rounded-lg border bg-red-100" onClick={() => onDelete(c.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// -------------------------------- CourseForm (UNCHANGED) -----------------------------------
function CourseForm({ courseType, initialData, onCancel, onSave }) {
  const [state, setState] = useState('');
  const [locality, setLocality] = useState('');
  const [hall, setHall] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [participantsCount, setParticipantsCount] = useState(0);
  const [director, setDirector] = useState('');
  const [clinical, setClinical] = useState('');
  const [supporter, setSupporter] = useState('');
  const [facilitators, setFacilitators] = useState(['', '']);
  const [error, setError] = useState('');

  useEffect(() => {
      if (initialData) {
          setState(initialData.state || '');
          setLocality(initialData.locality || '');
          setHall(initialData.hall || '');
          setCoordinator(initialData.coordinator || '');
          setParticipantsCount(initialData.participants_count || 0);
          setDirector(initialData.director || '');
          setClinical(initialData.clinical_instructor || '');
          setSupporter(initialData.supporter || '');
          setFacilitators(initialData.facilitators || ['', '']);
      }
  }, [initialData]);

  const addFac = () => setFacilitators(f => [...f, '']);
  const removeFac = (i) => setFacilitators(f => f.length <= 2 ? f : f.filter((_, idx) => idx !== i));
  const setFac = (i, v) => setFacilitators(f => f.map((x, idx) => idx === i ? v : x));

  const submit = () => {
    const facArr = facilitators.map(s => s.trim()).filter(Boolean);
    if (!state || !locality || !hall || !coordinator || !participantsCount || !director || !clinical || facArr.length < 2 || !supporter) {
      setError('Please complete all required fields (minimum two facilitators).');
      return;
    }
    const payload = { state, locality, hall, coordinator, participants_count: participantsCount, director, clinical_instructor: clinical, supporter, facilitators: facArr };
    onSave(payload);
  };

  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <h2 className="text-lg font-medium">{initialData ? 'Edit' : 'Add New'} Course — <span className="text-gray-600">{courseType}</span></h2>
      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
      <div className="grid md:grid-cols-3 gap-3">
        <FieldA label="State"><select className="border rounded-lg p-2 w-full" value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</select></FieldA>
        <FieldA label="Locality"><select className="border rounded-lg p-2 w-full" value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</select></FieldA>
        <FieldA label="Course Hall"><input className="border rounded-lg p-2 w-full" value={hall} onChange={(e) => setHall(e.target.value)} /></FieldA>
        <FieldA label="Course Coordinator"><input className="border rounded-lg p-2 w-full" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} /></FieldA>
        <FieldA label="# of Participants"><input type="number" className="border rounded-lg p-2 w-full" value={participantsCount} onChange={(e) => setParticipantsCount(Number(e.target.value))} /></FieldA>
        <FieldA label="Course Director"><input className="border rounded-lg p-2 w-full" value={director} onChange={(e) => setDirector(e.target.value)} /></FieldA>
        <FieldA label="Clinical Instructor"><input className="border rounded-lg p-2 w-full" value={clinical} onChange={(e) => setClinical(e.target.value)} /></FieldA>
        <FieldA label="Supporter"><input className="border rounded-lg p-2 w-full" value={supporter} onChange={(e) => setSupporter(e.target.value)} /></FieldA>
        <FieldA label="Facilitators">
          <div className="grid gap-2">
            {facilitators.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input className="border rounded-lg p-2 w-full" value={v} onChange={(e) => setFac(i, e.target.value)} placeholder={`Facilitator ${i + 1}`} />
                <button type="button" className="px-3 py-2 rounded-lg border" onClick={() => removeFac(i)} disabled={facilitators.length <= 2}>−</button>
              </div>
            ))}
            <button type="button" className="px-3 py-2 rounded-lg border" onClick={addFac}>+ Add Facilitator</button>
          </div>
        </FieldA>
      </div>
      <div className="flex gap-2 justify-end"><button className="px-3 py-2 rounded-xl border" onClick={onCancel}>Cancel</button><button className="px-3 py-2 rounded-xl bg-black text-white" onClick={submit}>Save Course</button></div>
    </section>
  );
}

// ----------------------------- Participants (UNCHANGED) ---------------------------------
function ParticipantsView({ course, participants, onAdd, onOpen, onEdit, onDelete }) {
  const [groupFilter, setGroupFilter] = useState('All');
  const filtered = groupFilter === 'All' ? participants : participants.filter(p => p.group === groupFilter);
  return (
    <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Participants — {course.state} / {course.locality}</h2>
        <div className="flex items-center gap-2">
          <select className="border rounded-lg p-2" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="All">All Groups</option><option value="Group A">Group A</option><option value="Group B">Group B</option><option value="Group C">Group C</option><option value="Group D">Group D</option>
          </select>
          <button className="px-3 py-2 rounded-xl border" onClick={onAdd}>Add Participant</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left border-b"><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Group</th><th className="py-2 pr-4">State</th><th className="py-2 pr-4">Locality</th><th className="py-2 pr-4">Center</th><th className="py-2 pr-4">Phone</th><th className="py-2 pr-4">Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 && (<tr><td colSpan={7} className="py-6 text-center text-gray-500">No participants found</td></tr>)}
            {filtered.map(p => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4">{p.name}</td>
                <td className="py-2 pr-4">{p.group}</td>
                <td className="py-2 pr-4">{p.state}</td>
                <td className="py-2 pr-4">{p.locality}</td>
                <td className="py-2 pr-4">{p.center_name}</td>
                <td className="py-2 pr-4">{p.phone}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded-lg border bg-blue-100" onClick={() => onOpen(p.id)}>Monitoring</button>
                    <button className="px-3 py-1 rounded-lg border bg-yellow-100" onClick={() => onEdit(p)}>Edit</button>
                    <button className="px-3 py-1 rounded-lg border bg-red-100" onClick={() => onDelete(p.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ----------------------------- ParticipantForm (UNCHANGED) ---------------------------------
function ParticipantForm({ course, initialData, onCancel, onSave }) {
    const [name, setName] = useState('');
    const [state, setState] = useState('');
    const [locality, setLocality] = useState('');
    const [center, setCenter] = useState('');
    const [job, setJob] = useState('');
    const [phone, setPhone] = useState('');
    const [group, setGroup] = useState('Group A');
    const [error, setError] = useState('');

    // IMNCI-specific
    const [trainedIMNCI, setTrainedIMNCI] = useState(false);
    const [lastTrainIMNCI, setLastTrainIMNCI] = useState('');
    const [numProv, setNumProv] = useState(0);
    const [numProvIMCI, setNumProvIMCI] = useState(0);
    const [hasNutri, setHasNutri] = useState(false);
    const [nearestNutri, setNearestNutri] = useState('');
    const [hasImm, setHasImm] = useState(false);
    const [nearestImm, setNearestImm] = useState('');
    const [hasORS, setHasORS] = useState(false);
    
    // EENC-specific
    const [trainedEENC, setTrainedEENC] = useState(false);
    const [lastTrainEENC, setLastTrainEENC] = useState('');
    const [otherStaff, setOtherStaff] = useState(0);
    const [otherStaffTrained, setOtherStaffTrained] = useState(0);
    const [hasNursery, setHasNursery] = useState(false);
    const [hasKangaroo, setHasKangaroo] = useState(false);
    
    useEffect(() => {
        if(initialData) {
            setName(initialData.name || '');
            setState(initialData.state || '');
            setLocality(initialData.locality || '');
            setCenter(initialData.center_name || '');
            setJob(initialData.job_title || '');
            setPhone(initialData.phone || '');
            setGroup(initialData.group || 'Group A');
            // IMNCI
            setTrainedIMNCI(initialData.trained_before || false);
            setLastTrainIMNCI(initialData.last_imci_training || '');
            setNumProv(initialData.num_other_providers || 0);
            setNumProvIMCI(initialData.num_other_providers_imci || 0);
            setHasNutri(initialData.has_nutrition_service || false);
            setNearestNutri(initialData.nearest_nutrition_center || '');
            setHasImm(initialData.has_immunization_service || false);
            setNearestImm(initialData.nearest_immunization_center || '');
            setHasORS(initialData.has_ors_room || false);
            // EENC
            setTrainedEENC(initialData.trained_eenc_before || false);
            setLastTrainEENC(initialData.last_eenc_training || '');
            setOtherStaff(initialData.other_staff_delivery_room || 0);
            setOtherStaffTrained(initialData.other_staff_eenc_trained || 0);
            setHasNursery(initialData.has_nursery || false);
            setHasKangaroo(initialData.has_kangaroo_room || false);

        }
    }, [initialData]);

    const submit = () => {
        if (!name || !state || !locality || !center || !job || !phone) {
            setError('Please complete all required fields'); return;
        }
        
        let p = { name, group, state, locality, center_name: center, job_title: job, phone };
        
        if (course.course_type === 'IMNCI') {
            p = { ...p, trained_before: trainedIMNCI, last_imci_training: lastTrainIMNCI || undefined, num_other_providers: numProv, num_other_providers_imci: numProvIMCI, has_nutrition_service: hasNutri, has_immunization_service: hasImm, has_ors_room: hasORS, nearest_nutrition_center: hasNutri ? undefined : (nearestNutri || undefined), nearest_immunization_center: hasImm ? undefined : (nearestImm || undefined) };
        }
        
        if (course.course_type === 'EENC') {
            p = { ...p, trained_eenc_before: trainedEENC, last_eenc_training: lastTrainEENC || undefined, other_staff_delivery_room: otherStaff, other_staff_eenc_trained: otherStaffTrained, has_nursery: hasNursery, has_immunization: hasImm, has_kangaroo_room: hasKangaroo };
        }

        onSave(p);
    };

    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';

    return (
        <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
            <h2 className="text-lg font-medium">{initialData ? 'Edit' : 'Add'} Participant to Course</h2>
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <div className="grid md:grid-cols-3 gap-3">
                <FieldA label="Name"><input className="border rounded-lg p-2 w-full" value={name} onChange={(e) => setName(e.target.value)} /></FieldA>
                <FieldA label="Group"><select className="border rounded-lg p-2 w-full" value={group} onChange={(e) => setGroup(e.target.value)}><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></select></FieldA>
                <FieldA label="State Name"><select className="border rounded-lg p-2 w-full" value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</select></FieldA>
                <FieldA label="Locality Name"><select className="border rounded-lg p-2 w-full" value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</select></FieldA>
                <FieldA label="Center Name"><input className="border rounded-lg p-2 w-full" value={center} onChange={(e) => setCenter(e.target.value)} /></FieldA>
                <FieldA label="Job Title"><input className="border rounded-lg p-2 w-full" value={job} onChange={(e) => setJob(e.target.value)} /></FieldA>
                <FieldA label="Phone Number"><input className="border rounded-lg p-2 w-full" value={phone} onChange={(e) => setPhone(e.target.value)} /></FieldA>
                
                {isImnci && (
                    <>
                        <FieldA label="Previously trained in IMCI?"><select className="border rounded-lg p-2 w-full" value={trainedIMNCI ? "yes" : "no"} onChange={(e) => setTrainedIMNCI(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></FieldA>
                        <FieldA label="Last IMCI training date"><input type="date" className="border rounded-lg p-2 w-full" value={lastTrainIMNCI} onChange={(e) => setLastTrainIMNCI(e.target.value)} /></FieldA>
                        <FieldA label="Is there a therapeutic nutrition service?"><select className="border rounded-lg p-2 w-full" value={hasNutri ? 'yes' : 'no'} onChange={e => setHasNutri(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></FieldA>
                        {!hasNutri && (<FieldA label="If no, what is the nearest outpatient nutrition center?"><input className="border rounded-lg p-2 w-full" value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} /></FieldA>)}
                        <FieldA label="Is there an immunization service?"><select className="border rounded-lg p-2 w-full" value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></FieldA>
                        {!hasImm && (<FieldA label="If no, what is the nearest immunization center?"><input className="border rounded-lg p-2 w-full" value={nearestImm} onChange={e => setNearestImm(e.target.value)} /></FieldA>)}
                        <FieldA label="Is there an ORS corner service?"><select className="border rounded-lg p-2 w-full" value={hasORS ? 'yes' : 'no'} onChange={e => setHasORS(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></FieldA>
                        <FieldA label="Number of doctors and assistants at the health center"><input type="number" min="0" className="border rounded-lg p-2 w-full" value={numProv} onChange={(e) => setNumProv(Number(e.target.value || 0))} /></FieldA>
                        <FieldA label="Number of doctors/medical assistants trained in IMCI"><input type="number" min="0" className="border rounded-lg p-2 w-full" value={numProvIMCI} onChange={(e) => setNumProvIMCI(Number(e.target.value || 0))} /></FieldA>
                    </>
                )}

                {isEenc && (
                    <>
                         <FieldA label="Previously trained in EENC?"><select className="border rounded-lg p-2 w-full" value={trainedEENC ? "yes" : "no"} onChange={(e) => setTrainedEENC(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></FieldA>
                         <FieldA label="Last EENC training date"><input type="date" className="border rounded-lg p-2 w-full" value={lastTrainEENC} onChange={(e) => setLastTrainEENC(e.target.value)} /></FieldA>
                         <FieldA label="# of other providers in delivery room"><input type="number" min="0" className="border rounded-lg p-2 w-full" value={otherStaff} onChange={(e) => setOtherStaff(Number(e.target.value || 0))} /></FieldA>
                         <FieldA label="# of other providers trained in EENC"><input type="number" min="0" className="border rounded-lg p-2 w-full" value={otherStaffTrained} onChange={(e) => setOtherStaffTrained(Number(e.target.value || 0))} /></FieldA>
                         <FieldA label="Is there a nursery service?"><select className="border rounded-lg p-2 w-full" value={hasNursery ? 'yes' : 'no'} onChange={e => setHasNursery(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></FieldA>
                         <FieldA label="Is there an immunization service?"><select className="border rounded-lg p-2 w-full" value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></FieldA>
                         <FieldA label="Is there a Kangaroo care room?"><select className="border rounded-lg p-2 w-full" value={hasKangaroo ? 'yes' : 'no'} onChange={e => setHasKangaroo(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></FieldA>
                    </>
                )}
            </div>
            <div className="flex gap-2 justify-end"><button className="px-3 py-2 rounded-xl border" onClick={onCancel}>Cancel</button><button className="px-3 py-2 rounded-xl bg-black text-white" onClick={submit}>Save Participant</button></div>
        </section>
    );
}

// =============================================================================
// MONITORING (OBSERVATION) - Updated for Firestore
// =============================================================================
function ObservationView({ course, participant, participants, onChangeParticipant }) {
    const [observations, setObservations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);

    const [encounterDate, setEncounterDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dayOfCourse, setDayOfCourse] = useState(1);
    const [setting, setSetting] = useState("OPD");
    const [age, setAge] = useState("GE2M_LE5Y");
    const [caseSerial, setCaseSerial] = useState(1);
    const [caseAgeMonths, setCaseAgeMonths] = useState('');
    const [buffer, setBuffer] = useState({});
    const [editingCase, setEditingCase] = useState(null);

    const [eencScenario, setEencScenario] = useState('breathing');

    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';
    
    // Fetch data from Firestore when participant changes
    useEffect(() => {
        const fetchData = async () => {
            if (!participant?.id || !course?.id) return;
            setLoading(true);
            const [obsData, casesData] = await Promise.all([
                listObservationsForParticipant(course.id, participant.id),
                listCasesForParticipant(course.id, participant.id)
            ]);
            setObservations(obsData);
            setCases(casesData);
            setLoading(false);
        };
        fetchData();
    }, [participant?.id, course?.id]);

    useEffect(() => {
        if(editingCase) return;
        const sameDayCases = cases.filter(c => c.encounter_date === encounterDate);
        const maxS = sameDayCases.reduce((m, x) => Math.max(m, x.case_serial || 0), 0);
        setCaseSerial(Math.max(1, maxS + 1));
    }, [cases, encounterDate, editingCase]);

    const toggle = (d, cls, v) => {
        const k = `${d}|${cls}`;
        setBuffer(prev => (prev[k] === v ? (({ [k]: _, ...rest }) => rest)(prev) : { ...prev, [k]: v }));
    };

    const submitCase = async () => {
        const entries = Object.entries(buffer);
        if (entries.length === 0) { alert('No skills/classifications selected.'); return; }

        const currentCaseSerial = editingCase ? editingCase.case_serial : caseSerial;
        const allCorrect = entries.every(([, v]) => v === 1);
        const age_group_for_case = isImnci ? age : isEenc ? `EENC_${eencScenario}` : 'ETAT';

        const caseData = {
            courseId: course.id,
            participant_id: participant.id,
            encounter_date: encounterDate,
            setting: isImnci ? setting : 'N/A',
            age_group: age_group_for_case,
            case_serial: currentCaseSerial,
            day_of_course: dayOfCourse,
            allCorrect: allCorrect
        };

        const newObservations = entries.map(([k, v]) => {
            const [domain, skill_or_class] = k.split('|');
            return {
                courseId: course.id, course_type: course.course_type,
                encounter_date: encounterDate, day_of_course: dayOfCourse,
                setting: isImnci ? setting : 'N/A',
                participant_id: participant.id,
                age_group: isImnci ? age : (isEenc ? eencScenario : undefined),
                domain: domain,
                item_recorded: skill_or_class,
                item_correct: v,
                case_serial: currentCaseSerial,
                case_age_months: caseAgeMonths === '' ? undefined : Number(caseAgeMonths),
            };
        });
        
        await upsertCaseAndObservations(caseData, newObservations, editingCase?.id);

        const [obsData, casesData] = await Promise.all([
            listObservationsForParticipant(course.id, participant.id),
            listCasesForParticipant(course.id, participant.id)
        ]);
        setObservations(obsData);
        setCases(casesData);

        setBuffer({});
        setCaseAgeMonths('');
        setEditingCase(null);
    };

    const handleEditCase = (caseToEdit) => {
        setEditingCase(caseToEdit);
        setEncounterDate(caseToEdit.encounter_date);
        setDayOfCourse(caseToEdit.day_of_course);
        if(isImnci) {
            setSetting(caseToEdit.setting);
            setAge(caseToEdit.age_group);
        }
        if(isEenc) {
            setEencScenario(caseToEdit.age_group.replace('EENC_', ''));
        }
        const caseObs = observations.filter(o => o.caseId === caseToEdit.id);
        const newBuffer = {};
        caseObs.forEach(o => { newBuffer[`${o.domain}|${o.item_recorded}`] = o.item_correct; });
        setBuffer(newBuffer);
        window.scrollTo(0, 0);
    };
    
    const handleDeleteCase = async (caseToDelete) => {
        if (!confirm('Delete this case and all its observations? This cannot be undone.')) return;
        await deleteCaseAndObservations(caseToDelete.id);
        const [obsData, casesData] = await Promise.all([
            listObservationsForParticipant(course.id, participant.id),
            listCasesForParticipant(course.id, participant.id)
        ]);
        setObservations(obsData);
        setCases(casesData);
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
            {isImnci && <Block label="Setting">
              <select className="border rounded-lg p-2 w-full" value={setting} onChange={(e) => setSetting(e.target.value)} disabled={!!editingCase}>
                <option value="OPD">Out-patient</option><option value="IPD">In-patient</option>
              </select>
            </Block>}
            {isImnci && <Block label="Age band">
              <select className="border rounded-lg p-2 w-full" value={age} onChange={(e) => setAge(e.target.value)} disabled={!!editingCase}>
                <option value="GE2M_LE5Y">Sick child (2-59 months)</option>
                <option value="LT2M">Sick young infant (0-59 days)</option>
              </select>
            </Block>}
            {isEenc && <Block label="EENC Scenario">
              <select className="border rounded-lg p-2 w-full" value={eencScenario} onChange={(e) => setEencScenario(e.target.value)} disabled={!!editingCase}>
                <option value="breathing">Breathing Baby</option>
                <option value="not_breathing">Not Breathing Baby</option>
              </select>
            </Block>}
          </Toolbar>
        </section>

        <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
            <div className="grid md:grid-cols-3 gap-6">
                <FieldA label="Encounter date"><input type="date" className="border rounded-lg p-2 w-full" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} disabled={!!editingCase} /></FieldA>
                <FieldA label="Course day (1-7)"><select className="border rounded-lg p-2 w-full" value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</select></FieldA>
                <FieldA label="Case age (months)"><input type="number" className="border rounded-lg p-2 w-full" value={caseAgeMonths} onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" /></FieldA>
            </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-5 grid gap-4">
            <h3 className="text-lg font-semibold">{editingCase ? `Editing Case #${editingCase.case_serial}` : 'Select skill/classification and mark correctness'}</h3>
            <div className="overflow-x-auto">
                {isImnci && <ImnciMonitoringGrid age={age} buffer={buffer} toggle={toggle} />}
                {isEenc && <EencMonitoringGrid scenario={eencScenario} buffer={buffer} toggle={toggle} />}
            </div>
            <div className="flex gap-3 justify-end">
                <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white" onClick={submitCase}>{editingCase ? 'Update Case' : 'Submit Case'}</button>
                <button className="px-4 py-2 rounded-xl bg-slate-700 text-white" onClick={() => { setBuffer({}); setEditingCase(null); setCaseAgeMonths(''); }}>{editingCase ? 'Cancel Edit' : 'Start New Case'}</button>
            </div>
        </section>

        {loading ? <div>Loading cases...</div> : (
          <SubmittedCases 
            course={course} 
            participant={participant} 
            observations={observations}
            cases={cases}
            onEditCase={handleEditCase} 
            onDeleteCase={handleDeleteCase}
          />
        )}
      </>
    );
}

// ----------------------------- MONITORING GRIDS (UNCHANGED) ------------------------------
function ImnciMonitoringGrid({ age, buffer, toggle }) { /* ... Unchanged ... */ }
function EencMonitoringGrid({ scenario, buffer, toggle }) { /* ... Unchanged ... */ }

// =============================================================================
// SUBMITTED CASES - Updated for Firestore
// =============================================================================
function SubmittedCases({ course, participant, observations, cases, onEditCase, onDeleteCase }) {
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';

    const caseRows = useMemo(() => {
        return cases.map(c => {
            const relatedObs = observations.filter(o => o.caseId === c.id);
            const total = relatedObs.length;
            const correct = relatedObs.filter(o => o.item_correct === 1).length;
            return {
                ...c,
                date: c.encounter_date,
                setting: c.setting,
                age: c.age_group,
                serial: c.case_serial,
                day: c.day_of_course,
                total,
                correct
            };
        }).sort((a, b) => (a.date < b.date ? 1 : -1) || b.serial - a.serial);
    }, [cases, observations]);

    const exportCSV = () => {
        const header = ['courseId', 'participant_id', 'participant_name', 'participant_group', 'encounter_date', 'day_of_course', 'setting', 'age_group', 'case_serial', 'case_age_months', 'domain', 'item_recorded', 'item_correct'];
        const lines = [header.join(',')];
        const participantRows = observations.filter(r => r.participant_id === participant.id);
        for (const x of participantRows) {
          lines.push([course.id, participant.id, safeCSV(participant.name), participant.group, x.encounter_date, x.day_of_course ?? '', x.setting, x.age_group ?? '', x.case_serial ?? '', x.case_age_months ?? '', x.domain, safeCSV(x.item_recorded), x.item_correct].join(','));
        }
        const csv = "\uFEFF" + lines.join("\n");
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `${course.course_type}_${course.state}_${participant.name}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    const getAgeLabel = (age) => {
        if (isImnci) { return age === 'LT2M' ? '0-59 d' : '2-59 m'; }
        if (isEenc) { return age.includes('breathing') ? (age.includes('not_breathing') ? 'Not Breathing' : 'Breathing') : age; }
        return age;
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
                        <tr className="text-left border-b"><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Day</th>{isImnci && <th className="py-2 pr-4">Setting</th>}{(isImnci || isEenc) && <th className="py-2 pr-4">{isImnci ? 'Age band' : 'Scenario'}</th>}<th className="py-2 pr-4">Serial</th><th className="py-2 pr-4">Skills</th><th className="py-2 pr-4">Correct</th><th className="py-2 pr-4">% Correct</th><th className="py-2 pr-4">Actions</th></tr>
                    </thead>
                    <tbody>
                        {caseRows.length === 0 && (<tr><td colSpan={isImnci ? 9 : (isEenc ? 8 : 7)} className="py-6 text-center text-gray-500">No cases yet.</td></tr>)}
                        {caseRows.map((c, idx) => { const pct = calcPct(c.correct, c.total); return (
                            <tr key={idx} className="border-b">
                                <td className="py-2 pr-4">{c.date}</td>
                                <td className="py-2 pr-4">{c.day ?? ''}</td>
                                {isImnci && <td className="py-2 pr-4">{c.setting}</td>}
                                {(isImnci || isEenc) && <td className="py-2 pr-4">{getAgeLabel(c.age)}</td>}
                                <td className="py-2 pr-4">{c.serial}</td>
                                <td className="py-2 pr-4">{c.total}</td>
                                <td className="py-2 pr-4">{c.correct}</td>
                                <td className={`py-2 pr-4 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td>
                                <td className="py-2 pr-4"><div className="flex gap-2"><button className="px-3 py-1 rounded-lg border" onClick={() => onEditCase(c)}>Edit</button><button className="px-3 py-1 rounded-lg border" onClick={() => onDeleteCase(c)}>Delete</button></div></td>
                            </tr>
                        );})}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// =============================================================================
// REPORTS - Updated for Firestore
// =============================================================================
function ReportsView({ course, participants }) {
    const [allObs, setAllObs] = useState([]);
    const [allCases, setAllCases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!course?.id) return;
            setLoading(true);
            const { allObs, allCases } = await listAllDataForCourse(course.id);
            setAllObs(allObs);
            setAllCases(allCases);
            setLoading(false);
        };
        fetchData();
    }, [course?.id]);

    if (loading) {
        return <div className="bg-white rounded-2xl shadow p-5">Loading report data...</div>;
    }

    if (course.course_type === 'ETAT') {
        return <EtatReports course={course} participants={participants} allObs={allObs} allCases={allCases} />;
    }
    if (course.course_type === 'EENC') {
        return <EencReports course={course} participants={participants} allObs={allObs} allCases={allCases} />;
    }
    return <ImnciReports course={course} participants={participants} allObs={allObs} allCases={allCases} />;
}

// All report components are updated to receive data as props instead of fetching it.
function ImnciReports({ course, participants, allObs, allCases }) {
    const [age, setAge] = useState('GE2M_LE5Y');
    const [settingFilter, setSettingFilter] = useState('All');
    const [tab, setTab] = useState('matrix');

    const rows = useMemo(() => allObs.filter(o => o.courseId === course.id && o.age_group === age && (settingFilter === 'All' || o.setting === settingFilter)),[allObs, course.id, age, settingFilter]);
    const registry = useMemo(() => allCases.filter(c => c.courseId === course.id && c.age_group === age && (settingFilter === 'All' || c.setting === settingFilter)), [allCases, course.id, age, settingFilter]);
    // ... The rest of the ImnciReports component is unchanged.
}

function EtatReports({ course, participants, allObs, allCases }) {
    // ... Similar updates to receive allObs and allCases as props ...
}

function EencReports({ course, participants, allObs, allCases }) {
    // ... Similar updates to receive allObs and allCases as props ...
}


// ----------------------------- Shared UI pieces (UNCHANGED) ------------------------------
function FieldA({ label, children }) { return (<label className="grid gap-1 text-sm"><span className="text-gray-800 font-semibold">{label}</span>{children}</label>); }
function Toolbar({ children }) { return (<div className="w-full rounded-xl border bg-white shadow-sm"><div className="flex flex-wrap gap-3 p-3">{children}</div></div>); }
function Block({ label, children }) { return (<div className="min-w-[240px]"><div className="text-sm font-semibold text-gray-800 mb-1">{label}</div>{children}</div>); }
function ProgramLogo() { /* ... Unchanged ... */ }
function CourseIcon({ course }) { /* ... Unchanged ... */ }

// ----------------------------- Utilities (NO LONGER NEEDED) ------------------------------------
// REMOVED: function mergeObsForStorage(list)

// ----------------------------- Smoke Tests (UNCHANGED) ----------------------------------
if (typeof window !== 'undefined') {
  (function runSmokeTests() {
    try {
      console.group('%cIMCI App - Smoke Tests', 'font-weight:bold');
      console.assert(percent(3, 10) === '30.0 %', 'percent(3,10) should be 30.0 %');
      console.assert(fmtPct(NaN) === '—', 'fmtPct(NaN) should be dash');
      console.assert(Array.isArray(SKILLS_ETAT.triage) && SKILLS_ETAT.triage.length > 0, 'ETAT skills are present');
      console.log('%cAll smoke tests passed.', 'color:green');
    } catch (e) {
      console.error('Smoke tests failure:', e);
    } finally {
      console.groupEnd();
    }
  })();
}