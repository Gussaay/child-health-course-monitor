// src/components/ProgramTeamView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react'; 
import {
    upsertStateCoordinator,
    deleteStateCoordinator,
    submitCoordinatorApplication,
    approveCoordinatorSubmission,
    rejectCoordinatorSubmission,
    
    upsertFederalCoordinator,
    deleteFederalCoordinator,
    submitFederalApplication,
    approveFederalSubmission,
    rejectFederalSubmission,

    upsertLocalityCoordinator,
    deleteLocalityCoordinator,
    submitLocalityApplication,
    approveLocalitySubmission,
    rejectLocalitySubmission,

    updateCoordinatorApplicationStatus,
    incrementCoordinatorApplicationOpenCount,

    getCoordinatorApplicationSettings, 
    uploadFile 

} from '../data';
import { Button, Card, Table, Modal, Input, Select, Textarea, Spinner, PageHeader, EmptyState, FormGroup, CardBody, CardFooter } from './CommonComponents';
import { STATE_LOCALITIES } from './constants';
import { auth, db } from '../firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { useDataCache } from '../DataContext'; 
import { doc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { 
    DEFAULT_ROLE_PERMISSIONS, 
    applyDerivedPermissions, 
    ALL_PERMISSIONS 
} from './AdminDashboard';

// Reusable Share Link Modal
function ShareLinkModal({ isOpen, onClose, title, link }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <p className="text-sm text-gray-600 mb-4">Share this public link with anyone. They will be able to view a read-only version of the profile.</p>
            
            <FormGroup label="Public Link">
                <div className="flex gap-2">
                    <Input type="text" value={link} readOnly />
                    <Button onClick={handleCopy} variant="secondary" className="w-24">
                        {copied ? 'Copied!' : 'Copy'}
                    </Button>
                </div>
            </FormGroup>

            <FormGroup label="QR Code">
                <div className="flex justify-center p-4 bg-white rounded-md border">
                    <QRCodeCanvas
                        value={link}
                        size={256} 
                        bgColor={"#ffffff"}
                        fgColor={"#000000"}
                        level={"Q"} 
                    />
                </div>
            </FormGroup>
        </Modal>
    );
}


// Reusable component for dynamic experience fields
function DynamicExperienceFields({ experiences, onChange }) {
    const handleAddExperience = () => onChange([...experiences, { role: '', duration: '' }]);
    const handleRemoveExperience = (index) => onChange(experiences.filter((_, i) => i !== index));
    const handleExperienceChange = (index, field, value) => {
        const newExperiences = experiences.map((exp, i) => i === index ? { ...exp, [field]: value } : exp);
        onChange(newExperiences);
    };

    return (
        <FormGroup label="المهام الوظيفية والخبرات الاخرى قبل الانضمام لبرنامج صحة الطفل" dir="rtl">
            <div className="space-y-4">
                {experiences.map((exp, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2 p-3 border rounded-md bg-gray-50">
                        <Input label="الخبرة/المهمة" value={exp.role} onChange={(e) => handleExperienceChange(index, 'role', e.target.value)} placeholder="العمل ببرنامج الصحة الانجابية" className="flex-grow" />
                        <Input label="مدة الخبرة بالسنوات" value={exp.duration} onChange={(e) => handleExperienceChange(index, 'duration', e.target.value)} placeholder="مثال: سنتان" className="sm:w-40" />
                        <Button size="sm" variant="danger" onClick={() => handleRemoveExperience(index)} className="self-end sm:self-center mt-2 sm:mt-0 h-10">حذف</Button>
                    </div>
                ))}
                <Button type="button" variant="secondary" onClick={handleAddExperience}>إضافة خبرات أخرى</Button>
            </div>
        </FormGroup>
    );
}

