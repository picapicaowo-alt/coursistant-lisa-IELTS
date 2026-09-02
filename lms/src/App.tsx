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
const Post = lazy(() => import("./pages/post"));
const PostDetail = lazy(() => import("./sections/posts/post-detail"));
const Roster = lazy(() => import("./pages/RosterPage"));
const Profile = lazy(() => import("./pages/profile"));
const CreateContent = lazy(() => import("./sections/dashboard/new-content/create-content"));
const AIBot = lazy(() => import("./pages/aibot"));
const Settings = lazy(() => import("./pages/settings"));
const Login = lazy(() => import("@/pages/LoginPage"));
const Signup = lazy(() => import("./pages/signup/SignUpView"));
const ForgotPassword = lazy(() => import("./pages/ForgotPasswordPage"));
const AdminConsolePage = lazy(() => import('./pages/AdminConsolePage'));
const CounsellorDashboardPage = lazy(() => import('./pages/CounsellorDashboardPage'));
const CounsellorIntakesPage = lazy(() => import('./pages/CounsellorIntakesPage'));
const CounsellorIntakeFormPage = lazy(() => import('./pages/CounsellorIntakeFormPage'));
const CounsellorAssignAdvisorPage = lazy(() => import('./pages/CounsellorAssignAdvisorPage'));
const AdvisorStudentsPage = lazy(() => import('./pages/AdvisorStudentsPage'));
const AdvisorOperationsPage = lazy(() => import('./pages/AdvisorOperationsPage'));
const AdvisorStudentLayout = lazy(() => import('./pages/AdvisorStudentWorkspacePage'));
const AdvisorStudentIntakePage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/IntakePage'));
const AdvisorStudentProfilePage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/ProfilePage'));
const AdvisorStudentStudyPlanPage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/StudyPlanPage'));
const AdvisorStudentCoursesPage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/CoursesPage'));
const AdvisorStudentSupportPage = lazy(() => import('./pages/AdvisorStudentWorkspacePage/SupportPage'));
const StudentAdvisingPage = lazy(() => import('./pages/StudentAdvisingPage'));
const ParentPortalPage = lazy(() => import('./pages/ParentPortalPage'));
const MockExamsPage = lazy(() => import('./pages/MockExamsPage'));
const MockExamSessionPage = lazy(() => import('./pages/MockExamSessionPage'));
const TenantIntakesPage = lazy(() => import('./pages/TenantIntakesPage'));
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
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<div role="status">Loading…</div>}>
          <Routes>
            <Route path="/login"
                   element={
                     <AuthLayout>
                       <Login/>
                     </AuthLayout>
                   }
            />

            <Route path="/signup"
                   element={
                     <AuthLayout>
                       <Signup/>
                     </AuthLayout>
                   }
            />

            <Route path="/forgotpassword"
                   element={
                     <AuthLayout>
                       <ForgotPassword/>
                     </AuthLayout>
                   }
            />

            <Route
              path="/mock-exams/:studentMockExamId/:section"
              element={
                <RequiredAuthProvider>
                  <RequireRoleAccess capability="mockExamSession">
                    <MockExamSessionPage/>
                  </RequireRoleAccess>
                </RequiredAuthProvider>
              }
            />

            <Route path="/" element={<RequiredAuthProvider><Layout/></RequiredAuthProvider>}>
              <Route index element={<SignedInHome/>}/>
              <Route element={<RequireRoleAccess capability="courses"/>}>
                <Route path="course" element={<CourseCataloguePage/>}/>
                <Route path="course/:courseId" element={<CourseWorkspacePage/>}/>
                <Route path="course/:courseId/operations" element={<CourseOperationsPage/>}/>
                <Route path="course/:courseId/assignments/:assignmentId" element={<AssignmentDetailPage/>}/>
                <Route path="course/:courseId/assignments/new" element={<AssignmentEditorPage/>}/>
                <Route path="course/:courseId/assignments/:assignmentId/edit" element={<AssignmentEditorPage/>}/>
                <Route path="course/:courseId/assignments/:assignmentId/grading" element={<AssignmentGradingPage/>}/>
                <Route path="course/:courseId/assignments/:assignmentId/submissions/:submissionId" element={<AssignmentSubmissionPage/>}/>
                <Route path="course/:courseId/announcements/:subjectId" element={<NotificationSubjectPage kind="announcement"/>}/>
                <Route path="course/:courseId/announcements" element={<CourseAnnouncementsPage/>}/>
                <Route path="course/:courseId/events" element={<CourseEventsPage/>}/>
                <Route path="course/:courseId/events/:eventId" element={<CourseEventsPage/>}/>
                <Route path="course/:courseId/schedule" element={<CourseSchedulePage/>}/>
                <Route path="course/:courseId/groups" element={<CourseGroupsPage/>}/>
                <Route path="course/:courseId/group-sets/:groupSetId" element={<GroupSetDetailPage/>}/>
                <Route path="course/:courseId/weeks/:subjectId" element={<NotificationSubjectPage kind="week"/>}/>
                <Route path="course/:courseId/quizzes/new" element={<QuizEditorPage/>}/>
                <Route path="course/:courseId/quizzes/:quizId" element={<QuizPage/>}/>
                <Route path="course/:courseId/quizzes/:quizId/edit" element={<QuizEditorPage/>}/>
                <Route path="course/:courseId/quizzes/:quizId/grading" element={<QuizGradingPage/>}/>
                <Route path="course/:courseId/grades" element={<CourseGradesPage/>}/>
                <Route path="course/add-content" element={<RequireRoleAccess capability="courseCreation"><CourseCreatePage/></RequireRoleAccess>}/>
              </Route>
              <Route path="calendar" element={<RequireRoleAccess capability="calendar"><CalendarPage/></RequireRoleAccess>}/>
              <Route path="my-operations" element={<RequireRoleAccess capability="myOperations"><MyOperationsPage/></RequireRoleAccess>}/>
              <Route path="post" element={<RequireRoleAccess capability="courses"><Post/></RequireRoleAccess>}/>
              <Route path="post/:postId" element={<RequireRoleAccess capability="courses"><PostDetail/></RequireRoleAccess>}/>
              <Route path="roster" element={<RequireRoleAccess capability="courseAuthoring"><Roster/></RequireRoleAccess>}/>
              <Route path="roster/:courseId" element={<RequireRoleAccess capability="courseAuthoring"><Roster/></RequireRoleAccess>}/>
              <Route path="profile" element={<Profile/>}/>
              <Route path="create/:contentType" element={<RequireRoleAccess capability="courseAuthoring"><CreateContent/></RequireRoleAccess>}/>
              <Route path="aibot" element={<RequireRoleAccess capability="aiWorkspace"><AIBot/></RequireRoleAccess>}/>
              <Route path="settings" element={<Settings/>}/>
              <Route path="admin" element={<RequireRoleAccess capability="adminConsole"><AdminConsolePage/></RequireRoleAccess>}/>
              <Route path="counsellor" element={<RequireAdvisingAccess gate="counsellor"><CounsellorDashboardPage/></RequireAdvisingAccess>}/>
              <Route path="counsellor/intakes" element={<RequireAdvisingAccess gate="counsellor"><CounsellorIntakesPage/></RequireAdvisingAccess>}/>
              <Route path="counsellor/intakes/new" element={<RequireAdvisingAccess gate="counsellor"><CounsellorIntakeFormPage/></RequireAdvisingAccess>}/>
              <Route path="counsellor/intakes/:intakeId" element={<RequireAdvisingAccess gate="counsellor"><CounsellorIntakeFormPage/></RequireAdvisingAccess>}/>
              <Route path="counsellor/intakes/:intakeId/assign" element={<RequireAdvisingAccess gate="counsellor"><CounsellorAssignAdvisorPage/></RequireAdvisingAccess>}/>
              <Route path="advisor/students" element={<RequireAdvisingAccess gate="advisor"><AdvisorStudentsPage/></RequireAdvisingAccess>}/>
              <Route path="advisor/operations" element={<RequireAdvisingAccess gate="advisor"><AdvisorOperationsPage/></RequireAdvisingAccess>}/>
              <Route path="advisor/students/:studentUserId" element={<RequireAdvisingAccess gate="advisor"><AdvisorStudentLayout/></RequireAdvisingAccess>}>
                <Route index element={<Navigate to="intake" replace/>}/>
                <Route path="intake" element={<AdvisorStudentIntakePage/>}/>
                <Route path="profile" element={<AdvisorStudentProfilePage/>}/>
                <Route path="study-plan" element={<AdvisorStudentStudyPlanPage/>}/>
                <Route path="courses" element={<AdvisorStudentCoursesPage/>}/>
                <Route path="support" element={<AdvisorStudentSupportPage/>}/>
              </Route>
              <Route path="my-plan" element={<RequireAdvisingAccess gate="student"><StudentAdvisingPage/></RequireAdvisingAccess>}/>
              <Route path="parent" element={<RequireAdvisingAccess gate="parent"><ParentPortalPage/></RequireAdvisingAccess>}/>
              <Route path="mock-exams" element={<RequireRoleAccess capability="mockExams"><MockExamsPage/></RequireRoleAccess>}/>
              <Route path={VOCABULARY_ROUTE_PATTERNS.root} element={<RequireVocabularyStudent><VocabularyPage/></RequireVocabularyStudent>}/>
              <Route path={VOCABULARY_ROUTE_PATTERNS.list} element={<RequireVocabularyStudent><VocabularyListPage/></RequireVocabularyStudent>}/>
              <Route path={VOCABULARY_ROUTE_PATTERNS.session} element={<RequireVocabularyStudent><VocabularySessionPage/></RequireVocabularyStudent>}/>
              <Route path="admin/intakes" element={<RequireAdvisingAccess gate="tenantAdmin"><TenantIntakesPage/></RequireAdvisingAccess>}/>
              <Route path="admin/students/:studentUserId" element={<RequireAdvisingAccess gate="tenantAdmin"><TenantStudentRecordPage/></RequireAdvisingAccess>}/>
              <Route path="advisor/courses/:courseId/delivery" element={<RequireAdvisingAccess gate="advisor"><AdvisorCourseDeliveryPage/></RequireAdvisingAccess>}/>
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
