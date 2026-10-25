// src/components/DashboardView.jsx
import React, { useState, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    NeonatalCoverageDashboard, 
    IMNCICoverageDashboard, 
    EENCCoverageDashboard, 
    CombinedServiceDashboard,
    CriticalCareCoverageDashboard 
} from "./ServiceCoverageDashboard.jsx";
import { useDataCache } from '../DataContext';
import { PageSkeleton, PageToolsContext, PageTabs, PullToRefresh } from './CommonComponents';
import { RefreshCw } from 'lucide-react';

// The denominators behind every coverage percentage on the other tabs.
const PopulationDashboard = lazy(() => import('./PopulationView').then((m) => ({ default: m.PopulationDashboard })));
// Published figures (UN IGME estimates, Sudan MICS), not the app's records.
const MorbidityMortalityDashboard = lazy(() => import('./ChildHealthIndicatorsView'));

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

    const tabs = [
        { id: 'combinedCoverage', short: 'combined', label: t('dashboard.tabs.combined', 'Combined Coverage') },
        { id: 'neonatalCoverage', short: 'neonatal', label: t('dashboard.tabs.neonatal', 'Neonatal Care Coverage') },
        { id: 'eencCoverage', short: 'eenc', label: t('dashboard.tabs.eenc', 'EENC Coverage') },
        { id: 'imnciCoverage', short: 'imnci', label: t('dashboard.tabs.imnci', 'IMNCI Coverage') },
        { id: 'criticalCoverage', short: 'critical', label: t('dashboard.tabs.critical', 'Emergency & Critical Care') },
        { id: 'population', short: 'population', label: t('dashboard.tabs.population', 'Population') },
        { id: 'indicators', short: 'indicators', label: t('dashboard.tabs.indicators', 'Morbidity & Mortality Indicators') }
    ];

    // Phones: refresh sits at the end of the one-line "Filters" row.
    const phoneRefresh = (
        <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title={t('ui.refresh', 'Refresh data')}
            aria-label={t('ui.refresh', 'Refresh data')}
            className="shrink-0 h-[38px] w-[38px] flex items-center justify-center rounded-xl border border-gray-200 bg-white text-slate-600 shadow-sm active:bg-slate-50 disabled:opacity-50"
        >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
    );

    return (
        <div className="flex flex-col w-full md:bg-slate-50/20 min-h-screen">
            {/* Unified Header & Tabs */}
            <div className="md:bg-sky-50/60 md:border-b md:border-sky-100 md:px-8 md:pt-5 md:pb-4 flex flex-col gap-3 md:gap-5">
                {/* Phones: the page name is in the top bar, so no title row here. */}
                <div className="hidden md:flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                            {t('dashboard.service_coverage_title', 'Service Coverage Dashboard')}
                        </h1>
                    </div>
                    <Button onClick={handleRefresh} disabled={isRefreshing} variant="secondary" className="whitespace-nowrap text-[13px] py-1.5 px-4 text-slate-700 shadow-sm hover:text-sky-700">
                        {isRefreshing ? <Spinner size="sm" /> : t('dashboard.refresh_data', '↻ Refresh Data Cache')}
                    </Button>
                </div>
                

                {/* Modern Pill-Style Tab Navigation */}
                <div className="hidden md:block overflow-x-auto md:mx-0 md:px-0">
                    <nav className="flex space-x-2 pb-1">
                        {tabs.map(tab => (
                            <button 
                                key={tab.id} 
                                onClick={() => setViewType(tab.id)} 
                                className={`
                                    relative px-5 py-2.5 rounded-full text-[13px] font-bold tracking-wide transition-all duration-200 whitespace-nowrap border
                                    ${viewType === tab.id 
                                        ? 'bg-white text-sky-700 border-sky-200 shadow-sm ring-1 ring-sky-100' 
                                        : 'bg-transparent text-slate-500 border-transparent hover:bg-sky-100/50 hover:text-sky-700'
                                    }
                                `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <PullToRefresh onRefresh={handleRefresh} disabled={isRefreshing} />
            {/* Phones: short names, all seven in one row, pinned under the top bar. */}
            <PageTabs
                className="md:hidden !mb-0"
                tabs={tabs.map(tab => ({ id: tab.id, label: tab.label, short: t(`ui.dash_tabs.${tab.short}`, tab.label) }))}
                active={viewType}
                onChange={setViewType}
            />

            {isDashboardLoading ? (
                <div className="py-3 md:py-4">
                    <PageSkeleton />
                    <p className="mt-4 text-center text-sm font-semibold text-gray-500 tracking-wide ">
                        {t('dashboard.syncing', 'Syncing Dashboard Data...')}
                    </p>
                </div>
            ) : (
                <div className="md:px-8 pt-3 md:pt-6 pb-6 md:pb-12 w-full max-w-screen-2xl mx-auto">
                  <PageToolsContext.Provider value={phoneRefresh}>
                    {/* Render Coverage Dashboards */}
                    {viewType === 'combinedCoverage' && <CombinedServiceDashboard userStates={userStates} userLocalities={userLocalities} />}
                    {viewType === 'neonatalCoverage' && <NeonatalCoverageDashboard userStates={userStates} userLocalities={userLocalities} />}
                    {viewType === 'eencCoverage' && <EENCCoverageDashboard userStates={userStates} userLocalities={userLocalities} />}
                    {viewType === 'imnciCoverage' && <IMNCICoverageDashboard userStates={userStates} userLocalities={userLocalities} />}
                    {viewType === 'criticalCoverage' && <CriticalCareCoverageDashboard userStates={userStates} userLocalities={userLocalities} />}
                    {viewType === 'population' && (
                        <Suspense fallback={<PageSkeleton />}><PopulationDashboard /></Suspense>
                    )}
                    {viewType === 'indicators' && (
                        <Suspense fallback={<PageSkeleton />}><MorbidityMortalityDashboard /></Suspense>
                    )}
                  </PageToolsContext.Provider>
                </div>
            )}
        </div>
    );
}

export default DashboardView;