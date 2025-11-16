// CourseReportView.jsx
import React, { useMemo, useRef, useState } from 'react';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Bar, Line } from 'react-chartjs-2';
import { Button, Card, EmptyState, PageHeader, PdfIcon, Table, Spinner } from './CommonComponents';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
    PointElement, LineElement
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { amiriFontBase64 } from './AmiriFont.js'; // <-- Import Arabic font

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ChartDataLabels);
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

// --- Icon Components (CopyIcon, ShareIcon) ---
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


// --- Helper functions (calcPct, fmtPct, fmtDecimal, getScoreColorClass, etc.) ---
const calcPct = (correct, total) => {
    if (total === 0) {
        return 0;
    }
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

// This helper is for JSX classNames
const getScoreColorClass = (value, type = 'percentage') => {
    if (isNaN(value) || value === null) {
        return 'bg-gray-700 text-white';
    }
    if (type === 'improvement') {
        if (value > 50) return 'bg-green-200 text-green-800';
        if (value >= 25) return 'bg-yellow-200 text-yellow-800';
        if (value >= 0) return 'bg-gray-200 text-gray-800';
        return 'bg-red-200 text-red-800';
    }
    if (value === 100) return 'bg-green-200 text-green-800';
    if (value >= 95) return 'bg-yellow-200 text-yellow-800';
    if (value >= 90) return 'bg-orange-200 text-orange-800';
    return 'bg-red-200 text-red-800'; // Default for < 90%
};


const getCaseCountColorClass = (value) => {
    return '';
}

// This helper is for JSX classNames
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
    if (increase > 50) {
        return { name: 'Perfect', className: 'bg-green-200 text-green-800' };
    }
    if (increase >= 30) {
        return { name: 'Excellent', className: 'bg-yellow-200 text-yellow-800' };
    }
    if (increase >= 15) {
        return { name: 'Good', className: 'bg-gray-200 text-gray-800' };
    }
    if (increase < 0) {
        return { name: 'Fail', className: 'bg-red-200 text-red-800' };
    }
    return { name: 'Fair', className: 'bg-orange-200 text-orange-800' };
};

const getCaseCorrectnessName = (pct) => {
    if (isNaN(pct) || pct === null) return 'Data Incomplete';
    if (pct === 100) return 'Perfect';
    if (pct >= 95) return 'Excellent';
    if (pct >= 90) return 'Good';
    return 'Fail';
};

// --- NEW: PDF Color Helpers ---
// These return RGB arrays for jsPDF
const getPdfScoreStyles = (value) => {
    const styles = { fillColor: [255, 255, 255], textColor: [0, 0, 0] }; // Default
    if (isNaN(value) || value === null) {
        styles.fillColor = [55, 65, 81]; // gray-700
        styles.textColor = [255, 255, 255]; // white
        return styles;
    }
    if (value === 100) {
        styles.fillColor = [187, 247, 208]; // green-200
        styles.textColor = [22, 101, 52];   // green-800
    } else if (value >= 95) {
        styles.fillColor = [254, 240, 138]; // yellow-200
        styles.textColor = [133, 77, 14];  // yellow-800
    } else if (value >= 90) {
        styles.fillColor = [254, 215, 170]; // orange-200
        styles.textColor = [154, 52, 18];  // orange-800
    } else {
        styles.fillColor = [254, 202, 202]; // red-200
        styles.textColor = [153, 27, 27];  // red-800
    }
    return styles;
};

const getPdfImprovementStyles = (preScore, postScore) => {
    const styles = { fillColor: [255, 255, 255], textColor: [0, 0, 0] };
    const pre = Number(preScore);
    const post = Number(postScore);

    if (isNaN(pre) || isNaN(post) || pre === 0 || post === 0) {
        styles.fillColor = [55, 65, 81]; // gray-700
        styles.textColor = [255, 255, 255]; // white
        return styles;
    }
    const increase = ((post - pre) / pre) * 100;
    if (isNaN(increase) || increase === null) {
        styles.fillColor = [55, 65, 81];
        styles.textColor = [255, 255, 255];
        return styles;
    }

    if (increase > 50) {
        styles.fillColor = [187, 247, 208]; // green-200
        styles.textColor = [22, 101, 52];   // green-800
    } else if (increase >= 30) {
        styles.fillColor = [254, 240, 138]; // yellow-200
        styles.textColor = [133, 77, 14];  // yellow-800
    } else if (increase >= 15) {
        styles.fillColor = [229, 231, 235]; // gray-200
        styles.textColor = [31, 41, 55];   // gray-800
    } else if (increase < 0) {
        styles.fillColor = [254, 202, 202]; // red-200
        styles.textColor = [153, 27, 27];  // red-800
    } else { // 0 <= increase < 15
        styles.fillColor = [254, 215, 170]; // orange-200
        styles.textColor = [154, 52, 18];  // orange-800
    }
    return styles;
};
// --- END NEW PDF Color Helpers ---


