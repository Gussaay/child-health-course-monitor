import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from "jspdf";
// autoTable is no longer used for generation, but kept for potential future use or reference
import autoTable from "jspdf-autotable"; 
// --- ADDED: Imports for html2canvas and native saving ---
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
// --- END ADDED ---
import {
    Card, PageHeader, Button, FormGroup, Select, Table, EmptyState, Spinner, PdfIcon
} from "./CommonComponents";
import {
    SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAINS_BREATHING, EENC_DOMAINS_NOT_BREATHING,
    EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING,
    SKILLS_ETAT, ETAT_DOMAINS, ETAT_DOMAIN_LABEL,
    DOMAINS_BY_AGE_IMNCI, DOMAIN_LABEL_IMNCI, getClassListImnci,
    pctBgClass, fmtPct, calcPct, formatAsPercentageAndCount, formatAsPercentageAndScore,
    // --- ADDED: Import ICCM constants ---
    SKILLS_ICCM, ICCM_DOMAINS, ICCM_DOMAIN_LABEL
} from './constants.js';
import {
    listAllDataForCourse
} from "../data.js";

// --- ADDED: Print Icon Component ---
const PrintIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-8V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);
// --- END ADDED ---


// --- NEW: Notification helper ---
const notify = (message, type = 'info') => {
    // Fallback to alert() since setToast is not available in this component
    alert(message);
};

// --- NEW: Helper to save jsPDF doc objects (for autoTable reports) ---
const saveJsPdfDoc = async (doc, fileName, onSuccess, onError) => {
    try {
        if (Capacitor.isNativePlatform()) {
            const base64Data = doc.output('datauristring').split('base64,')[1];
            
            const writeResult = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Downloads,
            });

            await FileOpener.open({
                filePath: writeResult.uri,
                contentType: 'application/pdf',
            });
            onSuccess(`PDF saved to Downloads folder: ${fileName}`);
        } else {
            doc.save(fileName);
            onSuccess("PDF download initiated.");
        }
    } catch (e) {
        console.error("Error saving PDF:", e);
        onError(`Failed to save PDF: ${e.message || 'Unknown error'}`);
    }
};


// --- CONSTANTS MOVED HERE ---
const qualityProfiles = {
    print: {
        scale: 3, // Higher scale for better print quality
        imageType: 'image/jpeg',
        imageQuality: 0.95,
        imageFormat: 'JPEG',
        compression: 'MEDIUM',
        fileSuffix: '_Print_Quality'
    },
    screen: {
        scale: 2, // Good scale for screen viewing
        // --- MODIFIED: Changed from PNG to JPEG to avoid PNG signature errors ---
        imageType: 'image/jpeg',
        imageQuality: 0.9,
        imageFormat: 'JPEG',
        // --- END MODIFICATION ---
        compression: 'FAST',
        fileSuffix: '_Screen_Quality'
    }
};

/**
 * --- MODIFIED HELPER: addCanvasToPdfOnePage ---
 * Added validation to prevent errors from 0-dimension canvases.
 */
