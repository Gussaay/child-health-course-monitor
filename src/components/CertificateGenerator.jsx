import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from "jspdf";
import { QRCodeCanvas } from 'qrcode.react';

// Common Components & Icons
import { 
    Button, Card, EmptyState, PageHeader, 
    Spinner, Table, Modal, CardBody, CardFooter, FormGroup, Select, Input
} from './CommonComponents'; 
import { Award, FileSignature, Stamp, Upload, Lock, XCircle, CheckCircle, RefreshCw } from 'lucide-react'; 

// Data & Firebase
import { STATE_LOCALITIES } from './constants'; 
import { db } from '../firebase'; 
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useDataCache } from '../DataContext';
import { 
    getParticipantById, 
    getCourseById, 
    listAllParticipantsForCourse, 
    listFederalCoordinators, 
    unapproveCourseCertificates, 
    uploadFile 
} from '../data.js';

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

const getArabicMonthName = (monthIndex) => {
    const months = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];
    return months[monthIndex];
};

const getEnglishMonthName = (monthIndex) => {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return months[monthIndex];
};

const getDayWithSuffix = (day) => {
    let suffix;
    if (day > 3 && day < 21) suffix = 'th';
    else {
        switch (day % 10) {
            case 1: suffix = 'st'; break;
            case 2: suffix = 'nd'; break;
            case 3: suffix = 'rd'; break;
            default: suffix = 'th';
        }
    }
    return `${day}<sup style="font-size: 0.6em; line-height: 0;">${suffix}</sup>`;
};

const getCertificateCourseTitle = (courseType, language = 'en') => {
    const normalizedType = courseType ? courseType.trim() : '';
    if (language === 'ar') {
        switch (normalizedType) {
            case 'ICCM': return 'العلاج المتكامل للأطفال أقل من 5 سنوات في المجتمع';
            case 'IMNCI': return 'العلاج المتكامل للاطفال اقل من 5 سنوات (IMNCI)';
            case 'ETAT': return 'الفرز والتقييم والعلاج للاطفال اقل من 5 سنوات (ETAT)';
            case 'EENC': return 'الرعاية الضرورية المبكرة لحديثي الولادة (EENC)';
            case 'IPC': return 'مكافحة العدوى (وحدة حديثي الولادة)';
            case 'Small & Sick Newborn': return 'رعاية الاطفال حديثي الولادة المرضى والصغار';
            case 'Program Management': return 'إدارة برنامج صحة الطفل';
            default: return normalizedType;
        }
    }
    switch (normalizedType) {
        case 'IMNCI': return 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)';
        case 'ICCM': return 'Integrated Community case management for under 5 children (iCCM)';
        case 'ETAT': return 'Emergency Triage, Assessment & Treatment (ETAT)';
        case 'EENC': return 'Early Essential Newborn Care (EENC)';
        case 'IPC': return 'Infection Prevention & Control (Neonatal Unit)';
        case 'Small & Sick Newborn': return 'Small & Sick Newborn Case Management';
        case 'Program Management': return 'Program Management';
        default: return normalizedType;
    }
};

const getSmallAndSickSubCourseArabic = (subCourse) => {
    if (!subCourse) return '';
    const normalized = subCourse.trim();
    switch (normalized) {
        case 'Portable warmer training': return 'التدريب على المدفأة المحمولة';
        case 'CPAP training': return 'التدريب على جهاز CPAP';
        case 'Kangaroo Mother Care': return 'رعاية الأم الكنغر (KMC)';
        case 'Module (1) Emergency and Essential Newborn Care': return 'الوحدة (1) الطوارئ والرعاية الأساسية لحديثي الولادة';
        case 'Module (2) Special Newborn Care': return 'الوحدة (2) رعاية حديثي الولادة الخاصة';
        case 'Module (3) Intensive Newborn Care': return 'الوحدة (3) العناية المكثفة لحديثي الولادة';
        default: return subCourse; 
    }
};

const fetchArabicNameHelper = async (cachedList, collectionName, englishName, fieldName) => {
    if (!englishName) return null;
    const searchName = englishName.trim().toLowerCase();

    if (cachedList && cachedList.length > 0) {
        const match = cachedList.find(item => {
            const itemName = (item.name || '').trim().toLowerCase();
            return itemName === searchName || itemName.replace(/^dr\.?\s*/i, '').trim() === searchName.replace(/^dr\.?\s*/i, '').trim();
        });
        if (match && match[fieldName]) return match[fieldName];
    }

    const cleanSearchName = englishName.trim();
    try {
        let q = query(collection(db, collectionName), where("name", "==", cleanSearchName));
        let snapshot = await getDocs(q);

        if (snapshot.empty && cleanSearchName.includes("Dr.")) {
            const cleanName = cleanSearchName.replace(/^Dr\.?\s*/i, '').trim();
            q = query(collection(db, collectionName), where("name", "==", cleanName));
            snapshot = await getDocs(q);
        }

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            const arName = data[fieldName]; 
            if (arName) return arName;
        }
    } catch (error) {
        console.error(`Error fetching Arabic name from ${collectionName}:`, error);
    }
    return null;
};

// Helper to convert URL to Base64 to bypass CORS/Loading issues in html2canvas
const imageUrlToBase64 = async (url) => {
    if (!url) return null;
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting image to base64:", error);
        return null; 
    }
};

// -----------------------------------------------------------------------------
// COMPONENT: CertificateTemplate
// -----------------------------------------------------------------------------

