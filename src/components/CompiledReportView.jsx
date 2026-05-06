import React, { useState, useMemo } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from 'html2canvas';

// Reusing components and styles from your ecosystem
import { Card, Button, Table, EmptyState, Spinner, PdfIcon } from './CommonComponents'; 
import { amiriFontBase64 } from './AmiriFont.js'; 

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
    const [filterType, setFilterType] = useState('All'); 
    const [filterSubType, setFilterSubType] = useState('All');
    const [filterState, setFilterState] = useState('All');
    const [yearFilter, setYearFilter] = useState('All');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // --- Derived Data: Filter Options ---
    const courseTypes = useMemo(() => ['All', ...new Set(allCourses.map(c => c.course_type).filter(Boolean))].sort(), [allCourses]);
    const subTypes = useMemo(() => {
        if (filterType === 'All') return ['All'];
        return ['All', ...new Set(allCourses.filter(c => c.course_type === filterType).map(c => c.imci_sub_type).filter(Boolean))].sort();
    }, [allCourses, filterType]);
    const states = useMemo(() => {
        const s = new Set();
        allCourses.forEach(c => {
            if (c.states && Array.isArray(c.states)) c.states.forEach(st => s.add(st));
            else if (c.state) c.state.split(',').forEach(st => s.add(st.trim()));
        });
        return ['All', ...Array.from(s).sort()];
    }, [allCourses]);
    const years = useMemo(() => ['All', ...new Set(allCourses.map(c => new Date(c.start_date).getFullYear()).filter(Boolean))].sort(), [allCourses]);

    // --- Derived Data: Filtered Lists ---
    const filteredCourses = useMemo(() => {
        return allCourses.filter(c => {
            const cDate = new Date(c.start_date);
            const matchType = filterType === 'All' || c.course_type === filterType;
            const matchSubType = filterSubType === 'All' || c.imci_sub_type === filterSubType;
            
            // Check state array for multiple states per course
            const cStates = c.states || (c.state ? c.state.split(',').map(s=>s.trim()) : []);
            const matchState = filterState === 'All' || cStates.includes(filterState);
            
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
        
        // Performance KPIs breakdown
        const allCourseTypesList = [...new Set(allCourses.map(c => c.course_type).filter(Boolean))].sort();
        const courseCountsByType = {};
        allCourseTypesList.forEach(t => {
            courseCountsByType[t] = filteredCourses.filter(c => c.course_type === t).length;
        });

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
        
        const totalFacsNationalOverall = allHealthFacilities.length;
        const overallNatCovInc = totalFacsNationalOverall > 0 ? (totalNewFacilities / totalFacsNationalOverall) * 100 : 0;

        // Number of Courses by State (Table Data)
        const allStatesInFilter = [...new Set(filteredCourses.flatMap(c => c.states || (c.state ? c.state.split(',').map(s=>s.trim()) : [])))].filter(Boolean).sort();
        const allCourseTypesInFilter = [...new Set(filteredCourses.map(c => c.course_type))].filter(Boolean).sort();
        const dataByState = {};
        const totalCounts = {};

        filteredCourses.forEach(c => {
            const type = c.course_type || 'Unknown';
            const cStates = c.states || (c.state ? c.state.split(',').map(s=>s.trim()) : []);
            cStates.forEach(state => {
                if (!state) return;
                if (!dataByState[state]) dataByState[state] = {};
                dataByState[state][type] = (dataByState[state][type] || 0) + 1;
                totalCounts[state] = (totalCounts[state] || 0) + 1;
            });
        });

        const coursesByStateHeaders = ["State", ...allCourseTypesInFilter, "Total"];
        const coursesByStateBody = allStatesInFilter.map(state => {
            const row = [state];
            allCourseTypesInFilter.forEach(type => row.push(dataByState[state]?.[type] || 0));
            row.push(totalCounts[state] || 0);
            return row;
        });

        const coursesByStateTotals = ["Total"];
        allCourseTypesInFilter.forEach(type => {
            coursesByStateTotals.push(Object.values(dataByState).reduce((acc, stateData) => acc + (stateData[type] || 0), 0));
        });
        coursesByStateTotals.push(coursesByStateTotals.slice(1).reduce((acc, sum) => acc + sum, 0));


        // Course List Data with Coverage Percentages (No Pre/Post/Imp)
        const courseList = filteredCourses.map(c => {
            const coursePax = allParticipants.filter(p => p.courseId === c.id);
            const cStates = c.states || (c.state ? c.state.split(',').map(s=>s.trim()) : []);
            const cLocalities = c.localities || (c.locality ? c.locality.split(',').map(l=>l.trim()) : []);
            
            const cNewFacs = new Set(
                coursePax
                    .filter(p => p.introduced_imci_to_facility === true || p.introduced_imci_to_facility === "true")
                    .map(p => p.center_name || p.health_facility)
            ).size;

            // Coverage Percentage Calculations
            const totalFacsNational = allHealthFacilities.length;
            
            // Average coverage increase if multiple states/localities are selected
            let stateCovInc = null;
            if (cStates.length > 0 && totalFacsNational > 0) {
                const totalFacsInStates = allHealthFacilities.filter(f => cStates.includes(f['الولاية'])).length;
                stateCovInc = totalFacsInStates > 0 ? (cNewFacs / totalFacsInStates) * 100 : null;
            }

            let locCovInc = null;
            if (cLocalities.length > 0 && cStates.length > 0 && totalFacsNational > 0) {
                const totalFacsInLocalities = allHealthFacilities.filter(f => cStates.includes(f['الولاية']) && cLocalities.includes(f['المحلية'])).length;
                locCovInc = totalFacsInLocalities > 0 ? (cNewFacs / totalFacsInLocalities) * 100 : null;
            }

            const natCovInc = totalFacsNational > 0 ? (cNewFacs / totalFacsNational) * 100 : null;

            return {
                id: c.id,
                type: c.course_type,
                state: cStates.join(', '),
                locality: cLocalities.join(', '),
                date: c.start_date,
                partner: c.funded_by || 'N/A',
                budget: Number(c.course_budget) || 0,
                coverageAdded: cNewFacs,
                locCovInc,
                stateCovInc,
                natCovInc,
                pax: coursePax.length
            };
        }).sort((a, b) => b.coverageAdded - a.coverageAdded); // Sort by coverage descending

        return { 
            totalCourses, totalParticipants, totalBudget, totalNewFacilities, 
            costPerParticipant, costPerNewFacility, overallNatCovInc,
            avgPre, avgPost, improvement, 
            allCourseTypesList, courseCountsByType,
            coursesByStateHeaders, coursesByStateBody, coursesByStateTotals,
            courseList 
        };
    }, [filteredCourses, filteredParticipants, allParticipants, allHealthFacilities]);

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
        doc.text(`Courses Dashboard Report: ${filterType}`, margin, y);
        y += 8;
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Filters: ${filterState} | ${filterSubType} | Year: ${yearFilter}`, margin, y);
        y += 15;

        // Performance KPIs
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Performance KPIs", margin, y);
        y += 5;
        const perfHead = ['Total Courses', 'Total Pax', ...reportData.allCourseTypesList, 'Avg Pre', 'Avg Post', 'Avg Imp.'];
        const perfBody = [
            reportData.totalCourses,
            reportData.totalParticipants,
            ...reportData.allCourseTypesList.map(t => reportData.courseCountsByType[t] || 0),
            `${reportData.avgPre.toFixed(1)}%`,
            `${reportData.avgPost.toFixed(1)}%`,
            `${reportData.improvement.toFixed(1)}%`
        ];

        autoTable(doc, {
            startY: y,
            head: [perfHead],
            body: [perfBody],
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], halign: 'center' },
            bodyStyles: { halign: 'center', fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 10;

        // Coverage & Investment KPIs
        doc.text("Coverage & Investment KPIs", margin, y);
        y += 5;
        autoTable(doc, {
            startY: y,
            head: [['Total Budget', 'New Coverage', 'Nat Cov. Increase', 'Cost/Pax', 'Cost/New Center']],
            body: [[
                fmtCurrency(reportData.totalBudget),
                reportData.totalNewFacilities,
                `+${reportData.overallNatCovInc.toFixed(4)}%`,
                fmtCurrency(reportData.costPerParticipant),
                fmtCurrency(reportData.costPerNewFacility)
            ]],
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], halign: 'center' },
            bodyStyles: { halign: 'center', fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 15;

        // Courses By State Table
        doc.text("Number of Courses by State", margin, y);
        y += 5;
        autoTable(doc, {
            startY: y,
            head: [reportData.coursesByStateHeaders],
            body: reportData.coursesByStateBody,
            foot: [reportData.coursesByStateTotals],
            theme: 'grid',
            styles: { font: 'Amiri' },
            headStyles: { fillColor: [41, 128, 185], halign: 'center' },
            bodyStyles: { halign: 'center' },
            footStyles: { fillColor: [229, 231, 235], textColor: [0,0,0], fontStyle: 'bold', halign: 'center' }
        });
        y = doc.lastAutoTable.finalY + 15;

        if (y > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            y = 15;
        }

        // Course List Table
        doc.text("Course Performance & Investment List", margin, y);
        y += 5;
        
        autoTable(doc, {
            startY: y,
            head: [['Type', 'State', 'Locality', 'Partner', 'Budget', 'New Facs', '+Loc Cov%', '+State Cov%', '+Nat Cov%', 'Pax']],
            body: reportData.courseList.map(c => [
                c.type,
                c.state,
                c.locality,
                c.partner,
                fmtCurrency(c.budget),
                c.coverageAdded,
                fmtPct(c.locCovInc),
                fmtPct(c.stateCovInc),
                fmtPct(c.natCovInc),
                c.pax
            ]),
            styles: { font: 'Amiri', fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`Courses_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
        setIsGeneratingPdf(false);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Courses Dashboard</h2>
                    <p className="text-sm text-gray-500">
                        Consolidated performance, coverage, and investment overview.
                    </p>
                </div>
                <Button onClick={handlePdfExport} disabled={isGeneratingPdf || filteredCourses.length === 0} variant="secondary">
                    {isGeneratingPdf ? <Spinner size="sm" /> : <><PdfIcon className="w-4 h-4 mr-2"/> Export Report</>}
                </Button>
            </div>

            {/* Row 1: Filters */}
            <Card className="bg-gray-50 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormGroup label="Course Type">
                        <Select value={filterType} onChange={e => { setFilterType(e.target.value); setFilterSubType('All'); }}>
                            {courseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Sub-Type">
                        <Select value={filterSubType} onChange={e => setFilterSubType(e.target.value)} disabled={filterType === 'All'}>
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
                    {/* Row 2: Performance KPIs */}
                    <Card>
                        <h3 className="text-xl font-bold mb-4 border-b pb-2">Performance KPIs</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 text-center mb-6">
                            <div className="p-4 bg-gray-100 rounded-lg border border-gray-200">
                                <div className="text-sm font-semibold text-gray-600">Total Courses</div>
                                <div className="text-2xl font-bold text-sky-700">{reportData.totalCourses}</div>
                            </div>
                            <div className="p-4 bg-gray-100 rounded-lg border border-gray-200">
                                <div className="text-sm font-semibold text-gray-600">Total Participants</div>
                                <div className="text-2xl font-bold text-sky-700">{reportData.totalParticipants}</div>
                            </div>
                            {reportData.allCourseTypesList.map(type => (
                                <div key={type} className="p-4 bg-gray-100 rounded-lg border border-gray-200">
                                    <div className="text-sm font-semibold text-gray-600">{type}</div>
                                    <div className="text-2xl font-bold text-sky-700">{reportData.courseCountsByType[type] || 0}</div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="text-sm font-semibold text-gray-600">Avg Pre-Test</div>
                                <div className="text-2xl font-bold">{`${reportData.avgPre.toFixed(1)}%`}</div>
                            </div>
                             <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="text-sm font-semibold text-gray-600">Avg Post-Test</div>
                                <div className="text-2xl font-bold">{`${reportData.avgPost.toFixed(1)}%`}</div>
                            </div>
                             <div className={`p-4 rounded-lg border ${getScoreColorClass(reportData.improvement, 'improvement')}`}>
                                <div className="text-sm font-semibold">Avg Improvement</div>
                                <div className="text-2xl font-bold">{`${reportData.improvement.toFixed(1)}%`}</div>
                            </div>
                        </div>
                    </Card>

                    {/* Row 3: Coverage KPIs */}
                    <Card>
                        <h3 className="text-xl font-bold mb-4 border-b pb-2">Coverage KPIs</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                <div className="text-sm font-semibold text-green-700">New Facilities Reached</div>
                                <div className="text-3xl font-bold text-green-800">{reportData.totalNewFacilities}</div>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                <div className="text-sm font-semibold text-green-700">National Coverage Increase</div>
                                <div className="text-3xl font-bold text-green-800">+{reportData.overallNatCovInc.toFixed(4)}%</div>
                            </div>
                        </div>
                    </Card>

                    {/* Row 4: Investment KPIs */}
                    <Card>
                        <h3 className="text-xl font-bold mb-4 border-b pb-2">Investment KPIs</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="text-sm font-semibold text-blue-700">Total Investment</div>
                                <div className="text-2xl font-bold text-blue-800">{fmtCurrency(reportData.totalBudget)}</div>
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
                    </Card>

                    {/* Row 5: Number of Courses by State */}
                    <Card className="p-0 overflow-hidden">
                        <h4 className="font-semibold text-xl pl-4 pt-4 mb-4 border-b pb-2">Number of Courses by State</h4>
                        <div className="overflow-x-auto px-4 pb-4">
                            <Table headers={reportData.coursesByStateHeaders}>
                                {reportData.coursesByStateBody.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        {row.map((cell, cellIndex) => (
                                            <td key={cellIndex} className="p-2 border text-center">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                                <tr className="font-bold bg-gray-100">
                                    {reportData.coursesByStateTotals.map((cell, index) => (
                                        <td key={index} className="p-2 border text-center">{cell}</td>
                                    ))}
                                </tr>
                            </Table>
                        </div>
                    </Card>

                    {/* Row 6: Detailed Course List Table */}
                    <Card>
                        <h3 className="text-xl font-bold mb-4 border-b pb-2">Course Performance & Investment List</h3>
                        <div className="overflow-x-auto">
                            <Table headers={['Type', 'State', 'Locality', 'Partner', 'Budget', 'New Facs', '+ Loc Cov.', '+ State Cov.', '+ Nat Cov.', '# Pax']}>
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
                                        <td className="p-3 border-b text-sm text-center font-medium">{c.pax}</td>
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
