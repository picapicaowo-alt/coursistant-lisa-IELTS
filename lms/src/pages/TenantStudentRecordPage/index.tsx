import { useTranslation } from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {FileText, UserRound, UserRoundCog} from "lucide-react";
import { unwrapData } from "@/apis";
import { ParentLinksPanel } from "@/components/ParentLinksPanel";
import { WorkspaceSection } from "@/components/WorkspaceSection";
import { TenantDrawer } from "@/components/TenantWorkspace/TenantDrawer";
import { IntakeAssignmentEditor } from "@/components/TenantWorkspace/IntakeAssignmentEditor";
import { PersonCell } from "@/components/TenantWorkspace/PersonCell";
import { useTenantPeople } from "@/components/TenantWorkspace/useTenantPeople";
import { readableValue } from "@/components/TenantWorkspace/presentation";
import { adminApiService } from "@/apis/services/admin-api";
import { tenantAdvisingApiService } from "@/apis/services/tenant-advising-api";
import { normalizeManagedUser } from "@/pages/AdminConsolePage/adminDirectory";
import { TENANT_PAGE_SIZE, TENANT_PATHS } from "@/configs/tenantNavigation";
import { advisingErrorMessage } from "../advising/advisingErrors";
import { formatPersonName } from "@/utils/personName";
import feedback from "../advising/advising.module.scss";
import ui from "@/components/TenantWorkspace/workspace.module.scss";
import styles from "./index.module.scss";

