import {useState} from 'react';
import {generatePath, useNavigate} from 'react-router-dom';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type CreateCourseRequest} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {EnglishDateInput} from '@/components/EnglishDateInput';
import {TeachingDialog} from '@/components/TeachingWorkspace';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/CourseManagement.module.scss';
import modal from './CreateGroupCourse.module.scss';

export function CreateGroupCourse({onClose}: {onClose: () => void}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [form, setForm] = useState({courseCode: '', title: '', termStartDate: '', termEndDate: '', instructorId: ''});
  const create = useMutation({
    mutationFn: async () => {
      const request: CreateCourseRequest = {courseCode: form.courseCode.trim(), title: form.title.trim(), termStartDate: form.termStartDate, termEndDate: form.termEndDate, primaryInstructorUserId: Number(form.instructorId)};
      return unwrapData(await idempotency.run('create-owned-group-course', request, (key, payload) => courseApiService.createCourse(payload, key)), 'courseCreate');
    },
    onSuccess: async course => {await client.invalidateQueries({queryKey: ['advisor', 'owned-courses']}); navigate(`${generatePath(APP_ROUTE_PATHS.advisorCoursesCourseIdDelivery, {courseId: String(course.id)})}?view=delivery`);},
  });

  return <TeachingDialog title="Create group course" description="Set course identity, term, and primary instructor." className={modal.dialog} onClose={onClose} busy={create.isPending}>
    <form className={modal.form} aria-busy={create.isPending} onSubmit={event => {event.preventDefault(); if (!create.isPending) create.mutate();}}>
      <label className={styles.field}>Course code<input required autoComplete="off" value={form.courseCode} onChange={event => setForm(current => ({...current, courseCode: event.target.value}))} /></label>
      <label className={styles.field}>Course title<input required value={form.title} onChange={event => setForm(current => ({...current, title: event.target.value}))} /></label>
      <label className={styles.field}>Term start<EnglishDateInput required value={form.termStartDate} onChangeValue={termStartDate => setForm(current => ({...current, termStartDate}))} /></label>
      <label className={styles.field}>Term end<EnglishDateInput required value={form.termEndDate} onChangeValue={termEndDate => setForm(current => ({...current, termEndDate}))} /></label>
      <AdvisorInstructorPicker required value={form.instructorId} onChange={instructorId => setForm(current => ({...current, instructorId}))} />
      {create.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(create.error, 'The course could not be created.')}</p> : null}
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryButton} disabled={create.isPending} onClick={onClose}>Cancel</button>
        <button type="submit" className={styles.primaryButton} disabled={create.isPending || !form.courseCode.trim() || !form.title.trim() || !form.instructorId || !form.termStartDate || !form.termEndDate || form.termEndDate < form.termStartDate}>{create.isPending ? 'Creating…' : 'Create group course'}</button>
      </div>
    </form>
  </TeachingDialog>;
}
