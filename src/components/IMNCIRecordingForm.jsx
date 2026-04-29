import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, PageHeader, Button } from './CommonComponents'; 
import { AlertCircle, Baby, User, ClipboardList, CheckSquare, CalendarDays, UserSquare2, Ruler, Weight, Thermometer } from 'lucide-react';
import zScoreData from './zscore_reference_data.json'; 

// --- Reusable Grid Row Component for IMNCI Layout ---
const AssessmentRow = ({ title, isConditional = false, yesNoValue, onYesNoChange, children, classifyData = [], treatmentData = [] }) => {
    const { t } = useTranslation();
    const isActive = isConditional ? yesNoValue === true : true;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-slate-300 bg-white">
            {/* Ask & Look Section */}
            <div className="lg:col-span-7 p-4 border-r-0 lg:border-r border-slate-300 flex flex-col justify-start">
                {title && isConditional ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-100 p-3 rounded-md mb-3 border border-slate-200">
                        <span className="font-semibold text-slate-800">{title}</span>
                        <div className="flex gap-4 mt-2 sm:mt-0">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" checked={yesNoValue === true} onChange={() => onYesNoChange(true)} className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer" />
                                <span className="text-sm font-bold text-slate-700">{t('imci.common.yes')}</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" checked={yesNoValue === false} onChange={() => onYesNoChange(false)} className="w-4 h-4 text-slate-400 focus:ring-slate-400 cursor-pointer" />
                                <span className="text-sm font-bold text-slate-700">{t('imci.common.no')}</span>
                            </label>
                        </div>
                    </div>
                ) : title ? (
                    <div className="font-semibold text-slate-800 mb-3 bg-slate-100 p-3 rounded-md border border-slate-200 flex items-center gap-2">
                        {title}
                    </div>
                ) : null}
                
                {/* Content expands when active */}
                {isActive && <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">{children}</div>}
            </div>
            
            {/* Classify Section */}
            <div className="lg:col-span-2 p-4 border-r-0 lg:border-r border-slate-300 bg-slate-50 flex flex-col gap-2 justify-center items-center text-center">
                {isActive && classifyData.map((c, i) => (
                    <div key={i} className={`${c.color} text-white w-full px-2 py-2 rounded shadow-sm text-sm font-bold leading-tight uppercase`}>
                        {c.label}
                    </div>
                ))}
            </div>

            {/* Identify Treatment Section */}
            <div className="lg:col-span-3 p-4 flex flex-col justify-center bg-white">
                {isActive && treatmentData.length > 0 ? (
                    <ul className="space-y-3">
                        {treatmentData.map((tItem, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-800 items-start">
                                <CheckSquare size={16} className="text-sky-600 mt-0.5 flex-shrink-0" />
                                <div className="w-full">{tItem}</div>
                            </li>
                        ))}
                    </ul>
                ) : isActive ? (
                    <span className="text-sm text-slate-400 italic">{t('imci.common_phrases.no_treatments')}</span>
                ) : null}
            </div>
        </div>
    );
};

