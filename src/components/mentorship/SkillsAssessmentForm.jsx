// SkillsAssessmentForm.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { saveMentorshipSession } from '../../data';
import { Timestamp } from 'firebase/firestore';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox,
    Modal
} from '../CommonComponents';
import { getAuth } from "firebase/auth";

import { GenericFacilityForm, IMNCIFormFields } from '../FacilityForms.jsx';
import { submitFacilityDataForApproval } from '../../data';

// --- Import all IMNCI-specific logic and the renderer ---
import {
    IMNCIFormRenderer,
    getInitialFormData,
    rehydrateDraftData,
    calculateScores,
    findIncompleteTreatmentSkills,
    ensureArrayOfKeys,
    isVitalSignsComplete,
    isDangerSignsComplete,
    isCoughBlockComplete,
    isDiarrheaBlockComplete,
    isFeverBlockComplete,
    isEarBlockComplete,
    isMainSymptomsComplete,
    isMalnutritionComplete,
    isAnemiaComplete,
    isImmunizationComplete,
    isOtherProblemsComplete,
    isDecisionComplete,
    DIARRHEA_CLASSIFICATIONS,
    FEVER_CLASSIFICATIONS,
    COUGH_CLASSIFICATIONS,
    EAR_CLASSIFICATIONS,
    IMNCI_FORM_STRUCTURE,
    evaluateRelevance
} from './IMNCSkillsAssessmentForm.jsx';

// --- Sticky Overall Score Component ---
const StickyOverallScore = ({ score, maxScore }) => {
    if (score === null || maxScore === null || maxScore === 0 || score === undefined || maxScore === undefined) return null;
    let percentage = Math.round((score / maxScore) * 100);
    let bgColor = 'bg-gray-400';
    if (percentage >= 80) {
        bgColor = 'bg-green-600';
    } else if (percentage >= 50) {
        bgColor = 'bg-yellow-500';
    } else {
        bgColor = 'bg-red-600';
    }

    return (
        <div
            className={`fixed top-4 left-4 z-50 flex flex-col items-center justify-center p-3 w-20 h-20 rounded-lg ${bgColor} text-white shadow-2xl transition-all duration-300 transform hover:scale-105`}
            dir="rtl"
        >
            <div className="font-bold text-lg leading-none">{percentage}%</div>
            <div className="text-xs mt-1 text-center leading-tight">الدرجة الكلية</div>
            <div className="text-xs mt-0 leading-tight">({score}/{maxScore})</div>
        </div>
    );
};

