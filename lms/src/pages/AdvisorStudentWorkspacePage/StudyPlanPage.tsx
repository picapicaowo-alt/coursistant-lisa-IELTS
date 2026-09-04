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
import {isNotFound} from '@/utils/apiError';
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
  const [, setAddedTask] = useState<{checkpoint: number; task: number}>();

  const planQuery = useQuery({meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorStudyPlan(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudyPlan(id), 'getStudyPlan'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const missing = planQuery.isError && isNotFound(planQuery.error);
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
      if (expectedProfileVersion == null) throw new Error('Load the current profile before saving.');
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
      if (reviewedVersion == null) throw new Error('Load the current study plan before saving.');
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

  if (planQuery.isPending) return <p className={styles.status}>Loading study plan…</p>;
  if (planQuery.isError && !missing) {
    return <p className={styles.error} role="alert">{advisingErrorMessage(planQuery.error, 'Study plan could not be loaded.')}</p>;
  }

  return (
    <div className={styles.editorPage}>
      {missing || isEditing ? <WorkspaceSectionHeader
        title={missing ? 'Create study plan' : 'Study plan'}
        description="Turn the student's target into a dated strategy, then break it into checkpoints and concrete tasks."
        meta={!missing ? <span className={styles.versionBadge}>Version {planQuery.data?.plan?.studyPlanVersion}</span> : undefined}
      /> : null}
      {reloadRequired ? <div className={styles.conflictNotice} role="alert"><p>Your edits are preserved. Reload the latest record and review before saving again.</p><button type="button" className={styles.secondary} onClick={() => void planQuery.refetch().then(result => {if (result.data && !result.isError) {setReviewedVersion(result.data.plan.studyPlanVersion); setReviewedProfileVersion(result.data.profileContext.currentProfileVersion ?? result.data.plan.basedOnProfileVersion); setReloadRequired(false); save.reset();}})}>Load latest record</button></div> : null}
      {save.isError && !reloadRequired ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, 'Study plan could not be saved.')}</p> : null}
      {save.isSuccess ? <p className={styles.success} role="status">Study plan saved.</p> : null}
      {!missing && !isEditing && planQuery.data?.plan ? <LearningJourney plan={planQuery.data.plan} studentUserId={id} checkpointTarget={checkpointTarget} taskTarget={taskTarget} onEdit={(checkpointId, taskId) => {if (checkpointId || taskId) {const next = new URLSearchParams(searchParams); if (checkpointId) next.set('checkpointId', String(checkpointId)); if (taskId) next.set('advisorTaskId', String(taskId)); setSearchParams(next);} setIsEditing(true);}}/> : null}
      {missing || isEditing ? <form className={`${styles.form} ${layout.planForm}`} onSubmit={(event: FormEvent) => { event.preventDefault(); save.mutate(); }}>
        <WorkspaceSection appearance="record" title="Plan direction" headingLevel={3} summary={form.strategySummary || 'Set the strategy and plan dates'}>
          <p>Keep the strategy concise enough to scan, while making the start and end dates explicit.</p>
          <div className={styles.formGrid}>
            <label className={styles.spanTwo}><span>Strategy</span><textarea required value={form.strategySummary} onChange={event => setForm(current => ({...current, strategySummary: event.target.value}))}/></label>
            <label><span>Start date</span><EnglishDateInput required value={form.startDate} onChangeValue={startDate => setForm(current => ({...current, startDate}))}/></label>
            <label><span>End date</span><EnglishDateInput required value={form.planEndDate} onChangeValue={planEndDate => setForm(current => ({...current, planEndDate}))}/></label>
          </div>
        </WorkspaceSection>
        <WorkspaceSection appearance="record" title="Checkpoints and tasks" headingLevel={3} count={form.checkpoints.length} summary="Milestones, due dates and student actions">
          <p>Expand the milestones and tasks you want to work on. Each can stay open independently.</p>
          {form.checkpoints.map((checkpoint, index) => (
            <CollapsibleSection key={`${checkpoint.position}-${index}`} title={checkpoint.description.trim() || `Checkpoint ${index + 1}`} headingLevel={4} summary={`${checkpoint.dueDate ? `Due ${checkpoint.dueDate}` : 'Due date not set'} · ${(checkpoint.tasks ?? []).length} tasks`} revealKey={addedCheckpoint === index ? index + 1 : checkpoint.id === checkpointTarget || checkpoint.tasks?.some(task => task.id === taskTarget) ? checkpointTarget || taskTarget : undefined}>
                <div className={styles.formGrid}>
                  <label><span>Description</span><textarea required value={checkpoint.description} onChange={event => setCheckpoint(index, {description: event.target.value})}/></label>
                  <label><span>Goal</span><textarea required value={checkpoint.goal} onChange={event => setCheckpoint(index, {goal: event.target.value})}/></label>
                  <label><span>Due date</span><EnglishDateInput required value={checkpoint.dueDate} onChangeValue={dueDate => setCheckpoint(index, {dueDate})}/></label>
                </div>
                {(checkpoint.tasks ?? []).map((task, taskIndex) => (
                  <WorkspaceSection key={`${task.position}-${taskIndex}`} title={task.title || `Task ${taskIndex + 1}`} headingLevel={4} summary={task.dueDate ? `Due ${task.dueDate}` : 'Add task details'}>
                    <div className={styles.recordGrid}>
                      <label className={styles.spanTwo}><span>Title</span><input required={taskIndex === 0} value={task.title} onChange={event => setTask(index, taskIndex, {title: event.target.value})}/></label>
                      <label className={styles.spanTwo}><span>Description</span><textarea value={task.description} onChange={event => setTask(index, taskIndex, {description: event.target.value})}/></label>
                      <label><span>Due date</span><EnglishDateInput value={task.dueDate ?? ''} onChangeValue={dueDate => setTask(index, taskIndex, {dueDate})}/></label>
                    </div>
                    {(checkpoint.tasks ?? []).length > 1 ? <div className={styles.recordActions}><button type="button" className={styles.textDanger} onClick={() => removeTask(index, taskIndex)}>Remove task</button></div> : null}
                  </WorkspaceSection>
                ))}
                <div className={styles.recordActions}>
                  {form.checkpoints.length > 1 ? <button type="button" className={styles.textDanger} onClick={() => removeCheckpoint(index)}>Remove checkpoint</button> : null}
                  <button type="button" className={styles.secondary} onClick={() => { setAddedTask({checkpoint: index, task: checkpoint.tasks?.length ?? 0}); setCheckpoint(index, {tasks: [...(checkpoint.tasks ?? []), emptyTask((checkpoint.tasks?.length ?? 0) + 1)]}); }}>Add task</button>
                </div>
            </CollapsibleSection>
          ))}
          <button type="button" className={styles.secondary} onClick={() => { setAddedCheckpoint(form.checkpoints.length); setForm(current => ({...current, checkpoints: [...current.checkpoints, emptyCheckpoint(current.checkpoints.length + 1)]})); }}>Add checkpoint</button>
        </WorkspaceSection>
        <div className={styles.formActions}><button className={styles.primary} disabled={save.isPending || reloadRequired}>{save.isPending ? 'Saving…' : missing ? 'Create study plan' : 'Save study plan'}</button></div>
      </form> : null}
      {!missing ? <StudyPlanHistory key={id} studentUserId={id}/> : null}

    </div>
  );
};

export default AdvisorStudentStudyPlanPage;
