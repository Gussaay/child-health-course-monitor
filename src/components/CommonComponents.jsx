import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Inbox, MoreHorizontal, RefreshCw, SearchX, SlidersHorizontal } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { addInPageBack } from '../utils/inPageBack';

// The Android app shows every inner page's name and a back arrow in its slim
// top bar, so in-page titles and back buttons are left out there.
export const IS_NATIVE = Capacitor.isNativePlatform();

// Lets the top-bar arrow (and the phone's back button) take this page's own
// back step while `active`, for pages whose Back button is hidden in the app.
export function useInPageBack(onBack, active = true) {
    const ref = useRef(onBack);
    ref.current = onBack;
    useEffect(() => {
        if (!active || !IS_NATIVE) return undefined;
        return addInPageBack(() => ref.current?.());
    }, [active]);
}
import { useTranslation } from 'react-i18next';

// =============================================================================
// Card & Page Layout Components
// =============================================================================

export const Card = ({ children, className = '' }) => <section className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</section>;
export const CardHeader = ({ children, className = '' }) => <div className={`p-4 md:p-6 border-b border-gray-200 ${className}`}><h3 className="text-lg font-semibold text-gray-800">{children}</h3></div>;
// A form's Save / Cancel row. On phones it stays pinned just above the bottom
// bar while the form is on screen, so there is no scrolling down to save.
// Put it as the last child of the form's own container (not inside a short
// wrapper), or it has nothing to stick within.
export const FormActions = ({ children, className = '' }) => (
    <div className={`sticky bottom-[calc(var(--bottom-nav,0px)+8px)] [dialog_&]:bottom-2 z-20 -mx-1 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-gray-200 bg-white/95 p-2 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none ${className}`}>
        {children}
    </div>
);

export const CardBody = ({ children, className = '' }) => <div className={`p-3 md:p-6 ${className}`}>{children}</div>;
export const CardFooter = ({ children, className = '' }) => <div className={`p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end gap-2 ${className}`}>{children}</div>;

// Extra buttons a page wants beside the phone "Filters" row (e.g. refresh).
export const PageToolsContext = createContext(null);

// Filters panel. Wider screens: always open, as before. Phones: one
// "Filters (n)" row that opens the panel on tap, so the page's content shows
// straight away.
export function FilterPanel({ activeCount = 0, className = '', children }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const tools = useContext(PageToolsContext);
    return (
        <div className={`ignore-for-export sticky md:static z-20 top-[calc(var(--app-top,0px)+var(--tabs-h,0px)+4px)] ${className}`}>
            <div className="md:hidden flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    aria-expanded={open}
                    className="flex-1 min-w-0 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm active:bg-slate-50"
                >
                    <SlidersHorizontal size={16} className="text-sky-600 shrink-0" />
                    <span className="truncate">{t('ui.filters', 'Filters')}</span>
                    {activeCount > 0 && <span className="rounded-full bg-sky-600 px-1.5 text-xs leading-5 text-white">{activeCount}</span>}
                    <ChevronDown size={16} className={`ms-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {tools}
            </div>
            <div className={`${open ? 'block mt-2 max-h-[60vh] overflow-y-auto shadow-lg' : 'hidden'} md:block md:mt-0 md:max-h-none md:overflow-visible md:shadow-sm bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm`}>
                {children}
            </div>
        </div>
    );
}

// A page's row of action buttons. Wider screens: all of them, as before.
// Phones: the first `keep` buttons plus a "⋯" button that opens the rest as a
// full-width list. The buttons are rendered once, so their own state and
// pop-ups are untouched.
export function PageActions({ children, keep = 1, className = '' }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const items = React.Children.toArray(children);
    const extra = items.length - keep;
    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            {extra > 1 ? items.slice(0, keep) : items}
            {extra > 1 && (
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    aria-expanded={open}
                    title={t('ui.more_actions', 'More actions')}
                    aria-label={t('ui.more_actions', 'More actions')}
                    className={`md:hidden h-[38px] px-3 rounded-md border border-slate-300 flex items-center gap-1 text-sm font-semibold ${open ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-700'}`}
                >
                    <MoreHorizontal size={18} /> {t('ui.more', 'More')}
                </button>
            )}
            {extra > 1 && items.slice(keep).map((child, i) => (
                <div key={child.key ?? i} className={`${open ? 'w-full [&>*]:w-full [&>*]:justify-start' : 'hidden'} md:contents`}>{child}</div>
            ))}
        </div>
    );
}

