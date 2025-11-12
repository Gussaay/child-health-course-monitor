// CourseTestForm.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner, Input, Modal, CardBody, CardFooter
} from "./CommonComponents"; // Assuming CommonComponents are available
// --- NEW: Import constants and data functions ---
import {
    JOB_TITLES_ETAT, JOB_TITLES_EENC, STATE_LOCALITIES
} from './constants.js';
import {
    listHealthFacilities,
    submitFacilityDataForApproval
} from '../data.js';
import { GenericFacilityForm, IMNCIFormFields } from './FacilityForms.jsx'; // For the modal

/**
 * Define the questions for the EENC Pre/Post Test.
 * (Test questions array is unchanged)
 */
export const EENC_TEST_QUESTIONS = [
    {
        id: 'q1',
        text: '1. Delivering in the supine position during second stage of labour is best.',
        type: 'mc',
        options: [
            { id: 'a', text: 'True' },
            { id: 'b', text: 'False' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q2',
        text: '2. Applying fundal pressure (pushing down on the top of the uterus) is an effective means of supporting labour.',
        type: 'mc',
        options: [
            { id: 'a', text: 'True' },
            { id: 'b', text: 'False' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q3',
        text: '3. After a baby is born, you should call out the time of birth (accurate to minute and second), then what?',
        type: 'mc',
        options: [
            { id: 'a', text: 'Clamp and cut the cord.' },
            { id: 'b', text: 'Thoroughly dry the baby.' },
            { id: 'c', text: 'Suction the baby’s mouth and nose.' },
            { id: 'd', text: 'Hold the baby upside-down to let out the secretion' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q4',
        text: '4. During thorough drying and stimulation of the baby, your rapid assessment shows she is crying. What is your next action?',
        type: 'mc',
        options: [
            { id: 'a', text: 'Suction the baby’s mouth and nose.' },
            { id: 'b', text: 'Clamp and cut the cord.' },
            { id: 'c', text: 'Place the baby in skin-to-skin contact with the mother.' },
            { id: 'd', text: 'Place the baby onto the breast.' }
        ],
        correctAnswer: 'c'
    },
    {
        id: 'q5',
        text: '5. For which reason(s)should the baby’s mouth and nose be suctioned after thorough drying?',
        type: 'mc',
        options: [
            { id: 'a', text: 'The baby is breathing and the amniotic fluid is thickly stained with meconium and the baby is covered in meconium.' },
            { id: 'b', text: 'The baby is not breathing and the amniotic fluid is thickly stained with meconium and the baby is covered in meconium.' },
            { id: 'c', text: 'The baby is not breathing and there is no airway obstruction visible.' },
            { id: 'd', text: 'All of the above.' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q6',
        text: '6. A baby has feeding cues indicating she is ready to breast feed immediately after birth.',
        type: 'mc',
        options: [
            { id: 'a', text: 'True' },
            { id: 'b', text: 'False' }
        ],
        correctAnswer: 'a'
    },
    {
        id: 'q7',
        text: '7. What is the approximate capacity of a newborn\'s stomach? Circle A, B, C or D.',
        type: 'mc',
        imageSrc: '/eenc-q7.jpg', // Path to your image in the public folder
        options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' }, 
            { id: 'c', text: 'C' },
            { id: 'd', text: 'D' }
        ],
        correctAnswer: 'd'
    },
    {
        id: 'q8',
        text: '8. List 3 signs a newborn baby is ready to breast feed (“feeding cues”).',
        type: 'open',
        lines: 3
    },
    {
        id: 'q9',
        text: '9. List 3 signs a baby has good attachment to the breast.',
        type: 'open',
        lines: 3
    },
    {
        id: 'q10',
        text: '10. List 3 things you should do to improve bag-and-mask ventilation.',
        type: 'open',
        lines: 3
    },
    {
        id: 'q11',
        text: '11. When does a baby need bag-and-mask ventilation? After thorough drying for 30 seconds, the baby is:',
        type: 'mc',
        options: [
            { id: 'a', text: 'Not breathing.' },
            { id: 'b', text: 'Having difficulty breathing (gas ping respirations).' },
            { id: 'c', text: 'Breathing but limp and very pale or blue in colour.' },
            { id: 'd', text: 'All of the above.' }
        ],
        correctAnswer: 'd'
    },
    {
        id: 'q12',
        text: '12. A baby required bag-and-mask ventilation for 2 minutes. You have stopped bag-and-mask ventilation. He is now crying, breathing without difficulty, pink, and the heart rate is > 100 beats per minute. What should you do now?',
        type: 'mc',
        options: [
            { id: 'a', text: 'Place the baby in direct skin-to-skin contact with the mother/do routine newborn care.' },
            { id: 'b', text: 'Move the baby to an observational area and monitor breathing every 10 minutes.' },
            { id: 'c', text: 'Give oxygen by nasal cannula or mask.' },
            { id: 'd', text: 'Do all of the above' }
        ],
        correctAnswer: 'a'
    }
];


/**
 * Define the questions for the ICCM Pre/Post Test.
 * (Test questions array is unchanged)
 */
export const ICCM_TEST_QUESTIONS = [
    {
        id: 'q1',
        text: '1. أي من الآتي علامة خطر تستوجب تحويلا عاجلا للمستشفى؟',
        type: 'mc',
        options: [
            { id: 'a', text: 'حرارة خفيفة يوم واحد' },
            { id: 'b', text: 'عدم القدرة على الشرب أو الرضاعة' },
            { id: 'c', text: 'رشح بسيط' },
            { id: 'd', text: 'سعال الثلاثة أيام' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q2',
        text: '2. التشنجات أثناء المرض الحالي تتطلب',
        type: 'mc',
        options: [
            { id: 'a', text: 'علاج منزلي' },
            { id: 'b', text: 'متابعة بعد يومين' },
            { id: 'c', text: 'تحويل فوري' }
        ],
        correctAnswer: 'c'
    },
    {
        id: 'q3',
        text: '3. عد التنفس يكون لمدة:',
        type: 'mc',
        options: [
            { id: 'a', text: '15 ثانية' },
            { id: 'b', text: '30 ثانية' },
            { id: 'c', text: '60 ثانية' }
        ],
        correctAnswer: 'c'
    },
    {
        id: 'q4',
        text: '4. تنفس سريع لطفل عمر 12 شهرًا هو على الأقل:',
        type: 'mc',
        options: [
            { id: 'a', text: '40 نفس لكل دقيقة' },
            { id: 'b', text: '50 نفس لكل دقيقة' },
            { id: 'c', text: '60 نفس لكل دقيقة' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q5',
        text: '5. في الإسهال، أول قاعدة علاج منزلي',
        type: 'mc',
        options: [
            { id: 'a', text: 'إيقاف السوائل' },
            { id: 'b', text: 'زيادة السوائل بما فيها محلول معالجة الجفاف (محلول الارواء)' },
            { id: 'c', text: 'مضاد حيوي' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q6',
        text: '6. الهدف من محلول معالجة الجفاف (ملح الارواء):',
        type: 'mc',
        options: [
            { id: 'a', text: 'تقليل الحرارة' },
            { id: 'b', text: 'تعويض الماء والأملاح المفقودة' },
            { id: 'c', text: 'فتح الشهية' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q7',
        text: '7. طريقة إعطاء محلول معالجة الجفاف ملح الارواء) إذا تقiأ الطفل :',
        type: 'mc',
        options: [
            { id: 'a', text: 'التوقف تماما' },
            { id: 'b', text: 'كميات صغيرة متكررة بعد 5-10 دقائق' },
            { id: 'c', text: 'جرعات كبيرة' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q8',
        text: '8. يعطى الزنك لكل الأطفال المصابين بالاسهال',
        type: 'mc',
        options: [
            { id: 'a', text: 'حتى زوال الاسهال' },
            { id: 'b', text: 'مدة 3 أيام' },
            { id: 'c', text: 'مدة 10 ايام' }
        ],
        correctAnswer: 'c'
    },
    {
        id: 'q9',
        text: '9. نتيجة اختبار الملاريا السريع إيجابي مع حمى دون علامات خطر تُصنف :',
        type: 'mc',
        options: [
            { id: 'a', text: 'علاج منزلي باعطاء حبوب الكوارتم' },
            { id: 'b', text: 'تحويل فوري' },
            { id: 'c', text: 'لا يحتاج علاج' }
        ],
        correctAnswer: 'a'
    },
    {
        id: 'q10',
        text: '10. عند تقiؤ جرعة الكوارتم خلال ساعة',
        type: 'mc',
        options: [
            { id: 'a', text: 'لا يحتاج إعادة الجرعة' },
            { id: 'b', text: 'تكرار نفس الجرعة' },
            { id: 'c', 'زيادة الجرعة للضعف': 'زيادة الجرعة للضعف' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q11',
        text: '11. قراءة المواك حمراء تعني :',
        type: 'mc',
        options: [
            { id: 'a', text: 'سوء تغذية متوسط' },
            { id: 'b', text: 'لا توجد سوء تغذية' },
            { id: 'c', 'سوء تغذية شديد وتحويل': 'سوء تغذية شديد وتحويل' }
        ],
        correctAnswer: 'c'
    },
    {
        id: 'q12',
        text: '12. وذمة (ورم) القدمين الثنائية بعد ضغط الإبهام تشير إلى:',
        type: 'mc',
        options: [
            { id: 'a', text: 'سوء تغذية شديد يحتاج علاج بالمنزل' },
            { id: 'b', text: 'سوء تغذية شديد يحتاج تحويل عاجل الى المستشفى' }
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q13',
        text: '13. قبل تحويل طفل لديه علامة خطر ويستطيع الشرب',
        type: 'mc',
        options: [
            { id: 'a', text: 'التجويل العاجل مع إعطاء ادوية ما قبل التحويل' },
            { id: 'b', text: 'تحويل عاجل' }
        ],
        correctAnswer: 'a'
    },
    {
        id: 'q14',
        text: '14. المتابعة لطفل كحة وتنفس سريع بعد بدء الأموكسيسيلين تكون بعد:',
        type: 'mc',
        options: [
            { id: 'a', text: 'يومين' },
            { id: 'b', text: 'أسبوع' },
            { id: 'c', 'لا حاجة': 'لا حاجة' }
        ],
        correctAnswer: 'a'
    },
    {
        id: 'q15',
        text: '15. أي من العلامات التالية تعتبر علامة خطورة للطفل حديث الولادة',
        type: 'mc',
        options: [
            { id: 'a', text: 'درجة حرارة اقل من 35.5' },
            { id: 'b', text: 'إسهال' }
        ],
        correctAnswer: 'a'
    }
];

// Helper function to initialize answers state
const initializeAnswers = (questions) => {
    const initialAnswers = {};
    questions.forEach(q => {
        if (q.type === 'open') {
            initialAnswers[q.id] = Array(q.lines).fill(''); // e.g., ["", "", ""]
        } else {
            initialAnswers[q.id] = ''; // For 'mc' and 'unsupported'
        }
    });
    return initialAnswers;
};

// --- Reusable Test Result Screen Component ---
const TestResultScreen = ({ participantName, testType, score, total, percentage, onBack }) => {
    const percent = percentage.toFixed(1);
    const scoreClass = percent >= 80 ? 'text-green-600' : percent >= 60 ? 'text-yellow-600' : 'text-red-600';

    return (
        <Card>
            <div className="p-6 text-center">
                <PageHeader 
                    title="Test Result"
                    subtitle={`Score for ${participantName} (${testType})`} 
                />
                <div className="my-8">
                    <div className={`text-6xl font-bold ${scoreClass}`}>
                        {percent}%
                    </div>
                    <div className="text-xl text-gray-700 mt-2">
                        ({score} / {total} Correct)
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                        Note: Score only includes multiple-choice questions.
                    </p>
                </div>
                <div className="flex justify-center">
                    <Button 
                        variant="primary" 
                        onClick={onBack}
                    >
                        Back
                    </Button>
                </div>
            </div>
        </Card>
    );
};

// --- *** START: COPIED FROM Participants.jsx *** ---
// --- Reusable Searchable Select Component ---
const SearchableSelect = ({ options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const ref = useRef(null);

    // Effect to set the display name when the value (ID) or options change
    useEffect(() => {
        const selectedOption = options.find(opt => opt.id === value);
        setInputValue(selectedOption ? selectedOption.name : '');
    }, [value, options]);

    // Effect to handle clicking outside the component to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
                // Reset input to the actual selected value when clicking away
                const selectedOption = options.find(opt => opt.id === value);
                setInputValue(selectedOption ? selectedOption.name : '');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref, value, options]);

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        // Show all options if the input value exactly matches the selected option's name
        const selectedOption = options.find(opt => opt.id === value);
        if (selectedOption && selectedOption.name === inputValue) {
            return options;
        }
        // Special handling for the "Add New" option
        if (value === 'addNewFacility' && options[0]?.id === 'addNewFacility') {
             return options.filter(opt => opt.id === 'addNewFacility' || opt.name.toLowerCase().includes(inputValue.toLowerCase()));
        }

        return options.filter(opt => opt.name.toLowerCase().includes(inputValue.toLowerCase()));
    }, [options, inputValue, value]);

    const handleSelect = (option) => {
        onChange(option.id); // Pass the ID back to the parent component
        setInputValue(option.name); // Set the display value in the input
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
                    if (e.target.value === '') {
                        onChange(''); // Clear selection in parent if input is cleared
                    }
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
                         // If no results, but input has text, still show Add New
                         inputValue && options[0]?.id === 'addNewFacility' ? (
                            <div
                                key={options[0].id}
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${options[0].id === 'addNewFacility' ? 'font-bold text-sky-600 bg-sky-50' : ''}`}
                                onClick={() => handleSelect(options[0])}
                            >
                                {options[0].name}
                            </div>
                         ) : (
                            <div className="p-2 text-gray-500">No results found.</div>
                         )
                    )}
                </div>
            )}
        </div>
    );
};

// --- Add Facility Modal Component (COPIED FROM Participants.jsx) ---
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
        'imnci_staff': [], // Start with empty staff list
    }), [initialState, initialLocality, initialName]);

    const handleSaveFacility = async (formData) => {
        setIsSubmitting(true);
        try {
            const submitterIdentifier = 'Participant Form - New Facility';
            const { id, ...dataToSubmit } = formData;

            if (!dataToSubmit['اسم_المؤسسة'] || !dataToSubmit['الولاية'] || !dataToSubmit['المحلية']) {
                throw new Error("Facility Name, State, and Locality are required.");
            }

            // Ensure imnci_staff is an array before submitting
             dataToSubmit.imnci_staff = Array.isArray(dataToSubmit.imnci_staff) ? dataToSubmit.imnci_staff : [];

            await submitFacilityDataForApproval(dataToSubmit, submitterIdentifier);

            // Use setToast for feedback
            if (setToast) {
                setToast({ show: true, message: "New facility submitted for approval. It may take time to appear in the list.", type: 'info' });
            }

            onSaveSuccess({
                id: `pending_${Date.now()}`, // Give it a temporary pending ID
                ...dataToSubmit
            });
            onClose();

        } catch (error) {
            console.error("Failed to submit new facility:", error);
            if (setToast) {
                setToast({ show: true, message: `Error submitting facility: ${error.message}`, type: 'error' });
            }
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
// --- *** END: COPIED FROM Participants.jsx *** ---


/**
 * A form to enter Pre-Test or Post-Test scores for a participant
 * based on the standard ICCM test.
 */
export function CourseTestForm({ 
    course, 
    participants, 
    participantTests, // <-- Receives all test results for the course
    onSave, 
    onCancel, 
    initialParticipantId = '',
    onSaveTest,
    onSaveParticipant, // --- NEW: Prop to save a new participant
    isPublicView = false // --- NEW: Prop to control public view logic
}) {
    // --- MODIFIED: Select questions, title, and text direction based on course type ---
    const { testQuestions, testTitle, isRtl, jobTitleOptions, isIccm } = useMemo(() => {
        let titles = [];
        let isIccm = false;
        if (course.course_type === 'ICCM') {
            titles = ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
            isIccm = true;
            return { 
                testQuestions: ICCM_TEST_QUESTIONS, 
                testTitle: 'ICCM Pre/Post Test Entry',
                isRtl: true,
                jobTitleOptions: titles,
                isIccm: isIccm
            };
        }
        if (course.course_type === 'EENC') {
            titles = JOB_TITLES_EENC;
            return { 
                testQuestions: EENC_TEST_QUESTIONS, 
                testTitle: 'EENC Pre/Post Test Entry',
                isRtl: false,
                jobTitleOptions: titles,
                isIccm: isIccm
            };
        }
        // Fallback
        return { 
            testQuestions: [], 
            testTitle: 'Test Entry', 
            isRtl: false, 
            jobTitleOptions: [], 
            isIccm: false 
        }; 
    }, [course.course_type]);


    const [selectedParticipantId, setSelectedParticipantId] = useState(initialParticipantId);
    // --- MODIFIED: Default to '' for public view, 'pre-test' for internal ---
    const [testType, setTestType] = useState(isPublicView ? '' : 'pre-test'); // 'pre-test' or 'post-test'
    // --- MODIFIED: Initialize answers based on dynamic questions ---
    const [answers, setAnswers] = useState(() => initializeAnswers(testQuestions));
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    // --- State to hold the score after submission ---
    const [submissionResult, setSubmissionResult] = useState(null);
    
    // --- NEW: State for adding a new participant ---
    // --- MODIFIED: Default state/locality to course, but make them selectable ---
    const [newParticipantState, setNewParticipantState] = useState(course.state || '');
    const [newParticipantLocality, setNewParticipantLocality] = useState(course.locality || '');
    const [newParticipantCenter, setNewParticipantCenter] = useState(''); // This holds the *name*
    const [selectedFacilityId, setSelectedFacilityId] = useState(null); // This holds the *ID*
    const [facilitiesInLocality, setFacilitiesInLocality] = useState([]);
    const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
    const [isAddFacilityModalOpen, setIsAddFacilityModalOpen] = useState(false);

    const [newParticipantName, setNewParticipantName] = useState('');
    const [newParticipantPhone, setNewParticipantPhone] = useState('');
    const [newParticipantGroup, setNewParticipantGroup] = useState('Group A');
    const [newParticipantJob, setNewParticipantJob] = useState('');
    const [newParticipantJobOther, setNewParticipantJobOther] = useState('');
    
    // --- *** START: NEWLY ADDED STATES *** ---
    const [isParticipantInfoSaved, setIsParticipantInfoSaved] = useState(false);
    const [participantNameForDisplay, setParticipantNameForDisplay] = useState('');
    // --- *** END: NEWLY ADDED STATES *** ---
    
    // --- MODIFIED: Logic for determining if new participant form should show ---
    const isAddingNewParticipant = useMemo(() => {
        if (isPublicView) {
            // In public view, "pre-test" ALWAYS means new participant
            // and we show the form *until* it's saved
            return testType === 'pre-test' && !isParticipantInfoSaved;
        }
        // In internal view, it's an explicit choice
        return selectedParticipantId === '-- ADD NEW --';
    }, [isPublicView, testType, selectedParticipantId, isParticipantInfoSaved]);

    // --- Memoize existing results for the *selected* participant ---
    const existingResults = useMemo(() => {
        const results = { 'pre-test': null, 'post-test': null };
        if (!selectedParticipantId || !participantTests) {
            return results;
        }

        for (const test of participantTests) {
            if (test.participantId === selectedParticipantId) {
                if (test.testType === 'pre-test') {
                    results['pre-test'] = test; // Store the whole test object
                }
                if (test.testType === 'post-test') {
                    results['post-test'] = test; // Store the whole test object
                }
            }
        }
        return results;
    }, [selectedParticipantId, participantTests]);

    
    // Sort participants by name for the dropdown
    const sortedParticipants = useMemo(() => {
        return [...participants].sort((a, b) => a.name.localeCompare(b.name));
    }, [participants]);

    // --- MODIFIED: Effect to intelligently set the default test type when participant changes (INTERNAL VIEW ONLY) ---
    useEffect(() => {
        // This logic now ONLY runs for the internal-app view
        if (!isPublicView && selectedParticipantId && !isAddingNewParticipant) {
            const hasPreTest = !!existingResults['pre-test'];
            const hasPostTest = !!existingResults['post-test'];
            
            if (!hasPreTest) {
                setTestType('pre-test'); // Default to pre-test if available
            } else if (!hasPostTest) {
                setTestType('post-test'); // Default to post-test if pre-test is done
            } else {
                setTestType('pre-test'); // Both are done, just default to pre-test (it will be disabled)
            }
        }
    }, [isPublicView, selectedParticipantId, existingResults, isAddingNewParticipant]);

    // --- *** START: SPLIT AND FIXED UseEffects *** ---
    // This hook resets the ANSWERS when the test/participant changes
    useEffect(() => {
        setAnswers(initializeAnswers(testQuestions));
        setError('');
        setSubmissionResult(null); // Also reset submission result
    }, [selectedParticipantId, testType, testQuestions]); // Also run when participant changes

    // This hook resets the PARTICIPANT FORM when the test type changes
    useEffect(() => {
        if (isPublicView) {
            setSelectedParticipantId('');
        }
        setIsParticipantInfoSaved(false); 
        setParticipantNameForDisplay(''); 
        
        setNewParticipantName('');
        setNewParticipantPhone('');
        setNewParticipantState(course.state || '');
        setNewParticipantLocality(course.locality || '');
        setNewParticipantCenter('');
        setSelectedFacilityId(null);
        setFacilitiesInLocality([]);
        setNewParticipantGroup('Group A');
        setNewParticipantJob('');
        setNewParticipantJobOther('');
    }, [testType, isPublicView, course.state, course.locality]); // Only run when testType changes
    // --- *** END: SPLIT AND FIXED UseEffects *** ---

    // --- *** START: NEW EFFECT TO FETCH FACILITIES *** ---
    useEffect(() => {
        const fetchFacilities = async () => {
            setError('');
            // Don't fetch for ICCM
            if (newParticipantState && newParticipantLocality && !isIccm) {
                setIsLoadingFacilities(true);
                try {
                    // Use 'server' to ensure fresh data in public form
                    const facilities = await listHealthFacilities({ state: newParticipantState, locality: newParticipantLocality }, 'server');
                    setFacilitiesInLocality(facilities);
                } catch (err) {
                    console.error("Facility fetch error:", err);
                    setError("Failed to load health facilities for this location.");
                    setFacilitiesInLocality([]);
                } finally {
                    setIsLoadingFacilities(false);
                }
            } else {
                setFacilitiesInLocality([]);
                setIsLoadingFacilities(false);
            }
        };

        // Only run this if we are in the "adding new participant" mode
        if (isAddingNewParticipant) {
             fetchFacilities();
        }

    }, [newParticipantState, newParticipantLocality, isIccm, isAddingNewParticipant]);
    // --- *** END: NEW EFFECT TO FETCH FACILITIES *** ---


    // --- NEW: Effect to set display name when participant is selected from dropdown ---
    useEffect(() => {
        if (selectedParticipantId && selectedParticipantId !== '-- ADD NEW --') {
            const participant = participants.find(p => p.id === selectedParticipantId);
            if (participant) {
                setParticipantNameForDisplay(participant.name);
            }
        }
    }, [selectedParticipantId, participants]);


    const handleRadioChange = (questionId, answerId) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answerId
        }));
    };

    const handleTextChange = (questionId, lineIndex, textValue) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: prev[questionId].map((item, i) => (i === lineIndex ? textValue : item))
        }));
    };

    // --- *** START: NEW HANDLERS FOR FACILITY SELECTION *** ---
    const handleFacilitySelect = (facilityIdOrAction) => {
        setError('');
        if (facilityIdOrAction === 'addNewFacility') {
            // We use newParticipantCenter as the suggestion
            setIsAddFacilityModalOpen(true);
            return;
        }

        const facility = facilitiesInLocality.find(f => f.id === facilityIdOrAction);
        setSelectedFacilityId(facility ? facility.id : null);
        setNewParticipantCenter(facility ? facility['اسم_المؤسسة'] : '');
    };

    const handleNewFacilitySaved = (newlySubmittedFacilityData) => {
        const representation = {
            id: newlySubmittedFacilityData.id, // Use temporary ID
            'اسم_المؤسسة': newlySubmittedFacilityData['اسم_المؤسسة'],
        };
        // Add representation to the current list
        setFacilitiesInLocality(prev => [...prev, representation]);
        // Automatically select the new representation
        setSelectedFacilityId(representation.id);
        setNewParticipantCenter(representation['اسم_المؤسسة']);
        setIsAddFacilityModalOpen(false); // Close modal
    };
    
    // Prepare options for the facility select, including "Add New"
    const facilityOptionsForSelect = useMemo(() => {
        // For ICCM, return empty array (it uses a text input)
        if (isIccm) return [];
        
        const options = (facilitiesInLocality || []).map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }));
        options.unshift({ id: 'addNewFacility', name: "+ Add New Facility..." });
        return options;
    }, [facilitiesInLocality, isIccm]);
    // --- *** END: NEW HANDLERS FOR FACILITY SELECTION *** ---


    // --- *** START: MODIFIED FUNCTION TO SAVE PARTICIPANT *** ---
    const handleSaveParticipantInfo = async () => {
        if (!onSaveParticipant) {
            setError("Participant saving function is not provided.");
            return;
        }

        setError('');
        setIsSaving(true);

        try {
            const finalJobTitle = newParticipantJob === 'Other' ? newParticipantJobOther : newParticipantJob;
            const centerNameLabel = isIccm ? 'Village Name' : 'Facility Name';

            // Validation
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
                state: newParticipantState, // --- Use selected state
                locality: newParticipantLocality, // --- Use selected locality
                center_name: newParticipantCenter.trim(),
                courseId: course.id,
                // --- Use selected facility ID (if not ICCM) ---
                facilityId: (isIccm || (selectedFacilityId && selectedFacilityId.startsWith('pending_'))) ? null : selectedFacilityId,
                // Add course-type specific fields with defaults if necessary
                ...(isIccm && {
                    trained_before: false,
                    last_imci_training: null,
                    nearest_health_facility: null,
                    hours_to_facility: null
                })
                // Add EENC defaults if needed
            };
            
            // Save participant (and pass null for facility update, as this is a public form)
            const newParticipant = await onSaveParticipant(participantPayload, null);
            
            // --- CRITICAL: Set state for the test submission ---
            setSelectedParticipantId(newParticipant.id); // Set the ID for the test
            setParticipantNameForDisplay(newParticipant.name); // Set the name for the results screen
            setIsParticipantInfoSaved(true); // This will hide the form and show the questions

        } catch (err) {
            setError(`Failed to save participant: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };
    // --- *** END: MODIFIED FUNCTION TO SAVE PARTICIPANT *** ---

    const handleSubmit = async () => {
        setError('');

        // --- MODIFIED: Simplified validation ---
        if (!selectedParticipantId) {
             setError('A participant must be selected or saved before submitting the test.');
             return;
        }

        // --- Validate all 'mc' (multiple choice) questions ---
        const mcQuestions = testQuestions.filter(q => q.type === 'mc');
        const unanswered = mcQuestions.filter(q => !answers[q.id]);
        
        if (unanswered.length > 0) {
            setError(`Please answer all multiple-choice questions. Question ${unanswered[0].text.split('.')[0]} is missing.`);
            return;
        }

        setIsSaving(true);
        
        try {
            // --- Score only 'mc' (multiple choice) questions ---
            const scorableQuestions = testQuestions.filter(q => q.type === 'mc');
            let score = 0;
            scorableQuestions.forEach(q => {
                if (answers[q.id] === q.correctAnswer) {
                    score++;
                }
            });
            
            const total = scorableQuestions.length;
            const percentage = total > 0 ? (score / total) * 100 : 0;

            const payload = {
                participantId: selectedParticipantId, // This is now set for both pre and post test
                participantName: participantNameForDisplay, // This is also set for both
                courseId: course.id,
                courseType: course.course_type,
                testType: testType,
                answers: answers, // This will save all answers, including open-ended
                score: score,
                total: total,
                percentage: percentage,
                submittedAt: new Date().toISOString()
            };

            if (onSaveTest) {
                await onSaveTest(payload);
            } else {
                console.warn('No onSaveTest handler provided. Payload:', payload);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            setSubmissionResult(payload); // Show the score screen

        } catch (err) {
            setError(`Failed to save test: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // --- LOGIC FOR RENDERING ---
    
    // 1. Check if a new test was JUST submitted
    if (submissionResult) {
        return (
            <TestResultScreen
                participantName={submissionResult.participantName}
                testType={submissionResult.testType}
                score={submissionResult.score}
                total={submissionResult.total}
                percentage={submissionResult.percentage}
                onBack={() => {
                    // Reset the component state to start over
                    setSubmissionResult(null);
                    setTestType(isPublicView ? '' : 'pre-test');
                    setSelectedParticipantId('');
                    // onSave() is called by App.jsx to refresh data
                    onSave(submissionResult);
                }}
            />
        );
    }
    
    // 2. Check if a test for this participant/type *already exists* (INTERNAL VIEW ONLY)
    const existingTestResult = existingResults[testType];
    if (!isPublicView && existingTestResult && !isAddingNewParticipant) {
        const participantName = participants.find(p => p.id === existingTestResult.participantId)?.name || 'Participant';
        return (
            <TestResultScreen
                participantName={participantName}
                testType={existingTestResult.testType}
                score={existingTestResult.score}
                total={existingTestResult.total}
                percentage={existingTestResult.percentage}
                onBack={onCancel} // onCancel goes back to the list (or previous view)
            />
        );
    }

    // 3. If neither of the above, show the blank form
    const hasPreTest = !!existingResults['pre-test'];
    const hasPostTest = !!existingResults['post-test'];

    // 4. Show error if no questions are loaded
    if (testQuestions.length === 0) {
        return (
             <Card>
                <div className="p-6">
                    <PageHeader 
                        title="Error" 
                        subtitle={`Course: ${course.state} / ${course.locality} [${course.start_date}]`} 
                    />
                    <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
                        No test questions are configured for this course type ({course.course_type}).
                    </div>
                     <div className="flex gap-2 justify-end mt-8 border-t pt-6">
                        <Button variant="secondary" onClick={onCancel}>
                            Back
                        </Button>
                    </div>
                </div>
            </Card>
        );
    }

    // --- NEW: Dynamic label for center_name ---
    const centerNameLabel = isIccm ? "Village Name" : "Facility Name";

    // --- NEW: Conditions for enabling sections ---
    // In public view, disable participant section until test type is chosen
    const participantSectionDisabled = isPublicView && !testType;
    
    // --- MODIFIED: Condition to show the questions ---
    const showQuestions = (isPublicView && testType === 'pre-test' && isParticipantInfoSaved) || // Public Pre-Test, after saving info
                          (isPublicView && testType === 'post-test' && selectedParticipantId) || // Public Post-Test, after selecting
                          (!isPublicView && selectedParticipantId); // Internal view, after selecting or choosing new

    // Disable submit button
    const submitDisabled = isSaving || !showQuestions;


    return (
        <Card>
            {/* --- *** START: NEW MODAL *** --- */}
            <AddFacilityModal
                isOpen={isAddFacilityModalOpen}
                onClose={() => setIsAddFacilityModalOpen(false)}
                onSaveSuccess={handleNewFacilitySaved}
                initialState={newParticipantState}
                initialLocality={newParticipantLocality}
                initialName={newParticipantCenter} // Pass current typed name as suggestion
                setToast={(toastConfig) => setError(toastConfig.message)} // Use setError as a simple toast mechanism here
            />
            {/* --- *** END: NEW MODAL *** --- */}

            <div className="p-6">
                {/* --- START: MODIFIED HEADER --- */}
                <div className="flex flex-wrap justify-between items-start gap-4">
                    <PageHeader 
                        title={testTitle} 
                        subtitle={`Course: ${course.state} / ${course.locality} [${course.start_date}]`} 
                        className="p-0 m-0" // Remove default margins
                    />
                    <div>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                const link = `${window.location.origin}/public/test/course/${course.id}`;
                                navigator.clipboard.writeText(link)
                                    .then(() => alert('Public test form link copied to clipboard!'))
                                    .catch(() => alert('Failed to copy link.'));
                            }}
                            title="Copy public test form link for this course"
                        >
                            Share Test Form
                        </Button>
                    </div>
                </div>
                {/* --- END: MODIFIED HEADER --- */}
                
                {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                    {/* --- MODIFIED: Show Test Type first in public view --- */}
                    {isPublicView && (
                        <FormGroup label="Select Test Type">
                            <Select 
                                value={testType} 
                                onChange={(e) => setTestType(e.target.value)}
                            >
                                <option value="">-- Select Test Type --</option>
                                <option value="pre-test">Pre-Test</option>
                                <option value="post-test">Post-Test</option>
                            </Select>
                        </FormGroup>
                    )}

                    {/* --- Internal View: Participant First --- */}
                    {!isPublicView && (
                         <FormGroup label="Select Participant">
                            <Select 
                                value={selectedParticipantId} 
                                onChange={(e) => setSelectedParticipantId(e.target.value)}
                            >
                                <option value="">-- Select a Participant --</option>
                                {/* --- NEW: Add new participant option --- */}
                                {onSaveParticipant && (
                                    <option value="-- ADD NEW --" className="font-bold text-sky-600">
                                        + Register New Participant
                                    </option>
                                )}
                                {sortedParticipants.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.group})
                                    </option>
                                ))}
                            </Select>
                        </FormGroup>
                    )}
                    
                    {/* --- Internal View: Test Type Second --- */}
                    {!isPublicView && (
                        <FormGroup label="Select Test Type">
                            <Select 
                                value={testType} 
                                onChange={(e) => setTestType(e.target.value)}
                                disabled={!selectedParticipantId || (hasPreTest && hasPostTest)}
                            >
                                <option value="pre-test" disabled={hasPreTest && !isAddingNewParticipant}>
                                    Pre-Test {hasPreTest && !isAddingNewParticipant && "(Completed)"}
                                </option>
                                <option value="post-test" disabled={hasPostTest && !isAddingNewParticipant}>
                                    Post-Test {hasPostTest && !isAddingNewParticipant && "(Completed)"}
                                </option>
                            </Select>
                        </FormGroup>
                    )}

                    {/* --- Public View, Post-Test: Participant Second --- */}
                    {isPublicView && testType === 'post-test' && (
                        <FormGroup label="Select Participant">
                            <Select 
                                value={selectedParticipantId} 
                                onChange={(e) => setSelectedParticipantId(e.target.value)}
                                disabled={participantSectionDisabled}
                            >
                                <option value="">-- Select a Participant --</option>
                                {/* NO "ADD NEW" for post-test */}
                                {sortedParticipants.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.group})
                                    </option>
                                ))}
                            </Select>
                        </FormGroup>
                    )}
                </div>

                {/* --- Form for adding new participant (Shows for internal '-- ADD NEW --' or public 'pre-test') --- */}
                {isAddingNewParticipant && (
                    <fieldset className="mt-6 border-t pt-6" disabled={participantSectionDisabled || isSaving}>
                        <legend className="text-xl font-semibold mb-4 text-gray-800" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                            {isPublicView ? 'Participant Information (for Pre-Test)' : 'New Participant Information'}
                        </legend>
                        {/* --- *** START: MODIFIED GRID *** --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}>
                            <FormGroup label="State">
                                <Select value={newParticipantState} onChange={(e) => {
                                    setNewParticipantState(e.target.value);
                                    setNewParticipantLocality(''); // Reset locality
                                    setNewParticipantCenter(''); // Reset facility name
                                    setSelectedFacilityId(null); // Clear selected facility object
                                    setFacilitiesInLocality([]); // Clear facility list
                                }}>
                                    <option value="">— Select State —</option>
                                    {Object.keys(STATE_LOCALITIES).sort((a,b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Locality">
                                <Select value={newParticipantLocality} onChange={(e) => {
                                    setNewParticipantLocality(e.target.value);
                                    setNewParticipantCenter(''); // Reset facility name
                                    setSelectedFacilityId(null); // Clear selected facility object
                                }} disabled={!newParticipantState}>
                                    <option value="">— Select Locality —</option>
                                    {(STATE_LOCALITIES[newParticipantState]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                                </Select>
                            </FormGroup>
                             <FormGroup label="Group">
                                <Select value={newParticipantGroup} onChange={(e) => setNewParticipantGroup(e.target.value)}>
                                    <option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option>
                                </Select>
                            </FormGroup>

                            {/* --- MODIFIED: Conditional Facility/Village Input --- */}
                            {isIccm ? (
                                <FormGroup label={centerNameLabel}>
                                    <Input
                                        value={newParticipantCenter}
                                        onChange={(e) => setNewParticipantCenter(e.target.value)}
                                        placeholder={`Enter ${centerNameLabel}`}
                                        disabled={!newParticipantLocality}
                                    />
                                </FormGroup>
                            ) : (
                                <FormGroup label={centerNameLabel}>
                                    <SearchableSelect
                                        value={selectedFacilityId}
                                        onChange={handleFacilitySelect}
                                        options={facilityOptionsForSelect}
                                        placeholder={isLoadingFacilities ? "Loading..." : (!newParticipantLocality ? "Select Locality first" : "Search or Add New Facility...")}
                                        disabled={isLoadingFacilities || !newParticipantLocality}
                                    />
                                </FormGroup>
                            )}

                            <FormGroup label="Participant Name">
                                <Input value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="Enter participant's full name" />
                            </FormGroup>
                            <FormGroup label="Phone Number">
                                <Input type="tel" value={newParticipantPhone} onChange={(e) => setNewParticipantPhone(e.target.value)} />
                            </FormGroup>
                            <FormGroup label="Job Title">
                                <Select value={newParticipantJob} onChange={(e) => setNewParticipantJob(e.target.value)}>
                                    <option value="">— Select Job —</option>
                                    {jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    <option value="Other">Other</option>
                                </Select>
                            </FormGroup>
                            {newParticipantJob === 'Other' && (
                                <FormGroup label="Specify Job Title">
                                    <Input value={newParticipantJobOther} onChange={(e) => setNewParticipantJobOther(e.target.value)} placeholder="Please specify" />
                                </FormGroup>
                            )}
                        </div>
                        {/* --- *** END: MODIFIED GRID *** --- */}
                        
                        {/* --- *** START: NEW BUTTON *** --- */}
                        <div className="flex justify-end mt-4">
                            <Button onClick={handleSaveParticipantInfo} disabled={isSaving}>
                                {isSaving ? <Spinner /> : "Save and Proceed to Test"}
                            </Button>
                        </div>
                        {/* --- *** END: NEW BUTTON *** --- */}
                    </fieldset>
                )}

                <hr className="my-6" />

                {/* --- *** START: MODIFIED SECTION *** --- */}
                {/* Conditionally render questions only when participant is identified */}
                {showQuestions ? (
                    <fieldset disabled={isSaving}>
                        <legend className="text-xl font-semibold mb-4 text-gray-800">
                            Test Questions
                        </legend>
                        
                        {/* --- MODIFIED: Use dynamic text direction --- */}
                        <div className="space-y-6" style={{ direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}>
                            {testQuestions.map((q) => (
                                <div key={q.id} className="p-4 border rounded-md shadow-sm bg-white">
                                    <label className="block text-base font-semibold text-gray-800 mb-3">{q.text}</label>
                                    
                                    {/* --- ADD THIS BLOCK TO RENDER THE IMAGE --- */}
                                    {q.imageSrc && (
                                        <div className="my-3">
                                            <img 
                                                src={q.imageSrc} 
                                                alt="Visual for question" 
                                                className="max-w-full h-auto rounded-lg border border-gray-200"
                                            />
                                        </div>
                                    )}
                                    {/* --- END OF NEW BLOCK --- */}
                                    
                                    {/* --- RENDER MULTIPLE CHOICE --- */}
                                    {q.type === 'mc' && (
                                        <div className="flex flex-col gap-2 mt-2">
                                            {q.options.map(opt => (
                                                <label key={opt.id} className="flex items-center gap-3 p-2 rounded hover:bg-sky-50 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name={q.id}
                                                        value={opt.id}
                                                        checked={answers[q.id] === opt.id}
                                                        onChange={() => handleRadioChange(q.id, opt.id)}
                                                        className="w-4 h-4 text-sky-600 focus:ring-sky-500 border-gray-300"
                                                    />
                                                    <span className="text-sm text-gray-700">{opt.text}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {/* --- RENDER OPEN-ENDED --- */}
                                    {q.type === 'open' && (
                                        <div className="flex flex-col gap-2 mt-2">
                                            {Array.from({ length: q.lines }).map((_, index) => (
                                                <Input
                                                    key={index}
                                                    type="text"
                                                    placeholder={`Answer ${index + 1}...`}
                                                    value={answers[q.id]?.[index] || ''}
                                                    onChange={(e) => handleTextChange(q.id, index, e.target.value)}
                                                    className="w-full"
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* --- RENDER UNSUPPORTED (e.g., Image) --- */}
                                    {q.type === 'unsupported' && (
                                        <div className="p-3 text-sm text-gray-500 bg-gray-100 rounded-md">
                                            This question is image-based or otherwise unsupported in this form and will be skipped.
                                        </div>
                                    )}

                                </div>
                            ))}
                        </div>
                    </fieldset>
                ) : (
                    // Placeholder shown before questions are visible
                    <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-md">
                        {isPublicView && !testType && "Please select a test type to begin."}
                        {isPublicView && testType === 'post-test' && !selectedParticipantId && "Please select your name from the list to begin the post-test."}
                        {isPublicView && testType === 'pre-test' && !isParticipantInfoSaved && "Please fill out and save your information to proceed to the test."}
                        {!isPublicView && !selectedParticipantId && "Please select a participant to begin."}
                    </div>
                )}
                {/* --- *** END: MODIFIED SECTION *** --- */}

                <div className="flex gap-2 justify-end mt-8 border-t pt-6">
                    <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitDisabled}>
                        {isSaving ? <Spinner /> : 'Submit & View Score'}
                    </Button>
                </div>
            </div>
        </Card>
    );
}