import {LocalizedError} from '@/i18n/errors';
import { useTranslation } from 'react-i18next';
import {formatDateValue, formatNumber} from '@/i18n/formatting';
import {parseInputDate} from '@/i18n/dateInput';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {LearningJourney} from './LearningJourney';
import {StudyPlanHistory} from './StudyPlanHistory';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import {getApiErrorCode} from '@/utils/apiError';
import React, {FormEvent, useEffect, useRef, useState} from 'react';
import {useParams, useSearchParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {AdvisorTaskRequest, CheckpointRequest, unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {EnglishDateInput} from '@/components/EnglishDateInput';
import {isMissingResource} from '@/utils/apiError';
import {ADVISING_ERROR_CODES} from '@/apis';
import {generatePath, Link} from 'react-router-dom';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import layout from './index.module.scss';
import {WorkspaceSectionHeader} from '@/components/WorkspaceSectionHeader';

const emptyTask = (position: number): AdvisorTaskRequest => ({
  title: '',
  description: '',
  dueDate: '',
  submissionRequirement: '',
  position,
});

const emptyCheckpoint = (position: number): CheckpointRequest => ({
  description: '',
  goal: '',
  dueDate: '',
  position,
  tasks: [emptyTask(1)],
});

interface PlanFormState {
  strategySummary: string;
  startDate: string;
  planEndDate: string;
  checkpoints: CheckpointRequest[];
}

const emptyForm: PlanFormState = {
  strategySummary: '',
  startDate: '',
  planEndDate: '',
  checkpoints: [emptyCheckpoint(1)],
};

const AdvisorStudentStudyPlanPage: React.FC = () => {
  const { t: translate } = useTranslation();
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const [searchParams, setSearchParams] = useSearchParams();
  const checkpointTarget = Number(searchParams.get('checkpointId'));
  const taskTarget = Number(searchParams.get('advisorTaskId'));
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const initialized = useRef(false);
  const [reviewedVersion, setReviewedVersion] = useState<number>();
  const [isEditing, setIsEditing] = useState(false);
  const [reviewedProfileVersion, setReviewedProfileVersion] = useState<number>();
  const [reloadRequired, setReloadRequired] = useState(false);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [addedCheckpoint, setAddedCheckpoint] = useState<number>();
  const [validationKey, setValidationKey] = useState<string>();
  const [, setAddedTask] = useState<{checkpoint: number; task: number}>();

  const planQuery = useQuery({meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorStudyPlan(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudyPlan(id), 'getStudyPlan'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const missing = planQuery.isError && isMissingResource(planQuery.error, ADVISING_ERROR_CODES.studyPlanNotFound);
  const profileQuery = useQuery({meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorProfile(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudentProfile(id), 'getProfile'),
    enabled: Number.isInteger(id) && missing,
    retry: false,
  });


  useEffect(() => {
    const plan = planQuery.data?.plan;
    if (!plan || initialized.current) return;
    // The draft keeps the version the user reviewed; background refetches must not advance its write token.
    initialized.current = true;
    setReviewedVersion(plan.studyPlanVersion);
    setReviewedProfileVersion(planQuery.data?.profileContext?.currentProfileVersion ?? plan.basedOnProfileVersion);
    setForm({
      strategySummary: plan.strategySummary ?? '',
      startDate: plan.startDate ?? '',
      planEndDate: plan.planEndDate ?? '',
      checkpoints: (plan.checkpoints ?? []).map((checkpoint, index) => ({
        id: checkpoint.id,
        description: checkpoint.description ?? '',
        goal: checkpoint.goal ?? '',
        dueDate: checkpoint.dueDate ?? '',
        position: checkpoint.position ?? index + 1,
        tasks: (checkpoint.tasks ?? []).map((task, taskIndex) => ({
          id: task.id,
          title: task.title ?? '',
          description: task.description ?? '',
          dueDate: task.dueDate ?? '',
          submissionRequirement: task.submissionRequirement ?? '',
          position: task.position ?? taskIndex + 1,
        })),
      })),
    });
  }, [planQuery.data]);

  const save = useMutation({meta: {advisingStudentId: id},
    mutationFn: async () => {
      const expectedProfileVersion = missing ? profileQuery.data?.profileVersion : reviewedProfileVersion;
      if (expectedProfileVersion == null) throw new LocalizedError("advising:profile.loadCurrent");
      const checkpoints = form.checkpoints.map((checkpoint, index) => ({
        ...checkpoint,
        description: checkpoint.description.trim(),
        goal: checkpoint.goal.trim(),
        dueDate: checkpoint.dueDate,
        position: index + 1,
        tasks: (checkpoint.tasks ?? [])
          .filter(task => task.title.trim())
          .map((task, taskIndex) => ({
            ...task,
            title: task.title.trim(),
            position: taskIndex + 1,
            ...(task.description?.trim() ? {description: task.description.trim()} : {}),
            ...(task.dueDate ? {dueDate: task.dueDate} : {}),
            ...(task.submissionRequirement?.trim() ? {submissionRequirement: task.submissionRequirement.trim()} : {}),
          })),
      }));
      const payload = {
        expectedProfileVersion,
        strategySummary: form.strategySummary.trim(),
        startDate: form.startDate,
        planEndDate: form.planEndDate,
        checkpoints,
      };
      if (missing) {
        const key = idempotency.keyFor(`plan-create-${id}`, idempotencyFingerprint(payload));
        return unwrapData(await advisorApiService.createStudyPlan(id, payload, key), 'createStudyPlan');
      }
      if (reviewedVersion == null) throw new LocalizedError("advising:planEditor.loadPlan");
      const update = {
        ...payload,
        expectedStudyPlanVersion: reviewedVersion,
      };
      const key = idempotency.keyFor(`plan-put-${id}`, idempotencyFingerprint(update));
      return unwrapData(await advisorApiService.updateStudyPlan(id, update, key), 'updateStudyPlan');
    },
    onError: error => {
      const code = getApiErrorCode(error);
      if (code?.endsWith('VERSION_CONFLICT') || code?.endsWith('ALREADY_EXISTS')) setReloadRequired(true);
    },
    onSuccess: async () => {
      initialized.current = false;
      setReloadRequired(false);
      await queryClient.invalidateQueries({queryKey: advisingQueryKeys.advisorStudyPlan(id)});
      await queryClient.invalidateQueries({queryKey: ['advisor', 'study-plan-revisions', id]});
      setIsEditing(false);
    },
  });

  const setCheckpoint = (index: number, patch: Partial<CheckpointRequest>) => {
    setForm(current => ({
      ...current,
      checkpoints: current.checkpoints.map((checkpoint, checkpointIndex) =>
        checkpointIndex === index ? {...checkpoint, ...patch} : checkpoint),
    }));
  };

  const setTask = (checkpointIndex: number, taskIndex: number, patch: Partial<AdvisorTaskRequest>) => {
    setForm(current => ({
      ...current,
      checkpoints: current.checkpoints.map((checkpoint, index) => {
        if (index !== checkpointIndex) return checkpoint;
        return {
          ...checkpoint,
          tasks: (checkpoint.tasks ?? []).map((task, inner) => inner === taskIndex ? {...task, ...patch} : task),
        };
      }),
    }));
  };

  const removeTask = (checkpointIndex: number, taskIndex: number) => {
    setForm(current => ({
      ...current,
      checkpoints: current.checkpoints.map((checkpoint, index) => index !== checkpointIndex ? checkpoint : {
        ...checkpoint,
        tasks: (checkpoint.tasks ?? []).filter((_, inner) => inner !== taskIndex).map((task, inner) => ({...task, position: inner + 1})),
      }),
    }));
  };

  const removeCheckpoint = (checkpointIndex: number) => {
    setForm(current => ({
      ...current,
      checkpoints: current.checkpoints.filter((_, index) => index !== checkpointIndex).map((checkpoint, index) => ({...checkpoint, position: index + 1})),
    }));
  };

  const submitPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const invalidDate = Array.from(values.entries()).some(([name, value]) => name.endsWith('Date') && String(value).trim() && !parseInputDate(String(value)));
    const key = !form.strategySummary.trim() || !form.startDate || !form.planEndDate ? 'advising:planEditor.requiredStrategy'
      : form.checkpoints.some(checkpoint => !checkpoint.description.trim() || !checkpoint.goal.trim() || !checkpoint.dueDate) ? 'advising:planEditor.requiredCheckpoint'
      : form.checkpoints.some(checkpoint => checkpoint.tasks?.length && !checkpoint.tasks[0].title.trim()) ? 'advising:planEditor.requiredTask'
      : invalidDate ? 'advising:planEditor.invalidDate'
      : undefined;
    setValidationKey(key);
    if (!key && !save.isPending && !reloadRequired) save.mutate();
  };

  if (planQuery.isPending) return <p className={styles.status}>{translate("learning:parent.loadingPlan")}</p>;
  if (planQuery.isError && !missing) {
    return <p className={styles.error} role="alert">{advisingErrorMessage(planQuery.error, translate('advising:records.planLoadError'))} <button type="button" onClick={() => void planQuery.refetch()}>{translate('advising:records.planRetry')}</button></p>;
  }
  // Creating a plan requires an existing profile version. Do not offer a form
  // whose only possible outcome is a missing-version error after drafting.
  if (missing) {
    if (profileQuery.isPending) return <p className={styles.status} role="status">{translate('advising:records.planProfileLoading')}</p>;
    if (profileQuery.isError && isMissingResource(profileQuery.error, ADVISING_ERROR_CODES.profileNotFound)) {
      return <div className={styles.status}><p>{translate('advising:records.planProfileRequired')}</p><Link to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdProfile, {studentUserId: String(id)})}>{translate('advising:records.planProfileOpen')}</Link></div>;
    }
    if (profileQuery.isError || !Number.isInteger(profileQuery.data?.profileVersion)) {
      return <p className={styles.error} role="alert">{advisingErrorMessage(profileQuery.error, translate('advising:records.profileLoadError'))} <button type="button" onClick={() => void profileQuery.refetch()}>{translate('advising:records.profileRetry')}</button></p>;
    }
  }

  return (
    <div className={styles.editorPage}>
      {missing || isEditing ? <WorkspaceSectionHeader
        title={missing ? translate("advising:planEditor.create") : translate("navigation:parent.studyPlan")}
        description={translate("advising:planEditor.description")}
        meta={!missing ? <span className={styles.versionBadge}>{translate('operations:availability.version', {number: reviewedVersion == null ? '—' : formatNumber(reviewedVersion)})}</span> : undefined}
      /> : null}
      {reloadRequired ? <div className={styles.conflictNotice} role="alert"><p>{translate("advising:profile.conflict")}</p><button type="button" className={styles.secondary} onClick={() => void planQuery.refetch().then(result => {if (result.data && !result.isError) {setReviewedVersion(result.data.plan.studyPlanVersion); setReviewedProfileVersion(result.data.profileContext.currentProfileVersion ?? result.data.plan.basedOnProfileVersion); setReloadRequired(false); save.reset();}})}>{translate("advising:profile.loadLatest")}</button></div> : null}
      {save.isError && !reloadRequired ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, translate('advising:planEditor.saveFailed'))}</p> : null}
      {validationKey ? <p className={styles.error} role="alert">{translate(validationKey)}</p> : null}
      {save.isSuccess ? <p className={styles.success} role="status">{translate("advising:planEditor.saved")}</p> : null}
      {!missing && !isEditing && planQuery.data?.plan ? <LearningJourney plan={planQuery.data.plan} studentUserId={id} checkpointTarget={checkpointTarget} taskTarget={taskTarget} onEdit={(checkpointId, taskId) => {if (checkpointId || taskId) {const next = new URLSearchParams(searchParams); if (checkpointId) next.set('checkpointId', String(checkpointId)); if (taskId) next.set('advisorTaskId', String(taskId)); setSearchParams(next);} setIsEditing(true);}}/> : null}
      {missing || isEditing ? <form noValidate className={`${styles.form} ${layout.planForm}`} onSubmit={submitPlan}>
        <WorkspaceSection appearance="record" title={translate("advising:planEditor.direction")} headingLevel={3} summary={form.strategySummary || translate("advising:planEditor.setStrategy")}>
          <p>{translate("advising:planEditor.strategyHelp")}</p>
          <div className={styles.formGrid}>
            <label className={styles.spanTwo}><span>{translate("advising:planEditor.strategy")}</span><textarea required value={form.strategySummary} onChange={event => setForm(current => ({...current, strategySummary: event.target.value}))}/></label>
            <label><span>{translate("common:fields.startDate")}</span><EnglishDateInput name="startDate" aria-label={translate('common:fields.startDate')} required value={form.startDate} onChangeValue={startDate => setForm(current => ({...current, startDate}))}/></label>
            <label><span>{translate("common:fields.endDate")}</span><EnglishDateInput name="planEndDate" aria-label={translate('common:fields.endDate')} required value={form.planEndDate} onChangeValue={planEndDate => setForm(current => ({...current, planEndDate}))}/></label>
          </div>
        </WorkspaceSection>
        <WorkspaceSection appearance="record" title={translate("advising:planEditor.checkpointsTasks")} headingLevel={3} count={form.checkpoints.length} summary={translate("advising:planEditor.milestones")}>
          <p>{translate("advising:planEditor.expandHelp")}</p>
          {form.checkpoints.map((checkpoint, index) => (
            <CollapsibleSection key={`${checkpoint.position}-${index}`} title={checkpoint.description.trim() || translate('advising:planEditor.checkpointNumber', {number: formatNumber(index + 1)})} headingLevel={4} summary={[checkpoint.dueDate ? translate('operations:teacher.due', {date: formatDateValue(checkpoint.dueDate)}) : translate('advising:planEditor.noDueDate'), translate('advising:planEditor.tasksCount', {count: checkpoint.tasks?.length ?? 0, number: formatNumber(checkpoint.tasks?.length ?? 0)})].join(' · ')} revealKey={addedCheckpoint === index ? index + 1 : checkpoint.id === checkpointTarget || checkpoint.tasks?.some(task => task.id === taskTarget) ? checkpointTarget || taskTarget : undefined}>
                <div className={styles.formGrid}>
                  <label><span>{translate("common:fields.description")}</span><textarea required value={checkpoint.description} onChange={event => setCheckpoint(index, {description: event.target.value})}/></label>
                  <label><span>{translate("records:fields.goal")}</span><textarea required value={checkpoint.goal} onChange={event => setCheckpoint(index, {goal: event.target.value})}/></label>
                  <label><span>{translate("advising:planEditor.dueDate")}</span><EnglishDateInput name={`checkpoint-${index}-dueDate`} aria-label={translate('advising:planEditor.dueDate')} required value={checkpoint.dueDate} onChangeValue={dueDate => setCheckpoint(index, {dueDate})}/></label>
                </div>
                {(checkpoint.tasks ?? []).map((task, taskIndex) => (
                  <WorkspaceSection key={`${task.position}-${taskIndex}`} title={task.title || translate('advising:planEditor.taskNumber', {number: formatNumber(taskIndex + 1)})} headingLevel={4} summary={task.dueDate ? translate('operations:teacher.due', {date: formatDateValue(task.dueDate)}) : translate("advising:planEditor.taskDetails")}>
                    <div className={styles.recordGrid}>
                      <label className={styles.spanTwo}><span>{translate("common:fields.title")}</span><input required={taskIndex === 0} value={task.title} onChange={event => setTask(index, taskIndex, {title: event.target.value})}/></label>
                      <label className={styles.spanTwo}><span>{translate("common:fields.description")}</span><textarea value={task.description} onChange={event => setTask(index, taskIndex, {description: event.target.value})}/></label>
                      <label><span>{translate("advising:planEditor.dueDate")}</span><EnglishDateInput name={`checkpoint-${index}-task-${taskIndex}-dueDate`} aria-label={translate('advising:planEditor.dueDate')} value={task.dueDate ?? ''} onChangeValue={dueDate => setTask(index, taskIndex, {dueDate})}/></label>
                    </div>
                    {(checkpoint.tasks ?? []).length > 1 ? <div className={styles.recordActions}><button type="button" className={styles.textDanger} onClick={() => removeTask(index, taskIndex)}>{translate("advising:planEditor.removeTask")}</button></div> : null}
                  </WorkspaceSection>
                ))}
                <div className={styles.recordActions}>
                  {form.checkpoints.length > 1 ? <button type="button" className={styles.textDanger} onClick={() => removeCheckpoint(index)}>{translate("advising:planEditor.removeCheckpoint")}</button> : null}
                  <button type="button" className={styles.secondary} onClick={() => { setAddedTask({checkpoint: index, task: checkpoint.tasks?.length ?? 0}); setCheckpoint(index, {tasks: [...(checkpoint.tasks ?? []), emptyTask((checkpoint.tasks?.length ?? 0) + 1)]}); }}>{translate("advising:planEditor.addTask")}</button>
                </div>
            </CollapsibleSection>
          ))}
          <button type="button" className={styles.secondary} onClick={() => { setAddedCheckpoint(form.checkpoints.length); setForm(current => ({...current, checkpoints: [...current.checkpoints, emptyCheckpoint(current.checkpoints.length + 1)]})); }}>{translate("advising:planEditor.addCheckpoint")}</button>
        </WorkspaceSection>
        <div className={styles.formActions}><button className={styles.primary} disabled={save.isPending || reloadRequired}>{save.isPending ? translate("common:actions.saving") : missing ? translate("advising:planEditor.create") : translate("advising:planEditor.save")}</button></div>
      </form> : null}
      {!missing ? <StudyPlanHistory key={id} studentUserId={id}/> : null}

    </div>
  );
};

export default AdvisorStudentStudyPlanPage;
