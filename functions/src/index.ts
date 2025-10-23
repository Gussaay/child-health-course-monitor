import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

interface Participant {
  courseId?: string;
  pre_test_score?: number | string | null;
  post_test_score?: number | string | null;
  job_title?: string | null;
}

interface Course {
  id?: string;
  course_type?: string | null;
}

const toNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Hourly aggregation for dashboard/summaryStats
 */
export const aggregateDashboardStats = onSchedule('every 1 hours', async () => {
  logger.info('Starting dashboard aggregation…');

  // 1) Load courses & participants
  const [coursesSnapshot, participantsSnapshot] = await Promise.all([
    db.collection('courses').get(),
    db.collection('participants').get(),
  ]);

  const courses = coursesSnapshot.docs.map((d) => d.data() as Course);
  const participants = participantsSnapshot.docs.map((d) => d.data() as Participant);

  const courseMap = new Map<string | undefined, Course>(
    courses.map((c) => [c.id, c])
  );

  logger.info(
    `Aggregating ${courses.length} courses and ${participants.length} participants.`
  );

  // 2) Aggregations
  let totalPreTest = 0;
  let preTestCount = 0;
  let totalPostTest = 0;
  let postTestCount = 0;

  const byCourseTypeCounter: Record<string, number> = {};
  const byJobTitleCounter: Record<string, number> = {};

  for (const p of participants) {
    const course = courseMap.get(p.courseId);

    const pre = toNum(p.pre_test_score);
    if (pre !== undefined) {
      totalPreTest += pre;
      preTestCount++;
    }

    const post = toNum(p.post_test_score);
    if (post !== undefined) {
      totalPostTest += post;
      postTestCount++;
    }

    if (course?.course_type) {
      byCourseTypeCounter[course.course_type] =
        (byCourseTypeCounter[course.course_type] ?? 0) + 1;
    }

    if (p.job_title) {
      byJobTitleCounter[p.job_title] = (byJobTitleCounter[p.job_title] ?? 0) + 1;
    }
  }

  const participantStats = {
    totalTrained: participants.length,
    avgPreTest: preTestCount > 0 ? totalPreTest / preTestCount : 0,
    avgPostTest: postTestCount > 0 ? totalPostTest / postTestCount : 0,
    byCourseType: {
      labels: Object.keys(byCourseTypeCounter),
      datasets: [{ data: Object.values(byCourseTypeCounter) }],
    },
    byJobTitle: {
      labels: Object.keys(byJobTitleCounter),
      datasets: [{ label: '# of Participants', data: Object.values(byJobTitleCounter) }],
    },
  };

  // 3) Write the summary
  await db.collection('dashboard').doc('summaryStats').set({
    participants: participantStats,
    courses: { total: courses.length },
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('Dashboard aggregation complete: dashboard/summaryStats updated.');
});
