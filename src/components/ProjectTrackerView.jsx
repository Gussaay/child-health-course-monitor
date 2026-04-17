// src/components/ProjectTrackerView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, Button, Modal, Input, FormGroup, Select, PageHeader, Table, EmptyState, Spinner } from './CommonComponents';
import { upsertProject, deleteProject, upsertUnitMeeting, deleteUnitMeeting } from '../data';
import { useDataCache } from '../DataContext';
import { STATE_LOCALITIES } from './constants';
import { 
    Plus, Edit, Trash2, CheckCircle, Clock, PlayCircle, FolderKanban, 
    Calendar, Baby, Stethoscope, Users, Activity, Package, HeartPulse, ChevronLeft,
    BarChart2, AlertCircle, Target, ListTodo, AlertTriangle, ArrowRight, UserCheck, Layers,
    Video, MapPin, FileText, CheckSquare, Eye, Share2, Link as LinkIcon, Search, UserPlus, Save
} from 'lucide-react';

const PROGRAM_UNITS_DATA = [
    { id: "Neonatal Health Unit", title: "Neonatal Health", icon: Baby, color: "text-blue-500", bg: "bg-blue-100", border: "border-blue-200" },
    { id: "IMNCI unit", title: "IMNCI", icon: Stethoscope, color: "text-green-500", bg: "bg-green-100", border: "border-green-200" },
    { id: "Adolescent unit", title: "Adolescent Health", icon: Users, color: "text-purple-500", bg: "bg-purple-100", border: "border-purple-200" },
    { id: "Monitoring and evaluation", title: "Monitoring & Eval (M&E)", icon: Activity, color: "text-orange-500", bg: "bg-orange-100", border: "border-orange-200" },
    { id: "Supply", title: "Supply & Logistics", icon: Package, color: "text-amber-500", bg: "bg-amber-100", border: "border-amber-200" },
    { id: "Health promotion", title: "Health Promotion", icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-100", border: "border-rose-200" }
];

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];

// --- HELPER FUNCTIONS FOR INVITEE DETAILS ---
const getInviteeDetails = (baseName, allTeamMembers) => {
    const member = allTeamMembers.find(m => m.name === baseName);
    if (member) {
        return {
            name: baseName,
            displayName: member.nameAr || member.name,
            state: member.state ? (STATE_LOCALITIES[member.state]?.ar || member.state) : 'Federal (إتحادي)',
            position: member.role || (member.jobTitle === 'اخرى' ? member.jobTitleOther : member.jobTitle) || 'Unspecified',
            level: member._level,
            isGuest: false
        };
    }
    return { name: baseName, displayName: baseName, state: 'Unknown', position: 'Unknown', level: 'Unknown', isGuest: false };
};

const groupInviteesByState = (inviteeNames, guests, allTeamMembers) => {
    const details = (inviteeNames || []).map(name => getInviteeDetails(name, allTeamMembers));
    const guestDetails = (guests || []).map(g => ({
        name: g.name,
        displayName: g.name,
        state: 'External / Guests',
        position: g.position,
        level: 'guest',
        isGuest: true
    }));
    
    const all = [...details, ...guestDetails];
    return all.reduce((acc, inv) => {
        if (!acc[inv.state]) acc[inv.state] = [];
        acc[inv.state].push(inv);
        return acc;
    }, {});
};


