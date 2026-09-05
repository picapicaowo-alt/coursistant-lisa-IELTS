import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TeachingDialog } from "./index";
import styles from "./index.module.scss";

type Confirmation = {
  titleKey: string;
  messageKey: string;
  values?: Record<string, string | number>;
  valueKeys?: Record<string, string>;
};

/** Keep confirmation identity and interpolation data, never a frozen translated message. */
export function useConfirmationDialog(scope?: string | number) {
  const { t } = useTranslation();
  const [request, setRequest] = useState<Confirmation | null>(null);
  const resolve = useRef<((accepted: boolean) => void) | null>(null);
  useEffect(() => {
    // A reused route component must never confirm an action for the previous record.
    resolve.current?.(false);
    resolve.current = null;
    setRequest(null);
  }, [scope]);
  const confirm = useCallback(
    (next: Confirmation) =>
      new Promise<boolean>((accept) => {
        resolve.current?.(false);
        resolve.current = accept;
        setRequest(next);
      }),
    [],
  );
  const finish = (accepted: boolean) => {
    resolve.current?.(accepted);
    resolve.current = null;
    setRequest(null);
  };
  useEffect(
    () => () => {
      resolve.current?.(false);
      resolve.current = null;
    },
    [],
  );
  return {
    confirm,
    dialog: request ? (
      <TeachingDialog title={t(request.titleKey)} onClose={() => finish(false)}>
        <p>{t(request.messageKey, {...request.values, ...Object.fromEntries(Object.entries(request.valueKeys ?? {}).map(([name, key]) => [name, t(key)]))})}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => finish(false)}
          >
            {t("common:actions.cancel")}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => finish(true)}
          >
            {t("common:actions.confirm")}
          </button>
        </div>
      </TeachingDialog>
    ) : null,
  };
}
