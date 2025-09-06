import React, { useState, useEffect, useMemo, useRef } from "react";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Card, PageHeader, Button, FormGroup, Input, Select, Textarea, Table, EmptyState, Spinner, PdfIcon } from './UIComponents.jsx';
import {
    STATE_LOCALITIES, JOB_TITLES_IMNCI, JOB_TITLES_ETAT, JOB_TITLES_EENC,
    SKILLS_EENC_BREATHING, EENC_DOMAINS_BREATHING, EENC_DOMAIN_LABEL_BREATHING,
    SKILLS_EENC_NOT_BREATHING, EENC_DOMAINS_NOT_BREATHING, EENC_DOMAIN_LABEL_NOT_BREATHING,
    SKILLS_ETAT, ETAT_DOMAINS, ETAT_DOMAIN_LABEL,
    DOMAINS_BY_AGE_IMNCI, DOMAIN_LABEL_IMNCI, getClassListImnci,
    calcPct, fmtPct, pctBgClass, generateParticipantPdf
} from './ConstantsAndHelpers.js';
import { listParticipants, listObservationsForParticipant, listCasesForParticipant, upsertParticipant, upsertCaseAndObservations, deleteParticipant, deleteCaseAndObservations } from './data.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);


export function ParticipantsView({ course, participants, onAdd, onOpen, onEdit, onDelete, onOpenReport }) {
    const [groupFilter, setGroupFilter] = useState('All');
    const filtered = groupFilter === 'All' ? participants : participants.filter(p => p.group === groupFilter);

    return (
        <Card>
            <PageHeader title="Course Participants" subtitle={`${course.state} / ${course.locality}`} />

            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <Button onClick={onAdd}>Add Participant</Button>
                <div className="flex items-center gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Filter by Group:</label>
                    <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                        <option value="All">All Groups</option>
                        <option>Group A</option>
                        <option>Group B</option>
                        <option>Group C</option>
                        <option>Group D</option>
                    </Select>
                </div>
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block">
                <Table headers={["Name", "Group", "Job Title", "Actions"]}>
                    {filtered.length === 0 ? <EmptyState message="No participants found for this group." /> : filtered.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="p-4 border border-gray-200 font-medium text-gray-800">{p.name}</td>
                            <td className="p-4 border border-gray-200">{p.group}</td>
                            <td className="p-4 border border-gray-200">{p.job_title}</td>
                            <td className="p-4 border border-gray-200 text-right">
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <Button variant="secondary" onClick={() => onOpen(p.id)}>Monitor</Button>
                                    <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                    <Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button>
                                    <Button variant="danger" onClick={() => onDelete(p.id)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden grid gap-4">
                {filtered.length === 0 ? (
                    <p className="py-12 text-center text-gray-500">No participants found for this group.</p>
                ) : (
                    filtered.map(p => (
                        <div key={p.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                            <p className="text-gray-600">{p.job_title}</p>
                            <p className="text-sm text-gray-500 mt-1">Group: <span className="font-medium text-gray-700">{p.group}</span></p>
                            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
                                <Button variant="secondary" onClick={() => onOpen(p.id)}>Monitor</Button>
                                <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                <Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button>
                                <Button variant="danger" onClick={() => onDelete(p.id)}>Delete</Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}

export function ParticipantReportView({ course, participant, participants, onChangeParticipant, onBack }) {
    const [observations, setObservations] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);

    const chartByDayRef = useRef(null);
    const chartBySettingRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!participant?.id || !course?.id) return;
            setLoading(true);
            const [obsData, casesData] = await Promise.all([
                listObservationsForParticipant(course.id, participant.id),
                listCasesForParticipant(course.id, participant.id)
            ]);
            setObservations(obsData);
            setCases(casesData);
            setLoading(false);
        };
        fetchData();
    }, [participant?.id, course?.id]);

    const summaryStats = useMemo(() => {
        if (observations.length === 0) return { total: 0, correct: 0, score: 0, maxScore: 0, pct: NaN };
        if (course.course_type === 'EENC') {
            const score = observations.reduce((sum, o) => sum + o.item_correct, 0);
            const maxScore = observations.length * 2;
            return { score, maxScore, pct: calcPct(score, maxScore) };
        } else {
            const total = observations.length;
            const correct = observations.filter(o => o.item_correct > 0).length;
            return { total, correct, pct: calcPct(correct, total) };
        }
    }, [observations, course.course_type]);

    const performanceByDay = useMemo(() => {
        const dataByDay = {};
        observations.forEach(o => {
            const day = o.day_of_course || 1;
            dataByDay[day] = dataByDay[day] || { total: 0, correct: 0, score: 0, maxScore: 0 };
            dataByDay[day].total++;
            dataByDay[day].maxScore += (course.course_type === 'EENC' ? 2 : 1);
            if (o.item_correct > 0) dataByDay[day].correct++;
            if (course.course_type === 'EENC') dataByDay[day].score += o.item_correct;
        });

        return Object.entries(dataByDay).map(([day, data]) => ({
            day: `Day ${day}`,
            pct: course.course_type === 'EENC' ? calcPct(data.score, data.maxScore) : calcPct(data.correct, data.total)
        })).sort((a, b) => a.day.localeCompare(b.day, undefined, { numeric: true }));

    }, [observations, course.course_type]);

    const performanceBySetting = useMemo(() => {
        if (course.course_type !== 'IMNCI') return [];
        const dataBySetting = { OPD: { total: 0, correct: 0 }, IPD: { total: 0, correct: 0 } };
        observations.forEach(o => {
            const setting = o.setting || 'OPD';
            if (dataBySetting[setting]) {
                dataBySetting[setting].total++;
                if (o.item_correct > 0) dataBySetting[setting].correct++;
            }
        });
        return Object.entries(dataBySetting).map(([setting, data]) => ({
            setting,
            pct: calcPct(data.correct, data.total)
        }));
    }, [observations, course.course_type]);


    const detailedPerformance = useMemo(() => {
        const domains = {};
        let labelMap;

        if (course.course_type === 'IMNCI') {
            labelMap = DOMAIN_LABEL_IMNCI;
        } else if (course.course_type === 'ETAT') {
            labelMap = ETAT_DOMAIN_LABEL;
        } else if (course.course_type === 'EENC') {
            labelMap = { ...EENC_DOMAIN_LABEL_BREATHING, ...EENC_DOMAIN_LABEL_NOT_BREATHING };
        }

        observations.forEach(o => {
            if (!domains[o.domain]) {
                domains[o.domain] = {
                    label: labelMap[o.domain] || o.domain,
                    total: 0, correct: 0, score: 0, maxScore: 0, skills: {}
                };
            }
            const d = domains[o.domain];
            d.total++;
            d.maxScore += (course.course_type === 'EENC' ? 2 : 1);
            if (o.item_correct > 0) d.correct++;
            if (course.course_type === 'EENC') d.score += o.item_correct;

            if (!d.skills[o.item_recorded]) d.skills[o.item_recorded] = { total: 0, correct: 0, score: 0, maxScore: 0 };
            const s = d.skills[o.item_recorded];
            s.total++;
            s.maxScore += (course.course_type === 'EENC' ? 2 : 1);
            if (o.item_correct > 0) s.correct++;
            if (course.course_type === 'EENC') s.score += o.item_correct;
        });
        return Object.values(domains);

    }, [observations, course.course_type]);


    if (loading) return <Card><Spinner /></Card>;

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false }, title: { display: true, text: '' } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } } }
    };

    return (
        <div className="grid gap-6">
            <PageHeader
                title="Participant Performance Report"
                subtitle={participant.name}
                actions={<>
                    <div className="w-64">
                        <FormGroup label="Switch Participant">
                            <Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)}>
                                {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </FormGroup>
                    </div>
                    <Button onClick={() => generateParticipantPdf(participant, course, cases, observations, { byDay: chartByDayRef, bySetting: chartBySettingRef })} variant="secondary"><PdfIcon /> Export PDF</Button>
                    <Button onClick={onBack}>Back to List</Button>
                </>}
            />

            <Card>
                <h3 className="text-xl font-bold mb-4">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Cases Monitored</div>
                        <div className="text-3xl font-bold text-sky-700">{cases.length}</div>
                    </div>
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">Skills Observed</div>
                        <div className="text-3xl font-bold text-sky-700">{observations.length}</div>
                    </div>
                    <div className="p-4 bg-gray-100 rounded-lg">
                        <div className="text-sm text-gray-600">{course.course_type === 'EENC' ? 'Avg. Score' : '# Correct'}</div>
                        <div className="text-3xl font-bold text-sky-700">{course.course_type === 'EENC' ? `${summaryStats.score}/${summaryStats.maxScore}` : `${summaryStats.correct}/${summaryStats.total}`}</div>
                    </div>
                    <div className={`p-4 rounded-lg ${pctBgClass(summaryStats.pct)}`}>
                        <div className="text-sm font-semibold">Overall Score</div>
                        <div className="text-3xl font-bold">{fmtPct(summaryStats.pct)}</div>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Performance Analysis</h3>
                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <Bar ref={chartByDayRef} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: 'Performance by Day' } } }} data={{ labels: performanceByDay.map(d => d.day), datasets: [{ data: performanceByDay.map(d => d.pct), backgroundColor: '#0ea5e9' }] }} />
                    </div>
                    {course.course_type === 'IMNCI' && (
                        <div>
                            <Bar ref={chartBySettingRef} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: 'Performance by Setting' } } }} data={{ labels: performanceBySetting.map(d => d.setting), datasets: [{ data: performanceBySetting.map(d => d.pct), backgroundColor: ['#f97316', '#10b981'] }] }} />
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Detailed Performance by Domain</h3>
                <div className="space-y-4">
                    {detailedPerformance.map(domain => (
                        <details key={domain.label} className="bg-gray-50 p-3 rounded-lg">
                            <summary className="font-semibold cursor-pointer flex justify-between items-center">
                                <span>{domain.label}</span>
                                <span className={`font-mono text-sm px-2 py-1 rounded ${pctBgClass(course.course_type === 'EENC' ? calcPct(domain.score, domain.maxScore) : calcPct(domain.correct, domain.total))}`}>
                                    {fmtPct(course.course_type === 'EENC' ? calcPct(domain.score, domain.maxScore) : calcPct(domain.correct, domain.total))}
                                </span>
                            </summary>
                            <div className="mt-2 pl-4 border-l-2 border-gray-200">
                                <Table headers={["Skill/Classification", "Performance", "%"]}>
                                    {Object.entries(domain.skills).map(([skill, data]) => {
                                        const pct = course.course_type === 'EENC' ? calcPct(data.score, data.maxScore) : calcPct(data.correct, data.total);
                                        return (
                                            <tr key={skill}>
                                                <td className="p-2 border">{skill}</td>
                                                <td className="p-2 border">{course.course_type === 'EENC' ? `${data.score}/${data.maxScore}` : `${data.correct}/${data.total}`}</td>
                                                <td className={`p-2 border font-mono ${pctBgClass(pct)}`}>{fmtPct(pct)}</td>
                                            </tr>
                                        );
                                    })}
                                </Table>
                            </div>
                        </details>
                    ))}
                </div>
            </Card>
        </div>
    );
}

