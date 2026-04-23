// src/components/DashboardView.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    NeonatalCoverageDashboard, 
    IMNCICoverageDashboard, 
    EENCCoverageDashboard, 
    CombinedServiceDashboard,
    CriticalCareCoverageDashboard 
} from "./ServiceCoverageDashboard.jsx";
import { useDataCache } from '../DataContext';

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false }) => (
    <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-md font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 flex items-center gap-2 justify-center ${variant === 'primary' ? 'bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 disabled:opacity-50'} ${className}`}>
        {children}
    </button>
);

const Spinner = ({ size = 'md' }) => (
    <div className={`animate-spin rounded-full border-sky-600 border-t-transparent ${size === 'sm' ? 'h-4 w-4 border-2' : 'h-8 w-8 border-2'} mx-auto`}></div>
);

function DashboardView({ userStates, userLocalities }) {
    const { t } = useTranslation();
    const { fetchCourses, fetchParticipants, fetchHealthFacilities, isLoading, healthFacilities } = useDataCache();

    const [viewType, setViewType] = useState('combinedCoverage'); 
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                fetchCourses(true), 
                fetchParticipants(true), 
                fetchHealthFacilities({}, true)
            ]);
        } catch (error) {
            console.error("Error refreshing dashboard data:", error);
        } finally { 
            setIsRefreshing(false); 
        }
    };

    const isDashboardLoading = isLoading.healthFacilities || healthFacilities === null;

    return (
        <div className="flex flex-col w-full bg-slate-50/20 min-h-screen">
            {/* Unified Header & Tabs sitting flush at the top */}
            <div className="bg-sky-50/60 border-b border-sky-100 px-4 md:px-8 pt-5 pb-0 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                            {t('dashboard.service_coverage_title', 'Service Coverage Dashboard')}
                        </h1>
                    </div>
                    <Button onClick={handleRefresh} disabled={isRefreshing} variant="secondary" className="whitespace-nowrap text-[13px] py-1.5 px-4 text-slate-700 shadow-sm hover:text-sky-700">
                        {isRefreshing ? <Spinner size="sm" /> : t('dashboard.refresh_data', '↻ Refresh Data Cache')}
                    </Button>
                </div>
                
                <nav className="-mb-px flex flex-nowrap space-x-6 overflow-x-auto">
                    {[
                        { id: 'combinedCoverage', label: t('dashboard.tabs.combined', 'Combined Coverage') },
                        { id: 'neonatalCoverage', label: t('dashboard.tabs.neonatal', 'Neonatal Care Coverage') },
                        { id: 'eencCoverage', label: t('dashboard.tabs.eenc', 'EENC Coverage') },
                        { id: 'imnciCoverage', label: t('dashboard.tabs.imnci', 'IMNCI Coverage') },
                        { id: 'criticalCoverage', label: t('dashboard.tabs.critical', 'Emergency & Critical Care') } 
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setViewType(tab.id)} 
                            className={`${viewType === tab.id ? 'border-sky-600 text-sky-800 font-bold' : 'border-transparent text-gray-500 hover:text-sky-700 hover:border-sky-300 font-medium'} whitespace-nowrap py-3 border-b-2 text-[13px] tracking-wide uppercase transition-colors`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {isDashboardLoading ? (
                <div className="text-center py-20 flex flex-col items-center justify-center">
                    <Spinner />
                    <p className="mt-4 text-sm font-semibold text-gray-500 tracking-wide uppercase">
                        {t('dashboard.syncing', 'Syncing Dashboard Data...')}
                    </p>
                </div>
            ) : (
                <div className="px-4 md:px-8 pt-6 pb-12 w-full max-w-screen-2xl mx-auto">
                    {/* Render Coverage Dashboards */}
                    {viewType === 'combinedCoverage' && <CombinedServiceDashboard userStates={userStates} userLocalities={userLocalities} />}
                    {viewType === 'neonatalCoverage' && <NeonatalCoverageDashboard userStates={userStates} userLocalities={userLocalities} />}
                    {viewType === 'eencCoverage' && <EENCCoverageDashboard userStates={userStates} userLocalities={userLocalities} />}
                    {viewType === 'imnciCoverage' && <IMNCICoverageDashboard userStates={userStates} userLocalities={userLocalities} />}
                    {viewType === 'criticalCoverage' && <CriticalCareCoverageDashboard userStates={userStates} userLocalities={userLocalities} />}
                </div>
            )}
        </div>
    );
}

export default DashboardView;