// src/components/ProgramTeamView.jsx
import React, { useState, useEffect } from 'react';
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
import { Button, Card, Table, Modal, Input, Select, Textarea, Spinner, PageHeader, EmptyState, FormGroup } from './CommonComponents';
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
        <FormGroup label="المهام الوظيفية والخبرات الاخرى قبل الانضمام لبرنامج صحة الطفل">
            <div className="space-y-4">
                {experiences.map((exp, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2 p-3 border rounded-md">
                        <Input label="الخبرة/المهمة" value={exp.role} onChange={(e) => handleExperienceChange(index, 'role', e.target.value)} placeholder="مثال: ضابط تغذية" className="flex-grow" />
                        <Input label="مدة الخبرة بالسنوات" value={exp.duration} onChange={(e) => handleExperienceChange(index, 'duration', e.target.value)} placeholder="مثال: سنتان" className="sm:w-40" />
                        {experiences.length > 1 && <Button type="button" variant="danger" onClick={() => handleRemoveExperience(index)} className="self-end sm:self-center mt-2 sm:mt-6 h-10">Remove</Button>}
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
    const [selectedLevel, setSelectedLevel] = useState(member ? (member.locality ? 'locality' : member.state ? 'state' : 'federal') : '');
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
                <h2 className="text-xl font-bold text-gray-800 text-center border-b pb-4 mb-6">{member ? `Edit Team Member` : `Add New Team Member`}</h2>
                {!member && ( <Select label="اختر المستوى" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} required><option value="">-- Select Level --</option><option value="federal">Federal</option><option value="state">State</option><option value="locality">Locality</option></Select> )}
                {selectedLevel && <MemberFormFieldset level={selectedLevel} formData={formData} onFormChange={handleChange} onDynamicFieldChange={handlePreviousRolesChange} />}
                {selectedLevel && <div className="flex justify-end gap-2 pt-6 border-t"><Button type="button" variant="secondary" onClick={onCancel}>إلغاء</Button><Button type="submit">حفظ</Button></div>}
            </form>
        </Card>
    );
}

function TeamMemberView({ level, member, onBack }) {
    const renderDetail = (label, value) => {
        if (!value) return null;
        return (
            <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-gray-500">{label}</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value}</dd>
            </div>
        );
    };

    return (
        <Card>
            <PageHeader title="View Team Member Details" />
            <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                <dl className="sm:divide-y sm:divide-gray-200">
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
                    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">المهام الوظيفية والخبرات الاخرى</dt>
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
            <div className="flex justify-end pt-6 border-t mt-4">
                <Button onClick={onBack}>Back to List</Button>
            </div>
        </Card>
    );
}

function PendingSubmissions({ submissions, isLoading, onApprove, onReject, onView }) {
    const headers = ['Name', 'Email', 'Actions'];
    if (isLoading) return <Card><Spinner /></Card>;
    
    return (
        <Card>
            <Table headers={headers}>
                {submissions && submissions.length > 0 ? (
                    submissions.map(s => (
                        <tr key={s.id}>
                            <td>{s.name}</td>
                            <td>{s.email}</td>
                            <td>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="info" onClick={() => onView(s)}>View</Button>
                                    <Button size="sm" variant="success" onClick={() => onApprove(s)}>Approve</Button>
                                    <Button size="sm" variant="danger" onClick={() => onReject(s.id)}>Reject</Button>
                                </div>
                            </td>
                        </tr>
                    ))
                ) : (
                    <EmptyState message="No pending submissions found." colSpan={headers.length} />
                )}
            </Table>
        </Card>
    );
}


