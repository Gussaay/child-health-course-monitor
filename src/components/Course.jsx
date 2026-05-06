// src/components/Course.jsx
import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import jsPDF from "jspdf";
import { 
    Button, Card, EmptyState, FormGroup, Input, PageHeader, 
    Select, Spinner, Table, CourseIcon, Modal, CardBody, CardFooter, Toast 
} from './CommonComponents'; 

// --- Firebase Imports ---
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

import { 
    getCourseById, 
    listHealthFacilities,
    upsertCourse,   
    deleteCourse,
    saveParticipantAndSubmitFacilityUpdate,
    upsertParticipantTest,
    listAllCourses,
    listFederalCoordinators,
    unapproveCourseCertificates,
    uploadFile,
    getParticipantById, 
    listAllParticipantsForCourse 
} from '../data.js'; 

import { ParticipantsView } from './Participants';
import { CourseTestForm } from './CourseTestForm'; 
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_SSNC
} from './constants.js';
import { 
    Users, Share2, UserPlus, CheckCircle, 
    FileText, Edit, Trash2, ExternalLink, Link as LinkIcon, Eye, BarChart2,
    AlertTriangle, Shield, Check, X, RefreshCw, Archive, ClipboardList,
    Award, FileSignature, Stamp, Upload, Lock, XCircle
} from 'lucide-react'; 
import { useDataCache } from '../DataContext'; 
import { useAuth } from '../hooks/useAuth'; 
import { Capacitor } from '@capacitor/core';

// NEW IMPORTS FOR MIGRATED DASHBOARDS
import SudanMap from '../SudanMap';
import CompiledReportView from './CompiledReportView.jsx';

// Certificate generator import required for the public view components
import { generateCertificatePdf, generateBlankCertificatePdf } from './CertificateGenerator';

// Lazy load components that are not always visible to speed up initial load
const ReportsView = React.lazy(() => import('./ReportsView').then(module => ({ default: module.ReportsView })));
const ObservationView = React.lazy(() => import('./MonitoringView').then(module => ({ default: module.ObservationView })));


// Helper functions 
const IccmIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline><path d="M12 9v6"></path><path d="M9 12h6"></path></svg>;
const IpcIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 11v4"></path><path d="M10 13h4"></path></svg>;
const NewbornIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9c0-2-1.5-3.5-4-3.5C7.5 5.5 6 7 6 9c0 1.5.5 2.5 1 3.5h0l-1 4.5h10L17 17l-1-4.5h0c.5-1 1-2.5 1-3.5z"></path><path d="M12 18h.01"></path><path d="M10.5 21v-1.5h3V21"></path></svg>;

// ============================================================================
// PUBLIC CERTIFICATE VIEWS
// ============================================================================

export function CertificateVerificationView({ participant, course }) {
    if (!participant || !course) return <EmptyState message="Invalid certificate data." />;
    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg text-center border border-gray-100">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6 shadow-inner">
                <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Certificate Verified</h2>
            <p className="text-gray-600 mb-4 font-medium">This certificate was authentically issued to:</p>
            <h3 className="text-2xl font-black text-sky-700 mb-2">{participant.name}</h3>
            <p className="text-sm text-gray-500 mb-6 font-semibold uppercase tracking-wider">For completing: {course.course_type}</p>
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-left text-sm text-gray-700 space-y-2">
                <p className="flex justify-between border-b border-gray-200 pb-2"><strong className="text-gray-500 uppercase tracking-wide text-xs">Course Location:</strong> <span className="font-bold">{course.state} - {course.locality}</span></p>
                <p className="flex justify-between"><strong className="text-gray-500 uppercase tracking-wide text-xs">Date:</strong> <span className="font-bold">{course.start_date}</span></p>
            </div>
        </div>
    );
}

export function PublicCertificateDownloadView({ participantId }) {
    const { facilitators, federalCoordinators, fetchFacilitators, fetchFederalCoordinators } = useDataCache();
    useEffect(() => { fetchFacilitators(); fetchFederalCoordinators(); }, []);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const p = await getParticipantById(participantId, 'server');
                if (!p) throw new Error("Participant not found.");
                const c = await getCourseById(p.courseId, 'server');
                if (!c) throw new Error("Course not found.");
                if (!c.isCertificateApproved) throw new Error("Certificates for this course are not yet approved or have been revoked.");
                setData({ participant: p, course: c });
            } catch(e) { setError(e.message); }
            finally { setLoading(false); }
        };
        load();
    }, [participantId]);

    const handleDownload = async (lang) => {
        setDownloading(true);
        try {
            const managerName = data.course.approvedByManagerName || "Federal Program Manager";
            let subcourse = data.participant.imci_sub_type || data.course.director_imci_sub_type;
            const canvas = await generateCertificatePdf(data.course, data.participant, managerName, subcourse, lang, facilitators, federalCoordinators);
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 297, 210);
                doc.save(`Certificate_${data.participant.name.replace(/\s+/g, '_')}_${lang}.pdf`);
            }
        } catch(e) { alert("Download failed: " + e.message); }
        finally { setDownloading(false); }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;

    return (
        <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-2xl shadow-xl text-center border border-gray-100">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-sky-100 mb-6 shadow-inner">
                <Award className="h-10 w-10 text-sky-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Download Certificate</h2>
            <p className="text-gray-500 mb-6 text-sm">Participant:</p>
            <h3 className="text-xl font-bold text-sky-700 mb-8">{data.participant.name}</h3>
            <div className="flex flex-col gap-3">
                <Button onClick={() => handleDownload('en')} disabled={downloading} className="w-full justify-center shadow-md">
                    {downloading ? <Spinner size="sm" /> : 'Download (English)'}
                </Button>
                <Button onClick={() => handleDownload('ar')} disabled={downloading} variant="secondary" className="w-full justify-center">
                    {downloading ? <Spinner size="sm" /> : 'Download (Arabic - عربي)'}
                </Button>
            </div>
        </div>
    );
}

