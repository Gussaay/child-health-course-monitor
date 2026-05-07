// MonitoringView.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Table, EmptyState, Spinner, Modal
} from "./CommonComponents";
import {
    pctBgClass, fmtPct, calcPct,
    SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAINS_BREATHING, EENC_DOMAINS_NOT_BREATHING,
    EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING,
    SKILLS_ETAT, ETAT_DOMAINS, ETAT_DOMAIN_LABEL,
    DOMAINS_BY_AGE_IMNCI, DOMAIN_LABEL_IMNCI, getClassListImnci,
    // --- MODIFICATION: Import new ICCM constants ---
    SKILLS_ICCM, ICCM_DOMAINS, ICCM_DOMAIN_LABEL,
} from './constants.js';
import {
    listObservationsForParticipant,
    listCasesForParticipant,
    upsertCaseAndObservations,
    deleteCaseAndObservations,
} from "../data.js";

// --- NEW HELPER FUNCTION for Performance Optimization ---
const generateHash = (buffer) => {
    return Object.keys(buffer)
        .sort()
        .map(k => `${k}:${buffer[k]}`)
        .join('|');
};

// --- NEW REUSABLE COMPONENT for the Segmented Control UI ---
/**
 * A reusable segmented control for actions.
 * @param {Array} options - Array of [label, value, activeClassName]
 * @param {*} currentValue - The current selected value (mark)
 * @param {Function} onClick - The toggle function (d, cls, v)
 */
