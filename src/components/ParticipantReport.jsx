import React, { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Bar } from 'react-chartjs-2';
import { getElementAtEvent } from 'react-chartjs-2';
import {
    Card, PageHeader, Button, FormGroup, Select, Table, EmptyState, Spinner, PdfIcon, Modal
} from "./CommonComponents";
import {
    calcPct, fmtPct, pctBgClass,
    DOMAIN_LABEL_IMNCI, ETAT_DOMAIN_LABEL, EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING,
    ETAT_DOMAINS, DOMAINS_BY_AGE_IMNCI
} from './constants.js';
import {
    listObservationsForParticipant,
    listCasesForParticipant
} from "../data.js";

// --- Reusable Share Icon for the button ---
const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
    </svg>
);


export function ParticipantReportView({ course, participant, participants, onChangeParticipant, onBack, onNavigateToCase, onShare, isSharedView = false }) {
    const [observations, setObservations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    
    // Filters for the 'All Cases' table
    const [settingFilter, setSettingFilter] = useState('all');
    const [dayFilter, setDayFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    
    const reportContentRef = useRef(null);
    const caseChartByDayRef = useRef(null);

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
    
    const casesWithCorrectness = useMemo(() => {
        if (loading) return [];
        return cases.map(caseItem => {
            const caseObservations = observations.filter(obs => obs.caseId === caseItem.id);
            const is_correct = caseObservations.length > 0 && caseObservations.every(obs => obs.item_correct > 0);
            return {
                ...caseItem,
                is_correct
            };
        });
    }, [cases, observations, loading]);

    const kpiStats = useMemo(() => {
        const defaultKpis = {
            totalCases: 0, correctCases: 0, avgCasesPerDay: 0, caseCorrectnessPct: 0,
            totalSkills: 0, correctSkills: 0, avgSkillsPerDay: 0, skillCorrectnessPct: 0
        };
        if (loading || observations.length === 0) return defaultKpis;

        const totalCases = casesWithCorrectness.length;
        const correctCases = casesWithCorrectness.filter(c => c.is_correct).length;
        const totalSkills = observations.length;
        const correctSkills = observations.filter(o => o.item_correct > 0).length;

        const uniqueDays = new Set(observations.map(o => o.day_of_course).filter(Boolean));
        const numberOfDays = uniqueDays.size > 0 ? uniqueDays.size : 1;

        return {
            totalCases,
            correctCases,
            avgCasesPerDay: totalCases / numberOfDays,
            caseCorrectnessPct: calcPct(correctCases, totalCases),
            totalSkills,
            correctSkills,
            avgSkillsPerDay: totalSkills / numberOfDays,
            skillCorrectnessPct: calcPct(correctSkills, totalSkills)
        };
    }, [casesWithCorrectness, observations, loading]);
    
    const casePerformanceByDay = useMemo(() => {
        const dataByDay = {};
        casesWithCorrectness.forEach(c => {
            const day = c.day_of_course || 1;
            const setting = c.setting || 'OPD';

            if (!dataByDay[day]) {
                dataByDay[day] = {
                    opdTotal: 0, opdCorrect: 0,
                    ipdTotal: 0, ipdCorrect: 0,
                    total: 0, correct: 0
                };
            }
            
            dataByDay[day].total++;
            if (c.is_correct) dataByDay[day].correct++;

            if (setting === 'OPD') {
                dataByDay[day].opdTotal++;
                if (c.is_correct) dataByDay[day].opdCorrect++;
            } else { // Assumes 'IPD'
                dataByDay[day].ipdTotal++;
                if (c.is_correct) dataByDay[day].ipdCorrect++;
            }
        });

        return Object.entries(dataByDay).map(([day, data]) => ({
            day: parseInt(day),
            opdTotal: data.opdTotal,
            opdCorrect: data.opdCorrect,
            opdPct: calcPct(data.opdCorrect, data.opdTotal),
            ipdTotal: data.ipdTotal,
            ipdCorrect: data.ipdCorrect,
            ipdPct: calcPct(data.ipdCorrect, data.ipdTotal),
            total: data.total,
            correct: data.correct,
            totalPct: calcPct(data.correct, data.total)
        })).sort((a, b) => a.day - b.day);
    }, [casesWithCorrectness]);

    const detailedPerformance = useMemo(() => {
        if (observations.length === 0) return course.course_type === 'IMNCI' ? { LT2M: [], GE2M_LE5Y: [] } : [];

        const processSkills = (obs, isEenc) => {
            const skills = {};
            obs.forEach(o => {
                if (!skills[o.item_recorded]) {
                    skills[o.item_recorded] = { total: 0, correct: 0, score: 0, maxScore: 0 };
                }
                const s = skills[o.item_recorded];
                s.total++;
                if (o.item_correct > 0) s.correct++;
                if (isEenc) {
                    s.maxScore += 2;
                    s.score += o.item_correct;
                }
            });
            return skills;
        };

        if (course.course_type === 'IMNCI') {
            const performanceByAge = { LT2M: [], GE2M_LE5Y: [] };
            for (const ageGroup in DOMAINS_BY_AGE_IMNCI) {
                const ageGroupDomains = DOMAINS_BY_AGE_IMNCI[ageGroup];
                const ageGroupObservations = observations.filter(o => o.age_group === ageGroup);

                ageGroupDomains.forEach(domainKey => {
                    const domainObs = ageGroupObservations.filter(o => o.domain === domainKey);
                    if (domainObs.length === 0) return;

                    const uniqueCases = new Set(domainObs.map(o => o.caseId));
                    performanceByAge[ageGroup].push({
                        label: DOMAIN_LABEL_IMNCI[domainKey] || domainKey,
                        total: domainObs.length,
                        correct: domainObs.filter(o => o.item_correct > 0).length,
                        totalCases: uniqueCases.size,
                        skills: processSkills(domainObs, false)
                    });
                });
            }
            return performanceByAge;
        } else {
            let orderedDomains = [];
            let labelMap = {};
            const isEenc = course.course_type === 'EENC';

            if (course.course_type === 'ETAT') {
                orderedDomains = ETAT_DOMAINS;
                labelMap = ETAT_DOMAIN_LABEL;
            } else { // EENC
                orderedDomains = Object.keys({ ...EENC_DOMAIN_LABEL_BREATHING, ...EENC_DOMAIN_LABEL_NOT_BREATHING });
                labelMap = { ...EENC_DOMAIN_LABEL_BREATHING, ...EENC_DOMAIN_LABEL_NOT_BREATHING };
            }

            return orderedDomains.map(domainKey => {
                const domainObs = observations.filter(o => o.domain === domainKey);
                if (domainObs.length === 0) return null;

                const uniqueCases = new Set(domainObs.map(o => o.caseId));
                
                return {
                    label: labelMap[domainKey] || domainKey,
                    total: domainObs.length,
                    correct: domainObs.filter(o => o.item_correct > 0).length,
                    score: isEenc ? domainObs.reduce((sum, o) => sum + o.item_correct, 0) : 0,
                    maxScore: isEenc ? domainObs.length * 2 : 0,
                    totalCases: uniqueCases.size,
                    skills: processSkills(domainObs, isEenc)
                };
            }).filter(Boolean);
        }
    }, [observations, course.course_type]);

    const uniqueCourseDays = useMemo(() => {
        const days = new Set(casesWithCorrectness.map(c => c.day_of_course || 1));
        return Array.from(days).sort((a, b) => a - b);
    }, [casesWithCorrectness]);

    const filteredCases = useMemo(() => {
        return casesWithCorrectness.filter(c => {
            const dayOfCourse = c.day_of_course || 1;
            const settingMatch = settingFilter === 'all' || c.setting === settingFilter;
            const dayMatch = dayFilter === 'all' || dayOfCourse == dayFilter;
            const statusMatch = statusFilter === 'all' || (statusFilter === 'correct' ? c.is_correct : !c.is_correct);
            return settingMatch && dayMatch && statusMatch;
        });
    }, [casesWithCorrectness, settingFilter, dayFilter, statusFilter]);
    
    const handleDaySelect = (day) => {
        setSelectedDay(day);
    };
    
    const handleChartClick = (event) => {
        const chart = caseChartByDayRef.current;
        if (!chart) return;
        
        const elements = getElementAtEvent(chart, event);
        if (elements.length > 0) {
            const elementIndex = elements[0].index;
            const dayData = casePerformanceByDay[elementIndex];
            if (dayData) {
                handleDaySelect(dayData.day);
            }
        }
    };
    
    const handleCaseClick = (caseObject) => {
        if(onNavigateToCase) {
            onNavigateToCase(caseObject);
        }
    };

    const handleExportPdf = async (quality = 'print') => {
        setIsPdfGenerating(true);
        await new Promise(resolve => setTimeout(resolve, 100)); // allow UI to update

        try {
            const qualityProfiles = {
                print: { scale: 2, imageType: 'image/png', imageFormat: 'PNG', fileSuffix: '_Print_Quality', imageQuality: 1.0, compression: undefined },
                screen: { scale: 1.5, imageType: 'image/jpeg', imageFormat: 'JPEG', fileSuffix: '_Web_Share', imageQuality: 0.85, compression: 'MEDIUM' }
            };
            const profile = qualityProfiles[quality];
            const content = reportContentRef.current;
            if (!content) return;

            const canvas = await html2canvas(content, {
                scale: profile.scale,
                useCORS: true,
                backgroundColor: '#ffffff',
                onclone: (document) => {
                    const actions = document.getElementById('report-actions');
                    if(actions) actions.style.visibility = 'hidden';
                }
            });

            const imgData = canvas.toDataURL(profile.imageType, profile.imageQuality);
            
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / pdfWidth;
            const totalPdfHeight = canvasHeight / ratio;

            let heightLeft = totalPdfHeight;
            let position = 0;

            pdf.addImage(imgData, profile.imageFormat, 0, position, pdfWidth, totalPdfHeight, undefined, profile.compression);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, profile.imageFormat, 0, position, pdfWidth, totalPdfHeight, undefined, profile.compression);
                heightLeft -= pdfHeight;
            }
            
            const fileName = `Report_${participant.name.replace(/ /g, '_')}${profile.fileSuffix}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("An error occurred while generating the PDF.");
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const excludedImnciSubtypes = ["Standard 7 days course for Medical Doctors", "Standard 7 days course for Medical Assistance", "Refreshment IMNCI Course"];
    const showTestScores = course.course_type !== 'IMNCI' || (course.course_type === 'IMNCI' && !excludedImnciSubtypes.includes(participant.imci_sub_type));

    if (loading) return <Card><Spinner /></Card>;

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: true, position: 'top' }, title: { display: true, text: '' } },
        scales: { 
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Number of Cases'} }
        }
    };

    const preScore = Number(participant.pre_test_score);
    const postScore = Number(participant.post_test_score);
    const improvement = preScore > 0 ? ((postScore - preScore) / preScore) * 100 : 0;

    const getImprovementBgClass = (value) => {
        if (value > 50) return 'bg-green-100 text-green-800';
        if (value >= 25 && value <= 50) return 'bg-yellow-100 text-yellow-800';
        if (value < 25) return 'bg-red-100 text-red-800';
        return 'bg-gray-100 text-gray-800';
    };

    const hasKpiData = kpiStats.totalSkills > 0;
    const hasTestScores = showTestScores && (participant.pre_test_score != null || participant.post_test_score != null);
    const hasChartData = course.course_type === 'IMNCI' && casePerformanceByDay.length > 0;
    const hasDomainData = (course.course_type === 'IMNCI' && (detailedPerformance.LT2M.length > 0 || detailedPerformance.GE2M_LE5Y.length > 0)) || (course.course_type !== 'IMNCI' && detailedPerformance.length > 0);
    const hasCaseData = casesWithCorrectness.length > 0;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Participant Performance Report"
                subtitle={participant.name}
                actions={!isSharedView && <div id="report-actions" className="flex flex-wrap gap-2 items-center">
                    <div className="w-48">
                        <Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)} disabled={isPdfGenerating}>
                            {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </div>
                     <Button onClick={() => onShare(participant)} variant="secondary" disabled={isPdfGenerating}>
                        <ShareIcon /> Share
                     </Button>
                     {isPdfGenerating ? (
                        <Button disabled variant="secondary"><Spinner /> Generating...</Button>
                     ) : (
                        <>
                            <Button onClick={() => handleExportPdf('print')} variant="secondary"><PdfIcon /> Export for Print</Button>
                            <Button onClick={() => handleExportPdf('screen')} variant="secondary"><PdfIcon /> Export for Sharing</Button>
                        </>
                     )}
                    <Button onClick={onBack} disabled={isPdfGenerating}>Back to List</Button>
                </div>}
            />

            <div ref={reportContentRef} className="grid gap-6 bg-white p-4 sm:p-6">
                {selectedDay && (
                    <Modal isOpen={!!selectedDay} onClose={() => setSelectedDay(null)} title={`Case Details for Day ${selectedDay}`}>
                        <div className="p-4 max-h-[70vh] overflow-y-auto">
                            <Table headers={["Case #", "Final Classification", "Skills Observed", "Overall Status"]}>
                            {casesWithCorrectness.filter(c => (c.day_of_course || 1) === selectedDay).length === 0 ? (
                                <EmptyState message="No cases found for this day." />
                            ) : (
                                    casesWithCorrectness
                                        .filter(c => (c.day_of_course || 1) === selectedDay)
                                        .map((c, index) => {
                                            const caseObservations = observations.filter(obs => obs.caseId === c.id);
                                            return (
                                                <tr key={c.id} className="hover:bg-gray-100 cursor-pointer" onClick={() => handleCaseClick(c)}>
                                                    <td className="p-2 border align-top">{index + 1}</td>
                                                    <td className="p-2 border align-top">{c.final_classification || 'N/A'}</td>
                                                    <td className="p-2 border align-top">
                                                        {caseObservations.length > 0 ? (
                                                            <ul className="list-disc pl-5 space-y-1">
                                                                {caseObservations.map(obs => (
                                                                    <li key={obs.id} className={obs.item_correct > 0 ? 'text-gray-700' : 'text-red-600 font-semibold'}>
                                                                        {obs.item_recorded}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : 'No skills recorded'}
                                                    </td>
                                                    <td className={`p-2 border align-top font-semibold ${c.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                                                        {c.is_correct ? 'Correct' : 'Incorrect'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                            )}
                            </Table>
                        </div>
                    </Modal>
                )}

                {(hasKpiData || hasTestScores) && (
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Performance KPIs</h3>
                        {hasKpiData && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-lg font-semibold mb-2 text-gray-700">Case KPIs</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                        <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm text-gray-600">Total Cases</div><div className="text-3xl font-bold text-sky-700">{kpiStats.totalCases}</div></div>
                                        <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm text-gray-600">Correct Cases</div><div className="text-3xl font-bold text-sky-700">{kpiStats.correctCases}</div></div>
                                        <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm text-gray-600">Avg Cases / Day</div><div className="text-3xl font-bold text-sky-700">{kpiStats.avgCasesPerDay.toFixed(1)}</div></div>
                                        <div className={`p-4 rounded-lg ${pctBgClass(kpiStats.caseCorrectnessPct)}`}><div className="text-sm font-semibold">Correctness %</div><div className="text-3xl font-bold">{fmtPct(kpiStats.caseCorrectnessPct)}</div></div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold mb-2 text-gray-700">Skill KPIs</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                        <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm text-gray-600">Total Skills</div><div className="text-3xl font-bold text-sky-700">{kpiStats.totalSkills}</div></div>
                                        <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm text-gray-600">Correct Skills</div><div className="text-3xl font-bold text-sky-700">{kpiStats.correctSkills}</div></div>
                                        <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm text-gray-600">Avg Skills / Day</div><div className="text-3xl font-bold text-sky-700">{kpiStats.avgSkillsPerDay.toFixed(1)}</div></div>
                                        <div className={`p-4 rounded-lg ${pctBgClass(kpiStats.skillCorrectnessPct)}`}><div className="text-sm font-semibold">Correctness %</div><div className="text-3xl font-bold">{fmtPct(kpiStats.skillCorrectnessPct)}</div></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {hasTestScores && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mt-6 border-t pt-6">
                                <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm font-semibold">Pre-Test Score</div><div className="text-3xl font-bold">{preScore || 'N/A'}%</div></div>
                                <div className="p-4 bg-gray-100 rounded-lg"><div className="text-sm font-semibold">Post-Test Score</div><div className="text-3xl font-bold">{postScore || 'N/A'}%</div></div>
                                <div className={`p-4 rounded-lg ${getImprovementBgClass(improvement)}`}><div className="text-sm font-semibold">Improvement</div><div className="text-3xl font-bold">{improvement.toFixed(1)}%</div></div>
                            </div>
                        )}
                    </Card>
                )}
                
                {hasChartData && (
                    <div className="grid md:grid-cols-2 gap-8">
                        <Card>
                            <h3 className="text-xl font-bold mb-4">Daily Case Distribution (OPD vs IPD)</h3>
                            <Bar ref={caseChartByDayRef} options={chartOptions} data={{
                                    labels: casePerformanceByDay.map(d => `Day ${d.day}`),
                                    datasets: [
                                        { label: 'Out-Patient (OPD)', data: casePerformanceByDay.map(d => d.opdTotal), backgroundColor: '#3b82f6' },
                                        { label: 'In-Patient (IPD)', data: casePerformanceByDay.map(d => d.ipdTotal), backgroundColor: '#10b981' }
                                    ]
                                }} 
                                onClick={handleChartClick}
                            />
                        </Card>
                        <Card>
                            <h3 className="text-xl font-bold mb-4">Daily Case Performance</h3>
                            <Table headers={["Day", "Out-Patient (OPD)", "In-Patient (IPD)", "Total Cases"]}>
                                {casePerformanceByDay.map(dayData => (
                                    <tr key={dayData.day} className="hover:bg-gray-100 cursor-pointer" onClick={() => handleDaySelect(dayData.day)}>
                                        <td className="p-2 border font-bold">Day {dayData.day}</td>
                                        <td className={`p-2 border text-center font-mono ${pctBgClass(dayData.opdPct)}`}>{dayData.opdTotal} ({fmtPct(dayData.opdPct)})</td>
                                        <td className={`p-2 border text-center font-mono ${pctBgClass(dayData.ipdPct)}`}>{dayData.ipdTotal} ({fmtPct(dayData.ipdPct)})</td>
                                        <td className={`p-2 border text-center font-mono ${pctBgClass(dayData.totalPct)}`}>{dayData.total} ({fmtPct(dayData.totalPct)})</td>
                                    </tr>
                                ))}
                            </Table>
                        </Card>
                    </div>
                )}

                {hasDomainData && (
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Detailed Skill Performance by Domain</h3>
                        <div className="space-y-4">
                        {course.course_type === 'IMNCI' ? (
                            Object.entries(detailedPerformance).map(([ageGroup, domains]) => (
                                (domains.length > 0 &&
                                <div key={ageGroup} className="p-4 border rounded-lg bg-white space-y-3 shadow-sm">
                                    <h4 className="text-lg font-bold text-sky-800 border-b pb-2">
                                        {ageGroup === 'LT2M' ? 'Age Group: 0-59 days' : 'Age Group: 2-59 months'}
                                    </h4>
                                    {domains.map(domain => (
                                        <details key={domain.label} className="bg-gray-50 p-3 rounded-lg">
                                            <summary className="font-semibold cursor-pointer flex justify-between items-center flex-wrap gap-x-4">
                                                <span>{domain.label}</span>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm font-normal text-gray-600">Cases: {domain.totalCases}</span>
                                                    <span className={`font-mono text-sm px-2 py-1 rounded ${pctBgClass(calcPct(domain.correct, domain.total))}`}>
                                                        {fmtPct(calcPct(domain.correct, domain.total))}
                                                    </span>
                                                </div>
                                            </summary>
                                            <div className="mt-2 pl-4 border-l-2 border-gray-200">
                                                <Table headers={["Skill/Classification", "Performance", "%"]}>
                                                    {Object.entries(domain.skills).map(([skill, data]) => {
                                                        const pct = calcPct(data.correct, data.total);
                                                        return (
                                                            <tr key={skill}>
                                                                <td className="p-2 border">{skill}</td>
                                                                <td className="p-2 border">{`${data.correct}/${data.total}`}</td>
                                                                <td className={`p-2 border font-mono ${pctBgClass(pct)}`}>{fmtPct(pct)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </Table>
                                            </div>
                                        </details>
                                    ))}
                                </div>)
                            ))
                        ) : (
                            detailedPerformance.map(domain => (
                                <details key={domain.label} className="bg-gray-50 p-3 rounded-lg">
                                    <summary className="font-semibold cursor-pointer flex justify-between items-center flex-wrap gap-x-4">
                                        <span>{domain.label}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-normal text-gray-600">Cases: {domain.totalCases}</span>
                                            <span className={`font-mono text-sm px-2 py-1 rounded ${pctBgClass(course.course_type === 'EENC' ? calcPct(domain.score, domain.maxScore) : calcPct(domain.correct, domain.total))}`}>
                                                {fmtPct(course.course_type === 'EENC' ? calcPct(domain.score, domain.maxScore) : calcPct(domain.correct, domain.total))}
                                            </span>
                                        </div>
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
                            ))
                        )}
                        </div>
                    </Card>
                )}

                {hasCaseData && (
                    <Card>
                        <h3 className="text-xl font-bold mb-4">All Cases Summary</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 border rounded-lg bg-gray-50">
                            <FormGroup label="Filter by Setting">
                                <Select value={settingFilter} onChange={e => setSettingFilter(e.target.value)}>
                                    <option value="all">All Settings</option>
                                    <option value="OPD">Out-Patient (OPD)</option>
                                    <option value="IPD">In-Patient (IPD)</option>
                                </Select>
                            </FormGroup>
                            <FormGroup label="Filter by Day">
                                <Select value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
                                    <option value="all">All Days</option>
                                    {uniqueCourseDays.map(day => (
                                        <option key={day} value={day}>Day {day}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Filter by Status">
                                <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                    <option value="all">All Cases</option>
                                    <option value="correct">Correct Only</option>
                                    <option value="incorrect">Incorrect Only</option>
                                </Select>
                            </FormGroup>
                            <div className="flex items-end">
                                <Button variant="secondary" onClick={() => {
                                    setSettingFilter('all');
                                    setDayFilter('all');
                                    setStatusFilter('all');
                                }}>Reset Filters</Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table headers={["Case #", "Age Group", "Setting", "Day of Course", "Overall Status", "Classifications"]}>
                                {filteredCases.length > 0 ? (
                                    filteredCases.map((c, index) => {
                                        const caseObservations = observations.filter(obs => obs.caseId === c.id);
                                        const ageGroupLabel = c.age_group === 'LT2M' 
                                            ? '0-59 days' 
                                            : (c.age_group === 'GE2M_LE5Y' ? '2-59 months' : c.age_group || 'N/A');

                                        return (
                                            <tr key={c.id} className="hover:bg-gray-100 cursor-pointer" onClick={() => handleCaseClick(c)}>
                                                <td className="p-2 border align-top font-medium">{index + 1}</td>
                                                <td className="p-2 border align-top">{ageGroupLabel}</td>
                                                <td className="p-2 border align-top">{c.setting || 'N/A'}</td>
                                                <td className="p-2 border align-top">{c.day_of_course || '1'}</td>
                                                <td className={`p-2 border align-top font-semibold ${c.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                                                    {c.is_correct ? 'Correct' : 'Incorrect'}
                                                </td>
                                                <td className="p-2 border align-top">
                                                    {caseObservations.length > 0 ? (
                                                        <ul className="list-disc pl-5 space-y-1">
                                                            {caseObservations.map(obs => (
                                                                <li key={obs.id} className={obs.item_correct > 0 ? 'text-gray-700' : 'text-red-600 font-semibold'}>
                                                                    {obs.item_recorded}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : 'No classifications recorded'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center p-4">
                                            <EmptyState message="No cases match the current filters." />
                                        </td>
                                    </tr>
                                )}
                            </Table>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}