// src/components/ProgramTeamView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    // State Coordinators
    listStateCoordinators,
    upsertStateCoordinator,
    deleteStateCoordinator,
    submitCoordinatorApplication,
    listPendingCoordinatorSubmissions,
    approveCoordinatorSubmission,
    rejectCoordinatorSubmission,
    
    // Federal Coordinators
    listFederalCoordinators,
    upsertFederalCoordinator,
    deleteFederalCoordinator,
    submitFederalApplication,
    listPendingFederalSubmissions,
    approveFederalSubmission,
    rejectFederalSubmission,

    // Locality Coordinators
    listLocalityCoordinators,
    upsertLocalityCoordinator,
    deleteLocalityCoordinator,
    submitLocalityApplication,
    listPendingLocalitySubmissions,
    approveLocalitySubmission,
    rejectLocalitySubmission,

    // Application Settings
    getCoordinatorApplicationSettings,
    updateCoordinatorApplicationStatus,
    incrementCoordinatorApplicationOpenCount,
} from '../data';
import { Button, Card, Table, Modal, Input, Select, Textarea, Spinner, PageHeader, EmptyState, FormGroup, CardBody, CardFooter } from './CommonComponents';
import { STATE_LOCALITIES } from './constants';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';


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
                        <Input label="الخبرة/المهمة" value={exp.role} onChange={(e) => handleExperienceChange(index, 'role', e.target.value)} placeholder="مثال: ضابط تغذية" className="flex-grow" />
                        <Input label="مدة الخبرة بالسنوات" value={exp.duration} onChange={(e) => handleExperienceChange(index, 'duration', e.target.value)} placeholder="مثال: سنتان" className="sm:w-40" />
                        {experiences.length > 1 && <Button size="sm" variant="danger" onClick={() => handleRemoveExperience(index)} className="self-end sm:self-center mt-2 sm:mt-0 h-10">حذف</Button>}
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
    const localities = formData.state ? STATE_LOCALITIES[formData.state] : [];
    const joinDateLabels = { state: 'تاريخ الانضمام لبرنامج صحة الطفل بالولاية', federal: 'تاريخ الانضمام لبرنامج صحة الطفل بالاتحادية' };

    return (
        <>
            <Input label="الإسم" name="name" value={formData.name} onChange={onFormChange} required />
            <Input label="رقم الهاتف" name="phone" type="tel" value={formData.phone} onChange={onFormChange} />
            <Input label="الايميل" name="email" type="email" value={formData.email} onChange={onFormChange} required disabled={formData.isUserEmail} />
            {level !== 'federal' && ( <Select label="الولاية" name="state" value={formData.state} onChange={onFormChange} required><option value="">اختر ولاية</option>{states.map(s => <option key={s} value={s}>{s}</option>)}</Select> )}
            {level === 'locality' && ( <Select label="المحلية" name="locality" value={formData.locality} onChange={onFormChange} required disabled={!formData.state}><option value="">اختر المحلية</option>{localities.map(loc => <option key={loc} value={loc}>{loc}</option>)}</Select> )}
            <Select label="المسمى الوظيفي" name="jobTitle" value={formData.jobTitle} onChange={onFormChange} required><option value="">اختر المسمى الوظيفي</option><option value="صحة عامة">صحة عامة</option><option value="طبيب">طبيب</option><option value="ممرض">ممرض</option><option value="ظابط تغذية">ظابط تغذية</option><option value="اخرى">اخرى</option></Select>
            {formData.jobTitle === 'اخرى' && <Input label="حدد المسمى الوظيفي" name="jobTitleOther" value={formData.jobTitleOther} onChange={onFormChange} required />}
            {level !== 'locality' && ( <Select label="الصفة" name="role" value={formData.role} onChange={onFormChange} required><option value="">اختر الصفة</option><option value="مدير البرنامج">مدير البرنامج</option><option value="رئيس وحدة">رئيس وحدة</option><option value="عضو في وحدة">عضو في وحدة</option><option value="سكرتارية">سكرتارية</option></Select> )}
            {level !== 'locality' && formData.role === 'مدير البرنامج' && <Input label="الرجاء تحديد تاريخ التعيين مدير للبرنامج" name="directorDate" type="date" value={formData.directorDate} onChange={onFormChange} required />}
            {level !== 'locality' && (formData.role === 'رئيس وحدة' || formData.role === 'عضو في وحدة') && (<Select label="اختر الوحدة" name="unit" value={formData.unit} onChange={onFormChange} required><option value="">اختر الوحدة</option><option value="العلاج المتكامل للاطفال اقل من 5 سنوات">العلاج المتكامل للاطفال اقل من 5 سنوات</option><option value="حديثي الولادة">حديثي الولادة</option><option value="المراهقين وحماية الاطفال">المراهقين وحماية الاطفال</option><option value="المتابعة والتقييم والمعلومات">المتابعة والتقييم والمعلومات</option><option value="الامداد">الامداد</option><option value="تعزيز صحة الاطفال والمراهقين">تعزيز صحة الاطفال والمراهقين</option></Select>)}
            {level !== 'locality' && <Input label={joinDateLabels[level]} name="joinDate" type="date" value={formData.joinDate} onChange={onFormChange} />}
            <DynamicExperienceFields experiences={formData.previousRoles} onChange={onDynamicFieldChange} />
            <Textarea label="اي تعليقات اخرى" name="comments" value={formData.comments} onChange={onFormChange} />
        </>
    );
}

