import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from "react-router-dom";
import { FileCheck2, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { TENANT_PATHS } from "@/configs/tenantNavigation";
import { DirectoryPanel } from "./DirectoryPanel";
import { OwnershipPanel } from "./OwnershipPanel";
import { AlertRulesPanel } from "./AlertRulesPanel";
import { AuditPanel } from "./AuditPanel";
import styles from "@/components/TenantWorkspace/workspace.module.scss";

type Section = "directory" | "ownership" | "alerts" | "audit";
const sections: { id: Section; labelKey: string; Icon: typeof UsersRound }[] = [
  { id: "directory", labelKey: "operations:governance.people", Icon: UsersRound },
  { id: "ownership", labelKey: "operations:governance.ownership", Icon: FileCheck2 },
  { id: "alerts", labelKey: "operations:governance.alerts", Icon: Settings2 },
  { id: "audit", labelKey: "operations:governance.audit", Icon: ShieldCheck },
];

const TenantAdminPage = () => {
  const { t: translate } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("section");
  const section: Section = sections.some((item) => item.id === requested)
    ? (requested as Section)
    : "directory";

  return (
    <div className={styles.page}>
      <header className={`${styles.pageHeader} ${styles.governanceHeader}`}>
        <div>
          <h1>{translate("navigation:tenantGovernance")}</h1>
          <p>
            {translate("operations:governance.description")}</p>
        </div>
        <div className={styles.quickLinks}>
          <Link to={TENANT_PATHS.intakes}>
            <strong>{translate("operations:governance.intakes")}</strong>
            <small>{translate("operations:governance.intakesHelp")}</small>
          </Link>
          <Link to={TENANT_PATHS.templates}>
            <strong>{translate("operations:governance.templates")}</strong>
            <small>{translate("operations:governance.templatesHelp")}</small>
          </Link>
        </div>
      </header>
      <nav className={styles.tabs} aria-label={translate("operations:governance.sections")}>
        {sections.map(({ id, labelKey }) => (
          <button
            type="button"
            key={id}
            aria-current={section === id ? "page" : undefined}
            className={section === id ? styles.activeTab : ""}
            onClick={() =>
              setSearchParams(id === "directory" ? {} : { section: id })
            }
          >
            {translate(labelKey)}
          </button>
        ))}
      </nav>
      {section === "directory" ? (
        <DirectoryPanel
          createRequested={searchParams.get("action") === "create"}
          onCreateHandled={() => setSearchParams({}, { replace: true })}
        />
      ) : null}
      {section === "ownership" ? <OwnershipPanel /> : null}
      {section === "alerts" ? <AlertRulesPanel /> : null}
      {section === "audit" ? <AuditPanel /> : null}
    </div>
  );
};

export default TenantAdminPage;
