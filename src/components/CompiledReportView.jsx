import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from 'html2canvas';

// Reusing components and styles from your ecosystem
import { Card, Button, Table, EmptyState, Spinner, PdfIcon, Modal } from './CommonComponents'; 
import { amiriFontBase64 } from './AmiriFont.js'; 

// Added Auth and Firebase imports for permissions
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore'; 

// Data and cache imports for Auto Fetching
import { fetchFacilitiesHistoryMultiDate, upsertCourse } from '../data.js';
import { useDataCache } from '../DataContext';

// --- Helper Components ---
const Select = (props) => <select {...props} className={`border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${props.className || ''}`}>{props.children}</select>;
const FormGroup = ({ label, children }) => (<div className="flex flex-col gap-1 mb-2"><label className="font-semibold text-gray-700 text-xs uppercase tracking-wide">{label}</label>{children}</div>);

// --- Styles Helper ---
const getScoreColorClass = (value, type = 'percentage') => {
    if (isNaN(value) || value === null) return 'bg-gray-700 text-white';
    if (type === 'improvement') {
        if (value > 50) return 'bg-green-200 text-green-800';
        if (value >= 25) return 'bg-yellow-200 text-yellow-800';
        if (value >= 0) return 'bg-gray-200 text-gray-800';
        return 'bg-red-200 text-red-800';
    }
    if (value === 100) return 'bg-green-200 text-green-800';
    if (value >= 95) return 'bg-yellow-200 text-yellow-800';
    if (value >= 90) return 'bg-orange-200 text-orange-800';
    return 'bg-red-200 text-red-800';
};

const fmtPct = (value) => (isNaN(value) || value === null ? 'N/A' : `+${Number(value).toFixed(2)}%`);
const fmtCurrency = (value) => (isNaN(value) || value === null ? '$0' : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);

