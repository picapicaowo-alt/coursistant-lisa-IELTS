import {useTranslation} from 'react-i18next';
import React, {FormEvent, useEffect, useRef, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {type StudentIntakeResponse, type PatchStudentIntakeRequest, unwrapData} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {isNotFound, getApiErrorCode} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import local from './index.module.scss';
import {assignmentPath, intakePath} from '../CounsellorDashboardPage/presentation';
import {ParentLinksPanel} from '@/components/ParentLinksPanel';
import {StudentIntakeFormFields} from '@/components/StudentIntakeFormFields';
import {CreateIntakeDialog} from '@/components/StudentIntakeFormFields/CreateIntakeDialog';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import CounsellorIntakesPage from '../CounsellorIntakesPage';
import {
  emptyStudentIntakeForm,
  type StudentIntakeFormValue,
} from '@/components/StudentIntakeFormFields/model';

const intakeFormValue = (intake: StudentIntakeResponse): StudentIntakeFormValue => ({
  firstName: intake.firstName ?? '', middleName: intake.middleName ?? '', lastName: intake.lastName ?? '',
  email: intake.email ?? '', studentType: intake.studentType ?? 'STANDARD', courseRequest: intake.courseRequest ?? '',
  contactPhone: intake.contactPhone ?? '', basicBackground: intake.basicBackground ?? '',
});

const CounsellorIntakeFormPage: React.FC = () => {
  const {t} = useTranslation('common');
  const {intakeId} = useParams();
  const isCreate = !intakeId;
  const numericId = Number(intakeId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [form, setForm] = useState<StudentIntakeFormValue>(emptyStudentIntakeForm);
  const [handover, setHandover] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const reviewedIntake = useRef<StudentIntakeResponse>();
  const [reviewedVersion, setReviewedVersion] = useState<number>();
  const [loadedIntakeId, setLoadedIntakeId] = useState<number | null>(null);

  const detail = useQuery({
    queryKey: advisingQueryKeys.counsellorIntake(numericId),
    queryFn: async () => unwrapData(await counsellorApiService.getStudentIntake(numericId), 'getIntake'),
    enabled: !isCreate && Number.isInteger(numericId),
    retry: false,
  });

  useEffect(() => {
    if (!detail.data || loadedIntakeId === detail.data.intakeId) return;
    setLoadedIntakeId(detail.data.intakeId);
    reviewedIntake.current = detail.data;
    setReviewedVersion(detail.data.intakeVersion);
    setForm(intakeFormValue(detail.data));
  }, [detail.data, loadedIntakeId]);

  useEffect(() => {
    if (detail.isError && isNotFound(detail.error)) setHandover(true);
  }, [detail.isError, detail.error]);

  const save = useMutation({
    mutationFn: async (_continueToAssignment: boolean) => {
      if (isCreate) {
        const payload = {
          firstName: form.firstName.trim(),
          ...(form.middleName.trim() ? {middleName: form.middleName.trim()} : {}),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          studentType: form.studentType,
          courseRequest: form.courseRequest.trim(),
          ...(form.contactPhone.trim() ? {contactPhone: form.contactPhone.trim()} : {}),
          ...(form.basicBackground.trim() ? {basicBackground: form.basicBackground.trim()} : {}),
        };
        const key = idempotency.keyFor('create-intake', idempotencyFingerprint(payload));
        return unwrapData(await counsellorApiService.createStudentIntake(payload, key), 'createIntake');
      }
      if (reviewedVersion == null) throw new Error('Load the intake before saving.');
      const original = reviewedIntake.current;
      if (!original) throw new Error('Load the intake before saving.');
      const payload: PatchStudentIntakeRequest = {expectedIntakeVersion: reviewedVersion};
      for (const field of ['firstName', 'middleName', 'lastName', 'courseRequest', 'contactPhone', 'basicBackground'] as const) {
        if (form[field].trim() !== (original[field] ?? '')) payload[field] = form[field].trim();
      }
      if (form.studentType !== original.studentType) payload.studentType = form.studentType;
      if (Object.keys(payload).length === 1) throw new Error('Change at least one field before saving.');
      const key = idempotency.keyFor(`patch-intake-${numericId}`, idempotencyFingerprint(payload));
      return unwrapData(await counsellorApiService.patchStudentIntake(numericId, payload, key), 'patchIntake');
    },
    onError: error => {
      if (isNotFound(error)) setHandover(true);
      if (getApiErrorCode(error) === 'STUDENT_INTAKE_VERSION_CONFLICT') setReloadRequired(true);
    },
    onSuccess: async (intake, continueToAssignment) => {
      reviewedIntake.current = intake;
      setReviewedVersion(intake.intakeVersion);
      setForm(intakeFormValue(intake));
      queryClient.setQueryData(advisingQueryKeys.counsellorIntake(intake.intakeId), intake);
      await queryClient.invalidateQueries({queryKey: advisingQueryKeys.counsellorAll});
      if (isCreate) navigate(intakePath(intake.intakeId));
      else if (continueToAssignment) navigate(assignmentPath(numericId));
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (save.isPending) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    save.mutate(submitter instanceof HTMLButtonElement && submitter.value === 'assign');
  };

  const hasChanges = isCreate || !reviewedIntake.current ||
    (['firstName', 'middleName', 'lastName', 'courseRequest', 'contactPhone', 'basicBackground', 'studentType'] as const)
      .some(field => form[field].trim() !== (reviewedIntake.current?.[field] ?? ''));

  if (handover) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">This intake is no longer available. After a first assignment the counsellor loses access immediately.</p>
        <Link className={styles.link} to={APP_ROUTE_PATHS.counsellorIntakes}>Back to unassigned queue</Link>
      </div>
    );
  }

  if (isCreate) return <>
    <CounsellorIntakesPage/>
    <CreateIntakeDialog value={form} onChange={setForm} pending={save.isPending}
      onSubmit={onSubmit} onClose={() => navigate(APP_ROUTE_PATHS.counsellorIntakes, {replace: true})}
      error={save.isError ? advisingErrorMessage(save.error, 'The intake could not be saved.') : undefined}/>
  </>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>

          <h1>{isCreate ? 'Create student intake' : 'Edit intake'}</h1>
          <p className={styles.lede}>{t('intake.reviewThenAssign')}</p>
        </div>
        <Link className={styles.link} to={APP_ROUTE_PATHS.counsellorIntakes}>Back to queue</Link>
      </header>
      {save.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, 'The intake could not be saved.')}</p> : null}
      {reloadRequired ? <div className={styles.conflictNotice} role="alert"><p>Your changes are preserved. Reload the latest intake before confirming them again.</p><button type="button" className={styles.secondary} onClick={() => void detail.refetch().then(result => {if (result.data && !result.isError) {setReviewedVersion(result.data.intakeVersion); setReloadRequired(false);}})}>Load latest intake</button></div> : null}
      {detail.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(detail.error, 'Intake could not be loaded.')}</p> : null}
      <section className={`${styles.card} ${styles.wideCard}`}>
        <form className={`${styles.form} ${local.form}`} onSubmit={onSubmit}>
          <fieldset className={local.fields} disabled={save.isPending || !detail.data}>
            <StudentIntakeFormFields value={form} onChange={value => {setForm(value); save.reset();}} emailDisabled/>
          </fieldset>
          {save.isSuccess ? <p className={local.saved} role="status">{t('intake.saved')}</p> : null}
          <div className={`${styles.formActions} ${local.actions}`}>
            <button type="submit" name="intent" value="save" className={styles.secondary} disabled={!hasChanges || save.isPending || reloadRequired || !detail.data}>{save.isPending && !save.variables ? t('intake.saving') : t('actions.saveChanges')}</button>
            {!hasChanges && detail.data && !reloadRequired && !save.isPending ?
              <Link className={styles.primary} to={assignmentPath(numericId)}>{t('intake.continueToAssignment')}</Link> :
              <button type="submit" name="intent" value="assign" className={styles.primary} disabled={save.isPending || reloadRequired || !detail.data}>{save.isPending && save.variables ? t('intake.saving') : t('intake.saveAndContinue')}</button>}
          </div>
        </form>
      </section>
      {!isCreate ? <ParentLinksPanel scope="counsellor" subjectId={numericId} onUnavailable={() => {setHandover(true); void queryClient.invalidateQueries({queryKey: ['counsellor']});}}/> : null}
    </div>
  );
};

export default CounsellorIntakeFormPage;
