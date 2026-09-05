import {useTranslation} from 'react-i18next';
import {FormEvent, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, Clock3, Lock, Plus, Users, X} from 'lucide-react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import type {CreateGroupSetPayload} from '@/apis';
import {unwrapData} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {DurationSelect} from '@/components/DurationSelect';
import {EnglishDateTimeInput} from '@/components/EnglishDateInput';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {
  addMinutesToDateTimeValue,
  dateTimeDurationMinutes,
  DEFAULT_DURATION_MINUTES,
  LONG_DURATION_OPTIONS,
  presetDuration,
} from '@/utils/dateTimeRange';
import styles from './index.module.scss';

const defaultDraft = (): CreateGroupSetPayload => ({
  name: '', defaultCapacity: null, joinOpensAt: null, joinClosesAt: null, locked: false,
});

const CourseGroupsPage = () => {
  const {t: translate} = useTranslation();
  const {courseId: rawCourseId} = useParams();
  const courseId = Number(rawCourseId);
  const valid = Number.isInteger(courseId) && courseId > 0;
  const access = useCourseAccess(valid ? courseId : null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CreateGroupSetPayload>(defaultDraft);
  const [message, setMessage] = useState<string | null>(null);

  const groupSetsQuery = useQuery({
    queryKey: ['course-group-sets', courseId],
    queryFn: async () => unwrapData(await courseApiService.listGroupSets(courseId), 'listGroupSets'),
    enabled: valid,
    retry: 1,
  });

  const createGroupSet = useMutation({
    mutationFn: () => courseApiService.createGroupSet(courseId, {
      ...draft,
      name: draft.name.trim(),
      defaultCapacity: draft.defaultCapacity || null,
      joinOpensAt: draft.joinOpensAt || null,
      joinClosesAt: draft.joinClosesAt || null,
    }),
    onSuccess: async response => {
      const created = unwrapData(response, 'createGroupSet');
      await queryClient.invalidateQueries({queryKey: ['course-group-sets', courseId]});
      navigate(`/course/${courseId}/group-sets/${created.id}`);
    },
    onError: () => setMessage('The group set could not be created.'),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    createGroupSet.mutate();
  };
  const rangeDuration = dateTimeDurationMinutes(draft.joinOpensAt ?? '', draft.joinClosesAt ?? '');
  const selectedDuration = presetDuration(rangeDuration, LONG_DURATION_OPTIONS);
  const changeJoinOpensAt = (value: string) => {
    const duration = rangeDuration ?? DEFAULT_DURATION_MINUTES;
    setDraft(current => ({
      ...current,
      joinOpensAt: value || null,
      joinClosesAt: value ? addMinutesToDateTimeValue(value, duration) : current.joinClosesAt,
    }));
  };
  const changeDuration = (minutes: number) => {
    setDraft(current => ({
      ...current,
      joinClosesAt: current.joinOpensAt
        ? addMinutesToDateTimeValue(current.joinOpensAt, minutes)
        : current.joinClosesAt,
    }));
  };
  const invalidWindow = Boolean(draft.joinOpensAt && draft.joinClosesAt && draft.joinClosesAt <= draft.joinOpensAt);
  const groupSets = groupSetsQuery.data ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link to={`/course/${courseId}`} className={styles.backLink} aria-label={translate("course:grades.back")} title={translate("course:grades.back")}><ArrowLeft size={22} aria-hidden="true"/></Link>
        <div className={styles.headerText}><p className={styles.eyebrow}>Course groups</p><h1>Group management</h1></div>
        {access.canManageGroups && !creating ? <button type="button" className={styles.primaryButton} onClick={() => { setDraft(defaultDraft()); setCreating(true); setMessage(null); }}><Plus size={17}/> New group set</button> : null}
      </div>

      {message ? <p className={styles.error} role="status">{message}</p> : null}
      {creating ? (
        <form className={styles.card} onSubmit={submit}>
          <div className={styles.cardHeader}><div><h2>Create group set</h2><p>Choose when students may join and the default capacity for each group.</p></div><button type="button" className={styles.iconButton} aria-label="Close group set form" onClick={() => setCreating(false)}><X size={18}/></button></div>
          <div className={styles.formGrid}>
            <label className={styles.full}><span>Name</span><input required value={draft.name} onChange={event => setDraft(current => ({...current, name: event.target.value}))}/></label>
            <label><span>Default capacity</span><input type="number" min="1" value={draft.defaultCapacity ?? ''} placeholder="No limit" onChange={event => setDraft(current => ({...current, defaultCapacity: event.target.value ? Number(event.target.value) : null}))}/></label>
            <label className={styles.checkbox}><input type="checkbox" checked={Boolean(draft.locked)} onChange={event => setDraft(current => ({...current, locked: event.target.checked}))}/><span>Lock student changes</span></label>
            <label><span>Join opens</span><EnglishDateTimeInput value={draft.joinOpensAt ?? ''} onChangeValue={changeJoinOpensAt}/></label>
            <label><span>Join closes</span><EnglishDateTimeInput value={draft.joinClosesAt ?? ''} onChangeValue={value => setDraft(current => ({...current, joinClosesAt: value || null}))}/></label>
            <DurationSelect minutes={selectedDuration} options={LONG_DURATION_OPTIONS} onChange={changeDuration} disabled={!draft.joinOpensAt}/>
            <span/>
          </div>
          {invalidWindow ? <p className={styles.error} role="alert">Join close time must be later than join open time.</p> : null}
          <div className={styles.footer}><button className={styles.primaryButton} disabled={createGroupSet.isPending || !draft.name.trim() || invalidWindow}>{createGroupSet.isPending ? 'Creating…' : 'Create group set'}</button></div>
        </form>
      ) : null}

      <section className={styles.card}>
        <div className={styles.cardHeader}><div><h2>Group sets</h2><p>Open a group set to manage groups, membership, and student self-service.</p></div></div>
        {!valid || groupSetsQuery.isError ? <div className={styles.inlineError} role="alert"><p>Group sets could not be loaded.</p>{valid ? <button type="button" onClick={() => void groupSetsQuery.refetch()}>Try again</button> : null}</div> : groupSetsQuery.isPending ? <p className={styles.muted}>Loading group sets…</p> : groupSets.length === 0 ? <p className={styles.muted}>No group sets have been created.</p> : (
          <ul className={styles.groupSetList}>
            {groupSets.map(item => {
              const myGroup = item.myGroup ? item.groups.find(group => group.id === item.myGroup?.groupId) : null;
              return <li key={item.id}><Link to={`/course/${courseId}/group-sets/${item.id}`}><span className={styles.groupIcon}><Users size={20}/></span><span className={styles.groupText}><strong>{item.name}</strong><small>{item.groups.length} group{item.groups.length === 1 ? '' : 's'}{myGroup ? ` · You are in ${myGroup.name}` : ''}</small></span><span className={styles.groupState}>{item.locked ? <><Lock size={15}/> Locked</> : item.openForSelfService ? <><Clock3 size={15}/> Student choice open</> : 'Instructor managed'}</span><span aria-hidden="true">→</span></Link></li>;
            })}
          </ul>
        )}
      </section>
    </main>
  );
};

export default CourseGroupsPage;
