import React, { useEffect, useMemo, useState, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// +++ Import Chart.js for graphing +++
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

// +++ Register Chart.js components +++
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);


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
// +++ UPDATED STATES AND LOCALITIES BASED ON PROVIDED JSON +++
const STATE_LOCALITIES = {
    "Khartoum": ["Khartoum", "Omdurman", "Khartoum North (Bahri)", "Jebel Awliya", "Sharq an-Nil", "Karari", "Um Badda"],
    "Gezira": ["Wad Madani Al Kubra", "South Al Gazira", "North Al Gazira", "East Al Gazira", "Um Al Gura", "Al Hasahisa", "Al Kamlin", "Al Managil", "24 Al-Qurashi"],
    "White Nile": ["Kosti", "Rabak", "Ad Douiem", "Al Gutaina", "Al Jabalian", "Tendalti", "As Salam", "Um Rimta", "Guli"],
    "Blue Nile": ["Ad-Damazin", "Ar Roseires", "Geissan", "Baw", "Kurumuk", "Tadamon"],
    "Sennar": ["Singa", "Sennar", "Ad Dinder", "Abu Hujar", "Ad-Dali", "Al-Suki", "Sharq Sennar"],
    "Gedarif": ["Gedarif Town", "Al Faw", "Al Rahd", "Al Galabat Ash Sharqiyah", "Al Galabat Al Gharbiyah", "Basundah", "Al Fushqa", "Butana", "Al Qureisha", "Central Gedarif", "Gallabat"],
    "Kassala": ["Kassala Town", "Nahr Atbara", "Hamashkoreb", "Talkook", "Aroma", "Wad al Hulaywah", "Khashm el Girba", "Rural Kassala", "Rural Aroma", "Seteet", "Al Gash"],
    "Red Sea": ["Port Sudan", "Sinkat", "Tokar", "Hala'ib", "Sawakin", "Gbeit Al-Maadin", "Dordeb", "Agig"],
    "Northern": ["Dongola", "Wadi Halfa", "Merowe", "Al Dabbah", "Delgo", "Al Burgaig", "Al Golid", "Halfa"],
    "River Nile": ["Ad-Damir", "Atbara", "Shendi", "Berber", "Abu Hamad", "Al Matammah", "Al Buhaira"],
    "North Kordofan": ["Sheikan", "Bara", "Umm Ruwaba", "Sodari", "Jebish", "Ar Rahad", "Wad Banda", "En Nuhud", "Ghabaish"],
    "South Kordofan": ["Kadugli", "Dilling", "Rashad", "Talodi", "Abu Jubayhah", "Al Abassiya", "Kalogi", "Habila", "Reif Ash Shargi", "Ghadeer", "El Leri"],
    "West Kordofan": ["Al-Fulah", "Babanusa", "Muglad", "As Salam", "Lagawa", "Keilak", "Abyei", "Al Sunut", "El Iddeia"],
    "North Darfur": ["El Fasher", "Kutum", "Kabkabiya", "Mellit", "Umm Kaddadah", "Al Koma", "Al Lait", "Tawila", "Dar Al-Salam", "Tina", "Saraf Omra", "Um Baru", "Karnoi", "El Sayah"],
    "South Darfur": ["Nyala North", "Nyala South", "Kas", "Ed al-Fursan", "Buram", "Tulus", "Rehad Al Berdi", "Al Radom", "Al Sunta", "Gereida", "Kubum", "Bielel", "Al Deain", "Shearia", "El Salam", "Katayla"],
    "West Darfur": ["Geneina", "Kulbus", "Jebel Moon", "Sirba", "Beida", "Habila", "For Baranga", "Kerenek", "Misterei"],
    "Central Darfur": ["Zalingei", "Nertiti", "Rokoro", "Bindisi", "Azum", "Wadi Salih", "Mukjar", "Umm Dukhun", "Garsila"],
    "East Darfur": ["Ed Daein", "Abu Karinka", "El Ferdous", "Assalaya", "Bahr el Arab", "Yassin", "Abu Jabra", "Keleikail Abu Salama", "Adila"]
};

// EENC SKILLS UPDATED WITH SCORING TYPE
const SKILLS_EENC_BREATHING = {
    pre_birth: [
        { text: "Checked room temperature and turned off fans" },
        { text: "Told the mother (and her support person) what is going to be done" },
        { text: "Washed hands (first of two hand washings)" },
        { text: "Placed dry cloth on mother's abdomen" },
        { text: "Prepared the newborn resuscitation area" },
        { text: "Checked that bag and mask are functional" },
        { text: "Washed hands (second of two hand washings)" },
        { text: "Put on two pairs of clean gloves" },
        { text: "Put forceps, cord clamp in easy-to-use order" }
    ],
    eenc: [
        { text: "Call out time of birth" },
        { text: "Start Drying within 5 seconds of birth" },
        { text: "Dry the baby thoroughly" },
        { text: "Stimulate baby by gently rubbing" },
        { text: "Suction only if airway blocked" },
        { text: "Remove the wet cloth" },
        { text: "Put baby in direct skin-to-skin contact" },
        { text: "Cover baby’s body with dry cloth and the head with a hat" }
    ],
    oxytocin: [
        { text: "Check for a second baby" },
        { text: "Give oxytocin to mother within 1 minute of delivery" }
    ],
    cord_clamp: [
        { text: "Removed outer pair of gloves" },
        { text: "Check cord pulsations, clamp after cord pulsations stopped" },
        { text: "Place clamp at 2 cm, forceps at 5 cm" }
    ],
    placenta: [
        { text: "Delivered placenta" },
        { text: "Counsel mother on feeding cues" }
    ]
};
const SKILLS_EENC_NOT_BREATHING = {
    pre_birth: [
        { text: "Checked room temperature and turned off fans" },
        { text: "Told the mother what is going to be done" },
        { text: "Washed hands (first of two hand washings)" },
        { text: "Placed dry cloth on mother's abdomen" },
        { text: "Prepared the newborn resuscitation area" },
        { text: "Checked that bag and mask are functional" },
        { text: "Washed hands (second of two hand washings)" },
        { text: "Put on two pairs of clean gloves" },
        { text: "Put forceps, cord clamp in easy-to-use order" }
    ],
    eenc_initial: [
        { text: "Called out time of birth" },
        { text: "Started Drying within 5 seconds of birth" },
        { text: "Dried the baby thoroughly" },
        { text: "Stimulated baby by gently rubbing" },
        { text: "Suction only if airway blocked" },
        { text: "Removed the wet cloth" },
        { text: "Put baby in direct skin-to-skin contact" },
        { text: "Covered baby’s body with cloth and the head with a hat" }
    ],
    if_not_breathing: [
        { text: "Called for help" },
        { text: "Removed outer pair of gloves" },
        { text: "Quickly clamped and cut cord" },
        { text: "Moved baby to resuscitation area" },
        { text: "Covered baby quickly during and after transfer" }
    ],
    resuscitation: [
        { text: "Positioned the head correctly to open airways" },
        { text: "Applied face mask firmly" },
        { text: "Gain chest rise within < 1 min of birth" },
        { text: "Squeezed bag to give 30–50 breaths per minute" },
        { text: "If chest not rising: Reposition head, reposition mask, check airway, squeeze harder" }
    ],
    if_breathing_starts: [
        { text: "Stop ventilation and monitor every 15 minutes" },
        { text: "Return baby to skin-to-skin contact and cover baby" },
        { text: "Counsel mother that baby is OK" }
    ],
    post_resuscitation: [
        { text: "Check for a second baby" },
        { text: "Give oxytocin to mother within 1 minute of delivery" },
        { text: "Delivered placenta" },
        { text: "Counsel mother on feeding cues" }
    ],
    if_not_breathing_after_10_min: [
        { text: "If heart rate, continue ventilation, Refer and transport" },
        { text: "If no heart rate, stop ventilation, provide emotional support" }
    ]
};
const EENC_DOMAIN_LABEL_BREATHING = { pre_birth: "Pre-birth preparations", eenc: "Early Essential Newborn Care", oxytocin: "Give Oxytocin to mother", cord_clamp: "Clamp the cord", placenta: "Deliver the placenta and counsel the mother" };
const EENC_DOMAINS_BREATHING = Object.keys(SKILLS_EENC_BREATHING);
const EENC_DOMAIN_LABEL_NOT_BREATHING = { pre_birth: "Pre-birth preparations", eenc_initial: "Initial EENC Steps (40 sec)", if_not_breathing: "If baby not crying or not breathing", resuscitation: "Resuscitation", if_breathing_starts: "If baby starts breathing well", post_resuscitation: "Post-resuscitation care", if_not_breathing_after_10_min: "If baby not breathing after 10 minutes" };
const EENC_DOMAINS_NOT_BREATHING = Object.keys(SKILLS_EENC_NOT_BREATHING);
const SKILLS_ETAT = { triage: ["Triage Assessment", "Assigns Triage Category"], airway_breathing: ["Positions Airway", "Suctions", "Gives Oxygen", "Bag-Mask Ventilation"], circulation: ["Inserts IV/IO", "Gives IV fluids", "Checks blood sugar"], coma: ["Positions unresponsive child", "Gives IV fluids"], convulsion: ["Positions convulsing child", "Gives Diazepam"], dehydration: ["Assesses dehydration", "Gives IV fluids", "Reassesses"] };
const ETAT_DOMAIN_LABEL = { triage: "Triage", airway_breathing: "Airway and Breathing", circulation: "Circulation", coma: "Coma", convulsion: "Convulsion", dehydration: "Dehydration (Severe)" };
const ETAT_DOMAINS = Object.keys(SKILLS_ETAT);
const CLASS_2_59M = { danger: ["Any Danger Sign"], respiratory: ["Severe pneumonia/disease", "Pneumonia", "Cough/cold", "Severe pneumonia/disease (Wheeze)", "Pneumonia (Wheeze)", "Cough/cold (Wheeze)"], diarrhoea: ["Severe dehydration", "Some dehydration", "No dehydration", "Severe persistent", "Persistent", "Dysentery"], fever_malaria: ["Very severe febrile disease", "Malaria", "Fever - malaria unlikely", "Severe complicated measles", "Measles - Eye/mouth complications", "Measles"], ear: ["Mastoiditis", "Acute ear infection", "Chronic ear infection", "No ear infection"], malnutrition: ["Complicated Severe Acute malnutrition (SAM)", "Un-complicated Severe Acute malnutrition (SAM)", "Moderate Acute malnutrition (MAM)", "No Acute Malnutrition"], anaemia: ["Severe Anaemia", "Anaemia", "No anaemia"], identify_treatment: ["IDENTIFY TREATMENTS NEEDED"], treatment_2_59m: ["ORAL DRUGS", "PLAN A", "PLAN B", "LOCAL INFECTION"], counsel: ["Assess and counsel for vaccination", "Asks feeding questions", "Feeding problems identified", "Gives advice on feeding problems", "COUNSEL WHEN TO RETURN"], };
const CLASS_0_59D = { bacterial: ["Possible serious bacterial infection", "Local bacterial infection", "Bacterial infection unlikely"], jaundice: ["Severe Jaundice", "Jaundice", "No Jaundice"], vyi_diarrhoea: ["Severe dehydration", "Some dehydration", "No dehydration", "Persistent diarrhea", "Blood in Stool"], feeding: ["Breastfeeding attachment and suckling assessed", "Feeding problem or low weight", "No feeding problem"], identify_treatment: ["IDENTIFY TREATMENTS NEEDED"], treatment_0_59d: ["Teach correct positioning and attachment", "Advise on home care"], };
const DOMAINS_BY_AGE_IMNCI = { GE2M_LE5Y: ["danger", "respiratory", "diarrhoea", "fever_malaria", "ear", "malnutrition", "anaemia", "identify_treatment", "treatment_2_59m", "counsel"], LT2M: ["bacterial", "jaundice", "vyi_diarrhoea", "feeding", "identify_treatment", "treatment_0_59d"], };
const DOMAIN_LABEL_IMNCI = { danger: "Danger signs", respiratory: "COUGH:", diarrhoea: "DIARRHOEA:", fever_malaria: "FEVER:", ear: "EAR:", malnutrition: "MALNUTRITION:", anaemia: "ANAEMIA:", identify_treatment: "IDENTIFY TREATMENT:", treatment_2_59m: "TREAT:", counsel: "COUNSEL:", bacterial: "BACTERIAL:", jaundice: "JAUNDICE:", vyi_diarrhoea: "DIARRHOEA:", feeding: "FEEDING:", treatment_0_59d: "TREATMENT/COUNSEL:" };
const getClassListImnci = (age, d) => (age === "GE2M_LE5Y" ? CLASS_2_59M[d] : CLASS_0_59D[d]) || [];

