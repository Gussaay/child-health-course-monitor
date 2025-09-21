// PartnersPage.jsx
import React, { useState, useEffect } from 'react';
import { Button, Card, FormGroup, Input, PageHeader, Spinner, Table } from './CommonComponents';
import { listFunders, upsertFunder, deleteFunder } from '../data.js';

export function PartnersPage() {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPartner, setEditingPartner] = useState(null);
    const [orgName, setOrgName] = useState('');
    const [focalPerson, setFocalPerson] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showForm, setShowForm] = useState(false);

    const fetchPartners = async () => {
        setLoading(true);
        const funds = await listFunders();
        setPartners(funds);
        setLoading(false);
    };

    useEffect(() => {
        fetchPartners();
    }, []);

    const handleSave = async () => {
        const payload = {
            orgName, focalPerson, phoneNumber
        };
        if (editingPartner) {
            payload.id = editingPartner.id;
        }
        await upsertFunder(payload);
        setEditingPartner(null);
        setOrgName('');
        setFocalPerson('');
        setPhoneNumber('');
        setShowForm(false);
        await fetchPartners();
    };

    const handleEdit = (partner) => {
        setEditingPartner(partner);
        setOrgName(partner.orgName);
        setFocalPerson(partner.focalPerson);
        setPhoneNumber(partner.phoneNumber);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this partner?')) {
            await deleteFunder(id);
            await fetchPartners();
        }
    };

    const handleCancel = () => {
        setEditingPartner(null);
        setOrgName('');
        setFocalPerson('');
        setPhoneNumber('');
        setShowForm(false);
    };

    const handleAddNew = () => {
        setEditingPartner(null);
        setOrgName('');
        setFocalPerson('');
        setPhoneNumber('');
        setShowForm(true);
    }

    return (
        <>
            <PageHeader
                title="Funding Partners"
                subtitle="Manage the master list of funding partners."
            />
            <div className="mb-4">
                <Button onClick={handleAddNew}>Add New Partner</Button>
            </div>
            {showForm && (
                <div className="my-4">
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Partner Form</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormGroup label="Organization Name"><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></FormGroup>
                            <FormGroup label="Focal Person for Health"><Input value={focalPerson} onChange={(e) => setFocalPerson(e.target.value)} /></FormGroup>
                            <FormGroup label="Phone Number"><Input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></FormGroup>
                        </div>
                        <div className="flex gap-2 justify-end mt-4">
                            {editingPartner && <Button variant="secondary" onClick={handleCancel}>Cancel</Button>}
                            <Button onClick={handleSave}>Save</Button>
                        </div>
                    </Card>
                </div>
            )}
            <div className="mt-4">
                {loading ? <Spinner /> : (
                    <Table headers={['Organization Name', 'Focal Person', 'Phone', 'Actions']}>
                        {partners.map(p => (
                            <tr key={p.id}>
                                <td className="p-2 border">{p.orgName}</td>
                                <td className="p-2 border">{p.focalPerson}</td>
                                <td className="p-2 border">{p.phoneNumber}</td>
                                <td className="p-2 border">
                                    <div className="flex gap-2">
                                        <Button variant="secondary" onClick={() => handleEdit(p)}>Edit</Button>
                                        <Button variant="danger" onClick={() => handleDelete(p.id)}>Delete</Button>
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