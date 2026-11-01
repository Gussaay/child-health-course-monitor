import React, { useState, useEffect, useRef } from 'react';
import { Card, PageHeader, Button, Spinner } from '../CommonComponents';
import { useDataCache } from '../../DataContext';
import { saveIMNCIProtocol, appendIMNCIProtocolHistory, getIMNCIProtocolHistory } from '../../data';
import { auth } from '../../firebase';
import { notify, confirmDialog, promptDialog } from '../dialogs';
// The same four severities the online course books colour their classification
// tables with, and that the patient form compares against by value. Defined
// once in constants.js so the protocol, the books and the exercises cannot
// drift into three different spellings of "yellow".
import { IMNCI_SEVERITIES } from '../constants';
import { NATIONAL_PROTOCOLS, NATIONAL_SAVE_ORDER } from './nationalProtocol';
import { BookletProtocolView, BookletDoseView } from './bookletView';
import { NATIONAL_FORMS } from './recordingForms';
import { RecordingFormView } from './recordingFormView';
import { NATIONAL_GUIDES } from './treatmentGuides';
import { GuideBlock, addGuideBox } from './treatmentGuideView';
import { GENERAL, FORM, topicsFor, drugsForTopic, guideForTopic, groupForNewBox } from './topics';
import { diffProtocol, currentEditor } from './protocolHistory';
import { useTranslation } from 'react-i18next';
import { Save, Plus, Trash2, DownloadCloud, FolderPlus, Globe, Syringe, Activity, ChevronDown, ChevronRight, Lock, X, Pencil, Settings2, History, ClipboardList, Baby, User, ListChecks, MessageCircle, CalendarClock, Stethoscope, BookOpen } from 'lucide-react';

// --- Predefined Conditions Mapping for Dropdowns ---
const CHILD_CONDITIONS = [
    'notAbleToDrink', 'lethargicUnconscious', 'vomitsEverything', 'convulsingNow', 'historyOfConvulsions',
    'hasCough', 'fastBreathing', 'chestIndrawing', 'stridor', 'wheeze',
    'hasDiarrhea', 'diarrhea14Days', 'bloodInStool', 'lethargic', 'restlessIrritable', 'sunkenEyes', 'drinkPoorly', 'drinkEagerly', 'pinchVerySlow', 'pinchSlow',
    'hasFever', 'dailyFever7Days', 'measles3Months', 'neckStiffness', 'measlesRash', 'malariaTestPositive', 'mouthUlcers', 'deepExtensiveUlcers', 'pusFromEye', 'corneaClouding',
    'hasEarProblem', 'earPain', 'earDischargeAcute', 'earDischargeChronic', 'tenderSwelling', 'pusFromEar',
    'severePalmarPallor', 'somePalmarPallor', 'noPalmarPallor',
    'edema', 'samWithComplications', 'samWithoutComplications', 'moderateAcuteMalnutrition', 'noMalnutrition',
    'hasOtherProblems', 'hasDangerSign', 'hasDehydration',
    // Worked out by the engine from the ticks above (engine.js).
    'dehydLethargic', 'dehydNotDrinking', 'severeDehydration', 'someDehydration', 'dehydrationPresent', 'measlesNowOrRecent'
];

const INFANT_CONDITIONS = [
    'notFeedingWell', 'convulsions', 'convulsingNow', 'movementOnlyStimulated', 'movementOnlyStimulatedNoMovement', 'fastBreathing60', 'severeChestIndrawing', 'fever37_5', 'fever38', 'lowTemp35_5',
    'umbilicusRedDraining', 'pusFromEyes', 'skinPustules',
    'hasJaundice', 'jaundiceFirst24h', 'jaundiceLowWeight', 'jaundiceSolesPalms', 'jaundiceAfter24h',
    'hasDiarrhea', 'bloodInStool', 'diarrheaMovement', 'diarrheaRestless', 'diarrheaSunkenEyes', 'pinchVerySlow', 'pinchSlow',
    'diffFeeding', 'feedsLessThan8Times', 'receivesOtherFoods', 'lowWeightForAge', 'thrush', 'notWellAttached', 'notSucklingEffectively', 'feedingWellNormalWeight',
    'noBacterialSigns', 'hasOtherProblems',
    // Worked out by the engine from the ticks above (engine.js).
    'possibleSevereDisease', 'localBacterialInfection', 'jaundiceSevere', 'noJaundice', 'diarrhea14Days',
    'severeDehydration', 'someDehydration', 'dehydrationPresent', 'notBreastfeeding', 'notWellPositioned', 'feedingProblem'
];

// --- Predefined Treatments Mapping for Dropdowns ---
const BASE_CHILD_TREATMENTS = [
    "Give first dose of appropriate IM antibiotic: {{dose:ampicillin_gentamycin}}",
    "Give first dose of IM Ampicillin: {{dose:ampicillin}}",
    "Give first dose of IM Gentamycin: {{dose:gentamycin}}",
    "Give first dose of IM Quinine: {{dose:quinine}}",
    "Give oral Amoxicillin for 5 days: {{dose:amoxicillin}}",
    "Give oral Ciprofloxacin for 3 days: {{dose:ciprofloxacin}}",
    "Give oral antimalarial (Coartem): {{dose:coartem}}",
    "Give Iron supplement: {{dose:iron}}",
    "Give oral Mebendazole: {{dose:mebendazole}}",
    "Give Zinc supplement: {{dose:zinc}}",
    "Give Vitamin A: {{dose:vitamin_a}}",
    "Give Paracetamol for high fever: {{dose:paracetamol}}",
    "Give first dose of Paracetamol for pain: {{dose:paracetamol}}",
    "Give Diazepam rectally if convulsing now: {{dose:diazepam}}",
    "Give fluid for severe dehydration (Plan C): {{dose:plan_c_iv}}",
    "Give fluid and food for some dehydration (Plan B): {{dose:plan_b_ors}}",
    "Give fluid and food to treat diarrhea at home (Plan A): {{dose:plan_a_ors}}",
    "Give RUTF (Plumpy'Nut): {{dose:rutf}}",
    "Treat wheezing if present: {{dose:salbutamol_oral}}",
    "If wheezing, give inhaled bronchodilator: {{dose:salbutamol_oral}}",
    "Prevent low blood sugar",
    "Refer URGENTLY to hospital",
    "Soothe the throat and relieve the cough",
    "If cough for more than 14 days, refer to hospital",
    "Treat dehydration before referral",
    "Treat any other apparent cause of fever",
    "If clouding of cornea or pus draining from eye, apply Tetracycline eye ointment",
    "If pus draining from eye, treat with Tetracycline eye ointment",
    "If mouth ulcers, treat with Gentian Violet",
    "Dry the ear by wicking",
    "Treat with topical Quinolone ear drops for 14 days",
    "Keep the child warm",
    "Advise mother when to return immediately",
    "Advise mother on feeding a child with persistent diarrhea",
    "Counsel mother on feeding",
    "Refer to supplementary feeding program if available",
    "Assess the child's feeding and counsel the mother",
    "If child is less than 2 years old, assess feeding and counsel the mother",
    "Follow-up in 3 days",
    "Follow-up in 5 days if not improving",
    "Follow-up in 14 days",
    "Follow-up in 30 days",
    "No additional treatment needed"
];

const BASE_INFANT_TREATMENTS = [
    "Give first dose of IM Ampicillin: {{dose:ampicillin_im_infant}}",
    "Give first dose of IM Gentamicin (Age < 7 Days): {{dose:gentamicin_im_infant_lt7}}",
    "Give first dose of IM Gentamicin (Age >= 7 Days): {{dose:gentamicin_im_infant_gte7}}",
    "Give oral Amoxicillin for 5 days: {{dose:amoxicillin_infant}}",
    "Treat to prevent low blood sugar",
    "Advise mother how to keep the infant warm on the way to the hospital",
    "Refer URGENTLY to hospital",
    "Teach mother to treat local infections at home",
    "Advise mother to give home care for the young infant",
    "Advise mother to return immediately if jaundice extends to palms and soles",
    "Advise mother to breastfeed as often and for as long as the infant wants",
    "If feeding less than 8 times in 24 hours, advise to increase frequency",
    "If thrush, teach mother to treat with Gentian Violet at home",
    "Praise the mother for feeding the infant well",
    "Follow-up in 1 day",
    "Follow-up in 2 days"
];

// Every line of the national protocol is offered too, so a box can be rebuilt
// from the booklet's own wording.
const treatmentsOf = (protocol) => Object.values(protocol.categories).flatMap((c) => c.rules.flatMap((r) => r.treatments));
const CHILD_TREATMENTS = [...new Set([...treatmentsOf(NATIONAL_PROTOCOLS.child), ...BASE_CHILD_TREATMENTS])];
const INFANT_TREATMENTS = [...new Set([...treatmentsOf(NATIONAL_PROTOCOLS.infant), ...BASE_INFANT_TREATMENTS])];

