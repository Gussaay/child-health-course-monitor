// FacilityHistoryView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { listSnapshotsForFacility } from "../data.js"; // This function will be added to data.js
import { Modal, Spinner, EmptyState, Select, Table, Button } from './CommonComponents';
import { Timestamp } from "firebase/firestore"; // Import Timestamp

// --- Helper Functions (Adapted from ApprovalComparisonModal) ---

const deepEqual = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

const getDisplayableValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleDateString();
    // Handle Firestore Timestamps
    if (value instanceof Timestamp) return value.toDate().toLocaleString();
    if (typeof value === 'object' && value !== null) {
         if (Array.isArray(value)) {
             return value.length > 0 ? value.map(v => v.name || JSON.stringify(v)).join(', ') : 'N/A';
         }
         if ('primary' in value || 'secondary' in value || 'tertiary' in value) {
             const levels = [];
             if (value.primary) levels.push('Primary');
             if (value.secondary) levels.push('Special Care');
             if (value.tertiary) levels.push('NICU');
             return levels.length > 0 ? levels.join(', ') : 'N/A';
         }
         return JSON.stringify(value);
    }
    return String(value);
};

// Field labels for a user-friendly display
const FIELD_LABELS_FOR_COMPARISON = {
    'اسم_المؤسسة': 'Facility Name',
    'الولاية': 'State',
    'المحلية': 'Locality',
    'نوع_المؤسسةالصحية': 'Facility Type',
    'هل_المؤسسة_تعمل': 'Functioning',
    '_الإحداثيات_latitude': 'Latitude',
    '_الإحداثيات_longitude': 'Longitude',
    'وجود_العلاج_المتكامل_لامراض_الطفولة': 'IMNCI Service',
    'العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين': 'IMNCI Total Staff',
    'العدد_الكلي_للكودار_ المدربة_على_العلاج_المتكامل': 'IMNCI Trained Staff',
    'eenc_provides_essential_care': 'EENC Service',
    'eenc_trained_workers': 'EENC Trained Workers',
    'neonatal_level_of_care': 'Neonatal Level of Care',
    'neonatal_total_beds': 'Neonatal Total Beds',
    'neonatal_total_incubators': 'Neonatal Incubators',
    'etat_has_service': 'ETAT Service',
    'hdu_has_service': 'HDU Service',
    'picu_has_service': 'PICU Service',
    'imnci_staff': 'IMNCI Staff List'
    // Add any other specific fields here
};

/**
 * Compares two snapshot objects and returns an array of rows for display.
 */
const createComparison = (snapA, snapB) => {
    const rows = [];
    const allKeys = new Set([...Object.keys(snapA || {}), ...Object.keys(snapB || {})]);

    allKeys.forEach(key => {
        // Filter out meta-keys that shouldn't be compared
        if (key.startsWith('_') || ['id', 'snapshotId', 'facilityId', 'submittedAt', 'updated_by', 'اخر تحديث', 'date_of_visit', 'snapshotCreatedAt', 'effectiveDate', 'status', 'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt'].includes(key)) {
            return;
        }

        const valueA = snapA?.[key];
        const valueB = snapB?.[key];
        const isDifferent = !deepEqual(valueA, valueB);

        // Only add rows that have data in at least one snapshot
        if (valueA !== undefined || valueB !== undefined) {
             rows.push({
                key: key,
                label: FIELD_LABELS_FOR_COMPARISON[key] || key.replace(/_/g, ' '),
                valueA: getDisplayableValue(valueA),
                valueB: getDisplayableValue(valueB),
                isDifferent: isDifferent
            });
        }
    });
    // Sort by difference, then alphabetically
    return rows.sort((a, b) => {
        if (a.isDifferent && !b.isDifferent) return -1;
        if (!a.isDifferent && b.isDifferent) return 1;
        return a.label.localeCompare(b.label);
    });
};


/**
 * A modal component to view and compare historical snapshots of a facility.
 */
