import {formatNumber} from '@/i18n/formatting';
import {useTranslation} from 'react-i18next';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Clock3,
  GraduationCap,
  Megaphone,
  RefreshCw,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import type {LoginResponse, NotificationItem, NotificationType, UnreadNotificationCount} from '@/apis';
import {unwrapData} from '@/apis';
import {notificationApiService} from '@/apis/services/notification-api';
import {formatNotificationTime, getNotificationTitle, resolveNotificationPath} from './utils';
import styles from './index.module.scss';

const NOTIFICATION_PAGE_SIZE = 20;

const ICONS: Partial<Record<NotificationType, LucideIcon>> = {
  ANNOUNCEMENT_POSTED: Megaphone,
  ASSIGNMENT_PUBLISHED: ClipboardList,
  ASSIGNMENT_SUBMISSION_RECEIVED: ClipboardList,
  ASSIGNMENT_GRADE_RELEASED: GraduationCap,
  ASSIGNMENT_GRADE_CORRECTED: GraduationCap,
  QUIZ_GRADE_RELEASED: GraduationCap,
  QUIZ_GRADE_CORRECTED: GraduationCap,
  WEEK_PUBLISHED: CalendarDays,
  ASSIGNMENT_SCHEDULE_CHANGED: Clock3,
  QUIZ_PUBLISHED: ClipboardList,
  QUIZ_SCHEDULE_CHANGED: Clock3,
  QUIZ_TIME_LIMIT_CHANGED: Clock3,
  COURSE_EVENT_CREATED: CalendarDays,
  GROUP_MEMBER_ADDED: UsersRound,
  GROUP_MEMBER_REMOVED: UsersRound,
  GROUP_MEMBER_MOVED: UsersRound,
};

const NotificationRow = ({
  notification,
  onOpen,
  identity,
}: {
  notification: NotificationItem;
  identity?: Pick<LoginResponse, 'role' | 'level'>;
  onOpen: (notification: NotificationItem) => void;
}) => {
  const {t: translate} = useTranslation();
  const Icon = ICONS[notification.notificationType] ?? Bell;
  const target = resolveNotificationPath(notification, identity);
  const unread = !notification.readAt;
  const unavailable = notification.availability === 'NO_LONGER_AVAILABLE';

  return (
    <li className={styles.notificationRow} data-unread={unread || undefined}>
      <button
        type="button"
        className={styles.notificationButton}
        onClick={() => onOpen(notification)}
        disabled={!target}
        aria-label={translate(target ? 'notification:open' : 'notification:unavailable', {message: notification.message})}
      >
        <span className={styles.typeIcon} aria-hidden="true"><Icon size={18}/></span>
        <span className={styles.notificationCopy}>
          <span className={styles.rowHeading}>
            <strong>{getNotificationTitle(notification.notificationType)}</strong>
            {unread ? <span className={styles.unreadDot} aria-label={translate("notification:unread")}/> : null}
          </span>
          <span className={styles.message}>{notification.message}</span>
          <span className={styles.metadata}>
            {notification.courseCode ? <span>{notification.courseCode}</span> : null}
            <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
            {unavailable ? <span className={styles.unavailable}>{translate("notification:noLongerAvailable")}</span> : null}
          </span>
        </span>
        {target ? <ChevronRight className={styles.chevron} size={18} aria-hidden="true"/> : null}
      </button>
    </li>
  );
};

