// src/components/ProjectTrackerView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, Button, Modal, Input, FormGroup, Select, PageHeader, Table, EmptyState, Spinner } from './CommonComponents';
import { upsertProject, deleteProject } from '../data';
import { useDataCache } from '../DataContext';
import { db } from '../firebase'; 
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { QRCodeCanvas } from 'qrcode.react'; 
import { 
    Plus, Edit, Trash2, CheckCircle, Clock, PlayCircle, FolderKanban, 
    Baby, Stethoscope, Users, Activity, Package, HeartPulse, 
    BarChart2, Target, Search, Share2, Link as LinkIcon, AlertTriangle, Calendar
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

// Reusable Share Modal Component
function ShareLinkModal({ isOpen, onClose, title, link }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="p-4 bg-gray-50 text-sm text-gray-600 mb-4 rounded-b border-b">
                Share this link to direct someone exactly to this view.
            </div>
            <div className="px-6 pb-6 space-y-6">
                <FormGroup label="Shareable Link">
                    <div className="flex gap-2">
                        <Input type="text" value={link} readOnly className="bg-gray-50 text-gray-500" />
                        <Button onClick={handleCopy} variant={copied ? "success" : "primary"} className="w-28 shrink-0">
                            {copied ? 'Copied!' : 'Copy Link'}
                        </Button>
                    </div>
                </FormGroup>

                <FormGroup label="QR Code">
                    <div className="flex justify-center p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <QRCodeCanvas value={link} size={200} level={"Q"} />
                    </div>
                </FormGroup>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
            </div>
        </Modal>
    );
}

