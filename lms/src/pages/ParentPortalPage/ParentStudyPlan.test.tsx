import {render, screen} from '@testing-library/react';
import {expect, it} from 'vitest';
import {ParentStudyPlan} from './ParentStudyPlan';

it('shows each task deadline instead of repeating the checkpoint deadline', () => {
  render(<ParentStudyPlan value={{checkpoints: [{description: 'Checkpoint', dueDate: '2026-09-20', tasks: [{title: 'Early task', dueDate: '2026-09-15'}, {title: 'No deadline task'}]}]}}/>);
  expect(screen.getByText('Deadline Sep 15, 2026')).toBeInTheDocument();
  expect(screen.queryByText('Deadline Sep 20, 2026')).not.toBeInTheDocument();
});
