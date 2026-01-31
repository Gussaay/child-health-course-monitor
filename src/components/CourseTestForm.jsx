// CourseTestForm.jsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    Card, PageHeader, Button, FormGroup, Select, Spinner, Input, Modal, CardBody, CardFooter, Table, EmptyState
} from "./CommonComponents"; 
import {
    JOB_TITLES_ETAT, JOB_TITLES_EENC, STATE_LOCALITIES
} from './constants.js';
import {
    listHealthFacilities,
    submitFacilityDataForApproval,
    upsertParticipantTest, 
    deleteParticipantTest
} from '../data.js';
import { GenericFacilityForm, IMNCIFormFields } from './FacilityForms.jsx'; 
import { Edit, Trash2, PlusCircle, Eye, Share2, CheckCircle, Save, Check, X } from 'lucide-react'; 

export const EENC_TEST_QUESTIONS = [
    { id: 'q1', text: '1. Delivering in the supine position during second stage of labour is best.', type: 'mc', options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], correctAnswer: 'b' },
    { id: 'q2', text: '2. Applying fundal pressure (pushing down on the top of the uterus) is an effective means of supporting labour.', type: 'mc', options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], correctAnswer: 'b' },
    { id: 'q3', text: '3. After a baby is born, you should call out the time of birth (accurate to minute and second), then what?', type: 'mc', options: [{ id: 'a', text: 'Clamp and cut the cord.' }, { id: 'b', text: 'Thoroughly dry the baby.' }, { id: 'c', text: 'Suction the baby’s mouth and nose.' }, { id: 'd', text: 'Hold the baby upside-down to let out the secretion' }], correctAnswer: 'b' },
    { id: 'q4', text: '4. During thorough drying and stimulation of the baby, your rapid assessment shows she is crying. What is your next action?', type: 'mc', options: [{ id: 'a', text: 'Suction the baby’s mouth and nose.' }, { id: 'b', text: 'Clamp and cut the cord.' }, { id: 'c', text: 'Place the baby in skin-to-skin contact with the mother.' }, { id: 'd', text: 'Place the baby onto the breast.' }], correctAnswer: 'c' },
    { id: 'q5', text: '5. For which reason(s)should the baby’s mouth and nose be suctioned after thorough drying?', type: 'mc', options: [{ id: 'a', text: 'The baby is breathing and the amniotic fluid is thickly stained with meconium and the baby is covered in meconium.' }, { id: 'b', text: 'The baby is not breathing and the amniotic fluid is thickly stained with meconium and the baby is covered in meconium.' }, { id: 'c', text: 'The baby is not breathing and there is no airway obstruction visible.' }, { id: 'd', text: 'All of the above.' }], correctAnswer: 'b' },
    { id: 'q6', text: '6. A baby has feeding cues indicating she is ready to breast feed immediately after birth.', type: 'mc', options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], correctAnswer: 'a' },
    { id: 'q7', text: '7. What is the approximate capacity of a newborn\'s stomach? Circle A, B, C or D.', type: 'mc', imageSrc: '/eenc-q7.jpg', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' }], correctAnswer: 'd' },
    { id: 'q8', text: '8. List 3 signs a newborn baby is ready to breast feed (“feeding cues”).', type: 'open', lines: 3 },
    { id: 'q9', text: '9. List 3 signs a baby has good attachment to the breast.', type: 'open', lines: 3 },
    { id: 'q10', text: '10. List 3 things you should do to improve bag-and-mask ventilation.', type: 'open', lines: 3 },
    { id: 'q11', text: '11. When does a baby need bag-and-mask ventilation? After thorough drying for 30 seconds, the baby is:', type: 'mc', options: [{ id: 'a', text: 'Not breathing.' }, { id: 'b', text: 'Having difficulty breathing (gas ping respirations).' }, { id: 'c', text: 'Breathing but limp and very pale or blue in colour.' }, { id: 'd', text: 'All of the above.' }], correctAnswer: 'd' },
    { id: 'q12', text: '12. A baby required bag-and-mask ventilation for 2 minutes. You have stopped bag-and-mask ventilation. He is now crying, breathing without difficulty, pink, and the heart rate is > 100 beats per minute. What should you do now?', type: 'mc', options: [{ id: 'a', text: 'Place the baby in direct skin-to-skin contact with the mother/do routine newborn care.' }, { id: 'b', text: 'Move the baby to an observational area and monitor breathing every 10 minutes.' }, { id: 'c', text: 'Give oxygen by nasal cannula or mask.' }, { id: 'd', text: 'Do all of the above' }], correctAnswer: 'a' }
];

export const ICCM_TEST_QUESTIONS = [
    { id: 'q1', text: '1. أي من الآتي علامة خطر تستوجب تحويلا عاجلا للمستشفى؟', type: 'mc', options: [{ id: 'a', text: 'حرارة خفيفة يوم واحد' }, { id: 'b', text: 'عدم القدرة على الشرب أو الرضاعة' }, { id: 'c', text: 'رشح بسيط' }, { id: 'd', text: 'سعال الثلاثة أيام' }], correctAnswer: 'b' },
    { id: 'q2', text: '2. التشنجات أثناء المرض الحالي تتطلب', type: 'mc', options: [{ id: 'a', text: 'علاج منزلي' }, { id: 'b', text: 'متابعة بعد يومين' }, { id: 'c', text: 'تحويل فوري' }], correctAnswer: 'c' },
    { id: 'q3', text: '3. عد التنفس يكون لمدة:', type: 'mc', options: [{ id: 'a', text: '15 ثانية' }, { id: 'b', text: '30 ثانية' }, { id: 'c', text: '60 ثانية' }], correctAnswer: 'c' },
    { id: 'q4', text: '4. تنفس سريع لطفل عمر 12 شهرًا هو على الأقل:', type: 'mc', options: [{ id: 'a', text: '40 نفس لكل دقيقة' }, { id: 'b', text: '50 نفس لكل دقيقة' }, { id: 'c', text: '60 نفس لكل دقيقة' }], correctAnswer: 'b' },
    { id: 'q5', text: '5. في الإسهال، أول قاعدة علاج منزلي', type: 'mc', options: [{ id: 'a', text: 'إيقاف السوائل' }, { id: 'b', text: 'زيادة السوائل بما فيها محلول معالجة الجفاف (محلول الارواء)' }, { id: 'c', text: 'مضاد حيوي' }], correctAnswer: 'b' },
    { id: 'q6', text: '6. الهدف من محلول معالجة الجفاف (ملح الارواء):', type: 'mc', options: [{ id: 'a', text: 'تقليل الحرارة' }, { id: 'b', text: 'تعويض الماء والأملاح المفقودة' }, { id: 'c', text: 'فتح الشهية' }], correctAnswer: 'b' },
    { id: 'q7', text: '7. طريقة إعطاء محلول معالجة الجفاف ملح الارواء) إذا تقiأ الطفل :', type: 'mc', options: [{ id: 'a', text: 'التوقف تماما' }, { id: 'b', text: 'كميات صغيرة متكررة بعد 5-10 دقائق' }, { id: 'c', text: 'جرعات كبيرة' }], correctAnswer: 'b' },
    { id: 'q8', text: '8. يعطى الزنك لكل الأطفال المصابين بالاسهال', type: 'mc', options: [{ id: 'a', text: 'حتى زوال الاسهال' }, { id: 'b', text: 'مدة 3 أيام' }, { id: 'c', text: 'مدة 10 ايام' }], correctAnswer: 'c' },
    { id: 'q9', text: '9. نتيجة اختبار الملاريا السريع إيجابي مع حمى دون علامات خطر تُصنف :', type: 'mc', options: [{ id: 'a', text: 'علاج منزلي باعطاء حبوب الكوارتم' }, { id: 'b', text: 'تحويل فوري' }, { id: 'c', text: 'لا يحتاج علاج' }], correctAnswer: 'a' },
    { id: 'q10', text: '10. عند تقiؤ جرعة الكوارتم خلال ساعة', type: 'mc', options: [{ id: 'a', text: 'لا يحتاج إعادة الجرعة' }, { id: 'b', text: 'تكرار نفس الجرعة' }, { id: 'c', 'زيادة الجرعة للضعف': 'زيادة الجرعة للضعف' }], correctAnswer: 'b' },
    { id: 'q11', text: '11. قراءة المواك حمراء تعني :', type: 'mc', options: [{ id: 'a', text: 'سوء تغذية متوسط' }, { id: 'b', text: 'لا توجد سوء تغذية' }, { id: 'c', 'سوء تغذية شديد وتحويل': 'سوء تغذية شديد وتحويل' }], correctAnswer: 'c' },
    { id: 'q12', text: '12. وذمة (ورم) القدمين الثنائية بعد ضغط الإبهام تشير إلى:', type: 'mc', options: [{ id: 'a', text: 'سوء تغذية شديد يحتاج علاج بالمنزل' }, { id: 'b', text: 'سوء تغذية شديد يحتاج تحويل عاجل الى المستشفى' }], correctAnswer: 'b' },
    { id: 'q13', text: '13. قبل تحويل طفل لديه علامة خطر ويستطيع الشرب', type: 'mc', options: [{ id: 'a', text: 'التجويل العاجل مع إعطاء ادوية ما قبل التحويل' }, { id: 'b', text: 'تحويل عاجل' }], correctAnswer: 'a' },
    { id: 'q14', text: '14. المتابعة لطفل كحة وتنفس سريع بعد بدء الأموكسيسيلين تكون بعد:', type: 'mc', options: [{ id: 'a', text: 'يومين' }, { id: 'b', text: 'أسبوع' }, { id: 'c', 'لا حاجة': 'لا حاجة' }], correctAnswer: 'a' },
    { id: 'q15', text: '15. أي من العلامات التالية تعتبر علامة خطورة للطفل حديث الولادة', type: 'mc', options: [{ id: 'a', text: 'درجة حرارة اقل من 35.5' }, { id: 'b', text: 'إسهال' }], correctAnswer: 'a' }
];

