// src/components/imnci/ProtocolManager.jsx
//
// Protocol & Course Management: a module of its own (main site, federal
// managers and super users only).
//
//   Home          one card (an icon) per service: IMNCI, ETAT, EmONC/EENC,
//                 Small & Sick Newborn ...
//   A service     three parts, each a card with what it holds:
//                   Protocol           the national protocol (IMNCI: the protocol
//                                      editor, photograph booklet, dose tables)
//                   Facilitator guide  the guide read as a guideline, word for word
//                   Online courses     the Course Manager, this service's courses only
//
// Where the manager is is always written out (a path: Protocol & Course
// Management › IMNCI › Facilitator guide) and kept in the address (svc, part),
// so the back button, refresh and a shared link keep it. The parts are cards
// with a description, not bare tabs, so it is clear what each one holds.
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Stethoscope, Siren, Baby, HeartPulse, ShieldCheck, HeartHandshake, ClipboardList, Users,
    BookMarked, GraduationCap, FileText, ChevronRight, LayoutGrid, ClipboardList as AnnexIcon,
} from 'lucide-react';
import { PageHeader, Spinner } from '../CommonComponents';
import { useDataCache } from '../../DataContext';
import { COURSE_CATEGORIES, OTHER_CATEGORY, categoryOf } from './onlineCourses/categories';
import FacilitatorGuides from './FacilitatorGuides';
import CourseAnnexes from './CourseAnnexes';
import ProtocolEditor from './protocol';

const OnlineCoursesView = lazy(() => import('./courses'));

export const SERVICES = COURSE_CATEGORIES.filter((c) => c !== OTHER_CATEGORY);

// Only IMNCI has a protocol kept in the app so far.
export const PROTOCOL_SERVICES = ['IMNCI'];

const LOOK = {
    IMNCI: { icon: Stethoscope, tone: 'bg-sky-100 text-sky-700' },
    ETAT: { icon: Siren, tone: 'bg-rose-100 text-rose-700' },
    EmONC: { icon: HeartPulse, tone: 'bg-pink-100 text-pink-700' },
    'Small & Sick Newborn': { icon: Baby, tone: 'bg-amber-100 text-amber-700' },
    IPC: { icon: ShieldCheck, tone: 'bg-emerald-100 text-emerald-700' },
    ICCM: { icon: Users, tone: 'bg-indigo-100 text-indigo-700' },
    'Comprehensive Package For Community Midwives': { icon: HeartHandshake, tone: 'bg-fuchsia-100 text-fuchsia-700' },
    'Program Management': { icon: ClipboardList, tone: 'bg-slate-200 text-slate-700' },
};
export const serviceLook = (s) => LOOK[s] || { icon: GraduationCap, tone: 'bg-slate-200 text-slate-700' };

const PARTS = ['protocol', 'guide', 'annexes', 'courses'];

// The place (svc, part) in the address.
const readPlace = () => {
    const p = new URLSearchParams(window.location.search);
    const svc = SERVICES.includes(p.get('svc')) ? p.get('svc') : '';
    const part = PARTS.includes(p.get('part')) ? p.get('part') : '';
    return { svc, part };
};
// Keys the parts keep in the address; going to another service or part drops them.
const INNER_KEYS = ['fg', 'ch', 'fsec', 'oc', 'mod', 'sec', 'tab', 'book'];

