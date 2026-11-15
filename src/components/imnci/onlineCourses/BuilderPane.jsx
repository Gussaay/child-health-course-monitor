// src/components/imnci/onlineCourses/BuilderPane.jsx
//
// The case builder and the protocol builder, opened over whichever course
// screen the author is on: from the course list, or from a section's exercise
// card or chart booklet table. Closing it returns to exactly where they were.
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Spinner } from '../../CommonComponents';
import { ExerciseManagerView, ProtocolEditor } from './lazyParts';
import { useCourseScreen } from './screen';

export function BuilderPane() {
    const { t } = useTranslation();
    const { builder, setBuilder, refreshExercises } = useCourseScreen();
    if (!builder) return null;
    // `builder` is 'protocol', 'exercises', or { kind: 'exercises', id } to
    // open one exercise straight away.
    const kind = typeof builder === 'string' ? builder : builder.kind;
    const openId = typeof builder === 'object' ? builder.id : null;
    const isProtocol = kind === 'protocol';
    return (
        // A fixed pane with ONE scrolling area inside it. The first version
        // scrolled the backdrop as well as the panel, and the builder inside
        // brought a third, so the page had three scrollbars and the builder's
        // own heading slid under this one.
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col p-2 sm:p-4" role="dialog" aria-modal="true">
            <div className="mx-auto w-full max-w-6xl bg-white rounded-xl flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
                    <h2 className="font-bold text-slate-800">
                        {isProtocol ? t('imnci_ui.courses.main.protocol_builder', 'Protocol builder') : t('imnci_ui.courses.main.case_builder', 'Case builder')}
                    </h2>
                    <button onClick={() => { setBuilder(null); refreshExercises?.(); }}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title={t('imnci_ui.courses.main.close', 'Close')}>
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    <Suspense fallback={<Spinner />}>
                        {isProtocol ? <ProtocolEditor /> : <ExerciseManagerView openId={openId} />}
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
