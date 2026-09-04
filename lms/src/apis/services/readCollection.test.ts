import {describe, expect, it, vi} from 'vitest';
import type {ApiResponse} from '../types/common';
import {readCollection} from './readCollection';
const response = <T>(data: T): ApiResponse<T> => ({data, status: 200, code: 'SUCCESS', message: '', timestamp: ''});
describe('September collection cutover', () => {
  it('reads every server page, preserving order and the server page size', async () => {
    const read = vi.fn().mockResolvedValueOnce(response({items: [1, 2], total: 3, size: 2, page: 0})).mockResolvedValueOnce(response({items: [3], total: 3, size: 2, page: 1}));
    expect((await readCollection(read)).data).toEqual([1, 2, 3]);
    expect(read).toHaveBeenNthCalledWith(2, {page: 1, size: 2});
  });
  it('accepts the pre-cutover array without guessing more pages', async () => {
    const read = vi.fn().mockResolvedValue(response([1]));
    expect((await readCollection(read)).data).toEqual([1]);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('does not turn missing or malformed pages into empty success', async () => {
    for (const data of [null, {}, {items: [], page: 0, size: 0, total: 1}]) {
      await expect(readCollection(vi.fn().mockResolvedValue(response(data)))).rejects.toThrow();
    }
  });
  it('rejects repeated pages rather than duplicating records', async () => {
    await expect(readCollection(vi.fn().mockResolvedValue(response({items: [1], page: 0, size: 1, total: 2})))).rejects.toThrow();
  });
});
