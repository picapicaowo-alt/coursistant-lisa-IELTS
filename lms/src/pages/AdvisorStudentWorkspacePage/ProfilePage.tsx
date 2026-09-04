import {WorkspaceSection} from '@/components/WorkspaceSection';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import {getApiErrorCode} from '@/utils/apiError';
import React, {FormEvent, useEffect, useRef, useState} from 'react';
import {useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {CreateStudentProfileRequest, ProfileSkillRequest, unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {EnglishDateInput} from '@/components/EnglishDateInput';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import layout from './index.module.scss';
import {WorkspaceSectionHeader} from '@/components/WorkspaceSectionHeader';

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
  const initialized = useRef(false);
  const [reviewedVersion, setReviewedVersion] = useState<number>();
  const [reloadRequired, setReloadRequired] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [addedSkill, setAddedSkill] = useState<number>();

  const query = useQuery({meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorProfile(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudentProfile(id), 'getProfile'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const missing = query.isError && isNotFound(query.error);

  useEffect(() => {
    if (!query.data || initialized.current) return;
    // The draft keeps the version the user reviewed; background refetches must not advance its write token.
    initialized.current = true;
    setReviewedVersion(query.data.profileVersion);
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

  const save = useMutation({meta: {advisingStudentId: id},
    mutationFn: async () => {
      const payload = toPayload(form);
      if (missing) {
        const key = idempotency.keyFor(`profile-create-${id}`, idempotencyFingerprint(payload));
        return unwrapData(await advisorApiService.createStudentProfile(id, payload, key), 'createProfile');
      }
      if (reviewedVersion == null) throw new Error('Load the current profile before saving.');
      if (!payload.skills?.length) throw new Error('Add at least one skill before saving.');
      const update = {...payload, expectedProfileVersion: reviewedVersion!, skills: payload.skills};
      const key = idempotency.keyFor(`profile-put-${id}`, idempotencyFingerprint(update));
      return unwrapData(await advisorApiService.updateStudentProfile(id, update, key), 'updateProfile');
    },
    onError: error => {
      const code = getApiErrorCode(error);
      if (code?.endsWith('VERSION_CONFLICT') || code?.endsWith('ALREADY_EXISTS')) setReloadRequired(true);
    },
    onSuccess: async () => {
      initialized.current = false;
      setReloadRequired(false);
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

  const removeSkill = (index: number) => {
    setForm(current => ({
      ...current,
      skills: current.skills.filter((_, skillIndex) => skillIndex !== index).map((skill, skillIndex) => ({...skill, position: skillIndex + 1})),
    }));
  };

  if (query.isPending) return <p className={styles.status}>Loading profile…</p>;
  if (query.isError && !missing) return <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Profile could not be loaded.')}</p>;

  return (
    <div className={styles.editorPage}>
      <WorkspaceSectionHeader
        title={missing ? 'Create student profile' : 'Student profile'}
        description="Capture the student's starting point, target, and the specific skills you will use to measure progress."
        meta={!missing ? <span className={styles.versionBadge}>Current version {query.data?.profileVersion}</span> : undefined}
      />
      {!missing ? <p className={styles.muted}>Showing the current profile. Earlier profile versions are not available yet.</p> : null}
      {reloadRequired ? <div className={styles.conflictNotice} role="alert"><p>Your edits are preserved. Reload the latest record and review before saving again.</p><button type="button" className={styles.secondary} onClick={() => void query.refetch().then(result => {if (result.data && !result.isError) {setReviewedVersion(result.data.profileVersion); setReloadRequired(false);}})}>Load latest record</button></div> : null}
      {save.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, save.error instanceof Error ? save.error.message : 'Profile could not be saved.')}</p> : null}
      {save.isSuccess ? <p className={styles.success} role="status">Profile saved.</p> : null}
      <form className={`${styles.form} ${layout.profileForm}`} onSubmit={onSubmit}>
        <WorkspaceSection title="Student context" headingLevel={3} appearance="record" className={layout.profileCard}>
          <div className={`${layout.profileFields} ${layout.contextFields}`}>
            <label><span>Contact phone</span><input value={form.contactPhone} onChange={event => setForm(current => ({...current, contactPhone: event.target.value}))}/></label>
            <label className={layout.fullField}><span>Academic background</span><textarea value={form.academicBackground} onChange={event => setForm(current => ({...current, academicBackground: event.target.value}))}/></label>
            <label><span>Prior test experience</span><textarea value={form.priorTestExperience} onChange={event => setForm(current => ({...current, priorTestExperience: event.target.value}))}/></label>
            <label><span>Baseline assessment</span><textarea value={form.baselineAssessment} onChange={event => setForm(current => ({...current, baselineAssessment: event.target.value}))}/></label>
          </div>
        </WorkspaceSection>
        <WorkspaceSection appearance="record" className={layout.profileCard} title="Primary target" headingLevel={3} summary={[form.targetMetric, form.targetValue, form.targetDate].filter(Boolean).join(' · ') || 'Set a goal and target date'}>
          <div className={layout.profileFields}>
            <label className={layout.fullField}><span>Target goal</span><input value={form.targetGoal} onChange={event => setForm(current => ({...current, targetGoal: event.target.value}))}/></label>
            <label><span>Target metric</span><input value={form.targetMetric} onChange={event => setForm(current => ({...current, targetMetric: event.target.value}))}/></label>
            <label><span>Target value</span><input value={form.targetValue} onChange={event => setForm(current => ({...current, targetValue: event.target.value}))}/></label>
            <label className={layout.fullField}><span>Target date</span><EnglishDateInput value={form.targetDate} onChangeValue={targetDate => setForm(current => ({...current, targetDate}))}/></label>
            <label className={layout.fullField}><span>Advisor interpretation</span><textarea value={form.advisorInterpretation} onChange={event => setForm(current => ({...current, advisorInterpretation: event.target.value}))}/></label>
          </div>
        </WorkspaceSection>
        <WorkspaceSection appearance="record" title="Measured skills" headingLevel={3} summary={`${form.skills.length} measured ${form.skills.length === 1 ? 'skill' : 'skills'}`}>
          <p>Use one skill per measurable area. The code is a stable record identifier; the display name is the label people will understand.</p>
          {form.skills.map((skill, index) => (
            <CollapsibleSection key={`${skill.position}-${index}`} title={skill.displayName || `Skill ${index + 1}`} headingLevel={4} revealKey={addedSkill === index ? index + 1 : undefined} summary={[skill.scale, skill.currentValue ? `Current ${skill.currentValue}` : '', skill.targetValue ? `Target ${skill.targetValue}` : ''].filter(Boolean).join(' · ') || 'Add a name and measurement'}>
              <div className={styles.recordGrid}>
                <label><span>Skill code</span><input required={index === 0} value={skill.skillCode} onChange={event => setSkill(index, {skillCode: event.target.value})}/><small className={styles.fieldHelp}>Use your institution&apos;s stable short identifier for this skill.</small></label>
                <label><span>Display name</span><input required={index === 0} value={skill.displayName} onChange={event => setSkill(index, {displayName: event.target.value})}/><small className={styles.fieldHelp}>The human-readable skill name shown in the advising record.</small></label>
                <label><span>Measurement scale</span><input value={skill.scale} onChange={event => setSkill(index, {scale: event.target.value})}/><small className={styles.fieldHelp}>The scoring system used for both current and target values.</small></label>
                <label><span>Current value</span><input value={skill.currentValue} onChange={event => setSkill(index, {currentValue: event.target.value})}/></label>
                <label><span>Target value</span><input value={skill.targetValue} onChange={event => setSkill(index, {targetValue: event.target.value})}/></label>
                <label className={layout.fullField}><span>Gap summary</span><textarea value={skill.gapSummary} onChange={event => setSkill(index, {gapSummary: event.target.value})}/><small className={styles.fieldHelp}>Explain what needs to improve between the current and target values.</small></label>
              </div>
              {form.skills.length > 1 ? <div className={styles.recordActions}><button type="button" className={styles.textDanger} onClick={() => removeSkill(index)}>Remove skill</button></div> : null}
            </CollapsibleSection>
          ))}
          <button type="button" className={styles.secondary} onClick={() => { setAddedSkill(form.skills.length); setForm(current => ({...current, skills: [...current.skills, emptySkill(current.skills.length + 1)]})); }}>Add another skill</button>
        </WorkspaceSection>
        <WorkspaceSection appearance="record" title="Private advisor notes" headingLevel={3} meta={<span className={styles.readOnlyBadge}>Advisors only</span>}>
          <p>This field stays in the Advisor view. Students and Tenant Admins do not receive it.</p>
          <label><span>Private notes</span><textarea className={layout.privateNotes} value={form.advisorPrivateNotes} onChange={event => setForm(current => ({...current, advisorPrivateNotes: event.target.value}))}/></label>
        </WorkspaceSection>
        <div className={layout.profileActions}><button className={styles.primary} disabled={save.isPending || reloadRequired}>{save.isPending ? 'Saving…' : missing ? 'Create profile' : 'Save profile'}</button></div>
      </form>
    </div>
  );
};

export default AdvisorStudentProfilePage;
