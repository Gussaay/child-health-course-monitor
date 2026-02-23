// Participants.jsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx'; 
import jsPDF from "jspdf"; 
import { createRoot } from 'react-dom/client'; 

// --- Icons ---
import { Mail, Lock, RefreshCw, Search, Printer } from 'lucide-react'; 

// --- Firebase Imports (For Refresh Logic) ---
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

import {
    Card, PageHeader, Button, FormGroup, Input, Select, Textarea, Table, EmptyState, Modal, Spinner, Toast
} from "./CommonComponents";
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_ETAT, JOB_TITLES_EENC
} from './constants.js';
import {
    listHealthFacilities,
    importParticipants,
    bulkMigrateFromMappings,
    listParticipants,
    getHealthFacilityById,
    queueCertificateEmail
} from '../data.js';
import { useDataCache } from '../DataContext';

// --- Import Certificate Generators ---
import { generateCertificatePdf, generateAllCertificatesPdf, generateBlankCertificatePdf } from './CertificateGenerator';


// ====================================================================
// ===== 1. CUSTOM UI COMPONENTS ======================================
// ====================================================================

// --- Multi-Select Dropdown Component for Filters ---
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

// --- Email Certificate Modal ---
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
                            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
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
                        <Button onClick={handleSend} variant="primary">
                            {isBulk ? "Send All Emails" : "Send Email"}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// --- Share Course Page Modal ---
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

// --- Share Certificate Modal ---
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

// --- Reusable Searchable Select Component (Used in Migration View) ---
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

