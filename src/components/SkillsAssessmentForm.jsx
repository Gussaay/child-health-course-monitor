// SkillsAssessmentForm.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { saveMentorshipSession } from "../data.js";
import { Timestamp } from 'firebase/firestore';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner,
    EmptyState, Input, Textarea, CourseIcon, Checkbox,
    Modal
} from './CommonComponents';
import { getAuth } from "firebase/auth";

import { GenericFacilityForm, IMNCIFormFields } from './FacilityForms.jsx';
import { submitFacilityDataForApproval } from "../data.js";

// --- NEW: Import all IMNCI-specific logic and the renderer ---
import {
    IMNCIFormRenderer,
    getInitialFormData,
    rehydrateDraftData,
    calculateScores,
    findIncompleteTreatmentSkills,
    ensureArrayOfKeys, // <-- Helper needed for rehydration
    // --- All validation/step helpers ---
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
    // --- Constants needed for rehydration ---
    DIARRHEA_CLASSIFICATIONS,
    FEVER_CLASSIFICATIONS,
    COUGH_CLASSIFICATIONS,
    EAR_CLASSIFICATIONS,
    // --- ADD THESE TWO LINES (FIX) ---
    IMNCI_FORM_STRUCTURE,
    evaluateRelevance
    // --- END ADDITION (FIX) ---
} from './IMNCIFormPart.jsx';
// --- END NEW IMPORTS ---


// --- COMPONENT MOVED TO IMNCIFORMPART.JSX ---
// const SkillChecklistItem = (...)

// --- COMPONENT MOVED TO IMNCIFORMPART.JSX ---
// const ScoreCircle = (...)

// --- Sticky Overall Score Component (Stays in Shell) ---
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

// --- LOGIC MOVED TO IMNCIFORMPART.JSX ---
// const evaluateRelevance = (...)
// const IMNCI_FORM_STRUCTURE = [...]
// const COUGH_CLASSIFICATIONS = [...]
// const createInitialClassificationState = (...)
// const getInitialFormData = (...)
// const rehydrateDraftData = (...)
// const calculateScores = (...)
// const findIncompleteTreatmentSkills = (...)


