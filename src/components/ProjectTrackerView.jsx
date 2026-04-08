// src/components/ProjectTrackerView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, Button, Modal, Input, FormGroup, Select, PageHeader, Table, EmptyState, Spinner } from './CommonComponents';
import { upsertProject, deleteProject } from '../data';
import { useDataCache } from '../DataContext';
import { 
    Plus, Edit, Trash2, CheckCircle, Clock, PlayCircle, FolderKanban, 
    Calendar, Baby, Stethoscope, Users, Activity, Package, HeartPulse, ChevronLeft,
    BarChart2, AlertCircle, Target, ListTodo, AlertTriangle, ArrowRight, UserCheck, Layers
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

export default function ProjectTrackerView({ permissions }) {
    const { 
        projects: rawProjects, 
        fetchProjects, 
        isLoading, 
        federalCoordinators, 
        fetchFederalCoordinators 
    } = useDataCache();
    
    // --- Navigation State ---
    const [mainTab, setMainTab] = useState('units'); // 'units' | 'dashboard'
    const [viewMode, setViewMode] = useState('units'); // 'units' | 'projects' | 'tasks'
    const [activeUnit, setActiveUnit] = useState(null);
    const [activeProjectId, setActiveProjectId] = useState(null);
    
    // --- Modal State ---
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
    const [currentProject, setCurrentProject] = useState(null);
    const [currentSubtask, setCurrentSubtask] = useState(null);

    const activeFederalTeam = useMemo(() => {
        return (federalCoordinators || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true");
    }, [federalCoordinators]);

    // All active projects globally (used for KPIs)
    const allActiveProjects = useMemo(() => {
        return (rawProjects || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
    }, [rawProjects]);

    // Filter projects by the currently selected unit
    const projects = useMemo(() => {
        return allActiveProjects
            .filter(p => p.unit === activeUnit)
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [allActiveProjects, activeUnit]);

    // Get the active project object for the Tasks view
    const activeProject = useMemo(() => {
        return projects.find(p => p.id === activeProjectId) || null;
    }, [projects, activeProjectId]);

    // --- GLOBAL & GRANULAR KPI CALCULATIONS ---
    const { kpiStats, overdueTasksList, unitPerformance, personPerformance } = useMemo(() => {
        let totalProjects = allActiveProjects.length;
        let totalTasks = 0;
        let completedTasks = 0;
        let inProgressTasks = 0;
        let pendingTasks = 0;
        let overdueTasks = 0;
        let overdueList = [];
        
        // Data structures for granular performance tracking
        const unitStats = {};
        const personStats = {};

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to start of day for comparison

        allActiveProjects.forEach(p => {
            const uName = p.unit || 'Unknown Unit';
            if (!unitStats[uName]) unitStats[uName] = { total: 0, completed: 0 };

            if (p.subtasks && Array.isArray(p.subtasks)) {
                totalTasks += p.subtasks.length;
                p.subtasks.forEach(task => {
                    // Track global stats
                    if (task.status === 'Completed') completedTasks++;
                    else if (task.status === 'In Progress') inProgressTasks++;
                    else pendingTasks++;

                    // Track Unit stats
                    unitStats[uName].total++;
                    if (task.status === 'Completed') unitStats[uName].completed++;

                    // Track Person stats
                    const rName = task.responsible || 'Unassigned';
                    if (!personStats[rName]) personStats[rName] = { total: 0, completed: 0 };
                    personStats[rName].total++;
                    if (task.status === 'Completed') personStats[rName].completed++;

                    // Check for overdue
                    if (task.status !== 'Completed' && task.dueDate) {
                        const dueDateObj = new Date(task.dueDate);
                        dueDateObj.setHours(0, 0, 0, 0);
                        if (dueDateObj < now) {
                            overdueTasks++;
                            overdueList.push({
                                ...task,
                                projectName: p.title,
                                unitName: p.unit,
                                projectId: p.id
                            });
                        }
                    }
                });
            }
        });

        // Sort overdue tasks so the oldest ones are at the top
        overdueList.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Format Unit Performance Array
        const formattedUnitPerformance = Object.entries(unitStats).map(([unit, stats]) => ({
            unit,
            total: stats.total,
            completed: stats.completed,
            rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        })).sort((a, b) => b.rate - a.rate); // Sort by highest completion rate

        // Format Person Performance Array
        const formattedPersonPerformance = Object.entries(personStats).map(([name, stats]) => ({
            name,
            total: stats.total,
            completed: stats.completed,
            rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        })).sort((a, b) => b.total - a.total); // Sort by highest task volume

        return { 
            kpiStats: { totalProjects, totalTasks, completedTasks, inProgressTasks, pendingTasks, overdueTasks, completionRate },
            overdueTasksList: overdueList,
            unitPerformance: formattedUnitPerformance,
            personPerformance: formattedPersonPerformance
        };
    }, [allActiveProjects]);

    useEffect(() => {
        fetchProjects();
        fetchFederalCoordinators();
    }, [fetchProjects, fetchFederalCoordinators]);

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
                setViewMode('projects');
                setActiveProjectId(null);
            }
        }
    };

    // --- Subtask Handlers ---
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
                        if (currentSubtask.status === 'Completed') {
                            updated.completedAt = now;
                        }
                    }
                    return updated;
                }
                return st;
            });
        } else {
            updatedSubtasks.push({ 
                ...currentSubtask, 
                id: Date.now().toString(),
                createdAt: now,
                statusUpdatedAt: now,
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

    if (isLoading.projects || isLoading.federalCoordinators) return <Spinner />;

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Project & Task Tracker" 
                subtitle="Manage and track projects across Child Health Program units."
            />

            {/* --- MAIN TABS --- */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex gap-6" aria-label="Tabs">
                    <button
                        onClick={() => {
                            setMainTab('units');
                            if (viewMode !== 'tasks' && viewMode !== 'projects') {
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
                                <div 
                                    className="bg-sky-500 h-3 rounded-full transition-all duration-1000" 
                                    style={{ width: `${kpiStats.completionRate}%` }}
                                ></div>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                <span><strong className="text-blue-600">{kpiStats.inProgressTasks}</strong> In Progress</span>
                                <span><strong className="text-orange-500">{kpiStats.pendingTasks}</strong> Pending</span>
                            </div>
                        </div>
                    </div>

                    {/* Granular KPI Breakdowns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Unit Performance */}
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
                                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                        <span>{u.completed} / {u.total}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                                        <div className={`h-2 rounded-full ${u.rate === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${u.rate}%` }}></div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm font-bold text-right">
                                                    <span className={u.rate === 100 ? 'text-green-600' : 'text-gray-700'}>{u.rate}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </Table>
                                ) : (
                                    <div className="p-6 text-center text-gray-500 text-sm">No unit data available.</div>
                                )}
                            </CardBody>
                        </Card>

                        {/* Person Performance */}
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
                                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                        <span>{p.completed} / {p.total}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                                        <div className={`h-2 rounded-full ${p.rate === 100 ? 'bg-green-500' : 'bg-emerald-500'}`} style={{ width: `${p.rate}%` }}></div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm font-bold text-right">
                                                    <span className={p.rate === 100 ? 'text-green-600' : 'text-gray-700'}>{p.rate}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </Table>
                                ) : (
                                    <div className="p-6 text-center text-gray-500 text-sm">No team member data available.</div>
                                )}
                            </CardBody>
                        </Card>
                    </div>

                    {/* Action Required: Overdue Tasks Table */}
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
                                    <div className="bg-green-100 p-4 rounded-full mb-3">
                                        <CheckCircle className="w-8 h-8 text-green-600" />
                                    </div>
                                    <h4 className="text-gray-800 font-bold text-lg">You're all caught up!</h4>
                                    <p className="text-gray-500 text-sm">There are no overdue tasks in the system right now.</p>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* ========================================== */}
            {/* VIEW: UNITS TAB (Grid -> Projects -> Tasks)*/}
            {/* ========================================== */}
            {mainTab === 'units' && (
                <div className="animate-in fade-in duration-300">
                    
                    {/* Level 1: UNITS GRID */}
                    {viewMode === 'units' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {PROGRAM_UNITS_DATA.map((unit) => {
                                const Icon = unit.icon;
                                const unitProjects = allActiveProjects.filter(p => p.unit === unit.id);
                                const unitTaskCount = unitProjects.reduce((acc, p) => acc + (p.subtasks?.length || 0), 0);

                                return (
                                    <div 
                                        key={unit.id}
                                        onClick={() => {
                                            setActiveUnit(unit.id);
                                            setViewMode('projects');
                                        }}
                                        className="cursor-pointer h-full"
                                    >
                                        <Card className={`hover:-translate-y-1 hover:shadow-lg transition-all border ${unit.border} h-full`}>
                                            <CardBody className="flex flex-col items-center justify-center p-6 text-center">
                                                <div className={`p-4 rounded-full ${unit.bg} ${unit.color} mb-4`}>
                                                    <Icon size={40} />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-800">{unit.title}</h3>
                                                <div className="flex gap-3 mt-3 text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border shadow-sm">
                                                    <span>{unitProjects.length} Projects</span>
                                                    <span className="text-gray-300">|</span>
                                                    <span>{unitTaskCount} Tasks</span>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Level 2: PROJECTS LIST */}
                    {viewMode === 'projects' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <div className="flex items-center gap-4">
                                    <Button variant="secondary" onClick={() => setViewMode('units')}>
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Units
                                    </Button>
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <FolderKanban className="text-sky-600" /> {activeUnit} Projects
                                    </h3>
                                </div>
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

                    {/* Level 3: TASKS LIST */}
                    {viewMode === 'tasks' && activeProject && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-sky-500">
                                <div className="flex items-center gap-4">
                                    <Button variant="secondary" onClick={() => setViewMode('projects')}>
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
                                                                <Button size="sm" variant="secondary" onClick={() => {
                                                                    setCurrentSubtask(task);
                                                                    setIsSubtaskModalOpen(true);
                                                                }}>Edit</Button>
                                                                <Button size="sm" variant="danger" onClick={() => handleDeleteSubtask(task.id)}>Delete</Button>
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
                                            <Button variant="secondary" onClick={() => {
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
                </div>
            )}

            {/* --- MODALS --- */}
            
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
                            <Input 
                                value={currentSubtask?.description || ''} 
                                onChange={(e) => setCurrentSubtask({...currentSubtask, description: e.target.value})} 
                                required 
                                placeholder="Describe the task..."
                            />
                        </FormGroup>
                        
                        <FormGroup label="Who is Responsible?">
                            <Select 
                                value={currentSubtask?.responsible || ''} 
                                onChange={(e) => setCurrentSubtask({...currentSubtask, responsible: e.target.value})}
                                required
                            >
                                <option value="">-- Select Team Member --</option>
                                {activeFederalTeam.map(coord => (
                                    <option key={coord.id} value={coord.name}>
                                        {coord.name} {coord.role ? `(${coord.role})` : ''}
                                    </option>
                                ))}
                            </Select>
                        </FormGroup>

                        <FormGroup label="Target Completion Date (Due Date)">
                            <Input 
                                type="date"
                                value={currentSubtask?.dueDate || ''} 
                                onChange={(e) => setCurrentSubtask({...currentSubtask, dueDate: e.target.value})} 
                                required 
                            />
                        </FormGroup>

                        <FormGroup label="Status">
                            <Select 
                                value={currentSubtask?.status || 'Pending'} 
                                onChange={(e) => setCurrentSubtask({...currentSubtask, status: e.target.value})}
                            >
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
        </div>
    );
}