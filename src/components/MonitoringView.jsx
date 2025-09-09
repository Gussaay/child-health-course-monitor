import React, { useState, useEffect, useMemo } from "react";
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Table, EmptyState, Spinner
} from "./CommonComponents";
import {
    pctBgClass, fmtPct, calcPct, formatAsPercentageAndCount, formatAsPercentageAndScore,
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


export function ObservationView({ course, participant, participants, onChangeParticipant }) {
    const [observations, setObservations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
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




    useEffect(() => {
        const fetchData = async () => {
            if (!participant?.id || !course?.id) return;
            setLoading(true);
            const [obsData, casesData] = await Promise.all([listObservationsForParticipant(course.id, participant.id), listCasesForParticipant(course.id, participant.id)]);
            setObservations(obsData);
            setCases(casesData);
            setLoading(false);
        };
        fetchData();
    }, [participant?.id, course?.id]);

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

    const handleEditCase = (caseToEdit) => {
        setEditingCase(caseToEdit);
        setEncounterDate(caseToEdit.encounter_date);
        setDayOfCourse(caseToEdit.day_of_course);
        if (isImnci) { setSetting(caseToEdit.setting); setAge(caseToEdit.age_group); }
        if (isEenc) { setEencScenario(caseToEdit.age_group.replace('EENC_', '')); }
        const caseObs = observations.filter(o => o.caseId === caseToEdit.id);
        const newBuffer = {};
        caseObs.forEach(o => { newBuffer[`${o.domain}|${o.item_recorded}`] = o.item_correct; });
        setBuffer(newBuffer);
        window.scrollTo(0, 0);
    };

    const handleDeleteCase = async (caseToDelete) => {
        if (!window.confirm('Delete this case and all its observations? This cannot be undone.')) return;
        await deleteCaseAndObservations(caseToDelete.id);
        const [obsData, casesData] = await Promise.all([listObservationsForParticipant(course.id, participant.id), listCasesForParticipant(course.id, participant.id)]);
        setObservations(obsData);
        setCases(casesData);
    };

    return (
        <div className="grid gap-6">
            <PageHeader title="Clinical Monitoring" subtitle={`Observing: ${participant.name}`} />
            <Card className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormGroup label="Select participant"><Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)}>{participants.map(p => <option key={p.id} value={p.id}>{p.name} — {p.group}</option>)}</Select></FormGroup>
                {isImnci && <FormGroup label="Setting"><Select value={setting} onChange={(e) => setSetting(e.target.value)}><option value="OPD">Out-patient</option><option value="IPD">In-patient</option></Select></FormGroup>}
                {isImnci && <FormGroup label="Age band">
                    <Select value={age} onChange={(e) => {
                        setAge(e.target.value);
                        if (editingCase) { setBuffer({}); }
                    }}>
                        <option value="GE2M_LE5Y">Sick child (2-59 months)</option>
                        <option value="LT2M">Sick young infant (0-59 days)</option>
                    </Select>
                </FormGroup>}
                {isEenc && <FormGroup label="EENC Scenario"><Select value={eencScenario} onChange={(e) => setEencScenario(e.target.value)} disabled={!!editingCase}><option value="breathing">Breathing Baby</option><option value="not_breathing">Not Breathing Baby</option></Select></FormGroup>}
            </Card>
            <Card>
                <div className="grid md:grid-cols-3 gap-6">
                    <FormGroup label="Encounter date"><Input type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} /></FormGroup>
                    <FormGroup label="Course day (1-7)"><Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}</Select></FormGroup>
                    <FormGroup label={isImnci && age === 'LT2M' ? "Case Age (weeks)" : "Case Age (months)"}>
                        <Input type="number" value={caseAgeMonths} onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" />
                    </FormGroup>
                </div>
            </Card>
            <Card>
                <h3 className="text-lg font-semibold mb-4">{editingCase ? `Editing Case #${editingCase.case_serial}` : 'Select skills and mark correctness'}</h3>
                <div className="overflow-x-auto">
                    {isImnci && <ImnciMonitoringGrid age={age} buffer={buffer} toggle={toggle} />}
                    {isEenc && <EencMonitoringGrid scenario={eencScenario} buffer={buffer} toggle={toggle} />}
                    {isEtat && <EtatMonitoringGrid buffer={buffer} toggle={toggle} />}
                </div>
                <div className="flex gap-3 justify-end mt-4 border-t pt-4">
                    <Button onClick={submitCase}>{editingCase ? 'Update Case' : 'Submit Case'}</Button>
                    <Button variant="secondary" onClick={() => { setBuffer({}); setEditingCase(null); setCaseAgeMonths(''); }}>{editingCase ? 'Cancel Edit' : 'Start New Case'}</Button>
                </div>
            </Card>
            {loading ? <Card><Spinner /></Card> : <SubmittedCases course={course} participant={participant} observations={observations} cases={cases} onEditCase={handleEditCase} onDeleteCase={handleDeleteCase} />}
        </div>
    );
}

