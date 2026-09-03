import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type CreateCourseRequest} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {EnglishDateInput} from '@/components/EnglishDateInput';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';

export function CreateGroupCourse() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [form, setForm] = useState({courseCode: '', title: '', termStartDate: '', termEndDate: '', instructorId: ''});
  const create = useMutation({
    mutationFn: async () => {
      const request: CreateCourseRequest = {courseCode: form.courseCode.trim(), title: form.title.trim(), termStartDate: form.termStartDate, termEndDate: form.termEndDate, primaryInstructorUserId: Number(form.instructorId)};
      return unwrapData(await idempotency.run('create-owned-group-course', request, (key, payload) => courseApiService.createCourse(payload, key)), 'courseCreate');
    },
    onSuccess: async course => {await client.invalidateQueries({queryKey: ['advisor', 'owned-courses']}); navigate(`/advisor/courses/${course.id}/delivery`);},
  });
  return <details className={styles.card}>
    <summary>Create a group course</summary>
    <p>You own the course lifecycle. The primary instructor prepares weeks, syllabus, assignments, and teaching content.</p>
    <form className={styles.form} onSubmit={event => {event.preventDefault(); create.mutate();}}>
      <label>Course code<input required value={form.courseCode} onChange={event => setForm(current => ({...current, courseCode: event.target.value}))}/></label>
      <label>Course title<input required value={form.title} onChange={event => setForm(current => ({...current, title: event.target.value}))}/></label>
      <AdvisorInstructorPicker required value={form.instructorId} onChange={instructorId => setForm(current => ({...current, instructorId}))}/>
      <label>Term start<EnglishDateInput required value={form.termStartDate} onChangeValue={termStartDate => setForm(current => ({...current, termStartDate}))}/></label>
      <label>Term end<EnglishDateInput required value={form.termEndDate} onChangeValue={termEndDate => setForm(current => ({...current, termEndDate}))}/></label>
      <button className={styles.primary} disabled={create.isPending || !form.instructorId || form.termEndDate < form.termStartDate}>{create.isPending ? 'Creating…' : 'Create group course'}</button>
    </form>
    {create.isError ? <p role="alert">{advisingErrorMessage(create.error, 'The course could not be created.')}</p> : null}
  </details>;
}