export const SSNB_WARMER_TEST_QUESTIONS = [
    { id: 'q1', text: '1. ما هي الرعاية القياسية لتوفير الدف للاطفال حديثي الولادة حسب توصيات منظمة الصحة العالمية ؟', type: 'mc', options: [{ id: 'a', text: 'استخدام الدفايات الكهربائية' }, { id: 'b', text: 'استخدام الدفايات المتنقلة' }, { id: 'c', text: 'وضع الطفل ملتصقا جلد بجلد' }, { id: 'd', text: 'استخدام الملابس القطنية' }], correctAnswer: 'c' },
    { id: 'q2', text: '2. ما هي درجة الحرارة المناسبة للطفل حديث الولادة :', type: 'mc', options: [{ id: 'a', text: 'اكثر من 37 درجة' }, { id: 'b', text: 'من 36.5 الى 37.5 درجة' }, { id: 'c', text: 'اقل من 36.5 درجة' }], correctAnswer: 'b' },
    { id: 'q3', text: '3. ما هي اسباب استخدام الدفايات المتنقلة :', type: 'mc', options: [{ id: 'a', text: 'وضع كل الاطفال الخدج وناقصي الوزن' }, { id: 'b', text: 'استخدام الدفاية في حالة النقل من مكان لمكان' }], correctAnswer: 'b' },
    { id: 'q4', text: '4. في تقديرك كم من الزمن سوف تحتفظ الدفاية بالحرارة عند وضع الطفل بداخلها', type: 'mc', options: [{ id: 'a', text: 'ساعة واحدة' }, { id: 'b', text: '4 ساعات - 6 ساعات' }, { id: 'c', text: 'اكثر من 10 ساعات' }], correctAnswer: 'b' },
    { id: 'q5', text: '5. كيف يتم تعقيم لبسة الدفاية', type: 'mc', options: [{ id: 'a', text: 'غسلها بالماء والصابون ثم المسح بالكجول قبل الاستخدام' }, { id: 'b', text: 'نقعها في محلول الكلور' }], correctAnswer: 'a' }
];

export const IMNCI_TEST_QUESTIONS = [
    { id: 'q1', text: '1. Which of the following signs are "general danger sign" in a sick child aged 2 months up to five years?', type: 'mc', options: [{ id: 'a', text: 'Axillary temperature ≥39.0°c' }, { id: 'b', text: 'Lethargy' }, { id: 'c', text: 'Blood in the stool' }, { id: 'd', text: 'Axillary temperature ≥37.5°c for more than 7 days' }], correctAnswer: 'b' },
    { id: 'q2', text: '2. All of the following are the main causes of mortality in under-five children in the country except?', type: 'mc', options: [{ id: 'a', text: 'Diarrheal diseases' }, { id: 'b', text: 'Pneumonia' }, { id: 'c', text: 'Road traffic injuries' }, { id: 'd', text: 'Malnutrition' }], correctAnswer: 'c' },
    { id: 'q3', text: '3. For which setting are the IMCI guidelines suitable for use?', type: 'mc', options: [{ id: 'a', text: 'Inpatient ward of a district hospital' }, { id: 'b', text: 'Critical care services (PICUs, NICUs…)' }, { id: 'c', text: 'First-level health facilities' }, { id: 'd', text: 'Inpatient ward of a specialized hospital' }], correctAnswer: 'c' },
    { id: 'q4', text: '4. All of the following are needed to count the respiratory rate correctly in a child with cough except?', type: 'mc', options: [{ id: 'a', text: 'child should be calm' }, { id: 'b', text: 'the count should always be repeated' }, { id: 'c', text: 'the count should be for a full minute' }, { id: 'd', text: 'A timer should be used' }], correctAnswer: 'b' },
    { id: 'q5', text: '5. Which of the following statements best describes wheezing?', type: 'mc', options: [{ id: 'a', text: 'It is a harsh sound during inspiration' }, { id: 'b', text: 'It is a soft musical sound that is heard during the expiration' }, { id: 'c', text: 'It is a soft musical sound during inspiration' }, { id: 'd', text: 'If heard leaning close to the child\'s mouth, it should be confirmed by auscultation' }], correctAnswer: 'b' },
    { id: 'q6', text: '6. Which of the following signs would make you classify a 5-month-old child with difficulty breathing as having severe pneumonia or very severe disease?', type: 'mc', options: [{ id: 'a', text: 'restlessness' }, { id: 'b', text: 'vomiting' }, { id: 'c', text: 'irritability' }, { id: 'd', text: 'stridor in a calm baby' }], correctAnswer: 'd' },
    { id: 'q7', text: '7. Which of the following signs in a 12-month-old child with a cough are an indication for urgent referral?', type: 'mc', options: [{ id: 'a', text: 'severe palmar pallor' }, { id: 'b', text: 'respiratory rate of 65 per minute' }, { id: 'c', text: 'axillary temperature ≥ 39.0°c' }, { id: 'd', text: 'restlessness' }], correctAnswer: 'a' },
    { id: 'q8', text: '8. To classify dehydration status for an 8-month-old child with diarrhea all of the following signs are needed except?', type: 'mc', options: [{ id: 'a', text: 'lethargic or unconscious' }, { id: 'b', text: 'skin pinch returns back slowly' }, { id: 'c', text: 'more than 3 watery stools' }, { id: 'd', text: 'restless, irritable' }], correctAnswer: 'c' },
    { id: 'q9', text: '9. How do you classify a 23-month-old child who has been having diarrhea for 5 days has no general danger signs, is alert, has no sunken eyes, and drinks normally, and in whom the skin pinch goes back slowly?', type: 'mc', options: [{ id: 'a', text: 'severe dehydration' }, { id: 'b', text: 'some dehydration' }, { id: 'c', text: 'no dehydration' }, { id: 'd', text: 'persistent diarrhea' }], correctAnswer: 'c' },
    { id: 'q10', text: '10. How do you classify a 3-year-old child who has a history of fever for 2 days, has an axillary temperature of 39.5°c, and in whom there is resistance when you try to bend his neck forward toward his chest?', type: 'mc', options: [{ id: 'a', text: 'very severe febrile disease' }, { id: 'b', text: 'malaria' }, { id: 'c', text: 'fever– malaria unlikely' }, { id: 'd', text: 'mastoiditis' }], correctAnswer: 'a' },
    { id: 'q11', text: '11. Which of the following signs classify a 3-year-old child as having mastoiditis?', type: 'mc', options: [{ id: 'a', text: 'pus draining from the ear for 5 days' }, { id: 'b', text: 'redness of ear pinna (auricle)' }, { id: 'c', text: 'tender swelling behind the ear' }, { id: 'd', text: 'ear pain' }], correctAnswer: 'c' },
    { id: 'q12', text: '12. Which of the following signs are used to classify the child as having SAM malnutrition?', type: 'mc', options: [{ id: 'a', text: 'mouth ulcers' }, { id: 'b', text: 'edema of both feet' }, { id: 'c', text: 'skin pigmentation' }, { id: 'd', text: 'Hair changes' }], correctAnswer: 'b' },
    { id: 'q13', text: '13. In a 12-month-old child with cough and diarrhea, which of the following signs is an indication for an urgent referral?', type: 'mc', options: [{ id: 'a', text: 'restless, irritable' }, { id: 'b', text: 'respiratory rate of 65 per minute' }, { id: 'c', text: 'axillary temperature ≥ 39.0°c' }, { id: 'd', text: 'child unable to breastfeed' }], correctAnswer: 'd' },
    { id: 'q14', text: '14. Which of the following statements are true?', type: 'mc', options: [{ id: 'a', text: 'a child who is immunocompromised should not be given BCG vaccine' }, { id: 'b', text: 'a child who has a fever should not be immunized' }, { id: 'c', text: 'a child who is being referred for severe classification should be immunized before referral.' }, { id: 'd', text: 'a child who is low weight should not be immunized' }], correctAnswer: 'a' },
    { id: 'q15', text: '15. Which treatment is not given to a 2-year-old child who is having convulsions at the PHC health facility?', type: 'mc', options: [{ id: 'a', text: 'diazepam rectally' }, { id: 'b', text: 'first dose of an appropriate antibiotic' }, { id: 'c', text: 'first dose of IV calcium' }, { id: 'd', text: 'sugar water to prevent low blood sugar' }], correctAnswer: 'c' },
    { id: 'q16', text: '16. How can a zinc tablet be given? All of the following are correct except?', type: 'mc', options: [{ id: 'a', text: 'dissolved in a small amount of expressed breast milk' }, { id: 'b', text: 'dissolved in ORS' }, { id: 'c', text: 'dissolved in clean water' }, { id: 'd', text: 'let the child chew it if less than 12 months old' }], correctAnswer: 'd' },
    { id: 'q17', text: '17. 4 yr-old child classified as having pneumonia which dose of amoxicillin syrup 250mg/5ml is correct?', type: 'mc', options: [{ id: 'a', text: '15 ml every 12 hours for 5 days' }, { id: 'b', text: '10 ml every 8 hours for 5 days' }, { id: 'c', text: '5 ml every 12 hours for 5 days' }, { id: 'd', text: '15 ml every 8 hours for 5 days' }], correctAnswer: 'a' },
    { id: 'q18', text: '18. How do you classify a 4-day-old newborn who has yellow palms and soles?', type: 'mc', options: [{ id: 'a', text: 'severe jaundice' }, { id: 'b', text: 'jaundice' }, { id: 'c', text: 'local bacterial infection' }, { id: 'd', text: 'no jaundice' }], correctAnswer: 'a' },
    { id: 'q19', text: '19. Which of the following are criteria for good positioning of the baby to his mother?', type: 'mc', options: [{ id: 'a', text: 'chin touching the breast' }, { id: 'b', text: 'mouth wide open' }, { id: 'c', text: 'baby held close to his mother\'s body' }, { id: 'd', text: 'lower lip turned in' }], correctAnswer: 'c' },
    { id: 'q20', text: '20. How do you classify a 5-day-old infant who has severe chest indrawing and an axillary temperature of 36.8°c?', type: 'mc', options: [{ id: 'a', text: 'very severe disease or possible serious bacterial infection' }, { id: 'b', text: 'local bacterial infection' }, { id: 'c', text: 'severe disease or local bacterial infection unlikely' }, { id: 'd', text: 'fever– malaria unlikely' }], correctAnswer: 'a' }
];

