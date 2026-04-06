// MentorshipDashboard.jsx
import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Spinner } from '../CommonComponents'; 
import { 
    FilterSelect, 
    CopyImageButton, 
    ScoreText, 
    KpiCard, 
    KpiBarChart,
    IMNCI_MOTHER_SURVEY_ITEMS_EN,
    EENC_MOTHER_SURVEY_ITEMS_EN   
} from './MentorshipDashboardShared';
import AdminDashboardTab from './AdminDashboardTab';
import ProviderSkillsTab from './ProviderSkillsTab';
import MotherInterviewsTab from './MotherInterviewsTab';
import VisitReportDashboardTab from './VisitReportDashboardTab';

import { IMNCI_FORM_STRUCTURE, calculateScores, rehydrateDraftData, DIARRHEA_CLASSIFICATIONS, FEVER_CLASSIFICATIONS } from './IMNCSkillsAssessmentForm.jsx';
import { PREPARATION_ITEMS, DRYING_STIMULATION_ITEMS, NORMAL_BREATHING_ITEMS, RESUSCITATION_ITEMS } from './EENCSkillsAssessmentForm.jsx';

// --- Constants & Dictionaries ---
const SERVICE_TITLES = {
    'IMNCI': 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)',
    'EENC': 'Early Essential Newborn Care (EENC)',
    'ETAT': 'Emergency Triage, Assessment and Treatment (ETAT)',
    'IPC': 'Infection Prevention and Control in Neonatal Units (IPC)'
};

const IMNCI_SKILL_GROUPS = {
    group1: { title: "Number of training sessions on use of IMNCI tools", keys: ['skill_chartbook', 'skill_counseling_card', 'skill_record_form', 'skill_stat_reports'], labels: ['Chartbooklet use training sessions', 'Mother Counseling Card use training sessions', 'Recording Form filling training sessions', 'Daily and Monthly Statistic Reports filling training sessions'], color: '#3b82f6' },
    group2: { title: "Number of training sessions on Main IMNCI Signs Assessment", keys: ['skill_danger_signs', 'skill_rr', 'skill_dehydration', 'skill_immunization_referral'], labels: ['Danger Signs assessment training sessions', 'Respiratory Rate measurement training sessions', 'Dehydration assessment training sessions', 'Immunization check training sessions'], color: '#10b981' },
    group3: { title: "Number of training sessions on Malnutrition signs Assessment", keys: ['skill_weight', 'skill_height', 'skill_muac', 'skill_wfh', 'skill_edema'], labels: ['Weight measurement training sessions', 'Height measurement training sessions', 'MUAC measurement training sessions', 'Z-Score measurement training sessions', 'Lower Limb Edema check training sessions'], color: '#f59e0b' }
};

const EENC_SKILLS_LABELS = {
    skill_pre_handwash: "Hand Washing", skill_pre_equip: "Equipment Preparation", skill_drying: "Drying", skill_skin_to_skin: "Skin-to-Skin Contact", skill_suction: "Suctioning", skill_cord_pulse_check: "Cord Pulse Check", skill_clamp_placement: "Clamp Placement", skill_transfer: "Baby Transfer", skill_airway: "Opening Airway", skill_ambubag_placement: "Ambu Bag Placement", skill_ambubag_use: "Ambu Bag Use", skill_ventilation_rate: "Ventilation Rate", skill_correction_steps: "Corrective Steps",
};

// --- Helpers ---
const calculateAverage = (scores) => {
    if (!scores || !Array.isArray(scores)) return null;
    const validScores = scores.filter(s => isFinite(s) && !isNaN(s) && s !== null);
    if (validScores.length === 0) return null;
    return validScores.reduce((a, b) => a + b, 0) / validScores.length;
};

