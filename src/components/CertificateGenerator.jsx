// CertificateGenerator.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from "jspdf";
import { QRCodeCanvas } from 'qrcode.react';
import { STATE_LOCALITIES } from './constants'; 
import { db } from '../firebase'; 
import { collection, query, where, getDocs } from 'firebase/firestore';

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

const fetchArabicName = async (collectionName, englishName, fieldName) => {
    if (!englishName) return null;
    
    try {
        let q = query(collection(db, collectionName), where("name", "==", englishName));
        let snapshot = await getDocs(q);

        if (snapshot.empty && englishName.includes("Dr.")) {
            const cleanName = englishName.replace(/^Dr\.?\s*/i, '').trim();
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
            } else if (courseType === 'Small & Sick Newborn') {
                displaySubCourse = getSmallAndSickSubCourseArabic(participantSubCourse);
            }
        }
    }

    let stateDisplay = course.state;
    if (isArabic && STATE_LOCALITIES[course.state]) {
        stateDisplay = STATE_LOCALITIES[course.state].ar;
    }

    const location = `${stateDisplay} - ${course.hall}`;

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
                        الادارة العامة للرعاية الصحية الاساسية<br />
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
                top: '117mm', 
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
                right: '20mm',
                width: '100mm', 
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
                left: '20mm', 
                width: '100mm', 
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
                       <div style={{ marginBottom: '1mm', position: 'relative', zIndex: 2 }}>د. {directorNameAr || finalDirectorName || '...'}</div>
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

export const generateCertificatePdf = async (course, participant, federalProgramManagerName, participantSubCourse, language = 'en') => {
    
    // --- Logic to prioritize the approved name & signature ---
    const finalManagerName = course.approvedByManagerName || federalProgramManagerName;
    const rawManagerSignature = course.approvedByManagerSignatureUrl || null;

    // --- New Fields ---
    const finalDirectorName = course.approvedDirectorName || course.director;
    const rawDirectorSignature = course.approvedDirectorSignatureUrl || null;
    const rawProgramStamp = course.approvedProgramStampUrl || null;

    // --- CONVERT IMAGES TO BASE64 (Fixes CORS/Loading issues) ---
    const finalManagerSignature = await imageUrlToBase64(rawManagerSignature);
    const finalDirectorSignature = await imageUrlToBase64(rawDirectorSignature);
    const finalProgramStamp = await imageUrlToBase64(rawProgramStamp);

    let directorNameAr = null;
    let programManagerNameAr = null;

    if (language === 'ar') {
        directorNameAr = await fetchArabicName('facilitators', finalDirectorName, 'arabicName');
        programManagerNameAr = await fetchArabicName('federalCoordinators', finalManagerName, 'nameAr');
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
                // New Props
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

// NEW FUNCTION: Generate Blank Template
export const generateBlankCertificatePdf = async (course, federalProgramManagerName, language = 'en') => {
    // --- Logic to prioritize the approved name & signature ---
    const finalManagerName = course.approvedByManagerName || federalProgramManagerName;
    const rawManagerSignature = course.approvedByManagerSignatureUrl || null;

    // --- New Fields ---
    const finalDirectorName = course.approvedDirectorName || course.director;
    const rawDirectorSignature = course.approvedDirectorSignatureUrl || null;
    const rawProgramStamp = course.approvedProgramStampUrl || null;

    // --- CONVERT IMAGES TO BASE64 ---
    const finalManagerSignature = await imageUrlToBase64(rawManagerSignature);
    const finalDirectorSignature = await imageUrlToBase64(rawDirectorSignature);
    const finalProgramStamp = await imageUrlToBase64(rawProgramStamp);

    let directorNameAr = null;
    let programManagerNameAr = null;

    if (language === 'ar') {
        directorNameAr = await fetchArabicName('facilitators', finalDirectorName, 'arabicName');
        programManagerNameAr = await fetchArabicName('federalCoordinators', finalManagerName, 'nameAr');
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

        // --- NEW: Derive a sample sub-course for the template ---
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
        // -----------------------------------------------------------

        root.render(
            <CertificateTemplate 
                course={course} 
                participant={dummyParticipant} 
                federalProgramManagerName={finalManagerName} 
                participantSubCourse={sampleSubCourse} // <--- UPDATED
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

export const generateAllCertificatesPdf = async (course, participants, federalProgramManagerName, language = 'en', onProgress = null) => {
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
            language
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