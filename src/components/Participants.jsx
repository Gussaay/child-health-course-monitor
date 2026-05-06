// src/components/Participants.jsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx'; 
import jsPDF from "jspdf"; 

// --- Icons ---
import { Mail, Lock, RefreshCw, Search, Printer, ArrowLeft, Save } from 'lucide-react'; 

// --- Firebase Imports ---
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

import {
    Card, PageHeader, Button, FormGroup, Input, Select, Textarea, Table, EmptyState, Modal, Spinner, Toast
} from "./CommonComponents";
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_ETAT, JOB_TITLES_EENC, JOB_TITLES_SSNC
} from './constants.js';
import {
    importParticipants,
    bulkMigrateFromMappings,
    getHealthFacilityById,
    queueCertificateEmail,
    saveParticipantAndSubmitFacilityUpdate,
    deleteParticipant
} from '../data.js';
import { useDataCache } from '../DataContext';
import { useAuth } from '../hooks/useAuth'; 
import { DEFAULT_ROLE_PERMISSIONS } from './permissions.js';

// --- Import Certificate Generators ---
import { generateCertificatePdf, generateAllCertificatesPdf, generateBlankCertificatePdf } from './CertificateGenerator';


// ====================================================================
// ===== 1. CUSTOM UI COMPONENTS ======================================
// ====================================================================

