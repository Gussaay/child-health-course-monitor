// FacilityForms.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, Search, Building2, MapPin, X, CheckCircle, WifiOff, XCircle, ArrowRightLeft } from 'lucide-react';
import { db } from '../firebase'; 
import { collection, getDocs, doc } from 'firebase/firestore'; 
import { getFunctions, httpsCallable } from 'firebase/functions'; 

import {
    Card, PageHeader, Button, FormGroup, Input, Select,
    Spinner, Checkbox, Modal
} from './CommonComponents';
import {
    getHealthFacilityById,
    listHealthFacilities,
    submitFacilityDataForApproval,
    listPendingFacilitySubmissions 
} from "../data.js";
import {
    STATE_LOCALITIES
} from "./constants.js";

const SERVICE_LABELS = {
    'imnci_staff': 'العلاج المتكامل (IMNCI)',
    'eenc_staff': 'الرعاية الطارئة (EENC)',
    'neonatal_staff': 'وحدة حديثي الولادة (Neonatal)',
    'critical_staff': 'طوارئ الأطفال (ETAT)'
};

// --- NEW STATUS MODAL ---
export const SaveStatusModal = ({ statusData, onClose }) => {
    if (!statusData) return null;
    
    const isSuccess = statusData.status === 'success';
    const isQueued = statusData.status === 'queued';
    const isError = statusData.status === 'error';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 animate-fade-in" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform scale-100 transition-transform">
                {isSuccess && <div className="text-green-500 mb-4 flex justify-center"><CheckCircle className="w-16 h-16" /></div>}
                {isQueued && <div className="text-amber-500 mb-4 flex justify-center"><WifiOff className="w-16 h-16" /></div>}
                {isError && <div className="text-red-500 mb-4 flex justify-center"><XCircle className="w-16 h-16" /></div>}
                
                <h3 className="text-xl font-extrabold mb-2 text-gray-800">
                    {isSuccess && 'تم الحفظ بنجاح'}
                    {isQueued && 'تم الحفظ محلياً'}
                    {isError && 'فشل الحفظ'}
                </h3>
                <p className="text-gray-600 mb-6 text-sm font-medium">
                    {isSuccess && 'تم حفظ بيانات المنشأة في النظام وتحديثها بنجاح.'}
                    {isQueued && 'أنت غير متصل بالإنترنت حالياً. تم حفظ البيانات بأمان على جهازك وستتم المزامنة تلقائياً عند عودة الاتصال.'}
                    {isError && `عذراً، حدث خطأ أثناء الحفظ: ${statusData.message}`}
                </p>
                <Button onClick={onClose} className="w-full font-bold py-3 text-lg rounded-xl">حسناً (OK)</Button>
            </div>
        </div>
    );
};

// --- PENDING BADGE COMPONENT ---
export const PendingBadge = ({ fieldKey, pendingData, currentData, valueMap }) => {
    if (!pendingData || pendingData[fieldKey] === undefined) return null;
    
    // Normalize values to prevent false positives (treats undefined, null, and "" as identical)
    const norm = (v) => (v === undefined || v === null) ? '' : String(v).trim();
    if (norm(pendingData[fieldKey]) === norm(currentData[fieldKey])) return null;

    let displayVal = pendingData[fieldKey];
    
    if (valueMap && valueMap[displayVal]) displayVal = valueMap[displayVal];
    else if (displayVal === 'Yes') displayVal = 'نعم';
    else if (displayVal === 'No') displayVal = 'لا';
    else if (displayVal === 'Planned') displayVal = 'مخططة';

    return (
        <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="تحديث معلق في انتظار الموافقة">
            ⏳ تحديث معلق: {displayVal}
        </span>
    );
};

// --- PUBLIC-FACING FORMS ---
export function PublicFacilityUpdateForm({ setToast, serviceType }) {
    const [initialData, setInitialData] = useState(null);
    const [pendingData, setPendingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusData, setStatusData] = useState(null); 

    useEffect(() => {
        const path = window.location.pathname;
        const match = path.match(/^\/facilities\/data-entry\/([a-zA-Z0-9]+)\/?$/);
        if (match && match[1]) {
            const id = match[1];
            const fetchFacility = async () => {
                try {
                    const facility = await getHealthFacilityById(id);
                    if (facility) {
                        setInitialData(facility);
                        
                        // Fetch pending submissions to show the badge
                        const pendingSubs = await listPendingFacilitySubmissions();
                        const facilityPending = pendingSubs.filter(s => 
                            s['اسم_المؤسسة'] === facility['اسم_المؤسسة'] && 
                            s['الولاية'] === facility['الولاية'] && 
                            s['المحلية'] === facility['المحلية']
                        ).sort((a,b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0))[0];
                        
                        setPendingData(facilityPending || null);
                    } else {
                        setError('Facility not found. The link may be invalid or the facility has been deleted.');
                    }
                } catch (err) {
                    setError('Failed to load facility data.');
                } finally {
                    setLoading(false);
                }
            };
            fetchFacility();
        } else {
            setError('Invalid facility link.');
            setLoading(false);
        }
    }, []);

    const FORM_KEY_TO_COMPONENT = {
        'imnci': IMNCIFormFields,
        'eenc': EENCFormFields,
        'neonatal': NeonatalFormFields,
        'critical': CriticalCareFormFields,
        'critical care': CriticalCareFormFields,
    };
    
    const FormComponent = FORM_KEY_TO_COMPONENT[serviceType?.toLowerCase()] || IMNCIFormFields;

    const handleSave = async (formData) => {
        try {
            const isUpdate = !!initialData?.id; 
            await submitFacilityDataForApproval(formData);
            setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });

            if (navigator.onLine) {
                try {
                    const currentUser = getAuth().currentUser;
                    let submitterName = formData.submitterName || formData.submitterEmail || 'A public user';
                    let submitterRole = 'Public User';

                    if (currentUser) {
                        submitterName = currentUser.displayName || currentUser.email || submitterName;
                        submitterRole = 'Registered User';
                    }

                    const actionText = isUpdate ? 'updated the' : 'submitted a new';
                    const notifTitle = isUpdate ? 'Facility Updated' : 'New Facility Added';
                    const notifBody = `${submitterName} (${submitterRole}) has ${actionText} facility: ${formData['اسم_المؤسسة']}.`;

                    const functions = getFunctions(db.app);
                    const sendFCMNotification = httpsCallable(functions, 'sendFCMNotification');
                    
                    sendFCMNotification({
                        targetUserId: 'managers_and_super_users',
                        title: notifTitle,
                        body: notifBody,
                        data: {
                            actionView: 'childHealthServices'
                        }
                    }).catch(e => console.warn("FCM Send Error:", e));
                    
                } catch (fcmError) {
                    console.warn("FCM Error", fcmError);
                }
            }
        } catch (error) {
            setStatusData({ status: 'error', message: error.message });
        }
    };

    const handleCloseStatusModal = () => {
        const wasSuccessOrQueued = statusData?.status !== 'error';
        setStatusData(null);
        if (wasSuccessOrQueued) {
            window.history.back();
        }
    };

    if (loading) return <div className="p-8 text-center"><Spinner /></div>;
    if (error) return <div className="p-8 text-center text-red-600 bg-red-50 border border-red-200 rounded-md">{error}</div>;

    return (
        <div className="min-h-screen bg-sky-50 p-4 sm:p-6 lg:p-8 flex justify-center">
            <div className="w-full max-w-7xl">
                <GenericFacilityForm
                    initialData={initialData}
                    pendingData={pendingData}
                    onSave={handleSave}
                    onCancel={() => window.history.back()}
                    setToast={setToast}
                    title="بيانات المنشأة الصحية"
                    subtitle={`تحديث تفاصيل المنشأة: ${initialData?.['اسم_المؤسسة'] || ''}`}
                    isPublicForm={true}
                >
                    {(props) => <FormComponent {...props} />}
                </GenericFacilityForm>
            </div>
            <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
        </div>
    );
}

