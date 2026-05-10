// CourseReportView.jsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Bar, Line } from 'react-chartjs-2';
import {Button, Card, EmptyState, PageHeader, PdfIcon, Table, Spinner, Modal, Input, FormGroup, Select} from './CommonComponents';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
    PointElement, LineElement
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { amiriFontBase64 } from './AmiriFont.js';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

// 🟢 FIX: Added upsertFinalReport to imports
import { fetchFacilitiesHistoryMultiDate, upsertCourse, upsertFinalReport } from '../data.js';
import { useAuth } from '../hooks/useAuth';
import { useDataCache } from '../DataContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ReportsView } from './ReportsView'; 
import { FinalReportManager } from './FinalReportManager';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ChartDataLabels);

// --- Icon Components ---
const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);
const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
    </svg>
);
const LinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
);

// --- LEGEND COMPONENTS ---
const LegendBadge = ({ colorClass, label, range }) => (
    <div className="flex items-center space-x-1.5 text-[11px] whitespace-nowrap">
        <span className={`px-1.5 py-0.5 rounded font-bold ${colorClass} border border-black/10`}>{label}</span>
        <span className="text-gray-500 font-medium">{range}</span>
    </div>
);

const RawScoreLegend = () => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 border-y border-gray-100 mb-3 text-xs print-hide">
        
        <LegendBadge colorClass="bg-green-200 text-green-800" label="Perfect" range="100%" />
        <LegendBadge colorClass="bg-yellow-200 text-yellow-800" label="Excellent" range="95% - 99.9%" />
        <LegendBadge colorClass="bg-orange-200 text-orange-800" label="Good" range="90% - 94.9%" />
        <LegendBadge colorClass="bg-red-200 text-red-800" label="Fail" range="< 90%" />
        <LegendBadge colorClass="bg-gray-700 text-white" label="Data Incomplete" range="N/A" />
    </div>
);

const ImprovementScoreLegend = () => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 border-y border-gray-100 mb-3 text-xs print-hide">
        
        <LegendBadge colorClass="bg-green-200 text-green-800" label="Perfect" range="> 50%" />
        <LegendBadge colorClass="bg-yellow-200 text-yellow-800" label="Excellent" range="30% - 50%" />
        <LegendBadge colorClass="bg-gray-200 text-gray-800" label="Good" range="15% - 29.9%" />
        <LegendBadge colorClass="bg-orange-200 text-orange-800" label="Fair" range="0% - 14.9%" />
        <LegendBadge colorClass="bg-red-200 text-red-800" label="Fail" range="< 0%" />
        <LegendBadge colorClass="bg-gray-700 text-white" label="Data Incomplete" range="N/A" />
    </div>
);

