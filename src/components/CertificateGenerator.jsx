// CertificateGenerator.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from "jspdf";
import { QRCodeCanvas } from 'qrcode.react';

// --- Constants & Helpers ---

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
    if (language === 'ar') {
        switch (courseType) {
            case 'ICCM': return 'العلاج المتكامل للأطفال أقل من 5 سنوات في المجتمع';
            case 'IMNCI': return 'الادارة المتكاملة لصحة الطفولة وحديثي الولادة (IMNCI)';
            case 'ETAT': return 'الفرز والتقييم والعلاج في حالات الطوارئ (ETAT)';
            case 'EENC': return 'الرعاية الأساسية المبكرة لحديثي الولادة (EENC)';
            case 'IPC': return 'مكافحة العدوى (وحدة حديثي الولادة)';
            case 'Small & Sick Newborn': return 'إدارة حالات حديثي الولادة المرضى وصغار الحجم';
            default: return courseType;
        }
    }
    // English Fallback
    switch (courseType) {
        case 'IMNCI': return 'Integrated Management of Newborn and Childhood Illnesses (IMNCI)';
        case 'ICCM': return 'Integrated Community case management for under 5 children (iCCM)';
        case 'ETAT': return 'Emergency Triage, Assessment & Treatment (ETAT)';
        case 'EENC': return 'Early Essential Newborn Care (EENC)';
        case 'IPC': return 'Infection Prevention & Control (Neonatal Unit)';
        case 'Small & Sick Newborn': return 'Small & Sick Newborn Case Management';
        default: return courseType;
    }
};

// --- Component ---