// --- Form Component Start ---
const SkillsAssessmentForm = forwardRef((props, ref) => {
    const {
        facility,
        healthWorkerName,
        healthWorkerJobTitle,
        healthWorkerTrainingDate,
        healthWorkerPhone, 
        onExit,
        onSaveComplete,
        setToast,
        existingSessionData = null,
        visitNumber = 1,
        canEditVisitNumber = false, // Permission prop from parent
        lastSessionDate = null,
        onDraftCreated,
        setIsMothersFormModalOpen,
        setIsDashboardModalOpen,
        setIsVisitReportModalOpen,
        draftCount,
        workerHistory = [] // NEW: Worker history for dynamic visit number calculation
    } = props;

    // --- State Management ---
    const [formData, setFormData] = useState(() => 
        existingSessionData ? rehydrateDraftData(existingSessionData, DIARRHEA_CLASSIFICATIONS, FEVER_CLASSIFICATIONS) : getInitialFormData()
    );
    const [visibleStep, setVisibleStep] = useState(existingSessionData ? 9 : 1);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false);
    const [scores, setScores] = useState({});
    const auth = getAuth();
    const user = auth.currentUser;
    
    // --- Visit Number State Logic ---
    // Initialize with existing data if present, otherwise use the calculated prop (default)
    const [currentVisitNumber, setCurrentVisitNumber] = useState(() => 
        existingSessionData?.visitNumber ? existingSessionData.visitNumber : visitNumber
    );

    // --- NEW: Dynamic Visit Number Calculation ---
    useEffect(() => {
        // If editing, respect the saved value unless manually changed. 
        // We only auto-calculate for new sessions.
        if (existingSessionData) return;

        const currentSessionDate = formData.session_date;
        if (!currentSessionDate) return;

        // Get all unique dates from history for this worker
        const uniqueDates = [...new Set(
            workerHistory.map(s => s.sessionDate || (s.effectiveDate ? new Date(s.effectiveDate.seconds * 1000).toISOString().split('T')[0] : ''))
        )].filter(d => d).sort();

        // Check if current date exists in history
        if (uniqueDates.includes(currentSessionDate)) {
            // If date exists, use its sequence number
            const index = uniqueDates.indexOf(currentSessionDate);
            setCurrentVisitNumber(index + 1); 
        } else {
            // If new date, append to sequence
            setCurrentVisitNumber(uniqueDates.length + 1);
        }

    }, [formData.session_date, workerHistory, existingSessionData]);
    // ---------------------------------------------
    
    const [isFormFullyComplete, setIsFormFullyComplete] = useState(false);

    // --- Refs for Autosave ---
    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    const allPropsRef = useRef({
        facility, healthWorkerName, user, visitNumber: currentVisitNumber, existingSessionData,
        isSaving, isSavingDraft, setToast,
        healthWorkerJobTitle,
        onDraftCreated
    });
    useEffect(() => {
        allPropsRef.current = {
            facility, healthWorkerName, user, visitNumber: currentVisitNumber, existingSessionData,
            isSaving, isSavingDraft, setToast,
            healthWorkerJobTitle,
            onDraftCreated
        };
    }, [
        facility, healthWorkerName, user, currentVisitNumber, existingSessionData,
        isSaving, isSavingDraft, setToast,
        healthWorkerJobTitle,
        onDraftCreated
    ]);
    
    const editingIdRef = useRef(null); 

    // --- Effect for loading/rehydrating data ---
    useEffect(() => {
        const newId = existingSessionData ? existingSessionData.id : null;
        const oldId = editingIdRef.current;

        if (newId !== oldId) {
            if (newId) {
                const rehydratedData = rehydrateDraftData(existingSessionData, DIARRHEA_CLASSIFICATIONS, FEVER_CLASSIFICATIONS);
                setFormData(rehydratedData);
                setVisibleStep(9);
                
                const { assessment_skills: newAssessmentSkills } = rehydratedData;
                const vitalSignsComplete = isVitalSignsComplete(rehydratedData);
                const dangerSignsComplete = isDangerSignsComplete(rehydratedData);
                const mainSymptomsComplete = isMainSymptomsComplete(newAssessmentSkills);
                const malnutritionComplete = isMalnutritionComplete(rehydratedData);
                const anemiaComplete = isAnemiaComplete(rehydratedData);
                const immunizationComplete = isImmunizationComplete(rehydratedData);
                const otherProblemsComplete = isOtherProblemsComplete(rehydratedData);
                const decisionComplete = isDecisionComplete(rehydratedData);
                const treatmentComplete = findIncompleteTreatmentSkills(rehydratedData).length === 0;

                const allComplete = vitalSignsComplete &&
                                     dangerSignsComplete &&
                                     mainSymptomsComplete &&
                                     malnutritionComplete &&
                                     anemiaComplete &&
                                     immunizationComplete &&
                                     otherProblemsComplete &&
                                     decisionComplete &&
                                     treatmentComplete;

                setIsFormFullyComplete(allComplete);
            } else {
                setFormData(getInitialFormData());
                setVisibleStep(1);
                setIsFormFullyComplete(false);
            }
            editingIdRef.current = newId;
        }
    }, [existingSessionData]);

    // --- Main effect for cleanup, visibility, and scoring ---
    useEffect(() => {
        let needsUpdate = false;
        const newFormData = JSON.parse(JSON.stringify(formData));
        const { assessment_skills: newAssessmentSkills, treatment_skills: newTreatmentSkills } = newFormData;

        // --- Step Visibility Logic ---
        let maxStep = 1;
        if (isVitalSignsComplete(formData)) { maxStep = 2;
            if (isDangerSignsComplete(formData)) { maxStep = 3;
                if (isMainSymptomsComplete(newAssessmentSkills)) { maxStep = 4;
                    if (isMalnutritionComplete(formData)) { maxStep = 5;
                        if (isMalnutritionComplete(formData)) { maxStep = 5;
                        if (isAnemiaComplete(formData)) { maxStep = 6;
                            if (isImmunizationComplete(formData)) { maxStep = 7;
                                if (isOtherProblemsComplete(formData)) { maxStep = 8;
                                    if (isDecisionComplete(formData)) { maxStep = 9; }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
        const targetVisibleStep = editingIdRef.current ? 9 : Math.max(visibleStep, maxStep);
        if (targetVisibleStep !== visibleStep) {
            setVisibleStep(targetVisibleStep);
        }

        // --- Cleanup Logic ---
        const resetSymptomSubquestions = (prefix, classifications, isMulti) => {
            const createInitialState = (classifications) => classifications.reduce((acc, c) => { acc[c] = false; return acc; }, {});

            const mainSkillKey = `skill_ask_${prefix}`;
            if (newAssessmentSkills[mainSkillKey] === 'no') {
                const confirmsKey = `supervisor_confirms_${prefix}`;
                const checkSkillKey = `skill_check_${prefix === 'cough' ? 'rr' : prefix === 'diarrhea' ? 'dehydration' : prefix === 'fever' ? 'rdt' : 'ear'}`;
                const classifySkillKey = `skill_classify_${prefix}`;
                const workerClassKey = `worker_${prefix}_classification`;
                const correctClassKey = `supervisor_correct_${prefix}_classification`;
                const initialClassState = isMulti ? createInitialState(classifications || []) : '';

                if (newAssessmentSkills[confirmsKey] !== '') { newAssessmentSkills[confirmsKey] = ''; needsUpdate = true; }
                if (newAssessmentSkills[checkSkillKey] !== '') { newAssessmentSkills[checkSkillKey] = ''; needsUpdate = true; }
                if (newAssessmentSkills[classifySkillKey] !== '') { newAssessmentSkills[classifySkillKey] = ''; needsUpdate = true; }
                if (isMulti ? JSON.stringify(newAssessmentSkills[workerClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[workerClassKey] !== '') { newAssessmentSkills[workerClassKey] = initialClassState; needsUpdate = true; }
                if (isMulti ? JSON.stringify(newAssessmentSkills[correctClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[correctClassKey] !== '') { newAssessmentSkills[correctClassKey] = initialClassState; needsUpdate = true; }
            }
        };
        resetSymptomSubquestions('cough', COUGH_CLASSIFICATIONS, false);
        resetSymptomSubquestions('diarrhea', DIARRHEA_CLASSIFICATIONS, true);
        resetSymptomSubquestions('fever', FEVER_CLASSIFICATIONS, true);
        resetSymptomSubquestions('ear', EAR_CLASSIFICATIONS, false);

        const symptomCleanup = (symptomPrefix, classifications, isMulti = false) => {
            const createInitialState = (classifications) => classifications.reduce((acc, c) => { acc[c] = false; return acc; }, {});
            
            const mainSkillKey = `skill_ask_${symptomPrefix}`;
            if (newAssessmentSkills[mainSkillKey] === 'yes') {
                const confirmsKey = `supervisor_confirms_${symptomPrefix}`;
                const checkSkillKey = `skill_check_${symptomPrefix === 'cough' ? 'rr' : symptomPrefix === 'diarrhea' ? 'dehydration' : symptomPrefix === 'fever' ? 'rdt' : 'ear'}`;
                const classifySkillKey = `skill_classify_${symptomPrefix}`;
                const workerClassKey = `worker_${symptomPrefix}_classification`; 
                const correctClassKey = `supervisor_correct_${symptomPrefix}_classification`; 

                const supervisorConfirms = newAssessmentSkills[confirmsKey] === 'yes';
                const initialClassState = isMulti ? createInitialState(classifications || []) : '';
                const didClassifyCorrectly = newAssessmentSkills[classifySkillKey] === 'yes';

                if (!supervisorConfirms && newAssessmentSkills[confirmsKey] !== '') {
                    if (newAssessmentSkills[checkSkillKey] !== 'na') { newAssessmentSkills[checkSkillKey] = 'na'; needsUpdate = true; }
                    if (newAssessmentSkills[classifySkillKey] !== 'na') { newAssessmentSkills[classifySkillKey] = 'na'; needsUpdate = true; }
                    if (isMulti ? JSON.stringify(newAssessmentSkills[workerClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[workerClassKey] !== '') { newAssessmentSkills[workerClassKey] = initialClassState; needsUpdate = true; }
                    if (isMulti ? JSON.stringify(newAssessmentSkills[correctClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[correctClassKey] !== '') { newAssessmentSkills[correctClassKey] = initialClassState; needsUpdate = true; }
                } else if (supervisorConfirms) {
                    if (newAssessmentSkills[checkSkillKey] === 'na') { newAssessmentSkills[checkSkillKey] = ''; needsUpdate = true; }
                    if (newAssessmentSkills[classifySkillKey] === 'na') { newAssessmentSkills[classifySkillKey] = ''; needsUpdate = true; }
                    if (didClassifyCorrectly || newAssessmentSkills[classifySkillKey] === 'na' || newAssessmentSkills[classifySkillKey] === '') {
                        if (isMulti ? JSON.stringify(newAssessmentSkills[correctClassKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[correctClassKey] !== '') {
                            newAssessmentSkills[correctClassKey] = initialClassState;
                            needsUpdate = true;
                        }
                    }
                }
            }
        };
        symptomCleanup('cough', COUGH_CLASSIFICATIONS);
        symptomCleanup('diarrhea', DIARRHEA_CLASSIFICATIONS, true);
        symptomCleanup('fever', FEVER_CLASSIFICATIONS, true);
        symptomCleanup('ear', EAR_CLASSIFICATIONS);

        const classificationCleanup = (prefix, isMulti = false, classifications = []) => {
            const createInitialState = (classifications) => classifications.reduce((acc, c) => { acc[c] = false; return acc; }, {});

            const classifySkillKey = `skill_${prefix}_classify`;
            const correctKey = `supervisor_correct_${prefix}_classification`;
            const didClassifyCorrectly = newAssessmentSkills[classifySkillKey] === 'yes';
            const initialClassState = isMulti ? createInitialState(classifications) : '';

            if (didClassifyCorrectly || newAssessmentSkills[classifySkillKey] === 'na' || newAssessmentSkills[classifySkillKey] === '') {
                if (isMulti ? JSON.stringify(newAssessmentSkills[correctKey]) !== JSON.stringify(initialClassState) : newAssessmentSkills[correctKey] !== '') {
                    newAssessmentSkills[correctKey] = initialClassState;
                    needsUpdate = true;
                }
            }
        };
        classificationCleanup('malnutrition');
        classificationCleanup('anemia');

        IMNCI_FORM_STRUCTURE.forEach(group => {
            if (group.sectionKey !== 'treatment_skills' || !newTreatmentSkills) return;
            if(Array.isArray(group.subgroups)) {
                group.subgroups.forEach(subgroup => {
                     let isSubgroupRelevant = true;
                     if (subgroup.relevant) {
                        isSubgroupRelevant = typeof subgroup.relevant === 'function'
                            ? subgroup.relevant(newFormData)
                            : evaluateRelevance(subgroup.relevant, newFormData);
                     }

                    if (Array.isArray(subgroup.skills)) {
                        subgroup.skills.forEach(skill => {
                            if (!skill?.key) return;
                            let isSkillRelevant = isSubgroupRelevant;
                            if (isSubgroupRelevant && skill.relevant) {
                                isSkillRelevant = typeof skill.relevant === 'function'
                                    ? skill.relevant(newFormData)
                                    : evaluateRelevance(skill.relevant, newFormData);
                            }

                            if (!isSkillRelevant && newTreatmentSkills[skill.key] !== 'na') {
                                newTreatmentSkills[skill.key] = 'na';
                                needsUpdate = true;
                            }
                            else if (isSkillRelevant && newTreatmentSkills[skill.key] === 'na') {
                                newTreatmentSkills[skill.key] = '';
                                needsUpdate = true;
                            }
                        });
                    }
                });
            }
        });

        if (needsUpdate) {
            setFormData(newFormData);
        }

        const vitalSignsComplete = isVitalSignsComplete(newFormData);
        const dangerSignsComplete = isDangerSignsComplete(newFormData);
        const mainSymptomsComplete = isMainSymptomsComplete(newAssessmentSkills);
        const malnutritionComplete = isMalnutritionComplete(newFormData);
        const anemiaComplete = isAnemiaComplete(newFormData);
        const immunizationComplete = isImmunizationComplete(newFormData);
        const otherProblemsComplete = isOtherProblemsComplete(newFormData);
        const decisionComplete = isDecisionComplete(newFormData);
        const treatmentComplete = findIncompleteTreatmentSkills(newFormData).length === 0;

        const allStepsComplete = vitalSignsComplete &&
                                 dangerSignsComplete &&
                                 mainSymptomsComplete &&
                                 malnutritionComplete &&
                                 anemiaComplete &&
                                 immunizationComplete &&
                                 otherProblemsComplete &&
                                 decisionComplete &&
                                 treatmentComplete;

        setIsFormFullyComplete(allStepsComplete);

        setScores(calculateScores(newFormData)); 

    }, [formData, visibleStep]);


    // --- Autosave Logic ---
    const silentSaveDraft = useCallback(async () => {
        const {
            facility, healthWorkerName, user, visitNumber: currentVisitNum, existingSessionData,
            isSaving, isSavingDraft, setToast, healthWorkerJobTitle,
            onDraftCreated
        } = allPropsRef.current;
        
        const currentFormData = formDataRef.current;
        if (isSaving || isSavingDraft) return;
        
        try {
            const getSelectedKeys = (obj) => Object.entries(obj || {}).filter(([, isSelected]) => isSelected).map(([key]) => key);
            const assessmentSkillsPayload = {
                ...currentFormData.assessment_skills,
                worker_diarrhea_classification: getSelectedKeys(currentFormData.assessment_skills.worker_diarrhea_classification),
                supervisor_correct_diarrhea_classification: getSelectedKeys(currentFormData.assessment_skills.supervisor_correct_diarrhea_classification),
                worker_fever_classification: getSelectedKeys(currentFormData.assessment_skills.worker_fever_classification),
                supervisor_correct_fever_classification: getSelectedKeys(currentFormData.assessment_skills.supervisor_correct_fever_classification),
            };
            
            const calculatedScores = calculateScores(currentFormData);
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (key !== 'treatmentScoreForSave' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }

            const effectiveDateTimestamp = Timestamp.fromDate(new Date(currentFormData.session_date));
            const sessionId = editingIdRef.current;

            const payload = {
                serviceType: 'IMNCI',
                state: facility?.['الولاية'] || null,
                locality: facility?.['المحلية'] || null,
                facilityId: facility?.id || null,
                facilityName: facility?.['اسم_المؤسسة'] || null,
                healthWorkerName: healthWorkerName,
                facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                workerType: healthWorkerJobTitle || null,
                sessionDate: currentFormData.session_date,
                effectiveDate: effectiveDateTimestamp,
                assessmentSkills: assessmentSkillsPayload,
                finalDecision: currentFormData.finalDecision,
                decisionMatches: currentFormData.decisionMatches,
                treatmentSkills: currentFormData.treatment_skills,
                scores: scoresPayload,
                notes: currentFormData.notes,
                status: 'draft',
                visitNumber: Number(currentVisitNum) // Use local state
            };

            if (sessionId) {
                payload.mentorEmail = existingSessionData?.mentorEmail || 'unknown';
                payload.mentorName = existingSessionData?.mentorName || 'Unknown Mentor';
                payload.edited_by_email = user?.email || 'unknown';
                payload.edited_by_name = user?.displayName || 'Unknown Mentor';
                payload.edited_at = Timestamp.now();
            } else {
                payload.mentorEmail = user?.email || 'unknown';
                payload.mentorName = user?.displayName || 'Unknown Mentor';
            }

            const savedDraft = await saveMentorshipSession(payload, sessionId);
            
            if (!sessionId && savedDraft && onDraftCreated) {
                onDraftCreated(savedDraft);
                editingIdRef.current = savedDraft.id; 
            }
        } catch (error) {
            console.error("Autosave failed:", error);
            setToast({ show: true, message: `فشل الحفظ التلقائي: ${error.message}`, type: 'error' });
        }
    }, [currentVisitNumber]);

    // --- useImperativeHandle ---
    useImperativeHandle(ref, () => ({
        saveDraft: async () => {
            const { isSaving, isSavingDraft } = allPropsRef.current;
            if (isSaving || isSavingDraft) {
                return;
            }
            await silentSaveDraft();
        },
        openFacilityModal: () => setIsFacilityModalOpen(true)
    }));


    // --- Handlers ---
    const handleMultiClassificationChange = (stateKey, classificationName, isChecked) => {
        setFormData(prev => ({
            ...prev,
            assessment_skills: {
                ...prev.assessment_skills,
                [stateKey]: {
                    ...(prev.assessment_skills[stateKey] || {}),
                    [classificationName]: isChecked
                }
            }
        }));
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        const simpleAssessmentFields = [
            'supervisor_confirms_cough', 'worker_cough_classification', 'supervisor_correct_cough_classification',
            'supervisor_confirms_diarrhea',
            'supervisor_confirms_fever',
            'supervisor_confirms_ear', 'worker_ear_classification', 'supervisor_correct_ear_classification',
            'worker_malnutrition_classification', 'supervisor_correct_malnutrition_classification',
            'worker_anemia_classification', 'supervisor_correct_anemia_classification'
        ];
        
         if (simpleAssessmentFields.includes(name)) {
            setFormData(prev => ({
                ...prev,
                assessment_skills: { ...prev.assessment_skills, [name]: value }
            }));
        } else if (name === 'finalDecision' || name === 'decisionMatches' || name === 'notes' || name === 'session_date') {
             setFormData(prev => ({ ...prev, [name]: value }));
         }
    };

    const handleSkillChange = (section, key, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value,
            }
        }));
    };

    const handleSaveFacilityData = async (formData) => {
        try {
            await submitFacilityDataForApproval(formData);
            setToast({ show: true, message: "Update submitted successfully! Your changes are pending approval.", type: 'success' });
            setIsFacilityModalOpen(false);
        } catch (error) {
            setToast({ show: true, message: `Submission failed: ${error.message}`, type: 'error' });
        }
    };

    // --- Final Submit Handler ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isFormFullyComplete) {
             const validationMessages = [];
             if (!isVitalSignsComplete(formData)) validationMessages.push('خطوة 1: القياسات الجسمانية والحيوية');
             if (!isDangerSignsComplete(formData)) validationMessages.push('خطوة 2: علامات الخطورة العامة');
             if (!isMainSymptomsComplete(formData.assessment_skills)) validationMessages.push('خطوة 3: الأعراض الأساسية');
             if (!isMalnutritionComplete(formData)) validationMessages.push('خطوة 4: سوء التغذية الحاد');
             if (!isAnemiaComplete(formData)) validationMessages.push('خطوة 5: فقر الدم');
             if (!isImmunizationComplete(formData)) validationMessages.push('خطوة 6: التطعيم وفيتامين أ');
             if (!isOtherProblemsComplete(formData)) validationMessages.push('خطوة 7: الأمراض الأخرى');
             if (!isDecisionComplete(formData)) validationMessages.push('خطوة 8: القرار النهائي');
             const incompleteTreatment = findIncompleteTreatmentSkills(formData);
             if (incompleteTreatment.length > 0) {
                validationMessages.push(`خطوة 9: حقول العلاج والنصح (ناقص: ${incompleteTreatment[0]}...)`);
             }
             
             const errorMessage = `لا يمكن الحفظ. الرجاء إكمال الأقسام التالية: \n- ${validationMessages.join('\n- ')}`;
             setToast({ show: true, message: errorMessage, type: 'error', duration: 10000 });
             return;
        }

        setIsSaving(true);
        try {
            const getSelectedKeys = (obj) => Object.entries(obj || {}).filter(([, isSelected]) => isSelected).map(([key]) => key);
            const assessmentSkillsPayload = {
                ...formData.assessment_skills,
                worker_diarrhea_classification: getSelectedKeys(formData.assessment_skills.worker_diarrhea_classification),
                supervisor_correct_diarrhea_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_diarrhea_classification),
                worker_fever_classification: getSelectedKeys(formData.assessment_skills.worker_fever_classification),
                supervisor_correct_fever_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_fever_classification),
            };

            delete assessmentSkillsPayload.supervisor_agrees_cough_classification;
            delete assessmentSkillsPayload.supervisor_agrees_diarrhea_classification;
            delete assessmentSkillsPayload.supervisor_agrees_fever_classification;
            delete assessmentSkillsPayload.supervisor_agrees_ear_classification;
            delete assessmentSkillsPayload.supervisor_agrees_malnutrition_classification;
            delete assessmentSkillsPayload.supervisor_agrees_anemia_classification;

            const calculatedScores = calculateScores(formData);
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (key !== 'treatmentScoreForSave' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }

            const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));
            const sessionId = editingIdRef.current;

            const payload = {
                serviceType: 'IMNCI',
                state: facility?.['الولاية'] || null,
                locality: facility?.['المحلية'] || null,
                facilityId: facility?.id || null,
                facilityName: facility?.['اسم_المؤسسة'] || null,
                healthWorkerName: healthWorkerName,
                facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                workerType: healthWorkerJobTitle || null,
                sessionDate: formData.session_date,
                effectiveDate: effectiveDateTimestamp,
                assessmentSkills: assessmentSkillsPayload,
                finalDecision: formData.finalDecision,
                decisionMatches: formData.decisionMatches,
                treatmentSkills: formData.treatment_skills,
                scores: scoresPayload,
                notes: formData.notes,
                status: 'complete',
                visitNumber: Number(currentVisitNumber) // Use local state
            };

            if (sessionId) {
                payload.mentorEmail = existingSessionData?.mentorEmail || 'unknown';
                payload.mentorName = existingSessionData?.mentorName || 'Unknown Mentor';
                payload.edited_by_email = user?.email || 'unknown';
                payload.edited_by_name = user?.displayName || 'Unknown Mentor';
                payload.edited_at = Timestamp.now();
            } else {
                payload.mentorEmail = user?.email || 'unknown';
                payload.mentorName = user?.displayName || 'Unknown Mentor';
            }

            const savedSession = await saveMentorshipSession(payload, sessionId);

            setToast({ show: true, message: 'تم حفظ الجلسة بنجاح!', type: 'success' });
            if (onSaveComplete) onSaveComplete('complete', payload);
        } catch (error) {
            console.error("Error saving mentorship session:", error);
            setToast({ show: true, message: `فشل الحفظ: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // --- Draft Save Handler ---
    const handleSaveDraft = async (e) => {
         e.preventDefault();
         setIsSavingDraft(true);
         try {
             const getSelectedKeys = (obj) => Object.entries(obj || {}).filter(([, isSelected]) => isSelected).map(([key]) => key);
             const assessmentSkillsPayload = {
                 ...formData.assessment_skills,
                 worker_diarrhea_classification: getSelectedKeys(formData.assessment_skills.worker_diarrhea_classification),
                 supervisor_correct_diarrhea_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_diarrhea_classification),
                 worker_fever_classification: getSelectedKeys(formData.assessment_skills.worker_fever_classification),
                 supervisor_correct_fever_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_fever_classification),
             };
            
            const calculatedScores = calculateScores(formData);
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (key !== 'treatmentScoreForSave' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }

             const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));
             const sessionId = editingIdRef.current;

             const payload = {
                 serviceType: 'IMNCI',
                 state: facility?.['الولاية'] || null,
                 locality: facility?.['المحلية'] || null,
                 facilityId: facility?.id || null,
                 facilityName: facility?.['اسم_المؤسسة'] || null,
                 healthWorkerName: healthWorkerName,
                 facilityType: facility?.['نوع_المؤسسةالصحية'] || null,
                 workerType: healthWorkerJobTitle || null,
                 sessionDate: formData.session_date,
                 effectiveDate: effectiveDateTimestamp,
                 assessmentSkills: assessmentSkillsPayload,
                 finalDecision: formData.finalDecision,
                 decisionMatches: formData.decisionMatches,
                 treatmentSkills: formData.treatment_skills,
                 scores: scoresPayload,
                 notes: formData.notes,
                 status: 'draft',
                 visitNumber: Number(currentVisitNumber) // Use local state
             };

            if (sessionId) {
                payload.mentorEmail = existingSessionData?.mentorEmail || 'unknown';
                payload.mentorName = existingSessionData?.mentorName || 'Unknown Mentor';
                payload.edited_by_email = user?.email || 'unknown';
                payload.edited_by_name = user?.displayName || 'Unknown Mentor';
                payload.edited_at = Timestamp.now();
            } else {
                payload.mentorEmail = user?.email || 'unknown';
                payload.mentorName = user?.displayName || 'Unknown Mentor';
            }

             const savedDraft = await saveMentorshipSession(payload, sessionId);

             if (!sessionId && savedDraft && onDraftCreated) {
                 onDraftCreated(savedDraft);
                 editingIdRef.current = savedDraft.id;
             }

             setToast({ show: true, message: 'تم حفظ المسودة بنجاح!', type: 'success' });
             if (onSaveComplete) onSaveComplete('draft', payload);
         } catch (error) {
            console.error("Error saving draft session:", error);
            setToast({ show: true, message: `فشل حفظ المسودة: ${error.message}` });
         } finally {
            setIsSavingDraft(false);
         }
    };


    // --- Render function ---
    return (
        <Card dir="rtl">
            <StickyOverallScore
                score={scores?.overallScore?.score}
                maxScore={scores?.overallScore?.maxScore}
            />
            <form onSubmit={handleSubmit}>
                <div className="p-6">
                    {/* --- Centered Title --- */}
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-sky-800">
                            متابعة مهارات العلاج المتكامل للأطفال اقل من 5 سنوات
                        </h2>
                    </div>

                    {/* --- Info Cards Wrapper --- */}
                    <div className="space-y-2 mb-4">
                        {/* Facility Info */}
                        <div className="p-2 border rounded-lg bg-gray-50 text-right space-y-0.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-0.5" dir="rtl">
                                <div><span className="text-sm font-medium text-gray-500">الولاية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['الولاية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">المحلية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['المحلية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">اسم المؤسسة:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['اسم_المؤسسة'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">نوع المؤسسة:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['نوع_المؤسسةالصحية'] || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">العدد الكلي للكوادر الطبية:</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['العدد_الكلي_للكوادر_الطبية_العاملة_أطباء_ومساعدين'] ?? 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">الكوادر المدربة (IMNCI):</span><span className="text-sm font-semibold text-gray-900 mr-2">{facility?.['العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل'] ?? 'غير محدد'}</span></div>
                            </div>
                        </div>
                        {/* Health Worker Info */}
                        <div className="p-2 border rounded-lg bg-gray-50 text-right space-y-0.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-0.5" dir="rtl">
                                <div><span className="text-sm font-medium text-gray-500">اسم العامل الصحي:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerName || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">الوصف الوظيفي:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerJobTitle || 'غير محدد'}</span></div>
                                <div className="whitespace-nowrap overflow-hidden text-ellipsis"><span className="text-sm font-medium text-gray-500">تاريخ اخر تدريب (IMNCI):</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerTrainingDate || 'غير محدد'}</span></div>
                                <div><span className="text-sm font-medium text-gray-500">رقم الهاتف:</span><span className="text-sm font-semibold text-gray-900 mr-2">{healthWorkerPhone || 'غير محدد'}</span></div>
                            </div>
                        </div>
                        {/* Mentor/Session Info */}
                        <div className="p-2 border rounded-lg bg-gray-50 text-right">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-0.5 items-end" dir="rtl">
                                <div className="text-sm"><span className="font-medium text-gray-500">اسم المشرف:</span><span className="font-semibold text-gray-900 mr-2">{user?.displayName || user?.email || '...'}</span></div>                                <div className="text-sm"><span className="font-medium text-gray-500">تاريخ الجلسة:</span>
                                    <Input 
                                        type="date" 
                                        name="session_date" 
                                        value={formData.session_date} 
                                        onChange={handleFormChange} 
                                        required 
                                        className="p-1 text-sm mr-2 w-auto"
                                    />
                                </div>
                                <div className="text-sm">
                                    <span className="font-medium text-gray-500">تاريخ الجلسة السابقة:</span>
                                    <span className="font-semibold text-gray-900 mr-2">{lastSessionDate || '---'}</span> 
                                </div>
                                {/* --- VISIT NUMBER RENDER LOGIC --- */}
                                <div className="text-sm flex items-center">
                                    <span className="font-medium text-gray-700 ml-2">رقم الجلسة:</span>
                                    {canEditVisitNumber ? (
                                        <Input 
                                            type="number" 
                                            min="1"
                                            value={currentVisitNumber}
                                            onChange={(e) => setCurrentVisitNumber(e.target.value)}
                                            className="w-20 p-1 text-center font-bold text-sky-700 border-sky-300 focus:ring-sky-500"
                                        />
                                    ) : (
                                        <span className="text-lg font-bold text-sky-700 mr-2">{currentVisitNumber}</span>
                                    )}
                                </div>
                                {/* ---------------------------------- */}
                            </div>
                        </div>
                    </div>


                    {/* --- Form Structure Mapping --- */}
                    <IMNCIFormRenderer
                        formData={formData}
                        visibleStep={visibleStep}
                        scores={scores}
                        handleFormChange={handleFormChange}
                        handleSkillChange={handleSkillChange}
                        handleMultiClassificationChange={handleMultiClassificationChange} 
                        isEditing={!!editingIdRef.current} 
                    />
                    
                    {/* --- Notes Section --- */}
                    {(visibleStep >= 9 || !!editingIdRef.current) && (
                        <>
                           <FormGroup label="ملاحظات عامة" className="text-right">
                                <Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={4} placeholder="أضف أي ملاحظات إضافية حول الجلسة..." className="text-right placeholder:text-right"/>
                           </FormGroup>
                        </>
                    )}
                </div>

                 {/* --- Button Bar --- */}
                 <div className="hidden sm:flex flex-col gap-2 items-end p-4 border-t bg-gray-50 sticky bottom-0 z-10">
                     {/* Row 1: Action Buttons */}
                     <div className="flex gap-2 flex-wrap justify-end">
                        <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft}> إلغاء </Button>
                        <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving || isSavingDraft}> {isSavingDraft ? 'جاري حفظ المسودة...' : 'حفظ كمسودة'} </Button>
                        <Button 
                            type="submit" 
                            disabled={isSaving || isSavingDraft || !isFormFullyComplete} 
                            title={!isFormFullyComplete ? "يجب إكمال جميع الخطوات أولاً لحفظ الجلسة" : "حفظ وإنهاء الجلسة"}
                        > 
                            {isSaving ? 'جاري الحفظ...' : 'حفظ وإكمال الجلسة'} 
                        </Button>
                     </div>
                     {/* Row 2: Navigation Buttons */}
                     <div className="flex gap-2 flex-wrap justify-end">
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsFacilityModalOpen(true)} 
                            disabled={isSaving || isSavingDraft || !facility}
                            title={facility ? "Open IMNCI Facility Data Form" : "No facility selected"}
                        >
                            بيانات المنشأة (IMNCI)
                        </Button>
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsMothersFormModalOpen(true)} 
                            disabled={isSaving || isSavingDraft || !facility}
                            title={facility ? "Open Mother's Survey" : "No facility selected"}
                        >
                            استبيان الأم
                        </Button>
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsVisitReportModalOpen(true)} 
                            disabled={isSaving || isSavingDraft || !facility}
                            title={facility ? "Open IMNCI Visit Report" : "No facility selected"}
                        >
                            تقرير الزيارة
                        </Button>
                        <Button 
                            type="button" 
                            variant="info"
                            onClick={() => setIsDashboardModalOpen(true)} 
                            disabled={isSaving || isSavingDraft}
                            title="Open Dashboard"
                        >
                            لوحة المتابعة
                        </Button>
                     </div>
                 </div>

                {/* --- Mobile Bar --- */}
                <div className="flex sm:hidden fixed bottom-16 left-0 right-0 z-20 h-16 justify-around items-center bg-gray-900 text-white border-t border-gray-700 shadow-lg" dir="rtl">
                    <Button type="button" variant="secondary" onClick={onExit} disabled={isSaving || isSavingDraft} size="sm">
                        إلغاء
                    </Button>
                    <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving || isSavingDraft} size="sm">
                        {isSavingDraft ? 'جاري...' : 'حفظ مسودة'}
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={isSaving || isSavingDraft || !isFormFullyComplete} 
                        title={!isFormFullyComplete ? "يجب إكمال جميع الخطوات أولاً لحفظ الجلسة" : "حفظ وإنهاء الجلسة"}
                        size="sm"
                    > 
                        {isSaving ? 'جاري...' : 'حفظ وإكمال'} 
                    </Button>
                </div>
            </form>

            {/* --- Facility Modal --- */}
            {isFacilityModalOpen && facility && (
                <Modal 
                    isOpen={isFacilityModalOpen} 
                    onClose={() => setIsFacilityModalOpen(false)} 
                    title={`بيانات منشأة: ${facility['اسم_Mؤسسة'] || ''}`}
                    size="full"
                >
                    <div className="p-0 sm:p-4 bg-gray-100 h-[90vh] overflow-y-auto">
                        <GenericFacilityForm
                            initialData={facility}
                            onSave={handleSaveFacilityData}
                            onCancel={() => setIsFacilityModalOpen(false)}
                            setToast={setToast}
                            title="بيانات خدمة IMNCI"
                            subtitle={`تحديث البيانات للمنشأة: ${facility['اسم_المؤسسة'] || '...'}`}
                            isPublicForm={false}
                            saveButtonText="Submit for Approval"
                            cancelButtonText="Close"
                        >
                            {(props) => <IMNCIFormFields {...props} />}
                        </GenericFacilityForm>
                    </div>
                </Modal>
            )}
        </Card>
    );
});

export default SkillsAssessmentForm;