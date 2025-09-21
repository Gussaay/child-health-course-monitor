import React, { useState, useEffect, useMemo } from "react";
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Table, EmptyState, Spinner
} from "./CommonComponents";
import {
    pctBgClass, fmtPct, calcPct,
    SKILLS_EENC_BREATHING, SKILLS_EENC_NOT_BREATHING, EENC_DOMAINS_BREATHING, EENC_DOMAINS_NOT_BREATHING,
    EENC_DOMAIN_LABEL_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING,
    SKILLS_ETAT, ETAT_DOMAINS, ETAT_DOMAIN_LABEL,
    DOMAINS_BY_AGE_IMNCI, DOMAIN_LABEL_IMNCI, getClassListImnci,
} from './constants.js';
import {
    listObservationsForParticipant,
    listCasesForParticipant,
    upsertCaseAndObservations,
    deleteCaseAndObservations,
} from "../data.js";


export function ObservationView({ course, participant, participants, onChangeParticipant, initialCaseToEdit }) {
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
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';
    const isEtat = course.course_type === 'ETAT';

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
                setError("Could not load participant's data. A required database index may be missing. Please check the browser console for details.");
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
        const sameDayCases = cases.filter(c => c.encounter_date === encounterDate);
        const maxS = sameDayCases.reduce((m, x) => Math.max(m, x.case_serial || 0), 0);
        setCaseSerial(Math.max(1, maxS + 1));
    }, [cases, encounterDate, editingCase]);

    const toggle = (d, cls, v) => {
        const k = `${d}|${cls}`;
        setBuffer(prev => (prev[k] === v ? (({ [k]: _, ...rest }) => rest)(prev) : { ...prev, [k]: v }));
    };

    const submitCase = async () => {
        const entries = Object.entries(buffer);

        if (isEenc) {
            const skillsMap = eencScenario === 'breathing' ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
            const totalSkills = Object.values(skillsMap).reduce((acc, domain) => acc + domain.length, 0);
            if (entries.length < totalSkills) {
                alert('Please complete the form before submission');
                return;
            }
        }

        if (entries.length === 0) { alert('No skills/classifications selected.'); return; }

        const currentCaseSerial = editingCase ? editingCase.case_serial : caseSerial;
        const allCorrect = entries.every(([, v]) => v > 0);
        const caseData = {
            courseId: course.id, participant_id: participant.id, encounter_date: encounterDate,
            setting: isImnci ? setting : 'N/A', age_group: isImnci ? age : isEenc ? `EENC_${eencScenario}` : 'ETAT',
            case_serial: currentCaseSerial, day_of_course: dayOfCourse, allCorrect: allCorrect
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
            await upsertCaseAndObservations(caseData, newObservations, editingCase?.id);
            const [obsData, casesData] = await Promise.all([listObservationsForParticipant(course.id, participant.id), listCasesForParticipant(course.id, participant.id)]);
            setObservations(obsData);
            setCases(casesData);
            setBuffer({});
            setCaseAgeMonths('');
            setEditingCase(null);
        } catch (error) {
            console.error("ERROR saving to Firestore:", error);
            alert("Failed to save case. Please check the console for errors.");
        }
    };

    const handleDeleteCase = async (caseToDelete) => {
        if (!window.confirm('Delete this case and all its observations? This cannot be undone.')) return;
        await deleteCaseAndObservations(caseToDelete.id);
        const [obsData, casesData] = await Promise.all([listObservationsForParticipant(course.id, participant.id), listCasesForParticipant(course.id, participant.id)]);
        setObservations(obsData);
        setCases(casesData);
    };

    return (
        <div className="grid gap-2">
            <PageHeader title="Clinical Monitoring" subtitle={`Observing: ${participant.name}`} />
            
            {error && <Card><div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">{error}</div></Card>}

            <Card className="-mt-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    <FormGroup label="Select participant" className="lg:col-span-2">
                        <Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)}>
                            {participants.map(p => <option key={p.id} value={p.id}>{p.name} — {p.group}</option>)}
                        </Select>
                    </FormGroup>
                    {isImnci && <FormGroup label="Setting"><Select value={setting} onChange={(e) => setSetting(e.target.value)}><option value="OPD">Out-patient</option><option value="IPD">In-patient</option></Select></FormGroup>}
                    {isImnci && <FormGroup label="Age Band" className="col-span-2 sm:col-span-1">
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
            </Card>

            <Card>
                <h3 className="text-lg font-semibold mb-2">{editingCase ? `Editing Case #${editingCase.case_serial}` : 'New Case Observation'}</h3>
                <p className="text-sm text-gray-600 mb-3">Click a domain title to expand/collapse. Select an action for each item.</p>
                <div className="overflow-x-auto rounded-lg border border-slate-300">
                    {isImnci && <ImnciMonitoringGrid age={age} buffer={buffer} toggle={toggle} />}
                    {isEenc && <EencMonitoringGrid scenario={eencScenario} buffer={buffer} toggle={toggle} />}
                    {isEtat && <EtatMonitoringGrid buffer={buffer} toggle={toggle} />}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-end mt-4 border-t pt-4">
                    <Button onClick={submitCase} className="w-full sm:w-auto">{editingCase ? 'Update Case' : 'Submit Case'}</Button>
                    <Button variant="secondary" onClick={() => { setBuffer({}); setEditingCase(null); setCaseAgeMonths(''); }} className="w-full sm:w-auto">{editingCase ? 'Cancel Edit' : 'Start New Case'}</Button>
                </div>
            </Card>
            {loading ? <Card><Spinner /></Card> : <SubmittedCases course={course} participant={participant} observations={observations} cases={cases} onEditCase={(caseToEdit) => handleEditCase(caseToEdit, observations)} onDeleteCase={handleDeleteCase} />}
        </div>
    );
}

