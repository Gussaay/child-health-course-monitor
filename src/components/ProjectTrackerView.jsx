// src/components/ProjectTrackerView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, Button, Modal, Input, FormGroup, Select, PageHeader, Table, EmptyState, Spinner } from './CommonComponents';
import { upsertProject, deleteProject } from '../data';
import { useDataCache } from '../DataContext';
import { db } from '../firebase'; 
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
    Plus, Edit, Trash2, CheckCircle, Clock, PlayCircle, FolderKanban, 
    Baby, Stethoscope, Users, Activity, Package, HeartPulse, 
    BarChart2, Target, Search
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
        fetchFederalCoordinators // <-- ADDED: Extract the fetch function
    } = useDataCache();
    
    // --- Navigation & UI State ---
    const [viewMode, setViewMode] = useState('dashboard');
    const [dashboardTab, setDashboardTab] = useState('overview');
    
    // --- Entry Selection State ---
    const [selectedUnit, setSelectedUnit] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [newProjectTitle, setNewProjectTitle] = useState('');
    
    // --- Filtering State for Dashboard Tables ---
    const [taskFilter, setTaskFilter] = useState({ project: '', responsible: '', status: '', search: '' });

    // --- Modal State ---
    const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
    const [currentSubtask, setCurrentSubtask] = useState(null);
    const [isSavingTask, setIsSavingTask] = useState(false);

    // Guaranteed to only pull from the federal team pool
    const allTeamMembers = useMemo(() => {
        return (federalCoordinators || []).filter(c => c.isDeleted !== true && c.isDeleted !== "true").map(c => ({ ...c, _level: 'federal' }));
    }, [federalCoordinators]);

    const allActiveProjects = useMemo(() => {
        return (rawProjects || []).filter(p => p.isDeleted !== true && p.isDeleted !== "true");
    }, [rawProjects]);

    const projects = useMemo(() => {
        return allActiveProjects
            .filter(p => p.unit === selectedUnit)
            .sort((a, b) => {
                const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
                const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
    }, [allActiveProjects, selectedUnit]);

    const activeProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId]);

    // --- Aggregated Data for Dashboard ---
    const { kpiStats, overdueTasksList, allActiveTasks, allCompletedTasks } = useMemo(() => {
        let totalProjects = allActiveProjects.length;
        let totalTasks = 0, completedTasksCount = 0, inProgressTasks = 0, pendingTasks = 0, overdueTasks = 0;
        let overdueList = [];
        let activeList = [];
        let completedList = [];

        const now = new Date();
        now.setHours(0, 0, 0, 0); 

        allActiveProjects.forEach(p => {
            const unitObj = PROGRAM_UNITS_DATA.find(u => u.id === p.unit);
            const unitTitle = unitObj ? unitObj.title : p.unit;

            if (p.subtasks && Array.isArray(p.subtasks)) {
                totalTasks += p.subtasks.length;
                
                p.subtasks.forEach(task => {
                    const enrichedTask = { ...task, projectName: p.title, unitName: unitTitle, projectId: p.id };
                    
                    if (task.status === 'Completed') {
                        completedTasksCount++;
                        completedList.push(enrichedTask);
                    } else {
                        activeList.push(enrichedTask);
                        if (task.status === 'In Progress') inProgressTasks++;
                        else pendingTasks++;

                        if (task.dueDate) {
                            const dueDateObj = new Date(task.dueDate);
                            dueDateObj.setHours(0, 0, 0, 0);
                            if (dueDateObj < now) {
                                overdueTasks++;
                                overdueList.push(enrichedTask);
                            }
                        }
                    }
                });
            }
        });

        overdueList.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        activeList.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        completedList.sort((a, b) => new Date(b.completedAt || b.statusUpdatedAt || 0) - new Date(a.completedAt || a.statusUpdatedAt || 0));

        const completionRate = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

        return { 
            kpiStats: { totalProjects, totalTasks, completedTasks: completedTasksCount, inProgressTasks, pendingTasks, overdueTasks, completionRate },
            overdueTasksList: overdueList,
            allActiveTasks: activeList,
            allCompletedTasks: completedList
        };
    }, [allActiveProjects]);

    const filteredActiveTasks = useMemo(() => {
        return allActiveTasks.filter(t => 
            (taskFilter.project === '' || t.projectId === taskFilter.project) &&
            (taskFilter.responsible === '' || t.responsibleId === taskFilter.responsible) &&
            (taskFilter.status === '' || t.status === taskFilter.status) &&
            (taskFilter.search === '' || t.description.toLowerCase().includes(taskFilter.search.toLowerCase()))
        );
    }, [allActiveTasks, taskFilter]);

    const filteredCompletedTasks = useMemo(() => {
        return allCompletedTasks.filter(t => 
            (taskFilter.project === '' || t.projectId === taskFilter.project) &&
            (taskFilter.responsible === '' || t.responsibleId === taskFilter.responsible) &&
            (taskFilter.search === '' || t.description.toLowerCase().includes(taskFilter.search.toLowerCase()))
        );
    }, [allCompletedTasks, taskFilter]);

    // --- ADDED: Fetch Federal Coordinators on mount ---
    useEffect(() => {
        fetchProjects();
        if (fetchFederalCoordinators) {
            fetchFederalCoordinators(); 
        }
    }, [fetchProjects, fetchFederalCoordinators]);

    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!newProjectTitle.trim() || !selectedUnit) return;
        
        const now = new Date().toISOString();
        const payload = { 
            title: newProjectTitle, 
            unit: selectedUnit, 
            subtasks: [],
            createdAt: now 
        };
        
        const newProjectRef = await upsertProject(payload);
        await fetchProjects(true);
        
        const newId = (newProjectRef && typeof newProjectRef === 'object') ? newProjectRef.id : newProjectRef;
        setSelectedProjectId(newId || ''); 
        setNewProjectTitle('');
    };

    const handleSaveSubtask = async (e) => {
        e.preventDefault();
        const targetProjectId = activeProject?.id || currentSubtask?.projectId;
        if (!targetProjectId) return;
        
        setIsSavingTask(true);
        const projectToUpdate = allActiveProjects.find(p => p.id === targetProjectId);
        if (!projectToUpdate) {
            setIsSavingTask(false);
            return;
        }

        let updatedSubtasks = [...(projectToUpdate.subtasks || [])];
        const now = new Date().toISOString(); 
        
        let isNewAssignment = false;

        if (currentSubtask.id) {
            const originalSubtask = updatedSubtasks.find(st => st.id === currentSubtask.id);
            if (originalSubtask && originalSubtask.responsibleId !== currentSubtask.responsibleId) {
                isNewAssignment = true;
            }

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
            isNewAssignment = true;
            updatedSubtasks.push({ 
                ...currentSubtask, 
                id: Date.now().toString(), 
                createdAt: now, 
                statusUpdatedAt: now,
                ...(currentSubtask.status === 'Completed' ? { completedAt: now } : {})
            });
        }

        await upsertProject({ ...projectToUpdate, subtasks: updatedSubtasks });

        if (isNewAssignment && currentSubtask.responsibleId) {
            try {
                const assignedMember = allTeamMembers.find(m => m.id === currentSubtask.responsibleId);
                
                if (assignedMember && assignedMember.email) {
                    const q = query(collection(db, 'users'), where("email", "==", assignedMember.email));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        const specificTargetUserId = querySnapshot.docs[0].id;
                        const notifTitle = "New Task Assigned";
                        const notifMessage = `You've been assigned: "${currentSubtask.description}" in "${projectToUpdate.title}"`;
                        
                        await addDoc(collection(db, 'notifications'), {
                            title: notifTitle,
                            message: notifMessage,
                            targetUser: specificTargetUserId, 
                            createdAt: serverTimestamp(),
                            deliveredTo: [], 
                            readBy: [],      
                            status: 'active'
                        });

                        const functions = getFunctions(db.app); 
                        const sendFCMNotification = httpsCallable(functions, 'sendFCMNotification');
                        await sendFCMNotification({
                            targetUserId: specificTargetUserId, 
                            title: notifTitle,
                            body: notifMessage
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to send targeted assignment notification:", err);
            }
        }

        await fetchProjects(true);
        setIsSavingTask(false);
        setIsSubtaskModalOpen(false);
    };

    const handleDeleteSubtask = async (subtaskId, projectId) => {
        if (window.confirm("Delete this task?")) {
            const targetProjectId = projectId || activeProject?.id;
            const targetProject = allActiveProjects.find(p => p.id === targetProjectId);
            
            if (!targetProject) return;
            const updatedSubtasks = targetProject.subtasks.filter(st => st.id !== subtaskId);
            await upsertProject({ ...targetProject, subtasks: updatedSubtasks });
            fetchProjects(true);
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getStatusIcon = (status) => {
        if (status === 'Completed') return <CheckCircle className="w-4 h-4 text-green-500" />;
        if (status === 'In Progress') return <PlayCircle className="w-4 h-4 text-blue-500" />;
        return <Clock className="w-4 h-4 text-orange-500" />;
    };

    const renderSubActivitiesProgress = (task) => {
        if (!task.subActivities || task.subActivities.length === 0) return null;
        const completed = task.subActivities.filter(sa => sa.completed).length;
        const total = task.subActivities.length;
        return (
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <div className="flex-1 bg-gray-200 h-1.5 rounded-full overflow-hidden max-w-[100px]">
                    <div className="bg-sky-500 h-full" style={{ width: `${(completed / total) * 100}%` }}></div>
                </div>
                <span>{completed}/{total} sub-activities</span>
            </div>
        );
    };

    if (isLoading.projects) return <Spinner />;

    return (
        <div className="space-y-6">
            <PageHeader title="Federal Project Tracker" subtitle="Manage and track federal projects and tasks across program units." />

            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-max mb-4 border border-gray-200">
                <Button 
                    variant={viewMode === 'dashboard' ? 'primary' : 'ghost'} 
                    onClick={() => setViewMode('dashboard')}
                >
                    <BarChart2 className="w-4 h-4 mr-2" /> Dashboard Overview
                </Button>
                <Button 
                    variant={viewMode === 'entry' ? 'primary' : 'ghost'} 
                    onClick={() => { setViewMode('entry'); setSelectedProjectId(''); }}
                >
                    <Edit className="w-4 h-4 mr-2" /> Data Entry
                </Button>
            </div>

            {viewMode === 'dashboard' ? (
                <div className="space-y-6">
                    <div className="flex gap-4 border-b border-gray-200">
                        <button 
                            onClick={() => { setDashboardTab('overview'); setTaskFilter({ project: '', responsible: '', status: '', search: '' }); }}
                            className={`pb-2 px-2 font-semibold transition-colors ${dashboardTab === 'overview' ? 'border-b-2 border-sky-600 text-sky-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Overview
                        </button>
                        <button 
                            onClick={() => { setDashboardTab('active'); setTaskFilter({ project: '', responsible: '', status: '', search: '' }); }}
                            className={`pb-2 px-2 font-semibold transition-colors flex items-center gap-2 ${dashboardTab === 'active' ? 'border-b-2 border-sky-600 text-sky-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Active Tasks <span className="bg-sky-100 text-sky-700 text-xs py-0.5 px-2 rounded-full">{allActiveTasks.length}</span>
                        </button>
                        <button 
                            onClick={() => { setDashboardTab('completed'); setTaskFilter({ project: '', responsible: '', status: '', search: '' }); }}
                            className={`pb-2 px-2 font-semibold transition-colors flex items-center gap-2 ${dashboardTab === 'completed' ? 'border-b-2 border-sky-600 text-sky-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Completed Tasks <span className="bg-green-100 text-green-700 text-xs py-0.5 px-2 rounded-full">{allCompletedTasks.length}</span>
                        </button>
                    </div>

                    {dashboardTab === 'overview' && (
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm animate-in fade-in">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                                <Target className="text-sky-600" /> Overall Project Performance
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-gray-50 border-l-4 border-l-sky-500 p-4 rounded-r-lg">
                                    <div className="text-gray-500 text-sm font-medium mb-1">Total Projects</div>
                                    <div className="text-2xl font-bold text-gray-900">{kpiStats.totalProjects}</div>
                                </div>
                                <div className="bg-gray-50 border-l-4 border-l-indigo-500 p-4 rounded-r-lg">
                                    <div className="text-gray-500 text-sm font-medium mb-1">Total Tasks</div>
                                    <div className="text-2xl font-bold text-gray-900">{kpiStats.totalTasks}</div>
                                </div>
                                <div className="bg-green-50 border-l-4 border-l-green-500 p-4 rounded-r-lg">
                                    <div className="text-green-700 text-sm font-medium mb-1">Completed Tasks</div>
                                    <div className="text-2xl font-bold text-green-800">{kpiStats.completedTasks}</div>
                                </div>
                                <div className="bg-red-50 border-l-4 border-l-red-500 p-4 rounded-r-lg">
                                    <div className="text-red-600 text-sm font-medium mb-1">Overdue Tasks</div>
                                    <div className="text-2xl font-bold text-red-700">{kpiStats.overdueTasks}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {(dashboardTab === 'active' || dashboardTab === 'completed') && (
                        <Card className="animate-in fade-in">
                            <CardBody className="p-0">
                                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 items-center">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <Input
                                            placeholder="Search tasks..."
                                            value={taskFilter.search}
                                            onChange={e => setTaskFilter({...taskFilter, search: e.target.value})}
                                            className="pl-9 w-full"
                                        />
                                    </div>
                                    <Select value={taskFilter.project} onChange={e => setTaskFilter({...taskFilter, project: e.target.value})} className="w-48">
                                        <option value="">All Projects</option>
                                        {allActiveProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </Select>
                                    <Select value={taskFilter.responsible} onChange={e => setTaskFilter({...taskFilter, responsible: e.target.value})} className="w-48">
                                        <option value="">All Federal Members</option>
                                        {allTeamMembers.map(m => <option key={m.id} value={m.id}>{m.nameAr || m.name}</option>)}
                                    </Select>
                                    {dashboardTab === 'active' && (
                                        <Select value={taskFilter.status} onChange={e => setTaskFilter({...taskFilter, status: e.target.value})} className="w-40">
                                            <option value="">All Statuses</option>
                                            <option value="Pending">Pending</option>
                                            <option value="In Progress">In Progress</option>
                                        </Select>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <Table headers={["Program Unit", "Project", "Task Description", "Responsible", "Due Date", "Status", "Actions"]}>
                                        {(dashboardTab === 'active' ? filteredActiveTasks : filteredCompletedTasks).map(task => {
                                            const isOverdue = dashboardTab === 'active' && task.dueDate && new Date(task.dueDate) < new Date();
                                            return (
                                                <tr key={`${task.projectId}-${task.id}`} className="hover:bg-gray-50 border-b">
                                                    <td className="p-3 text-xs text-gray-500 font-medium">{task.unitName}</td>
                                                    <td className="p-3 text-sm font-semibold text-gray-700">{task.projectName}</td>
                                                    <td className="p-3 text-sm text-gray-900">
                                                        {task.description}
                                                        {renderSubActivitiesProgress(task)}
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-600">{task.responsible || 'Unassigned'}</td>
                                                    <td className="p-3 text-sm">
                                                        <span className={isOverdue ? 'text-red-600 font-bold bg-red-50 p-1 rounded inline-block' : ''}>
                                                            {formatDate(task.dueDate)}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm">
                                                        <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full w-max border whitespace-nowrap">
                                                            {getStatusIcon(task.status)} {task.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" variant="secondary" onClick={() => { 
                                                                setCurrentSubtask(task); 
                                                                setIsSubtaskModalOpen(true); 
                                                            }}>Edit</Button>
                                                            <Button size="sm" variant="danger" onClick={() => handleDeleteSubtask(task.id, task.projectId)}>Delete</Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(dashboardTab === 'active' ? filteredActiveTasks : filteredCompletedTasks).length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="p-8 text-center text-gray-500">
                                                    No {dashboardTab} tasks found matching your filters.
                                                </td>
                                            </tr>
                                        )}
                                    </Table>
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </div>
            ) : (
                <Card>
                    <CardBody className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded border border-gray-200">
                            <FormGroup label="Select Program Unit">
                                <Select value={selectedUnit} onChange={(e) => { setSelectedUnit(e.target.value); setSelectedProjectId(''); }}>
                                    <option value="">-- Choose Unit --</option>
                                    {PROGRAM_UNITS_DATA.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                                </Select>
                            </FormGroup>
                            
                            {selectedUnit && (
                                <FormGroup label="Select or Add Project">
                                    <Select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                                        <option value="">-- Choose Project --</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                        <option value="NEW" className="font-bold text-sky-600">+ Add New Project</option>
                                    </Select>
                                </FormGroup>
                            )}
                        </div>

                        {selectedProjectId === 'NEW' && (
                            <div className="bg-sky-50 p-4 rounded border border-sky-200 flex gap-4 items-end animate-in">
                                <FormGroup label="New Project Name" className="flex-1">
                                    <Input value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} placeholder="e.g., Annual Federal Strategy Plan" />
                                </FormGroup>
                                <Button onClick={handleCreateProject} disabled={!newProjectTitle.trim()}>Create Project</Button>
                            </div>
                        )}

                        {activeProject && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <FolderKanban className="text-sky-600 w-5 h-5"/> {activeProject.title} Tasks
                                    </h3>
                                    <Button size="sm" onClick={() => {
                                        setCurrentSubtask({ 
                                            description: '', 
                                            responsible: '', 
                                            responsibleId: '',
                                            dueDate: '', 
                                            status: 'Pending', 
                                            projectId: activeProject.id,
                                            subActivities: [] 
                                        });
                                        setIsSubtaskModalOpen(true);
                                    }}>
                                        <Plus className="w-4 h-4 mr-1" /> Add Task
                                    </Button>
                                </div>
                                
                                {activeProject.subtasks && activeProject.subtasks.length > 0 ? (
                                    <Table headers={["Task Description", "Responsible", "Due Date", "Status", "Actions"]}>
                                        {activeProject.subtasks.map(task => (
                                            <tr key={task.id} className="hover:bg-gray-50">
                                                <td className="p-3 text-sm font-medium">
                                                    {task.description}
                                                    {renderSubActivitiesProgress(task)}
                                                </td>
                                                <td className="p-3 text-sm text-gray-600">{task.responsible || 'Unassigned'}</td>
                                                <td className="p-3 text-sm">{formatDate(task.dueDate)}</td>
                                                <td className="p-3 text-sm">
                                                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full w-max border">
                                                        {getStatusIcon(task.status)} {task.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="secondary" onClick={() => { 
                                                            setCurrentSubtask({...task, projectId: activeProject.id}); 
                                                            setIsSubtaskModalOpen(true); 
                                                        }}>Edit</Button>
                                                        <Button size="sm" variant="danger" onClick={() => handleDeleteSubtask(task.id, activeProject.id)}>Delete</Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </Table>
                                ) : (
                                    <EmptyState message="No tasks assigned to this project yet." />
                                )}
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            <Modal isOpen={isSubtaskModalOpen} onClose={() => setIsSubtaskModalOpen(false)} title={`${currentSubtask?.id ? 'Edit' : 'Add'} Task`}>
                <form onSubmit={handleSaveSubtask}>
                    <CardBody className="space-y-4">
                        <FormGroup label="Task Description">
                            <Input value={currentSubtask?.description || ''} onChange={(e) => setCurrentSubtask({...currentSubtask, description: e.target.value})} required placeholder="Describe main task..."/>
                        </FormGroup>
                        <FormGroup label="Responsible Member (Federal Team)">
                            <Select 
                                value={currentSubtask?.responsibleId || ''} 
                                onChange={(e) => {
                                    const selectedMember = allTeamMembers.find(t => t.id === e.target.value);
                                    setCurrentSubtask({
                                        ...currentSubtask, 
                                        responsibleId: selectedMember?.id || '',
                                        responsible: selectedMember ? (selectedMember.nameAr || selectedMember.name) : ''
                                    });
                                }} 
                                required
                            >
                                <option value="">-- Select Federal Team Member --</option>
                                {allTeamMembers.map(t => <option key={t.id} value={t.id}>{t.nameAr || t.name}</option>)}
                            </Select>
                        </FormGroup>
                        <div className="grid grid-cols-2 gap-4">
                            <FormGroup label="Due Date">
                                <Input type="date" value={currentSubtask?.dueDate || ''} onChange={(e) => setCurrentSubtask({...currentSubtask, dueDate: e.target.value})} required />
                            </FormGroup>
                            <FormGroup label="Status">
                                <Select value={currentSubtask?.status || 'Pending'} onChange={(e) => setCurrentSubtask({...currentSubtask, status: e.target.value})}>
                                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </Select>
                            </FormGroup>
                        </div>
                        
                        <hr className="my-4" />
                        
                        <FormGroup label="Sub-Activities (Checklist)">
                            <div className="space-y-2 mb-2">
                                {currentSubtask?.subActivities?.map((sa, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
                                            checked={sa.completed || false} 
                                            onChange={(e) => {
                                                const newSA = [...(currentSubtask.subActivities || [])];
                                                newSA[idx].completed = e.target.checked;
                                                setCurrentSubtask({...currentSubtask, subActivities: newSA});
                                            }} 
                                        />
                                        <Input 
                                            value={sa.title || ''} 
                                            onChange={(e) => {
                                                const newSA = [...(currentSubtask.subActivities || [])];
                                                newSA[idx].title = e.target.value;
                                                setCurrentSubtask({...currentSubtask, subActivities: newSA});
                                            }} 
                                            placeholder="Enter sub-activity title..." 
                                            className={`flex-1 text-sm ${sa.completed ? 'line-through text-gray-400' : ''}`}
                                        />
                                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                                            const newSA = currentSubtask.subActivities.filter((_, i) => i !== idx);
                                            setCurrentSubtask({...currentSubtask, subActivities: newSA});
                                        }}>
                                            <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700"/>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" size="sm" variant="secondary" onClick={() => {
                                const current = currentSubtask?.subActivities || [];
                                setCurrentSubtask({...currentSubtask, subActivities: [...current, { title: '', completed: false }]});
                            }}>
                                <Plus className="w-4 h-4 mr-1" /> Add Sub-Activity
                            </Button>
                        </FormGroup>

                    </CardBody>
                    <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                        <Button type="button" variant="secondary" onClick={() => setIsSubtaskModalOpen(false)} disabled={isSavingTask}>Cancel</Button>
                        <Button type="submit" disabled={isSavingTask}>
                            {isSavingTask ? <Spinner size="sm" /> : 'Save Task'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}