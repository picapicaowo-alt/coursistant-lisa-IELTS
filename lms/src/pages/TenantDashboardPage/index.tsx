import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
  ArrowUpRight,
  ClipboardList,
  FileCheck2,
  Plus,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import {unwrapData} from '@/apis';
import {adminApiService} from '@/apis/services/admin-api';
import {tenantAdvisingApiService} from '@/apis/services/tenant-advising-api';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {TENANT_PATHS} from '@/configs/tenantNavigation';
import {PersonCell} from '@/components/TenantWorkspace/PersonCell';
import {useTenantPeople} from '@/components/TenantWorkspace/useTenantPeople';
import {
  readableValue,
  tenantDate,
} from '@/components/TenantWorkspace/presentation';
import {validCount, publishedTemplateCount} from './summary';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './index.module.scss';

const actions = [
  {
    to: TENANT_PATHS.createIntake,
    title: 'Create student intake',
    description: 'Start a new intake process',
    Icon: Plus,
  },
  {
    to: TENANT_PATHS.createTemplate,
    title: 'Create mock exam',
    description: 'Draft a new mock test paper',
    Icon: FileCheck2,
  },
  {
    to: TENANT_PATHS.people,
    title: 'Manage people',
    description: 'Manage accounts and identities',
    Icon: UsersRound,
  },
  {
    to: TENANT_PATHS.audit,
    title: 'View audit log',
    description: 'Review governance changes',
    Icon: ShieldCheck,
  },
];

