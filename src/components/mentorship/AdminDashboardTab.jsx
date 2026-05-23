// AdminDashboardTab.jsx
import React, { useRef } from 'react';
import { KpiCard, VolumeLineChart, GeographicVolumeTable, MentorPerformanceTable } from './MentorshipDashboardShared'; // Adjust import path for your shared components

const AdminDashboardTab = ({
    activeService,
    overallKpis,
    visitReportStats,
    motherKpis,
    volumeChartData,
    geographicKpis,
    filteredSubmissions,
    geographicLevelName,
    scopeTitle
}) => {
    const tableRef = useRef(null);

    const volumeChartKeys = [
        { key: 'Completed Visits', title: 'Completed Visits' },
        { key: 'Cases Observed', title: 'Cases Observed' }
    ];

    const isEENC = activeService === 'EENC';

    // Function to copy the table HTML to clipboard for MS Word
    const handleCopyTable = async () => {
        if (!tableRef.current) return;
        
        try {
            const htmlContent = tableRef.current.innerHTML;
            const blobHtml = new Blob([htmlContent], { type: 'text/html' });
            
            const clipboardItem = new ClipboardItem({
                'text/html': blobHtml
            });
            
            await navigator.clipboard.write([clipboardItem]);
            alert('Table copied successfully! You can now paste it directly into Microsoft Word.');
        } catch (err) {
            console.error('Failed to copy the table: ', err);
            alert('Failed to copy the table. Please check your browser permissions.');
        }
    };

    return (
        <div className="animate-fade-in">
            

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <KpiCard 
                    title={`Total Completed ${isEENC ? 'EENC ' : ''}Visits`} 
                    value={overallKpis?.totalVisits || 0} 
                    unit={overallKpis?.totalHealthWorkers > 0 ? `(${(overallKpis.totalVisits / overallKpis.totalHealthWorkers).toFixed(1)} visits per HW)` : ''} 
                />
                <KpiCard title="Total Health Workers Visited" value={overallKpis?.totalHealthWorkers || 0} />
                <KpiCard 
                    title="Total Cases Observed" 
                    value={overallKpis?.totalCasesObserved || 0} 
                    unit={overallKpis?.totalVisits > 0 ? `(${ (overallKpis.totalCasesObserved / overallKpis.totalVisits).toFixed(1) } cases per visit)` : ''} 
                />
            </div>
            
            {/* COMPLIANCE KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <KpiCard 
                    title="Visit Reports Submitted" 
                    value={visitReportStats?.totalVisits || 0} 
                    unit={overallKpis?.totalVisits > 0 ? `(${Math.round(((visitReportStats?.totalVisits || 0) / overallKpis.totalVisits) * 100)}% of Target: ${overallKpis.totalVisits})` : '(Target: 0)'}
                />
                <KpiCard 
                    title="Mother Forms Submitted" 
                    value={motherKpis?.totalMothers || 0} 
                    unit={overallKpis?.totalVisits > 0 ? `(${Math.round(((motherKpis?.totalMothers || 0) / (overallKpis.totalVisits * 3)) * 100)}% of Target: ${overallKpis.totalVisits * 3})` : '(Target: 0)'}
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

            {/* MENTOR PERFORMANCE TABLE WITH COPY FUNCTION */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 mt-10 gap-4">
                <h3 className="text-xl font-extrabold text-slate-800 text-left tracking-wide m-0">
                    Mentor Performance & Compliance {scopeTitle}
                </h3>
                <button 
                    onClick={handleCopyTable}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow transition-colors text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                    </svg>
                    Copy as Word Table
                </button>
            </div>
            
            <div ref={tableRef} className="bg-white">
                <MentorPerformanceTable 
                    title="Mentorship Activity & Reporting Compliance by Supervisor"
                    submissions={filteredSubmissions}
                    visitReports={visitReportStats?.rawReports || []}
                    activeService={activeService}
                />
            </div>
        </div>
    );
};

export default AdminDashboardTab;