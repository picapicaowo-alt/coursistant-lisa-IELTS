import {describe, expect, it} from 'vitest';

const workbenchSources = import.meta.glob([
  '/src/pages/AdminConsolePage/**/*.{ts,tsx}',
  '/src/pages/AdvisorOperationsPage/**/*.{ts,tsx}',
  '/src/pages/AdvisorStudentWorkspacePage/**/*.{ts,tsx}',
  '/src/pages/CourseOperationsPage/**/*.{ts,tsx}',
  '/src/pages/MyOperationsPage/**/*.{ts,tsx}',
  '/src/pages/ParentPortalPage/**/*.{ts,tsx}',
], {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const productionSources = Object.entries(workbenchSources)
  .filter(([path]) => !path.includes('.test.'));

describe('frontend integration boundaries', () => {
  it('keeps deployment hosts and fixture identities out of workbench code', () => {
    const forbidden = [
      /https?:\/\//,
      /localhost/i,
      /(?:dev|prod)\.xlearnedu\.com/i,
      /[\w.+-]+@example\.com/i,
    ];

    for (const [path, source] of productionSources) {
      for (const pattern of forbidden) {
        expect(source, `${path} contains ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('keeps network paths in API services instead of page components', () => {
    for (const [path, source] of productionSources) {
      expect(source, `${path} contains an inline API route`).not.toMatch(/["'`]\/(?:api|v\d+)\//);
    }
  });

  it('does not restore the raw contract field viewer', () => {
    for (const [path, source] of productionSources) {
      expect(source, `${path} imports the retired contract viewer`).not.toContain('ContractDataView');
    }
  });
});
