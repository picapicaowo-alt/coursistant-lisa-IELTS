import {formatInstructorName} from '@/utils/personName';
import React, {Suspense, useState} from "react";
import {Navigate, useNavigate} from "react-router-dom";
import styles from "./index.module.scss";
import {useTranslation} from "react-i18next";
import {CoursePreview} from "./components/CoursePreview";
import {LoadingOverlay} from "@/components/LoadingOverlay";
import {useSuspenseQuery} from "@tanstack/react-query";
import {dashboardApiService} from "@/apis/services/dashboard-api";
import {CourseState, unwrapData} from "@/apis";
import {useRequiredAuth} from "@/contexts/RequiredAuthContext";
import {courseApiService} from "@/apis/services/course-api";
import {
  canAccessCourseCatalogue,
  canAccessCourseOperations,
  canCreateCourses,
  isAdvisorAccount,
  isStudentAccount,
} from '@/utils/roleCapabilities';
import {useStudentProgress} from '@/hooks/useStudentProgress';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {getSignedInHomePath} from '@/utils/signedInHomePath';
import {CourseCardGrid} from '@/components/CourseIdentityCard/CourseCardGrid';

const CourseCataloguePage: React.FC = () => {
  const {t} = useTranslation("course");
  const navigate = useNavigate();
  const {user} = useRequiredAuth();
  const isUserAccount = user.role === 'USER';
  const canCreateCourse = canCreateCourses(user);
  const [courseState, setCourseState] = useState<CourseState | undefined>(undefined);

  const [courseView, setCourseView] = useState<'CURRENT' | 'COMPLETED'>('CURRENT');
  const student = isStudentAccount(user);

  const [view, setView] = useState<'grid' | 'list'>('grid');

  if (!canAccessCourseCatalogue(user)) {
    return <Navigate to={getSignedInHomePath(user)} replace/>;
  }
  
  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentContainer}>
        {user.level === 'INSTRUCTOR' ? <p className={styles.eyebrow}>Course operations <span>/</span> My courses</p> : null}
        <h1 className={styles.pageTitle}>{isUserAccount ? t("list.tabs.myCourses") : 'Courses'}</h1>
        <div className={styles.tabsContainer}>
          {student ? (['CURRENT', 'COMPLETED'] as const).map(value => <button key={value} type="button" className={`${styles.tab} ${courseView === value ? styles.active : ''}`} aria-pressed={courseView === value} onClick={() => setCourseView(value)}>{value === 'CURRENT' ? 'Current' : 'Completed'}</button>) : ([{value: undefined, label: 'All Status'}, {value: 'Active', label: 'Active'}, {value: 'Archived', label: 'Archived'}] as const).map(tab => <button key={tab.label} type="button" className={`${styles.tab} ${courseState === tab.value ? styles.active : ''}`} aria-pressed={courseState === tab.value} onClick={() => setCourseState(tab.value)}>{tab.label}</button>)}
          <div className={styles.tabSpacer}/>
          
          {canCreateCourse ? (
            <button
              className={styles.addButton}
              onClick={() => navigate(APP_ROUTE_PATHS.courseAddContent)}
            >
              <span className={styles.addIcon}>+</span>
              <span className={styles.addText}>
                {t("list.newContent")}
              </span>
            </button>
          ) : null}
          <div className={styles.viewToggle} aria-label="Course display"><button type="button" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><img src="/icons/figma-courses/grid.svg" alt=""/></button><button type="button" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><img src="/icons/figma-courses/list.svg" alt=""/></button></div>
        </div>
        <Suspense fallback={<LoadingOverlay/>}>
          <CoursesList key={student ? courseView : courseState} state={student ? undefined : courseState} courseView={student ? courseView : undefined} view={view}/>
        </Suspense>
      </div>
    </div>
  );
};

const PAGE_SIZE = 20;

const CoursesList: React.FC<{state?: CourseState; courseView?: 'CURRENT' | 'COMPLETED'; view: 'grid' | 'list'}> = ({state, courseView, view}) => {
  const {t} = useTranslation("course");
  const {user} = useRequiredAuth();
  const isUserAccount = user.role === 'USER';
  const [currentPage, setCurrentPage] = useState(1);
  const studentProgress = useStudentProgress(isStudentAccount(user));

  /**
   * The user's own courses.
   *
   * Not `GET /v2/courses`: that is the tenant-wide browse listing, it answers
   * 403 ACCESS_DENIED for any plain Student or TA, and it returns a page
   * object rather than the array this page used to assume. `/v2/me/courses`
   * is the endpoint every USER account can call for their own enrolments.
   */
  const {data} = useSuspenseQuery({
    queryKey: [isUserAccount ? 'my-courses' : 'admin-courses', user.id, state, courseView, currentPage],
    queryFn: async () => {
      const params = {
        state,
        courseView,
        page: currentPage - 1,
        size: PAGE_SIZE,
      } as const;
      if (isUserAccount) {
        const response = await dashboardApiService.getMyCourses(params);
        return unwrapData(response, 'getMyCourses');
      }
      const response = await courseApiService.browseCourses(params);
      return unwrapData(response, 'browseCourses');
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const courses = data.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data.total ?? 0) / (data.size || PAGE_SIZE)));

  if (courses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>{t(courseView === 'COMPLETED' ? 'list.noCompletedCourses' : courseView === 'CURRENT' ? 'list.noCurrentCourses' : 'list.noCourses')}</p>
      </div>
    );
  }

  return (
    <React.Fragment>
      <CourseCardGrid view={view}>
        {courses.map((course) => (
          <CoursePreview
            key={course.id}
            id={course.id}
            courseCode={course.courseCode}
            title={course.title}
            state={course.state}
            instructorName={formatInstructorName(course.primaryInstructor) || null}
            progress={studentProgress.data?.courses?.find(item => item.courseId === course.id)}
            progressLoading={studentProgress.isFetching}
            progressFailed={studentProgress.isError}
            showProgress={isStudentAccount(user)}
            // Archiving is a Course Manager action. A TA never qualifies, no
            // matter which permission flags it holds, so this checks the
            // enrolment role rather than any of them.
            canManage={!('launchState' in course && course.launchState) && (!isUserAccount || ('courseRole' in course && (course.courseRole ?? course.role) === 'Instructor'))}
            showOperations={canAccessCourseOperations(user, 'courseRole' in course ? course.courseRole ?? course.role : null)}
            showDelivery={isAdvisorAccount(user)}
          />
        ))}
      </CourseCardGrid>

      {totalPages > 1 && (
        <div className={styles.paginationContainer}>
          <button
            className={styles.paginationButton}
            aria-label="Previous course page"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <svg className={styles.arrowIcon} viewBox="0 0 24 24">
              <path fill="currentColor" d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
            </svg>
          </button>
          
          <div className={styles.pageNumbers}>
            {Array.from({length: Math.min(totalPages, 5)}, (_, offset) => Math.min(Math.max(currentPage - 2, 1), Math.max(totalPages - 4, 1)) + offset).map(page => (
              <button
                key={page}
                aria-label={`Course page ${page}`}
                aria-current={currentPage === page ? 'page' : undefined}
                className={`${styles.pageButton} ${currentPage === page ? styles.active : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            className={styles.paginationButton}
            aria-label="Next course page"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            <svg className={styles.arrowIcon} viewBox="0 0 24 24">
              <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
          </button>
        </div>
      )}
    </React.Fragment>
  );
}

export default CourseCataloguePage;
