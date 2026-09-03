import type {Page} from '@playwright/test';
import {fixture, reply, course as baseCourse} from './workspace-fixtures';

// Synthetic records for frontend behavior and layout QA, never live acceptance evidence.
export const course = {...baseCourse, courseCode: 'HVW101', primaryInstructor: {userId: 51, name: 'Helen Vance'}, courseRole: 'Instructor', role: 'Instructor'};
export const names = ['Alexandra Vance', 'Benjamin Thorne', 'Chloe Henderson', 'Devon Reynolds', 'Elena Rostova', 'Franklin Vance'];
const unitTitles = ['Introduction to Academic Argumentation', 'Structuring Thesis & Paragraphs', 'Citation Formats & Plagiarism Prevention', 'Peer Review Workshop & Iteration', 'Final Draft Editing & Polishing'];
export const weeks = unitTitles.map((title, i) => ({id: 81 + i, lectureId: 81 + i, lectureNumber: i + 1, courseId: 71, title, state: 'Published', materials: [{id: 121 + i, courseId: 71, weekId: 81 + i, displayName: ['Syllabus & Research Framework', 'Thesis Statement Builder', 'Citation Styles Guide', 'Peer Review Checklist', 'Final Rubric & Grade Polishing'][i], originalFilename: `academic-writing-week${i + 1}.pdf`, materialType: 'FILE', teachingType: 'DOCUMENT', extension: 'pdf', createdAt: '2026-09-01T12:00:00Z', previewAvailable: true, sizeBytes: 241}]}));
export const occurrences = weeks.map((week, i) => ({id: 201 + i, sessionId: 101, weekId: week.id, occurrenceDate: `2026-09-${String(3 + i * 5).padStart(2, '0')}`, startTime: '10:00:00', endTime: '11:30:00', status: i < 2 ? 'COMPLETED' : 'SCHEDULED', version: 1, attendanceOpened: i < 2}));
export type CapturedWrite = {path: string; method: string; body: Record<string, unknown>; key?: string};
export async function instructorFixture(page: Page, options: {emptyMock?: boolean; conflictAttendance?: boolean; missingVersion?: boolean} = {}) {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  const requests: URL[] = [];
  const writes: CapturedWrite[] = [];
  let attendanceVersion = 1;
  const classes = occurrences.map(item => ({...item}));
  const attendance = names.map((name, i) => ({studentUserId: 301 + i, studentFirstName: name.split(' ')[0], studentLastName: name.split(' ')[1], status: ['PRESENT', 'PRESENT', 'LATE', 'ABSENT', 'PRESENT', undefined][i]}));
  let reports = names.slice(0, 5).map((name, i) => ({id: 401 + i, courseId: 71, studentUserId: 301 + i, studentFirstName: name.split(' ')[0], studentLastName: name.split(' ')[1], reportType: i === 2 ? 'FINAL' : 'MID_TERM', status: i < 2 ? 'PUBLISHED' : 'DRAFT', version: 1, updatedAt: '2026-09-03T12:00:00Z', overallSummary: ['Demonstrates consistent improvement in structural flow and clarity.', 'Excellent use of citations and academic vocabulary. The thesis statement is clear.', 'The argument is logical. Continue practising source attribution.', 'Drafting continues, with a focus on precise vocabulary and stronger logical links.', 'Thoughtful analysis with well-chosen supporting evidence.'][i]}));
  const posts = [{id: 501, body: 'Clarification on thesis statement constraints\nYour thesis should clearly state the argument and outline the main points of your analysis.', authorFirstName: 'Helen', authorLastName: 'Vance', createdAt: '2026-09-03T12:00:00Z'}, {id: 502, body: 'Recommended reading list for academic argumentation\nShare useful papers and discuss the evidence that informs your writing.', authorFirstName: 'Alexandra', authorLastName: 'Vance', createdAt: '2026-09-02T12:00:00Z'}];
  const replies: typeof posts = [];
  let links = [{lectureId: 82, title: weeks[1].title}];
  await page.route('**/v2/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    requests.push(url);
    const method = request.method();
    const isWrite = !['GET', 'HEAD'].includes(method);
    const body: Record<string, unknown> = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() ?? {} : {};
    if (isWrite) writes.push({path, method, body, key: request.headers()['idempotency-key']});
    let data: unknown;
    if (path === '/v2/me/courses') {
      const items = [course, {...course, id: 72, courseCode: 'LIT202', title: 'Advanced Critical Reading'}, {...course, id: 73, courseCode: 'RES301', title: 'Research Methods & Ethics'}];
      data = {items: url.searchParams.get('state') === 'Archived' ? [] : items, total: url.searchParams.get('state') === 'Archived' ? 0 : 3, page: 0, size: 20};
    } else if (/\/courses\/\d+\/sessions$/.test(path)) data = [{id: 101, courseId: 71, dayOfWeek: 'MON', startTime: '10:00:00', endTime: '11:30:00', location: 'Harbourview Campus, Room 3A', type: 'LECTURE'}];
    else if (path === '/v2/courses/71') data = course;
    else if (path === '/v2/courses/71/weeks') data = weeks;
    else if (path.endsWith('/syllabus')) data = {posted: true, originalFilename: 'academic-writing-syllabus.pdf', sizeBytes: 12450};
    else if (/\/materials\/\d+\/(preview|download)$/.test(path) || path.endsWith('/materials/download')) return route.fulfill({contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF'});
    else if (path.endsWith('/members')) data = {items: attendance.map(item => ({userId: item.studentUserId, userFirstName: item.studentFirstName, userLastName: item.studentLastName, courseRole: 'Student', active: true})), page: 0, size: 20, total: attendance.length};
    else if (path === '/v2/courses/71/session-occurrences') {
      if (method === 'POST') classes.push({...classes[0], ...body, id: 299, attendanceOpened: false, status: 'SCHEDULED'});
      data = classes;
    }
    else if (/\/session-occurrences\/\d+$/.test(path)) data = classes.find(item => path.endsWith(`/${item.id}`));
    else if (path.endsWith('/session-occurrences/generate')) data = {generatedCount: 0};
    else if (/\/session-occurrences\/\d+\/(cancel|reschedule)$/.test(path)) {
      const item = classes.find(item => path.includes(`/${item.id}/`))!;
      item.status = path.endsWith('/cancel') ? 'CANCELLED' : 'RESCHEDULED';
      item.version += 1;
      data = item;
    }
    else if (path.endsWith('/attendance')) {
      if (method === 'PUT') {
        if (options.conflictAttendance) return route.fulfill({status: 409, json: {status: 409, code: 'ATTENDANCE_VERSION_CONFLICT', message: 'Attendance changed in another session.'}});
        for (const entry of body.entries as Array<{studentUserId: number; status: string}>) {const student = attendance.find(item => item.studentUserId === entry.studentUserId); if (student) student.status = entry.status;}
        attendanceVersion += 1;
      }
      data = {attendanceVersion: options.missingVersion ? undefined : attendanceVersion, entries: attendance};
    } else if (path.endsWith('/attendance/roster-sync')) data = {attendanceVersion, entries: attendance};
    else if (path.endsWith('/student-reports')) {
      if (method === 'POST') reports = [...reports, {...reports[2], ...body, id: 499, studentUserId: Number(body.studentUserId)}];
      const filtered = reports.filter(item => (!url.searchParams.get('status') || item.status === url.searchParams.get('status')) && (!url.searchParams.get('reportType') || item.reportType === url.searchParams.get('reportType')));
      data = {items: filtered.map(({overallSummary: _summary, ...item}) => item), total: filtered.length, page: 1, size: 20};
    } else if (/\/student-reports\/\d+(\/publish)?$/.test(path)) {
      const id = Number(path.match(/student-reports\/(\d+)/)?.[1]);
      const report = reports.find(item => item.id === id)!;
      if (isWrite) Object.assign(report, path.endsWith('/publish') ? {status: 'PUBLISHED', version: report.version + 1} : {...body, version: report.version + 1});
      data = report;
    } else if (path.endsWith('/discussion/posts')) data = {items: posts, page: 0, size: 20, total: posts.length};
    else if (/\/discussion\/posts\/\d+$/.test(path)) data = posts.find(item => path.endsWith(`/${item.id}`));
    else if (path.endsWith('/replies')) {
      if (isWrite) replies.push({...posts[0], id: 601 + replies.length, body: String(body.body)});
      data = {items: replies, total: replies.length, page: 0, size: 20};
    } else if (path.endsWith('/attachments')) data = [];
    else if (path.endsWith('/materials/121/links')) data = {lectureLinks: links, assignmentLinks: []};
    else if (path.includes('/materials/121/lecture-links/')) {links = []; data = null;}
    else if (path === '/v2/me/teaching/today-classes') data = [];
    else if (path === '/v2/me/teaching/courses') data = [course];
    else if (path === '/v2/me/teaching/grading-queue') data = [{kind: 'AssignmentUngraded', courseId: 71, courseCode: course.courseCode, title: 'Argumentative Essay Draft', pendingCount: 5, assignmentId: 111, quizId: null}];
    else if (path === '/v2/me/teaching/grading-items') data = [];
    else if (path === '/v2/me/teaching/students-needing-support') data = [{courseId: 71, courseTitle: course.title, studentUserId: 304, studentFirstName: 'Devon', studentLastName: 'Reynolds', reasons: ['LOW_ATTENDANCE']}];
    else if (path === '/v2/me/teaching/alerts') data = [{type: 'PENDING_GRADING', message: '5 assignment submissions are waiting for review.'}];
    else if (path.endsWith('/schedule-requests')) data = [];
    else if (path === '/v2/me/teaching/availability') data = {version: 1, windows: [{dayOfWeek: 'MON', startTime: '09:00:00', endTime: '17:00:00', timezone: 'America/Los_Angeles'}], exceptions: []};
    else if (path === '/v2/instructor/mock-exams/writing-grades') data = options.emptyMock ? [] : [{id: 701, title: 'Academic Writing · Task 2', status: 'PENDING', submittedAt: '2026-09-03T10:00:00Z'}];
    else if (path === '/v2/instructor/mock-exams/writing-grades/701') data = {id: 701, studentFirstName: 'Alexandra', studentLastName: 'Vance', script: 'Public libraries remain valuable spaces for learning. Their role now extends beyond access to books: they provide trusted information, quiet study areas and opportunities for community participation. Investment in these services helps residents develop the skills they need throughout their lives.'};
    else return route.fallback();
    return route.fulfill({json: reply(data)});
  });
  return {writes, requests};
}