// ... SearchableSelect ...
const SearchableSelect = ({ options, value, onChange, placeholder = "اختر من القائمة...", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const selectedOption = options.find(option => option.value === value);

    const handleSelect = (optionValue) => {
        onChange({ target: { name: 'facilityId', value: optionValue } });
        setIsOpen(false);
        setSearchTerm('');
    };

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(option =>
            option.value === 'addNew' || 
            (option.label && option.label.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [searchTerm, options]);

    const groupedOptions = useMemo(() => {
        const groups = { ungrouped: [] };
        filteredOptions.forEach(option => {
            const groupName = option.group || 'ungrouped';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(option);
        });
        return { ungrouped: groups.ungrouped, ...Object.fromEntries(Object.entries(groups).filter(([key]) => key !== 'ungrouped')) };
    }, [filteredOptions]);

    return (
        <>
            <button
                type="button"
                className="w-full text-right bg-white border-2 border-gray-200 rounded-xl shadow-sm pl-3 pr-10 py-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all disabled:bg-gray-100"
                onClick={() => setIsOpen(true)}
                disabled={disabled}
            >
                <span className="block truncate font-medium text-gray-700">
                    {selectedOption ? selectedOption.label : <span className="text-gray-400">{placeholder}</span>}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden transform transition-all">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-sky-50">
                            <h3 className="font-bold text-sky-900 text-lg">البحث عن منشأة</h3>
                            <button type="button" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-white rounded-full shadow-sm border border-gray-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-4 border-b border-gray-100 bg-white">
                            <div className="relative">
                                <Input
                                    type="search"
                                    placeholder="ابحث باسم المنشأة..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-sky-500 focus:border-sky-500 shadow-inner"
                                    autoFocus
                                />
                                <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                            </div>
                        </div>
                        
                        <ul role="listbox" className="overflow-y-auto flex-1 p-3 space-y-1 bg-gray-50/30">
                            {Object.entries(groupedOptions).map(([groupName, opts]) => (
                                <React.Fragment key={groupName}>
                                    {groupName !== 'ungrouped' && opts.length > 0 && (
                                        <li className="text-sky-800 bg-sky-100/70 cursor-default select-none relative py-2 px-4 font-bold border border-sky-100 text-xs uppercase tracking-wider mt-3 mb-1 rounded-lg shadow-sm">
                                            {groupName}
                                        </li>
                                    )}
                                    {opts.map(option => (
                                        <li
                                            key={option.value}
                                            className={`cursor-pointer select-none relative py-3 px-4 rounded-xl hover:bg-sky-100 border border-transparent hover:border-sky-200 transition-colors ${option.className || 'bg-white shadow-sm mb-1'}`}
                                            onClick={() => handleSelect(option.value)}
                                        >
                                            <span className={`block truncate ${value === option.value ? 'font-bold text-sky-700' : 'font-medium text-gray-700'}`}>
                                                {option.label}
                                            </span>
                                        </li>
                                    ))}
                                </React.Fragment>
                            ))}
                            {filteredOptions.length === 0 && searchTerm && (
                                <li className="text-gray-500 cursor-default select-none relative py-8 px-4 text-center bg-gray-50 rounded-xl border border-gray-200 mt-2">
                                    لا توجد منشأة مطابقة لهذا البحث.
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            )}
        </>
    );
};

export function NewFacilityEntryForm({ setToast, serviceType }) {
    const [searchParams] = useState(new URLSearchParams(window.location.search));
    
    let formTypeKey = searchParams.get('service')?.toLowerCase() || serviceType?.toLowerCase() || 'imnci';
    if (formTypeKey === 'critical care') formTypeKey = 'critical';

    const hideAddNew = searchParams.get('hideAddNew') === 'true';
    const showBack = searchParams.get('showBack') === 'true';

    const TABS = { IMNCI: 'IMNCI Services', EENC: 'EENC Services', NEONATAL: 'Neonatal Care Unit', CRITICAL: 'Emergency & Critical Care' };
    const ARABIC_TITLES = { 
        [TABS.IMNCI]: "خدمات العلاج المتكامل لأمراض الطفولة", 
        [TABS.EENC]: "خدمات الرعاية الطارئة لحديثي الولادة", 
        [TABS.NEONATAL]: "وحدة رعاية حديثي الولادة", 
        [TABS.CRITICAL]: "الطوارئ والرعاية الحرجة" 
    };
    const FORM_KEY_TO_TAB_CONSTANT = { 'imnci': TABS.IMNCI, 'eenc': TABS.EENC, 'neonatal': TABS.NEONATAL, 'critical': TABS.CRITICAL };
    const serviceTitle = ARABIC_TITLES[FORM_KEY_TO_TAB_CONSTANT[formTypeKey]] || "بيانات المنشأة الصحية";

    const [step, setStep] = useState('selection');
    const [formInitialData, setFormInitialData] = useState(null);
    const [pendingData, setPendingData] = useState(null);
    const [selectionData, setSelectionData] = useState({ state: searchParams.get('state') || '', locality: searchParams.get('locality') || '', facilityId: '' });
    const [facilitiesWithService, setFacilitiesWithService] = useState([]);
    const [facilitiesWithoutService, setFacilitiesWithoutService] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showOtherFacilities, setShowOtherFacilities] = useState(false);
    const [statusData, setStatusData] = useState(null);

    useEffect(() => {
        const fetchAndPartitionFacilities = async () => {
            if (selectionData.state && selectionData.locality) {
                const partitionFacilities = (allFacilities) => {
                    const withService = [];
                    const withoutService = [];

                    allFacilities.forEach(f => {
                        let hasService = false;
                        const facilityType = f['نوع_المؤسسةالصحية'];
                        const isPHC = facilityType === 'مركز صحة الاسرة' || facilityType === 'وحدة صحة الاسرة';
                        const isHospital = facilityType === 'مستشفى' || facilityType === 'مستشفى ريفي';

                        switch (formTypeKey) {
                            case 'imnci': hasService = f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes' || isPHC; break;
                            case 'eenc': hasService = f.eenc_provides_essential_care === 'Yes' || isHospital; break;
                            case 'neonatal': hasService = f.neonatal_level_primary === 'Yes' || f.neonatal_level_secondary === 'Yes' || f.neonatal_level_tertiary === 'Yes' || isHospital; break;
                            case 'critical': hasService = f.etat_has_service === 'Yes' || f.hdu_has_service === 'Yes' || f.picu_has_service === 'Yes' || isHospital; break;
                        }
                        if (hasService) withService.push(f);
                        else withoutService.push(f);
                    });
                    
                    setFacilitiesWithService(withService);
                    setFacilitiesWithoutService(withoutService);
                    if (withService.length === 0) setShowOtherFacilities(true);
                };

                let cachedData = [];
                try { cachedData = await listHealthFacilities({ state: selectionData.state, locality: selectionData.locality }, { source: 'cache' }); } catch (e) {}

                if (cachedData && cachedData.length > 0) {
                    partitionFacilities(cachedData);
                    setIsLoading(false);
                } else {
                    setIsLoading(true);
                }

                try {
                    const freshData = await listHealthFacilities({ state: selectionData.state, locality: selectionData.locality });
                    partitionFacilities(freshData);
                } catch (error) {
                    if (!cachedData || cachedData.length === 0) setToast({ show: true, message: 'Could not fetch list.', type: 'error' });
                } finally {
                    setIsLoading(false);
                }
            }
        };
        fetchAndPartitionFacilities();
    }, [selectionData.state, selectionData.locality, formTypeKey]);

    const facilityOptions = useMemo(() => {
        const options = [];
        if (!hideAddNew) {
            options.push({ value: 'addNew', label: '--- إضافة منشأة جديدة ---', className: 'font-bold text-sky-700 bg-sky-50 text-center border border-sky-200' });
        }
        facilitiesWithService.forEach(f => options.push({ value: f.id, label: f['اسم_المؤسسة'] }));
        if (showOtherFacilities) {
            facilitiesWithoutService.forEach(f => options.push({ value: f.id, label: f['اسم_المؤسسة'], group: facilitiesWithService.length > 0 ? 'منشآت أخرى في هذه المحلية' : 'جميع المنشآت في المحلية' }));
        }
        return options;
    }, [hideAddNew, showOtherFacilities, facilitiesWithService, facilitiesWithoutService]);

    const handleProceed = async () => {
        if (!selectionData.facilityId) return;
        if (selectionData.facilityId === 'addNew') {
            setFormInitialData({ 'الولاية': selectionData.state, 'المحلية': selectionData.locality });
            setPendingData(null);
            setStep('form');
        } else {
            setIsLoading(true);
            try {
                const data = await getHealthFacilityById(selectionData.facilityId);
                setFormInitialData(data);
                
                // Fetch pending submissions to show the badge
                const pendingSubs = await listPendingFacilitySubmissions();
                const facilityPending = pendingSubs.filter(s => 
                    s['اسم_المؤسسة'] === data['اسم_المؤسسة'] && 
                    s['الولاية'] === data['الولاية'] && 
                    s['المحلية'] === data['المحلية']
                ).sort((a,b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0))[0];
                
                setPendingData(facilityPending || null);

                setStep('form');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSave = async (formData) => {
        try {
            const isUpdate = !!formInitialData?.id; 
            await submitFacilityDataForApproval(formData);
            setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });

            if (navigator.onLine) {
                try {
                    const currentUser = getAuth().currentUser;
                    let submitterName = formData.submitterName || formData.submitterEmail || 'A public user';
                    let submitterRole = 'Public User';

                    if (currentUser) {
                        submitterName = currentUser.displayName || currentUser.email || submitterName;
                        submitterRole = 'Registered User';
                    }

                    const actionText = isUpdate ? 'updated the' : 'submitted a new';
                    const notifTitle = isUpdate ? 'Facility Updated' : 'New Facility Added';
                    const notifBody = `${submitterName} (${submitterRole}) has ${actionText} facility: ${formData['اسم_المؤسسة']}.`;

                    const functions = getFunctions(db.app);
                    const sendFCMNotification = httpsCallable(functions, 'sendFCMNotification');
                    
                    sendFCMNotification({
                        targetUserId: 'managers_and_super_users',
                        title: notifTitle,
                        body: notifBody,
                        data: {
                            actionView: 'childHealthServices'
                        }
                    }).catch(e => console.warn("FCM Send Error:", e));

                } catch (fcmError) {
                    console.warn("FCM Error", fcmError);
                }
            }

        } catch (error) {
            setStatusData({ status: 'error', message: error.message });
        }
    };

    const handleCloseStatusModal = () => {
        const wasSuccessOrQueued = statusData?.status !== 'error';
        setStatusData(null);
        if (wasSuccessOrQueued) {
            setStep('selection');
        }
    };

    if (step === 'selection') {
        return (
            <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex flex-col items-center">
                <div className="w-full max-w-3xl space-y-4 animate-fade-in" dir="rtl">
                    {showBack && (
                        <div className="flex justify-start">
                            <Button variant="secondary" onClick={() => window.history.back()} className="flex items-center gap-2 font-bold px-6 py-2 rounded-lg border-2 border-gray-200 hover:bg-white shadow-sm">
                                <ArrowLeft className="w-5 h-5 ml-2" /> الرجوع للخلف
                            </Button>
                        </div>
                    )}
                    
                    <Card className="shadow-xl border-t-4 border-t-sky-500 overflow-hidden">
                        <div className="bg-gradient-to-r from-sky-50 to-white px-6 py-8 border-b border-sky-100 text-center flex flex-col items-center gap-3">
                            <Building2 className="text-sky-600 w-12 h-12" />
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-sky-900 leading-tight">
                                    {hideAddNew ? `تحديث بيانات: ${serviceTitle}` : `إدخال بيانات: ${serviceTitle}`}
                                </h2>
                                <p className="text-sky-700 mt-2 font-medium text-sm sm:text-base">
                                    الرجاء تحديد الولاية والمحلية لعرض المنشآت الصحية المتاحة
                                </p>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 space-y-8 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
                                <FormGroup label="الولاية (State)">
                                    <Select name="state" value={selectionData.state} onChange={(e) => setSelectionData({...selectionData, state: e.target.value, locality: '', facilityId: ''})} required className="border-gray-300 focus:ring-sky-500 focus:border-sky-500 shadow-sm rounded-xl">
                                        <option value="">-- اختر الولاية --</option>
                                        {Object.keys(STATE_LOCALITIES).map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>)}
                                    </Select>
                                </FormGroup>
                                <FormGroup label="المحلية (Locality)">
                                    <Select name="locality" value={selectionData.locality} onChange={(e) => setSelectionData({...selectionData, locality: e.target.value, facilityId: ''})} required disabled={!selectionData.state} className="border-gray-300 focus:ring-sky-500 focus:border-sky-500 shadow-sm rounded-xl">
                                        <option value="">-- اختر المحلية --</option>
                                        {selectionData.state && STATE_LOCALITIES[selectionData.state]?.localities.map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                                    </Select>
                                </FormGroup>
                            </div>

                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                                    <Spinner size="lg" />
                                    <span className="text-sky-700 font-bold tracking-wide">جاري تحميل قائمة المنشآت...</span>
                                </div>
                            ) : selectionData.locality && (
                                <div className="p-6 sm:p-8 border border-sky-200 rounded-xl bg-sky-50/60 space-y-6 mt-6 animate-fade-in shadow-inner">
                                    <FormGroup label={hideAddNew ? "اختر المنشأة المراد تحديث بياناتها:" : "اختر منشأة لتحديثها أو أضف واحدة جديدة:"}>
                                       <SearchableSelect
                                            value={selectionData.facilityId}
                                            onChange={(e) => setSelectionData({...selectionData, facilityId: e.target.value})}
                                            options={facilityOptions}
                                            placeholder="اضغط هنا للبحث واختيار منشأة..."
                                       />
                                    </FormGroup>

                                    {!showOtherFacilities && facilitiesWithoutService.length > 0 && (
                                        <div className="flex justify-start">
                                            <button type="button" onClick={() => setShowOtherFacilities(true)} className="text-sm font-bold text-sky-600 hover:text-sky-800 hover:underline focus:outline-none flex items-center gap-1.5 transition-colors bg-sky-100/50 px-4 py-2 rounded-lg border border-sky-200 shadow-sm">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                عرض جميع المنشآت المسجلة في المحلية ({facilitiesWithoutService.length})
                                            </button>
                                        </div>
                                    )}
                                    
                                    <div className="pt-4 flex justify-end">
                                        <Button 
                                            onClick={handleProceed} 
                                            disabled={!selectionData.facilityId} 
                                            className="px-10 py-3 font-bold text-lg shadow-md transition-transform active:scale-95 disabled:opacity-50 rounded-xl"
                                        >
                                            متابعة إلى الاستمارة &larr;
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    const FormComponent = { 'imnci': IMNCIFormFields, 'eenc': EENCFormFields, 'neonatal': NeonatalFormFields, 'critical': CriticalCareFormFields }[formTypeKey] || IMNCIFormFields;

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 flex flex-col items-center">
            <div className="w-full max-w-7xl space-y-4">
                <div className="flex justify-start" dir="rtl">
                    <Button variant="secondary" onClick={() => setStep('selection')} className="flex items-center gap-2 font-bold px-6 py-2 rounded-lg border-2 border-gray-200 hover:bg-white shadow-sm">
                        <ArrowLeft className="w-5 h-5 ml-2" /> العودة لاختيار المنشأة
                    </Button>
                </div>
                <GenericFacilityForm
                    initialData={formInitialData}
                    pendingData={pendingData}
                    onSave={handleSave}
                    onCancel={() => setStep('selection')}
                    setToast={setToast}
                    title={serviceTitle}
                    isPublicForm={true}
                >
                    {(props) => <FormComponent {...props} />}
                </GenericFacilityForm>
            </div>
            <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
        </div>
    );
}

// --- SharedFacilityFields ---
export const SharedFacilityFields = ({ formData, pendingData, handleChange, handleStateChange, isPublicForm = false, isReadOnly = false }) => {
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [locationError, setLocationError] = useState('');

    const handleFetchLocation = () => {
        if (!navigator.geolocation) {
            setLocationError('الجهاز أو المتصفح لا يدعم تحديد الموقع.');
            return;
        }
        setIsFetchingLocation(true);
        setLocationError('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                handleChange({ target: { name: '_الإحداثيات_latitude', value: latitude, type: 'number' } });
                handleChange({ target: { name: '_الإحداثيات_longitude', value: longitude, type: 'number' } });
                setIsFetchingLocation(false);
            },
            (error) => {
                console.error("Error fetching location", error);
                setLocationError('فشل في جلب الموقع. يرجى التأكد من تفعيل الـ GPS وصلاحيات المتصفح.');
                setIsFetchingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const stateMap = Object.keys(STATE_LOCALITIES).reduce((acc, key) => ({...acc, [key]: STATE_LOCALITIES[key].ar}), {});
    const localityMap = formData['الولاية'] ? STATE_LOCALITIES[formData['الولاية']]?.localities.reduce((acc, l) => ({...acc, [l.en]: l.ar}), {}) : {};

    return (
        <div className="space-y-8">
            <div className="border-2 border-sky-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="bg-sky-50 px-5 py-4 border-b border-sky-100 flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-sky-600" />
                    <h3 className="text-lg font-bold text-sky-800">البيانات الأساسية للمنشأة</h3>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormGroup label={<>الولاية <PendingBadge fieldKey="الولاية" pendingData={pendingData} currentData={formData} valueMap={stateMap} /></>}>
                            <Select name="الولاية" value={formData['الولاية'] || ''} onChange={handleStateChange} required disabled={isReadOnly}>
                                <option value="">اختر الولاية</option>
                                {Object.keys(STATE_LOCALITIES).map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label={<>المحلية <PendingBadge fieldKey="المحلية" pendingData={pendingData} currentData={formData} valueMap={localityMap} /></>}>
                            <Select name="المحلية" value={formData['المحلية'] || ''} onChange={handleChange} required disabled={!formData['الولاية'] || isReadOnly}>
                                <option value="">اختر المحلية</option>
                                {formData['الولاية'] && STATE_LOCALITIES[formData['الولاية']]?.localities.map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                            </Select>
                        </FormGroup>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormGroup label={<>اسم المؤسسة <PendingBadge fieldKey="اسم_المؤسسة" pendingData={pendingData} currentData={formData} /></>}>
                            <Input name="اسم_المؤسسة" value={formData['اسم_المؤسسة'] || ''} onChange={handleChange} required disabled={isReadOnly} className="border-2 border-gray-100" />
                        </FormGroup>
                        <FormGroup label={<>ملكية المؤسسة <PendingBadge fieldKey="facility_ownership" pendingData={pendingData} currentData={formData} /></>}>
                            <Select name="facility_ownership" value={formData.facility_ownership || ''} onChange={handleChange} disabled={isReadOnly}>
                                <option value="">اختر الملكية</option>
                                <option value="حكومي">حكومي</option>
                                <option value="خاص">خاص</option>
                                <option value="منظمات">منظمات</option>
                                <option value="اهلي">اهلي</option>
                            </Select>
                        </FormGroup>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormGroup label={<>نوع المؤسسة الصحية <PendingBadge fieldKey="نوع_المؤسسةالصحية" pendingData={pendingData} currentData={formData} /></>}>
                            <Select name="نوع_المؤسسةالصحية" value={formData['نوع_المؤسسةالصحية'] || ''} onChange={handleChange} disabled={isReadOnly}>
                                <option value="">اختر النوع</option>
                                <option value="مركز صحة الاسرة">مركز صحة الاسرة</option>
                                <option value="مستشفى ريفي">مستشفى ريفي</option>
                                <option value="وحدة صحة الاسرة">وحدة صحة الاسرة</option>
                                <option value="مستشفى">مستشفى</option>
                            </Select>
                        </FormGroup>
                        <FormGroup label={<>نوع الخدمات المقدمة <PendingBadge fieldKey="eenc_service_type" pendingData={pendingData} currentData={formData} valueMap={{'CEmONC':'مؤسسة طواري حمل وولادة شاملة','BEmONC':'مؤسسة طواري حمل وولادة أساسية','general':'خدمات عامة غير متخصصة','pediatric':'مستشفى اطفال متخصص'}}/></>}>
                            <Select name="eenc_service_type" value={formData.eenc_service_type || ''} onChange={handleChange} disabled={isReadOnly}>
                                <option value="">اختر النوع</option>
                                <option value="CEmONC">مؤسسة طواري حمل وولادة شاملة</option>
                                <option value="BEmONC">مؤسسة طواري حمل وولادة أساسية</option>
                                <option value="general">خدمات عامة غير متخصصة</option>
                                <option value="pediatric">مستشفى اطفال متخصص</option>
                            </Select>
                        </FormGroup>
                    </div>
                </div>
            </div>

            <div className="border-2 border-sky-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="bg-sky-50 px-5 py-4 border-b border-sky-100">
                    <h3 className="text-lg font-bold text-sky-800">حالة عمل المؤسسة</h3>
                </div>
                <div className="p-6 space-y-6">
                    <FormGroup label={<>هل المؤسسة تعمل؟ <PendingBadge fieldKey="هل_المؤسسة_تعمل" pendingData={pendingData} currentData={formData} /></>}>
                        <Select name="هل_المؤسسة_تعمل" value={formData['هل_المؤسسة_تعمل'] || ''} onChange={handleChange} disabled={isReadOnly} required>
                            <option value="">اختر...</option>
                            <option value="Yes">نعم</option>
                            <option value="No">لا</option>
                        </Select>
                    </FormGroup>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 bg-gray-50/50 border border-gray-100 rounded-xl space-y-4">
                            <FormGroup label={<>هل توجد حوافز للاستاف؟ <PendingBadge fieldKey="staff_incentives" pendingData={pendingData} currentData={formData} /></>}>
                                <Select name="staff_incentives" value={formData.staff_incentives || ''} onChange={handleChange} disabled={isReadOnly}>
                                    <option value="">اختر...</option>
                                    <option value="Yes">نعم</option>
                                    <option value="No">لا</option>
                                </Select>
                            </FormGroup>
                            {formData.staff_incentives === 'Yes' && (
                                <div className="animate-fade-in"><FormGroup label={<>ما هي المنظمة المقدم للحوافز؟ <PendingBadge fieldKey="staff_incentives_organization" pendingData={pendingData} currentData={formData} /></>}><Input type="text" name="staff_incentives_organization" value={formData.staff_incentives_organization || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup></div>
                            )}
                        </div>
                        <div className="p-5 bg-gray-50/50 border border-gray-100 rounded-xl space-y-4">
                            <FormGroup label={<>هل تشارك المؤسسة في أي مشروع؟ <PendingBadge fieldKey="project_participation" pendingData={pendingData} currentData={formData} /></>}>
                                <Select name="project_participation" value={formData.project_participation || ''} onChange={handleChange} disabled={isReadOnly}>
                                    <option value="">اختر...</option>
                                    <option value="Yes">نعم</option>
                                    <option value="No">لا</option>
                                </Select>
                            </FormGroup>
                            {formData.project_participation === 'Yes' && (
                                <div className="animate-fade-in"><FormGroup label={<>ما هو اسم المشروع؟ <PendingBadge fieldKey="project_name" pendingData={pendingData} currentData={formData} /></>}><Input type="text" name="project_name" value={formData.project_name || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup></div>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <FormGroup label={<>رقم هاتف المسئول من المؤسسة <PendingBadge fieldKey="person_in_charge_phone" pendingData={pendingData} currentData={formData} /></>}>
                            <Input type="tel" name="person_in_charge_phone" value={formData.person_in_charge_phone || ''} onChange={handleChange} disabled={isReadOnly} />
                        </FormGroup>
                    </div>
                </div>
            </div>

            {!isPublicForm && (
                <div className="border-2 border-sky-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-sky-50 px-5 py-4 border-b border-sky-100 flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-sky-600" />
                        <h3 className="text-lg font-bold text-sky-800">الإحداثيات الجغرافية</h3>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        {!isReadOnly && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <h4 className="text-amber-800 font-bold mb-1 flex items-center gap-2">
                                            <span>تحديث الموقع التلقائي</span>
                                        </h4>
                                        <p className="text-sm text-amber-700 font-medium leading-relaxed">
                                            ⚠️ الرجاء استخدام هذا الزر <span className="font-bold underline">فقط</span> إذا كنت متواجداً حالياً داخل المنشأة الصحية لمنع تسجيل إحداثيات خاطئة.
                                        </p>
                                        {locationError && <p className="text-sm text-red-600 mt-2 font-semibold">{locationError}</p>}
                                    </div>
                                    <Button 
                                        type="button" 
                                        onClick={handleFetchLocation} 
                                        disabled={isFetchingLocation}
                                        className="flex items-center gap-2 whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2"
                                    >
                                        {isFetchingLocation ? <Spinner size="sm" /> : <MapPin className="w-4 h-4" />}
                                        {isFetchingLocation ? 'جاري الجلب...' : 'جلب الإحداثيات الحالية'}
                                    </Button>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <FormGroup label={<>خط العرض (Latitude) <PendingBadge fieldKey="_الإحداثيات_latitude" pendingData={pendingData} currentData={formData} /></>}>
                                <Input type="number" step="any" name="_الإحداثيات_latitude" value={formData['_الإحداثيات_latitude'] || ''} onChange={handleChange} disabled={isReadOnly} />
                            </FormGroup>
                            <FormGroup label={<>خط الطول (Longitude) <PendingBadge fieldKey="_الإحداثيات_longitude" pendingData={pendingData} currentData={formData} /></>}>
                                <Input type="number" step="any" name="_الإحداثيات_longitude" value={formData['_الإحداثيات_longitude'] || ''} onChange={handleChange} disabled={isReadOnly} />
                            </FormGroup>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MODALS FOR STAFF TRANSFER & COPY ---

const MoveDepartmentModal = ({ isOpen, onClose, formData, currentServiceKey, onMove }) => {
    const [selectedStaffIndices, setSelectedStaffIndices] = useState([]);
    const [targetServiceKey, setTargetServiceKey] = useState('');
    
    useEffect(() => {
        if (!isOpen) {
            setSelectedStaffIndices([]);
            setTargetServiceKey('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const currentStaff = formData[currentServiceKey] || [];
    const availableServices = Object.keys(SERVICE_LABELS).filter(k => k !== currentServiceKey);

    const toggleSelection = (idx) => {
        setSelectedStaffIndices(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };

    const selectAll = () => {
        if (selectedStaffIndices.length === currentStaff.length) {
            setSelectedStaffIndices([]);
        } else {
            setSelectedStaffIndices(currentStaff.map((_, i) => i));
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="نقل كوادر إلى قسم آخر" size="md">
            <div className="p-6 text-right" dir="rtl">
                <p className="text-gray-600 mb-4 text-sm">سيتم نقل الكوادر المحددة من القسم الحالي ({SERVICE_LABELS[currentServiceKey]}) إلى القسم المحدد نهائياً داخل هذه المنشأة.</p>
                
                {currentStaff.length === 0 ? (
                    <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                        لا توجد كوادر مسجلة في هذا القسم حالياً لنقلها.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <FormGroup label="اختر الكوادر المراد نقلها">
                            <div className="border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto bg-gray-50">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                                    <span className="font-bold text-sm text-sky-800">الكوادر المسجلة</span>
                                    <button type="button" onClick={selectAll} className="text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors">
                                        {selectedStaffIndices.length === currentStaff.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {currentStaff.map((s, idx) => (
                                        <label key={idx} className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded hover:bg-sky-50 cursor-pointer transition-colors">
                                            <input type="checkbox" checked={selectedStaffIndices.includes(idx)} onChange={() => toggleSelection(idx)} className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500" />
                                            <span className="text-sm font-medium text-gray-800">{s.name} <span className="text-gray-500 font-normal">({s.job_title})</span></span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </FormGroup>
                        <FormGroup label="القسم الهدف (ينقل إليه)">
                            <Select value={targetServiceKey} onChange={e => setTargetServiceKey(e.target.value)}>
                                <option value="">-- اختر القسم --</option>
                                {availableServices.map(k => (
                                    <option key={k} value={k}>{SERVICE_LABELS[k]}</option>
                                ))}
                            </Select>
                        </FormGroup>
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <Button variant="secondary" onClick={onClose}>إلغاء</Button>
                    <Button variant="primary" onClick={() => onMove(selectedStaffIndices, targetServiceKey)} disabled={selectedStaffIndices.length === 0 || !targetServiceKey}>
                        تأكيد النقل ({selectedStaffIndices.length})
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const TransferFacilityModal = ({ isOpen, onClose, currentServiceKey, currentStaffList, onTransfer, setToast }) => {
    const [selectedStaffIndices, setSelectedStaffIndices] = useState([]);
    const [state, setState] = useState('');
    const [locality, setLocality] = useState('');
    const [facilities, setFacilities] = useState([]);
    const [selectedFacilityId, setSelectedFacilityId] = useState('');
    const [loadingFacs, setLoadingFacs] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setSelectedStaffIndices([]); setState(''); setLocality(''); setFacilities([]); setSelectedFacilityId('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (state && locality) {
            setLoadingFacs(true);
            listHealthFacilities({ state, locality }, 'server')
                .then(res => setFacilities(res))
                .catch(() => setToast({show: true, message: 'فشل جلب المنشآت', type: 'error'}))
                .finally(() => setLoadingFacs(false));
        } else {
            setFacilities([]);
            setSelectedFacilityId('');
        }
    }, [state, locality]);

    const handleConfirmTransfer = async () => {
        if (selectedStaffIndices.length === 0 || !selectedFacilityId) return;
        setIsTransferring(true);
        const targetFacility = facilities.find(f => f.id === selectedFacilityId);
        await onTransfer(selectedStaffIndices, targetFacility);
        setIsTransferring(false);
    };

    const toggleSelection = (idx) => {
        setSelectedStaffIndices(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };

    const selectAll = () => {
        if (selectedStaffIndices.length === currentStaffList.length) {
            setSelectedStaffIndices([]);
        } else {
            setSelectedStaffIndices(currentStaffList.map((_, i) => i));
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={isTransferring ? null : onClose} title="نقل كوادر إلى منشأة أخرى" size="lg">
            <div className="p-6 text-right space-y-4" dir="rtl">
                <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200 text-sm mb-4">
                    <strong>تنبيه:</strong> سيتم نقل الكوادر المحددة من هذه المنشأة وحفظهم في المنشأة الجديدة المحددة أدناه (في نفس القسم: {SERVICE_LABELS[currentServiceKey]}).
                </div>

                {(!currentStaffList || currentStaffList.length === 0) ? (
                     <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                        لا توجد كوادر مسجلة في هذا القسم حالياً لنقلها.
                    </div>
                ) : (
                    <>
                        <FormGroup label="اختر الكوادر المراد نقلها">
                            <div className="border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto bg-gray-50">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                                    <span className="font-bold text-sm text-sky-800">الكوادر المسجلة</span>
                                    <button type="button" onClick={selectAll} className="text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors" disabled={isTransferring}>
                                        {selectedStaffIndices.length === currentStaffList.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {currentStaffList.map((s, idx) => (
                                        <label key={idx} className={`flex items-center gap-3 p-2 bg-white border border-gray-100 rounded hover:bg-sky-50 cursor-pointer transition-colors ${isTransferring ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <input type="checkbox" checked={selectedStaffIndices.includes(idx)} onChange={() => toggleSelection(idx)} disabled={isTransferring} className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500" />
                                            <span className="text-sm font-medium text-gray-800">{s.name} <span className="text-gray-500 font-normal">({s.job_title})</span></span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </FormGroup>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                            <FormGroup label="الولاية (المنشأة الهدف)">
                                <Select value={state} onChange={e => { setState(e.target.value); setLocality(''); setSelectedFacilityId(''); }} disabled={isTransferring}>
                                    <option value="">-- اختر الولاية --</option>
                                    {Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="المحلية (المنشأة الهدف)">
                                <Select value={locality} onChange={e => { setLocality(e.target.value); setSelectedFacilityId(''); }} disabled={!state || isTransferring}>
                                    <option value="">-- اختر المحلية --</option>
                                    {state && STATE_LOCALITIES[state]?.localities.map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                                </Select>
                            </FormGroup>
                        </div>

                        {loadingFacs ? (
                            <div className="flex justify-center py-4"><Spinner /></div>
                        ) : (
                            locality && (
                                <FormGroup label="المنشأة الهدف (ينقل إليها)">
                                    <Select value={selectedFacilityId} onChange={e => setSelectedFacilityId(e.target.value)} disabled={isTransferring}>
                                        <option value="">-- اختر المنشأة الجديدة للكوادر --</option>
                                        {facilities.map(f => <option key={f.id} value={f.id}>{f['اسم_المؤسسة']}</option>)}
                                    </Select>
                                </FormGroup>
                            )
                        )}
                    </>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <Button variant="secondary" onClick={onClose} disabled={isTransferring}>إلغاء</Button>
                    <Button variant="primary" onClick={handleConfirmTransfer} disabled={selectedStaffIndices.length === 0 || !selectedFacilityId || isTransferring} className="bg-amber-600 hover:bg-amber-700">
                        {isTransferring ? <Spinner size="sm"/> : `تأكيد ونقل الكوادر (${selectedStaffIndices.length})`}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// --- GENERIC FACILITY FORM WRAPPER ---
export const GenericFacilityForm = React.forwardRef(({
    initialData,
    pendingData, 
    onSave,
    onCancel,
    setToast,
    children,
    title,
    subtitle,
    isPublicForm = false,
    isReadOnly = false,
    saveButtonText = "حفظ المنشأة",
    cancelButtonText = "إلغاء",
    saveButtonVariant = "primary",
    isSubmitting = false 
}, ref) => {
    const [isLocalSubmitting, setIsLocalSubmitting] = useState(false); 

    const [formData, setFormData] = useState(() => {
        let processedData = initialData ? { ...initialData } : {};
        processedData.date_of_visit = new Date().toISOString().split('T')[0];
        
        if (!initialData) {
            const fieldsToDefaultNo = ['وجود_سجل_علاج_متكامل', 'وجود_كتيب_لوحات', 'ميزان_وزن', 'ميزان_طول', 'ميزان_حرارة', 'ساعة_مؤقت', 'غرفة_إرواء', 'eenc_steam_sterilizer', 'eenc_wall_clock', 'etat_has_service', 'hdu_has_service', 'picu_has_service', 'neonatal_kmc_unit', 'neonatal_breastfeeding_unit', 'neonatal_sterilization_unit', 'immunization_office_exists', 'nutrition_center_exists', 'growth_monitoring_service_exists', 'neonatal_sepsis_surveillance'];
            fieldsToDefaultNo.forEach(field => processedData[field] = processedData[field] || 'No');
        }

        if (processedData && (processedData.اسم_الكادر_المعالج || processedData.الوصف_الوظيفي) && !processedData.imnci_staff) {
            processedData.imnci_staff = [{ name: processedData.اسم_الكادر_المعالج || '', job_title: processedData.الوصف_الوظيفي || '', is_trained: processedData.هل_تم_التدريب_على_العلاج_المتكامل || 'No', training_date: processedData.تاريخ_التدريب || '', phone: processedData.رقم_الهاتف || '' }];
            delete processedData.اسم_الكادر_المعالج; delete processedData.الوصف_الوظيفي; delete processedData.هل_تم_التدريب_على_العلاج_المتكامل; delete processedData.تاريخ_التدريب; delete processedData.رقم_الهاتف;
        }
        
        if (!processedData.imnci_staff) processedData.imnci_staff = [];
        if (!processedData.eenc_staff) processedData.eenc_staff = [];
        if (!processedData.neonatal_staff) processedData.neonatal_staff = [];
        if (!processedData.critical_staff) processedData.critical_staff = [];

        if (processedData.neonatal_level_of_care) {
             delete processedData.neonatal_level_of_care;
        }

        return processedData;
    });

    const [submitterName, setSubmitterName] = useState('');
    const [submitterEmail, setSubmitterEmail] = useState('');
    const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
    const isEditing = !!initialData?.id;

    // --- MODALS STATE ---
    const [moveModalInfo, setMoveModalInfo] = useState({ isOpen: false, currentServiceKey: '' });
    const [transferModalInfo, setTransferModalInfo] = useState({ isOpen: false, currentServiceKey: '' });

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsUserLoggedIn(true);
                setSubmitterName(user.displayName || '');
                setSubmitterEmail(user.email || '');
            } else {
                setIsUserLoggedIn(false);
                setSubmitterName('');
                setSubmitterEmail('');
            }
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let finalValue = type === 'checkbox' ? (checked ? 'Yes' : 'No') : type === 'number' ? (value === '' ? null : (isNaN(parseFloat(value)) ? null : parseFloat(value))) : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleCheckboxGroupChange = (e) => {
        const { name, value, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: { ...(prev[name] || {}), [value]: checked } }));
    };

    const handleStateChange = (e) => {
        setFormData(prev => ({ ...prev, 'الولاية': e.target.value, 'المحلية': '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLocalSubmitting(true);
        const processedData = { ...formData };
        processedData.date_of_visit = new Date().toISOString().split('T')[0];

        ['نوع_المؤسسةالصحية', 'eenc_service_type'].forEach(field => {
            if ([null, undefined, ''].includes(processedData[field])) processedData[field] = 'no data';
        });
        
        let updaterIdentifier;
        const name = submitterName.trim();
        const email = submitterEmail.trim();

        if (name && email) updaterIdentifier = `${name} (${email})`;
        else if (name) updaterIdentifier = name;
        else if (email) updaterIdentifier = email;
        else updaterIdentifier = 'Anonymous Submission';

        try {
            await onSave({ ...processedData, 'اخر تحديث': new Date().toISOString(), 'updated_by': updaterIdentifier });
        } catch (error) {
            setToast({ show: true, message: `Failed to save facility: ${error.message}`, type: 'error' });
        } finally {
            setIsLocalSubmitting(false);
        }
    };

    // --- STAFF ARRAY HANDLERS ---
    const handleStaffChange = (serviceKey, index, event) => {
        const { name, value } = event.target;
        const updatedStaff = formData[serviceKey].map((staff, i) => i === index ? { ...staff, [name]: value } : staff);
        setFormData(prev => ({ ...prev, [serviceKey]: updatedStaff }));
    };

    const handleAddStaffRow = (serviceKey, event) => {
        event.preventDefault();
        setFormData(prev => ({ ...prev, [serviceKey]: [...(prev[serviceKey] || []), { name: '', job_title: '', is_trained: 'No', training_date: '', phone: '' }] }));
    };

    const handleRemoveStaffRow = (serviceKey, event, index) => {
        event.preventDefault();
        setFormData(prev => ({ ...prev, [serviceKey]: formData[serviceKey].filter((_, i) => i !== index) }));
    };

    const handleMoveDepartment = (staffIndices, targetKey) => {
        const currentKey = moveModalInfo.currentServiceKey;
        setFormData(prev => {
            const currentStaff = prev[currentKey] || [];
            const targetStaff = prev[targetKey] || [];

            const staffToMove = staffIndices.map(idx => currentStaff[idx]);
            const newCurrentStaff = currentStaff.filter((_, i) => !staffIndices.includes(i));
            
            const mergedTargetStaff = [...targetStaff];
            staffToMove.forEach(staff => {
                if (!mergedTargetStaff.some(t => t.name === staff.name && t.phone === staff.phone)) {
                    mergedTargetStaff.push(staff);
                }
            });

            return {
                ...prev,
                [currentKey]: newCurrentStaff,
                [targetKey]: mergedTargetStaff
            };
        });
        setToast({ show: true, message: `تم نقل ${staffIndices.length} كادر بنجاح.`, type: 'success' });
        setMoveModalInfo({ isOpen: false, currentServiceKey: '' });
    };

    const handleTransferFacility = async (staffIndices, targetFacility) => {
        const currentKey = transferModalInfo.currentServiceKey;
        try {
            const currentStaff = formData[currentKey] || [];
            const staffToTransfer = staffIndices.map(idx => currentStaff[idx]);
            
            let targetStaffList = [];
            try {
                targetStaffList = targetFacility[currentKey] ? (typeof targetFacility[currentKey] === 'string' ? JSON.parse(targetFacility[currentKey]) : JSON.parse(JSON.stringify(targetFacility[currentKey]))) : [];
            } catch(e) { targetStaffList = []; }

            if (!Array.isArray(targetStaffList)) targetStaffList = [];
            
            staffToTransfer.forEach(staff => {
                if (!targetStaffList.some(t => t.name === staff.name && t.phone === staff.phone)) {
                    targetStaffList.push(staff);
                }
            });

            const updatedTargetFacility = { ...targetFacility, [currentKey]: targetStaffList };
            await submitFacilityDataForApproval(updatedTargetFacility);

            setFormData(prev => ({
                ...prev,
                [currentKey]: prev[currentKey].filter((_, i) => !staffIndices.includes(i))
            }));
            
            setToast({ show: true, message: `تم نقل ${staffIndices.length} كادر بنجاح للمنشأة الجديدة وحذفهم من هنا.`, type: 'success' });
            setTransferModalInfo({ isOpen: false, currentServiceKey: '' });
        } catch (err) {
            setToast({ show: true, message: `فشل النقل: ${err.message}`, type: 'error' });
        }
    };

    const currentlySubmitting = isSubmitting || isLocalSubmitting;

    return (
        <div dir="rtl">
            <MoveDepartmentModal 
                isOpen={moveModalInfo.isOpen} 
                onClose={() => setMoveModalInfo({isOpen: false, currentServiceKey: ''})}
                formData={formData}
                currentServiceKey={moveModalInfo.currentServiceKey}
                onMove={handleMoveDepartment}
            />

            <TransferFacilityModal 
                isOpen={transferModalInfo.isOpen}
                onClose={() => setTransferModalInfo({isOpen: false, currentServiceKey: ''})}
                currentServiceKey={transferModalInfo.currentServiceKey}
                currentStaffList={formData[transferModalInfo.currentServiceKey]}
                onTransfer={handleTransferFacility}
                setToast={setToast}
            />

            <Card className="shadow-xl border-t-4 border-t-sky-500 overflow-hidden">
                <div className="bg-gradient-to-r from-sky-50 to-white px-6 py-5 border-b border-gray-100">
                    <h2 className="text-2xl font-extrabold text-sky-900">{isEditing ? `تعديل: ${title}` : `إضافة: ${title}`}</h2>
                    <p className="text-sky-700 mt-1 font-medium">{subtitle || (isEditing ? (formData['اسم_المؤسسة'] || "Update details for this facility") : "أدخل تفاصيل المنشأة الجديدة.")}</p>
                </div>
                
                <div className="p-6">
                    <form onSubmit={handleSubmit} ref={ref}>
                        <SharedFacilityFields 
                            formData={formData} 
                            pendingData={pendingData}
                            handleChange={handleChange} 
                            handleStateChange={handleStateChange} 
                            isPublicForm={isPublicForm} 
                            isReadOnly={isReadOnly} 
                        />
                        
                        <div className="mt-8">
                            {children({ 
                                formData, 
                                pendingData,
                                handleChange, 
                                handleStateChange, 
                                handleStaffChange, 
                                handleAddStaffRow, 
                                handleRemoveStaffRow, 
                                handleCheckboxGroupChange,
                                isReadOnly,
                                onOpenMoveDeptModal: (key) => setMoveModalInfo({isOpen: true, currentServiceKey: key}),
                                onOpenTransferFacModal: (key) => setTransferModalInfo({isOpen: true, currentServiceKey: key})
                            })}
                        </div>
                        
                        {isPublicForm && (
                             <div className="mt-8 pt-6 border-t border-sky-200">
                                <div className="p-4 bg-sky-50 rounded-lg border border-sky-200">
                                    <h3 className="text-lg font-semibold mb-2 text-sky-800" dir="ltr">Your Information</h3>
                                    <p className="text-sm text-gray-600 mb-4" dir="ltr">
                                        {isUserLoggedIn 
                                            ? "Your information is automatically recorded with this submission."
                                            : "Please provide your name and email if you wish. This will be recorded with your submission."
                                        }
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormGroup label="Your Name">
                                            <Input type="text" name="submitterName" value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} disabled={isUserLoggedIn || isReadOnly} />
                                        </FormGroup>
                                        <FormGroup label="Your Email">
                                            <Input type="email" name="submitterEmail" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} disabled={isUserLoggedIn || isReadOnly} />
                                        </FormGroup>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 mt-8 pt-6 border-t justify-end">
                            <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); onCancel(); }} disabled={currentlySubmitting} className="px-6">
                                {cancelButtonText}
                            </Button>
                            <Button type="submit" variant={saveButtonVariant} disabled={currentlySubmitting} className="px-8 font-bold">
                                {currentlySubmitting ? 'جاري الحفظ...' : saveButtonText}
                            </Button>
                        </div>
                    </form>
                </div>
            </Card>
        </div>
    );
});

export const StaffTable = ({ serviceKey, formData, pendingData, isReadOnly, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, jobTitles, onOpenMoveDeptModal, onOpenTransferFacModal }) => {
    const staffList = formData[serviceKey] || [];
    
    const hasPendingStaff = useMemo(() => {
        if (!pendingData || !pendingData[serviceKey]) return false;
        const pList = pendingData[serviceKey];
        if (!Array.isArray(pList)) return false;
        
        if (pList.length !== staffList.length) return true;
        
        const norm = (v) => (v === undefined || v === null) ? '' : String(v).trim();
        
        for (let i = 0; i < pList.length; i++) {
            const pStaff = pList[i] || {};
            const cStaff = staffList[i] || {};
            const keys = new Set([...Object.keys(pStaff), ...Object.keys(cStaff)]);
            
            for (let k of keys) {
                if (norm(pStaff[k]) !== norm(cStaff[k])) return true;
            }
        }
        return false;
    }, [pendingData, serviceKey, staffList]);

    return (
        <div>
            <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md flex items-center justify-between">
                <div>
                    <span>معلومات الكادر بالاسم ({staffList.length})</span>
                    {hasPendingStaff && (
                        <span className="mr-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            ⏳ يوجد تعديل معلق على الكوادر
                        </span>
                    )}
                </div>
            </h4>
            
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-sky-100/50">
                        <tr>
                            <th className="border p-2 text-right text-sky-800 w-[25%]">الاسم</th>
                            <th className="border p-2 text-right text-sky-800 w-[20%]">الوصف الوظيفي</th>
                            <th className="border p-2 text-right text-sky-800 w-[12%]">هل مدرب</th>
                            <th className="border p-2 text-right text-sky-800 w-[18%]">تاريخ اخر تدريب</th>
                            <th className="border p-2 text-right text-sky-800 w-[15%]">رقم الهاتف</th>
                            <th className="border p-2 text-center text-sky-800 w-[10%]">إجراء</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffList.map((staff, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="border p-1">
                                    <Input className="w-full text-sm" name="name" value={staff.name} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={isReadOnly} />
                                </td>
                                <td className="border p-1">
                                    <Select className="w-full text-sm px-1" name="job_title" value={staff.job_title || ''} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={isReadOnly}>
                                        <option value="">اختر الوصف</option>
                                        {jobTitles.map(t => <option key={t} value={t}>{t}</option>)}
                                        {staff.job_title && !jobTitles.includes(staff.job_title) && (<option value={staff.job_title}>{staff.job_title}</option>)}
                                    </Select>
                                </td>
                                <td className="border p-1">
                                    <Select className="w-full text-sm px-1" name="is_trained" value={staff.is_trained} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={isReadOnly}>
                                        <option value="Yes">نعم</option>
                                        <option value="No">لا</option>
                                        <option value="Planned">مخططة</option>
                                    </Select>
                                </td>
                                <td className="border p-1">
                                    <Input className="w-full text-sm px-1" type="date" name="training_date" value={staff.training_date} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={staff.is_trained !== 'Yes' || isReadOnly} />
                                </td>
                                <td className="border p-1">
                                    <Input className="w-full text-sm px-1" type="tel" name="phone" value={staff.phone} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={isReadOnly} />
                                </td>
                                <td className="border p-1 text-center">
                                    <Button size="sm" variant="danger" type="button" onClick={(e) => { e.preventDefault(); handleRemoveStaffRow(serviceKey, e, index); }} disabled={isReadOnly} className="w-full px-1 py-1.5 text-xs">
                                        حذف
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {staffList.length === 0 && (
                            <tr><td colSpan="6" className="text-center p-4 text-gray-500 bg-gray-50">لا توجد كوادر مسجلة.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
                <Button type="button" onClick={(e) => { e.preventDefault(); handleAddStaffRow(serviceKey, e); }} variant="secondary" className="font-bold shadow-sm" disabled={isReadOnly}>
                    + إضافة كادر يدوياً
                </Button>
                {onOpenMoveDeptModal && (
                    <Button type="button" onClick={(e) => { e.preventDefault(); onOpenMoveDeptModal(serviceKey); }} variant="secondary" className="font-bold shadow-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200" disabled={isReadOnly}>
                        <ArrowRightLeft className="w-4 h-4 mr-2 inline" /> نقل لقسم آخر
                    </Button>
                )}
                {onOpenTransferFacModal && (
                    <Button type="button" onClick={(e) => { e.preventDefault(); onOpenTransferFacModal(serviceKey); }} variant="secondary" className="font-bold shadow-sm bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200" disabled={isReadOnly}>
                        <Building2 className="w-4 h-4 mr-2 inline" /> نقل لمنشأة أخرى
                    </Button>
                )}
            </div>
        </div>
    );
};

export const IMNCIFormFields = ({ formData, pendingData, handleChange, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, isReadOnly = false, onOpenMoveDeptModal, onOpenTransferFacModal }) => {
    const jobTitles = ['طبيب', 'مساعد طبي', 'ممرض معالج', 'مسؤول تغذية', 'زائرة صحية'];

    return (
        <div className="border border-sky-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-sky-100 px-4 py-3 border-b border-sky-200">
                <h3 className="text-lg font-semibold text-sky-800">IMNCI Services (خدمات العلاج المتكامل لأمراض الطفولة)</h3>
            </div>
            <div className="p-5 space-y-6">
                <FormGroup label={<>هل تتوفر خدمة العلاج المتكامل لأمراض الطفولة؟ <PendingBadge fieldKey="وجود_العلاج_المتكامل_لامراض_الطفولة" pendingData={pendingData} currentData={formData} /></>}>
                    <p className="text-sm font-medium text-sky-700 mb-2">الكوادر العاملة في المؤسسة مدربة بنسبة 50% أو لأكثر</p>
                    <Select name="وجود_العلاج_المتكامل_لامراض_الطفولة" value={formData['وجود_العلاج_المتكامل_لامراض_الطفولة'] || ''} onChange={handleChange} disabled={isReadOnly} required>
                        <option value="">اختر...</option>
                        <option value="Yes">نعم</option>
                        <option value="No">لا</option>
                        <option value="Planned">مخططة</option>
                    </Select>
                </FormGroup>

                <div className="space-y-6 animate-fade-in pt-4 border-t border-gray-200">
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">إحصائية الكوادر الطبية</h4>
                        <div className="overflow-x-auto bg-white border border-gray-200 rounded shadow-sm mb-6">
                            <table className="min-w-full border-collapse text-sm text-center">
                                <thead className="bg-sky-100/50">
                                    <tr>
                                        <th className="border p-2 text-right text-sky-800 w-1/3">الوصف الوظيفي</th>
                                        <th className="border p-2 text-sky-800 w-1/3">العدد الكلي الموجود</th>
                                        <th className="border p-2 text-sky-800 w-1/3">المدربين على العلاج المتكامل</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="hover:bg-gray-50">
                                        <td className="border p-3 font-medium text-gray-700 text-right">طبيب</td>
                                        <td className="border p-2"><Input type="number" name="imnci_doctors_total" value={formData.imnci_doctors_total ?? ''} onChange={handleChange} disabled={isReadOnly} min="0" /></td>
                                        <td className="border p-2"><Input type="number" name="imnci_doctors_trained" value={formData.imnci_doctors_trained ?? ''} onChange={handleChange} disabled={isReadOnly} min="0" /></td>
                                    </tr>
                                    <tr className="hover:bg-gray-50">
                                        <td className="border p-3 font-medium text-gray-700 text-right">مساعد طبي</td>
                                        <td className="border p-2"><Input type="number" name="imnci_medical_assistants_total" value={formData.imnci_medical_assistants_total ?? ''} onChange={handleChange} disabled={isReadOnly} min="0" /></td>
                                        <td className="border p-2"><Input type="number" name="imnci_medical_assistants_trained" value={formData.imnci_medical_assistants_trained ?? ''} onChange={handleChange} disabled={isReadOnly} min="0" /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <StaffTable 
                        serviceKey="imnci_staff" 
                        formData={formData} 
                        pendingData={pendingData}
                        isReadOnly={isReadOnly} 
                        handleStaffChange={handleStaffChange} 
                        handleAddStaffRow={handleAddStaffRow} 
                        handleRemoveStaffRow={handleRemoveStaffRow} 
                        jobTitles={jobTitles} 
                        onOpenMoveDeptModal={onOpenMoveDeptModal}
                        onOpenTransferFacModal={onOpenTransferFacModal}
                    />

                    <hr className="border-gray-200" />
                    
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">الموارد والمعدات المتاحة</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormGroup label={<>وجود سجل علاج متكامل <PendingBadge fieldKey="وجود_سجل_علاج_متكامل" pendingData={pendingData} currentData={formData} /></>}><Select name="وجود_سجل_علاج_متكامل" value={formData['وجود_سجل_علاج_متكامل'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label={<>وجود كتيب لوحات <PendingBadge fieldKey="وجود_كتيب_لوحات" pendingData={pendingData} currentData={formData} /></>}><Select name="وجود_كتيب_لوحات" value={formData['وجود_كتيب_لوحات'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label={<>ميزان وزن <PendingBadge fieldKey="ميزان_وزن" pendingData={pendingData} currentData={formData} /></>}><Select name="ميزان_وزن" value={formData['ميزان_وزن'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label={<>ميزان طول <PendingBadge fieldKey="ميزان_طول" pendingData={pendingData} currentData={formData} /></>}><Select name="ميزان_طول" value={formData['ميزان_طول'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label={<>ميزان حرارة <PendingBadge fieldKey="ميزان_حرارة" pendingData={pendingData} currentData={formData} /></>}><Select name="ميزان_حرارة" value={formData['ميزان_حرارة'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label={<>ساعة مؤقت <PendingBadge fieldKey="ساعة_مؤقت" pendingData={pendingData} currentData={formData} /></>}><Select name="ساعة_مؤقت" value={formData['ساعة_مؤقت'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label={<>غرفة إرواء <PendingBadge fieldKey="غرفة_إرواء" pendingData={pendingData} currentData={formData} /></>}><Select name="غرفة_إرواء" value={formData['غرفة_إرواء'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">الخدمات الاخرى</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                                <FormGroup label={<>هل يوجد مكتب تحصين؟ <PendingBadge fieldKey="immunization_office_exists" pendingData={pendingData} currentData={formData} /></>}><Select name="immunization_office_exists" value={formData.immunization_office_exists || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                                {formData.immunization_office_exists === 'No' && <FormGroup label={<>اين يقع اقرب مركز تحصين؟ <PendingBadge fieldKey="nearest_immunization_center" pendingData={pendingData} currentData={formData} /></>} className="mt-3"><Input type="text" name="nearest_immunization_center" value={formData.nearest_immunization_center || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>}
                            </div>
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                                <FormGroup label={<>هل يوجد مركز تغذية خارجي؟ <PendingBadge fieldKey="nutrition_center_exists" pendingData={pendingData} currentData={formData} /></>}><Select name="nutrition_center_exists" value={formData.nutrition_center_exists || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                                {formData.nutrition_center_exists === 'No' && <FormGroup label={<>اين يقع اقرب مركز تغذية خارجي؟ <PendingBadge fieldKey="nearest_nutrition_center" pendingData={pendingData} currentData={formData} /></>} className="mt-3"><Input type="text" name="nearest_nutrition_center" value={formData.nearest_nutrition_center || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>}
                            </div>
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                                <FormGroup label={<>هل يوجد خدمة متابعة النمو ؟ <PendingBadge fieldKey="growth_monitoring_service_exists" pendingData={pendingData} currentData={formData} /></>}><Select name="growth_monitoring_service_exists" value={formData.growth_monitoring_service_exists || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const EENCFormFields = ({ formData, pendingData, handleChange, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, isReadOnly = false, onOpenMoveDeptModal, onOpenTransferFacModal }) => {
    const jobTitles = ['طبيب أطفال', 'طبيب نساء وتوليد', 'طبيب عمومي', 'قابلة', 'ممرض', 'مساعد طبي'];

    return (
        <div className="border border-sky-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-sky-100 px-4 py-3 border-b border-sky-200">
                <h3 className="text-lg font-semibold text-sky-800">EENC Services (خدمات الرعاية الطارئة لحديثي الولادة)</h3>
            </div>
            <div className="p-5 space-y-6">
                <FormGroup label={<>هل تقدم الرعاية الضرورية المبكرة لحديثي الولادة والأطفال؟ <PendingBadge fieldKey="eenc_provides_essential_care" pendingData={pendingData} currentData={formData} /></>}>
                    <p className="text-sm font-medium text-sky-700 mb-2">تم تدريب الكوادر العاملة في غرفة الولادة على الرعاية الضرورية المبكرة للاطفال حديثي الولادة</p>
                    <Select name="eenc_provides_essential_care" value={formData.eenc_provides_essential_care || ''} onChange={handleChange} disabled={isReadOnly} required>
                        <option value="">اختر...</option>
                        <option value="Yes">نعم</option>
                        <option value="No">لا</option>
                        <option value="Planned">مخططة</option>
                    </Select>
                </FormGroup>

                <div className="space-y-6 animate-fade-in pt-4 border-t border-gray-200">
                    <FormGroup label={<>عدد الكوادر الصحية المدربة (إجمالي) <PendingBadge fieldKey="eenc_trained_workers" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="eenc_trained_workers" value={formData.eenc_trained_workers ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                    
                    <StaffTable 
                        serviceKey="eenc_staff" 
                        formData={formData} 
                        pendingData={pendingData}
                        isReadOnly={isReadOnly} 
                        handleStaffChange={handleStaffChange} 
                        handleAddStaffRow={handleAddStaffRow} 
                        handleRemoveStaffRow={handleRemoveStaffRow} 
                        jobTitles={jobTitles} 
                        onOpenMoveDeptModal={onOpenMoveDeptModal}
                        onOpenTransferFacModal={onOpenTransferFacModal}
                    />

                    <hr className="border-gray-200" />
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">الموارد والمعدات المتاحة</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormGroup label={<>العدد الكلي لسرير الولادة <PendingBadge fieldKey="eenc_delivery_beds" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="eenc_delivery_beds" value={formData.eenc_delivery_beds ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>العدد الكلي لمحطات الانعاش <PendingBadge fieldKey="eenc_resuscitation_stations" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="eenc_resuscitation_stations" value={formData.eenc_resuscitation_stations ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>العدد الكلي لاجهزة التدفئة <PendingBadge fieldKey="eenc_warmers" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="eenc_warmers" value={formData.eenc_warmers ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>العدد الكلي لجهاز الامبوباق <PendingBadge fieldKey="eenc_ambu_bags" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="eenc_ambu_bags" value={formData.eenc_ambu_bags ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>العدد الكلي لجهاز الشفط اليدوي <PendingBadge fieldKey="eenc_manual_suction" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="eenc_manual_suction" value={formData.eenc_manual_suction ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>ساعة حائط <PendingBadge fieldKey="eenc_wall_clock" pendingData={pendingData} currentData={formData} /></>}><Select name="eenc_wall_clock" value={formData.eenc_wall_clock || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label={<>جهاز التعقيم بالبخار <PendingBadge fieldKey="eenc_steam_sterilizer" pendingData={pendingData} currentData={formData} /></>}><Select name="eenc_steam_sterilizer" value={formData.eenc_steam_sterilizer || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const NeonatalFormFields = ({ formData, pendingData, handleChange, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, isReadOnly = false, onOpenMoveDeptModal, onOpenTransferFacModal }) => {
    const jobTitles = ['اختصاصي أطفال', 'طبيب أطفال', 'طبيب عمومي', 'ممرض عناية مكثفة', 'ممرض', 'قابلة'];

    return (
        <div className="border border-sky-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-sky-100 px-4 py-3 border-b border-sky-200">
                <h3 className="text-lg font-semibold text-sky-800">Neonatal Care Unit (وحدة رعاية حديثي الولادة)</h3>
            </div>
            <div className="p-5 space-y-6">

                <div className="space-y-8 animate-fade-in">
                    
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-6">
                        <h4 className="text-md font-extrabold text-sky-800 mb-2 border-b border-gray-200 pb-3">مستويات الرعاية لحديثي الولادة</h4>
                        
                        <FormGroup label={<>هل تتوفر رعاية أساسية لحديثي الولادة (المستوى الأولي)؟ <PendingBadge fieldKey="neonatal_level_primary" pendingData={pendingData} currentData={formData} /></>}>
                            <p className="text-sm font-medium text-sky-700 mb-2">يتم تنويم الاطفال حديثي الولادة ومعالجة الامراض البسيطة التسمم الدموي - اليرقان....</p>
                            <Select name="neonatal_level_primary" value={formData.neonatal_level_primary || ''} onChange={handleChange} disabled={isReadOnly}>
                                <option value="">اختر...</option>
                                <option value="Yes">نعم</option>
                                <option value="No">لا</option>
                                <option value="Planned">مخططة</option>
                            </Select>
                        </FormGroup>

                        <FormGroup label={<>هل تتوفر وحدة رعاية خاصة لحديثي الولادة (المستوى الثانوي)؟ <PendingBadge fieldKey="neonatal_level_secondary" pendingData={pendingData} currentData={formData} /></>}>
                            <p className="text-sm font-medium text-sky-700 mb-2">تقديم خدمة تنويم الاطفال حديثي الولادة بما يشمل الاطفال الخدج ، الاكسجين ، ...،</p>
                            <Select name="neonatal_level_secondary" value={formData.neonatal_level_secondary || ''} onChange={handleChange} disabled={isReadOnly}>
                                <option value="">اختر...</option>
                                <option value="Yes">نعم</option>
                                <option value="No">لا</option>
                                <option value="Planned">مخططة</option>
                            </Select>
                        </FormGroup>

                        <FormGroup label={<>هل تتوفر وحدة العناية المركزة لحديثي الولادة (المستوى الثالثوي)؟ <PendingBadge fieldKey="neonatal_level_tertiary" pendingData={pendingData} currentData={formData} /></>}>
                            <p className="text-sm font-medium text-sky-700 mb-2">تقدم خدمات حديثي اولادة المتقدمة بما يشمل التنفس الصناعي</p>
                            <Select name="neonatal_level_tertiary" value={formData.neonatal_level_tertiary || ''} onChange={handleChange} disabled={isReadOnly}>
                                <option value="">اختر...</option>
                                <option value="Yes">نعم</option>
                                <option value="No">لا</option>
                                <option value="Planned">مخططة</option>
                            </Select>
                        </FormGroup>
                    </div>

                    <StaffTable 
                        serviceKey="neonatal_staff" 
                        formData={formData} 
                        pendingData={pendingData}
                        isReadOnly={isReadOnly} 
                        handleStaffChange={handleStaffChange} 
                        handleAddStaffRow={handleAddStaffRow} 
                        handleRemoveStaffRow={handleRemoveStaffRow} 
                        jobTitles={jobTitles} 
                        onOpenMoveDeptModal={onOpenMoveDeptModal}
                        onOpenTransferFacModal={onOpenTransferFacModal}
                    />

                    <hr className="border-gray-200" />
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">خدمات ملحقة</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="p-3 border border-gray-200 rounded-md hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer">
                                <span className="font-medium text-gray-700">وحدة رعاية الكنغر (KMC unit) <PendingBadge fieldKey="neonatal_kmc_unit" pendingData={pendingData} currentData={formData} /></span>
                                <Checkbox name="neonatal_kmc_unit" label="" checked={formData.neonatal_kmc_unit === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                            </label>
                            <label className="p-3 border border-gray-200 rounded-md hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer">
                                <span className="font-medium text-gray-700">وحدة الرضاعة الطبيعية (breastfeeding unit) <PendingBadge fieldKey="neonatal_breastfeeding_unit" pendingData={pendingData} currentData={formData} /></span>
                                <Checkbox name="neonatal_breastfeeding_unit" label="" checked={formData.neonatal_breastfeeding_unit === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                            </label>
                            <label className="p-3 border border-gray-200 rounded-md hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer">
                                <span className="font-medium text-gray-700">وحدة تعقيم (sterilization unit) <PendingBadge fieldKey="neonatal_sterilization_unit" pendingData={pendingData} currentData={formData} /></span>
                                <Checkbox name="neonatal_sterilization_unit" label="" checked={formData.neonatal_sterilization_unit === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                            </label>
                            <label className="p-3 border border-gray-200 rounded-md hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer">
                                <span className="font-medium text-gray-700">الترصد والحماية من عدوى التسمم الدموي <PendingBadge fieldKey="neonatal_sepsis_surveillance" pendingData={pendingData} currentData={formData} /></span>
                                <Checkbox name="neonatal_sepsis_surveillance" label="" checked={formData.neonatal_sepsis_surveillance === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                            </label>
                        </div>
                    </div>

                    <hr className="border-gray-200" />
                    
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">المعدات المتاحة</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormGroup label={<>إجمالي سعة الأسرة <PendingBadge fieldKey="neonatal_total_beds" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_total_beds" value={formData.neonatal_total_beds ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>العدد الكلي للحضانات (incubators) <PendingBadge fieldKey="neonatal_total_incubators" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_total_incubators" value={formData.neonatal_total_incubators ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>العدد الكلي للاسرة للاطفال مكتملي النمو (cots) <PendingBadge fieldKey="neonatal_total_cots" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_total_cots" value={formData.neonatal_total_cots ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>أجهزة CPAP <PendingBadge fieldKey="neonatal_cpap" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_cpap" value={formData.neonatal_cpap ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>جهاز تدفئة حرارية (warmer) <PendingBadge fieldKey="neonatal_warmer" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_warmer" value={formData.neonatal_warmer ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>مضخة تسريب (infusion pump) <PendingBadge fieldKey="neonatal_infusion_pump" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_infusion_pump" value={formData.neonatal_infusion_pump ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>مضخات الحقن (Syringe pump) <PendingBadge fieldKey="neonatal_syringe_pump" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_syringe_pump" value={formData.neonatal_syringe_pump ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>جهاز شفط (suction machine) <PendingBadge fieldKey="neonatal_sucker" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_sucker" value={formData.neonatal_sucker ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>وحدات العلاج الضوئي (Phototherapy) <PendingBadge fieldKey="neonatal_phototherapy" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_phototherapy" value={formData.neonatal_phototherapy ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>أكياس الإنعاش (Ambu Bag) <PendingBadge fieldKey="neonatal_ambu_bag" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_ambu_bag" value={formData.neonatal_ambu_bag ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>جهاز مراقبة التنفس والاكسجين (Pulse and oxygen Monitor) <PendingBadge fieldKey="neonatal_respiration_monitor" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_respiration_monitor" value={formData.neonatal_respiration_monitor ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>جهاز أكسجين (Oxygen concentrator) <PendingBadge fieldKey="neonatal_oxygen_machine" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_oxygen_machine" value={formData.neonatal_oxygen_machine ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>أسطوانة الاكسجين (oxygen cylinder) <PendingBadge fieldKey="neonatal_oxygen_cylinder" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_oxygen_cylinder" value={formData.neonatal_oxygen_cylinder ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>جهاز تنفس صناعي (Mechanical ventilator) <PendingBadge fieldKey="neonatal_mechanical_ventilator" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_mechanical_ventilator" value={formData.neonatal_mechanical_ventilator ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label={<>حاضنة محمولة (Portable Incubator) <PendingBadge fieldKey="neonatal_portable_incubator" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="neonatal_portable_incubator" value={formData.neonatal_portable_incubator ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ETAT_ASSESSMENT_QUESTIONS = [
    { key: 'separate_pediatric_emergency', label: 'هل توجد حوادث أطفال منفصلة' },
    { key: 'operation_24_hours', label: 'هل تعمل الحوادث على مدار 24 ساعة' },
    { key: 'triage_system', label: 'هل يوجد نظام الفرز والتقييم والمعالجة للحالات الحرجة' },
    { key: 'cold_cases_clinic', label: 'هل توجد عيادة حالات باردة للأطفال' },
    { key: 'specialist_clinics', label: 'هل توجد عيادات اختصاصيين محولة' },
    { key: 'short_stay_ward', label: 'هل يوجد عنبر للإقامة القصير بالحوادث' },
    { key: 'emergency_pharmacy', label: 'هل توجد صيدلية طوارئ بقسم الأطفال' },
    { key: 'free_medicines', label: 'هل تتوفر الأدوية المجانية صيدلية الطوارئ' },
    { key: 'central_oxygen', label: 'هل يوجد أكسجين مركزي في الحوادث' },
    { key: 'pediatric_lab', label: 'هل يوجد معمل بقسم الاطفال' },
];

const CRITICAL_CARE_STAFF_CATEGORIES = [
    { key: 'pediatric_specialist', label: 'اختصاصي أطفال' },
    { key: 'pediatric_registrar', label: 'نائب اختصاصي أطفال' },
    { key: 'general_practitioner', label: 'طبيب عمومي' },
    { key: 'house_officer', label: 'طبيب إمتياز' },
    { key: 'nurse_bsc', label: 'ممرض (بكلاريوس)' },
    { key: 'nurse_diploma', label: 'ممرض (دبلوم)' },
];

export const CriticalCareFormFields = ({ formData, pendingData, handleChange, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, isReadOnly = false, onOpenMoveDeptModal, onOpenTransferFacModal }) => {
    const jobTitles = ['اختصاصي أطفال', 'نائب اختصاصي أطفال', 'طبيب عمومي', 'طبيب إمتياز', 'ممرض (بكلاريوس)', 'ممرض (دبلوم)'];
    
    return (
        <div className="border border-sky-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-sky-100 px-4 py-3 border-b border-sky-200">
                <h3 className="text-lg font-semibold text-sky-800">Emergency & Critical Care (الطوارئ والرعاية الحرجة)</h3>
            </div>
            <div className="p-5 space-y-6">
                
                {/* ETAT Section */}
                <div className="p-4 border rounded-md transition-colors bg-gray-50 border-gray-200 hover:bg-white">
                    <FormGroup label={<>هل المؤسسة تقدم خدمة الفرز والتقييم والعلاج لطوارئ الأطفال (ETAT) ؟ <PendingBadge fieldKey="etat_has_service" pendingData={pendingData} currentData={formData} /></>}>
                        <Select name="etat_has_service" value={formData.etat_has_service || ''} onChange={handleChange} disabled={isReadOnly}>
                            <option value="">اختر...</option>
                            <option value="Yes">نعم</option>
                            <option value="No">لا</option>
                            <option value="Planned">مخططة</option>
                        </Select>
                    </FormGroup>
                    
                    <div className="mt-4 pt-4 border-t border-sky-200 animate-fade-in space-y-6">
                        
                        <div>
                            <h4 className="text-md font-semibold mb-3 text-sky-800">إحصائية الكوادر الطبية بقسم الطوارئ</h4>
                            <div className="overflow-x-auto bg-white border border-gray-200 rounded shadow-sm mb-6">
                                <table className="min-w-full border-collapse text-sm text-center">
                                    <thead className="bg-sky-100/50">
                                        <tr>
                                            <th className="border p-2 text-right text-sky-800 w-1/3">الوصف الوظيفي</th>
                                            <th className="border p-2 text-sky-800 w-1/3">العدد الموجود</th>
                                            <th className="border p-2 text-sky-800 w-1/3">العدد المدرب على ETAT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CRITICAL_CARE_STAFF_CATEGORIES.map((staff) => (
                                            <tr key={staff.key} className="hover:bg-gray-50">
                                                <td className="border p-3 font-medium text-gray-700 text-right">{staff.label}</td>
                                                <td className="border p-2">
                                                    <Input type="number" name={`etat_staff_${staff.key}_total`} value={formData[`etat_staff_${staff.key}_total`] ?? ''} onChange={handleChange} disabled={isReadOnly} min="0" />
                                                </td>
                                                <td className="border p-2">
                                                    <Input type="number" name={`etat_staff_${staff.key}_trained`} value={formData[`etat_staff_${staff.key}_trained`] ?? ''} onChange={handleChange} disabled={isReadOnly} min="0" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <StaffTable 
                            serviceKey="critical_staff" 
                            formData={formData} 
                            pendingData={pendingData}
                            isReadOnly={isReadOnly} 
                            handleStaffChange={handleStaffChange} 
                            handleAddStaffRow={handleAddStaffRow} 
                            handleRemoveStaffRow={handleRemoveStaffRow} 
                            jobTitles={jobTitles} 
                            onOpenMoveDeptModal={onOpenMoveDeptModal}
                            onOpenTransferFacModal={onOpenTransferFacModal}
                        />

                        <hr className="border-sky-200 my-4" />

                        <div>
                            <h4 className="text-md font-semibold mb-3 text-sky-800">استمارة تقييم خدمات الطوارئ</h4>
                            <div className="overflow-x-auto bg-white border border-gray-200 rounded">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead className="bg-sky-100">
                                        <tr>
                                            <th className="border p-2 text-right w-1/2 text-sky-800">البند</th>
                                            <th className="border p-2 text-center text-sky-800 w-1/4">الحالة</th>
                                            <th className="border p-2 text-right text-sky-800 w-1/4">تعليقات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ETAT_ASSESSMENT_QUESTIONS.map((q, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="border p-2 font-medium text-gray-700">{q.label} <PendingBadge fieldKey={`etat_${q.key}`} pendingData={pendingData} currentData={formData} /></td>
                                                <td className="border p-2 text-center">
                                                    <Select name={`etat_${q.key}`} value={formData[`etat_${q.key}`] || ''} onChange={handleChange} disabled={isReadOnly}>
                                                        <option value="">اختر...</option>
                                                        <option value="Yes">موجود</option>
                                                        <option value="No">غير موجود</option>
                                                    </Select>
                                                </td>
                                                <td className="border p-2"><Input type="text" name={`etat_${q.key}_notes`} value={formData[`etat_${q.key}_notes`] || ''} onChange={handleChange} disabled={isReadOnly} placeholder="إضافة تعليق..." /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <hr className="border-sky-200 my-4" />

                        <div>
                            <h4 className="text-md font-semibold mb-4 text-sky-800">الأجهزة والمعدات المتاحة (العدد)</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <FormGroup label={<>أمبوباق <PendingBadge fieldKey="etat_ambu_bag" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="etat_ambu_bag" value={formData.etat_ambu_bag ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label={<>قناع أكسجين <PendingBadge fieldKey="etat_oxygen_mask" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="etat_oxygen_mask" value={formData.etat_oxygen_mask ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label={<>جهاز قياس السكر <PendingBadge fieldKey="etat_glucometer" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="etat_glucometer" value={formData.etat_glucometer ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label={<>جهاز مضخة السوائل <PendingBadge fieldKey="etat_fluid_pump" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="etat_fluid_pump" value={formData.etat_fluid_pump ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label={<>جهاز شفط <PendingBadge fieldKey="etat_suction_machine" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="etat_suction_machine" value={formData.etat_suction_machine ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label={<>جهاز تنفس صناعي CPAP <PendingBadge fieldKey="etat_cpap" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="etat_cpap" value={formData.etat_cpap ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            </div>
                        </div>

                    </div>
                </div>

                {/* HDU Section */}
                <div className="p-4 border rounded-md transition-colors bg-gray-50 border-gray-200 hover:bg-white">
                    <FormGroup label={<>هل المؤسسة تقدم خدمة العناية الوسيطة HDU ؟ <PendingBadge fieldKey="hdu_has_service" pendingData={pendingData} currentData={formData} /></>}>
                        <Select name="hdu_has_service" value={formData.hdu_has_service || ''} onChange={handleChange} disabled={isReadOnly}>
                            <option value="">اختر...</option>
                            <option value="Yes">نعم</option>
                            <option value="No">لا</option>
                            <option value="Planned">مخططة</option>
                        </Select>
                    </FormGroup>

                    <div className="mt-4 pt-4 border-t border-sky-200 animate-fade-in space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormGroup label={<>عدد الاسرة في العناية الوسيطة <PendingBadge fieldKey="hdu_bed_capacity" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="hdu_bed_capacity" value={formData.hdu_bed_capacity ?? ''} onChange={handleChange} disabled={isReadOnly} placeholder="أدخل العدد" min="0" /></FormGroup>
                            <FormGroup label="تعليقات (عدد الأسرة)"><Input type="text" name="hdu_bed_capacity_notes" value={formData.hdu_bed_capacity_notes || ''} onChange={handleChange} disabled={isReadOnly} placeholder="إضافة تعليق..." /></FormGroup>
                        </div>

                        <hr className="border-sky-200 my-4" />

                        <div>
                            <h4 className="text-md font-semibold mb-3 text-sky-800">إحصائية الكوادر الطبية بقسم العناية الوسيطة</h4>
                            <div className="overflow-x-auto bg-white border border-gray-200 rounded">
                                <table className="min-w-full border-collapse text-sm text-center">
                                    <thead className="bg-sky-100/50">
                                        <tr>
                                            <th className="border p-2 text-right text-sky-800 w-1/3">الوصف الوظيفي</th>
                                            <th className="border p-2 text-sky-800 w-1/3">العدد الموجود</th>
                                            <th className="border p-2 text-sky-800 w-1/3">العدد المدرب على BASIC</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CRITICAL_CARE_STAFF_CATEGORIES.map((staff) => (
                                            <tr key={staff.key} className="hover:bg-gray-50">
                                                <td className="border p-3 font-medium text-gray-700 text-right">{staff.label}</td>
                                                <td className="border p-2"><Input type="number" name={`hdu_staff_${staff.key}_total`} value={formData[`hdu_staff_${staff.key}_total`] ?? ''} onChange={handleChange} disabled={isReadOnly} min="0" /></td>
                                                <td className="border p-2"><Input type="number" name={`hdu_staff_${staff.key}_trained`} value={formData[`hdu_staff_${staff.key}_trained`] ?? ''} onChange={handleChange} disabled={isReadOnly} min="0" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <hr className="border-sky-200 my-4" />

                        <div>
                            <h4 className="text-md font-semibold mb-4 text-sky-800">الأجهزة والمعدات المتاحة (العدد)</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <FormGroup label={<>جهاز قياس السكر <PendingBadge fieldKey="hdu_glucometer" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="hdu_glucometer" value={formData.hdu_glucometer ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label={<>جهاز مضخة السوائل <PendingBadge fieldKey="hdu_fluid_pump" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="hdu_fluid_pump" value={formData.hdu_fluid_pump ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label={<>جهاز شفط <PendingBadge fieldKey="hdu_suction_machine" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="hdu_suction_machine" value={formData.hdu_suction_machine ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label={<>جهاز تنفس صناعي CPAP <PendingBadge fieldKey="hdu_cpap" pendingData={pendingData} currentData={formData} /></>}><Input type="number" name="hdu_cpap" value={formData.hdu_cpap ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            </div>
                        </div>

                    </div>
                </div>

                {/* PICU Section */}
                <div className="p-4 border rounded-md transition-colors bg-gray-50 border-gray-200 hover:bg-white">
                    <FormGroup label={<>هل المؤسسة تقدم خدمة وحدة العناية المركزة للأطفال (PICU) ؟ <PendingBadge fieldKey="picu_has_service" pendingData={pendingData} currentData={formData} /></>}>
                        <Select name="picu_has_service" value={formData.picu_has_service || ''} onChange={handleChange} disabled={isReadOnly}>
                            <option value="">اختر...</option>
                            <option value="Yes">نعم</option>
                            <option value="No">لا</option>
                            <option value="Planned">مخططة</option>
                        </Select>
                    </FormGroup>

                    <div className="mt-4 pt-4 border-t border-sky-200 animate-fade-in">
                        <FormGroup label={<>سعة أسرة PICU <PendingBadge fieldKey="picu_bed_capacity" pendingData={pendingData} currentData={formData} /></>}>
                            <Input type="number" name="picu_bed_capacity" value={formData.picu_bed_capacity ?? ''} onChange={handleChange} disabled={isReadOnly} />
                        </FormGroup>
                    </div>
                </div>
            </div>
        </div>
    );
};