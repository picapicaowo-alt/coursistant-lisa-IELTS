import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  user: {role: 'SYSTEM_ADMIN', level: null} as {
    role: 'USER' | 'TENANT_ADMIN' | 'SYSTEM_ADMIN' | 'ADMIN';
    level: 'STUDENT' | 'COUNSELLOR' | 'ADVISOR' | 'NOT_APPLICABLE' | null;
  },
}));

vi.mock('@/contexts/RequiredAuthContext', () => ({
  useRequiredAuth: () => ({user: mocks.user}),
}));

import {RequireRoleAccess} from './index';

describe('RequireRoleAccess', () => {
  beforeEach(() => {
    mocks.user = {role: 'SYSTEM_ADMIN', level: null};
  });

  it('allows a system admin into the system course catalogue', () => {
    render(
      <MemoryRouter initialEntries={['/course']}>
        <Routes>
          <Route path="/course" element={<RequireRoleAccess capability="courses"><div>Course catalogue</div></RequireRoleAccess>}/>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Course catalogue')).toBeInTheDocument();
  });

  it('redirects a tenant admin before a forbidden course page mounts', () => {
    mocks.user = {role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'};
    render(
      <MemoryRouter initialEntries={['/course']}>
        <Routes>
          <Route path="/course" element={<RequireRoleAccess capability="courses"><div>Course catalogue</div></RequireRoleAccess>}/>
          <Route path="/admin/intakes" element={<div>Tenant intake home</div>}/>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Tenant intake home')).toBeInTheDocument();
    expect(screen.queryByText('Course catalogue')).not.toBeInTheDocument();
  });

  it('does not trust a USER-only level on a non-USER identity', () => {
    mocks.user = {role: 'TENANT_ADMIN', level: 'STUDENT'};
    render(
      <MemoryRouter initialEntries={['/aibot']}>
        <Routes>
          <Route path="/aibot" element={<RequireRoleAccess capability="aiWorkspace"><div>AI workspace</div></RequireRoleAccess>}/>
          <Route path="/admin/intakes" element={<div>Tenant intake home</div>}/>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Tenant intake home')).toBeInTheDocument();
    expect(screen.queryByText('AI workspace')).not.toBeInTheDocument();
  });

  it('keeps a tenant admin out of the generic profile route', () => {
    mocks.user = {role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'};
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<RequireRoleAccess capability="selfProfile"><div>Generic profile</div></RequireRoleAccess>}/>
          <Route path="/admin/intakes" element={<div>Tenant intake home</div>}/>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Tenant intake home')).toBeInTheDocument();
    expect(screen.queryByText('Generic profile')).not.toBeInTheDocument();
  });
});
