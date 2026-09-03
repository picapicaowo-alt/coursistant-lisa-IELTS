import type {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import styles from './index.module.scss';

/** Shared Figma auth composition; field flows remain owned by each auth page. */
export function AuthShell({children}: {children: ReactNode}) {
  const {t} = useTranslation('auth');
  return <main className={styles.page}>
    <section className={styles.formPanel}>
      <div className={styles.formContent}>{children}</div>
      <p className={styles.help}>{t('shell.help')}</p>
    </section>
    <aside className={styles.visualPanel} aria-hidden="true">
      <div className={styles.artwork}>
        <p>{t('shell.promise')}</p>
        <div className={styles.productPreview}>
          <img className={styles.dashboard} src="/icons/figma-auth/dashboard.png" alt=""/>
          <img className={styles.goal} src="/icons/figma-auth/goal.png" alt=""/>
        </div>
      </div>
    </aside>
  </main>;
}

export function AuthHeading({title, subtitle}: {title: string; subtitle: string}) {
  return <header className={styles.heading}>
    <img src="/icons/figma-auth/logo.svg" alt="X-Learn"/>
    <h1>{title}</h1><p>{subtitle}</p>
  </header>;
}