function LinkManagementModal({ isOpen, onClose, settings, isLoading, onToggleStatus, level }) {
    const [showLinkCopied, setShowLinkCopied] = useState(false);
    // FIX: Renamed coordinator-application to team-member-application
    const link = `${window.location.origin}/public/team-member-application?level=${level}`;
    const handleCopyLink = () => navigator.clipboard.writeText(link).then(() => {
        setShowLinkCopied(true);
        setTimeout(() => setShowLinkCopied(false), 2500);
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage ${level.charAt(0).toUpperCase() + level.slice(1)} Submission Link`}>
            <div className="p-6 space-y-6">
                {isLoading ? <Spinner /> : ( <> <FormGroup label="Public URL"><div className="relative"><Input type="text" value={link} readOnly className="pr-24" /><Button onClick={handleCopyLink} className="absolute right-1 top-1/2 -translate-y-1/2" variant="secondary">{showLinkCopied ? 'Copied!' : 'Copy'}</Button></div></FormGroup><div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg"><div className="flex items-center gap-4"><div>Status: <span className={`font-bold px-2 py-1 rounded-full text-xs ml-2 ${settings.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{settings.isActive ? 'Active' : 'Inactive'}</span></div><div><span className="font-medium">Link Opened:</span> {settings.openCount || 0} times</div></div><Button variant={settings.isActive ? 'danger' : 'success'} onClick={onToggleStatus}>{settings.isActive ? 'Deactivate Link' : 'Activate Link'}</Button></div></> )}
            </div>
        </Modal>
    );
}


