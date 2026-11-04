// ============================================================================
// USAGE COST PANEL (admin dashboard, Resource Usage tab)
//
// Who, which list, which page and which kind of activity the month's database
// reads and writes came from, with an estimated cost for each. The numbers are
// the operations the app counted itself (utils/usageLedger.js) priced at
// Firestore's list rates; the bill typed in beside them shows how much of the
// real cost the app cannot see (Cloud Functions, Storage, AI services).
// Read once per press of Refresh, not live, so looking at it costs almost nothing.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { RefreshCw, Database, Edit3, DollarSign, Info } from 'lucide-react';
import { db } from '../firebase';
import { Card, Button, Table, Spinner } from './CommonComponents';
import { DEFAULT_PRICES, monthKey, summariseUsage } from '../utils/usageLedger';

const PRICES_KEY = 'usageCost.prices';
const usd = (n) => `$${(n || 0) < 0.01 && n > 0 ? '<0.01' : (n || 0).toFixed(2)}`;
const num = (n) => (n || 0).toLocaleString();

const lastMonths = (count = 6) => {
    const out = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < count; i += 1) { out.push(monthKey(d)); d.setMonth(d.getMonth() - 1); }
    return out;
};

const loadPrices = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(PRICES_KEY) || 'null');
        if (saved && saved.read > 0 && saved.write > 0) return saved;
    } catch { /* use defaults */ }
    return DEFAULT_PRICES;
};

