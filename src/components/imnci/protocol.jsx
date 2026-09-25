import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, PageHeader, Button, Spinner } from '../CommonComponents';
import { useDataCache } from '../../DataContext';
import { saveIMNCIProtocol } from '../../data';
import { notify, confirmDialog, promptDialog } from '../dialogs';
// The same four severities the online course books colour their classification
// tables with, and that the patient form compares against by value. Defined
// once in constants.js so the protocol, the books and the exercises cannot
// drift into three different spellings of "yellow".
import { IMNCI_SEVERITIES } from '../constants';
import { Save, Plus, Trash2, DownloadCloud, FolderPlus, Globe, Syringe, Activity, ChevronDown, ChevronRight, Lock, X } from 'lucide-react';

// --- Predefined Conditions Mapping for Dropdowns ---
const CHILD_CONDITIONS = [
    'notAbleToDrink', 'lethargicUnconscious', 'vomitsEverything', 'convulsingNow', 'historyOfConvulsions',
    'hasCough', 'fastBreathing', 'chestIndrawing', 'stridor', 'wheeze',
    'hasDiarrhea', 'diarrhea14Days', 'bloodInStool', 'lethargic', 'restlessIrritable', 'sunkenEyes', 'drinkPoorly', 'drinkEagerly', 'pinchVerySlow', 'pinchSlow',
    'hasFever', 'dailyFever7Days', 'measles3Months', 'neckStiffness', 'measlesRash', 'malariaTestPositive', 'mouthUlcers', 'deepExtensiveUlcers', 'pusFromEye', 'corneaClouding',
    'hasEarProblem', 'earPain', 'earDischargeAcute', 'earDischargeChronic', 'tenderSwelling', 'pusFromEar',
    'severePalmarPallor', 'somePalmarPallor', 'noPalmarPallor',
    'edema', 'samWithComplications', 'samWithoutComplications', 'moderateAcuteMalnutrition', 'noMalnutrition',
    'hasOtherProblems', 'hasDangerSign', 'hasDehydration'
];

const INFANT_CONDITIONS = [
    'notFeedingWell', 'convulsions', 'convulsingNow', 'movementOnlyStimulated', 'movementOnlyStimulatedNoMovement', 'fastBreathing60', 'severeChestIndrawing', 'fever37_5', 'fever38', 'lowTemp35_5',
    'umbilicusRedDraining', 'pusFromEyes', 'skinPustules',
    'hasJaundice', 'jaundiceFirst24h', 'jaundiceLowWeight', 'jaundiceSolesPalms', 'jaundiceAfter24h',
    'hasDiarrhea', 'bloodInStool', 'diarrheaMovement', 'diarrheaRestless', 'diarrheaSunkenEyes', 'pinchVerySlow', 'pinchSlow',
    'diffFeeding', 'feedsLessThan8Times', 'receivesOtherFoods', 'lowWeightForAge', 'thrush', 'notWellAttached', 'notSucklingEffectively', 'feedingWellNormalWeight',
    'noBacterialSigns', 'hasOtherProblems'
];