const MentorshipDashboard = ({ 
    allSubmissions, STATE_LOCALITIES, activeService, activeState, onStateChange, activeLocality, onLocalityChange, activeFacilityId, onFacilityIdChange, activeWorkerName, onWorkerNameChange, activeProject, onProjectChange, visitReports, canEditStatus, onUpdateStatus, activeWorkerType, onWorkerTypeChange = () => {},
    publicDashboardMode = false, handleRefresh = () => {}, isRefreshing = false, isLoading = false,
    lastUpdated = null, currentUserRole = '',
    dateFilter = '', onDateFilterChange = () => {}
}) => {

    const [activeEencTab, setActiveEencTab] = useState('skills'); 
    const [activeImnciTab, setActiveImnciTab] = useState('skills'); 
    
    const recalcCacheRef = useRef({});

    const checkDateFilter = useCallback((dateString, dateFilt) => {
        if (!dateFilt) return true;
        if (!dateString) return false;
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return false;
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (dateFilt) {
            case 'today':
                return d.getTime() >= today.getTime() && d.getTime() < today.getTime() + 86400000;
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return d.getTime() >= yesterday.getTime() && d.getTime() < today.getTime();
            case 'this_week':
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                return d >= startOfWeek;
            case 'last_week':
                const startOfLastWeek = new Date(today);
                startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
                const endOfLastWeek = new Date(startOfLastWeek);
                endOfLastWeek.setDate(startOfLastWeek.getDate() + 7);
                return d >= startOfLastWeek && d < endOfLastWeek;
            case 'this_month':
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            case 'last_month':
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
            case 'this_year':
                return d.getFullYear() === now.getFullYear();
            case 'last_year':
                return d.getFullYear() === now.getFullYear() - 1;
            default:
                return true;
        }
    }, []);

    // --- Local State for Optimistic Updates ---
    const [localStatusUpdates, setLocalStatusUpdates] = useState({});
    useEffect(() => { setLocalStatusUpdates({}); }, [visitReports]);

    const handleLocalUpdate = (reportId, challengeId, newValue, fieldName) => {
        const key = `${reportId}_${challengeId}_${fieldName}`;
        setLocalStatusUpdates(prev => ({ ...prev, [key]: newValue }));
        onUpdateStatus(reportId, challengeId, newValue, fieldName);
    };

    const renderStatusCell = (currentStatus, reportId, challengeId, fieldName) => {
        const key = `${reportId}_${challengeId}_${fieldName}`;
        const displayStatus = localStatusUpdates[key] !== undefined ? localStatusUpdates[key] : currentStatus;

        if (canEditStatus) {
            return (
                <select value={displayStatus} onChange={(e) => handleLocalUpdate(reportId, challengeId, e.target.value, fieldName)} className={`block w-full text-[11px] font-bold border border-black rounded-lg shadow-sm focus:border-sky-500 focus:ring-sky-500 bg-white ${displayStatus === 'Done' || displayStatus === 'Resolved' ? 'text-emerald-700' : displayStatus === 'In Progress' ? 'text-sky-700' : 'text-amber-700'}`}>
                    <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Done">Done</option>
                    <option value="Resolved">Resolved</option>
                </select>
            );
        } else {
            return (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-sm border border-black ${displayStatus === 'Done' || displayStatus === 'Resolved' ? 'bg-emerald-50 text-emerald-700' : displayStatus === 'In Progress' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                    {displayStatus}
                </span>
            );
        }
    };

    const dynamicLocationLevel = !activeState ? 'State' : (!activeLocality ? 'Locality' : 'Facility');
    const dynamicLocationLabel = dynamicLocationLevel === 'State' ? 'State' : (dynamicLocationLevel === 'Locality' ? 'Locality' : 'Facility & Date');
    const geographicLevelName = activeState ? 'Locality' : 'State';


    // --- 1. DATA PROCESSING PIPELINE ---
    
    const visitReportStats = useMemo(() => {
        if (!visitReports) return null;
        let filtered = visitReports.filter(r => r.service === activeService);
        if (activeState) filtered = filtered.filter(r => r.state === activeState);
        if (activeLocality) filtered = filtered.filter(r => r.locality === activeLocality);
        if (activeFacilityId) filtered = filtered.filter(r => r.facilityId === activeFacilityId);
        if (activeProject) filtered = filtered.filter(r => r.project === activeProject);
        filtered = filtered.filter(r => checkDateFilter(r.visitDate || r.date || r.visit_date, dateFilter));

        const totalVisits = filtered.length;
        const isStateLevel = !activeState;
        const locationCounts = {};
        
        filtered.forEach(r => {
            const loc = isStateLevel ? (r.state || 'Unknown') : (r.locality || 'Unknown');
            locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        });
        
        const geographicChartData = Object.keys(locationCounts).map(k => {
             let locName = k;
            if (isStateLevel) locName = STATE_LOCALITIES[k]?.en || k;
            else {
                const stateObj = STATE_LOCALITIES[activeState];
                if (stateObj && stateObj.localities) {
                    const locObj = stateObj.localities.find(l => l.en === k);
                    if (locObj) locName = locObj.en;
                }
            }
            return { stateName: locName, count: locationCounts[k] };
        });

        const groupedProblems = {}; let totalProblems = 0; let totalSkillsTrained = 0;
        
        filtered.forEach(r => {
            const data = r.fullData || r; 
            
            if (r.service === 'IMNCI' && data.trained_skills) {
                Object.values(data.trained_skills).forEach(val => { if (val === true || val === 'yes') totalSkillsTrained++; });
            }
            if (data.challenges_table) {
                let locName = 'Unknown';
                if (dynamicLocationLevel === 'State') locName = STATE_LOCALITIES[r.state]?.en || r.state || 'Unknown';
                else if (dynamicLocationLevel === 'Locality') {
                    if (STATE_LOCALITIES[r.state]?.localities) {
                        const lObj = STATE_LOCALITIES[r.state].localities.find(l => l.en === r.locality || l.ar === r.locality);
                        locName = lObj ? lObj.en : (r.locality || 'Unknown');
                    } else locName = r.locality || 'Unknown';
                } else locName = r.facilityName || 'Unknown';

                data.challenges_table.forEach(ch => {
                    if (ch.problem) {
                        let combinedSolution = ch.solution || '';
                        if (!combinedSolution && (ch.immediate_solution || ch.long_term_solution)) combinedSolution = [ch.immediate_solution, ch.long_term_solution].filter(Boolean).join(' / ');
                        if (!groupedProblems[locName]) groupedProblems[locName] = [];
                        
                        groupedProblems[locName].push({ reportId: r.id, challengeId: ch.id, facility: r.facilityName, date: r.visitDate || r.visit_date || r.date, problem: ch.problem, solution: combinedSolution, status: ch.status || ch.immediate_status || 'Pending', person: ch.responsible_person });
                        totalProblems++;
                    }
                });
            }
        });

        const processSkillGroup = (groupDef, visits, totalCountOverall) => {
            const details = groupDef.keys.map((key, idx) => {
                let count = 0;
                visits.forEach(r => { 
                    const data = r.fullData || r;
                    if (r.service === 'IMNCI' && data.trained_skills?.[key]) count++; 
                });
                return { label: groupDef.labels[idx], count, pct: totalCountOverall > 0 ? Math.round((count / totalCountOverall) * 100) : 0 };
            });
            return { details }; 
        };

        const trainedSkillsGroups = {
            group1: processSkillGroup(IMNCI_SKILL_GROUPS.group1, filtered, totalSkillsTrained),
            group2: processSkillGroup(IMNCI_SKILL_GROUPS.group2, filtered, totalSkillsTrained),
            group3: processSkillGroup(IMNCI_SKILL_GROUPS.group3, filtered, totalSkillsTrained)
        };

        const facilityMap = {}; const skillKeys = new Set();
        filtered.forEach(r => {
            const fid = r.facilityId;
            const data = r.fullData || r;
            
            if (!facilityMap[fid]) facilityMap[fid] = { id: fid, facilityName: r.facilityName, state: r.state, locality: r.locality, visitCount: 0, skills: {} };
            facilityMap[fid].visitCount++;
            if (data.trained_skills) {
                Object.keys(data.trained_skills).forEach(k => { if (data.trained_skills[k]) { facilityMap[fid].skills[k] = (facilityMap[fid].skills[k] || 0) + 1; skillKeys.add(k); } });
            }
        });
        
        return { totalVisits, geographicChartData, facilityTableData: Object.values(facilityMap), distinctSkillKeys: Array.from(skillKeys), groupedProblems, totalProblems, trainedSkillsGroups, totalSkillsTrained, rawReports: filtered };
    }, [visitReports, activeService, activeState, activeLocality, activeFacilityId, activeProject, STATE_LOCALITIES, dynamicLocationLevel, dateFilter, checkDateFilter]);

    const reCalculatedSubmissions = useMemo(() => {
        if (!allSubmissions) return [];
        return allSubmissions.map(sub => {
            if (sub.service === 'EENC_MOTHERS' || sub.service === 'IMNCI_MOTHERS') return sub; 
            if (sub.service !== 'IMNCI' || !sub.fullData) return sub;
            const s = sub.scores || {};
            
            if (s.treatment_total_score_maxScore === undefined) {
                if (recalcCacheRef.current[sub.id]) {
                    return { ...sub, scores: recalcCacheRef.current[sub.id] };
                }
                
                try {
                    const rehydratedData = rehydrateDraftData(sub.fullData, DIARRHEA_CLASSIFICATIONS, FEVER_CLASSIFICATIONS);
                    const reCalculatedScores = calculateScores(rehydratedData);
                    const newScoresPayload = {};
                    
                    for (const key in reCalculatedScores) { 
                        if (key !== 'treatmentScoreForSave' && reCalculatedScores[key]?.score !== undefined && reCalculatedScores[key]?.maxScore !== undefined) {
                            newScoresPayload[`${key}_score`] = reCalculatedScores[key].score;
                            newScoresPayload[`${key}_maxScore`] = reCalculatedScores[key].maxScore;
                        }
                    }
                    
                    recalcCacheRef.current[sub.id] = newScoresPayload;
                    
                    return { ...sub, scores: newScoresPayload };
                } catch (e) { return sub; }
            }
            return sub;
        });
    }, [allSubmissions]);


    // KPI Helpers
    const imnciKpiHelper = useCallback((submissions) => {
        const scores = {
            overall: [], assessment: [], decision: [], treatment: [],
            handsOnWeight: [], handsOnTemp: [], handsOnHeight: [],
            respiratoryRateCalculation: [], dehydrationAssessment: [],
            handsOnMUAC: [], handsOnWFH: [], handsOnPallor: [],
            pneuAmox: [], diarOrs: [], diarZinc: [], anemiaIron: [],
            immunization: [], vitaminAssessment: [], malariaCoartem: [], returnImm: [], returnFu: [],
            recordSigns: [], recordClassifications: [], recordTreatments: [],
            vitalSigns: [], dangerSigns: [], mainSymptoms: [], malnutrition: [], otherProblems: [],
            measurementSkills: [], malnutritionAnemiaSkills: [],
        };
        const uniqueVisits = new Set(submissions.map(s => `${s.facilityId || 'unk'}_${s.staff || 'unk'}_${s.date || 'unk'}`));
        const uniqueWorkers = new Set(submissions.map(s => `${s.facilityId || 'unk'}_${s.staff || 'unk'}`));
        const skillStats = {};
        const initStat = (key) => { if (!skillStats[key]) skillStats[key] = { yes: 0, no: 0 }; };

        ['skill_ask_cough', 'skill_check_rr', 'skill_classify_cough', 'skill_ask_diarrhea', 'skill_check_dehydration', 'skill_classify_diarrhea', 'skill_ask_fever', 'skill_check_rdt', 'skill_classify_fever', 'skill_ask_ear', 'skill_check_ear', 'skill_classify_ear', 'decisionMatches'].forEach(k => initStat(k));
        IMNCI_FORM_STRUCTURE.forEach(group => { group.subgroups?.forEach(sub => { sub.skills?.forEach(skill => initStat(skill.key)); }); });

        submissions.forEach(sub => {
            const s = sub.scores || {}; const as = sub.fullData?.assessmentSkills || {}; const ts = sub.fullData?.treatmentSkills || {};
            if (s.overallScore_maxScore > 0) scores.overall.push(s.overallScore_score / s.overallScore_maxScore);
            if (s.assessment_total_score_maxScore > 0) scores.assessment.push(s.assessment_total_score_score / s.assessment_total_score_maxScore);
            if (s.finalDecision_maxScore > 0) scores.decision.push(s.finalDecision_score / s.finalDecision_maxScore);
            if (s.treatment_total_score_maxScore > 0) scores.treatment.push(s.treatment_total_score_score / s.treatment_total_score_maxScore);
            if (s.immunization_maxScore > 0) scores.immunization.push(s.immunization_score / s.immunization_maxScore);
            
            Object.keys(scores).forEach(key => {
                const maxKey = `${key}_maxScore`; const scKey = `${key}_score`;
                if (s[maxKey] > 0 && !['overall', 'assessment', 'decision', 'treatment', 'immunization', 'vitaminAssessment', 'malariaCoartem', 'returnImm', 'returnFu', 'measurementSkills', 'malnutritionAnemiaSkills', 'respiratoryRateCalculation', 'dehydrationAssessment', 'pneuAmox', 'diarOrs', 'diarZinc', 'anemiaIron', 'recordSigns', 'recordClassifications', 'recordTreatments'].includes(key)) {
                    scores[key].push(s[scKey] / s[maxKey]);
                }
            });

            if (as['supervisor_confirms_cough'] === 'yes') scores.respiratoryRateCalculation.push(as['skill_check_rr'] === 'yes' ? 1 : 0);
            if (as['supervisor_confirms_diarrhea'] === 'yes') scores.dehydrationAssessment.push(as['skill_check_dehydration'] === 'yes' ? 1 : 0);

            const pushSpecificTreatment = (skillKey, targetArr) => { const val = ts[skillKey]; if (val === 'yes') targetArr.push(1); else if (val === 'no') targetArr.push(0); };
            pushSpecificTreatment('skill_pneu_abx', scores.pneuAmox); pushSpecificTreatment('skill_diar_ors', scores.diarOrs); pushSpecificTreatment('skill_diar_zinc', scores.diarZinc); pushSpecificTreatment('skill_anemia_iron', scores.anemiaIron);

            let vitAVal = null; if (as['skill_imm_vita'] === 'yes') vitAVal = 1; else if (as['skill_imm_vita'] === 'no' || as['skill_imm_vita'] === 'na') vitAVal = 0;
            if (vitAVal !== null) scores.vitaminAssessment.push(vitAVal);

            let coartemVal = null; if (ts['skill_mal_meds'] === 'yes') coartemVal = 1; else if (ts['skill_mal_meds'] === 'no') coartemVal = 0;
            if (coartemVal !== null) scores.malariaCoartem.push(coartemVal);

            let returnImmVal = null; if (ts['skill_fu_when'] === 'yes') returnImmVal = 1; else if (ts['skill_fu_when'] === 'no') returnImmVal = 0;
            if (returnImmVal !== null) scores.returnImm.push(returnImmVal);

            let returnFuVal = null; if (ts['skill_fu_return'] === 'yes') returnFuVal = 1; else if (ts['skill_fu_return'] === 'no') returnFuVal = 0;
            if (returnFuVal !== null) scores.returnFu.push(returnFuVal);
            
            const rs = sub.fullData?.recording_skills || sub.fullData?.recordingSkills || {};
            if (rs['skill_record_signs'] === 'yes') scores.recordSigns.push(1); else if (rs['skill_record_signs'] === 'no') scores.recordSigns.push(0);
            if (rs['skill_record_classifications'] === 'yes') scores.recordClassifications.push(1); else if (rs['skill_record_classifications'] === 'no') scores.recordClassifications.push(0);
            if (rs['skill_record_treatments'] === 'yes') scores.recordTreatments.push(1); else if (rs['skill_record_treatments'] === 'no') scores.recordTreatments.push(0);

            const pushSkillWithFallback = (scoreVal, maxVal, skillKey, targetArr) => { if (maxVal > 0) { targetArr.push(scoreVal / maxVal); } else if (as[skillKey]) { targetArr.push((as[skillKey] === 'yes' || as[skillKey] === 'correct' || as[skillKey] === true) ? 1 : 0); } };
            pushSkillWithFallback(s.handsOnWeight_score, s.handsOnWeight_maxScore, 'skill_weight', scores.measurementSkills); pushSkillWithFallback(s.handsOnTemp_score, s.handsOnTemp_maxScore, 'skill_temp', scores.measurementSkills); pushSkillWithFallback(s.handsOnHeight_score, s.handsOnHeight_maxScore, 'skill_height', scores.measurementSkills);
            pushSkillWithFallback(s.handsOnMUAC_score, s.handsOnMUAC_maxScore, 'skill_muac', scores.malnutritionAnemiaSkills); pushSkillWithFallback(s.handsOnWFH_score, s.handsOnWFH_maxScore, 'skill_wfh', scores.malnutritionAnemiaSkills);
            
            const pallorVal = as['skill_anemia_pallor'];
            if (pallorVal === 'yes') { scores.handsOnPallor.push(1); scores.malnutritionAnemiaSkills.push(1); } else if (pallorVal === 'no') { scores.handsOnPallor.push(0); scores.malnutritionAnemiaSkills.push(0); }

            const allSkills = { ...as, ...ts, ...rs };
            Object.keys(skillStats).forEach(key => {
                if (key === 'decisionMatches') return; 
                const val = allSkills[key];
                if (val === 'yes' || val === 'correct' || val === true) skillStats[key].yes++; else if (val === 'no' || val === 'incorrect' || val === false) skillStats[key].no++;
            });

            const decisionMatch = sub.fullData?.decision_agreement || sub.fullData?.decision_score_agreement; 
            if (decisionMatch === 'yes' || decisionMatch === true) skillStats['decisionMatches'].yes++; else if (decisionMatch === 'no' || decisionMatch === false) skillStats['decisionMatches'].no++;
        });

        const avg = (arr) => calculateAverage(arr);
        return {
            totalVisits: uniqueVisits.size, totalCasesObserved: submissions.length, totalHealthWorkers: uniqueWorkers.size, skillStats,
            avgOverall: avg(scores.overall), avgAssessment: avg(scores.assessment), avgDecision: avg(scores.decision), avgTreatment: avg(scores.treatment),
            avgRespiratoryRateCalculation: avg(scores.respiratoryRateCalculation), avgDehydrationAssessment: avg(scores.dehydrationAssessment), 
            avgHandsOnWeight: avg(scores.handsOnWeight), avgHandsOnTemp: avg(scores.handsOnTemp), avgHandsOnHeight: avg(scores.handsOnHeight), 
            avgHandsOnMUAC: avg(scores.handsOnMUAC), avgHandsOnWFH: avg(scores.handsOnWFH), avgHandsOnPallor: avg(scores.handsOnPallor),
            avgPneuAmox: avg(scores.pneuAmox), avgDiarOrs: avg(scores.diarOrs), avgDiarZinc: avg(scores.diarZinc), avgAnemiaIron: avg(scores.anemiaIron),
            avgImmunization: avg(scores.immunization), avgVitaminAssessment: avg(scores.vitaminAssessment), avgMalariaCoartem: avg(scores.malariaCoartem), avgReturnImm: avg(scores.returnImm), avgReturnFu: avg(scores.returnFu),
            avgRecordSigns: avg(scores.recordSigns), avgRecordClass: avg(scores.recordClassifications), avgRecordTreat: avg(scores.recordTreatments),
            avgDangerSigns: avg(scores.dangerSigns), avgMeasurementSkills: avg(scores.measurementSkills), avgMalnutritionAnemiaSkills: avg(scores.malnutritionAnemiaSkills),
        };
    }, []);

    const eencKpiHelper = useCallback((submissions) => {
        const scores = {
            overall: [], preparation: [], drying: [], normal_breathing: [], resuscitation: [],
            inf_wash1: [], inf_wash2: [], inf_gloves: [], prep_towel: [], prep_equip: [], prep_ambu: [],
            care_dry: [], care_skin: [], care_cover: [], cord_hygiene: [], cord_delay: [], cord_clamp: [],
            bf_advice: [], resus_head: [], resus_mask: [], resus_chest: [], resus_rate: []
        };
        const uniqueVisits = new Set(submissions.map(s => `${s.facilityId || 'unk'}_${s.staff || 'unk'}_${s.date || 'unk'}`));
        const uniqueWorkers = new Set(submissions.map(s => `${s.facilityId || 'unk'}_${s.staff || 'unk'}`));

        const skillStats = {};
        const allSkillItems = [...PREPARATION_ITEMS, ...DRYING_STIMULATION_ITEMS, ...NORMAL_BREATHING_ITEMS, ...RESUSCITATION_ITEMS];
        allSkillItems.forEach(item => { skillStats[item.key] = { yes: 0, no: 0, partial: 0, na: 0 }; });

        submissions.forEach(sub => {
            const s = sub.scores; const skills = sub.fullData?.skills; const status = sub.fullData?.eenc_breathing_status;
            if (s) {
                if (s.overallScore_maxScore > 0) scores.overall.push(s.overallScore_score / s.overallScore_maxScore);
                if (s.preparation_maxScore > 0) scores.preparation.push(s.preparation_score / s.preparation_maxScore);
                if (s.drying_maxScore > 0) scores.drying.push(s.drying_score / s.drying_maxScore);
                if (s.normal_breathing_maxScore > 0) scores.normal_breathing.push(s.normal_breathing_score / s.normal_breathing_maxScore);
                if (s.resuscitation_maxScore > 0) scores.resuscitation.push(s.resuscitation_score / s.resuscitation_maxScore);
            }
            if (skills) {
                allSkillItems.forEach(item => {
                    const value = skills[item.key];
                    if (value === 'yes') skillStats[item.key].yes++; else if (value === 'no') skillStats[item.key].no++;
                    else if (value === 'partial') skillStats[item.key].partial++; else if (value === 'na') skillStats[item.key].na++;
                });
                const pushScore = (key, arrayName) => { if (skills[key] === 'yes') scores[arrayName].push(1); else if (skills[key] === 'no' || skills[key] === 'partial') scores[arrayName].push(0); };
                pushScore('prep_wash_1', 'inf_wash1'); pushScore('prep_wash_2', 'inf_wash2'); pushScore('prep_gloves', 'inf_gloves');
                pushScore('prep_cloths', 'prep_towel'); pushScore('prep_resuscitation_area', 'prep_equip'); pushScore('prep_ambu_check', 'prep_ambu');
                pushScore('dry_start_5sec', 'care_dry'); pushScore('dry_skin_to_skin', 'care_skin'); pushScore('care_cover', 'care_cover'); 
                if (status === 'yes') { pushScore('normal_remove_outer_glove', 'cord_hygiene'); pushScore('normal_cord_pulse_check', 'cord_delay'); pushScore('normal_cord_clamping', 'cord_clamp'); pushScore('normal_breastfeeding_guidance', 'bf_advice'); }
                if (status === 'no') { pushScore('resus_position_head', 'resus_head'); pushScore('resus_mask_position', 'resus_mask'); pushScore('resus_check_chest_rise', 'resus_chest'); pushScore('resus_ventilation_rate', 'resus_rate'); }
            }
        });

        const avg = (arr) => calculateAverage(arr);
        return {
            totalVisits: uniqueVisits.size, totalCasesObserved: submissions.length, totalHealthWorkers: uniqueWorkers.size, skillStats,
            avgOverall: avg(scores.overall), avgPreparation: avg(scores.preparation), avgDrying: avg(scores.drying), avgNormalBreathing: avg(scores.normal_breathing), avgResuscitation: avg(scores.resuscitation),
            avgInfWash1: avg(scores.inf_wash1), avgInfWash2: avg(scores.inf_wash2), avgInfGloves: avg(scores.inf_gloves),
            avgPrepTowel: avg(scores.prep_towel), avgPrepEquip: avg(scores.prep_equip), avgPrepAmbu: avg(scores.prep_ambu),
            avgCareDry: avg(scores.care_dry), avgCareSkin: avg(scores.care_skin), avgCareCover: avg(scores.care_cover),
            avgCordHygiene: avg(scores.cord_hygiene), avgCordDelay: avg(scores.cord_delay), avgCordClamp: avg(scores.cord_clamp),
            avgBfAdvice: avg(scores.bf_advice), avgResusHead: avg(scores.resus_head), avgResusMask: avg(scores.resus_mask), avgResusChest: avg(scores.resus_chest), avgResusRate: avg(scores.resus_rate),
        };
    }, []);

    const eencMotherKpiHelper = useCallback((submissions) => {
        const motherSubmissions = submissions.filter(sub => sub.service === 'EENC_MOTHERS');
        const scores = { skin_imm: [], skin_90min: [], bf_1hr: [], bf_substitute: [], bf_bottle: [], vit_k: [], eye_oint: [], cord_subs: [], skin_oil: [], bath_6hr: [], polio: [], bcg: [], weight: [], temp: [], civ_reg: [], dis_card: [] };
        const skillStats = {};
        EENC_MOTHER_SURVEY_ITEMS_EN.forEach(g => g.items.forEach(i => skillStats[i.key] = { yes: 0, no: 0 }));

        motherSubmissions.forEach(sub => {
            const d = sub.eencMothersData || sub.fullData?.eencMothersData;
            if (d) {
                const push = (val, arr, key) => { const isYes = val === 'yes'; arr.push(isYes ? 1 : 0); if(skillStats[key]) { if(isYes) skillStats[key].yes++; else if(val === 'no') skillStats[key].no++; } };
                push(d.skin_to_skin_immediate, scores.skin_imm, 'skin_to_skin_immediate'); push(d.skin_to_skin_90min, scores.skin_90min, 'skin_to_skin_90min');
                push(d.breastfed_first_hour, scores.bf_1hr, 'breastfed_first_hour'); push(d.given_other_fluids, scores.bf_substitute, 'given_other_fluids'); push(d.given_other_fluids_bottle, scores.bf_bottle, 'given_other_fluids_bottle');
                push(d.given_vitamin_k, scores.vit_k, 'given_vitamin_k'); push(d.given_tetracycline, scores.eye_oint, 'given_tetracycline'); push(d.anything_on_cord, scores.cord_subs, 'anything_on_cord');
                push(d.rubbed_with_oil, scores.skin_oil, 'rubbed_with_oil'); push(d.baby_bathed, scores.bath_6hr, 'baby_bathed');
                push(d.polio_zero_dose, scores.polio, 'polio_zero_dose'); push(d.bcg_dose, scores.bcg, 'bcg_dose');
                push(d.baby_weighed, scores.weight, 'baby_weighed'); push(d.baby_temp_measured, scores.temp, 'baby_temp_measured');
                push(d.baby_registered, scores.civ_reg, 'civ_reg'); push(d.given_discharge_card, scores.dis_card, 'given_discharge_card');
            }
        });

        const avg = (arr) => calculateAverage(arr);
        return {
            totalMothers: motherSubmissions.length, skillStats, avgOverall: calculateAverage(Object.values(scores).flat()),
            avgSkinImm: avg(scores.skin_imm), avgSkin90min: avg(scores.skin_90min), avgBf1hr: avg(scores.bf_1hr), avgBfSub: avg(scores.bf_substitute), avgBfBottle: avg(scores.bf_bottle),
            avgVitK: avg(scores.vit_k), avgEyeOint: avg(scores.eye_oint), avgCordSubs: avg(scores.cord_subs), avgSkinOil: avg(scores.skin_oil), avgBath6hr: avg(scores.bath_6hr),
            avgPolio: avg(scores.polio), avgBcg: avg(scores.bcg), avgWeight: avg(scores.weight), avgTemp: avg(scores.temp), avgCivReg: avg(scores.civ_reg), avgDisCard: avg(scores.dis_card),
        };
    }, []);

    const imnciMotherKpiHelper = useCallback((submissions) => {
        const motherSubmissions = submissions.filter(sub => sub.service === 'IMNCI_MOTHERS');
        const scores = {
            know_med: [], know_ors_prep: [], know_tx: [], know_4rules: [], know_return: [], know_fluids: [], know_ors_qty: [], know_ors_stool: [],
            sat_time: [], sat_assess: [], sat_tx: [], sat_comm: [], sat_learn: [], sat_avail: []
        };
        const skillStats = {};
        IMNCI_MOTHER_SURVEY_ITEMS_EN.forEach(g => g.items.forEach(i => skillStats[i.key] = { yes: 0, no: 0 }));

        motherSubmissions.forEach(sub => {
            const k = sub.mothersKnowledge || sub.fullData?.mothersKnowledge || {};
            const s = sub.mothersSatisfaction || sub.fullData?.mothersSatisfaction || {};
            const push = (val, arr, key) => { const isYes = val === 'نعم'; arr.push(isYes ? 1 : 0); if(skillStats[key]) { if(isYes) skillStats[key].yes++; else if(val === 'لا') skillStats[key].no++; } };

            push(k.knows_med_details, scores.know_med, 'knows_med_details'); push(k.knows_ors_prep, scores.know_ors_prep, 'knows_tx', 'knows_treatment_details'); push(k.knows_diarrhea_4rules, scores.know_4rules, 'knows_diarrhea_4rules');
            push(k.knows_return_date, scores.know_return, 'knows_return_date'); push(k.knows_home_fluids, scores.know_fluids, 'knows_home_fluids'); push(k.knows_ors_water_qty, scores.know_ors_qty, 'knows_ors_water_qty'); push(k.knows_ors_after_stool, scores.know_ors_stool, 'knows_ors_after_stool');
            push(s.time_spent, scores.sat_time, 'time_spent'); push(s.assessment_method, scores.sat_assess, 'assessment_method'); push(s.treatment_given, scores.sat_tx, 'treatment_given'); push(s.communication_style, scores.sat_comm, 'communication_style'); push(s.what_learned, scores.sat_learn, 'what_learned'); push(s.drug_availability, scores.sat_avail, 'drug_availability');
        });

        const avg = (arr) => calculateAverage(arr);
        return {
            totalMothers: motherSubmissions.length, skillStats, avgOverall: calculateAverage(Object.values(scores).flat()),
            avgKnowMed: avg(scores.know_med), avgKnowOrsPrep: avg(scores.know_ors_prep), avgKnowTx: avg(scores.know_tx), avgKnow4Rules: avg(scores.know_4rules),
            avgKnowReturn: avg(scores.know_return), avgKnowFluids: avg(scores.know_fluids), avgKnowOrsQty: avg(scores.know_ors_qty), avgKnowOrsStool: avg(scores.know_ors_stool),
            avgSatTime: avg(scores.sat_time), avgSatAssess: avg(scores.sat_assess), avgSatTx: avg(scores.sat_tx), avgSatComm: avg(scores.sat_comm), avgSatLearn: avg(scores.sat_learn), avgSatAvail: avg(scores.sat_avail)
        };
    }, []);

    // Filtered lists
    const serviceCompletedSubmissions = useMemo(() => (reCalculatedSubmissions || []).filter(sub => 
        (activeService === 'EENC' ? (sub.service === 'EENC' || sub.service === 'EENC_MOTHERS') : 
         activeService === 'IMNCI' ? (sub.service === 'IMNCI' || sub.service === 'IMNCI_MOTHERS') : 
         sub.service === activeService) 
        && sub.status === 'complete'
    ), [reCalculatedSubmissions, activeService]);

    // Select Dropdown Options
    const stateOptions = useMemo(() => !STATE_LOCALITIES ? [] : Object.keys(STATE_LOCALITIES).map(k => ({ key: k, name: STATE_LOCALITIES[k]?.en || k })).sort((a, b) => a.name.localeCompare(b.name, 'en')), [STATE_LOCALITIES]);
    const localityOptions = useMemo(() => (!activeState || !STATE_LOCALITIES[activeState]?.localities) ? [] : STATE_LOCALITIES[activeState].localities.map(l => ({ key: l.en, name: l.en })).sort((a, b) => a.name.localeCompare(b.name, 'en')), [activeState, STATE_LOCALITIES]);
    const facilityOptions = useMemo(() => {
        const map = new Map(); serviceCompletedSubmissions.filter(s => (!activeState || s.state === activeState) && (!activeLocality || s.locality === activeLocality)).forEach(s => { if (s.facilityId && !map.has(s.facilityId)) map.set(s.facilityId, { key: s.facilityId, name: s.facility || 'Unknown' }); });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality]);
    const projectOptions = useMemo(() => {
        const map = new Map(); 
        serviceCompletedSubmissions.filter(s => (!activeState || s.state === activeState) && (!activeLocality || s.locality === activeLocality) && (!activeFacilityId || s.facilityId === activeFacilityId)).forEach(s => { 
            if (s.project && s.project !== 'N/A' && !map.has(s.project)) map.set(s.project, { key: s.project, name: s.project }); 
        });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId]);
    const workerOptions = useMemo(() => {
        const map = new Map(); serviceCompletedSubmissions.filter(s => (!activeState || s.state === activeState) && (!activeLocality || s.locality === activeLocality) && (!activeFacilityId || s.facilityId === activeFacilityId) && (!activeProject || s.project === activeProject)).forEach(s => { if (s.staff && !map.has(s.staff)) map.set(s.staff, { key: s.staff, name: s.staff }); });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId, activeProject]);
    const workerTypeOptions = useMemo(() => {
        const types = new Set();
        serviceCompletedSubmissions.forEach(s => {
            if ((!activeState || s.state === activeState) && (!activeLocality || s.locality === activeLocality) && (!activeFacilityId || s.facilityId === activeFacilityId) && (!activeProject || s.project === activeProject)) {
                if (s.workerType && s.workerType !== 'N/A') types.add(s.workerType);
            }
        });
        return Array.from(types).map(t => ({ key: t, name: t })).sort((a, b) => a.name.localeCompare(b.name));
    }, [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId, activeProject]);

    // Active Data
    const filteredSubmissions = useMemo(() => serviceCompletedSubmissions.filter(sub => 
        (!activeState || sub.state === activeState) && 
        (!activeLocality || sub.locality === activeLocality) && 
        (!activeFacilityId || sub.facilityId === activeFacilityId) && 
        (!activeWorkerName || sub.staff === activeWorkerName) &&
        (!activeProject || sub.project === activeProject) &&
        (!activeWorkerType || sub.workerType === activeWorkerType) &&
        checkDateFilter(sub.date || sub.sessionDate || sub.visitDate, dateFilter)
    ), [serviceCompletedSubmissions, activeState, activeLocality, activeFacilityId, activeWorkerName, activeProject, activeWorkerType, dateFilter, checkDateFilter]);

    // ** KPI's must be evaluated BEFORE they are passed down **
    const overallKpis = useMemo(() => {
        if (activeService === 'IMNCI') return imnciKpiHelper(filteredSubmissions.filter(s => s.service === 'IMNCI'));
        if (activeService === 'EENC') return eencKpiHelper(filteredSubmissions.filter(s => s.service === 'EENC'));
        return { totalVisits: filteredSubmissions.length, totalCasesObserved: filteredSubmissions.length, totalHealthWorkers: 0, skillStats: {} };
    }, [filteredSubmissions, imnciKpiHelper, eencKpiHelper, activeService]);

    const motherKpis = useMemo(() => {
        if (activeService === 'EENC') return eencMotherKpiHelper(filteredSubmissions);
        if (activeService === 'IMNCI') return imnciMotherKpiHelper(filteredSubmissions);
        return null;
    }, [filteredSubmissions, eencMotherKpiHelper, imnciMotherKpiHelper, activeService]);

    // Chart Data calculations
    const volumeChartData = useMemo(() => {
        const targetMotherService = activeService === 'IMNCI' ? 'IMNCI_MOTHERS' : 'EENC_MOTHERS';
        const visitGroups = filteredSubmissions.reduce((acc, sub) => {
            if (sub.service === targetMotherService) return acc;
            const visitNum = sub.visitNumber || 'N/A';
            if (visitNum === 'N/A') return acc;
            if (!acc[visitNum]) acc[visitNum] = { cases: 0, visits: new Set() };
            acc[visitNum].cases += 1;
            acc[visitNum].visits.add(`${sub.facilityId || 'unk'}_${sub.staff || 'unk'}_${sub.date || 'unk'}`);
            return acc;
        }, {});
        return Object.keys(visitGroups).map(v => ({ visitNumber: parseInt(v), name: `Visit ${v}`, 'Cases Observed': visitGroups[v].cases, 'Completed Visits': visitGroups[v].visits.size })).sort((a,b) => a.visitNumber - b.visitNumber).slice(0, 4);
    }, [filteredSubmissions, activeService]);

    const imnciChartData = useMemo(() => {
        if (activeService !== 'IMNCI') return [];
        const calcPercent = (score, max) => (max > 0) ? (score / max) * 100 : null;
        const visitGroups = filteredSubmissions.reduce((acc, sub) => {
            if (sub.service === 'IMNCI_MOTHERS') return acc; 
            const s = sub.scores; const visitNum = sub.visitNumber || 'N/A'; if (!s || visitNum === 'N/A') return acc;
            if (!acc[visitNum]) acc[visitNum] = { 'Overall': [], 'Assessment': [], 'Decision': [], 'Treatment': [], 'Resp. Rate': [], 'Dehydration': [], 'Pneumonia Amox': [], 'Diarrhea ORS': [], 'Diarrhea Zinc': [], 'Anemia Iron': [], 'Weight': [], 'Temp': [], 'Height': [], 'MUAC': [], 'WFH': [], 'Pallor': [], 'DangerSigns': [], 'Malnutrition Assessment': [], 'Measurement Skills': [], 'Immunization': [], 'Vitamin Assessment': [], 'Malaria Coartem': [], 'Return Immediately': [], 'Return Followup': [], 'Record Signs': [], 'Record Classifications': [], 'Record Treatments': [] };
            const g = acc[visitNum];
            g['Overall'].push(calcPercent(s.overallScore_score, s.overallScore_maxScore)); g['Assessment'].push(calcPercent(s.assessment_total_score_score, s.assessment_total_score_maxScore)); g['Decision'].push(calcPercent(s.finalDecision_score, s.finalDecision_maxScore)); g['Treatment'].push(calcPercent(s.treatment_total_score_score, s.treatment_total_score_maxScore)); g['Immunization'].push(calcPercent(s.immunization_score, s.immunization_maxScore));
            
            const w = calcPercent(s.handsOnWeight_score, s.handsOnWeight_maxScore); const t = calcPercent(s.handsOnTemp_score, s.handsOnTemp_maxScore); const h = calcPercent(s.handsOnHeight_score, s.handsOnHeight_maxScore);
            g['Weight'].push(w); g['Temp'].push(t); g['Height'].push(h); g['Measurement Skills'].push(w, t, h);
            
            const m = calcPercent(s.handsOnMUAC_score, s.handsOnMUAC_maxScore); const wfh = calcPercent(s.handsOnWFH_score, s.handsOnWFH_maxScore);
            g['MUAC'].push(m); g['WFH'].push(wfh); g['Malnutrition Assessment'].push(m, wfh); g['DangerSigns'].push(calcPercent(s.dangerSigns_score, s.dangerSigns_maxScore));
            
            const as = sub.fullData?.assessmentSkills || {}; const ts = sub.fullData?.treatmentSkills || {};
            if (as['skill_anemia_pallor'] === 'yes') g['Pallor'].push(100); else if (as['skill_anemia_pallor'] === 'no') g['Pallor'].push(0); 
            if (as['supervisor_confirms_cough'] === 'yes') g['Resp. Rate'].push(as['skill_check_rr'] === 'yes' ? 100 : 0);
            if (as['supervisor_confirms_diarrhea'] === 'yes') g['Dehydration'].push(as['skill_check_dehydration'] === 'yes' ? 100 : 0);

            const pushTreatment = (key, label) => { if (ts[key] === 'yes') g[label].push(100); else if (ts[key] === 'no') g[label].push(0); };
            pushTreatment('skill_pneu_abx', 'Pneumonia Amox'); pushTreatment('skill_diar_ors', 'Diarrhea ORS'); pushTreatment('skill_diar_zinc', 'Diarrhea Zinc'); pushTreatment('skill_anemia_iron', 'Anemia Iron');

            if (as['skill_imm_vita'] === 'yes') g['Vitamin Assessment'].push(100); else if (as['skill_imm_vita'] === 'no' || as['skill_imm_vita'] === 'na') g['Vitamin Assessment'].push(0);
            if (ts['skill_mal_meds'] === 'yes') g['Malaria Coartem'].push(100); else if (ts['skill_mal_meds'] === 'no') g['Malaria Coartem'].push(0);
            if (ts['skill_fu_when'] === 'yes') g['Return Immediately'].push(100); else if (ts['skill_fu_when'] === 'no') g['Return Immediately'].push(0);
            if (ts['skill_fu_return'] === 'yes') g['Return Followup'].push(100); else if (ts['skill_fu_return'] === 'no') g['Return Followup'].push(0);
            
            const rs = sub.fullData?.recording_skills || sub.fullData?.recordingSkills || {};
            if (rs['skill_record_signs'] === 'yes') g['Record Signs'].push(100); else if (rs['skill_record_signs'] === 'no') g['Record Signs'].push(0);
            if (rs['skill_record_classifications'] === 'yes') g['Record Classifications'].push(100); else if (rs['skill_record_classifications'] === 'no') g['Record Classifications'].push(0);
            if (rs['skill_record_treatments'] === 'yes') g['Record Treatments'].push(100); else if (rs['skill_record_treatments'] === 'no') g['Record Treatments'].push(0);

            return acc;
        }, {});
        return Object.keys(visitGroups).map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] })).sort((a,b)=>a.visitNumber-b.visitNumber).map(({visitNumber, data}) => {
            const avg = (scoreArray) => { const v = scoreArray.filter(s => s !== null && !isNaN(s)); return v.length===0 ? null : Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
            const res = { name: `Visit ${visitNumber}` }; Object.keys(data).forEach(k => res[k] = avg(data[k])); return res;
        }).slice(0, 4);
    }, [filteredSubmissions, activeService]);

    const eencChartData = useMemo(() => {
        if (activeService !== 'EENC') return [];
        const calcPercent = (score, max) => (max > 0) ? (score / max) * 100 : null;
        const visitGroups = filteredSubmissions.reduce((acc, sub) => {
            if (sub.service === 'EENC_MOTHERS') return acc;
            const s = sub.scores; const visitNum = sub.visitNumber || 'N/A'; if (!s || visitNum === 'N/A') return acc;
            if (!acc[visitNum]) acc[visitNum] = { 'Overall': [], 'Preparation': [], 'Drying': [], 'Breathing Mgmt': [], 'Resuscitation': [], 'Hand Washing (1st)': [], 'Hand Washing (2nd)': [], 'Sterile Gloves': [], 'Towels Ready': [], 'Resus Equip Ready': [], 'Ambu Check': [], 'Drying < 5s': [], 'Skin-to-Skin': [], 'Dry Towel/Hat': [], 'Hygienic Check': [], 'Delayed Clamp': [], 'Correct Clamp': [], 'Early BF Advice': [], 'Head Pos': [], 'Mask Seal': [], 'Chest Rise': [], 'Rate 30-50': [] };
            const g = acc[visitNum];
            g['Overall'].push(calcPercent(s.overallScore_score, s.overallScore_maxScore)); g['Preparation'].push(calcPercent(s.preparation_score, s.preparation_maxScore)); g['Drying'].push(calcPercent(s.drying_score, s.drying_maxScore));
            if (s.normal_breathing_maxScore > 0) g['Breathing Mgmt'].push(calcPercent(s.normal_breathing_score, s.normal_breathing_maxScore)); else if (s.resuscitation_maxScore > 0) g['Breathing Mgmt'].push(calcPercent(s.resuscitation_score, s.resuscitation_maxScore));
            g['Resuscitation'].push(calcPercent(s.resuscitation_score, s.resuscitation_maxScore));
            
            const skills = sub.fullData?.skills || {};
            const pushSkill = (key, label) => { if (skills[key] === 'yes') g[label].push(100); else if (skills[key] === 'no') g[label].push(0); };
            pushSkill('prep_wash_1', 'Hand Washing (1st)'); pushSkill('prep_wash_2', 'Hand Washing (2nd)'); pushSkill('prep_gloves', 'Sterile Gloves'); pushSkill('prep_cloths', 'Towels Ready'); pushSkill('prep_resuscitation_area', 'Resus Equip Ready'); pushSkill('prep_ambu_check', 'Ambu Check');
            pushSkill('dry_start_5sec', 'Drying < 5s'); pushSkill('dry_skin_to_skin', 'Skin-to-Skin'); pushSkill('dry_cover_baby', 'Dry Towel/Hat'); pushSkill('normal_remove_outer_glove', 'Hygienic Check'); pushSkill('normal_cord_pulse_check', 'Delayed Clamp'); pushSkill('normal_cord_clamping', 'Correct Clamp'); pushSkill('normal_breastfeeding_guidance', 'Early BF Advice');
            pushSkill('resus_position_head', 'Head Pos'); pushSkill('resus_mask_position', 'Mask Seal'); pushSkill('resus_check_chest_rise', 'Chest Rise'); pushSkill('resus_ventilation_rate', 'Rate 30-50');
            return acc;
        }, {});
        return Object.keys(visitGroups).map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] })).sort((a,b)=>a.visitNumber-b.visitNumber).map(({visitNumber, data}) => {
            const avg = (scoreArray) => { const v = scoreArray.filter(s => s !== null && !isNaN(s)); return v.length===0 ? null : Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
            const res = { name: `Visit ${visitNumber}` }; Object.keys(data).forEach(k => res[k] = avg(data[k])); return res;
        }).slice(0, 4);
    }, [filteredSubmissions, activeService]);

    const imnciMotherChartData = useMemo(() => {
        if (activeService !== 'IMNCI') return [];
        const visitGroups = [...filteredSubmissions].sort((a, b) => (a.visitNumber || 1) - (b.visitNumber || 1)).reduce((acc, sub) => {
            if (sub.service !== 'IMNCI_MOTHERS') return acc;
            const visitNum = sub.visitNumber || 1; 
            if (!acc[visitNum]) acc[visitNum] = { 'M: Knows Meds': [], 'M: Knows ORS': [], 'M: Knows Tx': [], 'M: Knows 4 Rules': [], 'M: Knows Return': [], 'M: Knows Fluids': [], 'M: Time Spent': [], 'M: Assess Method': [], 'M: Tx Given': [], 'M: Comm Style': [], 'M: What Learned': [], 'M: Drug Avail': [] };
            const g = acc[visitNum]; const k = sub.mothersKnowledge || sub.fullData?.mothersKnowledge || {}; const s = sub.mothersSatisfaction || sub.fullData?.mothersSatisfaction || {};
            const push = (val, label) => g[label].push(val === 'نعم' ? 100 : 0);
            push(k.knows_med_details, 'M: Knows Meds'); push(k.knows_ors_prep, 'M: Knows ORS'); push(k.knows_treatment_details, 'M: Knows Tx'); push(k.knows_diarrhea_4rules, 'M: Knows 4 Rules'); push(k.knows_return_date, 'M: Knows Return'); push(k.knows_home_fluids, 'M: Knows Fluids');
            push(s.time_spent, 'M: Time Spent'); push(s.assessment_method, 'M: Assess Method'); push(s.treatment_given, 'M: Tx Given'); push(s.communication_style, 'M: Comm Style'); push(s.what_learned, 'M: What Learned'); push(s.drug_availability, 'M: Drug Avail');
            return acc;
        }, {});
        return Object.keys(visitGroups).map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] })).sort((a,b) => a.visitNumber - b.visitNumber).map(({visitNumber, data}) => {
            const avg = (scoreArray) => { const v = scoreArray.filter(s => s !== null && !isNaN(s)); return v.length===0 ? null : Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
            const res = { name: `Visit ${visitNumber}` }; Object.keys(data).forEach(k => res[k] = avg(data[k])); return res;
        }).slice(0, 4);
    }, [filteredSubmissions, activeService]);

    const eencMotherChartData = useMemo(() => {
        if (activeService !== 'EENC') return [];
        const visitGroups = [...filteredSubmissions].sort((a, b) => (a.visitNumber || 1) - (b.visitNumber || 1)).reduce((acc, sub) => {
            if (sub.service !== 'EENC_MOTHERS') return acc;
            const visitNum = sub.visitNumber || 1; 
            if (!acc[visitNum]) acc[visitNum] = { 'Imm. Skin-to-Skin': [], '90min Skin-to-Skin': [], 'BF 1st Hour': [], 'Other Fluids': [], 'Bottle Feeding': [], 'Vitamin K': [], 'Eye Ointment': [], 'Cord Substance': [], 'Skin Oiling': [], 'Bathing < 6hrs': [], 'Polio Vaccine': [], 'BCG Vaccine': [], 'Weight Measured': [], 'Temp Measured': [], 'Civil Reg': [], 'Discharge Card': [] };
            const g = acc[visitNum]; const d = sub.eencMothersData || sub.fullData?.eencMothersData || {};
            if(d) {
                const push = (val, label) => g[label].push(val === 'yes' ? 100 : 0);
                push(d.skin_to_skin_immediate, 'Imm. Skin-to-Skin'); push(d.skin_to_skin_90min, '90min Skin-to-Skin'); push(d.breastfed_first_hour, 'BF 1st Hour'); push(d.given_other_fluids, 'Other Fluids'); push(d.given_other_fluids_bottle, 'Bottle Feeding');
                push(d.given_vitamin_k, 'Vitamin K'); push(d.given_tetracycline, 'Eye Ointment'); push(d.anything_on_cord, 'Cord Substance'); push(d.rubbed_with_oil, 'Skin Oiling'); push(d.baby_bathed, 'Bathing < 6hrs');
                push(d.polio_zero_dose, 'Polio Vaccine'); push(d.bcg_dose, 'BCG Vaccine'); push(d.baby_weighed, 'Weight Measured'); push(d.baby_temp_measured, 'Temp Measured'); push(d.baby_registered, 'Civil Reg'); push(d.given_discharge_card, 'Discharge Card');
            }
            return acc;
        }, {});
        return Object.keys(visitGroups).map(v => ({ visitNumber: parseInt(v), data: visitGroups[v] })).sort((a,b) => a.visitNumber - b.visitNumber).map(({visitNumber, data}) => {
            const avg = (scoreArray) => { const v = scoreArray.filter(s => s !== null && !isNaN(s)); return v.length===0 ? null : Math.round(v.reduce((a,b)=>a+b,0)/v.length); };
            const res = { name: `Visit ${visitNumber}` }; Object.keys(data).forEach(k => res[k] = avg(data[k])); return res;
        }).slice(0, 4);
    }, [filteredSubmissions, activeService]);

    const geographicKpis = useMemo(() => {
        const kpisHelper = activeService === 'IMNCI' ? imnciKpiHelper : (activeService === 'EENC' ? eencKpiHelper : null);
        if (!kpisHelper) return [];
        const isStateLevel = !activeState;
        const submissionsByLocation = filteredSubmissions.reduce((acc, sub) => {
            if (sub.service === 'EENC_MOTHERS' || sub.service === 'IMNCI_MOTHERS') return acc;
            const locKey = isStateLevel ? (sub.state || 'UNKNOWN') : (sub.locality || 'UNKNOWN');
            if (!acc[locKey]) acc[locKey] = [];
            acc[locKey].push(sub); return acc;
        }, {});
        return Object.keys(submissionsByLocation).map(locKey => {
            let locName = locKey;
            if (isStateLevel) locName = STATE_LOCALITIES[locKey]?.en || locKey;
            else {
                const stateObj = STATE_LOCALITIES[activeState];
                if (stateObj && stateObj.localities) {
                    const locObj = stateObj.localities.find(l => l.en === locKey);
                    if (locObj) locName = locObj.en;
                }
            }
            return { stateKey: locKey, stateName: locName, ...kpisHelper(submissionsByLocation[locKey]) };
        }).sort((a, b) => a.stateName.localeCompare(b.stateName, 'en'));
    }, [filteredSubmissions, imnciKpiHelper, eencKpiHelper, activeService, STATE_LOCALITIES, activeState]);

    const motherGeographicKpis = useMemo(() => {
        if (activeService !== 'EENC' && activeService !== 'IMNCI') return [];
        const isEenc = activeService === 'EENC'; const isStateLevel = !activeState;
        const submissionsByLocation = filteredSubmissions.reduce((acc, sub) => {
            if (isEenc && sub.service !== 'EENC_MOTHERS') return acc;
            if (!isEenc && sub.service !== 'IMNCI_MOTHERS') return acc;
            const locKey = isStateLevel ? (sub.state || 'UNKNOWN') : (sub.locality || 'UNKNOWN');
            if (!acc[locKey]) acc[locKey] = [];
            acc[locKey].push(sub); return acc;
        }, {});
        const helper = isEenc ? eencMotherKpiHelper : imnciMotherKpiHelper;
        return Object.keys(submissionsByLocation).map(locKey => {
            let locName = locKey;
            if (isStateLevel) locName = STATE_LOCALITIES[locKey]?.en || locKey;
            else {
                const stateObj = STATE_LOCALITIES[activeState];
                if (stateObj && stateObj.localities) {
                    const locObj = stateObj.localities.find(l => l.en === locKey);
                    if (locObj) locName = locObj.en;
                }
            }
            return { stateKey: locKey, stateName: locName, ...helper(submissionsByLocation[locKey]) };
        }).sort((a, b) => a.stateName.localeCompare(b.stateName, 'en'));
    }, [filteredSubmissions, eencMotherKpiHelper, imnciMotherKpiHelper, activeService, STATE_LOCALITIES, activeState]);

    const kpisByWorkerType = useMemo(() => {
        const kpisHelper = activeService === 'IMNCI' ? imnciKpiHelper : (activeService === 'EENC' ? eencKpiHelper : null);
        if (!kpisHelper) return [];
        const submissionsByWt = filteredSubmissions.reduce((acc, sub) => {
            if (sub.service === 'EENC_MOTHERS' || sub.service === 'IMNCI_MOTHERS') return acc;
            const wt = sub.workerType && sub.workerType !== 'N/A' ? sub.workerType : 'Unknown Title';
            if (!acc[wt]) acc[wt] = [];
            acc[wt].push(sub); return acc;
        }, {});
        return Object.keys(submissionsByWt).map(wt => ({ workerType: wt, kpis: kpisHelper(submissionsByWt[wt]) })).sort((a, b) => a.workerType.localeCompare(b.workerType));
    }, [filteredSubmissions, imnciKpiHelper, eencKpiHelper, activeService]);

    const imnciSummaryDefs = [
        { label: 'Overall IMNCI Adherence', getValue: (k) => k.avgOverall }, { label: 'Assess & Classify', getValue: (k) => k.avgAssessment }, { label: 'Final Decision', getValue: (k) => k.avgDecision }, { label: 'Treatment & Counsel', getValue: (k) => k.avgTreatment }, { label: 'Danger Signs Assessment', getValue: (k) => k.avgDangerSigns },
        { label: 'Measurement Skills', getValue: (k) => calculateAverage([k.avgHandsOnWeight, k.avgHandsOnTemp, k.avgHandsOnHeight]) }, { label: 'Correct Respiratory Rate', getValue: (k) => k.avgRespiratoryRateCalculation }, { label: 'Correct Dehydration Assessment', getValue: (k) => k.avgDehydrationAssessment }, { label: 'Correct Malnutrition Assessment', getValue: (k) => calculateAverage([k.avgHandsOnMUAC, k.avgHandsOnWFH]) },
        { label: 'Immunization Assessed Correctly', getValue: (k) => k.avgImmunization }, { label: 'Vitamin Supplementation Correctly', getValue: (k) => k.avgVitaminAssessment }, { label: 'Pneumonia Treated with Amoxicillin', getValue: (k) => k.avgPneuAmox }, { label: 'Diarrhea Treated with ORS', getValue: (k) => k.avgDiarOrs }, { label: 'Diarrhea Treated with Zinc', getValue: (k) => k.avgDiarZinc }, { label: 'Malaria Treated with Coartem', getValue: (k) => k.avgMalariaCoartem },
        { label: 'Advised Return Immediately', getValue: (k) => k.avgReturnImm }, { label: 'Advised Return for Follow Up', getValue: (k) => k.avgReturnFu }, { label: 'Recording Form Use', getValue: (k) => calculateAverage([k.avgRecordSigns, k.avgRecordClass, k.avgRecordTreat]) },
    ];

    const eencSummaryDefs = [
        { label: 'Overall EENC Adherence', getValue: (k) => k.avgOverall }, { label: 'Preparation Score', getValue: (k) => k.avgPreparation }, { label: 'Drying & Stimulation Score', getValue: (k) => k.avgDrying }, { label: 'Breathing Baby Mgmt Score', getValue: (k) => k.avgNormalBreathing }, { label: 'Resuscitation Score', getValue: (k) => k.avgResuscitation },
        { label: 'Infection Control', getValue: (k) => calculateAverage([k.avgInfWash1, k.avgInfWash2, k.avgInfGloves]) }, { label: 'Cord Management (Breathing Babies)', getValue: (k) => calculateAverage([k.avgCordHygiene, k.avgCordDelay, k.avgCordClamp]) }, { label: 'Early Breastfeeding Advice', getValue: (k) => k.avgBfAdvice }
    ];

    // --- Loading State Check ---
    if (isLoading || !allSubmissions || !visitReports || !STATE_LOCALITIES) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50/50 p-6">
                <Spinner size="lg" />
                <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight animate-pulse mb-2 mt-4">Loading Dashboard Data...</h3>
                <p className="text-sm font-semibold text-slate-500">Please wait while we fetch the latest records.</p>
            </div>
        );
    }

    // --- Dynamic Scope Title Generator for Detailed Filter Logging ---
    const activeFiltersList = [];
    if (activeState) activeFiltersList.push(`State: ${STATE_LOCALITIES[activeState]?.en || activeState}`);
    if (activeLocality) {
        const locName = STATE_LOCALITIES[activeState]?.localities?.find(l => l.en === activeLocality)?.en || activeLocality;
        activeFiltersList.push(`Locality: ${locName}`);
    }
    if (activeFacilityId) {
        const facName = facilityOptions.find(f => f.key === activeFacilityId)?.name || activeFacilityId;
        activeFiltersList.push(`Facility: ${facName}`);
    }
    if (activeProject) activeFiltersList.push(`Project: ${activeProject}`);
    if (activeWorkerType) activeFiltersList.push(`Job: ${activeWorkerType}`);
    if (activeWorkerName) activeFiltersList.push(`Worker: ${activeWorkerName}`);
    if (dateFilter) {
        const dateNames = {
            today: 'Today', yesterday: 'Yesterday', this_week: 'This Week', last_week: 'Last Week',
            this_month: 'This Month', last_month: 'Last Month', this_year: 'This Year', last_year: 'Last Year'
        };
        activeFiltersList.push(`Date: ${dateNames[dateFilter] || dateFilter}`);
    }

    const scopeTitle = activeFiltersList.length > 0 
        ? `(Filtered by: ${activeFiltersList.join(' | ')})` 
        : "(All Sudan Data)";

    const isFiltered = activeFiltersList.length > 0;
    const serviceTitle = SERVICE_TITLES[activeService] || activeService;
    const activeTab = activeService === 'IMNCI' ? activeImnciTab : activeEencTab;
    const setActiveTabFunc = activeService === 'IMNCI' ? setActiveImnciTab : setActiveEencTab;

    return (
        <div className="p-4 sm:p-6 bg-slate-50/50 min-h-screen" dir="ltr">             
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h3 className="text-2xl font-extrabold text-slate-800 text-left tracking-tight">
                    Mentorship Dashboard: {serviceTitle} <br/>
                    <span className="text-sky-600 text-lg font-semibold block mt-1 break-words leading-snug">{scopeTitle}</span>
                </h3>
            </div>
            
            <div className="flex flex-row flex-nowrap overflow-x-auto gap-3 mb-8 p-4 bg-white rounded-2xl shadow-md border border-black scrollbar-thin scrollbar-thumb-sky-200 scrollbar-track-transparent">
                {/* Unified Date Filter Option Moved to Beginning */}
                <div className="min-w-[140px] flex-1 flex-shrink-0">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Date Filter</label>
                    <select value={dateFilter} onChange={(e) => onDateFilterChange(e.target.value)} className={`block w-full pl-3 pr-8 py-2 text-xs font-bold border focus:outline-none focus:ring-sky-500 focus:border-sky-500 rounded-lg shadow-sm transition-colors cursor-pointer ${dateFilter ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-200' : 'border-black bg-white hover:bg-slate-50 text-slate-800'}`}>
                        <option value="">All Time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="this_week">This Week</option>
                        <option value="last_week">Last Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                        <option value="last_year">Last Year</option>
                    </select>
                </div>
                
                <FilterSelect label="State" value={activeState} onChange={(v) => { onStateChange(v); onLocalityChange(""); onFacilityIdChange(""); onProjectChange(""); onWorkerNameChange(""); onWorkerTypeChange?.(""); }} options={stateOptions} defaultOption="All States" />
                <FilterSelect label="Locality" value={activeLocality} onChange={(v) => { onLocalityChange(v); onFacilityIdChange(""); onProjectChange(""); onWorkerNameChange(""); onWorkerTypeChange?.(""); }} options={localityOptions} disabled={!activeState} defaultOption="All Localities" />
                <FilterSelect label="Health Facility" value={activeFacilityId} onChange={(v) => { onFacilityIdChange(v); onProjectChange(""); onWorkerNameChange(""); onWorkerTypeChange?.(""); }} options={facilityOptions} disabled={!activeLocality} defaultOption="All Facilities" />
                <FilterSelect label="Project / Partner" value={activeProject} onChange={(v) => { onProjectChange(v); onWorkerNameChange(""); onWorkerTypeChange?.(""); }} options={projectOptions} defaultOption="All Projects" />
                <FilterSelect label="Job Title" value={activeWorkerType || ""} onChange={(v) => { if(onWorkerTypeChange) onWorkerTypeChange(v); onWorkerNameChange(""); }} options={workerTypeOptions || []} defaultOption="All Titles" />
                <FilterSelect label="Health Worker Name" value={activeWorkerName} onChange={onWorkerNameChange} options={workerOptions} disabled={!activeFacilityId} defaultOption="All Workers" />
            </div>
            
            <div className="flex flex-wrap gap-2 mb-8 bg-slate-200 p-1.5 rounded-xl border border-black w-fit">
                <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeTab === 'skills' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveTabFunc('skills')}>Skills Observation (Provider)</button>
                <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeTab === 'mothers' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveTabFunc('mothers')}>Mother Interviews</button>
                <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeTab === 'visit_reports' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveTabFunc('visit_reports')}>Visit Reports (Facility)</button>
                {canEditStatus && (
                    <button className={`py-2 px-5 font-semibold text-sm rounded-lg transition-all ${activeTab === 'admin' ? 'bg-white shadow-sm text-sky-700 border border-black' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300/50 border border-transparent'}`} onClick={() => setActiveTabFunc('admin')}>Admin Dashboard</button>
                )}
            </div>

            {activeTab === 'admin' && canEditStatus && (
                <AdminDashboardTab
                    activeService={activeService} overallKpis={overallKpis} visitReportStats={visitReportStats} motherKpis={motherKpis} volumeChartData={volumeChartData}
                    geographicKpis={geographicKpis} filteredSubmissions={filteredSubmissions} geographicLevelName={geographicLevelName} scopeTitle={scopeTitle} dateFilter={dateFilter} onDateFilterChange={onDateFilterChange}
                />
            )}

            {activeTab === 'skills' && (
                <ProviderSkillsTab 
                    activeService={activeService} overallKpis={overallKpis} chartData={activeService === 'IMNCI' ? imnciChartData : eencChartData}
                    geographicKpis={geographicKpis} kpisByWorkerType={kpisByWorkerType} imnciSummaryDefs={imnciSummaryDefs} eencSummaryDefs={eencSummaryDefs} scopeTitle={scopeTitle} geographicLevelName={geographicLevelName}
                />
            )}

            {activeTab === 'mothers' && (
                <MotherInterviewsTab 
                    activeService={activeService} motherKpis={motherKpis} chartData={activeService === 'IMNCI' ? imnciMotherChartData : eencMotherChartData}
                    motherGeographicKpis={motherGeographicKpis} scopeTitle={scopeTitle} geographicLevelName={geographicLevelName}
                />
            )}

            {activeTab === 'visit_reports' && (
                <VisitReportDashboardTab 
                    activeService={activeService} visitReportStats={visitReportStats} geographicLevelName={geographicLevelName} dynamicLocationLabel={dynamicLocationLabel} dynamicLocationLevel={dynamicLocationLevel} renderStatusCell={renderStatusCell} IMNCI_SKILL_GROUPS={IMNCI_SKILL_GROUPS} EENC_SKILLS_LABELS={EENC_SKILLS_LABELS} KpiCard={KpiCard} KpiBarChart={KpiBarChart} ScoreText={ScoreText} CopyImageButton={CopyImageButton} scopeTitle={scopeTitle}
                />
            )}
        </div>
    );
};

export default MentorshipDashboard;