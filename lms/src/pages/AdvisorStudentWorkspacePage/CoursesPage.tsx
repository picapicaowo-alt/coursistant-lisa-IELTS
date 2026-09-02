import React, {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Link, useParams} from 'react-router-dom';
import type {AdvisorStudentCourseResponse} from '@/apis';
import {unwrapData} from '@/apis';
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
  const [groupCourseId, setGroupCourseId] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [alignmentNotes, setAlignmentNotes] = useState('');
  const [oneOnOne, setOneOnOne] = useState({title: '', instructorId: '', startDate: '', endDate: '', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', location: ''});
  const [courseEdit, setCourseEdit] = useState({courseId: '', instructorId: '', expectedVersion: '', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', location: ''});

  const plan = useQuery({
    queryKey: advisingQueryKeys.advisorStudyPlan(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudyPlan(id), 'advisorStudyPlan'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const courses = useQuery({
    queryKey: ['advisor', 'student-courses', id],
    queryFn: async () => unwrapData(await advisorApiService.listStudentCourses(id), 'advisorStudentCourses'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const courseOptions = useQuery({
    queryKey: ['advisor', 'student-course-options', id, courseSearch],
    queryFn: async () => unwrapData(await advisorApiService.searchGroupCourseOptions(id, {query: courseSearch, page: 0, size: 20}), 'advisorGroupCourseOptions'),
    enabled: Number.isInteger(id) && courseSearch.trim().length >= 2,
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({queryKey: ['advisor', 'student-courses', id]});
  const linkGroup = useMutation({
    mutationFn: () => advisorApiService.linkGroupCourse(id, {
      courseId: Number(groupCourseId),
      expectedStudyPlanVersion: plan.data?.plan.studyPlanVersion,
      alignmentNotes: alignmentNotes || undefined,
    }),
    onSuccess: async () => { setGroupCourseId(''); setAlignmentNotes(''); await refresh(); },
  });
  const createOneOnOne = useMutation({
    mutationFn: () => advisorApiService.createOneOnOneCourse(id, {
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
    }),
    onSuccess: async () => {
      setOneOnOne({title: '', instructorId: '', startDate: '', endDate: '', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', location: ''});
      await refresh();
    },
  });
  const transition = useMutation({
    mutationFn: async ({action, course}: {action: 'ready' | 'publish' | 'reconfirm' | 'complete' | 'withdraw'; course: AdvisorStudentCourseResponse}) => {
      const courseId = course.courseId;
      if (courseId == null) throw new Error('Course response is missing courseId');
      if (action === 'ready') return advisorApiService.readyOneOnOneLaunch(id, courseId, {expectedCourseLaunchVersion: course.courseLaunchVersion});
      if (action === 'publish') return advisorApiService.publishOneOnOneLaunch(id, courseId, {expectedCourseLaunchVersion: course.courseLaunchVersion});
      if (action === 'reconfirm') return advisorApiService.reconfirmCourseLink(id, courseId, {expectedCourseLinkVersion: course.courseLinkVersion, expectedStudyPlanVersion: plan.data?.plan.studyPlanVersion});
      if (action === 'complete') return advisorApiService.completeStudentCourse(id, courseId, {expectedCompletionVersion: course.completionVersion});
      return advisorApiService.withdrawGroupCourse(id, courseId, {expectedCourseLinkVersion: course.courseLinkVersion});
    },
    onSuccess: refresh,
  });
  const updateOneOnOne = useMutation({
    mutationFn: (action: 'instructor' | 'sessions') => action === 'instructor'
      ? advisorApiService.reassignOneOnOneInstructor(id, Number(courseEdit.courseId), {primaryInstructorUserId: Number(courseEdit.instructorId), expectedCourseLaunchVersion: Number(courseEdit.expectedVersion)})
      : advisorApiService.replaceOneOnOneSessions(id, Number(courseEdit.courseId), {expectedCourseLaunchVersion: Number(courseEdit.expectedVersion), sessions: [{type: 'ONE_ON_ONE', dayOfWeek: courseEdit.dayOfWeek, startTime: courseEdit.startTime, endTime: courseEdit.endTime, location: courseEdit.location || undefined}]}),
    onSuccess: refresh,
  });

  const error = plan.error || courses.error || courseOptions.error || linkGroup.error || createOneOnOne.error || transition.error || updateOneOnOne.error;
  const selectedGroupCourse = courseOptions.data?.items.find(option => String(option.courseId) === groupCourseId);

  return (
    <div className={styles.grid}>
      {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, 'Course planning could not be completed.')}</p> : null}
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
      <section className={styles.card}>
        <h2>Current courses</h2>
        {courses.isPending ? <p className={styles.status}>Loading courses…</p> : null}
        {courses.data?.length === 0 ? <p className={styles.status}>No course is linked to this study plan.</p> : null}
        <div className={styles.list}>
          {(courses.data ?? []).map((course, index) => (
            <article className={styles.row} key={course.courseId ?? index}>
              <div className={styles.identity}>
                <strong>{course.title || course.courseCode || `Course #${course.courseId}`}</strong>
                <span>{course.deliveryMode || 'Course'} · {course.launchState || course.status || 'Pending'}</span>
                <small>{formatPersonName({firstName: course.instructorFirstName, middleName: course.instructorMiddleName, lastName: course.instructorLastName}, 'Instructor not assigned')} · link v{course.courseLinkVersion ?? '—'} · launch v{course.courseLaunchVersion ?? '—'}</small>
              </div>
              <div className={styles.actions}>
                {course.deliveryMode === 'ONE_ON_ONE' && course.courseId != null ? <button className={styles.secondary} onClick={() => setCourseEdit(current => ({...current, courseId: String(course.courseId), expectedVersion: course.courseLaunchVersion == null ? '' : String(course.courseLaunchVersion), instructorId: course.instructorUserId == null ? '' : String(course.instructorUserId)}))}>Edit schedule</button> : null}
                <button className={styles.secondary} onClick={() => transition.mutate({action: 'reconfirm', course})}>Reconfirm</button>
                <button className={styles.secondary} onClick={() => transition.mutate({action: 'ready', course})}>Ready</button>
                <button className={styles.primary} onClick={() => transition.mutate({action: 'publish', course})}>Publish</button>
                <button className={styles.secondary} onClick={() => transition.mutate({action: 'complete', course})}>Complete</button>
                <button className={styles.danger} onClick={() => transition.mutate({action: 'withdraw', course})}>Withdraw</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Link a group course</h2>
        <p className={styles.muted}>Current study plan version: {plan.data?.plan.studyPlanVersion ?? 'not available'}</p>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); linkGroup.mutate(); }}>
          <label>Search available courses<input value={courseSearch} onChange={event => setCourseSearch(event.target.value)} placeholder="Course code or title"/></label>
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
          <button className={styles.primary} disabled={!plan.data || !selectedGroupCourse || linkGroup.isPending}>Link selected course</button>
        </form>
      </section>

      <section className={styles.card}>
        <h2>Create a one-to-one course</h2>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); createOneOnOne.mutate(); }}>
          <label>Title<input required value={oneOnOne.title} onChange={event => setOneOnOne(current => ({...current, title: event.target.value}))}/></label>
          <label>Instructor user ID<input required inputMode="numeric" value={oneOnOne.instructorId} onChange={event => setOneOnOne(current => ({...current, instructorId: event.target.value}))}/></label>
          <label>Term start<EnglishDateInput required value={oneOnOne.startDate} onChangeValue={startDate => setOneOnOne(current => ({...current, startDate}))}/></label>
          <label>Term end<EnglishDateInput required value={oneOnOne.endDate} onChangeValue={endDate => setOneOnOne(current => ({...current, endDate}))}/></label>
          <label>Day of week<select value={oneOnOne.dayOfWeek} onChange={event => setOneOnOne(current => ({...current, dayOfWeek: event.target.value}))}>{['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].map(day => <option key={day}>{day}</option>)}</select></label>
          <label>Start time<EnglishTimeInput required value={oneOnOne.startTime} onChangeValue={startTime => setOneOnOne(current => ({...current, startTime}))}/></label>
          <label>End time<EnglishTimeInput required value={oneOnOne.endTime} onChangeValue={endTime => setOneOnOne(current => ({...current, endTime}))}/></label>
          <label>Location<input value={oneOnOne.location} onChange={event => setOneOnOne(current => ({...current, location: event.target.value}))}/></label>
          <button className={styles.primary} disabled={!plan.data || createOneOnOne.isPending}>Create course</button>
        </form>
      </section>

      <section className={styles.card}>
        <h2>Update a one-to-one course</h2>
        {!courseEdit.courseId ? <div className={styles.emptyState}><strong>Select a one-to-one course to edit</strong><span>Use “Edit schedule” on a current one-to-one course. Course and record versions are carried into this form automatically.</span></div> : null}
        <div className={styles.form}>
          {courseEdit.courseId ? <div className={styles.selectionSummary}><span>Editing</span><strong>Course #{courseEdit.courseId} · launch version {courseEdit.expectedVersion || 'not supplied'}</strong></div> : null}
          <label>New instructor user ID<input inputMode="numeric" value={courseEdit.instructorId} onChange={event => setCourseEdit(current => ({...current, instructorId: event.target.value}))}/></label>
          <button type="button" className={styles.primary} disabled={!Number(courseEdit.courseId) || !courseEdit.expectedVersion || !Number(courseEdit.instructorId) || updateOneOnOne.isPending} onClick={() => updateOneOnOne.mutate('instructor')}>Reassign instructor</button>
          <label>Day of week<select value={courseEdit.dayOfWeek} onChange={event => setCourseEdit(current => ({...current, dayOfWeek: event.target.value}))}>{['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].map(day => <option key={day}>{day}</option>)}</select></label>
          <label>Start time<EnglishTimeInput value={courseEdit.startTime} onChangeValue={startTime => setCourseEdit(current => ({...current, startTime}))}/></label>
          <label>End time<EnglishTimeInput value={courseEdit.endTime} onChangeValue={endTime => setCourseEdit(current => ({...current, endTime}))}/></label>
          <label>Location<input value={courseEdit.location} onChange={event => setCourseEdit(current => ({...current, location: event.target.value}))}/></label>
          <button type="button" className={styles.primary} disabled={!Number(courseEdit.courseId) || !courseEdit.expectedVersion || !courseEdit.startTime || !courseEdit.endTime || updateOneOnOne.isPending} onClick={() => updateOneOnOne.mutate('sessions')}>Replace sessions</button>
        </div>
      </section>
    </div>
  );
};

export default CoursesPage;
