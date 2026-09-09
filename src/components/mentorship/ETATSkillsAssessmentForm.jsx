// ETATSkillsAssessmentForm.jsx
// Emergency Triage, Assessment and Treatment (ETAT) mentorship skills checklists.
// Mirrors the IMNCI mentorship form, but the mentor first selects which ETAT
// checklist(s) were observed during the visit.
//
// All visible strings are English i18n keys resolved through t(); the Arabic
// wording lives in src/i18n.js so the checklists follow the selected language.

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { saveMentorshipSession } from '../../data';
import { Timestamp } from 'firebase/firestore';
import { Card, Button, FormGroup, Input, Textarea } from '../CommonComponents';
import { getAuth } from 'firebase/auth';
import { SaveStatusModal } from '../FacilityForms.jsx';

// Reuse the IMNCI primitives so the look and feel stays identical
import { ActionToggle, ScoreCircle, handleAutoScroll } from './IMNCSkillsAssessmentForm.jsx';

/* ============================================================================
   CHECKLIST DEFINITIONS
   Every `title`, `subtitle` and `label` below is also an i18n key.
   critical: true  = ★ must-do step. Source: national ETAT checklists 1-5.
   ========================================================================== */

export const ETAT_CHECKLISTS = [
    {
        key: 'TRIAGE',
        order: 1,
        title: 'Triage',
        subtitle: 'Checklist 1 — Triaging',
        icon: '1',
        color: 'sky',
        sections: [
            {
                id: 'A',
                title: 'A. Organisation of triage',
                items: [
                    { key: 'triage_1', critical: true, label: 'Meets the child at the point of entry and begins triage before registration, payment or queuing' },
                    { key: 'triage_2', critical: false, label: 'Greets the caregiver and asks the presenting problem and the child age' }
                ]
            },
            {
                id: 'B',
                title: 'B. Emergency signs, assessed in ABCD sequence',
                items: [
                    { key: 'triage_3', critical: true, label: 'AIRWAY AND BREATHING: looks for obstructed or absent breathing, central cyanosis and severe respiratory distress' },
                    { key: 'triage_4', critical: true, label: 'CIRCULATION: checks whether the hands are cold and, if so, checks capillary refill over 3 seconds and a weak fast pulse' },
                    { key: 'triage_5', critical: true, label: 'COMA / CONVULSION: assesses consciousness using AVPU and looks for a convulsion occurring now' },
                    { key: 'triage_6', critical: true, label: 'SEVERE DEHYDRATION, child with diarrhoea only: checks lethargy, sunken eyes and a very slow skin pinch' },
                    { key: 'triage_7', critical: true, label: 'Completes the full ABCD sequence without omitting a component' },
                    { key: 'triage_8', critical: true, label: 'Checks for visible severe wasting and oedema of both feet before deciding on any fluid treatment' }
                ]
            },
            {
                id: 'C',
                title: 'C. Action on a positive emergency sign',
                items: [
                    { key: 'triage_9', critical: true, label: 'Starts emergency treatment immediately at the triage point' },
                    { key: 'triage_10', critical: true, label: 'Calls for help without leaving the child unattended' },
                    { key: 'triage_11', critical: false, label: 'Draws blood for glucose, malaria test and haemoglobin while treatment is being given' },
                    { key: 'triage_12', critical: true, label: 'Does not move the neck where cervical spine injury is possible' }
                ]
            },
            {
                id: 'D',
                title: 'D. Priority and non-urgent children',
                items: [
                    { key: 'triage_13', critical: true, label: 'Identifies priority signs correctly' },
                    { key: 'triage_14', critical: false, label: 'Moves priority children to the front of the queue' },
                    { key: 'triage_15', critical: true, label: 'Assigns and records the correct category' },
                    { key: 'triage_16', critical: false, label: 'Re-triages children waiting in the queue' }
                ]
            }
        ]
    },
    {
        key: 'AIRWAY_BREATHING',
        order: 2,
        title: 'Airway and Breathing',
        subtitle: 'Checklist 2 — Airway and breathing',
        icon: '2',
        color: 'cyan',
        sections: [
            {
                id: 'A',
                title: 'A. Opening and clearing the airway',
                items: [
                    { key: 'ab_1', critical: true, label: 'Positions the child correctly for age: neutral for an infant, sniffing for an older child' },
                    { key: 'ab_2', critical: true, label: 'Uses jaw thrust without head tilt and stabilises the neck where trauma is suspected' },
                    { key: 'ab_3', critical: false, label: 'Inspects the mouth, removes a visible foreign body only, and clears secretions' },
                    { key: 'ab_4', critical: true, label: 'Manages the choking infant correctly: 5 back blows, then 5 chest thrusts' },
                    { key: 'ab_5', critical: true, label: 'Manages the choking older child correctly: 5 back blows, then 5 abdominal thrusts' },
                    { key: 'ab_6', critical: false, label: 'Selects and inserts a correctly sized Guedel airway by the technique appropriate to age' }
                ]
            },
            {
                id: 'B',
                title: 'B. Ventilation and oxygen',
                items: [
                    { key: 'ab_7', critical: false, label: 'Checks the self-inflating bag and valve before use' },
                    { key: 'ab_8', critical: true, label: 'Selects a mask covering mouth and nose without overlapping eyes or chin, and holds a seal' },
                    { key: 'ab_9', critical: true, label: 'Ventilates at an appropriate rate and confirms visible chest rise' },
                    { key: 'ab_10', critical: true, label: 'Gives oxygen by prongs, or by 8 FG catheter measured nostril to inner eyebrow and inserted to that depth' },
                    { key: 'ab_11', critical: true, label: 'Secures the device, starts flow at 1-2 litres per minute and checks the source is working' },
                    { key: 'ab_12', critical: false, label: 'Keeps the child warm and allows a conscious child the position of maximum comfort' },
                    { key: 'ab_13', critical: true, label: 'Reassesses breathing after every airway or oxygen intervention' }
                ]
            }
        ]
    },
    {
        key: 'CIRCULATION_SHOCK',
        order: 3,
        title: 'Circulation and Shock',
        subtitle: 'Checklist 3 — Circulation and shock',
        icon: '3',
        color: 'rose',
        sections: [
            {
                id: 'A',
                title: 'A. Recognition and access',
                items: [
                    { key: 'cs_1', critical: true, label: 'Diagnoses shock only where all three signs are present' },
                    { key: 'cs_2', critical: true, label: 'Determines nutritional status and states which fluid chart applies before starting' },
                    { key: 'cs_3', critical: true, label: 'Inserts an IV line promptly and draws blood at the same time' },
                    { key: 'cs_4', critical: true, label: 'Escalates to intraosseous or external jugular access without delay where peripheral access fails' },
                    { key: 'cs_5', critical: false, label: 'Stops any bleeding and keeps the child warm' }
                ]
            },
            {
                id: 'B',
                title: 'B. Child WITHOUT severe malnutrition',
                items: [
                    { key: 'cs_6', critical: true, label: 'Gives Ringer lactate or normal saline 20 ml/kg as rapidly as possible, at the correct volume for weight' },
                    { key: 'cs_7', critical: true, label: 'Reassesses after the bolus and repeats 20 ml/kg where there is no improvement' },
                    { key: 'cs_8', critical: false, label: 'Moves to blood 20 ml/kg over 30 minutes after a third bolus without improvement' }
                ]
            },
            {
                id: 'C',
                title: 'C. Child WITH severe malnutrition',
                items: [
                    { key: 'cs_9', critical: true, label: 'Gives IV fluid only where the child is shocked and lethargic or unconscious' },
                    { key: 'cs_10', critical: true, label: 'Gives 15 ml/kg over one hour using a glucose-containing solution' },
                    { key: 'cs_11', critical: true, label: 'Measures pulse and respiratory rate at the start and every 5-10 minutes' },
                    { key: 'cs_12', critical: true, label: 'Stops the infusion on deterioration: respiratory rate up by 5 per minute or pulse by 15 per minute' },
                    { key: 'cs_13', critical: false, label: 'Switches to ReSoMal 10 ml/kg/hour on improvement and starts F-75' }
                ]
            },
            {
                id: 'D',
                title: 'D. Recording',
                items: [
                    { key: 'cs_14', critical: true, label: 'Records fluid type, volume, start time and each reassessment' }
                ]
            }
        ]
    },
    {
        key: 'COMA_CONVULSIONS',
        order: 4,
        title: 'Coma and Convulsions',
        subtitle: 'Checklist 4 — Coma and convulsions',
        icon: '4',
        color: 'violet',
        sections: [
            {
                id: 'A',
                title: 'A. Assessment and airway',
                items: [
                    { key: 'cc_1', critical: true, label: 'Assesses consciousness using AVPU and identifies coma correctly' },
                    { key: 'cc_2', critical: true, label: 'Recognises a convulsion occurring now, including subtle convulsion in a young infant' },
                    { key: 'cc_3', critical: true, label: 'Manages the airway and positions the unconscious child on the side' },
                    { key: 'cc_4', critical: true, label: 'Stabilises the neck and keeps the child supine where trauma is suspected' }
                ]
            },
            {
                id: 'B',
                title: 'B. Glucose',
                items: [
                    { key: 'cc_5', critical: true, label: 'Checks blood glucose, or treats presumptively where testing is unavailable' },
                    { key: 'cc_6', critical: true, label: 'Gives 10% glucose 5 ml/kg IV at the correct volume for weight' },
                    { key: 'cc_7', critical: true, label: 'Prepares 10% glucose correctly from a 50% solution where that is all that is available' },
                    { key: 'cc_8', critical: false, label: 'Rechecks glucose after 30 minutes and feeds the child when it is safe' }
                ]
            },
            {
                id: 'C',
                title: 'C. Anticonvulsant',
                items: [
                    { key: 'cc_9', critical: true, label: 'Gives rectal diazepam 0.1 ml/kg with the needle removed, inserted 4-5 cm, holding the buttocks together' },
                    { key: 'cc_10', critical: true, label: 'Repeats after 10 minutes where the convulsion continues and escalates correctly' },
                    { key: 'cc_11', critical: true, label: 'Uses phenobarbital 20 mg/kg for an infant under two weeks of age' },
                    { key: 'cc_12', critical: true, label: 'Gives no oral medication while the child is convulsing' },
                    { key: 'cc_13', critical: false, label: 'Sponges with room-temperature water for high fever' }
                ]
            }
        ]
    },
    {
        key: 'SEVERE_DEHYDRATION',
        order: 5,
        title: 'Severe Dehydration',
        subtitle: 'Checklist 5 — Severe dehydration',
        icon: '5',
        color: 'amber',
        sections: [
            {
                id: 'A',
                title: 'A. Recognition and plan',
                items: [
                    { key: 'sd_1', critical: true, label: 'Confirms diarrhoea plus at least two of the three signs' },
                    { key: 'sd_2', critical: true, label: 'Treats shock first where present, then switches to this plan' },
                    { key: 'sd_3', critical: true, label: 'Withholds IV fluid in a severely malnourished child without shock and uses ReSoMal' }
                ]
            },
            {
                id: 'B',
                title: 'B. Rehydration',
                items: [
                    { key: 'sd_4', critical: true, label: 'Gives 70 ml/kg over 5 hours under 12 months, or 2.5 hours from 12 months to 5 years' },
                    { key: 'sd_5', critical: true, label: 'States the correct total volume and hourly rate for the weight' },
                    { key: 'sd_6', critical: false, label: 'Uses a nasogastric tube for ORS where IV access is not possible, checking position first' },
                    { key: 'sd_7', critical: false, label: 'Starts ORS about 5 ml/kg/hour as soon as the child can drink' },
                    { key: 'sd_8', critical: true, label: 'Reassesses every 1-2 hours and speeds the infusion where there is no improvement' },
                    { key: 'sd_9', critical: true, label: 'Reclassifies at 6 hours in an infant or 3 hours in a child and moves to the right plan' }
                ]
            }
        ]
    }
];

