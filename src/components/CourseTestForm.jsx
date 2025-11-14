// CourseTestForm.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner, Input, Modal, CardBody, CardFooter
} from "./CommonComponents"; 
import {
    JOB_TITLES_ETAT, JOB_TITLES_EENC, STATE_LOCALITIES
} from './constants.js';
import {
    listHealthFacilities,
    submitFacilityDataForApproval,
    upsertParticipantTest, 
    deleteParticipantTest
} from '../data.js';
import { GenericFacilityForm, IMNCIFormFields } from './FacilityForms.jsx'; 

// ... (Keep EENC_TEST_QUESTIONS and ICCM_TEST_QUESTIONS constants as they are)
export const EENC_TEST_QUESTIONS = [
    { id: 'q1', text: '1. Delivering in the supine position during second stage of labour is best.', type: 'mc', options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], correctAnswer: 'b' },
    { id: 'q2', text: '2. Applying fundal pressure (pushing down on the top of the uterus) is an effective means of supporting labour.', type: 'mc', options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], correctAnswer: 'b' },
    { id: 'q3', text: '3. After a baby is born, you should call out the time of birth (accurate to minute and second), then what?', type: 'mc', options: [{ id: 'a', text: 'Clamp and cut the cord.' }, { id: 'b', text: 'Thoroughly dry the baby.' }, { id: 'c', text: 'Suction the baby’s mouth and nose.' }, { id: 'd', text: 'Hold the baby upside-down to let out the secretion' }], correctAnswer: 'b' },
    { id: 'q4', text: '4. During thorough drying and stimulation of the baby, your rapid assessment shows she is crying. What is your next action?', type: 'mc', options: [{ id: 'a', text: 'Suction the baby’s mouth and nose.' }, { id: 'b', text: 'Clamp and cut the cord.' }, { id: 'c', text: 'Place the baby in skin-to-skin contact with the mother.' }, { id: 'd', text: 'Place the baby onto the breast.' }], correctAnswer: 'c' },
    { id: 'q5', text: '5. For which reason(s)should the baby’s mouth and nose be suctioned after thorough drying?', type: 'mc', options: [{ id: 'a', text: 'The baby is breathing and the amniotic fluid is thickly stained with meconium and the baby is covered in meconium.' }, { id: 'b', text: 'The baby is not breathing and the amniotic fluid is thickly stained with meconium and the baby is covered in meconium.' }, { id: 'c', text: 'The baby is not breathing and there is no airway obstruction visible.' }, { id: 'd', text: 'All of the above.' }], correctAnswer: 'b' },
    { id: 'q6', text: '6. A baby has feeding cues indicating she is ready to breast feed immediately after birth.', type: 'mc', options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], correctAnswer: 'a' },
    { id: 'q7', text: '7. What is the approximate capacity of a newborn\'s stomach? Circle A, B, C or D.', type: 'mc', imageSrc: '/eenc-q7.jpg', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' }], correctAnswer: 'd' },
    { id: 'q8', text: '8. List 3 signs a newborn baby is ready to breast feed (“feeding cues”).', type: 'open', lines: 3 },
    { id: 'q9', text: '9. List 3 signs a baby has good attachment to the breast.', type: 'open', lines: 3 },
    { id: 'q10', text: '10. List 3 things you should do to improve bag-and-mask ventilation.', type: 'open', lines: 3 },
    { id: 'q11', text: '11. When does a baby need bag-and-mask ventilation? After thorough drying for 30 seconds, the baby is:', type: 'mc', options: [{ id: 'a', text: 'Not breathing.' }, { id: 'b', text: 'Having difficulty breathing (gas ping respirations).' }, { id: 'c', text: 'Breathing but limp and very pale or blue in colour.' }, { id: 'd', text: 'All of the above.' }], correctAnswer: 'd' },
    { id: 'q12', text: '12. A baby required bag-and-mask ventilation for 2 minutes. You have stopped bag-and-mask ventilation. He is now crying, breathing without difficulty, pink, and the heart rate is > 100 beats per minute. What should you do now?', type: 'mc', options: [{ id: 'a', text: 'Place the baby in direct skin-to-skin contact with the mother/do routine newborn care.' }, { id: 'b', text: 'Move the baby to an observational area and monitor breathing every 10 minutes.' }, { id: 'c', text: 'Give oxygen by nasal cannula or mask.' }, { id: 'd', text: 'Do all of the above' }], correctAnswer: 'a' }
];

