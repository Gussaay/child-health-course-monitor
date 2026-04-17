// src/components/HumanResources.jsx
import React from 'react';
import { Button, Card, CardBody } from './CommonComponents';
import { FacilitatorsView } from './Facilitator';
import { ProgramTeamView } from './ProgramTeamView';
import { PartnersPage } from './PartnersPage';
import { HealthWorkerView } from './HealthWorker';
import { Users, Briefcase, Handshake, Stethoscope, ArrowLeft } from 'lucide-react'; // ADDED ICON IMPORTS

// --- Main Navigation Menu Component ---
const HumanResourcesMenu = ({ onAction }) => {
    const menuItems = [
        { 
            id: 'healthWorkers', 
            label: 'Health Workers', 
            icon: Stethoscope, 
            color: 'text-emerald-600', 
            bg: 'bg-emerald-100', 
            border: 'hover:border-emerald-400', 
            shadow: 'hover:shadow-emerald-100' 
        },
        { 
            id: 'facilitators', 
            label: 'Facilitators', 
            icon: Users, 
            color: 'text-blue-600', 
            bg: 'bg-blue-100', 
            border: 'hover:border-blue-400', 
            shadow: 'hover:shadow-blue-100' 
        },
        { 
            id: 'programTeams', 
            label: 'Program Teams', 
            icon: Briefcase, 
            color: 'text-purple-600', 
            bg: 'bg-purple-100', 
            border: 'hover:border-purple-400', 
            shadow: 'hover:shadow-purple-100' 
        },
        { 
            id: 'partnersPage', 
            label: 'Partners', 
            icon: Handshake, 
            color: 'text-amber-600', 
            bg: 'bg-amber-100', 
            border: 'hover:border-amber-400', 
            shadow: 'hover:shadow-amber-100' 
        },
    ];

    return (
        <div className="max-w-6xl mx-auto mt-4 p-4 space-y-12" dir="ltr">
            <section>
                <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">
                    Human Resources Management
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {menuItems.map(item => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onAction(item.id)}
                                className={`flex flex-col items-center justify-center p-8 border border-gray-100 rounded-2xl bg-white shadow-sm hover:shadow-lg transition-all duration-300 group ${item.border} ${item.shadow} transform hover:-translate-y-1`}
                            >
                                <div className={`p-5 rounded-2xl mb-5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${item.bg}`}>
                                    <Icon className={`w-8 h-8 ${item.color}`} strokeWidth={1.5} />
                                </div>
                                <div className="font-semibold text-gray-700 text-lg group-hover:text-gray-900 transition-colors text-center">
                                    {item.label}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>
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
                    <HumanResourcesMenu onAction={setActiveTab} />
                ) : (
                    <div>
                        {/* BACK BUTTON TO RETURN TO MAIN NAV */}
                        <div className="mb-6 border-b border-gray-200 pb-4">
                            <Button variant="secondary" onClick={() => setActiveTab('menu')}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back to HR Menu
                            </Button>
                        </div>

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
                    </div>
                )}
            </CardBody>
        </Card>
    );
}