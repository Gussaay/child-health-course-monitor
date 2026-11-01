// ============================================================================
// IMNCI CLINICAL ENGINE
//
// Turns what the health worker ticked into the booklet's classifications and
// treatments, using the protocol saved in Protocol management. Kept apart from
// the form so the rules can be tested against the national booklet without a
// browser.
// ============================================================================

import { toArabic } from './nationalProtocolAr';

const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};
const upper = (v) => (v === '' || v === undefined || v === null ? 999 : parseFloat(v));

const inRange = (value, lo, hi) => value >= lo && value <= hi;

/**
 * The dose line for one drug, picked by the child's weight (or age when the
 * weight is not known), as the booklet's tables read.
 *
 * A drug marked `ageAndWeight` needs both to match: young-infant gentamicin is
 * 5 mg/kg under 7 days and 7.5 mg/kg from 7 days, at the same weight. Weight
 * alone used to pick the first band, so a 10-day-old was shown the newborn dose.
 */
export const resolveDoseTag = (drugKey, weight, ageInMonths, dosagesProtocol, lang = 'en') => {
    if (!dosagesProtocol || !dosagesProtocol.drugs) return 'Loading dose...';

    const drug = dosagesProtocol.drugs.find((d) => d.id === drugKey);
    if (!drug) return 'Dose: Unknown';

    const w = num(weight);
    const a = num(ageInMonths);
    // Arabic wording when the screen is Arabic and the protocol carries it.
    const ar = lang === 'ar';
    const pick = (obj, field) => (ar && (obj[`${field}Ar`] || (obj[field] && toArabic(obj[field])))) || obj[field];
    const fallback = pick(drug, 'fallback');

    if (w === 0 && a === 0) return fallback || 'Check manual chart';
    if (drug.ageAndWeight && (w === 0 || a === 0)) return fallback || 'Enter age and weight';

    for (const rule of drug.rules || []) {
        const minW = num(rule.minWeight);
        const maxW = upper(rule.maxWeight);
        const minA = num(rule.minAge);
        const maxA = upper(rule.maxAge);

        const isPureAgeRule = minW === 0 && maxW >= 99;
        const isPureWeightRule = minA === 0 && maxA >= 99;

        let match = false;
        if (drug.ageAndWeight) {
            match = inRange(w, minW, maxW) && inRange(a, minA, maxA);
        } else if (isPureAgeRule) {
            match = a > 0 ? inRange(a, minA, maxA) : false;
        } else if (isPureWeightRule) {
            match = w > 0 ? inRange(w, minW, maxW) : false;
        } else if (w > 0) {
            // The booklet's tables give weight first; age is only the stand-in.
            match = inRange(w, minW, maxW);
        } else {
            match = inRange(a, minA, maxA);
        }

        if (match) {
            const parts = [];
            const qty = pick(rule, 'doseQty');
            const freq = pick(rule, 'doseFreq');
            const duration = pick(rule, 'doseDuration');
            if (qty) parts.push(qty);
            if (freq) parts.push(`(${freq})`);
            if (duration) parts.push(`— ${duration}`);
            return parts.join(' ');
        }
    }

    return fallback || 'Check manual chart (Out of range)';
};

const ruleMatches = (rule, findings) => {
    // "Only when": the box's own question, e.g. severe pneumonia only for a
    // child with cough. Without it a danger sign alone classified a child with
    // no cough as Severe Pneumonia.
    const requires = rule.requires || [];
    if (requires.length && !requires.every((c) => findings[c] === true)) return false;

    const conditions = rule.conditions || [];
    if (rule.type === 'ANY') return conditions.some((c) => findings[c] === true);
    if (rule.type === 'ALL') return conditions.length > 0 && conditions.every((c) => findings[c] === true);
    if (rule.type === 'COUNT_GTE') {
        return conditions.filter((c) => findings[c] === true).length >= (rule.threshold || 2);
    }
    return false;
};

/**
 * Each category is one booklet table: the first matching row (red, then
 * yellow, then green) is the child's classification for that table.
 */
