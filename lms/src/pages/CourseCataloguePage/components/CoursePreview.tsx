import {UserAvatar} from '@/components/UserAvatar';
import React, {useEffect, useRef, useState} from 'react';
import styles from './CoursePreview.module.scss';
import {useNavigate, generatePath} from "react-router-dom";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {courseApiService} from "@/apis/services/course-api";
import {CourseSession, CourseState, type CourseProgressResponse} from "@/apis";
import {AssignmentProgress} from '@/components/AssignmentProgress';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';

interface CoursePreviewProps {
  id: number;
  courseCode: string;
  title: string;
  state: CourseState;
  /** Null when the payload carried only a userId for the instructor. */
  instructorName: string | null;
  /** Course Managers get the archive action; everyone else does not. */
  canManage: boolean;
  /** Course operations are staff-only: Instructor, TA, or platform admin. */
  showOperations: boolean;
  showDelivery?: boolean;
  avatarUrl?: string;
  progress?: CourseProgressResponse;
  progressLoading?: boolean;
  progressFailed?: boolean;
  showProgress?: boolean;
}

const DAY_LABEL: Record<CourseSession['dayOfWeek'], string> = {
  MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun',
};

/** `09:00:00` reads as `09:00`; the seconds are always zero in practice. */
const toClockTime = (time: string) => time.slice(0, 5);

/**
 * A course card in the course list.
 *
 * Class time and classroom come from the course's own sessions endpoint —
 * `/v2/me/courses` carries identity and enrolment only — so each card fetches
 * its own. React Query runs them in parallel and caches per course, and the
 * card renders immediately with the schedule filling in after, so a slow
 * session response never holds up the list.
 *
 * The design shows a concrete date ("April 18 09:00"). Sessions are recurring
 * weekly slots with a day of week and no date, so the card shows the day it
 * actually recurs on rather than inventing a calendar date. It also shows the
 * location verbatim: the design's "I-A Room #200" abbreviates the building and
 * nothing defines that derivation (open-decisions.md Q-13).
 */
export const CoursePreview: React.FC<CoursePreviewProps> = ({
                                                              id,
                                                              courseCode,
                                                              title,
                                                              state,
                                                              instructorName,
                                                              canManage,
                                                              showOperations,
                                                              showDelivery = false,
                                                              avatarUrl,
                                                              progress, progressLoading, progressFailed, showProgress = true,
                                                            }) => {
  const navigate = useNavigate();
  const {t} = useTranslation("course");
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {data: sessions, isPending: schedulePending, isError: scheduleError, refetch: retrySchedule} = useQuery({
    queryKey: ['course-sessions', id],
    queryFn: async () => (await courseApiService.getCourseSessions(id)).data ?? [],
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    // A missing schedule must not turn into a retry storm across every card.
    retry: 1,
    enabled: state === 'Active',
  });

  const archive = useMutation({
    mutationFn: () => courseApiService.archiveCourse(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['my-courses']}),
        queryClient.invalidateQueries({queryKey: ['admin-courses']}),
      ]);
    },
  });

  const unarchive = useMutation({
    mutationFn: () => courseApiService.unarchiveCourse(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['my-courses']}),
        queryClient.invalidateQueries({queryKey: ['admin-courses']}),
      ]);
    },
  });

  const remove = useMutation({
    mutationFn: () => courseApiService.deleteCourse(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['my-courses']}),
        queryClient.invalidateQueries({queryKey: ['admin-courses']}),
      ]);
    },
  });

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const firstSession = sessions?.[0];

  return (
    <article className={styles.courseItem}>
      <div className={styles.courseHeader}>
        {(
          <div className={styles.instructorInfo}>
            <div className={styles.avatarContainer}>
              <UserAvatar src={avatarUrl} className={styles.avatar}/>
            </div>
            <div>
              <div className={styles.instructorName}>{instructorName || 'Instructor not assigned'}</div>
              <div className={styles.instructorRole}>{t("card.instructor")}</div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.courseContent}>
        <h2 className={styles.courseTitle}>{title || courseCode}</h2>
        <div className={styles.badges}><span className={styles.courseState}>{state}</span><span className={styles.courseCode}>{courseCode}</span></div>
        {showProgress ? <div className={styles.progressUnavailable}><AssignmentProgress progress={progress} loading={progressLoading} failed={progressFailed}/></div> : null}
      </div>
      <div className={styles.courseFooter}>
        <div className={styles.scheduleSummary}><img src="/icons/figma-dashboard/calendar.svg" alt=""/><div><span>Weekly class</span>
          {scheduleError ? <button type="button" onClick={() => void retrySchedule()}>Retry schedule</button> : firstSession ? <><strong>{DAY_LABEL[firstSession.dayOfWeek]} {toClockTime(firstSession.startTime)}</strong>{firstSession.location ? <small>{firstSession.location}</small> : null}</> : <strong>{state === 'Archived' ? 'Archived course' : schedulePending ? 'Loading…' : 'No schedule published'}</strong>}
        </div></div>
        <button
          type="button"
          className={styles.viewDetails}
          onClick={() => navigate(generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(id)}))}
        >
          {t("card.viewDetails")}
          <span aria-hidden="true">›</span>
        </button>
        {showOperations ? (
          <button type="button" className={styles.viewDetails} onClick={() => navigate(generatePath(APP_ROUTE_PATHS.courseCourseIdOperations, {courseId: String(id)}))}>
            Course operations
          </button>
        ) : null}
        {showDelivery ? (
          <button type="button" className={styles.viewDetails} onClick={() => navigate(generatePath(APP_ROUTE_PATHS.advisorCoursesCourseIdDelivery, {courseId: String(id)}))}>
            Delivery setup
          </button>
        ) : null}

        {/* The design also offers Share Courses and Delete Course. Sharing has
            no endpoint, and deleting is not how a course is retired: it only
            works on a course with no dependencies at all, and INV-05 requires
            submissions and grades to survive every V1 action. Archive is the
            real lifecycle step (open-decisions.md B-2). */}
        {canManage && (
          <div className={styles.menuAnchor} ref={menuRef}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("card.moreActions")}
            >
              ⋯
            </button>

            {menuOpen && (
              <div className={styles.menu} role="menu">
                {state === 'Active' ? (
                  <button type="button" role="menuitem" className={styles.menuItem} disabled={archive.isPending} onClick={() => { setMenuOpen(false); archive.mutate(); }}>
                    {archive.isPending ? t("card.archiving") : t("card.archive")}
                  </button>
                ) : (
                  <>
                    <button type="button" role="menuitem" className={styles.menuItem} disabled={unarchive.isPending} onClick={() => { setMenuOpen(false); unarchive.mutate(); }}>
                      {unarchive.isPending ? 'Restoring…' : 'Restore course'}
                    </button>
                    {confirmDelete ? (
                      <div className={styles.confirmDelete}>
                        <p>Delete permanently?</p>
                        <button type="button" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Deleting…' : 'Confirm'}</button>
                        <button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
                      </div>
                    ) : <button type="button" role="menuitem" className={`${styles.menuItem} ${styles.dangerItem}`} onClick={() => setConfirmDelete(true)}>Delete permanently</button>}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {(archive.isError || unarchive.isError || remove.isError) && (
        <p className={styles.error} role="alert">{remove.isError ? 'This course could not be deleted. Courses with enrolments or coursework must be retained.' : archive.isError ? t("card.archiveFailed") : 'The course could not be restored.'}</p>
      )}
    </article>
  );
};
