import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import '../src/i18n';
import { PrintModeProvider } from '../src/components/pdfPrint';
import { IMNCIFormRenderer, getInitialFormData } from '../src/components/mentorship/IMNCSkillsAssessmentForm.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// "Print / PDF" used to capture only what was on screen, so a new IMNCI
// skills form printed step 1 only, and questions that appear after an answer
// (classification, treatment for pneumonia, ...) were never on paper. In print
// mode the whole form is drawn, each conditional part with a note of when it
// appears.
const render = async (printAll) => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const formData = getInitialFormData();
    await act(async () => {
        root.render(
            <PrintModeProvider value={printAll}>
                <IMNCIFormRenderer formData={formData} visibleStep={1} scores={{}} handleFormChange={() => {}}
                    handleSkillChange={() => {}} handleMultiClassificationChange={() => {}} isEditing={false} />
            </PrintModeProvider>,
        );
    });
    const text = host.textContent;
    act(() => root.unmount());
    return { text };
};

describe('IMNCI skills form in print mode', () => {
    it('on screen, a new form shows only the first step', async () => {
        const { text } = await render(false);
        expect(text).toContain('وزن الطفل بصورة صحيحة');
        expect(text).not.toContain('في حالة الإلتهاب الرئوي');
        expect(text).not.toContain('يظهر فقط إذا');
    });

    it('for the PDF, every step and conditional question is drawn with its condition', async () => {
        const { text } = await render(true);
        // Later steps.
        expect(text).toContain('القرار النهائي');
        expect(text).toContain('تسجيل البيانات');
        // Conditional parts of a main symptom, with what brings them up.
        expect(text).toContain('هل يوجد كحة او ضيق تنفس (سؤال للمشرف)');
        expect(text).toContain('يظهر فقط إذا: الإجابة «نعم» على: هل سأل عن وجود الكحة أو ضيق التنفس');
        expect(text).toContain('ما هو التصنيف الصحيح؟');
        // Treatment sections that depend on the classification.
        expect(text).toContain('في حالة الإلتهاب الرئوي');
        expect(text).toContain('وتصنيف الكحة الصحيح هو «التهاب رئوي»');
        // A question that depends on the one before it.
        expect(text).toContain('الإجابة «نعم» على: هل وصف مضاد حيوي (أموكسيلين) لعلاج الالتهاب الرئوي بصورة صحيحة');
        expect(text).toContain('هل يتطابق قرار العامل الصحي مع المشرف؟');
    });
});
