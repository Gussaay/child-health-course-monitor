// src/components/exercises/exerciseGrading.js
//
// Pure scoring logic — no React, no Firebase. Safe to unit-test.
// Every grader returns { earned, possible, correct, detail }
//   earned   number of points scored (partial credit allowed)
//   possible maximum points for the step
//   correct  true only when earned === possible
//   detail   per-item map used to paint the feedback UI

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function gradeForm(step, response = {}) {
    const detail = {};
    let earned = 0;
    step.fields.forEach(f => {
        const given = response[f.id];
        let ok = false;
        if (f.type === 'number') {
            const n = parseFloat(given);
            const tol = f.tolerance ?? 0;
            ok = !Number.isNaN(n) && Math.abs(n - f.answer) <= tol;
        } else {
            const accepted = [f.answer, ...(f.accept || [])].map(norm);
            ok = accepted.includes(norm(given));
        }
        detail[f.id] = { ok, expected: f.answer };
        if (ok) earned += 1;
    });
    return { earned, possible: step.fields.length, correct: earned === step.fields.length, detail };
}

function gradeChecklist(step, response = {}) {
    const detail = {};
    let earned = 0;
    step.signs.forEach(s => {
        const given = response[s.id];              // true | false | undefined
        const ok = given === s.present;
        detail[s.id] = { ok, expected: s.present, why: s.why };
        if (ok) earned += 1;
    });
    return { earned, possible: step.signs.length, correct: earned === step.signs.length, detail };
}

function gradeClassify(step, response = []) {
    const given = Array.isArray(response) ? response : (response ? [response] : []);
    const correctSet = new Set(step.correct);
    const givenSet = new Set(given);
    const exact = correctSet.size === givenSet.size && [...correctSet].every(id => givenSet.has(id));
    const detail = {};
    step.options.forEach(o => {
        detail[o.id] = {
            expected: correctSet.has(o.id),
            chosen: givenSet.has(o.id),
            ok: correctSet.has(o.id) === givenSet.has(o.id),
        };
    });
    // All-or-nothing: a classification is either right or it is not.
    return { earned: exact ? 1 : 0, possible: 1, correct: exact, detail };
}

function gradeMcq(step, response = []) {
    const given = Array.isArray(response) ? response : (response === undefined || response === null ? [] : [response]);
    const correctSet = new Set(step.correct);
    const givenSet = new Set(given);
    const exact = correctSet.size === givenSet.size && [...correctSet].every(i => givenSet.has(i));
    const detail = {};
    step.options.forEach((_, i) => {
        detail[i] = { expected: correctSet.has(i), chosen: givenSet.has(i), ok: correctSet.has(i) === givenSet.has(i) };
    });
    return { earned: exact ? 1 : 0, possible: 1, correct: exact, detail };
}

function gradeMatch(step, response = {}) {
    const pairs = Object.entries(step.correct);
    const detail = {};
    let earned = 0;
    pairs.forEach(([leftId, rightId]) => {
        const ok = response[leftId] === rightId;
        detail[leftId] = { ok, expected: rightId, chosen: response[leftId] || null };
        if (ok) earned += 1;
    });
    return { earned, possible: pairs.length, correct: earned === pairs.length, detail };
}

export function gradeStep(step, response) {
    switch (step.type) {
        case 'brief':     return { earned: 0, possible: 0, correct: true, detail: {} };
        case 'form':      return gradeForm(step, response);
        case 'checklist': return gradeChecklist(step, response);
        case 'classify':  return gradeClassify(step, response);
        case 'mcq':
        case 'media':     return gradeMcq(step, response);
        case 'match':     return gradeMatch(step, response);
        default:          return { earned: 0, possible: 0, correct: true, detail: {} };
    }
}

export function isAnswered(step, response) {
    switch (step.type) {
        case 'brief':     return true;
        case 'form':      return step.fields.every(f => String(response?.[f.id] ?? '').trim() !== '');
        case 'checklist': return step.signs.every(s => typeof response?.[s.id] === 'boolean');
        case 'classify':  return Array.isArray(response) && response.length > 0;
        case 'mcq':
        case 'media':     return Array.isArray(response) && response.length > 0;
        case 'match':     return Object.keys(step.correct).every(k => !!response?.[k]);
        default:          return true;
    }
}

/** Roll every graded step up into one attempt result. */
export function summariseAttempt(steps, results) {
    let earned = 0, possible = 0, stepsCorrect = 0, stepsScored = 0;
    steps.forEach(s => {
        const r = results[s.id];
        if (!r || s.type === 'brief') return;
        earned += r.earned;
        possible += r.possible;
        stepsScored += 1;
        if (r.correct) stepsCorrect += 1;
    });
    const percent = possible > 0 ? Math.round((earned / possible) * 100) : 0;
    return { earned, possible, percent, stepsCorrect, stepsScored };
}
