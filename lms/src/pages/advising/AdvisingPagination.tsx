import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import styles from './advising.module.scss';

export function AdvisingPagination({label, page, total, onPage, size = ADVISOR_PAGE_SIZE}: {
  label: string; page: number; total: number; onPage: (page: number) => void; size?: number;
}) {
  if (total <= size && page === 0) return null;
  return <nav aria-label={label} className={styles.pagination}>
    <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
    <span>Page {page + 1} · {total} results</span>
    <button type="button" className={styles.secondary} disabled={(page + 1) * size >= total} onClick={() => onPage(page + 1)}>Next</button>
  </nav>;
}
