import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {ParentAssignments} from './ParentAssignments';

describe('ParentAssignments', () => {
  it('renders released zero scores and rich feedback without exposing HTML or unreleased grade fields', () => {
    render(<ParentAssignments value={[{
      assignmentId: 10, title: 'Writing practice', courseTitle: 'Academic Writing',
      submissionStatus: 'SUBMITTED', releasedScore: 0, pointsPossible: 100,
      studentVisibleFeedback: '<p>Use a <strong>clear conclusion</strong>.</p>',
      deadline: '2026-09-10T02:00:00', score: 99, feedbackHtml: 'Unreleased feedback',
    }, {assignmentId: 11, title: 'Pending practice', submissionStatus: 'NOT_SUBMITTED'}]}/>);
    expect(screen.getByText('0 / 100')).toBeInTheDocument();
    expect(screen.getByText('clear conclusion').tagName).toBe('STRONG');
    expect(screen.queryByText(/<p>/)).not.toBeInTheDocument();
    expect(screen.queryByText('Unreleased feedback')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-09-10T02:00:00')).not.toBeInTheDocument();
    expect(screen.getByText('Not released')).toBeInTheDocument();
    expect(screen.getByText('Not submitted')).toBeInTheDocument();
  });
});
