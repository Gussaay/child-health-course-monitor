// src/components/Course.jsx
import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { 
    Button, Card, EmptyState, FormGroup, Input, PageHeader, 
    Select, Spinner, Table, CourseIcon, Modal, CardBody, CardFooter, Toast 
} from './CommonComponents'; 

// --- Firebase Imports ---
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { getFunctions, httpsCallable } from 'firebase/functions'; 

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
import { CourseExercisesView } from './Online-exercise'; 
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_SSNC, JOB_TITLES_ETAT, JOB_TITLES_EMONC,
    COURSE_LEVELS, isFederalCourse, isFederalValue, getAllStateOptions, getLocalityOptionsForState,
    hasMentorshipForm, isMentorshipSubCourse, getMentorshipSubType,
    getCourseMentorshipService,
    COURSE_SUB_TYPES_COLLECTION, ICCM_SUBCOURSE_TYPES, CPCM_SUBCOURSE_TYPES,
    mergeSubCourseTypes, isBuiltinSubCourse, getCourseSubTypes
} from './constants.js';
import { 
    Users, Share2, UserPlus, CheckCircle, 
    FileText, Edit, Trash2, ExternalLink, Link as LinkIcon, Eye, BarChart2,
    AlertTriangle, Shield, Check, X, RefreshCw, Archive, ClipboardList,
    Award, FileSignature, Stamp, Upload, Lock, XCircle, QrCode, Send, Copy, Download
} from 'lucide-react'; 
import { useDataCache } from '../DataContext'; 
import { useAuth } from '../hooks/useAuth'; 
import { Capacitor } from '@capacitor/core';

import SudanMap from '../SudanMap';
import CompiledReportView from './CompiledReportView.jsx';

import { 
    CertificateVerificationView, 
    PublicCertificateDownloadView, 
    PublicCourseCertificatesView, 
    CertificateApprovalsView 
} from './CertificateGenerator';

const ReportsView = React.lazy(() => import('./ReportsView').then(module => ({ default: module.ReportsView })));
const ObservationView = React.lazy(() => import('./MonitoringView').then(module => ({ default: module.ObservationView })));
const MentorshipMonitoringView = React.lazy(() => import('./MonitoringView').then(module => ({ default: module.MentorshipMonitoringView })));

// --- NEW EmONC FOLDER SUITE LAZY IMPORTS ---
const MaternalEmergencyMonitoring = React.lazy(() => import('./EmONC/MaternalEmergencyMonitoring').then(module => ({ default: module.MaternalEmergencyMonitoring })));
const NeonatalEmergencyMonitoring = React.lazy(() => import('./EmONC/NeonatalEmergencyMonitoring').then(module => ({ default: module.NeonatalEmergencyMonitoring })));

