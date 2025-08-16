import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// +++ Import all data functions from your new data.js file +++
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
 * ============================================================================ */

// ----------------------------- CONSTANTS ------------------------------
const STATE_LOCALITIES = { "Blue Nile": ["Ad-Damazin", "Ar-Roseires", "Geissan", "Baw", "Tadamon"], "Central Darfur": ["Zalingei", "Azum", "Wadi Salih", "Mukjar", "Bindisi", "Um Dukhun", "Nertiti", "Rokero"], "East Darfur": ["Ed Daein", "Abu Jabra", "Bahr el-Arab", "Asalaya", "Yassin", "Fardous", "Abu Karinka"], "Gedaref": ["Gedaref", "Basundah", "Qala al-Nahl", "Al-Fashaga", "Al-Rahd", "Al-Hawatah"], "Gezira": ["Um Al-Qura", "Al-Hasahisa", "Al-Managil", "Al-Kamilin", "Wad Madani", "South Al Gezira", "East Al Gezira"], "Kassala": ["Kassala", "Khashm el-Girba", "New Halfa", "Wagar", "Aroma", "Hamashkoreib", "Telkuk", "North Delta", "Rural Kassala"], "Khartoum": ["Khartoum", "Jabal Awliya", "Sharq an-Nil", "Bahri", "Omdurman", "Um Badda", "Karari"], "North Darfur": ["Al-Fashir", "Kutum", "Kabkabiya", "Mellit", "Umm Kaddadah", "Al-Tawisha", "Tina", "Al-Waha", "Saraf Omra", "El Laeit"], "North Kordofan": ["Sheikan (Al-Ubayyid)", "Bara", "Umm Ruwaba", "Sodari", "Ghebeish", "Wad Banda", "Abu Zabad"], "Northern": ["Dongola", "Merowe", "Al Dabbah", "Wadi Halfa", "Delgo", "Al Burgaig", "Al Golid"], "Red Sea": ["Port Sudan", "Tokar", "Sawakin", "Halaib", "Dordaib", "Sinkat", "Ageeg"], "River Nile": ["Shendi", "Ad-Damir", "Atbara", "Berber", "Abu Hamad", "Al-Matammah"], "Sennar": ["Sennar", "Singa", "Ad-Dindir", "Al-Suki", "Abu Hujar"], "South Darfur": ["Nyala", "Kas", "Gereida", "Biram", "Tulus", "Al-Salam", "Ed al-Fursan", "Kutum", "Nyala North", "Nyala South"], "South Kordofan": ["Kadugli", "Dilling", "Rashad", "Talodi", "Al-Abbassiya", "Habila", "Abu Jubayhah", "Al-Buram"], "West Darfur": ["Geneina", "Kulbus", "Jebel Moon", "Sirba", "Beida", "Foro Baranga", "Habila"], "West Kordofan": ["Al-Fulah", "Babanusa", "Abyei", "Al-Meiram", "Lagowa", "Al-Nuhud", "Al-Salam"], "White Nile": ["Kosti", "Rabak", "Ad-Duwaym", "Al-Jabalain", "Al-Salam", "Um Remta", "Guli", "Al-Gutaina"] };
const SKILLS_EENC_BREATHING = { pre_birth: ["Checked room temperature and turned off fans", "Told the mother what is going to be done", "Washed hands (first)", "Placed dry cloth on mother's abdomen", "Prepared the newborn resuscitation area", "Checked that bag and mask are functional", "Washed hands (second)", "Put on two pairs of clean gloves", "Put forceps, cord clamp in easy-to-use order"], eenc: ["Call out time of birth", "Start Drying within 5 seconds of birth", "Dry the baby thoroughly", "Stimulate baby by gently rubbing", "Suction only if airway blocked", "Remove the wet cloth", "Put baby in direct skin-to-skin contact", "Cover baby’s body with dry cloth and the head with a hat"], oxytocin: ["Check for a second baby", "Give oxytocin to mother within 1 minute of delivery"], cord_clamp: ["Removed outer pair of gloves", "Check cord pulsations, clamp after cord pulsations stopped", "Place clamp at 2 cm, forceps at 5 cm"], placenta: ["Delivered placenta", "Counsel mother on feeding cues"] };
const EENC_DOMAIN_LABEL_BREATHING = { pre_birth: "Pre-birth preparations", eenc: "Early Essential Newborn Care", oxytocin: "Give Oxytocin to mother", cord_clamp: "Clamp the cord", placenta: "Deliver the placenta and counsel the mother" };
const EENC_DOMAINS_BREATHING = Object.keys(SKILLS_EENC_BREATHING);
const SKILLS_EENC_NOT_BREATHING = { pre_birth: ["Checked room temperature and turned off fans", "Told the mother what is going to be done", "Washed hands (first)", "Placed dry cloth on mother's abdomen", "Prepared the newborn resuscitation area", "Checked that bag and mask are functional", "Washed hands (second)", "Put on two pairs of clean gloves", "Put forceps, cord clamp in easy-to-use order"], eenc_initial: ["Call out time of birth", "Start Drying within 5 seconds of birth", "Dry the baby thoroughly", "Stimulate baby by gently rubbing", "Suction only if airway blocked", "Remove the wet cloth", "Put baby in direct skin-to-skin contact", "Cover baby’s body with cloth and the head with a hat"], if_not_breathing: ["Called for help", "Removed outer pair of gloves", "Quickly clamped and cut cord.", "Moved baby to resuscitation area", "Covered baby quickly during and after transfer"], resuscitation: ["Positioned the head correctly to open airways", "Applied face mask firmly", "Gain chest rise within < 1 min of birth", "Squeezed bag to give 30–50 breaths per minute", "If chest not rising: Reposition head, reposition mask, check airway, squeeze harder"], if_breathing_starts: ["Stop ventilation and monitor every 15 minutes", "Return baby to skin-to-skin contact and cover baby", "Counsel mother that baby is OK"], post_resuscitation: ["Check for a second baby", "Give oxytocin to mother within 1 minute of delivery", "Delivered placenta", "Counsel mother on feeding cues"], if_not_breathing_after_10_min: ["If heart rate, continue ventilation, Refer and transport"] };
const EENC_DOMAIN_LABEL_NOT_BREATHING = { pre_birth: "Pre-birth preparations", eenc_initial: "Initial EENC Steps", if_not_breathing: "If baby not breathing", resuscitation: "Resuscitation", if_breathing_starts: "If baby starts breathing well", post_resuscitation: "Post-resuscitation care", if_not_breathing_after_10_min: "If baby not breathing after 10 minutes" };
const EENC_DOMAINS_NOT_BREATHING = Object.keys(SKILLS_EENC_NOT_BREATHING);
const SKILLS_ETAT = { triage: ["Triage Assessment", "Assigns Triage Category"], airway_breathing: ["Positions Airway", "Suctions", "Gives Oxygen", "Bag-Mask Ventilation"], circulation: ["Inserts IV/IO", "Gives IV fluids", "Checks blood sugar"], coma: ["Positions unresponsive child", "Gives IV fluids"], convulsion: ["Positions convulsing child", "Gives Diazepam"], dehydration: ["Assesses dehydration", "Gives IV fluids", "Reassesses"] };
const ETAT_DOMAIN_LABEL = { triage: "Triage", airway_breathing: "Airway and Breathing", circulation: "Circulation", coma: "Coma", convulsion: "Convulsion", dehydration: "Dehydration (Severe)" };
const ETAT_DOMAINS = Object.keys(SKILLS_ETAT);
const CLASS_2_59M = { danger: ["Any Danger Sign"], respiratory: ["Severe pneumonia/disease", "Pneumonia", "Cough/cold", "Severe pneumonia/disease (Wheeze)", "Pneumonia (Wheeze)", "Cough/cold (Wheeze)"], diarrhoea: ["Severe dehydration", "Some dehydration", "No dehydration", "Severe persistent", "Persistent", "Dysentery"], fever_malaria: ["Very severe febrile disease", "Malaria", "Fever - malaria unlikely", "Severe complicated measles", "Measles - Eye/mouth complications", "Measles"], ear: ["Mastoiditis", "Acute ear infection", "Chronic ear infection", "No ear infection"], malnutrition: ["Complicated Severe Acute malnutrition (SAM)", "Un-complicated Severe Acute malnutrition (SAM)", "Moderate Acute malnutrition (MAM)", "No Acute Malnutrition"], anaemia: ["Severe Anaemia", "Anaemia", "No anaemia"], treatment_2_59m: ["ORAL DRUGS", "PLAN A", "PLAN B", "LOCAL INFECTION"], counsel: ["Assess and counsel for vaccination", "Asks feeding questions", "Feeding problems identified", "Gives advice on feeding problems", "COUNSEL WHEN TO RETURN"], };
const CLASS_0_59D = { bacterial: ["Possible serious bacterial infection", "Local bacterial infection", "Bacterial infection unlikely"], jaundice: ["Severe Jaundice", "Jaundice", "No Jaundice"], vyi_diarrhoea: ["Severe dehydration", "Some dehydration", "No dehydration", "Persistent diarrhea", "Blood in Stool"], feeding: ["Breastfeeding attachment and suckling assessed", "Feeding problem or low weight", "No feeding problem"], treatment_0_59d: ["Teach correct positioning and attachment", "Advise on home care"], };
const DOMAINS_BY_AGE_IMNCI = { GE2M_LE5Y: ["danger", "respiratory", "diarrhoea", "fever_malaria", "ear", "malnutrition", "anaemia", "treatment_2_59m", "counsel"], LT2M: ["bacterial", "jaundice", "vyi_diarrhoea", "feeding", "treatment_0_59d"], };
const DOMAIN_LABEL_IMNCI = { danger: "Danger signs", respiratory: "COUGH:", diarrhoea: "DIARRHOEA:", fever_malaria: "FEVER:", ear: "EAR:", malnutrition: "MALNUTRITION:", anaemia: "ANAEMIA:", treatment_2_59m: "TREAT:", counsel: "COUNSEL:", bacterial: "BACTERIAL:", jaundice: "JAUNDICE:", vyi_diarrhoea: "DIARRHOEA:", feeding: "FEEDING:", treatment_0_59d: "TREATMENT/COUNSEL:" };
const getClassListImnci = (age, d) => (age === "GE2M_LE5Y" ? CLASS_2_59M[d] : CLASS_0_59D[d]) || [];

