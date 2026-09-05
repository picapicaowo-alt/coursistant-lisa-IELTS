import { useTranslation } from 'react-i18next';
import { type ReactNode, useId, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import styles from "./workspace.module.scss";

/** Secondary filters stay inline on desktop and explicitly expandable on mobile. */
export const ResponsiveFilters = ({ children }: { children: ReactNode }) => {
  const { t: translate } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={`${styles.secondaryButton} ${styles.mobileFilterToggle}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={16} />
        {open ? translate("common:filters.hide") : translate("common:filters.more")}
      </button>
      <div id={id} className={styles.secondaryFilters} data-open={open}>
        {children}
      </div>
    </>
  );
};
