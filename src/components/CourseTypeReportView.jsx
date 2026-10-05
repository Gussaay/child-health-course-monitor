// CourseTypeReportView.jsx
//
// The comprehensive report for one course type: the single Course Report's
// sections, aggregated over every course that passes the filters (state,
// locality, date range, project, sub-course, partner).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RefreshCw } from 'lucide-react';

import { Button, Card, PdfIcon, Spinner, Table } from './CommonComponents';
import { amiriFontBase64 } from './AmiriFont.js';
import { listAllDataForCourse, listParticipantTestsForCourse } from '../data.js';
import { buildEmoncModuleTestSummary } from './CourseReportView';
import { isEencOnlyCourse } from './CourseTestForm';
import { notify } from './dialogs';
import {
    ALL, buildFilterOptions, filterCourses, filterParticipants, buildCourseTypeReport,
    mergeEmoncModuleSummaries, formatMonth,
} from './courseTypeReport';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

// Observations, cases and EmONC test records per course, kept for the session
// so moving between filters only fetches courses not seen yet.
const practicalCache = new Map();
const testsCache = new Map();
const FETCH_CONCURRENCY = 4;

const runPool = async (items, worker, onProgress) => {
    let next = 0;
    let done = 0;
    const runners = Array.from({ length: Math.min(FETCH_CONCURRENCY, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++];
            await worker(item);
            onProgress?.(++done);
        }
    });
    await Promise.all(runners);
};

// --- Formatting ---
const fmtPct = (v) => (v === null || v === undefined || isNaN(v) ? 'N/A' : `${Number(v).toFixed(1)}%`);
const fmtNum = (v, digits = 1) => (v === null || v === undefined || isNaN(v) ? 'N/A' : Number(v).toFixed(digits));
const fmtMoney = (v) => `$${Math.round(Number(v) || 0).toLocaleString()}`;
const fmtCount = (correct, total) => (total > 0 ? `${total} (${fmtPct((correct / total) * 100)})` : '-');

const scoreClass = (value, type = 'percentage') => {
    if (value === null || value === undefined || isNaN(value)) return 'bg-gray-700 text-white';
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

const CATEGORY_CLASSES = {
    Perfect: 'bg-green-200 text-green-800',
    Excellent: 'bg-yellow-200 text-yellow-800',
    Good: 'bg-gray-200 text-gray-800',
    Fair: 'bg-orange-200 text-orange-800',
    Fail: 'bg-red-200 text-red-800',
    'Data Incomplete': 'bg-gray-700 text-white',
};

const EMONC_MODULE_STYLES = {
    'Emergency Newborn Care': { header: 'bg-sky-600 text-white', border: 'border-sky-300', light: 'bg-sky-50' },
    'Emergency Maternal Care': { header: 'bg-rose-600 text-white', border: 'border-rose-300', light: 'bg-rose-50' },
};

const BREAKDOWNS = [
    { key: 'byState', label: 'State' },
    { key: 'byLocality', label: 'Locality' },
    { key: 'bySubType', label: 'Sub-course' },
    { key: 'byProject', label: 'Project' },
    { key: 'byPartner', label: 'Funded by' },
    { key: 'byYear', label: 'Year' },
];


// --- Small presentational pieces ---
const Kpi = ({ label, value, className = 'bg-gray-100', valueClass = 'text-sky-700' }) => (
    <div className={`flex flex-col items-center justify-center p-4 rounded-lg text-center w-full ${className}`}>
        <div className="text-sm font-semibold opacity-80">{label}</div>
        <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
);

const Section = ({ title, subtitle, children, actions }) => (
    <Card>
        <div className="p-4 w-full max-w-full min-w-0">
            <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                <div>
                    <h3 className="text-xl font-bold">{title}</h3>
                    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                </div>
                {actions}
            </div>
            {children}
        </div>
    </Card>
);

const FilterSelect = ({ label, value, onChange, options, disabled }) => (
    <div className="flex flex-col gap-1">
        <label className="font-semibold text-gray-700 text-sm">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || options.length <= 1}
            className="border border-gray-300 rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-sky-500 disabled:bg-gray-100"
        >
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);

// Months that have courses, picked from a list rather than typed.
const MonthSelect = ({ label, value, onChange, months }) => (
    <div className="flex flex-col gap-1">
        <label className="font-semibold text-gray-700 text-sm">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={months.length === 0}
            className="border border-gray-300 rounded-md p-2 w-full text-sm focus:ring-2 focus:ring-sky-500 disabled:bg-gray-100"
        >
            <option value="">Any</option>
            {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
    </div>
);

const DistributionBar = ({ distribution }) => {
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    if (!total) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {Object.entries(distribution).map(([name, count]) => (
                <span key={name} className={`px-3 py-1 rounded-full text-xs font-bold ${CATEGORY_CLASSES[name]}`}>
                    {name}: {count} ({fmtPct((count / total) * 100)})
                </span>
            ))}
        </div>
    );
};

