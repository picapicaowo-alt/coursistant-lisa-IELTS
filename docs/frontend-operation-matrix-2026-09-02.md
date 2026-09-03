# Frontend operation evidence matrix — 2026-09-02

Scope: the 11 checked-in OpenAPI snapshots; 431 operations. This is a source reachability audit, not proof of authenticated runtime success. Paths with parameterized service wrappers are candidate matches and were checked against their service implementations. UI evidence names actual calling pages, components or hooks; it does not assert that every response schema or business state has been accepted live.

Status: **wired** = service and production consumer found; **transport / review** = service exists but no direct consumer was identified; **alternate workflow** = the page uses a collection projection or batch operation; **excluded** = explicitly Disabled or diagnostic endpoint. System-only functions are outside the supplied Tenant Admin account matrix.

| Contract | Operations |
|---|---:|
| advising.openapi.yaml | 64 |
| assignment.openapi.yaml | 42 |
| auth.openapi.yaml | 27 |
| counsellor.openapi.yaml | 7 |
| course.openapi.yaml | 151 |
| mockexam.openapi.yaml | 51 |
| notification.openapi.yaml | 5 |
| parent.openapi.yaml | 32 |
| quiz.openapi.yaml | 29 |
| user.openapi.yaml | 13 |
| vocabulary.openapi.yaml | 10 |