const NotificationCenter = ({identity}: {identity?: Pick<LoginResponse, 'role' | 'level'>}) => {
  const {t: translate} = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: ['notification-unread-count'],
    queryFn: async () => unwrapData(
      await notificationApiService.getUnreadCount(),
      'getUnreadNotificationCount'
    ),
    staleTime: 30_000,
    // Keep the global badge fresh even while the inbox panel is closed.
    refetchInterval: 60_000,
  });

  const inboxQuery = useInfiniteQuery({
    queryKey: ['notifications'],
    // The full inbox is comparatively expensive and has no visible consumer
    // until the user opens the panel.
    enabled: isOpen,
    initialPageParam: 1,
    queryFn: async ({pageParam}) => unwrapData(
      await notificationApiService.getNotifications({page: pageParam, size: NOTIFICATION_PAGE_SIZE}),
      'getNotifications'
    ),
    getNextPageParam: lastPage => (
      lastPage.page * lastPage.size < lastPage.total ? lastPage.page + 1 : undefined
    ),
    staleTime: 30_000,
  });

  const notifications = useMemo(
    () => inboxQuery.data?.pages.flatMap(page => page.items) ?? [],
    [inboxQuery.data?.pages]
  );

  const markReadMutation = useMutation({
    mutationFn: (notificationId: number) => notificationApiService.markRead(notificationId),
    onSuccess: async () => {
      // Announcement widgets can surface the same notification read state, so
      // reading from the inbox invalidates both representations.
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['notification-unread-count']}),
        queryClient.invalidateQueries({queryKey: ['notifications']}),
        queryClient.invalidateQueries({queryKey: ['dashboard', 'announcements']}),
      ]);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationApiService.markAllRead(),
    onSuccess: async response => {
      const count = unwrapData(response, 'markAllNotificationsRead');
      queryClient.setQueryData<UnreadNotificationCount>(['notification-unread-count'], count);
      await queryClient.invalidateQueries({queryKey: ['notifications']});
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const openNotification = (notification: NotificationItem) => {
    // Navigation must not wait for a best-effort read receipt. A read failure
    // can be reconciled by the next poll without blocking the destination.
    if (!notification.readAt) markReadMutation.mutate(notification.notificationId);

    const target = resolveNotificationPath(notification, identity);
    if (target) {
      setOpen(false);
      navigate(target);
    }
  };

  const unreadCount = unreadQuery.data?.unreadCount ?? 0;
  const countLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => setOpen(open => !open)}
        aria-label={unreadCount ? translate('notification:unreadCount', {total: formatNumber(unreadCount)}) : translate("navigation:parent.notifications")}
        aria-expanded={isOpen}
        aria-controls="notification-panel"
      >
        <Bell size={21}/>
        {unreadCount > 0 ? <span className={styles.countBadge}>{countLabel}</span> : null}
      </button>

      {isOpen ? (
        <section id="notification-panel" className={styles.panel} aria-label={translate("navigation:parent.notifications")}>
          <header className={styles.panelHeader}>
            <div>
              <p>{translate("notification:inbox")}</p>
              <h2>{translate("navigation:parent.notifications")}</h2>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.markAllButton}
                onClick={() => {
                  if (!markAllMutation.isPending) markAllMutation.mutate();
                }}
                aria-busy={markAllMutation.isPending}
              >
                <CheckCheck size={17}/>
                <span>{markAllMutation.isPending ? translate("notification:marking") : translate("notification:markAllRead")}</span>
              </button>
              <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label={translate("notification:close")}>
                <X size={19}/>
              </button>
            </div>
          </header>

          <div className={styles.panelBody}>
            {inboxQuery.isLoading ? <p className={styles.status}>{translate("notification:loading")}</p> : null}

            {inboxQuery.isError ? (
              <div className={styles.status} role="alert">
                <p>{translate("notification:loadFailed")}</p>
                <button type="button" onClick={() => void inboxQuery.refetch()}>
                  <RefreshCw size={16}/> {' '}{translate("common:actions.tryAgain")}</button>
              </div>
            ) : null}

            {!inboxQuery.isLoading && !inboxQuery.isError && notifications.length === 0 ? (
              <div className={styles.empty}>
                <span aria-hidden="true"><CheckCheck size={24}/></span>
                <strong>{translate("notification:caughtUp")}</strong>
                <p>{translate("notification:emptyHelp")}</p>
              </div>
            ) : null}

            {notifications.length > 0 ? (
              <ul className={styles.notificationList}>
                {notifications.map(notification => (
                  <NotificationRow
                    identity={identity}
                    key={notification.notificationId}
                    notification={notification}
                    onOpen={openNotification}
                  />
                ))}
              </ul>
            ) : null}

            {inboxQuery.hasNextPage ? (
              <button
                type="button"
                className={styles.loadMoreButton}
                onClick={() => void inboxQuery.fetchNextPage()}
                disabled={inboxQuery.isFetchingNextPage}
              >
                {inboxQuery.isFetchingNextPage ? translate("common:feedback.loading") : translate("notification:loadOlder")}
              </button>
            ) : null}

            {markReadMutation.isError || markAllMutation.isError ? (
              <p className={styles.actionError} role="alert">{translate("notification:readFailed")}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default NotificationCenter;
