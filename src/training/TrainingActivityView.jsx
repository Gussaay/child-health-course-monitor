// src/training/TrainingActivityView.jsx
//
// The course's "Training" tab: who used the course's training link, which
// course participant each account belongs to, and what each of them did
// there (screens opened, records saved, a timeline). Reads
// trainingProgress/{courseId}/… (see trainingProgress.js), which only staff
// may read.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, Button } from '../components/CommonComponents';
import { PROGRESS_ROOT } from './trainingProgress.js';
import { trainingStatus } from './trainingSession.js';
import { buildTrainingRows, toDate, topEntries } from './trainingRows.js';

const ACTIVITY_LIMIT = 1000;

// Friendly names for the app's screens and data. Anything not listed is shown
// as its own name, split into words.
const LABELS = {
    landing: ['الرئيسية', 'Home'],
    dashboard: ['لوحة المعلومات', 'Dashboard'],
    courses: ['الدورات', 'Courses'],
    courseDetails: ['تفاصيل الدورة', 'Course details'],
    participants: ['المشاركون', 'Participants'],
    reports: ['التقارير', 'Reports'],
    observe: ['المتابعة', 'Monitoring'],
    humanResources: ['الموارد البشرية', 'Human resources'],
    childHealthServices: ['خدمات صحة الطفل', 'Child health services'],
    skillsMentorship: ['الإشراف المهاري', 'Skills mentorship'],
    imciForm: ['بروتوكول العلاج', 'IMNCI protocol'],
    onlineCourses: ['الدورات الإلكترونية', 'Online courses'],
    supervision: ['الإشراف', 'Supervision'],
    supplyManagement: ['الإمداد', 'Supply management'],
    projects: ['المشاريع', 'Projects'],
    meetings: ['الاجتماعات', 'Meetings'],
    planning: ['الخطة الرئيسية', 'Master plan'],
    localityPlan: ['تخطيط المحليات', 'Locality planning'],
    healthFacilities: ['المؤسسات الصحية', 'Health facilities'],
    facilitySnapshots: ['تحديثات المؤسسات', 'Facility updates'],
    facilitySubmissions: ['طلبات المؤسسات', 'Facility submissions'],
    facilitators: ['الميسّرون', 'Facilitators'],
    skillMentorship: ['زيارات الإشراف', 'Mentorship visits'],
    observations: ['ملاحظات المتابعة', 'Monitoring observations'],
    cases: ['الحالات', 'Cases'],
    finalReports: ['التقارير النهائية', 'Final reports'],
    participantTests: ['الاختبارات', 'Tests'],
    exerciseAttempts: ['التمارين', 'Exercises'],
    imnciVisitReports: ['تقارير زيارات IMNCI', 'IMNCI visit reports'],
    eencVisitReports: ['تقارير زيارات EENC', 'EENC visit reports'],
    imnciPatientRecords: ['سجلات المرضى', 'Patient records'],
    supervisionAssessments: ['تقييمات الإشراف', 'Supervision assessments'],
    supplyItems: ['أصناف الإمداد', 'Supply items'],
    masterPlans: ['الخطط الرئيسية', 'Master plans'],
    operationalPlans: ['الخطط التشغيلية', 'Operational plans'],
    unitMeetings: ['الاجتماعات', 'Meetings'],
    onlineProgress: ['تقدّم الدورات الإلكترونية', 'Online course progress'],
    dailyEvalResponses: ['التقييم اليومي', 'Daily evaluation'],
};

function Kpi({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
        </div>
    );
}