export const ETAT_TEST_QUESTIONS = [
    { 
        id: 'q1', 
        text: '1. Define triage?', 
        type: 'open', 
        lines: 1 
    },
    { 
        id: 'q2', 
        text: '2. What do the letters A, B, C and D in the "ABCD" stand for?', 
        type: 'open', 
        lines: 4 
    },
    { 
        id: 'q3', 
        text: '3. List the three things you do to check airway and breathing?', 
        type: 'open', 
        lines: 3 
    },
    { 
        id: 'q4', 
        text: '4. At what flow (volume/time) should oxygen be started?', 
        type: 'open', 
        lines: 1 
    },
    { 
        id: 'q5', 
        text: '5. Define a normal capillary refill time?', 
        type: 'open', 
        lines: 1 
    },
    { 
        id: 'q6', 
        text: '6. If you cannot feel the radial pulse in an older child, which pulse should you look for next?', 
        type: 'open', 
        lines: 1 
    },
    { 
        id: 'q7', 
        text: '7. Name the two types of fluid you can give to treat shock initially?', 
        type: 'open', 
        lines: 2 
    },
    { 
        id: 'q8', 
        text: '8. What volume of fluid would you give to a well-nourished one-year old weighing 11kg who is in shock?', 
        type: 'open', 
        lines: 1 
    },
    { 
        id: 'q9', 
        text: '9. What do the letters AVPU stand for?', 
        type: 'open', 
        lines: 4 
    },
    { 
        id: 'q10', 
        text: '10. A child who is unconscious, with no history of trauma, but maintaining the airway should be put in which position?', 
        type: 'open', 
        lines: 1 
    },
    { 
        id: 'q11', 
        text: '11. How much rectal diazepam (in ml of the 10mg/2ml solution) would you give to a four-year old weighing 15kg who is having a convulsion? How long should you wait before giving a second dose if the convulsion does not stop?', 
        type: 'open', 
        lines: 2 
    },
    { 
        id: 'q12', 
        text: '12. An eight-month old weighing 6kg is severely dehydrated. How much fluid would you give in the first hour? For how long you give the second lot of fluid in the same child?', 
        type: 'open', 
        lines: 2 
    },
    { 
        id: 'q13', 
        text: '13. A three-year old weighing 15kg is severely dehydrated. He has received 450 ml of fluid in 30 minutes. How much fluid are you going to give him next, and over what period of time?', 
        type: 'open', 
        lines: 2 
    }
];

const initializeAnswers = (questions) => {
    const initialAnswers = {};
    questions.forEach(q => {
        if (q.type === 'open') {
            initialAnswers[q.id] = Array(q.lines).fill(''); 
        } else {
            initialAnswers[q.id] = ''; 
        }
    });
    return initialAnswers;
};

// Initialize manual scores array. 
// For open questions with 'n' lines, we store an array of size 'n'.
const initializeManualScores = (questions, existingScores = {}) => {
    const scores = {};
    questions.forEach(q => {
        if (q.type === 'open') {
            if (existingScores[q.id] && Array.isArray(existingScores[q.id])) {
                 scores[q.id] = existingScores[q.id];
            } else {
                 // Initialize with 0s for all lines
                 scores[q.id] = Array(q.lines).fill(0);
            }
        }
    });
    return scores;
};

// ... [Keep TestResultScreen, SearchableSelect, and AddFacilityModal components exactly as they were] ...
const TestResultScreen = ({ 
    participantName, testType, score, total, percentage, onBack, 
    canManageTests, onEdit, onDelete, isExistingResult 
}) => {
    const percent = percentage.toFixed(1);
    const scoreClass = percent >= 80 ? 'text-green-600' : percent >= 60 ? 'text-yellow-600' : 'text-red-600';

    return (
        <Card>
            <div className="p-6 text-center">
                <PageHeader title="Test Result" subtitle={`Score for ${participantName} (${testType})`} />
                {isExistingResult && (
                    <div className="mb-6 p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-200 inline-block">
                        You already solved the test.
                    </div>
                )}
                <div className="my-8">
                    <div className={`text-6xl font-bold ${scoreClass}`}>{percent}%</div>
                    <div className="text-xl text-gray-700 mt-2">({score} / {total} Total Points)</div>
                    <p className="text-sm text-gray-500 mt-4">Score includes both multiple-choice and manually graded questions.</p>
                </div>
                <div className="flex justify-center gap-3">
                    <Button variant="secondary" onClick={onBack}>Back</Button>
                    {canManageTests && (
                        <>
                            <Button variant="primary" onClick={onEdit}>Edit / Grade Test</Button>
                            <Button variant="danger" onClick={onDelete}>Delete Test</Button>
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
};

const SearchableSelect = ({ options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const selectedOption = options.find(opt => opt.id === value);
        setInputValue(selectedOption ? selectedOption.name : '');
    }, [value, options]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
                const selectedOption = options.find(opt => opt.id === value);
                setInputValue(selectedOption ? selectedOption.name : '');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref, value, options]);

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        const selectedOption = options.find(opt => opt.id === value);
        if (selectedOption && selectedOption.name === inputValue) return options;
        if (value === 'addNewFacility' && options[0]?.id === 'addNewFacility') {
             return options.filter(opt => opt.id === 'addNewFacility' || opt.name.toLowerCase().includes(inputValue.toLowerCase()));
        }
        return options.filter(opt => opt.name.toLowerCase().includes(inputValue.toLowerCase()));
    }, [options, inputValue, value]);

    const handleSelect = (option) => {
        onChange(option.id);
        setInputValue(option.name);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={ref}>
            <Input
                type="text"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    setIsOpen(true);
                    if (e.target.value === '') onChange('');
                }}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
            />
            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <div
                                key={opt.id}
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${opt.id === 'addNewFacility' ? 'font-bold text-sky-600 bg-sky-50' : ''}`}
                                onClick={() => handleSelect(opt)}
                            >
                                {opt.name}
                            </div>
                        ))
                    ) : (
                         inputValue && options[0]?.id === 'addNewFacility' ? (
                            <div
                                key={options[0].id}
                                className={`p-2 cursor-pointer hover:bg-gray-100 ${options[0].id === 'addNewFacility' ? 'font-bold text-sky-600 bg-sky-50' : ''}`}
                                onClick={() => handleSelect(options[0])}
                            >
                                {options[0].name}
                            </div>
                         ) : ( <div className="p-2 text-gray-500">No results found.</div> )
                    )}
                </div>
            )}
        </div>
    );
};

const AddFacilityModal = ({ isOpen, onClose, onSaveSuccess, initialState, initialLocality, initialName = '', setToast }) => {
    const [isSubmitting, setIsSubmitting] =useState(false);
    const facilityInitialData = useMemo(() => ({
        'الولاية': initialState || '',
        'المحلية': initialLocality || '',
        'اسم_المؤسسة': initialName || '',
        'هل_المؤسسة_تعمل': 'Yes',
        'date_of_visit': new Date().toISOString().split('T')[0],
        'وجود_العلاج_المتكامل_لامراض_الطفولة': 'No',
        'وجود_سجل_علاج_متكامل': 'No',
        'وجود_كتيب_لوحات': 'No',
        'ميزان_وزن': 'No',
        'ميزان_طول': 'No',
        'ميزان_حرارة': 'No',
        'ساعة_مؤقت': 'No',
        'غرفة_إرواء': 'No',
        'immunization_office_exists': 'No',
        'nutrition_center_exists': 'No',
        'growth_monitoring_service_exists': 'No',
        'imnci_staff': [],
    }), [initialState, initialLocality, initialName]);

    const handleSaveFacility = async (formData) => {
        setIsSubmitting(true);
        try {
            const submitterIdentifier = 'Participant Form - New Facility';
            const { id, ...dataToSubmit } = formData;
            if (!dataToSubmit['اسم_المؤسسة'] || !dataToSubmit['الولاية'] || !dataToSubmit['المحلية']) {
                throw new Error("Facility Name, State, and Locality are required.");
            }
             dataToSubmit.imnci_staff = Array.isArray(dataToSubmit.imnci_staff) ? dataToSubmit.imnci_staff : [];
            await submitFacilityDataForApproval(dataToSubmit, submitterIdentifier);
            if (setToast) setToast({ show: true, message: "New facility submitted for approval.", type: 'info' });
            onSaveSuccess({ id: `pending_${Date.now()}`, ...dataToSubmit });
            onClose();
        } catch (error) {
            console.error("Failed to submit new facility:", error);
            if (setToast) setToast({ show: true, message: `Error submitting facility: ${error.message}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Health Facility">
             <div className="p-1 max-h-[80vh] overflow-y-auto">
                <GenericFacilityForm
                    initialData={facilityInitialData}
                    onSave={handleSaveFacility}
                    onCancel={onClose}
                    setToast={setToast}
                    title="بيانات المنشأة الصحية الجديدة"
                    subtitle={`Adding a new facility in ${STATE_LOCALITIES[initialState]?.ar || initialState}, ${STATE_LOCALITIES[initialState]?.localities.find(l=>l.en === initialLocality)?.ar || initialLocality}`}
                    isPublicForm={false}
                    saveButtonText="Submit New Facility for Approval"
                    isSubmitting={isSubmitting}
                >
                    {(props) => <IMNCIFormFields {...props} />}
                </GenericFacilityForm>
            </div>
        </Modal>
    );
};

