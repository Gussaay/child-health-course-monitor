// MonitoringView.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Table, EmptyState, Spinner, Modal
} from "./CommonComponents";
import {
    pctBgClass, fmtPct, calcPct,
    SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAINS_BREATHING, EENC_DOMAINS_NOT_BREATHING,
    EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING,
    SKILLS_ETAT, ETAT_DOMAINS, ETAT_DOMAIN_LABEL,
    DOMAINS_BY_AGE_IMNCI, DOMAIN_LABEL_IMNCI, getClassListImnci,
    SKILLS_ICCM, ICCM_DOMAINS, ICCM_DOMAIN_LABEL,
    SKILLS_EMONC_NEONATAL, EMONC_DOMAINS_NEONATAL, EMONC_DOMAIN_LABEL_NEONATAL,
    SKILLS_EMONC_MATERNAL, EMONC_DOMAINS_MATERNAL, EMONC_DOMAIN_LABEL_MATERNAL,
    getMentorshipSubType, getCourseMentorshipService,
    IMNCI_CASE_SCENARIOS, getScenarioById, compareMentorToStandard,
} from './constants.js';
import {
    listObservationsForParticipant,
    listCasesForParticipant,
    upsertCaseAndObservations,
    deleteCaseAndObservations,
    listAllDataForCourse,
} from "../data.js";

// --- Mentorship form pieces, reused for the mentorship sub-course monitoring tab ---
import {
    IMNCIFormRenderer, IMNCI_FORM_STRUCTURE,
    getInitialFormData as getImnciInitialFormData,
    calculateScores as calculateImnciScores,
    isVitalSignsComplete, isDangerSignsComplete, isMainSymptomsComplete,
    isMalnutritionComplete, isAnemiaComplete, isImmunizationComplete,
    isOtherProblemsComplete, isDecisionComplete, isRecordingComplete,
} from './mentorship/IMNCSkillsAssessmentForm.jsx';

import {
    EENCFormRenderer,
    getInitialFormData as getEencInitialFormData,
    calculateScores as calculateEencScores,
    PREPARATION_ITEMS, DRYING_STIMULATION_ITEMS,
    NORMAL_BREATHING_ITEMS, RESUSCITATION_ITEMS,
} from './mentorship/EENCSkillsAssessmentForm.jsx';

// Visit report, reused for mentor training. The onSaveOverride prop keeps the
// training copy inside course records instead of the mentorship collection.
import { IMNCIVisitReport, EENCVisitReport } from './mentorship/VisitReports.jsx';

// The mentorship practice tab now opens the same forms the facility mentorship
// view opens, for every training rather than only IMNCI and EENC, and saves the
// result as a course report. Re-exported here so Course.jsx keeps importing
// `MentorshipMonitoringView` from this module and needs no change.
export { MentorshipMonitoringView } from './CourseMentorshipMonitoringView.jsx';

// --- HELPERS for Performance Optimization ---
const generateHash = (buffer) => {
    return Object.keys(buffer)
        .sort()
        .map(k => `${k}:${buffer[k]}`)
        .join('|');
};