function usePlace() {
    const [place, setPlace] = useState(readPlace);
    useEffect(() => {
        const onPop = () => setPlace(readPlace());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
    const go = useCallback((next) => {
        const url = new URL(window.location.href);
        ['svc', 'part', ...INNER_KEYS].forEach((k) => url.searchParams.delete(k));
        if (next.svc) url.searchParams.set('svc', next.svc);
        if (next.part) url.searchParams.set('part', next.part);
        const state = window.history.state || {};
        window.history.pushState({ ...state, chmIdx: (state.chmIdx || 0) + 1 }, '', url);
        setPlace({ svc: next.svc || '', part: next.part || '' });
        window.scrollTo(0, 0);
    }, []);
    return [place, go];
}

export default function ProtocolManager({ permissions = {}, userRoles = [] }) {
    const { t } = useTranslation();
    const [place, go] = usePlace();
    const { onlineCourses, fetchOnlineCourses } = useDataCache();
    useEffect(() => { if (!onlineCourses) fetchOnlineCourses(false); }, [onlineCourses, fetchOnlineCourses]);

    // What each service holds, for the cards.
    const counts = useMemo(() => {
        const out = {};
        (onlineCourses || []).filter((c) => c.isDeleted !== true).forEach((c) => {
            const k = categoryOf(c);
            out[k] = out[k] || { guides: 0, courses: 0, annexes: 0 };
            if (c.audience === 'facilitators') out[k].guides += 1;
            else if (c.audience === 'annex') out[k].annexes += 1;
            else out[k].courses += 1;
        });
        return out;
    }, [onlineCourses]);

    const title = t('landing.modules.protocol_manager', 'Protocol & Course Management');
    const partName = (p) => ({
        protocol: t('protocol_manager.parts.protocol', 'Protocol'),
        guide: t('protocol_manager.parts.guide', 'Facilitator guide'),
        annexes: t('protocol_manager.parts.annexes', 'Annexes'),
        courses: t('protocol_manager.parts.courses', 'Online courses'),
    }[p]);
    const svcName = (s) => t(`protocol_manager.services.${s.replace(/[^A-Za-z]/g, '_')}`, s);

    // The path: every step but the last opens that level.
    const crumbs = [{ label: title, to: { svc: '', part: '' } }];
    if (place.svc) crumbs.push({ label: svcName(place.svc), to: { svc: place.svc, part: '' } });
    if (place.svc && place.part) crumbs.push({ label: partName(place.part), to: null });

    return (
        <div className="space-y-4" data-testid="protocol-course-management">
            <PageHeader title={place.svc ? svcName(place.svc) : title}
                subtitle={place.svc ? (place.part ? partName(place.part) : t('protocol_manager.service_sub', 'Protocol, facilitator guide and online courses'))
                    : t('protocol_manager.subtitle', 'Protocols, facilitator guides and online courses, by service')}
                onBack={place.svc ? () => go(place.part ? { svc: place.svc } : {}) : undefined}
                backLabel={place.part ? svcName(place.svc) : title} />

            <nav aria-label={t('protocol_manager.you_are_here', 'You are here')} className="flex flex-wrap items-center gap-1 text-sm" data-testid="pcm-path">
                {crumbs.map((c, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <ChevronRight size={14} className="text-slate-400 rtl:-scale-x-100" />}
                        {c.to && i < crumbs.length - 1
                            ? <button type="button" onClick={() => go(c.to)} className="font-semibold text-sky-700 hover:underline">{c.label}</button>
                            : <span className="font-semibold text-slate-800" aria-current="page">{c.label}</span>}
                    </React.Fragment>
                ))}
            </nav>

            {!place.svc ? (
                <ServiceGrid counts={counts} svcName={svcName} onOpen={(s) => go({ svc: s })} />
            ) : (
                <>
                    <PartCards svc={place.svc} part={place.part} counts={counts[place.svc] || { guides: 0, courses: 0, annexes: 0 }}
                        partName={partName} onOpen={(p) => go({ svc: place.svc, part: p })} compact={!!place.part} />
                    {place.part && (
                        <Suspense fallback={<Spinner />}>
                            <div key={`${place.svc}-${place.part}`}>
                                {place.part === 'protocol' && (PROTOCOL_SERVICES.includes(place.svc)
                                    ? <ProtocolEditor canEdit={!!permissions.canManageProtocols} showGuides={false} />
                                    : <Empty text={t('protocol_manager.no_protocol', 'There is no protocol for this service in the app yet. Its facilitator guide and online courses are in the other two parts.')} />)}
                                {place.part === 'guide' && <FacilitatorGuides category={place.svc} />}
                                {place.part === 'annexes' && <CourseAnnexes category={place.svc} canEdit={!!permissions.canManageOnlineCourses} />}
                                {place.part === 'courses' && (
                                    <OnlineCoursesView key={place.svc} permissions={permissions} userRoles={userRoles} area="manage" category={place.svc} />
                                )}
                            </div>
                        </Suspense>
                    )}
                </>
            )}
        </div>
    );
}

function Empty({ text }) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">{text}</div>;
}