function ImnciMonitoringGrid({ age, buffer, toggle }) {
    return (
        <table className="text-sm border-collapse w-full table-fixed">
            <thead>
                <tr>
                    <th className="p-2 text-left border border-slate-300 w-[30%]">Domain</th>
                    <th className="p-2 text-left border border-slate-300 w-[50%]">Classification</th>
                    <th className="p-2 text-left border border-slate-300 w-[20%]">Action</th>
                </tr>
            </thead>
            <tbody>
                {DOMAINS_BY_AGE_IMNCI[age].map(d => {
                    const list = getClassListImnci(age, d) || [];
                    const title = DOMAIN_LABEL_IMNCI[d] || d;
                    return (list.length > 0 ? list : ["(no items)"]).map((cls, i) => {
                        const k = `${d}|${cls}`;
                        const mark = buffer[k];
                        const rowClass = mark === 1 ? 'bg-green-50' : mark === 0 ? 'bg-red-50' : '';
                        return (
                            <tr key={`${d}-${i}`} className={rowClass}>
                                {i === 0 && <td className="p-2 align-top font-semibold text-gray-800 border border-slate-300" rowSpan={list.length}>{title}</td>}
                                <td className="p-2 border border-slate-300 break-words">{cls}</td>
                                <td className="p-2 border border-slate-300">
                                    <div className="flex flex-col xl:flex-row gap-1">
                                        <button onClick={() => toggle(d, cls, 1)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 1 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100'}`}>Correct</button>
                                        <button onClick={() => toggle(d, cls, 0)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100'}`}>Incorrect</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    });
                })}
            </tbody>
        </table>
    );
}

function EtatMonitoringGrid({ buffer, toggle }) {
    return (
        <table className="text-sm border-collapse w-full table-fixed">
            <thead>
                <tr>
                    <th className="p-2 text-left border border-slate-300 w-[30%]">Domain</th>
                    <th className="p-2 text-left border border-slate-300 w-[50%]">Skill</th>
                    <th className="p-2 text-left border border-slate-300 w-[20%]">Action</th>
                </tr>
            </thead>
            <tbody>
                {ETAT_DOMAINS.map(d => {
                    const skills = SKILLS_ETAT[d];
                    const title = ETAT_DOMAIN_LABEL[d] || d;
                    return skills.map((skill, i) => {
                        const k = `${d}|${skill}`;
                        const mark = buffer[k];
                        const rowClass = mark === 1 ? 'bg-green-50' : mark === 0 ? 'bg-red-50' : '';
                        return (
                            <tr key={`${d}-${i}`} className={rowClass}>
                                {i === 0 && <td className="p-2 align-top font-semibold text-gray-800 border border-slate-300" rowSpan={skills.length}>{title}</td>}
                                <td className="p-2 border border-slate-300 break-words">{skill}</td>
                                <td className="p-2 border border-slate-300">
                                    <div className="flex flex-col xl:flex-row gap-1">
                                        <button onClick={() => toggle(d, skill, 1)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 1 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100'}`}>Correct</button>
                                        <button onClick={() => toggle(d, skill, 0)} className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100'}`}>Incorrect</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    });
                })}
            </tbody>
        </table>
    );
}

function EencMonitoringGrid({ scenario, buffer, toggle }) {
    const isBreathing = scenario === 'breathing';
    const domains = isBreathing ? EENC_DOMAINS_BREATHING : EENC_DOMAINS_NOT_BREATHING;
    const skillsMap = isBreathing ? SKILLS_EENC_BREATHING : SKILLS_EENC_NOT_BREATHING;
    const labelsMap = isBreathing ? EENC_DOMAIN_LABEL_BREATHING : EENC_DOMAIN_LABEL_NOT_BREATHING;

    const getRowClass = (mark) => {
        if (mark === 2) return 'bg-green-50';
        if (mark === 1) return 'bg-yellow-50';
        if (mark === 0) return 'bg-red-50';
        return '';
    };

    return (
        <table className="text-sm border-collapse w-full table-fixed">
            <thead>
                <tr>
                    <th className="p-2 w-1/3 text-left border border-slate-300">Domain</th>
                    <th className="p-2 w-1/3 text-left border border-slate-300">Skill</th>
                    <th className="p-2 w-1/3 text-left border border-slate-300">Action</th>
                </tr>
            </thead>
            <tbody>
                {domains.map(d => {
                    const skills = skillsMap[d];
                    const title = labelsMap[d] || d;
                    return skills.map((skill, i) => {
                        const k = `${d}|${skill.text}`;
                        const mark = buffer[k];
                        const rowClass = getRowClass(mark);
                        return (
                            <tr key={`${d}-${i}`} className={rowClass}>
                                {i === 0 && <td className="p-2 align-top font-semibold text-gray-800 border border-slate-300" rowSpan={skills.length}>{title}</td>}
                                <td className="p-2 border border-slate-300 break-words">{skill.text}</td>
                                <td className="p-2 border border-slate-300">
                                    <div className="flex flex-wrap gap-1">
                                        <button onClick={() => toggle(d, skill.text, 2)}
                                            className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 2 ? 'bg-green-200 border-green-300' : 'bg-white hover:bg-gray-100'}`}>
                                            Yes
                                        </button>
                                        <button onClick={() => toggle(d, skill.text, 1)}
                                            className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 1 ? 'bg-yellow-200 border-yellow-300' : 'bg-white hover:bg-gray-100'}`}>
                                            Partial
                                        </button>
                                        <button onClick={() => toggle(d, skill.text, 0)}
                                            className={`px-3 py-1 text-sm rounded-md border border-gray-300 transition ${mark === 0 ? 'bg-red-200 border-red-300' : 'bg-white hover:bg-gray-100'}`}>
                                            No
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    });
                })}
            </tbody>
        </table>
    );
}

function SubmittedCases({ course, participant, observations, cases, onEditCase, onDeleteCase }) {
    const isImnci = course.course_type === 'IMNCI';
    const isEenc = course.course_type === 'EENC';

    const caseRows = useMemo(() => {
        return cases.map(c => {
            const relatedObs = observations.filter(o => o.caseId === c.id);
            let rowData = { ...c, date: c.encounter_date, setting: c.setting, age: c.age_group, serial: c.case_serial, day: c.day_of_course };

            if (isEenc) {
                const isBreathing = c.age_group === 'EENC_breathing';
                // EENC Max scores can vary based on skills recorded, so we calculate it dynamically
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
        }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || b.serial - a.serial);
    }, [cases, observations, isEenc]);

    const getAgeLabel = (age) => {
        if (isImnci) { return age === 'LT2M' ? '0-59 d' : '2-59 m'; }
        if (isEenc) { return age?.includes('breathing') ? (age.includes('not_breathing') ? 'Not Breathing' : 'Breathing') : age; }
        return age;
    };

    const headers = isEenc
        ? ["Date", "Day", "Scenario", "Serial", "Score", "% Score", "Actions"]
        : ["Date", "Day", ...(isImnci ? ["Setting"] : []), "Age band", "Serial", "Skills", "Correct", "% Correct", "Actions"];

    return (
        <Card>
            <PageHeader title={`Submitted Cases for ${participant.name}`} />
            <Table headers={headers}>
                {caseRows.length === 0 ? <EmptyState message="No cases submitted yet." colSpan={headers.length} /> : caseRows.map((c, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-4 border border-gray-200">{c.date}</td>
                        <td className="p-4 border border-gray-200">{c.day ?? ''}</td>
                        {isImnci && <td className="p-4 border border-gray-200">{c.setting}</td>}
                        <td className="p-4 border border-gray-200">{getAgeLabel(c.age)}</td>
                        <td className="p-4 border border-gray-200">{c.serial}</td>
                        {isEenc ? (
                            <>
                                <td className="p-4 border border-gray-200">{c.score}</td>
                                <td className={`p-4 font-mono border border-gray-200 ${pctBgClass(c.percentage)}`}>{fmtPct(c.percentage)}</td>
                            </>
                        ) : (
                            <>
                                <td className="p-4 border border-gray-200">{c.total}</td>
                                <td className="p-4 border border-gray-200">{c.correct}</td>
                                <td className={`p-4 font-mono border border-gray-200 ${pctBgClass(c.percentage)}`}>{fmtPct(c.percentage)}</td>
                            </>
                        )}
                        <td className="p-4 border border-gray-200">
                            <div className="flex gap-2 justify-end">
                                <Button variant="secondary" onClick={() => onEditCase(c)}>Edit</Button>
                                <Button variant="danger" onClick={() => onDeleteCase(c)}>Delete</Button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
}