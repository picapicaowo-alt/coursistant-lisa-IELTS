import { groupMemberName } from './groupNames';
import { ungroupedStudentName } from './groupNames';
import { useTranslation } from 'react-i18next';
import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Lock, Pencil, Plus, Shuffle, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CourseGroup, PatchGroupSetPayload } from '@/apis';
import { unwrapData } from '@/apis';
import { courseApiService } from '@/apis/services/course-api';
import { DurationSelect } from '@/components/DurationSelect';
import { EnglishDateTimeInput } from '@/components/EnglishDateInput';
import { useCourseAccess } from '@/hooks/useCourseAccess';
import {
  addMinutesToDateTimeValue,
  dateTimeDurationMinutes,
  DEFAULT_DURATION_MINUTES,
  LONG_DURATION_OPTIONS,
  presetDuration,
} from '@/utils/dateTimeRange';
import { formatNumber } from '@/i18n/formatting';
import { groupSetValidationKey, validGroupCapacity } from '@/pages/groups/formValidation';
import styles from './index.module.scss';

interface GroupDraft {
  name: string;
  capacityOverride: number | null;
}
interface MembershipAction {
  kind: 'move' | 'remove';
  userId: number;
  fromGroupId: number;
  targetGroupId?: number;
  displayName: string | null;
}