function ActionToggle({ options, currentValue, onClick }) {
    return (
        // --- MODIFICATION: Added flex-shrink-0 to prevent shrinking in flex layouts ---
        <div className="relative z-0 inline-flex shadow-sm rounded-md flex-shrink-0">
            {options.map(([label, value, activeClass], idx) => {
                const isSelected = currentValue === value;
                const baseClass = "relative inline-flex items-center justify-center px-3 py-1 text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition";
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
// --- END NEW COMPONENT ---


// --- MODIFICATION: Added isPublicView prop ---
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
    
    // --- MODIFICATION: Added states for gating flow ---
    const [showSetupModal, setShowSetupModal] = useState(true);
    const [showGrid, setShowGrid] = useState(false);
    
    // --- MODIFICATION: Changed to modal state ---
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';
    const isEtat = course.course_type === 'ETAT';
    // --- MODIFICATION: Add isIccm flag ---
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
        // --- MODIFICATION: Calculate serial based on Day of Course, not Encounter Date ---
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
                    
                    if (!confirmSubmit) {
                        return; 
                    }
                }
            }
        }

        setIsSaving(true);

        const entries = Object.entries(buffer);

        if (isEenc) {
            const skillsMap = eencScenario === 'breathing' ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
            const totalSkills = Object.values(skillsMap).reduce((acc, domain) => acc + domain.length, 0);
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

        // --- MODIFICATION: Determine age_group based on all course types ---
        let ageGroup;
        if (isImnci) ageGroup = age;
        else if (isEenc) ageGroup = `EENC_${eencScenario}`;
        else if (isEtat) ageGroup = 'ETAT';
        else if (isIccm) ageGroup = 'ICCM';
        else ageGroup = 'N/A';
        // --- END MODIFICATION ---

        const caseData = {
            courseId: course.id, participant_id: participant.id, encounter_date: encounterDate,
            setting: isImnci ? setting : 'N/A', 
            age_group: ageGroup, // <-- Use new ageGroup variable
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
            if (ageGroupForObs) {
                observationData.age_group = ageGroupForObs;
            }
            if (caseAgeMonths !== '' && caseAgeMonths !== null) {
                observationData.case_age_months = Number(caseAgeMonths);
            }
            return observationData;
        });

        try {
            // This line was causing the error, but the fix is in data.js
            const { savedCase, savedObservations } = await upsertCaseAndObservations(caseData, newObservations, editingCase?.id);

            if (editingCase) {
                setCases(prevCases => prevCases.map(c => 
                    c.id === editingCase.id ? savedCase : c
                ));
                setObservations(prevObs => [
                    ...prevObs.filter(o => o.caseId !== editingCase.id),
                    ...savedObservations
                ]);
            } else {
                setCases(prevCases => [...prevCases, savedCase]);
                setObservations(prevObs => [...prevObs, ...savedObservations]);
            }

            // --- MODIFICATION: Show Success Modal ---
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
        
        try {
            await deleteCaseAndObservations(caseToDelete.id);
            setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
            setObservations(prev => prev.filter(o => o.caseId !== caseToDelete.id));
        } catch (error) {
            console.error("Failed to delete case:", error);
            alert(`Failed to delete case: ${error.message}. Please refresh the page.`);
        }
    };

    return (
        <div className="grid gap-2">
            <PageHeader title="Clinical Monitoring" subtitle={`Observing: ${participant.name}`} />
            
            {error && <Card><div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">{error}</div></Card>}
            
            {/* --- MODIFICATION: Success Modal Pop-up --- */}
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
            {/* --- END MODIFICATION --- */}

            {/* --- NEW SETUP MODAL --- */}
            <Modal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} title="Case Setup Configuration" size="lg">
                <div className="p-4">
                    <div className="bg-sky-50 p-4 rounded border border-sky-100 mb-5">
                        <h4 className="font-semibold text-sky-800 mb-2">Previous Cases for {participant?.name}</h4>
                        {cases.length === 0 ? (
                            <p className="text-sm text-sky-700">No cases submitted yet.</p>
                        ) : (
                            <div className="text-sm text-sky-700 max-h-32 overflow-y-auto">
                                <ul className="list-disc pl-5">
                                    {cases.slice().sort((a,b) => (b.day_of_course - a.day_of_course) || (b.case_serial - a.case_serial)).map(c => (
                                        <li key={c.id}>
                                            <span className="font-semibold">Day {c.day_of_course}</span> (Serial: {c.case_serial}) - {c.encounter_date}
                                            {isImnci && ` - ${c.setting} (${c.age_group === 'LT2M' ? '0-59d' : '2-59m'})`}
                                            {isEenc && ` - ${c.age_group.replace('EENC_', '')}`}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

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
                        {isEenc && <FormGroup label="EENC Scenario"><Select value={eencScenario} onChange={(e) => setEencScenario(e.target.value)} disabled={!!editingCase}><option value="breathing">Breathing Baby</option><option value="not_breathing">Not Breathing Baby</option></Select></FormGroup>}
                        <FormGroup label="Encounter Date"><Input type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} /></FormGroup>
                        <FormGroup label="Course Day"><Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</Select></FormGroup>
                        <FormGroup label={isImnci && age === 'LT2M' ? "Age (wks)" : "Age (mos)"}>
                            <Input type="number" value={caseAgeMonths} onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" />
                        </FormGroup>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                    <Button variant="secondary" onClick={() => { setShowSetupModal(false); setShowGrid(false); }}>Close</Button>
                    <Button onClick={() => { setShowSetupModal(false); setShowGrid(true); }}>Confirm & Start</Button>
                </div>
            </Modal>

            {/* Main Action Bar (when grid is not shown) */}
            {!showGrid && !loading && (
                <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Ready to monitor?</h3>
                        <p className="text-sm text-slate-500">Start a new observation case for {participant.name}.</p>
                    </div>
                    <Button onClick={() => { setBuffer({}); setEditingCase(null); setShowSetupModal(true); }}>
                        + Start New Case
                    </Button>
                </div>
            )}

            {showGrid && (
            <Card className="p-4 mb-4">
                <div className="flex justify-between items-start mb-4 bg-slate-50 p-3 rounded-md border border-slate-200">
                    <div>
                        <h3 className="text-lg font-semibold">{editingCase ? `Editing Case #${editingCase.case_serial}` : 'New Case Observation'}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                            <span className="font-semibold">Day:</span> {dayOfCourse} &bull; 
                            <span className="font-semibold ml-2">Date:</span> {encounterDate}
                            {isImnci && <>&bull; <span className="font-semibold ml-2">Setting:</span> {setting} &bull; <span className="font-semibold ml-2">Age:</span> {age === 'LT2M' ? '0-59d' : '2-59m'}</>}
                            {isEenc && <>&bull; <span className="font-semibold ml-2">Scenario:</span> {eencScenario === 'breathing' ? 'Breathing' : 'Not Breathing'}</>}
                        </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setShowSetupModal(true)}>
                        Edit Setup
                    </Button>
                </div>

                <p className="text-sm text-gray-600 mb-3">Click a domain title to expand/collapse. Select an action for each item.</p>
                <div className="rounded-lg border border-slate-300">
                    {isImnci && <ImnciMonitoringGrid age={age} buffer={buffer} toggle={toggle} />}
                    {isEenc && <EencMonitoringGrid scenario={eencScenario} buffer={buffer} toggle={toggle} />}
                    {isEtat && <EtatMonitoringGrid buffer={buffer} toggle={toggle} />}
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
            
            {/* --- MODIFICATION: Show submitted cases list (unconditionally) --- */}
            {loading ? <Card><Spinner /></Card> : <SubmittedCases course={course} participant={participant} observations={observations} cases={cases} onEditCase={(caseToEdit) => handleEditCase(caseToEdit, observations)} onDeleteCase={handleDeleteCase} />}
            {/* --- END MODIFICATION --- */}
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
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set(allDomains))}>Expand All</Button>
                    <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
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
                                className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                            >
                                <h4 className="text-base font-bold text-slate-800 text-left">{title}</h4>
                                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            
                            {isExpanded && (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {(list.length > 0 ? list : ["(no items)"]).map((item, i) => {
                                        const k = `${d}|${item}`;
                                        const mark = buffer[k];
                                        return (
                                            <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group">
                                                <span className="font-medium text-slate-700 break-words group-hover:text-slate-900">{item}</span>
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
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set(allDomains))}>Expand All</Button>
                    <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
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
                                className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                            >
                                <h4 className="text-base font-bold text-slate-800 text-left">{title}</h4>
                                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            
                            {isExpanded && (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {skills.map((item, i) => {
                                        const k = `${d}|${item}`;
                                        const mark = buffer[k];
                                        return (
                                            <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group">
                                                <span className="font-medium text-slate-700 break-words group-hover:text-slate-900">{item}</span>
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
    const isBreathing = scenario === 'breathing';
    const domains = isBreathing ? EENC_DOMAINS_BREATHING : EENC_DOMAINS_NOT_BREATHING;
    const skillsMap = isBreathing ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
    const labelsMap = isBreathing ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING;
    
    const [expandedDomains, setExpandedDomains] = useState(new Set());
    const allDomains = domains; 

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
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set(allDomains))}>Expand All</Button>
                    <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
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
                                className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                            >
                                <h4 className="text-base font-bold text-slate-800 text-left">{title}</h4>
                                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            
                            {isExpanded && (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {skills.map((item, i) => {
                                        const k = `${d}|${item.text}`;
                                        const mark = buffer[k];
                                        return (
                                            <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group">
                                                <span className="font-medium text-slate-700 break-words group-hover:text-slate-900">{item.text}</span>
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
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set(allDomains))}>Expand All</Button>
                    <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
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
                                className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}
                            >
                                <h4 className="text-base font-bold text-slate-800 text-left">{title}</h4>
                                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            
                            {isExpanded && (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {skills.map((item, i) => {
                                        const k = `${d}|${item}`;
                                        const mark = buffer[k];
                                        return (
                                            <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 sm:px-5 hover:bg-sky-50/50 transition-colors gap-3 group">
                                                <span className="font-medium text-slate-700 break-words group-hover:text-slate-900">{item}</span>
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
    const isEenc = course.course_type === 'EENC';
    // NOTE: No isIccm needed here; logic defaults correctly

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
                // This block works for IMNCI, ETAT, and ICCM
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

        // --- MODIFICATION: Sort by Course Day (Descending) first, then by Serial ---
        return mappedAndFiltered.sort((a, b) => (b.day - a.day) || (b.serial - a.serial));
    }, [cases, observations, isEenc, dayFilter, settingFilter, correctnessFilter]);



    const getAgeLabel = (age) => {
        if (isImnci) { return age === 'LT2M' ? '0-59 d' : '2-59 m'; }
        if (isEenc) { return age?.includes('breathing') ? (age.includes('not_breathing') ? 'Not Breathing' : 'Breathing') : age; }
        return age; // This will return 'ETAT' or 'ICCM'
    };

    const headers = isEenc
        ? ["Date", "Day", "Scenario", "Score", "% Score", "Actions"]
        : ["Date", "Day", ...(isImnci ? ["Setting"] : []), "Age Band", "% Correct", "Actions"];

    return (
        <Card>
            <PageHeader title={`Submitted Cases for ${participant.name}`} />
            {/* This filter bar is already mobile-friendly with flex-wrap */}
            <div className="flex flex-wrap gap-4 p-4 border-b border-slate-300 bg-slate-50 items-center">
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
            
            {/* This is the mobile-specific card view, which is great. */}
            <div className="md:hidden">
                {caseRows.length === 0 ? <div className="p-4 text-center text-gray-500">No cases match the current filters.</div> : 
                    <div className="space-y-3 p-3">
                        {caseRows.map((c) => (
                            <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-bold text-slate-700">{c.date}</span>
                                        <span className="text-sm text-slate-500"> (Day {c.day})</span>
                                    </div>
                                    <span className={`text-sm font-mono p-1 rounded ${pctBgClass(c.percentage)}`}>{fmtPct(c.percentage)}</span>
                                </div>
                                <div className="text-sm text-slate-600 grid grid-cols-2 gap-x-2">
                                    {isImnci && <span><span className="font-semibold">Setting:</span> {c.setting}</span>}
                                    <span><span className="font-semibold">Age:</span> {getAgeLabel(c.age)}</span>
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

            {/* This is the desktop table view, which is correctly hidden on mobile. */}
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
                                    {/* --- FIX: Corrected LButton typo --- */}
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