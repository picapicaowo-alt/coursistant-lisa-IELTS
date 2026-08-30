import {describe, expect, it} from 'vitest'
import {recordLabel, runtimeItems, runtimeNumber, templateItems} from './staffRuntime'

describe('mock-exam staff runtime adapters', () => {
  it('accepts paged and direct list responses', () => {
    expect(runtimeItems({content: [{id: 1}]})).toEqual([{id: 1}])
    expect(runtimeItems([{id: 2}, null])).toEqual([{id: 2}])
  })

  it('normalizes the OpenAPI template summary without inventing fields', () => {
    expect(templateItems({items: [{id: 3, title: 'Academic A', versions: [{id: 8, versionNo: 2, status: 'DRAFT', hasReading: true}]}]})).toEqual([
      expect.objectContaining({
        id: 3,
        title: 'Academic A',
        versions: [expect.objectContaining({id: 8, versionNo: 2, status: 'DRAFT', hasReading: true})],
      }),
    ])
  })

  it('uses only finite numeric identifiers and safe display labels', () => {
    expect(runtimeNumber({id: Number.NaN, gradeId: 9}, 'id', 'gradeId')).toBe(9)
    expect(recordLabel({candidateName: 'Candidate A'}, 'Fallback')).toBe('Candidate A')
  })
})
