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

// Standard job titles for normalization
const STANDARD_JOB_TITLES = ['صحة عامة', 'طبيب', 'ممرض', 'ظابط تغذية', 'مساعد طبي', 'صيدلي', 'إحصائي', 'إدارة اعمال'];

// Helper to normalize legacy state names (Arabic or English) to their standard constant key
const normalizeState = (rawState) => {
    if (!rawState) return rawState;
    if (STATE_LOCALITIES[rawState]) return rawState; // Already a valid key
    
    const trimmed = rawState.trim();
    for (const [key, data] of Object.entries(STATE_LOCALITIES)) {
        if (data.ar === trimmed || data.en === trimmed) {
            return key;
        }
    }
    return trimmed; // Return original if no match found
};

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
        <div className="space-y-4" dir="rtl">
            {experiences.map((exp, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 p-3 border rounded-md bg-gray-50">
                    <Input label="الخبرة/المهمة" value={exp.role} onChange={(e) => handleExperienceChange(index, 'role', e.target.value)} placeholder="مكان العمل السابق" className="flex-grow" required />
                    <Input label="مدة الخبرة بالسنوات" value={exp.duration} onChange={(e) => handleExperienceChange(index, 'duration', e.target.value)} placeholder="مثال: سنتان" className="sm:w-40" required />
                    <Button size="sm" variant="danger" onClick={() => handleRemoveExperience(index)} className="self-end sm:self-center mt-2 sm:mt-0 h-10">حذف</Button>
                </div>
            ))}
            <Button type="button" variant="secondary" onClick={handleAddExperience}>إضافة خبرات أخرى</Button>
        </div>
    );
}

// A single, reusable component for displaying form fields with DEDICATED BORDERS AND STYLED BLUE HEADERS
function MemberFormFieldset({ level, formData, onFormChange, onDynamicFieldChange }) {
    const states = Object.keys(STATE_LOCALITIES);
    const localities = formData.state ? (STATE_LOCALITIES[formData.state]?.localities || []) : [];
    const joinDateLabels = { state: 'تاريخ الانضمام لبرنامج صحة الطفل بالولاية', federal: 'تاريخ الانضمام لبرنامج صحة الطفل بالاتحادية' };

    return (
        <div className="space-y-6">
            <div className="p-5 border border-gray-200 shadow-sm rounded-lg bg-white space-y-4">
                <h3 className="text-lg font-semibold text-blue-800 bg-blue-100 px-4 py-2 rounded-md mb-4">البيانات الأساسية</h3>
                {level !== 'federal' && ( <Select label="الولاية" name="state" value={formData.state} onChange={onFormChange} required><option value="">اختر ولاية</option>{states.map(s => <option key={s} value={s}>{STATE_LOCALITIES[s]?.ar || s}</option>)}</Select> )}
                {level === 'locality' && ( <Select label="المحلية" name="locality" value={formData.locality} onChange={onFormChange} required disabled={!formData.state}><option value="">اختر المحلية</option>{localities.map(loc => <option key={loc.en} value={loc.en}>{loc.ar}</option>)}</Select> )}
                <Input label="الإسم (باللغة الإنجليزية)" name="name" value={formData.name} onChange={onFormChange} required />
                <Input label="الإسم (باللغة العربية)" name="nameAr" value={formData.nameAr || ''} onChange={onFormChange} required />
                <Input label="رقم الهاتف" name="phone" type="tel" value={formData.phone} onChange={onFormChange} required />
                <Input label="الايميل" name="email" type="email" value={formData.email} onChange={onFormChange} required disabled={formData.isUserEmail} />
            </div>

            <div className="p-5 border border-gray-200 shadow-sm rounded-lg bg-white space-y-4">
                <h3 className="text-lg font-semibold text-blue-800 bg-blue-100 px-4 py-2 rounded-md mb-4">بيانات الحساب البنكي</h3>
                <Input label="رقم الحساب البنكي" name="bankAccount" type="text" value={formData.bankAccount || ''} onChange={onFormChange} required />
                <Input label="اسم البنك" name="bankName" type="text" value={formData.bankName || ''} onChange={onFormChange} required />
                <Input label="اسم الفرع" name="bankBranch" type="text" value={formData.bankBranch || ''} onChange={onFormChange} required />
                <Input label=" ادخل اسم صاحب الحساب" name="accountHolder" type="text" value={formData.accountHolder || ''} onChange={onFormChange} required />
            </div>

            <div className="p-5 border border-gray-200 shadow-sm rounded-lg bg-white space-y-4">
                <h3 className="text-lg font-semibold text-blue-800 bg-blue-100 px-4 py-2 rounded-md mb-4">البيانات الوظيفية</h3>
                <Select label="المسمى الوظيفي" name="jobTitle" value={formData.jobTitle} onChange={onFormChange} required>
                    <option value="">اختر المسمى الوظيفي</option>
                    <option value="صحة عامة">صحة عامة</option>
                    <option value="طبيب">طبيب</option>
                    <option value="ممرض">ممرض</option>
                    <option value="ظابط تغذية">ظابط تغذية</option>
                    <option value="مساعد طبي">مساعد طبي</option>
                    <option value="صيدلي">صيدلي</option>
                    <option value="إحصائي">إحصائي</option>
                    <option value="إدارة اعمال">إدارة اعمال</option>
                    <option value="اخرى">اخرى</option>
                </Select>
                {formData.jobTitle === 'اخرى' && <Input label="حدد المسمى الوظيفي" name="jobTitleOther" value={formData.jobTitleOther} onChange={onFormChange} required />}
                {level !== 'locality' && ( <Select label="الصفة" name="role" value={formData.role} onChange={onFormChange} required><option value="">اختر الصفة</option><option value="مدير البرنامج">مدير البرنامج</option><option value="رئيس وحدة">رئيس وحدة</option><option value="عضو في وحدة">عضو في وحدة</option><option value="سكرتارية">سكرتارية</option></Select> )}
                {level !== 'locality' && formData.role === 'مدير البرنامج' && <Input label="الرجاء تحديد تاريخ التعيين مدير للبرنامج" name="directorDate" type="date" value={formData.directorDate} onChange={onFormChange} required />}
                {level !== 'locality' && (formData.role === 'رئيس وحدة' || formData.role === 'عضو في وحدة') && (<Select label="اختر الوحدة" name="unit" value={formData.unit} onChange={onFormChange} required><option value="">اختر الوحدة</option><option value="العلاج المتكامل للاطفال اقل من 5 سنوات">العلاج المتكامل للاطفال اقل من 5 سنوات</option><option value="حديثي الولادة">حديثي الولادة</option><option value="المراهقين وحماية الاطفال">المراهقين وحماية الاطفال</option><option value="المتابعة والتقييم والمعلومات">المتابعة والتقييم والمعلومات</option><option value="الامداد">الامداد</option><option value="تعزيز صحة الاطفال والمراهقين">تعزيز صحة الاطفال والمراهقين</option></Select>)}
                {level !== 'locality' && <Input label={joinDateLabels[level] || 'تاريخ الانضمام'} name="joinDate" type="date" value={formData.joinDate} onChange={onFormChange} required />}
            </div>

            <div className="p-5 border border-gray-200 shadow-sm rounded-lg bg-white space-y-4">
                <h3 className="text-lg font-semibold text-blue-800 bg-blue-100 px-4 py-2 rounded-md mb-4">الخبرات السابقة قبل الانضمام لبرنامج صحة الطفل</h3>
                <DynamicExperienceFields experiences={formData.previousRoles} onChange={onDynamicFieldChange} />
            </div>

            <div className="p-5 border border-gray-200 shadow-sm rounded-lg bg-white space-y-4">
                <h3 className="text-lg font-semibold text-blue-800 bg-blue-100 px-4 py-2 rounded-md mb-4">ملاحظات إضافية</h3>
                <Textarea label="اي تعليقات اخرى" name="comments" value={formData.comments} onChange={onFormChange} />
            </div>
        </div>
    );
}