// --- Form Component Start (MODIFIED) ---
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
        lastSessionDate = null,
        onDraftCreated,
        setIsMothersFormModalOpen,
        setIsDashboardModalOpen,
        setIsVisitReportModalOpen, // <-- ADD THIS
        draftCount
    } = props;

    // --- State Management (Stays in Shell) ---
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
    
    // (This is the simple state from the previous fix)
    const [isFormFullyComplete, setIsFormFullyComplete] = useState(false);

    // --- Refs for Autosave (Stays in Shell) ---
    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    const allPropsRef = useRef({
        facility, healthWorkerName, user, visitNumber, existingSessionData,
        isSaving, isSavingDraft, setToast,
        healthWorkerJobTitle,
        onDraftCreated
    });
    useEffect(() => {
        allPropsRef.current = {
            facility, healthWorkerName, user, visitNumber, existingSessionData,
            isSaving, isSavingDraft, setToast,
            healthWorkerJobTitle,
            onDraftCreated
        };
    }, [
        facility, healthWorkerName, user, visitNumber, existingSessionData,
        isSaving, isSavingDraft, setToast,
        healthWorkerJobTitle,
        onDraftCreated
    ]);
    
    const editingIdRef = useRef(null); 

    // (This is the useEffect from the previous fix)
    // --- Effect for loading/rehydrating data (Stays in Shell) ---
    useEffect(() => {
        const newId = existingSessionData ? existingSessionData.id : null;
        const oldId = editingIdRef.current;

        if (newId !== oldId) {
            if (newId) {
                // We are loading an existing session.
                // 1. Rehydrate the data.
                const rehydratedData = rehydrateDraftData(existingSessionData, DIARRHEA_CLASSIFICATIONS, FEVER_CLASSIFICATIONS);
                setFormData(rehydratedData);
                setVisibleStep(9);
                
                // 2. Check its completeness *immediately*.
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

                // 3. Set the completeness state.
                setIsFormFullyComplete(allComplete);
            } else {
                // This is a new session.
                setFormData(getInitialFormData());
                setVisibleStep(1);
                // A new form is never complete by default.
                setIsFormFullyComplete(false);
            }
            editingIdRef.current = newId;
        }
    }, [existingSessionData]);


    // --- HELPERS MOVED TO IMNCIFORMPART.JSX ---
    // const isMultiSelectGroupEmpty = (...)
    // const isVitalSignsComplete = (...)
    // ... all other is...Complete helpers

    // --- Main effect for cleanup, visibility, and scoring (Stays in Shell) ---
    useEffect(() => {
        let needsUpdate = false;
        const newFormData = JSON.parse(JSON.stringify(formData));
        const { assessment_skills: newAssessmentSkills, treatment_skills: newTreatmentSkills } = newFormData;

        // --- Step Visibility Logic ---
        let maxStep = 1;
        // Use imported helpers
        if (isVitalSignsComplete(formData)) { maxStep = 2;
            if (isDangerSignsComplete(formData)) { maxStep = 3;
                if (isMainSymptomsComplete(newAssessmentSkills)) { maxStep = 4;
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
        const targetVisibleStep = editingIdRef.current ? 9 : Math.max(visibleStep, maxStep);
        if (targetVisibleStep !== visibleStep) {
            setVisibleStep(targetVisibleStep);
        }

        // --- Cleanup Logic (Stays in Shell, as it modifies state) ---
        
        // Helper to reset symptom sub-questions if main symptom is 'no'
        const resetSymptomSubquestions = (prefix, classifications, isMulti) => {
            // (This internal helper function is fine to keep here)
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

        // Helper for cleanup based on supervisor confirmation
        const symptomCleanup = (symptomPrefix, classifications, isMulti = false) => {
            // (This internal helper function is fine to keep here)
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

        // Helper for Malnutrition/Anemia classification cleanup
        const classificationCleanup = (prefix, isMulti = false, classifications = []) => {
            // (This internal helper function is fine to keep here)
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

        // Treatment relevance cleanup
        
        // This now works because IMNCI_FORM_STRUCTURE and evaluateRelevance
        // are imported at the top of the file.
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


        // Apply updates if any cleanup occurred
        if (needsUpdate) {
            setFormData(newFormData);
        }

        // --- Completion Check (uses imported helpers) ---
        // This code will now run on *every* render, ensuring
        // the button state is always in sync with the data.
        const vitalSignsComplete = isVitalSignsComplete(newFormData);
        const dangerSignsComplete = isDangerSignsComplete(newFormData);
        const mainSymptomsComplete = isMainSymptomsComplete(newAssessmentSkills); // Pass skills directly
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

        // Calculate scores using imported function
        setScores(calculateScores(newFormData)); 

    }, [formData, visibleStep]);


    // --- Autosave Logic (Stays in Shell) ---
    const silentSaveDraft = useCallback(async () => {
        const {
            facility, healthWorkerName, user, visitNumber, existingSessionData,
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
            
            // ================== BEGIN FIX ==================
            // REMOVED the 4 delete lines
            // =================== END FIX ===================

            // Use imported calculator
            const calculatedScores = calculateScores(currentFormData);
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (key !== 'treatmentScoreForSave' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }
            scoresPayload['treatment_score'] = calculatedScores.treatmentScoreForSave ?? 0;
            scoresPayload['treatment_maxScore'] = calculatedScores['treatment']?.maxScore ?? 0;

            const effectiveDateTimestamp = Timestamp.fromDate(new Date(currentFormData.session_date));
            const sessionId = editingIdRef.current; // Get sessionId first

            const payload = {
                serviceType: 'IMNCI', // <-- This would be a prop in a truly generic form
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
                visitNumber: visitNumber
                // Mentor/Editor fields will be added below
            };

            if (sessionId) {
                // This is an EDIT of an existing session
                // Use 'existingSessionData' from allPropsRef
                payload.mentorEmail = existingSessionData?.mentorEmail || 'unknown'; // Keep original mentor
                payload.mentorName = existingSessionData?.mentorName || 'Unknown Mentor'; // Keep original mentor
                payload.edited_by_email = user?.email || 'unknown'; // Add editor's email
                payload.edited_by_name = user?.displayName || 'Unknown Mentor'; // Add editor's name
                payload.edited_at = Timestamp.now(); // Add edit timestamp
            } else {
                // This is a NEW session
                payload.mentorEmail = user?.email || 'unknown'; // Set current user as mentor
                payload.mentorName = user?.displayName || 'Unknown Mentor'; // Set current user as mentor
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
    }, []); 

    // --- useImperativeHandle (Stays in Shell) ---
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


    // --- Handlers (Stay in Shell) ---
    
    // --- NEW HANDLER (FIX) ---
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
    // --- END NEW HANDLER (FIX) ---

    // --- MODIFIED HANDLER (FIX) ---
    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        // This list contains all simple form fields (Selects)
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
    // --- END MODIFIED HANDLER (FIX) ---

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

    // --- Final Submit Handler (Stays in Shell) ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Use imported helper
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
             // Use imported helper
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
            // Payload processing (stays, uses imported helpers)
            const getSelectedKeys = (obj) => Object.entries(obj || {}).filter(([, isSelected]) => isSelected).map(([key]) => key);
            const assessmentSkillsPayload = {
                ...formData.assessment_skills,
                worker_diarrhea_classification: getSelectedKeys(formData.assessment_skills.worker_diarrhea_classification),
                supervisor_correct_diarrhea_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_diarrhea_classification),
                worker_fever_classification: getSelectedKeys(formData.assessment_skills.worker_fever_classification),
                supervisor_correct_fever_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_fever_classification),
            };

            // ================== BEGIN FIX ==================
            // REMOVED the 4 delete lines
            // =================== END FIX ===================
            
            delete assessmentSkillsPayload.supervisor_agrees_cough_classification;
            delete assessmentSkillsPayload.supervisor_agrees_diarrhea_classification;
            delete assessmentSkillsPayload.supervisor_agrees_fever_classification;
            delete assessmentSkillsPayload.supervisor_agrees_ear_classification;
            delete assessmentSkillsPayload.supervisor_agrees_malnutrition_classification;
            delete assessmentSkillsPayload.supervisor_agrees_anemia_classification;

            // Use imported calculator
            const calculatedScores = calculateScores(formData);
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (key !== 'treatmentScoreForSave' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }
            scoresPayload['treatment_score'] = calculatedScores.treatmentScoreForSave ?? 0;
            scoresPayload['treatment_maxScore'] = calculatedScores['treatment']?.maxScore ?? 0;

            const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));
            const sessionId = editingIdRef.current; // Get sessionId first

            const payload = {
                serviceType: 'IMNCI', // <-- This would be a prop in a truly generic form
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
                visitNumber: visitNumber
                // Mentor/Editor fields will be added below
            };

            if (sessionId) {
                // This is an EDIT of an existing session
                payload.mentorEmail = existingSessionData?.mentorEmail || 'unknown'; // Keep original mentor
                payload.mentorName = existingSessionData?.mentorName || 'Unknown Mentor'; // Keep original mentor
                payload.edited_by_email = user?.email || 'unknown'; // Add editor's email
                payload.edited_by_name = user?.displayName || 'Unknown Mentor'; // Add editor's name
                payload.edited_at = Timestamp.now(); // Add edit timestamp
            } else {
                // This is a NEW session
                payload.mentorEmail = user?.email || 'unknown'; // Set current user as mentor
                payload.mentorName = user?.displayName || 'Unknown Mentor'; // Set current user as mentor
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

    // --- Draft Save Handler (Stays in Shell) ---
    const handleSaveDraft = async (e) => {
         e.preventDefault();
         setIsSavingDraft(true);
         try {
             // Payload processing
             const getSelectedKeys = (obj) => Object.entries(obj || {}).filter(([, isSelected]) => isSelected).map(([key]) => key);
             const assessmentSkillsPayload = {
                 ...formData.assessment_skills,
                 worker_diarrhea_classification: getSelectedKeys(formData.assessment_skills.worker_diarrhea_classification),
                 supervisor_correct_diarrhea_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_diarrhea_classification),
                 worker_fever_classification: getSelectedKeys(formData.assessment_skills.worker_fever_classification),
                 supervisor_correct_fever_classification: getSelectedKeys(formData.assessment_skills.supervisor_correct_fever_classification),
             };
            
            // ================== BEGIN FIX ==================
            // REMOVED the 4 delete lines
            // =================== END FIX ===================

            // Use imported calculator
            const calculatedScores = calculateScores(formData);
            const scoresPayload = {};
            for (const key in calculatedScores) { 
                if (key !== 'treatmentScoreForSave' && calculatedScores[key]?.score !== undefined && calculatedScores[key]?.maxScore !== undefined) {
                    scoresPayload[`${key}_score`] = calculatedScores[key].score;
                    scoresPayload[`${key}_maxScore`] = calculatedScores[key].maxScore;
                }
            }
            scoresPayload['treatment_score'] = calculatedScores.treatmentScoreForSave ?? 0;
            scoresPayload['treatment_maxScore'] = calculatedScores['treatment']?.maxScore ?? 0;

             const effectiveDateTimestamp = Timestamp.fromDate(new Date(formData.session_date));
             const sessionId = editingIdRef.current; // Get sessionId first

             const payload = {
                 serviceType: 'IMNCI', // <-- This would be a prop in a truly generic form
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
                 visitNumber: visitNumber
                 // Mentor/Editor fields will be added below
             };

            if (sessionId) {
                // This is an EDIT of an existing session
                payload.mentorEmail = existingSessionData?.mentorEmail || 'unknown'; // Keep original mentor
                payload.mentorName = existingSessionData?.mentorName || 'Unknown Mentor'; // Keep original mentor
                payload.edited_by_email = user?.email || 'unknown'; // Add editor's email
                payload.edited_by_name = user?.displayName || 'Unknown Mentor'; // Add editor's name
                payload.edited_at = Timestamp.now(); // Add edit timestamp
            } else {
                // This is a NEW session
                payload.mentorEmail = user?.email || 'unknown'; // Set current user as mentor
                payload.mentorName = user?.displayName || 'Unknown Mentor'; // Set current user as mentor
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


    // --- Render function (Stays in Shell) ---
    return (
        <Card dir="rtl">
            <StickyOverallScore
                score={scores?.overallScore?.score}
                maxScore={scores?.overallScore?.maxScore}
            />
            <form onSubmit={handleSubmit}>
                <div className="p-6">
                    {/* --- Centered Title (Generic) --- */}
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-sky-800">
                            متابعة مهارات العلاج المتكامل للأطفال اقل من 5 سنوات
                        </h2>
                    </div>

                    {/* --- Info Cards Wrapper (Generic) --- */}
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
                                <div className="text-sm"><span className="font-medium text-gray-700">رقم الجلسة:</span>
                                    <span className="text-lg font-bold text-sky-700 mr-2">{visitNumber}</span>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* --- NEW: Form Structure Mapping --- */}
                    {/* This is where the specific form part is rendered */}
                    <IMNCIFormRenderer
                        formData={formData}
                        visibleStep={visibleStep}
                        scores={scores}
                        handleFormChange={handleFormChange}
                        handleSkillChange={handleSkillChange}
                        handleMultiClassificationChange={handleMultiClassificationChange} 
                        isEditing={!!editingIdRef.current} // Pass isEditing flag
                    />
                    {/* --- END: Form Structure Mapping --- */}
                    

                    {/* --- Notes Section (Generic) --- */}
                    {(visibleStep >= 9 || !!editingIdRef.current) && (
                        <>
                           <FormGroup label="ملاحظات عامة" className="text-right">
                                <Textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={4} placeholder="أضف أي ملاحظات إضافية حول الجلسة..." className="text-right placeholder:text-right"/>
                           </FormGroup>
                        </>
                    )}
                </div>

                 {/* --- Button Bar (Generic) --- */}
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
                            onClick={() => setIsVisitReportModalOpen(true)} // <-- ADD THIS
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

                {/* --- Mobile Bar (Generic) --- */}
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

            {/* --- Facility Modal (Generic) --- */}
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