export const ETAT_CHECKLIST_TITLES = ETAT_CHECKLISTS.reduce((acc, c) => {
    acc[c.key] = c.title;
    return acc;
}, {});

export const getChecklistByKey = (key) => ETAT_CHECKLISTS.find(c => c.key === key) || null;

export const countChecklistItems = (checklist) =>
    checklist.sections.reduce((sum, s) => sum + s.items.length, 0);

export const countCriticalItems = (checklist) =>
    checklist.sections.reduce((sum, s) => sum + s.items.filter(i => i.critical).length, 0);

/* ============================================================================
   FORM DATA / SCORING
   ========================================================================== */

export const getInitialETATFormData = () => ({
    session_date: new Date().toISOString().split('T')[0],
    selectedChecklists: [],
    skills: {},      // { CHECKLIST_KEY: { item_key: 'yes' | 'no' | 'na' } }
    notes: ''
});

// yes = 1 point, no = 0 points, na is excluded from the denominator
export const calculateETATScores = (formData) => {
    const scores = {};
    let overall = 0, overallMax = 0, critical = 0, criticalMax = 0;

    (formData.selectedChecklists || []).forEach(key => {
        const checklist = getChecklistByKey(key);
        if (!checklist) return;

        let clScore = 0, clMax = 0;

        checklist.sections.forEach(section => {
            let sScore = 0, sMax = 0;
            section.items.forEach(item => {
                const value = formData.skills?.[key]?.[item.key];
                if (value === 'yes') { sScore += 1; sMax += 1; }
                else if (value === 'no') { sMax += 1; }

                if (item.critical) {
                    if (value === 'yes') { critical += 1; criticalMax += 1; }
                    else if (value === 'no') { criticalMax += 1; }
                }
            });
            scores[`${key}_${section.id}`] = { score: sScore, maxScore: sMax };
            clScore += sScore;
            clMax += sMax;
        });

        scores[key] = { score: clScore, maxScore: clMax };
        overall += clScore;
        overallMax += clMax;
    });

    scores.criticalSteps = { score: critical, maxScore: criticalMax };
    scores.overallScore = { score: overall, maxScore: overallMax };
    return scores;
};

