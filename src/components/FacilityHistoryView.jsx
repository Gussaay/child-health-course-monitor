// FacilityHistoryView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { listSnapshotsForFacility, fetchFacilitiesHistoryMultiDate } from "../data.js"; 
import { Modal, Spinner, EmptyState, Select, Table, Button, Card, PageHeader, FormGroup, Input } from './CommonComponents';
import { STATE_LOCALITIES } from './constants';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// --- PART 1: SINGLE FACILITY HISTORY MODAL ---
// ============================================================================

const deepEqual = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

const getDisplayableValue = (value, t) => {
    if (value === null || value === undefined) return t('facilities_page.common.na', 'N/A');
    if (typeof value === 'boolean') return value ? t('facilities_page.common.yes', 'Yes') : t('facilities_page.common.no', 'No');
    if (value instanceof Date) return value.toLocaleDateString();
    if (value instanceof Timestamp) return value.toDate().toLocaleString();
    if (typeof value === 'object' && value !== null) {
         if (Array.isArray(value)) {
             return value.length > 0 ? value.map(v => v.name || JSON.stringify(v)).join(', ') : t('facilities_page.common.na', 'N/A');
         }
         if ('primary' in value || 'secondary' in value || 'tertiary' in value) {
             const levels = [];
             if (value.primary) levels.push(t('facilities_page.history.level_primary', 'Primary'));
             if (value.secondary) levels.push(t('facilities_page.history.level_special_care', 'Special Care'));
             if (value.tertiary) levels.push('NICU');
             return levels.length > 0 ? levels.join(', ') : t('facilities_page.common.na', 'N/A');
         }
         return JSON.stringify(value);
    }
    return String(value);
};

const getFieldLabelsForComparison = (t) => ({
    'اسم_المؤسسة': t('facilities_page.history.fields.facility_name', 'Facility Name'),
    'الولاية': t('facilities_page.history.fields.state', 'State'),
    'المحلية': t('facilities_page.history.fields.locality', 'Locality'),
    'نوع_المؤسسةالصحية': t('facilities_page.history.fields.facility_type', 'Facility Type'),
    'هل_المؤسسة_تعمل': t('facilities_page.history.fields.functioning', 'Functioning'),
    '_الإحداثيات_latitude': t('facilities_page.history.fields.latitude', 'Latitude'),
    '_الإحداثيات_longitude': t('facilities_page.history.fields.longitude', 'Longitude'),
    'وجود_العلاج_المتكامل_لامراض_الطفولة': t('facilities_page.history.fields.imnci_service', 'IMNCI Service'),
    'العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين': t('facilities_page.history.fields.imnci_total_staff', 'IMNCI Total Staff'),
    'العدد_الكلي_للكودار_ المدربة_على_العلاج_المتكامل': t('facilities_page.history.fields.imnci_trained_staff', 'IMNCI Trained Staff'),
    'eenc_provides_essential_care': t('facilities_page.history.fields.eenc_service', 'EENC Service'),
    'eenc_trained_workers': t('facilities_page.history.fields.eenc_trained_workers', 'EENC Trained Workers'),
    'neonatal_level_of_care': t('facilities_page.history.fields.neonatal_level_of_care', 'Neonatal Level of Care'),
    'neonatal_total_beds': t('facilities_page.history.fields.neonatal_total_beds', 'Neonatal Total Beds'),
    'neonatal_total_incubators': t('facilities_page.history.fields.neonatal_incubators', 'Neonatal Incubators'),
    'etat_has_service': t('facilities_page.history.fields.etat_service', 'ETAT Service'),
    'hdu_has_service': t('facilities_page.history.fields.hdu_service', 'HDU Service'),
    'picu_has_service': t('facilities_page.history.fields.picu_service', 'PICU Service'),
    'imnci_staff': t('facilities_page.history.fields.imnci_staff_list', 'IMNCI Staff List')
});

