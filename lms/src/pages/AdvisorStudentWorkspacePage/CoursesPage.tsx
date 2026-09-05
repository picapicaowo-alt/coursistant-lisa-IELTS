import React, {useDeferredValue, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {CalendarClock, Check, MapPin, Pencil, Plus, UserRound, UsersRound, X} from 'lucide-react';
import {ADVISING_ERROR_CODES, unwrapData, type AdvisorStudentCourseResponse, type AdvisingSessionRequest} from '@/apis';
import {COURSE_SESSION_DAYS, COURSE_SESSION_TYPES} from '@/configs/courseSessions';
import type {SessionDayOfWeek, SessionType} from '@/apis/types/course';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {advisorApiService} from '@/apis/services/advisor-api';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {OneOnOneCourseDialog} from './OneOnOneCourseDialog';
import {LocalizedError} from '@/i18n/errors';
import {formatWeekday, formatNumber} from '@/i18n/formatting';
import i18n from '@/i18n';
import {statusLabel} from '@/i18n/presentation';
import {CourseIdentityCard} from '@/components/CourseIdentityCard';
import {CourseCardGrid} from '@/components/CourseIdentityCard/CourseCardGrid';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode} from '@/utils/apiError';
import {formatPersonName} from '@/utils/personName';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {formatCourseTime} from './courseTime';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import cStyles from './CoursesPage.module.scss';
import {CourseSummaryDialog} from './CourseSummaryDialog';
import {EnrollmentDialog, type EnrollmentAction} from './EnrollmentDialog';
import {loadPlanningCourse} from './planningCourse';

const scheduleLabel = (dayOfWeek?: string, startTime?: string, endTime?: string) => {
  if (!dayOfWeek && !startTime) return null;
  const day = dayOfWeek
    ? formatWeekday(dayOfWeek, 'long')
    : i18n.t('advising:studentCourses.weekly');
  const time = startTime
    ? `${formatCourseTime(startTime)}${endTime ? ` – ${formatCourseTime(endTime)}` : ''}`
    : i18n.t('common:feedback.notProvided');
  return `${day} · ${time}`;
};

