import React, {FormEvent, useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {CreateStudentProfileRequest, ProfileSkillRequest, unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';

const emptySkill = (position: number): ProfileSkillRequest => ({
  skillCode: '',
  displayName: '',
  scale: '0-9',
  currentValue: '',
  targetValue: '',
  gapSummary: '',
  position,
});

interface ProfileFormState {
  contactPhone: string;
  academicBackground: string;
  priorTestExperience: string;
  baselineAssessment: string;
  targetGoal: string;
  targetMetric: string;
  targetValue: string;
  targetDate: string;
  advisorInterpretation: string;
  advisorPrivateNotes: string;
  skills: ProfileSkillRequest[];
}

const emptyForm: ProfileFormState = {
  contactPhone: '',
  academicBackground: '',
  priorTestExperience: '',
  baselineAssessment: '',
  targetGoal: '',
  targetMetric: '',
  targetValue: '',
  targetDate: '',
  advisorInterpretation: '',
  advisorPrivateNotes: '',
  skills: [emptySkill(1)],
};

const toPayload = (form: ProfileFormState): CreateStudentProfileRequest => ({
  ...(form.contactPhone.trim() ? {contactPhone: form.contactPhone.trim()} : {}),
  ...(form.academicBackground.trim() ? {academicBackground: form.academicBackground.trim()} : {}),
  ...(form.priorTestExperience.trim() ? {priorTestExperience: form.priorTestExperience.trim()} : {}),
  ...(form.baselineAssessment.trim() ? {baselineAssessment: form.baselineAssessment.trim()} : {}),
  ...(form.targetGoal.trim() ? {targetGoal: form.targetGoal.trim()} : {}),
  ...(form.targetMetric.trim() ? {targetMetric: form.targetMetric.trim()} : {}),
  ...(form.targetValue.trim() ? {targetValue: form.targetValue.trim()} : {}),
  ...(form.targetDate.trim() ? {targetDate: form.targetDate.trim()} : {}),
  ...(form.advisorInterpretation.trim() ? {advisorInterpretation: form.advisorInterpretation.trim()} : {}),
  ...(form.advisorPrivateNotes.trim() ? {advisorPrivateNotes: form.advisorPrivateNotes.trim()} : {}),
  skills: form.skills
    .filter(skill => skill.skillCode.trim() && skill.displayName.trim())
    .map((skill, index) => ({
      ...skill,
      skillCode: skill.skillCode.trim(),
      displayName: skill.displayName.trim(),
      scale: skill.scale.trim() || '0-9',
      position: index + 1,
      ...(skill.currentValue?.trim() ? {currentValue: skill.currentValue.trim()} : {}),
      ...(skill.targetValue?.trim() ? {targetValue: skill.targetValue.trim()} : {}),
      ...(skill.gapSummary?.trim() ? {gapSummary: skill.gapSummary.trim()} : {}),
    })),
});

const AdvisorStudentProfilePage: React.FC = () => {
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [form, setForm] = useState<ProfileFormState>(emptyForm);

  const query = useQuery({
    queryKey: advisingQueryKeys.advisorProfile(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudentProfile(id), 'getProfile'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const missing = query.isError && isNotFound(query.error);

  useEffect(() => {
    if (!query.data) return;
    setForm({
      contactPhone: query.data.contactPhone ?? '',
      academicBackground: query.data.academicBackground ?? '',
      priorTestExperience: query.data.priorTestExperience ?? '',
      baselineAssessment: query.data.baselineAssessment ?? '',
      targetGoal: query.data.targetGoal ?? '',
      targetMetric: query.data.targetMetric ?? '',
      targetValue: query.data.targetValue ?? '',
      targetDate: query.data.targetDate ?? '',
      advisorInterpretation: query.data.advisorInterpretation ?? '',
      advisorPrivateNotes: query.data.advisorPrivateNotes ?? '',
      skills: query.data.skills && query.data.skills.length > 0
        ? query.data.skills.map((skill, index) => ({
          skillCode: skill.skillCode ?? '',
          displayName: skill.displayName ?? '',
          scale: skill.scale ?? '0-9',
          currentValue: skill.currentValue ?? '',
          targetValue: skill.targetValue ?? '',
          gapSummary: skill.gapSummary ?? '',
          position: skill.position ?? index + 1,
        }))
        : [emptySkill(1)],
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form);
      if (missing) {
        const key = idempotency.keyFor(`profile-create-${id}`, idempotencyFingerprint(payload));
        return unwrapData(await advisorApiService.createStudentProfile(id, payload, key), 'createProfile');
      }
      if (!payload.skills?.length) throw new Error('Add at least one skill before saving.');
      const update = {...payload, expectedProfileVersion: query.data?.profileVersion ?? 0, skills: payload.skills};
      const key = idempotency.keyFor(`profile-put-${id}`, idempotencyFingerprint(update));
      return unwrapData(await advisorApiService.updateStudentProfile(id, update, key), 'updateProfile');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: advisingQueryKeys.advisorProfile(id)});
      await queryClient.invalidateQueries({queryKey: advisingQueryKeys.advisorStudyPlan(id)});
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  const setSkill = (index: number, patch: Partial<ProfileSkillRequest>) => {
    setForm(current => ({
      ...current,
      skills: current.skills.map((skill, skillIndex) => skillIndex === index ? {...skill, ...patch} : skill),
    }));
  };

  if (query.isPending) return <p className={styles.status}>Loading profile…</p>;
  if (query.isError && !missing) return <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Profile could not be loaded.')}</p>;

  return (
    <section className={styles.card}>
      <h2>{missing ? 'Create profile' : `Profile · version ${query.data?.profileVersion}`}</h2>
      <p className={styles.muted}>Advisor private notes stay on this page. Students and tenant admins never receive that field.</p>
      {save.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, save.error instanceof Error ? save.error.message : 'Profile could not be saved.')}</p> : null}
      {save.isSuccess ? <p className={styles.success} role="status">Profile saved.</p> : null}
      <form className={styles.form} onSubmit={onSubmit}>
        <label><span>Contact phone</span><input value={form.contactPhone} onChange={event => setForm(current => ({...current, contactPhone: event.target.value}))}/></label>
        <label><span>Academic background</span><textarea value={form.academicBackground} onChange={event => setForm(current => ({...current, academicBackground: event.target.value}))}/></label>
        <label><span>Prior test experience</span><textarea value={form.priorTestExperience} onChange={event => setForm(current => ({...current, priorTestExperience: event.target.value}))}/></label>
        <label><span>Baseline assessment</span><textarea value={form.baselineAssessment} onChange={event => setForm(current => ({...current, baselineAssessment: event.target.value}))}/></label>
        <label><span>Target goal</span><input value={form.targetGoal} onChange={event => setForm(current => ({...current, targetGoal: event.target.value}))}/></label>
        <label><span>Target metric</span><input value={form.targetMetric} onChange={event => setForm(current => ({...current, targetMetric: event.target.value}))}/></label>
        <label><span>Target value</span><input value={form.targetValue} onChange={event => setForm(current => ({...current, targetValue: event.target.value}))}/></label>
        <label><span>Target date</span><input type="date" value={form.targetDate} onChange={event => setForm(current => ({...current, targetDate: event.target.value}))}/></label>
        <label><span>Advisor interpretation</span><textarea value={form.advisorInterpretation} onChange={event => setForm(current => ({...current, advisorInterpretation: event.target.value}))}/></label>
        <label><span>Advisor private notes</span><textarea value={form.advisorPrivateNotes} onChange={event => setForm(current => ({...current, advisorPrivateNotes: event.target.value}))}/></label>
        {form.skills.map((skill, index) => (
          <fieldset key={skill.position} className={styles.nested}>
            <legend>Skill {index + 1}</legend>
            <label><span>Code</span><input value={skill.skillCode} onChange={event => setSkill(index, {skillCode: event.target.value})}/></label>
            <label><span>Display name</span><input value={skill.displayName} onChange={event => setSkill(index, {displayName: event.target.value})}/></label>
            <label><span>Scale</span><input value={skill.scale} onChange={event => setSkill(index, {scale: event.target.value})}/></label>
            <label><span>Current</span><input value={skill.currentValue} onChange={event => setSkill(index, {currentValue: event.target.value})}/></label>
            <label><span>Target</span><input value={skill.targetValue} onChange={event => setSkill(index, {targetValue: event.target.value})}/></label>
            <label><span>Gap</span><textarea value={skill.gapSummary} onChange={event => setSkill(index, {gapSummary: event.target.value})}/></label>
          </fieldset>
        ))}
        <button type="button" className={styles.secondary} onClick={() => setForm(current => ({...current, skills: [...current.skills, emptySkill(current.skills.length + 1)]}))}>Add skill</button>
        <button className={styles.primary} disabled={save.isPending}>{save.isPending ? 'Saving…' : missing ? 'Create profile' : 'Save profile'}</button>
      </form>
    </section>
  );
};

export default AdvisorStudentProfilePage;