// ============================================================================
// FORM 1: SICK YOUNG INFANT (UP TO 2 MONTHS)
// ============================================================================
function InfantForm() {
    const { t } = useTranslation();
    const [infantData, setInfantData] = useState({
        date: new Date().toISOString().split('T')[0], childName: '', ageDaysWeeks: '', weightKg: '', tempC: '',
        problems: '', visitType: 'initial'
    });

    const [assessments, setAssessments] = useState({
        notFeedingWell: false, convulsions: false, convulsingNow: false, movementOnlyStimulatedNoMovement: false,
        breathRate: '', fastBreathing: false, severeChestIndrawing: false, fever38: false, lowTemp35_5: false,
        umbilicusRedDraining: false, pusFromEyes: false, skinPustules: false,
        hasJaundice: null, jaundiceFirst24h: false, jaundiceLowWeight: false, jaundiceSolesPalms: false,
        hasDiarrhea: null, diarrheaDays: '', bloodInStool: false, diarrheaMovement: false, diarrheaRestless: false,
        diarrheaSunkenEyes: false, pinchVerySlow: false, pinchSlow: false,
        diffFeeding: null, breastfed: null, breastfeedTimes: '', otherFoods: null, otherFoodsOften: '', feedTool: '',
        weightForAgeLow: false, thrush: false,
        wellPositioned: null, posInLine: null, posNoseOpposite: null, posCloseBody: null, posWholeBodySupported: null,
        goodAttachment: null, attChinTouching: null, attMouthWide: null, attLowerLipOut: null, attAreolaAbove: null,
        suckingEffectively: null,
        v_opv0: false, v_bcg: false, v_opv1: false, v_rota1: false, v_pcv1: false, v_penta1: false, v_ipv1: false,
        vaccineStatus: '', nextVaccine: '',
        hasOtherProblems: null, otherProblemsText: '', followUpDays: ''
    });

    const handleDataChange = (e) => setInfantData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleCheckboxChange = (e) => setAssessments(prev => ({ ...prev, [e.target.name]: e.target.checked }));
    const handleRadioChange = (e) => setAssessments(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const results = useMemo(() => {
        const cat = {
            infection: { c: [], t: [] }, jaundice: { c: [], t: [] }, diarrhea: { c: [], t: [] },
            feeding: { c: [], t: [] }, breast: { c: [], t: [] }, vaccine: { c: [], t: [] }, other: { c: [], t: [] }
        };
        const temp = parseFloat(infantData.tempC) || 0;

        let severeDiseaseSigns = 0;
        if (assessments.notFeedingWell) severeDiseaseSigns++;
        if (assessments.convulsions) severeDiseaseSigns++;
        if (assessments.convulsingNow) severeDiseaseSigns++;
        if (assessments.fastBreathing) severeDiseaseSigns++;
        if (assessments.severeChestIndrawing) severeDiseaseSigns++;
        if (assessments.movementOnlyStimulatedNoMovement) severeDiseaseSigns++;
        if (assessments.fever38 || temp >= 38) severeDiseaseSigns++;
        if (assessments.lowTemp35_5 || (temp > 0 && temp < 35.5)) severeDiseaseSigns++;

        if (severeDiseaseSigns > 0) {
            cat.infection.c.push({ label: t('imci.classifications.possible_severe_bacterial_infection'), color: "bg-red-500" });
            cat.infection.t.push(t('imci.treatments.refer_urgently'));
            cat.infection.t.push(t('imci.treatments.im_antibiotic'));
            cat.infection.t.push(t('imci.treatments.prevent_low_blood_sugar'));
            cat.infection.t.push(t('imci.treatments.keep_warm'));
        } else if (assessments.umbilicusRedDraining || assessments.skinPustules || assessments.pusFromEyes) {
            cat.infection.c.push({ label: t('imci.classifications.local_bacterial_infection'), color: "bg-yellow-400" });
            cat.infection.t.push(t('imci.treatments.oral_antibiotic'));
            cat.infection.t.push(t('imci.treatments.treat_local_infection'));
            cat.infection.t.push(t('imci.treatments.home_care'));
        }

        if (assessments.hasJaundice) {
            if (assessments.jaundiceFirst24h || assessments.jaundiceLowWeight || assessments.jaundiceSolesPalms) {
                cat.jaundice.c.push({ label: t('imci.classifications.severe_jaundice'), color: "bg-red-500" });
                cat.jaundice.t.push(t('imci.treatments.refer_urgently'));
            } else {
                cat.jaundice.c.push({ label: t('imci.classifications.jaundice'), color: "bg-yellow-400" });
                cat.jaundice.t.push(t('imci.treatments.home_care'));
            }
        }

        if (assessments.hasDiarrhea) {
            let severeDehyd = 0, someDehyd = 0;
            if (assessments.diarrheaMovement) severeDehyd++;
            if (assessments.diarrheaRestless) someDehyd++;
            if (assessments.diarrheaSunkenEyes) { severeDehyd++; someDehyd++; }
            if (assessments.pinchVerySlow) severeDehyd++;
            if (assessments.pinchSlow) someDehyd++;

            if (severeDehyd >= 2) {
                cat.diarrhea.c.push({ label: t('imci.classifications.severe_dehydration'), color: "bg-red-500" });
                cat.diarrhea.t.push(t('imci.treatments.refer_urgently'));
                cat.diarrhea.t.push(t('imci.treatments.iv_fluids'));
            } else if (someDehyd >= 2) {
                cat.diarrhea.c.push({ label: t('imci.classifications.some_dehydration'), color: "bg-yellow-400" });
                cat.diarrhea.t.push(t('imci.treatments.ors'));
                cat.diarrhea.t.push(t('imci.treatments.home_care'));
            } else {
                cat.diarrhea.c.push({ label: t('imci.classifications.no_dehydration'), color: "bg-green-500" });
                cat.diarrhea.t.push(t('imci.treatments.home_care'));
            }
        }

        const hasFeedingProblem = assessments.diffFeeding === 'yes' || parseInt(assessments.breastfeedTimes || 8) < 8 || assessments.otherFoods === 'yes' || assessments.weightForAgeLow || assessments.thrush;
        if (hasFeedingProblem) {
            cat.feeding.c.push({ label: t('imci.classifications.feeding_problem_low_weight'), color: "bg-yellow-400" });
            if (assessments.thrush) cat.feeding.t.push(t('imci.treatments.treat_thrush'));
            cat.feeding.t.push(t('imci.treatments.council_breastfeeding'));
            cat.feeding.t.push(t('imci.treatments.home_care'));
        } else {
            cat.feeding.c.push({ label: t('imci.classifications.no_feeding_problem'), color: "bg-green-500" });
        }

        if (assessments.wellPositioned === 'notWell') cat.breast.t.push(t('imci.treatments.teach_position'));
        if (assessments.goodAttachment === 'notWell' || assessments.suckingEffectively === 'notEffective') cat.breast.t.push(t('imci.treatments.teach_attachment'));

        let vBirth = assessments.v_opv0 && assessments.v_bcg;
        let v6Weeks = assessments.v_opv1 && assessments.v_rota1 && assessments.v_pcv1 && assessments.v_penta1 && assessments.v_ipv1;
        let hasAny = assessments.v_opv0 || assessments.v_bcg || assessments.v_opv1 || assessments.v_rota1 || assessments.v_pcv1 || assessments.v_penta1 || assessments.v_ipv1;

        if (assessments.vaccineStatus === 'fully' || (vBirth && v6Weeks)) {
            cat.vaccine.c.push({ label: t('imci.classifications.fully_vaccinated'), color: "bg-green-500" });
        } else if (assessments.vaccineStatus === 'partially' || hasAny) {
            cat.vaccine.c.push({ label: t('imci.classifications.partially_vaccinated'), color: "bg-yellow-500" });
        } else if (assessments.vaccineStatus === 'not' || !hasAny) {
            cat.vaccine.c.push({ label: t('imci.classifications.not_vaccinated'), color: "bg-red-500" });
        }

        if (assessments.nextVaccine) cat.vaccine.t.push(`${t('imci.common_phrases.next_vaccine')}: ${assessments.nextVaccine}`);

        if (assessments.hasOtherProblems && assessments.otherProblemsText.trim() !== '') {
            cat.other.c.push({ label: t('imci.classifications.other_problem_noted'), color: "bg-slate-500" });
            cat.other.t.push(`${t('imci.common_phrases.note')}${assessments.otherProblemsText}`);
        }

        Object.keys(cat).forEach(k => { cat[k].t = [...new Set(cat[k].t)]; });

        return cat;
    }, [infantData, assessments, t]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <Card>
                <div className="bg-slate-800 text-white p-3 rounded-t-md font-bold text-center uppercase tracking-wide shadow-sm">
                    {t('imci.infant_title')}
                </div>
                <div className="p-5 space-y-5 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                        <div className="space-y-1 lg:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><UserSquare2 size={14}/> {t('imci.common.child_name')}</label>
                            <input type="text" name="childName" value={infantData.childName} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.child_name')} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> {t('imci.common.date')}</label>
                            <input type="date" name="date" value={infantData.date} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> {t('imci.common.age_days_weeks')}</label>
                            <input type="text" name="ageDaysWeeks" value={infantData.ageDaysWeeks} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.age_days')} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Weight size={14}/> {t('imci.common.weight')}</label>
                            <input type="number" step="0.1" name="weightKg" value={infantData.weightKg} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.weight')} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Thermometer size={14}/> {t('imci.common.temp')}</label>
                            <input type="number" step="0.1" name="tempC" value={infantData.tempC} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.temp')} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 border-t border-slate-200 pt-4">
                        <div className="lg:col-span-2 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">{t('imci.common.ask_problems')}</label>
                            <input type="text" name="problems" value={infantData.problems} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.problems')} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">{t('imci.common.visit_type')}</label>
                            <div className="flex gap-4 p-2 bg-white rounded-md border border-slate-200 shadow-sm items-center h-[42px]">
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="initial" checked={infantData.visitType === 'initial'} onChange={handleDataChange} className="text-sky-600"/> {t('imci.common.initial_visit')}</label>
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="followup" checked={infantData.visitType === 'followup'} onChange={handleDataChange} className="text-sky-600"/> {t('imci.common.follow_up')}</label>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="border border-slate-300 rounded-md overflow-hidden shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-800 font-bold text-sm text-center text-white border-b border-slate-300 hidden lg:grid">
                    <div className="lg:col-span-7 p-3 border-r border-slate-600">{t('imci.common.ask_look')}</div>
                    <div className="lg:col-span-2 p-3 border-r border-slate-600">{t('imci.common.classify')}</div>
                    <div className="lg:col-span-3 p-3">{t('imci.common.identify_treatment')}</div>
                </div>

                {/* 1. SEVERE DISEASE */}
                <AssessmentRow 
                    title={<span className="text-slate-800 font-bold flex items-center gap-2">{t('imci.infant.check_severe_disease')}</span>}
                    active={true} classifyData={results.infection.c} treatmentData={results.infection.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 uppercase border-b pb-1 mb-2">{t('imci.infant.ask')}</h4>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="notFeedingWell" checked={assessments.notFeedingWell} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.diff_feeding')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="convulsions" checked={assessments.convulsions} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.convulsions')}</span></label>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 uppercase border-b pb-1 mb-2">{t('imci.infant.look')}</h4>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="convulsingNow" checked={assessments.convulsingNow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.convulsing_now')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="movementOnlyStimulatedNoMovement" checked={assessments.movementOnlyStimulatedNoMovement} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.movement')}</span></label>
                            <div className="flex flex-wrap items-center gap-2 text-sm border-t pt-2 border-slate-200">
                                <span>{t('imci.infant.count_breaths')}</span>
                                <input type="number" name="breathRate" value={assessments.breathRate} onChange={(e) => setAssessments(p=>({...p, breathRate: e.target.value}))} className="w-16 rounded border-slate-300 p-1" />
                                <span>{t('imci.infant.repeat_60')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="fastBreathing" checked={assessments.fastBreathing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.fast_breathing')}</span></label>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="severeChestIndrawing" checked={assessments.severeChestIndrawing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.chest_indrawing')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="fever38" checked={assessments.fever38} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.fever_38')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="lowTemp35_5" checked={assessments.lowTemp35_5} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.low_temp')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="umbilicusRedDraining" checked={assessments.umbilicusRedDraining} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.umbilicus')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="pusFromEyes" checked={assessments.pusFromEyes} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.pus_eyes')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="skinPustules" checked={assessments.skinPustules} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.skin_pustules')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 2. JAUNDICE */}
                <AssessmentRow 
                    title={t('imci.infant.check_jaundice')} 
                    isConditional yesNoValue={assessments.hasJaundice} onYesNoChange={(val) => setAssessments(p => ({...p, hasJaundice: val}))}
                    classifyData={results.jaundice.c} treatmentData={results.jaundice.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <span className="text-sm font-medium italic block mb-1">{t('imci.infant.if_jaundice_ask')}</span>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="jaundiceFirst24h" checked={assessments.jaundiceFirst24h} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.jaundice_24h')}</span></label>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="jaundiceLowWeight" checked={assessments.jaundiceLowWeight} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.jaundice_low_weight')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="jaundiceSolesPalms" checked={assessments.jaundiceSolesPalms} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.jaundice_palms_soles')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 3. DIARRHOEA */}
                <AssessmentRow 
                    title={t('imci.infant.check_diarrhea')} 
                    isConditional yesNoValue={assessments.hasDiarrhea} onYesNoChange={(val) => setAssessments(p => ({...p, hasDiarrhea: val}))}
                    classifyData={results.diarrhea.c} treatmentData={results.diarrhea.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{t('imci.common.duration')}</span>
                                <input type="number" name="diarrheaDays" value={assessments.diarrheaDays} onChange={(e) => setAssessments(p => ({...p, diarrheaDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm font-medium">{t('imci.common.days')}</span>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="bloodInStool" checked={assessments.bloodInStool} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.blood_in_stool')}</span></label>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <span className="font-bold text-sm block border-b pb-1 mb-2">{t('imci.infant.general_condition')}</span>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="diarrheaMovement" checked={assessments.diarrheaMovement} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.diarrhea_movement')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="diarrheaRestless" checked={assessments.diarrheaRestless} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.diarrhea_restless')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="diarrheaSunkenEyes" checked={assessments.diarrheaSunkenEyes} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.sunken_eyes')}</span></label>
                            <div className="flex items-center gap-3 text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium">{t('imci.infant.skin_pinch')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchVerySlow" checked={assessments.pinchVerySlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.very_slowly')}</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchSlow" checked={assessments.pinchSlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.slowly')}</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 4. FEEDING */}
                <AssessmentRow 
                    title={t('imci.infant.check_feeding')} active={true}
                    classifyData={results.feeding.c} treatmentData={results.feeding.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span>{t('imci.infant.any_diff_feeding')}</span>
                                <div className="flex gap-3"><label className="cursor-pointer"><input type="radio" name="diffFeeding" value="yes" checked={assessments.diffFeeding==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label><label className="cursor-pointer"><input type="radio" name="diffFeeding" value="no" checked={assessments.diffFeeding==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></div>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span>{t('imci.infant.is_breastfed')}</span>
                                <div className="flex gap-3"><label className="cursor-pointer"><input type="radio" name="breastfed" value="yes" checked={assessments.breastfed==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label><label className="cursor-pointer"><input type="radio" name="breastfed" value="no" checked={assessments.breastfed==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></div>
                            </div>
                            {assessments.breastfed === 'yes' && (
                                <div className="flex items-center gap-2 text-sm ml-4">
                                    <span>{t('imci.infant.times_24h')}</span>
                                    <input type="number" name="breastfeedTimes" value={assessments.breastfeedTimes} onChange={(e) => setAssessments(p=>({...p, breastfeedTimes: e.target.value}))} className="w-16 rounded border-slate-300 p-1"/>
                                    <span>{t('imci.infant.times')}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span>{t('imci.infant.other_foods')}</span>
                                <div className="flex gap-3"><label className="cursor-pointer"><input type="radio" name="otherFoods" value="yes" checked={assessments.otherFoods==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label><label className="cursor-pointer"><input type="radio" name="otherFoods" value="no" checked={assessments.otherFoods==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></div>
                            </div>
                            {assessments.otherFoods === 'yes' && (
                                <div className="flex items-center gap-2 text-sm ml-4">
                                    <span>{t('imci.infant.how_often')}</span>
                                    <input type="text" name="otherFoodsOften" value={assessments.otherFoodsOften} onChange={(e) => setAssessments(p=>({...p, otherFoodsOften: e.target.value}))} className="w-full rounded border-slate-300 p-1"/>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                                <span>{t('imci.infant.what_use_feed')}</span>
                                <input type="text" name="feedTool" value={assessments.feedTool} onChange={(e) => setAssessments(p=>({...p, feedTool: e.target.value}))} className="w-full rounded border-slate-300 p-1"/>
                            </div>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <span className="font-bold text-sm block">{t('imci.infant.determine_weight')}</span>
                            <div className="flex gap-4 text-sm border-b pb-2">
                                <label className="cursor-pointer"><input type="radio" name="weightForAgeLow" value="true" checked={assessments.weightForAgeLow===true} onChange={()=>setAssessments(p=>({...p, weightForAgeLow: true}))}/> {t('imci.infant.low')}</label>
                                <label className="cursor-pointer"><input type="radio" name="weightForAgeLow" value="false" checked={assessments.weightForAgeLow===false} onChange={()=>setAssessments(p=>({...p, weightForAgeLow: false}))}/> {t('imci.infant.not_low')}</label>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="thrush" checked={assessments.thrush} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.thrush')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 5. ASSESS BREASTFEEDING */}
                <AssessmentRow 
                    title={<span>{t('imci.infant.assess_breastfeeding')} <span className="font-normal text-xs text-slate-500">{t('imci.infant.if_no_refer')}</span></span>} 
                    active={true}
                    classifyData={results.breast.c} treatmentData={results.breast.t}
                >
                    <div className="mt-2 overflow-x-auto border border-slate-300 rounded-md">
                        <table className="w-full text-sm border-collapse min-w-[500px]">
                            <tbody>
                                <tr>
                                    <td className="border border-slate-300 p-2 font-bold bg-slate-100">{t('imci.infant.well_positioned')}</td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="wellPositioned" value="well" checked={assessments.wellPositioned==='well'} onChange={handleRadioChange}/> {t('imci.infant.pos_well')}</label></td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="wellPositioned" value="notWell" checked={assessments.wellPositioned==='notWell'} onChange={handleRadioChange}/> {t('imci.infant.pos_not_well')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">{t('imci.infant.pos_in_line')}</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posInLine" value="yes" checked={assessments.posInLine==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posInLine" value="no" checked={assessments.posInLine==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">{t('imci.infant.pos_nose')}</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posNoseOpposite" value="yes" checked={assessments.posNoseOpposite==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posNoseOpposite" value="no" checked={assessments.posNoseOpposite==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">{t('imci.infant.pos_close')}</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posCloseBody" value="yes" checked={assessments.posCloseBody==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posCloseBody" value="no" checked={assessments.posCloseBody==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">{t('imci.infant.pos_supported')}</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posWholeBodySupported" value="yes" checked={assessments.posWholeBodySupported==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posWholeBodySupported" value="no" checked={assessments.posWholeBodySupported==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 font-bold bg-slate-100">{t('imci.infant.able_to_attach')}</td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="goodAttachment" value="good" checked={assessments.goodAttachment==='good'} onChange={handleRadioChange}/> {t('imci.infant.att_good')}</label></td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="goodAttachment" value="notWell" checked={assessments.goodAttachment==='notWell'} onChange={handleRadioChange}/> {t('imci.infant.att_not_well')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">{t('imci.infant.att_chin')}</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attChinTouching" value="yes" checked={assessments.attChinTouching==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attChinTouching" value="no" checked={assessments.attChinTouching==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">{t('imci.infant.att_mouth_wide')}</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attMouthWide" value="yes" checked={assessments.attMouthWide==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attMouthWide" value="no" checked={assessments.attMouthWide==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">{t('imci.infant.att_lower_lip')}</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attLowerLipOut" value="yes" checked={assessments.attLowerLipOut==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attLowerLipOut" value="no" checked={assessments.attLowerLipOut==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">{t('imci.infant.att_areola')}</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attAreolaAbove" value="yes" checked={assessments.attAreolaAbove==='yes'} onChange={handleRadioChange}/> {t('imci.common.yes')}</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attAreolaAbove" value="no" checked={assessments.attAreolaAbove==='no'} onChange={handleRadioChange}/> {t('imci.common.no')}</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 font-bold bg-slate-100">{t('imci.infant.sucking_effectively')}</td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="suckingEffectively" value="effective" checked={assessments.suckingEffectively==='effective'} onChange={handleRadioChange}/> {t('imci.infant.suck_effective')}</label></td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="suckingEffectively" value="notEffective" checked={assessments.suckingEffectively==='notEffective'} onChange={handleRadioChange}/> {t('imci.infant.suck_not_effective')}</label></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </AssessmentRow>

                {/* 6. Vaccination */}
                <AssessmentRow 
                    title={<span>{t('imci.infant.check_vaccination')} <span className="font-normal text-xs text-slate-500 block sm:inline sm:ml-2">{t('imci.infant.check_given')}</span></span>}
                    active={true} classifyData={results.vaccine.c} treatmentData={results.vaccine.t}
                >
                    <div className="flex flex-col gap-4 mt-2">
                        <div className="overflow-x-auto border border-slate-300 rounded-md">
                            <table className="w-full text-xs text-left border-collapse min-w-[500px]">
                                <tbody>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100 w-24">{t('imci.infant.at_birth')}</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv0" checked={assessments.v_opv0} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.opv0')}</label></td>
                                        <td className="p-2" colSpan={4}><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_bcg" checked={assessments.v_bcg} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.bcg')}</label></td>
                                    </tr>
                                    <tr>
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">{t('imci.infant.weeks_6')}</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv1" checked={assessments.v_opv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.opv1')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_rota1" checked={assessments.v_rota1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.rota1')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_pcv1" checked={assessments.v_pcv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.pcv1')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_penta1" checked={assessments.v_penta1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.penta1')}</label></td>
                                        <td className="p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_ipv1" checked={assessments.v_ipv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.ipv1')}</label></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 7. Any other problems */}
                <AssessmentRow 
                    title={t('imci.infant.any_other_problems')}
                    isConditional={true}
                    yesNoValue={assessments.hasOtherProblems} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasOtherProblems: val}))}
                    classifyData={results.other.c} treatmentData={results.other.t}
                >
                    <textarea name="otherProblemsText" value={assessments.otherProblemsText} onChange={(e) => setAssessments(prev=>({...prev, otherProblemsText: e.target.value}))} rows={2} className="block w-full rounded-md border-slate-300 shadow-sm focus:ring-sky-500 sm:text-sm mt-2 p-3" placeholder={t('imci.placeholders.other_problems')}></textarea>
                </AssessmentRow>

                {/* Footer: Follow up */}
                <div className="p-5 bg-slate-800 text-white flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
                    <span className="font-bold tracking-wide uppercase">{t('imci.common.return_follow_up')}</span>
                    <div className="flex gap-5 font-semibold">
                        {['1', '2', '14'].map(days => (
                            <label key={days} className="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="followUpDays" value={days} checked={assessments.followUpDays===String(days)} onChange={handleRadioChange} className="text-sky-400 focus:ring-sky-400 cursor-pointer w-4 h-4" /><span>{days} {t('imci.common.days')}</span></label>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end pb-8">
                <Button variant="primary" className="w-full md:w-auto py-3.5 shadow-lg px-12 text-lg font-bold"><ClipboardList className="w-5 h-5 mr-2 inline-block"/> {t('imci.common.save_infant')}</Button>
            </div>
        </div>
    );
}

// ============================================================================
// FORM 2: SICK CHILD (2 MONTHS UP TO 5 YEARS) - ALIGNED GRID LAYOUT
// ============================================================================
function ChildForm() {
    const { t } = useTranslation();
    const [childData, setChildData] = useState({
        date: new Date().toISOString().split('T')[0], childName: '', sex: 'male', ageMonths: '', weightKg: '', lengthCm: '', tempC: '',
        problems: '', visitType: 'initial'
    });

    const [assessments, setAssessments] = useState({
        notAbleToDrink: false, vomitsEverything: false, historyOfConvulsions: false, lethargicUnconscious: false, convulsingNow: false,
        hasCough: null, coughDays: '', breathRate: '', fastBreathing: false, chestIndrawing: false, stridor: false, wheeze: false,
        hasDiarrhea: null, diarrheaDays: '', bloodInStool: false, lethargic: false, restlessIrritable: false, sunkenEyes: false,
        drinkPoorly: false, drinkEagerly: false, pinchVerySlow: false, pinchSlow: false,
        hasFever: null, feverDays: '', dailyFever7Days: false, measles3Months: false, neckStiffness: false, measlesRash: false,
        malariaTest: '', mouthUlcers: false, deepExtensiveUlcers: false, pusFromEye: false, corneaClouding: false,
        hasEarProblem: null, earPain: false, earDischarge: false, earDischargeDays: '', tenderSwelling: false, pusFromEar: false,
        pallor: 'noPallor', 
        edema: false, muacCm: '', medicalComplication: false, appetiteTest: '',
        v_opv0: false, v_bcg: false, v_opv1: false, v_rota1: false, v_pcv1: false, v_penta1: false, v_ipv1: false,
        v_opv2: false, v_rota2: false, v_pcv2: false, v_penta2: false,
        v_opv3: false, v_rota3: false, v_pcv3: false, v_penta3: false, v_ipv2: false,
        v_mr: false, v_yellowFever: false, v_menA: false, v_mrBooster: false, v_vitaminA: false,
        nextVaccine: '', nextVitaminA: '',
        hasOtherProblems: null, otherProblemsText: '',
        feed_ageLess2: false, feed_hadMAM: false, feed_hadAnemia: false, feedingStatus: '',
        followUpDays: ''
    });

    const handleChildDataChange = (e) => setChildData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleCheckboxChange = (e) => setAssessments(prev => ({ ...prev, [e.target.name]: e.target.checked }));
    const handleRadioChange = (e) => setAssessments(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const zScoreResult = useMemo(() => {
        const { sex, ageMonths, weightKg, lengthCm } = childData;
        const weight = parseFloat(weightKg);
        const length = parseFloat(lengthCm);
        const age = parseFloat(ageMonths);

        if (!weight || !length || !age || !sex) return { zScore: null, status: 'Incomplete Data' };

        let groupKey = (sex === 'male') ? (age < 24 ? "boys_0_2" : "boys_2_5") : (age < 24 ? "girls_0_2" : "girls_2_5");
        const groupData = zScoreData[groupKey];
        if (!groupData) return { zScore: null, status: 'Group Error' };

        const lengthKey = (Math.round(length * 2) / 2).toFixed(1);
        const row = groupData[lengthKey];
        if (!row) return { zScore: null, status: 'Length out of range' };

        const thresholds = ["-3", "-2", "-1", "0", "1", "2", "3"];
        let z = null;

        if (weight <= row["-3"]) z = -3;
        else if (weight >= row["3"]) z = 3;
        else {
            for (let i = 0; i < thresholds.length - 1; i++) {
                const lowerKey = thresholds[i];
                const upperKey = thresholds[i + 1];
                if (weight >= row[lowerKey] && weight <= row[upperKey]) {
                    z = parseFloat(lowerKey) + (weight - row[lowerKey]) / (row[upperKey] - row[lowerKey]);
                    break;
                }
            }
        }

        let status = '-2 Z or more';
        if (z !== null) {
            if (z < -3) status = 'Less than -3Z';
            else if (z < -2) status = 'Between -3 and -2 Z';
        }
        return { zScore: z?.toFixed(2), status };
    }, [childData]);

    const results = useMemo(() => {
        const cat = {
            danger: { c: [], t: [] }, cough: { c: [], t: [] }, diarrhea: { c: [], t: [] },
            fever: { c: [], t: [] }, ear: { c: [], t: [] }, anemia: { c: [], t: [] }, malnutrition: { c: [], t: [] },
            vaccine: { c: [], t: [] }, other: { c: [], t: [] }, feeding: { c: [], t: [] }
        };

        const weight = parseFloat(childData.weightKg) || 0;
        const age = parseFloat(childData.ageMonths) || 0;
        const muacVal = parseFloat(assessments.muacCm) || 0;
        const temp = parseFloat(childData.tempC) || 0;
        
        const hasDangerSign = assessments.notAbleToDrink || assessments.vomitsEverything || assessments.historyOfConvulsions || assessments.lethargicUnconscious || assessments.convulsingNow;
        if (hasDangerSign) {
            cat.danger.c.push({ label: t('imci.classifications.danger_sign'), color: "bg-red-500" });
            cat.danger.t.push(t('imci.treatments.refer_urgently_hospital'));
            
            let imAbDose = "Ampicillin 1ml & Gentamycin 0.75-1.0ml";
            if (weight >= 4 && weight < 6) imAbDose = "Ampicillin 1ml & Gentamycin 0.75-1.0ml";
            else if (weight >= 6 && weight <= 10) imAbDose = "Ampicillin 2ml & Gentamycin 1.1-1.8ml";
            else if (weight > 10 && weight <= 14) imAbDose = "Ampicillin 3ml & Gentamycin 1.9-2.7ml";
            else if (weight > 14 && weight <= 19) imAbDose = "Ampicillin 5ml & Gentamycin 2.8-3.5ml";
            else if (age >= 2 && age < 4) imAbDose = "Ampicillin 1ml & Gentamycin 0.75-1.0ml";
            else if (age >= 4 && age < 12) imAbDose = "Ampicillin 2ml & Gentamycin 1.1-1.8ml";
            else if (age >= 12 && age < 36) imAbDose = "Ampicillin 3ml & Gentamycin 1.9-2.7ml";
            else if (age >= 36 && age <= 60) imAbDose = "Ampicillin 5ml & Gentamycin 2.8-3.5ml";
            cat.danger.t.push(`${t('imci.treatments.im_antibiotic')}: ${imAbDose}`);

            if (assessments.convulsingNow) {
                let diazepamDose = "10 mg/2 ml: 0.5 ml";
                if (weight >= 5 && weight <= 7) diazepamDose = "10 mg/2 ml: 0.5 ml";
                else if (weight > 7 && weight < 10) diazepamDose = "10 mg/2 ml: 1.0 ml";
                else if (weight >= 10 && weight < 14) diazepamDose = "10 mg/2 ml: 1.5 ml";
                else if (weight >= 14 && weight <= 19) diazepamDose = "10 mg/2 ml: 2.0 ml";
                else if (age >= 2 && age < 6) diazepamDose = "10 mg/2 ml: 0.5 ml";
                else if (age >= 6 && age < 12) diazepamDose = "10 mg/2 ml: 1.0 ml";
                else if (age >= 12 && age < 36) diazepamDose = "10 mg/2 ml: 1.5 ml";
                else if (age >= 36 && age <= 60) diazepamDose = "10 mg/2 ml: 2.0 ml";
                cat.danger.t.push(`${t('imci.treatments.diazepam_rectally')}: ${diazepamDose}`);
            }
        }

        let isZSevere = zScoreResult.status === 'Less than -3Z';
        let isMUACSevere = muacVal > 0 && muacVal < 11.5;
        let isMUACModerate = muacVal >= 11.5 && muacVal < 12.5;
        let hasComplications = hasDangerSign || assessments.chestIndrawing || assessments.medicalComplication || assessments.appetiteTest === 'failed';
        
        const hasOtherSevereClassification = hasDangerSign || 
            (assessments.hasCough && assessments.stridor) || 
            (assessments.hasFever && assessments.neckStiffness) || 
            (assessments.hasFever && (assessments.measlesRash || assessments.measles3Months) && (assessments.corneaClouding || assessments.deepExtensiveUlcers)) ||
            (assessments.hasEarProblem && assessments.tenderSwelling) || 
            (assessments.pallor === 'severePallor') || 
            ((assessments.edema || isZSevere || isMUACSevere) && hasComplications);

        if (assessments.hasCough) {
            let pneumoniaScore = 0;
            if (assessments.chestIndrawing) pneumoniaScore += 1;
            if (assessments.fastBreathing) pneumoniaScore += 1;
            if (assessments.stridor) pneumoniaScore += 4;

            if (hasDangerSign || pneumoniaScore > 3) {
                cat.cough.c.push({ label: t('imci.classifications.severe_pneumonia'), color: "bg-red-500" });
                cat.cough.t.push(<span className="font-bold">{t('imci.treatments.give_first_dose_antibiotic')}</span>);
                cat.cough.t.push(<span className="font-bold">{t('imci.treatments.prevent_low_blood_sugar')}</span>);
                cat.cough.t.push(<span className="font-bold">{t('imci.treatments.refer_urgently_hospital')}</span>);
            } else if (assessments.chestIndrawing || assessments.fastBreathing) {
                cat.cough.c.push({ label: t('imci.classifications.pneumonia'), color: "bg-yellow-400" });
                
                let amoxDose = "Amoxicillin 5 ml or 1 tablet, bid";
                if (weight >= 4 && weight < 10) amoxDose = "Amoxicillin 5 ml or 1 tablet, bid";
                else if (weight >= 10 && weight < 14) amoxDose = "Amoxicillin 10 ml or 2 tablets, bid";
                else if (weight >= 14 && weight <= 19) amoxDose = "Amoxicillin 15 ml or 3 tablets, bid";
                else if (age >= 2 && age < 12) amoxDose = "Amoxicillin 5 ml or 1 tablet, bid";
                else if (age >= 12 && age < 36) amoxDose = "Amoxicillin 10 ml or 2 tablets, bid";
                else if (age >= 36 && age <= 60) amoxDose = "Amoxicillin 15 ml or 3 tablets, bid";
                cat.cough.t.push(<span className="font-bold">{t('imci.treatments.give_appropriate_antibiotics_5days')} : {amoxDose}</span>);
                
                if (assessments.wheeze) {
                    cat.cough.t.push(<span className="font-bold">{t('imci.treatments.wheeze_inhaled_bronchodilator')}</span>);
                }
                
                cat.cough.t.push(t('imci.treatments.soothe_throat_cough'));
                if (parseInt(assessments.coughDays) >= 14) {
                    cat.cough.t.push(t('imci.treatments.cough_14_days_refer'));
                }
                cat.cough.t.push(t('imci.treatments.return_immediately'));
                cat.cough.t.push(<span className="font-bold">{t('imci.treatments.follow_up_3_days')}</span>);
            } else {
                cat.cough.c.push({ label: t('imci.classifications.cough_cold'), color: "bg-green-500" });
                if (parseInt(assessments.coughDays) >= 14) {
                    cat.cough.t.push(t('imci.treatments.cough_14_days_refer'));
                }
                cat.cough.t.push(t('imci.treatments.soothe_throat_cough'));
                if (assessments.wheeze) {
                    cat.cough.t.push(t('imci.treatments.treat_wheezing'));
                }
                cat.cough.t.push(t('imci.treatments.return_immediately'));
                cat.cough.t.push(t('imci.treatments.follow_up_5_days'));
            }
        }

        if (assessments.hasDiarrhea) {
            let severeDehyd = 0, someDehyd = 0;
            if (assessments.lethargic) severeDehyd++;
            if (assessments.restlessIrritable) someDehyd++;
            if (assessments.sunkenEyes) { severeDehyd++; someDehyd++; }
            if (assessments.drinkPoorly) severeDehyd++;
            if (assessments.drinkEagerly) someDehyd++;
            if (assessments.pinchVerySlow) severeDehyd++;
            if (assessments.pinchSlow) someDehyd++;

            let zincDoseText = (age >= 2 && age < 6) ? t('imci.treatments.zinc_10mg') : (age >= 6 ? t('imci.treatments.zinc_20mg') : t('imci.treatments.zinc_greater_2mo'));

            if (severeDehyd >= 2) {
                cat.diarrhea.c.push({ label: t('imci.classifications.severe_dehydration'), color: "bg-red-500" });
                if (!hasOtherSevereClassification) {
                    let vol = weight * 100; let first = weight * 30; let second = weight * 70;
                    cat.diarrhea.t.push(<span className="font-bold">{t('imci.treatments.plan_c')} {weight > 0 ? `: ${vol}ml Ringer's Lactate (First ${first}ml, then ${second}ml)` : ''}</span>);
                } else {
                    cat.diarrhea.t.push(<span className="font-bold italic">{t('imci.treatments.treat_dehydration_before_referral')}</span>);
                    cat.diarrhea.t.push(<span className="font-bold italic">{t('imci.treatments.refer_urgently_hospital')}</span>);
                }
                cat.diarrhea.t.push(<span className="font-bold italic">{t('imci.treatments.continue_breastfeeding')}</span>);
                if (age >= 24) {
                    cat.diarrhea.t.push(<span className="font-bold italic">{t('imci.treatments.cholera_antibiotic')}</span>);
                }
            } else if (someDehyd >= 2) {
                cat.diarrhea.c.push({ label: t('imci.classifications.some_dehydration'), color: "bg-yellow-400" });
                
                let planBDose = "200–400 ml over 4 hrs";
                if (weight > 0) {
                    if (weight < 6) planBDose = "200–400 ml over 4 hrs";
                    else if (weight >= 6 && weight < 10) planBDose = "400–700 ml over 4 hrs";
                    else if (weight >= 10 && weight < 12) planBDose = "700–900 ml over 4 hrs";
                    else if (weight >= 12 && weight <= 19) planBDose = "900–1400 ml over 4 hrs";
                } else {
                    if (age < 4) planBDose = "200–400 ml over 4 hrs";
                    else if (age >= 4 && age < 12) planBDose = "400–700 ml over 4 hrs";
                    else if (age >= 12 && age < 24) planBDose = "700–900 ml over 4 hrs";
                    else if (age >= 24 && age <= 60) planBDose = "900–1400 ml over 4 hrs";
                }
                cat.diarrhea.t.push(`${t('imci.treatments.plan_b')}: ${planBDose}`);
                cat.diarrhea.t.push(zincDoseText);
                if (hasOtherSevereClassification) {
                    cat.diarrhea.t.push(<span className="font-bold italic">{t('imci.treatments.refer_urgently_hospital')}</span>);
                    cat.diarrhea.t.push(<span className="font-bold italic">{t('imci.treatments.continue_breastfeeding')}</span>);
                }
                cat.diarrhea.t.push(t('imci.treatments.return_immediately'));
                cat.diarrhea.t.push(t('imci.treatments.follow_up_5_days'));
            } else {
                cat.diarrhea.c.push({ label: t('imci.classifications.no_dehydration'), color: "bg-green-500" });
                cat.diarrhea.t.push((age < 24) ? t('imci.treatments.plan_a_50_100') : t('imci.treatments.plan_a_100_200'));
                cat.diarrhea.t.push(zincDoseText);
                cat.diarrhea.t.push(t('imci.treatments.return_immediately'));
                cat.diarrhea.t.push(t('imci.treatments.follow_up_5_days'));
            }

            if (assessments.bloodInStool) {
                cat.diarrhea.c.push({ label: t('imci.classifications.dysentery'), color: "bg-yellow-400" });
                let ciproDose = "1/4 tab bid";
                if (weight >= 4 && weight <= 6) ciproDose = "1/4 tab bid";
                else if (weight > 6 && weight <= 10) ciproDose = "1/2 tab bid";
                else if (weight > 10 && weight <= 19) ciproDose = "1 tab bid";
                cat.diarrhea.t.push(<span className="font-bold italic">{t('imci.treatments.cipro_3days')} : {ciproDose}</span>);
                cat.diarrhea.t.push(t('imci.treatments.follow_up_3_days'));
            }

            if (parseInt(assessments.diarrheaDays) >= 14) {
                if (severeDehyd >= 2 || someDehyd >= 2) {
                    cat.diarrhea.c.push({ label: t('imci.classifications.severe_persistent_diarrhea'), color: "bg-red-500" });
                    cat.diarrhea.t.push(<span className="font-bold italic">{t('imci.treatments.treat_dehydration_before_referral')}</span>);
                    cat.diarrhea.t.push(<span className="font-bold italic">{t('imci.treatments.refer_urgently_hospital')}</span>);
                } else {
                    cat.diarrhea.c.push({ label: t('imci.classifications.persistent_diarrhea'), color: "bg-yellow-400" });
                    cat.diarrhea.t.push(t('imci.treatments.advise_feeding_persistent_diarrhea'));
                    
                    let vitADose = "100,000 IU";
                    if (age >= 6 && age < 12) vitADose = "100,000 IU";
                    else if (age >= 12 && age <= 60) vitADose = "200,000 IU";
                    cat.diarrhea.t.push(`${t('imci.treatments.vit_a_dose')}: ${vitADose}`);
                    
                    cat.diarrhea.t.push(t('imci.treatments.follow_up_5_days'));
                }
            }
        }

        if (assessments.hasFever) {
            let vitADose = "100,000 IU";
            if (age >= 6 && age < 12) vitADose = "100,000 IU";
            else if (age >= 12 && age <= 60) vitADose = "200,000 IU";

            let paraDose = "5ml or 1/4 tab every 6h";
            if (weight >= 15 && weight <= 19) paraDose = "10ml or 1/2 tab every 6h";
            else if (age >= 36 && age <= 60) paraDose = "10ml or 1/2 tab every 6h";

            const needsPara = temp >= 38.5;

            if (hasDangerSign || assessments.neckStiffness) {
                cat.fever.c.push({ label: t('imci.classifications.very_severe_febrile'), color: "bg-red-500" });
                
                let quinineDose = "1.0 ml";
                if (weight >= 4 && weight <= 6) quinineDose = "1.0 ml";
                else if (weight > 6 && weight <= 10) quinineDose = "1.5 ml";
                else if (weight > 10 && weight <= 12) quinineDose = "2.0 ml";
                else if (weight > 12 && weight <= 14) quinineDose = "2.5 ml";
                else if (weight > 14 && weight <= 19) quinineDose = "3.0 ml";
                
                cat.fever.t.push(<span className="font-bold italic">{t('imci.treatments.im_quinine')}: {quinineDose}</span>);
                cat.fever.t.push(<span className="font-bold italic">{t('imci.treatments.give_first_dose_antibiotic')}</span>);
                cat.fever.t.push(<span className="font-bold italic">{t('imci.treatments.prevent_low_blood_sugar')}</span>);
                if (needsPara) {
                    cat.fever.t.push(<span className="font-bold italic">{t('imci.treatments.give_paracetamol_high_fever')}: {paraDose}</span>);
                }
                cat.fever.t.push(<span className="font-bold italic">{t('imci.treatments.refer_urgently_hospital')}</span>);
                
            } else if (assessments.malariaTest === 'positive') {
                cat.fever.c.push({ label: t('imci.classifications.malaria'), color: "bg-yellow-400" });
                
                let coartemDose = "1 tab bid x 3d";
                if (weight > 0) {
                    if (weight >= 5 && weight <= 14) coartemDose = "1 tab bid x 3d";
                    else if (weight > 14 && weight <= 24) coartemDose = "2 tabs bid x 3d";
                } else {
                    if (age >= 2 && age <= 36) coartemDose = "1 tab bid x 3d";
                    else if (age > 36 && age <= 60) coartemDose = "2 tabs bid x 3d";
                }
                cat.fever.t.push(<span className="font-bold">{t('imci.treatments.coartem_first_line')}: {coartemDose}</span>);
                cat.fever.t.push(t('imci.treatments.primaquine_vivax'));
                if (needsPara) {
                    cat.fever.t.push(<span className="font-bold">{t('imci.treatments.give_paracetamol_high_fever')}: {paraDose}</span>);
                }
                cat.fever.t.push(t('imci.treatments.return_immediately'));
                cat.fever.t.push(t('imci.treatments.follow_up_fever_3_days'));
                if (assessments.dailyFever7Days) {
                    cat.fever.t.push(t('imci.treatments.fever_7_days_refer'));
                }
                
            } else {
                cat.fever.c.push({ label: t('imci.classifications.fever_no_malaria'), color: "bg-green-500" });
                cat.fever.t.push(t('imci.treatments.assess_other_fever'));
                if (needsPara) {
                    cat.fever.t.push(`${t('imci.treatments.give_paracetamol_high_fever')}: ${paraDose}`);
                }
                if (parseInt(assessments.feverDays) >= 7 || assessments.dailyFever7Days) {
                    cat.fever.t.push(t('imci.treatments.fever_7_days_refer'));
                }
                cat.fever.t.push(t('imci.treatments.return_immediately'));
                cat.fever.t.push(t('imci.treatments.follow_up_fever_3_days'));
            }

            if (assessments.measlesRash || assessments.measles3Months) {
                if (hasDangerSign || assessments.corneaClouding || assessments.deepExtensiveUlcers) {
                    cat.fever.c.push({ label: t('imci.classifications.severe_complicated_measles'), color: "bg-red-500" });
                    cat.fever.t.push(<span className="font-bold italic">{t('imci.treatments.measles_vit_a')}: {vitADose}</span>);
                    cat.fever.t.push(<span className="font-bold italic">{t('imci.treatments.give_first_dose_antibiotic')}</span>);
                    if (assessments.corneaClouding || assessments.pusFromEye) {
                        cat.fever.t.push(<span className="font-bold italic">{t('imci.treatments.tetracycline_eye')}</span>);
                    }
                    cat.fever.t.push(<span className="font-bold italic">{t('imci.treatments.refer_urgently_hospital')}</span>);
                } else if (assessments.pusFromEye || assessments.mouthUlcers) {
                    cat.fever.c.push({ label: t('imci.classifications.measles_eye_mouth'), color: "bg-yellow-400" });
                    cat.fever.t.push(<span className="font-bold">{t('imci.treatments.measles_vit_a')}: {vitADose}</span>);
                    if (assessments.pusFromEye) {
                        cat.fever.t.push(<span className="font-bold">{t('imci.treatments.tetracycline_pus')}</span>);
                    }
                    if (assessments.mouthUlcers) {
                        cat.fever.t.push(<span className="font-bold">{t('imci.treatments.gentian_violet_mouth')}</span>);
                    }
                    cat.fever.t.push(t('imci.treatments.return_immediately'));
                    cat.fever.t.push(<span className="font-bold">{t('imci.treatments.follow_up_3_days')}</span>);
                } else {
                    cat.fever.c.push({ label: t('imci.classifications.measles'), color: "bg-green-500" });
                    cat.fever.t.push(`${t('imci.treatments.measles_vit_a')}: ${vitADose}`);
                    cat.fever.t.push(t('imci.treatments.advise_feed_child'));
                }
            }
        }

        if (assessments.hasEarProblem) {
            let paraDose = "5ml or 1/4 tab every 6h";
            if (weight >= 15 && weight <= 19) paraDose = "10ml or 1/2 tab every 6h";
            else if (age >= 36 && age <= 60) paraDose = "10ml or 1/2 tab every 6h";

            if (assessments.tenderSwelling) {
                cat.ear.c.push({ label: t('imci.classifications.mastoiditis'), color: "bg-red-500" });
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.give_first_dose_antibiotic')}</span>);
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.paracetamol_pain')}: {paraDose}</span>);
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.refer_urgently_hospital')}</span>);
            } else if ((assessments.earDischarge || assessments.pusFromEar) && parseInt(assessments.earDischargeDays || 0) >= 14) {
                cat.ear.c.push({ label: t('imci.classifications.chronic_ear_infection'), color: "bg-yellow-400" });
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.dry_ear_wicking')}</span>);
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.quinolones_ear_drop')}</span>);
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.return_immediately')}</span>);
            } else if (assessments.earPain || ((assessments.earDischarge || assessments.pusFromEar) && parseInt(assessments.earDischargeDays || 0) < 14)) {
                cat.ear.c.push({ label: t('imci.classifications.acute_ear_infection'), color: "bg-yellow-400" });
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.give_appropriate_antibiotics_5days')}</span>);
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.paracetamol_pain')}: {paraDose}</span>);
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.dry_ear_wicking')}</span>);
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.return_immediately')}</span>);
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.follow_up_5_days')}</span>);
            } else {
                cat.ear.c.push({ label: t('imci.classifications.no_ear_infection'), color: "bg-green-500" });
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.no_treatment_advised')}</span>);
                cat.ear.t.push(<span className="font-bold">{t('imci.treatments.refer_hearing_problem')}</span>);
            }
        }

        if (assessments.pallor === 'severePallor') {
            cat.anemia.c.push({ label: t('imci.classifications.severe_anemia'), color: "bg-red-500" });
            cat.anemia.t.push(<span className="font-bold">{t('imci.treatments.refer_urgently_hospital')}</span>);
        } else if (assessments.pallor === 'somePallor') {
            cat.anemia.c.push({ label: t('imci.classifications.anemia'), color: "bg-yellow-400" });
            
            let ironDose = "2ml polymaltose OR 1ml fumarate";
            if (weight >= 4 && weight < 6) ironDose = "2ml polymaltose OR 1ml fumarate";
            else if (weight >= 6 && weight < 10) ironDose = "3.5ml polymaltose OR 1.75ml fumarate";
            else if (weight >= 10 && weight < 14) ironDose = "1/2 tab OR 5ml polymaltose";
            else if (weight >= 14 && weight <= 19) ironDose = "1/2 tab OR 6.5ml polymaltose";
            else if (age >= 2 && age < 4) ironDose = "2ml polymaltose OR 1ml fumarate";
            else if (age >= 4 && age < 12) ironDose = "3.5ml polymaltose OR 1.75ml fumarate";
            else if (age >= 12 && age < 36) ironDose = "1/2 tab OR 5ml polymaltose";
            else if (age >= 36 && age <= 60) ironDose = "1/2 tab OR 6.5ml polymaltose";
            
            cat.anemia.t.push(`${t('imci.treatments.give_iron')} (${ironDose})`);
            cat.anemia.t.push(t('imci.treatments.mebendazole_dose') + ((age >= 12 || (weight >= 10 && weight <= 19)) ? " (100mg bid x 3d)" : ""));
            cat.anemia.t.push(t('imci.treatments.return_immediately'));
            cat.anemia.t.push(t('imci.treatments.follow_up_14_days'));
            
            if (age < 24) {
                cat.anemia.t.push(t('imci.treatments.assess_feeding_less_2yrs'));
            }
        } else {
            cat.anemia.c.push({ label: t('imci.classifications.no_anemia'), color: "bg-green-500" });
            cat.anemia.t.push(t('imci.treatments.no_additional_treatment'));
            if (age < 24) {
                cat.anemia.t.push(t('imci.treatments.assess_feeding_less_2yrs'));
            }
        }

        if (assessments.edema || isZSevere || isMUACSevere) {
            if (hasComplications) {
                cat.malnutrition.c.push({ label: t('imci.classifications.complicated_sam'), color: "bg-red-500" });
                cat.malnutrition.t.push(<span className="font-bold">{t('imci.treatments.give_first_dose_antibiotic')}</span>);
                cat.malnutrition.t.push(<span className="font-bold">{t('imci.treatments.prevent_low_blood_sugar')}</span>);
                cat.malnutrition.t.push(<span className="font-bold">{t('imci.treatments.keep_child_warm')}</span>);
                cat.malnutrition.t.push(<span className="font-bold">{t('imci.treatments.refer_urgently_hospital')}</span>);
            } else {
                cat.malnutrition.c.push({ label: t('imci.classifications.uncomplicated_sam'), color: "bg-yellow-400" });
                cat.malnutrition.t.push(<span className="font-bold italic">{t('imci.treatments.give_appropriate_antibiotics_5days')}</span>);
                cat.malnutrition.t.push(t('imci.treatments.refer_otp_rutf'));
                cat.malnutrition.t.push(t('imci.treatments.counsel_feed_child'));
                cat.malnutrition.t.push(t('imci.treatments.return_immediately'));
                cat.malnutrition.t.push(t('imci.treatments.follow_up_14_days'));
            }
        } else if (zScoreResult.status === 'Between -3 and -2 Z' || isMUACModerate) {
            cat.malnutrition.c.push({ label: t('imci.classifications.mam'), color: "bg-yellow-400" });
            cat.malnutrition.t.push(t('imci.treatments.refer_supplementary_feeding'));
            cat.malnutrition.t.push(t('imci.treatments.assess_feeding_growth_monitoring'));
            cat.malnutrition.t.push(t('imci.treatments.follow_up_feeding_7_days'));
            cat.malnutrition.t.push(t('imci.treatments.return_immediately'));
            cat.malnutrition.t.push(t('imci.treatments.follow_up_30_days'));
        } else { 
            cat.malnutrition.c.push({ label: t('imci.classifications.no_malnutrition'), color: "bg-green-500" });
            if (age < 24) {
                cat.malnutrition.t.push(t('imci.treatments.assess_feeding_less_2yrs'));
            }
            cat.malnutrition.t.push(t('imci.treatments.follow_up_feeding_7_days'));
        }

        let expectedVaccines = [];
        if (age >= 0) expectedVaccines.push('v_opv0', 'v_bcg');
        if (age >= 1.5) expectedVaccines.push('v_opv1', 'v_rota1', 'v_pcv1', 'v_penta1', 'v_ipv1');
        if (age >= 2.5) expectedVaccines.push('v_opv2', 'v_rota2', 'v_pcv2', 'v_penta2');
        if (age >= 3.5) expectedVaccines.push('v_opv3', 'v_rota3', 'v_pcv3', 'v_penta3', 'v_ipv2');
        if (age >= 9) expectedVaccines.push('v_mr', 'v_yellowFever', 'v_menA');
        if (age >= 18) expectedVaccines.push('v_mrBooster');

        let receivedExpected = expectedVaccines.filter(v => assessments[v]).length;
        let totalExpected = expectedVaccines.length;

        let autoVaccineStatus = 'not';
        if (totalExpected > 0) {
            if (receivedExpected === totalExpected) autoVaccineStatus = 'fully';
            else if (receivedExpected > 0) autoVaccineStatus = 'partially';
        }

        if (autoVaccineStatus === 'fully') {
            cat.vaccine.c.push({ label: t('imci.classifications.fully_vaccinated'), color: "bg-green-500" });
        } else if (autoVaccineStatus === 'partially') {
            cat.vaccine.c.push({ label: t('imci.classifications.partially_vaccinated'), color: "bg-yellow-500" });
        } else {
            cat.vaccine.c.push({ label: t('imci.classifications.not_vaccinated'), color: "bg-red-500" });
        }
        
        cat.vaccine.t.push(
            <div key="next-vax" className="flex flex-col gap-1 w-full mt-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{t('imci.common_phrases.next_vaccine')}</span>
                <input type="date" name="nextVaccine" value={assessments.nextVaccine} onChange={(e) => setAssessments(prev => ({...prev, nextVaccine: e.target.value}))} className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded shadow-sm focus:ring-sky-500"/>
            </div>
        );
        cat.vaccine.t.push(
            <div key="next-vita" className="flex flex-col gap-1 w-full mt-2 mb-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{t('imci.common_phrases.next_vit_a')}</span>
                <input type="date" name="nextVitaminA" value={assessments.nextVitaminA} onChange={(e) => setAssessments(prev => ({...prev, nextVitaminA: e.target.value}))} className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded shadow-sm focus:ring-sky-500"/>
            </div>
        );

        if (assessments.hasOtherProblems) {
            cat.other.c.push({ label: t('imci.classifications.other_problem_noted'), color: "bg-slate-500" });
            if (assessments.otherProblemsText.trim() !== '') {
                cat.other.t.push(`${t('imci.common_phrases.note')} ${assessments.otherProblemsText}`);
            } else {
                cat.other.t.push(t('imci.common_phrases.treatment_needed_other'));
            }
        }

        if (assessments.feedingStatus === 'problem') {
            cat.feeding.c.push({ label: t('imci.classifications.feeding_problem'), color: "bg-yellow-500" });
            cat.feeding.t.push(t('imci.treatments.counsel_feeding_mother_card'));
        } else if (assessments.feedingStatus === 'noProblem') {
            cat.feeding.c.push({ label: t('imci.classifications.no_feeding_problem'), color: "bg-green-500" });
            cat.feeding.t.push(t('imci.treatments.praise_mother_feeding'));
        }

        Object.keys(cat).forEach(k => { 
            cat[k].t = cat[k].t.filter((val, index, self) => 
                index === self.findIndex((tObj) => (
                    tObj === val || 
                    (tObj.props && val.props && tObj.props.children === val.props.children)
                ))
            );
        });

        return cat;
    }, [childData, assessments, zScoreResult, t]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <Card>
                <div className="bg-slate-800 text-white p-3 rounded-t-md font-bold text-center uppercase tracking-wide shadow-sm">
                    {t('imci.child_title')}
                </div>
                <div className="p-5 space-y-5 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div className="space-y-1 lg:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><UserSquare2 size={14}/> {t('imci.common.child_name')}</label>
                            <input type="text" name="childName" value={childData.childName} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.child_name')} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> {t('imci.common.date')}</label>
                            <input type="date" name="date" value={childData.date} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><User size={14}/> {t('imci.common.sex')}</label>
                            <select name="sex" value={childData.sex} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white">
                                <option value="male">{t('imci.common.male')}</option>
                                <option value="female">{t('imci.common.female')}</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> {t('imci.common.age_months')}</label>
                            <input type="number" name="ageMonths" value={childData.ageMonths} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.age_months')} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Weight size={14}/> {t('imci.common.weight')}</label>
                            <input type="number" step="0.1" name="weightKg" value={childData.weightKg} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.weight')} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Ruler size={14}/> {t('imci.common.length')}</label>
                            <input type="number" step="0.5" name="lengthCm" value={childData.lengthCm} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.length')} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Thermometer size={14}/> {t('imci.common.temp')}</label>
                            <input type="number" step="0.1" name="tempC" value={childData.tempC} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.temp')} />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 border-t border-slate-200 pt-4">
                        <div className="lg:col-span-2 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">{t('imci.common.ask_problems')}</label>
                            <input type="text" name="problems" value={childData.problems} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder={t('imci.placeholders.problems')} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">{t('imci.common.visit_type')}</label>
                            <div className="flex gap-4 p-2 bg-white rounded-md border border-slate-200 shadow-sm items-center h-[42px]">
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="initial" checked={childData.visitType === 'initial'} onChange={handleChildDataChange} className="text-sky-600"/> {t('imci.common.initial_visit')}</label>
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="followup" checked={childData.visitType === 'followup'} onChange={handleChildDataChange} className="text-sky-600"/> {t('imci.common.follow_up')}</label>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="border border-slate-300 rounded-md overflow-hidden shadow-sm">
                
                <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-800 font-bold text-sm text-center text-white border-b border-slate-300 hidden lg:grid">
                    <div className="lg:col-span-7 p-3 border-r border-slate-600">{t('imci.common.ask_look')}</div>
                    <div className="lg:col-span-2 p-3 border-r border-slate-600">{t('imci.common.classify')}</div>
                    <div className="lg:col-span-3 p-3">{t('imci.common.identify_treatment')}</div>
                </div>

                {/* Row 1: Danger Signs */}
                <AssessmentRow 
                    title={<span className="text-red-700 font-bold flex items-center gap-2"><AlertCircle size={16}/> {t('imci.child.danger_signs')}</span>}
                    isConditional={false}
                    classifyData={results.danger.c} treatmentData={results.danger.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="notAbleToDrink" checked={assessments.notAbleToDrink} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.not_able_drink')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="lethargicUnconscious" checked={assessments.lethargicUnconscious} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.lethargic_unconscious')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="vomitsEverything" checked={assessments.vomitsEverything} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.vomits_everything')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="convulsingNow" checked={assessments.convulsingNow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.convulsing_now')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="historyOfConvulsions" checked={assessments.historyOfConvulsions} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>{t('imci.child.history_convulsions')}</span></label>
                    </div>
                </AssessmentRow>

                {/* Row 2: Cough */}
                <AssessmentRow 
                    title={t('imci.child.cough_title')}
                    isConditional={true}
                    yesNoValue={assessments.hasCough} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasCough: val}))}
                    classifyData={results.cough.c} treatmentData={results.cough.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-3 rounded">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t('imci.common.duration')}</span>
                            <input type="number" name="coughDays" value={assessments.coughDays} onChange={(e) => setAssessments(p => ({...p, coughDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                            <span className="text-sm font-medium">{t('imci.common.days')}</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{t('imci.child.breath_rate')}</span>
                                <input type="number" name="breathRate" value={assessments.breathRate} onChange={(e) => setAssessments(p => ({...p, breathRate: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm">{t('imci.child.breath_per_min')}</span>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="fastBreathing" checked={assessments.fastBreathing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.fast_breathing')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="chestIndrawing" checked={assessments.chestIndrawing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.chest_indrawing')}</span></label>
                            <div className="flex items-center gap-4 text-sm pt-1 border-t border-slate-200 mt-2">
                                <span className="font-medium">{t('imci.child.look_listen')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="stridor" checked={assessments.stridor} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.stridor')}</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="wheeze" checked={assessments.wheeze} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.wheeze')}</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 3: Diarrhea */}
                <AssessmentRow 
                    title={t('imci.child.diarrhea_title')}
                    isConditional={true}
                    yesNoValue={assessments.hasDiarrhea} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasDiarrhea: val}))}
                    classifyData={results.diarrhea.c} treatmentData={results.diarrhea.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-3 rounded">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{t('imci.common.duration')}</span>
                                <input type="number" name="diarrheaDays" value={assessments.diarrheaDays} onChange={(e) => setAssessments(p => ({...p, diarrheaDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm font-medium">{t('imci.common.days')}</span>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="bloodInStool" checked={assessments.bloodInStool} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.blood_in_stool')}</span></label>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <span className="font-medium">{t('imci.infant.general_condition')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="lethargic" checked={assessments.lethargic} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.lethargic')}</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="restlessIrritable" checked={assessments.restlessIrritable} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.restless_irritable')}</span></label>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="sunkenEyes" checked={assessments.sunkenEyes} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.sunken_eyes')}</span></label>
                            <div className="flex items-center gap-3 text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium">{t('imci.child.offer_drink')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="drinkPoorly" checked={assessments.drinkPoorly} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.drink_poorly')}</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="drinkEagerly" checked={assessments.drinkEagerly} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.drink_eagerly')}</span></label>
                            </div>
                            <div className="flex items-center gap-3 text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium">{t('imci.infant.skin_pinch')}</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchVerySlow" checked={assessments.pinchVerySlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.very_slowly')}</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchSlow" checked={assessments.pinchSlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.infant.slowly')}</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 4: Fever */}
                <AssessmentRow 
                    title={<span>{t('imci.child.fever_title')}</span>}
                    isConditional={true}
                    yesNoValue={assessments.hasFever} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasFever: val}))}
                    classifyData={results.fever.c} treatmentData={results.fever.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 mb-4 bg-slate-50 p-3 rounded">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{t('imci.common.duration')}</span>
                                <input type="number" name="feverDays" value={assessments.feverDays} onChange={(e) => setAssessments(p => ({...p, feverDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm font-medium">{t('imci.common.days')}</span>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="dailyFever7Days" checked={assessments.dailyFever7Days} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.daily_fever_7')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="measles3Months" checked={assessments.measles3Months} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.measles_3m')}</span></label>
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="neckStiffness" checked={assessments.neckStiffness} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.neck_stiffness')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="measlesRash" checked={assessments.measlesRash} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.measles_rash')}</span></label>
                            <div className="text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium mr-2">{t('imci.child.malaria_test')}</span><span className="text-xs text-slate-500">{t('imci.child.if_no_danger')}</span>
                                <div className="flex gap-4 mt-2 ml-2">
                                    <label className="flex items-center space-x-1 text-sm cursor-pointer"><input type="radio" name="malariaTest" value="positive" checked={assessments.malariaTest==='positive'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.positive')}</span></label>
                                    <label className="flex items-center space-x-1 text-sm cursor-pointer"><input type="radio" name="malariaTest" value="negative" checked={assessments.malariaTest==='negative'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.negative')}</span></label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Measles Sub-section */}
                    <div className="border border-amber-200 bg-amber-50 p-3 rounded-md grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="text-sm font-bold text-amber-800 col-span-full">{t('imci.child.if_measles')}</div>
                        <div className="space-y-2">
                            <div className="flex flex-col gap-2 text-sm">
                                <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="mouthUlcers" checked={assessments.mouthUlcers} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>{t('imci.child.mouth_ulcers')}</span></label>
                                {assessments.mouthUlcers && <label className="flex items-center space-x-2 ml-6 cursor-pointer"><input type="checkbox" name="deepExtensiveUlcers" checked={assessments.deepExtensiveUlcers} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>{t('imci.child.deep_ulcers')}</span></label>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="pusFromEye" checked={assessments.pusFromEye} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>{t('imci.child.pus_eye')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="corneaClouding" checked={assessments.corneaClouding} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>{t('imci.child.cornea')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 5: Ear */}
                <AssessmentRow 
                    title={t('imci.child.ear_title')}
                    isConditional={true}
                    yesNoValue={assessments.hasEarProblem} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasEarProblem: val}))}
                    classifyData={results.ear.c} treatmentData={results.ear.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-3 rounded">
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="earPain" checked={assessments.earPain} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.ear_pain')}</span></label>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="earDischarge" checked={assessments.earDischarge} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.ear_discharge')}</span></label>
                                <input type="number" name="earDischargeDays" value={assessments.earDischargeDays} onChange={(e) => setAssessments(p => ({...p, earDischargeDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm">{t('imci.common.days')}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="tenderSwelling" checked={assessments.tenderSwelling} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.tender_swelling')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="pusFromEar" checked={assessments.pusFromEar} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.pus_ear')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 6: Anemia */}
                <AssessmentRow 
                    title={t('imci.child.anemia_title')}
                    isConditional={false}
                    classifyData={results.anemia.c} treatmentData={results.anemia.t}
                >
                    <div className="flex flex-wrap gap-6 mt-2">
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="pallor" value="severePallor" checked={assessments.pallor==='severePallor'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.severe_pallor')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="pallor" value="somePallor" checked={assessments.pallor==='somePallor'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.some_pallor')}</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="pallor" value="noPallor" checked={assessments.pallor==='noPallor'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.no_pallor')}</span></label>
                    </div>
                </AssessmentRow>

                {/* Row 7: Malnutrition */}
                <AssessmentRow 
                    title={t('imci.child.malnutrition_title')}
                    isConditional={false}
                    classifyData={results.malnutrition.c} treatmentData={results.malnutrition.t}
                >
                    <div className="space-y-4 mt-2">
                        <label className="flex items-center space-x-2 text-sm font-semibold text-slate-800 cursor-pointer"><input type="checkbox" name="edema" checked={assessments.edema} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.edema')}</span></label>
                        
                        <div className="text-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50 p-2 rounded">
                            <span className="font-bold min-w-[70px]">{t('imci.child.z_score')}</span>
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center space-x-1"><input type="radio" readOnly checked={zScoreResult.status === 'Less than -3Z'} className="text-slate-400 w-4 h-4" /><span className={zScoreResult.status === 'Less than -3Z' ? 'font-bold text-red-600' : ''}>{t('imci.child.less_3z')}</span></label>
                                <label className="flex items-center space-x-1"><input type="radio" readOnly checked={zScoreResult.status === 'Between -3 and -2 Z'} className="text-slate-400 w-4 h-4" /><span className={zScoreResult.status === 'Between -3 and -2 Z' ? 'font-bold text-yellow-600' : ''}>{t('imci.child.between_3_2')}</span></label>
                                <label className="flex items-center space-x-1"><input type="radio" readOnly checked={zScoreResult.status === '-2 Z or more'} className="text-slate-400 w-4 h-4" /><span className={zScoreResult.status === '-2 Z or more' ? 'font-bold text-green-600' : ''}>{t('imci.child.more_2z')}</span></label>
                            </div>
                        </div>

                        <div className="text-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50 p-2 rounded">
                            <span className="font-bold min-w-[70px]">{t('imci.child.muac')}</span>
                            <div className="flex flex-wrap gap-4 items-center">
                                <input type="number" step="0.1" name="muacCm" placeholder="cm" value={assessments.muacCm} onChange={(e) => setAssessments(prev => ({...prev, muacCm: e.target.value}))} className="w-24 rounded-md border-slate-300 sm:text-sm p-1.5" />
                                <span className="text-xs text-slate-500">{t('imci.child.enter_muac')}</span>
                            </div>
                        </div>

                        <div className="border border-sky-100 bg-sky-50 p-3 rounded-md">
                            <div className="text-sm font-bold mb-2 text-slate-700">{t('imci.child.if_z_muac')}</div>
                            <label className="flex items-center space-x-2 text-sm mb-3 cursor-pointer"><input type="checkbox" name="medicalComplication" checked={assessments.medicalComplication} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.med_comp')}</span></label>
                            
                            <div className="text-sm font-bold mt-3 mb-2 text-slate-700 border-t border-sky-200 pt-2">{t('imci.child.appetite_test')}</div>
                            <div className="flex gap-6">
                                <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="appetiteTest" value="passed" checked={assessments.appetiteTest==='passed'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.passed')}</span></label>
                                <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="appetiteTest" value="failed" checked={assessments.appetiteTest==='failed'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.failed')}</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 8: Vaccination & Vit A EXACT Replica */}
                <AssessmentRow 
                    title={<span>{t('imci.child.vaccine_title')} <span className="font-normal text-xs text-slate-500 block sm:inline sm:ml-2">{t('imci.infant.check_given')}</span></span>}
                    isConditional={false}
                    classifyData={results.vaccine.c} treatmentData={results.vaccine.t}
                >
                    <div className="flex flex-col gap-4 mt-2">
                        <div className="overflow-x-auto border border-slate-300 rounded-md">
                            <table className="w-full text-xs text-left border-collapse min-w-[500px]">
                                <tbody>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100 w-24">{t('imci.infant.at_birth')}</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv0" checked={assessments.v_opv0} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.opv0')}</label></td>
                                        <td className="p-2" colSpan={4}><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_bcg" checked={assessments.v_bcg} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.bcg')}</label></td>
                                    </tr>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">{t('imci.infant.weeks_6')}</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv1" checked={assessments.v_opv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.opv1')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_rota1" checked={assessments.v_rota1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.rota1')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_pcv1" checked={assessments.v_pcv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.pcv1')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_penta1" checked={assessments.v_penta1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.penta1')}</label></td>
                                        <td className="p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_ipv1" checked={assessments.v_ipv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.ipv1')}</label></td>
                                    </tr>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">{t('imci.vaccines.w10')}</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv2" checked={assessments.v_opv2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.opv2')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_rota2" checked={assessments.v_rota2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.rota2')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_pcv2" checked={assessments.v_pcv2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.pcv2')}</label></td>
                                        <td className="p-2" colSpan={2}><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_penta2" checked={assessments.v_penta2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.penta2')}</label></td>
                                    </tr>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">{t('imci.vaccines.w14')}</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv3" checked={assessments.v_opv3} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.opv3')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_rota3" checked={assessments.v_rota3} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.rota3')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_pcv3" checked={assessments.v_pcv3} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.pcv3')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_penta3" checked={assessments.v_penta3} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.penta3')}</label></td>
                                        <td className="p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_ipv2" checked={assessments.v_ipv2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.ipv2')}</label></td>
                                    </tr>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">{t('imci.vaccines.m9')}</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_mr" checked={assessments.v_mr} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.mr')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_yellowFever" checked={assessments.v_yellowFever} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.yellowFever')}</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_menA" checked={assessments.v_menA} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.menA')}</label></td>
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100 text-center">{t('imci.vaccines.m18')}</td>
                                        <td className="p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_mrBooster" checked={assessments.v_mrBooster} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.mrBooster')}</label></td>
                                    </tr>
                                    <tr>
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">Vitamin A</td>
                                        <td className="p-2" colSpan={5}><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_vitaminA" checked={assessments.v_vitaminA} onChange={handleCheckboxChange} className="rounded text-sky-600"/> {t('imci.vaccines.vitA')}</label></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 9: Any other problems */}
                <AssessmentRow 
                    title={t('imci.infant.any_other_problems')}
                    isConditional={true}
                    yesNoValue={assessments.hasOtherProblems} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasOtherProblems: val}))}
                    classifyData={results.other.c} treatmentData={results.other.t}
                >
                    <textarea name="otherProblemsText" value={assessments.otherProblemsText} onChange={(e) => setAssessments(prev=>({...prev, otherProblemsText: e.target.value}))} rows={2} className="block w-full rounded-md border-slate-300 shadow-sm focus:ring-sky-500 sm:text-sm mt-2 p-3" placeholder={t('imci.placeholders.other_problems')}></textarea>
                </AssessmentRow>

                {/* Row 10: Mother card feeding */}
                <AssessmentRow 
                    title={t('imci.child.feeding_title')}
                    isConditional={false}
                    classifyData={results.feeding.c} treatmentData={results.feeding.t}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3">
                            <span className="text-sm font-bold text-slate-700 block border-b border-slate-200 pb-2 mb-3">{t('imci.child.check_applicable')}</span>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="feed_ageLess2" checked={assessments.feed_ageLess2} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.age_less_2')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="feed_hadMAM" checked={assessments.feed_hadMAM} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.had_mam')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="feed_hadAnemia" checked={assessments.feed_hadAnemia} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>{t('imci.child.had_anemia')}</span></label>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3 flex flex-col justify-center">
                            <span className="text-sm font-bold text-slate-700 block border-b border-slate-200 pb-2 mb-3">{t('imci.child.feeding_status')}</span>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="feedingStatus" value="problem" checked={assessments.feedingStatus==='problem'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.feeding_problem_btn')}</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="feedingStatus" value="noProblem" checked={assessments.feedingStatus==='noProblem'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>{t('imci.child.no_feeding_problem_btn')}</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Footer: Follow up */}
                <div className="p-5 bg-slate-800 text-white flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
                    <span className="font-bold tracking-wide uppercase">{t('imci.common.return_follow_up')}</span>
                    <div className="flex gap-5 font-semibold">
                        {[3, 5, 7, 14, 30].map(days => (
                            <label key={days} className="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="followUpDays" value={days} checked={assessments.followUpDays===String(days)} onChange={handleRadioChange} className="text-sky-400 focus:ring-sky-400 cursor-pointer w-4 h-4" /><span>{days} {t('imci.common.days')}</span></label>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end pb-8">
                <Button variant="primary" className="w-full md:w-auto py-3.5 shadow-lg px-12 text-lg font-bold"><ClipboardList className="w-5 h-5 mr-2 inline-block"/> {t('imci.common.save_child')}</Button>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN WRAPPER COMPONENT
// ============================================================================
export default function IMNCIRecordingForm() {
    const { t } = useTranslation();
    const [activeForm, setActiveForm] = useState('child');

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <PageHeader title={t('imci.form_title')} subtitle={t('imci.common.select_age_group')} />
            
            {/* Age Group Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-2 rounded-lg shadow-sm border border-slate-200 w-fit mx-auto lg:mx-0">
                <button 
                    onClick={() => setActiveForm('infant')} 
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-semibold transition-all duration-200 ${activeForm === 'infant' ? 'bg-sky-600 text-white shadow-md scale-105' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <Baby size={20} />
                    {t('imci.common.infant_button')}
                </button>
                <button 
                    onClick={() => setActiveForm('child')} 
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-semibold transition-all duration-200 ${activeForm === 'child' ? 'bg-sky-600 text-white shadow-md scale-105' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <User size={20} />
                    {t('imci.common.child_button')}
                </button>
            </div>

            {/* Render Form based on Selection */}
            {activeForm === 'infant' ? <InfantForm /> : <ChildForm />}
        </div>
    );
}