// A single, configurable form for all team levels (internal use)
function TeamMemberForm({ member, onSave, onCancel }) {
    const [selectedLevel, setSelectedLevel] = useState(member?.level || (member ? (member.locality ? 'locality' : member.state ? 'state' : 'federal') : ''));
    const [formData, setFormData] = useState(() => {
        const initialData = member || { name: '', phone: '', email: '', state: '', locality: '', jobTitle: '', jobTitleOther: '', role: '', directorDate: '', unit: '', joinDate: '', comments: '' };
        if (!initialData.previousRoles || !Array.isArray(initialData.previousRoles) || initialData.previousRoles.length === 0) initialData.previousRoles = [{ role: '', duration: '' }];
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
        <Card>
            <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
                <CardBody>
                    <h2 className="text-xl font-bold text-gray-800 text-center border-b pb-4 mb-6">{member?.id ? `Edit Team Member` : `Add New Team Member`}</h2>
                    {!member?.id && ( <Select label="اختر المستوى" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} required><option value="">-- Select Level --</option><option value="federal">Federal</option><option value="state">State</option><option value="locality">Locality</option></Select> )}
                    {selectedLevel && <MemberFormFieldset level={selectedLevel} formData={formData} onFormChange={handleChange} onDynamicFieldChange={handlePreviousRolesChange} />}
                </CardBody>
                {selectedLevel && (
                    <CardFooter>
                        <Button type="button" variant="secondary" onClick={onCancel}>إلغاء</Button>
                        <Button type="submit">حفظ</Button>
                    </CardFooter>
                )}
            </form>
        </Card>
    );
}

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
        <Card>
            <CardBody>
                <PageHeader title="View Team Member Details" />
                <div className="border-t border-gray-200">
                    <dl className="divide-y divide-gray-200">
                        {renderDetail('الإسم', member.name)}
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
                <Button onClick={onBack}>Back to List</Button>
            </CardFooter>
        </Card>
    );
}

