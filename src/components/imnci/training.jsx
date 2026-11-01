// ============================================================================
// TRAINING MODE FOR THE PATIENT FORM
//
// The online IMNCI exercises open the real patient form with `trainingCase`
// set. Nothing is saved as a patient record: the learner fills the form, ticks
// the classification (and, when the exercise asks, the treatment) instead of
// being shown the engine's answer, and presses Submit. The exercise page
// grades the submission and hands back `trainingMarks`, which ring each field
// green or red where the learner filled it in.
//
// The tick labels come from vocabulary.js, so a learner reads exactly the
// wording the protocol prints, in the screen's language.
// ============================================================================
import React, { useState } from 'react';
import { optionText } from './vocabulary';

// On the paper IMNCI recording form the health worker CIRCLES each sign that
// is present. In training mode a ticked sign is ringed in red ink instead.
// `imci-keep-tick` opts the classification and treatment ticks out.
export const SignCircleStyles = () => (
    <style>{`
        .imci-circle-signs input[type="checkbox"]:not(.imci-keep-tick) {
            -webkit-appearance: none; appearance: none; width: 1rem; height: 1rem; flex-shrink: 0;
            border: 1.5px solid #94a3b8; border-radius: 9999px; background: transparent; cursor: pointer;
        }
        .imci-circle-signs input[type="checkbox"]:not(.imci-keep-tick):checked {
            border-color: #dc2626; background-color: #dc2626; box-shadow: 0 0 0 2px #fee2e2;
        }
        .imci-circle-signs input[type="checkbox"]:not(.imci-keep-tick):checked + span {
            display: inline-block; padding: 0.1rem 0.6rem; border: 2px solid #dc2626; border-radius: 50% / 45%;
            color: #b91c1c; font-weight: 700; line-height: 1.25;
        }
    `}</style>
);

const cssString = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// Marks every graded field in place, by its name attribute: a green ring on
// what is right, a red ring and the right value under what is wrong.
export const MarkStyles = ({ marks }) => {
    if (!marks?.fields) return null;
    const GREEN = '#059669';
    const RED = '#dc2626';
    const TICK = '\\2713';
    const CROSS = '\\2717';
    const rules = [];
    const ring = (selector, colour) => rules.push(`.imci-marked ${selector} { box-shadow: 0 0 0 2px ${colour} !important; border-color: ${colour} !important; }`);
    const note = (selector, text, colour) => rules.push(
        `.imci-marked ${selector} { flex-wrap: wrap; overflow: visible; }
        .imci-marked ${selector}::after { content: "${text}"; color: ${colour}; font-weight: 700; font-size: 0.7rem; line-height: 1.3; display: block; flex-basis: 100%; width: 100%; margin-top: 0.2rem; }`,
    );
    Object.entries(marks.fields).forEach(([rawName, m]) => {
        const name = cssString(rawName);
        const colour = m.ok ? GREEN : RED;
        if (m.kind === 'bool') {
            ring(`input[name="${name}"]`, colour);
            note(`*:has(> input[name="${name}"])`, m.ok ? TICK : `${CROSS} should ${m.expected ? '' : 'NOT '}be circled`, colour);
            return;
        }
        const text = m.ok ? TICK : (m.unanswered ? `${CROSS} must be filled in` : `${CROSS} should be ${cssString(m.expectedText)}`);
        ring(`input[name="${name}"]:not([type="radio"])`, colour);
        note(`*:has(> input[name="${name}"]:not([type="radio"]))`, text, colour);
        ring(`select[name="${name}"]`, colour);
        note(`*:has(> select[name="${name}"])`, text, colour);
        if (m.expectedValue !== null && m.expectedValue !== undefined && m.expectedValue !== '') {
            const want = cssString(m.expectedValue);
            if (m.unanswered) {
                ring(`input[type="radio"][name="${name}"]`, RED);
                note(`*:has(> * > input[type="radio"][name="${name}"][value="${want}"])`, `${CROSS} not answered \\2014 you must choose one`, RED);
                return;
            }
            ring(`input[type="radio"][name="${name}"][value="${want}"]`, GREEN);
            if (!m.ok && m.gotValue) ring(`input[type="radio"][name="${name}"][value="${cssString(m.gotValue)}"]`, RED);
            note(`*:has(> * > input[type="radio"][name="${name}"][value="${want}"])`, m.ok ? TICK : `${CROSS} you chose the wrong one \\2014 the ringed answer is correct`, m.ok ? GREEN : RED);
        }
    });
    return <style>{rules.join('\n')}</style>;
};

// A submitted attempt is closed: controls and their labels stop responding.
export const LockStyles = () => (
    <style>{`
        .imci-locked input, .imci-locked select, .imci-locked textarea, .imci-locked label { pointer-events: none !important; }
        .imci-locked input:not([type="checkbox"]):not([type="radio"]), .imci-locked select, .imci-locked textarea { background-color: #f8fafc; }
    `}</style>
);