function ServiceGrid({ counts, svcName, onOpen }) {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="pcm-services">
            {SERVICES.map((s) => {
                const { icon: Icon, tone } = serviceLook(s);
                const c = counts[s] || { guides: 0, courses: 0 };
                return (
                    <button key={s} type="button" onClick={() => onOpen(s)} data-testid="pcm-service"
                        className="text-start rounded-2xl border border-slate-200 bg-white p-4 hover:border-sky-400 hover:shadow-md transition flex flex-col gap-3">
                        <span className={`w-12 h-12 rounded-xl grid place-items-center ${tone}`}><Icon size={26} /></span>
                        <span className="font-bold text-slate-900 leading-snug">{svcName(s)}</span>
                        <span className="text-xs text-slate-500 space-y-0.5">
                            {PROTOCOL_SERVICES.includes(s) && <span className="block">{t('protocol_manager.has_protocol', 'Protocol')}</span>}
                            <span className="block">{t('protocol_manager.n_guides', '{{count}} facilitator guides', { count: c.guides })}</span>
                            <span className="block">{t('protocol_manager.n_courses', '{{count}} online courses', { count: c.courses })}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function PartCards({ svc, part, counts, partName, onOpen, compact }) {
    const { t } = useTranslation();
    const { icon: SvcIcon, tone } = serviceLook(svc);
    const parts = [
        { id: 'protocol', icon: FileText, desc: PROTOCOL_SERVICES.includes(svc)
            ? t('protocol_manager.desc.protocol', 'The national protocol: classification, treatment, doses, photograph booklet')
            : t('protocol_manager.desc.protocol_none', 'Not in the app yet for this service') },
        { id: 'guide', icon: BookMarked, desc: t('protocol_manager.desc.guide', 'How to run the course, word for word, with contents and search — {{count}} guides', { count: counts.guides }) },
        { id: 'annexes', icon: AnnexIcon, desc: t('protocol_manager.desc.annexes', 'SOPs, skill checklists, chart booklet: opened from any course\'s lessons — {{count}}', { count: counts.annexes || 0 }) },
        { id: 'courses', icon: LayoutGrid, desc: t('protocol_manager.desc.courses', 'Courses, enrolment, groups and progress — {{count}} courses', { count: counts.courses }) },
    ];
    return (
        <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-4'}`} data-testid="pcm-parts">
            {parts.map(({ id, icon: Icon, desc }) => {
                const on = part === id;
                return (
                    <button key={id} type="button" onClick={() => onOpen(id)} aria-current={on ? 'page' : undefined} data-testid={`pcm-part-${id}`}
                        className={`text-start rounded-xl border p-3 flex items-start gap-3 transition ${on ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-600' : 'border-slate-200 bg-white hover:border-sky-400'}`}>
                        <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${on ? 'bg-sky-700 text-white' : tone}`}>
                            {compact ? <Icon size={18} /> : <span className="relative"><Icon size={18} /><SvcIcon size={10} className="absolute -bottom-1 -end-1" /></span>}
                        </span>
                        <span className="min-w-0">
                            <span className={`block font-bold ${on ? 'text-sky-900' : 'text-slate-900'} ${compact ? 'text-sm' : ''}`}>{partName(id)}</span>
                            {!compact && <span className="block text-xs text-slate-500 mt-0.5">{desc}</span>}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
