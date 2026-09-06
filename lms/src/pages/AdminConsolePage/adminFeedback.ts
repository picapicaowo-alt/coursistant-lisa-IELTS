import i18n from "@/i18n";
import { getApiErrorMessage, isConflict } from "@/utils/apiError";

/** Context and conflict guidance use the selected locale; raw diagnostics are not UI copy. */
export const getManagedUserCreateError = (error: unknown): string =>
  i18n.t("common:admin.createRejected", {
    detail: getApiErrorMessage(error, i18n.t("common:admin.createFallback")),
    guidance: isConflict(error) ? i18n.t("common:admin.createConflict") : "",
  });
