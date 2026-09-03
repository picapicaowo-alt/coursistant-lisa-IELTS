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
import {ParentLinksPanel} from '@/components/ParentLinksPanel';
import {StudentIntakeFormFields} from '@/components/StudentIntakeFormFields';
import {
  emptyStudentIntakeForm,
  type StudentIntakeFormValue,
} from '@/components/StudentIntakeFormFields/model';

const CounsellorIntakeFormPage: React.FC = () => {
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
    setForm({
      firstName: detail.data.firstName ?? '',
      middleName: detail.data.middleName ?? '',
      lastName: detail.data.lastName ?? '',
      email: detail.data.email ?? '',
      studentType: detail.data.studentType ?? 'STANDARD',
      courseRequest: detail.data.courseRequest ?? '',
      contactPhone: detail.data.contactPhone ?? '',
      basicBackground: detail.data.basicBackground ?? '',
    });
  }, [detail.data, loadedIntakeId]);

  useEffect(() => {
    if (detail.isError && isNotFound(detail.error)) setHandover(true);
  }, [detail.isError, detail.error]);

  const save = useMutation({
    mutationFn: async () => {
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
    onSuccess: async intake => {
      await queryClient.invalidateQueries({queryKey: ['counsellor']});
      navigate(isCreate ? `/counsellor/intakes/${intake.intakeId}` : `/counsellor/intakes/${numericId}/assign`);
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  const hasChanges = isCreate || !reviewedIntake.current ||
    (['firstName', 'middleName', 'lastName', 'courseRequest', 'contactPhone', 'basicBackground', 'studentType'] as const)
      .some(field => form[field].trim() !== (reviewedIntake.current?.[field] ?? ''));

  if (handover) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">This intake is no longer available. After a first assignment the counsellor loses access immediately.</p>
        <Link className={styles.link} to="/counsellor/intakes">Back to unassigned queue</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>

          <h1>{isCreate ? 'Create student intake' : 'Edit intake'}</h1>
          <p className={styles.lede}>The system creates a USER + STUDENT in this tenant. No password is returned — the student sets one through Forgot password.</p>
        </div>
        <Link className={styles.link} to="/counsellor/intakes">Back to queue</Link>
      </header>
      {save.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, 'The intake could not be saved.')}</p> : null}
      {reloadRequired ? <div className={styles.conflictNotice} role="alert"><p>Your changes are preserved. Reload the latest intake before confirming them again.</p><button type="button" className={styles.secondary} onClick={() => void detail.refetch().then(result => {if (result.data && !result.isError) {setReviewedVersion(result.data.intakeVersion); setReloadRequired(false);}})}>Load latest intake</button></div> : null}
      {detail.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(detail.error, 'Intake could not be loaded.')}</p> : null}
      <section className={`${styles.card} ${styles.wideCard}`}>
        <form className={`${styles.form} ${styles.formColumns}`} onSubmit={onSubmit}>
          <StudentIntakeFormFields value={form} onChange={setForm} emailDisabled={!isCreate}/>
          <button className={`${styles.primary} ${styles.fullWidth}`} disabled={!hasChanges || save.isPending || reloadRequired || (!isCreate && !detail.data)}>{save.isPending ? 'Saving…' : isCreate ? 'Create intake' : 'Save changes'}</button>
          {!isCreate && !hasChanges && detail.data && !reloadRequired ? <Link className={`${styles.secondary} ${styles.fullWidth}`} to={`/counsellor/intakes/${numericId}/assign`}>Continue to advisor assignment</Link> : null}
        </form>
      </section>
      {!isCreate ? <ParentLinksPanel scope="counsellor" subjectId={numericId} onUnavailable={() => {setHandover(true); void queryClient.invalidateQueries({queryKey: ['counsellor']});}}/> : null}
    </div>
  );
};

export default CounsellorIntakeFormPage;
