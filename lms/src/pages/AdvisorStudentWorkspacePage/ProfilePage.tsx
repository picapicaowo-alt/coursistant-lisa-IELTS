import {LocalizedError} from '@/i18n/errors';
import { useTranslation } from 'react-i18next';
import {focusFirstInvalidField} from '@/utils/formFocus';
import {formatDateValue, formatNumber, formatNumericText} from '@/i18n/formatting';
import {parseInputDate} from '@/i18n/dateInput';
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
import {isMissingResource} from '@/utils/apiError';
import {ADVISING_ERROR_CODES} from '@/apis';
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
  const { t: translate } = useTranslation();
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const initialized = useRef(false);
  const [reviewedVersion, setReviewedVersion] = useState<number>();
  const [reloadRequired, setReloadRequired] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [addedSkill, setAddedSkill] = useState<number>();
  const [validationKey, setValidationKey] = useState<string>();

  const query = useQuery({meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorProfile(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudentProfile(id), 'getProfile'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const missing = query.isError && isMissingResource(query.error, ADVISING_ERROR_CODES.profileNotFound);

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
      if (reviewedVersion == null) throw new LocalizedError("advising:profile.loadCurrent");
      if (!payload.skills?.length) throw new LocalizedError("advising:profile.requiredSkills");
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

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawDate = String(new FormData(event.currentTarget).get('targetDate') ?? '').trim();
    const key = rawDate && !parseInputDate(rawDate) ? 'advising:profile.invalidDate'
      : !form.skills[0]?.skillCode.trim() || !form.skills[0]?.displayName.trim() ? 'advising:profile.requiredSkills'
      : form.skills.some(skill => Boolean(skill.skillCode.trim()) !== Boolean(skill.displayName.trim())) ? 'advising:profile.invalidSkill'
      : undefined;
    setValidationKey(key);
    if (key) focusFirstInvalidField(event.currentTarget);
    if (!key && !save.isPending && !reloadRequired) save.mutate();
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

  if (query.isPending) return <p className={styles.status}>{translate("advising:profile.loading")}</p>;
  if (query.isError && !missing) return <p className={styles.error} role="alert">{advisingErrorMessage(query.error, translate('advising:records.profileLoadError'))} <button type="button" onClick={() => void query.refetch()}>{translate('advising:records.profileRetry')}</button></p>;

  return (
    <div className={styles.editorPage}>
      <WorkspaceSectionHeader
        title={missing ? translate("advising:profile.createTitle") : translate("advising:profile.title")}
        description={translate("advising:profile.description")}
        meta={!missing ? <span className={styles.versionBadge}>{translate('advising:profile.version', {number: reviewedVersion == null ? '—' : formatNumber(reviewedVersion)})}</span> : undefined}
      />
      {reloadRequired ? <div className={styles.conflictNotice} role="alert"><p>{translate("advising:profile.conflict")}</p><button type="button" className={styles.secondary} onClick={() => void query.refetch().then(result => {if (result.data && !result.isError) {setReviewedVersion(result.data.profileVersion); setReloadRequired(false); save.reset();}})}>{translate("advising:profile.loadLatest")}</button></div> : null}
      {save.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, translate("advising:profile.saveFailed"))}</p> : null}
      {validationKey ? <p className={styles.error} role="alert">{translate(validationKey)}</p> : null}
      {save.isSuccess ? <p className={styles.success} role="status">{translate("advising:profile.saved")}</p> : null}
      <form noValidate className={`${styles.form} ${layout.profileForm}`} onSubmit={onSubmit}>
        <WorkspaceSection title={translate("advising:profile.context")} headingLevel={3} appearance="record" className={layout.profileCard}>
          <div className={`${layout.profileFields} ${layout.contextFields}`}>
            <label><span>{translate("advising:intake.phone")}</span><input value={form.contactPhone} onChange={event => setForm(current => ({...current, contactPhone: event.target.value}))}/></label>
            <label className={layout.fullField}><span>{translate("advising:profile.background")}</span><textarea value={form.academicBackground} onChange={event => setForm(current => ({...current, academicBackground: event.target.value}))}/></label>
            <label><span>{translate("advising:profile.experience")}</span><textarea value={form.priorTestExperience} onChange={event => setForm(current => ({...current, priorTestExperience: event.target.value}))}/></label>
            <label><span>{translate("learning:plan.baseline")}</span><textarea value={form.baselineAssessment} onChange={event => setForm(current => ({...current, baselineAssessment: event.target.value}))}/></label>
          </div>
        </WorkspaceSection>
        <WorkspaceSection appearance="record" className={layout.profileCard} title={translate("advising:profile.primaryTarget")} headingLevel={3} summary={[form.targetMetric, formatNumericText(form.targetValue), formatDateValue(form.targetDate)].filter(Boolean).join(' · ') || translate("advising:profile.setTarget")}>
          <div className={layout.profileFields}>
            <label className={layout.fullField}><span>{translate("advising:profile.targetGoal")}</span><input value={form.targetGoal} onChange={event => setForm(current => ({...current, targetGoal: event.target.value}))}/></label>
            <label><span>{translate("advising:profile.targetMetric")}</span><input value={form.targetMetric} onChange={event => setForm(current => ({...current, targetMetric: event.target.value}))}/></label>
            <label><span>{translate("advising:profile.targetValue")}</span><input value={form.targetValue} onChange={event => setForm(current => ({...current, targetValue: event.target.value}))}/></label>
            <label className={layout.fullField}><span>{translate("advising:studentWorkspace.targetDate")}</span><EnglishDateInput name="targetDate" aria-label={translate('advising:studentWorkspace.targetDate')} value={form.targetDate} onChangeValue={targetDate => setForm(current => ({...current, targetDate}))}/></label>
            <label className={layout.fullField}><span>{translate("advising:profile.interpretation")}</span><textarea value={form.advisorInterpretation} onChange={event => setForm(current => ({...current, advisorInterpretation: event.target.value}))}/></label>
          </div>
        </WorkspaceSection>
        <WorkspaceSection appearance="record" title={translate("advising:profile.measuredSkills")} headingLevel={3} summary={translate('advising:profile.skillCount', {count: form.skills.length, number: formatNumber(form.skills.length)})}>
          <p>{translate("advising:profile.skillHelp")}</p>
          {form.skills.map((skill, index) => (
            <CollapsibleSection key={`${skill.position}-${index}`} title={skill.displayName || translate('advising:profile.skillNumber', {number: formatNumber(index + 1)})} headingLevel={4} revealKey={addedSkill === index ? index + 1 : undefined} summary={[skill.scale, skill.currentValue ? translate('advising:profile.current', {value: formatNumericText(skill.currentValue)}) : '', skill.targetValue ? translate('advising:studentWorkspace.targetValue', {value: formatNumericText(skill.targetValue)}) : ''].filter(Boolean).join(' · ') || translate("advising:profile.addMeasurement")}>
              <div className={styles.recordGrid}>
                <label><span>{translate("advising:profile.skillCode")}</span><input required={index === 0 || Boolean(skill.displayName.trim())} value={skill.skillCode} onChange={event => setSkill(index, {skillCode: event.target.value})}/><small className={styles.fieldHelp}>{translate("advising:profile.skillCodeHelp")}</small></label>
                <label><span>{translate("advising:profile.displayName")}</span><input required={index === 0 || Boolean(skill.skillCode.trim())} value={skill.displayName} onChange={event => setSkill(index, {displayName: event.target.value})}/><small className={styles.fieldHelp}>{translate("advising:profile.displayNameHelp")}</small></label>
                <label><span>{translate("advising:profile.scale")}</span><input value={skill.scale} onChange={event => setSkill(index, {scale: event.target.value})}/><small className={styles.fieldHelp}>{translate("advising:profile.scaleHelp")}</small></label>
                <label><span>{translate("advising:profile.currentValue")}</span><input value={skill.currentValue} onChange={event => setSkill(index, {currentValue: event.target.value})}/></label>
                <label><span>{translate("advising:profile.targetValue")}</span><input value={skill.targetValue} onChange={event => setSkill(index, {targetValue: event.target.value})}/></label>
                <label className={layout.fullField}><span>{translate("advising:profile.gap")}</span><textarea value={skill.gapSummary} onChange={event => setSkill(index, {gapSummary: event.target.value})}/><small className={styles.fieldHelp}>{translate("advising:profile.gapHelp")}</small></label>
              </div>
              {form.skills.length > 1 ? <div className={styles.recordActions}><button type="button" className={styles.textDanger} onClick={() => removeSkill(index)}>{translate("advising:profile.removeSkill")}</button></div> : null}
            </CollapsibleSection>
          ))}
          <button type="button" className={styles.secondary} onClick={() => { setAddedSkill(form.skills.length); setForm(current => ({...current, skills: [...current.skills, emptySkill(current.skills.length + 1)]})); }}>{translate("advising:profile.addSkill")}</button>
        </WorkspaceSection>
        <WorkspaceSection appearance="record" title={translate("advising:profile.privateTitle")} headingLevel={3} meta={<span className={styles.readOnlyBadge}>{translate("advising:profile.advisorsOnly")}</span>}>
          <p>{translate("advising:profile.privateHelp")}</p>
          <label><span>{translate("advising:profile.privateNotes")}</span><textarea className={layout.privateNotes} value={form.advisorPrivateNotes} onChange={event => setForm(current => ({...current, advisorPrivateNotes: event.target.value}))}/></label>
        </WorkspaceSection>
        <div className={layout.profileActions}><button className={styles.primary} disabled={save.isPending || reloadRequired}>{save.isPending ? translate("common:actions.saving") : missing ? translate("advising:profile.create") : translate("advising:profile.save")}</button></div>
      </form>
    </div>
  );
};

export default AdvisorStudentProfilePage;
