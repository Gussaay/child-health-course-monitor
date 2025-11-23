import React, { useState, useMemo, useRef } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from 'html2canvas';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Reusing components and styles from your ecosystem
import { Card, Button, Table, EmptyState, Spinner, PdfIcon } from './CommonComponents'; 
import { amiriFontBase64 } from './AmiriFont.js'; 

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ChartDataLabels);

// --- Helper Components ---
const Select = (props) => <select {...props} className={`border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${props.className || ''}`}>{props.children}</select>;
const FormGroup = ({ label, children }) => (<div className="flex flex-col gap-1 mb-2"><label className="font-semibold text-gray-700 text-xs uppercase tracking-wide">{label}</label>{children}</div>);

// --- Styles Helper ---
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

const fmtPct = (value) => (isNaN(value) || value === null ? 'N/A' : `${value.toFixed(1)}%`);

export default function CompiledReportView({ allCourses, allParticipants }) {
    // --- State ---
    const [filterType, setFilterType] = useState('IMNCI'); // Default to IMNCI as per request
    const [filterSubType, setFilterSubType] = useState('All');
    const [filterState, setFilterState] = useState('All');
    const [yearFilter, setYearFilter] = useState('All');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // --- Derived Data: Filter Options ---
    const courseTypes = useMemo(() => ['All', ...new Set(allCourses.map(c => c.course_type).filter(Boolean))].sort(), [allCourses]);
    const subTypes = useMemo(() => {
        if (filterType !== 'IMNCI') return [];
        return ['All', ...new Set(allCourses.filter(c => c.course_type === 'IMNCI').map(c => c.imci_sub_type).filter(Boolean))].sort();
    }, [allCourses, filterType]);
    const states = useMemo(() => ['All', ...new Set(allCourses.map(c => c.state).filter(Boolean))].sort(), [allCourses]);
    const years = useMemo(() => ['All', ...new Set(allCourses.map(c => new Date(c.start_date).getFullYear()).filter(Boolean))].sort(), [allCourses]);

    // --- Derived Data: Filtered Lists ---
    const filteredCourses = useMemo(() => {
        return allCourses.filter(c => {
            const cDate = new Date(c.start_date);
            const matchType = filterType === 'All' || c.course_type === filterType;
            const matchSubType = filterSubType === 'All' || c.imci_sub_type === filterSubType;
            const matchState = filterState === 'All' || c.state === filterState;
            const matchYear = yearFilter === 'All' || cDate.getFullYear().toString() === yearFilter;
            return matchType && matchSubType && matchState && matchYear;
        });
    }, [allCourses, filterType, filterSubType, filterState, yearFilter]);

    const filteredParticipants = useMemo(() => {
        const courseIds = new Set(filteredCourses.map(c => c.id));
        return allParticipants.filter(p => courseIds.has(p.courseId));
    }, [allParticipants, filteredCourses]);

    // --- Aggregation Logic (The "Course Report" Simulation) ---
    const reportData = useMemo(() => {
        // 1. Overall KPIs
        const totalCourses = filteredCourses.length;
        const totalParticipants = filteredParticipants.length;
        
        const validPreScores = filteredParticipants.map(p => Number(p.pre_test_score)).filter(s => !isNaN(s) && s > 0);
        const validPostScores = filteredParticipants.map(p => Number(p.post_test_score)).filter(s => !isNaN(s) && s > 0);
        
        const avgPre = validPreScores.length ? (validPreScores.reduce((a,b)=>a+b,0)/validPreScores.length) : 0;
        const avgPost = validPostScores.length ? (validPostScores.reduce((a,b)=>a+b,0)/validPostScores.length) : 0;
        const improvement = avgPre > 0 ? ((avgPost - avgPre) / avgPre) * 100 : 0;

        // 2. Aggregation by State (to replace "Group Performance")
        const statePerformance = {};
        filteredCourses.forEach(c => {
            if (!statePerformance[c.state]) {
                statePerformance[c.state] = { courses: 0, pax: 0, preSum: 0, postSum: 0, countPre: 0, countPost: 0 };
            }
            statePerformance[c.state].courses += 1;
            
            const coursePax = allParticipants.filter(p => p.courseId === c.id);
            statePerformance[c.state].pax += coursePax.length;

            coursePax.forEach(p => {
                const pre = Number(p.pre_test_score);
                const post = Number(p.post_test_score);
                if (pre > 0) { statePerformance[c.state].preSum += pre; statePerformance[c.state].countPre++; }
                if (post > 0) { statePerformance[c.state].postSum += post; statePerformance[c.state].countPost++; }
            });
        });

        // 3. Course List Data (to replace "Participant List")
        const courseList = filteredCourses.map(c => {
            const coursePax = allParticipants.filter(p => p.courseId === c.id);
            const cPre = coursePax.map(p => Number(p.pre_test_score)).filter(s=>s>0);
            const cPost = coursePax.map(p => Number(p.post_test_score)).filter(s=>s>0);
            const cAvgPre = cPre.length ? cPre.reduce((a,b)=>a+b,0)/cPre.length : 0;
            const cAvgPost = cPost.length ? cPost.reduce((a,b)=>a+b,0)/cPost.length : 0;
            const cImp = cAvgPre > 0 ? ((cAvgPost - cAvgPre)/cAvgPre)*100 : 0;

            return {
                id: c.id,
                type: c.course_type,
                state: c.state,
                locality: c.locality,
                date: c.start_date,
                pax: coursePax.length,
                avgPre: cAvgPre,
                avgPost: cAvgPost,
                improvement: cImp
            };
        });

        return { totalCourses, totalParticipants, avgPre, avgPost, improvement, statePerformance, courseList };
    }, [filteredCourses, filteredParticipants, allParticipants]);

    // --- Chart Data ---
    const stateLabels = Object.keys(reportData.statePerformance).sort();
    const stateChartData = {
        labels: stateLabels,
        datasets: [
            {
                label: 'Avg Pre-Test',
                data: stateLabels.map(s => {
                    const d = reportData.statePerformance[s];
                    return d.countPre ? d.preSum / d.countPre : 0;
                }),
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: 'rgb(99, 102, 241)',
                borderWidth: 1
            },
            {
                label: 'Avg Post-Test',
                data: stateLabels.map(s => {
                    const d = reportData.statePerformance[s];
                    return d.countPost ? d.postSum / d.countPost : 0;
                }),
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Performance by State' },
            datalabels: {
                display: true,
                color: 'black',
                anchor: 'end',
                align: 'top',
                formatter: Math.round
            }
        },
        scales: { y: { beginAtZero: true, max: 100 } }
    };

    // --- PDF Export (Mirroring CourseReport style) ---
    const handlePdfExport = async () => {
        setIsGeneratingPdf(true);
        const doc = new jsPDF('portrait', 'mm', 'a4');
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');

        let y = 15;
        const margin = 14;

        // Title
        doc.setFontSize(18);
        doc.text(`Aggregated Report: ${filterType}`, margin, y);
        y += 8;
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Filters: ${filterState} | ${filterSubType} | Year: ${yearFilter}`, margin, y);
        y += 15;

        // KPIs (Manual drawing or screenshot)
        // We will use AutoTable for the KPI summary to ensure it looks clean
        autoTable(doc, {
            startY: y,
            head: [['Total Courses', 'Total Participants', 'Avg Pre-Test', 'Avg Post-Test', 'Improvement']],
            body: [[
                reportData.totalCourses,
                reportData.totalParticipants,
                fmtPct(reportData.avgPre),
                fmtPct(reportData.avgPost),
                fmtPct(reportData.improvement)
            ]],
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], halign: 'center' },
            bodyStyles: { halign: 'center', fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 15;

        // Chart Snapshot
        const chartEl = document.getElementById('compiled-state-chart');
        if (chartEl) {
            const canvas = await html2canvas(chartEl, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 180;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            doc.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight);
            y += imgHeight + 15;
        }

        // Course List Table
        doc.text("Course Performance List", margin, y);
        y += 5;
        
        autoTable(doc, {
            startY: y,
            head: [['State', 'Locality', 'Date', 'Pax', 'Pre-Test', 'Post-Test', 'Imp.']],
            body: reportData.courseList.map(c => [
                c.state,
                c.locality,
                c.date,
                c.pax,
                fmtPct(c.avgPre),
                fmtPct(c.avgPost),
                fmtPct(c.improvement)
            ]),
            styles: { font: 'Amiri', fontSize: 9 },
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 6) {
                     // Color coding improvement
                     const val = parseFloat(data.cell.raw);
                     if (val > 30) data.cell.styles.textColor = [22, 101, 52];
                     else if (val < 0) data.cell.styles.textColor = [153, 27, 27];
                }
            }
        });

        doc.save(`Aggregated_Report_${filterType}_${new Date().toISOString().split('T')[0]}.pdf`);
        setIsGeneratingPdf(false);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Aggregated Performance Report</h2>
                    <p className="text-sm text-gray-500">
                        Consolidated analysis for <span className="font-semibold text-sky-600">{filterType}</span> courses.
                    </p>
                </div>
                <Button onClick={handlePdfExport} disabled={isGeneratingPdf || filteredCourses.length === 0} variant="secondary">
                    {isGeneratingPdf ? <Spinner size="sm" /> : <><PdfIcon className="w-4 h-4 mr-2"/> Export Report</>}
                </Button>
            </div>

            {/* Filters */}
            <Card className="bg-gray-50 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormGroup label="Course Type">
                        <Select value={filterType} onChange={e => { setFilterType(e.target.value); setFilterSubType('All'); }}>
                            {courseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Sub-Type">
                        <Select value={filterSubType} onChange={e => setFilterSubType(e.target.value)} disabled={filterType !== 'IMNCI'}>
                            <option value="All">All Sub-Types</option>
                            {subTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="State">
                        <Select value={filterState} onChange={e => setFilterState(e.target.value)}>
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </FormGroup>
                     <FormGroup label="Year">
                        <Select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </Select>
                    </FormGroup>
                </div>
            </Card>

            {filteredCourses.length === 0 ? (
                <EmptyState message="No data matches the selected filters." />
            ) : (
                <>
                    {/* KPI Section - Mimicking Course Report Style */}
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Performance Overview</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                             <div className="p-4 bg-gray-100 rounded-lg">
                                <div className="text-sm font-semibold text-gray-600">Total Courses</div>
                                <div className="text-2xl font-bold text-sky-700">{reportData.totalCourses}</div>
                            </div>
                            <div className="p-4 bg-gray-100 rounded-lg">
                                <div className="text-sm font-semibold text-gray-600">Total Participants</div>
                                <div className="text-2xl font-bold text-sky-700">{reportData.totalParticipants}</div>
                            </div>
                            <div className="p-4 bg-gray-100 rounded-lg">
                                <div className="text-sm font-semibold text-gray-600">Avg Pre-Test</div>
                                <div className="text-2xl font-bold">{fmtPct(reportData.avgPre)}</div>
                            </div>
                             <div className="p-4 bg-gray-100 rounded-lg">
                                <div className="text-sm font-semibold text-gray-600">Avg Post-Test</div>
                                <div className="text-2xl font-bold">{fmtPct(reportData.avgPost)}</div>
                            </div>
                             <div className={`p-4 rounded-lg ${getScoreColorClass(reportData.improvement, 'improvement')}`}>
                                <div className="text-sm font-semibold">Avg Improvement</div>
                                <div className="text-2xl font-bold">{fmtPct(reportData.improvement)}</div>
                            </div>
                        </div>
                    </Card>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 gap-6">
                        <Card>
                             <div id="compiled-state-chart" className="p-2">
                                <h3 className="text-xl font-bold mb-4">Performance by State</h3>
                                <div className="h-80">
                                    <Bar data={stateChartData} options={chartOptions} />
                                </div>
                             </div>
                        </Card>
                    </div>

                    {/* Detailed Course List Table */}
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Course Performance List</h3>
                        <Table headers={['Type', 'State', 'Locality', 'Date', '# Pax', 'Pre-Test', 'Post-Test', 'Improvement']}>
                            {reportData.courseList.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 border-b text-sm font-semibold">{c.type}</td>
                                    <td className="p-3 border-b text-sm">{c.state}</td>
                                    <td className="p-3 border-b text-sm">{c.locality}</td>
                                    <td className="p-3 border-b text-sm whitespace-nowrap">{c.date}</td>
                                    <td className="p-3 border-b text-sm text-center">{c.pax}</td>
                                    <td className="p-3 border-b text-center">{fmtPct(c.avgPre)}</td>
                                    <td className="p-3 border-b text-center">{fmtPct(c.avgPost)}</td>
                                    <td className={`p-3 border-b text-center font-bold ${getScoreColorClass(c.improvement, 'improvement')}`}>
                                        {fmtPct(c.improvement)}
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </Card>
                </>
            )}
        </div>
    );
}