import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING, ETAT_DOMAINS, SKILLS_ETAT, ETAT_DOMAIN_LABEL, DOMAINS_BY_AGE_IMNCI, DOMAIN_LABEL_IMNCI, CLASS_2_59M, CLASS_0_59D } from './Constants.js';
import React from 'react';
import { Button } from "../components/UI.jsx";

export const calcPct = (c, s) => (!s ? NaN : (c * 100) / s);
export const fmtPct = v => (!isFinite(v) ? "—" : Math.round(v).toFixed(0) + " %");
export const pctBgClass = v => (!isFinite(v) ? "" : v < 50 ? "bg-red-100 text-red-800" : v <= 80 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800");

export const getClassListImnci = (age, d) => (age === "GE2M_LE5Y" ? CLASS_2_59M[d] : CLASS_0_59D[d]) || [];

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


export function CourseIcon({ course }) {
    const p = { width: 34, height: 34, viewBox: '0 0 48 48' };
    switch (course) {
        case 'IMNCI': return (<svg {...p}><circle cx="24" cy="24" r="22" fill="#e0f2fe" /><path d="M12 34c6-10 18-10 24 0" stroke="#0ea5e9" strokeWidth="3" fill="none" /><circle cx="24" cy="18" r="6" fill="#0ea5e9" /></svg>);
        case 'ETAT': return (<svg {...p}><rect x="3" y="8" width="42" height="30" rx="4" fill="#fff7ed" stroke="#f97316" strokeWidth="3" /><path d="M8 24h10l2-6 4 12 3-8h11" stroke="#f97316" strokeWidth="3" fill="none" /></svg>);
        case 'EENC': return (<svg {...p}><circle cx="16" cy="22" r="7" fill="#dcfce7" /><circle cx="30" cy="18" r="5" fill="#a7f3d0" /><path d="M8 34c8-6 24-6 32 0" stroke="#10b981" strokeWidth="3" fill="none" /></svg>);
        default: return null;
    }
}