const createComparison = (snapA, snapB, t) => {
    const FIELD_LABELS_FOR_COMPARISON = getFieldLabelsForComparison(t);
    const rows = [];
    const allKeys = new Set([...Object.keys(snapA || {}), ...Object.keys(snapB || {})]);

    allKeys.forEach(key => {
        if (key.startsWith('_') || ['id', 'snapshotId', 'facilityId', 'submittedAt', 'updated_by', 'اخر تحديث', 'date_of_visit', 'snapshotCreatedAt', 'effectiveDate', 'status', 'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt'].includes(key)) {
            return;
        }
        const valueA = snapA?.[key];
        const valueB = snapB?.[key];
        const isDifferent = !deepEqual(valueA, valueB);

        if (valueA !== undefined || valueB !== undefined) {
             rows.push({
                key: key,
                label: FIELD_LABELS_FOR_COMPARISON[key] || key.replace(/_/g, ' '),
                valueA: getDisplayableValue(valueA, t),
                valueB: getDisplayableValue(valueB, t),
                isDifferent: isDifferent
            });
        }
    });
    return rows.sort((a, b) => {
        if (a.isDifferent && !b.isDifferent) return -1;
        if (!a.isDifferent && b.isDifferent) return 1;
        return a.label.localeCompare(b.label);
    });
};

const TABS = {
    COMPARISON: 'Version Comparison',
    KPI: 'KPI Coverage (Last 12 Months)'
};

