import {useTranslation} from 'react-i18next';
import {useEffect} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, CalendarDays, Clock3, MapPin, Users} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import {courseApiService} from '@/apis/services/course-api';
import {unwrapData} from '@/apis';
import {RichTextEditor} from '@/components/RichTextEditor';
import {formatUtcTimestamp} from '@/utils/datetime';
import styles from './index.module.scss';

export type NotificationSubjectKind = 'announcement' | 'event' | 'group-set' | 'week';

interface Props {
  kind: NotificationSubjectKind;
}

interface SubjectView {
  label: string;
  title: string;
  description?: string | null;
  metadata: Array<{icon: 'calendar' | 'clock' | 'location' | 'users'; label: string}>;
}

const iconFor = (icon: SubjectView['metadata'][number]['icon']) => {
  if (icon === 'calendar') return <CalendarDays size={18}/>;
  if (icon === 'clock') return <Clock3 size={18}/>;
  if (icon === 'location') return <MapPin size={18}/>;
  return <Users size={18}/>;
};

const loadSubject = async (
  kind: NotificationSubjectKind,
  courseId: number,
  subjectId: number,
): Promise<SubjectView> => {
  if (kind === 'announcement') {
    const item = unwrapData(
      await courseApiService.getAnnouncement(courseId, subjectId),
      'getAnnouncement',
    );
    return {
      label: 'Announcement',
      title: item.title,
      description: item.body,
      metadata: [
        {icon: 'users', label: item.authorName},
        {icon: 'calendar', label: formatUtcTimestamp(item.postedAt)},
      ],
    };
  }

  if (kind === 'event') {
    const item = unwrapData(
      await courseApiService.getCourseEvent(courseId, subjectId),
      'getCourseEvent',
    );
    const time = [item.startTime, item.endTime].filter(Boolean).join(' – ');
    return {
      label: 'Course event',
      title: item.name,
      description: item.description,
      metadata: [
        {icon: 'calendar', label: item.date},
        ...(time ? [{icon: 'clock' as const, label: `${time} ${item.timezone}`}] : []),
        ...(item.location ? [{icon: 'location' as const, label: item.location}] : []),
      ],
    };
  }

  if (kind === 'group-set') {
    const item = unwrapData(
      await courseApiService.getGroupSet(courseId, subjectId),
      'getGroupSet',
    );
    const myGroup = item.myGroup
      ? item.groups.find(group => group.id === item.myGroup?.groupId)
      : null;
    return {
      label: 'Course group',
      title: item.name,
      description: myGroup
        ? `You are in ${myGroup.name}.`
        : item.openForSelfService
          ? 'You can select a group for this activity.'
          : 'Your instructor manages membership for this activity.',
      metadata: [
        {icon: 'users', label: myGroup?.name || `${item.groups.length} groups`},
        {icon: 'clock', label: item.locked ? 'Membership locked' : 'Membership open'},
      ],
    };
  }

  const weeks = unwrapData(await courseApiService.getCourseWeeks(courseId), 'getCourseWeeks');
  const week = weeks.find(item => item.id === subjectId);
  if (!week) throw new Error('Week not found');
  return {
    label: 'Course week',
    title: week.title,
    description: week.materials.length
      ? `${week.materials.length} course material${week.materials.length === 1 ? '' : 's'} available.`
      : 'No course materials are available in this week yet.',
    metadata: [
      {icon: 'calendar', label: week.state},
      {icon: 'users', label: `${week.materials.length} materials`},
    ],
  };
};

const NotificationSubjectPage = ({kind}: Props) => {
  const {t: translate} = useTranslation();
  const {courseId: courseIdParam, subjectId: subjectIdParam} = useParams();
  const courseId = Number(courseIdParam);
  const subjectId = Number(subjectIdParam);
  const validParams = Number.isInteger(courseId) && courseId > 0
    && Number.isInteger(subjectId) && subjectId > 0;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notification-subject', kind, courseId, subjectId],
    queryFn: () => loadSubject(kind, courseId, subjectId),
    enabled: validParams,
    retry: 1,
  });

  useEffect(() => {
    if (!query.isSuccess || kind !== 'announcement') return;
    void Promise.all([
      queryClient.invalidateQueries({queryKey: ['dashboard', 'announcements']}),
      queryClient.invalidateQueries({queryKey: ['notification-unread-count']}),
      queryClient.invalidateQueries({queryKey: ['notifications']}),
    ]);
  }, [kind, query.isSuccess, queryClient, courseId, subjectId]);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link to={validParams ? `/course/${courseId}` : '/'} className={styles.backLink} aria-label={translate("course:grades.back")} title={translate("course:grades.back")}>
          <ArrowLeft size={22} aria-hidden="true"/>
        </Link>
        <div>
          <p className={styles.eyebrow}>{query.data?.label || 'Notification'}</p>
          <h1>{query.data?.title || (query.isError ? 'This item is unavailable' : 'Loading…')}</h1>
        </div>
      </div>

      <section className={styles.card} aria-busy={query.isPending}>
        {!validParams || query.isError ? (
          <div role="alert" className={styles.error}>
            <p>This notification destination could not be loaded.</p>
            {validParams ? <button type="button" onClick={() => void query.refetch()}>Try again</button> : null}
          </div>
        ) : query.data ? (
          <>
            {query.data.description ? (
              <div className={styles.description}>
                <RichTextEditor
                  content={query.data.description}
                  disabled
                  displayOnly
                  showToolbar={false}
                  ariaLabel={`${query.data.label} description`}
                />
              </div>
            ) : null}
            <dl className={styles.metadata}>
              {query.data.metadata.map(item => (
                <div key={`${item.icon}-${item.label}`}>
                  <dt aria-hidden="true">{iconFor(item.icon)}</dt>
                  <dd>{item.label}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : <p className={styles.loading}>Loading notification details…</p>}
      </section>
    </main>
  );
};

export default NotificationSubjectPage;