## advising.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `counsellorCreateStudentIntake` | `POST /v2/counsellor/student-intakes` | `apis/services/counsellor-api.ts#createStudentIntake` | `pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorListStudentIntakes` | `GET /v2/counsellor/student-intakes` | `apis/services/counsellor-api.ts#listStudentIntakes` | `pages/CounsellorIntakesPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorGetStudentIntake` | `GET /v2/counsellor/student-intakes/{intakeId}` | `apis/services/counsellor-api.ts#getStudentIntake` | `pages/AdvisorStudentWorkspacePage/IntakePage.tsx`<br>`pages/CounsellorAssignAdvisorPage/index.tsx`<br>`pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorPatchStudentIntake` | `PATCH /v2/counsellor/student-intakes/{intakeId}` | `apis/services/counsellor-api.ts#patchStudentIntake` | `pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorListAdvisors` | `GET /v2/counsellor/advisors` | `apis/services/counsellor-api.ts#listAdvisors` | `pages/CounsellorAssignAdvisorPage/index.tsx` | wired |
| `counsellorAssignAdvisor` | `PUT /v2/counsellor/student-intakes/{intakeId}/advisor` | `apis/services/counsellor-api.ts#assignAdvisor` | `pages/CounsellorAssignAdvisorPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorGetDashboard` | `GET /v2/counsellor/dashboard` | `apis/services/counsellor-api.ts#getDashboard` | `pages/AdvisorOperationsPage/index.tsx`<br>`pages/CounsellorDashboardPage/index.tsx` | wired |
| `advisorListInstructors` | `GET /v2/advisor/instructors` | `apis/services/advisor-api.ts#listInstructors` | `components/AdvisorInstructorPicker/index.tsx` | wired |
| `advisorListOwnedCourses` | `GET /v2/advisor/courses` | `apis/services/advisor-api.ts#listOwnedCourses` | `pages/AdvisorOperationsPage/OwnedCourses.tsx` | wired |
| `advisorListStudents` | `GET /v2/advisor/students` | `apis/services/advisor-api.ts#listStudents` | `pages/AdvisorStudentsPage/index.tsx`<br>`pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `advisorGetStudentIntake` | `GET /v2/advisor/students/{studentUserId}/intake` | `apis/services/advisor-api.ts#getStudentIntake` | `pages/AdvisorStudentWorkspacePage/IntakePage.tsx`<br>`pages/CounsellorAssignAdvisorPage/index.tsx`<br>`pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `tenantCreateStudentIntake` | `POST /v2/tenant/student-intakes` | `apis/services/tenant-advising-api.ts#createStudentIntake` | `pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `tenantListStudentIntakes` | `GET /v2/tenant/student-intakes` | `apis/services/tenant-advising-api.ts#listStudentIntakes` | `pages/CounsellorIntakesPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `tenantGetStudentIntake` | `GET /v2/tenant/student-intakes/{intakeId}` | `apis/services/tenant-advising-api.ts#getStudentIntake` | `pages/AdvisorStudentWorkspacePage/IntakePage.tsx`<br>`pages/CounsellorAssignAdvisorPage/index.tsx`<br>`pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `tenantPatchStudentIntake` | `PATCH /v2/tenant/student-intakes/{intakeId}` | `apis/services/tenant-advising-api.ts#patchStudentIntake` | `pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `tenantAssignAdvisor` | `PUT /v2/tenant/student-intakes/{intakeId}/advisor` | `apis/services/tenant-advising-api.ts#assignAdvisor` | `pages/CounsellorAssignAdvisorPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `tenantReassignAdvisor` | `PUT /v2/tenant/students/{studentUserId}/advisor` | `apis/services/tenant-advising-api.ts#reassignAdvisor` | `pages/TenantIntakesPage/index.tsx` | wired |
| `tenantCancelStudentIntake` | `POST /v2/tenant/student-intakes/{intakeId}/cancel` | `apis/services/tenant-advising-api.ts#cancelStudentIntake` | `pages/TenantIntakesPage/index.tsx` | wired |
| `advisorCreateStudentProfile` | `POST /v2/advisor/students/{studentUserId}/profile` | `apis/services/advisor-api.ts#createStudentProfile` | `pages/AdvisorStudentWorkspacePage/ProfilePage.tsx` | wired |
| `advisorGetStudentProfile` | `GET /v2/advisor/students/{studentUserId}/profile` | `apis/services/advisor-api.ts#getStudentProfile` | `pages/AdvisorStudentWorkspacePage/ProfilePage.tsx`<br>`pages/AdvisorStudentWorkspacePage/StudyPlanPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `advisorUpdateStudentProfile` | `PUT /v2/advisor/students/{studentUserId}/profile` | `apis/services/advisor-api.ts#updateStudentProfile` | `pages/AdvisorStudentWorkspacePage/ProfilePage.tsx` | wired |
| `advisorCreateStudyPlan` | `POST /v2/advisor/students/{studentUserId}/study-plan` | `apis/services/advisor-api.ts#createStudyPlan` | `pages/AdvisorStudentWorkspacePage/StudyPlanPage.tsx` | wired |
| `advisorGetStudyPlan` | `GET /v2/advisor/students/{studentUserId}/study-plan` | `apis/services/advisor-api.ts#getStudyPlan` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx`<br>`pages/AdvisorStudentWorkspacePage/StudyPlanPage.tsx` | wired |
| `advisorUpdateStudyPlan` | `PUT /v2/advisor/students/{studentUserId}/study-plan` | `apis/services/advisor-api.ts#updateStudyPlan` | `pages/AdvisorStudentWorkspacePage/StudyPlanPage.tsx` | wired |
| `advisorListStudyPlanRevisions` | `GET /v2/advisor/students/{studentUserId}/study-plan/revisions` | `apis/services/advisor-api.ts#listStudyPlanRevisions` | `pages/AdvisorStudentWorkspacePage/StudyPlanHistory.tsx` | wired |
| `advisorFeedbackAdvisorTask` | `POST /v2/advisor/students/{studentUserId}/study-plan/tasks/{taskId}/feedback` | `apis/services/advisor-api.ts#feedbackAdvisorTask` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx` | wired |
| `studentGetOwnProfile` | `GET /v2/student/profile` | `apis/services/advisor-api.ts#getOwnProfile` | `pages/StudentAdvisingPage/index.tsx` | wired |
| `studentGetOwnStudyPlan` | `GET /v2/student/study-plan` | `apis/services/advisor-api.ts#getOwnStudyPlan` | `pages/StudentAdvisingPage/index.tsx` | wired |
| `studentStartAdvisorTask` | `POST /v2/student/study-plan/tasks/{taskId}/start` | `apis/services/advisor-api.ts#startOwnAdvisorTask` | `pages/StudentAdvisingPage/index.tsx` | wired |
| `studentCompleteAdvisorTask` | `POST /v2/student/study-plan/tasks/{taskId}/complete` | `apis/services/advisor-api.ts#completeOwnAdvisorTask` | `pages/StudentAdvisingPage/index.tsx` | wired |
| `advisorListStudentCourses` | `GET /v2/advisor/students/{studentUserId}/courses` | `apis/services/advisor-api.ts#listStudentCourses` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx`<br>`pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `advisorSearchGroupCourseOptions` | `GET /v2/advisor/students/{studentUserId}/course-options` | `apis/services/advisor-api.ts#searchGroupCourseOptions` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorLinkGroupCourse` | `POST /v2/advisor/students/{studentUserId}/courses/group-links` | `apis/services/advisor-api.ts#linkGroupCourse` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorWithdrawGroupCourse` | `POST /v2/advisor/students/{studentUserId}/courses/{courseId}/withdraw` | `apis/services/advisor-api.ts#withdrawGroupCourse` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorCompleteStudentCourse` | `POST /v2/advisor/students/{studentUserId}/courses/{courseId}/complete` | `apis/services/advisor-api.ts#completeStudentCourse` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorCreateOneOnOneCourse` | `POST /v2/advisor/students/{studentUserId}/courses/one-on-one` | `apis/services/advisor-api.ts#createOneOnOneCourse` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorReassignOneOnOneInstructor` | `PUT /v2/advisor/students/{studentUserId}/courses/{courseId}/instructor` | `apis/services/advisor-api.ts#reassignOneOnOneInstructor` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorReplaceOneOnOneSessions` | `PUT /v2/advisor/students/{studentUserId}/courses/{courseId}/sessions` | `apis/services/advisor-api.ts#replaceOneOnOneSessions` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorReadyOneOnOneLaunch` | `POST /v2/advisor/students/{studentUserId}/courses/{courseId}/launch/ready` | `apis/services/advisor-api.ts#readyOneOnOneLaunch` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorPublishOneOnOneLaunch` | `POST /v2/advisor/students/{studentUserId}/courses/{courseId}/launch/publish` | `apis/services/advisor-api.ts#publishOneOnOneLaunch` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorReconfirmCourseLink` | `POST /v2/advisor/students/{studentUserId}/courses/{courseId}/reconfirm` | `apis/services/advisor-api.ts#reconfirmCourseLink` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx` | wired |
| `advisorGetCourseDeliveryConfig` | `GET /v2/advisor/courses/{courseId}/delivery-config` | `apis/services/advisor-api.ts#getCourseDeliveryConfig` | `pages/TenantCourseDeliveryPage/index.tsx` | wired |
| `advisorPutCourseDeliveryConfig` | `PUT /v2/advisor/courses/{courseId}/delivery-config` | `apis/services/advisor-api.ts#putCourseDeliveryConfig` | `pages/TenantCourseDeliveryPage/index.tsx` | wired |
| `advisorReadyCourseLaunch` | `POST /v2/advisor/courses/{courseId}/launch/ready` | `apis/services/advisor-api.ts#readyCourseLaunch` | `pages/TenantCourseDeliveryPage/index.tsx` | wired |
| `advisorPublishCourseLaunch` | `POST /v2/advisor/courses/{courseId}/launch/publish` | `apis/services/advisor-api.ts#publishCourseLaunch` | `pages/TenantCourseDeliveryPage/index.tsx` | wired |
| `instructorGetStudentProfileContext` | `GET /v2/instructor/courses/{courseId}/students/{studentUserId}/profile-context` | `apis/services/advisor-api.ts#getInstructorStudentProfileContext` | `pages/CourseOperationsPage/index.tsx` | wired |
| `advisorGetDashboard` | `GET /v2/advisor/dashboard` | `apis/services/advisor-api.ts#getDashboard` | `pages/AdvisorOperationsPage/index.tsx`<br>`pages/CounsellorDashboardPage/index.tsx` | wired |
| `advisorGetStudentHub` | `GET /v2/advisor/students/{studentUserId}/hub` | `apis/services/advisor-api.ts#getStudentHub` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/AdvisorStudentWorkspacePage/index.tsx` | wired |
| `advisorListStudentPublishedReports` | `GET /v2/advisor/students/{studentUserId}/student-reports` | `apis/services/advisor-api.ts#listStudentPublishedReports` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx` | wired |
| `advisorListConversations` | `GET /v2/advisor/conversations` | `apis/services/advisor-api.ts#listConversations` | `pages/AdvisorOperationsPage/index.tsx` | wired |
| `advisorListConversationMessages` | `GET /v2/advisor/students/{studentUserId}/conversation/messages` | `apis/services/advisor-api.ts#listConversationMessages`<br>`apis/services/advisor-api.ts#listConversationMessages` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `advisorSendConversationMessage` | `POST /v2/advisor/students/{studentUserId}/conversation/messages` | `apis/services/advisor-api.ts#sendConversationMessage`<br>`apis/services/advisor-api.ts#sendConversationMessageMultipart` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `advisorPreviewConversationAttachment` | `GET /v2/advisor/students/{studentUserId}/conversation/attachments/{attachmentId}/preview` | `apis/services/advisor-api.ts#previewConversationAttachment` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `advisorDownloadConversationAttachment` | `GET /v2/advisor/students/{studentUserId}/conversation/attachments/{attachmentId}/download` | `apis/services/advisor-api.ts#downloadConversationAttachment` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `advisorMarkConversationRead` | `POST /v2/advisor/students/{studentUserId}/conversation/read` | `apis/services/advisor-api.ts#markConversationRead` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `studentListAdvisorConversationMessages` | `GET /v2/student/advisor-conversation/messages` | `apis/services/advisor-api.ts#listOwnConversationMessages`<br>`apis/services/advisor-api.ts#listOwnConversationMessages` | `pages/StudentAdvisingPage/index.tsx` | wired |
| `studentSendAdvisorConversationMessage` | `POST /v2/student/advisor-conversation/messages` | `apis/services/advisor-api.ts#sendOwnConversationMessage`<br>`apis/services/advisor-api.ts#sendOwnConversationMessageMultipart` | `pages/StudentAdvisingPage/index.tsx` | wired |
| `studentPreviewAdvisorConversationAttachment` | `GET /v2/student/advisor-conversation/attachments/{attachmentId}/preview` | `apis/services/advisor-api.ts#previewOwnConversationAttachment` | `pages/StudentAdvisingPage/index.tsx` | wired |
| `studentDownloadAdvisorConversationAttachment` | `GET /v2/student/advisor-conversation/attachments/{attachmentId}/download` | `apis/services/advisor-api.ts#downloadOwnConversationAttachment` | `pages/StudentAdvisingPage/index.tsx` | wired |
| `studentMarkAdvisorConversationRead` | `POST /v2/student/advisor-conversation/read` | `apis/services/advisor-api.ts#markOwnConversationRead` | `pages/StudentAdvisingPage/index.tsx` | wired |
| `advisorListActionTasks` | `GET /v2/advisor/action-tasks` | `apis/services/advisor-api.ts#listActionTasks` | `pages/AdvisorOperationsPage/index.tsx` | wired |
| `advisorGetActionTask` | `GET /v2/advisor/action-tasks/{taskId}` | `apis/services/advisor-api.ts#getActionTask` | `pages/AdvisorOperationsPage/index.tsx` | wired |
| `advisorStartActionTask` | `POST /v2/advisor/action-tasks/{taskId}/start` | `apis/services/advisor-api.ts#startActionTask` | `pages/AdvisorOperationsPage/index.tsx` | wired |
| `advisorResolveActionTask` | `POST /v2/advisor/action-tasks/{taskId}/resolve` | `apis/services/advisor-api.ts#resolveActionTask` | `pages/AdvisorOperationsPage/index.tsx` | wired |
## assignment.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `assignmentAttachmentManifest` | `GET /v2/courses/{courseId}/assignment-attachments` | `apis/services/assignment-api.ts#listAssignmentAttachmentManifest` | `pages/CourseOperationsPage/index.tsx` | wired |
| `assignmentList` | `GET /v2/courses/{courseId}/assignments` | `apis/services/assignment-api.ts#listAssignments` | `pages/CourseOperationsPage/index.tsx` | wired |
| `assignmentCreate` | `POST /v2/courses/{courseId}/assignments` | `apis/services/assignment-api.ts#createAssignment` | `pages/AssignmentEditorPage/index.tsx` | wired |
| `assignmentListSummaries` | `GET /v2/courses/{courseId}/assignments/summaries` | `apis/services/assignment-api.ts#getCourseAssignmentSummaries`<br>`apis/services/assignment-api.ts#getAssignment` | `pages/CalendarPage/calendarData.ts`<br>`pages/CourseWorkspacePage/hooks/useCourseWorkspaceData.ts`<br>`pages/LmsHomePage/components/AverageScoreComponent.tsx`<br>`pages/AssignmentDetailPage/index.tsx`<br>`pages/AssignmentEditorPage/index.tsx`<br>`pages/AssignmentSubmissionPage/index.tsx` | wired |
| `assignmentDelete` | `DELETE /v2/courses/{courseId}/assignments/{assignmentId}` | `apis/services/assignment-api.ts#deleteAssignment` | `pages/AssignmentDetailPage/index.tsx` | wired |
| `assignmentGet` | `GET /v2/courses/{courseId}/assignments/{assignmentId}` | `apis/services/assignment-api.ts#getAssignment` | `pages/AssignmentDetailPage/index.tsx`<br>`pages/AssignmentEditorPage/index.tsx`<br>`pages/AssignmentSubmissionPage/index.tsx` | wired |
| `assignmentPatch` | `PATCH /v2/courses/{courseId}/assignments/{assignmentId}` | `apis/services/assignment-api.ts#patchAssignment` | `pages/AssignmentEditorPage/index.tsx` | wired |
| `assignmentUploadAttachments` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/attachments` | `apis/services/assignment-api.ts#uploadAttachments` | `pages/AssignmentEditorPage/index.tsx` | wired |
| `assignmentDeleteAttachment` | `DELETE /v2/courses/{courseId}/assignments/{assignmentId}/attachments/{attachmentId}` | `apis/services/assignment-api.ts#deleteAttachment` | `pages/AssignmentEditorPage/index.tsx` | wired |
| `assignmentDownloadAttachment` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/attachments/{attachmentId}/download` | `apis/services/assignment-api.ts#getAttachmentBlob` | `pages/AssignmentDetailPage/SubmitAssignmentDialog.tsx`<br>`pages/AssignmentDetailPage/index.tsx`<br>`pages/AssignmentEditorPage/index.tsx` | wired |
| `assignmentPreviewAttachment` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/attachments/{attachmentId}/preview` | `apis/services/assignment-api.ts#getAttachmentBlob` | `pages/AssignmentDetailPage/SubmitAssignmentDialog.tsx`<br>`pages/AssignmentDetailPage/index.tsx`<br>`pages/AssignmentEditorPage/index.tsx` | wired |
| `assignmentPreviewDueDateChange` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/due-date-change-preview` | `apis/services/assignment-api.ts#previewDueDateChange` | `pages/AssignmentEditorPage/index.tsx` | wired |
| `assignmentReleaseGrades` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/grades/release` | `apis/services/assignment-api.ts#releaseGrades` | `pages/AssignmentGradingPage/index.tsx`<br>`pages/QuizGradingPage/index.tsx` | wired |
| `assignmentReleaseAllGrades` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/grades/release-all` | `apis/services/assignment-api.ts#releaseAllGrades` | `pages/AssignmentGradingPage/index.tsx` | wired |
| `assignmentRetractGrades` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/grades/retract` | `apis/services/assignment-api.ts#retractGrades` | `pages/AssignmentGradingPage/index.tsx`<br>`pages/QuizGradingPage/index.tsx` | wired |
| `assignmentGetGradingRoster` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/grading-roster` | `apis/services/assignment-api.ts#getGradingRoster` | `pages/AssignmentGradingPage/index.tsx`<br>`pages/LmsHomePage/components/AverageScoreComponent.tsx` | wired |
| `assignmentUpsertGroupGrade` | `PUT /v2/courses/{courseId}/assignments/{assignmentId}/groups/{groupId}/grade` | `apis/services/assignment-api.ts#upsertGroupGrade` | `pages/AssignmentGradingPage/index.tsx` | wired |
| `assignmentDownloadGroupAnnotatedFile` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/groups/{groupId}/grade/annotated-file` | `apis/services/assignment-api.ts#downloadAnnotatedFile` | `pages/AssignmentGradingPage/index.tsx` | wired |
| `assignmentUploadGroupAnnotatedFile` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/groups/{groupId}/grade/annotated-file` | `apis/services/assignment-api.ts#uploadAnnotatedFile` | `pages/AssignmentGradingPage/index.tsx` | wired |
| `assignmentGetGroupGradingView` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/groups/{groupId}/grading` | `apis/services/assignment-api.ts#getGroupGradingView` | `pages/AssignmentGradingPage/index.tsx` | wired |
| `assignmentPublish` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/publish` | `apis/services/assignment-api.ts#publishAssignment` | `pages/AssignmentEditorPage/index.tsx` | wired |
| `assignmentGetRubric` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/rubric` | `apis/services/assignment-api.ts#getRubric` | `pages/AssignmentDetailPage/rubricState.ts` | wired |
| `assignmentUploadRubric` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/rubric` | `apis/services/assignment-api.ts#uploadRubric` | `pages/AssignmentDetailPage/rubricUpload.ts` | wired |
| `assignmentDownloadRubric` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/rubric/download` | `apis/services/assignment-api.ts#getRubricBlob` | `pages/AssignmentDetailPage/index.tsx` | wired |
| `assignmentPreviewRubric` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/rubric/preview` | `apis/services/assignment-api.ts#getRubricBlob` | `pages/AssignmentDetailPage/index.tsx` | wired |
| `assignmentRestorePreviousRubric` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/rubric/restore-previous` | `apis/services/assignment-api.ts#restorePreviousRubric` | `pages/AssignmentDetailPage/index.tsx` | wired |
| `assignmentUpsertGrade` | `PUT /v2/courses/{courseId}/assignments/{assignmentId}/students/{studentUserId}/grade` | `apis/services/assignment-api.ts#upsertStudentGrade` | `pages/AssignmentGradingPage/index.tsx` | wired |
| `assignmentDownloadAnnotatedFile` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/students/{studentUserId}/grade/annotated-file` | `apis/services/assignment-api.ts#downloadAnnotatedFile` | `pages/AssignmentGradingPage/index.tsx` | wired |
| `assignmentUploadAnnotatedFile` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/students/{studentUserId}/grade/annotated-file` | `apis/services/assignment-api.ts#uploadAnnotatedFile` | `pages/AssignmentGradingPage/index.tsx` | wired |
| `assignmentGetStudentGradingView` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/students/{studentUserId}/grading` | `apis/services/assignment-api.ts#getStudentGradingView` | `pages/AssignmentGradingPage/index.tsx` | wired |
| `assignmentGetMySubmission` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/submission` | `apis/services/assignment-api.ts#getMySubmission` | `pages/AssignmentDetailPage/index.tsx` | wired |
| `assignmentListStagingFiles` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/submission-staging-files` | `apis/services/assignment-api.ts#listStagingFiles` | `pages/AssignmentDetailPage/index.tsx` | wired |
| `assignmentUploadStagingFiles` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/submission-staging-files` | `apis/services/assignment-api.ts#uploadStagingFiles` | `pages/AssignmentDetailPage/SubmitAssignmentDialog.tsx` | wired |
| `assignmentDeleteStagingFile` | `DELETE /v2/courses/{courseId}/assignments/{assignmentId}/submission-staging-files/{stagingFileId}` | `apis/services/assignment-api.ts#deleteStagingFile` | `pages/AssignmentDetailPage/SubmitAssignmentDialog.tsx` | wired |
| `assignmentSubmit` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/submissions` | `apis/services/assignment-api.ts#submitStagedFiles` | `pages/AssignmentDetailPage/SubmitAssignmentDialog.tsx` | wired |
| `assignmentDownloadSubmissionFile` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/files/{fileId}/download` | `apis/services/assignment-api.ts#getSubmissionFileBlob` | `pages/AssignmentDetailPage/StudentSubmissionHistory.tsx`<br>`pages/AssignmentSubmissionPage/index.tsx` | wired |
| `assignmentPreviewSubmissionFile` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/files/{fileId}/preview` | `apis/services/assignment-api.ts#getSubmissionFileBlob` | `pages/AssignmentDetailPage/StudentSubmissionHistory.tsx`<br>`pages/AssignmentSubmissionPage/index.tsx` | wired |
| `assignmentListSubmissionVersions` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/versions` | `apis/services/assignment-api.ts#listSubmissionVersions` | `pages/AssignmentDetailPage/index.tsx`<br>`pages/AssignmentGradingPage/index.tsx`<br>`pages/AssignmentSubmissionPage/index.tsx` | wired |
| `assignmentUnpublish` | `POST /v2/courses/{courseId}/assignments/{assignmentId}/unpublish` | `apis/services/assignment-api.ts#unpublishAssignment` | `pages/AssignmentDetailPage/index.tsx` | wired |
| `assignmentListMyGrades` | `GET /v2/courses/{courseId}/my-grades` | `apis/services/assignment-api.ts#listMyGrades` | `pages/CourseGradesPage/index.tsx`<br>`pages/LmsHomePage/components/AverageScoreComponent.tsx` | wired |
| `meAssignmentUpcoming` | `GET /v2/me/assignments/upcoming` | `apis/services/dashboard-api.ts#getUpcomingDeadlines` | `pages/LmsHomePage/hooks/useDashboardAssignments.ts` | wired |
| `systemGradeCorrectionCreate` | `POST /v2/system/grade-corrections/assignments` | `apis/services/admin-api.ts#correctAssignmentGrade` | `pages/AdminConsolePage/index.tsx` | wired |
## auth.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `authHello` | `GET /v1` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `authSendRegisterEmailVerification` | `POST /v1/auth/email-verifications/register` | `apis/services/auth-api.ts#sendRegistrationVerification` | `pages/signup/SignUpView.tsx` | wired |
| `authSendResetEmailVerification` | `POST /v1/auth/email-verifications/reset` | `apis/services/auth-api.ts#sendPasswordResetVerification` | `pages/ForgotPasswordPage/usePasswordReset.ts` | wired |
| `authLogin` | `POST /v1/auth/login` | `apis/services/auth-api.ts#login` | `App.tsx`<br>`pages/LoginPage/index.tsx` | wired |
| `authLogout` | `POST /v1/auth/logout` | `apis/services/auth-api.ts#logout` | `contexts/AuthContext.tsx` | wired |
| `authUpdatePassword` | `PUT /v1/auth/password` | `apis/services/auth-api.ts#changePassword` | `pages/settings/index.tsx` | wired |
| `authResetPassword` | `POST /v1/auth/password-resets` | `apis/services/auth-api.ts#resetPassword` | `pages/ForgotPasswordPage/usePasswordReset.ts` | wired |
| `authRefreshToken` | `POST /v1/auth/refresh-token` | `apis/services/auth-api.ts#refreshToken` | ApiClient session recovery; intentionally not a screen. | wired |
| `authRegister` | `POST /v1/auth/register` | `apis/services/auth-api.ts#register` | `pages/signup/SignUpView.tsx` | wired |
| `adminList` | `GET /v2/admins` | `apis/services/admin-api.ts#listAdmins` | `pages/AdminConsolePage/components/AdminContractOperations.tsx` | wired |
| `adminAddDisabled` | `POST /v2/admins` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `adminDeleteBatchDisabled` | `DELETE /v2/admins/batch` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `adminDeleteDisabled` | `DELETE /v2/admins/{id}` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `adminGetById` | `GET /v2/admins/{id}` | `apis/services/admin-api.ts#getAdmin` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
| `adminUpdateDisabled` | `PUT /v2/admins/{id}` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `systemManagedUserCreate` | `POST /v2/system/managed-users` | `apis/services/admin-api.ts#createManagedUser` | `pages/AdminConsolePage/index.tsx` | wired |
| `systemManagedUserDisable` | `POST /v2/system/managed-users/{id}/disable` | `apis/services/admin-api.ts#disableManagedUser` | `pages/AdminConsolePage/index.tsx` | wired |
| `systemManagedUserChangeRole` | `PUT /v2/system/managed-users/{id}/role` | `apis/services/admin-api.ts#changeManagedUserRole` | `pages/AdminConsolePage/index.tsx` | wired |
| `tenantListUsers` | `GET /v2/tenant/users` | `apis/services/admin-api.ts#listTenantUsers`<br>`apis/services/admin-api.ts#listTenantUsers` | `components/TenantUserPicker/index.tsx`<br>`pages/AdminConsolePage/index.tsx`<br>`pages/TenantAdminPage/DirectoryPanel.tsx` | wired |
| `tenantGetUser` | `GET /v2/tenant/users/{userId}` | `apis/services/admin-api.ts#getTenantUser` | `pages/TenantAdminPage/DirectoryPanel.tsx`<br>`pages/TenantStudentRecordPage/index.tsx` | wired |
| `tenantListAuditEvents` | `GET /v2/tenant/audit-events` | `apis/services/admin-api.ts#listTenantAuditEvents` | `pages/TenantAdminPage/AuditPanel.tsx` | wired |
| `tenantManagedUserCreate` | `POST /v2/tenant/managed-users` | `apis/services/admin-api.ts#createManagedUser`<br>`apis/services/admin-api.ts#createTenantManagedUser` | `pages/AdminConsolePage/index.tsx`<br>`pages/TenantAdminPage/DirectoryPanel.tsx` | wired |
| `tenantPatchManagedUser` | `PATCH /v2/tenant/managed-users/{id}` | `apis/services/admin-api.ts#patchTenantManagedUser` | `pages/TenantAdminPage/DirectoryPanel.tsx` | wired |
| `tenantGetManagedUserDisableBlockers` | `GET /v2/tenant/managed-users/{id}/disable-blockers` | `apis/services/admin-api.ts#getTenantManagedUserDisableBlockers` | `pages/TenantAdminPage/DirectoryPanel.tsx` | wired |
| `tenantManagedUserDisable` | `POST /v2/tenant/managed-users/{id}/disable` | `apis/services/admin-api.ts#disableManagedUser`<br>`apis/services/admin-api.ts#disableTenantManagedUser` | `pages/AdminConsolePage/index.tsx`<br>`pages/TenantAdminPage/DirectoryPanel.tsx` | wired |
| `tenantManagedUserEnable` | `POST /v2/tenant/managed-users/{id}/enable` | `apis/services/admin-api.ts#enableTenantManagedUser` | `pages/AdminConsolePage/index.tsx`<br>`pages/TenantAdminPage/DirectoryPanel.tsx` | wired |
| `tenantManagedUserChangeRole` | `PUT /v2/tenant/managed-users/{id}/role` | `apis/services/admin-api.ts#changeManagedUserRole`<br>`apis/services/admin-api.ts#changeTenantManagedUserRole` | `pages/AdminConsolePage/index.tsx`<br>`pages/TenantAdminPage/DirectoryPanel.tsx` | wired |
## counsellor.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `counsellorCreateStudentIntake` | `POST /v2/counsellor/student-intakes` | `apis/services/counsellor-api.ts#createStudentIntake` | `pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorListStudentIntakes` | `GET /v2/counsellor/student-intakes` | `apis/services/counsellor-api.ts#listStudentIntakes` | `pages/CounsellorIntakesPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorGetStudentIntake` | `GET /v2/counsellor/student-intakes/{intakeId}` | `apis/services/counsellor-api.ts#getStudentIntake` | `pages/AdvisorStudentWorkspacePage/IntakePage.tsx`<br>`pages/CounsellorAssignAdvisorPage/index.tsx`<br>`pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorPatchStudentIntake` | `PATCH /v2/counsellor/student-intakes/{intakeId}` | `apis/services/counsellor-api.ts#patchStudentIntake` | `pages/CounsellorIntakeFormPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorListAdvisors` | `GET /v2/counsellor/advisors` | `apis/services/counsellor-api.ts#listAdvisors` | `pages/CounsellorAssignAdvisorPage/index.tsx` | wired |
| `counsellorAssignAdvisor` | `PUT /v2/counsellor/student-intakes/{intakeId}/advisor` | `apis/services/counsellor-api.ts#assignAdvisor` | `pages/CounsellorAssignAdvisorPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx` | wired |
| `counsellorGetDashboard` | `GET /v2/counsellor/dashboard` | `apis/services/counsellor-api.ts#getDashboard` | `pages/AdvisorOperationsPage/index.tsx`<br>`pages/CounsellorDashboardPage/index.tsx` | wired |
## course.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `adminEnrollmentEnroll` | `POST /v2/admin/courses/{courseId}/enrollments` | `apis/services/course-operations-api.ts#adminEnroll` | `pages/CourseOperationsPage/index.tsx` | wired |
| `adminEnrollmentEnrollBatch` | `POST /v2/admin/courses/{courseId}/enrollments/batch` | `apis/services/course-operations-api.ts#adminEnrollBatch` | `pages/CourseOperationsPage/index.tsx` | wired |
| `adminEnrollmentDeactivate` | `DELETE /v2/admin/courses/{courseId}/enrollments/{userId}` | `apis/services/course-operations-api.ts#adminDeactivateEnrollment` | `pages/CourseOperationsPage/index.tsx` | wired |
| `advisorListOwnedCourses` | `GET /v2/advisor/courses` | `apis/services/advisor-api.ts#listOwnedCourses` | `pages/AdvisorOperationsPage/OwnedCourses.tsx` | wired |
| `advisorGetInstructorAvailability` | `GET /v2/advisor/instructors/{instructorUserId}/availability` | `apis/services/course-operations-api.ts#getAdvisorInstructorAvailability` | `pages/AdvisorOperationsPage/index.tsx` | wired |
| `advisorScheduleRequests` | `GET /v2/advisor/schedule-requests` | `apis/services/course-operations-api.ts#listAdvisorScheduleRequests` | `pages/AdvisorOperationsPage/index.tsx` | wired |
| `decideAdvisorScheduleRequest` | `POST /v2/advisor/schedule-requests/{requestId}/decision` | `apis/services/course-operations-api.ts#decideAdvisorScheduleRequest` | `pages/AdvisorOperationsPage/index.tsx` | wired |
| `advisorStudentAttendanceHistory` | `GET /v2/advisor/students/{studentUserId}/attendance` | `apis/services/course-operations-api.ts#getAdvisorStudentAttendance` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx` | wired |
| `advisorGetStudentCourseHours` | `GET /v2/advisor/students/{studentUserId}/courses/{courseId}/hours` | `apis/services/course-operations-api.ts#getAdvisorStudentCourseHours` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx` | wired |
| `advisorSetStudentCourseHours` | `PUT /v2/advisor/students/{studentUserId}/courses/{courseId}/hours` | `apis/services/course-operations-api.ts#setAdvisorStudentCourseHours` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx` | wired |
| `advisorGetStudentAttendance` | `GET /v2/advisor/students/{studentUserId}/courses/{courseId}/session-occurrences/{occurrenceId}/attendance` | `apis/services/course-operations-api.ts#getAdvisorStudentOccurrenceAttendance` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx` | wired |
| `advisorListPublishedCourseReports` | `GET /v2/advisor/students/{studentUserId}/courses/{courseId}/student-reports` | `apis/services/course-operations-api.ts#listAdvisorPublishedCourseReports` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx` | wired |
| `advisorGetPublishedCourseReport` | `GET /v2/advisor/students/{studentUserId}/courses/{courseId}/student-reports/{reportId}` | `apis/services/course-operations-api.ts#getAdvisorPublishedCourseReport` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx` | wired |
| `advisorListStudentPublishedReports` | `GET /v2/advisor/students/{studentUserId}/student-reports` | `apis/services/advisor-api.ts#listStudentPublishedReports` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx` | wired |
| `courseList` | `GET /v2/courses` | `apis/services/course-api.ts#browseCourses` | `pages/AdminConsolePage/components/CourseMembershipPanel.tsx`<br>`pages/CourseCataloguePage/index.tsx` | wired |
| `courseCreate` | `POST /v2/courses` | `apis/services/course-api.ts#createCourse` | `pages/AdvisorOperationsPage/CreateGroupCourse.tsx`<br>`pages/CourseWorkspacePage/CourseCreatePage.tsx` | wired |
| `courseAnnouncementList` | `GET /v2/courses/{courseId}/announcements` | `apis/services/course-api.ts#listAnnouncements` | `pages/CourseAnnouncementsPage/index.tsx`<br>`pages/CourseWorkspacePage/hooks/useCourseWorkspaceData.ts` | wired |
| `courseAnnouncementCreate` | `POST /v2/courses/{courseId}/announcements` | `apis/services/course-api.ts#createAnnouncement` | `pages/CourseAnnouncementsPage/index.tsx` | wired |
| `courseAnnouncementDelete` | `DELETE /v2/courses/{courseId}/announcements/{announcementId}` | `apis/services/course-api.ts#deleteAnnouncement` | `pages/CourseAnnouncementsPage/index.tsx` | wired |
| `courseAnnouncementGet` | `GET /v2/courses/{courseId}/announcements/{announcementId}` | `apis/services/course-api.ts#getAnnouncement` | `pages/CourseAnnouncementsPage/index.tsx`<br>`pages/NotificationSubjectPage/index.tsx` | wired |
| `courseAnnouncementUpdate` | `PATCH /v2/courses/{courseId}/announcements/{announcementId}` | `apis/services/course-api.ts#updateAnnouncement` | `pages/CourseAnnouncementsPage/index.tsx` | wired |
| `courseMaterialAssignmentList` | `GET /v2/courses/{courseId}/assignments/{assignmentId}/materials` | `apis/services/course-operations-api.ts#listAssignmentMaterials` | `pages/CourseOperationsPage/index.tsx` | wired |
| `listCourseDiscussionPosts` | `GET /v2/courses/{courseId}/discussion/posts` | `apis/services/course-operations-api.ts#listDiscussionPosts` | `pages/CourseOperationsPage/index.tsx` | wired |
| `createCourseDiscussionPost` | `POST /v2/courses/{courseId}/discussion/posts` | `apis/services/course-operations-api.ts#createDiscussionPost` | `pages/CourseOperationsPage/index.tsx` | wired |
| `getCourseDiscussionPost` | `GET /v2/courses/{courseId}/discussion/posts/{postId}` | `apis/services/course-operations-api.ts#getDiscussionPost` | `pages/CourseOperationsPage/index.tsx` | wired |
| `listCourseDiscussionAttachments` | `GET /v2/courses/{courseId}/discussion/posts/{postId}/attachments` | `apis/services/course-operations-api.ts#listDiscussionAttachments` | `pages/CourseOperationsPage/index.tsx` | wired |
| `downloadCourseDiscussionAttachment` | `GET /v2/courses/{courseId}/discussion/posts/{postId}/attachments/{attachmentId}/download` | `apis/services/course-operations-api.ts#getDiscussionAttachment` | `pages/CourseOperationsPage/index.tsx` | wired |
| `previewCourseDiscussionAttachment` | `GET /v2/courses/{courseId}/discussion/posts/{postId}/attachments/{attachmentId}/preview` | `apis/services/course-operations-api.ts#getDiscussionAttachment` | `pages/CourseOperationsPage/index.tsx` | wired |
| `listCourseDiscussionReplies` | `GET /v2/courses/{courseId}/discussion/posts/{postId}/replies` | `apis/services/course-operations-api.ts#listDiscussionReplies` | `pages/CourseOperationsPage/index.tsx` | wired |
| `createCourseDiscussionReply` | `POST /v2/courses/{courseId}/discussion/posts/{postId}/replies` | `apis/services/course-operations-api.ts#createDiscussionReply` | `pages/CourseOperationsPage/index.tsx` | wired |
| `courseEventList` | `GET /v2/courses/{courseId}/events` | `apis/services/course-api.ts#listCourseEvents` | `pages/CalendarPage/calendarData.ts`<br>`pages/CourseEventsPage/index.tsx`<br>`pages/CourseWorkspacePage/hooks/useCourseWorkspaceData.ts` | wired |
| `courseEventCreate` | `POST /v2/courses/{courseId}/events` | `apis/services/course-api.ts#createCourseEvent` | `pages/CourseEventsPage/index.tsx` | wired |
| `courseEventDelete` | `DELETE /v2/courses/{courseId}/events/{eventId}` | `apis/services/course-api.ts#deleteCourseEvent` | `pages/CourseEventsPage/index.tsx` | wired |
| `courseEventGet` | `GET /v2/courses/{courseId}/events/{eventId}` | `apis/services/course-api.ts#getCourseEvent` | `pages/CourseEventsPage/index.tsx`<br>`pages/NotificationSubjectPage/index.tsx` | wired |
| `courseEventUpdate` | `PUT /v2/courses/{courseId}/events/{eventId}` | `apis/services/course-api.ts#updateCourseEvent` | `pages/CourseEventsPage/index.tsx` | wired |
| `courseGroupSetList` | `GET /v2/courses/{courseId}/group-sets` | `apis/services/course-api.ts#listGroupSets` | `pages/AssignmentEditorPage/index.tsx`<br>`pages/CourseGroupsPage/index.tsx`<br>`pages/CourseWorkspacePage/hooks/useCourseWorkspaceData.ts` | wired |
| `courseGroupSetCreate` | `POST /v2/courses/{courseId}/group-sets` | `apis/services/course-api.ts#createGroupSet` | `pages/CourseGroupsPage/index.tsx` | wired |
| `courseGroupSetDelete` | `DELETE /v2/courses/{courseId}/group-sets/{groupSetId}` | `apis/services/course-api.ts#deleteGroupSet` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupSetGet` | `GET /v2/courses/{courseId}/group-sets/{groupSetId}` | `apis/services/course-api.ts#getGroupSet` | `pages/GroupSetDetailPage/index.tsx`<br>`pages/NotificationSubjectPage/index.tsx` | wired |
| `courseGroupSetPatch` | `PATCH /v2/courses/{courseId}/group-sets/{groupSetId}` | `apis/services/course-api.ts#patchGroupSet` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupDistributeRandom` | `POST /v2/courses/{courseId}/group-sets/{groupSetId}/distribute-random` | `apis/services/course-api.ts#distributeGroupsRandomly` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupCreate` | `POST /v2/courses/{courseId}/group-sets/{groupSetId}/groups` | `apis/services/course-api.ts#createGroup` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupBatchCreate` | `POST /v2/courses/{courseId}/group-sets/{groupSetId}/groups/batch` | `apis/services/course-api.ts#batchCreateGroups` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupDelete` | `DELETE /v2/courses/{courseId}/group-sets/{groupSetId}/groups/{groupId}` | `apis/services/course-api.ts#deleteGroup` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupPatch` | `PATCH /v2/courses/{courseId}/group-sets/{groupSetId}/groups/{groupId}` | `apis/services/course-api.ts#patchGroup` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupJoin` | `POST /v2/courses/{courseId}/group-sets/{groupSetId}/groups/{groupId}/join` | `apis/services/course-api.ts#joinGroup` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupLeave` | `POST /v2/courses/{courseId}/group-sets/{groupSetId}/groups/{groupId}/leave` | `apis/services/course-api.ts#leaveGroup` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupMemberAssign` | `POST /v2/courses/{courseId}/group-sets/{groupSetId}/groups/{groupId}/members` | `apis/services/course-api.ts#assignGroupMember` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupMemberRemove` | `DELETE /v2/courses/{courseId}/group-sets/{groupSetId}/groups/{groupId}/members/{userId}` | `apis/services/course-api.ts#removeGroupMember` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupMemberMove` | `POST /v2/courses/{courseId}/group-sets/{groupSetId}/members/{userId}/move` | `apis/services/course-api.ts#moveGroupMember` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupSwitch` | `POST /v2/courses/{courseId}/group-sets/{groupSetId}/switch` | `apis/services/course-api.ts#switchGroup` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseGroupUngroupedStudents` | `GET /v2/courses/{courseId}/group-sets/{groupSetId}/ungrouped-students` | `apis/services/course-api.ts#listUngroupedStudents` | `pages/GroupSetDetailPage/index.tsx` | wired |
| `courseMaterialAssignmentLinkDetach` | `DELETE /v2/courses/{courseId}/materials/{materialId}/assignment-links/{assignmentId}` | `apis/services/course-operations-api.ts#detachMaterialFromAssignment` | `pages/CourseOperationsPage/index.tsx` | wired |
| `courseMaterialAssignmentLinkAttach` | `POST /v2/courses/{courseId}/materials/{materialId}/assignment-links/{assignmentId}` | `apis/services/course-operations-api.ts#attachMaterialToAssignment` | `pages/CourseOperationsPage/index.tsx` | wired |
| `courseMaterialLectureLinkDetach` | `DELETE /v2/courses/{courseId}/materials/{materialId}/lecture-links/{lectureId}` | `apis/services/course-operations-api.ts#detachMaterialFromLecture` | `pages/CourseOperationsPage/index.tsx` | wired |
| `courseMaterialLectureLinkAttach` | `POST /v2/courses/{courseId}/materials/{materialId}/lecture-links/{lectureId}` | `apis/services/course-operations-api.ts#attachMaterialToLecture` | `pages/CourseOperationsPage/index.tsx` | wired |
| `courseMaterialLinksGet` | `GET /v2/courses/{courseId}/materials/{materialId}/links` | `apis/services/course-operations-api.ts#getMaterialLinks` | `pages/CourseOperationsPage/index.tsx` | wired |
| `courseMemberList` | `GET /v2/courses/{courseId}/members` | `apis/services/course-api.ts#listCourseMembers` | `pages/AdminConsolePage/components/CourseMembershipPanel.tsx`<br>`pages/QuizGradingPage/index.tsx`<br>`pages/RosterPage/useRoster.ts` | wired |
| `reviewCourseScheduleRequest` | `POST /v2/courses/{courseId}/schedule-requests/{requestId}/instructor-review` | `apis/services/course-operations-api.ts#reviewCourseScheduleRequest` | `pages/CourseOperationsPage/index.tsx` | wired |
| `listSessionOccurrences` | `GET /v2/courses/{courseId}/session-occurrences` | `apis/services/course-operations-api.ts#listSessionOccurrences` | `pages/CourseOperationsPage/index.tsx` | wired |
| `createSessionOccurrence` | `POST /v2/courses/{courseId}/session-occurrences` | `apis/services/course-operations-api.ts#createSessionOccurrence` | `pages/CourseOperationsPage/index.tsx` | wired |
| `generateSessionOccurrences` | `POST /v2/courses/{courseId}/session-occurrences/generate` | `apis/services/course-operations-api.ts#generateSessionOccurrences` | `pages/CourseOperationsPage/index.tsx`<br>`pages/TenantCourseDeliveryPage/OwnerCourseSchedule.tsx` | wired |
| `getSessionOccurrence` | `GET /v2/courses/{courseId}/session-occurrences/{occurrenceId}` | `apis/services/course-operations-api.ts#getSessionOccurrence` | `pages/CourseOperationsPage/index.tsx` | wired |
| `getOccurrenceAttendance` | `GET /v2/courses/{courseId}/session-occurrences/{occurrenceId}/attendance` | `apis/services/course-operations-api.ts#getOccurrenceAttendance` | `pages/CourseOperationsPage/index.tsx` | wired |
| `saveOccurrenceAttendance` | `PUT /v2/courses/{courseId}/session-occurrences/{occurrenceId}/attendance` | `apis/services/course-operations-api.ts#saveOccurrenceAttendance` | `pages/CourseOperationsPage/index.tsx` | wired |
| `getOwnOccurrenceAttendance` | `GET /v2/courses/{courseId}/session-occurrences/{occurrenceId}/attendance/me` | `apis/services/course-operations-api.ts#getOwnOccurrenceAttendance` | `pages/MyOperationsPage/index.tsx` | wired |
| `syncOccurrenceAttendanceRoster` | `POST /v2/courses/{courseId}/session-occurrences/{occurrenceId}/attendance/roster-sync` | `apis/services/course-operations-api.ts#syncOccurrenceAttendanceRoster` | `pages/CourseOperationsPage/index.tsx` | wired |
| `cancelSessionOccurrence` | `POST /v2/courses/{courseId}/session-occurrences/{occurrenceId}/cancel` | `apis/services/course-operations-api.ts#cancelSessionOccurrence` | `pages/CourseOperationsPage/index.tsx` | wired |
| `rescheduleSessionOccurrence` | `POST /v2/courses/{courseId}/session-occurrences/{occurrenceId}/reschedule` | `apis/services/course-operations-api.ts#rescheduleSessionOccurrence` | `pages/CourseOperationsPage/index.tsx` | wired |
| `listCourseScheduleRequests` | `GET /v2/courses/{courseId}/session-occurrences/{occurrenceId}/schedule-requests` | `apis/services/course-operations-api.ts#listCourseScheduleRequests` | `pages/CourseOperationsPage/index.tsx` | wired |
| `createCourseScheduleRequest` | `POST /v2/courses/{courseId}/session-occurrences/{occurrenceId}/schedule-requests` | `apis/services/course-operations-api.ts#createCourseScheduleRequest` | `pages/CourseOperationsPage/index.tsx`<br>`pages/MyOperationsPage/index.tsx` | wired |
| `courseSessionList` | `GET /v2/courses/{courseId}/sessions` | `apis/services/course-api.ts#getCourseSessions` | `pages/CalendarPage/calendarData.ts`<br>`pages/CourseCataloguePage/components/CoursePreview.tsx`<br>`pages/CourseSchedulePage/index.tsx`<br>`pages/CourseWorkspacePage/hooks/useCourseWorkspaceData.ts`<br>`pages/TenantCourseDeliveryPage/OwnerCourseSchedule.tsx` | wired |
| `courseSessionCreate` | `POST /v2/courses/{courseId}/sessions` | `apis/services/course-api.ts#createCourseSession` | `pages/CourseSchedulePage/index.tsx`<br>`pages/TenantCourseDeliveryPage/OwnerCourseSchedule.tsx` | wired |
| `courseSessionDelete` | `DELETE /v2/courses/{courseId}/sessions/{sessionId}` | `apis/services/course-api.ts#deleteCourseSession` | `pages/CourseSchedulePage/index.tsx` | wired |
| `courseSessionGet` | `GET /v2/courses/{courseId}/sessions/{sessionId}` | — | Schedule / quiz / course workspace reads the collection projection; individual read is not called. | alternate workflow |
| `courseSessionUpdate` | `PUT /v2/courses/{courseId}/sessions/{sessionId}` | `apis/services/course-api.ts#updateCourseSession` | `pages/CourseSchedulePage/index.tsx` | wired |
| `listCourseStudentReports` | `GET /v2/courses/{courseId}/student-reports` | `apis/services/course-operations-api.ts#listCourseStudentReports` | `pages/CourseOperationsPage/index.tsx` | wired |
| `createCourseStudentReport` | `POST /v2/courses/{courseId}/student-reports` | `apis/services/course-operations-api.ts#createCourseStudentReport` | `pages/CourseOperationsPage/index.tsx` | wired |
| `listMyPublishedCourseReports` | `GET /v2/courses/{courseId}/student-reports/published/me` | `apis/services/course-operations-api.ts#listMyPublishedCourseReports` | `pages/MyOperationsPage/index.tsx` | wired |
| `getMyPublishedCourseReport` | `GET /v2/courses/{courseId}/student-reports/published/me/{reportId}` | `apis/services/course-operations-api.ts#getMyPublishedCourseReport` | `pages/MyOperationsPage/index.tsx` | wired |
| `getCourseStudentReport` | `GET /v2/courses/{courseId}/student-reports/{reportId}` | `apis/services/course-operations-api.ts#getCourseStudentReport` | `pages/CourseOperationsPage/index.tsx` | wired |
| `updateCourseStudentReport` | `PATCH /v2/courses/{courseId}/student-reports/{reportId}` | `apis/services/course-operations-api.ts#updateCourseStudentReport` | `pages/CourseOperationsPage/index.tsx` | wired |
| `publishCourseStudentReport` | `POST /v2/courses/{courseId}/student-reports/{reportId}/publish` | `apis/services/course-operations-api.ts#publishCourseStudentReport` | `pages/CourseOperationsPage/index.tsx` | wired |
| `courseStudentAdd` | `POST /v2/courses/{courseId}/students` | `apis/services/course-api.ts#enrolStudent` | Roster uses courseStudentAddBatch with email identifiers; the single-user variant is not called. | alternate workflow |
| `courseStudentBatch` | `POST /v2/courses/{courseId}/students/batch` | `apis/services/course-api.ts#enrolStudents` | `pages/AdminConsolePage/components/CourseMembershipPanel.tsx`<br>`pages/RosterPage/useRoster.ts` | wired |
| `courseStudentWithdraw` | `DELETE /v2/courses/{courseId}/students/{userId}` | `apis/services/course-api.ts#withdrawStudent` | `pages/RosterPage/useRoster.ts` | wired |
| `courseSyllabusClear` | `DELETE /v2/courses/{courseId}/syllabus` | `apis/services/course-api.ts#clearSyllabus` | `pages/CourseWorkspacePage/components/SyllabusCard.tsx` | wired |
| `courseSyllabusGet` | `GET /v2/courses/{courseId}/syllabus` | `apis/services/course-api.ts#getSyllabus` | `pages/CourseWorkspacePage/components/SyllabusCard.tsx` | wired |
| `courseSyllabusUpload` | `POST /v2/courses/{courseId}/syllabus` | `apis/services/course-api.ts#uploadSyllabus` | `pages/CourseWorkspacePage/components/SyllabusCard.tsx` | wired |
| `courseSyllabusDownload` | `GET /v2/courses/{courseId}/syllabus/download` | `apis/services/course-api.ts#downloadSyllabus` | `pages/CourseWorkspacePage/components/SyllabusCard.tsx` | wired |
| `courseSyllabusPreview` | `GET /v2/courses/{courseId}/syllabus/preview` | `apis/services/course-api.ts#downloadSyllabus` | `pages/CourseWorkspacePage/components/SyllabusCard.tsx` | wired |
| `courseSyllabusRestore` | `POST /v2/courses/{courseId}/syllabus/restore` | `apis/services/course-api.ts#restoreSyllabus` | `pages/CourseWorkspacePage/components/SyllabusCard.tsx` | wired |
| `courseTaAdd` | `POST /v2/courses/{courseId}/tas` | `apis/services/course-api.ts#promoteToTa` | `pages/AdminConsolePage/components/CourseMembershipPanel.tsx`<br>`pages/RosterPage/useRoster.ts` | wired |
| `courseTaRemove` | `DELETE /v2/courses/{courseId}/tas/{userId}` | `apis/services/course-api.ts#demoteTa` | `pages/AdminConsolePage/components/CourseMembershipPanel.tsx`<br>`pages/RosterPage/useRoster.ts` | wired |
| `courseTaPatchPermissions` | `PATCH /v2/courses/{courseId}/tas/{userId}/permissions` | `apis/services/course-api.ts#updateTaPermissions` | `pages/RosterPage/useRoster.ts` | wired |
| `courseWeekList` | `GET /v2/courses/{courseId}/weeks` | `apis/services/course-api.ts#getCourseWeeks` | `pages/CourseWorkspacePage/hooks/useCourseWorkspaceData.ts`<br>`pages/NotificationSubjectPage/index.tsx` | wired |
| `courseWeekCreate` | `POST /v2/courses/{courseId}/weeks` | `apis/services/course-api.ts#createWeek` | `pages/CourseWorkspacePage/components/CourseEditView/WeekEditorList.tsx` | wired |
| `courseWeekReorder` | `PUT /v2/courses/{courseId}/weeks/reorder` | `apis/services/course-api.ts#reorderWeeks` | `pages/CourseWorkspacePage/components/CourseEditView/WeekEditorList.tsx` | wired |
| `courseWeekDelete` | `DELETE /v2/courses/{courseId}/weeks/{weekId}` | `apis/services/course-api.ts#deleteWeek` | `pages/CourseWorkspacePage/components/CourseEditView/WeekEditorList.tsx`<br>`pages/CourseWorkspacePage/components/CourseUnitsManager/index.tsx` | wired |
| `courseWeekGet` | `GET /v2/courses/{courseId}/weeks/{weekId}` | `apis/services/course-api.ts#getCourseWeek` | Schedule / quiz / course workspace reads the collection projection; individual read is not called. | alternate workflow |
| `courseWeekRename` | `PATCH /v2/courses/{courseId}/weeks/{weekId}` | `apis/services/course-api.ts#renameWeek` | `pages/CourseWorkspacePage/components/CourseEditView/WeekEditorList.tsx` | wired |
| `courseWeekDownloadZip` | `GET /v2/courses/{courseId}/weeks/{weekId}/download.zip` | `apis/services/course-api.ts#downloadWeekMaterials` | `pages/CourseWorkspacePage/components/CourseDetailView/ContentCard.tsx` | wired |
| `courseMaterialCreate` | `POST /v2/courses/{courseId}/weeks/{weekId}/materials` | `apis/services/course-api.ts#createMaterials` | `pages/CourseWorkspacePage/components/CourseEditView/WeekContentCard.tsx` | wired |
| `courseMaterialReorder` | `PUT /v2/courses/{courseId}/weeks/{weekId}/materials/reorder` | `apis/services/course-api.ts#reorderMaterials` | `pages/CourseWorkspacePage/components/CourseEditView/WeekContentCard.tsx` | wired |
| `courseMaterialDelete` | `DELETE /v2/courses/{courseId}/weeks/{weekId}/materials/{materialId}` | `apis/services/course-api.ts#deleteMaterial` | `pages/CourseWorkspacePage/components/CourseEditView/WeekContentCard.tsx` | wired |
| `courseMaterialRename` | `PATCH /v2/courses/{courseId}/weeks/{weekId}/materials/{materialId}` | `apis/services/course-api.ts#renameMaterial` | `pages/CourseWorkspacePage/components/CourseEditView/WeekContentCard.tsx` | wired |
| `courseMaterialDownload` | `GET /v2/courses/{courseId}/weeks/{weekId}/materials/{materialId}/download` | `apis/services/course-api.ts#getMaterialBlob` | `pages/CourseWorkspacePage/components/CourseDetailView/ContentCard.tsx` | wired |
| `courseMaterialMove` | `POST /v2/courses/{courseId}/weeks/{weekId}/materials/{materialId}/move` | `apis/services/course-api.ts#moveMaterial` | `pages/CourseWorkspacePage/components/CourseEditView/WeekContentCard.tsx` | wired |
| `courseMaterialPreview` | `GET /v2/courses/{courseId}/weeks/{weekId}/materials/{materialId}/preview` | `apis/services/course-api.ts#getMaterialBlob` | `pages/CourseWorkspacePage/components/CourseDetailView/ContentCard.tsx` | wired |
| `courseMaterialPublish` | `POST /v2/courses/{courseId}/weeks/{weekId}/materials/{materialId}/publish` | `apis/services/course-api.ts#publishMaterial` | `pages/CourseWorkspacePage/components/CourseEditView/WeekContentCard.tsx` | wired |
| `courseMaterialUnpublish` | `POST /v2/courses/{courseId}/weeks/{weekId}/materials/{materialId}/unpublish` | `apis/services/course-api.ts#unpublishMaterial` | `pages/CourseWorkspacePage/components/CourseEditView/WeekContentCard.tsx` | wired |
| `courseWeekPublish` | `POST /v2/courses/{courseId}/weeks/{weekId}/publish` | `apis/services/course-api.ts#publishWeek` | `pages/CourseWorkspacePage/components/CourseEditView/WeekEditorList.tsx` | wired |
| `courseWeekUnpublish` | `POST /v2/courses/{courseId}/weeks/{weekId}/unpublish` | `apis/services/course-api.ts#unpublishWeek` | `pages/CourseWorkspacePage/components/CourseEditView/WeekEditorList.tsx` | wired |
| `courseDelete` | `DELETE /v2/courses/{id}` | `apis/services/course-api.ts#deleteCourse` | `pages/CourseCataloguePage/components/CoursePreview.tsx`<br>`pages/CourseWorkspacePage/components/CourseUnitsManager/CourseUnitItem.tsx` | wired |
| `courseGetById` | `GET /v2/courses/{id}` | `apis/services/course-api.ts#getCourse` | `pages/CalendarPage/calendarData.ts`<br>`pages/CourseGradesPage/index.tsx`<br>`pages/CourseWorkspacePage/hooks/useCourseWorkspaceData.ts` | wired |
| `coursePatch` | `PATCH /v2/courses/{id}` | `apis/services/course-api.ts#updateCourse` | `pages/CourseWorkspacePage/components/CourseEditView/index.tsx` | wired |
| `courseArchive` | `POST /v2/courses/{id}/archive` | `apis/services/course-api.ts#archiveCourse` | `pages/CourseCataloguePage/components/CoursePreview.tsx` | wired |
| `courseReassignPrimaryInstructor` | `POST /v2/courses/{id}/primary-instructor` | `apis/services/admin-api.ts#reassignPrimaryInstructor` | `pages/AdminConsolePage/index.tsx` | wired |
| `courseUnarchive` | `POST /v2/courses/{id}/unarchive` | `apis/services/course-api.ts#unarchiveCourse` | `pages/CourseCataloguePage/components/CoursePreview.tsx` | wired |
| `meStudentAlerts` | `GET /v2/me/alerts` | `apis/services/course-operations-api.ts#getMyAlerts` | `pages/LmsHomePage/components/Dashboard.tsx`<br>`pages/MyOperationsPage/index.tsx` | wired |
| `meAnnouncementsRecent` | `GET /v2/me/announcements/recent` | `apis/services/dashboard-api.ts#getRecentAnnouncements` | `sections/posts/PostComponent.tsx` | wired |
| `meAttendanceHistory` | `GET /v2/me/attendance` | `apis/services/course-operations-api.ts#getMyAttendance` | `pages/MyOperationsPage/index.tsx` | wired |
| `meCalendar` | `GET /v2/me/calendar` | `apis/services/course-operations-api.ts#getMyCalendar` | `pages/MyOperationsPage/index.tsx` | wired |
| `meCoursesList` | `GET /v2/me/courses` | `apis/services/dashboard-api.ts#getMyCourses` | `hooks/useCourseAccess.ts`<br>`pages/CalendarPage/calendarData.ts`<br>`pages/CourseCataloguePage/index.tsx`<br>`utils/chatCourses.ts` | wired |
| `meCourseHours` | `GET /v2/me/courses/{courseId}/hours` | `apis/services/course-operations-api.ts#getMyCourseHours` | `pages/MyOperationsPage/index.tsx` | wired |
| `meEventsUpcoming` | `GET /v2/me/events/upcoming` | `apis/services/dashboard-api.ts#getUpcomingActivities` | `pages/LmsHomePage/hooks/useDashboardActivities.ts` | wired |
| `listMyPersonalEvents` | `GET /v2/me/personal-events` | `apis/services/course-operations-api.ts#listMyPersonalEvents` | `pages/MyOperationsPage/index.tsx` | wired |
| `createMyPersonalEvent` | `POST /v2/me/personal-events` | `apis/services/course-operations-api.ts#createMyPersonalEvent` | `pages/MyOperationsPage/index.tsx` | wired |
| `deleteMyPersonalEvent` | `DELETE /v2/me/personal-events/{eventId}` | `apis/services/course-operations-api.ts#deleteMyPersonalEvent` | `pages/MyOperationsPage/index.tsx` | wired |
| `getMyPersonalEvent` | `GET /v2/me/personal-events/{eventId}` | `apis/services/course-operations-api.ts#getMyPersonalEvent` | `pages/MyOperationsPage/index.tsx` | wired |
| `patchMyPersonalEvent` | `PATCH /v2/me/personal-events/{eventId}` | `apis/services/course-operations-api.ts#patchMyPersonalEvent` | `pages/MyOperationsPage/index.tsx` | wired |
| `meProgress` | `GET /v2/me/progress` | `apis/services/course-operations-api.ts#getMyProgress` | `pages/MyOperationsPage/index.tsx` | wired |
| `meScheduleRequests` | `GET /v2/me/schedule-requests` | `apis/services/course-operations-api.ts#getMyScheduleRequests` | `pages/MyOperationsPage/index.tsx` | wired |
| `meTeachingActivitiesUpcoming` | `GET /v2/me/teaching/activities/upcoming` | `apis/services/dashboard-api.ts#getTeachingActivities` | `pages/LmsHomePage/hooks/useDashboardActivities.ts` | wired |
| `meTeachingActivityRecent` | `GET /v2/me/teaching/activity/recent` | `apis/services/dashboard-api.ts#getRecentActivity` | `pages/LmsHomePage/components/InstructorWorkComponent.tsx` | wired |
| `meTeachingAlerts` | `GET /v2/me/teaching/alerts` | `apis/services/course-operations-api.ts#getMyTeachingAlerts` | `pages/LmsHomePage/components/Dashboard.tsx`<br>`pages/MyOperationsPage/TeacherOperationsSections.tsx` | wired |
| `meTeachingAvailability` | `GET /v2/me/teaching/availability` | `apis/services/course-operations-api.ts#getMyTeachingAvailability` | `pages/MyOperationsPage/TeacherOperationsSections.tsx` | wired |
| `replaceMeTeachingAvailability` | `PUT /v2/me/teaching/availability` | `apis/services/course-operations-api.ts#replaceMyTeachingAvailability` | `pages/MyOperationsPage/TeacherOperationsSections.tsx` | wired |
| `meTeachingCourses` | `GET /v2/me/teaching/courses` | `apis/services/dashboard-api.ts#getTeachingCourses` | `pages/MyOperationsPage/TeacherOperationsSections.tsx` | wired |
| `meTeachingDeadlinesUpcoming` | `GET /v2/me/teaching/deadlines/upcoming` | `apis/services/dashboard-api.ts#getTeachingDeadlines` | `pages/LmsHomePage/hooks/useDashboardAssignments.ts` | wired |
| `meTeachingGradingItems` | `GET /v2/me/teaching/grading-items` | `apis/services/course-operations-api.ts#getMyTeachingGradingItems` | `pages/MyOperationsPage/TeacherOperationsSections.tsx` | wired |
| `meTeachingGradingQueue` | `GET /v2/me/teaching/grading-queue` | `apis/services/dashboard-api.ts#getGradingQueue` | `pages/LmsHomePage/components/InstructorWorkComponent.tsx` | wired |
| `meTeachingScheduleRequests` | `GET /v2/me/teaching/schedule-requests` | `apis/services/course-operations-api.ts#getMyTeachingScheduleRequests` | `pages/MyOperationsPage/TeacherOperationsSections.tsx` | wired |
| `meTeachingStudentsNeedingSupport` | `GET /v2/me/teaching/students-needing-support` | `apis/services/course-operations-api.ts#getMyTeachingStudentsNeedingSupport` | `pages/MyOperationsPage/TeacherOperationsSections.tsx` | wired |
| `meTeachingTodayClasses` | `GET /v2/me/teaching/today-classes` | `apis/services/course-operations-api.ts#getMyTeachingTodayClasses` | `pages/MyOperationsPage/TeacherOperationsSections.tsx` | wired |
| `meWorkQueue` | `GET /v2/me/work-queue` | `apis/services/course-operations-api.ts#getMyWorkQueue` | `pages/LmsHomePage/components/Dashboard.tsx`<br>`pages/MyOperationsPage/index.tsx` | wired |
| `tenantGetAlertRules` | `GET /v2/tenant/alert-rules` | `apis/services/course-operations-api.ts#getTenantAlertRules` | `pages/AdminConsolePage/components/AdminContractOperations.tsx`<br>`pages/TenantAdminPage/AlertRulesPanel.tsx` | wired |
| `tenantPutAlertRules` | `PUT /v2/tenant/alert-rules` | `apis/services/course-operations-api.ts#putTenantAlertRules` | `pages/AdminConsolePage/components/AdminContractOperations.tsx`<br>`pages/TenantAdminPage/AlertRulesPanel.tsx` | wired |
| `tenantListCourseOwnerships` | `GET /v2/tenant/course-ownerships` | `apis/services/course-operations-api.ts#listTenantCourseOwnerships` | `pages/TenantAdminPage/OwnershipPanel.tsx` | wired |
| `tenantGetCourseOwner` | `GET /v2/tenant/courses/{courseId}/owner` | `apis/services/course-operations-api.ts#getTenantCourseOwner` | `pages/TenantAdminPage/OwnershipPanel.tsx` | wired |
| `tenantTransferCourseOwner` | `PUT /v2/tenant/courses/{courseId}/owner` | `apis/services/course-operations-api.ts#transferTenantCourseOwner` | `pages/TenantAdminPage/OwnershipPanel.tsx` | wired |
## mockexam.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `listAdvisorMockExamTemplates` | `GET /v2/advisor/mock-exam-templates` | `apis/services/mock-exam-api.ts#listAdvisorTemplates` | `pages/MockExamsPage/index.tsx` | wired |
| `getAdvisorMockExamTemplate` | `GET /v2/advisor/mock-exam-templates/{templateId}` | `apis/services/mock-exam-api.ts#getAdvisorTemplate` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `listAdvisorStudentMockExams` | `GET /v2/advisor/students/{studentUserId}/mock-exams` | `apis/services/mock-exam-api.ts#listAdvisorStudentExams` | `components/ObserverMockExams/index.tsx` | wired |
| `createAdvisorStudentMockExam` | `POST /v2/advisor/students/{studentUserId}/mock-exams` | `apis/services/mock-exam-api.ts#createAdvisorStudentExam` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `getAdvisorStudentMockExam` | `GET /v2/advisor/students/{studentUserId}/mock-exams/{studentMockExamId}` | `apis/services/mock-exam-api.ts#getAdvisorStudentExam` | `components/ObserverMockExams/index.tsx` | wired |
| `listInstructorWritingGrades` | `GET /v2/instructor/mock-exams/writing-grades` | `apis/services/mock-exam-api.ts#listInstructorWritingGrades` | `pages/MockExamsPage/index.tsx` | wired |
| `getInstructorWritingGrade` | `GET /v2/instructor/mock-exams/writing-grades/{gradeId}` | `apis/services/mock-exam-api.ts#getInstructorWritingGrade` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `gradeInstructorWriting` | `POST /v2/instructor/mock-exams/writing-grades/{gradeId}` | `apis/services/mock-exam-api.ts#gradeInstructorWriting` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `listParentStudentMockExams` | `GET /v2/parent/students/{studentUserId}/mock-exams` | `apis/services/mock-exam-api.ts#listParentStudentExams` | `components/ObserverMockExams/index.tsx` | wired |
| `getParentStudentMockExam` | `GET /v2/parent/students/{studentUserId}/mock-exams/{studentMockExamId}` | `apis/services/mock-exam-api.ts#getParentStudentExam` | `components/ObserverMockExams/index.tsx` | wired |
| `listStudentMockExams` | `GET /v2/student/mock-exams` | `apis/services/mock-exam-api.ts#listStudentExams` | `pages/LmsHomePage/components/Dashboard.tsx`<br>`pages/MockExamsPage/index.tsx` | wired |
| `getStudentMockExam` | `GET /v2/student/mock-exams/{studentMockExamId}` | `apis/services/mock-exam-api.ts#getStudentExam` | `pages/MockExamSessionPage/index.tsx` | wired |
| `createStudentMockExamAttempt` | `POST /v2/student/mock-exams/{studentMockExamId}/attempts` | `apis/services/mock-exam-api.ts#createStudentAttempt` | `pages/MockExamSessionPage/runner/api/tests.ts` | wired |
| `submitStudentMockExamListening` | `POST /v2/student/mock-exams/{studentMockExamId}/attempts/{attemptId}/listening-submissions` | `apis/services/mock-exam-api.ts#submitStudentListening` | `pages/MockExamSessionPage/runner/api/listenings.ts` | wired |
| `submitStudentMockExamReading` | `POST /v2/student/mock-exams/{studentMockExamId}/attempts/{attemptId}/reading-submissions` | `apis/services/mock-exam-api.ts#submitStudentReading` | `pages/MockExamSessionPage/runner/api/readings.ts` | wired |
| `submitStudentMockExamWriting` | `POST /v2/student/mock-exams/{studentMockExamId}/attempts/{attemptId}/writing-submissions` | `apis/services/mock-exam-api.ts#submitStudentWriting` | `pages/MockExamSessionPage/runner/api/writings.ts` | wired |
| `getStudentMockExamListening` | `GET /v2/student/mock-exams/{studentMockExamId}/listening` | `apis/services/mock-exam-api.ts#getStudentSection` | `pages/MockExamSessionPage/index.tsx` | wired |
| `getStudentMockExamListeningPartAudio` | `GET /v2/student/mock-exams/{studentMockExamId}/listening/parts/{partSeq}/audio` | `apis/services/mock-exam-api.ts#getStudentListeningAudio` | `pages/MockExamSessionPage/index.tsx` | wired |
| `getStudentMockExamReading` | `GET /v2/student/mock-exams/{studentMockExamId}/reading` | `apis/services/mock-exam-api.ts#getStudentSection` | `pages/MockExamSessionPage/index.tsx` | wired |
| `getStudentMockExamReadingQuestionImage` | `GET /v2/student/mock-exams/{studentMockExamId}/reading/passages/{passageSeq}/questions/{sortOrder}/image` | `apis/services/mock-exam-api.ts#getStudentReadingImage` | `pages/MockExamSessionPage/index.tsx` | wired |
| `getStudentMockExamWriting` | `GET /v2/student/mock-exams/{studentMockExamId}/writing` | `apis/services/mock-exam-api.ts#getStudentSection` | `pages/MockExamSessionPage/index.tsx` | wired |
| `getStudentMockExamWritingTaskImage` | `GET /v2/student/mock-exams/{studentMockExamId}/writing/tasks/{taskSeq}/image` | `apis/services/mock-exam-api.ts#getStudentWritingImage` | `pages/MockExamSessionPage/index.tsx` | wired |
| `listSystemMockExams` | `GET /v2/system/mock-exams` | `apis/services/mock-exam-api.ts#getSystemExams` | `pages/MockExamsPage/index.tsx` | wired |
| `getSystemMockExam` | `GET /v2/system/mock-exams/{testId}` | `apis/services/mock-exam-api.ts#getSystemExam` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
| `getSystemMockExamListening` | `GET /v2/system/mock-exams/{testId}/listening` | `apis/services/mock-exam-api.ts#getSystemSection` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
| `getSystemMockExamListeningPartAudio` | `GET /v2/system/mock-exams/{testId}/listening/parts/{partSeq}/audio` | `apis/services/mock-exam-api.ts#getSystemListeningAudio` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
| `getSystemMockExamReading` | `GET /v2/system/mock-exams/{testId}/reading` | `apis/services/mock-exam-api.ts#getSystemSection` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
| `getSystemMockExamReadingQuestionImage` | `GET /v2/system/mock-exams/{testId}/reading/passages/{passageSeq}/questions/{sortOrder}/image` | `apis/services/mock-exam-api.ts#getSystemReadingImage` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
| `getSystemMockExamWriting` | `GET /v2/system/mock-exams/{testId}/writing` | `apis/services/mock-exam-api.ts#getSystemSection` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
| `getSystemMockExamWritingTaskImage` | `GET /v2/system/mock-exams/{testId}/writing/tasks/{taskSeq}/image` | `apis/services/mock-exam-api.ts#getSystemWritingImage` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
| `listTenantMockExamTemplates` | `GET /v2/tenant/mock-exam-templates` | `apis/services/mock-exam-api.ts#listTenantTemplates` | `pages/MockExamsPage/index.tsx` | wired |
| `createTenantMockExamTemplate` | `POST /v2/tenant/mock-exam-templates` | `apis/services/mock-exam-api.ts#createTenantTemplate` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `getTenantMockExamTemplate` | `GET /v2/tenant/mock-exam-templates/{templateId}` | `apis/services/mock-exam-api.ts#getTenantTemplate` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `deleteTenantMockExamDraft` | `DELETE /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}` | `apis/services/mock-exam-api.ts#deleteTenantDraft` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `getTenantMockExamVersion` | `GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}` | `apis/services/mock-exam-api.ts#getTenantVersion` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `archiveTenantMockExamVersion` | `POST /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/archive` | `apis/services/mock-exam-api.ts#archiveTenantVersion` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `copyTenantMockExamVersion` | `POST /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/copies` | `apis/services/mock-exam-api.ts#copyTenantVersion` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `uploadTenantMockExamMedia` | `POST /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/media` | `apis/services/mock-exam-api.ts#uploadTenantMedia` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `listTenantMockExamMedia` | `GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/media` | `apis/services/mock-exam-api.ts#getTenantSection`<br>`apis/services/mock-exam-api.ts#listTenantMedia` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `previewTenantMockExamMedia` | `GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/media/{mediaId}/preview` | `apis/services/mock-exam-api.ts#previewTenantMedia` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `deleteTenantMockExamMedia` | `DELETE /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/media/{mediaId}` | `apis/services/mock-exam-api.ts#deleteTenantMedia` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `getTenantMockExamListening` | `GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/listening` | `apis/services/mock-exam-api.ts#getTenantSection` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `createTenantMockExamListening` | `POST /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/listening` | `apis/services/mock-exam-api.ts#createTenantListening` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `getTenantMockExamListeningPartAudio` | `GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/listening/parts/{partSeq}/audio` | `apis/services/mock-exam-api.ts#getTenantListeningAudio` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `publishTenantMockExamVersion` | `POST /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/publish` | `apis/services/mock-exam-api.ts#publishTenantVersion` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `getTenantMockExamReading` | `GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/reading` | `apis/services/mock-exam-api.ts#getTenantSection` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `createTenantMockExamReading` | `POST /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/reading` | `apis/services/mock-exam-api.ts#createTenantReading` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `getTenantMockExamReadingQuestionImage` | `GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/reading/passages/{passageSeq}/questions/{sortOrder}/image` | `apis/services/mock-exam-api.ts#getTenantReadingImage` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `getTenantMockExamWriting` | `GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/writing` | `apis/services/mock-exam-api.ts#getTenantSection` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `createTenantMockExamWriting` | `POST /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/writing` | `apis/services/mock-exam-api.ts#createTenantWriting` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
| `getTenantMockExamWritingTaskImage` | `GET /v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/writing/tasks/{taskSeq}/image` | `apis/services/mock-exam-api.ts#getTenantWritingImage` | `pages/MockExamsPage/StaffMockExamWorkspaces.tsx` | wired |
## notification.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `adminNotificationDigestRun` | `POST /v2/admin/notifications/digest/run` | `apis/services/notification-api.ts#runAdminDigest` | `pages/AdminConsolePage/components/AdminContractOperations.tsx` | wired |
| `meNotificationList` | `GET /v2/me/notifications` | `apis/services/notification-api.ts#getNotifications` | `components/NotificationCenter/index.tsx` | wired |
| `meNotificationMarkAllRead` | `PATCH /v2/me/notifications/read-all` | `apis/services/notification-api.ts#markAllRead` | `components/NotificationCenter/index.tsx` | wired |
| `meNotificationUnreadCount` | `GET /v2/me/notifications/unread-count` | `apis/services/notification-api.ts#getUnreadCount` | `components/NotificationCenter/index.tsx` | wired |
| `meNotificationMarkRead` | `PATCH /v2/me/notifications/{notificationId}/read` | `apis/services/notification-api.ts#markRead` | `components/NotificationCenter/index.tsx` | wired |
## parent.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `counsellorListParentLinks` | `GET /v2/counsellor/student-intakes/{intakeId}/parent-links` | `apis/services/parent-api.ts#listCounsellorParentLinks` | `components/ParentLinksPanel/index.tsx` | wired |
| `counsellorCreateOrReuseParentLink` | `POST /v2/counsellor/student-intakes/{intakeId}/parent-links` | `apis/services/parent-api.ts#createOrReuseParentLink` | `components/ParentLinksPanel/index.tsx` | wired |
| `counsellorLinkExistingParent` | `PUT /v2/counsellor/student-intakes/{intakeId}/parent-links/{parentUserId}` | `apis/services/parent-api.ts#linkExistingParent` | `components/ParentLinksPanel/index.tsx` | wired |
| `counsellorUnlinkParent` | `DELETE /v2/counsellor/student-intakes/{intakeId}/parent-links/{parentUserId}` | `apis/services/parent-api.ts#unlinkIntakeParent` | `components/ParentLinksPanel/index.tsx` | wired |
| `tenantListParentLinks` | `GET /v2/tenant/students/{studentUserId}/parent-links` | `apis/services/parent-api.ts#listTenantParentLinks` | `components/ParentLinksPanel/index.tsx` | wired |
| `tenantCreateOrReuseParentLink` | `POST /v2/tenant/students/{studentUserId}/parent-links` | `apis/services/parent-api.ts#createOrReuseTenantParentLink` | `components/ParentLinksPanel/index.tsx` | wired |
| `tenantLinkParent` | `PUT /v2/tenant/students/{studentUserId}/parent-links/{parentUserId}` | `apis/services/parent-api.ts#linkTenantParent` | `components/ParentLinksPanel/index.tsx` | wired |
| `tenantUnlinkParent` | `DELETE /v2/tenant/students/{studentUserId}/parent-links/{parentUserId}` | `apis/services/parent-api.ts#unlinkTenantParent` | `components/ParentLinksPanel/index.tsx` | wired |
| `advisorListParentLinks` | `GET /v2/advisor/students/{studentUserId}/parent-links` | `apis/services/parent-api.ts#listAdvisorParentLinks` | `components/ParentLinksPanel/index.tsx` | wired |
| `parentListLinkedStudents` | `GET /v2/parent/linked-students` | `apis/services/parent-api.ts#listLinkedStudents` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentGetStudentDashboard` | `GET /v2/parent/students/{studentUserId}/dashboard` | `apis/services/parent-api.ts#getStudentDashboard` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentGetStudentProfile` | `GET /v2/parent/students/{studentUserId}/profile` | `apis/services/parent-api.ts#getStudentProfile` | `pages/AdvisorStudentWorkspacePage/ProfilePage.tsx`<br>`pages/AdvisorStudentWorkspacePage/StudyPlanPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `parentGetStudentStudyPlan` | `GET /v2/parent/students/{studentUserId}/study-plan` | `apis/services/parent-api.ts#getStudentStudyPlan` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentListStudentCourses` | `GET /v2/parent/students/{studentUserId}/courses` | `apis/services/parent-api.ts#listStudentCourses` | `pages/AdvisorStudentWorkspacePage/CoursesPage.tsx`<br>`pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `parentListStudentAssignments` | `GET /v2/parent/students/{studentUserId}/assignments` | `apis/services/parent-api.ts#listStudentAssignments` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentListStudentCalendar` | `GET /v2/parent/students/{studentUserId}/calendar` | `apis/services/parent-api.ts#listStudentCalendar` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentListStudentAttendance` | `GET /v2/parent/students/{studentUserId}/attendance` | `apis/services/parent-api.ts#listStudentAttendance` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentGetStudentHours` | `GET /v2/parent/students/{studentUserId}/hours` | `apis/services/parent-api.ts#getStudentHours` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentGetStudentRisk` | `GET /v2/parent/students/{studentUserId}/risk` | `apis/services/parent-api.ts#getStudentRisk` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentListStudentReports` | `GET /v2/parent/students/{studentUserId}/reports` | `apis/services/parent-api.ts#listStudentReports` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentGetStudentReport` | `GET /v2/parent/students/{studentUserId}/reports/{reportId}` | `apis/services/parent-api.ts#getStudentReport` | `pages/ParentPortalPage/index.tsx` | wired |
| `listParentScheduleRequests` | `GET /v2/parent/students/{studentUserId}/schedule-requests` | `apis/services/parent-api.ts#listScheduleRequests` | `pages/ParentPortalPage/index.tsx` | wired |
| `createParentScheduleRequest` | `POST /v2/parent/students/{studentUserId}/schedule-requests` | `apis/services/parent-api.ts#createScheduleRequest` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentListNotifications` | `GET /v2/parent/notifications` | `apis/services/parent-api.ts#listNotifications` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentNotificationUnreadCount` | `GET /v2/parent/notifications/unread-count` | `apis/services/parent-api.ts#getNotificationUnreadCount` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentMarkNotificationRead` | `PATCH /v2/parent/notifications/{notificationId}/read` | `apis/services/parent-api.ts#markNotificationRead` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentMarkAllNotificationsRead` | `PATCH /v2/parent/notifications/read-all` | `apis/services/parent-api.ts#markAllNotificationsRead` | `pages/ParentPortalPage/index.tsx` | wired |
| `parentListConversationMessages` | `GET /v2/parent/students/{studentUserId}/conversation/messages` | `apis/services/parent-api.ts#listConversationMessages` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `parentSendConversationMessage` | `POST /v2/parent/students/{studentUserId}/conversation/messages` | `apis/services/parent-api.ts#sendConversationMessage` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `parentMarkConversationRead` | `POST /v2/parent/students/{studentUserId}/conversation/read` | `apis/services/parent-api.ts#markConversationRead` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `parentPreviewConversationAttachment` | `GET /v2/parent/students/{studentUserId}/conversation/attachments/{attachmentId}/preview` | `apis/services/parent-api.ts#getConversationAttachment` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
| `parentDownloadConversationAttachment` | `GET /v2/parent/students/{studentUserId}/conversation/attachments/{attachmentId}/download` | `apis/services/parent-api.ts#getConversationAttachment` | `pages/AdvisorStudentWorkspacePage/SupportPage.tsx`<br>`pages/ParentPortalPage/index.tsx` | wired |
## quiz.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `quizList` | `GET /v2/courses/{courseId}/quizzes` | `apis/services/quiz-api.ts#listQuizzes` | `hooks/useAiExamLockdown.ts`<br>`pages/CalendarPage/calendarData.ts`<br>`pages/CourseGradesPage/index.tsx`<br>`pages/CourseWorkspacePage/hooks/useCourseWorkspaceData.ts` | wired |
| `quizCreate` | `POST /v2/courses/{courseId}/quizzes` | `apis/services/quiz-api.ts#createQuiz` | `pages/QuizEditorPage/index.tsx` | wired |
| `quizDelete` | `DELETE /v2/courses/{courseId}/quizzes/{quizId}` | `apis/services/quiz-api.ts#deleteQuiz` | `pages/QuizEditorPage/index.tsx` | wired |
| `quizGet` | `GET /v2/courses/{courseId}/quizzes/{quizId}` | `apis/services/quiz-api.ts#getQuiz` | `pages/QuizEditorPage/index.tsx`<br>`pages/QuizGradingPage/index.tsx`<br>`pages/QuizPage/index.tsx` | wired |
| `quizPatch` | `PATCH /v2/courses/{courseId}/quizzes/{quizId}` | `apis/services/quiz-api.ts#patchQuiz` | `pages/QuizEditorPage/index.tsx` | wired |
| `quizListAttempts` | `GET /v2/courses/{courseId}/quizzes/{quizId}/attempts` | `apis/services/quiz-api.ts#listAttempts` | `pages/QuizGradingPage/index.tsx` | wired |
| `quizStartAttempt` | `POST /v2/courses/{courseId}/quizzes/{quizId}/attempts` | `apis/services/quiz-api.ts#startAttempt` | `pages/QuizPage/index.tsx` | wired |
| `quizGetCurrentAttempt` | `GET /v2/courses/{courseId}/quizzes/{quizId}/attempts/current` | `apis/services/quiz-api.ts#getCurrentAttempt`<br>`apis/services/quiz-api.ts#getAttempt` | `pages/QuizPage/index.tsx`<br>`pages/QuizGradingPage/index.tsx` | wired |
| `quizGetAttempt` | `GET /v2/courses/{courseId}/quizzes/{quizId}/attempts/{attemptId}` | `apis/services/quiz-api.ts#getAttempt` | `pages/QuizGradingPage/index.tsx` | wired |
| `quizAutosave` | `PUT /v2/courses/{courseId}/quizzes/{quizId}/attempts/{attemptId}/answers/{questionId}` | `apis/services/quiz-api.ts#autosaveAnswer` | `pages/QuizPage/index.tsx` | wired |
| `quizGradeAnswer` | `PUT /v2/courses/{courseId}/quizzes/{quizId}/attempts/{attemptId}/answers/{questionId}/grade` | `apis/services/quiz-api.ts#gradeAnswer` | `pages/QuizGradingPage/index.tsx` | wired |
| `quizGetReceipt` | `GET /v2/courses/{courseId}/quizzes/{quizId}/attempts/{attemptId}/receipt` | `apis/services/quiz-api.ts#getAttemptReceipt` | `pages/QuizPage/index.tsx` | wired |
| `quizAttemptResult` | `GET /v2/courses/{courseId}/quizzes/{quizId}/attempts/{attemptId}/result` | `apis/services/quiz-api.ts#getAttemptResult` | `pages/QuizGradingPage/index.tsx`<br>`pages/QuizPage/index.tsx` | wired |
| `quizSubmitAttempt` | `POST /v2/courses/{courseId}/quizzes/{quizId}/attempts/{attemptId}/submit` | `apis/services/quiz-api.ts#submitAttempt` | `pages/QuizPage/index.tsx` | wired |
| `quizReleaseGrades` | `POST /v2/courses/{courseId}/quizzes/{quizId}/grades/release` | `apis/services/quiz-api.ts#releaseGrades` | `pages/AssignmentGradingPage/index.tsx`<br>`pages/QuizGradingPage/index.tsx` | wired |
| `quizRetractGrades` | `POST /v2/courses/{courseId}/quizzes/{quizId}/grades/retract` | `apis/services/quiz-api.ts#retractGrades` | `pages/AssignmentGradingPage/index.tsx`<br>`pages/QuizGradingPage/index.tsx` | wired |
| `quizGradingSummary` | `GET /v2/courses/{courseId}/quizzes/{quizId}/grading-summary` | `apis/services/quiz-api.ts#getGradingSummary` | `pages/QuizGradingPage/index.tsx` | wired |
| `quizListShortAnswers` | `GET /v2/courses/{courseId}/quizzes/{quizId}/grading/questions/{questionId}/answers` | `apis/services/quiz-api.ts#listShortAnswers` | `pages/QuizGradingPage/index.tsx` | wired |
| `quizMyAttempts` | `GET /v2/courses/{courseId}/quizzes/{quizId}/my-attempts` | `apis/services/quiz-api.ts#listMyAttempts` | `pages/QuizPage/index.tsx` | wired |
| `quizMyResult` | `GET /v2/courses/{courseId}/quizzes/{quizId}/my-result` | `apis/services/quiz-api.ts#getMyResult` | `pages/CourseGradesPage/index.tsx`<br>`pages/QuizPage/index.tsx` | wired |
| `quizPublish` | `POST /v2/courses/{courseId}/quizzes/{quizId}/publish` | `apis/services/quiz-api.ts#publishQuiz` | `pages/QuizEditorPage/index.tsx`<br>`pages/QuizPage/index.tsx` | wired |
| `quizQuestionList` | `GET /v2/courses/{courseId}/quizzes/{quizId}/questions` | `apis/services/quiz-api.ts#listQuestions` | `pages/QuizEditorPage/index.tsx`<br>`pages/QuizGradingPage/index.tsx`<br>`pages/QuizPage/index.tsx` | wired |
| `quizQuestionCreate` | `POST /v2/courses/{courseId}/quizzes/{quizId}/questions` | `apis/services/quiz-api.ts#createQuestion` | `pages/QuizEditorPage/index.tsx` | wired |
| `quizQuestionReorder` | `PUT /v2/courses/{courseId}/quizzes/{quizId}/questions/order` | `apis/services/quiz-api.ts#reorderQuestions` | `pages/QuizEditorPage/index.tsx` | wired |
| `quizQuestionDelete` | `DELETE /v2/courses/{courseId}/quizzes/{quizId}/questions/{questionId}` | `apis/services/quiz-api.ts#deleteQuestion` | `pages/QuizEditorPage/index.tsx` | wired |
| `quizQuestionGet` | `GET /v2/courses/{courseId}/quizzes/{quizId}/questions/{questionId}` | — | Schedule / quiz / course workspace reads the collection projection; individual read is not called. | alternate workflow |
| `quizQuestionPatch` | `PATCH /v2/courses/{courseId}/quizzes/{quizId}/questions/{questionId}` | `apis/services/quiz-api.ts#patchQuestion` | `pages/QuizEditorPage/index.tsx` | wired |
| `quizQuestionPatchAnswerKey` | `PATCH /v2/courses/{courseId}/quizzes/{quizId}/questions/{questionId}/answer-key` | `apis/services/quiz-api.ts#patchAnswerKey` | `pages/QuizEditorPage/index.tsx` | wired |
| `quizUnpublish` | `POST /v2/courses/{courseId}/quizzes/{quizId}/unpublish` | `apis/services/quiz-api.ts#unpublishQuiz` | `pages/QuizEditorPage/index.tsx`<br>`pages/QuizPage/index.tsx` | wired |
## user.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `adminUserChangeTenant` | `PATCH /v2/admin/users/{id}/tenant` | `apis/services/admin-api.ts#changeUserTenant` | `pages/AdminConsolePage/index.tsx` | wired |
| `meProfileGet` | `GET /v2/me/profile` | `apis/services/profile-api.ts#getMyProfile` | `pages/profile/index.tsx`<br>`pages/settings/index.tsx` | wired |
| `meProfileUpdate` | `PATCH /v2/me/profile` | `apis/services/profile-api.ts#updateMyProfile` | `pages/profile/index.tsx`<br>`pages/settings/index.tsx` | wired |
| `meProfileDeleteAvatar` | `DELETE /v2/me/profile/avatar` | `apis/services/profile-api.ts#deleteAvatar` | `pages/profile/index.tsx` | wired |
| `meProfileUploadAvatar` | `PUT /v2/me/profile/avatar` | `apis/services/profile-api.ts#uploadAvatar` | `pages/profile/index.tsx` | wired |
| `userList` | `GET /v2/users` | `apis/services/admin-api.ts#listUsers` | `pages/AdminConsolePage/index.tsx` | wired |
| `userAddDisabled` | `POST /v2/users` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `userDeleteBatchDisabled` | `DELETE /v2/users/batch` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `userDeleteDisabled` | `DELETE /v2/users/{id}` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `userGetById` | `GET /v2/users/{id}` | `apis/services/admin-api.ts#getUser` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
| `userUpdateDisabled` | `PUT /v2/users/{id}` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `userPasswordStatusDisabled` | `PATCH /v2/users/{id}/password-status` | — | Disabled operation or diagnostic greeting; no business UI. | excluded |
| `userGetAvatar` | `GET /v2/users/{userId}/avatar` | `apis/services/profile-api.ts#getUserAvatar` | No direct page consumer identified; do not count as full functional acceptance. | transport / review |
## vocabulary.openapi.yaml

