import {useTranslation} from 'react-i18next';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {ASSIGNMENT_GRADING_ROUTE} from '@/configs/coursePaths';
import {Suspense, lazy} from "react";
import {BrowserRouter as Router, Navigate, Routes, Route} from "react-router-dom";
import {AuthProvider} from "./contexts/AuthContext";
import AuthLayout from "./layouts/AuthLayout";
import {RequiredAuthProvider, useRequiredAuth} from "@/contexts/RequiredAuthContext";
import {RequireAdvisingAccess} from "@/pages/advising/RequireAdvisingAccess";
import {RequireRoleAccess} from "@/components/RequireRoleAccess";
import {getSignedInHomePath} from "@/utils/signedInHomePath";
import {RequireVocabularyStudent} from '@/pages/vocabulary/RequireVocabularyStudent';
import {VOCABULARY_ROUTE_PATTERNS} from '@/pages/vocabulary/routes';

const Layout = lazy(() => import("./layouts/Layout"));
const LMSHome = lazy(() => import("./pages/LmsHomePage"));
const CourseCataloguePage = lazy(() => import("./pages/CourseCataloguePage"));
const CourseWorkspacePage = lazy(() => import("./pages/CourseWorkspacePage"));
const CourseCreatePage = lazy(() => import("./pages/CourseWorkspacePage/CourseCreatePage"));
const AssignmentDetailPage = lazy(() => import('./pages/AssignmentDetailPage'));
const AssignmentEditorPage = lazy(() => import('./pages/AssignmentEditorPage'));
const AssignmentGradingPage = lazy(() => import('./pages/AssignmentGradingPage'));
const AssignmentSubmissionPage = lazy(() => import('./pages/AssignmentSubmissionPage'));
const NotificationSubjectPage = lazy(() => import('./pages/NotificationSubjectPage'));
const CourseEventsPage = lazy(() => import('./pages/CourseEventsPage'));
const CourseAnnouncementsPage = lazy(() => import('./pages/CourseAnnouncementsPage'));
const CourseSchedulePage = lazy(() => import('./pages/CourseSchedulePage'));
const CourseGroupsPage = lazy(() => import('./pages/CourseGroupsPage'));
const GroupSetDetailPage = lazy(() => import('./pages/GroupSetDetailPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const QuizEditorPage = lazy(() => import('./pages/QuizEditorPage'));
const QuizGradingPage = lazy(() => import('./pages/QuizGradingPage'));
const CourseGradesPage = lazy(() => import('./pages/CourseGradesPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const Roster = lazy(() => import("./pages/RosterPage"));
const Profile = lazy(() => import("./pages/profile"));
const AIBot = lazy(() => import("./pages/aibot"));
const Settings = lazy(() => import("./pages/settings"));
const Login = lazy(() => import("@/pages/LoginPage"));
const ForgotPassword = lazy(() => import("./pages/ForgotPasswordPage"));
const AdminLandingPage = lazy(() => import('./pages/AdminLandingPage'));
const CounsellorDashboardPage = lazy(() => import('./pages/CounsellorDashboardPage'));
const CounsellorIntakesPage = lazy(() => import('./pages/CounsellorIntakesPage'));
const CounsellorIntakeFormPage = lazy(() => import('./pages/CounsellorIntakeFormPage'));
const CounsellorAssignAdvisorPage = lazy(() => import('./pages/CounsellorAssignAdvisorPage'));
const AdvisorStudentsPage = lazy(() => import('./pages/AdvisorStudentsPage'));
const AdvisorOperationsPage = lazy(() => import('./pages/AdvisorOperationsPage'));
const AdvisorTasksPage = lazy(() => import('./pages/AdvisorOperationsPage/AdvisorTasksPage'));
const AdvisorCoursesPage = lazy(() => import('./pages/AdvisorOperationsPage/AdvisorCoursesPage'));
const AdvisorSchedulePage = lazy(() => import('./pages/AdvisorOperationsPage/AdvisorSchedulePage'));
const AdvisorMessagesPage = lazy(() => import('@/pages/AdvisorMessagesPage'));
const AdvisorStudentLayout = lazy(() => import('./pages/AdvisorStudentWorkspacePage'));
const AdvisorStudentIntakePage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/IntakePage'));
const AdvisorStudentProfilePage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/ProfilePage'));
const AdvisorStudentStudyPlanPage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/StudyPlanPage'));
const AdvisorStudentCoursesPage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/CoursesPage'));
const AdvisorStudentSupportPage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/SupportPage'));
const AdvisorStudentExamsPage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/ExamsPage'));
const StudentAdvisingPage = lazy(() => import('./pages/StudentAdvisingPage'));
const ParentPortalPage = lazy(() => import('./pages/ParentPortalPage'));
const MockExamsPage = lazy(() => import('./pages/MockExamsPage'));
const MockExamSessionPage = lazy(() => import('./pages/MockExamSessionPage'));
const TenantIntakesPage = lazy(() => import('./pages/TenantIntakesPage'));
const TenantDashboardPage = lazy(() => import('./pages/TenantDashboardPage'));
const TenantStudentRecordPage = lazy(() => import('./pages/TenantStudentRecordPage'));
const AdvisorCourseDeliveryPage = lazy(() => import('./pages/TenantCourseDeliveryPage'));
const CourseOperationsPage = lazy(() => import('./pages/CourseOperationsPage'));
const MyOperationsPage = lazy(() => import('./pages/MyOperationsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const VocabularyPage = lazy(() => import('./pages/VocabularyPage'));
const VocabularyListPage = lazy(() => import('./pages/VocabularyListPage'));
const VocabularySessionPage = lazy(() => import('./pages/VocabularySessionPage'));

const SignedInHome = () => {
  const {user} = useRequiredAuth();
  const home = getSignedInHomePath(user);
  if (home !== '/') return <Navigate to={home} replace/>;
  return <LMSHome/>;
};

const App = () => {
  const {t: translate} = useTranslation();
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<div role="status">{translate("common:feedback.loading")}</div>}>
          <Routes>
            <Route path={APP_ROUTE_PATHS.login}
                   element={
                     <AuthLayout>
                       <Login/>
                     </AuthLayout>
                   }
            />

            {/* Public self-registration is closed, including bookmarked signup links. */}
            <Route path={APP_ROUTE_PATHS.signup} element={<Navigate to={APP_ROUTE_PATHS.login} replace/>}/>

            <Route path={APP_ROUTE_PATHS.forgotpassword}
                   element={
                     <AuthLayout>
                       <ForgotPassword/>
                     </AuthLayout>
                   }
            />

            <Route
              path={APP_ROUTE_PATHS.mockExamsStudentMockExamIdSection}
              element={
                <RequiredAuthProvider>
                  <RequireRoleAccess capability="mockExamSession">
                    <MockExamSessionPage/>
                  </RequireRoleAccess>
                </RequiredAuthProvider>
              }
            />

            <Route path={APP_ROUTE_PATHS.home} element={<RequiredAuthProvider><Layout/></RequiredAuthProvider>}>
              <Route index element={<SignedInHome/>}/>
              <Route element={<RequireRoleAccess capability="courses"/>}>
                <Route path={APP_ROUTE_PATHS.course} element={<CourseCataloguePage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseId} element={<CourseWorkspacePage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdOperations} element={<CourseOperationsPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdAssignmentsAssignmentId} element={<AssignmentDetailPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdAssignmentsNew} element={<AssignmentEditorPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdAssignmentsAssignmentIdEdit} element={<AssignmentEditorPage/>}/>
                <Route path={ASSIGNMENT_GRADING_ROUTE} element={<AssignmentGradingPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdAssignmentsAssignmentIdSubmissionsSubmissionId} element={<AssignmentSubmissionPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdAnnouncementsSubjectId} element={<NotificationSubjectPage kind="announcement"/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdAnnouncements} element={<CourseAnnouncementsPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdEvents} element={<CourseEventsPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdEventsEventId} element={<CourseEventsPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdSchedule} element={<CourseSchedulePage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdGroups} element={<CourseGroupsPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdGroupSetsGroupSetId} element={<GroupSetDetailPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdWeeksSubjectId} element={<NotificationSubjectPage kind="week"/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdQuizzesNew} element={<QuizEditorPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdQuizzesQuizId} element={<QuizPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdQuizzesQuizIdEdit} element={<QuizEditorPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdQuizzesQuizIdGrading} element={<QuizGradingPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseCourseIdGrades} element={<CourseGradesPage/>}/>
                <Route path={APP_ROUTE_PATHS.courseAddContent} element={<RequireRoleAccess capability="courseCreation"><CourseCreatePage/></RequireRoleAccess>}/>
              </Route>
              <Route path={APP_ROUTE_PATHS.calendar} element={<RequireRoleAccess capability="calendar"><CalendarPage/></RequireRoleAccess>}/>
              <Route path={APP_ROUTE_PATHS.myOperations} element={<RequireRoleAccess capability="myOperations"><MyOperationsPage/></RequireRoleAccess>}/>
              <Route path={APP_ROUTE_PATHS.post} element={<RequireRoleAccess capability="courses"><Navigate to={APP_ROUTE_PATHS.course} replace/></RequireRoleAccess>}/>
              <Route path={APP_ROUTE_PATHS.postPostId} element={<RequireRoleAccess capability="courses"><Navigate to={APP_ROUTE_PATHS.course} replace/></RequireRoleAccess>}/>
              <Route path={APP_ROUTE_PATHS.roster} element={<RequireRoleAccess capability="courseRoster"><Roster/></RequireRoleAccess>}/>
              <Route path={APP_ROUTE_PATHS.rosterCourseId} element={<RequireRoleAccess capability="courseRoster"><Roster/></RequireRoleAccess>}/>
              <Route path={APP_ROUTE_PATHS.profile} element={<RequireRoleAccess capability="selfProfile"><Profile/></RequireRoleAccess>}/>
              {/* Legacy creation links have no course identity; select a course to use its real editors. */}
              <Route path={APP_ROUTE_PATHS.createContentType} element={<RequireRoleAccess capability="courseAuthoring"><Navigate to={APP_ROUTE_PATHS.course} replace/></RequireRoleAccess>}/>
              <Route path={APP_ROUTE_PATHS.aibot} element={<RequireRoleAccess capability="aiWorkspace"><AIBot/></RequireRoleAccess>}/>
              <Route path={APP_ROUTE_PATHS.settings} element={<Settings/>}/>
              <Route path={APP_ROUTE_PATHS.admin} element={<RequireRoleAccess capability="adminConsole"><AdminLandingPage/></RequireRoleAccess>}/>
              <Route path={APP_ROUTE_PATHS.counsellor} element={<RequireAdvisingAccess gate="counsellor"><CounsellorDashboardPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.counsellorIntakes} element={<RequireAdvisingAccess gate="counsellor"><CounsellorIntakesPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.counsellorIntakesNew} element={<RequireAdvisingAccess gate="counsellor"><CounsellorIntakeFormPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.counsellorIntakesIntakeId} element={<RequireAdvisingAccess gate="counsellor"><CounsellorIntakeFormPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.counsellorIntakesIntakeIdAssign} element={<RequireAdvisingAccess gate="counsellor"><CounsellorAssignAdvisorPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.advisorStudents} element={<RequireAdvisingAccess gate="advisor"><AdvisorStudentsPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.advisorOperations} element={<RequireAdvisingAccess gate="advisor"><AdvisorOperationsPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.advisorTasks} element={<RequireAdvisingAccess gate="advisor"><AdvisorTasksPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.advisorCourses} element={<RequireAdvisingAccess gate="advisor"><AdvisorCoursesPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.advisorSchedule} element={<RequireAdvisingAccess gate="advisor"><AdvisorSchedulePage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.advisorMessages} element={<RequireAdvisingAccess gate="advisor"><AdvisorMessagesPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.advisorStudentsStudentUserId} element={<RequireAdvisingAccess gate="advisor"><AdvisorStudentLayout/></RequireAdvisingAccess>}>
                <Route index element={<Navigate to="intake" replace/>}/>
                <Route path={APP_ROUTE_PATHS.advisorStudentsStudentUserIdIntake} element={<AdvisorStudentIntakePage/>}/>
                <Route path={APP_ROUTE_PATHS.advisorStudentsStudentUserIdProfile} element={<AdvisorStudentProfilePage/>}/>
                <Route path={APP_ROUTE_PATHS.advisorStudentsStudentUserIdStudyPlan} element={<AdvisorStudentStudyPlanPage/>}/>
                <Route path={APP_ROUTE_PATHS.advisorStudentsStudentUserIdCourses} element={<AdvisorStudentCoursesPage/>}/>
                <Route path={APP_ROUTE_PATHS.advisorStudentsStudentUserIdSupport} element={<AdvisorStudentSupportPage/>}/>
                <Route path={APP_ROUTE_PATHS.advisorStudentsStudentUserIdExams} element={<AdvisorStudentExamsPage/>}/>
              </Route>
              <Route path={APP_ROUTE_PATHS.myPlan} element={<RequireAdvisingAccess gate="student"><StudentAdvisingPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.parent} element={<RequireAdvisingAccess gate="parent"><ParentPortalPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.mockExams} element={<RequireRoleAccess capability="mockExams"><MockExamsPage/></RequireRoleAccess>}/>
              <Route path={VOCABULARY_ROUTE_PATTERNS.root} element={<RequireVocabularyStudent><VocabularyPage/></RequireVocabularyStudent>}/>
              <Route path={VOCABULARY_ROUTE_PATTERNS.list} element={<RequireVocabularyStudent><VocabularyListPage/></RequireVocabularyStudent>}/>
              <Route path={VOCABULARY_ROUTE_PATTERNS.session} element={<RequireVocabularyStudent><VocabularySessionPage/></RequireVocabularyStudent>}/>
              <Route path={APP_ROUTE_PATHS.adminIntakes} element={<RequireAdvisingAccess gate="tenantAdmin"><TenantIntakesPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.adminDashboard} element={<RequireAdvisingAccess gate="tenantAdmin"><TenantDashboardPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.adminStudentsStudentUserId} element={<RequireAdvisingAccess gate="tenantAdmin"><TenantStudentRecordPage/></RequireAdvisingAccess>}/>
              <Route path={APP_ROUTE_PATHS.advisorCoursesCourseIdDelivery} element={<RequireAdvisingAccess gate="advisor"><AdvisorCourseDeliveryPage/></RequireAdvisingAccess>}/>
              <Route path="*" element={<NotFoundPage/>}/>
            </Route>
            <Route
              path="*"
              element={
                <AuthLayout>
                  <NotFoundPage/>
                </AuthLayout>
              }
            />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
};

export default App;
