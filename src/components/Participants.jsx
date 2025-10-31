// Participants.jsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Textarea, Table, EmptyState, Modal, Spinner
} from "./CommonComponents";
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_ETAT, JOB_TITLES_EENC
} from './constants.js';
// Updated imports
import {
    listHealthFacilities,
    importParticipants,
    bulkMigrateFromMappings,
    listParticipants,
    submitFacilityDataForApproval, // Added
    getHealthFacilityById // Added
} from '../data.js';

// Import necessary components from FacilityForms
import { GenericFacilityForm, IMNCIFormFields } from './FacilityForms.jsx';


// --- Reusable Searchable Select Component ---
const SearchableSelect = ({ options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const ref = useRef(null);

    // Effect to set the display name when the value (ID) or options change
    useEffect(() => {
        const selectedOption = options.find(opt => opt.id === value);
        setInputValue(selectedOption ? selectedOption.name : '');
    }, [value, options]);

    // Effect to handle clicking outside the component to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
                // Reset input to the actual selected value when clicking away
                const selectedOption = options.find(opt => opt.id === value);
                setInputValue(selectedOption ? selectedOption.name : '');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref, value, options]);

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        // Show all options if the input value exactly matches the selected option's name
        const selectedOption = options.find(opt => opt.id === value);
        if (selectedOption && selectedOption.name === inputValue) {
            return options;
        }
        // Special handling for the "Add New" option
        if (value === 'addNewFacility' && options[0]?.id === 'addNewFacility') {
             return options.filter(opt => opt.id === 'addNewFacility' || opt.name.toLowerCase().includes(inputValue.toLowerCase()));
        }

        return options.filter(opt => opt.name.toLowerCase().includes(inputValue.toLowerCase()));
    }, [options, inputValue, value]);

    const handleSelect = (option) => {
        onChange(option.id); // Pass the ID back to the parent component
        setInputValue(option.name); // Set the display value in the input
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
                        onChange(''); // Clear selection in parent if input is cleared
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
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${opt.id === 'addNewFacility' ? 'font-bold text-sky-600 bg-sky-50' : ''}`}
                                onClick={() => handleSelect(opt)}
                            >
                                {opt.name}
                            </div>
                        ))
                    ) : (
                         // If no results, but input has text, still show Add New
                         inputValue && options[0]?.id === 'addNewFacility' ? (
                            <div
                                key={options[0].id}
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${options[0].id === 'addNewFacility' ? 'font-bold text-sky-600 bg-sky-50' : ''}`}
                                onClick={() => handleSelect(options[0])}
                            >
                                {options[0].name}
                            </div>
                         ) : (
                            <div className="p-2 text-gray-500">No results found.</div>
                         )
                    )}
                </div>
            )}
        </div>
    );
};

// --- ADDED: New Participant Popup Form ---
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


