import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {unwrapData} from '@/apis';
import {dashboardApiService} from '@/apis/services/dashboard-api';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {buildTeachingWork} from './teachingWork';
import styles from './InstructorWorkComponent.module.scss';

const InstructorWorkComponent = () => {
  const {t} = useTranslation();
  const query = useQuery({
    queryKey: ['dashboard', 'teaching', 'grading-queue'],
    queryFn: async () => unwrapData(await dashboardApiService.getGradingQueue(), 'getGradingQueue'),
    staleTime: 60_000,
    retry: 1,
  });
  const {items, hasUnsupportedItems} = buildTeachingWork(query.data ?? []);

  return (
    <section className={styles.widget} aria-labelledby="instructor-work-title">
      <header className={styles.header}>
        <div>
          <h2 id="instructor-work-title">{t('dashboard:teachingWork.title')}</h2>
          <p>{t('dashboard:teachingWork.help')}</p>
        </div>
        <Link to={APP_ROUTE_PATHS.myOperations} className={styles.viewAll}>{t('dashboard:teachingWork.viewAll')}</Link>
      </header>

      {query.isPending ? <p className={styles.status} role="status">{t('dashboard:teachingWork.loading')}</p> : null}
      {query.isError ? (
        <div className={styles.status} role="alert">
          <p>{t('dashboard:teachingWork.failed')}</p>
          <button type="button" className={styles.retry} onClick={() => void query.refetch()}>{t('common:actions.retry')}</button>
        </div>
      ) : null}
      {query.isSuccess && items.length === 0 && !hasUnsupportedItems ? (
        <div className={styles.empty} role="status">
          <p>{t('dashboard:teachingWork.empty')}</p>
          <small>{t('dashboard:teachingWork.emptyHelp')}</small>
        </div>
      ) : null}
      {query.isSuccess ? (
        <>
          {hasUnsupportedItems ? <p className={styles.notice} role="status">{t('dashboard:teachingWork.moreWork')}</p> : null}
          <ul className={styles.list}>
            {items.map(item => (
              <li key={item.href}>
                <Link to={item.href} className={styles.item}>
                  <span className={styles.itemMain}>
                    <small>{item.courseCode} · {t(`dashboard:teachingWork.${item.type}`)}</small>
                    <strong>{item.title || t(`dashboard:teachingWork.${item.type}`)}</strong>
                    <span className={styles.workCounts}>
                      {item.gradingCount > 0 ? <span>{t('dashboard:teachingWork.toGrade', {count: item.gradingCount})}</span> : null}
                      {item.releaseCount > 0 ? <span>{t('dashboard:teachingWork.toRelease', {count: item.releaseCount})}</span> : null}
                    </span>
                  </span>
                  <span className={styles.action}>{t(item.gradingCount > 0 ? 'dashboard:teachingWork.grade' : 'dashboard:teachingWork.release')} <span aria-hidden="true">›</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
};

export default InstructorWorkComponent;
