// PartnersPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Button, Card, FormGroup, Input, PageHeader, Spinner, Table, Modal, CardBody, EmptyState, Select } from './CommonComponents';
import { upsertFunder, deleteFunder } from '../data.js';
import { STATE_LOCALITIES } from './constants.js';
import { useDataCache } from '../DataContext'; 

export function PartnersPage({ permissions, userStates }) {
    const { 
        funders, 
        isLoading, 
        fetchFunders 
    } = useDataCache();
    
    // funders can be null initially
    const partners = funders; 
    const loading = isLoading.funders;
    
    const [editingPartner, setEditingPartner] = useState(null);
    const [formState, setFormState] = useState({ orgName: '', projects: [], focalPerson: '', phoneNumber: '', state: '' });
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [newProjectInput, setNewProjectInput] = useState('');
    const [allProjectNames, setAllProjectNames] = useState([]);

    const canManage = permissions.canManageHumanResource;

    useEffect(() => {
        fetchFunders();
    }, [fetchFunders]);

    useEffect(() => {
        // --- START OF FIX: Handle null partners ---
        if (partners && partners.length > 0) {
            const projects = partners.flatMap(p => p.projects || []);
            const uniqueProjects = [...new Set(projects)].sort();
            setAllProjectNames(uniqueProjects);
        } else {
            setAllProjectNames([]);
        }
        // --- END OF FIX ---
    }, [partners]);

    const filteredPartners = useMemo(() => {
        // --- START OF FIX: Handle null partners ---
        if (!partners) {
            return [];
        }
        // --- END OF FIX ---

        if (permissions.manageScope === 'federal') {
            return partners;
        }
        
        if (!userStates || userStates.length === 0) {
            return partners;
        }
        
        return partners.filter(p => p.state && userStates.includes(p.state));
    }, [partners, userStates, permissions.manageScope]);

    const handleSave = async () => {
        if (!canManage) return;
        const payload = { ...formState };
        if (editingPartner) payload.id = editingPartner.id;
        
        await upsertFunder(payload);
        handleCancel();
        await fetchFunders(true); // force=true
    };

    const handleEdit = (partner) => {
        if (!canManage) return;
        setEditingPartner(partner);
        setFormState({ orgName: partner.orgName, projects: partner.projects || [], focalPerson: partner.focalPerson, phoneNumber: partner.phoneNumber, state: partner.state || '' });
        setIsFormModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!canManage) return;
        if (window.confirm('Are you sure you want to delete this partner?')) {
            await deleteFunder(id);
            await fetchFunders(true); // force=true
        }
    };
    
    const handleAddNew = () => {
        if (!canManage) return;
        setEditingPartner(null);
        setFormState({ orgName: '', projects: [], focalPerson: '', phoneNumber: '', state: '' });
        setIsFormModalOpen(true);
    }

    const handleCancel = () => {
        setIsFormModalOpen(false);
        setEditingPartner(null);
        setFormState({ orgName: '', projects: [], focalPerson: '', phoneNumber: '', state: '' });
        setNewProjectInput('');
    };

    const handleCreateProject = () => {
        if (newProjectInput && !formState.projects.includes(newProjectInput)) {
            setFormState(prev => ({ ...prev, projects: [...prev.projects, newProjectInput.trim()] }));
            setNewProjectInput('');
        }
    };

    const handleSelectProject = (projectName) => {
        if (projectName && !formState.projects.includes(projectName)) {
            setFormState(prev => ({ ...prev, projects: [...prev.projects, projectName]}));
        }
    };

    const handleRemoveProject = (projectNameToRemove) => {
        setFormState(prev => ({
            ...prev,
            projects: prev.projects.filter((p) => p !== projectNameToRemove),
        }));
    };

    return (
        <Card>
            <CardBody>
                <PageHeader title="Funding Partners" subtitle="Manage the master list of funding partners." />
                <div className="mb-6">
                    {canManage && <Button onClick={handleAddNew}>Add New Partner</Button>}
                </div>
            
                {loading ? <Spinner /> : (
                    <Table headers={['Organization Name', 'State', 'Projects', 'Focal Person', 'Phone', 'Actions']}>
                        {/* --- FIX: This check is now safe --- */}
                        {filteredPartners.length > 0 ? filteredPartners.map(p => (
                            <tr key={p.id}>
                                <td className="p-4 text-sm">{p.orgName}</td>
                                <td className="p-4 text-sm">{p.state || 'N/A'}</td> 
                                <td className="p-4 text-sm">{(p.projects || []).join(', ')}</td>
                                <td className="p-4 text-sm">{p.focalPerson}</td>
                                <td className="p-4 text-sm">{p.phoneNumber}</td>
                                <td className="p-4 text-sm">
                                    {canManage ? (
                                        <div className="flex gap-2">
                                            <Button variant="secondary" onClick={() => handleEdit(p)}>Edit</Button>
                                            <Button variant="danger" onClick={() => handleDelete(p.id)}>Delete</Button>
                                        </div>
                                    ) : (
                                        <span>--</span>
                                    )}
                                </td>
                            </tr>
                        )) : (
                           <tr><td colSpan={6}><EmptyState message="No partners found." /></td></tr>
                        )}
                    </Table>
                )}

                <Modal isOpen={isFormModalOpen} onClose={handleCancel} title={editingPartner ? "Edit Partner" : "Add New Partner"}>
                    <div className="grid gap-4">
                        <FormGroup label="Organization Name"><Input value={formState.orgName} onChange={(e) => setFormState(prev => ({...prev, orgName: e.target.value}))} /></FormGroup>
                        
                        <FormGroup label="State">
                            <Select
                                value={formState.state}
                                onChange={(e) => setFormState(prev => ({...prev, state: e.target.value}))}
                            >
                                <option value="">-- Select State --</option>
                                {Object.keys(STATE_LOCALITIES).sort().map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </FormGroup>

                        <FormGroup label="Projects">
                            <div className="mb-3 flex flex-wrap gap-2 empty:hidden">
                                {formState.projects.map((project) => (
                                    <div key={project} className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1 text-sm border">
                                        <span>{project}</span>
                                        <button onClick={() => handleRemoveProject(project)} className="text-red-500 hover:text-red-700 font-bold text-lg" title="Remove project">&times;</button>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="flex items-center gap-2 mb-2">
                                <select
                                    className="p-2 border rounded-md w-full text-sm"
                                    onChange={(e) => handleSelectProject(e.target.value)}
                                    value=""
                                >
                                    <option value="">-- Add existing project --</option>
                                    {allProjectNames
                                        .filter(name => !formState.projects.includes(name))
                                        .map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <Input 
                                    value={newProjectInput} 
                                    onChange={(e) => setNewProjectInput(e.target.value)} 
                                    placeholder="Or create a new project name"
                                />
                                <Button variant="secondary" onClick={handleCreateProject} type="button">Create & Add</Button>
                            </div>
                        </FormGroup>

                        <FormGroup label="Focal Person for Health"><Input value={formState.focalPerson} onChange={(e) => setFormState(prev => ({...prev, focalPerson: e.target.value}))} /></FormGroup>
                        <FormGroup label="Phone Number"><Input type="tel" value={formState.phoneNumber} onChange={(e) => setFormState(prev => ({...prev, phoneNumber: e.target.value}))} /></FormGroup>
                    </div>
                    <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
                        <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </div>
                </Modal>
            </CardBody>
        </Card>
    );
}