| Operation | HTTP path | Service | Production consumer / boundary | Status |
|---|---|---|---|---|
| `listVocabularyLists` | `GET /v1/vocabulary/lists` | `apis/services/vocabulary-api.ts#list` | `App.tsx`<br>`components/ParentLinksPanel/index.tsx`<br>`components/RecordSummaryList/index.tsx`<br>`pages/AdminConsolePage/index.tsx`<br>`pages/AdvisorStudentWorkspacePage/CoursesPage.tsx`<br>`pages/AdvisorStudentsPage/index.tsx`<br>`pages/CounsellorAssignAdvisorPage/index.tsx`<br>`pages/CounsellorIntakesPage/index.tsx`<br>`pages/LmsHomePage/components/InstructorWorkComponent.tsx`<br>`pages/MyOperationsPage/index.tsx`<br>`pages/TenantIntakesPage/index.tsx`<br>`pages/VocabularyListPage/index.tsx`<br>`pages/VocabularyPage/index.tsx`<br>`pages/VocabularySessionPage/index.tsx` | wired |
| `getVocabularyList` | `GET /v1/vocabulary/lists/{listId}` | `apis/services/vocabulary-api.ts#getList` | `pages/VocabularyListPage/index.tsx` | wired |
| `getVocabularyUnit` | `GET /v1/vocabulary/units/{unitId}` | `apis/services/vocabulary-api.ts#getUnit` | `pages/VocabularySessionPage/index.tsx` | wired |
| `startVocabularySession` | `POST /v1/vocabulary/units/{unitId}/sessions` | `apis/services/vocabulary-api.ts#startSession` | `pages/VocabularyListPage/index.tsx` | wired |
| `getVocabularySession` | `GET /v1/vocabulary/sessions/{sessionId}` | `apis/services/vocabulary-api.ts#getSession` | `pages/VocabularySessionPage/index.tsx` | wired |
| `revealVocabularyCard` | `POST /v1/vocabulary/sessions/{sessionId}/reveal` | `apis/services/vocabulary-api.ts#revealCard` | `pages/VocabularySessionPage/index.tsx` | wired |
| `rateVocabularyCard` | `POST /v1/vocabulary/sessions/{sessionId}/ratings` | `apis/services/vocabulary-api.ts#rateCard` | `pages/VocabularySessionPage/index.tsx` | wired |
| `advanceVocabularySession` | `POST /v1/vocabulary/sessions/{sessionId}/advance` | `apis/services/vocabulary-api.ts#advance` | `pages/VocabularySessionPage/index.tsx` | wired |
| `exitVocabularySession` | `POST /v1/vocabulary/sessions/{sessionId}/exit` | `apis/services/vocabulary-api.ts#exit` | `pages/VocabularySessionPage/index.tsx` | wired |
| `endVocabularySession` | `POST /v1/vocabulary/sessions/{sessionId}/end` | `apis/services/vocabulary-api.ts#endSession` | `pages/VocabularyListPage/index.tsx` | wired |