// --- INTERNAL COMPONENT: ShareModal ---
function ShareModal({ isOpen, onClose, shareableItem, shareType = 'course', onSave }) {
    const [accessLevel, setAccessLevel] = useState('private');
    const [sharedWith, setSharedWith] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');

    useEffect(() => {
        if (shareableItem) {
            setAccessLevel(shareableItem.isPublic ? 'public' : 'private');
            setSharedWith(shareableItem.sharedWith || []);
        }
    }, [shareableItem]);

    const handleAddEmail = () => {
        const email = emailInput.trim().toLowerCase();
        if (email && !sharedWith.includes(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setSharedWith([...sharedWith, email]);
            setEmailInput('');
        }
    };

    const handleRemoveEmail = (emailToRemove) => {
        setSharedWith(sharedWith.filter(email => email !== emailToRemove));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const settings = {
            isPublic: accessLevel === 'public',
            sharedWith: accessLevel === 'private' ? sharedWith : []
        };
        try {
            await onSave(shareableItem.id, settings);
            setCopySuccess('');
        } catch (error) {
            console.error("Failed to save sharing settings:", error);
        } finally {
            setIsSaving(false);
            onClose();
        }
    };
    
    const handleCopyLink = () => {
        let routePrefix = '';
        
        if (shareType === 'course') {
            routePrefix = 'public/report/course';
        } else if (shareType === 'facilitator') {
            routePrefix = 'public/report/facilitator';
        } else {
            routePrefix = `shared/${shareType}-report`;
        }

        const shareUrl = `${window.location.origin}/${routePrefix}/${shareableItem.id}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopySuccess('Link copied!');
            setTimeout(() => setCopySuccess(''), 2000);
        }).catch(err => {
            setCopySuccess('Failed to copy.');
        });
    };

    if (!shareableItem) return null;

    const isCourse = shareType === 'course';
    const reportName = isCourse ? `${shareableItem.course_type} - ${shareableItem.state}` : shareableItem.name;
    const modalTitle = `Share ${isCourse ? 'Course' : 'Participant'} Report`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row items-center sm:space-x-4 space-y-3 sm:space-y-0 text-center sm:text-left">
                    <div className="flex-shrink-0 bg-sky-100 p-3 rounded-full">
                        <ShareIcon />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">{reportName}</h3>
                        <p className="text-sm text-gray-500">Manage access permissions for this report.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-semibold text-gray-700">General Access</label>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:space-x-4">
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="accessLevel"
                                value="private"
                                checked={accessLevel === 'private'}
                                onChange={() => setAccessLevel('private')}
                                className="form-radio text-sky-600"
                            />
                            <span>Restricted</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="accessLevel"
                                value="public"
                                checked={accessLevel === 'public'}
                                onChange={() => setAccessLevel('public')}
                                className="form-radio text-sky-600"
                            />
                            <span>Anyone with the link</span>
                        </label>
                    </div>
                </div>

                {accessLevel === 'private' && (
                    <div className="space-y-4">
                        <label className="font-semibold text-gray-700">Share with specific people</label>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2 w-full">
                            <Input
                                type="email"
                                placeholder="Enter email address"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                className="flex-grow w-full"
                            />
                            <Button onClick={handleAddEmail} className="w-full sm:w-auto">Add</Button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {sharedWith.map(email => (
                                <div key={email} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                                    <span className="text-sm text-gray-700">{email}</span>
                                    <button onClick={() => handleRemoveEmail(email)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                                </div>
                            ))}
                            {sharedWith.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Not shared with anyone yet.</p>}
                        </div>
                    </div>
                )}
                
                <div className="pt-4 border-t">
                     <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full">
                        <Button onClick={handleCopyLink} variant="secondary" className="w-full sm:w-auto">
                            <LinkIcon /> {copySuccess ? copySuccess : "Copy Link"}
                        </Button>
                        <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                            <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                                {isSaving ? <Spinner /> : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

// --- Helper functions for Report View ---
const calcPct = (correct, total) => {
    if (total === 0) return 0;
    return (correct / total) * 100;
};

const fmtPct = (value) => {
    if (isNaN(value) || value === null) return 'N/A';
    return `${value.toFixed(1)}%`;
};

const fmtDecimal = (value) => {
    if (isNaN(Number(value)) || value === null) return 'N/A';
    return Number(value).toFixed(1);
};

const getScoreColorClass = (value, type = 'percentage') => {
    if (isNaN(value) || value === null) return 'bg-gray-700 text-white';
    if (type === 'improvement') {
        if (value > 50) return 'bg-green-200 text-green-800';
        if (value >= 25) return 'bg-yellow-200 text-yellow-800';
        if (value >= 0) return 'bg-gray-200 text-gray-800';
        return 'bg-red-200 text-red-800';
    }
    if (value === 100) return 'bg-green-200 text-green-800';
    if (value >= 95) return 'bg-yellow-200 text-yellow-800';
    if (value >= 90) return 'bg-orange-200 text-orange-800';
    return 'bg-red-200 text-red-800';
};

const getAvgImprovementCategory = (preScore, postScore) => {
    const pre = Number(preScore);
    const post = Number(postScore);
    if (isNaN(pre) || isNaN(post) || pre === 0 || post === 0) {
        return { name: 'Data Incomplete', className: 'bg-gray-700 text-white' };
    }
    const increase = ((post - pre) / pre) * 100;
    if (isNaN(increase) || increase === null) {
        return { name: 'Data Incomplete', className: 'bg-gray-700 text-white' };
    }
    if (increase > 50) return { name: 'Perfect', className: 'bg-green-200 text-green-800' };
    if (increase >= 30) return { name: 'Excellent', className: 'bg-yellow-200 text-yellow-800' };
    if (increase >= 15) return { name: 'Good', className: 'bg-gray-200 text-gray-800' };
    if (increase < 0) return { name: 'Fail', className: 'bg-red-200 text-red-800' };
    return { name: 'Fair', className: 'bg-orange-200 text-orange-800' };
};

const getCaseCorrectnessName = (pct) => {
    if (isNaN(pct) || pct === null) return 'Data Incomplete';
    if (pct === 100) return 'Perfect';
    if (pct >= 95) return 'Excellent';
    if (pct >= 90) return 'Good';
    return 'Fail';
};

const getStatsAndDistribution = (scores) => {
    if (scores.length === 0) {
        return { avg: 0, median: 0, min: 0, max: 0, range: 'N/A', distribution: {}, totalPoints: 'N/A' };
    }
    const sortedScores = [...scores].sort((a, b) => a - b);
    const sum = sortedScores.reduce((acc, val) => acc + val, 0);
    const avg = sum / sortedScores.length;
    const min = sortedScores[0];
    const max = sortedScores[sortedScores.length - 1];

    let median;
    const mid = Math.floor(sortedScores.length / 2);
    if (sortedScores.length % 2 === 0) {
        median = (sortedScores[mid - 1] + sortedScores[mid]) / 2;
    } else {
        median = sortedScores[mid];
    }
    const range = `${min} - ${max} points`;

    const distribution = {};
    sortedScores.forEach(score => {
        distribution[score] = (distribution[score] || 0) + 1;
    });

    return { avg, median, min, max, range, distribution, totalPoints: max };
};

// --- PDF Color Helpers ---
const getPdfScoreStyles = (value) => {
    const styles = { fillColor: [255, 255, 255], textColor: [0, 0, 0] };
    if (isNaN(value) || value === null) {
        styles.fillColor = [55, 65, 81]; styles.textColor = [255, 255, 255]; return styles;
    }
    if (value === 100) { styles.fillColor = [187, 247, 208]; styles.textColor = [22, 101, 52]; }
    else if (value >= 95) { styles.fillColor = [254, 240, 138]; styles.textColor = [133, 77, 14]; }
    else if (value >= 90) { styles.fillColor = [254, 215, 170]; styles.textColor = [154, 52, 18]; }
    else { styles.fillColor = [254, 202, 202]; styles.textColor = [153, 27, 27]; }
    return styles;
};

const getPdfImprovementStyles = (preScore, postScore) => {
    const styles = { fillColor: [255, 255, 255], textColor: [0, 0, 0] };
    const pre = Number(preScore);
    const post = Number(postScore);
    if (isNaN(pre) || isNaN(post) || pre === 0 || post === 0) {
        styles.fillColor = [55, 65, 81]; styles.textColor = [255, 255, 255]; return styles;
    }
    const increase = ((post - pre) / pre) * 100;
    if (isNaN(increase) || increase === null) {
        styles.fillColor = [55, 65, 81]; styles.textColor = [255, 255, 255]; return styles;
    }
    if (increase > 50) { styles.fillColor = [187, 247, 208]; styles.textColor = [22, 101, 52]; }
    else if (increase >= 30) { styles.fillColor = [254, 240, 138]; styles.textColor = [133, 77, 14]; }
    else if (increase >= 15) { styles.fillColor = [229, 231, 235]; styles.textColor = [31, 41, 55]; }
    else if (increase < 0) { styles.fillColor = [254, 202, 202]; styles.textColor = [153, 27, 27]; }
    else { styles.fillColor = [254, 215, 170]; styles.textColor = [154, 52, 18]; }
    return styles;
};

// --- PDF EXPORT HELPER ---
const generateFullCourseReportPdf = async (course, quality, onSuccess, onError, tableData) => {
    const { filteredPracticalParticipants, filteredWrittenParticipants, practicalTableHeaders, writtenTableHeaders, showCaseColumns, showTestScoreColumns, isSharedView } = tableData;
    const qualityProfiles = {
        print: { scale: 2, fileSuffix: '', imageType: 'image/jpeg', imageQuality: 0.95, imageFormat: 'JPEG', compression: 'MEDIUM' },
        screen: { scale: 1.5, fileSuffix: '', imageType: 'image/png', imageQuality: 1.0, imageFormat: 'PNG', compression: 'FAST' }
    };
    const profile = qualityProfiles[quality] || qualityProfiles.print;
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const fileName = `Course_Report_${course.course_type}_${course.state}.pdf`;
    
    doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');

    let y = 15;
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);

    const checkPageBreak = (currentY, elementHeight) => {
        if (currentY + elementHeight + margin > pageHeight) {
            doc.addPage();
            doc.setFont('Amiri');
            return margin;
        }
        return currentY;
    };

    const addCanvasImageToPdf = async (elementId, currentY) => {
        const element = document.getElementById(elementId);
        if (!element) return currentY;
        try {
            const canvas = await html2canvas(element, { scale: profile.scale, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL(profile.imageType, profile.imageQuality);
            const imgWidth = contentWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            currentY = checkPageBreak(currentY, imgHeight);
            doc.addImage(imgData, profile.imageFormat, margin, currentY, imgWidth, imgHeight, undefined, profile.compression);
            return currentY + imgHeight + 5;
        } catch (e) {
            console.error(`Failed to add canvas for ${elementId}:`, e);
            throw e;
        }
    };

    const addTitle = (text, currentY) => {
        currentY = checkPageBreak(currentY, 10);
        doc.setFontSize(16); doc.setFont('Amiri', 'normal');
        doc.text(text, margin, currentY, { align: 'left' });
        return currentY + 10;
    };

    const autoTableStyles = {
        theme: 'grid',
        styles: { font: 'Amiri', fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        headStyles: { font: 'Amiri', fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
    };

    try {
        doc.setFontSize(20); doc.setFont('Amiri', 'normal');
        doc.text(`Full Course Report: ${course.course_type} - ${course.state}`, margin, y, { align: 'left' });
        y += 10;

        // Sequence matches UI flow
        y = await addCanvasImageToPdf('course-info-card', y);
        if (document.getElementById('kpi-card')) y = await addCanvasImageToPdf('kpi-card', y);
        if (document.getElementById('test-scores-card')) y = await addCanvasImageToPdf('test-scores-card', y);
        if (document.getElementById('investment-card')) y = await addCanvasImageToPdf('investment-card', y);
        if (document.getElementById('coverage-card')) y = await addCanvasImageToPdf('coverage-card', y);
        if (document.getElementById('new-imci-facilities-card')) y = await addCanvasImageToPdf('new-imci-facilities-card', y);

        if (document.getElementById('charts-grid')) {
             y = addTitle('Performance Charts', y);
             y = await addCanvasImageToPdf('charts-grid', y);
        }

        if (document.getElementById('daily-tables-section')) y = await addCanvasImageToPdf('daily-tables-section', y);
        
        if (document.getElementById('practical-summary-table')) {
            y = addTitle('Practical Case Score Summary', y);
            y = await addCanvasImageToPdf('practical-summary-table', y);
        }

        if (document.getElementById('written-summary-table')) {
            y = addTitle('Written Test Score Summary', y);
            y = await addCanvasImageToPdf('written-summary-table', y);
        }

        if (showCaseColumns && filteredPracticalParticipants.length > 0) {
            y = addTitle('Detailed Practical Case Results', y);
            const head = [practicalTableHeaders];
            const body = filteredPracticalParticipants.map((p, index) => {
                const row = [index + 1, p.name, p.total_cases_seen];
                if (!isSharedView) row.push(getCaseCorrectnessName(p.correctness_percentage));
                return row;
            });

            doc.setFont('Amiri');
            autoTable(doc, {
                ...autoTableStyles, head: head, body: body, startY: y,
                didDrawPage: (data) => { y = data.cursor.y; doc.setFont('Amiri'); },
                didParseCell: (data) => {
                    data.cell.styles.font = 'Amiri';
                    const colKey = head[0][data.column.index];
                    if (colKey === 'Participant Name') { data.cell.styles.overflow = 'ellipsis'; data.cell.styles.cellWidth = 'auto'; }
                    else { data.cell.styles.overflow = 'linebreak'; }
                    if (data.section === 'head') { data.cell.styles.halign = 'center'; data.cell.styles.fontStyle = 'bold'; return; }
                    if (data.section === 'body') {
                        const participant = filteredPracticalParticipants[data.row.index];
                        if (!participant) return;
                        let styles = null;
                        if (colKey === 'Practical Case Score') styles = getPdfScoreStyles(participant.correctness_percentage);
                        if (styles) { data.cell.styles.fillColor = styles.fillColor; data.cell.styles.textColor = styles.textColor; }
                        if (colKey === 'Participant Name') data.cell.styles.halign = 'right'; else data.cell.styles.halign = 'center';
                    }
                }
            });
            y = doc.lastAutoTable.finalY + 10;
        }

        if (showTestScoreColumns && filteredWrittenParticipants.length > 0) {
            y = addTitle('Detailed Written Test Results', y);
            const head = [writtenTableHeaders];
            const body = filteredWrittenParticipants.map((p, index) => {
                const preScore = Number(p.pre_test_score);
                const postScore = Number(p.post_test_score);
                const increase = (!isNaN(preScore) && preScore > 0 && !isNaN(postScore) && postScore > 0) ? ((postScore - preScore) / preScore) * 100 : null;
                const category = getAvgImprovementCategory(p.pre_test_score, p.post_test_score);
                return [index + 1, p.name, fmtDecimal(preScore), fmtDecimal(postScore), isNaN(increase) || increase === null ? 'N/A' : `${increase.toFixed(1)}%`, category.name];
            });

            doc.setFont('Amiri');
            autoTable(doc, {
                ...autoTableStyles, head: head, body: body, startY: y,
                didDrawPage: (data) => { y = data.cursor.y; doc.setFont('Amiri'); },
                didParseCell: (data) => {
                    data.cell.styles.font = 'Amiri';
                    const colKey = head[0][data.column.index];
                    if (colKey === 'Participant Name') { data.cell.styles.overflow = 'ellipsis'; data.cell.styles.cellWidth = 'auto'; }
                    else { data.cell.styles.overflow = 'linebreak'; }
                    if (data.section === 'head') { data.cell.styles.halign = 'center'; data.cell.styles.fontStyle = 'bold'; return; }
                    if (data.section === 'body') {
                        const participant = filteredWrittenParticipants[data.row.index];
                        if (!participant) return;
                        let styles = null;
                        if (colKey === 'Average Improvement') styles = getPdfImprovementStyles(participant.pre_test_score, participant.post_test_score);
                        if (styles) { data.cell.styles.fillColor = styles.fillColor; data.cell.styles.textColor = styles.textColor; }
                        if (colKey === 'Participant Name') data.cell.styles.halign = 'right'; else data.cell.styles.halign = 'center';
                    }
                }
            });
            y = doc.lastAutoTable.finalY + 10;
        }

        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont('Amiri'); doc.setFontSize(10); doc.setTextColor(150);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const text = `Page ${i} of ${pageCount}`;
            const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
            const x = (pageWidth - textWidth) / 2;
            doc.text(text, x, pageHeight - 10);
        }

        if (Capacitor.isNativePlatform()) {
            const base64Data = doc.output('datauristring').split('base64,')[1];
            const writeResult = await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Downloads });
            await FileOpener.open({ filePath: writeResult.uri, contentType: 'application/pdf' });
            onSuccess(`PDF saved to Downloads folder: ${fileName}`);
        } else {
            doc.save(fileName);
            onSuccess("PDF download initiated.");
        }
    } catch (e) {
        console.error("Error generating or saving PDF:", e);
        onError(`Failed to save PDF: ${e.message || 'Unknown error'}`);
    }
};

// --- MAIN COMPONENT: CourseReportView ---
export function CourseReportView({ 
    course, onBack, participants: rawParticipants, allObs: rawObs, allCases: rawCases, finalReportData, onEditFinalReport, 
    onDeletePdf, onViewParticipantReport, isSharedView = false, onShare, setToast, allHealthFacilities: rawFacilities,
    onSaveFinalReport
}) {
    const [activeTab, setActiveTab] = useState('full-course-report');
    
    // --- APPLY SOFT DELETE FILTERS ---
    const participants = useMemo(() => (rawParticipants || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true"), [rawParticipants]);
    const allObs = useMemo(() => (rawObs || []).filter(o => o.isDeleted !== true && o.isDeleted !== "true"), [rawObs]);
    const allCases = useMemo(() => (rawCases || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true"), [rawCases]);
    const allHealthFacilities = useMemo(() => (rawFacilities || []).filter(f => f.isDeleted !== true && f.isDeleted !== "true"), [rawFacilities]);
    const activeFinalReport = (finalReportData && finalReportData.isDeleted !== true && finalReportData.isDeleted !== "true") ? finalReportData : null;


    const [subTypeFilter, setSubTypeFilter] = useState('All');
    
    const availableSubTypes = useMemo(() => {
        const types = new Set();
        participants.forEach(p => {
            const subType = p.imci_sub_type || course.facilitatorAssignments?.find(a => a.group === p.group)?.imci_sub_type;
            if (subType) types.add(subType);
        });
        return ['All', ...Array.from(types).sort()];
    }, [participants, course]);

    const reportParticipants = useMemo(() => {
        if (subTypeFilter === 'All') return participants;
        return participants.filter(p => {
            const subType = p.imci_sub_type || course.facilitatorAssignments?.find(a => a.group === p.group)?.imci_sub_type;
            return subType === subTypeFilter;
        });
    }, [participants, subTypeFilter, course]);

    const overallChartRef = useRef(null);
    const dailyChartRef = useRef(null);
    const prePostDistributionChartRef = useRef(null);
    const [scoreFilter, setScoreFilter] = useState('All');
    const [caseCorrectnessFilter, setCaseCorrectnessFilter] = useState('All');
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    
    // State for historical coverage tracking
    const [coverageData, setCoverageData] = useState(null);
    const [isCoverageModalOpen, setIsCoverageModalOpen] = useState(false);
    const [historicalCoveragePreview, setHistoricalCoveragePreview] = useState(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isSavingCoverage, setIsSavingCoverage] = useState(false);

    // Internal state for local ShareModal
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    
    const { user } = useAuth();
    const dataCache = useDataCache();
    const fetchCourses = dataCache?.fetchCourses;
    const [isSuperUser, setIsSuperUser] = useState(false);
    const [isFederalManager, setIsFederalManager] = useState(false);

    useEffect(() => {
        if (user && !isSharedView) {
            getDoc(doc(db, 'users', user.uid)).then(snap => {
                if (snap.exists()) {
                    const permissions = snap.data().permissions;
                    if (permissions?.canUseSuperUserAdvancedFeatures) {
                        setIsSuperUser(true);
                    }
                    if (permissions?.canUseFederalManagerAdvancedFeatures) {
                        setIsFederalManager(true);
                    }
                }
            }).catch(e => console.error(e));
        }
    }, [user, isSharedView]);

    const [isEditCoverageModalOpen, setIsEditCoverageModalOpen] = useState(false);
    const [editableCoverageData, setEditableCoverageData] = useState(null);

    const openEditCoverageModal = () => {
        setEditableCoverageData(JSON.parse(JSON.stringify(coverageData)));
        setIsEditCoverageModalOpen(true);
    };

    const handleCoverageEditChange = (level, index, field, value) => {
        const val = Number(value);
        setEditableCoverageData(prev => {
            const newData = { ...prev };
            let target;
            if (level === 'national') target = newData.nationalCov;
            else if (level === 'state') target = newData.stateCoverage[index];
            else if (level === 'locality') target = newData.localityCoverage[index];

            target[field] = val;
            
            target.covBefore = target.totalPhc > 0 ? (target.phcWithImnciBefore / target.totalPhc) * 100 : 0;
            target.covAfter = target.totalPhc > 0 ? ((target.phcWithImnciBefore + target.newPhc) / target.totalPhc) * 100 : 0;
            target.increase = target.covAfter - target.covBefore;

            return newData;
        });
    };

    const handleSaveEditedCoverage = async () => {
        setIsSavingCoverage(true);
        try {
            const currentUserIdentifier = user?.displayName || user?.email || 'Unknown';
            // INCREMENTAL UPDATE: Send only the ID and the snapshot field
            await upsertCourse({ 
                id: course.id, 
                coverageSnapshot: editableCoverageData 
            }, currentUserIdentifier);
            
            if (fetchCourses) await fetchCourses();
            
            setCoverageData(editableCoverageData);
            setIsEditCoverageModalOpen(false);
            notify("Baseline coverage updated successfully.", "success");
        } catch (error) {
            notify("Failed to update coverage.", "error");
        } finally {
            setIsSavingCoverage(false);
        }
    };
    
    const notify = (message, type = 'info') => {
        if (setToast) {
            setToast({ show: true, message, type });
        } else {
            alert(message);
        }
    };

    const isLoading = !course || !participants || !allObs || !allCases;

    // Synchronize local coverageData state with course snapshot when available
    useEffect(() => {
        if (course?.coverageSnapshot) {
            setCoverageData(course.coverageSnapshot);
        } else {
            setCoverageData(null);
        }
    }, [course]);

    const { 
        groupPerformance, overall, dailyPerformance, hasTestScores, hasCases, participantsWithStats, 
        preTestStats, postTestStats, totalImprovement, caseCorrectnessDistribution, 
        newImciFacilities, avgImprovementDistribution
    } = useMemo(() => {
        if (isLoading) { 
            return {
                groupPerformance: {}, overall: { totalCases: 0, correctCases: 0, avgCasesPerParticipant: 0, caseCorrectnessPercentage: 0, totalSkills: 0, correctSkills: 0, avgSkillsPerParticipant: 0, skillCorrectnessPercentage: 0 },
                dailyPerformance: {}, preTestStats: { avg: 0, median: 0, min: 0, max: 0, range: 'N/A', distribution: {} },
                postTestStats: { avg: 0, median: 0, min: 0, max: 0, range: 'N/A', distribution: {} }, totalImprovement: 0,
                hasTestScores: false, hasCases: false, participantsWithStats: [], caseCorrectnessDistribution: {},
                avgImprovementDistribution: {}, newImciFacilities: []
            };
        }

        const preScoresForAvg = reportParticipants.map(p => Number(p.pre_test_score)).filter(score => !isNaN(score) && score > 0);
        const postScoresForAvg = reportParticipants.map(p => Number(p.post_test_score)).filter(score => !isNaN(score) && score > 0);
        const preTestStats = getStatsAndDistribution(preScoresForAvg);
        const postTestStats = getStatsAndDistribution(postScoresForAvg);
        const totalImprovement = preTestStats.avg > 0 ? ((postTestStats.avg - preTestStats.avg) / preTestStats.avg) * 100 : 0;
        let hasAnyScores = preScoresForAvg.length > 0 || postScoresForAvg.length > 0;

        const groupPerformance = {};
        const allGroups = new Set();
        reportParticipants.forEach(p => {
            if (p.group) {
                if (!groupPerformance[p.group]) groupPerformance[p.group] = { pids: [], totalObs: 0, correctObs: 0, totalCases: 0, correctCases: 0, totalSkills: 0, correctSkills: 0 };
                groupPerformance[p.group].pids.push(p.id);
                allGroups.add(p.group);
            }
        });

        const dailyPerformance = {};
        allObs.forEach(o => {
            const p = reportParticipants.find(p => p.id === o.participant_id);
            if (p && groupPerformance[p.group]) {
                if (o.day_of_course) {
                    const day = `Day ${o.day_of_course}`;
                    if (!dailyPerformance[day]) {
                        dailyPerformance[day] = {};
                        allGroups.forEach(g => { dailyPerformance[day][g] = { correct: 0, total: 0, cases: 0, correctCases: 0 }; });
                    }
                    if (dailyPerformance[day][p.group]) {
                        dailyPerformance[day][p.group].total++;
                        if (o.item_correct > 0) dailyPerformance[day][p.group].correct++;
                    }
                }
            }
        });

        let hasCases = false;
        allCases.forEach(c => {
            const p = reportParticipants.find(p => p.id === c.participant_id);
            if (p && groupPerformance[p.group]) {
                groupPerformance[p.group].totalCases++;
                if (c.is_correct) groupPerformance[p.group].correctCases++;
                hasCases = true;
                if (c.day_of_course) {
                    const day = `Day ${c.day_of_course}`;
                    if (dailyPerformance[day] && dailyPerformance[day][p.group]) {
                        dailyPerformance[day][p.group].cases++;
                        if (c.is_correct) dailyPerformance[day][p.group].correctCases++;
                    }
                }
            }
        });
        
        Object.keys(groupPerformance).forEach(g => {
            const group = groupPerformance[g];
            const groupObs = allObs.filter(o => group.pids.includes(o.participant_id));
            group.totalObs = groupObs.length;
            group.correctObs = groupObs.filter(o => o.item_correct > 0).length;
            group.percentage = calcPct(group.correctObs, group.totalObs);
            group.participantCount = group.pids.length;
        });

        let totalObs = 0, correctObs = 0, totalCases = 0, correctCases = 0;
        Object.keys(groupPerformance).forEach(g => {
            const group = groupPerformance[g];
            totalObs += group.totalObs; correctObs += group.correctObs; totalCases += group.totalCases; correctCases += group.correctCases;
        });
        
        const participantsWithStats = reportParticipants.map(p => {
            const participantCases = allCases.filter(c => c.participant_id === p.id);
            const participantObs = allObs.filter(o => o.participant_id === p.id);
            const correctSkills = participantObs.filter(o => o.item_correct > 0).length;
            const totalSkills = participantObs.length;
            return {
                ...p, total_cases_seen: participantCases.length, total_skills_recorded: totalSkills, correctness_percentage: calcPct(correctSkills, totalSkills)
            };
        });
        
        const overall = {
            totalCases, correctCases, avgCasesPerParticipant: (totalCases / reportParticipants.length) || 0, caseCorrectnessPercentage: calcPct(correctCases, totalCases),
            totalSkills: totalObs, correctSkills: correctObs, avgSkillsPerParticipant: (totalObs / reportParticipants.length) || 0, skillCorrectnessPercentage: calcPct(correctObs, totalObs)
        };

        const caseCorrectnessDistribution = { 'Perfect': 0, 'Excellent': 0, 'Good': 0, 'Fair': 0, 'Fail': 0, 'Data Incomplete': 0 };
        participantsWithStats.forEach(p => {
            const categoryName = getCaseCorrectnessName(p.correctness_percentage);
            if (caseCorrectnessDistribution.hasOwnProperty(categoryName)) caseCorrectnessDistribution[categoryName]++;
        });

        const avgImprovementDistribution = { 'Perfect': 0, 'Excellent': 0, 'Good': 0, 'Fair': 0, 'Fail': 0, 'Data Incomplete': 0 };
        participantsWithStats.forEach(p => {
            const category = getAvgImprovementCategory(p.pre_test_score, p.post_test_score);
            if (avgImprovementDistribution.hasOwnProperty(category.name)) avgImprovementDistribution[category.name]++;
        });

        const newImciFacilityMap = new Map();
        participantsWithStats.filter(p => p.introduced_imci_to_facility === true).forEach(p => {
            const key = `${p.center_name}|${p.locality}|${p.state}`;
            if (!newImciFacilityMap.has(key)) {
                const matchedFacility = allHealthFacilities?.find(f => 
                    f['اسم_المؤسسة'] === p.center_name && 
                    f['المحلية'] === p.locality && 
                    f['الولاية'] === p.state
                );
                
                let isHospital = false;
                if (matchedFacility && matchedFacility['نوع_المؤسسةالصحية']) {
                    isHospital = ['مستشفى', 'مستشفى ريفي'].includes(matchedFacility['نوع_المؤسسةالصحية']);
                } else {
                    const name = p.center_name;
                    isHospital = (typeof name === 'string') && (name.includes('مستشفى') || name.toLowerCase().includes('hospital'));
                }

                newImciFacilityMap.set(key, { 
                    name: p.center_name, 
                    locality: p.locality, 
                    state: p.state,
                    isHospital: isHospital
                });
            }
        });
        const newImciFacilities = Array.from(newImciFacilityMap.values());

        return { 
            groupPerformance, overall, dailyPerformance, preTestStats, postTestStats, totalImprovement, 
            hasTestScores: hasAnyScores, hasCases, participantsWithStats, caseCorrectnessDistribution, 
            avgImprovementDistribution, newImciFacilities
        };
    }, [reportParticipants, allObs, allCases, isLoading, allHealthFacilities, course]); 

    // Handle Historical Coverage Retrieval via Explicit Action
    const handleRetrieveCoverageHistory = async () => {
        setIsCoverageModalOpen(true);
        setIsPreviewLoading(true);
        setHistoricalCoveragePreview(null);

        try {
            const courseStates = course.states || (course.state ? course.state.split(',').map(s=>s.trim()) : []);
            const courseLocalities = course.localities || (course.locality ? course.locality.split(',').map(l=>l.trim()) : []);
            const combinedStates = [...new Set([...courseStates, ...newImciFacilities.map(f => f.state)])].filter(Boolean);
            const combinedLocalities = [...new Set([...courseLocalities, ...newImciFacilities.map(f => f.locality)])].filter(Boolean);

            const historicalFacilitiesData = await fetchFacilitiesHistoryMultiDate(combinedStates, [course.start_date]);
            const historicalFacilities = historicalFacilitiesData[0] || [];

            const calculateCoverageInfo = (facilitiesFilter, newImciFilter, isNational = false) => {
                const historicalPhcFacilities = historicalFacilities
                    .filter(facilitiesFilter)
                    .filter(f => f['هل_المؤسسة_تعمل'] === 'Yes')
                    .filter(f => ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية']));
                
                let totalPhc = historicalPhcFacilities.length;
                if (isNational) {
                    totalPhc = (allHealthFacilities || [])
                        .filter(facilitiesFilter)
                        .filter(f => f['هل_المؤسسة_تعمل'] === 'Yes')
                        .filter(f => ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية']))
                        .length;
                }
                
                const newPhcImciFacilities = newImciFacilities.filter(f => !f.isHospital);
                const courseNewPhcs = newPhcImciFacilities.filter(newImciFilter);
                const newPhc = courseNewPhcs.length;
                const newPhcNames = new Set(courseNewPhcs.map(f => f.name));

                let phcWithImnciBefore = 0;

                historicalPhcFacilities.forEach(f => {
                    if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') {
                        if (!newPhcNames.has(f['اسم_المؤسسة']) && !newPhcNames.has(f['name'])) {
                            phcWithImnciBefore++;
                        }
                    }
                });

                const covBefore = totalPhc > 0 ? (phcWithImnciBefore / totalPhc) * 100 : 0;
                const covAfter = totalPhc > 0 ? ((phcWithImnciBefore + newPhc) / totalPhc) * 100 : 0;
                const increase = covAfter - covBefore; 
                
                return { totalPhc, phcWithImnciBefore, newPhc, covBefore, covAfter, increase };
            };

            const nationalCov = calculateCoverageInfo(f => f['الولاية'] !== 'إتحادي', () => true, true);
            
            const stateCoverage = combinedStates.map(s => {
                const info = calculateCoverageInfo(f => f['الولاية'] === s, f => f.state === s, false);
                return { name: s, ...info };
            });

            const localityCoverage = combinedLocalities.map(l => {
                const info = calculateCoverageInfo(f => f['المحلية'] === l, f => f.locality === l, false);
                return { name: l, ...info };
            });

            const totalBudget = Number(course.course_budget) || 0;
            const costPerParticipant = participants.length > 0 ? totalBudget / participants.length : 0;
            const costPerNewFacility = nationalCov.newPhc > 0 ? totalBudget / nationalCov.newPhc : 0;

            setHistoricalCoveragePreview({
                totalBudget, costPerParticipant, costPerNewFacility, totalNewFacilities: newImciFacilities.length,
                nationalCov, stateCoverage, localityCoverage,
                retrievedAt: new Date().toISOString()
            });

        } catch (error) {
            console.error("Error calculating historical coverage:", error);
            notify("Failed to load historical coverage baseline.", "error");
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleConfirmCoverage = async () => {
        setIsSavingCoverage(true);
        try {
            const currentUserIdentifier = user?.displayName || user?.email || 'Unknown';
            // INCREMENTAL UPDATE: Send only the ID and the snapshot field
            await upsertCourse({ 
                id: course.id, 
                coverageSnapshot: historicalCoveragePreview 
            }, currentUserIdentifier); 
            
            if (fetchCourses) await fetchCourses(); 
            
            setCoverageData(historicalCoveragePreview); 
            setIsCoverageModalOpen(false);
            notify("Baseline coverage saved successfully.", "success");
        } catch (error) {
            notify("Failed to save coverage.", "error");
        } finally {
            setIsSavingCoverage(false);
        }
    };

    const groupsWithData = Object.keys(groupPerformance).sort();
    const dailyChartLabels = Object.keys(dailyPerformance).sort((a, b) => {
        const dayA = parseInt(a.replace('Day ', ''));
        const dayB = parseInt(b.replace('Day ', ''));
        return dayA - dayB;
    });

    const dailySkillTableData = dailyChartLabels.map(day => {
        const row = { day, totalSkills: { correct: 0, total: 0 } };
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[day] && dailyPerformance[day][group] ? dailyPerformance[day][group] : { correct: 0, total: 0, cases: 0 };
            const pct = dayData.total > 0 ? calcPct(dayData.correct, dayData.total) : NaN;
            row[group] = { pct, display: dayData.total > 0 ? `${dayData.total} (${fmtPct(pct)})` : '-' };
            row.totalSkills.correct += dayData.correct;
            row.totalSkills.total += dayData.total;
        });
        const totalDayPct = row.totalSkills.total > 0 ? calcPct(row.totalSkills.correct, row.totalSkills.total) : NaN;
        row.totalDisplay = row.totalSkills.total > 0 ? `${row.totalSkills.total} (${fmtPct(totalDayPct)})` : '-';
        row.totalDayPct = totalDayPct;
        return row;
    });

    const groupSkillTotals = {};
    groupsWithData.forEach(group => { groupSkillTotals[group] = { totalSkills: { correct: 0, total: 0 } }; });
    let grandTotalSkillsCorrect = 0, grandTotalSkillsTotal = 0;
    dailySkillTableData.forEach(row => {
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[row.day] && dailyPerformance[row.day][group] ? dailyPerformance[row.day][group] : { correct: 0, total: 0 };
            groupSkillTotals[group].totalSkills.correct += dayData.correct; groupSkillTotals[group].totalSkills.total += dayData.total;
        });
        grandTotalSkillsCorrect += row.totalSkills.correct; grandTotalSkillsTotal += row.totalSkills.total;
    });

    const dailyCaseTableData = dailyChartLabels.map(day => {
        const row = { day, totalCases: { correct: 0, total: 0 } };
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[day] && dailyPerformance[day][group] ? dailyPerformance[day][group] : { cases: 0, correctCases: 0 };
            const pct = dayData.cases > 0 ? calcPct(dayData.correctCases, dayData.cases) : NaN;
            row[group] = { pct, display: dayData.cases > 0 ? `${dayData.cases} (${fmtPct(pct)})` : '-' };
            row.totalCases.correct += dayData.correctCases; row.totalCases.total += dayData.cases;
        });
        const totalDayPct = row.totalCases.total > 0 ? calcPct(row.totalCases.correct, row.totalCases.total) : NaN;
        row.totalDisplay = row.totalCases.total > 0 ? `${row.totalCases.total} (${fmtPct(totalDayPct)})` : '-';
        row.totalDayPct = totalDayPct;
        return row;
    });

    const groupCaseTotals = {};
    groupsWithData.forEach(group => { groupCaseTotals[group] = { totalCases: { correct: 0, total: 0 } }; });
    let grandTotalCasesCorrect = 0, grandTotalCasesTotal = 0;
    dailyCaseTableData.forEach(row => {
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[row.day] && dailyPerformance[row.day][group] ? dailyPerformance[row.day][group] : { cases: 0, correctCases: 0 };
            groupCaseTotals[group].totalCases.correct += dayData.correctCases; groupCaseTotals[group].totalCases.total += dayData.cases;
        });
        grandTotalCasesCorrect += row.totalCases.correct; grandTotalCasesTotal += row.totalCases.total;
    });

    const filteredPracticalParticipants = useMemo(() => {
        let ps = [...participantsWithStats];
        if (caseCorrectnessFilter !== 'All') {
            ps = ps.filter(p => getCaseCorrectnessName(p.correctness_percentage) === caseCorrectnessFilter);
        }
        ps.sort((a, b) => (b.correctness_percentage ?? -1) - (a.correctness_percentage ?? -1));
        return ps;
    }, [participantsWithStats, caseCorrectnessFilter]);

    const filteredWrittenParticipants = useMemo(() => {
        let ps = [...participantsWithStats];
        if (scoreFilter !== 'All') {
             ps = ps.filter(p => getAvgImprovementCategory(p.pre_test_score, p.post_test_score).name === scoreFilter);
        }
        ps.sort((a, b) => {
            const getInc = p => {
                const pre = Number(p.pre_test_score); const post = Number(p.post_test_score);
                if (!isNaN(pre) && pre > 0 && !isNaN(post) && post > 0) return ((post - pre) / pre) * 100;
                return -1000;
            };
            return getInc(b) - getInc(a);
        });
        return ps;
    }, [participantsWithStats, scoreFilter]);

    const showTestScoreColumns = hasTestScores;
    const showCaseColumns = hasCases;
    const practicalTableHeaders = ['#', 'Participant Name', 'Total Cases'];
    if (!isSharedView) practicalTableHeaders.push('Practical Case Score');
    const writtenTableHeaders = ['#', 'Participant Name', 'Pre-Test Result', 'Post-Test Result', '% Increase', 'Average Improvement'];

    const handlePdfGeneration = async (quality) => {
        setIsPdfGenerating(true);
        await new Promise(resolve => setTimeout(resolve, 100));
        const pdfTableData = {
            filteredPracticalParticipants, filteredWrittenParticipants, practicalTableHeaders, writtenTableHeaders, showCaseColumns, showTestScoreColumns, isSharedView, dailyCaseTableData, dailySkillTableData,
            groupsWithData, groupCaseTotals, grandTotalCasesCorrect, grandTotalCasesTotal, groupSkillTotals, grandTotalSkillsCorrect, grandTotalSkillsTotal
        };
        try {
            await generateFullCourseReportPdf(course, quality, (message) => notify(message, 'success'), (message) => notify(message, 'error'), pdfTableData);
        } catch (error) {
            console.error("Failed to generate PDF:", error); notify("Sorry, there was an error generating the PDF.", 'error');
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const handleCopyAsImage = async (elementId) => {
        const element = document.getElementById(elementId);
        if (!element) { alert('Could not find element to copy.'); return; }
        try {
            const canvas = await html2canvas(element, {
                scale: 2, useCORS: true, backgroundColor: '#ffffff',
                onclone: (document) => { 
                    const buttons = document.querySelectorAll(`#${elementId} .copy-button`); 
                    buttons.forEach(btn => btn.style.visibility = 'hidden'); 
                }
            });
            canvas.toBlob(async (blob) => {
                if (navigator.clipboard && navigator.clipboard.write) {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); alert('Card copied to clipboard as an image!');
                } else { alert('Clipboard API not available in this browser.'); }
            }, 'image/png');
        } catch (error) { console.error('Failed to copy image:', error); alert('Failed to copy image to clipboard.'); }
    };

    const excludedImnciSubtypes = ["Standard 7 days course for Medical Doctors", "Standard 7 days course for Medical Assistance", "Refreshment IMNCI Course"];
    const showTestScoresOnScreen = course.course_type !== 'IMNCI' || (course.course_type === 'IMNCI' && !excludedImnciSubtypes.includes(course.imci_sub_type));

    if (isLoading) return <Card><Spinner /></Card>;

    const combinedChartData = {
        labels: groupsWithData,
        datasets: [
            { type: 'bar', label: 'Total Cases', data: groupsWithData.map(g => groupPerformance[g].totalCases), backgroundColor: '#3b82f6', yAxisID: 'y' },
            { type: 'bar', label: 'Total Correct Cases', data: groupsWithData.map(g => groupPerformance[g].correctCases), backgroundColor: '#10b981', yAxisID: 'y' }
        ]
    };
    const combinedChartOptions = {
        responsive: true,
        plugins: { legend: { position: 'top' }, title: { display: true, text: 'Overall Performance by Group: Cases & Correct Cases' }, datalabels: { anchor: 'end', align: 'top', formatter: (value) => value > 0 ? value : '', font: { weight: 'bold', size: 10 }, color: '#000' } },
        scales: { y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Total Count' }, beginAtZero: true } }
    };

    const dailyChartData = {
        labels: dailyChartLabels,
        datasets: [
            { type: 'bar', label: 'Total Cases', data: dailyChartLabels.map(day => { let t = 0; groupsWithData.forEach(g => { if(dailyPerformance[day][g]) t+= dailyPerformance[day][g].cases }); return t; }), backgroundColor: '#3b82f6', yAxisID: 'y' },
            { type: 'bar', label: 'Total Correct Cases', data: dailyChartLabels.map(day => { let t = 0; groupsWithData.forEach(g => { if(dailyPerformance[day][g]) t+= dailyPerformance[day][g].correctCases }); return t; }), backgroundColor: '#10b981', yAxisID: 'y' }
        ]
    };
    const dailyChartOptions = {
        responsive: true,
        plugins: { title: { display: true, text: 'Overall Performance by Day' }, legend: { position: 'top' }, datalabels: { anchor: 'end', align: 'top', formatter: (value) => value > 0 ? value : '', font: { weight: 'bold', size: 10 }, color: '#000' } },
        scales: { x: { title: { display: true, text: 'Day' } }, y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Total Count' }, beginAtZero: true } }
    };

    const chartParticipants = reportParticipants.filter(p => Number(p.pre_test_score) > 0 && Number(p.post_test_score) > 0);
    const participantCount = chartParticipants.length;
    const showCompactLabels = participantCount > 24;
    const preScores = chartParticipants.map(p => Number(p.pre_test_score));
    const postScores = chartParticipants.map(p => Number(p.post_test_score));
    const allScoresPct = [...preScores, ...postScores];
    const minScorePct = allScoresPct.length > 0 ? Math.min(...allScoresPct.filter(s => !isNaN(s))) : 0;
    let yMin = Math.max(0, minScorePct - 10); yMin = Math.floor(yMin / 5) * 5;
    let participantLabels = showCompactLabels ? chartParticipants.map((p, index) => `P${index + 1}`) : chartParticipants.map((p, index) => `${p.name} (${index + 1})`);
    
    const testScoreChartData = {
        labels: participantLabels,
        datasets: [
            { label: 'Pre-Test Score', data: preScores, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.2)', tension: 0.4, fill: false, pointRadius: showCompactLabels ? 3 : 5, pointBackgroundColor: '#6366f1' },
            { label: 'Post-Test Score', data: postScores, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', tension: 0.4, fill: false, pointRadius: showCompactLabels ? 3 : 5, pointBackgroundColor: '#10b981' }
        ]
    };
    const testScoreChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' }, title: { display: true, text: 'Participant Pre-Test vs. Post-Test Scores' },
            tooltip: { mode: 'index', intersect: false, callbacks: { title: function(context) { const idx = context[0].dataIndex; return `${chartParticipants[idx].name} (${idx + 1})`; }, label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.raw !== null) label += fmtPct(context.raw); return label; } } },
            datalabels: { display: false }
        },
        scales: { x: { title: { display: true, text: 'Participant' }, grid: { display: false }, ticks: { maxTicksLimit: 25 } }, y: { title: { display: true, text: 'Test Result (%)' }, beginAtZero: false, ticks: { stepSize: 5 }, min: yMin, max: 100 } }
    };
    
    const scoreFilterOptions = [ { name: 'All' }, { name: 'Perfect' }, { name: 'Excellent' }, { name: 'Good' }, { name: 'Fair' }, { name: 'Fail' }, { name: 'Data Incomplete' } ];
    const caseFilterOptions = [ { name: 'All' }, { name: 'Perfect' }, { name: 'Excellent' }, { name: 'Good' }, { name: 'Fail' }, { name: 'Data Incomplete' } ];
    const correctnessCategories = [
        { name: 'Perfect', colorClass: 'bg-green-200 text-green-800', key: 'Perfect', range: '> 50%' }, { name: 'Excellent', colorClass: 'bg-yellow-200 text-yellow-800', key: 'Excellent', range: '30% - 50%' },
        { name: 'Good', colorClass: 'bg-gray-200 text-gray-800', key: 'Good', range: '15% - 29.9%' }, { name: 'Fair', colorClass: 'bg-orange-200 text-orange-800', key: 'Fair', range: '0% - 14.9%' },
        { name: 'Fail', colorClass: 'bg-red-200 text-red-800', key: 'Fail', range: '< 0%' }, { name: 'Data Incomplete', colorClass: 'bg-gray-700 text-white', key: 'Data Incomplete', range: 'N/A' }
    ];
    const practicalScoreCategories = [
        { name: 'Perfect', colorClass: getScoreColorClass(100), key: 'Perfect', range: '100%' }, { name: 'Excellent', colorClass: getScoreColorClass(95), key: 'Excellent', range: '95% - 99.9%' },
        { name: 'Good', colorClass: getScoreColorClass(90), key: 'Good', range: '90% - 94.9%' }, { name: 'Fail', colorClass: getScoreColorClass(89), key: 'Fail', range: '< 90%' },
        { name: 'Data Incomplete', colorClass: getScoreColorClass(NaN), key: 'Data Incomplete', range: 'N/A' }
    ];

    const hasAnyKpis = overall.totalCases > 0 || overall.totalSkills > 0;
    const hasAnyCaseDataForCharts = combinedChartData.datasets[0].data.some(d => d > 0);
    const hasAnyDailyCaseDataForCharts = dailyChartData.datasets[0].data.some(d => d > 0);
    const hasDailyCaseData = dailyCaseTableData.length > 0;
    const hasDailySkillData = dailySkillTableData.length > 0;
    const hasTestScoreDataForKpis = preTestStats.avg > 0 || postTestStats.avg > 0;
    const hasChartParticipants = chartParticipants.length > 0;

    return (
        <div className="flex flex-col gap-6 pb-28 lg:pb-8 w-full max-w-full min-w-0">
            <PageHeader 
                title={activeTab === 'full-course-report' ? "Full Course Report" : activeTab === 'final-report' ? "Final Course Report" : "Individual Participant Report"} 
                subtitle={`${course.course_type} - ${course.state}`} 
                actions={
                    activeTab === 'full-course-report' ? (
                        isSharedView ? (
                            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                <Button onClick={() => handlePdfGeneration('print')} variant="secondary" disabled={isPdfGenerating} className="w-full sm:w-auto"><PdfIcon /> Export for Print</Button>
                                <Button onClick={() => handlePdfGeneration('screen')} variant="secondary" disabled={isPdfGenerating} className="w-full sm:w-auto"><PdfIcon /> Export for Sharing</Button>
                                {isPdfGenerating && <div className="flex items-center gap-2 text-gray-500 justify-center w-full sm:w-auto"><Spinner size="sm" /><span>Generating...</span></div>}
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto justify-start sm:justify-end mt-4 sm:mt-0">
                                <Button onClick={() => setIsShareModalOpen(true)} variant="secondary" disabled={isPdfGenerating} className="w-full sm:w-auto">
                                    <ShareIcon /> Share
                                </Button>
                                <Button onClick={() => handlePdfGeneration('print')} variant="secondary" disabled={isPdfGenerating} className="w-full sm:w-auto"><PdfIcon /> Export for Print</Button>
                                <Button onClick={() => handlePdfGeneration('screen')} variant="secondary" disabled={isPdfGenerating} className="w-full sm:w-auto"><PdfIcon /> Export for Sharing</Button>
                                {isPdfGenerating && <div className="flex items-center gap-2 text-gray-500 justify-center w-full sm:w-auto"><Spinner size="sm" /><span>Generating...</span></div>}
                                <Button onClick={onBack} disabled={isPdfGenerating} className="w-full sm:w-auto mt-2 sm:mt-0">Back to List</Button>
                            </div>
                        )
                    ) : (
                        !isSharedView ? <Button onClick={onBack} disabled={isPdfGenerating} className="w-full sm:w-auto mt-2 sm:mt-0">Back to List</Button> : null
                    )
                }
            />
            
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4 print-hide">
                <Button variant="tab" isActive={activeTab === 'full-course-report'} onClick={() => setActiveTab('full-course-report')}>Full Course Report</Button>
                <Button variant="tab" isActive={activeTab === 'individual-participant-report'} onClick={() => setActiveTab('individual-participant-report')}>Individual Participant Report</Button>
                
                {/* FINAL REPORT TAB - Access strictly bound to Federal Manager permissions */}
                {isFederalManager && !isSharedView && (
                    <Button variant="tab" isActive={activeTab === 'final-report'} onClick={() => setActiveTab('final-report')}>Final Report</Button>
                )}
            </div>

            {/* TAB CONTENT: FINAL REPORT MANAGER */}
            {activeTab === 'final-report' && isFederalManager && !isSharedView && (
                <div className="w-full max-w-full min-w-0 mt-4">
                    {/* 🟢 FIX: Added try/catch and fallback for onSaveFinalReport */}
                    <FinalReportManager 
                        course={course} 
                        participants={participants} 
                        onCancel={() => setActiveTab('full-course-report')} 
                        onSave={async (data) => {
                            try {
                                if (onSaveFinalReport) {
                                    await onSaveFinalReport(data);
                                } else {
                                    // Fallback: Save directly if the prop wasn't passed down properly
                                    const currentUserIdentifier = user?.displayName || user?.email || 'Unknown';
                                    await upsertFinalReport(data, currentUserIdentifier);
                                    notify("Final report saved successfully.", "success");
                                    setActiveTab('full-course-report'); // Return to main tab
                                }
                            } catch (error) {
                                console.error("Error saving final report:", error);
                                notify(`Failed to save final report: ${error.message}`, "error");
                            }
                        }} 
                        initialData={activeFinalReport} 
                        canUseFederalManagerAdvancedFeatures={isFederalManager}
                    />
                </div>
            )}

            {activeTab === 'full-course-report' && (
                <div id="full-course-report" className="flex flex-col gap-6 w-full max-w-full min-w-0">
                <Card>
                    <div id="course-info-card" className="relative p-2 w-full max-w-full min-w-0">
                        {!isSharedView && <button onClick={() => handleCopyAsImage('course-info-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                        <h3 className="text-xl font-bold mb-4">Course Information</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div><strong>State:</strong> {course.state}</div> <div><strong>Locality:</strong> {course.locality}</div>
                            {course.course_type === 'IMNCI' && course.imci_sub_type && <div><strong>IMNCI Course Type:</strong> {course.imci_sub_type}</div>}
                            <div><strong>Hall:</strong> {course.hall}</div> <div><strong>Start Date:</strong> {course.start_date}</div> <div><strong># Participants:</strong> {reportParticipants.length}</div>
                            <div><strong>Coordinator:</strong> {course.coordinator}</div> <div><strong>Director:</strong> {course.director}</div>
                            {course.clinical_instructor && <div><strong>Clinical Instructor:</strong> {course.clinical_instructor}</div>}
                            <div><strong>Funded by:</strong> {course.funded_by}</div>
                            {course.course_budget && <div><strong>Course Budget (USD):</strong> ${course.course_budget}</div>}
                            <div className="col-span-1 sm:col-span-2 md:col-span-4 break-words"><strong>Facilitators:</strong> {(course.facilitators || []).join(', ')}</div>
                        </div>
                    </div>
                </Card>

                {availableSubTypes.length > 1 && (
                    <Card>
                        <div className="p-4 bg-gray-50 border-b border-gray-100 w-full max-w-full min-w-0">
                            <FormGroup label="Filter Report by Course Sub-Type">
                                <Select value={subTypeFilter} onChange={e => setSubTypeFilter(e.target.value)} className="w-full md:w-1/3">
                                    {availableSubTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </Select>
                            </FormGroup>
                        </div>
                    </Card>
                )}

                {hasAnyKpis && (
                    <Card>
                        <div id="kpi-card" className="relative p-2 w-full max-w-full min-w-0">
                            {!isSharedView && <button onClick={() => handleCopyAsImage('kpi-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                            <h3 className="text-xl font-bold mb-4">Key Performance Indicators (KPIs)</h3>
                            <div className="flex flex-col gap-6 w-full max-w-full min-w-0">
                                <div>
                                    <h4 className="text-lg font-semibold mb-2 text-gray-700">Case KPIs</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                        <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg text-center w-full"><div className="text-sm text-gray-600">Total Cases</div><div className="text-3xl font-bold text-sky-700">{overall.totalCases}</div></div>
                                        <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg text-center w-full"><div className="text-sm text-gray-600">Total Correct Cases</div><div className="text-3xl font-bold text-sky-700">{overall.correctCases}</div></div>
                                        <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg text-center w-full"><div className="text-sm text-gray-600">Avg. Cases / Participant</div><div className="text-3xl font-bold text-sky-700">{overall.avgCasesPerParticipant.toFixed(1)}</div></div>
                                        <div className={`flex flex-col items-center justify-center p-4 rounded-lg text-center w-full ${getScoreColorClass(overall.caseCorrectnessPercentage)}`}><div className="text-sm font-semibold">Overall Correctness</div><div className="text-3xl font-bold">{fmtPct(overall.caseCorrectnessPercentage)}</div></div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold mb-2 text-gray-700">Skill/Classification KPIs</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                        <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg text-center w-full"><div className="text-sm text-gray-600">Total Skills</div><div className="text-3xl font-bold text-sky-700">{overall.totalSkills}</div></div>
                                        <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg text-center w-full"><div className="text-sm text-gray-600">Total Correct Skills</div><div className="text-3xl font-bold text-sky-700">{overall.correctSkills}</div></div>
                                        <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg text-center w-full"><div className="text-sm text-gray-600">Avg. Skills / Participant</div><div className="text-3xl font-bold text-sky-700">{overall.avgSkillsPerParticipant.toFixed(1)}</div></div>
                                        <div className={`flex flex-col items-center justify-center p-4 rounded-lg text-center w-full ${getScoreColorClass(overall.skillCorrectnessPercentage)}`}><div className="text-sm font-semibold">Overall Correctness</div><div className="text-3xl font-bold">{fmtPct(overall.skillCorrectnessPercentage)}</div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {showTestScoresOnScreen && hasTestScoreDataForKpis && (
                    <Card>
                        <div id="test-scores-card" className="relative p-2 w-full max-w-full min-w-0">
                            {!isSharedView && <button onClick={() => handleCopyAsImage('test-scores-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                            <h3 className="text-xl font-bold mb-4">Participant Test Scores</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-center mb-6">
                                <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg text-center w-full"><div className="text-sm font-semibold text-gray-600">Avg. Pre-Test</div><div className="text-2xl font-bold">{fmtPct(preTestStats.avg)}</div></div>
                                <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg text-center w-full"><div className="text-sm font-semibold text-gray-600">Avg. Post-Test</div><div className="text-2xl font-bold">{fmtPct(postTestStats.avg)}</div></div>
                                <div className={`flex flex-col items-center justify-center p-4 rounded-lg text-center w-full ${getScoreColorClass(totalImprovement, 'improvement')}`}><div className="text-sm font-semibold">Avg. Improvement</div><div className="text-2xl font-bold">{fmtPct(totalImprovement)}</div></div>
                            </div>
                            {hasChartParticipants ? (
                                <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2">
                                    <div style={{ height: '350px', minWidth: '600px' }} className="min-w-[600px]">
                                        <Line ref={prePostDistributionChartRef} data={testScoreChartData} options={testScoreChartOptions} />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200 w-full">
                                    No valid pre- and post-test data available for charting.
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {/* Show Retrieval Button if no coverage data exists for an IMNCI course */}
                {!coverageData && course?.course_type === 'IMNCI' && !isSharedView && (
                    <Card>
                        <div className="p-6 flex flex-col justify-center items-center text-center w-full max-w-full min-w-0">
                            <h3 className="text-lg font-bold text-gray-700 mb-2">No Baseline Coverage Data</h3>
                            <p className="text-sm text-gray-500 mb-4">Historical baseline coverage has not been calculated for this course yet.</p>
                            <Button onClick={handleRetrieveCoverageHistory} variant="primary" className="w-full sm:w-auto">
                                Retrieve Coverage History
                            </Button>
                        </div>
                    </Card>
                )}

                {coverageData && (
                    <>
                    <Card>
                        <div id="investment-card" className="relative p-2 w-full max-w-full min-w-0">
                            {!isSharedView && <button onClick={() => handleCopyAsImage('investment-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                            <h3 className="text-xl font-bold mb-4">Investment KPIs</h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-center">
                                <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg border border-blue-100 text-center w-full">
                                    <div className="text-sm font-semibold text-blue-700">Total Investment</div>
                                    <div className="text-2xl font-bold text-blue-800">${coverageData.totalBudget.toLocaleString()}</div>
                                </div>
                                <div className="flex flex-col items-center justify-center p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-center w-full">
                                    <div className="text-sm font-semibold text-yellow-700">Cost / Participant</div>
                                    <div className="text-2xl font-bold text-yellow-800">${Math.round(coverageData.costPerParticipant).toLocaleString()}</div>
                                </div>
                                <div className="flex flex-col items-center justify-center p-4 bg-purple-50 rounded-lg border border-purple-100 text-center w-full">
                                    <div className="text-sm font-semibold text-purple-700">Cost/New Facility introduce IMNCI</div>
                                    <div className="text-2xl font-bold text-purple-800">${Math.round(coverageData.costPerNewFacility).toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <div id="coverage-card" className="relative p-2 w-full max-w-full min-w-0">
                            {!isSharedView && <button onClick={() => handleCopyAsImage('coverage-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                            
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                <h3 className="text-xl font-bold">Coverage KPIs (PHC Facilities Only)</h3>
                                {isSuperUser && !isSharedView && (
                                    <div className="flex flex-wrap gap-2 copy-button w-full sm:w-auto">
                                        <Button size="sm" variant="secondary" onClick={handleRetrieveCoverageHistory} className="w-full sm:w-auto">Refetch Baseline</Button>
                                        <Button size="sm" variant="secondary" onClick={openEditCoverageModal} className="w-full sm:w-auto">Edit Baseline</Button>
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
                                <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg border border-green-100 text-center w-full">
                                    <div className="text-sm font-semibold text-green-700">Total new PHC facility Introduce IMNCI</div>
                                    <div className="text-2xl font-bold text-green-800">{coverageData.nationalCov.newPhc}</div>
                                </div>
                                {coverageData.localityCoverage.map(l => (
                                    <div key={`card-loc-${l.name}`} className="p-4 bg-sky-50 rounded-lg border border-sky-100">
                                        <div className="text-sm font-semibold text-sky-700">Locality Increase ({l.name})</div>
                                        <div className="text-2xl font-bold text-sky-800">{l.newPhc} <span className="text-sm text-green-600 block xl:inline">(+{l.increase.toFixed(2)}%)</span></div>
                                    </div>
                                ))}
                                {coverageData.stateCoverage.map(s => (
                                    <div key={`card-state-${s.name}`} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                        <div className="text-sm font-semibold text-indigo-700">State Increase ({s.name})</div>
                                        <div className="text-2xl font-bold text-indigo-800">{s.newPhc} <span className="text-sm text-green-600 block xl:inline">(+{s.increase.toFixed(2)}%)</span></div>
                                    </div>
                                ))}
                                <div className="flex flex-col items-center justify-center p-4 bg-purple-50 rounded-lg border border-purple-100 text-center w-full">
                                    <div className="text-sm font-semibold text-purple-700">National Increase (Sudan Overall)</div>
                                    <div className="text-2xl font-bold text-purple-800">{coverageData.nationalCov.newPhc} <span className="text-sm text-green-600 block xl:inline">(+{coverageData.nationalCov.increase.toFixed(4)}%)</span></div>
                                </div>
                            </div>

                            <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2">
                                <Table headers={['Level / Name', 'Total Functioning PHCs', 'PHCs w/ IMNCI (Before)', 'Coverage Before', 'New PHCs w/ IMNCI', 'Coverage After', 'Increase']}>
                                    {coverageData.localityCoverage.map(l => (
                                        <tr key={`loc-${l.name}`} className="hover:bg-gray-50">
                                            <td className="p-2 border font-semibold text-gray-700 min-w-[120px]">Locality: {l.name}</td>
                                            <td className="p-2 border text-center">{l.totalPhc}</td>
                                            <td className="p-2 border text-center">{l.phcWithImnciBefore}</td>
                                            <td className="p-2 border text-center font-semibold text-gray-600">{fmtPct(l.covBefore)}</td>
                                            <td className="p-2 border text-center">{l.newPhc}</td>
                                            <td className="p-2 border text-center font-bold text-sky-700">{fmtPct(l.covAfter)}</td>
                                            <td className="p-2 border text-center font-bold text-green-600 min-w-[80px]">+{l.increase.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                    {coverageData.stateCoverage.map(s => (
                                        <tr key={`state-${s.name}`} className="hover:bg-gray-50 bg-gray-50/50">
                                            <td className="p-2 border font-semibold text-gray-800 min-w-[120px]">State: {s.name}</td>
                                            <td className="p-2 border text-center">{s.totalPhc}</td>
                                            <td className="p-2 border text-center">{s.phcWithImnciBefore}</td>
                                            <td className="p-2 border text-center font-semibold text-gray-600">{fmtPct(s.covBefore)}</td>
                                            <td className="p-2 border text-center">{s.newPhc}</td>
                                            <td className="p-2 border text-center font-bold text-sky-700">{fmtPct(s.covAfter)}</td>
                                            <td className="p-2 border text-center font-bold text-green-600 min-w-[80px]">+{s.increase.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                    <tr className="hover:bg-gray-50 bg-sky-50">
                                        <td className="p-2 border font-bold text-gray-900 min-w-[150px]">National (Sudan Overall)</td>
                                        <td className="p-2 border text-center font-bold">{coverageData.nationalCov.totalPhc}</td>
                                        <td className="p-2 border text-center font-bold">{coverageData.nationalCov.phcWithImnciBefore}</td>
                                        <td className="p-2 border text-center font-bold text-gray-700">{fmtPct(coverageData.nationalCov.covBefore)}</td>
                                        <td className="p-2 border text-center font-bold">{coverageData.nationalCov.newPhc}</td>
                                        <td className="p-2 border text-center font-bold text-sky-800">{fmtPct(coverageData.nationalCov.covAfter)}</td>
                                        <td className="p-2 border text-center font-bold text-green-700 min-w-[80px]">+{coverageData.nationalCov.increase.toFixed(4)}%</td>
                                    </tr>
                                </Table>
                            </div>
                        </div>
                    </Card>
                    </>
                )}

                {course.course_type === 'IMNCI' && newImciFacilities && newImciFacilities.length > 0 && (
                    <Card>
                        <div id="new-imci-facilities-card" className="relative p-2 w-full max-w-full min-w-0">
                            {!isSharedView && <button onClick={() => handleCopyAsImage('new-imci-facilities-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                            <h3 className="text-xl font-bold mb-4">Facilities with New IMNCI Service Introduction</h3>
                            <p className="text-sm text-gray-600 mb-2">The following facilities did not provide IMCI services before this course. Adding participants from these facilities has triggered an update to mark them as IMNCI-providing sites.</p>
                            
                            <h4 className="text-lg font-semibold text-sky-800 mt-4 mb-2">PHC Facilities (Included in Coverage)</h4>
                            {newImciFacilities.filter(f => !f.isHospital).length > 0 ? (
                                <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2">
                                    <Table headers={['Facility Name', 'Locality', 'State', 'Type']}>
                                        {newImciFacilities.filter(f => !f.isHospital).map((facility, index) => (
                                            <tr key={`phc-${index}`} className="hover:bg-gray-50">
                                                <td className="p-2 border font-semibold min-w-[150px]">{facility.name}</td>
                                                <td className="p-2 border min-w-[120px]">{facility.locality}</td>
                                                <td className="p-2 border min-w-[120px]">{facility.state}</td>
                                                <td className="p-2 border text-gray-600 text-sm">PHC</td>
                                            </tr>
                                        ))}
                                    </Table>
                                </div>
                            ) : (
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-center text-sm mb-4 w-full">No new PHC facilities introduced.</div>
                            )}

                            {newImciFacilities.filter(f => f.isHospital).length > 0 && (
                                <div className="mt-6">
                                    <h4 className="text-lg font-semibold text-amber-800 mb-2">Hospitals</h4>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 mb-3 font-medium">
                                        * Note: Hospitals are listed below for reference but are NOT calculated in the PHC coverage increase metrics.
                                    </p>
                                    <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2">
                                        <Table headers={['Facility Name', 'Locality', 'State', 'Type']}>
                                            {newImciFacilities.filter(f => f.isHospital).map((facility, index) => (
                                                <tr key={`hosp-${index}`} className="hover:bg-gray-50">
                                                    <td className="p-2 border font-semibold min-w-[150px]">{facility.name}</td>
                                                    <td className="p-2 border min-w-[120px]">{facility.locality}</td>
                                                    <td className="p-2 border min-w-[120px]">{facility.state}</td>
                                                    <td className="p-2 border text-gray-600 text-sm">Hospital</td>
                                                </tr>
                                            ))}
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {(hasAnyCaseDataForCharts || hasAnyDailyCaseDataForCharts) && (
                    <div id="charts-grid" className="flex flex-col lg:flex-row gap-6 w-full max-w-full min-w-0">
                        {hasAnyCaseDataForCharts && (
                            <div className="w-full min-w-0 flex-1">
                                <Card>
                                    <div id="group-perf-chart-card" className="relative p-2 w-full max-w-full min-w-0">
                                        {!isSharedView && <button onClick={() => handleCopyAsImage('group-perf-chart-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                                        <h3 className="text-xl font-bold mb-4">Overall Performance by Group</h3>
                                        <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2">
                                            <div style={{ minWidth: '500px' }} className="min-w-[500px]">
                                                <Bar ref={overallChartRef} options={combinedChartOptions} data={combinedChartData} />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}
                        {hasAnyDailyCaseDataForCharts && (
                            <div className="w-full min-w-0 flex-1">
                                <Card>
                                    <div id="day-perf-chart-card" className="relative p-2 w-full max-w-full min-w-0">
                                        {!isSharedView && <button onClick={() => handleCopyAsImage('day-perf-chart-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                                        <h3 className="text-xl font-bold mb-4">Overall Performance by Day</h3>
                                        <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2">
                                            <div style={{ minWidth: '500px' }} className="min-w-[500px]">
                                                <Bar ref={dailyChartRef} options={dailyChartOptions} data={dailyChartData} />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                )}

                <div id="daily-tables-section" className="w-full max-w-full min-w-0 mb-4">
                    {(hasDailyCaseData || hasDailySkillData) && (
                        <h3 className="text-xl font-bold mb-4 px-2">Daily Performance Tables</h3>
                    )}
                    <div id="daily-tables-grid" className="flex flex-col lg:flex-row gap-6 w-full max-w-full min-w-0">
                        {hasDailyCaseData && (
                            <div className="w-full min-w-0 flex-1">
                                <Card>
                                    <div id="daily-case-table-card" className="relative p-2 w-full max-w-full min-w-0">
                                        {!isSharedView && <button onClick={() => handleCopyAsImage('daily-case-table-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                                        <h3 className="text-xl font-bold mb-4 pr-10">Daily Case Performance</h3>
                                        <div className="mb-4">
                                            <RawScoreLegend />
                                        </div>
                                        <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2">
                                            <Table headers={['Day', ...groupsWithData, 'Total']}>
                                                {dailyCaseTableData.length > 0 ? (
                                                    <>
                                                        {dailyCaseTableData.map((row) => (
                                                            <tr key={row.day} className="hover:bg-gray-50">
                                                                <td className="p-2 border font-bold min-w-[80px]">{row.day}</td>
                                                                {groupsWithData.map(group => (
                                                                    <td key={group} className={`p-2 border text-center min-w-[80px] ${getScoreColorClass(row[group].pct)}`}>{row[group].display}</td>
                                                                ))}
                                                                <td className={`p-2 border text-center font-bold min-w-[80px] ${getScoreColorClass(row.totalDayPct)}`}>{row.totalDisplay}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="hover:bg-gray-50 font-bold">
                                                            <td className="p-2 border">Total</td>
                                                            {groupsWithData.map(group => { 
                                                                const tCorrect = groupCaseTotals[group].totalCases.correct; 
                                                                const tTotal = groupCaseTotals[group].totalCases.total; 
                                                                const pct = tTotal > 0 ? calcPct(tCorrect, tTotal) : NaN; 
                                                                return (
                                                                    <td key={group} className={`p-2 border text-center ${getScoreColorClass(pct)}`}>
                                                                        {tTotal > 0 ? `${tTotal} (${fmtPct(pct)})` : '-'}
                                                                    </td>
                                                                ); 
                                                            })}
                                                            <td className={`p-2 border text-center font-bold ${getScoreColorClass(grandTotalCasesTotal > 0 ? calcPct(grandTotalCasesCorrect, grandTotalCasesTotal) : NaN)}`}>
                                                                {grandTotalCasesTotal > 0 ? `${grandTotalCasesTotal} (${fmtPct(calcPct(grandTotalCasesCorrect, grandTotalCasesTotal))})` : '-'}
                                                            </td>
                                                        </tr>
                                                    </>
                                                ) : (
                                                    <tr>
                                                        <td colSpan={groupsWithData.length + 2} className="p-8 text-center text-gray-500 bg-gray-50">
                                                            No daily case data available.
                                                        </td>
                                                    </tr>
                                                )}
                                            </Table>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}
                        {hasDailySkillData && (
                            <div className="w-full min-w-0 flex-1">
                                <Card>
                                    <div id="daily-skill-table-card" className="relative p-2 w-full max-w-full min-w-0">
                                        {!isSharedView && <button onClick={() => handleCopyAsImage('daily-skill-table-card')} className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy as Image"><CopyIcon /></button>}
                                        <h3 className="text-xl font-bold mb-4 pr-10">Daily Skill Performance</h3>
                                        <div className="mb-4">
                                            <RawScoreLegend />
                                        </div>
                                        <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2">
                                            <Table headers={['Day', ...groupsWithData, 'Total']}>
                                                {dailySkillTableData.length > 0 ? (
                                                    <>
                                                        {dailySkillTableData.map((row) => (
                                                            <tr key={row.day} className="hover:bg-gray-50">
                                                                <td className="p-2 border font-bold min-w-[80px]">{row.day}</td>
                                                                {groupsWithData.map(group => (
                                                                    <td key={group} className={`p-2 border text-center min-w-[80px] ${getScoreColorClass(row[group].pct)}`}>{row[group].display}</td>
                                                                ))}
                                                                <td className={`p-2 border text-center font-bold min-w-[80px] ${getScoreColorClass(row.totalDayPct)}`}>{row.totalDisplay}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="hover:bg-gray-50 font-bold">
                                                            <td className="p-2 border">Total</td>
                                                            {groupsWithData.map(group => { 
                                                                const tCorrect = groupSkillTotals[group].totalSkills.correct; 
                                                                const tTotal = groupSkillTotals[group].totalSkills.total; 
                                                                const pct = tTotal > 0 ? calcPct(tCorrect, tTotal) : NaN; 
                                                                return (
                                                                    <td key={group} className={`p-2 border text-center ${getScoreColorClass(pct)}`}>
                                                                        {tTotal > 0 ? `${tTotal} (${fmtPct(pct)})` : '-'}
                                                                    </td>
                                                                ); 
                                                            })}
                                                            <td className={`p-2 border text-center font-bold ${getScoreColorClass(grandTotalSkillsTotal > 0 ? calcPct(grandTotalSkillsCorrect, grandTotalSkillsTotal) : NaN)}`}>
                                                                {grandTotalSkillsTotal > 0 ? `${grandTotalSkillsTotal} (${fmtPct(calcPct(grandTotalSkillsCorrect, grandTotalSkillsTotal))})` : '-'}
                                                            </td>
                                                        </tr>
                                                    </>
                                                ) : (
                                                    <tr>
                                                        <td colSpan={groupsWithData.length + 2} className="p-8 text-center text-gray-500 bg-gray-50">
                                                            No daily skill performance data available.
                                                        </td>
                                                    </tr>
                                                )}
                                            </Table>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>

                {(showTestScoreColumns || showCaseColumns) && (
                    <Card>
                         <div id="participant-results-card" className="relative p-2 w-full max-w-full min-w-0">
                            
                            <h3 className="text-xl font-bold mb-4">Participant Results</h3>

                            {showCaseColumns && (
                                <div id="practical-full-section" className="relative mb-10 w-full bg-white rounded-lg p-2">
                                    {!isSharedView && <button onClick={() => handleCopyAsImage('practical-full-section')} className="copy-button absolute top-0 right-0 z-10 m-1 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy Section as Image"><CopyIcon /></button>}
                                    <div id="practical-summary-table" className="relative mb-4 w-full max-w-full min-w-0">
                                        
                                        <h4 className="text-[1.05rem] font-bold mb-2 text-sky-800 pr-8">Practical Case Performance Summary</h4>
                                        <div className="w-full max-w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm mb-2">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-center text-sm whitespace-nowrap">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-4 py-3 bg-white text-left text-sm font-semibold text-gray-800 border-b border-r border-gray-200 min-w-[160px]">Practical Score Category</th>
                                                            {practicalScoreCategories.map((cat, i) => (
                                                                <th key={cat.key} className={`px-3 py-2 font-bold border-b border-gray-200 ${cat.colorClass} ${i !== practicalScoreCategories.length - 1 ? 'border-r border-black/5' : ''} min-w-[120px]`}>
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <span className="text-sm">{cat.name}</span>
                                                                        {cat.range && cat.range !== 'N/A' && <span className="text-[11px] font-medium opacity-75 mt-0.5">{cat.range}</span>}
                                                                    </div>
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white">
                                                        <tr>
                                                            <td className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r border-gray-200 bg-gray-50/30">Participant Count</td>
                                                            {practicalScoreCategories.map((cat, i) => (
                                                                <td key={cat.key} className={`px-3 py-3 text-2xl font-black text-sky-900 ${i !== practicalScoreCategories.length - 1 ? 'border-r border-gray-200' : ''}`}>
                                                                    {caseCorrectnessDistribution[cat.key] || 0}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {!isSharedView && (
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4 w-full sm:w-auto">
                                            <label htmlFor="case-filter" className="text-sm font-semibold text-gray-700">Filter by Case Correctness:</label>
                                            <select id="case-filter" value={caseCorrectnessFilter} onChange={(e) => setCaseCorrectnessFilter(e.target.value)} className="border border-gray-300 rounded-md p-2 bg-white w-full sm:w-auto">
                                                {caseFilterOptions.map(option => (<option key={option.name} value={option.name}>{option.name}</option>))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2" id="practical-details-table">
                                        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                                            <table className="w-full text-left border-collapse bg-white">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        {practicalTableHeaders.map(h => <th key={h} className="p-3 text-sm font-semibold text-gray-700 text-center">{h}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {filteredPracticalParticipants.length === 0 ? (
                                                <tr>
                                                    <td colSpan={practicalTableHeaders.length} className="p-8 text-center text-gray-500 bg-gray-50">
                                                        No participants match the selected filter.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredPracticalParticipants.map((p, index) => (
                                                    <tr key={`prac-${p.id}`} className={`transition-colors duration-150 border-b border-gray-100 ${!isSharedView ? 'cursor-pointer hover:bg-sky-50' : ''}`} onClick={!isSharedView ? () => onViewParticipantReport(p.id) : undefined}>
                                                        <td className="p-3 text-center text-gray-600">{index + 1}</td>
                                                        <td className="p-3 font-semibold text-gray-800 min-w-[200px] whitespace-normal break-words">{p.name}</td>
                                                        <td className="p-3 text-center text-gray-700">{p.total_cases_seen}</td>
                                                        {!isSharedView && <td className="p-3 text-center"><span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getScoreColorClass(p.correctness_percentage)}`}>{getCaseCorrectnessName(p.correctness_percentage)}</span></td>}
                                                    </tr>
                                                ))
                                            )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showTestScoreColumns && (
                                <div id="written-full-section" className="relative mb-10 w-full bg-white rounded-lg p-2">
                                    {!isSharedView && <button onClick={() => handleCopyAsImage('written-full-section')} className="copy-button absolute top-0 right-0 z-10 m-1 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors" title="Copy Section as Image"><CopyIcon /></button>}
                                    <div id="written-summary-table" className="relative mb-4 w-full max-w-full min-w-0">
                                        
                                        <h4 className="text-[1.05rem] font-bold mb-2 text-indigo-800 pr-8">Written Test Improvement Summary</h4>
                                        <div className="w-full max-w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm mb-2">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-center text-sm whitespace-nowrap">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-4 py-3 bg-white text-left text-sm font-semibold text-gray-800 border-b border-r border-gray-200 min-w-[160px]">Improvement Level</th>
                                                            {correctnessCategories.map((cat, i) => (
                                                                <th key={cat.key} className={`px-3 py-2 font-bold border-b border-gray-200 ${cat.colorClass} ${i !== correctnessCategories.length - 1 ? 'border-r border-black/5' : ''} min-w-[120px]`}>
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <span className="text-sm">{cat.name}</span>
                                                                        {cat.range && cat.range !== 'N/A' && <span className="text-[11px] font-medium opacity-75 mt-0.5">{cat.range}</span>}
                                                                    </div>
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white">
                                                        <tr>
                                                            <td className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r border-gray-200 bg-gray-50/30">Participant Count</td>
                                                            {correctnessCategories.map((cat, i) => (
                                                                <td key={cat.key} className={`px-3 py-3 text-2xl font-black text-indigo-900 ${i !== correctnessCategories.length - 1 ? 'border-r border-gray-200' : ''}`}>
                                                                    {avgImprovementDistribution[cat.key] || 0}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {!isSharedView && (
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4 w-full sm:w-auto">
                                            <label htmlFor="score-filter" className="text-sm font-semibold text-gray-700">Filter by Avg. Improvement:</label>
                                            <select id="score-filter" value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)} className="border border-gray-300 rounded-md p-2 bg-white w-full sm:w-auto">
                                                {scoreFilterOptions.map(option => (<option key={option.name} value={option.name}>{option.name}</option>))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="w-full max-w-full overflow-x-auto touch-pan-x pb-2" id="written-details-table">
                                        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                                            <table className="w-full text-left border-collapse bg-white">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        {writtenTableHeaders.map(h => <th key={h} className="p-3 text-sm font-semibold text-gray-700 text-center">{h}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {filteredWrittenParticipants.length === 0 ? (
                                                <tr>
                                                    <td colSpan={writtenTableHeaders.length} className="p-8 text-center text-gray-500 bg-gray-50">
                                                        No participants match the selected filter.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredWrittenParticipants.map((p, index) => {
                                                    const preScore = Number(p.pre_test_score);
                                                    const postScore = Number(p.post_test_score);
                                                    const increase = (!isNaN(preScore) && preScore > 0 && !isNaN(postScore) && postScore > 0) ? ((postScore - preScore) / preScore) * 100 : null;
                                                    const category = getAvgImprovementCategory(p.pre_test_score, p.post_test_score);
                                                    const increaseDisplay = isNaN(increase) || increase === null ? 'N/A' : `${increase.toFixed(1)}%`;
                                                    
                                                    return (
                                                        <tr key={`writ-${p.id}`} className={`transition-colors duration-150 border-b border-gray-100 ${!isSharedView ? 'cursor-pointer hover:bg-indigo-50' : ''}`} onClick={!isSharedView ? () => onViewParticipantReport(p.id) : undefined}>
                                                            <td className="p-3 text-center text-gray-600">{index + 1}</td>
                                                            <td className="p-3 font-semibold text-gray-800 min-w-[200px] whitespace-normal break-words">{p.name}</td>
                                                            <td className="p-3 text-center text-gray-700">{fmtDecimal(preScore)}</td>
                                                            <td className="p-3 text-center text-gray-700">{fmtDecimal(postScore)}</td>
                                                            <td className="p-3 text-center font-medium text-gray-800">{increaseDisplay}</td>
                                                            <td className="p-3 text-center min-w-[120px]"><span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${category.className}`}>{category.name}</span></td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                )}
                </div>
            )}

            {activeTab === 'individual-participant-report' && (
                <div className="w-full max-w-full min-w-0 mt-4">
                    <ReportsView course={course} participants={participants} hideHeader={true} />
                </div>
            )}

            {/* Modal for Historical Coverage Preview */}
            <Modal isOpen={isCoverageModalOpen} onClose={() => setIsCoverageModalOpen(false)} title="Historical Coverage Baseline" size="lg">
                <div className="p-4 sm:p-6 space-y-4">
                    {isPreviewLoading ? (
                        <div className="flex flex-col items-center justify-center p-8">
                            <Spinner size="lg" />
                            <p className="mt-4 text-sky-700 font-semibold text-center">Calculating historical baseline coverage from facility snapshots...</p>
                        </div>
                    ) : historicalCoveragePreview ? (
                        <div>
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-4 text-sm">
                                <strong>Retrieved At:</strong> {new Date(historicalCoveragePreview.retrievedAt).toLocaleString()}
                                <br /><br />
                                Please review the fully calculated baseline coverage below. Confirming will permanently save this snapshot to the course.
                            </div>
                            
                            <div className="overflow-x-auto max-h-[50vh] border rounded-lg shadow-sm">
                                <Table headers={['Level / Name', 'Total Functioning PHCs', 'PHCs w/ IMNCI (Before)', 'Coverage Before', 'New PHCs w/ IMNCI', 'Coverage After', 'Increase']}>
                                    {historicalCoveragePreview.localityCoverage.map(l => (
                                        <tr key={`prev-loc-${l.name}`} className="hover:bg-gray-50">
                                            <td className="p-2 border font-semibold text-gray-700 min-w-[120px]">Locality: {l.name}</td>
                                            <td className="p-2 border text-center">{l.totalPhc}</td>
                                            <td className="p-2 border text-center">{l.phcWithImnciBefore}</td>
                                            <td className="p-2 border text-center font-semibold text-gray-600">{fmtPct(l.covBefore)}</td>
                                            <td className="p-2 border text-center">{l.newPhc}</td>
                                            <td className="p-2 border text-center font-bold text-sky-700">{fmtPct(l.covAfter)}</td>
                                            <td className="p-2 border text-center font-bold text-green-600 min-w-[80px]">+{l.increase.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                    {historicalCoveragePreview.stateCoverage.map(s => (
                                        <tr key={`prev-state-${s.name}`} className="hover:bg-gray-50 bg-gray-50/50">
                                            <td className="p-2 border font-semibold text-gray-800 min-w-[120px]">State: {s.name}</td>
                                            <td className="p-2 border text-center">{s.totalPhc}</td>
                                            <td className="p-2 border text-center">{s.phcWithImnciBefore}</td>
                                            <td className="p-2 border text-center font-semibold text-gray-600">{fmtPct(s.covBefore)}</td>
                                            <td className="p-2 border text-center">{s.newPhc}</td>
                                            <td className="p-2 border text-center font-bold text-sky-700">{fmtPct(s.covAfter)}</td>
                                            <td className="p-2 border text-center font-bold text-green-600 min-w-[80px]">+{s.increase.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                    <tr className="hover:bg-gray-50 bg-sky-50">
                                        <td className="p-2 border font-bold text-gray-900 min-w-[150px]">National (Sudan Overall)</td>
                                        <td className="p-2 border text-center font-bold">{historicalCoveragePreview.nationalCov.totalPhc}</td>
                                        <td className="p-2 border text-center font-bold">{historicalCoveragePreview.nationalCov.phcWithImnciBefore}</td>
                                        <td className="p-2 border text-center font-bold text-gray-700">{fmtPct(historicalCoveragePreview.nationalCov.covBefore)}</td>
                                        <td className="p-2 border text-center font-bold">{historicalCoveragePreview.nationalCov.newPhc}</td>
                                        <td className="p-2 border text-center font-bold text-sky-800">{fmtPct(historicalCoveragePreview.nationalCov.covAfter)}</td>
                                        <td className="p-2 border text-center font-bold text-green-700 min-w-[80px]">+{historicalCoveragePreview.nationalCov.increase.toFixed(4)}%</td>
                                    </tr>
                                </Table>
                            </div>
                            
                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t w-full">
                                <Button variant="secondary" onClick={() => setIsCoverageModalOpen(false)} disabled={isSavingCoverage} className="w-full sm:w-auto">Cancel</Button>
                                <Button onClick={handleConfirmCoverage} disabled={isSavingCoverage} className="w-full sm:w-auto">
                                    {isSavingCoverage ? <Spinner size="sm" /> : "Confirm & Save"}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-4 text-red-500">Failed to load preview.</div>
                    )}
                </div>
            </Modal>

            
            {/* Modal for Editing Coverage */}
            <Modal isOpen={isEditCoverageModalOpen} onClose={() => setIsEditCoverageModalOpen(false)} title="Edit Baseline Coverage" size="lg">
                <div className="p-3 sm:p-4 max-h-[70vh] overflow-y-auto space-y-4 sm:space-y-6">
                    {editableCoverageData && (
                        <>
                            <div className="bg-white p-4 rounded shadow-sm border">
                                <h4 className="font-bold text-lg border-b pb-2 mb-4 text-purple-800">National (Sudan Overall)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormGroup label="Total Functioning PHCs"><Input type="number" value={editableCoverageData.nationalCov.totalPhc} onChange={(e) => handleCoverageEditChange('national', null, 'totalPhc', e.target.value)} /></FormGroup>
                                    <FormGroup label="PHCs w/ IMNCI (Before)"><Input type="number" value={editableCoverageData.nationalCov.phcWithImnciBefore} onChange={(e) => handleCoverageEditChange('national', null, 'phcWithImnciBefore', e.target.value)} /></FormGroup>
                                    <FormGroup label="New PHCs w/ IMNCI"><Input type="number" value={editableCoverageData.nationalCov.newPhc} onChange={(e) => handleCoverageEditChange('national', null, 'newPhc', e.target.value)} /></FormGroup>
                                </div>
                            </div>
                            
                            {editableCoverageData.stateCoverage.map((s, idx) => (
                                <div key={s.name} className="bg-white p-4 rounded shadow-sm border">
                                    <h4 className="font-bold text-lg border-b pb-2 mb-4 text-indigo-800">State: {s.name}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormGroup label="Total Functioning PHCs"><Input type="number" value={s.totalPhc} onChange={(e) => handleCoverageEditChange('state', idx, 'totalPhc', e.target.value)} /></FormGroup>
                                        <FormGroup label="PHCs w/ IMNCI (Before)"><Input type="number" value={s.phcWithImnciBefore} onChange={(e) => handleCoverageEditChange('state', idx, 'phcWithImnciBefore', e.target.value)} /></FormGroup>
                                        <FormGroup label="New PHCs w/ IMNCI"><Input type="number" value={s.newPhc} onChange={(e) => handleCoverageEditChange('state', idx, 'newPhc', e.target.value)} /></FormGroup>
                                    </div>
                                </div>
                            ))}

                            {editableCoverageData.localityCoverage.map((l, idx) => (
                                <div key={l.name} className="bg-white p-4 rounded shadow-sm border">
                                    <h4 className="font-bold text-lg border-b pb-2 mb-4 text-sky-800">Locality: {l.name}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormGroup label="Total Functioning PHCs"><Input type="number" value={l.totalPhc} onChange={(e) => handleCoverageEditChange('locality', idx, 'totalPhc', e.target.value)} /></FormGroup>
                                        <FormGroup label="PHCs w/ IMNCI (Before)"><Input type="number" value={l.phcWithImnciBefore} onChange={(e) => handleCoverageEditChange('locality', idx, 'phcWithImnciBefore', e.target.value)} /></FormGroup>
                                        <FormGroup label="New PHCs w/ IMNCI"><Input type="number" value={l.newPhc} onChange={(e) => handleCoverageEditChange('locality', idx, 'newPhc', e.target.value)} /></FormGroup>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
                <div className="p-3 sm:p-4 border-t flex flex-col-reverse sm:flex-row justify-end gap-2 bg-gray-50 w-full">
                    <Button variant="secondary" onClick={() => setIsEditCoverageModalOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button onClick={handleSaveEditedCoverage} disabled={isSavingCoverage} className="w-full sm:w-auto">{isSavingCoverage ? <Spinner size="sm" /> : 'Save Changes'}</Button>
                </div>
            </Modal>

            {/* Embedded ShareModal controlled by local state */}
            {!isSharedView && (
                <ShareModal 
                    isOpen={isShareModalOpen} 
                    onClose={() => setIsShareModalOpen(false)} 
                    shareableItem={course} 
                    shareType="course" 
                    onSave={onShare} 
                />
            )}
        </div>
    );
}