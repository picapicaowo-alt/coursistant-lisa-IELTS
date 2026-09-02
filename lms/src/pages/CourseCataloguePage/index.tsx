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
} from '@/utils/roleCapabilities';
import {getSignedInHomePath} from '@/utils/signedInHomePath';

const CourseCataloguePage: React.FC = () => {
  const {t} = useTranslation("course");
  const navigate = useNavigate();
  const {user} = useRequiredAuth();
  const isUserAccount = user.role === 'USER';
  const canCreateCourse = canCreateCourses(user);
  const [courseState, setCourseState] = useState<CourseState>('Active');

  if (!canAccessCourseCatalogue(user)) {
    return <Navigate to={getSignedInHomePath(user)} replace/>;
  }
  
  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentContainer}>
        <div className={styles.tabsContainer}>
          <button
            type="button"
            className={`${styles.tab} ${courseState === 'Active' ? styles.active : ""}`}
            onClick={() => setCourseState('Active')}
          >
            <span className={styles.tabLabel}>
              {isUserAccount ? t("list.tabs.myCourses") : 'Courses'}
            </span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${courseState === 'Archived' ? styles.active : ""}`}
            onClick={() => setCourseState('Archived')}
          >
            <span className={styles.tabLabel}>Archived</span>
          </button>
          
          <div className={styles.tabSpacer}/>
          
          {canCreateCourse ? (
            <button
              className={styles.addButton}
              onClick={() => navigate("/course/add-content")}
            >
              <span className={styles.addIcon}>+</span>
              <span className={styles.addText}>
                {t("list.newContent")}
              </span>
            </button>
          ) : null}
        </div>
        
        <Suspense fallback={<LoadingOverlay/>}>
          <CoursesList key={courseState} state={courseState}/>
        </Suspense>
      </div>
    </div>
  );
};

const PAGE_SIZE = 20;

const CoursesList: React.FC<{state: CourseState}> = ({state}) => {
  const {t} = useTranslation("course");
  const {user} = useRequiredAuth();
  const isUserAccount = user.role === 'USER';
  const [currentPage, setCurrentPage] = useState(1);

  /**
   * The user's own courses.
   *
   * Not `GET /v2/courses`: that is the tenant-wide browse listing, it answers
   * 403 ACCESS_DENIED for any plain Student or TA, and it returns a page
   * object rather than the array this page used to assume. `/v2/me/courses`
   * is the endpoint every USER account can call for their own enrolments.
   */
  const {data} = useSuspenseQuery({
    queryKey: [isUserAccount ? 'my-courses' : 'admin-courses', user.id, state, currentPage],
    queryFn: async () => {
      const params = {
        state,
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

  // IA-06 asks every list for a designed empty state. This one is reachable:
  // a student with no active enrolments lands here straight after signing up.
  if (courses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>{t("list.noCourses")}</p>
      </div>
    );
  }

  return (
    <React.Fragment>
      <div className={styles.courseGrid}>
        {courses.map((course) => (
          <CoursePreview
            key={course.id}
            id={course.id}
            courseCode={course.courseCode}
            title={course.title}
            state={state}
            instructorName={course.primaryInstructor?.name ?? null}
            // Archiving is a Course Manager action. A TA never qualifies, no
            // matter which permission flags it holds, so this checks the
            // enrolment role rather than any of them.
            canManage={!isUserAccount || ('courseRole' in course && (course.courseRole ?? course.role) === 'Instructor')}
            showOperations={canAccessCourseOperations(user, 'courseRole' in course ? course.courseRole ?? course.role : null)}
            showDelivery={isAdvisorAccount(user)}
          />
        ))}
      </div>

      {courses.length > 0 && (
        <div className={styles.paginationContainer}>
          <button
            className={styles.paginationButton}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <svg className={styles.arrowIcon} viewBox="0 0 24 24">
              <path fill="currentColor" d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
            </svg>
          </button>
          
          <div className={styles.pageNumbers}>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                className={`${styles.pageButton} ${currentPage === i + 1 ? styles.active : ""}`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          
          <button
            className={styles.paginationButton}
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
