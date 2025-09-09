import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    Card, PageHeader, Button, FormGroup, Select, Table, EmptyState, Spinner, PdfIcon
} from "./CommonComponents";
import {
    SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAINS_BREATHING, EENC_DOMAINS_NOT_BREATHING,
    EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING,
    SKILLS_ETAT, ETAT_DOMAINS, ETAT_DOMAIN_LABEL,
    DOMAINS_BY_AGE_IMNCI, DOMAIN_LABEL_IMNCI, getClassListImnci,
    pctBgClass, fmtPct, calcPct, formatAsPercentageAndCount, formatAsPercentageAndScore
} from './constants.js';
import {
    listAllDataForCourse
} from "../data.js";


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

// MODIFIED: Generates a portrait PDF for detailed reports
const generateDetailedReportPdf = (reportData, courseType, age, scenario, participants, dayFilter, groupFilter) => {
    const doc = new jsPDF('portrait');
    doc.setFontSize(10);

    const isEENC = courseType === 'EENC';

    const getAgeLabel = () => {
        if (courseType === 'IMNCI') return `Age Group: ${age === 'LT2M' ? '0-59 days' : '2-59 months'}`;
        if (courseType === 'ETAT') return `Report Type: ETAT`;
        if (courseType === 'EENC') return `Scenario: ${scenario === 'breathing' ? 'Breathing Baby' : 'Not Breathing Baby'}`;
        return '';
    };

    const generateTable = (groupName, tableHead, tableBody, pageTitle, startY = 15) => {
        if (tableBody.length === 0) return startY;

        if (startY + 30 > doc.internal.pageSize.height) { // Check for space for title and table
            doc.addPage();
            startY = 15;
        }

        doc.setFontSize(10);
        doc.text(pageTitle, 14, startY);
        doc.setFontSize(8);
        doc.text(`Group: ${groupName} | Filters: Day ${dayFilter}, Group ${groupFilter}`, 14, startY + 5);

        autoTable(doc, {
            head: tableHead,
            body: tableBody,
            startY: startY + 10,
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], fontStyle: 'bold' },
            styles: { fontSize: 6, cellPadding: 1, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 40 }, // Classification column
            },
            didDrawCell: (data) => {
                if (data.column.index > 0 && data.cell.text.toString().includes('(')) {
                    const percentage = parseFloat(data.cell.text.toString().match(/\((\d+)\s*%\)/)?.[1]);
                    let color = [255, 255, 255];
                    if (percentage < 50) color = [254, 226, 226]; // bg-red-100
                    else if (percentage <= 80) color = [254, 243, 199]; // bg-yellow-100
                    else color = [220, 252, 231]; // bg-green-100
                    doc.setFillColor(...color);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                    doc.setTextColor(51);
                    doc.text(data.cell.text, data.cell.x + data.cell.padding('left'), data.cell.y + data.cell.height / 2, { align: 'left', baseline: 'middle' });
                }
            }
        });
        return doc.lastAutoTable.finalY + 15;
    };

    const groupsToRender = groupFilter === 'All' ? ['Group A', 'Group B', 'Group C', 'Group D'] : [groupFilter];

    let finalY = 15;
    groupsToRender.forEach(g => {
        const parts = participants.filter(p => p.group === g).sort((a, b) => a.name.localeCompare(b.name));
        if (parts.length === 0) return;

        let tableHead = [['Classification', ...parts.map(p => p.name)]];
        let tableBody = [];

        if (isEENC) {
            const scenariosToRender = (scenario === 'All') ? ['breathing', 'not_breathing'] : [scenario];
            scenariosToRender.forEach(s => {
                const skillsMap = s === 'breathing' ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
                const labelsMap = s === 'breathing' ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING;

                tableBody.push([{ content: `${s === 'breathing' ? 'Breathing Baby' : 'Not Breathing Baby'}`, colSpan: parts.length + 1, styles: { fontStyle: 'bold', fillColor: '#e0e0e0' } }]);

                Object.keys(skillsMap).forEach(domain => {
                    tableBody.push([{ content: labelsMap[domain], colSpan: parts.length + 1, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } }]);
                    skillsMap[domain].forEach(skill => {
                        const participantCells = parts.map(p => {
                            const skillObs = reportData.filter(o => o.participant_id === p.id && o.item_recorded === skill.text && o.age_group === `EENC_${s}`);
                            const totalScore = skillObs.reduce((acc, o) => acc + o.item_correct, 0);
                            const maxScore = skillObs.length * 2;
                            return formatAsPercentageAndScore(totalScore, maxScore);
                        });
                        tableBody.push([skill.text, ...participantCells]);
                    });
                });
            });
        } else if (courseType === 'IMNCI') {
            const domains = DOMAINS_BY_AGE_IMNCI[age];
            for (const d of domains) {
                tableBody.push([{ content: DOMAIN_LABEL_IMNCI[d], colSpan: parts.length + 1, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } }]);
                const items = getClassListImnci(age, d) || [];
                for (const item of items) {
                    const participantCells = parts.map(p => {
                        const allObsForSkill = reportData.filter(o => o.participant_id === p.id && o.item_recorded === item);
                        const correctCount = allObsForSkill.filter(o => o.item_correct === 1).length;
                        return formatAsPercentageAndCount(correctCount, allObsForSkill.length);
                    });
                    tableBody.push([item, ...participantCells]);
                }
            }
        } else if (courseType === 'ETAT') {
            for (const domain in SKILLS_ETAT) {
                tableBody.push([{ content: ETAT_DOMAIN_LABEL[domain], colSpan: parts.length + 1, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } }]);
                for (const skill of SKILLS_ETAT[domain]) {
                    const participantCells = parts.map(p => {
                        const allObsForSkill = reportData.filter(o => o.participant_id === p.id && o.item_recorded === skill);
                        const correctCount = allObsForSkill.filter(o => o.item_correct === 1).length;
                        return formatAsPercentageAndCount(correctCount, allObsForSkill.length);
                    });
                    tableBody.push([skill, ...participantCells]);
                }
            }
        }

        if (finalY + 20 > doc.internal.pageSize.height) { doc.addPage(); finalY = 15; }
        finalY = generateTable(g, tableHead, tableBody, getAgeLabel(), finalY);
    });

    doc.save(`Detailed_Report_${courseType}.pdf`);
};

