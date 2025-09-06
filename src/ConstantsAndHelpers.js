import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ----------------------------- CONSTANTS ------------------------------
export const STATE_LOCALITIES = {
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
export const COURSE_TYPES_FACILITATOR = ["IMNCI", "ETAT", "EENC", "IPC"];
export const SKILLS_EENC_BREATHING = { pre_birth: [{ text: "Checked room temperature and turned off fans" }, { text: "Told the mother (and her support person) what is going to be done" }, { text: "Washed hands (first of two hand washings)" }, { text: "Placed dry cloth on mother's abdomen" }, { text: "Prepared the newborn resuscitation area" }, { text: "Checked that bag and mask are functional" }, { text: "Washed hands (second of two hand washings)" }, { text: "Put on two pairs of clean gloves" }, { text: "Put forceps, cord clamp in easy-to-use order" }], eenc: [{ text: "Call out time of birth" }, { text: "Start Drying within 5 seconds of birth" }, { text: "Dry the baby thoroughly" }, { text: "Stimulate baby by gently rubbing" }, { text: "Suction only if airway blocked" }, { text: "Remove the wet cloth" }, { text: "Put baby in direct skin-to-skin contact" }, { text: "Cover baby’s body with dry cloth and the head with a hat" }], oxytocin: [{ text: "Check for a second baby" }, { text: "Give oxytocin to mother within 1 minute of delivery" }], cord_clamp: [{ text: "Removed outer pair of gloves" }, { text: "Check cord pulsations, clamp after cord pulsations stopped" }, { text: "Place clamp at 2 cm, forceps at 5 cm" }], placenta: [{ text: "Delivered placenta" }, { text: "Counsel mother on feeding cues" }] };
export const SKILLS_EENC_NOT_BREATHING = { pre_birth: [{ text: "Checked room temperature and turned off fans" }, { text: "Told the mother what is going to be done" }, { text: "Washed hands (first of two hand washings)" }, { text: "Placed dry cloth on mother's abdomen" }, { text: "Prepared the newborn resuscitation area" }, { text: "Checked that bag and mask are functional" }, { text: "Washed hands (second of two hand washings)" }, { text: "Put on two pairs of clean gloves" }, { text: "Put forceps, cord clamp in easy-to-use order" }], eenc_initial: [{ text: "Called out time of birth" }, { text: "Started Drying within 5 seconds of birth" }, { text: "Dried the baby thoroughly" }, { text: "Stimulated baby by gently rubbing" }, { text: "Suction only if airway blocked" }, { text: "Removed the wet cloth" }, { text: "Put baby in direct skin-to-skin contact" }, { text: "Covered baby’s body with cloth and the head with a hat" }], if_not_breathing: [{ text: "Called for help" }, { text: "Removed outer pair of gloves" }, { text: "Quickly clamped and cut cord" }, { text: "Moved baby to resuscitation area" }, { text: "Covered baby quickly during and after transfer" }], resuscitation: [{ text: "Positioned the head correctly to open airways" }, { text: "Applied face mask firmly" }, { text: "Gain chest rise within < 1 min of birth" }, { text: "Squeezed bag to give 30–50 breaths per minute" }, { text: "If chest not rising: Reposition head, reposition mask, check airway, squeeze harder" }], if_breathing_starts: [{ text: "Stop ventilation and monitor every 15 minutes" }, { text: "Return baby to skin-to-skin contact and cover baby" }, { text: "Counsel mother that baby is OK" }], post_resuscitation: [{ text: "Check for a second baby" }, { text: "Give oxytocin to mother within 1 minute of delivery" }, { text: "Delivered placenta" }, { text: "Counsel mother on feeding cues" }], if_not_breathing_after_10_min: [{ text: "If heart rate, continue ventilation, Refer and transport" }, { text: "If no heart rate, stop ventilation, provide emotional support" }] };
export const EENC_DOMAIN_LABEL_BREATHING = { pre_birth: "Pre-birth preparations", eenc: "Early Essential Newborn Care", oxytocin: "Give Oxytocin to mother", cord_clamp: "Clamp the cord", placenta: "Deliver the placenta and counsel the mother" };
export const EENC_DOMAINS_BREATHING = Object.keys(SKILLS_EENC_BREATHING);
export const EENC_DOMAIN_LABEL_NOT_BREATHING = { pre_birth: "Pre-birth preparations", eenc_initial: "Initial EENC Steps (40 sec)", if_not_breathing: "If baby not crying or not breathing", resuscitation: "Resuscitation", if_breathing_starts: "If baby starts breathing well", post_resuscitation: "Post-resuscitation care", if_not_breathing_after_10_min: "If baby not breathing after 10 minutes" };
export const EENC_DOMAINS_NOT_BREATHING = Object.keys(SKILLS_EENC_NOT_BREATHING);
export const SKILLS_ETAT = { triage: ["Triage Assessment", "Assigns Triage Category"], airway_breathing: ["Positions Airway", "Suctions", "Gives Oxygen", "Bag-Mask Ventilation"], circulation: ["Inserts IV/IO", "Gives IV fluids", "Checks blood sugar"], coma: ["Positions unresponsive child", "Gives IV fluids"], convulsion: ["Positions convulsing child", "Gives Diazepam"], dehydration: ["Assesses dehydration", "Gives IV fluids", "Reassesses"] };
export const ETAT_DOMAIN_LABEL = { triage: "Triage", airway_breathing: "Airway and Breathing", circulation: "Circulation", coma: "Coma", convulsion: "Convulsion", dehydration: "Dehydration (Severe)" };
export const ETAT_DOMAINS = Object.keys(SKILLS_ETAT);
export const CLASS_2_59M = { danger: ["Any Danger Sign"], respiratory: ["Severe pneumonia/disease", "Pneumonia", "Cough/cold", "Severe pneumonia/disease (Wheeze)", "Pneumonia (Wheeze)", "Cough/cold (Wheeze)"], diarrhoea: ["Severe dehydration", "Some dehydration", "No dehydration", "Severe persistent", "Persistent", "Dysentery"], fever_malaria: ["Very severe febrile disease", "Malaria", "Fever - malaria unlikely", "Severe complicated measles", "Measles - Eye/mouth complications", "Measles"], ear: ["Mastoiditis", "Acute ear infection", "Chronic ear infection", "No ear infection"], malnutrition: ["Complicated Severe Acute malnutrition (SAM)", "Un-complicated Severe Acute malnutrition (SAM)", "Moderate Acute malnutrition (MAM)", "No Acute Malnutrition"], anaemia: ["Severe Anaemia", "Anaemia", "No anaemia"], identify_treatment: ["IDENTIFY TREATMENTS NEEDED"], treatment_2_59m: ["ORAL DRUGS", "PLAN A", "PLAN B", "LOCAL INFECTION"], counsel: ["Assess and counsel for vaccination", "Asks feeding questions", "Feeding problems identified", "Gives advice on feeding problems", "COUNSEL WHEN TO RETURN"], };
export const CLASS_0_59D = { bacterial: ["Possible serious bacterial infection", "Local bacterial infection", "Bacterial infection unlikely"], jaundice: ["Severe Jaundice", "Jaundice", "No Jaundice"], vyi_diarrhoea: ["Severe dehydration", "Some dehydration", "No dehydration", "Persistent diarrhea", "Blood in Stool"], feeding: ["Breastfeeding attachment and suckling assessed", "Feeding problem or low weight", "No feeding problem"], identify_treatment: ["IDENTIFY TREATMENTS NEEDED"], treatment_0_59d: ["Teach correct positioning and attachment", "Advise on home care"], };
export const DOMAINS_BY_AGE_IMNCI = { GE2M_LE5Y: ["danger", "respiratory", "diarrhoea", "fever_malaria", "ear", "malnutrition", "anaemia", "identify_treatment", "treatment_2_59m", "counsel"], LT2M: ["bacterial", "jaundice", "vyi_diarrhoea", "feeding", "identify_treatment", "treatment_0_59d"], };
export const DOMAIN_LABEL_IMNCI = { danger: "Danger signs", respiratory: "COUGH:", diarrhoea: "DIARRHOEA:", fever_malaria: "FEVER:", ear: "EAR:", malnutrition: "MALNUTRITION:", anaemia: "ANAEMIA:", identify_treatment: "IDENTIFY TREATMENT:", treatment_2_59m: "TREAT:", counsel: "COUNSEL:", bacterial: "BACTERIAL:", jaundice: "JAUNDICE:", vyi_diarrhoea: "DIARRHOEA:", feeding: "FEEDING:", treatment_0_59d: "TREATMENT/COUNSEL:" };
export const getClassListImnci = (age, d) => (age === "GE2M_LE5Y" ? CLASS_2_59M[d] : CLASS_0_59D[d]) || [];
export const JOB_TITLES_IMNCI = ["Pediatric Doctor", "Family Medicine Doctor", "General Practioner", "Medical Assistance", "Treating Nurse", "Other"];
export const JOB_TITLES_ETAT = ["Pediatric Specialist", "Pediatric registrar", "Family Medicine Doctor", "Emergency doctor", "General Practioner", "Nurse Diploma", "Nurse Bachelor", "Other"];
export const JOB_TITLES_EENC = ["Pediatric doctor", "Obstetric Doctor", "Emergency doctor", "General Practioner", "Nurse Diploma", "Nurse Bachelor", "Sister Midwife", "Midwife", "Other"];

// ----------------------------- HELPER FUNCTIONS --------------------------------
export const calcPct = (c, s) => (!s ? NaN : (c * 100) / s);
export const fmtPct = v => (!isFinite(v) ? "—" : Math.round(v).toFixed(0) + " %");
export const pctBgClass = v => (!isFinite(v) ? "" : v < 50 ? "bg-red-100 text-red-800" : v <= 80 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800");

// --- PDF Export Helper ---
export const exportToPdf = (title, head, body, fileName, orientation = 'portrait') => {
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

export const generateCoursePdf = (course, participants, allCases, allObs) => {
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
        const correctObs = pObs.filter(o => o.item_correct > 0).length; // EENC partial counts as correct here
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

export const generateParticipantPdf = async (participant, course, cases, observations, chartRefs) => {
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
    const correctObs = observations.filter(o => o.item_correct > 0).length;
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

export const generateFullCourseReportPdf = async (course, groupPerformance, chartRef) => {
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

export const generateFacilitatorPdf = (facilitator, allCourses, directedChartRef, facilitatedChartRef) => {
    const doc = new jsPDF();
    const fileName = `Facilitator_Report_${facilitator.name.replace(/ /g, '_')}.pdf`;
    const filtered = allCourses.filter(c => c.director === facilitator.name || (c.facilitators || []).includes(facilitator.name));
    const directedCourses = filtered.filter(c => c.director === facilitator.name);
    const facilitatedCourses = filtered.filter(c => (c.facilitators || []).includes(facilitator.name));

    // Title
    doc.setFontSize(22);
    doc.text("Facilitator Report", 105, 20, { align: 'center' });
    doc.setFontSize(18);
    doc.text(facilitator.name, 105, 30, { align: 'center' });

    let finalY = 40;

    // Information Table
    doc.setFontSize(14);
    doc.text("Facilitator Information", 14, finalY);
    const infoBody = [
        ['Name', facilitator.name], ['Phone', facilitator.phone], ['Email', facilitator.email || 'N/A'],
        ['Current Location', `${facilitator.currentState || ''} / ${facilitator.currentLocality || ''}`],
        ...COURSE_TYPES_FACILITATOR.map(c => [
            `${c} Facilitator`,
            facilitator.courses?.includes(c) ? `Yes (ToT: ${facilitator.totDates?.[c] || 'N/A'})` : 'No'
        ]),
        ['IMNCI Course Director', `${facilitator.directorCourse} ${facilitator.directorCourse === 'Yes' ? '(' + (facilitator.directorCourseDate || 'N/A') + ')' : ''}`],
        ['IMNCI Follow-up Course', `${facilitator.followUpCourse} ${facilitator.followUpCourse === 'Yes' ? '(' + (facilitator.followUpCourseDate || 'N/A') + ')' : ''}`],
        ['IMNCI Team Leader Course', `${facilitator.teamLeaderCourse} ${facilitator.teamLeaderCourse === 'Yes' ? '(' + (facilitator.teamLeaderCourseDate || 'N/A') + ')' : ''}`],
        ['Clinical Instructor', facilitator.isClinicalInstructor || 'No'],
        ['Comments', facilitator.comments || 'None']
    ];
    autoTable(doc, {
        startY: finalY + 5,
        head: [['Field', 'Details']],
        body: infoBody,
        theme: 'striped',
        headStyles: { fillColor: [8, 145, 178] },
    });
    finalY = doc.lastAutoTable.finalY;

    // Charts
    if (finalY > 180) { doc.addPage(); finalY = 20; }
    const directedImg = directedChartRef.current?.canvas.toDataURL('image/png');
    const facilitatedImg = facilitatedChartRef.current?.canvas.toDataURL('image/png');

    doc.setFontSize(14);
    doc.text("Performance Summary", 14, finalY + 15);
    if (directedImg) doc.addImage(directedImg, 'PNG', 14, finalY + 20, 90, 60);
    if (facilitatedImg) doc.addImage(facilitatedImg, 'PNG', 105, finalY + 20, 90, 60);
    finalY += 85;


    // Course Tables
    if (directedCourses.length > 0) {
        if (finalY > 250) { doc.addPage(); finalY = 20; }
        autoTable(doc, {
            startY: finalY,
            head: [['Directed Courses', 'Date', 'Location']],
            body: directedCourses.map(c => [c.course_type, c.start_date, c.state]),
            didDrawPage: (data) => { doc.text("Directed Courses", 14, data.settings.margin.top - 10); }
        });
        finalY = doc.lastAutoTable.finalY + 10;
    }

    if (facilitatedCourses.length > 0) {
        if (finalY > 250) { doc.addPage(); finalY = 20; }
        autoTable(doc, {
            startY: finalY,
            head: [['Facilitated Courses', 'Date', 'Location']],
            body: facilitatedCourses.map(c => [c.course_type, c.start_date, c.state]),
            didDrawPage: (data) => { doc.text("Facilitated Courses", 14, data.settings.margin.top - 10); }
        });
    }

    doc.save(fileName);
};

export const generateFacilitatorComparisonPdf = (facilitators, allCourses, courseFilter) => {
    const doc = new jsPDF('landscape');
    const title = `Facilitator Comparison Report (${courseFilter} Courses)`;
    doc.text(title, 14, 15);

    const comparisonData = facilitators.map(f => {
        const directed = allCourses.filter(c => c.director === f.name && (courseFilter === 'All' || c.course_type === courseFilter));
        const facilitated = allCourses.filter(c => (c.facilitators || []).includes(f.name) && (courseFilter === 'All' || c.course_type === courseFilter));
        const totalDays = [...new Set([...directed, ...facilitated])].reduce((sum, c) => sum + (c.course_duration || 0), 0);

        return {
            id: f.id, name: f.name,
            directedCount: directed.length,
            facilitatedCount: facilitated.length,
            totalDays: totalDays,
            isDirector: f.directorCourse === 'Yes',
            isClinicalInstructor: f.isClinicalInstructor === 'Yes'
        };
    }).sort((a, b) => b.totalDays - a.totalDays);

    const head = [['Facilitator', 'Directed', 'Facilitated', 'Total Days', 'Course Director?', 'Clinical Instructor?']];
    const body = comparisonData.map(f => [
        f.name, f.directedCount, f.facilitatedCount, f.totalDays,
        f.isDirector ? 'Yes' : 'No',
        f.isClinicalInstructor ? 'Yes' : 'No'
    ]);

    autoTable(doc, { head, body, startY: 25 });
    doc.save('Facilitator_Comparison_Report.pdf');
};