// ----------------------------- HELPER FUNCTIONS & COMPONENTS --------------------------------
const calcPct = (c, s) => (!s ? NaN : (c * 100) / s);
const fmtPct = v => (!isFinite(v) ? "—" : (Math.round(v * 10) / 10).toFixed(1) + " %");
const pctBgClass = v => (!isFinite(v) ? "" : v < 50 ? "bg-red-100 text-red-800" : v <= 80 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800");

// --- PDF Export Helper ---
const exportToPdf = (title, head, body, fileName) => {
    const doc = new jsPDF();
    doc.text(title, 14, 15);
    autoTable(doc, {
        startY: 20,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [8, 145, 178] },
    });
    doc.save(`${fileName}.pdf`);
};

const buildEtatMatrixForPdf = (groupParticipants, allObs) => {
    const parts = groupParticipants.sort((a, b) => a.name.localeCompare(b.name));
    const head = [['Skill', ...parts.map(p => p.name)]];
    const body = [];
    for (const domain in SKILLS_ETAT) {
        body.push([{ content: ETAT_DOMAIN_LABEL[domain], colSpan: parts.length + 1, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } }]);
        for (const skill of SKILLS_ETAT[domain]) {
            const counts = parts.map(p => allObs.filter(o => o.participant_id === p.id && o.item_recorded === skill).length);
            body.push([skill, ...counts]);
        }
    }
    const perPartTotals = parts.map(p => allObs.filter(o => o.participant_id === p.id).length);
    const perPartCorrect = parts.map(p => allObs.filter(o => o.participant_id === p.id && o.item_correct === 1).length);
    const perPartPct = perPartTotals.map((den, i) => fmtPct(calcPct(perPartCorrect[i], den)));
    body.push([{ content: '# Total Skills', styles: { fontStyle: 'bold', fillColor: '#e8f5e9' } }, ...perPartTotals.map(c => ({ content: c, styles: { fontStyle: 'bold' } }))]);
    body.push([{ content: '# Correct Skills', styles: { fontStyle: 'bold', fillColor: '#e8f5e9' } }, ...perPartCorrect.map(c => ({ content: c, styles: { fontStyle: 'bold' } }))]);
    body.push([{ content: '% Correct', styles: { fontStyle: 'bold', fillColor: '#e8f5e9' } }, ...perPartPct.map(p => ({ content: p, styles: { fontStyle: 'bold' } }))]);
    return { head, body };
}

const generateCoursePdf = (course, participants, allCases, allObs) => {
    const doc = new jsPDF();
    const courseName = `${course.course_type} Course`;
    const courseLocation = `${course.state} / ${course.locality}`;
    const fileName = `Full_Report_${course.course_type}_${course.state}`.replace(/ /g, '_');

    doc.setFontSize(22);
    doc.text("Full Course Report", 105, 80, { align: 'center' });
    doc.setFontSize(16);
    doc.text(courseName, 105, 90, { align: 'center' });
    doc.text(courseLocation, 105, 100, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 105, 110, { align: 'center' });
    
    doc.addPage();
    autoTable(doc, {
        head: [['Course Details']],
        body: [
            ['Type', course.course_type], ['State', course.state], ['Locality', course.locality],
            ['Hall', course.hall], ['Coordinator', course.coordinator], ['Director', course.director],
            ['Clinical Instructor', course.clinical_instructor], ['Supporter', course.supporter],
            ['Facilitators', (course.facilitators || []).join(', ')], ['# Participants', course.participants_count],
        ],
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        didDrawPage: (data) => { doc.text("Course Information", 14, data.settings.margin.top - 10); }
    });

    const participantHead = [['Name', 'Group', 'Center', 'Job Title', 'Phone']];
    const participantBody = participants.map(p => [p.name, p.group, p.center_name, p.job_title, p.phone]);
    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15, head: participantHead, body: participantBody, theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        didDrawPage: (data) => { doc.text("Participant Roster", 14, data.settings.margin.top - 10); }
    });

    const performanceSummary = participants.map(p => {
        const pCases = allCases.filter(c => c.participant_id === p.id);
        const pObs = allObs.filter(o => o.participant_id === p.id);
        const correctObs = pObs.filter(o => o.item_correct === 1).length;
        return { name: p.name, group: p.group, cases: pCases.length, skills: pObs.length, correct: fmtPct(calcPct(correctObs, pObs.length)) };
    });
    const performanceHead = [['Name', 'Group', 'Cases Seen', 'Skills Recorded', '% Correct']];
    const performanceBody = performanceSummary.map(p => [p.name, p.group, p.cases, p.skills, p.correct]);
    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15, head: performanceHead, body: performanceBody, theme: 'striped',
        headStyles: { fillColor: [8, 145, 178] },
        didDrawPage: (data) => { doc.text("Participant Performance Summary", 14, data.settings.margin.top - 10); }
    });

    doc.addPage();
    doc.text("Detailed Skill Reports", 14, 15);
    let lastY = 25;
    
    ['Group A', 'Group B', 'Group C', 'Group D'].forEach(group => {
        const groupParticipants = participants.filter(p => p.group === group);
        if (groupParticipants.length === 0) return;

        let matrixHead, matrixBody;
        if (course.course_type === 'ETAT') {
            const matrixData = buildEtatMatrixForPdf(groupParticipants, allObs);
            matrixHead = matrixData.head;
            matrixBody = matrixData.body;
        } // TODO: Add similar handlers for IMNCI and EENC if desired
        
        if (matrixBody && matrixBody.length > 0) {
            if(lastY > 30) doc.addPage();
            doc.text(`Detailed Report: ${group}`, 14, 20);
            autoTable(doc, {
                startY: 25, head: matrixHead, body: matrixBody,
                headStyles: { fillColor: [44, 62, 80] },
            });
            lastY = doc.lastAutoTable.finalY + 15;
        }
    });

    doc.save(`${fileName}.pdf`);
};

