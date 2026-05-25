// UpdateDashboard.jsx
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Activity, Calendar, BarChart3, Filter, MapPin, UserCheck, TrendingUp } from 'lucide-react';
import { Card, Table, Button, FormGroup, Select } from './CommonComponents';
import { STATE_LOCALITIES } from './constants';

// Helper to translate locality to Arabic
const getLocalityName = (locKey) => {
    if (!locKey || locKey === 'Unknown') return 'غير محدد';
    for (const sKey in STATE_LOCALITIES) {
        const loc = STATE_LOCALITIES[sKey].localities.find(l => l.en === locKey);
        if (loc) return loc.ar;
    }
    return locKey;
};

// Robust Date Extractors
const getValidDate = (val) => {
    if (!val) return null;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

const getUpdateDate = (f) => {
    return getValidDate(f.lastSnapshotAt) || getValidDate(f['اخر تحديث']) || getValidDate(f.updatedAt);
};

const getCreationDate = (f) => {
    return getValidDate(f.createdAt) || getValidDate(f.created_at);
};

// --- USER NAME NORMALIZATION HELPERS ---
// Pass 1: Build a map of email -> Name from facilities that have the format "Name (email)"
const buildEmailToNameMap = (facilities) => {
    const map = {};
    facilities.forEach(f => {
        const raw = f.updated_by;
        if (!raw) return;
        const cleaned = raw.replace(/^Cleaned by\s+/i, '').trim();
        const match = cleaned.match(/^(.*?)\s*\((.*?@.*?)\)$/);
        if (match) {
            const name = match[1].trim();
            const email = match[2].trim().toLowerCase();
            if (name && email) map[email] = name;
        }
    });
    return map;
};

// Pass 2: Normalize the string using the map
const normalizeUpdater = (raw, emailMap) => {
    if (!raw) return 'System / Unknown';
    
    // Remove 'Cleaned by ' prefix
    let s = raw.replace(/^Cleaned by\s+/i, '').trim();
    
    // Group system/unknown variants
    const lower = s.toLowerCase();
    if (lower === 'system' || lower === 'unknown uploader' || lower === 'unknown / system' || lower === 'unknown') {
        return 'System / Unknown';
    }

    // Extract Name if format is "Name (email)"
    const match = s.match(/^(.*?)\s*\((.*?@.*?)\)$/);
    if (match) {
        return match[1].trim(); 
    }

    // If it's an email, check if we have mapped it to a name, otherwise use email prefix
    if (s.includes('@')) {
        const email = s.trim().toLowerCase();
        if (emailMap[email]) return emailMap[email];
        return email.split('@')[0];
    }

    return s;
};

export const UpdateDashboard = ({ facilities, onBack }) => {
    // Filter States - Defaulting timeFilter to THIS_MONTH
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [timeFilter, setTimeFilter] = useState('THIS_MONTH');

    const dashboardData = useMemo(() => {
        if (!facilities || facilities.length === 0) return null;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let updatedThisMonth = 0;
        
        const stateStats = {};
        const localityStats = {};
        const updaterStats = {};

        // Generate email->name dictionary for robust grouping
        const emailToNameMap = buildEmailToNameMap(facilities);

        // Helper: Check if a specific service form has data
        const hasServiceData = (f, service) => {
            switch(service) {
                case 'IMNCI': return f['وجود_العلاج_المتكامل_لامراض_الطفولة'] != null && f['وجود_العلاج_المتكامل_لامراض_الطفولة'] !== '';
                case 'EENC': return f.eenc_provides_essential_care != null && f.eenc_provides_essential_care !== '';
                case 'Neonatal': return (f.neonatal_level_of_care && Object.keys(f.neonatal_level_of_care).length > 0) || f.neonatal_level_primary != null || f.neonatal_level_secondary != null || f.neonatal_level_tertiary != null;
                case 'ETAT': return f.etat_has_service != null && f.etat_has_service !== '';
                default: return false;
            }
        };

        // Helper: Verify if facility was updated AFTER initial creation safely
        const isUpdatedAfterCreation = (f) => {
            const uDate = getUpdateDate(f);
            const cDate = getCreationDate(f);
            
            const updatedMs = uDate ? uDate.getTime() : 0;
            const createdMs = cDate ? cDate.getTime() : 0;

            if (createdMs > 0 && updatedMs > 0) {
                if ((updatedMs - createdMs) > 60000) return true;
                if (f.revision > 1 || (Array.isArray(f.history) && f.history.length > 0)) return true;
                return false;
            }

            if (createdMs === 0 && updatedMs > 0) return true;
            if (f.updated_by && f.updated_by !== 'System' && f.updated_by !== 'Unknown Uploader') return true;

            return false;
        };

        // Apply Core Filters
        const filteredFacilities = facilities.filter(f => {
            if (!isUpdatedAfterCreation(f)) return false;

            if (stateFilter && f['الولاية'] !== stateFilter) return false;
            if (localityFilter && f['المحلية'] !== localityFilter) return false;

            const updatedDate = getUpdateDate(f);
            if (!updatedDate) return false;

            const uMonth = updatedDate.getMonth();
            const uYear = updatedDate.getFullYear();

            if (timeFilter === 'THIS_MONTH') {
                if (uMonth !== currentMonth || uYear !== currentYear) return false;
            } else if (timeFilter === 'LAST_MONTH') {
                const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                if (uMonth !== lastMonth || uYear !== lastMonthYear) return false;
            } else if (timeFilter === 'THIS_YEAR') {
                if (uYear !== currentYear) return false;
            } else if (timeFilter === 'LAST_YEAR') {
                if (uYear !== currentYear - 1) return false;
            }

            return true;
        });

        // Calculate Metrics on the Filtered Subset
        filteredFacilities.forEach(f => {
            const updatedDate = getUpdateDate(f);
            
            if (updatedDate && updatedDate.getMonth() === currentMonth && updatedDate.getFullYear() === currentYear) {
                updatedThisMonth++;
            }

            // Aggregate by State
            const stateKey = f['الولاية'] || 'Unknown';
            if (!stateStats[stateKey]) stateStats[stateKey] = { total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
            stateStats[stateKey].total++;

            // Aggregate by Locality (For KPI box)
            const locKey = f['المحلية'] || 'Unknown';
            if (!localityStats[locKey]) localityStats[locKey] = { total: 0 };
            localityStats[locKey].total++;

            // Aggregate by Normalized Updater Name
            const updaterName = normalizeUpdater(f.updated_by, emailToNameMap);
            if (!updaterStats[updaterName]) updaterStats[updaterName] = { total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
            updaterStats[updaterName].total++;

            // Tally Service Updates
            ['IMNCI', 'EENC', 'Neonatal', 'ETAT'].forEach(svc => {
                if (hasServiceData(f, svc)) {
                    stateStats[stateKey][svc]++;
                    updaterStats[updaterName][svc]++;
                }
            });
        });

        // Top KPIs computation
        const topState = Object.entries(stateStats).sort((a, b) => b[1].total - a[1].total)[0];
        const topLocality = Object.entries(localityStats).sort((a, b) => b[1].total - a[1].total)[0];
        const topUpdater = Object.entries(updaterStats).sort((a, b) => b[1].total - a[1].total)[0];

        return { 
            updatedThisMonth, 
            stateStats, 
            updaterStats,
            topState,
            topLocality,
            topUpdater
        };
    }, [facilities, stateFilter, localityFilter, timeFilter]);

    if (!dashboardData) return null;

    const { updatedThisMonth, stateStats, updaterStats, topState, topLocality, topUpdater } = dashboardData;

    // Cell Formatting: Number and Percentage Inline
    const formatCell = (count, total) => {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        return (
            <div className="flex items-center justify-center gap-1.5">
                <span className="font-bold text-gray-800">{count}</span>
                <span className="text-xs text-gray-500 font-semibold bg-gray-100 px-1.5 py-0.5 rounded">({pct}%)</span>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-6 animate-fade-in" dir="rtl">
            <div className="flex items-center gap-4 mb-2">
                <Button variant="secondary" onClick={onBack} className="flex items-center gap-2 shadow-sm">
                    <ArrowLeft className="w-4 h-4 ml-1" /> الرجوع
                </Button>
                <div>
                    <h2 className="text-2xl font-extrabold text-sky-900">لوحة متابعة تحديثات المنشآت</h2>
                    <p className="text-sm text-gray-600">عرض المنشآت التي تم تحديثها بعد الإدخال الأول فقط.</p>
                </div>
            </div>

            {/* Top Insight KPI Boxes (One Row) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                <Card className="p-5 flex items-start gap-4 border-t-4 border-t-emerald-500 shadow-sm bg-gradient-to-b from-white to-emerald-50/30">
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600"><Calendar className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">تحديثات هذا الشهر</p>
                        <h3 className="text-lg font-extrabold text-gray-800 leading-tight">{updatedThisMonth}</h3>
                        <p className="text-sm font-semibold text-emerald-600 mt-1">Activity in current month</p>
                    </div>
                </Card>

                <Card className="p-5 flex items-start gap-4 border-t-4 border-t-amber-500 shadow-sm bg-gradient-to-b from-white to-amber-50/30">
                    <div className="p-3 bg-amber-100 rounded-xl text-amber-600"><MapPin className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">أكثر ولاية تحديثاً</p>
                        <h3 className="text-lg font-extrabold text-gray-800 leading-tight">
                            {topState ? (STATE_LOCALITIES[topState[0]]?.ar || topState[0]) : 'لا يوجد'}
                        </h3>
                        {topState && <p className="text-sm font-semibold text-amber-600 mt-1">{topState[1].total} منشأة محدثة</p>}
                    </div>
                </Card>

                <Card className="p-5 flex items-start gap-4 border-t-4 border-t-indigo-500 shadow-sm bg-gradient-to-b from-white to-indigo-50/30">
                    <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600"><TrendingUp className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">أكثر محلية تحديثاً</p>
                        <h3 className="text-lg font-extrabold text-gray-800 leading-tight">
                            {topLocality ? getLocalityName(topLocality[0]) : 'لا يوجد'}
                        </h3>
                        {topLocality && <p className="text-sm font-semibold text-indigo-600 mt-1">{topLocality[1].total} منشأة محدثة</p>}
                    </div>
                </Card>

                <Card className="p-5 flex items-start gap-4 border-t-4 border-t-pink-500 shadow-sm bg-gradient-to-b from-white to-pink-50/30">
                    <div className="p-3 bg-pink-100 rounded-xl text-pink-600"><UserCheck className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">أكثر مستخدم نشاطاً</p>
                        <h3 className="text-lg font-extrabold text-gray-800 leading-tight truncate max-w-[150px]" title={topUpdater ? topUpdater[0] : ''}>
                            {topUpdater ? topUpdater[0] : 'لا يوجد'}
                        </h3>
                        {topUpdater && <p className="text-sm font-semibold text-pink-600 mt-1">{topUpdater[1].total} عملية تحديث</p>}
                    </div>
                </Card>
            </div>

            {/* Filters Section */}
            <Card className="p-5 bg-white border border-gray-100 shadow-sm mb-6">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                    <Filter className="w-5 h-5 text-sky-600" />
                    <h3 className="font-bold text-gray-700">فلاتر التحديثات (Filters)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormGroup label="الولاية (State)">
                        <Select 
                            value={stateFilter} 
                            onChange={(e) => { setStateFilter(e.target.value); setLocalityFilter(''); }}
                            className="bg-gray-50"
                        >
                            <option value="">جميع الولايات (All States)</option>
                            {Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(sKey => (
                                <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>
                            ))}
                        </Select>
                    </FormGroup>
                    <FormGroup label="المحلية (Locality)">
                        <Select 
                            value={localityFilter} 
                            onChange={(e) => setLocalityFilter(e.target.value)}
                            disabled={!stateFilter}
                            className="bg-gray-50"
                        >
                            <option value="">جميع المحليات (All Localities)</option>
                            {stateFilter && STATE_LOCALITIES[stateFilter]?.localities.map(l => (
                                <option key={l.en} value={l.en}>{l.ar}</option>
                            ))}
                        </Select>
                    </FormGroup>
                    <FormGroup label="الفترة الزمنية (Time Period)">
                        <Select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="bg-gray-50">
                            <option value="ALL">جميع الأوقات (All Time)</option>
                            <option value="THIS_MONTH">هذا الشهر (This Month)</option>
                            <option value="LAST_MONTH">الشهر الماضي (Last Month)</option>
                            <option value="THIS_YEAR">هذا العام (This Year)</option>
                            <option value="LAST_YEAR">العام الماضي (Last Year)</option>
                        </Select>
                    </FormGroup>
                </div>
            </Card>

            {/* Disaggregated by State Table */}
            <Card className="overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-bold text-gray-800">التحديثات حسب الولاية (Disaggregated by State)</h3>
                </div>
                <div className="p-0">
                    <Table headers={['الولاية (State)', 'إجمالي التحديثات', 'IMNCI Service', 'EENC Service', 'Neonatal Service', 'ETAT Service']}>
                        {Object.entries(stateStats).length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8 text-gray-500 font-medium">لا توجد بيانات مطابقة للبحث</td></tr>
                        ) : (
                            Object.entries(stateStats).sort((a, b) => b[1].total - a[1].total).map(([stateKey, stats]) => (
                                <tr key={stateKey} className="hover:bg-sky-50 transition-colors">
                                    <td className="font-bold text-gray-800 align-middle">
                                        {STATE_LOCALITIES[stateKey]?.ar || stateKey}
                                    </td>
                                    <td className="align-middle text-center font-extrabold text-sky-700 bg-sky-50/50">{stats.total}</td>
                                    <td className="align-middle">{formatCell(stats.IMNCI, stats.total)}</td>
                                    <td className="align-middle">{formatCell(stats.EENC, stats.total)}</td>
                                    <td className="align-middle">{formatCell(stats.Neonatal, stats.total)}</td>
                                    <td className="align-middle">{formatCell(stats.ETAT, stats.total)}</td>
                                </tr>
                            ))
                        )}
                    </Table>
                </div>
            </Card>

            {/* Disaggregated by Updater Table */}
            <Card className="overflow-hidden shadow-sm mt-8">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-bold text-gray-800">التحديثات حسب المستخدم (Updates by User)</h3>
                </div>
                <div className="p-0">
                    <Table headers={['المستخدم (Updater)', 'إجمالي التحديثات', 'IMNCI Service', 'EENC Service', 'Neonatal Service', 'ETAT Service']}>
                        {Object.entries(updaterStats).length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8 text-gray-500 font-medium">لا توجد بيانات مطابقة للبحث</td></tr>
                        ) : (
                            Object.entries(updaterStats).sort((a, b) => b[1].total - a[1].total).map(([updater, stats]) => (
                                <tr key={updater} className="hover:bg-emerald-50 transition-colors">
                                    <td className="font-bold text-gray-800 align-middle truncate max-w-xs" title={updater}>
                                        {updater}
                                    </td>
                                    <td className="align-middle text-center font-extrabold text-emerald-700 bg-emerald-50/50">{stats.total}</td>
                                    <td className="align-middle">{formatCell(stats.IMNCI, stats.total)}</td>
                                    <td className="align-middle">{formatCell(stats.EENC, stats.total)}</td>
                                    <td className="align-middle">{formatCell(stats.Neonatal, stats.total)}</td>
                                    <td className="align-middle">{formatCell(stats.ETAT, stats.total)}</td>
                                </tr>
                            ))
                        )}
                    </Table>
                </div>
            </Card>
        </div>
    );
};

export default UpdateDashboard;