const CertificateTemplate = React.memo(function CertificateTemplate({ 
    course, 
    participant, 
    federalProgramManagerName, 
    participantSubCourse,
    language = 'en',
    directorNameAr,      
    programManagerNameAr,
    programManagerSignatureUrl,
    directorName,          
    directorSignatureUrl,  
    programStampUrl,
    isTemplate = false 
}) {
    const isArabic = language === 'ar';
    const courseType = course.course_type ? course.course_type.trim() : '';
    const courseTitle = getCertificateCourseTitle(courseType, language);
    
    // Logic to determine what to display for the sub-course
    let displaySubCourse = participantSubCourse;
    
   if (participantSubCourse) {
        if (isArabic) {
            // Arabic Translation Logic
            if (courseType === 'ICCM') {
                displaySubCourse = "تدريب العامل الصحي المجتمعي";
            } else if (courseType === 'IMNCI') {
                displaySubCourse = "المعالجة القياسية للاطفال اقل من 5 سنوات";
            } else if (courseType === 'Small & Sick Newborn') {
                displaySubCourse = getSmallAndSickSubCourseArabic(participantSubCourse);
            } else if (courseType === 'Program Management') {
                if (participantSubCourse.includes('IMNCI implementation operational Guide')) {
                    displaySubCourse = "دورة تدريب المدريبين على الدليل التشغيلي لتطبيق العلاج المتكامل في مؤسسات الرعاية الصحية الأساسية";
                } else if (participantSubCourse.includes('planning, Monitoring and evaluation')) {
                    displaySubCourse = "التخطيط والمتابعة والتقييم";
                }
            }
        }
    }

    let stateDisplay = course.state || '';
    // Handle multiple states gracefully if they exist from the enhanced CourseForm
    if (isArabic) {
        if (course.states && Array.isArray(course.states)) {
            stateDisplay = course.states.map(s => STATE_LOCALITIES[s] ? STATE_LOCALITIES[s].ar : s).join('، ');
        } else if (STATE_LOCALITIES[course.state]) {
            stateDisplay = STATE_LOCALITIES[course.state].ar;
        }
    } else {
        // For English certificates, ensure states are separated by commas
        if (course.states && Array.isArray(course.states)) {
            stateDisplay = course.states.join(', ');
        }
    }

    // Use English hall name if language is English and the field exists, otherwise fallback to Arabic hall
    const hallDisplay = (!isArabic && course.hall_english) ? course.hall_english : (course.hall || '');
    
    // Combine state(s) and hall, avoiding trailing hyphens if hall is missing
    const location = hallDisplay ? `${stateDisplay} - ${hallDisplay}` : stateDisplay;

    let courseDate = '';
    const courseDuration = course.course_duration;
    
    if (courseDuration && course.start_date) {
        const [startYear, startMonth, startDay] = course.start_date.split('-').map(Number);
        const startDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
        const endDateObj = new Date(startDateObj);
        endDateObj.setUTCDate(startDateObj.getUTCDate() + (courseDuration - 1));
        
        const startDayOfMonth = startDateObj.getUTCDate();
        const startMonthIndex = startDateObj.getUTCMonth();
        const startYearNum = startDateObj.getUTCFullYear();
        const endDayOfMonth = endDateObj.getUTCDate();
        const endMonthIndex = endDateObj.getUTCMonth();
        const endYearNum = endDateObj.getUTCFullYear();

        if (isArabic) {
            const startMonthName = getArabicMonthName(startMonthIndex);
            const endMonthName = getArabicMonthName(endMonthIndex);
            if (startMonthIndex === endMonthIndex) {
                courseDate = `${startDayOfMonth} - ${endDayOfMonth} ${startMonthName} ${startYearNum}`;
            } else {
                courseDate = `${startDayOfMonth} ${startMonthName} - ${endDayOfMonth} ${endMonthName} ${endYearNum}`;
            }
        } else {
            const startMonthName = getEnglishMonthName(startMonthIndex);
            const endMonthName = getEnglishMonthName(endMonthIndex);
            const startDayHtml = getDayWithSuffix(startDayOfMonth);
            const endDayHtml = getDayWithSuffix(endDayOfMonth);

            if (startMonthIndex === endMonthIndex) {
                courseDate = `${startDayHtml} - ${endDayHtml} ${startMonthName} ${startYearNum}`;
            } else {
                courseDate = `${startDayHtml} ${startMonthName} - ${endDayHtml} ${endMonthName} ${endYearNum}`;
            }
        }
    } else {
        courseDate = course.start_date ? course.start_date.split('-').reverse().join('/') : 'N/A';
    }
    
    const verificationUrl = isTemplate ? '' : `${window.location.origin}/verify/certificate/${participant?.id}`;

    const containerStyle = { 
        width: '297mm', 
        height: '210mm', 
        boxSizing: 'border-box', 
        fontFamily: isArabic ? 'Arial, sans-serif' : 'Times New Roman, serif', 
        color: 'black', 
        backgroundColor: 'white', 
        position: 'relative',
        direction: isArabic ? 'rtl' : 'ltr'
    };

    const qrContainerStyle = {
        position: 'absolute',
        top: '60mm',
        width: '45mm',
        height: 'auto',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',     
        justifyContent: 'center', 
        left: isArabic ? '15mm' : 'auto',
        right: isArabic ? 'auto' : '15mm',
    };

    const finalDirectorName = directorName || course.director;

    return (
        <div id="certificate-template" style={containerStyle}>
            <img 
                src="/certificate/border.jpg" 
                alt="Certificate Border" 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
            />
            
            {/* Logos */}
            <div style={{ 
                position: 'absolute', 
                top: '25mm', 
                [isArabic ? 'right' : 'left']: '25mm', 
                zIndex: 1, 
                textAlign: 'center', 
                display: 'flex', 
                flexDirection: 'row', 
                gap: '15px',
                alignItems: 'center'
            }}>
                <img src="/certificate/fmoh-logo.jpg" alt="FMOH" style={{ height: '30mm', width: 'auto' }} />
                <img src="/certificate/ch-logo.png" alt="NCHP" style={{ height: '35mm', width: 'auto' }} />
            </div>
            
            <div style={{ 
                position: 'absolute', 
                top: '25mm', 
                [isArabic ? 'left' : 'right']: '25mm', 
                zIndex: 1, 
                display: 'flex', 
                flexDirection: 'row', 
                gap: '15px',
                alignItems: 'center'
            }}>
                 <img src="/certificate/who-logo.png" alt="WHO" style={{ height: '30mm', width: 'auto' }} />
                 <img src="/certificate/unicef-logo.png" alt="UNICEF" style={{ height: '30mm', width: 'auto' }} />
            </div>

            {/* Header */}
            <div style={{
                position: 'absolute',
                top: '14mm', 
                left: '0mm',
                right: '0mm',
                textAlign: 'center',
                fontSize: isArabic ? '22px' : '24px',
                fontWeight: 'bold',
                lineHeight: '1.5',
                zIndex: 2
            }}>
                {isArabic ? (
                    <>
                        جمهورية السودان<br />
                        وزارة الصحة الاتحادية<br />
                        الإدارة العامة للرعاية الصحية الاساسية<br />
                        إدارة صحة الأم والطفل<br />
                        البرنامج القومي لصحة الطفل
                    </>
                ) : (
                    <>
                        Republic of Sudan<br />
                        Federal Ministry of Health<br />
                        Directorate General of PHC<br />
                        Maternal and Child Health Directorate<br />
                        National Child Health Program
                    </>
                )}
            </div>

            {/* Certificate Word */}
             <div style={{
                position: 'absolute',
                top: '60mm',
                left: '0',
                right: '0',
                textAlign: 'center',
                fontSize: '60px',
                fontWeight: 'bold',
                textDecoration: 'underline',
                color: 'red',
                zIndex: 2,
                fontFamily: isArabic ? 'Arial, sans-serif' : 'Times New Roman, serif'
            }}>
                {isArabic ? 'شهادة' : 'CERTIFICATE'}
            </div>

            {/* Participant Name */}
            <div style={{
                position: 'absolute',
                top: isArabic ? '90mm' : '90mm',
                left: '30mm',
                right: '30mm',
                textAlign: 'center',
                fontSize: '35px',
                fontWeight: 'bold',
                zIndex: 2,
                borderBottom: '3px dotted #000', 
                paddingBottom: '10px',
                minHeight: '40px'
            }}>
                {!isTemplate && (isArabic ? `${participant.name}` : `${participant.name}`)}
            </div>

            {/* Completion Text */}
            <div style={{
                position: 'absolute',
                top: isArabic ? '108mm' : '108mm', 
                left: '50mm',
                right: '50mm',
                textAlign: 'center',
                fontSize: '22px', 
                fontStyle: isArabic ? 'normal' : 'italic',
                zIndex: 2
            }}>
                {isArabic ? 'أكمل/ت بنجاح الدورة التدريبية على : ' : 'Has successfully completed:'}
            </div>

            {/* Course Title */}
            <div style={{
                position: 'absolute',
                top: '120mm', 
                left: '10mm',
                right: '10mm',
                textAlign: 'center',
                fontSize: '28px', 
                fontWeight: 'bold',
                color: 'red',
                zIndex: 2,
                lineHeight: '1.3' 
            }}>
                {courseTitle}
            </div>
            
            {/* Sub Course - Explicitly Centered and Positioned */}
            {(displaySubCourse) && (
                <div style={{
                    position: 'absolute',
                    top: '135mm', 
                    left: '0',
                    right: '0',
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '20px',
                    fontWeight: 'normal',
                    color: 'black',
                    zIndex: 2
                }}>
                   ({displaySubCourse})
                </div>
            )}

            {/* Location & Date */}
            <div style={{
                position: 'absolute',
                top: '148mm', 
                left: '0',
                right: '0',
                width: '100%',
                textAlign: 'center', 
                zIndex: 2
            }}>
                <div style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    display: 'inline-block', 
                    marginRight: isArabic ? '0' : '20px',
                    marginLeft: isArabic ? '20px' : '0'
                }}>
                    <span style={{ color: 'red' }}>{isArabic ? 'المكان : ' : 'Place : '}</span> {location}
                </div>

                <div style={{
                    marginTop: '3mm', 
                    fontSize: '24px',
                    fontWeight: 'bold',
                    display: 'block', 
                }}>
                    <span style={{ color: 'red' }}>{isArabic ? 'التاريخ : ' : 'Date : '}</span> 
                    <span dangerouslySetInnerHTML={{ __html: courseDate }}></span>
                </div>
            </div>

            {/* QR Code Section */}
            {!isTemplate && (
                <div style={qrContainerStyle}>
                    <div style={{
                        marginBottom: '8px',
                        lineHeight: '1.5',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        fontFamily: isArabic ? 'Arial, sans-serif' : 'sans-serif',
                    }}>
                        {isArabic ? 'أمسح وتحقق' : 'Scan & Verify'}
                    </div>
                    <div style={{ display: 'block' }}>
                        <QRCodeCanvas
                            value={verificationUrl}
                            size={87} 
                            bgColor={"#ffffff"}
                            fgColor={"#000000"}
                            level={"L"} 
                            includeMargin={false}
                        />
                    </div>
                </div>
            )}

            {/* Signatures & Stamp Section */}
            
            {/* PROGRAM STAMP */}
            {programStampUrl && (
                <div style={{
                    position: 'absolute',
                    top: '162mm', 
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1, 
                    opacity: 0.9,
                    pointerEvents: 'none'
                }}>
                    <img 
                        src={programStampUrl} 
                        alt="Program Stamp" 
                        crossOrigin="anonymous" 
                        style={{ 
                            width: '40mm', 
                            height: 'auto',
                            maxHeight: '40mm' 
                        }} 
                    />
                </div>
            )}

            {/* RIGHT SIDE SIGNATURE */}
            <div style={{
                position: 'absolute',
                top: '175mm', 
                right: '5mm',
                width: '90mm', 
                textAlign: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                zIndex: 2
            }}>
               {isArabic ? (
                   // ARABIC RIGHT: PROGRAM MANAGER
                   <div style={{ position: 'relative' }}>
                       {programManagerSignatureUrl && (
                           <img 
                               src={programManagerSignatureUrl} 
                               alt="Signature" 
                               crossOrigin="anonymous" 
                               style={{ 
                                   display: 'block', margin: '0 auto', maxHeight: '20mm', maxWidth: '30mm',
                                   position: 'absolute', bottom: '12mm', left: '50%', transform: 'translateX(-50%)', 
                                   zIndex: 1 
                               }} 
                           />
                       )}
                       <div style={{ marginBottom: '1mm', position: 'relative', zIndex: 2 }}>د. {programManagerNameAr || federalProgramManagerName || '...'}</div>
                       <div>مدير البرنامج</div>
                   </div>
               ) : (
                   // ENGLISH RIGHT: COURSE DIRECTOR
                   <div style={{ position: 'relative' }}>
                        {directorSignatureUrl && (
                           <img 
                               src={directorSignatureUrl} 
                               alt="Signature" 
                               crossOrigin="anonymous" 
                               style={{ 
                                   display: 'block', margin: '0 auto', maxHeight: '20mm', maxWidth: '30mm',
                                   position: 'absolute', bottom: '12mm', left: '50%', transform: 'translateX(-50%)', 
                                   zIndex: 1 
                               }} 
                           />
                       )}
                       <div style={{ marginBottom: '1mm', position: 'relative', zIndex: 2 }}>Dr. {finalDirectorName}</div>
                       <div>Course Director</div>
                   </div>
               )}
            </div>

            {/* LEFT SIDE SIGNATURE */}
            <div style={{
                position: 'absolute',
                top: '175mm', 
                left: '5mm', 
                width: '90mm', 
                textAlign: 'center',
                fontSize: '20px', 
                fontWeight: 'bold',
                zIndex: 2
            }}>
                {isArabic ? (
                   // ARABIC LEFT: COURSE DIRECTOR
                   <div style={{ position: 'relative' }}>
                       {directorSignatureUrl && (
                           <img 
                               src={directorSignatureUrl} 
                               alt="Signature" 
                               crossOrigin="anonymous" 
                               style={{ 
                                   display: 'block', margin: '0 auto', maxHeight: '20mm', maxWidth: '30mm',
                                   position: 'absolute', bottom: '12mm', left: '50%', transform: 'translateX(-50%)', 
                                   zIndex: 1 
                               }} 
                           />
                       )}
                       {/* Ensure "Dr." is displayed correctly. If directorNameAr is missing, fallback to English name */}
                       <div style={{ marginBottom: '1mm', position: 'relative', zIndex: 2 }}>
                           {directorNameAr ? `د. ${directorNameAr}` : `د. ${finalDirectorName || '...'}`}
                       </div>
                       <div>مدير الدورة</div>
                   </div>
               ) : (
                   // ENGLISH LEFT: PROGRAM MANAGER
                   <div style={{ position: 'relative' }}>
                       {programManagerSignatureUrl && (
                           <img 
                               src={programManagerSignatureUrl} 
                               alt="Signature" 
                               crossOrigin="anonymous" 
                               style={{ 
                                   display: 'block', margin: '0 auto', maxHeight: '20mm', maxWidth: '30mm',
                                   position: 'absolute', bottom: '12mm', left: '50%', transform: 'translateX(-50%)', 
                                   zIndex: 1 
                               }} 
                           />
                       )}
                       <div style={{ marginBottom: '1mm', position: 'relative', zIndex: 2 }}>Dr. {federalProgramManagerName || 'Federal Program Manager'}</div>
                       <div>National Program Manager</div>
                   </div>
               )}
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
// GENERATION FUNCTIONS
// -----------------------------------------------------------------------------

export const generateCertificatePdf = async (course, participant, federalProgramManagerName, participantSubCourse, language = 'en', cachedFacilitators = null, cachedCoordinators = null) => {
    
    // --- Logic to prioritize the approved name & signature ---
    // Ensure names are trimmed to match database records effectively
    const finalManagerName = (course.approvedByManagerName || federalProgramManagerName || '').trim();
    const rawManagerSignature = course.approvedByManagerSignatureUrl || null;

    // --- New Fields ---
    const finalDirectorName = (course.approvedDirectorName || course.director || '').trim();
    const rawDirectorSignature = course.approvedDirectorSignatureUrl || null;
    const rawProgramStamp = course.approvedProgramStampUrl || null;

    // --- CONVERT IMAGES TO BASE64 (Fixes CORS/Loading issues) ---
    const finalManagerSignature = await imageUrlToBase64(rawManagerSignature);
    const finalDirectorSignature = await imageUrlToBase64(rawDirectorSignature);
    const finalProgramStamp = await imageUrlToBase64(rawProgramStamp);

    let directorNameAr = null;
    let programManagerNameAr = null;

    if (language === 'ar') {
        // Fetch Arabic names from the collections
        directorNameAr = await fetchArabicNameHelper(cachedFacilitators, 'facilitators', finalDirectorName, 'arabicName');
        programManagerNameAr = await fetchArabicNameHelper(cachedCoordinators, 'federalCoordinators', finalManagerName, 'nameAr');
    }

    try {
        await new Promise((resolve, reject) => {
            const img = new Image();
            img.src = '/certificate/border.jpg';
            img.onload = resolve;
            img.onerror = () => reject(new Error("Failed to load certificate background image."));
        });
    } catch (error) {
        console.error(error);
        alert(error.message);
        return null;
    }

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px'; 
    container.style.top = '0';
    container.style.zIndex = '-1'; 
    document.body.appendChild(container);

    const root = createRoot(container);
    
    let canvas = null;
    try {
        // Render with new props
        root.render(
            <CertificateTemplate 
                course={course} 
                participant={participant} 
                federalProgramManagerName={finalManagerName} 
                participantSubCourse={participantSubCourse} 
                language={language}
                directorNameAr={directorNameAr}       
                programManagerNameAr={programManagerNameAr} 
                programManagerSignatureUrl={finalManagerSignature} 
                directorName={finalDirectorName}
                directorSignatureUrl={finalDirectorSignature}
                programStampUrl={finalProgramStamp}
            />
        );

        // Wait slightly longer to ensure rendering
        await new Promise(resolve => setTimeout(resolve, 1000)); 

        const element = container.querySelector('#certificate-template');
        if (!element) throw new Error("Certificate template element not found.");

        canvas = await html2canvas(element, { 
            scale: 2, 
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff' 
        });
        
        return canvas;

    } catch (error) {
        console.error("Error generating certificate:", error);
        alert(`Could not generate certificate for ${participant.name}. See console for details.`);
        return null;
    } finally {
        if (container.parentNode === document.body) {
             root.unmount();
             document.body.removeChild(container);
        }
    }
};

export const generateBlankCertificatePdf = async (course, federalProgramManagerName, language = 'en', cachedFacilitators = null, cachedCoordinators = null) => {
    // --- Logic to prioritize the approved name & signature ---
    const finalManagerName = (course.approvedByManagerName || federalProgramManagerName || '').trim();
    const rawManagerSignature = course.approvedByManagerSignatureUrl || null;

    // --- New Fields ---
    const finalDirectorName = (course.approvedDirectorName || course.director || '').trim();
    const rawDirectorSignature = course.approvedDirectorSignatureUrl || null;
    const rawProgramStamp = course.approvedProgramStampUrl || null;

    // --- CONVERT IMAGES TO BASE64 ---
    const finalManagerSignature = await imageUrlToBase64(rawManagerSignature);
    const finalDirectorSignature = await imageUrlToBase64(rawDirectorSignature);
    const finalProgramStamp = await imageUrlToBase64(rawProgramStamp);

    let directorNameAr = null;
    let programManagerNameAr = null;

    if (language === 'ar') {
        directorNameAr = await fetchArabicNameHelper(cachedFacilitators, 'facilitators', finalDirectorName, 'arabicName');
        programManagerNameAr = await fetchArabicNameHelper(cachedCoordinators, 'federalCoordinators', finalManagerName, 'nameAr');
    }

    try {
        await new Promise((resolve, reject) => {
            const img = new Image();
            img.src = '/certificate/border.jpg';
            img.onload = resolve;
            img.onerror = () => reject(new Error("Failed to load certificate background image."));
        });
    } catch (error) {
        console.error(error);
        alert(error.message);
        return null;
    }

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px'; 
    container.style.top = '0';
    container.style.zIndex = '-1'; 
    document.body.appendChild(container);

    const root = createRoot(container);
    
    let canvas = null;
    try {
        // Mock participant for structure
        const dummyParticipant = { name: '', id: 'template' };

        let sampleSubCourse = null;
        if (course.facilitatorAssignments && course.facilitatorAssignments.length > 0) {
            const assignment = course.facilitatorAssignments.find(a => a.imci_sub_type);
            if (assignment) {
                sampleSubCourse = assignment.imci_sub_type;
            }
        }
        
        // Fallback for visual confirmation in template if no assignment found
        if (!sampleSubCourse && course.course_type === 'Small & Sick Newborn') {
            sampleSubCourse = "Module (1) Emergency and Essential Newborn Care";
        }

        root.render(
            <CertificateTemplate 
                course={course} 
                participant={dummyParticipant} 
                federalProgramManagerName={finalManagerName} 
                participantSubCourse={sampleSubCourse}
                language={language}
                directorNameAr={directorNameAr}       
                programManagerNameAr={programManagerNameAr} 
                programManagerSignatureUrl={finalManagerSignature} 
                directorName={finalDirectorName}
                directorSignatureUrl={finalDirectorSignature}
                programStampUrl={finalProgramStamp}
                isTemplate={true} 
            />
        );

        await new Promise(resolve => setTimeout(resolve, 1000)); 

        const element = container.querySelector('#certificate-template');
        if (!element) throw new Error("Certificate template element not found.");

        canvas = await html2canvas(element, { 
            scale: 2, 
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff' 
        });
        
        return canvas;

    } catch (error) {
        console.error("Error generating certificate template:", error);
        alert("Could not generate certificate template.");
        return null;
    } finally {
        if (container.parentNode === document.body) {
             root.unmount();
             document.body.removeChild(container);
        }
    }
};

export const generateAllCertificatesPdf = async (course, participants, federalProgramManagerName, language = 'en', onProgress = null, cachedFacilitators = null, cachedCoordinators = null) => {
    if (!participants || participants.length === 0) {
        alert("No participants found to generate certificates.");
        return;
    }

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const imgWidth = 297; 
    const imgHeight = 210; 
    let firstPage = true;

    for (let i = 0; i < participants.length; i++) {
        // Report progress
        if (onProgress) {
            onProgress(i + 1, participants.length);
            // Allow UI to update
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const participant = participants[i];
        
        let participantSubCourse = participant.imci_sub_type;
        if (!participantSubCourse) {
             const participantAssignment = course.facilitatorAssignments?.find(
                (a) => a.group === participant.group
            );
            participantSubCourse = participantAssignment?.imci_sub_type;
        }

        const canvas = await generateCertificatePdf(
            course, 
            participant, 
            federalProgramManagerName, 
            participantSubCourse,
            language,
            cachedFacilitators,
            cachedCoordinators
        );

        if (canvas) {
            if (!firstPage) {
                doc.addPage();
            }
            firstPage = false;
            
            const imgData = canvas.toDataURL('image/jpeg', 1); // 100% quality JPEG
            doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
        }
    }

    if (!firstPage) {
        const langSuffix = language === 'ar' ? 'AR' : 'EN';
        const fileName = `All_Certificates_${langSuffix}_${course.course_type}_${course.start_date}.pdf`;
        doc.save(fileName);
    } else {
        alert("Failed to generate any certificates.");
    }
};

// ============================================================================
// PUBLIC & ADMIN CERTIFICATE VIEWS (Migrated from Course.jsx)
// ============================================================================

export function CertificateVerificationView({ participant, course }) {
    if (!participant || !course) return <EmptyState message="Invalid certificate data." />;
    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg text-center border border-gray-100">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6 shadow-inner">
                <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Certificate Verified</h2>
            <p className="text-gray-600 mb-4 font-medium">This certificate was authentically issued to:</p>
            <h3 className="text-2xl font-black text-sky-700 mb-2">{participant.name}</h3>
            <p className="text-sm text-gray-500 mb-6 font-semibold uppercase tracking-wider">For completing: {course.course_type}</p>
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-left text-sm text-gray-700 space-y-2">
                <p className="flex justify-between border-b border-gray-200 pb-2"><strong className="text-gray-500 uppercase tracking-wide text-xs">Course Location:</strong> <span className="font-bold">{course.state} - {course.locality}</span></p>
                <p className="flex justify-between"><strong className="text-gray-500 uppercase tracking-wide text-xs">Date:</strong> <span className="font-bold">{course.start_date}</span></p>
            </div>
        </div>
    );
}

export function PublicCertificateDownloadView({ participantId }) {
    const { facilitators, federalCoordinators, fetchFacilitators, fetchFederalCoordinators } = useDataCache();
    useEffect(() => { fetchFacilitators(); fetchFederalCoordinators(); }, []);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const p = await getParticipantById(participantId, 'server');
                if (!p) throw new Error("Participant not found.");
                const c = await getCourseById(p.courseId, 'server');
                if (!c) throw new Error("Course not found.");
                if (!c.isCertificateApproved) throw new Error("Certificates for this course are not yet approved or have been revoked.");
                setData({ participant: p, course: c });
            } catch(e) { setError(e.message); }
            finally { setLoading(false); }
        };
        load();
    }, [participantId]);

    const handleDownload = async (lang) => {
        setDownloading(true);
        try {
            const managerName = data.course.approvedByManagerName || "Federal Program Manager";
            let subcourse = data.participant.imci_sub_type || data.course.director_imci_sub_type;
            const canvas = await generateCertificatePdf(data.course, data.participant, managerName, subcourse, lang, facilitators, federalCoordinators);
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 297, 210);
                doc.save(`Certificate_${data.participant.name.replace(/\s+/g, '_')}_${lang}.pdf`);
            }
        } catch(e) { alert("Download failed: " + e.message); }
        finally { setDownloading(false); }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;

    return (
        <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-2xl shadow-xl text-center border border-gray-100">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-sky-100 mb-6 shadow-inner">
                <Award className="h-10 w-10 text-sky-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Download Certificate</h2>
            <p className="text-gray-500 mb-6 text-sm">Participant:</p>
            <h3 className="text-xl font-bold text-sky-700 mb-8">{data.participant.name}</h3>
            <div className="flex flex-col gap-3">
                <Button onClick={() => handleDownload('en')} disabled={downloading} className="w-full justify-center shadow-md">
                    {downloading ? <Spinner size="sm" /> : 'Download (English)'}
                </Button>
                <Button onClick={() => handleDownload('ar')} disabled={downloading} variant="secondary" className="w-full justify-center">
                    {downloading ? <Spinner size="sm" /> : 'Download (Arabic - عربي)'}
                </Button>
            </div>
        </div>
    );
}

