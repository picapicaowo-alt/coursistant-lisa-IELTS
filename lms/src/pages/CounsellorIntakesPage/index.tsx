import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import { useTranslation } from 'react-i18next';
import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {assignmentPath, intakePath} from '../CounsellorDashboardPage/presentation';
import {formatPersonName} from '@/utils/personName';

const PAGE_SIZE = 20;

const CounsellorIntakesPage: React.FC = () => {
  const { t: translate } = useTranslation();
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: advisingQueryKeys.counsellorIntakes(page, PAGE_SIZE),
    queryFn: async () => unwrapData(await counsellorApiService.listStudentIntakes(page, PAGE_SIZE), 'listIntakes'),
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>

          <h1>{translate("navigation:unassignedIntakes")}</h1>
          <p className={styles.lede}>{translate("advising:counsellor.queueHelp")}</p>
        </div>
        <Link className={styles.primary} to={APP_ROUTE_PATHS.counsellorIntakesNew}>{translate("advising:counsellor.createStudent")}</Link>
      </header>
      {query.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(query.error, translate('advising:counsellor.intakesFailed'))}</p> : null}
      {query.isPending ? <p className={styles.status}>{translate("advising:counsellor.loadingIntakes")}</p> : null}
      {!query.isPending && !query.isError && items.length === 0 ? <p className={styles.status}>{translate("advising:counsellor.emptyIntakes")}</p> : null}
      <div className={styles.grid}>
        <div className={styles.list}>
          {items.map(intake => (
            <article key={intake.intakeId} className={styles.row}>
              <div className={styles.identity}>
                <strong>{formatPersonName(intake, translate('common:people.studentFallback', {id: formatNumber(intake.studentUserId)}))}</strong>
                <span>{intake.email}</span>
                <small>{translate('advising:counsellor.versionedLabel', {label: statusLabel(intake.studentType), number: formatNumber(intake.intakeVersion)})}</small>
              </div>
              <div className={styles.actions}>
                <Link className={styles.link} to={intakePath(intake.intakeId)}>{translate("common:actions.edit")}</Link>
                <Link className={styles.primary} to={assignmentPath(intake.intakeId)}>{translate("advising:intake.assign")}</Link>
              </div>
            </article>
          ))}
        </div>
        {pageCount > 1 ? (
          <nav className={styles.pagination} aria-label={translate("advising:counsellor.intakePages")}>
            <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => setPage(page - 1)}>{translate("common:actions.previous")}</button>
            <span>{translate('common:pagination.pageOf', {page: formatNumber(page + 1), total: formatNumber(pageCount)})}</span>
            <button type="button" className={styles.secondary} disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>{translate("common:actions.next")}</button>
          </nav>
        ) : null}
      </div>
    </div>
  );
};

export default CounsellorIntakesPage;