// --- *** REVISED PDF EXPORT HELPER (HYBRID APPROACH) *** ---
const generateFullCourseReportPdf = async (
    course, 
    quality, 
    onSuccess, 
    onError,
    // Pass all necessary data for tables
    tableData
) => {
    const {
        filteredParticipants, tableHeaders, showCaseColumns, showTestScoreColumns, isSharedView
    } = tableData;

    // --- *** FIX: Removed fileSuffix *** ---
    const qualityProfiles = {
        print: { scale: 2, fileSuffix: '', imageType: 'image/jpeg', imageQuality: 0.95, imageFormat: 'JPEG', compression: 'MEDIUM' },
        screen: { scale: 1.5, fileSuffix: '', imageType: 'image/png', imageQuality: 1.0, imageFormat: 'PNG', compression: 'FAST' }
    };
    // --- *** END FIX *** ---

    const profile = qualityProfiles[quality] || qualityProfiles.print;

    const doc = new jsPDF('portrait', 'mm', 'a4');
    // File name no longer has the suffix from profile
    const fileName = `Course_Report_${course.course_type}_${course.state}.pdf`;
    
    // --- Add Arabic Font Support ---
    doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri'); // Set default font for titles

    // --- PDF Layout Variables ---
    let y = 15; // Current Y position
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);

    // --- Helper to check for page break ---
    const checkPageBreak = (currentY, elementHeight) => {
        if (currentY + elementHeight + margin > pageHeight) {
            doc.addPage();
            doc.setFont('Amiri'); // Re-set font on new page
            return margin; // Reset y to top margin
        }
        return currentY;
    };

    // --- Helper to add an element as a canvas image ---
    const addCanvasImageToPdf = async (elementId, currentY) => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`PDF: Element ${elementId} not found.`);
            return currentY;
        }

        try {
            const canvas = await html2canvas(element, {
                scale: profile.scale,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL(profile.imageType, profile.imageQuality);
            const imgWidth = contentWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            currentY = checkPageBreak(currentY, imgHeight);
            
            doc.addImage(imgData, profile.imageFormat, margin, currentY, imgWidth, imgHeight, undefined, profile.compression);
            return currentY + imgHeight + 5; // Return new Y position
        } catch (e) {
            console.error(`Failed to add canvas for ${elementId}:`, e);
            onError(`Failed to render element ${elementId} for PDF.`);
            throw e; // Stop PDF generation if a critical element fails
        }
    };

    // --- Helper to add a title ---
    const addTitle = (text, currentY) => {
        currentY = checkPageBreak(currentY, 10);
        doc.setFontSize(16);
        doc.setFont('Amiri', 'normal');
        doc.text(text, margin, currentY, { align: 'left' });
        return currentY + 10;
    };

    // --- Common AutoTable Styles (FOR PARTICIPANT LIST ONLY) ---
    const autoTableStyles = {
        theme: 'grid',
        styles: {
            font: 'Amiri',
            fontSize: 7, // Smaller font
            cellPadding: 1.5, // Tighter padding
            overflow: 'linebreak' // Default overflow
        },
        headStyles: {
            font: 'Amiri',
            fillColor: [41, 128, 185],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8, // Keep header readable
        },
    };

    // --- START PDF GENERATION ---
    try {
        // 1. Title
        doc.setFontSize(20);
        doc.setFont('Amiri', 'normal');
        doc.text(`Full Course Report: ${course.course_type} - ${course.state}`, margin, y, { align: 'left' });
        y += 10;

        // 2. Course Info Card (Canvas)
        y = await addCanvasImageToPdf('course-info-card', y);
        
        // 3. KPI Card (Canvas)
        if (document.getElementById('kpi-card')) {
             y = await addCanvasImageToPdf('kpi-card', y);
        }
       
        // 4. IMNCI Cards (Canvas)
        if (document.getElementById('new-imci-facilities-card')) {
            y = await addCanvasImageToPdf('new-imci-facilities-card', y);
        }
        if (document.getElementById('coverage-card')) {
            y = await addCanvasImageToPdf('coverage-card', y);
        }

        // 5. Test Scores Card (KPIs + Chart) (Canvas)
        if (document.getElementById('test-scores-card')) {
            y = await addCanvasImageToPdf('test-scores-card', y);
        }

        // 6. Group & Day Charts (Canvas)
        if (document.getElementById('charts-grid')) {
             y = addTitle('Performance Charts', y);
             y = await addCanvasImageToPdf('charts-grid', y);
        }

        // 7. Daily Tables (Canvas)
        if (document.getElementById('daily-tables-section')) {
            y = await addCanvasImageToPdf('daily-tables-section', y);
        }
        
        // 8. Participant Summary Table (Canvas)
        if (document.getElementById('participant-summary-table')) {
            y = addTitle('Participant Score Summary', y);
            y = await addCanvasImageToPdf('participant-summary-table', y);
        }


        // 9. Participant Results List Table (AutoTable)
        if (filteredParticipants.length > 0) {
            y = addTitle('Participant Results', y);
            
            const head = [tableHeaders];
            const body = filteredParticipants.map((p, index) => {
                const row = [index + 1, p.name];
                
                if (showCaseColumns) {
                    row.push(p.total_cases_seen);
                    if (!isSharedView) {
                        row.push(getCaseCorrectnessName(p.correctness_percentage));
                    }
                }
                if (showTestScoreColumns) {
                    const preScore = Number(p.pre_test_score);
                    const postScore = Number(p.post_test_score);
                    const increase = (!isNaN(preScore) && preScore > 0 && !isNaN(postScore) && postScore > 0) ? ((postScore - preScore) / preScore) * 100 : null;
                    const category = getAvgImprovementCategory(p.pre_test_score, p.post_test_score);
                    
                    row.push(fmtDecimal(preScore));
                    row.push(fmtDecimal(postScore));
                    row.push(isNaN(increase) || increase === null ? 'N/A' : `${increase.toFixed(1)}%`);
                    row.push(category.name);
                }
                return row;
            });

            doc.setFont('Amiri');
            autoTable(doc, {
                ...autoTableStyles,
                head: head,
                body: body,
                startY: y,
                didDrawPage: (data) => { 
                    y = data.cursor.y; 
                    doc.setFont('Amiri'); // Re-set font on new page
                },
                didParseCell: (data) => {
                    data.cell.styles.font = 'Amiri';
                    const colKey = head[0][data.column.index];

                    // --- 1. Column Width & Overflow (Applied to Head & Body) ---
                    if (colKey === 'Participant Name') {
                        data.cell.styles.overflow = 'ellipsis';
                        data.cell.styles.cellWidth = 'auto'; // Let this take remaining space
                    } else {
                        data.cell.styles.overflow = 'linebreak';
                        if (colKey === '#') {
                            data.cell.styles.cellWidth = 8;
                        } else if (colKey === 'Total Cases') {
                            data.cell.styles.cellWidth = 16;
                        } else if (colKey === 'Practical Case Score') {
                            data.cell.styles.cellWidth = 22;
                        } else if (colKey === 'Pre-Test Result') {
                            data.cell.styles.cellWidth = 16;
                        } else if (colKey === 'Post-Test Result') {
                            data.cell.styles.cellWidth = 16;
                        } else if (colKey === '% Increase') {
                            data.cell.styles.cellWidth = 16;
                        } else if (colKey === 'average improvemt score') {
                            data.cell.styles.cellWidth = 22;
                        }
                    }

                    // --- 2. Head Styling ---
                    if (data.section === 'head') {
                        data.cell.styles.halign = 'center';
                        data.cell.styles.fontStyle = 'bold';
                        return;
                    }

                    // --- 3. Body Styling (Alignment & Color) ---
                    if (data.section === 'body') {
                        const participant = filteredParticipants[data.row.index];
                        if (!participant) return;
                        
                        // Color
                        let styles = null;
                        if (colKey === 'Practical Case Score') {
                            styles = getPdfScoreStyles(participant.correctness_percentage);
                        } 
                        else if (colKey === 'average improvemt score') {
                            styles = getPdfImprovementStyles(participant.pre_test_score, participant.post_test_score);
                        }
                        if (styles) {
                            data.cell.styles.fillColor = styles.fillColor;
                            data.cell.styles.textColor = styles.textColor;
                        }

                        // Alignment
                        if (colKey === 'Participant Name') {
                            data.cell.styles.halign = 'right'; // Arabic name
                        } else {
                            data.cell.styles.halign = 'center'; // All other data
                        }
                    }
                }
            });
            y = doc.lastAutoTable.finalY + 10;
        }

        // --- ADD PAGE NUMBERS ---
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont('Amiri');
        doc.setFontSize(10);
        doc.setTextColor(150); // Gray color

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i); // Go to page i
            
            const text = `Page ${i} of ${pageCount}`;
            const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
            const x = (pageWidth - textWidth) / 2; // Center horizontally
            const y_footer = pageHeight - 10; // 10mm from bottom
            
            doc.text(text, x, y_footer);
        }


        // --- FINAL SAVE LOGIC (from original) ---
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
        // --- END SAVE LOGIC ---

    } catch (e) {
        console.error("Error generating or saving PDF:", e);
        onError(`Failed to save PDF: ${e.message || 'Unknown error'}`);
    }
};

// --- NEW HELPER FOR STATS AND DISTRIBUTION ---
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


