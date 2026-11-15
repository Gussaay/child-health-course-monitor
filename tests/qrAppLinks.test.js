import { describe, it, expect, beforeEach } from 'vitest';
import { parseScannedCode, isPublicAppPath } from '../src/utils/appLinks';
import { findLinkedParticipant, rememberLinkedParticipant, samePhone } from '../src/utils/linkedParticipant';

describe('parseScannedCode', () => {
    it('opens a pre-test link from any of the app\'s addresses', () => {
        for (const host of ['imnci-courses-monitor.web.app', 'imnci-courses-monitor.firebaseapp.com', 'ch-sudan.web.app', 'emonc-sudan.web.app', 'com.nchp.monitoring.app', 'www.ch-sudan.web.app']) {
            const r = parseScannedCode(`https://${host}/public/test/course/abc123?type=pre-test`);
            expect(r).toMatchObject({ type: 'app', public: true, kind: 'test', testType: 'pre-test', path: '/public/test/course/abc123?type=pre-test' });
        }
    });

    it('reads links printed without https://', () => {
        expect(parseScannedCode('imnci-courses-monitor.web.app/public/evaluation/f1')).toMatchObject({ type: 'app', kind: 'evaluation', path: '/public/evaluation/f1' });
    });

    it('knows the other public pages', () => {
        expect(parseScannedCode('https://imnci-courses-monitor.web.app/attendance/course/c1?date=2026-11-12').kind).toBe('attendance');
        expect(parseScannedCode('https://imnci-courses-monitor.web.app/public/register/course/c1').kind).toBe('registration');
        expect(parseScannedCode('https://imnci-courses-monitor.web.app/verify/certificate/p1').kind).toBe('certificate');
        expect(parseScannedCode('https://imnci-courses-monitor.web.app/mentorship/submit/IMNCI').kind).toBe('mentorship');
        expect(parseScannedCode('https://imnci-courses-monitor.web.app/?view=dashboard')).toMatchObject({ kind: 'projects', public: true });
    });

    it('opens other app pages through the signed-in app', () => {
        expect(parseScannedCode('https://imnci-courses-monitor.web.app/courses?course=c1')).toMatchObject({ type: 'app', public: false, path: '/courses?course=c1' });
        expect(parseScannedCode('https://ch-sudan.web.app/?view=planning&plan=p1')).toMatchObject({ type: 'app', public: false });
    });

    it('leaves other addresses and plain text alone', () => {
        expect(parseScannedCode('https://example.com/public/test/course/x')).toEqual({ type: 'web', url: 'https://example.com/public/test/course/x' });
        expect(parseScannedCode('hello world')).toEqual({ type: 'text', text: 'hello world' });
    });

    it('matches App.jsx public prefixes', () => {
        expect(isPublicAppPath('/public/test/course/x')).toBe(true);
        expect(isPublicAppPath('/courses')).toBe(false);
    });
});

describe('linked participant', () => {
    beforeEach(() => localStorage.clear());
    const people = [
        { id: 'a', name: 'Amna', email: 'Amna@Example.com', phone: '0912345678' },
        { id: 'b', name: 'Bakri', email: 'bakri@example.com', phone: '+249 911 111 111' },
    ];

    it('finds the participant by email or phone', () => {
        expect(findLinkedParticipant(people, 'c1', { uid: 'u', email: 'amna@example.com' })?.id).toBe('a');
        expect(findLinkedParticipant(people, 'c1', { uid: 'u', phoneNumber: '+249911111111' })?.id).toBe('b');
        expect(findLinkedParticipant(people, 'c1', { uid: 'u', email: 'x@y.z' })).toBeNull();
        expect(findLinkedParticipant(people, 'c1', null)).toBeNull();
    });

    it('remembers the name a test was sent under, and stops guessing on a shared phone', () => {
        const user = { uid: 'u', email: 'x@y.z' };
        rememberLinkedParticipant('c1', 'b', user);
        expect(findLinkedParticipant(people, 'c1', user)?.id).toBe('b');
        rememberLinkedParticipant('c1', 'a', user);
        expect(findLinkedParticipant(people, 'c1', user)).toBeNull();
    });

    it('compares Sudanese phone numbers in any form', () => {
        expect(samePhone('0912345678', '+249912345678')).toBe(true);
        expect(samePhone('0912345678', '0912345679')).toBe(false);
    });
});
