// FacilityForms.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAuth, onAuthStateChanged } from "firebase/auth";

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

// --- PUBLIC-FACING FORMS ---

export function PublicFacilityUpdateForm({ setToast, serviceType }) {
    const [initialData, setInitialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
    };
    
    const FormComponent = FORM_KEY_TO_COMPONENT[serviceType?.toLowerCase()] || IMNCIFormFields;

    const handleSave = async (formData) => {
        try {
            await submitFacilityDataForApproval(formData);
            setToast({ show: true, message: "Update submitted successfully! Your changes are pending approval.", type: 'success' });
        } catch (error) {
            setToast({ show: true, message: `Submission failed: ${error.message}`, type: 'error' });
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
                    onCancel={() => alert("Submission cancelled.")}
                    setToast={setToast}
                    title="بيانات المنشأة الصحية"
                    subtitle={`Please review and update the details for ${initialData?.['اسم_المؤسسة'] || 'this facility'}.`}
                    isPublicForm={true}
                >
                    {(props) => <FormComponent {...props} />}
                </GenericFacilityForm>
            </div>
        </div>
    );
}

// --- Custom Searchable Select Component ---
const SearchableSelect = ({ options, value, onChange, placeholder = "اختر من القائمة...", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    const selectedOption = options.find(option => option.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

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
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                className="w-full text-right bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <span className="block truncate">
                    {selectedOption ? selectedOption.label : <span className="text-gray-500">{placeholder}</span>}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </span>
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    <div className="p-2 sticky top-0 bg-white z-10">
                        <Input
                            type="search"
                            placeholder="ابحث..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full"
                            autoFocus
                        />
                    </div>
                    <ul role="listbox">
                        {Object.entries(groupedOptions).map(([groupName, opts]) => (
                            <React.Fragment key={groupName}>
                                {groupName !== 'ungrouped' && opts.length > 0 && (
                                    <li className="text-gray-500 cursor-default select-none relative py-2 px-3 font-bold">{groupName}</li>
                                )}
                                {opts.map(option => (
                                    <li
                                        key={option.value}
                                        className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-sky-100 ${option.className || ''}`}
                                        onClick={() => handleSelect(option.value)}
                                    >
                                        <span className={`block truncate ${value === option.value ? 'font-semibold' : 'font-normal'}`}>
                                            {option.label}
                                        </span>
                                    </li>
                                ))}
                            </React.Fragment>
                        ))}
                         {filteredOptions.length === 0 && searchTerm && (
                            <li className="text-gray-500 cursor-default select-none relative py-2 px-3">لا توجد نتائج</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export function NewFacilityEntryForm({ setToast, serviceType }) {
    const [searchParams] = useState(new URLSearchParams(window.location.search));
    const formTypeKey = serviceType?.toLowerCase() || 'imnci';

    const TABS = { IMNCI: 'IMNCI Services', EENC: 'EENC Services', NEONATAL: 'Neonatal Care Unit', CRITICAL: 'Emergency & Critical Care' };
    const ARABIC_TITLES = { [TABS.IMNCI]: "خدمات العلاج المتكامل لأمراض الطفولة", [TABS.EENC]: "خدمات الرعاية الطارئة لحديثي الولادة", [TABS.NEONATAL]: "وحدة رعاية حديثي الولادة", [TABS.CRITICAL]: "الطوارئ والرعاية الحرجة" };
    const FORM_KEY_TO_TAB_CONSTANT = { 'imnci': TABS.IMNCI, 'eenc': TABS.EENC, 'neonatal': TABS.NEONATAL, 'critical': TABS.CRITICAL };
    const serviceTitle = ARABIC_TITLES[FORM_KEY_TO_TAB_CONSTANT[formTypeKey]] || "بيانات المنشأة الصحية";

    const [step, setStep] = useState('selection');
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

    useEffect(() => {
        setSelectionData(prev => ({ ...prev, facilityId: '' }));
        setShowOtherFacilities(false);

        const fetchAndPartitionFacilities = async () => {
            if (selectionData.state && selectionData.locality) {
                setIsLoading(true);
                setFacilitiesWithService([]);
                setFacilitiesWithoutService([]);
                try {
                    const allFacilities = await listHealthFacilities({
                        state: selectionData.state,
                        locality: selectionData.locality,
                    });

                    const withService = [];
                    const withoutService = [];

                    allFacilities.forEach(f => {
                        let hasService = false;
                        switch (formTypeKey) {
                            case 'imnci': hasService = f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes'; break;
                            case 'eenc': hasService = f.eenc_provides_essential_care === 'Yes'; break;
                            case 'neonatal': hasService = !!(f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary); break;
                            case 'critical': hasService = f.etat_has_service === 'Yes' || f.hdu_has_service === 'Yes' || f.picu_has_service === 'Yes'; break;
                            default: break;
                        }
                        if (hasService) withService.push(f);
                        else withoutService.push(f);
                    });
                    
                    if (formTypeKey === 'eenc' || formTypeKey === 'neonatal') {
                        const sortOrder = { 'CEmONC': 1, 'BEmONC': 2, 'pediatric': 3, 'general': 4 };
                        withoutService.sort((a, b) => {
                            const priorityA = sortOrder[a.eenc_service_type] || 5;
                            const priorityB = sortOrder[b.eenc_service_type] || 5;
                            if (priorityA === priorityB) {
                                return a['اسم_المؤسسة'].localeCompare(b['اسم_المؤسسة']);
                            }
                            return priorityA - priorityB;
                        });
                    }

                    setFacilitiesWithService(withService);
                    setFacilitiesWithoutService(withoutService);
                } catch (error) {
                    setToast({ show: true, message: 'Could not fetch the list of existing facilities.', type: 'error' });
                } finally {
                    setIsLoading(false);
                }
            } else {
                setFacilitiesWithService([]);
                setFacilitiesWithoutService([]);
            }
        };
        fetchAndPartitionFacilities();
    }, [selectionData.state, selectionData.locality, setToast, formTypeKey]);

    const facilityOptions = useMemo(() => {
        const options = [];
        
        if (showOtherFacilities || facilitiesWithoutService.length === 0) {
            options.push({
                value: 'addNew',
                label: '--- إضافة منشأة جديدة ---',
                className: 'font-bold text-sky-600 bg-sky-50'
            });
        }
    
        if (facilitiesWithService.length > 0) {
            facilitiesWithService.forEach(f => options.push({
                value: f.id,
                label: f['اسم_المؤسسة'],
                group: `منشآت تقدم الخدمة (${serviceTitle})`
            }));
        }
    
        if (showOtherFacilities && facilitiesWithoutService.length > 0) {
            facilitiesWithoutService.forEach(f => options.push({
                value: f.id,
                label: f['اسم_المؤسسة'],
                group: 'منشآت أخرى في هذه المحلية'
            }));
        }
        
        return options;
    }, [showOtherFacilities, facilitiesWithService, facilitiesWithoutService, serviceTitle]);

    const handleSelectionChange = (e) => {
        const { name, value } = e.target;
        setSelectionData(prev => ({ ...prev, [name]: value }));
    };

    const handleStateChange = (e) => {
        const { name, value } = e.target;
        setSelectionData(prev => ({ ...prev, [name]: value, locality: '', facilityId: '' }));
    };

    const handleProceedToUpdate = async () => {
        if (!selectionData.facilityId) return;
        setIsLoading(true);
        try {
            const facilityData = await getHealthFacilityById(selectionData.facilityId);
            if (facilityData) {
                setFormInitialData(facilityData);
                setStep('form');
            } else {
                 setToast({ show: true, message: 'The selected facility could not be found.', type: 'error' });
            }
        } catch (error) {
             setToast({ show: true, message: 'Error fetching facility details.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleProceedToAddNew = () => {
        setFormInitialData({ 'الولاية': selectionData.state, 'المحلية': selectionData.locality });
        setStep('form');
    };

    const handleProceed = () => {
        if (!selectionData.facilityId) return;
        if (selectionData.facilityId === 'addNew') {
            handleProceedToAddNew();
        } else {
            handleProceedToUpdate();
        }
    };

    const handleSave = async (formData) => {
        try {
            await submitFacilityDataForApproval(formData);
            setToast({ show: true, message: "Submission successful! Your changes are pending approval.", type: 'success' });
            setStep('selection');
            setFormInitialData(null);
        } catch (error) {
            setToast({ show: true, message: `Submission failed: ${error.message}`, type: 'error' });
        }
    };

    const handleCancelForm = () => {
        setStep('selection');
        setFormInitialData(null);
    };

    const renderSelectionScreen = () => {
        return (
            <div dir="rtl">
                <Card>
                    <div className="text-center">
                        <PageHeader
                            title={`إدخال بيانات: ${serviceTitle}`}
                            subtitle="الرجاء اختيار الولاية والمحلية للمتابعة"
                        />
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormGroup label="الولاية">
                                <Select name="state" value={selectionData.state} onChange={handleStateChange} required>
                                    <option value="">اختر الولاية</option>
                                    {Object.keys(STATE_LOCALITIES).map(sKey => <option key={sKey} value={sKey}>{STATE_LOCALITIES[sKey].ar}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="المحلية">
                                <Select name="locality" value={selectionData.locality} onChange={handleSelectionChange} required disabled={!selectionData.state}>
                                    <option value="">اختر المحلية</option>
                                    {selectionData.state && STATE_LOCALITIES[selectionData.state]?.localities.map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                                </Select>
                            </FormGroup>
                        </div>

                        {isLoading && <div className="flex justify-center p-4"><Spinner /></div>}

                        {!isLoading && selectionData.locality && (
                            <div className="p-4 border rounded-md bg-gray-50 space-y-3 mt-4 animate-fade-in">
                                <FormGroup label="اختر منشأة لتحديثها أو أضف واحدة جديدة">
                                   <SearchableSelect
                                        value={selectionData.facilityId}
                                        onChange={handleSelectionChange}
                                        options={facilityOptions}
                                   />
                                </FormGroup>

                                {!showOtherFacilities && facilitiesWithoutService.length > 0 && (
                                    <button type="button" onClick={() => setShowOtherFacilities(true)} className="text-sm text-sky-600 hover:text-sky-800 hover:underline focus:outline-none">
                                        لم تجد المنشأة؟ عرض المنشآt الأخرى ({facilitiesWithoutService.length})
                                    </button>
                                )}
                                
                                <Button onClick={handleProceed} disabled={!selectionData.facilityId}>
                                    متابعة
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        );
    };

    const renderFormScreen = () => {
        const isEditing = !!formInitialData?.id;
        
        const FORM_KEY_TO_COMPONENT = {
            'imnci': IMNCIFormFields,
            'eenc': EENCFormFields,
            'neonatal': NeonatalFormFields,
            'critical': CriticalCareFormFields,
        };

        const FormComponent = FORM_KEY_TO_COMPONENT[formTypeKey] || IMNCIFormFields;

        let subtitle;
        if (isEditing) {
            const state = STATE_LOCALITIES[formInitialData['الولاية']]?.ar || formInitialData['الولاية'] || '';
            const locality = STATE_LOCALITIES[formInitialData['الولاية']]?.localities.find(l => l.en === formInitialData['المحلية'])?.ar || formInitialData['المحلية'] || '';
            const facility = formInitialData['اسم_المؤسسة'] || '';
            subtitle = `الولاية: ${state}، المحلية: ${locality}، المؤسسة: ${facility}`;
        } else {
            subtitle = "الرجاء إدخال تفاصيل المنشأة الجديدة";
        }

        return (
            <GenericFacilityForm
                initialData={formInitialData}
                onSave={handleSave}
                onCancel={handleCancelForm}
                setToast={setToast}
                title={serviceTitle}
                subtitle={subtitle}
                isPublicForm={true}
            >
                {(props) => <FormComponent {...props} />}
            </GenericFacilityForm>
        );
    };

    return (
        <div className="min-h-screen bg-sky-50 p-4 sm:p-6 lg:p-8 flex justify-center">
            <div className="w-full max-w-4xl">
                {step === 'selection' ? renderSelectionScreen() : renderFormScreen()}
            </div>
        </div>
    );
}


// --- REUSABLE FORM SECTION FOR SHARED FIELDS ---

export const SharedFacilityFields = ({ formData, handleChange, handleStateChange, isPublicForm = false, isReadOnly = false }) => {
    return (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormGroup label="Date of Visit / Update">
                <Input type="date" name="date_of_visit" value={formData.date_of_visit || ''} onChange={handleChange} required disabled={isReadOnly} />
            </FormGroup>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <FormGroup label="اسم المؤسسة"><Input name="اسم_المؤسسة" value={formData['اسم_المؤسسة'] || ''} onChange={handleChange} required disabled={isReadOnly} /></FormGroup>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            {/* --- ADDED: Ownership Field --- */}
            <FormGroup label="ملكية المؤسسة">
                <Select name="facility_ownership" value={formData.facility_ownership || ''} onChange={handleChange} disabled={isReadOnly}>
                    <option value="">اختر الملكية</option>
                    <option value="حكومي">حكومي</option>
                    <option value="خاص">خاص</option>
                    <option value="منظمات">منظمات</option>
                    <option value="اهلي">اهلي</option>
                </Select>
            </FormGroup>
            {/* --- END ADD --- */}
        </div>
        <FormGroup label="هل المؤسسة تعمل؟">
            <Select name="هل_المؤسسة_تعمل" value={formData['هل_المؤسسة_تعمل'] || 'Yes'} onChange={handleChange} disabled={isReadOnly}>
                <option value="Yes">نعم</option>
                <option value="No">لا</option>
            </Select>
        </FormGroup>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
                <FormGroup label="هل توجد حوافز للاستاف؟">
                    <Select name="staff_incentives" value={formData.staff_incentives || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select>
                </FormGroup>
                {formData.staff_incentives === 'Yes' && (<FormGroup label="ما هي المنظمة المقدم للحوافز؟" className="mt-4"><Input type="text" name="staff_incentives_organization" value={formData.staff_incentives_organization || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>)}
            </div>
            <div>
                <FormGroup label="هل تشارك المؤسسة في أي مشروع؟">
                    <Select name="project_participation" value={formData.project_participation || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select>
                </FormGroup>
                {formData.project_participation === 'Yes' && (<FormGroup label="ما هو اسم المشروع؟" className="mt-4"><Input type="text" name="project_name" value={formData.project_name || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>)}
            </div>
        </div>
        <FormGroup label="رقم هاتف المسئول من المؤسسة" className="mt-4"><Input type="tel" name="person_in_charge_phone" value={formData.person_in_charge_phone || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
        {!isPublicForm && (
            <>
                <h4 className="font-semibold mt-4 mb-2">الإحداثيات الجغرافية</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormGroup label="خط العرض"><Input type="number" step="any" name="_الإحداثيات_latitude" value={formData['_الإحداثيات_latitude'] || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                    <FormGroup label="خط الطول"><Input type="number" step="any" name="_الإحداثيات_longitude" value={formData['_الإحداثيات_longitude'] || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
                </div>
            </>
        )}
    </>
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
    // --- PROPS FOR APPROVAL MODAL ---
    isReadOnly = false,
    saveButtonText = "حفظ المنشأة",
    cancelButtonText = "إلغاء",
    saveButtonVariant = "primary",
    isSubmitting = false
}, ref) => {
    const [formData, setFormData] = useState(() => {
        let processedData = initialData ? { ...initialData } : {};
        
        if (!initialData) {
            processedData.date_of_visit = new Date().toISOString().split('T')[0];
            const fieldsToDefaultNo = ['وجود_العلاج_المتكامل_لامراض_الطفولة', 'وجود_سجل_علاج_متكامل', 'وجود_كتيب_لوحات', 'ميزان_وزن', 'ميزان_طول', 'ميزان_حرارة', 'ساعة_مؤقت', 'غرفة_إرواء', 'eenc_provides_essential_care', 'eenc_steam_sterilizer', 'eenc_wall_clock', 'etat_has_service', 'hdu_has_service', 'picu_has_service', 'neonatal_kmc_unit', 'neonatal_breastfeeding_unit', 'neonatal_sterilization_unit', 'staff_incentives', 'project_participation', 'immunization_office_exists', 'nutrition_center_exists', 'growth_monitoring_service_exists', 'neonatal_sepsis_surveillance'];
            fieldsToDefaultNo.forEach(field => processedData[field] = processedData[field] || 'No');
            processedData.هل_المؤسسة_تعمل = processedData.هل_المؤسسة_تعمل || 'Yes';
        }

        if (processedData && (processedData.اسم_الكادر_المعالج || processedData.الوصف_الوظيفي) && !processedData.imnci_staff) {
            processedData.imnci_staff = [{ name: processedData.اسم_الكادر_المعالج || '', job_title: processedData.الوصف_الوظيفي || '', is_trained: processedData.هل_تم_التدريب_على_العلاج_المتكامل || 'No', training_date: processedData.تاريخ_التدريب || '', phone: processedData.رقم_الهاتف || '' }];
            delete processedData.اسم_الكادر_المعالج; delete processedData.الوصف_الوظيفي; delete processedData.هل_تم_التدريب_على_العلاج_المتكامل; delete processedData.تاريخ_التدريب; delete processedData.رقم_الهاتف;
        } else if (processedData && !processedData.imnci_staff) {
            processedData.imnci_staff = [];
        }

        if (processedData.neonatal_level_of_care && typeof processedData.neonatal_level_of_care === 'string') {
            const oldValue = processedData.neonatal_level_of_care;
            processedData.neonatal_level_of_care = { primary: oldValue.includes('Primary'), secondary: oldValue.includes('Secondary'), tertiary: oldValue.includes('Tertiary') };
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

        return () => unsubscribe(); // Cleanup subscription on unmount
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

        const processedData = { ...formData };
        ['نوع_المؤسسةالصحية', 'eenc_service_type'].forEach(field => {
            if ([null, undefined, ''].includes(processedData[field])) processedData[field] = 'no data';
        });
        
        let updaterIdentifier;
        const name = submitterName.trim();
        const email = submitterEmail.trim();

        if (name && email) {
            updaterIdentifier = `${name} (${email})`;
        } else if (name) {
            updaterIdentifier = name;
        } else if (email) {
            updaterIdentifier = email;
        } else {
            updaterIdentifier = 'Anonymous Submission';
        }


        try {
            await onSave({ ...processedData, 'اخر تحديث': new Date().toISOString(), 'updated_by': updaterIdentifier });
        } catch (error) {
            console.error("Save Facility Error:", error);
            setToast({ show: true, message: `Failed to save facility: ${error.message}`, type: 'error' });
        }
    };

    const handleStaffChange = (index, event) => {
        const { name, value } = event.target;
        const updatedStaff = formData.imnci_staff.map((staff, i) => i === index ? { ...staff, [name]: value } : staff);
        setFormData(prev => ({ ...prev, imnci_staff: updatedStaff }));
    };

    const handleAddStaffRow = (event) => {
        event.preventDefault();
        setFormData(prev => ({ ...prev, imnci_staff: [...(prev.imnci_staff || []), { name: '', job_title: '', is_trained: 'No', training_date: '', phone: '' }] }));
    };

    const handleRemoveStaffRow = (event, index) => {
        event.preventDefault();
        setFormData(prev => ({ ...prev, imnci_staff: formData.imnci_staff.filter((_, i) => i !== index) }));
    };

    return (
        <div dir="rtl">
            <Card>
                <PageHeader title={isEditing ? `تعديل: ${title}` : `إضافة: ${title}`} subtitle={subtitle || (isEditing ? (formData['اسم_المؤسسة'] || "Update details for this facility") : "أدخل تفاصيل المنشأة الجديدة.")} />
                <div className="p-6">
                    <form onSubmit={handleSubmit} ref={ref}>
                        <SharedFacilityFields 
                            formData={formData} 
                            handleChange={handleChange} 
                            handleStateChange={handleStateChange} 
                            isPublicForm={isPublicForm} 
                            isReadOnly={isReadOnly} 
                        />
                        <hr className="my-6" />
                        {children({ 
                            formData, 
                            handleChange, 
                            handleStateChange, 
                            handleStaffChange, 
                            handleAddStaffRow, 
                            handleRemoveStaffRow, 
                            handleCheckboxGroupChange,
                            isReadOnly // Pass isReadOnly to child components
                        })}
                        
                        {isPublicForm && (
                             <div className="mt-6 pt-6 border-t border-sky-200">
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
                                            <Input 
                                                type="text" 
                                                name="submitterName" 
                                                value={submitterName} 
                                                onChange={(e) => setSubmitterName(e.target.value)} 
                                                disabled={isUserLoggedIn || isReadOnly}
                                            />
                                        </FormGroup>
                                        <FormGroup label="Your Email">
                                            <Input 
                                                type="email" 
                                                name="submitterEmail" 
                                                value={submitterEmail} 
                                                onChange={(e) => setSubmitterEmail(e.target.value)} 
                                                disabled={isUserLoggedIn || isReadOnly}
                                            />
                                        </FormGroup>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 mt-6">
                            <Button type="submit" variant={saveButtonVariant} disabled={isSubmitting}>
                                {isSubmitting ? 'جاري الحفظ...' : saveButtonText}
                            </Button>
                            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
                                {cancelButtonText}
                            </Button>
                        </div>
                    </form>
                </div>
            </Card>
        </div>
    );
});

// --- SERVICE-SPECIFIC FORM FIELDS ---

export const IMNCIFormFields = ({ formData, handleChange, handleStaffChange, handleAddStaffRow, handleRemoveStaffRow, isReadOnly = false }) => (
    <>
        <h3 className="text-xl font-semibold mb-4">تفاصيل خدمة العلاج المتكامل لأمراض الطفولة (IMNCI)</h3>
        <FormGroup label="هل تتوفر خدمة العلاج المتكامل؟"><Select name="وجود_العلاج_المتكامل_لامراض_الطفولة" value={formData['وجود_العلاج_المتكامل_لامراض_الطفولة'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
        <hr className="my-4"/>
        <h4 className="font-semibold mb-2">معلومات الكادر</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <FormGroup label="العدد الكلي للكوادر الطبية العاملة (أطباء ومساعدين)"><Input type="number" name="العدد_الكلي_للكوادر_الطبية_العاملة_أطباء_ومساعدين" value={formData['العدد_الكلي_للكوادر_الطبية_العاملة_أطباء_ومساعدين'] ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
            <FormGroup label="العدد الكلي للكودار المدربة على العلاج المتكامل"><Input type="number" name="العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل" value={formData['العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل'] ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
                <thead className="bg-gray-100"><tr><th className="border p-2 text-right">الاسم</th><th className="border p-2 text-right">الوصف الوظيفي</th><th className="border p-2 text-right">هل مدرب</th><th className="border p-2 text-right">تاريخ اخر تدريب</th><th className="border p-2 text-right">رقم الهاتف</th><th className="border p-2 text-right">إجراء</th></tr></thead>
                <tbody>
                    {(formData.imnci_staff || []).map((staff, index) => (
                        <tr key={index}>
                            <td className="border p-1"><Input name="name" value={staff.name} onChange={(e) => handleStaffChange(index, e)} disabled={isReadOnly} /></td>
                            <td className="border p-1"><Select name="job_title" value={staff.job_title} onChange={(e) => handleStaffChange(index, e)} disabled={isReadOnly}><option value="">اختر</option><option value="طبيب">طبيب</option><option value="مساعد طبي">مساعد طبي</option><option value="ممرض معالج">ممرض معالج</option></Select></td>
                            <td className="border p-1"><Select name="is_trained" value={staff.is_trained} onChange={(e) => handleStaffChange(index, e)} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></td>
                            <td className="border p-1"><Input type="date" name="training_date" value={staff.training_date} onChange={(e) => handleStaffChange(index, e)} disabled={staff.is_trained !== 'Yes' || isReadOnly} /></td>
                            <td className="border p-1"><Input type="tel" name="phone" value={staff.phone} onChange={(e) => handleStaffChange(index, e)} disabled={isReadOnly} /></td>
                            <td className="border p-1 text-center"><Button size="sm" variant="danger" type="button" onClick={(e) => handleRemoveStaffRow(e, index)} disabled={isReadOnly}>حذف</Button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <Button type="button" onClick={(e) => handleAddStaffRow(e)} variant="secondary" className="mt-2" disabled={isReadOnly}>إضافة كادر</Button>
        <hr className="my-4"/>
        <h4 className="font-semibold mt-4 mb-2">الموارد والمعدات المتاحة</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormGroup label="وجود سجل علاج متكامل"><Select name="وجود_سجل_علاج_متكامل" value={formData['وجود_سجل_علاج_متكامل'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
            <FormGroup label="وجود كتيب لوحات"><Select name="وجود_كتيب_لوحات" value={formData['وجود_كتيب_لوحات'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
            <FormGroup label="ميزان وزن"><Select name="ميزان_وزن" value={formData['ميزان_وزن'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
            <FormGroup label="ميزان طول"><Select name="ميزان_طول" value={formData['ميزان_طول'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
            <FormGroup label="ميزان حرارة"><Select name="ميزان_حرارة" value={formData['ميزان_حرارة'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
            <FormGroup label="ساعة مؤقت"><Select name="ساعة_مؤقت" value={formData['ساعة_مؤقت'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
            <FormGroup label="غرفة إرواء"><Select name="غرفة_إرواء" value={formData['غرفة_إرواء'] || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
        </div>
        <hr className="my-4"/>
        <h4 className="font-semibold mt-4 mb-2">الخدمات الاخرى</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
            <div>
                <FormGroup label="هل يوجد مكتب تحصين؟"><Select name="immunization_office_exists" value={formData.immunization_office_exists || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                {formData.immunization_office_exists === 'No' && <FormGroup label="اين يقع اقرب مركز تحصين؟" className="mt-4"><Input type="text" name="nearest_immunization_center" value={formData.nearest_immunization_center || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>}
            </div>
            <div>
                <FormGroup label="هل يوجد مركز تغذية خارجي؟"><Select name="nutrition_center_exists" value={formData.nutrition_center_exists || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
                {formData.nutrition_center_exists === 'No' && <FormGroup label="اين يقع اقرب مركز تغذية خارجي؟" className="mt-4"><Input type="text" name="nearest_nutrition_center" value={formData.nearest_nutrition_center || ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>}
            </div>
            <div><FormGroup label="هل يوجد خدمة متابعة النمو ؟"><Select name="growth_monitoring_service_exists" value={formData.growth_monitoring_service_exists || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup></div>
        </div>
    </>
);

export const EENCFormFields = ({ formData, handleChange, isReadOnly = false }) => (
    <>
        <h3 className="text-xl font-semibold mb-4">تفاصيل خدمة الرعاية الطارئة لحديثي الولادة والأطفال (EENC)</h3>
        <FormGroup label="هل تقدم الرعاية الضرورية المبكرة EENC؟"><Select name="eenc_provides_essential_care" value={formData.eenc_provides_essential_care || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
        <FormGroup label="عدد الكوادر الصحية المدربة"><Input type="number" name="eenc_trained_workers" value={formData.eenc_trained_workers ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
        <hr className="my-4" />
        <h4 className="font-semibold mt-2 mb-2">الموارد والمعدات المتاحة</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormGroup label="العدد الكلي لسرير الولادة"><Input type="number" name="eenc_delivery_beds" value={formData.eenc_delivery_beds ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
            <FormGroup label="العدد الكلي لمحطات الانعاش"><Input type="number" name="eenc_resuscitation_stations" value={formData.eenc_resuscitation_stations ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
            <FormGroup label="العدد الكلي لاجهزة التدفئة"><Input type="number" name="eenc_warmers" value={formData.eenc_warmers ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
            <FormGroup label="العدد الكلي لجهاز الامبوباق"><Input type="number" name="eenc_ambu_bags" value={formData.eenc_ambu_bags ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
            <FormGroup label="العدد الكلي لجهاز الشفط اليدوي"><Input type="number" name="eenc_manual_suction" value={formData.eenc_manual_suction ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>
            <FormGroup label="ساعة حائط"><Select name="eenc_wall_clock" value={formData.eenc_wall_clock || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
            <FormGroup label="جهاز التعقيم بالبخار"><Select name="eenc_steam_sterilizer" value={formData.eenc_steam_sterilizer || 'No'} onChange={handleChange} disabled={isReadOnly}><option value="Yes">نعم</option><option value="No">لا</option></Select></FormGroup>
        </div>
    </>
);

export const NeonatalFormFields = ({ formData, handleChange, handleCheckboxGroupChange, isReadOnly = false }) => (
    <>
        <h3 className="text-xl font-semibold mb-4">تفاصيل وحدة رعاية حديثي الولادة</h3>
        <FormGroup label="مستوى الرعاية">
            <div className="space-y-3">
                <label className="p-3 border rounded-md hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer"><span className="font-medium text-gray-700">أولي (رعاية أساسية لحديثي الولادة)</span><Checkbox name="neonatal_level_of_care" value="primary" label="" checked={!!formData.neonatal_level_of_care?.primary} onChange={handleCheckboxGroupChange} disabled={isReadOnly} /></label>
                <label className="p-3 border rounded-md hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer"><span className="font-medium text-gray-700">ثانوي (وحدة رعاية خاصة لحديثي الولادة)</span><Checkbox name="neonatal_level_of_care" value="secondary" label="" checked={!!formData.neonatal_level_of_care?.secondary} onChange={handleCheckboxGroupChange} disabled={isReadOnly} /></label>
                <label className="p-3 border rounded-md hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer"><span className="font-medium text-gray-700">ثالثوي (وحدة العناية المركزة لحديثي الولادة)</span><Checkbox name="neonatal_level_of_care" value="tertiary" label="" checked={!!formData.neonatal_level_of_care?.tertiary} onChange={handleCheckboxGroupChange} disabled={isReadOnly} /></label>
            </div>
        </FormGroup>
        <hr className="my-4" />
        <h4 className="font-semibold mt-4 mb-2">خدمات ملحقة</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="p-3 border rounded-md hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer">
                <span className="font-medium text-gray-700">وحدة رعاية الكنغر (KMC unit)</span>
                <Checkbox name="neonatal_kmc_unit" label="" checked={formData.neonatal_kmc_unit === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
            </label>
            <label className="p-3 border rounded-md hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer">
                <span className="font-medium text-gray-700">وحدة الرضاعة الطبيعية (breastfeeding unit)</span>
                <Checkbox name="neonatal_breastfeeding_unit" label="" checked={formData.neonatal_breastfeeding_unit === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
            </label>
            <label className="p-3 border rounded-md hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer">
                <span className="font-medium text-gray-700">وحدة تعقيم (sterilization unit)</span>
                <Checkbox name="neonatal_sterilization_unit" label="" checked={formData.neonatal_sterilization_unit === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
            </label>
            <label className="p-3 border rounded-md hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer">
                <span className="font-medium text-gray-700">الترصد والحماية من عدوى التسمم الدموي</span>
                <Checkbox name="neonatal_sepsis_surveillance" label="" checked={formData.neonatal_sepsis_surveillance === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
            </label>
        </div>
        <h4 className="font-semibold mt-4 mb-2">المعدات المتاحة</h4>
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
    </>
);

export const CriticalCareFormFields = ({ formData, handleChange, isReadOnly = false }) => (
    <>
        <h3 className="text-xl font-semibold mb-4">تفاصيل الطوارئ والرعاية الحرجة</h3>
        <div className="space-y-4">
            <div className="p-4 border rounded-md hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">المنشأة تقدم خدمة الفرز والتقييم والعلاج والتوجيه في حالات الطوارئ (ETAT)</span>
                    <Checkbox name="etat_has_service" label="" checked={formData.etat_has_service === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                </div>
                {formData.etat_has_service === 'Yes' && (<FormGroup label="عدد الكوادر المدربة على ETAT" className="mt-4"><Input type="number" name="etat_trained_workers" value={formData.etat_trained_workers ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>)}
            </div>
            <div className="p-4 border rounded-md hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">المنشأة تقدم خدمة وحدة الرعاية عالية الاعتماد (HDU)</span>
                    <Checkbox name="hdu_has_service" label="" checked={formData.hdu_has_service === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                </div>
                {formData.hdu_has_service === 'Yes' && (<FormGroup label="سعة أسرة HDU" className="mt-4"><Input type="number" name="hdu_bed_capacity" value={formData.hdu_bed_capacity ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>)}
            </div>
            <div className="p-4 border rounded-md hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">المنشأة تقدم خدمة وحدة العناية المركزة للأطفال (PICU)</span>
                    <Checkbox name="picu_has_service" label="" checked={formData.picu_has_service === 'Yes'} onChange={handleChange} disabled={isReadOnly} />
                </div>
                {formData.picu_has_service === 'Yes' && (<FormGroup label="سعة أسرة PICU" className="mt-4"><Input type="number" name="picu_bed_capacity" value={formData.picu_bed_capacity ?? ''} onChange={handleChange} disabled={isReadOnly} /></FormGroup>)}
            </div>
        </div>
    </>
);