export function CourseReportView({ 
    course, onBack, participants, allObs, allCases, finalReportData, onEditFinalReport, 
    onDeletePdf, onViewParticipantReport, isSharedView = false, onShare, setToast, allHealthFacilities
}) {
    const overallChartRef = useRef(null);
    const dailyChartRef = useRef(null);
    const prePostDistributionChartRef = useRef(null);
    const [scoreFilter, setScoreFilter] = useState('All');
    const [caseCorrectnessFilter, setCaseCorrectnessFilter] = useState('All');
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    
    const notify = (message, type = 'info') => {
        if (setToast) {
            setToast({ show: true, message, type });
        } else {
            alert(message);
        }
    };

    const isLoading = !course || !participants || !allObs || !allCases;

    // --- DATA CALCULATION (useMemo) ---
    const { 
        groupPerformance, overall, dailyPerformance, hasTestScores, hasCases, participantsWithStats, 
        preTestStats, postTestStats, totalImprovement, caseCorrectnessDistribution, 
        newImciFacilities, coverageData, avgImprovementDistribution
    } = useMemo(() => {
        if (isLoading) { 
            return {
                groupPerformance: {},
                overall: { 
                    totalCases: 0, correctCases: 0, avgCasesPerParticipant: 0, caseCorrectnessPercentage: 0,
                    totalSkills: 0, correctSkills: 0, avgSkillsPerParticipant: 0, skillCorrectnessPercentage: 0
                },
                dailyPerformance: {},
                preTestStats: { avg: 0, median: 0, min: 0, max: 0, range: 'N/A', distribution: {} },
                postTestStats: { avg: 0, median: 0, min: 0, max: 0, range: 'N/A', distribution: {} },
                totalImprovement: 0,
                hasTestScores: false,
                hasCases: false,
                participantsWithStats: [],
                caseCorrectnessDistribution: {},
                avgImprovementDistribution: {},
                newImciFacilities: [],
                coverageData: null,
            };
        }

        // Filter scores to exclude null and zero for average calculations
        const preScoresForAvg = participants
            .map(p => Number(p.pre_test_score))
            .filter(score => !isNaN(score) && score > 0);
        
        const postScoresForAvg = participants
            .map(p => Number(p.post_test_score))
            .filter(score => !isNaN(score) && score > 0);

        const preTestStats = getStatsAndDistribution(preScoresForAvg);
        const postTestStats = getStatsAndDistribution(postScoresForAvg);
        
        const totalImprovement = preTestStats.avg > 0 ? ((postTestStats.avg - preTestStats.avg) / preTestStats.avg) * 100 : 0;
        
        const chartParticipants = participants.filter(p => Number(p.pre_test_score) > 0 && Number(p.post_test_score) > 0);
        
        let hasAnyScores = preScoresForAvg.length > 0 || postScoresForAvg.length > 0;

        const groupPerformance = {};
        const allGroups = new Set();
        participants.forEach(p => {
            if (p.group) {
                if (!groupPerformance[p.group]) {
                    groupPerformance[p.group] = { pids: [], totalObs: 0, correctObs: 0, totalCases: 0, correctCases: 0, totalSkills: 0, correctSkills: 0 };
                }
                groupPerformance[p.group].pids.push(p.id);
                allGroups.add(p.group);
            }
        });

        const dailyPerformance = {};

        allObs.forEach(o => {
            const p = participants.find(p => p.id === o.participant_id);
            if (p && groupPerformance[p.group]) {
                if (o.day_of_course) {
                    const day = `Day ${o.day_of_course}`;
                    if (!dailyPerformance[day]) {
                        dailyPerformance[day] = {};
                        allGroups.forEach(g => {
                            dailyPerformance[day][g] = { correct: 0, total: 0, cases: 0, correctCases: 0 };
                        });
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
            const p = participants.find(p => p.id === c.participant_id);
            if (p && groupPerformance[p.group]) {
                groupPerformance[p.group].totalCases++;
                if (c.is_correct) { 
                    groupPerformance[p.group].correctCases++;
                }
                hasCases = true;
                if (c.day_of_course) {
                    const day = `Day ${c.day_of_course}`;
                    if (dailyPerformance[day] && dailyPerformance[day][p.group]) {
                        dailyPerformance[day][p.group].cases++;
                        if (c.is_correct) {
                             dailyPerformance[day][p.group].correctCases++;
                        }
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
            totalObs += group.totalObs;
            correctObs += group.correctObs;
            totalCases += group.totalCases;
            correctCases += group.correctCases;
        });
        
        const participantsWithStats = participants.map(p => {
            const participantCases = allCases.filter(c => c.participant_id === p.id);
            const participantObs = allObs.filter(o => o.participant_id === p.id);
            const correctSkills = participantObs.filter(o => o.item_correct > 0).length;
            const totalSkills = participantObs.length;
            
            return {
                ...p,
                total_cases_seen: participantCases.length,
                total_skills_recorded: totalSkills,
                correctness_percentage: calcPct(correctSkills, totalSkills)
            };
        });
        
        const overall = {
            totalCases,
            correctCases,
            avgCasesPerParticipant: (totalCases / participants.length) || 0,
            caseCorrectnessPercentage: calcPct(correctCases, totalCases),
            totalSkills: totalObs,
            correctSkills: correctObs,
            avgSkillsPerParticipant: (totalObs / participants.length) || 0,
            skillCorrectnessPercentage: calcPct(correctObs, totalObs)
        };

        const caseCorrectnessDistribution = {
            'Perfect': 0, 'Excellent': 0, 'Good': 0, 'Fair': 0, 'Fail': 0, 'Data Incomplete': 0
        };
        participantsWithStats.forEach(p => {
            const categoryName = getCaseCorrectnessName(p.correctness_percentage);
            if (caseCorrectnessDistribution.hasOwnProperty(categoryName)) {
                caseCorrectnessDistribution[categoryName]++;
            }
        });

        const avgImprovementDistribution = {
            'Perfect': 0, 'Excellent': 0, 'Good': 0, 'Fair': 0, 'Fail': 0, 'Data Incomplete': 0
        };
        participantsWithStats.forEach(p => {
            const category = getAvgImprovementCategory(p.pre_test_score, p.post_test_score);
            if (avgImprovementDistribution.hasOwnProperty(category.name)) {
                avgImprovementDistribution[category.name]++;
            }
        });

        const newImciFacilityMap = new Map();
        participantsWithStats
            .filter(p => p.introduced_imci_to_facility === true)
            .forEach(p => {
                const key = `${p.center_name}|${p.locality}|${p.state}`;
                if (!newImciFacilityMap.has(key)) {
                    newImciFacilityMap.set(key, { name: p.center_name, locality: p.locality, state: p.state });
                }
            });
        const newImciFacilities = Array.from(newImciFacilityMap.values());
        const newImciFacilityNames = new Set(newImciFacilities.map(f => f.name));

        let coverageData = null;
        if (allHealthFacilities && course.locality && course.state) {
            const facilitiesInLocality = allHealthFacilities.filter(f => 
                f['المحلية'] === course.locality && f['الولاية'] === course.state
            );
            const totalFacilitiesInLocality = facilitiesInLocality.length;

            if (totalFacilitiesInLocality > 0) {
                const currentImciFacilities = facilitiesInLocality.filter(f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes');
                const totalImciCount = currentImciFacilities.length;
                const newImciCount = currentImciFacilities.filter(f => newImciFacilityNames.has(f['اسم_المؤسسة'])).length;
                const originalImciCount = totalImciCount - newImciCount;

                coverageData = {
                    locality: course.locality,
                    totalFacilities: totalFacilitiesInLocality,
                    originalImciCount: originalImciCount,
                    newImciCount: newImciCount,
                    totalImciCount: totalImciCount,
                    originalCoverage: calcPct(originalImciCount, totalFacilitiesInLocality),
                    newCoverage: calcPct(totalImciCount, totalFacilitiesInLocality),
                };
            }
        }

        return {
            groupPerformance,
            overall,
            dailyPerformance,
            preTestStats,
            postTestStats,
            totalImprovement,
            hasTestScores: hasAnyScores,
            hasCases,
            participantsWithStats,
            caseCorrectnessDistribution,
            avgImprovementDistribution,
            newImciFacilities,
            coverageData,
        };
    }, [participants, allObs, allCases, isLoading, allHealthFacilities, course.locality, course.state]);


    // --- DYNAMIC DATA/PROPS FOR TABLES (Needed for PDF) ---
    const groupsWithData = Object.keys(groupPerformance).sort();

    // Daily Chart Labels (used by tables)
    const dailyChartLabels = Object.keys(dailyPerformance).sort((a, b) => {
        const dayA = parseInt(a.replace('Day ', ''));
        const dayB = parseInt(b.replace('Day ', ''));
        return dayA - dayB;
    });

    // Daily Skill Table Data
    const dailySkillTableData = dailyChartLabels.map(day => {
        const row = { day, totalSkills: { correct: 0, total: 0 } };
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[day] && dailyPerformance[day][group] ? dailyPerformance[day][group] : { correct: 0, total: 0, cases: 0 };
            const pct = calcPct(dayData.correct, dayData.total);
            row[group] = { pct, display: `${dayData.total} (${fmtPct(pct)})` };
            row.totalSkills.correct += dayData.correct;
            row.totalSkills.total += dayData.total;
        });
        const totalDayPct = calcPct(row.totalSkills.correct, row.totalSkills.total);
        row.totalDisplay = `${row.totalSkills.total} (${fmtPct(totalDayPct)})`;
        row.totalDayPct = totalDayPct;
        return row;
    });

    const groupSkillTotals = {};
    groupsWithData.forEach(group => {
        groupSkillTotals[group] = { totalSkills: { correct: 0, total: 0 } };
    });
    let grandTotalSkillsCorrect = 0;
    let grandTotalSkillsTotal = 0;
    dailySkillTableData.forEach(row => {
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[row.day] && dailyPerformance[row.day][group] ? dailyPerformance[row.day][group] : { correct: 0, total: 0 };
            groupSkillTotals[group].totalSkills.correct += dayData.correct;
            groupSkillTotals[group].totalSkills.total += dayData.total;
        });
        grandTotalSkillsCorrect += row.totalSkills.correct;
        grandTotalSkillsTotal += row.totalSkills.total;
    });


    // Daily Case Table Data
    const dailyCaseTableData = dailyChartLabels.map(day => {
        const row = { day, totalCases: { correct: 0, total: 0 } };
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[day] && dailyPerformance[day][group] ? dailyPerformance[day][group] : { cases: 0, correctCases: 0 };
            const pct = calcPct(dayData.correctCases, dayData.cases);
            row[group] = { pct, display: `${dayData.cases} (${fmtPct(pct)})` };
            row.totalCases.correct += dayData.correctCases;
            row.totalCases.total += dayData.cases;
        });
        const totalDayPct = calcPct(row.totalCases.correct, row.totalCases.total);
        row.totalDisplay = `${row.totalCases.total} (${fmtPct(totalDayPct)})`;
        row.totalDayPct = totalDayPct;
        return row;
    });

    const groupCaseTotals = {};
    groupsWithData.forEach(group => {
        groupCaseTotals[group] = { totalCases: { correct: 0, total: 0 } };
    });
    let grandTotalCasesCorrect = 0;
    let grandTotalCasesTotal = 0;
    dailyCaseTableData.forEach(row => {
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[row.day] && dailyPerformance[row.day][group] ? dailyPerformance[row.day][group] : { cases: 0, correctCases: 0 };
            groupCaseTotals[group].totalCases.correct += dayData.correctCases;
            groupCaseTotals[group].totalCases.total += dayData.cases;
        });
        grandTotalCasesCorrect += row.totalCases.correct;
        grandTotalCasesTotal += row.totalCases.total;
    });


    // Participant Filtering
    const filteredParticipants = useMemo(() => {
        let participants = [...participantsWithStats];
        if (scoreFilter !== 'All') {
             participants = participants.filter(p => {
                const category = getAvgImprovementCategory(p.pre_test_score, p.post_test_score).name;
                return category === scoreFilter;
            });
        }
        if (caseCorrectnessFilter !== 'All') {
            participants = participants.filter(p => {
                const pct = p.correctness_percentage;
                const categoryName = getCaseCorrectnessName(pct);
                return categoryName === caseCorrectnessFilter;
            });
        }
        participants.sort((a, b) => {
            const pctA = a.correctness_percentage ?? -1;
            const pctB = b.correctness_percentage ?? -1;
            return pctB - pctA;
        });
        return participants;
    }, [participantsWithStats, scoreFilter, caseCorrectnessFilter]);


    // Dynamic Participant Table Headers
    const showTestScoreColumns = hasTestScores;
    const showCaseColumns = hasCases;
    const tableHeaders = ['#', 'Participant Name'];
    if (showCaseColumns) {
        tableHeaders.push('Total Cases');
        if (!isSharedView) {
            tableHeaders.push('Practical Case Score');
        }
    }
    if (showTestScoreColumns) {
        tableHeaders.push('Pre-Test Result');
        tableHeaders.push('Post-Test Result');
        tableHeaders.push('% Increase');
        tableHeaders.push('average improvemt score');
    }
    // --- END DYNAMIC DATA FOR TABLES ---


    // --- UPDATED: PDF Handler ---
    const handlePdfGeneration = async (quality) => {
        setIsPdfGenerating(true);
        await new Promise(resolve => setTimeout(resolve, 100)); // UI update delay
        
        // --- Bundle all dynamic data for the PDF function ---
        const pdfTableData = {
            filteredParticipants,
            tableHeaders,
            showCaseColumns,
            showTestScoreColumns,
            isSharedView,
            // Pass the data for the tables that are now canvas
            dailyCaseTableData,
            dailySkillTableData,
            groupsWithData,
            groupCaseTotals,
            grandTotalCasesCorrect,
            grandTotalCasesTotal,
            groupSkillTotals,
            grandTotalSkillsCorrect,
            grandTotalSkillsTotal
        };

        try {
            await generateFullCourseReportPdf(
                course, 
                quality,
                (message) => notify(message, 'success'),
                (message) => notify(message, 'error'),
                pdfTableData // <-- Pass all the table data
            );
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            notify("Sorry, there was an error generating the PDF.", 'error');
        } finally {
            setIsPdfGenerating(false);
        }
    };

    // --- (handleCopyAsImage function remains unchanged) ---
    const handleCopyAsImage = async (elementId) => {
        const element = document.getElementById(elementId);
        if (!element) {
            alert('Could not find element to copy.');
            return;
        }
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                onclone: (document) => {
                    const button = document.querySelector(`#${elementId} .copy-button`);
                    if (button) button.style.visibility = 'hidden';
                }
            });
            canvas.toBlob(async (blob) => {
                if (navigator.clipboard && navigator.clipboard.write) {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    alert('Card copied to clipboard as an image!');
                } else {
                    alert('Clipboard API not available in this browser.');
                }
            }, 'image/png');
        } catch (error) {
            console.error('Failed to copy image:', error);
            alert('Failed to copy image to clipboard.');
        }
    };

    // --- (Chart definitions remain unchanged) ---
    const excludedImnciSubtypes = ["Standard 7 days course for Medical Doctors", "Standard 7 days course for Medical Assistance", "Refreshment IMNCI Course"];
    const showTestScoresOnScreen = course.course_type !== 'IMNCI' || (course.course_type === 'IMNCI' && !excludedImnciSubtypes.includes(course.imci_sub_type));

    if (isLoading) return <Card><Spinner /></Card>;

    // Chart Data for Overall Performance by Group (Combined Bar Chart)
    const combinedChartData = {
        labels: groupsWithData,
        datasets: [
            {
                type: 'bar',
                label: 'Total Cases',
                data: groupsWithData.map(g => groupPerformance[g].totalCases),
                backgroundColor: '#3b82f6',
                yAxisID: 'y'
            },
            {
                type: 'bar',
                label: 'Total Correct Cases',
                data: groupsWithData.map(g => groupPerformance[g].correctCases),
                backgroundColor: '#10b981',
                yAxisID: 'y'
            }
        ]
    };

    const combinedChartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Overall Performance by Group: Cases & Correct Cases'
            },
            datalabels: {
                anchor: 'end',
                align: 'top',
                formatter: (value, context) => {
                    return value > 0 ? value : '';
                },
                font: {
                    weight: 'bold',
                    size: 10,
                },
                color: '#000',
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Total Count'
                },
                beginAtZero: true
            }
        }
    };

    // Chart Data for Daily Performance (Combined Bar/Line Chart)
    const dailyChartData = {
        labels: dailyChartLabels,
        datasets: [
            {
                type: 'bar',
                label: 'Total Cases',
                data: dailyChartLabels.map(day => {
                    let totalCasesForDay = 0;
                    groupsWithData.forEach(group => {
                        const dayData = dailyPerformance[day] && dailyPerformance[day][group] ? dailyPerformance[day][group] : { cases: 0 };
                        totalCasesForDay += dayData.cases;
                    });
                    return totalCasesForDay;
                }),
                backgroundColor: '#3b82f6',
                yAxisID: 'y'
            },
            {
                type: 'bar',
                label: 'Total Correct Cases',
                data: dailyChartLabels.map(day => {
                    let totalCorrectCasesForDay = 0;
                    groupsWithData.forEach(group => {
                        const dayData = dailyPerformance[day] && dailyPerformance[day][group] ? dailyPerformance[day][group] : { correctCases: 0 };
                        totalCorrectCasesForDay += dayData.correctCases;
                    });
                    return totalCorrectCasesForDay;
                }),
                backgroundColor: '#10b981',
                yAxisID: 'y'
            }
        ]
    };

    const dailyChartOptions = {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: 'Overall Performance by Day'
            },
            legend: {
                position: 'top',
            },
            datalabels: {
                anchor: 'end',
                align: 'top',
                formatter: (value) => value > 0 ? value : '',
                font: {
                    weight: 'bold',
                    size: 10,
                },
                color: '#000',
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Day'
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Total Count'
                },
                beginAtZero: true
            }
        }
    };
    
    // Pre/Post Test Score Chart Data
    const chartParticipants = participants.filter(p => Number(p.pre_test_score) > 0 && Number(p.post_test_score) > 0);
    const participantCount = chartParticipants.length;
    const showCompactLabels = participantCount > 24;
    const preScores = chartParticipants.map(p => Number(p.pre_test_score));
    const postScores = chartParticipants.map(p => Number(p.post_test_score));
    const allScoresPct = [...preScores, ...postScores];
    const minScorePct = allScoresPct.length > 0 ? Math.min(...allScoresPct.filter(s => !isNaN(s))) : 0;
    let yMin = Math.max(0, minScorePct - 10);
    yMin = Math.floor(yMin / 5) * 5;
    let participantLabels = [];
    if (showCompactLabels) {
        participantLabels = chartParticipants.map((p, index) => `P${index + 1}`);
    } else {
        participantLabels = chartParticipants.map((p, index) => `${p.name} (${index + 1})`);
    }

    const testScoreChartData = {
        labels: participantLabels,
        datasets: [
            {
                label: 'Pre-Test Score',
                data: preScores,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                tension: 0.4,
                fill: false,
                pointRadius: showCompactLabels ? 3 : 5,
                pointBackgroundColor: '#6366f1',
            },
            {
                label: 'Post-Test Score',
                data: postScores,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                tension: 0.4,
                fill: false,
                pointRadius: showCompactLabels ? 3 : 5,
                pointBackgroundColor: '#10b981',
            }
        ]
    };

    const testScoreChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Participant Pre-Test vs. Post-Test Scores'
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    title: function(context) {
                        const participantIndex = context[0].dataIndex;
                        return `${chartParticipants[participantIndex].name} (${participantIndex + 1})`;
                    },
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.raw !== null) {
                            label += fmtPct(context.raw); 
                        }
                        return label;
                    }
                }
            },
            datalabels: {
                display: false,
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Participant'
                },
                grid: {
                    display: false
                },
                ticks: {
                    maxTicksLimit: 25,
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Test Result (%)'
                },
                beginAtZero: false,
                ticks: {
                    stepSize: 5
                },
                min: yMin,
                max: 100
            }
        },
    };
    
    // --- (Filter definitions remain unchanged) ---
    const scoreFilterOptions = [
        { name: 'All' }, { name: 'Perfect' }, { name: 'Excellent' }, { name: 'Good' },
        { name: 'Fair' }, { name: 'Fail' }, { name: 'Data Incomplete' }
    ];
    const caseFilterOptions = [
        { name: 'All' }, { name: 'Perfect' }, { name: 'Excellent' }, { name: 'Good' },
        { name: 'Fail' }, { name: 'Data Incomplete' }
    ];
    const correctnessCategories = [
        { name: 'Perfect', colorClass: 'bg-green-200 text-green-800', key: 'Perfect' },
        { name: 'Excellent', colorClass: 'bg-yellow-200 text-yellow-800', key: 'Excellent' },
        { name: 'Good', colorClass: 'bg-gray-200 text-gray-800', key: 'Good' },
        { name: 'Fair', colorClass: 'bg-orange-200 text-orange-800', key: 'Fair' },
        { name: 'Fail', colorClass: 'bg-red-200 text-red-800', key: 'Fail' },
        { name: 'Data Incomplete', colorClass: 'bg-gray-700 text-white', key: 'Data Incomplete' }
    ];
    const practicalScoreCategories = [
        { name: 'Perfect', colorClass: getScoreColorClass(100), key: 'Perfect' },
        { name: 'Excellent', colorClass: getScoreColorClass(95), key: 'Excellent' },
        { name: 'Good', colorClass: getScoreColorClass(90), key: 'Good' },
        { name: 'Fair', colorClass: 'bg-orange-200 text-orange-800', key: 'Fair' },
        { name: 'Fail', colorClass: getScoreColorClass(89), key: 'Fail' },
        { name: 'Data Incomplete', colorClass: getScoreColorClass(NaN), key: 'Data Incomplete' }
    ];

    // --- (Boolean flags remain unchanged) ---
    const hasAnyKpis = overall.totalCases > 0 || overall.totalSkills > 0;
    const hasAnyCaseDataForCharts = combinedChartData.datasets[0].data.some(d => d > 0);
    const hasAnyDailyCaseDataForCharts = dailyChartData.datasets[0].data.some(d => d > 0);
    const hasDailyCaseData = dailyCaseTableData.length > 0;
    const hasDailySkillData = dailySkillTableData.length > 0;
    const hasTestScoreDataForKpis = preTestStats.avg > 0 || postTestStats.avg > 0;
    const hasChartParticipants = chartParticipants.length > 0;


    // --- JSX RENDER ---
    return (
        <div className="grid gap-6">
            <PageHeader 
                title="Full Course Report" 
                subtitle={`${course.course_type} - ${course.state}`} 
                actions={
                    isSharedView ? (
                        <div className="flex items-center gap-2">
                            <Button 
                                onClick={() => handlePdfGeneration('print')} 
                                variant="secondary" 
                                disabled={isPdfGenerating}
                            >
                                <PdfIcon /> Export for Print
                            </Button>
                            <Button 
                                onClick={() => handlePdfGeneration('screen')} 
                                variant="secondary" 
                                disabled={isPdfGenerating}
                            >
                                <PdfIcon /> Export for Sharing
                            </Button>
                            
                            {isPdfGenerating && (
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Spinner size="sm" />
                                    <span>Generating...</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <Button onClick={() => onShare(course)} variant="secondary" disabled={isPdfGenerating}>
                                    <ShareIcon /> Share
                                </Button>
                                <Button 
                                    onClick={() => handlePdfGeneration('print')} 
                                    variant="secondary" 
                                    disabled={isPdfGenerating}
                                >
                                    <PdfIcon /> Export for Print
                                </Button>
                                <Button 
                                    onClick={() => handlePdfGeneration('screen')} 
                                    variant="secondary" 
                                    disabled={isPdfGenerating}
                                >
                                    <PdfIcon /> Export for Sharing
                                </Button>
                                
                                {isPdfGenerating && (
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Spinner size="sm" />
                                        <span>Generating...</span>
                                    </div>
                                )}
                            </div>
                            <Button onClick={onBack} disabled={isPdfGenerating}>Back to List</Button>
                        </>
                    )
                }
            />
            
            <div id="full-course-report" className="space-y-6">

                {/* Main Course Info Card (id="course-info-card") */}
                <Card>
                    <div id="course-info-card" className="relative p-2">
                        {!isSharedView && (
                            <button
                                onClick={() => handleCopyAsImage('course-info-card')}
                                className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                title="Copy as Image"
                            >
                                <CopyIcon />
                            </button>
                        )}
                        <h3 className="text-xl font-bold mb-4">Course Information</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div><strong>State:</strong> {course.state}</div>
                            <div><strong>Locality:</strong> {course.locality}</div>
                            {course.course_type === 'IMNCI' && course.imci_sub_type && <div><strong>IMNCI Course Type:</strong> {course.imci_sub_type}</div>}
                            <div><strong>Hall:</strong> {course.hall}</div>
                            <div><strong>Start Date:</strong> {course.start_date}</div>
                            <div><strong># Participants:</strong> {participants.length}</div>
                            <div><strong>Coordinator:</strong> {course.coordinator}</div>
                            <div><strong>Director:</strong> {course.director}</div>
                            {course.clinical_instructor && <div><strong>Clinical Instructor:</strong> {course.clinical_instructor}</div>}
                            <div><strong>Funded by:</strong> {course.funded_by}</div>
                            {course.course_budget && <div><strong>Course Budget (USD):</strong> ${course.course_budget}</div>}
                            <div className="col-span-2"><strong>Facilitators:</strong> {(course.facilitators || []).join(', ')}</div>
                        </div>
                    </div>
                </Card>

                {/* Final Report Card (Not included in PDF) */}
                {finalReportData && finalReportData.pdf_url && (
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Final Report Documents</h3>
                        <Table headers={['Link', 'Actions']}>
                            <tr>
                                <td className="p-2 border">
                                    <a href={finalReportData.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-2">
                                        <PdfIcon className="text-blue-500" />
                                        View Report PDF
                                    </a>
                                </td>
                                <td className="p-2 border text-right">
                                    <div className="flex gap-2 justify-end">
                                        <a href={finalReportData.pdf_url} download={`Final_Report_${course.course_type}_${course.state}.pdf`} className="text-gray-600 hover:text-gray-900">
                                            <Button variant="secondary">Download</Button>
                                        </a>
                                        {!isSharedView && (
                                            <>
                                                <Button variant="secondary" onClick={() => onEditFinalReport(course.id)}>Edit</Button>
                                                <Button variant="danger" onClick={() => onDeletePdf(course.id)}>Delete PDF</Button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        </Table>
                    </Card>
                )}
                
                {/* KPI Card (id="kpi-card") */}
                {hasAnyKpis && (
                    <Card>
                        <div id="kpi-card" className="relative p-2">
                            {!isSharedView && (
                                <button
                                    onClick={() => handleCopyAsImage('kpi-card')}
                                    className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                    title="Copy as Image"
                                >
                                    <CopyIcon />
                                </button>
                            )}
                            <h3 className="text-xl font-bold mb-4">Key Performance Indicators (KPIs)</h3>
                            <div className="space-y-6">
                                {/* Case KPIs Row */}
                                <div>
                                    <h4 className="text-lg font-semibold mb-2 text-gray-700">Case KPIs</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <div className="text-sm text-gray-600">Total Cases</div>
                                            <div className="text-3xl font-bold text-sky-700">{overall.totalCases}</div>
                                        </div>
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <div className="text-sm text-gray-600">Total Correct Cases</div>
                                            <div className="text-3xl font-bold text-sky-700">{overall.correctCases}</div>
                                        </div>
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <div className="text-sm text-gray-600">Avg. Cases / Participant</div>
                                            <div className="text-3xl font-bold text-sky-700">{overall.avgCasesPerParticipant.toFixed(1)}</div>
                                        </div>
                                        <div className={`p-4 rounded-lg ${getScoreColorClass(overall.caseCorrectnessPercentage)}`}>
                                            <div className="text-sm font-semibold">Overall Correctness</div>
                                            <div className="text-3xl font-bold">{fmtPct(overall.caseCorrectnessPercentage)}</div>
                                        </div>
                                    </div>
                                </div>
                                {/* Classification KPIs Row */}
                                <div>
                                    <h4 className="text-lg font-semibold mb-2 text-gray-700">Skill/Classification KPIs</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <div className="text-sm text-gray-600">Total Skills</div>
                                            <div className="text-3xl font-bold text-sky-700">{overall.totalSkills}</div>
                                        </div>
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <div className="text-sm text-gray-600">Total Correct Skills</div>
                                            <div className="text-3xl font-bold text-sky-700">{overall.correctSkills}</div>
                                        </div>
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <div className="text-sm text-gray-600">Avg. Skills / Participant</div>
                                            <div className="text-3xl font-bold text-sky-700">{overall.avgSkillsPerParticipant.toFixed(1)}</div>
                                        </div>
                                        <div className={`p-4 rounded-lg ${getScoreColorClass(overall.skillCorrectnessPercentage)}`}>
                                            <div className="text-sm font-semibold">Overall Correctness</div>
                                            <div className="text-3xl font-bold">{fmtPct(overall.skillCorrectnessPercentage)}</div>
                                        </div>
                                    </div>
                                </div>
                                {/* IMNCI Introduction KPIs */}
                                {course.course_type === 'IMNCI' && newImciFacilities.length > 0 && (
                                    <div>
                                        <h4 className="text-lg font-semibold mb-2 text-gray-700">IMNCI Introduction</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                            <div className="p-4 bg-blue-100 text-blue-800 rounded-lg col-span-1">
                                                <div className="text-sm font-semibold">Facilities w/ New IMNCI</div>
                                                <div className="text-3xl font-bold">{newImciFacilities.length}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Facilities w/ New IMNCI (id="new-imci-facilities-card") */}
                {course.course_type === 'IMNCI' && newImciFacilities && newImciFacilities.length > 0 && (
                    <Card>
                        <div id="new-imci-facilities-card" className="relative p-2">
                            {!isSharedView && (
                                <button
                                    onClick={() => handleCopyAsImage('new-imci-facilities-card')}
                                    className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                    title="Copy as Image"
                                >
                                    <CopyIcon />
                                </button>
                            )}
                            <h3 className="text-xl font-bold mb-4">Facilities with New IMNCI Service Introduction</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                The following facilities did not provide IMCI services before this course. Adding participants from these facilities has triggered an update to mark them as IMNCI-providing sites.
                            </p>
                            <Table headers={['Facility Name', 'Locality', 'State']}>
                                {newImciFacilities.map((facility, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="p-2 border font-semibold">{facility.name}</td>
                                        <td className="p-2 border">{facility.locality}</td>
                                        <td className="p-2 border">{facility.state}</td>
                                    </tr>
                                ))}
                            </Table>
                        </div>
                    </Card>
                )}

                {/* IMNCI Coverage (id="coverage-card") */}
                {course.course_type === 'IMNCI' && coverageData && (
                    <Card>
                        <div id="coverage-card" className="relative p-2">
                             {!isSharedView && (
                                <button
                                    onClick={() => handleCopyAsImage('coverage-card')}
                                    className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                    title="Copy as Image"
                                >
                                    <CopyIcon />
                                </button>
                            )}
                            <h3 className="text-xl font-bold mb-4">IMNCI Coverage for {coverageData.locality} Locality</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                                <div className="p-4 bg-gray-100 rounded-lg">
                                    <div className="text-sm font-semibold text-gray-600">Coverage Before Course</div>
                                    <div className="text-2xl font-bold">{coverageData.originalImciCount} / {coverageData.totalFacilities} ({fmtPct(coverageData.originalCoverage)})</div>
                                </div>
                                <div className="p-4 bg-green-100 text-green-800 rounded-lg">
                                    <div className="text-sm font-semibold">New Coverage After Course</div>
                                    <div className="text-2xl font-bold">{coverageData.totalImciCount} / {coverageData.totalFacilities} ({fmtPct(coverageData.newCoverage)})</div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Participant Test Scores (id="test-scores-card") */}
                {showTestScoresOnScreen && hasTestScoreDataForKpis && (
                    <Card>
                        <div id="test-scores-card" className="relative p-2">
                            {!isSharedView && (
                                <button
                                    onClick={() => handleCopyAsImage('test-scores-card')}
                                    className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                    title="Copy as Image"
                                >
                                    <CopyIcon />
                                </button>
                            )}
                            <h3 className="text-xl font-bold mb-4">Participant Test Scores</h3>
                            
                            <div className="grid grid-cols-3 gap-4 text-center mb-6">
                                <div className="p-4 bg-gray-100 rounded-lg">
                                    <div className="text-sm font-semibold text-gray-600">Avg. Pre-Test</div>
                                    <div className="text-2xl font-bold">{fmtPct(preTestStats.avg)}</div>
                                </div>
                                <div className="p-4 bg-gray-100 rounded-lg">
                                    <div className="text-sm font-semibold text-gray-600">Avg. Post-Test</div>
                                    <div className="text-2xl font-bold">{fmtPct(postTestStats.avg)}</div>
                                </div>
                                <div className={`p-4 rounded-lg ${getScoreColorClass(totalImprovement, 'improvement')}`}>
                                    <div className="text-sm font-semibold">Avg. Improvement</div>
                                    <div className="text-2xl font-bold">{fmtPct(totalImprovement)}</div>
                                </div>
                            </div>

                            {hasChartParticipants ? (
                                <div style={{ height: '350px' }}>
                                    <Line 
                                        ref={prePostDistributionChartRef} 
                                        data={testScoreChartData} 
                                        options={testScoreChartOptions}
                                    />
                                </div>
                            ) : (
                                <EmptyState message="No valid pre- and post-test data available for charting." />
                            )}
                        </div>
                    </Card>
                )}

                {/* --- CHART SECTION (id="charts-grid") --- */}
                {(hasAnyCaseDataForCharts || hasAnyDailyCaseDataForCharts) && (
                    <div id="charts-grid" className="grid md:grid-cols-2 gap-6">
                        {/* Group Perf Chart (id="group-perf-chart-card") */}
                        {hasAnyCaseDataForCharts && (
                            <Card>
                                <div id="group-perf-chart-card" className="relative p-2">
                                    {!isSharedView && (
                                        <button
                                            onClick={() => handleCopyAsImage('group-perf-chart-card')}
                                            className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                            title="Copy as Image"
                                        >
                                            <CopyIcon />
                                        </button>
                                    )}
                                    <h3 className="text-xl font-bold mb-4">Overall Performance by Group</h3>
                                    <Bar ref={overallChartRef} options={combinedChartOptions} data={combinedChartData} />
                                </div>
                            </Card>
                        )}
                        
                        {/* Day Perf Chart (id="day-perf-chart-card") */}
                        {hasAnyDailyCaseDataForCharts && (
                             <Card>
                                <div id="day-perf-chart-card" className="relative p-2">
                                    {!isSharedView && (
                                        <button
                                            onClick={() => handleCopyAsImage('day-perf-chart-card')}
                                            className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                            title="Copy as Image"
                                        >
                                            <CopyIcon />
                                        </button>
                                    )}
                                    <h3 className="text-xl font-bold mb-4">Overall Performance by Day</h3>
                                    <Bar ref={dailyChartRef} options={dailyChartOptions} data={dailyChartData} />
                                </div>
                            </Card>
                        )}
                    </div>
                )}

                {/* --- *** FIX: Added wrapper div and title *** --- */}
                <div id="daily-tables-section">
                    {(hasDailyCaseData || hasDailySkillData) && (
                        <h3 className="text-xl font-bold mb-4 px-2">Daily Performance Tables</h3>
                    )}
                    <div id="daily-tables-grid" className="grid md:grid-cols-2 gap-6">
                        {/* Daily Case Table (id="daily-case-table-card") */}
                        {hasDailyCaseData && (
                            <Card>
                                <div id="daily-case-table-card" className="relative p-2">
                                    {!isSharedView && (
                                        <button
                                            onClick={() => handleCopyAsImage('daily-case-table-card')}
                                            className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                            title="Copy as Image"
                                        >
                                            <CopyIcon />
                                        </button>
                                    )}
                                    <h3 className="text-xl font-bold mb-4">Daily Case Performance</h3>
                                    <Table headers={['Day', ...groupsWithData, 'Total']}>
                                        {dailyCaseTableData.length > 0 ? (
                                            <>
                                                {dailyCaseTableData.map((row) => (
                                                    <tr key={row.day} className="hover:bg-gray-50">
                                                        <td className="p-2 border font-bold">{row.day}</td>
                                                        {groupsWithData.map(group => (
                                                            <td key={group} className={`p-2 border text-center ${getScoreColorClass(row[group].pct)}`}>
                                                                {row[group].display}
                                                            </td>
                                                        ))}
                                                        <td className={`p-2 border text-center font-bold ${getScoreColorClass(row.totalDayPct)}`}>
                                                            {row.totalDisplay}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="hover:bg-gray-50 font-bold">
                                                    <td className="p-2 border">Total</td>
                                                    {groupsWithData.map(group => {
                                                        const totalCasesCorrect = groupCaseTotals[group].totalCases.correct;
                                                        const totalCasesTotal = groupCaseTotals[group].totalCases.total;
                                                        const pct = calcPct(totalCasesCorrect, totalCasesTotal);
                                                        return (
                                                            <td key={group} className={`p-2 border text-center ${getScoreColorClass(pct)}`}>
                                                                {totalCasesTotal} ({fmtPct(pct)})
                                                            </td>
                                                        );
                                                    })}
                                                    <td className={`p-2 border text-center ${getScoreColorClass(calcPct(grandTotalCasesCorrect, grandTotalCasesTotal))}`}>
                                                        {grandTotalCasesTotal} ({fmtPct(calcPct(grandTotalCasesCorrect, grandTotalCasesTotal))})
                                                    </td>
                                                </tr>
                                            </>
                                        ) : (
                                            <tr>
                                                <td colSpan={groupsWithData.length + 2}>
                                                    <EmptyState message="No daily case data available." />
                                                </td>
                                            </tr>
                                        )}
                                    </Table>
                                </div>
                            </Card>
                        )}
                        {/* Daily Skill Table (id="daily-skill-table-card") */}
                        {hasDailySkillData && (
                            <Card>
                                <div id="daily-skill-table-card" className="relative p-2">
                                    {!isSharedView && (
                                        <button
                                            onClick={() => handleCopyAsImage('daily-skill-table-card')}
                                            className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                            title="Copy as Image"
                                        >
                                            <CopyIcon />
                                        </button>
                                    )}
                                    <h3 className="text-xl font-bold mb-4">Daily Skill Performance</h3>
                                    <Table headers={['Day', ...groupsWithData, 'Total']}>
                                        {dailySkillTableData.length > 0 ? (
                                            <>
                                                {dailySkillTableData.map((row) => (
                                                    <tr key={row.day} className="hover:bg-gray-50">
                                                        <td className="p-2 border font-bold">{row.day}</td>
                                                        {groupsWithData.map(group => (
                                                            <td key={group} className={`p-2 border text-center ${getScoreColorClass(row[group].pct)}`}>
                                                                {row[group].display}
                                                            </td>
                                                        ))}
                                                        <td className={`p-2 border text-center font-bold ${getScoreColorClass(row.totalDayPct)}`}>
                                                            {row.totalDisplay}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="hover:bg-gray-50 font-bold">
                                                    <td className="p-2 border">Total</td>
                                                    {groupsWithData.map(group => {
                                                        const totalSkillsCorrect = groupSkillTotals[group].totalSkills.correct;
                                                        const totalSkillsTotal = groupSkillTotals[group].totalSkills.total;
                                                        const pct = calcPct(totalSkillsCorrect, totalSkillsTotal);
                                                        return (
                                                            <td key={group} className={`p-2 border text-center ${getScoreColorClass(pct)}`}>
                                                                {totalSkillsTotal} ({fmtPct(pct)})
                                                            </td>
                                                        );
                                    
                                                    })}
                                                    <td className={`p-2 border text-center ${getScoreColorClass(calcPct(grandTotalSkillsCorrect, grandTotalSkillsTotal))}`}>
                                                        {grandTotalSkillsCorrect} ({fmtPct(calcPct(grandTotalSkillsCorrect, grandTotalSkillsTotal))})
                                                    </td>
                                                </tr>
                                            </>
                                        ) : (
                                            <tr>
                                                <td colSpan={groupsWithData.length + 2}>
                                                    <EmptyState message="No daily skill performance data available." />
                                                </td>
                                            </tr>
                                        )}
                                    </Table>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
                {/* --- *** END FIX *** --- */}


                {/* Participant Results (id="participant-results-card") */}
                {(showTestScoreColumns || showCaseColumns) && (
                    <Card>
                         <div id="participant-results-card" className="relative p-2">
                            {!isSharedView && (
                                <button
                                    onClick={() => handleCopyAsImage('participant-results-card')}
                                    className="copy-button absolute top-0 right-0 m-2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors"
                                    title="Copy as Image"
                                >
                                    <CopyIcon />
                                </button>
                            )}
                            <h3 className="text-xl font-bold mb-4">Participant Results</h3>

                            {/* Participant Score Summary Table (will be captured by canvas) */}
                            {showCaseColumns && (
                                <div id="participant-summary-table" className="mb-6">
                                    <h4 className="text-md font-semibold mb-2 text-gray-700">Participant Score Summary</h4>
                                    <table className="w-full border-collapse border border-gray-300 text-center">
                                        <thead>
                                            <tr>
                                                <th className="p-2 border font-semibold bg-gray-100 text-left">Score Type</th>
                                                {practicalScoreCategories.map(cat => (
                                                    <th key={cat.key} className={`p-2 border font-semibold ${cat.colorClass}`}>
                                                        {cat.name}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Row 1: Practical Case Score */}
                                            <tr>
                                                <td className="p-2 border font-semibold text-left">Practical Case Score</td>
                                                {practicalScoreCategories.map(cat => (
                                                    <td key={cat.key} className="p-2 border text-2xl font-bold">
                                                        {caseCorrectnessDistribution[cat.key] || 0}
                                                    </td>
                                                ))}
                                            </tr>
                                            {/* Row 2: Written Test Score */}
                                            {showTestScoreColumns && (
                                                <tr>
                                                    <td className="p-2 border font-semibold text-left">Written Test Score (average improvement)</td>
                                                    {correctnessCategories.map(cat => (
                                                        <td key={cat.key} className="p-2 border text-2xl font-bold">
                                                            {avgImprovementDistribution[cat.key] || 0}
                                                        </td>
                                                    ))}
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Filters (Not included in PDF) */}
                            {!isSharedView && (
                                <div className="flex flex-col md:flex-row gap-4 mb-4">
                                    {showTestScoreColumns && (
                                        <div className="flex items-center gap-2">
                                            <label htmlFor="score-filter" className="text-sm font-semibold text-gray-700">Filter by Avg. Improvement:</label>
                                            <select
                                                id="score-filter"
                                                value={scoreFilter}
                                                onChange={(e) => setScoreFilter(e.target.value)}
                                                className="border border-gray-300 rounded-md p-2 bg-white"
                                            >
                                                {scoreFilterOptions.map(option => (
                                                    <option key={option.name} value={option.name}>
                                                        {option.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {showCaseColumns && (
                                        <div className="flex items-center gap-2">
                                            <label htmlFor="case-filter" className="text-sm font-semibold text-gray-700">Filter by Case Correctness:</label>
                                            <select
                                                id="case-filter"
                                                value={caseCorrectnessFilter}
                                                onChange={(e) => setCaseCorrectnessFilter(e.target.value)}
                                                className="border border-gray-300 rounded-md p-2 bg-white"
                                            >
                                                {caseFilterOptions.map(option => (
                                                    <option key={option.name} value={option.name}>
                                                        {option.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Participant List Table (This is what autoTable will generate) */}
                            <Table headers={tableHeaders}>
                                {filteredParticipants.length === 0 ? (
                                    <tr>
                                        <td colSpan={tableHeaders.length}>
                                            <EmptyState message="No participants match the selected filter(s)." />
                                        </td>
                                    </tr>
                                ) : (
                                    filteredParticipants.map((p, index) => {
                                        const preScore = Number(p.pre_test_score);
                                        const postScore = Number(p.post_test_score);
                                        const increase = (!isNaN(preScore) && preScore > 0 && !isNaN(postScore) && postScore > 0) ? ((postScore - preScore) / preScore) * 100 : null;
                                        
                                        const category = getAvgImprovementCategory(p.pre_test_score, p.post_test_score);
                                        
                                        const increaseDisplay = isNaN(increase) || increase === null ? 'N/A' : `${increase.toFixed(1)}%`;
                                        
                                        const preDisplay = fmtDecimal(preScore);
                                        const postDisplay = fmtDecimal(postScore);

                                        return (
                                            <tr 
                                                key={p.id} 
                                                className={`transition-colors duration-150 ${!isSharedView ? 'cursor-pointer hover:bg-gray-200' : ''}`} 
                                                onClick={!isSharedView ? () => onViewParticipantReport(p.id) : undefined}
                                            >
                                                <td className="p-2 border text-center">{index + 1}</td>
                                                <td className="p-2 border font-semibold">{p.name}</td>
                                                {showCaseColumns && (
                                                    <>
                                                        <td className={`p-2 border text-center`}>{p.total_cases_seen}</td>
                                                        {!isSharedView && (
                                                            <td className={`p-2 border text-center font-bold ${getScoreColorClass(p.correctness_percentage)}`}>
                                                                {getCaseCorrectnessName(p.correctness_percentage)}
                                                            </td>
                                                        )}
                                                    </>
                                                )}
                                                {showTestScoreColumns && (
                                                    <>
                                                        <td className="p-2 border text-center">{preDisplay}</td>
                                                        <td className="p-2 border text-center">{postDisplay}</td>
                                                        <td className={`p-2 border text-center`}>
                                                            {increaseDisplay}
                                                        </td>
                                                        <td className={`p-2 border text-center ${category.className}`}>
                                                            {category.name}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </Table>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}