// A single, reusable component for displaying form fields
function MemberFormFieldset({ level, formData, onFormChange, onDynamicFieldChange }) {
    const states = Object.keys(STATE_LOCALITIES);
    const localities = formData.state ? (STATE_LOCALITIES[formData.state]?.localities || []).map(l => l.en) : [];
    const joinDateLabels = { state: 'تاريخ الانضمام لبرنامج صحة الطفل بالولاية', federal: 'تاريخ الانضمام لبرنامج صحة الطفل بالاتحادية' };

    return (
        <>
            {/* --- MODIFIED: Explicitly labeled English Name and Added Arabic Name --- */}
            <Input label="الإسم (باللغة الإنجليزية)" name="name" value={formData.name} onChange={onFormChange} required />
            <Input label="الإسم (باللغة العربية)" name="nameAr" value={formData.nameAr || ''} onChange={onFormChange} required />
            
            <Input label="رقم الهاتف" name="phone" type="tel" value={formData.phone} onChange={onFormChange} />
            <Input label="الايميل" name="email" type="email" value={formData.email} onChange={onFormChange} required disabled={formData.isUserEmail} />
            {level !== 'federal' && ( <Select label="الولاية" name="state" value={formData.state} onChange={onFormChange} required><option value="">اختر ولاية</option>{states.map(s => <option key={s} value={s}>{s}</option>)}</Select> )}
            {level === 'locality' && ( <Select label="المحلية" name="locality" value={formData.locality} onChange={onFormChange} required disabled={!formData.state}><option value="">اختر المحلية</option>{localities.map(loc => <option key={loc} value={loc}>{loc}</option>)}</Select> )}
            <Select label="المسمى الوظيفي" name="jobTitle" value={formData.jobTitle} onChange={onFormChange} required><option value="">اختر المسمى الوظيفي</option><option value="صحة عامة">صحة عامة</option><option value="طبيب">طبيب</option><option value="ممرض">ممرض</option><option value="ظابط تغذية">ظابط تغذية</option><option value="اخرى">اخرى</option></Select>
            {formData.jobTitle === 'اخرى' && <Input label="حدد المسمى الوظيفي" name="jobTitleOther" value={formData.jobTitleOther} onChange={onFormChange} required />}
            {level !== 'locality' && ( <Select label="الصفة" name="role" value={formData.role} onChange={onFormChange} required><option value="">اختر الصفة</option><option value="مدير البرنامج">مدير البرنامج</option><option value="رئيس وحدة">رئيس وحدة</option><option value="عضو في وحدة">عضو في وحدة</option><option value="سكرتارية">سكرتارية</option></Select> )}
            {level !== 'locality' && formData.role === 'مدير البرنامج' && <Input label="الرجاء تحديد تاريخ التعيين مدير للبرنامج" name="directorDate" type="date" value={formData.directorDate} onChange={onFormChange} required />}
            {level !== 'locality' && (formData.role === 'رئيس وحدة' || formData.role === 'عضو في وحدة') && (<Select label="اختر الوحدة" name="unit" value={formData.unit} onChange={onFormChange} required><option value="">اختر الوحدة</option><option value="العلاج المتكامل للاطفال اقل من 5 سنوات">العلاج المتكامل للاطفال اقل من 5 سنوات</option><option value="حديثي الولادة">حديثي الولادة</option><option value="المراهقين وحماية الاطفال">المراهقين وحماية الاطفال</option><option value="المتابعة والتقييم والمعلومات">المتابعة والتقييم والمعلومات</option><option value="الامداد">الامداد</option><option value="تعزيز صحة الاطفال والمراهقين">تعزيز صحة الاطفال والمراهقين</option></Select>)}
            {level !== 'locality' && <Input label={joinDateLabels[level] || 'تاريخ الانضمام'} name="joinDate" type="date" value={formData.joinDate} onChange={onFormChange} />}
            <DynamicExperienceFields experiences={formData.previousRoles} onChange={onDynamicFieldChange} />
            <Textarea label="اي تعليقات اخرى" name="comments" value={formData.comments} onChange={onFormChange} />
        </>
    );
}

// A single, configurable form for all team levels (internal use)
function TeamMemberForm({ member, onSave, onCancel }) {
    const [selectedLevel, setSelectedLevel] = useState(member?.level || (member ? (member.locality ? 'locality' : member.state ? 'state' : 'federal') : ''));
    const [formData, setFormData] = useState(() => {
        // --- MODIFIED: Added nameAr to default state ---
        const initialData = member || { 
            name: '', 
            nameAr: '', 
            phone: '', email: '', state: '', locality: '', jobTitle: '', jobTitleOther: '', role: '', directorDate: '', unit: '', joinDate: '', comments: '' 
        };
        if (!initialData.previousRoles || !Array.isArray(initialData.previousRoles) || initialData.previousRoles.length === 0) {
            initialData.previousRoles = [{ role: '', duration: '' }, { role: '', duration: '' }, { role: '', duration: '' }];
        }
        return initialData;
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newFormData = { ...formData, [name]: value };
        if (name === 'state') newFormData.locality = '';
        setFormData(newFormData);
    };
    const handlePreviousRolesChange = (newRoles) => setFormData(prev => ({ ...prev, previousRoles: newRoles }));
    const handleSubmit = (e) => {
        e.preventDefault();
        let payload = { ...formData };
        if (payload.jobTitle !== 'اخرى') payload.jobTitleOther = '';
        if (payload.role !== 'مدير البرنامج') payload.directorDate = '';
        if (payload.role !== 'رئيس وحدة' && payload.role !== 'عضو في وحدة') payload.unit = '';
        payload.previousRoles = payload.previousRoles.filter(exp => exp.role && exp.role.trim() !== '');
        onSave(selectedLevel, payload);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
            <CardBody>
                <h2 className="text-xl font-bold text-gray-800 text-center border-b pb-4 mb-6">{member?.id ? `Edit Team Member` : `Add New Team Member`}</h2>
                {!member?.id && ( <Select label="اختر المستوى" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} required><option value="">-- Select Level --</option><option value="federal">Federal</option><option value="state">State</option><option value="locality">Locality</option></Select> )}
                {selectedLevel && <MemberFormFieldset level={selectedLevel} formData={formData} onFormChange={handleChange} onDynamicFieldChange={handlePreviousRolesChange} />}
            </CardBody>
            {selectedLevel && (
                <CardFooter>
                    <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save</Button>
                </CardFooter>
            )}
        </form>
    );
}

