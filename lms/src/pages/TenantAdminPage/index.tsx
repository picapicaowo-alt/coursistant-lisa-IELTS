import { Link, useSearchParams } from "react-router-dom";
import { FileCheck2, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { TENANT_PATHS } from "@/configs/tenantNavigation";
import { DirectoryPanel } from "./DirectoryPanel";
import { OwnershipPanel } from "./OwnershipPanel";
import { AlertRulesPanel } from "./AlertRulesPanel";
import { AuditPanel } from "./AuditPanel";
import styles from "@/components/TenantWorkspace/workspace.module.scss";

type Section = "directory" | "ownership" | "alerts" | "audit";
const sections: { id: Section; label: string; Icon: typeof UsersRound }[] = [
  { id: "directory", label: "People", Icon: UsersRound },
  { id: "ownership", label: "Course ownership", Icon: FileCheck2 },
  { id: "alerts", label: "Alert rules", Icon: Settings2 },
  { id: "audit", label: "Audit", Icon: ShieldCheck },
];

const TenantAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("section");
  const section: Section = sections.some((item) => item.id === requested)
    ? (requested as Section)
    : "directory";

  return (
    <div className={styles.page}>
      <header className={`${styles.pageHeader} ${styles.governanceHeader}`}>
        <div>
          <h1>Tenant governance</h1>
          <p>
            Manage identity, intake, ownership, assessment templates, alert
            policy, and audit records for your institution.
          </p>
        </div>
        <div className={styles.quickLinks}>
          <Link to={TENANT_PATHS.intakes}>
            <strong>Student intakes</strong>
            <small>Create, assign, and manage admissions</small>
          </Link>
          <Link to={TENANT_PATHS.templates}>
            <strong>Mock templates</strong>
            <small>Create and publish assessment papers</small>
          </Link>
        </div>
      </header>
      <nav className={styles.tabs} aria-label="Tenant governance sections">
        {sections.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            aria-current={section === id ? "page" : undefined}
            className={section === id ? styles.activeTab : ""}
            onClick={() =>
              setSearchParams(id === "directory" ? {} : { section: id })
            }
          >
            {label}
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