// Pull down from the top of a list to refresh it (phones / touch only).
// Render it once in a page that has a refresh action.
export function PullToRefresh({ onRefresh, disabled = false }) {
    const { t } = useTranslation();
    const [pull, setPull] = useState(0);
    const [busy, setBusy] = useState(false);
    const state = useRef({ startY: null, pull: 0 });
    const refreshRef = useRef(onRefresh);
    refreshRef.current = onRefresh;
    const THRESHOLD = 70;
    useEffect(() => {
        if (disabled || typeof window === 'undefined' || window.matchMedia?.('(min-width: 768px)').matches) return undefined;
        const blocked = (e) => window.scrollY > 0 || document.body.style.overflow === 'hidden' || e.target?.closest?.('[role="dialog"], .fixed, input, textarea, select');
        const start = (e) => { state.current.startY = blocked(e) ? null : e.touches[0].clientY; };
        const move = (e) => {
            if (state.current.startY === null) return;
            const dy = e.touches[0].clientY - state.current.startY;
            if (dy <= 0 || window.scrollY > 0) { state.current.pull = 0; setPull(0); return; }
            state.current.pull = Math.min(dy * 0.5, 100);
            setPull(state.current.pull);
        };
        const end = async () => {
            const done = state.current.pull >= THRESHOLD;
            state.current = { startY: null, pull: 0 };
            setPull(0);
            if (!done) return;
            setBusy(true);
            try { await refreshRef.current?.(); } finally { setBusy(false); }
        };
        window.addEventListener('touchstart', start, { passive: true });
        window.addEventListener('touchmove', move, { passive: true });
        window.addEventListener('touchend', end);
        window.addEventListener('touchcancel', end);
        return () => {
            window.removeEventListener('touchstart', start);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', end);
            window.removeEventListener('touchcancel', end);
        };
    }, [disabled]);
    if (!pull && !busy) return null;
    const ready = pull >= THRESHOLD;
    return (
        <div
            className="md:hidden fixed inset-x-0 z-[45] flex justify-center pointer-events-none"
            style={{ top: `calc(var(--app-top, 0px) + ${busy ? 12 : Math.max(pull - 30, 4)}px)` }}
        >
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-md border border-slate-200">
                <RefreshCw size={14} className={`text-sky-600 ${busy ? 'animate-spin' : ''}`} style={busy ? undefined : { transform: `rotate(${pull * 3}deg)` }} />
                {busy ? t('ui.refreshing', 'Refreshing…') : ready ? t('ui.release_refresh', 'Release to refresh') : t('ui.pull_refresh', 'Pull to refresh')}
            </div>
        </div>
    );
}

export const PageHeader = ({ title, subtitle, actions }) => {
    // Android app: the title is already in the top bar; keep only the buttons.
    if (IS_NATIVE) {
        return actions ? <div className="flex items-center gap-2 flex-wrap mb-3 md:mb-6">{actions}</div> : null;
    }
    return (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
    );
};

export const Footer = () => {
    const { t } = useTranslation();
    return (
        <footer className="bg-slate-800 text-slate-400 text-center p-4 mt-8">
            <p>{t('shared_ui.common.footer_credit', 'App developed by Dr Qusay Mohamed')} - <a href="mailto:Gussaay@gmail.com" className="text-sky-400 hover:underline">Gussaay@gmail.com</a></p>
        </footer>
    );
};


// =============================================================================
// Interactive Elements
// =============================================================================