export const evaluateProtocol = (findings, currentProtocol, defaultCategories, weight, ageInMonths, dosagesProtocol, lang = 'en') => {
    const evaluated = {};
    Object.entries(defaultCategories || {}).forEach(([k, v]) => { evaluated[k] = { c: [...(v.c || [])], t: [...(v.t || [])] }; });

    if (!currentProtocol || !currentProtocol.categories) return evaluated;

    Object.entries(currentProtocol.categories).forEach(([catKey, category]) => {
        if (!evaluated[catKey]) evaluated[catKey] = { c: [], t: [] };
        for (const rule of category.rules || []) {
            if (!ruleMatches(rule, findings)) continue;
            const ar = lang === 'ar';
            const cls = rule.classification || {};
            const labelAr = cls.labelAr || (cls.label && toArabic(cls.label));
            evaluated[catKey].c.push(labelAr && !cls.labelAr ? { ...cls, labelAr } : rule.classification);
            // The saved Arabic lines when every line has its Arabic; otherwise
            // each English line through the national dictionary, so a line
            // added in English alone is never silently dropped.
            const english = rule.treatments || [];
            const arLines = rule.treatmentsAr;
            const fullAr = Array.isArray(arLines) && arLines.length === english.length && arLines.every((l) => l && String(l).trim());
            const lines = !ar ? english : (fullAr ? arLines : english.map((l) => toArabic(l) || l));
            evaluated[catKey].t.push(...lines.map((line) => String(line).replace(
                /{{dose:(.*?)}}/g,
                (_m, drugKey) => `|||${resolveDoseTag(drugKey.trim(), weight, ageInMonths, dosagesProtocol, lang)}|||`,
            )));
            break;
        }
    });

    return evaluated;
};

/** The tables a row of the form shows together, in booklet order. */
export const mergeCategories = (results, keys) => ({
    c: keys.flatMap((k) => results[k]?.c || []),
    t: keys.flatMap((k) => results[k]?.t || []),
});

// ----------------------------------------------------------------------------
// What the ticks mean, child 2 months up to 5 years
// ----------------------------------------------------------------------------
export function computeChildFindings(a, zStatus) {
    const muac = parseFloat(a.muacCm);
    const hasMuac = Number.isFinite(muac) && muac > 0;
    const hasDangerSign = !!(a.notAbleToDrink || a.vomitsEverything || a.historyOfConvulsions || a.lethargicUnconscious || a.convulsingNow);

    // One booklet sign each. The danger-sign tick and the diarrhoea tick for
    // the same sign used to count as two signs towards Severe Dehydration.
    const dehydLethargic = !!(a.lethargic || a.lethargicUnconscious);
    const dehydNotDrinking = !!(a.drinkPoorly || a.notAbleToDrink);
    const severeSigns = [dehydLethargic, !!a.sunkenEyes, dehydNotDrinking, !!a.pinchVerySlow].filter(Boolean).length;
    const someSigns = [!!a.restlessIrritable, !!a.sunkenEyes, !!a.drinkEagerly, !!a.pinchSlow].filter(Boolean).length;

    const sam = !!a.edema || zStatus === 'Less than -3Z' || (hasMuac && muac < 11.5);
    const samComplicated = !!a.edema || (sam && !!(a.medicalComplication || a.appetiteTest === 'failed'));

    return {
        ...a,
        hasCough: a.hasCough === true,
        hasDiarrhea: a.hasDiarrhea === true,
        hasFever: a.hasFever === true,
        hasEarProblem: a.hasEarProblem === true,
        hasDangerSign,
        dehydLethargic,
        dehydNotDrinking,
        severeDehydration: severeSigns >= 2,
        someDehydration: severeSigns < 2 && someSigns >= 2,
        dehydrationPresent: severeSigns >= 2 || someSigns >= 2,
        diarrhea14Days: num(a.diarrheaDays) >= 14,
        hasDehydration: severeSigns >= 2 || someSigns >= 2,
        malariaTestPositive: a.malariaTest === 'positive',
        measlesNow: !!a.measlesRash,
        measlesNowOrRecent: !!(a.measlesRash || a.measles3Months),
        earDischargeAcute: !!a.earDischarge && num(a.earDischargeDays) < 14,
        earDischargeChronic: !!(a.earDischarge || a.pusFromEar) && num(a.earDischargeDays) >= 14,
        samWithComplications: samComplicated,
        samWithoutComplications: sam && !samComplicated,
        moderateAcuteMalnutrition: !sam && (zStatus === 'Between -3 and -2 Z' || (hasMuac && muac >= 11.5 && muac < 12.5)),
        noMalnutrition: !sam && zStatus === '-2 Z or more' && (!hasMuac || muac >= 12.5),
        severePalmarPallor: a.pallor === 'severePallor',
        somePalmarPallor: a.pallor === 'somePallor',
        noPalmarPallor: a.pallor === 'noPallor',
    };
}

