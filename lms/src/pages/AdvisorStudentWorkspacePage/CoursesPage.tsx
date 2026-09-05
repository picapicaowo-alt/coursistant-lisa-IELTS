import React, {useDeferredValue, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {CalendarClock, Check, MapPin, Plus, UserRound, UsersRound, X} from 'lucide-react';
import {ADVISING_ERROR_CODES, unwrapData, type AdvisorStudentCourseResponse, type AdvisingSessionRequest} from '@/apis';
import {COURSE_SESSION_DAYS, COURSE_SESSION_TYPES} from '@/configs/courseSessions';
import type {SessionDayOfWeek, SessionType} from '@/apis/types/course';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {advisorApiService} from '@/apis/services/advisor-api';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {CollapsibleSection} from '@/components/CollapsibleSection';
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
    ? dayOfWeek.charAt(0) + dayOfWeek.slice(1).toLowerCase()
    : 'Weekly';
  const time = startTime
    ? `${formatCourseTime(startTime)}${endTime ? ` – ${formatCourseTime(endTime)}` : ''}`
    : 'Time not provided';
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
  const [editorReveal, setEditorReveal] = useState(0);
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
      if (!Array.isArray(result?.items)) throw new Error('Available courses returned an invalid page. Please retry.');
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
        throw new Error('Select an available course and reload the study plan before linking.');
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
        throw new Error('Check the study plan, instructor, term dates, and session times.');
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
      if (courseId == null) throw new Error('Course response is missing courseId');
      if (action === 'withdraw' && (!reason?.trim() || course.courseLinkVersion == null)) {
        throw new Error('Provide a withdrawal reason and reload the current enrollment.');
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
        throw new Error('Select a course with a current version and instructor.');
      }
      const original = courses.data?.find(course => String(course.courseId) === courseEdit.courseId);
      if (!original || (original.courseLaunchVersion != null && original.courseLaunchVersion !== Number(courseEdit.expectedVersion))) {
        throw new Error('The course changed. Select it again before saving.');
      }
      const remainingSessions: AdvisingSessionRequest[] = [];
      if (action === 'sessions') {
        if (!Array.isArray(original.schedule)) {
          throw new Error('The existing schedule was not returned. Reload it before making changes.');
        }
        if (!courseEdit.startTime || !courseEdit.endTime || courseEdit.endTime <= courseEdit.startTime) {
          throw new Error('The session end time must be after the start time.');
        }
        // The API replaces the entire collection. Preserve all other sessions.
        for (const session of original.schedule?.slice(1) ?? []) {
          const type = COURSE_SESSION_TYPES.find(value => value === session.type);
          const day = COURSE_SESSION_DAYS.find(value => value.value === session.dayOfWeek);
          if (!type || !day || !session.startTime || !session.endTime || session.location == null) {
            throw new Error('The full schedule could not be verified. Reload before editing.');
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

  return (
    <div className={styles.grid}>
      {planningCourse.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(planningCourse.error, t('records.courseActionsLoadError'))}</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {advisingErrorMessage(error, 'Course planning could not be completed.')}
        </p>
      ) : null}

      {needsReload ? (
        <div role="alert">
          <p>The record version changed. Your input is preserved.</p>
          <button type="button" onClick={() => void reloadVersions()}>
            Load latest planning records
          </button>
        </div>
      ) : null}

      {!plan.isPending && !plan.data ? (
        <div className={styles.emptyState}>
          <strong>A study plan is required before courses can be changed</strong>
          <span>Create the student profile and study plan first. Available courses depend on this student’s study plan.</span>
          <div className={styles.actions}>
            <Link className={styles.secondaryLink} to={`/advisor/students/${id}/profile`}>
              Open profile
            </Link>
            <Link className={styles.primaryLink} to={`/advisor/students/${id}/study-plan`}>
              Open study plan
            </Link>
          </div>
        </div>
      ) : null}

      {/* Header: All Courses & Add Course Button */}
      <section className={styles.courseCollection}>
        <div className={cStyles.coursesHeader}>
          <h2>Current courses ({courses.data?.length ?? 0})</h2>
          <button
            type="button"
            className={cStyles.addCourseBtn}
            onClick={openAddDialog}
          >
            <Plus size={16} />
            <span>Add Course</span>
          </button>
        </div>

        {courses.isPending ? <p className={styles.status}>Loading courses…</p> : null}
        {courses.data?.length === 0 ? <p className={styles.status}>No course is linked to this study plan.</p> : null}

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
              title={course.title || course.courseCode || `Course #${course.courseId}`}
              code={course.courseCode}
              status={<AdvisingBadge kind="status" value={course.launchState || course.status || ''} label={course.launchState || course.status || 'Status unavailable'}/>}
              instructor={formatPersonName({firstName: course.instructorFirstName, middleName: course.instructorMiddleName, lastName: course.instructorLastName}, 'Instructor not assigned')}
              progress={{completed: course.lectureCompleted, total: course.lectureTotal}}
              metadata={
                <>
                  <span>
                    {course.deliveryMode === 'ONE_ON_ONE'
                      ? 'One-to-one'
                      : course.deliveryMode === 'GROUP'
                        ? 'Group course'
                        : 'Course'}
                  </span>
                </>
              }
              footer={<div className={cStyles.cardSchedule}>
                <CalendarClock size={17} aria-hidden="true" />
                <span>
                  <small>Weekly schedule</small>
                  <strong>{formattedSchedule || 'Not scheduled'}</strong>
                </span>
                {primarySchedule?.location ? (
                  <span className={cStyles.scheduleLocation}>
                    <MapPin size={14} aria-hidden="true" />
                    {primarySchedule.location}
                  </span>
                ) : null}
              </div>}
              actions={<>
                <button type="button" onClick={() => setSelectedCourse(course)}>View Course</button>
                {!['COMPLETED', 'HIDDEN'].includes(course.lifecycleStatus ?? '') && course.status !== 'WITHDRAWN' ? (
                  <button type="button" data-variant="secondary" disabled={planningCourse.isPending} onClick={() => {if (!needsReload) transition.reset(); planningCourse.mutate(course, {onSuccess: setEnrollmentCourse});}}>Manage enrollment</button>
                ) : (
                  <span className={styles.readOnlyBadge}>{course.lifecycleStatus || course.status}</span>
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
        error={transition.isError ? advisingErrorMessage(transition.error, 'Enrollment could not be updated.') : undefined}
        onReload={() => void reloadVersions()} onClose={() => setEnrollmentCourse(undefined)}
        onAction={(action, reason) => {if (!transition.isPending) transition.mutate({action, course: enrollmentCourse, reason});}}
        onEditSchedule={() => {
          const primarySchedule = enrollmentCourse.schedule?.[0];
          setEditorReveal(current => current + 1);
          setCourseEdit(current => ({
            ...current,
            courseId: String(enrollmentCourse.courseId),
            expectedVersion: enrollmentCourse.courseLaunchVersion == null ? '' : String(enrollmentCourse.courseLaunchVersion),
            instructorId: enrollmentCourse.instructorUserId == null ? '' : String(enrollmentCourse.instructorUserId),
            type: COURSE_SESSION_TYPES.find(type => type === primarySchedule?.type) ?? COURSE_SESSION_TYPES[0],
            dayOfWeek: COURSE_SESSION_DAYS.find(day => day.value === primarySchedule?.dayOfWeek)?.value ?? COURSE_SESSION_DAYS[0].value,
            startTime: primarySchedule?.startTime?.slice(0, 5) ?? '',
            endTime: primarySchedule?.endTime?.slice(0, 5) ?? '',
            location: primarySchedule?.location ?? '',
          }));
          setEnrollmentCourse(undefined);
        }}/>: null}
      <CollapsibleSection title="Update a one-to-one course" revealKey={editorReveal}>
        {!courseEdit.courseId ? (
          <div className={styles.emptyState}>
            <strong>Select a one-to-one course to edit</strong>
            <span>Use “Edit schedule” on a current one-to-one course. Course and record versions are carried into this form automatically.</span>
          </div>
        ) : null}
        <div className={styles.form}>
          {courseEdit.courseId ? (
            <div className={styles.selectionSummary}>
              <span>Editing</span>
              <strong>Course #{courseEdit.courseId} · launch version {courseEdit.expectedVersion || 'not supplied'}</strong>
            </div>
          ) : null}
          <AdvisorInstructorPicker
            label="New instructor"
            value={courseEdit.instructorId}
            onChange={instructorId => setCourseEdit(current => ({...current, instructorId}))}
          />
          <button
            type="button"
            className={styles.primary}
            disabled={
              needsReload ||
              !Number(courseEdit.courseId) ||
              !courseEdit.expectedVersion ||
              !Number(courseEdit.instructorId) ||
              updateOneOnOne.isPending
            }
            onClick={() => updateOneOnOne.mutate('instructor')}
          >
            Reassign instructor
          </button>
          <label>
            Session type
            <select value={courseEdit.type} onChange={event => setCourseEdit(current => ({...current, type: event.target.value as SessionType}))}>
              {COURSE_SESSION_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Day of week
            <select
              value={courseEdit.dayOfWeek}
              onChange={event => setCourseEdit(current => ({...current, dayOfWeek: event.target.value as SessionDayOfWeek}))}
            >
              {COURSE_SESSION_DAYS.map(day => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <EnglishTimeInput
              value={courseEdit.startTime}
              onChangeValue={startTime => setCourseEdit(current => ({...current, startTime}))}
            />
          </label>
          <label>
            End time
            <EnglishTimeInput
              value={courseEdit.endTime}
              onChangeValue={endTime => setCourseEdit(current => ({...current, endTime}))}
            />
          </label>
          <label>
            Location
            <input
              value={courseEdit.location}
              onChange={event => setCourseEdit(current => ({...current, location: event.target.value}))}
            />
          </label>
          <button
            type="button"
            className={styles.primary}
            disabled={
              needsReload ||
              !Number(courseEdit.courseId) ||
              !courseEdit.expectedVersion ||
              !courseEdit.startTime ||
              !courseEdit.endTime ||
              updateOneOnOne.isPending
            }
            onClick={() => updateOneOnOne.mutate('sessions')}
          >
            Replace sessions
          </button>
        </div>
      </CollapsibleSection>

      <dialog
        ref={addDialogRef}
        className={cStyles.dialog}
        aria-labelledby="add-course-title"
        onClose={() => setIsAddDialogOpen(false)}
        onCancel={event => {if (linkGroup.isPending || createOneOnOne.isPending) event.preventDefault();}}
      >
        <div className={cStyles.dialogHeader}><h2 id="add-course-title">Add Course</h2><button type="button" className={cStyles.closeBtn} onClick={closeAddDialog} aria-label="Close add course" disabled={linkGroup.isPending || createOneOnOne.isPending}><X size={20}/></button></div>
        <div className={cStyles.dialogBody}>
          <div className={cStyles.segmentGroup} aria-label="Course delivery mode">
            <button type="button" className={cStyles.segmentCard} aria-label="Join Group Course" aria-pressed={addMode === 'GROUP'} disabled={linkGroup.isPending || createOneOnOne.isPending} onClick={() => setAddMode('GROUP')}>
              <strong><UsersRound size={18} aria-hidden="true" />Join Group Course<span className={cStyles.selectionIndicator} aria-hidden="true" /></strong>
              <span>Join an existing group course.</span>
            </button>
            <button type="button" className={cStyles.segmentCard} aria-label="Create 1-on-1 Course" aria-pressed={addMode === 'ONE_ON_ONE'} disabled={linkGroup.isPending || createOneOnOne.isPending} onClick={() => setAddMode('ONE_ON_ONE')}>
              <strong><UserRound size={18} aria-hidden="true" />Create 1-on-1 Course<span className={cStyles.selectionIndicator} aria-hidden="true" /></strong>
              <span>Create a personalized course for this student.</span>
            </button>
          </div>
          {addMode === 'GROUP' && courseOptions.isFetching ? <p role="status">Loading available courses…</p> : null}
          {addMode === 'GROUP' && courseOptions.isError ? (
            <div className={styles.error} role="alert">
              <p>{getApiErrorCode(courseOptions.error) === ADVISING_ERROR_CODES.studyPlanNotFound
                ? 'Create a study plan for this student before choosing an available group course.'
                : advisingErrorMessage(courseOptions.error, 'Available courses could not be loaded. This does not mean there are no courses.')}</p>
              <button type="button" className={styles.secondary} onClick={() => void courseOptions.refetch()} disabled={courseOptions.isFetching}>Retry course search</button>
            </div>
          ) : null}
          {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, 'Course planning could not be completed.')}</p> : null}
          {addMode === 'GROUP' ? <>
      <section aria-label="Link a group course">
        <form
          id="link-group-course"
          className={styles.form}
          onSubmit={event => {
            event.preventDefault();
            linkGroup.mutate();
          }}
        >
          <label>
            Search available courses
            <input
              maxLength={120}
              value={courseSearch}
              onChange={event => {setCourseSearch(event.target.value); setGroupCourseId('');}}
              placeholder="Course code or title"
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
                  <strong>{option.title || 'Untitled course'}</strong>
                  <span className={cStyles.optionMetaLine}>
                    <span>{option.courseCode || option.catalogCode || `Course #${option.courseId}`}</span>
                    {option.activeStudents != null && option.capacity != null ? <span><UsersRound size={16} aria-hidden="true" />{option.activeStudents} / {option.capacity} students</span> : null}
                    {option.remainingCapacity != null ? <span>{option.remainingCapacity} places remaining</span> : null}
                  </span>
                </span>
                <span className={cStyles.selectionIndicator} aria-hidden="true">{String(option.courseId) === groupCourseId ? <Check size={12} /> : null}</span>
              </button>
            ))}
          </div>
          {courseOptions.isSuccess && !courseOptions.isFetching ? (
            <p className={cStyles.optionCount} role="status">
              {courseOptions.data.items.length
                ? `Showing ${courseOptions.data.items.length} of ${courseOptions.data.total} available courses${courseOptions.data.total > courseOptions.data.items.length ? '. Search by code or title to find another course.' : '.'}`
                : deferredCourseSearch
                  ? 'No courses match this search. Clear the search to see available courses.'
                  : 'No available group courses were returned for this student. Courses in Course management may not be eligible for this study plan.'}
            </p>
          ) : null}
          {selectedGroupCourse ? (
            <div className={styles.selectionSummary}>
              <span>Selected course</span>
              <strong>
                {selectedGroupCourse.courseCode || selectedGroupCourse.catalogCode || `Course #${selectedGroupCourse.courseId}`} · {selectedGroupCourse.title || 'Untitled'}
              </strong>
            </div>
          ) : null}
          <label>
            Alignment notes
            <textarea maxLength={4000} value={alignmentNotes} onChange={event => setAlignmentNotes(event.target.value)} />
          </label>
        </form>
      </section>

          </> : <>
      <section aria-label="Create a one-to-one course">
        <form
          id="create-one-on-one-course"
          className={styles.form}
          onSubmit={event => {
            event.preventDefault();
            createOneOnOne.mutate();
          }}
        >
          <label>
            Title
            <input
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
            Term start
            <EnglishDateInput
              required
              value={oneOnOne.startDate}
              onChangeValue={startDate => setOneOnOne(current => ({...current, startDate}))}
            />
          </label>
          <label>
            Term end
            <EnglishDateInput
              required
              value={oneOnOne.endDate}
              onChangeValue={endDate => setOneOnOne(current => ({...current, endDate}))}
            />
          </label>
          <label>
            Session type
            <select value={oneOnOne.type} onChange={event => setOneOnOne(current => ({...current, type: event.target.value as SessionType}))}>
              {COURSE_SESSION_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Day of week
            <select
              value={oneOnOne.dayOfWeek}
              onChange={event => setOneOnOne(current => ({...current, dayOfWeek: event.target.value as SessionDayOfWeek}))}
            >
              {COURSE_SESSION_DAYS.map(day => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <EnglishTimeInput
              required
              value={oneOnOne.startTime}
              onChangeValue={startTime => setOneOnOne(current => ({...current, startTime}))}
            />
          </label>
          <label>
            End time
            <EnglishTimeInput
              required
              value={oneOnOne.endTime}
              onChangeValue={endTime => setOneOnOne(current => ({...current, endTime}))}
            />
          </label>
          <label>
            Location
            <input
              value={oneOnOne.location}
              onChange={event => setOneOnOne(current => ({...current, location: event.target.value}))}
            />
          </label>
        </form>
      </section>

          </>}
        </div>
        <footer className={cStyles.dialogFooter}>
          <button type="button" className={cStyles.cancelBtn} disabled={linkGroup.isPending || createOneOnOne.isPending} onClick={closeAddDialog}>Cancel</button>
          {addMode === 'GROUP' ? (
            <button type="submit" form="link-group-course" className={cStyles.enrollBtn} disabled={needsReload || plan.data?.plan?.studyPlanVersion == null || !selectedGroupCourse || courseOptions.isFetching || linkGroup.isPending}>{linkGroup.isPending ? 'Linking…' : 'Link selected course'}</button>
          ) : (
            <button type="submit" form="create-one-on-one-course" className={cStyles.enrollBtn} disabled={needsReload || plan.data?.plan?.studyPlanVersion == null || createOneOnOne.isPending}>{createOneOnOne.isPending ? 'Creating…' : 'Create course'}</button>
          )}
        </footer>
      </dialog>

    </div>
  );
};

export default CoursesPage;
