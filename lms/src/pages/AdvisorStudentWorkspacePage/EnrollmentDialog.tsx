import {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import type {AdvisorStudentCourseResponse} from '@/apis';
import styles from './CoursesPage.module.scss';
import formStyles from '../advising/advising.module.scss';

export type EnrollmentAction = 'ready' | 'publish' | 'reconfirm' | 'complete' | 'withdraw';

export function EnrollmentDialog({course, pending, needsReload, hasPlan, error, onClose, onAction, onEditSchedule, onReload}: {
  course: AdvisorStudentCourseResponse;
  pending: boolean;
  needsReload: boolean;
  hasPlan: boolean;
  error?: string;
  onClose: () => void;
  onAction: (action: EnrollmentAction, reason?: string) => void;
  onEditSchedule: () => void;
  onReload: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = overflow; trigger?.focus();};
  }, []);
  const blocked = pending || needsReload || course.courseId == null;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="enrollment-title" aria-describedby="enrollment-course"
    onClose={onClose} onCancel={event => {if (pending) event.preventDefault();}}>
    <header className={styles.dialogHeader}>
      <h2 id="enrollment-title">Manage enrollment</h2>
      <button type="button" className={styles.closeBtn} aria-label="Close enrollment" disabled={pending} onClick={onClose}><X size={20}/></button>
    </header>
    <div className={styles.dialogBody} aria-busy={pending}>
      <p id="enrollment-course" className={styles.enrollmentCourse}>{course.title || course.courseCode || 'Course enrollment'}</p>
      {error ? <p className={formStyles.error} role="alert">{error}</p> : null}
      {needsReload ? <div role="alert"><p>The record version changed. Your reason is preserved. Load the latest records before retrying.</p><button type="button" className={formStyles.secondary} onClick={onReload}>Load latest planning records</button></div> : null}
      <div className={styles.enrollmentActions}>
        {course.deliveryMode === 'ONE_ON_ONE' ? <button type="button" className={formStyles.secondary} disabled={blocked} onClick={onEditSchedule}>Edit schedule</button> : null}
        <button type="button" className={formStyles.secondary} disabled={blocked || !hasPlan || course.courseLinkVersion == null} onClick={() => onAction('reconfirm')}>Reconfirm</button>
        {course.deliveryMode === 'ONE_ON_ONE' && course.launchState === 'DRAFT' ? <button type="button" className={formStyles.secondary} disabled={blocked || course.courseLaunchVersion == null} onClick={() => onAction('ready')}>Ready</button> : null}
        {course.deliveryMode === 'ONE_ON_ONE' && course.launchState === 'READY' ? <button type="button" className={formStyles.primary} disabled={blocked || course.courseLaunchVersion == null} onClick={() => onAction('publish')}>Publish</button> : null}
        <button type="button" className={formStyles.secondary} disabled={blocked || course.completionVersion == null} onClick={() => onAction('complete')}>Complete</button>
      </div>
      {course.deliveryMode === 'GROUP' ? <form className={styles.withdrawalForm} onSubmit={event => {
        event.preventDefault();
        if (!blocked && course.courseLinkVersion != null && reason.trim()) onAction('withdraw', reason.trim());
      }}>
        <label htmlFor="withdrawal-reason">Reason for withdrawal <span aria-hidden="true">*</span></label>
        <textarea id="withdrawal-reason" required maxLength={1000} rows={4} value={reason} disabled={pending}
          onChange={event => setReason(event.target.value)}/>
        <button type="submit" className={formStyles.danger} disabled={blocked || course.courseLinkVersion == null || !reason.trim()}>Withdraw</button>
      </form> : null}
    </div>
    <footer className={styles.dialogFooter}><button type="button" className={styles.cancelBtn} disabled={pending} onClick={onClose}>Cancel</button></footer>
  </dialog>;
}