const FacilityHistoryView = ({ isOpen, onClose, facility }) => {
    const { t } = useTranslation();
    const [snapshots, setSnapshots] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedSnapIdA, setSelectedSnapIdA] = useState(null);
    const [selectedSnapIdB, setSelectedSnapIdB] = useState(null);
    const [activeTab, setActiveTab] = useState(TABS.COMPARISON);

    useEffect(() => {
        if (isOpen && facility?.id) {
            const fetchHistory = async () => {
                setIsLoading(true);
                setError(null);
                setSnapshots([]);
                try {
                    const fetchedSnapshots = await listSnapshotsForFacility(facility.id);
                    fetchedSnapshots.sort((a, b) => {
                        const dateA = a.effectiveDate?.toDate ? a.effectiveDate.toDate().getTime() : 0;
                        const dateB = b.effectiveDate?.toDate ? b.effectiveDate.toDate().getTime() : 0;
                        return dateB - dateA;
                    });
                    
                    setSnapshots(fetchedSnapshots);
                    setSelectedSnapIdA(fetchedSnapshots[0]?.id || null);
                    setSelectedSnapIdB(fetchedSnapshots[1]?.id || null);
                } catch (err) {
                    setError(err.message);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchHistory();
        } else {
            setSnapshots([]);
            setSelectedSnapIdA(null);
            setSelectedSnapIdB(null);
            setIsLoading(false);
            setError(null);
            setActiveTab(TABS.COMPARISON);
        }
    }, [isOpen, facility]);

    const snapshotOptions = useMemo(() => {
        return snapshots.map(s => {
            const date = s.effectiveDate?.toDate ? s.effectiveDate.toDate() : (s.date_of_visit ? new Date(s.date_of_visit) : null);
            const dateStr = date ? date.toLocaleString() : t('facilities_page.history.unknown_date', 'Unknown Date');
            return {
                value: s.id,
                label: t('facilities_page.history.snapshot_label', '{{date}} (by {{user}})', { date: dateStr, user: s.updated_by || t('facilities_page.history.unknown', 'Unknown') })
            };
        });
    }, [snapshots, t]);

    const snapA = useMemo(() => snapshots.find(s => s.id === selectedSnapIdA), [snapshots, selectedSnapIdA]);
    const snapB = useMemo(() => snapshots.find(s => s.id === selectedSnapIdB), [snapshots, selectedSnapIdB]);

    const comparisonRows = useMemo(() => createComparison(snapA, snapB, t), [snapA, snapB, t]);

    const displayYesNo = (v) => v === 'Yes' ? t('facilities_page.common.yes', 'Yes') : v === 'No' ? t('facilities_page.common.no', 'No') : v;

    const kpiHistory = useMemo(() => {
        if (snapshots.length === 0) return [];
        const history = [];
        const now = new Date();
        
        for (let i = 11; i >= 0; i--) {
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            const monthLabel = endOfMonth.toLocaleString('default', { month: 'short', year: 'numeric' });
            
            const snapshotAtTime = snapshots.find(s => {
                const snapDate = s.effectiveDate?.toDate ? s.effectiveDate.toDate() : new Date(0);
                return snapDate <= endOfMonth;
            });

            if (snapshotAtTime) {
                history.push({
                    month: monthLabel,
                    imnci: snapshotAtTime['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes' ? 'Yes' : 'No',
                    eenc: snapshotAtTime.eenc_provides_essential_care === 'Yes' ? 'Yes' : 'No',
                    neonatal_beds: snapshotAtTime.neonatal_total_beds || '0',
                    etat: snapshotAtTime.etat_has_service === 'Yes' ? 'Yes' : 'No',
                    functioning: snapshotAtTime['هل_المؤسسة_تعمل'] === 'Yes' ? 'Yes' : 'No'
                });
            } else {
                history.push({ month: monthLabel, imnci: '-', eenc: '-', neonatal_beds: '-', etat: '-', functioning: '-' });
            }
        }
        return history;
    }, [snapshots]);

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>;
        if (error) return <div className="p-4 text-red-600 bg-red-50 text-center">{t('facilities_page.history.load_failed', 'Failed to load history: {{message}}', { message: error })}</div>;
        if (snapshots.length === 0) return <div className="p-8"><EmptyState message={t('facilities_page.history.no_snapshots', 'No historical snapshots found for this facility.')} /></div>;

        return (
            <div className="flex flex-col h-full">
                <div className="border-b border-gray-200 flex-shrink-0 px-4 mt-2">
                    <nav className="-mb-px flex space-x-6">
                        {Object.values(TABS).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`${
                                    activeTab === tab
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                            >
                                {tab === TABS.COMPARISON ? t('facilities_page.history.tab_comparison', 'Version Comparison') : t('facilities_page.history.tab_kpi', 'KPI Coverage (Last 12 Months)')}
                            </button>
                        ))}
                    </nav>
                </div>

                {activeTab === TABS.COMPARISON && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-b flex-shrink-0 bg-gray-50">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('facilities_page.history.compare_version_a', 'Compare Version (A)')}</label>
                                <Select value={selectedSnapIdA || ''} onChange={e => setSelectedSnapIdA(e.target.value)}>
                                    <option value="">{t('facilities_page.history.select_version', '-- Select Version --')}</option>
                                    {snapshotOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('facilities_page.history.with_version_b', 'With Version (B)')}</label>
                                <Select value={selectedSnapIdB || ''} onChange={e => setSelectedSnapIdB(e.target.value)}>
                                    <option value="">{t('facilities_page.history.select_version', '-- Select Version --')}</option>
                                    {snapshotOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </Select>
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto">
                            <Table headers={[t('facilities_page.history.field', 'Field'), t('facilities_page.history.version_a', 'Version A ({{date}})', { date: snapA ? (snapA.effectiveDate?.toDate ? snapA.effectiveDate.toDate().toLocaleDateString() : t('facilities_page.common.na', 'N/A')) : '...' }), t('facilities_page.history.version_b', 'Version B ({{date}})', { date: snapB ? (snapB.effectiveDate?.toDate ? snapB.effectiveDate.toDate().toLocaleDateString() : t('facilities_page.common.na', 'N/A')) : '...' })]} stickyHeader={true}>
                                {comparisonRows.map(row => (
                                    <tr key={row.key} className={row.isDifferent ? 'bg-yellow-50' : 'bg-white'}>
                                        <td className="p-2 border-b border-gray-200 font-medium text-gray-700 capitalize align-top w-1/3">{row.label}</td>
                                        <td className={`p-2 border-b border-gray-200 align-top w-1/3 ${row.isDifferent ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.valueA}</td>
                                        <td className={`p-2 border-b border-gray-200 align-top w-1/3 ${row.isDifferent ? 'font-semibold text-blue-800' : 'text-gray-600'}`}>{row.valueB}</td>
                                    </tr>
                                ))}
                            </Table>
                            {comparisonRows.length === 0 && (snapA || snapB) && (
                                <div className="p-8"><EmptyState message={t('facilities_page.history.select_two_versions', 'Select two versions to compare.')} /></div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === TABS.KPI && (
                    <div className="flex-grow overflow-y-auto p-4">
                        <div className="bg-white rounded-lg shadow border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200 bg-sky-50">
                                <h3 className="text-lg font-semibold text-sky-800">{t('facilities_page.history.kpi_title', 'Primary Services KPIs (Last 12 Months)')}</h3>
                                <p className="text-sm text-gray-600">{t('facilities_page.history.kpi_subtitle', 'Shows the active state of services at the end of each month.')}</p>
                            </div>
                            <Table headers={[t('facilities_page.history.month', 'Month'), t('facilities_page.history.fields.functioning', 'Functioning'), t('facilities_page.history.fields.imnci_service', 'IMNCI Service'), t('facilities_page.history.fields.eenc_service', 'EENC Service'), t('facilities_page.history.fields.neonatal_total_beds', 'Neonatal Total Beds'), t('facilities_page.history.fields.etat_service', 'ETAT Service')]}>
                                {kpiHistory.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="font-semibold text-gray-800">{row.month}</td>
                                        <td>{row.functioning === 'Yes' ? <span className="text-green-600 font-bold">{t('facilities_page.common.yes', 'Yes')}</span> : displayYesNo(row.functioning)}</td>
                                        <td>{row.imnci === 'Yes' ? <span className="text-sky-600 font-bold">{t('facilities_page.common.yes', 'Yes')}</span> : displayYesNo(row.imnci)}</td>
                                        <td>{row.eenc === 'Yes' ? <span className="text-teal-600 font-bold">{t('facilities_page.common.yes', 'Yes')}</span> : displayYesNo(row.eenc)}</td>
                                        <td className="font-medium text-indigo-600">{row.neonatal_beds}</td>
                                        <td>{row.etat === 'Yes' ? <span className="text-red-600 font-bold">{t('facilities_page.common.yes', 'Yes')}</span> : displayYesNo(row.etat)}</td>
                                    </tr>
                                ))}
                            </Table>
                        </div>
                    </div>
                )}

                 <div className="flex justify-end p-4 border-t flex-shrink-0">
                    <Button variant="secondary" onClick={onClose}>{t('facilities_page.common.close', 'Close')}</Button>
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('facilities_page.history.history_for', 'History for {{name}}', { name: facility?.['اسم_المؤسسة'] || t('facilities_page.history.facility', 'Facility') })} size="full">
            {renderContent()}
        </Modal>
    );
};