export const isChecklistComplete = (formData, key) => {
    const checklist = getChecklistByKey(key);
    if (!checklist) return false;
    return checklist.sections.every(section =>
        section.items.every(item => {
            const v = formData.skills?.[key]?.[item.key];
            return v === 'yes' || v === 'no' || v === 'na';
        })
    );
};

export const isETATFormComplete = (formData) => {
    const selected = formData.selectedChecklists || [];
    if (selected.length === 0) return false;
    return selected.every(key => isChecklistComplete(formData, key));
};

export const rehydrateETATDraft = (draft) => {
    const base = getInitialETATFormData();
    if (!draft) return base;
    return {
        ...base,
        session_date: draft.sessionDate || base.session_date,
        selectedChecklists: Array.isArray(draft.selectedChecklists) ? draft.selectedChecklists : [],
        skills: draft.checklistSkills || {},
        notes: draft.notes || ''
    };
};

/* ============================================================================
   UI PIECES
   ========================================================================== */

const COLOR_MAP = {
    sky: { ring: 'border-sky-500 bg-sky-50', dot: 'bg-sky-600', text: 'text-sky-800', head: 'bg-sky-50 border-sky-100' },
    cyan: { ring: 'border-cyan-500 bg-cyan-50', dot: 'bg-cyan-600', text: 'text-cyan-800', head: 'bg-cyan-50 border-cyan-100' },
    rose: { ring: 'border-rose-500 bg-rose-50', dot: 'bg-rose-600', text: 'text-rose-800', head: 'bg-rose-50 border-rose-100' },
    violet: { ring: 'border-violet-500 bg-violet-50', dot: 'bg-violet-600', text: 'text-violet-800', head: 'bg-violet-50 border-violet-100' },
    amber: { ring: 'border-amber-500 bg-amber-50', dot: 'bg-amber-600', text: 'text-amber-800', head: 'bg-amber-50 border-amber-100' }
};

