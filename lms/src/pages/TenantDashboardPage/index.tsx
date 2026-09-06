import { useTranslation } from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
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
  tenantAuditValue,
  tenantDate,
} from '@/components/TenantWorkspace/presentation';
import {validCount, publishedTemplateCount} from './summary';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './index.module.scss';

const actions = [
  {
    to: TENANT_PATHS.createIntake,
    titleKey: "advising:intake.create",
    descriptionKey: "operations:tenantDashboard.createIntakeHelp",
    Icon: Plus,
  },
  {
    to: TENANT_PATHS.createTemplate,
    titleKey: "operations:tenantDashboard.createExam",
    descriptionKey: "operations:tenantDashboard.createExamHelp",
    Icon: FileCheck2,
  },
  {
    to: TENANT_PATHS.people,
    titleKey: "operations:tenantDashboard.managePeople",
    descriptionKey: "operations:tenantDashboard.managePeopleHelp",
    Icon: UsersRound,
  },
  {
    to: TENANT_PATHS.audit,
    titleKey: "operations:tenantDashboard.audit",
    descriptionKey: "operations:tenantDashboard.auditHelp",
    Icon: ShieldCheck,
  },
];

export default function TenantDashboardPage() {
  const { t: translate } = useTranslation();
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
      labelKey: "operations:tenantDashboard.totalUsers",
      count: validCount(users.data?.total),
      query: users,
      hint: translate("operations:tenantDashboard.accounts"),
      Icon: UsersRound,
      to: TENANT_PATHS.people,
    },
    {
      labelKey: "operations:tenantDashboard.activeStudents",
      count: validCount(students.data?.total),
      query: students,
      hint: translate("operations:tenantDashboard.loginEnabled"),
      Icon: UserRoundCheck,
      to: TENANT_PATHS.people,
    },
    {
      labelKey: "operations:tenantDashboard.openIntakes",
      count: openCount,
      query: open,
      hint:
        unassignedCount === undefined
          ? translate('operations:tenantDashboard.intakeOverview')
          : translate('operations:tenantDashboard.unassignedCount', {count: unassignedCount, number: formatNumber(unassignedCount)}),
      Icon: ClipboardList,
      to: TENANT_PATHS.intakes,
    },
    {
      labelKey: "operations:tenantDashboard.publishedTemplates",
      count:
        templates.data === undefined
          ? undefined
          : publishedTemplateCount(templates.data),
      query: templates,
      hint: translate("operations:tenantDashboard.availableAssignment"),
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
              ? translate('dashboard:welcome', {name: greetingName})
              : translate("operations:tenantDashboard.title")}
          </h1>
          <p>
            {translate("operations:tenantDashboard.description")}</p>
        </div>
      </header>
      <section className={styles.metrics} aria-label={translate("operations:tenantDashboard.summary")}>
        {metrics.map(({labelKey, count, query, hint, Icon, to}) => (
          <article className={styles.metric} key={labelKey}>
            <div className={styles.metricTop}>
              <span className={styles.icon}>
                <Icon size={23} />
              </span>
              <span>{hint}</span>
            </div>
            <Link to={to}>
              {translate(labelKey)}
              <ArrowUpRight size={15} />
            </Link>
            <strong>
              {query.isPending
                ? '…'
                : query.isError || count === undefined
                  ? '—'
                  : formatNumber(count)}
            </strong>
            {query.isError ? (
              <button
                type="button"
                className={ui.textButton}
                onClick={() => void query.refetch()}
              >
                {translate("operations:tenantDashboard.retryMetric")}</button>
            ) : !query.isPending && count === undefined ? (
              <small>{translate("operations:tenantDashboard.countUnavailable")}</small>
            ) : null}
          </article>
        ))}
      </section>
      <div className={styles.overview}>
        <section className={ui.surface}>
          <div className={ui.sectionHeading}>
            <h2>{translate("dashboard:recentActivity")}</h2>
            <Link className={ui.textButton} to={TENANT_PATHS.audit}>
              {translate("common:actions.viewAll")}<ArrowUpRight size={16} />
            </Link>
          </div>
          {audit.isPending ? (
            <p className={ui.status}>{translate("operations:tenantDashboard.loadingActivity")}</p>
          ) : audit.isError ? (
            <div className={ui.errorNotice}>
              {translate("operations:tenantDashboard.activityFailed")}{' '}
              <button
                className={ui.textButton}
                onClick={() => void audit.refetch()}
              >
                {translate("common:actions.tryAgain")}</button>
            </div>
          ) : events.length === 0 ? (
            <p className={ui.empty}>{translate("operations:tenantDashboard.noActivity")}</p>
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
                    secondary={tenantAuditValue(event.action)}
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
            <h2>{translate("operations:tenantDashboard.quickActions")}</h2>
          </div>
          <div className={styles.actions}>
            {actions.map(({to, titleKey, descriptionKey, Icon}) => (
              <Link to={to} key={titleKey}>
                <span className={styles.icon}>
                  <Icon size={21} />
                </span>
                <strong>{translate(titleKey)}</strong>
                <small>{translate(descriptionKey)}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className={`${ui.surface} ${styles.pipeline}`}>
        <div className={ui.sectionHeading}>
          <h2>{translate("operations:tenantDashboard.pipeline")}</h2>
          <Link className={ui.textButton} to={TENANT_PATHS.intakes}>
            {openCount === undefined
              ? translate("operations:tenantDashboard.viewIntakes")
              : translate('operations:tenantDashboard.openCount', {count: openCount, number: formatNumber(openCount)})}
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {!pipelineReady ? (
          <p className={ui.hint}>
            {translate("operations:tenantDashboard.distributionUnavailable")}</p>
        ) : openCount === 0 ? (
          <p className={ui.empty}>
            {translate("operations:tenantDashboard.noOpenIntakes")}</p>
        ) : (
          <>
            <div
              className={styles.pipelineBar}
              aria-label={translate('operations:tenantDashboard.distribution', {assigned: assignedCount === undefined ? '—' : formatNumber(assignedCount), unassigned: unassignedCount === undefined ? '—' : formatNumber(unassignedCount), total: openCount === undefined ? '—' : formatNumber(openCount)})}
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
                {translate('operations:tenantDashboard.assignedCount', {count: assignedCount, number: assignedCount === undefined ? '—' : formatNumber(assignedCount)})}</span>
              <span>
                <i />
                {translate('operations:tenantDashboard.unassignedCount', {count: unassignedCount, number: unassignedCount === undefined ? '—' : formatNumber(unassignedCount)})}</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
