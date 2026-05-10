// FacilityForms.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, Search, Building2, MapPin, X, CheckCircle, WifiOff, XCircle } from 'lucide-react';

import {
    Card, PageHeader, Button, FormGroup, Input, Select,
    Spinner, Checkbox
} from './CommonComponents';
import {
    getHealthFacilityById,
    listHealthFacilities,
    submitFacilityDataForApproval,
} from "../data.js";
import {
    STATE_LOCALITIES
} from "./constants.js";

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

// --- PUBLIC-FACING FORMS ---
export function PublicFacilityUpdateForm({ setToast, serviceType }) {
    const [initialData, setInitialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusData, setStatusData] = useState(null); // For Status Popup

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
            const resultId = await submitFacilityDataForApproval(formData);
            setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
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
            <div className="w-full max-w-4xl">
                <GenericFacilityForm
                    initialData={initialData}
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
            {/* Inject Status Popup */}
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

            {/* FULL OVERLAY POP-UP FOR FACILITY SELECTION */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden transform transition-all">
                        
                        {/* Pop-up Header */}
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-sky-50">
                            <h3 className="font-bold text-sky-900 text-lg">البحث عن منشأة</h3>
                            <button type="button" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-white rounded-full shadow-sm border border-gray-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Pop-up Search Bar */}
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
                        
                        {/* Pop-up List */}
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
    
    // Ensure Critical Care maps to 'critical'
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
    const [isModalOpen, setIsModalOpen] = useState(true);
    const [formInitialData, setFormInitialData] = useState(null);
    const [selectionData, setSelectionData] = useState({
        state: searchParams.get('state') || '',
        locality: searchParams.get('locality') || '',
        facilityId: '',
    });
    const [facilitiesWithService, setFacilitiesWithService] = useState([]);
    const [facilitiesWithoutService, setFacilitiesWithoutService] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showOtherFacilities, setShowOtherFacilities] = useState(false);
    const [statusData, setStatusData] = useState(null); // For Status Popup

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
                            case 'imnci': 
                                hasService = f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes' || isPHC; 
                                break;
                            case 'eenc': 
                                hasService = f.eenc_provides_essential_care === 'Yes' || isHospital; 
                                break;
                            case 'neonatal': 
                                hasService = f.neonatal_level_primary === 'Yes' || f.neonatal_level_secondary === 'Yes' || f.neonatal_level_tertiary === 'Yes' || isHospital; 
                                break;
                            case 'critical': 
                                hasService = f.etat_has_service === 'Yes' || f.hdu_has_service === 'Yes' || f.picu_has_service === 'Yes' || isHospital; 
                                break;
                        }
                        if (hasService) withService.push(f);
                        else withoutService.push(f);
                    });
                    
                    setFacilitiesWithService(withService);
                    setFacilitiesWithoutService(withoutService);
                    if (withService.length === 0) setShowOtherFacilities(true);
                };

                // Try fetching from Cache first for immediate display
                let cachedData = [];
                try {
                    cachedData = await listHealthFacilities(
                        { state: selectionData.state, locality: selectionData.locality },
                        { source: 'cache' }
                    );
                } catch (e) {
                    // Ignore cache errors
                }

                if (cachedData && cachedData.length > 0) {
                    partitionFacilities(cachedData);
                    setIsLoading(false);
                } else {
                    setIsLoading(true);
                }

                // Fetch fresh data in the background
                try {
                    const freshData = await listHealthFacilities({
                        state: selectionData.state,
                        locality: selectionData.locality,
                    });
                    partitionFacilities(freshData);
                } catch (error) {
                    if (!cachedData || cachedData.length === 0) {
                        setToast({ show: true, message: 'Could not fetch list.', type: 'error' });
                    }
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
            setStep('form');
        } else {
            setIsLoading(true);
            try {
                const data = await getHealthFacilityById(selectionData.facilityId);
                setFormInitialData(data);
                setStep('form');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSave = async (formData) => {
        try {
            await submitFacilityDataForApproval(formData);
            setStatusData({ status: navigator.onLine ? 'success' : 'queued', message: '' });
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
            <div className="w-full max-w-4xl space-y-4">
                <div className="flex justify-start" dir="rtl">
                    <Button variant="secondary" onClick={() => setStep('selection')} className="flex items-center gap-2 font-bold px-6 py-2 rounded-lg border-2 border-gray-200 hover:bg-white shadow-sm">
                        <ArrowLeft className="w-5 h-5 ml-2" /> العودة لاختيار المنشأة
                    </Button>
                </div>
                <GenericFacilityForm
                    initialData={formInitialData}
                    onSave={handleSave}
                    onCancel={() => setStep('selection')}
                    setToast={setToast}
                    title={serviceTitle}
                    isPublicForm={true}
                >
                    {(props) => <FormComponent {...props} />}
                </GenericFacilityForm>
            </div>
            {/* Inject Status Popup */}
            <SaveStatusModal statusData={statusData} onClose={handleCloseStatusModal} />
        </div>
    );
}

// ... SharedFacilityFields ...
export const SharedFacilityFields = ({ formData, handleChange, handleStateChange, isPublicForm = false, isReadOnly = false }) => {
    
    // --- LOCATION FETCHING STATE & HANDLER ---
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

    return (
        <div className="space-y-8">
            <div className="border-2 border-sky-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="bg-sky-50 px-5 py-4 border-b border-sky-100 flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-sky-600" />
                    <h3 className="text-lg font-bold text-sky-800">البيانات الأساسية للمنشأة</h3>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormGroup label="الولاية">
                            <Select name="الولاية" value={formData['الولاية'] || ''} onChange={handleStateChange} required disabled={isReadOnly}>
                                <option value="">اختر الولاية</option>
                                {Object.keys(STATE_LOCALITIES).map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="المحلية">
                            <Select name="المحلية" value={formData['المحلية'] || ''} onChange={handleChange} required disabled={!formData['الولاية'] || isReadOnly}>
                                <option value="">اختر المحلية</option>
                                {formData['الولاية'] && STATE_LOCALITIES[formData['الولاية']]?.localities.map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                            </Select>
                        </FormGroup>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormGroup label="اسم المؤسسة"><Input name="اسم_المؤسسة" value={formData['اسم_المؤسسة'] || ''} onChange={handleChange} required disabled={isReadOnly} className="border-2 border-gray-100" /></FormGroup>
                        <FormGroup label="ملكية المؤسسة">
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
                        <FormGroup label="نوع المؤسسة الصحية">
                            <Select name="نوع_المؤسسةالصحية" value={formData['نوع_المؤسسةالصحية'] || ''} onChange={handleChange} disabled={isReadOnly}>
                                <option value="">اختر النوع</option>
                                <option value="مركز صحة الاسرة">مركز صحة الاسرة</option>
                                <option value="مستشفى ريفي">مستشفى ريفي</option>
                                <option value="وحدة صحة الاسرة">وحدة صحة الاسرة</option>
                                <option value="مستشفى">مستشفى</option>
                            </Select>
                        </FormGroup>
                        <FormGroup label="نوع الخدمات المقدمة">
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
                    <FormGroup label="هل المؤسسة تعمل؟">
                        <Select name="هل_المؤسسة_تعمل" value={formData['هل_المؤسسة_تعمل'] || ''} onChange={handleChange} disabled={isReadOnly} required>
                            <option value="">اختر...</option>
                            <option value="Yes">نعم</option>
                            <option value="No">لا</option>
                        </Select>
                    </FormGroup>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 bg-gray-50/50 border border-gray-100 rounded-xl space-y-4">
                            <FormGroup label="هل توجد حوافز للاستاف؟">
                                <Select name="staff_incentives" value={formData.staff_incentives || ''} onChange={handleChange} disabled={isReadOnly}>
                                    <option value="">اختر...</option>
                                    <option value="Yes">نعم</option>
                                    <option value="No">لا</option>
                                </Select>
                            </FormGroup>
                            {formData.staff_incentives === 'Yes' && (
                                <div className="animate-fade-in"><FormGroup label="ما هي المنظمة المقدم للحوافز؟"><Input type="text" name="staff_incentives_organization" value={formData.staff_incentives_organization || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup></div>
                            )}
                        </div>
                        <div className="p-5 bg-gray-50/50 border border-gray-100 rounded-xl space-y-4">
                            <FormGroup label="هل تشارك المؤسسة في أي مشروع؟">
                                <Select name="project_participation" value={formData.project_participation || ''} onChange={handleChange} disabled={isReadOnly}>
                                    <option value="">اختر...</option>
                                    <option value="Yes">نعم</option>
                                    <option value="No">لا</option>
                                </Select>
                            </FormGroup>
                            {formData.project_participation === 'Yes' && (
                                <div className="animate-fade-in"><FormGroup label="ما هو اسم المشروع؟"><Input type="text" name="project_name" value={formData.project_name || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup></div>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <FormGroup label="رقم هاتف المسئول من المؤسسة">
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
                            <FormGroup label="خط العرض (Latitude)">
                                <Input type="number" step="any" name="_الإحداثيات_latitude" value={formData['_الإحداثيات_latitude'] || ''} onChange={handleChange} disabled={isReadOnly} />
                            </FormGroup>
                            <FormGroup label="خط الطول (Longitude)">
                                <Input type="number" step="any" name="_الإحداثيات_longitude" value={formData['_الإحداثيات_longitude'] || ''} onChange={handleChange} disabled={isReadOnly} />
                            </FormGroup>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- GENERIC FACILITY FORM WRAPPER ---
export const GenericFacilityForm = React.forwardRef(({
    initialData,
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
    isSubmitting = false // Retained to support external disabling (e.g. from modals)
}, ref) => {
    const [isLocalSubmitting, setIsLocalSubmitting] = useState(false); // Manages button loading state

    const [formData, setFormData] = useState(() => {
        let processedData = initialData ? { ...initialData } : {};
        processedData.date_of_visit = new Date().toISOString().split('T')[0];
        
        if (!initialData) {
            const fieldsToDefaultNo = ['وجود_سجل_علاج_متكامل', 'وجود_كتيب_لوحات', 'ميزان_وزن', 'ميزان_طول', 'ميزان_حرارة', 'ساعة_مؤقت', 'غرفة_إرواء', 'eenc_steam_sterilizer', 'eenc_wall_clock', 'etat_has_service', 'hdu_has_service', 'picu_has_service', 'neonatal_kmc_unit', 'neonatal_breastfeeding_unit', 'neonatal_sterilization_unit', 'immunization_office_exists', 'nutrition_center_exists', 'growth_monitoring_service_exists', 'neonatal_sepsis_surveillance'];
            fieldsToDefaultNo.forEach(field => processedData[field] = processedData[field] || 'No');
        }

        // Migrate old imnci_staff to new structured arrays
        if (processedData && (processedData.اسم_الكادر_المعالج || processedData.الوصف_الوظيفي) && !processedData.imnci_staff) {
            processedData.imnci_staff = [{ name: processedData.اسم_الكادر_المعالج || '', job_title: processedData.الوصف_الوظيفي || '', is_trained: processedData.هل_تم_التدريب_على_العلاج_المتكامل || 'No', training_date: processedData.تاريخ_التدريب || '', phone: processedData.رقم_الهاتف || '' }];
            delete processedData.اسم_الكادر_المعالج; delete processedData.الوصف_الوظيفي; delete processedData.هل_تم_التدريب_على_العلاج_المتكامل; delete processedData.تاريخ_التدريب; delete processedData.رقم_الهاتف;
        }
        
        // Ensure all staff arrays are initialized
        if (!processedData.imnci_staff) processedData.imnci_staff = [];
        if (!processedData.eenc_staff) processedData.eenc_staff = [];
        if (!processedData.neonatal_staff) processedData.neonatal_staff = [];
        if (!processedData.critical_staff) processedData.critical_staff = [];

        // Legacy cleanup for neonatal_level_of_care if it exists as a string or object from previous versions
        if (processedData.neonatal_level_of_care) {
             delete processedData.neonatal_level_of_care;
        }

        return processedData;
    });

    const [submitterName, setSubmitterName] = useState('');
    const [submitterEmail, setSubmitterEmail] = useState('');
    const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
    const isEditing = !!initialData?.id;

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

    // Generic Handlers for Dynamic Staff Tables
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

    const currentlySubmitting = isSubmitting || isLocalSubmitting;

    return (
        <div dir="rtl">
            <Card className="shadow-xl border-t-4 border-t-sky-500 overflow-hidden">
                <div className="bg-gradient-to-r from-sky-50 to-white px-6 py-5 border-b border-gray-100">
                    <h2 className="text-2xl font-extrabold text-sky-900">{isEditing ? `تعديل: ${title}` : `إضافة: ${title}`}</h2>
                    <p className="text-sky-700 mt-1 font-medium">{subtitle || (isEditing ? (formData['اسم_المؤسسة'] || "Update details for this facility") : "أدخل تفاصيل المنشأة الجديدة.")}</p>
                </div>
                
                <div className="p-6">
                    <form onSubmit={handleSubmit} ref={ref}>
                        <SharedFacilityFields 
                            formData={formData} 
                            handleChange={handleChange} 
                            handleStateChange={handleStateChange} 
                            isPublicForm={isPublicForm} 
                            isReadOnly={isReadOnly} 
                        />
                        
                        <div className="mt-8">
                            {children({ 
                                formData, 
                                handleChange, 
                                handleStateChange, 
                                handleStaffChange, 
                                handleAddStaffRow, 
                                handleRemoveStaffRow, 
                                handleCheckboxGroupChange,
                                isReadOnly 
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
                            <Button type="button" variant="secondary" onClick={onCancel} disabled={currentlySubmitting} className="px-6">
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

export const StaffTable = ({ serviceKey, formData, isReadOnly, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, jobTitles }) => {
    const staffList = formData[serviceKey] || [];
    return (
        <div>
            <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">معلومات الكادر بالاسم ({staffList.length})</h4>
            <div className="overflow-x-auto bg-white border rounded shadow-sm">
                <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-sky-100/50">
                        <tr>
                            <th className="border p-2 text-right text-sky-800">الاسم</th>
                            <th className="border p-2 text-right text-sky-800">الوصف الوظيفي</th>
                            <th className="border p-2 text-right text-sky-800">هل مدرب</th>
                            <th className="border p-2 text-right text-sky-800">تاريخ اخر تدريب</th>
                            <th className="border p-2 text-right text-sky-800">رقم الهاتف</th>
                            <th className="border p-2 text-center text-sky-800 w-16">إجراء</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffList.map((staff, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="border p-1"><Input name="name" value={staff.name} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={isReadOnly} /></td>
                                <td className="border p-1">
                                    <Select name="job_title" value={staff.job_title} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={isReadOnly}>
                                        <option value="">اختر الوصف</option>
                                        {jobTitles.map(t => <option key={t} value={t}>{t}</option>)}
                                    </Select>
                                </td>
                                <td className="border p-1"><Select name="is_trained" value={staff.is_trained} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option><option value="Planned">مخططة</option></Select></td>
                                <td className="border p-1"><Input type="date" name="training_date" value={staff.training_date} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={staff.is_trained !== 'Yes' || isReadOnly} /></td>
                                <td className="border p-1"><Input type="tel" name="phone" value={staff.phone} onChange={(e) => handleStaffChange(serviceKey, index, e)} disabled={isReadOnly} /></td>
                                <td className="border p-1 text-center"><Button size="sm" variant="danger" type="button" onClick={(e) => handleRemoveStaffRow(serviceKey, e, index)} disabled={isReadOnly} className="w-full">حذف</Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Button type="button" onClick={(e) => handleAddStaffRow(serviceKey, e)} variant="secondary" className="mt-3 font-bold shadow-sm" disabled={isReadOnly}>+ إضافة كادر</Button>
        </div>
    );
};

export const IMNCIFormFields = ({ formData, handleChange, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, isReadOnly = false }) => {
    const jobTitles = ['طبيب', 'مساعد طبي', 'ممرض معالج', 'مسؤول تغذية', 'زائرة صحية'];

    return (
        <div className="border border-sky-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-sky-100 px-4 py-3 border-b border-sky-200">
                <h3 className="text-lg font-semibold text-sky-800">IMNCI Services (خدمات العلاج المتكامل لأمراض الطفولة)</h3>
            </div>
            <div className="p-5 space-y-6">
                <FormGroup label="هل تتوفر خدمة العلاج المتكامل لأمراض الطفولة؟">
                    <p className="text-sm font-medium text-sky-700 mb-2">الكوادر العاملة في المؤسسة مدربة بنسبة 50% أو لأكثر</p>
                    <Select name="وجود_العلاج_المتكامل_لامراض_الطفولة" value={formData['وجود_العلاج_المتكامل_لامراض_الطفولة'] || ''} onChange={handleChange} disabled={isReadOnly} required>
                        <option value="">اختر...</option>
                        <option value="Yes">نعم</option>
                        <option value="No">لا</option>
                        <option value="Planned">مخططة</option>
                    </Select>
                </FormGroup>

                {/* Always show the nested fields */}
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
                        isReadOnly={isReadOnly} 
                        handleStaffChange={handleStaffChange} 
                        handleAddStaffRow={handleAddStaffRow} 
                        handleRemoveStaffRow={handleRemoveStaffRow} 
                        jobTitles={jobTitles} 
                    />

                    <hr className="border-gray-200" />
                    
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">الموارد والمعدات المتاحة</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormGroup label="وجود سجل علاج متكامل"><Select name="وجود_سجل_علاج_متكامل" value={formData['وجود_سجل_علاج_متكامل'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label="وجود كتيب لوحات"><Select name="وجود_كتيب_لوحات" value={formData['وجود_كتيب_لوحات'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label="ميزان وزن"><Select name="ميزان_وزن" value={formData['ميزان_وزن'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label="ميزان طول"><Select name="ميزان_طول" value={formData['ميزان_طول'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label="ميزان حرارة"><Select name="ميزان_حرارة" value={formData['ميزان_حرارة'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label="ساعة مؤقت"><Select name="ساعة_مؤقت" value={formData['ساعة_مؤقت'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label="غرفة إرواء"><Select name="غرفة_إرواء" value={formData['غرفة_إرواء'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">الخدمات الاخرى</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                                <FormGroup label="هل يوجد مكتب تحصين؟"><Select name="immunization_office_exists" value={formData.immunization_office_exists || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                                {formData.immunization_office_exists === 'No' && <FormGroup label="اين يقع اقرب مركز تحصين؟" className="mt-3"><Input type="text" name="nearest_immunization_center" value={formData.nearest_immunization_center || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>}
                            </div>
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                                <FormGroup label="هل يوجد مركز تغذية خارجي؟"><Select name="nutrition_center_exists" value={formData.nutrition_center_exists || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                                {formData.nutrition_center_exists === 'No' && <FormGroup label="اين يقع اقرب مركز تغذية خارجي؟" className="mt-3"><Input type="text" name="nearest_nutrition_center" value={formData.nearest_nutrition_center || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>}
                            </div>
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                                <FormGroup label="هل يوجد خدمة متابعة النمو ؟"><Select name="growth_monitoring_service_exists" value={formData.growth_monitoring_service_exists || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const EENCFormFields = ({ formData, handleChange, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, isReadOnly = false }) => {
    const jobTitles = ['طبيب أطفال', 'طبيب نساء وتوليد', 'طبيب عمومي', 'قابلة', 'ممرض', 'مساعد طبي'];

    return (
        <div className="border border-sky-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-sky-100 px-4 py-3 border-b border-sky-200">
                <h3 className="text-lg font-semibold text-sky-800">EENC Services (خدمات الرعاية الطارئة لحديثي الولادة)</h3>
            </div>
            <div className="p-5 space-y-6">
                <FormGroup label="هل تقدم الرعاية الضرورية المبكرة لحديثي الولادة والأطفال؟">
                    <p className="text-sm font-medium text-sky-700 mb-2">تم تدريب الكوادر العاملة في غرفة الولادة على الرعاية الضرورية المبكرة للاطفال حديثي الولادة</p>
                    <Select name="eenc_provides_essential_care" value={formData.eenc_provides_essential_care || ''} onChange={handleChange} disabled={isReadOnly} required>
                        <option value="">اختر...</option>
                        <option value="Yes">نعم</option>
                        <option value="No">لا</option>
                        <option value="Planned">مخططة</option>
                    </Select>
                </FormGroup>

                <div className="space-y-6 animate-fade-in pt-4 border-t border-gray-200">
                    <FormGroup label="عدد الكوادر الصحية المدربة (إجمالي)"><Input type="number" name="eenc_trained_workers" value={formData.eenc_trained_workers ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                    
                    <StaffTable 
                        serviceKey="eenc_staff" 
                        formData={formData} 
                        isReadOnly={isReadOnly} 
                        handleStaffChange={handleStaffChange} 
                        handleAddStaffRow={handleAddStaffRow} 
                        handleRemoveStaffRow={handleRemoveStaffRow} 
                        jobTitles={jobTitles} 
                    />

                    <hr className="border-gray-200" />
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">الموارد والمعدات المتاحة</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormGroup label="العدد الكلي لسرير الولادة"><Input type="number" name="eenc_delivery_beds" value={formData.eenc_delivery_beds ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="العدد الكلي لمحطات الانعاش"><Input type="number" name="eenc_resuscitation_stations" value={formData.eenc_resuscitation_stations ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="العدد الكلي لاجهزة التدفئة"><Input type="number" name="eenc_warmers" value={formData.eenc_warmers ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="العدد الكلي لجهاز الامبوباق"><Input type="number" name="eenc_ambu_bags" value={formData.eenc_ambu_bags ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="العدد الكلي لجهاز الشفط اليدوي"><Input type="number" name="eenc_manual_suction" value={formData.eenc_manual_suction ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="ساعة حائط"><Select name="eenc_wall_clock" value={formData.eenc_wall_clock || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                            <FormGroup label="جهاز التعقيم بالبخار"><Select name="eenc_steam_sterilizer" value={formData.eenc_steam_sterilizer || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const NeonatalFormFields = ({ formData, handleChange, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, isReadOnly = false }) => {
    const jobTitles = ['اختصاصي أطفال', 'طبيب أطفال', 'طبيب عمومي', 'ممرض عناية مكثفة', 'ممرض', 'قابلة'];

    return (
        <div className="border border-sky-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-sky-100 px-4 py-3 border-b border-sky-200">
                <h3 className="text-lg font-semibold text-sky-800">Neonatal Care Unit (وحدة رعاية حديثي الولادة)</h3>
            </div>
            <div className="p-5 space-y-6">

                <div className="space-y-8 animate-fade-in">
                    
                    {/* --- DEDICATED LEVEL OF CARE QUESTIONS --- */}
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-6">
                        <h4 className="text-md font-extrabold text-sky-800 mb-2 border-b border-gray-200 pb-3">مستويات الرعاية لحديثي الولادة</h4>
                        
                        <FormGroup label="هل تتوفر رعاية أساسية لحديثي الولادة (المستوى الأولي)؟">
                            <p className="text-sm font-medium text-sky-700 mb-2">يتم تنويم الاطفال حديثي الولادة ومعالجة الامراض البسيطة التسمم الدموي - اليرقان....</p>
                            <Select name="neonatal_level_primary" value={formData.neonatal_level_primary || ''} onChange={handleChange} disabled={isReadOnly}>
                                <option value="">اختر...</option>
                                <option value="Yes">نعم</option>
                                <option value="No">لا</option>
                                <option value="Planned">مخططة</option>
                            </Select>
                        </FormGroup>

                        <FormGroup label="هل تتوفر وحدة رعاية خاصة لحديثي الولادة (المستوى الثانوي)؟">
                            <p className="text-sm font-medium text-sky-700 mb-2">تقديم خدمة تنويم الاطفال حديثي الولادة بما يشمل الاطفال الخدج ، الاكسجين ، ...،</p>
                            <Select name="neonatal_level_secondary" value={formData.neonatal_level_secondary || ''} onChange={handleChange} disabled={isReadOnly}>
                                <option value="">اختر...</option>
                                <option value="Yes">نعم</option>
                                <option value="No">لا</option>
                                <option value="Planned">مخططة</option>
                            </Select>
                        </FormGroup>

                        <FormGroup label="هل تتوفر وحدة العناية المركزة لحديثي الولادة (المستوى الثالثوي)؟">
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
                        isReadOnly={isReadOnly} 
                        handleStaffChange={handleStaffChange} 
                        handleAddStaffRow={handleAddStaffRow} 
                        handleRemoveStaffRow={handleRemoveStaffRow} 
                        jobTitles={jobTitles} 
                    />

                    <hr className="border-gray-200" />
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">خدمات ملحقة</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="p-3 border border-gray-200 rounded-md hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer">
                                <span className="font-medium text-gray-700">وحدة رعاية الكنغر (KMC unit)</span>
                                <Checkbox name="neonatal_kmc_unit" label="" checked={formData.neonatal_kmc_unit === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                            </label>
                            <label className="p-3 border border-gray-200 rounded-md hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer">
                                <span className="font-medium text-gray-700">وحدة الرضاعة الطبيعية (breastfeeding unit)</span>
                                <Checkbox name="neonatal_breastfeeding_unit" label="" checked={formData.neonatal_breastfeeding_unit === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                            </label>
                            <label className="p-3 border border-gray-200 rounded-md hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer">
                                <span className="font-medium text-gray-700">وحدة تعقيم (sterilization unit)</span>
                                <Checkbox name="neonatal_sterilization_unit" label="" checked={formData.neonatal_sterilization_unit === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                            </label>
                            <label className="p-3 border border-gray-200 rounded-md hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer">
                                <span className="font-medium text-gray-700">الترصد والحماية من عدوى التسمم الدموي</span>
                                <Checkbox name="neonatal_sepsis_surveillance" label="" checked={formData.neonatal_sepsis_surveillance === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                            </label>
                        </div>
                    </div>

                    <hr className="border-gray-200" />
                    
                    <div>
                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">المعدات المتاحة</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormGroup label="إجمالي سعة الأسرة"><Input type="number" name="neonatal_total_beds" value={formData.neonatal_total_beds ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="العدد الكلي للحضانات (incubators)"><Input type="number" name="neonatal_total_incubators" value={formData.neonatal_total_incubators ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="العدد الكلي للاسرة للاطفال مكتملي النمو (cots)"><Input type="number" name="neonatal_total_cots" value={formData.neonatal_total_cots ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="أجهزة CPAP"><Input type="number" name="neonatal_cpap" value={formData.neonatal_cpap ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="جهاز تدفئة حرارية (warmer)"><Input type="number" name="neonatal_warmer" value={formData.neonatal_warmer ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="مضخة تسريب (infusion pump)"><Input type="number" name="neonatal_infusion_pump" value={formData.neonatal_infusion_pump ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="مضخات الحقن (Syringe pump)"><Input type="number" name="neonatal_syringe_pump" value={formData.neonatal_syringe_pump ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="جهاز شفط (suction machine)"><Input type="number" name="neonatal_sucker" value={formData.neonatal_sucker ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="وحدات العلاج الضوئي (Phototherapy)"><Input type="number" name="neonatal_phototherapy" value={formData.neonatal_phototherapy ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="أكياس الإنعاش (Ambu Bag)"><Input type="number" name="neonatal_ambu_bag" value={formData.neonatal_ambu_bag ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="جهاز مراقبة التنفس والاكسجين (Pulse and oxygen Monitor)"><Input type="number" name="neonatal_respiration_monitor" value={formData.neonatal_respiration_monitor ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="جهاز أكسجين (Oxygen concentrator)"><Input type="number" name="neonatal_oxygen_machine" value={formData.neonatal_oxygen_machine ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="أسطوانة الاكسجين (oxygen cylinder)"><Input type="number" name="neonatal_oxygen_cylinder" value={formData.neonatal_oxygen_cylinder ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="جهاز تنفس صناعي (Mechanical ventilator)"><Input type="number" name="neonatal_mechanical_ventilator" value={formData.neonatal_mechanical_ventilator ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            <FormGroup label="حاضنة محمولة (Portable Incubator)"><Input type="number" name="neonatal_portable_incubator" value={formData.neonatal_portable_incubator ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
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

export const CriticalCareFormFields = ({ formData, handleChange, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, isReadOnly = false }) => {
    const jobTitles = ['اختصاصي أطفال', 'نائب اختصاصي أطفال', 'طبيب عمومي', 'طبيب إمتياز', 'ممرض (بكلاريوس)', 'ممرض (دبلوم)'];
    
    return (
        <div className="border border-sky-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-sky-100 px-4 py-3 border-b border-sky-200">
                <h3 className="text-lg font-semibold text-sky-800">Emergency & Critical Care (الطوارئ والرعاية الحرجة)</h3>
            </div>
            <div className="p-5 space-y-6">
                
                {/* ETAT Section */}
                <div className="p-4 border rounded-md transition-colors bg-gray-50 border-gray-200 hover:bg-white">
                    <FormGroup label="هل المؤسسة تقدم خدمة الفرز والتقييم والعلاج لطوارئ الأطفال (ETAT) ؟">
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
                            isReadOnly={isReadOnly} 
                            handleStaffChange={handleStaffChange} 
                            handleAddStaffRow={handleAddStaffRow} 
                            handleRemoveStaffRow={handleRemoveStaffRow} 
                            jobTitles={jobTitles} 
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
                                                <td className="border p-2 font-medium text-gray-700">{q.label}</td>
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
                                <FormGroup label="أمبوباق"><Input type="number" name="etat_ambu_bag" value={formData.etat_ambu_bag ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label="قناع أكسجين"><Input type="number" name="etat_oxygen_mask" value={formData.etat_oxygen_mask ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label="جهاز قياس السكر"><Input type="number" name="etat_glucometer" value={formData.etat_glucometer ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label="جهاز مضخة السوائل"><Input type="number" name="etat_fluid_pump" value={formData.etat_fluid_pump ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label="جهاز شفط"><Input type="number" name="etat_suction_machine" value={formData.etat_suction_machine ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label="جهاز تنفس صناعي CPAP"><Input type="number" name="etat_cpap" value={formData.etat_cpap ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            </div>
                        </div>

                    </div>
                </div>

                {/* HDU Section */}
                <div className="p-4 border rounded-md transition-colors bg-gray-50 border-gray-200 hover:bg-white">
                    <FormGroup label="هل المؤسسة تقدم خدمة العناية الوسيطة HDU ؟">
                        <Select name="hdu_has_service" value={formData.hdu_has_service || ''} onChange={handleChange} disabled={isReadOnly}>
                            <option value="">اختر...</option>
                            <option value="Yes">نعم</option>
                            <option value="No">لا</option>
                            <option value="Planned">مخططة</option>
                        </Select>
                    </FormGroup>

                    <div className="mt-4 pt-4 border-t border-sky-200 animate-fade-in space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormGroup label="عدد الاسرة في العناية الوسيطة"><Input type="number" name="hdu_bed_capacity" value={formData.hdu_bed_capacity ?? ''} onChange={handleChange} disabled={isReadOnly} placeholder="أدخل العدد" min="0" /></FormGroup>
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
                                <FormGroup label="جهاز قياس السكر"><Input type="number" name="hdu_glucometer" value={formData.hdu_glucometer ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label="جهاز مضخة السوائل"><Input type="number" name="hdu_fluid_pump" value={formData.hdu_fluid_pump ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label="جهاز شفط"><Input type="number" name="hdu_suction_machine" value={formData.hdu_suction_machine ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                                <FormGroup label="جهاز تنفس صناعي CPAP"><Input type="number" name="hdu_cpap" value={formData.hdu_cpap ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                            </div>
                        </div>

                    </div>
                </div>

                {/* PICU Section */}
                <div className="p-4 border rounded-md transition-colors bg-gray-50 border-gray-200 hover:bg-white">
                    <FormGroup label="هل المؤسسة تقدم خدمة وحدة العناية المركزة للأطفال (PICU) ؟">
                        <Select name="picu_has_service" value={formData.picu_has_service || ''} onChange={handleChange} disabled={isReadOnly}>
                            <option value="">اختر...</option>
                            <option value="Yes">نعم</option>
                            <option value="No">لا</option>
                            <option value="Planned">مخططة</option>
                        </Select>
                    </FormGroup>

                    <div className="mt-4 pt-4 border-t border-sky-200 animate-fade-in">
                        <FormGroup label="سعة أسرة PICU">
                            <Input type="number" name="picu_bed_capacity" value={formData.picu_bed_capacity ?? ''} onChange={handleChange} disabled={isReadOnly} />
                        </FormGroup>
                    </div>
                </div>
            </div>
        </div>
    );
};