export default function TenantDashboardPage() {
  const {user} = useRequiredAuth();
  const users = useQuery({
    queryKey: ['tenant', 'users', 'count'],
    queryFn: async () =>
      unwrapData(
        await adminApiService.listTenantUsers({page: 0, size: 1}),
        'tenantUserCount',
      ),
    retry: false,
  });
  const students = useQuery({
    queryKey: ['tenant', 'users', 'active-student-count'],
    queryFn: async () =>
      unwrapData(
        await adminApiService.listTenantUsers({
          role: 'USER',
          level: 'STUDENT',
          status: 'ACTIVE',
          page: 0,
          size: 1,
        }),
        'tenantStudentCount',
      ),
    retry: false,
  });
  const open = useQuery({
    queryKey: ['tenant', 'intakes', 'open-count'],
    queryFn: async () =>
      unwrapData(
        await tenantAdvisingApiService.listStudentIntakes({
          lifecycleStatus: 'OPEN',
          page: 0,
          size: 1,
        }),
        'tenantOpenIntakeCount',
      ),
    retry: false,
  });
  const unassigned = useQuery({
    queryKey: ['tenant', 'intakes', 'unassigned-count'],
    queryFn: async () =>
      unwrapData(
        await tenantAdvisingApiService.listStudentIntakes({
          lifecycleStatus: 'OPEN',
          assignmentStatus: 'UNASSIGNED',
          page: 0,
          size: 1,
        }),
        'tenantUnassignedCount',
      ),
    retry: false,
  });
  const templates = useQuery({
    queryKey: ['mock-exams', 'tenant'],
    queryFn: async () =>
      unwrapData(
        await mockExamApiService.listTenantTemplates(),
        'tenantMockExamTemplates',
      ),
    retry: false,
  });
  const audit = useQuery({
    queryKey: ['tenant', 'audit-events', 'recent'],
    queryFn: async () =>
      unwrapData(
        await adminApiService.listTenantAuditEvents({page: 0, size: 5}),
        'tenantRecentActivity',
      ),
    retry: false,
  });
  const events = audit.data?.items ?? [];
  const people = useTenantPeople([
    user.id,
    ...events.map((event) => event.actorUserId),
  ]);
  const greetingName = people.get(user.id)?.firstName || user.name;
  const openCount = validCount(open.data?.total);
  const unassignedCount = validCount(unassigned.data?.total);
  const pipelineReady =
    openCount !== undefined &&
    unassignedCount !== undefined &&
    unassignedCount <= openCount;
  const assignedCount = pipelineReady ? openCount - unassignedCount : undefined;
  const metrics = [
    {
      label: 'Total users',
      count: validCount(users.data?.total),
      query: users,
      hint: 'Tenant accounts',
      Icon: UsersRound,
      to: TENANT_PATHS.people,
    },
    {
      label: 'Active student accounts',
      count: validCount(students.data?.total),
      query: students,
      hint: 'Login enabled',
      Icon: UserRoundCheck,
      to: TENANT_PATHS.people,
    },
    {
      label: 'Open intakes',
      count: openCount,
      query: open,
      hint:
        unassignedCount === undefined
          ? 'Intake overview'
          : `${unassignedCount} unassigned`,
      Icon: ClipboardList,
      to: TENANT_PATHS.intakes,
    },
    {
      label: 'Published templates',
      count:
        templates.data === undefined
          ? undefined
          : publishedTemplateCount(templates.data),
      query: templates,
      hint: 'Available for assignment',
      Icon: FileCheck2,
      to: TENANT_PATHS.templates,
    },
  ];
  return (
    <div className={ui.page}>
      <header className={ui.pageHeader}>
        <div>
          <h1>
            {greetingName
              ? `Welcome back, ${greetingName}`
              : 'Administration overview'}
          </h1>
          <p>
            Your institution’s accounts, intakes, and assessments at a glance.
          </p>
        </div>
      </header>
      <section className={styles.metrics} aria-label="Administration summary">
        {metrics.map(({label, count, query, hint, Icon, to}) => (
          <article className={styles.metric} key={label}>
            <div className={styles.metricTop}>
              <span className={styles.icon}>
                <Icon size={23} />
              </span>
              <span>{hint}</span>
            </div>
            <Link to={to}>
              {label}
              <ArrowUpRight size={15} />
            </Link>
            <strong>
              {query.isPending
                ? '…'
                : query.isError || count === undefined
                  ? '—'
                  : count.toLocaleString('en-US')}
            </strong>
            {query.isError ? (
              <button
                type="button"
                className={ui.textButton}
                onClick={() => void query.refetch()}
              >
                Unable to load · Retry
              </button>
            ) : !query.isPending && count === undefined ? (
              <small>Count unavailable</small>
            ) : null}
          </article>
        ))}
      </section>
      <div className={styles.overview}>
        <section className={ui.surface}>
          <div className={ui.sectionHeading}>
            <h2>Recent activity</h2>
            <Link className={ui.textButton} to={TENANT_PATHS.audit}>
              View all
              <ArrowUpRight size={16} />
            </Link>
          </div>
          {audit.isPending ? (
            <p className={ui.status}>Loading governance events…</p>
          ) : audit.isError ? (
            <div className={ui.errorNotice}>
              Activity could not be loaded.{' '}
              <button
                className={ui.textButton}
                onClick={() => void audit.refetch()}
              >
                Try again
              </button>
            </div>
          ) : events.length === 0 ? (
            <p className={ui.empty}>No governance activity yet.</p>
          ) : (
            <ol className={styles.activity}>
              {events.map((event) => (
                <li key={event.eventId}>
                  <PersonCell
                    person={
                      people.get(event.actorUserId ?? -1) ?? {
                        id: event.actorUserId,
                      }
                    }
                    secondary={readableValue(event.action)}
                  />
                  <time dateTime={event.createdAt}>
                    {tenantDate(event.createdAt, true)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className={ui.surface}>
          <div className={ui.sectionHeading}>
            <h2>Quick actions</h2>
          </div>
          <div className={styles.actions}>
            {actions.map(({to, title, description, Icon}) => (
              <Link to={to} key={title}>
                <span className={styles.icon}>
                  <Icon size={21} />
                </span>
                <strong>{title}</strong>
                <small>{description}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className={`${ui.surface} ${styles.pipeline}`}>
        <div className={ui.sectionHeading}>
          <h2>Intake pipeline</h2>
          <Link className={ui.textButton} to={TENANT_PATHS.intakes}>
            {openCount === undefined
              ? 'View intakes'
              : `${openCount} open intakes`}
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {!pipelineReady ? (
          <p className={ui.hint}>
            Distribution is unavailable until both intake counts are loaded.
          </p>
        ) : openCount === 0 ? (
          <p className={ui.empty}>
            No open intakes. Create an intake to begin.
          </p>
        ) : (
          <>
            <div
              className={styles.pipelineBar}
              aria-label={`${assignedCount} assigned and ${unassignedCount} unassigned out of ${openCount} open intakes`}
            >
              <span style={{flexGrow: assignedCount}} data-part="assigned" />
              <span
                style={{flexGrow: unassignedCount}}
                data-part="unassigned"
              />
            </div>
            <div className={styles.legend}>
              <span>
                <i />
                {assignedCount} Assigned
              </span>
              <span>
                <i />
                {unassignedCount} Unassigned
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