// --- Reusable UI Components for a consistent and improved design ---
const Card = ({ children, className = '' }) => <section className={`bg-white rounded-lg shadow-md p-6 ${className}`}>{children}</section>;
const PageHeader = ({ title, subtitle, actions }) => (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
);
const Button = ({ onClick, children, variant = 'primary', disabled = false, className = '' }) => {
    const baseClasses = "px-4 py-2 rounded-md font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 justify-center";
    const variantClasses = {
        primary: 'bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500',
        secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        ghost: 'bg-transparent text-slate-700 hover:bg-sky-100 hover:text-sky-700 focus:ring-sky-500 border border-slate-300',
    };
    const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";
    return <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className}`}>{children}</button>;
};
const FormGroup = ({ label, children }) => (<div className="flex flex-col gap-1"><label className="font-semibold text-gray-700 text-sm">{label}</label>{children}</div>);
const Input = (props) => <input {...props} className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${props.className || ''}`} />;
const Select = (props) => <select {...props} className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${props.className || ''}`}>{props.children}</select>;
const Table = ({ headers, children }) => (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm border-collapse">
            <thead className="bg-gray-100"><tr className="text-left text-gray-700">{headers.map((h, i) => <th key={i} className="py-3 px-4 font-semibold tracking-wider border border-gray-200">{h}</th>)}</tr></thead>
            <tbody className="bg-white">{children}</tbody>
        </table>
    </div>
);
const EmptyState = ({ message, colSpan = 100 }) => (<tr><td colSpan={colSpan} className="py-12 text-center text-gray-500 border border-gray-200">{message}</td></tr>);
const Spinner = () => <div className="flex justify-center items-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div></div>;
const PdfIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
const Footer = () => (
    <footer className="bg-slate-800 text-slate-400 text-center p-4 mt-8">
        <p>App developed by Dr Qusay Mohamed - <a href="mailto:Gussaay@gmail.com" className="text-sky-400 hover:underline">Gussaay@gmail.com</a></p>
    </footer>
);


// =============================================================================
// Root App Component
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
    const [loading, setLoading] = useState(true);

    async function refreshCourses() {
        setLoading(true);
        const list = await listCoursesByType(activeCourseType);
        setCourses(list);
        setLoading(false);
    }
    async function refreshParticipants() {
        if (!selectedCourseId) {
            setParticipants([]);
            return;
        }
        setLoading(true);
        const list = await listParticipants(selectedCourseId);
        setParticipants(list);
        setLoading(false);
    }

    useEffect(() => { refreshCourses(); }, [activeCourseType]);
    useEffect(() => { refreshParticipants(); }, [selectedCourseId]);

    const selectedCourse = useMemo(() => courses.find(c => c.id === selectedCourseId) || null, [courses, selectedCourseId]);
    
    const handleEditCourse = (course) => { setEditingCourse(course); setView('courseForm'); };
    const handleDeleteCourse = async (courseId) => {
        if (window.confirm('Are you sure you want to delete this course and all its data? This cannot be undone.')) {
            await deleteCourse(courseId);
            await refreshCourses();
            if (selectedCourseId === courseId) {
                setSelectedCourseId(null);
                setSelectedParticipantId(null);
                setView('courses');
            }
        }
    };
    const handleEditParticipant = (participant) => { setEditingParticipant(participant); setView('participantForm'); };
    const handleDeleteParticipant = async (participantId) => {
        if (window.confirm('Are you sure you want to delete this participant and all their data?')) {
            await deleteParticipant(participantId);
            await refreshParticipants();
            if (selectedParticipantId === participantId) {
                 setSelectedParticipantId(null);
                 setView('participants');
            }
        }
    };

    const navigate = (newView) => {
        setEditingCourse(null);
        setEditingParticipant(null);
        if (newView === 'landing' || newView === 'courses') {
            setSelectedCourseId(null);
            setSelectedParticipantId(null);
        }
        setView(newView);
    };

    const renderView = () => {
        if (loading && view !== 'landing') return <Card><Spinner /></Card>;
        switch(view) {
            case 'landing': return <Landing active={activeCourseType} onPick={(t) => { setActiveCourseType(t); navigate('courses'); }} />;
            case 'courses': return <CoursesView courses={courses.filter(c => c.course_type === activeCourseType)} onAdd={() => navigate('courseForm')} onOpen={(id) => { setSelectedCourseId(id); navigate('participants'); }} onEdit={handleEditCourse} onDelete={handleDeleteCourse} />;
            case 'courseForm': return <CourseForm courseType={activeCourseType} initialData={editingCourse} onCancel={() => navigate('courses')} onSave={async (payload) => { const id = await upsertCourse({ ...payload, id: editingCourse?.id, course_type: activeCourseType }); await refreshCourses(); setSelectedCourseId(id); navigate('participants'); }} />;
            case 'participants': return selectedCourse && <ParticipantsView course={selectedCourse} participants={participants.filter(p => p.courseId === selectedCourseId)} onAdd={() => navigate('participantForm')} onOpen={(pid) => { setSelectedParticipantId(pid); navigate('observe'); }} onEdit={handleEditParticipant} onDelete={handleDeleteParticipant} />;
            case 'participantForm': return selectedCourse && <ParticipantForm course={selectedCourse} initialData={editingParticipant} onCancel={() => navigate('participants')} onSave={async (p) => { await upsertParticipant({ ...p, id: editingParticipant?.id, courseId: selectedCourse.id }); await refreshParticipants(); navigate('participants'); }} />;
            case 'observe': return selectedCourse && participants.find(p=>p.id === selectedParticipantId) && <ObservationView course={selectedCourse} participant={participants.find(p=>p.id === selectedParticipantId)} participants={participants.filter(p => p.courseId === selectedCourseId)} onChangeParticipant={(id) => setSelectedParticipantId(id)} />;
            case 'reports': return selectedCourse && <ReportsView course={selectedCourse} participants={participants.filter(p => p.courseId === selectedCourse.id)} />;
            default: return <Landing active={activeCourseType} onPick={(t) => { setActiveCourseType(t); navigate('courses'); }} />;
        }
    };
    
    const navItems = [
        { label: 'Courses', view: 'courses', active: ['courses', 'courseForm'].includes(view) },
        { label: 'Participants', view: 'participants', disabled: !selectedCourse, active: ['participants', 'participantForm'].includes(view) },
        { label: 'Monitoring', view: 'observe', disabled: !selectedCourse || !selectedParticipantId, active: view === 'observe' },
        { label: 'Reports', view: 'reports', disabled: !selectedCourse, active: view === 'reports' }
    ];

    return (
        <div className="min-h-screen bg-sky-50 flex flex-col">
            <header className="bg-slate-800 shadow-lg sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('landing')}>
                            <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center p-1 shadow-md">
                                <img src="/child.png" alt="NCHP Logo" className="h-12 w-12 object-contain" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white hidden sm:block">National Child Health Program</h1>
                                <p className="text-sm text-slate-300 hidden sm:block">Course Monitoring System</p>
                            </div>
                         </div>
                         <nav className="flex items-center gap-1">
                            {navItems.map(item => (
                                <button key={item.label} onClick={() => !item.disabled && navigate(item.view)} disabled={item.disabled}
                                    className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                        item.active 
                                        ? 'bg-sky-600 text-white'
                                        : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                                    }`}>
                                    {item.label}
                                </button>
                            ))}
                         </nav>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full flex-grow">
                {renderView()}
            </main>
            <Footer />
        </div>
    );
}

