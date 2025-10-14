// Participants.jsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
    Card, PageHeader, Button, FormGroup, Input, Select, Textarea, Table, EmptyState, Modal, Spinner
} from "./CommonComponents";
import {
    STATE_LOCALITIES, IMNCI_SUBCOURSE_TYPES, JOB_TITLES_ETAT, JOB_TITLES_EENC
} from './constants.js';
import { listHealthFacilities, importParticipants, bulkMigrateFromMappings } from '../data.js';

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
                
                // Process only if the value exists (is not null, undefined, or an empty string)
                if (value) {
                    // If the value is not in the set of standard values, it's a mismatch.
                    if (!standardValuesSet.has(value)) {
                        values.add(value);
                    }
                }
            });
            
            setNonStandardValues(Array.from(values).sort());
            setMappings({}); // Reset mappings when field changes
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
        
        // Find all participants who have a value that is in our mapping keys
        const participantsToUpdate = participants
            .filter(p => {
                const originalValue = p[selectedFieldKey];
                return originalValue !== null && originalValue !== undefined && Object.keys(mappings).includes(String(originalValue));
            })
            .map(p => ({
                ...p, // keep all original data
                id: p.id, // ensure id is present for update
                [selectedFieldKey]: mappings[String(p[selectedFieldKey])] // apply the fix
            }));

        try {
            await onSave(participantsToUpdate);
        } catch (error) {
            console.error("Failed to update participants:", error);
            // Optionally show a toast/error message to the user
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
    
    // Define which fields can be bulk-changed
    const CHANGEABLE_FIELDS_CONFIG = useMemo(() => ({
        'job_title': {
            label: 'Job Title',
            options: jobTitleOptions,
        },
        'group': {
            label: 'Group',
            options: ['Group A', 'Group B', 'Group C', 'Group D'],
        },
        // Add other fields here if needed, e.g., 'state', 'locality'
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
            return; // Add user feedback if desired
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

// --- Participant Migration Mapping View ---
export function ParticipantMigrationMappingView({ course, participants, onCancel, onSave, setToast }) {
    const [mappings, setMappings] = useState({});
    const [facilityOptions, setFacilityOptions] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [previewData, setPreviewData] = useState(null);

    const allFacilitiesRef = useRef([]);

    useEffect(() => {
        const fetchAndInitialize = async () => {
            setIsLoading(true);
            try {
                allFacilitiesRef.current = await listHealthFacilities();
                const initialMappings = {};
                
                for (const p of participants) {
                    const pState = p.state?.trim();
                    const pLocality = p.locality?.trim();
                    const pCenterName = p.center_name?.toLowerCase().trim();

                    // Get the canonical Arabic names for the participant's state and locality for a robust comparison
                    const participantStateAr = STATE_LOCALITIES[pState]?.ar?.trim();
                    
                    let participantLocalityAr = '';
                    const stateData = STATE_LOCALITIES[pState];
                    if (stateData && pLocality) {
                        // Attempt to find the locality by matching the English key first, then the Arabic name.
                        let localityInfo = stateData.localities.find(l => l.en?.trim() === pLocality);
                        if (!localityInfo) {
                           localityInfo = stateData.localities.find(l => l.ar?.trim() === pLocality);
                        }
                        if (localityInfo) {
                            participantLocalityAr = localityInfo.ar?.trim();
                        }
                    }

                    const matchedFacility = allFacilitiesRef.current.find(f =>
                        f['الولاية']?.trim() === participantStateAr &&
                        f['المحلية']?.trim() === participantLocalityAr &&
                        f['اسم_المؤسسة']?.toLowerCase().trim() === pCenterName
                    );

                    let status = 'unmatched';
                    if (matchedFacility) {
                        const staffList = matchedFacility.imnci_staff || [];
                        const participantExistsInStaff = staffList.some(
                            staff => staff.name?.toLowerCase().trim() === p.name?.toLowerCase().trim()
                        );
                        
                        if (participantExistsInStaff) {
                            status = 'perfect-match';
                        } else {
                            status = 'auto-matched';
                        }
                    }

                    initialMappings[p.id] = {
                        targetState: p.state || '',
                        targetLocality: p.locality || '',
                        targetFacilityId: matchedFacility ? matchedFacility.id : '',
                        status: status,
                    };
                }
                setMappings(initialMappings);

                const facilityPromises = participants.map(p => {
                    const mapping = initialMappings[p.id];
                    if (mapping.targetState && mapping.targetLocality) {
                        return listHealthFacilities({ state: mapping.targetState, locality: mapping.targetLocality })
                            .then(facilities => ({ participantId: p.id, facilities }));
                    }
                    return Promise.resolve(null);
                });

                const results = await Promise.all(facilityPromises);
                const initialFacilityOptions = {};
                results.forEach(result => {
                    if (result) {
                        initialFacilityOptions[result.participantId] = result.facilities;
                    }
                });
                setFacilityOptions(initialFacilityOptions);

            } catch (err) {
                setToast({ show: true, message: 'Failed to load initial migration data.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndInitialize();
    }, [participants, setToast]);

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
        
        // When a user manually changes something, the status is no longer auto-determined
        if (field === 'targetState' || field === 'targetLocality' || field === 'targetFacilityId') {
            newMappings[pId].status = 'manual-selection';
        }

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

    const createPayload = () => {
        return Object.entries(mappings)
            .filter(([, mapping]) => mapping.targetFacilityId)
            .map(([participantId, mapping]) => {
                const targetFacility = allFacilitiesRef.current.find(f => f.id === mapping.targetFacilityId);
                return {
                    participantId,
                    targetFacilityId: mapping.targetFacilityId,
                    targetState: mapping.targetState,
                    targetLocality: mapping.targetLocality,
                    targetFacilityName: targetFacility ? targetFacility['اسم_المؤسسة'] : '',
                };
            });
    };

    const handlePreview = async () => {
        setIsSaving(true);
        const validMappings = createPayload();

        if (validMappings.length === 0) {
            setToast({ show: true, message: 'No participants have been mapped to a facility.', type: 'info' });
            setIsSaving(false);
            return;
        }

        try {
            const result = await bulkMigrateFromMappings(validMappings, { dryRun: true });
            setPreviewData(result);
        } catch (err) {
            setToast({ show: true, message: `Preview failed: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExecute = async () => {
        setIsSaving(true);
        const validMappings = createPayload();
        try {
            await onSave(validMappings);
        } catch (err) {
            // Error toast is handled in parent component
        } finally {
            setIsSaving(false);
        }
    };
    
    const StatusBadge = ({ status }) => {
        switch (status) {
            case 'perfect-match':
                return <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">Perfect Match</span>;
            case 'auto-matched':
                return <span className="px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">Facility Matched</span>;
            case 'manual-selection':
                 return <span className="px-2 py-1 text-xs font-medium text-gray-800 bg-gray-200 rounded-full">Manual</span>;
            case 'unmatched':
            default:
                return null;
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
                <p className="mb-4 text-sm text-gray-600">For each participant, select the target State, Locality, and existing Health Facility. The system will attempt to auto-match and will indicate if the participant already exists at the matched facility.</p>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
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
                                
                                let rowClass = '';
                                if (mapping.status === 'perfect-match') rowClass = 'bg-green-50';
                                if (mapping.status === 'auto-matched') rowClass = 'bg-blue-50';

                                return (
                                    <tr key={p.id} className={rowClass}>
                                        <td className="px-4 py-2 whitespace-nowrap"><StatusBadge status={mapping.status} /></td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{p.center_name}</td>
                                        <td className="px-4 py-2"><Select value={mapping.targetState} onChange={e => handleMappingChange(p.id, 'targetState', e.target.value)}><option value="">- State -</option>{Object.keys(STATE_LOCALITIES).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}</Select></td>
                                        <td className="px-4 py-2"><Select value={mapping.targetLocality} onChange={e => handleMappingChange(p.id, 'targetLocality', e.target.value)} disabled={!mapping.targetState}><option value="">- Locality -</option>{(STATE_LOCALITIES[mapping.targetState]?.localities || []).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}</Select></td>
                                        <td className="px-4 py-2">
                                            <SearchableSelect
                                                value={mapping.targetFacilityId}
                                                onChange={(facilityId) => handleMappingChange(p.id, 'targetFacilityId', facilityId)}
                                                options={(facilityOptions[p.id] || []).map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }))}
                                                placeholder="- Type to search for a facility -"
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {previewData && (
                    <div className="mt-6 p-4 border-l-4 border-blue-500 bg-blue-50">
                        <h3 className="font-bold text-lg text-blue-800">Migration Preview</h3>
                        <p className="text-sm text-blue-700 mt-2">The migration will affect <strong>{previewData.previewPayloads.length}</strong> participant record(s). Participant data (like State and Locality) will be updated, and they will be added to the staff list of their new target facility.</p>
                        <ul className="list-disc list-inside mt-2 max-h-48 overflow-y-auto text-sm">
                            {previewData.previewPayloads.map(payload => {
                                const participant = participants.find(p => p.id === payload.participantId);
                                const facility = allFacilitiesRef.current.find(f => f.id === payload.targetFacilityId);
                                return (
                                     <li key={payload.participantId}><strong>{participant?.name}</strong> will be migrated to <strong>{facility?.['اسم_المؤسسة']}</strong>.</li>
                                );
                            })}
                        </ul>
                    </div>
                )}
                
                <div className="flex gap-2 justify-end mt-6 border-t pt-6">
                    <Button variant="secondary" onClick={onCancel} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handlePreview} disabled={isSaving || previewData}>
                        {isSaving ? <Spinner/> : 'Preview Changes'}
                    </Button>
                    <Button onClick={handleExecute} disabled={isSaving || !previewData}>
                        {isSaving && previewData ? <Spinner/> : 'Confirm & Submit for Approval'}
                    </Button>
                </div>
            </div>
        </Card>
    );
}

export function ParticipantsView({ course, participants, allParticipants, onAdd, onOpen, onEdit, onDelete, onOpenReport, onImport, onBatchUpdate, canAddParticipant, canBulkUploadParticipant, onBulkMigrate }) {
    const [groupFilter, setGroupFilter] = useState('All');
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
    const [isBulkChangeModalOpen, setIsBulkChangeModalOpen] = useState(false);
    const filtered = groupFilter === 'All' ? participants : participants.filter(p => p.group === groupFilter);

    const handleSaveCleanup = async (participantsToUpdate) => {
        if (!participantsToUpdate || participantsToUpdate.length === 0) return;
        try {
            // The importParticipants function can be used for bulk updates
            await importParticipants(participantsToUpdate);
            onBatchUpdate(); // This should trigger a refresh of the participant list
        } catch (err) {
            console.error("Cleanup failed", err);
            // Optionally, set a toast message for the user
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
                onSave={handleSaveCleanup} // Re-use the same save/refresh handler
                courseType={course.course_type}
            />


            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <div className="flex flex-wrap gap-2">
                    {canAddParticipant && (
                        <Button onClick={onAdd}>Add Participant</Button>
                    )}
                    {canBulkUploadParticipant && (
                        <>
                            <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                                Import from Excel
                            </Button>
                             <Button variant="secondary" onClick={() => setIsCleanupModalOpen(true)}>
                                Clean Data
                            </Button>
                            <Button variant="secondary" onClick={() => setIsBulkChangeModalOpen(true)}>
                                Bulk Change
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => onBulkMigrate(course.id)}
                                disabled={!participants || participants.length === 0}
                                title={(!participants || participants.length === 0) ? "No participants to migrate" : "Update facility records based on these participants"}
                            >
                                Bulk Migrate to Facilities
                            </Button>
                        </>
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

            <div className="hidden md:block">
                <Table headers={["Name", "Group", "Job Title", "Actions"]}>
                    {filtered.length === 0 ? <EmptyState message="No participants found for this group." /> : filtered.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="p-4 border border-gray-200 font-medium text-gray-800">{p.name}</td>
                            <td className="p-4 border border-gray-200">{p.group}</td>
                            <td className="p-4 border border-gray-200">{p.job_title}</td>
                            <td className="p-4 border border-gray-200 text-right">
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <Button variant="primary" onClick={() => onOpen(p.id)}>Monitor</Button>
                                    <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                    <Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button>
                                    <Button variant="danger" onClick={() => onDelete(p.id)}>Delete</Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>

            <div className="md:hidden grid gap-4">
                {filtered.length === 0 ? (
                    <p className="py-12 text-center text-gray-500">No participants found for this group.</p>
                ) : (
                    filtered.map(p => (
                        <div key={p.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                                    <p className="text-gray-600">{p.job_title}</p>
                                    <p className="text-sm text-gray-500 mt-1">Group: <span className="font-medium text-gray-700">{p.group}</span></p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
                                <Button variant="secondary" onClick={() => onOpen(p.id)}>Monitor</Button>
                                <Button variant="secondary" onClick={() => onOpenReport(p.id)}>Report</Button>
                                <Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button>
                                <Button variant="danger" onClick={() => onDelete(p.id)}>Delete</Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}


// --- Searchable and Creatable Name Input Component ---
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
        return options.filter(opt => opt.name.toLowerCase().includes(value.toLowerCase()));
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
                                key={index}
                                className="p-2 cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSelect(opt)}
                            >
                                {opt.name} ({opt.job_title})
                            </div>
                        ))
                    ) : (
                        <div className="p-2 text-gray-500">No existing staff found.</div>
                    )}
                </div>
            )}
        </div>
    );
};


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
    const [state, setState] = useState(initialData?.state || '');
    const [locality, setLocality] = useState(initialData?.locality || '');
    const [center, setCenter] = useState(initialData?.center_name || '');
    const [phone, setPhone] = useState(initialData?.phone || '');
    const [group, setGroup] = useState(initialData?.group || 'Group A');
    const [error, setError] = useState('');
    const [preTestScore, setPreTestScore] = useState(initialData?.pre_test_score || '');
    const [postTestScore, setPostTestScore] = useState(initialData?.post_test_score || '');
    
    // Facility Related States
    const [facilitiesInLocality, setFacilitiesInLocality] = useState([]);
    const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
    const [selectedFacility, setSelectedFacility] = useState(null);
    const [isManualFacility, setIsManualFacility] = useState(false);
    const [isEditingExistingWorker, setIsEditingExistingWorker] = useState(false);

    const initialJobTitle = initialData?.job_title || '';
    const isInitialJobOther = initialJobTitle && !jobTitleOptions.includes(initialJobTitle);
    const [job, setJob] = useState(isInitialJobOther ? 'Other' : initialJobTitle);
    const [otherJobTitle, setOtherJobTitle] = useState(isInitialJobOther ? initialJobTitle : '');

    // IMNCI Specific States
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
    
    // ETAT Specific States
    const [hospitalTypeEtat, setHospitalTypeEtat] = useState(initialData?.hospital_type || '');
    const [trainedEtat, setTrainedEtat] = useState(initialData?.trained_etat_before ? 'yes' : 'no');
    const [lastTrainEtat, setLastTrainEtat] = useState(initialData?.last_etat_training || '');
    const [hasTriageSystem, setHasTriageSystem] = useState(initialData?.has_triage_system || false);
    const [hasStabilizationCenter, setHasStabilizationCenter] = useState(initialData?.has_stabilization_center || false);
    const [hasHdu, setHasHdu] = useState(initialData?.has_hdu || false);
    const [numStaffInEr, setNumStaffInEr] = useState(initialData?.num_staff_in_er || 0);
    const [numStaffTrainedInEtat, setNumStaffTrainedInEtat] = useState(initialData?.num_staff_trained_in_etat || 0);

    // EENC Specific States
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

    // Effect to fetch facilities when state or locality changes
    useEffect(() => {
        const fetchFacilities = async () => {
            if (state && locality) {
                setIsLoadingFacilities(true);
                try {
                    const facilities = await listHealthFacilities({ state, locality });
                    setFacilitiesInLocality(facilities);
                } catch (err) {
                    setError("Failed to load health facilities for this location.");
                } finally {
                    setIsLoadingFacilities(false);
                }
            } else {
                setFacilitiesInLocality([]);
            }
        };
        fetchFacilities();
    }, [state, locality]);

    // Effect to set the initial facility selection after facilities have loaded
    useEffect(() => {
        if (facilitiesInLocality.length > 0 && initialData?.center_name && isInitialLoad.current) {
            const matchedFacility = facilitiesInLocality.find(
                fac => fac['اسم_المؤسسة'] === initialData.center_name
            );

            if (matchedFacility) {
                setSelectedFacility(matchedFacility);
                setIsManualFacility(false);
            } else {
                // Facility name from initialData is not in the fetched list, so enable manual mode
                setIsManualFacility(true);
            }
            // Prevent this logic from running again after the initial setup
            isInitialLoad.current = false;
        }
    }, [facilitiesInLocality, initialData]);

    const handleFacilitySelect = (facilityId) => {
        setIsManualFacility(false);
        const facility = facilitiesInLocality.find(f => f.id === facilityId);
        setSelectedFacility(facility || null);
        setCenter(facility ? facility['اسم_المؤسسة'] : '');
        
        if (isImnci && facility) {
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
        }
        
        // Reset participant-specific fields whenever the facility changes
        setIsEditingExistingWorker(false);
        setName('');
        setJob('');
        setPhone('');
        setEmail('');
        setTrainedIMNCI('no');
        setLastTrainIMNCI('');
    };
    
    const handleHealthWorkerSelect = (worker) => {
        if (!worker) { // This means "Add New" was selected
            setIsEditingExistingWorker(false);
            setName('');
            setJob('');
            setPhone('');
            setTrainedIMNCI('no');
            setLastTrainIMNCI('');
        } else {
            setIsEditingExistingWorker(true);
            setName(worker.name || '');
            setJob(worker.job_title || '');
            setPhone(worker.phone || '');
            if (isImnci) {
                setTrainedIMNCI(String(worker.is_trained || '').trim().toLowerCase() === 'yes' ? 'yes' : 'no');
                setLastTrainIMNCI(worker.training_date || '');
            }
        }
    };

    const professionalCategory = useMemo(() => {
        const lowerCaseJob = (job === 'Other' ? otherJobTitle : job).toLowerCase();
        if (lowerCaseJob.includes('doctor') || lowerCaseJob.includes('specialist') || lowerCaseJob.includes('registrar') || lowerCaseJob.includes('practioner')) return 'doctor';
        if (lowerCaseJob.includes('nurse')) return 'nurse';
        if (lowerCaseJob.includes('midwife')) return 'midwife';
        return 'provider';
    }, [job, otherJobTitle]);

    const submit = () => {
        const finalJobTitle = job === 'Other' ? otherJobTitle : job;
        if (!name || !state || !locality || !center || !finalJobTitle || !phone) { setError('Please complete all required fields'); return; }

        let p = { name, group, state, locality, center_name: center, job_title: finalJobTitle, phone, email };

        if (showTestScores) {
            p = { ...p, pre_test_score: preTestScore, post_test_score: postTestScore };
        }

        if (isImnci) {
            if (!facilityType || !imciSubType) { setError('Please complete all required fields'); return; }
            if (numProv <= 0) { setError('Number of providers at health center must be more than zero.'); return; }
            p = { ...p, imci_sub_type: imciSubType, facility_type: facilityType, trained_before: trainedIMNCI === 'yes', last_imci_training: trainedIMNCI === 'yes' ? lastTrainIMNCI : '', num_other_providers: numProv, num_other_providers_imci: numProvIMNCI, has_nutrition_service: hasNutri, has_immunization_service: hasImm, has_ors_room: hasORS, nearest_nutrition_center: !hasNutri ? nearestNutri : '', nearest_immunization_center: !hasImm ? nearestImm : '', has_growth_monitoring: hasGrowthMonitoring };
        } else if (isEtat) {
            if (!hospitalTypeEtat) { setError('Please complete all required fields'); return; }
            p = { ...p, hospital_type: hospitalTypeEtat, trained_etat_before: trainedEtat === 'yes', last_etat_training: trainedEtat === 'yes' ? lastTrainEtat : '', has_triage_system: hasTriageSystem, has_stabilization_center: hasStabilizationCenter, has_hdu: hasHdu, num_staff_in_er: numStaffInEr, num_staff_trained_in_etat: numStaffTrainedInEtat };
        } else if (isEenc) {
            if (!hospitalTypeEenc) { setError('Please complete all required fields'); return; }
            p = { ...p, hospital_type: hospitalTypeEenc === 'other' ? otherHospitalTypeEenc : hospitalTypeEenc, trained_eenc_before: trainedEENC === 'yes', last_eenc_training: trainedEENC === 'yes' ? lastTrainEENC : '', has_sncu: hasSncu, has_iycf_center: hasIycfCenter, num_staff_in_delivery: numStaffInDelivery, num_staff_trained_in_eenc: numStaffTrainedInEenc, has_kangaroo_room: hasKangaroo };
        }
        
        let facilityUpdatePayload = null;
        if (isImnci && (selectedFacility || isManualFacility)) {
            const newStaffMember = {
                name,
                job_title: finalJobTitle,
                phone,
                is_trained: 'Yes',
                training_date: course.start_date || '',
            };

            const baseFacilityPayload = {
                'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes',
                'وجود_كتيب_لوحات': 'Yes',
                'وجود_سجل_علاج_متكامل': 'Yes',
                'نوع_المؤسسةالصحية': facilityType,
                'nutrition_center_exists': hasNutri ? 'Yes' : 'No',
                'nearest_nutrition_center': !hasNutri ? nearestNutri : '',
                'immunization_office_exists': hasImm ? 'Yes' : 'No',
                'nearest_immunization_center': !hasImm ? nearestImm : '',
                'غرفة_إرواء': hasORS ? 'Yes' : 'No',
                'growth_monitoring_service_exists': hasGrowthMonitoring ? 'Yes' : 'No',
                'العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين': numProv,
                'العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل': numProvIMNCI,
                'ميزان_وزن': hasWeightScale ? 'Yes' : 'No',
                'ميزان_طول': hasHeightScale ? 'Yes' : 'No',
                'ميزان_حرارة': hasThermometer ? 'Yes' : 'No',
                'ساعة_مؤقت': hasTimer ? 'Yes' : 'No',
            };

            if (selectedFacility && !isManualFacility) {
                let updatedStaffList = [...(selectedFacility.imnci_staff || [])];
                const existingIndex = updatedStaffList.findIndex(staff => staff.name === name || (staff.phone && staff.phone === phone));
                if (existingIndex > -1) {
                    updatedStaffList[existingIndex] = newStaffMember;
                } else {
                    updatedStaffList.push(newStaffMember);
                }
                facilityUpdatePayload = { 
                    ...selectedFacility, 
                    ...baseFacilityPayload,
                    id: selectedFacility.id, 
                    date_of_visit: new Date().toISOString().split('T')[0], 
                    imnci_staff: updatedStaffList, 
                };
            } else if (isManualFacility) {
                facilityUpdatePayload = { 
                    ...baseFacilityPayload,
                    'اسم_المؤسسة': center, 
                    'الولاية': state, 
                    'المحلية': locality, 
                    'هل_المؤسسة_تعمل': 'Yes', 
                    date_of_visit: new Date().toISOString().split('T')[0], 
                    imnci_staff: [newStaffMember], 
                };
            }
        }
        onSave(p, facilityUpdatePayload);
    };
    
    const facilityOptionsForSelect = useMemo(() =>
        (facilitiesInLocality || []).map(f => ({ id: f.id, name: f['اسم_المؤسسة'] })),
        [facilitiesInLocality]
    );

    return (
        <Card>
            <div className="p-6">
                 <PageHeader title={initialData ? 'Edit Participant' : 'Add New Participant'} />
                {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                    
                    <FormGroup label="Group"><Select value={group} onChange={(e) => setGroup(e.target.value)}><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select></FormGroup>
                    <FormGroup label="State">
                        <Select value={state} onChange={(e) => {
                            setState(e.target.value);
                            setLocality('');
                            setCenter('');
                            setSelectedFacility(null);
                            setIsManualFacility(false);
                            setFacilitiesInLocality([]);
                        }}>
                            <option value="">— Select State —</option>
                            {Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Locality">
                        <Select value={locality} onChange={(e) => {
                            setLocality(e.target.value);
                            setCenter('');
                            setSelectedFacility(null);
                            setIsManualFacility(false);
                        }} disabled={!state}>
                            <option value="">— Select Locality —</option>
                            {(STATE_LOCALITIES[state]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}
                        </Select>
                    </FormGroup>
                    
                    <FormGroup label={isEtat ? "Hospital Name" : "Health Facility Name"}>
                        <div className="flex items-center gap-2">
                            <div className="flex-grow">
                                <SearchableSelect
                                    value={selectedFacility?.id || ''}
                                    onChange={handleFacilitySelect}
                                    options={facilityOptionsForSelect}
                                    placeholder={isLoadingFacilities ? "Loading..." : "- Type to search for a facility -"}
                                    disabled={isLoadingFacilities || !locality || isManualFacility}
                                />
                            </div>
                            <div className="flex items-center whitespace-nowrap pl-2">
                                <input
                                    type="checkbox"
                                    id="manual-facility-checkbox"
                                    checked={isManualFacility}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setIsManualFacility(isChecked);
                                        if (isChecked) {
                                            handleFacilitySelect(''); // Clear selection when switching to manual
                                        }
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="manual-facility-checkbox" className="ml-2 text-sm text-gray-700">Add Manually</label>
                            </div>
                        </div>
                    </FormGroup>

                    {isManualFacility && (
                        <FormGroup label="Enter Facility Name Manually">
                            <Input value={center} onChange={(e) => setCenter(e.target.value)} />
                        </FormGroup>
                    )}
                    
                    <FormGroup label="Participant Name">
                        <CreatableNameInput 
                            value={name}
                            onChange={setName}
                            onSelect={handleHealthWorkerSelect}
                            options={selectedFacility?.imnci_staff || []}
                            disabled={!selectedFacility || isManualFacility}
                        />
                        {isEditingExistingWorker && <p className="text-sm text-blue-600 mt-2">Editing an existing person. To add a new participant, select "Add as New" from the list.</p>}
                    </FormGroup>

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
                    <FormGroup label="Phone Number"><Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isEditingExistingWorker} /></FormGroup>
                    <FormGroup label="Email (Optional)"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></FormGroup>
                    {showTestScores && (
                        <>
                            <FormGroup label="Pre-Test Score (%)">
                                <Input type="number" min="0" max="100" value={preTestScore} onChange={(e) => setPreTestScore(e.target.value)} />
                            </FormGroup>
                            <FormGroup label="Post-Test Score (%)">
                                <Input type="number" min="0" max="100" value={postTestScore} onChange={(e) => setPostTestScore(e.target.value)} />
                            </FormGroup>
                        </>
                    )}

                    {isImnci && (<>
                        <FormGroup label="IMCI Course Sub-type">
                            <Select value={imciSubType} onChange={(e) => setImciSubType(e.target.value)}>
                                {IMNCI_SUBCOURSE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="Facility Type">
                            <Select value={facilityType} onChange={(e) => setFacilityType(e.target.value)}>
                                <option value="">— Select Type —</option>
                                <option value="مركز صحة الاسرة">مركز صحة الاسرة</option>
                                <option value="مستشفى ريفي">مستشفى ريفي</option>
                                <option value="وحدة صحة الاسرة">وحدة صحة الاسرة</option>
                                <option value="مستشفى">مستشفى</option>
                            </Select>
                        </FormGroup>
                        <FormGroup label="Previously trained in IMCI?"><Select value={trainedIMNCI} onChange={(e) => setTrainedIMNCI(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                        {trainedIMNCI === 'yes' && <FormGroup label="Date of last training"><Input type="date" value={lastTrainIMNCI} onChange={(e) => setLastTrainIMNCI(e.target.value)} /></FormGroup>}
                        <FormGroup label="Number of provider at health center including the current participant"><Input type="number" min="1" value={numProv} onChange={(e) => setNumProv(Number(e.target.value || 1))} /></FormGroup>
                        <FormGroup label="Number of providers trained in IMCI (not including current COURSE)"><Input type="number" min="0" value={numProvIMNCI} onChange={(e) => setNumProvIMNCI(Number(e.target.value || 0))} /></FormGroup>
                        
                        <div className="md:col-span-2 lg:col-span-3 my-4 p-4 border rounded-md bg-gray-50">
                            <h3 className="text-lg font-semibold mb-3 border-b pb-2">Facility Services & Equipment</h3>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <FormGroup label="Has therapeutic nutrition service?"><Select value={hasNutri ? 'yes' : 'no'} onChange={e => setHasNutri(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                {!hasNutri && <FormGroup label="Nearest therapeutic nutrition center?"><Input value={nearestNutri} onChange={e => setNearestNutri(e.target.value)} /></FormGroup>}
                                <FormGroup label="Has immunization service?"><Select value={hasImm ? 'yes' : 'no'} onChange={e => setHasImm(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                {!hasImm && <FormGroup label="Nearest immunization center?"><Input value={nearestImm} onChange={e => setNearestImm(e.target.value)} /></FormGroup>}
                                <FormGroup label="Has ORS corner service?"><Select value={hasORS ? 'yes' : 'no'} onChange={e => setHasORS(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                <FormGroup label="خدمة متابعة النمو (Growth Monitoring)"><Select value={hasGrowthMonitoring ? 'yes' : 'no'} onChange={e => setHasGrowthMonitoring(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                <FormGroup label="ميزان وزن (Weighting scale)"><Select value={hasWeightScale ? 'yes' : 'no'} onChange={e => setHasWeightScale(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                <FormGroup label="ميزان طول (Height scale)"><Select value={hasHeightScale ? 'yes' : 'no'} onChange={e => setHasHeightScale(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                <FormGroup label="ميزان حرارة (Thermometer)"><Select value={hasThermometer ? 'yes' : 'no'} onChange={e => setHasThermometer(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                                <FormGroup label="ساعة مؤقت (Timer)"><Select value={hasTimer ? 'yes' : 'no'} onChange={e => setHasTimer(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                            </div>
                        </div>
                    </>)}

                     {isEtat && (<>
                        <FormGroup label="Hospital Type"><Select value={hospitalTypeEtat} onChange={e => setHospitalTypeEtat(e.target.value)}><option value="">— Select Type —</option><option>Pediatric Hospital</option><option>Pediatric Department in General Hospital</option><option>Rural Hospital</option><option>other</option></Select></FormGroup>
                        <FormGroup label="Previously trained on ETAT?"><Select value={trainedEtat} onChange={e => setTrainedEtat(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                        {trainedEtat === 'yes' && <FormGroup label="Date of last ETAT training"><Input type="date" value={lastTrainEtat} onChange={(e) => setLastTrainEtat(e.target.value)} /></FormGroup>}
                        <FormGroup label="Does hospital have a current triaging system?"><Select value={hasTriageSystem ? 'yes' : 'no'} onChange={e => setHasTriageSystem(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                        <FormGroup label="Does hospital have a stabilization center for malnutrition?"><Select value={hasStabilizationCenter ? 'yes' : 'no'} onChange={e => setHasStabilizationCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                        <FormGroup label="Does hospital have a high dependency unit?"><Select value={hasHdu ? 'yes' : 'no'} onChange={e => setHasHdu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                        <FormGroup label={`Number of ${professionalCategory}s working in Emergency Room`}><Input type="number" min="0" value={numStaffInEr} onChange={e => setNumStaffInEr(Number(e.target.value || 0))} /></FormGroup>
                        <FormGroup label={`Number of ${professionalCategory}s trained in ETAT`}><Input type="number" min="0" value={numStaffTrainedInEtat} onChange={e => setNumStaffTrainedInEtat(Number(e.target.value || 0))} /></FormGroup>
                    </>)}

                    {isEenc && (<>
                        <FormGroup label="Hospital Type"><Select value={hospitalTypeEenc} onChange={e => setHospitalTypeEenc(e.target.value)}><option value="">— Select Type —</option><option>Comprehensive EmONC</option><option>Basic EmONC</option><option value="other">Other (specify)</option></Select></FormGroup>
                        {hospitalTypeEenc === 'other' && <FormGroup label="Specify Hospital Type"><Input value={otherHospitalTypeEenc} onChange={e => setOtherHospitalTypeEenc(e.target.value)} /></FormGroup>}
                        <FormGroup label="Previously trained on EENC?"><Select value={trainedEENC} onChange={e => setTrainedEENC(e.target.value)}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                        {trainedEENC === 'yes' && <FormGroup label="Date of last EENC training"><Input type="date" value={lastTrainEENC} onChange={(e) => setLastTrainEENC(e.target.value)} /></FormGroup>}
                        <FormGroup label="Does hospital have a Special Newborn Care Unit (SNCU)?"><Select value={hasSncu ? 'yes' : 'no'} onChange={e => setHasSncu(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                        <FormGroup label="Does hospital have an IYCF center?"><Select value={hasIycfCenter ? 'yes' : 'no'} onChange={e => setHasIycfCenter(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                        <FormGroup label="Does hospital have a Kangaroo care room?"><Select value={hasKangaroo ? 'yes' : 'no'} onChange={e => setHasKangaroo(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></Select></FormGroup>
                        <FormGroup label={`Number of ${professionalCategory}s working in delivery room`}><Input type="number" min="0" value={numStaffInDelivery} onChange={e => setNumStaffInDelivery(Number(e.target.value || 0))} /></FormGroup>
                        <FormGroup label={`Number of ${professionalCategory}s trained in EENC`}><Input type="number" min="0" value={numStaffTrainedInEenc} onChange={e => setNumStaffTrainedInEenc(Number(e.target.value || 0))} /></FormGroup>
                    </>)}
                </div>
                <div className="flex gap-2 justify-end mt-6 border-t pt-6"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={submit}>Save Participant</Button></div>
            </div>
        </Card>
    );
}