// This component is now rendered inside a modal
function TeamMemberView({ level, member, onBack }) {
    const renderDetail = (label, value) => {
        if (!value) return null;
        return (
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                <dt className="text-sm font-medium text-gray-600">{label}</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value}</dd>
            </div>
        );
    };

    return (
        <>
            <CardBody>
                <PageHeader title="View Team Member Details" />
                <div className="border-t border-gray-200">
                    <dl className="divide-y divide-gray-200">
                        {/* --- MODIFIED: Added Arabic Name --- */}
                        {renderDetail('الإسم (باللغة الإنجليزية)', member.name)}
                        {renderDetail('الإسم (باللغة العربية)', member.nameAr)}

                        {renderDetail('رقم الهاتف', member.phone)}
                        {renderDetail('الايميل', member.email)}
                        {level !== 'federal' && renderDetail('الولاية', member.state)}
                        {level === 'locality' && renderDetail('المحلية', member.locality)}
                        {renderDetail('المسمى الوظيفي', member.jobTitle === 'اخرى' ? member.jobTitleOther : member.jobTitle)}
                        {level !== 'locality' && renderDetail('الصفة', member.role)}
                        {level !== 'locality' && member.role === 'مدير البرنامج' && renderDetail('تاريخ التعيين مدير للبرنامج', member.directorDate)}
                        {level !== 'locality' && (member.role === 'رئيس وحدة' || member.role === 'عضو في وحدة') && renderDetail('الوحدة', member.unit)}
                        {level !== 'locality' && renderDetail(level === 'federal' ? 'تاريخ الانضمام للبرنامج الاتحادي' : 'تاريخ الانضمام لبرنامج الولاية', member.joinDate)}
                        <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                            <dt className="text-sm font-medium text-gray-600">المهام الوظيفية والخبرات الاخرى</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                {Array.isArray(member.previousRoles) && member.previousRoles.some(e => e.role) ? (
                                    <ul className="list-disc pl-5 space-y-1">
                                        {member.previousRoles.map((exp, index) => (
                                            exp.role && <li key={index}><strong>{exp.role}</strong> ({exp.duration || 'N/A'})</li>
                                        ))}
                                    </ul>
                                ) : 'N/A'}
                            </dd>
                        </div>
                        {renderDetail('اي تعليقات اخرى', member.comments)}
                    </dl>
                </div>
            </CardBody>
            <CardFooter>
                <Button onClick={onBack}>Close</Button>
            </CardFooter>
        </>
    );
}

function PendingSubmissions({ submissions, isLoading, onApprove, onReject, onView }) {
    // --- MODIFIED: Added Arabic Name to Header ---
    const headers = ['Name (En)', 'Name (Ar)', 'Email', 'Actions'];
    if (isLoading) return <Card><Spinner /></Card>;
    
    return (
        <Card>
            <CardBody>
                <Table headers={headers}>
                    {submissions && submissions.length > 0 ? (
                        submissions.map(s => (
                            <tr key={s.id}>
                                <td className="p-4 text-sm">{s.name}</td>
                                {/* --- MODIFIED: Added Arabic Name to Row --- */}
                                <td className="p-4 text-sm">{s.nameAr || '-'}</td>
                                <td className="p-4 text-sm">{s.email}</td>
                                <td className="p-4 text-sm">
                                    <div className="flex gap-2">
                                        <Button variant="secondary" onClick={() => onView(s)}>View</Button>
                                        <Button variant="success" onClick={() => onApprove(s)}>Approve</Button>
                                        <Button variant="danger" onClick={() => onReject(s.id)}>Reject</Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={headers.length} className="p-8 text-center text-gray-500">
                                No pending submissions found.
                            </td>
                        </tr>
                    )}
                </Table>
            </CardBody>
        </Card>
    );
}


function LinkManagementModal({ isOpen, onClose, settings, isLoading, onToggleStatus }) {
    const [showLinkCopied, setShowLinkCopied] = useState(false);
    const link = `${window.location.origin}/public/team-member-application`;
    const handleCopyLink = () => navigator.clipboard.writeText(link).then(() => {
        setShowLinkCopied(true);
        setTimeout(() => setShowLinkCopied(false), 2500);
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Team Member Submission Link`}>
            {isLoading ? <Spinner /> : ( 
                <> 
                    <FormGroup label="Public URL">
                        <div className="relative">
                            <Input type="text" value={link} readOnly className="pr-24" />
                            <Button onClick={handleCopyLink} className="absolute right-1 top-1/2 -translate-y-1/2" variant="secondary" size="sm">
                                {showLinkCopied ? 'Copied!' : 'Copy'}
                            </Button>
                        </div>
                    </FormGroup>
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                            <div>Status: <span className={`font-bold px-2 py-1 rounded-full text-xs ml-2 ${settings.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{settings.isActive ? 'Active' : 'Inactive'}</span></div>
                            <div><span className="font-medium">Link Opened:</span> {settings.openCount || 0} times</div>
                        </div>
                        <Button variant={settings.isActive ? 'danger' : 'success'} onClick={onToggleStatus}>
                            {settings.isActive ? 'Deactivate Link' : 'Activate Link'}
                        </Button>
                    </div>
                </> 
            )}
        </Modal>
    );
}

// Helper function for role assignment
const updateUserRoleByEmail = async (email, newRole, state, locality) => {
    if (!email || !newRole) return; 

    try {
        // 1. Find the user by email
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`Role assignment skipped: No user found with email ${email}.`);
            return; 
        }

        const userDoc = querySnapshot.docs[0];
        const userRef = doc(db, "users", userDoc.id);
        const currentUserRole = userDoc.data().role;

        // Safety Check: Do not override a super_user's role
        if (currentUserRole === 'super_user') {
             console.warn(`Role assignment skipped: Cannot programmatically change the role of a Super User (${email}).`);
             return;
        }

        // 2. Prepare the update payload
        const newPermissions = DEFAULT_ROLE_PERMISSIONS[newRole] || DEFAULT_ROLE_PERMISSIONS['user'];
        const updatePayload = {
            role: newRole,
            permissions: applyDerivedPermissions({ ...ALL_PERMISSIONS, ...newPermissions })
        };

        // 3. Add state/locality assignments if needed
        if (newRole === 'states_manager' || newRole === 'state_coordinator') {
            updatePayload.assignedState = state || '';
            updatePayload.assignedLocality = ''; 
        } else if (newRole === 'locality_manager') {
            updatePayload.assignedState = state || '';
            updatePayload.assignedLocality = locality || '';
        }

        // 4. Update the user document
        await updateDoc(userRef, updatePayload);
        console.log(`Successfully updated role for ${email} to ${newRole}.`);

    } catch (error) {
        console.error(`Failed to update role for ${email}:`, error);
        throw new Error(`Failed to update user role: ${error.message}`);
    }
};