export function PublicCourseCertificatesView({ courseId }) {
    const { facilitators, federalCoordinators, fetchFacilitators, fetchFederalCoordinators } = useDataCache();
    useEffect(() => { fetchFacilitators(); fetchFederalCoordinators(); }, []);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const c = await getCourseById(courseId, 'server');
                if (!c) throw new Error("Course not found.");
                if (!c.isCertificateApproved) throw new Error("Certificates for this course are not yet approved or have been revoked.");
                const parts = await listAllParticipantsForCourse(courseId, { source: 'server' });
                const activeParts = parts.filter(p => !p.isDeleted);
                setData({ course: c, participants: activeParts });
            } catch(e) { setError(e.message); }
            finally { setLoading(false); }
        };
        load();
    }, [courseId]);

    const handleDownload = async (p, lang) => {
        setDownloadingId(p.id);
        try {
            const managerName = data.course.approvedByManagerName || "Federal Program Manager";
            let subcourse = p.imci_sub_type || data.course.director_imci_sub_type;
            const canvas = await generateCertificatePdf(data.course, p, managerName, subcourse, lang, facilitators, federalCoordinators);
            if (canvas) {
                const doc = new jsPDF('landscape', 'mm', 'a4');
                doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 297, 210);
                doc.save(`Certificate_${p.name.replace(/\s+/g, '_')}_${lang}.pdf`);
            }
        } catch(e) { alert("Download failed: " + e.message); }
        finally { setDownloadingId(null); }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;

    return (
        <Card className="p-6">
            <PageHeader title="Course Certificates" subtitle={`${data.course.course_type} - ${data.course.state} / ${data.course.locality}`} />
            
            <div className="bg-sky-50 text-sky-800 p-4 rounded-lg text-sm border border-sky-100 mb-6 flex items-start">
                <Award className="w-5 h-5 mr-3 shrink-0" />
                <p>Welcome. You can download certificates for any active participant from this course using the buttons below.</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <Table headers={["Participant Name", "Job Title", "Download Action"]}>
                    {data.participants.map(p => (
                        <tr key={p.id} className="hover:bg-sky-50/50 transition-colors">
                            <td className="p-4 font-bold text-gray-800">{p.name}</td>
                            <td className="p-4 text-gray-600 font-medium">{p.job_title}</td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <Button size="sm" onClick={() => handleDownload(p, 'en')} disabled={!!downloadingId}>
                                    {downloadingId === p.id ? <Spinner size="sm" /> : 'English'}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => handleDownload(p, 'ar')} disabled={!!downloadingId}>
                                    {downloadingId === p.id ? <Spinner size="sm" /> : 'عربي'}
                                </Button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// SEPARATED CERTIFICATE APPROVALS VIEW
// -----------------------------------------------------------------------------
export const CertificateApprovalsView = ({ allCourses, setToast, currentUserRole, canUseFederalManagerAdvancedFeatures }) => {
    const { fetchCourses } = useDataCache(); 
    const [managerName, setManagerName] = React.useState('');
    const [loadingApprovals, setLoadingApprovals] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const fileInputRef = React.useRef(null);
    const [uploadContext, setUploadContext] = React.useState({ course: null, assetType: null });
    const [courseToApprove, setCourseToApprove] = React.useState(null);

    const [filterState, setFilterState] = React.useState('All');
    const [filterLocality, setFilterLocality] = React.useState('All');
    const [filterCourseType, setFilterCourseType] = React.useState('All');
    const [filterStatus, setFilterStatus] = React.useState('All');

    const isFederalProgramManager = currentUserRole === 'federal_manager' || currentUserRole === 'super_user';

    const states = React.useMemo(() => ['All', ...new Set(allCourses.map(c => c.state).filter(Boolean))].sort(), [allCourses]);
    const localities = React.useMemo(() => {
        const locs = new Set();
        allCourses.forEach(c => {
            if (filterState === 'All' || c.state === filterState) if (c.locality) locs.add(c.locality);
        });
        return ['All', ...Array.from(locs).sort()];
    }, [allCourses, filterState]);
    const courseTypes = React.useMemo(() => ['All', ...new Set(allCourses.map(c => c.course_type).filter(Boolean))].sort(), [allCourses]);

    const courses = React.useMemo(() => {
        let filtered = [...allCourses];
        if (filterState !== 'All') filtered = filtered.filter(c => c.state === filterState);
        if (filterLocality !== 'All') filtered = filtered.filter(c => c.locality === filterLocality);
        if (filterCourseType !== 'All') filtered = filtered.filter(c => c.course_type === filterCourseType);
        if (filterStatus !== 'All') {
            const isApproved = filterStatus === 'Approved';
            filtered = filtered.filter(c => !!c.isCertificateApproved === isApproved);
        }
        return filtered.sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
    }, [allCourses, filterState, filterLocality, filterCourseType, filterStatus]);

    const loadData = async () => {
        setLoadingApprovals(true);
        try {
            await fetchCourses(true);
            const coords = await listFederalCoordinators({ source: 'cache' });
            const manager = coords.find(c => c.role === 'مدير البرنامج' || c.role === 'Federal Program Manager');
            if (manager) setManagerName(manager.name);
        } catch (err) {
            setToast({ show: true, message: "Error loading approval data", type: 'error' });
        } finally {
            setLoadingApprovals(false);
        }
    };

    React.useEffect(() => { loadData(); }, []);

    const executeApprove = async () => {
        if (!courseToApprove) return;
        setIsProcessing(true);
        try {
            const courseRef = doc(db, 'courses', courseToApprove.id);
            await updateDoc(courseRef, {
                isCertificateApproved: true,
                certificateApprovedAt: new Date(),
                approvedByManagerName: courseToApprove.approvedByManagerName || managerName 
            });
            setToast({ show: true, message: "Certificates Approved Successfully.", type: 'success' });
            await fetchCourses(true);
            setCourseToApprove(null);
        } catch (err) {
            setToast({ show: true, message: `Error: ${err.message}`, type: 'error' });
        } finally { setIsProcessing(false); }
    };

    const handleUnapprove = async (course) => {
        if (window.confirm(`Revoke approval for ${course.course_type}?`)) {
            setIsProcessing(true);
            try {
                await unapproveCourseCertificates(course.id);
                setToast({ show: true, message: "Approval Revoked.", type: 'info' });
                await fetchCourses(true);
            } catch (err) { setToast({ show: true, message: err.message, type: 'error' }); } 
            finally { setIsProcessing(false); }
        }
    };

    const triggerUpload = (course, assetType) => {
        setUploadContext({ course, assetType });
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !uploadContext.course) return;
        const { course, assetType } = uploadContext;
        setIsProcessing(true);
        try {
            const url = await uploadFile(file, `courses/${course.id}/${assetType}_${Date.now()}`);
            const updatePayload = {};
            if (assetType === 'managerSignature') { updatePayload.approvedByManagerSignatureUrl = url; updatePayload.approvedByManagerName = managerName; }
            else if (assetType === 'directorSignature') { updatePayload.approvedDirectorSignatureUrl = url; updatePayload.approvedDirectorName = course.director || ''; }
            else if (assetType === 'stamp') { updatePayload.approvedProgramStampUrl = url; }
            await updateDoc(doc(db, 'courses', course.id), updatePayload);
            setToast({ show: true, message: `Asset uploaded successfully!`, type: 'success' });
            await fetchCourses(true);
        } catch (err) { setToast({ show: true, message: `Upload failed: ${err.message}`, type: 'error' }); } 
        finally { setIsProcessing(false); setUploadContext({ course: null, assetType: null }); }
    };

    if (loadingApprovals && courses.length === 0) return <div className="flex justify-center p-8"><Spinner /></div>;

    return (
        <>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" />

            <Modal isOpen={!!courseToApprove} onClose={() => setCourseToApprove(null)} title="Confirm Approval">
                <CardBody className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 italic">Please verify the signatures and names before confirming approval.</p>
                    <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-lg bg-gray-50">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Director:</span>
                        <span className="font-bold text-gray-900">{courseToApprove?.director}</span>
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Manager:</span>
                        <span className="font-bold text-gray-900">{managerName}</span>
                    </div>
                </CardBody>
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setCourseToApprove(null)}>Cancel</Button>
                    <Button variant="success" onClick={executeApprove}>Confirm & Approve</Button>
                </CardFooter>
            </Modal>

            <Card>
                <PageHeader title="Certificate Approvals" />
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <FormGroup label="State"><Select value={filterState} onChange={e => setFilterState(e.target.value)}>{states.map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                    <FormGroup label="Course Type"><Select value={filterCourseType} onChange={e => setFilterCourseType(e.target.value)}>{courseTypes.map(c => <option key={c} value={c}>{c}</option>)}</Select></FormGroup>
                    <FormGroup label="Status"><Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="All">All</option><option value="Approved">Approved</option><option value="Pending">Pending</option></Select></FormGroup>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-300 shadow-sm bg-white">
                    <table className="w-full text-left border-collapse text-sm table-fixed">
                        <thead>
                            <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                                <th className="p-3 font-semibold border-b border-slate-300 w-[18%]">Course</th>
                                <th className="p-3 font-semibold border-b border-slate-300 w-[18%]">Location & Date</th>
                                <th className="p-3 font-semibold border-b border-slate-300 w-[8%]">Status</th>
                                <th className="p-3 font-semibold border-b border-slate-300 w-[56%] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.map(c => {
                                const isApproved = c.isCertificateApproved === true;
                                const canModify = isApproved && (!c.approvedByManagerName || c.approvedByManagerName === managerName || isFederalProgramManager);
                                
                                return (
                                    <tr key={c.id} className={`transition-colors hover:bg-gray-50 group ${isApproved ? "bg-green-50/20" : ""}`}>
                                        <td className="p-3 align-middle border-b border-slate-200">
                                            <div className="font-bold text-sky-700 truncate" title={c.course_type}>{c.course_type}</div>
                                        </td>
                                        <td className="p-3 align-middle border-b border-slate-200 overflow-hidden">
                                            <div className="font-semibold text-gray-800 truncate" title={`${c.state} - ${c.locality}`}>{c.state} - {c.locality}</div>
                                            <div className="text-[10px] text-gray-500 whitespace-nowrap">{c.start_date}</div>
                                        </td>
                                        <td className="p-3 align-middle border-b border-slate-200">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isApproved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                                {isApproved ? 'Ready' : 'Pending'}
                                            </span>
                                        </td>
                                        
                                        <td className="p-3 align-middle border-b border-slate-200 text-right">
                                            <div className="flex flex-nowrap items-center justify-end gap-1">
                                                {isApproved ? (
                                                    <Button onClick={() => handleUnapprove(c)} disabled={!canModify || isProcessing} variant="danger" className="px-2 py-1 text-[10px] whitespace-nowrap">Revoke</Button>
                                                ) : (
                                                    <Button onClick={() => setCourseToApprove(c)} disabled={isProcessing} variant="success" className="px-2 py-1 text-[10px] whitespace-nowrap font-bold">Approve</Button>
                                                )}

                                                <Button onClick={() => triggerUpload(c, 'managerSignature')} disabled={!isFederalProgramManager || isProcessing} variant={c.approvedByManagerSignatureUrl ? "success" : "secondary"} className="px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1">
                                                    {c.approvedByManagerSignatureUrl ? <CheckCircle size={12} /> : <FileSignature size={12} />} PM Signature
                                                </Button>

                                                <Button onClick={() => triggerUpload(c, 'directorSignature')} disabled={isProcessing} variant={c.approvedDirectorSignatureUrl ? "success" : "secondary"} className="px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1">
                                                    {c.approvedDirectorSignatureUrl ? <CheckCircle size={12} /> : <FileSignature size={12} />} Dir Signature
                                                </Button>

                                                <Button onClick={() => triggerUpload(c, 'stamp')} disabled={!canUseFederalManagerAdvancedFeatures || isProcessing} variant={c.approvedProgramStampUrl ? "success" : "secondary"} className="px-2 py-1 text-[10px] whitespace-nowrap flex items-center gap-1">
                                                    {c.approvedProgramStampUrl ? <CheckCircle size={12} /> : <Stamp size={12} />} Stamp
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </>
    );
};