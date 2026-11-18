// src/components/imnci/ProtocolManager.jsx
//
// Protocol Manager: a module of its own (main site, federal managers and super
// users only). Each service has its own section: IMNCI holds the protocol
// editor (classification rules, treatments, dose tables, photograph booklet and
// guides); every other service (ETAT, EENC, EmONC ...) holds the facilitator
// guides and notes of its courses.
import React, { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Spinner } from '../CommonComponents';
import { COURSE_CATEGORIES, OTHER_CATEGORY } from './onlineCourses/categories';
import FacilitatorGuides from './FacilitatorGuides';
import ProtocolEditor from './protocol';

const SERVICES = COURSE_CATEGORIES.filter((c) => c !== OTHER_CATEGORY);

export default function ProtocolManager({ permissions = {} }) {
    const { t } = useTranslation();
    const [service, setService] = useState('IMNCI');
    const chip = (active) => `px-3 py-1.5 rounded-full text-sm font-semibold border whitespace-nowrap ${active ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-300 hover:border-sky-400'}`;
    return (
        <div className="space-y-4">
            <PageHeader title={t('landing.modules.protocol_manager', 'Protocol Manager')}
                subtitle={t('protocol_manager.subtitle', 'Protocols and facilitator guides, by service')} />
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
                {SERVICES.map((s) => (
                    <button key={s} role="tab" aria-selected={service === s} className={chip(service === s)} onClick={() => setService(s)}>{s}</button>
                ))}
            </div>
            <Suspense fallback={<Spinner />}>
                {service === 'IMNCI'
                    ? <ProtocolEditor canEdit={!!permissions.canManageProtocols} />
                    : <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4"><FacilitatorGuides key={service} category={service} /></div>}
            </Suspense>
        </div>
    );
}