// --- Step 1: which ETAT checklist was observed --------------------------------
const ChecklistSelector = ({ selected, onToggle, onStart, onExit, isEditing }) => {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language?.startsWith('ar');
    const dir = isAr ? 'rtl' : 'ltr';

    return (
        <div dir={dir} className={`max-w-4xl mx-auto ${isAr ? 'text-right' : 'text-left'}`}>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-sky-800">
                    {t('Emergency Triage, Assessment and Treatment (ETAT) Skills Mentorship')}
                </h2>
                <p className="text-slate-600 mt-2 font-medium">
                    {t('Select the checklist(s) observed during this visit')}
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ETAT_CHECKLISTS.map(cl => {
                    const isSelected = selected.includes(cl.key);
                    const colors = COLOR_MAP[cl.color] || COLOR_MAP.sky;
                    return (
                        <button
                            key={cl.key}
                            type="button"
                            onClick={() => onToggle(cl.key)}
                            className={`${isAr ? 'text-right' : 'text-left'} p-4 rounded-2xl border-2 transition-all shadow-sm hover:shadow-md ${isSelected ? colors.ring : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <span className={`flex-shrink-0 w-9 h-9 rounded-full ${colors.dot} text-white font-extrabold flex items-center justify-center shadow`}>
                                        {cl.icon}
                                    </span>
                                    <div>
                                        <div className={`font-extrabold text-base ${isSelected ? colors.text : 'text-slate-800'}`}>
                                            {t(cl.title)}
                                        </div>
                                        <div className="text-xs text-slate-500 font-semibold mt-0.5">
                                            {t(cl.subtitle)}
                                        </div>
                                        <div className="text-xs text-slate-600 mt-2 font-semibold">
                                            {countChecklistItems(cl)} {t('steps')} · {countCriticalItems(cl)} {t('critical steps')} ★
                                        </div>
                                    </div>
                                </div>
                                <span className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center ${isSelected ? `${colors.dot} border-transparent` : 'border-slate-300 bg-white'}`}>
                                    {isSelected && (
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex justify-between items-center gap-3 mt-8 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={onExit}>{t('Cancel')}</Button>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-600">
                        {selected.length > 0
                            ? `${selected.length} ${t('checklist(s) selected')}`
                            : t('No checklist selected')}
                    </span>
                    <Button type="button" onClick={onStart} disabled={selected.length === 0}>
                        {isEditing ? t('Continue editing') : t('Start assessment')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- A single checklist step (same layout as the IMNCI SkillChecklistItem) ---
const ETATSkillRow = ({ item, value, onChange }) => {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language?.startsWith('ar');
    const isAnswered = value !== '' && value !== undefined && value !== 'na';

    const handleChange = (key, val) => {
        const wasAlreadyAnswered = value !== '' && value !== undefined && value !== 'na';
        onChange(item.key, val);
        if (!wasAlreadyAnswered && val !== 'na') handleAutoScroll();
    };

    const options = [
        [t('Yes'), 'yes', 'bg-green-600 border-green-600'],
        [t('No'), 'no', 'bg-red-600 border-red-600'],
        [t('Not applicable'), 'na', 'bg-gray-500 border-gray-500']
    ];

    return (
        <div
            dir={isAr ? 'rtl' : 'ltr'}
            className={`flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group ${isAnswered ? 'row-answered' : 'row-unanswered'}`}
        >
            <span className={`font-medium text-slate-700 break-words group-hover:text-slate-900 ${isAr ? 'text-right mr-4' : 'text-left ml-4'} flex items-start sm:items-center flex-grow`}>
                {item.critical && (
                    <span className={`flex-shrink-0 text-amber-500 ${isAr ? 'ml-2' : 'mr-2'}`} title={t('Critical step')}>★</span>
                )}
                <span className="w-full sm:w-auto">{t(item.label)}</span>
            </span>
            <div className="flex gap-4 flex-shrink-0 mt-2 sm:mt-0">
                <ActionToggle
                    options={options}
                    currentValue={value || ''}
                    name={item.key}
                    onClick={handleChange}
                />
            </div>
        </div>
    );
};

// --- One checklist, rendered as an accordion ---------------------------------
const ChecklistBlock = ({ checklist, formData, scores, onSkillChange, defaultOpen }) => {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language?.startsWith('ar');
    const [isExpanded, setIsExpanded] = useState(defaultOpen);
    const colors = COLOR_MAP[checklist.color] || COLOR_MAP.sky;
    const clScore = scores?.[checklist.key];
    const total = countChecklistItems(checklist);
    const answered = checklist.sections.reduce((sum, s) =>
        sum + s.items.filter(i => {
            const v = formData.skills?.[checklist.key]?.[i.key];
            return v === 'yes' || v === 'no' || v === 'na';
        }).length, 0);
    const complete = answered === total;

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-5" dir={isAr ? 'rtl' : 'ltr'}>
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
            >
                <div className={`flex items-center gap-2 ${isAr ? 'text-right' : 'text-left'}`}>
                    {clScore && <ScoreCircle score={clScore.score} maxScore={clScore.maxScore} />}
                    <span className={`w-8 h-8 rounded-full ${colors.dot} text-white text-sm font-extrabold flex items-center justify-center`}>
                        {checklist.icon}
                    </span>
                    <div>
                        <div className="text-base font-bold text-slate-800">{t(checklist.title)}</div>
                        <div className="text-xs text-slate-500 font-semibold">{t(checklist.subtitle)}</div>
                    </div>
                    {complete
                        ? <span className={`${isAr ? 'mr-3' : 'ml-3'} text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold`}>{t('Complete')}</span>
                        : <span className={`${isAr ? 'mr-3' : 'ml-3'} text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold`} dir="ltr">{answered}/{total}</span>}
                </div>
                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isExpanded && (
                <div>
                    {checklist.sections.map(section => {
                        const sScore = scores?.[`${checklist.key}_${section.id}`];
                        return (
                            <div key={section.id}>
                                <div className="flex items-center justify-between px-4 sm:px-5 py-2 bg-slate-50 border-y border-slate-200">
                                    <div className={`text-sm font-bold text-sky-900 ${isAr ? 'text-right' : 'text-left'}`}>
                                        {t(section.title)}
                                    </div>
                                    {sScore && sScore.maxScore > 0 && (
                                        <span className="text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-full px-2 py-0.5" dir="ltr">
                                            {sScore.score}/{sScore.maxScore}
                                        </span>
                                    )}
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {section.items.map(item => (
                                            <ETATSkillRow
                                                key={item.key}
                                                item={item}
                                                value={formData.skills?.[checklist.key]?.[item.key] || ''}
                                                onChange={(k, v) => onSkillChange(checklist.key, k, v)}
                                            />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- Sticky overall score ----------------------------------------------------
const StickyOverallScore = ({ score, maxScore, criticalScore, criticalMax }) => {
    const { t } = useTranslation();
    if (!maxScore) return null;
    const pct = Math.round((score / maxScore) * 100);
    const bg = pct >= 80 ? 'bg-green-600' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-600';
    return (
        <div className={`fixed top-4 left-4 z-50 flex flex-col items-center justify-center p-2 w-20 rounded-lg ${bg} text-white shadow-2xl`}>
            <div className="font-bold text-lg leading-none">{pct}%</div>
            <div className="text-[10px] mt-1 text-center leading-tight">{t('Overall Score')}</div>
            <div className="text-[10px] leading-tight" dir="ltr">({score}/{maxScore})</div>
            {criticalMax > 0 && (
                <div className="text-[10px] mt-1 border-t border-white/40 pt-1 leading-tight" dir="ltr">★ {criticalScore}/{criticalMax}</div>
            )}
        </div>
    );
};

/* ============================================================================
   MAIN FORM
   ========================================================================== */

const ETATSkillsAssessmentForm = ({
    onSaveOverride = null,
    facility,
    healthWorkerName,
    healthWorkerJobTitle,
    healthWorkerTrainingDate,
    healthWorkerPhone,
    onExit,
    onSaveComplete,
    setToast,
    existingSessionData = null,
    visitNumber = 1,
    canEditVisitNumber = false,
    lastSessionDate = null,
    setIsVisitReportModalOpen,
    setIsDashboardModalOpen
}) => {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language?.startsWith('ar');
    const dir = isAr ? 'rtl' : 'ltr';
    const auth = getAuth();
    const user = auth.currentUser;
    const editingIdRef = useRef(existingSessionData?.id || null);

    const [formData, setFormData] = useState(() =>
        existingSessionData ? rehydrateETATDraft(existingSessionData) : getInitialETATFormData()
    );
    // Checklist selection is the first screen; an existing session skips it
    const [step, setStep] = useState(existingSessionData ? 'form' : 'select');
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [statusData, setStatusData] = useState(null);
    const [statusAction, setStatusAction] = useState(null);
    const [currentVisitNumber, setCurrentVisitNumber] = useState(
        existingSessionData?.visitNumber ? existingSessionData.visitNumber : visitNumber
    );

    const scores = useMemo(() => calculateETATScores(formData), [formData]);
    const isComplete = useMemo(() => isETATFormComplete(formData), [formData]);

    const selectedChecklists = useMemo(
        () => ETAT_CHECKLISTS.filter(c => formData.selectedChecklists.includes(c.key)),
        [formData.selectedChecklists]
    );

    const totalSteps = useMemo(
        () => selectedChecklists.reduce((sum, c) => sum + countChecklistItems(c), 0),
        [selectedChecklists]
    );
    const answeredSteps = useMemo(() => selectedChecklists.reduce((sum, c) =>
        sum + c.sections.reduce((s2, sec) =>
            s2 + sec.items.filter(i => {
                const v = formData.skills?.[c.key]?.[i.key];
                return v === 'yes' || v === 'no' || v === 'na';
            }).length, 0), 0), [selectedChecklists, formData.skills]);

    // --- Handlers -------------------------------------------------------------
    const toggleChecklist = (key) => {
        setFormData(prev => {
            const already = prev.selectedChecklists.includes(key);
            return {
                ...prev,
                selectedChecklists: already
                    ? prev.selectedChecklists.filter(k => k !== key)
                    : [...prev.selectedChecklists, key]
            };
        });
    };

    const handleSkillChange = useCallback((checklistKey, itemKey, value) => {
        setFormData(prev => ({
            ...prev,
            skills: {
                ...prev.skills,
                [checklistKey]: { ...(prev.skills[checklistKey] || {}), [itemKey]: value }
            }
        }));
    }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const buildPayload = (status) => {
        const calculated = calculateETATScores(formData);
        const scoresPayload = {};
        Object.keys(calculated).forEach(key => {
            if (calculated[key]?.maxScore !== undefined) {
                scoresPayload[`${key}_score`] = calculated[key].score;
                scoresPayload[`${key}_maxScore`] = calculated[key].maxScore;
            }
        });

        const payload = {
            serviceType: 'ETAT',
            state: facility?.['الولاية'] || null,
            locality: facility?.['المحلية'] || null,
            facilityId: facility?.id || null,
            facilityName: facility?.['اسم_المؤسسة'] || null,
            facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
            healthWorkerName: healthWorkerName || null,
            workerType: healthWorkerJobTitle || null,
            sessionDate: formData.session_date,
            effectiveDate: Timestamp.fromDate(new Date(formData.session_date)),
            selectedChecklists: formData.selectedChecklists,
            checklistTitles: formData.selectedChecklists.map(k => ETAT_CHECKLIST_TITLES[k]),
            checklistSkills: formData.skills,
            scores: scoresPayload,
            notes: formData.notes,
            status,
            visitNumber: Number(currentVisitNumber)
        };

        if (editingIdRef.current) {
            payload.mentorEmail = existingSessionData?.mentorEmail || 'unknown';
            payload.mentorName = existingSessionData?.mentorName || 'Unknown Mentor';
            payload.edited_by_email = user?.email || 'unknown';
            payload.edited_by_name = user?.displayName || 'Unknown Mentor';
            payload.edited_at = Timestamp.now();
        } else {
            payload.mentorEmail = user?.email || 'unknown';
            payload.mentorName = user?.displayName || 'Unknown Mentor';
        }

        return payload;
    };

    const persist = async (status) => {
        const payload = buildPayload(status);

        if (status === 'complete' && facility?.id && healthWorkerName) {
            const offlineKey = `offline_visit_max_${facility.id}_${healthWorkerName.trim()}`;
            const storedMax = parseInt(localStorage.getItem(offlineKey), 10) || 0;
            if (payload.visitNumber > storedMax) {
                localStorage.setItem(offlineKey, payload.visitNumber.toString());
            }
        }

        const savedId = await (onSaveOverride || saveMentorshipSession)(payload, editingIdRef.current);
        if (savedId) editingIdRef.current = savedId;
        return { ...payload, id: savedId };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isComplete) return;
        setIsSaving(true);
        try {
            await persist('complete');
            setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
            setStatusAction('complete');
        } catch (error) {
            console.error('Error saving ETAT session:', error);
            setStatusData({ status: 'error', message: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDraft = async (e) => {
        e.preventDefault();
        setIsSavingDraft(true);
        try {
            await persist('draft');
            setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
            setStatusAction('draft');
        } catch (error) {
            console.error('Error saving ETAT draft:', error);
            setStatusData({ status: 'error', message: error.message });
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleCloseStatusModal = () => {
        const wasOk = statusData?.status !== 'error';
        setStatusData(null);
        if (wasOk && onSaveComplete) onSaveComplete(statusAction, formData);
    };

    const notSpecified = t('Not specified');

    // --- Step 1: checklist selection -----------------------------------------
    if (step === 'select') {
        return (
            <Card dir={dir}>
                <div className="p-6">
                    <ChecklistSelector
                        selected={formData.selectedChecklists}
                        onToggle={toggleChecklist}
                        onStart={() => setStep('form')}
                        onExit={onExit}
                        isEditing={!!editingIdRef.current}
                    />
                </div>
            </Card>
        );
    }

    // --- Step 2: the checklists ----------------------------------------------
    return (
        <Card dir={dir}>
            <StickyOverallScore
                score={scores.overallScore?.score}
                maxScore={scores.overallScore?.maxScore}
                criticalScore={scores.criticalSteps?.score}
                criticalMax={scores.criticalSteps?.maxScore}
            />

            <form onSubmit={handleSubmit}>
                <div className="p-6">
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-sky-800">
                            {t('Emergency Triage, Assessment and Treatment (ETAT) Skills Mentorship')}
                        </h2>
                    </div>

                    {/* Facility info */}
                    <div className="space-y-2 mb-4">
                        <div className={`p-2 border rounded-lg bg-gray-50 ${isAr ? 'text-right' : 'text-left'}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-0.5">
                                <div><span className="text-sm font-medium text-gray-500">{t('State')}:</span><span className="text-sm font-semibold text-gray-900 mx-2">{facility?.['الولاية'] || notSpecified}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">{t('Locality')}:</span><span className="text-sm font-semibold text-gray-900 mx-2">{facility?.['المحلية'] || notSpecified}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">{t('Facility Name')}:</span><span className="text-sm font-semibold text-gray-900 mx-2">{facility?.['اسم_المؤسسة'] || notSpecified}</span></div>
                            </div>
                        </div>

                        {/* Health worker info */}
                        <div className={`p-2 border rounded-lg bg-gray-50 ${isAr ? 'text-right' : 'text-left'}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-0.5">
                                <div><span className="text-sm font-medium text-gray-500">{t('Health Worker Name')}:</span><span className="text-sm font-semibold text-gray-900 mx-2">{healthWorkerName || notSpecified}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">{t('Job Title')}:</span><span className="text-sm font-semibold text-gray-900 mx-2">{healthWorkerJobTitle || notSpecified}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">{t('اخر تاريخ تدريب (ETAT)')}:</span><span className="text-sm font-semibold text-gray-900 mx-2">{healthWorkerTrainingDate || notSpecified}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">{t('Phone Number')}:</span><span className="text-sm font-semibold text-gray-900 mx-2">{healthWorkerPhone || notSpecified}</span></div>
                            </div>
                        </div>

                        {/* Session info */}
                        <div className={`p-2 border rounded-lg bg-gray-50 ${isAr ? 'text-right' : 'text-left'}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-0.5 items-end">
                                <div className="text-sm">
                                    <span className="font-medium text-gray-500">{t('Supervisor Name')}:</span>
                                    <span className="font-semibold text-gray-900 mx-2">
                                        {existingSessionData
                                            ? (existingSessionData.mentorName || existingSessionData.mentorEmail || notSpecified)
                                            : (user?.displayName || user?.email || '...')}
                                    </span>
                                </div>
                                <div className="text-sm">
                                    <span className="font-medium text-gray-500">{t('Session Date')}:</span>
                                    <Input
                                        type="date"
                                        name="session_date"
                                        value={formData.session_date}
                                        onChange={handleFormChange}
                                        required
                                        className="p-1 text-sm mx-2 w-auto"
                                    />
                                </div>
                                <div className="text-sm">
                                    <span className="font-medium text-gray-500">{t('Previous Session Date')}:</span>
                                    <span className="font-semibold text-gray-900 mx-2">{lastSessionDate || '---'}</span>
                                </div>
                                <div className="text-sm flex items-center">
                                    <span className={`font-medium text-gray-700 ${isAr ? 'ml-2' : 'mr-2'}`}>{t('Visit Number')}:</span>
                                    {canEditVisitNumber ? (
                                        <Input
                                            type="number"
                                            min="1"
                                            value={currentVisitNumber}
                                            onChange={(e) => setCurrentVisitNumber(e.target.value)}
                                            className="w-20 p-1 text-center font-bold text-sky-700 border-sky-300"
                                        />
                                    ) : (
                                        <span className="text-lg font-bold text-sky-700 mx-2">{currentVisitNumber}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Selected checklists + progress */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 mb-4 bg-sky-50 border border-sky-200 rounded-xl">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-700">{t('Selected checklists')}:</span>
                            {selectedChecklists.map(cl => (
                                <span key={cl.key} className={`text-xs font-bold px-2 py-1 rounded-full text-white ${(COLOR_MAP[cl.color] || COLOR_MAP.sky).dot}`}>
                                    {t(cl.title)}
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-600" dir="ltr">{answeredSteps}/{totalSteps}</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => setStep('select')}>
                                {t('Change selection')}
                            </Button>
                        </div>
                    </div>

                    <div className="w-full h-2 bg-slate-200 rounded-full mb-6 overflow-hidden">
                        <div
                            className="h-full bg-sky-600 transition-all duration-300"
                            style={{ width: `${totalSteps ? (answeredSteps / totalSteps) * 100 : 0}%` }}
                        />
                    </div>

                    {/* Checklists */}
                    {selectedChecklists.map((cl, idx) => (
                        <ChecklistBlock
                            key={cl.key}
                            checklist={cl}
                            formData={formData}
                            scores={scores}
                            onSkillChange={handleSkillChange}
                            defaultOpen={idx === 0}
                        />
                    ))}

                    {/* Score summary */}
                    {scores.overallScore?.maxScore > 0 && (
                        <div className="bg-white border border-slate-300 rounded-xl p-4 mb-4">
                            <h4 className={`font-extrabold text-slate-800 mb-3 ${isAr ? 'text-right' : 'text-left'}`}>{t('Score Summary')}</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {selectedChecklists.map(cl => (
                                    <div key={cl.key} className="p-3 border border-slate-200 rounded-lg bg-slate-50 text-center">
                                        <div className="text-xs font-bold text-slate-600 mb-1">{t(cl.title)}</div>
                                        <div className="text-lg font-extrabold text-slate-800" dir="ltr">
                                            {scores[cl.key]?.score ?? 0}/{scores[cl.key]?.maxScore ?? 0}
                                        </div>
                                    </div>
                                ))}
                                <div className="p-3 border border-amber-300 rounded-lg bg-amber-50 text-center">
                                    <div className="text-xs font-bold text-amber-700 mb-1">{t('Critical Steps')} ★</div>
                                    <div className="text-lg font-extrabold text-amber-800" dir="ltr">
                                        {scores.criticalSteps?.score ?? 0}/{scores.criticalSteps?.maxScore ?? 0}
                                    </div>
                                </div>
                                <div className="p-3 border border-sky-300 rounded-lg bg-sky-50 text-center">
                                    <div className="text-xs font-bold text-sky-700 mb-1">{t('Overall Score')}</div>
                                    <div className="text-lg font-extrabold text-sky-800" dir="ltr">
                                        {scores.overallScore.score}/{scores.overallScore.maxScore}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <FormGroup label={t('General Notes')} className={isAr ? 'text-right' : 'text-left'}>
                        <Textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleFormChange}
                            rows={4}
                            placeholder={t('Add any additional notes about the session...')}
                            dir="auto"
                        />
                    </FormGroup>
                </div>

                {/* Desktop buttons */}
                <div className="hidden sm:flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                    <div className="flex gap-2 flex-wrap justify-end">
                        <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft}>{t('Cancel')}</Button>
                        <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving || isSavingDraft}>
                            {isSavingDraft ? t('Saving draft...') : t('Save as Draft')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving || isSavingDraft || !isComplete}
                            title={!isComplete ? t('All steps in the selected checklists must be answered') : t('Save and finish the session')}
                        >
                            {isSaving ? t('Saving...') : t('Save and Complete Session')}
                        </Button>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                        {setIsVisitReportModalOpen && (
                            <Button type="button" variant="info" onClick={() => setIsVisitReportModalOpen(true)} disabled={isSaving || isSavingDraft || !facility}>
                                {t('Visit Report')}
                            </Button>
                        )}
                        {setIsDashboardModalOpen && (
                            <Button type="button" variant="info" onClick={() => setIsDashboardModalOpen(true)} disabled={isSaving || isSavingDraft}>
                                {t('Show Dashboard')}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Mobile buttons */}
                <div className="flex sm:hidden fixed bottom-16 left-0 right-0 z-20 h-16 justify-around items-center bg-gray-900 text-white border-t border-gray-700 shadow-lg" dir={dir}>
                    <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft} size="sm">{t('Cancel')}</Button>
                    <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving || isSavingDraft} size="sm">
                        {isSavingDraft ? t('Saving...') : t('Save as Draft')}
                    </Button>
                    <Button type="submit" disabled={isSaving || isSavingDraft || !isComplete} size="sm">
                        {isSaving ? t('Saving...') : t('Save and Complete')}
                    </Button>
                </div>
            </form>

            <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
        </Card>
    );
};

export default ETATSkillsAssessmentForm;
