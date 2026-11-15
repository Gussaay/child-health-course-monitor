import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { BriefcaseMedical, Check } from 'lucide-react';
import { db } from '../firebase';
import { listHealthFacilities } from '../data';
import { STATE_LOCALITIES } from './constants';
import { Input, Select, Spinner } from './CommonComponents';
import {
    JOB_TITLES, WORKPLACE_TYPES, PROGRAMS, HR_GROUPS,
    missingWorkFields, saveWorkProfile, suggestedGroup, optionLabel,
} from '../utils/workProfile';

// Asked once after sign in / sign up (and again from My Profile to edit):
// job, place of work, what kind of workplace, and optionally a request to be
// added to a program team, partner organization or the facilitators list.
const Chip = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`flex items-center justify-center gap-1 rounded-lg border-2 px-2 py-2 text-sm font-semibold transition-colors ${
            active ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200' : 'border-gray-200 text-gray-700 hover:border-sky-300 dark:border-slate-600 dark:text-gray-200'
        }`}
    >
        {active && <Check size={14} className="shrink-0" />}
        <span className="truncate">{children}</span>
    </button>
);

const Label = ({ children }) => <p className="mb-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">{children}</p>;

export default function WorkProfileModal({ uid, displayName, initial, hrRequest, onDone, onLater }) {
    const { t, i18n } = useTranslation();
    const lang = (i18n.language || 'en').startsWith('ar') ? 'ar' : 'en';
    const [form, setForm] = useState(() => ({
        jobTitle: '', jobTitleOther: '', phone: '', state: '', locality: '',
        workplaceType: '', facilityId: '', facilityName: '', program: '', programOther: '', organizationName: '',
        ...(initial || {}),
    }));
    const pendingGroup = hrRequest && hrRequest.status !== 'rejected' && hrRequest.status !== 'cancelled' ? hrRequest.group : '';
    const [requestGroup, setRequestGroup] = useState(pendingGroup);
    const [facilities, setFacilities] = useState([]);
    const [loadingFacilities, setLoadingFacilities] = useState(false);
    const [facilityOpen, setFacilityOpen] = useState(false);
    const [partners, setPartners] = useState([]);
    const [showErrors, setShowErrors] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const missing = missingWorkFields(form);
    const bad = (field) => showErrors && missing.includes(field);
    const errClass = (field) => (bad(field) ? 'border-red-400 ring-1 ring-red-300' : '');

    const states = useMemo(() => Object.keys(STATE_LOCALITIES).filter((s) => s !== 'Federal'), []);
    const stateName = (s) => (lang === 'ar' ? STATE_LOCALITIES[s]?.ar : STATE_LOCALITIES[s]?.en) || s;
    const localities = form.state ? (STATE_LOCALITIES[form.state]?.localities || []) : [];

    // Federal workers have no locality to choose.
    useEffect(() => {
        if (form.state === 'Federal' && form.locality !== 'Federal') set({ locality: 'Federal' });
    }, [form.state]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (form.workplaceType !== 'facility' || !form.state || !form.locality || form.state === 'Federal') { setFacilities([]); return; }
        let live = true;
        setLoadingFacilities(true);
        listHealthFacilities({ state: form.state, locality: form.locality })
            .then((list) => { if (live) setFacilities(list.filter((f) => f.isDeleted !== true && f['اسم_المؤسسة'])); })
            .catch(() => { if (live) setFacilities([]); })
            .finally(() => { if (live) setLoadingFacilities(false); });
        return () => { live = false; };
    }, [form.workplaceType, form.state, form.locality]);

    useEffect(() => {
        if (form.workplaceType !== 'organization' || partners.length) return;
        getDocs(collection(db, 'funders'))
            .then((snap) => setPartners([...new Set(snap.docs.map((d) => d.data()).filter((p) => p.isDeleted !== true).map((p) => p.orgName).filter(Boolean))].sort()))
            .catch(() => {});
    }, [form.workplaceType, partners.length]);

    const facilityMatches = useMemo(() => {
        const q = (form.facilityName || '').toLowerCase();
        return facilities.filter((f) => (f['اسم_المؤسسة'] || '').toLowerCase().includes(q)).slice(0, 50);
    }, [facilities, form.facilityName]);

    const save = async () => {
        setError('');
        if (missing.length) { setShowErrors(true); setError(t('work_profile.fill_missing', 'Please fill the fields marked in red.')); return; }
        setSaving(true);
        try {
            const clean = await saveWorkProfile(uid, form, requestGroup, hrRequest);
            onDone?.(clean);
        } catch (e) {
            console.error('Work profile save failed', e);
            setError(t('work_profile.save_failed', 'Could not save. Check your connection and try again.'));
            setSaving(false);
        }
    };

    const showProgram = form.workplaceType === 'moh' || form.workplaceType === 'locality';
    const suggested = suggestedGroup(form);

    return (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-slate-900/60 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="work-profile-title">
            <div className="flex max-h-[100dvh] sm:max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
                <div className="flex items-start gap-3 border-b border-gray-100 dark:border-slate-700 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300">
                        <BriefcaseMedical size={20} />
                    </div>
                    <div className="min-w-0">
                        <h2 id="work-profile-title" className="text-lg font-bold text-gray-800 dark:text-gray-100">
                            {initial ? t('work_profile.title_edit', 'Your work details') : t('work_profile.title', 'Complete your profile')}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {displayName ? `${displayName} · ` : ''}{t('work_profile.subtitle', 'Tell us where you work so the program can reach you.')}
                        </p>
                    </div>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-4">
                    <section>
                        <Label>{t('work_profile.job', 'Job')}</Label>
                        <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 rounded-lg ${bad('jobTitle') ? 'ring-2 ring-red-300 p-1' : ''}`}>
                            {JOB_TITLES.map((j) => (
                                <Chip key={j.id} active={form.jobTitle === j.id} onClick={() => set({ jobTitle: j.id })}>{optionLabel(JOB_TITLES, j.id, lang)}</Chip>
                            ))}
                        </div>
                        {form.jobTitle === 'other' && (
                            <div className="mt-2">
                                <Input name="jobTitleOther" value={form.jobTitleOther} onChange={(e) => set({ jobTitleOther: e.target.value })} placeholder={t('work_profile.job_other', 'Write your job')} className={errClass('jobTitleOther')} />
                            </div>
                        )}
                    </section>

                    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select name="wpState" label={t('work_profile.state', 'State')} value={form.state} className={errClass('state')}
                            onChange={(e) => set({ state: e.target.value, locality: '', facilityId: '', facilityName: '' })}>
                            <option value="">{t('work_profile.choose', '-- Choose --')}</option>
                            <option value="Federal">{lang === 'ar' ? 'اتحادي (وزارة الصحة الاتحادية)' : 'Federal (Federal Ministry)'}</option>
                            {states.map((s) => <option key={s} value={s}>{stateName(s)}</option>)}
                        </Select>
                        <Select name="wpLocality" label={t('work_profile.locality', 'Locality')} value={form.locality} className={errClass('locality')}
                            disabled={!form.state || form.state === 'Federal'}
                            onChange={(e) => set({ locality: e.target.value, facilityId: '', facilityName: '' })}>
                            <option value="">{t('work_profile.choose', '-- Choose --')}</option>
                            {localities.map((l) => <option key={l.en} value={l.en}>{lang === 'ar' ? l.ar : l.en}</option>)}
                        </Select>
                    </section>

                    <section>
                        <Label>{t('work_profile.workplace', 'Where do you work?')}</Label>
                        <div className={`grid grid-cols-2 gap-2 rounded-lg ${bad('workplaceType') ? 'ring-2 ring-red-300 p-1' : ''}`}>
                            {WORKPLACE_TYPES.map((w) => (
                                <Chip key={w.id} active={form.workplaceType === w.id} onClick={() => set({ workplaceType: w.id })}>{optionLabel(WORKPLACE_TYPES, w.id, lang)}</Chip>
                            ))}
                        </div>

                        {form.workplaceType === 'facility' && (
                            <div className="relative mt-3">
                                <Input name="wpFacility" label={t('work_profile.facility', 'Facility name')} value={form.facilityName}
                                    disabled={!form.locality}
                                    placeholder={form.locality ? t('work_profile.facility_search', 'Search the facility list...') : t('work_profile.facility_pick_locality', 'Choose the state and locality first')}
                                    className={errClass('facilityName')}
                                    onFocus={() => setFacilityOpen(true)}
                                    onBlur={() => setTimeout(() => setFacilityOpen(false), 150)}
                                    onChange={(e) => { set({ facilityName: e.target.value, facilityId: '' }); setFacilityOpen(true); }} />
                                {loadingFacilities && <div className="absolute end-3 top-9"><Spinner size="sm" /></div>}
                                {facilityOpen && form.locality && !loadingFacilities && (
                                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-300 bg-white dark:bg-slate-700 shadow-lg">
                                        {facilityMatches.length ? facilityMatches.map((f) => (
                                            <button type="button" key={f.id} className="block w-full p-2 text-start text-sm hover:bg-gray-100 dark:hover:bg-slate-600"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => { set({ facilityId: f.id, facilityName: f['اسم_المؤسسة'] }); setFacilityOpen(false); }}>
                                                {f['اسم_المؤسسة']}
                                            </button>
                                        )) : (
                                            <p className="p-2 text-sm text-gray-500">{t('work_profile.facility_none', 'Not in the list. Keep the name you typed.')}</p>
                                        )}
                                    </div>
                                )}
                                {form.facilityName && !form.facilityId && !facilityOpen && (
                                    <p className="mt-1 text-xs text-amber-600">{t('work_profile.facility_not_listed', 'This facility is not in the list; it will be saved as typed.')}</p>
                                )}
                            </div>
                        )}

                        {form.workplaceType === 'organization' && (
                            <div className="mt-3">
                                <Input name="wpOrg" list="wp-partner-list" label={t('work_profile.organization', 'Organization name')} value={form.organizationName}
                                    className={errClass('organizationName')} onChange={(e) => set({ organizationName: e.target.value })} />
                                <datalist id="wp-partner-list">{partners.map((p) => <option key={p} value={p} />)}</datalist>
                            </div>
                        )}

                        {showProgram && (
                            <div className="mt-3">
                                <Select name="wpProgram" label={t('work_profile.program', 'Directorate / program')} value={form.program} className={errClass('program')}
                                    onChange={(e) => set({ program: e.target.value })}>
                                    <option value="">{t('work_profile.choose', '-- Choose --')}</option>
                                    {PROGRAMS.map((p) => <option key={p.id} value={p.id}>{optionLabel(PROGRAMS, p.id, lang)}</option>)}
                                </Select>
                                {form.program === 'other' && (
                                    <div className="mt-2">
                                        <Input name="wpProgramOther" value={form.programOther} onChange={(e) => set({ programOther: e.target.value })} placeholder={t('work_profile.program_other', 'Write the directorate or program')} className={errClass('programOther')} />
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    <section>
                        <Input name="wpPhone" type="tel" label={t('work_profile.phone', 'Phone (optional)')} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
                    </section>

                    <section className="rounded-xl border border-gray-200 dark:border-slate-600 p-3">
                        <Label>{t('work_profile.join_title', 'Ask to be added to a team (optional)')}</Label>
                        <Select name="wpGroup" value={requestGroup} onChange={(e) => setRequestGroup(e.target.value)}>
                            <option value="">{t('work_profile.join_none', 'No, thanks')}</option>
                            {HR_GROUPS.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {optionLabel(HR_GROUPS, g.id, lang)}{g.id === suggested ? ` ${t('work_profile.suggested', '(suggested)')}` : ''}
                                </option>
                            ))}
                        </Select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {hrRequest?.status === 'approved' && hrRequest.group === requestGroup
                                ? t('work_profile.join_approved', 'You were added to this team.')
                                : hrRequest?.status === 'pending' && hrRequest.group === requestGroup
                                    ? t('work_profile.join_pending', 'Your request is waiting for an administrator.')
                                    : t('work_profile.join_hint', 'An administrator reviews the request before you are added.')}
                        </p>
                    </section>

                    {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}
                </div>

                <div className="flex gap-2 border-t border-gray-100 dark:border-slate-700 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                    {onLater && (
                        <button type="button" onClick={onLater} disabled={saving} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700">
                            {initial ? t('work_profile.cancel', 'Cancel') : t('work_profile.later', 'Later')}
                        </button>
                    )}
                    <button type="button" onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-bold text-white hover:bg-sky-700 disabled:opacity-60">
                        {saving && <Spinner size="sm" />}{t('work_profile.save', 'Save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