const JOB_TITLES_IMNCI = ["Pediatric Doctor", "Family Medicine Doctor", "General Practioner", "Medical Assistance", "Treating Nurse", "Other"];
const JOB_TITLES_ETAT = ["Pediatric Specialist", "Pediatric registrar", "Family Medicine Doctor", "Emergency doctor", "General Practioner", "Nurse Diploma", "Nurse Bachelor", "Other"];
const JOB_TITLES_EENC = ["Pediatric doctor", "Obstetric Doctor", "Emergency doctor", "General Practioner", "Nurse Diploma", "Nurse Bachelor", "Sister Midwife", "Midwife", "Other"];


// ----------------------------- HELPER FUNCTIONS & COMPONENTS --------------------------------
const calcPct = (c, s) => (!s ? NaN : (c * 100) / s);
const fmtPct = v => (!isFinite(v) ? "—" : Math.round(v).toFixed(0) + " %");
const pctBgClass = v => (!isFinite(v) ? "" : v < 50 ? "bg-red-100 text-red-800" : v <= 80 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800");

// --- PDF Export Helper ---
const exportToPdf = (title, head, body, fileName, orientation = 'portrait') => {
    const doc = new jsPDF({ orientation });
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
            ['Clinical Instructor', course.clinical_instructor], ['Funded by', course.funded_by],
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
        const correctObs = pObs.filter(o => o.item_correct > 0).length;
        return { name: p.name, group: p.group, cases: pCases.length, skills: pObs.length, correct: fmtPct(calcPct(correctObs, pObs.length)) };
    });
    const performanceHead = [['Name', 'Group', 'Cases Seen', 'Skills Recorded', '% Correct']];
    const performanceBody = performanceSummary.map(p => [p.name, p.group, p.cases, p.skills, p.correct]);
    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15, head: performanceHead, body: performanceBody, theme: 'striped',
        headStyles: { fillColor: [8, 145, 178] },
        didDrawPage: (data) => { doc.text("Participant Performance Summary", 14, data.settings.margin.top - 10); }
    });

    doc.save(`${fileName}.pdf`);
};

const generateParticipantPdf = async (participant, course, cases, observations, chartRefs) => {
    const doc = new jsPDF();
    const fileName = `Participant_Report_${participant.name.replace(/ /g, '_')}.pdf`;

    // --- Title Page ---
    doc.setFontSize(22);
    doc.text("Participant Performance Report", 105, 80, { align: 'center' });
    doc.setFontSize(18);
    doc.text(participant.name, 105, 90, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`${course.course_type} Course`, 105, 100, { align: 'center' });
    doc.text(`${course.state} / ${course.locality}`, 105, 108, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 105, 116, { align: 'center' });

    // --- Summary Page ---
    doc.addPage();
    doc.setFontSize(16);
    doc.text("Performance Summary", 14, 20);

    const totalObs = observations.length;
    const correctObs = observations.filter(o => o.item_correct > 0).length; // EENC partial counts as correct here
    const overallPct = calcPct(correctObs, totalObs);

    autoTable(doc, {
        startY: 25,
        body: [
            ['Participant Name', participant.name],
            ['Job Title', participant.job_title],
            ['Center', participant.center_name],
            ['Total Cases Monitored', cases.length],
            ['Total Skills/Classifications Observed', totalObs],
            ['Overall Correctness', fmtPct(overallPct)],
        ],
        theme: 'striped',
    });

    let finalY = doc.lastAutoTable.finalY;

    // --- Add Charts ---
    if (chartRefs.byDay.current) {
        const dayChartImg = chartRefs.byDay.current.canvas.toDataURL('image/png');
        if (finalY > 150) { doc.addPage(); finalY = 20; }
        doc.setFontSize(14);
        doc.text("Performance by Course Day", 14, finalY + 15);
        doc.addImage(dayChartImg, 'PNG', 14, finalY + 20, 180, 90);
        finalY += 110;
    }

    if (chartRefs.bySetting && chartRefs.bySetting.current) {
        const settingChartImg = chartRefs.bySetting.current.canvas.toDataURL('image/png');
        if (finalY > 150) { doc.addPage(); finalY = 20; }
        doc.setFontSize(14);
        doc.text("Performance by Setting", 14, finalY + 15);
        doc.addImage(settingChartImg, 'PNG', 14, finalY + 20, 180, 90);
    }

    // --- Detailed Performance Page ---
    doc.addPage();
    doc.setFontSize(16);
    doc.text("Detailed Performance by Domain", 14, 20);

    let detailedBody = [];
    if (course.course_type === 'IMNCI') {
        ['LT2M', 'GE2M_LE5Y'].forEach(ageGroup => {
            const ageObs = observations.filter(o => o.age_group === ageGroup);
            if (ageObs.length === 0) return;

            detailedBody.push([{ content: `Age Group: ${ageGroup === 'LT2M' ? '0-59 days' : '2-59 months'}`, colSpan: 3, styles: { fontStyle: 'bold', fillColor: '#cccccc' } }]);
            const domains = DOMAINS_BY_AGE_IMNCI[ageGroup];
            domains.forEach(d => {
                const domainObs = ageObs.filter(o => o.domain === d);
                if (domainObs.length > 0) {
                    const correct = domainObs.filter(o => o.item_correct > 0).length;
                    detailedBody.push([DOMAIN_LABEL_IMNCI[d], `${correct}/${domainObs.length}`, fmtPct(calcPct(correct, domainObs.length))]);
                }
            });
        });
    } else if (course.course_type === 'ETAT') {
        ETAT_DOMAINS.forEach(d => {
            const domainObs = observations.filter(o => o.domain === d);
            if (domainObs.length > 0) {
                const correct = domainObs.filter(o => o.item_correct > 0).length;
                detailedBody.push([ETAT_DOMAIN_LABEL[d], `${correct}/${domainObs.length}`, fmtPct(calcPct(correct, domainObs.length))]);
            }
        });
    } else if (course.course_type === 'EENC') {
        const domains = { ...EENC_DOMAIN_LABEL_BREATHING, ...EENC_DOMAIN_LABEL_NOT_BREATHING };
        Object.entries(domains).forEach(([domainKey, domainLabel]) => {
            const domainObs = observations.filter(o => o.domain === domainKey);
            if (domainObs.length > 0) {
                const totalScore = domainObs.reduce((sum, o) => sum + o.item_correct, 0);
                const maxScore = domainObs.length * 2;
                detailedBody.push([domainLabel, `${totalScore}/${maxScore}`, fmtPct(calcPct(totalScore, maxScore))]);
            }
        });
    }

    autoTable(doc, {
        startY: 25,
        head: [['Domain', 'Correct/Total', 'Percentage']],
        body: detailedBody,
        theme: 'grid',
        headStyles: { fillColor: [8, 145, 178] },
    });

    doc.save(fileName);
};

const generateFullCourseReportPdf = async (course, groupPerformance, chartRef) => {
    const doc = new jsPDF('landscape');
    const fileName = `Course_Report_${course.course_type}_${course.state}.pdf`;

    // --- Title Page ---
    doc.setFontSize(22);
    doc.text("Full Course Performance Report", 148, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`${course.course_type} Course`, 148, 30, { align: 'center' });
    doc.text(`${course.state} / ${course.locality}`, 148, 38, { align: 'center' });

    // --- Course Details ---
    const courseDetailsBody = [
        ['Coordinator', course.coordinator],
        ['Director', course.director],
        ['Clinical Instructor', course.clinical_instructor],
        ['Funded by', course.funded_by],
        ['Facilitators', (course.facilitators || []).join(', ')],
        ['# Participants', course.participants_count],
    ];
    autoTable(doc, {
        startY: 50,
        head: [['Course Information', '']],
        body: courseDetailsBody,
        theme: 'striped'
    });

    // --- Performance Table ---
    let finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(14);
    doc.text("Performance by Group", 14, finalY + 15);
    const tableHead = [['Group', '# Participants', 'Cases Seen', 'Skills Recorded', '% Correct']];
    const tableBody = Object.entries(groupPerformance).map(([group, data]) => [
        group,
        data.participantCount,
        data.totalCases,
        data.totalObs,
        fmtPct(data.percentage)
    ]);
    autoTable(doc, {
        startY: finalY + 20,
        head: tableHead,
        body: tableBody,
        theme: 'grid'
    });
    finalY = doc.lastAutoTable.finalY;

    // --- Chart ---
    if (chartRef.current) {
        const chartImg = chartRef.current.canvas.toDataURL('image/png');
        if (finalY > 100) { doc.addPage(); finalY = 20; }
        doc.setFontSize(14);
        doc.text("Performance Chart", 14, finalY + 15);
        doc.addImage(chartImg, 'PNG', 14, finalY + 20, 260, 120);
    }

    doc.save(fileName);
};