// A ranked table: name, reads, writes, estimated cost, share of the month.
const RankTable = ({ title, hint, rows, total, nameLabel, t, nameOf = (n) => n }) => (
    <Card className="shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-1 mb-3">
            <h3 className="text-md font-bold text-gray-800">{title}</h3>
            {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table
                headers={[nameLabel, t('admin_pages.admin_dashboard.usage_cost.reads', 'Reads'), t('admin_pages.admin_dashboard.usage_cost.writes', 'Writes'), t('admin_pages.admin_dashboard.usage_cost.cost', 'Est. cost'), t('admin_pages.admin_dashboard.usage_cost.share', 'Share')]}
                cardsOnPhone
            >
                {rows.map((r) => {
                    const share = total > 0 ? (r.cost / total) * 100 : 0;
                    return (
                        <tr key={r.name} className="hover:bg-gray-50">
                            <td className="font-medium text-gray-800 break-all">{nameOf(r.name)}</td>
                            <td className="font-mono text-emerald-700 bg-emerald-50/50">{num(r.reads)}</td>
                            <td className="font-mono text-amber-700 bg-amber-50/50">{num(r.writes)}</td>
                            <td className="font-mono font-bold text-gray-800">{usd(r.cost)}</td>
                            <td className="text-gray-600 whitespace-nowrap">
                                <span className="inline-block h-1.5 rounded bg-sky-500 align-middle me-2" style={{ width: `${Math.max(2, Math.min(60, share * 0.6))}px` }} />
                                {share.toFixed(1)}%
                            </td>
                        </tr>
                    );
                })}
            </Table>
            {rows.length === 0 && <div className="text-center py-8 text-gray-400 bg-gray-50 text-sm">{t('admin_pages.admin_dashboard.usage_cost.none', 'Nothing recorded for this month yet.')}</div>}
        </div>
    </Card>
);

export default function UsageCostPanel() {
    const { t, i18n } = useTranslation();
    const months = useMemo(() => lastMonths(6), []);
    const [month, setMonth] = useState(months[0]);
    const [docs, setDocs] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [bill, setBill] = useState('');
    const [savedBill, setSavedBill] = useState(null);
    const [savingBill, setSavingBill] = useState(false);
    const [prices, setPrices] = useState(loadPrices);
    const [showPrices, setShowPrices] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const snap = await getDocs(query(collection(db, 'usageMonthly'), where('month', '==', month)));
            setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            const billSnap = await getDoc(doc(db, 'usageBills', month));
            const v = billSnap.exists() ? billSnap.data().actualUsd : null;
            setSavedBill(v);
            setBill(v == null ? '' : String(v));
        } catch (e) {
            console.warn('Usage cost load failed:', e);
            setError(e?.code === 'permission-denied'
                ? t('admin_pages.admin_dashboard.usage_cost.denied', 'Only a super user can read the monthly usage. If you are one, deploy the updated Firestore rules.')
                : (e?.message || 'Could not load.'));
            setDocs(null);
        } finally { setLoading(false); }
    }, [month, t]);

    useEffect(() => { load(); }, [load]);

    const summary = useMemo(() => summariseUsage(docs || [], prices), [docs, prices]);
    const est = summary.totals.cost;
    const billNum = parseFloat(bill);
    const hasBill = Number.isFinite(billNum) && billNum > 0;
    const unexplained = hasBill ? billNum - est : null;

    const saveBill = async () => {
        setSavingBill(true);
        try {
            await setDoc(doc(db, 'usageBills', month), { actualUsd: hasBill ? billNum : null, updatedAt: serverTimestamp() }, { merge: true });
            setSavedBill(hasBill ? billNum : null);
        } catch (e) { setError(e?.message || 'Could not save.'); } finally { setSavingBill(false); }
    };
    const changePrice = (key, per100k) => {
        const v = parseFloat(per100k);
        if (!(v > 0)) return;
        const next = { ...prices, [key]: v / 100000 };
        setPrices(next);
        try { localStorage.setItem(PRICES_KEY, JSON.stringify(next)); } catch { /* not saved */ }
    };

    const SOURCE_LABELS = {
        user: t('admin_pages.admin_dashboard.usage_cost.src_user', 'The user\'s own actions'),
        live: t('admin_pages.admin_dashboard.usage_cost.src_live', 'Live updates (listeners)'),
        'auto-sync': t('admin_pages.admin_dashboard.usage_cost.src_auto', 'Automatic sync'),
        refresh: t('admin_pages.admin_dashboard.usage_cost.src_refresh', 'Refresh button'),
    };
    const monthLabel = (m) => {
        const [y, mo] = m.split('-').map(Number);
        return new Date(y, mo - 1, 1).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
    };

    return (
        <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-50 rounded-full shrink-0"><DollarSign className="w-6 h-6 text-rose-500" /></div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">{t('admin_pages.admin_dashboard.usage_cost.title', 'What costs money, and who')}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{t('admin_pages.admin_dashboard.usage_cost.desc', 'Database reads and writes by month, with an estimated cost for each user, list and page.')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label={t('admin_pages.admin_dashboard.usage_cost.month', 'Month')} className="border border-gray-300 rounded-md p-2 text-sm font-semibold bg-white">
                            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                        </select>
                        <Button variant="secondary" onClick={load} disabled={loading} className="flex items-center gap-1.5">
                            {loading ? <Spinner size="sm" /> : <RefreshCw size={14} />} {t('admin_pages.admin_dashboard.usage_cost.refresh', 'Refresh')}
                        </Button>
                    </div>
                </div>
                {error && <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-rose-700 mb-1">{t('admin_pages.admin_dashboard.usage_cost.estimate', 'Estimated database cost')}</div>
                    <div className="text-3xl font-black text-rose-900">{usd(est)}</div>
                    <div className="text-xs text-rose-600 mt-1">{t('admin_pages.admin_dashboard.usage_cost.users_n', '{{count}} user(s) reporting', { count: summary.totals.users })}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1"><Database size={12} /> {t('admin_pages.admin_dashboard.usage_cost.reads', 'Reads')}</div>
                    <div className="text-3xl font-black text-emerald-900">{num(summary.totals.reads)}</div>
                    <div className="text-xs text-emerald-600 mt-1">{usd(summary.totals.reads * prices.read)}</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1"><Edit3 size={12} /> {t('admin_pages.admin_dashboard.usage_cost.writes', 'Writes')}</div>
                    <div className="text-3xl font-black text-amber-900">{num(summary.totals.writes)}</div>
                    <div className="text-xs text-amber-600 mt-1">{usd(summary.totals.writes * prices.write)}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-slate-700 mb-1">{t('admin_pages.admin_dashboard.usage_cost.bill', 'The bill for this month (USD)')}</div>
                    <div className="flex items-center gap-2">
                        <input type="number" inputMode="decimal" step="0.01" min="0" value={bill} onChange={(e) => setBill(e.target.value)} placeholder="8.00"
                            className="w-24 border border-slate-300 rounded p-1.5 text-lg font-bold text-slate-900 bg-white" />
                        <Button onClick={saveBill} disabled={savingBill || (hasBill ? billNum : null) === savedBill} className="text-xs">{t('admin_pages.admin_dashboard.usage_cost.save', 'Save')}</Button>
                    </div>
                    {unexplained !== null && (
                        <div className={`text-xs mt-2 font-semibold ${unexplained > 0.5 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {unexplained > 0
                                ? t('admin_pages.admin_dashboard.usage_cost.unexplained', '{{amount}} is not explained by the counted reads and writes', { amount: usd(unexplained) })
                                : t('admin_pages.admin_dashboard.usage_cost.explained', 'The counted operations cover the bill')}
                        </div>
                    )}
                </div>
            </div>

            <RankTable
                title={t('admin_pages.admin_dashboard.usage_cost.by_user', 'Who')}
                hint={t('admin_pages.admin_dashboard.usage_cost.by_user_hint', 'Each person\'s own phone or browser, highest cost first.')}
                nameLabel={t('admin_pages.admin_dashboard.usage_cost.col_user', 'User')}
                rows={summary.byUser} total={est} t={t}
            />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <RankTable
                    title={t('admin_pages.admin_dashboard.usage_cost.by_list', 'Which list')}
                    hint={t('admin_pages.admin_dashboard.usage_cost.by_list_hint', 'The database collection read or written.')}
                    nameLabel={t('admin_pages.admin_dashboard.usage_cost.col_list', 'List')}
                    rows={summary.byCollection} total={est} t={t}
                />
                <RankTable
                    title={t('admin_pages.admin_dashboard.usage_cost.by_page', 'Which page')}
                    hint={t('admin_pages.admin_dashboard.usage_cost.by_page_hint', 'The screen the user was on.')}
                    nameLabel={t('admin_pages.admin_dashboard.usage_cost.col_page', 'Page')}
                    rows={summary.byView} total={est} t={t}
                />
            </div>
            <RankTable
                title={t('admin_pages.admin_dashboard.usage_cost.by_source', 'What triggered it')}
                hint={t('admin_pages.admin_dashboard.usage_cost.by_source_hint', 'A user\'s own action, live updates, the automatic sync, or the Refresh button.')}
                nameLabel={t('admin_pages.admin_dashboard.usage_cost.col_source', 'Activity')}
                nameOf={(n) => SOURCE_LABELS[n] || n}
                rows={summary.bySource} total={est} t={t}
            />

            <Card className="shadow-sm border border-gray-100">
                <div className="flex items-start gap-3 text-sm text-gray-600">
                    <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                        <p>{t('admin_pages.admin_dashboard.usage_cost.note_estimate', 'This is an estimate from the reads and writes the app counted itself, priced at the rates below. It is not Google\'s bill: Cloud Functions, file storage, hosting and the AI services are not in it, so a bill above the estimate is expected. Counting started with the version that added it; phones still on an older version are not included.')}</p>
                        <p>{t('admin_pages.admin_dashboard.usage_cost.note_overhead', 'Counting itself costs {{amount}} this month ({{count}} writes), included above.', { amount: usd(summary.totals.trackingCost), count: num(summary.totals.trackingWrites) })}</p>
                        <button type="button" onClick={() => setShowPrices((s) => !s)} className="text-sky-700 font-semibold hover:underline">
                            {t('admin_pages.admin_dashboard.usage_cost.rates', 'Rates used')} ({showPrices ? '−' : '+'})
                        </button>
                        {showPrices && (
                            <div className="flex flex-wrap items-center gap-4">
                                {[['read', t('admin_pages.admin_dashboard.usage_cost.rate_read', 'per 100,000 reads')], ['write', t('admin_pages.admin_dashboard.usage_cost.rate_write', 'per 100,000 writes')]].map(([k, label]) => (
                                    <label key={k} className="flex items-center gap-2">
                                        <span>$</span>
                                        <input type="number" step="0.001" min="0" defaultValue={(prices[k] * 100000).toFixed(3)} onBlur={(e) => changePrice(k, e.target.value)} className="w-24 border border-gray-300 rounded p-1.5 bg-white" />
                                        <span>{label}</span>
                                    </label>
                                ))}
                                <span className="text-xs text-gray-500">{t('admin_pages.admin_dashboard.usage_cost.rates_hint', 'Check your region\'s prices on the Firebase pricing page.')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