// FIX: Renamed component from StateCoordinatorPage to ProgramTeamView
export function ProgramTeamView({ permissions }) {
    const [teamLevel, setTeamLevel] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [viewingMember, setViewingMember] = useState(null);
    const [linkSettings, setLinkSettings] = useState({ isActive: false, openCount: 0 });
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [view, setView] = useState('list');
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('members');

    const dataFunctions = {
        state: { list: listStateCoordinators, upsert: upsertStateCoordinator, delete: deleteStateCoordinator, listPending: listPendingCoordinatorSubmissions, approve: approveCoordinatorSubmission, reject: rejectCoordinatorSubmission },
        federal: { list: listFederalCoordinators, upsert: upsertFederalCoordinator, delete: deleteFederalCoordinator, listPending: listPendingFederalSubmissions, approve: approveFederalSubmission, reject: rejectFederalSubmission },
        locality: { list: listLocalityCoordinators, upsert: upsertLocalityCoordinator, delete: deleteLocalityCoordinator, listPending: listPendingLocalitySubmissions, approve: approveLocalitySubmission, reject: rejectLocalitySubmission }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!teamLevel) { setMembers([]); setPendingSubmissions([]); return; }
            setLoading(true); setIsSubmissionsLoading(true);
            try {
                const listFn = dataFunctions[teamLevel].list;
                const listPendingFn = dataFunctions[teamLevel].listPending;
                const [membersData, pendingData] = await Promise.all([listFn(), permissions?.canApproveSubmissions ? listPendingFn() : []]);
                setMembers(membersData); setPendingSubmissions(pendingData);
            } catch (error) { console.error(`Error fetching ${teamLevel} data:`, error); } finally { setLoading(false); setIsSubmissionsLoading(false); }
        };
        const fetchLinkSettings = async () => {
            if (teamLevel && permissions?.canApproveSubmissions) {
                setIsLoadingSettings(true);
                try { const settings = await getCoordinatorApplicationSettings(teamLevel); setLinkSettings(settings); } 
                catch (error) { console.error("Error fetching link settings:", error); } 
                finally { setIsLoadingSettings(false); }
            }
        };
        fetchData();
        fetchLinkSettings();
    }, [teamLevel, permissions]);

    const handleBackToList = () => { setEditingMember(null); setViewingMember(null); setView('list'); };
    const handleAdd = () => { setEditingMember(null); setView('form'); };
    const handleEdit = (member) => { setEditingMember(member); setView('form'); };
    const handleView = (member) => { setViewingMember(member); setView('view'); };

    const handleToggleLinkStatus = async () => {
        if (!teamLevel) return;
        setIsLoadingSettings(true);
        try {
            const newStatus = !linkSettings.isActive;
            await updateCoordinatorApplicationStatus(teamLevel, newStatus);
            const updatedSettings = await getCoordinatorApplicationSettings(teamLevel);
            setLinkSettings(updatedSettings);
        } catch (error) { console.error("Error toggling link status:", error); } 
        finally { setIsLoadingSettings(false); }
    };

    const handleSave = async (level, payload) => {
        try {
            const upsertFn = dataFunctions[level].upsert;
            await upsertFn({ ...payload, id: editingMember?.id });
            if (level !== teamLevel) setTeamLevel(level);
            else { const listFn = dataFunctions[level].list; setMembers(await listFn()); }
            handleBackToList();
        } catch (error) { console.error("Error saving member:", error); }
    };
    
    const handleDelete = async (memberId) => { if (window.confirm('Are you sure you want to delete this team member?')) { try { const deleteFn = dataFunctions[teamLevel].delete; await deleteFn(memberId); const listFn = dataFunctions[teamLevel].list; setMembers(await listFn()); } catch (error) { console.error("Error deleting member:", error); } } };
    const handleApprove = async (submission) => { if(window.confirm(`Approve ${submission.name}?`)) { try { const approveFn = dataFunctions[teamLevel].approve; await approveFn(submission, auth.currentUser?.email); const listFn = dataFunctions[teamLevel].list; const listPendingFn = dataFunctions[teamLevel].listPending; setMembers(await listFn()); setPendingSubmissions(await listPendingFn()); } catch (error) { console.error("Error approving submission:", error); } } };
    const handleReject = async (submissionId) => { if(window.confirm('Are you sure you want to reject this submission?')) { try { const rejectFn = dataFunctions[teamLevel].reject; await rejectFn(submissionId, auth.currentUser?.email); const listPendingFn = dataFunctions[teamLevel].listPending; setPendingSubmissions(await listPendingFn()); } catch (error) { console.error("Error rejecting submission:", error); } } };

    if (view === 'form') return <TeamMemberForm member={editingMember} onSave={handleSave} onCancel={handleBackToList} />;
    if (view === 'view') return <TeamMemberView level={teamLevel} member={viewingMember} onBack={handleBackToList} />;

    const tableHeaders = {
        state: ['الإسم', 'الايميل', 'الولاية', 'المسمى الوظيفي', 'الصفة', 'Actions'],
        federal: ['الإسم', 'الايميل', 'المسمى الوظيفي', 'الصفة', 'Actions'],
        locality: ['الإسم', 'الايميل', 'الولاية', 'المحلية', 'المسمى الوظيفي', 'Actions'],
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <PageHeader title="Manage Child Health Program Teams" subtitle="Select a team level to begin management." />
                {teamLevel && permissions?.canApproveSubmissions && ( <Button variant="info" onClick={() => setIsLinkModalOpen(true)}>Manage Submission Link</Button> )}
            </div>
            <div className="flex justify-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <Button onClick={() => setTeamLevel('state')} variant={teamLevel === 'state' ? 'primary' : 'secondary'}>معلومات فريق صحة الطفل في الولاية</Button>
                <Button onClick={() => setTeamLevel('federal')} variant={teamLevel === 'federal' ? 'primary' : 'secondary'}>معلومات فريق صحة الطفل بالاتحادية</Button>
                <Button onClick={() => setTeamLevel('locality')} variant={teamLevel === 'locality' ? 'primary' : 'secondary'}>معلومات فريق صحة الطفل بالمحلية</Button>
            </div>

            {!teamLevel ? ( <Card><div className="text-center py-12 text-gray-500"><p>Please select a team level above to continue.</p></div></Card> ) : ( <div><div className="border-b border-gray-200 mb-6 flex justify-between items-center"><nav className="-mb-px flex gap-6" aria-label="Tabs"><Button variant="tab" isActive={activeTab === 'members'} onClick={() => setActiveTab('members')}>Team Members</Button>{permissions?.canApproveSubmissions && <Button variant="tab" isActive={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>Pending Approvals {pendingSubmissions.length > 0 && <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{pendingSubmissions.length}</span>}</Button>}</nav></div>{loading ? <Spinner /> : ( activeTab === 'members' ? ( <div><div className="flex justify-start mb-4"><Button onClick={handleAdd}>Add New Member</Button></div><Card><Table headers={tableHeaders[teamLevel]}>{members.length > 0 ? members.map(c => (<tr key={c.id}><td>{c.name}</td><td>{c.email}</td>{teamLevel !== 'federal' && <td>{c.state}</td>}{teamLevel === 'locality' && <td>{c.locality}</td>}<td>{c.jobTitle === 'اخرى' ? c.jobTitleOther : c.jobTitle}</td>{teamLevel !== 'locality' && <td>{c.role}</td>}<td><div className="flex gap-2"><Button size="sm" variant="info" onClick={() => handleView(c)}>View</Button><Button size="sm" onClick={() => handleEdit(c)}>Edit</Button><Button size="sm" variant="danger" onClick={() => handleDelete(c.id)}>Delete</Button></div></td></tr>)) : <EmptyState message="No team members found for this level." colSpan={tableHeaders[teamLevel]?.length} />}</Table></Card></div>) : (<PendingSubmissions submissions={pendingSubmissions} isLoading={isSubmissionsLoading} onApprove={handleApprove} onReject={handleReject} onView={handleView} />) )}</div> )}
            
            {teamLevel && <LinkManagementModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} settings={linkSettings} isLoading={isLoadingSettings} onToggleStatus={handleToggleLinkStatus} level={teamLevel} />}
        </div>
    );
}

