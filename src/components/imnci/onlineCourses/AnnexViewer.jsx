// src/components/imnci/onlineCourses/AnnexViewer.jsx
//
// A course annex lesson (a standard operating procedure, a skill checklist, a
// chart booklet page ...) opened over the lesson that points to it, so the
// learner reads it when needed and closes it to carry on where they were.
// Loaded on demand: it draws the lesson with the same blocks as a lesson does.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, CardBody } from '../../CommonComponents';
import { sectionContent } from '../book';
import { ContentBlocks } from './blocks';

export default function AnnexViewer({ section, course, module, onClose }) {
    const { t } = useTranslation();
    if (!section && !module) return null;
    return (
        <Modal isOpen onClose={onClose} title={section?.title || module?.title || ''}>
            <CardBody className="p-4 sm:p-6" data-testid="annex-viewer">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-2">
                    {[course?.title, module?.title].filter(Boolean).join(' · ')}
                </div>
                {section
                    ? <ContentBlocks blocks={sectionContent(section)} />
                    : <p className="text-sm text-slate-600">{t('imnci_ui.courses.link.annex_module', 'Open a lesson of this annex from the course page.')}</p>}
            </CardBody>
        </Modal>
    );
}
