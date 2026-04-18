import React, { useState, useMemo } from 'react';
import { Card, PageHeader, Button } from './CommonComponents'; 
import { AlertCircle, Baby, User, ClipboardList, CheckSquare, CalendarDays, UserSquare2, Ruler, Weight, Thermometer } from 'lucide-react';
import zScoreData from './zscore_reference_data.json'; 

// --- Reusable Grid Row Component for IMNCI Layout ---
const AssessmentRow = ({ title, isConditional = false, yesNoValue, onYesNoChange, children, classifyData = [], treatmentData = [] }) => {
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
                                <span className="text-sm font-bold text-slate-700">Yes</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" checked={yesNoValue === false} onChange={() => onYesNoChange(false)} className="w-4 h-4 text-slate-400 focus:ring-slate-400 cursor-pointer" />
                                <span className="text-sm font-bold text-slate-700">No</span>
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
                        {treatmentData.map((t, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-800 items-start">
                                <CheckSquare size={16} className="text-sky-600 mt-0.5 flex-shrink-0" />
                                <div className="w-full">{t}</div>
                            </li>
                        ))}
                    </ul>
                ) : isActive ? (
                    <span className="text-sm text-slate-400 italic">No treatments identified</span>
                ) : null}
            </div>
        </div>
    );
};