export function PublicCourseCertificatesView({ courseId }) {
    const { facilitators, federalCoordinators, fetchFacilitators, fetchFederalCoordinators } = useDataCache();
    useEffect(() => { fetchFacilitators(); fetchFederalCoordinators(); }, []);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const c = await getCourseById(courseId, 'server');
                if (!c) throw new Error("Course not found.");
                if (!c.isCertificateApproved) throw new Error("Certificates for this course are not yet approved or have been revoked.");
                const parts = await listAllParticipantsForCourse(courseId, { source: 'server' });
                const activeParts = parts.filter(p => !p.isDeleted);
                setData({ course: c, participants: activeParts });
            } catch(e) { setError(e.message); }
            finally { setLoading(false); }
        };
        load();
    }, [courseId]);

    const handleDownload = async (p, lang) => {
        setDownloadingId(p.id);
        try {
            const managerName = data.course.approvedByManagerName || "Federal Program Manager";
            let subcourse = p.imci_sub_type || data.course.director_imci_sub_type;
            const canvas = await generateCertificatePdf(data.course, p, managerName, subcourse, lang, facilitators, federalCoordinators);
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 297, 210);
                doc.save(`Certificate_${p.name.replace(/\s+/g, '_')}_${lang}.pdf`);
            }
        } catch(e) { alert("Download failed: " + e.message); }
        finally { setDownloadingId(null); }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;

    return (
        <Card className="p-6">
            <PageHeader title="Course Certificates" subtitle={`${data.course.course_type} - ${data.course.state} / ${data.course.locality}`} />
            
            <div className="bg-sky-50 text-sky-800 p-4 rounded-lg text-sm border border-sky-100 mb-6 flex items-start">
                <Award className="w-5 h-5 mr-3 shrink-0" />
                <p>Welcome. You can download certificates for any active participant from this course using the buttons below.</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <Table headers={["Participant Name", "Job Title", "Download Action"]}>
                    {data.participants.map(p => (
                        <tr key={p.id} className="hover:bg-sky-50/50 transition-colors">
                            <td className="p-4 font-bold text-gray-800">{p.name}</td>
                            <td className="p-4 text-gray-600 font-medium">{p.job_title}</td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <Button size="sm" onClick={() => handleDownload(p, 'en')} disabled={!!downloadingId}>
                                    {downloadingId === p.id ? <Spinner size="sm" /> : 'English'}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => handleDownload(p, 'ar')} disabled={!!downloadingId}>
                                    {downloadingId === p.id ? <Spinner size="sm" /> : 'عربي'}
                                </Button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
        </Card>
    );
}

// ============================================================================


export const PublicParticipantRegistrationModal = ({ isOpen, onClose, course, onSuccess }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [group, setGroup] = useState('Group A');
    const [facilityId, setFacilityId] = useState('');
    const [facilityName, setFacilityName] = useState(''); 
    
    const [facilities, setFacilities] = useState([]);
    const [loadingFacilities, setLoadingFacilities] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [isFacilitySelectorOpen, setIsFacilitySelectorOpen] = useState(false);

    const jobOptions = useMemo(() => {
        if (course.course_type === 'ICCM') return ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
        if (course.course_type === 'Small & Sick Newborn' || course.course_type === 'SSNC') return JOB_TITLES_SSNC;
        return ['Medical Doctor', 'Nurse', 'Midwife', 'Medical Assistant', 'Health Visitor', 'Nutritionist', 'Vaccinator'];
    }, [course.course_type]);

    useEffect(() => {
        if (course.state && course.locality && isOpen) {
            setLoadingFacilities(true);
            listHealthFacilities({ state: course.state, locality: course.locality }, 'server')
                .then(data => {
                    const formatted = data.map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }));
                    setFacilities(formatted);
                })
                .catch(err => console.error("Failed to load facilities", err))
                .finally(() => setLoadingFacilities(false));
        }
    }, [course.state, course.locality, isOpen]);

    const handleSave = async () => {
        setError('');
        if (!name.trim()) return setError('Name is required');
        if (!phone.trim()) return setError('Phone is required');
        if (!jobTitle) return setError('Job Title is required');
        if (!facilityId) return setError('Please select a valid Facility from the list'); 

        setIsSaving(true);
        try {
            const participantData = {
                name: name.trim(),
                phone: phone.trim(),
                job_title: jobTitle,
                group: group,
                state: course.state,
                locality: course.locality,
                center_name: facilityName, 
                courseId: course.id,
                facilityId: facilityId 
            };

            await saveParticipantAndSubmitFacilityUpdate(participantData, null, 'Public Form');
            
            if (onSuccess) onSuccess(participantData);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFacilitySelect = (fac) => {
        setFacilityId(fac.id);
        setFacilityName(fac.name);
        setIsFacilitySelectorOpen(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={isSaving ? null : onClose} title="Register New Participant" size="lg">
            <CardBody className="p-6">
                {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormGroup label="Full Name">
                        <Input disabled={isSaving} value={name} onChange={e => setName(e.target.value)} placeholder="Enter full name" />
                    </FormGroup>
                    <FormGroup label="Phone Number">
                        <Input disabled={isSaving} value={phone} onChange={e => setPhone(e.target.value)} placeholder="0xxxxxxxxx" />
                    </FormGroup>
                    
                    <FormGroup label="Job Title">
                        <Select disabled={isSaving} value={jobTitle} onChange={e => setJobTitle(e.target.value)}>
                            <option value="">-- Select Job --</option>
                            {jobOptions.map(j => <option key={j} value={j}>{j}</option>)}
                        </Select>
                    </FormGroup>

                    <FormGroup label="Group">
                        <Select disabled={isSaving} value={group} onChange={e => setGroup(e.target.value)}>
                            <option>Group A</option>
                            <option>Group B</option>
                            <option>Group C</option>
                            <option>Group D</option>
                        </Select>
                    </FormGroup>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Health Facility (in {course.locality})
                        </label>
                        
                        <div className="relative">
                            <Input 
                                value={facilityName} 
                                onChange={(e) => {
                                    setFacilityName(e.target.value);
                                    setFacilityId(''); 
                                    setIsFacilitySelectorOpen(true);
                                }}
                                onFocus={() => setIsFacilitySelectorOpen(true)}
                                placeholder="Search facility name..."
                                disabled={loadingFacilities || isSaving}
                            />
                            {loadingFacilities && <div className="absolute right-3 top-2.5"><Spinner size="sm" /></div>}
                            
                            {isFacilitySelectorOpen && !isSaving && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {facilities.length > 0 ? (
                                        facilities
                                            .filter(f => f.name.toLowerCase().includes(facilityName.toLowerCase()))
                                            .map(f => (
                                                <div 
                                                    key={f.id} 
                                                    className="p-2 cursor-pointer hover:bg-gray-100"
                                                    onClick={() => handleFacilitySelect(f)}
                                                >
                                                    {f.name}
                                                </div>
                                            ))
                                    ) : (
                                        <div className="p-2 text-gray-500">No facilities found.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardBody>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Spinner size="sm" /> : 'Register & Save'}
                </Button>
            </CardFooter>
        </Modal>
    );
};

export function PublicParticipantRegistrationView({ courseId }) {
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        getCourseById(courseId, 'server')
            .then(data => {
                if (!data) throw new Error("Course not found");
                setCourse(data);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [courseId]);

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;
    if (!course) return <EmptyState message="Course data unavailable" />;

    if (successMessage) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful</h2>
                <p className="text-gray-600 mb-6">{successMessage}</p>
                <Button onClick={() => setSuccessMessage('')}>Register Another Participant</Button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto mt-6 p-4">
            <Card className="text-center p-8">
                <div className="mx-auto h-20 w-20 bg-sky-100 rounded-full flex items-center justify-center mb-6">
                    <UserPlus className="h-10 w-10 text-sky-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Course Registration</h1>
                <p className="text-lg text-gray-600 mb-1">{course.course_type}</p>
                <p className="text-sm text-gray-500 mb-8">{course.state} - {course.locality} ({course.start_date})</p>

                <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6 text-left text-sm text-blue-800">
                    <p><strong>Note:</strong> Use this form to register yourself or a participant if you are not already on the list.</p>
                </div>

                <Button size="lg" className="w-full justify-center" onClick={() => setShowModal(true)}>
                    Register New Participant
                </Button>
            </Card>

            <PublicParticipantRegistrationModal 
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                course={course}
                onSuccess={(participant) => {
                    setSuccessMessage(`Successfully registered ${participant.name}.`);
                    setShowModal(false);
                }}
            />
        </div>
    );
}

const Landing = React.memo(function Landing({ active, onPick }) {
   const items = [
        { key: 'IMNCI', title: 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)', enabled: true },
        { key: 'ICCM', title: 'Integrated Community case management for under 5 children (iCCM)', enabled: true },
        { key: 'ETAT', title: 'Emergency Triage, Assessment & Treatment (ETAT)', enabled: true },
        { key: 'EENC', title: 'Early Essential Newborn Care (EENC)', enabled: true },
        { key: 'IPC', title: 'Infection Prevention & Control (Neonatal Unit)', enabled: true },
        { key: 'Small & Sick Newborn', title: 'Small & Sick Newborn Case Management', enabled: true },
        { key: 'Program Management', title: 'Program Management', enabled: true },
    ];

    return (
        <Card className="p-6">
            <PageHeader title="Select a Course Package" subtitle="Choose a monitoring package to begin." />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(it => (
                    <button key={it.key} disabled={!it.enabled} className={`border rounded-lg p-6 text-left transition-all duration-200 ${active === it.key ? 'ring-2 ring-sky-500 shadow-lg' : ''} ${it.enabled ? 'hover:shadow-md hover:scale-105' : 'opacity-60 cursor-not-allowed bg-gray-50'}`} onClick={() => it.enabled && onPick(it.key)}>
                        <div className="flex items-center gap-4">
                            {it.key === 'ICCM' ? <IccmIcon className="w-10 h-10 text-slate-500 flex-shrink-0" /> :
                             it.key === 'IPC' ? <IpcIcon className="w-10 h-10 text-slate-500 flex-shrink-0" /> :
                             it.key === 'Small & Sick Newborn' ? <NewbornIcon className="w-10 h-10 text-slate-500 flex-shrink-0" /> :
                             it.key === 'Program Management' ? <ClipboardList className="w-10 h-10 text-slate-500 flex-shrink-0" /> :
                                <CourseIcon course={it.key} />
                             }
                            <div>
                                <div className="font-semibold text-gray-800">{it.title}</div>
                                <div className="text-xs text-gray-500 mt-1">{it.enabled ? 'Click to manage courses' : 'Coming Soon'}</div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </Card>
    );
});


export function CoursesTable({ 
    courses, onOpen, onEdit, onDelete, onOpenReport, onOpenTestForm, 
    canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates, userLocalities, onAddFinalReport, canManageFinalReport,
    onOpenAttendanceManager, isProcessing 
}) {
    const [shareModalCourse, setShareModalCourse] = useState(null);
    const [reportModalCourse, setReportModalCourse] = useState(null);
     
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

    // Accordion State for Mobile View
    const [expandedId, setExpandedId] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    const getBaseUrl = () => Capacitor.isNativePlatform() ? 'https://imnci-courses-monitor.web.app' : window.location.origin;

    const shareViaWhatsApp = (textToShare, successMessage) => {
        navigator.clipboard.writeText(textToShare).then(() => {
            if (Capacitor.isNativePlatform()) {
                window.open(`whatsapp://send?text=${encodeURIComponent(textToShare)}`, '_system');
            } else {
                alert(successMessage || 'Link copied!');
            }
        }).catch(() => {
            alert('Failed to copy text. Please try again.');
        });
    };

    useEffect(() => { setCurrentPage(1); }, [courses, itemsPerPage]);

    const isCourseActive = (course) => {
        if (course.approvalStatus === 'pending') return false; 
        if (!course.start_date || !course.course_duration || course.course_duration <= 0) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(course.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + course.course_duration);
        return today >= startDate && today < endDate;
    };

    const filteredCourses = useMemo(() => {
        let filtered = courses;
        if (userStates && userStates.length > 0) filtered = filtered.filter(c => userStates.includes(c.state));
        if (userLocalities && userLocalities.length > 0) filtered = filtered.filter(c => userLocalities.includes(c.locality));
        return filtered;
    }, [courses, userStates, userLocalities]);

    const sortedCourses = useMemo(() => {
        return [...filteredCourses].sort((a, b) => {
            const aActive = isCourseActive(a);
            const bActive = isCourseActive(b);
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return 0;
        });
    }, [filteredCourses]);

    const totalItems = sortedCourses.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedCourses = sortedCourses.slice(startIndex, startIndex + itemsPerPage);

    const toggleExpand = (id) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    if (sortedCourses.length === 0) return <div className="text-center p-8 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">No courses found matching the selected filters.</div>;

    const courseType = sortedCourses.length > 0 ? sortedCourses[0].course_type : 'Courses';

    return (
        <div>
            <h3 className="text-xl font-bold mb-4">{courseType} Courses</h3>
            
            {/* Desktop View (Standard Table) */}
            <div className="hidden md:block">
                <Table headers={["State", "Subcourses", "Status", "Creation Info", "Last Edit", "Actions"]}>
                    {paginatedCourses.map((c) => {
                        const isPendingDeletion = c.deletionRequested === true;
                        const active = isCourseActive(c);
                        const canEdit = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                        const canDelete = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                        
                        const subcourses = c.facilitatorAssignments && c.facilitatorAssignments.length > 0
                            ? [...new Set(c.facilitatorAssignments.map(a => a.imci_sub_type))].join(', ')
                            : 'N/A';

                        const createdDate = c.createdAt?.toDate 
                            ? c.createdAt.toDate().toLocaleString() 
                            : c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleString() : 'N/A';
                            
                        const lastEditDate = c.lastUpdatedAt?.toDate 
                            ? c.lastUpdatedAt.toDate().toLocaleString() 
                            : c.lastUpdatedAt?.seconds ? new Date(c.lastUpdatedAt.seconds * 1000).toLocaleString() : 'N/A';

                        return (
                            <tr key={c.id} className={`hover:bg-gray-50 ${isPendingDeletion ? 'bg-red-50' : ''}`}>
                                <td className="p-4 border">
                                    {c.state} - {c.locality}
                                    {isPendingDeletion && <span className="block text-xs text-red-600 font-bold mt-1">(Deletion Pending)</span>}
                                </td>
                                <td className="p-4 border">{subcourses}</td>
                                <td className="p-4 border">
                                    {c.approvalStatus === 'pending' ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                            Not Approved
                                        </span>
                                    ) : active ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            Inactive
                                        </span>
                                    )}
                                </td>
                                
                                <td className="p-4 border">
                                    <div className="text-sm whitespace-nowrap">{createdDate}</div>
                                    <div className="text-xs text-gray-500 font-medium mt-1">
                                        By: {c.createdBy || 'Legacy Data'}
                                    </div>
                                </td>
                                <td className="p-4 border">
                                    <div className="text-sm whitespace-nowrap">{lastEditDate}</div>
                                    <div className="text-xs text-gray-500 font-medium mt-1">
                                        By: {c.updatedBy || 'Legacy Data'}
                                    </div>
                                </td>

                                <td className="p-2 border text-right whitespace-nowrap">
                                    <div className="flex gap-2 justify-end items-center">
                                        <Button variant="primary" className="px-3 py-1 text-sm flex items-center gap-1" onClick={() => onOpen(c.id)} disabled={isProcessing}>
                                           <ExternalLink size={14} /> Open
                                        </Button>
                                        <Button variant="secondary" className="px-3 py-1 text-sm flex items-center gap-1" onClick={() => onEdit(c)} disabled={!canEdit || isPendingDeletion || isProcessing}>
                                            <Edit size={14} /> Edit
                                        </Button>
                                        <Button variant="secondary" className="px-3 py-1 text-sm flex items-center gap-1" onClick={() => setReportModalCourse(c)} disabled={isProcessing}>
                                            <FileText size={14} /> Reports
                                        </Button>
                                        <Button variant="secondary" className="px-3 py-1 text-sm flex items-center gap-1" onClick={() => setShareModalCourse(c)} disabled={isProcessing}>
                                           <Share2 size={14} /> Share
                                        </Button>
                                        <Button variant="danger" className="px-3 py-1 text-sm flex items-center gap-1" onClick={() => { if(window.confirm(`Are you sure you want to delete ${c.course_type} (${c.state})? It will be moved to Deleted Courses.`)) onDelete(c.id); }} disabled={!canDelete || isPendingDeletion || isProcessing}>
                                           <Trash2 size={14} /> Delete
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </Table>
            </div>

            {/* Mobile View (Collapsible Accordion Cards) */}
            <div className="grid gap-4 md:hidden">
                {paginatedCourses.map((c) => {
                    const isPendingDeletion = c.deletionRequested === true;
                    const active = isCourseActive(c);
                    const canEdit = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                    const canDelete = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                    const isExpanded = expandedId === c.id;
                    
                    const subcourses = c.facilitatorAssignments && c.facilitatorAssignments.length > 0
                        ? [...new Set(c.facilitatorAssignments.map(a => a.imci_sub_type))].join(', ') : 'N/A';

                    return (
                        <div key={c.id} className={`border rounded-lg bg-white shadow-sm overflow-hidden ${isPendingDeletion ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                            {/* Card Header (Clickable for Accordion) */}
                            <div 
                                className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                                onClick={() => toggleExpand(c.id)}
                            >
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800">
                                        {c.state} - {c.locality}
                                    </h4>
                                    <p className="text-sm text-gray-600 line-clamp-1">{subcourses}</p>
                                    <div className="mt-2 flex gap-2 items-center">
                                        {c.approvalStatus === 'pending' ? (
                                            <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-red-100 text-red-800">Not Approved</span>
                                        ) : active ? (
                                            <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-green-100 text-green-800">Active</span>
                                        ) : (
                                            <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800">Inactive</span>
                                        )}
                                        {isPendingDeletion && <span className="text-[10px] text-red-600 font-bold">(Deletion Pending)</span>}
                                    </div>
                                </div>
                                <div className="text-gray-400">
                                    <svg className={`w-6 h-6 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>

                            {/* Collapsible Actions Menu */}
                            {isExpanded && (
                                <div className="p-4 border-t border-gray-100 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    <Button variant="primary" className="w-full flex justify-center items-center gap-2" onClick={() => onOpen(c.id)} disabled={isProcessing}>
                                        <ExternalLink size={16} /> Open
                                    </Button>
                                    <Button variant="secondary" className="w-full flex justify-center items-center gap-2" onClick={() => onEdit(c)} disabled={!canEdit || isPendingDeletion || isProcessing}>
                                        <Edit size={16} /> Edit
                                    </Button>
                                    <Button variant="secondary" className="w-full flex justify-center items-center gap-2" onClick={() => setReportModalCourse(c)} disabled={isProcessing}>
                                        <FileText size={16} /> Reports
                                    </Button>
                                    <Button variant="secondary" className="w-full flex justify-center items-center gap-2" onClick={() => setShareModalCourse(c)} disabled={isProcessing}>
                                        <Share2 size={16} /> Share
                                    </Button>
                                    <Button variant="danger" className="w-full flex justify-center items-center gap-2 sm:col-span-2 md:col-span-1" onClick={() => { if(window.confirm(`Are you sure you want to delete ${c.course_type} (${c.state})? It will be moved to Deleted Courses.`)) onDelete(c.id); }} disabled={!canDelete || isPendingDeletion || isProcessing}>
                                        <Trash2 size={16} /> Delete
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* --- Pagination Controls --- */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 p-4 bg-white border rounded-lg text-sm text-gray-700 shadow-sm">
                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                        <span>Page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong> <span className="text-gray-500">(Total: {totalItems} courses)</span></span>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">Per Page:</span>
                            <Select 
                                disabled={isProcessing}
                                value={itemsPerPage} 
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="py-1 px-2 text-sm w-20 border-gray-300 rounded"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="secondary" 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1 || isProcessing}
                            className="px-3 py-1"
                        >
                            &larr; Previous
                        </Button>
                        <Button 
                            variant="secondary" 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage >= totalPages || totalPages === 0 || isProcessing}
                            className="px-3 py-1"
                        >
                            Next &rarr;
                        </Button>
                    </div>
                </div>
            )}

            {/* --- SHARE & MANAGE MODAL --- */}
            {shareModalCourse && (
                <Modal isOpen={!!shareModalCourse} onClose={() => setShareModalCourse(null)} title="Share Public Links">
                     <CardBody className="flex flex-col gap-6 p-4">
                        <div>
                            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <Share2 size={16} /> Public Links
                            </h4>
                            <div className="space-y-3 pl-2">
                                <div className="bg-gray-50 p-3 rounded border">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-semibold">Participant Registration</span>
                                        <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => {
                                            const link = `${getBaseUrl()}/public/register/course/${shareModalCourse.id}`;
                                            const text = `*Participant Registration*\nCourse: ${shareModalCourse.course_type}\nLocation: ${shareModalCourse.state} - ${shareModalCourse.locality}\n\nPlease register using this link:\n${link}`;
                                            shareViaWhatsApp(text, 'Registration link copied!');
                                        }}><LinkIcon size={14} /> Share</Button>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded border">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-semibold">Course Monitoring</span>
                                        <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => {
                                            const link = `${getBaseUrl()}/monitor/course/${shareModalCourse.id}`;
                                            const text = `*Course Monitoring*\nCourse: ${shareModalCourse.course_type}\nLocation: ${shareModalCourse.state} - ${shareModalCourse.locality}\n\nAccess monitoring dashboard here:\n${link}`;
                                            shareViaWhatsApp(text, 'Monitoring link copied!');
                                        }}><Eye size={14} /> Share</Button>
                                    </div>
                                </div>
                                
                                {(['ICCM', 'EENC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management'].includes(shareModalCourse.course_type)) && (
                                    <div className="bg-gray-50 p-3 rounded border">
                                        <span className="text-sm font-semibold block mb-2">Testing</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="secondary" size="sm" className="flex items-center gap-1 justify-center" onClick={() => {
                                                const link = `${getBaseUrl()}/public/test/course/${shareModalCourse.id}?type=pre`;
                                                const text = `*Pre-Test Form*\nCourse: ${shareModalCourse.course_type}\n\nPlease complete the pre-test here:\n${link}`;
                                                shareViaWhatsApp(text, 'Pre-Test link copied!');
                                            }}><FileText size={14} /> Share Pre-Test</Button>

                                            <Button variant="secondary" size="sm" className="flex items-center gap-1 justify-center" onClick={() => {
                                                const link = `${getBaseUrl()}/public/test/course/${shareModalCourse.id}?type=post`;
                                                const text = `*Post-Test Form*\nCourse: ${shareModalCourse.course_type}\n\nPlease complete the post-test here:\n${link}`;
                                                shareViaWhatsApp(text, 'Post-Test link copied!');
                                            }}><FileText size={14} /> Share Post-Test</Button>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-gray-50 p-3 rounded border">
                                    <span className="text-sm font-semibold block mb-2">Daily Attendance</span>
                                    <div className="flex gap-2">
                                        <Input 
                                            type="date" 
                                            value={attendanceDate} 
                                            onChange={(e) => setAttendanceDate(e.target.value)} 
                                            className="py-1 text-sm" 
                                        />
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="flex items-center gap-1" 
                                            onClick={() => { 
                                                const link = `${getBaseUrl()}/attendance/course/${shareModalCourse.id}?date=${attendanceDate}`; 
                                                
                                                let subCourseText = '';
                                                if (shareModalCourse.facilitatorAssignments && shareModalCourse.facilitatorAssignments.length > 0) {
                                                    const subcourses = [...new Set(shareModalCourse.facilitatorAssignments.map(a => a.imci_sub_type).filter(Boolean))];
                                                    if (subcourses.length > 0) {
                                                        subCourseText = ` - ${subcourses.join(' / ')}`;
                                                    }
                                                }

                                                const text = `*Attendance Form: ${shareModalCourse.course_type}${subCourseText}*\nDate: ${attendanceDate}\n\nPlease register your attendance here: \n${link}`;
                                                shareViaWhatsApp(text, `Attendance link for ${attendanceDate} copied!`);
                                            }}
                                        >
                                            <LinkIcon size={14} /> Share
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardBody>
                    <CardFooter>
                        <Button variant="secondary" onClick={() => setShareModalCourse(null)}>Close</Button>
                    </CardFooter>
                </Modal>
            )}

            {/* --- REPORTS MODAL --- */}
            {reportModalCourse && (
                <Modal isOpen={!!reportModalCourse} onClose={() => setReportModalCourse(null)} title="Course Reports">
                    <CardBody className="p-6 flex flex-col gap-3">
                        <p className="text-sm text-gray-500 mb-2">Access all reporting and analysis tools for this course.</p>
                        
                        <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => { onOpenReport(reportModalCourse.id); setReportModalCourse(null); }}>
                            <div className="bg-blue-100 p-2 rounded-full"><BarChart2 className="text-blue-600" size={20} /></div>
                            <div className="text-left">
                                <div className="font-semibold text-gray-800">Course Analytics</div>
                                <div className="text-xs text-gray-500">View charts and performance metrics</div>
                            </div>
                        </Button>

                        <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => { onOpenAttendanceManager(reportModalCourse.id); setReportModalCourse(null); }}>
                            <div className="bg-green-100 p-2 rounded-full"><ClipboardList className="text-green-600" size={20} /></div>
                            <div className="text-left">
                                <div className="font-semibold text-gray-800">Attendance Dashboard</div>
                                <div className="text-xs text-gray-500">View daily attendance logs</div>
                            </div>
                        </Button>

                        {(['ICCM', 'EENC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management'].includes(reportModalCourse.course_type)) && (
                            <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => { onOpenTestForm(reportModalCourse.id); setReportModalCourse(null); }}>
                                <div className="bg-orange-100 p-2 rounded-full"><CheckCircle className="text-orange-600" size={20} /></div>
                                <div className="text-left">
                                    <div className="font-semibold text-gray-800">Test Scores Dashboard</div>
                                    <div className="text-xs text-gray-500">Manage pre-test and post-test scores</div>
                                </div>
                            </Button>
                        )}

                        {canManageFinalReport && (
                            <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => { onAddFinalReport(reportModalCourse.id); setReportModalCourse(null); }}>
                                <div className="bg-purple-100 p-2 rounded-full"><FileText className="text-purple-600" size={20} /></div>
                                <div className="text-left">
                                    <div className="font-semibold text-gray-800">Final Report</div>
                                    <div className="text-xs text-gray-500">Generate or view the narrative report</div>
                                </div>
                            </Button>
                        )}

                        <Button variant="secondary" className="flex items-center gap-3 p-4 justify-start" onClick={() => {
                            const link = `${getBaseUrl()}/public/report/course/${reportModalCourse.id}`;
                            const text = `*Course Report*\nCourse: ${reportModalCourse.course_type}\nLocation: ${reportModalCourse.state} - ${reportModalCourse.locality}\n\nView the comprehensive course report here:\n${link}`;
                            shareViaWhatsApp(text, 'Report link copied to clipboard!');
                        }}>
                            <div className="bg-indigo-100 p-2 rounded-full"><LinkIcon className="text-indigo-600" size={20} /></div>
                            <div className="text-left">
                                <div className="font-semibold text-gray-800">Share Report Link</div>
                                <div className="text-xs text-gray-500">Copy & share report link via WhatsApp</div>
                            </div>
                        </Button>

                    </CardBody>
                    <CardFooter>
                         <Button variant="secondary" onClick={() => setReportModalCourse(null)}>Close</Button>
                    </CardFooter>
                </Modal>
            )}

            {/* --- Deletion Request Confirmation Modal --- */}
            
        </div>
    );
}

export { PublicAttendanceView, AttendanceManagerView } from './CourseAttendanceView';

// --- Deleted Courses View ---
function DeletedCoursesView({ courses, onRestore, onPermanentDelete, isProcessing }) {
    if (courses.length === 0) {
        return <div className="text-center p-8 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">No deleted courses found.</div>;
    }

    return (
        <div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Trash2 className="text-red-600" /> Deleted Courses
            </h3>
            <div className="bg-gray-50 border-l-4 border-gray-400 p-4 mb-4">
                <p className="text-sm text-gray-700">
                    Courses here are hidden from the main list. You can restore them or permanently delete them.
                </p>
            </div>

            <Table headers={["Course Type", "Location", "Start Date", "Coordinator", "Actions"]}>
                {courses.map(c => (
                    <tr key={c.id} className="bg-white hover:bg-gray-50 opacity-75">
                        <td className="p-4 border font-medium">{c.course_type}</td>
                        <td className="p-4 border">{c.state} - {c.locality}</td>
                        <td className="p-4 border">{c.start_date}</td>
                        <td className="p-4 border">{c.coordinator || 'N/A'}</td>
                        <td className="p-4 border text-right">
                            <div className="flex justify-end gap-2">
                                <Button 
                                    variant="secondary" 
                                    className="flex items-center gap-1"
                                    onClick={() => onRestore(c)}
                                    disabled={isProcessing}
                                >
                                    <RefreshCw size={14} /> Restore
                                </Button>
                                <Button 
                                    variant="danger" 
                                    className="flex items-center gap-1"
                                    onClick={() => onPermanentDelete(c.id)}
                                    disabled={isProcessing}
                                >
                                    <X size={14} /> Delete Forever
                                </Button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </div>
    );
}

// --- Federal Approvals View ---
function CourseApprovalsView({ courses, onApproveCourse, isProcessing }) {
    const pendingApprovalCourses = useMemo(() => courses.filter(c => c.approvalStatus === 'pending' && !c.deletionRequested && !c.inRecycleBin), [courses]);

    if (pendingApprovalCourses.length === 0) {
        return <div className="text-center p-8 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">No courses are currently pending federal approval.</div>;
    }

    return (
        <div className="space-y-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="text-green-600" /> Course Approvals
            </h3>

            <div>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <p className="text-sm text-yellow-700">
                        These courses have been created but require federal approval before they can become actively tracked and monitored.
                    </p>
                </div>
                <Table headers={["Course Type", "Location", "Start Date", "Coordinator", "Actions"]}>
                    {pendingApprovalCourses.map(c => (
                        <tr key={c.id} className="bg-white hover:bg-gray-50">
                            <td className="p-4 border font-medium">{c.course_type}</td>
                            <td className="p-4 border">{c.state} - {c.locality}</td>
                            <td className="p-4 border">{c.start_date}</td>
                            <td className="p-4 border">{c.coordinator || 'N/A'}</td>
                            <td className="p-4 border text-right">
                                <Button 
                                    variant="primary" 
                                    className="flex items-center gap-1 ml-auto"
                                    onClick={() => onApproveCourse(c.id)}
                                    disabled={isProcessing}
                                >
                                    <Check size={14} /> Approve Course
                                </Button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
        </div>
    );
}


// -----------------------------------------------------------------------------
// Certificate Approvals View
// -----------------------------------------------------------------------------
const CertificateApprovalsView = ({ allCourses, setToast }) => {
    const { fetchCourses } = useDataCache(); 
    const [managerName, setManagerName] = useState('');
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [isApproving, setIsApproving] = useState(false);
    
    const [managerSignatureFile, setManagerSignatureFile] = useState(null);
    const [directorName, setDirectorName] = useState('');
    const [directorSignatureFile, setDirectorSignatureFile] = useState(null);
    const [programStampFile, setProgramStampFile] = useState(null);

    const managerFileRef = useRef(null);
    const directorFileRef = useRef(null);
    const stampFileRef = useRef(null);

    const [filterState, setFilterState] = useState('All');
    const [filterLocality, setFilterLocality] = useState('All');
    const [filterCourseType, setFilterCourseType] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

    const states = useMemo(() => ['All', ...new Set(allCourses.map(c => c.state).filter(Boolean))].sort(), [allCourses]);
    const localities = useMemo(() => {
        const locs = new Set();
        allCourses.forEach(c => {
            if (filterState === 'All' || c.state === filterState) {
                if (c.locality) locs.add(c.locality);
            }
        });
        return ['All', ...Array.from(locs).sort()];
    }, [allCourses, filterState]);
    const courseTypes = useMemo(() => ['All', ...new Set(allCourses.map(c => c.course_type).filter(Boolean))].sort(), [allCourses]);

    const courses = useMemo(() => {
        let filtered = [...allCourses];
        if (filterState !== 'All') filtered = filtered.filter(c => c.state === filterState);
        if (filterLocality !== 'All') filtered = filtered.filter(c => c.locality === filterLocality);
        if (filterCourseType !== 'All') filtered = filtered.filter(c => c.course_type === filterCourseType);
        if (filterStatus !== 'All') {
            const isApproved = filterStatus === 'Approved';
            filtered = filtered.filter(c => !!c.isCertificateApproved === isApproved);
        }
        return filtered.sort((a, b) => {
            if (a.isCertificateApproved === b.isCertificateApproved) {
                return new Date(b.start_date) - new Date(a.start_date);
            }
            return a.isCertificateApproved ? 1 : -1;
        });
    }, [allCourses, filterState, filterLocality, filterCourseType, filterStatus]);

    const loadData = async () => {
        setLoadingApprovals(true);
        try {
            // Force incremental update of courses
            await fetchCourses(true);
            
            // Just need the manager name
            const coords = await listFederalCoordinators({ source: 'cache' });
            const manager = coords.find(c => c.role === 'مدير البرنامج' || c.role === 'Federal Program Manager');
            if (manager) setManagerName(manager.name);
        } catch (err) {
            setToast({ show: true, message: "Error loading approval data", type: 'error' });
        } finally {
            setLoadingApprovals(false);
        }
    };

    useEffect(() => {
        const fetchManager = async () => {
            try {
                const coords = await listFederalCoordinators({ source: 'cache' });
                const manager = coords.find(c => c.role === 'مدير البرنامج' || c.role === 'Federal Program Manager');
                if (manager) setManagerName(manager.name);
            } catch (e) {}
        };
        fetchManager();
    }, []);

    const handleOpenApprovalModal = (course) => {
        if (!managerName) {
            setToast({ show: true, message: "Program Manager Name is missing. Please check HR settings.", type: 'error' });
            return;
        }
        setSelectedCourse(course);
        setManagerSignatureFile(null);
        setDirectorSignatureFile(null);
        setProgramStampFile(null);
        setDirectorName(course.director || '');
        setApprovalModalOpen(true);
    };

    const handleConfirmApprove = async () => {
        if (!selectedCourse || !managerName) return;
        setIsApproving(true);
        try {
            let managerSigUrl = null; if (managerSignatureFile) managerSigUrl = await uploadFile(managerSignatureFile);
            let directorSigUrl = null; if (directorSignatureFile) directorSigUrl = await uploadFile(directorSignatureFile);
            let stampUrl = null; if (programStampFile) stampUrl = await uploadFile(programStampFile);

            const courseRef = doc(db, 'courses', selectedCourse.id);
            const approvalData = {
                isCertificateApproved: true,
                approvedByManagerName: managerName,
                approvedByManagerSignatureUrl: managerSigUrl || selectedCourse.approvedByManagerSignatureUrl || null,
                approvedDirectorName: directorName,
                approvedDirectorSignatureUrl: directorSigUrl || selectedCourse.approvedDirectorSignatureUrl || null,
                approvedProgramStampUrl: stampUrl || selectedCourse.approvedProgramStampUrl || null,
                certificateApprovedAt: new Date()
            };

            await updateDoc(courseRef, approvalData);
            setToast({ show: true, message: "Certificates Approved Successfully.", type: 'success' });
            setApprovalModalOpen(false);
            
            // Force Global Incremental Update: Costs exactly 1 read, perfectly syncs UI downstream.
            await fetchCourses(true);

        } catch (err) {
            setToast({ show: true, message: `Error: ${err.message}`, type: 'error' });
        } finally { setIsApproving(false); }
    };

    const handleUnapprove = async (course) => {
        if (course.approvedByManagerName && course.approvedByManagerName !== managerName) {
            setToast({ show: true, message: `Permission Denied. Only ${course.approvedByManagerName} can revoke this.`, type: 'error' });
            return;
        }

        if (window.confirm(`Revoke approval for ${course.course_type}? \n\nThis will hide the download links for participants.`)) {
            setLoadingApprovals(true);
            try {
                await unapproveCourseCertificates(course.id);
                setToast({ show: true, message: "Approval Revoked.", type: 'info' });
                
                // Force Global Incremental Update: Costs exactly 1 read, perfectly syncs UI downstream.
                await fetchCourses(true);

            } catch (err) { setToast({ show: true, message: err.message, type: 'error' }); } 
            finally { setLoadingApprovals(false); }
        }
    };

    if (loadingApprovals && !approvalModalOpen) return <div className="flex justify-center p-8"><Spinner /></div>;

    return (
        <>
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center">
                        <Award className="w-5 h-5 mr-2 text-sky-500" /> Certificate Approvals
                    </h3>
                    <Button variant="secondary" onClick={loadData} size="sm" className="shadow-sm">
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                </div>
                
                <div className="bg-sky-50 border border-sky-100 p-5 rounded-xl mb-6 shadow-sm flex items-start">
                    <div className="p-2 bg-sky-100 text-sky-600 rounded-full mr-4 shrink-0">
                        <FileSignature className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-sky-900">
                            <strong>Current Signing Authority:</strong> 
                            <span className="font-bold text-lg ml-2 underline decoration-sky-300 underline-offset-4">{managerName || "Loading..."}</span>
                        </p>
                        <p className="text-xs text-sky-700 mt-2 leading-relaxed">
                            Approving a course will permanently stamp your name on the generated certificates. Ensure you upload all necessary signatures and the transparent program stamp before confirming.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <FormGroup label="State">
                        <Select value={filterState} onChange={e => { setFilterState(e.target.value); setFilterLocality('All'); }}>
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Locality">
                        <Select value={filterLocality} onChange={e => setFilterLocality(e.target.value)} disabled={localities.length <= 1}>
                            {localities.map(l => <option key={l} value={l}>{l}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Course Type">
                        <Select value={filterCourseType} onChange={e => setFilterCourseType(e.target.value)}>
                            {courseTypes.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Status">
                        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="All">All Statuses</option>
                            <option value="Approved">Approved</option>
                            <option value="Pending">Pending</option>
                        </Select>
                    </FormGroup>
                </div>

                {courses.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <div className="text-gray-400 mb-2"><Award className="w-8 h-8 mx-auto opacity-50" /></div>
                        <div className="text-gray-500 font-medium">No courses found to approve.</div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                        <Table headers={["State", "Locality", "Course Type", "Sub Course", "Start Date", "Status", "Actions"]}>
                            {courses.map(c => {
                                const isApproved = c.isCertificateApproved === true;
                                const canModify = isApproved && c.approvedByManagerName === managerName;

                                const subCourses = c.facilitatorAssignments && c.facilitatorAssignments.length > 0
                                    ? [...new Set(c.facilitatorAssignments.map(a => a.imci_sub_type).filter(Boolean))].join(', ')
                                    : (c.director_imci_sub_type || '-');

                                return (
                                    <tr key={c.id} className={`transition-colors hover:bg-gray-50 ${isApproved ? "bg-gray-50/50" : "bg-white"}`}>
                                        <td className="font-medium text-gray-800">{c.state}</td>
                                        <td className="text-gray-600">{c.locality}</td>
                                        <td className="font-medium text-sky-700">{c.course_type}</td>
                                        <td className="text-sm text-gray-500 max-w-[150px] truncate" title={subCourses}>
                                            {subCourses}
                                        </td>
                                        <td className="text-gray-600 font-mono text-sm">{c.start_date}</td>
                                        <td>
                                            {isApproved ? (
                                                <div className="flex flex-col items-start">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-200 shadow-sm">
                                                        <CheckCircle className="w-3 h-3 mr-1" /> Approved
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 mt-1 font-medium bg-gray-100 px-1.5 py-0.5 rounded">
                                                        By: {c.approvedByManagerName}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            {isApproved ? (
                                                <Button 
                                                    onClick={() => handleUnapprove(c)} 
                                                    disabled={!canModify}
                                                    variant="secondary"
                                                    size="sm"
                                                    className={!canModify ? "opacity-50 cursor-not-allowed" : "text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"}
                                                    title={!canModify ? `Only ${c.approvedByManagerName} can revoke this.` : "Revoke Approval"}
                                                >
                                                    {canModify ? "Revoke" : <Lock className="w-4 h-4" />}
                                                </Button>
                                            ) : (
                                                <Button onClick={() => handleOpenApprovalModal(c)} disabled={!managerName} variant="primary" size="sm" className="shadow-sm">
                                                    Review & Approve
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                    </div>
                )}
            </Card>

            <Modal isOpen={approvalModalOpen} onClose={() => !isApproving && setApprovalModalOpen(false)} title="Confirm & Sign Certificates">
                <CardBody>
                    <div className="space-y-6">
                        <div className="bg-sky-50 text-sky-800 p-3 rounded-lg text-sm border border-sky-100 flex items-start">
                            <Award className="w-5 h-5 mr-3 shrink-0 opacity-70" />
                            <p>You are approving certificates for <strong>{selectedCourse?.course_type}</strong> in <strong>{selectedCourse?.locality}, {selectedCourse?.state}</strong>.</p>
                        </div>
                        
                        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center tracking-wide">
                                <FileSignature className="w-4 h-4 mr-2 text-sky-500" /> Program Manager (You)
                            </h4>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Name on Certificate</label>
                                <div className="text-sm font-bold bg-white px-3 py-2 border border-gray-200 rounded-lg text-gray-800 shadow-sm">{managerName}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Signature Image (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept="image/*" ref={managerFileRef} onChange={(e) => setManagerSignatureFile(e.target.files[0])} className="hidden" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => managerFileRef.current?.click()} className="w-full justify-center bg-white">
                                        <Upload className="w-4 h-4 mr-2 text-gray-400" /> {managerSignatureFile ? managerSignatureFile.name : "Upload Signature"}
                                    </Button>
                                    {managerSignatureFile && <Button type="button" variant="danger" size="sm" onClick={() => { setManagerSignatureFile(null); if(managerFileRef.current) managerFileRef.current.value = ''; }}><XCircle className="w-4 h-4" /></Button>}
                                </div>
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center tracking-wide">
                                <FileSignature className="w-4 h-4 mr-2 text-blue-500" /> Course Director
                            </h4>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Director Name</label>
                                <Input value={directorName} onChange={(e) => setDirectorName(e.target.value)} placeholder="Dr. Name..." className="text-sm font-medium" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Director Signature (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept="image/*" ref={directorFileRef} onChange={(e) => setDirectorSignatureFile(e.target.files[0])} className="hidden" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => directorFileRef.current?.click()} className="w-full justify-center bg-gray-50">
                                        <Upload className="w-4 h-4 mr-2 text-gray-400" /> {directorSignatureFile ? directorSignatureFile.name : "Upload Signature"}
                                    </Button>
                                    {directorSignatureFile && <Button type="button" variant="danger" size="sm" onClick={() => { setDirectorSignatureFile(null); if(directorFileRef.current) directorFileRef.current.value = ''; }}><XCircle className="w-4 h-4" /></Button>}
                                </div>
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center tracking-wide">
                                <Stamp className="w-4 h-4 mr-2 text-indigo-500" /> Program Stamp
                            </h4>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Stamp Image</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" accept="image/*" ref={stampFileRef} onChange={(e) => setProgramStampFile(e.target.files[0])} className="hidden" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => stampFileRef.current?.click()} className="w-full justify-center bg-gray-50">
                                        <Upload className="w-4 h-4 mr-2 text-gray-400" /> {programStampFile ? programStampFile.name : "Upload Stamp"}
                                    </Button>
                                    {programStampFile && <Button type="button" variant="danger" size="sm" onClick={() => { setProgramStampFile(null); if(stampFileRef.current) stampFileRef.current.value = ''; }}><XCircle className="w-4 h-4" /></Button>}
                                </div>
                                <p className="text-xs text-gray-400 mt-2 italic flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Recommended: Transparent PNG background.</p>
                            </div>
                        </div>
                    </div>
                </CardBody>
                <CardFooter>
                    <div className="flex justify-end gap-3 w-full pt-2">
                        <Button variant="secondary" onClick={() => setApprovalModalOpen(false)} disabled={isApproving}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleConfirmApprove} disabled={isApproving} className="shadow-md">
                            {isApproving ? <><Spinner size="sm" className="mr-2" /> Processing...</> : "Confirm & Approve"}
                        </Button>
                    </div>
                </CardFooter>
            </Modal>
        </>
    );
};

export function CourseManagementView({
    allCourses, onOpen, onOpenReport,
    onOpenTestForm,
    canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates, userLocalities,
    activeCoursesTab, setActiveCoursesTab, selectedCourse,
    participants,
    participantTests,
    onOpenParticipantReport, onAddFinalReport, onEditFinalReport,
    selectedParticipantId, onSetSelectedParticipantId, onBatchUpdate,
    loadingDetails,
    canManageCourse,
    canAddCourse, 
    canUseSuperUserAdvancedFeatures,
    canUseFederalManagerAdvancedFeatures,
    manageLocation,
    activeCourseType,
    setActiveCourseType,
    facilitatorsList,
    onOpenAttendanceManager
}) {
    const { 
        federalCoordinators, fetchFederalCoordinators,
        stateCoordinators, fetchStateCoordinators,
        localityCoordinators, fetchLocalityCoordinators,
        funders, fetchFunders,
        fetchCourses,
        participants: globalParticipants, 
        fetchParticipants,
        healthFacilities, fetchHealthFacilities, isLoading
    } = useDataCache();

    // Get current user data for capturing "who edited" and "who created"
    const { user } = useAuth();
    const currentUserIdentifier = user?.displayName || user?.email || 'Unknown';

    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // UI Locking and Toast state
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });

    useEffect(() => {
        fetchFederalCoordinators();
        fetchStateCoordinators();
        fetchLocalityCoordinators();
        fetchFunders();
        fetchParticipants(true); 
    }, []); 

    // Fetch all health facilities only when the compiled reports tab is opened and not already loaded
    useEffect(() => {
        if (activeCoursesTab === 'dashboard' && (!healthFacilities || healthFacilities.length === 0)) {
            fetchHealthFacilities();
        }
    }, [activeCoursesTab, healthFacilities, fetchHealthFacilities]);

    const currentParticipant = participants.find(p => p.id === selectedParticipantId);
    const [courseToEdit, setCourseToEdit] = useState(null);

    // Filter logic for specific course type views
    const coursesForActiveType = useMemo(() => {
        if (!activeCourseType) return [];
        return allCourses.filter(c => c.course_type === activeCourseType);
    }, [allCourses, activeCourseType]);

    const [filterState, setFilterState] = useState('All');
    const [filterLocality, setFilterLocality] = useState('All');
    const [filterSubCourse, setFilterSubCourse] = useState('All');
    const [filterProject, setFilterProject] = useState('All');

    const filterStateOptions = useMemo(() => {
        const states = new Set();
        coursesForActiveType.forEach(c => {
             if (!userStates || userStates.length === 0 || userStates.includes(c.state)) {
                 states.add(c.state);
             }
        });
        return ['All', ...Array.from(states).sort()];
    }, [coursesForActiveType, userStates]);

    const filterLocalityOptions = useMemo(() => {
        const localities = new Set();
        coursesForActiveType.forEach(c => {
            if (filterState === 'All' || c.state === filterState) {
                if (!userLocalities || userLocalities.length === 0 || userLocalities.includes(c.locality)) {
                    localities.add(c.locality);
                }
            }
        });
        return ['All', ...Array.from(localities).sort()];
    }, [coursesForActiveType, filterState, userLocalities]);

    const filterSubCourseOptions = useMemo(() => {
        const subCourses = new Set();
        coursesForActiveType.forEach(c => {
            if (c.facilitatorAssignments && c.facilitatorAssignments.length > 0) {
                c.facilitatorAssignments.forEach(a => subCourses.add(a.imci_sub_type));
            }
        });
        return ['All', ...Array.from(subCourses).sort()];
    }, [coursesForActiveType]);

    const filterProjectOptions = useMemo(() => {
        const projects = new Set();
        coursesForActiveType.forEach(c => {
            if (c.course_project) {
                projects.add(c.course_project);
            }
        });
        return ['All', ...Array.from(projects).sort()];
    }, [coursesForActiveType]);

    useEffect(() => {
        setFilterState('All');
        setFilterLocality('All');
        setFilterSubCourse('All');
        setFilterProject('All');
    }, [activeCourseType]);

    useEffect(() => {
        setFilterLocality('All');
    }, [filterState]);

    const courses = useMemo(() => {
        return coursesForActiveType.filter(c => {
            if (c.inRecycleBin) return false;
            
            // Explicit manageLocation permissions checks
            if (manageLocation === 'user_state' || manageLocation === 'user_locality') {
                if (!userStates || userStates.length === 0 || !userStates.includes(c.state)) return false;
            }
            if (manageLocation === 'user_locality') {
                if (!userLocalities || userLocalities.length === 0 || !userLocalities.includes(c.locality)) return false;
            }

            // Form filter checks
            const stateMatch = filterState === 'All' || c.state === filterState;
            const localityMatch = filterLocality === 'All' || c.locality === filterLocality;
            const subCourseMatch = filterSubCourse === 'All' || 
                (c.facilitatorAssignments && c.facilitatorAssignments.some(a => a.imci_sub_type === filterSubCourse));
            const projectMatch = filterProject === 'All' || c.course_project === filterProject;

            return stateMatch && localityMatch && subCourseMatch && projectMatch;
        });
    }, [coursesForActiveType, filterState, filterLocality, filterSubCourse, filterProject, userStates, userLocalities, manageLocation]);

    const dashboardCourses = useMemo(() => {
        return (allCourses || []).filter(c => {
            if (c.inRecycleBin || c.isDeleted === true || c.isDeleted === "true") return false;
            
            // Strict check for caching global courses correctly in dashboards
            if (manageLocation === 'user_state' || manageLocation === 'user_locality') {
                if (!userStates || userStates.length === 0 || !userStates.includes(c.state)) return false;
            }
            if (manageLocation === 'user_locality') {
                if (!userLocalities || userLocalities.length === 0 || !userLocalities.includes(c.locality)) return false;
            }
            return true;
        });
    }, [allCourses, userStates, userLocalities, manageLocation]);

    const dashboardParticipants = useMemo(() => {
        return (globalParticipants || []).filter(p => {
            if (p.isDeleted === true || p.isDeleted === "true") return false;
            
            // Strict check for caching global participants correctly in dashboards
            if (manageLocation === 'user_state' || manageLocation === 'user_locality') {
                if (!userStates || userStates.length === 0 || !userStates.includes(p.state)) return false;
            }
            if (manageLocation === 'user_locality') {
                if (!userLocalities || userLocalities.length === 0 || !userLocalities.includes(p.locality)) return false;
            }
            return true;
        });
    }, [globalParticipants, userStates, userLocalities, manageLocation]);

    const courseKPIs = useMemo(() => {
        return { 
            totalCourses: dashboardCourses.length, 
            totalImnciCourses: dashboardCourses.filter(c => c.course_type === 'IMNCI').length, 
            totalEtatCourses: dashboardCourses.filter(c => c.course_type === 'ETAT').length, 
            totalEencCourses: dashboardCourses.filter(c => c.course_type === 'EENC').length 
        };
    }, [dashboardCourses]);

    const coursesByState = useMemo(() => {
        const data = {};
        const allStatesInFilter = [...new Set(dashboardCourses.map(c => c.state))].sort();
        const allCourseTypesInFilter = [...new Set(dashboardCourses.map(c => c.course_type))].sort();
        const totalCounts = {};

        dashboardCourses.forEach(c => {
            const state = c.state;
            const type = c.course_type;
            if (!data[state]) data[state] = {};
            data[state][type] = (data[state][type] || 0) + 1;
            totalCounts[state] = (totalCounts[state] || 0) + 1;
        });

        const tableBody = allStatesInFilter.map(state => {
            const row = [state];
            allCourseTypesInFilter.forEach(type => row.push(data[state]?.[type] || 0));
            row.push(totalCounts[state] || 0);
            return row;
        });

        const columnTotals = ["Total"];
        allCourseTypesInFilter.forEach(type => {
            columnTotals.push(Object.values(data).reduce((acc, stateData) => acc + (stateData[type] || 0), 0));
        });
        columnTotals.push(columnTotals.slice(1).reduce((acc, sum) => acc + sum, 0));

        return { headers: ["State", ...allCourseTypesInFilter, "Total"], body: tableBody, totals: columnTotals };
    }, [dashboardCourses]);

    const mapCoordinates = {
        "Khartoum": { lat: 15.6000, lng: 32.5000 }, "Gezira": { lat: 14.4000, lng: 33.5167 }, "White Nile": { lat: 13.1667, lng: 32.6667 }, "Blue Nile": { lat: 11.7667, lng: 34.3500 },
        "Sennar": { lat: 13.1500, lng: 33.9333 }, "Gedarif": { lat: 14.0333, lng: 35.3833 }, "Kassala": { lat: 15.4500, lng: 36.4000 }, "Red Sea": { lat: 19.6167, lng: 37.2167 },
        "Northern": { lat: 19.1698, lng: 30.4749 }, "River Nile": { lat: 17.5900, lng: 33.9600 }, "North Kordofan": { lat: 13.1833, lng: 30.2167 }, "South Kordofan": { lat: 11.0167, lng: 29.7167 },
        "West Kordofan": { lat: 11.7175, lng: 28.3400 }, "North Darfur": { lat: 13.6306, lng: 25.3500 }, "South Darfur": { lat: 12.0500, lng: 24.8833 }, "West Darfur": { lat: 13.4500, lng: 22.4500 },
        "Central Darfur": { lat: 12.9000, lng: 23.4833 }, "East Darfur": { lat: 11.4608, lng: 26.1283 }
    };

    const localMapData = useMemo(() => {
        const courseCounts = {};
        dashboardCourses.forEach(course => courseCounts[course.state] = (courseCounts[course.state] || 0) + 1);
        return Object.entries(courseCounts).map(([state, count]) => {
            const coords = mapCoordinates[state];
            return coords ? { state, percentage: count, coordinates: [coords.lng, coords.lat] } : null;
        }).filter(Boolean);
    }, [dashboardCourses]);

    const isCourseActive = useMemo(() => {
        if (selectedCourse?.approvalStatus === 'pending') return false; 
        if (!selectedCourse?.start_date || !selectedCourse?.course_duration || selectedCourse.course_duration <= 0) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(selectedCourse.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + selectedCourse.course_duration);
        return today >= startDate && today < endDate;
    }, [selectedCourse]);

    const canAccessAdminTab = canUseFederalManagerAdvancedFeatures || canManageCourse;
    const canAccessRecycleBin = canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try { await fetchCourses(true); await fetchParticipants(true); } finally { setIsRefreshing(false); }
    };

    const handleOpenCourse = (id) => {
        onOpen(id);
        onSetSelectedParticipantId(null);
        setActiveCoursesTab('participants'); 
    };

    const handleOpenTestForm = async (courseId) => {
        if (onOpen) await onOpen(courseId); 
        onSetSelectedParticipantId(null); 
        setActiveCoursesTab('enter-test-scores'); 
    };

    const handleOpenTestFormForParticipant = (participantId) => {
        onSetSelectedParticipantId(participantId);
        setActiveCoursesTab('enter-test-scores');
    };

    const handleOpenAddForm = () => { setCourseToEdit(null); setActiveCoursesTab('add-course'); };
    const handleOpenEditForm = (course) => { setCourseToEdit(course); setActiveCoursesTab('edit-course'); };
    const handleCancelCourseForm = () => { setCourseToEdit(null); setActiveCoursesTab('courses'); };

    const handleSaveCourseAndReturn = async (courseData) => {
        setIsProcessing(true);
        try {
            await upsertCourse(courseData, currentUserIdentifier);
            await fetchCourses(navigator.onLine);
            setActiveCoursesTab('courses'); 
            setCourseToEdit(null);
            setToast({ show: true, message: 'Course saved successfully!', type: 'success' });
        } catch (error) {
            setToast({ show: true, message: `Failed to save course: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCourseDeleteAction = async (courseId) => {
        const courseToUpdate = allCourses.find(c => c.id === courseId);
        if (!courseToUpdate) return;
        
        setIsProcessing(true);
        try {
            await upsertCourse({ ...courseToUpdate, deletionRequested: false, inRecycleBin: true }, currentUserIdentifier);
            setToast({ show: true, message: 'Course moved to Deleted Courses.', type: 'success' });
            await fetchCourses(navigator.onLine);
        } catch (error) {
            setToast({ show: true, message: `Failed to process deletion: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePermanentDelete = async (courseId) => { 
        if (window.confirm("Are you sure? This will permanently delete the course and cannot be undone.")) {
            setIsProcessing(true);
            try {
                await deleteCourse(courseId, currentUserIdentifier);
                await fetchCourses(navigator.onLine);
                setToast({ show: true, message: 'Course permanently deleted.', type: 'success' });
            } catch (error) {
                setToast({ show: true, message: `Deletion failed: ${error.message}`, type: 'error' });
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleApproveCourse = async (courseId) => {
        const courseToUpdate = allCourses.find(c => c.id === courseId);
        if (courseToUpdate) {
            setIsProcessing(true);
            try {
                await upsertCourse({ ...courseToUpdate, approvalStatus: 'approved' }, currentUserIdentifier);
                await fetchCourses(navigator.onLine);
                setToast({ show: true, message: 'Course approved successfully!', type: 'success' });
            } catch (error) {
                setToast({ show: true, message: `Approval failed: ${error.message}`, type: 'error' });
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleRejectDelete = async (course) => {
        setIsProcessing(true);
        try {
            await upsertCourse({ ...course, deletionRequested: false }, currentUserIdentifier);
            await fetchCourses(navigator.onLine);
            setToast({ show: true, message: 'Deletion request rejected.', type: 'success' });
        } catch (error) {
            setToast({ show: true, message: `Failed to reject deletion: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleRestoreCourse = async (course) => { 
        if (window.confirm(`Are you sure you want to restore the course: ${course.course_type}?`)) {
            setIsProcessing(true);
            try {
                await upsertCourse({ ...course, inRecycleBin: false }, currentUserIdentifier); 
                await fetchCourses(navigator.onLine);
                setToast({ show: true, message: 'Course restored successfully!', type: 'success' });
            } catch (error) {
                setToast({ show: true, message: `Failed to restore course: ${error.message}`, type: 'error' });
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleSaveParticipantTest = async (payload) => {
        setIsProcessing(true);
        try {
            if (!payload.deleted) {
                await upsertParticipantTest(payload);
            }
            if (onBatchUpdate) onBatchUpdate();
        } catch (error) {
            setToast({ show: true, message: `Failed to save test score: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const globalTabs = ['courses', 'add-course', 'edit-course', 'dashboard', 'deleted-courses', 'course-approvals', 'certificate-approvals'];
    const isGlobalView = globalTabs.includes(activeCoursesTab);

    return (
        <Card>
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
                <Button 
                    variant="tab" 
                    disabled={isProcessing}
                    isActive={activeCoursesTab === 'courses' || activeCoursesTab === 'add-course' || activeCoursesTab === 'edit-course'} 
                    onClick={() => { 
                        setActiveCoursesTab('courses');
                        onSetSelectedParticipantId(null);
                    }}
                >
                    {isGlobalView ? 'Courses' : '← Back to Courses'}
                </Button>
                
                {isGlobalView && (
                    <>
                        <Button disabled={isProcessing} variant="tab" isActive={activeCoursesTab === 'dashboard'} onClick={() => { setActiveCoursesTab('dashboard'); onSetSelectedParticipantId(null); }}>Courses Dashboard</Button>

                        {canUseFederalManagerAdvancedFeatures && (
                            <Button disabled={isProcessing} variant="tab" isActive={activeCoursesTab === 'course-approvals'} onClick={() => { setActiveCoursesTab('course-approvals'); onSetSelectedParticipantId(null); }}>
                                Course Approvals
                                 {allCourses.filter(c => c.approvalStatus === 'pending' && !c.inRecycleBin).length > 0 && (
                                     <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                                         {allCourses.filter(c => c.approvalStatus === 'pending' && !c.inRecycleBin).length}
                                     </span>
                                 )}
                            </Button>
                        )}

                        {canUseSuperUserAdvancedFeatures && (
                            <Button disabled={isProcessing} variant="tab" isActive={activeCoursesTab === 'certificate-approvals'} onClick={() => { setActiveCoursesTab('certificate-approvals'); onSetSelectedParticipantId(null); }}>
                                Certificate Approvals
                            </Button>
                        )}

                        {canAccessRecycleBin && (
                            <Button disabled={isProcessing} variant="tab" isActive={activeCoursesTab === 'deleted-courses'} onClick={() => { setActiveCoursesTab('deleted-courses'); onSetSelectedParticipantId(null); }}>
                                Deleted Courses
                                 {allCourses.filter(c => c.inRecycleBin || c.deletionRequested).length > 0 && (
                                     <span className="ml-2 bg-gray-200 text-gray-800 text-xs px-2 py-0.5 rounded-full">{allCourses.filter(c => c.inRecycleBin || c.deletionRequested).length}</span>
                                 )}
                            </Button>
                        )}
                    </>
                )}

                {!isGlobalView && selectedCourse && (
                    <>
                        <Button disabled={isProcessing} variant="tab" isActive={['participants', 'participant-form', 'participant-migration'].includes(activeCoursesTab)} onClick={() => { setActiveCoursesTab('participants'); onSetSelectedParticipantId(null); }}>Participants</Button>
                        <Button disabled={isProcessing || !currentParticipant} variant="tab" isActive={activeCoursesTab === 'monitoring'} onClick={() => setActiveCoursesTab('monitoring')}>Monitoring</Button>
                        <Button disabled={isProcessing} variant="tab" isActive={activeCoursesTab === 'reports'} onClick={() => setActiveCoursesTab('reports')}>Reports</Button>
                        {(['ICCM', 'EENC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management'].includes(selectedCourse.course_type)) && (
                            <Button disabled={isProcessing} variant="tab" isActive={activeCoursesTab === 'enter-test-scores'} onClick={() => { setActiveCoursesTab('enter-test-scores'); }}>Test Scores</Button>
                        )}
                    </>
                )}
            </div>
            
            <div className="p-4">
                {activeCoursesTab === 'courses' && (
                    <>
                        {!activeCourseType ? (
                            <Landing active={activeCourseType} onPick={(t) => setActiveCourseType(t)} />
                        ) : (
                            <div>
                                <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
                                    <div className="flex gap-2">
                                        {canAddCourse && <Button disabled={isProcessing} onClick={handleOpenAddForm} className="bg-sky-600 text-white hover:bg-sky-700">Add New Course</Button>}
                                        <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing || isProcessing}>{isRefreshing ? <Spinner size="sm" /> : <><RefreshCw size={14} className="mr-1"/> Refresh Data</>}</Button>
                                    </div>
                                    <Button disabled={isProcessing} variant="secondary" onClick={() => setActiveCourseType(null)}>Change Course Package</Button>
                                </div>
                                
                                <Card className="p-4 mb-4 bg-gray-50">
                                    <h4 className="text-lg font-semibold mb-3">Filter Courses</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <FormGroup label="Filter by State"><Select disabled={isProcessing} value={filterState} onChange={(e) => setFilterState(e.target.value)}>{filterStateOptions.map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                                        <FormGroup label="Filter by Locality"><Select disabled={isProcessing || filterLocalityOptions.length <= 1} value={filterLocality} onChange={(e) => setFilterLocality(e.target.value)}>{filterLocalityOptions.map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                                        <FormGroup label="Filter by Sub-course"><Select disabled={isProcessing || filterSubCourseOptions.length <= 1} value={filterSubCourse} onChange={(e) => setFilterSubCourse(e.target.value)}>{filterSubCourseOptions.map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                                        <FormGroup label="Filter by Project"><Select disabled={isProcessing || filterProjectOptions.length <= 1} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>{filterProjectOptions.map(p => <option key={p} value={p}>{p}</option>)}</Select></FormGroup>
                                    </div>
                                </Card>
                                
                                <CoursesTable
                                    courses={courses} onOpen={handleOpenCourse} onEdit={handleOpenEditForm} onDelete={handleCourseDeleteAction} 
                                    onOpenReport={onOpenReport} onOpenTestForm={handleOpenTestForm} onOpenAttendanceManager={onOpenAttendanceManager} 
                                    canEditDeleteActiveCourse={canEditDeleteActiveCourse} canEditDeleteInactiveCourse={canEditDeleteInactiveCourse}
                                    userStates={userStates} userLocalities={userLocalities} onAddFinalReport={onAddFinalReport} canManageFinalReport={canUseFederalManagerAdvancedFeatures}
                                    isProcessing={isProcessing}
                                />
                            </div>
                        )}
                    </>
                )}

                {activeCoursesTab === 'dashboard' && (
                    <div className="mt-4">
                        {isLoading?.healthFacilities ? (
                            <div className="flex justify-center p-8"><Spinner /></div>
                        ) : (
                            <CompiledReportView 
                                allCourses={dashboardCourses} 
                                allParticipants={dashboardParticipants} 
                                allHealthFacilities={healthFacilities || []} 
                            />
                        )}
                    </div>
                )}

                {activeCoursesTab === 'course-approvals' && (
                    <CourseApprovalsView 
                        courses={allCourses} 
                        onApproveCourse={handleApproveCourse}
                        isProcessing={isProcessing}
                    />
                )}

                {activeCoursesTab === 'certificate-approvals' && (
                    <CertificateApprovalsView allCourses={allCourses} setToast={setToast} />
                )}

                {activeCoursesTab === 'deleted-courses' && <DeletedCoursesView courses={allCourses.filter(c => c.inRecycleBin || c.deletionRequested)} onRestore={handleRestoreCourse} onPermanentDelete={handlePermanentDelete} isProcessing={isProcessing} />}
                
                {(activeCoursesTab === 'add-course' || activeCoursesTab === 'edit-course') && (
                    <CourseForm courseType={activeCourseType} initialData={courseToEdit} onCancel={handleCancelCourseForm} onSave={handleSaveCourseAndReturn} facilitatorsList={facilitatorsList} fundersList={funders || []} federalCoordinatorsList={federalCoordinators || []} stateCoordinatorsList={stateCoordinators || []} localityCoordinatorsList={localityCoordinators || []} userStates={userStates} userLocalities={userLocalities} />
                )}
                
                {loadingDetails && (!globalTabs.includes(activeCoursesTab)) ? <div className="flex justify-center p-8"><Spinner /></div> : (
                    <>
                        {['participants', 'participant-form', 'participant-migration'].includes(activeCoursesTab) && selectedCourse && (
                            <ParticipantsView
                                course={selectedCourse} 
                                participants={participants} 
                                onOpen={(id) => { onSetSelectedParticipantId(id); setActiveCoursesTab('monitoring'); }}
                                onOpenReport={onOpenParticipantReport} 
                                onBatchUpdate={onBatchUpdate} 
                                onOpenTestFormForParticipant={handleOpenTestFormForParticipant}
                                isCourseActive={isCourseActive} 
                                canAddParticipant={canManageCourse} 
                                canImportParticipants={canUseSuperUserAdvancedFeatures}
                                canCleanParticipantData={canUseSuperUserAdvancedFeatures} 
                                canBulkChangeParticipants={canUseSuperUserAdvancedFeatures}
                                canBulkMigrateParticipants={canUseSuperUserAdvancedFeatures} 
                                canAddMonitoring={(canManageCourse && isCourseActive) || canUseFederalManagerAdvancedFeatures || canEditDeleteInactiveCourse}
                                canEditDeleteParticipantActiveCourse={canManageCourse} 
                                canEditDeleteParticipantInactiveCourse={canEditDeleteInactiveCourse}
                                canManageCertificates={canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures}
                            />
                        )}
                        
                        {activeCoursesTab === 'participants' && !selectedCourse && activeCoursesTab !== 'courses' && <EmptyState message="Please select a course from the 'Courses' tab to view participants." />}
                        {activeCoursesTab === 'monitoring' && selectedCourse && currentParticipant && <Suspense fallback={<Spinner />}><ObservationView course={selectedCourse} participant={currentParticipant} participants={participants} onChangeParticipant={(id) => onSetSelectedParticipantId(id)} /></Suspense>}
                        {activeCoursesTab === 'monitoring' && selectedCourse && !currentParticipant && activeCoursesTab !== 'courses' && <EmptyState message="Please select a participant from the 'Participants' tab to begin monitoring." />}
                        {activeCoursesTab === 'reports' && selectedCourse && <Suspense fallback={<Spinner />}><ReportsView course={selectedCourse} participants={participants} /></Suspense>}
                        
                        {activeCoursesTab === 'enter-test-scores' && selectedCourse && (
                            <CourseTestForm
                                course={selectedCourse} participants={participants} participantTests={participantTests} initialParticipantId={selectedParticipantId}
                                onSaveTest={handleSaveParticipantTest} 
                                onCancel={() => setActiveCoursesTab(selectedParticipantId ? 'participants' : 'courses')}
                                onSave={() => { setActiveCoursesTab('participants'); onBatchUpdate(); }} 
                                canManageTests={canManageCourse || canUseFederalManagerAdvancedFeatures} 
                                onSaveParticipant={async (participantData, facilityUpdateData) => {
                                    const savedParticipant = await saveParticipantAndSubmitFacilityUpdate(participantData, facilityUpdateData, currentUserIdentifier);
                                    if (facilityUpdateData) setToast({ show: true, message: 'Facility update submitted for approval.', type: 'info' });
                                    return savedParticipant;
                                }}
                            />
                        )}
                    </>
                )}
            </div>
        </Card>
    );
}

const MultiSelectDropdown = ({ options, selectedValues, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    const toggleSelection = (value) => {
        if (selectedValues.includes(value)) {
            onChange(selectedValues.filter(v => v !== value));
        } else {
            onChange([...selectedValues, value]);
        }
    };

    const displayNames = selectedValues.map(val => {
        const opt = options.find(o => o.value === val);
        return opt ? opt.label : val;
    }).join('، ');

    return (
        <div className="relative" ref={ref}>
            <div 
                className={`border border-gray-300 rounded-md p-2 text-sm w-full bg-white flex justify-between items-center min-h-[42px] cursor-pointer ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-sky-400'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className="truncate text-gray-700">{selectedValues.length > 0 ? displayNames : placeholder}</span>
                <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-y-auto">
                    {options.map(opt => (
                        <label key={opt.value} className="flex items-center p-2 hover:bg-sky-50 cursor-pointer border-b border-gray-100 last:border-0 m-0">
                            <input type="checkbox" checked={selectedValues.includes(opt.value)} onChange={() => toggleSelection(opt.value)} className="ml-3 h-4 w-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500 cursor-pointer" />
                            <span className="text-sm text-gray-700 font-medium">{opt.label}</span>
                        </label>
                    ))}
                    {options.length === 0 && <div className="p-3 text-gray-500 text-sm text-center">لا توجد خيارات</div>}
                </div>
            )}
        </div>
    );
};

const SearchableSelect = ({ label, options, value, onChange, onOpenNewForm, placeholder, disabled }) => {
     const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const ref = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
                setInputValue(value || '');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref, value]);

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        return options.filter(opt => opt.name.toLowerCase().includes(inputValue.toLowerCase()));
    }, [options, inputValue]);

    const isNewEntry = inputValue && !options.some(opt => opt.name.toLowerCase() === inputValue.toLowerCase());

    const handleSelect = (option) => {
        onChange(option.name);
        setInputValue(option.name);
        setIsOpen(false);
    };

    const handleAddNew = () => {
        if (onOpenNewForm) {
            onOpenNewForm(inputValue);
            setIsOpen(false);
        }
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
                        onChange('');
                    }
                }}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
            />
            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {onOpenNewForm && (
                        <div
                            className={`p-2 cursor-pointer font-medium text-indigo-600 hover:bg-gray-100 ${isNewEntry ? 'border-b' : ''}`}
                            onClick={handleAddNew}
                        >
                           {`+ Add "${isNewEntry ? inputValue : `New ${label ? label.replace(':', '') : ''}`}"`}
                        </div>
                    )}
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <div
                                key={opt.id}
                                className="p-2 cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSelect(opt)}
                            >
                                {opt.name}
                            </div>
                        ))
                    ) : (
                        <div className="p-2 text-gray-500">No results found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export function CourseForm({ 
    courseType, initialData, facilitatorsList, fundersList, onCancel, onSave, 
    federalCoordinatorsList = [], stateCoordinatorsList = [], localityCoordinatorsList = [],
    userStates, userLocalities 
}) {
    const availableStates = useMemo(() => {
        const allStates = Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(b.ar));
        if (!userStates || userStates.length === 0) {
            return allStates;
        }
        return allStates.filter(s => userStates.includes(s));
    }, [userStates]);

    const [isSaving, setIsSaving] = useState(false);

    const [states, setStates] = useState(initialData?.states || (initialData?.state ? initialData.state.split(',').map(s=>s.trim()) : (userStates && userStates.length === 1 ? [userStates[0]] : [])));
    
    const availableLocalities = useMemo(() => {
        if (!states || states.length === 0) return [];
        let allLocalities = [];
        states.forEach(s => {
            if (STATE_LOCALITIES[s]) {
                allLocalities = [...allLocalities, ...(STATE_LOCALITIES[s].localities || [])];
            }
        });
        const uniqueLocalities = Array.from(new Map(allLocalities.map(item => [item.en, item])).values()).sort((a,b) => a.ar.localeCompare(b.ar));
        
        if (!userLocalities || userLocalities.length === 0) {
            return uniqueLocalities;
        }
        return uniqueLocalities.filter(l => userLocalities.includes(l.en) || userLocalities.includes(l.ar));
    }, [states, userLocalities]);

    const [localities, setLocalities] = useState(initialData?.localities || (initialData?.locality ? initialData.locality.split(',').map(l=>l.trim()) : (userLocalities && userLocalities.length === 1 ? [userLocalities[0]] : [])));
    
    const [hall, setHall] = useState(initialData?.hall || '');
    const [hallEnglish, setHallEnglish] = useState(initialData?.hall_english || '');
    const [startDate, setStartDate] = useState(initialData?.start_date || '');
    const [courseDuration, setCourseDuration] = useState(initialData?.course_duration || 7);
    const [coordinator, setCoordinator] = useState(initialData?.coordinator || '');
    const [participantsCount, setParticipantsCount] = useState(initialData?.participants_count || 0);
    const [courseBudget, setCourseBudget] = useState(initialData?.course_budget || '');
    const [director, setDirector] = useState(initialData?.director || '');
    const [clinical, setClinical] = useState(initialData?.clinical_instructor || '');
    const [supporter, setSupporter] = useState(initialData?.funded_by || '');
    const [stateCoordinator, setStateCoordinator] = useState(initialData?.state_coordinator || '');
    const [localityCoordinator, setLocalityCoordinator] = useState(initialData?.locality_coordinator || '');
    const [courseProject, setCourseProject] = useState(initialData?.course_project || '');
    const [implementedBy, setImplementedBy] = useState(initialData?.implemented_by || '');

    const [directorImciSubType, setDirectorImciSubType] = useState(initialData?.director_imci_sub_type || IMNCI_SUBCOURSE_TYPES[0]);
    const [clinicalImciSubType, setClinicalImciSubType] = useState(initialData?.clinical_instructor_imci_sub_type || IMNCI_SUBCOURSE_TYPES[0]);

    const INFECTION_CONTROL_SUBCOURSE_TYPES = [
        'IPC in Delivery room',
        'IPC in Neonatal unit',
        'Neonatal Sepsis Surveillance',
    ];

    const ICCM_SUBCOURSE_TYPES = ['ICCM Community Module'];
    const SMALL_AND_SICK_SUBCOURSE_TYPES = ['Portable warmer training', 'CPAP training', 'Kangaroo mother Care'];

    const EENC_SUBCOURSE_TYPES = [
        'EENC EmONC', 
        'EENC Orientation', 
        'EENC TOT', 
        'EENC Mentorship'
    ];

    const ETAT_SUBCOURSE_TYPES = [
        'ETAT Standard', 
        'ETAT Orientation', 
        'ETAT Plus', 
        'ETAT Mentorship'
    ];

    const PROGRAM_MANAGEMENT_SUBCOURSE_TYPES = [
        'IMNCI implementation operational Guide (الدليل التشغيلي لتطبيق العلاج المتكامل)',
        'planning, Monitoring and evaluation (التخطيط والمتابعة والتقييم)'
    ];

    const COURSE_GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];

    const isImnci = courseType === 'IMNCI';
    const isInfectionControl = courseType === 'IPC';
    const isIccm = courseType === 'ICCM';
    const isSmallAndSick = courseType === 'Small & Sick Newborn';
    const isEenc = courseType === 'EENC';
    const isEtat = courseType === 'ETAT';
    const isProgramManagement = courseType === 'Program Management';

    const [groups, setGroups] = useState(initialData?.facilitatorAssignments?.length > 0 ? [...new Set(initialData.facilitatorAssignments.map(a => a.group))] : ['Group A', 'Group B']);

    const [facilitatorGroups, setFacilitatorGroups] = useState(() => {
        const defaultSubcourse = isIccm ? ICCM_SUBCOURSE_TYPES[0] : '';
        if (initialData?.facilitatorAssignments?.length > 0) {
            const groups = {};
            initialData.facilitatorAssignments.forEach(assignment => {
                if (!groups[assignment.group]) {
                    groups[assignment.group] = [];
                }
                groups[assignment.group].push({
                    name: assignment.name,
                    imci_sub_type: assignment.imci_sub_type,
                });
            });
            const initialGroups = [...new Set(initialData.facilitatorAssignments.map(a => a.group))];
            initialGroups.forEach(group => {
                if (!groups[group]) {
                    groups[group] = [];
                }
            });
            return groups;
        }
        return {
            'Group A': [{ imci_sub_type: defaultSubcourse, name: '' }, { imci_sub_type: defaultSubcourse, name: '' }],
            'Group B': [{ imci_sub_type: defaultSubcourse, name: '' }, { imci_sub_type: defaultSubcourse, name: '' }]
        };
    });

    const [error, setError] = useState('');

    const directorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => f.directorCourse === 'Yes')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList]);

    const clinicalInstructorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => f.isClinicalInstructor === 'Yes' || f.directorCourse === 'Yes')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList]);

    const facilitatorOptions = useMemo(() => {
        return facilitatorsList
            .filter(f => {
                const fCourses = Array.isArray(f.courses) ? f.courses : [];
                
                if (isIccm) return fCourses.includes('ICCM') || fCourses.includes('IMNCI');
                if (isInfectionControl) return fCourses.includes('IPC');
                if (isProgramManagement) return fCourses.includes('Program Management') || fCourses.includes('IMNCI');
                
                return fCourses.includes(courseType);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, courseType, isInfectionControl, isIccm, isProgramManagement]);

    const federalCoordinatorOptions = useMemo(() => {
        return federalCoordinatorsList.map(c => ({ id: c.id, name: c.name }));
    }, [federalCoordinatorsList]);

    const stateCoordinatorOptions = useMemo(() => {
        const sortedList = [...stateCoordinatorsList].sort((a, b) => {
            const aIsMatch = states.includes(a.state);
            const bIsMatch = states.includes(b.state);
            if (aIsMatch && !bIsMatch) return -1;
            if (!aIsMatch && bIsMatch) return 1;
            return a.name.localeCompare(b.name);
        });
        return sortedList.map(c => ({ id: c.id, name: `${c.name} (${c.state})` }));
    }, [stateCoordinatorsList, states]);

    const localityCoordinatorOptions = useMemo(() => {
        const sortedList = [...localityCoordinatorsList].sort((a, b) => {
            const aIsExact = states.includes(a.state) && localities.includes(a.locality);
            const bIsExact = states.includes(b.state) && localities.includes(b.locality);
            if (aIsExact && !bIsExact) return -1;
            if (!aIsExact && bIsExact) return 1;

            const aIsStateMatch = states.includes(a.state);
            const bIsStateMatch = states.includes(b.state);
            if (aIsStateMatch && !bIsStateMatch) return -1;
            if (!aIsStateMatch && bIsStateMatch) return 1;

            return a.name.localeCompare(b.name);
        });
        return sortedList.map(c => ({ id: c.id, name: `${c.name} (${c.locality}, ${c.state})` }));
    }, [localityCoordinatorsList, states, localities]);

    const funderOptions = useMemo(() => {
        return (fundersList || []).map(f => ({ id: f.id, name: f.orgName }));
    }, [fundersList]);

    const projectOptions = useMemo(() => {
        if (!fundersList) return [];
        const allProjects = fundersList.flatMap(partner => partner.projects || []);
        const uniqueProjects = [...new Set(allProjects)].sort();
        return uniqueProjects.map(proj => ({ id: proj, name: proj }));
    }, [fundersList]);

    const addFacilitatorToGroup = (groupName) => {
        const defaultSubcourse = isIccm ? ICCM_SUBCOURSE_TYPES[0] : '';
        setFacilitatorGroups(prev => ({
            ...prev,
            [groupName]: [...prev[groupName], { imci_sub_type: defaultSubcourse, name: '' }]
        }));
    };

    const removeFacilitatorFromGroup = (groupName, index) => {
        setFacilitatorGroups(prev => ({
            ...prev,
            [groupName]: prev[groupName].filter((_, i) => i !== index)
        }));
    };

    const updateFacilitatorAssignment = (groupName, index, field, value) => {
        setFacilitatorGroups(prev => ({
            ...prev,
            [groupName]: prev[groupName].map((item, i) => (i === index ? { ...item, [field]: value } : item))
        }));
    };

    const addGroup = () => {
        const nextGroupIndex = groups.length;
        if (nextGroupIndex < COURSE_GROUPS.length) {
            const defaultSubcourse = isIccm ? ICCM_SUBCOURSE_TYPES[0] : '';
            const newGroup = COURSE_GROUPS[nextGroupIndex];
            setGroups(prev => [...prev, newGroup]);
            setFacilitatorGroups(prev => ({
                ...prev,
                [newGroup]: [{ imci_sub_type: defaultSubcourse, name: '' }]
            }));
        }
    };

    const removeGroup = (groupName) => {
        setGroups(prev => prev.filter(g => g !== groupName));
        setFacilitatorGroups(prev => {
            const newGroups = { ...prev };
            delete newGroups[groupName];
            return newGroups;
        });
    };

    const submit = async () => {
        const allFacilitatorAssignments = groups.reduce((acc, group) => {
            const groupAssignments = facilitatorGroups[group].map(assignment => ({
                ...assignment,
                group: group
            })).filter(assignment => assignment.name && (assignment.imci_sub_type || isIccm));
            
            if (isIccm) {
                groupAssignments.forEach(a => a.imci_sub_type = ICCM_SUBCOURSE_TYPES[0]);
            }
            
            return [...acc, ...groupAssignments];
        }, []);

        if (states.length === 0 || localities.length === 0 || !hall || !coordinator || !participantsCount || !supporter || !startDate || !implementedBy) {
            setError('الرجاء إكمال جميع الحقول المطلوبة.');
            return;
        }
        
        if (!courseType) {
            setError('تعذر تحديد نوع الدورة. الرجاء العودة لصفحة الدورات واختيار حزمة قبل إضافة دورة جديدة.');
            return;
        }

        if (!isInfectionControl && !director) {
            setError('الرجاء اختيار مدير الدورة. هذا الحقل إلزامي لهذا النوع من الدورات.');
            return;
        }

        if (!isInfectionControl && !isSmallAndSick && allFacilitatorAssignments.length === 0) {
             setError('الرجاء تعيين ميسر واحد على الأقل.');
             return;
        }

        const payload = {
            ...(initialData?.id && { id: initialData.id }),
            state: states.join(', '), 
            locality: localities.join(', '),
            states: states,
            localities: localities,
            hall, hall_english: hallEnglish, coordinator, start_date: startDate,
            course_duration: courseDuration,
            participants_count: participantsCount, director,
            funded_by: supporter,
            implemented_by: implementedBy,
            course_budget: courseBudget,
            state_coordinator: stateCoordinator,
            locality_coordinator: localityCoordinator,
            course_project: courseProject,
            facilitators: allFacilitatorAssignments.map(f => f.name),
            facilitatorAssignments: allFacilitatorAssignments,
            course_type: courseType, 
            approvalStatus: initialData?.approvalStatus || 'pending', 
        };

        if (isImnci || isIccm) {
            payload.clinical_instructor = clinical;
            payload.director_imci_sub_type = isIccm ? ICCM_SUBCOURSE_TYPES[0] : directorImciSubType;
            payload.clinical_instructor_imci_sub_type = isIccm ? ICCM_SUBCOURSE_TYPES[0] : clinicalImciSubType;
        }

        setIsSaving(true);
        try {
            await onSave(payload);
        } catch(e) {
            setError(e.message || "حدث خطأ أثناء حفظ الدورة.");
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <div className="p-6" dir="rtl" style={{ textAlign: 'right' }}>
                <PageHeader title={initialData ? 'تعديل دورة' : 'إضافة دورة'} subtitle={`الحزمة: ${courseType || 'غير محدد'}`} className="mb-6" />
                {error && <div className="p-3 mb-6 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                
                <div className="mb-8">
                    <h3 className="text-lg font-bold bg-sky-100 text-sky-800 p-3 rounded-md mb-4 border-r-4 border-sky-500">معلومات الدورة الأساسية</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FormGroup label="الولايات (يمكن اختيار أكثر من ولاية)">
                            <MultiSelectDropdown 
                                disabled={isSaving} 
                                selectedValues={states} 
                                onChange={setStates} 
                                placeholder="— اختر الولايات —"
                                options={availableStates.map(s => ({ value: s, label: STATE_LOCALITIES[s].ar }))} 
                            />
                        </FormGroup>
                        <FormGroup label="المحليات (يمكن اختيار أكثر من محلية)">
                            <MultiSelectDropdown 
                                disabled={isSaving || states.length === 0} 
                                selectedValues={localities} 
                                onChange={setLocalities} 
                                placeholder="— اختر المحليات —"
                                options={availableLocalities.map(l => ({ value: l.en, label: l.ar }))} 
                            />
                        </FormGroup>
                        <FormGroup label="قاعة الدورة">
                            <Input disabled={isSaving} value={hall} onChange={(e) => setHall(e.target.value)} />
                        </FormGroup>
                        <FormGroup label="قاعة الدورة (باللغة الإنجليزية - للشهادات)">
                            <Input disabled={isSaving} value={hallEnglish} onChange={(e) => setHallEnglish(e.target.value)} dir="ltr" placeholder="Course Hall Name in English" />
                        </FormGroup>
                        <FormGroup label="تاريخ بداية الدورة"><Input disabled={isSaving} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></FormGroup>
                        <FormGroup label="مدة الدورة بالأيام"><Input disabled={isSaving} type="number" value={courseDuration} onChange={(e) => setCourseDuration(Number(e.target.value))} /></FormGroup>
                        <FormGroup label="عدد المشاركين"><Input disabled={isSaving} type="number" value={participantsCount} onChange={(e) => setParticipantsCount(Number(e.target.value))} /></FormGroup>
                        <FormGroup label="ميزانية الدورة بالدولار الأمريكي"><Input disabled={isSaving} type="number" value={courseBudget} onChange={(e) => setCourseBudget(Number(e.target.value))} /></FormGroup>
                    </div>
                </div>

                <div className="mb-8">
                    <h3 className="text-lg font-bold bg-green-100 text-green-800 p-3 rounded-md mb-4 border-r-4 border-green-500">التنسيق والتمويل</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FormGroup label="المنسق الاتحادي للدورة">
                            <SearchableSelect
                                disabled={isSaving}
                                value={coordinator}
                                onChange={setCoordinator}
                                options={federalCoordinatorOptions}
                                placeholder="اكتب للبحث..."
                                label="المنسق الاتحادي للدورة"
                            />
                        </FormGroup>
                        <FormGroup label="المنسق الولائي للدورة">
                            <SearchableSelect
                                disabled={isSaving}
                                value={stateCoordinator}
                                onChange={setStateCoordinator}
                                options={stateCoordinatorOptions}
                                placeholder="اكتب للبحث..."
                                label="المنسق الولائي للدورة"
                            />
                        </FormGroup>
                        <FormGroup label="منسق الدورة بالمحلية">
                            <SearchableSelect
                                disabled={isSaving}
                                value={localityCoordinator}
                                onChange={setLocalityCoordinator}
                                options={localityCoordinatorOptions}
                                placeholder="اكتب للبحث..."
                                label="منسق الدورة بالمحلية"
                            />
                        </FormGroup>
                        <FormGroup label="بتمويل من">
                            <SearchableSelect
                                disabled={isSaving}
                                value={supporter}
                                onChange={setSupporter}
                                options={funderOptions}
                                placeholder="اكتب للبحث..."
                                label="بتمويل من"
                            />
                        </FormGroup>
                        <FormGroup label="تنفيذ">
                            <SearchableSelect
                                disabled={isSaving}
                                value={implementedBy}
                                onChange={setImplementedBy}
                                options={funderOptions}
                                placeholder="اكتب للبحث..."
                                label="تنفيذ"
                            />
                        </FormGroup>
                        <FormGroup label="مشروع الدورة">
                             <SearchableSelect
                                disabled={isSaving}
                                value={courseProject}
                                onChange={setCourseProject}
                                options={projectOptions}
                                placeholder="اكتب للبحث..."
                                label="مشروع الدورة"
                            />
                        </FormGroup>
                    </div>
                </div>

                {!isInfectionControl && (
                    <div className="mb-8">
                        <h3 className="text-lg font-bold bg-amber-100 text-amber-800 p-3 rounded-md mb-4 border-r-4 border-amber-500">مهام القيادة</h3>
                        <div className="flex flex-col space-y-4 p-5 border border-gray-200 shadow-sm rounded-lg bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                                <FormGroup label="مدير الدورة">
                                    <SearchableSelect
                                        disabled={isSaving}
                                        value={director}
                                        onChange={setDirector}
                                        options={directorOptions}
                                        placeholder="اكتب للبحث..."
                                        label="مدير الدورة"
                                    />
                                </FormGroup>
                                {isImnci && (
                                    <FormGroup label="اسم الورشة الفرعية">
                                        <Select disabled={isSaving} value={directorImciSubType} onChange={(e) => setDirectorImciSubType(e.target.value)} className="w-full">
                                            {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                        </Select>
                                    </FormGroup>
                                )}
                            </div>

                            {(isImnci || isIccm) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end pt-5 border-t border-gray-100">
                                    <FormGroup label="المدرب السريري - اختياري">
                                        <SearchableSelect
                                            disabled={isSaving}
                                            value={clinical}
                                            onChange={setClinical}
                                            options={clinicalInstructorOptions}
                                            placeholder="اكتب للبحث..."
                                            label="المدرب السريري - اختياري"
                                        />
                                    </FormGroup>
                                    {isImnci && (
                                        <FormGroup label="اسم الورشة الفرعية">
                                            <Select disabled={isSaving} value={clinicalImciSubType} onChange={(e) => setClinicalImciSubType(e.target.value)} className="w-full">
                                                {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                            </Select>
                                        </FormGroup>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="mb-8">
                    <h3 className="text-lg font-bold bg-purple-100 text-purple-800 p-3 rounded-md mb-4 border-r-4 border-purple-500">مهام الميسرين / المدربين</h3>
                    <div className="space-y-6">
                        {groups.map(groupName => (
                            <div key={groupName} className="p-6 border-2 border-indigo-50 shadow-md rounded-xl bg-white relative">
                                <h4 className="text-md font-bold mb-5 text-indigo-700 bg-indigo-50 inline-block px-4 py-1.5 rounded-lg border border-indigo-200">{groupName}</h4>
                                {facilitatorGroups[groupName]?.map((assignment, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4 items-end pb-4 border-b border-gray-50 last:border-0">
                                        <FormGroup label="اسم الميسر" className={isIccm ? "lg:col-span-2" : ""}>
                                            <SearchableSelect
                                                disabled={isSaving}
                                                value={assignment.name}
                                                onChange={(value) => updateFacilitatorAssignment(groupName, index, 'name', value)}
                                                options={facilitatorOptions}
                                                placeholder="اكتب للبحث..."
                                                label="اسم الميسر"
                                            />
                                        </FormGroup>
                                        {!isIccm && (
                                            <FormGroup label="اسم الورشة الفرعية">
                                                <Select
                                                    disabled={isSaving}
                                                    value={assignment.imci_sub_type || ''}
                                                    onChange={(e) => updateFacilitatorAssignment(groupName, index, 'imci_sub_type', e.target.value)}
                                                    className="w-full"
                                                >
                                                    <option value="">— اختر الورشة الفرعية —</option>
                                                    {(isImnci ? IMNCI_SUBCOURSE_TYPES : 
                                                      isIccm ? ICCM_SUBCOURSE_TYPES : 
                                                      isInfectionControl ? INFECTION_CONTROL_SUBCOURSE_TYPES : 
                                                      isSmallAndSick ? SMALL_AND_SICK_SUBCOURSE_TYPES :
                                                      isEenc ? EENC_SUBCOURSE_TYPES :
                                                      isEtat ? ETAT_SUBCOURSE_TYPES :
                                                      isProgramManagement ? PROGRAM_MANAGEMENT_SUBCOURSE_TYPES :
                                                      []
                                                    ).map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </Select>
                                            </FormGroup>
                                        )}
                                        <div className="flex items-end pb-1">
                                            <Button type="button" variant="danger" disabled={isSaving || facilitatorGroups[groupName]?.length <= 1} onClick={() => removeFacilitatorFromGroup(groupName, index)}>إزالة</Button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-end mt-2 pt-4">
                                    <Button type="button" variant="secondary" disabled={isSaving} onClick={() => addFacilitatorToGroup(groupName)} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">إضافة ميسر آخر لهذه المجموعة</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {groups.length < COURSE_GROUPS.length && (
                        <div className="flex justify-start mt-4">
                            <Button type="button" variant="secondary" disabled={isSaving} onClick={addGroup} className="font-bold border-dashed border-2">إضافة مجموعة أخرى</Button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 justify-end mt-8 border-t pt-6">
                    <Button variant="secondary" onClick={onCancel} disabled={isSaving}>إلغاء</Button>
                    <Button onClick={submit} disabled={isSaving}>
                        {isSaving ? <Spinner size="sm" /> : 'حفظ الدورة'}
                    </Button>
                </div>
            </div>
        </Card>
    );
}

export function PublicCourseMonitoringView({ course, allParticipants }) {
    const [selectedParticipantId, setSelectedParticipantId] = useState(
        allParticipants && allParticipants.length > 0 ? allParticipants[0].id : null
    );
    
    const currentParticipant = allParticipants.find(p => p.id === selectedParticipantId);

    if (!course) return <EmptyState message="Course data unavailable." />;

    return (
        <div className="space-y-6">
            <Card>
                <div className="p-6 border-b border-gray-100">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-sky-100 rounded-lg">
                            <Eye className="w-6 h-6 text-sky-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Course Monitoring</h1>
                     </div>
                     <div className="text-gray-600">
                        <span className="font-semibold text-gray-900">{course.course_type}</span>
                        <span className="mx-2">•</span>
                        <span>{course.state} - {course.locality}</span>
                        <span className="mx-2">•</span>
                        <span>{course.start_date}</span>
                     </div>
                </div>
            </Card>

            <Suspense fallback={<div className="flex justify-center p-10"><Spinner /></div>}>
                {allParticipants && allParticipants.length > 0 ? (
                    currentParticipant ? (
                        <ObservationView 
                            course={course} 
                            participant={currentParticipant} 
                            participants={allParticipants}
                            onChangeParticipant={setSelectedParticipantId}
                        />
                    ) : (
                         <div className="flex justify-center p-10"><Spinner /></div>
                    )
                ) : (
                    <EmptyState message="No participants found for this course." />
                )}
            </Suspense>
        </div>
    );
}