import {describe, expect, it} from 'vitest';
import {advisorPaginationItems} from './pagination';

describe('advisorPaginationItems', () => {
  it('shows every short page set', () => {
    expect(advisorPaginationItems(0, 4)).toEqual([0, 1, 2, 3]);
  });

  it('keeps the current page and both boundaries in a long set', () => {
    expect(advisorPaginationItems(5, 12)).toEqual([
      0,
      'ellipsis',
      4,
      5,
      6,
      'ellipsis',
      11,
    ]);
  });
});
