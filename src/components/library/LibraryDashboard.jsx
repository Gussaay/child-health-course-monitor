// Child Health Library dashboard: who downloads what, from where, how often.
// Federal managers and super users only (firestore.rules: libraryEvents read).
//
//   KPI tiles     downloads, downloaders, visits, shares, download rate, reach
//   trend         downloads, item views, visits and shares per day
//   breakdowns    by service, section, platform, signed-in vs public,
//                 state and locality (signed-in users), country (time zone),
//                 role, shared link vs in-app, referring site
//   tables        downloads of every item, the people who download, recent activity
//   export        everything to Excel
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Download, RefreshCw } from 'lucide-react';
import '../chartSetup';
import { CHART_COLORS, fadeColor } from '../chartSetup';
import { Button, Card, EmptyState, PageHeader, SkeletonCard } from '../CommonComponents';
import { notify } from '../dialogs';
import { LIBRARY_CATEGORIES, LIBRARY_SERVICES } from './libraryModel';
import { listLibraryEvents } from './libraryTracking';
import {
    change, countryFromTimeZone, dailySeries, eventMillis, filterEvents, groupCount, itemTable, kpis, peopleTable,
} from './libraryStats';

const DAY = 86400000;
const PERIODS = [
    { key: '7', days: 7, label: 'Last 7 days' },
    { key: '30', days: 30, label: 'Last 30 days' },
    { key: '90', days: 90, label: 'Last 90 days' },
    { key: '365', days: 365, label: 'Last 12 months' },
    { key: 'all', days: 0, label: 'All time' },
];

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const serviceShort = (key) => LIBRARY_SERVICES.find((s) => s.key === key)?.short || key || '—';
const categoryLabel = (key) => LIBRARY_CATEGORIES.find((c) => c.key === key)?.label || key || '—';
const TYPE_LABEL = { open: 'Download', view: 'Item viewed', visit: 'Library visit', share: 'Shared' };

function Kpi({ label, value, hint, delta, tone = 'sky' }) {
    const tones = { sky: 'text-sky-700', emerald: 'text-emerald-700', amber: 'text-amber-700', violet: 'text-violet-700', rose: 'text-rose-700', slate: 'text-slate-700' };
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl md:text-3xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                {delta !== undefined && delta !== null && (
                    <span className={`font-semibold ${delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                        {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta)}%
                    </span>
                )}
                {hint && <span>{hint}</span>}
            </div>
        </div>
    );
}

function Panel({ title, subtitle, children, className = '' }) {
    return (
        <Card className={`p-3 md:p-4 ${className}`}>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mb-2">{subtitle}</p>}
            <div className={subtitle ? '' : 'mt-2'}>{children}</div>
        </Card>
    );
}

// A ranked list with a bar for each row: the breakdown tables.
function RankList({ rows, empty = 'No downloads yet.', max = 10, label = (r) => r.key }) {
    if (!rows.length) return <p className="py-4 text-center text-sm text-slate-500">{empty}</p>;
    const top = rows[0].count || 1;
    return (
        <ul className="space-y-2">
            {rows.slice(0, max).map((r) => (
                <li key={r.key} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium text-slate-700" title={label(r)}>{label(r)}</span>
                        <span className="shrink-0 tabular-nums text-slate-600"><b className="text-slate-800">{r.count}</b> · {r.people} {r.people === 1 ? 'person' : 'people'}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${Math.max(3, (r.count / top) * 100)}%` }} />
                    </div>
                </li>
            ))}
            {rows.length > max && <li className="text-xs text-slate-500">+ {rows.length - max} more (in the Excel export)</li>}
        </ul>
    );
}