function StudentRecord({ id }: { id: number }) {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentPending, setAssignmentPending] = useState(false);
  const [selectedIntakeId, setSelectedIntakeId] = useState<number>();
  const [intakePage, setIntakePage] = useState(0);
  const state: unknown = location.state;
  const candidate =
    state && typeof state === "object" && "returnTo" in state
      ? state.returnTo
      : null;
  const returnTo =
    typeof candidate === "string" &&
    (candidate === TENANT_PATHS.intakes ||
      candidate.startsWith(TENANT_PATHS.intakes + "?"))
      ? candidate
      : TENANT_PATHS.intakes;
  const user = useQuery({
    queryKey: ["tenant", "users", id],
    queryFn: async () =>
      normalizeManagedUser(
        unwrapData(await adminApiService.getTenantUser(id), "tenantUser"),
      ),
    enabled: Number.isInteger(id) && id > 0,
    retry: false,
  });
  const intakes = useQuery({
    queryKey: [
      "tenant",
      "intakes",
      { studentUserId: id, page: intakePage, size: TENANT_PAGE_SIZE },
    ],
    queryFn: async () =>
      unwrapData(
        await tenantAdvisingApiService.listStudentIntakes({
          studentUserId: id,
          page: intakePage,
          size: TENANT_PAGE_SIZE,
        }),
        "tenantStudentIntakes",
      ),
    enabled: Boolean(user.data),
    retry: false,
  });
  // Never substitute another student's record if an integration ignores the filter.
  const matching = (intakes.data?.items ?? []).filter(
    (intake) => intake.studentUserId === id,
  );
  const intake =
    matching.find((item) => item.intakeId === selectedIntakeId) ??
    (intakes.data?.total === 1 && matching.length === 1
      ? matching[0]
      : undefined);
  const people = useTenantPeople([intake?.advisorUserId]);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tenant", "intakes"] }),
      queryClient.invalidateQueries({ queryKey: ["tenant", "intake"] }),
      queryClient.invalidateQueries({ queryKey: ["tenant", "audit-events"] }),
      queryClient.invalidateQueries({ queryKey: ["advisor", "students"] }),
      queryClient.invalidateQueries({ queryKey: ["counsellor"] }),
    ]);
  };
  const readOnly =
    intake?.lifecycleStatus !== "OPEN" ||
    intake.assignmentStatus !== "UNASSIGNED";
  return (
    <div className={ui.page}>
      <header className={ui.pageHeader}>
        <div>
          <h1>{translate("operations:studentRecord.title")}</h1>
          <p>
            {translate("operations:governance.intakes")}{' '}<span aria-hidden="true">›</span>{" "}
            <strong>
              {formatPersonName(user.data, translate('common:roles.STUDENT'))} (#{id})
            </strong>
          </p>
        </div>
        <Link className={ui.secondaryButton} to={returnTo}>

          {translate('common:navigationControls.backToIntakes')}
        </Link>
      </header>
      <div className={styles.grid}>
        <div className={styles.main}>
          <WorkspaceSection appearance="record" title={translate("auth:signup.steps.account")} icon={<UserRound size={22}/> }>
            {user.isPending ? <p role="status">{translate("operations:directory.loadingAccount")}</p> : null}
            {user.isError ? (
              <p className={feedback.error} role="alert">
                {advisingErrorMessage(
                  user.error,
                  translate("operations:studentRecord.accountFailed"),
                )}{" "}
                <button type="button" onClick={() => void user.refetch()}>
                  {translate("operations:studentRecord.retryAccount")}</button>
              </p>
            ) : null}
            {user.isSuccess && !user.data ? (
              <p className={feedback.error} role="alert">
                {translate("operations:studentRecord.invalidAccount")}</p>
            ) : null}
            {user.data ? (
              <dl className={styles.facts}>
                <div>
                  <dt>{translate("common:fields.email")}</dt>
                  <dd>{user.data.email}</dd>
                </div>
                <div>
                  <dt>{translate('common:admin.identity')}</dt>
                  <dd>
                    {[user.data.role, user.data.level]
                      .filter(Boolean)
                      .map(readableValue)
                      .join(" / ")}
                  </dd>
                </div>
                <div>
                  <dt>{translate("common:fields.status")}</dt>
                  <dd>
                    <span className={ui.badge} data-tone={user.data.status}>
                      {readableValue(user.data.status)}
                    </span>
                  </dd>
                </div>
              </dl>
            ) : null}
          </WorkspaceSection>
          <WorkspaceSection
            appearance="record"
            title={translate("advising:studentIntake.title")}
            icon={<FileText size={22}/>}
            bodyClassName={styles.intakeBody}
            meta={
              intake && readOnly ? (
                <span className={feedback.readOnlyBadge}>{translate("courseTools:owner.readOnly")}</span>
              ) : undefined
            }
          >
            {intakes.isPending ? (
              <p role="status">
                {user.data
                  ? translate("advising:studentIntake.loading")
                  : translate("operations:studentRecord.loadAccountFirst")}
              </p>
            ) : null}
            {intakes.isError ? (
              <p className={feedback.error} role="alert">
                {advisingErrorMessage(
                  intakes.error,
                  translate("advising:studentWorkspace.intakeFailed"),
                )}{" "}
                <button type="button" onClick={() => void intakes.refetch()}>
                  {translate("operations:studentRecord.retryIntake")}</button>
              </p>
            ) : null}
            {intakes.isSuccess && matching.length === 0 ? (
              <div className={styles.empty}>
                <strong>{translate("operations:studentRecord.empty")}</strong>
                <p>{translate("operations:studentRecord.emptyHelp")}</p>
              </div>
            ) : null}
            {(intakes.data?.total ?? 0) > 1 ? (
              <div className={ui.form}>
                <label>
                  {translate("operations:studentRecord.chooseIntakeLabel")}<select
                    value={selectedIntakeId ?? ""}
                    onChange={(event) =>
                      setSelectedIntakeId(
                        Number(event.target.value) || undefined,
                      )
                    }
                  >
                    <option value="">{translate("operations:studentRecord.chooseIntake")}</option>
                    {matching.map((item) => (
                      <option key={item.intakeId} value={item.intakeId}>
                        {translate('operations:tenantIntakes.option', {id: formatNumber(item.intakeId), assignment: readableValue(item.assignmentStatus), lifecycle: readableValue(item.lifecycleStatus)})}
                      </option>
                    ))}
                  </select>
                </label>
                {(intakes.data?.total ?? 0) > TENANT_PAGE_SIZE ? (
                  <nav className={ui.actions} aria-label={translate("operations:studentRecord.pages")}>
                    <button
                      type="button"
                      className={ui.secondaryButton}
                      disabled={!intakePage}
                      onClick={() => {
                        setIntakePage((page) => page - 1);
                        setSelectedIntakeId(undefined);
                      }}
                    >
                      {translate("common:actions.previous")}</button>
                    <span>{translate('common:pagination.page', {page: formatNumber(intakePage + 1)})}</span>
                    <button
                      type="button"
                      className={ui.secondaryButton}
                      disabled={
                        (intakePage + 1) * TENANT_PAGE_SIZE >=
                        (intakes.data?.total ?? 0)
                      }
                      onClick={() => {
                        setIntakePage((page) => page + 1);
                        setSelectedIntakeId(undefined);
                      }}
                    >
                      {translate("common:actions.next")}</button>
                  </nav>
                ) : null}
              </div>
            ) : null}
            {intake ? (
              <>
                <dl className={styles.facts}>
                  <div>
                    <dt>{translate("common:fields.name")}</dt>
                    <dd>{formatPersonName(intake, "—")}</dd>
                  </div>
                  <div>
                    <dt>{translate("advising:actionTasks.studentType")}</dt>
                    <dd>{readableValue(intake.studentType)}</dd>
                  </div>
                  <div>
                    <dt>{translate("advising:studentIntake.courseRequest")}</dt>
                    <dd>{intake.courseRequest || "—"}</dd>
                  </div>
                  <div>
                    <dt>{translate("settings:phone")}</dt>
                    <dd>{intake.contactPhone || "—"}</dd>
                  </div>
                  <div>
                    <dt>{translate("advising:studentIntake.background")}</dt>
                    <dd>{intake.basicBackground || "—"}</dd>
                  </div>
                  <div>
                    <dt>{translate("operations:studentRecord.intakeStatus")}</dt>
                    <dd><span className={ui.badge} data-tone={intake.lifecycleStatus}>{readableValue(intake.lifecycleStatus)}</span></dd>
                  </div>
                  <div>
                    <dt>{translate("operations:studentRecord.assignmentStatus")}</dt>
                    <dd><span className={ui.badge} data-tone={intake.assignmentStatus}>{readableValue(intake.assignmentStatus)}</span></dd>
                  </div>
                </dl>
                {!readOnly ? (
                  <Link
                    className={ui.secondaryButton}
                    to={TENANT_PATHS.manageIntake(intake.intakeId)}
                  >
                    {translate("operations:studentRecord.editIntake")}</Link>
                ) : null}
              </>
            ) : null}
          </WorkspaceSection>
        </div>
        <div className={styles.side}>
          {user.data ? (
            <ParentLinksPanel
              scope="tenant"
              subjectId={id}
              presentation="panel"
            />
          ) : null}
          <WorkspaceSection appearance="record" title={translate("advising:studentIntake.assignment")} icon={<UserRoundCog size={22}/> }>
            {intake ? (
              <>
                {intake.advisorUserId ? (
                  <PersonCell
                    person={
                      people.get(intake.advisorUserId) ?? {
                        id: intake.advisorUserId,
                      }
                    }
                    secondary={translate('operations:studentRecord.assignedAdvisor')}
                  />
                ) : (
                  <p className={styles.description}>{translate("operations:studentRecord.noAdvisor")}</p>
                )}
                {intake.lifecycleStatus === "OPEN" ? (
                  <button
                    type="button"
                    className={ui.secondaryButton}
                    aria-haspopup="dialog"
                    onClick={() => setAssignmentOpen(true)}
                  >
                    {intake.assignmentStatus === "ASSIGNED"
                      ? translate("advising:intake.reassign")
                      : translate("advising:intake.assign")}
                  </button>
                ) : (
                  <p className={styles.description}>
                    {translate("operations:studentRecord.cancelledHelp")}</p>
                )}
              </>
            ) : (
              <p className={styles.description}>
                {intakes.isPending
                  ? translate("operations:studentRecord.loadingAssignment")
                  : translate("operations:studentRecord.selectForAssignment")}
              </p>
            )}
          </WorkspaceSection>
        </div>
      </div>
      {assignmentOpen && intake ? (
        <TenantDrawer
          title={
            intake.assignmentStatus === "ASSIGNED"
              ? translate("advising:intake.reassign")
              : translate("advising:intake.assign")
          }
          description={formatPersonName(intake, translate('common:roles.STUDENT'))}
          onClose={() => setAssignmentOpen(false)}
          busy={assignmentPending}
        >
          <IntakeAssignmentEditor
            key={intake.intakeId}
            intake={intake}
            onUpdated={refresh}
            onPendingChange={setAssignmentPending}
          />
        </TenantDrawer>
      ) : null}
    </div>
  );
}

export default function TenantStudentRecordPage() {
  const { studentUserId } = useParams();
  const id = Number(studentUserId);
  return <StudentRecord key={id} id={id} />;
}