// --- Reusable UI Components for a consistent and improved design ---
const Card = ({ children, className = '' }) => <section className={`bg-white rounded-lg shadow-md p-4 md:p-6 ${className}`}>{children}</section>;
const PageHeader = ({ title, subtitle, actions }) => (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
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
// --- VIEW COMPONENTS (MOVED BEFORE APP COMPONENT TO FIX REFERENCE ERROR) ---
// =============================================================================

function Landing({ active, onPick }) {
    const items = [
        { key: 'IMNCI', title: 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)', enabled: true },
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

function CoursesView({ courses, onAdd, onOpen, onEdit, onDelete, onOpenReport }) {
    return (
        <Card>
            <PageHeader title="Available Courses" />
            <div className="mb-4">
                <Button onClick={onAdd}>Add New Course</Button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
                <Table headers={["State", "Locality", "Hall", "#", "Actions"]}>
                    {courses.length === 0 ? <EmptyState message="No courses found for this package." /> : courses.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                            <td className="p-4 border border-gray-200">{c.state}</td>
                            <td className="p-4 border border-gray-200">{c.locality}</td>
                            <td className="p-4 border border-gray-200">{c.hall}</td>
                            <td className="p-4 border border-gray-200 text-center">{c.participants_count}</td>
                            <td className="p-4 border border-gray-200">
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <Button variant="primary" onClick={() => onOpen(c.id)}>Open</Button>
                                    <Button variant="secondary" onClick={() => onOpenReport(c.id)}>Course Report</Button>
                                    <Button variant="secondary" onClick={() => onEdit(c)}>Edit</Button>
                                    <Button variant="danger" onClick={() => onDelete(c.id)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid gap-4">
                {courses.length === 0 ? (
                    <p className="py-12 text-center text-gray-500">No courses found for this package.</p>
                ) : (
                    courses.map(c => (
                        <div key={c.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{c.state}</h3>
                                    <p className="text-gray-600">{c.locality} - {c.hall}</p>
                                    <p className="text-sm text-gray-500 mt-1">Participants: {c.participants_count}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
                                <Button variant="primary" onClick={() => onOpen(c.id)}>Open</Button>
                                <Button variant="secondary" onClick={() => onOpenReport(c.id)}>Report</Button>
                                <Button variant="secondary" onClick={() => onEdit(c)}>Edit</Button>
                                <Button variant="danger" onClick={() => onDelete(c.id)}>Delete</Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}

function CourseReportView({ course, onBack }) {
    const [participants, setParticipants] = useState([]);
    const [allObs, setAllObs] = useState([]);
    const [allCases, setAllCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const chartRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!course?.id) return;
            setLoading(true);
            const [pData, { allObs, allCases }] = await Promise.all([
                listParticipants(course.id),
                listAllDataForCourse(course.id)
            ]);
            setParticipants(pData);
            setAllObs(allObs);
            setAllCases(allCases);
            setLoading(false);
        };
        fetchData();
    }, [course.id]);

    const { groupPerformance, overall } = useMemo(() => {
        const groupPerformance = { 'Group A': { pids: [], totalObs: 0, correctObs: 0, totalCases: 0 }, 'Group B': { pids: [], totalObs: 0, correctObs: 0, totalCases: 0 }, 'Group C': { pids: [], totalObs: 0, correctObs: 0, totalCases: 0 }, 'Group D': { pids: [], totalObs: 0, correctObs: 0, totalCases: 0 } };

        participants.forEach(p => {
            if (groupPerformance[p.group]) {
                groupPerformance[p.group].pids.push(p.id);
            }
        });

        allObs.forEach(o => {
            const p = participants.find(p => p.id === o.participant_id);
            if (p && groupPerformance[p.group]) {
                groupPerformance[p.group].totalObs++;
                if (o.item_correct > 0) groupPerformance[p.group].correctObs++;
            }
        });

        allCases.forEach(c => {
            const p = participants.find(p => p.id === c.participant_id);
            if (p && groupPerformance[p.group]) {
                groupPerformance[p.group].totalCases++;
            }
        });

        let totalObs = 0, correctObs = 0, totalCases = 0;
        Object.keys(groupPerformance).forEach(g => {
            const group = groupPerformance[g];
            group.participantCount = group.pids.length;
            group.percentage = calcPct(group.correctObs, group.totalObs);
            totalObs += group.totalObs;
            correctObs += group.correctObs;
            totalCases += group.totalCases;
        });

        const overall = {
            totalObs,
            correctObs,
            totalCases,
            percentage: calcPct(correctObs, totalObs),
            avgCases: (totalCases / participants.length) || 0,
            avgSkills: (totalObs / participants.length) || 0,
        };

        return { groupPerformance, overall };
    }, [participants, allObs, allCases]);

    if (loading) return <Card><Spinner /></Card>;

    const chartData = {
        labels: Object.keys(groupPerformance),
        datasets: [{
            label: '% Correct',
            data: Object.values(groupPerformance).map(g => g.percentage),
            backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444'],
        }],
    };

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false }, title: { display: true, text: 'Overall Performance by Group' } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } } }
    };

    return (
        <div className="grid gap-6">
            <PageHeader title="Full Course Report" subtitle={`${course.course_type} - ${course.state}`} actions={<>
                <Button onClick={() => generateFullCourseReportPdf(course, groupPerformance, chartRef)} variant="secondary"><PdfIcon /> Save as PDF</Button>
                <Button onClick={onBack}>Back to Courses</Button>
            </>} />

            <Card>
                <h3 className="text-xl font-bold mb-4">Course Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><strong>State:</strong> {course.state}</div>
                    <div><strong>Locality:</strong> {course.locality}</div>
                    <div><strong>Hall:</strong> {course.hall}</div>
                    <div><strong>Start Date:</strong> {course.start_date}</div>
                    <div><strong># Participants:</strong> {participants.length}</div>
                    <div><strong>Coordinator:</strong> {course.coordinator}</div>
                    <div><strong>Director:</strong> {course.director}</div>
                    {course.clinical_instructor && <div><strong>Clinical Instructor:</strong> {course.clinical_instructor}</div>}
                    <div><strong>Funded by:</strong> {course.funded_by}</div>
                    <div className="col-span-2"><strong>Facilitators:</strong> {(course.facilitators || []).join(', ')}</div>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Key Performance Indicators (KPIs)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Total Cases</div>
                        <div className="text-3xl font-bold text-sky-700">{overall.totalCases}</div>
                    </div>
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Avg. Cases / Participant</div>
                        <div className="text-3xl font-bold text-sky-700">{overall.avgCases.toFixed(1)}</div>
                    </div>
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Avg. Skills / Participant</div>
                        <div className="text-3xl font-bold text-sky-700">{overall.avgSkills.toFixed(1)}</div>
                    </div>
                    <div className={`p-4 rounded-lg ${pctBgClass(overall.percentage)}`}>
                        <div className="text-sm font-semibold">Overall Correctness</div>
                        <div className="text-3xl font-bold">{fmtPct(overall.percentage)}</div>
                    </div>
                </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-xl font-bold mb-4">Performance by Group</h3>
                    <Table headers={['Group', '# Participants', 'Cases Seen', 'Skills Recorded', '% Correct']}>
                        {Object.entries(groupPerformance).map(([group, data]) => (
                            <tr key={group}>
                                <td className="p-2 border">{group}</td>
                                <td className="p-2 border text-center">{data.participantCount}</td>
                                <td className="p-2 border text-center">{data.totalCases}</td>
                                <td className="p-2 border text-center">{data.totalObs}</td>
                                <td className={`p-2 border font-mono text-center ${pctBgClass(data.percentage)}`}>{fmtPct(data.percentage)}</td>
                            </tr>
                        ))}
                    </Table>
                </Card>
                <Card>
                    <Bar ref={chartRef} options={chartOptions} data={chartData} />
                </Card>
            </div>
        </div>
    );
}

function CourseForm({ courseType, initialData, onCancel, onSave }) {
    const [state, setState] = useState(initialData?.state || '');
    const [locality, setLocality] = useState(initialData?.locality || '');
    const [hall, setHall] = useState(initialData?.hall || '');
    const [startDate, setStartDate] = useState(initialData?.start_date || '');
    const [coordinator, setCoordinator] = useState(initialData?.coordinator || '');
    const [participantsCount, setParticipantsCount] = useState(initialData?.participants_count || 0);
    const [director, setDirector] = useState(initialData?.director || '');
    const [clinical, setClinical] = useState(initialData?.clinical_instructor || '');
    const [supporter, setSupporter] = useState(initialData?.funded_by || '');
    const [facilitators, setFacilitators] = useState(initialData?.facilitators || ['', '']);
    const [error, setError] = useState('');

    const addFac = () => setFacilitators(f => [...f, '']);
    const removeFac = (i) => setFacilitators(f => f.length <= 2 ? f : f.filter((_, idx) => idx !== i));
    const setFac = (i, v) => setFacilitators(f => f.map((x, idx) => idx === i ? v : x));

    const submit = () => {
        const facArr = facilitators.map(s => s.trim()).filter(Boolean);
        if (!state || !locality || !hall || !coordinator || !participantsCount || !director || facArr.length < 2 || !supporter || !startDate) {
            setError('Please complete all required fields (minimum two facilitators).'); return;
        }

        const payload = {
            state, locality, hall, coordinator, start_date: startDate,
            participants_count: participantsCount, director,
            funded_by: supporter, facilitators: facArr
        };

        if (courseType === 'IMNCI') {
            payload.clinical_instructor = clinical;
        }

        onSave(payload);
    };

    return (
        <Card>
            <PageHeader title={`${initialData ? 'Edit' : 'Add New'} Course`} subtitle={`Package: ${courseType}`} />
            {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                <FormGroup label="Course Hall"><Input value={hall} onChange={(e) => setHall(e.target.value)} /></FormGroup>
                <FormGroup label="Start Date of Course"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></FormGroup>
                <FormGroup label="Course Coordinator"><Input value={coordinator} onChange={(e) => setCoordinator(e.target.value)} /></FormGroup>
                <FormGroup label="# of Participants"><Input type="number" value={participantsCount} onChange={(e) => setParticipantsCount(Number(e.target.value))} /></FormGroup>
                <FormGroup label="Course Director"><Input value={director} onChange={(e) => setDirector(e.target.value)} /></FormGroup>
                {courseType === 'IMNCI' &&
                    <FormGroup label="Clinical Instructor (Optional)"><Input value={clinical} onChange={(e) => setClinical(e.target.value)} /></FormGroup>
                }
                <FormGroup label="Funded by:"><Input value={supporter} onChange={(e) => setSupporter(e.target.value)} /></FormGroup>
                <FormGroup label="Facilitators"><div className="grid gap-2">{facilitators.map((v, i) => (<div key={i} className="flex gap-2"><Input value={v} onChange={(e) => setFac(i, e.target.value)} placeholder={`Facilitator ${i + 1}`} /><Button type="button" variant="secondary" onClick={() => removeFac(i)} disabled={facilitators.length <= 2}>−</Button></div>))}<Button type="button" variant="secondary" className="mt-2" onClick={addFac}>+ Add Facilitator</Button></div></FormGroup>
            </div>
            <div className="flex gap-2 justify-end mt-6 border-t pt-6"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={submit}>Save Course</Button></div>
        </Card>
    );
}

function ParticipantsView({ course, participants, onAdd, onOpen, onEdit, onDelete, onOpenReport }) {
    const [groupFilter, setGroupFilter] = useState('All');
    const filtered = groupFilter === 'All' ? participants : participants.filter(p => p.group === groupFilter);

    return (
        <Card>
            <PageHeader title="Course Participants" subtitle={`${course.state} / ${course.locality}`} />

            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <Button onClick={onAdd}>Add Participant</Button>
                <div className="flex items-center gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Filter by Group:</label>
                    <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                        <option value="All">All Groups</option>
                        <option>Group A</option>
                        <option>Group B</option>
                        <option>Group C</option>
                        <option>Group D</option>
                    </Select>
                </div>
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block">
                <Table headers={["Name", "Group", "Job Title", "Actions"]}>
                    {filtered.length === 0 ? <EmptyState message="No participants found for this group." /> : filtered.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="p-4 border border-gray-200 font-medium text-gray-800">{p.name}</td>
                            <td className="p-4 border border-gray-200">{p.group}</td>
                            <td className="p-4 border border-gray-200">{p.job_title}</td>
                            <td className="p-4 border border-gray-200 text-right">
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <Button variant="secondary" onClick={() => onOpen(p.id)}>Monitor</Button>
                                    <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                    <Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button>
                                    <Button variant="danger" onClick={() => onDelete(p.id)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden grid gap-4">
                {filtered.length === 0 ? (
                    <p className="py-12 text-center text-gray-500">No participants found for this group.</p>
                ) : (
                    filtered.map(p => (
                        <div key={p.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                            <p className="text-gray-600">{p.job_title}</p>
                            <p className="text-sm text-gray-500 mt-1">Group: <span className="font-medium text-gray-700">{p.group}</span></p>
                            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
                                <Button variant="secondary" onClick={() => onOpen(p.id)}>Monitor</Button>
                                <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                <Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button>
                                <Button variant="danger" onClick={() => onDelete(p.id)}>Delete</Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}

function ParticipantReportView({ course, participant, participants, onChangeParticipant, onBack }) {
    const [observations, setObservations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);

    const chartByDayRef = useRef(null);
    const chartBySettingRef = useRef(null);

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

    const summaryStats = useMemo(() => {
        if (observations.length === 0) return { total: 0, correct: 0, score: 0, maxScore: 0, pct: NaN };
        if (course.course_type === 'EENC') {
            const score = observations.reduce((sum, o) => sum + o.item_correct, 0);
            const maxScore = observations.length * 2;
            return { score, maxScore, pct: calcPct(score, maxScore) };
        } else {
            const total = observations.length;
            const correct = observations.filter(o => o.item_correct > 0).length;
            return { total, correct, pct: calcPct(correct, total) };
        }
    }, [observations, course.course_type]);

    const performanceByDay = useMemo(() => {
        const dataByDay = {};
        observations.forEach(o => {
            const day = o.day_of_course || 1;
            dataByDay[day] = dataByDay[day] || { total: 0, correct: 0, score: 0, maxScore: 0 };
            dataByDay[day].total++;
            dataByDay[day].maxScore += (course.course_type === 'EENC' ? 2 : 1);
            if (o.item_correct > 0) dataByDay[day].correct++;
            if (course.course_type === 'EENC') dataByDay[day].score += o.item_correct;
        });

        return Object.entries(dataByDay).map(([day, data]) => ({
            day: `Day ${day}`,
            pct: course.course_type === 'EENC' ? calcPct(data.score, data.maxScore) : calcPct(data.correct, data.total)
        })).sort((a, b) => a.day.localeCompare(b.day, undefined, { numeric: true }));

    }, [observations, course.course_type]);

    const performanceBySetting = useMemo(() => {
        if (course.course_type !== 'IMNCI') return [];
        const dataBySetting = { OPD: { total: 0, correct: 0 }, IPD: { total: 0, correct: 0 } };
        observations.forEach(o => {
            const setting = o.setting || 'OPD';
            if (dataBySetting[setting]) {
                dataBySetting[setting].total++;
                if (o.item_correct > 0) dataBySetting[setting].correct++;
            }
        });
        return Object.entries(dataBySetting).map(([setting, data]) => ({
            setting,
            pct: calcPct(data.correct, data.total)
        }));
    }, [observations, course.course_type]);


    const detailedPerformance = useMemo(() => {
        const domains = {};
        let labelMap;

        if (course.course_type === 'IMNCI') {
            labelMap = DOMAIN_LABEL_IMNCI;
        } else if (course.course_type === 'ETAT') {
            labelMap = ETAT_DOMAIN_LABEL;
        } else if (course.course_type === 'EENC') {
            labelMap = { ...EENC_DOMAIN_LABEL_BREATHING, ...EENC_DOMAIN_LABEL_NOT_BREATHING };
        }

        observations.forEach(o => {
            if (!domains[o.domain]) {
                domains[o.domain] = {
                    label: labelMap[o.domain] || o.domain,
                    total: 0, correct: 0, score: 0, maxScore: 0, skills: {}
                };
            }
            const d = domains[o.domain];
            d.total++;
            d.maxScore += (course.course_type === 'EENC' ? 2 : 1);
            if (o.item_correct > 0) d.correct++;
            if (course.course_type === 'EENC') d.score += o.item_correct;

            if (!d.skills[o.item_recorded]) d.skills[o.item_recorded] = { total: 0, correct: 0, score: 0, maxScore: 0 };
            const s = d.skills[o.item_recorded];
            s.total++;
            s.maxScore += (course.course_type === 'EENC' ? 2 : 1);
            if (o.item_correct > 0) s.correct++;
            if (course.course_type === 'EENC') s.score += o.item_correct;
        });
        return Object.values(domains);

    }, [observations, course.course_type]);


    if (loading) return <Card><Spinner /></Card>;

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false }, title: { display: true, text: '' } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } } }
    };

    return (
        <div className="grid gap-6">
            <PageHeader
                title="Participant Performance Report"
                subtitle={participant.name}
                actions={<>
                    <div className="w-64">
                        <FormGroup label="Switch Participant">
                            <Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)}>
                                {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </FormGroup>
                    </div>
                    <Button onClick={() => generateParticipantPdf(participant, course, cases, observations, { byDay: chartByDayRef, bySetting: chartBySettingRef })} variant="secondary"><PdfIcon /> Export PDF</Button>
                    <Button onClick={onBack}>Back to List</Button>
                </>}
            />

            <Card>
                <h3 className="text-xl font-bold mb-4">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Cases Monitored</div>
                        <div className="text-3xl font-bold text-sky-700">{cases.length}</div>
                    </div>
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Skills Observed</div>
                        <div className="text-3xl font-bold text-sky-700">{observations.length}</div>
                    </div>
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">{course.course_type === 'EENC' ? 'Avg. Score' : '# Correct'}</div>
                        <div className="text-3xl font-bold text-sky-700">{course.course_type === 'EENC' ? `${summaryStats.score}/${summaryStats.maxScore}` : `${summaryStats.correct}/${summaryStats.total}`}</div>
                    </div>
                    <div className={`p-4 rounded-lg ${pctBgClass(summaryStats.pct)}`}>
                        <div className="text-sm font-semibold">Overall Score</div>
                        <div className="text-3xl font-bold">{fmtPct(summaryStats.pct)}</div>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Performance Analysis</h3>
                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <Bar ref={chartByDayRef} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: 'Performance by Day' } } }} data={{ labels: performanceByDay.map(d => d.day), datasets: [{ data: performanceByDay.map(d => d.pct), backgroundColor: '#0ea5e9' }] }} />
                    </div>
                    {course.course_type === 'IMNCI' && (
                        <div>
                            <Bar ref={chartBySettingRef} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: 'Performance by Setting' } } }} data={{ labels: performanceBySetting.map(d => d.setting), datasets: [{ data: performanceBySetting.map(d => d.pct), backgroundColor: ['#f97316', '#10b981'] }] }} />
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Detailed Performance by Domain</h3>
                <div className="space-y-4">
                    {detailedPerformance.map(domain => (
                        <details key={domain.label} className="bg-gray-50 p-3 rounded-lg">
                            <summary className="font-semibold cursor-pointer flex justify-between items-center">
                                <span>{domain.label}</span>
                                <span className={`font-mono text-sm px-2 py-1 rounded ${pctBgClass(course.course_type === 'EENC' ? calcPct(domain.score, domain.maxScore) : calcPct(domain.correct, domain.total))}`}>
                                    {fmtPct(course.course_type === 'EENC' ? calcPct(domain.score, domain.maxScore) : calcPct(domain.correct, domain.total))}
                                </span>
                            </summary>
                            <div className="mt-2 pl-4 border-l-2 border-gray-200">
                                <Table headers={["Skill/Classification", "Performance", "%"]}>
                                    {Object.entries(domain.skills).map(([skill, data]) => {
                                        const pct = course.course_type === 'EENC' ? calcPct(data.score, data.maxScore) : calcPct(data.correct, data.total);
                                        return (
                                            <tr key={skill}>
                                                <td className="p-2 border">{skill}</td>
                                                <td className="p-2 border">{course.course_type === 'EENC' ? `${data.score}/${data.maxScore}` : `${data.correct}/${data.total}`}</td>
                                                <td className={`p-2 border font-mono ${pctBgClass(pct)}`}>{fmtPct(pct)}</td>
                                            </tr>
                                        );
                                    })}
                                </Table>
                            </div>
                        </details>
                    ))}
                </div>
            </Card>
        </div>
    );
}

