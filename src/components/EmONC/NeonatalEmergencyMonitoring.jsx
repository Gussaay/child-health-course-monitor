// src/components/EmONC/NeonatalEmergencyMonitoring.jsx
import React, { useState, useEffect } from 'react';
import { Card, PageHeader, Button, Select, FormGroup, Input, Modal, Table, Spinner } from "../CommonComponents";
import { listObservationsForParticipant, listCasesForParticipant, upsertCaseAndObservations, deleteCaseAndObservations } from '../../data.js';
import { SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING, SKILLS_EMONC_NEONATAL, calcPct, fmtPct, pctBgClass } from '../constants.js';

const generateHash = (buffer) => Object.keys(buffer).sort().map(k => `${k}:${buffer[k]}`).join('|');

// --- EENC MAPPING (Shared) ---
const MAP_EENC_BREATHING = {
    title: "Early Essential Newborn Care (Breathing)",
    domains: Object.keys(SKILLS_EENC_BREATHING).reduce((acc, key) => {
        acc[EENC_DOMAIN_LABEL_BREATHING[key]] = SKILLS_EENC_BREATHING[key].map(item => item.text);
        return acc;
    }, {})
};

const MAP_EENC_NOT_BREATHING = {
    title: "Early Essential Newborn Care (Not Breathing)",
    domains: Object.keys(SKILLS_EENC_NOT_BREATHING).reduce((acc, key) => {
        acc[EENC_DOMAIN_LABEL_NOT_BREATHING[key]] = SKILLS_EENC_NOT_BREATHING[key].map(item => item.text);
        return acc;
    }, {})
};

export const NEONATAL_CHECKLISTS = {
    eenc_breathing: MAP_EENC_BREATHING,
    eenc_not_breathing: MAP_EENC_NOT_BREATHING,
    neonatal_assessment: {
        title: "Initial Neonatal Assessment",
        domains: { "Assessment": SKILLS_EMONC_NEONATAL.assessment.map(i => i.text) }
    },
    advanced_resuscitation: {
        title: "Advanced Neonatal Resuscitation",
        domains: { "Resuscitation & Management": SKILLS_EMONC_NEONATAL.resuscitation.map(i => i.text) }
    }
};

function ActionToggle({ currentValue, onClick }) {
    const options = [['Done', 1, 'bg-green-600 border-green-600'], ['Not Done', 0, 'bg-red-600 border-red-600'], ['N/A', -1, 'bg-gray-500 border-gray-500']];
    return (
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
                return <button key={value} type="button" className={`${baseClass} ${activeState} ${roundedClass}`} onClick={() => onClick(value)}>{label}</button>;
            })}
        </div>
    );
}