export default function CompiledReportView({ allCourses, allParticipants, allHealthFacilities = [] }) {
    // --- State ---
    const [filterType, setFilterType] = useState('All'); 
    const [filterSubType, setFilterSubType] = useState('All');
    const [filterState, setFilterState] = useState('All');
    const [yearFilter, setYearFilter] = useState('All');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // --- Authentication & Permissions ---
    const { user } = useAuth();
    const dataCache = useDataCache();
    const fetchCourses = dataCache?.fetchCourses;
    const [isSuperUser, setIsSuperUser] = useState(false);

    useEffect(() => {
        if (user) {
            getDoc(doc(db, 'users', user.uid)).then(snap => {
                if (snap.exists() && snap.data().permissions?.canUseSuperUserAdvancedFeatures) {
                    setIsSuperUser(true);
                }
            }).catch(e => console.error(e));
        }
    }, [user]);

    // --- Coverage Auto Fetch State ---
    const [isCoverageModalOpen, setIsCoverageModalOpen] = useState(false);
    const [historicalCoveragePreview, setHistoricalCoveragePreview] = useState(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isSavingCoverage, setIsSavingCoverage] = useState(false);
    const [activeCourseForCoverage, setActiveCourseForCoverage] = useState(null);

    // --- Auto Fetch Logic ---
    const handleAutoFetchCoverage = async (courseId) => {
        const course = allCourses.find(c => c.id === courseId);
        if (!course) return;

        setActiveCourseForCoverage(course);
        setIsCoverageModalOpen(true);
        setIsPreviewLoading(true);
        setHistoricalCoveragePreview(null);

        try {
            // 1. Get Participants for this course
            const coursePax = allParticipants.filter(p => p.courseId === course.id);

            // 2. Identify new IMNCI facilities (mimicking CourseReportView logic)
            const newImciFacilityMap = new Map();
            coursePax.filter(p => p.introduced_imci_to_facility === true || p.introduced_imci_to_facility === "true").forEach(p => {
                const key = `${p.center_name}|${p.locality}|${p.state}`;
                if (!newImciFacilityMap.has(key)) {
                    const matchedFacility = allHealthFacilities?.find(f => 
                        f['اسم_المؤسسة'] === p.center_name && 
                        f['المحلية'] === p.locality && 
                        f['الولاية'] === p.state
                    );
                    let isHospital = false;
                    if (matchedFacility && matchedFacility['نوع_المؤسسةالصحية']) {
                        isHospital = ['مستشفى', 'مستشفى ريفي'].includes(matchedFacility['نوع_المؤسسةالصحية']);
                    } else {
                        const name = p.center_name;
                        isHospital = (typeof name === 'string') && (name.includes('مستشفى') || name.toLowerCase().includes('hospital'));
                    }
                    newImciFacilityMap.set(key, { 
                        name: p.center_name, locality: p.locality, state: p.state, isHospital: isHospital
                    });
                }
            });
            const newImciFacilities = Array.from(newImciFacilityMap.values());

            // 3. States & Localities
            const courseStates = course.states || (course.state ? course.state.split(',').map(s=>s.trim()) : []);
            const courseLocalities = course.localities || (course.locality ? course.locality.split(',').map(l=>l.trim()) : []);
            const combinedStates = [...new Set([...courseStates, ...newImciFacilities.map(f => f.state)])].filter(Boolean);
            const combinedLocalities = [...new Set([...courseLocalities, ...newImciFacilities.map(f => f.locality)])].filter(Boolean);

            // 4. Fetch History
            const historicalFacilitiesData = await fetchFacilitiesHistoryMultiDate(combinedStates, [course.start_date]);
            const historicalFacilities = historicalFacilitiesData[0] || [];

            // 5. Calculate Coverage Info
            const calculateCoverageInfo = (facilitiesFilter, newImciFilter, isNational = false) => {
                const historicalPhcFacilities = historicalFacilities
                    .filter(facilitiesFilter)
                    .filter(f => f['هل_المؤسسة_تعمل'] === 'Yes')
                    .filter(f => ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية']));
                
                let totalPhc = historicalPhcFacilities.length;
                if (isNational) {
                    totalPhc = (allHealthFacilities || [])
                        .filter(facilitiesFilter)
                        .filter(f => f['هل_المؤسسة_تعمل'] === 'Yes')
                        .filter(f => ['وحدة صحة الاسرة', 'مركز صحة الاسرة'].includes(f['نوع_المؤسسةالصحية']))
                        .length;
                }
                
                const newPhcImciFacilities = newImciFacilities.filter(f => !f.isHospital);
                const courseNewPhcs = newPhcImciFacilities.filter(newImciFilter);
                const newPhc = courseNewPhcs.length;
                const newPhcNames = new Set(courseNewPhcs.map(f => f.name));

                let phcWithImnciBefore = 0;

                historicalPhcFacilities.forEach(f => {
                    if (f['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') {
                        if (!newPhcNames.has(f['اسم_المؤسسة']) && !newPhcNames.has(f['name'])) {
                            phcWithImnciBefore++;
                        }
                    }
                });

                const covBefore = totalPhc > 0 ? (phcWithImnciBefore / totalPhc) * 100 : 0;
                const covAfter = totalPhc > 0 ? ((phcWithImnciBefore + newPhc) / totalPhc) * 100 : 0;
                const increase = covAfter - covBefore; 
                
                return { totalPhc, phcWithImnciBefore, newPhc, covBefore, covAfter, increase };
            };

            const nationalCov = calculateCoverageInfo(f => f['الولاية'] !== 'إتحادي', () => true, true);
            
            const stateCoverage = combinedStates.map(s => {
                const info = calculateCoverageInfo(f => f['الولاية'] === s, f => f.state === s, false);
                return { name: s, ...info };
            });

            const localityCoverage = combinedLocalities.map(l => {
                const info = calculateCoverageInfo(f => f['المحلية'] === l, f => f.locality === l, false);
                return { name: l, ...info };
            });

            const totalBudget = Number(course.course_budget) || 0;
            const costPerParticipant = coursePax.length > 0 ? totalBudget / coursePax.length : 0;
            const costPerNewFacility = nationalCov.newPhc > 0 ? totalBudget / nationalCov.newPhc : 0;

            setHistoricalCoveragePreview({
                totalBudget, costPerParticipant, costPerNewFacility, totalNewFacilities: newImciFacilities.length,
                nationalCov, stateCoverage, localityCoverage,
                retrievedAt: new Date().toISOString()
            });

        } catch (error) {
            console.error("Error calculating historical coverage:", error);
            alert("Failed to load historical coverage baseline.");
            setIsCoverageModalOpen(false);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleConfirmCoverage = async () => {
        if (!activeCourseForCoverage || !historicalCoveragePreview) return;

        setIsSavingCoverage(true);
        try {
            const currentUserIdentifier = user?.displayName || user?.email || 'Unknown';
            await upsertCourse({ 
                id: activeCourseForCoverage.id, 
                coverageSnapshot: historicalCoveragePreview 
            }, currentUserIdentifier); 
            
            if (fetchCourses) await fetchCourses(); 
            
            setIsCoverageModalOpen(false);
            alert("Baseline coverage saved successfully.");
        } catch (error) {
            alert("Failed to save coverage.");
        } finally {
            setIsSavingCoverage(false);
        }
    };


    // --- Derived Data: Filter Options ---
    const courseTypes = useMemo(() => ['All', ...new Set(allCourses.map(c => c.course_type).filter(Boolean))].sort(), [allCourses]);
    const subTypes = useMemo(() => {
        if (filterType === 'All') return ['All'];
        return ['All', ...new Set(allCourses.filter(c => c.course_type === filterType).map(c => c.imci_sub_type).filter(Boolean))].sort();
    }, [allCourses, filterType]);
    const states = useMemo(() => {
        const s = new Set();
        allCourses.forEach(c => {
            if (c.states && Array.isArray(c.states)) c.states.forEach(st => s.add(st));
            else if (c.state) c.state.split(',').forEach(st => s.add(st.trim()));
        });
        return ['All', ...Array.from(s).sort()];
    }, [allCourses]);
    const years = useMemo(() => ['All', ...new Set(allCourses.map(c => new Date(c.start_date).getFullYear()).filter(Boolean))].sort(), [allCourses]);

    // --- Derived Data: Filtered Lists ---
    const filteredCourses = useMemo(() => {
        return allCourses.filter(c => {
            const cDate = new Date(c.start_date);
            const matchType = filterType === 'All' || c.course_type === filterType;
            const matchSubType = filterSubType === 'All' || c.imci_sub_type === filterSubType;
            
            // Check state array for multiple states per course
            const cStates = c.states || (c.state ? c.state.split(',').map(s=>s.trim()) : []);
            const matchState = filterState === 'All' || cStates.includes(filterState);
            
            const matchYear = yearFilter === 'All' || cDate.getFullYear().toString() === yearFilter;
            return matchType && matchSubType && matchState && matchYear;
        });
    }, [allCourses, filterType, filterSubType, filterState, yearFilter]);

    const filteredParticipants = useMemo(() => {
        const courseIds = new Set(filteredCourses.map(c => c.id));
        return allParticipants.filter(p => courseIds.has(p.courseId));
    }, [allParticipants, filteredCourses]);

    // --- Aggregation Logic ---
    const reportData = useMemo(() => {
        const totalCourses = filteredCourses.length;
        const totalParticipants = filteredParticipants.length;
        
        // Performance KPIs breakdown
        const allCourseTypesList = [...new Set(allCourses.map(c => c.course_type).filter(Boolean))].sort();
        const courseCountsByType = {};
        allCourseTypesList.forEach(t => {
            courseCountsByType[t] = filteredCourses.filter(c => c.course_type === t).length;
        });

        const validPreScores = filteredParticipants.map(p => Number(p.pre_test_score)).filter(s => !isNaN(s) && s > 0);
        const validPostScores = filteredParticipants.map(p => Number(p.post_test_score)).filter(s => !isNaN(s) && s > 0);
        
        const avgPre = validPreScores.length ? (validPreScores.reduce((a,b)=>a+b,0)/validPreScores.length) : 0;
        const avgPost = validPostScores.length ? (validPostScores.reduce((a,b)=>a+b,0)/validPostScores.length) : 0;
        const improvement = avgPre > 0 ? ((avgPost - avgPre) / avgPre) * 100 : 0;

        // KPIs: Budget, Coverage & Investment Metrics
        const totalBudget = filteredCourses.reduce((sum, c) => sum + (Number(c.course_budget) || 0), 0);
        
        let totalNewFacilities = 0;
        let overallNatCovInc = 0;
        
        filteredCourses.forEach(c => {
            if (c.coverageSnapshot && c.coverageSnapshot.nationalCov) {
                totalNewFacilities += Number(c.coverageSnapshot.nationalCov.newPhc) || 0;
                overallNatCovInc += Number(c.coverageSnapshot.nationalCov.increase) || 0;
            } else {
                const coursePax = filteredParticipants.filter(p => p.courseId === c.id);
                const uniqueNew = new Set(
                    coursePax
                        .filter(p => p.introduced_imci_to_facility === true || p.introduced_imci_to_facility === "true")
                        .map(p => `${p.state}-${p.locality}-${p.center_name}`)
                );
                totalNewFacilities += uniqueNew.size;
            }
        });

        const costPerParticipant = totalParticipants > 0 ? totalBudget / totalParticipants : 0;
        const costPerNewFacility = totalNewFacilities > 0 ? totalBudget / totalNewFacilities : 0;

        // Number of Courses by State (Table Data)
        const allStatesInFilter = [...new Set(filteredCourses.flatMap(c => c.states || (c.state ? c.state.split(',').map(s=>s.trim()) : [])))].filter(Boolean).sort();
        const allCourseTypesInFilter = [...new Set(filteredCourses.map(c => c.course_type))].filter(Boolean).sort();
        const dataByState = {};
        const totalCounts = {};

        filteredCourses.forEach(c => {
            const type = c.course_type || 'Unknown';
            const cStates = c.states || (c.state ? c.state.split(',').map(s=>s.trim()) : []);
            cStates.forEach(state => {
                if (!state) return;
                if (!dataByState[state]) dataByState[state] = {};
                dataByState[state][type] = (dataByState[state][type] || 0) + 1;
                totalCounts[state] = (totalCounts[state] || 0) + 1;
            });
        });

        const coursesByStateHeaders = ["State", ...allCourseTypesInFilter, "Total"];
        const coursesByStateBody = allStatesInFilter.map(state => {
            const row = [state];
            allCourseTypesInFilter.forEach(type => row.push(dataByState[state]?.[type] || 0));
            row.push(totalCounts[state] || 0);
            return row;
        });

        const coursesByStateTotals = ["Total"];
        allCourseTypesInFilter.forEach(type => {
            coursesByStateTotals.push(Object.values(dataByState).reduce((acc, stateData) => acc + (stateData[type] || 0), 0));
        });
        coursesByStateTotals.push(coursesByStateTotals.slice(1).reduce((acc, sum) => acc + sum, 0));

        // Course List Data with Coverage Percentages
        const courseList = filteredCourses.map(c => {
            const coursePax = allParticipants.filter(p => p.courseId === c.id);
            const cStates = c.states || (c.state ? c.state.split(',').map(s=>s.trim()) : []);
            const cLocalities = c.localities || (c.locality ? c.locality.split(',').map(l=>l.trim()) : []);
            
            let cNewFacs = 0;
            let stateCovInc = null;
            let locCovInc = null;
            let natCovInc = null;
            let hasCoverageSnapshot = !!c.coverageSnapshot;

            if (hasCoverageSnapshot) {
                cNewFacs = Number(c.coverageSnapshot.nationalCov?.newPhc) || 0;
                natCovInc = Number(c.coverageSnapshot.nationalCov?.increase) || 0;
                
                if (c.coverageSnapshot.stateCoverage && c.coverageSnapshot.stateCoverage.length > 0) {
                    const sum = c.coverageSnapshot.stateCoverage.reduce((acc, s) => acc + (Number(s.increase) || 0), 0);
                    stateCovInc = sum / c.coverageSnapshot.stateCoverage.length;
                }
                if (c.coverageSnapshot.localityCoverage && c.coverageSnapshot.localityCoverage.length > 0) {
                    const sum = c.coverageSnapshot.localityCoverage.reduce((acc, l) => acc + (Number(l.increase) || 0), 0);
                    locCovInc = sum / c.coverageSnapshot.localityCoverage.length;
                }
            } else {
                cNewFacs = new Set(
                    coursePax
                        .filter(p => p.introduced_imci_to_facility === true || p.introduced_imci_to_facility === "true")
                        .map(p => p.center_name || p.health_facility)
                ).size;
                
                stateCovInc = null;
                locCovInc = null;
                natCovInc = null;
            }

            return {
                id: c.id,
                type: c.course_type,
                state: cStates.join(', '),
                locality: cLocalities.join(', '),
                date: c.start_date,
                partner: c.funded_by || 'N/A',
                budget: Number(c.course_budget) || 0,
                coverageAdded: cNewFacs,
                locCovInc,
                stateCovInc,
                natCovInc,
                pax: coursePax.length,
                hasCoverageSnapshot
            };
        }).sort((a, b) => b.coverageAdded - a.coverageAdded);

        // Group courses by Type to allow distinct tables and distinct KPIs
        const groupedCourses = {};
        allCourseTypesInFilter.forEach(t => {
            const coursesOfType = courseList.filter(c => c.type === t);
            if (coursesOfType.length === 0) return;

            const tBudget = coursesOfType.reduce((acc, c) => acc + c.budget, 0);
            const tPax = coursesOfType.reduce((acc, c) => acc + c.pax, 0);
            const tNewFacs = coursesOfType.reduce((acc, c) => acc + c.coverageAdded, 0);

            const count = coursesOfType.length;
            const aBudget = count > 0 ? tBudget / count : 0;
            const aPax = count > 0 ? tPax / count : 0;
            const aNewFacs = count > 0 ? tNewFacs / count : 0;

            const locCovs = coursesOfType.map(c => c.locCovInc).filter(v => v !== null);
            const stateCovs = coursesOfType.map(c => c.stateCovInc).filter(v => v !== null);
            const natCovs = coursesOfType.map(c => c.natCovInc).filter(v => v !== null);

            const tLocCov = locCovs.reduce((a,b)=>a+b, 0);
            const tStateCov = stateCovs.reduce((a,b)=>a+b, 0);
            const tNatCov = natCovs.reduce((a,b)=>a+b, 0);

            const aLocCov = locCovs.length > 0 ? tLocCov / locCovs.length : null;
            const aStateCov = stateCovs.length > 0 ? tStateCov / stateCovs.length : null;
            const aNatCov = natCovs.length > 0 ? tNatCov / natCovs.length : null;

            // KPIs specific to this group
            const paxForType = filteredParticipants.filter(p => coursesOfType.some(c => c.id === p.courseId));
            const validPre = paxForType.map(p => Number(p.pre_test_score)).filter(s => !isNaN(s) && s > 0);
            const validPost = paxForType.map(p => Number(p.post_test_score)).filter(s => !isNaN(s) && s > 0);
            const typeAvgPre = validPre.length ? validPre.reduce((a,b)=>a+b,0)/validPre.length : 0;
            const typeAvgPost = validPost.length ? validPost.reduce((a,b)=>a+b,0)/validPost.length : 0;
            const typeAvgImp = typeAvgPre > 0 ? ((typeAvgPost - typeAvgPre) / typeAvgPre) * 100 : 0;
            const typeCostPerPax = tPax > 0 ? tBudget / tPax : 0;
            const typeCostPerFac = tNewFacs > 0 ? tBudget / tNewFacs : 0;

            groupedCourses[t] = {
                type: t,
                courses: coursesOfType,
                totals: { budget: tBudget, pax: tPax, newFacs: tNewFacs, locCov: tLocCov, stateCov: tStateCov, natCov: tNatCov },
                averages: { budget: aBudget, pax: aPax, newFacs: aNewFacs, locCov: aLocCov, stateCov: aStateCov, natCov: aNatCov },
                kpis: { avgPre: typeAvgPre, avgPost: typeAvgPost, avgImp: typeAvgImp, costPerPax: typeCostPerPax, costPerFac: typeCostPerFac, totalBudget: tBudget, totalPax: tPax, totalNewFacs: tNewFacs, overallNatCovInc: tNatCov }
            };
        });

        return { 
            totalCourses, totalParticipants, totalBudget, totalNewFacilities, 
            costPerParticipant, costPerNewFacility, overallNatCovInc,
            avgPre, avgPost, improvement, 
            allCourseTypesList, courseCountsByType,
            coursesByStateHeaders, coursesByStateBody, coursesByStateTotals,
            courseList, groupedCourses
        };
    }, [filteredCourses, filteredParticipants, allParticipants, allHealthFacilities]);

    // --- PDF Export ---
    const handlePdfExport = async () => {
        setIsGeneratingPdf(true);
        const doc = new jsPDF('landscape', 'mm', 'a4'); 
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');

        let y = 15;
        const margin = 14;
        const pageHeight = doc.internal.pageSize.getHeight();

        // Title
        doc.setFontSize(18);
        doc.text(`Courses Dashboard Report: ${filterType}`, margin, y);
        y += 8;
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Filters: ${filterState} | ${filterSubType} | Year: ${yearFilter}`, margin, y);
        y += 15;

        // Overall Performance KPIs
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Overall Performance KPIs", margin, y);
        y += 5;
        const perfHead = ['Total Courses', 'Total Pax', ...reportData.allCourseTypesList, 'Avg Pre', 'Avg Post', 'Avg Imp.'];
        const perfBody = [
            reportData.totalCourses,
            reportData.totalParticipants,
            ...reportData.allCourseTypesList.map(t => reportData.courseCountsByType[t] || 0),
            `${reportData.avgPre.toFixed(1)}%`,
            `${reportData.avgPost.toFixed(1)}%`,
            `${reportData.improvement.toFixed(1)}%`
        ];

        autoTable(doc, {
            startY: y,
            head: [perfHead],
            body: [perfBody],
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], halign: 'center' },
            bodyStyles: { halign: 'center', fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 10;

        // Overall Coverage & Investment KPIs
        doc.text("Overall Coverage & Investment KPIs", margin, y);
        y += 5;
        autoTable(doc, {
            startY: y,
            head: [['Total Budget', 'New Coverage', 'Nat Cov. Increase', 'Cost/Pax', 'Cost/New Center']],
            body: [[
                fmtCurrency(reportData.totalBudget),
                reportData.totalNewFacilities,
                `+${reportData.overallNatCovInc.toFixed(4)}%`,
                fmtCurrency(reportData.costPerParticipant),
                fmtCurrency(reportData.costPerNewFacility)
            ]],
            theme: 'grid',
            headStyles: { fillColor: [8, 145, 178], halign: 'center' },
            bodyStyles: { halign: 'center', fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 15;

        // Courses By State Table
        doc.text("Number of Courses by State", margin, y);
        y += 5;
        autoTable(doc, {
            startY: y,
            head: [reportData.coursesByStateHeaders],
            body: reportData.coursesByStateBody,
            foot: [reportData.coursesByStateTotals],
            theme: 'grid',
            styles: { font: 'Amiri' },
            headStyles: { fillColor: [41, 128, 185], halign: 'center' },
            bodyStyles: { halign: 'center' },
            footStyles: { fillColor: [229, 231, 235], textColor: [0,0,0], fontStyle: 'bold', halign: 'center' }
        });
        y = doc.lastAutoTable.finalY + 15;

        // Course Specific Tables
        Object.keys(reportData.groupedCourses).sort().forEach(type => {
            if (y > pageHeight - 40) { doc.addPage(); y = 15; }
            const data = reportData.groupedCourses[type];
            doc.setFontSize(14);
            doc.text(`${type} - Performance & Investment`, margin, y);
            y += 5;

            // KPI mini summary for the type
            doc.setFontSize(10);
            doc.text(`Budget: ${fmtCurrency(data.kpis.totalBudget)} | Pax: ${data.kpis.totalPax} | Cost/Pax: ${fmtCurrency(data.kpis.costPerPax)} | Avg Imp: ${data.kpis.avgImp.toFixed(1)}%`, margin, y);
            y += 5;

            const tableHead = [['Type', 'State', 'Locality', 'Partner', 'Budget', 'New Facs', '+Loc Cov%', '+State Cov%', '+Nat Cov%', 'Pax']];
            const tableBody = [
                ['TOTAL', '-', '-', '-', fmtCurrency(data.totals.budget), data.totals.newFacs, fmtPct(data.totals.locCov), fmtPct(data.totals.stateCov), fmtPct(data.totals.natCov), data.totals.pax],
                ['AVERAGE', '-', '-', '-', fmtCurrency(data.averages.budget), data.averages.newFacs.toFixed(1), fmtPct(data.averages.locCov), fmtPct(data.averages.stateCov), fmtPct(data.averages.natCov), data.averages.pax.toFixed(1)],
                ...data.courses.map(c => [
                    c.type, c.state, c.locality, c.partner, fmtCurrency(c.budget), c.coverageAdded, fmtPct(c.locCovInc), fmtPct(c.stateCovInc), fmtPct(c.natCovInc), c.pax
                ])
            ];

            autoTable(doc, {
                startY: y,
                head: tableHead,
                body: tableBody,
                styles: { font: 'Amiri', fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] },
                didParseCell: function(data) {
                    // Make Total and Average rows bold and slightly tinted
                    if (data.section === 'body' && (data.row.index === 0 || data.row.index === 1)) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                }
            });
            y = doc.lastAutoTable.finalY + 15;
        });

        doc.save(`Courses_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
        setIsGeneratingPdf(false);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Courses Dashboard</h2>
                    <p className="text-sm text-gray-500">
                        Consolidated performance, coverage, and investment overview.
                    </p>
                </div>
                <Button onClick={handlePdfExport} disabled={isGeneratingPdf || filteredCourses.length === 0} variant="secondary">
                    {isGeneratingPdf ? <Spinner size="sm" /> : <><PdfIcon className="w-4 h-4 mr-2"/> Export Report</>}
                </Button>
            </div>

            {/* Row 1: Filters */}
            <Card className="bg-gray-50 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormGroup label="Course Type">
                        <Select value={filterType} onChange={e => { setFilterType(e.target.value); setFilterSubType('All'); }}>
                            {courseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="Sub-Type">
                        <Select value={filterSubType} onChange={e => setFilterSubType(e.target.value)} disabled={filterType === 'All'}>
                            <option value="All">All Sub-Types</option>
                            {subTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                    </FormGroup>
                    <FormGroup label="State">
                        <Select value={filterState} onChange={e => setFilterState(e.target.value)}>
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </FormGroup>
                     <FormGroup label="Year">
                        <Select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </Select>
                    </FormGroup>
                </div>
            </Card>

            {filteredCourses.length === 0 ? (
                <EmptyState message="No data matches the selected filters." />
            ) : (
                <>
                    {/* Overall Summaries */}
                    <Card>
                        <h3 className="text-xl font-bold mb-4 border-b pb-2">Overall Summaries</h3>
                        
                        <h4 className="font-semibold text-gray-700 mb-2">Performance KPIs</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 text-center mb-6">
                            <div className="p-4 bg-gray-100 rounded-lg border border-gray-200">
                                <div className="text-sm font-semibold text-gray-600">Total Courses</div>
                                <div className="text-xl font-bold text-sky-700">{reportData.totalCourses}</div>
                            </div>
                            <div className="p-4 bg-gray-100 rounded-lg border border-gray-200">
                                <div className="text-sm font-semibold text-gray-600">Total Pax</div>
                                <div className="text-xl font-bold text-sky-700">{reportData.totalParticipants}</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="text-sm font-semibold text-gray-600">Avg Pre-Test</div>
                                <div className="text-xl font-bold">{`${reportData.avgPre.toFixed(1)}%`}</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="text-sm font-semibold text-gray-600">Avg Post-Test</div>
                                <div className="text-xl font-bold">{`${reportData.avgPost.toFixed(1)}%`}</div>
                            </div>
                            <div className={`p-4 rounded-lg border ${getScoreColorClass(reportData.improvement, 'improvement')}`}>
                                <div className="text-sm font-semibold">Avg Improvement</div>
                                <div className="text-xl font-bold">{`${reportData.improvement.toFixed(1)}%`}</div>
                            </div>
                        </div>

                        <h4 className="font-semibold text-gray-700 mb-2">Coverage & Investment KPIs</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="text-sm font-semibold text-blue-700">Total Investment</div>
                                <div className="text-xl font-bold text-blue-800">{fmtCurrency(reportData.totalBudget)}</div>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                <div className="text-sm font-semibold text-green-700">New Facilities Reached</div>
                                <div className="text-xl font-bold text-green-800">{reportData.totalNewFacilities}</div>
                            </div>
                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                                <div className="text-sm font-semibold text-yellow-700">Cost / Participant</div>
                                <div className="text-xl font-bold text-yellow-800">{fmtCurrency(reportData.costPerParticipant)}</div>
                            </div>
                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                                <div className="text-sm font-semibold text-purple-700">Cost / New Center</div>
                                <div className="text-xl font-bold text-purple-800">{fmtCurrency(reportData.costPerNewFacility)}</div>
                            </div>
                        </div>
                    </Card>

                    {/* Courses by State */}
                    <Card className="p-0 overflow-hidden">
                        <h4 className="font-semibold text-xl pl-4 pt-4 mb-4 border-b pb-2">Number of Courses by State</h4>
                        <div className="overflow-x-auto px-4 pb-4">
                            <Table headers={reportData.coursesByStateHeaders}>
                                {reportData.coursesByStateBody.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        {row.map((cell, cellIndex) => (
                                            <td key={cellIndex} className="p-2 border text-center">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                                <tr className="font-bold bg-gray-100">
                                    {reportData.coursesByStateTotals.map((cell, index) => (
                                        <td key={index} className="p-2 border text-center">{cell}</td>
                                    ))}
                                </tr>
                            </Table>
                        </div>
                    </Card>

                    {/* Render specific tables and KPIs per Course Type */}
                    {Object.keys(reportData.groupedCourses).sort().map(type => {
                        const data = reportData.groupedCourses[type];
                        
                        return (
                            <Card key={type}>
                                <div className="flex flex-col md:flex-row justify-between items-center mb-4 border-b pb-2">
                                    <h3 className="text-xl font-bold text-sky-800">{type} - Performance & Investment List</h3>
                                    <span className="text-sm text-gray-500 font-medium">{data.courses.length} Course(s)</span>
                                </div>
                                
                                {/* Specific KPIs for this Course Type */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6 text-center">
                                    <div className="p-3 bg-blue-50 rounded border border-blue-100">
                                        <div className="text-xs text-blue-700 font-semibold uppercase">Total Inv.</div>
                                        <div className="text-lg font-bold text-blue-800">{fmtCurrency(data.kpis.totalBudget)}</div>
                                    </div>
                                    <div className="p-3 bg-yellow-50 rounded border border-yellow-100">
                                        <div className="text-xs text-yellow-700 font-semibold uppercase">Cost/Pax</div>
                                        <div className="text-lg font-bold text-yellow-800">{fmtCurrency(data.kpis.costPerPax)}</div>
                                    </div>
                                    <div className="p-3 bg-purple-50 rounded border border-purple-100">
                                        <div className="text-xs text-purple-700 font-semibold uppercase">Cost/Fac</div>
                                        <div className="text-lg font-bold text-purple-800">{fmtCurrency(data.kpis.costPerFac)}</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                        <div className="text-xs text-gray-600 font-semibold uppercase">Avg Pre</div>
                                        <div className="text-lg font-bold">{data.kpis.avgPre.toFixed(1)}%</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                        <div className="text-xs text-gray-600 font-semibold uppercase">Avg Post</div>
                                        <div className="text-lg font-bold">{data.kpis.avgPost.toFixed(1)}%</div>
                                    </div>
                                    <div className={`p-3 rounded border ${getScoreColorClass(data.kpis.avgImp, 'improvement')}`}>
                                        <div className="text-xs font-semibold uppercase">Avg Imp</div>
                                        <div className="text-lg font-bold">{data.kpis.avgImp.toFixed(1)}%</div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto touch-pan-x">
                                    <Table headers={['Type', 'State', 'Locality', 'Partner', 'Budget', 'New Facs', '+ Loc Cov.', '+ State Cov.', '+ Nat Cov.', '# Pax', 'Baseline Action']}>
                                        {/* Total Row */}
                                        <tr className="bg-gray-100 font-bold border-b-2 border-gray-300">
                                            <td className="p-3 border-r text-sm">TOTAL</td>
                                            <td className="p-3 text-center">-</td>
                                            <td className="p-3 text-center">-</td>
                                            <td className="p-3 border-r text-center">-</td>
                                            <td className="p-3 text-sm font-medium text-gray-900">{fmtCurrency(data.totals.budget)}</td>
                                            <td className="p-3 text-center text-green-700">{data.totals.newFacs}</td>
                                            <td className="p-3 text-center text-green-600">{fmtPct(data.totals.locCov)}</td>
                                            <td className="p-3 text-center text-green-600">{fmtPct(data.totals.stateCov)}</td>
                                            <td className="p-3 text-center text-green-600">{fmtPct(data.totals.natCov)}</td>
                                            <td className="p-3 text-center border-r">{data.totals.pax}</td>
                                            <td className="p-3 text-center">-</td>
                                        </tr>
                                        {/* Average Row */}
                                        <tr className="bg-gray-50 font-bold border-b-2 border-gray-300">
                                            <td className="p-3 border-r text-sm">AVERAGE</td>
                                            <td className="p-3 text-center">-</td>
                                            <td className="p-3 text-center">-</td>
                                            <td className="p-3 border-r text-center">-</td>
                                            <td className="p-3 text-sm font-medium text-gray-900">{fmtCurrency(data.averages.budget)}</td>
                                            <td className="p-3 text-center text-green-700">{data.averages.newFacs.toFixed(1)}</td>
                                            <td className="p-3 text-center text-green-600">{fmtPct(data.averages.locCov)}</td>
                                            <td className="p-3 text-center text-green-600">{fmtPct(data.averages.stateCov)}</td>
                                            <td className="p-3 text-center text-green-600">{fmtPct(data.averages.natCov)}</td>
                                            <td className="p-3 text-center border-r">{data.averages.pax.toFixed(1)}</td>
                                            <td className="p-3 text-center">-</td>
                                        </tr>
                                        
                                        {/* Data Rows */}
                                        {data.courses.map((c) => (
                                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-3 border-b text-sm font-semibold">{c.type}</td>
                                                <td className="p-3 border-b text-sm">{c.state}</td>
                                                <td className="p-3 border-b text-sm">{c.locality}</td>
                                                <td className="p-3 border-b text-sm text-gray-700">{c.partner}</td>
                                                <td className="p-3 border-b text-sm font-medium text-gray-900">{fmtCurrency(c.budget)}</td>
                                                <td className="p-3 border-b text-sm text-center font-bold text-green-700">{c.coverageAdded}</td>
                                                <td className="p-3 border-b text-sm text-center font-medium text-green-600">{fmtPct(c.locCovInc)}</td>
                                                <td className="p-3 border-b text-sm text-center font-medium text-green-600">{fmtPct(c.stateCovInc)}</td>
                                                <td className="p-3 border-b text-sm text-center font-medium text-green-600">{fmtPct(c.natCovInc)}</td>
                                                <td className="p-3 border-b text-sm text-center font-medium">{c.pax}</td>
                                                <td className="p-3 border-b text-sm text-center">
                                                    {c.hasCoverageSnapshot ? (
                                                        <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">Saved</span>
                                                    ) : isSuperUser ? (
                                                        <div className="flex flex-col gap-1 items-center justify-center">
                                                            <Button size="sm" onClick={() => handleAutoFetchCoverage(c.id)}>Auto Fetch</Button>
                                                            <Button size="sm" variant="secondary" onClick={() => alert("Please open the Full Course Report to Manually Edit this baseline.")}>Manual</Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">N/A</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </Table>
                                </div>
                            </Card>
                        );
                    })}

                    {/* Modal for Historical Coverage Preview */}
                    <Modal isOpen={isCoverageModalOpen} onClose={() => setIsCoverageModalOpen(false)} title={`Historical Coverage Baseline: ${activeCourseForCoverage?.course_type}`} size="lg">
                        <div className="p-4 sm:p-6 space-y-4">
                            {isPreviewLoading ? (
                                <div className="flex flex-col items-center justify-center p-8">
                                    <Spinner size="lg" />
                                    <p className="mt-4 text-sky-700 font-semibold text-center">Calculating historical baseline coverage from facility snapshots...</p>
                                </div>
                            ) : historicalCoveragePreview ? (
                                <div>
                                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-4 text-sm">
                                        <strong>Retrieved At:</strong> {new Date(historicalCoveragePreview.retrievedAt).toLocaleString()}
                                        <br /><br />
                                        Please review the fully calculated baseline coverage below. Confirming will permanently save this snapshot to the course.
                                    </div>
                                    
                                    <div className="overflow-x-auto max-h-[50vh] border rounded-lg shadow-sm">
                                        <Table headers={['Level / Name', 'Total Functioning PHCs', 'PHCs w/ IMNCI (Before)', 'Coverage Before', 'New PHCs w/ IMNCI', 'Coverage After', 'Increase']}>
                                            {historicalCoveragePreview.localityCoverage.map(l => (
                                                <tr key={`prev-loc-${l.name}`} className="hover:bg-gray-50">
                                                    <td className="p-2 border font-semibold text-gray-700 min-w-[120px]">Locality: {l.name}</td>
                                                    <td className="p-2 border text-center">{l.totalPhc}</td>
                                                    <td className="p-2 border text-center">{l.phcWithImnciBefore}</td>
                                                    <td className="p-2 border text-center font-semibold text-gray-600">{fmtPct(l.covBefore)}</td>
                                                    <td className="p-2 border text-center">{l.newPhc}</td>
                                                    <td className="p-2 border text-center font-bold text-sky-700">{fmtPct(l.covAfter)}</td>
                                                    <td className="p-2 border text-center font-bold text-green-600 min-w-[80px]">+{l.increase.toFixed(2)}%</td>
                                                </tr>
                                            ))}
                                            {historicalCoveragePreview.stateCoverage.map(s => (
                                                <tr key={`prev-state-${s.name}`} className="hover:bg-gray-50 bg-gray-50/50">
                                                    <td className="p-2 border font-semibold text-gray-800 min-w-[120px]">State: {s.name}</td>
                                                    <td className="p-2 border text-center">{s.totalPhc}</td>
                                                    <td className="p-2 border text-center">{s.phcWithImnciBefore}</td>
                                                    <td className="p-2 border text-center font-semibold text-gray-600">{fmtPct(s.covBefore)}</td>
                                                    <td className="p-2 border text-center">{s.newPhc}</td>
                                                    <td className="p-2 border text-center font-bold text-sky-700">{fmtPct(s.covAfter)}</td>
                                                    <td className="p-2 border text-center font-bold text-green-600 min-w-[80px]">+{s.increase.toFixed(2)}%</td>
                                                </tr>
                                            ))}
                                            <tr className="hover:bg-gray-50 bg-sky-50">
                                                <td className="p-2 border font-bold text-gray-900 min-w-[150px]">National (Sudan Overall)</td>
                                                <td className="p-2 border text-center font-bold">{historicalCoveragePreview.nationalCov.totalPhc}</td>
                                                <td className="p-2 border text-center font-bold">{historicalCoveragePreview.nationalCov.phcWithImnciBefore}</td>
                                                <td className="p-2 border text-center font-bold text-gray-700">{fmtPct(historicalCoveragePreview.nationalCov.covBefore)}</td>
                                                <td className="p-2 border text-center font-bold">{historicalCoveragePreview.nationalCov.newPhc}</td>
                                                <td className="p-2 border text-center font-bold text-sky-800">{fmtPct(historicalCoveragePreview.nationalCov.covAfter)}</td>
                                                <td className="p-2 border text-center font-bold text-green-700 min-w-[80px]">+{historicalCoveragePreview.nationalCov.increase.toFixed(4)}%</td>
                                            </tr>
                                        </Table>
                                    </div>
                                    
                                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t w-full">
                                        <Button variant="secondary" onClick={() => setIsCoverageModalOpen(false)} disabled={isSavingCoverage} className="w-full sm:w-auto">Cancel</Button>
                                        <Button onClick={handleConfirmCoverage} disabled={isSavingCoverage} className="w-full sm:w-auto">
                                            {isSavingCoverage ? <Spinner size="sm" /> : "Confirm & Save"}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-4 text-red-500">Failed to load preview.</div>
                            )}
                        </div>
                    </Modal>

                </>
            )}
        </div>
    );
}