// --- NEW COMPONENT: Test Scores Dashboard ---
const TestScoresDashboard = ({ 
    courseId,
    participants, 
    participantTests, 
    onOpenEntry,
    onEdit,
    onDelete,
    canManageTests
}) => {
    // Helper to get a specific test result
    const getTest = (participantId, type) => {
        return participantTests.find(t => t.participantId === participantId && t.testType === type);
    };

    // Helper for Percentage Styling
    const getScoreStyle = (percentage) => {
        if (percentage >= 80) return "text-green-700 font-bold bg-green-50 px-2 py-1 rounded";
        if (percentage >= 60) return "text-yellow-700 font-bold bg-yellow-50 px-2 py-1 rounded";
        return "text-red-700 font-bold bg-red-50 px-2 py-1 rounded";
    };

    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center">
                 <h2 className="text-xl font-bold text-gray-800">Test Scores Overview</h2>
                 <div className="flex gap-2">
                     <Button 
                        variant="secondary" 
                        className="inline-flex items-center gap-2"
                        onClick={() => { 
                            const link = `${window.location.origin}/public/test/course/${courseId}`; 
                            navigator.clipboard.writeText(link)
                                .then(() => alert('Public test link copied to clipboard!'))
                                .catch(() => alert('Failed to copy link.')); 
                        }} 
                        title="Copy public link for test entry"
                     >
                        <Share2 size={16} />
                        Share Test Form
                     </Button>
                     {canManageTests && (
                         <Button onClick={() => onOpenEntry('pre-test', null, true)}>
                             <PlusCircle size={16} className="mr-2" />
                             Register New Participant
                         </Button>
                     )}
                 </div>
             </div>

             <Table headers={["Name", "Group", "Pre-Test Result", "Post-Test Result"]}>
                {participants.length === 0 ? (
                    <tr><td colSpan="4" className="text-center p-4">No participants found.</td></tr>
                ) : (
                    participants.map(p => {
                        const preTest = getTest(p.id, 'pre-test');
                        const postTest = getTest(p.id, 'post-test');

                        return (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="p-4 border font-medium">{p.name}</td>
                                <td className="p-4 border">{p.group || '-'}</td>
                                
                                {/* Pre-Test Column */}
                                <td className="p-4 border">
                                    <div className="flex items-center gap-4">
                                        {preTest ? (
                                            <>
                                                <span className={getScoreStyle(preTest.percentage)}>
                                                    {preTest.percentage.toFixed(1)}%
                                                </span>
                                                <div className="flex gap-1">
                                                    <Button 
                                                        variant="icon" 
                                                        onClick={() => onEdit(p.id, 'pre-test')}
                                                        title="View/Edit Test"
                                                        className="text-gray-500 hover:text-blue-600"
                                                    >
                                                        <Eye size={18} />
                                                    </Button>
                                                    {canManageTests && (
                                                        <Button 
                                                            variant="icon" 
                                                            onClick={() => onDelete(p.id, 'pre-test')}
                                                            title="Delete Test"
                                                            className="text-gray-500 hover:text-red-600"
                                                        >
                                                            <Trash2 size={18} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            canManageTests ? (
                                                <Button 
                                                    size="sm" 
                                                    variant="secondary" 
                                                    onClick={() => onOpenEntry('pre-test', p.id)}
                                                    className="text-xs"
                                                >
                                                    + Add Score
                                                </Button>
                                            ) : <span className="text-gray-400">-</span>
                                        )}
                                    </div>
                                </td>

                                {/* Post-Test Column */}
                                <td className="p-4 border">
                                    <div className="flex items-center gap-4">
                                        {postTest ? (
                                            <>
                                                <span className={getScoreStyle(postTest.percentage)}>
                                                    {postTest.percentage.toFixed(1)}%
                                                </span>
                                                <div className="flex gap-1">
                                                    <Button 
                                                        variant="icon" 
                                                        onClick={() => onEdit(p.id, 'post-test')}
                                                        title="View/Edit Test"
                                                        className="text-gray-500 hover:text-blue-600"
                                                    >
                                                        <Eye size={18} />
                                                    </Button>
                                                    {canManageTests && (
                                                        <Button 
                                                            variant="icon" 
                                                            onClick={() => onDelete(p.id, 'post-test')}
                                                            title="Delete Test"
                                                            className="text-gray-500 hover:text-red-600"
                                                        >
                                                            <Trash2 size={18} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            canManageTests ? (
                                                <Button 
                                                    size="sm" 
                                                    variant="secondary" 
                                                    onClick={() => onOpenEntry('post-test', p.id)}
                                                    className="text-xs"
                                                >
                                                    + Add Score
                                                </Button>
                                            ) : <span className="text-gray-400">-</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })
                )}
             </Table>
        </div>
    );
};

// --- NEW COMPONENT: Facility Selection Popup ---
const FacilitySelectionModal = ({ 
    isOpen, 
    onClose, 
    options, 
    onSelect
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Reset search when modal opens
    useEffect(() => {
        if (isOpen) setSearchTerm('');
    }, [isOpen]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(opt => 
            opt.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Health Facility">
            <div className="p-4 flex flex-col h-[60vh]">
                <div className="mb-4">
                    <Input 
                        placeholder="Search for a facility..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto border rounded-md divide-y">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <button
                                key={opt.id}
                                className="w-full text-left p-3 hover:bg-sky-50 transition-colors focus:outline-none focus:bg-sky-50"
                                onClick={() => {
                                    onSelect(opt);
                                    onClose();
                                }}
                            >
                                {opt.name}
                            </button>
                        ))
                    ) : (
                        <div className="p-4 text-center text-gray-500">
                            No facilities found matching "{searchTerm}"
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export function CourseTestForm({ 
    course, 
    participants, 
    participantTests, 
    onSave, 
    onCancel, 
    initialParticipantId = '',
    onSaveTest,
    onSaveParticipant, 
    isPublicView = false,
    canManageTests = false,
    testType: initialTestType
}) {
    // --- MAIN STATE: Controls View Mode (Dashboard vs Entry Form) ---
    // If it's a public view, default to 'entry'. If admin view, default to 'dashboard'
    const [viewMode, setViewMode] = useState(isPublicView ? 'entry' : 'dashboard'); 

    const { testQuestions, testTitle, isRtl, jobTitleOptions, isIccm } = useMemo(() => {
        let titles = [];
        let isIccm = false;
        if (course.course_type === 'ETAT') {
             titles = JOB_TITLES_ETAT;
             return { 
                 testQuestions: ETAT_TEST_QUESTIONS, 
                 testTitle: 'ETAT Pre/Post Test Entry', 
                 isRtl: false, 
                 jobTitleOptions: titles, 
                 isIccm: false 
             };
        }

        if (course.course_type === 'ICCM') {
            titles = ["طبيب", "مساعد طبي", "ممرض معالج", "معاون صحي", "كادر معاون"];
            isIccm = true;
            return { testQuestions: ICCM_TEST_QUESTIONS, testTitle: 'ICCM Pre/Post Test Entry', isRtl: true, jobTitleOptions: titles, isIccm: isIccm };
        }
        if (course.course_type === 'EENC') {
            titles = JOB_TITLES_EENC;
            return { testQuestions: EENC_TEST_QUESTIONS, testTitle: 'EENC Pre/Post Test Entry', isRtl: false, jobTitleOptions: titles, isIccm: isIccm };
        }
        if (course.course_type === 'Small & Sick Newborn') {
            titles = JOB_TITLES_EENC; // Using EENC titles as default for SSNB
            return { testQuestions: SSNB_WARMER_TEST_QUESTIONS, testTitle: 'SSNB Portable Warmer Test', isRtl: true, jobTitleOptions: titles, isIccm: false };
        }
        if (course.course_type === 'IMNCI') {
             titles = JOB_TITLES_EENC; // Use generic EENC titles (Doctor, Nurse, etc) for IMNCI
             return { testQuestions: IMNCI_TEST_QUESTIONS, testTitle: 'IMNCI Pre/Post Test Entry', isRtl: false, jobTitleOptions: titles, isIccm: false };
        }
        return { testQuestions: [], testTitle: 'Test Entry', isRtl: false, jobTitleOptions: [], isIccm: false }; 
    }, [course.course_type]);

    const [selectedParticipantId, setSelectedParticipantId] = useState(initialParticipantId);
    
    // --- UPDATED: If initialTestType provided (from public link params), use it. Default to 'pre-test' ---
    const [testType, setTestType] = useState(initialTestType || 'pre-test'); 
    
    const [answers, setAnswers] = useState(() => initializeAnswers(testQuestions));
    
    // --- Manual Grading State ---
    const [manualScores, setManualScores] = useState({});

    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [submissionResult, setSubmissionResult] = useState(null);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(true); 
    const [selectedSetupGroup, setSelectedSetupGroup] = useState(''); 
    const [isEditing, setIsEditing] = useState(false);
    const [isNewParticipantModalOpen, setIsNewParticipantModalOpen] = useState(false);
    const [localParticipants, setLocalParticipants] = useState(participants);

    // --- NEW STATE for Facility Selector ---
    const [isFacilitySelectorOpen, setIsFacilitySelectorOpen] = useState(false);
    
    // --- NEW STATE for Success Popups ---
    const [showParticipantSuccessModal, setShowParticipantSuccessModal] = useState(false);
    const [showTestSubmitSuccessModal, setShowTestSubmitSuccessModal] = useState(false);
    const [lastSubmissionStats, setLastSubmissionStats] = useState(null);

    // --- UPDATED: Update testType if prop changes (e.g. navigation via link with different param) ---
    useEffect(() => {
        if (initialTestType) {
            setTestType(initialTestType);
        }
    }, [initialTestType]);

    useEffect(() => { setLocalParticipants(participants); }, [participants]);

    const uniqueGroups = useMemo(() => {
        const groupSet = new Set(localParticipants.map(p => p.group).filter(Boolean));
        return Array.from(groupSet).sort();
    }, [localParticipants]);

    const sortedParticipants = useMemo(() => {
        // Defensive check: Filter out any invalid participants (null, undefined, missing name) to prevent crash
        return [...localParticipants]
            .filter(p => p && p.name) 
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [localParticipants]);

    const filteredSetupParticipants = useMemo(() => {
        let filtered = sortedParticipants;
        if (selectedSetupGroup) filtered = filtered.filter(p => p.group === selectedSetupGroup);
        return filtered;
    }, [sortedParticipants, selectedSetupGroup]);

    const [newParticipantState, setNewParticipantState] = useState(course.state || '');
    const [newParticipantLocality, setNewParticipantLocality] = useState(course.locality || '');
    const [newParticipantCenter, setNewParticipantCenter] = useState('');
    const [selectedFacilityId, setSelectedFacilityId] = useState(null);
    const [facilitiesInLocality, setFacilitiesInLocality] = useState([]);
    const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
    const [isAddFacilityModalOpen, setIsAddFacilityModalOpen] = useState(false);
    const [newParticipantName, setNewParticipantName] = useState('');
    const [newParticipantPhone, setNewParticipantPhone] = useState('');
    const [newParticipantGroup, setNewParticipantGroup] = useState('Group A');
    const [newParticipantJob, setNewParticipantJob] = useState('');
    const [newParticipantJobOther, setNewParticipantJobOther] = useState('');
    const [isParticipantInfoSaved, setIsParticipantInfoSaved] = useState(false);
    const [participantNameForDisplay, setParticipantNameForDisplay] = useState('');
    
    const existingResults = useMemo(() => {
        const results = { 'pre-test': null, 'post-test': null };
        if (!selectedParticipantId || !participantTests) return results;
        for (const test of participantTests) {
            if (test.participantId === selectedParticipantId) {
                if (test.testType === 'pre-test') results['pre-test'] = test; 
                if (test.testType === 'post-test') results['post-test'] = test; 
            }
        }
        return results;
    }, [selectedParticipantId, participantTests]);

    // Handle "View/Edit" click from Dashboard
    const handleDashboardEdit = (pId, type) => {
        setSelectedParticipantId(pId);
        setTestType(type);
        setViewMode('entry');
        
        // Find existing result to load
        const result = participantTests.find(t => t.participantId === pId && t.testType === type);
        if (result) {
            setAnswers(result.answers || initializeAnswers(testQuestions));
            setManualScores(initializeManualScores(testQuestions, result.manualScores));
            setIsEditing(true);
            setIsSetupModalOpen(false); // Skip modal, go straight to form
        }
    };

    // Handle "Add Score" click from Dashboard
    const handleDashboardAdd = (type, pId = null, isNewUser = false) => {
        setTestType(type);
        if (isNewUser) {
             setIsNewParticipantModalOpen(true);
             setSelectedParticipantId('');
        } else {
             setSelectedParticipantId(pId);
        }
        setViewMode('entry');
        setIsEditing(false);
        setIsSetupModalOpen(isNewUser ? false : true); // If add existing, confirm in modal (or skip if we want direct entry)
        if(pId && !isNewUser) setIsSetupModalOpen(false); // Direct entry if ID known
        setAnswers(initializeAnswers(testQuestions));
        setManualScores(initializeManualScores(testQuestions)); // Initialize fresh scores
        setSubmissionResult(null);
    };

    const handleDashboardDelete = async (pId, type) => {
        if (!window.confirm(`Are you sure you want to delete the ${type} result?`)) return;
        try {
            await deleteParticipantTest(course.id, pId, type);
            // Trigger parent refresh
            const refreshPayload = { participantId: pId, deleted: true };
            if (onSaveTest) await onSaveTest(refreshPayload); else onSave(refreshPayload);
        } catch (err) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    // --- EFFECT HOOKS ---

    useEffect(() => {
        if (!isPublicView && viewMode === 'entry' && selectedParticipantId && selectedParticipantId !== 'addNew' && !isEditing) {
            // Auto-detect test type logic only if not explicitly set by dashboard action
            // (We skip this if coming from Dashboard Actions usually)
        }
    }, [isPublicView, selectedParticipantId, existingResults, viewMode, isEditing]);

    useEffect(() => {
        if (!isEditing) {
            setAnswers(initializeAnswers(testQuestions));
        }
        setError('');
        setSubmissionResult(null); 
    }, [selectedParticipantId, testType, testQuestions, isEditing]); 

    useEffect(() => {
        setIsParticipantInfoSaved(false); 
        setParticipantNameForDisplay(''); 
        setNewParticipantName(''); setNewParticipantPhone(''); setNewParticipantState(course.state || ''); setNewParticipantLocality(course.locality || ''); setNewParticipantCenter(''); setSelectedFacilityId(null); setFacilitiesInLocality([]); setNewParticipantGroup('Group A'); setNewParticipantJob(''); setNewParticipantJobOther('');
    }, [testType, isPublicView, course.state, course.locality]); 

    useEffect(() => {
        const fetchFacilities = async () => {
            setError('');
            if (newParticipantState && newParticipantLocality && !isIccm) {
                setIsLoadingFacilities(true);
                try {
                    const facilities = await listHealthFacilities({ state: newParticipantState, locality: newParticipantLocality }, 'server');
                    setFacilitiesInLocality(facilities);
                } catch (err) { setError("Failed to load health facilities."); setFacilitiesInLocality([]); } finally { setIsLoadingFacilities(false); }
            } else { setFacilitiesInLocality([]); setIsLoadingFacilities(false); }
        };
        if (isNewParticipantModalOpen) fetchFacilities();
    }, [newParticipantState, newParticipantLocality, isIccm, isNewParticipantModalOpen]);

    useEffect(() => {
        if (selectedParticipantId && selectedParticipantId !== 'addNew') {
            const participant = localParticipants.find(p => p.id === selectedParticipantId);
            if (participant) setParticipantNameForDisplay(participant.name);
        }
    }, [selectedParticipantId, localParticipants]);

    // --- HANDLERS ---

    const handleSetupGroupChange = (e) => {
        setSelectedSetupGroup(e.target.value);
        setSelectedParticipantId(''); 
    };

    const handleParticipantSelectChange = (e) => {
        const val = e.target.value;
        if (val === 'addNew') {
            setIsNewParticipantModalOpen(true);
            setSelectedParticipantId(''); 
        } else {
            setSelectedParticipantId(val);
        }
    };

    const handleRadioChange = (questionId, answerId) => {
        setAnswers(prev => ({ ...prev, [questionId]: answerId }));
    };

    const handleTextChange = (questionId, lineIndex, textValue) => {
        setAnswers(prev => ({ ...prev, [questionId]: prev[questionId].map((item, i) => (i === lineIndex ? textValue : item)) }));
    };

    // --- UPDATED: Handle Manual Scoring per Line ---
    const handleLineScoreChange = (questionId, lineIndex, score) => {
        setManualScores(prev => {
            // Ensure we have an array for this question
            const currentScores = prev[questionId] ? [...prev[questionId]] : Array(testQuestions.find(q=>q.id === questionId).lines).fill(0);
            currentScores[lineIndex] = score; // Set 1 for Correct, 0 for Wrong
            return { ...prev, [questionId]: currentScores };
        });
    };

    // MODIFIED: Updated handler to accept the facility object directly from the new modal
    const handleFacilitySelect = (facility) => {
        setError('');
        // No need to check for 'addNewFacility' string here anymore, handled by specific button
        setSelectedFacilityId(facility.id);
        setNewParticipantCenter(facility.name); // or facility['اسم_المؤسسة'] depending on object passed
    };

    const handleNewFacilitySaved = (newlySubmittedFacilityData) => {
        const representation = { id: newlySubmittedFacilityData.id, 'اسم_المؤسسة': newlySubmittedFacilityData['اسم_المؤسسة'] };
        setFacilitiesInLocality(prev => [...prev, representation]);
        setSelectedFacilityId(representation.id);
        setNewParticipantCenter(representation['اسم_المؤسسة']);
        setIsAddFacilityModalOpen(false); 
    };
    
    // UPDATED: Removed "Add New" from options list
    const facilityOptionsForSelect = useMemo(() => {
        if (isIccm) return [];
        const options = (facilitiesInLocality || []).map(f => ({ id: f.id, name: f['اسم_المؤسسة'] }));
        // Removed: options.unshift({ id: 'addNewFacility', name: "+ Add New Facility..." });
        return options;
    }, [facilitiesInLocality, isIccm]);

    const handleSaveParticipantInfo = async () => {
        if (!onSaveParticipant) { setError("Participant saving function is not provided."); return; }
        setError(''); setIsSaving(true);
        try {
            const finalJobTitle = newParticipantJob === 'Other' ? newParticipantJobOther : newParticipantJob;
            const centerNameLabel = isIccm ? 'Village Name' : 'Facility Name';
            if (!newParticipantState) throw new Error('State is required.');
            if (!newParticipantLocality) throw new Error('Locality is required.');
            if (!newParticipantCenter.trim()) throw new Error(`${centerNameLabel} is required.`);
            if (!newParticipantName.trim()) throw new Error('New Participant Name is required.');
            if (!finalJobTitle) throw new Error('New Participant Job Title is required.');
            if (!newParticipantPhone.trim()) throw new Error('New Participant Phone Number is required.');
            
            const participantPayload = {
                name: newParticipantName.trim(),
                phone: newParticipantPhone.trim(),
                job_title: finalJobTitle,
                group: newParticipantGroup,
                state: newParticipantState, 
                locality: newParticipantLocality, 
                center_name: newParticipantCenter.trim(),
                courseId: course.id,
                facilityId: (isIccm || (selectedFacilityId && selectedFacilityId.startsWith('pending_'))) ? null : selectedFacilityId,
                ...(isIccm && { trained_before: false, last_imci_training: null, nearest_health_facility: null, hours_to_facility: null })
            };
            
            const savedData = await onSaveParticipant(participantPayload, null);
            
            const safeParticipantForState = {
                ...participantPayload,
                id: savedData?.id || savedData 
            };
            
            if (!safeParticipantForState.id) throw new Error("Participant saved, but no ID was returned. Please refresh.");

            setLocalParticipants(prev => [...prev, safeParticipantForState]);
            setSelectedParticipantId(safeParticipantForState.id); 
            setParticipantNameForDisplay(safeParticipantForState.name); 
            
            setAnswers(initializeAnswers(testQuestions));
            if (!testType) setTestType('pre-test'); 
            
            setIsParticipantInfoSaved(true); 
            setIsNewParticipantModalOpen(false);
            // MODIFIED: Do NOT close setup modal yet, show success modal instead
            // setIsSetupModalOpen(false); 
            setShowParticipantSuccessModal(true);
        } catch (err) { setError(`Failed to save participant: ${err.message}`); } finally { setIsSaving(false); }
    };

    const handleEditTest = () => {
        const resultToEdit = existingResults[testType];
        if (resultToEdit) {
            setAnswers(resultToEdit.answers || initializeAnswers(testQuestions));
            setManualScores(initializeManualScores(testQuestions, resultToEdit.manualScores));
            setIsEditing(true);
            setSubmissionResult(null); // Clear result screen to show form
        }
    };

    const handleDeleteTest = async () => {
        if (!window.confirm("Are you sure you want to delete this test record?")) return;
        setIsSaving(true);
        try {
            await deleteParticipantTest(course.id, selectedParticipantId, testType);
            const refreshPayload = { participantId: selectedParticipantId, deleted: true };
            if (onSaveTest) await onSaveTest(refreshPayload); else onSave(refreshPayload);
            
            // Go back to Dashboard after delete
            setViewMode('dashboard');
            setIsEditing(false);
            setSubmissionResult(null);
            setSelectedParticipantId('');
        } catch (err) { setError(`Failed to delete test: ${err.message}`); } finally { setIsSaving(false); }
    };

    const handleSubmit = async () => {
        setError('');
        if (!selectedParticipantId) { setError('A participant must be selected or saved before submitting the test.'); return; }
        
        const mcQuestions = testQuestions.filter(q => q.type === 'mc');
        const unanswered = mcQuestions.filter(q => !answers[q.id]);
        
        // Only block if it is public view (user taking test), otherwise allow partial updates by admin
        if (isPublicView && unanswered.length > 0) { setError(`Please answer all multiple-choice questions.`); return; }
        
        setIsSaving(true);
        try {
            // 1. Calculate MCQ Score
            const scorableQuestions = testQuestions.filter(q => q.type === 'mc');
            let correctMCQ = 0;
            scorableQuestions.forEach(q => { if (answers[q.id] === q.correctAnswer) correctMCQ++; });
            
            // 2. Calculate Manual Score (Open Ended)
            let manualTotal = 0;
            let openQuestionsTotalLines = 0;
            
            const openQuestions = testQuestions.filter(q => q.type === 'open');
            openQuestions.forEach(q => {
                openQuestionsTotalLines += q.lines;
                
                const qScores = manualScores[q.id];
                if (Array.isArray(qScores)) {
                    // Sum up 1s and 0s in the array
                    manualTotal += qScores.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
                }
            });

            // 3. Total Score Calculation
            // Total points = Number of MCQs (1 pt each) + Total number of lines in open questions (1 pt each)
            const total = scorableQuestions.length + openQuestionsTotalLines; 
            const finalScore = correctMCQ + manualTotal;
            const percentage = total > 0 ? (finalScore / total) * 100 : 0;

            const payload = {
                participantId: selectedParticipantId, 
                participantName: participantNameForDisplay, 
                courseId: course.id,
                courseType: course.course_type,
                testType: testType,
                answers: answers, 
                manualScores: manualScores,
                score: finalScore,
                total: total,
                percentage: percentage,
                submittedAt: new Date().toISOString()
            };
            if (onSaveTest) await onSaveTest(payload); else await new Promise(resolve => setTimeout(resolve, 1000));
            // MODIFIED: Instead of setting submissionResult immediately (which changes view), show success modal first
            // setSubmissionResult(payload); 
            setLastSubmissionStats(payload);
            setShowTestSubmitSuccessModal(true);
            setIsEditing(false); 
        } catch (err) { setError(`Failed to save test: ${err.message}`); } finally { setIsSaving(false); }
    };

    const handleBackToDashboard = () => {
        if(isPublicView) {
            setIsSetupModalOpen(true);
            setTestType(initialTestType || ''); // Reset to initial prop value if exists, else empty
            setSelectedParticipantId('');
        } else {
            setViewMode('dashboard');
            setIsEditing(false);
            setSubmissionResult(null);
            setSelectedParticipantId('');
        }
    };

    // --- RENDER LOGIC ---
    
    // 1. DASHBOARD VIEW (Default for Admin)
    if (viewMode === 'dashboard' && !isPublicView) {
        return (
            <Card>
                <div className="p-6">
                    <TestScoresDashboard 
                        courseId={course.id}
                        participants={sortedParticipants}
                        participantTests={participantTests}
                        canManageTests={canManageTests}
                        onOpenEntry={handleDashboardAdd}
                        onEdit={handleDashboardEdit}
                        onDelete={handleDashboardDelete}
                    />
                    <div className="mt-4 border-t pt-4">
                        <Button variant="secondary" onClick={onCancel}>Back to Course</Button>
                    </div>
                </div>
            </Card>
        );
    }

    // 2. RESULT SCREEN
    if (submissionResult) {
        return (
            <TestResultScreen
                participantName={submissionResult.participantName}
                testType={submissionResult.testType}
                score={submissionResult.score}
                total={submissionResult.total}
                percentage={submissionResult.percentage}
                onBack={handleBackToDashboard}
                canManageTests={canManageTests}
                onEdit={() => { setSubmissionResult(null); setIsEditing(true); }}
                onDelete={handleDeleteTest}
            />
        );
    }
    
    // 3. EXISTING RESULT (When entering Edit mode)
    const existingTestResult = existingResults[testType];
    if (!isSetupModalOpen && existingTestResult && !isNewParticipantModalOpen && !isEditing && viewMode === 'entry') {
        // If we are in entry mode but not editing, and result exists, show result screen
        // (This happens if we select a participant in setup who already has a score)
        const participantName = localParticipants.find(p => p.id === existingTestResult.participantId)?.name || 'Participant';
        return (
            <TestResultScreen
                participantName={participantName}
                testType={existingTestResult.testType}
                score={existingTestResult.score}
                total={existingTestResult.total}
                percentage={existingTestResult.percentage}
                onBack={handleBackToDashboard}
                canManageTests={canManageTests}
                onEdit={handleEditTest}
                onDelete={handleDeleteTest}
                isExistingResult={true} 
            />
        );
    }

    if (testQuestions.length === 0) return <Card><div className="p-6">No questions</div></Card>;
    const centerNameLabel = isIccm ? "Village Name" : "Facility Name";
    const showQuestions = !isSetupModalOpen; 
    const submitDisabled = isSaving || !showQuestions;

    // 4. ENTRY FORM (Questions)
    return (
        <Card>
            {/* SETUP MODAL: Choose Test Type and Participant (Always First) */}
            <Modal isOpen={isSetupModalOpen && !isNewParticipantModalOpen && viewMode === 'entry'} onClose={handleBackToDashboard} title="Select Test Details" size="lg">
                <CardBody className="p-6">
                    <div className="grid gap-6">
                        <FormGroup label="Select Test Type">
                            <Select 
                                value={testType} 
                                onChange={(e) => setTestType(e.target.value)}
                                disabled={!!initialTestType} // Disable if type is forced by public link
                            >
                                <option value="">-- Select Test Type --</option>
                                <option value="pre-test">Pre-Test</option>
                                <option value="post-test">Post-Test</option>
                            </Select>
                        </FormGroup>

                        {/* Only show participant select if not pre-selected by Dashboard */}
                        {((isPublicView && testType) || !isPublicView) && (
                            <>
                                <FormGroup label="Select Group (Optional)">
                                    <Select value={selectedSetupGroup} onChange={handleSetupGroupChange}>
                                        <option value="">-- All Groups --</option>
                                        {uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}
                                    </Select>
                                </FormGroup>

                                <FormGroup label="Select Participant">
                                    <Select value={selectedParticipantId} onChange={handleParticipantSelectChange}>
                                        <option value="">-- Select a Participant --</option>
                                        {/* Only show Add New if onSaveParticipant exists AND testType is pre-test */}
                                        {onSaveParticipant && testType === 'pre-test' && (
                                            <option value="addNew" className="font-bold text-sky-600">
                                                + Register New Participant
                                            </option>
                                        )}
                                        {filteredSetupParticipants.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.group})</option>
                                        ))}
                                    </Select>
                                </FormGroup>
                            </>
                        )}
                    </div>
                </CardBody>
                <CardFooter className="p-4 border-t flex justify-end gap-3">
                    <Button variant="secondary" onClick={handleBackToDashboard}>Cancel</Button>
                    <Button onClick={() => setIsSetupModalOpen(false)} disabled={!testType || !selectedParticipantId}>Start</Button>
                </CardFooter>
            </Modal>

            {/* REGISTER NEW PARTICIPANT MODAL */}
            {/* Note: This comes second, so it sits on top of SetupModal if both were open (unlikely), but crucially acts as the "base" for the subsequent popups */}
            <Modal isOpen={isNewParticipantModalOpen} onClose={() => setIsNewParticipantModalOpen(false)} title="Register New Participant" size="2xl">
                 <div className="p-4 border-b">
                     <h3 className="text-lg font-medium">New Participant Information</h3>
                     <p className="text-sm text-gray-500">Please fill out the details below.</p>
                 </div>
                 <CardBody className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}>
                            <FormGroup label="State">
                                <Select value={newParticipantState} onChange={(e) => {
                                    setNewParticipantState(e.target.value); setNewParticipantLocality(''); setNewParticipantCenter(''); setSelectedFacilityId(null); setFacilitiesInLocality([]); 
                                }}><option value="">— Select State —</option>{Object.keys(STATE_LOCALITIES).sort((a,b) => STATE_LOCALITIES[a].ar.localeCompare(STATE_LOCALITIES[b].ar)).map(s => <option key={s} value={s}>{STATE_LOCALITIES[s].ar}</option>)}</Select>
                            </FormGroup>
                            <FormGroup label="Locality">
                                <Select value={newParticipantLocality} onChange={(e) => { setNewParticipantLocality(e.target.value); setNewParticipantCenter(''); setSelectedFacilityId(null); }} disabled={!newParticipantState}>
                                    <option value="">— Select Locality —</option>{(STATE_LOCALITIES[newParticipantState]?.localities || []).sort((a,b) => a.ar.localeCompare(b.ar)).map(l => <option key={l.en} value={l.en}>{l.ar}</option>)}</Select>
                            </FormGroup>
                             <FormGroup label="Group">
                                <Select value={newParticipantGroup} onChange={(e) => setNewParticipantGroup(e.target.value)}><option>Group A</option><option>Group B</option><option>Group C</option><option>Group D</option></Select>
                            </FormGroup>
                            
                            {/* FACILITY SELECTION UI */}
                            {isIccm ? (
                                <FormGroup label={centerNameLabel}>
                                    <Input value={newParticipantCenter} onChange={(e) => setNewParticipantCenter(e.target.value)} placeholder={`Enter ${centerNameLabel}`} disabled={!newParticipantLocality} />
                                </FormGroup>
                            ) : (
                                <FormGroup label={centerNameLabel}>
                                    <div 
                                        onClick={() => {
                                            if (!isLoadingFacilities && newParticipantLocality) {
                                                setIsFacilitySelectorOpen(true);
                                            }
                                        }}
                                        className={`
                                            w-full border rounded-md p-2 flex justify-between items-center bg-white 
                                            ${(!newParticipantLocality || isLoadingFacilities) ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'cursor-pointer hover:border-blue-400'}
                                        `}
                                    >
                                        <span className="truncate">
                                            {isLoadingFacilities 
                                                ? "Loading..." 
                                                : (!newParticipantLocality 
                                                    ? "Select Locality first" 
                                                    : (newParticipantCenter || "Click to search facility...")
                                                )
                                            }
                                        </span>
                                        <span className="text-gray-400 ml-2">🔍</span>
                                    </div>
                                    {/* Hidden input to ensure logic relying on selectedFacilityId still works if needed, though state is managed directly */}
                                </FormGroup>
                            )}

                            <FormGroup label="Participant Name"><Input value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="Enter name" /></FormGroup>
                            <FormGroup label="Phone Number"><Input type="tel" value={newParticipantPhone} onChange={(e) => setNewParticipantPhone(e.target.value)} /></FormGroup>
                            <FormGroup label="Job Title"><Select value={newParticipantJob} onChange={(e) => setNewParticipantJob(e.target.value)}><option value="">— Select Job —</option>{jobTitleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}<option value="Other">Other</option></Select></FormGroup>
                            {newParticipantJob === 'Other' && (<FormGroup label="Specify Job Title"><Input value={newParticipantJobOther} onChange={(e) => setNewParticipantJobOther(e.target.value)} placeholder="Please specify" /></FormGroup>)}
                        </div>
                 </CardBody>
                 <CardFooter className="p-4 border-t flex justify-end gap-3">
                     <Button variant="secondary" onClick={() => setIsNewParticipantModalOpen(false)} disabled={isSaving}>Cancel</Button>
                     <Button onClick={handleSaveParticipantInfo} disabled={isSaving}>{isSaving ? <Spinner /> : "Save Participant"}</Button>
                 </CardFooter>
            </Modal>

            {/* FACILITY SELECTION POPUP */}
            {/* Defined AFTER NewParticipantModal so it renders ON TOP of it */}
            <FacilitySelectionModal 
                isOpen={isFacilitySelectorOpen}
                onClose={() => setIsFacilitySelectorOpen(false)}
                options={facilityOptionsForSelect}
                onSelect={handleFacilitySelect}
            />

            {/* ADD FACILITY MODAL */}
            {/* Defined LAST so it renders ON TOP of everything if needed */}
            <AddFacilityModal
                isOpen={isAddFacilityModalOpen}
                onClose={() => setIsAddFacilityModalOpen(false)}
                onSaveSuccess={handleNewFacilitySaved}
                initialState={newParticipantState}
                initialLocality={newParticipantLocality}
                initialName={newParticipantCenter} 
                setToast={(toastConfig) => setError(toastConfig.message)} 
            />

            {/* NEW: PARTICIPANT SUCCESS MODAL */}
            <Modal isOpen={showParticipantSuccessModal} onClose={() => {}} title="Registration Successful" size="sm">
                <div className="p-6 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Participant Registered!</h3>
                    <p className="text-gray-500 mb-6">
                        {participantNameForDisplay} has been successfully registered to the course.
                    </p>
                    <Button 
                        className="w-full justify-center" 
                        onClick={() => {
                            setShowParticipantSuccessModal(false);
                            setIsSetupModalOpen(false); // Close setup to reveal questions
                        }}
                    >
                        Start Pre-Test
                    </Button>
                </div>
            </Modal>

            {/* NEW: TEST SUBMIT SUCCESS MODAL */}
            <Modal isOpen={showTestSubmitSuccessModal} onClose={() => {}} title="Test Submitted" size="sm">
                <div className="p-6 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Submission Successful!</h3>
                    
                    {course.course_type !== 'ETAT' ? (
                        lastSubmissionStats && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <p className="text-sm text-gray-500 mb-1">Score Achieved</p>
                                <div className="text-3xl font-bold text-gray-800">
                                    {lastSubmissionStats.percentage.toFixed(1)}%
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    ({lastSubmissionStats.score} out of {lastSubmissionStats.total} Total Points)
                                </p>
                            </div>
                        )
                    ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-800">
                                Your test has been submitted for manual grading. Your score will be available once reviewed by a facilitator.
                            </p>
                        </div>
                    )}
                    
                    <Button 
                        className="w-full justify-center" 
                        onClick={() => {
                            setShowTestSubmitSuccessModal(false);
                            // If ETAT, don't show result screen, just go back
                            if (course.course_type === 'ETAT') {
                                handleBackToDashboard();
                            } else {
                                setSubmissionResult(lastSubmissionStats); 
                            }
                        }}
                    >
                        {course.course_type === 'ETAT' ? 'Return to Dashboard' : 'View Result Details'}
                    </Button>
                </div>
            </Modal>

            {!isSetupModalOpen && !submissionResult && (
                <div className="p-6">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                        <PageHeader 
                            title={`${isEditing ? 'Editing' : 'Enter'} ${testType === 'pre-test' ? 'Pre-Test' : 'Post-Test'}`} 
                            subtitle={`${participantNameForDisplay || 'Unknown Participant'} - ${course.course_type}`} 
                            className="p-0 m-0" 
                        />
                        <div><Button variant="secondary" onClick={() => { const link = `${window.location.origin}/public/test/course/${course.id}`; navigator.clipboard.writeText(link).then(() => alert('Link copied!')).catch(() => alert('Failed to copy.')); }} title="Copy link">Share Test Form</Button></div>
                    </div>
                    
                    {error && <div className="p-3 my-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

                    {/* Grading Mode Banner */}
                    {isEditing && canManageTests && (
                        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 mb-6 rounded-md flex justify-between items-center mt-4">
                            <div className="font-semibold flex items-center gap-2">
                                <Edit size={20} />
                                <span>Grading Mode Enabled</span>
                            </div>
                            <div className="text-sm">
                                Review answers and use the checks/crosses to grade open-ended questions.
                            </div>
                        </div>
                    )}

                    <hr className="my-6" />

                    <fieldset disabled={isSaving}>
                        <legend className="text-xl font-semibold mb-4 text-gray-800">Test Questions</legend>
                        {isEditing && !canManageTests && <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 mb-4 rounded-md font-semibold">Editing existing {testType} submission.</div>}
                        <div className="space-y-6" style={{ direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}>
                            {testQuestions.map((q) => (
                                <div key={q.id} className={`p-4 border rounded-md shadow-sm ${isEditing && canManageTests && q.type === 'open' ? 'bg-blue-50/30 border-blue-200' : 'bg-white'}`}>
                                    {/* Question Header */}
                                    <div className="flex justify-between items-start mb-3">
                                        <label className="block text-base font-semibold text-gray-800 w-3/4">{q.text}</label>
                                        
                                        {/* Auto-Grade Badge for MCQs */}
                                        {canManageTests && isEditing && q.type === 'mc' && (
                                            <div className={`px-2 py-1 rounded text-xs font-bold border ${answers[q.id] === q.correctAnswer ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                {answers[q.id] === q.correctAnswer ? 'Correct (+1)' : 'Incorrect (0)'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Question Body (Inputs) */}
                                    {q.imageSrc && <div className="my-3"><img src={q.imageSrc} alt="Visual" className="max-w-full h-auto rounded-lg border border-gray-200" /></div>}
                                    
                                    {q.type === 'mc' && (<div className="flex flex-col gap-2 mt-2">{q.options.map(opt => (<label key={opt.id} className="flex items-center gap-3 p-2 rounded hover:bg-sky-50 cursor-pointer"><input type="radio" name={q.id} value={opt.id} checked={answers[q.id] === opt.id} onChange={() => handleRadioChange(q.id, opt.id)} className="w-4 h-4" /><span className="text-sm text-gray-700">{opt.text}</span></label>))}</div>)}
                                    
                                    {/* Open-Ended Question Rendering with Grading UI */}
                                    {q.type === 'open' && (
                                        <div className="flex flex-col gap-3 mt-2">
                                            {Array.from({ length: q.lines }).map((_, index) => {
                                                const isGradingMode = canManageTests && isEditing;
                                                const currentScore = manualScores[q.id]?.[index] || 0; // Default 0 (Incorrect)

                                                return (
                                                    <div key={index} className="flex items-center gap-2 w-full">
                                                        {/* Answer Input - Takes Full Width */}
                                                        {/* Wrapper div to force flex expansion */}
                                                        <div className="flex-1 relative">
                                                            <Input 
                                                                type="text" 
                                                                placeholder={`Answer line ${index + 1}...`} 
                                                                value={answers[q.id]?.[index] || ''} 
                                                                onChange={(e) => handleTextChange(q.id, index, e.target.value)} 
                                                                className={`w-full transition-colors ${isGradingMode ? (currentScore === 1 ? 'border-green-400 bg-green-50/10' : 'border-red-300 bg-red-50/10') : ''}`}
                                                                style={{ width: '100%' }}
                                                            />
                                                        </div>

                                                        {/* Grading Controls - Right Side - Visible Only in Edit Mode for Admins */}
                                                        {isGradingMode && (
                                                            <div className="flex gap-1 shrink-0 ml-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLineScoreChange(q.id, index, 1)}
                                                                    className={`p-1.5 rounded-full border transition-all ${currentScore === 1 ? 'bg-green-100 border-green-500 text-green-600 ring-2 ring-green-200' : 'bg-white border-gray-200 text-gray-300 hover:border-green-300 hover:text-green-400'}`}
                                                                    title="Mark Correct (+1)"
                                                                >
                                                                    <Check size={16} strokeWidth={3} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLineScoreChange(q.id, index, 0)}
                                                                    className={`p-1.5 rounded-full border transition-all ${currentScore === 0 ? 'bg-red-100 border-red-500 text-red-600 ring-2 ring-red-200' : 'bg-white border-gray-200 text-gray-300 hover:border-red-300 hover:text-red-400'}`}
                                                                    title="Mark Incorrect (0)"
                                                                >
                                                                    <X size={16} strokeWidth={3} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {q.type === 'unsupported' && (<div className="p-3 text-sm text-gray-500 bg-gray-100 rounded-md">Unsupported question type.</div>)}
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    <div className="flex gap-2 justify-end mt-8 border-t pt-6">
                        <Button variant="secondary" onClick={handleBackToDashboard} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={submitDisabled}>
                            {isSaving ? <Spinner /> : (isEditing ? 'Save Grading & Score' : 'Submit & View Score')}
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}