export default function ProjectTrackerView({ permissions }) {
    const { 
        projects: rawProjects, 
        fetchProjects, 
        isLoading, 
        federalCoordinators,
        fetchFederalCoordinators
    } = useDataCache();
    
    // --- Navigation & UI State (Initialized from URL if present) ---
    const [viewMode, setViewMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return new URLSearchParams(window.location.search).get('view') || 'dashboard';
        }
        return 'dashboard';
    });
    const [dashboardTab, setDashboardTab] = useState(() => {
        if (typeof window !== 'undefined') {
            return new URLSearchParams(window.location.search).get('tab') || 'overview';
        }
        return 'overview';
    });
    
    // --- Filtering State (Initialized from URL if present) ---
    const [taskFilter, setTaskFilter] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return {
                project: params.get('project') || '',
                responsible: params.get('responsible') || '',
                status: params.get('status') || '',
                search: params.get('search') || ''
            };
        }
        return { project: '', responsible: '', status: '', search: '' };
    });

    // --- Entry Selection State ---
    const [selectedUnit, setSelectedUnit] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [newProjectTitle, setNewProjectTitle] = useState('');
    
    // --- Modal State ---
    const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
    const [currentSubtask, setCurrentSubtask] = useState(null);
    const [isSavingTask, setIsSavingTask] = useState(false);
    
    const [shareModalInfo, setShareModalInfo] = useState({ isOpen: false, link: '', title: '' });

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
    const { kpiStats, allActiveTasks, allCompletedTasks, userStatsList, unitStatsList } = useMemo(() => {
        let totalProjects = allActiveProjects.length;
        let totalTasks = 0, completedTasksCount = 0, inProgressTasks = 0, pendingTasks = 0, overdueTasks = 0, upcomingTasks = 0;
        let activeList = [];
        let completedList = [];
        
        let userPerformance = {};
        let unitPerformance = {};

        // Initialize Unit Performance Trackers
        PROGRAM_UNITS_DATA.forEach(u => {
            unitPerformance[u.id] = { id: u.id, title: u.title, color: u.color, icon: u.icon, totalProjects: 0, totalTasks: 0, completed: 0, active: 0 };
        });

        const now = new Date();
        now.setHours(0, 0, 0, 0); 
        
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);

        allActiveProjects.forEach(p => {
            const unitObj = PROGRAM_UNITS_DATA.find(u => u.id === p.unit);
            const unitTitle = unitObj ? unitObj.title : p.unit;

            if (unitPerformance[p.unit]) {
                unitPerformance[p.unit].totalProjects++;
            }

            if (p.subtasks && Array.isArray(p.subtasks)) {
                totalTasks += p.subtasks.length;
                
                p.subtasks.forEach(task => {
                    const enrichedTask = { ...task, projectName: p.title, unitName: unitTitle, projectId: p.id };
                    const respId = task.responsibleId || 'unassigned';
                    
                    if (unitPerformance[p.unit]) {
                        unitPerformance[p.unit].totalTasks++;
                    }

                    // Initialize User Performance Tracker
                    if (!userPerformance[respId]) {
                        userPerformance[respId] = {
                            id: respId,
                            name: task.responsible || 'Unassigned',
                            total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0
                        };
                    }
                    
                    userPerformance[respId].total++;

                    if (task.status === 'Completed') {
                        completedTasksCount++;
                        completedList.push(enrichedTask);
                        userPerformance[respId].completed++;
                        if (unitPerformance[p.unit]) unitPerformance[p.unit].completed++;
                    } else {
                        activeList.push(enrichedTask);
                        if (unitPerformance[p.unit]) unitPerformance[p.unit].active++;

                        if (task.status === 'In Progress') {
                            inProgressTasks++;
                            userPerformance[respId].inProgress++;
                        } else {
                            pendingTasks++;
                            userPerformance[respId].pending++;
                        }

                        if (task.dueDate) {
                            const dueDateObj = new Date(task.dueDate);
                            dueDateObj.setHours(0, 0, 0, 0);
                            if (dueDateObj < now) {
                                overdueTasks++;
                                userPerformance[respId].overdue++;
                            } else if (dueDateObj <= nextWeek) {
                                upcomingTasks++;
                            }
                        }
                    }
                });
            }
        });

        activeList.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        completedList.sort((a, b) => new Date(b.completedAt || b.statusUpdatedAt || 0) - new Date(a.completedAt || a.statusUpdatedAt || 0));

        const completionRate = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;
        
        const sortedUserStats = Object.values(userPerformance)
            .map(u => ({ ...u, completionRate: u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0 }))
            .sort((a, b) => b.total - a.total);

        const sortedUnitStats = Object.values(unitPerformance)
            .filter(u => u.totalProjects > 0)
            .map(u => ({ ...u, completionRate: u.totalTasks > 0 ? Math.round((u.completed / u.totalTasks) * 100) : 0 }))
            .sort((a, b) => b.totalTasks - a.totalTasks);

        return { 
            kpiStats: { totalProjects, totalTasks, completedTasks: completedTasksCount, inProgressTasks, pendingTasks, overdueTasks, upcomingTasks, completionRate },
            allActiveTasks: activeList,
            allCompletedTasks: completedList,
            userStatsList: sortedUserStats,
            unitStatsList: sortedUnitStats
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

    const handleShareFilteredView = () => {
        const params = new URLSearchParams();
        if (taskFilter.project) params.set('project', taskFilter.project);
        if (taskFilter.responsible) params.set('responsible', taskFilter.responsible);
        if (taskFilter.status) params.set('status', taskFilter.status);
        if (taskFilter.search) params.set('search', taskFilter.search);
        params.set('view', 'dashboard');
        params.set('tab', dashboardTab);

        const link = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        setShareModalInfo({ isOpen: true, title: 'Share Filtered View', link });
    };

    const handleShareSpecificTask = (task) => {
        const params = new URLSearchParams();
        params.set('project', task.projectId);
        params.set('search', task.description);
        params.set('view', 'dashboard');
        params.set('tab', task.status === 'Completed' ? 'completed' : 'active');

        const link = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        setShareModalInfo({ isOpen: true, title: 'Share Specific Task', link });
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
                        <div className="space-y-6">
                            {/* General KPI Row */}
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm animate-in fade-in">
                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <Target className="text-sky-600" /> Overall Project Performance
                                    </h3>
                                    <div className="flex gap-3 text-sm">
                                        <span className="flex items-center gap-1 text-gray-500"><Clock className="w-4 h-4"/> Pending: <b>{kpiStats.pendingTasks}</b></span>
                                        <span className="flex items-center gap-1 text-blue-500"><PlayCircle className="w-4 h-4"/> In Progress: <b>{kpiStats.inProgressTasks}</b></span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="bg-gray-50 border-l-4 border-l-sky-500 p-4 rounded-r-lg shadow-sm">
                                        <div className="text-gray-500 text-xs font-bold uppercase mb-1">Total Projects</div>
                                        <div className="text-2xl font-black text-gray-900">{kpiStats.totalProjects}</div>
                                    </div>
                                    <div className="bg-gray-50 border-l-4 border-l-indigo-500 p-4 rounded-r-lg shadow-sm">
                                        <div className="text-gray-500 text-xs font-bold uppercase mb-1">Total Tasks</div>
                                        <div className="text-2xl font-black text-gray-900">{kpiStats.totalTasks}</div>
                                    </div>
                                    <div className="bg-green-50 border-l-4 border-l-green-500 p-4 rounded-r-lg shadow-sm relative overflow-hidden">
                                        <div className="text-green-700 text-xs font-bold uppercase mb-1">Completion Rate</div>
                                        <div className="text-2xl font-black text-green-800">{kpiStats.completionRate}%</div>
                                        <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all" style={{ width: `${kpiStats.completionRate}%`}}></div>
                                    </div>
                                    <div className="bg-red-50 border-l-4 border-l-red-500 p-4 rounded-r-lg shadow-sm">
                                        <div className="text-red-600 text-xs font-bold uppercase mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Overdue</div>
                                        <div className="text-2xl font-black text-red-700">{kpiStats.overdueTasks}</div>
                                    </div>
                                    <div className="bg-amber-50 border-l-4 border-l-amber-500 p-4 rounded-r-lg shadow-sm">
                                        <div className="text-amber-700 text-xs font-bold uppercase mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Due Soon (7 Days)</div>
                                        <div className="text-2xl font-black text-amber-800">{kpiStats.upcomingTasks}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Program Unit Performance Cards */}
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <FolderKanban className="text-sky-600" /> Program Unit Breakdown
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {unitStatsList.map((unit) => {
                                        const UnitIcon = unit.icon || Activity;
                                        return (
                                            <Card key={unit.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                                <CardBody className="p-4">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-2 rounded-lg ${unit.color.replace('text-', 'bg-').replace('500', '100')}`}>
                                                                <UnitIcon className={`w-5 h-5 ${unit.color}`} />
                                                            </div>
                                                            <h4 className="font-bold text-gray-800">{unit.title}</h4>
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{unit.totalProjects} Projects</span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between text-sm mb-1 mt-4">
                                                        <span className="text-gray-500">Tasks Progress</span>
                                                        <span className="font-bold text-gray-700">{unit.completed} / {unit.totalTasks}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
                                                        <div className={`h-2 rounded-full ${unit.completionRate === 100 ? 'bg-green-500' : 'bg-sky-500'}`} style={{ width: `${unit.completionRate}%` }}></div>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-gray-400">
                                                        <span>{unit.active} Active</span>
                                                        <span>{unit.completionRate}% Completed</span>
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        );
                                    })}
                                    {unitStatsList.length === 0 && (
                                        <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                                            No active projects assigned to any units yet.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Detailed Team Performance KPIs */}
                            <Card className="animate-in fade-in slide-in-from-bottom-8">
                                <CardBody>
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                                        <Users className="text-indigo-600" /> Team Member Performance
                                    </h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200 border">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team Member</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-l">Total Assigned</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Completed</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pending/Prog</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-red-500 uppercase border-l">Overdue</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-l">Completion Rate</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {userStatsList.map((user) => (
                                                    <tr key={user.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-700 text-center border-l bg-gray-50/50">{user.total}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-bold text-center">{user.completed}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-bold text-center">{user.pending + user.inProgress}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-bold text-center border-l bg-red-50/30">{user.overdue}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap border-l min-w-[150px]">
                                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                                                <div className="flex-1 bg-gray-200 h-2.5 rounded-full overflow-hidden">
                                                                    <div className={`h-full ${user.completionRate > 75 ? 'bg-green-500' : user.completionRate > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${user.completionRate}%` }}></div>
                                                                </div>
                                                                <span>{user.completionRate}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {userStatsList.length === 0 && (
                                                    <tr><td colSpan="6" className="p-6 text-center text-gray-500">No tasks assigned to any team member yet.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {(dashboardTab === 'active' || dashboardTab === 'completed') && (
                        <Card className="animate-in fade-in">
                            <CardBody className="p-0">
                                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                                    <div className="flex flex-wrap gap-4 items-center flex-1">
                                        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
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
                                    <Button size="sm" variant="primary" onClick={handleShareFilteredView} className="shrink-0 shadow-sm border border-blue-600">
                                        <Share2 className="w-4 h-4 mr-2" /> Share View
                                    </Button>
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
                                                            <Button size="sm" variant="ghost" onClick={() => handleShareSpecificTask(task)} title="Share this task link">
                                                                <LinkIcon className="w-4 h-4 text-gray-500 hover:text-blue-600" />
                                                            </Button>
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
                                                        <Button size="sm" variant="ghost" onClick={() => handleShareSpecificTask(task)} title="Share this task link">
                                                            <LinkIcon className="w-4 h-4 text-gray-500 hover:text-blue-600" />
                                                        </Button>
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

            <ShareLinkModal
                isOpen={shareModalInfo.isOpen}
                onClose={() => setShareModalInfo({ isOpen: false, link: '', title: '' })}
                title={shareModalInfo.title}
                link={shareModalInfo.link}
            />
        </div>
    );
}