import {useState, type Dispatch, type SetStateAction} from 'react';
import {useTranslation} from 'react-i18next';
import type {AdvisorStudentCourseResponse} from '@/apis';
import type {SessionDayOfWeek, SessionType} from '@/apis/types/course';
import {COURSE_SESSION_DAYS, COURSE_SESSION_TYPES} from '@/configs/courseSessions';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {EnglishTimeInput} from '@/components/EnglishDateInput';
import {TeachingDialog} from '@/components/TeachingWorkspace';
import {formatWeekday} from '@/i18n/formatting';
import {parseInputTime} from '@/i18n/dateInput';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import cStyles from './CoursesPage.module.scss';

type CourseDraft = {
  courseId: string;
  expectedVersion: string;
  instructorId: string;
  type: SessionType;
  dayOfWeek: SessionDayOfWeek;
  startTime: string;
  endTime: string;
  location: string;
};

export function OneOnOneCourseDialog({courses, draft, onDraft, loading, pending, needsReload, error, saved, onSelect, onReload, onClose, onSave}: {
  courses: AdvisorStudentCourseResponse[];
  draft: CourseDraft;
  onDraft: Dispatch<SetStateAction<CourseDraft>>;
  loading: boolean;
  pending: boolean;
  needsReload: boolean;
  error: unknown;
  saved: boolean;
  onSelect: (course?: AdvisorStudentCourseResponse) => void;
  onReload: () => void;
  onClose: () => void;
  onSave: (action: 'instructor' | 'sessions') => void;
}) {
  const {t} = useTranslation('advising');
  const [invalidTimes, setInvalidTimes] = useState(false);
  const busy = loading || pending;
  const blocked = busy || needsReload || !draft.courseId || !draft.expectedVersion;
  return <TeachingDialog title={t('studentCourses.updateOneToOne')} busy={busy} onClose={onClose}>
    {loading ? <p role="status">{t('studentCourses.loading')}</p> : null}
    {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, t('studentCourses.failed'))}</p> : null}
    {needsReload ? <div role="alert"><p>{t('studentCourses.conflict')}</p><button type="button" className={styles.secondary} onClick={onReload}>{t('studentCourses.reload')}</button></div> : null}
    {saved ? <p role="status">{t('studentCourses.saved')}</p> : null}
    <form noValidate onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const start = parseInputTime(String(values.get('startTime') ?? ''));
      const end = parseInputTime(String(values.get('endTime') ?? ''));
      const valid = Boolean(start && end && start < end);
      setInvalidTimes(!valid);
      if (valid && !blocked) onSave('sessions');
    }}>
      <fieldset className={`${styles.form} ${cStyles.updateFields}`} disabled={busy}>
        <label>{t('studentCourses.course')}
          <select value={draft.courseId} onChange={event => {setInvalidTimes(false); onSelect(courses.find(course => String(course.courseId) === event.target.value));}}>
            <option value="">{t('studentCourses.selectOneToOne')}</option>
            {courses.map(course => <option key={course.courseId} value={String(course.courseId)}>{course.title || course.courseCode || t('studentCourses.course')}</option>)}
          </select>
        </label>
        {draft.courseId && !loading && draft.expectedVersion ? <>
          <AdvisorInstructorPicker label={t('studentCourses.newInstructor')} value={draft.instructorId}
            onChange={instructorId => onDraft(current => ({...current, instructorId}))}/>
          <button type="button" className={styles.primary} disabled={blocked || !Number(draft.instructorId)} onClick={() => onSave('instructor')}>{t('studentCourses.reassign')}</button>
          <div className={cStyles.scheduleTimes}>
            <label>{t('studentCourses.sessionType')}
              <select value={draft.type} onChange={event => onDraft(current => ({...current, type: event.target.value as SessionType}))}>
                {COURSE_SESSION_TYPES.map(type => <option key={type} value={type}>{t(`studentCourses.types.${type}`)}</option>)}
              </select>
            </label>
            <label>{t('studentCourses.weekday')}
              <select value={draft.dayOfWeek} onChange={event => onDraft(current => ({...current, dayOfWeek: event.target.value as SessionDayOfWeek}))}>
                {COURSE_SESSION_DAYS.map(day => <option key={day.value} value={day.value}>{formatWeekday(day.value, 'long')}</option>)}
              </select>
            </label>
          </div>
          <div className={cStyles.scheduleTimes}>
            <label>{t('studentCourses.startTime')}<EnglishTimeInput name="startTime" aria-label={t('studentCourses.startTime')}
              value={draft.startTime} onChangeValue={startTime => onDraft(current => ({...current, startTime}))}/></label>
            <label>{t('studentCourses.endTime')}<EnglishTimeInput name="endTime" aria-label={t('studentCourses.endTime')}
              value={draft.endTime} onChangeValue={endTime => onDraft(current => ({...current, endTime}))}/></label>
          </div>
          <label>{t('studentCourses.location')}<input value={draft.location} onChange={event => onDraft(current => ({...current, location: event.target.value}))}/></label>
          {invalidTimes ? <p role="alert" className={styles.error}>{t('studentCourses.invalidSchedule')}</p> : null}
          <button type="submit" className={styles.primary} disabled={blocked}>{t('studentCourses.replaceSessions')}</button>
        </> : null}
      </fieldset>
    </form>
    <div className={`${styles.actions} ${cStyles.updateFooter}`}><button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>{t('common:actions.close')}</button></div>
  </TeachingDialog>;
}