export const ICCM_TEST_QUESTIONS = [
    { id: 'q1', text: '1. أي من الآتي علامة خطر تستوجب تحويلا عاجلا للمستشفى؟', type: 'mc', options: [{ id: 'a', text: 'حرارة خفيفة يوم واحد' }, { id: 'b', text: 'عدم القدرة على الشرب أو الرضاعة' }, { id: 'c', text: 'رشح بسيط' }, { id: 'd', text: 'سعال الثلاثة أيام' }], correctAnswer: 'b' },
    { id: 'q2', text: '2. التشنجات أثناء المرض الحالي تتطلب', type: 'mc', options: [{ id: 'a', text: 'علاج منزلي' }, { id: 'b', text: 'متابعة بعد يومين' }, { id: 'c', text: 'تحويل فوري' }], correctAnswer: 'c' },
    { id: 'q3', text: '3. عد التنفس يكون لمدة:', type: 'mc', options: [{ id: 'a', text: '15 ثانية' }, { id: 'b', text: '30 ثانية' }, { id: 'c', text: '60 ثانية' }], correctAnswer: 'c' },
    { id: 'q4', text: '4. تنفس سريع لطفل عمر 12 شهرًا هو على الأقل:', type: 'mc', options: [{ id: 'a', text: '40 نفس لكل دقيقة' }, { id: 'b', text: '50 نفس لكل دقيقة' }, { id: 'c', text: '60 نفس لكل دقيقة' }], correctAnswer: 'b' },
    { id: 'q5', text: '5. في الإسهال، أول قاعدة علاج منزلي', type: 'mc', options: [{ id: 'a', text: 'إيقاف السوائل' }, { id: 'b', text: 'زيادة السوائل بما فيها محلول معالجة الجفاف (محلول الارواء)' }, { id: 'c', text: 'مضاد حيوي' }], correctAnswer: 'b' },
    { id: 'q6', text: '6. الهدف من محلول معالجة الجفاف (ملح الارواء):', type: 'mc', options: [{ id: 'a', text: 'تقليل الحرارة' }, { id: 'b', text: 'تعويض الماء والأملاح المفقودة' }, { id: 'c', text: 'فتح الشهية' }], correctAnswer: 'b' },
    { id: 'q7', text: '7. طريقة إعطاء محلول معالجة الجفاف ملح الارواء) إذا تقiأ الطفل :', type: 'mc', options: [{ id: 'a', text: 'التوقف تماما' }, { id: 'b', text: 'كميات صغيرة متكررة بعد 5-10 دقائق' }, { id: 'c', text: 'جرعات كبيرة' }], correctAnswer: 'b' },
    { id: 'q8', text: '8. يعطى الزنك لكل الأطفال المصابين بالاسهال', type: 'mc', options: [{ id: 'a', text: 'حتى زوال الاسهال' }, { id: 'b', text: 'مدة 3 أيام' }, { id: 'c', text: 'مدة 10 ايام' }], correctAnswer: 'c' },
    { id: 'q9', text: '9. نتيجة اختبار الملاريا السريع إيجابي مع حمى دون علامات خطر تُصنف :', type: 'mc', options: [{ id: 'a', text: 'علاج منزلي باعطاء حبوب الكوارتم' }, { id: 'b', text: 'تحويل فوري' }, { id: 'c', text: 'لا يحتاج علاج' }], correctAnswer: 'a' },
    { id: 'q10', text: '10. عند تقiؤ جرعة الكوارتم خلال ساعة', type: 'mc', options: [{ id: 'a', text: 'لا يحتاج إعادة الجرعة' }, { id: 'b', text: 'تكرار نفس الجرعة' }, { id: 'c', 'زيادة الجرعة للضعف': 'زيادة الجرعة للضعف' }], correctAnswer: 'b' },
    { id: 'q11', text: '11. قراءة المواك حمراء تعني :', type: 'mc', options: [{ id: 'a', text: 'سوء تغذية متوسط' }, { id: 'b', text: 'لا توجد سوء تغذية' }, { id: 'c', 'سوء تغذية شديد وتحويل': 'سوء تغذية شديد وتحويل' }], correctAnswer: 'c' },
    { id: 'q12', text: '12. وذمة (ورم) القدمين الثنائية بعد ضغط الإبهام تشير إلى:', type: 'mc', options: [{ id: 'a', text: 'سوء تغذية شديد يحتاج علاج بالمنزل' }, { id: 'b', text: 'سوء تغذية شديد يحتاج تحويل عاجل الى المستشفى' }], correctAnswer: 'b' },
    { id: 'q13', text: '13. قبل تحويل طفل لديه علامة خطر ويستطيع الشرب', type: 'mc', options: [{ id: 'a', text: 'التجويل العاجل مع إعطاء ادوية ما قبل التحويل' }, { id: 'b', text: 'تحويل عاجل' }], correctAnswer: 'a' },
    { id: 'q14', text: '14. المتابعة لطفل كحة وتنفس سريع بعد بدء الأموكسيسيلين تكون بعد:', type: 'mc', options: [{ id: 'a', text: 'يومين' }, { id: 'b', text: 'أسبوع' }, { id: 'c', 'لا حاجة': 'لا حاجة' }], correctAnswer: 'a' },
    { id: 'q15', text: '15. أي من العلامات التالية تعتبر علامة خطورة للطفل حديث الولادة', type: 'mc', options: [{ id: 'a', text: 'درجة حرارة اقل من 35.5' }, { id: 'b', text: 'إسهال' }], correctAnswer: 'a' }
];

const initializeAnswers = (questions) => {
    const initialAnswers = {};
    questions.forEach(q => {
        if (q.type === 'open') {
            initialAnswers[q.id] = Array(q.lines).fill(''); 
        } else {
            initialAnswers[q.id] = ''; 
        }
    });
    return initialAnswers;
};