// A single, configurable form for all team levels (internal use)
function TeamMemberForm({ member, onSave, onCancel }) {
    const [selectedLevel, setSelectedLevel] = useState(member?.level || (member ? (member.locality ? 'locality' : member.state ? 'state' : 'federal') : ''));
    const [formData, setFormData] = useState(() => {
        const initialData = member ? { ...member, state: normalizeState(member.state) } : { 
            name: '', nameAr: '', phone: '', email: '', state: '', locality: '', 
            jobTitle: '', jobTitleOther: '', role: '', directorDate: '', unit: '', 
            joinDate: '', bankAccount: '', bankName: '', bankBranch: '', accountHolder: '', comments: '' 
        };
        if (!initialData.previousRoles || !Array.isArray(initialData.previousRoles) || initialData.previousRoles.length === 0) {
            initialData.previousRoles = [{ role: '', duration: '' }];
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
                <h2 className="text-xl font-bold text-gray-800 text-center border-b pb-4 mb-6">{member?.id ? `تعديل بيانات العضو` : `إضافة عضو جديد`}</h2>
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

// Internal View Component with dedicated bordered sections and BLUE styled headers (Includes Diff logic for pending approvals)
function TeamMemberView({ level, member, originalMember, onBack }) {
    const renderDetail = (label, newValue, fieldKey) => {
        const originalValue = originalMember ? originalMember[fieldKey] : undefined;
        // Check if value changed, but treat null/undefined/empty string equally
        const hasChanged = originalMember && String(originalValue || '').trim() !== String(newValue || '').trim();

        if (!newValue && !originalValue) return null;

        return (
            <div className={`py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-4 px-3 rounded-md transition-colors ${hasChanged ? 'bg-yellow-50 border-r-4 border-yellow-400' : ''}`}>
                <dt className="text-sm font-medium text-gray-600">{label}</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {hasChanged && (
                        <div className="text-xs text-red-500 line-through mb-1">
                            {originalValue || '(فارغ - Empty)'}
                        </div>
                    )}
                    <div className={hasChanged ? 'text-green-700 font-semibold' : ''}>
                        {newValue || '(فارغ - Empty)'}
                    </div>
                </dd>
            </div>
        );
    };

    const renderSection = (title, content) => (
        <div className="mb-6 p-5 border border-gray-200 shadow-sm rounded-lg bg-white">
            <h3 className="text-lg font-semibold text-blue-800 bg-blue-100 px-4 py-2 rounded-md mb-4">{title}</h3>
            <dl className="divide-y divide-gray-100">
                {content}
            </dl>
        </div>
    );

    const normalizedState = normalizeState(member.state);
    const localityArabic = useMemo(() => {
        if (!normalizedState || !member.locality) return member.locality;
        const stateLocs = STATE_LOCALITIES[normalizedState]?.localities || [];
        const loc = stateLocs.find(l => l.en === member.locality);
        return loc ? loc.ar : member.locality;
    }, [normalizedState, member.locality]);

    // Check if experiences changed
    const prevRolesStr = JSON.stringify(member.previousRoles || []);
    const origPrevRolesStr = originalMember ? JSON.stringify(originalMember.previousRoles || []) : null;
    const experiencesChanged = originalMember && prevRolesStr !== origPrevRolesStr;

    return (
        <>
            <CardBody dir="rtl">
                <PageHeader 
                    title={originalMember ? "Review Pending Updates" : "View Team Member Details"} 
                    subtitle={originalMember ? "Yellow highlights indicate changed fields waiting for approval." : ""}
                />
                <div className="mt-6">
                    {renderSection("البيانات الأساسية",
                        <>
                            {level !== 'federal' && renderDetail('الولاية', STATE_LOCALITIES[normalizedState]?.ar || member.state, 'state')}
                            {level === 'locality' && renderDetail('المحلية', localityArabic, 'locality')}
                            {renderDetail('الإسم (باللغة الإنجليزية)', member.name, 'name')}
                            {renderDetail('الإسم (باللغة العربية)', member.nameAr, 'nameAr')}
                            {renderDetail('رقم الهاتف', member.phone, 'phone')}
                            {renderDetail('الايميل', member.email, 'email')}
                        </>
                    )}

                    {renderSection("بيانات الحساب البنكي",
                        <>
                            {renderDetail('رقم الحساب البنكي', member.bankAccount, 'bankAccount')}
                            {renderDetail('اسم البنك', member.bankName, 'bankName')}
                            {renderDetail('اسم الفرع', member.bankBranch, 'bankBranch')}
                            {renderDetail('اسم صاحب الحساب', member.accountHolder, 'accountHolder')}
                        </>
                    )}

                    {renderSection("البيانات الوظيفية",
                        <>
                            {renderDetail('المسمى الوظيفي', member.jobTitle === 'اخرى' ? member.jobTitleOther : member.jobTitle, 'jobTitle')}
                            {level !== 'locality' && renderDetail('الصفة', member.role, 'role')}
                            {level !== 'locality' && member.role === 'مدير البرنامج' && renderDetail('تاريخ التعيين مدير للبرنامج', member.directorDate, 'directorDate')}
                            {level !== 'locality' && (member.role === 'رئيس وحدة' || member.role === 'عضو في وحدة') && renderDetail('الوحدة', member.unit, 'unit')}
                            {level !== 'locality' && renderDetail(level === 'federal' ? 'تاريخ الانضمام للبرنامج الاتحادي' : 'تاريخ الانضمام لبرنامج الولاية', member.joinDate, 'joinDate')}
                        </>
                    )}

                    {renderSection("الخبرات السابقة",
                        <div className={`py-3 px-3 rounded-md transition-colors ${experiencesChanged ? 'bg-yellow-50 border-r-4 border-yellow-400' : ''}`}>
                            {experiencesChanged && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded text-red-700 opacity-80">
                                    <p className="text-xs font-bold mb-2">الخبرات السابقة (القديمة):</p>
                                    <ul className="list-disc pl-5 pr-5 space-y-1 text-sm line-through">
                                        {Array.isArray(originalMember.previousRoles) && originalMember.previousRoles.length > 0 ? 
                                            originalMember.previousRoles.map((exp, i) => exp.role && <li key={i}>{exp.role} ({exp.duration || 'N/A'})</li>) 
                                            : <li>لا توجد خبرات مسجلة</li>}
                                    </ul>
                                </div>
                            )}
                            {experiencesChanged && <p className="text-xs font-bold text-green-700 mb-2">الخبرات السابقة (الجديدة):</p>}
                            {Array.isArray(member.previousRoles) && member.previousRoles.some(e => e.role) ? (
                                <ul className={`list-disc pl-5 pr-5 space-y-1 text-sm ${experiencesChanged ? 'text-green-700 font-semibold' : 'text-gray-900'}`}>
                                    {member.previousRoles.map((exp, index) => (
                                        exp.role && <li key={index}><strong>{exp.role}</strong> ({exp.duration || 'N/A'})</li>
                                    ))}
                                </ul>
                            ) : <span className="text-sm text-gray-500">لا توجد خبرات مسجلة</span>}
                        </div>
                    )}

                    {renderSection("ملاحظات إضافية",
                        <>
                            {renderDetail('اي تعليقات اخرى', member.comments, 'comments')}
                        </>
                    )}
                </div>
            </CardBody>
            <CardFooter>
                <Button onClick={onBack}>Close</Button>
            </CardFooter>
        </>
    );
}

function PendingSubmissions({ submissions, isLoading, onApprove, onReject, onView, isActionDisabled }) {
    const headers = ['Name', 'Email', 'Actions'];
    if (isLoading) return <Card><Spinner /></Card>;
    
    return (
        <Card>
            <CardBody>
                <Table headers={headers}>
                    {submissions && submissions.length > 0 ? (
                        submissions.map(s => (
                            <tr key={s.id}>
                                <td className="p-4 text-sm">{s.nameAr || s.name}</td>
                                <td className="p-4 text-sm">{s.email}</td>
                                <td className="p-4 text-sm">
                                    <div className="flex gap-2">
                                        <Button variant="secondary" onClick={() => onView(s, true)}>View</Button>
                                        <Button variant="success" onClick={() => onApprove(s)} disabled={isActionDisabled}>Approve</Button>
                                        <Button variant="danger" onClick={() => onReject(s.id)} disabled={isActionDisabled}>Reject</Button>
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
    const [copiedState, setCopiedState] = useState('');
    
    const baseUrl = `${window.location.origin}/public/team-member-application`;
    
    const links = {
        'General (Select Level manually)': baseUrl,
        'Federal Level': `${baseUrl}?level=federal`,
        'State Level': `${baseUrl}?level=state`,
        'Locality Level': `${baseUrl}?level=locality`
    };

    const handleCopyLink = (levelName, link) => {
        navigator.clipboard.writeText(link).then(() => {
            setCopiedState(levelName);
            setTimeout(() => setCopiedState(''), 2500);
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Team Member Submission Link`}>
            {isLoading ? <Spinner /> : ( 
                <div className="space-y-4"> 
                    <div className="space-y-4 mb-4">
                        <p className="text-sm text-gray-600">Share these links to direct users to a specific application form.</p>
                        {Object.entries(links).map(([levelName, link]) => (
                            <FormGroup key={levelName} label={levelName}>
                                <div className="relative">
                                    <Input type="text" value={link} readOnly className="pr-24" />
                                    <Button 
                                        onClick={() => handleCopyLink(levelName, link)} 
                                        className="absolute right-1 top-1/2 -translate-y-1/2" 
                                        variant="secondary" 
                                        size="sm"
                                    >
                                        {copiedState === levelName ? 'Copied!' : 'Copy'}
                                    </Button>
                                </div>
                            </FormGroup>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                            <div>Status: <span className={`font-bold px-2 py-1 rounded-full text-xs ml-2 ${settings.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{settings.isActive ? 'Active' : 'Inactive'}</span></div>
                            <div><span className="font-medium">Links Opened:</span> {settings.openCount || 0} times</div>
                        </div>
                        <Button variant={settings.isActive ? 'danger' : 'success'} onClick={onToggleStatus}>
                            {settings.isActive ? 'Deactivate Links' : 'Activate Links'}
                        </Button>
                    </div>
                </div> 
            )}
        </Modal>
    );
}

// --- NEW DASHBOARD COMPONENT ---
function ProgramTeamDashboard({ federalCoordinators, stateCoordinators, localityCoordinators, filters }) {
    // Helper to extract numeric years of experience
    const extractYears = (durationStr) => {
        if (!durationStr) return 0;
        const numMatch = durationStr.match(/\d+/);
        if (numMatch) return parseInt(numMatch[0], 10);
        if (durationStr.includes('سنت')) return 2;
        if (durationStr.includes('سنة') || durationStr.includes('عام')) return 1;
        return 0;
    };

    const getOverallExp = (member) => {
        if (!member.previousRoles || !Array.isArray(member.previousRoles)) return 0;
        return member.previousRoles.reduce((total, role) => total + extractYears(role.duration), 0);
    };

    // Combine all members and attach level, normalizing state here
    const allMembers = useMemo(() => [
        ...(federalCoordinators || []).map(m => ({ ...m, _level: 'federal', state: normalizeState(m.state) })),
        ...(stateCoordinators || []).map(m => ({ ...m, _level: 'state', state: normalizeState(m.state) })),
        ...(localityCoordinators || []).map(m => ({ ...m, _level: 'locality', state: normalizeState(m.state) }))
    ], [federalCoordinators, stateCoordinators, localityCoordinators]);

    // Apply global filters to dashboard data
    const filteredMembers = useMemo(() => allMembers.filter(m => {
        if (filters.state && m.state !== filters.state && m._level !== 'federal') return false;
        if (filters.locality && m.locality !== filters.locality) return false;
        
        const actualJobTitle = m.jobTitle === 'اخرى' ? m.jobTitleOther : m.jobTitle;
        if (filters.jobTitle && actualJobTitle !== filters.jobTitle) return false;
        
        if (filters.role && m.role !== filters.role) return false;
        if (filters.unit && m.unit !== filters.unit) return false;
        
        return true;
    }), [allMembers, filters]);

    // 1. KPIs Data
    const federalCount = filteredMembers.filter(m => m._level === 'federal').length;
    const stateCount = filteredMembers.filter(m => m._level === 'state').length;
    const localityCount = filteredMembers.filter(m => m._level === 'locality').length;

    // 2. States Aggregation Table & Detailed HR Table Data Prep
    const groupedByState = {};
    const stateCounts = {}; 
    
    filteredMembers.forEach(m => {
        const stateKey = m.state || 'الاتحادية (Federal)';
        
        // Detailed grouping
        if (!groupedByState[stateKey]) groupedByState[stateKey] = [];
        groupedByState[stateKey].push(m);

        // Aggregation grouping with Role breakdown
        if (!stateCounts[stateKey]) {
            stateCounts[stateKey] = { 
                hrStateCount: 0, 
                roleManager: 0,
                roleHead: 0,
                roleMember: 0,
                roleSec: 0,
                hrLocalityCount: 0 
            };
        }
        
        // Count Levels
        if (m._level === 'state') stateCounts[stateKey].hrStateCount += 1;
        if (m._level === 'locality') stateCounts[stateKey].hrLocalityCount += 1;
        if (m._level === 'federal') stateCounts[stateKey].hrStateCount += 1;

        // Count Responsibilities/Roles (الصفة)
        if (m.role === 'مدير البرنامج') stateCounts[stateKey].roleManager += 1;
        else if (m.role === 'رئيس وحدة') stateCounts[stateKey].roleHead += 1;
        else if (m.role === 'عضو في وحدة') stateCounts[stateKey].roleMember += 1;
        else if (m.role === 'سكرتارية') stateCounts[stateKey].roleSec += 1;
    });

    // Sort localities within each state for the detailed table
    Object.keys(groupedByState).forEach(state => {
        groupedByState[state].sort((a, b) => (a.locality || '').localeCompare(b.locality || ''));
    });

    // 3. Job Distribution Data
    const jobDist = {};
    filteredMembers.forEach(m => {
        const job = m.jobTitle === 'اخرى' ? (m.jobTitleOther || 'Other') : (m.jobTitle || 'Unknown');
        jobDist[job] = (jobDist[job] || 0) + 1;
    });
    const maxJobCount = Math.max(0, ...Object.values(jobDist));

    // 4. Experience Distribution Data
    const expDist = { '0-2 Years': 0, '3-5 Years': 0, '6-10 Years': 0, '10+ Years': 0 };
    filteredMembers.forEach(m => {
        const exp = getOverallExp(m);
        if (exp <= 2) expDist['0-2 Years'] += 1;
        else if (exp <= 5) expDist['3-5 Years'] += 1;
        else if (exp <= 10) expDist['6-10 Years'] += 1;
        else expDist['10+ Years'] += 1;
    });
    const maxExpCount = Math.max(0, ...Object.values(expDist));

    // Check if Locality column is applicable in the detailed HR list
    const showLocality = useMemo(() => {
        return filteredMembers.some(m => m.locality && m.locality.trim() !== '');
    }, [filteredMembers]);

    // EXPORT FUNCTIONS
    const handleExportCSV = () => {
        const headers = ['State', 'Name', 'Job Description', 'Overall Experience'];
        if (showLocality) headers.push('Locality');

        let csv = headers.join(',') + '\n';
        Object.entries(groupedByState).forEach(([state, members]) => {
            members.forEach(m => {
                // Determine Arabic Locality Name if applicable
                let locArabic = '-';
                if (m.locality) {
                    const locs = STATE_LOCALITIES[m.state]?.localities || [];
                    const foundLoc = locs.find(l => l.en === m.locality);
                    locArabic = foundLoc ? foundLoc.ar : m.locality;
                }

                const row = [
                    `"${STATE_LOCALITIES[state]?.ar || state}"`,
                    `"${m.nameAr || m.name}"`,
                    `"${m.jobTitle === 'اخرى' ? m.jobTitleOther : m.jobTitle}"`,
                    `"${getOverallExp(m)} Years"`
                ];
                if (showLocality) row.push(`"${locArabic}"`);
                csv += row.join(',') + '\n';
            });
        });

        // Add UTF-8 BOM so Excel opens Arabic correctly automatically
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Human_Resources_List.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        const tableHtml = document.getElementById('hr-list-table').outerHTML;
        
        printWindow.document.write(`
            <html dir="rtl">
                <head>
                    <title>Human Resources List</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; color: #333; }
                        h2 { text-align: center; color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                        th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                        th { background-color: #f9fafb; font-weight: bold; color: #4b5563; }
                        tr:nth-child(even) { background-color: #fcfcfc; }
                    </style>
                </head>
                <body>
                    <h2>قائمة الموارد البشرية (Human Resources List)</h2>
                    ${tableHtml}
                    <script>
                        window.onload = () => { window.print(); window.close(); };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6">
            
            {/* KPI Cards (At the Top) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border rounded-lg p-5 shadow-sm border-l-4 border-l-blue-600">
                    <div className="text-gray-500 text-sm font-medium">Federal Level</div>
                    <div className="mt-2 text-3xl font-bold text-gray-900">{federalCount}</div>
                </div>
                <div className="bg-white border rounded-lg p-5 shadow-sm border-l-4 border-l-green-600">
                    <div className="text-gray-500 text-sm font-medium">State Level</div>
                    <div className="mt-2 text-3xl font-bold text-gray-900">{stateCount}</div>
                </div>
                <div className="bg-white border rounded-lg p-5 shadow-sm border-l-4 border-l-purple-600">
                    <div className="text-gray-500 text-sm font-medium">Locality Level</div>
                    <div className="mt-2 text-3xl font-bold text-gray-900">{localityCount}</div>
                </div>
            </div>

            {/* Summary Table by State */}
            <Card>
                <CardBody>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">HR Distribution by State</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200">HR in State Level</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50 border-l border-gray-200">مدير البرنامج</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">رئيس وحدة</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">عضو في وحدة</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">سكرتارية</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200">HR in Locality Level</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {Object.entries(stateCounts).map(([state, counts]) => (
                                    <tr key={state}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{STATE_LOCALITIES[state]?.ar || state}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 border-l border-gray-200">{counts.hrStateCount}</td>
                                        
                                        {/* Responsibilities Breakdown Columns */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-blue-50/30 border-l border-gray-200">{counts.roleManager}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-blue-50/30">{counts.roleHead}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-blue-50/30">{counts.roleMember}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-blue-50/30">{counts.roleSec}</td>

                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 border-l border-gray-200">{counts.hrLocalityCount}</td>
                                    </tr>
                                ))}
                                {Object.keys(stateCounts).length === 0 && (
                                    <tr><td colSpan="7" className="px-6 py-4 text-center text-gray-500">No data matching filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardBody>
            </Card>

            {/* Graphs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Job Distribution */}
                <Card>
                    <CardBody>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Job Description Distribution</h3>
                        <div className="space-y-3">
                            {Object.entries(jobDist).sort((a,b) => b[1] - a[1]).map(([job, count]) => (
                                <div key={job}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-gray-700">{job}</span>
                                        <span className="text-gray-500">{count}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(count / maxJobCount) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                            {Object.keys(jobDist).length === 0 && <span className="text-sm text-gray-500">No data available.</span>}
                        </div>
                    </CardBody>
                </Card>

                {/* Experience Distribution */}
                <Card>
                    <CardBody>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Years of Experience</h3>
                        <div className="space-y-3">
                            {Object.entries(expDist).map(([range, count]) => (
                                <div key={range}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-gray-700">{range}</span>
                                        <span className="text-gray-500">{count}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${maxExpCount === 0 ? 0 : (count / maxExpCount) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Detailed HR List Table */}
            <Card>
                <CardBody>
                    <div className="flex flex-wrap justify-between items-center mb-4 border-b pb-2 gap-4">
                        <h3 className="text-lg font-semibold text-gray-800">Human Resources List</h3>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={handleExportCSV}>Export Excel (CSV)</Button>
                            <Button size="sm" variant="secondary" onClick={handleExportPDF}>Export PDF</Button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table id="hr-list-table" className="min-w-full border-collapse border border-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="border p-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                                    <th className="border p-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="border p-3 text-left text-xs font-medium text-gray-500 uppercase">Job Description</th>
                                    <th className="border p-3 text-left text-xs font-medium text-gray-500 uppercase">Overall Experience</th>
                                    {showLocality && <th className="border p-3 text-left text-xs font-medium text-gray-500 uppercase">Locality</th>}
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {Object.entries(groupedByState).length > 0 ? Object.entries(groupedByState).map(([state, members]) => (
                                    members.map((m, idx) => {
                                        // Display Arabic Locality Name if applicable
                                        let locArabic = '-';
                                        if (m.locality) {
                                            const locs = STATE_LOCALITIES[m.state]?.localities || [];
                                            const foundLoc = locs.find(l => l.en === m.locality);
                                            locArabic = foundLoc ? foundLoc.ar : m.locality;
                                        }

                                        return (
                                            <tr key={m.id} className="border-b hover:bg-gray-50">
                                                {idx === 0 && (
                                                    <td rowSpan={members.length} className="border p-3 align-top font-medium text-gray-900 bg-gray-50 shadow-inner">
                                                        {STATE_LOCALITIES[state]?.ar || state}
                                                    </td>
                                                )}
                                                <td className="border p-3 text-sm text-gray-900">{m.nameAr || m.name}</td>
                                                <td className="border p-3 text-sm text-gray-700">{m.jobTitle === 'اخرى' ? m.jobTitleOther : m.jobTitle}</td>
                                                <td className="border p-3 text-sm text-gray-700">{getOverallExp(m)} Years</td>
                                                {showLocality && <td className="border p-3 text-sm text-gray-700">{locArabic}</td>}
                                            </tr>
                                        );
                                    })
                                )) : (
                                    <tr><td colSpan={showLocality ? "5" : "4"} className="p-6 text-center text-gray-500">No human resources match your filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
// --- END NEW DASHBOARD COMPONENT ---


const updateUserRoleByEmail = async (email, newRole, state, locality) => {
    if (!email || !newRole) return; 

    try {
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

        if (currentUserRole === 'super_user') {
             console.warn(`Role assignment skipped: Cannot programmatically change the role of a Super User (${email}).`);
             return;
        }

        const newPermissions = DEFAULT_ROLE_PERMISSIONS[newRole] || DEFAULT_ROLE_PERMISSIONS['user'];
        const updatePayload = {
            role: newRole,
            permissions: applyDerivedPermissions({ ...ALL_PERMISSIONS, ...newPermissions })
        };

        if (newRole === 'states_manager' || newRole === 'state_coordinator') {
            updatePayload.assignedState = state || '';
            updatePayload.assignedLocality = ''; 
        } else if (newRole === 'locality_manager') {
            updatePayload.assignedState = state || '';
            updatePayload.assignedLocality = locality || '';
        }

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
    
    // Default Tab
    const [activeTab, setActiveTab] = useState('members'); 
    
    const isFederal = permissions.manageScope === 'federal' || permissions.canUseSuperUserAdvancedFeatures;

    const [filters, setFilters] = useState(() => {
        const initialState = {
            level: isFederal ? 'federal' : 'state',
            state: isFederal ? '' : (userStates[0] || ''), 
            locality: '',
            jobTitle: '',
            role: '', 
            unit: '' // ADDED UNIT
        };
        return initialState;
    });

    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState(null); 
    const [editingMember, setEditingMember] = useState(null);
    const [originalMember, setOriginalMember] = useState(null); // Used for pending diff view
    
    const [shareModalInfo, setShareModalInfo] = useState({ isOpen: false, link: '' });

    // Multi-Select and Bulk Action States
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    
    // NEW STATES: Locks UI actions until modal is dismissed
    const [isActionDisabled, setIsActionDisabled] = useState(false);
    const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, type: 'success', message: '' });
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, type: null, level: null, id: null });

    const closeFeedbackModal = () => {
        setFeedbackModal(prev => ({ ...prev, isOpen: false }));
        setIsActionDisabled(false); // Re-enable all buttons when modal closes
    };

    // Auto-Normalize States
    const [isAutoNormalizeModalOpen, setIsAutoNormalizeModalOpen] = useState(false);
    const [unmappedGroups, setUnmappedGroups] = useState({});
    const [jobMappings, setJobMappings] = useState({});

    const fetchersByLevel = useMemo(() => ({
        federal: { list: fetchFederalCoordinators, listPending: fetchPendingFederalSubmissions },
        state: { list: fetchStateCoordinators, listPending: fetchPendingStateSubmissions },
        locality: { list: fetchLocalityCoordinators, listPending: fetchPendingLocalitySubmissions }
    }), [
        fetchFederalCoordinators, fetchPendingFederalSubmissions,
        fetchStateCoordinators, fetchPendingStateSubmissions,
        fetchLocalityCoordinators, fetchPendingLocalitySubmissions
    ]);

    const dataByLevel = useMemo(() => ({
        federal: { members: federalCoordinators, pending: pendingFederalSubmissions, loading: isLoading.federalCoordinators, pendingLoading: isLoading.pendingFederalSubmissions },
        state: { members: stateCoordinators, pending: pendingStateSubmissions, loading: isLoading.stateCoordinators, pendingLoading: isLoading.pendingStateSubmissions },
        locality: { members: localityCoordinators, pending: pendingLocalitySubmissions, loading: isLoading.localityCoordinators, pendingLoading: isLoading.pendingLocalitySubmissions }
    }), [
        federalCoordinators, pendingFederalSubmissions, isLoading.federalCoordinators, isLoading.pendingFederalSubmissions,
        stateCoordinators, pendingStateSubmissions, isLoading.stateCoordinators, isLoading.pendingStateSubmissions,
        localityCoordinators, pendingLocalitySubmissions, isLoading.localityCoordinators, isLoading.pendingLocalitySubmissions
    ]);
    
    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchFederalCoordinators();
            fetchStateCoordinators();
            fetchLocalityCoordinators();
        } else {
            const level = filters.level;
            if (!level || !fetchersByLevel[level]) return;
            fetchersByLevel[level].list();
            if (permissions?.canApproveSubmissions) {
                fetchersByLevel[level].listPending();
            }
        }
    }, [filters.level, activeTab, permissions, fetchersByLevel, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators]);

    const filteredMembers = useMemo(() => {
        if (!filters.level) return [];
        const { members, loading } = dataByLevel[filters.level];
        if (loading || !members) return [];
        
        let membersToFilter = members.map(m => ({ ...m, state: normalizeState(m.state) }));

        if (!isFederal && userStates && userStates.length > 0) {
            membersToFilter = membersToFilter.filter(m => {
                if (filters.level === 'federal' || !m.state) return false;
                return userStates.includes(m.state);
            });
        }

        return membersToFilter.filter(m => {
            const stateMatch = !filters.state || m.state === filters.state;
            const localityMatch = !filters.locality || m.locality === filters.locality;
            const jobMatch = !filters.jobTitle || (m.jobTitle === 'اخرى' ? m.jobTitleOther : m.jobTitle) === filters.jobTitle;
            const roleMatch = !filters.role || m.role === filters.role; 
            const unitMatch = !filters.unit || m.unit === filters.unit; // ADDED UNIT CHECK

            return stateMatch && localityMatch && jobMatch && roleMatch && unitMatch;
        });
    }, [filters, isFederal, userStates, dataByLevel]);

    useEffect(() => {
        setSelectedMemberIds(new Set());
    }, [filters, activeTab]);

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            if (filterName === 'level') {
                if (isFederal) { newFilters.state = ''; newFilters.locality = ''; } 
                else { newFilters.locality = ''; }
                if (value === 'locality') {
                    newFilters.role = '';
                    newFilters.unit = ''; // Reset unit when switching to locality
                }
            }
            if (filterName === 'state') newFilters.locality = '';
            
            // Clean up unit filter if role changes to a non-unit role
            if (filterName === 'role' && value !== 'رئيس وحدة' && value !== 'عضو في وحدة' && value !== '') {
                newFilters.unit = '';
            }
            
            return newFilters;
        });
    };
    
    const handleCloseModal = () => { setIsModalOpen(false); setModalMode(null); setEditingMember(null); setOriginalMember(null); };
    const handleAdd = () => { setEditingMember(null); setOriginalMember(null); setModalMode('edit'); setIsModalOpen(true); };
    const handleEdit = (member) => { setEditingMember(member); setOriginalMember(null); setModalMode('edit'); setIsModalOpen(true); };
    
    const handleView = (member, isPending = false) => { 
        setEditingMember(member); 
        
        if (isPending) {
            // Find if this pending member exists in the currently approved list
            const allApproved = [
                ...(federalCoordinators || []),
                ...(stateCoordinators || []),
                ...(localityCoordinators || [])
            ];
            const existing = allApproved.find(m => m.email === member.email);
            setOriginalMember(existing || null);
        } else {
            setOriginalMember(null);
        }

        setModalMode('view'); 
        setIsModalOpen(true); 
    };
    
    const handleShare = (level, member) => {
        const link = `${window.location.origin}/public/profile/team/${level}/${member.id}`;
        setShareModalInfo({ isOpen: true, link: link });
    };

    const handleSave = async (level, payload) => {
        const upsertFnMap = { federal: upsertFederalCoordinator, state: upsertStateCoordinator, locality: upsertLocalityCoordinator };
        try {
            const upsertFn = upsertFnMap[level];
            if (!upsertFn) throw new Error("Invalid save level selected.");
            await upsertFn({ ...payload, id: editingMember?.id });
            
            let newRole = null;
            const roleFromForm = payload.role; 
            const isManagerOrHead = roleFromForm === 'مدير البرنامج' || roleFromForm === 'رئيس وحدة';
            if (level === 'federal') newRole = isManagerOrHead ? 'federal_manager' : 'federal_coordinator';
            else if (level === 'state') newRole = isManagerOrHead ? 'states_manager' : 'state_coordinator';
            else if (level === 'locality') newRole = 'locality_manager';

            if (newRole && payload.email) {
                try { await updateUserRoleByEmail(payload.email, newRole, payload.state, payload.locality); } 
                catch (roleError) { alert(`Team member saved, but role could not be assigned. \n\nError: ${roleError.message}`); }
            }
            fetchersByLevel[level].list(true); 
            if (level !== filters.level) handleFilterChange('level', level);
            handleCloseModal(); 
            setFeedbackModal({ isOpen: true, type: 'success', message: 'Team member saved successfully.' });
        } catch (error) { 
            console.error("Error saving member:", error);
            setFeedbackModal({ isOpen: true, type: 'error', message: `Failed to save member: ${error.message}` });
        }
    };
    
    // --- SINGLE AND BULK DELETE LOGIC (UPDATED W/ MODAL) ---
    const handleDeleteSingleClick = (level, id) => {
        setDeleteConfig({ isOpen: true, type: 'single', level, id });
    };

    const handleBulkDeleteClick = () => {
        setDeleteConfig({ isOpen: true, type: 'bulk', level: filters.level, id: null });
    };

    const confirmDeleteExecute = async () => {
        const { type, level, id } = deleteConfig;
        setDeleteConfig({ isOpen: false, type: null, level: null, id: null });
        setIsActionDisabled(true);

        try {
            if (type === 'single') {
                const deleteFnMap = {
                    federal: deleteFederalCoordinator,
                    state: deleteStateCoordinator,
                    locality: deleteLocalityCoordinator
                };
                await deleteFnMap[level](id);
                fetchersByLevel[level].list(true);
                setFeedbackModal({ isOpen: true, type: 'success', message: 'Team member deleted successfully.' });

            } else if (type === 'bulk') {
                const deleteFnMap = {
                    federal: deleteFederalCoordinator,
                    state: deleteStateCoordinator,
                    locality: deleteLocalityCoordinator
                };
                const deleteFn = deleteFnMap[filters.level];
                
                const deletePromises = Array.from(selectedMemberIds).map(memberId => deleteFn(memberId));
                await Promise.all(deletePromises);
                
                setSelectedMemberIds(new Set());
                fetchersByLevel[filters.level].list(true); 
                setFeedbackModal({ isOpen: true, type: 'success', message: `Successfully deleted ${selectedMemberIds.size} team members.` });
            }
        } catch (err) {
            console.error("Delete failed:", err);
            setFeedbackModal({ isOpen: true, type: 'error', message: `Delete operation failed: ${err.message}` });
        }
    };


    // --- AUTO NORMALIZE JOB DESCRIPTIONS LOGIC ---
    const handleOpenAutoNormalize = async () => {
        if (!federalCoordinators || !stateCoordinators || !localityCoordinators) {
            await fetchFederalCoordinators();
            await fetchStateCoordinators();
            await fetchLocalityCoordinators();
        }

        const all = [
            ...(federalCoordinators || []).map(m => ({ ...m, _level: 'federal', state: normalizeState(m.state) })),
            ...(stateCoordinators || []).map(m => ({ ...m, _level: 'state', state: normalizeState(m.state) })),
            ...(localityCoordinators || []).map(m => ({ ...m, _level: 'locality', state: normalizeState(m.state) }))
        ];

        const groups = {};
        
        all.forEach(m => {
            const actualJob = m.jobTitle === 'اخرى' ? (m.jobTitleOther || 'Unspecified') : (m.jobTitle || 'Unspecified');
            
            if (!STANDARD_JOB_TITLES.includes(actualJob)) {
                if (!groups[actualJob]) groups[actualJob] = [];
                groups[actualJob].push(m);
            }
        });
        
        if (Object.keys(groups).length === 0) {
            setFeedbackModal({ isOpen: true, type: 'success', message: 'All team members are already mapped to standard job descriptions!' });
            return;
        }
        
        setUnmappedGroups(groups);
        setJobMappings({});
        setIsAutoNormalizeModalOpen(true);
    };

    const handleApplyAutoNormalize = async (e) => {
        e.preventDefault();
        setIsBulkLoading(true);
        
        try {
            const promises = [];
            
            Object.entries(jobMappings).forEach(([weirdJob, newStandardJob]) => {
                if (!newStandardJob) return; 
                
                const membersToUpdate = unmappedGroups[weirdJob] || [];
                
                membersToUpdate.forEach(m => {
                    const level = m._level;
                    const upsertFn = level === 'federal' ? upsertFederalCoordinator : 
                                     level === 'state' ? upsertStateCoordinator : upsertLocalityCoordinator;
                    
                    const payload = { ...m };
                    delete payload._level; 
                    
                    payload.jobTitle = newStandardJob;
                    payload.jobTitleOther = ''; 
                    
                    promises.push(upsertFn(payload));
                });
            });
            
            await Promise.all(promises);
            setIsAutoNormalizeModalOpen(false);
            
            fetchFederalCoordinators(true);
            fetchStateCoordinators(true);
            fetchLocalityCoordinators(true);
            setFeedbackModal({ isOpen: true, type: 'success', message: 'Normalization applied successfully.' });
            
        } catch (err) {
            console.error("Auto normalize failed", err);
            setFeedbackModal({ isOpen: true, type: 'error', message: 'Failed to apply normalization.' });
        } finally {
            setIsBulkLoading(false);
        }
    };


    // --- SELECTION HANDLERS ---
    const toggleSelection = (id) => {
        const newSet = new Set(selectedMemberIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedMemberIds(newSet);
    };

    const toggleSelectAll = (e) => {
        if (e.target.checked && filteredMembers.length > 0) {
            setSelectedMemberIds(new Set(filteredMembers.map(m => m.id)));
        } else {
            setSelectedMemberIds(new Set());
        }
    };
    
    // --- APPROVE/REJECT LOGIC ---
    const handleOpenLinkModal = async () => { setIsLinkModalOpen(true); fetchCoordinatorApplicationSettings(); };
    const handleToggleLinkStatus = async () => {
        try {
            const newStatus = !coordinatorApplicationSettings.isActive;
            await updateCoordinatorApplicationStatus(newStatus);
            fetchCoordinatorApplicationSettings(true); 
        } catch (error) { console.error("Failed to update link status:", error); }
    };
    
    const handleApproveSubmission = async (submission) => {
        const approveFnMap = { federal: approveFederalSubmission, state: approveCoordinatorSubmission, locality: approveLocalitySubmission };
        if (!filters.level) return;
        const currentUser = auth.currentUser;
        if (!currentUser) return setFeedbackModal({ isOpen: true, type: 'error', message: 'Error: You must be logged in to approve submissions.' });
        
        setIsActionDisabled(true); // Disable global action buttons
        try {
            const approveFn = approveFnMap[filters.level];
            const approverInfo = { uid: currentUser.uid, email: currentUser.email, approvedAt: new Date() };
            let newRole = null;
            const roleFromForm = submission.role;
            const isManagerOrHead = roleFromForm === 'مدير البرنامج' || roleFromForm === 'رئيس وحدة';
            if (filters.level === 'federal') newRole = isManagerOrHead ? 'federal_manager' : 'federal_coordinator';
            else if (filters.level === 'state') newRole = isManagerOrHead ? 'states_manager' : 'state_coordinator';
            else if (filters.level === 'locality') newRole = 'locality_manager';

            await approveFn(submission, approverInfo);
            if (newRole && submission.email) {
                 try { await updateUserRoleByEmail(submission.email, newRole, submission.state, submission.locality); } 
                 catch (roleError) { alert(`Approved, but role assignment failed. \n\nError: ${roleError.message}`); }
            }
            fetchersByLevel[filters.level].listPending(true); 
            fetchersByLevel[filters.level].list(true); 
            setFeedbackModal({ isOpen: true, type: 'success', message: 'Submission approved successfully.' });
        } catch (error) { 
            console.error("Error approving:", error); 
            setFeedbackModal({ isOpen: true, type: 'error', message: 'Failed to approve submission.' }); 
        }
    };

    const handleRejectSubmission = async (submissionId) => {
        const rejectFnMap = { federal: rejectFederalSubmission, state: rejectCoordinatorSubmission, locality: rejectLocalitySubmission };
        if (!filters.level) return;
        if (!auth.currentUser) return setFeedbackModal({ isOpen: true, type: 'error', message: 'Error: You must be logged in.' });
        
        if (window.confirm("Are you sure you want to reject this submission?")) {
            setIsActionDisabled(true); // Disable global action buttons
            try {
                const rejectFn = rejectFnMap[filters.level];
                const rejecterInfo = { uid: auth.currentUser.uid, email: auth.currentUser.email, rejectedAt: new Date() };
                await rejectFn(submissionId, rejecterInfo);
                fetchersByLevel[filters.level].listPending(true); 
                setFeedbackModal({ isOpen: true, type: 'success', message: 'Submission rejected successfully.' });
            } catch (error) { 
                console.error("Error rejecting:", error); 
                setFeedbackModal({ isOpen: true, type: 'error', message: 'Failed to reject submission.' }); 
            }
        }
    };
    
    const selectAllNode = (
        <input 
            type="checkbox" 
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            checked={filteredMembers.length > 0 && selectedMemberIds.size === filteredMembers.length}
            onChange={toggleSelectAll}
            title="Select All"
        />
    );

    const tableHeaders = {
        state: [selectAllNode, 'الإسم', 'الولاية', 'المسمى الوظيفي', 'الصفة', 'الوحدة', 'Actions'],
        federal: [selectAllNode, 'الإسم', 'المسمى الوظيفي', 'الصفة', 'الوحدة', 'Actions'],
        locality: [selectAllNode, 'الإسم', 'الولاية', 'المحلية', 'المسمى الوظيفي', 'Actions'],
    };
    
    const currentLevelData = dataByLevel[filters.level] || { members: null, pending: null, loading: true, pendingLoading: true };

    const allJobTitles = useMemo(() => {
        const jobs = new Set();
        [...(federalCoordinators || []), ...(stateCoordinators || []), ...(localityCoordinators || [])].forEach(m => {
            const actualJob = m.jobTitle === 'اخرى' ? m.jobTitleOther : m.jobTitle;
            if (actualJob) jobs.add(actualJob);
        });
        return Array.from(jobs).sort();
    }, [federalCoordinators, stateCoordinators, localityCoordinators]);

    return (
        <div>
            {/* Custom Confirm Delete Modal */}
            <Modal isOpen={deleteConfig.isOpen} onClose={() => setDeleteConfig({ isOpen: false, type: null, level: null, id: null })} title="Confirm Deletion">
                <div className="p-4 text-center text-lg font-medium text-gray-800">
                    {deleteConfig.type === 'bulk' 
                        ? `Are you sure you want to delete ${selectedMemberIds.size} selected members?` 
                        : "Are you sure you want to delete this team member?"}
                    <p className="text-sm text-red-500 mt-2">This action cannot be undone.</p>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setDeleteConfig({ isOpen: false, type: null, level: null, id: null })}>Cancel</Button>
                    <Button variant="danger" onClick={confirmDeleteExecute}>Yes, Delete</Button>
                </div>
            </Modal>

            {/* Feedback Message Modal (Centralized Feedback handler locking actions) */}
            <Modal isOpen={feedbackModal.isOpen} onClose={closeFeedbackModal} title={feedbackModal.type === 'success' ? 'نجاح (Success)' : 'تنبيه (Notice)'}>
                <div className={`p-4 text-center text-lg font-medium ${feedbackModal.type === 'success' ? 'text-green-600' : 'text-red-600'}`} dir="rtl">
                    {feedbackModal.message}
                </div>
                <div className="mt-6 flex justify-end">
                    <Button onClick={closeFeedbackModal} variant={feedbackModal.type === 'success' ? 'success' : 'secondary'}>
                        حسناً (OK)
                    </Button>
                </div>
            </Modal>

            {/* TABS RENDERED FIRST */}
            <div className="border-b border-gray-200 mb-6 pb-2">
                 <div className="flex items-center gap-6">
                    <nav className="-mb-px flex items-center gap-6" aria-label="Tabs">
                        <Button variant="tab" isActive={activeTab === 'members'} onClick={() => setActiveTab('members')}>Team Members</Button>
                        {permissions?.canApproveSubmissions && (
                            <Button variant="tab" isActive={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
                                Pending Approvals 
                                <span className="ml-2 bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                    {currentLevelData.pending ? currentLevelData.pending.length : 0}
                                </span>
                            </Button>
                        )}
                        <Button variant="tab" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>Dashboard</Button>
                        
                        {permissions?.canApproveSubmissions && (
                            <Button variant="secondary" size="sm" onClick={handleOpenLinkModal}>Manage Submission Link</Button>
                        )}
                    </nav>
                </div>
            </div>

            {/* FILTERS SECTION JUST ABOVE CONTENT/KPI */}
            <div className="mb-6 flex flex-wrap items-end gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">
                {activeTab === 'members' && (
                    <FormGroup label={'\u00A0'}>
                        <div className="flex gap-2">
                            {permissions.canManageHumanResource && <Button onClick={handleAdd}>Add New Team Member</Button>}
                            {permissions.canManageHumanResource && <Button variant="secondary" onClick={handleOpenAutoNormalize}>Auto-Normalize Jobs</Button>}
                        </div>
                    </FormGroup>
                )}
                <div className="flex flex-wrap items-end gap-4 flex-grow">
                    {activeTab !== 'dashboard' && (
                        <FormGroup label="Filter by Level">
                            <Select value={filters.level} onChange={(e) => handleFilterChange('level', e.target.value)}>
                                {isFederal && <option value="federal">Federal</option>}
                                <option value="state">State</option>
                                <option value="locality">Locality</option>
                            </Select>
                        </FormGroup>
                    )}
                    {(activeTab === 'dashboard' || filters.level === 'state' || filters.level === 'locality') && (
                        <FormGroup label="State">
                            <Select value={filters.state} onChange={(e) => handleFilterChange('state', e.target.value)} disabled={!isFederal}>
                                <option value="">كل الولايات (All States)</option>
                                {Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{STATE_LOCALITIES[s]?.ar || s}</option>)}
                            </Select>
                        </FormGroup>
                    )}
                    {(activeTab === 'dashboard' || filters.level === 'locality') && (
                        <FormGroup label="Locality">
                            <Select value={filters.locality} onChange={(e) => handleFilterChange('locality', e.target.value)} disabled={!filters.state}>
                                <option value="">كل المحليات (All Localities)</option>
                                {(STATE_LOCALITIES[filters.state]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                            </Select>
                        </FormGroup>
                    )}
                    <FormGroup label="Job Description">
                        <Select value={filters.jobTitle} onChange={(e) => handleFilterChange('jobTitle', e.target.value)}>
                            <option value="">كل المسميات الوظيفية</option>
                            {allJobTitles.map(job => <option key={job} value={job}>{job}</option>)}
                        </Select>
                    </FormGroup>

                    {filters.level !== 'locality' && (
                        <>
                            <FormGroup label="Job Responsibilities (الصفة)">
                                <Select value={filters.role} onChange={(e) => handleFilterChange('role', e.target.value)}>
                                    <option value="">الكل (All)</option>
                                    <option value="مدير البرنامج">مدير البرنامج</option>
                                    <option value="رئيس وحدة">رئيس وحدة</option>
                                    <option value="عضو في وحدة">عضو في وحدة</option>
                                    <option value="سكرتارية">سكرتارية</option>
                                </Select>
                            </FormGroup>
                            
                            <FormGroup label="Unit (الوحدة)">
                                <Select value={filters.unit} onChange={(e) => handleFilterChange('unit', e.target.value)}>
                                    <option value="">الكل (All)</option>
                                    <option value="العلاج المتكامل للاطفال اقل من 5 سنوات">العلاج المتكامل للاطفال اقل من 5 سنوات</option>
                                    <option value="حديثي الولادة">حديثي الولادة</option>
                                    <option value="المراهقين وحماية الاطفال">المراهقين وحماية الاطفال</option>
                                    <option value="المتابعة والتقييم والمعلومات">المتابعة والتقييم والمعلومات</option>
                                    <option value="الامداد">الامداد</option>
                                    <option value="تعزيز صحة الاطفال والمراهقين">تعزيز صحة الاطفال والمراهقين</option>
                                </Select>
                            </FormGroup>
                        </>
                    )}
                </div>
            </div>
            
            {activeTab === 'dashboard' ? (
                <ProgramTeamDashboard 
                    federalCoordinators={federalCoordinators}
                    stateCoordinators={stateCoordinators}
                    localityCoordinators={localityCoordinators}
                    filters={filters}
                />
            ) : activeTab === 'members' ? ( 
                <Card>
                    <CardBody>
                        
                        {/* BULK ACTIONS BAR */}
                        {selectedMemberIds.size > 0 && (
                            <div className="bg-blue-50 p-3 mb-4 rounded-md flex items-center justify-between border border-blue-100">
                                <span className="text-blue-800 font-medium px-2">{selectedMemberIds.size} members selected</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="danger" onClick={handleBulkDeleteClick} disabled={isActionDisabled}>
                                        {isActionDisabled ? 'Processing...' : 'Delete Selected'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {currentLevelData.loading ? <Spinner /> : (
                            <Table headers={tableHeaders[filters.level]}>
                                {filteredMembers.length > 0 ? filteredMembers.map(c => {
                                    // Make sure locality in table is displayed in Arabic if applicable
                                    let locAr = c.locality;
                                    if (c.state && c.locality) {
                                        const locs = STATE_LOCALITIES[c.state]?.localities || [];
                                        const foundLoc = locs.find(l => l.en === c.locality);
                                        if (foundLoc) locAr = foundLoc.ar;
                                    }

                                    return (
                                    <tr key={c.id}>
                                        <td className="p-4 text-center w-10">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                checked={selectedMemberIds.has(c.id)}
                                                onChange={() => toggleSelection(c.id)}
                                            />
                                        </td>
                                        {/* CHANGED: Using Arabic Name if available, otherwise English Name */}
                                        <td className="p-4 text-sm">{c.nameAr || c.name}</td>
                                        {filters.level !== 'federal' && <td className="p-4 text-sm">{STATE_LOCALITIES[c.state]?.ar || c.state}</td>}
                                        {filters.level === 'locality' && <td className="p-4 text-sm">{locAr}</td>}
                                        <td className="p-4 text-sm">{c.jobTitle === 'اخرى' ? c.jobTitleOther : c.jobTitle}</td>
                                        {filters.level !== 'locality' && (
                                            <>
                                                <td className="p-4 text-sm">{c.role}</td>
                                                <td className="p-4 text-sm">{c.unit || '-'}</td>
                                            </>
                                        )}
                                        <td className="p-4 text-sm">
                                            <div className="flex gap-2">
                                                <Button variant="secondary" onClick={() => handleView(c)}>View</Button>
                                                <Button variant="secondary" onClick={() => handleShare(filters.level, c)}>Share</Button>
                                                {permissions.canManageHumanResource && <Button onClick={() => handleEdit(c)}>Edit</Button>}
                                                {permissions.canManageHumanResource && (
                                                    <Button variant="danger" onClick={() => handleDeleteSingleClick(filters.level, c.id)} disabled={isActionDisabled}>
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}) : (
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
                    isActionDisabled={isActionDisabled} 
                />
            )}

            {/* AUTO NORMALIZE JOB DESCRIPTION MODAL */}
            <Modal isOpen={isAutoNormalizeModalOpen} onClose={() => setIsAutoNormalizeModalOpen(false)} title="Auto-Detect & Normalize Job Descriptions" size="2xl">
                <form onSubmit={handleApplyAutoNormalize} className="space-y-4" dir="rtl">
                    <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-md border">
                        تم اكتشاف المسميات الوظيفية التالية غير المتطابقة مع القائمة القياسية. يرجى اختيار المسمى القياسي المناسب لكل منها. (يمكنك تجاهل ما لا تريد تغييره).
                    </p>
                    <div className="max-h-96 overflow-y-auto border rounded-md">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase border-b">المسمى غير القياسي (Unmapped)</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase border-b">عدد الأعضاء (Count)</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase border-b">تعيين إلى (Map To)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {Object.entries(unmappedGroups).map(([weirdJob, members]) => (
                                    <tr key={weirdJob} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{weirdJob}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900 font-bold">{members.length}</td>
                                        <td className="px-4 py-3">
                                            <Select 
                                                value={jobMappings[weirdJob] || ''} 
                                                onChange={(e) => setJobMappings({...jobMappings, [weirdJob]: e.target.value})}
                                            >
                                                <option value="">-- تجاهل (Ignore) --</option>
                                                {STANDARD_JOB_TITLES.map(standard => (
                                                    <option key={standard} value={standard}>{standard}</option>
                                                ))}
                                            </Select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsAutoNormalizeModalOpen(false)}>إلغاء (Cancel)</Button>
                        <Button type="submit" disabled={isBulkLoading || Object.keys(jobMappings).length === 0}>{isBulkLoading ? 'جاري التطبيق...' : 'تطبيق التحديثات (Apply)'}</Button>
                    </div>
                </form>
            </Modal>

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
                    <TeamMemberView level={editingMember.level || filters.level} member={editingMember} originalMember={originalMember} onBack={handleCloseModal} />
                )}
                {modalMode === 'edit' && (
                    <TeamMemberForm member={editingMember} onSave={handleSave} onCancel={handleCloseModal} />
                )}
            </Modal>
        </div>
    );
}

export function TeamMemberApplicationForm() {
    const [formData, setFormData] = useState({
        name: '', nameAr: '', phone: '', email: '', state: '', locality: '', 
        jobTitle: '', jobTitleOther: '', role: '', directorDate: '', unit: '', 
        joinDate: '', bankAccount: '', bankName: '', bankBranch: '', accountHolder: '', comments: '',
        previousRoles: [{ role: '', duration: '' }],
        isUserEmail: false,
    });
    
    const [selectedLevel, setSelectedLevel] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const levelFromUrl = params.get('level');
            if (['federal', 'state', 'locality'].includes(levelFromUrl)) {
                return levelFromUrl;
            }
        }
        return '';
    }); 
    
    const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, type: 'success', message: '' });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [isLinkActive, setIsLinkActive] = useState(false);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isUpdate, setIsUpdate] = useState(false);

    // Helper function to find existing profiles or pending submissions
    const checkUserRecords = async (email) => {
        // 1. Check for approved profiles
        const approvedCollections = [
            { coll: 'federalCoordinators', level: 'federal' },
            { coll: 'stateCoordinators', level: 'state' },
            { coll: 'localityCoordinators', level: 'locality' }
        ];
        
        for (const { coll, level } of approvedCollections) {
            const q = query(collection(db, coll), where("email", "==", email));
            const snap = await getDocs(q);
            if (!snap.empty) {
                return { data: { id: snap.docs[0].id, ...snap.docs[0].data() }, level, isApproved: true };
            }
        }
        
        // 2. Check for pending submissions
        const pendingCollections = [
            { coll: 'pendingFederalSubmissions', level: 'federal' },
            { coll: 'pendingStateSubmissions', level: 'state' },
            { coll: 'pendingLocalitySubmissions', level: 'locality' }
        ];
        
        for (const { coll, level } of pendingCollections) {
            const q = query(collection(db, coll), where("email", "==", email));
            const snap = await getDocs(q);
            if (!snap.empty) {
                return { data: { id: snap.docs[0].id, ...snap.docs[0].data() }, level, isApproved: false, collName: coll };
            }
        }
        return null;
    };

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

                // Fetch existing data if any (approved or pending)
                const record = await checkUserRecords(user.email);
                
                if (record) {
                    setSelectedLevel(record.level);
                    
                    // Ensure previousRoles has at least one empty entry if missing
                    let previousRoles = record.data.previousRoles;
                    if (!previousRoles || !Array.isArray(previousRoles) || previousRoles.length === 0) {
                        previousRoles = [{ role: '', duration: '' }];
                    }

                    setFormData(prev => ({ 
                        ...prev, 
                        ...record.data, 
                        previousRoles,
                        email: user.email, 
                        isUserEmail: true,
                        pendingCollName: !record.isApproved ? record.collName : null 
                    }));
                    setIsUpdate(record.isApproved);
                }
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

    const showFeedback = (type, message) => {
        setFeedbackModal({ isOpen: true, type, message });
    };

    const handleCloseFeedbackModal = () => {
        setFeedbackModal(prev => ({ ...prev, isOpen: false }));
        if (feedbackModal.type === 'success') {
            setSubmitted(true);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedLevel) {
            showFeedback('error', 'الرجاء اختيار المستوى الذي تتقدم إليه.');
            return;
        }

        if (!formData.name || !formData.email) {
            showFeedback('error', 'الرجاء تعبئة الإسم والإيميل على الأقل.');
            return;
        }
        if (selectedLevel !== 'federal' && !formData.state) {
             showFeedback('error', 'الولاية مطلوبة للمستويات الولائية والمحلية.');
             return;
        }
        if (selectedLevel === 'locality' && !formData.locality) {
             showFeedback('error', 'المحلية مطلوبة للمستوى المحلي.');
             return;
        }
        if (selectedLevel !== 'locality' && !formData.role) {
             showFeedback('error', 'الصفة مطلوبة للمستويات الاتحادية والولائية.');
             return;
        }

        setSubmitting(true);
        try {
            let payload = { ...formData };
            payload.previousRoles = payload.previousRoles.filter(exp => exp.role && exp.role.trim() !== '');
            delete payload.isUserEmail; 
            delete payload.pendingCollName; // Ensure internal flag is removed
            
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

            if (formData.id && isUpdate) {
                // Update existing approved profile
                const upsertFn = upsertFnMap[selectedLevel];
                if (!upsertFn) throw new Error(`Invalid update level: ${selectedLevel}`);
                await upsertFn(payload);
                showFeedback('success', 'تم تحديث ملفك الشخصي بنجاح.');

            } else if (formData.id && formData.pendingCollName) {
                // Update existing pending submission to avoid duplicates
                const pendingRef = doc(db, formData.pendingCollName, formData.id);
                const updatePayload = { ...payload };
                delete updatePayload.id; // Prevent writing ID inside document body if not needed
                
                await updateDoc(pendingRef, updatePayload);
                showFeedback('success', 'تم تحديث استمارتك قيد المراجعة بنجاح.');

            } else {
                // Completely new submission
                const submitFn = submitFnMap[selectedLevel];
                if (!submitFn) throw new Error(`Invalid application level: ${selectedLevel}`);
                await submitFn(payload);
                showFeedback('success', 'تم إرسال معلوماتك بنجاح للمراجعة.');
            }

        } catch (err) {
            console.error("Submission failed:", err);
            showFeedback('error', `حدث خطأ أثناء الإرسال: ${err.message || 'الرجاء المحاولة مرة أخرى لاحقاً.'}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoadingStatus) return <Card><CardBody><div className="flex justify-center p-8"><Spinner /></div></CardBody></Card>;
    
    if (!isLinkActive) {
        return (
            <Card>
                <PageHeader title="معلومات فريق صحة الطفل" />
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

    return (
        <Card>
            <Modal isOpen={feedbackModal.isOpen} onClose={handleCloseFeedbackModal} title={feedbackModal.type === 'success' ? 'نجاح (Success)' : 'خطأ (Error)'}>
                <div className={`p-4 text-center text-lg font-medium ${feedbackModal.type === 'success' ? 'text-green-600' : 'text-red-600'}`} dir="rtl">
                    {feedbackModal.message}
                </div>
                <div className="mt-6 flex justify-end">
                    <Button onClick={handleCloseFeedbackModal} variant={feedbackModal.type === 'success' ? 'success' : 'secondary'}>
                        {feedbackModal.type === 'success' ? 'حسناً (OK)' : 'إغلاق (Close)'}
                    </Button>
                </div>
            </Modal>

            <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
                <CardBody>
                    <PageHeader 
                        title={isUpdate ? "تحديث معلومات فريق صحة الطفل" : "معلومات فريق صحة الطفل"}
                        subtitle={formData.pendingCollName && !isUpdate ? "لديك طلب قيد المراجعة. التعديل هنا سيقوم بتحديثه." : ""}
                    />
                    
                    {!selectedLevel && !isUpdate && !formData.pendingCollName && (
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
                            {submitting ? 'Submitting...' : (isUpdate || formData.pendingCollName ? 'تحديث المعلومات' : 'تسليم الاستمارة')}
                        </Button>
                    </CardFooter>
                )}
            </form>
        </Card>
    );
}

// Public View Component with dedicated bordered sections and BLUE styled headers
export function PublicTeamMemberProfileView({ member, level }) {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const publicLink = window.location.href;

    const renderDetail = (label, value) => {
        if (!value) return null;
        return (
            <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-4">
                <dt className="text-sm font-medium text-gray-600">{label}</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value}</dd>
            </div>
        );
    };

    const renderSection = (title, content) => (
        <div className="mb-6 p-5 border border-gray-200 shadow-sm rounded-lg bg-white">
            <h3 className="text-lg font-semibold text-blue-800 bg-blue-100 px-4 py-2 rounded-md mb-4">{title}</h3>
            <dl className="divide-y divide-gray-100">
                {content}
            </dl>
        </div>
    );

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
            <CardBody dir="rtl">
                <div className="mt-4">
                    {renderSection("البيانات الأساسية",
                        <>
                            {level !== 'federal' && renderDetail('الولاية', STATE_LOCALITIES[normalizeState(member.state)]?.ar || member.state)}
                            {level === 'locality' && renderDetail('المحلية', member.locality)}
                            {renderDetail('الإسم (باللغة الإنجليزية)', member.name)}
                            {renderDetail('الإسم (باللغة العربية)', member.nameAr)}
                            {renderDetail('رقم الهاتف', member.phone)}
                            {renderDetail('الايميل', member.email)}
                        </>
                    )}

                    {renderSection("البيانات الوظيفية",
                        <>
                            {renderDetail('المسمى الوظيفي', member.jobTitle === 'اخرى' ? member.jobTitleOther : member.jobTitle)}
                            {level !== 'locality' && renderDetail('الصفة', member.role)}
                            {level !== 'locality' && member.role === 'مدير البرنامج' && renderDetail('تاريخ التعيين مدير للبرنامج', member.directorDate)}
                            {level !== 'locality' && (member.role === 'رئيس وحدة' || member.role === 'عضو في وحدة') && renderDetail('الوحدة', member.unit)}
                            {level !== 'locality' && renderDetail(level === 'federal' ? 'تاريخ الانضمام للبرنامج الاتحادي' : 'تاريخ الانضمام لبرنامج الولاية', member.joinDate)}
                        </>
                    )}

                    {renderSection("الخبرات السابقة",
                        <div className="py-3">
                            {Array.isArray(member.previousRoles) && member.previousRoles.some(e => e.role) ? (
                                <ul className="list-disc pl-5 pr-5 space-y-1 text-sm text-gray-900">
                                    {member.previousRoles.map((exp, index) => (
                                        exp.role && <li key={index}><strong>{exp.role}</strong> ({exp.duration || 'N/A'})</li>
                                    ))}
                                </ul>
                            ) : <span className="text-sm text-gray-500">لا توجد خبرات مسجلة</span>}
                        </div>
                    )}

                    {renderSection("ملاحظات إضافية",
                        <>
                            {renderDetail('اي تعليقات اخرى', member.comments)}
                        </>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}