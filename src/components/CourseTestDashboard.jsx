// CourseTestDashboard.jsx
import React, { useMemo } from 'react';
import { Card, PageHeader, Table } from "./CommonComponents";
import { ICCM_TEST_QUESTIONS } from "./CourseTestForm"; // We will export this in the next step

// Helper function to format percentages
const fmtPct = (value) => {
    if (isNaN(value) || value === null) return 'N/A';
    return `${value.toFixed(0)}%`;
};

// Helper function to get a color class based on percentage
const getScoreClass = (value) => {
    if (isNaN(value) || value === null) return 'text-gray-500';
    if (value >= 80) return 'text-green-600 font-semibold';
    if (value >= 60) return 'text-yellow-600';
    return 'text-red-600';
};

/**
 * A dashboard to analyze participant performance on the ICCM test.
 */
export function CourseTestDashboard({ course, participants, participantTests }) {
    
    // 1. Analyze the test data
    const stats = useMemo(() => {
        const preTests = participantTests.filter(t => t.testType === 'pre-test');
        const postTests = participantTests.filter(t => t.testType === 'post-test');

        const preTestCount = preTests.length;
        const postTestCount = postTests.length;

        // Calculate average scores
        const avgPreTest = preTestCount > 0 
            ? preTests.reduce((sum, test) => sum + test.percentage, 0) / preTestCount 
            : null;
        const avgPostTest = postTestCount > 0 
            ? postTests.reduce((sum, test) => sum + test.percentage, 0) / postTestCount 
            : null;

        // Calculate per-question stats
        const questionStats = ICCM_TEST_QUESTIONS.map(q => {
            let preCorrect = 0;
            let postCorrect = 0;

            for (const test of preTests) {
                if (test.answers[q.id] === q.correctAnswer) {
                    preCorrect++;
                }
            }
            
            for (const test of postTests) {
                if (test.answers[q.id] === q.correctAnswer) {
                    postCorrect++;
                }
            }

            const prePct = preTestCount > 0 ? (preCorrect / preTestCount) * 100 : null;
            const postPct = postTestCount > 0 ? (postCorrect / postTestCount) * 100 : null;
            
            return {
                id: q.id,
                text: q.text,
                correctAnswerText: q.options.find(opt => opt.id === q.correctAnswer)?.text || 'N/A',
                prePct,
                postPct,
                improvement: (postPct !== null && prePct !== null) ? postPct - prePct : null
            };
        });

        return {
            preTestCount,
            postTestCount,
            avgPreTest,
            avgPostTest,
            questionStats
        };

    }, [participantTests]);

    return (
        <Card>
            <div className="p-6">
                <PageHeader 
                    title="ICCM Test Dashboard" 
                    subtitle={`Performance Analysis for ${course.state} / ${course.locality} [${course.start_date}]`} 
                />

                {/* --- Overall Stats --- */}
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Overall Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-gray-50 rounded-lg shadow-inner text-center">
                        <div className="text-3xl font-bold text-gray-800">{stats.preTestCount}</div>
                        <div className="text-sm text-gray-600">Pre-Tests Completed</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg shadow-inner text-center">
                        <div className="text-3xl font-bold text-gray-800">{stats.postTestCount}</div>
                        <div className="text-sm text-gray-600">Post-Tests Completed</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg shadow-inner text-center">
                        <div className={`text-3xl font-bold ${getScoreClass(stats.avgPreTest)}`}>
                            {fmtPct(stats.avgPreTest)}
                        </div>
                        <div className="text-sm text-gray-600">Avg. Pre-Test Score</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg shadow-inner text-center">
                        <div className={`text-3xl font-bold ${getScoreClass(stats.avgPostTest)}`}>
                            {fmtPct(stats.avgPostTest)}
                        </div>
                        <div className="text-sm text-gray-600">Avg. Post-Test Score</div>
                    </div>
                </div>

                {/* --- Per-Question Stats --- */}
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Question Analysis</h3>
                <div className="overflow-x-auto" style={{ direction: 'rtl' }}>
                    <Table headers={["Question", "Correct Answer", "Pre-Test Correct", "Post-Test Correct", "Improvement"]}>
                        {stats.questionStats.map(q => (
                            <tr key={q.id} className="hover:bg-gray-50">
                                <td className="p-3 border border-gray-200 text-sm text-gray-700">{q.text}</td>
                                <td className="p-3 border border-gray-200 text-sm text-gray-600">{q.correctAnswerText}</td>
                                <td className={`p-3 border border-gray-200 text-center ${getScoreClass(q.prePct)}`}>
                                    {fmtPct(q.prePct)}
                                </td>
                                <td className={`p-3 border border-gray-200 text-center ${getScoreClass(q.postPct)}`}>
                                    {fmtPct(q.postPct)}
                                </td>
                                <td className={`p-3 border border-gray-200 text-center font-semibold ${q.improvement > 0 ? 'text-green-600' : q.improvement < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {q.improvement !== null ? `${q.improvement > 0 ? '+' : ''}${fmtPct(q.improvement)}` : 'N/A'}
                                </td>
                            </tr>
                        ))}
                    </Table>
                </div>
            </div>
        </Card>
    );
}