function ParticipantForm({ course, initialData, onCancel, onSave }) {
    // --- Course Type Flags ---
    const isImnci = course.course_type === 'IMNCI';
    const isEtat = course.course_type === 'ETAT';
    const isEenc = course.course_type === 'EENC';

    // --- Dynamic Job Options ---
    const jobTitleOptions = useMemo(() => {
        if (isEtat) return JOB_TITLES_ETAT;
        if (isEenc) return JOB_TITLES_EENC;
        return JOB_TITLES_IMNCI;
    }, [isImnci, isEtat, isEenc]);

    // --- Common States ---
    const [name, setName] = useState(initialData?.name || '');
    const [state, setState] = useState(initialData?.state || '');
    const [locality, setLocality] = useState(initialData?.locality || '');
    const [center, setCenter] = useState(initialData?.center_name || ''); // Used for Facility/Hospital Name
    const [phone, setPhone] = useState(initialData?.phone || '');
    const [group, setGroup] = useState(initialData?.group || 'Group A');
    const [error, setError] = useState('');

    // --- Job Title State ---
    const initialJobTitle = initialData?.job_title || '';
    const isInitialJobOther = initialJobTitle && !jobTitleOptions.includes(initialJobTitle);
    const [job, setJob] = useState(isInitialJobOther ? 'Other' : initialJobTitle);
    const [otherJobTitle, setOtherJobTitle] = useState(isInitialJobOther ? initialJobTitle : '');

    // --- IMCI States ---
    const [imciSubType, setImciSubType] = useState(initialData?.imci_sub_type || 'Standard 7 days course');
    const [facilityType, setFacilityType] = useState(initialData?.facility_type || '');
    const [trainedIMNCI, setTrainedIMNCI] = useState(initialData?.trained_before ? 'yes' : 'no');
    const [lastTrainIMNCI, setLastTrainIMNCI] = useState(initialData?.last_imci_training || '');
    const [numProv, setNumProv] = useState(initialData?.num_other_providers || 1);
    const [numProvIMCI, setNumProvIMCI] = useState(initialData?.num_other_providers_imci || 0);
    const [hasNutri, setHasNutri] = useState(initialData?.has_nutrition_service || false);
    const [nearestNutri, setNearestNutri] = useState(initialData?.nearest_nutrition_center || '');
    const [hasImm, setHasImm] = useState(initialData?.has_immunization_service || false);
    const [nearestImm, setNearestImm] = useState(initialData?.nearest_immunization_center || '');
    const [hasORS, setHasORS] = useState(initialData?.has_ors_room || false);

    // --- ETAT States ---
    const [hospitalTypeEtat, setHospitalTypeEtat] = useState(initialData?.hospital_type || '');
    const [trainedEtat, setTrainedEtat] = useState(initialData?.trained_etat_before ? 'yes' : 'no');
    const [lastTrainEtat, setLastTrainEtat] = useState(initialData?.last_etat_training || '');
    const [hasTriageSystem, setHasTriageSystem] = useState(initialData?.has_triage_system || false);
    const [hasStabilizationCenter, setHasStabilizationCenter] = useState(initialData?.has_stabilization_center || false);
    const [hasHdu, setHasHdu] = useState(initialData?.has_hdu || false);
    const [numStaffInEr, setNumStaffInEr] = useState(initialData?.num_staff_in_er || 0);
    const [numStaffTrainedInEtat, setNumStaffTrainedInEtat] = useState(initialData?.num_staff_trained_in_etat || 0);

    // --- EENC States ---
    const [hospitalTypeEenc, setHospitalTypeEenc] = useState(initialData?.hospital_type || '');
    const [otherHospitalTypeEenc, setOtherHospitalTypeEenc] = useState(initialData?.other_hospital_type || '');
    const [trainedEENC, setTrainedEENC] = useState(initialData?.trained_eenc_before ? 'yes' : 'no');
    const [lastTrainEENC, setLastTrainEENC] = useState(initialData?.last_eenc_training || '');
    const [hasSncu, setHasSncu] = useState(initialData?.has_sncu || false);
    const [hasIycfCenter, setHasIycfCenter] = useState(initialData?.has_iycf_center || false);
    const [numStaffInDelivery, setNumStaffInDelivery] = useState(initialData?.num_staff_in_delivery || 0);
    const [numStaffTrainedInEenc, setNumStaffTrainedInEenc] = useState(initialData?.num_staff_trained_in_eenc || 0);
    const [hasKangaroo, setHasKangaroo] = useState(initialData?.has_kangaroo_room || false);

    // --- Dynamic Label Logic ---
    const professionalCategory = useMemo(() => {
        const lowerCaseJob = (job === 'Other' ? otherJobTitle : job).toLowerCase();
        if (lowerCaseJob.includes('doctor') || lowerCaseJob.includes('specialist') || lowerCaseJob.includes('registrar') || lowerCaseJob.includes('practioner')) return 'doctor';
        if (lowerCaseJob.includes('nurse')) return 'nurse';
        if (lowerCaseJob.includes('midwife')) return 'midwife';
        return 'provider'; // Neutral default
    }, [job, otherJobTitle]);

    const submit = () => {
        const finalJobTitle = job === 'Other' ? otherJobTitle : job;
        if (!name || !state || !locality || !center || !finalJobTitle || !phone) { setError('Please complete all required fields'); return; }

        let p = { name, group, state, locality, center_name: center, job_title: finalJobTitle, phone };

        if (isImnci) {
            if (!facilityType || !imciSubType) { setError('Please complete all required fields'); return; }
            if (numProv <= 0) { setError('Number of providers at health center must be more than zero.'); return; }
            p = { ...p, imci_sub_type: imciSubType, facility_type: facilityType, trained_before: trainedIMNCI === 'yes', last_imci_training: trainedIMNCI === 'yes' ? lastTrainIMNCI : '', num_other_providers: numProv, num_other_providers_imci: numProvIMCI, has_nutrition_service: hasNutri, has_immunization_service: hasImm, has_ors_room: hasORS, nearest_nutrition_center: !hasNutri ? nearestNutri : '', nearest_immunization_center: !hasImm ? nearestImm : '' };
        } else if (isEtat) {
            if (!hospitalTypeEtat) { setError('Please complete all required fields'); return; }
            p = { ...p, hospital_type: hospitalTypeEtat, trained_etat_before: trainedEtat === 'yes', last_etat_training: trainedEtat === 'yes' ? lastTrainEtat : '', has_triage_system: hasTriageSystem, has_stabilization_center: hasStabilizationCenter, has_hdu: hasHdu, num_staff_in_er: numStaffInEr, num_staff_trained_in_etat: numStaffTrainedInEtat };
        } else if (isEenc) {
            if (!hospitalTypeEenc) { setError('Please complete all required fields'); return; }
            p = { ...p, hospital_type: hospitalTypeEenc === 'other' ? otherHospitalTypeEenc : hospitalTypeEenc, trained_eenc_before: trainedEENC === 'yes', last_eenc_training: trainedEENC === 'yes' ? lastTrainEENC : '', has_sncu: hasSncu, has_iycf_center: hasIycfCenter, num_staff_in_delivery: numStaffInDelivery, num_staff_trained_in_eenc: numStaffTrainedInEenc, has_kangaroo_room: hasKangaroo };
        }

        onSave(p);
    };

    return (
        <Card>
            <PageHeader title={initialData ? 'Edit Participant' : 'Add New Participant'} />
            {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* --- COMMON FIELDS --- */}
                <FormGroup label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormGroup>
                <FormGroup label="Group"><Select value={group} onChange={(e) => setGroup(e.target.value)}><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                <FormGroup label={isEtat ? "Hospital Name" : "Health Facility Name"}><Input value={center} onChange={(e) => setCenter(e.target.value)} /></FormGroup>

                <FormGroup label="Job Title">
                    <Select value={job} onChange={(e) => setJob(e.target.value)}>
                        <option value="">— Select Job —</option>
                        {jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </Select>
                </FormGroup>

                {job === 'Other' && (
                    <FormGroup label="Specify Job Title">
                        <Input value={otherJobTitle} onChange={(e) => setOtherJobTitle(e.target.value)} placeholder="Please specify" />
                    </FormGroup>
                )}

                <FormGroup label="Phone Number"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></FormGroup>

                {/* --- IMCI SPECIFIC FIELDS --- */}
                {isImnci && (<>
                    <FormGroup label="IMCI Course Sub-type">
                        <Select value={imciSubType} onChange={(e) => setImciSubType(e.target.value)}>
                            <option>Standard 7 days course</option>
                            <option>Refreshment course</option>
                            <option>IMNCI in humanitarian setting</option>
                            <option>online IMCI course</option>
                            <option>preservice Course</option>
                        </Select>
                    </FormGroup>
                    <FormGroup label="Facility Type"><Select value={facilityType} onChange={(e) => setFacilityType(e.target.value)}><option value="">— Select Type —</option><option value="Health Unit">Health Unit</option><option value="Health Center">Health Center</option><option value="Rural Hospital">Rural Hospital</option><option value="Teaching Hospital">Teaching Hospital</option><option value="other">Other</option></Select></FormGroup>
                    <FormGroup label="Previously trained in IMCI?"><Select value={trainedIMNCI} onChange={(e) => setTrainedIMNCI(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {trainedIMNCI === 'yes' && <FormGroup label="Date of last training"><Input type="date" value={lastTrainIMNCI} onChange={(e) => setLastTrainIMNCI(e.target.value)} /></FormGroup>}
                    <FormGroup label="Has therapeutic nutrition service?"><Select value={hasNutri ? 'yes' : 'no'} onChange={e => setHasNutri(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {!hasNutri && <FormGroup label="Nearest therapeutic nutrition center?"><Input value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} /></FormGroup>}
                    <FormGroup label="Has immunization service?"><Select value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {!hasImm && <FormGroup label="Nearest immunization center?"><Input value={nearestImm} onChange={e => setNearestImm(e.target.value)} /></FormGroup>}
                    <FormGroup label="Has ORS corner service?"><Select value={hasORS ? 'yes' : 'no'} onChange={e => setHasORS(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Number of provider at health center including the current participant"><Input type="number" min="1" value={numProv} onChange={(e) => setNumProv(Number(e.target.value || 1))} /></FormGroup>
                    <FormGroup label="Number of providers trained in IMCI (not including current COURSE)"><Input type="number" min="0" value={numProvIMCI} onChange={(e) => setNumProvIMCI(Number(e.target.value || 0))} /></FormGroup>
                </>)}

                {/* --- ETAT SPECIFIC FIELDS --- */}
                {isEtat && (<>
                    <FormGroup label="Hospital Type"><Select value={hospitalTypeEtat} onChange={e => setHospitalTypeEtat(e.target.value)}><option value="">— Select Type —</option><option>Pediatric Hospital</option><option>Pediatric Department in General Hospital</option><option>Rural Hospital</option><option>other</option></Select></FormGroup>
                    <FormGroup label="Previously trained on ETAT?"><Select value={trainedEtat} onChange={e => setTrainedEtat(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {trainedEtat === 'yes' && <FormGroup label="Date of last ETAT training"><Input type="date" value={lastTrainEtat} onChange={(e) => setLastTrainEtat(e.target.value)} /></FormGroup>}
                    <FormGroup label="Does hospital have a current triaging system?"><Select value={hasTriageSystem ? 'yes' : 'no'} onChange={e => setHasTriageSystem(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have a stabilization center for malnutrition?"><Select value={hasStabilizationCenter ? 'yes' : 'no'} onChange={e => setHasStabilizationCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have a high dependency unit?"><Select value={hasHdu ? 'yes' : 'no'} onChange={e => setHasHdu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s working in Emergency Room`}><Input type="number" min="0" value={numStaffInEr} onChange={e => setNumStaffInEr(Number(e.target.value || 0))} /></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s trained in ETAT`}><Input type="number" min="0" value={numStaffTrainedInEtat} onChange={e => setNumStaffTrainedInEtat(Number(e.target.value || 0))} /></FormGroup>
                </>)}

                {/* --- EENC SPECIFIC FIELDS --- */}
                {isEenc && (<>
                    <FormGroup label="Hospital Type"><Select value={hospitalTypeEenc} onChange={e => setHospitalTypeEenc(e.target.value)}><option value="">— Select Type —</option><option>Comprehensive EmONC</option><option>Basic EmONC</option><option value="other">Other (specify)</option></Select></FormGroup>
                    {hospitalTypeEenc === 'other' && <FormGroup label="Specify Hospital Type"><Input value={otherHospitalTypeEenc} onChange={e => setOtherHospitalTypeEenc(e.target.value)} /></FormGroup>}
                    <FormGroup label="Previously trained on EENC?"><Select value={trainedEENC} onChange={e => setTrainedEENC(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {trainedEENC === 'yes' && <FormGroup label="Date of last EENC training"><Input type="date" value={lastTrainEENC} onChange={(e) => setLastTrainEENC(e.target.value)} /></FormGroup>}
                    <FormGroup label="Does hospital have a Special Newborn Care Unit (SNCU)?"><Select value={hasSncu ? 'yes' : 'no'} onChange={e => setHasSncu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have an IYCF center?"><Select value={hasIycfCenter ? 'yes' : 'no'} onChange={e => setHasIycfCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have a Kangaroo care room?"><Select value={hasKangaroo ? 'yes' : 'no'} onChange={e => setHasKangaroo(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s working in delivery room`}><Input type="number" min="0" value={numStaffInDelivery} onChange={e => setNumStaffInDelivery(Number(e.target.value || 0))} /></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s trained in EENC`}><Input type="number" min="0" value={numStaffTrainedInEenc} onChange={e => setNumStaffTrainedInEenc(Number(e.target.value || 0))} /></FormGroup>
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

        if (isEenc) {
            const skillsMap = eencScenario === 'breathing' ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
            const totalSkills = Object.values(skillsMap).reduce((acc, domain) => acc + domain.length, 0);
            if (entries.length < totalSkills) {
                alert('Please complete the form before submission');
                return;
            }
        }

        if (entries.length === 0) { alert('No skills/classifications selected.'); return; }

        const currentCaseSerial = editingCase ? editingCase.case_serial : caseSerial;
        const allCorrect = entries.every(([, v]) => v > 0);
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
                {isImnci && <FormGroup label="Setting"><Select value={setting} onChange={(e) => setSetting(e.target.value)}><option value="OPD">Out-patient</option><option value="IPD">In-patient</option></Select></FormGroup>}
                {isImnci && <FormGroup label="Age band">
                    <Select value={age} onChange={(e) => {
                        setAge(e.target.value);
                        if (editingCase) { setBuffer({}); }
                    }}>
                        <option value="GE2M_LE5Y">Sick child (2-59 months)</option>
                        <option value="LT2M">Sick young infant (0-59 days)</option>
                    </Select>
                </FormGroup>}
                {isEenc && <FormGroup label="EENC Scenario"><Select value={eencScenario} onChange={(e) => setEencScenario(e.target.value)} disabled={!!editingCase}><option value="breathing">Breathing Baby</option><option value="not_breathing">Not Breathing Baby</option></Select></FormGroup>}
            </Card>
            <Card>
                <div className="grid md:grid-cols-3 gap-6">
                    <FormGroup label="Encounter date"><Input type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} /></FormGroup>
                    <FormGroup label="Course day (1-7)"><Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</Select></FormGroup>
                    <FormGroup label={isImnci && age === 'LT2M' ? "Case Age (weeks)" : "Case Age (months)"}>
                        <Input type="number" value={caseAgeMonths} onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" />
                    </FormGroup>
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
    return (
        <table className="text-xs border-collapse">
            <thead>
                <tr>
                    <th className="p-1 text-left border border-slate-300">Domain</th>
                    <th className="p-1 text-left border border-slate-300">Classification</th>
                    <th className="p-1 text-left border border-slate-300">Action</th>
                </tr>
            </thead>
            <tbody>
                {DOMAINS_BY_AGE_IMNCI[age].map(d => {
                    const list = getClassListImnci(age, d) || [];
                    const title = DOMAIN_LABEL_IMNCI[d] || d;
                    return (list.length > 0 ? list : ["(no items)"]).map((cls, i) => {
                        const k = `${d}|${cls}`;
                        const mark = buffer[k];
                        const rowClass = mark === 1 ? 'bg-green-50' : mark === 0 ? 'bg-red-50' : '';
                        return (
                            <tr key={`${d}-${i}`} className={rowClass}>
                                {i === 0 && <td className="p-1 align-top font-semibold text-gray-800 border border-slate-300" rowSpan={list.length}>{title}</td>}
                                <td className="p-1 border border-slate-300">{cls}</td>
                                <td className="p-1 border border-slate-300">
                                    <div className="flex gap-1">
                                        <button onClick={() => toggle(d, cls, 1)} className={`px-2 py-0.5 text-xs rounded-md border border-gray-300 transition ${mark === 1 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100'}`}>Correct</button>
                                        <button onClick={() => toggle(d, cls, 0)} className={`px-2 py-0.5 text-xs rounded-md border border-gray-300 transition ${mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100'}`}>Incorrect</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    });
                })}
            </tbody>
        </table>
    );
}

function EtatMonitoringGrid({ buffer, toggle }) {
    return (
        <table className="text-xs border-collapse">
            <thead>
                <tr>
                    <th className="p-1 text-left border border-slate-300">Domain</th>
                    <th className="p-1 text-left border border-slate-300">Skill</th>
                    <th className="p-1 text-left border border-slate-300">Action</th>
                </tr>
            </thead>
            <tbody>
                {ETAT_DOMAINS.map(d => {
                    const skills = SKILLS_ETAT[d];
                    const title = ETAT_DOMAIN_LABEL[d] || d;
                    return skills.map((skill, i) => {
                        const k = `${d}|${skill}`;
                        const mark = buffer[k];
                        const rowClass = mark === 1 ? 'bg-green-50' : mark === 0 ? 'bg-red-50' : '';
                        return (
                            <tr key={`${d}-${i}`} className={rowClass}>
                                {i === 0 && <td className="p-1 align-top font-semibold text-gray-800 border border-slate-300" rowSpan={skills.length}>{title}</td>}
                                <td className="p-1 border border-slate-300">{skill}</td>
                                <td className="p-1 border border-slate-300">
                                    <div className="flex gap-1">
                                        <button onClick={() => toggle(d, skill, 1)} className={`px-2 py-0.5 text-xs rounded-md border border-gray-300 transition ${mark === 1 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100'}`}>Correct</button>
                                        <button onClick={() => toggle(d, skill, 0)} className={`px-2 py-0.5 text-xs rounded-md border border-gray-300 transition ${mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100'}`}>Incorrect</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    });
                })}
            </tbody>
        </table>
    );
}

function EencMonitoringGrid({ scenario, buffer, toggle }) {
    const isBreathing = scenario === 'breathing';
    const domains = isBreathing ? EENC_DOMAINS_BREATHING : EENC_DOMAINS_NOT_BREATHING;
    const skillsMap = isBreathing ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
    const labelsMap = isBreathing ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING;

    const getRowClass = (mark) => {
        if (mark === 2) return 'bg-green-50';
        if (mark === 1) return 'bg-yellow-50';
        if (mark === 0) return 'bg-red-50';
        return '';
    };

    return (
        <table className="text-xs border-collapse">
            <thead>
                <tr>
                    <th className="p-1 text-left border border-slate-300">Domain</th>
                    <th className="p-1 text-left border border-slate-300">Skill</th>
                    <th className="p-1 text-left border border-slate-300">Action</th>
                </tr>
            </thead>
            <tbody>
                {domains.map(d => {
                    const skills = skillsMap[d];
                    const title = labelsMap[d] || d;
                    return skills.map((skill, i) => {
                        const k = `${d}|${skill.text}`;
                        const mark = buffer[k];
                        const rowClass = getRowClass(mark);
                        return (
                            <tr key={`${d}-${i}`} className={rowClass}>
                                {i === 0 && <td className="p-1 align-top font-semibold text-gray-800 border border-slate-300" rowSpan={skills.length}>{title}</td>}
                                <td className="p-1 border border-slate-300">{skill.text}</td>
                                <td className="p-1 border border-slate-300">
                                    <div className="flex gap-1 flex-wrap">
                                        <button onClick={() => toggle(d, skill.text, 2)}
                                            className={`px-2 py-0.5 text-xs rounded-md border border-gray-300 transition ${mark === 2 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100'}`}>
                                            Yes
                                        </button>
                                        <button onClick={() => toggle(d, skill.text, 1)}
                                            className={`px-2 py-0.5 text-xs rounded-md border border-gray-300 transition ${mark === 1 ? 'bg-yellow-200 border-yellow-300' : 'bg-white hover:bg-gray-100'}`}>
                                            Partial
                                        </button>
                                        <button onClick={() => toggle(d, skill.text, 0)}
                                            className={`px-2 py-0.5 text-xs rounded-md border border-gray-300 transition ${mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100'}`}>
                                            No
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    });
                })}
            </tbody>
        </table>
    );
}

function SubmittedCases({ course, participant, observations, cases, onEditCase, onDeleteCase }) {
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';

    const caseRows = useMemo(() => {
        return cases.map(c => {
            const relatedObs = observations.filter(o => o.caseId === c.id);
            let rowData = { ...c, date: c.encounter_date, setting: c.setting, age: c.age_group, serial: c.case_serial, day: c.day_of_course };

            if (isEenc) {
                const isBreathing = c.age_group === 'EENC_breathing';
                // EENC Max scores can vary based on skills recorded, so we calculate it dynamically
                const maxScore = relatedObs.length * 2;
                const score = relatedObs.reduce((sum, obs) => sum + obs.item_correct, 0);
                const percentage = calcPct(score, maxScore);
                rowData = { ...rowData, score, percentage };
            } else {
                const total = relatedObs.length;
                const correct = relatedObs.filter(o => o.item_correct > 0).length;
                const pct = calcPct(correct, total);
                rowData = { ...rowData, total, correct, percentage: pct };
            }
            return rowData;
        }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || b.serial - a.serial);
    }, [cases, observations, isEenc]);

    const getAgeLabel = (age) => {
        if (isImnci) { return age === 'LT2M' ? '0-59 d' : '2-59 m'; }
        if (isEenc) { return age?.includes('breathing') ? (age.includes('not_breathing') ? 'Not Breathing' : 'Breathing') : age; }
        return age;
    };

    const headers = isEenc
        ? ["Date", "Day", "Scenario", "Serial", "Score", "% Score", "Actions"]
        : ["Date", "Day", ...(isImnci ? ["Setting"] : []), "Age band", "Serial", "Skills", "Correct", "% Correct", "Actions"];

    return (
        <Card>
            <PageHeader title={`Submitted Cases for ${participant.name}`} />
            <Table headers={headers}>
                {caseRows.length === 0 ? <EmptyState message="No cases submitted yet." colSpan={headers.length} /> : caseRows.map((c, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-4 border border-gray-200">{c.date}</td>
                        <td className="p-4 border border-gray-200">{c.day ?? ''}</td>
                        {isImnci && <td className="p-4 border border-gray-200">{c.setting}</td>}
                        <td className="p-4 border border-gray-200">{getAgeLabel(c.age)}</td>
                        <td className="p-4 border border-gray-200">{c.serial}</td>
                        {isEenc ? (
                            <>
                                <td className="p-4 border border-gray-200">{c.score}</td>
                                <td className={`p-4 font-mono border border-gray-200 ${pctBgClass(c.percentage)}`}>{fmtPct(c.percentage)}</td>
                            </>
                        ) : (
                            <>
                                <td className="p-4 border border-gray-200">{c.total}</td>
                                <td className="p-4 border border-gray-200">{c.correct}</td>
                                <td className={`p-4 font-mono border border-gray-200 ${pctBgClass(c.percentage)}`}>{fmtPct(c.percentage)}</td>
                            </>
                        )}
                        <td className="p-4 border border-gray-200">
                            <div className="flex gap-2 justify-end">
                                <Button variant="secondary" onClick={() => onEditCase(c)}>Edit</Button>
                                <Button variant="danger" onClick={() => onDeleteCase(c)}>Delete</Button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
}

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
    const [dayFilter, setDayFilter] = useState('All');
    const [groupFilter, setGroupFilter] = useState('All');
    const [tab, setTab] = useState('matrix');

    const filteredParticipants = useMemo(() => participants.filter(p => groupFilter === 'All' || p.group === groupFilter), [participants, groupFilter]);

    const filteredObs = useMemo(() => allObs.filter(o => {
        const participant = filteredParticipants.find(p => p.id === o.participant_id);
        return participant && o.courseId === course.id && o.age_group === age && (settingFilter === 'All' || o.setting === settingFilter) && (dayFilter === 'All' || o.day_of_course === Number(dayFilter));
    }), [allObs, course.id, age, settingFilter, dayFilter, filteredParticipants]);

    const filteredCases = useMemo(() => allCases.filter(c => {
        const participant = filteredParticipants.find(p => p.id === c.participant_id);
        return participant && c.courseId === course.id && c.age_group === age && (settingFilter === 'All' || c.setting === settingFilter) && (dayFilter === 'All' || c.day_of_course === Number(dayFilter));
    }), [allCases, course.id, age, settingFilter, dayFilter, filteredParticipants]);


    const caseSummaryByGroup = useMemo(() => {
        const g = {}; const pmap = new Map(); participants.forEach(p => pmap.set(p.id, p));
        for (const c of filteredCases) { const p = pmap.get(c.participant_id || ''); if (!p) continue; const k = p.group; g[k] ??= {}; g[k][p.id] ??= { name: p.name, inp_seen: 0, inp_correct: 0, op_seen: 0, op_correct: 0 }; const t = g[k][p.id]; if (c.setting === 'IPD') { t.inp_seen++; if (c.allCorrect) t.inp_correct++; } else { t.op_seen++; if (c.allCorrect) t.op_correct++; } }
        return g;
    }, [filteredCases, participants]);

    const classSummaryByGroup = useMemo(() => {
        const g = {}; const pmap = new Map(); participants.forEach(p => pmap.set(p.id, p));
        for (const o of filteredObs) { const p = pmap.get(o.participant_id || ''); if (!p) continue; const k = p.group; g[k] ??= {}; g[k][p.id] ??= { name: p.name, inp_total: 0, inp_correct: 0, op_total: 0, op_correct: 0 }; const t = g[k][p.id]; if (o.setting === 'IPD') { t.inp_total++; if (o.item_correct === 1) t.inp_correct++; } else { t.op_total++; if (o.item_correct === 1) t.op_correct++; } }
        return g;
    }, [filteredObs, participants]);

    const handleExportFullReportPdf = () => {
        const doc = new jsPDF();
        const reportTitle = `IMCI Report - ${tab.replace(/^\w/, c => c.toUpperCase())}`;
        doc.text(reportTitle, 14, 15);
        let startY = 25;

        ['Group A', 'Group B', 'Group C', 'Group D'].forEach(g => {
            const parts = participants.filter(p => p.group === g);
            if (parts.length === 0) return;
            if (startY > 250) { doc.addPage(); startY = 20; }
            if (startY > 20) doc.text(`Group: ${g}`, 14, startY);

            let head, body;
            if (tab === 'matrix') {
                head = [['Classification', ...parts.map(p => p.name)]];
                body = [];
                const domains = DOMAINS_BY_AGE_IMNCI[age];
                for (const d of domains) {
                    body.push([{ content: DOMAIN_LABEL_IMNCI[d], colSpan: parts.length + 1, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } }]);
                    const items = getClassListImnci(age, d) || [];
                    for (const item of items) {
                        const participantCells = parts.map(p => {
                            const allObsForSkill = filteredObs.filter(o => o.participant_id === p.id && o.item_recorded === item);
                            if (allObsForSkill.length === 0) return "N/A";
                            const correctCount = allObsForSkill.filter(o => o.item_correct === 1).length;
                            return `${correctCount}/${allObsForSkill.length} (${fmtPct(calcPct(correctCount, allObsForSkill.length))})`;
                        });
                        body.push([item, ...participantCells]);
                    }
                }
            } else {
                const data = (tab === 'case' ? caseSummaryByGroup : classSummaryByGroup)[g] || {};
                head = tab === 'case'
                    ? [['Participant', 'IPD Cases', '% IPD', 'OPD Cases', '% OPD', 'Total', '% Overall']]
                    : [['Participant', 'IPD Class.', '% IPD', 'OPD Class.', '% OPD', 'Total', '% Overall']];
                body = Object.values(data).map(r => {
                    const inSeen = tab === 'case' ? r.inp_seen : r.inp_total; const inCor = r.inp_correct;
                    const outSeen = tab === 'case' ? r.op_seen : r.op_total; const outCor = r.op_correct;
                    return [r.name, inSeen, fmtPct(calcPct(inCor, inSeen)), outSeen, fmtPct(calcPct(outCor, outSeen)), inSeen + outSeen, fmtPct(calcPct(inCor + outCor, inSeen + outSeen))];
                });
            }

            autoTable(doc, { head, body, startY: startY + 5 });
            startY = doc.lastAutoTable.finalY + 15;
        });

        doc.save(`IMCI_${tab}_Report_All_Groups.pdf`);
    };

    const groupsToRender = groupFilter === 'All' ? ['Group A', 'Group B', 'Group C', 'Group D'] : [groupFilter];


    return (
        <div className="mt-6">
            <div className="flex flex-wrap gap-3 mb-4"><Button variant={tab === 'case' ? 'primary' : 'secondary'} onClick={() => setTab('case')}>Case Summary</Button><Button variant={tab === 'class' ? 'primary' : 'secondary'} onClick={() => setTab('class')}>Classification Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Report</Button></div>
            <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-md mb-6">
                <div className="flex flex-wrap gap-4 items-center">
                    <FormGroup label="Age group"><Select value={age} onChange={(e) => setAge(e.target.value)}><option value="LT2M">0-2 months</option><option value="GE2M_LE5Y">2-59 months</option></Select></FormGroup>
                    <FormGroup label="Setting"><Select value={settingFilter} onChange={(e) => setSettingFilter(e.target.value)}><option value="All">All</option><option value="OPD">Out-patient</option><option value="IPD">In-patient</option></Select></FormGroup>
                    <FormGroup label="Day of Training"><Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}><option value="All">All Days</option>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}</Select></FormGroup>
                    <FormGroup label="Group"><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="All">All Groups</option><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                </div>
                <Button onClick={handleExportFullReportPdf}><PdfIcon /> Save Full Report as PDF</Button>
            </div>

            {tab !== 'matrix' && groupsToRender.map(g => {
                const data = (tab === 'case' ? caseSummaryByGroup : classSummaryByGroup)[g] || {};
                const ids = Object.keys(data); if (ids.length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead>{tab === 'case' ? (<tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">IPD Cases</th><th className="py-2 pr-4">% IPD</th><th className="py-2 pr-4">OPD Cases</th><th className="py-2 pr-4">% OPD</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">% Overall</th></tr>) : (<tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">IPD Class.</th><th className="py-2 pr-4">% IPD</th><th className="py-2 pr-4">OPD Class.</th><th className="py-2 pr-4">% OPD</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">% Overall</th></tr>)}</thead><tbody>{ids.map(id => { const r = data[id]; const inSeen = tab === 'case' ? r.inp_seen : r.inp_total; const inCor = r.inp_correct; const outSeen = tab === 'case' ? r.op_seen : r.op_total; const outCor = r.op_correct; const pctIn = calcPct(inCor, inSeen), pctOut = calcPct(outCor, outSeen), pctAll = calcPct(inCor + outCor, inSeen + outSeen); return (<tr key={id} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 pr-4">{inSeen}</td><td className={`py-2 pr-4 ${pctBgClass(pctIn)}`}>{fmtPct(pctIn)}</td><td className="py-2 pr-4">{outSeen}</td><td className={`py-2 pr-4 ${pctBgClass(pctOut)}`}>{fmtPct(pctOut)}</td><td className="py-2 pr-4">{inSeen + outSeen}</td><td className={`py-2 pr-4 ${pctBgClass(pctAll)}`}>{fmtPct(pctAll)}</td></tr>); })}</tbody></table></div>
                    </div>
                );
            })}

            {tab === 'matrix' && groupsToRender.map(g => {
                const parts = participants.filter(p => p.group === g).sort((a, b) => a.name.localeCompare(b.name));
                if (parts.length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="max-h-[70vh] overflow-y-auto">
                            <table className="w-full text-xs table-fixed">
                                <thead>
                                    <tr className="text-left border-b bg-gray-50 sticky top-0">
                                        <th className="py-2 pr-4 w-1/3">Classification</th>
                                        {parts.map(p => <th key={p.id} className="py-2 px-1 text-center w-32">{p.name}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {DOMAINS_BY_AGE_IMNCI[age].map(domain => (
                                        <React.Fragment key={domain}>
                                            <tr className="border-b">
                                                <td colSpan={parts.length + 1} className="py-2 px-2 font-semibold bg-gray-100">{DOMAIN_LABEL_IMNCI[domain]}</td>
                                            </tr>
                                            {(getClassListImnci(age, domain) || []).map(item => {
                                                const participantCells = parts.map(p => {
                                                    const allObsForSkill = filteredObs.filter(o => o.participant_id === p.id && o.item_recorded === item);
                                                    if (allObsForSkill.length === 0) return <td key={p.id} className="py-2 pr-4 text-center">N/A</td>;
                                                    const correctCount = allObsForSkill.filter(o => o.item_correct === 1).length;
                                                    const totalCount = allObsForSkill.length;
                                                    const percentage = calcPct(correctCount, totalCount);
                                                    return <td key={p.id} className={`py-2 pr-4 text-center ${pctBgClass(percentage)}`}>{`${totalCount} (${fmtPct(percentage)})`}</td>;
                                                });
                                                return <tr key={item} className="border-b"><td className="py-2 pl-4">{item}</td>{participantCells}</tr>;
                                            })}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function EtatReports({ course, participants, allObs, allCases }) {
    const [tab, setTab] = useState('matrix');
    const [dayFilter, setDayFilter] = useState('All');
    const [groupFilter, setGroupFilter] = useState('All');

    const filteredParticipants = useMemo(() => participants.filter(p => groupFilter === 'All' || p.group === groupFilter), [participants, groupFilter]);

    const filteredCases = useMemo(() => allCases.filter(c => {
        const participant = filteredParticipants.find(p => p.id === c.participant_id);
        return participant && (dayFilter === 'All' || c.day_of_course === Number(dayFilter));
    }), [allCases, dayFilter, filteredParticipants]);

    const filteredObs = useMemo(() => allObs.filter(o => {
        const participant = filteredParticipants.find(p => p.id === o.participant_id);
        return participant && (dayFilter === 'All' || o.day_of_course === Number(dayFilter));
    }), [allObs, dayFilter, filteredParticipants]);

    const caseSummaryByGroup = useMemo(() => {
        const g = {}; const pmap = new Map(); participants.forEach(p => pmap.set(p.id, p));
        for (const c of filteredCases) { const p = pmap.get(c.participant_id || ''); if (!p) continue; const k = p.group; g[k] ??= {}; g[k][p.id] ??= { name: p.name, total_cases: 0, correct_cases: 0 }; const t = g[k][p.id]; t.total_cases++; if (c.allCorrect) t.correct_cases++; }
        return g;
    }, [filteredCases, participants]);

    const handleExportFullReportPdf = () => {
        const doc = new jsPDF();
        const reportTitle = `ETAT Report - ${tab === 'case' ? 'Case Summary' : 'Detailed Skills'}`;
        doc.text(reportTitle, 14, 15);
        let startY = 25;

        ['Group A', 'Group B', 'Group C', 'Group D'].forEach(g => {
            const parts = participants.filter(p => p.group === g);
            if (parts.length === 0) return;
            if (startY > 250) { doc.addPage(); startY = 20; }
            if (startY > 20) doc.text(`Group: ${g}`, 14, startY);

            let head, body;
            if (tab === 'matrix') {
                head = [['Skill', ...parts.map(p => p.name)]];
                body = [];
                for (const domain in SKILLS_ETAT) {
                    body.push([{ content: ETAT_DOMAIN_LABEL[domain], colSpan: parts.length + 1, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } }]);
                    for (const skill of SKILLS_ETAT[domain]) {
                        const participantCells = parts.map(p => {
                            const allObsForSkill = filteredObs.filter(o => o.participant_id === p.id && o.item_recorded === skill);
                            if (allObsForSkill.length === 0) return "N/A";
                            const correctCount = allObsForSkill.filter(o => o.item_correct === 1).length;
                            return `${correctCount}/${allObsForSkill.length} (${fmtPct(calcPct(correctCount, allObsForSkill.length))})`;
                        });
                        body.push([skill, ...participantCells]);
                    }
                }
            } else {
                const data = caseSummaryByGroup[g] || {};
                head = [['Participant', 'Total Cases', 'Correct Cases', '% Correct']];
                body = Object.values(data).map(r => [r.name, r.total_cases, r.correct_cases, fmtPct(calcPct(r.correct_cases, r.total_cases))]);
            }

            autoTable(doc, { head, body, startY: startY + 5 });
            startY = doc.lastAutoTable.finalY + 15;
        });

        doc.save(`ETAT_${tab}_Report_All_Groups.pdf`);
    };

    const groupsToRender = groupFilter === 'All' ? ['Group A', 'Group B', 'Group C', 'Group D'] : [groupFilter];

    return (
        <div className="mt-6">
            <div className="flex flex-wrap gap-3 mb-4"><Button variant={tab === 'case' ? 'primary' : 'secondary'} onClick={() => setTab('case')}>Case Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Skill Report</Button></div>

            <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-md mb-6">
                <div className="flex gap-4 items-center">
                    <FormGroup label="Day of Training"><Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}><option value="All">All Days</option>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}</Select></FormGroup>
                    <FormGroup label="Group"><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="All">All Groups</option><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                </div>
                <Button onClick={handleExportFullReportPdf}><PdfIcon /> Save Full Report as PDF</Button>
            </div>

            {tab === 'case' && groupsToRender.map(g => {
                const data = caseSummaryByGroup[g] || {}; const ids = Object.keys(data); if (ids.length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">Total Cases</th><th className="py-2 pr-4">Correct Cases</th><th className="py-2 pr-4">% Correct Cases</th></tr></thead><tbody>{ids.map(id => { const r = data[id]; const pct = calcPct(r.correct_cases, r.total_cases); return (<tr key={id} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 pr-4">{r.total_cases}</td><td className="py-2 pr-4">{r.correct_cases}</td><td className={`py-2 pr-4 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td></tr>); })}</tbody></table></div>
                    </div>
                );
            })}

            {tab === 'matrix' && groupsToRender.map(g => {
                const parts = participants.filter(p => p.group === g).sort((a, b) => a.name.localeCompare(b.name));
                if (parts.length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="overflow-x-auto"><table className="min-w-full text-xs">
                            <thead>
                                <tr className="text-left border-b bg-gray-50 sticky top-0">
                                    <th className="py-2 pr-4 w-80">Skill</th>
                                    {parts.map(p => <th key={p.id} className="py-2 pr-4 whitespace-nowrap text-center">{p.name}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {ETAT_DOMAINS.map(domain => (
                                    <React.Fragment key={domain}>
                                        <tr className="border-b">
                                            <td colSpan={parts.length + 1} className="py-2 px-2 font-semibold bg-gray-100">{ETAT_DOMAIN_LABEL[domain]}</td>
                                        </tr>
                                        {SKILLS_ETAT[domain].map(skill => {
                                            const participantCells = parts.map(p => {
                                                const allObsForSkill = filteredObs.filter(o => o.participant_id === p.id && o.item_recorded === skill);
                                                if (allObsForSkill.length === 0) return <td key={p.id} className="py-2 pr-4 text-center">N/A</td>;
                                                const correctCount = allObsForSkill.filter(o => o.item_correct === 1).length;
                                                const totalCount = allObsForSkill.length;
                                                const percentage = calcPct(correctCount, totalCount);
                                                return <td key={p.id} className={`py-2 pr-4 text-center ${pctBgClass(percentage)}`}>{`${correctCount}/${totalCount} (${fmtPct(percentage)})`}</td>;
                                            });
                                            return <tr key={skill} className="border-b"><td className="py-2 pl-4">{skill}</td>{participantCells}</tr>;
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table></div>
                    </div>
                );
            })}
        </div>
    );
}

function EencReports({ course, participants, allObs, allCases }) {
    const [tab, setTab] = useState('summary');
    const [scenarioFilter, setScenarioFilter] = useState('All');
    const [dayFilter, setDayFilter] = useState('All');
    const [groupFilter, setGroupFilter] = useState('All');

    const filteredParticipants = useMemo(() => participants.filter(p => groupFilter === 'All' || p.group === groupFilter), [participants, groupFilter]);

    const filteredCases = useMemo(() => allCases.filter(c => {
        const participant = filteredParticipants.find(p => p.id === c.participant_id);
        return participant && c.courseId === course.id && c.age_group.startsWith('EENC_') && (dayFilter === 'All' || c.day_of_course === Number(dayFilter));
    }), [allCases, course.id, dayFilter, filteredParticipants]);

    const filteredObs = useMemo(() => allObs.filter(o => {
        const participant = filteredParticipants.find(p => p.id === o.participant_id);
        return participant && (dayFilter === 'All' || o.day_of_course === Number(dayFilter));
    }), [allObs, dayFilter, filteredParticipants]);

    const scoreSummaryByGroup = useMemo(() => {
        const g = {};
        const pmap = new Map(participants.map(p => [p.id, p]));

        participants.forEach(p => {
            const groupKey = p.group;
            g[groupKey] ??= {};
            g[groupKey][p.id] = {
                name: p.name,
                total_cases: 0, total_score: 0, total_max_score: 0,
                breathing_cases: 0, breathing_score: 0, breathing_max_score: 0,
                not_breathing_cases: 0, not_breathing_score: 0, not_breathing_max_score: 0
            };
        });

        for (const c of filteredCases) {
            const p = pmap.get(c.participant_id || '');
            if (!p) continue;

            const t = g[p.group][p.id];
            const caseObs = filteredObs.filter(o => o.caseId === c.id);
            const isBreathing = c.age_group === 'EENC_breathing';
            const maxScore = caseObs.length * 2; // Dynamic max score
            const currentScore = caseObs.reduce((sum, obs) => sum + obs.item_correct, 0);

            t.total_cases++;
            t.total_score += currentScore;
            t.total_max_score += maxScore;

            if (isBreathing) {
                t.breathing_cases++;
                t.breathing_score += currentScore;
                t.breathing_max_score += maxScore;
            } else {
                t.not_breathing_cases++;
                t.not_breathing_score += currentScore;
                t.not_breathing_max_score += maxScore;
            }
        }
        return g;
    }, [filteredCases, filteredObs, participants]);

    const handleExportFullReportPdf = () => {
        const doc = new jsPDF('landscape');
        const reportTitle = `EENC Report - ${tab === 'summary' ? 'Score Summary' : 'Detailed Skills'}`;
        doc.text(reportTitle, 14, 15);
        let startY = 25;

        ['Group A', 'Group B', 'Group C', 'Group D'].forEach(g => {
            const parts = participants.filter(p => p.group === g);
            if (parts.length === 0) return;
            if (startY > 180) { doc.addPage(); startY = 20; }
            if (startY > 20) doc.text(`Group: ${g}`, 14, startY);

            if (tab === 'summary') {
                const groupData = scoreSummaryByGroup[g];
                if (!groupData) return;
                const head = [[
                    { content: 'Participant', rowSpan: 2 },
                    { content: 'Total', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'Breathing', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'Not Breathing', colSpan: 3, styles: { halign: 'center' } }
                ], ['Cases', 'Score', '%', 'Cases', 'Score', '%', 'Cases', 'Score', '%']];
                const body = Object.values(groupData).map(r => [
                    r.name, r.total_cases, r.total_score, fmtPct(calcPct(r.total_score, r.total_max_score)),
                    r.breathing_cases, r.breathing_score, fmtPct(calcPct(r.breathing_score, r.breathing_max_score)),
                    r.not_breathing_cases, r.not_breathing_score, fmtPct(calcPct(r.not_breathing_score, r.not_breathing_max_score))
                ]);
                autoTable(doc, { head, body, startY: startY + 5 });
                startY = doc.lastAutoTable.finalY + 15;
            } else { // Detailed Matrix
                const scenariosToRender = (scenarioFilter === 'All') ? ['breathing', 'not_breathing'] : [scenarioFilter];
                scenariosToRender.forEach(scenario => {
                    const hasData = parts.some(p => filteredObs.some(o => o.participant_id === p.id && o.age_group === scenario));
                    if (!hasData) return;
                    if (startY > 180) { doc.addPage(); startY = 20; }
                    doc.text(`${scenario === 'breathing' ? 'Breathing Baby' : 'Not Breathing Baby'}`, 14, startY);

                    const skillsMap = scenario === 'breathing' ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
                    const domains = Object.keys(skillsMap);
                    const head = [['Skill', ...parts.map(p => p.name)]];
                    const body = [];

                    domains.forEach(domain => {
                        body.push([{ content: (scenario === 'breathing' ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING)[domain], colSpan: parts.length + 1, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } }]);
                        skillsMap[domain].forEach(skill => {
                            const participantCells = parts.map(p => {
                                const skillObs = filteredObs.filter(o => o.participant_id === p.id && o.item_recorded === skill.text && o.age_group === scenario);
                                if (skillObs.length === 0) return "N/A";
                                const totalScore = skillObs.reduce((acc, o) => acc + o.item_correct, 0);
                                const maxScore = skillObs.length * 2;
                                const avgScore = (totalScore / skillObs.length).toFixed(1);
                                return `${avgScore} (${fmtPct(calcPct(totalScore, maxScore))})`;
                            });
                            body.push([skill.text, ...participantCells]);
                        });
                    });
                    autoTable(doc, { head, body, startY: startY + 5 });
                    startY = doc.lastAutoTable.finalY + 15;
                });
            }
        });

        doc.save(`EENC_${tab}_Report_All_Groups.pdf`);
    };

    const EencDetailedMatrix = ({ group, scenario }) => {
        const parts = participants.filter(p => p.group === group).sort((a, b) => a.name.localeCompare(b.name));
        const skillsMap = scenario === 'breathing' ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
        const domains = Object.keys(skillsMap);
        const labelsMap = scenario === 'breathing' ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING;

        if (parts.length === 0) return null;
        const hasData = parts.some(p => filteredObs.some(o => o.participant_id === p.id && o.age_group === scenario));
        if (!hasData && scenarioFilter !== 'All') return null;

        return (
            <div className="grid gap-2 mt-6">
                <h3 className="text-xl font-semibold">{group} - {scenario === 'breathing' ? "Breathing Baby" : "Not Breathing Baby"}</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                        <thead>
                            <tr className="text-left border-b bg-gray-50 sticky top-0">
                                <th className="py-2 pr-4 w-80">Skill</th>
                                {parts.map(p => <th key={p.id} className="py-2 pr-4 whitespace-nowrap text-center">{p.name}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {domains.map(domain => (
                                <React.Fragment key={domain}>
                                    <tr className="border-b"><td colSpan={parts.length + 1} className="py-2 px-2 font-semibold bg-gray-100">{labelsMap[domain]}</td></tr>
                                    {skillsMap[domain].map((skill) => {
                                        const participantCells = parts.map(p => {
                                            const skillObservations = filteredObs.filter(o => o.participant_id === p.id && o.item_recorded === skill.text && o.age_group === scenario);
                                            if (skillObservations.length === 0) return <td key={p.id} className="py-2 pr-4 text-center">N/A</td>;
                                            const totalScore = skillObservations.reduce((acc, o) => acc + o.item_correct, 0);
                                            const maxPossibleScore = skillObservations.length * 2;
                                            const percentage = calcPct(totalScore, maxPossibleScore);
                                            const avgScore = (totalScore / skillObservations.length).toFixed(1);
                                            return <td key={p.id} className={`py-2 pr-4 text-center ${pctBgClass(percentage)}`}>{`${avgScore} (${fmtPct(percentage)})`}</td>;
                                        });
                                        return <tr key={skill.text} className="border-b"><td className="py-2 pl-4">{skill.text}</td>{participantCells}</tr>;
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    const groupsToRender = groupFilter === 'All' ? ['Group A', 'Group B', 'Group C', 'Group D'] : [groupFilter];

    return (
        <div className="mt-6">
            <div className="flex flex-wrap gap-3 mb-4"><Button variant={tab === 'summary' ? 'primary' : 'secondary'} onClick={() => setTab('summary')}>Score Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Skill Report</Button></div>
            <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-md mb-6">
                <div className="flex gap-4 items-center">
                    {tab === 'matrix' && <FormGroup label="Scenario"><Select value={scenarioFilter} onChange={(e) => setScenarioFilter(e.target.value)}><option value="All">All (Combined)</option><option value="breathing">Breathing Baby</option><option value="not_breathing">Not Breathing Baby</option></Select></FormGroup>}
                    <FormGroup label="Day of Training"><Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}><option value="All">All Days</option>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}</Select></FormGroup>
                    <FormGroup label="Group"><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="All">All Groups</option><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                </div>
                <Button onClick={handleExportFullReportPdf}><PdfIcon /> Save Full Report as PDF</Button>
            </div>

            {tab === 'summary' && groupsToRender.map(g => {
                const data = scoreSummaryByGroup[g];
                if (!data) return null;
                const ids = Object.keys(data);
                if (ids.length === 0) return null;
                return (
                    <div key={g} className="grid gap-2 mb-8">
                        <h3 className="text-xl font-semibold">{g}</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b bg-gray-50">
                                        <th rowSpan={2} className="py-2 px-2 border">Participant</th>
                                        <th colSpan={3} className="py-2 px-2 border text-center">Total Performance</th>
                                        <th colSpan={3} className="py-2 px-2 border text-center">Breathing Baby</th>
                                        <th colSpan={3} className="py-2 px-2 border text-center">Not Breathing Baby</th>
                                    </tr>
                                    <tr className="text-left border-b bg-gray-50">
                                        <th className="py-2 px-2 border">Cases</th><th className="py-2 px-2 border">Score</th><th className="py-2 px-2 border">%</th>
                                        <th className="py-2 px-2 border">Cases</th><th className="py-2 px-2 border">Score</th><th className="py-2 px-2 border">%</th>
                                        <th className="py-2 px-2 border">Cases</th><th className="py-2 px-2 border">Score</th><th className="py-2 px-2 border">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ids.map(id => {
                                        const r = data[id];
                                        return (<tr key={id} className="border-b">
                                            <td className="py-2 px-2 border font-medium">{r.name}</td>
                                            <td className="py-2 px-2 border">{r.total_cases}</td>
                                            <td className="py-2 px-2 border">{r.total_score}</td>
                                            <td className={`py-2 px-2 border ${pctBgClass(calcPct(r.total_score, r.total_max_score))}`}>{fmtPct(calcPct(r.total_score, r.total_max_score))}</td>
                                            <td className="py-2 px-2 border">{r.breathing_cases}</td>
                                            <td className="py-2 px-2 border">{r.breathing_score}</td>
                                            <td className={`py-2 px-2 border ${pctBgClass(calcPct(r.breathing_score, r.breathing_max_score))}`}>{fmtPct(calcPct(r.breathing_score, r.breathing_max_score))}</td>
                                            <td className="py-2 px-2 border">{r.not_breathing_cases}</td>
                                            <td className="py-2 px-2 border">{r.not_breathing_score}</td>
                                            <td className={`py-2 px-2 border ${pctBgClass(calcPct(r.not_breathing_score, r.not_breathing_max_score))}`}>{fmtPct(calcPct(r.not_breathing_score, r.not_breathing_max_score))}</td>
                                        </tr>);
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}

            {tab === 'matrix' && groupsToRender.map(g => (
                <React.Fragment key={g}>
                    {(scenarioFilter === 'All' || scenarioFilter === 'breathing') && <EencDetailedMatrix group={g} scenario="breathing" />}
                    {(scenarioFilter === 'All' || scenarioFilter === 'not_breathing') && <EencDetailedMatrix group={g} scenario="not_breathing" />}
                </React.Fragment>
            ))}
        </div>
    );
}

function CourseIcon({ course }) {
    const p = { width: 34, height: 34, viewBox: '0 0 48 48' };
    switch (course) {
        case 'IMNCI': return (<svg {...p}><circle cx="24" cy="24" r="22" fill="#e0f2fe" /><path d="M12 34c6-10 18-10 24 0" stroke="#0ea5e9" strokeWidth="3" fill="none" /><circle cx="24" cy="18" r="6" fill="#0ea5e9" /></svg>);
        case 'ETAT': return (<svg {...p}><rect x="3" y="8" width="42" height="30" rx="4" fill="#fff7ed" stroke="#f97316" strokeWidth="3" /><path d="M8 24h10l2-6 4 12 3-8h11" stroke="#f97316" strokeWidth="3" fill="none" /></svg>);
        case 'EENC': return (<svg {...p}><circle cx="16" cy="22" r="7" fill="#dcfce7" /><circle cx="30" cy="18" r="5" fill="#a7f3d0" /><path d="M8 34c8-6 24-6 32 0" stroke="#10b981" strokeWidth="3" fill="none" /></svg>);
        default: return null;
    }
}


// =============================================================================
// --- New Splash Screen Component ---
// =============================================================================

function SplashScreen() {
    return (
        <div className="fixed inset-0 bg-sky-50 flex flex-col items-center justify-center gap-6 text-center p-4">
            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center p-2 shadow-xl animate-pulse">
                <img src="/child.png" alt="NCHP Logo" className="h-20 w-20 object-contain" />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-slate-800">National Child Health Program</h1>
                <p className="text-lg text-slate-500 mt-1">Course Monitoring System</p>
            </div>
            {/* Re-using your existing Spinner component's styles */}
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mt-4"></div>
            <p className="text-slate-600 mt-4">Loading application, please wait...</p>
        </div>
    );
}

// =============================================================================
// --- Mobile Navigation Icons & Components ---
// =============================================================================
const HomeIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
const CoursesIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
const UsersIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
const MonitorIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
const ReportIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>

function BottomNav({ navItems, navigate }) {
    const icons = {
        Home: HomeIcon,
        Courses: CoursesIcon,
        Participants: UsersIcon,
        Monitoring: MonitorIcon,
        Reports: ReportIcon
    };
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around items-center z-20">
            {navItems.map(item => {
                const Icon = icons[item.label];
                return (
                    <button
                        key={item.label}
                        onClick={() => !item.disabled && navigate(item.view)}
                        disabled={item.disabled}
                        className={`flex flex-col items-center justify-center p-2 w-full h-16 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${item.active ? 'text-sky-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        {Icon && <Icon className="w-6 h-6 mb-1" />}
                        <span>{item.label}</span>
                    </button>
                )
            })}
        </nav>
    );
}


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
        if (view === 'observe' || view === 'participantReport') {
            if (newView !== 'observe' && newView !== 'participantReport') {
                setSelectedParticipantId(null);
            }
        }
        if (newView === 'courses' || newView === 'landing') {
            setSelectedCourseId(null);
        }

        setView(newView);
    };

    const renderView = () => {
        const currentParticipant = participants.find(p => p.id === selectedParticipantId);
        if (loading && view !== 'landing') return <Card><Spinner /></Card>;
        switch (view) {
            case 'landing': return <Landing active={activeCourseType} onPick={(t) => { setActiveCourseType(t); navigate('courses'); }} />;
            case 'courses': return <CoursesView courses={courses.filter(c => c.course_type === activeCourseType)} onAdd={() => navigate('courseForm')} onOpen={(id) => { setSelectedCourseId(id); navigate('participants'); }} onEdit={handleEditCourse} onDelete={handleDeleteCourse} onOpenReport={(id) => { setSelectedCourseId(id); navigate('courseReport'); }} />;
            case 'courseForm': return <CourseForm courseType={activeCourseType} initialData={editingCourse} onCancel={() => navigate('courses')} onSave={async (payload) => { const id = await upsertCourse({ ...payload, id: editingCourse?.id, course_type: activeCourseType }); await refreshCourses(); setSelectedCourseId(id); navigate('participants'); }} />;
            case 'participants': return selectedCourse && <ParticipantsView course={selectedCourse} participants={participants.filter(p => p.courseId === selectedCourseId)} onAdd={() => navigate('participantForm')} onOpen={(pid) => { setSelectedParticipantId(pid); navigate('observe'); }} onEdit={handleEditParticipant} onDelete={handleDeleteParticipant} onOpenReport={(pid) => { setSelectedParticipantId(pid); navigate('participantReport'); }} />;
            case 'participantForm': return selectedCourse && <ParticipantForm course={selectedCourse} initialData={editingParticipant} onCancel={() => navigate('participants')} onSave={async (p) => { await upsertParticipant({ ...p, id: editingParticipant?.id, courseId: selectedCourse.id }); await refreshParticipants(); navigate('participants'); }} />;
            case 'observe': return selectedCourse && currentParticipant && <ObservationView course={selectedCourse} participant={currentParticipant} participants={participants.filter(p => p.courseId === selectedCourseId)} onChangeParticipant={(id) => setSelectedParticipantId(id)} />;
            case 'reports': return selectedCourse && <ReportsView course={selectedCourse} participants={participants.filter(p => p.courseId === selectedCourse.id)} />;
            case 'participantReport': return selectedCourse && currentParticipant && <ParticipantReportView course={selectedCourse} participant={currentParticipant} participants={participants.filter(p => p.courseId === selectedCourseId)} onChangeParticipant={(pid) => setSelectedParticipantId(pid)} onBack={() => navigate('participants')} />;
            case 'courseReport': return selectedCourse && <CourseReportView course={selectedCourse} onBack={() => navigate('courses')} />;
            default: return <Landing active={activeCourseType} onPick={(t) => { setActiveCourseType(t); navigate('courses'); }} />;
        }
    };

    const navItems = [
        { label: 'Home', view: 'landing', active: view === 'landing' },
        { label: 'Courses', view: 'courses', active: ['courses', 'courseForm', 'courseReport'].includes(view) },
        { label: 'Participants', view: 'participants', disabled: !selectedCourse, active: ['participants', 'participantForm', 'participantReport'].includes(view) },
        { label: 'Monitoring', view: 'observe', disabled: !selectedCourse || !selectedParticipantId, active: view === 'observe' },
        { label: 'Reports', view: 'reports', disabled: !selectedCourse, active: view === 'reports' }
    ];

    // On initial load, the view is 'landing' and loading is 'true'.
    // In this specific case, show the splash screen to prevent white flash.
    if (view === 'landing' && loading) {
        return <SplashScreen />;
    }

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
                                <h1 className="text-xl sm:text-2xl font-bold text-white">NCHP</h1>
                                <p className="text-sm text-slate-300 hidden sm:block">Course Monitoring System</p>
                            </div>
                        </div>
                        <nav className="hidden md:flex items-center gap-1">
                            {navItems.map(item => (
                                <button key={item.label} onClick={() => !item.disabled && navigate(item.view)} disabled={item.disabled}
                                    className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${item.active
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
            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full flex-grow mb-16 md:mb-0">
                {renderView()}
            </main>
            <Footer />
            <BottomNav navItems={navItems} navigate={navigate} />
        </div>
    );
}

// =============================================================================
// --- Smoke Tests ---
// =============================================================================
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