// AdminDashboardTab.jsx
import React from 'react';
import { KpiCard, VolumeLineChart, GeographicVolumeTable, MentorPerformanceTable, FilterSelect } from './MentorshipDashboardShared'; // Adjust import path for your shared components

const AdminDashboardTab = ({
    activeService,
    overallKpis,
    visitReportStats,
    motherKpis,
    volumeChartData,
    geographicKpis,
    filteredSubmissions,
    geographicLevelName,
    scopeTitle,
    weekFilter,
    monthFilter,
    handleWeekFilterChange,
    handleMonthFilterChange
}) => {
    const volumeChartKeys = [
        { key: 'Completed Visits', title: 'Completed Visits' },
        { key: 'Cases Observed', title: 'Cases Observed' }
    ];

    const isEENC = activeService === 'EENC';

    return (
        <div className="animate-fade-in">
            {/* DATE FILTERS */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-5 bg-slate-100 rounded-2xl shadow-sm border border-slate-300">
                <div className="flex-1">
                    <FilterSelect 
                        label="Filter by Week" 
                        value={weekFilter} 
                        onChange={handleWeekFilterChange} 
                        options={[{key: 'this_week', name: 'This Week'}, {key: 'last_week', name: 'Last Week'}]} 
                        defaultOption="All Time" 
                    />
                </div>
                <div className="flex-1">
                    <FilterSelect 
                        label="Filter by Month" 
                        value={monthFilter} 
                        onChange={handleMonthFilterChange} 
                        options={[{key: 'this_month', name: 'This Month'}, {key: 'last_month', name: 'Last Month'}]} 
                        defaultOption="All Time" 
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KpiCard 
                    title={`Total Completed ${isEENC ? 'EENC ' : ''}Visits`} 
                    value={overallKpis.totalVisits} 
                    unit={overallKpis.totalHealthWorkers > 0 ? `(${(overallKpis.totalVisits / overallKpis.totalHealthWorkers).toFixed(1)} visits per HW)` : ''} 
                />
                <KpiCard title="Total Health Workers Visited" value={overallKpis.totalHealthWorkers} />
                <KpiCard 
                    title="Total Cases Observed" 
                    value={overallKpis.totalCasesObserved} 
                    unit={overallKpis.totalVisits > 0 ? `(${ (overallKpis.totalCasesObserved / overallKpis.totalVisits).toFixed(1) } cases per visit)` : ''} 
                />
            </div>
            
            {/* COMPLIANCE KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <KpiCard 
                    title="Visit Reports Submitted" 
                    value={visitReportStats?.totalVisits || 0} 
                    unit={overallKpis.totalVisits > 0 ? `(${Math.round(((visitReportStats?.totalVisits || 0) / overallKpis.totalVisits) * 100)}% of Target: ${overallKpis.totalVisits})` : '(Target: 0)'}
                />
                <KpiCard 
                    title="Mother Forms Submitted" 
                    value={motherKpis?.totalMothers || 0} 
                    unit={overallKpis.totalVisits > 0 ? `(${Math.round(((motherKpis?.totalMothers || 0) / (overallKpis.totalVisits * 3)) * 100)}% of Target: ${overallKpis.totalVisits * 3})` : '(Target: 0)'}
                />
            </div>

            <div className="mb-8">
                <VolumeLineChart title="Visits & Cases by Visit Number" chartData={volumeChartData} kpiKeys={volumeChartKeys} />
            </div>
            
            <h3 className="text-xl font-extrabold text-slate-800 mb-5 mt-10 text-left tracking-wide">
                Program Performance by {geographicLevelName} {scopeTitle}
            </h3>
            <GeographicVolumeTable 
                title={`Volume & Coverage by ${geographicLevelName}`} 
                data={geographicKpis} 
                locationLabel={geographicLevelName} 
            />

            {/* MENTOR PERFORMANCE TABLE */}
            <h3 className="text-xl font-extrabold text-slate-800 mb-5 mt-10 text-left tracking-wide">
                Mentor Performance & Compliance {scopeTitle}
            </h3>
            <MentorPerformanceTable 
                title="Mentorship Activity & Reporting Compliance by Supervisor"
                submissions={filteredSubmissions}
                visitReports={visitReportStats?.rawReports || []}
                activeService={activeService}
            />
        </div>
    );
};

export default AdminDashboardTab;