// CourseTestForm.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner
} from "./CommonComponents"; // Assuming CommonComponents are available

/**
 * Define the questions for the ICCM Pre/Post Test.
 * This structure is derived from the provided PDF:
 * 'الامتحان القبلي - العلاج المتكامل للاطفال اقل من 5 سنوات.pdf'
 */
export const ICCM_TEST_QUESTIONS = [ // <-- 'export' is already here
    {
        id: 'q1',
        text: '1. أي من الآتي علامة خطر تستوجب تحويلا عاجلا للمستشفى؟', //
        options: [
            { id: 'a', text: 'حرارة خفيفة يوم واحد' }, //
            { id: 'b', text: 'عدم القدرة على الشرب أو الرضاعة' }, //
            { id: 'c', text: 'رشح بسيط' }, //
            { id: 'd', text: 'سعال الثلاثة أيام' } //
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q2',
        text: '2. التشنجات أثناء المرض الحالي تتطلب', //
        options: [
            { id: 'a', text: 'علاج منزلي' }, //
            { id: 'b', text: 'متابعة بعد يومين' }, //
            { id: 'c', text: 'تحويل فوري' } //
        ],
        correctAnswer: 'c'
    },
    {
        id: 'q3',
        text: '3. عد التنفس يكون لمدة:', //
        options: [
            { id: 'a', text: '15 ثانية' }, //
            { id: 'b', text: '30 ثانية' }, //
            { id: 'c', text: '60 ثانية' } //
        ],
        correctAnswer: 'c'
    },
    {
        id: 'q4',
        text: '4. تنفس سريع لطفل عمر 12 شهرًا هو على الأقل:', //
        options: [
            { id: 'a', text: '40 نفس لكل دقيقة' }, //
            { id: 'b', text: '50 نفس لكل دقيقة' }, //
            { id: 'c', text: '60 نفس لكل دقيقة' } //
        ],
        correctAnswer: 'a' // Note: Standard IMNCI is 50 for 2-12mo, 40 for 12-59mo.
    },
    {
        id: 'q5',
        text: '5. في الإسهال، أول قاعدة علاج منزلي', //
        options: [
            { id: 'a', text: 'إيقاف السوائل' }, //
            { id: 'b', text: 'زيادة السوائل بما فيها محلول معالجة الجفاف (محلول الارواء)' }, //
            { id: 'c', text: 'مضاد حيوي' } //
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q6',
        text: '6. الهدف من محلول معالجة الجفاف (ملح الارواء):', //
        options: [
            { id: 'a', text: 'تقليل الحرارة' }, //
            { id: 'b', text: 'تعويض الماء والأملاح المفقودة' }, //
            { id: 'c', text: 'فتح الشهية' } //
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q7',
        text: '7. طريقة إعطاء محلول معالجة الجفاف ملح الارواء) إذا تقيأ الطفل :', //
        options: [
            { id: 'a', text: 'التوقف تماما' }, //
            { id: 'b', text: 'كميات صغيرة متكررة بعد 5-10 دقائق' }, //
            { id: 'c', text: 'جرعات كبيرة' } //
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q8',
        text: '8. يعطى الزنك لكل الأطفال المصابين بالاسهال', //
        options: [
            { id: 'a', text: 'حتى زوال الاسهال' }, //
            { id: 'b', text: 'مدة 3 أيام' }, //
            { id: 'c', text: 'مدة 10 ايام' } //
        ],
        correctAnswer: 'c'
    },
    {
        id: 'q9',
        text: '9. نتيجة اختبار الملاريا السريع إيجابي مع حمى دون علامات خطر تُصنف :', //
        options: [
            { id: 'a', text: 'علاج منزلي باعطاء حبوب الكوارتم' }, //
            { id: 'b', text: 'تحويل فوري' }, //
            { id: 'c', text: 'لا يحتاج علاج' } //
        ],
        correctAnswer: 'a'
    },
    {
        id: 'q10',
        text: '10. عند تقيؤ جرعة الكوارتم خلال ساعة', //
        options: [
            { id: 'a', text: 'لا يحتاج إعادة الجرعة' }, //
            { id: 'b', text: 'تكرار نفس الجرعة' }, //
            { id: 'c', text: 'زيادة الجرعة للضعف' } //
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q11',
        text: '11. قراءة المواك حمراء تعني :', //
        options: [
            { id: 'a', text: 'سوء تغذية متوسط' }, //
            { id: 'b', text: 'لا توجد سوء تغذية' }, //
            { id: 'c', text: 'سوء تغذية شديد وتحويل' } //
        ],
        correctAnswer: 'c'
    },
    {
        id: 'q12',
        text: '12. وذمة (ورم) القدمين الثنائية بعد ضغط الإبهام تشير إلى:', //
        options: [
            { id: 'a', text: 'سوء تغذية شديد يحتاج علاج بالمنزل' }, //
            { id: 'b', text: 'سوء تغذية شديد يحتاج تحويل عاجل الى المستشفى' } //
        ],
        correctAnswer: 'b'
    },
    {
        id: 'q13',
        text: '13. قبل تحويل طفل لديه علامة خطر ويستطيع الشرب', //
        options: [
            { id: 'a', text: 'التجويل العاجل مع إعطاء ادوية ما قبل التحويل' }, //
            { id: 'b', text: 'تحويل عاجل' } //
        ],
        correctAnswer: 'a'
    },
    {
        id: 'q14',
        text: '14. المتابعة لطفل كحة وتنفس سريع بعد بدء الأموكسيسيلين تكون بعد:', //
        options: [
            { id: 'a', text: 'يومين' }, //
            { id: 'b', text: 'أسبوع' },
            { id: 'c', 'لا حاجة': 'لا حاجة' }
        ],
        correctAnswer: 'a'
    },
    {
        id: 'q15',
        text: '15. أي من العلامات التالية تعتبر علامة خطورة للطفل حديث الولادة', //
        options: [
            { id: 'a', text: 'درجة حرارة اقل من 35.5' }, //
            { id: 'b', text: 'إسهال' } //
        ],
        correctAnswer: 'a'
    }
];

// Helper function to initialize answers state
const initializeAnswers = () => {
    const initialAnswers = {};
    ICCM_TEST_QUESTIONS.forEach(q => {
        initialAnswers[q.id] = ''; // Set all answers to empty string
    });
    return initialAnswers;
};

// --- NEW: Reusable Test Result Screen Component ---
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
    onSaveTest 
}) {
    const [selectedParticipantId, setSelectedParticipantId] = useState(initialParticipantId);
    const [testType, setTestType] = useState('pre-test'); // 'pre-test' or 'post-test'
    const [answers, setAnswers] = useState(initializeAnswers());
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    // --- State to hold the score after submission ---
    const [submissionResult, setSubmissionResult] = useState(null);

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

    // --- Effect to intelligently set the default test type when participant changes ---
    useEffect(() => {
        if (selectedParticipantId) {
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
    }, [selectedParticipantId, existingResults]);

    // --- MODIFIED: Effect to clear answers when participant OR test type changes ---
    useEffect(() => {
        setAnswers(initializeAnswers());
        setError('');
        setSubmissionResult(null); // Also reset submission result
    }, [selectedParticipantId, testType]); // Fires when either changes


    const handleAnswerChange = (questionId, answerId) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answerId
        }));
    };

    const handleSubmit = async () => {
        if (!selectedParticipantId) {
            setError('Please select a participant.');
            return;
        }

        const unanswered = ICCM_TEST_QUESTIONS.filter(q => !answers[q.id]);
        if (unanswered.length > 0) {
            setError(`Please answer all questions. Question ${unanswered[0].id.substring(1)} is missing.`);
            return;
        }

        setError('');
        setIsSaving(true);

        // Calculate score
        let score = 0;
        ICCM_TEST_QUESTIONS.forEach(q => {
            if (answers[q.id] === q.correctAnswer) {
                score++;
            }
        });
        
        const total = ICCM_TEST_QUESTIONS.length;
        const percentage = (score / total) * 100;

        const payload = {
            participantId: selectedParticipantId,
            courseId: course.id,
            courseType: course.course_type,
            testType: testType,
            answers: answers,
            score: score,
            total: total,
            percentage: percentage,
            submittedAt: new Date().toISOString()
        };

        try {
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
        const participantName = participants.find(p => p.id === submissionResult.participantId)?.name || 'Participant';
        return (
            <TestResultScreen
                participantName={participantName}
                testType={submissionResult.testType}
                score={submissionResult.score}
                total={submissionResult.total}
                percentage={submissionResult.percentage}
                onBack={() => onSave(submissionResult)} // onSave navigates back to the list
            />
        );
    }
    
    // 2. Check if a test for this participant/type *already exists*
    const existingTestResult = existingResults[testType];
    if (existingTestResult) {
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

    return (
        <Card>
            <div className="p-6">
                <PageHeader 
                    title="ICCM Pre/Post Test Entry" 
                    subtitle={`Course: ${course.state} / ${course.locality} [${course.start_date}]`} 
                />
                
                {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                    <FormGroup label="Select Participant">
                        <Select 
                            value={selectedParticipantId} 
                            onChange={(e) => setSelectedParticipantId(e.target.value)}
                        >
                            <option value="">-- Select a Participant --</option>
                            {sortedParticipants.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.group})
                                </option>
                            ))}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Select Test Type">
                        <Select 
                            value={testType} 
                            onChange={(e) => setTestType(e.target.value)}
                            disabled={!selectedParticipantId || (hasPreTest && hasPostTest)}
                        >
                            <option value="pre-test" disabled={hasPreTest}>
                                Pre-Test {hasPreTest && "(Completed)"}
                            </option>
                            <option value="post-test" disabled={hasPostTest}>
                                Post-Test {hasPostTest && "(Completed)"}
                            </option>
                        </Select>
                    </FormGroup>
                </div>

                <hr className="my-6" />

                <fieldset disabled={!selectedParticipantId || isSaving}>
                    <legend className="text-xl font-semibold mb-4 text-gray-800">
                        Test Questions
                    </legend>
                    
                    <div className="space-y-6" style={{ direction: 'rtl', textAlign: 'right' }}>
                        {ICCM_TEST_QUESTIONS.map((q) => (
                            <div key={q.id} className="p-4 border rounded-md shadow-sm bg-white">
                                <label className="block text-base font-semibold text-gray-800 mb-3">{q.text}</label>
                                <div className="flex flex-col gap-2 mt-2">
                                    {q.options.map(opt => (
                                        <label key={opt.id} className="flex items-center gap-3 p-2 rounded hover:bg-sky-50 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={q.id}
                                                value={opt.id}
                                                checked={answers[q.id] === opt.id}
                                                onChange={() => handleAnswerChange(q.id, opt.id)}
                                                className="w-4 h-4 text-sky-600 focus:ring-sky-500 border-gray-300"
                                            />
                                            <span className="text-sm text-gray-700">{opt.text}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </fieldset>

                <div className="flex gap-2 justify-end mt-8 border-t pt-6">
                    <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!selectedParticipantId || isSaving}>
                        {isSaving ? <Spinner /> : 'Submit & View Score'}
                    </Button>
                </div>
            </div>
        </Card>
    );
}