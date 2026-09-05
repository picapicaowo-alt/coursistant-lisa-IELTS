import {LocalizedError} from '@/i18n/errors';
import { useTranslation } from 'react-i18next';
import type {TFunction} from 'i18next';
import {useEffect} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, CalendarDays, Clock3, MapPin, Users} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import {courseApiService} from '@/apis/services/course-api';
import {unwrapData} from '@/apis';
import {RichTextEditor} from '@/components/RichTextEditor';
import {formatUtcTimestamp} from '@/utils/datetime';
import {formatClockTime, formatDateValue, formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
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
) => {
  if (kind === 'announcement') {
    const item = unwrapData(
      await courseApiService.getAnnouncement(courseId, subjectId),
      'getAnnouncement',
    );
    return {kind, item} as const;
  }

  if (kind === 'event') {
    const item = unwrapData(
      await courseApiService.getCourseEvent(courseId, subjectId),
      'getCourseEvent',
    );
    return {kind, item} as const;
  }

  if (kind === 'group-set') {
    const item = unwrapData(await courseApiService.getGroupSet(courseId, subjectId), 'getGroupSet');
    return {kind, item} as const;
  }

  const weeks = unwrapData(await courseApiService.getCourseWeeks(courseId), 'getCourseWeeks');
  const item = weeks.find(week => week.id === subjectId);
  if (!item) throw new LocalizedError('courseTools:subject.weekMissing');
  return {kind, item} as const;
};

// Keep server data in the query cache. Translate and format only during rendering,
// so changing locale neither freezes metadata nor causes another authenticated read.
const presentSubject = (subject: Awaited<ReturnType<typeof loadSubject>>, translate: TFunction): SubjectView => {
  if (subject.kind === 'announcement') {
    const {item} = subject;
    return {
      label: translate('courseTools:subject.announcement'),
      title: item.title,
      description: item.body,
      metadata: [
        {icon: 'users', label: item.authorName},
        {icon: 'calendar', label: formatUtcTimestamp(item.postedAt)},
      ],
    };
  }
  if (subject.kind === 'event') {
    const {item} = subject;
    const time = [item.startTime, item.endTime].filter((value): value is string => Boolean(value)).map(value => formatClockTime(value)).join(' – ');
    return {
      label: translate('calendar:kinds.Event'),
      title: item.name,
      description: item.description,
      metadata: [
        {icon: 'calendar', label: formatDateValue(item.date)},
        ...(time ? [{icon: 'clock' as const, label: `${time} ${item.timezone}`}] : []),
        ...(item.location ? [{icon: 'location' as const, label: item.location}] : []),
      ],
    };
  }

  if (subject.kind === 'group-set') {
    const {item} = subject;
    const myGroup = item.myGroup
      ? item.groups.find(group => group.id === item.myGroup?.groupId)
      : null;
    return {
      label: translate('courseTools:subject.group'),
      title: item.name,
      description: myGroup
        ? translate('courseTools:subject.inGroup', {group: myGroup.name})
        : item.openForSelfService
          ? translate('courseTools:subject.canSelect')
          : translate('courseTools:subject.managed'),
      metadata: [
        {icon: 'users', label: myGroup?.name || translate('courseTools:subject.groupCount', {count: item.groups.length, number: formatNumber(item.groups.length)})},
        {icon: 'clock', label: translate(item.locked ? 'courseTools:subject.locked' : 'courseTools:subject.open')},
      ],
    };
  }

  const {item: week} = subject;
  return {
    label: translate('courseTools:subject.week'),
    title: week.title,
    description: week.materials.length
      ? translate('courseTools:subject.materialsAvailable', {count: week.materials.length, number: formatNumber(week.materials.length)})
      : translate('courseTools:subject.noMaterials'),
    metadata: [
      {icon: 'calendar', label: statusLabel(week.state)},
      {icon: 'users', label: translate('courseTools:subject.materialCount', {count: week.materials.length, number: formatNumber(week.materials.length)})},
    ],
  };
};

const NotificationSubjectPage = ({kind}: Props) => {
  const { t: translate } = useTranslation();
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

  const view = query.data ? presentSubject(query.data, translate) : undefined;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link to={validParams ? `/course/${courseId}` : '/'} className={styles.backLink} aria-label={translate("course:grades.back")} title={translate("course:grades.back")}>
          <ArrowLeft size={22} aria-hidden="true"/>
        </Link>
        <div>
          <p className={styles.eyebrow}>{view?.label || translate("courseTools:subject.notification")}</p>
          <h1>{view?.title || (!validParams || query.isError ? translate("courseTools:subject.unavailable") : translate('common:feedback.loading'))}</h1>
        </div>
      </div>

      <section className={styles.card} aria-busy={validParams && query.isPending}>
        {!validParams || query.isError ? (
          <div role="alert" className={styles.error}>
            <p>{translate("courseTools:subject.loadFailed")}</p>
            {validParams ? <button type="button" onClick={() => void query.refetch()}>{translate("common:actions.tryAgain")}</button> : null}
          </div>
        ) : view ? (
          <>
            {view.description ? (
              <div className={styles.description}>
                <RichTextEditor
                  content={view.description}
                  disabled
                  displayOnly
                  showToolbar={false}
                  ariaLabel={translate('courseTools:subject.description', {label: view.label})}
                />
              </div>
            ) : null}
            <dl className={styles.metadata}>
              {view.metadata.map(item => (
                <div key={item.icon}>
                  <dt aria-hidden="true">{iconFor(item.icon)}</dt>
                  <dd>{item.label}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : <p className={styles.loading}>{translate("courseTools:subject.loading")}</p>}
      </section>
    </main>
  );
};

export default NotificationSubjectPage;