// --- INVITEE SELECTION MODAL ---
function InviteeSelectionModal({ isOpen, onClose, allMembers, selectedNames, onConfirm }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState('all');
    const [positionFilter, setPositionFilter] = useState('all');
    const [selected, setSelected] = useState(new Set(selectedNames));

    const allPositions = useMemo(() => {
        const positions = new Set();
        allMembers.forEach(m => {
            if (m.role) positions.add(m.role);
            const job = m.jobTitle === 'اخرى' ? m.jobTitleOther : m.jobTitle;
            if (job) positions.add(job);
        });
        return Array.from(positions).sort();
    }, [allMembers]);

    useEffect(() => {
        if (isOpen) setSelected(new Set(selectedNames));
    }, [isOpen, selectedNames]);

    const filteredMembers = useMemo(() => {
        return allMembers.filter(m => {
            const nameToMatch = (m.nameAr || m.name || '').toLowerCase();
            const matchesSearch = nameToMatch.includes(searchTerm.toLowerCase());
            const matchesLevel = levelFilter === 'all' || m._level === levelFilter;
            
            const memberPos = m.role || (m.jobTitle === 'اخرى' ? m.jobTitleOther : m.jobTitle);
            const matchesPosition = positionFilter === 'all' || memberPos === positionFilter;

            return matchesSearch && matchesLevel && matchesPosition;
        });
    }, [allMembers, searchTerm, levelFilter, positionFilter]);

    const toggleMember = (name) => {
        const next = new Set(selected);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelected(next);
    };

    const handleSelectAll = () => {
        const next = new Set(selected);
        filteredMembers.forEach(m => next.add(m.name));
        setSelected(next);
    };

    const handleDeselectAll = () => {
        const next = new Set(selected);
        filteredMembers.forEach(m => next.delete(m.name));
        setSelected(next);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Meeting Invitees" size="xl">
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 w-full"
                        />
                    </div>
                    <Select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
                        <option value="all">All Levels</option>
                        <option value="federal">Federal</option>
                        <option value="state">State</option>
                        <option value="locality">Locality</option>
                    </Select>
                    <Select value={positionFilter} onChange={e => setPositionFilter(e.target.value)}>
                        <option value="all">All Positions</option>
                        {allPositions.map(pos => (
                            <option key={pos} value={pos}>{pos}</option>
                        ))}
                    </Select>
                </div>

                <div className="flex justify-between items-center text-sm bg-gray-50 p-3 rounded-md border border-gray-200">
                    <span className="text-gray-700 font-semibold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">
                        {selected.size} selected
                    </span>
                    <div className="space-x-2 flex">
                        <Button size="sm" variant="secondary" onClick={handleSelectAll}>Select All Filtered</Button>
                        <Button size="sm" variant="secondary" onClick={handleDeselectAll}>Deselect All Filtered</Button>
                    </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto border border-gray-200 rounded-md divide-y">
                    {filteredMembers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No team members found matching criteria.</div>
                    ) : (
                        filteredMembers.map(m => {
                            const pos = m.role || (m.jobTitle === 'اخرى' ? m.jobTitleOther : m.jobTitle);
                            return (
                                <label key={m.id} className="flex items-center gap-4 p-3 hover:bg-indigo-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(m.name)}
                                        onChange={() => toggleMember(m.name)}
                                        className="h-5 w-5 text-indigo-600 rounded border-gray-300"
                                    />
                                    <div>
                                        <div className="font-bold text-gray-900">{m.nameAr || m.name}</div>
                                        <div className="text-xs text-gray-500 font-medium mt-0.5">
                                            <span className={`uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded mr-2 ${m._level === 'federal' ? 'bg-blue-100 text-blue-800' : m._level === 'state' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                                                {m._level}
                                            </span>
                                            <span className="font-semibold text-gray-700">
                                                {m.state ? `${STATE_LOCALITIES[m.state]?.ar || m.state}` : 'Federal'}
                                                {m.locality ? ` - ${m.locality}` : ''}
                                            </span>
                                            <span className="mx-2 text-gray-300">|</span>
                                            <span className="text-indigo-600">{pos}</span>
                                        </div>
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={() => { onConfirm(Array.from(selected)); onClose(); }}>Confirm Selection</Button>
            </div>
        </Modal>
    );
}

export default function ProjectTrackerView({ permissions }) {
    const { 
        projects: rawProjects, 
        unitMeetings: rawMeetings,
        fetchProjects, 
        fetchUnitMeetings,
        isLoading, 
        federalCoordinators, 
        fetchFederalCoordinators,
        stateCoordinators,
        fetchStateCoordinators,
        localityCoordinators,
        fetchLocalityCoordinators
    } = useDataCache();
    
    // --- Navigation State ---
    const [mainTab, setMainTab] = useState('units'); 
    const [viewMode, setViewMode] = useState('units'); 
    const [unitSubTab, setUnitSubTab] = useState('projects'); 
    const [meetingSubTab, setMeetingSubTab] = useState('overview'); 
    
    const [activeUnit, setActiveUnit] = useState(null);
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [activeMeetingId, setActiveMeetingId] = useState(null);
    const [activeMeetingDate, setActiveMeetingDate] = useState(''); 
    
    // --- Modal State ---
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
    const [isInviteeModalOpen, setIsInviteeModalOpen] = useState(false); 
    const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
    const [shareMeetingId, setShareMeetingId] = useState(null);
    
    const [currentProject, setCurrentProject] = useState(null);
    const [currentSubtask, setCurrentSubtask] = useState(null);
    const [currentMeeting, setCurrentMeeting] = useState(null);

    // --- Guest & Action Points State ---
    const [newGuestName, setNewGuestName] = useState('');
    const [newGuestPosition, setNewGuestPosition] = useState('');
    const [localActionPoints, setLocalActionPoints] = useState([]);

    // --- Data Aggregation ---
    const allTeamMembers = useMemo(() => {
        const fed = (federalCoordinators || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true").map(c => ({ ...c, _level: 'federal' }));
        const state = (stateCoordinators || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true").map(c => ({ ...c, _level: 'state' }));
        const loc = (localityCoordinators || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true").map(c => ({ ...c, _level: 'locality' }));
        
        return [...fed, ...state, ...loc].sort((a, b) => (a.nameAr || a.name).localeCompare(b.nameAr || b.name));
    }, [federalCoordinators, stateCoordinators, localityCoordinators]);

    const allActiveProjects = useMemo(() => {
        return (rawProjects || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
    }, [rawProjects]);

    const projects = useMemo(() => {
        return allActiveProjects
            .filter(p => p.unit === activeUnit)
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [allActiveProjects, activeUnit]);

    const meetings = useMemo(() => {
        return (rawMeetings || [])
            .filter(m => m.unit === activeUnit && m.isDeleted !== true && m.isDeleted !== "true")
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [rawMeetings, activeUnit]);

    const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);
    const activeMeeting = useMemo(() => meetings.find(m => m.id === activeMeetingId) || null, [meetings, activeMeetingId]);

    useEffect(() => {
        if (activeMeeting && activeMeeting.sessionDates?.length > 0) {
            if (!activeMeetingDate || !activeMeeting.sessionDates.includes(activeMeetingDate)) {
                setActiveMeetingDate(activeMeeting.sessionDates[activeMeeting.sessionDates.length - 1]);
            }
        } else {
            setActiveMeetingDate('');
        }
    }, [activeMeeting, activeMeetingDate]);

    // Compute the full list of potential assignees for Action Points (Invitees + Guests)
    const actionPointAssignees = useMemo(() => {
        const invitees = (activeMeeting?.invitees || []).map(name => ({
            value: name,
            label: getInviteeDetails(name, allTeamMembers).displayName
        }));
        const guests = (activeMeeting?.guests || []).map(g => ({
            value: g.name,
            label: `${g.name} (Guest)`
        }));
        return [...invitees, ...guests].sort((a, b) => a.label.localeCompare(b.label));
    }, [activeMeeting, allTeamMembers]);

    // --- KPI Calculations ---
    const { kpiStats, overdueTasksList, unitPerformance, personPerformance } = useMemo(() => {
        let totalProjects = allActiveProjects.length;
        let totalTasks = 0, completedTasks = 0, inProgressTasks = 0, pendingTasks = 0, overdueTasks = 0;
        let overdueList = [];
        const unitStats = {};
        const personStats = {};

        const now = new Date();
        now.setHours(0, 0, 0, 0); 

        allActiveProjects.forEach(p => {
            const uName = p.unit || 'Unknown Unit';
            if (!unitStats[uName]) unitStats[uName] = { total: 0, completed: 0 };

            if (p.subtasks && Array.isArray(p.subtasks)) {
                totalTasks += p.subtasks.length;
                p.subtasks.forEach(task => {
                    if (task.status === 'Completed') completedTasks++;
                    else if (task.status === 'In Progress') inProgressTasks++;
                    else pendingTasks++;

                    unitStats[uName].total++;
                    if (task.status === 'Completed') unitStats[uName].completed++;

                    const rName = task.responsible || 'Unassigned';
                    if (!personStats[rName]) personStats[rName] = { total: 0, completed: 0 };
                    personStats[rName].total++;
                    if (task.status === 'Completed') personStats[rName].completed++;

                    if (task.status !== 'Completed' && task.dueDate) {
                        const dueDateObj = new Date(task.dueDate);
                        dueDateObj.setHours(0, 0, 0, 0);
                        if (dueDateObj < now) {
                            overdueTasks++;
                            overdueList.push({ ...task, projectName: p.title, unitName: p.unit, projectId: p.id });
                        }
                    }
                });
            }
        });

        overdueList.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const formattedUnitPerformance = Object.entries(unitStats).map(([unit, stats]) => ({
            unit, total: stats.total, completed: stats.completed, rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        })).sort((a, b) => b.rate - a.rate);

        const formattedPersonPerformance = Object.entries(personStats).map(([name, stats]) => ({
            name, total: stats.total, completed: stats.completed, rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        })).sort((a, b) => b.total - a.total);

        return { 
            kpiStats: { totalProjects, totalTasks, completedTasks, inProgressTasks, pendingTasks, overdueTasks, completionRate },
            overdueTasksList: overdueList, unitPerformance: formattedUnitPerformance, personPerformance: formattedPersonPerformance
        };
    }, [allActiveProjects]);

    useEffect(() => {
        fetchProjects();
        fetchUnitMeetings();
        fetchFederalCoordinators();
        fetchStateCoordinators();
        fetchLocalityCoordinators();
    }, [fetchProjects, fetchUnitMeetings, fetchFederalCoordinators, fetchStateCoordinators, fetchLocalityCoordinators]);

    // --- Project Handlers ---
    const handleSaveProject = async (e) => {
        e.preventDefault();
        const payload = {
            id: currentProject?.id,
            title: currentProject.title,
            unit: activeUnit,
            subtasks: currentProject.subtasks || []
        };
        await upsertProject(payload);
        fetchProjects(true);
        setIsProjectModalOpen(false);
    };

    const handleDeleteProject = async (id, e) => {
        e.stopPropagation(); 
        if (window.confirm("Are you sure you want to delete this project and all its tasks?")) {
            await deleteProject(id);
            fetchProjects(true);
            if (activeProjectId === id) {
                setViewMode('unit-dashboard');
                setActiveProjectId(null);
            }
        }
    };

    const handleSaveSubtask = async (e) => {
        e.preventDefault();
        const projectToUpdate = allActiveProjects.find(p => p.id === activeProjectId);
        if (!projectToUpdate) return;

        let updatedSubtasks = [...(projectToUpdate.subtasks || [])];
        const now = new Date().toISOString(); 
        
        if (currentSubtask.id) {
            updatedSubtasks = updatedSubtasks.map(st => {
                if (st.id === currentSubtask.id) {
                    const updated = { ...currentSubtask };
                    if (st.status !== currentSubtask.status) {
                        updated.statusUpdatedAt = now;
                        if (currentSubtask.status === 'Completed') updated.completedAt = now;
                    }
                    return updated;
                }
                return st;
            });
        } else {
            updatedSubtasks.push({ 
                ...currentSubtask, id: Date.now().toString(), createdAt: now, statusUpdatedAt: now,
                ...(currentSubtask.status === 'Completed' ? { completedAt: now } : {})
            });
        }

        await upsertProject({ ...projectToUpdate, subtasks: updatedSubtasks });
        fetchProjects(true);
        setIsSubtaskModalOpen(false);
    };

    const handleDeleteSubtask = async (subtaskId) => {
        if (window.confirm("Delete this task?")) {
            const updatedSubtasks = activeProject.subtasks.filter(st => st.id !== subtaskId);
            await upsertProject({ ...activeProject, subtasks: updatedSubtasks });
            fetchProjects(true);
        }
    };

    // --- Meeting Handlers ---
    const handleSaveMeeting = async (e) => {
        e.preventDefault();
        try {
            // Generate the name map for public links
            const map = currentMeeting.inviteeNamesMap || {};
            (currentMeeting.invitees || []).forEach(inv => {
                if (!map[inv]) {
                    const m = allTeamMembers.find(x => x.name === inv);
                    map[inv] = m?.nameAr || m?.name || inv;
                }
            });

            const meetingData = {
                ...currentMeeting,
                unit: activeUnit,
                inviteeNamesMap: map,
                inviterNameAr: allTeamMembers.find(x => x.name === currentMeeting.inviter)?.nameAr || currentMeeting.inviter
            };

            await upsertUnitMeeting(meetingData);
            fetchUnitMeetings(true);
            setViewMode('unit-dashboard'); 
        } catch (error) {
            console.error("Error saving meeting", error);
            alert("Failed to save meeting.");
        }
    };

    const handleDeleteMeeting = async (id) => {
        if (window.confirm("Delete this entire meeting series and all associated reports?")) {
            await deleteUnitMeeting(id);
            fetchUnitMeetings(true);
            if (activeMeetingId === id) setViewMode('unit-dashboard');
        }
    };

    const handleUpdateActiveMeeting = async (updatedMeetingData) => {
        try {
            // Ensure map stays updated
            const map = updatedMeetingData.inviteeNamesMap || {};
            (updatedMeetingData.invitees || []).forEach(inv => {
                if (!map[inv]) {
                    const m = allTeamMembers.find(x => x.name === inv);
                    map[inv] = m?.nameAr || m?.name || inv;
                }
            });
            updatedMeetingData.inviteeNamesMap = map;
            updatedMeetingData.inviterNameAr = allTeamMembers.find(x => x.name === updatedMeetingData.inviter)?.nameAr || updatedMeetingData.inviter;

            await upsertUnitMeeting(updatedMeetingData);
            fetchUnitMeetings(true); 
        } catch (error) {
            console.error("Error updating meeting details", error);
        }
    };

    const handleAddMeetingSession = () => {
        const today = new Date().toISOString().split('T')[0];
        const newDate = window.prompt("Enter new session date (YYYY-MM-DD):", today);
        if (newDate) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                alert("Invalid format. Use YYYY-MM-DD.");
                return;
            }
            const currentDates = activeMeeting.sessionDates || [];
            if (!currentDates.includes(newDate)) {
                const updatedDates = [...currentDates, newDate].sort();
                handleUpdateActiveMeeting({ ...activeMeeting, sessionDates: updatedDates });
            } else {
                alert("This session date already exists.");
            }
        }
    };

    const handleToggleAttendance = (invitee, date) => {
        const currentAtt = activeMeeting.attendance || {};
        const inviteeAtt = currentAtt[invitee] || [];
        
        let newInviteeAtt;
        if (inviteeAtt.includes(date)) {
            newInviteeAtt = inviteeAtt.filter(d => d !== date);
        } else {
            newInviteeAtt = [...inviteeAtt, date];
        }

        handleUpdateActiveMeeting({
            ...activeMeeting,
            attendance: { ...currentAtt, [invitee]: newInviteeAtt }
        });
    };

    const handleAddGuestToMeeting = async () => {
        if (!newGuestName.trim()) {
            alert("Guest name is required.");
            return;
        }

        const newGuest = {
            name: newGuestName.trim(),
            position: newGuestPosition.trim() || 'Guest'
        };

        const updatedGuests = [...(activeMeeting.guests || []), newGuest];
        
        try {
            await handleUpdateActiveMeeting({
                ...activeMeeting,
                guests: updatedGuests
            });
            setNewGuestName('');
            setNewGuestPosition('');
            setIsAddGuestModalOpen(false);
        } catch (e) {
            console.error("Failed to add guest:", e);
        }
    };

    const handleConfirmInvitees = (newInvitees) => {
        const map = {};
        newInvitees.forEach(inv => {
            const m = allTeamMembers.find(x => x.name === inv);
            map[inv] = m?.nameAr || inv;
        });

        if (viewMode === 'meeting-form') {
            setCurrentMeeting({ ...currentMeeting, invitees: newInvitees, inviteeNamesMap: map });
        } else {
            handleUpdateActiveMeeting({ ...activeMeeting, invitees: newInvitees, inviteeNamesMap: map });
        }
    };

    const handleDateSelect = (e) => {
        const newDate = e.target.value;
        setActiveMeetingDate(newDate);
        if (activeMeeting) {
            setLocalActionPoints(activeMeeting.reports?.[newDate]?.actionPoints || []);
        }
    };

    // --- Helper Functions ---
    const getStatusIcon = (status) => {
        if (status === 'Completed') return <CheckCircle className="w-4 h-4 text-green-500" />;
        if (status === 'In Progress') return <PlayCircle className="w-4 h-4 text-blue-500" />;
        return <Clock className="w-4 h-4 text-orange-500" />;
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (isLoading.projects || isLoading.federalCoordinators || isLoading.unitMeetings) return <Spinner />;

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Project & Task Tracker" 
                subtitle="Manage and track projects and meetings across Child Health Program units."
            />

            {/* --- MAIN TABS --- */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex gap-6" aria-label="Tabs">
                    <button
                        onClick={() => {
                            setMainTab('units');
                            if (viewMode !== 'tasks' && viewMode !== 'meeting' && viewMode !== 'unit-dashboard' && viewMode !== 'meeting-form') {
                                setViewMode('units');
                            }
                        }}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            mainTab === 'units' 
                                ? 'border-sky-500 text-sky-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <FolderKanban className="w-4 h-4 inline-block mr-2 mb-1"/> Program Units
                    </button>
                    <button
                        onClick={() => setMainTab('dashboard')}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            mainTab === 'dashboard' 
                                ? 'border-sky-500 text-sky-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <BarChart2 className="w-4 h-4 inline-block mr-2 mb-1"/> Dashboard
                    </button>
                </nav>
            </div>

            {/* ========================================== */}
            {/* VIEW: DASHBOARD TAB                        */}
            {/* ========================================== */}
            {mainTab === 'dashboard' && (
                <div className="animate-in fade-in duration-300 space-y-6">
                    {/* GLOBAL KPI Summary Cards */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                            <Target className="text-sky-600" /> Overall Program Performance
                        </h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-gray-50 border-l-4 border-l-sky-500 p-4 rounded-r-lg">
                                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-1">
                                    <FolderKanban size={16} /> Total Projects
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{kpiStats.totalProjects}</div>
                            </div>
                            <div className="bg-gray-50 border-l-4 border-l-indigo-500 p-4 rounded-r-lg">
                                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mb-1">
                                    <ListTodo size={16} /> Total Tasks
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{kpiStats.totalTasks}</div>
                            </div>
                            <div className="bg-green-50 border-l-4 border-l-green-500 p-4 rounded-r-lg">
                                <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-1">
                                    <CheckCircle size={16} /> Completed Tasks
                                </div>
                                <div className="text-2xl font-bold text-green-800">{kpiStats.completedTasks}</div>
                            </div>
                            <div className="bg-red-50 border-l-4 border-l-red-500 p-4 rounded-r-lg">
                                <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-1">
                                    <AlertCircle size={16} /> Overdue Tasks
                                </div>
                                <div className="text-2xl font-bold text-red-700">{kpiStats.overdueTasks}</div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-semibold text-gray-700">Global Task Completion Rate</span>
                                <span className="font-bold text-sky-700">{kpiStats.completionRate}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div className="bg-sky-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${kpiStats.completionRate}%` }}></div>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                <span><strong className="text-blue-600">{kpiStats.inProgressTasks}</strong> In Progress</span>
                                <span><strong className="text-orange-500">{kpiStats.pendingTasks}</strong> Pending</span>
                            </div>
                        </div>
                    </div>

                    {/* Granular KPI Breakdowns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <div className="p-4 border-b flex items-center gap-2 bg-gray-50 rounded-t-lg">
                                <Layers className="text-indigo-600" size={20} />
                                <h3 className="text-lg font-bold text-gray-800">Performance by Unit</h3>
                            </div>
                            <CardBody className="p-0 max-h-96 overflow-y-auto">
                                {unitPerformance.length > 0 ? (
                                    <Table headers={["Program Unit", "Progress", "Rate"]}>
                                        {unitPerformance.map(u => (
                                            <tr key={u.unit} className="hover:bg-gray-50">
                                                <td className="p-3 text-sm font-medium text-gray-800">{u.unit}</td>
                                                <td className="p-3 w-1/2">
                                                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{u.completed} / {u.total}</span></div>
                                                    <div className="w-full bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${u.rate === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${u.rate}%` }}></div></div>
                                                </td>
                                                <td className="p-3 text-sm font-bold text-right"><span className={u.rate === 100 ? 'text-green-600' : 'text-gray-700'}>{u.rate}%</span></td>
                                            </tr>
                                        ))}
                                    </Table>
                                ) : (
                                    <div className="p-6 text-center text-gray-500 text-sm">No unit data available.</div>
                                )}
                            </CardBody>
                        </Card>

                        <Card>
                            <div className="p-4 border-b flex items-center gap-2 bg-gray-50 rounded-t-lg">
                                <UserCheck className="text-emerald-600" size={20} />
                                <h3 className="text-lg font-bold text-gray-800">Performance by Team Member</h3>
                            </div>
                            <CardBody className="p-0 max-h-96 overflow-y-auto">
                                {personPerformance.length > 0 ? (
                                    <Table headers={["Team Member", "Progress", "Rate"]}>
                                        {personPerformance.map(p => (
                                            <tr key={p.name} className="hover:bg-gray-50">
                                                <td className="p-3 text-sm font-medium text-gray-800">{p.name}</td>
                                                <td className="p-3 w-1/2">
                                                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{p.completed} / {p.total}</span></div>
                                                    <div className="w-full bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${p.rate === 100 ? 'bg-green-500' : 'bg-emerald-500'}`} style={{ width: `${p.rate}%` }}></div></div>
                                                </td>
                                                <td className="p-3 text-sm font-bold text-right"><span className={p.rate === 100 ? 'text-green-600' : 'text-gray-700'}>{p.rate}%</span></td>
                                            </tr>
                                        ))}
                                    </Table>
                                ) : (
                                    <div className="p-6 text-center text-gray-500 text-sm">No team member data available.</div>
                                )}
                            </CardBody>
                        </Card>
                    </div>

                    <Card>
                        <div className="p-4 border-b flex items-center gap-2 bg-red-50 text-red-800 rounded-t-lg">
                            <AlertTriangle className="w-5 h-5" />
                            <h3 className="text-lg font-bold">Action Required: Overdue Tasks</h3>
                        </div>
                        <CardBody className="p-0 max-h-96 overflow-y-auto">
                            {overdueTasksList.length > 0 ? (
                                <Table headers={["Program Unit", "Project", "Task", "Responsible", "Due Date", "Action"]}>
                                    {overdueTasksList.map((task, idx) => (
                                        <tr key={`${task.id}-${idx}`} className="hover:bg-red-50/50 transition-colors">
                                            <td className="p-3 text-sm font-medium text-gray-800">{task.unitName}</td>
                                            <td className="p-3 text-sm text-gray-600">{task.projectName}</td>
                                            <td className="p-3 text-sm text-gray-800">{task.description}</td>
                                            <td className="p-3 text-sm text-gray-600">{task.responsible || 'Unassigned'}</td>
                                            <td className="p-3 text-sm font-bold text-red-600">{formatDate(task.dueDate)}</td>
                                            <td className="p-3 text-right">
                                                <Button size="sm" variant="secondary" onClick={() => {
                                                    setActiveUnit(task.unitName);
                                                    setActiveProjectId(task.projectId);
                                                    setMainTab('units');
                                                    setViewMode('tasks');
                                                }}>
                                                    Go to Project <ArrowRight className="w-3 h-3 ml-1 inline" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </Table>
                            ) : (
                                <div className="p-10 text-center flex flex-col items-center justify-center">
                                    <div className="bg-green-100 p-4 rounded-full mb-3"><CheckCircle className="w-8 h-8 text-green-600" /></div>
                                    <h4 className="text-gray-800 font-bold text-lg">You're all caught up!</h4>
                                    <p className="text-gray-500 text-sm">There are no overdue tasks in the system right now.</p>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* ========================================== */}
            {/* VIEW: UNITS TAB                            */}
            {/* ========================================== */}
            {mainTab === 'units' && (
                <div className="animate-in fade-in duration-300">
                    
                    {/* Level 1: UNITS GRID */}
                    {viewMode === 'units' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {PROGRAM_UNITS_DATA.map((unit) => {
                                const Icon = unit.icon;
                                const unitProjects = allActiveProjects.filter(p => p.unit === unit.id);
                                const unitMeetings = (rawMeetings || []).filter(m => m.unit === unit.id && !m.isDeleted);
                                const unitTaskCount = unitProjects.reduce((acc, p) => acc + (p.subtasks?.length || 0), 0);

                                return (
                                    <div 
                                        key={unit.id}
                                        onClick={() => {
                                            setActiveUnit(unit.id);
                                            setViewMode('unit-dashboard');
                                            setUnitSubTab('projects');
                                        }}
                                        className="cursor-pointer h-full"
                                    >
                                        <Card className={`hover:-translate-y-1 hover:shadow-lg transition-all border ${unit.border} h-full`}>
                                            <CardBody className="flex flex-col items-center justify-center p-6 text-center">
                                                <div className={`p-4 rounded-full ${unit.bg} ${unit.color} mb-4`}>
                                                    <Icon size={40} />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-800">{unit.title}</h3>
                                                <div className="flex gap-2 mt-3 text-xs font-medium text-gray-500 bg-white px-3 py-1.5 rounded-full border shadow-sm items-center flex-wrap justify-center">
                                                    <span>{unitProjects.length} Projects</span>
                                                    <span className="text-gray-300">|</span>
                                                    <span>{unitTaskCount} Tasks</span>
                                                    <span className="text-gray-300">|</span>
                                                    <span>{unitMeetings.length} Meetings</span>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Level 2: UNIT DASHBOARD */}
                    {viewMode === 'unit-dashboard' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <div className="flex items-center gap-4 mb-4">
                                    <Button variant="secondary" onClick={() => setViewMode('units')}>
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Units
                                    </Button>
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <FolderKanban className="text-sky-600" /> {activeUnit} Dashboard
                                    </h3>
                                </div>
                                <div className="flex gap-4 border-b">
                                    <button 
                                        onClick={() => setUnitSubTab('projects')} 
                                        className={`pb-2 px-4 font-semibold text-sm transition-colors border-b-2 ${unitSubTab === 'projects' ? 'border-sky-500 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                                    >
                                        <FolderKanban className="w-4 h-4 inline mr-1 mb-0.5"/> Projects & Tasks
                                    </button>
                                    <button 
                                        onClick={() => setUnitSubTab('meetings')} 
                                        className={`pb-2 px-4 font-semibold text-sm transition-colors border-b-2 ${unitSubTab === 'meetings' ? 'border-sky-500 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                                    >
                                        <Users className="w-4 h-4 inline mr-1 mb-0.5"/> Meetings & Minutes
                                    </button>
                                </div>
                            </div>

                            {/* Sub-Tab: PROJECTS */}
                            {unitSubTab === 'projects' && (
                                <div>
                                    <div className="flex justify-end mb-4">
                                        <Button onClick={() => { 
                                            setCurrentProject({ title: '', subtasks: [] }); 
                                            setIsProjectModalOpen(true); 
                                        }}>
                                            <Plus className="w-4 h-4 mr-1" /> Add Project
                                        </Button>
                                    </div>

                                    {projects.length === 0 ? (
                                        <EmptyState message={`No projects found for ${activeUnit}. Click "Add Project" to get started.`} />
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {projects.map(project => {
                                                const totalTasks = project.subtasks?.length || 0;
                                                const completedTasks = project.subtasks?.filter(t => t.status === 'Completed').length || 0;
                                                const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                                                return (
                                                    <div 
                                                        key={project.id}
                                                        onClick={() => {
                                                            setActiveProjectId(project.id);
                                                            setViewMode('tasks');
                                                        }}
                                                        className="cursor-pointer h-full"
                                                    >
                                                        <Card className="hover:border-sky-400 hover:shadow-md transition-all group h-full">
                                                            <CardBody className="p-5 flex justify-between items-start">
                                                                <div className="w-full">
                                                                    <h4 className="text-lg font-bold text-gray-800 mb-2 pr-12">{project.title}</h4>
                                                                    
                                                                    <div className="mb-2">
                                                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                                            <span>{completedTasks} of {totalTasks} tasks</span>
                                                                            <span>{completionPct}%</span>
                                                                        </div>
                                                                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                                            <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${completionPct}%` }}></div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4">
                                                                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setCurrentProject(project); setIsProjectModalOpen(true); }}>
                                                                        <Edit className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button size="sm" variant="danger" onClick={(e) => handleDeleteProject(project.id, e)}>
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </CardBody>
                                                        </Card>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sub-Tab: MEETINGS (TABLE VIEW) */}
                            {unitSubTab === 'meetings' && (
                                <div>
                                    <div className="flex justify-end mb-4">
                                        <Button onClick={() => { 
                                            setCurrentMeeting({ 
                                                title: '', schedule: '', inviter: '', invitees: [], guests: [], agenda: '', link: '', place: '', 
                                                sessionDates: [], attendance: {}, reports: {} 
                                            }); 
                                            setViewMode('meeting-form'); 
                                        }}>
                                            <Plus className="w-4 h-4 mr-1" /> Add New Meeting
                                        </Button>
                                    </div>
                                    
                                    {meetings.length === 0 ? (
                                        <EmptyState message={`No meetings configured for ${activeUnit}.`} />
                                    ) : (
                                        <Card className="overflow-hidden">
                                            <Table headers={["Meeting Title", "Schedule / Frequency", "Inviter", "Attendees", "Recorded Sessions", "Actions"]}>
                                                {meetings.map(m => {
                                                    const totalAttendees = (m.invitees?.length || 0) + (m.guests?.length || 0);
                                                    return (
                                                        <tr key={m.id} className="hover:bg-gray-50">
                                                            <td className="p-3 border font-medium text-gray-900">{m.title}</td>
                                                            <td className="p-3 border text-gray-600 text-sm">{m.schedule || 'Not specified'}</td>
                                                            <td className="p-3 border text-gray-600 text-sm">
                                                                {m.inviterNameAr || m.inviter}
                                                            </td>
                                                            <td className="p-3 border text-gray-600 text-sm">
                                                                <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                                                                    {totalAttendees}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 border text-gray-600 text-sm">
                                                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">
                                                                    {m.sessionDates?.length || 0}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 border text-right">
                                                                <div className="flex gap-2 justify-end">
                                                                    <Button size="sm" variant="secondary" className="flex items-center gap-1" onClick={() => { setActiveMeetingId(m.id); setMeetingSubTab('overview'); setViewMode('meeting'); }}>
                                                                        <Eye className="w-3.5 h-3.5" /> View
                                                                    </Button>
                                                                    <Button size="sm" variant="secondary" className="flex items-center gap-1" onClick={() => { setActiveMeetingId(m.id); setMeetingSubTab('attendance'); setViewMode('meeting'); }}>
                                                                        <Users className="w-3.5 h-3.5" /> Attendance
                                                                    </Button>
                                                                    <Button size="sm" variant="secondary" className="flex items-center gap-1" onClick={() => { setActiveMeetingId(m.id); setMeetingSubTab('reports'); setViewMode('meeting'); }}>
                                                                        <FileText className="w-3.5 h-3.5" /> Report
                                                                    </Button>
                                                                    <Button size="sm" variant="secondary" className="flex items-center gap-1" onClick={() => { 
                                                                        setActiveMeetingId(m.id); 
                                                                        setMeetingSubTab('actions'); 
                                                                        const latestDate = activeMeetingDate || m.sessionDates?.[m.sessionDates?.length - 1];
                                                                        setLocalActionPoints(m.reports?.[latestDate]?.actionPoints || []);
                                                                        setViewMode('meeting'); 
                                                                    }}>
                                                                        <CheckSquare className="w-3.5 h-3.5" /> Actions
                                                                    </Button>
                                                                    <Button size="sm" variant="secondary" className="flex items-center gap-1" onClick={() => { setCurrentMeeting(m); setViewMode('meeting-form'); }}>
                                                                        <Edit className="w-3.5 h-3.5" /> Edit
                                                                    </Button>
                                                                    <Button size="sm" variant="secondary" className="flex items-center gap-1" onClick={() => setShareMeetingId(m.id)}>
                                                                        <Share2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <Button size="sm" variant="danger" onClick={() => handleDeleteMeeting(m.id)}>
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </Table>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Level 3: FULL PAGE MEETING FORM (Add / Edit) */}
                    {viewMode === 'meeting-form' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-indigo-500">
                                <div className="flex items-center gap-4">
                                    <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); setViewMode('unit-dashboard'); }}>
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                                    </Button>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{currentMeeting?.id ? 'Edit Meeting Series' : 'Setup New Meeting Series'}</h3>
                                        <p className="text-sm text-gray-500">{activeUnit}</p>
                                    </div>
                                </div>
                            </div>

                            <Card>
                                <form onSubmit={handleSaveMeeting}>
                                    <CardBody className="space-y-6 p-6">
                                        <FormGroup label="Meeting Title">
                                            <Input value={currentMeeting?.title || ''} onChange={(e) => setCurrentMeeting({...currentMeeting, title: e.target.value})} required placeholder="e.g., Q3 Strategy Review"/>
                                        </FormGroup>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormGroup label="Schedule / Frequency">
                                                <Input value={currentMeeting?.schedule || ''} onChange={(e) => setCurrentMeeting({...currentMeeting, schedule: e.target.value})} placeholder="e.g., Every Monday at 10 AM"/>
                                            </FormGroup>
                                            <FormGroup label="Location / Place">
                                                <Input value={currentMeeting?.place || ''} onChange={(e) => setCurrentMeeting({...currentMeeting, place: e.target.value})} placeholder="e.g., Conference Room B"/>
                                            </FormGroup>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormGroup label="Inviter">
                                                <Select value={currentMeeting?.inviter || ''} onChange={(e) => setCurrentMeeting({...currentMeeting, inviter: e.target.value})} required>
                                                    <option value="">-- Select Inviter --</option>
                                                    {allTeamMembers.map(t=><option key={t.id} value={t.name}>{t.nameAr || t.name} ({t._level})</option>)}
                                                </Select>
                                            </FormGroup>
                                            <FormGroup label="Virtual Link (Optional)">
                                                <Input type="url" value={currentMeeting?.link || ''} onChange={(e) => setCurrentMeeting({...currentMeeting, link: e.target.value})} placeholder="https://zoom.us/j/..."/>
                                            </FormGroup>
                                        </div>
                                        
                                        <FormGroup label="Invitees">
                                            <div className="border border-gray-300 rounded-md p-4 min-h-[6rem] max-h-96 overflow-y-auto bg-gray-50 flex flex-col gap-3 shadow-sm mb-3">
                                                {currentMeeting?.invitees?.length > 0 || currentMeeting?.guests?.length > 0 ? (
                                                    Object.entries(groupInviteesByState(currentMeeting.invitees, currentMeeting.guests, allTeamMembers)).map(([state, invs]) => (
                                                        <div key={state} className="w-full bg-white p-3 rounded border border-gray-200">
                                                            <div className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">{state}</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {invs.map(inv => (
                                                                    <span key={inv.name} className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-md text-sm font-medium shadow-sm flex items-center">
                                                                        {inv.displayName} <span className="text-indigo-300 mx-2">|</span> <span className="text-indigo-600 text-xs font-normal">{inv.position}</span>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-400 italic text-sm mt-2 text-center">No invitees selected yet. Click the button below to add.</span>
                                                )}
                                            </div>
                                            <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); setIsInviteeModalOpen(true); }} className="w-full md:w-auto justify-center">
                                                <Users className="w-4 h-4 mr-2" /> Select / Manage Invitees
                                            </Button>
                                        </FormGroup>
                                        
                                        <FormGroup label="Standard Agenda">
                                            <textarea className="w-full border rounded-md p-3 text-sm focus:ring-sky-500 focus:border-sky-500 min-h-[100px]" value={currentMeeting?.agenda || ''} onChange={(e) => setCurrentMeeting({...currentMeeting, agenda: e.target.value})} placeholder="Main topics routinely covered..."/>
                                        </FormGroup>
                                    </CardBody>
                                    <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-lg">
                                        <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); setViewMode('unit-dashboard'); }}>Cancel</Button>
                                        <Button type="submit">Save Meeting Settings</Button>
                                    </div>
                                </form>
                            </Card>
                        </div>
                    )}

                    {/* Level 3: TASKS LIST */}
                    {viewMode === 'tasks' && activeProject && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-sky-500">
                                <div className="flex items-center gap-4">
                                    <Button variant="secondary" onClick={() => { setViewMode('unit-dashboard'); setUnitSubTab('projects'); }}>
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Projects
                                    </Button>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{activeProject.title}</h3>
                                        <p className="text-sm text-gray-500">{activeUnit}</p>
                                    </div>
                                </div>
                                <Button onClick={() => {
                                    setCurrentSubtask({ description: '', responsible: '', dueDate: '', status: 'Pending' });
                                    setIsSubtaskModalOpen(true);
                                }}>
                                    <Plus className="w-4 h-4 mr-1" /> Add Task
                                </Button>
                            </div>

                            <Card>
                                <CardBody className="p-0">
                                    {activeProject.subtasks && activeProject.subtasks.length > 0 ? (
                                        <Table headers={["Task Description", "Responsible", "Due Date", "Status", "Timestamps", "Actions"]}>
                                            {activeProject.subtasks.map(task => {
                                                const isOverdue = task.status !== 'Completed' && task.dueDate && new Date(task.dueDate) < new Date();
                                                return (
                                                    <tr key={task.id} className="hover:bg-gray-50">
                                                        <td className="p-4 text-sm font-medium">{task.description}</td>
                                                        <td className="p-4 text-sm text-gray-600">{task.responsible || 'Unassigned'}</td>
                                                        <td className="p-4 text-sm">
                                                            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-bold bg-red-50 p-1 rounded w-max' : 'text-gray-600'}`}>
                                                                <Calendar className="w-3 h-3" /> {formatDate(task.dueDate)}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-sm">
                                                            <span className="flex items-center gap-1 font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-full w-max border">
                                                                {getStatusIcon(task.status)} {task.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-xs text-gray-500 space-y-1">
                                                            <div><strong className="text-gray-700">Created:</strong> {formatDate(task.createdAt)}</div>
                                                            {task.statusUpdatedAt && <div><strong className="text-gray-700">Updated:</strong> {formatDate(task.statusUpdatedAt)}</div>}
                                                            {task.completedAt && <div className="text-green-600"><strong className="text-green-700">Completed:</strong> {formatDate(task.completedAt)}</div>}
                                                        </td>
                                                        <td className="p-4 text-right border-l">
                                                            <div className="flex justify-end gap-2">
                                                                <Button size="sm" variant="secondary" onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setCurrentSubtask(task);
                                                                    setIsSubtaskModalOpen(true);
                                                                }}>Edit</Button>
                                                                <Button size="sm" variant="danger" onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleDeleteSubtask(task.id);
                                                                }}>Delete</Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </Table>
                                    ) : (
                                        <div className="p-10 text-center">
                                            <div className="mx-auto bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                                                <Clock className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <h4 className="text-gray-800 font-semibold text-lg">No tasks assigned yet</h4>
                                            <p className="text-gray-500 text-sm mt-1 mb-4">Break down this project into actionable tasks.</p>
                                            <Button variant="secondary" onClick={(e) => {
                                                e.preventDefault();
                                                setCurrentSubtask({ description: '', responsible: '', dueDate: '', status: 'Pending' });
                                                setIsSubtaskModalOpen(true);
                                            }}>
                                                Create First Task
                                            </Button>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {/* Level 3: MEETING TABS (Overview, Attendance, Reports) */}
                    {viewMode === 'meeting' && activeMeeting && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            
                            {/* Meeting Header */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-indigo-500">
                                <div className="flex items-center gap-4 mb-4">
                                    <Button variant="secondary" onClick={() => { setViewMode('unit-dashboard'); setUnitSubTab('meetings'); }}>
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Meetings List
                                    </Button>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{activeMeeting.title}</h3>
                                        <p className="text-sm text-gray-500">{activeUnit} • {activeMeeting.schedule || 'No schedule set'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 border-b">
                                    <button onClick={() => setMeetingSubTab('overview')} className={`pb-2 px-4 font-semibold text-sm transition-colors border-b-2 ${meetingSubTab === 'overview' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Overview</button>
                                    <button onClick={() => setMeetingSubTab('attendance')} className={`pb-2 px-4 font-semibold text-sm transition-colors border-b-2 ${meetingSubTab === 'attendance' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Attendance Tracker</button>
                                    <button onClick={() => setMeetingSubTab('reports')} className={`pb-2 px-4 font-semibold text-sm transition-colors border-b-2 ${meetingSubTab === 'reports' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Meeting Minutes</button>
                                    <button onClick={() => { 
                                        setMeetingSubTab('actions'); 
                                        setLocalActionPoints(activeMeeting?.reports?.[activeMeetingDate]?.actionPoints || []);
                                    }} className={`pb-2 px-4 font-semibold text-sm transition-colors border-b-2 ${meetingSubTab === 'actions' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Action Points</button>
                                </div>
                            </div>

                            {/* Meeting Sub-Tab: OVERVIEW */}
                            {meetingSubTab === 'overview' && (
                                <Card>
                                    <CardBody className="p-6">
                                        <h4 className="font-bold border-b pb-2 text-gray-800 mb-4 flex items-center gap-2"><Eye className="w-5 h-5"/> Meeting Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <div className="flex gap-2"><Calendar className="w-5 h-5 text-gray-400"/> <span><strong>Schedule:</strong> {activeMeeting.schedule || 'N/A'}</span></div>
                                                <div className="flex gap-2"><UserCheck className="w-5 h-5 text-gray-400"/> <span><strong>Inviter:</strong> {activeMeeting.inviterNameAr || activeMeeting.inviter}</span></div>
                                                <div className="flex gap-2">
                                                    <Users className="w-5 h-5 text-gray-400"/> 
                                                    <span><strong>Total Attendees:</strong> {(activeMeeting.invitees?.length || 0) + (activeMeeting.guests?.length || 0)}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {activeMeeting.place && <div className="flex gap-2"><MapPin className="w-5 h-5 text-gray-400"/> <span><strong>Location:</strong> {activeMeeting.place}</span></div>}
                                                {activeMeeting.link && <div className="flex gap-2"><Video className="w-5 h-5 text-gray-400"/> <span><strong>Link:</strong> <a href={activeMeeting.link} target="_blank" rel="noreferrer" className="text-blue-500 underline truncate">{activeMeeting.link}</a></span></div>}
                                            </div>
                                        </div>
                                        <div className="mt-6">
                                            <h5 className="font-bold text-gray-700 mb-2">Standard Agenda</h5>
                                            <div className="p-4 bg-gray-50 rounded border text-gray-700 whitespace-pre-wrap">
                                                {activeMeeting.agenda || 'No agenda provided.'}
                                            </div>
                                        </div>
                                        <div className="mt-6 border-t pt-4">
                                            <h5 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Users className="w-5 h-5"/> Detailed Invitee List</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {Object.entries(groupInviteesByState(activeMeeting.invitees, activeMeeting.guests, allTeamMembers)).map(([state, invs]) => (
                                                    <div key={state} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                                        <h6 className="font-bold text-indigo-900 border-b border-indigo-100 pb-2 mb-3">{state}</h6>
                                                        <ul className="space-y-2">
                                                            {invs.map(inv => (
                                                                <li key={inv.name} className="text-sm">
                                                                    <div className="font-semibold text-gray-800">{inv.displayName}</div>
                                                                    <div className="text-xs text-gray-500">{inv.position}</div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                                {(!activeMeeting.invitees || activeMeeting.invitees.length === 0) && (!activeMeeting.guests || activeMeeting.guests.length === 0) && (
                                                    <div className="text-sm text-gray-500 col-span-full">No invitees added yet.</div>
                                                )}
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            )}

                            {/* Meeting Sub-Tab: ATTENDANCE */}
                            {meetingSubTab === 'attendance' && (
                                <Card>
                                    <CardBody className="p-0">
                                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 flex-wrap gap-4">
                                            <h4 className="font-bold text-gray-800 flex items-center gap-2"><Users className="w-5 h-5"/> Multi-Session Attendance</h4>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); setIsAddGuestModalOpen(true); }}>
                                                    <UserPlus className="w-4 h-4 mr-1" /> Add Guest
                                                </Button>
                                                <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); setIsInviteeModalOpen(true); }}>
                                                    <Users className="w-4 h-4 mr-1" /> Manage Invitees
                                                </Button>
                                                <Button size="sm" onClick={handleAddMeetingSession}>
                                                    <Plus className="w-4 h-4 mr-1"/> Add Session Date
                                                </Button>
                                            </div>
                                        </div>

                                        {!activeMeeting.sessionDates || activeMeeting.sessionDates.length === 0 ? (
                                            <EmptyState message="No session dates added. Click 'Add Session Date' to begin tracking attendance." />
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm border-collapse">
                                                    <thead className="bg-gray-100 text-gray-600">
                                                        <tr>
                                                            <th className="p-3 border font-semibold">Invitee Name</th>
                                                            <th className="p-3 border font-semibold">State / Level</th>
                                                            <th className="p-3 border font-semibold">Position</th>
                                                            {activeMeeting.sessionDates.map(date => (
                                                                <th key={date} className="p-3 border font-semibold text-center whitespace-nowrap">{date}</th>
                                                            ))}
                                                            <th className="p-3 border font-semibold text-center">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(() => {
                                                            const regularDetails = (activeMeeting.invitees || []).map(name => getInviteeDetails(name, allTeamMembers));
                                                            const guestDetails = (activeMeeting.guests || []).map(g => ({
                                                                name: g.name,
                                                                displayName: g.name,
                                                                state: 'External / Guest',
                                                                position: g.position,
                                                                level: 'guest',
                                                                isGuest: true
                                                            }));
                                                            
                                                            const sortedInvitees = [...regularDetails, ...guestDetails].sort((a, b) => a.state.localeCompare(b.state) || a.displayName.localeCompare(b.displayName));

                                                            return sortedInvitees.map(inv => {
                                                                const inviteeAtt = activeMeeting.attendance?.[inv.name] || [];
                                                                return (
                                                                    <tr key={inv.name} className="border-b hover:bg-gray-50">
                                                                        <td className="p-3 border font-medium text-gray-800">
                                                                            {inv.displayName} {inv.isGuest && <span className="text-xs text-indigo-500 ml-1">(Guest)</span>}
                                                                        </td>
                                                                        <td className="p-3 border text-gray-600 text-xs">
                                                                            {inv.state}
                                                                        </td>
                                                                        <td className="p-3 border text-gray-600 text-xs">{inv.position}</td>
                                                                        {activeMeeting.sessionDates.map(date => (
                                                                            <td key={date} className="p-3 border text-center">
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    checked={inviteeAtt.includes(date)} 
                                                                                    onChange={() => handleToggleAttendance(inv.name, date)}
                                                                                    className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                                                                                />
                                                                            </td>
                                                                        ))}
                                                                        <td className="p-3 border text-center font-bold text-gray-600 bg-gray-50">
                                                                            {inviteeAtt.length} / {activeMeeting.sessionDates.length}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            });
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </CardBody>
                                </Card>
                            )}

                            {/* Meeting Sub-Tab: MEETING MINUTES (No Auto-save Actions here anymore) */}
                            {meetingSubTab === 'reports' && (
                                <div className="space-y-6">
                                    {!activeMeeting.sessionDates || activeMeeting.sessionDates.length === 0 ? (
                                        <EmptyState message="No sessions available to report on. Go to the Attendance Tracker to add a session date first." />
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4 bg-gray-50 p-4 border rounded-lg">
                                                <span className="font-semibold text-gray-700">Select Session Date:</span>
                                                <Select value={activeMeetingDate} onChange={handleDateSelect} className="w-48 bg-white">
                                                    {activeMeeting.sessionDates.map(d => <option key={d} value={d}>{d}</option>)}
                                                </Select>
                                            </div>

                                            {activeMeetingDate && (
                                                <Card>
                                                    <CardBody className="p-4">
                                                        <h4 className="font-bold border-b pb-2 text-gray-800 mb-3 flex items-center gap-2"><FileText className="w-5 h-5"/> Meeting Minutes & Discussion ({activeMeetingDate})</h4>
                                                        <textarea 
                                                            className="w-full h-64 p-3 border rounded focus:ring-indigo-500 focus:border-indigo-500" 
                                                            placeholder="Document main discussion points from this specific meeting..."
                                                            value={activeMeeting.reports?.[activeMeetingDate]?.discussionPoints || ''}
                                                            onChange={(e) => {
                                                                const dateReport = activeMeeting.reports?.[activeMeetingDate] || { discussionPoints: '', actionPoints: [] };
                                                                const updated = { 
                                                                    ...activeMeeting, 
                                                                    reports: { ...activeMeeting.reports, [activeMeetingDate]: { ...dateReport, discussionPoints: e.target.value } }
                                                                };
                                                                handleUpdateActiveMeeting(updated);
                                                            }}
                                                        />
                                                    </CardBody>
                                                </Card>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Meeting Sub-Tab: ACTION POINTS (Manual Save) */}
                            {meetingSubTab === 'actions' && (
                                <div className="space-y-6">
                                    {!activeMeeting.sessionDates || activeMeeting.sessionDates.length === 0 ? (
                                        <EmptyState message="No sessions available to add actions to. Go to the Attendance Tracker to add a session date first." />
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4 bg-gray-50 p-4 border rounded-lg">
                                                <span className="font-semibold text-gray-700">Select Session Date:</span>
                                                <Select value={activeMeetingDate} onChange={handleDateSelect} className="w-48 bg-white">
                                                    {activeMeeting.sessionDates.map(d => <option key={d} value={d}>{d}</option>)}
                                                </Select>
                                            </div>

                                            {activeMeetingDate && (
                                                <Card>
                                                    <CardBody className="p-4">
                                                        <div className="flex justify-between items-center border-b pb-2 mb-3">
                                                            <h4 className="font-bold text-gray-800 flex items-center gap-2"><CheckSquare className="w-5 h-5"/> Action Points Matrix ({activeMeetingDate})</h4>
                                                            <div className="flex gap-2">
                                                                <Button size="sm" variant="secondary" onClick={() => {
                                                                    const newAction = { id: Date.now().toString(), what: '', who: '', when: '', indicator: '', status: 'Pending' };
                                                                    setLocalActionPoints([...localActionPoints, newAction]);
                                                                }}>
                                                                    <Plus className="w-4 h-4 mr-1"/> Add Action
                                                                </Button>
                                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 border-green-600" onClick={() => {
                                                                    const dateReport = activeMeeting.reports?.[activeMeetingDate] || { discussionPoints: '', actionPoints: [] };
                                                                    handleUpdateActiveMeeting({ 
                                                                        ...activeMeeting, 
                                                                        reports: { ...activeMeeting.reports, [activeMeetingDate]: { ...dateReport, actionPoints: localActionPoints } }
                                                                    });
                                                                    alert('Action points saved successfully!');
                                                                }}>
                                                                    <Save className="w-4 h-4 mr-1"/> Save Changes
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-sm">
                                                                <thead className="bg-gray-100 text-gray-600">
                                                                    <tr>
                                                                        <th className="p-2">What (Action)</th>
                                                                        <th className="p-2 w-40">Who</th>
                                                                        <th className="p-2 w-36">When</th>
                                                                        <th className="p-2">Indicator</th>
                                                                        <th className="p-2 w-36">Status</th>
                                                                        <th className="p-2 w-12"></th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {localActionPoints.map((action, idx) => (
                                                                        <tr key={action.id} className="border-b">
                                                                            <td className="p-1">
                                                                                <Input bsSize="sm" value={action.what} onChange={e => { 
                                                                                    const copy = [...localActionPoints]; 
                                                                                    copy[idx].what = e.target.value; 
                                                                                    setLocalActionPoints(copy);
                                                                                }}/>
                                                                            </td>
                                                                            <td className="p-1">
                                                                                <Select bsSize="sm" value={action.who} onChange={e => { 
                                                                                    const copy = [...localActionPoints]; 
                                                                                    copy[idx].who = e.target.value; 
                                                                                    setLocalActionPoints(copy);
                                                                                }}>
                                                                                    <option value="">- Select -</option>
                                                                                    {actionPointAssignees.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                                </Select>
                                                                            </td>
                                                                            <td className="p-1">
                                                                                <Input type="date" bsSize="sm" value={action.when} onChange={e => { 
                                                                                    const copy = [...localActionPoints]; 
                                                                                    copy[idx].when = e.target.value; 
                                                                                    setLocalActionPoints(copy);
                                                                                }}/>
                                                                            </td>
                                                                            <td className="p-1">
                                                                                <Input bsSize="sm" value={action.indicator} onChange={e => { 
                                                                                    const copy = [...localActionPoints]; 
                                                                                    copy[idx].indicator = e.target.value; 
                                                                                    setLocalActionPoints(copy);
                                                                                }}/>
                                                                            </td>
                                                                            <td className="p-1">
                                                                                <Select bsSize="sm" value={action.status} onChange={e => { 
                                                                                    const copy = [...localActionPoints]; 
                                                                                    copy[idx].status = e.target.value; 
                                                                                    setLocalActionPoints(copy);
                                                                                }}>
                                                                                    {STATUS_OPTIONS.map(opt=><option key={opt} value={opt}>{opt}</option>)}
                                                                                </Select>
                                                                            </td>
                                                                            <td className="p-1 text-right">
                                                                                <Button size="sm" variant="danger" onClick={() => { 
                                                                                    const copy = localActionPoints.filter(a => a.id !== action.id); 
                                                                                    setLocalActionPoints(copy);
                                                                                }}>
                                                                                    <Trash2 className="w-3 h-3"/>
                                                                               </Button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                    {localActionPoints.length === 0 && (
                                                                        <tr>
                                                                            <td colSpan="6" className="text-center p-4 text-gray-500 italic">No action points drafted. Click "Add Action" to begin.</td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </CardBody>
                                                </Card>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                        </div>
                    )}
                </div>
            )}

            {/* --- MODALS --- */}
            
            {/* Guest Modal */}
            <Modal isOpen={isAddGuestModalOpen} onClose={() => setIsAddGuestModalOpen(false)} title="Add Guest Attendee">
                <div className="p-6 space-y-4">
                    <FormGroup label="Guest Name">
                        <Input value={newGuestName} onChange={(e) => setNewGuestName(e.target.value)} placeholder="e.g., John Doe" />
                    </FormGroup>
                    <FormGroup label="Position / Role (Optional)">
                        <Input value={newGuestPosition} onChange={(e) => setNewGuestPosition(e.target.value)} placeholder="e.g., External Consultant" />
                    </FormGroup>
                </div>
                <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                    <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); setIsAddGuestModalOpen(false); }}>Cancel</Button>
                    <Button onClick={(e) => { e.preventDefault(); handleAddGuestToMeeting(); }}>Add Guest</Button>
                </div>
            </Modal>

            <InviteeSelectionModal
                isOpen={isInviteeModalOpen}
                onClose={() => setIsInviteeModalOpen(false)}
                allMembers={allTeamMembers}
                selectedNames={viewMode === 'meeting-form' ? (currentMeeting?.invitees || []) : (activeMeeting?.invitees || [])}
                onConfirm={handleConfirmInvitees}
            />

            {/* Project Modal */}
            <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title={`${currentProject?.id ? 'Edit' : 'Add'} Project`}>
                <form onSubmit={handleSaveProject}>
                    <CardBody className="space-y-4">
                        <FormGroup label="Project / Main Task Title">
                            <Input 
                                value={currentProject?.title || ''} 
                                onChange={(e) => setCurrentProject({...currentProject, title: e.target.value})} 
                                required 
                                placeholder="Enter project name..."
                            />
                        </FormGroup>
                    </CardBody>
                    <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                        <Button type="button" variant="secondary" onClick={() => setIsProjectModalOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Project</Button>
                    </div>
                </form>
            </Modal>

            {/* Subtask Modal */}
            <Modal isOpen={isSubtaskModalOpen} onClose={() => setIsSubtaskModalOpen(false)} title={`${currentSubtask?.id ? 'Edit' : 'Add'} Task`}>
                <form onSubmit={handleSaveSubtask}>
                    <CardBody className="space-y-4">
                        <FormGroup label="Task Description">
                            <Input value={currentSubtask?.description || ''} onChange={(e) => setCurrentSubtask({...currentSubtask, description: e.target.value})} required placeholder="Describe the task..."/>
                        </FormGroup>
                        <FormGroup label="Who is Responsible?">
                            <Select value={currentSubtask?.responsible || ''} onChange={(e) => setCurrentSubtask({...currentSubtask, responsible: e.target.value})} required>
                                <option value="">-- Select Team Member --</option>
                                {allTeamMembers.map(t => <option key={t.id} value={t.name}>{t.nameAr || t.name} ({t._level})</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="Target Completion Date (Due Date)">
                            <Input type="date" value={currentSubtask?.dueDate || ''} onChange={(e) => setCurrentSubtask({...currentSubtask, dueDate: e.target.value})} required />
                        </FormGroup>
                        <FormGroup label="Status">
                            <Select value={currentSubtask?.status || 'Pending'} onChange={(e) => setCurrentSubtask({...currentSubtask, status: e.target.value})}>
                                {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </Select>
                        </FormGroup>
                    </CardBody>
                    <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                        <Button type="button" variant="secondary" onClick={() => setIsSubtaskModalOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Task</Button>
                    </div>
                </form>
            </Modal>

            {/* Share Modal */}
            {shareMeetingId && (
                <Modal isOpen={!!shareMeetingId} onClose={() => setShareMeetingId(null)} title="Share Meeting Link">
                    <CardBody className="p-6 text-center space-y-4">
                        <Share2 className="w-12 h-12 text-sky-500 mx-auto" />
                        <h4 className="font-bold text-gray-800">Share Public Meeting Link</h4>
                        <p className="text-sm text-gray-600">Send this link to invitees so they can log their own attendance or view minutes.</p>
                        <div className="bg-gray-100 p-3 rounded border flex justify-between items-center">
                            <span className="text-sm truncate text-gray-500 select-all">{`${window.location.origin}/public/meeting/${shareMeetingId}`}</span>
                            <Button size="sm" variant="secondary" className="flex items-center gap-1" onClick={(e) => {
                                e.preventDefault();
                                navigator.clipboard.writeText(`${window.location.origin}/public/meeting/${shareMeetingId}`);
                                alert('Link copied to clipboard!');
                            }}>
                                <LinkIcon size={14} /> Copy
                            </Button>
                        </div>
                    </CardBody>
                    <div className="p-4 border-t flex justify-end bg-gray-50 rounded-b-lg">
                        <Button type="button" variant="secondary" onClick={(e) => { e.preventDefault(); setShareMeetingId(null); }}>Close</Button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// --- PUBLIC MEETING ATTENDANCE VIEW ---
export function PublicMeetingAttendanceView({ meeting, onSave }) {
    const [selectedInvitee, setSelectedInvitee] = useState('');
    const [newGuestName, setNewGuestName] = useState('');
    const [newGuestPosition, setNewGuestPosition] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!meeting) return <EmptyState message="بيانات الاجتماع غير متوفرة." />;

    const handleToggleAttendance = async (date) => {
        if (!selectedInvitee || selectedInvitee === 'NEW_GUEST') return;
        setIsSaving(true);
        try {
            const currentAtt = meeting.attendance || {};
            const inviteeAtt = currentAtt[selectedInvitee] || [];

            let newInviteeAtt;
            if (inviteeAtt.includes(date)) {
                newInviteeAtt = inviteeAtt.filter(d => d !== date); // Unmark
            } else {
                newInviteeAtt = [...inviteeAtt, date]; // Mark
            }

            const updatedMeeting = {
                ...meeting,
                attendance: { ...currentAtt, [selectedInvitee]: newInviteeAtt }
            };

            await onSave(updatedMeeting);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddSelfAsGuest = async () => {
        if (!newGuestName.trim()) {
            alert("الاسم مطلوب.");
            return;
        }

        setIsSaving(true);
        try {
            const newGuest = {
                name: newGuestName.trim(),
                position: newGuestPosition.trim() || 'ضيف (Guest)'
            };
            const updatedMeeting = {
                ...meeting,
                guests: [...(meeting.guests || []), newGuest]
            };
            
            await onSave(updatedMeeting);
            
            // Auto-select the newly added guest
            setSelectedInvitee(newGuest.name);
            setNewGuestName('');
            setNewGuestPosition('');
        } finally {
            setIsSaving(false);
        }
    };

    // Use the inviteeNamesMap injected when the manager built the list so we have Arabic names on the public end
    const inviteeNamesMap = meeting.inviteeNamesMap || {};

    const allOptions = [
        ...(meeting.invitees || []).map(name => ({ id: name, display: inviteeNamesMap[name] || name })),
        ...(meeting.guests || []).map(g => ({ id: g.name, display: g.name }))
    ].sort((a, b) => a.display.localeCompare(b.display));

    return (
        <div className="max-w-3xl mx-auto mt-8" dir="rtl">
            <Card>
                <div className="p-6 border-b border-gray-100 bg-indigo-50 rounded-t-lg">
                    <h2 className="text-2xl font-bold text-indigo-900 mb-2">{meeting.title}</h2>
                    <p className="text-indigo-700 font-medium flex items-center gap-2">
                        <Layers className="w-4 h-4" /> {meeting.unit} 
                        <span className="text-indigo-300">|</span> 
                        <Clock className="w-4 h-4" /> {meeting.schedule || 'لم يتم تحديد موعد'}
                    </p>
                </div>
                <CardBody className="p-6 space-y-6">
                    <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                        <label className="block text-sm font-bold text-gray-800 mb-2">1. اختر اسمك</label>
                        <Select value={selectedInvitee} onChange={(e) => setSelectedInvitee(e.target.value)} className="w-full max-w-md bg-white">
                            <option value="">-- اختر اسمك --</option>
                            {allOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.display}</option>
                            ))}
                            <option value="NEW_GUEST" className="font-bold text-indigo-600">+ أنا لست في القائمة (إضافة كضيف)</option>
                        </Select>
                        <p className="text-xs text-gray-500 mt-2">اختر اسمك من القائمة لعرض وإثبات حضورك.</p>
                    </div>

                    {selectedInvitee === 'NEW_GUEST' && (
                        <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 space-y-4">
                            <h3 className="font-bold text-indigo-900 flex items-center gap-2"><UserPlus className="w-4 h-4"/> التسجيل كضيف</h3>
                            <Input label="اسمك بالكامل" value={newGuestName} onChange={e => setNewGuestName(e.target.value)} placeholder="أدخل اسمك بالكامل" />
                            <Input label="المنصب / الصفة الوظيفية" value={newGuestPosition} onChange={e => setNewGuestPosition(e.target.value)} placeholder="مثال: استشاري، منسق" />
                            <Button type="button" onClick={(e) => { e.preventDefault(); handleAddSelfAsGuest(); }} disabled={isSaving || !newGuestName.trim()}>{isSaving ? <Spinner size="sm" /> : 'التسجيل لإثبات الحضور'}</Button>
                        </div>
                    )}

                    {selectedInvitee && selectedInvitee !== 'NEW_GUEST' && (
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <label className="block text-sm font-bold text-gray-800 mb-4">2. إثبات الحضور</label>
                            {!meeting.sessionDates || meeting.sessionDates.length === 0 ? (
                                <p className="text-gray-500 italic bg-gray-50 p-4 rounded text-center">لم يتم جدولة أي تواريخ للجلسات بعد.</p>
                            ) : (
                                <div className="space-y-3">
                                    {meeting.sessionDates.map(date => {
                                        const isPresent = (meeting.attendance?.[selectedInvitee] || []).includes(date);
                                        return (
                                            <div key={date} className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${isPresent ? 'bg-green-50 border-green-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}`}>
                                                <span className={`font-bold ${isPresent ? 'text-green-800' : 'text-gray-700'}`}>
                                                    <Calendar className="w-4 h-4 inline ml-2 mb-0.5" />
                                                    {date}
                                                </span>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={isPresent ? "primary" : "secondary"}
                                                    onClick={(e) => { e.preventDefault(); handleToggleAttendance(date); }}
                                                    disabled={isSaving}
                                                    className={isPresent ? "bg-green-600 hover:bg-green-700 text-white border-green-600 shadow-sm" : "bg-white"}
                                                >
                                                    {isPresent ? <><CheckCircle className="w-4 h-4 ml-1 inline"/> حاضر</> : "إثبات كحاضر"}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}