export const Button = ({ onClick, children, variant = 'primary', disabled = false, className = '', isActive = false }) => {
    const baseClasses = "px-4 py-2 rounded-md font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 justify-center";
    const variantClasses = {
        primary: 'bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500',
        secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        ghost: 'bg-transparent text-slate-700 hover:bg-sky-100 hover:text-sky-700 focus:ring-sky-500 border border-slate-300',
        tab: 'text-gray-600 hover:bg-slate-100' // Default tab style
    };
    const activeTabClasses = isActive && variant === 'tab' ? 'bg-sky-600 text-white hover:bg-sky-700' : '';
    const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";

    return <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className} ${activeTabClasses}`}>{children}</button>;
};

export function Tabs({ tabs, activeTab, onTabChange }) {
    return <PageTabs tabs={tabs} active={activeTab} onChange={onTabChange} />;
}

// The phone tab row stays pinned under the top bar; it publishes its height
// as --tabs-h so a "Filters" row can pin just below it.
function usePinnedTabsHeight(ref) {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const root = document.documentElement;
        let mine = false;
        const set = () => { if (el.offsetHeight > 0) { mine = true; root.style.setProperty('--tabs-h', `${el.offsetHeight + 4}px`); } };
        set();
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
        observer?.observe(el);
        return () => {
            observer?.disconnect();
            if (mine) root.style.removeProperty('--tabs-h');
        };
    }, [ref]);
}

// Page tabs. Phones: every tab in one row that never scrolls sideways, using
// each tab's `short` name when it has one. Wider screens: the usual buttons.
// tabs: [{ id, label, short?, icon?, count?, disabled? }]
export function PageTabs({ tabs, active, onChange, className = '' }) {
    const visible = tabs.filter(Boolean);
    const navRef = useRef(null);
    usePinnedTabsHeight(navRef);
    return (
        <div className={`mb-3 md:mb-4 md:static sticky z-30 top-[calc(var(--app-top,0px)+4px)] ${className}`}>
            <nav ref={navRef} className="md:hidden flex gap-0.5 rounded-xl bg-white p-1 border border-slate-200 shadow-sm">
                {visible.map(tab => {
                    const on = active === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            disabled={tab.disabled}
                            title={typeof tab.label === 'string' ? tab.label : undefined}
                            className={`relative min-w-0 disabled:opacity-40 rounded-lg px-1 py-1.5 text-xs font-bold leading-tight text-center transition-colors ${on ? 'shrink-0 bg-sky-600 text-white shadow-sm' : 'flex-auto text-slate-500 active:bg-sky-50'}`}
                        >
                            <span className="block truncate">{tab.short || tab.label}</span>
                            {tab.count > 0 && <span className="absolute -top-1.5 -end-0.5 min-w-[16px] h-4 rounded-full bg-red-500 px-1 text-xs leading-4 text-white">{tab.count}</span>}
                        </button>
                    );
                })}
            </nav>
            <div className="hidden md:flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                {visible.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <Button key={tab.id} variant="tab" isActive={active === tab.id} disabled={tab.disabled} onClick={() => onChange(tab.id)}>
                            {Icon && <Icon size={16} />}
                            {tab.label}
                            {tab.count > 0 && <span className="ms-1 rounded-full bg-red-500 px-1.5 text-xs text-white">{tab.count}</span>}
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}

// =============================================================================
// Form Components
// =============================================================================

export const FormGroup = ({ label, children, hint }) => (
    <div className="flex flex-col gap-1">
        <label className="font-semibold text-gray-700 text-sm rtl:text-right">
            {label}
        </label>
        {children}
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
);

// Number and phone fields open the phone's number pad.
const defaultInputMode = (type) => (type === 'number' ? 'decimal' : type === 'tel' ? 'tel' : undefined);

export const Input = ({ label, name, ...props }) => (
    <div className="flex flex-col">
        <label htmlFor={name} className="mb-1 text-sm font-medium text-gray-700 rtl:text-right">
            {label}
        </label>
        <input
            id={name}
            name={name}
            inputMode={defaultInputMode(props.type)}
            {...props}
            className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 rtl:text-right ${props.className || ''}`}
        />
    </div>
);

