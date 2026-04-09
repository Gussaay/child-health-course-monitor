// src/components/HumanResources.jsx
import React from 'react';
import { Button, Card, CardBody } from './CommonComponents';
import { FacilitatorsView } from './Facilitator';
import { ProgramTeamView } from './ProgramTeamView';
import { PartnersPage } from './PartnersPage';
import { HealthWorkerView } from './HealthWorker'; // ADDED IMPORT

export function HumanResourcesPage({
    activeTab,
    setActiveTab,
    onAddFacilitator,
    onEditFacilitator,
    onDeleteFacilitator,
    onOpenFacilitatorReport,
    onImportFacilitators,
    userStates,
    onApproveSubmission,
    onRejectSubmission,
    permissions
}) {
    // Default to 'healthWorkers' if no tab is currently set
    const currentTab = activeTab || 'healthWorkers';

    return (
        <Card>
            <CardBody>
                <div className="border-b border-gray-200 mb-6 overflow-x-auto">
                    <nav className="-mb-px flex flex-wrap gap-6 min-w-max" aria-label="Tabs">
                        {/* ADDED TAB HERE */}
                        <Button variant="tab" isActive={currentTab === 'healthWorkers'} onClick={() => setActiveTab('healthWorkers')}>Health Workers</Button>
                        <Button variant="tab" isActive={currentTab === 'facilitators'} onClick={() => setActiveTab('facilitators')}>Facilitators</Button>
                        <Button variant="tab" isActive={currentTab === 'programTeams'} onClick={() => setActiveTab('programTeams')}>Program Teams</Button>
                        <Button variant="tab" isActive={currentTab === 'partnersPage'} onClick={() => setActiveTab('partnersPage')}>Partners</Button>
                    </nav>
                </div>

                <div>
                    {/* ADDED COMPONENT ROUTE HERE */}
                    {currentTab === 'healthWorkers' && (
                        <HealthWorkerView permissions={permissions} userStates={userStates} />
                    )}
                    
                    {currentTab === 'facilitators' && (
                        <FacilitatorsView
                            onAdd={onAddFacilitator}
                            onEdit={onEditFacilitator}
                            onDelete={onDeleteFacilitator}
                            onOpenReport={onOpenFacilitatorReport}
                            onImport={onImportFacilitators}
                            userStates={userStates}
                            onApproveSubmission={onApproveSubmission}
                            onRejectSubmission={onRejectSubmission}
                            permissions={permissions}
                        />
                    )}
                    {currentTab === 'programTeams' && <ProgramTeamView permissions={permissions} userStates={userStates} />}
                    {currentTab === 'partnersPage' && <PartnersPage permissions={permissions} userStates={userStates} />}
                </div>
            </CardBody>
        </Card>
    );
}