// ============================================================================
// FORM 1: SICK YOUNG INFANT (UP TO 2 MONTHS)
// ============================================================================
function InfantForm() {
    const [infantData, setInfantData] = useState({
        date: new Date().toISOString().split('T')[0], childName: '', ageDaysWeeks: '', weightKg: '', tempC: '',
        problems: '', visitType: 'initial'
    });

    const [assessments, setAssessments] = useState({
        // Severe Disease
        notFeedingWell: false, convulsions: false, convulsingNow: false, movementOnlyStimulatedNoMovement: false,
        breathRate: '', fastBreathing: false, severeChestIndrawing: false, fever38: false, lowTemp35_5: false,
        umbilicusRedDraining: false, pusFromEyes: false, skinPustules: false,
        // Jaundice
        hasJaundice: null, jaundiceFirst24h: false, jaundiceLowWeight: false, jaundiceSolesPalms: false,
        // Diarrhoea
        hasDiarrhea: null, diarrheaDays: '', bloodInStool: false, diarrheaMovement: false, diarrheaRestless: false,
        diarrheaSunkenEyes: false, pinchVerySlow: false, pinchSlow: false,
        // Feeding
        diffFeeding: null, breastfed: null, breastfeedTimes: '', otherFoods: null, otherFoodsOften: '', feedTool: '',
        weightForAgeLow: false, thrush: false,
        // Breastfeeding
        wellPositioned: null, posInLine: null, posNoseOpposite: null, posCloseBody: null, posWholeBodySupported: null,
        goodAttachment: null, attChinTouching: null, attMouthWide: null, attLowerLipOut: null, attAreolaAbove: null,
        suckingEffectively: null,
        // Vaccine
        v_opv0: false, v_bcg: false, v_opv1: false, v_rota1: false, v_pcv1: false, v_penta1: false, v_ipv1: false,
        vaccineStatus: '', nextVaccine: '',
        // Other
        hasOtherProblems: null, otherProblemsText: '',
        followUpDays: ''
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

        // 1. Severe Disease / Local Infection
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
            cat.infection.c.push({ label: "POSSIBLE SEVERE BACTERIAL INFECTION", color: "bg-red-500" });
            cat.infection.t.push("Refer urgently");
            cat.infection.t.push("IM antibiotic");
            cat.infection.t.push("prevent low blood sugar");
            cat.infection.t.push("advice to keep infant warm");
        } else if (assessments.umbilicusRedDraining || assessments.skinPustules || assessments.pusFromEyes) {
            cat.infection.c.push({ label: "LOCAL BACTERIAL INFECTION", color: "bg-yellow-400" });
            cat.infection.t.push("oral antibiotic");
            cat.infection.t.push("treat local infection");
            cat.infection.t.push("home care for young infant");
        }

        // 2. Jaundice
        if (assessments.hasJaundice) {
            if (assessments.jaundiceFirst24h || assessments.jaundiceLowWeight || assessments.jaundiceSolesPalms) {
                cat.jaundice.c.push({ label: "SEVERE JAUNDICE", color: "bg-red-500" });
                cat.jaundice.t.push("Refer urgently");
            } else {
                cat.jaundice.c.push({ label: "JAUNDICE", color: "bg-yellow-400" });
                cat.jaundice.t.push("home care for young infant");
            }
        }

        // 3. Diarrhea
        if (assessments.hasDiarrhea) {
            let severeDehyd = 0, someDehyd = 0;
            if (assessments.diarrheaMovement) severeDehyd++;
            if (assessments.diarrheaRestless) someDehyd++;
            if (assessments.diarrheaSunkenEyes) { severeDehyd++; someDehyd++; }
            if (assessments.pinchVerySlow) severeDehyd++;
            if (assessments.pinchSlow) someDehyd++;

            if (severeDehyd >= 2) {
                cat.diarrhea.c.push({ label: "SEVERE DEHYDRATION", color: "bg-red-500" });
                cat.diarrhea.t.push("Refer urgently");
                cat.diarrhea.t.push("IV fluids");
            } else if (someDehyd >= 2) {
                cat.diarrhea.c.push({ label: "SOME DEHYDRATION", color: "bg-yellow-400" });
                cat.diarrhea.t.push("ORS");
                cat.diarrhea.t.push("home care for young infant");
            } else {
                cat.diarrhea.c.push({ label: "NO DEHYDRATION", color: "bg-green-500" });
                cat.diarrhea.t.push("home care for young infant");
            }
        }

        // 4. Feeding Problem
        const hasFeedingProblem = assessments.diffFeeding === 'yes' || parseInt(assessments.breastfeedTimes || 8) < 8 || assessments.otherFoods === 'yes' || assessments.weightForAgeLow || assessments.thrush;
        if (hasFeedingProblem) {
            cat.feeding.c.push({ label: "FEEDING PROBLEM OR LOW WEIGHT", color: "bg-yellow-400" });
            if (assessments.thrush) cat.feeding.t.push("treat thrush");
            cat.feeding.t.push("council on breast feeding");
            cat.feeding.t.push("home care for young infant");
        } else {
            cat.feeding.c.push({ label: "NO FEEDING PROBLEM", color: "bg-green-500" });
        }

        // 5. Breastfeeding
        if (assessments.wellPositioned === 'notWell') cat.breast.t.push("teach correct Position");
        if (assessments.goodAttachment === 'notWell' || assessments.suckingEffectively === 'notEffective') cat.breast.t.push("teach correct attachment");

        // 6. Vaccines - Automated
        let vBirth = assessments.v_opv0 && assessments.v_bcg;
        let v6Weeks = assessments.v_opv1 && assessments.v_rota1 && assessments.v_pcv1 && assessments.v_penta1 && assessments.v_ipv1;
        let hasAny = assessments.v_opv0 || assessments.v_bcg || assessments.v_opv1 || assessments.v_rota1 || assessments.v_pcv1 || assessments.v_penta1 || assessments.v_ipv1;

        if (assessments.vaccineStatus === 'fully' || (vBirth && v6Weeks)) {
            cat.vaccine.c.push({ label: "FULLY VACCINATED", color: "bg-green-500" });
        } else if (assessments.vaccineStatus === 'partially' || hasAny) {
            cat.vaccine.c.push({ label: "PARTIAL VACCINATED", color: "bg-yellow-500" });
        } else if (assessments.vaccineStatus === 'not' || !hasAny) {
            cat.vaccine.c.push({ label: "NOT VACCINATED", color: "bg-red-500" });
        }

        if (assessments.nextVaccine) cat.vaccine.t.push(`Next vaccine dose: ${assessments.nextVaccine}`);

        // 7. Other Problems
        if (assessments.hasOtherProblems && assessments.otherProblemsText.trim() !== '') {
            cat.other.c.push({ label: "OTHER PROBLEM NOTED", color: "bg-slate-500" });
            cat.other.t.push(`Note: ${assessments.otherProblemsText}`);
        }

        // Deduplicate treatments
        Object.keys(cat).forEach(k => { cat[k].t = [...new Set(cat[k].t)]; });

        return cat;
    }, [infantData, assessments]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Information */}
            <Card>
                <div className="bg-slate-800 text-white p-3 rounded-t-md font-bold text-center uppercase tracking-wide shadow-sm">
                    Management of the sick young infant up to 2 months
                </div>
                <div className="p-5 space-y-5 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                        <div className="space-y-1 lg:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><UserSquare2 size={14}/> Child Name</label>
                            <input type="text" name="childName" value={infantData.childName} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="Enter child's name" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> Date</label>
                            <input type="date" name="date" value={infantData.date} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> Age (Days-Weeks)</label>
                            <input type="text" name="ageDaysWeeks" value={infantData.ageDaysWeeks} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="e.g. 3 weeks" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Weight size={14}/> Weight (kg)</label>
                            <input type="number" step="0.1" name="weightKg" value={infantData.weightKg} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="e.g. 4.2" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Thermometer size={14}/> Temp (°C)</label>
                            <input type="number" step="0.1" name="tempC" value={infantData.tempC} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="e.g. 37.1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 border-t border-slate-200 pt-4">
                        <div className="lg:col-span-2 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Ask: What are the child problems?</label>
                            <input type="text" name="problems" value={infantData.problems} onChange={handleDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="Briefly describe..." />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Visit Type</label>
                            <div className="flex gap-4 p-2 bg-white rounded-md border border-slate-200 shadow-sm items-center h-[42px]">
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="initial" checked={infantData.visitType === 'initial'} onChange={handleDataChange} className="text-sky-600"/> Initial Visit</label>
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="followup" checked={infantData.visitType === 'followup'} onChange={handleDataChange} className="text-sky-600"/> Follow up</label>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Assessment Grid */}
            <div className="border border-slate-300 rounded-md overflow-hidden shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-800 font-bold text-sm text-center text-white border-b border-slate-300 hidden lg:grid">
                    <div className="lg:col-span-7 p-3 border-r border-slate-600">Ask & Look</div>
                    <div className="lg:col-span-2 p-3 border-r border-slate-600">Classify</div>
                    <div className="lg:col-span-3 p-3">Identify Treatment</div>
                </div>

                {/* 1. SEVERE DISEASE */}
                <AssessmentRow 
                    title={<span className="text-slate-800 font-bold flex items-center gap-2">CHECK FOR SEVERE DISEASE AND LOCAL BACTERIAL INFECTION</span>}
                    active={true} classifyData={results.infection.c} treatmentData={results.infection.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 uppercase border-b pb-1 mb-2">Ask</h4>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="notFeedingWell" checked={assessments.notFeedingWell} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>is the infant having difficulty in feeding or not feeding well?</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="convulsions" checked={assessments.convulsions} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Has the infant had convulsions?</span></label>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 uppercase border-b pb-1 mb-2">Look</h4>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="convulsingNow" checked={assessments.convulsingNow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Is the infant convulsing now?</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="movementOnlyStimulatedNoMovement" checked={assessments.movementOnlyStimulatedNoMovement} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Look at young infant movement, does it Move only when stimulated or No movement at all.</span></label>
                            <div className="flex flex-wrap items-center gap-2 text-sm border-t pt-2 border-slate-200">
                                <span>Count the breaths in one minute:</span>
                                <input type="number" name="breathRate" value={assessments.breathRate} onChange={(e) => setAssessments(p=>({...p, breathRate: e.target.value}))} className="w-16 rounded border-slate-300 p-1" />
                                <span>Repeat if 60 breath/min or more:</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="fastBreathing" checked={assessments.fastBreathing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Fast breathing?</span></label>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="severeChestIndrawing" checked={assessments.severeChestIndrawing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Look for severe chest indrawing.</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="fever38" checked={assessments.fever38} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Fever (temperature 38°C or above feels hot)</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="lowTemp35_5" checked={assessments.lowTemp35_5} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>low body temperature (below 35.5°C or feels cool)</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="umbilicusRedDraining" checked={assessments.umbilicusRedDraining} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Look at the umbilicus. Is it red or draining pus?</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="pusFromEyes" checked={assessments.pusFromEyes} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Look for pus draining from the eyes.</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="skinPustules" checked={assessments.skinPustules} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Look for skin pustules.</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 2. JAUNDICE */}
                <AssessmentRow 
                    title="CHECK FOR JAUNDICE" 
                    isConditional yesNoValue={assessments.hasJaundice} onYesNoChange={(val) => setAssessments(p => ({...p, hasJaundice: val}))}
                    classifyData={results.jaundice.c} treatmentData={results.jaundice.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <span className="text-sm font-medium italic block mb-1">If jaundice present asks:</span>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="jaundiceFirst24h" checked={assessments.jaundiceFirst24h} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Did the jaundice appear in the first 24 hours?</span></label>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="jaundiceLowWeight" checked={assessments.jaundiceLowWeight} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Is the infant weighing less than 2.5kg and has jaundice in any part of the body?</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="jaundiceSolesPalms" checked={assessments.jaundiceSolesPalms} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Look at the palms and soles. Are they yellow?</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 3. DIARRHOEA */}
                <AssessmentRow 
                    title="DOES THE YOUNG INFANT HAVE DIARRHOEA?" 
                    isConditional yesNoValue={assessments.hasDiarrhea} onYesNoChange={(val) => setAssessments(p => ({...p, hasDiarrhea: val}))}
                    classifyData={results.diarrhea.c} treatmentData={results.diarrhea.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Duration</span>
                                <input type="number" name="diarrheaDays" value={assessments.diarrheaDays} onChange={(e) => setAssessments(p => ({...p, diarrheaDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm font-medium">Days</span>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="bloodInStool" checked={assessments.bloodInStool} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Blood in stool</span></label>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <span className="font-bold text-sm block border-b pb-1 mb-2">General condition:</span>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="diarrheaMovement" checked={assessments.diarrheaMovement} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Movement only when stimulated or no movement at all?</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="diarrheaRestless" checked={assessments.diarrheaRestless} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Restless and irritable?</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="diarrheaSunkenEyes" checked={assessments.diarrheaSunkenEyes} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Sunken eyes.</span></label>
                            <div className="flex items-center gap-3 text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium">Skin pinch returns:</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchVerySlow" checked={assessments.pinchVerySlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>very slowly</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchSlow" checked={assessments.pinchSlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>slowly</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 4. FEEDING */}
                <AssessmentRow 
                    title="CHECK FOR FEEDING PROBLEM OR LOW WEIGHT" active={true}
                    classifyData={results.feeding.c} treatmentData={results.feeding.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span>Is there any difficulty feeding?</span>
                                <div className="flex gap-3"><label className="cursor-pointer"><input type="radio" name="diffFeeding" value="yes" checked={assessments.diffFeeding==='yes'} onChange={handleRadioChange}/> Yes</label><label className="cursor-pointer"><input type="radio" name="diffFeeding" value="no" checked={assessments.diffFeeding==='no'} onChange={handleRadioChange}/> No</label></div>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span>Is the infant breastfed?</span>
                                <div className="flex gap-3"><label className="cursor-pointer"><input type="radio" name="breastfed" value="yes" checked={assessments.breastfed==='yes'} onChange={handleRadioChange}/> Yes</label><label className="cursor-pointer"><input type="radio" name="breastfed" value="no" checked={assessments.breastfed==='no'} onChange={handleRadioChange}/> No</label></div>
                            </div>
                            {assessments.breastfed === 'yes' && (
                                <div className="flex items-center gap-2 text-sm ml-4">
                                    <span>If yes, how many times in 24 hours?</span>
                                    <input type="number" name="breastfeedTimes" value={assessments.breastfeedTimes} onChange={(e) => setAssessments(p=>({...p, breastfeedTimes: e.target.value}))} className="w-16 rounded border-slate-300 p-1"/>
                                    <span>times</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span>Does infant usually receive any other foods or drinks?</span>
                                <div className="flex gap-3"><label className="cursor-pointer"><input type="radio" name="otherFoods" value="yes" checked={assessments.otherFoods==='yes'} onChange={handleRadioChange}/> Yes</label><label className="cursor-pointer"><input type="radio" name="otherFoods" value="no" checked={assessments.otherFoods==='no'} onChange={handleRadioChange}/> No</label></div>
                            </div>
                            {assessments.otherFoods === 'yes' && (
                                <div className="flex items-center gap-2 text-sm ml-4">
                                    <span>If yes, how often?</span>
                                    <input type="text" name="otherFoodsOften" value={assessments.otherFoodsOften} onChange={(e) => setAssessments(p=>({...p, otherFoodsOften: e.target.value}))} className="w-full rounded border-slate-300 p-1"/>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                                <span>What do you use to feed the child?</span>
                                <input type="text" name="feedTool" value={assessments.feedTool} onChange={(e) => setAssessments(p=>({...p, feedTool: e.target.value}))} className="w-full rounded border-slate-300 p-1"/>
                            </div>
                        </div>
                        <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <span className="font-bold text-sm block">Determine weight for age.</span>
                            <div className="flex gap-4 text-sm border-b pb-2">
                                <label className="cursor-pointer"><input type="radio" name="weightForAgeLow" value="true" checked={assessments.weightForAgeLow===true} onChange={()=>setAssessments(p=>({...p, weightForAgeLow: true}))}/> Low</label>
                                <label className="cursor-pointer"><input type="radio" name="weightForAgeLow" value="false" checked={assessments.weightForAgeLow===false} onChange={()=>setAssessments(p=>({...p, weightForAgeLow: false}))}/> Not Low</label>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="thrush" checked={assessments.thrush} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>ulcers or patches in the mouth (thrush).</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 5. ASSESS BREASTFEEDING */}
                <AssessmentRow 
                    title={<span>ASSESS BREASTFEEDING: <span className="font-normal text-xs text-slate-500">If no indication to refer urgently to hospital</span></span>} 
                    active={true}
                    classifyData={results.breast.c} treatmentData={results.breast.t}
                >
                    <div className="mt-2 overflow-x-auto border border-slate-300 rounded-md">
                        <table className="w-full text-sm border-collapse min-w-[500px]">
                            <tbody>
                                {/* Position */}
                                <tr>
                                    <td className="border border-slate-300 p-2 font-bold bg-slate-100">Is the infant well positioned?</td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="wellPositioned" value="well" checked={assessments.wellPositioned==='well'} onChange={handleRadioChange}/> Well positioned</label></td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="wellPositioned" value="notWell" checked={assessments.wellPositioned==='notWell'} onChange={handleRadioChange}/> Not well positioned</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">Infant's head and body in line.</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posInLine" value="yes" checked={assessments.posInLine==='yes'} onChange={handleRadioChange}/> Yes</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posInLine" value="no" checked={assessments.posInLine==='no'} onChange={handleRadioChange}/> No</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">Infant approaching breast with nose opposite to the nipple</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posNoseOpposite" value="yes" checked={assessments.posNoseOpposite==='yes'} onChange={handleRadioChange}/> Yes</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posNoseOpposite" value="no" checked={assessments.posNoseOpposite==='no'} onChange={handleRadioChange}/> No</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">Infant held close to the mother's body.</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posCloseBody" value="yes" checked={assessments.posCloseBody==='yes'} onChange={handleRadioChange}/> Yes</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posCloseBody" value="no" checked={assessments.posCloseBody==='no'} onChange={handleRadioChange}/> No</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">Infant's whole body supported not just neck and shoulder.</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posWholeBodySupported" value="yes" checked={assessments.posWholeBodySupported==='yes'} onChange={handleRadioChange}/> Yes</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="posWholeBodySupported" value="no" checked={assessments.posWholeBodySupported==='no'} onChange={handleRadioChange}/> No</label></td>
                                </tr>

                                {/* Attachment */}
                                <tr>
                                    <td className="border border-slate-300 p-2 font-bold bg-slate-100">Is the infant able to attach?</td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="goodAttachment" value="good" checked={assessments.goodAttachment==='good'} onChange={handleRadioChange}/> Good attachment</label></td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="goodAttachment" value="notWell" checked={assessments.goodAttachment==='notWell'} onChange={handleRadioChange}/> Not well attached</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">Chin touching breast</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attChinTouching" value="yes" checked={assessments.attChinTouching==='yes'} onChange={handleRadioChange}/> Yes</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attChinTouching" value="no" checked={assessments.attChinTouching==='no'} onChange={handleRadioChange}/> No</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">Mouth wide open:</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attMouthWide" value="yes" checked={assessments.attMouthWide==='yes'} onChange={handleRadioChange}/> Yes</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attMouthWide" value="no" checked={assessments.attMouthWide==='no'} onChange={handleRadioChange}/> No</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">Lower lip turned outward:</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attLowerLipOut" value="yes" checked={assessments.attLowerLipOut==='yes'} onChange={handleRadioChange}/> Yes</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attLowerLipOut" value="no" checked={assessments.attLowerLipOut==='no'} onChange={handleRadioChange}/> No</label></td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-2 pl-6 text-xs italic">More areola above than below the mouth:</td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attAreolaAbove" value="yes" checked={assessments.attAreolaAbove==='yes'} onChange={handleRadioChange}/> Yes</label></td>
                                    <td className="border border-slate-300 p-2 text-xs"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="attAreolaAbove" value="no" checked={assessments.attAreolaAbove==='no'} onChange={handleRadioChange}/> No</label></td>
                                </tr>

                                {/* Sucking */}
                                <tr>
                                    <td className="border border-slate-300 p-2 font-bold bg-slate-100">Is the infant sucking effectively (slow deep sucks, sometimes pausing)</td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="suckingEffectively" value="effective" checked={assessments.suckingEffectively==='effective'} onChange={handleRadioChange}/> sucking effectively</label></td>
                                    <td className="border border-slate-300 p-2"><label className="cursor-pointer flex items-center gap-1"><input type="radio" name="suckingEffectively" value="notEffective" checked={assessments.suckingEffectively==='notEffective'} onChange={handleRadioChange}/> Not suckling effectively</label></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </AssessmentRow>

                {/* 6. Vaccination */}
                <AssessmentRow 
                    title={<span>Check for vaccination <span className="font-normal text-xs text-slate-500 block sm:inline sm:ml-2">(check on given vaccine and circle missed vaccine)</span></span>}
                    active={true} classifyData={results.vaccine.c} treatmentData={results.vaccine.t}
                >
                    <div className="flex flex-col gap-4 mt-2">
                        <div className="overflow-x-auto border border-slate-300 rounded-md">
                            <table className="w-full text-xs text-left border-collapse min-w-[500px]">
                                <tbody>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100 w-24">At birth</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv0" checked={assessments.v_opv0} onChange={handleCheckboxChange} className="rounded text-sky-600"/> OPV 0</label></td>
                                        <td className="p-2" colSpan={4}><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_bcg" checked={assessments.v_bcg} onChange={handleCheckboxChange} className="rounded text-sky-600"/> BCG</label></td>
                                    </tr>
                                    <tr>
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">6 weeks</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv1" checked={assessments.v_opv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> OPV 1</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_rota1" checked={assessments.v_rota1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Rota 1</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_pcv1" checked={assessments.v_pcv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> PCV 1</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_penta1" checked={assessments.v_penta1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Penta 1</label></td>
                                        <td className="p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_ipv1" checked={assessments.v_ipv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> IPV 1</label></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </AssessmentRow>

                {/* 7. Any other problems */}
                <AssessmentRow 
                    title="Any other problems?"
                    isConditional={true}
                    yesNoValue={assessments.hasOtherProblems} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasOtherProblems: val}))}
                    classifyData={results.other.c} treatmentData={results.other.t}
                >
                    <textarea name="otherProblemsText" value={assessments.otherProblemsText} onChange={(e) => setAssessments(prev=>({...prev, otherProblemsText: e.target.value}))} rows={2} className="block w-full rounded-md border-slate-300 shadow-sm focus:ring-sky-500 sm:text-sm mt-2 p-3" placeholder="Describe other problems..."></textarea>
                </AssessmentRow>

                {/* Footer: Follow up */}
                <div className="p-5 bg-slate-800 text-white flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
                    <span className="font-bold tracking-wide uppercase">Return follow up after:</span>
                    <div className="flex gap-5 font-semibold">
                        {['1 day', '2 days', '14 days'].map(days => (
                            <label key={days} className="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="followUpDays" value={days} checked={assessments.followUpDays===String(days)} onChange={handleRadioChange} className="text-sky-400 focus:ring-sky-400 cursor-pointer w-4 h-4" /><span>{days}</span></label>
                        ))}
                    </div>
                </div>

            </div>
            
            <div className="flex justify-end pb-8">
                <Button variant="primary" className="w-full md:w-auto py-3.5 shadow-lg px-12 text-lg font-bold"><ClipboardList className="w-5 h-5 mr-2 inline-block"/> Save Infant Assessment</Button>
            </div>
        </div>
    );
}

// ============================================================================
// FORM 2: SICK CHILD (2 MONTHS UP TO 5 YEARS) - ALIGNED GRID LAYOUT
// ============================================================================
function ChildForm() {
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

    // --- Z-SCORE CALCULATION ENGINE ---
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

    // --- EXACT DOSING & CLASSIFICATION LOGIC ---
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
        
        // 1. General Danger Signs
        const hasDangerSign = assessments.notAbleToDrink || assessments.vomitsEverything || assessments.historyOfConvulsions || assessments.lethargicUnconscious || assessments.convulsingNow;
        if (hasDangerSign) {
            cat.danger.c.push({ label: "DANGER SIGN PRESENT", color: "bg-red-500" });
            cat.danger.t.push("Refer urgently");
            
            let imAbDose = "Give Pre-referral IM Antibiotic";
            if (weight >= 4 && weight < 6) imAbDose = "Pre-referral IM: Ampicillin 1ml & Gentamycin 0.75-1.0ml";
            else if (weight >= 6 && weight <= 10) imAbDose = "Pre-referral IM: Ampicillin 2ml & Gentamycin 1.1-1.8ml";
            else if (weight > 10 && weight <= 14) imAbDose = "Pre-referral IM: Ampicillin 3ml & Gentamycin 1.9-2.7ml";
            else if (weight > 14 && weight <= 19) imAbDose = "Pre-referral IM: Ampicillin 5ml & Gentamycin 2.8-3.5ml";
            else if (age >= 2 && age < 4) imAbDose = "Pre-referral IM: Ampicillin 1ml & Gentamycin 0.75-1.0ml";
            else if (age >= 4 && age < 12) imAbDose = "Pre-referral IM: Ampicillin 2ml & Gentamycin 1.1-1.8ml";
            else if (age >= 12 && age < 36) imAbDose = "Pre-referral IM: Ampicillin 3ml & Gentamycin 1.9-2.7ml";
            else if (age >= 36 && age <= 60) imAbDose = "Pre-referral IM: Ampicillin 5ml & Gentamycin 2.8-3.5ml";
            cat.danger.t.push(imAbDose);

            if (assessments.convulsingNow) {
                let diazepamDose = "Give Diazepam rectally";
                if (weight >= 5 && weight <= 7) diazepamDose = "Diazepam 10 mg/2 ml: 0.5 ml rectally";
                else if (weight > 7 && weight < 10) diazepamDose = "Diazepam 10 mg/2 ml: 1.0 ml rectally";
                else if (weight >= 10 && weight < 14) diazepamDose = "Diazepam 10 mg/2 ml: 1.5 ml rectally";
                else if (weight >= 14 && weight <= 19) diazepamDose = "Diazepam 10 mg/2 ml: 2.0 ml rectally";
                else if (age >= 2 && age < 6) diazepamDose = "Diazepam 10 mg/2 ml: 0.5 ml rectally";
                else if (age >= 6 && age < 12) diazepamDose = "Diazepam 10 mg/2 ml: 1.0 ml rectally";
                else if (age >= 12 && age < 36) diazepamDose = "Diazepam 10 mg/2 ml: 1.5 ml rectally";
                else if (age >= 36 && age <= 60) diazepamDose = "Diazepam 10 mg/2 ml: 2.0 ml rectally";
                cat.danger.t.push(diazepamDose);
            }
        }

        // --- DETERMINE OTHER SEVERE CLASSIFICATIONS ---
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

        // 2. Cough
        if (assessments.hasCough) {
            let pneumoniaScore = 0;
            if (assessments.chestIndrawing) pneumoniaScore += 1;
            if (assessments.fastBreathing) pneumoniaScore += 1;
            if (assessments.stridor) pneumoniaScore += 4;

            if (hasDangerSign || pneumoniaScore > 3) {
                cat.cough.c.push({ label: "SEVER PNEUMONIA OR VERY SEVERE DISEASE", color: "bg-red-500" });
                cat.cough.t.push(<span className="font-bold">Give first dose of an appropriate antibiotic.</span>);
                cat.cough.t.push(<span className="font-bold">Treat to prevent low blood sugar</span>);
                cat.cough.t.push(<span className="font-bold">Refer URGENTLY to hospital</span>);
            } else if (assessments.chestIndrawing || assessments.fastBreathing) {
                cat.cough.c.push({ label: "PNEUMONIA", color: "bg-yellow-400" });
                
                let amoxDose = "Give appropriate antibiotics for 5 days";
                if (weight >= 4 && weight < 10) amoxDose = "Give appropriate antibiotics for 5 days: Amoxicillin 5 ml or 1 tablet, bid";
                else if (weight >= 10 && weight < 14) amoxDose = "Give appropriate antibiotics for 5 days: Amoxicillin 10 ml or 2 tablets, bid";
                else if (weight >= 14 && weight <= 19) amoxDose = "Give appropriate antibiotics for 5 days: Amoxicillin 15 ml or 3 tablets, bid";
                else if (age >= 2 && age < 12) amoxDose = "Give appropriate antibiotics for 5 days: Amoxicillin 5 ml or 1 tablet, bid";
                else if (age >= 12 && age < 36) amoxDose = "Give appropriate antibiotics for 5 days: Amoxicillin 10 ml or 2 tablets, bid";
                else if (age >= 36 && age <= 60) amoxDose = "Give appropriate antibiotics for 5 days: Amoxicillin 15 ml or 3 tablets, bid";
                cat.cough.t.push(<span className="font-bold">{amoxDose}</span>);
                
                if (assessments.wheeze) {
                    cat.cough.t.push(<span className="font-bold">If wheezing (or disappeared after rapidly acting bronchodilator) give an inhaled bronchodilator for 5 days.</span>);
                }
                
                cat.cough.t.push("Soothe the throat and relieve the cough with a safe remedy.");
                if (parseInt(assessments.coughDays) >= 14) {
                    cat.cough.t.push("If coughing for 14 days or more refer to the hospital for further assessment");
                }
                cat.cough.t.push("Advise mother when to return immediately");
                cat.cough.t.push(<span className="font-bold">Follow-up in 3 days</span>);
            } else {
                cat.cough.c.push({ label: "COUGH OR COLD", color: "bg-green-500" });
                if (parseInt(assessments.coughDays) >= 14) {
                    cat.cough.t.push("If coughing for 14 days or more refer for assessment.");
                }
                cat.cough.t.push("Soothe the throat and relieve cough with a safe remedy.");
                if (assessments.wheeze) {
                    cat.cough.t.push("Treat wheezing if present.");
                }
                cat.cough.t.push("Advise mother when to return immediately.");
                cat.cough.t.push("Follow up in 5 days if not improving");
            }
        }

        // 3. Diarrhea
        if (assessments.hasDiarrhea) {
            let severeDehyd = 0, someDehyd = 0;
            if (assessments.lethargic) severeDehyd++;
            if (assessments.restlessIrritable) someDehyd++;
            if (assessments.sunkenEyes) { severeDehyd++; someDehyd++; }
            if (assessments.drinkPoorly) severeDehyd++;
            if (assessments.drinkEagerly) someDehyd++;
            if (assessments.pinchVerySlow) severeDehyd++;
            if (assessments.pinchSlow) someDehyd++;

            let zincDose = (age >= 2 && age < 6) ? "Give Zinc: 10 mg (1/2 tab) x 14 days" : (age >= 6 ? "Give Zinc: 20 mg (1 tab) x 14 days" : "Give Zinc (if >2mo)");

            if (severeDehyd >= 2) {
                cat.diarrhea.c.push({ label: "SEVERE DEHYDRATION", color: "bg-red-500" });
                if (!hasOtherSevereClassification) {
                    let planC = "Give fluid for severe dehydration (Plan C)";
                    let vol = weight * 100; let first = weight * 30; let second = weight * 70;
                    if (weight > 0) planC = `Give fluid for severe dehydration (Plan C): ${vol}ml Ringer's Lactate (First ${first}ml, then ${second}ml)`;
                    cat.diarrhea.t.push(<span className="font-bold">{planC}</span>);
                } else {
                    cat.diarrhea.t.push(<span className="font-bold italic">Refer URGENTLY to hospital with mother giving frequent sips of ORS on the way.</span>);
                }
                cat.diarrhea.t.push(<span className="font-bold italic">Advise the mother to continue breastfeeding.</span>);
                if (age >= 24) {
                    cat.diarrhea.t.push(<span className="font-bold italic">If child is 2 years or older and there is cholera in your area, give antibiotic for cholera.</span>);
                }
            } else if (someDehyd >= 2) {
                cat.diarrhea.c.push({ label: "SOME DEHYDRATION", color: "bg-yellow-400" });
                
                let planB = "Give fluid for some dehydration (Plan B)";
                if (weight > 0) {
                    if (weight < 6) planB = "Give fluid for some dehydration (Plan B): 200–400 ml over 4 hrs";
                    else if (weight >= 6 && weight < 10) planB = "Give fluid for some dehydration (Plan B): 400–700 ml over 4 hrs";
                    else if (weight >= 10 && weight < 12) planB = "Give fluid for some dehydration (Plan B): 700–900 ml over 4 hrs";
                    else if (weight >= 12 && weight <= 19) planB = "Give fluid for some dehydration (Plan B): 900–1400 ml over 4 hrs";
                } else {
                    if (age < 4) planB = "Give fluid for some dehydration (Plan B): 200–400 ml over 4 hrs";
                    else if (age >= 4 && age < 12) planB = "Give fluid for some dehydration (Plan B): 400–700 ml over 4 hrs";
                    else if (age >= 12 && age < 24) planB = "Give fluid for some dehydration (Plan B): 700–900 ml over 4 hrs";
                    else if (age >= 24 && age <= 60) planB = "Give fluid for some dehydration (Plan B): 900–1400 ml over 4 hrs";
                }
                cat.diarrhea.t.push(planB);
                cat.diarrhea.t.push(zincDose);
                if (hasOtherSevereClassification) {
                    cat.diarrhea.t.push(<span className="font-bold italic">Refer URGENTLY to hospital with mother giving frequent sips of ORS on the way.</span>);
                    cat.diarrhea.t.push(<span className="font-bold italic">- Advise the mother to continue breastfeeding.</span>);
                }
                cat.diarrhea.t.push("Advise mother when to return immediately.");
                cat.diarrhea.t.push("Follow-up in 5 days if not improving.");
            } else {
                cat.diarrhea.c.push({ label: "NO DEHYDRATION", color: "bg-green-500" });
                let planA = (age < 24) ? "Give fluid and food to treat diarrhea at home (Plan A): 50-100 ml after loose stool" : "Give fluid and food to treat diarrhea at home (Plan A): 100-200 ml after loose stool";
                cat.diarrhea.t.push(planA);
                cat.diarrhea.t.push(zincDose);
                cat.diarrhea.t.push("Advise mother when to return immediately.");
                cat.diarrhea.t.push("Follow-up in 5 days if not improving.");
            }

            if (assessments.bloodInStool) {
                cat.diarrhea.c.push({ label: "DYSENTERY", color: "bg-yellow-400" });
                let ciproDose = "Give an oral ciprofloxacin for 3 days.";
                if (weight >= 4 && weight <= 6) ciproDose = "Give an oral ciprofloxacin for 3 days: 1/4 tab bid";
                else if (weight > 6 && weight <= 10) ciproDose = "Give an oral ciprofloxacin for 3 days: 1/2 tab bid";
                else if (weight > 10 && weight <= 19) ciproDose = "Give an oral ciprofloxacin for 3 days: 1 tab bid";
                cat.diarrhea.t.push(<span className="font-bold italic">{ciproDose}</span>);
                cat.diarrhea.t.push("Follow-up in 3 days.");
            }

            if (parseInt(assessments.diarrheaDays) >= 14) {
                if (severeDehyd >= 2 || someDehyd >= 2) {
                    cat.diarrhea.c.push({ label: "SEVERE PERSISTENT DIARRHOEA", color: "bg-red-500" });
                    cat.diarrhea.t.push(<span className="font-bold italic">Treat dehydration before referral unless the child has another severe classification.</span>);
                    cat.diarrhea.t.push(<span className="font-bold italic">Refer to hospital.</span>);
                } else {
                    cat.diarrhea.c.push({ label: "PERSISTENT DIARRHOEA", color: "bg-yellow-400" });
                    cat.diarrhea.t.push("Advise the mother on feeding a child who has PERSISTENT DIARRHOEA.");
                    
                    let vitADose = "Give dose of Vitamin A";
                    if (age >= 6 && age < 12) vitADose = "Give dose of Vitamin A: 100,000 IU (Blue)";
                    else if (age >= 12 && age <= 60) vitADose = "Give dose of Vitamin A: 200,000 IU (Red)";
                    cat.diarrhea.t.push(vitADose);
                    
                    cat.diarrhea.t.push("Follow-up in 5 days.");
                }
            }
        }

        // 4. Fever
        if (assessments.hasFever) {
            let vitADose = "Vitamin A";
            if (age >= 6 && age < 12) vitADose = "100,000 IU (Blue)";
            else if (age >= 12 && age <= 60) vitADose = "200,000 IU (Red)";

            let paraDose = "5ml or 1/4 tab every 6h";
            if (weight >= 15 && weight <= 19) paraDose = "10ml or 1/2 tab every 6h";
            else if (age >= 36 && age <= 60) paraDose = "10ml or 1/2 tab every 6h";

            const needsPara = temp >= 38.5;

            if (hasDangerSign || assessments.neckStiffness) {
                cat.fever.c.push({ label: "VERY SEVERE FEBRILE DISEASE", color: "bg-red-500" });
                
                let quinineDose = "IM Quinine (first dose)";
                if (weight >= 4 && weight <= 6) quinineDose = "IM Quinine (first dose): 1.0 ml";
                else if (weight > 6 && weight <= 10) quinineDose = "IM Quinine (first dose): 1.5 ml";
                else if (weight > 10 && weight <= 12) quinineDose = "IM Quinine (first dose): 2.0 ml";
                else if (weight > 12 && weight <= 14) quinineDose = "IM Quinine (first dose): 2.5 ml";
                else if (weight > 14 && weight <= 19) quinineDose = "IM Quinine (first dose): 3.0 ml";
                
                cat.fever.t.push(<span className="font-bold italic">Give {quinineDose}.</span>);
                cat.fever.t.push(<span className="font-bold italic">Give first dose of an appropriate antibiotic.</span>);
                cat.fever.t.push(<span className="font-bold italic">Treat the child to prevent low blood sugar.</span>);
                if (needsPara) {
                    cat.fever.t.push(<span className="font-bold italic">Give one dose of paracetamol in clinic for high fever (38.5° or above): {paraDose}</span>);
                }
                cat.fever.t.push(<span className="font-bold italic">Refer URGENTLY to hospital.</span>);
                
            } else if (assessments.malariaTest === 'positive') {
                cat.fever.c.push({ label: "MALARIA", color: "bg-yellow-400" });
                
                let coartemDose = "oral antimalarial (Coartem)";
                if (weight > 0) {
                    if (weight >= 5 && weight <= 14) coartemDose = "oral antimalarial (Coartem): 1 tab bid x 3d";
                    else if (weight > 14 && weight <= 24) coartemDose = "oral antimalarial (Coartem): 2 tabs bid x 3d";
                } else {
                    if (age >= 2 && age <= 36) coartemDose = "oral antimalarial (Coartem): 1 tab bid x 3d";
                    else if (age > 36 && age <= 60) coartemDose = "oral antimalarial (Coartem): 2 tabs bid x 3d";
                }
                cat.fever.t.push(<span className="font-bold">Give first line of {coartemDose}.</span>);
                cat.fever.t.push("In case of Vivax give primaquine after completion of the first line antimalaria");
                if (needsPara) {
                    cat.fever.t.push(<span className="font-bold">Give one dose of paracetamol in clinic for high fever (38.5°C or above): {paraDose}.</span>);
                }
                cat.fever.t.push("Advise mother when to return immediately.");
                cat.fever.t.push("Follow-up in 3 days if fever persist.");
                if (assessments.dailyFever7Days) {
                    cat.fever.t.push("If fever is present every day for more than 7 days, refer for assessment");
                }
                
            } else {
                cat.fever.c.push({ label: "FEVER - NO MALARIA", color: "bg-green-500" });
                cat.fever.t.push("Assess for other cause of fever and treat accordingly.");
                if (needsPara) {
                    cat.fever.t.push(`Give one dose of Paracetamol for high fever (38.5° or above): ${paraDose}`);
                }
                if (parseInt(assessments.feverDays) >= 7 || assessments.dailyFever7Days) {
                    cat.fever.t.push("If fever for 7 days or more refer for assessment");
                }
                cat.fever.t.push("Advice the mother when to return immediately");
                cat.fever.t.push("Follow up in 3 days if fever persist");
            }

            // Measles Sub-logic
            if (assessments.measlesRash || assessments.measles3Months) {
                if (hasDangerSign || assessments.corneaClouding || assessments.deepExtensiveUlcers) {
                    cat.fever.c.push({ label: "SEVERE COMPLICATED MEASLES", color: "bg-red-500" });
                    cat.fever.t.push(<span className="font-bold italic">Give Vitamin A treatment: {vitADose}</span>);
                    cat.fever.t.push(<span className="font-bold italic">Give first dose of an appropriate antibiotic.</span>);
                    if (assessments.corneaClouding || assessments.pusFromEye) {
                        cat.fever.t.push(<span className="font-bold italic">If clouding of the cornea or pus draining from the eye, apply tetracycline eye ointment.</span>);
                    }
                    cat.fever.t.push(<span className="font-bold italic">Refer URGENTLY to hospital.</span>);
                } else if (assessments.pusFromEye || assessments.mouthUlcers) {
                    cat.fever.c.push({ label: "MEASLES WITH EYE OR MOUTH COMPLICATIONS", color: "bg-yellow-400" });
                    cat.fever.t.push(<span className="font-bold">Give Vitamin A treatment: {vitADose}.</span>);
                    if (assessments.pusFromEye) {
                        cat.fever.t.push(<span className="font-bold">If pus draining from the eye, treat eye infection with tetracycline eye ointment.</span>);
                    }
                    if (assessments.mouthUlcers) {
                        cat.fever.t.push(<span className="font-bold">If mouth ulcers, treat with gentian violet.</span>);
                    }
                    cat.fever.t.push("Advise the mother when to return immediately");
                    cat.fever.t.push(<span className="font-bold">Follow-up in 3 days</span>);
                } else {
                    cat.fever.c.push({ label: "MEASLES", color: "bg-green-500" });
                    cat.fever.t.push(`Give Vitamin A: ${vitADose}.`);
                    cat.fever.t.push("Advise the mother to feed the child.");
                }
            }
        }

        // 5. Ear 
        if (assessments.hasEarProblem) {
            let paraDose = "5ml or 1/4 tab every 6h";
            if (weight >= 15 && weight <= 19) paraDose = "10ml or 1/2 tab every 6h";
            else if (age >= 36 && age <= 60) paraDose = "10ml or 1/2 tab every 6h";

            if (assessments.tenderSwelling) {
                cat.ear.c.push({ label: "MASTOIDITIS", color: "bg-red-500" });
                cat.ear.t.push(<span className="font-bold">Give first dose of an appropriate antibiotic.</span>);
                cat.ear.t.push(<span className="font-bold">Give first dose of paracetamol for pain: {paraDose}.</span>);
                cat.ear.t.push(<span className="font-bold">Refer URGENTLY to hospital.</span>);
            } else if ((assessments.earDischarge || assessments.pusFromEar) && parseInt(assessments.earDischargeDays || 0) >= 14) {
                cat.ear.c.push({ label: "CHRONIC EAR INFECTION", color: "bg-yellow-400" });
                cat.ear.t.push(<span className="font-bold">Dry the ear by wicking.</span>);
                cat.ear.t.push(<span className="font-bold">give Quinolones ear drop</span>);
                cat.ear.t.push(<span className="font-bold">Advice the mother when to return immediately</span>);
            } else if (assessments.earPain || ((assessments.earDischarge || assessments.pusFromEar) && parseInt(assessments.earDischargeDays || 0) < 14)) {
                cat.ear.c.push({ label: "ACUTE EAR INFECTION", color: "bg-yellow-400" });
                cat.ear.t.push(<span className="font-bold">Give an appropriate oral antibiotics for 5 days</span>);
                cat.ear.t.push(<span className="font-bold">Give paracetamol for pain: {paraDose}</span>);
                cat.ear.t.push(<span className="font-bold">Dry the ear by wicking</span>);
                cat.ear.t.push(<span className="font-bold">Advice the mother when to return immediately</span>);
                cat.ear.t.push(<span className="font-bold">Follow up in 5 days</span>);
            } else {
                cat.ear.c.push({ label: "NO EAR INFECTION (other ear problems)", color: "bg-green-500" });
                cat.ear.t.push(<span className="font-bold">No treatment advised .</span>);
                cat.ear.t.push(<span className="font-bold">Refer for assessment if there is hear-ing problems</span>);
            }
        }

        // 6. Anemia 
        if (assessments.pallor === 'severePallor') {
            cat.anemia.c.push({ label: "SEVERE ANAEMIA", color: "bg-red-500" });
            cat.anemia.t.push(<span className="font-bold">Refer URGENTLY to hospital</span>);
        } else if (assessments.pallor === 'somePallor') {
            cat.anemia.c.push({ label: "ANAEMIA", color: "bg-yellow-400" });
            
            let ironDose = "Iron for 2 months";
            if (weight >= 4 && weight < 6) ironDose = "Iron for 2 months: 2ml polymaltose OR 1ml fumarate";
            else if (weight >= 6 && weight < 10) ironDose = "Iron for 2 months: 3.5ml polymaltose OR 1.75ml fumarate";
            else if (weight >= 10 && weight < 14) ironDose = "Iron for 2 months: 1/2 tab OR 5ml polymaltose";
            else if (weight >= 14 && weight <= 19) ironDose = "Iron for 2 months: 1/2 tab OR 6.5ml polymaltose";
            else if (age >= 2 && age < 4) ironDose = "Iron for 2 months: 2ml polymaltose OR 1ml fumarate";
            else if (age >= 4 && age < 12) ironDose = "Iron for 2 months: 3.5ml polymaltose OR 1.75ml fumarate";
            else if (age >= 12 && age < 36) ironDose = "Iron for 2 months: 1/2 tab OR 5ml polymaltose";
            else if (age >= 36 && age <= 60) ironDose = "Iron for 2 months: 1/2 tab OR 6.5ml polymaltose";
            
            cat.anemia.t.push(`Give iron* (${ironDose})`);

            let mebText = "Give mebendazole if child is 1 year or older and has not received dose in the last 6 months";
            if (age >= 12 || (weight >= 10 && weight <= 19)) {
                mebText += " (Mebendazole: 100mg bid x 3d)";
            }
            cat.anemia.t.push(mebText);
            
            cat.anemia.t.push("Advise mother when to return immediately");
            cat.anemia.t.push("Follow-up in 14 days");
            
            if (age < 24) {
                cat.anemia.t.push("If child is less than 2 years old, assess the child's feeding and counsel the mother on feeding according to the feeding recommendations");
            }
        } else {
            cat.anemia.c.push({ label: "NO ANAEMIA", color: "bg-green-500" });
            cat.anemia.t.push("No additional treatment");
            if (age < 24) {
                cat.anemia.t.push("If child is less than 2 years old, assess the child's feeding and counsel the mother on feeding according to the feeding Recommendations.");
            }
        }

        // 7. Malnutrition 
        if (assessments.edema || isZSevere || isMUACSevere) {
            if (hasComplications) {
                cat.malnutrition.c.push({ label: "COMPLICATED SEVERE ACUTE MALNUTRITION (SAM)", color: "bg-red-500" });
                cat.malnutrition.t.push(<span className="font-bold">Give first dose appropriate antibiotic.</span>);
                cat.malnutrition.t.push(<span className="font-bold">Treat the child to prevent low blood sugar.</span>);
                cat.malnutrition.t.push(<span className="font-bold">Keep the child warm.</span>);
                cat.malnutrition.t.push(<span className="font-bold">Refer URGENTLY to hospital</span>);
            } else {
                cat.malnutrition.c.push({ label: "UNCOMPLICATED SEVERE ACUTE MALNUTRITION (SAM)", color: "bg-yellow-400" });
                cat.malnutrition.t.push(<span className="font-bold italic">Give oral antibiotics for 5 days.</span>);
                cat.malnutrition.t.push("Refer for Outpatient Therapeutic Program (OTP) for ready-to-use therapeutic food (RUTF) if a child aged 6 months or more.");
                cat.malnutrition.t.push("Counsel the mother on how to feed the child.");
                cat.malnutrition.t.push("Advise mother when to return immediately.");
                cat.malnutrition.t.push("Follow up in 14 days");
            }
        } else if (zScoreResult.status === 'Between -3 and -2 Z' || isMUACModerate) {
            cat.malnutrition.c.push({ label: "MODERATE ACUTE MALNUTRITION (MAM)", color: "bg-yellow-400" });
            cat.malnutrition.t.push("Refer for the child for Supplementary feeding program if available.");
            cat.malnutrition.t.push("Assess the child's feeding and counsel the mother on the feeding recommendations and refer for growth monitoring and health promotion.");
            cat.malnutrition.t.push("If feeding problem, follow up in 7days");
            cat.malnutrition.t.push("Advise mother when to return immediately");
            cat.malnutrition.t.push("Follow-up in 30 days");
        } else { 
            cat.malnutrition.c.push({ label: "NO ACUTE MALNUTRITION", color: "bg-green-500" });
            if (age < 24) {
                cat.malnutrition.t.push("If child is less than 2 years old, assess the child's feeding and counsel the mother on feeding according to the feeding recommendations.");
            }
            cat.malnutrition.t.push("If feeding problem, follow-up in 7 days");
        }

        // 8. Vaccine Logic - Automated based on Age and Checkboxes
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
            cat.vaccine.c.push({ label: "FULLY VACCINATED", color: "bg-green-500" });
        } else if (autoVaccineStatus === 'partially') {
            cat.vaccine.c.push({ label: "PARTIALLY VACCINATED", color: "bg-yellow-500" });
        } else {
            cat.vaccine.c.push({ label: "NOT VACCINATED", color: "bg-red-500" });
        }
        
        // Pushing inputs directly to treatment column array for rendering safely
        cat.vaccine.t.push(
            <div key="next-vax" className="flex flex-col gap-1 w-full mt-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Next vaccine dose</span>
                <input type="date" name="nextVaccine" value={assessments.nextVaccine} onChange={(e) => setAssessments(prev => ({...prev, nextVaccine: e.target.value}))} className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded shadow-sm focus:ring-sky-500"/>
            </div>
        );
        cat.vaccine.t.push(
            <div key="next-vita" className="flex flex-col gap-1 w-full mt-2 mb-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Next Vitamin A dose</span>
                <input type="date" name="nextVitaminA" value={assessments.nextVitaminA} onChange={(e) => setAssessments(prev => ({...prev, nextVitaminA: e.target.value}))} className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded shadow-sm focus:ring-sky-500"/>
            </div>
        );

        // 9. Other Problems
        if (assessments.hasOtherProblems) {
            cat.other.c.push({ label: "OTHER PROBLEM NOTED", color: "bg-slate-500" });
            if (assessments.otherProblemsText.trim() !== '') {
                cat.other.t.push(`Note: ${assessments.otherProblemsText}`);
            } else {
                cat.other.t.push(`Treatment needed for other problem`);
            }
        }

        // 10. Feeding
        if (assessments.feedingStatus === 'problem') {
            cat.feeding.c.push({ label: "FEEDING PROBLEM", color: "bg-yellow-500" });
            cat.feeding.t.push("Counsel on feeding problem using mother card");
        } else if (assessments.feedingStatus === 'noProblem') {
            cat.feeding.c.push({ label: "NO FEEDING PROBLEM", color: "bg-green-500" });
            cat.feeding.t.push("Praise the mother for feeding the child well");
        }

        // Deduplicate treatments safely, considering JSX Elements
        Object.keys(cat).forEach(k => { 
            cat[k].t = cat[k].t.filter((val, index, self) => 
                index === self.findIndex((t) => (
                    t === val || 
                    (t.props && val.props && t.props.children === val.props.children)
                ))
            );
        });

        return cat;
    }, [childData, assessments, zScoreResult]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Header Information (Enhanced Patient Entry) */}
            <Card>
                <div className="bg-slate-800 text-white p-3 rounded-t-md font-bold text-center uppercase tracking-wide shadow-sm">
                    Management of the sick child age 2 month up to 5 years
                </div>
                <div className="p-5 space-y-5 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div className="space-y-1 lg:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><UserSquare2 size={14}/> Child Name</label>
                            <input type="text" name="childName" value={childData.childName} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="Enter child's full name" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> Date</label>
                            <input type="date" name="date" value={childData.date} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><User size={14}/> Sex</label>
                            <select name="sex" value={childData.sex} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white">
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={14}/> Age (Months)</label>
                            <input type="number" name="ageMonths" value={childData.ageMonths} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="e.g. 24" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Weight size={14}/> Weight (kg)</label>
                            <input type="number" step="0.1" name="weightKg" value={childData.weightKg} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="e.g. 12.5" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Ruler size={14}/> Length/Ht (cm)</label>
                            <input type="number" step="0.5" name="lengthCm" value={childData.lengthCm} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="e.g. 85.0" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Thermometer size={14}/> Temp (°C)</label>
                            <input type="number" step="0.1" name="tempC" value={childData.tempC} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="e.g. 37.8" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 border-t border-slate-200 pt-4">
                        <div className="lg:col-span-2 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Ask: What are the child problems?</label>
                            <input type="text" name="problems" value={childData.problems} onChange={handleChildDataChange} className="block w-full rounded-md border-slate-200 shadow-sm focus:ring-sky-500 sm:text-sm p-2.5 bg-white" placeholder="Briefly describe the main problems..." />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Visit Type</label>
                            <div className="flex gap-4 p-2 bg-white rounded-md border border-slate-200 shadow-sm items-center h-[42px]">
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="initial" checked={childData.visitType === 'initial'} onChange={handleChildDataChange} className="text-sky-600"/> Initial Visit</label>
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name="visitType" value="followup" checked={childData.visitType === 'followup'} onChange={handleChildDataChange} className="text-sky-600"/> Follow up</label>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* MAIN ASSESSMENT TABLE GRID */}
            <div className="border border-slate-300 rounded-md overflow-hidden shadow-sm">
                
                {/* Table Header */}
                <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-800 font-bold text-sm text-center text-white border-b border-slate-300 hidden lg:grid">
                    <div className="lg:col-span-7 p-3 border-r border-slate-600">Ask & Look</div>
                    <div className="lg:col-span-2 p-3 border-r border-slate-600">Classify</div>
                    <div className="lg:col-span-3 p-3">Identify Treatment</div>
                </div>

                {/* Row 1: Danger Signs */}
                <AssessmentRow 
                    title={<span className="text-red-700 font-bold flex items-center gap-2"><AlertCircle size={16}/> Check for general danger signs (for all patient)</span>}
                    isConditional={false}
                    classifyData={results.danger.c} treatmentData={results.danger.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="notAbleToDrink" checked={assessments.notAbleToDrink} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>Not able to drink or breastfeed</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="lethargicUnconscious" checked={assessments.lethargicUnconscious} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>Lethargic or unconscious</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="vomitsEverything" checked={assessments.vomitsEverything} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>Vomits every thing</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="convulsingNow" checked={assessments.convulsingNow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>Convulsing now</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="historyOfConvulsions" checked={assessments.historyOfConvulsions} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4 cursor-pointer" /><span>Convulsions in current illness</span></label>
                    </div>
                </AssessmentRow>

                {/* Row 2: Cough */}
                <AssessmentRow 
                    title="Does the child have cough or shortness of breath?"
                    isConditional={true}
                    yesNoValue={assessments.hasCough} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasCough: val}))}
                    classifyData={results.cough.c} treatmentData={results.cough.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-3 rounded">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Duration</span>
                            <input type="number" name="coughDays" value={assessments.coughDays} onChange={(e) => setAssessments(p => ({...p, coughDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                            <span className="text-sm font-medium">Days</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Breath rate =</span>
                                <input type="number" name="breathRate" value={assessments.breathRate} onChange={(e) => setAssessments(p => ({...p, breathRate: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm">breath/min</span>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="fastBreathing" checked={assessments.fastBreathing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Fast breathing?</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="chestIndrawing" checked={assessments.chestIndrawing} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Chest indrawing</span></label>
                            <div className="flex items-center gap-4 text-sm pt-1 border-t border-slate-200 mt-2">
                                <span className="font-medium">Look and listen for:</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="stridor" checked={assessments.stridor} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Stridor</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="wheeze" checked={assessments.wheeze} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>wheeze</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 3: Diarrhea */}
                <AssessmentRow 
                    title="Does the child have diarrhea?"
                    isConditional={true}
                    yesNoValue={assessments.hasDiarrhea} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasDiarrhea: val}))}
                    classifyData={results.diarrhea.c} treatmentData={results.diarrhea.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-3 rounded">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Duration</span>
                                <input type="number" name="diarrheaDays" value={assessments.diarrheaDays} onChange={(e) => setAssessments(p => ({...p, diarrheaDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm font-medium">Days</span>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="bloodInStool" checked={assessments.bloodInStool} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Blood in stool</span></label>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <span className="font-medium">General condition:</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="lethargic" checked={assessments.lethargic} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Lethargic</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="restlessIrritable" checked={assessments.restlessIrritable} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Restless, irritable</span></label>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="sunkenEyes" checked={assessments.sunkenEyes} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Sunken eyes.</span></label>
                            <div className="flex items-center gap-3 text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium">Offer child to drink:</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="drinkPoorly" checked={assessments.drinkPoorly} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>not able or drink poorly</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="drinkEagerly" checked={assessments.drinkEagerly} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>drink eagerly</span></label>
                            </div>
                            <div className="flex items-center gap-3 text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium">Skin pinch returns:</span>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchVerySlow" checked={assessments.pinchVerySlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>very slowly</span></label>
                                <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" name="pinchSlow" checked={assessments.pinchSlow} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>slowly</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 4: Fever */}
                <AssessmentRow 
                    title={<span>Does the child have fever? <span className="font-normal text-xs text-slate-500 ml-1">(By temp 37.5 or more - history of fever – feeling hot)</span></span>}
                    isConditional={true}
                    yesNoValue={assessments.hasFever} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasFever: val}))}
                    classifyData={results.fever.c} treatmentData={results.fever.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 mb-4 bg-slate-50 p-3 rounded">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Duration</span>
                                <input type="number" name="feverDays" value={assessments.feverDays} onChange={(e) => setAssessments(p => ({...p, feverDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm font-medium">Days</span>
                            </div>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="dailyFever7Days" checked={assessments.dailyFever7Days} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Daily Fever for more than 7 days</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="measles3Months" checked={assessments.measles3Months} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Measles in last 3 months</span></label>
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="neckStiffness" checked={assessments.neckStiffness} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Neck stiffness</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="measlesRash" checked={assessments.measlesRash} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Generalized rash of measles</span></label>
                            <div className="text-sm border-t border-slate-200 pt-2">
                                <span className="font-medium mr-2">Malaria test</span><span className="text-xs text-slate-500">(if no danger sign or neck stiffness)</span>
                                <div className="flex gap-4 mt-2 ml-2">
                                    <label className="flex items-center space-x-1 text-sm cursor-pointer"><input type="radio" name="malariaTest" value="positive" checked={assessments.malariaTest==='positive'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>Positive (Falciparum or Vivax)</span></label>
                                    <label className="flex items-center space-x-1 text-sm cursor-pointer"><input type="radio" name="malariaTest" value="negative" checked={assessments.malariaTest==='negative'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>Negative</span></label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Measles Sub-section */}
                    <div className="border border-amber-200 bg-amber-50 p-3 rounded-md grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="text-sm font-bold text-amber-800 col-span-full">If the child have rash of measles or history of measles in the last 3 month</div>
                        <div className="space-y-2">
                            <div className="flex flex-col gap-2 text-sm">
                                <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="mouthUlcers" checked={assessments.mouthUlcers} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>Mouth ulcers,</span></label>
                                {assessments.mouthUlcers && <label className="flex items-center space-x-2 ml-6 cursor-pointer"><input type="checkbox" name="deepExtensiveUlcers" checked={assessments.deepExtensiveUlcers} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>are they deep and extensive?</span></label>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="pusFromEye" checked={assessments.pusFromEye} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>Pus draining from the eye</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="corneaClouding" checked={assessments.corneaClouding} onChange={handleCheckboxChange} className="rounded text-amber-600 w-4 h-4" /><span>Clouding of the cornea</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 5: Ear */}
                <AssessmentRow 
                    title="Does child had ear problem?"
                    isConditional={true}
                    yesNoValue={assessments.hasEarProblem} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasEarProblem: val}))}
                    classifyData={results.ear.c} treatmentData={results.ear.t}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-3 rounded">
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="earPain" checked={assessments.earPain} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Ear pain</span></label>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="earDischarge" checked={assessments.earDischarge} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Ear discharge, duration</span></label>
                                <input type="number" name="earDischargeDays" value={assessments.earDischargeDays} onChange={(e) => setAssessments(p => ({...p, earDischargeDays: e.target.value}))} className="w-16 rounded border-slate-300 sm:text-sm p-1" />
                                <span className="text-sm">Days</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="tenderSwelling" checked={assessments.tenderSwelling} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Tender swelling behind ear</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="pusFromEar" checked={assessments.pusFromEar} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Pus is seen draining from the ear</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 6: Anemia */}
                <AssessmentRow 
                    title="Check for anemia (for all patient)"
                    isConditional={false}
                    classifyData={results.anemia.c} treatmentData={results.anemia.t}
                >
                    <div className="flex flex-wrap gap-6 mt-2">
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="pallor" value="severePallor" checked={assessments.pallor==='severePallor'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>Severe palmar pallor</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="pallor" value="somePallor" checked={assessments.pallor==='somePallor'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>Some palmar pallor</span></label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="pallor" value="noPallor" checked={assessments.pallor==='noPallor'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>No palmar pallor</span></label>
                    </div>
                </AssessmentRow>

                {/* Row 7: Malnutrition */}
                <AssessmentRow 
                    title="Check for malnutrition (for all patient)"
                    isConditional={false}
                    classifyData={results.malnutrition.c} treatmentData={results.malnutrition.t}
                >
                    <div className="space-y-4 mt-2">
                        <label className="flex items-center space-x-2 text-sm font-semibold text-slate-800 cursor-pointer"><input type="checkbox" name="edema" checked={assessments.edema} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Edema of both feet</span></label>
                        
                        <div className="text-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50 p-2 rounded">
                            <span className="font-bold min-w-[70px]">Z score:</span>
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center space-x-1"><input type="radio" readOnly checked={zScoreResult.status === 'Less than -3Z'} className="text-slate-400 w-4 h-4" /><span className={zScoreResult.status === 'Less than -3Z' ? 'font-bold text-red-600' : ''}>Less than -3Z</span></label>
                                <label className="flex items-center space-x-1"><input type="radio" readOnly checked={zScoreResult.status === 'Between -3 and -2 Z'} className="text-slate-400 w-4 h-4" /><span className={zScoreResult.status === 'Between -3 and -2 Z' ? 'font-bold text-yellow-600' : ''}>Between -3 and -2 Z</span></label>
                                <label className="flex items-center space-x-1"><input type="radio" readOnly checked={zScoreResult.status === '-2 Z or more'} className="text-slate-400 w-4 h-4" /><span className={zScoreResult.status === '-2 Z or more' ? 'font-bold text-green-600' : ''}>-2 Z or more</span></label>
                            </div>
                        </div>

                        <div className="text-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50 p-2 rounded">
                            <span className="font-bold min-w-[70px]">MUAC:</span>
                            <div className="flex flex-wrap gap-4 items-center">
                                <input type="number" step="0.1" name="muacCm" placeholder="cm" value={assessments.muacCm} onChange={(e) => setAssessments(prev => ({...prev, muacCm: e.target.value}))} className="w-24 rounded-md border-slate-300 sm:text-sm p-1.5" />
                                <span className="text-xs text-slate-500">(Enter value to check complications)</span>
                            </div>
                        </div>

                        <div className="border border-sky-100 bg-sky-50 p-3 rounded-md">
                            <div className="text-sm font-bold mb-2 text-slate-700">If Z score less than -3 or MUAC less than 11.5 cm, check for:</div>
                            <label className="flex items-center space-x-2 text-sm mb-3 cursor-pointer"><input type="checkbox" name="medicalComplication" checked={assessments.medicalComplication} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Medical complication: General danger sign • Severe classification • Chest indrawing</span></label>
                            
                            <div className="text-sm font-bold mt-3 mb-2 text-slate-700 border-t border-sky-200 pt-2">Appetite test if no medical complications:</div>
                            <div className="flex gap-6">
                                <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="appetiteTest" value="passed" checked={assessments.appetiteTest==='passed'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>Passed appetite test</span></label>
                                <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="appetiteTest" value="failed" checked={assessments.appetiteTest==='failed'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>Failed appetite test</span></label>
                            </div>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 8: Vaccination & Vit A EXACT Replica */}
                <AssessmentRow 
                    title={<span>Check for vaccination and vitamin A supplementation <span className="font-normal text-xs text-slate-500 block sm:inline sm:ml-2">(check on given vaccine)</span></span>}
                    isConditional={false}
                    classifyData={results.vaccine.c} treatmentData={results.vaccine.t}
                >
                    <div className="flex flex-col gap-4 mt-2">
                        <div className="overflow-x-auto border border-slate-300 rounded-md">
                            <table className="w-full text-xs text-left border-collapse min-w-[500px]">
                                <tbody>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100 w-24">At birth</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv0" checked={assessments.v_opv0} onChange={handleCheckboxChange} className="rounded text-sky-600"/> OPV 0</label></td>
                                        <td className="p-2" colSpan={4}><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_bcg" checked={assessments.v_bcg} onChange={handleCheckboxChange} className="rounded text-sky-600"/> BCG</label></td>
                                    </tr>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">6 weeks</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv1" checked={assessments.v_opv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> OPV 1</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_rota1" checked={assessments.v_rota1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Rota 1</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_pcv1" checked={assessments.v_pcv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> PCV 1</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_penta1" checked={assessments.v_penta1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Penta 1</label></td>
                                        <td className="p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_ipv1" checked={assessments.v_ipv1} onChange={handleCheckboxChange} className="rounded text-sky-600"/> IPV 1</label></td>
                                    </tr>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">10 weeks</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv2" checked={assessments.v_opv2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> OPV 2</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_rota2" checked={assessments.v_rota2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Rota 2</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_pcv2" checked={assessments.v_pcv2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> PCV 2</label></td>
                                        <td className="p-2" colSpan={2}><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_penta2" checked={assessments.v_penta2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Penta 2</label></td>
                                    </tr>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">14 weeks</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_opv3" checked={assessments.v_opv3} onChange={handleCheckboxChange} className="rounded text-sky-600"/> OPV 3</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_rota3" checked={assessments.v_rota3} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Rota 3</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_pcv3" checked={assessments.v_pcv3} onChange={handleCheckboxChange} className="rounded text-sky-600"/> PCV 3</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_penta3" checked={assessments.v_penta3} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Penta 3</label></td>
                                        <td className="p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_ipv2" checked={assessments.v_ipv2} onChange={handleCheckboxChange} className="rounded text-sky-600"/> IPV 2</label></td>
                                    </tr>
                                    <tr className="border-b border-slate-300">
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">9 months</td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_mr" checked={assessments.v_mr} onChange={handleCheckboxChange} className="rounded text-sky-600"/> MR</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_yellowFever" checked={assessments.v_yellowFever} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Yellow fever</label></td>
                                        <td className="border-r border-slate-300 p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_menA" checked={assessments.v_menA} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Men A</label></td>
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100 text-center">18 month</td>
                                        <td className="p-2"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_mrBooster" checked={assessments.v_mrBooster} onChange={handleCheckboxChange} className="rounded text-sky-600"/> MR (booster)</label></td>
                                    </tr>
                                    <tr>
                                        <td className="border-r border-slate-300 p-2 font-bold bg-slate-100">Vitamin A</td>
                                        <td className="p-2" colSpan={5}><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" name="v_vitaminA" checked={assessments.v_vitaminA} onChange={handleCheckboxChange} className="rounded text-sky-600"/> Vitamin A (start at 6 months and given every 6 month)</label></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Row 9: Any other problems */}
                <AssessmentRow 
                    title="Any other problems?"
                    isConditional={true}
                    yesNoValue={assessments.hasOtherProblems} 
                    onYesNoChange={(val) => setAssessments(p => ({...p, hasOtherProblems: val}))}
                    classifyData={results.other.c} treatmentData={results.other.t}
                >
                    <textarea name="otherProblemsText" value={assessments.otherProblemsText} onChange={(e) => setAssessments(prev=>({...prev, otherProblemsText: e.target.value}))} rows={2} className="block w-full rounded-md border-slate-300 shadow-sm focus:ring-sky-500 sm:text-sm mt-2 p-3" placeholder="Describe other problems..."></textarea>
                </AssessmentRow>

                {/* Row 10: Mother card feeding */}
                <AssessmentRow 
                    title="Use Mother card to Assess child feeding if"
                    isConditional={false}
                    classifyData={results.feeding.c} treatmentData={results.feeding.t}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3">
                            <span className="text-sm font-bold text-slate-700 block border-b border-slate-200 pb-2 mb-3">Check if applicable:</span>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="feed_ageLess2" checked={assessments.feed_ageLess2} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Age less than 2 years</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="feed_hadMAM" checked={assessments.feed_hadMAM} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Had moderate acute malnutrition</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" name="feed_hadAnemia" checked={assessments.feed_hadAnemia} onChange={handleCheckboxChange} className="rounded text-sky-600 w-4 h-4" /><span>Had anemia</span></label>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3 flex flex-col justify-center">
                            <span className="text-sm font-bold text-slate-700 block border-b border-slate-200 pb-2 mb-3">Feeding Status:</span>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="feedingStatus" value="problem" checked={assessments.feedingStatus==='problem'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>Feeding problem</span></label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer"><input type="radio" name="feedingStatus" value="noProblem" checked={assessments.feedingStatus==='noProblem'} onChange={handleRadioChange} className="text-sky-600 w-4 h-4" /><span>No feeding problem</span></label>
                        </div>
                    </div>
                </AssessmentRow>

                {/* Footer: Follow up */}
                <div className="p-5 bg-slate-800 text-white flex flex-col sm:flex-row items-center justify-center gap-6 text-sm">
                    <span className="font-bold tracking-wide uppercase">Return follow up after:</span>
                    <div className="flex gap-5 font-semibold">
                        {[3, 5, 7, 14, 30].map(days => (
                            <label key={days} className="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="followUpDays" value={days} checked={assessments.followUpDays===String(days)} onChange={handleRadioChange} className="text-sky-400 focus:ring-sky-400 cursor-pointer w-4 h-4" /><span>{days} days</span></label>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end pb-8">
                <Button variant="primary" className="w-full md:w-auto py-3.5 shadow-lg px-12 text-lg font-bold"><ClipboardList className="w-5 h-5 mr-2 inline-block"/> Save Child Assessment</Button>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN WRAPPER COMPONENT
// ============================================================================
export default function IMNCIRecordingForm() {
    const [activeForm, setActiveForm] = useState('child');

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <PageHeader title="IMNCI Recording Form" subtitle="Select age group to begin assessment" />
            
            {/* Age Group Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-2 rounded-lg shadow-sm border border-slate-200 w-fit mx-auto lg:mx-0">
                <button 
                    onClick={() => setActiveForm('infant')} 
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-semibold transition-all duration-200 ${activeForm === 'infant' ? 'bg-sky-600 text-white shadow-md scale-105' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <Baby size={20} />
                    Sick Young Infant (Up to 2 Months)
                </button>
                <button 
                    onClick={() => setActiveForm('child')} 
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-semibold transition-all duration-200 ${activeForm === 'child' ? 'bg-sky-600 text-white shadow-md scale-105' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <User size={20} />
                    Sick Child (2 Months up to 5 Years)
                </button>
            </div>

            {/* Render Form based on Selection */}
            {activeForm === 'infant' ? <InfantForm /> : <ChildForm />}
        </div>
    );
}