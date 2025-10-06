// src/components/HumanResources.jsx
import React from 'react';
import { Button, Card, PageHeader } from './CommonComponents';
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
    onOpenFacilitatorComparison,
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
            <PageHeader title="Human Resources Management" subtitle="Manage facilitators, program teams, and partners." />

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex flex-wrap gap-6" aria-label="Tabs">
                    <Button variant="tab" isActive={activeTab === 'facilitators'} onClick={() => setActiveTab('facilitators')}>Facilitators</Button>
                    <Button variant="tab" isActive={activeTab === 'programTeams'} onClick={() => setActiveTab('programTeams')}>Program Teams</Button>
                    <Button variant="tab" isActive={activeTab === 'partnersPage'} onClick={() => setActiveTab('partnersPage')}>Partners</Button>
                </nav>
            </div>

            <div className="mt-4">
                {activeTab === 'facilitators' && (
                    <FacilitatorsView
                        facilitators={facilitators}
                        onAdd={onAddFacilitator}
                        onEdit={onEditFacilitator}
                        onDelete={onDeleteFacilitator}
                        onOpenReport={onOpenFacilitatorReport}
                        onOpenComparison={onOpenFacilitatorComparison}
                        onImport={onImportFacilitators}
                        userStates={userStates}
                        pendingSubmissions={pendingSubmissions}
                        isSubmissionsLoading={isSubmissionsLoading}
                        onApproveSubmission={onApproveSubmission}
                        onRejectSubmission={onRejectSubmission}
                        permissions={permissions}
                    />
                )}
                {activeTab === 'programTeams' && <ProgramTeamView permissions={permissions} />}
                {activeTab === 'partnersPage' && <PartnersPage />}
            </div>
        </Card>
    );
}