// ============================================================================
// --- PART 2: AGGREGATE KPI HISTORY DASHBOARD ---
// ============================================================================


const MultiLineChart = ({ dates, lines, title }) => {
    const height = 220;
    const width = 500;
    const paddingX = 40;
    const paddingY = 30;
    const maxVal = 100;

    if (!dates || dates.length === 0 || !lines || lines.length === 0) return null;

    return (
        <div className="flex flex-col items-center w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm h-full">
            <h4 className="text-sm font-bold text-gray-800 mb-4">{title}</h4>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                {/* Grid lines */}
                <line x1={paddingX} y1={paddingY} x2={width-paddingX} y2={paddingY} stroke="#f3f4f6" strokeDasharray="4" />
                <line x1={paddingX} y1={height/2} x2={width-paddingX} y2={height/2} stroke="#f3f4f6" strokeDasharray="4" />
                <line x1={paddingX} y1={height-paddingY} x2={width-paddingX} y2={height-paddingY} stroke="#e5e7eb" />
                
                <text x={paddingX - 10} y={paddingY + 4} fontSize="10" fill="#9ca3af" textAnchor="end">100%</text>
                <text x={paddingX - 10} y={height/2 + 4} fontSize="10" fill="#9ca3af" textAnchor="end">50%</text>
                <text x={paddingX - 10} y={height-paddingY + 4} fontSize="10" fill="#9ca3af" textAnchor="end">0%</text>

                {lines.map((lineDef, lineIdx) => {
                    const points = lineDef.data.map((val, i) => {
                        const x = paddingX + (i * (width - 2 * paddingX) / Math.max(1, dates.length - 1));
                        const y = height - paddingY - (val / maxVal) * (height - 2 * paddingY);
                        return `${x},${y}`;
                    }).join(' ');

                    return (
                        <g key={lineIdx}>
                            <polyline fill="none" stroke={lineDef.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
                            {lineDef.data.map((val, i) => {
                                const x = paddingX + (i * (width - 2 * paddingX) / Math.max(1, dates.length - 1));
                                const y = height - paddingY - (val / maxVal) * (height - 2 * paddingY);
                                return <circle key={i} cx={x} cy={y} r="4" fill={lineDef.color} stroke="#fff" strokeWidth="1.5" />;
                            })}
                        </g>
                    );
                })}

                {dates.map((dateStr, i) => {
                    const x = paddingX + (i * (width - 2 * paddingX) / Math.max(1, dates.length - 1));
                    return <text key={i} x={x} y={height - 10} fontSize="10" fill="#6b7280" textAnchor="middle">{dateStr}</text>;
                })}
            </svg>
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {lines.map((lineDef, idx) => (
                    <div key={idx} className="flex items-center text-xs font-medium text-gray-600">
                        <span className="w-3 h-3 rounded-full me-1.5 inline-block" style={{ backgroundColor: lineDef.color }}></span>
                        {lineDef.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Safe string normalizer to prevent failing string matching (like "مستشفى " !== "مستشفى")
const normalizeStr = (str) => typeof str === 'string' ? str.trim() : str;

export const AggregateHistoryDashboard = ({ userStates, onBack }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [historyData, setHistoryData] = useState(null);
    
    // Filters State
    const [dateMode, setDateMode] = useState('last6months');
    const [exactDate, setExactDate] = useState(new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedState, setSelectedState] = useState('');
    const [selectedLocality, setSelectedLocality] = useState('');

    const availableStates = useMemo(() => {
        const all = Object.keys(STATE_LOCALITIES).filter(s => s !== 'إتحادي');
        return userStates?.length > 0 ? all.filter(s => userStates.includes(s)) : all;
    }, [userStates]);

    const targetDates = useMemo(() => {
        const dates = [];
        const now = new Date();
        if (dateMode === 'last6months') {
            for (let i = 5; i >= 0; i--) {
                dates.push(new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59));
            }
        } else if (dateMode === 'exact' && exactDate) {
            dates.push(new Date(exactDate));
        } else if (dateMode === 'range' && startDate && endDate) {
            dates.push(new Date(startDate));
            dates.push(new Date(endDate));
        }
        return dates;
    }, [dateMode, exactDate, startDate, endDate]);

    const handleFetchData = async () => {
        if (targetDates.length === 0) return;
        setLoading(true);
        try {
            const statesToQuery = selectedState ? [selectedState] : availableStates;
            
            // Using the robust local data fetcher directly inside this file
            const facilitiesByDate = await fetchFacilitiesHistoryMultiDate(statesToQuery, targetDates.map(d => d.toISOString()));
            
            const dateLabels = targetDates.map(d => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', day: dateMode !== 'last6months' ? 'numeric' : undefined }));
            
            const processService = (facilities, serviceCheckFn, toolKeys) => {
                let filtered = facilities;
                if (selectedLocality) filtered = filtered.filter(f => f['المحلية'] === selectedLocality);
                
                const baseDenominator = filtered.length;
                if (baseDenominator === 0) return { total: { num: 0, perc: 0, base: 0 }, tools: toolKeys.reduce((acc, k) => ({...acc, [k.key]: { num: 0, perc: 0 }}), {}) };

                const serviceProviders = filtered.filter(serviceCheckFn);
                const toolsAgg = toolKeys.reduce((acc, k) => {
                    const count = serviceProviders.filter(f => f[k.key] === 'Yes').length;
                    acc[k.key] = { num: count, perc: Math.round((count / Math.max(serviceProviders.length, 1)) * 100) };
                    return acc;
                }, {});

                return {
                    total: { num: serviceProviders.length, perc: Math.round((serviceProviders.length / baseDenominator) * 100), base: baseDenominator },
                    tools: toolsAgg
                };
            };

            const servicesData = targetDates.map((date, idx) => {
                const dayFacilities = facilitiesByDate[idx] || [];
                return {
                    imnci: processService(
                        dayFacilities.filter(f => ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(normalizeStr(f['نوع_المؤسسةالصحية'])) && f['هل_المؤسسة_تعمل'] === 'Yes'),
                        f => f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes',
                        [ { key: 'وجود_سجل_علاج_متكامل', label: 'IMNCI Register' }, { key: 'وجود_كتيب_لوحات', label: 'Chart Booklet' }, { key: 'ميزان_وزن', label: 'Weight Scale' }, { key: 'ساعة_مؤقت', label: 'Timer' } ]
                    ),
                    eenc: processService(
                        dayFacilities.filter(f => ['BEmONC', 'CEmONC'].includes(normalizeStr(f.eenc_service_type)) && f['هل_المؤسسة_تعمل'] === 'Yes'),
                        f => f.eenc_provides_essential_care === 'Yes',
                        [ { key: 'eenc_steam_sterilizer', label: 'Steam Sterilizer' }, { key: 'eenc_wall_clock', label: 'Wall Clock' } ]
                    ),
                    neonatal: processService(
                        dayFacilities.filter(f => ['CEmONC', 'pediatric'].includes(normalizeStr(f.eenc_service_type)) || f.neonatal_level_secondary === 'Yes' || f.neonatal_level_tertiary === 'Yes' || f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary),
                        f => f.neonatal_level_secondary === 'Yes' || f.neonatal_level_of_care?.secondary === true || f.neonatal_level_tertiary === 'Yes' || f.neonatal_level_of_care?.tertiary === true,
                        [ { key: 'neonatal_kmc_unit', label: 'KMC Unit' }, { key: 'neonatal_breastfeeding_unit', label: 'Breastfeeding Unit' } ]
                    ),
                    critical: processService(
                        dayFacilities.filter(f => ['مستشفى', 'مستشفى ريفي'].includes(normalizeStr(f['نوع_المؤسسةالصحية'])) || normalizeStr(f.eenc_service_type) === 'pediatric'),
                        f => f.etat_has_service === 'Yes',
                        [ { key: 'hdu_has_service', label: 'HDU Service' }, { key: 'picu_has_service', label: 'PICU Service' } ]
                    )
                };
            });

            setHistoryData({ labels: dateLabels, metrics: servicesData });
        } catch (error) {
            console.error("Failed to load aggregate history:", error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch removed. User must explicitly click Load / Apply Filters.

    const renderServiceBlock = (serviceKey, serviceTitle, toolConfig, mainColor) => {
        if (!historyData) return null;
        const labels = historyData.labels;
        const dataSequence = historyData.metrics.map(m => m[serviceKey]);

        const lines = [
            { label: t('facilities_page.history.overall_service_pct', 'Overall Service %'), color: mainColor, data: dataSequence.map(d => d.total.perc) },
            ...toolConfig.map((tool, idx) => ({
                label: tool.label,
                color: `hsl(${idx * 40 + 10}, 70%, 50%)`,
                data: dataSequence.map(d => d.tools[tool.key].perc)
            }))
        ];

        return (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">{serviceTitle}</h3>
                <div className="flex flex-col xl:flex-row gap-8">
                    <div className="flex-1 overflow-x-auto">
                        <Table headers={[t('facilities_page.history.metric', 'Metric'), ...labels]}>
                            <tr className="bg-sky-50 font-semibold border-b-2 border-sky-200">
                                <td className="p-3 text-sky-900 font-bold whitespace-nowrap">{t('facilities_page.history.total_providing', 'Total Facilities Providing Service')}</td>
                                {dataSequence.map((d, i) => (
                                    <td key={i} className="p-3 text-center min-w-[100px]">
                                        <div className="text-sky-800 text-lg">{d.total.num} <span className="text-xs text-gray-500 font-normal">/ {d.total.base}</span></div>
                                        <div className="text-sm font-bold bg-sky-200/50 rounded-full px-2 py-0.5 inline-block mt-1">{d.total.perc}%</div>
                                    </td>
                                ))}
                            </tr>
                            {toolConfig.map(tool => (
                                <tr key={tool.key} className="hover:bg-gray-50 border-b border-gray-100">
                                    <td className="p-3 text-gray-700 font-medium whitespace-nowrap">{tool.label}</td>
                                    {dataSequence.map((d, i) => (
                                        <td key={i} className="p-3 text-center">
                                            <div className="text-gray-800 font-semibold">{d.tools[tool.key].num}</div>
                                            <div className="text-xs text-gray-500">{d.tools[tool.key].perc}%</div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </Table>
                    </div>
                    <div className="w-full xl:w-[500px] flex-shrink-0">
                        <MultiLineChart dates={labels} lines={lines} title={t('facilities_page.history.trend_title', '{{title}} Trend', { title: serviceTitle })} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card>
            <div className="p-6">
                <div className="flex items-center gap-4 mb-6 border-b pb-4">
                    <Button variant="secondary" onClick={onBack} className="me-4">
                        <ArrowLeft className="w-4 h-4 me-1 inline" /> {t('facilities_page.common.back', 'Back')}
                    </Button>
                    <PageHeader 
                        title={t('facilities_page.history.agg_title', 'Comprehensive Service & Tool Coverage')} 
                        subtitle={t('facilities_page.history.agg_subtitle', 'Track facility service provision and equipment availability over specific dates.')}
                    />
                </div>
                <div className="bg-gray-50 p-5 border border-gray-200 rounded-xl mb-8 shadow-sm flex flex-wrap gap-5 items-end">
                    <FormGroup label={t('facilities_page.history.date_range_mode', 'Date Range Mode')} className="flex-1 min-w-[180px]">
                        <Select value={dateMode} onChange={e => setDateMode(e.target.value)}>
                            <option value="last6months">{t('facilities_page.history.mode_last6months', 'Last 6 Months Trend')}</option>
                            <option value="range">{t('facilities_page.history.mode_range', 'Compare Two Dates')}</option>
                            <option value="exact">{t('facilities_page.history.mode_exact', 'Exact Date')}</option>
                        </Select>
                    </FormGroup>

                    {dateMode === 'exact' && (
                        <FormGroup label={t('facilities_page.history.target_date', 'Target Date')} className="flex-1 min-w-[150px]">
                            <Input type="date" value={exactDate} onChange={e => setExactDate(e.target.value)} />
                        </FormGroup>
                    )}

                    {dateMode === 'range' && (
                        <>
                            <FormGroup label={t('facilities_page.history.start_date', 'Start Date')} className="flex-1 min-w-[150px]">
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </FormGroup>
                            <FormGroup label={t('facilities_page.history.end_date', 'End Date')} className="flex-1 min-w-[150px]">
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </FormGroup>
                        </>
                    )}

                    <FormGroup label={t('facilities_page.history.filter_by_state', 'Filter by State')} className="flex-1 min-w-[180px]">
                        <Select value={selectedState} onChange={e => { setSelectedState(e.target.value); setSelectedLocality(''); }}>
                            <option value="">{t('facilities_page.history.all_permitted_states', 'All Permitted States')}</option>
                            {availableStates.map(s => <option key={s} value={s}>{STATE_LOCALITIES[s]?.ar || s}</option>)}
                        </Select>
                    </FormGroup>

                    <FormGroup label={t('facilities_page.history.filter_by_locality', 'Filter by Locality')} className="flex-1 min-w-[180px]">
                        <Select value={selectedLocality} onChange={e => setSelectedLocality(e.target.value)} disabled={!selectedState}>
                            <option value="">{t('facilities_page.history.all_localities', 'All Localities')}</option>
                            {selectedState && STATE_LOCALITIES[selectedState]?.localities.map(l => (
                                <option key={l.en} value={l.en}>{l.ar}</option>
                            ))}
                        </Select>
                    </FormGroup>

                    <div className="flex-1 min-w-[150px]">
                        <Button variant="primary" onClick={handleFetchData} className="w-full ">{t('facilities_page.history.load_apply', 'Load / Apply Filters')}</Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col justify-center items-center h-64 space-y-4">
                        <Spinner/>
                        <p className="text-gray-500 font-medium">{t('facilities_page.history.fetching', 'Fetching history and aggregating data...')}</p>
                    </div>
                ) : historyData ? (
                    <div className="animate-fade-in space-y-2">
                        {renderServiceBlock('imnci', t('facilities_page.history.svc_imnci', 'IMNCI Services'), [
                            { key: 'وجود_سجل_علاج_متكامل', label: t('facilities_page.history.tool_imnci_register', 'IMNCI Register') },
                            { key: 'وجود_كتيب_لوحات', label: t('facilities_page.history.tool_chart_booklet', 'Chart Booklet') },
                            { key: 'ميزان_وزن', label: t('facilities_page.history.tool_weight_scale', 'Weight Scale') },
                            { key: 'ساعة_مؤقت', label: t('facilities_page.history.tool_timer', 'Timer') }
                        ], '#0284c7')}

                        {renderServiceBlock('eenc', t('facilities_page.history.svc_eenc', 'EENC Services'), [
                            { key: 'eenc_steam_sterilizer', label: t('facilities_page.history.tool_steam_sterilizer', 'Steam Sterilizer') },
                            { key: 'eenc_wall_clock', label: t('facilities_page.history.tool_wall_clock', 'Wall Clock') }
                        ], '#0d9488')}

                        {renderServiceBlock('neonatal', t('facilities_page.history.svc_neonatal', 'Neonatal Care Unit'), [
                            { key: 'neonatal_kmc_unit', label: t('facilities_page.history.tool_kmc_unit', 'KMC Unit') },
                            { key: 'neonatal_breastfeeding_unit', label: t('facilities_page.history.tool_breastfeeding_unit', 'Breastfeeding Unit') }
                        ], '#4f46e5')}

                        {renderServiceBlock('critical', t('facilities_page.history.svc_critical', 'Emergency, Critical Care & ETAT'), [
                            { key: 'hdu_has_service', label: t('facilities_page.history.fields.hdu_service', 'HDU Service') },
                            { key: 'picu_has_service', label: t('facilities_page.history.fields.picu_service', 'PICU Service') }
                        ], '#be123c')}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-12">{t('facilities_page.history.no_data_loaded', 'No data loaded. Please apply filters.')}</div>
                )}
            </div>
        </Card>
    );
};

export default FacilityHistoryView;