// --- New Participant Popup Form ---
const NewParticipantForm = ({ initialName, jobTitleOptions, onCancel, onSave }) => {
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
        <Modal isOpen={true} onClose={onCancel} title="Add New Participant Details">
            <Card>
                <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">This person was not found in the facility's staff list. Please provide their details.</p>
                    {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                    <div className="space-y-4 pt-6">
                        <FormGroup label="Participant Name">
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" />
                        </FormGroup>
                        <FormGroup label="Job Title">
                            <Select value={job} onChange={(e) => setJob(e.target.value)}>
                                <option value="">— Select Job —</option>
                                {jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                <option value="Other">Other</option>
                            </Select>
                        </FormGroup>
                        {job === 'Other' && (
                            <FormGroup label="Specify Job Title">
                                <Input value={otherJobTitle} onChange={(e) => setOtherJobTitle(e.target.value)} placeholder="Please specify" />
                            </FormGroup>
                        )}
                        <FormGroup label="Phone Number">
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number" />
                        </FormGroup>
                    </div>
                    <div className="flex gap-2 justify-end mt-6 border-t pt-6">
                        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                        <Button onClick={handleSave}>Continue</Button>
                    </div>
                </div>
            </Card>
        </Modal>
    );
};


// --- Participant Data Cleanup Modal ---
const ParticipantDataCleanupModal = ({ isOpen, onClose, participants, onSave, courseType }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedFieldKey, setSelectedFieldKey] = useState('');
    const [nonStandardValues, setNonStandardValues] = useState([]);
    const [mappings, setMappings] = useState({});

    const jobTitleOptions = useMemo(() => {
        if (courseType === 'ETAT') return JOB_TITLES_ETAT;
        if (courseType === 'EENC') return JOB_TITLES_EENC;
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

        if (courseType === 'EENC') {
            config['hospital_type'] = {
                label: 'Hospital Type (EENC)',
                standardValues: ['Comprehensive EmONC', 'Basic EmONC', 'other'],
                getOptionLabel: (opt) => opt
            };
        }

        return config;
    }, [jobTitleOptions, courseType]);


    useEffect(() => {
        if (!isOpen) {
            setSelectedFieldKey('');
        }
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

        try {
            await onSave(participantsToUpdate);
        } catch (error) {
            console.error("Failed to update participants:", error);
        } finally {
            setIsUpdating(false);
            onClose();
        }
    };

    const renderSelectionScreen = () => (
        <div>
            <p className="text-sm text-gray-600 mb-4">
                This tool helps standardize data for all participants in the current course. Select a field to find and correct non-standard entries.
            </p>
            <FormGroup label="Select a data field to clean">
                <Select value={selectedFieldKey} onChange={(e) => setSelectedFieldKey(e.target.value)}>
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
                                    <Select value={mappings[String(value)] || ''} onChange={(e) => handleMappingChange(String(value), e.target.value)}>
                                        <option value="">-- Map to standard value --</option>
                                        {config.standardValues.map(opt => <option key={opt} value={opt}>{config.getOptionLabel ? config.getOptionLabel(opt) : opt}</option>)}
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center mt-6">
                    <Button variant="secondary" onClick={() => setSelectedFieldKey('')}>Back to Selection</Button>
                    <Button onClick={handleApplyFixes} disabled={isUpdating || nonStandardValues.length === 0}>
                        {isUpdating ? 'Applying Fixes...' : `Apply Fixes for ${Object.keys(mappings).length} Value(s)`}
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Clean Participant Data">
            <div className="p-4">
                {!selectedFieldKey ? renderSelectionScreen() : renderMappingScreen()}
            </div>
        </Modal>
    );
};


// --- Bulk Change Modal Component ---
const BulkChangeModal = ({ isOpen, onClose, participants, onSave, courseType }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedFieldKey, setSelectedFieldKey] = useState('');
    const [fromValue, setFromValue] = useState('');
    const [toValue, setToValue] = useState('');

    const jobTitleOptions = useMemo(() => {
        if (courseType === 'ETAT') return JOB_TITLES_ETAT;
        if (courseType === 'EENC') return JOB_TITLES_EENC;
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
        const participantsToUpdate = participants
            .filter(p => p[selectedFieldKey] === fromValue)
            .map(p => ({
                id: p.id,
                [selectedFieldKey]: toValue,
            }));

        try {
            if (participantsToUpdate.length > 0) {
                await onSave(participantsToUpdate);
            }
        } catch (error) {
            console.error("Failed to bulk update participants:", error);
        } finally {
            setIsUpdating(false);
            onClose();
        }
    };

    const currentConfig = CHANGEABLE_FIELDS_CONFIG[selectedFieldKey];
    const affectedParticipantsCount = useMemo(() => {
        if (!selectedFieldKey || !fromValue) return 0;
        return participants.filter(p => p[selectedFieldKey] === fromValue).length;
    }, [participants, selectedFieldKey, fromValue]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bulk Change Participant Data">
            <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">
                    This tool allows you to change a value for a specific field across all participants in this course.
                </p>
                <FormGroup label="Select a field to change">
                    <Select value={selectedFieldKey} onChange={(e) => {
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
                            <Select value={fromValue} onChange={(e) => setFromValue(e.target.value)}>
                                <option value="">-- Select original value --</option>
                                {currentConfig.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label={`Change to value:`}>
                            <Select value={toValue} onChange={(e) => setToValue(e.target.value)}>
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
                    <Button variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
                    <Button
                        onClick={handleApplyChange}
                        disabled={isUpdating || !selectedFieldKey || !fromValue || !toValue || fromValue === toValue || affectedParticipantsCount === 0}
                    >
                        {isUpdating ? 'Applying...' : `Apply Change`}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};


// --- Excel Import Modal Component ---
const ExcelImportModal = ({ isOpen, onClose, onImport, course, participants }) => {
    const [excelData, setExcelData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const [isValidating, setIsValidating] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [userCorrections, setUserCorrections] = useState({});

    const jobTitleOptions = useMemo(() => {
        if (course.course_type === 'ETAT') return JOB_TITLES_ETAT;
        if (course.course_type === 'EENC') return JOB_TITLES_EENC;
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
        { key: 'center_name', label: course.course_type === 'ICCM' ? 'Village Name' : 'Health Facility Name', required: true },
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
        ...(course.course_type === 'EENC' ? [ { key: 'hospital_type', label: 'Hospital Type' }, { key: 'trained_eenc_before', label: 'Previously trained on EENC?' }, ] : [])
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

    const startImportProcess = () => {
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

            const centerNameLabel = course.course_type === 'ICCM' ? 'Village Name' : 'Health Facility Name';
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

            participantsToImport.push(participant);

            if (course.course_type === 'ICCM') {
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
                'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes', // FIX: Removed leading space
                'وجود_كتيب_لوحات': 'Yes',
                'وجود_سجل_علاج_متكامل': 'Yes',
                'نوع_المؤسسةالصحية': participant.facility_type,
                'nutrition_center_exists': participant.has_nutrition_service ? 'Yes' : 'No',
                'nearest_nutrition_center': participant.nearest_nutrition_center || '',
                'immunization_office_exists': participant.has_immunization_service ? 'Yes' : 'No',
                'nearest_immunization_center': participant.nearest_immunization_center || '',
                'غرفة_إرواء': participant.has_ors_room ? 'Yes' : 'No',
                'growth_monitoring_service_exists': participant.has_growth_monitoring ? 'Yes' : 'No',
                'العدد_الكلي_لكوادر_طبية_العاملة_أطباء_ومساعدين': participant.num_other_providers ?? staffList.length, // FIX: Corrected key typography
                'العدد_Kلي_للكودار_ المدربة_على_العلاج_المتكامل': participant.num_other_providers_imci ?? staffList.filter(s => s.is_trained === 'Yes').length, // FIX: Corrected key typography
            };

            facilityUpdatesMap.set(facilityKey, payload);
        });

        const facilitiesToUpsert = Array.from(facilityUpdatesMap.values());

        onImport({ participantsToImport, facilitiesToUpsert });
        onClose();
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
                                            <Select value={userCorrections[val] || ''} onChange={(e) => handleCorrectionChange(val, e.target.value)}>
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
                    <Button variant="secondary" onClick={() => setCurrentPage(1)}>Back to Mapping</Button>
                    <Button onClick={startImportProcess} disabled={!allCorrectionsMade}>
                        Apply Corrections & Import
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Participants from Excel">
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

// --- Searchable and Creatable Name Input Component (for Participant Name) ---
const CreatableNameInput = ({ value, onChange, options, onSelect, disabled }) => {
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

    const filteredOptions = useMemo(() => {
        if (!value) return options;
        return options.filter(opt => opt.name && opt.name.toLowerCase().includes(value.toLowerCase()));
    }, [options, value]);

    const handleSelect = (option) => {
        onSelect(option);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={ref}>
            <Input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setIsOpen(true)}
                disabled={disabled}
                placeholder={disabled ? "Select a facility first" : "Type to search or add new"}
            />
            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div
                        className="p-2 cursor-pointer hover:bg-gray-100 font-semibold text-blue-600"
                        onClick={() => handleSelect(null)} // `null` signifies "add new"
                    >
                        -- Add as New Participant --
                    </div>
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, index) => (
                            <div
                                key={index} // Use index or a unique property if available
                                className="p-2 cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSelect(opt)}
                            >
                                {opt.name} ({opt.job_title || 'No Job Title'})
                            </div>
                        ))
                    ) : (
                        value && <div className="p-2 text-gray-500">No existing staff found matching "{value}".</div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Facility Search Popup Modal ---
const FacilitySearchModal = ({ isOpen, onClose, facilities, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef(null);

    // Auto-focus the search input when modal opens
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


// --- Participant Migration Mapping View ---
export function ParticipantMigrationMappingView({ course, participants, onCancel, onSave, setToast }) {
    const [mappings, setMappings] = useState({});
    const [facilityOptions, setFacilityOptions] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [previewData, setPreviewData] = useState(null);

    useEffect(() => {
        const initialMappings = {};
        for (const p of participants) {
            initialMappings[p.id] = {
                targetState: p.state || '',
                targetLocality: p.locality || '',
                targetFacilityId: '',
            };
        }
        setMappings(initialMappings);
    }, [participants]);

    const fetchFacilitiesForParticipant = useCallback(async (participantId, state, locality) => {
        if (!state || !locality) {
            setFacilityOptions(prev => ({ ...prev, [participantId]: [] }));
            return;
        }
        try {
            const facilities = await listHealthFacilities({ state, locality });
            setFacilityOptions(prev => ({ ...prev, [participantId]: facilities }));
        } catch (err) {
            setToast({ show: true, message: `Could not fetch facilities for ${locality}.`, type: 'error' });
        }
    }, [setToast]);

    const handleMappingChange = (pId, field, value) => {
        setPreviewData(null);
        const newMappings = { ...mappings };
        newMappings[pId][field] = value;

        if (field === 'targetState') {
            newMappings[pId].targetLocality = '';
            newMappings[pId].targetFacilityId = '';
            setFacilityOptions(prev => ({ ...prev, [pId]: [] }));
        }
        if (field === 'targetLocality') {
            newMappings[pId].targetFacilityId = '';
            fetchFacilitiesForParticipant(pId, newMappings[pId].targetState, value);
        }
        setMappings(newMappings);
    };

    const handleExecute = async () => {
        setIsSaving(true);
        const createPayload = async () => {
            const validMappings = Object.entries(mappings).filter(([, mapping]) => mapping.targetFacilityId);
            const payload = [];

            for (const [participantId, mapping] of validMappings) {
                const facility = (facilityOptions[participantId] || []).find(f => f.id === mapping.targetFacilityId);
                if (facility) {
                     const facilityHadImnci = facility['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes';
                     const introducedImnci = !facilityHadImnci; 

                     payload.push({
                        participantId,
                        targetFacilityId: mapping.targetFacilityId,
                        targetState: mapping.targetState,
                        targetLocality: mapping.targetLocality,
                        targetFacilityName: facility['اسم_المؤسسة'],
                        introduced_imci_to_facility: introducedImnci 
                    });
                }
            }
            return payload;
        };

        try {
            const finalPayload = await createPayload();
            if (finalPayload.length > 0) {
                 await onSave(finalPayload);
            } else {
                setToast({ show: true, message: 'No participants have been mapped to a facility.', type: 'info' });
            }
        } catch (err) {
            console.error("Migration execution error:", err); 
            setToast({ show: true, message: `Migration failed: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <Spinner />;

    return (
        <Card>
            <PageHeader
                title="Bulk Participant Migration"
                subtitle={`Map participants from course: ${course.state} / ${course.locality}`}
            />
            <div className="p-4">
                <p className="mb-4 text-sm text-gray-600">For each participant, select the target State, Locality, and Health Facility to create a migration request.</p>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                         <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Participant</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Original Facility Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{minWidth: '150px'}}>Target State</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{minWidth: '150px'}}>Target Locality</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{minWidth: '200px'}}>Target Facility</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
                             {participants.map(p => {
                                const mapping = mappings[p.id];
                                if (!mapping) return null;

                                return (
                                    <tr key={p.id}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{p.center_name}</td>
                                        <td className="px-4 py-2"><Select value={mapping.targetState} onChange={e => handleMappingChange(p.id, 'targetState', e.target.value)}><option value="">- State -</option>{Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}</Select></td>
                                        <td className="px-4 py-2"><Select value={mapping.targetLocality} onChange={e => handleMappingChange(p.id, 'targetLocality', e.target.value)} disabled={!mapping.targetState}><option value="">- Locality -</option>{(STATE_LOCALITIES[mapping.targetState]?.localities || []).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}</Select></td>
                                        <td className="px-4 py-2">
                                             <SearchableSelect
                                                value={mapping.targetFacilityId}
                                                onChange={(facilityId) => handleMappingChange(p.id, 'targetFacilityId', facilityId)}
                                                options={(facilityOptions[p.id] || []).map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }))}
                                                placeholder="- Select a locality first -"
                                                disabled={!mapping.targetLocality}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex gap-2 justify-end mt-6 border-t pt-6">
                    <Button variant="secondary" onClick={onCancel} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleExecute} disabled={isSaving}>
                        {isSaving ? <Spinner/> : 'Confirm & Submit for Approval'}
                    </Button>
                </div>
            </div>
        </Card>
    );
}


// --- Participants List View Component ---
export function ParticipantsView({
    course, onAdd, onOpen, onEdit, onDelete, onOpenReport,
    onImport, onBatchUpdate, onBulkMigrate,
    onOpenTestFormForParticipant, 
    isCourseActive,
    canAddParticipant,
    canImportParticipants,
    canCleanParticipantData,
    canBulkChangeParticipants,
    canBulkMigrateParticipants,
    canAddMonitoring,
    canEditDeleteParticipantActiveCourse,
    canEditDeleteParticipantInactiveCourse
}) {
    const [participants, setParticipants] = useState([]);
    const [lastVisible, setLastVisible] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);

    // --- Progress & Approval States ---
    const [isBulkCertLoading, setIsBulkCertLoading] = useState(false);
    const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
    const [certLanguage, setCertLanguage] = useState('en'); 

    // --- Local Approval State ---
    const [localApprovalStatus, setLocalApprovalStatus] = useState(course.isCertificateApproved);
    const [isRefreshingApproval, setIsRefreshingApproval] = useState(false);

    // --- Filter States (Multi-Select Arrays) ---
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
    
    // --- Email States ---
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailTargets, setEmailTargets] = useState([]);
    const [isBulkEmail, setIsBulkEmail] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: '' }); 

    const { federalCoordinators, fetchFederalCoordinators, isLoading: isCacheLoading } = useDataCache();

    useEffect(() => {
        fetchFederalCoordinators();
    }, [fetchFederalCoordinators]);

    // Sync local state if prop changes
    useEffect(() => {
        setLocalApprovalStatus(course.isCertificateApproved);
    }, [course.isCertificateApproved]);

    const federalProgramManagerName = useMemo(() => {
        if (!federalCoordinators || federalCoordinators.length === 0) {
            return "Federal Program Manager"; 
        }
        const manager = federalCoordinators.find(c => c.role === 'مدير البرنامج');
        return manager ? manager.name : "Federal Program Manager"; 
    }, [federalCoordinators]);

    const fetchMoreParticipants = useCallback(async () => {
        if (!hasMore || isLoading) return;
        setIsLoading(true);
        try {
            const { participants: newParticipants, lastVisible: newLastVisible } = await listParticipants(course.id, lastVisible);

            setParticipants(prev => [...prev, ...newParticipants]);
            setLastVisible(newLastVisible);
            if (!newLastVisible || newParticipants.length === 0) {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Error fetching more participants:", error);
        } finally {
            setIsLoading(false);
        }
    }, [course.id, lastVisible, hasMore, isLoading]);

    useEffect(() => {
        setParticipants([]);
        setLastVisible(null);
        setHasMore(true);
        setIsLoading(true);

        const initialFetch = async () => {
            if (!course?.id) {
                setIsLoading(false);
                return;
            }
            try {
                const { participants: initialParticipants, lastVisible: newLastVisible } = await listParticipants(course.id);
                setParticipants(initialParticipants);
                setLastVisible(newLastVisible);
                if (!newLastVisible || initialParticipants.length === 0) {
                    setHasMore(false);
                }
            } catch (error) {
                console.error("Error fetching initial participants:", error);
                setHasMore(false); 
            } finally {
                setIsLoading(false);
            }
        };

        initialFetch();
    }, [course.id]);


    // --- Filtering Logic ---
    const uniqueGroups = useMemo(() => {
        return [...new Set(participants.map(p => p.group).filter(Boolean))].sort();
    }, [participants]);

    const uniqueJobTitles = useMemo(() => {
        return [...new Set(participants.map(p => p.job_title).filter(Boolean))].sort();
    }, [participants]);

    const uniqueFacilities = useMemo(() => {
        return [...new Set(participants.map(p => p.center_name).filter(Boolean))].sort();
    }, [participants]);

    const uniqueLocalities = useMemo(() => {
        return [...new Set(participants.map(p => p.locality).filter(Boolean))].sort();
    }, [participants]);

    const uniqueSubTypes = useMemo(() => {
        return [...new Set(participants.map(p => {
             let subType = p.imci_sub_type;
             if (!subType && course.facilitatorAssignments) {
                 const assignment = course.facilitatorAssignments.find(a => a.group === p.group);
                 subType = assignment?.imci_sub_type;
             }
             return subType;
        }).filter(Boolean))].sort();
    }, [participants, course.facilitatorAssignments]);

    const filtered = useMemo(() => {
        return participants.filter(p => {
            const matchGroup = groupFilter.length === 0 || groupFilter.includes(p.group);
            const matchJob = jobTitleFilter.length === 0 || jobTitleFilter.includes(p.job_title);
            const matchFacility = facilityFilter.length === 0 || facilityFilter.includes(p.center_name);
            const matchLocality = localityFilter.length === 0 || localityFilter.includes(p.locality);
            
            let pSubType = p.imci_sub_type;
            if (!pSubType && course.facilitatorAssignments) {
                const assignment = course.facilitatorAssignments.find(a => a.group === p.group);
                pSubType = assignment?.imci_sub_type;
            }
            const matchSubType = subTypeFilter.length === 0 || subTypeFilter.includes(pSubType);
            
            return matchGroup && matchJob && matchFacility && matchLocality && matchSubType;
        });
    }, [participants, groupFilter, jobTitleFilter, facilityFilter, localityFilter, subTypeFilter, course.facilitatorAssignments]);

    // --- Refresh Approval Handler ---
    const handleRefreshApproval = async () => {
        if (!course.id) return;
        setIsRefreshingApproval(true);
        try {
            const courseRef = doc(db, 'courses', course.id); 
            const snapshot = await getDoc(courseRef);
            if (snapshot.exists()) {
                const data = snapshot.data();
                setLocalApprovalStatus(data.isCertificateApproved === true);
                if (data.isCertificateApproved) {
                    setToast({ show: true, message: 'Status updated! Certificates are approved.', type: 'success' });
                } else {
                    setToast({ show: true, message: 'Status refreshed. Still pending.', type: 'info' });
                }
            }
        } catch (error) {
            console.error("Error refreshing status:", error);
            setToast({ show: true, message: 'Failed to refresh status.', type: 'error' });
        } finally {
            setIsRefreshingApproval(false);
        }
    };

    const handleSaveCleanup = async (participantsToUpdate) => {
        if (!participantsToUpdate || participantsToUpdate.length === 0) return;
        try {
            await importParticipants(participantsToUpdate);
            onBatchUpdate(); 
        } catch (err) {
            console.error("Cleanup failed", err);
        }
    };
    
    const centerNameLabel = course.course_type === 'ICCM' ? 'Village Name' : 'Facility Name';

    const handleBulkCertificateDownload = async () => {
        if (filtered.length === 0) {
            alert("No participants available for bulk certificate download.");
            return;
        }
        setIsBulkCertLoading(true);
        setDownloadProgress({ current: 0, total: filtered.length }); // Update to track filtered count

        try {
             // Pass filtered array instead of full participants array
             await generateAllCertificatesPdf(
                course, 
                filtered, 
                federalProgramManagerName, 
                certLanguage,
                (current, total) => setDownloadProgress({ current, total }) 
             );
        } catch(error) {
            console.error("Bulk certificate download failed:", error);
            alert("Failed to generate bulk certificates. See console for details.");
        } finally {
            setIsBulkCertLoading(false);
            setDownloadProgress({ current: 0, total: 0 });
        }
    };

    // --- Handle Design Certificate Template ---
    const handleDesignCertificate = async () => {
        setIsGeneratingTemplate(true);
        try {
            // Determine language (using existing state `certLanguage`)
            const canvas = await generateBlankCertificatePdf(course, federalProgramManagerName, certLanguage);
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                const imgWidth = 297;
                const imgHeight = 210;
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
                const fileName = `Certificate_Template_${course.course_type}.pdf`;
                doc.save(fileName);
            }
        } catch (error) {
            console.error("Error generating template:", error);
            setToast({ show: true, message: "Failed to generate template.", type: 'error' });
        } finally {
            setIsGeneratingTemplate(false);
        }
    };

    const handleShareClick = (p) => {
        setShareTarget({ id: p.id, name: p.name });
        setShareModalOpen(true);
    };

    const handleOpenSingleEmail = (participant) => {
        setEmailTargets([participant]);
        setIsBulkEmail(false);
        setEmailModalOpen(true);
    };

    const handleOpenBulkEmail = () => {
        setEmailTargets(filtered);
        setIsBulkEmail(true);
        setEmailModalOpen(true);
    };

    return (
        <Card>
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: '' })} />}

            <PageHeader title="Course Participants" subtitle={`${course.state} / ${course.locality}`} />

            <ExcelImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onImport={onImport}
                course={course}
                participants={participants} 
            />

            <ParticipantDataCleanupModal
                isOpen={isCleanupModalOpen}
                onClose={() => setIsCleanupModalOpen(false)}
                participants={participants} 
                onSave={handleSaveCleanup}
                courseType={course.course_type}
            />

            <BulkChangeModal
                isOpen={isBulkChangeModalOpen}
                onClose={() => setIsBulkChangeModalOpen(false)}
                participants={participants} 
                onSave={handleSaveCleanup}
                courseType={course.course_type}
            />
            
            <ShareCertificateModal 
                isOpen={shareModalOpen} 
                onClose={() => setShareModalOpen(false)} 
                participantName={shareTarget.name}
                participantId={shareTarget.id}
            />
            
             <ShareCoursePageModal
                isOpen={sharePageModalOpen}
                onClose={() => setSharePageModalOpen(false)}
                courseId={course.id}
                courseName={course.course_type}
             />

             <EmailCertificateModal 
                isOpen={emailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                participants={emailTargets}
                isBulk={isBulkEmail}
                setToast={setToast}
             />

            <div className="flex flex-col gap-4 mb-4">
                {/* Action Buttons */}
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex flex-wrap gap-2 items-center">
                        {canAddParticipant && (
                            <Button onClick={onAdd}>Add Participant</Button>
                        )}
                        {canImportParticipants && (
                            <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                                Import from Excel
                            </Button>
                        )}
                        {canCleanParticipantData && (
                            <Button variant="secondary" onClick={() => setIsCleanupModalOpen(true)}>
                                Clean Data
                            </Button>
                        )}
                        {canBulkChangeParticipants && (
                            <Button variant="secondary" onClick={() => setIsBulkChangeModalOpen(true)}>
                                Bulk Change
                            </Button>
                        )}
                        {canBulkMigrateParticipants && (
                            <Button
                                variant="secondary"
                                onClick={() => onBulkMigrate(course.id)}
                                disabled={!participants || participants.length === 0}
                                title="Update facility records based on these participants"
                            >
                                Bulk Migrate to Facilities
                            </Button>
                        )}
                        
                        <div className="flex items-center bg-white border border-gray-300 rounded px-2 h-10">
                            <span className="text-xs font-bold text-gray-600 mr-2 uppercase">Cert. Lang:</span>
                            <select 
                                value={certLanguage} 
                                onChange={(e) => setCertLanguage(e.target.value)}
                                className="border-none text-sm focus:ring-0 py-1 cursor-pointer bg-transparent"
                                style={{ outline: 'none' }}
                            >
                                <option value="en">English</option>
                                <option value="ar">Arabic (عربي)</option>
                            </select>
                        </div>

                        {/* ALWAYS VISIBLE: Design Certificate Button (Green) */}
                        <Button
                            onClick={handleDesignCertificate}
                            disabled={isGeneratingTemplate || isCacheLoading.federalCoordinators}
                            className="bg-green-600 hover:bg-green-700 text-white border-transparent focus:ring-green-500"
                            title="Download a blank certificate template for printing"
                        >
                            {isGeneratingTemplate ? <Spinner size="sm" /> : 'Design Certificate'}
                        </Button>

                        {localApprovalStatus ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="primary"
                                        onClick={handleBulkCertificateDownload}
                                        disabled={isBulkCertLoading || filtered.length === 0 || isCacheLoading.federalCoordinators}
                                        title="Download filtered certificates as one PDF"
                                    >
                                        Download Filtered Certificates
                                    </Button>
                                    
                                    {isBulkCertLoading && (
                                        <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm border border-blue-200">
                                            <Spinner size="sm" />
                                            <span className="font-medium whitespace-nowrap">
                                                Generating {downloadProgress.current} / {downloadProgress.total}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                
                                <Button
                                    variant="secondary"
                                    onClick={() => setSharePageModalOpen(true)}
                                    title="Share a public link where all participants can download their certificates"
                                    className="border-sky-600 text-sky-700 hover:bg-sky-50"
                                >
                                    Share Public Page
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={handleOpenBulkEmail}
                                    disabled={!filtered || filtered.length === 0}
                                    title="Send certificate emails to all visible participants"
                                    className="border-green-600 text-green-700 hover:bg-green-50 flex items-center gap-1"
                                >
                                    <Mail className="w-4 h-4" />
                                    Email All Certs
                                </Button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 px-3 py-2 rounded text-sm">
                                    <Lock className="w-4 h-4" />
                                    <span className="font-medium">Certificates Pending Approval</span>
                                </div>
                                
                                <button 
                                    onClick={handleRefreshApproval}
                                    disabled={isRefreshingApproval}
                                    className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                                    title="Check for approval status update"
                                >
                                    {isRefreshingApproval ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Multi-Filter Bar */}
                <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex flex-wrap items-end gap-3">
                        
                        <MultiSelectDropdown 
                            label="Group" 
                            placeholder="All Groups" 
                            options={uniqueGroups.length > 0 ? uniqueGroups : ['Group A', 'Group B', 'Group C', 'Group D']} 
                            selected={groupFilter} 
                            onChange={setGroupFilter} 
                        />

                        <MultiSelectDropdown 
                            label="Job Title" 
                            placeholder="All Job Titles" 
                            options={uniqueJobTitles} 
                            selected={jobTitleFilter} 
                            onChange={setJobTitleFilter} 
                        />

                        <MultiSelectDropdown 
                            label="Locality" 
                            placeholder="All Localities" 
                            options={uniqueLocalities} 
                            selected={localityFilter} 
                            onChange={setLocalityFilter} 
                        />

                        <MultiSelectDropdown 
                            label="Facility" 
                            placeholder="All Facilities" 
                            options={uniqueFacilities} 
                            selected={facilityFilter} 
                            onChange={setFacilityFilter} 
                        />

                        {uniqueSubTypes.length > 0 && (
                            <MultiSelectDropdown 
                                label="Course Sub Type" 
                                placeholder="All Sub Types" 
                                options={uniqueSubTypes} 
                                selected={subTypeFilter} 
                                onChange={setSubTypeFilter} 
                            />
                        )}

                        {/* Clear Filters Button (Only shows if a filter is active) */}
                        {(groupFilter.length > 0 || jobTitleFilter.length > 0 || localityFilter.length > 0 || facilityFilter.length > 0 || subTypeFilter.length > 0) && (
                            <div className="flex flex-col justify-end pb-0.5">
                                <Button 
                                    variant="secondary" 
                                    onClick={() => {
                                        setGroupFilter([]);
                                        setJobTitleFilter([]);
                                        setLocalityFilter([]);
                                        setFacilityFilter([]);
                                        setSubTypeFilter([]);
                                    }}
                                    className="text-xs py-1.5 px-3 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        )}
                        
                    </div>
                </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
                <Table headers={["Name", "Group", "Job Title", centerNameLabel, "Locality", "Actions"]}>
                    {filtered.length > 0 && filtered.map(p => {
                        const canEdit = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                        const canDelete = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                        const isCertApproved = localApprovalStatus === true;

                        let participantSubCourse = p.imci_sub_type;
                        if (!participantSubCourse) {
                             const participantAssignment = course.facilitatorAssignments?.find(
                                (a) => a.group === p.group
                            );
                            participantSubCourse = participantAssignment?.imci_sub_type;
                        }

                        return (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="p-4 border border-gray-200 font-medium text-gray-800">{p.name}</td>
                                <td className="p-4 border border-gray-200">{p.group}</td>
                                <td className="p-4 border border-gray-200">{p.job_title}</td>
                                <td className="p-4 border border-gray-200">{p.center_name}</td>
                                <td className="p-4 border border-gray-200">{p.locality}</td>
                                <td className="p-4 border border-gray-200 text-right">
                                    <div className="flex gap-2 flex-wrap justify-end">
                                        <Button variant="primary" onClick={() => onOpen(p.id)} disabled={!canAddMonitoring} title={!canAddMonitoring ? "You do not have permission to monitor" : "Monitor Participant"}>Monitor</Button>
                                        <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                        
                                        {isCertApproved ? (
                                            <>
                                                <Button 
                                                    variant="secondary" 
                                                    onClick={() => handleShareClick(p)}
                                                    title="Share Public Download Link"
                                                >
                                                    Share Cert.
                                                </Button>
                                                
                                                <Button 
                                                    variant="secondary" 
                                                    onClick={async () => {
                                                        const canvas = await generateCertificatePdf(course, p, federalProgramManagerName, participantSubCourse, certLanguage);
                                                        if (canvas) {
                                                            const doc = new jsPDF('landscape', 'mm', 'a4');
                                                            const imgWidth = 297;
                                                            const imgHeight = 210;
                                                            const imgData = canvas.toDataURL('image/png');
                                                            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                                                            const fileName = `Certificate_${p.name.replace(/ /g, '_')}_${course.course_type}.pdf`;
                                                            doc.save(fileName);
                                                        }
                                                    }}
                                                    title="Generate Single Certificate"
                                                    disabled={isCacheLoading.federalCoordinators}
                                                >
                                                    {isCacheLoading.federalCoordinators ? <Spinner size="sm" /> : 'Certificate'}
                                                </Button>
                                                
                                                <Button 
                                                    variant="secondary" 
                                                    onClick={() => handleOpenSingleEmail(p)}
                                                    title={p.email ? "Send Certificate to Email" : "No email address available"}
                                                    disabled={!p.email} 
                                                    className={!p.email ? "opacity-50 cursor-not-allowed" : ""}
                                                >
                                                    <Mail className="w-4 h-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200" title="Certificates must be approved by the Federal Program Manager in the Admin Dashboard before downloading.">
                                                <Lock className="w-3 h-3" />
                                                <span>Pending</span>
                                            </div>
                                        )}

                                        {(course.course_type === 'ICCM' || course.course_type === 'EENC') && (
                                            <Button variant="secondary" onClick={() => onOpenTestFormForParticipant(p.id)}>
                                                Test Score
                                            </Button>
                                        )}

                                        <Button variant="secondary" onClick={() => onEdit(p)} disabled={!canEdit} title={!canEdit ? "Permission denied" : "Edit Participant"}>Edit</Button>
                                        <Button variant="danger" onClick={() => onDelete(p.id)} disabled={!canDelete} title={!canDelete ? "Permission denied" : "Delete Participant"}>Delete</Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {filtered.length === 0 && !isLoading && <EmptyState message="No participants found matching the current filters." />}
                </Table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden grid gap-4">
                {filtered.length > 0 && filtered.map(p => {
                    const canEdit = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                    const canDelete = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                    const isCertApproved = localApprovalStatus === true;

                    let participantSubCourse = p.imci_sub_type;
                    if (!participantSubCourse) {
                         const participantAssignment = course.facilitatorAssignments?.find(
                            (a) => a.group === p.group
                        );
                        participantSubCourse = participantAssignment?.imci_sub_type;
                    }

                    return (
                        <div key={p.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                                    <p className="text-gray-600">{p.job_title}</p>
                                    <p className="text-gray-600 text-sm">{p.center_name}
                                        {p.locality && <span className="text-gray-500"> ({p.locality})</span>}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">Group: <span className="font-medium text-gray-700">{p.group}</span></p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
                                <Button variant="secondary" onClick={() => onOpen(p.id)} disabled={!canAddMonitoring} title={!canAddMonitoring ? "You do not have permission to monitor" : "Monitor Participant"}>Monitor</Button>
                                <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                
                                {isCertApproved ? (
                                    <>
                                        <Button 
                                            variant="secondary" 
                                            onClick={() => handleShareClick(p)}
                                            title="Share Public Download Link"
                                        >
                                            Share Cert.
                                        </Button>

                                        <Button 
                                            variant="secondary" 
                                            onClick={async () => {
                                                const canvas = await generateCertificatePdf(course, p, federalProgramManagerName, participantSubCourse, certLanguage);
                                                if (canvas) {
                                                    const doc = new jsPDF('landscape', 'mm', 'a4');
                                                    const imgWidth = 297;
                                                    const imgHeight = 210;
                                                    const imgData = canvas.toDataURL('image/png');
                                                    doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                                                    const fileName = `Certificate_${p.name.replace(/ /g, '_')}_${course.course_type}.pdf`;
                                                    doc.save(fileName);
                                                }
                                            }}
                                            title="Generate Single Certificate"
                                            disabled={isCacheLoading.federalCoordinators}
                                        >
                                            {isCacheLoading.federalCoordinators ? <Spinner size="sm" /> : 'Certificate'}
                                        </Button>

                                        <Button 
                                            variant="secondary" 
                                            onClick={() => handleOpenSingleEmail(p)}
                                            title={p.email ? "Send Certificate to Email" : "No email address available"}
                                            disabled={!p.email} 
                                            className={!p.email ? "opacity-50 cursor-not-allowed" : ""}
                                        >
                                            <Mail className="w-4 h-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200 w-full justify-center sm:w-auto" title="Certificates must be approved by the Federal Program Manager in the Admin Dashboard before downloading.">
                                        <Lock className="w-3 h-3" />
                                        <span>Pending</span>
                                    </div>
                                )}

                                {(course.course_type === 'ICCM' || course.course_type === 'EENC') && (
                                    <Button variant="secondary" onClick={() => onOpenTestFormForParticipant(p.id)}>
                                        Test Score
                                    </Button>
                                )}
                                
                                <Button variant="secondary" onClick={() => onEdit(p)} disabled={!canEdit} title={!canEdit ? "Permission denied" : "Edit Participant"}>Edit</Button>
                                <Button variant="danger" onClick={() => onDelete(p.id)} disabled={!canDelete} title={!canDelete ? "Permission denied" : "Delete Participant"}>Delete</Button>
                            </div>
                        </div>
                    );
                })}
                 {filtered.length === 0 && !isLoading && (
                    <div className="p-4 text-center text-gray-500 bg-white rounded-lg shadow-md border border-gray-200">
                        No participants found matching the current filters.
                    </div>
                 )}
            </div>

            {isLoading && <div className="text-center p-4"><Spinner /></div>}
            {hasMore && !isLoading && (
                <div className="mt-6 text-center">
                    <Button variant="secondary" onClick={fetchMoreParticipants}>Load More Participants</Button>
                </div>
            )}
        </Card>
    );
}

// --- Helpers for parsing empty state booleans ---
const getBoolState = (val) => val === undefined || val === null ? '' : (val ? 'yes' : 'no');
const getStrState = (val) => val === 'Yes' ? 'yes' : (val === 'No' ? 'no' : '');
const parseBool = (val) => val === 'yes' ? true : (val === 'no' ? false : null);
const parseStr = (val) => val === 'yes' ? 'Yes' : (val === 'no' ? 'No' : '');

// --- Participant Form Component (Main logic) ---
export function ParticipantForm({ course, initialData, onCancel, onSave }) {
    const isImnci = course.course_type === 'IMNCI';
    const isIccm = course.course_type === 'ICCM';
    const isEtat = course.course_type === 'ETAT';
    const isEenc = course.course_type === 'EENC';

    const excludedImnciSubtypes = ["Standard 7 days course for Medical Doctors", "Standard 7 days course for Medical Assistance", "Refreshment IMNCI Course"];
    const showTestScores = !(isImnci || isIccm || isEenc) || ((isImnci || isIccm) && !excludedImnciSubtypes.includes(initialData?.imci_sub_type));

    const jobTitleOptions = useMemo(() => {
        if (isEtat) return JOB_TITLES_ETAT;
        if (isEenc) return JOB_TITLES_EENC;
        return ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
    }, [isIccm, isImnci, isEtat, isEenc]);

    const [name, setName] = useState(String(initialData?.name || ''));
    const [email, setEmail] = useState(String(initialData?.email || ''));
    const [state, setState] = useState(initialData?.state || course?.state || ''); 
    const [locality, setLocality] = useState(initialData?.locality || course?.locality || ''); 
    const [center, setCenter] = useState(String(initialData?.center_name || '')); 
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

    const [imciSubType, setImciSubType] = useState(initialData?.imci_sub_type || (isIccm ? 'ICCM Community Module' : 'Standard 7 days course')); 
    const [facilityType, setFacilityType] = useState(initialData?.facility_type || '');
    const [trainedIMNCI, setTrainedIMNCI] = useState(getBoolState(initialData?.trained_before));
    const [lastTrainIMNCI, setLastTrainIMNCI] = useState(initialData?.last_imci_training || '');
    
    // Numbers updated to allow empty instead of defaulting to 1 or 0
    const [numProv, setNumProv] = useState(initialData?.num_other_providers ?? '');
    const [numProvIMNCI, setNumProvIMNCI] = useState(initialData?.num_other_providers_imci ?? '');
    
    // Booleans updated to allow empty state
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

    // Effect to fetch facilities
    useEffect(() => {
        const fetchFacilities = async () => {
            setError('');
            if (state && locality && !isIccm) {
                setIsLoadingFacilities(true);
                try {
                    const facilities = await listHealthFacilities({ state, locality });
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
                    setError("Failed to load health facilities for this location. Check console for details.");
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
        if (state && locality && !isIccm) {
             fetchFacilities();
        } else {
             setFacilitiesInLocality([]); 
             setIsLoadingFacilities(false);
             isInitialLoad.current = false;
        }

    }, [state, locality, initialData?.facilityId, initialData?.center_name, isIccm]); 


    // Handle Facility Selection
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
                 setFacilityType(facility['نوع_المؤسسةالصحية'] || '');
                 setHasNutri(getStrState(facility.nutrition_center_exists));
                 setNearestNutri(facility.nearest_nutrition_center || '');
                 setHasImm(getStrState(facility.immunization_office_exists));
                 setNearestImm(facility.nearest_immunization_center || '');
                 setHasORS(getStrState(facility['غرفة_إرواء']));
                 setNumProv(facility['العدد_الكلي_لكوادر_طبية_العاملة_أطباء_ومساعدين'] ?? ''); 
                 setNumProvIMNCI(facility['العدد_Kلي_للكودار_ المدربة_على_العلاج_المتكامل'] ?? ''); 
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
                 setFacilityType('');
                 setHasNutri(''); setNearestNutri('');
                 setHasImm(''); setNearestImm('');
                 setHasORS('');
                 setNumProv(''); setNumProvIMNCI('');
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
        if (lowerCaseJob.includes('doctor') || lowerCaseJob.includes('طبيب')) return 'doctor';
        if (lowerCaseJob.includes('nurse') || lowerCaseJob.includes('ممرض')) return 'nurse';
        if (lowerCaseJob.includes('midwife') || lowerCaseJob.includes('قابلة')) return 'midwife';
        if (lowerCaseJob.includes('assistant') || lowerCaseJob.includes('مساعد')) return 'assistant';
        return 'provider';
     }, [job, otherJobTitle]);

    const submit = async () => { 
        setError('');
        const finalJobTitle = job === 'Other' ? otherJobTitle : job;

        if (!name.trim()) { setError('Participant Name is required.'); return; }
        if (!state) { setError('State is required.'); return; }
        if (!locality) { setError('Locality is required.'); return; }
        if (!center.trim()) { setError(isIccm ? 'Village Name is required.' : 'Health Facility Name is required.'); return; }
        if (!finalJobTitle) { setError('Job Title is required.'); return; }
        if (!phone.trim()) { setError('Phone Number is required.'); return; }

        let p = {
            ...(initialData || {}), 
            name: name.trim(), group, state, locality,
            center_name: center.trim(),
            facilityId: (isIccm || selectedFacility?.id.startsWith('pending_')) ? null : selectedFacility?.id || null, 
            job_title: finalJobTitle, phone: phone.trim(), email: email ? email.trim() : null
        };

        if (showTestScores) {
            p = { ...p, pre_test_score: preTestScore || null, post_test_score: postTestScore || null };
        }

        if (isImnci || isIccm) {
             p = { ...p, trained_before: parseBool(trainedIMNCI), last_imci_training: trainedIMNCI === 'yes' ? (lastTrainIMNCI || null) : null };
            
            if (isImnci) {
                if (!imciSubType) { setError('IMCI Course Sub-type is required.'); return; }
                const currentFacilityType = facilityType || selectedFacility?.['نوع_المؤسسةالصحية'];
                if (!currentFacilityType) { setError('Facility Type is required.'); return; }
                if (numProv !== '' && numProv < 1) { setError('Number of providers must be 1 or more.'); return; }
                if (numProvIMNCI !== '' && numProvIMNCI < 0) { setError('Number of trained providers cannot be negative.'); return; }
                p = { 
                    ...p, imci_sub_type: imciSubType, facility_type: currentFacilityType, 
                    num_other_providers: numProv !== '' ? Number(numProv) : null, 
                    num_other_providers_imci: numProvIMNCI !== '' ? Number(numProvIMNCI) : null, 
                    has_nutrition_service: parseBool(hasNutri), 
                    has_immunization_service: parseBool(hasImm), 
                    has_ors_room: parseBool(hasORS), 
                    nearest_nutrition_center: hasNutri === 'no' ? (nearestNutri || null) : null, 
                    nearest_immunization_center: hasImm === 'no' ? (nearestImm || null) : null, 
                    has_growth_monitoring: parseBool(hasGrowthMonitoring) 
                };
            } else if (isIccm) {
                p = { ...p, imci_sub_type: imciSubType, nearest_health_facility: nearestHealthFacility || null, hours_to_facility: hoursToFacility !== '' ? Number(hoursToFacility) : null }; 
            }
        } else if (isEtat) {
            if (!hospitalTypeEtat) { setError('Hospital Type is required for ETAT.'); return; }
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
        } else if (isEenc) {
            if (!hospitalTypeEenc) { setError('Hospital Type is required for EENC.'); return; }
            if (hospitalTypeEenc === 'other' && !otherHospitalTypeEenc) { setError('Please specify the Hospital Type for EENC.'); return; }
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
                    'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes', 
                    'نوع_المؤسسةالصحية': facilityType || selectedFacility['نوع_المؤسسةالصحية'] || 'no data',
                    'nutrition_center_exists': parseStr(hasNutri), 
                    'nearest_nutrition_center': hasNutri === 'no' ? (nearestNutri || selectedFacility.nearest_nutrition_center || '') : '',
                    'immunization_office_exists': parseStr(hasImm), 
                    'nearest_immunization_center': hasImm === 'no' ? (nearestImm || selectedFacility.nearest_immunization_center || '') : '',
                    'غرفة_إرواء': parseStr(hasORS), 
                    'growth_monitoring_service_exists': parseStr(hasGrowthMonitoring),
                    'العدد_الكلي_لكوادر_طبية_العاملة_أطباء_ومساعدين': numProv !== '' ? Number(numProv) : (selectedFacility['العدد_الكلي_لكوادر_طبية_العاملة_أطباء_ومساعدين'] ?? updatedStaffList.length), 
                    'العدد_Kلي_للكودار_ المدربة_على_العلاج_المتكامل': numProvIMNCI !== '' ? Number(numProvIMNCI) : (selectedFacility['العدد_Kلي_للكودار_ المدربة_على_العلاج_المتكامل'] ?? updatedStaffList.filter(s => s.is_trained === 'Yes').length), 
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

        onSave(p, facilityUpdatePayload, oldFacilityUpdatePayload);
    };

    return (
        <>
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
                />
             )}

            <Card>
                <div className="p-6">
                    <PageHeader title={initialData ? 'Edit Participant' : 'Add New Participant'} />
                    {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">

                        {/* Group */}
                        <FormGroup label="Group">
                            <Select value={group} onChange={(e) => setGroup(e.target.value)}>
                                <option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option>
                            </Select>
                        </FormGroup>

                        {/* State */}
                        <FormGroup label="State">
                             <Select value={state} onChange={(e) => {
                                setState(e.target.value);
                                setLocality(''); 
                                setCenter(''); 
                                setSelectedFacility(null); 
                                setFacilitiesInLocality([]); 
                             }}>
                                <option value="">— Select State —</option>
                                {Object.keys(STATE_LOCALITIES).sort((a,b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}
                            </Select>
                        </FormGroup>

                        {/* Locality */}
                        <FormGroup label="Locality">
                            <Select value={locality} onChange={(e) => {
                                setLocality(e.target.value);
                                setCenter(''); 
                                setSelectedFacility(null); 
                            }} disabled={!state}>
                                <option value="">— Select Locality —</option>
                                {(STATE_LOCALITIES[state]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                            </Select>
                        </FormGroup>
                        
                        {isIccm ? (
                            <FormGroup label="Village Name">
                                <Input
                                    value={center}
                                    onChange={(e) => setCenter(e.target.value)}
                                    placeholder="Enter village name"
                                    disabled={!locality}
                                />
                            </FormGroup>
                        ) : (
                            <FormGroup label={isEtat ? "Hospital Name" : "Health Facility Name"}>
                                <div 
                                    onClick={() => {
                                        if (!isLoadingFacilities && locality) {
                                            setIsFacilitySearchOpen(true);
                                        }
                                    }}
                                    className={`relative ${!locality ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                >
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                        <Search className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <Input
                                        value={selectedFacility ? selectedFacility['اسم_المؤسسة'] : center}
                                        readOnly
                                        placeholder={isLoadingFacilities ? "Loading..." : (!locality ? "Select Locality first" : "Click to search facility...")}
                                        className="cursor-pointer bg-white pr-10" 
                                        disabled={isLoadingFacilities || !locality}
                                    />
                                </div>
                            </FormGroup>
                        )}
                        
                        {isIccm ? (
                             <FormGroup label="Participant Name">
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter participant's full name"
                                    disabled={!locality}
                                />
                            </FormGroup>
                        ) : (
                            <FormGroup label="Participant Name">
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
                                    disabled={!selectedFacility || selectedFacility.id.startsWith('pending_')} 
                                />
                                 {isEditingExistingWorker && <p className="text-sm text-blue-600 mt-1">Editing staff member info.</p>}
                                 {!selectedFacility && !isLoadingFacilities && locality && <p className="text-sm text-orange-600 mt-1">Select or add a facility to search existing staff.</p>}
                            </FormGroup>
                        )}

                        {/* Job Title */}
                        <FormGroup label="Job Title">
                             <Select value={job} onChange={(e) => setJob(e.target.value)} disabled={isEditingExistingWorker}>
                                <option value="">— Select Job —</option>
                                {jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                <option value="Other">Other</option>
                            </Select>
                        </FormGroup>
                        {job === 'Other' && (
                            <FormGroup label="Specify Job Title">
                                <Input value={otherJobTitle} onChange={(e) => setOtherJobTitle(e.target.value)} placeholder="Please specify" disabled={isEditingExistingWorker} />
                            </FormGroup>
                        )}

                        {/* Phone & Email */}
                        <FormGroup label="Phone Number"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></FormGroup>
                        <FormGroup label="Email (Optional)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormGroup>

                        {/* Scores */}
                        {showTestScores && (
                            <>
                                <FormGroup label="Pre-Test Score (%)"><Input type="number" min="0" max="100" value={preTestScore} onChange={(e) => setPreTestScore(e.target.value)} /></FormGroup>
                                <FormGroup label="Post-Test Score (%)"><Input type="number" min="0" max="100" value={postTestScore} onChange={(e) => setPostTestScore(e.target.value)} /></FormGroup>
                            </>
                        )}

                        {(isImnci || isIccm) && (<>
                            {isImnci && (
                                <>
                                    <FormGroup label="IMCI Course Sub-type">
                                        <Select value={imciSubType} onChange={(e) => setImciSubType(e.target.value)}>
                                            {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="Facility Type">
                                        <Select value={facilityType} onChange={(e) => setFacilityType(e.target.value)} disabled={!!selectedFacility}>
                                             <option value="">— Select Type —</option>
                                             <option value="مركز صحة الاسرة">مركز صحة الاسرة</option>
                                             <option value="مستشفى ريفي">مستشفى ريفي</option>
                                             <option value="وحدة صحة الاسرة">وحدة صحة الاسرة</option>
                                             <option value="مستشفى">مستشفى</option>
                                        </Select>
                                    </FormGroup>
                                </>
                            )}
                            
                            <FormGroup label={`Previously trained in ${isIccm ? 'IMNCI/ICCM' : 'IMNCI'}?`}>
                                <Select value={trainedIMNCI} onChange={(e) => setTrainedIMNCI(e.target.value)} disabled={isEditingExistingWorker}>
                                    <option value="">— Select —</option>
                                    <option value="no">No</option>
                                    <option value="yes">Yes</option>
                                </Select>
                            </FormGroup>
                            {trainedIMNCI === 'yes' && <FormGroup label="Date of last training"><Input type="date" value={lastTrainIMNCI} onChange={(e) => setLastTrainIMNCI(e.target.value)} disabled={isEditingExistingWorker}/></FormGroup>}
                            
                            {isImnci && (
                                <>
                                    <FormGroup label="Total Providers at Facility (incl. this participant)">
                                        <Input type="number" min="1" value={numProv} onChange={(e) => setNumProv(e.target.value)} />
                                    </FormGroup>
                                    <FormGroup label="IMCI Trained Providers at Facility (excl. current course)">
                                        <Input type="number" min="0" value={numProvIMNCI} onChange={(e) => setNumProvIMNCI(e.target.value)} />
                                    </FormGroup>
                                </>
                            )}
                            
                            {isIccm && (
                                <>
                                     <FormGroup label="ICCM Course Sub-type"> 
                                        <Select value={imciSubType} onChange={(e) => setImciSubType(e.target.value)}>
                                            <option value="ICCM Community Module">ICCM Community Module</option>
                                        </Select>
                                    </FormGroup>
                                    <FormGroup label="Nearest Health Facility">
                                        <Input value={nearestHealthFacility} onChange={(e) => setNearestHealthFacility(e.target.value)} placeholder="Name of nearest facility" />
                                    </FormGroup>
                                    <FormGroup label="Hours to Facility (on foot)">
                                        <Input type="number" min="0" value={hoursToFacility} onChange={(e) => setHoursToFacility(e.target.value)} placeholder="e.g., 2.5" />
                                    </FormGroup>
                                </>
                            )}

                            {isImnci && (
                                <div className="md:col-span-2 lg:col-span-3 my-4 p-4 border rounded-md bg-gray-50">
                                    <h3 className="text-lg font-semibold mb-3 border-b pb-2">Facility Services & Equipment (IMNCI Related)</h3>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <FormGroup label="Has therapeutic nutrition service?">
                                            <Select value={hasNutri} onChange={e => setHasNutri(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                        {hasNutri === 'no' && <FormGroup label="Nearest therapeutic nutrition center?"><Input value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} /></FormGroup>}
                                        
                                        <FormGroup label="Has immunization service?">
                                            <Select value={hasImm} onChange={e => setHasImm(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                        {hasImm === 'no' && <FormGroup label="Nearest immunization center?"><Input value={nearestImm} onChange={e => setNearestImm(e.target.value)} /></FormGroup>}
                                        
                                        <FormGroup label="Has ORS corner service?">
                                            <Select value={hasORS} onChange={e => setHasORS(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="Growth Monitoring Service">
                                            <Select value={hasGrowthMonitoring} onChange={e => setHasGrowthMonitoring(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="Has IMNCI Register?">
                                            <Select value={hasImnciRegister} onChange={e => setHasImnciRegister(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="Has Chart Booklet?">
                                            <Select value={hasChartBooklet} onChange={e => setHasChartBooklet(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="Weighting scale">
                                            <Select value={hasWeightScale} onChange={e => setHasWeightScale(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="Height scale">
                                            <Select value={hasHeightScale} onChange={e => setHasHeightScale(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="Thermometer">
                                            <Select value={hasThermometer} onChange={e => setHasThermometer(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                        <FormGroup label="Timer">
                                            <Select value={hasTimer} onChange={e => setHasTimer(e.target.value)}>
                                                <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                            </Select>
                                        </FormGroup>
                                    </div>
                                </div>
                            )}
                        </>)}

                         {isEtat && (<>
                             <FormGroup label="Hospital Type">
                                 <Select value={hospitalTypeEtat} onChange={e => setHospitalTypeEtat(e.target.value)}>
                                     <option value="">— Select Type —</option><option>Pediatric Hospital</option><option>Pediatric Department in General Hospital</option><option>Rural Hospital</option><option>other</option>
                                </Select>
                             </FormGroup>
                             <FormGroup label="Previously trained on ETAT?">
                                 <Select value={trainedEtat} onChange={e => setTrainedEtat(e.target.value)}>
                                     <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                 </Select>
                             </FormGroup>
                             {trainedEtat === 'yes' && <FormGroup label="Date of last ETAT training"><Input type="date" value={lastTrainEtat} onChange={(e) => setLastTrainEtat(e.target.value)} /></FormGroup>}
                             <FormGroup label="Has Triage System?">
                                 <Select value={hasTriageSystem} onChange={e => setHasTriageSystem(e.target.value)}>
                                     <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                 </Select>
                             </FormGroup>
                             <FormGroup label="Has Malnutrition Stabilization Center?">
                                 <Select value={hasStabilizationCenter} onChange={e => setHasStabilizationCenter(e.target.value)}>
                                     <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                 </Select>
                             </FormGroup>
                             <FormGroup label="Has High Dependency Unit (HDU)?">
                                 <Select value={hasHdu} onChange={e => setHasHdu(e.target.value)}>
                                     <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                 </Select>
                             </FormGroup>
                             <FormGroup label={`# ${professionalCategory}s in ER`}><Input type="number" min="0" value={numStaffInEr} onChange={e => setNumStaffInEr(e.target.value)} /></FormGroup>
                             <FormGroup label={`# ${professionalCategory}s trained in ETAT`}><Input type="number" min="0" value={numStaffTrainedInEtat} onChange={e => setNumStaffTrainedInEtat(e.target.value)} /></FormGroup>
                        </>)}

                         {isEenc && (<>
                            <FormGroup label="Hospital Type">
                                <Select value={hospitalTypeEenc} onChange={e => setHospitalTypeEenc(e.target.value)}>
                                    <option value="">— Select Type —</option><option>Comprehensive EmONC</option><option>Basic EmONC</option><option value="other">Other (specify)</option>
                                </Select>
                            </FormGroup>
                            {hospitalTypeEenc === 'other' && <FormGroup label="Specify Hospital Type"><Input value={otherHospitalTypeEenc} onChange={e => setOtherHospitalTypeEenc(e.target.value)} /></FormGroup>}
                            <FormGroup label="Previously trained on EENC?">
                                <Select value={trainedEENC} onChange={e => setTrainedEENC(e.target.value)}>
                                    <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                </Select>
                            </FormGroup>
                            {trainedEENC === 'yes' && <FormGroup label="Date of last EENC training"><Input type="date" value={lastTrainEENC} onChange={(e) => setLastTrainEENC(e.target.value)} /></FormGroup>}
                            <FormGroup label="Has Special Newborn Care Unit (SNCU)?">
                                <Select value={hasSncu} onChange={e => setHasSncu(e.target.value)}>
                                    <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                </Select>
                            </FormGroup>
                            <FormGroup label="Has IYCF Center?">
                                <Select value={hasIycfCenter} onChange={e => setHasIycfCenter(e.target.value)}>
                                    <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                </Select>
                            </FormGroup>
                            <FormGroup label="Has Kangaroo Care Room?">
                                <Select value={hasKangaroo} onChange={e => setHasKangaroo(e.target.value)}>
                                    <option value="">— Select —</option><option value="no">No</option><option value="yes">Yes</option>
                                </Select>
                            </FormGroup>

                            <FormGroup label={`# ${professionalCategory}s in Delivery Room`}><Input type="number" min="0" value={numStaffInDelivery} onChange={e => setNumStaffInDelivery(e.target.value)} /></FormGroup>
                            <FormGroup label={`# ${professionalCategory}s trained in EENC`}><Input type="number" min="0" value={numStaffTrainedInEenc} onChange={e => setNumStaffTrainedInEenc(e.target.value)} /></FormGroup>
                        </>)}
                    </div>
                    {/* Submit Buttons */}
                    <div className="flex gap-2 justify-end mt-6 border-t pt-6">
                        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                        <Button onClick={submit}>Save Participant</Button>
                    </div>
                </div>
            </Card>
        </>
    );
}