const addCanvasToPdfOnePage = (doc, headerCanvas, groupCanvas, profile, margin) => {
    const A4_WIDTH = 210;
    const A4_HEIGHT = 297;
    const contentWidth = A4_WIDTH - (margin * 2); 
    const contentHeight = A4_HEIGHT - (margin * 2);
    const PADDING = 5; 

    // 1. Add Header
    // --- VALIDATION ---
    if (!headerCanvas.width || !headerCanvas.height) {
        console.error("Header canvas has zero dimensions.");
        throw new Error("Failed to capture report header.");
    }
    const headerImgData = headerCanvas.toDataURL(profile.imageType, profile.imageQuality);
    const headerImgHeight = (headerCanvas.height * contentWidth) / headerCanvas.width;
    
    // --- VALIDATION ---
    if (!isFinite(headerImgHeight) || headerImgHeight <= 0) {
        console.error("Invalid header image height calculated:", headerImgHeight);
        throw new Error("Failed to calculate header dimensions.");
    }
    doc.addImage(headerImgData, profile.imageFormat, margin, margin, contentWidth, headerImgHeight, undefined, profile.compression);

    // 2. Add Group Content (scaled to fit)
    const availableHeight = contentHeight - headerImgHeight - PADDING;
    if (availableHeight <= 0) {
        console.error("Header is too tall for the page.");
        return; // Not enough space
    }
    
    // --- VALIDATION ---
    if (!groupCanvas.width || !groupCanvas.height) {
        console.warn("Skipping group: canvas has zero dimensions.");
        return; // Skip this group, it's empty or failed to render
    }

    const groupImgData = groupCanvas.toDataURL(profile.imageType, profile.imageQuality);
    const groupImgRatio = groupCanvas.width / groupCanvas.height;

    // --- VALIDATION ---
    if (!isFinite(groupImgRatio) || groupImgRatio <= 0) {
        console.warn("Skipping group: Invalid image ratio calculated.");
        return;
    }

    const availableRatio = contentWidth / availableHeight;

    let finalWidth, finalHeight;

    if (groupImgRatio > availableRatio) {
        finalWidth = contentWidth;
        finalHeight = contentWidth / groupImgRatio;
    } else {
        finalHeight = availableHeight;
        finalWidth = availableHeight * groupImgRatio;
    }

    // --- FINAL VALIDATION ---
    if (!isFinite(finalWidth) || finalWidth <= 0 || !isFinite(finalHeight) || finalHeight <= 0) {
        console.warn("Skipping group: Final calculated dimensions are invalid.", {finalWidth, finalHeight});
        return;
    }
    
    const xOffset = margin + ((contentWidth - finalWidth) / 2);
    const yOffset = margin + headerImgHeight + PADDING;

    doc.addImage(groupImgData, profile.imageFormat, xOffset, yOffset, finalWidth, finalHeight, undefined, profile.compression);
};
// --- END MODIFIED HELPER ---


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

    // --- MODIFIED THIS LINE ---
    const ReportComponent = { 'IMNCI': ImnciReports, 'ETAT': EtatReports, 'EENC': EencReports, 'ICCM': IccmReports }[course.course_type] || (() => <p>No report available for this course type.</p>);
    // --- END MODIFICATION ---

    return (
        <Card>
            {/* --- MODIFIED: Print Styles --- */}
            <style type="text/css">
            {`
                /* * STYLES FOR SCREEN & HTML2CANVAS 
                 * These styles apply to the header when it is temporarily
                 * made visible for PDF capture.
                */
                .report-header {
                    display: none; /* Hidden on screen by default */
                    flex-wrap: wrap;
                    align-items: baseline;
                    gap: 0 1rem;
                }
                .report-header h2, .report-header h3, .report-header h4 {
                    margin: 0 !important;
                }

                /* * STYLES FOR PRINT DIALOG 
                 */
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0.5in;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .printable-area, .printable-area * {
                        visibility: visible;
                    }
                    .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .pdf-hide, .print-hide {
                        display: none !important;
                    }
                    /* Show report header in print */
                    .report-header {
                        display: flex !important; /* Override inline 'display: none' for printing */
                    }
                    .report-group-wrapper {
                        break-before: page;
                        page-break-before: always;
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .report-header {
                        break-after: avoid;
                        page-break-after: avoid;
                    }
                }
            `}
            </style>
            {/* --- END MODIFIED --- */}

            <PageHeader title={`${course.course_type} Reports`} subtitle={`${course.state} / ${course.locality}`} className="print-hide" />
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
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

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

    // --- MODIFIED: New PDF Export Logic ---
    const handleExportPdf = async (quality = 'print') => {
        setIsPdfGenerating(true);
        const profile = qualityProfiles[quality] || qualityProfiles.print;
        const doc = new jsPDF('portrait', 'mm', 'a4');
        const reportName = `IMCI_${tab}_Report${profile.fileSuffix}.pdf`;
        const margin = 15; // 15mm margin
        const canvasOptions = { 
            scale: profile.scale, 
            useCORS: true, 
            allowTaint: true, 
            backgroundColor: '#ffffff' 
        };

        const headerEl = document.getElementById('imnci-report-header'); // Get header element

        try {
            // 1. Capture Header
            if (!headerEl) throw new Error("Report header not found");
            
            // --- FIX: Temporarily show header for capture ---
            headerEl.style.display = 'flex'; // Use 'flex' as defined in print styles
            
            const headerCanvas = await html2canvas(headerEl, canvasOptions);

            // --- FIX: Re-hide header after capture ---
            headerEl.style.display = 'none';

            // 2. Get group elements to render
            const groupElements = [];
            groupsToRender.forEach(g => {
                const id = `group-${tab}-${g.replace(/\s+/g, '-')}`;
                const el = document.getElementById(id);
                if (el) groupElements.push(el);
            });
            
            if (groupElements.length === 0) {
                notify("No data to export.", "error");
                setIsPdfGenerating(false);
                return;
            }

            // 3. Loop, capture, and add each group to a new page
            for (let i = 0; i < groupElements.length; i++) {
                const el = groupElements[i];
                if (i > 0) {
                    doc.addPage();
                }
                
                // Capture group content
                const groupCanvas = await html2canvas(el, canvasOptions);
                
                // Add header and scaled group content to the same page
                addCanvasToPdfOnePage(doc, headerCanvas, groupCanvas, profile, margin);
            }

            // 4. Save the doc
            await saveJsPdfDoc(
                doc, 
                reportName,
                (msg) => notify(msg, 'success'),
                (msg) => notify(msg, 'error')
            );

        } catch (e) {
            console.error("Error generating PDF:", e);
            notify(`Failed to save PDF: ${e.message || 'Unknown error'}`, 'error');
        } finally {
            // --- FIX: Ensure header is hidden even if error occurs ---
            if (headerEl) {
                headerEl.style.display = 'none';
            }
            setIsPdfGenerating(false);
        }
    };
    // --- END MODIFIED ---

    // --- ADDED: handlePrint function ---
    const handlePrint = () => {
        window.print();
    };
    // --- END ADDED ---

    const groupsToRender = groupFilter === 'All' ? ['Group A', 'Group B', 'Group C', 'Group D'] : [groupFilter];


    return (
        // --- MODIFIED: Added printable-area class ---
        <div className="mt-6 printable-area" id="imnci-report-container">
            {/* --- MODIFIED: Report Header (now print-only via CSS) --- */}
            <div className="report-header mb-4 px-1" id="imnci-report-header">
                <h2 className="text-2xl font-bold">{course.course_type} Report</h2>
                <h3 className="text-lg text-gray-700">{course.state} / {course.locality}</h3>
                <h4 className="text-md text-gray-600">Age Group: {age === 'LT2M' ? '0-2 months' : '2-59 months'}</h4>
            </div>
            {/* --- END MODIFIED --- */}

            <div className="flex flex-wrap gap-3 mb-4 print-hide"><Button variant={tab === 'case' ? 'primary' : 'secondary'} onClick={() => setTab('case')}>Case Summary</Button><Button variant={tab === 'class' ? 'primary' : 'secondary'} onClick={() => setTab('class')}>Classification Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Report</Button></div>
            {/* --- MODIFIED: Added print-hide class --- */}
            <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-md mb-6 pdf-hide print-hide">
                <div className="flex flex-wrap gap-4 items-center">
                    <FormGroup label="Age group"><Select value={age} onChange={(e) => setAge(e.target.value)}><option value="LT2M">0-2 months</option><option value="GE2M_LE5Y">2-59 months</option></Select></FormGroup>
                    <FormGroup label="Setting"><Select value={settingFilter} onChange={(e) => setSettingFilter(e.target.value)}><option value="All">All</option><option value="OPD">Out-patient</option><option value="IPD">In-patient</option></Select></FormGroup>
                    <FormGroup label="Day of Training"><Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}><option value="All">All Days</option>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}</Select></FormGroup>
                    <FormGroup label="Group"><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="All">All Groups</option><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                </div>
                {/* --- MODIFIED: Spinner moved outside button --- */}
                <div className="flex items-center gap-2">
                    {isPdfGenerating && <Spinner />} {/* <-- Spinner outside buttons */}
                    {/* --- ADDED: Print Button --- */}
                    <Button onClick={handlePrint} variant="secondary" disabled={isPdfGenerating}>
                        <PrintIcon /> Print
                    </Button>
                    <Button onClick={() => handleExportPdf('print')} variant="secondary" disabled={isPdfGenerating}>
                        <PdfIcon /> Export for Print
                    </Button>
                    <Button onClick={() => handleExportPdf('screen')} variant="secondary" disabled={isPdfGenerating}>
                        <PdfIcon /> Export for Sharing
                    </Button>
                </div>
            </div>

            {tab !== 'matrix' && groupsToRender.map(g => {
                const data = (tab === 'case' ? caseSummaryByGroup : classSummaryByGroup)[g] || {};
                const ids = Object.keys(data); if (ids.length === 0) return null;
                return (
                    // --- MODIFIED: Added ID and page-break class ---
                    <div key={g} className="grid gap-2 mb-8 report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead>{tab === 'case' ? (<tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">IPD Cases</th><th className="py-2 pr-4">% IPD</th><th className="py-2 pr-4">OPD Cases</th><th className="py-2 pr-4">% OPD</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">% Overall</th></tr>) : (<tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">IPD Class.</th><th className="py-2 pr-4">% IPD</th><th className="py-2 pr-4">OPD Class.</th><th className="py-2 pr-4">% OPD</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">% Overall</th></tr>)}</thead><tbody>{ids.map(id => { const r = data[id]; const inSeen = tab === 'case' ? r.inp_seen : r.inp_total; const inCor = r.inp_correct; const outSeen = tab === 'case' ? r.op_seen : r.op_total; const outCor = r.op_correct; const pctIn = calcPct(inCor, inSeen), pctOut = calcPct(outCor, outSeen), pctAll = calcPct(inCor + outCor, inSeen + outSeen); return (<tr key={id} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 pr-4">{inSeen}</td><td className={`py-2 pr-4 ${pctBgClass(pctIn)}`}>{fmtPct(pctIn)}</td><td className="py-2 pr-4">{outSeen}</td><td className={`py-2 pr-4 ${pctBgClass(pctOut)}`}>{fmtPct(pctOut)}</td><td className="py-2 pr-4">{inSeen + outSeen}</td><td className={`py-2 pr-4 ${pctBgClass(pctAll)}`}>{fmtPct(pctAll)}</td></tr>); })}</tbody></table></div>
                    </div>
                );
            })}

            {tab === 'matrix' && groupsToRender.map(g => {
                const parts = participants.filter(p => p.group === g).sort((a, b) => a.name.localeCompare(b.name));
                if (parts.length === 0) return null;
                return (
                    // --- MODIFIED: Added ID and page-break class ---
                    <div key={g} className="grid gap-2 mb-8 report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        {/* --- MODIFIED: Removed max-h-[70vh] and overflow-y-auto --- */}
                        <div className="overflow-x-auto">
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
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

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

    // --- ADDED: classSummaryByGroup for ETAT ---
    const classSummaryByGroup = useMemo(() => {
        const g = {};
        const pmap = new Map(participants.map(p => [p.id, p]));
        for (const o of filteredObs) {
            const p = pmap.get(o.participant_id || '');
            if (!p) continue;
            const k = p.group;
            g[k] ??= {};
            g[k][p.id] ??= { name: p.name, total_obs: 0, correct_obs: 0 };
            const t = g[k][p.id];
            t.total_obs++;
            if (o.item_correct === 1) {
                t.correct_obs++;
            }
        }
        return g;
    }, [filteredObs, participants]);
    // --- END ADDED ---

    // --- MODIFIED: New PDF Export Logic ---
    const handleExportPdf = async (quality = 'print') => {
        setIsPdfGenerating(true);
        const profile = qualityProfiles[quality] || qualityProfiles.print;
        const doc = new jsPDF('portrait', 'mm', 'a4');
        const reportName = `ETAT_${tab}_Report${profile.fileSuffix}.pdf`;
        const margin = 15; // 15mm margin
        const canvasOptions = { 
            scale: profile.scale, 
            useCORS: true, 
            allowTaint: true, 
            backgroundColor: '#ffffff' 
        };

        const headerEl = document.getElementById('etat-report-header'); // Get header element

        try {
            // 1. Capture Header
            if (!headerEl) throw new Error("Report header not found");
            
            // --- FIX: Temporarily show header for capture ---
            headerEl.style.display = 'flex'; // Use 'flex' as defined in print styles
            
            const headerCanvas = await html2canvas(headerEl, canvasOptions);

            // --- FIX: Re-hide header after capture ---
            headerEl.style.display = 'none';

            // 2. Get group elements to render
            const groupElements = [];
            groupsToRender.forEach(g => {
                const id = `group-${tab}-${g.replace(/\s+/g, '-')}`;
                const el = document.getElementById(id);
                if (el) groupElements.push(el);
            });
            
            if (groupElements.length === 0) {
                notify("No data to export.", "error");
                setIsPdfGenerating(false);
                return;
            }

            // 3. Loop, capture, and add each group to a new page
            for (let i = 0; i < groupElements.length; i++) {
                const el = groupElements[i];
                if (i > 0) {
                    doc.addPage();
                }
                
                // Capture group content
                const groupCanvas = await html2canvas(el, canvasOptions);
                
                // Add header and scaled group content to the same page
                addCanvasToPdfOnePage(doc, headerCanvas, groupCanvas, profile, margin);
            }

            // 4. Save the doc
            await saveJsPdfDoc(
                doc, 
                reportName,
                (msg) => notify(msg, 'success'),
                (msg) => notify(msg, 'error')
            );

        } catch (e) {
            console.error("Error generating PDF:", e);
            notify(`Failed to save PDF: ${e.message || 'Unknown error'}`, 'error');
        } finally {
            // --- FIX: Ensure header is hidden even if error occurs ---
            if (headerEl) {
                headerEl.style.display = 'none';
            }
            setIsPdfGenerating(false);
        }
    };
    // --- END MODIFIED ---

    // --- ADDED: handlePrint function ---
    const handlePrint = () => {
        window.print();
    };
    // --- END ADDED ---

    const groupsToRender = groupFilter === 'All' ? ['Group A', 'Group B', 'Group C', 'Group D'] : [groupFilter];

    return (
        // --- MODIFIED: Added printable-area class ---
        <div className="mt-6 printable-area" id="etat-report-container">
            {/* --- MODIFIED: Report Header (now print-only via CSS) --- */}
            <div className="report-header mb-4 px-1" id="etat-report-header">
                <h2 className="text-2xl font-bold">{course.course_type} Report</h2>
                <h3 className="text-lg text-gray-700">{course.state} / {course.locality}</h3>
            </div>
            {/* --- END MODIFIED --- */}

            <div className="flex flex-wrap gap-3 mb-4 print-hide"><Button variant={tab === 'case' ? 'primary' : 'secondary'} onClick={() => setTab('case')}>Case Summary</Button><Button variant={tab === 'class' ? 'primary' : 'secondary'} onClick={() => setTab('class')}>Classification Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Report</Button></div>

            {/* --- MODIFIED: Added print-hide class --- */}
            <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-md mb-6 pdf-hide print-hide">
                <div className="flex gap-4 items-center">
                    <FormGroup label="Day of Training"><Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}><option value="All">All Days</option>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}</Select></FormGroup>
                    <FormGroup label="Group"><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="All">All Groups</option><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                </div>
                {/* --- MODIFIED: Spinner moved outside button --- */}
                <div className="flex items-center gap-2">
                    {isPdfGenerating && <Spinner />} {/* <-- Spinner outside buttons */}
                    {/* --- ADDED: Print Button --- */}
                    <Button onClick={handlePrint} variant="secondary" disabled={isPdfGenerating}>
                        <PrintIcon /> Print
                    </Button>
                    <Button onClick={() => handleExportPdf('print')} variant="secondary" disabled={isPdfGenerating}>
                        <PdfIcon /> Export for Print
                    </Button>
                    <Button onClick={() => handleExportPdf('screen')} variant="secondary" disabled={isPdfGenerating}>
                        <PdfIcon /> Export for Sharing
                    </Button>
                </div>
            </div>

            {tab === 'case' && groupsToRender.map(g => {
                const data = caseSummaryByGroup[g] || {}; const ids = Object.keys(data); if (ids.length === 0) return null;
                return (
                    // --- MODIFIED: Added ID and page-break class ---
                    <div key={g} className="grid gap-2 mb-8 report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">Total Cases</th><th className="py-2 pr-4">Correct Cases</th><th className="py-2 pr-4">% Correct Cases</th></tr></thead><tbody>{ids.map(id => { const r = data[id]; const pct = calcPct(r.correct_cases, r.total_cases); return (<tr key={id} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 pr-4">{r.total_cases}</td><td className="py-2 pr-4">{r.correct_cases}</td><td className={`py-2 pr-4 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td></tr>); })}</tbody></table></div>
                    </div>
                );
            })}

            {/* --- ADDED: Rendering logic for 'class' tab --- */}
            {tab === 'class' && groupsToRender.map(g => {
                const data = classSummaryByGroup[g] || {};
                const ids = Object.keys(data);
                if (ids.length === 0) return null;
                return (
                    // --- MODIFIED: Added ID and page-break class ---
                    <div key={g} className="grid gap-2 mb-8 report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b">
                                        <th className="py-2 pr-4">Participant</th>
                                        <th className="py-2 pr-4">Total Class.</th>
                                        <th className="py-2 pr-4">Correct Class.</th>
                                        <th className="py-2 pr-4">% Correct Class.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ids.map(id => {
                                        const r = data[id];
                                        const pct = calcPct(r.correct_obs, r.total_obs);
                                        return (
                                            <tr key={id} className="border-b">
                                                <td className="py-2 pr-4">{r.name}</td>
                                                <td className="py-2 pr-4">{r.total_obs}</td>
                                                <td className="py-2 pr-4">{r.correct_obs}</td>
                                                <td className={`py-2 pr-4 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
            {/* --- END ADDED --- */}

            {tab === 'matrix' && groupsToRender.map(g => {
                const parts = participants.filter(p => p.group === g).sort((a, b) => a.name.localeCompare(b.name));
                if (parts.length === 0) return null;
                return (
                    // --- MODIFIED: Added ID and page-break class ---
                    <div key={g} className="grid gap-2 mb-8 report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        {/* --- MODIFIED: Removed max-h-[70vh] and overflow-y-auto --- */}
                        <div className="overflow-x-auto">
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

// --- ADDED ICCM REPORTS COMPONENT (Copied from ETAT) ---
function IccmReports({ course, participants, allObs, allCases }) {
    const [tab, setTab] = useState('matrix');
    const [dayFilter, setDayFilter] = useState('All');
    const [groupFilter, setGroupFilter] = useState('All');
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

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

    const classSummaryByGroup = useMemo(() => {
        const g = {};
        const pmap = new Map(participants.map(p => [p.id, p]));
        for (const o of filteredObs) {
            const p = pmap.get(o.participant_id || '');
            if (!p) continue;
            const k = p.group;
            g[k] ??= {};
            g[k][p.id] ??= { name: p.name, total_obs: 0, correct_obs: 0 };
            const t = g[k][p.id];
            t.total_obs++;
            if (o.item_correct === 1) {
                t.correct_obs++;
            }
        }
        return g;
    }, [filteredObs, participants]);

    // --- MODIFIED: New PDF Export Logic ---
    const handleExportPdf = async (quality = 'print') => {
        setIsPdfGenerating(true);
        const profile = qualityProfiles[quality] || qualityProfiles.print;
        const doc = new jsPDF('portrait', 'mm', 'a4');
        const reportName = `ICCM_${tab}_Report${profile.fileSuffix}.pdf`;
        const margin = 15; // 15mm margin
        const canvasOptions = { 
            scale: profile.scale, 
            useCORS: true, 
            allowTaint: true, 
            backgroundColor: '#ffffff' 
        };
        
        const headerEl = document.getElementById('iccm-report-header'); // Get header element

        try {
            // 1. Capture Header
            if (!headerEl) throw new Error("Report header not found");
            
            // --- FIX: Temporarily show header for capture ---
            headerEl.style.display = 'flex'; // Use 'flex' as defined in print styles
            
            const headerCanvas = await html2canvas(headerEl, canvasOptions);

            // --- FIX: Re-hide header after capture ---
            headerEl.style.display = 'none';

            // 2. Get group elements to render
            const groupElements = [];
            groupsToRender.forEach(g => {
                const id = `group-${tab}-${g.replace(/\s+/g, '-')}`;
                const el = document.getElementById(id);
                if (el) groupElements.push(el);
            });
            
            if (groupElements.length === 0) {
                notify("No data to export.", "error");
                setIsPdfGenerating(false);
                return;
            }

            // 3. Loop, capture, and add each group to a new page
            for (let i = 0; i < groupElements.length; i++) {
                const el = groupElements[i];
                if (i > 0) {
                    doc.addPage();
                }
                
                // Capture group content
                const groupCanvas = await html2canvas(el, canvasOptions);
                
                // Add header and scaled group content to the same page
                addCanvasToPdfOnePage(doc, headerCanvas, groupCanvas, profile, margin);
            }

            // 4. Save the doc
            await saveJsPdfDoc(
                doc, 
                reportName,
                (msg) => notify(msg, 'success'),
                (msg) => notify(msg, 'error')
            );

        } catch (e) {
            console.error("Error generating PDF:", e);
            notify(`Failed to save PDF: ${e.message || 'Unknown error'}`, 'error');
        } finally {
            // --- FIX: Ensure header is hidden even if error occurs ---
            if (headerEl) {
                headerEl.style.display = 'none';
            }
            setIsPdfGenerating(false);
        }
    };
    // --- END MODIFIED ---

    // --- ADDED: handlePrint function ---
    const handlePrint = () => {
        window.print();
    };
    // --- END ADDED ---

    const groupsToRender = groupFilter === 'All' ? ['Group A', 'Group B', 'Group C', 'Group D'] : [groupFilter];

    return (
        // --- MODIFIED: Added printable-area class ---
        <div className="mt-6 printable-area" id="iccm-report-container">
            {/* --- MODIFIED: Report Header (now print-only via CSS) --- */}
            <div className="report-header mb-4 px-1" id="iccm-report-header">
                <h2 className="text-2xl font-bold">{course.course_type} Report</h2>
                <h3 className="text-lg text-gray-700">{course.state} / {course.locality}</h3>
            </div>
            {/* --- END MODIFIED --- */}

            <div className="flex flex-wrap gap-3 mb-4 print-hide"><Button variant={tab === 'case' ? 'primary' : 'secondary'} onClick={() => setTab('case')}>Case Summary</Button><Button variant={tab === 'class' ? 'primary' : 'secondary'} onClick={() => setTab('class')}>Classification Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Report</Button></div>

            {/* --- MODIFIED: Added print-hide class --- */}
            <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-md mb-6 pdf-hide print-hide">
                <div className="flex gap-4 items-center">
                    <FormGroup label="Day of Training"><Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}><option value="All">All Days</option>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}</Select></FormGroup>
                    <FormGroup label="Group"><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="All">All Groups</option><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                </div>
                {/* --- MODIFIED: Spinner moved outside button --- */}
                <div className="flex items-center gap-2">
                    {isPdfGenerating && <Spinner />} {/* <-- Spinner outside buttons */}
                    {/* --- ADDED: Print Button --- */}
                    <Button onClick={handlePrint} variant="secondary" disabled={isPdfGenerating}>
                        <PrintIcon /> Print
                    </Button>
                    <Button onClick={() => handleExportPdf('print')} variant="secondary" disabled={isPdfGenerating}>
                        <PdfIcon /> Export for Print
                    </Button>
                    <Button onClick={() => handleExportPdf('screen')} variant="secondary" disabled={isPdfGenerating}>
                        <PdfIcon /> Export for Sharing
                    </Button>
                </div>
            </div>

            {tab === 'case' && groupsToRender.map(g => {
                const data = caseSummaryByGroup[g] || {}; const ids = Object.keys(data); if (ids.length === 0) return null;
                return (
                    // --- MODIFIED: Added ID and page-break class ---
                    <div key={g} className="grid gap-2 mb-8 report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">Total Cases</th><th className="py-2 pr-4">Correct Cases</th><th className="py-2 pr-4">% Correct Cases</th></tr></thead><tbody>{ids.map(id => { const r = data[id]; const pct = calcPct(r.correct_cases, r.total_cases); return (<tr key={id} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 pr-4">{r.total_cases}</td><td className="py-2 pr-4">{r.correct_cases}</td><td className={`py-2 pr-4 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td></tr>); })}</tbody></table></div>
                    </div>
                );
            })}

            {tab === 'class' && groupsToRender.map(g => {
                const data = classSummaryByGroup[g] || {};
                const ids = Object.keys(data);
                if (ids.length === 0) return null;
                return (
                    // --- MODIFIED: Added ID and page-break class ---
                    <div key={g} className="grid gap-2 mb-8 report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b">
                                        <th className="py-2 pr-4">Participant</th>
                                        <th className="py-2 pr-4">Total Class.</th>
                                        <th className="py-2 pr-4">Correct Class.</th>
                                        <th className="py-2 pr-4">% Correct Class.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ids.map(id => {
                                        const r = data[id];
                                        const pct = calcPct(r.correct_obs, r.total_obs);
                                        return (
                                            <tr key={id} className="border-b">
                                                <td className="py-2 pr-4">{r.name}</td>
                                                <td className="py-2 pr-4">{r.total_obs}</td>
                                                <td className="py-2 pr-4">{r.correct_obs}</td>
                                                <td className={`py-2 pr-4 ${pctBgClass(pct)}`}>{fmtPct(pct)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}

            {tab === 'matrix' && groupsToRender.map(g => {
                const parts = participants.filter(p => p.group === g).sort((a, b) => a.name.localeCompare(b.name));
                if (parts.length === 0) return null;
                return (
                    // --- MODIFIED: Added ID and page-break class ---
                    <div key={g} className="grid gap-2 mb-8 report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
                        <h3 className="text-xl font-semibold">Group: {g.replace('Group ', '')}</h3>
                        {/* --- MODIFIED: Removed max-h-[70vh] and overflow-y-auto --- */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs table-fixed">
                                <thead>
                                    <tr className="text-left border-b bg-gray-50 sticky top-0">
                                        <th className="py-2 pr-4 w-80">Skill</th>
                                        {parts.map(p => <th key={p.id} className="py-2 pr-4 whitespace-nowrap text-center">{p.name}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* --- MODIFIED FOR ICCM --- */}
                                    {ICCM_DOMAINS.map(domain => (
                                        <React.Fragment key={domain}>
                                            <tr className="border-b">
                                                <td colSpan={parts.length + 1} className="py-2 px-2 font-semibold bg-gray-100">{ICCM_DOMAIN_LABEL[domain] || domain}</td>
                                            </tr>
                                            {(SKILLS_ICCM[domain] || []).map(skill => {
                                    {/* --- END MODIFICATION --- */}
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
// --- END ADDED COMPONENT ---


function EencReports({ course, participants, allObs, allCases }) {
    const [tab, setTab] = useState('summary');
    const [scenarioFilter, setScenarioFilter] = useState('All');
    const [dayFilter, setDayFilter] = useState('All');
    const [groupFilter, setGroupFilter] = useState('All');
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

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

    // --- MODIFIED: New PDF Export Logic ---
    const handleExportPdf = async (quality = 'print') => {
        setIsPdfGenerating(true);
        const profile = qualityProfiles[quality] || qualityProfiles.print;
        const doc = new jsPDF('portrait', 'mm', 'a4');
        const reportName = `EENC_${tab}_Report${profile.fileSuffix}.pdf`;
        const margin = 15; // 15mm margin
        const canvasOptions = { 
            scale: profile.scale, 
            useCORS: true, 
            allowTaint: true, 
            backgroundColor: '#ffffff' 
        };

        const headerEl = document.getElementById('eenc-report-header'); // Get header element
        
        try {
            // 1. Capture Header
            if (!headerEl) throw new Error("Report header not found");
            
            // --- FIX: Temporarily show header for capture ---
            headerEl.style.display = 'flex'; // Use 'flex' as defined in print styles
            
            const headerCanvas = await html2canvas(headerEl, canvasOptions);

            // --- FIX: Re-hide header after capture ---
            headerEl.style.display = 'none';

            // 2. Get group elements to render
            const groupElements = [];
            groupsToRender.forEach(g => {
                const id = `group-${tab}-${g.replace(/\s+/g, '-')}`;
                const el = document.getElementById(id);
                if (el) groupElements.push(el);
            });
            
            if (groupElements.length === 0) {
                notify("No data to export.", "error");
                setIsPdfGenerating(false);
                return;
            }

            // 3. Loop, capture, and add each group to a new page
            for (let i = 0; i < groupElements.length; i++) {
                const el = groupElements[i];
                if (i > 0) {
                    doc.addPage();
                }
                
                // Capture group content
                const groupCanvas = await html2canvas(el, canvasOptions);
                
                // Add header and scaled group content to the same page
                addCanvasToPdfOnePage(doc, headerCanvas, groupCanvas, profile, margin);
            }

            // 4. Save the doc
            await saveJsPdfDoc(
                doc, 
                reportName,
                (msg) => notify(msg, 'success'),
                (msg) => notify(msg, 'error')
            );

        } catch (e) {
            console.error("Error generating PDF:", e);
            notify(`Failed to save PDF: ${e.message || 'Unknown error'}`, 'error');
        } finally {
            // --- FIX: Ensure header is hidden even if error occurs ---
            if (headerEl) {
                headerEl.style.display = 'none';
            }
            setIsPdfGenerating(false);
        }
    };
    // --- END MODIFIED ---

    // --- ADDED: handlePrint function ---
    const handlePrint = () => {
        window.print();
    };
    // --- END ADDED ---

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
        // --- MODIFIED: Added printable-area class ---
        <div className="mt-6 printable-area" id="eenc-report-container">
            {/* --- MODIFIED: Report Header (now print-only via CSS) --- */}
            <div className="report-header mb-4 px-1" id="eenc-report-header">
                <h2 className="text-2xl font-bold">{course.course_type} Report</h2>
                <h3 className="text-lg text-gray-700">{course.state} / {course.locality}</h3>
            </div>
            {/* --- END MODIFIED --- */}

            <div className="flex flex-wrap gap-3 mb-4 print-hide"><Button variant={tab === 'summary' ? 'primary' : 'secondary'} onClick={() => setTab('summary')}>Score Summary</Button><Button variant={tab === 'matrix' ? 'primary' : 'secondary'} onClick={() => setTab('matrix')}>Detailed Skill Report</Button></div>
            {/* --- MODIFIED: Added print-hide class --- */}
            <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-md mb-6 pdf-hide print-hide">
                <div className="flex gap-4 items-center">
                    {tab === 'matrix' && <FormGroup label="Scenario"><Select value={scenarioFilter} onChange={(e) => setScenarioFilter(e.target.value)}><option value="All">All (Combined)</option><option value="breathing">Breathing Baby</option><option value="not_breathing">Not Breathing Baby</option></Select></FormGroup>}
                    <FormGroup label="Day of Training"><Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}><option value="All">All Days</option>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}</Select></FormGroup>
                    <FormGroup label="Group"><Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="All">All Groups</option><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                </div>
                {/* --- MODIFIED: Spinner moved outside button --- */}
                <div className="flex items-center gap-2">
                    {isPdfGenerating && <Spinner />} {/* <-- Spinner outside buttons */}
                    {/* --- ADDED: Print Button --- */}
                    <Button onClick={handlePrint} variant="secondary" disabled={isPdfGenerating}>
                        <PrintIcon /> Print
                    </Button>
                    <Button onClick={() => handleExportPdf('print')} variant="secondary" disabled={isPdfGenerating}>
                        <PdfIcon /> Export for Print
                    </Button>
                    <Button onClick={() => handleExportPdf('screen')} variant="secondary" disabled={isPdfGenerating}>
                        <PdfIcon /> Export for Sharing
                    </Button>
                </div>
            </div>

            {tab === 'summary' && groupsToRender.map(g => {
                const data = scoreSummaryByGroup[g];
                if (!data) return null;
                const ids = Object.keys(data);
                if (ids.length === 0) return null;
                return (
                    // --- MODIFIED: Added ID and page-break class ---
                    <div key={g} className="grid gap-2 mb-8 report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
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
                // --- MODIFIED: Added ID and page-break class ---
                <div key={g} className="report-group-wrapper" id={`group-${tab}-${g.replace(/\s+/g, '-')}`}>
                    {(scenarioFilter === 'All' || scenarioFilter === 'breathing') && <EencDetailedMatrix group={g} scenario="breathing" />}
                    {(scenarioFilter === 'All' || scenarioFilter === 'not_breathing') && <EencDetailedMatrix group={g} scenario="not_breathing" />}
                </div>
            ))}
        </div>
    );
}

// Sub-component for EENC detailed matrix, local to this file
// This component is NOT wrapped in a page-break div, its PARENT is.
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