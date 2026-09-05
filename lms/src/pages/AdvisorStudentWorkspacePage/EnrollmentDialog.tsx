import {useTranslation} from 'react-i18next';
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
  const {t: translate} = useTranslation();
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
      <h2 id="enrollment-title">{translate("advising:enrollment.manage")}</h2>
      <button type="button" className={styles.closeBtn} aria-label={translate("advising:enrollment.close")} disabled={pending} onClick={onClose}><X size={20}/></button>
    </header>
    <div className={styles.dialogBody} aria-busy={pending}>
      <p id="enrollment-course" className={styles.enrollmentCourse}>{course.title || course.courseCode || translate("advising:enrollment.course")}</p>
      {error ? <p className={formStyles.error} role="alert">{error}</p> : null}
      {needsReload ? <div role="alert"><p>{translate("advising:enrollment.conflict")}</p><button type="button" className={formStyles.secondary} onClick={onReload}>{translate("advising:studentCourses.reload")}</button></div> : null}
      <div className={styles.enrollmentActions}>
        {course.deliveryMode === 'ONE_ON_ONE' ? <button type="button" className={formStyles.secondary} disabled={blocked} onClick={onEditSchedule}>{translate("advising:enrollment.editSchedule")}</button> : null}
        <button type="button" className={formStyles.secondary} disabled={blocked || !hasPlan || course.courseLinkVersion == null} onClick={() => onAction('reconfirm')}>{translate("advising:enrollment.reconfirm")}</button>
        {course.deliveryMode === 'ONE_ON_ONE' && course.launchState === 'DRAFT' ? <button type="button" className={formStyles.secondary} disabled={blocked || course.courseLaunchVersion == null} onClick={() => onAction('ready')}>{translate("advising:enrollment.ready")}</button> : null}
        {course.deliveryMode === 'ONE_ON_ONE' && course.launchState === 'READY' ? <button type="button" className={formStyles.primary} disabled={blocked || course.courseLaunchVersion == null} onClick={() => onAction('publish')}>{translate("course:addContent.publishButton")}</button> : null}
        <button type="button" className={formStyles.secondary} disabled={blocked || course.completionVersion == null} onClick={() => onAction('complete')}>{translate("advising:enrollment.complete")}</button>
      </div>
      {course.deliveryMode === 'GROUP' ? <form className={styles.withdrawalForm} onSubmit={event => {
        event.preventDefault();
        if (!blocked && course.courseLinkVersion != null && reason.trim()) onAction('withdraw', reason.trim());
      }}>
        <label htmlFor="withdrawal-reason">{translate("advising:enrollment.withdrawalReason")}{' '}<span aria-hidden="true">*</span></label>
        <textarea id="withdrawal-reason" required maxLength={1000} rows={4} value={reason} disabled={pending}
          onChange={event => setReason(event.target.value)}/>
        <button type="submit" className={formStyles.danger} disabled={blocked || course.courseLinkVersion == null || !reason.trim()}>{translate("advising:enrollment.withdraw")}</button>
      </form> : null}
    </div>
    <footer className={styles.dialogFooter}><button type="button" className={styles.cancelBtn} disabled={pending} onClick={onClose}>{translate("common:actions.cancel")}</button></footer>
  </dialog>;
}
