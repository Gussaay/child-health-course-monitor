// src/components/FinalReportManager.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button, Card, FormGroup, Input, PageHeader, PdfIcon, Select, Table, Textarea, Spinner } from './CommonComponents';
import { Copy, Image as ImageIcon, Users, BookOpen } from 'lucide-react';
import { useDataCache } from '../DataContext';
import { STATE_LOCALITIES } from './constants';
import html2canvas from 'html2canvas'; // <-- Added proper import

// --- Shared Utility: Copy as Image ---
const copyAsImage = async (ref) => {
    try {
        const node = ref.current;
        if (!node) return;
        
        // Use the imported html2canvas directly
        const canvas = await html2canvas(node, {
            backgroundColor: '#ffffff', // Ensure white background
            scale: 2, // Better resolution
            useCORS: true // Help load external images/fonts
        });

        canvas.toBlob(async (blob) => {
            if (!blob) {
                alert("Failed to create image blob.");
                return;
            }
            try {
                // Modern Clipboard API requires secure context (HTTPS)
                const item = new window.ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                alert("Image copied to clipboard!");
            } catch (err) {
                console.error("Clipboard API failed:", err);
                alert("Failed to copy image. Your browser might require HTTPS or strict permissions.");
            }
        }, 'image/png');
    } catch (err) {
        console.error("HTML2Canvas Error:", err);
        alert("Failed to generate image.");
    }
};