// Public application form
// FIX: Renamed component from CoordinatorApplicationForm to TeamMemberApplicationForm
export function TeamMemberApplicationForm() {
    const [selectedLevel, setSelectedLevel] = useState('');
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', isUserEmail: false, state: '', locality: '', jobTitle: '', jobTitleOther: '', role: '', directorDate: '', unit: '', joinDate: '', comments: '', previousRoles: [{ role: '', duration: '' }] });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [isLinkActive, setIsLinkActive] = useState(false);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const levelFromUrl = urlParams.get('level');
        if (['state', 'federal', 'locality'].includes(levelFromUrl)) {
            setSelectedLevel(levelFromUrl);
            const checkStatus = async () => {
                setIsLoadingStatus(true);
                try {
                    const settings = await getCoordinatorApplicationSettings(levelFromUrl);
                    if (settings.isActive) { await incrementCoordinatorApplicationOpenCount(levelFromUrl); setIsLinkActive(true); } 
                    else { setIsLinkActive(false); }
                } catch (e) { setIsLinkActive(false); }
                finally { setIsLoadingStatus(false); }
            };
            checkStatus();
        } else { setIsLoadingStatus(false); }
        const unsubscribe = onAuthStateChanged(auth, (user) => { if (user && user.email) { setFormData(prev => ({ ...prev, email: user.email, isUserEmail: true })); } });
        return () => unsubscribe();
    }, []);
    
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handlePreviousRolesChange = (newRoles) => setFormData(prev => ({ ...prev, previousRoles: newRoles }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedLevel || !formData.name || !formData.email) { setError('Please fill in all required fields.'); return; }
        setError(''); setSubmitting(true);
        try {
            let payload = { ...formData };
            payload.previousRoles = payload.previousRoles.filter(exp => exp.role.trim() !== '');
            
            const submitFn = { 
                state: submitCoordinatorApplication, 
                federal: submitFederalApplication, 
                locality: submitLocalityApplication 
            }[selectedLevel];

            await submitFn(payload);
            setSubmitted(true);
        } catch (err) { console.error("Submission failed:", err); setError("There was an error submitting your information."); } finally { setSubmitting(false); }
    };
    
    const formTitles = {
        locality: "جمع معلومات فريق صحة الطفل بالمحليات",
        state: "جمع معلومات فريق صحة الطفل بالولايات",
        federal: "جمع معلومات فريق صحة الطفل بالاتحادية",
    };

    if (isLoadingStatus) return <Card><Spinner /></Card>;
    if (!selectedLevel) return <Card><div className="text-center"><PageHeader title="Invalid Link" /></div><EmptyState message="The application link is incomplete. Please use a valid link provided by the administrator." /></Card>;
    if (!isLinkActive) return <Card><div className="text-center"><PageHeader title="Application Closed" /></div><EmptyState message="Submissions for this application type are currently closed." /></Card>;
    if (submitted) return <Card><div className="text-center"><PageHeader title="Submission Received" /></div><div className="p-8 text-center"><h3 className="text-2xl font-bold text-green-600 mb-4">Thank You!</h3><p className="text-gray-700">Your information has been submitted successfully.</p></div></Card>;
    
    return (
        <Card>
            <div className="text-center">
                <PageHeader title={formTitles[selectedLevel]} />
            </div>
            {error && <div className="p-3 mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
             <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
                <MemberFormFieldset level={selectedLevel} formData={formData} onFormChange={handleChange} onDynamicFieldChange={handlePreviousRolesChange} />
                <div className="flex justify-end pt-4"><Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Application'}</Button></div>
             </form>
        </Card>
    );
}