export function ReportsView({ course, participants }) {
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

    const handleExportDetailedReportPdf = () => {
        generateDetailedReportPdf(filteredObs, course.course_type, age, null, participants, dayFilter, groupFilter);
    };

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
                {tab === 'matrix' ? (
                    <Button onClick={handleExportDetailedReportPdf}><PdfIcon /> Save Detailed Report as PDF</Button>
                ) : (
                    <Button onClick={handleExportFullReportPdf}><PdfIcon /> Save Summary Report as PDF</Button>
                )}
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

    const handleExportDetailedReportPdf = () => {
        generateDetailedReportPdf(filteredObs, course.course_type, null, null, participants, dayFilter, groupFilter);
    };

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
            <div className="flex flex-wrap gap-3 mb-4"><Button variant={tab === 'case' ? 'primary' : 'secondary'} onClick={() => setTab('case')}>Case Summary</Button><Button variant={tab === 'class' ? 'primary' : 'secondary'} onClick={() => setTab('class')}>Classification Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Report</Button></div>

            <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-md mb-6">
                <div className="flex gap-4 items-center">
                    <FormGroup label="Day of Training"><Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}><option value="All">All Days</option>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}</Select></FormGroup>
                    <FormGroup label="Group"><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="All">All Groups</option><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                </div>
                {tab === 'matrix' ? (
                    <Button onClick={handleExportDetailedReportPdf}><PdfIcon /> Save Detailed Report as PDF</Button>
                ) : (
                    <Button onClick={handleExportFullReportPdf}><PdfIcon /> Save Summary Report as PDF</Button>
                )}
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
                        <div className="max-h-[70vh] overflow-y-auto">
                            <table className="w-full text-xs table-fixed">
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

    const handleExportDetailedReportPdf = () => {
        generateDetailedReportPdf(filteredObs, course.course_type, null, scenarioFilter, participants, dayFilter, groupFilter);
    };

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
                    const hasData = parts.some(p => filteredObs.some(o => o.participant_id === p.id && o.age_group === `EENC_${scenario}`));
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
                                const skillObservations = filteredObs.filter(o => o.participant_id === p.id && o.item_recorded === skill.text && o.age_group === `EENC_${scenario}`);
                                if (skillObservations.length === 0) return "N/A";
                                const totalScore = skillObservations.reduce((acc, o) => acc + o.item_correct, 0);
                                const maxPossibleScore = skillObservations.length * 2;
                                const percentage = calcPct(totalScore, maxPossibleScore);
                                const avgScore = (totalScore / skillObservations.length).toFixed(1);
                                return `${avgScore} (${fmtPct(percentage)})`;
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
        const hasData = parts.some(p => filteredObs.some(o => o.participant_id === p.id && o.age_group === `EENC_${scenario}`));
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
                                            const skillObservations = filteredObs.filter(o => o.participant_id === p.id && o.item_recorded === skill.text && o.age_group === `EENC_${scenario}`);
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
                {tab === 'matrix' ? (
                    <Button onClick={handleExportDetailedReportPdf}><PdfIcon /> Save Detailed Report as PDF</Button>
                ) : (
                    <Button onClick={handleExportFullReportPdf}><PdfIcon /> Save Summary Report as PDF</Button>
                )}
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

// Sub-component for EENC detailed matrix, local to this file
const EencDetailedMatrix = ({ group, scenario, participants, filteredObs, scenarioFilter }) => {
    const parts = participants.filter(p => p.group === group).sort((a, b) => a.name.localeCompare(b.name));
    const skillsMap = scenario === 'breathing' ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
    const domains = Object.keys(skillsMap);
    const labelsMap = scenario === 'breathing' ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING;

    if (parts.length === 0) return null;
    const hasData = parts.some(p => filteredObs.some(o => o.participant_id === p.id && o.age_group === `EENC_${scenario}`));
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
                                        const skillObservations = filteredObs.filter(o => o.participant_id === p.id && o.item_recorded === skill.text && o.age_group === `EENC_${scenario}`);
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