const TestResultScreen = ({ 
    participantName, testType, score, total, percentage, onBack, 
    canManageTests, onEdit, onDelete, isExistingResult 
}) => {
    const percent = percentage.toFixed(1);
    const scoreClass = percent >= 80 ? 'text-green-600' : percent >= 60 ? 'text-yellow-600' : 'text-red-600';

    return (
        <Card>
            <div className="p-6 text-center">
                <PageHeader title="Test Result" subtitle={`Score for ${participantName} (${testType})`} />
                {isExistingResult && (
                    <div className="mb-6 p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-200 inline-block">
                        You already solved the test.
                    </div>
                )}
                <div className="my-8">
                    <div className={`text-6xl font-bold ${scoreClass}`}>{percent}%</div>
                    <div className="text-xl text-gray-700 mt-2">({score} / {total} Correct)</div>
                    <p className="text-sm text-gray-500 mt-4">Note: Score only includes multiple-choice questions.</p>
                </div>
                <div className="flex justify-center gap-3">
                    <Button variant="secondary" onClick={onBack}>Back</Button>
                    {canManageTests && (
                        <>
                            <Button variant="primary" onClick={onEdit}>Edit Test</Button>
                            <Button variant="danger" onClick={onDelete}>Delete Test</Button>
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
};

const SearchableSelect = ({ options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const selectedOption = options.find(opt => opt.id === value);
        setInputValue(selectedOption ? selectedOption.name : '');
    }, [value, options]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
                const selectedOption = options.find(opt => opt.id === value);
                setInputValue(selectedOption ? selectedOption.name : '');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref, value, options]);

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        const selectedOption = options.find(opt => opt.id === value);
        if (selectedOption && selectedOption.name === inputValue) return options;
        if (value === 'addNewFacility' && options[0]?.id === 'addNewFacility') {
             return options.filter(opt => opt.id === 'addNewFacility' || opt.name.toLowerCase().includes(inputValue.toLowerCase()));
        }
        return options.filter(opt => opt.name.toLowerCase().includes(inputValue.toLowerCase()));
    }, [options, inputValue, value]);

    const handleSelect = (option) => {
        onChange(option.id);
        setInputValue(option.name);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={ref}>
            <Input
                type="text"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    setIsOpen(true);
                    if (e.target.value === '') onChange('');
                }}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
            />
            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <div
                                key={opt.id}
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${opt.id === 'addNewFacility' ? 'font-bold text-sky-600 bg-sky-50' : ''}`}
                                onClick={() => handleSelect(opt)}
                            >
                                {opt.name}
                            </div>
                        ))
                    ) : (
                         inputValue && options[0]?.id === 'addNewFacility' ? (
                            <div
                                key={options[0].id}
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${options[0].id === 'addNewFacility' ? 'font-bold text-sky-600 bg-sky-50' : ''}`}
                                onClick={() => handleSelect(options[0])}
                            >
                                {options[0].name}
                            </div>
                         ) : ( <div className="p-2 text-gray-500">No results found.</div> )
                    )}
                </div>
            )}
        </div>
    );
};