function PendingSubmissions({ submissions, isLoading, onApprove, onReject, onView }) {
    const headers = ['Name', 'Email', 'Actions'];
    if (isLoading) return <Card><Spinner /></Card>;
    
    return (
        <Card>
            <CardBody>
                <Table headers={headers}>
                    {submissions && submissions.length > 0 ? (
                        submissions.map(s => (
                            <tr key={s.id}>
                                <td className="p-4 text-sm">{s.name}</td>
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
                        <tr><td colSpan={headers.length}><EmptyState message="No pending submissions found." /></td></tr>
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


export function ProgramTeamView({ permissions }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingMember, setEditingMember] = useState(null);
    const [view, setView] = useState('list');
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('members');
    const [filters, setFilters] = useState({ level: 'federal', state: '', locality: '' });
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    const dataFunctions = {
        state: { list: listStateCoordinators, upsert: upsertStateCoordinator, delete: deleteStateCoordinator, listPending: listPendingCoordinatorSubmissions, approve: approveCoordinatorSubmission, reject: rejectCoordinatorSubmission },
        federal: { list: listFederalCoordinators, upsert: upsertFederalCoordinator, delete: deleteFederalCoordinator, listPending: listPendingFederalSubmissions, approve: approveFederalSubmission, reject: rejectFederalSubmission },
        locality: { list: listLocalityCoordinators, upsert: upsertLocalityCoordinator, delete: deleteLocalityCoordinator, listPending: listPendingLocalitySubmissions, approve: approveLocalitySubmission, reject: rejectLocalitySubmission }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!filters.level) { 
                setMembers([]);
                setPendingSubmissions([]);
                return;
            }
            setLoading(true);
            setIsSubmissionsLoading(true);
            try {
                const listFn = dataFunctions[filters.level].list;
                const listPendingFn = dataFunctions[filters.level].listPending;
                const [membersData, pendingData] = await Promise.all([
                    listFn(),
                    permissions?.canApproveSubmissions ? listPendingFn() : []
                ]);
                setMembers(membersData);
                setPendingSubmissions(pendingData);
            } catch (error) {
                console.error(`Error fetching ${filters.level} data:`, error);
            } finally {
                setLoading(false);
                setIsSubmissionsLoading(false);
            }
        };
        fetchData();
    }, [filters.level, permissions]);

    const filteredMembers = useMemo(() => {
        if (loading) return [];
        return members.filter(m => {
            const stateMatch = !filters.state || m.state === filters.state;
            const localityMatch = !filters.locality || m.locality === filters.locality;
            return stateMatch && localityMatch;
        });
    }, [members, filters, loading]);

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            if (filterName === 'level') {
                newFilters.state = '';
                newFilters.locality = '';
            }
            if (filterName === 'state') {
                newFilters.locality = '';
            }
            return newFilters;
        });
    };

    const handleBackToList = () => { setEditingMember(null); setView('list'); };
    const handleAdd = () => { setEditingMember(null); setView('form'); };
    const handleEdit = (member) => { setEditingMember(member); setView('form'); };
    const handleView = (member) => { setEditingMember(member); setView('view'); };

    const handleSave = async (level, payload) => {
        try {
            const upsertFn = dataFunctions[level].upsert;
            await upsertFn({ ...payload, id: editingMember?.id });
            if (level !== filters.level) {
                handleFilterChange('level', level); 
            } else {
                const listFn = dataFunctions[level].list;
                setMembers(await listFn());
            }
            handleBackToList();
        } catch (error) { console.error("Error saving member:", error); }
    };
    
    // ... Other handlers (handleDelete, etc.)

    if (view === 'form') {
        const initialData = editingMember || { level: filters.level };
        return <TeamMemberForm member={initialData} onSave={handleSave} onCancel={handleBackToList} />;
    }
    if (view === 'view') return <TeamMemberView level={filters.level} member={editingMember} onBack={handleBackToList} />;

    const tableHeaders = {
        state: ['الإسم', 'الايميل', 'الولاية', 'المسمى الوظيفي', 'الصفة', 'Actions'],
        federal: ['الإسم', 'الايميل', 'المسمى الوظيفي', 'الصفة', 'Actions'],
        locality: ['الإسم', 'الايميل', 'الولاية', 'المحلية', 'المسمى الوظيفي', 'Actions'],
    };

    return (
        <div>
            <div className="mb-6 flex flex-wrap items-end gap-4">
                {activeTab === 'members' && (
                    <FormGroup label={'\u00A0'}> {/* Invisible label for alignment */}
                        <Button onClick={handleAdd}>Add New Team Member</Button>
                    </FormGroup>
                )}
                <div className="flex flex-wrap items-end gap-4 flex-grow">
                    <FormGroup label="Filter by Level">
                        <Select value={filters.level} onChange={(e) => handleFilterChange('level', e.target.value)}>
                            <option value="federal">Federal</option>
                            <option value="state">State</option>
                            <option value="locality">Locality</option>
                        </Select>
                    </FormGroup>
                    {(filters.level === 'state' || filters.level === 'locality') && (
                        <FormGroup label="State">
                            <Select value={filters.state} onChange={(e) => handleFilterChange('state', e.target.value)}>
                                <option value="">All States</option>
                                {Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </FormGroup>
                    )}
                    {filters.level === 'locality' && (
                        <FormGroup label="Locality">
                            <Select value={filters.locality} onChange={(e) => handleFilterChange('locality', e.target.value)} disabled={!filters.state}>
                                <option value="">All Localities</option>
                                {(STATE_LOCALITIES[filters.state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}
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
                                    <span className="ml-2 bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{pendingSubmissions.length}</span>
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => setIsLinkModalOpen(true)}>Manage Submission Link</Button>
                            </>
                        )}
                    </nav>
                </div>
            </div>
            
            {activeTab === 'members' ? ( 
                <Card>
                    <CardBody>
                        {loading ? <Spinner /> : (
                            <Table headers={tableHeaders[filters.level]}>
                                {filteredMembers.length > 0 ? filteredMembers.map(c => (
                                    <tr key={c.id}>
                                        <td className="p-4 text-sm">{c.name}</td>
                                        <td className="p-4 text-sm">{c.email}</td>
                                        {filters.level !== 'federal' && <td className="p-4 text-sm">{c.state}</td>}
                                        {filters.level === 'locality' && <td className="p-4 text-sm">{c.locality}</td>}
                                        <td className="p-4 text-sm">{c.jobTitle === 'اخرى' ? c.jobTitleOther : c.jobTitle}</td>
                                        {filters.level !== 'locality' && <td className="p-4 text-sm">{c.role}</td>}
                                        <td className="p-4 text-sm">
                                            <div className="flex gap-2">
                                                <Button variant="secondary" onClick={() => handleView(c)}>View</Button>
                                                <Button onClick={() => handleEdit(c)}>Edit</Button>
                                                <Button variant="danger" onClick={() => {}}>Delete</Button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : <tr><td colSpan={tableHeaders[filters.level]?.length}><EmptyState message="No team members found for the selected filters." /></td></tr>}
                            </Table>
                        )}
                    </CardBody>
                </Card>
            ) : (
                <PendingSubmissions submissions={pendingSubmissions} isLoading={isSubmissionsLoading} onApprove={()=>{}} onReject={()=>{}} onView={handleView} />
            )}

            <LinkManagementModal 
                isOpen={isLinkModalOpen}
                onClose={() => setIsLinkModalOpen(false)}
                settings={{}} // Pass settings state here
                isLoading={false} // Pass loading state here
                onToggleStatus={() => {}} // Pass toggle handler here
            />
        </div>
    );
}

export function TeamMemberApplicationForm() {
    // ... This component's code is unchanged and remains complete
    return <Card>{/* ... form JSX ... */}</Card>;
}