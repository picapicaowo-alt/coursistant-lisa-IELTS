import {ApiResponseDataError, unwrapData, type ApiResponse} from '../types/common';

export interface CollectionPage<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

const COLLECTION_PAGE_SIZE = 100;

/** Existing complete-list views need every page after the September contract cutover.
 * Legacy arrays are accepted while Dev rolls forward; malformed pages remain errors.
 * The first response fixes the traversal limit so concurrent inserts cannot extend it forever.
 */
export async function readCollection<T>(
  read: (params: {page: number; size: number}) => Promise<ApiResponse<CollectionPage<T> | T[]>>,
): Promise<ApiResponse<T[]>> {
  const first = await read({page: 0, size: COLLECTION_PAGE_SIZE});
  const data = unwrapData(first, 'collection');
  if (Array.isArray(data)) return {...first, data};
  const validate = (value: CollectionPage<T>, page: number) => {
    if (!value || !Array.isArray(value.items) || value.page !== page ||
      !Number.isSafeInteger(value.size) || value.size <= 0 ||
      !Number.isSafeInteger(value.total) || value.total < 0) {
      throw new ApiResponseDataError('Invalid collection page');
    }
    return value;
  };
  validate(data, 0);
  const items = [...data.items];
  for (let page = 1; page < Math.ceil(data.total / data.size); page++) {
    const next = unwrapData(await read({page, size: data.size}), 'collection page');
    if (Array.isArray(next)) throw new ApiResponseDataError('Collection changed response shape');
    items.push(...validate(next, page).items);
    if (!next.items.length) break;
  }
  return {...first, data: items};
}
