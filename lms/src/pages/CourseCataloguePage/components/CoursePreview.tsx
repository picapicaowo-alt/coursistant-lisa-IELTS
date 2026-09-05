import {formatWeekday, formatClockTime} from '@/i18n/formatting';
import React, {useEffect, useRef, useState} from 'react';
import styles from './CoursePreview.module.scss';
import {Link, generatePath} from "react-router-dom";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {courseApiService} from "@/apis/services/course-api";
import {CourseState, unwrapData, type CourseProgressResponse} from "@/apis";
import {AssignmentProgress} from '@/components/AssignmentProgress';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {CalendarDays, Ellipsis, MapPin} from 'lucide-react';
import {CourseIdentityCard} from '@/components/CourseIdentityCard';
import {TeachingBadge} from '@/components/TeachingWorkspace';

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
  const {t} = useTranslation("course");
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {data: sessions, isPending: schedulePending, isError: scheduleError, refetch: retrySchedule} = useQuery({
    queryKey: ['course-sessions', id],
    queryFn: async () => unwrapData(await courseApiService.getCourseSessions(id), 'getCourseSessions'),
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
    if (!menuOpen) {
      setConfirmDelete(false);
      return;
    }
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const firstSession = sessions?.[0];

  return (
    <CourseIdentityCard
      courseId={id}
      title={title || courseCode}
      headingLevel={2}
      code={courseCode}
      status={<TeachingBadge value={state}/>}
      instructor={instructorName || t('catalogue.unassignedInstructor')}
      instructorAvatar={avatarUrl}
      footer={<div className={styles.schedule}>
        <div><CalendarDays size={18} aria-hidden="true"/><span>
          {scheduleError ? <button type="button" onClick={() => void retrySchedule()}>{t('dashboard:retrySchedule')}</button>
            : firstSession ? t('catalogue.weeklyClass', {day: formatWeekday(firstSession.dayOfWeek), time: formatClockTime(firstSession.startTime)})
            : state === 'Archived' ? t('catalogue.archived')
            : schedulePending ? t('dashboard:loadingSchedule') : t('dashboard:noSchedule')}
        </span></div>
        <div><MapPin size={18} aria-hidden="true"/><span>{firstSession?.location || t('catalogue.noLocation')}</span></div>
      </div>}
      actions={<>
        <Link data-variant={showOperations || showDelivery ? 'secondary' : undefined}
          to={generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(id)})}>
          {t("card.viewDetails")}
        </Link>
        {showOperations ? <Link to={generatePath(APP_ROUTE_PATHS.courseCourseIdOperations, {courseId: String(id)})}>{t('catalogue.operations')}</Link> : null}
        {showDelivery ? <Link to={generatePath(APP_ROUTE_PATHS.advisorCoursesCourseIdDelivery, {courseId: String(id)})}>{t('catalogue.deliverySetup')}</Link> : null}
      </>}
        menu={canManage ? (
          <div className={styles.menuAnchor} ref={menuRef} onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setMenuOpen(false);
              menuRef.current?.querySelector('button')?.focus();
            } else if (menuOpen && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
              const current = items.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
              items[next]?.focus();
            }
          }}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("card.moreActions")}
            >
              <Ellipsis size={18} aria-hidden="true"/>
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
                      {unarchive.isPending ? t('catalogue.restoring') : t('catalogue.restore')}
                    </button>
                    {confirmDelete ? (
                      <div className={styles.confirmDelete}>
                        <p>{t('catalogue.confirmDelete')}</p>
                        <button type="button" role="menuitem" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? t('common:actions.deleting') : t('common:actions.confirm')}</button>
                        <button type="button" role="menuitem" onClick={() => setConfirmDelete(false)}>{t('common:actions.cancel')}</button>
                      </div>
                    ) : <button type="button" role="menuitem" className={`${styles.menuItem} ${styles.dangerItem}`} onClick={() => setConfirmDelete(true)}>{t('catalogue.deletePermanently')}</button>}
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
    >
      {showProgress ? <AssignmentProgress progress={progress} loading={progressLoading} failed={progressFailed}/> : null}
      {(archive.isError || unarchive.isError || remove.isError) && (
        <p className={styles.error} role="alert">{remove.isError ? 'This course could not be deleted. Courses with enrolments or coursework must be retained.' : archive.isError ? t("card.archiveFailed") : 'The course could not be restored.'}</p>
      )}
    </CourseIdentityCard>
  );
};
