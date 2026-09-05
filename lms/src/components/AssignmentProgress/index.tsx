import { useTranslation } from 'react-i18next';
import type {CourseProgressResponse} from '@/apis';
import {formatNumber, formatPercent} from '@/i18n/formatting';
import styles from './index.module.scss';

export function AssignmentProgress({
  progress,
  loading = false,
  failed = false,
}: {
  progress?: CourseProgressResponse;
  loading?: boolean;
  failed?: boolean;
}) {
  const { t: translate } = useTranslation();
  const completed = progress?.completedAssignmentCount;
  const total = progress?.totalAssignmentCount;
  const valid =
    Number.isInteger(completed) &&
    Number.isInteger(total) &&
    completed! >= 0 &&
    total! > 0 &&
    completed! <= total!;
  return (
    <div className={styles.progress}>
      <span>
        {translate("common:progress.assignment")}{valid ? (
          <strong>{formatPercent(completed! / total!)}</strong>
        ) : null}
      </span>
      {valid ? (
        <>
          <progress
            aria-label={translate("common:progress.assignment")}
            max={total}
            value={completed}
          />
          <small>
            {translate('common:progress.completed', {completed: formatNumber(completed!), total: formatNumber(total!)})}
          </small>
        </>
      ) : (
        <small>
          {loading
            ? translate("common:progress.loading")
            : failed
              ? translate('common:progress.failed')
              : total === 0
                ? translate('common:progress.noAssignments')
                : translate('common:progress.empty')}
        </small>
      )}
    </div>
  );
}
