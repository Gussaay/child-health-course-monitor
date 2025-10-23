// src/components/HumanResources.jsx
import React from 'react';
import { Button, Card, CardBody } from './CommonComponents';
import { FacilitatorsView } from './Facilitator';
import { ProgramTeamView } from './ProgramTeamView';
import { PartnersPage } from './PartnersPage';
import { useDataCache } from '../DataContext'; // Import hook (though not strictly needed here, it's good practice)

export function HumanResourcesPage({
    activeTab,
    setActiveTab,
    // --- START OF FIX: Remove data props ---
    // facilitators,
    onAddFacilitator,
    onEditFacilitator,
    onDeleteFacilitator,
    onOpenFacilitatorReport,
    onImportFacilitators,
    userStates,
    // pendingSubmissions,
    // isSubmissionsLoading,
    onApproveSubmission,
    onRejectSubmission,
    // --- END OF FIX ---
    refreshFacilitatorData, // <-- ADD This
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
                            // --- START OF FIX: Remove data props, add refreshData ---
                            // facilitators={facilitators}
                            onAdd={onAddFacilitator}
                            onEdit={onEditFacilitator}
                            onDelete={onDeleteFacilitator}
                            onOpenReport={onOpenFacilitatorReport}
                            onImport={onImportFacilitators}
                            userStates={userStates}
                            // pendingSubmissions={pendingSubmissions}
                            // isSubmissionsLoading={isSubmissionsLoading}
                            onApproveSubmission={onApproveSubmission}
                            onRejectSubmission={onRejectSubmission}
                            refreshData={refreshFacilitatorData} // <-- Pass the refresh function
                            permissions={permissions}
                            // --- END OF FIX ---
                        />
                    )}
                    {activeTab === 'programTeams' && <ProgramTeamView permissions={permissions} userStates={userStates} />}
                    {activeTab === 'partnersPage' && <PartnersPage permissions={permissions} userStates={userStates} />}
                </div>
            </CardBody>
        </Card>
    );
}