const GroupSetDetailPage = () => {
  const { t: translate } = useTranslation();
  const params = useParams();
  const courseId = Number(params.courseId);
  const groupSetId = Number(params.groupSetId);
  const valid = [courseId, groupSetId].every((value) => Number.isInteger(value) && value > 0);
  const access = useCourseAccess(valid ? courseId : null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [message, setMessage] = useState<{ key: string; tone: 'error' | 'success' } | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<PatchGroupSetPayload>({});
  const [confirmSettingsImpact, setConfirmSettingsImpact] = useState(false);
  const [createMode, setCreateMode] = useState<'single' | 'batch' | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCapacity, setNewGroupCapacity] = useState<number | null>(null);
  const [batchCount, setBatchCount] = useState(2);
  // A generated prefix follows the locale until edited; authored drafts never do.
  const [batchPrefix, setBatchPrefix] = useState<string | null>(null);
  const effectiveBatchPrefix = batchPrefix ?? translate('course:assignmentSubmissionDetail.group');
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft>({ name: '', capacityOverride: null });
  const [confirmGroupCapacity, setConfirmGroupCapacity] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<number | null>(null);
  const [allowOverfill, setAllowOverfill] = useState(false);
  const [membershipAction, setMembershipAction] = useState<MembershipAction | null>(null);

  const groupSetQuery = useQuery({
    queryKey: ['course-group-set', courseId, groupSetId],
    queryFn: async () => unwrapData(await courseApiService.getGroupSet(courseId, groupSetId), 'getGroupSet'),
    enabled: valid,
    retry: 1,
  });
  const ungroupedQuery = useQuery({
    queryKey: ['course-group-set-ungrouped', courseId, groupSetId],
    queryFn: async () =>
      unwrapData(await courseApiService.listUngroupedStudents(courseId, groupSetId), 'listUngroupedStudents'),
    enabled: valid && access.canManageGroups,
    retry: 1,
  });
  const groupSet = groupSetQuery.data;
  const groups = groupSet?.groups ?? [];

  useEffect(() => {
    if (!groupSet || editingSettings) return;
    setSettingsDraft({
      name: groupSet.name,
      defaultCapacity: groupSet.defaultCapacity,
      joinOpensAt: groupSet.joinOpensAtLocal?.slice(0, 16) ?? null,
      joinClosesAt: groupSet.joinClosesAtLocal?.slice(0, 16) ?? null,
      locked: groupSet.locked,
    });
    // Field-level deps keep a mid-edit draft from being overwritten on refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editingSettings,
    groupSet?.id,
    groupSet?.name,
    groupSet?.defaultCapacity,
    groupSet?.joinOpensAtLocal,
    groupSet?.joinClosesAtLocal,
    groupSet?.locked,
  ]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course-group-set', courseId, groupSetId] }),
      queryClient.invalidateQueries({ queryKey: ['course-group-set-ungrouped', courseId, groupSetId] }),
      queryClient.invalidateQueries({ queryKey: ['course-group-sets', courseId] }),
    ]);
  };

  const settingsMutation = useMutation({
    mutationFn: () =>
      courseApiService.patchGroupSet(courseId, groupSetId, {
        ...settingsDraft,
        name: settingsDraft.name?.trim(),
        defaultCapacity: settingsDraft.defaultCapacity || null,
        joinOpensAt: settingsDraft.joinOpensAt || undefined,
        joinClosesAt: settingsDraft.joinClosesAt || undefined,
        clearJoinOpensAt: !settingsDraft.joinOpensAt,
        clearJoinClosesAt: !settingsDraft.joinClosesAt,
        confirmCapacityShorten: confirmSettingsImpact,
        confirmWindowShorten: confirmSettingsImpact,
      }),
    onSuccess: async () => {
      setEditingSettings(false);
      setConfirmSettingsImpact(false);
      setMessage({ key: 'courseTools:groups.settingsSaved', tone: 'success' });
      await refresh();
    },
    onError: () => setMessage({ key: 'courseTools:groups.settingsFailed', tone: 'error' }),
  });
  const createGroups = useMutation({
    mutationFn: async () => {
      if (createMode === 'batch') {
        await courseApiService.batchCreateGroups(courseId, groupSetId, {
          count: batchCount,
          namePrefix: effectiveBatchPrefix.trim(),
        });
      } else {
        await courseApiService.createGroup(courseId, groupSetId, {
          name: newGroupName.trim(),
          capacityOverride: newGroupCapacity,
        });
      }
    },
    onSuccess: async () => {
      setCreateMode(null);
      setNewGroupName('');
      setMessage({ key: 'courseTools:groups.created', tone: 'success' });
      await refresh();
    },
    onError: () => setMessage({ key: 'courseTools:groups.createFailed', tone: 'error' }),
  });
  const updateGroup = useMutation({
    mutationFn: () =>
      courseApiService.patchGroup(courseId, groupSetId, editingGroupId!, {
        name: groupDraft.name.trim(),
        capacityOverride: groupDraft.capacityOverride,
        clearCapacityOverride: groupDraft.capacityOverride === null,
        confirmCapacityShorten: confirmGroupCapacity,
      }),
    onSuccess: async () => {
      setEditingGroupId(null);
      setConfirmGroupCapacity(false);
      setMessage({ key: 'courseTools:groups.updated', tone: 'success' });
      await refresh();
    },
    onError: () => setMessage({ key: 'courseTools:groups.updateFailed', tone: 'error' }),
  });
  const deleteItem = useMutation({
    mutationFn: ({ kind, id }: { kind: 'set' | 'group'; id: number }) =>
      kind === 'set'
        ? courseApiService.deleteGroupSet(courseId, groupSetId)
        : courseApiService.deleteGroup(courseId, groupSetId, id),
    onSuccess: async (_, { kind }) => {
      if (kind === 'set') {
        navigate(`/course/${courseId}/groups`, { replace: true });
        return;
      }
      setConfirmDeleteId(null);
      setMessage({ key: 'courseTools:groups.deleted', tone: 'success' });
      await refresh();
    },
    onError: () => setMessage({ key: 'courseTools:groups.deleteFailed', tone: 'error' }),
  });
  const selfService = useMutation({
    mutationFn: ({ action, groupId }: { action: 'join' | 'leave' | 'switch'; groupId: number }) =>
      action === 'join'
        ? courseApiService.joinGroup(courseId, groupSetId, groupId)
        : action === 'leave'
          ? courseApiService.leaveGroup(courseId, groupSetId, groupId)
          : courseApiService.switchGroup(courseId, groupSetId, groupId),
    onSuccess: async (_, { action }) => {
      setMessage({
        key: action === 'leave' ? 'courseTools:groups.left' : 'courseTools:groups.selfServiceUpdated',
        tone: 'success',
      });
      await refresh();
    },
    onError: () => setMessage({ key: 'courseTools:groups.selfServiceFailed', tone: 'error' }),
  });
  const assignStudent = useMutation({
    mutationFn: () =>
      courseApiService.assignGroupMember(courseId, groupSetId, selectedTargetGroupId!, selectedStudentId!, {
        confirmCapacityOverfill: allowOverfill,
      }),
    onSuccess: async () => {
      setSelectedStudentId(null);
      setMessage({ key: 'courseTools:groups.assigned', tone: 'success' });
      await refresh();
    },
    onError: () => setMessage({ key: 'courseTools:groups.assignFailed', tone: 'error' }),
  });
  const changeMembership = useMutation({
    mutationFn: () =>
      membershipAction?.kind === 'move'
        ? courseApiService.moveGroupMember(
            courseId,
            groupSetId,
            membershipAction.userId,
            membershipAction.targetGroupId!,
            { confirmCapacityOverfill: true, confirmAcademicImpact: true },
          )
        : courseApiService.removeGroupMember(
            courseId,
            groupSetId,
            membershipAction!.fromGroupId,
            membershipAction!.userId,
            true,
          ),
    onSuccess: async () => {
      setMembershipAction(null);
      setMessage({ key: 'courseTools:groups.membershipUpdated', tone: 'success' });
      await refresh();
    },
    onError: () => setMessage({ key: 'courseTools:groups.membershipFailed', tone: 'error' }),
  });
  const randomDistribution = useMutation({
    mutationFn: () => courseApiService.distributeGroupsRandomly(courseId, groupSetId),
    onSuccess: async () => {
      setConfirmDeleteId(null);
      setMessage({ key: 'courseTools:groups.distributed', tone: 'success' });
      await refresh();
    },
    onError: () => setMessage({ key: 'courseTools:groups.distributeFailed', tone: 'error' }),
  });

  // All writes affect the same membership workspace. Keep their controls stable
  // until the mutation and its follow-up reads finish, including delete and leave.
  const isWriting = [
    settingsMutation,
    createGroups,
    updateGroup,
    deleteItem,
    selfService,
    assignStudent,
    changeMembership,
    randomDistribution,
  ].some((mutation) => mutation.isPending);

  const submitSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (isWriting) return;
    const validationKey = groupSetValidationKey(settingsDraft, event.currentTarget);
    if (validationKey) {
      setMessage({ key: validationKey, tone: 'error' });
      return;
    }
    settingsMutation.mutate();
  };
  const submitGroups = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (isWriting) return;
    if (!(createMode === 'batch' ? effectiveBatchPrefix : newGroupName).trim()) {
      setMessage({ key: 'courseTools:groups.requiredName', tone: 'error' });
      return;
    }
    if (createMode === 'batch' && (!Number.isInteger(batchCount) || batchCount < 1 || batchCount > 100)) {
      setMessage({ key: 'courseTools:groups.invalidCount', tone: 'error' });
      return;
    }
    if (createMode === 'single' && !validGroupCapacity(newGroupCapacity, event.currentTarget, 'capacityOverride')) {
      setMessage({ key: 'courseTools:groups.invalidCapacity', tone: 'error' });
      return;
    }
    createGroups.mutate();
  };
  const submitGroupEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (isWriting) return;
    if (!groupDraft.name.trim()) {
      setMessage({ key: 'courseTools:groups.requiredName', tone: 'error' });
      return;
    }
    if (!validGroupCapacity(groupDraft.capacityOverride, event.currentTarget, 'capacityOverride')) {
      setMessage({ key: 'courseTools:groups.invalidCapacity', tone: 'error' });
      return;
    }
    updateGroup.mutate();
  };

  const startGroupEdit = (group: CourseGroup) => {
    setEditingGroupId(group.id);
    setGroupDraft({ name: group.name, capacityOverride: group.capacityOverride });
    setConfirmGroupCapacity(false);
  };
  const rangeDuration = dateTimeDurationMinutes(settingsDraft.joinOpensAt ?? '', settingsDraft.joinClosesAt ?? '');
  const selectedDuration = presetDuration(rangeDuration, LONG_DURATION_OPTIONS);
  const changeJoinOpensAt = (value: string) => {
    const duration = rangeDuration ?? DEFAULT_DURATION_MINUTES;
    setSettingsDraft((current) => ({
      ...current,
      joinOpensAt: value || null,
      joinClosesAt: value ? addMinutesToDateTimeValue(value, duration) : current.joinClosesAt,
    }));
  };
  const changeDuration = (minutes: number) => {
    setSettingsDraft((current) => ({
      ...current,
      joinClosesAt: current.joinOpensAt
        ? addMinutesToDateTimeValue(current.joinOpensAt, minutes)
        : current.joinClosesAt,
    }));
  };
  const invalidWindow = Boolean(
    settingsDraft.joinOpensAt && settingsDraft.joinClosesAt && settingsDraft.joinClosesAt <= settingsDraft.joinOpensAt,
  );
  const myGroupId = groupSet?.myGroup?.groupId ?? null;

  if (!valid || groupSetQuery.isError) {
    return (
      <main className={styles.page}>
          <section className={styles.card} role="alert">
            <h1>{translate('courseTools:groups.setUnavailable')}</h1>
            <p>{translate('courseTools:groups.setFailed')}</p>
            {valid ? (
              <button type="button" className={styles.primaryButton} onClick={() => void groupSetQuery.refetch()}>
                {translate('common:actions.tryAgain')}
              </button>
            ) : null}
          </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <fieldset className={styles.workspace} disabled={isWriting} aria-busy={isWriting} aria-label={groupSet?.name}>
      <div className={styles.header}>
        <Link
          to={`/course/${courseId}/groups`}
          className={styles.backLink}
          aria-label={translate('common:navigationControls.backToGroupSets')}
          title={translate('common:navigationControls.backToGroupSets')}
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>{translate('courseTools:groups.setEyebrow')}</p>
          <h1>{groupSet?.name || translate('courseTools:groups.loadingSet')}</h1>
          {groupSet ? (
            <p>
              {groupSet.locked
                ? translate('courseTools:subject.locked')
                : groupSet.openForSelfService
                  ? translate('courseTools:groups.choiceOpen')
                  : translate('courseTools:delivery.instructorManaged')}{' '}
              · {groupSet.timezone}
            </p>
          ) : null}
        </div>
        {access.canManageGroups && groupSet && !editingSettings ? (
          <button type="button" className={styles.secondaryButton} onClick={() => setEditingSettings(true)}>
            <Pencil size={16} /> {translate('courseTools:groups.editSettings')}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className={message.tone === 'error' ? styles.error : styles.success} role="status">
          {translate(message.key)}
        </p>
      ) : null}

      {editingSettings ? (
        <form className={styles.card} noValidate onSubmit={submitSettings}>
          <div className={styles.cardHeader}>
            <div>
              <h2>{translate('courseTools:groups.settings')}</h2>
              <p>{translate('courseTools:groups.settingsHelp')}</p>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={translate('courseTools:groups.closeSettings')}
              onClick={() => setEditingSettings(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.full}>
              <span>{translate('common:fields.name')}</span>
              <input
                required
                value={settingsDraft.name ?? ''}
                onChange={(e) => setSettingsDraft((current) => ({ ...current, name: e.target.value }))}
              />
            </label>
            <label>
              <span>{translate('courseTools:groups.defaultCapacity')}</span>
              <input
                name="defaultCapacity"
                type="number"
                min="1"
                value={settingsDraft.defaultCapacity ?? ''}
                placeholder={translate('courseTools:groups.noLimit')}
                onChange={(e) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    defaultCapacity: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={Boolean(settingsDraft.locked)}
                onChange={(e) => setSettingsDraft((current) => ({ ...current, locked: e.target.checked }))}
              />
              <span>{translate('courseTools:groups.lockChanges')}</span>
            </label>
            <label>
              <span>{translate('courseTools:groups.joinOpens')}</span>
              <EnglishDateTimeInput
                name="joinOpensAt"
                aria-label={translate('courseTools:groups.joinOpens')}
                value={settingsDraft.joinOpensAt ?? ''}
                onChangeValue={changeJoinOpensAt}
              />
            </label>
            <label>
              <span>{translate('courseTools:groups.joinCloses')}</span>
              <EnglishDateTimeInput
                name="joinClosesAt"
                aria-label={translate('courseTools:groups.joinCloses')}
                value={settingsDraft.joinClosesAt ?? ''}
                onChangeValue={(value) => setSettingsDraft((current) => ({ ...current, joinClosesAt: value || null }))}
              />
            </label>
            <DurationSelect
              minutes={selectedDuration}
              options={LONG_DURATION_OPTIONS}
              onChange={changeDuration}
              disabled={!settingsDraft.joinOpensAt}
            />
            <span />
          </div>
          <label className={styles.confirmCheck}>
            <input
              type="checkbox"
              checked={confirmSettingsImpact}
              onChange={(e) => setConfirmSettingsImpact(e.target.checked)}
            />
            <span>{translate('courseTools:groups.confirmSettingsImpact')}</span>
          </label>
          {invalidWindow ? <p className={styles.error}>{translate('courseTools:groups.invalidWindow')}</p> : null}
          <div className={styles.footer}>
            <button
              className={styles.primaryButton}
              disabled={settingsMutation.isPending || !settingsDraft.name?.trim() || invalidWindow}
            >
              {translate('assessment:quiz.saveSettings')}
            </button>
          </div>
        </form>
      ) : null}

      {groupSet && !access.canManageGroups ? (
        <section className={styles.card}>
          <h2>{translate('courseTools:groups.yourGroup')}</h2>
          <p className={styles.muted}>
            {myGroupId
              ? groups.find((group) => group.id === myGroupId)?.name
                ? translate('courseTools:groups.inGroup', {
                    name: groups.find((group) => group.id === myGroupId)?.name,
                  })
                : translate('courseTools:groups.inUnnamedGroup')
              : groupSet.openForSelfService
                ? translate('courseTools:groups.chooseGroup')
                : translate('courseTools:groups.notAssigned')}
          </p>
        </section>
      ) : null}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>{translate('courseTools:groups.groups')}</h2>
            <p>
              {translate('courseTools:subject.groupCount', {
                count: groups.length,
                number: formatNumber(groups.length),
              })}
            </p>
          </div>
          {access.canManageGroups && !createMode ? (
            <div className={styles.actionRow}>
              <button type="button" className={styles.secondaryButton} onClick={() => setCreateMode('batch')}>
                <Users size={16} /> {translate('courseTools:groups.addBatch')}
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => setCreateMode('single')}>
                <Plus size={16} /> {translate('courseTools:groups.addGroup')}
              </button>
            </div>
          ) : null}
        </div>

        {createMode ? (
          <form className={styles.inlineForm} noValidate onSubmit={submitGroups}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={translate('courseTools:groups.closeCreate')}
              onClick={() => setCreateMode(null)}
            >
              <X size={17} />
            </button>
            {createMode === 'single' ? (
              <>
                <label>
                  <span>{translate('courseTools:groups.groupName')}</span>
                  <input required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                </label>
                <label>
                  <span>{translate('courseTools:groups.capacityOverride')}</span>
                  <input
                    name="capacityOverride"
                    type="number"
                    min="1"
                    value={newGroupCapacity ?? ''}
                    placeholder={translate('courseTools:groups.useDefault')}
                    onChange={(e) => setNewGroupCapacity(e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  <span>{translate('courseTools:groups.numberGroups')}</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={batchCount}
                    onChange={(e) => setBatchCount(Number(e.target.value))}
                  />
                </label>
                <label>
                  <span>{translate('courseTools:groups.namePrefix')}</span>
                  <input required value={effectiveBatchPrefix} onChange={(e) => setBatchPrefix(e.target.value)} />
                </label>
              </>
            )}
            <button
              className={styles.primaryButton}
              disabled={
                createGroups.isPending ||
                (createMode === 'single' ? !newGroupName.trim() : !effectiveBatchPrefix.trim() || batchCount < 1)
              }
            >
              {translate('course:scheduleModal.createButton')}
            </button>
          </form>
        ) : null}

        {groupSetQuery.isPending ? (
          <p className={styles.muted}>{translate('courseTools:groups.loadingGroups')}</p>
        ) : groups.length === 0 ? (
          <p className={styles.muted}>{translate('courseTools:groups.noGroups')}</p>
        ) : (
          <div className={styles.groupGrid}>
            {groups.map((group) => {
              const isMine = group.id === myGroupId;
              const full = group.capacity !== null && group.memberCount >= group.capacity;
              return (
                <article className={styles.groupCard} key={group.id}>
                  <div className={styles.groupHeader}>
                    <div>
                      <h3>{group.name}</h3>
                      <p>
                        {group.capacity !== null
                          ? translate('courseTools:groups.membersWithCapacity', {
                              number: formatNumber(group.memberCount),
                              capacity: formatNumber(group.capacity),
                            })
                          : translate('courseTools:groups.members', {
                              count: group.memberCount,
                              number: formatNumber(group.memberCount),
                            })}
                      </p>
                    </div>
                    {isMine ? (
                      <span className={styles.myBadge}>{translate('courseTools:groups.yourGroup')}</span>
                    ) : null}
                  </div>
                  {editingGroupId === group.id ? (
                    <form className={styles.groupEdit} noValidate onSubmit={submitGroupEdit}>
                      <label>
                        <span>{translate('common:fields.name')}</span>
                        <input
                          required
                          value={groupDraft.name}
                          onChange={(e) => setGroupDraft((current) => ({ ...current, name: e.target.value }))}
                        />
                      </label>
                      <label>
                        <span>{translate('courseTools:groups.capacityOverride')}</span>
                        <input
                          name="capacityOverride"
                          type="number"
                          min="1"
                          value={groupDraft.capacityOverride ?? ''}
                          placeholder={translate('courseTools:groups.useDefault')}
                          onChange={(e) =>
                            setGroupDraft((current) => ({
                              ...current,
                              capacityOverride: e.target.value ? Number(e.target.value) : null,
                            }))
                          }
                        />
                      </label>
                      <label className={styles.confirmCheck}>
                        <input
                          type="checkbox"
                          checked={confirmGroupCapacity}
                          onChange={(e) => setConfirmGroupCapacity(e.target.checked)}
                        />
                        <span>{translate('courseTools:groups.confirmReduction')}</span>
                      </label>
                      <div className={styles.actionRow}>
                        <button className={styles.primaryButton} disabled={isWriting || !groupDraft.name.trim()}>
                          {translate(isWriting ? 'common:actions.saving' : 'common:actions.save')}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setEditingGroupId(null)}
                        >
                          {translate('common:actions.cancel')}
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {group.members.length ? (
                    <ul className={styles.memberList}>
                      {group.members.map((member) => (
                        <li key={member.userId}>
                          <span>
                            {groupMemberName(
                              member,
                              translate('common:people.userFallback', { id: formatNumber(member.userId) }),
                            )}
                          </span>
                          {access.canManageGroups ? (
                            <div className={styles.memberActions}>
                              <label>
                                <span className={styles.srOnly}>
                                  {translate('courseTools:groups.moveNamed', {
                                    name: groupMemberName(
                                      member,
                                      translate('common:people.userFallback', { id: formatNumber(member.userId) }),
                                    ),
                                  })}
                                </span>
                                <select
                                  defaultValue=""
                                  onChange={(e) => {
                                    const target = Number(e.target.value);
                                    if (target)
                                      setMembershipAction({
                                        kind: 'move',
                                        userId: member.userId,
                                        fromGroupId: group.id,
                                        targetGroupId: target,
                                        displayName: groupMemberName(member, '') || null,
                                      });
                                    e.currentTarget.value = '';
                                  }}
                                >
                                  <option value="">{translate('courseTools:groups.moveTo')}</option>
                                  {groups
                                    .filter((item) => item.id !== group.id)
                                    .map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.name}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                aria-label={translate('common:actions.removeItem', {
                                  item: groupMemberName(
                                    member,
                                    translate('common:people.userFallback', { id: formatNumber(member.userId) }),
                                  ),
                                })}
                                onClick={() =>
                                  setMembershipAction({
                                    kind: 'remove',
                                    userId: member.userId,
                                    fromGroupId: group.id,
                                    displayName: groupMemberName(member, '') || null,
                                  })
                                }
                              >
                                <UserMinus size={16} />
                              </button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.muted}>{translate('courseTools:groups.noMembers')}</p>
                  )}
                  <div className={styles.groupFooter}>
                    {access.canManageGroups ? (
                      <>
                        <button type="button" className={styles.secondaryButton} onClick={() => startGroupEdit(group)}>
                          <Pencil size={15} /> {translate('common:actions.edit')}
                        </button>
                        {confirmDeleteId === `group-${group.id}` ? (
                          <>
                            <button
                              type="button"
                              className={styles.dangerButton}
                              onClick={() => deleteItem.mutate({ kind: 'group', id: group.id })}
                            >
                              {translate('assessment:quiz.confirmDelete')}
                            </button>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              {translate('common:actions.cancel')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={() => setConfirmDeleteId(`group-${group.id}`)}
                          >
                            <Trash2 size={15} /> {translate('common:actions.delete')}
                          </button>
                        )}
                      </>
                    ) : groupSet?.openForSelfService ? (
                      isMine ? (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => selfService.mutate({ action: 'leave', groupId: group.id })}
                        >
                          {translate('courseTools:groups.leave')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          disabled={full || selfService.isPending}
                          onClick={() =>
                            selfService.mutate({ action: myGroupId ? 'switch' : 'join', groupId: group.id })
                          }
                        >
                          {full
                            ? translate('courseTools:groups.full')
                            : myGroupId
                              ? translate('courseTools:groups.switch')
                              : translate('courseTools:groups.join')}
                        </button>
                      )
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {access.canManageGroups ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>{translate('courseTools:groups.assignUngrouped')}</h2>
              {!ungroupedQuery.isError && !ungroupedQuery.isPending ? (
                <p>{translate('course:groupReadiness.ungroupedCount', { count: ungroupedQuery.data?.length ?? 0 })}</p>
              ) : null}
            </div>
            {confirmDeleteId === 'random' ? (
              <div className={styles.actionRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => randomDistribution.mutate()}
                  disabled={randomDistribution.isPending}
                >
                  {translate('courseTools:groups.confirmDistribute')}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => setConfirmDeleteId(null)}>
                  {translate('common:actions.cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={
                  ungroupedQuery.isError || ungroupedQuery.isFetching || !ungroupedQuery.data?.length || !groups.length
                }
                onClick={() => setConfirmDeleteId('random')}
              >
                <Shuffle size={16} /> {translate('courseTools:groups.distribute')}
              </button>
            )}
          </div>
          {ungroupedQuery.isError ? (
            <div className={styles.error} role="alert">
              <p>{translate('course:groupReadiness.ungroupedError')}</p>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void ungroupedQuery.refetch()}
                disabled={ungroupedQuery.isFetching}
              >
                {translate('common:actions.retry')}
              </button>
            </div>
          ) : (
            <form
              className={styles.assignForm}
              onSubmit={(event) => {
                event.preventDefault();
                if (!isWriting && selectedStudentId && selectedTargetGroupId) assignStudent.mutate();
              }}
            >
              <label>
                <span>{translate('common:roles.STUDENT')}</span>
                <select
                  value={selectedStudentId ?? ''}
                  onChange={(e) => setSelectedStudentId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{translate('courseTools:groups.selectStudent')}</option>
                  {ungroupedQuery.data?.map((student) => (
                    <option key={student.userId} value={student.userId}>
                      {ungroupedStudentName(
                        student,
                        translate('common:people.studentFallback', { id: student.userId }),
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{translate('course:assignmentSubmissionDetail.group')}</span>
                <select
                  value={selectedTargetGroupId ?? ''}
                  onChange={(e) => setSelectedTargetGroupId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{translate('courseTools:groups.selectGroup')}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.confirmCheck}>
                <input type="checkbox" checked={allowOverfill} onChange={(e) => setAllowOverfill(e.target.checked)} />
                <span>{translate('courseTools:groups.allowOverfill')}</span>
              </label>
              <button
                className={styles.primaryButton}
                disabled={!selectedStudentId || !selectedTargetGroupId || assignStudent.isPending}
              >
                <UserPlus size={16} /> {translate('courseTools:groups.assign')}
              </button>
            </form>
          )}
        </section>
      ) : null}

      {membershipAction ? (
        <section className={styles.confirmBar} role="alertdialog" aria-labelledby="membership-confirm-title">
          <div>
            <strong id="membership-confirm-title">{translate('courseTools:groups.confirmMembership')}</strong>
            <p>
              {translate(
                membershipAction.kind === 'move'
                  ? 'courseTools:groups.moveConfirm'
                  : 'courseTools:groups.removeConfirm',
                {
                  name:
                    membershipAction.displayName ||
                    translate('common:people.userFallback', { id: formatNumber(membershipAction.userId) }),
                  group:
                    groups.find((group) => group.id === membershipAction.targetGroupId)?.name ??
                    translate('course:assignmentSubmissionDetail.group'),
                },
              )}
            </p>
          </div>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => changeMembership.mutate()}
            disabled={changeMembership.isPending}
          >
            {translate('common:actions.confirm')}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => setMembershipAction(null)}>
            {translate('common:actions.cancel')}
          </button>
        </section>
      ) : null}

      {access.canManageGroups ? (
        <section className={styles.dangerCard}>
          <div>
            <Lock size={20} />
            <div>
              <strong>{translate('courseTools:groups.deleteSet')}</strong>
              <p>{translate('courseTools:groups.deleteHelp')}</p>
            </div>
          </div>
          {confirmDeleteId === 'set' ? (
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => deleteItem.mutate({ kind: 'set', id: groupSetId })}
              >
                {translate('assessment:quiz.confirmDelete')}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => setConfirmDeleteId(null)}>
                {translate('common:actions.cancel')}
              </button>
            </div>
          ) : (
            <button type="button" className={styles.dangerButton} onClick={() => setConfirmDeleteId('set')}>
              <Trash2 size={16} /> {translate('courseTools:groups.deleteSet')}
            </button>
          )}
        </section>
      ) : null}
      </fieldset>
    </main>
  );
};

export default GroupSetDetailPage;
