// CourseReportView.jsx
import React, { useMemo, useRef, useState } from 'react';
import jsPDF from "jspdf";
import html2canvas from 'html2canvas';
import { Bar, Line } from 'react-chartjs-2';
import { Button, Card, EmptyState, PageHeader, PdfIcon, Table, Spinner } from './CommonComponents';
// Import Chart.js to register components needed for the graph
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
    PointElement, LineElement
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ChartDataLabels);
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

// --- New Icon Component for the Copy Button ---
const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

// --- New Icon for Share Button ---
const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
    </svg>
);


// --- Helper functions for calculations and formatting ---
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

// --- Color-coding helper for consistency ---
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
    // Logic for general percentages
    if (value === 100) return 'bg-green-200 text-green-800';
    if (value >= 95) return 'bg-yellow-200 text-yellow-800';
    if (value >= 90) return 'bg-orange-200 text-orange-800'; // Changed from amber to orange
    return 'bg-red-200 text-red-800'; // Default for < 90%
};


// New helper for coloring case count - this function will no longer be used for the table
const getCaseCountColorClass = (value) => {
    return '';
}

const getScoreCategory = (preScore, postScore) => {
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
        return { name: 'Excellent', className: 'bg-green-200 text-green-800' };
    }
    if (increase >= 25) {
        return { name: 'Good', className: 'bg-yellow-200 text-yellow-800' };
    }
    if (increase >= 0) {
        return { name: 'Fair', className: 'bg-gray-200 text-gray-800' };
    }
    return { name: 'Fail', className: 'bg-red-200 text-red-800' };
};

// --- NEW: Helper to get the name of the case correctness category ---
const getCaseCorrectnessName = (pct) => {
    if (isNaN(pct) || pct === null) return 'Data Incomplete';
    if (pct === 100) return 'Perfect';
    if (pct >= 95) return 'Excellent';
    if (pct >= 90) return 'Good';
    return 'Fail';
};


// --- UPDATED PDF Export Helper with Quality Settings ---
const generateFullCourseReportPdf = async (course, quality = 'print', onSuccess, onError) => {
    // Define quality profiles for different export needs
    const qualityProfiles = {
        print: { /* ... */ },
        screen: { /* ... */ }
    };

    const profile = qualityProfiles[quality] || qualityProfiles.print;

    const doc = new jsPDF('portrait', 'mm', 'a4');
    const fileName = `Course_Report_${course.course_type}_${course.state}${profile.fileSuffix}.pdf`;
    const element = document.getElementById('full-course-report');

    if (!element) {
        console.error("The element with ID 'full-course-report' was not found.");
        onError("Report element not found. Could not generate PDF."); // Use onError
        return;
    }

    try {
        const canvas = await html2canvas(element, {
            scale: profile.scale,
            useCORS: true,
            backgroundColor: '#ffffff' // Set a white background to avoid transparency issues
        });

        const imgData = canvas.toDataURL(profile.imageType, profile.imageQuality);
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // Add the captured image to the PDF, handling multiple pages
        doc.addImage(imgData, profile.imageFormat, 0, position, imgWidth, imgHeight, undefined, profile.compression);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position = -(imgHeight - heightLeft);
            doc.addPage();
            doc.addImage(imgData, profile.imageFormat, 0, position, imgWidth, imgHeight, undefined, profile.compression);
            heightLeft -= pageHeight;
        }

        // --- NEW SAVE LOGIC ---
        if (Capacitor.isNativePlatform()) {
            // We are on mobile (Android/iOS)
            // Get PDF as base64 string (remove data:application/pdf;base64, prefix)
            const base64Data = doc.output('datauristring').split('base64,')[1];
            
            // Write the file to the Downloads directory
            const writeResult = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Downloads,
            });

            // Now, try to open the file using its native URI
            await FileOpener.open({
                filePath: writeResult.uri, // Use the URI returned by writeFile
                contentType: 'application/pdf',
            });

            onSuccess(`PDF saved to Downloads folder: ${fileName}`);
        } else {
            // We are on web
            doc.save(fileName);
            onSuccess("PDF download initiated."); // Web download is just an initiation
        }
        // --- END NEW SAVE LOGIC ---

    } catch (e) {
        console.error("Error generating or saving PDF:", e);
        onError(`Failed to save PDF: ${e.message || 'Unknown error'}`);
    }
};