function Table({ headers, children }) {
    return (
        <div className="overflow-x-auto -mx-3 md:mx-0">
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 text-start text-xs uppercase tracking-wide text-slate-500">
                        {headers.map((h) => <th key={h} className="px-3 py-2 text-start font-semibold whitespace-nowrap">{h}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">{children}</tbody>
            </table>
        </div>
    );
}

const personLabel = (p) => (p.signedIn ? (p.name || p.email || 'Signed-in user') : 'Public visitor');
const placeOf = (p) => (p.signedIn ? [p.locality, p.state].filter(Boolean).join(', ') || '—' : p.country);

export default function LibraryDashboard({ items, onBack }) {
    const { t } = useTranslation();
    const [period, setPeriod] = useState('30');
    const [service, setService] = useState('');
    const [audience, setAudience] = useState('all');
    const [events, setEvents] = useState(null);
    const [loadedSince, setLoadedSince] = useState(null);
    const [error, setError] = useState('');
    const [showAllItems, setShowAllItems] = useState(false);

    const days = PERIODS.find((p) => p.key === period)?.days || 0;
    const now = Date.now();
    const from = days ? now - days * DAY : 0;
    // The period before, for the ▲▼ change on the tiles.
    const prevFrom = days ? from - days * DAY : 0;
    const needSince = days ? prevFrom : 0;

    const load = useCallback(async (since) => {
        setError('');
        try {
            setEvents(await listLibraryEvents(since));
            setLoadedSince(since);
        } catch (e) {
            console.error('Library events load failed:', e);
            setError(e?.message || 'Could not load the library activity.');
            setEvents((prev) => prev || []);
        }
    }, []);
    // Load once for the longest period asked so far; shorter periods reuse it.
    useEffect(() => {
        if (loadedSince === null || (loadedSince > 0 && (needSince === 0 || needSince < loadedSince))) load(needSince);
    }, [needSince, loadedSince, load]);

    const base = { service, audience };
    const current = useMemo(() => filterEvents(events, { ...base, from }), [events, service, audience, from]); // eslint-disable-line react-hooks/exhaustive-deps
    const previous = useMemo(() => (days ? filterEvents(events, { ...base, from: prevFrom, to: from - 1 }) : []), [events, service, audience, from, prevFrom, days]); // eslint-disable-line react-hooks/exhaustive-deps
    const shownItems = useMemo(() => (service ? (items || []).filter((it) => it.service === service) : (items || [])), [items, service]);

    const k = useMemo(() => kpis(current, shownItems), [current, shownItems]);
    const kPrev = useMemo(() => kpis(previous, shownItems), [previous, shownItems]);
    const delta = (key) => (days ? change(k[key], kPrev[key]) : undefined);

    const trend = useMemo(() => dailySeries(current, from, now), [current, from]); // eslint-disable-line react-hooks/exhaustive-deps
    const byService = useMemo(() => groupCount(current, (e) => serviceShort(e.service)), [current]);
    const byCategory = useMemo(() => groupCount(current, (e) => categoryLabel(e.category)), [current]);
    const byPlatform = useMemo(() => groupCount(current, (e) => e.platform || 'Unknown'), [current]);
    const byAudience = useMemo(() => groupCount(current, (e) => (e.signedIn ? 'Signed-in users' : 'Public (no sign-in)')), [current]);
    const byState = useMemo(() => groupCount(current.filter((e) => e.signedIn), (e) => e.state || 'No state on profile'), [current]);
    const byLocality = useMemo(() => groupCount(current.filter((e) => e.signedIn && e.locality), (e) => `${e.locality}${e.state ? ` (${e.state})` : ''}`), [current]);
    const byCountry = useMemo(() => groupCount(current, (e) => countryFromTimeZone(e.tz)), [current]);
    const byRole = useMemo(() => groupCount(current.filter((e) => e.signedIn), (e) => (e.role || 'user').replace(/_/g, ' ')), [current]);
    const byEntry = useMemo(() => groupCount(current, (e) => (e.entry === 'link' ? 'Shared link' : 'Inside the app')), [current]);
    const byReferrer = useMemo(() => groupCount(current.filter((e) => e.ref), (e) => e.ref, 'visit'), [current]);
    const itemsRows = useMemo(() => itemTable(current, shownItems), [current, shownItems]);
    const people = useMemo(() => peopleTable(current), [current]);
    const recent = useMemo(() => [...current].sort((a, b) => eventMillis(b.at) - eventMillis(a.at)).slice(0, 50), [current]);

    const exportExcel = async () => {
        try {
            const [{ default: ExcelJS }, { saveAs }] = await Promise.all([import('exceljs'), import('file-saver')]);
            const wb = new ExcelJS.Workbook();
            const sheet = (name, columns, rows) => {
                const ws = wb.addWorksheet(name);
                ws.columns = columns.map(([header, key, width = 18]) => ({ header, key, width }));
                ws.getRow(1).font = { bold: true };
                rows.forEach((r) => ws.addRow(r));
            };
            const periodLabel = PERIODS.find((p) => p.key === period)?.label;
            sheet('Summary', [['Indicator', 'k', 40], ['Value', 'v', 16]], [
                { k: 'Period', v: periodLabel }, { k: 'Service', v: service || 'All services' }, { k: 'Audience', v: audience },
                { k: 'Downloads', v: k.downloads }, { k: 'Unique downloaders', v: k.uniqueDownloaders },
                { k: 'Signed-in downloaders', v: k.signedInDownloaders }, { k: 'Public downloaders', v: k.publicDownloaders },
                { k: 'Visitors', v: k.visitors }, { k: 'Visits and item views', v: k.visits }, { k: 'Shares', v: k.shares },
                { k: 'Download rate (% of visits)', v: k.conversion }, { k: 'Downloads per downloader', v: k.perDownloader },
                { k: 'Items in library', v: k.items }, { k: 'Items downloaded', v: k.itemsDownloaded }, { k: 'Items never downloaded', v: k.itemsNeverDownloaded },
                { k: 'Countries (public)', v: k.countries }, { k: 'States (signed-in)', v: k.states }, { k: 'Downloads via shared links', v: k.viaSharedLink },
            ]);
            sheet('Items', [['Item', 'name', 40], ['Service', 'service'], ['Section', 'category', 24], ['Downloads', 'opens', 12], ['Unique downloaders', 'uniqueOpeners', 18], ['Views', 'views', 10], ['Shares', 'shares', 10], ['Last download', 'last', 20]],
                itemsRows.map((r) => ({ ...r, service: serviceShort(r.service), category: categoryLabel(r.category), last: r.lastOpen ? new Date(r.lastOpen) : '' })));
            sheet('People', [['Who', 'who', 28], ['E-mail', 'email', 30], ['Role', 'role'], ['State', 'state'], ['Locality', 'locality'], ['Country (time zone)', 'country', 22], ['Device', 'platform'], ['Downloads', 'opens', 12], ['Items', 'distinctItems', 10], ['Shares', 'shares', 10], ['Last item', 'lastItem', 36], ['Last activity', 'last', 20]],
                people.map((p) => ({ ...p, who: personLabel(p), last: p.last ? new Date(p.last) : '' })));
            const breakdown = (name, rows) => sheet(name, [['Group', 'key', 36], ['Downloads', 'count', 12], ['People', 'people', 12]], rows);
            breakdown('By service', byService); breakdown('By section', byCategory); breakdown('By state', byState);
            breakdown('By locality', byLocality); breakdown('By country', byCountry); breakdown('By role', byRole);
            breakdown('By device', byPlatform); breakdown('By entry', byEntry);
            sheet('Activity', [['When', 'when', 20], ['Action', 'type', 14], ['Item', 'itemName', 36], ['Service', 'service'], ['Section', 'category', 22], ['Who', 'who', 26], ['E-mail', 'email', 28], ['State', 'state'], ['Locality', 'locality'], ['Country (time zone)', 'country', 20], ['Device', 'platform'], ['Entry', 'entry', 12], ['From site', 'ref', 20]],
                [...current].sort((a, b) => eventMillis(b.at) - eventMillis(a.at)).map((e) => ({
                    ...e, when: eventMillis(e.at) ? new Date(eventMillis(e.at)) : '', type: TYPE_LABEL[e.type] || e.type,
                    service: serviceShort(e.service), category: e.category ? categoryLabel(e.category) : '',
                    who: e.signedIn ? (e.name || e.email) : 'Public visitor', country: countryFromTimeZone(e.tz),
                    entry: e.entry === 'link' ? 'Shared link' : 'App',
                })));
            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Child_Health_Library_Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            console.error(e);
            notify(t('library.dash.export_failed', 'Could not export: {{message}}', { message: e?.message || '' }), 'error');
        }
    };

    const select = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
    const trendData = {
        labels: trend.days.map((d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })),
        datasets: [
            { label: 'Downloads', data: trend.series.open, borderColor: CHART_COLORS[0], backgroundColor: fadeColor(CHART_COLORS[0]), fill: true, tension: 0.3, pointRadius: 0 },
            { label: 'Item views', data: trend.series.view, borderColor: CHART_COLORS[1], tension: 0.3, pointRadius: 0 },
            { label: 'Library visits', data: trend.series.visit, borderColor: CHART_COLORS[2], tension: 0.3, pointRadius: 0 },
            { label: 'Shares', data: trend.series.share, borderColor: CHART_COLORS[3], tension: 0.3, pointRadius: 0 },
        ],
    };
    const barData = (rows) => ({ labels: rows.map((r) => r.key), datasets: [{ label: 'Downloads', data: rows.map((r) => r.count), backgroundColor: CHART_COLORS[0], borderRadius: 4 }] });
    const doughnutData = (rows) => ({ labels: rows.map((r) => r.key), datasets: [{ data: rows.map((r) => r.count), backgroundColor: CHART_COLORS }] });
    const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
    const doughnutOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, datalabels: { display: false } } };

    return (
        <div className="space-y-3 md:space-y-4">
            <Card className="p-3 md:p-6">
                <PageHeader
                    title={t('library.dash.title', 'Library dashboard')}
                    subtitle={t('library.dash.subtitle', 'Downloads, visitors and sharing of the Child Health Library.')}
                    onBack={onBack}
                    actions={(
                        <>
                            <Button variant="ghost" onClick={() => load(needSince)}><RefreshCw size={16} /> {t('library.dash.refresh', 'Refresh')}</Button>
                            <Button onClick={exportExcel} disabled={!events}><Download size={16} /> {t('library.dash.export', 'Export Excel')}</Button>
                        </>
                    )}
                />
                <div className="flex flex-wrap gap-2">
                    <select className={select} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
                        {PERIODS.map((p) => <option key={p.key} value={p.key}>{t(`library.dash.period_${p.key}`, p.label)}</option>)}
                    </select>
                    <select className={select} value={service} onChange={(e) => setService(e.target.value)} aria-label="Service">
                        <option value="">{t('library.dash.all_services', 'All services')}</option>
                        {LIBRARY_SERVICES.map((s) => <option key={s.key} value={s.key}>{s.short}</option>)}
                    </select>
                    <select className={select} value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Audience">
                        <option value="all">{t('library.dash.everyone', 'Everyone')}</option>
                        <option value="signedIn">{t('library.dash.signed_in', 'Signed-in users')}</option>
                        <option value="public">{t('library.dash.public', 'Public (no sign-in)')}</option>
                    </select>
                </div>
                {error && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{t('library.dash.load_failed', 'Could not load the library activity.')} {error}</p>}
            </Card>

            {events === null ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                        <Kpi label="Downloads" value={k.downloads} delta={delta('downloads')} hint={days ? 'vs previous period' : ''} />
                        <Kpi label="Unique downloaders" value={k.uniqueDownloaders} delta={delta('uniqueDownloaders')} hint={`${k.signedInDownloaders} signed-in · ${k.publicDownloaders} public`} tone="emerald" />
                        <Kpi label="Visits & item views" value={k.visits} delta={delta('visits')} hint={`${k.visitors} visitors`} tone="amber" />
                        <Kpi label="Download rate" value={`${k.conversion}%`} hint="downloads per visit" tone="violet" />
                        <Kpi label="Shares" value={k.shares} delta={delta('shares')} hint={`${k.viaSharedLink} downloads via shared links`} tone="rose" />
                        <Kpi label="Downloads per person" value={k.perDownloader} tone="slate" />
                        <Kpi label="Items in library" value={k.items} hint={`${k.itemsDownloaded} downloaded · ${k.itemsNeverDownloaded} never`} tone="slate" />
                        <Kpi label="States reached" value={k.states} hint="signed-in users' profile" tone="emerald" />
                        <Kpi label="Countries reached" value={k.countries} hint="public, from device time zone" tone="amber" />
                    </div>

                    {current.length === 0 ? (
                        <Card><EmptyState message={t('library.dash.empty', 'No library activity in this period yet.')} /></Card>
                    ) : (
                        <>
                            <Panel title="Activity over time" subtitle="Downloads, item views, library visits and shares per day">
                                <div className="h-64"><Line data={trendData} options={{ ...chartOpts, plugins: { legend: { display: true, position: 'bottom' }, datalabels: { display: false } }, interaction: { mode: 'index', intersect: false } }} /></div>
                            </Panel>

                            <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
                                <Panel title="Downloads by service"><div className="h-60"><Bar data={barData(byService)} options={chartOpts} /></div></Panel>
                                <Panel title="Downloads by section"><div className="h-60"><Bar data={barData(byCategory)} options={chartOpts} /></div></Panel>
                                <Panel title="Signed-in vs public"><div className="h-60"><Doughnut data={doughnutData(byAudience)} options={doughnutOpts} /></div></Panel>
                                <Panel title="Device"><div className="h-60"><Doughnut data={doughnutData(byPlatform)} options={doughnutOpts} /></div></Panel>
                            </div>

                            <Panel title="Downloads of each item" subtitle="Every item in the library, most downloaded first">
                                <Table headers={['#', 'Item', 'Service', 'Section', 'Downloads', 'Unique', 'Views', 'Shares', 'Last download']}>
                                    {(showAllItems ? itemsRows : itemsRows.slice(0, 15)).map((r, i) => (
                                        <tr key={r.itemId} className={r.removed ? 'text-slate-400' : ''}>
                                            <td className="px-3 py-2 tabular-nums text-slate-500">{i + 1}</td>
                                            <td className="px-3 py-2 font-medium text-slate-800 min-w-[12rem]">{r.name}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{serviceShort(r.service)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{categoryLabel(r.category)}</td>
                                            <td className="px-3 py-2 tabular-nums font-bold text-sky-700">{r.opens}</td>
                                            <td className="px-3 py-2 tabular-nums">{r.uniqueOpeners}</td>
                                            <td className="px-3 py-2 tabular-nums">{r.views}</td>
                                            <td className="px-3 py-2 tabular-nums">{r.shares}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.lastOpen)}</td>
                                        </tr>
                                    ))}
                                </Table>
                                {itemsRows.length > 15 && (
                                    <button type="button" className="mt-2 text-sm font-semibold text-sky-700 hover:underline" onClick={() => setShowAllItems((v) => !v)}>
                                        {showAllItems ? 'Show fewer' : `Show all ${itemsRows.length} items`}
                                    </button>
                                )}
                            </Panel>

                            <div className="grid gap-3 md:gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <Panel title="From where: states" subtitle="Signed-in users, from their profile"><RankList rows={byState} /></Panel>
                                <Panel title="From where: localities" subtitle="Signed-in users with a locality"><RankList rows={byLocality} /></Panel>
                                <Panel title="From where: countries" subtitle="Everyone, from the device's time zone"><RankList rows={byCountry} /></Panel>
                                <Panel title="By role" subtitle="Signed-in users"><RankList rows={byRole} /></Panel>
                                <Panel title="How they arrived" subtitle="Inside the app or from a shared link"><RankList rows={byEntry} /></Panel>
                                <Panel title="Referring sites" subtitle="Visits that came from another website"><RankList rows={byReferrer} empty="No visits from other websites." label={(r) => r.key} /></Panel>
                            </div>

                            <Panel title="Who downloads" subtitle="Signed-in users by name; public visitors are counted per device">
                                <Table headers={['Who', 'Role', 'Where', 'Device', 'Downloads', 'Items', 'Shares', 'Last item', 'Last activity']}>
                                    {people.slice(0, 50).map((p) => (
                                        <tr key={p.key}>
                                            <td className="px-3 py-2 min-w-[10rem]">
                                                <span className="font-medium text-slate-800">{personLabel(p)}</span>
                                                {p.signedIn && p.email && p.name && <span className="block text-xs text-slate-500">{p.email}</span>}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap capitalize">{p.signedIn ? (p.role || 'user').replace(/_/g, ' ') : '—'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{placeOf(p)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{p.platform || '—'}</td>
                                            <td className="px-3 py-2 tabular-nums font-bold text-sky-700">{p.opens}</td>
                                            <td className="px-3 py-2 tabular-nums">{p.distinctItems}</td>
                                            <td className="px-3 py-2 tabular-nums">{p.shares}</td>
                                            <td className="px-3 py-2 min-w-[10rem]">{p.lastItem || '—'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(p.last)}</td>
                                        </tr>
                                    ))}
                                </Table>
                                {people.length > 50 && <p className="mt-2 text-xs text-slate-500">Showing 50 of {people.length}. The Excel export has everyone.</p>}
                            </Panel>

                            <Panel title="Recent activity" subtitle="The latest 50 actions">
                                <Table headers={['When', 'Action', 'Item', 'Who', 'Where', 'Device']}>
                                    {recent.map((e) => (
                                        <tr key={e.id}>
                                            <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(eventMillis(e.at))}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{TYPE_LABEL[e.type] || e.type}</td>
                                            <td className="px-3 py-2 min-w-[10rem]">{e.itemName || (e.type === 'visit' ? 'Library' : '—')}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{e.signedIn ? (e.name || e.email) : 'Public visitor'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{e.signedIn && e.state ? [e.locality, e.state].filter(Boolean).join(', ') : countryFromTimeZone(e.tz)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{e.platform}</td>
                                        </tr>
                                    ))}
                                </Table>
                            </Panel>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
