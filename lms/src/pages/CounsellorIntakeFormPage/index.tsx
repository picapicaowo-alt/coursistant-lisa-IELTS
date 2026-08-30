import React, {FormEvent, useEffect, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {StudentType, unwrapData} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {ParentLinksPanel} from '@/components/ParentLinksPanel';

interface IntakeFormState {
  name: string;
  email: string;
  studentType: StudentType;
  courseRequest: string;
  contactPhone: string;
  basicBackground: string;
}

const emptyForm: IntakeFormState = {
  name: '',
  email: '',
  studentType: 'STANDARD',
  courseRequest: '',
  contactPhone: '',
  basicBackground: '',
};

const CounsellorIntakeFormPage: React.FC = () => {
  const {intakeId} = useParams();
  const isCreate = !intakeId;
  const numericId = Number(intakeId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [form, setForm] = useState<IntakeFormState>(emptyForm);
  const [handover, setHandover] = useState(false);

  const detail = useQuery({
    queryKey: advisingQueryKeys.counsellorIntake(numericId),
    queryFn: async () => unwrapData(await counsellorApiService.getStudentIntake(numericId), 'getIntake'),
    enabled: !isCreate && Number.isInteger(numericId),
    retry: false,
  });

  useEffect(() => {
    if (!detail.data) return;
    setForm({
      name: detail.data.name ?? '',
      email: detail.data.email ?? '',
      studentType: detail.data.studentType ?? 'STANDARD',
      courseRequest: detail.data.courseRequest ?? '',
      contactPhone: detail.data.contactPhone ?? '',
      basicBackground: detail.data.basicBackground ?? '',
    });
  }, [detail.data]);

  useEffect(() => {
    if (detail.isError && isNotFound(detail.error)) setHandover(true);
  }, [detail.isError, detail.error]);

  const save = useMutation({
    mutationFn: async () => {
      if (isCreate) {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          studentType: form.studentType,
          courseRequest: form.courseRequest.trim(),
          ...(form.contactPhone.trim() ? {contactPhone: form.contactPhone.trim()} : {}),
          ...(form.basicBackground.trim() ? {basicBackground: form.basicBackground.trim()} : {}),
        };
        const key = idempotency.keyFor('create-intake', idempotencyFingerprint(payload));
        return unwrapData(await counsellorApiService.createStudentIntake(payload, key), 'createIntake');
      }
      const payload = {
        expectedIntakeVersion: detail.data?.intakeVersion ?? 0,
        name: form.name.trim(),
        studentType: form.studentType,
        courseRequest: form.courseRequest.trim(),
        ...(form.contactPhone.trim() ? {contactPhone: form.contactPhone.trim()} : {}),
        ...(form.basicBackground.trim() ? {basicBackground: form.basicBackground.trim()} : {}),
      };
      const key = idempotency.keyFor(`patch-intake-${numericId}`, idempotencyFingerprint(payload));
      return unwrapData(await counsellorApiService.patchStudentIntake(numericId, payload, key), 'patchIntake');
    },
    onSuccess: async intake => {
      await queryClient.invalidateQueries({queryKey: ['counsellor']});
      navigate(isCreate ? `/counsellor/intakes/${intake.intakeId}` : `/counsellor/intakes/${numericId}/assign`);
    },
  });

  const field = (key: keyof IntakeFormState) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(current => ({...current, [key]: event.target.value}));
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  if (handover) {
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">This intake is no longer available. After a first assignment the counsellor loses access immediately.</p>
        <Link className={styles.link} to="/counsellor/intakes">Back to unassigned queue</Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Counsellor</p>
          <h1>{isCreate ? 'Create student intake' : 'Edit intake'}</h1>
          <p className={styles.lede}>The system creates a USER + STUDENT in this tenant. No password is returned — the student sets one through Forgot password.</p>
        </div>
        <Link className={styles.link} to="/counsellor/intakes">Back to queue</Link>
      </header>
      {save.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, 'The intake could not be saved.')}</p> : null}
      {detail.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(detail.error, 'Intake could not be loaded.')}</p> : null}
      <section className={styles.card}>
        <form className={styles.form} onSubmit={onSubmit}>
          <label><span>Name</span><input required maxLength={255} {...field('name')}/></label>
          <label>
            <span>Email</span>
            <input required type="email" maxLength={255} disabled={!isCreate} {...field('email')}/>
          </label>
          <label>
            <span>Student type</span>
            <select value={form.studentType} onChange={event => setForm(current => ({...current, studentType: event.target.value as StudentType}))}>
              <option value="STANDARD">STANDARD</option>
              <option value="VIP">VIP</option>
            </select>
          </label>
          <label><span>Course request</span><textarea required maxLength={2000} {...field('courseRequest')}/></label>
          <label><span>Contact phone</span><input minLength={7} maxLength={64} {...field('contactPhone')}/></label>
          <label><span>Basic background</span><textarea maxLength={4000} {...field('basicBackground')}/></label>
          <button className={styles.primary} disabled={save.isPending}>{save.isPending ? 'Saving…' : isCreate ? 'Create intake' : 'Save changes'}</button>
        </form>
      </section>
      {!isCreate ? <ParentLinksPanel scope="counsellor" subjectId={numericId}/> : null}
    </main>
  );
};

export default CounsellorIntakeFormPage;
