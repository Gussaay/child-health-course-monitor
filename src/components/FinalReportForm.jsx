// FinalReportForm.jsx
import React, { useState, useEffect } from 'react';
import { Button, Card, FormGroup, Input, PageHeader, PdfIcon, Select, Table, Textarea } from './CommonComponents';
import {
    IMNCI_SUBCOURSE_TYPES,
} from './constants.js';

export function FinalReportForm({ course, participants, onCancel, onSave, initialData }) {
    // Set initial state using initialData if it exists, otherwise use defaults
    const [summary, setSummary] = useState('');
    const [recommendations, setRecommendations] = useState([{ recommendation: '', responsible: '', status: '' }]);
    const [potentialFacilitators, setPotentialFacilitators] = useState([]);
    const [pdfFile, setPdfFile] = useState(null);
    const [existingPdfUrl, setExistingPdfUrl] = useState(null);
    const [fileName, setFileName] = useState(null);

    // Use useEffect to synchronize state with props
    useEffect(() => {
        if (initialData) {
            setSummary(initialData.summary || '');
            setRecommendations(initialData.recommendations || [{ recommendation: '', responsible: '', status: '' }]);
            setPotentialFacilitators(initialData.potentialFacilitators || []);
            setExistingPdfUrl(initialData.pdfUrl || null);
            setFileName(initialData.pdfUrl ? 'Existing PDF' : null);
        } else {
            // Reset state for a new report
            setSummary('');
            setRecommendations([{ recommendation: '', responsible: '', status: '' }]);
            setPotentialFacilitators([]);
            setPdfFile(null);
            setExistingPdfUrl(null);
            setFileName(null);
        }
    }, [initialData]);

    const addRecommendation = () => {
        setRecommendations([...recommendations, { recommendation: '', responsible: '', status: '' }]);
    };

    const updateRecommendation = (index, field, value) => {
        const newRecs = [...recommendations];
        newRecs[index][field] = value;
        setRecommendations(newRecs);
    };

    const removeRecommendation = (index) => {
        const newRecs = recommendations.filter((_, i) => i !== index);
        setRecommendations(newRecs);
    };

    const addPotentialFacilitator = () => {
        // We no longer need course_type
        setPotentialFacilitators([...potentialFacilitators, { participant_id: '' }]);
    };

    const updatePotentialFacilitator = (index, field, value) => {
        const newFacs = [...potentialFacilitators];
        newFacs[index][field] = value;
        setPotentialFacilitators(newFacs);
    };

    const removePotentialFacilitator = (index) => {
        const newFacs = potentialFacilitators.filter((_, i) => i !== index);
        setPotentialFacilitators(newFacs);
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        setPdfFile(file);
        if (file) {
            setFileName(file.name);
            setExistingPdfUrl(null); // Clear the existing URL when a new file is selected
        } else {
            setFileName(null);
        }
    };

    const handleSave = () => {
        const finalReportData = {
            courseId: course.id,
            summary,
            recommendations,
            // Remove course_type from the data being saved
            potentialFacilitators: potentialFacilitators.map(({ participant_id }) => ({ participant_id })),
            pdfFile,
            existingPdfUrl: existingPdfUrl, // Pass the existing URL to the parent handler
        };
        
        // Conditionally add the `id` field only if it exists (for updates)
        if (initialData?.id) {
            finalReportData.id = initialData.id;
        }

        onSave(finalReportData);
    };

    return (
        <Card>
            <PageHeader
                title={`Final Report for ${course.course_type} - ${course.state}`}
                subtitle="Complete the final report for this course."
            />
            <div className="space-y-6">
                <FormGroup label="Course Summary">
                    <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows="5" />
                </FormGroup>

                <h3 className="text-xl font-bold mb-2">Course Recommendations</h3>
                <Table headers={['Recommendation', 'Responsible', 'Status', 'Actions']}>
                    {recommendations.map((rec, index) => (
                        <tr key={index}>
                            <td className="p-2 border"><Input value={rec.recommendation} onChange={(e) => updateRecommendation(index, 'recommendation', e.target.value)} /></td>
                            <td className="p-2 border"><Input value={rec.responsible} onChange={(e) => updateRecommendation(index, 'responsible', e.target.value)} /></td>
                            <td className="p-2 border">
                                <Select value={rec.status} onChange={(e) => updateRecommendation(index, 'status', e.target.value)}>
                                    <option value="">Select Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </Select>
                            </td>
                            <td className="p-2 border">
                                <Button variant="danger" onClick={() => removeRecommendation(index)}>Remove</Button>
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan="4" className="p-2 border-t">
                            <Button variant="secondary" onClick={addRecommendation}>Add Recommendation</Button>
                        </td>
                    </tr>
                </Table>

                <h3 className="text-xl font-bold mb-2">Potential Facilitators</h3>
                <Table headers={['Participant', 'Phone Number', 'Responsible Facilitator', 'Actions']}>
                    {potentialFacilitators.map((fac, index) => {
                        const participant = participants.find(p => p.id === fac.participant_id);
                        // Find the responsible facilitator based on the participant's group
                        const responsibleFacilitator = course.facilitatorAssignments?.find(f => f.group === participant?.group);

                        return (
                            <tr key={index}>
                                <td className="p-2 border">
                                    <Select value={fac.participant_id} onChange={(e) => updatePotentialFacilitator(index, 'participant_id', e.target.value)}>
                                        <option value="">Select Participant</option>
                                        {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </Select>
                                </td>
                                <td className="p-2 border">
                                    {participant?.phone || 'N/A'}
                                </td>
                                <td className="p-2 border">
                                    {responsibleFacilitator?.name || 'N/A'}
                                </td>
                                <td className="p-2 border">
                                    <Button variant="danger" onClick={() => removePotentialFacilitator(index)}>Remove</Button>
                                </td>
                            </tr>
                        );
                    })}
                    <tr>
                        <td colSpan="4" className="p-2 border-t">
                            <Button variant="secondary" onClick={addPotentialFacilitator}>Add Potential Facilitator</Button>
                        </td>
                    </tr>
                </Table>

                <div className="space-y-2">
                    <h3 className="text-xl font-bold mb-2">Final Report PDF</h3>
                    <Table headers={['Document', 'Actions']}>
                        <tr>
                            <td className="p-2 border">
                                {existingPdfUrl ? (
                                    <div className="flex items-center gap-2">
                                        <PdfIcon className="text-blue-500 w-6 h-6" />
                                        <span>Final Report.pdf</span>
                                    </div>
                                ) : (
                                    <span className="text-gray-500">No PDF uploaded</span>
                                )}
                            </td>
                            <td className="p-2 border">
                                {existingPdfUrl ? (
                                    <div className="flex gap-2">
                                        <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer">
                                            <Button variant="info">View</Button>
                                        </a>
                                        <a href={existingPdfUrl} download="FinalReport.pdf">
                                            <Button variant="primary">Download</Button>
                                        </a>
                                        <Button
                                            variant="danger"
                                            onClick={() => {
                                                setExistingPdfUrl(null);
                                                setPdfFile(null);
                                                setFileName(null);
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 items-center">
                                        <input type="file" accept=".pdf" onChange={handleFileUpload} />
                                        {fileName && <p className="text-sm text-gray-500">File selected: {fileName}</p>}
                                    </div>
                                )}
                            </td>
                        </tr>
                    </Table>
                </div>

            </div>
            <div className="flex gap-2 justify-end mt-6 border-t pt-6">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave}>Save Final Report</Button>
            </div>
        </Card>
    );
}