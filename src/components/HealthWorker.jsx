// src/components/HealthWorker.jsx
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
    Button, Card, CardBody, EmptyState, FormGroup, Input, 
    PageHeader, Select, Table, Modal, CardFooter, Spinner 
} from './CommonComponents';
import { useDataCache } from '../DataContext';
import { STATE_LOCALITIES } from './constants';
import { Download, Eye, Users, CheckCircle, AlertCircle, RefreshCw, BookOpen, FileText } from 'lucide-react';

// Export Helpers
const exportToExcel = (tableData, headers, fileName) => {
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n' + tableData.map(row => row.join(',')).join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const exportTableToPdf = (title, tableHeaders, tableBody, fileName, filters) => {
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(16);
    doc.text(title, 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(100);
    const filterText = Object.entries(filters).filter(([, value]) => value !== 'All' && value !== '').map(([key, value]) => `${key}: ${value}`).join(' | ');
    doc.text(`Filters applied: ${filterText || 'None'}`, 14, y);
    y += 10;
    autoTable(doc, { startY: y, head: [tableHeaders], body: tableBody, theme: 'grid', headStyles: { fillColor: [8, 145, 178] } });
    doc.save(`${fileName}.pdf`);
};

export function HealthWorkerView({ permissions, userStates }) {
    const { 
        participants, 
        healthFacilities, 
        courses, 
        isLoading,
        fetchParticipants,
        fetchHealthFacilities,
        fetchCourses
    } = useDataCache();

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('dashboard'); // 'dashboard' or 'directory'
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [stateFilter, setStateFilter] = useState('All');
    const [localityFilter, setLocalityFilter] = useState('All');
    const [trainingFilter, setTrainingFilter] = useState('All');
    const [sourceFilter, setSourceFilter] = useState('All');
    const [courseTypeFilter, setCourseTypeFilter] = useState('All');
    const [jobTitleFilter, setJobTitleFilter] = useState('All');
    const [projectFilter, setProjectFilter] = useState('All');
    
    const [viewingWorker, setViewingWorker] = useState(null);

    // Pagination for directory
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // --- Fetch Data on Mount ---
    useEffect(() => {
        fetchParticipants(false); 
        fetchHealthFacilities({}, false);
        fetchCourses(false);
    }, [fetchParticipants, fetchHealthFacilities, fetchCourses]);

    // --- Hard Refresh Function ---
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                fetchParticipants(true),
                fetchHealthFacilities({}, true),
                fetchCourses(true)
            ]);
        } catch (error) {
            console.error("Error refreshing health worker data:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    // --- Data Processing & Merging ---
    const allHealthWorkers = useMemo(() => {
        const safeParticipants = participants || [];
        const safeFacilities = healthFacilities || [];
        const safeCourses = courses || [];

        const workers = [];
        const courseMap = new Map(safeCourses.map(c => [c.id, c]));
        const facilityMap = new Map(safeFacilities.map(f => [f.id, f]));

        const hasStateRestrictions = permissions?.manageScope !== 'federal' && Array.isArray(userStates) && userStates.length > 0;

        const getProject = (f) => {
            if (!f) return 'N/A';
            const proj = f.project_name || f.project || f.Project || f.projectName || f['اسم المشروع'];
            if (proj && typeof proj === 'string' && proj.trim()) return proj.trim();
            if (Array.isArray(proj)) {
                const valid = proj.filter(p => typeof p === 'string' && p.trim());
                if (valid.length > 0) return valid[0].trim();
            }
            return 'N/A';
        };

        // 1. Process Course Participants (Trained Workers)
        safeParticipants.forEach(p => {
            if (p.isDeleted === true || p.isDeleted === "true") return;
            const course = courseMap.get(p.courseId);
            const workerState = p.state || course?.state;
            
            if (hasStateRestrictions && (!workerState || !userStates.includes(workerState))) return;

            const facility = facilityMap.get(p.facilityId);
            const facilityName = p.center_name || p.workplace || facility?.['اسم_المؤسسة'] || 'Unknown Facility';
            const courseType = p.course_type || course?.course_type || 'Unknown Course';

            workers.push({
                id: `participant-${p.id}`,
                name: p.name || 'Unnamed',
                jobTitle: p.job_title || 'N/A',
                phone: p.phone || 'N/A',
                state: workerState || 'N/A',
                locality: p.locality || course?.locality || 'N/A',
                facility: facilityName,
                project: getProject(facility),
                isTrained: true,
                courseType: courseType,
                trainingDetails: courseType,
                trainingDate: course?.start_date || 'N/A',
                source: 'Course Registration',
                raw: p
            });
        });

        // 2. Process Facility Staff (From Facility Forms)
        safeFacilities.forEach(f => {
            if (f.isDeleted === true || f.isDeleted === "true") return;
            const facilityState = f['الولاية'];

            if (hasStateRestrictions && (!facilityState || !userStates.includes(facilityState))) return;

            let staffList = [];
            if (f.imnci_staff) {
                 if (Array.isArray(f.imnci_staff)) {
                     staffList = f.imnci_staff;
                 } else if (typeof f.imnci_staff === 'string') {
                     try { staffList = JSON.parse(f.imnci_staff); } catch(e) { staffList = []; }
                 }
            }

            staffList.forEach((staff, index) => {
                if (!staff.name) return; // Skip empty rows
                
                const isTrained = staff.is_trained === 'Yes' || staff.is_trained === true;

                workers.push({
                    id: `facility-${f.id}-staff-${index}`,
                    name: staff.name,
                    jobTitle: staff.job_title || 'N/A',
                    phone: staff.phone || 'N/A',
                    state: facilityState || 'N/A',
                    locality: f['المحلية'] || 'N/A',
                    facility: f['اسم_المؤسسة'] || 'Unknown Facility',
                    project: getProject(f),
                    isTrained: isTrained,
                    courseType: isTrained ? 'IMNCI' : 'N/A',
                    trainingDetails: isTrained ? 'IMNCI' : 'Not Trained',
                    trainingDate: staff.training_date || 'N/A',
                    source: 'Facility Form',
                    raw: staff
                });
            });
        });

        return workers;
    }, [participants, healthFacilities, courses, permissions, userStates]);

    // --- Dynamic Dropdown Options ---
    const availableStates = useMemo(() => ['All', ...Object.keys(STATE_LOCALITIES).sort()], []);
    const availableLocalities = useMemo(() => stateFilter === 'All' ? [] : ['All', ...STATE_LOCALITIES[stateFilter].localities.map(l => l.en).sort()], [stateFilter]);
    
    const availableCourseTypes = useMemo(() => {
        const types = new Set(allHealthWorkers.map(w => w.courseType).filter(t => t !== 'N/A' && t !== 'Unknown Course'));
        return ['All', ...Array.from(types).sort()];
    }, [allHealthWorkers]);

    const availableJobTitles = useMemo(() => {
        const titles = new Set(allHealthWorkers.map(w => w.jobTitle).filter(t => t !== 'N/A' && t.trim() !== ''));
        return ['All', ...Array.from(titles).sort()];
    }, [allHealthWorkers]);

    const availableProjects = useMemo(() => {
        const projects = new Set(allHealthWorkers.map(w => w.project).filter(p => p !== 'N/A' && p.trim() !== ''));
        return ['All', ...Array.from(projects).sort()];
    }, [allHealthWorkers]);

    // --- Filtering Logic ---
    const filteredWorkers = useMemo(() => {
        let result = allHealthWorkers;

        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(w => 
                (w.name && w.name.toLowerCase().includes(lowerQ)) || 
                (w.phone && w.phone.includes(lowerQ)) ||
                (w.facility && w.facility.toLowerCase().includes(lowerQ))
            );
        }

        if (stateFilter !== 'All') result = result.filter(w => w.state === stateFilter);
        if (localityFilter !== 'All') result = result.filter(w => w.locality === localityFilter);
        if (courseTypeFilter !== 'All') result = result.filter(w => w.courseType === courseTypeFilter);
        if (jobTitleFilter !== 'All') result = result.filter(w => w.jobTitle === jobTitleFilter);
        if (projectFilter !== 'All') result = result.filter(w => w.project === projectFilter);
        if (sourceFilter !== 'All') result = result.filter(w => w.source === sourceFilter);
        if (trainingFilter !== 'All') {
            const wantTrained = trainingFilter === 'Trained';
            result = result.filter(w => w.isTrained === wantTrained);
        }

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [allHealthWorkers, searchQuery, stateFilter, localityFilter, courseTypeFilter, jobTitleFilter, projectFilter, trainingFilter, sourceFilter]);

    // --- DASHBOARD DATA (KPIs & Cross-Tab) ---
    // Specifically filter to ONLY include official Course Registration participants for the Dashboard charts
    const dashboardTrainedWorkers = useMemo(() => 
        filteredWorkers.filter(w => w.isTrained && w.source === 'Course Registration'), 
    [filteredWorkers]);

    const participantKPIs = useMemo(() => {
        const counts = { total: dashboardTrainedWorkers.length, byCourse: {} };
        dashboardTrainedWorkers.forEach(w => {
            const cType = w.courseType || 'Unknown';
            if (cType !== 'N/A') {
                counts.byCourse[cType] = (counts.byCourse[cType] || 0) + 1;
            }
        });
        return counts;
    }, [dashboardTrainedWorkers]);

    const trainedByCadreAndCourse = useMemo(() => {
        const data = {};
        const allCadres = [...new Set(dashboardTrainedWorkers.map(w => w.jobTitle))].sort();
        const allCourseTypesInFilter = [...new Set(dashboardTrainedWorkers.map(w => w.courseType))].filter(t => t !== 'N/A' && t !== 'Unknown Course').sort();
        
        dashboardTrainedWorkers.forEach(w => {
            const courseType = w.courseType || 'Unknown';
            if (courseType === 'N/A' || courseType === 'Unknown Course') return;
            if (!data[w.jobTitle]) data[w.jobTitle] = {};
            data[w.jobTitle][courseType] = (data[w.jobTitle][courseType] || 0) + 1;
        });
        
        const headers = ["Health Cadre", ...allCourseTypesInFilter];
        const body = allCadres.map(cadre => [
            cadre, 
            ...allCourseTypesInFilter.map(type => data[cadre]?.[type] || 0)
        ]);
        const totals = [
            "Total", 
            ...allCourseTypesInFilter.map(type => Object.values(data).reduce((acc, cadreData) => acc + (cadreData[type] || 0), 0))
        ];

        return { headers, body, totals };
    }, [dashboardTrainedWorkers]);

    // --- Pagination Logic ---
    const totalPages = Math.ceil(filteredWorkers.length / itemsPerPage);
    const paginatedWorkers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredWorkers.slice(start, start + itemsPerPage);
    }, [filteredWorkers, currentPage, itemsPerPage]);

    // Reset page when any filter changes
    useEffect(() => { 
        setCurrentPage(1); 
    }, [searchQuery, stateFilter, localityFilter, courseTypeFilter, jobTitleFilter, projectFilter, trainingFilter, sourceFilter]);

    // --- Export Logic ---
    const currentFiltersExportStr = { 
        'Course Type': courseTypeFilter, 
        'State': stateFilter, 
        'Locality': localityFilter, 
        'Health Worker Type': jobTitleFilter, 
        'Project': projectFilter,
        'Training Status': trainingFilter,
        'Source': sourceFilter
    };

    const handleExportExcelDirectory = () => {
        const exportData = filteredWorkers.map(w => ({
            'Name': w.name,
            'Job Title': w.jobTitle,
            'Phone': w.phone,
            'Facility': w.facility,
            'Project': w.project,
            'State': w.state,
            'Locality': w.locality,
            'Training Status': w.isTrained ? 'Trained' : 'Not Trained',
            'Course Type': w.courseType,
            'Training Date': w.trainingDate,
            'Data Source': w.source
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Health Workers");
        XLSX.writeFile(workbook, `Health_Workers_Directory_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // --- KPIs for Top Header ---
    const totalWorkers = filteredWorkers.length;
    const trainedCount = filteredWorkers.filter(w => w.isTrained).length;
    const untrainedCount = totalWorkers - trainedCount;

    if (isLoading.participants || isLoading.healthFacilities || isLoading.courses) {
        return <div className="flex justify-center p-12"><Spinner /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader 
                title="Health Workers Overview" 
                subtitle="Consolidated database and analysis of all health workers."
                actions={
                    <div className="flex gap-2">
                        <Button onClick={handleRefresh} disabled={isRefreshing} variant="secondary" className="flex items-center gap-2">
                            {isRefreshing ? <Spinner size="sm" /> : <RefreshCw size={16} />} 
                            Refresh Data
                        </Button>
                    </div>
                }
            />

            {/* Sub-Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveSubTab('dashboard')}
                        className={`whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm transition-colors ${activeSubTab === 'dashboard' ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-400'}`}
                    >
                        Health Worker Dashboard
                    </button>
                    <button
                        onClick={() => setActiveSubTab('directory')}
                        className={`whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm transition-colors ${activeSubTab === 'directory' ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-400'}`}
                    >
                        Health Worker Directory
                    </button>
                </nav>
            </div>

            {/* Global Filters (Applies to both Dashboard and Directory) */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Global Filters & Search</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormGroup label="Search">
                        <Input placeholder="Name, Phone, Facility..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </FormGroup>
                    <FormGroup label="State">
                        <Select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setLocalityFilter('All'); }}>
                            {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Locality">
                        <Select value={localityFilter} onChange={e => setLocalityFilter(e.target.value)} disabled={stateFilter === 'All'}>
                            {availableLocalities.length === 0 ? <option value="All">All</option> : availableLocalities.map(l => <option key={l} value={l}>{l}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Course Type">
                        <Select value={courseTypeFilter} onChange={e => setCourseTypeFilter(e.target.value)}>
                            {availableCourseTypes.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Health Worker Type (Cadre)">
                        <Select value={jobTitleFilter} onChange={e => setJobTitleFilter(e.target.value)}>
                            {availableJobTitles.map(j => <option key={j} value={j}>{j}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Project">
                        <Select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
                            {availableProjects.map(p => <option key={p} value={p}>{p}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Training Status">
                        <Select value={trainingFilter} onChange={e => setTrainingFilter(e.target.value)}>
                            <option value="All">All Statuses</option>
                            <option value="Trained">Trained</option>
                            <option value="Untrained">Untrained</option>
                        </Select>
                    </FormGroup>
                    <FormGroup label="Data Source">
                        <Select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                            <option value="All">All Sources</option>
                            <option value="Course Registration">Course Registration</option>
                            <option value="Facility Form">Facility Form</option>
                        </Select>
                    </FormGroup>
                </div>
            </div>

            {/* TAB CONTENT: DASHBOARD */}
            {activeSubTab === 'dashboard' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="mt-2 border-t border-gray-200 pt-4">
                        <h3 className="text-xl font-extrabold text-gray-800 mb-6 flex items-center gap-2">
                            <BookOpen className="text-sky-600" size={24} />
                            Course Registration Analytics
                        </h3>
                        
                        {/* Enhanced Participant KPIs Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-8">
                            {/* Total Card */}
                            <div className="col-span-2 md:col-span-1 lg:col-span-1 p-5 bg-gradient-to-br from-indigo-600 to-sky-600 rounded-xl shadow-md text-white flex flex-col justify-between">
                                <div className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-2">Total Participants</div>
                                <div className="text-4xl font-extrabold">{participantKPIs.total}</div>
                            </div>
                            
                            {/* Course Specific Cards */}
                            {Object.entries(participantKPIs.byCourse).sort().map(([course, count]) => (
                                <div key={course} className="p-5 bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-sky-500 flex flex-col justify-between hover:shadow-md transition-shadow">
                                    <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">{course}</div>
                                    <div className="text-3xl font-bold text-gray-800">{count}</div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Enhanced Trained by Health Cadre Table */}
                        <Card className="p-0 overflow-hidden border border-gray-200 shadow-sm mt-8">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm text-sky-600">
                                        <Users size={20} />
                                    </div>
                                    <h4 className="font-bold text-lg text-gray-800">Trained by Health Cadre</h4>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" size="sm" onClick={() => exportToExcel(trainedByCadreAndCourse.body.concat([trainedByCadreAndCourse.totals]), trainedByCadreAndCourse.headers, "Participant_Dashboard_by_Cadre")} className="flex items-center gap-1">
                                        <Download size={14}/> Excel
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => exportTableToPdf("Trained by Health Cadre", trainedByCadreAndCourse.headers, trainedByCadreAndCourse.body.concat([trainedByCadreAndCourse.totals]), "Participant_Dashboard_by_Cadre", currentFiltersExportStr)} className="flex items-center gap-1">
                                        <FileText size={14}/> PDF
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="p-0">
                                {trainedByCadreAndCourse.headers.length > 1 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm border-collapse">
                                            <thead className="bg-white border-b-2 border-gray-100">
                                                <tr className="text-left text-gray-500 uppercase tracking-wider text-xs">
                                                    {trainedByCadreAndCourse.headers.map((h, i) => (
                                                        <th key={i} className="py-4 px-6 font-bold">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-50">
                                                {trainedByCadreAndCourse.body.map((row, index) => (
                                                    <tr key={index} className="hover:bg-sky-50/50 transition-colors">
                                                        {row.map((cell, cellIndex) => (
                                                            <td key={cellIndex} className={`py-3 px-6 ${cellIndex === 0 ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                                                                {cell}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 border-t border-gray-200 text-gray-900">
                                                <tr>
                                                    {trainedByCadreAndCourse.totals.map((cell, index) => (
                                                        <td key={index} className={`py-4 px-6 ${index === 0 ? 'font-extrabold uppercase text-xs tracking-wider' : 'font-bold'}`}>
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-8">
                                        <EmptyState message="No trained participants match your current filters." />
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: DIRECTORY */}
            {activeSubTab === 'directory' && (
                <div className="space-y-4 animate-fade-in">
                    {/* General KPIs (Top level data) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-4">
                            <div className="bg-sky-100 p-3 rounded-full text-sky-600"><Users size={24} /></div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Total Health Workers</p>
                                <h4 className="text-2xl font-bold text-gray-900">{totalWorkers}</h4>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-4">
                            <div className="bg-green-100 p-3 rounded-full text-green-600"><CheckCircle size={24} /></div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Trained</p>
                                <h4 className="text-2xl font-bold text-gray-900">{trainedCount}</h4>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-4">
                            <div className="bg-red-100 p-3 rounded-full text-red-600"><AlertCircle size={24} /></div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Untrained (Facility Data)</p>
                                <h4 className="text-2xl font-bold text-gray-900">{untrainedCount}</h4>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold">Health Worker List</h3>
                        <Button onClick={handleExportExcelDirectory} variant="secondary" className="flex items-center gap-2">
                            <Download size={16} /> Export List to Excel
                        </Button>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <Table headers={["Name", "Job Title", "Facility", "Location", "Status", "Source", "Action"]}>
                            {paginatedWorkers.length > 0 ? paginatedWorkers.map(w => (
                                <tr key={w.id} className="hover:bg-gray-50">
                                    <td className="p-3 border-b text-sm font-medium text-gray-900">{w.name}</td>
                                    <td className="p-3 border-b text-sm text-gray-600">{w.jobTitle}</td>
                                    <td className="p-3 border-b text-sm text-gray-600">{w.facility}</td>
                                    <td className="p-3 border-b text-sm text-gray-600">{w.state} - {w.locality}</td>
                                    <td className="p-3 border-b text-sm">
                                        {w.isTrained 
                                            ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Trained</span>
                                            : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Untrained</span>
                                        }
                                    </td>
                                    <td className="p-3 border-b text-sm text-gray-500 text-xs">{w.source}</td>
                                    <td className="p-3 border-b text-sm text-right">
                                        <Button size="sm" variant="secondary" onClick={() => setViewingWorker(w)} className="flex items-center gap-1">
                                            <Eye size={14} /> View
                                        </Button>
                                    </td>
                                </tr>
                            )) : (
                                <EmptyState message="No health workers found matching your criteria." colSpan={7} />
                            )}
                        </Table>
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t flex justify-between items-center bg-gray-50">
                                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                                <div className="flex gap-2">
                                    <Button variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
                                    <Button variant="secondary" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Worker Details Modal (Applies to both tabs) */}
            {viewingWorker && (
                <Modal isOpen={!!viewingWorker} onClose={() => setViewingWorker(null)} title="Health Worker Profile">
                    <CardBody className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                            <div><span className="block text-sm font-medium text-gray-500">Full Name</span><span className="block text-gray-900 font-semibold">{viewingWorker.name}</span></div>
                            <div><span className="block text-sm font-medium text-gray-500">Phone Number</span><span className="block text-gray-900">{viewingWorker.phone}</span></div>
                            <div><span className="block text-sm font-medium text-gray-500">Job Title</span><span className="block text-gray-900">{viewingWorker.jobTitle}</span></div>
                            <div><span className="block text-sm font-medium text-gray-500">Facility</span><span className="block text-gray-900">{viewingWorker.facility}</span></div>
                            <div><span className="block text-sm font-medium text-gray-500">Project</span><span className="block text-gray-900">{viewingWorker.project}</span></div>
                            <div><span className="block text-sm font-medium text-gray-500">State</span><span className="block text-gray-900">{viewingWorker.state}</span></div>
                            <div><span className="block text-sm font-medium text-gray-500">Locality</span><span className="block text-gray-900">{viewingWorker.locality}</span></div>
                            
                            <div className="md:col-span-2 border-t pt-4 mt-2">
                                <h4 className="font-semibold text-gray-800 mb-3">Training Information</h4>
                            </div>
                            <div>
                                <span className="block text-sm font-medium text-gray-500">Status</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${viewingWorker.isTrained ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {viewingWorker.isTrained ? 'Trained' : 'Untrained'}
                                </span>
                            </div>
                            <div><span className="block text-sm font-medium text-gray-500">Course Type</span><span className="block text-gray-900">{viewingWorker.courseType}</span></div>
                            <div><span className="block text-sm font-medium text-gray-500">Training Details</span><span className="block text-gray-900">{viewingWorker.trainingDetails}</span></div>
                            <div><span className="block text-sm font-medium text-gray-500">Training Date</span><span className="block text-gray-900">{viewingWorker.trainingDate}</span></div>
                            <div><span className="block text-sm font-medium text-gray-500">Data Origin</span><span className="block text-gray-900">{viewingWorker.source}</span></div>
                        </div>
                    </CardBody>
                    <CardFooter className="flex justify-end">
                        <Button variant="secondary" onClick={() => setViewingWorker(null)}>Close</Button>
                    </CardFooter>
                </Modal>
            )}
        </div>
    );
}