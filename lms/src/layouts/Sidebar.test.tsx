import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  user: {role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'} as {
    role: 'USER' | 'TENANT_ADMIN' | 'SYSTEM_ADMIN';
    level: 'STUDENT' | 'INSTRUCTOR' | 'INSTRUCTOR_ADVISOR' | 'COUNSELLOR' | 'ADVISOR' | 'PARENT' | 'NOT_APPLICABLE' | null;
  },
}));

vi.mock('@/contexts/RequiredAuthContext', () => ({
  useRequiredAuth: () => ({user: mocks.user}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

import Sidebar from './Sidebar';

describe('Sidebar role navigation', () => {
  beforeEach(() => {
    mocks.user = {role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'};
  });

  it('shows only authorized tenant-admin business areas', () => {
    render(<MemoryRouter><Sidebar/></MemoryRouter>);

    expect(screen.getAllByRole('link', {name: 'Intakes'}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', {name: 'Governance'}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', {name: 'Mock exams'}).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', {name: 'Courses'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Calendar'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'AI Workplace'})).not.toBeInTheDocument();
  });

  it('keeps system administration out of tenant-only areas', () => {
    mocks.user = {role: 'SYSTEM_ADMIN', level: null};
    render(<MemoryRouter><Sidebar/></MemoryRouter>);

    expect(screen.getAllByRole('link', {name: 'Courses'}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', {name: 'Admin Console'}).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', {name: 'Intakes'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Calendar'})).not.toBeInTheDocument();
  });

  it('does not leak learner links to a counsellor', () => {
    mocks.user = {role: 'USER', level: 'COUNSELLOR'};
    render(<MemoryRouter><Sidebar/></MemoryRouter>);

    expect(screen.getAllByRole('link', {name: 'Dashboard'}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', {name: 'Unassigned intakes'}).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', {name: 'My Courses'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'AI ChatBot'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Exams'})).not.toBeInTheDocument();
  });

  it('does not expose a dashboard link that redirects instructor-advisors away', () => {
    mocks.user = {role: 'USER', level: 'INSTRUCTOR_ADVISOR'};
    const {container} = render(<MemoryRouter><Sidebar/></MemoryRouter>);

    expect(container.querySelector('a[href="/"]')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', {name: 'Advisor dashboard'}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', {name: 'Teaching operations'}).length).toBeGreaterThan(0);
  });
});