const FacilityHistoryView = ({ isOpen, onClose, facility }) => {
    const [snapshots, setSnapshots] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedSnapIdA, setSelectedSnapIdA] = useState(null);
    const [selectedSnapIdB, setSelectedSnapIdB] = useState(null);

    useEffect(() => {
        if (isOpen && facility?.id) {
            const fetchHistory = async () => {
                setIsLoading(true);
                setError(null);
                setSnapshots([]);
                try {
                    // This new function queries the 'facilitySnapshots' collection
                    const fetchedSnapshots = await listSnapshotsForFacility(facility.id);
                    setSnapshots(fetchedSnapshots);

                    // Auto-select the two most recent snapshots for comparison
                    setSelectedSnapIdA(fetchedSnapshots[0]?.id || null);
                    setSelectedSnapIdB(fetchedSnapshots[1]?.id || null);

                } catch (err) {
                    setError(`Failed to load history: ${err.message}`);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchHistory();
        } else {
            // Reset when closed
            setSnapshots([]);
            setSelectedSnapIdA(null);
            setSelectedSnapIdB(null);
            setIsLoading(false);
            setError(null);
        }
    }, [isOpen, facility]);

    // Options for the dropdown selectors
    const snapshotOptions = useMemo(() => {
        return snapshots.map(s => {
            const date = s.effectiveDate?.toDate ? s.effectiveDate.toDate() : (s.date_of_visit ? new Date(s.date_of_visit) : null);
            const dateStr = date ? date.toLocaleString() : 'Unknown Date';
            return {
                value: s.id,
                label: `${dateStr} (by ${s.updated_by || 'Unknown'})`
            };
        });
    }, [snapshots]);

    // Find the full snapshot objects based on selected IDs
    const snapA = useMemo(() => snapshots.find(s => s.id === selectedSnapIdA), [snapshots, selectedSnapIdA]);
    const snapB = useMemo(() => snapshots.find(s => s.id === selectedSnapIdB), [snapshots, selectedSnapIdB]);

    // Generate the comparison rows
    const comparisonRows = useMemo(() => {
        return createComparison(snapA, snapB);
    }, [snapA, snapB]);

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>;
        if (error) return <div className="p-4 text-red-600 bg-red-50 text-center">{error}</div>;
        if (snapshots.length === 0) return <div className="p-8"><EmptyState message="No historical snapshots found for this facility." /></div>;

        return (
            <div className="flex flex-col h-full">
                {/* --- Selector Row --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-b flex-shrink-0">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Compare Version (A)</label>
                        <Select value={selectedSnapIdA || ''} onChange={e => setSelectedSnapIdA(e.target.value)}>
                            <option value="">-- Select Version --</option>
                            {snapshotOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">With Version (B)</label>
                        <Select value={selectedSnapIdB || ''} onChange={e => setSelectedSnapIdB(e.target.value)}>
                            <option value="">-- Select Version --</option>
                            {snapshotOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </Select>
                    </div>
                </div>

                {/* --- Comparison Table --- */}
                <div className="flex-grow overflow-y-auto">
                    <Table headers={['Field', `Version A (${snapA ? (snapA.effectiveDate?.toDate ? snapA.effectiveDate.toDate().toLocaleDateString() : 'N/A') : '...'})`, `Version B (${snapB ? (snapB.effectiveDate?.toDate ? snapB.effectiveDate.toDate().toLocaleDateString() : 'N/A') : '...'})`]} stickyHeader={true}>
                        {comparisonRows.map(row => (
                            <tr key={row.key} className={row.isDifferent ? 'bg-yellow-50' : 'bg-white'}>
                                <td className="p-2 border-b border-gray-200 font-medium text-gray-700 capitalize align-top w-1/3">{row.label}</td>
                                <td className={`p-2 border-b border-gray-200 align-top w-1/3 ${row.isDifferent ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                    {row.valueA}
                                </td>
                                <td className={`p-2 border-b border-gray-200 align-top w-1/3 ${row.isDifferent ? 'font-semibold text-blue-800' : 'text-gray-600'}`}>
                                    {row.valueB}
                                </td>
                            </tr>
                        ))}
                    </Table>
                    {comparisonRows.length === 0 && (snapA || snapB) && (
                        <div className="p-8">
                            <EmptyState message="Select two versions to compare." />
                        </div>
                    )}
                </div>
                 <div className="flex justify-end p-4 border-t flex-shrink-0">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`History for ${facility?.['اسم_المؤسسة'] || 'Facility'}`} size="full">
            {renderContent()}
        </Modal>
    );
};

export default FacilityHistoryView;