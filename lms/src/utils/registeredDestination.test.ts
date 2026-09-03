import {describe, expect, it} from 'vitest';
import {registeredDestination} from './registeredDestination';
import {APP_ROUTE_PATHS, REGISTERED_ROUTE_PATTERNS} from '@/configs/routePaths';

describe('registered backend destinations', () => {
  it.each([
    ['/courses/341/assignments/12/grading', '/course/341/assignments/12/grading'],
    ['/advisor/students/7/study-plan?checkpointId=2#tasks', '/advisor/students/7/study-plan?checkpointId=2#tasks'],
    ['/course/341/operations', '/course/341/operations'],
  ])('maps %s to a registered page', (input, expected) => expect(registeredDestination(input)).toBe(expected));
  it.each(['//external.test/x', '/\\external.test', 'https://external.test', '/teacher/assignments/1/grade', '/course/1/not-registered', '/course/1\n', 'javascript:alert(1)'])('rejects unsupported destination %s', input => expect(registeredDestination(input)).toBeNull());
  it('registers every workspace tab and includes no wildcard fallback', () => {
    expect(REGISTERED_ROUTE_PATTERNS).not.toContain('*');
    for (const path of Object.values(APP_ROUTE_PATHS)) expect(registeredDestination(path.replace(/:[^/]+/g, '1'))).not.toBeNull();
  });
});
