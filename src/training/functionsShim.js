// src/training/functionsShim.js
//
// Every `import … from 'firebase/functions'` resolves here (vite.config.js).
// Outside training mode this is the real SDK. In training mode the Cloud
// Functions that act on real people or real records — push notifications,
// certificate e-mails, user roles — answer with an empty result instead of
// running, so practising never notifies, e-mails or changes anyone.
// Read-only helpers (AI answers, reports) still run.

import * as real from '@firebase/functions';
import { trainingCourseId } from './trainingSession.js';

export * from '@firebase/functions';

export const BLOCKED_IN_TRAINING = new Set([
    'sendFCMNotification',
    'sendCertificateEmails',
    'setUserRoles',
    // Its facility summary is built from the real list; the sandbox list is
    // used instead when this returns nothing.
    'facilityDashboardCopy',
]);

export function httpsCallable(functionsInstance, name, options) {
    if (trainingCourseId() && BLOCKED_IN_TRAINING.has(name)) {
        return async () => {
            console.info(`[training] ${name} skipped: training link, nothing real is sent or changed.`);
            return { data: {} };
        };
    }
    return real.httpsCallable(functionsInstance, name, options);
}
