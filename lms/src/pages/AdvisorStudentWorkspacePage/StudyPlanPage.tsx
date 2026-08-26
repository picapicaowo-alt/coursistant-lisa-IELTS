import React, {FormEvent, useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {AdvisorTaskRequest, CheckpointRequest, unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';

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
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [revisionPage, setRevisionPage] = useState(0);

  const planQuery = useQuery({
    queryKey: advisingQueryKeys.advisorStudyPlan(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudyPlan(id), 'getStudyPlan'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const missing = planQuery.isError && isNotFound(planQuery.error);
  const profileQuery = useQuery({
    queryKey: advisingQueryKeys.advisorProfile(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudentProfile(id), 'getProfile'),
    enabled: Number.isInteger(id) && missing,
    retry: false,
  });
  const revisions = useQuery({
    queryKey: advisingQueryKeys.advisorRevisions(id, revisionPage),
    queryFn: async () => unwrapData(await advisorApiService.listStudyPlanRevisions(id, revisionPage, 20), 'listRevisions'),
    enabled: Number.isInteger(id) && !missing,
  });

  useEffect(() => {
    const plan = planQuery.data?.plan;
    if (!plan) return;
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

  const save = useMutation({
    mutationFn: async () => {
      const expectedProfileVersion = planQuery.data?.profileContext.currentProfileVersion
        ?? planQuery.data?.plan.basedOnProfileVersion
        ?? profileQuery.data?.profileVersion
        ?? 0;
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
      const update = {
        ...payload,
        expectedStudyPlanVersion: planQuery.data?.plan.studyPlanVersion ?? 0,
      };
      const key = idempotency.keyFor(`plan-put-${id}`, idempotencyFingerprint(update));
      return unwrapData(await advisorApiService.updateStudyPlan(id, update, key), 'updateStudyPlan');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: advisingQueryKeys.advisorStudyPlan(id)});
      await queryClient.invalidateQueries({queryKey: ['advisor', 'study-plan-revisions', id]});
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

  if (planQuery.isPending) return <p className={styles.status}>Loading study plan…</p>;
  if (planQuery.isError && !missing) {
    return <p className={styles.error} role="alert">{advisingErrorMessage(planQuery.error, 'Study plan could not be loaded.')}</p>;
  }

  return (
    <section className={styles.card}>
      <h2>{missing ? 'Create study plan' : `Study plan · version ${planQuery.data?.plan.studyPlanVersion}`}</h2>
      {planQuery.data?.plan.profileChangedSincePlanUpdate ? (
        <p className={styles.warn} role="status">The profile changed after this plan. Saving will require the current profile version.</p>
      ) : null}
      {save.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, 'Study plan could not be saved.')}</p> : null}
      {save.isSuccess ? <p className={styles.success} role="status">Study plan saved.</p> : null}
      <form className={styles.form} onSubmit={(event: FormEvent) => { event.preventDefault(); save.mutate(); }}>
        <label><span>Strategy</span><textarea required value={form.strategySummary} onChange={event => setForm(current => ({...current, strategySummary: event.target.value}))}/></label>
        <label><span>Start date</span><input required type="date" value={form.startDate} onChange={event => setForm(current => ({...current, startDate: event.target.value}))}/></label>
        <label><span>End date</span><input required type="date" value={form.planEndDate} onChange={event => setForm(current => ({...current, planEndDate: event.target.value}))}/></label>
        {form.checkpoints.map((checkpoint, index) => (
          <fieldset key={checkpoint.position} className={styles.nested}>
            <legend>Checkpoint {index + 1}</legend>
            <label><span>Description</span><textarea required value={checkpoint.description} onChange={event => setCheckpoint(index, {description: event.target.value})}/></label>
            <label><span>Goal</span><textarea required value={checkpoint.goal} onChange={event => setCheckpoint(index, {goal: event.target.value})}/></label>
            <label><span>Due date</span><input required type="date" value={checkpoint.dueDate} onChange={event => setCheckpoint(index, {dueDate: event.target.value})}/></label>
            {(checkpoint.tasks ?? []).map((task, taskIndex) => (
              <fieldset key={task.position} className={styles.nested}>
                <legend>Task {taskIndex + 1}</legend>
                <label><span>Title</span><input required={taskIndex === 0} value={task.title} onChange={event => setTask(index, taskIndex, {title: event.target.value})}/></label>
                <label><span>Description</span><textarea value={task.description} onChange={event => setTask(index, taskIndex, {description: event.target.value})}/></label>
                <label><span>Due date</span><input type="date" value={task.dueDate} onChange={event => setTask(index, taskIndex, {dueDate: event.target.value})}/></label>
              </fieldset>
            ))}
            <button type="button" className={styles.secondary} onClick={() => setCheckpoint(index, {tasks: [...(checkpoint.tasks ?? []), emptyTask((checkpoint.tasks?.length ?? 0) + 1)]})}>Add task</button>
          </fieldset>
        ))}
        <button type="button" className={styles.secondary} onClick={() => setForm(current => ({...current, checkpoints: [...current.checkpoints, emptyCheckpoint(current.checkpoints.length + 1)]}))}>Add checkpoint</button>
        <button className={styles.primary} disabled={save.isPending}>{save.isPending ? 'Saving…' : missing ? 'Create study plan' : 'Save study plan'}</button>
      </form>
      {!missing ? (
        <div>
          <h3>Revisions</h3>
          <p className={styles.muted}>Immutable metadata only. This is not an editor.</p>
          {(revisions.data?.items ?? []).map(revision => (
            <p key={`${revision.entityVersion}-${revision.createdAt}`}>{revision.action} · v{revision.entityVersion} · {revision.createdAt} · actor {revision.actorId}</p>
          ))}
          {revisions.data && revisions.data.total > 20 ? (
            <nav className={styles.pagination}>
              <button type="button" className={styles.secondary} disabled={revisionPage === 0} onClick={() => setRevisionPage(revisionPage - 1)}>Previous</button>
              <button type="button" className={styles.secondary} disabled={(revisionPage + 1) * 20 >= revisions.data.total} onClick={() => setRevisionPage(revisionPage + 1)}>Next</button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default AdvisorStudentStudyPlanPage;
