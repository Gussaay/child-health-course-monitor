// src/components/DashboardView.jsx
import React, { useState } from 'react';
import { 
    NeonatalCoverageDashboard, 
    IMNCICoverageDashboard, 
    EENCCoverageDashboard, 
    CombinedServiceDashboard 
} from "./ServiceCoverageDashboard.jsx";
import { useDataCache } from '../DataContext';

const Card = ({ children, className = '' }) => <div className={`bg-white rounded-lg shadow-md p-4 md:p-6 ${className}`}>{children}</div>;
const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false }) => <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-md font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 flex items-center gap-2 justify-center ${variant === 'primary' ? 'bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50'} ${className}`}>{children}</button>;
const Spinner = ({ size = 'md' }) => <div className={`animate-spin rounded-full border-sky-600 border-t-transparent ${size === 'sm' ? 'h-4 w-4 border-2' : 'h-8 w-8 border-2'} mx-auto`}></div>;

function DashboardView() {
    // Only pull the fetch functions needed for the master refresh button
    const { fetchCourses, fetchParticipants, fetchHealthFacilities, isLoading } = useDataCache();

    const [viewType, setViewType] = useState('combinedCoverage'); 
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // Refresh global data caches used by the inner coverage dashboards
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

    return (
        <Card className="p-0">
            <div className="border-b border-gray-200 px-4 md:px-6 flex flex-col md:flex-row md:justify-between md:items-center py-2 gap-4">
                <nav className="-mb-px flex flex-wrap space-x-4 overflow-x-auto">
                    {[
                        { id: 'combinedCoverage', label: 'Combined Coverage' },
                        { id: 'neonatalCoverage', label: 'Neonatal Care Coverage' },
                        { id: 'eencCoverage', label: 'EENC Coverage' },
                        { id: 'imnciCoverage', label: 'IMNCI Coverage' }
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setViewType(tab.id)} 
                            className={`${viewType === tab.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-400'} whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm transition-colors`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
                <Button onClick={handleRefresh} disabled={isRefreshing} variant="secondary" className="whitespace-nowrap text-xs py-1.5 px-3 mb-2 md:mb-0 border border-sky-200 text-sky-700 hover:bg-sky-50 shadow-sm">
                    {isRefreshing ? <Spinner size="sm" /> : '↻ Refresh Data'}
                </Button>
            </div>

            {isLoading.healthFacilities ? (
                <div className="text-center py-12"><Spinner /><p className="mt-4 text-gray-500">Loading summary data...</p></div>
            ) : (
                <div className="px-4 md:px-6 pt-4 pb-6">
                    {/* Render Coverage Dashboards */}
                    {viewType === 'combinedCoverage' && <CombinedServiceDashboard />}
                    {viewType === 'neonatalCoverage' && <NeonatalCoverageDashboard />}
                    {viewType === 'eencCoverage' && <EENCCoverageDashboard />}
                    {viewType === 'imnciCoverage' && <IMNCICoverageDashboard />}
                </div>
            )}
        </Card>
    );
}

export default DashboardView;