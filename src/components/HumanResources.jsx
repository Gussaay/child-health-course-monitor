// src/components/HumanResources.jsx
import React, { Suspense, lazy } from 'react';
import { Button, Card, CardBody, Spinner, IS_NATIVE, MenuTile, MenuGrid, BackArrow } from './CommonComponents';
import { FacilitatorsView } from './Facilitator';
import { ProgramTeamView } from './ProgramTeamView';
import { PartnersPage } from './PartnersPage';
import { HealthWorkerView } from './HealthWorker';
import { Users, Briefcase, Handshake, Stethoscope, Trash2 } from 'lucide-react'; // ADDED ICON IMPORTS

const DeletedItemsPanel = lazy(() => import('./DeletedItemsPanel.jsx'));
const HR_DELETED_TYPES = ['facilitators', 'federalCoordinators', 'stateCoordinators', 'localityCoordinators', 'coordinators', 'funders'];

// --- Main Navigation Menu Component ---
const HR_SECTION_TITLES = { healthWorkers: 'Health Workers', facilitators: 'Facilitators', programTeams: 'Program Teams', partnersPage: 'Partners', deletedItems: 'Deleted Items' };

const HumanResourcesMenu = ({ onAction, canEmptyBin }) => {
    const menuItems = [
        { id: 'healthWorkers', label: 'Health Workers', icon: Stethoscope },
        { id: 'facilitators', label: 'Facilitators', icon: Users },
        { id: 'programTeams', label: 'Program Teams', icon: Briefcase },
        { id: 'partnersPage', label: 'Partners', icon: Handshake },
    ];

    return (
        <div className="max-w-6xl mx-auto mt-2 md:mt-6" dir="ltr">
            <Card className="p-3 md:p-6">
                <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-3 md:mb-5">Human Resources</h3>
                <MenuGrid columns="lg:grid-cols-4">
                    {menuItems.map(item => (
                        <MenuTile key={item.id} icon={item.icon} label={item.label} onClick={() => onAction(item.id)} />
                    ))}
                </MenuGrid>
                {canEmptyBin && (
                    <div className="mt-4 flex justify-center">
                        <button type="button" onClick={() => onAction('deletedItems')} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                            <Trash2 size={16} /> Deleted Items
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );
};

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
    // Default to 'menu' if no tab is currently set to show the new main nav
    const currentTab = activeTab || 'menu';

    return (
        <Card>
            <CardBody>
                {currentTab === 'menu' ? (
                    <HumanResourcesMenu onAction={setActiveTab} canEmptyBin={!!permissions?.canUseFederalManagerAdvancedFeatures} />
                ) : (
                    <div>
                        {/* BACK BUTTON TO RETURN TO MAIN NAV */}
                        {!IS_NATIVE && (
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                            <BackArrow onClick={() => setActiveTab('menu')} label="Back to HR Menu" className="-ms-2" />
                            <h2 className="text-xl font-bold text-slate-800">{HR_SECTION_TITLES[currentTab] || 'Human Resources'}</h2>
                        </div>
                        )}

                        {/* RENDERED COMPONENTS */}
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
                        
                        {currentTab === 'programTeams' && (
                            <ProgramTeamView permissions={permissions} userStates={userStates} />
                        )}
                        
                        {currentTab === 'partnersPage' && (
                            <PartnersPage permissions={permissions} userStates={userStates} />
                        )}

                        {currentTab === 'deletedItems' && permissions?.canUseFederalManagerAdvancedFeatures && (
                            <Suspense fallback={<Spinner />}>
                                <DeletedItemsPanel types={HR_DELETED_TYPES} />
                            </Suspense>
                        )}
                    </div>
                )}
            </CardBody>
        </Card>
    );
}