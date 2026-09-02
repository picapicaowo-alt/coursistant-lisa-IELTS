import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const auth = vi.hoisted(() => ({
  user: {role: 'USER', level: 'STUDENT'} as {
    role: 'USER' | 'TENANT_ADMIN';
    level: 'STUDENT' | 'NOT_APPLICABLE';
  },
}));

vi.mock('@/contexts/RequiredAuthContext', () => ({
  useRequiredAuth: () => ({user: auth.user}),
}));

import {RequireVocabularyStudent} from './RequireVocabularyStudent';

const renderGate = () => render(
  <MemoryRouter initialEntries={['/vocabulary']}>
    <Routes>
      <Route path="/vocabulary" element={<RequireVocabularyStudent><p>Vocabulary content</p></RequireVocabularyStudent>}/>
      <Route path="/admin/intakes" element={<p>Tenant intakes</p>}/>
    </Routes>
  </MemoryRouter>,
);

describe('RequireVocabularyStudent', () => {
  beforeEach(() => {
    auth.user = {role: 'USER', level: 'STUDENT'};
  });

  it('allows a USER student account', () => {
    renderGate();
    expect(screen.getByText('Vocabulary content')).toBeInTheDocument();
  });

  it('rejects a non-USER account even if it carries a stale student level', () => {
    auth.user = {role: 'TENANT_ADMIN', level: 'STUDENT'};
    renderGate();

    expect(screen.queryByText('Vocabulary content')).not.toBeInTheDocument();
    expect(screen.getByText('Tenant intakes')).toBeInTheDocument();
  });
});