export function ProgramTeamView({ permissions, userStates }) {
    const {
        federalCoordinators,
        stateCoordinators,
        localityCoordinators,
        
        pendingFederalSubmissions,
        pendingStateSubmissions,
        pendingLocalitySubmissions,
        
        coordinatorApplicationSettings,
        
        isLoading,
        
        fetchFederalCoordinators,
        fetchStateCoordinators,
        fetchLocalityCoordinators,
        
        fetchPendingFederalSubmissions,
        fetchPendingStateSubmissions,
        fetchPendingLocalitySubmissions,
        
        fetchCoordinatorApplicationSettings,
    } = useDataCache();
    
    const [activeTab, setActiveTab] = useState('members');
    
    const isFederal = permissions.manageScope === 'federal' || permissions.canUseSuperUserAdvancedFeatures;

    const [filters, setFilters] = useState(() => {
        const initialState = {
            level: isFederal ? 'federal' : 'state',
            state: isFederal ? '' : (userStates[0] || ''), 
            locality: '',
        };
        return initialState;
    });

    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState(null); 
    const [editingMember, setEditingMember] = useState(null);
    
    const [shareModalInfo, setShareModalInfo] = useState({ isOpen: false, link: '' });

    const fetchersByLevel = useMemo(() => ({
        federal: {
            list: fetchFederalCoordinators,
            listPending: fetchPendingFederalSubmissions,
        },
        state: {
            list: fetchStateCoordinators,
            listPending: fetchPendingStateSubmissions,
        },
        locality: {
            list: fetchLocalityCoordinators,
            listPending: fetchPendingLocalitySubmissions,
        }
    }), [
        fetchFederalCoordinators, fetchPendingFederalSubmissions,
        fetchStateCoordinators, fetchPendingStateSubmissions,
        fetchLocalityCoordinators, fetchPendingLocalitySubmissions
    ]);

    const dataByLevel = useMemo(() => ({
        federal: {
            members: federalCoordinators,
            pending: pendingFederalSubmissions,
            loading: isLoading.federalCoordinators,
            pendingLoading: isLoading.pendingFederalSubmissions,
        },
        state: {
            members: stateCoordinators,
            pending: pendingStateSubmissions,
            loading: isLoading.stateCoordinators,
            pendingLoading: isLoading.pendingStateSubmissions,
        },
        locality: {
            members: localityCoordinators,
            pending: pendingLocalitySubmissions,
            loading: isLoading.localityCoordinators,
            pendingLoading: isLoading.pendingLocalitySubmissions,
        }
    }), [
        federalCoordinators, pendingFederalSubmissions, isLoading.federalCoordinators, isLoading.pendingFederalSubmissions,
        stateCoordinators, pendingStateSubmissions, isLoading.stateCoordinators, isLoading.pendingStateSubmissions,
        localityCoordinators, pendingLocalitySubmissions, isLoading.localityCoordinators, isLoading.pendingLocalitySubmissions
    ]);
    
    useEffect(() => {
        const level = filters.level;
        if (!level || !fetchersByLevel[level]) return;

        fetchersByLevel[level].list();

        if (permissions?.canApproveSubmissions) {
            fetchersByLevel[level].listPending();
        }
    }, [filters.level, permissions, fetchersByLevel]);


    const filteredMembers = useMemo(() => {
        if (!filters.level) return [];
        
        const { members, loading } = dataByLevel[filters.level];

        if (loading || !members) {
            return [];
        }
        
        let membersToFilter = [...members];

        if (!isFederal && userStates && userStates.length > 0) {
            membersToFilter = membersToFilter.filter(m => {
                if (filters.level === 'federal' || !m.state) return false;
                return userStates.includes(m.state);
            });
        }

        return membersToFilter.filter(m => {
            const stateMatch = !filters.state || m.state === filters.state;
            const localityMatch = !filters.locality || m.locality === filters.locality;
            return stateMatch && localityMatch;
        });
    }, [filters, isFederal, userStates, dataByLevel]);

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            if (filterName === 'level') {
                if (isFederal) {
                    newFilters.state = '';
                    newFilters.locality = '';
                } else {
                    newFilters.locality = ''; 
                }
            }
            if (filterName === 'state') {
                newFilters.locality = '';
            }
            return newFilters;
        });
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setModalMode(null);
        setEditingMember(null);
    };

    const handleAdd = () => {
        setEditingMember(null); 
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleEdit = (member) => {
        setEditingMember(member);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleView = (member) => {
        setEditingMember(member);
        setModalMode('view');
        setIsModalOpen(true);
    };
    
    const handleShare = (level, member) => {
        const link = `${window.location.origin}/public/profile/team/${level}/${member.id}`;
        setShareModalInfo({ isOpen: true, link: link });
    };

    const handleSave = async (level, payload) => {
        const upsertFnMap = {
            federal: upsertFederalCoordinator,
            state: upsertStateCoordinator,
            locality: upsertLocalityCoordinator,
        };
        try {
            const upsertFn = upsertFnMap[level];
            if (!upsertFn) throw new Error("Invalid save level selected.");

            await upsertFn({ ...payload, id: editingMember?.id });
            
            // After successful save, update the user's role
            let newRole = null;
            const roleFromForm = payload.role; 
            const isManagerOrHead = roleFromForm === 'مدير البرنامج' || roleFromForm === 'رئيس وحدة';

            if (level === 'federal') {
                newRole = isManagerOrHead ? 'federal_manager' : 'federal_coordinator';
            } else if (level === 'state') {
                newRole = isManagerOrHead ? 'states_manager' : 'state_coordinator';
            } else if (level === 'locality') {
                newRole = 'locality_manager';
            }

            if (newRole && payload.email) {
                try {
                    await updateUserRoleByEmail(
                        payload.email, 
                        newRole, 
                        payload.state, 
                        payload.locality
                    );
                } catch (roleError) {
                     alert(`Team member ${payload.name} was saved, but their system role could not be assigned automatically. Please assign their role manually in the Admin Dashboard. \n\nError: ${roleError.message}`);
                }
            }

            fetchersByLevel[level].list(true); 
            
            if (level !== filters.level) {
                handleFilterChange('level', level);
            }
            handleCloseModal(); 
        } catch (error) { 
            console.error("Error saving member:", error);
            alert(`Failed to save member. See console for details. \n\nError: ${error.message}`);
        }
    };
    
    const handleOpenLinkModal = async () => {
        setIsLinkModalOpen(true);
        fetchCoordinatorApplicationSettings();
    };

    const handleToggleLinkStatus = async () => {
        try {
            const newStatus = !coordinatorApplicationSettings.isActive;
            await updateCoordinatorApplicationStatus(newStatus);
            fetchCoordinatorApplicationSettings(true); 
        } catch (error) {
            console.error("Failed to update link status:", error);
        }
    };
    
    const handleApproveSubmission = async (submission) => {
        const approveFnMap = {
            federal: approveFederalSubmission,
            state: approveCoordinatorSubmission,
            locality: approveLocalitySubmission,
        };
        
        if (!filters.level) return;
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error("Cannot approve: No user is logged in.");
            alert("Error: You must be logged in to approve submissions.");
            return;
        }
        try {
            const approveFn = approveFnMap[filters.level];
            const approverInfo = { uid: currentUser.uid, email: currentUser.email, approvedAt: new Date() };
            
            // Role assignment logic ON APPROVAL
            let newRole = null;
            const roleFromForm = submission.role;
            const isManagerOrHead = roleFromForm === 'مدير البرنامج' || roleFromForm === 'رئيس وحدة';
            const level = filters.level; 

            if (level === 'federal') {
                newRole = isManagerOrHead ? 'federal_manager' : 'federal_coordinator';
            } else if (level === 'state') {
                newRole = isManagerOrHead ? 'states_manager' : 'state_coordinator';
            } else if (level === 'locality') {
                newRole = 'locality_manager';
            }

            await approveFn(submission, approverInfo);

            if (newRole && submission.email) {
                 try {
                    await updateUserRoleByEmail(
                        submission.email, 
                        newRole, 
                        submission.state, 
                        submission.locality
                    );
                 } catch (roleError) {
                     alert(`Team member ${submission.name} was approved, but their system role could not be assigned automatically. Please assign their role manually in the Admin Dashboard. \n\nError: ${roleError.message}`);
                 }
            }

            fetchersByLevel[filters.level].listPending(true); 
            fetchersByLevel[filters.level].list(true); 
            
        } catch (error) {
            console.error("Error approving submission:", error);
            alert(`Failed to approve submission. See console for details.`);
        }
    };

    const handleRejectSubmission = async (submissionId) => {
        const rejectFnMap = {
            federal: rejectFederalSubmission,
            state: rejectCoordinatorSubmission,
            locality: rejectLocalitySubmission,
        };
        
        if (!filters.level) return;
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error("Cannot reject: No user is logged in.");
            alert("Error: You must be logged in to reject submissions.");
            return;
        }
        if (window.confirm("Are you sure you want to reject this submission?")) {
            try {
                const rejectFn = rejectFnMap[filters.level];
                const rejecterInfo = { uid: currentUser.uid, email: currentUser.email, rejectedAt: new Date() };
                await rejectFn(submissionId, rejecterInfo);
                
                fetchersByLevel[filters.level].listPending(true); 

            } catch (error) {
                console.error("Error rejecting submission:", error);
                alert(`Failed to reject submission. See console for details.`);
            }
        }
    };
    
    // --- MODIFIED: Included 'الإسم (Ar)' in all headers ---
    const tableHeaders = {
        state: ['الإسم (En)', 'الإسم (Ar)', 'الايميل', 'الولاية', 'المسمى الوظيفي', 'الصفة', 'Actions'],
        federal: ['الإسم (En)', 'الإسم (Ar)', 'الايميل', 'المسمى الوظيفي', 'الصفة', 'Actions'],
        locality: ['الإسم (En)', 'الإسم (Ar)', 'الايميل', 'الولاية', 'المحلية', 'المسمى الوظيفي', 'Actions'],
    };
    
    const currentLevelData = dataByLevel[filters.level] || { members: null, pending: null, loading: true, pendingLoading: true };

    return (
        <div>
            <div className="mb-6 flex flex-wrap items-end gap-4">
                {activeTab === 'members' && (
                    <FormGroup label={'\u00A0'}>
                        {permissions.canManageHumanResource && <Button onClick={handleAdd}>Add New Team Member</Button>}
                    </FormGroup>
                )}
                <div className="flex flex-wrap items-end gap-4 flex-grow">
                    <FormGroup label="Filter by Level">
                        <Select value={filters.level} onChange={(e) => handleFilterChange('level', e.target.value)}>
                            {isFederal && <option value="federal">Federal</option>}
                            <option value="state">State</option>
                            <option value="locality">Locality</option>
                        </Select>
                    </FormGroup>
                    {(filters.level === 'state' || filters.level === 'locality') && (
                        <FormGroup label="State">
                            <Select value={filters.state} onChange={(e) => handleFilterChange('state', e.target.value)} disabled={!isFederal}>
                                <option value="">All States</option>
                                {Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </FormGroup>
                    )}
                    {filters.level === 'locality' && (
                        <FormGroup label="Locality">
                            <Select value={filters.locality} onChange={(e) => handleFilterChange('locality', e.target.value)} disabled={!filters.state}>
                                <option value="">All Localities</option>
                                {(STATE_LOCALITIES[filters.state]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                            </Select>
                        </FormGroup>
                    )}
                </div>
            </div>

            <div className="border-b border-gray-200 mb-6">
                 <div className="flex items-center gap-6">
                    <nav className="-mb-px flex items-center gap-6" aria-label="Tabs">
                        <Button variant="tab" isActive={activeTab === 'members'} onClick={() => setActiveTab('members')}>Team Members</Button>
                        {permissions?.canApproveSubmissions && (
                            <>
                                <Button variant="tab" isActive={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
                                    Pending Approvals 
                                    <span className="ml-2 bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                        {currentLevelData.pending ? currentLevelData.pending.length : 0}
                                    </span>
                                </Button>
                                <Button variant="secondary" size="sm" onClick={handleOpenLinkModal}>Manage Submission Link</Button>
                            </>
                        )}
                    </nav>
                </div>
            </div>
            
            {activeTab === 'members' ? ( 
                <Card>
                    <CardBody>
                        {currentLevelData.loading ? <Spinner /> : (
                            <Table headers={tableHeaders[filters.level]}>
                                {filteredMembers.length > 0 ? filteredMembers.map(c => (
                                    <tr key={c.id}>
                                        <td className="p-4 text-sm">{c.name}</td>
                                        {/* --- MODIFIED: Display Arabic Name --- */}
                                        <td className="p-4 text-sm">{c.nameAr || '-'}</td>

                                        <td className="p-4 text-sm">{c.email}</td>
                                        {filters.level !== 'federal' && <td className="p-4 text-sm">{c.state}</td>}
                                        {filters.level === 'locality' && <td className="p-4 text-sm">{c.locality}</td>}
                                        <td className="p-4 text-sm">{c.jobTitle === 'اخرى' ? c.jobTitleOther : c.jobTitle}</td>
                                        {filters.level !== 'locality' && <td className="p-4 text-sm">{c.role}</td>}
                                        <td className="p-4 text-sm">
                                            <div className="flex gap-2">
                                                <Button variant="secondary" onClick={() => handleView(c)}>View</Button>
                                                <Button variant="secondary" onClick={() => handleShare(filters.level, c)}>Share</Button>
                                                {permissions.canManageHumanResource && <Button onClick={() => handleEdit(c)}>Edit</Button>}
                                                {permissions.canManageHumanResource && <Button variant="danger" onClick={() => {}}>Delete</Button>}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={tableHeaders[filters.level]?.length} className="p-8 text-center text-gray-500">
                                            No team members found for the selected filters.
                                        </td>
                                    </tr>
                                )}
                            </Table>
                        )}
                    </CardBody>
                </Card>
            ) : (
                <PendingSubmissions 
                    submissions={currentLevelData.pending} 
                    isLoading={currentLevelData.pendingLoading} 
                    onApprove={handleApproveSubmission} 
                    onReject={handleRejectSubmission} 
                    onView={handleView} 
                />
            )}

            <LinkManagementModal 
                isOpen={isLinkModalOpen}
                onClose={() => setIsLinkModalOpen(false)}
                settings={coordinatorApplicationSettings}
                isLoading={isLoading.coordinatorApplicationSettings}
                onToggleStatus={handleToggleLinkStatus}
            />
            
            <ShareLinkModal
                isOpen={shareModalInfo.isOpen}
                onClose={() => setShareModalInfo({ isOpen: false, link: '' })}
                title="Share Team Member Profile"
                link={shareModalInfo.link}
            />

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} size={modalMode === 'view' ? '2xl' : '3xl'}>
                {modalMode === 'view' && editingMember && (
                    <TeamMemberView 
                        level={editingMember.level || filters.level} 
                        member={editingMember} 
                        onBack={handleCloseModal} 
                    />
                )}
                {modalMode === 'edit' && (
                    <TeamMemberForm 
                        member={editingMember} 
                        onSave={handleSave}
                        onCancel={handleCloseModal}
                    />
                )}
            </Modal>
        </div>
    );
}

export function TeamMemberApplicationForm() {
    const [formData, setFormData] = useState({
        name: '', 
        nameAr: '', // --- NEW
        phone: '', email: '', state: '', locality: '', jobTitle: '', jobTitleOther: '', 
        role: '', directorDate: '', unit: '', joinDate: '', comments: '',
        previousRoles: [{ role: '', duration: '' }, { role: '', duration: '' }, { role: '', duration: '' }],
        isUserEmail: false,
    });
    
    const [selectedLevel, setSelectedLevel] = useState(''); 
    
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [isLinkActive, setIsLinkActive] = useState(false);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isUpdate, setIsUpdate] = useState(false);

    useEffect(() => {
        const checkStatusAndIncrement = async () => {
            try {
                const settings = await getCoordinatorApplicationSettings(true); 
                
                if (settings.isActive) {
                    await incrementCoordinatorApplicationOpenCount();
                    setIsLinkActive(true);
                } else { 
                    setIsLinkActive(false); 
                }
            } catch (error) {
                console.error("Error checking application status:", error);
                setIsLinkActive(false);
            } finally { 
                setIsLoadingStatus(false); 
            }
        };

        checkStatusAndIncrement();
        
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && user.email) {
                setFormData(prev => ({ ...prev, email: user.email, isUserEmail: true }));
            }
        });

        return () => unsubscribe();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newFormData = { ...formData, [name]: value };
        if (name === 'state') newFormData.locality = '';
        setFormData(newFormData);
    };

    const handlePreviousRolesChange = (newRoles) => setFormData(prev => ({ ...prev, previousRoles: newRoles }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!selectedLevel) {
            setError('Please select an application level.');
            return;
        }

        // Basic validation
        if (!formData.name || !formData.email) {
            setError('Please fill in at least Name and Email.');
            return;
        }
        if (selectedLevel !== 'federal' && !formData.state) {
             setError('State is required for State and Locality levels.');
             return;
        }
        if (selectedLevel === 'locality' && !formData.locality) {
             setError('Locality is required for the Locality level.');
             return;
        }
        if (selectedLevel !== 'locality' && !formData.role) {
             setError('Role is required for Federal and State levels.');
             return;
        }

        setSubmitting(true);
        try {
            let payload = { ...formData };
            payload.previousRoles = payload.previousRoles.filter(exp => exp.role && exp.role.trim() !== '');
            delete payload.isUserEmail; 
            
            if (payload.jobTitle !== 'اخرى') payload.jobTitleOther = '';
            
            if (selectedLevel === 'federal') {
                 delete payload.state;
                 delete payload.locality;
                 if (payload.role !== 'مدير البرنامج') payload.directorDate = '';
                 if (payload.role !== 'رئيس وحدة' && payload.role !== 'عضو في وحدة') payload.unit = '';
            } else if (selectedLevel === 'state') {
                 delete payload.locality;
                 if (payload.role !== 'مدير البرنامج') payload.directorDate = '';
                 if (payload.role !== 'رئيس وحدة' && payload.role !== 'عضو في وحدة') payload.unit = '';
            } else if (selectedLevel === 'locality') {
                delete payload.role;
                delete payload.directorDate;
                delete payload.unit;
                delete payload.joinDate; 
            }

            const submitFnMap = {
                federal: submitFederalApplication,
                state: submitCoordinatorApplication,
                locality: submitLocalityApplication,
            };
            const upsertFnMap = {
                federal: upsertFederalCoordinator,
                state: upsertStateCoordinator,
                locality: upsertLocalityCoordinator,
            };

            if (payload.id && isUpdate) {
                const upsertFn = upsertFnMap[selectedLevel];
                if (!upsertFn) throw new Error(`Invalid update level: ${selectedLevel}`);
                await upsertFn(payload);
            } else {
                const submitFn = submitFnMap[selectedLevel];
                if (!submitFn) throw new Error(`Invalid application level: ${selectedLevel}`);
                await submitFn(payload);
            }
            
            setSubmitted(true);
        } catch (err) {
            console.error("Submission failed:", err);
            setError("There was an error submitting your information. Please try again later.");
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoadingStatus) return <Card><CardBody><div className="flex justify-center p-8"><Spinner /></div></CardBody></Card>;
    
    if (!isLinkActive) {
        return (
            <Card>
                <PageHeader title="Program Team Application" />
                <CardBody>
                    <EmptyState message="Submissions for new team members are currently closed." />
                </CardBody>
            </Card>
        );
    }
    
    if (submitted) {
        const title = isUpdate ? "Profile Updated" : "Submission Received";
        const message = isUpdate 
            ? "Your profile has been updated successfully."
            : "Your information has been submitted successfully for review.";
            
        return (
            <Card>
                <PageHeader title={title} />
                <CardBody>
                    <div className="p-8 text-center">
                        <h3 className="text-2xl font-bold text-green-600 mb-4">Thank You!</h3>
                        <p className="text-gray-700">{message}</p>
                    </div>
                </CardBody>
            </Card>
        );
    }

    const levelNames = {
        federal: "Federal Level (اتحادي)",
        state: "State Level (ولائي)",
        locality: "Locality Level (محلي)"
    };

    return (
        <Card>
            <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
                <CardBody>
                    <PageHeader 
                        title={isUpdate ? "Update Your Program Team Profile" : "Program Team Application"}
                        subtitle={isUpdate ? `Please review and update your information for the ${levelNames[selectedLevel] || ''}.` : "Please select your application level to begin."} 
                    />
                    {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                    
                    {!selectedLevel && !isUpdate && (
                        <div className="space-y-4 p-4 border rounded-md">
                             <FormGroup label="اختر المستوى الذي تتقدم إليه" dir="rtl">
                                <Select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} required>
                                    <option value="">-- اختر المستوى --</option>
                                    <option value="federal">Federal (اتحادي)</option>
                                    <option value="state">State (ولائي)</option>
                                    <option value="locality">Locality (محلي)</option>
                                </Select>
                            </FormGroup>
                        </div>
                    )}
                    
                    {selectedLevel && (
                        <div className="space-y-4">
                            <div className="p-2 bg-sky-50 border border-sky-200 rounded-md">
                                <p className="text-center font-semibold text-sky-800">
                                    أنت تملأ استمارة التقديم لـ: {levelNames[selectedLevel]}
                                </p>
                            </div>
                            <MemberFormFieldset 
                                level={selectedLevel} 
                                formData={formData} 
                                onFormChange={handleChange} 
                                onDynamicFieldChange={handlePreviousRolesChange} 
                            />
                        </div>
                    )}
                </CardBody>

                {selectedLevel && (
                    <CardFooter>
                         <Button type="submit" disabled={submitting}>
                            {submitting ? 'Submitting...' : (isUpdate ? 'Update Profile' : 'Submit Application')}
                        </Button>
                    </CardFooter>
                )}
            </form>
        </Card>
    );
}

export function PublicTeamMemberProfileView({ member, level }) {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const publicLink = window.location.href;

    const renderDetail = (label, value) => {
        if (!value) return null;
        return (
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                <dt className="text-sm font-medium text-gray-600">{label}</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value}</dd>
            </div>
        );
    };

    const levelName = level.charAt(0).toUpperCase() + level.slice(1);

    return (
        <Card>
            <ShareLinkModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                title="Share Team Member Profile"
                link={publicLink}
            />

            <PageHeader 
                title={`${levelName} Team Member Profile`} 
                subtitle={member.name}
                actions={
                    <Button variant="secondary" onClick={() => setIsShareModalOpen(true)}>
                        Share
                    </Button>
                }
            />
            <CardBody>
                <div className="border-t border-gray-200">
                    <dl className="divide-y divide-gray-200">
                        {/* --- MODIFIED: Added Arabic Name --- */}
                        {renderDetail('الإسم (باللغة الإنجليزية)', member.name)}
                        {renderDetail('الإسم (باللغة العربية)', member.nameAr)}

                        {renderDetail('رقم الهاتف', member.phone)}
                        {renderDetail('الايميل', member.email)}
                        {level !== 'federal' && renderDetail('الولاية', member.state)}
                        {level === 'locality' && renderDetail('المحلية', member.locality)}
                        {renderDetail('المسمى الوظيفي', member.jobTitle === 'اخرى' ? member.jobTitleOther : member.jobTitle)}
                        {level !== 'locality' && renderDetail('الصفة', member.role)}
                        {level !== 'locality' && member.role === 'مدير البرنامج' && renderDetail('تاريخ التعيين مدير للبرنامج', member.directorDate)}
                        {level !== 'locality' && (member.role === 'رئيس وحدة' || member.role === 'عضو في وحدة') && renderDetail('الوحدة', member.unit)}
                        {level !== 'locality' && renderDetail(level === 'federal' ? 'تاريخ الانضمام للبرنامج الاتحادي' : 'تاريخ الانضمام لبرنامج الولاية', member.joinDate)}
                        <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5">
                            <dt className="text-sm font-medium text-gray-600">المهام الوظيفية والخبرات الاخرى</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                {Array.isArray(member.previousRoles) && member.previousRoles.some(e => e.role) ? (
                                    <ul className="list-disc pl-5 space-y-1">
                                        {member.previousRoles.map((exp, index) => (
                                            exp.role && <li key={index}><strong>{exp.role}</strong> ({exp.duration || 'N/A'})</li>
                                        ))}
                                    </ul>
                                ) : 'N/A'}
                            </dd>
                        </div>
                        {renderDetail('اي تعليقات اخرى', member.comments)}
                    </dl>
                </div>
            </CardBody>
        </Card>
    );
}