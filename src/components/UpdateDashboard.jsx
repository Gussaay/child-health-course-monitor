// UpdateDashboard.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, Activity, Calendar, BarChart3, Filter, MapPin, UserCheck, TrendingUp } from 'lucide-react';
import { Card, Table, Button, FormGroup, Select } from './CommonComponents';
import { STATE_LOCALITIES } from './constants';
import { useTranslation } from 'react-i18next';
import { updateRecord, updateCounts, updateDashboardData, yearMonthOf } from '../dashboards/facilityUpdate';
import { SERVER_KPIS } from '../dashboards/serverKpiSwitch';
import { askServerKpis } from '../dashboards/serverKpis';

// The server counts months in Sudan time (docs/server-dashboard-kpis.md).
const SERVER_TIME_ZONE = 'Africa/Khartoum';

// Helper to translate locality to Arabic
const getLocalityName = (locKey) => {
    if (!locKey || locKey === 'Unknown') return 'غير محدد';
    for (const sKey in STATE_LOCALITIES) {
        const loc = STATE_LOCALITIES[sKey].localities.find(l => l.en === locKey);
        if (loc) return loc.ar;
    }
    return locKey;
};

export const UpdateDashboard = ({ facilities, onBack, scope = null }) => {
    const { t } = useTranslation();
    // Filter States - Defaulting timeFilter to THIS_MONTH
    const [stateFilter, setStateFilter] = useState('');
    const [localityFilter, setLocalityFilter] = useState('');
    const [timeFilter, setTimeFilter] = useState('THIS_MONTH');

    // The numbers come from src/dashboards/facilityUpdate.js: from the server's
    // counts when switched on, else (or when it cannot answer) from the
    // facility list this page already has.
    const [serverCells, setServerCells] = useState(null);
    const scopeKey = JSON.stringify(scope || {});
    useEffect(() => {
        if (!SERVER_KPIS.facilityUpdate) return undefined;
        let live = true;
        askServerKpis('facilityUpdate', { scope: JSON.parse(scopeKey), timeZone: SERVER_TIME_ZONE })
            .then((res) => { if (live) setServerCells(res.cells); })
            .catch((err) => console.warn('[update dashboard] server numbers not available, using the list:', err?.code || err?.message || err));
        return () => { live = false; };
    }, [scopeKey]);

    const localCells = useMemo(() => {
        if (serverCells || !facilities || facilities.length === 0) return null;
        return updateCounts(facilities.map(updateRecord));
    }, [facilities, serverCells]);

    const dashboardData = useMemo(() => {
        const cells = serverCells || localCells;
        if (!cells) return null;
        const now = serverCells ? yearMonthOf(Date.now(), SERVER_TIME_ZONE) : yearMonthOf(Date.now());
        return updateDashboardData(cells, { stateFilter, localityFilter, timeFilter, now });
    }, [serverCells, localCells, stateFilter, localityFilter, timeFilter]);

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
                    <ArrowLeft className="w-4 h-4 ms-1" /> الرجوع
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
                        <p className="text-xs text-gray-500 font-bold mb-1">تحديثات هذا الشهر</p>
                        <h3 className="text-lg font-extrabold text-gray-800 leading-tight">{updatedThisMonth}</h3>
                        <p className="text-sm font-semibold text-emerald-600 mt-1">{t('admin_pages.update_dashboard.activity_month', 'Activity in current month')}</p>
                    </div>
                </Card>

                <Card className="p-5 flex items-start gap-4 border-t-4 border-t-amber-500 shadow-sm bg-gradient-to-b from-white to-amber-50/30">
                    <div className="p-3 bg-amber-100 rounded-xl text-amber-600"><MapPin className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold mb-1">أكثر ولاية تحديثاً</p>
                        <h3 className="text-lg font-extrabold text-gray-800 leading-tight">
                            {topState ? (STATE_LOCALITIES[topState[0]]?.ar || topState[0]) : 'لا يوجد'}
                        </h3>
                        {topState && <p className="text-sm font-semibold text-amber-600 mt-1">{topState[1].total} منشأة محدثة</p>}
                    </div>
                </Card>

                <Card className="p-5 flex items-start gap-4 border-t-4 border-t-indigo-500 shadow-sm bg-gradient-to-b from-white to-indigo-50/30">
                    <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600"><TrendingUp className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold mb-1">أكثر محلية تحديثاً</p>
                        <h3 className="text-lg font-extrabold text-gray-800 leading-tight">
                            {topLocality ? getLocalityName(topLocality[0]) : 'لا يوجد'}
                        </h3>
                        {topLocality && <p className="text-sm font-semibold text-indigo-600 mt-1">{topLocality[1].total} منشأة محدثة</p>}
                    </div>
                </Card>

                <Card className="p-5 flex items-start gap-4 border-t-4 border-t-pink-500 shadow-sm bg-gradient-to-b from-white to-pink-50/30">
                    <div className="p-3 bg-pink-100 rounded-xl text-pink-600"><UserCheck className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold mb-1">أكثر مستخدم نشاطاً</p>
                        <h3 className="text-lg font-extrabold text-gray-800 leading-tight truncate max-w-[150px]" title={topUpdater ? topUpdater[0] : ''}>
                            {topUpdater ? (topUpdater[0] === 'System / Unknown' ? t('admin_pages.update_dashboard.system_unknown', 'System / Unknown') : topUpdater[0]) : 'لا يوجد'}
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
                    <Table headers={['الولاية (State)', 'إجمالي التحديثات', t('admin_pages.update_dashboard.svc.imnci', 'IMNCI Service'), t('admin_pages.update_dashboard.svc.eenc', 'EENC Service'), t('admin_pages.update_dashboard.svc.neonatal', 'Neonatal Service'), t('admin_pages.update_dashboard.svc.etat', 'ETAT Service')]}>
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
                    <Table headers={['المستخدم (Updater)', 'إجمالي التحديثات', t('admin_pages.update_dashboard.svc.imnci', 'IMNCI Service'), t('admin_pages.update_dashboard.svc.eenc', 'EENC Service'), t('admin_pages.update_dashboard.svc.neonatal', 'Neonatal Service'), t('admin_pages.update_dashboard.svc.etat', 'ETAT Service')]}>
                        {Object.entries(updaterStats).length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8 text-gray-500 font-medium">لا توجد بيانات مطابقة للبحث</td></tr>
                        ) : (
                            Object.entries(updaterStats).sort((a, b) => b[1].total - a[1].total).map(([updater, stats]) => (
                                <tr key={updater} className="hover:bg-emerald-50 transition-colors">
                                    <td className="font-bold text-gray-800 align-middle truncate max-w-xs" title={updater}>
                                        {updater === 'System / Unknown' ? t('admin_pages.update_dashboard.system_unknown', 'System / Unknown') : updater}
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