// ============================================================================
// VALIDATION
//
// This editor writes the rules a health worker is shown at the bedside, so the
// checks below run before anything reaches the database.
//
// The one that matters most is the dose tag. A treatment line carries markers
// like {{dose:amoxicillin}}, and the clinical engine swaps each one for the
// calculated dose from the matching Doses tab. If the id does not exist there,
// the worker is shown a treatment with no dose at all — a silent failure, on
// the screen where it matters most. Nothing checked this before.
// ============================================================================

const DOSE_TAG = /\{\{dose:([^}]+)\}\}/g;

export function extractDoseTags(text) {
    return [...String(text || '').matchAll(DOSE_TAG)].map((m) => m[1].trim());
}

/**
 * @param {string} formType   'child' | 'infant' | 'dosages_child' | 'dosages_infant'
 * @param {object} data       the protocol being edited
 * @param {Array}  dosageList drugs from the matching dosages protocol
 * @returns {{errors: Array, warnings: Array}}
 *   errors block the save; warnings are confirmed past, because a protocol is
 *   often saved half-finished and being nagged is not the same as being wrong.
 */
export function validateProtocol(formType, data, dosageList = []) {
    const errors = [];
    const warnings = [];
    if (!data) return { errors: [{ message: 'There is nothing to save.' }], warnings };

    if (formType.startsWith('dosages')) {
        const drugs = data.drugs || [];
        const seen = new Map();

        drugs.forEach((drug, i) => {
            const where = `Drug ${i + 1} (${drug.label || 'unnamed'})`;
            if (!String(drug.id || '').trim()) {
                errors.push({ message: `${where} has no id. Treatments reference drugs by id.` });
            } else if (seen.has(drug.id)) {
                errors.push({
                    message: `${where} reuses the id "${drug.id}", already used by ${seen.get(drug.id)}. `
                        + 'A duplicate id makes which dose is shown unpredictable.',
                });
            } else {
                seen.set(drug.id, where);
            }

            if (!String(drug.label || '').trim()) warnings.push({ message: `${where} has no display label.` });

            const ranges = drug.rules || [];
            if (ranges.length === 0) {
                warnings.push({ message: `${where} has no dose ranges, so it always falls back to the fallback text.` });
            }
            ranges.forEach((r, ri) => {
                const rWhere = `${where}, range ${ri + 1}`;
                if (!String(r.doseQty || '').trim()) {
                    errors.push({ message: `${rWhere} has no dose quantity.` });
                }
                // Reversed bounds match nothing, so the range is dead weight that
                // looks like cover.
                const pairs = [['minAge', 'maxAge', 'age'], ['minWeight', 'maxWeight', 'weight']];
                pairs.forEach(([lo, hi, label]) => {
                    const a = parseFloat(r[lo]);
                    const b = parseFloat(r[hi]);
                    if (Number.isFinite(a) && Number.isFinite(b) && a > b) {
                        errors.push({ message: `${rWhere} has a ${label} range of ${a} to ${b}, which can never match.` });
                    }
                });
            });
        });

        return { errors, warnings };
    }

    // Clinical rule tabs.
    const knownDoseIds = new Set((dosageList || []).map((d) => d.id));
    // With no Doses tab saved at all, every dose looks missing. Say that once
    // instead of once per treatment line (it used to be 41 lines).
    const anyDoseTag = Object.values(data.categories || {}).some((cat) => (cat.rules || [])
        .some((r) => (r.treatments || []).some((t) => extractDoseTags(t).length > 0)));
    if (knownDoseIds.size === 0 && anyDoseTag) {
        errors.push({
            message: 'The matching Doses tab has not been saved yet, so no dose in these rules can be shown. '
                + 'Open the Doses tab and save it first, or use "Load national protocol", which saves all four tabs in the right order.',
        });
    }
    const categories = data.categories || {};
    const ruleIds = new Map();

    Object.entries(categories).forEach(([catKey, cat]) => {
        const rules = cat.rules || [];
        if (!String(cat.title || '').trim()) {
            warnings.push({ message: `Category "${catKey}" has no title.` });
        }
        if (rules.length === 0) {
            warnings.push({ message: `Category "${cat.title || catKey}" has no rules, so it classifies nothing.` });
        }

        const labelsSeen = new Map();

        rules.forEach((rule, i) => {
            const where = `${cat.title || catKey} — rule ${i + 1}`;

            if (rule.id) {
                if (ruleIds.has(rule.id)) {
                    warnings.push({ message: `${where} reuses the rule id "${rule.id}" (also ${ruleIds.get(rule.id)}).` });
                } else {
                    ruleIds.set(rule.id, where);
                }
            }

            const label = String(rule.classification?.label || '').trim();
            if (!label) {
                errors.push({ message: `${where} has no classification label, so the worker sees a blank result.` });
            } else if (labelsSeen.has(label)) {
                warnings.push({
                    message: `${where} repeats the classification "${label}" from rule ${labelsSeen.get(label)}. `
                        + 'Only the first match is shown.',
                });
            } else {
                labelsSeen.set(label, i + 1);
            }

            // A rule with no conditions cannot be evaluated: depending on the
            // match type it either never fires or fires for every child.
            if (!(rule.conditions || []).length) {
                errors.push({ message: `${where} has no conditions selected.` });
            }

            (rule.treatments || []).forEach((t, ti) => {
                extractDoseTags(t).forEach((id) => {
                    if (knownDoseIds.size > 0 && !knownDoseIds.has(id)) {
                        errors.push({
                            message: `${where}, treatment ${ti + 1} refers to the dose "${id}", `
                                + 'which does not exist in the matching Doses tab. The worker would '
                                + 'be shown this treatment with no dose.',
                        });
                    }
                });
            });
        });
    });

    return { errors, warnings };
}

