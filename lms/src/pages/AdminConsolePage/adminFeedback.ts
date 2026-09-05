import i18n from "@/i18n";
import { getApiErrorMessage, isConflict } from "@/utils/apiError";

/** Keep server-provided reasons intact; local guidance uses the selected locale. */
export const getManagedUserCreateError = (error: unknown): string =>
  i18n.t("common:admin.createRejected", {
    detail: getApiErrorMessage(error, i18n.t("common:admin.createFallback")),
    guidance: isConflict(error) ? i18n.t("common:admin.createConflict") : "",
  });