// --- Predefined Treatments Mapping for Dropdowns ---
const CHILD_TREATMENTS = [
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

const INFANT_TREATMENTS = [
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
                    if (!knownDoseIds.has(id)) {
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
    const [val, setVal] = useState('');
    return (
        <div className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-emerald-200">
            <label className="text-[9px] font-bold text-emerald-800 uppercase">Add Custom Treatment (If not in list)</label>
            <div className="flex flex-col xl:flex-row gap-1.5 items-stretch xl:items-center">
                <select 
                    className="text-[10px] p-1.5 border border-emerald-300 rounded w-full xl:w-28 bg-emerald-50 text-emerald-800 font-bold" 
                    onChange={(e) => { setVal(v => v + (v ? ' ' : '') + `{{dose:${e.target.value}}}`); e.target.value = ''; }}
                >
                    <option value="">+ Dose Tag</option>
                    {dosages.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
                <input 
                    type="text" 
                    value={val} 
                    onChange={e => setVal(e.target.value)} 
                    placeholder="Type custom text..." 
                    className="flex-1 text-xs p-1.5 border border-slate-300 rounded focus:ring-sky-500" 
                    dir="auto"
                />
                <button 
                    onClick={() => { if(val.trim()) { onAdd(val.trim()); setVal(''); } }} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shrink-0"
                >
                    Add
                </button>
            </div>
        </div>
    );
};

export default function ProtocolEditor() {
    const { protocols, fetchProtocols, isLoading } = useDataCache();
    const [activeTab, setActiveTab] = useState('child'); 
    const [editorData, setEditorData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [issues, setIssues] = useState(null);

    // A snapshot of what was loaded, so "has this been edited" is a fact rather
    // than a flag someone has to remember to set in every handler.
    const baselineRef = useRef('');
    const isDirty = !!editorData && JSON.stringify(editorData) !== baselineRef.current;

    // The doses a treatment may legitimately reference. Deliberately the SAVED
    // dosages, not anything unsaved in the other tab: the clinical engine reads
    // what is in the database, so that is what a dose tag has to resolve against.
    const dosageListForValidation = useMemo(() => {
        const target = activeTab === 'child' ? 'dosages_child'
            : activeTab === 'infant' ? 'dosages_infant' : null;
        return target ? (protocols?.[target]?.drugs || []) : [];
    }, [protocols, activeTab]);

    // Accordion States for Compact Layout
    const [expandedCats, setExpandedCats] = useState({});
    const [expandedRules, setExpandedRules] = useState({});
    const [expandedDrugs, setExpandedDrugs] = useState({});

    // Loads the protocol for the active tab.
    //
    // The guard is the point. This effect depends on `protocols`, so ANY refresh
    // of the cache used to overwrite the editor — an hour of rule authoring
    // replaced by the server copy, with no warning and no undo. It now refuses
    // to overwrite unsaved work; the tab switch below is the one place that
    // discards edits, and it asks first.
    useEffect(() => {
        if (isDirty) return;

        if (protocols && protocols[activeTab]) {
            const fresh = JSON.parse(JSON.stringify(protocols[activeTab]));
            baselineRef.current = JSON.stringify(fresh);
            setEditorData(fresh);
        } else if (!isLoading.imnciProtocols) {
            const defaultStructure = activeTab.startsWith('dosages')
                ? { formType: activeTab, version: "1.0", drugs: [] }
                : { formType: activeTab, version: "1.0", categories: {} };
            baselineRef.current = JSON.stringify(defaultStructure);
            setEditorData(defaultStructure);
        }
        // isDirty is read, not depended on: adding it would re-run the effect
        // the moment the edits were discarded and reload mid-keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [protocols, activeTab, isLoading.imnciProtocols]);

    // Closing the tab is the other way an hour of work disappears.
    useEffect(() => {
        if (!isDirty) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [isDirty]);

    const switchTab = async (next) => {
        if (next === activeTab) return;
        if (isDirty && !await confirmDialog(
            'You have unsaved changes to this protocol. Switching tabs will discard them. Continue?',
            { title: 'Discard changes', confirmLabel: 'Discard', danger: true }
        )) return;
        baselineRef.current = '';   // force a reload for the tab being opened
        setEditorData(null);
        setIssues(null);
        setActiveTab(next);
    };

    const handleSave = async () => {
        if (!editorData) return;

        // Checked before the write, not after. A protocol with a dangling dose
        // tag saves perfectly happily and only fails at the bedside.
        const { errors, warnings } = validateProtocol(activeTab, editorData, dosageListForValidation);
        setIssues({ errors, warnings });

        if (errors.length > 0) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (warnings.length > 0 && !await confirmDialog(
            `${warnings.length} thing(s) look incomplete, listed above the editor. Save anyway?`,
            { title: 'Save anyway', confirmLabel: 'Save' }
        )) return;

        setIsSaving(true);
        try {
            await saveIMNCIProtocol(activeTab, editorData);
            baselineRef.current = JSON.stringify(editorData);
            setIssues(null);
            notify('Protocol saved. It is now live for every clinician.', 'success');
            await fetchProtocols(true);
        } catch (error) {
            console.error("Save failed:", error);
            notify(`Could not save the protocol. ${error?.message || ''}`.trim(), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadDefaults = async () => {
        if (await confirmDialog(
            `This loads the standard English IMNCI protocol for [${activeTab}] into the editor. Any unsaved changes will be lost, and nothing is written to the database until you save.`,
            { title: 'Load defaults', confirmLabel: 'Load', danger: true }
        )) {
            setIssues(null);
            if (activeTab === 'child') setEditorData(DEFAULT_CHILD_PROTOCOL);
            else if (activeTab === 'infant') setEditorData(DEFAULT_INFANT_PROTOCOL);
            else if (activeTab === 'dosages_child') setEditorData(DEFAULT_CHILD_DOSAGES_PROTOCOL);
            else if (activeTab === 'dosages_infant') setEditorData(DEFAULT_INFANT_DOSAGES_PROTOCOL);
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
    // CLINICAL CATEGORY HANDLERS
    // ========================================================================
    const addNewCategory = async () => {
        const catKey = await promptDialog(
            "Enter a unique short key for this category (e.g. 'fever', 'cough'):",
            { title: 'Add category' }
        );
        if (!catKey || catKey.trim() === '') return;
        if (editorData.categories[catKey]) {
            notify('A category with this key already exists.', 'error');
            return;
        }
        const newData = { ...editorData };
        newData.categories[catKey] = { title: "New Category", rules: [] };
        setEditorData(newData);
        setExpandedCats(prev => ({...prev, [catKey]: true}));
    };

    const removeCategory = async (catKey, e) => {
        e.stopPropagation();
        if (await confirmDialog(
            `Delete the entire '${catKey}' category and all its rules?`,
            { title: 'Delete category', confirmLabel: 'Delete', danger: true }
        )) {
            const newData = { ...editorData };
            delete newData.categories[catKey];
            setEditorData(newData);
        }
    };

    const handleCategoryChange = (catKey, field, value) => {
        const newData = { ...editorData };
        newData.categories[catKey][field] = value;
        setEditorData(newData);
    };

    const handleRuleChange = (catKey, ruleIndex, field, value) => {
        const newData = { ...editorData };
        newData.categories[catKey].rules[ruleIndex][field] = value;
        setEditorData(newData);
    };

    const handleClassificationChange = (catKey, ruleIndex, field, value) => {
        const newData = { ...editorData };
        newData.categories[catKey].rules[ruleIndex].classification[field] = value;
        setEditorData(newData);
    };

    const toggleCondition = (catKey, ruleIndex, condition) => {
        const newData = { ...editorData };
        const currentConditions = newData.categories[catKey].rules[ruleIndex].conditions || [];
        if (currentConditions.includes(condition)) {
            newData.categories[catKey].rules[ruleIndex].conditions = currentConditions.filter(c => c !== condition);
        } else {
            newData.categories[catKey].rules[ruleIndex].conditions = [...currentConditions, condition];
        }
        setEditorData(newData);
    };

    const addTreatment = (catKey, ruleIndex, treatment) => {
        const newData = { ...editorData };
        const currentTreatments = newData.categories[catKey].rules[ruleIndex].treatments || [];
        // Even if duplicate, allow it just in case they want to modify it differently
        newData.categories[catKey].rules[ruleIndex].treatments = [...currentTreatments, treatment];
        setEditorData(newData);
    };

    const editTreatment = (catKey, ruleIndex, tIdx, newText) => {
        const newData = { ...editorData };
        newData.categories[catKey].rules[ruleIndex].treatments[tIdx] = newText;
        setEditorData(newData);
    };

    const removeTreatment = (catKey, ruleIndex, treatmentIndex) => {
        const newData = { ...editorData };
        newData.categories[catKey].rules[ruleIndex].treatments.splice(treatmentIndex, 1);
        setEditorData(newData);
    };

    const addNewRule = (catKey, e) => {
        e.stopPropagation();
        const newData = { ...editorData };
        const newIndex = newData.categories[catKey].rules.length;
        newData.categories[catKey].rules.push({
            id: `rule_${Math.floor(Math.random() * 100000)}`, type: "ANY", conditions: [],
            classification: { label: "New Classification", color: IMNCI_SEVERITIES[3].protocolColor }, treatments: []
        });
        setEditorData(newData);
        setExpandedRules(prev => ({...prev, [`${catKey}_${newIndex}`]: true}));
    };

    const removeRule = async (catKey, ruleIndex, e) => {
        e.stopPropagation();
        if (await confirmDialog('Delete this rule?',
            { title: 'Delete rule', confirmLabel: 'Delete', danger: true })) {
            const newData = { ...editorData };
            newData.categories[catKey].rules.splice(ruleIndex, 1);
            setEditorData(newData);
        }
    };

    // ========================================================================
    // DOSAGE CALCULATOR HANDLERS
    // ========================================================================
    const addNewDrug = () => {
        const newData = { ...editorData };
        newData.drugs = newData.drugs || [];
        newData.drugs.unshift({
            id: `drug_${Math.floor(Math.random() * 100000)}`, label: "New Drug Label", rules: [], fallback: "Check chart based on weight/age"
        });
        setEditorData(newData);
        setExpandedDrugs(prev => ({...prev, 0: true}));
    };

    const removeDrug = async (drugIndex, e) => {
        e.stopPropagation();
        if (await confirmDialog(
            'Delete this drug calculator entirely? Any treatment still referencing it will lose its dose.',
            { title: 'Delete drug', confirmLabel: 'Delete', danger: true })) {
            const newData = { ...editorData };
            newData.drugs.splice(drugIndex, 1);
            setEditorData(newData);
        }
    };

    const handleDrugChange = (drugIndex, field, value) => {
        const newData = { ...editorData };
        newData.drugs[drugIndex][field] = value;
        setEditorData(newData);
    };

    const addDrugRange = (drugIndex) => {
        const newData = { ...editorData };
        newData.drugs[drugIndex].rules = newData.drugs[drugIndex].rules || [];
        newData.drugs[drugIndex].rules.push({ minAge: '', maxAge: '', minWeight: '', maxWeight: '', doseQty: '', doseFreq: '', doseDuration: '' });
        setEditorData(newData);
    };

    const removeDrugRange = (drugIndex, rangeIndex) => {
        const newData = { ...editorData };
        newData.drugs[drugIndex].rules.splice(rangeIndex, 1);
        setEditorData(newData);
    };

    const handleDrugRangeChange = (drugIndex, rangeIndex, field, value) => {
        const newData = { ...editorData };
        newData.drugs[drugIndex].rules[rangeIndex][field] = value;
        setEditorData(newData);
    };

    if (isLoading.imnciProtocols || !editorData) {
        return <div className="flex justify-center p-12"><Spinner /></div>;
    }

    const currentAvailableConditions = activeTab === 'child' ? CHILD_CONDITIONS : INFANT_CONDITIONS;
    const currentAvailableTreatments = activeTab === 'child' ? CHILD_TREATMENTS : INFANT_TREATMENTS;
    
    const isDosagesTab = activeTab.startsWith('dosages');

    // Filtering, so a protocol with ten categories and sixty rules is navigable.
    // Matches the category title, the classification label, any condition and
    // any treatment text, because people look for all four.
    const term = search.trim().toLowerCase();
    const ruleMatches = (rule) => !term
        || String(rule.classification?.label || '').toLowerCase().includes(term)
        || (rule.conditions || []).some((c) => String(c).toLowerCase().includes(term))
        || (rule.treatments || []).some((t) => String(t).toLowerCase().includes(term));

    const visibleCategories = Object.entries(editorData.categories || {}).filter(([catKey, cat]) => {
        if (!term) return true;
        if (String(cat.title || '').toLowerCase().includes(term)) return true;
        if (catKey.toLowerCase().includes(term)) return true;
        return (cat.rules || []).some(ruleMatches);
    });

    const visibleDrugs = (editorData.drugs || [])
        .map((drug, drugIndex) => ({ drug, drugIndex }))
        .filter(({ drug }) => !term
            || String(drug.label || '').toLowerCase().includes(term)
            || String(drug.id || '').toLowerCase().includes(term));

    const hiddenCount = isDosagesTab
        ? (editorData.drugs || []).length - visibleDrugs.length
        : Object.keys(editorData.categories || {}).length - visibleCategories.length;

    const targetDosageTab = activeTab === 'child' ? 'dosages_child' : 'dosages_infant';
    const dynamicDosageList = protocols?.[targetDosageTab]?.drugs || []; 

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto pb-12 font-sans text-sm" dir="ltr">
            <PageHeader title="IMNCI Protocol Builder" subtitle="Manage dynamic rules, conditions, and treatments for the clinical engine" />
            
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-2">
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => switchTab('child')} variant={activeTab === 'child' ? 'primary' : 'secondary'} className="rounded-r-none border-r-0 text-sm px-4">Child (2m - 5y)</Button>
                    <Button onClick={() => switchTab('infant')} variant={activeTab === 'infant' ? 'primary' : 'secondary'} className="rounded-none border-r-0 text-sm px-4">Infant (&lt; 2m)</Button>
                    <Button onClick={() => switchTab('dosages_child')} variant={activeTab === 'dosages_child' ? 'primary' : 'secondary'} className="rounded-none border-r-0 text-sm px-4 flex items-center gap-2"><Syringe size={16}/> Child Doses</Button>
                    <Button onClick={() => switchTab('dosages_infant')} variant={activeTab === 'dosages_infant' ? 'primary' : 'secondary'} className="rounded-l-none text-sm px-4 flex items-center gap-2"><Syringe size={16}/> Infant Doses</Button>
                </div>
                <div className="flex gap-2 shrink-0 items-center">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={isDosagesTab ? 'Find a drug…' : 'Find a category, classification, condition or treatment…'}
                        className="w-64 p-2 border border-slate-300 rounded text-sm focus:ring-sky-500"
                    />
                    <Button onClick={handleLoadDefaults} className="bg-amber-500 hover:bg-amber-600 text-white border-0"><DownloadCloud size={16} className="mr-2 inline" /> Load Defaults</Button>
                    {!isDosagesTab && (
                        <Button onClick={addNewCategory} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"><FolderPlus size={16} className="mr-2 inline" /> Add Category</Button>
                    )}
                    {isDosagesTab && (
                        <Button onClick={addNewDrug} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"><Plus size={16} className="mr-2 inline" /> Add Drug</Button>
                    )}
                </div>
            </div>

            <Card>
                <div className="p-4 bg-slate-50 space-y-4">
                    <div className={`flex justify-between items-center text-white p-3 rounded-md shadow-sm ${isDosagesTab ? 'bg-sky-800' : 'bg-slate-800'}`}>
                        <div>
                            <h2 className="text-lg font-bold uppercase tracking-wide flex items-center gap-2">
                                {isDosagesTab ? <Syringe size={18}/> : <Activity size={18}/>}
                                Editing: {activeTab.replace('_', ' ')} protocol
                            </h2>
                            <p className="text-sm text-sky-200">Engine Version: {editorData.version}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {isDirty && (
                                <span className="text-xs font-bold text-amber-300 bg-amber-900/40 border border-amber-500/50 px-2 py-1 rounded">
                                    Unsaved changes
                                </span>
                            )}
                            <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 py-1.5 px-4 h-auto text-sm">
                                {isSaving ? "Saving..." : <><Save size={16} className="mr-1 inline" /> Save Database</>}
                            </Button>
                        </div>
                    </div>

                    {issues && (issues.errors.length > 0 || issues.warnings.length > 0) && (
                        <div className="space-y-2">
                            {issues.errors.length > 0 && (
                                <div className="border border-red-300 bg-red-50 rounded-md p-3">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <h4 className="font-bold text-red-800 text-sm">
                                            {issues.errors.length} problem(s) must be fixed before saving
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
                                        {issues.warnings.length} thing(s) look incomplete
                                    </h4>
                                    <ul className="list-disc ms-5 space-y-1 text-xs text-amber-900 max-h-40 overflow-y-auto">
                                        {issues.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {hiddenCount > 0 && (
                        <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded px-3 py-2">
                            {hiddenCount} {isDosagesTab ? 'drug(s)' : 'category(ies)'} hidden by the search.
                            <button onClick={() => setSearch('')} className="ms-2 text-sky-700 font-bold hover:underline">Clear</button>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* DOSAGES TAB UI */}
                    {/* ============================================================ */}
                    {isDosagesTab && (
                        <div className="space-y-3">
                            {visibleDrugs.map(({ drug, drugIndex }) => {
                                // drugIndex is the index in editorData.drugs, not in the
                                // filtered list — every handler edits by that index, so
                                // filtering must not renumber it.
                                const isExpanded = expandedDrugs[drugIndex] || false;
                                return (
                                <div key={drugIndex} className="border border-slate-300 rounded-md bg-white shadow-sm overflow-hidden">
                                    <div onClick={() => toggleDrug(drugIndex)} className="bg-sky-50 p-2 border-b border-sky-100 flex justify-between items-center gap-4 cursor-pointer hover:bg-sky-100 transition-colors">
                                        <div className="flex items-center gap-2 flex-1">
                                            {isExpanded ? <ChevronDown size={18} className="text-sky-600"/> : <ChevronRight size={18} className="text-sky-600"/>}
                                            <div className="font-bold text-sky-900 w-1/2">{drug.label || "Unnamed Drug"}</div>
                                            <div className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1"><Lock size={10} className="text-slate-400"/> ID: {drug.id}</div>
                                        </div>
                                        <button onClick={(e) => removeDrug(drugIndex, e)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="p-3 space-y-4">
                                            <div className="flex gap-4">
                                                <div className="w-1/2">
                                                    <label className="text-[10px] font-bold text-sky-700 uppercase block mb-1">Display Label</label>
                                                    <input type="text" value={drug.label} onChange={(e) => handleDrugChange(drugIndex, 'label', e.target.value)} className="w-full font-bold text-slate-800 p-1.5 border border-sky-200 rounded focus:ring-sky-500 text-sm" placeholder="e.g. Amoxicillin (Oral)"/>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fallback Text (If Out of Range)</label>
                                                    <input type="text" value={drug.fallback} onChange={(e) => handleDrugChange(drugIndex, 'fallback', e.target.value)} className="w-full p-1.5 border border-slate-300 rounded focus:ring-sky-500 text-sm" placeholder="e.g. Check manual chart"/>
                                                </div>
                                            </div>

                                            <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                                                <div className="bg-slate-200 p-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-slate-700 uppercase text-center border-b border-slate-300">
                                                    <div className="col-span-1">Min Mo</div>
                                                    <div className="col-span-1">Max Mo</div>
                                                    <div className="col-span-1">Min Kg</div>
                                                    <div className="col-span-1">Max Kg</div>
                                                    <div className="col-span-4">Dose Quantity</div>
                                                    <div className="col-span-2">Frequency/Day</div>
                                                    <div className="col-span-1">Duration</div>
                                                    <div className="col-span-1"></div>
                                                </div>
                                                {(drug.rules || []).map((range, rangeIndex) => (
                                                    <div key={rangeIndex} className="p-1.5 grid grid-cols-12 gap-1 items-center border-b border-slate-200 last:border-0 hover:bg-white transition-colors">
                                                        <div className="col-span-1"><input type="number" step="0.01" placeholder="-" value={range.minAge} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'minAge', e.target.value)} className="w-full text-center p-1 border border-slate-300 rounded text-xs"/></div>
                                                        <div className="col-span-1"><input type="number" step="0.01" placeholder="-" value={range.maxAge} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'maxAge', e.target.value)} className="w-full text-center p-1 border border-slate-300 rounded text-xs"/></div>
                                                        <div className="col-span-1"><input type="number" step="0.01" placeholder="-" value={range.minWeight} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'minWeight', e.target.value)} className="w-full text-center p-1 border border-slate-300 rounded text-xs"/></div>
                                                        <div className="col-span-1"><input type="number" step="0.01" placeholder="-" value={range.maxWeight} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'maxWeight', e.target.value)} className="w-full text-center p-1 border border-slate-300 rounded text-xs"/></div>
                                                        
                                                        <div className="col-span-4"><input type="text" placeholder="e.g. 5ml OR 1 tab" value={range.doseQty} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'doseQty', e.target.value)} className="w-full font-semibold text-sky-800 p-1 border border-slate-300 rounded text-xs" dir="auto"/></div>
                                                        <div className="col-span-2"><input type="text" placeholder="e.g. twice daily" value={range.doseFreq} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'doseFreq', e.target.value)} className="w-full font-semibold text-indigo-700 p-1 border border-slate-300 rounded text-xs" dir="auto"/></div>
                                                        <div className="col-span-1"><input type="text" placeholder="e.g. 5 days" value={range.doseDuration} onChange={(e) => handleDrugRangeChange(drugIndex, rangeIndex, 'doseDuration', e.target.value)} className="w-full font-semibold text-emerald-700 p-1 border border-slate-300 rounded text-xs" dir="auto"/></div>
                                                        
                                                        <div className="col-span-1 flex justify-center"><button onClick={() => removeDrugRange(drugIndex, rangeIndex)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button></div>
                                                    </div>
                                                ))}
                                                <div className="p-1.5 bg-slate-100 border-t border-slate-200">
                                                    <Button size="sm" variant="secondary" onClick={() => addDrugRange(drugIndex)} className="w-full py-1 h-auto text-xs bg-white"><Plus size={14} className="mr-1 inline"/> Add Dose Range</Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )})}
                            {(editorData.drugs || []).length === 0 && <div className="text-center p-8 bg-white border-2 border-dashed border-slate-300 rounded-lg text-slate-500">No drug calculators added yet.</div>}
                            {(editorData.drugs || []).length > 0 && visibleDrugs.length === 0 && <div className="text-center p-8 bg-white border-2 border-dashed border-slate-300 rounded-lg text-slate-500">No drugs match this search.</div>}
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* CHILD & INFANT TAB UI */}
                    {/* ============================================================ */}
                    {!isDosagesTab && (
                        Object.keys(editorData.categories || {}).length === 0 ? (
                            <div className="text-center p-8 bg-white border-2 border-dashed border-slate-300 rounded-lg">
                                <p className="text-slate-500 mb-4">No categories found in this protocol.</p>
                                <Button onClick={addNewCategory} variant="primary">Add Category Manually</Button>
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
                                            <Button size="sm" variant="secondary" onClick={(e) => addNewRule(catKey, e)} className="py-1 px-2 h-auto text-xs"><Plus size={14} className="mr-1 inline" /> Add Rule</Button>
                                            <button onClick={(e) => removeCategory(catKey, e)} className="p-1 text-slate-500 hover:text-red-600 hover:bg-white rounded transition-colors" title="Delete Category"><Trash2 size={16} /></button>
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
                                                            <span className="font-bold text-sm text-slate-700">{rule.classification.label || "Unnamed Rule"}</span>
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
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Logic</label>
                                                                <select value={rule.type} onChange={(e) => handleRuleChange(catKey, ruleIndex, 'type', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded font-bold bg-slate-50">
                                                                    <option value="ANY">ANY (OR)</option>
                                                                    <option value="ALL">ALL (AND)</option>
                                                                    <option value="COUNT_GTE">COUNT_GTE</option>
                                                                </select>
                                                            </div>
                                                            {rule.type === 'COUNT_GTE' && (
                                                                <div className="w-1/3">
                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Need</label>
                                                                    <input type="number" value={rule.threshold || 2} onChange={(e) => handleRuleChange(catKey, ruleIndex, 'threshold', parseInt(e.target.value, 10))} className="w-full text-xs p-1.5 border border-slate-300 rounded text-center" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Globe size={10} className="text-sky-500"/> Label</label>
                                                            <input type="text" value={rule.classification.label} onChange={(e) => handleClassificationChange(catKey, ruleIndex, 'label', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded font-bold" dir="auto" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Color</label>
                                                            <select value={rule.classification.color} onChange={(e) => handleClassificationChange(catKey, ruleIndex, 'color', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded">
                                                                {IMNCI_SEVERITIES.map((sev) => (
                                                                    <option key={sev.id} value={sev.protocolColor}>{sev.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Rule ID</label>
                                                            <div className="text-[10px] font-mono text-slate-400 bg-slate-100 p-1.5 rounded border border-slate-200 flex items-center gap-1 cursor-not-allowed">
                                                                <Lock size={10} /> {rule.id}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* CENTER COLUMN: Conditions */}
                                                    <div className="lg:col-span-4 bg-slate-50 p-3 rounded border border-slate-200 flex flex-col">
                                                        <label className="text-[10px] font-bold text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">Conditions</label>
                                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                                            {(rule.conditions || []).map(cond => (
                                                                <span key={cond} className="px-2 py-1 text-[10px] font-mono rounded border bg-sky-600 text-white border-sky-700 shadow-inner flex items-center gap-1">
                                                                    {cond}
                                                                    <button onClick={() => toggleCondition(catKey, ruleIndex, cond)} className="hover:text-red-200 ml-1"><X size={10}/></button>
                                                                </span>
                                                            ))}
                                                            {(!rule.conditions || rule.conditions.length === 0) && <span className="text-xs text-slate-400 italic">No conditions added.</span>}
                                                        </div>
                                                        <select
                                                            className="text-[10px] p-1.5 border border-slate-300 rounded focus:ring-sky-500 w-full mt-auto"
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    toggleCondition(catKey, ruleIndex, e.target.value);
                                                                    e.target.value = '';
                                                                }
                                                            }}
                                                        >
                                                            <option value="">+ Add Condition</option>
                                                            {currentAvailableConditions.filter(c => !(rule.conditions || []).includes(c)).map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* RIGHT COLUMN: Fully Editable Treatments */}
                                                    <div className="lg:col-span-5 bg-emerald-50/50 p-3 rounded border border-emerald-100 flex flex-col">
                                                        <label className="text-[10px] font-bold text-emerald-800 uppercase mb-2 border-b border-emerald-200 pb-1 flex items-center gap-1">
                                                            <Globe size={10}/> Treatments (Editable)
                                                        </label>
                                                        
                                                        <div className="flex flex-col gap-1.5 mb-3">
                                                            {(rule.treatments || []).map((t, tIdx) => (
                                                                <div key={tIdx} className="flex items-start gap-1">
                                                                    <textarea 
                                                                        value={t}
                                                                        onChange={(e) => editTreatment(catKey, ruleIndex, tIdx, e.target.value)}
                                                                        className="w-full bg-emerald-600 border border-emerald-700 rounded p-1.5 text-white text-[11px] font-semibold shadow-inner focus:ring-2 focus:ring-emerald-400 focus:outline-none leading-tight"
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
                                                            {(!rule.treatments || rule.treatments.length === 0) && <span className="text-xs text-slate-400 italic">No treatments added.</span>}
                                                        </div>

                                                        <div className="mt-auto space-y-2">
                                                            <select
                                                                className="text-[10px] p-1.5 border border-emerald-300 rounded text-emerald-800 font-bold w-full bg-white"
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        addTreatment(catKey, ruleIndex, e.target.value);
                                                                        e.target.value = '';
                                                                    }
                                                                }}
                                                            >
                                                                <option value="">+ Add Standard Treatment</option>
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
                                        {category.rules.length === 0 && <div className="text-center p-4 text-slate-400 text-xs italic">No rules defined.</div>}
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

// ============================================================================
// DEFAULT JSON TEMPLATES (Matched perfectly to Sudanese Tables & split 3 cols)
// ============================================================================

const DEFAULT_CHILD_DOSAGES_PROTOCOL = {
  formType: "dosages_child",
  version: "1.0",
  drugs: [
    {
      id: "amoxicillin",
      label: "Amoxicillin (Oral)",
      fallback: "Check chart",
      rules: [
        { minAge: 2, maxAge: 11.9, minWeight: 4, maxWeight: 9.9, doseQty: "5 ml OR 1/4 tab (250mg)", doseFreq: "Twice daily", doseDuration: "For 5 days" },
        { minAge: 12, maxAge: 35.9, minWeight: 10, maxWeight: 13.9, doseQty: "10 ml OR 2 tabs", doseFreq: "Twice daily", doseDuration: "For 5 days" },
        { minAge: 36, maxAge: 60, minWeight: 14, maxWeight: 19, doseQty: "15 ml OR 3 tabs", doseFreq: "Twice daily", doseDuration: "For 5 days" }
      ]
    },
    {
      id: "ampicillin",
      label: "Ampicillin (IM)",
      fallback: "Check manual chart",
      rules: [
        { minAge: 2, maxAge: 3.9, minWeight: 4, maxWeight: 5.9, doseQty: "1.0 ml (50mg/kg)", doseFreq: "Every 6 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 4, maxAge: 11.9, minWeight: 6, maxWeight: 9.9, doseQty: "2.0 ml", doseFreq: "Every 6 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 12, maxAge: 35.9, minWeight: 10, maxWeight: 13.9, doseQty: "3.0 ml", doseFreq: "Every 6 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 36, maxAge: 60, minWeight: 14, maxWeight: 19, doseQty: "5.0 ml", doseFreq: "Every 6 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" }
      ]
    },
    {
      id: "gentamycin",
      label: "Gentamycin (IM)",
      fallback: "Check manual chart",
      rules: [
        { minAge: 2, maxAge: 3.9, minWeight: 4, maxWeight: 5.9, doseQty: "0.75 - 1.0 ml", doseFreq: "Once daily (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 4, maxAge: 11.9, minWeight: 6, maxWeight: 9.9, doseQty: "1.1 - 1.8 ml", doseFreq: "Once daily (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 12, maxAge: 35.9, minWeight: 10, maxWeight: 13.9, doseQty: "1.9 - 2.7 ml", doseFreq: "Once daily (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 36, maxAge: 60, minWeight: 14, maxWeight: 19, doseQty: "2.8 - 3.5 ml", doseFreq: "Once daily (if delayed)", doseDuration: "First dose (or 5 days if delayed)" }
      ]
    },
    {
      id: "ciprofloxacin",
      label: "Ciprofloxacin (Oral)",
      fallback: "Check chart",
      rules: [
        { minAge: 2, maxAge: 3.9, minWeight: 4, maxWeight: 5.9, doseQty: "1/4 tab (250mg)", doseFreq: "Twice daily", doseDuration: "For 3 days" },
        { minAge: 4, maxAge: 11.9, minWeight: 6, maxWeight: 9.9, doseQty: "1/2 tab", doseFreq: "Twice daily", doseDuration: "For 3 days" },
        { minAge: 12, maxAge: 60, minWeight: 10, maxWeight: 19, doseQty: "1 tab", doseFreq: "Twice daily", doseDuration: "For 3 days" }
      ]
    },
    {
      id: "zinc",
      label: "Zinc (Oral)",
      fallback: "Check chart",
      rules: [
        { minAge: 2, maxAge: 5.9, minWeight: 0, maxWeight: 99, doseQty: "1/2 tab (20mg) OR 5 ml syrup", doseFreq: "Once daily", doseDuration: "For 14 days" },
        { minAge: 6, maxAge: 60, minWeight: 0, maxWeight: 99, doseQty: "1 tab (20mg) OR 10 ml syrup", doseFreq: "Once daily", doseDuration: "For 14 days" }
      ]
    },
    {
      id: "coartem",
      label: "Artemether + Lumefantrine (Coartem)",
      fallback: "Seek consultant advice if < 5kg",
      rules: [
        { minAge: 0, maxAge: 60, minWeight: 5, maxWeight: 14, doseQty: "1 tab", doseFreq: "Initially, then at 8h, then bid", doseDuration: "For 3 days total" },
        { minAge: 0, maxAge: 60, minWeight: 14.1, maxWeight: 24, doseQty: "2 tabs", doseFreq: "Initially, then at 8h, then bid", doseDuration: "For 3 days total" }
      ]
    },
    {
      id: "paracetamol",
      label: "Paracetamol",
      fallback: "Check chart",
      rules: [
        { minAge: 2, maxAge: 35.9, minWeight: 4, maxWeight: 13.9, doseQty: "1/4 tab (500mg) OR 5 ml syrup", doseFreq: "Every 6 hours", doseDuration: "Until fever/pain subsides" },
        { minAge: 36, maxAge: 60, minWeight: 14, maxWeight: 19, doseQty: "1/2 tab (500mg) OR 10 ml syrup", doseFreq: "Every 6 hours", doseDuration: "Until fever/pain subsides" }
      ]
    },
    {
      id: "iron",
      label: "Iron",
      fallback: "Check chart",
      rules: [
        { minAge: 2, maxAge: 3.9, minWeight: 4, maxWeight: 5.9, doseQty: "2 ml Polymaltose OR 1 ml Fumarate", doseFreq: "Once daily", doseDuration: "For 14 days" },
        { minAge: 4, maxAge: 11.9, minWeight: 6, maxWeight: 9.9, doseQty: "3.5 ml Polymaltose OR 1.75 ml Fumarate", doseFreq: "Once daily", doseDuration: "For 14 days" },
        { minAge: 12, maxAge: 35.9, minWeight: 10, maxWeight: 13.9, doseQty: "1/2 tab OR 5 ml Polymaltose OR 2.5 ml Fumarate", doseFreq: "Once daily", doseDuration: "For 14 days" },
        { minAge: 36, maxAge: 60, minWeight: 14, maxWeight: 19, doseQty: "1/2 tab OR 6.5 ml Polymaltose OR 3.25 ml Fumarate", doseFreq: "Once daily", doseDuration: "For 14 days" }
      ]
    },
    {
      id: "mebendazole",
      label: "Mebendazole",
      fallback: "Check chart",
      rules: [
        { minAge: 12, maxAge: 60, minWeight: 10, maxWeight: 19, doseQty: "5 ml (100mg)", doseFreq: "Twice daily", doseDuration: "For 3 days (Repeat in 2 weeks)" }
      ]
    },
    {
      id: "salbutamol_oral",
      label: "Salbutamol (Oral)",
      fallback: "Check chart",
      rules: [
        { minAge: 2, maxAge: 11.9, minWeight: 0, maxWeight: 9.9, doseQty: "Syrup 2 1/2 ml OR Tablet 1/4", doseFreq: "3 times daily", doseDuration: "For 5 days" },
        { minAge: 12, maxAge: 60, minWeight: 10, maxWeight: 19, doseQty: "Syrup 5 ml OR Tablet 1/2", doseFreq: "3 times daily", doseDuration: "For 5 days" }
      ]
    },
    {
      id: "vitamin_a",
      label: "Vitamin A",
      fallback: "Check chart",
      rules: [
        { minAge: 0, maxAge: 5.9, minWeight: 0, maxWeight: 99, doseQty: "50,000 IU", doseFreq: "Once", doseDuration: "Single dose" },
        { minAge: 6, maxAge: 11.9, minWeight: 0, maxWeight: 99, doseQty: "100,000 IU", doseFreq: "Once", doseDuration: "Single dose" },
        { minAge: 12, maxAge: 60, minWeight: 0, maxWeight: 99, doseQty: "200,000 IU", doseFreq: "Once", doseDuration: "Single dose" }
      ]
    },
    {
      id: "plan_a_ors",
      label: "Plan A ORS",
      fallback: "Check chart",
      rules: [
        { minAge: 0, maxAge: 23.9, minWeight: 0, maxWeight: 99, doseQty: "50 to 100 ml", doseFreq: "After each loose stool", doseDuration: "Until diarrhea stops" },
        { minAge: 24, maxAge: 60, minWeight: 0, maxWeight: 99, doseQty: "100 to 200 ml", doseFreq: "After each loose stool", doseDuration: "Until diarrhea stops" }
      ]
    },
    {
      id: "plan_b_ors",
      label: "Plan B ORS",
      fallback: "Weight × 75 ml",
      rules: [
        { minAge: 0, maxAge: 3.9, minWeight: 0, maxWeight: 5.9, doseQty: "200 - 400 ml", doseFreq: "Continuous sipping", doseDuration: "Over first 4 hours" },
        { minAge: 4, maxAge: 11.9, minWeight: 6, maxWeight: 9.9, doseQty: "400 - 700 ml", doseFreq: "Continuous sipping", doseDuration: "Over first 4 hours" },
        { minAge: 12, maxAge: 23.9, minWeight: 10, maxWeight: 11.9, doseQty: "700 - 900 ml", doseFreq: "Continuous sipping", doseDuration: "Over first 4 hours" },
        { minAge: 24, maxAge: 60, minWeight: 12, maxWeight: 19, doseQty: "900 - 1400 ml", doseFreq: "Continuous sipping", doseDuration: "Over first 4 hours" }
      ]
    },
    {
      id: "plan_c_iv",
      label: "Plan C IV Fluids (Ringer's Lactate)",
      fallback: "100ml/kg",
      rules: [
        { minAge: 0, maxAge: 11.9, minWeight: 0, maxWeight: 99, doseQty: "30ml/kg then 70ml/kg", doseFreq: "IV Drip", doseDuration: "1 hr then 5 hrs (Total 6 hrs)" },
        { minAge: 12, maxAge: 60, minWeight: 0, maxWeight: 99, doseQty: "30ml/kg then 70ml/kg", doseFreq: "IV Drip", doseDuration: "30 mins then 2.5 hrs (Total 3 hrs)" }
      ]
    },
    {
      id: "erythromycin",
      label: "Erythromycin (Cholera)",
      fallback: "Check manual chart",
      rules: [
        { minAge: 24, maxAge: 60, minWeight: 10, maxWeight: 19, doseQty: "1 tab (250mg)", doseFreq: "4 times daily", doseDuration: "For 3 days" }
      ]
    },
    {
      id: "rutf",
      label: "RUTF / Plumpy Nut",
      fallback: "Check chart",
      rules: [
        { minAge: 6, maxAge: 60, minWeight: 4, maxWeight: 4.9, doseQty: "2 sachets", doseFreq: "Daily", doseDuration: "Until follow-up (14/week)" },
        { minAge: 6, maxAge: 60, minWeight: 5, maxWeight: 6.9, doseQty: "2 1/2 sachets", doseFreq: "Daily", doseDuration: "Until follow-up (18/week)" },
        { minAge: 6, maxAge: 60, minWeight: 7, maxWeight: 8.4, doseQty: "3 sachets", doseFreq: "Daily", doseDuration: "Until follow-up (21/week)" },
        { minAge: 6, maxAge: 60, minWeight: 8.5, maxWeight: 9.4, doseQty: "3 1/2 sachets", doseFreq: "Daily", doseDuration: "Until follow-up (25/week)" },
        { minAge: 6, maxAge: 60, minWeight: 9.5, maxWeight: 10.4, doseQty: "4 sachets", doseFreq: "Daily", doseDuration: "Until follow-up (28/week)" },
        { minAge: 6, maxAge: 60, minWeight: 10.5, maxWeight: 11.9, doseQty: "4 1/2 sachets", doseFreq: "Daily", doseDuration: "Until follow-up (32/week)" },
        { minAge: 6, maxAge: 60, minWeight: 12, maxWeight: 99, doseQty: "5 sachets", doseFreq: "Daily", doseDuration: "Until follow-up (35/week)" }
      ]
    },
    {
      id: "quinine",
      label: "Quinine (IM)",
      fallback: "Check manual chart",
      rules: [
        { minAge: 0, maxAge: 60, minWeight: 4, maxWeight: 5.9, doseQty: "1.0 ml", doseFreq: "Every 8 hours (if delayed)", doseDuration: "First dose (or up to 7 days if delayed)" },
        { minAge: 0, maxAge: 60, minWeight: 6, maxWeight: 9.9, doseQty: "1.5 ml", doseFreq: "Every 8 hours (if delayed)", doseDuration: "First dose (or up to 7 days if delayed)" },
        { minAge: 0, maxAge: 60, minWeight: 10, maxWeight: 11.9, doseQty: "2.0 ml", doseFreq: "Every 8 hours (if delayed)", doseDuration: "First dose (or up to 7 days if delayed)" },
        { minAge: 0, maxAge: 60, minWeight: 12, maxWeight: 13.9, doseQty: "2.5 ml", doseFreq: "Every 8 hours (if delayed)", doseDuration: "First dose (or up to 7 days if delayed)" },
        { minAge: 0, maxAge: 60, minWeight: 14, maxWeight: 19, doseQty: "3.0 ml", doseFreq: "Every 8 hours (if delayed)", doseDuration: "First dose (or up to 7 days if delayed)" }
      ]
    },
    {
      id: "diazepam",
      label: "Diazepam (Rectal)",
      fallback: "Check manual chart",
      rules: [
        { minAge: 2, maxAge: 5.9, minWeight: 5, maxWeight: 6.9, doseQty: "0.5 ml", doseFreq: "Once (repeat in 10m if needed)", doseDuration: "Stat" },
        { minAge: 6, maxAge: 11.9, minWeight: 7, maxWeight: 9.9, doseQty: "1.0 ml", doseFreq: "Once (repeat in 10m if needed)", doseDuration: "Stat" },
        { minAge: 12, maxAge: 35.9, minWeight: 10, maxWeight: 13.9, doseQty: "1.5 ml", doseFreq: "Once (repeat in 10m if needed)", doseDuration: "Stat" },
        { minAge: 36, maxAge: 60, minWeight: 14, maxWeight: 19, doseQty: "2.0 ml", doseFreq: "Once (repeat in 10m if needed)", doseDuration: "Stat" }
      ]
    }
  ]
};

const DEFAULT_INFANT_DOSAGES_PROTOCOL = {
  formType: "dosages_infant",
  version: "1.0",
  drugs: [
    {
      id: "amoxicillin_infant",
      label: "Amoxicillin (Oral)",
      fallback: "Check chart",
      rules: [
        { minAge: 0, maxAge: 1, minWeight: 0, maxWeight: 3.9, doseQty: "2.5 ml syrup OR 1/4 tab (250mg)", doseFreq: "Twice daily", doseDuration: "For 5 days" },
        { minAge: 1, maxAge: 2, minWeight: 4, maxWeight: 5.9, doseQty: "5.0 ml syrup OR 1/2 tab", doseFreq: "Twice daily", doseDuration: "For 5 days" }
      ]
    },
    {
      id: "ampicillin_im_infant",
      label: "Ampicillin (IM)",
      fallback: "Check chart",
      rules: [
        { minAge: 0, maxAge: 2, minWeight: 0.5, maxWeight: 1.4, doseQty: "0.5 ml (250mg/2.5ml)", doseFreq: "Every 6 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0, maxAge: 2, minWeight: 1.5, maxWeight: 2.4, doseQty: "1.0 ml", doseFreq: "Every 6 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0, maxAge: 2, minWeight: 2.5, maxWeight: 3.4, doseQty: "1.5 ml", doseFreq: "Every 6 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0, maxAge: 2, minWeight: 3.5, maxWeight: 4.4, doseQty: "2.0 ml", doseFreq: "Every 6 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0, maxAge: 2, minWeight: 4.5, maxWeight: 5.9, doseQty: "2.5 ml", doseFreq: "Every 6 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" }
      ]
    },
    {
      id: "gentamicin_im_infant_lt7",
      label: "Gentamicin (IM) < 7 Days Old",
      fallback: "Check chart",
      rules: [
        { minAge: 0, maxAge: 0.23, minWeight: 0.5, maxWeight: 1.4, doseQty: "0.5 ml (10mg/ml)", doseFreq: "Every 12 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0, maxAge: 0.23, minWeight: 1.5, maxWeight: 2.4, doseQty: "1.0 ml", doseFreq: "Every 12 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0, maxAge: 0.23, minWeight: 2.5, maxWeight: 3.4, doseQty: "1.5 ml", doseFreq: "Every 12 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0, maxAge: 0.23, minWeight: 3.5, maxWeight: 4.4, doseQty: "2.0 ml", doseFreq: "Every 12 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0, maxAge: 0.23, minWeight: 4.5, maxWeight: 5.9, doseQty: "2.5 ml", doseFreq: "Every 12 hours (if delayed)", doseDuration: "First dose (or 5 days if delayed)" }
      ]
    },
    {
      id: "gentamicin_im_infant_gte7",
      label: "Gentamicin (IM) >= 7 Days Old",
      fallback: "Check chart",
      rules: [
        { minAge: 0.24, maxAge: 2, minWeight: 0.5, maxWeight: 1.4, doseQty: "0.8 ml (10mg/ml)", doseFreq: "Once daily (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0.24, maxAge: 2, minWeight: 1.5, maxWeight: 2.4, doseQty: "1.5 ml", doseFreq: "Once daily (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0.24, maxAge: 2, minWeight: 2.5, maxWeight: 3.4, doseQty: "2.25 ml", doseFreq: "Once daily (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0.24, maxAge: 2, minWeight: 3.5, maxWeight: 4.4, doseQty: "3.0 ml", doseFreq: "Once daily (if delayed)", doseDuration: "First dose (or 5 days if delayed)" },
        { minAge: 0.24, maxAge: 2, minWeight: 4.5, maxWeight: 5.9, doseQty: "3.75 ml", doseFreq: "Once daily (if delayed)", doseDuration: "First dose (or 5 days if delayed)" }
      ]
    }
  ]
};

const DEFAULT_CHILD_PROTOCOL = {
  "formType": "child",
  "version": "1.0",
  "categories": {
    "danger": {
      "title": "Danger Signs",
      "rules": [
        {
          "id": "danger_signs",
          "type": "ANY",
          "conditions": ["notAbleToDrink", "vomitsEverything", "historyOfConvulsions", "lethargicUnconscious", "convulsingNow", "hasDangerSign"],
          "classification": { "label": "Very Severe Disease", "color": "bg-red-500" },
          "treatments": [
            "Give first dose of IM Ampicillin: {{dose:ampicillin}}",
            "Give first dose of IM Gentamycin: {{dose:gentamycin}}",
            "Give Diazepam rectally if convulsing now: {{dose:diazepam}}",
            "Prevent low blood sugar",
            "Refer URGENTLY to hospital"
          ]
        }
      ]
    },
    "cough": {
      "title": "Cough & Breathing",
      "rules": [
        {
          "id": "severe_pneumonia",
          "type": "ANY",
          "conditions": ["hasDangerSign", "chestIndrawing", "stridor"],
          "classification": { "label": "Severe Pneumonia or Very Severe Disease", "color": "bg-red-500" },
          "treatments": [
            "Give first dose of IM Ampicillin: {{dose:ampicillin}}",
            "Give first dose of IM Gentamycin: {{dose:gentamycin}}",
            "Treat wheezing if present: {{dose:salbutamol_oral}}",
            "Prevent low blood sugar",
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "pneumonia",
          "type": "ALL",
          "conditions": ["fastBreathing"],
          "classification": { "label": "Pneumonia", "color": "bg-yellow-400" },
          "treatments": [
            "Give oral Amoxicillin for 5 days: {{dose:amoxicillin}}",
            "If wheezing, give inhaled bronchodilator: {{dose:salbutamol_oral}}",
            "Soothe the throat and relieve the cough",
            "Advise mother when to return immediately",
            "Follow-up in 3 days"
          ]
        },
        {
          "id": "cough_cold",
          "type": "ANY",
          "conditions": ["hasCough"],
          "classification": { "label": "Cough or Cold", "color": "bg-green-500" },
          "treatments": [
            "Soothe the throat and relieve the cough",
            "If cough for more than 14 days, refer to hospital",
            "Advise mother when to return immediately",
            "Follow-up in 5 days if not improving"
          ]
        }
      ]
    },
    "diarrhea": {
      "title": "Diarrhea",
      "rules": [
        {
          "id": "severe_dehydration",
          "type": "COUNT_GTE",
          "threshold": 2,
          "conditions": ["lethargicUnconscious", "sunkenEyes", "notAbleToDrink", "drinkPoorly", "pinchVerySlow"],
          "classification": { "label": "Severe Dehydration", "color": "bg-red-500" },
          "treatments": [
            "Give fluid for severe dehydration (Plan C): {{dose:plan_c_iv}}",
            "Give Zinc supplement: {{dose:zinc}}",
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "some_dehydration",
          "type": "COUNT_GTE",
          "threshold": 2,
          "conditions": ["restlessIrritable", "sunkenEyes", "drinkEagerly", "pinchSlow"],
          "classification": { "label": "Some Dehydration", "color": "bg-yellow-400" },
          "treatments": [
            "Give fluid and food for some dehydration (Plan B): {{dose:plan_b_ors}}",
            "Give Zinc supplement: {{dose:zinc}}",
            "Advise mother when to return immediately",
            "Follow-up in 5 days if not improving"
          ]
        },
        {
          "id": "no_dehydration",
          "type": "ANY",
          "conditions": ["hasDiarrhea"],
          "classification": { "label": "No Dehydration", "color": "bg-green-500" },
          "treatments": [
            "Give fluid and food to treat diarrhea at home (Plan A): {{dose:plan_a_ors}}",
            "Give Zinc supplement: {{dose:zinc}}",
            "Advise mother when to return immediately"
          ]
        },
        {
          "id": "severe_persistent_diarrhea",
          "type": "ALL",
          "conditions": ["diarrhea14Days", "hasDehydration"],
          "classification": { "label": "Severe Persistent Diarrhea", "color": "bg-red-500" },
          "treatments": [
            "Treat dehydration before referral",
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "persistent_diarrhea",
          "type": "ALL",
          "conditions": ["diarrhea14Days"],
          "classification": { "label": "Persistent Diarrhea", "color": "bg-yellow-400" },
          "treatments": [
            "Advise mother on feeding a child with persistent diarrhea",
            "Give Vitamin A: {{dose:vitamin_a}}",
            "Give Zinc supplement: {{dose:zinc}}",
            "Follow-up in 5 days"
          ]
        },
        {
          "id": "dysentery",
          "type": "ALL",
          "conditions": ["bloodInStool"],
          "classification": { "label": "Dysentery", "color": "bg-yellow-400" },
          "treatments": [
            "Give oral Ciprofloxacin: {{dose:ciprofloxacin}}",
            "Give Zinc supplement: {{dose:zinc}}",
            "Follow-up in 3 days"
          ]
        }
      ]
    },
    "fever": {
      "title": "Fever, Malaria & Measles",
      "rules": [
        {
          "id": "very_severe_febrile",
          "type": "ANY",
          "conditions": ["hasDangerSign", "neckStiffness"],
          "classification": { "label": "Very Severe Febrile Disease", "color": "bg-red-500" },
          "treatments": [
            "Give first dose of IM Quinine: {{dose:quinine}}",
            "Give first dose of IM Ampicillin: {{dose:ampicillin}}",
            "Give first dose of IM Gentamycin: {{dose:gentamycin}}",
            "Prevent low blood sugar",
            "Give Paracetamol for high fever: {{dose:paracetamol}}",
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "malaria",
          "type": "ANY",
          "conditions": ["malariaTestPositive"],
          "classification": { "label": "Malaria", "color": "bg-yellow-400" },
          "treatments": [
            "Give oral antimalarial (Coartem): {{dose:coartem}}",
            "Give Paracetamol for high fever: {{dose:paracetamol}}",
            "Advise mother when to return immediately",
            "Follow-up in 3 days"
          ]
        },
        {
          "id": "fever_no_malaria",
          "type": "ALL",
          "conditions": ["hasFever"],
          "classification": { "label": "Fever - No Malaria", "color": "bg-green-500" },
          "treatments": [
            "Give Paracetamol for high fever: {{dose:paracetamol}}",
            "Treat any other apparent cause of fever",
            "Advise mother when to return immediately",
            "Follow-up in 3 days"
          ]
        },
        {
          "id": "severe_complicated_measles",
          "type": "ANY",
          "conditions": ["hasDangerSign", "corneaClouding", "deepExtensiveUlcers"],
          "classification": { "label": "Severe Complicated Measles", "color": "bg-red-500" },
          "treatments": [
            "Give Vitamin A: {{dose:vitamin_a}}",
            "Give first dose of IM Ampicillin: {{dose:ampicillin}}",
            "Give first dose of IM Gentamycin: {{dose:gentamycin}}",
            "If clouding of cornea or pus draining from eye, apply Tetracycline eye ointment",
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "measles_complications",
          "type": "ANY",
          "conditions": ["pusFromEye", "mouthUlcers"],
          "classification": { "label": "Measles with Eye or Mouth Complications", "color": "bg-yellow-400" },
          "treatments": [
            "Give Vitamin A: {{dose:vitamin_a}}",
            "If pus draining from eye, treat with Tetracycline eye ointment",
            "If mouth ulcers, treat with Gentian Violet",
            "Follow-up in 3 days"
          ]
        },
        {
          "id": "measles",
          "type": "ANY",
          "conditions": ["measlesNow", "measles3Months", "measlesRash"],
          "classification": { "label": "Measles", "color": "bg-green-500" },
          "treatments": [
            "Give Vitamin A: {{dose:vitamin_a}}",
            "Counsel mother on feeding"
          ]
        }
      ]
    },
    "ear": {
      "title": "Ear Problems",
      "rules": [
        {
          "id": "mastoiditis",
          "type": "ALL",
          "conditions": ["tenderSwelling"],
          "classification": { "label": "Mastoiditis", "color": "bg-red-500" },
          "treatments": [
            "Give first dose of IM Ampicillin: {{dose:ampicillin}}",
            "Give first dose of IM Gentamycin: {{dose:gentamycin}}",
            "Give first dose of Paracetamol for pain: {{dose:paracetamol}}",
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "acute_ear_infection",
          "type": "ANY",
          "conditions": ["earPain", "earDischargeAcute"],
          "classification": { "label": "Acute Ear Infection", "color": "bg-yellow-400" },
          "treatments": [
            "Give oral Amoxicillin for 5 days: {{dose:amoxicillin}}",
            "Give first dose of Paracetamol for pain: {{dose:paracetamol}}",
            "Dry the ear by wicking",
            "Follow-up in 5 days if not improving"
          ]
        },
        {
          "id": "chronic_ear_infection",
          "type": "ALL",
          "conditions": ["earDischargeChronic"],
          "classification": { "label": "Chronic Ear Infection", "color": "bg-yellow-400" },
          "treatments": [
            "Dry the ear by wicking",
            "Treat with topical Quinolone ear drops for 14 days",
            "Follow-up in 5 days if not improving"
          ]
        },
        {
          "id": "no_ear_infection",
          "type": "ALL",
          "conditions": ["hasEarProblem"],
          "classification": { "label": "No Ear Infection", "color": "bg-green-500" },
          "treatments": [
            "No additional treatment needed"
          ]
        }
      ]
    },
    "malnutrition": {
      "title": "Malnutrition & Anemia",
      "rules": [
        {
          "id": "complicated_sam",
          "type": "ANY",
          "conditions": ["edema", "samWithComplications"],
          "classification": { "label": "Severe Acute Malnutrition (With Complications)", "color": "bg-red-500" },
          "treatments": [
            "Give first dose of IM Ampicillin: {{dose:ampicillin}}",
            "Give first dose of IM Gentamycin: {{dose:gentamycin}}",
            "Prevent low blood sugar",
            "Keep the child warm",
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "uncomplicated_sam",
          "type": "ALL",
          "conditions": ["samWithoutComplications"],
          "classification": { "label": "Severe Acute Malnutrition (No Complications)", "color": "bg-yellow-400" },
          "treatments": [
            "Give oral Amoxicillin for 5 days: {{dose:amoxicillin}}",
            "Give RUTF (Plumpy'Nut): {{dose:rutf}}",
            "Follow-up in 14 days"
          ]
        },
        {
          "id": "mam",
          "type": "ALL",
          "conditions": ["moderateAcuteMalnutrition"],
          "classification": { "label": "Moderate Acute Malnutrition", "color": "bg-yellow-400" },
          "treatments": [
            "Refer to supplementary feeding program if available",
            "Assess the child's feeding and counsel the mother",
            "Follow-up in 30 days"
          ]
        },
        {
          "id": "no_malnutrition",
          "type": "ALL",
          "conditions": ["noMalnutrition"],
          "classification": { "label": "No Acute Malnutrition", "color": "bg-green-500" },
          "treatments": [
            "If child is less than 2 years old, assess feeding and counsel the mother"
          ]
        },
        {
          "id": "severe_anemia",
          "type": "ALL",
          "conditions": ["severePalmarPallor"],
          "classification": { "label": "Severe Anemia", "color": "bg-red-500" },
          "treatments": [
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "anemia",
          "type": "ALL",
          "conditions": ["somePalmarPallor"],
          "classification": { "label": "Anemia", "color": "bg-yellow-400" },
          "treatments": [
            "Give Iron supplement: {{dose:iron}}",
            "Give oral Mebendazole: {{dose:mebendazole}}",
            "Follow-up in 14 days"
          ]
        },
        {
          "id": "no_anemia",
          "type": "ALL",
          "conditions": ["noPalmarPallor"],
          "classification": { "label": "No Anemia", "color": "bg-green-500" },
          "treatments": [
            "If child is less than 2 years old, assess feeding and counsel the mother"
          ]
        }
      ]
    }
  }
};

const DEFAULT_INFANT_PROTOCOL = {
  "formType": "infant",
  "version": "1.0",
  "categories": {
    "bacterial_infection": {
      "title": "Bacterial Infection",
      "rules": [
        {
          "id": "possible_severe_bacterial",
          "type": "ANY",
          "conditions": ["convulsions", "notFeedingWell", "movementOnlyStimulatedNoMovement", "fastBreathing60", "severeChestIndrawing", "fever38", "lowTemp35_5"],
          "classification": { "label": "Possible Severe Bacterial Infection", "color": "bg-red-500" },
          "treatments": [
            "Give first dose of IM Ampicillin: {{dose:ampicillin_im_infant}}",
            "Give first dose of IM Gentamicin (Age < 7 Days): {{dose:gentamicin_im_infant_lt7}}",
            "Give first dose of IM Gentamicin (Age >= 7 Days): {{dose:gentamicin_im_infant_gte7}}",
            "Treat to prevent low blood sugar",
            "Advise mother how to keep the infant warm on the way to the hospital",
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "local_bacterial",
          "type": "ANY",
          "conditions": ["umbilicusRedDraining", "pusFromEyes", "skinPustules"],
          "classification": { "label": "Local Bacterial Infection", "color": "bg-yellow-400" },
          "treatments": [
            "Give oral Amoxicillin for 5 days: {{dose:amoxicillin_infant}}",
            "Teach mother to treat local infections at home",
            "Advise mother to give home care for the young infant",
            "Follow-up in 2 days"
          ]
        },
        {
          "id": "no_bacterial",
          "type": "ALL",
          "conditions": ["noBacterialSigns"],
          "classification": { "label": "No Bacterial Infection", "color": "bg-green-500" },
          "treatments": [
            "Advise mother to give home care for the young infant"
          ]
        }
      ]
    },
    "jaundice": {
      "title": "Jaundice",
      "rules": [
        {
          "id": "severe_jaundice",
          "type": "ANY",
          "conditions": ["jaundiceFirst24h", "jaundiceSolesPalms", "jaundiceLowWeight"],
          "classification": { "label": "Severe Jaundice", "color": "bg-red-500" },
          "treatments": [
            "Treat to prevent low blood sugar",
            "Advise mother how to keep the infant warm on the way to the hospital",
            "Refer URGENTLY to hospital"
          ]
        },
        {
          "id": "jaundice",
          "type": "ALL",
          "conditions": ["jaundiceAfter24h"],
          "classification": { "label": "Jaundice", "color": "bg-yellow-400" },
          "treatments": [
            "Advise mother to give home care for the young infant",
            "Advise mother to return immediately if jaundice extends to palms and soles",
            "Follow-up in 1 day"
          ]
        }
      ]
    },
    "feeding_problem": {
      "title": "Feeding Problems",
      "rules": [
        {
          "id": "feeding_problem_low_weight",
          "type": "ANY",
          "conditions": ["diffFeeding", "feedsLessThan8Times", "receivesOtherFoods", "weightForAgeLow", "thrush", "notWellAttached", "notSucklingEffectively"],
          "classification": { "label": "Feeding Problem or Low Weight", "color": "bg-yellow-400" },
          "treatments": [
            "Advise mother to breastfeed as often and for as long as the infant wants",
            "If feeding less than 8 times in 24 hours, advise to increase frequency",
            "If thrush, teach mother to treat with Gentian Violet at home",
            "Follow-up in 2 days"
          ]
        },
        {
          "id": "no_feeding_problem",
          "type": "ALL",
          "conditions": ["feedingWellNormalWeight"],
          "classification": { "label": "No Feeding Problem", "color": "bg-green-500" },
          "treatments": [
            "Praise the mother for feeding the infant well"
          ]
        }
      ]
    }
  }
};