// Classification / treatment ticks. With `correctIds` each option is marked
// in place: right, wrong, or missed.
export const TrainingChoiceList = ({ options, selected, onToggle, tone, correctIds = null, t }) => {
    const marking = Array.isArray(correctIds);
    return (
        <div className="w-full flex flex-col gap-1.5">
            {options.map((o) => {
                const on = selected.includes(o.id);
                const shouldBe = marking && correctIds.includes(o.id);
                let cls = on ? (tone === 'treatment' ? 'bg-sky-50 border-sky-400' : 'bg-indigo-50 border-indigo-400') : 'bg-white border-slate-300 hover:border-slate-400';
                let mark = null;
                if (marking) {
                    if (on && shouldBe) { cls = 'bg-emerald-50 border-emerald-500'; mark = ['✓', t('imci.training.correct', 'correct'), 'text-emerald-700']; }
                    else if (on) { cls = 'bg-rose-50 border-rose-500'; mark = ['✗', t('imci.training.wrong', 'wrong — should not be ticked'), 'text-rose-700']; }
                    else if (shouldBe) { cls = 'bg-rose-50 border-rose-500 border-dashed'; mark = ['✗', t('imci.training.missed', 'missed — this should be ticked'), 'text-rose-700']; }
                    else cls = 'bg-white border-slate-200 opacity-60';
                }
                return (
                    <div key={o.id}>
                        <label className={`flex items-start gap-2 text-start px-2 py-1.5 rounded border transition-colors ${marking ? 'cursor-default' : 'cursor-pointer'} ${cls}`}>
                            <input type="checkbox" checked={on} disabled={marking} onChange={() => onToggle(o.id)}
                                className="imci-keep-tick rounded text-sky-600 w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span className="text-xs font-semibold leading-tight text-slate-800 flex-1">
                                {o.color && <span className={`inline-block w-2 h-2 rounded-full me-1 align-middle ${o.color}`} aria-hidden="true" />}
                                {o.label}
                            </span>
                        </label>
                        {mark && <p className={`text-[10px] font-bold mt-0.5 px-1 leading-tight ${mark[2]}`}>{mark[0]} {mark[1]}</p>}
                    </div>
                );
            })}
        </div>
    );
};

/**
 * Training state for one form, and the props each AssessmentRow takes.
 * `rowProps(['malnutrition', 'anemia'])` covers a form row that holds more
 * than one exercise section.
 */
export const useTraining = ({ trainingCase, trainingMarks, protocols, t, lang, sectionLabel = (s) => s }) => {
    const [classify, setClassify] = useState({});
    const [treatment, setTreatment] = useState({});
    const sections = trainingCase?.sections || null;
    const includeTreatment = !!trainingCase?.includeTreatment;
    const toggle = (setter, section, id) => setter((prev) => {
        const cur = prev[section] || [];
        return { ...prev, [section]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
    const label = (o) => optionText(o, lang, { protocols, t });

    const shownOf = (list) => {
        const wanted = [].concat(list);
        return sections ? wanted.filter((s) => sections.includes(s)) : wanted;
    };
    const lists = (shown, bank, chosen, setter, marksKey, tone) => shown.map((sec) => {
        const options = (trainingCase[bank]?.[sec] || []).map((o) => ({ id: o.id, label: label(o) }));
        if (!options.length) return null;
        return (
            <div key={sec} className="w-full">
                {shown.length > 1 && <div className="text-[10px] font-bold uppercase text-slate-500 text-start mb-1">{sectionLabel(sec)}</div>}
                <TrainingChoiceList options={options} selected={chosen[sec] || []} onToggle={(id) => toggle(setter, sec, id)} tone={tone} correctIds={trainingMarks?.[marksKey]?.[sec] || null} t={t} />
            </div>
        );
    }).filter(Boolean);
    const empty = <span className="text-xs text-slate-400 italic">—</span>;

    const rowProps = (list) => {
        if (!trainingCase) return {};
        const shown = shownOf(list);
        if (!shown.length) return { hidden: true };
        const c = lists(shown, 'classifyOptions', classify, setClassify, 'classify', 'classify');
        const tr = includeTreatment ? lists(shown, 'treatmentOptions', treatment, setTreatment, 'treatment', 'treatment') : [];
        return {
            classifyOverride: c.length ? <div className="w-full space-y-2">{c}</div> : empty,
            treatmentDisabled: !includeTreatment,
            // Never fall back to the engine's treatments: that would give the answer away.
            treatmentOverride: includeTreatment ? (tr.length ? <div className="w-full space-y-2">{tr}</div> : empty) : null,
        };
    };

    return {
        active: !!trainingCase,
        includeTreatment,
        includes: (sec) => !!trainingCase && (!sections || sections.includes(sec)),
        rowProps,
        chosen: () => ({ chosenClassifications: JSON.parse(JSON.stringify(classify)), chosenTreatments: JSON.parse(JSON.stringify(treatment)) }),
    };
};