// ----------------------------------------------------------------------------
// What the ticks mean, young infant up to 2 months
// ----------------------------------------------------------------------------
export function computeInfantFindings(a, tempC) {
    const temp = parseFloat(tempC);
    const fever = !!a.fever38 || (Number.isFinite(temp) && temp >= 37.5);
    const lowTemp = !!a.lowTemp35_5 || (Number.isFinite(temp) && temp > 0 && temp < 35.5);
    const times = parseInt(a.breastfeedTimes, 10);

    const severeSigns = [!!a.diarrheaMovement, !!a.diarrheaSunkenEyes, !!a.pinchVerySlow].filter(Boolean).length;
    const someSigns = [!!a.diarrheaRestless, !!a.diarrheaSunkenEyes, !!a.pinchSlow].filter(Boolean).length;

    const verySevere = !!(a.convulsions || a.convulsingNow || a.notFeedingWell || a.movementOnlyStimulatedNoMovement
        || a.fastBreathing || a.severeChestIndrawing || fever || lowTemp);
    const localInfection = !!(a.umbilicusRedDraining || a.pusFromEyes || a.skinPustules);

    const feedingProblem = a.diffFeeding === 'yes' || a.diffFeeding === true
        || (a.breastfed === 'yes' && Number.isFinite(times) && times < 8)
        || a.breastfed === 'no'
        || a.otherFoods === 'yes'
        || a.weightForAgeLow === true
        || !!a.thrush
        || a.wellPositioned === 'no'
        || a.goodAttachment === 'notWell'
        || a.suckingEffectively === 'notEffective';

    return {
        ...a,
        hasJaundice: a.hasJaundice === true,
        hasDiarrhea: a.hasDiarrhea === true,
        fastBreathing60: !!a.fastBreathing,
        fever37_5: fever,
        lowTemp35_5: lowTemp,
        possibleSevereDisease: verySevere,
        localBacterialInfection: localInfection,
        noBacterialSigns: !verySevere && !localInfection,
        jaundiceSevere: a.hasJaundice === true && !!(a.jaundiceFirst24h || a.jaundiceSolesPalms || a.jaundiceLowWeight),
        jaundiceAfter24h: a.hasJaundice === true && !a.jaundiceFirst24h && !a.jaundiceSolesPalms && !a.jaundiceLowWeight,
        noJaundice: a.hasJaundice === false,
        severeDehydration: severeSigns >= 2,
        someDehydration: severeSigns < 2 && someSigns >= 2,
        dehydrationPresent: severeSigns >= 2 || someSigns >= 2,
        diarrhea14Days: num(a.diarrheaDays) >= 14,
        feedsLessThan8Times: a.breastfed === 'yes' && Number.isFinite(times) && times < 8,
        notBreastfeeding: a.breastfed === 'no',
        receivesOtherFoods: a.otherFoods === 'yes',
        lowWeightForAge: a.weightForAgeLow === true,
        notWellPositioned: a.wellPositioned === 'no',
        notWellAttached: a.goodAttachment === 'notWell',
        notSucklingEffectively: a.suckingEffectively === 'notEffective',
        feedingProblem,
        feedingWellNormalWeight: !feedingProblem,
    };
}

/**
 * Infant age typed as "10 d", "3 w", "3 days", "٣ أيام"... in months, or 0
 * when nothing usable was typed (0 means "unknown" to the dose picker).
 */
export function infantAgeInMonths(ageText) {
    const s = String(ageText || '').toLowerCase().trim();
    if (!s) return 0;
    const n = parseFloat(s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (!Number.isFinite(n)) return 0;
    if (/d|day|ي/.test(s)) return n / 30.44;
    if (/w|week|اسب|أسب|س/.test(s)) return n / 4.345;
    if (/m|month|شهر/.test(s)) return n;
    return n > 8 ? n / 30.44 : n / 4.345;
}