const CertificateTemplate = React.memo(function CertificateTemplate({ 
    course, 
    participant, 
    federalProgramManagerName, 
    participantSubCourse,
    language = 'en'
}) {
    const isArabic = language === 'ar';
    const courseTitle = getCertificateCourseTitle(course.course_type, language);
    
    // Handle Sub-course translation specifically for ICCM
    let displaySubCourse = participantSubCourse;
    if (isArabic && course.course_type === 'ICCM') {
        displaySubCourse = "تدريب العامل الصحي المجتمعي";
    }

    const location = `${course.state} - ${course.hall}`;
    let courseDate = '';
    const courseDuration = course.course_duration;
    
    // Date Logic
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
            // Arabic: No suffixes (st, nd), just numbers
            const startMonthName = getArabicMonthName(startMonthIndex);
            const endMonthName = getArabicMonthName(endMonthIndex);
            if (startMonthIndex === endMonthIndex) {
                courseDate = `${startDayOfMonth} - ${endDayOfMonth} ${startMonthName} ${startYearNum}`;
            } else {
                courseDate = `${startDayOfMonth} ${startMonthName} - ${endDayOfMonth} ${endMonthName} ${endYearNum}`;
            }
        } else {
            // English: With suffixes
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
    
    const verificationUrl = `${window.location.origin}/verify/certificate/${participant.id}`;

    // Styles
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

    return (
        <div id="certificate-template" style={containerStyle}>
            {/* Background Border */}
            <img 
                src="/certificate/border.jpg" 
                alt="Certificate Border" 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
            />
            
            {/* === ARABIC LOGOS === */}
            {isArabic && (
                <>
                    {/* Right: FMOH & Child Health */}
                    <div style={{ position: 'absolute', top: '15mm', right: '25mm', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {/* Ensure these images exist in your public folder */}
                        <img src="/logos/fmoh_logo.png" alt="FMOH" style={{ height: '22mm', width: 'auto' }} />
                        <img src="/logos/child_health_logo.png" alt="NCHP" style={{ height: '22mm', width: 'auto' }} />
                    </div>
                    
                    {/* Left: UNICEF & WHO */}
                    <div style={{ position: 'absolute', top: '15mm', left: '25mm', zIndex: 1, display: 'flex', gap: '15px' }}>
                         <img src="/logos/who_logo.png" alt="WHO" style={{ height: '22mm', width: 'auto' }} />
                         <img src="/logos/unicef_logo.png" alt="UNICEF" style={{ height: '22mm', width: 'auto' }} />
                    </div>
                </>
            )}

            {/* Header Text */}
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

            {/* Certificate Word (Arabic Only) */}
            {isArabic && (
                 <div style={{
                    position: 'absolute',
                    top: '70mm',
                    left: '0',
                    right: '0',
                    textAlign: 'center',
                    fontSize: '40px',
                    fontWeight: 'bold',
                    textDecoration: 'underline',
                    zIndex: 2
                }}>
                    شهادة
                </div>
            )}

            {/* Name */}
            <div style={{
                position: 'absolute',
                top: isArabic ? '95mm' : '88mm',
                left: '60mm',
                right: '60mm',
                textAlign: 'center',
                fontSize: '30px',
                fontWeight: 'bold',
                zIndex: 2
            }}>
                {isArabic ? `مقدم الخدمة / ${participant.name}` : `Dr. ${participant.name}`}
            </div>

            {/* Completed Text */}
            <div style={{
                position: 'absolute',
                top: isArabic ? '110mm' : '105mm', 
                left: '50mm',
                right: '50mm',
                textAlign: 'center',
                fontSize: '22px', 
                fontStyle: isArabic ? 'normal' : 'italic',
                zIndex: 2
            }}>
                {isArabic ? 'أكمل بنجاح الدورة التدريبية:' : 'Has successfully completed:'}
            </div>

            {/* Course Title */}
            <div style={{
                position: 'absolute',
                top: isArabic ? '120mm' : '118mm', 
                left: '10mm',
                right: '10mm',
                textAlign: 'center',
                fontSize: '28px', 
                fontWeight: 'bold',
                color: 'red',
                zIndex: 2
            }}>
                {courseTitle}
            </div>
            
            {/* Sub Course */}
            {(displaySubCourse) && (
                <div style={{
                    position: 'absolute',
                    top: isArabic ? '135mm' : '131mm', 
                    left: '10mm',
                    right: '10mm',
                    textAlign: 'center',
                    fontSize: '20px',
                    fontWeight: 'normal',
                    color: 'black',
                    zIndex: 2
                }}>
                   ({displaySubCourse})
                </div>
            )}

            {/* Place and Date */}
            <div style={{
                position: 'absolute',
                top: '148mm', 
                left: '50%', 
                transform: 'translateX(-50%)', 
                textAlign: 'center', 
                width: '100%',
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

            {/* QR Code */}
            <div style={{
                position: 'absolute',
                top: '171mm',    
                left: '136mm',   
                width: '25mm',
                height: '25mm',
                backgroundColor: 'white', 
                padding: '1mm',           
                boxSizing: 'border-box',
                zIndex: 2
            }}>
                <QRCodeCanvas
                    value={verificationUrl}
                    size={87} 
                    bgColor={"#ffffff"}
                    fgColor={"#000000"}
                    level={"L"} 
                    includeMargin={false}
                />
            </div>

            {/* === SIGNATURES === */}
            
            {/* Right Signature Slot */}
            <div style={{
                position: 'absolute',
                top: '175mm', 
                right: '20mm',
                width: '80mm', 
                textAlign: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                zIndex: 2
            }}>
               {isArabic ? (
                   // Arabic: Program Manager on Right (Under Ministry Logo)
                   <>
                       <div style={{ marginBottom: '10mm' }}>د. {federalProgramManagerName || '...'}</div>
                       <div>مدير البرنامج</div>
                   </>
               ) : (
                   // English: Course Director on Right
                   <>
                       <div style={{ marginBottom: '10mm' }}>Dr. {course.director}</div>
                       <div>Course Director</div>
                   </>
               )}
            </div>

            {/* Left Signature Slot */}
            <div style={{
                position: 'absolute',
                top: '175mm', 
                left: '20mm', 
                width: '80mm', 
                textAlign: 'center',
                fontSize: '20px', 
                fontWeight: 'bold',
                zIndex: 2
            }}>
                {isArabic ? (
                   // Arabic: Course Director on Left (Under Partners Logo)
                   <>
                       <div style={{ marginBottom: '10mm' }}>د. {course.director}</div>
                       <div>مدير الدورة</div>
                   </>
               ) : (
                   // English: Program Manager on Left
                   <>
                       <div style={{ marginBottom: '10mm' }}>Dr. {federalProgramManagerName || 'Federal Program Manager'}</div>
                       <div>National Program Manager</div>
                   </>
               )}
            </div>
        </div>
    );
});

// --- Generation Functions ---

export const generateCertificatePdf = async (course, participant, federalProgramManagerName, participantSubCourse, language = 'en') => {
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
        root.render(
            <CertificateTemplate 
                course={course} 
                participant={participant} 
                federalProgramManagerName={federalProgramManagerName} 
                participantSubCourse={participantSubCourse} 
                language={language}
            />
        );

        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 800)); 

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

export const generateAllCertificatesPdf = async (course, participants, federalProgramManagerName, language = 'en') => {
    if (!participants || participants.length === 0) {
        alert("No participants found to generate certificates.");
        return;
    }

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const imgWidth = 297; 
    const imgHeight = 210; 
    let firstPage = true;

    for (let i = 0; i < participants.length; i++) {
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
            
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
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