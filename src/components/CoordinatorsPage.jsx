// CoordinatorsPage.jsx
import React, { useState, useEffect } from 'react';
import { Button, Card, FormGroup, Input, PageHeader, Select, Spinner, Table } from './CommonComponents';
import { listCoordinators, upsertCoordinator, deleteCoordinator } from '../data.js';
import { STATE_LOCALITIES } from './constants.js';

export function CoordinatorsPage() {
    const [coordinators, setCoordinators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingCoordinator, setEditingCoordinator] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState('');
    const [locality, setLocality] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showForm, setShowForm] = useState(false);

    const fetchCoordinators = async () => {
        setLoading(true);
        const coords = await listCoordinators();
        setCoordinators(coords);
        setLoading(false);
    };

    useEffect(() => {
        fetchCoordinators();
    }, []);

    const handleSave = async () => {
        const payload = {
            name, state, locality, phoneNumber
        };
        if (editingCoordinator) {
            payload.id = editingCoordinator.id;
        }
        await upsertCoordinator(payload);
        setEditingCoordinator(null);
        setName('');
        setState('');
        setLocality('');
        setPhoneNumber('');
        setShowForm(false);
        await fetchCoordinators();
    };

    const handleEdit = (coordinator) => {
        setEditingCoordinator(coordinator);
        setName(coordinator.name);
        setState(coordinator.state);
        setLocality(coordinator.locality);
        setPhoneNumber(coordinator.phoneNumber);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this coordinator?')) {
            await deleteCoordinator(id);
            await fetchCoordinators();
        }
    };

    const handleCancel = () => {
        setEditingCoordinator(null);
        setName('');
        setState('');
        setLocality('');
        setPhoneNumber('');
        setShowForm(false);
    };

    const handleAddNew = () => {
        setEditingCoordinator(null);
        setName('');
        setState('');
        setLocality('');
        setPhoneNumber('');
        setShowForm(true);
    }

    return (
        <>
            <PageHeader
                title="Course Coordinators"
                subtitle="Manage the master list of course coordinators."
            />
            <div className="mb-4">
                <Button onClick={handleAddNew}>Add New Coordinator</Button>
            </div>
            {showForm && (
                <div className="my-4">
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Coordinator Form</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormGroup label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormGroup>
                            <FormGroup label="State"><Select value={state} onChange={(e) => { setState(e.target.value); setLocality(''); }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                            <FormGroup label="Locality"><Select value={locality} onChange={(e) => setLocality(e.target.value)} disabled={!state}><option value="">— Select Locality —</option>{(STATE_LOCALITIES[state] || []).sort().map(l => <option key={l} value={l}>{l}</option>)}</Select></FormGroup>
                            <FormGroup label="Phone Number"><Input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></FormGroup>
                        </div>
                        <div className="flex gap-2 justify-end mt-4">
                            <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                            <Button onClick={handleSave}>Save</Button>
                        </div>
                    </Card>
                </div>
            )}

            <div className="mt-4">
                {loading ? <Spinner /> : (
                    <Table headers={['Name', 'State', 'Locality', 'Phone', 'Actions']}>
                        {coordinators.map(c => (
                            <tr key={c.id}>
                                <td className="p-2 border">{c.name || 'N/A'}</td>
                                <td className="p-2 border">{c.state || 'N/A'}</td>
                                <td className="p-2 border">{c.locality || 'N/A'}</td>
                                <td className="p-2 border">{c.phoneNumber || 'N/A'}</td>
                                <td className="p-2 border">
                                    <div className="flex gap-2">
                                        <Button variant="secondary" onClick={() => handleEdit(c)}>Edit</Button>
                                        <Button variant="danger" onClick={() => handleDelete(c.id)}>Delete</Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </Table>
                )}
            </div>
        </>
    );
}