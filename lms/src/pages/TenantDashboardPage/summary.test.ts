import {describe, expect, it} from 'vitest';
import {publishedTemplateCount, validCount} from './summary';

describe('Tenant dashboard counts', () => {
  it('counts published templates, not versions', () => {
    expect(
      publishedTemplateCount([
        {id: 1, versions: [{status: 'PUBLISHED'}, {status: 'PUBLISHED'}]},
        {id: 2, versions: [{status: 'DRAFT'}]},
      ]),
    ).toBe(1);
  });
  it('does not present a partial page or an unrecognized payload as a total', () => {
    expect(
      publishedTemplateCount({
        items: [{id: 1, publishedVersionId: 3}],
        total: 40,
      }),
    ).toBeUndefined();
    expect(publishedTemplateCount({unexpected: []})).toBeUndefined();
    expect(publishedTemplateCount([{id: 1}])).toBeUndefined();
    expect(publishedTemplateCount([])).toBe(0);
  });
  it('distinguishes unknown counts from zero', () => {
    expect(validCount(undefined)).toBeUndefined();
    expect(validCount(-1)).toBeUndefined();
    expect(validCount(0)).toBe(0);
  });
});
