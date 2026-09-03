import {CollapsibleSection} from '@/components/CollapsibleSection';
import {CourseIdentityCard} from '@/components/CourseIdentityCard';
import {courseStatusTone} from '@/components/CourseIdentityCard/courseBadges';
import {getApiErrorCode} from '@/utils/apiError';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {CalendarPlus, Link2, PencilLine} from 'lucide-react';
import React, {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Link, useParams} from 'react-router-dom';
import type {AdvisorStudentCourseResponse} from '@/apis';
import {WEEKDAYS, unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';

const CoursesPage: React.FC = () => {
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [editorReveal, setEditorReveal] = useState(0);
  const [groupCourseId, setGroupCourseId] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [alignmentNotes, setAlignmentNotes] = useState('');
  const [oneOnOne, setOneOnOne] = useState({title: '', instructorId: '', startDate: '', endDate: '', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', location: ''});
  const [courseEdit, setCourseEdit] = useState({courseId: '', instructorId: '', expectedVersion: '', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', location: ''});

  const plan = useQuery({meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorStudyPlan(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudyPlan(id), 'advisorStudyPlan'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const courses = useQuery({meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-courses', id],
    queryFn: async () => unwrapData(await advisorApiService.listStudentCourses(id), 'advisorStudentCourses'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const courseOptions = useQuery({meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-course-options', id, courseSearch],
    queryFn: async () => unwrapData(await advisorApiService.searchGroupCourseOptions(id, {q: courseSearch, page: 0, size: 20}), 'advisorGroupCourseOptions'),
    enabled: Number.isInteger(id) && courseSearch.trim().length >= 2,
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({queryKey: ['advisor', 'student-courses', id]});
  const linkGroup = useMutation({meta: {advisingStudentId: id},
    mutationFn: () => idempotency.run('linkGroupCourse', [id, {
      courseId: Number(groupCourseId),
      expectedStudyPlanVersion: plan.data?.plan.studyPlanVersion,
      alignmentNotes: alignmentNotes || undefined,
    }] satisfies Parameters<typeof advisorApiService.linkGroupCourse>, (key, args) => advisorApiService.linkGroupCourse(...args, key)),
    onSuccess: async () => { setGroupCourseId(''); setAlignmentNotes(''); await refresh(); },
  });
  const createOneOnOne = useMutation({meta: {advisingStudentId: id},
    mutationFn: () => idempotency.run('createOneOnOneCourse', [id, {
      title: oneOnOne.title,
      primaryInstructorUserId: Number(oneOnOne.instructorId),
      expectedStudyPlanVersion: plan.data?.plan.studyPlanVersion,
      termStartDate: oneOnOne.startDate,
      termEndDate: oneOnOne.endDate,
      location: oneOnOne.location || undefined,
      alignmentNotes: alignmentNotes || undefined,
      sessions: [{
        type: 'ONE_ON_ONE',
        dayOfWeek: oneOnOne.dayOfWeek,
        startTime: oneOnOne.startTime,
        endTime: oneOnOne.endTime,
        location: oneOnOne.location,
      }],
    }] satisfies Parameters<typeof advisorApiService.createOneOnOneCourse>, (key, args) => advisorApiService.createOneOnOneCourse(...args, key)),
    onSuccess: async () => {
      setOneOnOne({title: '', instructorId: '', startDate: '', endDate: '', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', location: ''});
      await refresh();
    },
  });
  const transition = useMutation({meta: {advisingStudentId: id},
    mutationFn: async ({action, course}: {action: 'ready' | 'publish' | 'reconfirm' | 'complete' | 'withdraw'; course: AdvisorStudentCourseResponse}) => {
      const courseId = course.courseId;
      if (courseId == null) throw new Error('Course response is missing courseId');
      if (action === 'ready') return idempotency.run('readyOneOnOneLaunch', [id, courseId, {expectedCourseLaunchVersion: course.courseLaunchVersion}] satisfies Parameters<typeof advisorApiService.readyOneOnOneLaunch>, (key, args) => advisorApiService.readyOneOnOneLaunch(...args, key));
      if (action === 'publish') return idempotency.run('publishOneOnOneLaunch', [id, courseId, {expectedCourseLaunchVersion: course.courseLaunchVersion}] satisfies Parameters<typeof advisorApiService.publishOneOnOneLaunch>, (key, args) => advisorApiService.publishOneOnOneLaunch(...args, key));
      if (action === 'reconfirm') return idempotency.run('reconfirmCourseLink', [id, courseId, {expectedCourseLinkVersion: course.courseLinkVersion, expectedStudyPlanVersion: plan.data?.plan.studyPlanVersion}] satisfies Parameters<typeof advisorApiService.reconfirmCourseLink>, (key, args) => advisorApiService.reconfirmCourseLink(...args, key));
      if (action === 'complete') return idempotency.run('completeStudentCourse', [id, courseId, {expectedCompletionVersion: course.completionVersion}] satisfies Parameters<typeof advisorApiService.completeStudentCourse>, (key, args) => advisorApiService.completeStudentCourse(...args, key));
      return idempotency.run('withdrawGroupCourse', [id, courseId, {expectedCourseLinkVersion: course.courseLinkVersion}] satisfies Parameters<typeof advisorApiService.withdrawGroupCourse>, (key, args) => advisorApiService.withdrawGroupCourse(...args, key));
    },
    onSuccess: refresh,
  });
  const updateOneOnOne = useMutation({meta: {advisingStudentId: id},
    mutationFn: (action: 'instructor' | 'sessions') => action === 'instructor'
      ? idempotency.run('reassignOneOnOneInstructor', [id, Number(courseEdit.courseId), {primaryInstructorUserId: Number(courseEdit.instructorId), expectedCourseLaunchVersion: Number(courseEdit.expectedVersion)}] satisfies Parameters<typeof advisorApiService.reassignOneOnOneInstructor>, (key, args) => advisorApiService.reassignOneOnOneInstructor(...args, key))
      : idempotency.run('replaceOneOnOneSessions', [id, Number(courseEdit.courseId), {expectedCourseLaunchVersion: Number(courseEdit.expectedVersion), sessions: [{type: 'ONE_ON_ONE', dayOfWeek: courseEdit.dayOfWeek, startTime: courseEdit.startTime, endTime: courseEdit.endTime, location: courseEdit.location || undefined}]}] satisfies Parameters<typeof advisorApiService.replaceOneOnOneSessions>, (key, args) => advisorApiService.replaceOneOnOneSessions(...args, key)),
    onSuccess: async response => {
      const updated = unwrapData(response, 'updateOneOnOneCourse');
      if (updated.courseLaunchVersion != null) setCourseEdit(current => ({...current, expectedVersion: String(updated.courseLaunchVersion)}));
      await refresh();
    },
  });

  const error = plan.error || courses.error || courseOptions.error || linkGroup.error || createOneOnOne.error || transition.error || updateOneOnOne.error;
  const needsReload = [linkGroup.error, createOneOnOne.error, transition.error, updateOneOnOne.error].some(error => getApiErrorCode(error)?.endsWith('VERSION_CONFLICT'));
  const reloadVersions = async () => {
    const [latestPlan, latestCourses] = await Promise.all([plan.refetch(), courses.refetch(), courseOptions.refetch()]);
    if (latestPlan.isError || latestCourses.isError) return;
    const selected = latestCourses.data?.find(course => String(course.courseId) === courseEdit.courseId);
    if (selected?.courseLaunchVersion != null) setCourseEdit(current => ({...current, expectedVersion: String(selected.courseLaunchVersion)}));
    linkGroup.reset(); createOneOnOne.reset(); transition.reset(); updateOneOnOne.reset();
  };
  const selectedGroupCourse = courseOptions.data?.items.find(option => String(option.courseId) === groupCourseId);

  return (
    <div className={styles.grid}>
      {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, 'Course planning could not be completed.')}</p> : null}
      {needsReload ? <div role="alert"><p>The record version changed. Your input is preserved.</p><button type="button" onClick={() => void reloadVersions()}>Load latest planning records</button></div> : null}
      {!plan.isPending && !plan.data ? (
        <div className={styles.emptyState}>
          <strong>A study plan is required before courses can be changed</strong>
          <span>Create the student profile and study plan first; course search remains available for planning.</span>
          <div className={styles.actions}>
            <Link className={styles.secondaryLink} to={`/advisor/students/${id}/profile`}>Open profile</Link>
            <Link className={styles.primaryLink} to={`/advisor/students/${id}/study-plan`}>Open study plan</Link>
          </div>
        </div>
      ) : null}
      <section className={styles.courseCollection}>
        <div className={styles.sectionHeading}><div className={styles.sectionTitle}><h2>Current courses</h2><span className={styles.countBadge}>{courses.data?.length ?? 0}</span></div><p className={styles.muted}>Courses linked to this study plan. Open a card to change its status or schedule.</p></div>
        {courses.isPending ? <p className={styles.status}>Loading courses…</p> : null}
        {courses.data?.length === 0 ? <div className={styles.emptyState}><strong>No course is linked yet</strong><span>Link a group course or create a one-to-one course below.</span></div> : null}
        <div className={styles.courseCardGrid}>
          {(courses.data ?? []).map((course, index) => {
            const status = course.launchState || course.status || 'Pending';
            return (
            <CourseIdentityCard key={course.courseId ?? index} courseId={course.courseId ?? index} title={course.title || course.courseCode || `Course #${course.courseId}`} code={course.courseCode}
              badges={[{label: course.deliveryMode === 'ONE_ON_ONE' ? '1-on-1' : course.deliveryMode === 'GROUP' ? 'Group' : 'Course', tone: 'brand'}, {label: status, tone: courseStatusTone(status)}]}
              metadata={<span>{formatPersonName({firstName: course.instructorFirstName, middleName: course.instructorMiddleName, lastName: course.instructorLastName}, 'Instructor not assigned')}</span>}>
              <div className={styles.actions}>
                {!['COMPLETED', 'HIDDEN'].includes(course.lifecycleStatus ?? '') && course.status !== 'WITHDRAWN' ? <>
                {course.deliveryMode === 'ONE_ON_ONE' && course.courseId != null ? <button className={styles.secondary} onClick={() => { setEditorReveal(current => current + 1); setCourseEdit(current => ({...current, courseId: String(course.courseId), expectedVersion: course.courseLaunchVersion == null ? '' : String(course.courseLaunchVersion), instructorId: course.instructorUserId == null ? '' : String(course.instructorUserId)})); }}>Edit schedule</button> : null}
                <button disabled={needsReload || transition.isPending || !plan.data || course.courseLinkVersion == null} className={styles.secondary} onClick={() => transition.mutate({action: 'reconfirm', course})}>Reconfirm</button>
                {course.deliveryMode === 'ONE_ON_ONE' && course.launchState === 'DRAFT' ? <button disabled={needsReload || transition.isPending || course.courseLaunchVersion == null} className={styles.secondary} onClick={() => transition.mutate({action: 'ready', course})}>Ready</button> : null}
                {course.deliveryMode === 'ONE_ON_ONE' && course.launchState === 'READY' ? <button disabled={needsReload || transition.isPending || course.courseLaunchVersion == null} className={styles.primary} onClick={() => transition.mutate({action: 'publish', course})}>Publish</button> : null}
                <button disabled={needsReload || transition.isPending || course.completionVersion == null} className={styles.secondary} onClick={() => transition.mutate({action: 'complete', course})}>Complete</button>
                {course.deliveryMode === 'GROUP' ? <button disabled={needsReload || transition.isPending || course.courseLinkVersion == null} className={styles.danger} onClick={() => transition.mutate({action: 'withdraw', course})}>Withdraw</button> : null}
                </> : <span className={styles.readOnlyBadge}>{course.lifecycleStatus || course.status}</span>}
              </div>
            </CourseIdentityCard>
            );
          })}
        </div>
      </section>

      <section className={styles.courseCollection} aria-labelledby="course-planning-heading">
        <div className={styles.sectionHeading}><div className={styles.sectionTitle}><h2 id="course-planning-heading">Plan a course</h2></div><p className={styles.muted}>Add to this student&apos;s plan. Each action opens its own form; drafts stay in place while you switch.</p></div>
        <div className={styles.actionGrid}>
      <CollapsibleSection title="Link a group course" icon={<Link2/>} summary="Search the catalogue and attach an existing group course.">
        <p className={styles.muted}>Current study plan version: {plan.data?.plan.studyPlanVersion ?? 'not available'}</p>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); linkGroup.mutate(); }}>
          <label>Search available courses<input maxLength={120} value={courseSearch} onChange={event => setCourseSearch(event.target.value)} placeholder="Course code or title"/></label>
          {courseSearch.trim().length > 0 && courseSearch.trim().length < 2 ? <p className={styles.muted}>Enter at least two characters.</p> : null}
          <div className={styles.list}>
            {(courseOptions.data?.items ?? []).map((option, index) => (
              <button type="button" aria-pressed={String(option.courseId) === groupCourseId} className={String(option.courseId) === groupCourseId ? styles.selectedOption : styles.secondary} key={option.courseId ?? index} onClick={() => setGroupCourseId(String(option.courseId ?? ''))}>
                {option.courseCode || option.catalogCode || `Course #${option.courseId}`} · {option.title || 'Untitled'} · {option.remainingCapacity ?? '—'} places
              </button>
            ))}
          </div>
          {selectedGroupCourse ? <div className={styles.selectionSummary}><span>Selected course</span><strong>{selectedGroupCourse.courseCode || selectedGroupCourse.catalogCode || `Course #${selectedGroupCourse.courseId}`} · {selectedGroupCourse.title || 'Untitled'}</strong></div> : null}
          <label>Alignment notes<textarea value={alignmentNotes} onChange={event => setAlignmentNotes(event.target.value)}/></label>
          <button className={styles.primary} disabled={needsReload || !plan.data || !selectedGroupCourse || linkGroup.isPending}>Link selected course</button>
        </form>
      </CollapsibleSection>

      <CollapsibleSection title="Create a one-to-one course" icon={<CalendarPlus/>} summary="Set up a private course with an instructor, term, and weekly slot.">
        <form className={styles.form} onSubmit={event => { event.preventDefault(); createOneOnOne.mutate(); }}>
          <label>Title<input required value={oneOnOne.title} onChange={event => setOneOnOne(current => ({...current, title: event.target.value}))}/></label>
          <AdvisorInstructorPicker required value={oneOnOne.instructorId} onChange={instructorId => setOneOnOne(current => ({...current, instructorId}))}/>
          <label>Term start<EnglishDateInput required value={oneOnOne.startDate} onChangeValue={startDate => setOneOnOne(current => ({...current, startDate}))}/></label>
          <label>Term end<EnglishDateInput required value={oneOnOne.endDate} onChangeValue={endDate => setOneOnOne(current => ({...current, endDate}))}/></label>
          <label>Day of week<select value={oneOnOne.dayOfWeek} onChange={event => setOneOnOne(current => ({...current, dayOfWeek: event.target.value}))}>{WEEKDAYS.map(day => <option key={day}>{day}</option>)}</select></label>
          <label>Start time<EnglishTimeInput required value={oneOnOne.startTime} onChangeValue={startTime => setOneOnOne(current => ({...current, startTime}))}/></label>
          <label>End time<EnglishTimeInput required value={oneOnOne.endTime} onChangeValue={endTime => setOneOnOne(current => ({...current, endTime}))}/></label>
          <label>Location<input value={oneOnOne.location} onChange={event => setOneOnOne(current => ({...current, location: event.target.value}))}/></label>
          <button className={styles.primary} disabled={needsReload || !plan.data || createOneOnOne.isPending}>Create course</button>
        </form>
      </CollapsibleSection>

      <CollapsibleSection title="Update a one-to-one course" icon={<PencilLine/>} summary={courseEdit.courseId ? `Editing course #${courseEdit.courseId}` : 'Reassign the instructor or replace the weekly sessions.'} revealKey={editorReveal}>
        {!courseEdit.courseId ? <div className={styles.emptyState}><strong>Select a one-to-one course to edit</strong><span>Use “Edit schedule” on a current one-to-one course. Course and record versions are carried into this form automatically.</span></div> : null}
        <div className={styles.form}>
          {courseEdit.courseId ? <div className={styles.selectionSummary}><span>Editing</span><strong>Course #{courseEdit.courseId} · launch version {courseEdit.expectedVersion || 'not supplied'}</strong></div> : null}
          <AdvisorInstructorPicker label="New instructor" value={courseEdit.instructorId} onChange={instructorId => setCourseEdit(current => ({...current, instructorId}))}/>
          <button type="button" className={styles.primary} disabled={needsReload || !Number(courseEdit.courseId) || !courseEdit.expectedVersion || !Number(courseEdit.instructorId) || updateOneOnOne.isPending} onClick={() => updateOneOnOne.mutate('instructor')}>Reassign instructor</button>
          <label>Day of week<select value={courseEdit.dayOfWeek} onChange={event => setCourseEdit(current => ({...current, dayOfWeek: event.target.value}))}>{WEEKDAYS.map(day => <option key={day}>{day}</option>)}</select></label>
          <label>Start time<EnglishTimeInput value={courseEdit.startTime} onChangeValue={startTime => setCourseEdit(current => ({...current, startTime}))}/></label>
          <label>End time<EnglishTimeInput value={courseEdit.endTime} onChangeValue={endTime => setCourseEdit(current => ({...current, endTime}))}/></label>
          <label>Location<input value={courseEdit.location} onChange={event => setCourseEdit(current => ({...current, location: event.target.value}))}/></label>
          <button type="button" className={styles.primary} disabled={needsReload || !Number(courseEdit.courseId) || !courseEdit.expectedVersion || !courseEdit.startTime || !courseEdit.endTime || updateOneOnOne.isPending} onClick={() => updateOneOnOne.mutate('sessions')}>Replace sessions</button>
        </div>
      </CollapsibleSection>
        </div>
      </section>
    </div>
  );
};

export default CoursesPage;