const chartOptions = (title, xTitle) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'top' },
        title: { display: true, text: title },
        datalabels: { anchor: 'end', align: 'top', formatter: (v) => (v > 0 ? (Number.isInteger(v) ? v : v.toFixed(1)) : ''), font: { weight: 'bold', size: 10 }, color: '#000' },
    },
    scales: { x: xTitle ? { title: { display: true, text: xTitle } } : {}, y: { beginAtZero: true } },
});

export default function CourseTypeReportView({
    courseType, courses: availableCourses = [], participants: allParticipants = [], healthFacilities = [],
    initialFilters = {}, onOpenCourseReport, onBack,
}) {
    const [filters, setFilters] = useState({
        state: ALL, locality: ALL, subType: ALL, project: ALL, partner: ALL, dateFrom: '', dateTo: '',
        ...initialFilters,
    });
    const setFilter = (key, value) => setFilters((prev) => ({
        ...prev,
        [key]: value,
        // A locality only makes sense inside its state.
        ...(key === 'state' ? { locality: ALL } : {}),
    }));
    const resetFilters = () => setFilters({ state: ALL, locality: ALL, subType: ALL, project: ALL, partner: ALL, dateFrom: '', dateTo: '' });

    const filterOptions = useMemo(() => buildFilterOptions(availableCourses, { state: filters.state }), [availableCourses, filters.state]);
    const courses = useMemo(() => filterCourses(availableCourses, filters), [availableCourses, filters]);
    const participants = useMemo(() => filterParticipants(allParticipants, courses, { subType: filters.subType }), [allParticipants, courses, filters.subType]);

    // --- Load observations / cases (and EmONC test records) for the filtered courses ---
    const isEmoncType = courseType === 'EmONC' || courseType === 'EENC'
        || courses.some((c) => c.course_type === 'EmONC' || c.course_type === 'EENC');
    const [loadTick, setLoadTick] = useState(0);
    const [loading, setLoading] = useState({ active: false, done: 0, total: 0 });
    const [failedCourses, setFailedCourses] = useState(0);
    const loadRun = useRef(0);

    useEffect(() => {
        const runId = ++loadRun.current;
        const needPractical = courses.filter((c) => !practicalCache.has(c.id));
        const needTests = isEmoncType
            ? courses.filter((c) => (c.course_type === 'EmONC' || c.course_type === 'EENC') && !testsCache.has(c.id))
            : [];
        const jobs = [
            ...needPractical.map((c) => ({ kind: 'practical', course: c })),
            ...needTests.map((c) => ({ kind: 'tests', course: c })),
        ];
        if (jobs.length === 0) { setLoading({ active: false, done: 0, total: 0 }); return; }

        setLoading({ active: true, done: 0, total: jobs.length });
        let failed = 0;
        runPool(jobs, async ({ kind, course }) => {
            try {
                if (kind === 'practical') {
                    const data = await listAllDataForCourse(course.id);
                    practicalCache.set(course.id, { allObs: data?.allObs || [], allCases: data?.allCases || [] });
                } else {
                    const tests = await listParticipantTestsForCourse(course.id);
                    testsCache.set(course.id, (tests || []).filter((t) => t.isDeleted !== true && t.isDeleted !== 'true'));
                }
            } catch (e) {
                console.error(`Comprehensive report: failed to load ${kind} for course ${course.id}`, e);
                failed++;
            }
        }, (done) => {
            if (loadRun.current === runId) setLoading({ active: true, done, total: jobs.length });
        }).then(() => {
            if (loadRun.current !== runId) return;
            setFailedCourses(failed);
            setLoading({ active: false, done: jobs.length, total: jobs.length });
        });
    }, [courses, isEmoncType, loadTick]);

    const handleRefresh = () => {
        courses.forEach((c) => { practicalCache.delete(c.id); testsCache.delete(c.id); });
        setLoadTick((t) => t + 1);
    };

    const { observations, cases } = useMemo(() => {
        const obs = [];
        const cs = [];
        courses.forEach((c) => {
            const data = practicalCache.get(c.id);
            if (!data) return;
            obs.push(...data.allObs);
            cs.push(...data.allCases);
        });
        return { observations: obs, cases: cs };
        // loading.active flips when the cache fills, which is what should re-run this.
    }, [courses, loading.active]); // eslint-disable-line react-hooks/exhaustive-deps

    const report = useMemo(
        () => buildCourseTypeReport({ courses, participants, observations, cases, facilities: healthFacilities }),
        [courses, participants, observations, cases, healthFacilities],
    );

    const emoncSummary = useMemo(() => {
        if (!isEmoncType) return null;
        const perCourse = courses
            .filter((c) => testsCache.has(c.id))
            .map((c) => ({
                course: c,
                summary: buildEmoncModuleTestSummary(c, participants.filter((p) => p.courseId === c.id), testsCache.get(c.id)),
            }));
        return mergeEmoncModuleSummaries(perCourse);
    }, [isEmoncType, courses, participants, loading.active]); // eslint-disable-line react-hooks/exhaustive-deps

    // EmONC practical parts are only meaningful when a full EmONC course is in the report.
    const showEmoncParts = isEmoncType && courses.some((c) => !isEencOnlyCourse(c, participants.filter((p) => p.courseId === c.id)));
    const showEencOnly = isEmoncType && !showEmoncParts;

    const [breakdownKey, setBreakdownKey] = useState('byState');
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

    // --- Charts ---
    const { groups, groupPerformance, days, dailyPerformance, breakdowns } = report;
    const groupChart = {
        labels: groups,
        datasets: [
            { label: 'Total Cases', data: groups.map((g) => groupPerformance[g].totalCases), backgroundColor: '#3b82f6' },
            { label: 'Total Correct Cases', data: groups.map((g) => groupPerformance[g].correctCases), backgroundColor: '#10b981' },
        ],
    };
    const dayTotal = (day, key) => groups.reduce((s, g) => s + (dailyPerformance[day]?.[g]?.[key] || 0), 0);
    const dailyChart = {
        labels: days,
        datasets: [
            { label: 'Total Cases', data: days.map((d) => dayTotal(d, 'cases')), backgroundColor: '#3b82f6' },
            { label: 'Total Correct Cases', data: days.map((d) => dayTotal(d, 'correctCases')), backgroundColor: '#10b981' },
        ],
    };
    const activeBreakdown = breakdowns[breakdownKey] || [];
    const breakdownLabel = BREAKDOWNS.find((b) => b.key === breakdownKey)?.label || '';
    const breakdownChart = {
        labels: activeBreakdown.map((r) => r.key),
        datasets: [
            { label: 'Avg. Pre-Test %', data: activeBreakdown.map((r) => r.avgPre ?? 0), backgroundColor: '#6366f1' },
            { label: 'Avg. Post-Test %', data: activeBreakdown.map((r) => r.avgPost ?? 0), backgroundColor: '#10b981' },
            { label: 'Skill Correctness %', data: activeBreakdown.map((r) => r.skillPct ?? 0), backgroundColor: '#f59e0b' },
        ],
    };

    const filterSummary = [
        filters.state !== ALL && `State: ${filters.state}`,
        filters.locality !== ALL && `Locality: ${filters.locality}`,
        filters.subType !== ALL && `Sub-course: ${filters.subType}`,
        filters.project !== ALL && `Project: ${filters.project}`,
        filters.partner !== ALL && `Funded by: ${filters.partner}`,
        filters.dateFrom && `From: ${formatMonth(filters.dateFrom)}`,
        filters.dateTo && `To: ${formatMonth(filters.dateTo)}`,
    ].filter(Boolean).join(' | ') || 'All courses';

    // --- PDF export ---
    const handlePdf = async () => {
        setIsPdfGenerating(true);
        await new Promise((r) => setTimeout(r, 50));
        try {
            const doc = new jsPDF('landscape', 'mm', 'a4');
            doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
            doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
            doc.setFont('Amiri');
            const margin = 14;
            const pageHeight = doc.internal.pageSize.getHeight();
            let y = 15;
            const base = { theme: 'grid', styles: { font: 'Amiri', fontSize: 8 }, headStyles: { fillColor: [8, 145, 178], halign: 'center' }, margin: { left: margin, right: margin } };
            const heading = (text) => {
                if (y > pageHeight - 30) { doc.addPage(); y = 15; }
                doc.setFontSize(13); doc.setTextColor(0);
                doc.text(text, margin, y);
                y += 4;
            };
            const table = (head, body, extra = {}) => {
                autoTable(doc, { ...base, startY: y, head: [head], body, ...extra });
                y = doc.lastAutoTable.finalY + 8;
            };

            doc.setFontSize(18);
            doc.text(`Comprehensive Course Report: ${courseType}`, margin, y); y += 7;
            doc.setFontSize(10); doc.setTextColor(100);
            doc.text(`Filters: ${filterSummary}`, margin, y); y += 5;
            doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y); y += 8;

            const { summary, overall, investment, coverage } = report;
            heading('Summary');
            table(['Courses', 'Participants', 'Avg / Course', 'States', 'Localities', 'Period', 'Facilities'], [[
                summary.totalCourses, summary.totalParticipants, fmtNum(summary.avgParticipantsPerCourse),
                summary.states.length, summary.localities.length,
                summary.firstDate ? `${summary.firstDate} - ${summary.lastDate}` : '-', summary.facilitiesRepresented,
            ]]);

            if (report.hasCases || report.hasSkills) {
                heading('Key Performance Indicators');
                table(['Total Cases', 'Correct Cases', 'Avg Cases/Pax', 'Case Correctness', 'Total Skills', 'Correct Skills', 'Avg Skills/Pax', 'Skill Correctness'], [[
                    overall.totalCases, overall.correctCases, fmtNum(overall.avgCasesPerParticipant), fmtPct(overall.caseCorrectnessPercentage),
                    overall.totalSkills, overall.correctSkills, fmtNum(overall.avgSkillsPerParticipant), fmtPct(overall.skillCorrectnessPercentage),
                ]]);
            }

            if (report.hasTestScores) {
                heading('Participant Test Scores');
                table(['Avg Pre-Test', 'Avg Post-Test', 'Avg Improvement', 'Pre Median', 'Post Median', 'Pre Count', 'Post Count'], [[
                    fmtPct(report.preTestStats.avg), fmtPct(report.postTestStats.avg), fmtPct(report.totalImprovement),
                    fmtPct(report.preTestStats.median), fmtPct(report.postTestStats.median), report.preTestStats.count, report.postTestStats.count,
                ]]);
            }

            if (emoncSummary) {
                heading('Test Scores by EmONC Module');
                table(['Module', 'Participants', 'Avg Pre', 'Avg Post', 'Improvement', ...['Part 1', 'Part 2']], emoncSummary.modules.map((m) => [
                    m.label, m.stats.participantCount, fmtPct(m.stats.preAvg), fmtPct(m.stats.postAvg), fmtPct(m.stats.improvement),
                    ...[0, 1].map((i) => (m.parts[i] ? `${m.parts[i].shortTitle || m.parts[i].title}: ${fmtPct(m.parts[i].preAvg)} -> ${fmtPct(m.parts[i].postAvg)}` : '-')),
                ]));
            }

            heading('Investment');
            table(['Total Investment', 'Courses with Budget', 'Cost / Course', 'Cost / Participant', 'Cost / New PHC (IMNCI)'], [[
                fmtMoney(investment.totalBudget), investment.coursesWithBudget, fmtMoney(investment.costPerCourse),
                fmtMoney(investment.costPerParticipant), coverage.totalNewPhc > 0 ? fmtMoney(investment.costPerNewFacility) : 'N/A',
            ]]);

            if (coverage.coursesWithSnapshot > 0) {
                heading(`State Coverage Increase (PHC only) - total new PHCs: ${coverage.totalNewPhc}`);
                table(['State', 'Total PHCs', 'w/ IMNCI Before', 'Coverage Before', 'New PHCs', 'Coverage After', 'Increase'], [
                    ...coverage.stateCoverage.map((s) => [s.name, s.totalPhc, s.phcWithImnciBefore, fmtPct(s.covBefore), s.newPhc, fmtPct(s.covAfter), `+${s.increase.toFixed(2)}%`]),
                ]);
            }

            heading('Courses');
            table(['Date', 'State', 'Locality', 'Sub-course', 'Project', 'Funded by', 'Pax', 'Cases', 'Skills', 'Avg Pre', 'Avg Post', 'Improvement', 'Budget'],
                breakdowns.byCourse.map((c) => [c.date, c.state, c.locality, c.subTypes, c.project, c.partner, c.participants,
                    fmtCount(c.correctCases, c.cases), fmtCount(c.correctSkills, c.skills), fmtPct(c.avgPre), fmtPct(c.avgPost), fmtPct(c.improvement), fmtMoney(c.budget)]));

            BREAKDOWNS.forEach(({ key, label }) => {
                const rows = breakdowns[key];
                if (!rows.length) return;
                heading(`By ${label}`);
                table([label, 'Courses', 'Pax', 'Cases', 'Skills', 'Avg Pre', 'Avg Post', 'Improvement', 'Budget'],
                    rows.map((r) => [r.key, r.courses, r.participants, fmtCount(r.correctCases, r.cases), fmtCount(r.correctSkills, r.skills),
                        fmtPct(r.avgPre), fmtPct(r.avgPost), fmtPct(r.improvement), fmtMoney(r.budget)]));
            });

            if (groups.length && days.length) {
                [['Daily Case Performance', report.dailyCases], ['Daily Skill Performance', report.dailySkills]].forEach(([title, data]) => {
                    if (!data.totals.total) return;
                    heading(title);
                    table(['Day', ...groups, 'Total'], data.rows.map((r) => [r.day, ...groups.map((g) => fmtCount(r.cells[g].correct, r.cells[g].total)), fmtCount(r.correct, r.total)]),
                        { foot: [['Total', ...groups.map((g) => fmtCount(data.totals.cells[g].correct, data.totals.cells[g].total)), fmtCount(data.totals.correct, data.totals.total)]],
                          footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0] } });
                });
            }

            const ps = report.participantSummary;
            if (report.hasSkills || report.hasTestScores) {
                heading('Participant Results (overall)');
                table(['Participants', 'Practical Assessed', 'Avg Practical Score', 'Scored 90%+', 'With Pre & Post', 'Avg % Increase', 'Improved'], [[
                    ps.total, ps.practicalAssessed, fmtPct(ps.avgPracticalScore), fmtPct(ps.practicalPassRate),
                    ps.withBothTests, fmtPct(ps.avgIncrease), fmtPct(ps.improvedRate),
                ]]);
                const dist = (d) => Object.entries(d).map(([k, v]) => `${k}: ${v}`).join('   ');
                if (report.hasSkills) { doc.setFontSize(9); doc.text(`Practical categories - ${dist(report.practicalDistribution)}`, margin, y); y += 6; }
                if (report.hasTestScores) { doc.setFontSize(9); doc.text(`Improvement categories - ${dist(report.improvementDistribution)}`, margin, y); y += 8; }
            }

            const safeType = String(courseType || 'Courses').replace(/[^\w-]+/g, '_');
            doc.save(`Comprehensive_${safeType}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) {
            console.error('Failed to generate comprehensive report PDF', e);
            notify('Sorry, there was an error generating the PDF.', 'error');
        } finally {
            setIsPdfGenerating(false);
        }
    };

    const { summary, overall, investment, coverage } = report;


    return (
        <div className="flex flex-col gap-6 w-full max-w-full min-w-0">
            <div className="flex flex-wrap justify-between items-start gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Comprehensive {courseType} Report</h2>
                    <p className="text-sm text-gray-500 mt-1">Aggregated from {summary.totalCourses} course(s) &middot; {filterSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={handleRefresh} disabled={loading.active}><RefreshCw size={14} /> Reload Data</Button>
                    <Button variant="secondary" onClick={handlePdf} disabled={isPdfGenerating || loading.active || courses.length === 0}>
                        <PdfIcon /> {isPdfGenerating ? 'Generating…' : 'Export PDF'}
                    </Button>
                    {onBack && <Button onClick={onBack}>Back to Course List</Button>}
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-gray-50">
                <div className="p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-lg font-semibold">Filter Report</h4>
                        <button type="button" onClick={resetFilters} className="text-sm text-sky-700 hover:underline">Reset filters</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FilterSelect label="State" value={filters.state} onChange={(v) => setFilter('state', v)} options={filterOptions.states} />
                        <FilterSelect label="Locality" value={filters.locality} onChange={(v) => setFilter('locality', v)} options={filterOptions.localities} />
                        <FilterSelect label="Sub-course" value={filters.subType} onChange={(v) => setFilter('subType', v)} options={filterOptions.subTypes} />
                        <FilterSelect label="Project" value={filters.project} onChange={(v) => setFilter('project', v)} options={filterOptions.projects} />
                        <FilterSelect label="Funded by" value={filters.partner} onChange={(v) => setFilter('partner', v)} options={filterOptions.partners} />
                        <MonthSelect label="From month" value={filters.dateFrom} onChange={(v) => setFilter('dateFrom', v)}
                            months={filterOptions.months.filter((m) => !filters.dateTo || m <= filters.dateTo)} />
                        <MonthSelect label="To month" value={filters.dateTo} onChange={(v) => setFilter('dateTo', v)}
                            months={filterOptions.months.filter((m) => !filters.dateFrom || m >= filters.dateFrom)} />
                    </div>
                </div>
            </Card>

            {loading.active && (
                <div className="flex items-center gap-3 p-3 bg-sky-50 border border-sky-200 rounded-lg text-sky-800 text-sm">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-600" />
                    Loading cases, observations and test records… {loading.done}/{loading.total}
                </div>
            )}
            {!loading.active && failedCourses > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                    Data for {failedCourses} course(s) could not be loaded; their practical results are missing from this report. Use “Reload Data” to try again.
                </div>
            )}

            {courses.length === 0 ? (
                <Card><div className="p-10 text-center text-gray-500">No courses match the selected filters.</div></Card>
            ) : (
                <>
                    {/* Summary */}
                    <Section title="Summary">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <Kpi label="Courses" value={summary.totalCourses} />
                            <Kpi label="Participants" value={summary.totalParticipants} />
                            <Kpi label="Avg. Participants / Course" value={fmtNum(summary.avgParticipantsPerCourse)} />
                            <Kpi label="Health Facilities Represented" value={summary.facilitiesRepresented} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div><strong>Period:</strong> {summary.firstDate ? `${summary.firstDate} → ${summary.lastDate}` : 'N/A'}</div>
                            <div><strong>States ({summary.states.length}):</strong> {summary.states.join(', ') || '-'}</div>
                            <div><strong>Localities ({summary.localities.length}):</strong> {summary.localities.join(', ') || '-'}</div>
                            {summary.subTypes.length > 0 && <div><strong>Sub-courses:</strong> {summary.subTypes.join(', ')}</div>}
                            <div><strong>Funded by:</strong> {summary.partners.join(', ') || '-'}</div>
                            <div><strong>Projects:</strong> {summary.projects.join(', ') || '-'}</div>
                        </div>
                    </Section>

                    {/* KPIs */}
                    {(report.hasCases || report.hasSkills) && (
                        <Section title="Key Performance Indicators (KPIs)">
                            <h4 className="text-lg font-semibold mb-2 text-gray-700">Case KPIs</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <Kpi label="Total Cases" value={overall.totalCases} />
                                <Kpi label="Total Correct Cases" value={overall.correctCases} />
                                <Kpi label="Avg. Cases / Participant" value={fmtNum(overall.avgCasesPerParticipant)} />
                                <Kpi label="Overall Correctness" value={fmtPct(overall.caseCorrectnessPercentage)} className={scoreClass(overall.caseCorrectnessPercentage)} valueClass="" />
                            </div>
                            <h4 className="text-lg font-semibold mb-2 text-gray-700">Skill/Classification KPIs</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <Kpi label="Total Skills" value={overall.totalSkills} />
                                <Kpi label="Total Correct Skills" value={overall.correctSkills} />
                                <Kpi label="Avg. Skills / Participant" value={fmtNum(overall.avgSkillsPerParticipant)} />
                                <Kpi label="Overall Correctness" value={fmtPct(overall.skillCorrectnessPercentage)} className={scoreClass(overall.skillCorrectnessPercentage)} valueClass="" />
                            </div>
                        </Section>
                    )}

                    {/* Test scores */}
                    {report.hasTestScores && (
                        <Section title="Participant Test Scores">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                <Kpi label="Avg. Pre-Test" value={fmtPct(report.preTestStats.avg)} valueClass="text-gray-800" />
                                <Kpi label="Avg. Post-Test" value={fmtPct(report.postTestStats.avg)} valueClass="text-gray-800" />
                                <Kpi label="Avg. Improvement" value={fmtPct(report.totalImprovement)} className={scoreClass(report.totalImprovement, 'improvement')} valueClass="" />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                                <div><strong>Pre-test:</strong> {report.preTestStats.count} results, median {fmtPct(report.preTestStats.median)}, range {fmtNum(report.preTestStats.min)}–{fmtNum(report.preTestStats.max)}</div>
                                <div><strong>Post-test:</strong> {report.postTestStats.count} results, median {fmtPct(report.postTestStats.median)}, range {fmtNum(report.postTestStats.min)}–{fmtNum(report.postTestStats.max)}</div>
                            </div>
                            <h4 className="font-semibold text-gray-700 mb-2">Improvement categories</h4>
                            <DistributionBar distribution={report.improvementDistribution} />
                        </Section>
                    )}

                    {emoncSummary && (
                        <Section title="Participant Test Scores by EmONC Module" subtitle="Each module is a separate test; results pooled across all courses in the report.">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {emoncSummary.modules.map((mod) => {
                                    const style = EMONC_MODULE_STYLES[mod.module] || { header: 'bg-emerald-600 text-white', border: 'border-emerald-300', light: 'bg-emerald-50' };
                                    return (
                                        <div key={mod.module} className={`rounded-xl border-2 ${style.border} overflow-hidden`}>
                                            <div className={`${style.header} px-4 py-3`}>
                                                <div className="text-lg font-extrabold">{mod.label}</div>
                                                <div className="text-xs opacity-90">{mod.stats.participantCount} participants &middot; Pre: {mod.stats.preCount} &middot; Post: {mod.stats.postCount}</div>
                                            </div>
                                            <div className={`${style.light} p-4`}>
                                                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                                                    <div className="p-3 bg-white rounded-lg border"><div className="text-xs font-semibold text-gray-600">Avg. Pre</div><div className="text-xl font-bold">{fmtPct(mod.stats.preAvg)}</div></div>
                                                    <div className="p-3 bg-white rounded-lg border"><div className="text-xs font-semibold text-gray-600">Avg. Post</div><div className="text-xl font-bold">{fmtPct(mod.stats.postAvg)}</div></div>
                                                    <div className={`p-3 rounded-lg ${scoreClass(mod.stats.improvement, 'improvement')}`}><div className="text-xs font-semibold">Improvement</div><div className="text-xl font-bold">{fmtPct(mod.stats.improvement)}</div></div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {mod.parts.map((part) => (
                                                        <div key={part.key} className="border rounded-lg px-3 py-2 bg-white text-sm">
                                                            <div className="text-[11px] font-bold uppercase opacity-70">Part {part.part}</div>
                                                            <div className="font-semibold">{part.title}</div>
                                                            <div>Pre <b>{fmtPct(part.preAvg)}</b> → Post <b>{fmtPct(part.postAvg)}</b></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                    )}

                    {/* Investment & coverage */}
                    <Section title="Investment KPIs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <Kpi label="Total Investment" value={fmtMoney(investment.totalBudget)} className="bg-blue-50 border border-blue-100" valueClass="text-blue-800" />
                            <Kpi label="Cost / Course" value={fmtMoney(investment.costPerCourse)} className="bg-sky-50 border border-sky-100" valueClass="text-sky-800" />
                            <Kpi label="Cost / Participant" value={fmtMoney(investment.costPerParticipant)} className="bg-yellow-50 border border-yellow-100" valueClass="text-yellow-800" />
                            <Kpi label="Cost / New PHC introducing IMNCI" value={coverage.totalNewPhc > 0 ? fmtMoney(investment.costPerNewFacility) : 'N/A'} className="bg-purple-50 border border-purple-100" valueClass="text-purple-800" />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{investment.coursesWithBudget} of {summary.totalCourses} course(s) have a budget recorded.</p>
                    </Section>

                    {coverage.coursesWithSnapshot > 0 && (
                        <Section
                            title="Coverage KPIs (PHC Facilities Only)"
                            subtitle={`Baseline from the earliest saved snapshot per level; new PHCs summed across ${coverage.coursesWithSnapshot} course(s).${coverage.coursesWithoutSnapshot ? ` ${coverage.coursesWithoutSnapshot} course(s) have no saved baseline and are not included.` : ''}`}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <Kpi label="Total new PHCs introducing IMNCI" value={coverage.totalNewPhc} className="bg-green-50 border border-green-100" valueClass="text-green-800" />
                            </div>
                            <h4 className="font-semibold text-gray-700 mt-2">State Coverage Increase</h4>
                            <Table headers={['State', 'Total Functioning PHCs', 'PHCs w/ IMNCI (Before)', 'Coverage Before', 'New PHCs w/ IMNCI', 'Coverage After', 'Increase']}>
                                {coverage.stateCoverage.map((s) => (
                                    <tr key={`state-${s.name}`}>
                                        <td className="font-semibold">{s.name}</td><td>{s.totalPhc}</td><td>{s.phcWithImnciBefore}</td>
                                        <td>{fmtPct(s.covBefore)}</td><td>{s.newPhc}</td><td className="font-bold text-sky-700">{fmtPct(s.covAfter)}</td>
                                        <td className="font-bold text-green-600">+{s.increase.toFixed(2)}%</td>
                                    </tr>
                                ))}
                            </Table>
                        </Section>
                    )}

                    {/* Per-course breakdown */}
                    <Section title="Results by Course" subtitle={onOpenCourseReport ? 'Click a course to open its full course report.' : undefined}>
                        <Table headers={['Start Date', 'State', 'Locality', 'Sub-course', 'Project', 'Funded by', '# Pax', 'Cases (Correct %)', 'Skills (Correct %)', 'Avg Pre', 'Avg Post', 'Improvement', 'Budget', 'New PHCs']}>
                            {breakdowns.byCourse.map((c) => (
                                <tr key={c.id} className={onOpenCourseReport ? 'cursor-pointer' : ''} onClick={onOpenCourseReport ? () => onOpenCourseReport(c.id) : undefined}>
                                    <td className="whitespace-nowrap">{c.date || '-'}</td><td>{c.state}</td><td>{c.locality}</td><td>{c.subTypes || '-'}</td>
                                    <td>{c.project || '-'}</td><td>{c.partner || '-'}</td><td className="text-center">{c.participants}</td>
                                    <td>{fmtCount(c.correctCases, c.cases)}</td><td>{fmtCount(c.correctSkills, c.skills)}</td>
                                    <td>{fmtPct(c.avgPre)}</td><td>{fmtPct(c.avgPost)}</td>
                                    <td><span className={`px-2 py-0.5 rounded text-xs font-bold ${scoreClass(c.improvement, 'improvement')}`}>{fmtPct(c.improvement)}</span></td>
                                    <td>{c.budget ? fmtMoney(c.budget) : '-'}</td><td className="text-center">{c.newPhc ?? '-'}</td>
                                </tr>
                            ))}
                        </Table>
                    </Section>

                    {/* Dimension breakdowns */}
                    <Section
                        title={`Results by ${breakdownLabel}`}
                        actions={(
                            <div className="flex flex-wrap gap-1">
                                {BREAKDOWNS.map((b) => (
                                    <Button key={b.key} variant="tab" isActive={breakdownKey === b.key} onClick={() => setBreakdownKey(b.key)} className="px-3 py-1">{b.label}</Button>
                                ))}
                            </div>
                        )}
                    >
                        {activeBreakdown.length > 1 && (
                            <div className="w-full overflow-x-auto pb-2">
                                <div style={{ height: 320, minWidth: Math.max(500, activeBreakdown.length * 70) }}>
                                    <Bar data={breakdownChart} options={chartOptions(`Scores by ${breakdownLabel}`)} />
                                </div>
                            </div>
                        )}
                        <Table headers={[breakdownLabel, 'Courses', '# Pax', 'Cases (Correct %)', 'Skills (Correct %)', 'Avg Pre', 'Avg Post', 'Improvement', 'Budget']}>
                            {activeBreakdown.map((r) => (
                                <tr key={r.key}>
                                    <td className="font-semibold">{r.key}</td><td className="text-center">{r.courses}</td><td className="text-center">{r.participants}</td>
                                    <td>{fmtCount(r.correctCases, r.cases)}</td><td>{fmtCount(r.correctSkills, r.skills)}</td>
                                    <td>{fmtPct(r.avgPre)}</td><td>{fmtPct(r.avgPost)}</td>
                                    <td><span className={`px-2 py-0.5 rounded text-xs font-bold ${scoreClass(r.improvement, 'improvement')}`}>{fmtPct(r.improvement)}</span></td>
                                    <td>{r.budget ? fmtMoney(r.budget) : '-'}</td>
                                </tr>
                            ))}
                        </Table>
                    </Section>

                    {/* Group & daily charts */}
                    {report.hasCases && groups.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Section title="Overall Performance by Group" subtitle="Groups with the same name are pooled across courses.">
                                <div style={{ height: 300 }}><Bar data={groupChart} options={chartOptions('Cases & Correct Cases by Group')} /></div>
                            </Section>
                            {days.length > 0 && (
                                <Section title="Overall Performance by Day">
                                    <div style={{ height: 300 }}><Bar data={dailyChart} options={chartOptions('Cases & Correct Cases by Day', 'Day')} /></div>
                                </Section>
                            )}
                        </div>
                    )}

                    {groups.length > 0 && days.length > 0 && [
                        ['Daily Case Performance', report.dailyCases],
                        ['Daily Skill Performance', report.dailySkills],
                    ].filter(([, data]) => data.totals.total > 0).map(([title, data]) => (
                        <Section key={title} title={title}>
                            <Table headers={['Day', ...groups, 'Total']}>
                                {data.rows.map((r) => (
                                    <tr key={r.day}>
                                        <td className="font-semibold">{r.day}</td>
                                        {groups.map((g) => <td key={g} className={r.cells[g].total ? scoreClass(r.cells[g].pct) : ''}>{fmtCount(r.cells[g].correct, r.cells[g].total)}</td>)}
                                        <td className={`font-bold ${r.total ? scoreClass(r.pct) : ''}`}>{fmtCount(r.correct, r.total)}</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-100 font-bold">
                                    <td>Total</td>
                                    {groups.map((g) => <td key={g}>{fmtCount(data.totals.cells[g].correct, data.totals.cells[g].total)}</td>)}
                                    <td>{fmtCount(data.totals.correct, data.totals.total)}</td>
                                </tr>
                            </Table>
                        </Section>
                    ))}

                    {/* Participant results */}
                    <Section title="Participant Results" subtitle={`Overall figures for ${report.participantSummary.total} participants across all filtered courses.`}>
                        {report.hasSkills && (
                            <div className="mb-6">
                                <h4 className="text-lg font-bold text-sky-800 mb-2">Practical Case Performance</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                                    <Kpi label="Participants Assessed" value={`${report.participantSummary.practicalAssessed} / ${report.participantSummary.total}`} />
                                    <Kpi label="Avg. Practical Score" value={fmtPct(report.participantSummary.avgPracticalScore)} className={scoreClass(report.participantSummary.avgPracticalScore)} valueClass="" />
                                    <Kpi label="Scored 90% or More" value={fmtPct(report.participantSummary.practicalPassRate)} />
                                    {showEmoncParts ? (
                                        <Kpi label="Avg. EENC / Maternal / Neonatal" value={<span className="text-lg">{fmtPct(report.participantSummary.avgEencScore)} / {fmtPct(report.participantSummary.avgMaternalScore)} / {fmtPct(report.participantSummary.avgNeonatalScore)}</span>} />
                                    ) : showEencOnly ? (
                                        <Kpi label="Avg. EENC Score" value={fmtPct(report.participantSummary.avgEencScore)} />
                                    ) : (
                                        <Kpi label="Avg. Skills / Participant" value={fmtNum(overall.avgSkillsPerParticipant)} />
                                    )}
                                </div>
                                <DistributionBar distribution={report.practicalDistribution} />
                            </div>
                        )}

                        {report.hasTestScores && (
                            <div>
                                <h4 className="text-lg font-bold text-indigo-800 mb-2">Written Test Improvement</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                                    <Kpi label="With Pre- and Post-Test" value={`${report.participantSummary.withBothTests} / ${report.participantSummary.total}`} />
                                    <Kpi label="Avg. % Increase per Participant" value={fmtPct(report.participantSummary.avgIncrease)} className={scoreClass(report.participantSummary.avgIncrease, 'improvement')} valueClass="" />
                                    <Kpi label="Participants Who Improved" value={fmtPct(report.participantSummary.improvedRate)} />
                                </div>
                                <DistributionBar distribution={report.improvementDistribution} />
                            </div>
                        )}

                        {!report.hasSkills && !report.hasTestScores && (
                            loading.active ? <Spinner /> : <p className="text-sm text-gray-500">No practical or test results recorded for these participants yet.</p>
                        )}
                    </Section>
                </>
            )}
        </div>
    );
}