const AddFacilityModal = ({ isOpen, onClose, onSaveSuccess, initialState, initialLocality, initialName = '', setToast }) => {
    const [isSubmitting, setIsSubmitting] =useState(false);
    const facilityInitialData = useMemo(() => ({
        'الولاية': initialState || '',
        'المحلية': initialLocality || '',
        'اسم_المؤسسة': initialName || '',
        'هل_المؤسسة_تعمل': 'Yes',
        'date_of_visit': new Date().toISOString().split('T')[0],
        'وجود_العلاج_المتكامل_لامراض_الطفولة': 'No',
        'وجود_سجل_علاج_متكامل': 'No',
        'وجود_كتيب_لوحات': 'No',
        'ميزان_وزن': 'No',
        'ميزان_طول': 'No',
        'ميزان_حرارة': 'No',
        'ساعة_مؤقت': 'No',
        'غرفة_إرواء': 'No',
        'immunization_office_exists': 'No',
        'nutrition_center_exists': 'No',
        'growth_monitoring_service_exists': 'No',
        'imnci_staff': [],
    }), [initialState, initialLocality, initialName]);

    const handleSaveFacility = async (formData) => {
        setIsSubmitting(true);
        try {
            const submitterIdentifier = 'Participant Form - New Facility';
            const { id, ...dataToSubmit } = formData;
            if (!dataToSubmit['اسم_المؤسسة'] || !dataToSubmit['الولاية'] || !dataToSubmit['المحلية']) {
                throw new Error("Facility Name, State, and Locality are required.");
            }
             dataToSubmit.imnci_staff = Array.isArray(dataToSubmit.imnci_staff) ? dataToSubmit.imnci_staff : [];
            await submitFacilityDataForApproval(dataToSubmit, submitterIdentifier);
            if (setToast) setToast({ show: true, message: "New facility submitted for approval.", type: 'info' });
            onSaveSuccess({ id: `pending_${Date.now()}`, ...dataToSubmit });
            onClose();
        } catch (error) {
            console.error("Failed to submit new facility:", error);
            if (setToast) setToast({ show: true, message: `Error submitting facility: ${error.message}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Health Facility">
             <div className="p-1 max-h-[80vh] overflow-y-auto">
                <GenericFacilityForm
                    initialData={facilityInitialData}
                    onSave={handleSaveFacility}
                    onCancel={onClose}
                    setToast={setToast}
                    title="بيانات المنشأة الصحية الجديدة"
                    subtitle={`Adding a new facility in ${STATE_LOCALITIES[initialState]?.ar || initialState}, ${STATE_LOCALITIES[initialState]?.localities.find(l=>l.en === initialLocality)?.ar || initialLocality}`}
                    isPublicForm={false}
                    saveButtonText="Submit New Facility for Approval"
                    isSubmitting={isSubmitting}
                >
                    {(props) => <IMNCIFormFields {...props} />}
                </GenericFacilityForm>
            </div>
        </Modal>
    );
};

export function CourseTestForm({ 
    course, 
    participants, 
    participantTests, 
    onSave, 
    onCancel, 
    initialParticipantId = '',
    onSaveTest,
    onSaveParticipant, 
    isPublicView = false,
    canManageTests = false 
}) {
    const { testQuestions, testTitle, isRtl, jobTitleOptions, isIccm } = useMemo(() => {
        let titles = [];
        let isIccm = false;
        if (course.course_type === 'ICCM') {
            titles = ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
            isIccm = true;
            return { testQuestions: ICCM_TEST_QUESTIONS, testTitle: 'ICCM Pre/Post Test Entry', isRtl: true, jobTitleOptions: titles, isIccm: isIccm };
        }
        if (course.course_type === 'EENC') {
            titles = JOB_TITLES_EENC;
            return { testQuestions: EENC_TEST_QUESTIONS, testTitle: 'EENC Pre/Post Test Entry', isRtl: false, jobTitleOptions: titles, isIccm: isIccm };
        }
        return { testQuestions: [], testTitle: 'Test Entry', isRtl: false, jobTitleOptions: [], isIccm: false }; 
    }, [course.course_type]);

    const [selectedParticipantId, setSelectedParticipantId] = useState(initialParticipantId);
    const [testType, setTestType] = useState(isPublicView ? '' : 'pre-test'); 
    const [answers, setAnswers] = useState(() => initializeAnswers(testQuestions));
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [submissionResult, setSubmissionResult] = useState(null);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(true); 
    const [selectedSetupGroup, setSelectedSetupGroup] = useState(''); 
    const [isEditing, setIsEditing] = useState(false);
    const [isNewParticipantModalOpen, setIsNewParticipantModalOpen] = useState(false);
    const [localParticipants, setLocalParticipants] = useState(participants);

    useEffect(() => { setLocalParticipants(participants); }, [participants]);

    const uniqueGroups = useMemo(() => {
        const groupSet = new Set(localParticipants.map(p => p.group).filter(Boolean));
        return Array.from(groupSet).sort();
    }, [localParticipants]);

    const sortedParticipants = useMemo(() => {
        return [...localParticipants].sort((a, b) => a.name.localeCompare(b.name));
    }, [localParticipants]);

    const filteredSetupParticipants = useMemo(() => {
        let filtered = sortedParticipants;
        if (selectedSetupGroup) filtered = filtered.filter(p => p.group === selectedSetupGroup);
        return filtered;
    }, [sortedParticipants, selectedSetupGroup]);

    const [newParticipantState, setNewParticipantState] = useState(course.state || '');
    const [newParticipantLocality, setNewParticipantLocality] = useState(course.locality || '');
    const [newParticipantCenter, setNewParticipantCenter] = useState('');
    const [selectedFacilityId, setSelectedFacilityId] = useState(null);
    const [facilitiesInLocality, setFacilitiesInLocality] = useState([]);
    const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
    const [isAddFacilityModalOpen, setIsAddFacilityModalOpen] = useState(false);
    const [newParticipantName, setNewParticipantName] = useState('');
    const [newParticipantPhone, setNewParticipantPhone] = useState('');
    const [newParticipantGroup, setNewParticipantGroup] = useState('Group A');
    const [newParticipantJob, setNewParticipantJob] = useState('');
    const [newParticipantJobOther, setNewParticipantJobOther] = useState('');
    const [isParticipantInfoSaved, setIsParticipantInfoSaved] = useState(false);
    const [participantNameForDisplay, setParticipantNameForDisplay] = useState('');
    
    const existingResults = useMemo(() => {
        const results = { 'pre-test': null, 'post-test': null };
        if (!selectedParticipantId || !participantTests) return results;
        for (const test of participantTests) {
            if (test.participantId === selectedParticipantId) {
                if (test.testType === 'pre-test') results['pre-test'] = test; 
                if (test.testType === 'post-test') results['post-test'] = test; 
            }
        }
        return results;
    }, [selectedParticipantId, participantTests]);

    useEffect(() => {
        if (!isPublicView && selectedParticipantId && selectedParticipantId !== 'addNew') {
            const hasPreTest = !!existingResults['pre-test'];
            const hasPostTest = !!existingResults['post-test'];
            if (!hasPreTest) setTestType('pre-test'); 
            else if (!hasPostTest) setTestType('post-test'); 
            else setTestType('pre-test'); 
        }
    }, [isPublicView, selectedParticipantId, existingResults]);

    useEffect(() => {
        if (!isEditing) {
            setAnswers(initializeAnswers(testQuestions));
        }
        setError('');
        setSubmissionResult(null); 
        if (!isEditing) setIsEditing(false);
    }, [selectedParticipantId, testType, testQuestions]); 

    useEffect(() => {
        setIsParticipantInfoSaved(false); 
        setParticipantNameForDisplay(''); 
        setNewParticipantName(''); setNewParticipantPhone(''); setNewParticipantState(course.state || ''); setNewParticipantLocality(course.locality || ''); setNewParticipantCenter(''); setSelectedFacilityId(null); setFacilitiesInLocality([]); setNewParticipantGroup('Group A'); setNewParticipantJob(''); setNewParticipantJobOther('');
        setIsEditing(false);
    }, [testType, isPublicView, course.state, course.locality]); 

    useEffect(() => {
        const fetchFacilities = async () => {
            setError('');
            if (newParticipantState && newParticipantLocality && !isIccm) {
                setIsLoadingFacilities(true);
                try {
                    const facilities = await listHealthFacilities({ state: newParticipantState, locality: newParticipantLocality }, 'server');
                    setFacilitiesInLocality(facilities);
                } catch (err) { setError("Failed to load health facilities."); setFacilitiesInLocality([]); } finally { setIsLoadingFacilities(false); }
            } else { setFacilitiesInLocality([]); setIsLoadingFacilities(false); }
        };
        if (isNewParticipantModalOpen) fetchFacilities();
    }, [newParticipantState, newParticipantLocality, isIccm, isNewParticipantModalOpen]);

    useEffect(() => {
        if (selectedParticipantId && selectedParticipantId !== 'addNew') {
            const participant = localParticipants.find(p => p.id === selectedParticipantId);
            if (participant) setParticipantNameForDisplay(participant.name);
        }
    }, [selectedParticipantId, localParticipants]);

    const handleSetupGroupChange = (e) => {
        setSelectedSetupGroup(e.target.value);
        setSelectedParticipantId(''); 
    };

    const handleParticipantSelectChange = (e) => {
        const val = e.target.value;
        if (val === 'addNew') {
            setIsNewParticipantModalOpen(true);
            setSelectedParticipantId(''); 
        } else {
            setSelectedParticipantId(val);
        }
    };

    const handleRadioChange = (questionId, answerId) => {
        setAnswers(prev => ({ ...prev, [questionId]: answerId }));
    };

    const handleTextChange = (questionId, lineIndex, textValue) => {
        setAnswers(prev => ({ ...prev, [questionId]: prev[questionId].map((item, i) => (i === lineIndex ? textValue : item)) }));
    };

    const handleFacilitySelect = (facilityIdOrAction) => {
        setError('');
        if (facilityIdOrAction === 'addNewFacility') { setIsAddFacilityModalOpen(true); return; }
        const facility = facilitiesInLocality.find(f => f.id === facilityIdOrAction);
        setSelectedFacilityId(facility ? facility.id : null);
        setNewParticipantCenter(facility ? facility['اسم_المؤسسة'] : '');
    };

    const handleNewFacilitySaved = (newlySubmittedFacilityData) => {
        const representation = { id: newlySubmittedFacilityData.id, 'اسم_المؤسسة': newlySubmittedFacilityData['اسم_المؤسسة'] };
        setFacilitiesInLocality(prev => [...prev, representation]);
        setSelectedFacilityId(representation.id);
        setNewParticipantCenter(representation['اسم_المؤسسة']);
        setIsAddFacilityModalOpen(false); 
    };
    
    const facilityOptionsForSelect = useMemo(() => {
        if (isIccm) return [];
        const options = (facilitiesInLocality || []).map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }));
        options.unshift({ id: 'addNewFacility', name: "+ Add New Facility..." });
        return options;
    }, [facilitiesInLocality, isIccm]);

    const handleSaveParticipantInfo = async () => {
        if (!onSaveParticipant) { setError("Participant saving function is not provided."); return; }
        setError(''); setIsSaving(true);
        try {
            const finalJobTitle = newParticipantJob === 'Other' ? newParticipantJobOther : newParticipantJob;
            const centerNameLabel = isIccm ? 'Village Name' : 'Facility Name';
            if (!newParticipantState) throw new Error('State is required.');
            if (!newParticipantLocality) throw new Error('Locality is required.');
            if (!newParticipantCenter.trim()) throw new Error(`${centerNameLabel} is required.`);
            if (!newParticipantName.trim()) throw new Error('New Participant Name is required.');
            if (!finalJobTitle) throw new Error('New Participant Job Title is required.');
            if (!newParticipantPhone.trim()) throw new Error('New Participant Phone Number is required.');
            
            const participantPayload = {
                name: newParticipantName.trim(),
                phone: newParticipantPhone.trim(),
                job_title: finalJobTitle,
                group: newParticipantGroup,
                state: newParticipantState, 
                locality: newParticipantLocality, 
                center_name: newParticipantCenter.trim(),
                courseId: course.id,
                facilityId: (isIccm || (selectedFacilityId && selectedFacilityId.startsWith('pending_'))) ? null : selectedFacilityId,
                ...(isIccm && { trained_before: false, last_imci_training: null, nearest_health_facility: null, hours_to_facility: null })
            };
            
            const newParticipant = await onSaveParticipant(participantPayload, null);
            setLocalParticipants(prev => [...prev, newParticipant]);
            setSelectedParticipantId(newParticipant.id); 
            setParticipantNameForDisplay(newParticipant.name); 
            setIsParticipantInfoSaved(true); 
            setIsNewParticipantModalOpen(false);
            setIsSetupModalOpen(false);
        } catch (err) { setError(`Failed to save participant: ${err.message}`); } finally { setIsSaving(false); }
    };

    const handleEditTest = () => {
        const resultToEdit = existingResults[testType];
        if (resultToEdit) {
            setAnswers(resultToEdit.answers || initializeAnswers(testQuestions));
            setIsEditing(true);
        }
    };

    const handleDeleteTest = async () => {
        if (!window.confirm("Are you sure you want to delete this test record?")) return;
        setIsSaving(true);
        try {
            await deleteParticipantTest(course.id, selectedParticipantId, testType);
            const refreshPayload = { participantId: selectedParticipantId, deleted: true };
            if (onSaveTest) await onSaveTest(refreshPayload); else onSave(refreshPayload);
            setIsEditing(false);
            setIsSetupModalOpen(true);
            setSelectedParticipantId('');
        } catch (err) { setError(`Failed to delete test: ${err.message}`); } finally { setIsSaving(false); }
    };

    const handleSubmit = async () => {
        setError('');
        if (!selectedParticipantId) { setError('A participant must be selected or saved before submitting the test.'); return; }
        const mcQuestions = testQuestions.filter(q => q.type === 'mc');
        const unanswered = mcQuestions.filter(q => !answers[q.id]);
        if (unanswered.length > 0) { setError(`Please answer all multiple-choice questions.`); return; }
        setIsSaving(true);
        try {
            const scorableQuestions = testQuestions.filter(q => q.type === 'mc');
            let score = 0;
            scorableQuestions.forEach(q => { if (answers[q.id] === q.correctAnswer) score++; });
            const total = scorableQuestions.length;
            const percentage = total > 0 ? (score / total) * 100 : 0;
            const payload = {
                participantId: selectedParticipantId, 
                participantName: participantNameForDisplay, 
                courseId: course.id,
                courseType: course.course_type,
                testType: testType,
                answers: answers, 
                score: score,
                total: total,
                percentage: percentage,
                submittedAt: new Date().toISOString()
            };
            if (onSaveTest) await onSaveTest(payload); else await new Promise(resolve => setTimeout(resolve, 1000));
            setSubmissionResult(payload); 
            setIsEditing(false); 
        } catch (err) { setError(`Failed to save test: ${err.message}`); } finally { setIsSaving(false); }
    };

    const handleCancelForm = () => {
        if (isEditing) { setIsEditing(false); } else {
            setIsSetupModalOpen(true);
            setTestType(isPublicView ? '' : 'pre-test'); 
            setSelectedParticipantId('');
            setSelectedSetupGroup('');
        }
    }

    // --- RENDER LOGIC ---
    
    if (submissionResult) {
        return (
            <TestResultScreen
                participantName={submissionResult.participantName}
                testType={submissionResult.testType}
                score={submissionResult.score}
                total={submissionResult.total}
                percentage={submissionResult.percentage}
                onBack={() => { setSubmissionResult(null); setIsSetupModalOpen(true); setSelectedParticipantId(''); onSave(submissionResult); }}
                canManageTests={canManageTests}
                onEdit={() => { setSubmissionResult(null); setIsEditing(true); }}
                onDelete={handleDeleteTest}
            />
        );
    }
    
    const existingTestResult = existingResults[testType];
    if (!isSetupModalOpen && existingTestResult && !isNewParticipantModalOpen && !isEditing) {
        const participantName = localParticipants.find(p => p.id === existingTestResult.participantId)?.name || 'Participant';
        return (
            <TestResultScreen
                participantName={participantName}
                testType={existingTestResult.testType}
                score={existingTestResult.score}
                total={existingTestResult.total}
                percentage={existingTestResult.percentage}
                onBack={() => { setIsSetupModalOpen(true); setSelectedParticipantId(''); }}
                canManageTests={canManageTests}
                onEdit={handleEditTest}
                onDelete={handleDeleteTest}
                isExistingResult={true} 
            />
        );
    }

    const hasPreTest = !!existingResults['pre-test'];
    const hasPostTest = !!existingResults['post-test'];
    if (testQuestions.length === 0) return <Card><div className="p-6">No questions</div></Card>;
    const centerNameLabel = isIccm ? "Village Name" : "Facility Name";
    const showQuestions = !isSetupModalOpen; 
    const submitDisabled = isSaving || !showQuestions;

    return (
        <Card>
            <AddFacilityModal
                isOpen={isAddFacilityModalOpen}
                onClose={() => setIsAddFacilityModalOpen(false)}
                onSaveSuccess={handleNewFacilitySaved}
                initialState={newParticipantState}
                initialLocality={newParticipantLocality}
                initialName={newParticipantCenter} 
                setToast={(toastConfig) => setError(toastConfig.message)} 
            />

            <Modal isOpen={isSetupModalOpen && !isNewParticipantModalOpen} onClose={onCancel} title="Select Test" size="lg">
                <CardBody className="p-6">
                    <div className="grid gap-6">
                        <FormGroup label="Select Test Type">
                            <Select value={testType} onChange={(e) => setTestType(e.target.value)}>
                                <option value="">-- Select Test Type --</option>
                                <option value="pre-test">Pre-Test</option>
                                <option value="post-test">Post-Test</option>
                            </Select>
                        </FormGroup>

                        {((isPublicView && testType) || !isPublicView) && (
                            <>
                                <FormGroup label="Select Group (Optional)">
                                    <Select value={selectedSetupGroup} onChange={handleSetupGroupChange}>
                                        <option value="">-- All Groups --</option>
                                        {uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}
                                    </Select>
                                </FormGroup>

                                <FormGroup label="Select Participant">
                                    <Select value={selectedParticipantId} onChange={handleParticipantSelectChange}>
                                        <option value="">-- Select a Participant --</option>
                                        {/* Only show Add New if onSaveParticipant exists AND testType is pre-test */}
                                        {onSaveParticipant && testType === 'pre-test' && (
                                            <option value="addNew" className="font-bold text-sky-600">
                                                + Register New Participant
                                            </option>
                                        )}
                                        {filteredSetupParticipants.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.group})</option>
                                        ))}
                                    </Select>
                                </FormGroup>
                            </>
                        )}
                    </div>
                </CardBody>
                <CardFooter className="p-4 border-t flex justify-end gap-3">
                    <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button onClick={() => setIsSetupModalOpen(false)} disabled={!testType || !selectedParticipantId}>Start</Button>
                </CardFooter>
            </Modal>

            <Modal isOpen={isNewParticipantModalOpen} onClose={() => setIsNewParticipantModalOpen(false)} title="Register New Participant" size="2xl">
                 <div className="p-4 border-b">
                     <h3 className="text-lg font-medium">New Participant Information</h3>
                     <p className="text-sm text-gray-500">Please fill out the details below.</p>
                 </div>
                 <CardBody className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}>
                            <FormGroup label="State">
                                <Select value={newParticipantState} onChange={(e) => {
                                    setNewParticipantState(e.target.value); setNewParticipantLocality(''); setNewParticipantCenter(''); setSelectedFacilityId(null); setFacilitiesInLocality([]); 
                                }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort((a,b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}</Select>
                            </FormGroup>
                            <FormGroup label="Locality">
                                <Select value={newParticipantLocality} onChange={(e) => { setNewParticipantLocality(e.target.value); setNewParticipantCenter(''); setSelectedFacilityId(null); }} disabled={!newParticipantState}>
                                    <option value="">— Select Locality —</option>{(STATE_LOCALITIES[newParticipantState]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}</Select>
                            </FormGroup>
                             <FormGroup label="Group">
                                <Select value={newParticipantGroup} onChange={(e) => setNewParticipantGroup(e.target.value)}><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select>
                            </FormGroup>
                            {isIccm ? (
                                <FormGroup label={centerNameLabel}><Input value={newParticipantCenter} onChange={(e) => setNewParticipantCenter(e.target.value)} placeholder={`Enter ${centerNameLabel}`} disabled={!newParticipantLocality} /></FormGroup>
                            ) : (
                                <FormGroup label={centerNameLabel}><SearchableSelect value={selectedFacilityId} onChange={handleFacilitySelect} options={facilityOptionsForSelect} placeholder={isLoadingFacilities ? "Loading..." : (!newParticipantLocality ? "Select Locality first" : "Search or Add New Facility...")} disabled={isLoadingFacilities || !newParticipantLocality} /></FormGroup>
                            )}
                            <FormGroup label="Participant Name"><Input value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="Enter name" /></FormGroup>
                            <FormGroup label="Phone Number"><Input type="tel" value={newParticipantPhone} onChange={(e) => setNewParticipantPhone(e.target.value)} /></FormGroup>
                            <FormGroup label="Job Title"><Select value={newParticipantJob} onChange={(e) => setNewParticipantJob(e.target.value)}><option value="">— Select Job —</option>{jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}<option value="Other">Other</option></Select></FormGroup>
                            {newParticipantJob === 'Other' && (<FormGroup label="Specify Job Title"><Input value={newParticipantJobOther} onChange={(e) => setNewParticipantJobOther(e.target.value)} placeholder="Please specify" /></FormGroup>)}
                        </div>
                 </CardBody>
                 <CardFooter className="p-4 border-t flex justify-end gap-3">
                     <Button variant="secondary" onClick={() => setIsNewParticipantModalOpen(false)} disabled={isSaving}>Cancel</Button>
                     <Button onClick={handleSaveParticipantInfo} disabled={isSaving}>{isSaving ? <Spinner /> : "Save Participant"}</Button>
                 </CardFooter>
            </Modal>

            {!isSetupModalOpen && (
                <div className="p-6">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                        <PageHeader title={testTitle} subtitle={`Course: ${course.state} / ${course.locality} [${course.start_date}]`} className="p-0 m-0" />
                        <div><Button variant="secondary" onClick={() => { const link = `${window.location.origin}/public/test/course/${course.id}`; navigator.clipboard.writeText(link).then(() => alert('Link copied!')).catch(() => alert('Failed to copy.')); }} title="Copy link">Share Test Form</Button></div>
                    </div>
                    
                    {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

                    {/* Fallback Dropdowns (Required if user refreshes/cancels back to form without modal) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                        {isPublicView && (
                            <FormGroup label="Select Test Type">
                                <Select value={testType} onChange={(e) => setTestType(e.target.value)}>
                                    <option value="">-- Select Test Type --</option>
                                    <option value="pre-test">Pre-Test</option>
                                    <option value="post-test">Post-Test</option>
                                </Select>
                            </FormGroup>
                        )}
                        {(!isPublicView || (isPublicView && testType)) && (
                             <FormGroup label="Select Participant">
                                <Select value={selectedParticipantId} onChange={handleParticipantSelectChange} disabled={isEditing || (isPublicView && !testType)}>
                                    <option value="">-- Select a Participant --</option>
                                    {onSaveParticipant && !isEditing && testType === 'pre-test' && (
                                        <option value="addNew" className="font-bold text-sky-600">+ Register New Participant</option>
                                    )}
                                    {sortedParticipants.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.group})</option>))}
                                </Select>
                            </FormGroup>
                        )}
                        {!isPublicView && (
                            <FormGroup label="Select Test Type">
                                <Select value={testType} onChange={(e) => setTestType(e.target.value)} disabled={!selectedParticipantId || (hasPreTest && hasPostTest && !isEditing) || isEditing}>
                                    <option value="pre-test" disabled={hasPreTest && !isEditing}>Pre-Test {hasPreTest && !isEditing && "(Completed)"}</option>
                                    <option value="post-test" disabled={hasPostTest && !isEditing}>Post-Test {hasPostTest && !isEditing && "(Completed)"}</option>
                                </Select>
                            </FormGroup>
                        )}
                    </div>

                    <hr className="my-6" />

                    <fieldset disabled={isSaving}>
                        <legend className="text-xl font-semibold mb-4 text-gray-800">Test Questions</legend>
                        {isEditing && <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 mb-4 rounded-md font-semibold">Editing existing {testType} submission.</div>}
                        <div className="space-y-6" style={{ direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}>
                            {testQuestions.map((q) => (
                                <div key={q.id} className="p-4 border rounded-md shadow-sm bg-white">
                                    <label className="block text-base font-semibold text-gray-800 mb-3">{q.text}</label>
                                    {q.imageSrc && <div className="my-3"><img src={q.imageSrc} alt="Visual" className="max-w-full h-auto rounded-lg border border-gray-200" /></div>}
                                    {q.type === 'mc' && (<div className="flex flex-col gap-2 mt-2">{q.options.map(opt => (<label key={opt.id} className="flex items-center gap-3 p-2 rounded hover:bg-sky-50 cursor-pointer"><input type="radio" name={q.id} value={opt.id} checked={answers[q.id] === opt.id} onChange={() => handleRadioChange(q.id, opt.id)} className="w-4 h-4" /><span className="text-sm text-gray-700">{opt.text}</span></label>))}</div>)}
                                    {q.type === 'open' && (<div className="flex flex-col gap-2 mt-2">{Array.from({ length: q.lines }).map((_, index) => (<Input key={index} type="text" placeholder={`Answer ${index + 1}...`} value={answers[q.id]?.[index] || ''} onChange={(e) => handleTextChange(q.id, index, e.target.value)} className="w-full" />))}</div>)}
                                    {q.type === 'unsupported' && (<div className="p-3 text-sm text-gray-500 bg-gray-100 rounded-md">Unsupported question type.</div>)}
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    <div className="flex gap-2 justify-end mt-8 border-t pt-6">
                        <Button variant="secondary" onClick={handleCancelForm} disabled={isSaving}>{isEditing ? "Cancel Edit" : "Cancel"}</Button>
                        <Button onClick={handleSubmit} disabled={submitDisabled}>{isSaving ? <Spinner /> : (isEditing ? 'Update Score' : 'Submit & View Score')}</Button>
                    </div>
                </div>
            )}
        </Card>
    );
}