// --- Enhanced Participant Data Cleanup Modal ---
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

    // Configuration for all cleanable fields, dynamically adjusted for course type
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

        if (courseType === 'IMNCI') {
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
        { key: 'center_name', label: 'Health Facility Name', required: true },
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

            if (!participant.name || !participant.state || !participant.locality || !participant.center_name) {
                return;
            }

            participantsToImport.push(participant);

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
                'العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين': participant.num_other_providers ?? staffList.length,
                'العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل': participant.num_other_providers_imci ?? staffList.filter(s => s.is_trained === 'Yes').length,
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
                    Found <strong>{excelData.length}</strong> participants to import. This will create or update facility records accordingly.
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


// --- Participant Migration Mapping View (UPDATED) ---
export function ParticipantMigrationMappingView({ course, participants, onCancel, onSave, setToast }) {
    const [mappings, setMappings] = useState({});
    const [facilityOptions, setFacilityOptions] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [previewData, setPreviewData] = useState(null);

    // EFFECT (UPDATED): Simplified to initialize mappings without costly pre-fetching.
    useEffect(() => {
        const initialMappings = {};
        for (const p of participants) {
            initialMappings[p.id] = {
                // Pre-populate with participant's current location as a starting point.
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
            // This is an efficient query that only gets facilities for the selected area.
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
            // Fetch facilities on-demand when the user selects a locality.
            fetchFacilitiesForParticipant(pId, newMappings[pId].targetState, value);
        }
        setMappings(newMappings);
    };

    const handleExecute = async () => {
        setIsSaving(true);
        // This helper function now needs to fetch the facility name on the fly
        const createPayload = async () => {
            const validMappings = Object.entries(mappings).filter(([, mapping]) => mapping.targetFacilityId);
            const payload = [];

            for (const [participantId, mapping] of validMappings) {
                // Fetch the selected facility to get its name for the payload
                const facility = (facilityOptions[participantId] || []).find(f => f.id === mapping.targetFacilityId);
                if (facility) {
                     payload.push({
                        participantId,
                        targetFacilityId: mapping.targetFacilityId,
                        targetState: mapping.targetState,
                        targetLocality: mapping.targetLocality,
                        targetFacilityName: facility['اسم_المؤسسة'],
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
            // Error toast is handled by parent
            console.error("Migration execution error:", err); // Log error for debugging
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
    // --- NEW PERMISSION PROPS ---
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

    const [groupFilter, setGroupFilter] = useState('All');
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
    const [isBulkChangeModalOpen, setIsBulkChangeModalOpen] = useState(false);

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
            // Optionally set an error state here
        } finally {
            setIsLoading(false);
        }
    }, [course.id, lastVisible, hasMore, isLoading]);

    // Initial fetch
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
                setHasMore(false); // Stop trying to load more on error
                // Optionally set an error state here
            } finally {
                setIsLoading(false);
            }
        };

        initialFetch();
    }, [course.id]);


    const filtered = groupFilter === 'All' ? participants : participants.filter(p => p.group === groupFilter);

    const handleSaveCleanup = async (participantsToUpdate) => {
        if (!participantsToUpdate || participantsToUpdate.length === 0) return;
        try {
            await importParticipants(participantsToUpdate);
            onBatchUpdate(); // This should trigger a refresh of the participant list
        } catch (err) {
            console.error("Cleanup failed", err);
        }
    };

    return (
        <Card>
            <PageHeader title="Course Participants" subtitle={`${course.state} / ${course.locality}`} />

            <ExcelImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onImport={onImport}
                course={course}
                participants={participants} // Pass current full list for template download
            />

            <ParticipantDataCleanupModal
                isOpen={isCleanupModalOpen}
                onClose={() => setIsCleanupModalOpen(false)}
                participants={participants} // Pass current full list for cleanup
                onSave={handleSaveCleanup}
                courseType={course.course_type}
            />

            <BulkChangeModal
                isOpen={isBulkChangeModalOpen}
                onClose={() => setIsBulkChangeModalOpen(false)}
                participants={participants} // Pass current full list for bulk change
                onSave={handleSaveCleanup}
                courseType={course.course_type}
            />


            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <div className="flex flex-wrap gap-2">
                    {/* --- UPDATED PERMISSION CHECKS --- */}
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
                            title={(!participants || participants.length === 0) ? "No participants to migrate" : "Update facility records based on these participants"}
                        >
                            Bulk Migrate to Facilities
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <label className="font-semibold text-gray-700 text-sm">Filter by Group:</label>
                    <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                        <option value="All">All Groups</option>
                        <option>Group A</option>
                        <option>Group B</option>
                        <option>Group C</option>
                        <option>Group D</option>
                    </Select>
                </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
                <Table headers={["Name", "Group", "Job Title", "Facility Name", "Locality", "Actions"]}>
                    {filtered.length > 0 && filtered.map(p => {
                        // --- NEW LOGIC for active/inactive course permissions ---
                        const canEdit = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                        const canDelete = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;

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
                                        <Button variant="secondary" onClick={() => onEdit(p)} disabled={!canEdit} title={!canEdit ? "Permission denied" : "Edit Participant"}>Edit</Button>
                                        <Button variant="danger" onClick={() => onDelete(p.id)} disabled={!canDelete} title={!canDelete ? "Permission denied" : "Delete Participant"}>Delete</Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {filtered.length === 0 && !isLoading && <EmptyState message="No participants found for this group." />}
                </Table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden grid gap-4">
                {filtered.length > 0 && filtered.map(p => {
                    // --- NEW LOGIC for active/inactive course permissions ---
                    const canEdit = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;
                    const canDelete = isCourseActive ? canEditDeleteParticipantActiveCourse : canEditDeleteParticipantInactiveCourse;

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
                                <Button variant="secondary" onClick={() => onEdit(p)} disabled={!canEdit} title={!canEdit ? "Permission denied" : "Edit Participant"}>Edit</Button>
                                <Button variant="danger" onClick={() => onDelete(p.id)} disabled={!canDelete} title={!canDelete ? "Permission denied" : "Delete Participant"}>Delete</Button>
                            </div>
                        </div>
                    );
                })}
                 {/* --- FIX: Replaced EmptyState with a div to solve nesting error --- */}
                 {filtered.length === 0 && !isLoading && (
                    <div className="p-4 text-center text-gray-500 bg-white rounded-lg shadow-md border border-gray-200">
                        No participants found for this group.
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

// --- Add Facility Modal Component ---
const AddFacilityModal = ({ isOpen, onClose, onSaveSuccess, initialState, initialLocality, initialName = '', setToast }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const facilityInitialData = useMemo(() => ({
        'الولاية': initialState || '',
        'المحلية': initialLocality || '',
        'اسم_المؤسسة': initialName || '',
        'هل_المؤسسة_تعمل': 'Yes',
        'date_of_visit': new Date().toISOString().split('T')[0],
        'وجود_العلاج_المتكامل_لامراض_الطفولة': 'No',
        'وجود_سجل_علاج_متكامل': 'No',
        'وجود_كتيب_لوحات': 'No',
        'ميزان_وزن': 'No',
        'ميزان_طول': 'No',
        'ميزان_حرارة': 'No',
        'ساعة_مؤقت': 'No',
        'غرفة_إرواء': 'No',
        'immunization_office_exists': 'No',
        'nutrition_center_exists': 'No',
        'growth_monitoring_service_exists': 'No',
        'imnci_staff': [], // Start with empty staff list
    }), [initialState, initialLocality, initialName]);

    const handleSaveFacility = async (formData) => {
        setIsSubmitting(true);
        try {
            const submitterIdentifier = 'Participant Form - New Facility';
            const { id, ...dataToSubmit } = formData;

            if (!dataToSubmit['اسم_المؤسسة'] || !dataToSubmit['الولاية'] || !dataToSubmit['المحلية']) {
                throw new Error("Facility Name, State, and Locality are required.");
            }

            // Ensure imnci_staff is an array before submitting
             dataToSubmit.imnci_staff = Array.isArray(dataToSubmit.imnci_staff) ? dataToSubmit.imnci_staff : [];

            await submitFacilityDataForApproval(dataToSubmit, submitterIdentifier);

            setToast({ show: true, message: "New facility submitted for approval. It may take time to appear in the list.", type: 'info' });

            onSaveSuccess({
                id: `pending_${Date.now()}`,
                ...dataToSubmit
            });
            onClose();

        } catch (error) {
            console.error("Failed to submit new facility:", error);
            setToast({ show: true, message: `Error submitting facility: ${error.message}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Health Facility">
             <div className="p-1 max-h-[80vh] overflow-y-auto">
                <GenericFacilityForm
                    initialData={facilityInitialData}
                    onSave={handleSaveFacility}
                    onCancel={onClose}
                    setToast={setToast}
                    title="بيانات المنشأة الصحية الجديدة"
                    subtitle={`Adding a new facility in ${STATE_LOCALITIES[initialState]?.ar || initialState}, ${STATE_LOCALITIES[initialState]?.localities.find(l=>l.en === initialLocality)?.ar || initialLocality}`}
                    isPublicForm={false}
                    saveButtonText="Submit New Facility for Approval"
                    isSubmitting={isSubmitting}
                >
                    {(props) => <IMNCIFormFields {...props} />}
                </GenericFacilityForm>
            </div>
        </Modal>
    );
};


// --- Participant Form Component (Main logic) ---
export function ParticipantForm({ course, initialData, onCancel, onSave }) {
    const isImnci = course.course_type === 'IMNCI';
    const isEtat = course.course_type === 'ETAT';
    const isEenc = course.course_type === 'EENC';

    const excludedImnciSubtypes = ["Standard 7 days course for Medical Doctors", "Standard 7 days course for Medical Assistance", "Refreshment IMNCI Course"];
    const showTestScores = !isImnci || (isImnci && !excludedImnciSubtypes.includes(initialData?.imci_sub_type));

    const jobTitleOptions = useMemo(() => {
        if (isEtat) return JOB_TITLES_ETAT;
        if (isEenc) return JOB_TITLES_EENC;
        return ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
    }, [isImnci, isEtat, isEenc]);

    // Participant States
    const [name, setName] = useState(initialData?.name || '');
    const [email, setEmail] = useState(initialData?.email || '');
    const [state, setState] = useState(initialData?.state || course?.state || ''); // Default to course state
    const [locality, setLocality] = useState(initialData?.locality || course?.locality || ''); // Default to course locality
    const [center, setCenter] = useState(initialData?.center_name || ''); // This holds the facility *name*
    const [phone, setPhone] = useState(initialData?.phone || '');
    const [group, setGroup] = useState(initialData?.group || 'Group A');
    const [error, setError] = useState('');
    const [preTestScore, setPreTestScore] = useState(initialData?.pre_test_score || '');
    const [postTestScore, setPostTestScore] = useState(initialData?.post_test_score || '');

    // Facility Related States
    const [facilitiesInLocality, setFacilitiesInLocality] = useState([]);
    const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
    const [selectedFacility, setSelectedFacility] = useState(null); // This holds the *selected facility object* or null
    const [isEditingExistingWorker, setIsEditingExistingWorker] = useState(false);

    // Modal States
    const [showNewParticipantForm, setShowNewParticipantForm] = useState(false);
    const [isAddFacilityModalOpen, setIsAddFacilityModalOpen] = useState(false);
    const [newFacilityNameSuggestion, setNewFacilityNameSuggestion] = useState('');

    // Job Title States
    const initialJobTitle = initialData?.job_title || '';
    const isInitialJobOther = initialJobTitle && !jobTitleOptions.includes(initialJobTitle);
    const [job, setJob] = useState(isInitialJobOther ? 'Other' : initialJobTitle);
    const [otherJobTitle, setOtherJobTitle] = useState(isInitialJobOther ? initialJobTitle : '');

    // Service Specific States
    const [imciSubType, setImciSubType] = useState(initialData?.imci_sub_type || 'Standard 7 days course');
    const [facilityType, setFacilityType] = useState(initialData?.facility_type || '');
    const [trainedIMNCI, setTrainedIMNCI] = useState(initialData?.trained_before ? 'yes' : 'no');
    const [lastTrainIMNCI, setLastTrainIMNCI] = useState(initialData?.last_imci_training || '');
    const [numProv, setNumProv] = useState(initialData?.num_other_providers || 1);
    const [numProvIMNCI, setNumProvIMNCI] = useState(initialData?.num_other_providers_imci || 0);
    const [hasNutri, setHasNutri] = useState(initialData?.has_nutrition_service || false);
    const [nearestNutri, setNearestNutri] = useState(initialData?.nearest_nutrition_center || '');
    const [hasImm, setHasImm] = useState(initialData?.has_immunization_service || false);
    const [nearestImm, setNearestImm] = useState(initialData?.nearest_immunization_center || '');
    const [hasORS, setHasORS] = useState(initialData?.has_ors_room || false);
    const [hasWeightScale, setHasWeightScale] = useState(initialData?.['ميزان_وزن'] === 'Yes');
    const [hasHeightScale, setHasHeightScale] = useState(initialData?.['ميزان_طول'] === 'Yes');
    const [hasThermometer, setHasThermometer] = useState(initialData?.['ميزان_حرارة'] === 'Yes');
    const [hasTimer, setHasTimer] = useState(initialData?.['ساعة_مؤقت'] === 'Yes');
    const [hasGrowthMonitoring, setHasGrowthMonitoring] = useState(initialData?.has_growth_monitoring || false);
    const [hospitalTypeEtat, setHospitalTypeEtat] = useState(initialData?.hospital_type || '');
    const [trainedEtat, setTrainedEtat] = useState(initialData?.trained_etat_before ? 'yes' : 'no');
    const [lastTrainEtat, setLastTrainEtat] = useState(initialData?.last_etat_training || '');
    const [hasTriageSystem, setHasTriageSystem] = useState(initialData?.has_triage_system || false);
    const [hasStabilizationCenter, setHasStabilizationCenter] = useState(initialData?.has_stabilization_center || false);
    const [hasHdu, setHasHdu] = useState(initialData?.has_hdu || false);
    const [numStaffInEr, setNumStaffInEr] = useState(initialData?.num_staff_in_er || 0);
    const [numStaffTrainedInEtat, setNumStaffTrainedInEtat] = useState(initialData?.num_staff_trained_in_etat || 0);
    const [hospitalTypeEenc, setHospitalTypeEenc] = useState(initialData?.hospital_type || '');
    const [otherHospitalTypeEenc, setOtherHospitalTypeEenc] = useState(initialData?.other_hospital_type || '');
    const [trainedEENC, setTrainedEENC] = useState(initialData?.trained_eenc_before ? 'yes' : 'no');
    const [lastTrainEENC, setLastTrainEENC] = useState(initialData?.last_eenc_training || '');
    const [hasSncu, setHasSncu] = useState(initialData?.has_sncu || false);
    const [hasIycfCenter, setHasIycfCenter] = useState(initialData?.has_iycf_center || false);
    const [numStaffInDelivery, setNumStaffInDelivery] = useState(initialData?.num_staff_in_delivery || 0);
    const [numStaffTrainedInEenc, setNumStaffTrainedInEenc] = useState(initialData?.num_staff_trained_in_eenc || 0);
    const [hasKangaroo, setHasKangaroo] = useState(initialData?.has_kangaroo_room || false);

    const isInitialLoad = useRef(true);
    const facilitySelectRef = useRef();

    // Effect to fetch facilities
    useEffect(() => {
        const fetchFacilities = async () => {
            setError('');
            if (state && locality) {
                setIsLoadingFacilities(true);
                try {
                    const facilities = await listHealthFacilities({ state, locality });
                    setFacilitiesInLocality(facilities);
                    // If editing, try to re-select the facility after fetch
                    if (initialData?.facilityId) {
                         const matchedFacility = facilities.find(f => f.id === initialData.facilityId);
                         if(matchedFacility){
                             setSelectedFacility(matchedFacility);
                             setCenter(matchedFacility['اسم_المؤسسة']);
                         } else if (initialData.center_name) {
                             // Keep name if ID not found (might be pending or manually entered)
                             setCenter(initialData.center_name);
                             setSelectedFacility(null);
                         }
                    } else if (initialData?.center_name) {
                         // If only name exists initially, try to match it
                         const matchedFacility = facilities.find(f => f['اسم_المؤسسة'] === initialData.center_name);
                          if(matchedFacility){
                             setSelectedFacility(matchedFacility);
                             setCenter(matchedFacility['اسم_المؤسسة']);
                         } else {
                             // Keep name if no match
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
                    isInitialLoad.current = false; // Mark initial load attempt as done
                }
            } else {
                setFacilitiesInLocality([]);
                 isInitialLoad.current = false; // Mark as done even if no state/locality
            }
        };
        // Only fetch if state and locality are set
        if (state && locality) {
             fetchFacilities();
        } else {
             setFacilitiesInLocality([]); // Clear list if state/locality not set
             setIsLoadingFacilities(false);
             isInitialLoad.current = false;
        }

    }, [state, locality, initialData?.facilityId, initialData?.center_name]); // Re-run if initial data changes too


    // Handle Facility Selection or "Add New"
    const handleFacilitySelect = (facilityIdOrAction) => {
        setError('');
        if (facilityIdOrAction === 'addNewFacility') {
            setNewFacilityNameSuggestion(''); // Can potentially prefill later
            setIsAddFacilityModalOpen(true);
            return;
        }

        const facility = facilitiesInLocality.find(f => f.id === facilityIdOrAction);
        setSelectedFacility(facility || null);
        setCenter(facility ? facility['اسم_المؤسسة'] : '');

        // Reset participant details
        setIsEditingExistingWorker(false);
        setName('');
        setJob('');
        setOtherJobTitle('');
        setPhone('');
        setEmail('');

        // Reset service-specific fields based on selected facility (or clear them)
        if (isImnci) {
            if (facility) {
                 setFacilityType(facility['نوع_المؤسسةالصحية'] || '');
                 setHasNutri(facility.nutrition_center_exists === 'Yes');
                 setNearestNutri(facility.nearest_nutrition_center || '');
                 setHasImm(facility.immunization_office_exists === 'Yes');
                 setNearestImm(facility.nearest_immunization_center || '');
                 setHasORS(facility['غرفة_إرواء'] === 'Yes');
                 setNumProv(facility['العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين'] || 1);
                 setNumProvIMNCI(facility['العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل'] || 0);
                 setHasWeightScale(facility['ميزان_وزن'] === 'Yes');
                 setHasHeightScale(facility['ميزان_طول'] === 'Yes');
                 setHasThermometer(facility['ميزان_حرارة'] === 'Yes');
                 setHasTimer(facility['ساعة_مؤقت'] === 'Yes');
                 setHasGrowthMonitoring(facility.growth_monitoring_service_exists === 'Yes');
                 setTrainedIMNCI('no');
                 setLastTrainIMNCI('');
            } else {
                 setFacilityType('');
                 setHasNutri(false); setNearestNutri('');
                 setHasImm(false); setNearestImm('');
                 setHasORS(false);
                 setNumProv(1); setNumProvIMNCI(0);
                 setHasWeightScale(false); setHasHeightScale(false); setHasThermometer(false); setHasTimer(false); setHasGrowthMonitoring(false);
                 setTrainedIMNCI('no'); setLastTrainIMNCI('');
            }
        }
        // Add similar resets for ETAT/EENC if needed
    };

     // Callback when AddFacilityModal saves successfully
     const handleNewFacilitySaved = (newlySubmittedFacilityData) => {
        const representation = {
            id: newlySubmittedFacilityData.id, // Use temporary ID
            'اسم_المؤسسة': newlySubmittedFacilityData['اسم_المؤسسة'],
            'الولاية': newlySubmittedFacilityData['الولاية'],
            'المحلية': newlySubmittedFacilityData['المحلية'],
             ...newlySubmittedFacilityData // Include other data submitted
        };
        // Add representation to the current list
        setFacilitiesInLocality(prev => [...prev, representation]);
        // Automatically select the new representation
        handleFacilitySelect(representation.id);
        // Modal is closed by AddFacilityModal itself
    };


    // Handle selecting an existing staff member or triggering "Add New" participant form
    const handleHealthWorkerSelect = (worker) => {
        if (!worker) {
            setIsEditingExistingWorker(false);
            setShowNewParticipantForm(true); // Open the participant detail popup
        } else {
            setIsEditingExistingWorker(true);
            setName(worker.name || '');
            const staffJob = worker.job_title || '';
            if (jobTitleOptions.includes(staffJob)) {
                setJob(staffJob); setOtherJobTitle('');
            } else {
                setJob('Other'); setOtherJobTitle(staffJob);
            }
            setPhone(worker.phone || '');
            if (isImnci) {
                setTrainedIMNCI(String(worker.is_trained || '').trim().toLowerCase() === 'yes' ? 'yes' : 'no');
                setLastTrainIMNCI(worker.training_date || '');
            }
            // Add ETAT/EENC logic if needed
        }
    };

    // Callback when the NewParticipantForm popup saves
    const handleSaveNewParticipant = (newParticipantData) => {
        setName(newParticipantData.name);
        setPhone(newParticipantData.phone);
        if (jobTitleOptions.includes(newParticipantData.job_title)) {
            setJob(newParticipantData.job_title); setOtherJobTitle('');
        } else {
            setJob('Other'); setOtherJobTitle(newParticipantData.job_title);
        }
        setIsEditingExistingWorker(false); // Ensure we treat this as a new participant for the main form
        setShowNewParticipantForm(false); // Close the popup
    };

    // Determine professional category (keep existing)
    const professionalCategory = useMemo(() => {
        const lowerCaseJob = (job === 'Other' ? otherJobTitle : job).toLowerCase();
        if (lowerCaseJob.includes('doctor') || lowerCaseJob.includes('طبيب')) return 'doctor';
        if (lowerCaseJob.includes('nurse') || lowerCaseJob.includes('ممرض')) return 'nurse';
        if (lowerCaseJob.includes('midwife') || lowerCaseJob.includes('قابلة')) return 'midwife';
        if (lowerCaseJob.includes('assistant') || lowerCaseJob.includes('مساعد')) return 'assistant';
        return 'provider';
     }, [job, otherJobTitle]);

    // Submit Participant Data
    const submit = () => {
        setError('');
        const finalJobTitle = job === 'Other' ? otherJobTitle : job;

        // Validation
        if (!name.trim()) { setError('Participant Name is required.'); return; }
        if (!state) { setError('State is required.'); return; }
        if (!locality) { setError('Locality is required.'); return; }
        if (!center.trim()) { setError('Health Facility Name is required.'); return; }
        if (!finalJobTitle) { setError('Job Title is required.'); return; }
        if (!phone.trim()) { setError('Phone Number is required.'); return; }

        let p = {
            name: name.trim(), group, state, locality,
            center_name: center.trim(),
            facilityId: selectedFacility?.id.startsWith('pending_') ? null : selectedFacility?.id || null, // Don't save pending IDs
            job_title: finalJobTitle, phone: phone.trim(), email: email ? email.trim() : null
        };

        if (showTestScores) {
            p = { ...p, pre_test_score: preTestScore || null, post_test_score: postTestScore || null };
        }

        // Add service-specific data and perform validation
        if (isImnci) {
            if (!imciSubType) { setError('IMCI Course Sub-type is required.'); return; }
            const currentFacilityType = facilityType || selectedFacility?.['نوع_المؤسسةالصحية'];
            if (!currentFacilityType) { setError('Facility Type is required.'); return; }
            if (numProv === null || numProv < 1) { setError('Number of providers must be 1 or more.'); return; }
            if (numProvIMNCI === null || numProvIMNCI < 0) { setError('Number of trained providers cannot be negative.'); return; }
            p = { ...p, imci_sub_type: imciSubType, facility_type: currentFacilityType, trained_before: trainedIMNCI === 'yes', last_imci_training: trainedIMNCI === 'yes' ? (lastTrainIMNCI || null) : null, num_other_providers: numProv, num_other_providers_imci: numProvIMNCI, has_nutrition_service: hasNutri, has_immunization_service: hasImm, has_ors_room: hasORS, nearest_nutrition_center: !hasNutri ? (nearestNutri || null) : null, nearest_immunization_center: !hasImm ? (nearestImm || null) : null, has_growth_monitoring: hasGrowthMonitoring };
        } else if (isEtat) {
            if (!hospitalTypeEtat) { setError('Hospital Type is required for ETAT.'); return; }
            p = { ...p, hospital_type: hospitalTypeEtat, trained_etat_before: trainedEtat === 'yes', last_etat_training: trainedEtat === 'yes' ? (lastTrainEtat || null) : null, has_triage_system: hasTriageSystem, has_stabilization_center: hasStabilizationCenter, has_hdu: hasHdu, num_staff_in_er: numStaffInEr || 0, num_staff_trained_in_etat: numStaffTrainedInEtat || 0 };
        } else if (isEenc) {
            if (!hospitalTypeEenc) { setError('Hospital Type is required for EENC.'); return; }
            if (hospitalTypeEenc === 'other' && !otherHospitalTypeEenc) { setError('Please specify the Hospital Type for EENC.'); return; }
            p = { ...p, hospital_type: hospitalTypeEenc === 'other' ? otherHospitalTypeEenc : hospitalTypeEenc, trained_eenc_before: trainedEENC === 'yes', last_eenc_training: trainedEENC === 'yes' ? (lastTrainEENC || null) : null, has_sncu: hasSncu, has_iycf_center: hasIycfCenter, num_staff_in_delivery: numStaffInDelivery || 0, num_staff_trained_in_eenc: numStaffTrainedInEenc || 0, has_kangaroo_room: hasKangaroo };
        }

        // Facility Update Payload Generation
        let facilityUpdatePayload = null;
        // Only trigger if IMNCI, a *real* facility is selected, and it's not a pending one
        if (isImnci && selectedFacility && !selectedFacility.id.startsWith('pending_')) {
            const staffMemberData = { name: name.trim(), job_title: finalJobTitle, phone: phone.trim(), is_trained: 'Yes', training_date: course.start_date || '' };
            let existingStaff = [];
             try {
                 existingStaff = selectedFacility.imnci_staff ? (typeof selectedFacility.imnci_staff === 'string' ? JSON.parse(selectedFacility.imnci_staff) : JSON.parse(JSON.stringify(selectedFacility.imnci_staff))) : [];
                if (!Array.isArray(existingStaff)) existingStaff = [];
            } catch (e) { console.error("Error parsing staff list:", e); existingStaff = []; }

            let updatedStaffList = [...existingStaff];
            const existingIndex = updatedStaffList.findIndex(staff => staff.name === staffMemberData.name || (staff.phone && staff.phone === staffMemberData.phone));
            if (existingIndex > -1) updatedStaffList[existingIndex] = staffMemberData; else updatedStaffList.push(staffMemberData);

            // --- MODIFICATION START ---
            // Check if the facility was already marked as providing IMNCI service
            const facilityHadImnci = selectedFacility['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes';
            if (!facilityHadImnci) {
                // If not, mark this participant as being the one who introduced it (for reporting)
                p.introduced_imci_to_facility = true;
            }
            // --- MODIFICATION END ---

            const baseFacilityPayload = {
                'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes', // Ensure IMNCI service is set to 'Yes'
                'نوع_المؤسسةالصحية': facilityType || selectedFacility['نوع_المؤسسةالصحية'] || 'no data',
                'nutrition_center_exists': hasNutri ? 'Yes' : 'No', 'nearest_nutrition_center': !hasNutri ? (nearestNutri || selectedFacility.nearest_nutrition_center || '') : '',
                'immunization_office_exists': hasImm ? 'Yes' : 'No', 'nearest_immunization_center': !hasImm ? (nearestImm || selectedFacility.nearest_immunization_center || '') : '',
                'غرفة_إرواء': hasORS ? 'Yes' : 'No', 'growth_monitoring_service_exists': hasGrowthMonitoring ? 'Yes' : 'No',
                'العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين': numProv ?? selectedFacility['العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين'] ?? updatedStaffList.length,
                'العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل': numProvIMNCI ?? selectedFacility['العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل'] ?? updatedStaffList.filter(s => s.is_trained === 'Yes').length,
                'ميزان_وزن': hasWeightScale ? 'Yes' : 'No', 'ميزان_طول': hasHeightScale ? 'Yes' : 'No', 'ميزان_حرارة': hasThermometer ? 'Yes' : 'No', 'ساعة_مؤقت': hasTimer ? 'Yes' : 'No',
            };

            facilityUpdatePayload = { ...selectedFacility, ...baseFacilityPayload, id: selectedFacility.id, date_of_visit: new Date().toISOString().split('T')[0], imnci_staff: updatedStaffList };
        }

        // Pass participant data and potential facility update payload to parent
        onSave(p, facilityUpdatePayload);
    };

    // Prepare options for the facility select, including "Add New"
    const facilityOptionsForSelect = useMemo(() => {
        const options = (facilitiesInLocality || []).map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }));
        options.unshift({ id: 'addNewFacility', name: "+ Add New Facility..." });
        return options;
    }, [facilitiesInLocality]);

    // Render logic
    return (
        <>
            <AddFacilityModal
                isOpen={isAddFacilityModalOpen}
                onClose={() => setIsAddFacilityModalOpen(false)}
                onSaveSuccess={handleNewFacilitySaved}
                initialState={state}
                initialLocality={locality}
                initialName={newFacilityNameSuggestion}
                setToast={setError} // Use setError as a simple toast mechanism here
            />

             {/* Conditionally render the NewParticipantForm as a Modal */}
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
                                setLocality(''); // Reset locality
                                setCenter(''); // Reset facility name
                                setSelectedFacility(null); // Clear selected facility object
                                setFacilitiesInLocality([]); // Clear facility list
                             }}>
                                <option value="">— Select State —</option>
                                {Object.keys(STATE_LOCALITIES).sort((a,b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}
                            </Select>
                        </FormGroup>

                        {/* Locality */}
                        <FormGroup label="Locality">
                            <Select value={locality} onChange={(e) => {
                                setLocality(e.target.value);
                                setCenter(''); // Reset facility name
                                setSelectedFacility(null); // Clear selected facility object
                            }} disabled={!state}>
                                <option value="">— Select Locality —</option>
                                {(STATE_LOCALITIES[state]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                            </Select>
                        </FormGroup>

                        {/* Facility Name */}
                        <FormGroup label={isEtat ? "Hospital Name" : "Health Facility Name"}>
                            <SearchableSelect
                                value={selectedFacility?.id || ''}
                                onChange={handleFacilitySelect}
                                options={facilityOptionsForSelect}
                                placeholder={isLoadingFacilities ? "Loading..." : (!locality ? "Select Locality first" : "Search or Add New Facility...")}
                                disabled={isLoadingFacilities || !locality}
                            />
                        </FormGroup>

                        {/* Participant Name */}
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
                                disabled={!selectedFacility || selectedFacility.id.startsWith('pending_')} // Disable if pending facility selected
                            />
                             {isEditingExistingWorker && <p className="text-sm text-blue-600 mt-1">Editing staff member info.</p>}
                             {!selectedFacility && !isLoadingFacilities && locality && <p className="text-sm text-orange-600 mt-1">Select or add a facility to search existing staff.</p>}
                        </FormGroup>

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

                        {/* --- Service Specific Sections --- */}
                        {isImnci && (<>
                            <FormGroup label="IMCI Course Sub-type">
                                <Select value={imciSubType} onChange={(e) => setImciSubType(e.target.value)}>
                                    {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                </Select>
                            </FormGroup>
                            <FormGroup label="Facility Type">
                                <Select value={facilityType} onChange={(e) => setFacilityType(e.target.value)} disabled={!!selectedFacility /* Disable if facility selected, let it auto-fill */}>
                                     <option value="">— Select Type —</option>
                                     <option value="مركز صحة الاسرة">مركز صحة الاسرة</option>
                                     <option value="مستشفى ريفي">مستشفى ريفي</option>
                                     <option value="وحدة صحة الاسرة">وحدة صحة الاسرة</option>
                                     <option value="مستشفى">مستشفى</option>
                                </Select>
                            </FormGroup>
                            <FormGroup label="Previously trained in IMNCI?">
                                <Select value={trainedIMNCI} onChange={(e) => setTrainedIMNCI(e.target.value)} disabled={isEditingExistingWorker}>
                                    <option value="no">No</option><option value="yes">Yes</option>
                                </Select>
                            </FormGroup>
                            {trainedIMNCI === 'yes' && <FormGroup label="Date of last training"><Input type="date" value={lastTrainIMNCI} onChange={(e) => setLastTrainIMNCI(e.target.value)} disabled={isEditingExistingWorker}/></FormGroup>}
                            <FormGroup label="Total Providers at Facility (incl. this participant)">
                                <Input type="number" min="1" value={numProv} onChange={(e) => setNumProv(Number(e.target.value || 1))} />
                            </FormGroup>
                            <FormGroup label="IMCI Trained Providers at Facility (excl. current course)">
                                <Input type="number" min="0" value={numProvIMNCI} onChange={(e) => setNumProvIMNCI(Number(e.target.value || 0))} />
                            </FormGroup>

                            {/* Facility Services Sub-section */}
                            <div className="md:col-span-2 lg:col-span-3 my-4 p-4 border rounded-md bg-gray-50">
                                <h3 className="text-lg font-semibold mb-3 border-b pb-2">Facility Services & Equipment (IMNCI Related)</h3>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <FormGroup label="Has therapeutic nutrition service?"><Select value={hasNutri ? 'yes' : 'no'} onChange={e => setHasNutri(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                    {!hasNutri && <FormGroup label="Nearest therapeutic nutrition center?"><Input value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} /></FormGroup>}
                                    <FormGroup label="Has immunization service?"><Select value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                    {!hasImm && <FormGroup label="Nearest immunization center?"><Input value={nearestImm} onChange={e => setNearestImm(e.target.value)} /></FormGroup>}
                                    <FormGroup label="Has ORS corner service?"><Select value={hasORS ? 'yes' : 'no'} onChange={e => setHasORS(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                    <FormGroup label="Growth Monitoring Service"><Select value={hasGrowthMonitoring ? 'yes' : 'no'} onChange={e => setHasGrowthMonitoring(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                    <FormGroup label="Weighting scale"><Select value={hasWeightScale ? 'yes' : 'no'} onChange={e => setHasWeightScale(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                    <FormGroup label="Height scale"><Select value={hasHeightScale ? 'yes' : 'no'} onChange={e => setHasHeightScale(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                    <FormGroup label="Thermometer"><Select value={hasThermometer ? 'yes' : 'no'} onChange={e => setHasThermometer(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                    <FormGroup label="Timer"><Select value={hasTimer ? 'yes' : 'no'} onChange={e => setHasTimer(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                </div>
                            </div>
                        </>)}

                         {isEtat && (<>
                             <FormGroup label="Hospital Type"><Select value={hospitalTypeEtat} onChange={e => setHospitalTypeEtat(e.target.value)}><option value="">— Select Type —</option><option>Pediatric Hospital</option><option>Pediatric Department in General Hospital</option><option>Rural Hospital</option><option>other</option></Select></FormGroup>
                             <FormGroup label="Previously trained on ETAT?"><Select value={trainedEtat} onChange={e => setTrainedEtat(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                             {trainedEtat === 'yes' && <FormGroup label="Date of last ETAT training"><Input type="date" value={lastTrainEtat} onChange={(e) => setLastTrainEtat(e.target.value)} /></FormGroup>}
                             <FormGroup label="Has Triage System?"><Select value={hasTriageSystem ? 'yes' : 'no'} onChange={e => setHasTriageSystem(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                             <FormGroup label="Has Malnutrition Stabilization Center?"><Select value={hasStabilizationCenter ? 'yes' : 'no'} onChange={e => setHasStabilizationCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                             <FormGroup label="Has High Dependency Unit (HDU)?"><Select value={hasHdu ? 'yes' : 'no'} onChange={e => setHasHdu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                             <FormGroup label={`# ${professionalCategory}s in ER`}><Input type="number" min="0" value={numStaffInEr} onChange={e => setNumStaffInEr(Number(e.target.value || 0))} /></FormGroup>
                             <FormGroup label={`# ${professionalCategory}s trained in ETAT`}><Input type="number" min="0" value={numStaffTrainedInEtat} onChange={e => setNumStaffTrainedInEtat(Number(e.target.value || 0))} /></FormGroup>
                        </>)}

                         {isEenc && (<>
                            <FormGroup label="Hospital Type"><Select value={hospitalTypeEenc} onChange={e => setHospitalTypeEenc(e.target.value)}><option value="">— Select Type —</option><option>Comprehensive EmONC</option><option>Basic EmONC</option><option value="other">Other (specify)</option></Select></FormGroup>
                            {hospitalTypeEenc === 'other' && <FormGroup label="Specify Hospital Type"><Input value={otherHospitalTypeEenc} onChange={e => setOtherHospitalTypeEenc(e.target.value)} /></FormGroup>}
                            <FormGroup label="Previously trained on EENC?"><Select value={trainedEENC} onChange={e => setTrainedEENC(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                            {trainedEENC === 'yes' && <FormGroup label="Date of last EENC training"><Input type="date" value={lastTrainEENC} onChange={(e) => setLastTrainEENC(e.target.value)} /></FormGroup>}
                            <FormGroup label="Has Special Newborn Care Unit (SNCU)?"><Select value={hasSncu ? 'yes' : 'no'} onChange={e => setHasSncu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                            <FormGroup label="Has IYCF Center?"><Select value={hasIycfCenter ? 'yes' : 'no'} onChange={e => setHasIycfCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                            <FormGroup label="Has Kangaroo Care Room?"><Select value={hasKangaroo ? 'yes' : 'no'} onChange={e => setHasKangaroo(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                            <FormGroup label={`# ${professionalCategory}s in Delivery Room`}><Input type="number" min="0" value={numStaffInDelivery} onChange={e => setNumStaffInDelivery(Number(e.target.value || 0))} /></FormGroup>
                            <FormGroup label={`# ${professionalCategory}s trained in EENC`}><Input type="number" min="0" value={numStaffTrainedInEenc} onChange={e => setNumStaffTrainedInEenc(Number(e.target.value || 0))} /></FormGroup>
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