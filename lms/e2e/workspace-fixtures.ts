import type {Page} from '@playwright/test';
export const reply = (data: unknown) => ({status: 200, code: 'SUCCESS', data});
export const course = {id: 71, courseCode: 'WR101', title: 'Academic Writing Studio', state: 'Active', description: 'Build clear, well-supported arguments through guided practice and feedback.', termStartDate: '2026-09-01', termEndDate: '2026-12-01', primaryInstructor: {userId: 51, instructorFirstName: 'Ivy', instructorLastName: 'Lee'}, role: 'Student', permissions: {}};
export const material = {id: 121, weekId: 81, displayName: 'Academic writing guide', materialType: 'LINK', linkUrl: 'https://example.test/writing-guide', previewAvailable: false};
export const profile = {studentUserId: 301, targetGoal: 'Communicate confidently in academic English', baselineAssessment: 'Initial diagnostic completed', targetMetric: 'Writing', targetValue: '6.5', targetDate: '2026-10-12', skills: [{skillCode: 'WR', displayName: 'Writing', scale: 'IELTS', currentValue: '5.5', targetValue: '6.5'}]};
export const ownProfile = {userId: 301, firstName: 'Alex', lastName: 'Chen', email: 'review@example.test', role: 'USER', level: 'STUDENT', avatarUrl: null, phone: '', emailNotifications: true};
export const tasks = [{id: 101, title: 'Write a timed response', description: 'Use a clear claim and supporting examples.', status: 'NOT_STARTED', dueDate: '2026-09-07', version: 1}, {id: 102, title: 'Review advisor feedback', status: 'COMPLETED', dueDate: '2026-09-02', advisorFeedback: 'Your examples support the argument. Make the introduction more concise.', version: 1}];
export async function fixture(page: Page, level = 'STUDENT', courseRole = 'Student', role = 'USER') {
  await page.addInitScript(user => {localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('accToken', user.accessToken);}, {...ownProfile, name: 'Alex Chen', id: level === 'ADVISOR' ? 801 : 301, level, role, accessToken: 'isolated-figma-fixture'});
  await page.route('**/v2/**', route => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace(/^\/api/, '');
    let data: unknown = [];
    if (endpoint === '/v2/me/courses') data = {items: [{...course, role: courseRole, courseRole}], total: 1, page: 0, size: 100};
    else if (endpoint === '/v2/courses/71') data = course;
    else if (endpoint === '/v2/courses/71/weeks') data = [{id: 81, title: 'Building an argument', state: 'Published', materials: [material]}];
    else if (endpoint === '/v2/me/progress') data = {courses: [{courseId: 71, totalAssignmentCount: 10, completedAssignmentCount: 4}]};
    else if (endpoint === '/v2/student/profile') data = profile;
    else if (endpoint === '/v2/student/study-plan') data = {studentUserId: 301, profileContext: {}, plan: {strategySummary: 'Weekly practice and reflection.', checkpoints: [{id: 91, description: 'Build the foundations', tasks}]}};
    else if (endpoint === '/v2/me/profile') data = ownProfile;
    else if (endpoint.endsWith('/unread-count')) data = {unreadCount: 0};
    else if (endpoint === '/v2/courses/71/my-grades') data = [{assignmentId: 111, assignmentTitle: 'First academic essay', released: true, gradeDisplay: '16 / 20', pointsPossible: 20, dueAtUtc: '2026-09-01T12:00:00Z'}];
    else if (endpoint === '/v2/advisor/instructors' || endpoint === '/v2/advisor/courses' || endpoint === '/v2/advisor/action-tasks') data = {items: [], total: 0, page: 0, size: 20};
    else if (endpoint === '/v2/advisor/dashboard') data = {assignedStudentCount: 1, onTrackCount: 0, atRiskCount: 1, needsAttentionCount: 0, pendingApprovalCount: 0, overdueFollowUpCount: 0};
    else if (endpoint === '/v2/advisor/students') data = {items: [{...profile, firstName: 'Alex', lastName: 'Chen', riskStatus: 'AT_RISK'}], total: 1, page: 0, size: 20};
    else if (endpoint === '/v2/advisor/conversations') data = {items: [{studentUserId: 301, studentFirstName: 'Alex', studentLastName: 'Chen', unreadCount: 1, latestPreview: 'Could you review my introduction?'}], total: 1, page: 0, size: 20};
    else if (endpoint.endsWith('/hub')) data = {...profile, firstName: 'Alex', lastName: 'Chen'};
    else if (endpoint.endsWith('/conversation/messages')) data = [{messageId: 901, senderUserId: 301, body: 'Could you review my introduction?', createdAt: '2026-09-03T12:00:00Z'}];
    if (['/v2/me/work-queue', '/v2/me/schedule-requests', '/v2/me/student-reports', '/v2/me/teaching/grading-items', '/v2/me/teaching/schedule-requests', '/v2/student/mock-exams', '/v2/instructor/mock-exams/writing-grades'].includes(endpoint)) data = {items: [], total: 0, page: 0, size: 20};
    if (endpoint === '/v2/student/advisor-conversation/messages' || /^\/v2\/parent\/students\/\d+\/conversation\/messages$/.test(endpoint)) data = {items: [], nextBeforeId: null, hasMore: false};
    return route.fulfill({json: reply(data)});
  });
}