export function NeonatalEmergencyMonitoring({ course, participant, participants, onChangeParticipant, onCancel, switchModule, isPublicView = false }) {
    const [observations, setObservations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [encounterDate, setEncounterDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dayOfCourse, setDayOfCourse] = useState(1);
    const [scenario, setScenario] = useState('eenc_breathing');
    const [caseSerial, setCaseSerial] = useState(1);
    const [buffer, setBuffer] = useState({});
    const [editingCase, setEditingCase] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showSetupModal, setShowSetupModal] = useState(true);
    const [showGrid, setShowGrid] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [expandedDomains, setExpandedDomains] = useState(new Set());

    useEffect(() => {
        const fetchData = async () => {
            if (!participant?.id || !course?.id) return;
            setLoading(true);
            try {
                const [obsData, casesData] = await Promise.all([
                    listObservationsForParticipant(course.id, participant.id),
                    listCasesForParticipant(course.id, participant.id)
                ]);
                const neonatalCases = casesData.filter(c => c.age_group?.startsWith('Neonatal_'));
                setObservations(obsData);
                setCases(neonatalCases);
            } catch (err) {
                setError("Could not load participant's data.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [participant?.id, course?.id]);

    useEffect(() => {
        if (editingCase) return;
        const sameDayCases = cases.filter(c => c.day_of_course === dayOfCourse);
        const maxS = sameDayCases.reduce((m, x) => Math.max(m, x.case_serial || 0), 0);
        setCaseSerial(Math.max(1, maxS + 1));
    }, [cases, dayOfCourse, editingCase]);

    const handleEditCase = (caseToEdit) => {
        if (!caseToEdit) return;
        setEditingCase(caseToEdit);
        setEncounterDate(caseToEdit.encounter_date);
        setDayOfCourse(caseToEdit.day_of_course);
        setScenario(caseToEdit.age_group.replace('Neonatal_', ''));
        const caseObs = observations.filter(o => o.caseId === caseToEdit.id);
        const newBuffer = {};
        caseObs.forEach(o => { newBuffer[`${o.domain}|${o.item_recorded}`] = o.item_correct; });
        setBuffer(newBuffer);
        setShowSetupModal(false);
        setShowGrid(true);
        window.scrollTo(0, 0);
    };

    const handleToggle = (domain, item, value) => {
        const k = `${domain}|${item}`;
        setBuffer(prev => (prev[k] === value ? (({ [k]: _, ...rest }) => rest)(prev) : { ...prev, [k]: value }));
    };

    const toggleDomain = (domain) => {
        setExpandedDomains(prev => {
            const newSet = new Set(prev);
            if (newSet.has(domain)) newSet.delete(domain);
            else newSet.add(domain);
            return newSet;
        });
    };

    const submitCase = async () => {
        if (isSaving) return; 
        const entries = Object.entries(buffer);
        if (entries.length === 0) { alert('No skills/actions selected.'); return; }
        setIsSaving(true);
        const currentCaseSerial = editingCase ? editingCase.case_serial : caseSerial;
        const allCorrect = entries.every(([, v]) => v > 0);

        const caseData = {
            courseId: course.id, participant_id: participant.id, encounter_date: encounterDate, setting: 'N/A', 
            age_group: `Neonatal_${scenario}`, case_serial: currentCaseSerial, day_of_course: dayOfCourse, 
            allCorrect: allCorrect, contentHash: generateHash(buffer)
        };

        const newObservations = entries.map(([k, v]) => {
            const [domain, skill_or_class] = k.split('|');
            return {
                courseId: course.id, course_type: course.course_type, encounter_date: encounterDate, day_of_course: dayOfCourse, 
                setting: 'N/A', participant_id: participant.id, domain: domain, item_recorded: skill_or_class, 
                item_correct: v, case_serial: currentCaseSerial, age_group: `Neonatal_${scenario}`
            };
        });

        try {
            const { savedCase, savedObservations } = await upsertCaseAndObservations(caseData, newObservations, editingCase?.id);
            if (editingCase) {
                setCases(prev => prev.map(c => c.id === editingCase.id ? savedCase : c));
                setObservations(prev => [...prev.filter(o => o.caseId !== editingCase.id), ...savedObservations]);
            } else {
                setCases(prev => [...prev, savedCase]);
                setObservations(prev => [...prev, ...savedObservations]);
            }
            setShowSuccessModal(true);
            setBuffer({});
            setEditingCase(null);
        } catch (err) {
            alert(`Failed to save case: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCase = async (caseToDelete) => {
        if (!window.confirm('Delete this case and all its observations? This cannot be undone.')) return;
        const previousCases = [...cases];
        const previousObservations = [...observations];
        setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
        setObservations(prev => prev.filter(o => o.caseId !== caseToDelete.id));
        try {
            await deleteCaseAndObservations(caseToDelete.id);
        } catch (err) {
            setCases(previousCases);
            setObservations(previousObservations);
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const currentChecklist = NEONATAL_CHECKLISTS[scenario] || NEONATAL_CHECKLISTS['eenc_breathing'];
    const currentDomains = Object.keys(currentChecklist.domains);

    useEffect(() => {
        if (showGrid) setExpandedDomains(new Set(currentDomains.slice(0, 2)));
    }, [scenario, showGrid]);

    return (
        <div className="grid gap-2">
            {!isPublicView && <PageHeader title="Neonatal Emergency Monitor" subtitle={`Observing: ${participant.name}`} />}
            {error && <Card><div className="p-4 bg-red-100 text-red-700 rounded-md">{error}</div></Card>}

            <Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} title="Submission Successful">
                <div className="p-6 text-center">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Case Saved Successfully!</h3>
                    <Button onClick={() => { setShowSuccessModal(false); setShowGrid(false); setShowSetupModal(true); }} className="w-full bg-green-600 hover:bg-green-700">
                        Continue to Next Case
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} title="Case Setup Configuration" size="lg">
                <div className="p-4">
                    {/* --- NATIVE BUTTON TOGGLE (BULLETPROOF) --- */}
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                if (switchModule) switchModule('maternal');
                            }}
                            className="flex-1 py-2 px-4 rounded-md font-medium text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            Maternal Emergencies
                        </button>
                        <button 
                            type="button"
                            className="flex-1 py-2 px-4 rounded-md font-bold text-sm shadow bg-white text-teal-700 border border-teal-200"
                        >
                            Neonatal Emergencies
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isPublicView && participants && (
                            <FormGroup label="Select participant" className="sm:col-span-2">
                                <Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)} disabled={!!editingCase}>
                                    {participants.map(p => <option key={p.id} value={p.id}>{p.name} — {p.group}</option>)}
                                </Select>
                            </FormGroup>
                        )}
                        <FormGroup label="Select Neonatal Form / Checklist" className="sm:col-span-2">
                            <Select value={scenario} onChange={(e) => { setScenario(e.target.value); setBuffer({}); }} disabled={!!editingCase}>
                                {Object.entries(NEONATAL_CHECKLISTS).map(([key, data]) => (
                                    <option key={key} value={key}>{data.title}</option>
                                ))}
                            </Select>
                        </FormGroup>
                        <FormGroup label="Encounter Date"><Input type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} /></FormGroup>
                        <FormGroup label="Course Day"><Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</Select></FormGroup>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                    {!isPublicView && <Button variant="secondary" onClick={() => { setShowSetupModal(false); setShowGrid(false); }}>Close</Button>}
                    <Button onClick={() => { setShowSetupModal(false); setShowGrid(true); }}>Confirm & Start</Button>
                </div>
            </Modal>

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
                                <span className="font-semibold">Day:</span> {dayOfCourse} &bull; <span className="font-semibold ml-2">Date:</span> {encounterDate} &bull; <span className="font-semibold ml-2">Checklist:</span> {currentChecklist.title}
                            </p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => setShowSetupModal(true)}>Edit Setup</Button>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set(currentDomains))}>Expand All</Button>
                        <Button size="sm" variant="secondary" onClick={() => setExpandedDomains(new Set())}>Collapse All</Button>
                    </div>

                    <div className="space-y-3">
                        {currentDomains.map(d => {
                            const isExpanded = expandedDomains.has(d);
                            const items = currentChecklist.domains[d];
                            return (
                                <div key={d} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                                    <button type="button" onClick={() => toggleDomain(d)} className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}>
                                        <h4 className="text-base font-bold text-slate-800 text-left">{d}</h4>
                                    </button>
                                    {isExpanded && (
                                        <div className="divide-y divide-slate-100 bg-white">
                                            {items.map((item, i) => {
                                                const k = `${d}|${item}`;
                                                const mark = buffer[k];
                                                return (
                                                    <div key={`${d}-${i}`} className="flex flex-col sm:flex-row justify-between sm:items-start p-3 sm:px-5 hover:bg-sky-50/50 gap-3 group">
                                                        <span className="font-medium text-sm text-slate-700 mt-1">{item}</span>
                                                        <div className="flex-shrink-0">
                                                            <ActionToggle currentValue={mark} onClick={(value) => handleToggle(d, item, value)} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-3 mt-4 border-t pt-4">
                        <Button variant="secondary" onClick={() => { setBuffer({}); setEditingCase(null); setShowGrid(false); }} disabled={isSaving}>Discard</Button>
                        <Button onClick={submitCase} disabled={isSaving}>{isSaving ? 'Saving...' : (editingCase ? 'Update Case' : 'Submit Case')}</Button>
                    </div>
                </Card>
            )}

            {loading ? <Card><Spinner /></Card> : (
                <SubmittedNeonatalCases cases={cases} observations={observations} onEditCase={handleEditCase} onDeleteCase={handleDeleteCase} />
            )}
        </div>
    );
}

function SubmittedNeonatalCases({ cases, observations, onEditCase, onDeleteCase }) {
    if (cases.length === 0) return <Card className="p-8 text-center text-gray-500">No cases submitted yet.</Card>;
    return (
        <Card className="p-4">
            <h3 className="text-lg font-bold mb-4">Submitted Neonatal Cases</h3>
            <Table headers={["Date", "Day", "Checklist", "Score", "Actions"]}>
                {cases.sort((a,b) => b.day_of_course - a.day_of_course || b.case_serial - a.case_serial).map(c => {
                    const relatedObs = observations.filter(o => o.caseId === c.id);
                    const total = relatedObs.length;
                    const correct = relatedObs.filter(o => o.item_correct > 0).length;
                    const checklistName = NEONATAL_CHECKLISTS[c.age_group?.replace('Neonatal_', '')]?.title || c.age_group;
                    const pct = total > 0 ? (correct/total)*100 : 0;
                    return (
                        <tr key={c.id} className="hover:bg-slate-50 border-b text-sm">
                            <td className="p-2">{c.encounter_date}</td>
                            <td className="p-2 text-center">{c.day_of_course}</td>
                            <td className="p-2">{checklistName}</td>
                            <td className={`p-2 text-center font-mono ${pctBgClass(pct)}`}>{fmtPct(pct)} ({correct}/{total})</td>
                            <td className="p-2 text-right">
                                <Button size="sm" variant="secondary" onClick={() => onEditCase(c)} className="mr-2">Edit</Button>
                                <Button size="sm" variant="danger" onClick={() => onDeleteCase(c)}>Delete</Button>
                            </td>
                        </tr>
                    );
                })}
            </Table>
        </Card>
    );
}