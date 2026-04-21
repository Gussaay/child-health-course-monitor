import React, { useState, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
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

const fmtPct = (value) => (isNaN(value) || value === null ? 'N/A' : `+${value.toFixed(2)}%`);
const fmtCurrency = (value) => (isNaN(value) || value === null ? '$0' : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);

export default function CompiledReportView({ allCourses, allParticipants, allHealthFacilities = [] }) {
    // --- State ---
    const [filterType, setFilterType] = useState('IMNCI'); 
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

    // --- Aggregation Logic ---
    const reportData = useMemo(() => {
        const totalCourses = filteredCourses.length;
        const totalParticipants = filteredParticipants.length;
        
        const validPreScores = filteredParticipants.map(p => Number(p.pre_test_score)).filter(s => !isNaN(s) && s > 0);
        const validPostScores = filteredParticipants.map(p => Number(p.post_test_score)).filter(s => !isNaN(s) && s > 0);
        
        const avgPre = validPreScores.length ? (validPreScores.reduce((a,b)=>a+b,0)/validPreScores.length) : 0;
        const avgPost = validPostScores.length ? (validPostScores.reduce((a,b)=>a+b,0)/validPostScores.length) : 0;
        const improvement = avgPre > 0 ? ((avgPost - avgPre) / avgPre) * 100 : 0;

        // KPIs: Budget, Coverage & Investment Metrics
        const totalBudget = filteredCourses.reduce((sum, c) => sum + (Number(c.course_budget) || 0), 0);
        
        const uniqueNewFacilities = new Set(
            filteredParticipants
                .filter(p => p.introduced_imci_to_facility === true || p.introduced_imci_to_facility === "true")
                .map(p => `${p.state}-${p.locality}-${p.center_name}`)
        );
        const totalNewFacilities = uniqueNewFacilities.size;

        const costPerParticipant = totalParticipants > 0 ? totalBudget / totalParticipants : 0;
        const costPerNewFacility = totalNewFacilities > 0 ? totalBudget / totalNewFacilities : 0;

        // Aggregation by State 
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

        // Course List Data with Coverage Percentages
        const courseList = filteredCourses.map(c => {
            const coursePax = allParticipants.filter(p => p.courseId === c.id);
            const cPre = coursePax.map(p => Number(p.pre_test_score)).filter(s=>s>0);
            const cPost = coursePax.map(p => Number(p.post_test_score)).filter(s=>s>0);
            const cAvgPre = cPre.length ? cPre.reduce((a,b)=>a+b,0)/cPre.length : 0;
            const cAvgPost = cPost.length ? cPost.reduce((a,b)=>a+b,0)/cPost.length : 0;
            const cImp = cAvgPre > 0 ? ((cAvgPost - cAvgPre)/cAvgPre)*100 : 0;

            const cNewFacs = new Set(
                coursePax
                    .filter(p => p.introduced_imci_to_facility === true || p.introduced_imci_to_facility === "true")
                    .map(p => p.center_name || p.health_facility)
            ).size;

            // Coverage Percentage Calculations
            const totalFacsNational = allHealthFacilities.length;
            const totalFacsInState = allHealthFacilities.filter(f => f['الولاية'] === c.state).length;
            const totalFacsInLocality = allHealthFacilities.filter(f => f['الولاية'] === c.state && f['المحلية'] === c.locality).length;

            const locCovInc = totalFacsInLocality > 0 ? (cNewFacs / totalFacsInLocality) * 100 : null;
            const stateCovInc = totalFacsInState > 0 ? (cNewFacs / totalFacsInState) * 100 : null;
            const natCovInc = totalFacsNational > 0 ? (cNewFacs / totalFacsNational) * 100 : null;

            return {
                id: c.id,
                type: c.course_type,
                state: c.state,
                locality: c.locality,
                date: c.start_date,
                partner: c.funded_by || 'N/A',
                budget: Number(c.course_budget) || 0,
                coverageAdded: cNewFacs,
                locCovInc,
                stateCovInc,
                natCovInc,
                pax: coursePax.length,
                avgPre: cAvgPre,
                avgPost: cAvgPost,
                improvement: cImp
            };
        }).sort((a, b) => b.coverageAdded - a.coverageAdded); // Sort by coverage descending

        return { 
            totalCourses, totalParticipants, totalBudget, totalNewFacilities, 
            costPerParticipant, costPerNewFacility,
            avgPre, avgPost, improvement, statePerformance, courseList 
        };
    }, [filteredCourses, filteredParticipants, allParticipants, allHealthFacilities]);

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

    // --- PDF Export ---
    const handlePdfExport = async () => {
        setIsGeneratingPdf(true);
        const doc = new jsPDF('landscape', 'mm', 'a4'); 
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

        // KPIs
        autoTable(doc, {
            startY: y,
            head: [['Total Courses', 'Total Pax', 'Total Budget', 'New Coverage', 'Cost/Pax', 'Cost/New Center', 'Avg Pre', 'Avg Post', 'Imp.']],
            body: [[
                reportData.totalCourses,
                reportData.totalParticipants,
                fmtCurrency(reportData.totalBudget),
                reportData.totalNewFacilities,
                fmtCurrency(reportData.costPerParticipant),
                fmtCurrency(reportData.costPerNewFacility),
                `${reportData.avgPre.toFixed(1)}%`,
                `${reportData.avgPost.toFixed(1)}%`,
                `${reportData.improvement.toFixed(1)}%`
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
            
            if (y > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                y = 15;
            }
        }

        // Course List Table
        doc.text("Course Performance & Investment List", margin, y);
        y += 5;
        
        autoTable(doc, {
            startY: y,
            head: [['State', 'Locality', 'Partner', 'Budget', 'New Facs', '+Loc Cov%', '+State Cov%', '+Nat Cov%', 'Pax', 'Pre', 'Post', 'Imp.']],
            body: reportData.courseList.map(c => [
                c.state,
                c.locality,
                c.partner,
                fmtCurrency(c.budget),
                c.coverageAdded,
                fmtPct(c.locCovInc),
                fmtPct(c.stateCovInc),
                fmtPct(c.natCovInc),
                c.pax,
                `${c.avgPre.toFixed(1)}%`,
                `${c.avgPost.toFixed(1)}%`,
                `${c.improvement.toFixed(1)}%`
            ]),
            styles: { font: 'Amiri', fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 11) { 
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
                    {/* Expanded KPI Section */}
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Performance & Investment Overview</h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center mb-4">
                             <div className="p-4 bg-gray-100 rounded-lg">
                                <div className="text-sm font-semibold text-gray-600">Total Courses</div>
                                <div className="text-2xl font-bold text-sky-700">{reportData.totalCourses}</div>
                            </div>
                            <div className="p-4 bg-gray-100 rounded-lg">
                                <div className="text-sm font-semibold text-gray-600">Total Participants</div>
                                <div className="text-2xl font-bold text-sky-700">{reportData.totalParticipants}</div>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="text-sm font-semibold text-blue-700">Total Investment</div>
                                <div className="text-2xl font-bold text-blue-800">{fmtCurrency(reportData.totalBudget)}</div>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                <div className="text-sm font-semibold text-green-700">New Facilities Reached</div>
                                <div className="text-2xl font-bold text-green-800">{reportData.totalNewFacilities}</div>
                            </div>
                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                                <div className="text-sm font-semibold text-yellow-700">Cost / Participant</div>
                                <div className="text-2xl font-bold text-yellow-800">{fmtCurrency(reportData.costPerParticipant)}</div>
                            </div>
                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                                <div className="text-sm font-semibold text-purple-700">Cost / New Center</div>
                                <div className="text-2xl font-bold text-purple-800">{fmtCurrency(reportData.costPerNewFacility)}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center border-t border-gray-200 pt-4">
                            <div className="p-4 bg-gray-100 rounded-lg">
                                <div className="text-sm font-semibold text-gray-600">Avg Pre-Test</div>
                                <div className="text-2xl font-bold">{`${reportData.avgPre.toFixed(1)}%`}</div>
                            </div>
                             <div className="p-4 bg-gray-100 rounded-lg">
                                <div className="text-sm font-semibold text-gray-600">Avg Post-Test</div>
                                <div className="text-2xl font-bold">{`${reportData.avgPost.toFixed(1)}%`}</div>
                            </div>
                             <div className={`p-4 rounded-lg ${getScoreColorClass(reportData.improvement, 'improvement')}`}>
                                <div className="text-sm font-semibold">Avg Improvement</div>
                                <div className="text-2xl font-bold">{`${reportData.improvement.toFixed(1)}%`}</div>
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
                        <h3 className="text-xl font-bold mb-4">Course Performance & Investment List</h3>
                        <div className="overflow-x-auto">
                            <Table headers={['Type', 'State', 'Locality', 'Partner', 'Budget', 'New Facs', '+ Loc Cov.', '+ State Cov.', '+ Nat Cov.', '# Pax', 'Pre', 'Post', 'Imp.']}>
                                {reportData.courseList.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3 border-b text-sm font-semibold">{c.type}</td>
                                        <td className="p-3 border-b text-sm">{c.state}</td>
                                        <td className="p-3 border-b text-sm">{c.locality}</td>
                                        <td className="p-3 border-b text-sm text-gray-700">{c.partner}</td>
                                        <td className="p-3 border-b text-sm font-medium text-gray-900">{fmtCurrency(c.budget)}</td>
                                        <td className="p-3 border-b text-sm text-center font-bold text-green-700">{c.coverageAdded}</td>
                                        <td className="p-3 border-b text-sm text-center font-medium text-green-600">{fmtPct(c.locCovInc)}</td>
                                        <td className="p-3 border-b text-sm text-center font-medium text-green-600">{fmtPct(c.stateCovInc)}</td>
                                        <td className="p-3 border-b text-sm text-center font-medium text-green-600">{fmtPct(c.natCovInc)}</td>
                                        <td className="p-3 border-b text-sm text-center">{c.pax}</td>
                                        <td className="p-3 border-b text-center">{`${c.avgPre.toFixed(1)}%`}</td>
                                        <td className="p-3 border-b text-center">{`${c.avgPost.toFixed(1)}%`}</td>
                                        <td className={`p-3 border-b text-center font-bold ${getScoreColorClass(c.improvement, 'improvement')}`}>
                                            {`${c.improvement.toFixed(1)}%`}
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}