export default function TrainingActivityView({ course }) {
    const { i18n } = useTranslation();
    const ar = (i18n.language || '').toLowerCase().startsWith('ar');
    const L = (a, e) => (ar ? a : e);
    const label = useCallback((key) => {
        const l = LABELS[key];
        if (l) return ar ? l[0] : l[1];
        return String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    }, [ar]);
    const fmt = (d) => (d ? d.toLocaleString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(null);
    const [filter, setFilter] = useState('all');

    const load = useCallback(async () => {
        setError(null);
        try {
            const [pSnap, tSnap, aSnap] = await Promise.all([
                getDocs(query(collection(db, 'participants'), where('courseId', '==', course.id))),
                getDocs(collection(db, PROGRESS_ROOT, course.id, 'trainees')),
                getDocs(query(collection(db, PROGRESS_ROOT, course.id, 'activity'), orderBy('at', 'desc'), limit(ACTIVITY_LIMIT))),
            ]);
            setData({
                participants: pSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.isDeleted !== true),
                trainees: tSnap.docs.map((d) => ({ uid: d.id, ...d.data() })),
                activity: aSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
            });
        } catch (e) {
            console.error('[training activity]', e);
            setError(e);
        }
    }, [course.id]);

    useEffect(() => { load(); }, [load]);

    const rows = useMemo(() => (data ? buildTrainingRows(data.participants, data.trainees) : []), [data]);
    const status = trainingStatus(course);

    if (!course.training) {
        return (
            <Card className="p-6 text-center text-sm text-slate-600">
                {L('لم يُشارك رابط تدريب لهذه الدورة بعد. شاركه من نافذة "مشاركة الروابط العامة" في قائمة الدورات.',
                    'No training link has been shared for this course yet. Share it from the Share Public Links window in the course list.')}
            </Card>
        );
    }
    if (error) {
        return (
            <Card className="p-6 text-center text-sm text-slate-600">
                <p className="mb-3">{L('تعذّر تحميل نشاط التدريب.', 'Could not load the training activity.')}</p>
                <Button variant="secondary" onClick={load}>{L('إعادة المحاولة', 'Try again')}</Button>
            </Card>
        );
    }
    if (!data) return <Card className="p-6 text-center text-sm text-slate-500">{L('جارٍ التحميل…', 'Loading…')}</Card>;

    const practised = rows.filter((r) => r.accounts.length > 0);
    const linkedParticipants = rows.filter((r) => !r.guest && r.accounts.length > 0).length;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const activeToday = practised.filter((r) => r.lastSeen && r.lastSeen.getTime() >= dayAgo).length;
    const totalSaves = practised.reduce((a, r) => a + r.saves, 0);
    const shown = rows.filter((r) => (filter === 'practised' ? r.accounts.length > 0 : filter === 'not_yet' ? r.accounts.length === 0 && !r.guest : true));

    const statusText = {
        open: L('الرابط مفتوح الآن', 'Link open now'),
        not_started: L('الرابط لم يُفتح بعد', 'Link not open yet'),
        expired: L('انتهى الرابط', 'Link expired'),
        disabled: L('الرابط متوقف', 'Link switched off'),
    }[status];

    return (
        <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                    <h3 className="text-base font-bold text-slate-800">🎓 {L('نشاط رابط التدريب', 'Training link activity')}</h3>
                    <p className="text-xs text-slate-500">{statusText}</p>
                </div>
                <Button variant="secondary" onClick={load}>{L('تحديث', 'Refresh')}</Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Kpi label={L('مشاركون تدرّبوا', 'Participants who practised')} value={`${linkedParticipants} / ${data.participants.length}`} />
                <Kpi label={L('نشطون آخر ٢٤ ساعة', 'Active in last 24 h')} value={activeToday} />
                <Kpi label={L('عمليات حفظ', 'Records saved')} value={totalSaves} />
                <Kpi label={L('ضيوف ومدرّبون', 'Guests and trainers')} value={rows.filter((r) => r.guest).length} />
            </div>

            <div className="flex gap-2 text-xs">
                {[
                    ['all', L('الكل', 'All')],
                    ['practised', L('تدرّبوا', 'Practised')],
                    ['not_yet', L('لم يبدأوا', 'Not started')],
                ].map(([id, text]) => (
                    <button key={id} type="button" onClick={() => setFilter(id)}
                        className={`px-3 py-1 rounded-full border ${filter === id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}>
                        {text}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {shown.length === 0 && <p className="p-4 text-sm text-slate-500">{L('لا أحد هنا.', 'Nobody here.')}</p>}
                {shown.map((r) => {
                    const isOpen = open === r.key;
                    const uids = new Set(r.accounts.map((a) => a.uid));
                    const timeline = isOpen ? data.activity.filter((a) => uids.has(a.uid)).slice(0, 100) : [];
                    return (
                        <div key={r.key}>
                            <button type="button" onClick={() => setOpen(isOpen ? null : r.key)} disabled={r.accounts.length === 0}
                                className="w-full text-start px-3 py-2.5 flex items-start gap-3 hover:bg-slate-50 disabled:hover:bg-white disabled:cursor-default">
                                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${r.accounts.length === 0 ? 'bg-slate-300' : r.lastSeen && r.lastSeen.getTime() >= dayAgo ? 'bg-green-500' : 'bg-amber-400'}`} />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-slate-800 truncate">
                                        {r.name || L('بدون اسم', 'No name')}
                                        {r.guest && <span className="ms-2 text-xs font-normal text-slate-500">({L('ليس في قائمة المشاركين', 'not in the participant list')})</span>}
                                    </span>
                                    {r.accounts.length === 0 ? (
                                        <span className="block text-xs text-slate-400">{L('لم يفتح رابط التدريب بعد', 'Has not opened the training link yet')}</span>
                                    ) : (
                                        <>
                                            <span className="block text-xs text-slate-500" dir="ltr">{r.accounts.map((a) => a.email).filter(Boolean).join(', ')}</span>
                                            {!r.guest && (
                                                <span className="block text-[11px] text-slate-400">
                                                    {r.accounts.some((a) => ['email', 'phone', 'saved'].includes(a.linkMethod))
                                                        ? L('رُبط تلقائياً بسجل المشارك', 'Linked automatically to the participant record')
                                                        : L('اختار اسمه بنفسه', 'Picked their own name')}
                                                </span>
                                            )}
                                            <span className="block text-xs text-slate-600">
                                                {L('آخر نشاط', 'Last active')}: {fmt(r.lastSeen)} · {L('حفظ', 'Saves')}: {r.saves}{r.deletes ? ` · ${L('حذف', 'Deletes')}: ${r.deletes}` : ''}
                                            </span>
                                            <span className="flex flex-wrap gap-1 mt-1">
                                                {topEntries(r.views).map(([k, c]) => (
                                                    <span key={`v-${k}`} className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 text-[11px]">{label(k)} ×{c}</span>
                                                ))}
                                                {topEntries(r.collections).map(([k, c]) => (
                                                    <span key={`c-${k}`} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px]">💾 {label(k)} ×{c}</span>
                                                ))}
                                            </span>
                                        </>
                                    )}
                                </span>
                            </button>
                            {isOpen && (
                                <ul className="px-8 pb-3 space-y-1">
                                    {timeline.length === 0 && <li className="text-xs text-slate-400">{L('لا يوجد سجل بعد.', 'No activity recorded yet.')}</li>}
                                    {timeline.map((a) => (
                                        <li key={a.id} className="text-xs text-slate-600 flex gap-2">
                                            <span className="text-slate-400 shrink-0 w-28">{fmt(toDate(a.at))}</span>
                                            <span>
                                                {a.kind === 'view' && <>👁 {L('فتح', 'Opened')} {label(a.view)}</>}
                                                {a.kind === 'save' && <>💾 {L('حفظ', 'Saved')} {label(a.collection)}{a.count > 1 ? ` ×${a.count}` : ''}</>}
                                                {a.kind === 'delete' && <>🗑 {L('حذف', 'Deleted')} {label(a.collection)}{a.count > 1 ? ` ×${a.count}` : ''}</>}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="text-[11px] text-slate-400">
                {L('كل ما يُحفظ عبر رابط التدريب يبقى في نسخة التدريب ولا يظهر في بيانات الدورة الحقيقية.',
                    'Everything saved on the training link stays in the training copy and never appears in the real course data.')}
            </p>
        </div>
    );
}