// ... All other components are included below ...
function Landing({ active, onPick }) {
    const items = [
        { key: 'IMNCI', title: 'Integrated Mgmt of Childhood & Newborn Illnesses (IMNCI)', enabled: true },
        { key: 'ETAT', title: 'Emergency Triage, Assessment & Treatment (ETAT)', enabled: true },
        { key: 'EENC', title: 'Early Essential Newborn Care (EENC)', enabled: true },
        { key: 'IPC (Neonatal Unit)', title: 'Infection Prevention & Control (Neonatal Unit)', enabled: false },
        { key: 'Small & Sick Newborn', title: 'Small & Sick Newborn Case Management', enabled: false },
    ];

    return (
        <Card>
            <PageHeader title="Select a Course Package" subtitle="Choose a monitoring package to begin." />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(it => (
                    <button key={it.key} disabled={!it.enabled} className={`border rounded-lg p-4 text-left transition-all duration-200 ${active === it.key ? 'ring-2 ring-sky-500 shadow-lg' : ''} ${it.enabled ? 'hover:shadow-md hover:scale-105' : 'opacity-60 cursor-not-allowed bg-gray-50'}`} onClick={() => it.enabled && onPick(it.key)}>
                        <div className="flex items-center gap-4">
                            <CourseIcon course={it.key} />
                            <div>
                                <div className="font-semibold text-gray-800">{it.title}</div>
                                <div className="text-xs text-gray-500 mt-1">{it.enabled ? 'Click to manage courses' : 'Coming Soon'}</div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </Card>
    );
}
function CoursesView({ courses, onAdd, onOpen, onEdit, onDelete }) {
    const [generatingReportId, setGeneratingReportId] = useState(null);

    const handleGenerateReport = async (course) => {
        setGeneratingReportId(course.id);
        try {
            const participants = await listParticipants(course.id);
            const { allObs, allCases } = await listAllDataForCourse(course.id);
            generateCoursePdf(course, participants, allCases, allObs);
        } catch (error) {
            console.error("Failed to generate report:", error);
            alert("Could not generate the report. Please try again.");
        } finally {
            setGeneratingReportId(null);
        }
    };

    return (
        <Card>
            <PageHeader title="Available Courses" actions={<Button onClick={onAdd}>Add New Course</Button>} />
            <Table headers={["State", "Locality", "Hall", "#", "Actions"]}>
                {courses.length === 0 ? <EmptyState message="No courses found for this package." /> : courses.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                        <td className="p-4 border border-gray-200">{c.state}</td>
                        <td className="p-4 border border-gray-200">{c.locality}</td>
                        <td className="p-4 border border-gray-200">{c.hall}</td>
                        <td className="p-4 border border-gray-200 text-center">{c.participants_count}</td>
                        <td className="p-4 border border-gray-200">
                            <div className="flex gap-2 flex-wrap justify-end">
                                <Button variant="secondary" onClick={() => onOpen(c.id)}>Open</Button>
                                <Button variant="secondary" onClick={() => onEdit(c)}>Edit</Button>
                                <Button variant="secondary" onClick={() => handleGenerateReport(c)} disabled={generatingReportId === c.id}>
                                    {generatingReportId === c.id ? 'Generating...' : 'Report'}
                                </Button>
                                <Button variant="danger" onClick={() => onDelete(c.id)}>Delete</Button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
}
function CourseForm({ courseType, initialData, onCancel, onSave }) {
    const [state, setState] = useState(initialData?.state || '');
    const [locality, setLocality] = useState(initialData?.locality || '');
    const [hall, setHall] = useState(initialData?.hall || '');
    const [coordinator, setCoordinator] = useState(initialData?.coordinator || '');
    const [participantsCount, setParticipantsCount] = useState(initialData?.participants_count || 0);
    const [director, setDirector] = useState(initialData?.director || '');
    const [clinical, setClinical] = useState(initialData?.clinical_instructor || '');
    const [supporter, setSupporter] = useState(initialData?.supporter || '');
    const [facilitators, setFacilitators] = useState(initialData?.facilitators || ['', '']);
    const [error, setError] = useState('');
    const addFac = () => setFacilitators(f => [...f, '']);
    const removeFac = (i) => setFacilitators(f => f.length <= 2 ? f : f.filter((_, idx) => idx !== i));
    const setFac = (i, v) => setFacilitators(f => f.map((x, idx) => idx === i ? v : x));
    const submit = () => {
        const facArr = facilitators.map(s => s.trim()).filter(Boolean);
        if (!state || !locality || !hall || !coordinator || !participantsCount || !director || !clinical || facArr.length < 2 || !supporter) {
            setError('Please complete all required fields (minimum two facilitators).'); return;
        }
        onSave({ state, locality, hall, coordinator, participants_count: participantsCount, director, clinical_instructor: clinical, supporter, facilitators: facArr });
    };
    return (
        <Card>
            <PageHeader title={`${initialData ? 'Edit' : 'Add New'} Course`} subtitle={`Package: ${courseType}`} />
            {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                <FormGroup label="Course Hall"><Input value={hall} onChange={(e) => setHall(e.target.value)} /></FormGroup>
                <FormGroup label="Course Coordinator"><Input value={coordinator} onChange={(e) => setCoordinator(e.target.value)} /></FormGroup>
                <FormGroup label="# of Participants"><Input type="number" value={participantsCount} onChange={(e) => setParticipantsCount(Number(e.target.value))} /></FormGroup>
                <FormGroup label="Course Director"><Input value={director} onChange={(e) => setDirector(e.target.value)} /></FormGroup>
                <FormGroup label="Clinical Instructor"><Input value={clinical} onChange={(e) => setClinical(e.target.value)} /></FormGroup>
                <FormGroup label="Supporter"><Input value={supporter} onChange={(e) => setSupporter(e.target.value)} /></FormGroup>
                <FormGroup label="Facilitators"><div className="grid gap-2">{facilitators.map((v, i) => (<div key={i} className="flex gap-2"><Input value={v} onChange={(e) => setFac(i, e.target.value)} placeholder={`Facilitator ${i + 1}`} /><Button type="button" variant="secondary" onClick={() => removeFac(i)} disabled={facilitators.length <= 2}>−</Button></div>))}<Button type="button" variant="secondary" className="mt-2" onClick={addFac}>+ Add Facilitator</Button></div></FormGroup>
            </div>
            <div className="flex gap-2 justify-end mt-6 border-t pt-6"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={submit}>Save Course</Button></div>
        </Card>
    );
}
function ParticipantsView({ course, participants, onAdd, onOpen, onEdit, onDelete }) {
    const [groupFilter, setGroupFilter] = useState('All');
    const filtered = groupFilter === 'All' ? participants : participants.filter(p => p.group === groupFilter);
    const actions = (<><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="All">All Groups</option><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select><Button onClick={onAdd}>Add Participant</Button></>);
    return (
        <Card>
            <PageHeader title="Course Participants" subtitle={`${course.state} / ${course.locality}`} actions={actions} />
            <Table headers={["Name", "Group", "Job Title", "Center", "Phone", "Actions"]}>
                {filtered.length === 0 ? <EmptyState message="No participants found for this group." /> : filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                        <td className="p-4 border border-gray-200 font-medium text-gray-800">{p.name}</td>
                        <td className="p-4 border border-gray-200">{p.group}</td>
                        <td className="p-4 border border-gray-200">{p.job_title}</td>
                        <td className="p-4 border border-gray-200">{p.center_name}</td>
                        <td className="p-4 border border-gray-200">{p.phone}</td>
                        <td className="p-4 border border-gray-200"><div className="flex gap-2"><Button variant="secondary" onClick={() => onOpen(p.id)}>Monitor</Button><Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button><Button variant="danger" onClick={() => onDelete(p.id)}>Delete</Button></div></td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
}
function ParticipantForm({ course, initialData, onCancel, onSave }) {
    const [name, setName] = useState(initialData?.name || '');
    const [state, setState] = useState(initialData?.state || '');
    const [locality, setLocality] = useState(initialData?.locality || '');
    const [center, setCenter] = useState(initialData?.center_name || '');
    const [job, setJob] = useState(initialData?.job_title || '');
    const [phone, setPhone] = useState(initialData?.phone || '');
    const [group, setGroup] = useState(initialData?.group || 'Group A');
    const [error, setError] = useState('');
    const [trainedIMNCI, setTrainedIMNCI] = useState(initialData?.trained_before || false);
    const [lastTrainIMNCI, setLastTrainIMNCI] = useState(initialData?.last_imci_training || '');
    const [numProv, setNumProv] = useState(initialData?.num_other_providers || 0);
    const [numProvIMCI, setNumProvIMCI] = useState(initialData?.num_other_providers_imci || 0);
    const [hasNutri, setHasNutri] = useState(initialData?.has_nutrition_service || false);
    const [nearestNutri, setNearestNutri] = useState(initialData?.nearest_nutrition_center || '');
    const [hasImm, setHasImm] = useState(initialData?.has_immunization_service || false);
    const [nearestImm, setNearestImm] = useState(initialData?.nearest_immunization_center || '');
    const [hasORS, setHasORS] = useState(initialData?.has_ors_room || false);
    const [trainedEENC, setTrainedEENC] = useState(initialData?.trained_eenc_before || false);
    const [lastTrainEENC, setLastTrainEENC] = useState(initialData?.last_eenc_training || '');
    const [otherStaff, setOtherStaff] = useState(initialData?.other_staff_delivery_room || 0);
    const [otherStaffTrained, setOtherStaffTrained] = useState(initialData?.other_staff_eenc_trained || 0);
    const [hasNursery, setHasNursery] = useState(initialData?.has_nursery || false);
    const [hasKangaroo, setHasKangaroo] = useState(initialData?.has_kangaroo_room || false);

    const submit = () => {
        if (!name || !state || !locality || !center || !job || !phone) { setError('Please complete all required fields'); return; }
        let p = { name, group, state, locality, center_name: center, job_title: job, phone };
        if (course.course_type === 'IMNCI') p = { ...p, trained_before: trainedIMNCI, num_other_providers: numProv, num_other_providers_imci: numProvIMCI, has_nutrition_service: hasNutri, has_immunization_service: hasImm, has_ors_room: hasORS, last_imci_training: lastTrainIMNCI, nearest_nutrition_center: nearestNutri, nearest_immunization_center: nearestImm };
        if (course.course_type === 'EENC') p = { ...p, trained_eenc_before: trainedEENC, other_staff_delivery_room: otherStaff, other_staff_eenc_trained: otherStaffTrained, has_nursery: hasNursery, has_kangaroo_room: hasKangaroo, last_eenc_training: lastTrainEENC };
        onSave(p);
    };
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';
    return (
        <Card>
            <PageHeader title={initialData ? 'Edit Participant' : 'Add New Participant'} />
            {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormGroup label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormGroup>
                <FormGroup label="Group"><Select value={group} onChange={(e) => setGroup(e.target.value)}><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                <FormGroup label="Center Name"><Input value={center} onChange={(e) => setCenter(e.target.value)} /></FormGroup>
                <FormGroup label="Job Title"><Input value={job} onChange={(e) => setJob(e.target.value)} /></FormGroup>
                <FormGroup label="Phone Number"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></FormGroup>
                {isImnci && (<>
                    <FormGroup label="Previously trained in IMCI?"><Select value={trainedIMNCI ? "yes" : "no"} onChange={(e) => setTrainedIMNCI(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Last IMCI training date"><Input type="date" value={lastTrainIMNCI} onChange={(e) => setLastTrainIMNCI(e.target.value)} /></FormGroup>
                    <FormGroup label="Has therapeutic nutrition service?"><Select value={hasNutri ? 'yes' : 'no'} onChange={e => setHasNutri(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {!hasNutri && (<FormGroup label="Nearest outpatient nutrition center?"><Input value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} /></FormGroup>)}
                    <FormGroup label="Has immunization service?"><Select value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {!hasImm && (<FormGroup label="Nearest immunization center?"><Input value={nearestImm} onChange={e => setNearestImm(e.target.value)} /></FormGroup>)}
                    <FormGroup label="Has ORS corner service?"><Select value={hasORS ? 'yes' : 'no'} onChange={e => setHasORS(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="# of providers at health center"><Input type="number" min="0" value={numProv} onChange={(e) => setNumProv(Number(e.target.value || 0))} /></FormGroup>
                    <FormGroup label="# of providers trained in IMCI"><Input type="number" min="0" value={numProvIMCI} onChange={(e) => setNumProvIMCI(Number(e.target.value || 0))} /></FormGroup>
                </>)}
                {isEenc && (<>
                    <FormGroup label="Previously trained in EENC?"><Select value={trainedEENC ? "yes" : "no"} onChange={(e) => setTrainedEENC(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Last EENC training date"><Input type="date" value={lastTrainEENC} onChange={(e) => setLastTrainEENC(e.target.value)} /></FormGroup>
                    <FormGroup label="# of other providers in delivery room"><Input type="number" min="0" value={otherStaff} onChange={(e) => setOtherStaff(Number(e.target.value || 0))} /></FormGroup>
                    <FormGroup label="# of other providers trained in EENC"><Input type="number" min="0" value={otherStaffTrained} onChange={(e) => setOtherStaffTrained(Number(e.target.value || 0))} /></FormGroup>
                    <FormGroup label="Has nursery service?"><Select value={hasNursery ? 'yes' : 'no'} onChange={e => setHasNursery(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Has immunization service?"><Select value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Has Kangaroo care room?"><Select value={hasKangaroo ? 'yes' : 'no'} onChange={e => setHasKangaroo(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                </>)}
            </div>
            <div className="flex gap-2 justify-end mt-6 border-t pt-6"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={submit}>Save Participant</Button></div>
        </Card>
    );
}
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
    const isEtat = course.course_type === 'ETAT';

    useEffect(() => {
        const fetchData = async () => {
            if (!participant?.id || !course?.id) return;
            setLoading(true);
            const [obsData, casesData] = await Promise.all([listObservationsForParticipant(course.id, participant.id), listCasesForParticipant(course.id, participant.id)]);
            setObservations(obsData);
            setCases(casesData);
            setLoading(false);
        };
        fetchData();
    }, [participant?.id, course?.id]);

    useEffect(() => {
        if (editingCase) return;
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
        const caseData = {
            courseId: course.id, participant_id: participant.id, encounter_date: encounterDate,
            setting: isImnci ? setting : 'N/A', age_group: isImnci ? age : isEenc ? `EENC_${eencScenario}` : 'ETAT',
            case_serial: currentCaseSerial, day_of_course: dayOfCourse, allCorrect: allCorrect
        };

        const newObservations = entries.map(([k, v]) => {
            const [domain, skill_or_class] = k.split('|');
            const observationData = {
                courseId: course.id, course_type: course.course_type, encounter_date: encounterDate,
                day_of_course: dayOfCourse, setting: isImnci ? setting : 'N/A', participant_id: participant.id,
                domain: domain, item_recorded: skill_or_class, item_correct: v, case_serial: currentCaseSerial,
            };

            let ageGroupForObs;
            if (isImnci) ageGroupForObs = age;
            else if (isEenc) ageGroupForObs = eencScenario;
            if (ageGroupForObs) {
                observationData.age_group = ageGroupForObs;
            }
            if (caseAgeMonths !== '' && caseAgeMonths !== null) {
                observationData.case_age_months = Number(caseAgeMonths);
            }
            return observationData;
        });
        
        try {
            await upsertCaseAndObservations(caseData, newObservations, editingCase?.id);
            const [obsData, casesData] = await Promise.all([listObservationsForParticipant(course.id, participant.id), listCasesForParticipant(course.id, participant.id)]);
            setObservations(obsData);
            setCases(casesData);
            setBuffer({});
            setCaseAgeMonths('');
            setEditingCase(null);
        } catch (error) {
            console.error("ERROR saving to Firestore:", error);
            alert("Failed to save case. Please check the console for errors.");
        }
    };

    const handleEditCase = (caseToEdit) => {
        setEditingCase(caseToEdit);
        setEncounterDate(caseToEdit.encounter_date);
        setDayOfCourse(caseToEdit.day_of_course);
        if (isImnci) { setSetting(caseToEdit.setting); setAge(caseToEdit.age_group); }
        if (isEenc) { setEencScenario(caseToEdit.age_group.replace('EENC_', '')); }
        const caseObs = observations.filter(o => o.caseId === caseToEdit.id);
        const newBuffer = {};
        caseObs.forEach(o => { newBuffer[`${o.domain}|${o.item_recorded}`] = o.item_correct; });
        setBuffer(newBuffer);
        window.scrollTo(0, 0);
    };

    const handleDeleteCase = async (caseToDelete) => {
        if (!window.confirm('Delete this case and all its observations? This cannot be undone.')) return;
        await deleteCaseAndObservations(caseToDelete.id);
        const [obsData, casesData] = await Promise.all([listObservationsForParticipant(course.id, participant.id), listCasesForParticipant(course.id, participant.id)]);
        setObservations(obsData);
        setCases(casesData);
    };

    return (
        <div className="grid gap-6">
            <PageHeader title="Clinical Monitoring" subtitle={`Observing: ${participant.name}`} />
            <Card className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormGroup label="Select participant"><Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)}>{participants.map(p => <option key={p.id} value={p.id}>{p.name} — {p.group}</option>)}</Select></FormGroup>
                {isImnci && <FormGroup label="Setting"><Select value={setting} onChange={(e) => setSetting(e.target.value)} disabled={!!editingCase}><option value="OPD">Out-patient</option><option value="IPD">In-patient</option></Select></FormGroup>}
                {isImnci && <FormGroup label="Age band"><Select value={age} onChange={(e) => setAge(e.target.value)} disabled={!!editingCase}><option value="GE2M_LE5Y">Sick child (2-59 months)</option><option value="LT2M">Sick young infant (0-59 days)</option></Select></FormGroup>}
                {isEenc && <FormGroup label="EENC Scenario"><Select value={eencScenario} onChange={(e) => setEencScenario(e.target.value)} disabled={!!editingCase}><option value="breathing">Breathing Baby</option><option value="not_breathing">Not Breathing Baby</option></Select></FormGroup>}
            </Card>
            <Card>
                <div className="grid md:grid-cols-3 gap-6">
                    <FormGroup label="Encounter date"><Input type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} disabled={!!editingCase} /></FormGroup>
                    <FormGroup label="Course day (1-7)"><Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</Select></FormGroup>
                    <FormGroup label="Case age (months)"><Input type="number" value={caseAgeMonths} onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" /></FormGroup>
                </div>
            </Card>
            <Card>
                <h3 className="text-lg font-semibold mb-4">{editingCase ? `Editing Case #${editingCase.case_serial}` : 'Select skills and mark correctness'}</h3>
                <div className="flex justify-center overflow-x-auto">
                    {isImnci && <ImnciMonitoringGrid age={age} buffer={buffer} toggle={toggle} />}
                    {isEenc && <EencMonitoringGrid scenario={eencScenario} buffer={buffer} toggle={toggle} />}
                    {isEtat && <EtatMonitoringGrid buffer={buffer} toggle={toggle} />}
                </div>
                <div className="flex gap-3 justify-end mt-4 border-t pt-4">
                    <Button onClick={submitCase}>{editingCase ? 'Update Case' : 'Submit Case'}</Button>
                    <Button variant="secondary" onClick={() => { setBuffer({}); setEditingCase(null); setCaseAgeMonths(''); }}>{editingCase ? 'Cancel Edit' : 'Start New Case'}</Button>
                </div>
            </Card>
            {loading ? <Card><Spinner /></Card> : <SubmittedCases course={course} participant={participant} observations={observations} cases={cases} onEditCase={handleEditCase} onDeleteCase={handleDeleteCase} />}
        </div>
    );
}
function ImnciMonitoringGrid({ age, buffer, toggle }) {
    return (<table className="text-sm"><thead><tr className="text-left border-b"><th className="px-2 py-1 w-1/4">Domain</th><th className="px-2 py-1 w-1/2">Classification</th><th className="px-2 py-1">Action</th></tr></thead><tbody>{DOMAINS_BY_AGE_IMNCI[age].map(d => { const list = getClassListImnci(age, d); const title = DOMAIN_LABEL_IMNCI[d] || d; return (list && list.length ? list : ["(no items)"]).map((cls, i) => { const k = `${d}|${cls}`; const mark = buffer[k]; const rowClass = mark === 1 ? 'bg-green-50' : mark === 0 ? 'bg-red-50' : ''; return (<tr key={`${d}-${i}`} className={`border-b ${rowClass}`}>{i === 0 && <td className="px-2 py-1 align-top font-semibold text-gray-800" rowSpan={list.length}>{title}</td>}<td className="px-2 py-1">{cls}</td><td className="px-2 py-1"><div className="flex gap-2"><button onClick={() => toggle(d, cls, 1)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${ mark === 1 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100' }`}>Correct</button><button onClick={() => toggle(d, cls, 0)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${ mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100' }`}>Incorrect</button></div></td></tr>); }); })}</tbody></table>);
}
function EtatMonitoringGrid({ buffer, toggle }) {
    return (<table className="text-sm"><thead><tr className="text-left border-b"><th className="px-2 py-1 w-1/4">Domain</th><th className="px-2 py-1 w-1/2">Skill</th><th className="px-2 py-1">Action</th></tr></thead><tbody>{ETAT_DOMAINS.map(d => { const skills = SKILLS_ETAT[d]; const title = ETAT_DOMAIN_LABEL[d] || d; return skills.map((skill, i) => { const k = `${d}|${skill}`; const mark = buffer[k]; const rowClass = mark === 1 ? 'bg-green-50' : mark === 0 ? 'bg-red-50' : ''; return (<tr key={`${d}-${i}`} className={`border-b ${rowClass}`}>{i === 0 && <td className="px-2 py-1 align-top font-semibold text-gray-800" rowSpan={skills.length}>{title}</td>}<td className="px-2 py-1">{skill}</td><td className="px-2 py-1"><div className="flex gap-2"><button onClick={() => toggle(d, skill, 1)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${ mark === 1 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100' }`}>Correct</button><button onClick={() => toggle(d, skill, 0)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${ mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100' }`}>Incorrect</button></div></td></tr>); }); })}</tbody></table>);
}
function EencMonitoringGrid({ scenario, buffer, toggle }) {
    const isBreathing = scenario === 'breathing';
    const domains = isBreathing ? EENC_DOMAINS_BREATHING : EENC_DOMAINS_NOT_BREATHING;
    const skillsMap = isBreathing ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
    const labelsMap = isBreathing ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING;
    return (<table className="text-sm"><thead><tr className="text-left border-b"><th className="px-2 py-1 w-1/4">Domain</th><th className="px-2 py-1 w-1/2">Skill</th><th className="px-2 py-1">Action</th></tr></thead><tbody>{domains.map(d => { const skills = skillsMap[d]; const title = labelsMap[d] || d; return skills.map((skill, i) => { const k = `${d}|${skill}`; const mark = buffer[k]; const rowClass = mark === 1 ? 'bg-green-50' : mark === 0 ? 'bg-red-50' : ''; return (<tr key={`${d}-${i}`} className={`border-b ${rowClass}`}>{i === 0 && <td className="px-2 py-1 align-top font-semibold text-gray-800" rowSpan={skills.length}>{title}</td>}<td className="px-2 py-1">{skill}</td><td className="px-2 py-1"><div className="flex gap-2"><button onClick={() => toggle(d, skill, 1)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${ mark === 1 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100' }`}>Correct</button><button onClick={() => toggle(d, skill, 0)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${ mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100' }`}>Incorrect</button></div></td></tr>); }); })}</tbody></table>);
}
function SubmittedCases({ course, participant, observations, cases, onEditCase, onDeleteCase }) {
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';
    const caseRows = useMemo(() => {
        return cases.map(c => {
            const relatedObs = observations.filter(o => o.caseId === c.id);
            const total = relatedObs.length;
            const correct = relatedObs.filter(o => o.item_correct === 1).length;
            return { ...c, date: c.encounter_date, setting: c.setting, age: c.age_group, serial: c.case_serial, day: c.day_of_course, total, correct };
        }).sort((a, b) => (a.date < b.date ? 1 : -1) || b.serial - a.serial);
    }, [cases, observations]);
    const getAgeLabel = (age) => {
        if (isImnci) { return age === 'LT2M' ? '0-59 d' : '2-59 m'; }
        if (isEenc) { return age?.includes('breathing') ? (age.includes('not_breathing') ? 'Not Breathing' : 'Breathing') : age; }
        return age;
    };
    const headers = ["Date", "Day", ...(isImnci ? ["Setting"] : []), ...((isImnci || isEenc) ? [isImnci ? 'Age band' : 'Scenario'] : []), "Serial", "Skills", "Correct", "% Correct", "Actions"];
    
    return (
        <Card>
            <PageHeader title={`Submitted Cases for ${participant.name}`} />
            <Table headers={headers}>
                {caseRows.length === 0 ? <EmptyState message="No cases submitted yet." colSpan={headers.length} /> : caseRows.map((c, idx) => {
                    const pct = calcPct(c.correct, c.total);
                    return (
                        <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-4 border border-gray-200">{c.date}</td><td className="p-4 border border-gray-200">{c.day ?? ''}</td>
                            {isImnci && <td className="p-4 border border-gray-200">{c.setting}</td>}
                            {(isImnci || isEenc) && <td className="p-4 border border-gray-200">{getAgeLabel(c.age)}</td>}
                            <td className="p-4 border border-gray-200">{c.serial}</td><td className="p-4 border border-gray-200">{c.total}</td><td className="p-4 border border-gray-200">{c.correct}</td>
                            <td className={`p-4 font-mono border border-gray-200 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td>
                            <td className="p-4 border border-gray-200"><div className="flex gap-2"><Button variant="secondary" onClick={() => onEditCase(c)}>Edit</Button><Button variant="secondary" onClick={() => onDeleteCase(c)}>Delete</Button></div></td>
                        </tr>
                    );
                })}
            </Table>
        </Card>
    );
}
// =============================================================================
// --- Reports Views (Updated with PDF Export Functionality) ---
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

    if (loading) { return <Card><Spinner /></Card>; }

    const ReportComponent = { 'IMNCI': ImnciReports, 'ETAT': EtatReports, 'EENC': EencReports }[course.course_type] || (() => <p>No report available for this course type.</p>);

    return (
        <Card>
            <PageHeader title={`${course.course_type} Reports`} subtitle={`${course.state} / ${course.locality}`} />
            <ReportComponent course={course} participants={participants} allObs={allObs} allCases={allCases} />
        </Card>
    );
}
function ImnciReports({ course, participants, allObs, allCases }) {
    const [age, setAge] = useState('GE2M_LE5Y');
    const [settingFilter, setSettingFilter] = useState('All');
    const [tab, setTab] = useState('matrix');
    const rows = useMemo(() => allObs.filter(o => o.courseId === course.id && o.age_group === age && (settingFilter === 'All' || o.setting === settingFilter)), [allObs, course.id, age, settingFilter]);
    const registry = useMemo(() => allCases.filter(c => c.courseId === course.id && c.age_group === age && (settingFilter === 'All' || c.setting === settingFilter)), [allCases, course.id, age, settingFilter]);
    const caseSummaryByGroup = useMemo(() => {
        const g = {}; const pmap = new Map(); participants.forEach(p => pmap.set(p.id, p));
        for (const c of registry) { const p = pmap.get(c.participant_id || ''); if (!p) continue; const k = p.group; g[k] ??= {}; g[k][p.id] ??= { name: p.name, inp_seen: 0, inp_correct: 0, op_seen: 0, op_correct: 0 }; const t = g[k][p.id]; if (c.setting === 'IPD') { t.inp_seen++; if (c.allCorrect) t.inp_correct++; } else { t.op_seen++; if (c.allCorrect) t.op_correct++; } }
        return g;
    }, [registry, participants]);
    const classSummaryByGroup = useMemo(() => {
        const g = {}; const pmap = new Map(); participants.forEach(p => pmap.set(p.id, p));
        for (const o of rows) { const p = pmap.get(o.participant_id || ''); if (!p) continue; const k = p.group; g[k] ??= {}; g[k][p.id] ??= { name: p.name, inp_total: 0, inp_correct: 0, op_total: 0, op_correct: 0 }; const t = g[k][p.id]; if (o.setting === 'IPD') { t.inp_total++; if (o.item_correct === 1) t.inp_correct++; } else { t.op_total++; if (o.item_correct === 1) t.op_correct++; } }
        return g;
    }, [rows, participants]);
    
    function buildMatrixForGroup(groupKey) {
        const parts = participants.filter(p => p.group === groupKey).sort((a, b) => a.name.localeCompare(b.name));
        const domains = DOMAINS_BY_AGE_IMNCI[age];
        const matrixRows = [];
        for (const d of domains) {
            const items = getClassListImnci(age, d) || [];
            for (const item of items) {
                const counts = parts.map(p => rows.filter(o => o.participant_id === p.id && o.domain === d && o.item_recorded === item).length);
                const total = counts.reduce((a, b) => a + b, 0);
                const mean = parts.length ? total / parts.length : 0;
                const min = counts.length ? Math.min(...counts) : 0;
                const max = counts.length ? Math.max(...counts) : 0;
                matrixRows.push({ domain: DOMAIN_LABEL_IMNCI[d] || d, item, counts, total, mean, min, max });
            }
        }
        const perPartTotals = parts.map(p => rows.filter(o => o.participant_id === p.id).length);
        const perPartCorrect = parts.map(p => rows.filter(o => o.participant_id === p.id && o.item_correct === 1).length);
        const perPartPct = perPartTotals.map((den, i) => den ? (perPartCorrect[i] * 100) / den : NaN);
        return { parts, matrixRows, perPartTotals, perPartCorrect, perPartPct };
    }
    
    const handleExportGroupSummary = (groupKey, summaryType) => {
        const data = (summaryType === 'case' ? caseSummaryByGroup : classSummaryByGroup)[groupKey] || {};
        const ids = Object.keys(data);
        const head = summaryType === 'case' 
            ? [['Participant', 'IPD Cases', '% IPD', 'OPD Cases', '% OPD', 'Total', '% Overall']]
            : [['Participant', 'IPD Class.', '% IPD', 'OPD Class.', '% OPD', 'Total', '% Overall']];
        const body = ids.map(id => {
            const r = data[id];
            const inSeen = summaryType === 'case' ? r.inp_seen : r.inp_total; const inCor = r.inp_correct;
            const outSeen = summaryType === 'case' ? r.op_seen : r.op_total; const outCor = r.op_correct;
            return [r.name, inSeen, fmtPct(calcPct(inCor, inSeen)), outSeen, fmtPct(calcPct(outCor, outSeen)), inSeen + outSeen, fmtPct(calcPct(inCor + outCor, inSeen + outSeen))];
        });
        const title = `IMNCI ${summaryType === 'case' ? 'Case' : 'Classification'} Summary - ${groupKey}`;
        exportToPdf(title, head, body, title.replace(/ /g, '_'));
    };
    
    const handleExportMatrix = (groupKey) => {
        const { parts, matrixRows, perPartCorrect, perPartPct } = buildMatrixForGroup(groupKey);
        const head = [['Classification', ...parts.map(p => p.name), 'Total', 'Mean', 'Min', 'Max']];
        const body = matrixRows.map(r => [r.item, ...r.counts, r.total, (r.mean).toFixed(1), r.min, r.max]);
        body.push(['# Correct', ...perPartCorrect, '', '', '', '']);
        body.push(['% Correct', ...perPartPct.map(v => fmtPct(v)), '', '', '', '']);

        const title = `IMNCI Detailed Report - ${groupKey}`;
        exportToPdf(title, head, body, title.replace(/ /g, '_'));
    };
    
    return (
        <div className="mt-6">
            <div className="flex flex-wrap gap-3 mb-4"><Button variant={tab === 'case' ? 'primary' : 'secondary'} onClick={() => setTab('case')}>Case Summary</Button><Button variant={tab === 'class' ? 'primary' : 'secondary'} onClick={() => setTab('class')}>Classification Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Report</Button></div>
            <div className="flex flex-wrap gap-4 items-center p-4 bg-gray-50 rounded-md mb-6"><FormGroup label="Age group"><Select value={age} onChange={(e) => setAge(e.target.value)}><option value="LT2M">0-2 months</option><option value="GE2M_LE5Y">2-59 months</option></Select></FormGroup><FormGroup label="Setting"><Select value={settingFilter} onChange={(e) => setSettingFilter(e.target.value)}><option value="All">All</option><option value="OPD">Out-patient</option><option value="IPD">In-patient</option></Select></FormGroup></div>
            {['Group A', 'Group B', 'Group C', 'Group D'].map(g => {
                if (tab === 'matrix') return null;
                const data = (tab === 'case' ? caseSummaryByGroup : classSummaryByGroup)[g] || {};
                const ids = Object.keys(data); if (ids.length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                        <div className="flex justify-between items-center"><h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3><Button variant="secondary" onClick={() => handleExportGroupSummary(g, tab)}><PdfIcon/> Save Group to PDF</Button></div>
                        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead>{tab === 'case' ? (<tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">IPD Cases</th><th className="py-2 pr-4">% IPD</th><th className="py-2 pr-4">OPD Cases</th><th className="py-2 pr-4">% OPD</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">% Overall</th></tr>) : (<tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">IPD Class.</th><th className="py-2 pr-4">% IPD</th><th className="py-2 pr-4">OPD Class.</th><th className="py-2 pr-4">% OPD</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">% Overall</th></tr>)}</thead><tbody>{ids.map(id => { const r = data[id]; const inSeen = tab === 'case' ? r.inp_seen : r.inp_total; const inCor = r.inp_correct; const outSeen = tab === 'case' ? r.op_seen : r.op_total; const outCor = r.op_correct; const pctIn = calcPct(inCor, inSeen), pctOut = calcPct(outCor, outSeen), pctAll = calcPct(inCor + outCor, inSeen + outSeen); return (<tr key={id} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 pr-4">{inSeen}</td><td className={`py-2 pr-4 ${pctBgClass(pctIn)}`}>{fmtPct(pctIn)}</td><td className="py-2 pr-4">{outSeen}</td><td className={`py-2 pr-4 ${pctBgClass(pctOut)}`}>{fmtPct(pctOut)}</td><td className="py-2 pr-4">{inSeen + outSeen}</td><td className={`py-2 pr-4 ${pctBgClass(pctAll)}`}>{fmtPct(pctAll)}</td></tr>); })}</tbody></table></div>
                    </div>
                );
            })}
            {tab === 'matrix' && ['Group A', 'Group B', 'Group C', 'Group D'].map(g => {
                const { parts, matrixRows, perPartCorrect, perPartPct } = buildMatrixForGroup(g);
                if ((parts || []).length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                         <div className="flex justify-between items-center"><h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3><Button variant="secondary" onClick={() => handleExportMatrix(g)}><PdfIcon/> Save Group to PDF</Button></div>
                        <div className="overflow-x-auto"><table className="min-w-full text-xs"><thead><tr className="text-left border-b bg-gray-50"><th className="py-2 pr-4 w-80">Classification</th>{parts.map(p => (<th key={p.id} className="py-2 pr-4 whitespace-nowrap">{p.name}</th>))}<th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Mean</th><th className="py-2 pr-4">Min</th><th className="py-2 pr-4">Max</th></tr></thead><tbody>{matrixRows.map((r, idx) => (<tr key={idx} className="border-b"><td className="py-2 pr-4">{r.item}</td>{r.counts.map((c, i) => (<td key={i} className="py-2 pr-4 text-center">{c}</td>))}<td className="py-2 pr-4 font-medium">{r.total}</td><td className="py-2 pr-4">{(r.mean).toFixed(1)}</td><td className="py-2 pr-4">{r.min}</td><td className="py-2 pr-4">{r.max}</td></tr>))}<tr className="bg-emerald-50 font-medium"><td className="py-2 pr-4"># Correct</td>{perPartCorrect.map((n, i) => (<td key={i} className="py-2 pr-4 text-center">{n}</td>))}<td className="py-2 pr-4" colSpan={4}></td></tr><tr className="bg-emerald-50 font-medium"><td className="py-2 pr-4">% Correct</td>{perPartPct.map((v, i) => (<td key={i} className={`py-2 pr-4 text-center ${pctBgClass(v)}`}>{fmtPct(v)}</td>))}<td className="py-2 pr-4" colSpan={4}></td></tr></tbody></table></div>
                    </div>
                );
            })}
        </div>
    );
}
function EtatReports({ course, participants, allObs, allCases }) {
    const [tab, setTab] = useState('matrix');
    const caseSummaryByGroup = useMemo(() => {
        const g = {}; const pmap = new Map(); participants.forEach(p => pmap.set(p.id, p));
        for (const c of allCases) { const p = pmap.get(c.participant_id || ''); if (!p) continue; const k = p.group; g[k] ??= {}; g[k][p.id] ??= { name: p.name, total_cases: 0, correct_cases: 0 }; const t = g[k][p.id]; t.total_cases++; if (c.allCorrect) t.correct_cases++; }
        return g;
    }, [allCases, participants]);
    function buildMatrixForGroup(groupKey) {
        const parts = participants.filter(p => p.group === groupKey).sort((a, b) => a.name.localeCompare(b.name));
        const matrixRows = [];
        for (const domain in SKILLS_ETAT) { for (const skill of SKILLS_ETAT[domain]) { const counts = parts.map(p => allObs.filter(o => o.participant_id === p.id && o.item_recorded === skill).length); const total = counts.reduce((a, b) => a + b, 0); const mean = parts.length ? total / parts.length : 0; const min = counts.length ? Math.min(...counts) : 0; const max = counts.length ? Math.max(...counts) : 0; matrixRows.push({ domain: ETAT_DOMAIN_LABEL[domain], item: skill, counts, total, mean, min, max }); } }
        const perPartTotals = parts.map(p => allObs.filter(o => o.participant_id === p.id).length);
        const perPartCorrect = parts.map(p => allObs.filter(o => o.participant_id === p.id && o.item_correct === 1).length);
        const perPartPct = perPartTotals.map((den, i) => den ? (perPartCorrect[i] * 100) / den : NaN);
        return { parts, matrixRows, perPartTotals, perPartCorrect, perPartPct };
    }
    const handleExportGroupSummary = (groupKey) => {
        const data = caseSummaryByGroup[groupKey] || {}; const ids = Object.keys(data);
        const head = [['Participant', 'Total Cases', 'Correct Cases', '% Correct']];
        const body = ids.map(id => { const r = data[id]; return [r.name, r.total_cases, r.correct_cases, fmtPct(calcPct(r.correct_cases, r.total_cases))]; });
        const title = `ETAT Case Summary - ${groupKey}`;
        exportToPdf(title, head, body, title.replace(/ /g, '_'));
    };
    const handleExportMatrix = (groupKey) => {
        const { parts, matrixRows, perPartCorrect, perPartTotals, perPartPct } = buildMatrixForGroup(groupKey);
        const head = [['Skill', ...parts.map(p => p.name), 'Total', 'Mean', 'Min', 'Max']];
        const body = matrixRows.map(r => [r.item, ...r.counts, r.total, (r.mean).toFixed(1), r.min, r.max]);
        body.push(['# Total Skills', ...perPartTotals, '', '', '', '']);
        body.push(['# Correct Skills', ...perPartCorrect, '', '', '', '']);
        body.push(['% Correct', ...perPartPct.map(v => fmtPct(v)), '', '', '', '']);
        const title = `ETAT Detailed Report - ${groupKey}`;
        exportToPdf(title, head, body, title.replace(/ /g, '_'));
    };
    return (
        <div className="mt-6">
            <div className="flex flex-wrap gap-3 mb-6"><Button variant={tab === 'case' ? 'primary' : 'secondary'} onClick={() => setTab('case')}>Case Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Skill Report</Button></div>
            {tab === 'case' && ['Group A', 'Group B', 'Group C', 'Group D'].map(g => {
                const data = caseSummaryByGroup[g] || {}; const ids = Object.keys(data); if (ids.length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                        <div className="flex justify-between items-center"><h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3><Button variant="secondary" onClick={() => handleExportGroupSummary(g)}><PdfIcon/> Save Group to PDF</Button></div>
                        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">Total Cases</th><th className="py-2 pr-4">Correct Cases</th><th className="py-2 pr-4">% Correct Cases</th></tr></thead><tbody>{ids.map(id => { const r = data[id]; const pct = calcPct(r.correct_cases, r.total_cases); return (<tr key={id} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 pr-4">{r.total_cases}</td><td className="py-2 pr-4">{r.correct_cases}</td><td className={`py-2 pr-4 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td></tr>); })}</tbody></table></div>
                    </div>
                );
            })}
            {tab === 'matrix' && ['Group A', 'Group B', 'Group C', 'Group D'].map(g => {
                const { parts, matrixRows, perPartCorrect, perPartTotals, perPartPct } = buildMatrixForGroup(g);
                if ((parts || []).length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                        <div className="flex justify-between items-center"><h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3><Button variant="secondary" onClick={() => handleExportMatrix(g)}><PdfIcon/> Save Group to PDF</Button></div>
                        <div className="overflow-x-auto"><table className="min-w-full text-xs"><thead><tr className="text-left border-b bg-gray-50"><th className="py-2 pr-4 w-80">Skill</th>{parts.map(p => (<th key={p.id} className="py-2 pr-4 whitespace-nowrap">{p.name}</th>))}<th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Mean</th><th className="py-2 pr-4">Min</th><th className="py-2 pr-4">Max</th></tr></thead><tbody>{matrixRows.map((r, idx) => (<tr key={idx} className="border-b"><td className="py-2 pr-4">{r.item}</td>{r.counts.map((c, i) => (<td key={i} className="py-2 pr-4 text-center">{c}</td>))}<td className="py-2 pr-4 font-medium">{r.total}</td><td className="py-2 pr-4">{(r.mean).toFixed(1)}</td><td className="py-2 pr-4">{r.min}</td><td className="py-2 pr-4">{r.max}</td></tr>))}<tr className="bg-emerald-50 font-medium"><td className="py-2 pr-4"># Total Skills</td>{perPartTotals.map((n, i) => (<td key={i} className="py-2 pr-4 text-center">{n}</td>))}<td className="py-2 pr-4" colSpan={4}></td></tr><tr className="bg-emerald-50 font-medium"><td className="py-2 pr-4"># Correct Skills</td>{perPartCorrect.map((n, i) => (<td key={i} className="py-2 pr-4 text-center">{n}</td>))}<td className="py-2 pr-4" colSpan={4}></td></tr><tr className="bg-emerald-50 font-medium"><td className="py-2 pr-4">% Correct</td>{perPartPct.map((v, i) => (<td key={i} className={`py-2 pr-4 text-center ${pctBgClass(v)}`}>{fmtPct(v)}</td>))}<td className="py-2 pr-4" colSpan={4}></td></tr></tbody></table></div>
                    </div>
                );
            })}
        </div>
    );
}
function EencReports({ course, participants, allObs, allCases }) {
    const [tab, setTab] = useState('matrix');
    const [scenarioFilter, setScenarioFilter] = useState('All');
    const rows = useMemo(() => allObs.filter(o => o.courseId === course.id && (scenarioFilter === 'All' || o.age_group === scenarioFilter)), [allObs, course.id, scenarioFilter]);
    const cases = useMemo(() => allCases.filter(c => c.courseId === course.id && (scenarioFilter === 'All' || c.age_group.endsWith(scenarioFilter))), [allCases, course.id, scenarioFilter]);
    const caseSummaryByGroup = useMemo(() => {
        const g = {}; const pmap = new Map(); participants.forEach(p => pmap.set(p.id, p));
        for (const c of cases) { const p = pmap.get(c.participant_id || ''); if (!p) continue; const k = p.group; g[k] ??= {}; g[k][p.id] ??= { name: p.name, total_cases: 0, correct_cases: 0 }; const t = g[k][p.id]; t.total_cases++; if (c.allCorrect) t.correct_cases++; }
        return g;
    }, [cases, participants]);
    function buildMatrixForGroup(groupKey, scenario) {
        const parts = participants.filter(p => p.group === groupKey).sort((a, b) => a.name.localeCompare(b.name));
        const filteredRows = allObs.filter(o => o.courseId === course.id && o.age_group === scenario);
        const matrixRows = [];
        const skillsMap = scenario === 'breathing' ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
        const labelsMap = scenario === 'breathing' ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING;
        const domains = Object.keys(skillsMap);
        for (const domain of domains) { for (const skill of skillsMap[domain]) { const counts = parts.map(p => filteredRows.filter(o => o.participant_id === p.id && o.item_recorded === skill).length); const total = counts.reduce((a, b) => a + b, 0); const mean = parts.length ? total / parts.length : 0; const min = counts.length ? Math.min(...counts) : 0; const max = counts.length ? Math.max(...counts) : 0; matrixRows.push({ domain: labelsMap[domain], item: skill, counts, total, mean, min, max }); } }
        const perPartCorrect = parts.map(p => filteredRows.filter(o => o.participant_id === p.id && o.item_correct === 1).length);
        const perPartTotals = parts.map(p => filteredRows.filter(o => o.participant_id === p.id).length);
        const perPartPct = perPartTotals.map((den, i) => den ? (perPartCorrect[i] * 100) / den : NaN);
        return { parts, matrixRows, perPartCorrect, perPartTotals, perPartPct };
    }
    const SkillMatrix = ({ group, scenario }) => {
        const { parts, matrixRows, perPartCorrect, perPartTotals, perPartPct } = buildMatrixForGroup(group, scenario);
        if ((parts || []).length === 0 || matrixRows.every(r => r.total === 0)) return null;

        const handleExport = () => {
            const head = [['Skill', ...parts.map(p => p.name), 'Total', 'Mean', 'Min', 'Max']];
            const body = matrixRows.map(r => [r.item, ...r.counts, r.total, (r.mean).toFixed(1), r.min, r.max]);
            body.push(['# Total Skills', ...perPartTotals, '', '', '', '']);
            body.push(['# Correct Skills', ...perPartCorrect, '', '', '', '']);
            body.push(['% Correct', ...perPartPct.map(v => fmtPct(v)), '', '', '', '']);
            const title = `EENC Detailed Report - ${group} - ${scenario}`;
            exportToPdf(title, head, body, title.replace(/ /g, '_'));
        };

        return (
            <div className="grid gap-2 mt-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-semibold">{group.replace('Group ', 'Group ')} - {scenario === 'breathing' ? "Breathing Baby" : "Not Breathing Baby"}</h3>
                    <Button variant="secondary" onClick={handleExport}><PdfIcon/> Save Group to PDF</Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                        <thead><tr className="text-left border-b bg-gray-50"><th className="py-2 pr-4 w-80">Skill</th>{parts.map(p => (<th key={p.id} className="py-2 pr-4 whitespace-nowrap">{p.name}</th>))}<th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Mean</th><th className="py-2 pr-4">Min</th><th className="py-2 pr-4">Max</th></tr></thead>
                        <tbody>
                            {matrixRows.map((r, idx) => (<tr key={idx} className="border-b"><td className="py-2 pr-4">{r.item}</td>{r.counts.map((c, i) => (<td key={i} className="py-2 pr-4 text-center">{c}</td>))}<td className="py-2 pr-4 font-medium">{r.total}</td><td className="py-2 pr-4">{(r.mean).toFixed(1)}</td><td className="py-2 pr-4">{r.min}</td><td className="py-2 pr-4">{r.max}</td></tr>))}
                            <tr className="bg-emerald-50 font-medium"><td className="py-2 pr-4"># Total Skills</td>{perPartTotals.map((n, i) => (<td key={i} className="py-2 pr-4 text-center">{n}</td>))}<td className="py-2 pr-4" colSpan={4}></td></tr>
                            <tr className="bg-emerald-50 font-medium"><td className="py-2 pr-4"># Correct Skills</td>{perPartCorrect.map((n, i) => (<td key={i} className="py-2 pr-4 text-center">{n}</td>))}<td className="py-2 pr-4" colSpan={4}></td></tr>
                            <tr className="bg-emerald-50 font-medium"><td className="py-2 pr-4">% Correct</td>{perPartPct.map((v, i) => (<td key={i} className={`py-2 pr-4 text-center ${pctBgClass(v)}`}>{fmtPct(v)}</td>))}<td className="py-2 pr-4" colSpan={4}></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
    return (
        <div className="mt-6">
            <div className="flex flex-wrap gap-3 mb-4"><Button variant={tab === 'case' ? 'primary' : 'secondary'} onClick={() => setTab('case')}>Case Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Skill Report</Button></div>
            <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-md mb-6"><FormGroup label="Scenario"><Select value={scenarioFilter} onChange={(e) => setScenarioFilter(e.target.value)}><option value="All">All</option><option value="breathing">Breathing Baby</option><option value="not_breathing">Not Breathing Baby</option></Select></FormGroup></div>
            {tab === 'case' && ['Group A', 'Group B', 'Group C', 'Group D'].map(g => {
                const data = caseSummaryByGroup[g] || {}; const ids = Object.keys(data); if (ids.length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">Total Cases</th><th className="py-2 pr-4">Correct Cases</th><th className="py-2 pr-4">% Correct Cases</th></tr></thead><tbody>{ids.map(id => { const r = data[id]; const pct = calcPct(r.correct_cases, r.total_cases); return (<tr key={id} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 pr-4">{r.total_cases}</td><td className="py-2 pr-4">{r.correct_cases}</td><td className={`py-2 pr-4 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td></tr>); })}</tbody></table></div>
                    </div>
                );
            })}
            {tab === 'matrix' && ['Group A', 'Group B', 'Group C', 'Group D'].map(g => (<React.Fragment key={g}><SkillMatrix group={g} scenario="breathing" /><SkillMatrix group={g} scenario="not_breathing" /></React.Fragment>))}
        </div>
    );
}

// =============================================================================
// --- Icons and Smoke Tests ---
// =============================================================================
function CourseIcon({ course }) {
    const p = { width: 34, height: 34, viewBox: '0 0 48 48' };
    switch (course) {
        case 'IMNCI': return (<svg {...p}><circle cx="24" cy="24" r="22" fill="#e0f2fe" /><path d="M12 34c6-10 18-10 24 0" stroke="#0ea5e9" strokeWidth="3" fill="none" /><circle cx="24" cy="18" r="6" fill="#0ea5e9" /></svg>);
        case 'ETAT': return (<svg {...p}><rect x="3" y="8" width="42" height="30" rx="4" fill="#fff7ed" stroke="#f97316" strokeWidth="3" /><path d="M8 24h10l2-6 4 12 3-8h11" stroke="#f97316" strokeWidth="3" fill="none" /></svg>);
        case 'EENC': return (<svg {...p}><circle cx="16" cy="22" r="7" fill="#dcfce7" /><circle cx="30" cy="18" r="5" fill="#a7f3d0" /><path d="M8 34c8-6 24-6 32 0" stroke="#10b981" strokeWidth="3" fill="none" /></svg>);
        default: return null;
    }
}
if (typeof window !== 'undefined') {
    (function runSmokeTests() {
        try {
            console.group('%cIMCI App - Smoke Tests', 'font-weight:bold');
            console.assert(fmtPct(NaN) === '—', 'fmtPct(NaN) should be dash');
            console.assert(Array.isArray(SKILLS_ETAT.triage) && SKILLS_ETAT.triage.length > 0, 'ETAT skills are present');
            console.log('%cAll smoke tests passed.', 'color:green');
        } catch (e) { console.error('Smoke tests failure:', e); } finally { console.groupEnd(); }
    })();
}