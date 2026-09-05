import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CourseBrowseParams } from "@/apis";
import styles from "./index.module.scss";

export type SystemCourseScope = Pick<CourseBrowseParams, "q" | "tenantId">;
/** System-only browse controls; callers own authorization and query state. */
export function SystemCourseFilters({
  onApply,
}: {
  onApply: (scope: SystemCourseScope) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [tenant, setTenant] = useState("");
  const validTenant =
    !tenant || (Number.isSafeInteger(Number(tenant)) && Number(tenant) > 0);
  return (
    <form
      className={styles.filters}
      onSubmit={(event) => {
        event.preventDefault();
        if (validTenant)
          onApply({
            q: q.trim() || undefined,
            tenantId: tenant ? Number(tenant) : undefined,
          });
      }}
    >
      <label>
        <span>{t("common:admin.searchCourses")}</span>
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("common:admin.courseSearchPlaceholder")}
        />
      </label>
      <label>
        <span>{t("common:admin.tenantId")}</span>
        <input
          type="number"
          min="1"
          step="1"
          value={tenant}
          onChange={(event) => setTenant(event.target.value)}
          placeholder={t("common:admin.defaultScope")}
        />
      </label>
      <button disabled={!validTenant}>{t("common:actions.search")}</button>
    </form>
  );
}
