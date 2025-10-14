// PartnersPage.jsx
import React, { useState, useEffect } from 'react';
import { Button, Card, FormGroup, Input, PageHeader, Spinner, Table, Modal, CardBody, EmptyState } from './CommonComponents';
import { listFunders, upsertFunder, deleteFunder } from '../data.js';

export function PartnersPage() {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPartner, setEditingPartner] = useState(null);
    const [formState, setFormState] = useState({ orgName: '', projects: [], focalPerson: '', phoneNumber: '' });
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    // State for the "Create New Project" input field
    const [newProjectInput, setNewProjectInput] = useState('');
    // State to hold the master list of all unique project names
    const [allProjectNames, setAllProjectNames] = useState([]);

    const fetchPartners = async () => {
        setLoading(true);
        const funds = await listFunders();
        setPartners(funds);
        setLoading(false);
    };

    useEffect(() => {
        fetchPartners();
    }, []);

    // Effect to build the master project list from all partners
    useEffect(() => {
        if (partners.length > 0) {
            const projects = partners.flatMap(p => p.projects || []);
            const uniqueProjects = [...new Set(projects)].sort();
            setAllProjectNames(uniqueProjects);
        }
    }, [partners]);

    const handleSave = async () => {
        const payload = { ...formState };
        if (editingPartner) payload.id = editingPartner.id;
        
        await upsertFunder(payload);
        handleCancel();
        await fetchPartners();
    };

    const handleEdit = (partner) => {
        setEditingPartner(partner);
        setFormState({ orgName: partner.orgName, projects: partner.projects || [], focalPerson: partner.focalPerson, phoneNumber: partner.phoneNumber });
        setIsFormModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this partner?')) {
            await deleteFunder(id);
            await fetchPartners();
        }
    };
    
    const handleAddNew = () => {
        setEditingPartner(null);
        setFormState({ orgName: '', projects: [], focalPerson: '', phoneNumber: '' });
        setIsFormModalOpen(true);
    }

    const handleCancel = () => {
        setIsFormModalOpen(false);
        setEditingPartner(null);
        setFormState({ orgName: '', projects: [], focalPerson: '', phoneNumber: '' });
        setNewProjectInput('');
    };

    // Adds a newly created project to the partner's project list
    const handleCreateProject = () => {
        if (newProjectInput && !formState.projects.includes(newProjectInput)) {
            setFormState(prev => ({ ...prev, projects: [...prev.projects, newProjectInput.trim()] }));
            setNewProjectInput('');
        }
    };

    // Adds a project selected from the dropdown to the partner's list
    const handleSelectProject = (projectName) => {
        if (projectName && !formState.projects.includes(projectName)) {
            setFormState(prev => ({ ...prev, projects: [...prev.projects, projectName]}));
        }
    };

    // Removes a project from the form's project list by its name
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
                    <Button onClick={handleAddNew}>Add New Partner</Button>
                </div>
            
                {loading ? <Spinner /> : (
                    <Table headers={['Organization Name', 'Projects', 'Focal Person', 'Phone', 'Actions']}>
                        {partners.length > 0 ? partners.map(p => (
                            <tr key={p.id}>
                                <td className="p-4 text-sm">{p.orgName}</td>
                                <td className="p-4 text-sm">{(p.projects || []).join(', ')}</td>
                                <td className="p-4 text-sm">{p.focalPerson}</td>
                                <td className="p-4 text-sm">{p.phoneNumber}</td>
                                <td className="p-4 text-sm">
                                    <div className="flex gap-2">
                                        <Button variant="secondary" onClick={() => handleEdit(p)}>Edit</Button>
                                        <Button variant="danger" onClick={() => handleDelete(p.id)}>Delete</Button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                           <tr><td colSpan={5}><EmptyState message="No partners found." /></td></tr>
                        )}
                    </Table>
                )}

                <Modal isOpen={isFormModalOpen} onClose={handleCancel} title={editingPartner ? "Edit Partner" : "Add New Partner"}>
                    <div className="grid gap-4">
                        <FormGroup label="Organization Name"><Input value={formState.orgName} onChange={(e) => setFormState(prev => ({...prev, orgName: e.target.value}))} /></FormGroup>
                        
                        <FormGroup label="Projects">
                            {/* Part 1: Display and remove currently assigned projects */}
                            <div className="mb-3 flex flex-wrap gap-2 empty:hidden">
                                {formState.projects.map((project) => (
                                    <div key={project} className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1 text-sm border">
                                        <span>{project}</span>
                                        <button onClick={() => handleRemoveProject(project)} className="text-red-500 hover:text-red-700 font-bold text-lg" title="Remove project">&times;</button>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Part 2: Add an existing project from the dropdown */}
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
                            
                            {/* Part 3: Create and add a new project */}
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