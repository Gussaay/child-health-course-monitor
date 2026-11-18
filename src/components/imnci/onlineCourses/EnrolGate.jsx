// src/components/imnci/onlineCourses/EnrolGate.jsx
//
// Shown instead of a course the learner is not enrolled in yet: what the
// course is, and one button to ask a manager to join (or, once asked, that
// the request is waiting).
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock, Lock, Send, XCircle } from 'lucide-react';
import { notify } from '../../dialogs';
import { useCourseScreen } from './screen';
import { useFormTitle } from '../../../utils/pageChrome';

export function EnrolGate() {
    const { t } = useTranslation();
    const { accessOf, back, enrolments, openCourse } = useCourseScreen();
    const [busy, setBusy] = useState(false);
    const access = accessOf(openCourse);
    useFormTitle(openCourse.title, '');

    const run = async (fn, okText) => {
        setBusy(true);
        try { await fn(); if (okText) notify(okText, 'success'); }
        catch (e) { console.error(e); notify(t('imnci_ui.enrol.request_failed', 'Could not send your request. Check your connection and try again.'), 'error'); }
        finally { setBusy(false); }
    };

    return (
        <div className="max-w-xl mx-auto space-y-4">
            <button onClick={back} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                <ArrowLeft size={15} className="rtl:rotate-180" /> {t('imnci_ui.courses.main.all_courses', 'All courses')}
            </button>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-center space-y-3" data-testid="enrol-gate">
                <span className={`mx-auto w-12 h-12 rounded-full grid place-items-center text-white ${access === 'requested' ? 'bg-amber-500' : access === 'declined' ? 'bg-red-600' : 'bg-slate-700'}`}>
                    {access === 'requested' ? <Clock size={22} /> : access === 'declined' ? <XCircle size={22} /> : <Lock size={22} />}
                </span>
                <h1 className="text-xl font-extrabold text-slate-900">{openCourse.title}</h1>
                {openCourse.description && <p className="text-sm text-slate-600">{openCourse.description}</p>}
                {access === 'requested' ? (
                    <>
                        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            {t('imnci_ui.enrol.waiting_long', 'You asked to join this course. A manager will approve your request and place you in a group; the course opens as soon as they do.')}
                        </p>
                        <button disabled={busy} onClick={() => run(() => enrolments.cancel(openCourse.id))}
                            className="text-sm text-slate-500 underline underline-offset-2">
                            {t('imnci_ui.enrol.cancel', 'Cancel my request')}
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-slate-600">
                            {access === 'declined'
                                ? t('imnci_ui.enrol.declined', 'Your last request was not approved. You can ask again, or speak to your manager.')
                                : t('imnci_ui.enrol.needs_long', 'This course needs enrolment. Ask to join and a manager will approve you.')}
                        </p>
                        <button disabled={busy} onClick={() => run(() => enrolments.request(openCourse.id), t('imnci_ui.enrol.requested_note', 'Your request was sent. A manager will approve it.'))}
                            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 disabled:opacity-50">
                            <Send size={16} /> {busy ? t('imnci_ui.enrol.sending', 'Sending…') : t('imnci_ui.enrol.ask', 'Ask to join')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
