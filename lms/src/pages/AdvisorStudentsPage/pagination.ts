export type PaginationItem = number | 'ellipsis';

export function advisorPaginationItems(
  currentPage: number,
  pageCount: number,
): PaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({length: pageCount}, (_, index) => index);
  }

  const candidates = new Set([
    0,
    pageCount - 1,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  const pages = [...candidates]
    .filter((page) => page >= 0 && page < pageCount)
    .sort((left, right) => left - right);

  return pages.flatMap((page, index) => {
    const previous = pages[index - 1];
    return previous != null && page - previous > 1 ? ['ellipsis', page] : [page];
  });
}
