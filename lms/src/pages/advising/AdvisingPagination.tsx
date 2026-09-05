import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import styles from './advising.module.scss';
import {useTranslation} from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';

export function AdvisingPagination({label, page, total, onPage, size = ADVISOR_PAGE_SIZE}: {
  label: string; page: number; total: number; onPage: (page: number) => void; size?: number;
}) {
  const {t} = useTranslation('common');
  if (total <= size && page === 0) return null;
  return <nav aria-label={label} className={styles.pagination}>
    <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => onPage(page - 1)}>{t('actions.previous')}</button>
    <span>{t('pagination.summary', {page: formatNumber(page + 1), total: formatNumber(total)})}</span>
    <button type="button" className={styles.secondary} disabled={(page + 1) * size >= total} onClick={() => onPage(page + 1)}>{t('actions.next')}</button>
  </nav>;
}
