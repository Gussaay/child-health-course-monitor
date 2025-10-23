// src/components/HumanResources.jsx
import React from 'react';
import { Button, Card, CardBody } from './CommonComponents';
import { FacilitatorsView } from './Facilitator';
import { ProgramTeamView } from './ProgramTeamView';
import { PartnersPage } from './PartnersPage';

export function HumanResourcesPage({
    activeTab,
    setActiveTab,
    facilitators,
    onAddFacilitator,
    onEditFacilitator,
    onDeleteFacilitator,
    onOpenFacilitatorReport,
    onImportFacilitators,
    userStates,
    pendingSubmissions,
    isSubmissionsLoading,
    onApproveSubmission,
    onRejectSubmission,
    permissions
}) {
    return (
        <Card>
            <CardBody>
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex flex-wrap gap-6" aria-label="Tabs">
                        <Button variant="tab" isActive={activeTab === 'facilitators'} onClick={() => setActiveTab('facilitators')}>Facilitators</Button>
                        <Button variant="tab" isActive={activeTab === 'programTeams'} onClick={() => setActiveTab('programTeams')}>Program Teams</Button>
                        <Button variant="tab" isActive={activeTab === 'partnersPage'} onClick={() => setActiveTab('partnersPage')}>Partners</Button>
                    </nav>
                </div>

                <div>
                    {activeTab === 'facilitators' && (
                        <FacilitatorsView
                            facilitators={facilitators}
                            onAdd={onAddFacilitator}
                            onEdit={onEditFacilitator}
                            onDelete={onDeleteFacilitator}
                            onOpenReport={onOpenFacilitatorReport}
                            onImport={onImportFacilitators}
                            userStates={userStates}
                            pendingSubmissions={pendingSubmissions}
                            isSubmissionsLoading={isSubmissionsLoading}
                            onApproveSubmission={onApproveSubmission}
                            onRejectSubmission={onRejectSubmission}
                            permissions={permissions}
                        />
                    )}
                    {/* FIX: Pass userStates prop to ProgramTeamView */}
                    {activeTab === 'programTeams' && <ProgramTeamView permissions={permissions} userStates={userStates} />}
                    {activeTab === 'partnersPage' && <PartnersPage permissions={permissions} userStates={userStates} />}
                </div>
            </CardBody>
        </Card>
    );
}