const CoursesPage: React.FC = () => {
  const {t} = useTranslation('advising');
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const addDialogRef = useRef<HTMLDialogElement>(null);

  const [selectedCourse, setSelectedCourse] = useState<AdvisorStudentCourseResponse>();
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState<'GROUP' | 'ONE_ON_ONE'>('GROUP');
  const [groupCourseId, setGroupCourseId] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const deferredCourseSearch = useDeferredValue(courseSearch.trim());
  const [alignmentNotes, setAlignmentNotes] = useState('');
  const [enrollmentCourse, setEnrollmentCourse] = useState<AdvisorStudentCourseResponse>();
  const [oneOnOne, setOneOnOne] = useState({
    title: '',
    instructorId: '',
    startDate: '',
    endDate: '',
    type: COURSE_SESSION_TYPES[0],
    dayOfWeek: COURSE_SESSION_DAYS[0].value,
    startTime: '09:00',
    endTime: '10:00',
    location: '',
  });
  const [courseEdit, setCourseEdit] = useState({
    courseId: '',
    instructorId: '',
    expectedVersion: '',
    type: COURSE_SESSION_TYPES[0],
    dayOfWeek: COURSE_SESSION_DAYS[0].value,
    startTime: '09:00',
    endTime: '10:00',
    location: '',
  });

  const plan = useQuery({
    meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorStudyPlan(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudyPlan(id), 'advisorStudyPlan'),
    enabled: Number.isInteger(id),
    retry: false,
  });

  const courses = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-courses', id],
    queryFn: async () => unwrapData(await advisorApiService.listStudentCourses(id), 'advisorStudentCourses'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const planningCourse = useMutation({
    meta: {advisingStudentId: id},
    mutationFn: loadPlanningCourse,
  });

  const courseOptions = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-course-options', id, deferredCourseSearch],
    queryFn: async () => {
      const result = unwrapData(
        await advisorApiService.searchGroupCourseOptions(id, {
          q: deferredCourseSearch || undefined,
          page: 0,
          size: ADVISOR_PAGE_SIZE,
        }),
        'advisorGroupCourseOptions',
      );
      // A malformed page is a load failure, not an empty catalogue.
      if (!Array.isArray(result?.items)) throw new LocalizedError("advising:studentCourses.invalidPage");
      return result;
    },
    enabled: Number.isInteger(id) && isAddDialogOpen && addMode === 'GROUP',
    retry: false,
  });

  const closeAddDialog = () => {
    addDialogRef.current?.close();
    setIsAddDialogOpen(false);
  };

  const openAddDialog = () => {
    setAddMode('GROUP');
    setCourseSearch('');
    setGroupCourseId('');
    linkGroup.reset();
    createOneOnOne.reset();
    setIsAddDialogOpen(true);
    addDialogRef.current?.showModal();
  };

  const refresh = () => queryClient.invalidateQueries({queryKey: ['advisor', 'student-courses', id]});

  const linkGroup = useMutation({
    meta: {advisingStudentId: id},
    mutationFn: () => {
      if (!selectedGroupCourse || plan.data?.plan?.studyPlanVersion == null ||
          courseOptions.isError || courseOptions.isFetching || courseSearch.trim() !== deferredCourseSearch) {
        throw new LocalizedError('advising:studentCourses.linkRequired');
      }
      return idempotency.run(
        'linkGroupCourse',
        [
          id,
          {
            courseId: Number(groupCourseId),
            expectedStudyPlanVersion: plan.data?.plan?.studyPlanVersion,
            alignmentNotes: alignmentNotes || undefined,
          },
        ] satisfies Parameters<typeof advisorApiService.linkGroupCourse>,
        (key, args) => advisorApiService.linkGroupCourse(...args, key)
      );
    },
    onSuccess: async () => {
      setGroupCourseId('');
      setAlignmentNotes('');
      closeAddDialog();
      await refresh();
    },
  });

  const createOneOnOne = useMutation({
    meta: {advisingStudentId: id},
    mutationFn: () => {
      if (plan.data?.plan?.studyPlanVersion == null || !oneOnOne.title.trim() ||
          !Number(oneOnOne.instructorId) || !oneOnOne.startDate || !oneOnOne.endDate ||
          oneOnOne.endDate < oneOnOne.startDate || !oneOnOne.startTime ||
          !oneOnOne.endTime || oneOnOne.endTime <= oneOnOne.startTime) {
        throw new LocalizedError('advising:studentCourses.requiredFields');
      }
      return idempotency.run(
        'createOneOnOneCourse',
        [
          id,
          {
            title: oneOnOne.title,
            primaryInstructorUserId: Number(oneOnOne.instructorId),
            expectedStudyPlanVersion: plan.data?.plan?.studyPlanVersion,
            termStartDate: oneOnOne.startDate,
            termEndDate: oneOnOne.endDate,
            location: oneOnOne.location || undefined,
            alignmentNotes: alignmentNotes || undefined,
            sessions: [
              {
                type: oneOnOne.type,
                dayOfWeek: oneOnOne.dayOfWeek,
                startTime: oneOnOne.startTime,
                endTime: oneOnOne.endTime,
                location: oneOnOne.location,
              },
            ],
          },
        ] satisfies Parameters<typeof advisorApiService.createOneOnOneCourse>,
        (key, args) => advisorApiService.createOneOnOneCourse(...args, key)
      );
    },
    onSuccess: async () => {
      setOneOnOne({
        title: '',
        instructorId: '',
        startDate: '',
        endDate: '',
        type: COURSE_SESSION_TYPES[0],
        dayOfWeek: COURSE_SESSION_DAYS[0].value,
        startTime: '09:00',
        endTime: '10:00',
        location: '',
      });
      closeAddDialog();
      await refresh();
    },
  });

  const transition = useMutation({
    meta: {advisingStudentId: id},
    mutationFn: async ({action, course, reason}: {action: EnrollmentAction; course: AdvisorStudentCourseResponse; reason?: string}) => {
      const courseId = course.courseId;
      if (courseId == null) throw new LocalizedError("advising:studentCourses.missingCourseId");
      if (action === 'withdraw' && (!reason?.trim() || course.courseLinkVersion == null)) {
        throw new LocalizedError('advising:enrollment.reviewWithdrawal');
      }
      if (action === 'ready')
        return idempotency.run(
          'readyOneOnOneLaunch',
          [id, courseId, {expectedCourseLaunchVersion: course.courseLaunchVersion}] satisfies Parameters<typeof advisorApiService.readyOneOnOneLaunch>,
          (key, args) => advisorApiService.readyOneOnOneLaunch(...args, key)
        );
      if (action === 'publish')
        return idempotency.run(
          'publishOneOnOneLaunch',
          [id, courseId, {expectedCourseLaunchVersion: course.courseLaunchVersion}] satisfies Parameters<typeof advisorApiService.publishOneOnOneLaunch>,
          (key, args) => advisorApiService.publishOneOnOneLaunch(...args, key)
        );
      if (action === 'reconfirm')
        return idempotency.run(
          'reconfirmCourseLink',
          [id, courseId, {expectedCourseLinkVersion: course.courseLinkVersion, expectedStudyPlanVersion: plan.data?.plan?.studyPlanVersion}] satisfies Parameters<typeof advisorApiService.reconfirmCourseLink>,
          (key, args) => advisorApiService.reconfirmCourseLink(...args, key)
        );
      if (action === 'complete')
        return idempotency.run(
          'completeStudentCourse',
          [id, courseId, {expectedCompletionVersion: course.completionVersion}] satisfies Parameters<typeof advisorApiService.completeStudentCourse>,
          (key, args) => advisorApiService.completeStudentCourse(...args, key)
        );
      return idempotency.run(
        'withdrawGroupCourse',
        [id, courseId, {expectedCourseLinkVersion: course.courseLinkVersion, reason: reason?.trim()}] satisfies Parameters<typeof advisorApiService.withdrawGroupCourse>,
        (key, args) => advisorApiService.withdrawGroupCourse(...args, key)
      );
    },
    onSuccess: async () => {
      setEnrollmentCourse(undefined);
      await refresh();
    },
  });

  const updateOneOnOne = useMutation({
    meta: {advisingStudentId: id},
    mutationFn: (action: 'instructor' | 'sessions') => {
      if (!Number(courseEdit.courseId) || !courseEdit.expectedVersion ||
          (action === 'instructor' && !Number(courseEdit.instructorId))) {
        throw new LocalizedError('advising:studentCourses.selectRequired');
      }
      const original = courses.data?.find(course => String(course.courseId) === courseEdit.courseId);
      if (!original || (original.courseLaunchVersion != null && original.courseLaunchVersion !== Number(courseEdit.expectedVersion))) {
        throw new LocalizedError('advising:studentCourses.changed');
      }
      const remainingSessions: AdvisingSessionRequest[] = [];
      if (action === 'sessions') {
        if (!Array.isArray(original.schedule)) {
          throw new LocalizedError('advising:studentCourses.scheduleMissing');
        }
        if (!courseEdit.startTime || !courseEdit.endTime || courseEdit.endTime <= courseEdit.startTime) {
          throw new LocalizedError('advising:studentCourses.invalidSchedule');
        }
        // The API replaces the entire collection. Preserve all other sessions.
        for (const session of original.schedule?.slice(1) ?? []) {
          const type = COURSE_SESSION_TYPES.find(value => value === session.type);
          const day = COURSE_SESSION_DAYS.find(value => value.value === session.dayOfWeek);
          if (!type || !day || !session.startTime || !session.endTime || session.location == null) {
            throw new LocalizedError('advising:studentCourses.scheduleMissing');
          }
          remainingSessions.push({type, dayOfWeek: day.value, startTime: session.startTime, endTime: session.endTime, location: session.location});
        }
      }
      return action === 'instructor'
        ? idempotency.run(
            'reassignOneOnOneInstructor',
            [
              id,
              Number(courseEdit.courseId),
              {
                primaryInstructorUserId: Number(courseEdit.instructorId),
                expectedCourseLaunchVersion: Number(courseEdit.expectedVersion),
              },
            ] satisfies Parameters<typeof advisorApiService.reassignOneOnOneInstructor>,
            (key, args) => advisorApiService.reassignOneOnOneInstructor(...args, key)
          )
        : idempotency.run(
            'replaceOneOnOneSessions',
            [
              id,
              Number(courseEdit.courseId),
              {
                expectedCourseLaunchVersion: Number(courseEdit.expectedVersion),
                sessions: [
                  {
                    type: courseEdit.type,
                    dayOfWeek: courseEdit.dayOfWeek,
                    startTime: courseEdit.startTime,
                    endTime: courseEdit.endTime,
                    location: courseEdit.location,
                  },
                  ...remainingSessions,
                ],
              },
            ] satisfies Parameters<typeof advisorApiService.replaceOneOnOneSessions>,
            (key, args) => advisorApiService.replaceOneOnOneSessions(...args, key)
          );
    },
    onSuccess: async response => {
      const updated = unwrapData(response, 'updateOneOnOneCourse');
      if (updated.courseLaunchVersion != null)
        setCourseEdit(current => ({...current, expectedVersion: String(updated.courseLaunchVersion)}));
      await refresh();
    },
  });

  const error =
    plan.error ||
    courses.error ||
    linkGroup.error ||
    createOneOnOne.error ||
    transition.error ||
    updateOneOnOne.error;

  const needsReload = [linkGroup.error, createOneOnOne.error, transition.error, updateOneOnOne.error].some(err =>
    getApiErrorCode(err)?.endsWith('VERSION_CONFLICT')
  );

  const reloadVersions = async () => {
    const [latestPlan, latestCourses] = await Promise.all([plan.refetch(), courses.refetch()]);
    if (latestPlan.isError || latestCourses.isError) return;
    let selected = latestCourses.data?.find(course => String(course.courseId) === courseEdit.courseId);
    let latestEnrollment = latestCourses.data?.find(course => course.courseId === enrollmentCourse?.courseId);
    try {
      if (latestEnrollment) latestEnrollment = await planningCourse.mutateAsync(latestEnrollment);
      if (selected) selected = await planningCourse.mutateAsync(selected);
    } catch {
      // Keep reviewed snapshots and conflict state until all required reads succeed.
      return;
    }
    if (enrollmentCourse) {
      // Advance the reviewed enrollment only after an explicit conflict reload.
      setEnrollmentCourse(latestEnrollment && !['COMPLETED', 'HIDDEN'].includes(latestEnrollment.lifecycleStatus ?? '') && latestEnrollment.status !== 'WITHDRAWN' ? latestEnrollment : undefined);
    }
    if (selected?.courseLaunchVersion != null)
      setCourseEdit(current => ({...current, expectedVersion: String(selected.courseLaunchVersion)}));
    linkGroup.reset();
    createOneOnOne.reset();
    transition.reset();
    updateOneOnOne.reset();
  };

  const selectedGroupCourse = courseOptions.data?.items.find(option => String(option.courseId) === groupCourseId);
  const editableCourses = (courses.data ?? []).filter(course => course.deliveryMode === 'ONE_ON_ONE' &&
    course.courseId != null && !['COMPLETED', 'HIDDEN'].includes(course.lifecycleStatus ?? '') && course.status !== 'WITHDRAWN');
  const selectCourseToEdit = (course?: AdvisorStudentCourseResponse) => {
    updateOneOnOne.reset();
    planningCourse.reset();
    setCourseEdit(current => ({...current, courseId: course?.courseId == null ? '' : String(course.courseId), expectedVersion: ''}));
    if (!course) return;
    planningCourse.mutate(course, {onSuccess: selected => {
      const session = selected.schedule?.[0];
      setCourseEdit({
        courseId: String(selected.courseId),
        expectedVersion: selected.courseLaunchVersion == null ? '' : String(selected.courseLaunchVersion),
        instructorId: selected.instructorUserId == null ? '' : String(selected.instructorUserId),
        type: COURSE_SESSION_TYPES.find(type => type === session?.type) ?? COURSE_SESSION_TYPES[0],
        dayOfWeek: COURSE_SESSION_DAYS.find(day => day.value === session?.dayOfWeek)?.value ?? COURSE_SESSION_DAYS[0].value,
        startTime: session?.startTime?.slice(0, 5) ?? '',
        endTime: session?.endTime?.slice(0, 5) ?? '',
        location: session?.location ?? '',
      });
    }});
  };
  const openUpdateDialog = (course?: AdvisorStudentCourseResponse) => {
    selectCourseToEdit(course ?? (editableCourses.length === 1 ? editableCourses[0] : undefined));
    setIsUpdateDialogOpen(true);
  };


  return (
    <div className={styles.grid}>
      {planningCourse.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(planningCourse.error, t('records.courseActionsLoadError'))}</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {advisingErrorMessage(error, t('advising:studentCourses.failed'))}
        </p>
      ) : null}

      {needsReload ? (
        <div role="alert">
          <p>{t("advising:studentCourses.conflict")}</p>
          <button type="button" onClick={() => void reloadVersions()}>
            {t("advising:studentCourses.reload")}</button>
        </div>
      ) : null}

      {!plan.isPending && !plan.data ? (
        <div className={styles.emptyState}>
          <strong>{t("advising:studentCourses.planRequired")}</strong>
          <span>{t("advising:studentCourses.planHelp")}</span>
          <div className={styles.actions}>
            <Link className={styles.secondaryLink} to={`/advisor/students/${id}/profile`}>
              {t("advising:studentCourses.openProfile")}</Link>
            <Link className={styles.primaryLink} to={`/advisor/students/${id}/study-plan`}>
              {t("advising:studentCourses.openPlan")}</Link>
          </div>
        </div>
      ) : null}

      {/* Header: All Courses & Add Course Button */}
      <section className={styles.courseCollection}>
        <div className={cStyles.coursesHeader}>
          <h2>{t('advising:studentCourses.current', {number: courses.isSuccess ? formatNumber(courses.data.length) : '—'})}</h2>
          <div className={cStyles.headerActions}>
            <button type="button" className={cStyles.updateCourseBtn} onClick={() => openUpdateDialog()}
              disabled={!editableCourses.length || courses.isFetching}>
              <Pencil size={16} aria-hidden="true"/><span>{t('studentCourses.updateOneToOne')}</span>
            </button>
          <button
            type="button"
            className={cStyles.addCourseBtn}
            onClick={openAddDialog}
          >
            <Plus size={16} />
            <span>{t('studentCourses.add')}</span>
          </button>
          </div>
        </div>

        {courses.isPending ? <p className={styles.status}>{t("advising:owned.loading")}</p> : null}
        {courses.data?.length === 0 ? <p className={styles.status}>{t("advising:studentCourses.empty")}</p> : null}

        <CourseCardGrid>
          {(courses.data ?? []).map((course, index) => {
            const primarySchedule = course.schedule?.[0];
            const formattedSchedule = scheduleLabel(
              primarySchedule?.dayOfWeek,
              primarySchedule?.startTime,
              primarySchedule?.endTime,
            );
            return (
            <CourseIdentityCard
              key={course.courseId ?? index}
              courseId={course.courseId ?? index}
              title={course.title || course.courseCode || t('assistant:courseFallback', {id: course.courseId == null ? '—' : formatNumber(course.courseId)})}
              code={course.courseCode}
              status={<AdvisingBadge kind="status" value={course.launchState || course.status || ''} label={statusLabel(course.launchState || course.status) || t('common:feedback.statusUnavailable')}/>}
              instructor={formatPersonName({firstName: course.instructorFirstName, middleName: course.instructorMiddleName, lastName: course.instructorLastName}, t('course:catalogue.unassignedInstructor'))}
              progress={{completed: course.lectureCompleted, total: course.lectureTotal}}
              metadata={
                <>
                  <span>
                    {course.deliveryMode === 'ONE_ON_ONE'
                      ? t("advising:studentCourses.oneToOne")
                      : course.deliveryMode === 'GROUP'
                        ? t("courseTools:delivery.group")
                        : t("common:fields.course")}
                  </span>
                </>
              }
              footer={<div className={cStyles.cardSchedule}>
                <CalendarClock size={17} aria-hidden="true" />
                <span>
                  <small>{t("advising:studentCourses.weeklySchedule")}</small>
                  <strong>{formattedSchedule || t("advising:studentCourses.notScheduled")}</strong>
                </span>
                {primarySchedule?.location ? (
                  <span className={cStyles.scheduleLocation}>
                    <MapPin size={14} aria-hidden="true" />
                    {primarySchedule.location}
                  </span>
                ) : null}
              </div>}
              actions={<>
                <button type="button" onClick={() => setSelectedCourse(course)}>{t("advising:studentCourses.view")}</button>
                {!['COMPLETED', 'HIDDEN'].includes(course.lifecycleStatus ?? '') && course.status !== 'WITHDRAWN' ? (
                  <button type="button" data-variant="secondary" disabled={planningCourse.isPending} onClick={() => {if (!needsReload) transition.reset(); planningCourse.mutate(course, {onSuccess: setEnrollmentCourse});}}>{t("advising:enrollment.manage")}</button>
                ) : (
                  <span className={styles.readOnlyBadge}>{statusLabel(course.lifecycleStatus || course.status)}</span>
                )}
              </>}
            />
            );
          })}
        </CourseCardGrid>
      </section>

      {selectedCourse ? <CourseSummaryDialog course={selectedCourse} onClose={() => setSelectedCourse(undefined)}/> : null}
      {enrollmentCourse ? <EnrollmentDialog course={enrollmentCourse} pending={transition.isPending}
        needsReload={needsReload} hasPlan={Boolean(plan.data)}
        error={transition.isError ? advisingErrorMessage(transition.error, t('advising:enrollment.failed')) : undefined}
        onReload={() => void reloadVersions()} onClose={() => setEnrollmentCourse(undefined)}
        onAction={(action, reason) => {if (!transition.isPending) transition.mutate({action, course: enrollmentCourse, reason});}}
        onEditSchedule={() => {
          openUpdateDialog(enrollmentCourse);
          setEnrollmentCourse(undefined);
        }}/>: null}
      {isUpdateDialogOpen ? <OneOnOneCourseDialog courses={editableCourses} draft={courseEdit} onDraft={setCourseEdit}
        loading={planningCourse.isPending} pending={updateOneOnOne.isPending} needsReload={needsReload}
        error={planningCourse.error || updateOneOnOne.error} saved={updateOneOnOne.isSuccess}
        onSelect={selectCourseToEdit} onReload={() => void reloadVersions()} onClose={() => setIsUpdateDialogOpen(false)}
        onSave={action => {if (!updateOneOnOne.isPending && !planningCourse.isPending) updateOneOnOne.mutate(action);}}/> : null}

      <dialog
        ref={addDialogRef}
        className={cStyles.dialog}
        aria-labelledby="add-course-title"
        onClose={() => setIsAddDialogOpen(false)}
        onCancel={event => {if (linkGroup.isPending || createOneOnOne.isPending) event.preventDefault();}}
      >
        <div className={cStyles.dialogHeader}><h2 id="add-course-title">{t("advising:studentCourses.add")}</h2><button type="button" className={cStyles.closeBtn} onClick={closeAddDialog} aria-label={t("advising:studentCourses.closeAdd")} disabled={linkGroup.isPending || createOneOnOne.isPending}><X size={20}/></button></div>
        <div className={cStyles.dialogBody}>
          <div className={cStyles.segmentGroup} aria-label={t("advising:studentCourses.deliveryMode")}>
            <button type="button" className={cStyles.segmentCard} aria-label={t("advising:studentCourses.joinGroup")} aria-pressed={addMode === 'GROUP'} disabled={linkGroup.isPending || createOneOnOne.isPending} onClick={() => setAddMode('GROUP')}>
              <strong><UsersRound size={18} aria-hidden="true" />{t("advising:studentCourses.joinGroup")}<span className={cStyles.selectionIndicator} aria-hidden="true" /></strong>
              <span>{t("advising:studentCourses.joinGroupHelp")}</span>
            </button>
            <button type="button" className={cStyles.segmentCard} aria-label={t("advising:studentCourses.createOneToOne")} aria-pressed={addMode === 'ONE_ON_ONE'} disabled={linkGroup.isPending || createOneOnOne.isPending} onClick={() => setAddMode('ONE_ON_ONE')}>
              <strong><UserRound size={18} aria-hidden="true" />{t("advising:studentCourses.createOneToOne")}<span className={cStyles.selectionIndicator} aria-hidden="true" /></strong>
              <span>{t("advising:studentCourses.oneToOneHelp")}</span>
            </button>
          </div>
          {addMode === 'GROUP' && courseOptions.isFetching ? <p role="status">{t("advising:studentCourses.loadingOptions")}</p> : null}
          {addMode === 'GROUP' && courseOptions.isError ? (
            <div className={styles.error} role="alert">
              <p>{getApiErrorCode(courseOptions.error) === ADVISING_ERROR_CODES.studyPlanNotFound
                ? t("advising:studentCourses.optionsNeedPlan")
                : advisingErrorMessage(courseOptions.error, t('advising:studentCourses.optionsFailed'))}</p>
              <button type="button" className={styles.secondary} onClick={() => void courseOptions.refetch()} disabled={courseOptions.isFetching}>{t("advising:studentCourses.retrySearch")}</button>
            </div>
          ) : null}
          {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, t('advising:studentCourses.failed'))}</p> : null}
          {addMode === 'GROUP' ? <>
      <section aria-label={t("advising:studentCourses.linkGroup")}>
        <form noValidate
          id="link-group-course"
          className={styles.form}
          onSubmit={event => {
            event.preventDefault();
            if (!linkGroup.isPending) linkGroup.mutate();
          }}
        >
          <label>
            {t("advising:studentCourses.search")}<input
              maxLength={120}
              value={courseSearch}
              onChange={event => {setCourseSearch(event.target.value); setGroupCourseId('');}}
              placeholder={t("advising:studentCourses.searchPlaceholder")}
            />
          </label>
          <div className={cStyles.courseOptionsList}>
            {(courseOptions.data?.items ?? []).map((option, index) => (
              <button
                type="button"
                aria-pressed={String(option.courseId) === groupCourseId}
                className={cStyles.optionRow}
                disabled={option.courseId == null || courseOptions.isFetching || courseSearch.trim() !== deferredCourseSearch}
                key={option.courseId ?? index}
                onClick={() => setGroupCourseId(String(option.courseId ?? ''))}
              >
                <span className={cStyles.optionMain}>
                  <strong>{option.title || t("advising:studentCourses.untitledCourse")}</strong>
                  <span className={cStyles.optionMetaLine}>
                    <span>{option.courseCode || option.catalogCode || t('assistant:courseFallback', {id: option.courseId == null ? '—' : formatNumber(option.courseId)})}</span>
                    {option.activeStudents != null && option.capacity != null ? <span><UsersRound size={16} aria-hidden="true" />{t('advising:studentCourses.capacity', {active: formatNumber(option.activeStudents), capacity: formatNumber(option.capacity)})}</span> : null}
                    {option.remainingCapacity != null ? <span>{t('advising:studentCourses.remainingPlaces', {count: option.remainingCapacity, number: formatNumber(option.remainingCapacity)})}</span> : null}
                  </span>
                </span>
                <span className={cStyles.selectionIndicator} aria-hidden="true">{String(option.courseId) === groupCourseId ? <Check size={12} /> : null}</span>
              </button>
            ))}
          </div>
          {courseOptions.isSuccess && !courseOptions.isFetching ? (
            <p className={cStyles.optionCount} role="status">
              {courseOptions.data.items.length
                ? [t('advising:studentCourses.optionsCount', {number: formatNumber(courseOptions.data.items.length), total: formatNumber(courseOptions.data.total)}), courseOptions.data.total > courseOptions.data.items.length ? t('advising:studentCourses.searchMore') : ''].filter(Boolean).join(' ')
                : deferredCourseSearch
                  ? t("advising:studentCourses.noMatches")
                  : t("advising:studentCourses.noOptions")}
            </p>
          ) : null}
          {selectedGroupCourse ? (
            <div className={styles.selectionSummary}>
              <span>{t("advising:studentCourses.selected")}</span>
              <strong>
                {selectedGroupCourse.courseCode || selectedGroupCourse.catalogCode || t('assistant:courseFallback', {id: selectedGroupCourse.courseId == null ? '—' : formatNumber(selectedGroupCourse.courseId)})} · {selectedGroupCourse.title || t("course:assignmentList.untitled")}
              </strong>
            </div>
          ) : null}
          <label>
            {t("advising:studentCourses.alignmentNotes")}<textarea maxLength={4000} value={alignmentNotes} onChange={event => setAlignmentNotes(event.target.value)} />
          </label>
        </form>
      </section>

          </> : <>
      <section aria-label={t("advising:studentCourses.createOneToOneRegion")}>
        <form noValidate
          id="create-one-on-one-course"
          className={styles.form}
          onSubmit={event => {
            event.preventDefault();
            if (!createOneOnOne.isPending) createOneOnOne.mutate();
          }}
        >
          <label>
            {t("common:fields.title")}<input
              required
              value={oneOnOne.title}
              onChange={event => setOneOnOne(current => ({...current, title: event.target.value}))}
            />
          </label>
          <AdvisorInstructorPicker
            required
            value={oneOnOne.instructorId}
            onChange={instructorId => setOneOnOne(current => ({...current, instructorId}))}
          />
          <label>
            {t("courseTools:owner.termStart")}<EnglishDateInput
              required
              value={oneOnOne.startDate}
              onChangeValue={startDate => setOneOnOne(current => ({...current, startDate}))}
            />
          </label>
          <label>
            {t("courseTools:owner.termEnd")}<EnglishDateInput
              required
              value={oneOnOne.endDate}
              onChangeValue={endDate => setOneOnOne(current => ({...current, endDate}))}
            />
          </label>
          <label>
            {t("advising:studentCourses.sessionType")}<select value={oneOnOne.type} onChange={event => setOneOnOne(current => ({...current, type: event.target.value as SessionType}))}>
              {COURSE_SESSION_TYPES.map(type => <option key={type} value={type}>{statusLabel(type)}</option>)}
            </select>
          </label>
          <label>
            {t("advising:studentCourses.weekday")}<select
              value={oneOnOne.dayOfWeek}
              onChange={event => setOneOnOne(current => ({...current, dayOfWeek: event.target.value as SessionDayOfWeek}))}
            >
              {COURSE_SESSION_DAYS.map(day => (
                <option key={day.value} value={day.value}>{formatWeekday(day.value, 'long')}</option>
              ))}
            </select>
          </label>
          <label>
            {t("auth:preview.startTime")}<EnglishTimeInput
              required
              value={oneOnOne.startTime}
              onChangeValue={startTime => setOneOnOne(current => ({...current, startTime}))}
            />
          </label>
          <label>
            {t("operations:endTime")}<EnglishTimeInput
              required
              value={oneOnOne.endTime}
              onChangeValue={endTime => setOneOnOne(current => ({...current, endTime}))}
            />
          </label>
          <label>
            {t("calendar:details.location")}<input
              value={oneOnOne.location}
              onChange={event => setOneOnOne(current => ({...current, location: event.target.value}))}
            />
          </label>
        </form>
      </section>

          </>}
        </div>
        <footer className={cStyles.dialogFooter}>
          <button type="button" className={cStyles.cancelBtn} disabled={linkGroup.isPending || createOneOnOne.isPending} onClick={closeAddDialog}>{t("common:actions.cancel")}</button>
          {addMode === 'GROUP' ? (
            <button type="submit" form="link-group-course" className={cStyles.enrollBtn} disabled={needsReload || plan.data?.plan?.studyPlanVersion == null || !selectedGroupCourse || courseOptions.isFetching || linkGroup.isPending}>{linkGroup.isPending ? t("advising:studentCourses.linking") : t("advising:studentCourses.linkSelected")}</button>
          ) : (
            <button type="submit" form="create-one-on-one-course" className={cStyles.enrollBtn} disabled={needsReload || plan.data?.plan?.studyPlanVersion == null || createOneOnOne.isPending}>{createOneOnOne.isPending ? t("common:actions.creating") : t("course:list.createCourse")}</button>
          )}
        </footer>
      </dialog>

    </div>
  );
};

export default CoursesPage;
