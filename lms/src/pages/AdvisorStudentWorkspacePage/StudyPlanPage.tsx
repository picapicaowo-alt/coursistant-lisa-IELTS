import React, {FormEvent, useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {AdvisorTaskRequest, CheckpointRequest, unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {EnglishDateInput} from '@/components/EnglishDateInput';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
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
    <section className={styles.card}>
      <WorkspaceSectionHeader
        title={missing ? 'Create study plan' : 'Study plan'}
        description="Turn the student's target into a dated strategy, then break it into checkpoints and concrete tasks."
        meta={!missing ? <span className={styles.versionBadge}>Version {planQuery.data?.plan.studyPlanVersion}</span> : undefined}
      />
      {!missing ? <div className={styles.dashboardNotice}><strong>About versions</strong><p>The version increases only after a successful save. It protects this record from conflicting edits; it is not created on every keystroke.</p></div> : null}
      {planQuery.data?.plan.profileChangedSincePlanUpdate ? (
        <p className={styles.warn} role="status">The profile changed after this plan. Saving will require the current profile version.</p>
      ) : null}
      {save.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(save.error, 'Study plan could not be saved.')}</p> : null}
      {save.isSuccess ? <p className={styles.success} role="status">Study plan saved.</p> : null}
      <form className={styles.form} onSubmit={(event: FormEvent) => { event.preventDefault(); save.mutate(); }}>
        <section className={styles.formSection}>
          <h3>Plan direction</h3>
          <p>Keep the strategy concise enough to scan, while making the start and end dates explicit.</p>
          <div className={styles.formGrid}>
            <label className={styles.spanTwo}><span>Strategy</span><textarea required value={form.strategySummary} onChange={event => setForm(current => ({...current, strategySummary: event.target.value}))}/></label>
            <label><span>Start date</span><EnglishDateInput required value={form.startDate} onChangeValue={startDate => setForm(current => ({...current, startDate}))}/></label>
            <label><span>End date</span><EnglishDateInput required value={form.planEndDate} onChangeValue={planEndDate => setForm(current => ({...current, planEndDate}))}/></label>
          </div>
        </section>
        <section className={styles.formSection}>
          <h3>Checkpoints and tasks</h3>
          <p>Open one checkpoint at a time to reduce visual noise. Checkpoints define progress milestones; tasks are the actions a student completes.</p>
          {form.checkpoints.map((checkpoint, index) => (
            <details key={`${checkpoint.position}-${index}`} className={styles.recordDisclosure} open={index === 0}>
              <summary className={styles.disclosureSummary}>
                <span>Checkpoint {index + 1}{checkpoint.description.trim() ? ` · ${checkpoint.description.trim()}` : ''}</span>
                <small>{checkpoint.dueDate ? `Due ${checkpoint.dueDate}` : 'Due date not set'} · {(checkpoint.tasks ?? []).length} task{(checkpoint.tasks ?? []).length === 1 ? '' : 's'}</small>
              </summary>
              <div className={styles.disclosureBody}>
                <div className={styles.formGrid}>
                  <label><span>Description</span><textarea required value={checkpoint.description} onChange={event => setCheckpoint(index, {description: event.target.value})}/></label>
                  <label><span>Goal</span><textarea required value={checkpoint.goal} onChange={event => setCheckpoint(index, {goal: event.target.value})}/></label>
                  <label><span>Due date</span><EnglishDateInput required value={checkpoint.dueDate} onChangeValue={dueDate => setCheckpoint(index, {dueDate})}/></label>
                </div>
                {(checkpoint.tasks ?? []).map((task, taskIndex) => (
                  <fieldset key={`${task.position}-${taskIndex}`} className={styles.taskGroup}>
                    <legend>Task {taskIndex + 1}</legend>
                    <div className={styles.recordGrid}>
                      <label className={styles.spanTwo}><span>Title</span><input required={taskIndex === 0} value={task.title} onChange={event => setTask(index, taskIndex, {title: event.target.value})}/></label>
                      <label className={styles.spanTwo}><span>Description</span><textarea value={task.description} onChange={event => setTask(index, taskIndex, {description: event.target.value})}/></label>
                      <label><span>Due date</span><EnglishDateInput value={task.dueDate ?? ''} onChangeValue={dueDate => setTask(index, taskIndex, {dueDate})}/></label>
                    </div>
                    {(checkpoint.tasks ?? []).length > 1 ? <div className={styles.recordActions}><button type="button" className={styles.textDanger} onClick={() => removeTask(index, taskIndex)}>Remove task</button></div> : null}
                  </fieldset>
                ))}
                <div className={styles.recordActions}>
                  {form.checkpoints.length > 1 ? <button type="button" className={styles.textDanger} onClick={() => removeCheckpoint(index)}>Remove checkpoint</button> : null}
                  <button type="button" className={styles.secondary} onClick={() => setCheckpoint(index, {tasks: [...(checkpoint.tasks ?? []), emptyTask((checkpoint.tasks?.length ?? 0) + 1)]})}>Add task</button>
                </div>
              </div>
            </details>
          ))}
          <button type="button" className={styles.secondary} onClick={() => setForm(current => ({...current, checkpoints: [...current.checkpoints, emptyCheckpoint(current.checkpoints.length + 1)]}))}>Add checkpoint</button>
        </section>
        <div className={styles.formActions}><button className={styles.primary} disabled={save.isPending}>{save.isPending ? 'Saving…' : missing ? 'Create study plan' : 'Save study plan'}</button></div>
      </form>
      {!missing ? (
        <details className={styles.revisionPanel}>
          <summary>Revision activity <span className={styles.countBadge}>{revisions.data?.total ?? 0}</span></summary>
          <div className={styles.revisionBody}>
          <p className={styles.muted}>The current backend returns immutable audit metadata, not the previous field values. Earlier plan content cannot be opened or restored from this screen.</p>
          <ol className={styles.revisionList}>{(revisions.data?.items ?? []).map(revision => (
            <li className={styles.revisionItem} key={`${revision.entityVersion}-${revision.createdAt}`}>
              <strong>{revision.action === 'STUDY_PLAN_CREATED' ? 'Plan created' : 'Plan updated'}</strong>
              <div className={styles.revisionMeta}><span>Version {revision.entityVersion ?? '—'}</span><span>{revision.createdAt || 'Time unavailable'}</span><span>Actor #{revision.actorId ?? '—'}</span></div>
            </li>
          ))}</ol>
          {revisions.data && revisions.data.total > 20 ? (
            <nav className={styles.pagination}>
              <button type="button" className={styles.secondary} disabled={revisionPage === 0} onClick={() => setRevisionPage(revisionPage - 1)}>Previous</button>
              <button type="button" className={styles.secondary} disabled={(revisionPage + 1) * 20 >= revisions.data.total} onClick={() => setRevisionPage(revisionPage + 1)}>Next</button>
            </nav>
          ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
};

export default AdvisorStudentStudyPlanPage;