// --- Sub-component for individual participant groups ---
const ParticipantGroupTable = ({ subCourse, group, participantHeaders }) => {
    const tableRef = useRef(null);

    const isArabic = subCourse && subCourse.toLowerCase().includes('medical assist');
    
    const displayHeaders = isArabic 
        ? ['الرقم', 'الاسم', 'المسمى الوظيفي', 'الولاية', 'المحلية', 'المؤسسة', 'رقم الهاتف']
        : participantHeaders;

    const getDisplayState = (state) => {
        if (!isArabic || !state) return state;
        return STATE_LOCALITIES[state]?.ar || state;
    };

    const getDisplayLocality = (state, locality) => {
        if (!isArabic || !state || !locality) return locality;
        const stateData = STATE_LOCALITIES[state];
        if (!stateData || !stateData.localities) return locality;
        const locData = stateData.localities.find(l => l.en === locality);
        return locData ? locData.ar : locality;
    };

    const copyAsText = () => {
        const rows = group.map((p, index) => [
            index + 1, 
            p.name, 
            p.job_title, 
            getDisplayState(p.state), 
            getDisplayLocality(p.state, p.locality), 
            p.center_name || p.department || 'N/A', 
            p.phone || 'N/A'
        ]);
        const tsv = [displayHeaders.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
        navigator.clipboard.writeText(tsv)
            .then(() => alert(`Table for ${subCourse} copied as text!`))
            .catch(err => alert("Failed to copy table."));
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-blue-200 overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-blue-50 border-b border-blue-200" dir={isArabic ? "rtl" : "ltr"}>
                <h4 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                    <BookOpen className={`w-5 h-5 text-blue-600 ${isArabic ? 'ml-2 mr-0' : 'mr-2 ml-0'}`} />
                    {subCourse}
                </h4>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={copyAsText} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                        <Copy className={`w-4 h-4 ${isArabic ? 'ml-2 mr-0' : 'mr-2 ml-0'}`} /> {isArabic ? 'نسخ كجدول' : 'Copy as Table'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => copyAsImage(tableRef)} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                        <ImageIcon className={`w-4 h-4 ${isArabic ? 'ml-2 mr-0' : 'mr-2 ml-0'}`} /> {isArabic ? 'نسخ كصورة' : 'Copy as Image'}
                    </Button>
                </div>
            </div>
            {/* Added styling to tableRef container so it copies cleanly */}
            <div ref={tableRef} className="bg-white overflow-x-auto p-4" dir={isArabic ? "rtl" : "ltr"}>
                <table className="min-w-full divide-y divide-blue-200">
                    <thead className="bg-blue-600">
                        <tr>
                            {displayHeaders.map((h, i) => (
                                <th key={i} className="px-4 py-3 text-start text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                        {group.map((p, i) => (
                            <tr key={i} className="hover:bg-blue-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium text-start">{i + 1}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-start">{p.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-800 bg-blue-50/50 text-start">{p.job_title}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start">{getDisplayState(p.state)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start">{getDisplayLocality(p.state, p.locality)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start">{p.center_name || p.department || 'N/A'}</td>
                                <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-start ${isArabic ? '' : 'font-mono'}`} dir="ltr">{p.phone || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Annex Section Component (Refactored to accept pre-calculated arrays) ---
const AnnexSection = ({ groupedParticipants, annexFacilitators }) => {
    const facilitatorTableRef = useRef(null);

    const facilitatorHeaders = ['#', 'Facilitator Name', 'Phone Number', 'Qualification'];
    const participantHeaders = ['#', 'Participant Name', 'Job Title', 'State', 'Locality', 'Facility', 'Phone Number'];

    const copyFacilitatorsAsText = () => {
        const rows = annexFacilitators.map((f, i) => [i + 1, f.name, f.phone, f.qualification]);
        const tsv = [facilitatorHeaders.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
        navigator.clipboard.writeText(tsv)
            .then(() => alert("Table copied as text!"))
            .catch(err => alert("Failed to copy table."));
    };

    return (
        <div className="mt-10 pt-8 border-t-2 border-blue-200">
            <h2 className="text-2xl font-extrabold mb-6 text-blue-900">Annex: Detailed Rosters</h2>

            {/* Facilitators Table */}
            <div className="mb-10">
                <div className="bg-white rounded-xl shadow-md border border-blue-200 overflow-hidden">
                    <div className="flex justify-between items-center p-4 bg-blue-50 border-b border-blue-200">
                        <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                            <Users className="w-6 h-6 text-blue-600" />
                            Course Facilitators
                        </h3>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={copyFacilitatorsAsText} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                                <Copy className="w-4 h-4 mr-2" /> Copy as Table
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => copyAsImage(facilitatorTableRef)} className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100">
                                <ImageIcon className="w-4 h-4 mr-2" /> Copy as Image
                            </Button>
                        </div>
                    </div>
                    
                    <div ref={facilitatorTableRef} className="bg-white overflow-x-auto p-4">
                        <table className="min-w-full divide-y divide-blue-200">
                            <thead className="bg-blue-600">
                                <tr>
                                    {facilitatorHeaders.map((h, i) => (
                                        <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-blue-100">
                                {annexFacilitators.length > 0 ? annexFacilitators.map((f, i) => (
                                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">{i + 1}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold">{f.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-mono">{f.phone}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-800 bg-blue-50/50">{f.qualification}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500 italic">No facilitators found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Participants Tables by Sub-course */}
            <div>
                <h3 className="text-xl font-bold text-blue-900 mb-6 flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    Course Participants (By Sub-course)
                </h3>
                
                <div className="space-y-8">
                    {Object.keys(groupedParticipants).length > 0 ? (
                        Object.entries(groupedParticipants).map(([subCourse, group]) => (
                            <ParticipantGroupTable 
                                key={subCourse}
                                subCourse={subCourse}
                                group={group}
                                participantHeaders={participantHeaders}
                            />
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-blue-200 italic">
                            No participants found for this course.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export function FinalReportManager({ 
    course, participants, onCancel, onSave, initialData, 
    canUseFederalManagerAdvancedFeatures
}) {
    const { facilitators } = useDataCache();
    const facilitatorsList = facilitators || [];

    const [isEditing, setIsEditing] = useState(!initialData);
    const [isDownloading, setIsDownloading] = useState(false);

    // State for all form fields
    const [summary, setSummary] = useState('');
    const [recommendations, setRecommendations] = useState([{ recommendation: '', responsible: '', status: '' }]);
    const [potentialFacilitators, setPotentialFacilitators] = useState([]);
    const [pdfFile, setPdfFile] = useState(null);
    const [existingPdfUrl, setExistingPdfUrl] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [galleryImageFiles, setGalleryImageFiles] = useState({});
    const [galleryImageUrls, setGalleryImageUrls] = useState(Array(3).fill(null));
    const [participantsForFollowUp, setParticipantsForFollowUp] = useState([{ participant_id: '', phone: '', comment: '' }]);

    // --- SNAPSHOT CALCULATION LOGIC ---
    // We calculate these based on current state so we can save them as a snapshot
    const currentAnnexFacilitators = useMemo(() => {
        const names = new Set();
        if (course.director) names.add(course.director);
        if (course.clinical_instructor) names.add(course.clinical_instructor);
        if (course.facilitators) course.facilitators.forEach(f => names.add(f));

        return Array.from(names).map(name => {
            const details = facilitatorsList.find(f => f.name === name) || {};
            return {
                name,
                phone: details.phone || 'N/A',
                qualification: details.backgroundQualification === 'Other' 
                    ? details.backgroundQualificationOther 
                    : (details.backgroundQualification || 'N/A')
            };
        });
    }, [course, facilitatorsList]);

    const currentGroupedParticipants = useMemo(() => {
        const groups = {};
        (participants || []).forEach(p => {
            const subCourse = p.imci_sub_type || course?.facilitatorAssignments?.find(a => a.group === p.group)?.imci_sub_type || 'Unspecified Sub-course';
            if (!groups[subCourse]) groups[subCourse] = [];
            groups[subCourse].push(p);
        });
        return groups;
    }, [participants, course]);

    // Use saved snapshot if viewing, otherwise use currently calculated data
    const finalAnnexFacilitators = initialData?.annexFacilitators || currentAnnexFacilitators;
    const finalGroupedParticipants = initialData?.groupedParticipants || currentGroupedParticipants;
    // ----------------------------------

    useEffect(() => {
        if (initialData) {
            setSummary(initialData.summary || '');
            setRecommendations(initialData.recommendations && initialData.recommendations.length > 0 ? initialData.recommendations : [{ recommendation: '', responsible: '', status: '' }]);
            setPotentialFacilitators(initialData.potentialFacilitators || []);
            setExistingPdfUrl(initialData.pdfUrl || null);
            setFileName(initialData.pdfUrl ? 'Existing PDF' : null);
            
            const existingImages = initialData.galleryImageUrls || [];
            const urls = Array(3).fill(null);
            existingImages.forEach((url, index) => urls[index] = url);
            setGalleryImageUrls(urls);
            
            setParticipantsForFollowUp(initialData.participantsForFollowUp && initialData.participantsForFollowUp.length > 0 ? initialData.participantsForFollowUp : [{ participant_id: '', phone: '', comment: '' }]);

            setIsEditing(false); 
        } else {
            setIsEditing(true);
            setSummary('');
            setRecommendations([{ recommendation: '', responsible: '', status: '' }]);
            setPotentialFacilitators([]);
            setPdfFile(null);
            setExistingPdfUrl(null);
            setFileName(null);
            setGalleryImageUrls(Array(3).fill(null));
            setGalleryImageFiles({});
            setParticipantsForFollowUp([{ participant_id: '', phone: '', comment: '' }]);
        }
    }, [initialData]);

    const handleCancelEdit = () => {
        if (initialData) {
            setIsEditing(false);
        } else {
            onCancel();
        }
    };
    
    const handleForceDownload = async (url, filename) => {
        setIsDownloading(true);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok.');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSave = async () => {
        const finalPotentialFacilitators = potentialFacilitators
            .filter(f => f.participant_id)
            .map(fac => {
                const participant = participants.find(p => p.id === fac.participant_id);
                return {
                    participant_id: fac.participant_id,
                    participant_name: participant ? participant.name : (fac.participant_name || 'N/A') 
                };
            });

        const finalReportData = {
            courseId: course.id,
            summary,
            recommendations: recommendations.filter(r => r.recommendation),
            potentialFacilitators: finalPotentialFacilitators,
            pdfFile,
            existingPdfUrl: existingPdfUrl,
            originalGalleryUrls: initialData?.galleryImageUrls || [],
            finalGalleryUrls: galleryImageUrls,
            galleryImageFiles: galleryImageFiles,
            participantsForFollowUp: participantsForFollowUp.filter(p => p.participant_id),
            // INCLUDE TABLES IN SAVE PAYLOAD AS SNAPSHOTS
            annexFacilitators: currentAnnexFacilitators,
            groupedParticipants: currentGroupedParticipants
        };
        
        if (initialData?.id) {
            finalReportData.id = initialData.id;
        }

        await onSave(finalReportData);
    };
    
    const addRecommendation = () => setRecommendations([...recommendations, { recommendation: '', responsible: '', status: '' }]);
    const updateRecommendation = (index, field, value) => {
        const newRecs = [...recommendations];
        newRecs[index][field] = value;
        setRecommendations(newRecs);
    };
    const removeRecommendation = (index) => setRecommendations(recommendations.filter((_, i) => i !== index));

    const addPotentialFacilitator = () => setPotentialFacilitators([...potentialFacilitators, { participant_id: '', participant_name: '' }]);
    const updatePotentialFacilitator = (index, value) => {
        const selectedParticipant = participants.find(p => p.id === value);
        const newFacs = [...potentialFacilitators];
        newFacs[index] = {
            participant_id: value,
            participant_name: selectedParticipant ? selectedParticipant.name : ''
        };
        setPotentialFacilitators(newFacs);
    };
    const removePotentialFacilitator = (index) => setPotentialFacilitators(potentialFacilitators.filter((_, i) => i !== index));

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        setPdfFile(file);
        if (file) {
            setFileName(file.name);
            setExistingPdfUrl(null);
        } else {
            setFileName(null);
        }
    };
    
    const handleGalleryImageUpload = (e, index) => {
        const file = e.target.files[0];
        if (file) {
            setGalleryImageFiles(prev => ({...prev, [index]: file}));
            const reader = new FileReader();
            reader.onload = (event) => {
                const newUrls = [...galleryImageUrls];
                newUrls[index] = event.target.result;
                setGalleryImageUrls(newUrls);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteGalleryImage = (index) => {
        setGalleryImageFiles(prev => ({...prev, [index]: undefined}));
        const newUrls = [...galleryImageUrls];
        newUrls[index] = null;
        setGalleryImageUrls(newUrls);
    };

    const addFollowUpParticipant = () => setParticipantsForFollowUp([...participantsForFollowUp, { participant_id: '', phone: '', comment: '' }]);
    const removeFollowUpParticipant = (index) => setParticipantsForFollowUp(participantsForFollowUp.filter((_, i) => i !== index));
    const updateFollowUpParticipant = (index, field, value) => {
        const newFollowUps = [...participantsForFollowUp];
        const currentItem = { ...newFollowUps[index] };
        currentItem[field] = value;
        
        if (field === 'participant_id') {
            const participant = participants.find(p => p.id === value);
            currentItem.phone = participant?.phone || 'N/A';
            currentItem.participant_name = participant?.name || '';
        }
        
        newFollowUps[index] = currentItem;
        setParticipantsForFollowUp(newFollowUps);
    };

    if (isEditing) {
        return (
            <Card>
                <PageHeader title={`${initialData ? 'Edit' : 'Create'} Final Report for ${course.course_type} - ${course.state}`} subtitle="Complete the final report for this course." />
                <div className="space-y-6 mt-6 p-6">
                    <FormGroup label="Course Summary"><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows="5" /></FormGroup>
                    
                    <h3 className="text-xl font-bold mb-2">Course Recommendations</h3>
                    <Table headers={['Recommendation', 'Responsible', 'Status', 'Actions']}>
                        {recommendations.map((rec, index) => (
                            <tr key={index}>
                                <td className="p-2 border"><Input value={rec.recommendation} onChange={(e) => updateRecommendation(index, 'recommendation', e.target.value)} /></td>
                                <td className="p-2 border"><Input value={rec.responsible} onChange={(e) => updateRecommendation(index, 'responsible', e.target.value)} /></td>
                                <td className="p-2 border"><Select value={rec.status} onChange={(e) => updateRecommendation(index, 'status', e.target.value)}><option value="">Select Status</option><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option></Select></td>
                                <td className="p-2 border"><Button variant="danger" onClick={() => removeRecommendation(index)}>Remove</Button></td>
                            </tr>
                        ))}
                        <tr><td colSpan="4" className="p-2 border-t"><Button variant="secondary" onClick={addRecommendation}>Add Recommendation</Button></td></tr>
                    </Table>

                    <h3 className="text-xl font-bold mb-2">Potential Facilitators</h3>
                    <Table headers={['Participant', 'Phone Number', 'Responsible Facilitator', 'Actions']}>
                        {potentialFacilitators.map((fac, index) => {
                            const participant = participants.find(p => p.id === fac.participant_id);
                            const responsibleFacilitator = course.facilitatorAssignments?.find(f => f.group === participant?.group);
                            return (
                                <tr key={index}>
                                    <td className="p-2 border"><Select value={fac.participant_id} onChange={(e) => updatePotentialFacilitator(index, e.target.value)}><option value="">Select Participant</option>{(participants || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></td>
                                    <td className="p-2 border">{participant?.phone || 'N/A'}</td>
                                    <td className="p-2 border">{responsibleFacilitator?.name || 'N/A'}</td>
                                    <td className="p-2 border"><Button variant="danger" onClick={() => removePotentialFacilitator(index)}>Remove</Button></td>
                                </tr>
                            );
                        })}
                        <tr><td colSpan="4" className="p-2 border-t"><Button variant="secondary" onClick={addPotentialFacilitator}>Add Potential Facilitator</Button></td></tr>
                    </Table>

                    <h3 className="text-xl font-bold mb-2">Participants Requiring Follow-up</h3>
                    <Table headers={['Participant', 'Phone Number', 'Comment / Action Required', 'Actions']}>
                        {participantsForFollowUp.map((p, index) => (
                            <tr key={index}>
                                <td className="p-2 border" style={{width: '25%'}}><Select value={p.participant_id} onChange={(e) => updateFollowUpParticipant(index, 'participant_id', e.target.value)}><option value="">Select Participant</option>{(participants || []).map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}</Select></td>
                                <td className="p-2 border" style={{width: '15%'}}>{p.phone || 'N/A'}</td>
                                <td className="p-2 border"><Input value={p.comment} onChange={(e) => updateFollowUpParticipant(index, 'comment', e.target.value)} placeholder="e.g., Needs more clinical practice" /></td>
                                <td className="p-2 border" style={{width: '10%'}}><Button variant="danger" onClick={() => removeFollowUpParticipant(index)}>Remove</Button></td>
                            </tr>
                        ))}
                        <tr><td colSpan="4" className="p-2 border-t"><Button variant="secondary" onClick={addFollowUpParticipant}>Add Participant</Button></td></tr>
                    </Table>

                    <h3 className="text-xl font-bold mb-2">Course Gallery (up to 3 images)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[0, 1, 2].map(index => (
                            <div key={index} className="border rounded-lg p-3 flex flex-col items-center justify-center space-y-2">
                                {galleryImageUrls[index] ? (
                                    <>
                                        <img src={galleryImageUrls[index]} alt={`Gallery item ${index + 1}`} className="w-full h-32 object-cover rounded-md" />
                                        <Button variant="danger" size="sm" onClick={() => handleDeleteGalleryImage(index)}>Remove Image</Button>
                                    </>
                                ) : (
                                    <div className="text-center">
                                        <label htmlFor={`gallery-upload-${index}`} className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold">Click to upload image</label>
                                        <input id={`gallery-upload-${index}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleGalleryImageUpload(e, index)} />
                                        <p className="text-xs text-gray-500 mt-1">Image {index + 1}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <h3 className="text-xl font-bold mb-2">Final Report PDF</h3>
                    <Table headers={['Document', 'Actions']}>
                        <tbody>
                            <tr>
                                <td className="p-2 border">{existingPdfUrl ? <div className="flex items-center gap-2"><PdfIcon className="text-blue-500 w-6 h-6" /><span>Final Report.pdf</span></div> : <span className="text-gray-500">No PDF uploaded</span>}</td>
                                <td className="p-2 border">
                                    {existingPdfUrl ? (
                                        <div className="flex gap-2">
                                            <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer"><Button variant="info">View</Button></a>
                                            <Button variant="primary" onClick={() => handleForceDownload(existingPdfUrl, `Final_Report_${course.course_type}_${course.state}.pdf`)} disabled={isDownloading}>{isDownloading ? <Spinner/> : 'Download'}</Button>
                                            <Button variant="danger" onClick={() => { setExistingPdfUrl(null); setPdfFile(null); setFileName(null); }}>Delete</Button>
                                        </div>
                                    ) : ( <div className="flex gap-2 items-center"><input type="file" accept=".pdf" onChange={handleFileUpload} />{fileName && <p className="text-sm text-gray-500">File selected: {fileName}</p>}</div> )}
                                </td>
                            </tr>
                        </tbody>
                    </Table>

                    <AnnexSection 
                        groupedParticipants={currentGroupedParticipants} 
                        annexFacilitators={currentAnnexFacilitators} 
                    />
                </div>
                <div className="flex gap-2 justify-end mt-6 border-t pt-6 px-6 pb-6"><Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button><Button onClick={handleSave}>Save Final Report</Button></div>
            </Card>
        );
    }

    const finalGalleryUrls = initialData?.galleryImageUrls?.filter(url => url) || [];
    const finalFollowUpList = initialData?.participantsForFollowUp?.filter(p => p.participant_id) || [];
    const finalSummary = initialData?.summary || 'No summary provided.';
    const finalRecommendations = initialData?.recommendations?.filter(r => r.recommendation) || [];
    const finalFacilitatorList = initialData?.potentialFacilitators?.filter(f => f.participant_id) || [];

    return (
        <Card>
            <PageHeader 
                title={`Final Report for ${course.course_type} - ${course.state}`} 
                subtitle="Review the summary, recommendations, and documents for this course." 
                actions={canUseFederalManagerAdvancedFeatures && <Button onClick={() => setIsEditing(true)}>Edit Report</Button>} 
            />
            <div className="space-y-8 mt-6 p-6">
                <div><h3 className="text-xl font-bold mb-2 text-gray-800">Course Summary</h3><p className="text-gray-700 whitespace-pre-wrap">{finalSummary}</p></div>
                
                <div><h3 className="text-xl font-bold mb-2 text-gray-800">Course Recommendations</h3><Table headers={['#', 'Recommendation', 'Responsible', 'Status']}>{finalRecommendations.length > 0 ? (finalRecommendations.map((rec, index) => (<tr key={index}><td className="p-2 border">{index + 1}</td><td className="p-2 border">{rec.recommendation}</td><td className="p-2 border">{rec.responsible}</td><td className="p-2 border capitalize">{rec.status}</td></tr>))) : (<tr><td colSpan="4" className="p-4 text-center text-gray-500">No recommendations were made.</td></tr>)}</Table></div>
                
                <div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">Potential Facilitators</h3>
                    <Table headers={['#', 'Participant Name', 'Phone Number', 'Responsible Facilitator']}>
                        {finalFacilitatorList.length > 0 ? (
                            finalFacilitatorList.map((fac, index) => {
                                const participant = participants.find(p => p.id === fac.participant_id);
                                const responsibleFacilitator = course.facilitatorAssignments?.find(f => f.group === participant?.group);
                                
                                return (
                                    <tr key={index}>
                                        <td className="p-2 border">{index + 1}</td>
                                        <td className="p-2 border">{fac.participant_name || 'N/A'}</td>
                                        <td className="p-2 border">{participant?.phone || 'N/A'}</td>
                                        <td className="p-2 border">{responsibleFacilitator?.name || 'N/A'}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr><td colSpan="4" className="p-4 text-center text-gray-500">No potential facilitators were identified.</td></tr>
                        )}
                    </Table>
                </div>
                
                <div><h3 className="text-xl font-bold mb-2 text-gray-800">Participants Requiring Follow-up</h3><Table headers={['#', 'Participant Name', 'Phone', 'Comment / Action Required']}>{finalFollowUpList.length > 0 ? (finalFollowUpList.map((p, index) => (<tr key={index}><td className="p-2 border">{index + 1}</td><td className="p-2 border">{p.participant_name}</td><td className="p-2 border">{p.phone}</td><td className="p-2 border">{p.comment}</td></tr>))) : (<tr><td colSpan="4" className="p-4 text-center text-gray-500">No participants were marked for follow-up.</td></tr>)}</Table></div>
                
                <div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">Course Gallery</h3>
                    {finalGalleryUrls.length > 0 ? (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">{finalGalleryUrls.map((url, index) => (<a key={index} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Gallery item ${index + 1}`} className="w-full h-48 object-cover rounded-lg shadow-md hover:shadow-xl transition-shadow" /></a>))}</div>) : (<p className="text-gray-500">No images were added to the gallery.</p>)}
                </div>
                {existingPdfUrl && (<div><h3 className="text-xl font-bold mb-2 text-gray-800">Final Report Document</h3><div className="border rounded-lg p-4 flex items-center justify-between"><a href={existingPdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-2 font-semibold"><PdfIcon className="text-blue-500 w-6 h-6" /><span>View Uploaded PDF</span></a><Button variant="secondary" onClick={() => handleForceDownload(existingPdfUrl, `Final_Report_${course.course_type}_${course.state}.pdf`)} disabled={isDownloading}>{isDownloading ? <Spinner/> : 'Download'}</Button></div></div>)}
                
                <AnnexSection 
                    groupedParticipants={finalGroupedParticipants} 
                    annexFacilitators={finalAnnexFacilitators} 
                />
            </div>
            <div className="flex justify-end mt-6 border-t pt-6 px-6 pb-6"><Button variant="secondary" onClick={onCancel}>Back</Button></div>
        </Card>
    );
}