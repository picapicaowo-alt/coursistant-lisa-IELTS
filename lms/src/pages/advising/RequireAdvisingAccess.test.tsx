import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  user: {role: 'USER', level: 'ADVISOR'} as {
    role: 'USER' | 'TENANT_ADMIN';
    level: 'ADVISOR' | 'STUDENT' | 'NOT_APPLICABLE';
  },
}));

vi.mock('@/contexts/RequiredAuthContext', () => ({
  useRequiredAuth: () => ({user: mocks.user}),
}));

import {RequireAdvisingAccess} from './RequireAdvisingAccess';

describe('RequireAdvisingAccess', () => {
  beforeEach(() => {
    mocks.user = {role: 'USER', level: 'ADVISOR'};
  });

  it('allows a USER Advisor into Advisor routes', () => {
    render(
      <MemoryRouter>
        <RequireAdvisingAccess gate="advisor"><div>Advisor students</div></RequireAdvisingAccess>
      </MemoryRouter>,
    );
    expect(screen.getByText('Advisor students')).toBeInTheDocument();
  });

  it('rejects a tenant admin even if a malformed identity carries Advisor level', () => {
    mocks.user = {role: 'TENANT_ADMIN', level: 'ADVISOR'};
    render(
      <MemoryRouter initialEntries={['/advisor/students']}>
        <Routes>
          <Route path="/advisor/students" element={<RequireAdvisingAccess gate="advisor"><div>Advisor students</div></RequireAdvisingAccess>}/>
          <Route path="/admin/intakes" element={<div>Tenant intake home</div>}/>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Tenant intake home')).toBeInTheDocument();
    expect(screen.queryByText('Advisor students')).not.toBeInTheDocument();
  });
});