export const Select = ({ label, name, children, ...props }) => (
    <div className="flex flex-col">
        <label htmlFor={name} className="mb-1 text-sm font-medium text-gray-700 rtl:text-right">
            {label}
        </label>
        <select
            id={name}
            name={name}
            {...props}
            className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 rtl:text-right ${props.className || ''}`}
        >
            {children}
        </select>
    </div>
);

export const Textarea = ({ label, name, ...props }) => (
    <div className="flex flex-col">
        <label htmlFor={name} className="mb-1 text-sm font-medium text-gray-700 rtl:text-right">
            {label}
        </label>
        <textarea
            id={name}
            name={name}
            {...props}
            className={`border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 rtl:text-right ${props.className || ''}`}
        />
    </div>
);

export function Checkbox(props) {
    return (
        <input
            type="checkbox"
            {...props}
            className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
        />
    );
}

export function FileUpload({ accept, onChange, ...props }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center">
            <label className="block">
                <span className="sr-only">{t('shared_ui.common.choose_file', 'Choose file')}</span>
                <input
                    type="file"
                    accept={accept}
                    onChange={onChange}
                    className="block w-full text-sm text-gray-500
                    file:me-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-sky-50 file:text-sky-700
                    hover:file:bg-sky-100"
                    {...props}
                />
            </label>
        </div>
    );
}

// =============================================================================
// Data Display & UI States
// =============================================================================

export const ActionGroup = ({ children, className = '' }) => (
    <div className={`flex items-center flex-wrap gap-2 ${className}`}>
        {children}
    </div>
);

export const Table = ({ headers, children, cardsOnPhone = false }) => {
  const tableHeaders = Array.isArray(headers) ? headers : [];
  const cellClassName = 'px-4 py-3'; // Standardized padding for all cells

  const Wrapper = cardsOnPhone ? PhoneCards : 'div';
  return (
    <Wrapper className="overflow-x-auto border border-gray-200 rounded-lg my-4">
      <table className="min-w-full text-sm divide-y divide-gray-200 table-fixed">
        <thead className="bg-gray-100">
          <tr className="text-start text-gray-700">
            {tableHeaders.map((header, index) => (
              <th key={index} scope="col"className={`${cellClassName} font-semibold `}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {React.Children.map(children, (row) => {
            if (!React.isValidElement(row)) return row;

            // Handle EmptyState component specifically
            if (row.type === EmptyState) {
                return React.cloneElement(row, { asRow: true, colSpan: row.props.colSpan || tableHeaders.length });
            }

            // For regular table rows
            const cells = React.Children.map(row.props.children, (cell) => {
              if (!React.isValidElement(cell)) return cell;
              return React.cloneElement(cell, {
                className: `${cellClassName} text-gray-800 align-middle ${cell.props.className || ''}`.trim(),
              });
            });

            return React.cloneElement(row, {
              className: `${row.props.className || ''} hover:bg-gray-50`,
              children: cells
            });
          })}
        </tbody>
      </table>
    </Wrapper>
  );
};


// Shows each table row as a card on phones, with the column name beside each
// value, so wide lists need no sideways scrolling (styles in index.css). The
// labels are copied from the table's header cells after every render, so it
// works for any table inside it, including ones whose headers are components.
export const PhoneCards = ({ children, className = '' }) => {
    const ref = useRef(null);
    useLayoutEffect(() => {
        ref.current?.querySelectorAll('table').forEach((table) => {
            const labels = [...table.querySelectorAll(':scope > thead th')].map((th) => th.textContent.trim());
            table.querySelectorAll(':scope > tbody > tr').forEach((tr) => {
                let col = 0;
                [...tr.children].forEach((cell) => {
                    const span = Number(cell.getAttribute('colspan')) || 1;
                    if (span === 1 && labels[col]) cell.setAttribute('data-label', labels[col]);
                    else cell.removeAttribute('data-label');
                    col += span;
                });
            });
        });
    });
    return <div ref={ref} className={`cards-on-phone ${className}`}>{children}</div>;
};

// What a list shows when it has nothing in it: an icon, a short line and,
// where it helps, what to do next. `filtered` says the list is empty because
// of the search or filters, and adds a hint (or a "Clear filters" button when
// `onClearFilters` is given). `action` is { label, onClick } for the next step,
// such as adding the first item. Inside a table (or with `colSpan`) it fills
// one full-width row; elsewhere it is a plain block.
export const EmptyState = ({ message, title, hint, icon, action, filtered = false, onClearFilters, colSpan, asRow = false }) => {
    const { t } = useTranslation();
    const Icon = icon || (filtered ? SearchX : Inbox);
    const shownHint = hint ?? (filtered && !onClearFilters
        ? t('shared_ui.empty.filtered_hint', 'Try a different search or clear the filters.')
        : null);
    const block = (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-hidden="true">
                <Icon className="h-5 w-5" />
            </span>
            {title && <p className="font-semibold text-slate-800">{title}</p>}
            {message && <p className={title ? 'max-w-md text-sm text-slate-500' : 'max-w-md text-sm font-medium text-slate-600'}>{message}</p>}
            {shownHint && <p className="max-w-md text-xs text-slate-500">{shownHint}</p>}
            {(action || (filtered && onClearFilters)) && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {filtered && onClearFilters && (
                        <Button variant="secondary" onClick={onClearFilters}>{t('shared_ui.empty.clear_filters', 'Clear filters')}</Button>
                    )}
                    {action && <Button onClick={action.onClick}>{action.label}</Button>}
                </div>
            )}
        </div>
    );
    if (!asRow && !colSpan) return block;
    return (
        <tr className="empty-row">
            <td colSpan={colSpan || 1}>{block}</td>
        </tr>
    );
};

// Shimmer placeholders for content that is still loading (styles in index.css).
export const Skeleton = ({ className = '' }) => <div className={`shimmer rounded ${className}`} aria-hidden="true" />;

export const SkeletonCard = ({ lines = 3 }) => (
    <Card className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
            </div>
        </div>
        <div className="space-y-2">
            {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />)}
        </div>
    </Card>
);

export const SkeletonTable = ({ rows = 6, columns = 4 }) => (
    <div className="space-y-3" aria-hidden="true">
        <div className="flex gap-3">{Array.from({ length: columns }, (_, i) => <Skeleton key={i} className="h-4 flex-1" />)}</div>
        {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex gap-3">{Array.from({ length: columns }, (_, c) => <Skeleton key={c} className="h-8 flex-1" />)}</div>
        ))}
    </div>
);

// Stands in for a whole page while its code or data loads.
export const PageSkeleton = () => {
    const { t } = useTranslation();
    return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label={t('shared_ui.common.loading', 'Loading')}>
        <div className="space-y-2">
            <Skeleton className="h-7 w-1/2 sm:w-1/3" />
            <Skeleton className="h-4 w-1/3 sm:w-1/5" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Card className="p-4 md:p-6"><SkeletonTable /></Card>
    </div>
    );
};

// size="sm": a small ring that sits inside a button while it works.
export const Spinner = ({ size }) => (size === 'sm'
    ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle" role="status" aria-label="Loading" />
    : <div className="flex justify-center items-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div></div>);

export const PdfIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>

export const CourseIcon = ({ course }) => {
    const p = { width: 34, height: 34, viewBox: '0 0 48 48' };
    switch (course) {
        case 'IMNCI': return (<svg {...p}><circle cx="24" cy="24" r="22" fill="#e0f2fe" /><path d="M12 34c6-10 18-10 24 0" stroke="#0ea5e9" strokeWidth="3" fill="none" /><circle cx="24" cy="18" r="6" fill="#0ea5e9" /></svg>);
        case 'ETAT': return (<svg {...p}><rect x="3" y="8" width="42" height="30" rx="4" fill="#fff7ed" stroke="#f97316" strokeWidth="3" /><path d="M8 24h10l2-6 4 12 3-8h11" stroke="#f97316" strokeWidth="3" fill="none" /></svg>);
        case 'EENC': return (<svg {...p}><circle cx="16" cy="22" r="7" fill="#dcfce7" /><circle cx="30" cy="18" r="5" fill="#a7f3d0" /><path d="M8 34c8-6 24-6 32 0" stroke="#10b981" strokeWidth="3" fill="none" /></svg>);
        default: return null;
    }
}

// =============================================================================
// Overlays & Notifications
// =============================================================================

// Built on the native <dialog> element, which brings Escape-to-close, focus
// trapping, focus restore and the backdrop for free — none of which the old
// div-based modal had. showModal() also makes the rest of the page inert, so
// background content can no longer be tabbed into or scrolled behind it.
export function Modal({ isOpen, onClose, title, children }) {
    const { t } = useTranslation();
    const dialogRef = useRef(null);

    useEffect(() => {
        const node = dialogRef.current;
        if (!node) return undefined;

        if (isOpen && !node.open) node.showModal();
        if (!isOpen && node.open) node.close();

        const handleCancel = (event) => {
            event.preventDefault(); // stop the default close so onClose owns the state
            onClose?.();
        };
        // Closing on a backdrop click is decided by POINTER POSITION, not by
        // event.target, and the press and the release must both be outside.
        //
        // event.target is unreliable here because a <dialog> is its own
        // scrolling box: its scrollbar belongs to the dialog element, so
        // dragging that scrollbar reports the dialog as the target and used to
        // close the whole thing mid-scroll. Returning from an operating-system
        // file picker delivers a stray click reporting the dialog too, which
        // made <input type="file"> inside a modal unusable.
        //
        // The bounding rect includes the scrollbar, so a press anywhere on the
        // dialog or its scrollbar counts as inside and never closes.
        const isOutside = (event) => {
            const r = node.getBoundingClientRect();
            // A click dispatched without coordinates (keyboard activation,
            // synthetic events) reports 0,0 and must not be read as a corner click.
            if (event.clientX === 0 && event.clientY === 0) return false;
            return event.clientX < r.left || event.clientX > r.right
                || event.clientY < r.top || event.clientY > r.bottom;
        };

        let pressedOutside = false;
        const handleMouseDown = (event) => { pressedOutside = isOutside(event); };
        const handleMouseUp = (event) => {
            if (pressedOutside && isOutside(event)) onClose?.();
            pressedOutside = false;
        };

        node.addEventListener('cancel', handleCancel);
        node.addEventListener('mousedown', handleMouseDown);
        node.addEventListener('mouseup', handleMouseUp);
        return () => {
            node.removeEventListener('cancel', handleCancel);
            node.removeEventListener('mousedown', handleMouseDown);
            node.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby="modal-title"
            className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/50"
        >
            <div className="flex items-center justify-between p-4 border-b">
                <h3 id="modal-title" className="text-lg font-semibold">{title}</h3>
                <button type="button" onClick={onClose} aria-label={t('shared_ui.common.close', 'Close')} className="text-gray-500 hover:text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="p-4">
                {children}
            </div>
        </dialog>
    );
}

export function Toast({ message, type, onClose }) {
    const { t } = useTranslation();
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'; // Added default/info case
    const borderColor = type === 'success' ? 'border-green-600' : type === 'error' ? 'border-red-600' : 'border-blue-600'; // Added default/info case
    const icon = type === 'success' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ) : type === 'error' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ) : ( // Default/info icon
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000); // Auto-close after 5 seconds
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div role="status" className={`fixed bottom-[calc(var(--bottom-nav,0px)+1rem)] left-1/2 -translate-x-1/2 w-max max-w-[calc(100vw-2rem)] flex items-center p-4 rounded-lg shadow-lg text-white border-t-4 ${bgColor} ${borderColor} z-[70]`}>
            {icon}
            <div className="mx-3 text-sm font-medium">{message}</div>
            <button onClick={onClose} className="ms-auto -my-1.5 bg-transparent rounded-lg p-1.5 inline-flex h-8 w-8 text-white hover:bg-white hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white">
                <span className="sr-only">{t('shared_ui.common.dismiss', 'Dismiss')}</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
    );
}
// --- Final report status ---------------------------------------------------
// Whether a course's final report is uploaded, signed, and how many of its
// recommendations are still open. Used by the course list's labels and by the
// Final Reports dashboard, so both count the same way.
export const finalReportStatus = (report) => {
    const recs = (report?.recommendations || []).filter(r => r?.recommendation);
    return {
        uploaded: !!(report?.pdfUrl || report?.signedPdfUrl),
        signed: !!report?.signedPdfUrl,
        hasReport: !!report,
        recommendations: recs.length,
        // Anything not marked completed is still pending.
        pending: recs.filter(r => r.status !== 'completed').length,
    };
};

export function FinalReportStatusBadges({ report, className = '' }) {
    const { t } = useTranslation();
    const s = finalReportStatus(report);
    const pill = 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border whitespace-nowrap';
    return (
        <div className={`flex flex-wrap gap-1 ${className}`}>
            {s.uploaded
                ? <span className={`${pill} bg-blue-50 text-blue-700 border-blue-200`}>{t('shared_ui.common.report_uploaded', 'Report uploaded')}</span>
                : <span className={`${pill} bg-slate-50 text-slate-500 border-slate-200`}>{t('shared_ui.common.no_report', 'No report')}</span>}
            {s.uploaded && (s.signed
                ? <span className={`${pill} bg-emerald-50 text-emerald-700 border-emerald-200`}>{t('shared_ui.common.signed', 'Signed')}</span>
                : <span className={`${pill} bg-amber-50 text-amber-700 border-amber-200`}>{t('shared_ui.common.not_signed', 'Not signed')}</span>)}
            {s.pending > 0
                ? <span className={`${pill} bg-red-50 text-red-700 border-red-200`}>{s.pending === 1 ? t('shared_ui.common.pending_recommendation', '{{count}} pending recommendation', { count: s.pending }) : t('shared_ui.common.pending_recommendations', '{{count}} pending recommendations', { count: s.pending })}</span>
                : s.recommendations > 0 && <span className={`${pill} bg-emerald-50 text-emerald-700 border-emerald-200`}>{t('shared_ui.common.recommendations_done', 'Recommendations done')}</span>}
        </div>
    );
}