// --- Custom Treatment Adder Component ---
const CustomTreatmentAdder = ({ onAdd, dosages }) => {
    const { t } = useTranslation();
    const [val, setVal] = useState('');
    return (
        <div className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-emerald-200">
            <label className="text-xs font-bold text-emerald-800 uppercase">{t('clinical_ui.protocol.custom.title', 'Add Custom Treatment (If not in list)')}</label>
            <div className="flex flex-col xl:flex-row gap-1.5 items-stretch xl:items-center">
                <select 
                    className="text-xs p-1.5 border border-emerald-300 rounded w-full xl:w-28 bg-emerald-50 text-emerald-800 font-bold" 
                    onChange={(e) => { setVal(v => v + (v ? ' ' : '') + `{{dose:${e.target.value}}}`); e.target.value = ''; }}
                >
                    <option value="">{t('clinical_ui.protocol.custom.dose_tag', '+ Dose Tag')}</option>
                    {dosages.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
                <input 
                    type="text" 
                    value={val} 
                    onChange={e => setVal(e.target.value)} 
                    placeholder={t('clinical_ui.protocol.custom.placeholder', 'Type custom text...')} 
                    className="flex-1 text-xs p-1.5 border border-slate-300 rounded focus:ring-sky-500" 
                    dir="auto"
                />
                <button 
                    onClick={() => { if(val.trim()) { onAdd(val.trim()); setVal(''); } }} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shrink-0"
                >
                    {t('clinical_ui.protocol.custom.add', 'Add')}
                </button>
            </div>
        </div>
    );
};

// The page is two parts, sick child and young infant. Each part has one tab per
// illness (topics.js): the classification table, then its doses, treatment,
// counselling and follow-up, one after the other. Behind them are still four
// protocol documents per part, all held here at once, so moving between tabs
// never loses an edit and Save writes every document that changed.
const PARTS = ['child', 'infant'];
const docTypes = (part) => ({ classify: part, drugs: `dosages_${part}`, guide: `guide_${part}`, form: `form_${part}` });
const ALL_TYPES = PARTS.flatMap((p) => Object.values(docTypes(p)));
// Doses before the rules that point at them, so a new dose is saved before
// the line that uses it is checked against the database.
const SAVE_ORDER = ['dosages_child', 'dosages_infant', 'child', 'infant', 'guide_child', 'guide_infant', 'form_child', 'form_infant'];
// Text-only documents (recording forms, treatment tables): nothing to validate,
// and no rule builder.
const isTextType = (ft) => ft.startsWith('form_') || ft.startsWith('guide_');
const NATIONAL_TEXT = { ...NATIONAL_FORMS, ...NATIONAL_GUIDES };
const clone = (v) => JSON.parse(JSON.stringify(v));
// A document nobody has saved yet: the national text for forms and tables,
// otherwise empty.
const defaultDoc = (ft) => (NATIONAL_TEXT[ft] ? clone(NATIONAL_TEXT[ft])
    : ft.startsWith('dosages') ? { formType: ft, version: '1.0', drugs: [] }
        : { formType: ft, version: '1.0', categories: {} });
const TOPIC_LABELS = {
    danger: 'Danger signs', cough: 'Pneumonia / cough', diarrhea: 'Diarrhoea', fever: 'Fever, malaria & measles',
    ear: 'Ear problem', malnutrition: 'Malnutrition', anemia: 'Anaemia',
    bacterial_infection: 'Bacterial infection', jaundice: 'Jaundice', feeding_problem: 'Feeding & low weight',
    [GENERAL]: 'General', [FORM]: 'Recording form',
};
// A history entry is kept small: one Firestore document holds a month of them.
const MAX_CHANGES = 150;

// Who changed what, newest first.
const HistoryPanel = ({ entries, loading, onClose, t }) => (
    <div className="border border-slate-300 bg-white rounded-md shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><History size={16} /> {t('clinical_ui.protocol.history.title', 'Change history')}</h3>
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800" aria-label={t('clinical_ui.protocol.btn.close', 'Close')}><X size={16} /></button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-100">
            {loading && <div className="p-4 text-center text-slate-500">{t('clinical_ui.protocol.history.loading', 'Loading history…')}</div>}
            {!loading && entries.length === 0 && <div className="p-4 text-center text-slate-500">{t('clinical_ui.protocol.history.empty', 'No changes recorded yet.')}</div>}
            {!loading && entries.map((e, i) => (
                <details key={`${e.at}_${i}`} className="px-3 py-2">
                    <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <span className="font-bold text-slate-900">{e.name || e.email || '—'}</span>
                            {e.role && <span className="text-[11px] font-bold uppercase bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{e.role}</span>}
                            <span className="text-xs text-slate-600">{e.at ? new Date(e.at).toLocaleString() : ''}</span>
                        </div>
                        <div className="text-xs text-slate-700 mt-0.5">
                            {t(`clinical_ui.protocol.history.tab.${e.formType}`, e.formType)}
                            {' · '}
                            {e.summary || t('clinical_ui.protocol.history.count', '{{count}} change(s)', { count: (e.changes || []).length })}
                        </div>
                    </summary>
                    {(e.changes || []).length > 0 && (
                        <ul className="mt-2 space-y-1.5 text-xs">
                            {e.changes.map((c, k) => (
                                <li key={k} className="border-s-2 border-sky-300 ps-2">
                                    <div className="font-bold text-slate-800" dir="auto">{c.where}</div>
                                    {c.before && <div className="text-red-800" dir="auto"><span className="font-bold">{t('clinical_ui.protocol.history.before', 'Before')}:</span> {c.before}</div>}
                                    {c.after && <div className="text-emerald-800" dir="auto"><span className="font-bold">{t('clinical_ui.protocol.history.after', 'After')}:</span> {c.after}</div>}
                                </li>
                            ))}
                            {e.more > 0 && <li className="text-slate-500">{t('clinical_ui.protocol.history.more', '…and {{count}} more', { count: e.more })}</li>}
                        </ul>
                    )}
                </details>
            ))}
        </div>
    </div>
);

export default function ProtocolEditor() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { protocols, fetchProtocols, isLoading } = useDataCache();
    const [part, setPart] = useState('child');
    const [topicChoice, setTopicChoice] = useState({});
    // Every protocol document of both parts, by formType, as being edited.
    const [docs, setDocs] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [issues, setIssues] = useState(null);
    // Read-only until Edit is pressed. Editing shows the same layout with every
    // cell editable; Advanced is the rule builder (conditions and logic).
    const [editing, setEditing] = useState(false);
    const [advanced, setAdvanced] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    // 'offline' | 'failed' | null. Set when the protocols could not be read, so
    // the page says so instead of spinning forever.
    const [loadError, setLoadError] = useState(null);

    // Nothing else on the page asked for the protocols, so the editor waited on
    // a load that never started. It now starts the load itself. The cache hands
    // back a keyed object on success and an empty array when the read failed or
    // the device is offline with nothing saved.
    const loadProtocols = async (force = false) => {
        setLoadError(null);
        const result = await fetchProtocols(force);
        if (!result || Array.isArray(result)) {
            setLoadError(navigator.onLine ? 'failed' : 'offline');
        }
    };
    useEffect(() => {
        loadProtocols(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A snapshot of what was loaded, per document, so "has this been edited"
    // is a fact rather than a flag someone has to remember to set.
    const baselineRef = useRef({});
    const dirtyTypes = ALL_TYPES.filter((ft) => docs[ft] && JSON.stringify(docs[ft]) !== baselineRef.current[ft]);
    const isDirty = dirtyTypes.length > 0;
    const setDoc = (ft, data) => setDocs((prev) => ({ ...prev, [ft]: data }));

    // Accordion States for Compact Layout
    const [expandedCats, setExpandedCats] = useState({});
    const [expandedRules, setExpandedRules] = useState({});
    const [expandedDrugs, setExpandedDrugs] = useState({});

    // Loads every document.
    //
    // The guard is the point. This effect depends on `protocols`, so ANY refresh
    // of the cache used to overwrite the editor — an hour of rule authoring
    // replaced by the server copy, with no warning and no undo. A document with
    // unsaved edits is never overwritten; the others take the fresh copy.
    useEffect(() => {
        // Only once the protocols really loaded. Starting from a blank
        // protocol after a FAILED load would let a save wipe the live rules.
        if (!protocols || Array.isArray(protocols)) return;
        const next = { ...docs };
        let changed = false;
        ALL_TYPES.forEach((ft) => {
            const cur = docs[ft];
            if (cur && JSON.stringify(cur) !== baselineRef.current[ft]) return;
            const fresh = protocols[ft] ? clone(protocols[ft]) : defaultDoc(ft);
            const json = JSON.stringify(fresh);
            if (cur && json === baselineRef.current[ft]) return;
            baselineRef.current[ft] = json;
            next[ft] = fresh;
            changed = true;
        });
        if (changed) setDocs(next);
        // docs is read, not depended on: adding it would re-run the effect on
        // every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [protocols, isLoading.imnciProtocols]);

    // Closing the tab is the other way an hour of work disappears.
    useEffect(() => {
        if (!isDirty) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [isDirty]);

    const types = docTypes(part);
    const classKey = types.classify;
    const doseKey = types.drugs;
    const guideKey = types.guide;
    const formKey = types.form;
    const classDoc = docs[classKey];
    const doseDoc = docs[doseKey];
    const guideDoc = docs[guideKey];

    const topics = classDoc ? topicsFor(part, classDoc) : [];
    const topic = topics.find((tp) => tp.id === topicChoice[part]) ? topicChoice[part] : (topics[0]?.id || GENERAL);
    const isFormTab = topic === FORM;
    const viewMode = !editing ? 'booklet' : (advanced && !isFormTab ? 'advanced' : 'edit');
    const openTopic = (id) => { setTopicChoice((prev) => ({ ...prev, [part]: id })); setSearch(''); };
    // Nothing is lost by changing part or tab: every document stays in the editor.
    const switchPart = (next) => { if (next !== part) { setPart(next); setIssues(null); setSearch(''); } };

    const docName = (ft) => t(`clinical_ui.protocol.history.tab.${ft}`, ft);

    const handleSave = async () => {
        const toSave = SAVE_ORDER.filter((ft) => dirtyTypes.includes(ft));
        if (!toSave.length) return;

        // Checked before the write, not after. A protocol with a dangling dose
        // tag saves perfectly happily and only fails at the bedside. Rules are
        // checked against the doses as they will be once this save is done
        // (doses are saved first). Forms and tables are text only.
        const errors = [];
        const warnings = [];
        toSave.filter((ft) => !isTextType(ft)).forEach((ft) => {
            const doses = PARTS.includes(ft) ? (docs[`dosages_${ft}`]?.drugs || []) : [];
            const r = validateProtocol(ft, docs[ft], doses);
            const tag = (m) => ({ ...m, message: `${docName(ft)}: ${m.message}` });
            errors.push(...r.errors.map(tag));
            warnings.push(...r.warnings.map(tag));
        });
        setIssues({ errors, warnings });

        if (errors.length > 0) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (warnings.length > 0 && !await confirmDialog(
            t('clinical_ui.protocol.dlg.save_anyway_msg', '{{count}} thing(s) look incomplete, listed above the editor. Save anyway?', { count: warnings.length }),
            { title: t('clinical_ui.protocol.dlg.save_anyway_title', 'Save anyway'), confirmLabel: t('clinical_ui.protocol.dlg.save', 'Save') }
        )) return;

        setIsSaving(true);
        try {
            for (const ft of toSave) {
                const data = docs[ft];
                let before = null;
                try { before = baselineRef.current[ft] ? JSON.parse(baselineRef.current[ft]) : null; } catch { before = null; }
                await saveIMNCIProtocol(ft, data);
                baselineRef.current[ft] = JSON.stringify(data);
                await recordHistory(ft, diffProtocol(ft, before, data));
            }
            setIssues(null);
            setEditing(false);
            notify(t('clinical_ui.protocol.toast.saved', 'Protocol saved. It is now live for every clinician.'), 'success');
            await fetchProtocols(true);
        } catch (error) {
            console.error("Save failed:", error);
            notify(`${t('clinical_ui.protocol.toast.save_failed', 'Could not save the protocol.')} ${error?.message || ''}`.trim(), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Who, their role, what changed and when. A failed history write never
    // undoes the save; it is reported so it can be looked into.
    const recordHistory = async (formType, changes, summary = '') => {
        if (!changes.length && !summary) return;
        try {
            await appendIMNCIProtocolHistory({
                ...currentEditor(auth?.currentUser),
                formType,
                summary,
                changes: changes.slice(0, MAX_CHANGES),
                more: Math.max(0, changes.length - MAX_CHANGES),
            });
            if (showHistory) await loadHistory();
        } catch (error) {
            console.error('Protocol history write failed:', error);
            notify(t('clinical_ui.protocol.toast.history_failed', 'Saved, but the change could not be added to the history.'), 'warning');
        }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try { setHistory(await getIMNCIProtocolHistory()); } catch (error) {
            console.error('Protocol history read failed:', error);
            setHistory([]);
        } finally { setHistoryLoading(false); }
    };
    const toggleHistory = async () => {
        const next = !showHistory;
        setShowHistory(next);
        if (next) await loadHistory();
    };

    const startEditing = () => { setIssues(null); setEditing(true); };
    const cancelEditing = async () => {
        if (isDirty && !await confirmDialog(
            t('clinical_ui.protocol.dlg.cancel_msg', 'Discard the changes you made since the last save?'),
            { title: t('clinical_ui.protocol.dlg.discard_title', 'Discard changes'), confirmLabel: t('clinical_ui.protocol.dlg.discard', 'Discard'), danger: true }
        )) return;
        setDocs((prev) => {
            const next = { ...prev };
            dirtyTypes.forEach((ft) => { if (baselineRef.current[ft]) next[ft] = JSON.parse(baselineRef.current[ft]); });
            return next;
        });
        setIssues(null);
        setEditing(false);
    };

    // All four rule and dose documents at once, Doses first. Saving the rules
    // before their Doses tab is what produced one "dose does not exist" error
    // per treatment line.
    const handleLoadNational = async () => {
        if (!await confirmDialog(
            t('clinical_ui.protocol.dlg.national_msg', 'This saves the Sudan national IMNCI protocol for the sick child and the young infant (classification, drugs and recording forms). Every clinician sees it straight away. After this, changes are made with Edit.'),
            { title: t('clinical_ui.protocol.dlg.national_title', 'Load national protocol'), confirmLabel: t('clinical_ui.protocol.dlg.national_confirm', 'Load and save'), danger: true }
        )) return;

        const problems = NATIONAL_SAVE_ORDER.flatMap((formType) => {
            const doses = formType === 'child' ? NATIONAL_PROTOCOLS.dosages_child.drugs
                : formType === 'infant' ? NATIONAL_PROTOCOLS.dosages_infant.drugs : [];
            return validateProtocol(formType, NATIONAL_PROTOCOLS[formType], doses).errors;
        });
        if (problems.length) {
            setIssues({ errors: problems, warnings: [] });
            return;
        }

        setIsSaving(true);
        try {
            for (const formType of NATIONAL_SAVE_ORDER) {
                await saveIMNCIProtocol(formType, clone(NATIONAL_PROTOCOLS[formType]));
            }
            for (const formType of Object.keys(NATIONAL_TEXT)) {
                if (!protocols?.[formType]) await saveIMNCIProtocol(formType, clone(NATIONAL_TEXT[formType]));
            }
            const fresh = {};
            NATIONAL_SAVE_ORDER.forEach((ft) => {
                fresh[ft] = clone(NATIONAL_PROTOCOLS[ft]);
                baselineRef.current[ft] = JSON.stringify(fresh[ft]);
            });
            setDocs((prev) => ({ ...prev, ...fresh }));
            setIssues(null);
            notify(t('clinical_ui.protocol.toast.national_saved', 'The national protocol is saved and is now live for every clinician.'), 'success');
            await recordHistory('national', [], 'Loaded the Sudan national protocol');
            await fetchProtocols(true);
        } catch (error) {
            console.error('National protocol save failed:', error);
            notify(`${t('clinical_ui.protocol.toast.save_failed', 'Could not save the protocol.')} ${error?.message || ''}`.trim(), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ========================================================================
    // TOGGLE HANDLERS (Accordions)
    // ========================================================================
    const toggleCat = (catKey) => setExpandedCats(prev => ({...prev, [catKey]: !prev[catKey]}));
    const toggleRule = (catKey, ruleIndex) => {
        const key = `${catKey}_${ruleIndex}`;
        setExpandedRules(prev => ({...prev, [key]: !prev[key]}));
    };
    const toggleDrug = (drugIndex) => setExpandedDrugs(prev => ({...prev, [drugIndex]: !prev[drugIndex]}));

    // ========================================================================
    // CLINICAL CATEGORY HANDLERS (the part's classification document)
    // ========================================================================
    const setClass = (data) => setDoc(classKey, data);
    const addNewCategory = async () => {
        const catKey = await promptDialog(
            t('clinical_ui.protocol.dlg.add_cat_msg', "Enter a unique short key for this category (e.g. 'fever', 'cough'):"),
            { title: t('clinical_ui.protocol.dlg.add_cat_title', 'Add category') }
        );
        if (!catKey || catKey.trim() === '') return;
        if (classDoc.categories[catKey]) {
            notify(t('clinical_ui.protocol.toast.cat_exists', 'A category with this key already exists.'), 'error');
            return;
        }
        const newData = { ...classDoc, categories: { ...(classDoc.categories || {}) } };
        newData.categories[catKey] = { title: "New Category", rules: [] };
        setClass(newData);
        setExpandedCats(prev => ({...prev, [catKey]: true}));
        // A table of its own gets a tab of its own.
        openTopic(catKey);
    };

    const removeCategory = async (catKey, e) => {
        e.stopPropagation();
        if (await confirmDialog(
            t('clinical_ui.protocol.dlg.del_cat_msg', "Delete the entire '{{key}}' category and all its rules?", { key: catKey }),
            { title: t('clinical_ui.protocol.dlg.del_cat_title', 'Delete category'), confirmLabel: t('clinical_ui.protocol.dlg.delete', 'Delete'), danger: true }
        )) {
            const newData = { ...classDoc };
            delete newData.categories[catKey];
            setClass(newData);
        }
    };

    const handleCategoryChange = (catKey, field, value) => {
        const newData = { ...classDoc };
        newData.categories[catKey][field] = value;
        setClass(newData);
    };

    const handleRuleChange = (catKey, ruleIndex, field, value) => {
        const newData = { ...classDoc };
        newData.categories[catKey].rules[ruleIndex][field] = value;
        setClass(newData);
    };

    const handleClassificationChange = (catKey, ruleIndex, field, value) => {
        const newData = { ...classDoc };
        newData.categories[catKey].rules[ruleIndex].classification[field] = value;
        setClass(newData);
    };

    const toggleCondition = (catKey, ruleIndex, condition) => {
        const newData = { ...classDoc };
        const currentConditions = newData.categories[catKey].rules[ruleIndex].conditions || [];
        if (currentConditions.includes(condition)) {
            newData.categories[catKey].rules[ruleIndex].conditions = currentConditions.filter(c => c !== condition);
        } else {
            newData.categories[catKey].rules[ruleIndex].conditions = [...currentConditions, condition];
        }
        setClass(newData);
    };

    const addTreatment = (catKey, ruleIndex, treatment) => {
        const newData = { ...classDoc };
        const currentTreatments = newData.categories[catKey].rules[ruleIndex].treatments || [];
        // Even if duplicate, allow it just in case they want to modify it differently
        newData.categories[catKey].rules[ruleIndex].treatments = [...currentTreatments, treatment];
        setClass(newData);
    };

    const editTreatment = (catKey, ruleIndex, tIdx, newText) => {
        const newData = { ...classDoc };
        newData.categories[catKey].rules[ruleIndex].treatments[tIdx] = newText;
        setClass(newData);
    };

    const removeTreatment = (catKey, ruleIndex, treatmentIndex) => {
        const newData = { ...classDoc };
        newData.categories[catKey].rules[ruleIndex].treatments.splice(treatmentIndex, 1);
        setClass(newData);
    };

    // "Only when": conditions that must all be true before the rule is looked
    // at, such as "the child has cough" for the cough table.
    const toggleRequire = (catKey, ruleIndex, condition) => {
        const newData = { ...classDoc };
        const target = newData.categories[catKey].rules[ruleIndex];
        const current = target.requires || [];
        target.requires = current.includes(condition) ? current.filter((c) => c !== condition) : [...current, condition];
        if (!target.requires.length) delete target.requires;
        setClass(newData);
    };

    const addNewRule = (catKey, e) => {
        e.stopPropagation();
        const newData = { ...classDoc };
        const newIndex = newData.categories[catKey].rules.length;
        newData.categories[catKey].rules.push({
            id: `rule_${Math.floor(Math.random() * 100000)}`, type: "ANY", conditions: [],
            classification: { label: "New Classification", color: IMNCI_SEVERITIES[3].protocolColor }, treatments: []
        });
        setClass(newData);
        setExpandedRules(prev => ({...prev, [`${catKey}_${newIndex}`]: true}));
    };

    const removeRule = async (catKey, ruleIndex, e) => {
        e.stopPropagation();
        if (await confirmDialog(t('clinical_ui.protocol.dlg.del_rule_msg', 'Delete this rule?'),
            { title: t('clinical_ui.protocol.dlg.del_rule_title', 'Delete rule'), confirmLabel: t('clinical_ui.protocol.dlg.delete', 'Delete'), danger: true })) {
            const newData = { ...classDoc };
            newData.categories[catKey].rules.splice(ruleIndex, 1);
            setClass(newData);
        }
    };

    // ========================================================================
    // DOSAGE CALCULATOR HANDLERS (the part's doses document)
    // ========================================================================
    const setDoses = (data) => setDoc(doseKey, data);
    const addNewDrug = () => {
        const newData = { ...doseDoc };
        newData.drugs = [...(newData.drugs || [])];
        const index = newData.drugs.length;
        // Added on a disease tab, the dose stays on that tab even before a
        // classification line points at it.
        newData.drugs.push({
            id: `drug_${Math.floor(Math.random() * 100000)}`, label: "New Drug Label", rules: [], fallback: "Check chart based on weight/age",
            ...(topic !== GENERAL && topic !== FORM ? { topic } : {}),
        });
        setDoses(newData);
        setExpandedDrugs(prev => ({...prev, [index]: true}));
    };

    const removeDrug = async (drugIndex, e) => {
        e.stopPropagation();
        if (await confirmDialog(
            t('clinical_ui.protocol.dlg.del_drug_msg', 'Delete this drug calculator entirely? Any treatment still referencing it will lose its dose.'),
            { title: t('clinical_ui.protocol.dlg.del_drug_title', 'Delete drug'), confirmLabel: t('clinical_ui.protocol.dlg.delete', 'Delete'), danger: true })) {
            const newData = { ...doseDoc };
            newData.drugs.splice(drugIndex, 1);
            setDoses(newData);
        }
    };

    const handleDrugChange = (drugIndex, field, value) => {
        const newData = { ...doseDoc };
        newData.drugs[drugIndex][field] = value;
        setDoses(newData);
    };

    const addDrugRange = (drugIndex) => {
        const newData = { ...doseDoc };
        newData.drugs[drugIndex].rules = newData.drugs[drugIndex].rules || [];
        newData.drugs[drugIndex].rules.push({ minAge: '', maxAge: '', minWeight: '', maxWeight: '', doseQty: '', doseFreq: '', doseDuration: '' });
        setDoses(newData);
    };

    const removeDrugRange = (drugIndex, rangeIndex) => {
        const newData = { ...doseDoc };
        newData.drugs[drugIndex].rules.splice(rangeIndex, 1);
        setDoses(newData);
    };

    const handleDrugRangeChange = (drugIndex, rangeIndex, field, value) => {
        const newData = { ...doseDoc };
        newData.drugs[drugIndex].rules[rangeIndex][field] = value;
        setDoses(newData);
    };

    if (loadError && !classDoc) {
        return (
            <Card>
                <div className="p-8 flex flex-col items-center text-center gap-3">
                    <p className="font-bold text-slate-800">
                        {loadError === 'offline'
                            ? t('clinical_ui.protocol.load.offline', 'You are offline and the protocol has not been saved on this device yet.')
                            : t('clinical_ui.protocol.load.failed', 'The protocol could not be loaded.')}
                    </p>
                    <p className="text-sm text-slate-500">{t('clinical_ui.protocol.load.hint', 'Check your connection and try again.')}</p>
                    <Button onClick={() => loadProtocols(true)} disabled={isLoading.imnciProtocols}>
                        {isLoading.imnciProtocols ? t('clinical_ui.protocol.load.retrying', 'Trying again...') : t('clinical_ui.protocol.load.retry', 'Try again')}
                    </Button>
                </div>
            </Card>
        );
    }

    if (isLoading.imnciProtocols || !classDoc || !doseDoc || !guideDoc || !docs[formKey]) {
        return <div className="flex justify-center p-12"><Spinner /></div>;
    }

    const currentAvailableConditions = part === 'child' ? CHILD_CONDITIONS : INFANT_CONDITIONS;
    const currentAvailableTreatments = part === 'child' ? CHILD_TREATMENTS : INFANT_TREATMENTS;

    // What belongs on this tab: its classification tables, the doses they
    // point at, and its treatment, counselling and follow-up boxes.
    const topicEntry = topics.find((tp) => tp.id === topic);
    const topicCats = topicEntry?.page?.categories || [];
    const topicDrugIdx = isFormTab ? [] : drugsForTopic(part, topic, classDoc, doseDoc);
    const knownTopics = topics.map((tp) => tp.id);
    const topicGuide = isFormTab ? { treat: [], counsel: [], followup: [] } : guideForTopic(part, topic, guideDoc, knownTopics);
    const guideLang = ar ? 'ar' : 'en';
    const addBoxFor = (kind) => {
        const gi = groupForNewBox(guideDoc, kind, topicGuide[kind]);
        if (gi < 0) return;
        setDoc(guideKey, addGuideBox(guideDoc, gi, topic !== GENERAL ? topic : undefined));
    };

    // Filtering, so a protocol with ten categories and sixty rules is navigable.
    // Matches the category title, the classification label, any condition and
    // any treatment text, because people look for all four.
    const term = search.trim().toLowerCase();
    const ruleMatches = (rule) => !term
        || String(rule.classification?.label || '').toLowerCase().includes(term)
        || (rule.conditions || []).some((c) => String(c).toLowerCase().includes(term))
        || (rule.treatments || []).some((t) => String(t).toLowerCase().includes(term));

    const visibleCategories = topicCats.map((k) => [k, classDoc.categories?.[k]]).filter(([catKey, cat]) => {
        if (!cat) return false;
        if (!term) return true;
        if (String(cat.title || '').toLowerCase().includes(term)) return true;
        if (catKey.toLowerCase().includes(term)) return true;
        return (cat.rules || []).some(ruleMatches);
    });

    const visibleDrugs = topicDrugIdx
        .map((drugIndex) => ({ drug: doseDoc.drugs[drugIndex], drugIndex }))
        .filter(({ drug }) => !term
            || String(drug.label || '').toLowerCase().includes(term)
            || String(drug.id || '').toLowerCase().includes(term));

    const hiddenCount = (topicCats.length - visibleCategories.length) + (topicDrugIdx.length - visibleDrugs.length);

    // The national load is a one-time start: shown only while nothing is saved.
    const nothingSaved = !protocols?.child && !protocols?.infant;
    const dynamicDosageList = doseDoc?.drugs || [];

    // The booklet layout edits through the same handlers as the rule builder.
    const bookletEdit = {
        onRule: handleRuleChange,
        onClass: handleClassificationChange,
        onDrug: handleDrugChange,
        onRange: handleDrugRangeChange,
        addRange: addDrugRange,
        removeRange: removeDrugRange,
    };
    const editing_ = viewMode === 'edit';

    // The numbered parts of a disease tab, in the order they are used. Empty
    // parts are left out unless editing, when they are where a first box is added.
    const steps = [];
    if (topicCats.length) {
        steps.push({ key: 'classify', icon: Activity, title: t('clinical_ui.protocol.steps.classify', 'Classify'),
            body: <BookletProtocolView formType={part} protocol={classDoc} doses={dynamicDosageList} edit={editing_ ? bookletEdit : null} pageIds={[topic]} heading={false} /> });
    }
    if (topicDrugIdx.length || editing_) {
        steps.push({ key: 'drugs', icon: Syringe, title: t('clinical_ui.protocol.steps.drugs', 'Drug doses'),
            body: (
                <div className="space-y-2">
                    {topicDrugIdx.length > 0 && <BookletDoseView protocol={doseDoc} only={topicDrugIdx} edit={editing_ ? bookletEdit : null} />}
                    {editing_ && (
                        <button type="button" onClick={addNewDrug} className="w-full border-2 border-dashed border-slate-300 rounded py-2 text-xs font-bold text-sky-800 hover:bg-sky-50">
                            + {t('clinical_ui.protocol.btn.add_drug', 'Add Drug')}
                        </button>
                    )}
                </div>
            ) });
    }
    [['treat', ListChecks, t('clinical_ui.protocol.steps.treat', 'Treatment')],
        ['counsel', MessageCircle, t('clinical_ui.protocol.steps.counsel', 'Counsel the mother')],
        ['followup', CalendarClock, t('clinical_ui.protocol.steps.followup', 'Follow-up')]].forEach(([kind, icon, title]) => {
        const list = topicGuide[kind];
        if (!list.length && !editing_) return;
        steps.push({ key: kind, icon, title, body: (
            <div className="space-y-2" dir={ar ? 'rtl' : 'ltr'} lang={guideLang}>
                <div className="grid gap-4 xl:grid-cols-2 items-start">
                    {list.map(({ gi, bi }) => (
                        <GuideBlock key={`${gi}-${guideDoc.groups[gi].blocks[bi]?.id || bi}`} guide={guideDoc} gi={gi} bi={bi} lang={guideLang} edit={editing_ ? {} : null} onChange={(next) => setDoc(guideKey, next)} t={t} />
                    ))}
                </div>
                {editing_ && (
                    <button type="button" onClick={() => addBoxFor(kind)} className="w-full border-2 border-dashed border-slate-300 rounded py-2 text-xs font-bold text-sky-800 hover:bg-sky-50">
                        + {t('clinical_ui.protocol.guide.add_box', 'Add box')}
                    </button>
                )}
            </div>
        ) });
    });
    const topicLabel = (tp) => t(`clinical_ui.protocol.topics.${tp.id}`, TOPIC_LABELS[tp.id] || (ar ? classDoc.categories?.[tp.id]?.titleAr : null) || tp.title || tp.id);

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto pb-12 font-sans text-sm" dir="ltr">
            <PageHeader title={t('clinical_ui.protocol.title', 'IMNCI Protocol Builder')} subtitle={t('clinical_ui.protocol.subtitle', 'Manage dynamic rules, conditions, and treatments for the clinical engine')} />
            
            {nothingSaved && (
                <div className="border border-emerald-300 bg-emerald-50 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" dir={ar ? 'rtl' : 'ltr'}>
                    <div>
                        <p className="font-bold text-emerald-900">{t('clinical_ui.protocol.national.empty_title', 'No protocol is saved yet')}</p>
                        <p className="text-xs text-emerald-800">{t('clinical_ui.protocol.national.empty_hint', 'Start from the Sudan national IMNCI protocol. This is done once; after that, changes are made with Edit.')}</p>
                    </div>
                    <Button onClick={handleLoadNational} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shrink-0"><DownloadCloud size={16} className="me-2 inline" /> {t('clinical_ui.protocol.btn.load_national', 'Load Sudan national protocol')}</Button>
                </div>
            )}

            <div className="space-y-2" dir={ar ? 'rtl' : 'ltr'}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-md border border-slate-300 overflow-hidden" role="tablist" aria-label={t('clinical_ui.protocol.parts.label', 'Age group')}>
                        {PARTS.map((p) => {
                            const Icon = p === 'child' ? User : Baby;
                            return (
                                <button key={p} type="button" role="tab" aria-selected={part === p} onClick={() => switchPart(p)}
                                    className={`px-4 py-2 text-sm font-bold flex items-center gap-2 ${part === p ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                                    <Icon size={16} /> {t(`clinical_ui.protocol.parts.${p}`, p === 'child' ? 'Sick child (2 months – 5 years)' : 'Young infant (up to 2 months)')}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {!editing ? (
                            <>
                                <Button onClick={startEditing} className="flex items-center gap-1.5 text-sm"><Pencil size={16} /> {t('clinical_ui.protocol.btn.edit', 'Edit')}</Button>
                                <Button onClick={toggleHistory} variant="secondary" className="flex items-center gap-1.5 text-sm"><History size={16} /> {t('clinical_ui.protocol.btn.history', 'History')}</Button>
                            </>
                        ) : (
                            <>
                                {isDirty && (
                                    <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-1 rounded">
                                        {t('clinical_ui.protocol.unsaved', 'Unsaved changes')}
                                    </span>
                                )}
                                <Button onClick={handleSave} disabled={isSaving || !isDirty} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-sm flex items-center gap-1.5">
                                    {isSaving ? t('clinical_ui.protocol.btn.saving', 'Saving...') : <><Save size={16} /> {t('clinical_ui.protocol.btn.save_changes', 'Save changes')}</>}
                                </Button>
                                <Button onClick={cancelEditing} disabled={isSaving} variant="secondary" className="text-sm">{t('clinical_ui.protocol.btn.cancel', 'Cancel')}</Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300">
                    <div className="flex flex-wrap" role="tablist" aria-label={t('clinical_ui.protocol.topics.label', 'Illness')}>
                        {topics.map((tp) => {
                            const Icon = tp.id === FORM ? ClipboardList : tp.id === GENERAL ? BookOpen : Stethoscope;
                            return (
                                <button key={tp.id} type="button" role="tab" aria-selected={topic === tp.id} onClick={() => openTopic(tp.id)}
                                    className={`px-3 py-2 text-sm font-bold flex items-center gap-1.5 border-b-2 -mb-px ${topic === tp.id ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                                    <Icon size={15} /> {topicLabel(tp)}
                                </button>
                            );
                        })}
                    </div>
                    {editing && !isFormTab && (
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 py-1">
                            <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
                            <Settings2 size={14} /> {t('clinical_ui.protocol.view.advanced_rules', 'Advanced rule builder')}
                        </label>
                    )}
                </div>

                {viewMode === 'advanced' && (
                    <div className="flex flex-wrap gap-2 items-center">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('clinical_ui.protocol.search.rule', 'Find a category, classification, condition or treatment…')}
                            className="w-full sm:w-64 p-2 border border-slate-300 rounded text-sm focus:ring-sky-500"
                        />
                        {<Button onClick={addNewCategory} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"><FolderPlus size={16} className="me-2 inline" /> {t('clinical_ui.protocol.btn.add_category', 'Add Category')}</Button>}
                        {<Button onClick={addNewDrug} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"><Plus size={16} className="me-2 inline" /> {t('clinical_ui.protocol.btn.add_drug', 'Add Drug')}</Button>}
                    </div>
                )}
            </div>

            {showHistory && <div dir={ar ? 'rtl' : 'ltr'}><HistoryPanel entries={history} loading={historyLoading} onClose={() => setShowHistory(false)} t={t} /></div>}

            <Card>
                <div className="p-3 sm:p-4 bg-slate-50 space-y-4">
                    {issues && (issues.errors.length > 0 || issues.warnings.length > 0) && (
                        <div className="space-y-2">
                            {issues.errors.length > 0 && (
                                <div className="border border-red-300 bg-red-50 rounded-md p-3">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <h4 className="font-bold text-red-800 text-sm">
                                            {t('clinical_ui.protocol.issues.errors', '{{count}} problem(s) must be fixed before saving', { count: issues.errors.length })}
                                        </h4>
                                        <button onClick={() => setIssues(null)} className="text-red-400 hover:text-red-700"><X size={16}/></button>
                                    </div>
                                    <ul className="list-disc ms-5 space-y-1 text-xs text-red-900 max-h-52 overflow-y-auto">
                                        {issues.errors.map((e, i) => <li key={i}>{e.message}</li>)}
                                    </ul>
                                </div>
                            )}
                            {issues.warnings.length > 0 && (
                                <div className="border border-amber-300 bg-amber-50 rounded-md p-3">
                                    <h4 className="font-bold text-amber-800 text-sm mb-2">
                                        {t('clinical_ui.protocol.issues.warnings', '{{count}} thing(s) look incomplete', { count: issues.warnings.length })}
                                    </h4>
                                    <ul className="list-disc ms-5 space-y-1 text-xs text-amber-900 max-h-40 overflow-y-auto">
                                        {issues.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {viewMode === 'advanced' && hiddenCount > 0 && (
                        <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded px-3 py-2">
                            {t('clinical_ui.protocol.hidden_items', '{{count}} table(s) or drug(s) hidden by the search.', { count: hiddenCount })}
                            <button onClick={() => setSearch('')} className="ms-2 text-sky-700 font-bold hover:underline">{t('clinical_ui.protocol.btn.clear', 'Clear')}</button>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* BOOKLET VIEW */}
                    {/* ============================================================ */}
                    {viewMode !== 'advanced' && (isFormTab
                        ? <RecordingFormView key={formKey} form={docs[formKey]} edit={editing_ ? {} : null} onChange={(next) => setDoc(formKey, next)} />
                        : (
                            <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
                                {steps.map((st, n) => (
                                    <section key={st.key} className="space-y-2">
                                        <h3 data-step={st.key} className="flex items-center gap-2 text-sm md:text-base font-extrabold text-slate-900 border-b-2 border-slate-800 pb-1">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-white text-xs shrink-0">{n + 1}</span>
                                            <st.icon size={16} className="text-slate-700 shrink-0" /> {st.title}
                                        </h3>
                                        {st.body}
                                    </section>
                                ))}
                                {!steps.length && (
                                    <div className="p-6 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded">{t('clinical_ui.protocol.empty.topic', 'Nothing is saved for this illness yet. Press Edit to add it.')}</div>
                                )}
                            </div>
                        ))}

                    {/* ============================================================ */}
                    {/* DOSAGES TAB UI */}
                    {/* ============================================================ */}
                    {viewMode === 'advanced' && topicDrugIdx.length > 0 && (
                        <div className="space-y-3">
                            {visibleDrugs.map(({ drug, drugIndex }) => {
                                // drugIndex is the index in the doses document, not in the
                                // filtered list — every handler edits by that index, so
                                // filtering must not renumber it.
                                const isExpanded = expandedDrugs[drugIndex] || false;
                                return (
                                <div key={drugIndex} className="border border-slate-300 rounded-md bg-white shadow-sm overflow-hidden">
                                    <div onClick={() => toggleDrug(drugIndex)} className="bg-sky-50 p-2 border-b border-sky-100 flex justify-between items-center gap-4 cursor-pointer hover:bg-sky-100 transition-colors">
                                        <div className="flex items-center gap-2 flex-1">
                                            {isExpanded ? <ChevronDown size={18} className="text-sky-600"/> : <ChevronRight size={18} className="text-sky-600"/>}
                                            <div className="font-bold text-sky-900 w-1/2">{drug.label || t('clinical_ui.protocol.unnamed_drug', 'Unnamed Drug')}</div>
                                            <div className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1"><Lock size={10} className="text-slate-400"/> ID: {drug.id}</div>
                                        </div>
                                        <button onClick={(e) => removeDrug(drugIndex, e)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="p-3 space-y-4">
                                            <div className="flex gap-4">
                                                <div className="w-1/2">
                                                    <label className="text-xs font-bold text-sky-700 uppercase block mb-1">{t('clinical_ui.protocol.drug.display_label', 'Display Label')}</label>
                                                    <input type="text" value={drug.label} onChange={(e) => handleDrugChange(drugIndex, 'label', e.target.value)} className="w-full font-bold text-slate-800 p-1.5 border border-sky-200 rounded focus:ring-sky-500 text-sm" placeholder={t('clinical_ui.protocol.drug.label_ph', 'e.g. Amoxicillin (Oral)')}/>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('clinical_ui.protocol.drug.fallback', 'Fallback Text (If Out of Range)')}</label>
                                                    <input type="text" value={drug.fallback} onChange={(e) => handleDrugChange(drugIndex, 'fallback', e.target.value)} className="w-full p-1.5 border border-slate-300 rounded focus:ring-sky-500 text-sm" placeholder={t('clinical_ui.protocol.drug.fallback_ph', 'e.g. Check manual chart')}/>
                                                </div>
                                            </div>
                                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                                <input type="checkbox" checked={!!drug.ageAndWeight} onChange={(e) => handleDrugChange(drugIndex, 'ageAndWeight', e.target.checked)} className="rounded text-sky-600 w-4 h-4" />
                                                {t('clinical_ui.protocol.drug.age_and_weight', 'Age and weight must both match (for doses that change with age at the same weight, such as young-infant gentamicin)')}
                                            </label>

                                            <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                                                <div className="bg-slate-200 p-1.5 grid grid-cols-12 gap-1 text-xs font-bold text-slate-700 uppercase text-center border-b border-slate-300">
                                                    <div className="col-span-1">{t('clinical_ui.protocol.drug.min_mo', 'Min Mo')}</div>
                                                    <div className="col-span-1">{t('clinical_ui.protocol.drug.max_mo', 'Max Mo')}</div>
                                                    <div className="col-span-1">{t('clinical_ui.protocol.drug.min_kg', 'Min Kg')}</div>
                                                    <div className="col-span-1">{t('clinical_ui.protocol.drug.max_kg', 'Max Kg')}</div>
                                                    <div className="col-span-4">{t('clinical_ui.protocol.drug.dose_qty', 'Dose Quantity')}</div>
                                                    <div className="col-span-2">{t('clinical_ui.protocol.drug.freq', 'Frequency/Day')}</div>
                                                    <div className="col-span-1">{t('clinical_ui.protocol.drug.duration', 'Duration')}</div>
                                                    <div className="col-span-1"></div>
                                                </div>
                                                {(drug.rules || []).map((range, rangeIndex) => (
                                                    <div key={rangeIndex} className="p-1.5 grid grid-cols-12 gap-1 items-center border-b border-slate-200 last:border-0 hover:bg-white transition-colors">
                                                        <div className="col-span-1"><input type="number" inputMode="decimal" step="0.01" placeholder="-" value={range.minAge} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'minAge', e.target.value)} className="w-full text-center p-1 border border-slate-300 rounded text-xs"/></div>
                                                        <div className="col-span-1"><input type="number" inputMode="decimal" step="0.01" placeholder="-" value={range.maxAge} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'maxAge', e.target.value)} className="w-full text-center p-1 border border-slate-300 rounded text-xs"/></div>
                                                        <div className="col-span-1"><input type="number" inputMode="decimal" step="0.01" placeholder="-" value={range.minWeight} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'minWeight', e.target.value)} className="w-full text-center p-1 border border-slate-300 rounded text-xs"/></div>
                                                        <div className="col-span-1"><input type="number" inputMode="decimal" step="0.01" placeholder="-" value={range.maxWeight} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'maxWeight', e.target.value)} className="w-full text-center p-1 border border-slate-300 rounded text-xs"/></div>
                                                        
                                                        <div className="col-span-4"><input type="text" placeholder={t('clinical_ui.protocol.drug.qty_ph', 'e.g. 5ml OR 1 tab')} value={range.doseQty} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'doseQty', e.target.value)} className="w-full font-semibold text-sky-800 p-1 border border-slate-300 rounded text-xs" dir="auto"/></div>
                                                        <div className="col-span-2"><input type="text" placeholder={t('clinical_ui.protocol.drug.freq_ph', 'e.g. twice daily')} value={range.doseFreq} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'doseFreq', e.target.value)} className="w-full font-semibold text-indigo-700 p-1 border border-slate-300 rounded text-xs" dir="auto"/></div>
                                                        <div className="col-span-1"><input type="text" placeholder={t('clinical_ui.protocol.drug.duration_ph', 'e.g. 5 days')} value={range.doseDuration} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'doseDuration', e.target.value)} className="w-full font-semibold text-emerald-700 p-1 border border-slate-300 rounded text-xs" dir="auto"/></div>
                                                        
                                                        <div className="col-span-1 flex justify-center"><button onClick={() => removeDrugRange(drugIndex, rangeIndex)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button></div>
                                                    </div>
                                                ))}
                                                <div className="p-1.5 bg-slate-100 border-t border-slate-200">
                                                    <Button size="sm" variant="secondary" onClick={() => addDrugRange(drugIndex)} className="w-full py-1 h-auto text-xs bg-white"><Plus size={14} className="me-1 inline"/> {t('clinical_ui.protocol.btn.add_range', 'Add Dose Range')}</Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )})}
                            {visibleDrugs.length === 0 && <div className="text-center p-8 bg-white border-2 border-dashed border-slate-300 rounded-lg text-slate-500">{t('clinical_ui.protocol.empty.no_drug_match', 'No drugs match this search.')}</div>}
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* CHILD & INFANT TAB UI */}
                    {/* ============================================================ */}
                    {viewMode === 'advanced' && (topic !== GENERAL || !topicDrugIdx.length) && (
                        topicCats.length === 0 ? (
                            <div className="text-center p-8 bg-white border-2 border-dashed border-slate-300 rounded-lg">
                                <p className="text-slate-500 mb-4">{t('clinical_ui.protocol.empty.no_cats', 'No categories found in this protocol.')}</p>
                                <Button onClick={addNewCategory} variant="primary">{t('clinical_ui.protocol.btn.add_cat_manual', 'Add Category Manually')}</Button>
                            </div>
                        ) : (
                            visibleCategories.map(([catKey, category]) => {
                                const isCatExpanded = expandedCats[catKey] ?? true;
                                return (
                                <div key={catKey} className="border border-slate-300 rounded-lg bg-white shadow-sm overflow-hidden mb-3">
                                    <div onClick={() => toggleCat(catKey)} className="bg-slate-200 p-2.5 border-b border-slate-300 flex justify-between items-center cursor-pointer hover:bg-slate-300 transition-colors">
                                        <div className="flex items-center gap-2 flex-1">
                                            {isCatExpanded ? <ChevronDown size={18} className="text-slate-600"/> : <ChevronRight size={18} className="text-slate-600"/>}
                                            <input 
                                                type="text" 
                                                value={category.title} 
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => handleCategoryChange(catKey, 'title', e.target.value)}
                                                className="w-1/2 font-bold text-slate-800 p-1 border border-slate-300 rounded bg-white text-sm"
                                                dir="auto" 
                                            />
                                            <span className="text-xs text-slate-500 font-mono hidden md:inline">({catKey})</span>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <Button size="sm" variant="secondary" onClick={(e) => addNewRule(catKey, e)} className="py-1 px-2 h-auto text-xs"><Plus size={14} className="me-1 inline" /> {t('clinical_ui.protocol.btn.add_rule', 'Add Rule')}</Button>
                                            <button onClick={(e) => removeCategory(catKey, e)} className="p-1 text-slate-500 hover:text-red-600 hover:bg-white rounded transition-colors" title={t('clinical_ui.protocol.dlg.del_cat_title2', 'Delete Category')}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    
                                    {isCatExpanded && (
                                    <div className="p-3 bg-slate-50 space-y-3">
                                        {category.rules.map((rule, ruleIndex) => {
                                            const isRuleExpanded = expandedRules[`${catKey}_${ruleIndex}`] ?? true;
                                            
                                            return (
                                            <div key={ruleIndex} className="border border-slate-200 rounded-md bg-white shadow-sm overflow-hidden">
                                                <div onClick={() => toggleRule(catKey, ruleIndex)} className={`p-2 flex justify-between items-center cursor-pointer transition-colors border-b border-slate-100 ${isRuleExpanded ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}>
                                                    <div className="flex items-center gap-2 flex-1">
                                                        {isRuleExpanded ? <ChevronDown size={16} className="text-indigo-500"/> : <ChevronRight size={16} className="text-slate-400"/>}
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-3 h-3 rounded-full ${rule.classification.color.replace('bg-', 'bg-').replace('500', '400')}`}></div>
                                                            <span className="font-bold text-sm text-slate-700">{rule.classification.label || t('clinical_ui.protocol.unnamed_rule', 'Unnamed Rule')}</span>
                                                        </div>
                                                    </div>
                                                    <button onClick={(e) => removeRule(catKey, ruleIndex, e)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                                                </div>

                                                {isRuleExpanded && (
                                                <div className="p-3 grid grid-cols-1 lg:grid-cols-12 gap-4">
                                                    {/* LEFT COLUMN: Metadata */}
                                                    <div className="lg:col-span-3 space-y-3">
                                                        <div className="flex gap-2">
                                                            <div className="flex-1">
                                                                <label className="text-xs font-bold text-slate-500 uppercase">{t('clinical_ui.protocol.rule.logic', 'Logic')}</label>
                                                                <select value={rule.type} onChange={(e) => handleRuleChange(catKey, ruleIndex, 'type', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded font-bold bg-slate-50">
                                                                    <option value="ANY">ANY (OR)</option>
                                                                    <option value="ALL">ALL (AND)</option>
                                                                    <option value="COUNT_GTE">COUNT_GTE</option>
                                                                </select>
                                                            </div>
                                                            {rule.type === 'COUNT_GTE' && (
                                                                <div className="w-1/3">
                                                                    <label className="text-xs font-bold text-slate-500 uppercase">{t('clinical_ui.protocol.rule.need', 'Need')}</label>
                                                                    <input type="number" inputMode="decimal" value={rule.threshold || 2} onChange={(e) => handleRuleChange(catKey, ruleIndex, 'threshold', parseInt(e.target.value, 10))} className="w-full text-xs p-1.5 border border-slate-300 rounded text-center" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Globe size={10} className="text-sky-500"/> {t('clinical_ui.protocol.rule.label', 'Label')}</label>
                                                            <input type="text" value={rule.classification.label} onChange={(e) => handleClassificationChange(catKey, ruleIndex, 'label', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded font-bold" dir="auto" />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 uppercase">{t('clinical_ui.protocol.rule.color', 'Color')}</label>
                                                            <select value={rule.classification.color} onChange={(e) => handleClassificationChange(catKey, ruleIndex, 'color', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded">
                                                                {IMNCI_SEVERITIES.map((sev) => (
                                                                    <option key={sev.id} value={sev.protocolColor}>{sev.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 uppercase">{t('clinical_ui.protocol.rule.signs', 'Signs as printed in the booklet')}</label>
                                                            <textarea
                                                                rows={3}
                                                                value={(rule.signs || []).join('\n')}
                                                                onChange={(e) => handleRuleChange(catKey, ruleIndex, 'signs', e.target.value.split('\n'))}
                                                                placeholder={t('clinical_ui.protocol.rule.signs_hint', 'One line each. Shown in the booklet view only.')}
                                                                className="w-full text-xs p-1.5 border border-slate-300 rounded"
                                                                dir="auto"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 uppercase">{t('clinical_ui.protocol.rule.id', 'Rule ID')}</label>
                                                            <div className="text-xs font-mono text-slate-400 bg-slate-100 p-1.5 rounded border border-slate-200 flex items-center gap-1 cursor-not-allowed">
                                                                <Lock size={10} /> {rule.id}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* CENTER COLUMN: Conditions */}
                                                    <div className="lg:col-span-4 bg-slate-50 p-3 rounded border border-slate-200 flex flex-col">
                                                        <label className="text-xs font-bold text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">{t('clinical_ui.protocol.rule.requires', 'Only when (all must be true)')}</label>
                                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                                            {(rule.requires || []).map(cond => (
                                                                <span key={cond} className="px-2 py-1 text-xs font-mono rounded border bg-slate-700 text-white border-slate-800 flex items-center gap-1">
                                                                    {cond}
                                                                    <button onClick={() => toggleRequire(catKey, ruleIndex, cond)} className="hover:text-red-200 ms-1"><X size={10}/></button>
                                                                </span>
                                                            ))}
                                                            <select
                                                                className="text-xs p-1 border border-slate-300 rounded focus:ring-sky-500"
                                                                onChange={(e) => { if (e.target.value) { toggleRequire(catKey, ruleIndex, e.target.value); e.target.value = ''; } }}
                                                            >
                                                                <option value="">{t('clinical_ui.protocol.rule.add_require', '+ Only when')}</option>
                                                                {currentAvailableConditions.filter(c => !(rule.requires || []).includes(c)).map(c => (
                                                                    <option key={c} value={c}>{c}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <label className="text-xs font-bold text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">{t('clinical_ui.protocol.rule.conditions', 'Conditions')}</label>
                                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                                            {(rule.conditions || []).map(cond => (
                                                                <span key={cond} className="px-2 py-1 text-xs font-mono rounded border bg-sky-600 text-white border-sky-700 shadow-inner flex items-center gap-1">
                                                                    {cond}
                                                                    <button onClick={() => toggleCondition(catKey, ruleIndex, cond)} className="hover:text-red-200 ms-1"><X size={10}/></button>
                                                                </span>
                                                            ))}
                                                            {(!rule.conditions || rule.conditions.length === 0) && <span className="text-xs text-slate-400 italic">{t('clinical_ui.protocol.empty.no_conditions', 'No conditions added.')}</span>}
                                                        </div>
                                                        <select
                                                            className="text-xs p-1.5 border border-slate-300 rounded focus:ring-sky-500 w-full mt-auto"
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    toggleCondition(catKey, ruleIndex, e.target.value);
                                                                    e.target.value = '';
                                                                }
                                                            }}
                                                        >
                                                            <option value="">{t('clinical_ui.protocol.rule.add_condition', '+ Add Condition')}</option>
                                                            {currentAvailableConditions.filter(c => !(rule.conditions || []).includes(c)).map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* RIGHT COLUMN: Fully Editable Treatments */}
                                                    <div className="lg:col-span-5 bg-emerald-50/50 p-3 rounded border border-emerald-100 flex flex-col">
                                                        <label className="text-xs font-bold text-emerald-800 uppercase mb-2 border-b border-emerald-200 pb-1 flex items-center gap-1">
                                                            <Globe size={10}/> {t('clinical_ui.protocol.rule.treatments', 'Treatments (Editable)')}
                                                        </label>
                                                        
                                                        <div className="flex flex-col gap-1.5 mb-3">
                                                            {(rule.treatments || []).map((t, tIdx) => (
                                                                <div key={tIdx} className="flex items-start gap-1">
                                                                    <textarea 
                                                                        value={t}
                                                                        onChange={(e) => editTreatment(catKey, ruleIndex, tIdx, e.target.value)}
                                                                        className="w-full bg-emerald-600 border border-emerald-700 rounded p-1.5 text-white text-xs font-semibold shadow-inner focus:ring-2 focus:ring-emerald-400 focus:outline-none leading-tight"
                                                                        rows={2}
                                                                        dir="auto"
                                                                    />
                                                                    <button 
                                                                        onClick={() => removeTreatment(catKey, ruleIndex, tIdx)} 
                                                                        className="text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded p-1.5 shadow-sm transition-colors"
                                                                    >
                                                                        <Trash2 size={14}/>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {(!rule.treatments || rule.treatments.length === 0) && <span className="text-xs text-slate-400 italic">{t('clinical_ui.protocol.empty.no_treatments', 'No treatments added.')}</span>}
                                                        </div>

                                                        <div className="mt-auto space-y-2">
                                                            <select
                                                                className="text-xs p-1.5 border border-emerald-300 rounded text-emerald-800 font-bold w-full bg-white"
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        addTreatment(catKey, ruleIndex, e.target.value);
                                                                        e.target.value = '';
                                                                    }
                                                                }}
                                                            >
                                                                <option value="">{t('clinical_ui.protocol.rule.add_std_treatment', '+ Add Standard Treatment')}</option>
                                                                {currentAvailableTreatments.map(t => (
                                                                    <option key={t} value={t}>{t}</option>
                                                                ))}
                                                            </select>
                                                            
                                                            <CustomTreatmentAdder onAdd={(val) => addTreatment(catKey, ruleIndex, val)} dosages={dynamicDosageList} />
                                                        </div>
                                                    </div>
                                                </div>
                                                )}
                                            </div>
                                            )})}
                                        {category.rules.length === 0 && <div className="text-center p-4 text-slate-400 text-xs italic">{t('clinical_ui.protocol.empty.no_rules', 'No rules defined.')}</div>}
                                    </div>
                                    )}
                                </div>
                            )})
                        )
                    )}
                </div>
            </Card>
        </div>
    );
}
