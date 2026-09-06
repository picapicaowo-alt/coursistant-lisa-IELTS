import React from "react";
import styles from "./ActionButtons.module.scss";
import {useTranslation} from "react-i18next";

export const ActionButtons: React.FC = () => {
  const {t} = useTranslation("detailWorkspace");
  
  return (
    <div className={styles.footerContainer}>
      <div className={styles.errorMessage} id="assignment-error"></div>
      <div className={styles.buttonGroup}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={() => {
          }}
        >
          {t("common:actions.cancel")}
        </button>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => {
          }}
        >
          {t("common:actions.save")}
        </button>
      </div>
    </div>
  );
};