const MultiSelectDropdown = ({ options, selected, onChange, label, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    const toggleOption = (option) => {
        if (selected.includes(option)) {
            onChange(selected.filter(item => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    const displayValue = selected.length === 0 
        ? placeholder 
        : selected.length === 1 
            ? selected[0] 
            : `${selected.length} selected`;

    return (
        <div className="relative flex flex-col gap-1" ref={ref}>
            <label className="font-semibold text-gray-700 text-xs uppercase">{label}</label>
            <div 
                className="border border-gray-300 rounded px-3 py-1.5 bg-white text-sm cursor-pointer min-w-[160px] flex justify-between items-center hover:border-blue-400"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate mr-2 text-gray-700">{displayValue}</span>
                <span className="text-gray-500 text-[10px]">▼</span>
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 z-20 mt-1 w-full min-w-[220px] bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {selected.length > 0 && (
                        <div 
                            className="p-2 border-b border-gray-200 cursor-pointer bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-red-600 text-center"
                            onClick={() => { onChange([]); setIsOpen(false); }}
                        >
                            Clear Selection
                        </div>
                    )}
                    {options.length > 0 ? options.map((opt, i) => (
                        <label key={i} className="flex items-center p-2.5 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-50 last:border-none">
                            <input 
                                type="checkbox" 
                                className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                checked={selected.includes(opt)}
                                onChange={() => toggleOption(opt)}
                            />
                            <span className="text-gray-700 select-none truncate" title={opt}>{opt}</span>
                        </label>
                    )) : (
                        <div className="p-3 text-sm text-gray-500 text-center">No options available</div>
                    )}
                </div>
            )}
        </div>
    );
};

// ====================================================================
// ===== 2. MODAL COMPONENTS (Nested) =================================
// ====================================================================

const CertificateLanguageModal = ({ isOpen, onClose, onConfirm, title }) => {
    const [language, setLanguage] = useState('en');
    
    useEffect(() => {
        if (isOpen) setLanguage('en');
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || "Select Certificate Language"}>
            <div className="p-4 space-y-4">
                <FormGroup label="Select Language">
                    <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                        <option value="en">English</option>
                        <option value="ar">Arabic (عربي)</option>
                    </Select>
                </FormGroup>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={() => onConfirm(language)}>Continue</Button>
                </div>
            </div>
        </Modal>
    );
};

const EmailCertificateModal = ({ isOpen, onClose, participants = [], isBulk = false, setToast }) => {
    const [language, setLanguage] = useState('en');
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, errors: 0 });

    useEffect(() => {
        if (isOpen) {
            setLanguage('en');
            setIsSending(false);
            setProgress({ current: 0, total: participants.length, errors: 0 });
        }
    }, [isOpen, participants]);

    const handleSend = async () => {
        setIsSending(true);
        let errorCount = 0;
        const total = participants.length;

        for (let i = 0; i < total; i++) {
            const p = participants[i];
            setProgress({ current: i + 1, total, errors: errorCount });
            
            const downloadLink = `${window.location.origin}/public/certificate/download/${p.id}?lang=${language}`;

            if (p.email) {
                const result = await queueCertificateEmail(p, downloadLink, language);
                if (!result.success) {
                    console.error(`Failed to email ${p.name}: ${result.error}`);
                    errorCount++;
                }
            } else {
                console.warn(`Skipping ${p.name}: No email address.`);
                errorCount++;
            }
        }
        
        setIsSending(false);
        setProgress(prev => ({ ...prev, errors: errorCount }));
        
        if (errorCount === 0) {
            setToast({ show: true, message: `Successfully queued emails for ${total} participants.`, type: 'success' });
            onClose();
        } else if (errorCount < total) {
            setToast({ show: true, message: `Queued emails. ${errorCount} failed (missing email or error).`, type: 'warning' });
        } else {
            setToast({ show: true, message: "Failed to send emails. Check if participants have email addresses.", type: 'error' });
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isBulk ? "Email All Certificates" : "Email Certificate"}>
            <div className="p-4 space-y-4">
                {!isSending && progress.current === 0 ? (
                    <>
                        <p className="text-sm text-gray-600">
                            {isBulk 
                                ? `You are about to send certificate download links to ${participants.length} participants via email.` 
                                : `Send certificate download link to ${participants[0]?.name} via email.`
                            }
                        </p>
                        {isBulk && (
                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs text-yellow-800">
                                <strong>Note:</strong> Only participants with a saved email address will receive the link.
                            </div>
                        )}

                        <FormGroup label="Select Certificate Language">
                            <Select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={isSending}>
                                <option value="en">English</option>
                                <option value="ar">Arabic (عربي)</option>
                            </Select>
                        </FormGroup>
                    </>
                ) : (
                    <div className="text-center py-6">
                        {isSending ? <Spinner size="lg" /> : (progress.errors > 0 ? <div className="text-orange-600 text-xl font-bold">Completed with Issues</div> : <div className="text-green-600 text-xl font-bold">Done!</div>)}
                        <p className="mt-4 text-gray-700">
                            Processing: {progress.current} / {progress.total}
                        </p>
                        {progress.errors > 0 && (
                            <p className="text-red-600 text-sm mt-2">
                                {progress.errors} skipped (missing email or error)
                            </p>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={isSending}>Close</Button>
                    {!isSending && progress.current === 0 && (
                        <Button onClick={handleSend} variant="primary" disabled={isSending}>
                            {isBulk ? "Send All Emails" : "Send Email"}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

const ShareCoursePageModal = ({ isOpen, onClose, courseId, courseName }) => {
    const [link, setLink] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && courseId) {
            setLink(`${window.location.origin}/public/course/certificates/${courseId}`);
            setCopied(false);
        }
    }, [isOpen, courseId]);

    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Public Certificates Page">
            <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">
                    Share this link with participants or stakeholders. They will be able to view the list of all participants in the <strong>{courseName}</strong> course and download certificates individually.
                </p>
                
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Public Page Link</label>
                    <div className="flex gap-2">
                        <Input readOnly value={link} className="bg-gray-50 text-sm text-gray-600" />
                        <Button onClick={handleCopy} variant={copied ? "success" : "primary"}>
                            {copied ? "Copied!" : "Copy Link"}
                        </Button>
                    </div>
                </div>

                <div className="flex justify-end mt-4 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

const ShareCertificateModal = ({ isOpen, onClose, participantName, participantId }) => {
    const [language, setLanguage] = useState('en');
    const [generatedLink, setGeneratedLink] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && participantId) {
            setLanguage('en'); 
            setCopied(false);
            const link = `${window.location.origin}/public/certificate/download/${participantId}?lang=en`;
            setGeneratedLink(link);
        }
    }, [isOpen, participantId]);

    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
        const link = `${window.location.origin}/public/certificate/download/${participantId}?lang=${newLang}`;
        setGeneratedLink(link);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Certificate Link">
            <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">
                    Generate a direct download link for <strong>{participantName}</strong>. 
                </p>

                <FormGroup label="Select Certificate Language">
                    <Select value={language} onChange={handleLanguageChange}>
                        <option value="en">English</option>
                        <option value="ar">Arabic (عربي)</option>
                    </Select>
                </FormGroup>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Direct Download Link</label>
                    <div className="flex gap-2">
                        <Input readOnly value={generatedLink} className="bg-gray-50 text-sm" />
                        <Button onClick={handleCopy} variant={copied ? "success" : "primary"}>
                            {copied ? "Copied!" : "Copy Link"}
                        </Button>
                    </div>
                </div>

                <div className="flex justify-end mt-4 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

const SearchableSelect = ({ options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const selectedOption = options.find(opt => opt.id === value);
        setInputValue(selectedOption ? selectedOption.name : '');
    }, [value, options]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
                const selectedOption = options.find(opt => opt.id === value);
                setInputValue(selectedOption ? selectedOption.name : '');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref, value, options]);

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        const selectedOption = options.find(opt => opt.id === value);
        if (selectedOption && selectedOption.name === inputValue) {
            return options;
        }

        return options.filter(opt => opt.name.toLowerCase().includes(inputValue.toLowerCase()));
    }, [options, inputValue, value]);

    const handleSelect = (option) => {
        onChange(option.id);
        setInputValue(option.name);
        setIsOpen(false);
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

const NewParticipantForm = ({ initialName, jobTitleOptions, onCancel, onSave, isSaving }) => {
    const [name, setName] = useState(initialName || '');
    const [phone, setPhone] = useState('');

    const [job, setJob] = useState('');
    const [otherJobTitle, setOtherJobTitle] = useState('');
    const [error, setError] = useState('');

    const handleSave = () => {
        const finalJobTitle = job === 'Other' ? otherJobTitle : job;
        if (!name || !finalJobTitle || !phone) {
            setError("Please fill in all fields.");
            return;
        }
        setError('');
        onSave({
            name,
            job_title: finalJobTitle,
            phone,
        });
    };

    return (
        <Modal isOpen={true} onClose={isSaving ? null : onCancel} title="Add New Participant Details">
            <Card>
                <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">This person was not found in the facility's staff list. Please provide their details.</p>
                    {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                    <div className="space-y-4 pt-6">
                        <FormGroup label="Participant Name">
                            <Input disabled={isSaving} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" />
                        </FormGroup>
                        <FormGroup label="Job Title">
                            <Select disabled={isSaving} value={job} onChange={(e) => setJob(e.target.value)}>
                                <option value="">— Select Job —</option>
                                {jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                <option value="Other">Other</option>
                            </Select>
                        </FormGroup>
                        {job === 'Other' && (
                            <FormGroup label="Specify Job Title">
                                <Input disabled={isSaving} value={otherJobTitle} onChange={(e) => setOtherJobTitle(e.target.value)} placeholder="Please specify" />
                            </FormGroup>
                        )}
                        <FormGroup label="Phone Number">
                            <Input disabled={isSaving} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number" />
                        </FormGroup>
                    </div>
                    <div className="flex gap-2 justify-end mt-6 border-t pt-6">
                        <Button variant="secondary" onClick={onCancel} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Spinner size="sm" /> : 'Continue'}
                        </Button>
                    </div>
                </div>
            </Card>
        </Modal>
    );
};

const ParticipantDataCleanupModal = ({ isOpen, onClose, participants, onSave, courseType, setToast }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedFieldKey, setSelectedFieldKey] = useState('');
    const [nonStandardValues, setNonStandardValues] = useState([]);
    const [mappings, setMappings] = useState({});

    const jobTitleOptions = useMemo(() => {
        if (courseType === 'ETAT') return JOB_TITLES_ETAT;
        if (courseType === 'EENC') return JOB_TITLES_EENC;
        if (courseType === 'SSNC' || courseType === 'Small & Sick Newborn') return JOB_TITLES_SSNC;
        return ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
    }, [courseType]);

    const CLEANABLE_FIELDS_CONFIG = useMemo(() => {
        const config = {
            'state': {
                label: 'State',
                standardValues: Object.keys(STATE_LOCALITIES).sort(),
                getOptionLabel: (opt) => STATE_LOCALITIES[opt]?.ar || opt
            },
            'locality': {
                label: 'Locality',
                standardValues: Object.values(STATE_LOCALITIES).flatMap(s => s.localities.map(l => l.en)).sort(),
                getOptionLabel: (opt) => {
                    for (const stateKey in STATE_LOCALITIES) {
                        const locality = STATE_LOCALITIES[stateKey].localities.find(l => l.en === opt);
                        if (locality) return `${locality.ar} (${STATE_LOCALITIES[stateKey].ar})`;
                    }
                    return opt;
                }
            },
            'job_title': {
                label: 'Job Title',
                standardValues: jobTitleOptions,
                getOptionLabel: (opt) => opt
            },
            'group': {
                label: 'Group',
                standardValues: ['Group A', 'Group B', 'Group C', 'Group D'],
                getOptionLabel: (opt) => opt
            },
        };

        if (courseType === 'IMNCI' || courseType === 'ICCM') {
            config['imci_sub_type'] = {
                label: 'IMCI Sub-type',
                standardValues: IMNCI_SUBCOURSE_TYPES,
                getOptionLabel: (opt) => opt
            };
            config['facility_type'] = {
                label: 'Facility Type',
                standardValues: ["مركز صحة الاسرة", "مستشفى ريفي", "وحدة صحة الاسرة", "مستشفى"],
                getOptionLabel: (opt) => opt
            };
        }

        if (courseType === 'ETAT') {
            config['hospital_type'] = {
                label: 'Hospital Type (ETAT)',
                standardValues: ['Pediatric Hospital', 'Pediatric Department in General Hospital', 'Rural Hospital', 'other'],
                getOptionLabel: (opt) => opt
            };
        }

        if (courseType === 'EENC' || courseType === 'SSNC' || courseType === 'Small & Sick Newborn') {
            config['hospital_type'] = {
                label: `Hospital Type (${courseType})`,
                standardValues: ['Comprehensive EmONC', 'Basic EmONC', 'other'],
                getOptionLabel: (opt) => opt
            };
        }

        return config;
    }, [jobTitleOptions, courseType]);

    useEffect(() => {
        if (!isOpen) setSelectedFieldKey('');
        setNonStandardValues([]);
        setMappings({});
    }, [isOpen]);

    useEffect(() => {
        if (selectedFieldKey) {
            setIsLoading(true);
            const config = CLEANABLE_FIELDS_CONFIG[selectedFieldKey];
            const standardValuesSet = new Set(config.standardValues);
            const values = new Set();

            (participants || []).forEach(p => {
                const value = p[selectedFieldKey];
                if (value) {
                    if (!standardValuesSet.has(value)) {
                        values.add(value);
                    }
                }
            });

            setNonStandardValues(Array.from(values).sort());
            setMappings({});
            setIsLoading(false);
        }
    }, [selectedFieldKey, participants, CLEANABLE_FIELDS_CONFIG]);

    const handleMappingChange = (oldValue, newValue) => {
        setMappings(prev => ({ ...prev, [oldValue]: newValue }));
    };

    const handleApplyFixes = async () => {
        if (Object.keys(mappings).length === 0) {
            onClose();
            return;
        }
        setIsUpdating(true);

        const participantsToUpdate = participants
            .filter(p => {
                const originalValue = p[selectedFieldKey];
                return originalValue !== null && originalValue !== undefined && Object.keys(mappings).includes(String(originalValue));
            })
            .map(p => ({
                ...p,
                id: p.id,
                [selectedFieldKey]: mappings[String(p[selectedFieldKey])]
            }));

        const facilitiesToUpsert = [];
        if (courseType === 'IMNCI') {
            const facilityUpdatesMap = new Map();
            participantsToUpdate.forEach(p => {
                const facilityKey = p.facilityId || `${p.state}-${p.locality}-${p.center_name}`;
                const existingPayload = facilityUpdatesMap.get(facilityKey) || {
                    id: p.facilityId || undefined,
                    'اسم_المؤسسة': p.center_name,
                    'الولاية': p.state,
                    'المحلية': p.locality,
                    imnci_staff: []
                };

                if (selectedFieldKey === 'facility_type') {
                    existingPayload['نوع_المؤسسةالصحية'] = p.facility_type;
                }

                if (!existingPayload.imnci_staff.some(s => s.name === p.name)) {
                    existingPayload.imnci_staff.push({
                        name: p.name,
                        job_title: p.job_title,
                        is_trained: p.trained_before ? 'Yes' : 'No',
                        training_date: p.last_imci_training || '',
                        phone: p.phone || ''
                    });
                }
                facilityUpdatesMap.set(facilityKey, existingPayload);
            });
            facilitiesToUpsert.push(...Array.from(facilityUpdatesMap.values()));
        }

        try {
            await onSave(participantsToUpdate, facilitiesToUpsert);
            setToast({ show: true, message: 'Data cleaned successfully!', type: 'success' });
            onClose();
        } catch (error) {
            console.error("Failed to update participants:", error);
            setToast({ show: true, message: `Failed to clean data: ${error.message}`, type: 'error' });
        } finally {
            setIsUpdating(false);
        }
    };

    const renderSelectionScreen = () => (
        <div>
            <p className="text-sm text-gray-600 mb-4">
                This tool helps standardize data for all participants in the current course. Select a field to find and correct non-standard entries.
            </p>
            <FormGroup label="Select a data field to clean">
                <Select value={selectedFieldKey} onChange={(e) => setSelectedFieldKey(e.target.value)} disabled={isUpdating}>
                    <option value="">-- Choose field --</option>
                    {Object.entries(CLEANABLE_FIELDS_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </Select>
            </FormGroup>
        </div>
    );

    const renderMappingScreen = () => {
        const config = CLEANABLE_FIELDS_CONFIG[selectedFieldKey];
        return (
            <div>
                {isLoading && <div className="text-center"><Spinner /></div>}
                {!isLoading && nonStandardValues.length === 0 && (
                    <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-md">
                        {`All values for "${config.label}" are already standardized for this course.`}
                    </div>
                )}
                {!isLoading && nonStandardValues.length > 0 && (
                    <div>
                        <p className="mb-4 text-sm text-gray-700">
                            Found <strong>{nonStandardValues.length}</strong> non-standard value(s) for <strong>{config.label}</strong>. Map them to a standard value to clean up your data.
                        </p>
                        <div className="space-y-3 max-h-80 overflow-y-auto p-2 border rounded bg-gray-50">
                            {nonStandardValues.map(value => (
                                <div key={String(value)} className="grid grid-cols-1 md:grid-cols-2 items-center gap-2 p-2 bg-white rounded border">
                                    <span className="bg-yellow-50 text-yellow-800 p-2 rounded text-sm truncate" title={String(value)}>
                                        Current: "{String(value)}"
                                    </span>
                                    <Select disabled={isUpdating} value={mappings[String(value)] || ''} onChange={(e) => handleMappingChange(String(value), e.target.value)}>
                                        <option value="">-- Map to standard value --</option>
                                        {config.standardValues.map(opt => <option key={opt} value={opt}>{config.getOptionLabel ? config.getOptionLabel(opt) : opt}</option>)}
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center mt-6">
                    <Button variant="secondary" onClick={() => setSelectedFieldKey('')} disabled={isUpdating}>Back to Selection</Button>
                    <Button onClick={handleApplyFixes} disabled={isUpdating || nonStandardValues.length === 0}>
                        {isUpdating ? <Spinner size="sm"/> : `Apply Fixes for ${Object.keys(mappings).length} Value(s)`}
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={isUpdating ? null : onClose} title="Clean Participant Data">
            <div className="p-4">
                {!selectedFieldKey ? renderSelectionScreen() : renderMappingScreen()}
            </div>
        </Modal>
    );
};

const BulkChangeModal = ({ isOpen, onClose, participants, onSave, courseType, setToast }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedFieldKey, setSelectedFieldKey] = useState('');
    const [fromValue, setFromValue] = useState('');
    const [toValue, setToValue] = useState('');

    const jobTitleOptions = useMemo(() => {
        if (courseType === 'ETAT') return JOB_TITLES_ETAT;
        if (courseType === 'EENC') return JOB_TITLES_EENC;
        if (courseType === 'SSNC' || courseType === 'Small & Sick Newborn') return JOB_TITLES_SSNC;
        return ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
    }, [courseType]);

    const CHANGEABLE_FIELDS_CONFIG = useMemo(() => ({
        'job_title': {
            label: 'Job Title',
            options: jobTitleOptions,
        },
        'group': {
            label: 'Group',
            options: ['Group A', 'Group B', 'Group C', 'Group D'],
        },
    }), [jobTitleOptions]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedFieldKey('');
            setFromValue('');
            setToValue('');
        }
    }, [isOpen]);

    const handleApplyChange = async () => {
        if (!selectedFieldKey || !fromValue || !toValue || fromValue === toValue) {
            return;
        }

        setIsUpdating(true);
        const affectedParticipants = participants.filter(p => p[selectedFieldKey] === fromValue);
        
        const participantsToUpdate = affectedParticipants.map(p => ({
            ...p,
            id: p.id,
            [selectedFieldKey]: toValue,
        }));

        const facilitiesToUpsert = [];
        if (courseType === 'IMNCI') {
            const facilityUpdatesMap = new Map();
            participantsToUpdate.forEach(p => {
                const facilityKey = p.facilityId || `${p.state}-${p.locality}-${p.center_name}`;
                const existingPayload = facilityUpdatesMap.get(facilityKey) || {
                    id: p.facilityId || undefined,
                    'اسم_المؤسسة': p.center_name,
                    'الولاية': p.state,
                    'المحلية': p.locality,
                    imnci_staff: []
                };

                if (!existingPayload.imnci_staff.some(s => s.name === p.name)) {
                    existingPayload.imnci_staff.push({
                        name: p.name,
                        job_title: p.job_title, 
                        is_trained: p.trained_before ? 'Yes' : 'No',
                        training_date: p.last_imci_training || '',
                        phone: p.phone || ''
                    });
                }
                facilityUpdatesMap.set(facilityKey, existingPayload);
            });
            facilitiesToUpsert.push(...Array.from(facilityUpdatesMap.values()));
        }

        try {
            if (participantsToUpdate.length > 0) {
                await onSave(participantsToUpdate, facilitiesToUpsert);
                setToast({ show: true, message: `Successfully updated ${participantsToUpdate.length} participants!`, type: 'success' });
            }
            onClose();
        } catch (error) {
            console.error("Failed to bulk update participants:", error);
            setToast({ show: true, message: `Update failed: ${error.message}`, type: 'error' });
        } finally {
            setIsUpdating(false);
        }
    };

    const currentConfig = CHANGEABLE_FIELDS_CONFIG[selectedFieldKey];
    const affectedParticipantsCount = useMemo(() => {
        if (!selectedFieldKey || !fromValue) return 0;
        return participants.filter(p => p[selectedFieldKey] === fromValue).length;
    }, [participants, selectedFieldKey, fromValue]);

    return (
        <Modal isOpen={isOpen} onClose={isUpdating ? null : onClose} title="Bulk Change Participant Data">
            <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">
                    This tool allows you to change a value for a specific field across all participants in this course.
                </p>
                <FormGroup label="Select a field to change">
                    <Select disabled={isUpdating} value={selectedFieldKey} onChange={(e) => {
                        setSelectedFieldKey(e.target.value);
                        setFromValue('');
                        setToValue('');
                    }}>
                        <option value="">-- Choose field --</option>
                        {Object.entries(CHANGEABLE_FIELDS_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                        ))}
                    </Select>
                </FormGroup>

                {currentConfig && (
                    <>
                        <FormGroup label={`Change from value:`}>
                            <Select disabled={isUpdating} value={fromValue} onChange={(e) => setFromValue(e.target.value)}>
                                <option value="">-- Select original value --</option>
                                {currentConfig.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label={`Change to value:`}>
                            <Select disabled={isUpdating} value={toValue} onChange={(e) => setToValue(e.target.value)}>
                                <option value="">-- Select new value --</option>
                                {currentConfig.options.filter(opt => opt !== fromValue).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </Select>
                        </FormGroup>
                    </>
                )}

                {affectedParticipantsCount > 0 && toValue && (
                     <div className="p-3 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-md">
                        This will change the <strong>{currentConfig.label}</strong> from "<strong>{fromValue}</strong>" to "<strong>{toValue}</strong>" for <strong>{affectedParticipantsCount}</strong> participant(s).
                    </div>
                )}

                <div className="flex justify-end items-center mt-6 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose} className="mr-2" disabled={isUpdating}>Cancel</Button>
                    <Button
                        onClick={handleApplyChange}
                        disabled={isUpdating || !selectedFieldKey || !fromValue || !toValue || fromValue === toValue || affectedParticipantsCount === 0}
                    >
                        {isUpdating ? <Spinner size="sm"/> : `Apply Change`}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const ExcelImportModal = ({ isOpen, onClose, onImport, course, participants, setToast }) => {
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const [isValidating, setIsValidating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [userCorrections, setUserCorrections] = useState({});

    const jobTitleOptions = useMemo(() => {
        if (course.course_type === 'ETAT') return JOB_TITLES_ETAT;
        if (course.course_type === 'EENC') return JOB_TITLES_EENC;
        if (course.course_type === 'SSNC' || course.course_type === 'Small & Sick Newborn') return JOB_TITLES_SSNC;
        return ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
    }, [course.course_type]);

    useEffect(() => {
        if (isOpen) {
            setCurrentPage(0);
            setError('');
            setExcelData([]);
            setHeaders([]);
            setFieldMappings({});
            setValidationIssues([]);
            setUserCorrections({});
            setIsValidating(false);
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }, [isOpen]);

    const allFields = useMemo(() => [
        { key: 'id', label: 'ID (for updates)' },
        { key: 'name', label: 'Name', required: true },
        { key: 'group', label: 'Group' },
        { key: 'email', label: 'Email' },
        { key: 'state', label: 'State', required: true },
        { key: 'locality', label: 'Locality', required: true },
        { key: 'center_name', label: course.course_type === 'ICCM' ? 'Village Name' : (course.course_type === 'Program Management' ? 'Department' : 'Health Facility Name'), required: true },
        { key: 'job_title', label: 'Job Title', required: true },
        { key: 'phone', label: 'Phone Number' },
        { key: 'pre_test_score', label: 'Pre-Test Score' },
        { key: 'post_test_score', label: 'Post-Test Score' },
        ...(course.course_type === 'IMNCI' ? [
            { key: 'imci_sub_type', label: 'IMCI Course Sub-type' },
            { key: 'facility_type', label: 'Facility Type' },
            { key: 'trained_before', label: 'Previously trained in IMCI?' },
            { key: 'last_imci_training', label: 'Date of last training' },
            { key: 'num_other_providers', label: 'Number of other providers' },
            { key: 'num_other_providers_imci', label: 'Number of providers trained in IMCI' },
            { key: 'has_nutrition_service', label: 'Has therapeutic nutrition service?' },
            { key: 'nearest_nutrition_center', label: 'Nearest therapeutic nutrition center?' },
            { key: 'has_immunization_service', label: 'Has immunization service?' },
            { key: 'nearest_immunization_center', label: 'Nearest immunization center?' },
            { key: 'has_ors_room', label: 'Has ORS corner service?' },
            { key: 'has_growth_monitoring', label: 'Has Growth Monitoring Service?' }
        ] : []),
        ...(course.course_type === 'ICCM' ? [
            { key: 'trained_before', label: 'Previously trained in IMNCI/ICCM?' },
            { key: 'last_imci_training', label: 'Date of last training' },
            { key: 'nearest_health_facility', label: 'Nearest Health Facility' },
            { key: 'hours_to_facility', label: 'Hours to Facility (on foot)' },
        ] : []),
        ...(course.course_type === 'ETAT' ? [ { key: 'hospital_type', label: 'Hospital Type' }, { key: 'trained_etat_before', label: 'Previously trained on ETAT?' }, ] : []),
        ...(course.course_type === 'EENC' || course.course_type === 'SSNC' || course.course_type === 'Small & Sick Newborn' ? [ { key: 'hospital_type', label: 'Hospital Type' }, { key: 'trained_eenc_before', label: `Previously trained on ${course.course_type}?` }, ] : [])
    ], [course.course_type]);

    const handleDownloadTemplate = () => {
        const templateData = participants.map(p => {
            const row = {};
            allFields.forEach(field => {
                row[field.label] = p[field.key] || '';
            });
            return row;
        });

        const headerLabels = allFields.map(f => f.label);
        const worksheet = XLSX.utils.json_to_sheet(templateData, { header: headerLabels });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Participants");
        XLSX.writeFile(workbook, `Participant_Template_${course.course_type}.xlsx`);
    };

    const findBestMatch = (value, options) => {
        if (!value || !options || options.length === 0) return { match: null, isPerfect: false };
        const cleanValue = String(value).trim().toLowerCase();
        for (const option of options) {
            if (String(option).trim().toLowerCase() === cleanValue) return { match: option, isPerfect: true };
        }
        for (const option of options) {
            if (String(option).toLowerCase().includes(cleanValue) || cleanValue.includes(String(option).toLowerCase())) return { match: option, isPerfect: false };
        }
        return { match: null, isPerfect: false };
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                if (jsonData.length < 1) { setError('Excel file appears to be empty.'); return; }
                setHeaders(jsonData[0].map(h => String(h).trim()));
                setExcelData(jsonData.slice(1));
                setCurrentPage(1);
                setError('');
            } catch (err) { setError('Error reading Excel file: ' + err.message); }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleMappingChange = useCallback((appField, excelHeader) => {
        setFieldMappings(prev => ({ ...prev, [appField]: excelHeader }));
    }, []);

    const handleValidate = async () => {
        const requiredFields = allFields.filter(f => f.required).map(f => f.key);
        for (const field of requiredFields) {
            if (!fieldMappings[field]) {
                setError(`The required field "${field.label}" must be mapped.`);
                return;
            }
        }
        setError('');
        setIsValidating(true);

        const validationConfig = {
            state: { options: Object.keys(STATE_LOCALITIES) },
            job_title: { options: jobTitleOptions },
        };
        if (course.course_type === 'IMNCI') {
            validationConfig.imci_sub_type = { options: IMNCI_SUBCOURSE_TYPES };
        }

        const issues = {};

        excelData.forEach(row => {
            Object.entries(validationConfig).forEach(([fieldKey, config]) => {
                const header = fieldMappings[fieldKey];
                if (!header) return;
                const cellValue = row[headers.indexOf(header)];
                if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                    const result = findBestMatch(cellValue, config.options);
                    if (!result.isPerfect) {
                        if (!issues[fieldKey]) issues[fieldKey] = { columnName: header, options: config.options, invalidValues: new Set() };
                        issues[fieldKey].invalidValues.add(String(cellValue).trim());
                    }
                }
            });
        });

        const issuesArray = Object.entries(issues).map(([key, issue]) => ({ ...issue, key, invalidValues: Array.from(issue.invalidValues).sort() }));
        if (issuesArray.length > 0) {
            const initialCorrections = {};
            issuesArray.forEach(issue => {
                issue.invalidValues.forEach(val => {
                    const bestMatch = findBestMatch(val, issue.options);
                    if (bestMatch.match) initialCorrections[val] = bestMatch.match;
                });
            });
            setUserCorrections(initialCorrections);
        }
        setValidationIssues(issuesArray);
        setIsValidating(false);
        setCurrentPage(2);
    };

    const handleCorrectionChange = (invalidValue, correctedValue) => {
        setUserCorrections(prev => ({ ...prev, [invalidValue]: correctedValue }));
    };

    const startImportProcess = async () => {
        setIsImporting(true);
        const participantsToImport = [];
        const facilityUpdatesMap = new Map();

        excelData.forEach(row => {
            const participant = {};
            allFields.forEach(field => {
                const excelHeader = fieldMappings[field.key];
                if (excelHeader) {
                    const cellValue = row[headers.indexOf(excelHeader)];
                    if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                        participant[field.key] = userCorrections[String(cellValue).trim()] ?? cellValue;
                    }
                }
            });

            const centerNameLabel = course.course_type === 'ICCM' ? 'Village Name' : (course.course_type === 'Program Management' ? 'Department' : 'Health Facility Name');
            if (!participant.name || !participant.state || !participant.locality || !participant.center_name) {
                const missing = [];
                if (!participant.name) missing.push("Name");
                if (!participant.state) missing.push("State");
                if (!participant.locality) missing.push("Locality");
                if (!participant.center_name) missing.push(centerNameLabel);
                
                console.warn(`Skipping row due to missing required fields: ${missing.join(', ')}`, row);
                return;
            }

            if (course.course_type === 'ICCM') {
                 participant.imci_sub_type = 'ICCM Community Module';
            }
            
            if (course.course_type === 'Program Management') {
                 participant.department = participant.center_name;
                 participant.center_name = 'N/A';
            }

            participantsToImport.push(participant);

            if (course.course_type === 'ICCM' || course.course_type === 'Program Management') {
                return;
            }

            const facilityKey = `${participant.state}-${participant.locality}-${participant.center_name}`;
            const existingPayload = facilityUpdatesMap.get(facilityKey) || {};

            const newStaffMember = {
                name: participant.name,
                job_title: participant.job_title,
                is_trained: 'Yes',
                training_date: course.start_date || '',
                phone: participant.phone || '',
            };

            const staffList = existingPayload.imnci_staff || [];
            if (!staffList.some(s => s.name === newStaffMember.name)) {
                staffList.push(newStaffMember);
            }

            const payload = {
                ...existingPayload,
                'اسم_المؤسسة': participant.center_name,
                'الولاية': participant.state,
                'المحلية': participant.locality,
                'هل_المؤسسة_تعمل': 'Yes',
                date_of_visit: new Date().toISOString().split('T')[0],
                imnci_staff: staffList,
                'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes', 
                'وجود_كتيب_لوحات': 'Yes',
                'وجود_سجل_علاج_متكامل': 'Yes',
                'نوع_المؤسسةالصحية': participant.facility_type,
                'nutrition_center_exists': participant.has_nutrition_service ? 'Yes' : 'No',
                'nearest_nutrition_center': participant.nearest_nutrition_center || '',
                'immunization_office_exists': participant.has_immunization_service ? 'Yes' : 'No',
                'nearest_immunization_center': participant.nearest_immunization_center || '',
                'غرفة_إرواء': participant.has_ors_room ? 'Yes' : 'No',
                'growth_monitoring_service_exists': participant.has_growth_monitoring ? 'Yes' : 'No',
                'العدد_الكلي_لكوادر_طبية_العاملة_أطباء_ومساعدين': participant.num_other_providers ?? staffList.length, 
                'العدد_Kلي_للكودار_ المدربة_على_العلاج_المتكامل': participant.num_other_providers_imci ?? staffList.filter(s => s.is_trained === 'Yes').length, 
            };

            facilityUpdatesMap.set(facilityKey, payload);
        });

        const facilitiesToUpsert = Array.from(facilityUpdatesMap.values());

        try {
            await onImport({ participantsToImport, facilitiesToUpsert });
            setToast({ show: true, message: `Successfully imported ${participantsToImport.length} records.`, type: 'success' });
            onClose();
        } catch (error) {
            setError(error.message || 'An error occurred during import.');
            setToast({ show: true, message: `Import failed: ${error.message}`, type: 'error' });
        } finally {
            setIsImporting(false);
        }
    };

    const renderValidationScreen = () => {
        const allCorrectionsMade = validationIssues.every(issue => issue.invalidValues.every(val => userCorrections[val]));
        return (
            <div>
                <h3 className="text-lg font-semibold mb-2">Review & Confirm Import</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Found <strong>{excelData.length}</strong> participants to import.
                    {course.course_type === 'IMNCI' && " This will create or update facility records accordingly."}
                </p>
                {validationIssues.length > 0 && (
                    <div className="mb-4">
                        <h4 className="font-semibold text-gray-800 mb-2">Data Mismatches Found</h4>
                        <div className="space-y-3 max-h-60 overflow-y-auto p-2 border rounded bg-gray-50">
                            {validationIssues.map(issue => (
                                <div key={issue.key}>
                                    <h5 className="font-semibold text-sm text-gray-700">Mismatches for Column: <span className="font-bold">"{issue.columnName}"</span></h5>
                                    {issue.invalidValues.map(val => (
                                        <div key={val} className="grid grid-cols-1 md:grid-cols-2 items-center gap-2 mt-1 p-2 bg-white rounded border">
                                            <span className="bg-red-50 text-red-800 p-1 rounded text-xs truncate" title={val}>Your value: "{val}"</span>
                                            <Select disabled={isImporting} value={userCorrections[val] || ''} onChange={(e) => handleCorrectionChange(val, e.target.value)}>
                                                <option value="">-- Choose correct option --</option>
                                                {issue.options.map(opt => <option key={opt} value={opt}>{STATE_LOCALITIES[opt]?.ar || opt}</option>)}
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                         {!allCorrectionsMade && <p className="text-right text-sm text-red-600 mt-1">Please resolve all mismatches to proceed.</p>}
                    </div>
                )}

                <div className="flex justify-end mt-6 space-x-2">
                    <Button variant="secondary" onClick={() => setCurrentPage(1)} disabled={isImporting}>Back to Mapping</Button>
                    <Button onClick={startImportProcess} disabled={!allCorrectionsMade || isImporting}>
                        {isImporting ? <Spinner size="sm" /> : 'Apply Corrections & Import'}
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={isImporting ? null : onClose} title="Import Participants from Excel">
            <div className="p-4">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

                {currentPage === 0 && (
                    <div>
                        <p className="mb-4">
                            Download an Excel template to get started, or upload your own file. The template will include existing participant data for easy editing.
                        </p>
                        <Button variant="secondary" onClick={handleDownloadTemplate} className="mb-4">
                            Download Template
                        </Button>
                        <hr className="my-4"/>
                        <p className="mb-2">
                            Upload your Excel file (first row must be headers).
                        </p>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            ref={fileInputRef}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                )}

                {currentPage === 1 && (
                    <div>
                        <h4 className="font-medium mb-4">Map Excel columns to application fields</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 max-h-80 overflow-y-auto p-2 border rounded">
                            {allFields.map(field => (
                                <div key={field.key} className="flex items-center">
                                    <label className="w-1/2 font-medium text-sm capitalize">{field.label}{field.required && '*'}</label>
                                    <Select value={fieldMappings[field.key] || ''} onChange={(e) => handleMappingChange(field.key, e.target.value)} className="flex-1">
                                        <option value="">-- Select Excel Column --</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </Select>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end mt-6 space-x-2">
                            <Button variant="secondary" onClick={() => setCurrentPage(0)}>Back</Button>
                            <Button onClick={handleValidate} disabled={isValidating}>
                                {isValidating ? <Spinner/> : 'Validate & Review'}
                            </Button>
                        </div>
                    </div>
                )}
                {currentPage === 2 && renderValidationScreen()}
            </div>
        </Modal>
    );
};

const CreatableNameInput = ({ value, onChange, options, onSelect, disabled }) => {
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
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        return options.filter(opt => opt.name && opt.name.toLowerCase().includes(inputValue.toLowerCase()));
    }, [options, inputValue]);

    const handleSelect = (option) => {
        onSelect(option);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={ref}>
            <Input
                type="text"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    onChange(e.target.value);
                }}
                onFocus={() => setIsOpen(true)}
                disabled={disabled}
                placeholder={disabled ? "Select a facility first" : "Type to search or add new"}
            />
            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div
                        className="p-2 cursor-pointer hover:bg-gray-100 font-semibold text-blue-600"
                        onClick={() => handleSelect(null)} 
                    >
                        -- Add as New Participant --
                    </div>
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, index) => (
                            <div
                                key={index} 
                                className="p-2 cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSelect(opt)}
                            >
                                {opt.name} ({opt.job_title || 'No Job Title'})
                            </div>
                        ))
                    ) : (
                        inputValue && <div className="p-2 text-gray-500">No existing staff found matching "{inputValue}".</div>
                    )}
                </div>
            )}
        </div>
    );
};

const FacilitySearchModal = ({ isOpen, onClose, facilities, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
            }, 100);
        }
    }, [isOpen]);

    const filteredFacilities = useMemo(() => {
        if (!facilities) return [];
        return facilities.filter(f => 
            f['اسم_المؤسسة'] && f['اسم_المؤسسة'].toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [facilities, searchTerm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Health Facility">
            <div className="p-4 h-[60vh] flex flex-col">
                <div className="mb-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                            ref={inputRef}
                            type="text"
                            placeholder="Type to search facilities..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10"
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto border rounded-md bg-gray-50">
                    {filteredFacilities.length > 0 ? (
                        filteredFacilities.map(facility => (
                            <div
                                key={facility.id}
                                className="p-3 border-b bg-white cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => {
                                    onSelect(facility);
                                    onClose();
                                }}
                            >
                                <div className="font-medium text-gray-800">{facility['اسم_المؤسسة']}</div>
                            </div>
                        ))
                    ) : (
                        <div className="p-4 text-center text-gray-500">
                            No facilities match "{searchTerm}".
                        </div>
                    )}
                </div>
                
                <div className="mt-4 flex justify-end">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </Modal>
    );
};

// ====================================================================
// ===== 3. EXPORTED COMPONENTS (Top Level) ===========================
// ====================================================================

// --- Participant Master Manager Component ---
export function ParticipantsView({
    course, participants, onOpen, onOpenReport, onBatchUpdate, onOpenTestFormForParticipant, 
    isCourseActive, canAddParticipant, canAddMonitoring,
    canEditDeleteParticipantActiveCourse, canEditDeleteParticipantInactiveCourse,
    // Note: We keep these as props but the actual decision comes from the DB directly now
    canImportParticipants, canCleanParticipantData, canBulkChangeParticipants, canBulkMigrateParticipants,
    canManageCertificates, canUseSuperUserAdvancedFeatures
}) {
    const { user } = useAuth();
    const currentUserIdentifier = user?.displayName || user?.email || 'Unknown';
    
    // --- NEW ROBUST PERMISSION STATES ---
    const [finalAdvancedPerm, setFinalAdvancedPerm] = useState(false);
    const [finalCertPerm, setFinalCertPerm] = useState(false);
    
    // Synchronize deeply with the database and central roles
    useEffect(() => {
        if (user && user.uid) {
            getDoc(doc(db, 'users', user.uid)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    
                    // STRICT PERMISSION CHECK: 
                    // Directly verify the exact boolean flags in the user's permissions object.
                    // This ensures default roles (like Federal Manager) do not accidentally bypass 
                    // the strict requirement for canManageCertificates and canUseSuperUserAdvancedFeatures.
                    const userPerms = data.permissions || {};
                    
                    setFinalAdvancedPerm(!!userPerms.canUseSuperUserAdvancedFeatures);
                    setFinalCertPerm(!!userPerms.canManageCertificates);
                }
            }).catch(err => console.error(err));
        }
    }, [user]);

    // FIX: Using robust truthy evaluation instead of raw object validation for the global loader
    const { fetchParticipants, federalCoordinators, fetchFederalCoordinators, isLoading } = useDataCache();
    const isCacheLoading = isLoading?.federalCoordinators === true || isLoading?.courses === true;

    // ==========================================
    // 1. ALL HOOKS MUST GO AT THE TOP
    // ==========================================
    
    const [activeScreen, setActiveScreen] = useState('list'); // 'list', 'form', 'migration'
    const [editingParticipant, setEditingParticipant] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingRowId, setProcessingRowId] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    
    // UI Accordion & Mobile Toggles
    const [expandedParticipantId, setExpandedParticipantId] = useState(null);
    const [showTopActions, setShowTopActions] = useState(false); 

    // LIST VIEW STATE
    const [isBulkEditing, setIsBulkEditing] = useState(false); 
    const [isBulkCertLoading, setIsBulkCertLoading] = useState(false);
    const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
    
    // Certificate Language Modal State
    const [certLangModal, setCertLangModal] = useState({ isOpen: false, actionType: null, data: null });
    
    // Automatically reflects the global course object state
    const [localApprovalStatus, setLocalApprovalStatus] = useState(course.isCertificateApproved);
    const [isRefreshingApproval, setIsRefreshingApproval] = useState(false);

    const [groupFilter, setGroupFilter] = useState([]);
    const [jobTitleFilter, setJobTitleFilter] = useState([]);
    const [facilityFilter, setFacilityFilter] = useState([]);
    const [localityFilter, setLocalityFilter] = useState([]);
    const [subTypeFilter, setSubTypeFilter] = useState([]);

    const [importModalOpen, setImportModalOpen] = useState(false);
    const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
    const [isBulkChangeModalOpen, setIsBulkChangeModalOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareTarget, setShareTarget] = useState({ id: '', name: '' });
    const [sharePageModalOpen, setSharePageModalOpen] = useState(false); 
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailTargets, setEmailTargets] = useState([]);
    const [isBulkEmail, setIsBulkEmail] = useState(false);

    // New grouping modals
    const [isAdvancedActionsModalOpen, setIsAdvancedActionsModalOpen] = useState(false);
    const [isCertManagementModalOpen, setIsCertManagementModalOpen] = useState(false);

    useEffect(() => {
        fetchFederalCoordinators();
    }, [fetchFederalCoordinators]);

    // Keep the local state completely synced with the parent course prop automatically
    useEffect(() => {
        setLocalApprovalStatus(course.isCertificateApproved);
    }, [course.isCertificateApproved]);

    const federalProgramManagerName = useMemo(() => {
        if (!federalCoordinators || federalCoordinators.length === 0) return "Federal Program Manager"; 
        const manager = federalCoordinators.find(c => c.role === 'مدير البرنامج');
        return manager ? manager.name : "Federal Program Manager"; 
    }, [federalCoordinators]);

    const uniqueGroups = useMemo(() => [...new Set((participants || []).map(p => p.group).filter(Boolean))].sort(), [participants]);
    const uniqueJobTitles = useMemo(() => [...new Set((participants || []).map(p => p.job_title).filter(Boolean))].sort(), [participants]);
    const uniqueFacilities = useMemo(() => [...new Set((participants || []).map(p => p.center_name).filter(Boolean))].sort(), [participants]);
    const uniqueLocalities = useMemo(() => [...new Set((participants || []).map(p => p.locality).filter(Boolean))].sort(), [participants]);
    const uniqueSubTypes = useMemo(() => [...new Set((participants || []).map(p => p.imci_sub_type || course.facilitatorAssignments?.find(a => a.group === p.group)?.imci_sub_type).filter(Boolean))].sort(), [participants, course.facilitatorAssignments]);

    const filtered = useMemo(() => {
        return (participants || []).filter(p => {
            const matchGroup = groupFilter.length === 0 || groupFilter.includes(p.group);
            const matchJob = jobTitleFilter.length === 0 || jobTitleFilter.includes(p.job_title);
            const matchFacility = facilityFilter.length === 0 || facilityFilter.includes(p.center_name);
            const matchLocality = localityFilter.length === 0 || localityFilter.includes(p.locality);
            const pSubType = p.imci_sub_type || course.facilitatorAssignments?.find(a => a.group === p.group)?.imci_sub_type;
            const matchSubType = subTypeFilter.length === 0 || subTypeFilter.includes(pSubType);
            return matchGroup && matchJob && matchFacility && matchLocality && matchSubType;
        });
    }, [participants, groupFilter, jobTitleFilter, facilityFilter, localityFilter, subTypeFilter, course.facilitatorAssignments]);


    // ==========================================
    // 2. HANDLERS AND FUNCTIONS
    // ==========================================

    const toggleExpandParticipant = (id) => {
        setExpandedParticipantId(prev => (prev === id ? null : id));
    };

    const handleDeleteParticipant = async (participantId) => {
        if (!canEditDeleteParticipantActiveCourse && !canEditDeleteParticipantInactiveCourse) return;
        if (window.confirm('Are you sure you want to delete this participant and all their data?')) {
            setProcessingRowId(participantId);
            setIsProcessing(true);
            try {
                await deleteParticipant(participantId, currentUserIdentifier);
                await fetchParticipants(navigator.onLine);
                if (onBatchUpdate) onBatchUpdate();
                setToast({ show: true, message: 'Participant deleted successfully.', type: 'success' });
            } catch (error) {
                setToast({ show: true, message: `Failed to delete participant: ${error.message}`, type: 'error' });
            } finally {
                setProcessingRowId(null);
                setIsProcessing(false);
            }
        }
    };

    const handleSaveParticipant = async (participantData, facilityUpdateData) => {
        setIsProcessing(true);
        try {
            const fullPayload = { 
                ...participantData, 
                id: editingParticipant?.id, 
                courseId: course.id,
                updatedBy: currentUserIdentifier,
                ...(editingParticipant?.id ? {} : { createdBy: currentUserIdentifier })
            };
            await saveParticipantAndSubmitFacilityUpdate(fullPayload, facilityUpdateData, currentUserIdentifier);
            await fetchParticipants(navigator.onLine);
            if (onBatchUpdate) onBatchUpdate();
            setActiveScreen('list');
            setToast({ show: true, message: facilityUpdateData ? 'Participant saved and facility update submitted.' : 'Participant saved successfully.', type: 'success' });
        } catch (error) {
            setToast({ show: true, message: `Submission failed: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAdvancedSave = async (participantsData, facilitiesData) => {
        if (!participantsData || participantsData.length === 0) return;
        setIsProcessing(true);
        try {
            const annotatedData = participantsData.map(p => ({
                ...p,
                updatedBy: currentUserIdentifier,
                ...(!p.id && !p.createdBy ? { createdBy: currentUserIdentifier } : {})
            }));

            if (facilitiesData && facilitiesData.length > 0) {
                await handleImportParticipants({ participantsToImport: annotatedData, facilitiesToUpsert: facilitiesData }, false);
            } else {
                await importParticipants(annotatedData);
                await fetchParticipants(navigator.onLine);
                if (onBatchUpdate) onBatchUpdate();
                setToast({ show: true, message: 'Data updated successfully.', type: 'success' });
            }
        } catch (err) {
            console.error("Advanced save failed", err);
            setToast({ show: true, message: `Operation failed: ${err.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImportParticipants = async ({ participantsToImport, facilitiesToUpsert }, setLocalToast = true) => {
        setIsProcessing(true);
        try {
            const participantsWithCourseId = participantsToImport.map(p => ({ 
                ...p, 
                courseId: course.id,
                updatedBy: currentUserIdentifier,
                ...(!p.id && !p.createdBy ? { createdBy: currentUserIdentifier } : {})
            }));
            await importParticipants(participantsWithCourseId);
            await fetchParticipants(navigator.onLine);
            if (onBatchUpdate) onBatchUpdate();
            if (setLocalToast) setToast({ show: true, message: `Successfully imported ${participantsToImport.length} participants.`, type: 'success' });
        } catch (error) {
            if (setLocalToast) setToast({ show: true, message: `Error during import: ${error.message}`, type: 'error' });
            throw error;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExecuteBulkMigration = async (mappings) => {
        if (!mappings || mappings.length === 0) {
            setToast({ show: true, message: 'No mappings were provided.', type: 'info' });
            return;
        }
        setIsProcessing(true);
        try {
            const result = await bulkMigrateFromMappings(mappings, { dryRun: false });
            await fetchParticipants(navigator.onLine);
            if (onBatchUpdate) onBatchUpdate();
            setActiveScreen('list');
            
            let summaryMessage = `${result.submitted} participants submitted for migration.`;
            if (result.errors > 0) summaryMessage += ` ${result.errors} failed.`;
            if (result.skipped > 0) summaryMessage += ` ${result.skipped} skipped.`;
            setToast({ show: true, message: summaryMessage, type: result.errors > 0 ? 'warning' : 'success' });
        } catch (error) {
            setToast({ show: true, message: `Migration failed: ${error.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRefreshApproval = async () => {
        if (!course.id) return;
        setIsRefreshingApproval(true);
        try {
            const courseRef = doc(db, 'courses', course.id); 
            const snapshot = await getDoc(courseRef);
            if (snapshot.exists()) {
                const data = snapshot.data();
                setLocalApprovalStatus(data.isCertificateApproved === true);
                setToast({ show: true, message: data.isCertificateApproved ? 'Status updated! Certificates are approved.' : 'Status refreshed. Still pending.', type: data.isCertificateApproved ? 'success' : 'info' });
            }
        } catch (error) {
            setToast({ show: true, message: 'Failed to refresh status.', type: 'error' });
        } finally {
            setIsRefreshingApproval(false);
        }
    };

    const handleGenerateSingleCert = async (p, participantSubCourse, language) => {
        setProcessingRowId(p.id);
        setIsProcessing(true);
        try {
            const canvas = await generateCertificatePdf(course, p, federalProgramManagerName, participantSubCourse, language);
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                const imgWidth = 297;
                const imgHeight = 210;
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                doc.save(`Certificate_${p.name.replace(/ /g, '_')}_${course.course_type}.pdf`);
                setToast({ show: true, message: 'Certificate downloaded successfully!', type: 'success' });
            }
        } catch (err) {
            setToast({ show: true, message: `Failed to generate certificate: ${err.message}`, type: 'error' });
        } finally {
            setProcessingRowId(null);
            setIsProcessing(false);
        }
    };

    const handleBulkCertificateDownload = async (language) => {
        if (filtered.length === 0) {
            setToast({ show: true, message: "No participants available for bulk certificate download.", type: 'warning' });
            return;
        }
        setIsBulkCertLoading(true);
        setIsProcessing(true);
        setDownloadProgress({ current: 0, total: filtered.length }); 

        try {
             await generateAllCertificatesPdf(course, filtered, federalProgramManagerName, language, (current, total) => setDownloadProgress({ current, total }));
             setToast({ show: true, message: "Bulk certificates downloaded successfully!", type: 'success' });
        } catch(error) {
            setToast({ show: true, message: "Failed to generate bulk certificates. See console.", type: 'error' });
        } finally {
            setIsBulkCertLoading(false);
            setIsProcessing(false);
            setDownloadProgress({ current: 0, total: 0 });
        }
    };

    const handleDesignCertificate = async (language) => {
        setIsGeneratingTemplate(true);
        setIsProcessing(true);
        try {
            const canvas = await generateBlankCertificatePdf(course, federalProgramManagerName, language);
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 297, 210);
                doc.save(`Certificate_Template_${course.course_type}.pdf`);
                setToast({ show: true, message: 'Template downloaded successfully!', type: 'success' });
            }
        } catch (error) {
            setToast({ show: true, message: "Failed to generate template.", type: 'error' });
        } finally {
            setIsGeneratingTemplate(false);
            setIsProcessing(false);
        }
    };

    const handleShareClick = (p) => {
        setShareTarget({ id: p.id, name: p.name });
        setShareModalOpen(true);
    };

    const handleOpenSingleEmail = (p) => {
        setEmailTargets([p]);
        setIsBulkEmail(false);
        setEmailModalOpen(true);
    };

    const handleOpenBulkEmail = () => {
        setEmailTargets(filtered);
        setIsBulkEmail(true);
        setEmailModalOpen(true);
    };

    // ==========================================
    // 3. CONDITIONAL RENDERING (AFTER ALL HOOKS)
    // ==========================================

    if (activeScreen === 'form') {
        return (
            <ParticipantForm 
                course={course} 
                initialData={editingParticipant} 
                onCancel={() => setActiveScreen('list')} 
                onSave={handleSaveParticipant} 
            />
        );
    }

    if (activeScreen === 'migration' && finalAdvancedPerm) {
        return (
            <ParticipantMigrationMappingView 
                course={course} 
                participants={participants} 
                onCancel={() => setActiveScreen('list')} 
                onSave={handleExecuteBulkMigration} 
                setToast={setToast} 
            />
        );
    }

    if (isBulkEditing) {
        return (
            <BulkEditParticipantsView
                participants={filtered}
                course={course}
                onCancel={() => setIsBulkEditing(false)}
                onSave={async (pData, fData) => {
                    await handleAdvancedSave(pData, fData);
                    setToast({ show: true, message: 'Bulk edit saved successfully!', type: 'success' });
                    setIsBulkEditing(false);
                }}
            />
        );
    }

    const centerNameLabel = course.course_type === 'ICCM' ? 'Village Name' : (course.course_type === 'Program Management' ? 'Department' : 'Facility Name');

    return (
        <Card>
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}

            <PageHeader title="Course Participants" subtitle={`${course.state} / ${course.locality}`} />

            <CertificateLanguageModal 
                isOpen={certLangModal.isOpen}
                onClose={() => setCertLangModal({ isOpen: false, actionType: null, data: null })}
                onConfirm={(lang) => {
                    const { actionType, data } = certLangModal;
                    setCertLangModal({ isOpen: false, actionType: null, data: null });
                    if (actionType === 'single') handleGenerateSingleCert(data.p, data.participantSubCourse, lang);
                    else if (actionType === 'bulk') handleBulkCertificateDownload(lang);
                    else if (actionType === 'template') handleDesignCertificate(lang);
                }}
                title={
                    certLangModal.actionType === 'single' ? "Download Certificate" :
                    certLangModal.actionType === 'bulk' ? "Download Bulk Certificates" :
                    "Design Certificate Template"
                }
            />

            <ExcelImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onImport={handleImportParticipants}
                course={course}
                participants={participants} 
                setToast={setToast}
            />

            <ParticipantDataCleanupModal
                isOpen={isCleanupModalOpen}
                onClose={() => setIsCleanupModalOpen(false)}
                participants={participants} 
                onSave={handleAdvancedSave}
                courseType={course.course_type}
                setToast={setToast}
            />

            <BulkChangeModal
                isOpen={isBulkChangeModalOpen}
                onClose={() => setIsBulkChangeModalOpen(false)}
                participants={participants} 
                onSave={handleAdvancedSave}
                courseType={course.course_type}
                setToast={setToast}
            />
            
            <ShareCertificateModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} participantName={shareTarget.name} participantId={shareTarget.id} />
            <ShareCoursePageModal isOpen={sharePageModalOpen} onClose={() => setSharePageModalOpen(false)} courseId={course.id} courseName={course.course_type} />
            <EmailCertificateModal isOpen={emailModalOpen} onClose={() => setEmailModalOpen(false)} participants={emailTargets} isBulk={isBulkEmail} setToast={setToast} />

            {/* --- NEW ADVANCED ACTIONS MODAL --- */}
            <Modal isOpen={isAdvancedActionsModalOpen} onClose={() => setIsAdvancedActionsModalOpen(false)} title="Advanced User Actions">
                <div className="p-4 flex flex-col gap-3">
                    <p className="text-sm text-gray-600 mb-2">Select an advanced action to perform on this course's data.</p>
                    {finalAdvancedPerm && (
                        <>
                            <Button variant="secondary" className="w-full justify-start" onClick={() => { setIsAdvancedActionsModalOpen(false); setImportModalOpen(true); }} disabled={isProcessing}>
                                Import from Excel
                            </Button>
                            <Button variant="secondary" className="w-full justify-start" onClick={() => { setIsAdvancedActionsModalOpen(false); setIsCleanupModalOpen(true); }} disabled={isProcessing}>
                                Clean Data
                            </Button>
                            <Button variant="secondary" className="w-full justify-start" onClick={() => { setIsAdvancedActionsModalOpen(false); setIsBulkChangeModalOpen(true); }} disabled={isProcessing}>
                                Bulk Change
                            </Button>
                            <Button variant="secondary" className="w-full justify-start" onClick={() => { setIsAdvancedActionsModalOpen(false); setIsBulkEditing(true); }} disabled={isProcessing}>
                                Bulk Edit Table
                            </Button>
                            <Button variant="secondary" className="w-full justify-start" onClick={() => { setIsAdvancedActionsModalOpen(false); setActiveScreen('migration'); }} disabled={!participants || participants.length === 0 || isProcessing}>
                                Bulk Migrate to Facilities
                            </Button>
                        </>
                    )}
                </div>
            </Modal>

            {/* --- NEW CERTIFICATE MANAGEMENT MODAL --- */}
            <Modal isOpen={isCertManagementModalOpen} onClose={() => setIsCertManagementModalOpen(false)} title="Certificate Management">
                <div className="p-4 flex flex-col gap-3">
                    <Button onClick={() => { setIsCertManagementModalOpen(false); setCertLangModal({ isOpen: true, actionType: 'template' }); }} disabled={isProcessing || isGeneratingTemplate || isCacheLoading} className="w-full justify-start bg-green-600 hover:bg-green-700 text-white border-transparent focus:ring-green-500">
                        {isGeneratingTemplate ? <Spinner size="sm" /> : 'Design Certificate Template'}
                    </Button>

                    {localApprovalStatus ? (
                        <>
                            <Button variant="primary" className="w-full justify-start" onClick={() => { setIsCertManagementModalOpen(false); setCertLangModal({ isOpen: true, actionType: 'bulk' }); }} disabled={isProcessing || isBulkCertLoading || filtered.length === 0 || isCacheLoading}>
                                Download Filtered Certificates
                            </Button>
                            <Button variant="secondary" className="w-full justify-start border-sky-600 text-sky-700 hover:bg-sky-50" onClick={() => { setIsCertManagementModalOpen(false); setSharePageModalOpen(true); }} disabled={isProcessing}>
                                Share Public Page
                            </Button>
                            <Button variant="secondary" className="w-full justify-start border-green-600 text-green-700 hover:bg-green-50" onClick={() => { setIsCertManagementModalOpen(false); handleOpenBulkEmail(); }} disabled={!filtered || filtered.length === 0 || isProcessing}>
                                <Mail className="w-4 h-4 mr-2" /> Email All Certs
                            </Button>
                        </>
                    ) : (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded text-sm flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-orange-800 font-semibold">
                                <Lock className="w-4 h-4" /> Certificates Pending Approval
                            </div>
                            <p className="text-orange-700 text-xs">Certificates must be approved by the Federal Program Manager in the Admin Dashboard before downloading.</p>
                            <Button variant="secondary" onClick={handleRefreshApproval} disabled={isRefreshingApproval || isProcessing} className="w-full justify-center bg-white">
                                {isRefreshingApproval ? <Spinner size="sm" /> : 'Check Status Update'}
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Mobile Toggle for Top Functions */}
            <div className="mb-4 block md:hidden">
                <Button 
                    className="w-full justify-center bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300"
                    onClick={() => setShowTopActions(!showTopActions)}
                >
                    {showTopActions ? 'Hide Actions & Filters' : 'Show Actions & Filters'}
                </Button>
            </div>

            {/* Collapsible Top Functions */}
            <div className={`${showTopActions ? 'block' : 'hidden'} md:block flex flex-col gap-4 mb-4`}>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex flex-wrap gap-2 items-center">
                        {/* Standard Add Button remains visible for quick access */}
                        {canAddParticipant && (
                            <Button onClick={() => { setEditingParticipant(null); setActiveScreen('form'); }} disabled={isProcessing}>
                                Add Participant
                            </Button>
                        )}

                        {/* Advanced Actions Popup Button */}
                        {finalAdvancedPerm && (
                            <Button variant="secondary" onClick={() => setIsAdvancedActionsModalOpen(true)} disabled={isProcessing}>
                                Advanced User Actions
                            </Button>
                        )}

                        {/* Certificate Management Popup Button */}
                        {finalCertPerm && (
                            <Button variant="secondary" onClick={() => setIsCertManagementModalOpen(true)} disabled={isProcessing} className="bg-slate-800 text-white hover:bg-slate-700 border-transparent">
                                Certificate Management
                            </Button>
                        )}
                        
                        {/* Inline loading indicator for bulk certs if running in background */}
                        {isBulkCertLoading && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm border border-blue-200">
                                <Spinner size="sm" />
                                <span className="font-medium whitespace-nowrap">Generating {downloadProgress.current} / {downloadProgress.total}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <MultiSelectDropdown label="Group" placeholder="All Groups" options={uniqueGroups.length > 0 ? uniqueGroups : ['Group A', 'Group B', 'Group C', 'Group D']} selected={groupFilter} onChange={setGroupFilter} />
                        <MultiSelectDropdown label="Job Title" placeholder="All Job Titles" options={uniqueJobTitles} selected={jobTitleFilter} onChange={setJobTitleFilter} />
                        <MultiSelectDropdown label="Locality" placeholder="All Localities" options={uniqueLocalities} selected={localityFilter} onChange={setLocalityFilter} />
                        <MultiSelectDropdown label="Facility" placeholder="All Facilities" options={uniqueFacilities} selected={facilityFilter} onChange={setFacilityFilter} />
                        {uniqueSubTypes.length > 0 && <MultiSelectDropdown label="Course Sub Type" placeholder="All Sub Types" options={uniqueSubTypes} selected={subTypeFilter} onChange={setSubTypeFilter} />}
                        {(groupFilter.length > 0 || jobTitleFilter.length > 0 || localityFilter.length > 0 || facilityFilter.length > 0 || subTypeFilter.length > 0) && (
                            <div className="flex flex-col justify-end pb-0.5">
                                <Button variant="secondary" onClick={() => { setGroupFilter([]); setJobTitleFilter([]); setLocalityFilter([]); setFacilityFilter([]); setSubTypeFilter([]); }} className="text-xs py-1.5 px-3 hover:bg-red-50 hover:text-red-600 hover:border-red-200" disabled={isProcessing}>
                                    Clear Filters
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Desktop View (Standard Table) */}
            <div className="hidden md:block">
                <Table headers={["Name", "Group", "Job / Facility", "Creation Info", "Last Edit", "Actions"]}>
                    {filtered.length > 0 && filtered.map(p => {
                        const canEdit = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                        const canDelete = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                        const isCertApproved = localApprovalStatus === true;

                        let participantSubCourse = p.imci_sub_type || course.facilitatorAssignments?.find((a) => a.group === p.group)?.imci_sub_type;
                        const createdDate = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString() : p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleString() : 'N/A';
                        const lastEditDate = p.lastUpdatedAt?.toDate ? p.lastUpdatedAt.toDate().toLocaleString() : p.lastUpdatedAt?.seconds ? new Date(p.lastUpdatedAt.seconds * 1000).toLocaleString() : 'N/A';

                        return (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="p-4 border border-gray-200 font-medium text-gray-800">{p.name}</td>
                                <td className="p-4 border border-gray-200">{p.group}</td>
                                <td className="p-4 border border-gray-200">
                                    <div className="font-semibold text-sm">{p.job_title}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {course.course_type === 'Program Management' ? (p.department || 'N/A') : p.center_name}
                                        {p.locality && <span> ({p.locality})</span>}
                                    </div>
                                </td>
                                
                                <td className="p-4 border border-gray-200">
                                    <div className="text-sm whitespace-nowrap">{createdDate}</div>
                                    <div className="text-xs text-gray-500 font-medium mt-1">By: {p.createdBy || 'Legacy Data'}</div>
                                </td>
                                <td className="p-4 border border-gray-200">
                                    <div className="text-sm whitespace-nowrap">{lastEditDate}</div>
                                    <div className="text-xs text-gray-500 font-medium mt-1">By: {p.updatedBy || 'Legacy Data'}</div>
                                </td>

                                <td className="p-4 border border-gray-200 text-right">
                                    <div className="flex gap-2 flex-wrap justify-end">
                                        <Button variant="primary" onClick={() => onOpen(p.id)} disabled={!canAddMonitoring || isProcessing} title={!canAddMonitoring ? "You do not have permission to monitor" : "Monitor Participant"}>Monitor</Button>
                                        <Button variant="secondary" onClick={() => onOpenReport(p.id)} disabled={isProcessing}>Report</Button>
                                        
                                        {isCertApproved ? (
                                            finalCertPerm && (
                                                <>
                                                    <Button variant="secondary" onClick={() => handleShareClick(p)} disabled={isProcessing}>Share Cert.</Button>
                                                    <Button variant="secondary" onClick={() => setCertLangModal({ isOpen: true, actionType: 'single', data: { p, participantSubCourse } })} disabled={isCacheLoading || isProcessing || processingRowId === p.id}>
                                                        {processingRowId === p.id ? <Spinner size="sm" /> : 'Certificate'}
                                                    </Button>
                                                    <Button variant="secondary" onClick={() => handleOpenSingleEmail(p)} disabled={!p.email || isProcessing} className={!p.email ? "opacity-50 cursor-not-allowed" : ""}><Mail className="w-4 h-4" /></Button>
                                                </>
                                            )
                                        ) : (
                                            <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200" title="Certificates must be approved by the Federal Program Manager in the Admin Dashboard before downloading."><Lock className="w-3 h-3" /><span>Pending</span></div>
                                        )}

                                        {(course.course_type === 'ICCM' || course.course_type === 'EENC') && (
                                            <Button variant="secondary" onClick={() => onOpenTestFormForParticipant(p.id)} disabled={isProcessing}>Test Score</Button>
                                        )}

                                        <Button variant="secondary" onClick={() => { setEditingParticipant(p); setActiveScreen('form'); }} disabled={!canEdit || isProcessing}>Edit</Button>
                                        <Button variant="danger" onClick={() => handleDeleteParticipant(p.id)} disabled={!canDelete || isProcessing}>
                                            {processingRowId === p.id ? <Spinner size="sm" /> : 'Delete'}
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
                {filtered.length > 0 ? filtered.map(p => {
                    const canEdit = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                    const canDelete = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                    const isCertApproved = localApprovalStatus === true;
                    const isExpanded = expandedParticipantId === p.id;
                    let participantSubCourse = p.imci_sub_type || course.facilitatorAssignments?.find((a) => a.group === p.group)?.imci_sub_type;

                    const createdDate = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString() : p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleString() : 'N/A';
                    const lastEditDate = p.lastUpdatedAt?.toDate ? p.lastUpdatedAt.toDate().toLocaleString() : p.lastUpdatedAt?.seconds ? new Date(p.lastUpdatedAt.seconds * 1000).toLocaleString() : 'N/A';

                    return (
                        <div key={p.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            {/* Accordion Header */}
                            <div 
                                className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleExpandParticipant(p.id)}
                            >
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                                    <p className="text-gray-600 text-sm">{p.job_title} • {course.course_type === 'Program Management' ? (p.department || 'N/A') : p.center_name}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded text-gray-600">Group: {p.group}</span>
                                        {!isCertApproved && <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 flex items-center gap-1"><Lock className="w-3 h-3"/> Pending Cert</span>}
                                    </div>
                                </div>
                                <div className="text-gray-400">
                                    <svg className={`w-6 h-6 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>

                            {/* Collapsible Actions */}
                            {isExpanded && (
                                <div className="p-4 bg-gray-50 border-t border-gray-100">
                                    
                                    {/* Edit / Creation Tracking Info inside the mobile drawer */}
                                    <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-gray-500 border-b border-gray-200 pb-3">
                                        <div><span className="block font-semibold text-gray-700">Created:</span>{createdDate}<br/>By: {p.createdBy || 'Legacy'}</div>
                                        <div><span className="block font-semibold text-gray-700">Last Edit:</span>{lastEditDate}<br/>By: {p.updatedBy || 'Legacy'}</div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        <Button variant="primary" className="w-full justify-center" onClick={() => onOpen(p.id)} disabled={!canAddMonitoring || isProcessing}>Monitor</Button>
                                        <Button variant="secondary" className="w-full justify-center" onClick={() => onOpenReport(p.id)} disabled={isProcessing}>Report</Button>
                                        
                                        {isCertApproved && finalCertPerm && (
                                            <>
                                                <Button variant="secondary" className="w-full justify-center" onClick={() => handleShareClick(p)} disabled={isProcessing}>Share Cert.</Button>
                                                <Button variant="secondary" className="w-full justify-center" onClick={() => setCertLangModal({ isOpen: true, actionType: 'single', data: { p, participantSubCourse } })} disabled={isCacheLoading || isProcessing || processingRowId === p.id}>
                                                    {processingRowId === p.id ? <Spinner size="sm" /> : 'Certificate'}
                                                </Button>
                                                <Button variant="secondary" className="w-full justify-center" onClick={() => handleOpenSingleEmail(p)} disabled={!p.email || isProcessing}><Mail className="w-4 h-4" /> Email</Button>
                                            </>
                                        )}

                                        {(course.course_type === 'ICCM' || course.course_type === 'EENC') && (
                                            <Button variant="secondary" className="w-full justify-center" onClick={() => onOpenTestFormForParticipant(p.id)} disabled={isProcessing}>Test Score</Button>
                                        )}
                                        
                                        <Button variant="secondary" className="w-full justify-center" onClick={() => { setEditingParticipant(p); setActiveScreen('form'); }} disabled={!canEdit || isProcessing}>Edit</Button>
                                        <Button variant="danger" className="w-full justify-center" onClick={() => handleDeleteParticipant(p.id)} disabled={!canDelete || isProcessing}>
                                            {processingRowId === p.id ? <Spinner size="sm" /> : 'Delete'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                }) : (
                    <div className="p-4 text-center text-gray-500 bg-white rounded-lg shadow-md border border-gray-200">
                        No participants found matching the current filters.
                    </div>
                )}
            </div>
        </Card>
    );
}

// ... [The rest of the file: Form Component and Helpers remain exactly the same] ...
const getBoolState = (val) => val === undefined || val === null ? '' : (val ? 'yes' : 'no');
const getStrState = (val) => val === 'Yes' ? 'yes' : (val === 'No' ? 'no' : '');
const parseBool = (val) => val === 'yes' ? true : (val === 'no' ? false : null);
const parseStr = (val) => val === 'yes' ? 'Yes' : (val === 'no' ? 'No' : '');

export function ParticipantForm({ course, initialData, onCancel, onSave }) {
    const { fetchHealthFacilities } = useDataCache();
    const isImnci = course.course_type === 'IMNCI';
    const isIccm = course.course_type === 'ICCM';
    const isEtat = course.course_type === 'ETAT';
    const isEenc = course.course_type === 'EENC';
    const isSsnc = course.course_type === 'SSNC' || course.course_type === 'Small & Sick Newborn';
    const isProgramManagement = course.course_type === 'Program Management';

    const excludedImnciSubtypes = ["Standard 7 days course for Medical Doctors", "Standard 7 days course for Medical Assistance", "Refreshment IMNCI Course"];
    const showTestScores = !(isImnci || isIccm || isEenc || isSsnc || isProgramManagement) || ((isImnci || isIccm) && !excludedImnciSubtypes.includes(initialData?.imci_sub_type));

    const jobTitleOptions = useMemo(() => {
        if (isEtat) return JOB_TITLES_ETAT;
        if (isEenc) return JOB_TITLES_EENC;
        if (isSsnc) return JOB_TITLES_SSNC;
        return ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
    }, [isIccm, isImnci, isEtat, isEenc, isSsnc]);

    const [isSaving, setIsSaving] = useState(false);

    const [name, setName] = useState(String(initialData?.name || ''));
    const [email, setEmail] = useState(String(initialData?.email || ''));
    const [state, setState] = useState(initialData?.state || course?.state || ''); 
    const [locality, setLocality] = useState(initialData?.locality || course?.locality || ''); 
    const [center, setCenter] = useState(String(initialData?.center_name || '')); 
    const [department, setDepartment] = useState(String(initialData?.department || ''));
    const [phone, setPhone] = useState(String(initialData?.phone || ''));
    const [group, setGroup] = useState(initialData?.group || 'Group A');
    const [error, setError] = useState('');
    const [preTestScore, setPreTestScore] = useState(initialData?.pre_test_score ?? '');
    const [postTestScore, setPostTestScore] = useState(initialData?.post_test_score ?? '');

    const [facilitiesInLocality, setFacilitiesInLocality] = useState([]);
    const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
    const [selectedFacility, setSelectedFacility] = useState(null); 
    const [isEditingExistingWorker, setIsEditingExistingWorker] = useState(false);
    const [isFacilitySearchOpen, setIsFacilitySearchOpen] = useState(false);

    const [showNewParticipantForm, setShowNewParticipantForm] = useState(false);
    
    const initialJobTitle = initialData?.job_title || '';
    const isInitialJobOther = initialJobTitle && !jobTitleOptions.includes(initialJobTitle);
    const [job, setJob] = useState(isInitialJobOther ? 'Other' : initialJobTitle);
    const [otherJobTitle, setOtherJobTitle] = useState(isInitialJobOther ? initialJobTitle : '');

    const [trainedIMNCI, setTrainedIMNCI] = useState(getBoolState(initialData?.trained_before));
    const [lastTrainIMNCI, setLastTrainIMNCI] = useState(initialData?.last_imci_training || '');
    
    // Updated IMNCI Staff Stats Table States
    const [imnciDoctorsTotal, setImnciDoctorsTotal] = useState(initialData?.imnci_doctors_total ?? '');
    const [imnciDoctorsTrained, setImnciDoctorsTrained] = useState(initialData?.imnci_doctors_trained ?? '');
    const [imnciMedicalAssistantsTotal, setImnciMedicalAssistantsTotal] = useState(initialData?.imnci_medical_assistants_total ?? '');
    const [imnciMedicalAssistantsTrained, setImnciMedicalAssistantsTrained] = useState(initialData?.imnci_medical_assistants_trained ?? '');
    
    const [hasNutri, setHasNutri] = useState(getBoolState(initialData?.has_nutrition_service));
    const [nearestNutri, setNearestNutri] = useState(initialData?.nearest_nutrition_center || '');
    const [hasImm, setHasImm] = useState(getBoolState(initialData?.has_immunization_service));
    const [nearestImm, setNearestImm] = useState(initialData?.nearest_immunization_center || '');
    const [hasORS, setHasORS] = useState(getBoolState(initialData?.has_ors_room));
    const [hasWeightScale, setHasWeightScale] = useState(getStrState(initialData?.['ميزان_وزن']));
    const [hasHeightScale, setHasHeightScale] = useState(getStrState(initialData?.['ميزان_طول']));
    const [hasThermometer, setHasThermometer] = useState(getStrState(initialData?.['ميزان_حرارة']));
    const [hasTimer, setHasTimer] = useState(getStrState(initialData?.['ساعة_ مؤقت'])); 
    const [hasGrowthMonitoring, setHasGrowthMonitoring] = useState(getBoolState(initialData?.has_growth_monitoring));
    const [hasImnciRegister, setHasImnciRegister] = useState(getStrState(initialData?.['وجود_سجل_علاج_متكامل']));
    const [hasChartBooklet, setHasChartBooklet] = useState(getStrState(initialData?.['وجود_كتيب_لوحات']));

    const [nearestHealthFacility, setNearestHealthFacility] = useState(initialData?.nearest_health_facility || '');
    const [hoursToFacility, setHoursToFacility] = useState(initialData?.hours_to_facility ?? '');
    const [hospitalTypeEtat, setHospitalTypeEtat] = useState(initialData?.hospital_type || '');
    const [trainedEtat, setTrainedEtat] = useState(getBoolState(initialData?.trained_etat_before));
    const [lastTrainEtat, setLastTrainEtat] = useState(initialData?.last_etat_training || '');
    const [hasTriageSystem, setHasTriageSystem] = useState(getBoolState(initialData?.has_triage_system));
    const [hasStabilizationCenter, setHasStabilizationCenter] = useState(getBoolState(initialData?.has_stabilization_center));
    const [hasHdu, setHasHdu] = useState(getBoolState(initialData?.has_hdu));
    const [numStaffInEr, setNumStaffInEr] = useState(initialData?.num_staff_in_er ?? '');
    const [numStaffTrainedInEtat, setNumStaffTrainedInEtat] = useState(initialData?.num_staff_trained_in_etat ?? '');
    
    const [hospitalTypeEenc, setHospitalTypeEenc] = useState(initialData?.hospital_type || '');
    const [otherHospitalTypeEenc, setOtherHospitalTypeEenc] = useState(initialData?.other_hospital_type || '');
    const [trainedEENC, setTrainedEENC] = useState(getBoolState(initialData?.trained_eenc_before));
    const [lastTrainEENC, setLastTrainEENC] = useState(initialData?.last_eenc_training || '');
    const [hasSncu, setHasSncu] = useState(getBoolState(initialData?.has_sncu));
    const [hasIycfCenter, setHasIycfCenter] = useState(getBoolState(initialData?.has_iycf_center));
    const [numStaffInDelivery, setNumStaffInDelivery] = useState(initialData?.num_staff_in_delivery ?? '');
    const [numStaffTrainedInEenc, setNumStaffTrainedInEenc] = useState(initialData?.num_staff_trained_in_eenc ?? '');
    const [hasKangaroo, setHasKangaroo] = useState(getBoolState(initialData?.has_kangaroo_room));

    const isInitialLoad = useRef(true);

    useEffect(() => {
        const fetchFacilities = async () => {
            setError('');
            if (state && locality && !isIccm && !isProgramManagement) {
                setIsLoadingFacilities(true);
                try {
                    const facilities = await fetchHealthFacilities({ state, locality }, false);
                    setFacilitiesInLocality(facilities);
                    if (initialData?.facilityId) {
                         const matchedFacility = facilities.find(f => f.id === initialData.facilityId);
                         if(matchedFacility){
                             setSelectedFacility(matchedFacility);
                             setCenter(matchedFacility['اسم_المؤسسة']);
                         } else if (initialData.center_name) {
                             setCenter(initialData.center_name);
                             setSelectedFacility(null);
                         }
                    } else if (initialData?.center_name) {
                         const matchedFacility = facilities.find(f => f['اسم_المؤسسة'] === initialData.center_name);
                          if(matchedFacility){
                             setSelectedFacility(matchedFacility);
                             setCenter(matchedFacility['اسم_المؤسسة']);
                         } else {
                             setCenter(initialData.center_name);
                             setSelectedFacility(null);
                         }
                    }

                } catch (err) {
                    console.error("Facility fetch error:", err);
                    setError("فشل في تحميل المؤسسات الصحية لهذا الموقع.");
                    setFacilitiesInLocality([]);
                } finally {
                    setIsLoadingFacilities(false);
                    isInitialLoad.current = false; 
                }
            } else {
                setFacilitiesInLocality([]);
                 isInitialLoad.current = false; 
            }
        };
        if (state && locality && !isIccm && !isProgramManagement) {
             fetchFacilities();
        } else {
             setFacilitiesInLocality([]); 
             setIsLoadingFacilities(false);
             isInitialLoad.current = false;
        }

    }, [state, locality, initialData?.facilityId, initialData?.center_name, isIccm, isProgramManagement, fetchHealthFacilities]); 

    const handleFacilitySelect = (facilityId) => {
        setError('');
        const facility = facilitiesInLocality.find(f => f.id === facilityId);
        setSelectedFacility(facility || null);
        setCenter(facility ? String(facility['اسم_المؤسسة'] || '') : '');
        setIsEditingExistingWorker(false);
        
        if (!initialData) {
            setName('');
            setJob('');
            setOtherJobTitle('');
            setPhone('');
            setEmail('');
        }

        if (isImnci) {
            if (facility) {
                 setHasNutri(getStrState(facility.nutrition_center_exists));
                 setNearestNutri(facility.nearest_nutrition_center || '');
                 setHasImm(getStrState(facility.immunization_office_exists));
                 setNearestImm(facility.nearest_immunization_center || '');
                 setHasORS(getStrState(facility['غرفة_إرواء']));
                 
                 // Pre-fill Table Data from Facility Profile
                 setImnciDoctorsTotal(facility.imnci_doctors_total ?? '');
                 setImnciDoctorsTrained(facility.imnci_doctors_trained ?? '');
                 setImnciMedicalAssistantsTotal(facility.imnci_medical_assistants_total ?? '');
                 setImnciMedicalAssistantsTrained(facility.imnci_medical_assistants_trained ?? '');
                 
                 setHasWeightScale(getStrState(facility['ميزان_وزن']));
                 setHasHeightScale(getStrState(facility['ميزان_طول']));
                 setHasThermometer(getStrState(facility['ميزان_حرارة']));
                 setHasTimer(getStrState(facility['ساعة_ مؤقت'])); 
                 setHasImnciRegister(getStrState(facility['وجود_سجل_علاج_متكامل']));
                 setHasChartBooklet(getStrState(facility['وجود_كتيب_لوحات']));
                 setHasGrowthMonitoring(getStrState(facility.growth_monitoring_service_exists));
                 setTrainedIMNCI('');
                 setLastTrainIMNCI('');
            } else {
                 setHasNutri(''); setNearestNutri('');
                 setHasImm(''); setNearestImm('');
                 setHasORS('');
                 setImnciDoctorsTotal(''); setImnciDoctorsTrained(''); setImnciMedicalAssistantsTotal(''); setImnciMedicalAssistantsTrained('');
                 setHasWeightScale(''); setHasHeightScale(''); setHasThermometer(''); setHasTimer(''); setHasGrowthMonitoring('');
                 setHasImnciRegister(''); setHasChartBooklet('');
                 setTrainedIMNCI(''); setLastTrainIMNCI('');
            }
        }
    };

    const handleFacilitySelectFromModal = (facility) => {
        handleFacilitySelect(facility.id);
    };

    const handleHealthWorkerSelect = (worker) => {
        if (!worker) {
            setIsEditingExistingWorker(false);
            setShowNewParticipantForm(true); 
        } else {
            setIsEditingExistingWorker(true);
            setName(String(worker.name || ''));
            const staffJob = worker.job_title || '';
            if (jobTitleOptions.includes(staffJob)) {
                setJob(staffJob); setOtherJobTitle('');
            } else {
                setJob('Other'); setOtherJobTitle(staffJob);
            }
            setPhone(String(worker.phone || ''));

            if (isImnci || isIccm) {
                setTrainedIMNCI(String(worker.is_trained || '').trim().toLowerCase() === 'yes' ? 'yes' : 'no');
                setLastTrainIMNCI(worker.training_date || '');
            }
        }
    };

    const handleSaveNewParticipant = (newParticipantData) => {
        setName(newParticipantData.name);
        setPhone(newParticipantData.phone);
        if (jobTitleOptions.includes(newParticipantData.job_title)) {
            setJob(newParticipantData.job_title); setOtherJobTitle('');
        } else {
            setJob('Other'); setOtherJobTitle(newParticipantData.job_title);
        }
        setIsEditingExistingWorker(false); 
        setShowNewParticipantForm(false); 
    };

    const professionalCategory = useMemo(() => {
        const lowerCaseJob = (job === 'Other' ? otherJobTitle : job).toLowerCase();
        if (lowerCaseJob.includes('doctor') || lowerCaseJob.includes('طبيب')) return 'أطباء';
        if (lowerCaseJob.includes('nurse') || lowerCaseJob.includes('ممرض')) return 'ممرضين';
        if (lowerCaseJob.includes('midwife') || lowerCaseJob.includes('قابلة')) return 'قابلات';
        if (lowerCaseJob.includes('assistant') || lowerCaseJob.includes('مساعد')) return 'مساعدين';
        return 'كوادر';
     }, [job, otherJobTitle]);

    const submit = async () => { 
        setError('');
        const finalJobTitle = job === 'Other' ? otherJobTitle : job;

        if (!name.trim()) { setError('اسم المشارك مطلوب.'); return; }
        if (!state) { setError('الولاية مطلوبة.'); return; }
        if (!locality) { setError('المحلية مطلوبة.'); return; }
        
        if (!isProgramManagement && !center.trim()) { setError(isIccm ? 'اسم القرية مطلوب.' : 'اسم المؤسسة الصحية مطلوب.'); return; }
        if (isProgramManagement && !department.trim()) { setError('اسم الإدارة مطلوب.'); return; }

        if (!finalJobTitle) { setError('المسمى الوظيفي مطلوب.'); return; }
        if (!phone.trim()) { setError('رقم الهاتف مطلوب.'); return; }

        setIsSaving(true);
        try {
            // Background calculations for hidden fields
            let finalImciSubType = initialData?.imci_sub_type || 'Standard 7 days course'; 
            if (isImnci && course?.facilitatorAssignments) {
                const assignment = course.facilitatorAssignments.find(a => a.group === group);
                if (assignment?.imci_sub_type) {
                    finalImciSubType = assignment.imci_sub_type;
                }
            } else if (isIccm) {
                finalImciSubType = 'ICCM Community Module';
            }

            const currentFacilityType = selectedFacility?.['نوع_المؤسسةالصحية'] || initialData?.facility_type || 'no data';

            let p = {
                ...(initialData || {}), 
                name: name.trim(), group, state, locality,
                center_name: isProgramManagement ? 'N/A' : center.trim(),
                facilityId: (isIccm || isProgramManagement || selectedFacility?.id.startsWith('pending_')) ? null : selectedFacility?.id || null, 
                job_title: finalJobTitle, phone: phone.trim(), email: email ? email.trim() : null,
                department: isProgramManagement ? department.trim() : null
            };

            if (showTestScores) {
                p = { ...p, pre_test_score: preTestScore || null, post_test_score: postTestScore || null };
            }

            if (isImnci || isIccm) {
                 p = { ...p, trained_before: parseBool(trainedIMNCI), last_imci_training: trainedIMNCI === 'yes' ? (lastTrainIMNCI || null) : null };
                
                if (isImnci) {
                    // Compute totals for backwards compatibility
                    const computedTotalProv = (Number(imnciDoctorsTotal) || 0) + (Number(imnciMedicalAssistantsTotal) || 0);
                    const computedTrainedProv = (Number(imnciDoctorsTrained) || 0) + (Number(imnciMedicalAssistantsTrained) || 0);

                    p = { 
                        ...p, 
                        imci_sub_type: finalImciSubType, 
                        facility_type: currentFacilityType, 
                        
                        imnci_doctors_total: imnciDoctorsTotal !== '' ? Number(imnciDoctorsTotal) : null,
                        imnci_doctors_trained: imnciDoctorsTrained !== '' ? Number(imnciDoctorsTrained) : null,
                        imnci_medical_assistants_total: imnciMedicalAssistantsTotal !== '' ? Number(imnciMedicalAssistantsTotal) : null,
                        imnci_medical_assistants_trained: imnciMedicalAssistantsTrained !== '' ? Number(imnciMedicalAssistantsTrained) : null,
                        
                        num_other_providers: computedTotalProv > 0 ? computedTotalProv : null, 
                        num_other_providers_imci: computedTrainedProv > 0 ? computedTrainedProv : null, 
                        
                        has_nutrition_service: parseBool(hasNutri), 
                        has_immunization_service: parseBool(hasImm), 
                        has_ors_room: parseBool(hasORS), 
                        nearest_nutrition_center: hasNutri === 'no' ? (nearestNutri || null) : null, 
                        nearest_immunization_center: hasImm === 'no' ? (nearestImm || null) : null, 
                        has_growth_monitoring: parseBool(hasGrowthMonitoring) 
                    };
                } else if (isIccm) {
                    p = { ...p, imci_sub_type: finalImciSubType, nearest_health_facility: nearestHealthFacility || null, hours_to_facility: hoursToFacility !== '' ? Number(hoursToFacility) : null }; 
                }
            } else if (isEtat) {
                if (!hospitalTypeEtat) { setError('نوع المستشفى مطلوب لـ ETAT.'); setIsSaving(false); return; }
                p = { 
                    ...p, hospital_type: hospitalTypeEtat, 
                    trained_etat_before: parseBool(trainedEtat), 
                    last_etat_training: trainedEtat === 'yes' ? (lastTrainEtat || null) : null, 
                    has_triage_system: parseBool(hasTriageSystem), 
                    has_stabilization_center: parseBool(hasStabilizationCenter), 
                    has_hdu: parseBool(hasHdu), 
                    num_staff_in_er: numStaffInEr !== '' ? Number(numStaffInEr) : null, 
                    num_staff_trained_in_etat: numStaffTrainedInEtat !== '' ? Number(numStaffTrainedInEtat) : null 
                };
            } else if (isEenc || isSsnc) {
                if (!hospitalTypeEenc) { setError(`نوع المستشفى مطلوب لـ ${isEenc ? 'EENC' : 'SSNC'}.`); setIsSaving(false); return; }
                if (hospitalTypeEenc === 'other' && !otherHospitalTypeEenc) { setError(`الرجاء تحديد نوع المستشفى لـ ${isEenc ? 'EENC' : 'SSNC'}.`); setIsSaving(false); return; }
                p = { 
                    ...p, hospital_type: hospitalTypeEenc === 'other' ? otherHospitalTypeEenc : hospitalTypeEenc, 
                    trained_eenc_before: parseBool(trainedEENC), 
                    last_eenc_training: trainedEENC === 'yes' ? (lastTrainEENC || null) : null, 
                    has_sncu: parseBool(hasSncu), 
                    has_iycf_center: parseBool(hasIycfCenter), 
                    num_staff_in_delivery: numStaffInDelivery !== '' ? Number(numStaffInDelivery) : null, 
                    num_staff_trained_in_eenc: numStaffTrainedInEenc !== '' ? Number(numStaffTrainedInEenc) : null, 
                    has_kangaroo_room: parseBool(hasKangaroo) 
                };
            }

            let facilityUpdatePayload = null;
            let oldFacilityUpdatePayload = null; 

            if (isImnci) {
                if (selectedFacility && !selectedFacility.id.startsWith('pending_')) {
                    const staffMemberData = { name: name.trim(), job_title: finalJobTitle, phone: phone.trim(), is_trained: 'Yes', training_date: course.start_date || '' };
                    let existingStaff = [];
                     try {
                         existingStaff = selectedFacility.imnci_staff ? (typeof selectedFacility.imnci_staff === 'string' ? JSON.parse(selectedFacility.imnci_staff) : JSON.parse(JSON.stringify(selectedFacility.imnci_staff))) : [];
                        if (!Array.isArray(existingStaff)) existingStaff = [];
                    } catch (e) { console.error("Error parsing staff list:", e); existingStaff = []; }

                    let updatedStaffList = [...existingStaff];
                    const existingIndex = updatedStaffList.findIndex(staff => staff.name === staffMemberData.name || (staff.phone && staff.phone === staffMemberData.phone));
                    if (existingIndex > -1) updatedStaffList[existingIndex] = staffMemberData; else updatedStaffList.push(staffMemberData);

                    const facilityHadImnci = selectedFacility['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes';
                    if (!facilityHadImnci) {
                        p.introduced_imci_to_facility = true;
                    }

                    const baseFacilityPayload = {
                        'هل_المؤسسة_تعمل': 'Yes', 
                        'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes', 
                        'نوع_المؤسسةالصحية': currentFacilityType,
                        
                        'imnci_doctors_total': imnciDoctorsTotal !== '' ? Number(imnciDoctorsTotal) : (selectedFacility['imnci_doctors_total'] ?? null),
                        'imnci_doctors_trained': imnciDoctorsTrained !== '' ? Number(imnciDoctorsTrained) : (selectedFacility['imnci_doctors_trained'] ?? null),
                        'imnci_medical_assistants_total': imnciMedicalAssistantsTotal !== '' ? Number(imnciMedicalAssistantsTotal) : (selectedFacility['imnci_medical_assistants_total'] ?? null),
                        'imnci_medical_assistants_trained': imnciMedicalAssistantsTrained !== '' ? Number(imnciMedicalAssistantsTrained) : (selectedFacility['imnci_medical_assistants_trained'] ?? null),
                        
                        'nutrition_center_exists': parseStr(hasNutri), 
                        'nearest_nutrition_center': hasNutri === 'no' ? (nearestNutri || selectedFacility.nearest_nutrition_center || '') : '',
                        'immunization_office_exists': parseStr(hasImm), 
                        'nearest_immunization_center': hasImm === 'no' ? (nearestImm || selectedFacility.nearest_immunization_center || '') : '',
                        'غرفة_إرواء': parseStr(hasORS), 
                        'growth_monitoring_service_exists': parseStr(hasGrowthMonitoring),
                        'ميزان_وزن': parseStr(hasWeightScale), 
                        'ميزان_طول': parseStr(hasHeightScale), 
                        'ميزان_حرارة': parseStr(hasThermometer), 
                        'ساعة_ مؤقت': parseStr(hasTimer), 
                        'وجود_سجل_علاج_متكامل': parseStr(hasImnciRegister), 
                        'وجود_كتيب_لوحات': parseStr(hasChartBooklet), 
                    };

                    facilityUpdatePayload = { ...selectedFacility, ...baseFacilityPayload, id: selectedFacility.id, date_of_visit: new Date().toISOString().split('T')[0], imnci_staff: updatedStaffList };
                }

                if (initialData?.facilityId && selectedFacility?.id && initialData.facilityId !== selectedFacility.id) {
                    try {
                        const oldFacility = await getHealthFacilityById(initialData.facilityId);
                        if (oldFacility) {
                            let existingOldStaff = [];
                            try {
                                existingOldStaff = oldFacility.imnci_staff ? (typeof oldFacility.imnci_staff === 'string' ? JSON.parse(oldFacility.imnci_staff) : JSON.parse(JSON.stringify(oldFacility.imnci_staff))) : [];
                                if (!Array.isArray(existingOldStaff)) existingOldStaff = [];
                            } catch (e) { existingOldStaff = []; }

                            const updatedOldStaff = existingOldStaff.filter(
                                staff => staff.name !== initialData.name && staff.phone !== initialData.phone
                            );

                            oldFacilityUpdatePayload = {
                                ...oldFacility,
                                imnci_staff: updatedOldStaff
                            };
                        }
                    } catch (err) {
                        console.error("Failed to fetch old facility for cleanup:", err);
                    }
                }
            }

            await onSave(p, facilityUpdatePayload, oldFacilityUpdatePayload);
        } catch (error) {
            setError(error.message || 'An error occurred while saving.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div dir="rtl">
            <FacilitySearchModal 
                isOpen={isFacilitySearchOpen}
                onClose={() => setIsFacilitySearchOpen(false)}
                facilities={facilitiesInLocality}
                onSelect={handleFacilitySelectFromModal}
            />

             {showNewParticipantForm && (
                <NewParticipantForm
                    initialName={name}
                    jobTitleOptions={jobTitleOptions}
                    onCancel={() => setShowNewParticipantForm(false)}
                    onSave={handleSaveNewParticipant}
                    isSaving={isSaving}
                />
             )}

            <Card>
                <div className="p-6">
                    <PageHeader title={initialData ? 'تعديل بيانات المشارك' : 'إضافة مشارك جديد'} />
                    {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm font-medium">{error}</div>}
                    
                    {/* --- القسم 1: البيانات الأساسية --- */}
                    <div className="mt-6 mb-6">
                        <h3 className="text-lg font-bold mb-4 text-blue-700 border-b pb-2">البيانات الأساسية</h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FormGroup label="المجموعة (Group)">
                                <Select disabled={isSaving} value={group} onChange={(e) => setGroup(e.target.value)}>
                                    <option value="Group A">المجموعة أ (Group A)</option>
                                    <option value="Group B">المجموعة ب (Group B)</option>
                                    <option value="Group C">المجموعة ج (Group C)</option>
                                    <option value="Group D">المجموعة د (Group D)</option>
                                </Select>
                            </FormGroup>

                            <FormGroup label="الولاية">
                                 <Select disabled={isSaving} value={state} onChange={(e) => {
                                    setState(e.target.value);
                                    setLocality(''); 
                                    setCenter(''); 
                                    setSelectedFacility(null); 
                                    setFacilitiesInLocality([]); 
                                 }}>
                                    <option value="">— اختر الولاية —</option>
                                    {Object.keys(STATE_LOCALITIES).sort((a,b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}
                                </Select>
                            </FormGroup>

                            <FormGroup label="المحلية">
                                <Select disabled={isSaving || !state} value={locality} onChange={(e) => {
                                    setLocality(e.target.value);
                                    setCenter(''); 
                                    setSelectedFacility(null); 
                                }}>
                                    <option value="">— اختر المحلية —</option>
                                    {(STATE_LOCALITIES[state]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                                </Select>
                            </FormGroup>
                            
                            {isProgramManagement && (
                                <FormGroup label="الإدارة (Department)">
                                    <Input
                                        disabled={isSaving || !locality}
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        placeholder="أدخل اسم الإدارة"
                                    />
                                </FormGroup>
                            )}

                            {!isProgramManagement && (
                                isIccm ? (
                                    <FormGroup label="اسم القرية">
                                        <Input
                                            disabled={isSaving || !locality}
                                            value={center}
                                            onChange={(e) => setCenter(e.target.value)}
                                            placeholder="أدخل اسم القرية"
                                        />
                                    </FormGroup>
                                ) : (
                                    <FormGroup label={isEtat ? "اسم المستشفى" : "اسم المؤسسة الصحية"}>
                                        <div 
                                            onClick={() => {
                                                if (!isLoadingFacilities && locality && !isSaving) {
                                                    setIsFacilitySearchOpen(true);
                                                }
                                            }}
                                            className={`relative ${(!locality || isSaving) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                        >
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                                <Search className="w-5 h-5 text-gray-400 mr-2" />
                                            </div>
                                            <Input
                                                value={selectedFacility ? selectedFacility['اسم_المؤسسة'] : center}
                                                readOnly
                                                placeholder={isLoadingFacilities ? "جاري التحميل..." : (!locality ? "اختر المحلية أولاً" : "اضغط للبحث عن المؤسسة...")}
                                                className="cursor-pointer bg-white pr-10" 
                                                disabled={isLoadingFacilities || !locality || isSaving}
                                            />
                                        </div>
                                    </FormGroup>
                                )
                            )}
                            
                            {(isIccm || isProgramManagement) ? (
                                 <FormGroup label="اسم المشارك">
                                    <Input
                                        disabled={isSaving || !locality}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="أدخل الاسم الرباعي للمشارك"
                                    />
                                </FormGroup>
                            ) : (
                                <FormGroup label="اسم المشارك">
                                    <CreatableNameInput
                                        value={name}
                                        onChange={setName}
                                        onSelect={handleHealthWorkerSelect}
                                        options={useMemo(() => {
                                             if (!selectedFacility?.imnci_staff) return [];
                                             try {
                                                 let staff = typeof selectedFacility.imnci_staff === 'string'
                                                     ? JSON.parse(selectedFacility.imnci_staff)
                                                     : selectedFacility.imnci_staff;
                                                return Array.isArray(staff) ? staff : [];
                                             } catch (e) { return []; }
                                         }, [selectedFacility?.imnci_staff])}
                                        disabled={!selectedFacility || selectedFacility.id.startsWith('pending_') || isSaving} 
                                    />
                                     {isEditingExistingWorker && <p className="text-sm text-blue-600 mt-1">تعديل بيانات الموظف الحالي.</p>}
                                     {!selectedFacility && !isLoadingFacilities && locality && <p className="text-sm text-orange-600 mt-1">اختر مؤسسة للبحث عن الكوادر الحالية.</p>}
                                </FormGroup>
                            )}

                            <FormGroup label="المسمى الوظيفي">
                                 <Select disabled={isEditingExistingWorker || isSaving} value={job} onChange={(e) => setJob(e.target.value)}>
                                    <option value="">— اختر المسمى الوظيفي —</option>
                                    {jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    <option value="Other">أخرى</option>
                                </Select>
                            </FormGroup>
                            {job === 'Other' && (
                                <FormGroup label="حدد المسمى الوظيفي">
                                    <Input disabled={isEditingExistingWorker || isSaving} value={otherJobTitle} onChange={(e) => setOtherJobTitle(e.target.value)} placeholder="الرجاء التحديد" />
                                </FormGroup>
                            )}

                            <FormGroup label="رقم الهاتف"><Input disabled={isSaving} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="text-left" /></FormGroup>
                            <FormGroup label="البريد الإلكتروني (اختياري)"><Input disabled={isSaving} type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className="text-left" /></FormGroup>
                        </div>
                    </div>

                    {/* --- القسم 2: التقييم والاختبارات --- */}
                    {showTestScores && (
                        <div className="mb-6 p-4 border rounded-md bg-gray-50/50">
                            <h3 className="text-lg font-bold mb-4 text-blue-700 border-b pb-2">التقييم والاختبارات</h3>
                            <div className="grid md:grid-cols-2 gap-6">
                                <FormGroup label="درجة الاختبار القبلي (%)"><Input disabled={isSaving} type="number" min="0" max="100" value={preTestScore} onChange={(e) => setPreTestScore(e.target.value)} /></FormGroup>
                                <FormGroup label="درجة الاختبار البعدي (%)"><Input disabled={isSaving} type="number" min="0" max="100" value={postTestScore} onChange={(e) => setPostTestScore(e.target.value)} /></FormGroup>
                            </div>
                        </div>
                    )}

                    {/* --- القسم 3: بيانات التدريب والمؤسسة --- */}
                    {(isImnci || isIccm || isEtat || isEenc || isSsnc) && (
                        <div className="mb-6">
                            <h3 className="text-lg font-bold mb-4 text-blue-700 border-b pb-2">بيانات التدريب وإحصائيات الكوادر</h3>
                            <div className="grid md:grid-cols-1 gap-6">
                                
                                {(isImnci || isIccm) && (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <FormGroup label={`هل تم التدريب مسبقاً في ${isIccm ? 'IMNCI/ICCM' : 'العلاج المتكامل (IMNCI)'}؟`}>
                                            <Select disabled={isEditingExistingWorker || isSaving} value={trainedIMNCI} onChange={(e) => setTrainedIMNCI(e.target.value)}>
                                                <option value="">— اختر —</option>
                                                <option value="no">لا</option>
                                                <option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        {trainedIMNCI === 'yes' && <FormGroup label="تاريخ آخر تدريب"><Input disabled={isEditingExistingWorker || isSaving} type="date" value={lastTrainIMNCI} onChange={(e) => setLastTrainIMNCI(e.target.value)}/></FormGroup>}
                                    </div>
                                )}
                                
                                {isImnci && (
                                    <div>
                                        <h4 className="text-lg font-semibold mb-4 text-sky-800 bg-sky-50 px-4 py-2 border border-sky-100 rounded-md">إحصائية الكوادر الطبية بالمؤسسة</h4>
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
                                                        <td className="border p-2">
                                                            <Input disabled={isSaving} type="number" value={imnciDoctorsTotal} onChange={(e) => setImnciDoctorsTotal(e.target.value)} min="0" />
                                                        </td>
                                                        <td className="border p-2">
                                                            <Input disabled={isSaving} type="number" value={imnciDoctorsTrained} onChange={(e) => setImnciDoctorsTrained(e.target.value)} min="0" />
                                                        </td>
                                                    </tr>
                                                    <tr className="hover:bg-gray-50">
                                                        <td className="border p-3 font-medium text-gray-700 text-right">مساعد طبي</td>
                                                        <td className="border p-2">
                                                            <Input disabled={isSaving} type="number" value={imnciMedicalAssistantsTotal} onChange={(e) => setImnciMedicalAssistantsTotal(e.target.value)} min="0" />
                                                        </td>
                                                        <td className="border p-2">
                                                            <Input disabled={isSaving} type="number" value={imnciMedicalAssistantsTrained} onChange={(e) => setImnciMedicalAssistantsTrained(e.target.value)} min="0" />
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                
                                {isIccm && (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <FormGroup label="أقرب مؤسسة صحية">
                                            <Input disabled={isSaving} value={nearestHealthFacility} onChange={(e) => setNearestHealthFacility(e.target.value)} placeholder="اسم أقرب مؤسسة" />
                                        </FormGroup>
                                        <FormGroup label="الساعات للوصول للمؤسسة (سيراً على الأقدام)">
                                            <Input disabled={isSaving} type="number" min="0" value={hoursToFacility} onChange={(e) => setHoursToFacility(e.target.value)} placeholder="مثال: 2.5" />
                                        </FormGroup>
                                    </div>
                                )}

                                {isEtat && (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <FormGroup label="نوع المستشفى">
                                            <Select disabled={isSaving} value={hospitalTypeEtat} onChange={e => setHospitalTypeEtat(e.target.value)}>
                                                <option value="">— اختر النوع —</option>
                                                <option value="Pediatric Hospital">مستشفى أطفال</option>
                                                <option value="Pediatric Department in General Hospital">قسم أطفال في مستشفى عام</option>
                                                <option value="Rural Hospital">مستشفى ريفي</option>
                                                <option value="other">أخرى</option>
                                           </Select>
                                        </FormGroup>
                                        <FormGroup label="هل تم التدريب مسبقاً على ETAT؟">
                                            <Select disabled={isSaving} value={trainedEtat} onChange={e => setTrainedEtat(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        {trainedEtat === 'yes' && <FormGroup label="تاريخ آخر تدريب (ETAT)"><Input disabled={isSaving} type="date" value={lastTrainEtat} onChange={(e) => setLastTrainEtat(e.target.value)} /></FormGroup>}
                                        <FormGroup label="هل يوجد نظام فرز (Triage)؟">
                                            <Select disabled={isSaving} value={hasTriageSystem} onChange={e => setHasTriageSystem(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="هل يوجد مركز استقرار سوء التغذية؟">
                                            <Select disabled={isSaving} value={hasStabilizationCenter} onChange={e => setHasStabilizationCenter(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="هل توجد وحدة العناية المتوسطة (HDU)؟">
                                            <Select disabled={isSaving} value={hasHdu} onChange={e => setHasHdu(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label={`عدد الـ (${professionalCategory}) في الطوارئ`}><Input disabled={isSaving} type="number" min="0" value={numStaffInEr} onChange={e => setNumStaffInEr(e.target.value)} /></FormGroup>
                                        <FormGroup label={`عدد الـ (${professionalCategory}) المدربين على ETAT`}><Input disabled={isSaving} type="number" min="0" value={numStaffTrainedInEtat} onChange={e => setNumStaffTrainedInEtat(e.target.value)} /></FormGroup>
                                    </div>
                                )}

                                {(isEenc || isSsnc) && (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <FormGroup label="نوع المستشفى">
                                            <Select disabled={isSaving} value={hospitalTypeEenc} onChange={e => setHospitalTypeEenc(e.target.value)}>
                                                <option value="">— اختر النوع —</option>
                                                <option value="Comprehensive EmONC">طوارئ توليد شاملة (Comprehensive EmONC)</option>
                                                <option value="Basic EmONC">طوارئ توليد أساسية (Basic EmONC)</option>
                                                <option value="other">أخرى (حدد)</option>
                                            </Select>
                                        </FormGroup>
                                        {hospitalTypeEenc === 'other' && <FormGroup label="حدد نوع المستشفى"><Input disabled={isSaving} value={otherHospitalTypeEenc} onChange={e => setOtherHospitalTypeEenc(e.target.value)} /></FormGroup>}
                                        <FormGroup label={`هل تم التدريب مسبقاً على ${isEenc ? 'EENC' : 'SSNC'}؟`}>
                                            <Select disabled={isSaving} value={trainedEENC} onChange={e => setTrainedEENC(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        {trainedEENC === 'yes' && <FormGroup label={`تاريخ آخر تدريب (${isEenc ? 'EENC' : 'SSNC'})`}><Input disabled={isSaving} type="date" value={lastTrainEENC} onChange={(e) => setLastTrainEENC(e.target.value)} /></FormGroup>}
                                        <FormGroup label="هل توجد وحدة رعاية حديثي الولادة الخاصة (SNCU)؟">
                                            <Select disabled={isSaving} value={hasSncu} onChange={e => setHasSncu(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="هل يوجد مركز تغذية الرضع (IYCF)؟">
                                            <Select disabled={isSaving} value={hasIycfCenter} onChange={e => setHasIycfCenter(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="هل توجد غرفة رعاية الكنغر؟">
                                            <Select disabled={isSaving} value={hasKangaroo} onChange={e => setHasKangaroo(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>

                                        <FormGroup label={`عدد الـ (${professionalCategory}) في غرفة الولادة`}><Input disabled={isSaving} type="number" min="0" value={numStaffInDelivery} onChange={e => setNumStaffInDelivery(e.target.value)} /></FormGroup>
                                        <FormGroup label={`عدد الـ (${professionalCategory}) المدربين على ${isEenc ? 'EENC' : 'SSNC'}`}><Input disabled={isSaving} type="number" min="0" value={numStaffTrainedInEenc} onChange={e => setNumStaffTrainedInEenc(e.target.value)} /></FormGroup>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- القسم 4: معدات وخدمات المؤسسة (مخصص لـ IMNCI) --- */}
                    {isImnci && (
                        <div className="mb-6 space-y-6">
                            
                            {/* 1. المعدات وأدوات العمل */}
                            <div className="p-4 border rounded-md bg-gray-50">
                                <h3 className="text-lg font-bold mb-4 text-blue-700 border-b pb-2">المعدات وأدوات العمل</h3>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <FormGroup label="ميزان وزن">
                                        <Select disabled={isSaving} value={hasWeightScale} onChange={e => setHasWeightScale(e.target.value)}>
                                            <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="ميزان طول">
                                        <Select disabled={isSaving} value={hasHeightScale} onChange={e => setHasHeightScale(e.target.value)}>
                                            <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="ميزان حرارة">
                                        <Select disabled={isSaving} value={hasThermometer} onChange={e => setHasThermometer(e.target.value)}>
                                            <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="ساعة مؤقتة (Timer)">
                                        <Select disabled={isSaving} value={hasTimer} onChange={e => setHasTimer(e.target.value)}>
                                            <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="هل يوجد سجل العلاج المتكامل (IMNCI)؟">
                                        <Select disabled={isSaving} value={hasImnciRegister} onChange={e => setHasImnciRegister(e.target.value)}>
                                            <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="هل يوجد كتيب اللوحات؟">
                                        <Select disabled={isSaving} value={hasChartBooklet} onChange={e => setHasChartBooklet(e.target.value)}>
                                            <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                        </Select>
                                    </FormGroup>
                                </div>
                            </div>

                            {/* 2. الخدمات */}
                            <div className="p-4 border rounded-md bg-gray-50">
                                <h3 className="text-lg font-bold mb-4 text-blue-700 border-b pb-2">الخدمات</h3>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <FormGroup label="هل يوجد ركن إرواء (ORS)؟">
                                        <Select disabled={isSaving} value={hasORS} onChange={e => setHasORS(e.target.value)}>
                                            <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="خدمة مراقبة النمو">
                                        <Select disabled={isSaving} value={hasGrowthMonitoring} onChange={e => setHasGrowthMonitoring(e.target.value)}>
                                            <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                        </Select>
                                    </FormGroup>
                                    
                                    <div>
                                        <FormGroup label="هل توجد خدمة التغذية العلاجية؟">
                                            <Select disabled={isSaving} value={hasNutri} onChange={e => setHasNutri(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        {hasNutri === 'no' && <div className="mt-2"><FormGroup label="أقرب مركز تغذية علاجية؟"><Input disabled={isSaving} value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} /></FormGroup></div>}
                                    </div>

                                    <div>
                                        <FormGroup label="هل توجد خدمة التحصين؟">
                                            <Select disabled={isSaving} value={hasImm} onChange={e => setHasImm(e.target.value)}>
                                                <option value="">— اختر —</option><option value="no">لا</option><option value="yes">نعم</option>
                                            </Select>
                                        </FormGroup>
                                        {hasImm === 'no' && <div className="mt-2"><FormGroup label="أقرب مركز تحصين؟"><Input disabled={isSaving} value={nearestImm} onChange={e => setNearestImm(e.target.value)} /></FormGroup></div>}
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* Submit Buttons */}
                    <div className="flex gap-2 justify-end mt-6 border-t pt-6">
                        <Button variant="secondary" onClick={onCancel} disabled={isSaving}>إلغاء</Button>
                        <Button onClick={submit} disabled={isSaving}>
                            {isSaving ? <Spinner size="sm"/> : 'حفظ المشارك'}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}