// --- BULLETPROOF FACILITATOR ID & SYNC MIGRATION MODAL ---
export function FacilitatorIdMigrationModal({ isOpen, onClose, onComplete }) {
    const [loading, setLoading] = useState(false);
    const [progressText, setProgressText] = useState('');

    const [allFacilitators, setAllFacilitators] = useState([]);
    const [rawCourses, setRawCourses] = useState([]);

    const [autoMappings, setAutoMappings] = useState({});
    const [manualMappings, setManualMappings] = useState({});
    const [unmatchedList, setUnmatchedList] = useState([]);
    const [outdatedCoursesCount, setOutdatedCoursesCount] = useState(0);

    useEffect(() => {
        if (isOpen) {
            analyzeData();
        } else {
            setAutoMappings({});
            setManualMappings({});
            setUnmatchedList([]);
            setAllFacilitators([]);
            setRawCourses([]);
            setOutdatedCoursesCount(0);
        }
    }, [isOpen]);

    const analyzeData = async () => {
        setLoading(true);
        setProgressText("Fetching database records...");
        try {
            const facSnap = await getDocs(collection(db, "facilitators"));
            const facs = [];
            facSnap.forEach(d => facs.push({ id: d.id, ...d.data() }));
            
            const crsSnap = await getDocs(collection(db, "courses"));
            const crs = [];
            crsSnap.forEach(d => crs.push({ id: d.id, ...d.data() }));
            
            setAllFacilitators(facs.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            setRawCourses(crs);

            setProgressText("Analyzing names and checking for outdated records...");

            const uniqueNamesInCourses = new Set();
            let outdatedSyncNeeded = 0;

            crs.forEach(course => {
                let hasOutdated = false;
                const checkOutdated = (id, str) => {
                    if (id && str) {
                        const f = facs.find(x => x.id === id);
                        if (f && f.name !== str) return true;
                    }
                    return false;
                };

                if (course.director && !course.directorId) uniqueNamesInCourses.add(course.director);
                if (course.clinical_instructor && !course.clinical_instructorId) uniqueNamesInCourses.add(course.clinical_instructor);
                
                if (Array.isArray(course.facilitators) && (!course.facilitatorIds || course.facilitatorIds.length === 0)) {
                    course.facilitators.forEach(f => uniqueNamesInCourses.add(f));
                }

                if (Array.isArray(course.facilitatorAssignments)) {
                    course.facilitatorAssignments.forEach(a => {
                        if (a.name && !a.facilitatorId) uniqueNamesInCourses.add(a.name);
                        if (checkOutdated(a.facilitatorId, a.name)) hasOutdated = true;
                    });
                }
                
                if (checkOutdated(course.directorId, course.director)) hasOutdated = true;
                if (checkOutdated(course.clinical_instructorId, course.clinical_instructor)) hasOutdated = true;
                
                if (hasOutdated) outdatedSyncNeeded++;
            });

            setOutdatedCoursesCount(outdatedSyncNeeded);

            const autoMap = {};
            const unmatched = [];

            const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');

            uniqueNamesInCourses.forEach(rawName => {
                if (!rawName) return;
                const clean = rawName.toLowerCase().trim();
                const norm = normalize(rawName);
                
                let match = facs.find(f => f.name?.toLowerCase().trim() === clean || f.arabicName?.trim() === clean);
                
                if (!match) {
                    match = facs.find(f => {
                        const fNameNorm = normalize(f.name || '');
                        if (fNameNorm.length < 4 || norm.length < 4) return false;
                        return fNameNorm === norm || fNameNorm.includes(norm) || norm.includes(fNameNorm);
                    });
                }

                if (match) {
                    autoMap[rawName] = { id: match.id, name: match.name };
                } else {
                    unmatched.push(rawName);
                }
            });

            setAutoMappings(autoMap);
            setUnmatchedList(unmatched);

        } catch (error) {
            alert("Error analyzing data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleManualMapChange = (unmatchedName, facId) => {
        const fac = allFacilitators.find(f => f.id === facId);
        if (fac) {
            setManualMappings(prev => ({ ...prev, [unmatchedName]: { id: fac.id, name: fac.name } }));
        } else {
            setManualMappings(prev => {
                const next = {...prev};
                delete next[unmatchedName];
                return next;
            });
        }
    };

    const applyMigration = async () => {
        setLoading(true);
        const combinedMapping = { ...autoMappings, ...manualMappings };
        
        try {
            let updatedCount = 0;
            
            for (let i = 0; i < rawCourses.length; i++) {
                const course = rawCourses[i];
                setProgressText(`Updating course ${i + 1} of ${rawCourses.length}...`);
                
                let needsUpdate = false;
                let updates = {};

                const getMatchedFac = (n) => n ? combinedMapping[n] : null;
                const getFacById = (id) => allFacilitators.find(f => f.id === id);

                // BULLETPROOF LOGIC: Manual maps override everything.
                
                // 1. Director
                const mappedDir = getMatchedFac(course.director);
                if (mappedDir) {
                    if (course.directorId !== mappedDir.id || course.director !== mappedDir.name) {
                        updates.directorId = mappedDir.id; updates.director = mappedDir.name; needsUpdate = true;
                    }
                } else if (course.directorId) {
                    const f = getFacById(course.directorId);
                    if (f && f.name !== course.director) { updates.director = f.name; needsUpdate = true; }
                }

                // 2. Clinical
                const mappedClin = getMatchedFac(course.clinical_instructor);
                if (mappedClin) {
                    if (course.clinical_instructorId !== mappedClin.id || course.clinical_instructor !== mappedClin.name) {
                        updates.clinical_instructorId = mappedClin.id; updates.clinical_instructor = mappedClin.name; needsUpdate = true;
                    }
                } else if (course.clinical_instructorId) {
                    const f = getFacById(course.clinical_instructorId);
                    if (f && f.name !== course.clinical_instructor) { updates.clinical_instructor = f.name; needsUpdate = true; }
                }

                // 3. Assignments
                if (Array.isArray(course.facilitatorAssignments)) {
                    let changed = false;
                    const newAssignments = course.facilitatorAssignments.map(ass => {
                        const m = getMatchedFac(ass.name);
                        if (m) {
                            if (ass.facilitatorId !== m.id || ass.name !== m.name) {
                                changed = true; return { ...ass, facilitatorId: m.id, name: m.name };
                            }
                        } else if (ass.facilitatorId) {
                            const f = getFacById(ass.facilitatorId);
                            if (f && f.name !== ass.name) { changed = true; return { ...ass, name: f.name }; }
                        }
                        return ass;
                    });
                    
                    if (changed) { 
                        updates.facilitatorAssignments = newAssignments; 
                        updates.facilitatorIds = newAssignments.map(a => a.facilitatorId).filter(Boolean);
                        updates.facilitators = newAssignments.map(a => a.name).filter(Boolean);
                        needsUpdate = true;
                    }
                } else if (Array.isArray(course.facilitators)) {
                    let newNames = [];
                    let newIds = [];
                    let changed = false;
                    course.facilitators.forEach(fName => {
                        const m = getMatchedFac(fName);
                        if (m) { newIds.push(m.id); newNames.push(m.name); changed = true; }
                        else { newNames.push(fName); } 
                    });
                    if (changed) {
                        updates.facilitators = newNames;
                        updates.facilitatorIds = newIds;
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    await updateDoc(doc(db, "courses", course.id), updates);
                    updatedCount++;
                }
            }

            alert(`Success! Updated ${updatedCount} courses. Both IDs and Names have been permanently synchronized.`);
            if (onComplete) onComplete();
            onClose();

        } catch (err) {
            alert("Error applying migration: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={loading ? null : onClose} title="Total Synchronization Tool" size="2xl">
            <CardBody className="p-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-10">
                        <Spinner size="lg" />
                        <p className="mt-4 text-gray-600 font-medium">{progressText}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <h4 className="font-bold text-blue-800 text-lg">Analysis Complete</h4>
                            <ul className="list-disc pl-5 mt-2 text-blue-700">
                                <li>Found <strong>{outdatedCoursesCount} courses</strong> where the stored name is outdated and needs syncing with the current ID.</li>
                                <li>Found <strong>{Object.keys(autoMappings).length}</strong> historical names missing an ID that can be auto-linked.</li>
                            </ul>
                        </div>

                        {unmatchedList.length > 0 ? (
                            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mt-4 max-h-96 overflow-y-auto">
                                <h4 className="font-bold text-yellow-800 mb-2">Unmatched Names (Manual Mapping Required)</h4>
                                <p className="text-sm text-yellow-700 mb-4">Because spelling or spacing differs (e.g., "Alaeldein" vs "Alaeldin"), the system skipped these names to be safe. <strong>You must select the correct facilitator below for their dashboard scores to update.</strong></p>
                                
                                <div className="border border-yellow-300 rounded overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-yellow-100 text-yellow-800 border-b border-yellow-300">
                                            <tr>
                                                <th className="p-2 w-1/2">Historical Name (Old Course)</th>
                                                <th className="p-2 w-1/2">Map to Current Facilitator</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-yellow-200 bg-white">
                                            {unmatchedList.map(uName => (
                                                <tr key={uName} className="hover:bg-yellow-50">
                                                    <td className="p-2 font-medium text-gray-800">{uName}</td>
                                                    <td className="p-2">
                                                        <Select 
                                                            value={manualMappings[uName]?.id || ''} 
                                                            onChange={(e) => handleManualMapChange(uName, e.target.value)}
                                                            className="w-full py-1 text-sm border-yellow-300"
                                                        >
                                                            <option value="">-- Leave Unmapped --</option>
                                                            {allFacilitators.map(f => (
                                                                <option key={f.id} value={f.id}>{f.name} {f.arabicName ? `(${f.arabicName})` : ''}</option>
                                                            ))}
                                                        </Select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-green-800 font-medium">
                                <CheckCircle className="inline mr-2" />
                                All names found perfectly matched current facilitators!
                            </div>
                        )}
                    </div>
                )}
            </CardBody>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button variant="success" onClick={applyMigration} disabled={loading}>
                    Confirm & Sync All Records
                </Button>
            </CardFooter>
        </Modal>
    );
}
// --- END ADVANCED FACILITATOR ID MIGRATION MODAL ---


// Helper functions 
const IccmIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline><path d="M12 9v6"></path><path d="M9 12h6"></path></svg>;
const IpcIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 11v4"></path><path d="M10 13h4"></path></svg>;
const NewbornIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9c0-2-1.5-3.5-4-3.5C7.5 5.5 6 7 6 9c0 1.5.5 2.5 1 3.5h0l-1 4.5h10L17 17l-1-4.5h0c.5-1 1-2.5 1-3.5z"></path><path d="M12 18h.01"></path><path d="M10.5 21v-1.5h3V21"></path></svg>;


export const PublicParticipantRegistrationModal = ({ isOpen, onClose, course, onSuccess }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [group, setGroup] = useState('Group A');
    const isFederal = useMemo(() => isFederalCourse(course), [course]);

    const courseStates = useMemo(
        () => course?.states || (course?.state ? String(course.state).split(',').map(s => s.trim()).filter(Boolean) : []),
        [course]
    );
    const courseLocalities = useMemo(
        () => course?.localities || (course?.locality ? String(course.locality).split(',').map(l => l.trim()).filter(Boolean) : []),
        [course]
    );

    // Federal course => every state is selectable. Otherwise only the course's own state(s).
    const stateOptions = useMemo(
        () => (isFederal ? getAllStateOptions() : courseStates.filter(s => !isFederalValue(s))),
        [isFederal, courseStates]
    );

    const [regState, setRegState] = useState((!isFederal && courseStates.length === 1 && !isFederalValue(courseStates[0])) ? courseStates[0] : '');
    const [regLocality, setRegLocality] = useState((!isFederal && courseLocalities.length === 1 && !isFederalValue(courseLocalities[0])) ? courseLocalities[0] : '');

    const localityOptions = useMemo(() => {
        if (!regState) return [];
        const all = getLocalityOptionsForState(regState);
        if (isFederal) return all;
        return all.filter(l => courseLocalities.includes(l.en) || courseLocalities.includes(l.ar));
    }, [regState, isFederal, courseLocalities]);

    const [facilityId, setFacilityId] = useState('');
    const [facilityName, setFacilityName] = useState(''); 
    
    const [facilities, setFacilities] = useState([]);
    const [selectedFacility, setSelectedFacility] = useState(null);
    const [loadingFacilities, setLoadingFacilities] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [isFacilitySelectorOpen, setIsFacilitySelectorOpen] = useState(false);

    const jobOptions = useMemo(() => {
        if (course.course_type === 'ETAT') return JOB_TITLES_ETAT;
        if (course.course_type === 'EmONC') return JOB_TITLES_EMONC;
        if (course.course_type === 'Small & Sick Newborn' || course.course_type === 'SSNC') return JOB_TITLES_SSNC;
        if (course.course_type === 'ICCM' || course.course_type === 'Comprehensive Package For Community Midwives') 
            return ["قابلة مجتمع", "زائرة صحية", "طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
        return ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون", "أخرى"]; 
    }, [course.course_type]);

    useEffect(() => {
        if (regState && regLocality && isOpen) {
            setLoadingFacilities(true);
            listHealthFacilities({ state: regState, locality: regLocality }, 'server')
                .then(data => setFacilities(data))
                .catch(err => console.error("Failed to load facilities", err))
                .finally(() => setLoadingFacilities(false));
        } else {
            setFacilities([]);
        }
    }, [regState, regLocality, isOpen]);

    const handleSave = async () => {
        setError('');
        if (!name.trim()) return setError('Name is required');
        if (!phone.trim()) return setError('Phone is required');
        if (!jobTitle) return setError('Job Title is required');
        if (!regState) return setError('State is required');
        if (!regLocality) return setError('Locality is required');
        if (!facilityId) return setError('Please select a valid Facility from the list'); 

        setIsSaving(true);
        try {
            const participantData = {
                name: name.trim(),
                phone: phone.trim(),
                job_title: jobTitle,
                group: group,
                state: regState,
                locality: regLocality,
                center_name: facilityName, 
                courseId: course.id,
                facilityId: facilityId 
            };

            const isImnci = course.course_type === 'IMNCI';
            const isEenc = course.course_type === 'EENC';
            const isEtat = course.course_type === 'ETAT';
            const isSsnc = course.course_type === 'SSNC' || course.course_type === 'Small & Sick Newborn';
            const isIpc = course.course_type === 'IPC';

            let facilityUpdatePayload = null;

            if ((isImnci || isEenc || isEtat || isSsnc || isIpc) && selectedFacility && !selectedFacility.id.startsWith('pending_')) {
                const staffField = isEtat ? 'critical_staff' 
                                 : (isSsnc || isIpc) ? 'neonatal_staff' 
                                 : isEenc ? 'eenc_staff' 
                                 : 'imnci_staff';

                const staffMemberData = { 
                    name: name.trim(), 
                    job_title: jobTitle, 
                    phone: phone.trim(), 
                    is_trained: 'Yes', 
                    training_date: course.start_date || '' 
                };
                
                let existingStaff = [];
                try {
                    existingStaff = selectedFacility[staffField] ? (typeof selectedFacility[staffField] === 'string' ? JSON.parse(selectedFacility[staffField]) : JSON.parse(JSON.stringify(selectedFacility[staffField]))) : [];
                    if (!Array.isArray(existingStaff)) existingStaff = [];
                } catch (e) { existingStaff = []; }

                let updatedStaffList = [...existingStaff];
                const existingIndex = updatedStaffList.findIndex(staff => staff.name === staffMemberData.name || (staff.phone && staff.phone === staffMemberData.phone));
                
                if (existingIndex > -1) updatedStaffList[existingIndex] = staffMemberData; 
                else updatedStaffList.push(staffMemberData);

                const baseFacilityPayload = isImnci ? {
                    'هل_المؤسسة_تعمل': 'Yes', 
                    'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes'
                } : {};

                facilityUpdatePayload = { 
                    ...selectedFacility, 
                    ...baseFacilityPayload, 
                    id: selectedFacility.id, 
                    date_of_visit: new Date().toISOString().split('T')[0], 
                    [staffField]: updatedStaffList 
                };
            }

            await saveParticipantAndSubmitFacilityUpdate(participantData, facilityUpdatePayload, 'Public Form');
            
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
        setFacilityName(fac['اسم_المؤسسة'] || '');
        setSelectedFacility(fac); 
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

                    <FormGroup label="State">
                        <Select
                            disabled={isSaving || (!isFederal && stateOptions.length <= 1)}
                            value={regState}
                            onChange={e => {
                                setRegState(e.target.value);
                                setRegLocality('');
                                setFacilityName('');
                                setFacilityId('');
                                setSelectedFacility(null);
                            }}
                        >
                            <option value="">-- Select State --</option>
                            {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </FormGroup>

                    <FormGroup label="Locality">
                        <Select
                            disabled={isSaving || !regState}
                            value={regLocality}
                            onChange={e => {
                                setRegLocality(e.target.value);
                                setFacilityName('');
                                setFacilityId('');
                                setSelectedFacility(null);
                            }}
                        >
                            <option value="">-- Select Locality --</option>
                            {localityOptions.map(l => <option key={l.en} value={l.en}>{l.en}</option>)}
                        </Select>
                    </FormGroup>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Health Facility (in {regLocality || '\u2014'})
                        </label>
                        
                        <div className="relative">
                            <Input 
                                value={facilityName} 
                                onChange={(e) => {
                                    setFacilityName(e.target.value);
                                    setFacilityId(''); 
                                    setSelectedFacility(null);
                                    setIsFacilitySelectorOpen(true);
                                }}
                                onFocus={() => setIsFacilitySelectorOpen(true)}
                                placeholder="Search facility name..."
                                disabled={loadingFacilities || isSaving || !regLocality}
                            />
                            {loadingFacilities && <div className="absolute right-3 top-2.5"><Spinner size="sm" /></div>}
                            
                            {isFacilitySelectorOpen && !isSaving && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {facilities.length > 0 ? (
                                        facilities
                                            .filter(f => (f['اسم_المؤسسة'] || '').toLowerCase().includes(facilityName.toLowerCase()))
                                            .map(f => (
                                                <div 
                                                    key={f.id} 
                                                    className="p-2 cursor-pointer hover:bg-gray-100"
                                                    onClick={() => handleFacilitySelect(f)}
                                                >
                                                    {f['اسم_المؤسسة']}
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
        { key: 'Comprehensive Package For Community Midwives', title: 'Comprehensive Package For Community Midwives', enabled: true },
        { key: 'ETAT', title: 'Emergency Triage, Assessment & Treatment (ETAT)', enabled: true },
        { key: 'EmONC', title: 'Emergency Obstetric and Newborn Care (EmONC)', enabled: true },
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
                             it.key === 'Comprehensive Package For Community Midwives' ? <Users className="w-10 h-10 text-slate-500 flex-shrink-0" /> :
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


// --- QR Code Share Modal ---
function QRShareModal({ isOpen, onClose, url, title }) {
    const qrCanvasRef = useRef(null);

    const handleCopyLink = async () => {
        try { await navigator.clipboard.writeText(url); alert('Link copied to clipboard!'); }
        catch { alert('Failed to copy link.'); }
    };

    const handleOpenLink = () => { window.open(url, '_blank'); };

    const handleShareLink = async () => {
        if (navigator.share) {
            try { await navigator.share({ title: title || 'Shared Link', url }); }
            catch (e) { if (e.name !== 'AbortError') handleCopyLink(); }
        } else { handleCopyLink(); }
    };

    const handleShareQR = async () => {
        try {
            const canvas = qrCanvasRef.current?.querySelector('canvas');
            if (!canvas) return;
            // Create a new canvas with padding and title
            const outCanvas = document.createElement('canvas');
            const padding = 32;
            outCanvas.width = canvas.width + padding * 2;
            outCanvas.height = canvas.height + padding * 2 + 40;
            const ctx = outCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
            ctx.drawImage(canvas, padding, padding);
            ctx.fillStyle = '#374151';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            const label = title || 'Scan to open';
            ctx.fillText(label.length > 45 ? label.slice(0, 45) + '…' : label, outCanvas.width / 2, canvas.height + padding + 28);

            const dataUrl = outCanvas.toDataURL('image/png');
            if (navigator.share && navigator.canShare) {
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                const file = new File([blob], 'qr-code.png', { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: title || 'QR Code' });
                    return;
                }
            }
            // Fallback: download
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'qr-code.png';
            a.click();
        } catch (e) {
            console.error('QR share error:', e);
        }
    };

    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || 'Share Link'}>
            <CardBody className="flex flex-col items-center gap-5 p-6">
                <div ref={qrCanvasRef} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
                    <QRCodeCanvas value={url || ' '} size={220} level="L" includeMargin={false} />
                </div>
                <p className="text-xs text-gray-400 text-center break-all max-w-[280px] select-all leading-relaxed">{url}</p>
                
                <div className="w-full flex flex-col gap-2.5 pt-2">
                    <button
                        onClick={handleOpenLink}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                    >
                        <ExternalLink size={16} /> Open Link
                    </button>
                    <button
                        onClick={handleShareLink}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    >
                        <Send size={16} /> Share Link
                    </button>
                    <button
                        onClick={handleShareQR}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
                    >
                        <QrCode size={16} /> Share QR Code
                    </button>
                </div>
            </CardBody>
        </Modal>
    );
}

// --- Why the mentorship tab did not open -----------------------------------
//
// A course that runs a mentorship sub-course but falls through to the ordinary
// observation grid used to do so silently, and the only way to find out why was
// debugMentorshipDetection in the browser console. There are exactly two places
// the chain can break, and this says which one it was.
//
// Renders nothing on a course with no mentorship sub-course at all, which is the
// normal case.
function MentorshipDetectionNotice({ course, participant }) {
    const courseSubTypes = getCourseSubTypes(course);
    const mentorshipOnCourse = courseSubTypes.find(isMentorshipSubCourse);
    if (!mentorshipOnCourse) return null;

    const resolvedForParticipant = getMentorshipSubType(course, participant);
    const service = getCourseMentorshipService(course, participant);
    if (service) return null;

    // Break 1: the course runs it, but this participant is assigned elsewhere.
    // getMentorshipSubType returns null when the participant carries a
    // sub-course this course actually runs, which it reads as a deliberate
    // assignment to a non-mentorship group.
    const reason = !resolvedForParticipant
        ? `This course runs "${mentorshipOnCourse}", but ${participant?.name || 'this participant'} is recorded under "${participant?.imci_sub_type}", which is one of the sub-courses this course also runs. That is read as a deliberate assignment to the non-mentorship group. Change the participant's sub-course to "${mentorshipOnCourse}" to open the mentorship form.`
        // Break 2: it resolved, but the service has no form behind it.
        : `"${resolvedForParticipant}" resolved, but no mentorship form is enabled for it. For ETAT this is the ETAT_MENTORSHIP_FORM_ENABLED flag at the end of constants.js.`;

    return (
        <Card className="mb-3">
            <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
                <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <h4 className="font-semibold text-amber-900">Showing the standard monitoring grid</h4>
                        <p className="text-sm text-amber-800 mt-1 leading-relaxed">{reason}</p>
                        <p className="text-xs text-amber-700 mt-2">
                            Sub-courses recorded on this course: {courseSubTypes.join(', ') || 'none'}.
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
}

const formatLocation = (locationStr) => {
    if (!locationStr) return 'N/A';
    const parts = String(locationStr).split(',').map(s => s.trim()).filter(Boolean);
    return parts.length > 1 ? `${parts[0]}, etc.` : parts[0] || 'N/A';
};

export function CoursesTable({ 
    courses, onOpen, onEdit, onDelete, onOpenReport, onOpenTestForm, 
    canEditDeleteActiveCourse, canEditDeleteInactiveCourse, userStates, userLocalities, onAddFinalReport, canManageFinalReport,
    onOpenAttendanceManager, isProcessing 
}) {
    const [shareModalCourse, setShareModalCourse] = useState(null);
    const [qrShareData, setQrShareData] = useState(null);
    const [reportModalCourse, setReportModalCourse] = useState(null);
     
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [expandedId, setExpandedId] = useState(null);
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
        if (course.approvalStatus === 'rejected') return false;
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
            
            const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
            const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
            return dateB - dateA;
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
            <div className="hidden md:block overflow-hidden bg-white border border-slate-300 rounded-xl shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 whitespace-nowrap">
                            <th className="p-3 font-semibold border-b border-slate-300 w-1/3">Location & Subcourses</th>
                            <th className="p-3 font-semibold border-b border-slate-300 w-1/6">Status</th>
                            <th className="p-3 font-semibold border-b border-slate-300 hidden lg:table-cell w-1/4">Activity</th>
                            <th className="p-3 font-semibold border-b border-slate-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedCourses.map((c) => {
                            const isPendingDeletion = c.deletionRequested === true;
                            const active = isCourseActive(c);
                            const canEdit = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                            const canDelete = active ? canEditDeleteActiveCourse : canEditDeleteInactiveCourse;
                            
                            const subcourses = c.facilitatorAssignments && c.facilitatorAssignments.length > 0
                                ? [...new Set(c.facilitatorAssignments.map(a => a.imci_sub_type))].join(', ')
                                : 'N/A';

                            const createdDate = c.createdAt?.toDate 
                                ? c.createdAt.toDate().toLocaleDateString() 
                                : c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

                            return (
                                <tr key={c.id} className={`hover:bg-blue-50/50 transition-colors group ${isPendingDeletion ? 'bg-red-50' : ''}`}>
                                    <td className="p-3 align-middle border-b border-slate-200">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 text-[13px] whitespace-nowrap">
                                                    {formatLocation(c.state)} - {formatLocation(c.locality)}
                                                </span>
                                                {isPendingDeletion && <span className="text-[10px] text-red-600 font-bold whitespace-nowrap">(Deleting)</span>}
                                            </div>
                                            <span className="text-[11px] font-medium text-slate-500 truncate max-w-[250px]" title={subcourses}>
                                                {subcourses}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="p-3 align-middle border-b border-slate-200">
                                        {c.approvalStatus === 'pending' ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-yellow-100 text-yellow-800 border border-yellow-200">Pending</span>
                                        ) : c.approvalStatus === 'rejected' ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">Rejected</span>
                                        ) : active ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-200">Active</span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-200">Inactive</span>
                                        )}
                                    </td>
                                    
                                    <td className="p-3 align-middle border-b border-slate-200 hidden lg:table-cell text-[11px] text-gray-500 whitespace-nowrap">
                                        <div>{createdDate}</div>
                                        <div className="truncate max-w-[120px]" title={c.createdBy || 'Legacy Data'}>
                                            By: {c.createdBy || 'Legacy Data'}
                                        </div>
                                    </td>

                                    <td className="p-3 align-middle border-b border-slate-200 text-right">
                                        <div className="flex flex-nowrap gap-1.5 justify-end opacity-95 group-hover:opacity-100 transition-opacity">
                                            <Button variant="primary" className="px-2.5 py-1 text-[11px] flex items-center gap-1" onClick={() => onOpen(c.id)} disabled={isProcessing}>
                                                <ExternalLink size={12} /> Open
                                            </Button>
                                            <Button variant="secondary" className="px-2.5 py-1 text-[11px] flex items-center gap-1" onClick={() => setReportModalCourse(c)} disabled={isProcessing}>
                                                <FileText size={12} /> Reports
                                            </Button>
                                            <Button variant="secondary" className="px-2.5 py-1 text-[11px] flex items-center gap-1" onClick={() => setShareModalCourse(c)} disabled={isProcessing}>
                                                <Share2 size={12} /> Share
                                            </Button>
                                            <Button variant="secondary" className="px-2.5 py-1 text-[11px] text-gray-600 flex items-center gap-1" onClick={() => onEdit(c)} disabled={!canEdit || isPendingDeletion || isProcessing}>
                                                <Edit size={12} /> Edit
                                            </Button>
                                            <Button variant="danger" className="px-2.5 py-1 text-[11px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-transparent flex items-center gap-1" onClick={() => { if(window.confirm(`Are you sure you want to delete ${c.course_type} (${c.state})? It will be moved to Deleted Courses.`)) onDelete(c.id); }} disabled={!canDelete || isPendingDeletion || isProcessing}>
                                                <Trash2 size={12} /> Delete
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
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
                            <div 
                                className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                                onClick={() => toggleExpand(c.id)}
                            >
                                <div>
                                    <h4 className="font-bold text-lg text-gray-800">
                                        {formatLocation(c.state)} - {formatLocation(c.locality)}
                                    </h4>
                                    <p className="text-sm text-gray-600 line-clamp-1">{subcourses}</p>
                                    <div className="mt-2 flex gap-2 items-center flex-wrap">
                                        {c.approvalStatus === 'pending' ? (
                                            <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">Pending</span>
                                        ) : c.approvalStatus === 'rejected' ? (
                                            <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-red-100 text-red-800">Rejected</span>
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

            {shareModalCourse && (
                <>
                {/* The link popup replaces this list rather than stacking on top of
                    it: two modals deep, the QR sat over a scrollable sheet of
                    other links and the phone had no clear way back. */}
                <Modal isOpen={!qrShareData} onClose={() => setShareModalCourse(null)} title="Share Public Links">
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
                                            setQrShareData({ url: link, title: `Registration: ${shareModalCourse.course_type}` });
                                        }}><QrCode size={14} /> Share</Button>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded border">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-semibold">Course Monitoring</span>
                                        <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => {
                                            const link = `${getBaseUrl()}/monitor/course/${shareModalCourse.id}`;
                                            setQrShareData({ url: link, title: `Monitoring: ${shareModalCourse.course_type}` });
                                        }}><Eye size={14} /> Share</Button>
                                    </div>
                                </div>

                                {shareModalCourse.course_type === 'IMNCI' &&
                                 shareModalCourse.facilitatorAssignments?.some(a => a.imci_sub_type === 'online IMCI course') && (
                                    <div className="bg-gray-50 p-3 rounded border">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-semibold">Online Training Exercises</span>
                                            <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => {
                                                const link = `${getBaseUrl()}/public/exercises/course/${shareModalCourse.id}`;
                                                setQrShareData({ url: link, title: `Exercises: ${shareModalCourse.course_type}` });
                                            }}><QrCode size={14} /> Share</Button>
                                        </div>
                                    </div>
                                )}
                                
                                {(['ICCM', 'EENC', 'EmONC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management', 'Comprehensive Package For Community Midwives'].includes(shareModalCourse.course_type)) && (
                                    <div className="bg-gray-50 p-3 rounded border">
                                        <span className="text-sm font-semibold block mb-2">Testing</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="secondary" size="sm" className="flex items-center gap-1 justify-center" onClick={() => {
                                                const link = `${getBaseUrl()}/public/test/course/${shareModalCourse.id}?type=pre`;
                                                setQrShareData({ url: link, title: `Pre-Test: ${shareModalCourse.course_type}` });
                                            }}><FileText size={14} /> Share Pre-Test</Button>

                                            <Button variant="secondary" size="sm" className="flex items-center gap-1 justify-center" onClick={() => {
                                                const link = `${getBaseUrl()}/public/test/course/${shareModalCourse.id}?type=post`;
                                                setQrShareData({ url: link, title: `Post-Test: ${shareModalCourse.course_type}` });
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
                                                setQrShareData({ url: link, title: `Attendance: ${shareModalCourse.course_type} - ${attendanceDate}` });
                                            }}
                                        >
                                            <QrCode size={14} /> Share
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
                
                <QRShareModal
                    isOpen={!!qrShareData}
                    onClose={() => setQrShareData(null)}
                    url={qrShareData?.url || ''}
                    title={qrShareData?.title || ''}
                />
                </>
            )}

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

                        {(['ICCM', 'EENC', 'EmONC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management', 'Comprehensive Package For Community Midwives'].includes(reportModalCourse.course_type)) && (
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
        </div>
    );
}

export { PublicAttendanceView, AttendanceManagerView } from './CourseAttendanceView';

function DeletedCoursesView({ courses, onRestore, onPermanentDelete, isProcessing }) {
    const sortedDeletedCourses = useMemo(() => {
        return [...courses].sort((a, b) => {
            const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
            const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
            return dateB - dateA;
        });
    }, [courses]);

    if (sortedDeletedCourses.length === 0) {
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

            <div className="overflow-hidden bg-white border border-slate-300 rounded-xl shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 whitespace-nowrap">
                            <th className="p-3 font-semibold border-b border-slate-300 w-1/4">Course Type</th>
                            <th className="p-3 font-semibold border-b border-slate-300 w-1/3">Location & Start Date</th>
                            <th className="p-3 font-semibold border-b border-slate-300 hidden lg:table-cell w-1/4">Activity</th>
                            <th className="p-3 font-semibold border-b border-slate-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDeletedCourses.map(c => {
                            const createdDate = c.createdAt?.toDate 
                                ? c.createdAt.toDate().toLocaleDateString() 
                                : c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
                            
                            return (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors opacity-75 group">
                                    <td className="p-3 align-middle border-b border-slate-200">
                                        <div className="font-bold text-gray-900 text-[13px] whitespace-nowrap">{c.course_type}</div>
                                        {c.approvalStatus === 'rejected' && (
                                            <span className="inline-flex mt-1 items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">Rejected</span>
                                        )}
                                    </td>
                                    
                                    <td className="p-3 align-middle border-b border-slate-200">
                                        <div className="font-semibold text-gray-800 whitespace-nowrap">
                                            {formatLocation(c.state)} - {formatLocation(c.locality)}
                                        </div>
                                        <div className="text-[11px] text-gray-500 whitespace-nowrap">Started: {c.start_date}</div>
                                    </td>
                                    
                                    <td className="p-3 align-middle border-b border-slate-200 hidden lg:table-cell text-[11px] text-gray-500 whitespace-nowrap">
                                        <div>{createdDate}</div>
                                        <div className="truncate max-w-[120px]" title={c.createdBy || 'Legacy Data'}>
                                            By: {c.createdBy || 'Legacy Data'}
                                        </div>
                                    </td>

                                    <td className="p-3 align-middle border-b border-slate-200 text-right">
                                        <div className="flex flex-nowrap gap-1.5 justify-end opacity-95 group-hover:opacity-100 transition-opacity">
                                            <Button variant="secondary" className="px-2.5 py-1 text-[11px] flex items-center gap-1" onClick={() => onRestore(c)} disabled={isProcessing}>
                                                <RefreshCw size={12} /> Restore
                                            </Button>
                                            <Button variant="danger" className="px-2.5 py-1 text-[11px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-transparent flex items-center gap-1" onClick={() => onPermanentDelete(c.id)} disabled={isProcessing}>
                                                <X size={12} /> Delete Forever
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function CourseApprovalsView({ courses, onApproveCourse, onRejectCourse, isProcessing }) {
    const pendingApprovalCourses = useMemo(() => {
        return courses.filter(c => c.approvalStatus === 'pending' && !c.deletionRequested && !c.inRecycleBin)
            .sort((a, b) => {
                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                return dateB - dateA;
            });
    }, [courses]);

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
                
                <div className="overflow-hidden bg-white border border-slate-300 rounded-xl shadow-sm">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 whitespace-nowrap">
                                <th className="p-3 font-semibold border-b border-slate-300 w-1/4">Course Type</th>
                                <th className="p-3 font-semibold border-b border-slate-300 w-1/3">Location & Start Date</th>
                                <th className="p-3 font-semibold border-b border-slate-300 hidden lg:table-cell w-1/4">Coordinator</th>
                                <th className="p-3 font-semibold border-b border-slate-300 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingApprovalCourses.map(c => (
                                <tr key={c.id} className="hover:bg-yellow-50/30 transition-colors group">
                                    <td className="p-3 align-middle border-b border-slate-200">
                                        <div className="font-bold text-gray-900 text-[13px] whitespace-nowrap">{c.course_type}</div>
                                    </td>
                                    
                                    <td className="p-3 align-middle border-b border-slate-200">
                                        <div className="font-semibold text-gray-800 whitespace-nowrap">
                                            {formatLocation(c.state)} - {formatLocation(c.locality)}
                                        </div>
                                        <div className="text-[11px] text-gray-500 whitespace-nowrap">Started: {c.start_date}</div>
                                    </td>
                                    
                                    <td className="p-3 align-middle border-b border-slate-200 hidden lg:table-cell text-[11px] text-gray-500 whitespace-nowrap">
                                        <div className="truncate max-w-[150px]" title={c.coordinator || 'N/A'}>{c.coordinator || 'N/A'}</div>
                                    </td>

                                    <td className="p-3 align-middle border-b border-slate-200 text-right">
                                        <div className="flex flex-nowrap gap-1.5 justify-end opacity-95 group-hover:opacity-100 transition-opacity">
                                            <Button variant="primary" className="px-2.5 py-1 text-[11px] bg-green-600 hover:bg-green-700 flex items-center gap-1" onClick={() => onApproveCourse(c.id)} disabled={isProcessing}>
                                                <Check size={12} /> Approve
                                            </Button>
                                            <Button variant="danger" className="px-2.5 py-1 text-[11px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-transparent flex items-center gap-1" onClick={() => onRejectCourse(c.id)} disabled={isProcessing}>
                                                <X size={12} /> Reject
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

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
    onOpenAttendanceManager,
    currentUserRole 
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

    const { user } = useAuth();
    const currentUserIdentifier = user?.displayName || user?.email || 'Unknown';
const [emoncModule, setEmoncModule] = useState('maternal');

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });

    // State for the new Migration Modal
    const [showMigrationModal, setShowMigrationModal] = useState(false);

    // Advanced actions: runtime sub-course catalogue + course-to-course copy.
    const [showCopyCourseModal, setShowCopyCourseModal] = useState(false);
    const [showSubCourseManager, setShowSubCourseManager] = useState(false);
    const {
        customSubCourses,
        fetchCustomSubCourses,
        addCustomSubCourse,
        deleteCustomSubCourse,
    } = useCustomSubCourses();

    const canManageSubCourses = canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures;
    const canCopyCourseData = canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures;

    // Copies the ticked field groups from one course onto each target, then
    // refreshes so the table reflects the new values.
    const handleCopyCourseData = async ({ source, targetIds, groups }) => {
        setIsProcessing(true);
        let succeeded = 0;
        const failures = [];

        try {
            for (const targetId of targetIds) {
                const target = allCourses.find(c => c.id === targetId);
                if (!target) { failures.push(targetId); continue; }

                // Start from the target so anything not ticked survives intact.
                const payload = { ...target };
                let baselineInvalidated = false;

                groups.forEach(group => {
                    group.fields.forEach(field => {
                        // `undefined` is not writable in Firestore, and a missing
                        // field on the source should clear the target rather than
                        // throw, so it is normalised to null.
                        const value = source[field];
                        payload[field] = value === undefined ? null : value;
                    });
                    if (group.invalidatesBaseline) baselineInvalidated = true;
                });

                if (baselineInvalidated) {
                    payload.coverageSnapshot = null;
                    payload.baselineLockedAt = null;
                }

                // Never carried across, whatever is ticked.
                payload.id = target.id;
                payload.course_type = target.course_type;
                payload.approvalStatus = target.approvalStatus;
                payload.lastCopiedFrom = source.id;
                payload.lastCopiedAt = new Date().toISOString();
                payload.lastCopiedBy = currentUserIdentifier;

                try {
                    await upsertCourse(payload);
                    succeeded++;
                } catch (e) {
                    console.error(`Copy to course ${targetId} failed:`, e);
                    failures.push(target.hall || targetId);
                }
            }

            await fetchCourses(true);

            if (failures.length === 0) {
                setToast({ show: true, message: `تم نسخ البيانات إلى ${succeeded} دورة.`, type: 'success' });
            } else {
                setToast({
                    show: true,
                    message: `تم النسخ إلى ${succeeded} دورة، وفشل ${failures.length}: ${failures.join('، ')}`,
                    type: 'warning',
                });
            }
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        fetchFederalCoordinators();
        fetchStateCoordinators();
        fetchLocalityCoordinators();
        fetchFunders();
        fetchParticipants(true); 
    }, [fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators, fetchFunders, fetchParticipants]); 

    useEffect(() => {
        if (['courses', 'dashboard', 'participants'].includes(activeCoursesTab)) {
            fetchCourses(true);
            fetchParticipants(true);
        }
    }, [activeCoursesTab, fetchCourses, fetchParticipants]);

    useEffect(() => {
        if (activeCoursesTab === 'dashboard' && (!healthFacilities || healthFacilities.length === 0)) {
            fetchHealthFacilities();
        }
    }, [activeCoursesTab, healthFacilities, fetchHealthFacilities]);

    const currentParticipant = participants.find(p => p.id === selectedParticipantId);
    const [courseToEdit, setCourseToEdit] = useState(null);

    const coursesForActiveType = useMemo(() => {
        if (!activeCourseType) return [];
        if (activeCourseType === 'EmONC') {
            return allCourses.filter(c => c.course_type === 'EmONC' || c.course_type === 'EENC');
        }
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

    // Reads every field a sub-course can live on, not just the facilitator
    // assignments — an ETAT course now also records one against the director and
    // clinical instructor, and those were previously invisible to this filter.
    const filterSubCourseOptions = useMemo(() => {
        const subCourses = new Set();
        coursesForActiveType.forEach(c => {
            getCourseSubTypes(c).forEach(t => subCourses.add(t));
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
            
            if (manageLocation === 'user_state' || manageLocation === 'user_locality') {
                if (!userStates || userStates.length === 0 || !userStates.includes(c.state)) return false;
            }
            if (manageLocation === 'user_locality') {
                if (!userLocalities || userLocalities.length === 0 || !userLocalities.includes(c.locality)) return false;
            }

            const stateMatch = filterState === 'All' || c.state === filterState;
            const localityMatch = filterLocality === 'All' || c.locality === filterLocality;
            const subCourseMatch = filterSubCourse === 'All' ||
                getCourseSubTypes(c).includes(filterSubCourse);
            const projectMatch = filterProject === 'All' || c.course_project === filterProject;

            return stateMatch && localityMatch && subCourseMatch && projectMatch;
        });
    }, [coursesForActiveType, filterState, filterLocality, filterSubCourse, filterProject, userStates, userLocalities, manageLocation]);

    const dashboardCourses = useMemo(() => {
        return (allCourses || []).filter(c => {
            if (c.inRecycleBin || c.isDeleted === true || c.isDeleted === "true") return false;
            
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
            totalEmoncCourses: dashboardCourses.filter(c => c.course_type === 'EmONC').length 
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

    const isCourseActive = useMemo(() => {
        if (selectedCourse?.approvalStatus === 'pending') return false; 
        if (selectedCourse?.approvalStatus === 'rejected') return false;
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

    // Certificate management inside a course is restricted to super users, and to
    // federal managers only when they ALSO hold super-user rights. Note this is
    // deliberately stricter than `canManageCertificates` elsewhere in the app,
    // which lets any federal manager through: approving certificates and editing
    // the printed template is a signing authority, not a reporting convenience.
    const canManageCourseCertificates =
        canUseSuperUserAdvancedFeatures ||
        (canUseFederalManagerAdvancedFeatures && currentUserRole === 'super_user');

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
            const payload = { ...courseData };
            
            if (!payload.id) {
                if (currentUserRole) {
                    payload.creatorRole = currentUserRole;
                }
                const roleToCheck = currentUserRole || '';
                if (['super_user', 'federal_manager', 'federal_coordinator'].includes(roleToCheck)) {
                    payload.approvalStatus = 'approved';
                }
            }

            const editingExisting = !!payload.id;
            let needsBaselineCalculation = false;

            if (payload.course_type === 'IMNCI') {
                if (!editingExisting && !payload.coverageSnapshot) {
                    needsBaselineCalculation = true;
                } else if (editingExisting && courseToEdit) {
                    const oldStatesStr = JSON.stringify([...(courseToEdit.states || [])].sort());
                    const newStatesStr = JSON.stringify([...(payload.states || [])].sort());
                    const oldLocsStr = JSON.stringify([...(courseToEdit.localities || [])].sort());
                    const newLocsStr = JSON.stringify([...(payload.localities || [])].sort());

                    if (oldStatesStr !== newStatesStr || oldLocsStr !== newLocsStr) {
                        needsBaselineCalculation = true;
                    } else if (!payload.coverageSnapshot) {
                        needsBaselineCalculation = true;
                    }
                }
            }

            if (needsBaselineCalculation && healthFacilities) {
                const calculateBaseline = (facilitiesFilter, levelName) => {
                    const phcFacilities = healthFacilities
                        .filter(facilitiesFilter)
                        .filter(f => f['هل_المؤسسة_تعمل'] === 'Yes')
                        .filter(f => ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية']));

                    const totalPhc = phcFacilities.length;
                    let currentImnciPhcs = 0;
                    phcFacilities.forEach(f => {
                        if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') currentImnciPhcs++;
                    });
                    const covBefore = totalPhc > 0 ? (currentImnciPhcs / totalPhc) * 100 : 0;
                    
                    return {
                        name: levelName,
                        totalPhc,
                        phcWithImnciBefore: currentImnciPhcs,
                        covBefore,
                        newPhc: 0,
                        covAfter: covBefore,
                        increase: 0
                    };
                };

                const stateCoverage = payload.states.map(s => calculateBaseline(f => f['الولاية'] === s, s));
                const localityCoverage = payload.localities.map(l => calculateBaseline(f => f['المحلية'] === l, l));

                payload.coverageSnapshot = {
                    totalBudget: Number(payload.course_budget) || 0,
                    costPerParticipant: 0,
                    costPerNewFacility: 0,
                    totalNewFacilities: 0,
                    newImciFacilitiesList: [],
                    stateCoverage,
                    localityCoverage,
                    baselineLockedAt: new Date().toISOString()
                };
            }

            await upsertCourse(payload, currentUserIdentifier);
            await fetchCourses(true); 
            
            if (navigator.onLine) {
                try {
                    const isUpdate = !!courseToEdit;
                    const submitterRole = currentUserRole ? currentUserRole.replace(/_/g, ' ') : 'User';
                    const submitterName = user?.displayName || user?.email || 'A user';
                    const actionText = isUpdate ? 'updated the' : 'added a new';
                    const notifTitle = isUpdate ? 'Course Updated' : 'New Course Added';
                    const notifBody = `${submitterName} (${submitterRole}) has ${actionText} ${payload.course_type} course in ${payload.state} - ${payload.locality}.`;

                    // 1. DISTINCT DB SAVE
                    await addDoc(collection(db, 'notifications'), {
                        title: notifTitle,
                        message: notifBody,
                        targetUser: 'managers_and_super_users',
                        createdAt: serverTimestamp(),
                        deliveredTo: [],
                        readBy: [],
                        deletedBy: [], 
                        status: 'active',
                        actionView: 'courses',
                        actionParams: JSON.stringify({ courseId: payload.id })
                    });

                    // 2. FIRE AND FORGET PUSH
                    const functions = getFunctions(db.app);
                    const sendFCMNotification = httpsCallable(functions, 'sendFCMNotification');
                    
                    sendFCMNotification({
                        targetUserId: 'managers_and_super_users',
                        title: notifTitle,
                        body: notifBody,
                        data: {
                            actionView: 'courses',
                            actionParams: JSON.stringify({ courseId: payload.id })
                        }
                    }).catch(e => console.warn("FCM Send Error:", e));
                    
                } catch (fcmError) {
                    console.warn("FCM Error", fcmError);
                }
            }

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
            await fetchCourses(true); 
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
                await fetchCourses(true); 
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
                await fetchCourses(true); 
                setToast({ show: true, message: 'Course approved successfully!', type: 'success' });
            } catch (error) {
                setToast({ show: true, message: `Approval failed: ${error.message}`, type: 'error' });
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleRejectCourse = async (courseId) => {
        if (window.confirm("Are you sure you want to reject this course? It will be moved to the Deleted Courses bin.")) {
            const courseToUpdate = allCourses.find(c => c.id === courseId);
            if (courseToUpdate) {
                setIsProcessing(true);
                try {
                    await upsertCourse({ ...courseToUpdate, approvalStatus: 'rejected', inRecycleBin: true }, currentUserIdentifier);
                    await fetchCourses(true); 
                    setToast({ show: true, message: 'Course rejected and moved to Deleted Courses.', type: 'info' });
                } catch (error) {
                    setToast({ show: true, message: `Rejection failed: ${error.message}`, type: 'error' });
                } finally {
                    setIsProcessing(false);
                }
            }
        }
    };

    const handleRejectDelete = async (course) => {
        setIsProcessing(true);
        try {
            await upsertCourse({ ...course, deletionRequested: false }, currentUserIdentifier);
            await fetchCourses(true); 
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
                await fetchCourses(true); 
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
        
        {/* --- DYNAMIC MONITORS BLOCK --- */}
        {selectedCourse.course_type === 'EmONC' ? (
            <>
                <Button disabled={isProcessing || !currentParticipant} variant="tab" isActive={activeCoursesTab === 'maternal-monitoring'} onClick={() => setActiveCoursesTab('maternal-monitoring')}>Maternal Monitor</Button>
                <Button disabled={isProcessing || !currentParticipant} variant="tab" isActive={activeCoursesTab === 'neonatal-monitoring'} onClick={() => setActiveCoursesTab('neonatal-monitoring')}>Neonatal Monitor</Button>
            </>
        ) : (
            <Button disabled={isProcessing || !currentParticipant} variant="tab" isActive={activeCoursesTab === 'monitoring'} onClick={() => setActiveCoursesTab('monitoring')}>
                {hasMentorshipForm(selectedCourse, currentParticipant) ? 'Mentorship Practice' : 'Monitoring'}
            </Button>
        )}
        
        <Button disabled={isProcessing} variant="tab" isActive={activeCoursesTab === 'reports'} onClick={() => setActiveCoursesTab('reports')}>Individual Participant Report</Button>
        {(['ICCM', 'EENC', 'EmONC', 'Small & Sick Newborn', 'IMNCI', 'ETAT', 'Program Management', 'Comprehensive Package For Community Midwives'].includes(selectedCourse.course_type)) && (
            <Button disabled={isProcessing} variant="tab" isActive={activeCoursesTab === 'enter-test-scores'} onClick={() => { setActiveCoursesTab('enter-test-scores'); }}>Test Scores</Button>
        )}

        {selectedCourse.course_type === 'IMNCI' && (
            selectedCourse.director_imci_sub_type === 'online IMCI course' ||
            selectedCourse.clinical_instructor_imci_sub_type === 'online IMCI course' ||
            selectedCourse.facilitatorAssignments?.some(a => a.imci_sub_type === 'online IMCI course')
        ) && (
            <Button disabled={isProcessing} variant="tab" isActive={activeCoursesTab === 'exercises'} onClick={() => { setActiveCoursesTab('exercises'); }}>Exercises</Button>
        )}

        {canManageCourseCertificates && (
            <Button
                disabled={isProcessing}
                variant="tab"
                isActive={activeCoursesTab === 'course-certificates'}
                onClick={() => { setActiveCoursesTab('course-certificates'); onSetSelectedParticipantId(null); }}
            >
                Certificates
                {selectedCourse.isCertificateApproved && (
                    <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Approved</span>
                )}
            </Button>
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
                                        
                                        {/* TRIGGER BUTTON FOR MIGRATION MODAL */}
                                        {canUseSuperUserAdvancedFeatures && (
                                            <Button variant="danger" onClick={() => setShowMigrationModal(true)}>
                                                Total Sync Tool
                                            </Button>
                                        )}

                                        {/* ADVANCED ACTIONS — federal managers and super users */}
                                        {canCopyCourseData && (
                                            <Button variant="secondary" disabled={isProcessing} onClick={() => setShowCopyCourseModal(true)}>
                                                <Copy size={14} className="mr-1" /> Copy Course Data
                                            </Button>
                                        )}

                                        {canManageSubCourses && (
                                            <Button variant="secondary" disabled={isProcessing} onClick={() => setShowSubCourseManager(true)}>
                                                <ClipboardList size={14} className="mr-1" /> Manage Sub-courses
                                            </Button>
                                        )}
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
                        onRejectCourse={handleRejectCourse}
                        isProcessing={isProcessing}
                    />
                )}

                {activeCoursesTab === 'certificate-approvals' && (
                    <CertificateApprovalsView 
                        allCourses={allCourses} 
                        setToast={setToast} 
                        currentUserRole={currentUserRole}
                        canUseFederalManagerAdvancedFeatures={canUseFederalManagerAdvancedFeatures}
                    />
                )}

                {/* Per-course certificate management. Scoped to just this course, so
                    the same approve / customise / designer tools work without leaving
                    the course. Guarded twice: the tab is hidden without permission and
                    the panel itself refuses to render, so a stale activeCoursesTab
                    value can't expose it. */}
                {activeCoursesTab === 'course-certificates' && selectedCourse && (
                    canManageCourseCertificates ? (
                        <CertificateApprovalsView
                            allCourses={[selectedCourse]}
                            setToast={setToast}
                            currentUserRole={currentUserRole}
                            canUseFederalManagerAdvancedFeatures={canUseFederalManagerAdvancedFeatures}
                            singleCourseMode
                            title={`Certificates — ${selectedCourse.course_type}`}
                        />
                    ) : (
                        <Card className="p-6 text-center text-sm text-gray-600">
                            You do not have permission to manage certificates for this course.
                        </Card>
                    )
                )}

                {activeCoursesTab === 'deleted-courses' && <DeletedCoursesView courses={allCourses.filter(c => c.inRecycleBin || c.deletionRequested)} onRestore={handleRestoreCourse} onPermanentDelete={handlePermanentDelete} isProcessing={isProcessing} />}
                
                {(activeCoursesTab === 'add-course' || activeCoursesTab === 'edit-course') && (
                    <CourseForm 
                        courseType={activeCourseType} 
                        initialData={courseToEdit} 
                        onCancel={handleCancelCourseForm} 
                        onSave={handleSaveCourseAndReturn} 
                        facilitatorsList={facilitatorsList} 
                        fundersList={funders || []} 
                        federalCoordinatorsList={federalCoordinators || []} 
                        stateCoordinatorsList={stateCoordinators || []} 
                        localityCoordinatorsList={localityCoordinators || []} 
                        userStates={userStates} 
                        userLocalities={userLocalities} 
                        canUseFederalManagerAdvancedFeatures={canUseFederalManagerAdvancedFeatures}
                        canUseSuperUserAdvancedFeatures={canUseSuperUserAdvancedFeatures}
                        customSubCourses={customSubCourses}
                        onAddSubCourse={canManageSubCourses ? addCustomSubCourse : undefined}
                        onDeleteSubCourse={canManageSubCourses ? deleteCustomSubCourse : undefined}
                        currentUserIdentifier={currentUserIdentifier}
                        currentUserRole={currentUserRole}
                    />
                )}

                {/* Copy data between two courses of the same package. */}
                {canCopyCourseData && (
                    <CopyCourseDataModal
                        isOpen={showCopyCourseModal}
                        onClose={() => setShowCopyCourseModal(false)}
                        allCourses={allCourses}
                        courseType={activeCourseType}
                        onCopy={handleCopyCourseData}
                        isProcessing={isProcessing}
                        currentUserIdentifier={currentUserIdentifier}
                    />
                )}

                {/* Standalone sub-course catalogue, reachable without opening a
                    course form. Same modal the '+' buttons inside the form open. */}
                {canManageSubCourses && (
                    <ManageSubCoursesModal
                        isOpen={showSubCourseManager}
                        onClose={() => { setShowSubCourseManager(false); fetchCustomSubCourses(); }}
                        courseType={activeCourseType}
                        customSubCourses={customSubCourses}
                        onAdd={(name) => addCustomSubCourse({
                            courseType: activeCourseType,
                            name,
                            createdBy: currentUserIdentifier,
                            createdByRole: currentUserRole,
                        })}
                        onDelete={deleteCustomSubCourse}
                        currentUserIdentifier={currentUserIdentifier}
                        currentUserRole={currentUserRole}
                    />
                )}
                
                {loadingDetails && (!globalTabs.includes(activeCoursesTab)) ? <div className="flex justify-center p-8"><Spinner /></div> : (
    <>
        {/* --- PARTICIPANTS TABLE --- */}
{['participants', 'participant-form', 'participant-migration'].includes(activeCoursesTab) && selectedCourse && (
    <ParticipantsView
        course={selectedCourse} 
        participants={participants} 
        onOpen={(id) => { 
            onSetSelectedParticipantId(id); 
            setActiveCoursesTab('monitoring'); // Fix: Force to monitoring tab
            setEmoncModule('maternal'); // Fix: Always start on Maternal to ensure state clears
        }}
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
        canUseSuperUserAdvancedFeatures={canUseSuperUserAdvancedFeatures}
    />
)}

{activeCoursesTab === 'participants' && !selectedCourse && activeCoursesTab !== 'courses' && <EmptyState message="Please select a course from the 'Courses' tab to view participants." />}

{/* --- SPLIT SCREEN MONITORS VIEW OR STANDALONE --- */}
{activeCoursesTab === 'monitoring' && selectedCourse && currentParticipant && (
    <Suspense fallback={<Spinner />}>
        {selectedCourse.course_type === 'EmONC' ? (
            emoncModule === 'maternal' ? (
                <MaternalEmergencyMonitoring 
                    course={selectedCourse} 
                    participant={currentParticipant} 
                    participants={participants}
                    onChangeParticipant={(id) => onSetSelectedParticipantId(id)}
                    onCancel={() => setActiveCoursesTab('participants')} 
                    switchModule={(mod) => setEmoncModule(mod)} 
                />
            ) : (
                <NeonatalEmergencyMonitoring 
                    course={selectedCourse} 
                    participant={currentParticipant} 
                    participants={participants}
                    onChangeParticipant={(id) => onSetSelectedParticipantId(id)}
                    onCancel={() => setActiveCoursesTab('participants')} 
                    switchModule={(mod) => setEmoncModule(mod)} 
                />
            )
        ) : hasMentorshipForm(selectedCourse, currentParticipant) ? (
            <MentorshipMonitoringView
                course={selectedCourse}
                participant={currentParticipant}
                participants={participants}
                onChangeParticipant={(id) => onSetSelectedParticipantId(id)}
            />
        ) : (
            <>
                <MentorshipDetectionNotice course={selectedCourse} participant={currentParticipant} />
                <ObservationView 
                    course={selectedCourse} 
                    participant={currentParticipant} 
                    participants={participants} 
                    onChangeParticipant={(id) => onSetSelectedParticipantId(id)} 
                />
            </>
        )}
    </Suspense>
)}




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

        {activeCoursesTab === 'exercises' && selectedCourse && (
            <CourseExercisesView
                course={selectedCourse}
                participants={participants}
                selectedParticipantId={selectedParticipantId}
            />
        )}

        {activeCoursesTab === 'exercises' && !selectedCourse && (
            <EmptyState message="Please select a course from the 'Courses' tab to open the exercises." />
        )}
    </>
)}





            </div>

            {/* RENDER THE MODAL COMPONENT */}
            <FacilitatorIdMigrationModal 
                isOpen={showMigrationModal} 
                onClose={() => setShowMigrationModal(false)} 
                onComplete={handleRefresh} 
            />
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

// ============================================================================
// COPY COURSE DATA — advanced action for federal managers and super users
// ============================================================================
//
// Copies selected field groups from one course onto one or more others. Built
// for the case where a batch of courses is set up with the same leadership,
// funding and logistics and only the dates and location differ.
//
// Two rules keep this from being destructive:
//   • Identity is never copied — id, course_type, approvalStatus, certificate
//     state and coverage baselines all stay on the target.
//   • Groups are opt-in. An unticked group is left exactly as it was on the
//     target rather than being blanked.

export const COPYABLE_FIELD_GROUPS = [
    {
        key: 'leadership',
        label: 'القيادة (مدير الدورة والمدرب السريري)',
        labelEn: 'Leadership (director & clinical instructor)',
        fields: [
            'director', 'directorId', 'director_imci_sub_type',
            'clinical_instructor', 'clinical_instructorId', 'clinical_instructor_imci_sub_type',
        ],
    },
    {
        key: 'facilitators',
        label: 'الميسرون والورش الفرعية',
        labelEn: 'Facilitators & sub-courses',
        fields: ['facilitators', 'facilitatorIds', 'facilitatorAssignments'],
    },
    {
        key: 'coordinators',
        label: 'المنسقون',
        labelEn: 'Coordinators',
        fields: ['coordinator', 'state_coordinator', 'locality_coordinator'],
    },
    {
        key: 'funding',
        label: 'التمويل والمشروع والتنفيذ',
        labelEn: 'Funding, project & implementer',
        fields: ['funded_by', 'course_budget', 'course_project', 'implemented_by'],
    },
    {
        key: 'logistics',
        label: 'القاعة والمدة وعدد المشاركين',
        labelEn: 'Hall, duration & participant count',
        fields: ['hall', 'hall_english', 'course_duration', 'participants_count'],
    },
    {
        key: 'location',
        label: 'الموقع (الولايات والمحليات والمستوى)',
        labelEn: 'Location (states, localities, level)',
        // Copying location invalidates the IMNCI coverage baseline, which is
        // derived from the states and localities. handleCopy nulls the snapshot
        // so it is recalculated on the next save rather than left stale.
        fields: ['state', 'locality', 'states', 'localities', 'course_level'],
        invalidatesBaseline: true,
    },
    {
        key: 'dates',
        label: 'تاريخ البداية',
        labelEn: 'Start date',
        fields: ['start_date'],
        // Off by default: two courses sharing a start date is usually a mistake.
        defaultOff: true,
    },
];

export function CopyCourseDataModal({
    isOpen, onClose, allCourses = [], courseType, onCopy, isProcessing, currentUserIdentifier
}) {
    const [sourceId, setSourceId] = useState('');
    const [targetIds, setTargetIds] = useState([]);
    const [selectedGroups, setSelectedGroups] = useState(
        () => COPYABLE_FIELD_GROUPS.filter(g => !g.defaultOff).map(g => g.key)
    );
    const [search, setSearch] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSourceId(''); setTargetIds([]); setSearch('');
            setConfirming(false); setError('');
            setSelectedGroups(COPYABLE_FIELD_GROUPS.filter(g => !g.defaultOff).map(g => g.key));
        }
    }, [isOpen]);

    // Same package only. Copying a facilitator's 'EENC Mentorship' assignment
    // onto an ETAT course would write a sub-course that ETAT's picker can't
    // show and that mentorship detection would then act on.
    const eligible = useMemo(() => (allCourses || []).filter(
        c => c.course_type === courseType && !c.inRecycleBin && !c.deletionRequested
    ), [allCourses, courseType]);

    const describe = (c) => {
        const where = [c.state, c.locality].filter(Boolean).join(' — ');
        const when = c.start_date || 'بدون تاريخ';
        return `${c.hall || 'بدون قاعة'} | ${where || 'بدون موقع'} | ${when}`;
    };

    const source = eligible.find(c => c.id === sourceId) || null;

    const targets = useMemo(() => {
        const term = search.trim().toLowerCase();
        return eligible
            .filter(c => c.id !== sourceId)
            .filter(c => !term || describe(c).toLowerCase().includes(term));
    }, [eligible, sourceId, search]);

    if (!isOpen) return null;

    const toggleGroup = (key) => {
        setSelectedGroups(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const toggleTarget = (id) => {
        setTargetIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    const groupsToApply = COPYABLE_FIELD_GROUPS.filter(g => selectedGroups.includes(g.key));

    const fieldPreview = groupsToApply.flatMap(g => g.fields);

    const handleConfirm = async () => {
        setError('');
        if (!source) { setError('اختر الدورة المصدر.'); return; }
        if (targetIds.length === 0) { setError('اختر دورة هدف واحدة على الأقل.'); return; }
        if (groupsToApply.length === 0) { setError('اختر مجموعة حقول واحدة على الأقل للنسخ.'); return; }
        try {
            await onCopy({ source, targetIds, groups: groupsToApply });
            onClose();
        } catch (e) {
            setError(e.message || 'تعذر نسخ البيانات.');
            setConfirming(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={isProcessing ? () => {} : onClose} title={`نسخ بيانات دورة — ${courseType}`}>
            <div dir="rtl" style={{ textAlign: 'right' }}>
                <CardBody>
                    {error && (
                        <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
                    )}

                    {eligible.length < 2 ? (
                        <EmptyState message="تحتاج إلى دورتين على الأقل من نفس الحزمة لاستخدام أداة النسخ." />
                    ) : (
                        <>
                            <FormGroup label="١. الدورة المصدر (يُنسخ منها)">
                                <Select value={sourceId} disabled={isProcessing} onChange={(e) => { setSourceId(e.target.value); setTargetIds([]); }}>
                                    <option value="">— اختر الدورة المصدر —</option>
                                    {eligible.map(c => <option key={c.id} value={c.id}>{describe(c)}</option>)}
                                </Select>
                            </FormGroup>

                            <div className="mt-5">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">٢. البيانات المراد نسخها</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {COPYABLE_FIELD_GROUPS.map(g => (
                                        <label key={g.key} className="flex items-start gap-2 p-2 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                className="mt-1"
                                                disabled={isProcessing}
                                                checked={selectedGroups.includes(g.key)}
                                                onChange={() => toggleGroup(g.key)}
                                            />
                                            <span className="text-sm text-gray-800">
                                                {g.label}
                                                {g.invalidatesBaseline && selectedGroups.includes(g.key) && (
                                                    <span className="block text-xs text-amber-700 mt-0.5">
                                                        سيُعاد احتساب خط الأساس للتغطية عند الحفظ.
                                                    </span>
                                                )}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    لا يُنسخ نوع الدورة أو حالة الاعتماد أو الشهادات أو المشاركون. المجموعات غير المحددة تبقى كما هي في الدورة الهدف.
                                </p>
                            </div>

                            <div className="mt-5">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">
                                    ٣. الدورات الهدف ({targetIds.length} محددة)
                                </h4>
                                <Input
                                    value={search}
                                    disabled={isProcessing || !sourceId}
                                    placeholder="ابحث بالقاعة أو الولاية أو التاريخ..."
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="mb-2"
                                />
                                <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                                    {!sourceId ? (
                                        <div className="p-3 text-sm text-gray-500">اختر الدورة المصدر أولاً.</div>
                                    ) : targets.length === 0 ? (
                                        <div className="p-3 text-sm text-gray-500">لا توجد دورات مطابقة.</div>
                                    ) : targets.map(c => (
                                        <label key={c.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                disabled={isProcessing}
                                                checked={targetIds.includes(c.id)}
                                                onChange={() => toggleTarget(c.id)}
                                            />
                                            <span className="text-sm text-gray-800">{describe(c)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {confirming && (
                                <div className="mt-5 p-3 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                        <div>
                                            سيتم استبدال {fieldPreview.length} حقلاً في {targetIds.length} دورة.
                                            لا يمكن التراجع عن هذا الإجراء.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardBody>
                <CardFooter>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isProcessing}>إلغاء</Button>
                        {eligible.length >= 2 && (
                            confirming ? (
                                <Button variant="danger" onClick={handleConfirm} disabled={isProcessing}>
                                    {isProcessing ? <Spinner size="sm" /> : 'تأكيد النسخ'}
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => {
                                        setError('');
                                        if (!sourceId) { setError('اختر الدورة المصدر.'); return; }
                                        if (targetIds.length === 0) { setError('اختر دورة هدف واحدة على الأقل.'); return; }
                                        if (groupsToApply.length === 0) { setError('اختر مجموعة حقول واحدة على الأقل للنسخ.'); return; }
                                        setConfirming(true);
                                    }}
                                    disabled={isProcessing}
                                >
                                    <Copy size={14} className="ml-1" /> مراجعة ونسخ
                                </Button>
                            )
                        )}
                    </div>
                </CardFooter>
            </div>
        </Modal>
    );
}

// ============================================================================
// CUSTOM SUB-COURSES — runtime catalogue stored in Firestore
// ============================================================================
//
// Federal managers and super users can add a sub-course without a code release.
// Entries live in the `course_sub_types` collection as:
//     { course_type: 'ETAT', name: 'ETAT TOT', createdBy, createdByRole, createdAt }
//
// Built-in sub-courses are NOT stored here — they ship in constants.js and can't
// be deleted. mergeSubCourseTypes puts the two lists together for the picker.

export function useCustomSubCourses() {
    const [customSubCourses, setCustomSubCourses] = useState([]);
    const [loadingSubCourses, setLoadingSubCourses] = useState(false);
    const [subCourseError, setSubCourseError] = useState('');

    const fetchCustomSubCourses = React.useCallback(async () => {
        setLoadingSubCourses(true);
        setSubCourseError('');
        try {
            const snap = await getDocs(collection(db, COURSE_SUB_TYPES_COLLECTION));
            const rows = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(r => r.name && r.course_type)
                // createdAt can be null for a moment right after addDoc, because
                // serverTimestamp resolves on the server. Treat null as newest.
                .sort((a, b) => (a.createdAt?.seconds || Infinity) - (b.createdAt?.seconds || Infinity));
            setCustomSubCourses(rows);
        } catch (e) {
            console.error('Failed to load custom sub-courses:', e);
            setSubCourseError(e.message || 'Could not load custom sub-courses.');
            // Deliberately leave whatever was loaded before in place: a failed
            // refresh should not empty a picker the user is mid-way through.
        } finally {
            setLoadingSubCourses(false);
        }
    }, []);

    useEffect(() => { fetchCustomSubCourses(); }, [fetchCustomSubCourses]);

    const addCustomSubCourse = React.useCallback(async ({ courseType, name, createdBy, createdByRole }) => {
        const clean = String(name || '').trim();
        if (!clean) throw new Error('اسم الورشة الفرعية مطلوب.');
        if (clean.length > 120) throw new Error('اسم الورشة الفرعية طويل جداً.');
        if (!courseType) throw new Error('نوع الدورة غير محدد.');

        const key = clean.toLowerCase();
        if (isBuiltinSubCourse(courseType, clean)) {
            throw new Error(`«${clean}» موجودة بالفعل ضمن القائمة الأساسية.`);
        }
        const duplicate = customSubCourses.some(
            r => r.course_type === courseType && r.name.trim().toLowerCase() === key
        );
        if (duplicate) throw new Error(`«${clean}» مضافة بالفعل لهذه الحزمة.`);

        const ref = await addDoc(collection(db, COURSE_SUB_TYPES_COLLECTION), {
            course_type: courseType,
            name: clean,
            createdBy: createdBy || 'Unknown',
            createdByRole: createdByRole || null,
            createdAt: serverTimestamp(),
        });

        // Optimistic append so the new option is selectable immediately rather
        // than after a round trip.
        const row = { id: ref.id, course_type: courseType, name: clean, createdBy, createdByRole, createdAt: null };
        setCustomSubCourses(prev => [...prev, row]);
        return row;
    }, [customSubCourses]);

    const deleteCustomSubCourse = React.useCallback(async (id) => {
        await deleteDoc(doc(db, COURSE_SUB_TYPES_COLLECTION, id));
        setCustomSubCourses(prev => prev.filter(r => r.id !== id));
    }, []);

    return {
        customSubCourses,
        loadingSubCourses,
        subCourseError,
        fetchCustomSubCourses,
        addCustomSubCourse,
        deleteCustomSubCourse,
    };
}

// Add / remove custom sub-courses for one course package.
//
// Deleting only removes the option from future pickers. Courses already saved
// with that sub-course keep it — the value is a plain string on the course
// document — which is why the confirm text says so rather than warning about
// data loss.
export function ManageSubCoursesModal({
    isOpen, onClose, courseType, customSubCourses, onAdd, onDelete,
    currentUserIdentifier, currentUserRole, initialName = ''
}) {
    const [name, setName] = useState(initialName);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    useEffect(() => {
        if (isOpen) { setName(initialName); setError(''); setConfirmDeleteId(null); }
    }, [isOpen, initialName]);

    if (!isOpen) return null;

    const builtinList = mergeSubCourseTypes(courseType, []);
    const customForType = (customSubCourses || []).filter(r => r.course_type === courseType);

    const handleAdd = async () => {
        setBusy(true);
        setError('');
        try {
            const created = await onAdd(name);
            if (created) { setName(''); }
        } catch (e) {
            setError(e.message || 'تعذر إضافة الورشة الفرعية.');
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (id) => {
        setBusy(true);
        setError('');
        try {
            await onDelete(id);
            setConfirmDeleteId(null);
        } catch (e) {
            setError(e.message || 'تعذر حذف الورشة الفرعية.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title={`الورش الفرعية — ${courseType}`}>
            <div dir="rtl" style={{ textAlign: 'right' }}>
                <CardBody>
                    {error && (
                        <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
                            {error}
                        </div>
                    )}

                    <FormGroup label="إضافة ورشة فرعية جديدة">
                        <div className="flex gap-2">
                            <Input
                                value={name}
                                disabled={busy}
                                placeholder="مثال: ETAT TOT"
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleAdd(); }}
                                className="flex-1"
                            />
                            <Button onClick={handleAdd} disabled={busy || !name.trim()}>
                                {busy ? <Spinner size="sm" /> : 'إضافة'}
                            </Button>
                        </div>
                    </FormGroup>
                    <p className="text-xs text-gray-500 mt-1 mb-5">
                        تصبح الورشة الفرعية متاحة فوراً لكل مستخدمي هذه الحزمة.
                    </p>

                    <div className="mb-5">
                        <h4 className="text-sm font-bold text-gray-700 mb-2">الورش الأساسية (غير قابلة للحذف)</h4>
                        <div className="flex flex-wrap gap-2">
                            {builtinList.length === 0
                                ? <span className="text-sm text-gray-500">لا توجد ورش أساسية لهذه الحزمة.</span>
                                : builtinList.map(t => (
                                    <span key={t} className="text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2 py-1 rounded">
                                        {t}
                                    </span>
                                ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2">
                            الورش المضافة من النظام ({customForType.length})
                        </h4>
                        {customForType.length === 0 ? (
                            <p className="text-sm text-gray-500">لم تُضف أي ورشة فرعية لهذه الحزمة بعد.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
                                {customForType.map(row => (
                                    <li key={row.id} className="flex items-center justify-between gap-3 p-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-gray-800 truncate">{row.name}</div>
                                            <div className="text-xs text-gray-500 truncate">
                                                أضافها: {row.createdBy || 'غير معروف'}
                                            </div>
                                        </div>
                                        {confirmDeleteId === row.id ? (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-gray-600">
                                                    تُحذف من القائمة فقط، والدورات المحفوظة لا تتأثر.
                                                </span>
                                                <Button variant="danger" disabled={busy} onClick={() => handleDelete(row.id)}>تأكيد</Button>
                                                <Button variant="secondary" disabled={busy} onClick={() => setConfirmDeleteId(null)}>تراجع</Button>
                                            </div>
                                        ) : (
                                            <Button variant="secondary" disabled={busy} onClick={() => setConfirmDeleteId(row.id)} className="shrink-0">
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </CardBody>
                <CardFooter>
                    <div className="flex justify-end">
                        <Button variant="secondary" onClick={onClose} disabled={busy}>إغلاق</Button>
                    </div>
                </CardFooter>
            </div>
        </Modal>
    );
}

export function CourseForm({ 
    courseType, initialData, facilitatorsList, fundersList, onCancel, onSave, 
    federalCoordinatorsList = [], stateCoordinatorsList = [], localityCoordinatorsList = [],
    userStates, userLocalities, canUseFederalManagerAdvancedFeatures, canUseSuperUserAdvancedFeatures,
    customSubCourses = [], onAddSubCourse, onDeleteSubCourse,
    currentUserIdentifier, currentUserRole
}) {
    // --- BINDING LATEST NAMES ---
    const getFacName = (id, oldName) => {
        if (id && facilitatorsList) {
            const f = facilitatorsList.find(fac => fac.id === id);
            if (f) return f.name;
        }
        return oldName || '';
    };
    
    // --- Helper Component for Mandatory Fields ---
    const ReqLabel = ({ text, required = true }) => (
        <span className="flex items-center gap-1">
            {text} {required && <span className="text-red-500 font-bold text-lg leading-none">*</span>}
        </span>
    );

    const availableStates = useMemo(() => {
        const allStates = Object.keys(STATE_LOCALITIES).sort((a, b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar));
        if (!userStates || userStates.length === 0) {
            return allStates;
        }
        return allStates.filter(s => userStates.includes(s));
    }, [userStates]);

    const [isSaving, setIsSaving] = useState(false);

    const [courseLevel, setCourseLevel] = useState(initialData?.course_level || (isFederalCourse(initialData) ? COURSE_LEVELS.FEDERAL : COURSE_LEVELS.STATE));

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
    const [supporter, setSupporter] = useState(initialData?.funded_by || '');
    const [stateCoordinator, setStateCoordinator] = useState(initialData?.state_coordinator || '');
    const [localityCoordinator, setLocalityCoordinator] = useState(initialData?.locality_coordinator || '');
    const [courseProject, setCourseProject] = useState(initialData?.course_project || '');
    const [implementedBy, setImplementedBy] = useState(initialData?.implemented_by || '');

    const [director, setDirector] = useState(() => getFacName(initialData?.directorId, initialData?.director));
    const [clinical, setClinical] = useState(() => getFacName(initialData?.clinical_instructorId, initialData?.clinical_instructor));

    // IMNCI keeps its historical behaviour of pre-selecting the first option;
    // every other package starts blank so an unset sub-course stays unset rather
    // than silently defaulting to 'ETAT Standard' on save.
    const defaultLeadershipSubType = courseType === 'IMNCI' ? IMNCI_SUBCOURSE_TYPES[0] : '';
    const [directorImciSubType, setDirectorImciSubType] = useState(initialData?.director_imci_sub_type || defaultLeadershipSubType);
    const [clinicalImciSubType, setClinicalImciSubType] = useState(initialData?.clinical_instructor_imci_sub_type || defaultLeadershipSubType);

    // The sub-course lists moved to constants.js (BLOCK S) so the filters, the
    // copy tool and the reports view read the same catalogue this form does.
    // `subCourseOptions` is built-ins for this package plus anything a federal
    // manager or super user has added at runtime.
    const subCourseOptions = useMemo(
        () => mergeSubCourseTypes(courseType, customSubCourses),
        [courseType, customSubCourses]
    );

    const canManageSubCourses =
        Boolean(onAddSubCourse) &&
        (canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures);

    const [subCourseModalOpen, setSubCourseModalOpen] = useState(false);
    // Where a newly added sub-course should be written back to, so the user
    // lands on it selected instead of having to find it in the list again.
    const [subCourseTarget, setSubCourseTarget] = useState(null);

    const openSubCourseManager = (target) => {
        setSubCourseTarget(target);
        setSubCourseModalOpen(true);
    };

    const handleAddSubCourse = async (name) => {
        const created = await onAddSubCourse({
            courseType,
            name,
            createdBy: currentUserIdentifier,
            createdByRole: currentUserRole,
        });

        // Auto-select into whichever field opened the manager.
        if (created?.name && subCourseTarget) {
            if (subCourseTarget.kind === 'director') setDirectorImciSubType(created.name);
            else if (subCourseTarget.kind === 'clinical') setClinicalImciSubType(created.name);
            else if (subCourseTarget.kind === 'facilitator') {
                updateFacilitatorAssignment(subCourseTarget.group, subCourseTarget.index, 'imci_sub_type', created.name);
            }
        }
        return created;
    };

    const COURSE_GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];

    const isImnci = courseType === 'IMNCI';
    const isInfectionControl = courseType === 'IPC';
    const isIccm = courseType === 'ICCM';
    const isCpcm = courseType === 'Comprehensive Package For Community Midwives';
    const isSmallAndSick = courseType === 'Small & Sick Newborn';
    const isEmonc = courseType === 'EmONC';
    const isEtat = courseType === 'ETAT';
    const isProgramManagement = courseType === 'Program Management';

    // Which packages record a sub-course against the course director and
    // clinical instructor, not just against each facilitator. ETAT joins IMNCI
    // here: without a course-level field, 'ETAT Mentorship' could only ever be
    // read off the facilitator assignments, so a course with no facilitator rows
    // yet would not resolve as a mentorship course at all.
    const showLeadershipSubCourse = isImnci || isEtat;

    const [groups, setGroups] = useState(initialData?.facilitatorAssignments?.length > 0 ? [...new Set(initialData.facilitatorAssignments.map(a => a.group))] : ['Group A', 'Group B']);

    const [facilitatorGroups, setFacilitatorGroups] = useState(() => {
        const defaultSubcourse = isIccm ? ICCM_SUBCOURSE_TYPES[0] : isCpcm ? CPCM_SUBCOURSE_TYPES[0] : '';
        if (initialData?.facilitatorAssignments?.length > 0) {
            const groupsMap = {};
            initialData.facilitatorAssignments.forEach(assignment => {
                if (!groupsMap[assignment.group]) {
                    groupsMap[assignment.group] = [];
                }
                groupsMap[assignment.group].push({
                    name: getFacName(assignment.facilitatorId, assignment.name), 
                    imci_sub_type: assignment.imci_sub_type,
                    facilitatorId: assignment.facilitatorId 
                });
            });
            const initialGroups = [...new Set(initialData.facilitatorAssignments.map(a => a.group))];
            initialGroups.forEach(group => {
                if (!groupsMap[group]) {
                    groupsMap[group] = [];
                }
            });
            return groupsMap;
        }
        return {
            'Group A': [{ imci_sub_type: defaultSubcourse, name: '' }, { imci_sub_type: defaultSubcourse, name: '' }],
            'Group B': [{ imci_sub_type: defaultSubcourse, name: '' }, { imci_sub_type: defaultSubcourse, name: '' }]
        };
    });

    const [error, setError] = useState('');

    const directorOptions = useMemo(() => {
        if (canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures) {
            return [...facilitatorsList].sort((a, b) => a.name.localeCompare(b.name));
        }
        return facilitatorsList
            .filter(f => {
                const fCourses = Array.isArray(f.courses) ? f.courses : [];
                if (isCpcm) {
                    return fCourses.includes('ICCM') || fCourses.includes('IMNCI') || fCourses.includes('Comprehensive Package For Community Midwives');
                }
                if (isSmallAndSick) {
                    return fCourses.includes('SSNC') || fCourses.includes('Small & Sick Newborn');
                }
                return f.directorCourse === 'Yes';
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, isCpcm, isSmallAndSick, canUseFederalManagerAdvancedFeatures, canUseSuperUserAdvancedFeatures]);

    const clinicalInstructorOptions = useMemo(() => {
        if (canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures) {
            return [...facilitatorsList].sort((a, b) => a.name.localeCompare(b.name));
        }
        return facilitatorsList
            .filter(f => f.isClinicalInstructor === 'Yes' || f.directorCourse === 'Yes')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, canUseFederalManagerAdvancedFeatures, canUseSuperUserAdvancedFeatures]);

    const facilitatorOptions = useMemo(() => {
        if (canUseFederalManagerAdvancedFeatures || canUseSuperUserAdvancedFeatures) {
            return [...facilitatorsList].sort((a, b) => a.name.localeCompare(b.name));
        }
        return facilitatorsList
            .filter(f => {
                const fCourses = Array.isArray(f.courses) ? f.courses : [];
                
                if (isIccm || isCpcm) return fCourses.includes('ICCM') || fCourses.includes('IMNCI') || fCourses.includes('Comprehensive Package For Community Midwives');
                if (isInfectionControl) return fCourses.includes('IPC');
                if (isProgramManagement) return fCourses.includes('Program Management') || fCourses.includes('IMNCI');
                if (isSmallAndSick) return fCourses.includes('SSNC') || fCourses.includes('Small & Sick Newborn');
                if (isEmonc) return fCourses.includes('EmONC') || fCourses.includes('EENC');
                
                return fCourses.includes(courseType);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [facilitatorsList, courseType, isInfectionControl, isIccm, isCpcm, isProgramManagement, isSmallAndSick, isEmonc, canUseFederalManagerAdvancedFeatures, canUseSuperUserAdvancedFeatures]);

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
        const defaultSubcourse = isIccm ? ICCM_SUBCOURSE_TYPES[0] : isCpcm ? CPCM_SUBCOURSE_TYPES[0] : '';
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
            const defaultSubcourse = isIccm ? ICCM_SUBCOURSE_TYPES[0] : isCpcm ? CPCM_SUBCOURSE_TYPES[0] : '';
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
            })).filter(assignment => assignment.name && (assignment.imci_sub_type || isIccm || isCpcm));
            
            if (isIccm) {
                groupAssignments.forEach(a => a.imci_sub_type = ICCM_SUBCOURSE_TYPES[0]);
            } else if (isCpcm) {
                groupAssignments.forEach(a => a.imci_sub_type = CPCM_SUBCOURSE_TYPES[0]);
            }
            
            return [...acc, ...groupAssignments];
        }, []);

        // --- ENHANCED VALIDATION CHECK ---
        const missingFields = [];
        if (states.length === 0) missingFields.push('الولايات');
        if (localities.length === 0) missingFields.push('المحليات');
        if (!hall || hall.trim() === '') missingFields.push('قاعة الدورة');
        if (!startDate) missingFields.push('تاريخ بداية الدورة');
        if (!courseDuration || courseDuration <= 0) missingFields.push('مدة الدورة بالأيام');
        if (!participantsCount || participantsCount <= 0) missingFields.push('عدد المشاركين');
        if (!coordinator) missingFields.push('المنسق الاتحادي للدورة');
        if (!supporter) missingFields.push('بتمويل من');
        if (!implementedBy) missingFields.push('تنفيذ');

        if (!isInfectionControl && !director) {
            missingFields.push('مدير الدورة');
        }

        if (!isInfectionControl && !isSmallAndSick && allFacilitatorAssignments.length === 0) {
            missingFields.push('تعيين ميسر واحد على الأقل');
        }

        if (missingFields.length > 0) {
            const errorMsg = 'الرجاء إكمال الحقول الإلزامية التالية:\n- ' + missingFields.join('\n- ');
            alert(errorMsg); // This triggers the requested popup
            setError('الرجاء إكمال الحقول الإلزامية التالية: ' + missingFields.join('، '));
            return;
        }

        if (!courseType) {
            const typeError = 'تعذر تحديد نوع الدورة. الرجاء العودة لصفحة الدورات واختيار حزمة قبل إضافة دورة جديدة.';
            alert(typeError);
            setError(typeError);
            return;
        }

        const selectedDirectorObj = directorOptions.find(d => d.name === director);
        const directorId = selectedDirectorObj ? selectedDirectorObj.id : null;

        const selectedClinicalObj = clinicalInstructorOptions.find(c => c.name === clinical);
        const clinicalId = selectedClinicalObj ? selectedClinicalObj.id : null;

        const enrichedFacilitatorAssignments = allFacilitatorAssignments.map(assignment => {
            const facObj = facilitatorOptions.find(f => f.name === assignment.name);
            return {
                ...assignment,
                facilitatorId: facObj ? facObj.id : null
            };
        });

        const statesChanged = JSON.stringify(states.slice().sort()) !== JSON.stringify(initialData?.states?.slice().sort() || []);
        const localitiesChanged = JSON.stringify(localities.slice().sort()) !== JSON.stringify(initialData?.localities?.slice().sort() || []);

        const payload = {
            ...initialData, 
            ...(initialData?.id && { id: initialData.id }),
            state: states.join(', '), 
            locality: localities.join(', '),
            states: states,
            localities: localities,
            hall, hall_english: hallEnglish, coordinator, start_date: startDate,
            course_duration: courseDuration,
            participants_count: participantsCount, 
            
            director: director,
            directorId: directorId, 
            
            funded_by: supporter,
            implemented_by: implementedBy,
            course_budget: courseBudget,
            state_coordinator: stateCoordinator,
            locality_coordinator: localityCoordinator,
            course_project: courseProject,
            course_level: courseLevel,
            
            facilitators: enrichedFacilitatorAssignments.map(f => f.name),
            facilitatorIds: enrichedFacilitatorAssignments.map(f => f.facilitatorId).filter(Boolean),
            facilitatorAssignments: enrichedFacilitatorAssignments,
            
            course_type: courseType, 
            approvalStatus: initialData?.approvalStatus || 'pending', 
        };

        if (!statesChanged && !localitiesChanged) {
            if (initialData?.coverageSnapshot) payload.coverageSnapshot = initialData.coverageSnapshot;
            if (initialData?.baselineLockedAt) payload.baselineLockedAt = initialData.baselineLockedAt;
        } else {
            payload.coverageSnapshot = null;
            payload.baselineLockedAt = null;
        }

        if (isImnci || isIccm || isCpcm || isEtat) {
            payload.clinical_instructor = clinical;
            payload.clinical_instructorId = clinicalId;
            payload.director_imci_sub_type = isIccm ? ICCM_SUBCOURSE_TYPES[0] : isCpcm ? CPCM_SUBCOURSE_TYPES[0] : directorImciSubType;
            payload.clinical_instructor_imci_sub_type = isIccm ? ICCM_SUBCOURSE_TYPES[0] : isCpcm ? CPCM_SUBCOURSE_TYPES[0] : clinicalImciSubType;
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
                        <FormGroup label={<ReqLabel text="مستوى الدورة" />}>
                            <Select disabled={isSaving} value={courseLevel} onChange={(e) => setCourseLevel(e.target.value)}>
                                <option value={COURSE_LEVELS.FEDERAL}>اتحادية (مشاركون من كل الولايات)</option>
                                <option value={COURSE_LEVELS.STATE}>ولائية</option>
                                <option value={COURSE_LEVELS.LOCALITY}>محلية</option>
                            </Select>
                            {courseLevel === COURSE_LEVELS.FEDERAL && (
                                <p className="mt-1 text-xs text-sky-700">
                                    عند التسجيل، يمكن اختيار المشاركين من جميع الولايات. الولاية/المحلية أدناه هي مكان انعقاد الدورة فقط.
                                </p>
                            )}
                        </FormGroup>
                        <FormGroup label={<ReqLabel text="الولايات (يمكن اختيار أكثر من ولاية)" />}>
                            <MultiSelectDropdown 
                                disabled={isSaving} 
                                selectedValues={states} 
                                onChange={setStates} 
                                placeholder="— اختر الولايات —"
                                options={availableStates.map(s => ({ value: s, label: STATE_LOCALITIES[s].ar }))} 
                            />
                        </FormGroup>
                        <FormGroup label={<ReqLabel text="المحليات (يمكن اختيار أكثر من محلية)" />}>
                            <MultiSelectDropdown 
                                disabled={isSaving || states.length === 0} 
                                selectedValues={localities} 
                                onChange={setLocalities} 
                                placeholder="— اختر المحليات —"
                                options={availableLocalities.map(l => ({ value: l.en, label: l.ar }))} 
                            />
                        </FormGroup>
                        <FormGroup label={<ReqLabel text="قاعة الدورة" />}>
                            <Input disabled={isSaving} value={hall} onChange={(e) => setHall(e.target.value)} />
                        </FormGroup>
                        <FormGroup label="قاعة الدورة (باللغة الإنجليزية - للشهادات)">
                            <Input disabled={isSaving} value={hallEnglish} onChange={(e) => setHallEnglish(e.target.value)} dir="ltr" placeholder="Course Hall Name in English" />
                        </FormGroup>
                        <FormGroup label={<ReqLabel text="تاريخ بداية الدورة" />}><Input disabled={isSaving} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></FormGroup>
                        <FormGroup label={<ReqLabel text="مدة الدورة بالأيام" />}><Input disabled={isSaving} type="number" value={courseDuration} onChange={(e) => setCourseDuration(Number(e.target.value))} /></FormGroup>
                        <FormGroup label={<ReqLabel text="عدد المشاركين" />}><Input disabled={isSaving} type="number" value={participantsCount} onChange={(e) => setParticipantsCount(Number(e.target.value))} /></FormGroup>
                        <FormGroup label="ميزانية الدورة بالدولار الأمريكي"><Input disabled={isSaving} type="number" value={courseBudget} onChange={(e) => setCourseBudget(Number(e.target.value))} /></FormGroup>
                    </div>
                </div>

                <div className="mb-8">
                    <h3 className="text-lg font-bold bg-green-100 text-green-800 p-3 rounded-md mb-4 border-r-4 border-green-500">التنسيق والتمويل</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FormGroup label={<ReqLabel text="المنسق الاتحادي للدورة" />}>
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
                        <FormGroup label={<ReqLabel text="بتمويل من" />}>
                            <SearchableSelect
                                disabled={isSaving}
                                value={supporter}
                                onChange={setSupporter}
                                options={funderOptions}
                                placeholder="اكتب للبحث..."
                                label="بتمويل من"
                            />
                        </FormGroup>
                        <FormGroup label={<ReqLabel text="تنفيذ" />}>
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
                                <FormGroup label={<ReqLabel text="مدير الدورة" required={!isInfectionControl} />}>
                                    <SearchableSelect
                                        disabled={isSaving}
                                        value={director}
                                        onChange={setDirector}
                                        options={directorOptions}
                                        placeholder="اكتب للبحث..."
                                        label="مدير الدورة"
                                    />
                                </FormGroup>
                                {showLeadershipSubCourse && (
                                    <FormGroup label="اسم الورشة الفرعية">
                                        <div className="flex gap-2">
                                            <Select disabled={isSaving} value={directorImciSubType} onChange={(e) => setDirectorImciSubType(e.target.value)} className="w-full flex-1">
                                                <option value="">— اختر الورشة الفرعية —</option>
                                                {subCourseOptions.map(type => <option key={type} value={type}>{type}</option>)}
                                            </Select>
                                            {canManageSubCourses && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    disabled={isSaving}
                                                    title="إضافة ورشة فرعية جديدة"
                                                    onClick={() => openSubCourseManager({ kind: 'director' })}
                                                    className="shrink-0"
                                                >
                                                    +
                                                </Button>
                                            )}
                                        </div>
                                    </FormGroup>
                                )}
                            </div>

                            {(isImnci || isIccm || isCpcm || isEtat) && (
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
                                    {showLeadershipSubCourse && (
                                        <FormGroup label="اسم الورشة الفرعية">
                                            <div className="flex gap-2">
                                                <Select disabled={isSaving} value={clinicalImciSubType} onChange={(e) => setClinicalImciSubType(e.target.value)} className="w-full flex-1">
                                                    <option value="">— اختر الورشة الفرعية —</option>
                                                    {subCourseOptions.map(type => <option key={type} value={type}>{type}</option>)}
                                                </Select>
                                                {canManageSubCourses && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        disabled={isSaving}
                                                        title="إضافة ورشة فرعية جديدة"
                                                        onClick={() => openSubCourseManager({ kind: 'clinical' })}
                                                        className="shrink-0"
                                                    >
                                                        +
                                                    </Button>
                                                )}
                                            </div>
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
                                        <FormGroup label={<ReqLabel text="اسم الميسر" required={!isInfectionControl && !isSmallAndSick} />} className={(isIccm || isCpcm) ? "lg:col-span-2" : ""}>
                                            <SearchableSelect
                                                disabled={isSaving}
                                                value={assignment.name}
                                                onChange={(value) => updateFacilitatorAssignment(groupName, index, 'name', value)}
                                                options={facilitatorOptions}
                                                placeholder="اكتب للبحث..."
                                                label="اسم الميسر"
                                            />
                                        </FormGroup>
                                      {!(isIccm || isCpcm) && (
                                            <FormGroup label="اسم الورشة الفرعية">
                                                <div className="flex gap-2">
                                                    <Select
                                                        disabled={isSaving}
                                                        value={assignment.imci_sub_type || ''}
                                                        onChange={(e) => updateFacilitatorAssignment(groupName, index, 'imci_sub_type', e.target.value)}
                                                        className="w-full flex-1"
                                                    >
                                                        <option value="">— اختر الورشة الفرعية —</option>
                                                        {subCourseOptions.map(type => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </Select>
                                                    {canManageSubCourses && (
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            disabled={isSaving}
                                                            title="إضافة ورشة فرعية جديدة"
                                                            onClick={() => openSubCourseManager({ kind: 'facilitator', group: groupName, index })}
                                                            className="shrink-0"
                                                        >
                                                            +
                                                        </Button>
                                                    )}
                                                </div>
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

            {canManageSubCourses && (
                <ManageSubCoursesModal
                    isOpen={subCourseModalOpen}
                    onClose={() => { setSubCourseModalOpen(false); setSubCourseTarget(null); }}
                    courseType={courseType}
                    customSubCourses={customSubCourses}
                    onAdd={handleAddSubCourse}
                    onDelete={onDeleteSubCourse}
                    currentUserIdentifier={currentUserIdentifier}
                    currentUserRole={currentUserRole}
                />
            )}
        </Card>
    );
}

export function PublicCourseMonitoringView({ course, allParticipants }) {
    const [selectedParticipantId, setSelectedParticipantId] = useState(
        allParticipants && allParticipants.length > 0 ? allParticipants[0].id : null
    );
    const [emoncModule, setEmoncModule] = useState('maternal'); // Internal file pointer router
    
    const currentParticipant = allParticipants?.find(p => p.id === selectedParticipantId);

    if (!course) return <EmptyState message="Course data unavailable." />;

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4">
            <Card>
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
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
                         </div>
                    </div>
                    
                    {allParticipants && allParticipants.length > 0 && (
                        <div className="w-full sm:w-auto">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Participant</label>
                            <Select value={selectedParticipantId || ''} onChange={(e) => setSelectedParticipantId(e.target.value)} className="min-w-[200px]">
                                {allParticipants.map(p => <option key={p.id} value={p.id}>{p.name} — {p.group}</option>)}
                            </Select>
                        </div>
                    )}
                </div>
            </Card>

            <Suspense fallback={<div className="flex justify-center p-10"><Spinner /></div>}>
                {allParticipants && allParticipants.length > 0 ? (
                    currentParticipant ? (
                        course.course_type === 'EmONC' ? (
                             emoncModule === 'maternal' ? (
                                  <MaternalEmergencyMonitoring 
                                      course={course} 
                                      participant={currentParticipant} 
                                      participants={allParticipants}
                                      onChangeParticipant={setSelectedParticipantId}
                                      onCancel={() => {}} 
                                      switchModule={setEmoncModule}
                                      isPublicView={true}
                                  />
                             ) : (
                                  <NeonatalEmergencyMonitoring 
                                      course={course} 
                                      participant={currentParticipant} 
                                      participants={allParticipants}
                                      onChangeParticipant={setSelectedParticipantId}
                                      onCancel={() => {}} 
                                      switchModule={setEmoncModule}
                                      isPublicView={true}
                                  />
                             )
                        ) : hasMentorshipForm(course, currentParticipant) ? (
                            <MentorshipMonitoringView
                                course={course}
                                participant={currentParticipant}
                                participants={allParticipants}
                                onChangeParticipant={setSelectedParticipantId}
                                isPublicView={true}
                            />
                        ) : (
                            <>
                                <MentorshipDetectionNotice course={course} participant={currentParticipant} />
                                <ObservationView 
                                    course={course} 
                                    participant={currentParticipant} 
                                    participants={allParticipants}
                                    onChangeParticipant={setSelectedParticipantId}
                                    isPublicView={true}
                                />
                            </>
                        )
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