// --- NEW HELPER FUNCTION FOR STATS AND DISTRIBUTION ---
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
    onDeletePdf, onViewParticipantReport, isSharedView = false, onShare, setToast // <-- ACCEPT setToast PROP
}) {
    const overallChartRef = useRef(null);
    const dailyChartRef = useRef(null);
    const prePostDistributionChartRef = useRef(null);
    const [scoreFilter, setScoreFilter] = useState('All');
    const [caseCorrectnessFilter, setCaseCorrectnessFilter] = useState('All');
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

    // --- NEW: Notification helper ---
    const notify = (message, type = 'info') => {
        if (setToast) {
            setToast({ show: true, message, type });
        } else {
            // Fallback for when setToast is not provided
            alert(message);
        }
    };



    // --- NEW: Wrapper function to handle PDF generation state ---
   const handlePdfGeneration = async (quality) => {
        setIsPdfGenerating(true);
        // Add a small delay to allow the UI to update to the loading state
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
            // Pass the notify functions as callbacks
            await generateFullCourseReportPdf(
                course, 
                quality,
                (message) => notify(message, 'success'), // OnSuccess callback
                (message) => notify(message, 'error')    // OnError callback
            );
        } catch (error) {
            // This catch is a fallback, but the helper should handle its own errors
            console.error("Failed to generate PDF:", error);
            notify("Sorry, there was an error generating the PDF.", 'error');
        } finally {
            setIsPdfGenerating(false);
        }
    };



    // --- NEW: Function to handle copying a card as an image ---
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
                backgroundColor: '#ffffff', // Set a white background for transparency issues
                onclone: (document) => {
                    // Hide the copy button itself from the copied image
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


    const isLoading = !course || !participants || !allObs || !allCases;

    const { groupPerformance, overall, dailyPerformance, hasTestScores, hasCases, participantsWithStats, preTestStats, postTestStats, totalImprovement, caseCorrectnessDistribution } = useMemo(() => {
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
        
        // Calculate average improvement using the newly calculated averages
        const totalImprovement = preTestStats.avg > 0 ? ((postTestStats.avg - preTestStats.avg) / preTestStats.avg) * 100 : 0;
        
        // Use a separate filtered list for the chart
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
        
        // Recalculate group totals to include skills from observations
        Object.keys(groupPerformance).forEach(g => {
            const group = groupPerformance[g];
            const groupObs = allObs.filter(o => group.pids.includes(o.participant_id));
            group.totalObs = groupObs.length;
            group.correctObs = groupObs.filter(o => o.item_correct > 0).length;
            group.percentage = calcPct(group.correctObs, group.totalObs);
            group.participantCount = group.pids.length;
        });

        // Recalculate overall totals for the new KPI structure
        let totalObs = 0, correctObs = 0, totalCases = 0, correctCases = 0;
        Object.keys(groupPerformance).forEach(g => {
            const group = groupPerformance[g];
            totalObs += group.totalObs;
            correctObs += group.correctObs;
            totalCases += group.totalCases;
            correctCases += group.correctCases;
        });
        
        // Add participant-level case and skills data
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
        
        // New 'overall' object structure for KPIs
        const overall = {
            // Case KPIs
            totalCases,
            correctCases,
            avgCasesPerParticipant: (totalCases / participants.length) || 0,
            caseCorrectnessPercentage: calcPct(correctCases, totalCases),

            // Skill/Classification KPIs (using 'obs' which means skills)
            totalSkills: totalObs,
            correctSkills: correctObs,
            avgSkillsPerParticipant: (totalObs / participants.length) || 0,
            skillCorrectnessPercentage: calcPct(correctObs, totalObs)
        };

        // --- NEW: Calculate case correctness distribution ---
        const caseCorrectnessDistribution = {
            'Perfect': 0, 'Excellent': 0, 'Good': 0, 'Fail': 0, 'Data Incomplete': 0
        };
        participantsWithStats.forEach(p => {
            const categoryName = getCaseCorrectnessName(p.correctness_percentage);
            if (caseCorrectnessDistribution.hasOwnProperty(categoryName)) {
                caseCorrectnessDistribution[categoryName]++;
            }
        });

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
            caseCorrectnessDistribution
        };
    }, [participants, allObs, allCases, isLoading]);

    const excludedImnciSubtypes = ["Standard 7 days course for Medical Doctors", "Standard 7 days course for Medical Assistance", "Refreshment IMNCI Course"];
    const showTestScoresOnScreen = course.course_type !== 'IMNCI' || (course.course_type === 'IMNCI' && !excludedImnciSubtypes.includes(course.imci_sub_type));

    if (isLoading) return <Card><Spinner /></Card>;

    // Dynamically get groups with data for charts and tables, and sort them alphabetically
    const groupsWithData = Object.keys(groupPerformance).sort();

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
            datalabels: { // NEW: Data labels plugin configuration
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
    const dailyChartLabels = Object.keys(dailyPerformance).sort((a, b) => {
        const dayA = parseInt(a.replace('Day ', ''));
        const dayB = parseInt(b.replace('Day ', ''));
        return dayA - dayB;
    });

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
                text: 'Overall Performance by Day' // Updated title here
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
    
    // --- UPDATED CHART DATA FOR PRE/POST TEST SCORES ---
    // Filter participants to only include those with valid scores (> 0)
    const chartParticipants = participants.filter(p => Number(p.pre_test_score) > 0 && Number(p.post_test_score) > 0);
    
    // Adjust labels and tooltips based on participant count
    const participantCount = chartParticipants.length;
    const showCompactLabels = participantCount > 24;
    
    const preScores = chartParticipants.map(p => Number(p.pre_test_score));
    const postScores = chartParticipants.map(p => Number(p.post_test_score));

    // Determine the labels to display on the x-axis
    let participantLabels = [];
    if (showCompactLabels) {
        // Create labels like 'P1', 'P2', etc. to avoid crowding
        participantLabels = chartParticipants.map((p, index) => `P${index + 1}`);
    } else {
        // Use full names for a small number of participants
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
                pointRadius: showCompactLabels ? 3 : 5, // Reduce point size for more participants
                pointBackgroundColor: '#6366f1',
            },
            {
                label: 'Post-Test Score',
                data: postScores,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                tension: 0.4,
                fill: false,
                pointRadius: showCompactLabels ? 3 : 5, // Reduce point size
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
                         // Find the full name for the tooltip title
                        const participantIndex = context[0].dataIndex;
                        return `${chartParticipants[participantIndex].name} (${participantIndex + 1})`;
                    },
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.raw !== null) {
                            label += context.raw; // Display as figure
                        }
                        return label;
                    }
                }
            },
            // Disable data labels for this specific chart
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
                    maxTicksLimit: 25, // Limit the number of ticks to avoid crowding
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Test Result (figure)'
                },
                beginAtZero: true,
                ticks: {
                    stepSize: 2
                },
                min: 4,
                max: 20
            }
        },
    };
    
    // --- DAILY SKILL TABLE DATA CALCULATION ---
    const dailySkillTableData = dailyChartLabels.map(day => {
        const row = { day, totalSkills: { correct: 0, total: 0 } };
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[day] && dailyPerformance[day][group] ? dailyPerformance[day][group] : { correct: 0, total: 0, cases: 0 };
            const pct = calcPct(dayData.correct, dayData.total);
            row[group] = {
                pct,
                display: `${dayData.total} (${fmtPct(pct)})`
            };
            row.totalSkills.correct += dayData.correct;
            row.totalSkills.total += dayData.total;
        });
        const totalDayPct = calcPct(row.totalSkills.correct, row.totalSkills.total);
        row.totalDisplay = `${row.totalSkills.total} (${fmtPct(totalDayPct)})`;
        row.totalDayPct = totalDayPct;
        return row;
    });

    // --- DAILY SKILL TABLE TOTALS CALCULATION ---
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

    // --- PARTICIPANT FILTERING AND SORTING ---
    const filteredParticipants = useMemo(() => {
        let participants = [...participantsWithStats];

        // Apply Score Category filter
        if (scoreFilter !== 'All') {
            participants = participants.filter(p => {
                const category = getScoreCategory(p.pre_test_score, p.post_test_score).name;
                return category === scoreFilter;
            });
        }

        // Apply Case Correctness filter (logic updated to match new color scheme)
        if (caseCorrectnessFilter !== 'All') {
            participants = participants.filter(p => {
                const pct = p.correctness_percentage;
                if (caseCorrectnessFilter === 'Perfect') return pct === 100;
                if (caseCorrectnessFilter === 'Excellent') return pct >= 95 && pct < 100;
                if (caseCorrectnessFilter === 'Good') return pct >= 90 && pct < 95;
                if (caseCorrectnessFilter === 'Fail') return pct < 90;
                if (caseCorrectnessFilter === 'Data Incomplete') return isNaN(pct) || pct === null;
                return true;
            });
        }

        // Sort by correctness percentage in descending order
        participants.sort((a, b) => {
            const pctA = a.correctness_percentage ?? -1; // Treat null/NaN as low values for sorting
            const pctB = b.correctness_percentage ?? -1;
            return pctB - pctA;
        });

        return participants;
    }, [participantsWithStats, scoreFilter, caseCorrectnessFilter]);


    // Determine which columns to show dynamically
    const showTestScoreColumns = hasTestScores;
    const showCaseColumns = hasCases;
    
    // Construct table headers dynamically
    const tableHeaders = ['#', 'Participant Name'];
    if (showCaseColumns) {
        tableHeaders.push('Total Cases');
        // CHANGE: Conditionally hide Correctness % header in shared view
        if (!isSharedView) {
            tableHeaders.push('Correctness %');
        }
    }
    if (showTestScoreColumns) {
        tableHeaders.push('Pre-Test Result');
        tableHeaders.push('Post-Test Result');
        tableHeaders.push('% Increase');
        tableHeaders.push('Score Category');
    }

    // --- DAILY CASE TABLE DATA CALCULATION ---
    const dailyCaseTableData = dailyChartLabels.map(day => {
        const row = { day, totalCases: { correct: 0, total: 0 } };
        groupsWithData.forEach(group => {
            const dayData = dailyPerformance[day] && dailyPerformance[day][group] ? dailyPerformance[day][group] : { cases: 0, correctCases: 0 };
            const pct = calcPct(dayData.correctCases, dayData.cases);
            row[group] = {
                pct,
                display: `${dayData.cases} (${fmtPct(pct)})`
            };
            row.totalCases.correct += dayData.correctCases;
            row.totalCases.total += dayData.cases;
        });
        const totalDayPct = calcPct(row.totalCases.correct, row.totalCases.total);
        row.totalDisplay = `${row.totalCases.total} (${fmtPct(totalDayPct)})`;
        row.totalDayPct = totalDayPct;
        return row;
    });

    // --- DAILY CASE TABLE TOTALS CALCULATION ---
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
    
    // --- Filter button definitions ---
    const scoreFilterOptions = [
        { name: 'All', colorClass: 'bg-blue-600 text-white' },
        { name: 'Excellent', colorClass: 'bg-green-600 text-white' },
        { name: 'Good', colorClass: 'bg-yellow-500 text-white' },
        { name: 'Fair', colorClass: 'bg-gray-600 text-white' },
        { name: 'Fail', colorClass: 'bg-red-600 text-white' },
        { name: 'Data Incomplete', colorClass: 'bg-gray-700 text-white' }
    ];

    // Filter buttons to match new color logic
    const caseFilterOptions = [
        { name: 'All', colorClass: 'bg-blue-600 text-white' },
        { name: 'Perfect', colorClass: 'bg-green-600 text-white' },    // 100%
        { name: 'Excellent', colorClass: 'bg-yellow-500 text-white' },  // >= 95
        { name: 'Good', colorClass: 'bg-orange-500 text-white' },     // >= 90 (Changed from amber)
        { name: 'Fail', colorClass: 'bg-red-600 text-white' },          // < 90
        { name: 'Data Incomplete', colorClass: 'bg-gray-700 text-white' }
    ];

    // --- NEW: Definitions for the correctness summary table ---
    const correctnessCategories = [
        { name: 'Perfect', colorClass: getScoreColorClass(100), key: 'Perfect' },
        { name: 'Excellent', colorClass: getScoreColorClass(95), key: 'Excellent' },
        { name: 'Good', colorClass: getScoreColorClass(90), key: 'Good' },
        { name: 'Fail', colorClass: getScoreColorClass(89), key: 'Fail' },
        { name: 'Data Incomplete', colorClass: getScoreColorClass(NaN), key: 'Data Incomplete' }
    ];


    const hasAnyKpis = overall.totalCases > 0 || overall.totalSkills > 0;
    const hasAnyCaseDataForCharts = combinedChartData.datasets[0].data.some(d => d > 0);
    const hasAnyDailyCaseDataForCharts = dailyChartData.datasets[0].data.some(d => d > 0);
    const hasDailyCaseData = dailyCaseTableData.length > 0;
    const hasDailySkillData = dailySkillTableData.length > 0;
    const hasTestScoreDataForKpis = preTestStats.avg > 0 || postTestStats.avg > 0;
    const hasChartParticipants = chartParticipants.length > 0;


    return (
        <div className="grid gap-6">
            <PageHeader 
                title="Full Course Report" 
                subtitle={`${course.course_type} - ${course.state}`} 
                actions={
                    isSharedView ? (
                        isPdfGenerating ? (
                            <Button disabled variant="secondary"><Spinner /> Generating PDF...</Button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Button onClick={() => handlePdfGeneration('print')} variant="secondary"><PdfIcon /> Export for Print</Button>
                                <Button onClick={() => handlePdfGeneration('screen')} variant="secondary"><PdfIcon /> Export for Sharing</Button>
                            </div>
                        )
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <Button onClick={() => onShare(course)} variant="secondary">
                                    <ShareIcon /> Share
                                </Button>
                                {isPdfGenerating ? (
                                    <Button disabled variant="secondary"><Spinner /> Generating PDF...</Button>
                                ) : (
                                    <>
                                        <Button onClick={() => handlePdfGeneration('print')} variant="secondary"><PdfIcon /> Export for Print</Button>
                                        <Button onClick={() => handlePdfGeneration('screen')} variant="secondary"><PdfIcon /> Export for Sharing</Button>
                                    </>
                                )}
                            </div>
                            <Button onClick={onBack} disabled={isPdfGenerating}>Back to List</Button>
                        </>
                    )
                }
            />
            
            <div id="full-course-report" className="space-y-6">

                {/* Main Course Info Card */}
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

                {/* Final Report Card */}
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
                
                {/* KPI Card */}
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
                            </div>
                        </div>
                    </Card>
                )}


                {/* Participant Test Scores Card */}
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
                                    <div className="text-2xl font-bold">{preTestStats.avg.toFixed(1)}</div>
                                </div>
                                <div className="p-4 bg-gray-100 rounded-lg">
                                    <div className="text-sm font-semibold text-gray-600">Avg. Post-Test</div>
                                    <div className="text-2xl font-bold">{postTestStats.avg.toFixed(1)}</div>
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

                {/* --- CHART SECTION START --- */}
                {(hasAnyCaseDataForCharts || hasAnyDailyCaseDataForCharts) && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Overall Performance by Group chart card */}
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
                        
                        {/* Overall Performance by Day chart card */}
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
                {/* --- CHART SECTION END --- */}

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Daily Case Table */}
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
                    {/* Daily Skill Table */}
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

                {/* Participant Results Card */}
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

                            {/* --- Case Correctness Summary Table --- */}
                            {showCaseColumns && (
                                <div className="mb-6">
                                    <h4 className="text-md font-semibold mb-2 text-gray-700">Case Correctness Summary</h4>
                                    <table className="w-full border-collapse border border-gray-300 text-center">
                                        <thead>
                                            <tr>
                                                {correctnessCategories.map(cat => (
                                                    <th key={cat.key} className={`p-2 border font-semibold ${cat.colorClass}`}>
                                                        {cat.name}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                {correctnessCategories.map(cat => (
                                                    <td key={cat.key} className="p-2 border text-2xl font-bold">
                                                        {caseCorrectnessDistribution[cat.key]}
                                                    </td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* --- Filters --- */}
                            {!isSharedView && (
                                <div className="flex flex-col gap-4 mb-4">
                                    {showTestScoreColumns && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-700">Filter by Score Category:</span>
                                            {scoreFilterOptions.map(option => {
                                                const isSelected = scoreFilter === option.name;
                                                return (
                                                    <button
                                                        key={option.name}
                                                        onClick={() => setScoreFilter(option.name)}
                                                        className={`text-sm px-4 py-2 rounded-full font-semibold transition-colors duration-200 ease-in-out ${option.colorClass} ${isSelected ? 'border-2 border-black shadow-md' : ''}`}
                                                    >
                                                        {option.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {showCaseColumns && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-700">Filter by Case Correctness:</span>
                                            {caseFilterOptions.map(option => {
                                                const isSelected = caseCorrectnessFilter === option.name;
                                                return (
                                                    <button
                                                        key={option.name}
                                                        onClick={() => setCaseCorrectnessFilter(option.name)}
                                                        className={`text-sm px-4 py-2 rounded-full font-semibold transition-colors duration-200 ease-in-out ${option.colorClass} ${isSelected ? 'border-2 border-black shadow-md' : ''}`}
                                                    >
                                                        {option.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

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
                                        const category = getScoreCategory(p.pre_test_score, p.post_test_score);
                                        
                                        const increaseDisplay = isNaN(increase) || increase === null ? 'N/A' : `${increase.toFixed(1)}%`;
                                        const preDisplay = isNaN(preScore) ? 'N/A' : preScore;
                                        const postDisplay = isNaN(postScore) ? 'N/A' : postScore;

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
                                                            <td className={`p-2 border text-center font-bold ${getScoreColorClass(p.correctness_percentage)}`}>{fmtPct(p.correctness_percentage)}</td>
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