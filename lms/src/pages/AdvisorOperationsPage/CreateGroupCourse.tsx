import {forwardRef, useState} from 'react';
import {ChevronDown, Plus} from 'lucide-react';
import {generatePath, useNavigate} from 'react-router-dom';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type CreateCourseRequest} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {EnglishDateInput} from '@/components/EnglishDateInput';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/CourseManagement.module.scss';

export const CreateGroupCourse = forwardRef<HTMLDetailsElement>(function CreateGroupCourse(_props, ref) {
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

  return <details ref={ref} className={styles.createPanel}>
    <summary><Plus size={20} aria-hidden="true" /><strong>Create group course</strong><span className={styles.createMeta}>Set course identity, term, and primary instructor</span><ChevronDown size={18} aria-hidden="true" /></summary>
    <form className={styles.formGrid} onSubmit={event => {event.preventDefault(); create.mutate();}}>
      <label className={styles.field}>Course code<input required autoComplete="off" value={form.courseCode} onChange={event => setForm(current => ({...current, courseCode: event.target.value}))} /></label>
      <label className={styles.field}>Course title<input required value={form.title} onChange={event => setForm(current => ({...current, title: event.target.value}))} /></label>
      <label className={styles.field}>Term start<EnglishDateInput required value={form.termStartDate} onChangeValue={termStartDate => setForm(current => ({...current, termStartDate}))} /></label>
      <label className={styles.field}>Term end<EnglishDateInput required value={form.termEndDate} onChangeValue={termEndDate => setForm(current => ({...current, termEndDate}))} /></label>
      <AdvisorInstructorPicker required value={form.instructorId} onChange={instructorId => setForm(current => ({...current, instructorId}))} />
      {create.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(create.error, 'The course could not be created.')}</p> : null}
      <div className={styles.formActions}><button type="submit" className={styles.primaryButton} disabled={create.isPending || !form.courseCode.trim() || !form.title.trim() || !form.instructorId || !form.termStartDate || !form.termEndDate || form.termEndDate < form.termStartDate}>{create.isPending ? 'Creating…' : 'Create group course'}</button></div>
    </form>
  </details>;
});