function ImnciMonitoringGrid({ age, buffer, toggle }) {
    const [expandedDomains, setExpandedDomains] = useState(new Set());

    const toggleDomain = (domain) => {
        setExpandedDomains(prev => {
            const newSet = new Set(prev);
            if (newSet.has(domain)) newSet.delete(domain);
            else newSet.add(domain);
            return newSet;
        });
    };

    return (
        <table className="text-sm border-collapse w-full">
            <thead className="bg-slate-50 text-slate-800">
                <tr>
                    <th className="p-2 text-left font-semibold border border-slate-300 w-[70%]">Domain / Classification</th>
                    <th className="p-2 text-left font-semibold border border-slate-300 w-[30%]">Action</th>
                </tr>
            </thead>
            {DOMAINS_BY_AGE_IMNCI[age].map(d => {
                const isExpanded = expandedDomains.has(d);
                const list = getClassListImnci(age, d) || [];
                const title = DOMAIN_LABEL_IMNCI[d] || d;

                return (
                    <tbody key={d}>
                        <tr onClick={() => toggleDomain(d)} className="cursor-pointer hover:bg-sky-100 bg-sky-50">
                            <td className="p-2 text-base font-bold text-slate-800 border-l border-r border-b border-slate-300">
                                <span className="inline-block w-5 text-center text-slate-500">{isExpanded ? '▼' : '►'}</span>
                                {title}
                            </td>
                            <td className="border-r border-b border-slate-300"></td>
                        </tr>
                        {isExpanded && (list.length > 0 ? list : ["(no items)"]).map((cls, i) => {
                            const k = `${d}|${cls}`;
                            const mark = buffer[k];
                            const cellClass = mark === 1 ? 'bg-green-100' : mark === 0 ? 'bg-red-100' : '';
                            return (
                                <tr key={`${d}-${i}`} className="hover:bg-slate-50">
                                    <td className="p-2 pl-8 border border-slate-300 break-words">{cls}</td>
                                    <td className={`p-2 border border-slate-300 ${cellClass}`}>
                                        <div className="flex flex-col xl:flex-row gap-1">
                                            <button onClick={() => toggle(d, cls, 1)} className={`px-3 py-1 w-full text-sm rounded-md border border-gray-300 transition ${mark === 1 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100'}`}>Correct</button>
                                            <button onClick={() => toggle(d, cls, 0)} className={`px-3 py-1 w-full text-sm rounded-md border border-gray-300 transition ${mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100'}`}>Incorrect</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                );
            })}
        </table>
    );
}

function EtatMonitoringGrid({ buffer, toggle }) {
    const [expandedDomains, setExpandedDomains] = useState(new Set());

    const toggleDomain = (domain) => {
        setExpandedDomains(prev => {
            const newSet = new Set(prev);
            if (newSet.has(domain)) newSet.delete(domain);
            else newSet.add(domain);
            return newSet;
        });
    };

    return (
        <table className="text-sm border-collapse w-full">
            <thead className="bg-slate-50 text-slate-800">
                <tr>
                    <th className="p-2 text-left font-semibold border border-slate-300 w-[70%]">Domain / Skill</th>
                    <th className="p-2 text-left font-semibold border border-slate-300 w-[30%]">Action</th>
                </tr>
            </thead>
            {ETAT_DOMAINS.map(d => {
                const isExpanded = expandedDomains.has(d);
                const skills = SKILLS_ETAT[d];
                const title = ETAT_DOMAIN_LABEL[d] || d;

                return (
                    <tbody key={d}>
                        <tr onClick={() => toggleDomain(d)} className="cursor-pointer hover:bg-sky-100 bg-sky-50">
                            <td className="p-2 text-base font-bold text-slate-800 border-l border-r border-b border-slate-300">
                               <span className="inline-block w-5 text-center text-slate-500">{isExpanded ? '▼' : '►'}</span>
                                {title}
                            </td>
                            <td className="border-r border-b border-slate-300"></td>
                        </tr>
                        {isExpanded && skills.map((skill, i) => {
                            const k = `${d}|${skill}`;
                            const mark = buffer[k];
                            const cellClass = mark === 1 ? 'bg-green-100' : mark === 0 ? 'bg-red-100' : '';
                            return (
                                <tr key={`${d}-${i}`} className="hover:bg-slate-50">
                                    <td className="p-2 pl-8 border border-slate-300 break-words">{skill}</td>
                                    <td className={`p-2 border border-slate-300 ${cellClass}`}>
                                        <div className="flex flex-col xl:flex-row gap-1">
                                            <button onClick={() => toggle(d, skill, 1)} className={`px-3 py-1 w-full text-sm rounded-md border border-gray-300 transition ${mark === 1 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100'}`}>Correct</button>
                                            <button onClick={() => toggle(d, skill, 0)} className={`px-3 py-1 w-full text-sm rounded-md border border-gray-300 transition ${mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100'}`}>Incorrect</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                );
            })}
        </table>
    );
}

function EencMonitoringGrid({ scenario, buffer, toggle }) {
    const isBreathing = scenario === 'breathing';
    const domains = isBreathing ? EENC_DOMAINS_BREATHING : EENC_DOMAINS_NOT_BREATHING;
    const skillsMap = isBreathing ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
    const labelsMap = isBreathing ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING;
    
    const [expandedDomains, setExpandedDomains] = useState(new Set(domains));

    const toggleDomain = (domain) => {
        setExpandedDomains(prev => {
            const newSet = new Set(prev);
            if (newSet.has(domain)) newSet.delete(domain);
            else newSet.add(domain);
            return newSet;
        });
    };

    const getCellClass = (mark) => {
        if (mark === 2) return 'bg-green-100';
        if (mark === 1) return 'bg-yellow-100';
        if (mark === 0) return 'bg-red-100';
        return '';
    };

    return (
        <table className="text-sm border-collapse w-full">
            <thead className="bg-slate-50 text-slate-800">
                <tr>
                    <th className="p-2 text-left font-semibold border border-slate-300 w-1/2">Domain / Skill</th>
                    <th className="p-2 text-left font-semibold border border-slate-300 w-1/2">Action</th>
                </tr>
            </thead>
            {domains.map(d => {
                const isExpanded = expandedDomains.has(d);
                const skills = skillsMap[d];
                const title = labelsMap[d] || d;

                return (
                    <tbody key={d}>
                        <tr onClick={() => toggleDomain(d)} className="cursor-pointer hover:bg-sky-100 bg-sky-50">
                            <td className="p-2 text-base font-bold text-slate-800 border-l border-r border-b border-slate-300">
                                <span className="inline-block w-5 text-center text-slate-500">{isExpanded ? '▼' : '►'}</span>
                                {title}
                            </td>
                            <td className="border-r border-b border-slate-300"></td>
                        </tr>
                        {isExpanded && skills.map((skill, i) => {
                            const k = `${d}|${skill.text}`;
                            const mark = buffer[k];
                            return (
                                <tr key={`${d}-${i}`} className="hover:bg-slate-50">
                                    <td className="p-2 pl-8 border border-slate-300 break-words">{skill.text}</td>
                                    <td className={`p-2 border border-slate-300 ${getCellClass(mark)}`}>
                                        <div className="flex flex-wrap gap-1">
                                            <button onClick={() => toggle(d, skill.text, 2)} className={`px-2 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 2 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100'}`}>Yes</button>
                                            <button onClick={() => toggle(d, skill.text, 1)} className={`px-2 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 1 ? 'bg-yellow-200 border-yellow-300' : 'bg-white hover:bg-gray-100'}`}>Partial</button>
                                            <button onClick={() => toggle(d, skill.text, 0)} className={`px-2 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100'}`}>No</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                );
            })}
        </table>
    );
}

function SubmittedCases({ course, participant, observations, cases, onEditCase, onDeleteCase }) {
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';

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

        return mappedAndFiltered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || b.serial - a.serial);
    }, [cases, observations, isEenc, dayFilter, settingFilter, correctnessFilter]);

    const getAgeLabel = (age) => {
        if (isImnci) { return age === 'LT2M' ? '0-59 d' : '2-59 m'; }
        if (isEenc) { return age?.includes('breathing') ? (age.includes('not_breathing') ? 'Not Breathing' : 'Breathing') : age; }
        return age;
    };

    const headers = isEenc
        ? ["Date", "Day", "Scenario", "Score", "% Score", "Actions"]
        : ["Date", "Day", ...(isImnci ? ["Setting"] : []), "Age Band", "% Correct", "Actions"];

    return (
        <Card>
            <PageHeader title={`Submitted Cases for ${participant.name}`} />
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
            
            <div className="md:hidden"> {/* Mobile Card View */}
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

            <div className="hidden md:block overflow-x-auto"> {/* Desktop Table View */}
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