// --- REUSABLE COMPONENT for the Segmented Control UI ---
function ActionToggle({ options, currentValue, onClick }) {
    return (
        <div className="relative z-0 flex w-full sm:inline-flex sm:w-auto shadow-sm rounded-md sm:flex-shrink-0">
            {options.map(([label, value, activeClass], idx) => {
                const isSelected = currentValue === value;
                const baseClass = "relative inline-flex flex-1 sm:flex-none items-center justify-center px-3 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-sm font-medium leading-tight whitespace-nowrap touch-manipulation focus:z-10 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition";
                const activeState = isSelected ? `${activeClass} text-white` : "bg-white text-gray-700 hover:bg-gray-50";
                
                let roundedClass = "";
                if (idx === 0) roundedClass = "rounded-l-md";
                if (idx === options.length - 1) roundedClass = "rounded-r-md";
                if (options.length === 1) roundedClass = "rounded-md";
                if (idx > 0) roundedClass += " -ml-px border border-gray-300";
                else roundedClass += " border border-gray-300";

                return (
                    <button
                        key={value}
                        type="button"
                        className={`${baseClass} ${activeState} ${roundedClass}`}
                        onClick={() => onClick(value)}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

export function ObservationView({ course, participant, participants, onChangeParticipant, initialCaseToEdit, isPublicView = false }) {
    const [observations, setObservations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [encounterDate, setEncounterDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dayOfCourse, setDayOfCourse] = useState(1);
    const [setting, setSetting] = useState("OPD");
    const [age, setAge] = useState("GE2M_LE5Y");
    const [caseSerial, setCaseSerial] = useState(1);
    const [caseAgeMonths, setCaseAgeMonths] = useState('');
    const [buffer, setBuffer] = useState({});
    const [editingCase, setEditingCase] = useState(null);
    const [eencScenario, setEencScenario] = useState('breathing');
    const [isSaving, setIsSaving] = useState(false);
    
    const [showSetupModal, setShowSetupModal] = useState(true);
    const [showGrid, setShowGrid] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC' || course.course_type === 'EmONC';
    const isLegalEtat = course.course_type === 'ETAT';
    const isIccm = course.course_type === 'ICCM';

    const handleEditCase = (caseToEdit, allObservations) => {
        if (!caseToEdit || !allObservations) return;
        setEditingCase(caseToEdit);
        setEncounterDate(caseToEdit.encounter_date);
        setDayOfCourse(caseToEdit.day_of_course);
        if (isImnci) { setSetting(caseToEdit.setting); setAge(caseToEdit.age_group); }
        if (isEenc) { setEencScenario(caseToEdit.age_group.replace('EENC_', '')); }
        
        const caseObs = allObservations.filter(o => o.caseId === caseToEdit.id);
        const newBuffer = {};
        caseObs.forEach(o => { newBuffer[`${o.domain}|${o.item_recorded}`] = o.item_correct; });
        setBuffer(newBuffer);
        setShowSetupModal(false);
        setShowGrid(true);
        window.scrollTo(0, 0);
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!participant?.id || !course?.id) return;

            setLoading(true);
            setError(null);
            let obsData, casesData;

            try {
                [obsData, casesData] = await Promise.all([
                    listObservationsForParticipant(course.id, participant.id),
                    listCasesForParticipant(course.id, participant.id)
                ]);
                setObservations(obsData);
                setCases(casesData);
            } catch (err) {
                console.error("Failed to fetch monitoring data:", err);
                setError("Could not load participant's data. Please check your internet connection and try again.");
                setObservations([]);
                setCases([]);
            } finally {
                setLoading(false);
            }
            
            if (initialCaseToEdit && casesData) {
                const fullCaseObject = casesData.find(c => c.id === initialCaseToEdit.id);
                if (fullCaseObject && obsData) {
                    setTimeout(() => handleEditCase(fullCaseObject, obsData), 100);
                }
            }
        };
        fetchData();
    }, [participant?.id, course?.id, initialCaseToEdit]);

    useEffect(() => {
        if (editingCase) return;
        const sameDayCases = cases.filter(c => c.day_of_course === dayOfCourse);
        const maxS = sameDayCases.reduce((m, x) => Math.max(m, x.case_serial || 0), 0);
        setCaseSerial(Math.max(1, maxS + 1));
    }, [cases, dayOfCourse, editingCase]);

    const toggle = (d, cls, v) => {
        const k = `${d}|${cls}`;
        setBuffer(prev => (prev[k] === v ? (({ [k]: _, ...rest }) => rest)(prev) : { ...prev, [k]: v }));
    };

    const submitCase = async () => {
        if (isSaving) return; 

        if (!editingCase) { 
            const newHash = generateHash(buffer);
            if (newHash.length > 0) {
                const duplicateCase = cases.find(c => c.contentHash === newHash);
                if (duplicateCase) {
                    const confirmSubmit = window.confirm(
                        `WARNING: This case appears to be an exact duplicate of a case previously submitted on ${duplicateCase.encounter_date} (Serial #${duplicateCase.case_serial}).\n\nAre you sure you want to submit this duplicate case?`
                    );
                    if (!confirmSubmit) return; 
                }
            }
        }

        setIsSaving(true);
        const entries = Object.entries(buffer);

        if (isEenc) {
            let skillsMap;
            if (eencScenario === 'breathing') skillsMap = SKILLS_EENC_BREATHING;
            else if (eencScenario === 'not_breathing') skillsMap = SKILLS_EENC_NOT_BREATHING;
            else if (eencScenario === 'neonatal_emergency') skillsMap = SKILLS_EMONC_NEONATAL;
            else if (eencScenario === 'maternal_emergency') skillsMap = SKILLS_EMONC_MATERNAL;

            const totalSkills = Object.values(skillsMap || {}).reduce((acc, domain) => acc + domain.length, 0);
            if (entries.length < totalSkills) {
                alert('Please complete the form before submission');
                setIsSaving(false);
                return;
            }
        }

        if (entries.length === 0) { 
            alert('No skills/classifications selected.'); 
            setIsSaving(false);
            return; 
        }

        const currentCaseSerial = editingCase ? editingCase.case_serial : caseSerial;
        const allCorrect = entries.every(([, v]) => v > 0);

        let ageGroup;
        if (isImnci) ageGroup = age;
        else if (isEenc) ageGroup = `EENC_${eencScenario}`;
        else if (isLegalEtat) ageGroup = 'ETAT';
        else if (isIccm) ageGroup = 'ICCM';
        else ageGroup = 'N/A';

        const caseData = {
            courseId: course.id, participant_id: participant.id, encounter_date: encounterDate,
            setting: isImnci ? setting : 'N/A', 
            age_group: ageGroup, 
            case_serial: currentCaseSerial, day_of_course: dayOfCourse, allCorrect: allCorrect,
            contentHash: generateHash(buffer)
        };

        const newObservations = entries.map(([k, v]) => {
            const [domain, skill_or_class] = k.split('|');
            const observationData = {
                courseId: course.id, course_type: course.course_type, encounter_date: encounterDate,
                day_of_course: dayOfCourse, setting: isImnci ? setting : 'N/A', participant_id: participant.id,
                domain: domain, item_recorded: skill_or_class, item_correct: v, case_serial: currentCaseSerial,
            };

            let ageGroupForObs;
            if (isImnci) ageGroupForObs = age;
            else if (isEenc) ageGroupForObs = eencScenario;
            if (ageGroupForObs) observationData.age_group = ageGroupForObs;
            
            if (caseAgeMonths !== '' && caseAgeMonths !== null) {
                observationData.case_age_months = Number(caseAgeMonths);
            }
            return observationData;
        });

        try {
            const { savedCase, savedObservations } = await upsertCaseAndObservations(caseData, newObservations, editingCase?.id);

            if (editingCase) {
                setCases(prevCases => prevCases.map(c => c.id === editingCase.id ? savedCase : c));
                setObservations(prevObs => [
                    ...prevObs.filter(o => o.caseId !== editingCase.id),
                    ...savedObservations
                ]);
            } else {
                setCases(prevCases => [...prevCases, savedCase]);
                setObservations(prevObs => [...prevObs, ...savedObservations]);
            }

            setShowSuccessModal(true);
            setBuffer({});
            setCaseAgeMonths('');
            setEditingCase(null);
        } catch (error) {
            console.error("ERROR saving to Firestore:", error);
            alert(`Failed to save case: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCase = async (caseToDelete) => {
        if (!window.confirm('Delete this case and all its observations? This cannot be undone.')) return;

        // 1. Capture the current state in case we need to revert
        const previousCases = [...cases];
        const previousObservations = [...observations];

        // 2. Optimistically update the UI instantly
        setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
        setObservations(prev => prev.filter(o => o.caseId !== caseToDelete.id));

        // 3. Perform the backend deletion
        try {
            await deleteCaseAndObservations(caseToDelete.id);
        } catch (error) {
            console.error("Failed to delete case:", error);
            
            // 4. Revert the UI back to original state if the backend fails
            setCases(previousCases);
            setObservations(previousObservations);
            
            alert(`Failed to delete case: ${error.message}. The case has been restored in your view.`);
        }
    };

    return (
        <div className="grid gap-2">
            <PageHeader title="Clinical Monitoring" subtitle={`Observing: ${participant.name}`} />
            
            {error && <Card><div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">{error}</div></Card>}
            
            {/* Success Modal Pop-up */}
            <Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} title="Submission Successful">
                <div className="p-6 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="rounded-full bg-green-100 p-3">
                            <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Case Saved Successfully!</h3>
                    <p className="text-gray-600 mb-6">The clinical observation has been recorded.</p>
                    <Button onClick={() => { setShowSuccessModal(false); setShowGrid(false); setShowSetupModal(true); }} className="w-full bg-green-600 hover:bg-green-700 border-green-600">
                        Continue to Next Case
                    </Button>
                </div>
            </Modal>

            {/* Case Setup Modal */}
            <Modal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} title="Case Setup Configuration" size="lg">
                <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {!isPublicView && (
                            <FormGroup label="Select participant" className="sm:col-span-2">
                                <Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)}>
                                    {participants.map(p => <option key={p.id} value={p.id}>{p.name} — {p.group}</option>)}
                                </Select>
                            </FormGroup>
                        )}
                        {isImnci && <FormGroup label="Setting"><Select value={setting} onChange={(e) => setSetting(e.target.value)}><option value="OPD">Out-patient</option><option value="IPD">In-patient</option></Select></FormGroup>}
                        {isImnci && <FormGroup label="Age Band">
                            <Select value={age} onChange={(e) => { setAge(e.target.value); if (editingCase) { setBuffer({}); } }}>
                                <option value="GE2M_LE5Y">Sick Child (2-59 mos)</option>
                                <option value="LT2M">Young Infant (0-59 days)</option>
                            </Select>
                        </FormGroup>}
                        {isEenc && <FormGroup label={course.course_type === 'EmONC' ? "EmONC Module" : "EENC Scenario"}>
                            <Select value={eencScenario} onChange={(e) => setEencScenario(e.target.value)} disabled={!!editingCase}>
                                <option value="breathing">Essential Newborn Care (Breathing)</option>
                                <option value="not_breathing">Essential Newborn Care (Not Breathing)</option>
                                {course.course_type === 'EmONC' && (
                                    <>
                                        <option value="neonatal_emergency">Neonatal Emergency Care</option>
                                        <option value="maternal_emergency">Maternal Emergency Care</option>
                                    </>
                                )}
                            </Select>
                        </FormGroup>}
                        <FormGroup label="Encounter Date"><Input type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} /></FormGroup>
                        <FormGroup label="Course Day"><Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</Select></FormGroup>
                        <FormGroup label={isImnci && age === 'LT2M' ? "Age (wks)" : "Age (mos)"}>
                            <Input type="number" value={caseAgeMonths} onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" />
                        </FormGroup>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-gray-50 rounded-b-lg">
                    <Button variant="secondary" className="w-full sm:w-auto" onClick={() => { setShowSetupModal(false); setShowGrid(false); }}>Close</Button>
                    <Button className="w-full sm:w-auto" onClick={() => { setShowSetupModal(false); setShowGrid(true); }}>Confirm & Start</Button>
                </div>
            </Modal>

            {/* Main Action Bar */}
            {!showGrid && !loading && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-800">Ready to monitor?</h3>
                        <p className="text-sm text-slate-500">Start a new observation case for {participant.name}.</p>
                    </div>
                    <Button className="w-full sm:w-auto flex-shrink-0" onClick={() => { setBuffer({}); setEditingCase(null); setShowSetupModal(true); }}>
                        + Start New Case
                    </Button>
                </div>
            )}

            {showGrid && (
                <Card className="p-3 sm:p-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 bg-slate-50 p-3 rounded-md border border-slate-200">
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold break-words">{editingCase ? `Editing Case #${editingCase.case_serial}` : 'New Case Observation'}</h3>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 mt-1">
                                <span><span className="font-semibold">Day:</span> {dayOfCourse}</span>
                                <span><span className="font-semibold">Date:</span> {encounterDate}</span>
                                {isImnci && <>
                                    <span><span className="font-semibold">Setting:</span> {setting}</span>
                                    <span><span className="font-semibold">Age:</span> {age === 'LT2M' ? '0-59d' : '2-59m'}</span>
                                </>}
                                {isEenc && <span><span className="font-semibold">Scenario:</span> {
                                    eencScenario === 'breathing' ? 'ENC (Breathing)' :
                                    eencScenario === 'not_breathing' ? 'ENC (Not Breathing)' :
                                    eencScenario === 'neonatal_emergency' ? 'Neonatal Emergency' : 'Maternal Emergency'
                                }</span>}
                            </div>
                        </div>
                        <Button variant="secondary" size="sm" className="w-full sm:w-auto flex-shrink-0" onClick={() => setShowSetupModal(true)}>
                            Edit Setup
                        </Button>
                    </div>

                    <p className="text-sm text-gray-600 mb-3">Click a domain title to expand/collapse. Select an action for each item.</p>
                    <div className="rounded-lg border border-slate-300">
                        {isImnci && <ImnciMonitoringGrid age={age} buffer={buffer} toggle={toggle} />}
                        {isEenc && <EencMonitoringGrid scenario={eencScenario} buffer={buffer} toggle={toggle} />}
                        {isLegalEtat && <EtatMonitoringGrid buffer={buffer} toggle={toggle} />}
                        {isIccm && <IccmMonitoringGrid buffer={buffer} toggle={toggle} />}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-end mt-4 border-t pt-4">
                        <Button onClick={submitCase} className="w-full sm:w-auto" disabled={isSaving}>
                            {isSaving ? 'Saving...' : (editingCase ? 'Update Case' : 'Submit Case')}
                        </Button>
                        <Button variant="secondary" onClick={() => { setBuffer({}); setEditingCase(null); setCaseAgeMonths(''); setShowGrid(false); }} className="w-full sm:w-auto" disabled={isSaving}>
                            {editingCase ? 'Cancel Edit' : 'Discard Case'}
                        </Button>
                    </div>
                </Card>
            )}
            
            {loading ? <Card><Spinner /></Card> : <SubmittedCases course={course} participant={participant} observations={observations} cases={cases} onEditCase={(caseToEdit) => handleEditCase(caseToEdit, observations)} onDeleteCase={handleDeleteCase} />}
        </div>
    );
}

function ImnciMonitoringGrid({ age, buffer, toggle }) {
    const [expandedDomains, setExpandedDomains] = useState(new Set());
    const allDomains = DOMAINS_BY_AGE_IMNCI[age]; 

    useEffect(() => {
        const defaultDomains = DOMAINS_BY_AGE_IMNCI[age] || [];
        setExpandedDomains(new Set(defaultDomains.slice(0, 2)));
    }, [age]);

    const toggleDomain = (domain) => {
        setExpandedDomains(prev => {
            const newSet = new Set(prev);
            if (newSet.has(domain)) newSet.delete(domain);
            else newSet.add(domain);
            return newSet;
        });
    };

    const toggleOptions = [
        ['Correct', 1, 'bg-green-600 border-green-600'],
        ['Incorrect', 0, 'bg-red-600 border-red-600']
    ];

    return (
        <div className="space-y-4">
            <div className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm justify-between items-center">
                <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">Click domains to expand/collapse</span>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpandedDomains(new Set(allDomains))}>Expand All</Button>
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
                </div>
            </div>

            <div className="space-y-3">
                {allDomains.map(d => {
                    const isExpanded = expandedDomains.has(d);
                    const list = getClassListImnci(age, d) || [];
                    const title = DOMAIN_LABEL_IMNCI[d] || d;

                    return (
                        <div key={d} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                            <button 
                                type="button"
                                onClick={() => toggleDomain(d)} 
                                className={`w-full flex items-center justify-between gap-3 p-4 text-left transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                            >
                                <h4 className="min-w-0 flex-1 text-sm sm:text-base font-bold text-slate-800 text-left break-words">{title}</h4>
                                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            
                            {isExpanded && (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {(list.length > 0 ? list : ["(no items)"]).map((item, i) => {
                                        const k = `${d}|${item}`;
                                        const mark = buffer[k];
                                        return (
                                            <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group">
                                                <span className="min-w-0 flex-1 font-medium text-slate-700 break-words group-hover:text-slate-900">{item}</span>
                                                <ActionToggle
                                                    options={toggleOptions}
                                                    currentValue={mark}
                                                    onClick={(value) => toggle(d, item, value)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function EtatMonitoringGrid({ buffer, toggle }) {
    const allDomains = ETAT_DOMAINS; 
    const [expandedDomains, setExpandedDomains] = useState(new Set(allDomains.slice(0, 2)));

    const toggleDomain = (domain) => {
        setExpandedDomains(prev => {
            const newSet = new Set(prev);
            if (newSet.has(domain)) newSet.delete(domain);
            else newSet.add(domain);
            return newSet;
        });
    };

    const toggleOptions = [
        ['Correct', 1, 'bg-green-600 border-green-600'],
        ['Incorrect', 0, 'bg-red-600 border-red-600']
    ];

    return (
        <div className="space-y-4">
            <div className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm justify-between items-center">
                <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">Click domains to expand/collapse</span>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpandedDomains(new Set(allDomains))}>Expand All</Button>
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
                </div>
            </div>

            <div className="space-y-3">
                {allDomains.map(d => {
                    const isExpanded = expandedDomains.has(d);
                    const skills = SKILLS_ETAT[d];
                    const title = ETAT_DOMAIN_LABEL[d] || d;

                    return (
                        <div key={d} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                            <button 
                                type="button"
                                onClick={() => toggleDomain(d)} 
                                className={`w-full flex items-center justify-between gap-3 p-4 text-left transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                            >
                                <h4 className="min-w-0 flex-1 text-sm sm:text-base font-bold text-slate-800 text-left break-words">{title}</h4>
                                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            
                            {isExpanded && (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {skills.map((item, i) => {
                                        const k = `${d}|${item}`;
                                        const mark = buffer[k];
                                        return (
                                            <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group">
                                                <span className="min-w-0 flex-1 font-medium text-slate-700 break-words group-hover:text-slate-900">{item}</span>
                                                <ActionToggle
                                                    options={toggleOptions}
                                                    currentValue={mark}
                                                    onClick={(value) => toggle(d, item, value)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function EencMonitoringGrid({ scenario, buffer, toggle }) {
    let domains, skillsMap, labelsMap;

    if (scenario === 'breathing') {
        domains = EENC_DOMAINS_BREATHING;
        skillsMap = SKILLS_EENC_BREATHING;
        labelsMap = EENC_DOMAIN_LABEL_BREATHING;
    } else if (scenario === 'not_breathing') {
        domains = EENC_DOMAINS_NOT_BREATHING;
        skillsMap = SKILLS_EENC_NOT_BREATHING;
        labelsMap = EENC_DOMAIN_LABEL_NOT_BREATHING;
    } else if (scenario === 'neonatal_emergency') {
        domains = EMONC_DOMAINS_NEONATAL;
        skillsMap = SKILLS_EMONC_NEONATAL;
        labelsMap = EMONC_DOMAIN_LABEL_NEONATAL;
    } else if (scenario === 'maternal_emergency') {
        domains = EMONC_DOMAINS_MATERNAL;
        skillsMap = SKILLS_EMONC_MATERNAL;
        labelsMap = EMONC_DOMAIN_LABEL_MATERNAL;
    }
    
    const [expandedDomains, setExpandedDomains] = useState(new Set());
    const allDomains = domains || []; 

    useEffect(() => {
        setExpandedDomains(new Set(allDomains.slice(0, 2)));
    }, [allDomains]);

    const toggleDomain = (domain) => {
        setExpandedDomains(prev => {
            const newSet = new Set(prev);
            if (newSet.has(domain)) newSet.delete(domain);
            else newSet.add(domain);
            return newSet;
        });
    };

    const toggleOptions = [
        ['Yes', 2, 'bg-green-600 border-green-600'],
        ['Partial', 1, 'bg-yellow-500 border-yellow-500'],
        ['No', 0, 'bg-red-600 border-red-600']
    ];

    return (
        <div className="space-y-4">
            <div className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm justify-between items-center">
                <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">Click domains to expand/collapse</span>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpandedDomains(new Set(allDomains))}>Expand All</Button>
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
                </div>
            </div>

            <div className="space-y-3">
                {allDomains.map(d => {
                    const isExpanded = expandedDomains.has(d);
                    const skills = skillsMap[d];
                    const title = labelsMap[d] || d;

                    return (
                        <div key={d} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                            <button 
                                type="button"
                                onClick={() => toggleDomain(d)} 
                                className={`w-full flex items-center justify-between gap-3 p-4 text-left transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                            >
                                <h4 className="min-w-0 flex-1 text-sm sm:text-base font-bold text-slate-800 text-left break-words">{title}</h4>
                                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            
                            {isExpanded && (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {skills.map((item, i) => {
                                        const k = `${d}|${item.text}`;
                                        const mark = buffer[k];
                                        return (
                                            <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group">
                                                <span className="min-w-0 flex-1 font-medium text-slate-700 break-words group-hover:text-slate-900">{item.text}</span>
                                                <ActionToggle
                                                    options={toggleOptions}
                                                    currentValue={mark}
                                                    onClick={(value) => toggle(d, item.text, value)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function IccmMonitoringGrid({ buffer, toggle }) {
    const allDomains = ICCM_DOMAINS; 
    const [expandedDomains, setExpandedDomains] = useState(new Set(allDomains.slice(0, 2)));

    const toggleDomain = (domain) => {
        setExpandedDomains(prev => {
            const newSet = new Set(prev);
            if (newSet.has(domain)) newSet.delete(domain);
            else newSet.add(domain);
            return newSet;
        });
    };

    const toggleOptions = [
        ['Correct', 1, 'bg-green-600 border-green-600'],
        ['Incorrect', 0, 'bg-red-600 border-red-600']
    ];

    return (
        <div className="space-y-4">
            <div className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm justify-between items-center">
                <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">Click domains to expand/collapse</span>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpandedDomains(new Set(allDomains))}>Expand All</Button>
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
                </div>
            </div>

            <div className="space-y-3">
                {allDomains.map(d => {
                    const isExpanded = expandedDomains.has(d);
                    const skills = SKILLS_ICCM[d];
                    const title = ICCM_DOMAIN_LABEL[d] || d;

                    return (
                        <div key={d} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                            <button 
                                type="button"
                                onClick={() => toggleDomain(d)} 
                                className={`w-full flex items-center justify-between gap-3 p-4 text-left transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                            >
                                <h4 className="min-w-0 flex-1 text-sm sm:text-base font-bold text-slate-800 text-left break-words">{title}</h4>
                                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            
                            {isExpanded && (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {skills.map((item, i) => {
                                        const k = `${d}|${item}`;
                                        const mark = buffer[k];
                                        return (
                                            <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group">
                                                <span className="min-w-0 flex-1 font-medium text-slate-700 break-words group-hover:text-slate-900">{item}</span>
                                                <ActionToggle
                                                    options={toggleOptions}
                                                    currentValue={mark}
                                                    onClick={(value) => toggle(d, item, value)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SubmittedCases({ course, participant, observations, cases, onEditCase, onDeleteCase }) {
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC' || course.course_type === 'EmONC';

    const [dayFilter, setDayFilter] = useState('all');
    const [settingFilter, setSettingFilter] = useState('all');
    const [correctnessFilter, setCorrectnessFilter] = useState('all');

    const caseRows = useMemo(() => {
        const mappedAndFiltered = cases.map(c => {
            const relatedObs = observations.filter(o => o.caseId === c.id);
            let rowData = { ...c, date: c.encounter_date, setting: c.setting, age: c.age_group, serial: c.case_serial, day: c.day_of_course };

            if (isEenc) {
                const maxScore = relatedObs.length * 2;
                const score = relatedObs.reduce((sum, obs) => sum + obs.item_correct, 0);
                const percentage = calcPct(score, maxScore);
                rowData = { ...rowData, score, percentage };
            } else {
                const total = relatedObs.length;
                const correct = relatedObs.filter(o => o.item_correct > 0).length;
                const pct = calcPct(correct, total);
                rowData = { ...rowData, total, correct, percentage: pct };
            }
            return rowData;
        }).filter(c => {
            const dayMatch = dayFilter === 'all' || c.day === Number(dayFilter);
            const settingMatch = settingFilter === 'all' || c.setting === settingFilter;
            const correctnessMatch = correctnessFilter === 'all' ||
                (correctnessFilter === 'correct' && c.allCorrect) ||
                (correctnessFilter === 'incorrect' && !c.allCorrect);
            return dayMatch && settingMatch && correctnessMatch;
        });

        return mappedAndFiltered.sort((a, b) => (b.day - a.day) || (b.serial - a.serial));
    }, [cases, observations, isEenc, dayFilter, settingFilter, correctnessFilter]);

    const getAgeLabel = (age) => {
        if (isImnci) return age === 'LT2M' ? '0-59 d' : '2-59 m';
        if (isEenc) {
            if (age?.includes('breathing') && !age.includes('not_')) return 'ENC (Breathing)';
            if (age?.includes('not_breathing')) return 'ENC (Not Breathing)';
            if (age?.includes('neonatal_emergency')) return 'Neonatal Emergency';
            if (age?.includes('maternal_emergency')) return 'Maternal Emergency';
        }
        return age;
    };

    const headers = isEenc
        ? ["Date", "Day", "Scenario", "Score", "% Score", "Actions"]
        : ["Date", "Day", ...(isImnci ? ["Setting"] : []), "Age Band", "% Correct", "Actions"];

    return (
        <Card>
            <PageHeader title={`Submitted Cases for ${participant.name}`} />
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:gap-4 p-4 border-b border-slate-300 bg-slate-50 sm:items-center">
                <FormGroup label="Filter by Day" className="!mb-0">
                    <Select value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
                        <option value="all">All</option>
                        {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}
                    </Select>
                </FormGroup>
                {isImnci && (
                    <FormGroup label="Filter by Setting" className="!mb-0">
                        <Select value={settingFilter} onChange={e => setSettingFilter(e.target.value)}>
                            <option value="all">All</option>
                            <option value="OPD">Out-patient</option>
                            <option value="IPD">In-patient</option>
                        </Select>
                    </FormGroup>
                )}
                <FormGroup label="Filter by Result" className="!mb-0">
                    <Select value={correctnessFilter} onChange={e => setCorrectnessFilter(e.target.value)}>
                        <option value="all">All</option>
                        <option value="correct">All Items Correct</option>
                        <option value="incorrect">Has Incorrect Items</option>
                    </Select>
                </FormGroup>
            </div>
            
            {/* Mobile View */}
            <div className="md:hidden">
                {caseRows.length === 0 ? <div className="p-4 text-center text-gray-500">No cases match the current filters.</div> : 
                    <div className="space-y-3 p-3">
                        {caseRows.map((c) => (
                            <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="min-w-0">
                                        <span className="font-bold text-slate-700">{c.date}</span>
                                        <span className="text-sm text-slate-500"> (Day {c.day})</span>
                                    </div>
                                    <span className={`text-sm font-mono p-1 rounded flex-shrink-0 ${pctBgClass(c.percentage)}`}>{fmtPct(c.percentage)}</span>
                                </div>
                                <div className="text-sm text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1">
                                    {isImnci && <span><span className="font-semibold">Setting:</span> {c.setting}</span>}
                                    <span><span className="font-semibold">Scenario:</span> {getAgeLabel(c.age)}</span>
                                    {isEenc ? 
                                      <span><span className="font-semibold">Score:</span> {c.score}</span>
                                      : <span><span className="font-semibold">Items:</span> {c.total} ({c.correct} correct)</span>
                                    }
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-200 mt-2">
                                    <Button size="sm" variant="secondary" onClick={() => onEditCase(c)}>Edit</Button>
                                    <Button size="sm" variant="danger" onClick={() => onDeleteCase(c)}>Delete</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                }
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto p-4">
                <Table headers={headers}>
                    {caseRows.length === 0 ? <EmptyState message="No cases match the current filters." colSpan={headers.length} /> : caseRows.map((c, idx) => (
                        <tr key={idx} className="odd:bg-white even:bg-slate-50 hover:bg-sky-100 text-sm">
                            <td className="p-2 border-b border-slate-300">{c.date}</td>
                            <td className="p-2 border-b border-slate-300 text-center">{c.day ?? ''}</td>
                            {isImnci && <td className="p-2 border-b border-slate-300">{c.setting}</td>}
                            <td className="p-2 border-b border-slate-300">{getAgeLabel(c.age)}</td>
                            {isEenc ? (
                                <>
                                    <td className="p-2 border-b border-slate-300 text-center">{c.score}</td>
                                    <td className={`p-2 font-mono text-center border-b border-slate-300 ${pctBgClass(c.percentage)}`}>{fmtPct(c.percentage)}</td>
                                </>
                            ) : (
                                <>
                                    <td className={`p-2 font-mono text-center border-b border-slate-300 ${pctBgClass(c.percentage)}`}>{fmtPct(c.percentage)}</td>
                                </>
                            )}
                            <td className="p-2 border-b border-slate-300">
                                <div className="flex gap-2 justify-end">
                                    <Button size="sm" variant="secondary" onClick={() => onEditCase(c)}>Edit</Button>
                                    <Button size="sm" variant="danger" onClick={() => onDeleteCase(c)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
        </Card>
    );
}


// ============================================================================
// BLOCK B — append to the END of MonitoringView.jsx
// ============================================================================
//
// The mentorship monitoring tab lives here because this file already owns the
// monitoring tab and already imports every data function needed —
// listObservationsForParticipant, listCasesForParticipant,
// upsertCaseAndObservations and deleteCaseAndObservations are all in the import
// block at the top. No new data imports are required.
//
// This deliberately does NOT import saveMentorshipSession. A mentorship
// sub-course is training, not a facility mentorship visit: the record belongs to
// the course. Neither SkillsAssessmentForm nor EENCSkillsAssessmentForm can be
// mounted directly for the same reason — both autosave into the mentorship
// sessions collection. What is reused is their renderers and pure scoring logic.

// --- ADD THESE IMPORTS to the top of MonitoringView.jsx ---------------------


// --- Skill maps -------------------------------------------------------------

// Symptom skills that getInitialFormData() adds outside IMNCI_FORM_STRUCTURE.
// Labels copied from IMNCIFormRenderer so a saved observation reads identically
// to what the mentor saw on screen.
const MENTORSHIP_EXTRA_SYMPTOM_SKILLS = {
    skill_check_rr: 'هل قاس معدل التنفس بصورة صحيحة',
    skill_classify_cough: 'هل صنف الكحة بصورة صحيحة',
    skill_check_dehydration: 'هل قيم فقدان السوائل بصورة صحيحة',
    skill_classify_diarrhea: 'هل صنف الاسهال بصورة صحيحة',
    skill_check_rdt: 'هل أجرى فحص الملاريا السريع بصورة صحيحة',
    skill_classify_fever: 'هل صنف الحمى بصورة صحيحة',
    skill_check_ear: 'هل فحص الفحص ورم مؤلم خلف الأذن',
    skill_classify_ear: 'هل صنف مشكلة الأذن بصورة صحيحة',
};

// Derived from IMNCI_FORM_STRUCTURE rather than hand-written, so editing the form
// keeps the reports in step automatically.
const buildImnciMentorshipMaps = () => {
    const skills = {};
    const labels = {};
    const keyToItem = {};

    const push = (domain, key, label) => {
        if (!key || !label) return;
        skills[domain] ??= [];
        if (!skills[domain].includes(label)) skills[domain].push(label);
        keyToItem[key] = { domain, item: label };
    };

    IMNCI_FORM_STRUCTURE.forEach(group => {
        if (group.isDecisionSection) {
            labels[group.scoreKey] = group.group;
            return;
        }
        (group.subgroups || []).forEach(subgroup => {
            const domain = subgroup.scoreKey || group.scoreKey;
            if (!domain) return;
            labels[domain] = subgroup.subgroupTitle || group.group;

            if (subgroup.isSymptomGroupContainer) {
                (subgroup.symptomGroups || []).forEach(sg => {
                    push(domain, sg.mainSkill?.key, sg.mainSkill?.label);
                });
            } else {
                (subgroup.skills || []).forEach(skill => push(domain, skill.key, skill.label));
            }
        });
    });

    Object.entries(MENTORSHIP_EXTRA_SYMPTOM_SKILLS).forEach(([key, label]) => {
        push('mainSymptoms', key, label);
    });

    return { skills, labels, keyToItem };
};

const buildEencMentorshipMaps = () => {
    const sections = [
        { domain: 'preparation', label: '1. تحضيرات ما قبل الولادة', items: PREPARATION_ITEMS },
        { domain: 'drying', label: '2. التجفيف، التحفيز، التدفئة والشفط', items: DRYING_STIMULATION_ITEMS },
        { domain: 'normal_breathing', label: '4. متابعة طفل يتنفس طبيعياً', items: NORMAL_BREATHING_ITEMS },
        { domain: 'resuscitation', label: '5. إنعاش الوليد', items: RESUSCITATION_ITEMS },
    ];

    const skills = {};
    const labels = {};
    const keyToItem = {};

    sections.forEach(({ domain, label, items }) => {
        labels[domain] = label;
        skills[domain] = items.map(i => i.label);
        items.forEach(i => { keyToItem[i.key] = { domain, item: i.label }; });
    });

    return { skills, labels, keyToItem };
};

const IMNCI_MENTORSHIP_MAPS = buildImnciMentorshipMaps();
const EENC_MENTORSHIP_MAPS = buildEencMentorshipMaps();

// Exported for ReportsView.jsx.
//
// Only IMNCI and EENC have a hard-coded skill map here. Anything else — ETAT and
// IPC, which the course practice tab now records against — returns an empty map
// rather than falling through to IMNCI, because IMNCI labels on an ETAT record
// are worse than no labels: they read as real skill names and nothing marks them
// as wrong. Those records carry their own domain names on `item_recorded`, so a
// caller that finds no map should render straight off the observations.
export const getMentorshipSkillMaps = (service) => {
    const maps = service === 'EENC' ? EENC_MENTORSHIP_MAPS
        : service === 'IMNCI' ? IMNCI_MENTORSHIP_MAPS
            : null;
    if (!maps) return { skills: {}, domains: [], labels: {} };
    return { skills: maps.skills, domains: Object.keys(maps.skills), labels: maps.labels };
};

// Observations store the human-readable label, so editing a saved session needs
// the reverse lookup. Built from the same source as the forward maps, so the two
// can never drift apart.
const buildReverseMentorshipMap = (keyToItem) =>
    Object.entries(keyToItem).reduce((acc, [key, { item }]) => { acc[item] = key; return acc; }, {});

const ITEM_TO_KEY_IMNCI = buildReverseMentorshipMap(IMNCI_MENTORSHIP_MAPS.keyToItem);
const ITEM_TO_KEY_EENC = buildReverseMentorshipMap(EENC_MENTORSHIP_MAPS.keyToItem);

// --- Form to observations ---------------------------------------------------

// 'na' and '' are deliberately dropped rather than stored as 0. A skill that did
// not apply to this encounter is not a failed skill, and counting it as one would
// understate the participant in every report that divides correct by total. For
// EENC this matters a lot: a normal breathing delivery leaves all 13
// resuscitation items 'na'.
//
// IMNCI is binary. EENC is three-valued and scores 2 / 1 / 0, which is already
// what the EENC observation grid above stores, so mentorship EENC records stay
// comparable with grid-recorded ones.
const MENTORSHIP_IMNCI_SCORE = { yes: 1, no: 0 };
const MENTORSHIP_EENC_SCORE = { yes: 2, partial: 1, no: 0 };

const mentorshipToScore = (value, service) => {
    const table = service === 'EENC' ? MENTORSHIP_EENC_SCORE : MENTORSHIP_IMNCI_SCORE;
    return Object.prototype.hasOwnProperty.call(table, value) ? table[value] : null;
};

const mentorshipMaxScore = (service) => (service === 'EENC' ? 2 : 1);

export const buildMentorshipCourseRecord = (formData, context) => {
    const {
        course, participant, service = 'IMNCI',
        dayOfCourse = 1, caseSerial = 1, caseAgeMonths = '', subCourse = null,
    } = context;

    const isEenc = service === 'EENC';
    const maps = isEenc ? EENC_MENTORSHIP_MAPS : IMNCI_MENTORSHIP_MAPS;
    const encounterDate = formData.session_date || new Date().toISOString().slice(0, 10);
    const observations = [];

    // Which section holds a given skill is resolved by looking it up rather than
    // by matching key prefixes, so renaming a skill can't silently drop it from
    // the record. EENC keeps every answer in one flat `skills` map.
    const SECTIONS = ['assessment_skills', 'treatment_skills', 'recording_skills'];
    const readValue = (key) => {
        if (isEenc) return { value: formData.skills?.[key], section: 'skills' };
        const section = SECTIONS.find(s => formData[s]?.[key] !== undefined);
        return { value: section ? formData[section][key] : undefined, section };
    };

    const ageGroup = isEenc
        ? (formData.eenc_breathing_status === 'no' ? 'EENC_not_breathing' : 'EENC_breathing')
        : 'MENTORSHIP';

    Object.entries(maps.keyToItem).forEach(([key, { domain, item }]) => {
        const { value, section } = readValue(key);
        const itemCorrect = mentorshipToScore(value, service);
        if (itemCorrect === null) return;

        const observation = {
            courseId: course.id,
            course_type: course.course_type,
            participant_id: participant.id,
            encounter_date: encounterDate,
            day_of_course: dayOfCourse,
            setting: 'MENTORSHIP',
            mentorship_service: service,
            domain,
            section,
            item_recorded: item,
            item_correct: itemCorrect,
            item_max: mentorshipMaxScore(service),
            case_serial: caseSerial,
            age_group: ageGroup,
            sub_course: subCourse || null,
        };

        if (caseAgeMonths !== '' && caseAgeMonths !== null) {
            observation.case_age_months = Number(caseAgeMonths);
        }
        observations.push(observation);
    });

    const caseData = {
        courseId: course.id,
        participant_id: participant.id,
        encounter_date: encounterDate,
        setting: 'MENTORSHIP',
        mentorship_service: service,
        age_group: ageGroup,
        case_serial: caseSerial,
        day_of_course: dayOfCourse,
        allCorrect: observations.length > 0 &&
            observations.every(o => o.item_correct === mentorshipMaxScore(service)),
        contentHash: observations
            .map(o => `${o.domain}|${o.item_recorded}:${o.item_correct}`)
            .sort()
            .join('|'),
        sub_course: subCourse || null,
        notes: formData.notes || '',
    };

    if (isEenc) {
        caseData.delivery_type = formData.delivery_type || null;
        caseData.eenc_breathing_status = formData.eenc_breathing_status || null;
        caseData.eenc_resus_breathed_normally = formData.eenc_resus_breathed_normally || null;
        caseData.eenc_resus_has_pulse = formData.eenc_resus_has_pulse || null;
    } else {
        caseData.finalDecision = formData.finalDecision || '';
        caseData.decisionMatches = formData.decisionMatches || '';
    }

    return { caseData, observations };
};

// A skill whose label no longer matches the current form is left blank rather
// than guessed, so a form revision surfaces as an unanswered question the mentor
// re-confirms instead of a silently wrong score.
export const rebuildMentorshipFormData = (caseDoc, caseObservations, getInitialFormData, service = 'IMNCI') => {
    const formData = getInitialFormData();
    const isEenc = service === 'EENC';

    formData.session_date = caseDoc?.encounter_date || formData.session_date;
    formData.notes = caseDoc?.notes || '';

    if (isEenc) {
        formData.delivery_type = caseDoc?.delivery_type || '';
        formData.eenc_breathing_status = caseDoc?.eenc_breathing_status || 'na';
        formData.eenc_resus_breathed_normally = caseDoc?.eenc_resus_breathed_normally || 'na';
        formData.eenc_resus_has_pulse = caseDoc?.eenc_resus_has_pulse || 'na';
    } else {
        formData.finalDecision = caseDoc?.finalDecision || '';
        formData.decisionMatches = caseDoc?.decisionMatches || '';
    }

    const itemToKey = isEenc ? ITEM_TO_KEY_EENC : ITEM_TO_KEY_IMNCI;
    const reverseScore = isEenc ? { 2: 'yes', 1: 'partial', 0: 'no' } : { 1: 'yes', 0: 'no' };

    (caseObservations || []).forEach(o => {
        const key = itemToKey[o.item_recorded];
        if (!key) return;
        const value = reverseScore[o.item_correct];
        if (value === undefined) return;

        if (isEenc) {
            formData.skills ??= {};
            formData.skills[key] = value;
        } else if (formData.assessment_skills?.[key] !== undefined) {
            formData.assessment_skills[key] = value;
        } else {
            formData.treatment_skills ??= {};
            formData.treatment_skills[key] = value;
        }
    });

    return formData;
};

// --- The mentorship monitoring tab ------------------------------------------

// Mirrors the sticky score in the facility forms so a mentor sees the same
// running total they are used to seeing there.
function MentorshipRunningScore({ scores }) {
    const overall = scores?.overallScore;
    if (!overall || !overall.maxScore) return null;

    const pct = Math.round((overall.score / overall.maxScore) * 100);
    const bg = pct >= 80 ? 'bg-green-600' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-600';

    return (
        <div
            className={`fixed left-3 bottom-3 sm:left-4 sm:top-4 sm:bottom-auto z-40 flex flex-col items-center justify-center p-2 sm:p-3 w-16 h-16 sm:w-20 sm:h-20 rounded-lg ${bg} text-white shadow-2xl`}
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
            dir="rtl"
        >
            <div className="font-bold text-base sm:text-lg leading-none">{pct}%</div>
            <div className="text-[10px] sm:text-xs mt-1 text-center leading-tight">الدرجة الكلية</div>
            <div className="text-[10px] sm:text-xs leading-tight">({overall.score}/{overall.maxScore})</div>
        </div>
    );
}

function MentorshipSavedSessions({ cases, observations, onEdit, onDelete }) {
    // EmptyState renders a <tr>, so it is only valid inside a table body. Using
    // it inside a Card produced a DOM nesting warning; plain markup instead.
    if (!cases.length) {
        return (
            <Card>
                <div className="p-8 text-center">
                    <h3 className="text-base font-semibold text-slate-700">No mentorship sessions yet</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Completed sessions are recorded here and feed the participant's course report.
                    </p>
                </div>
            </Card>
        );
    }

    const sorted = [...cases].sort((a, b) => (b.case_serial || 0) - (a.case_serial || 0));

    // Score maths is shared by the phone card list and the desktop table so the
    // two views can never drift apart.
    const rows = sorted.map(c => {
        const obs = observations.filter(o => o.caseId === c.id);
        const earned = obs.reduce((sum, o) => sum + (o.item_correct || 0), 0);
        const possible = obs.reduce((sum, o) => sum + (o.item_max || 1), 0);
        const pct = possible ? Math.round((earned / possible) * 100) : 0;
        return {
            c,
            skills: obs.length,
            earned,
            possible,
            pct,
            tone: pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-yellow-700' : 'text-red-700',
        };
    });

    const caseBadge = (c) => {
        if (!c.scenario_id) return <span className="text-slate-400 text-xs">—</span>;
        if (c.standard_agreement_pct == null) {
            return <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-700">{c.scenario_id}</span>;
        }
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${
                c.standard_within_tolerance ? 'bg-green-600'
                    : c.standard_agreement_pct >= 80 ? 'bg-yellow-500' : 'bg-red-600'
            }`}>
                {c.scenario_id} · {c.standard_agreement_pct}%
            </span>
        );
    };

    return (
        <Card className="p-3 sm:p-4">
            <h3 className="text-lg font-semibold mb-3">Recorded mentorship sessions</h3>

            {/* Phone view. A seven-column table cannot be read at 360px, so each
                session becomes a card and nothing has to scroll sideways. */}
            <div className="md:hidden space-y-3">
                {rows.map(({ c, skills, earned, possible, pct, tone }) => (
                    <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                                <span className="font-bold text-slate-700">#{c.case_serial}</span>
                                <span className="text-sm text-slate-500"> · {c.encounter_date}</span>
                                <div className="text-sm text-slate-500">Day {c.day_of_course} · {skills} skills scored</div>
                            </div>
                            <span className={`font-semibold text-sm flex-shrink-0 ${tone}`}>{earned}/{possible} ({pct}%)</span>
                        </div>
                        <div className="mt-2">{caseBadge(c)}</div>
                        <div className="flex gap-2 justify-end pt-2 mt-2 border-t border-slate-200">
                            <Button variant="secondary" size="sm" onClick={() => onEdit(c)}>Edit</Button>
                            <Button variant="danger" size="sm" onClick={() => onDelete(c)}>Delete</Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tablet and desktop view. */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-left">
                            <th className="p-2">#</th>
                            <th className="p-2">Date</th>
                            <th className="p-2">Day</th>
                            <th className="p-2">Skills scored</th>
                            <th className="p-2">Score</th>
                            <th className="p-2">Case</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ c, skills, earned, possible, pct, tone }) => (
                            <tr key={c.id} className="border-b border-slate-200">
                                <td className="p-2 font-medium">{c.case_serial}</td>
                                <td className="p-2">{c.encounter_date}</td>
                                <td className="p-2">{c.day_of_course}</td>
                                <td className="p-2">{skills}</td>
                                <td className={`p-2 font-semibold ${tone}`}>{earned}/{possible} ({pct}%)</td>
                                <td className="p-2 whitespace-nowrap">{caseBadge(c)}</td>
                                <td className="p-2 text-right whitespace-nowrap">
                                    <Button variant="secondary" size="sm" onClick={() => onEdit(c)}>Edit</Button>
                                    <Button variant="danger" size="sm" className="ml-2" onClick={() => onDelete(c)}>Delete</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

// Superseded by CourseMentorshipMonitoringView, which opens the real field forms
// for every training rather than a rebuilt IMNCI/EENC subset. Kept exported under
// its own name so the old behaviour is one import away if a course needs it.
export function LegacyMentorshipMonitoringView({
    course, participant, participants = [], onChangeParticipant, isPublicView = false,
}) {
    const subCourse = useMemo(() => getMentorshipSubType(course, participant), [course, participant]);
    const service = useMemo(() => getCourseMentorshipService(course, participant), [course, participant]);
    const isEenc = service === 'EENC';

    // Declared before isMothers below, which reads recordType. Keeping these two
    // with the rest of the state further down would put them in the temporal
    // dead zone and throw on first render.
    //
    // Which mentorship form this session uses: the provider skills assessment or
    // the mothers interview. Chosen in the setup modal before the form opens.
    const [recordType, setRecordType] = useState('SKILLS');
    // Optional standardised case. When set, the trainee mentor's classification
    // decisions are marked against the scenario's known-correct answers.
    // A standard case is always used: this monitoring measures how the mentor
    // applies the mentoring standard, which only means something against a case
    // whose correct score the system already holds.
    const [scenarioId, setScenarioId] = useState(IMNCI_CASE_SCENARIOS[0]?.id || '');
    // Standards are course-wide: whichever participant records one, every other
    // participant on the course is compared against it.
    const [courseStandards, setCourseStandards] = useState({});

    const isMothers = recordType === 'MOTHERS';
    const isVisit = recordType === 'VISIT';

    const getInitialFormData = useCallback(
        () => (isMothers || isVisit
            ? getMothersInitialFormData(service)
            : (isEenc ? getEencInitialFormData() : getImnciInitialFormData())),
        [isMothers, isEenc, service]
    );

    const calculateScores = useCallback(
        (data) => (isMothers || isVisit
            ? calculateMothersScores(data, service)
            : (isEenc ? calculateEencScores(data) : calculateImnciScores(data))),
        [isMothers, isEenc, service]
    );

    const [formData, setFormData] = useState(getInitialFormData);
    const [visibleStep, setVisibleStep] = useState(1);
    const [cases, setCases] = useState([]);
    const [observations, setObservations] = useState([]);
    const [editingCase, setEditingCase] = useState(null);
    const [dayOfCourse, setDayOfCourse] = useState(1);
    const [caseAgeMonths, setCaseAgeMonths] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // The mentor-vs-standard comparison is deliberately withheld while the form
    // is being filled — seeing the stored total would let a mentor tune their
    // answers towards it instead of scoring the case as they read it. It is
    // snapshotted on save and revealed in the confirmation modal, because
    // saving resets formData and the live comparison disappears with it.
    const [savedComparison, setSavedComparison] = useState(null);

    const scores = useMemo(() => calculateScores(formData), [formData, calculateScores]);

    const scenario = useMemo(() => getScenarioById(scenarioId), [scenarioId]);

    // The mentor's own total on the form, measured against the score the system
    // stores for this case.
    const storedStandard = scenarioId ? courseStandards[scenarioId] : null;

    const standardComparison = useMemo(
        () => (scenario && !isMothers && !isVisit
            ? compareMentorToStandard(scores, scenario, storedStandard)
            : null),
        [scores, scenario, isMothers, isVisit, storedStandard]
    );
    // Skills sessions and mothers interviews are numbered independently, so a
    // participant's third skills case is not renumbered by an interview.
    const visibleCases = useMemo(
        () => cases.filter(c => (c.record_type || 'SKILLS') === recordType),
        [cases, recordType]
    );

    const nextSerial = useMemo(
        () => visibleCases.reduce((max, c) => Math.max(max, c.case_serial || 0), 0) + 1,
        [visibleCases]
    );

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!course?.id || !participant?.id) return;
            setLoading(true);
            setError(null);
            try {
                const [obsData, casesData] = await Promise.all([
                    listObservationsForParticipant(course.id, participant.id),
                    listCasesForParticipant(course.id, participant.id),
                ]);
                if (cancelled) return;
                setObservations(obsData || []);

                // Standards live on the course, not the participant, so they need
                // the course-wide fetch. A failure here must not block the tab —
                // the comparison just stays unavailable.
                try {
                    const courseData = await listAllDataForCourse(course.id);
                    if (!cancelled) {
                        const byScenario = {};
                        (courseData?.allCases || [])
                            .filter(c => c.record_type === 'STANDARD' && c.scenario_id)
                            .forEach(c => { byScenario[c.scenario_id] = c; });
                        setCourseStandards(byScenario);
                    }
                } catch (stdErr) {
                    console.warn('Could not load case standards for this course:', stdErr);
                }
                // Only mentorship-recorded cases belong on this tab; a course that
                // switched sub-course mid-way can still hold ordinary grid cases.
                setCases((casesData || []).filter(c => c.setting === 'MENTORSHIP'));
                // Both record types are kept in state; the list below filters by
                // the type currently selected so serials stay independent.
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to load mentorship monitoring data:', err);
                setError("Could not load this participant's mentorship records. Check the connection and reload.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [course?.id, participant?.id]);

    // Switching participant discards an in-progress form rather than carrying one
    // person's answers onto another's record.
    useEffect(() => {
        setFormData(getInitialFormData());
        setEditingCase(null);
        setShowForm(false);
        setVisibleStep(1);
        setScenarioId(IMNCI_CASE_SCENARIOS[0]?.id || '');
    }, [participant?.id, service, recordType]);

    const handleFormChange = useCallback((e) => {
        const { name, value } = e.target;

        if (isEenc) {
            setFormData(prev => ({ ...prev, [name]: value }));
            return;
        }

        const simpleAssessmentFields = [
            'supervisor_confirms_cough', 'worker_cough_classification', 'supervisor_correct_cough_classification',
            'supervisor_confirms_diarrhea', 'supervisor_confirms_fever',
            'supervisor_confirms_ear', 'worker_ear_classification', 'supervisor_correct_ear_classification',
            'worker_malnutrition_classification', 'supervisor_correct_malnutrition_classification',
            'worker_anemia_classification', 'supervisor_correct_anemia_classification',
        ];

        if (simpleAssessmentFields.includes(name)) {
            setFormData(prev => ({ ...prev, assessment_skills: { ...prev.assessment_skills, [name]: value } }));
        } else if (['finalDecision', 'decisionMatches', 'notes', 'session_date'].includes(name)) {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    }, [isEenc]);

    // EENC keeps every answer in one flat `skills` map; IMNCI splits by section.
    const handleSkillChange = useCallback((sectionOrKey, keyOrValue, maybeValue) => {
        if (isEenc) {
            setFormData(prev => ({ ...prev, skills: { ...prev.skills, [sectionOrKey]: keyOrValue } }));
            return;
        }
        setFormData(prev => ({
            ...prev,
            [sectionOrKey]: { ...prev[sectionOrKey], [keyOrValue]: maybeValue },
        }));
    }, [isEenc]);

    const handleMothersFieldChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleMothersAnswerChange = useCallback((key, value) => {
        setFormData(prev => ({ ...prev, answers: { ...prev.answers, [key]: value } }));
    }, []);

    const handleMultiClassificationChange = useCallback((stateKey, classificationName, isChecked) => {
        setFormData(prev => ({
            ...prev,
            assessment_skills: {
                ...prev.assessment_skills,
                [stateKey]: { ...(prev.assessment_skills[stateKey] || {}), [classificationName]: isChecked },
            },
        }));
    }, []);

    // IMNCI step reveal. EENC handles its own reveal inside its renderer.
    useEffect(() => {
        // The mothers interview has no assessment_skills at all — running the
        // IMNCI completeness helpers against that shape threw on
        // formData.assessment_skills.skill_weight.
        if (isEenc || isMothers || isVisit) return;
        let step = 1;
        if (isVitalSignsComplete(formData)) step = 2;
        if (step === 2 && isDangerSignsComplete(formData)) step = 3;
        if (step === 3 && isMainSymptomsComplete(formData.assessment_skills)) step = 4;
        if (step === 4 && isMalnutritionComplete(formData)) step = 5;
        if (step === 5 && isAnemiaComplete(formData)) step = 6;
        if (step === 6 && isImmunizationComplete(formData)) step = 7;
        if (step === 7 && isOtherProblemsComplete(formData)) step = 8;
        if (step === 8 && isDecisionComplete(formData)) step = 9;
        if (step === 9 && isRecordingComplete(formData)) step = 10;
        setVisibleStep(prev => (editingCase ? 10 : Math.max(prev, step)));
    }, [formData, editingCase, isEenc]);

    const startNewSession = () => {
        setFormData(getInitialFormData());
        setEditingCase(null);
        setDayOfCourse(1);
        setCaseAgeMonths('');
        setVisibleStep(1);
        setShowSetupModal(true);
    };

    const handleEditCase = (caseToEdit) => {
        const caseObs = observations.filter(o => o.caseId === caseToEdit.id);
        const type = caseToEdit.record_type || 'SKILLS';
        setRecordType(type);
        setFormData(type === 'MOTHERS'
            ? rebuildMothersFormData(caseToEdit, caseObs, service)
            : rebuildMentorshipFormData(caseToEdit, caseObs, getInitialFormData, service));
        setEditingCase(caseToEdit);
        setDayOfCourse(caseToEdit.day_of_course || 1);
        setScenarioId(caseToEdit.scenario_id || '');
        setCaseAgeMonths(caseToEdit.case_age_months ?? '');
        setVisibleStep(10);
        setShowForm(true);
        window.scrollTo(0, 0);
    };

    const handleSaveSession = async () => {
        if (isSaving) return;
        setIsSaving(true);

        try {
            const ctx = {
                course, participant, service, dayOfCourse,
                caseSerial: editingCase ? editingCase.case_serial : nextSerial,
                caseAgeMonths, subCourse,
            };
            const { caseData, observations: newObservations } = isMothers
                ? buildMothersCourseRecord(formData, ctx)
                : buildMentorshipCourseRecord(formData, ctx);

            // Case identity and the mentor-vs-standard comparison ride on the same
            // course record. No extra observations are written: the comparison is
            // one number about the mentor, not findings about the health worker.
            if (scenario && !isMothers) {
                caseData.scenario_id = scenario.id;
                caseData.scenario_child = scenario.childName;

                if (standardComparison) {
                    caseData.mentor_score = standardComparison.mentorScore;
                    caseData.mentor_max = standardComparison.mentorMax;
                    caseData.standard_score = standardComparison.standardScore;
                    caseData.standard_max = standardComparison.standardMax;
                    caseData.standard_difference = standardComparison.difference;
                    caseData.standard_agreement_pct = standardComparison.agreementPct;
                    caseData.standard_within_tolerance = standardComparison.withinTolerance;
                }
            }

            const { savedCase, savedObservations } = await upsertCaseAndObservations(
                caseData, newObservations, editingCase?.id
            );

            if (editingCase) {
                setCases(prev => prev.map(c => (c.id === editingCase.id ? savedCase : c)));
                setObservations(prev => [...prev.filter(o => o.caseId !== editingCase.id), ...savedObservations]);
            } else {
                setCases(prev => [...prev, savedCase]);
                setObservations(prev => [...prev, ...savedObservations]);
            }

            // Snapshot before the resets below wipe formData/scenarioId. The
            // scenario id and breakdown are copied in because `scenario` is
            // about to point at a different case.
            setSavedComparison(
                !isMothers && scenario && standardComparison
                    ? {
                        ...standardComparison,
                        scenarioId: scenario.id,
                        standardBreakdown: scenario.standardBreakdown,
                    }
                    : null
            );

            setShowSuccess(true);
            setScenarioId(IMNCI_CASE_SCENARIOS[0]?.id || '');
            setFormData(getInitialFormData());
            setEditingCase(null);
            setCaseAgeMonths('');
            setVisibleStep(1);
        } catch (err) {
            console.error('Failed to save mentorship session:', err);
            alert(`Could not save this session: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // The visit report is a training artefact, not a facility visit, so it is
    // given a course-scoped pseudo-facility and stored as a course case.
    const trainingFacility = useMemo(() => ({
        id: `course-${course?.id}-${participant?.id}`,
        name: `${course?.course_type || 'Course'} training — ${participant?.name || ''}`,
        state: course?.state,
        locality: course?.locality,
        nutrition_center_exists: false,
        immunization_office_exists: false,
        growth_monitoring_service_exists: false,
    }), [course?.id, course?.course_type, course?.state, course?.locality, participant?.id, participant?.name]);

    const saveVisitAsCourseRecord = useCallback(async (payload) => {
        const caseData = {
            courseId: course.id,
            participant_id: participant.id,
            encounter_date: new Date().toISOString().slice(0, 10),
            setting: 'MENTORSHIP',
            record_type: 'VISIT',
            mentorship_service: service,
            age_group: 'MENTORSHIP_VISIT',
            case_serial: editingCase ? editingCase.case_serial : nextSerial,
            day_of_course: dayOfCourse,
            sub_course: subCourse || null,
            allCorrect: false,
            contentHash: `visit-${Date.now()}`,
            visit_report: payload,
        };
        const { savedCase } = await upsertCaseAndObservations(caseData, [], editingCase?.id);
        setCases(prev => (editingCase
            ? prev.map(c => (c.id === editingCase.id ? savedCase : c))
            : [...prev, savedCase]));
        return savedCase;
    }, [course, participant, service, dayOfCourse, subCourse, editingCase, nextSerial]);

    const handleVisitSaved = useCallback(() => {
        // Visit reports are not scored against a case standard.
        setSavedComparison(null);
        setShowSuccess(true);
        setShowForm(false);
        setEditingCase(null);
    }, []);

    const handleDeleteSession = async (caseToDelete) => {
        if (!window.confirm('Delete this mentorship session and everything recorded in it? This cannot be undone.')) return;

        const prevCases = [...cases];
        const prevObs = [...observations];
        setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
        setObservations(prev => prev.filter(o => o.caseId !== caseToDelete.id));

        try {
            await deleteCaseAndObservations(caseToDelete.id);
        } catch (err) {
            console.error('Failed to delete mentorship session:', err);
            setCases(prevCases);
            setObservations(prevObs);
            alert(`Could not delete this session: ${err.message}. It has been restored in your view.`);
        }
    };

    // Course.jsx guards on hasMentorshipForm, so this should be unreachable — but
    // say so rather than rendering an empty shell if it is reached.
    if (!service) {
        return (
            <Card>
                <EmptyState
                    title="No mentorship form for this sub-course"
                    message={`${subCourse || 'This sub-course'} has no skills assessment form yet. Use the standard monitoring grid instead.`}
                />
            </Card>
        );
    }

    return (
        <div className="grid gap-2">
            <PageHeader title="Mentorship Practice" subtitle={`${subCourse || 'Mentorship'} — ${participant?.name || ''}`} />

            {showForm && <MentorshipRunningScore scores={scores} />}

            {error && (
                <Card><div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">{error}</div></Card>
            )}

            <Modal isOpen={showSuccess} onClose={() => { setShowSuccess(false); setSavedComparison(null); }} title="Session recorded">
                <div className="p-6">
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Mentorship session saved</h3>
                        <p className="text-gray-600">
                            It is now part of {participant?.name}'s course record and will appear in the course report.
                        </p>
                    </div>

                    {savedComparison && (
                        <div className="mt-5 p-3 border rounded-lg bg-slate-50 text-left">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2 sm:gap-3">
                                <h4 className="min-w-0 font-bold text-slate-800 break-words">
                                    Mentor vs stored standard — case {savedComparison.scenarioId}
                                    {savedComparison.setBy && (
                                        <span className="block text-xs font-normal text-slate-500">
                                            Standard set by {savedComparison.setBy}
                                        </span>
                                    )}
                                </h4>
                                <span className={`self-start shrink-0 px-3 py-1 rounded-md text-white font-semibold ${
                                    savedComparison.withinTolerance ? 'bg-green-600'
                                        : savedComparison.agreementPct >= 80 ? 'bg-yellow-500' : 'bg-red-600'
                                }`}>
                                    {savedComparison.agreementPct}% agreement
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-sm">
                                <div>
                                    <div className="text-slate-500 text-xs">Mentor scored</div>
                                    <div className="font-semibold">{savedComparison.mentorScore}/{savedComparison.mentorMax}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 text-xs">System standard</div>
                                    <div className="font-semibold">{savedComparison.standardScore}/{savedComparison.standardMax}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 text-xs">Difference</div>
                                    <div className={`font-semibold ${savedComparison.withinTolerance ? 'text-green-700' : 'text-red-700'}`}>
                                        {savedComparison.difference > 0 ? '+' : ''}{savedComparison.difference}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-600 mt-2">
                                {savedComparison.withinTolerance
                                    ? 'The mentor applied the mentoring standard consistently for this case.'
                                    : savedComparison.difference > 0
                                        ? 'The mentor scored this case higher than the standard.'
                                        : 'The mentor scored this case lower than the standard.'}
                            </p>
                            {savedComparison.source === 'configured' && savedComparison.standardBreakdown && (
                                <details className="mt-2">
                                    <summary className="text-xs text-slate-500 cursor-pointer">
                                        How this standard was derived
                                    </summary>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                        {savedComparison.standardBreakdown}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Recording this case with a master mentor will replace it.
                                    </p>
                                </details>
                            )}
                        </div>
                    )}

                    <Button
                        onClick={() => { setShowSuccess(false); setSavedComparison(null); setShowForm(false); }}
                        className="w-full mt-6 bg-green-600 hover:bg-green-700 border-green-600"
                    >
                        Done
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} title="Session setup" size="lg">
                <div className="p-4">
                    <FormGroup label="Which form?" className="mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {[
                                { key: 'SKILLS', title: 'Skills assessment', desc: `Observe the participant managing a ${isEenc ? 'delivery' : 'case'}.` },
                                { key: 'MOTHERS', title: 'Mothers interview', desc: 'Interview a mother about the care received.' },
                                { key: 'VISIT', title: 'Visit report', desc: 'Practise completing the visit report.' },
                            ].map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    disabled={opt.disabled}
                                    title={opt.disabled ? 'A visit report summarises a whole facility visit, so it has no course participant equivalent.' : undefined}
                                    onClick={() => !opt.disabled && setRecordType(opt.key)}
                                    className={`text-left p-3 rounded-lg border transition-colors ${
                                        opt.disabled
                                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                            : recordType === opt.key
                                                ? 'bg-sky-600 border-sky-600 text-white'
                                                : 'bg-white border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="font-semibold text-sm">{opt.title}</div>
                                    <div className={`text-xs mt-1 ${recordType === opt.key && !opt.disabled ? 'text-sky-100' : 'text-slate-500'}`}>
                                        {opt.desc}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </FormGroup>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {!isPublicView && (
                            <FormGroup label="Select participant" className="sm:col-span-2">
                                <Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)}>
                                    {participants.map(p => <option key={p.id} value={p.id}>{p.name} — {p.group}</option>)}
                                </Select>
                            </FormGroup>
                        )}
                        <FormGroup label="Session date">
                            <Input type="date" value={formData.session_date}
                                onChange={(e) => handleFormChange({ target: { name: 'session_date', value: e.target.value } })} />
                        </FormGroup>
                        {!isMothers && !isVisit && !isEenc && (
                            <FormGroup label="Standard case" className="sm:col-span-2">
                                <Select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
                                    {IMNCI_CASE_SCENARIOS.map(sc => (
                                        <option key={sc.id} value={sc.id}>
                                            {sc.id} · {sc.childName}
                                        </option>
                                    ))}
                                </Select>
                            </FormGroup>
                        )}
                        <FormGroup label="Course day">
                            <Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>
                                {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}
                            </Select>
                        </FormGroup>
                        {!isEenc && !isMothers && (
                            <FormGroup label="Child age (months)">
                                <Input type="number" value={caseAgeMonths}
                                    onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="Optional" />
                            </FormGroup>
                        )}
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-gray-50 rounded-b-lg">
                    <Button variant="secondary" className="w-full sm:w-auto" onClick={() => { setShowSetupModal(false); setShowForm(false); }}>Close</Button>
                    <Button className="w-full sm:w-auto" onClick={() => { setShowSetupModal(false); setShowForm(true); }}>Start session</Button>
                </div>
            </Modal>

            {!showForm && !loading && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-800">Start a mentorship session</h3>
                        <p className="text-sm text-slate-500">
                            Record a skills assessment or a mothers interview for {participant?.name} against the course.
                        </p>
                    </div>
                    <Button className="w-full sm:w-auto flex-shrink-0" onClick={startNewSession}>+ New session</Button>
                </div>
            )}

            {showForm && (
                <Card className="p-3 sm:p-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 bg-slate-50 p-3 rounded-md border border-slate-200">
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold break-words">
                                {editingCase
                                    ? `Editing ${isMothers ? 'interview' : 'session'} #${editingCase.case_serial}`
                                    : `New ${isMothers ? 'interview' : 'session'} #${nextSerial}`}
                            </h3>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 mt-1">
                                <span><span className="font-semibold">Day:</span> {dayOfCourse}</span>
                                <span><span className="font-semibold">Date:</span> {formData.session_date}</span>
                                <span><span className="font-semibold">Sub-course:</span> {subCourse || '—'}</span>
                            </div>
                        </div>
                        <Button variant="secondary" size="sm" className="w-full sm:w-auto flex-shrink-0" onClick={() => setShowSetupModal(true)}>Edit setup</Button>
                    </div>

                    {isVisit ? (
                        // A training visit report. The facility is synthesised from
                        // the course because the trainee is practising the form, not
                        // reporting on a real facility visit.
                        service === 'EENC' ? (
                            <EENCVisitReport
                                facility={trainingFacility}
                                allSubmissions={[]}
                                allVisitReports={[]}
                                visitNumber={1}
                                onCancel={() => setShowForm(false)}
                                onSaveSuccess={handleVisitSaved}
                                setToast={() => {}}
                                onSaveOverride={saveVisitAsCourseRecord}
                            />
                        ) : (
                            <IMNCIVisitReport
                                facility={trainingFacility}
                                allSubmissions={[]}
                                allVisitReports={[]}
                                visitNumber={1}
                                onCancel={() => setShowForm(false)}
                                onSaveSuccess={handleVisitSaved}
                                setToast={() => {}}
                                onSaveOverride={saveVisitAsCourseRecord}
                            />
                        )
                    ) : isMothers ? (
                        <MothersFormRenderer
                            formData={formData}
                            service={service}
                            scores={scores}
                            onFieldChange={handleMothersFieldChange}
                            onAnswerChange={handleMothersAnswerChange}
                        />
                    ) : isEenc ? (
                        <EENCFormRenderer
                            formData={formData}
                            setFormData={setFormData}
                            scores={scores}
                            handleFormChange={handleFormChange}
                            handleSkillChange={handleSkillChange}
                        />
                    ) : (
                        <div dir="rtl">
                            <IMNCIFormRenderer
                                formData={formData}
                                visibleStep={visibleStep}
                                scores={scores}
                                handleFormChange={handleFormChange}
                                handleSkillChange={handleSkillChange}
                                handleMultiClassificationChange={handleMultiClassificationChange}
                                isEditing={!!editingCase}
                            />
                        </div>
                    )}

                    {!isMothers && !isVisit && scenario && (
                        <div className="mt-4 p-3 border rounded-lg bg-slate-50">
                            {standardComparison ? (
                                // The stored total is withheld on purpose. Showing it here
                                // would let the mentor score towards the standard rather
                                // than towards the case in front of them.
                                <p className="text-sm text-slate-600">
                                    A standard answer exists for case {scenario.id}. Your total will be compared
                                    against it and the result shown once you save this session.
                                </p>
                            ) : (
                                <p className="text-sm text-slate-600">
                                    No standard answer is configured for case {scenario.id}, so this session will be
                                    recorded without a comparison.
                                </p>
                            )}
                        </div>
                    )}

                    {!isVisit && (
                    <div className="flex flex-col sm:flex-row gap-3 justify-end mt-4 border-t pt-4">
                        <Button onClick={handleSaveSession} className="w-full sm:w-auto" disabled={isSaving}>
                            {isSaving ? 'Saving…' : editingCase ? 'Update session' : 'Save session'}
                        </Button>
                        <Button variant="secondary" className="w-full sm:w-auto" disabled={isSaving}
                            onClick={() => {
                                setFormData(getInitialFormData());
                                setEditingCase(null);
                                setCaseAgeMonths('');
                                setShowForm(false);
                                setVisibleStep(1);
                            }}>
                            {editingCase ? 'Cancel edit' : 'Discard session'}
                        </Button>
                    </div>
                    )}
                </Card>
            )}

            {loading
                ? <Card><Spinner /></Card>
                : <MentorshipSavedSessions cases={visibleCases} observations={observations} onEdit={handleEditCase} onDelete={handleDeleteSession} />}
        </div>
    );
}
// ============================================================================
// BLOCK F — mothers interview support for the mentorship monitoring tab
// Append to the END of MonitoringView.jsx (after Block B).
// ============================================================================
//
// The question sets are declared here rather than imported from
// IMNCIMothersForm.jsx / EENCMothersForm.jsx because in those files they are
// module-local and the components autosave into the mentorship sessions
// collection. Both forms are flat question lists with no conditional logic, so
// re-rendering them faithfully is low risk — unlike the EENC skills form, whose
// C-section branching genuinely had to be reused rather than copied.
//
// If you later export the question arrays from those two files, swap these
// constants for imports and delete nothing else.

// --- IMNCI mothers interview ------------------------------------------------

// Values: 'نعم' / 'لا' / 'لا ينطبق'. Scored 1 / 0, with 'لا ينطبق' dropped.
const MOTHERS_IMNCI_SECTIONS = [
    {
        domain: 'mother_knowledge',
        label: 'معرفة الأم',
        stateKey: 'knowledge',
        questions: [
            { key: 'knows_med_details', label: '1. الأم التي طفلها أعطى مضاد حيوي أو دواء ملاريا تعرف كل الأسئلة . إجاباتها صحيحة على : الجرعة، كم مرة في اليوم، عدد الأيام )' },
            { key: 'knows_diarrhea_4rules', label: '2. الأم تعرف القواعد الاربعة للعلاج الاسهال بالمنزل ( السوائل ، التغذية ، الزنك ومتى تعود فوراً )' },
            { key: 'knows_home_fluids', label: '3. الأم تعرف ما هي السوائل التي تعطيها لطفلها بالمنزل' },
            { key: 'knows_ors_water_qty', label: '4. الأم تعرف ما هي كمية الماء التي تحضر بها ملح الإرواء' },
            { key: 'knows_ors_after_stool', label: '5. الأم تعرف ما هي كمية المحلول التي تعطيها بعد كل جلسة تبرز' },
            { key: 'knows_return_date', label: '6. الأم تعرف متى تعود للمتابعة.' },
        ],
    },
    {
        domain: 'mother_satisfaction',
        label: 'رضا الأم',
        stateKey: 'satisfaction',
        questions: [
            { key: 'time_spent', label: '1. الزمن الذي قضاه الكادر الصحي مع الطفل' },
            { key: 'assessment_method', label: '2. الطريقة التي كشف بها الكادر الصحي على الطفل' },
            { key: 'treatment_given', label: '3. العلاج الذي أعطى' },
            { key: 'communication_style', label: '4. الطريقة التي تحدث بها الكادر الصحي مع الأم' },
            { key: 'what_learned', label: '5. ما تعلمته من الكادر الصحي' },
            { key: 'drug_availability', label: '6. توفر الدواء بالوحدة الصحية' },
        ],
    },
];

// --- EENC mothers interview -------------------------------------------------

// Values: 'yes' / 'no'. Three fields are scored inverted — the ideal answer is
// 'no', matching calculateScores in EENCMothersForm.jsx. Getting this wrong
// would silently invert three of the sixteen scores, so it is declared per
// question rather than inferred.
const MOTHERS_EENC_SECTIONS = [
    {
        domain: 'mother_skin', label: '1. وضع الطفل جلد بجلد',
        questions: [
            { key: 'skin_to_skin_immediate', label: 'هل تم وضع الطفل جلد بجلد مباشرة بعد الولادة؟' },
            { key: 'skin_to_skin_90min', label: 'هل الطفل الان موضوع جلد بجلد أو تم وضعه جلد بجلد بصورة غير منقطعة مدة 90 دقيقة؟' },
        ],
    },
    {
        domain: 'mother_breastfeeding', label: '2. بدء الرضاعة الطبيعية',
        questions: [
            { key: 'breastfed_first_hour', label: 'هل أكمل الطفل رضعة كاملة خلال الساعة الأولى من الولادة؟' },
            { key: 'given_other_fluids', label: 'هل تم إعطاء أي سوائل اخرى غير حليب الأم؟ (الإجابة المثالية: لا)', idealNo: true },
            { key: 'given_other_fluids_bottle', label: 'هل تم إعطاء الطفل أي سائل اخر عن طريق البزة؟ (الإجابة المثالية: لا)', idealNo: true },
        ],
    },
    {
        domain: 'mother_care', label: '3. رعاية الجلد والعين والسرة',
        questions: [
            { key: 'given_vitamin_k', label: 'هل تم إعطاء الطفل فيتامين ك ؟' },
            { key: 'given_tetracycline', label: 'هل تم إعطاء الطفل جرعة تتراسيكلين للعين ؟' },
            { key: 'anything_on_cord', label: 'هل تم وضع أي مادة على السرة ؟' },
            { key: 'rubbed_with_oil', label: 'هل تم مسح الطفل باي نوع من الزيوت ؟' },
            { key: 'baby_bathed', label: 'هل تم استحمام الطفل ؟' },
        ],
    },
    {
        domain: 'mother_vaccination', label: '4. تطعيمات الطفل',
        questions: [
            { key: 'polio_zero_dose', label: 'هل تم تطعيم الطفل الجرعة الصفرية للشلل الفموي ؟' },
            { key: 'bcg_dose', label: 'هل تم تطعيم الطفل جرعة الدرن ؟' },
        ],
    },
    {
        domain: 'mother_measurements', label: '5. قياسات الطفل',
        questions: [
            { key: 'baby_weighed', label: 'هل تم وزن الطفل ؟' },
            { key: 'baby_temp_measured', label: 'هل تم قياس درجة حرارة الطفل ؟' },
        ],
    },
    {
        domain: 'mother_registration', label: '6. تسجيلات الطفل',
        questions: [
            { key: 'baby_registered', label: 'هل تم تسجيل الطفل في السجل المدني؟' },
            { key: 'given_discharge_card', label: 'هل تم إعطاء الطفل كرت الخروج؟' },
        ],
    },
];

export const getMothersSections = (service) =>
    service === 'EENC' ? MOTHERS_EENC_SECTIONS : MOTHERS_IMNCI_SECTIONS;

// Exported for ReportsView.jsx, same shape as getMentorshipSkillMaps.
export const getMothersSkillMaps = (service) => {
    const sections = getMothersSections(service);
    const skills = {};
    const labels = {};
    sections.forEach(s => {
        labels[s.domain] = s.label;
        skills[s.domain] = s.questions.map(q => q.label);
    });
    return { skills, domains: sections.map(s => s.domain), labels };
};

export const getMothersInitialFormData = (service) => {
    const base = {
        session_date: new Date().toISOString().split('T')[0],
        mother_name: '',
        child_age: '',
        child_sex: '',
        answers: {},
        notes: '',
    };
    getMothersSections(service).forEach(s => {
        s.questions.forEach(q => { base.answers[q.key] = ''; });
    });
    return base;
};

export const calculateMothersScores = (formData, service) => {
    const isEenc = service === 'EENC';
    const scores = {};
    let total = 0;
    let totalMax = 0;

    getMothersSections(service).forEach(s => {
        let score = 0;
        let maxScore = 0;
        s.questions.forEach(q => {
            const v = formData.answers?.[q.key];
            const answered = isEenc ? (v === 'yes' || v === 'no') : (v === 'نعم' || v === 'لا');
            if (!answered) return;
            maxScore += 1;
            const ideal = isEenc ? (q.idealNo ? 'no' : 'yes') : 'نعم';
            if (v === ideal) score += 1;
        });
        scores[s.domain] = { score, maxScore };
        total += score;
        totalMax += maxScore;
    });

    scores.overallScore = { score: total, maxScore: totalMax };
    return scores;
};

// --- Mothers form to course record -----------------------------------------

export const buildMothersCourseRecord = (formData, context) => {
    const {
        course, participant, service = 'IMNCI',
        dayOfCourse = 1, caseSerial = 1, subCourse = null,
    } = context;

    const isEenc = service === 'EENC';
    const encounterDate = formData.session_date || new Date().toISOString().slice(0, 10);
    const observations = [];

    getMothersSections(service).forEach(s => {
        s.questions.forEach(q => {
            const v = formData.answers?.[q.key];
            const answered = isEenc ? (v === 'yes' || v === 'no') : (v === 'نعم' || v === 'لا');
            // 'لا ينطبق' / unanswered are dropped rather than scored zero, the
            // same rule the skills forms use.
            if (!answered) return;

            const ideal = isEenc ? (q.idealNo ? 'no' : 'yes') : 'نعم';

            observations.push({
                courseId: course.id,
                course_type: course.course_type,
                participant_id: participant.id,
                encounter_date: encounterDate,
                day_of_course: dayOfCourse,
                setting: 'MENTORSHIP',
                record_type: 'MOTHERS',
                mentorship_service: service,
                domain: s.domain,
                section: s.stateKey || s.domain,
                item_recorded: q.label,
                item_correct: v === ideal ? 1 : 0,
                item_max: 1,
                case_serial: caseSerial,
                age_group: 'MENTORSHIP_MOTHERS',
                sub_course: subCourse || null,
            });
        });
    });

    const caseData = {
        courseId: course.id,
        participant_id: participant.id,
        encounter_date: encounterDate,
        setting: 'MENTORSHIP',
        record_type: 'MOTHERS',
        mentorship_service: service,
        age_group: 'MENTORSHIP_MOTHERS',
        case_serial: caseSerial,
        day_of_course: dayOfCourse,
        allCorrect: observations.length > 0 && observations.every(o => o.item_correct === 1),
        contentHash: observations
            .map(o => `${o.domain}|${o.item_recorded}:${o.item_correct}`)
            .sort()
            .join('|'),
        sub_course: subCourse || null,
        mother_name: formData.mother_name || '',
        child_age: formData.child_age || '',
        child_sex: formData.child_sex || '',
        notes: formData.notes || '',
    };

    return { caseData, observations };
};

export const rebuildMothersFormData = (caseDoc, caseObservations, service = 'IMNCI') => {
    const isEenc = service === 'EENC';
    const formData = getMothersInitialFormData(service);

    formData.session_date = caseDoc?.encounter_date || formData.session_date;
    formData.mother_name = caseDoc?.mother_name || '';
    formData.child_age = caseDoc?.child_age || '';
    formData.child_sex = caseDoc?.child_sex || '';
    formData.notes = caseDoc?.notes || '';

    const labelToQuestion = {};
    getMothersSections(service).forEach(s => {
        s.questions.forEach(q => { labelToQuestion[q.label] = q; });
    });

    (caseObservations || []).forEach(o => {
        const q = labelToQuestion[o.item_recorded];
        if (!q) return;
        const ideal = isEenc ? (q.idealNo ? 'no' : 'yes') : 'نعم';
        const other = isEenc ? (ideal === 'yes' ? 'no' : 'yes') : 'لا';
        formData.answers[q.key] = o.item_correct === 1 ? ideal : other;
    });

    return formData;
};

// --- Mothers renderer -------------------------------------------------------

function MothersFormRow({ label, value, options, onChange }) {
    const answered = value !== '' && value != null;
    return (
        <div dir="rtl" className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 sm:px-5 hover:bg-sky-50 transition-colors ${answered ? 'row-answered' : 'row-unanswered'}`}>
            <span className="text-sm font-medium text-gray-800 mb-2 sm:mb-0 text-right min-w-0 flex-grow sm:mr-4 w-full sm:w-auto break-words">{label}</span>
            <div className="flex gap-2 w-full sm:w-auto sm:flex-shrink-0 mt-1 sm:mt-0">
                {options.map(([text, val, cls]) => (
                    <button
                        key={val}
                        type="button"
                        onClick={() => onChange(val)}
                        className={`flex-1 sm:flex-none px-3 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-sm rounded-md border whitespace-nowrap touch-manipulation transition-colors ${value === val ? `${cls} text-white` : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                        {text}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function MothersFormRenderer({ formData, service, scores, onFieldChange, onAnswerChange }) {
    const isEenc = service === 'EENC';
    const options = isEenc
        ? [['نعم', 'yes', 'bg-green-600 border-green-600'], ['لا', 'no', 'bg-red-600 border-red-600']]
        : [
            ['نعم', 'نعم', 'bg-green-600 border-green-600'],
            ['لا', 'لا', 'bg-red-600 border-red-600'],
            ['لا ينطبق', 'لا ينطبق', 'bg-slate-400 border-slate-400'],
        ];

    return (
        <div dir="rtl">
            <div className="p-3 border rounded-lg bg-gray-50 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormGroup label="اسم الأم">
                        <Input value={formData.mother_name} onChange={(e) => onFieldChange('mother_name', e.target.value)} className="text-right" />
                    </FormGroup>
                    <FormGroup label="عمر الطفل">
                        <Input value={formData.child_age} onChange={(e) => onFieldChange('child_age', e.target.value)} placeholder="مثال: يومان" className="text-right" />
                    </FormGroup>
                    <FormGroup label="جنس الطفل">
                        <Select value={formData.child_sex} onChange={(e) => onFieldChange('child_sex', e.target.value)}>
                            <option value="">— اختر —</option>
                            <option value="ذكر">ذكر</option>
                            <option value="أنثى">أنثى</option>
                        </Select>
                    </FormGroup>
                </div>
            </div>

            {getMothersSections(service).map(section => {
                const s = scores?.[section.domain];
                return (
                    <div key={section.domain} className="mb-4 border rounded-lg overflow-hidden">
                        <div className="flex justify-between items-center gap-3 bg-sky-100 px-3 sm:px-4 py-2">
                            <h4 className="min-w-0 font-bold text-sky-900 break-words">{section.label}</h4>
                            {s && s.maxScore > 0 && (
                                <span className="text-sm font-semibold text-sky-800">{s.score}/{s.maxScore}</span>
                            )}
                        </div>
                        <div className="divide-y divide-slate-100 bg-white">
                            {section.questions.map(q => (
                                <MothersFormRow
                                    key={q.key}
                                    label={q.label}
                                    value={formData.answers?.[q.key] ?? ''}
                                    options={options}
                                    onChange={(val) => onAnswerChange(q.key, val)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            <FormGroup label="ملاحظات عامة" className="text-right mt-4">
                <textarea
                    value={formData.notes}
                    onChange={(e) => onFieldChange('notes', e.target.value)}
                    rows={3}
                    className="w-full p-2 border rounded text-right"
                    placeholder="أضف أي ملاحظات إضافية..."
                />
            </FormGroup>
        </div>
    );
}