export function ParticipantForm({ course, initialData, onCancel, onSave }) {
    // --- Course Type Flags ---
    const isImnci = course.course_type === 'IMNCI';
    const isEtat = course.course_type === 'ETAT';
    const isEenc = course.course_type === 'EENC';

    // --- Dynamic Job Options ---
    const jobTitleOptions = useMemo(() => {
        if (isEtat) return JOB_TITLES_ETAT;
        if (isEenc) return JOB_TITLES_EENC;
        return JOB_TITLES_IMNCI;
    }, [isImnci, isEtat, isEenc]);

    // --- Common States ---
    const [name, setName] = useState(initialData?.name || '');
    const [state, setState] = useState(initialData?.state || '');
    const [locality, setLocality] = useState(initialData?.locality || '');
    const [center, setCenter] = useState(initialData?.center_name || ''); // Used for Facility/Hospital Name
    const [phone, setPhone] = useState(initialData?.phone || '');
    const [group, setGroup] = useState(initialData?.group || 'Group A');
    const [error, setError] = useState('');

    // --- Job Title State ---
    const initialJobTitle = initialData?.job_title || '';
    const isInitialJobOther = initialJobTitle && !jobTitleOptions.includes(initialJobTitle);
    const [job, setJob] = useState(isInitialJobOther ? 'Other' : initialJobTitle);
    const [otherJobTitle, setOtherJobTitle] = useState(isInitialJobOther ? initialJobTitle : '');

    // --- IMCI States ---
    const [imciSubType, setImciSubType] = useState(initialData?.imci_sub_type || 'Standard 7 days course');
    const [facilityType, setFacilityType] = useState(initialData?.facility_type || '');
    const [trainedIMNCI, setTrainedIMNCI] = useState(initialData?.trained_before ? 'yes' : 'no');
    const [lastTrainIMNCI, setLastTrainIMNCI] = useState(initialData?.last_imci_training || '');
    const [numProv, setNumProv] = useState(initialData?.num_other_providers || 1);
    const [numProvIMCI, setNumProvIMCI] = useState(initialData?.num_other_providers_imci || 0);
    const [hasNutri, setHasNutri] = useState(initialData?.has_nutrition_service || false);
    const [nearestNutri, setNearestNutri] = useState(initialData?.nearest_nutrition_center || '');
    const [hasImm, setHasImm] = useState(initialData?.has_immunization_service || false);
    const [nearestImm, setNearestImm] = useState(initialData?.nearest_immunization_center || '');
    const [hasORS, setHasORS] = useState(initialData?.has_ors_room || false);

    // --- ETAT States ---
    const [hospitalTypeEtat, setHospitalTypeEtat] = useState(initialData?.hospital_type || '');
    const [trainedEtat, setTrainedEtat] = useState(initialData?.trained_etat_before ? 'yes' : 'no');
    const [lastTrainEtat, setLastTrainEtat] = useState(initialData?.last_etat_training || '');
    const [hasTriageSystem, setHasTriageSystem] = useState(initialData?.has_triage_system || false);
    const [hasStabilizationCenter, setHasStabilizationCenter] = useState(initialData?.has_stabilization_center || false);
    const [hasHdu, setHasHdu] = useState(initialData?.has_hdu || false);
    const [numStaffInEr, setNumStaffInEr] = useState(initialData?.num_staff_in_er || 0);
    const [numStaffTrainedInEtat, setNumStaffTrainedInEtat] = useState(initialData?.num_staff_trained_in_etat || 0);

    // --- EENC States ---
    const [hospitalTypeEenc, setHospitalTypeEenc] = useState(initialData?.hospital_type || '');
    const [otherHospitalTypeEenc, setOtherHospitalTypeEenc] = useState(initialData?.other_hospital_type || '');
    const [trainedEENC, setTrainedEENC] = useState(initialData?.trained_eenc_before ? 'yes' : 'no');
    const [lastTrainEENC, setLastTrainEENC] = useState(initialData?.last_eenc_training || '');
    const [hasSncu, setHasSncu] = useState(initialData?.has_sncu || false);
    const [hasIycfCenter, setHasIycfCenter] = useState(initialData?.has_iycf_center || false);
    const [numStaffInDelivery, setNumStaffInDelivery] = useState(initialData?.num_staff_in_delivery || 0);
    const [numStaffTrainedInEenc, setNumStaffTrainedInEenc] = useState(initialData?.num_staff_trained_in_eenc || 0);
    const [hasKangaroo, setHasKangaroo] = useState(initialData?.has_kangaroo_room || false);

    // --- Dynamic Label Logic ---
    const professionalCategory = useMemo(() => {
        const lowerCaseJob = (job === 'Other' ? otherJobTitle : job).toLowerCase();
        if (lowerCaseJob.includes('doctor') || lowerCaseJob.includes('specialist') || lowerCaseJob.includes('registrar') || lowerCaseJob.includes('practioner')) return 'doctor';
        if (lowerCaseJob.includes('nurse')) return 'nurse';
        if (lowerCaseJob.includes('midwife')) return 'midwife';
        return 'provider'; // Neutral default
    }, [job, otherJobTitle]);

    const submit = () => {
        const finalJobTitle = job === 'Other' ? otherJobTitle : job;
        if (!name || !state || !locality || !center || !finalJobTitle || !phone) { setError('Please complete all required fields'); return; }

        let p = { name, group, state, locality, center_name: center, job_title: finalJobTitle, phone };

        if (isImnci) {
            if (!facilityType || !imciSubType) { setError('Please complete all required fields'); return; }
            if (numProv <= 0) { setError('Number of providers at health center must be more than zero.'); return; }
            p = { ...p, imci_sub_type: imciSubType, facility_type: facilityType, trained_before: trainedIMNCI === 'yes', last_imci_training: trainedIMNCI === 'yes' ? lastTrainIMNCI : '', num_other_providers: numProv, num_other_providers_imci: numProvIMCI, has_nutrition_service: hasNutri, has_immunization_service: hasImm, has_ors_room: hasORS, nearest_nutrition_center: !hasNutri ? nearestNutri : '', nearest_immunization_center: !hasImm ? nearestImm : '' };
        } else if (isEtat) {
            if (!hospitalTypeEtat) { setError('Please complete all required fields'); return; }
            p = { ...p, hospital_type: hospitalTypeEtat, trained_etat_before: trainedEtat === 'yes', last_etat_training: trainedEtat === 'yes' ? lastTrainEtat : '', has_triage_system: hasTriageSystem, has_stabilization_center: hasStabilizationCenter, has_hdu: hasHdu, num_staff_in_er: numStaffInEr, num_staff_trained_in_etat: numStaffTrainedInEtat };
        } else if (isEenc) {
            if (!hospitalTypeEenc) { setError('Please complete all required fields'); return; }
            p = { ...p, hospital_type: hospitalTypeEenc === 'other' ? otherHospitalTypeEenc : hospitalTypeEenc, trained_eenc_before: trainedEENC === 'yes', last_eenc_training: trainedEENC === 'yes' ? lastTrainEENC : '', has_sncu: hasSncu, has_iycf_center: hasIycfCenter, num_staff_in_delivery: numStaffInDelivery, num_staff_trained_in_eenc: numStaffTrainedInEenc, has_kangaroo_room: hasKangaroo };
        }

        onSave(p);
    };

    return (
        <Card>
            <PageHeader title={initialData ? 'Edit Participant' : 'Add New Participant'} />
            {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* --- COMMON FIELDS --- */}
                <FormGroup label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormGroup>
                <FormGroup label="Group"><Select value={group} onChange={(e) => setGroup(e.target.value)}><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                <FormGroup label={isEtat ? "Hospital Name" : "Health Facility Name"}><Input value={center} onChange={(e) => setCenter(e.target.value)} /></FormGroup>

                <FormGroup label="Job Title">
                    <Select value={job} onChange={(e) => setJob(e.target.value)}>
                        <option value="">— Select Job —</option>
                        {jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </Select>
                </FormGroup>

                {job === 'Other' && (
                    <FormGroup label="Specify Job Title">
                        <Input value={otherJobTitle} onChange={(e) => setOtherJobTitle(e.target.value)} placeholder="Please specify" />
                    </FormGroup>
                )}

                <FormGroup label="Phone Number"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></FormGroup>

                {/* --- IMCI SPECIFIC FIELDS --- */}
                {isImnci && (<>
                    <FormGroup label="IMCI Course Sub-type">
                        <Select value={imciSubType} onChange={(e) => setImciSubType(e.target.value)}>
                            <option>Standard 7 days course</option>
                            <option>Refreshment course</option>
                            <option>IMNCI in humanitarian setting</option>
                            <option>online IMCI course</option>
                            <option>preservice Course</option>
                        </Select>
                    </FormGroup>
                    <FormGroup label="Facility Type"><Select value={facilityType} onChange={(e) => setFacilityType(e.target.value)}><option value="">— Select Type —</option><option value="Health Unit">Health Unit</option><option value="Health Center">Health Center</option><option value="Rural Hospital">Rural Hospital</option><option value="Teaching Hospital">Teaching Hospital</option><option value="other">Other</option></Select></FormGroup>
                    <FormGroup label="Previously trained in IMCI?"><Select value={trainedIMNCI ? 'yes' : 'no'} onChange={(e) => setTrainedIMNCI(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {trainedIMNCI === 'yes' && <FormGroup label="Date of last training"><Input type="date" value={lastTrainIMNCI} onChange={(e) => setLastTrainIMNCI(e.target.value)} /></FormGroup>}
                    <FormGroup label="Has therapeutic nutrition service?"><Select value={hasNutri ? 'yes' : 'no'} onChange={e => setHasNutri(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {!hasNutri && <FormGroup label="Nearest therapeutic nutrition center?"><Input value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} /></FormGroup>}
                    <FormGroup label="Has immunization service?"><Select value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {!hasImm && <FormGroup label="Nearest immunization center?"><Input value={nearestImm} onChange={e => setNearestImm(e.target.value)} /></FormGroup>}
                    <FormGroup label="Has ORS corner service?"><Select value={hasORS ? 'yes' : 'no'} onChange={e => setHasORS(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Number of provider at health center including the current participant"><Input type="number" min="1" value={numProv} onChange={(e) => setNumProv(Number(e.target.value || 1))} /></FormGroup>
                    <FormGroup label="Number of providers trained in IMCI (not including current COURSE)"><Input type="number" min="0" value={numProvIMCI} onChange={(e) => setNumProvIMCI(Number(e.target.value || 0))} /></FormGroup>
                </>)}

                {/* --- ETAT SPECIFIC FIELDS --- */}
                {isEtat && (<>
                    <FormGroup label="Hospital Type"><Select value={hospitalTypeEtat} onChange={e => setHospitalTypeEtat(e.target.value)}><option value="">— Select Type —</option><option>Pediatric Hospital</option><option>Pediatric Department in General Hospital</option><option>Rural Hospital</option><option>other</option></Select></FormGroup>
                    <FormGroup label="Previously trained on ETAT?"><Select value={trainedEtat ? 'yes' : 'no'} onChange={e => setTrainedEtat(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {trainedEtat === 'yes' && <FormGroup label="Date of last ETAT training"><Input type="date" value={lastTrainEtat} onChange={(e) => setLastTrainEtat(e.target.value)} /></FormGroup>}
                    <FormGroup label="Does hospital have a current triaging system?"><Select value={hasTriageSystem ? 'yes' : 'no'} onChange={e => setHasTriageSystem(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have a stabilization center for malnutrition?"><Select value={hasStabilizationCenter ? 'yes' : 'no'} onChange={e => setHasStabilizationCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have a high dependency unit?"><Select value={hasHdu ? 'yes' : 'no'} onChange={e => setHasHdu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s working in Emergency Room`}><Input type="number" min="0" value={numStaffInEr} onChange={e => setNumStaffInEr(Number(e.target.value || 0))} /></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s trained in ETAT`}><Input type="number" min="0" value={numStaffTrainedInEtat} onChange={e => setNumStaffTrainedInEtat(Number(e.target.value || 0))} /></FormGroup>
                </>)}

                {/* --- EENC SPECIFIC FIELDS --- */}
                {isEenc && (<>
                    <FormGroup label="Hospital Type"><Select value={hospitalTypeEenc} onChange={e => setHospitalTypeEenc(e.target.value)}><option value="">— Select Type —</option><option>Comprehensive EmONC</option><option>Basic EmONC</option><option value="other">Other (specify)</option></Select></FormGroup>
                    {hospitalTypeEenc === 'other' && <FormGroup label="Specify Hospital Type"><Input value={otherHospitalTypeEenc} onChange={e => setOtherHospitalTypeEenc(e.target.value)} /></FormGroup>}
                    <FormGroup label="Previously trained on EENC?"><Select value={trainedEENC ? 'yes' : 'no'} onChange={e => setTrainedEENC(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    {trainedEENC === 'yes' && <FormGroup label="Date of last EENC training"><Input type="date" value={lastTrainEENC} onChange={(e) => setLastTrainEENC(e.target.value)} /></FormGroup>}
                    <FormGroup label="Does hospital have a Special Newborn Care Unit (SNCU)?"><Select value={hasSncu ? 'yes' : 'no'} onChange={e => setHasSncu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have an IYCF center?"><Select value={hasIycfCenter ? 'yes' : 'no'} onChange={e => setHasIycfCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label="Does hospital have a Kangaroo care room?"><Select value={hasKangaroo ? 'yes' : 'no'} onChange={e => setHasKangaroo(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s working in delivery room`}><Input type="number" min="0" value={numStaffInDelivery} onChange={e => setNumStaffInDelivery(Number(e.target.value || 0))} /></FormGroup>
                    <FormGroup label={`Number of ${professionalCategory}s trained in EENC`}><Input type="number" min="0" value={numStaffTrainedInEenc} onChange={e => setNumStaffTrainedInEenc(Number(e.target.value || 0))} /></FormGroup>
                </>)}
            </div>
            <div className="flex gap-2 justify-end mt-6 border-t pt-6"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={submit}>Save Participant</Button></div>
        </Card>
    );
}

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
                // Using a custom message box instead of alert()
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
            // Using a custom message box instead of alert()
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
        // Using a custom message box instead of alert() or confirm()
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
