import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe, expect, it, vi} from 'vitest';
import {CheckpointWorkspace} from './CheckpointWorkspace';

const interaction = {
  submissions: {},
  onSubmission: vi.fn(),
  onAction: vi.fn(),
  onUpload: vi.fn(),
  isPending: false,
  onClearError: vi.fn(),
};

describe('CheckpointWorkspace task actions', () => {
  it('offers file replacement as resubmission for a completed task', () => {
    render(<MemoryRouter initialEntries={['/?task=24']}><CheckpointWorkspace
      checkpoint={{id: 3, description: 'Checkpoint', tasks: [{
        id: 24,
        title: 'Final reflection',
        status: 'COMPLETED',
        version: 7,
        submissionFile: {taskId: 24, originalName: 'first.pdf', contentType: 'application/pdf', sizeBytes: 4, previewAvailable: true},
      }]}}
      index={0}
      onBack={vi.fn()}
      {...interaction}
    /></MemoryRouter>);

    expect(screen.getByRole('button', {name: 'Resubmit'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Submit'})).not.toBeInTheDocument();
    const revised = new File(['revised'], 'revised.pdf', {type: 'application/pdf'});
    fireEvent.change(screen.getByLabelText('Replace submission file'), {target: {files: [revised]}});
    expect(interaction.onUpload).toHaveBeenCalledWith(24, 7, revised);
    expect(interaction.onAction).not.toHaveBeenCalled();
  });
});
