import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@testing-library/jest-dom';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const agentApi = vi.hoisted(() => ({
  chat: vi.fn(),
  decideDeadlineChange: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  user: {id: 42, name: 'Teacher', role: 'USER', level: 'INSTRUCTOR'},
}));

vi.mock('@/apis/services/ai-agent-api', () => ({aiAgentApiService: agentApi}));
vi.mock('@/contexts/RequiredAuthContext', () => ({
  useRequiredAuth: () => ({user: auth.user}),
}));

import WorkflowPanel from './WorkflowPanel';

const pasteWorkflowText = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  await user.click(screen.getByLabelText('Tell Workflow what to do'));
  await user.paste(text);
};

describe('WorkflowPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = {id: 42, name: 'Teacher', role: 'USER', level: 'INSTRUCTOR'};
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('keeps deadline changes out of the student workflow', async () => {
    auth.user = {id: 43, name: 'Student', role: 'USER', level: 'STUDENT'};
    agentApi.chat.mockResolvedValue({
      reply: 'Allow this deadline change?',
      pendingAction: {actionId: 'action-student', type: 'ASSIGNMENT_DEADLINE_CHANGE'},
    });
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    expect(screen.queryByRole('button', {name: 'Help me change an assignment deadline.'}))
      .not.toBeInTheDocument();
    expect(screen.getByText('Student workflow')).toBeInTheDocument();

    await pasteWorkflowText(user, 'Change the assignment deadline');
    await user.click(screen.getByRole('button', {name: 'Run'}));

    await waitFor(() => expect(agentApi.chat).toHaveBeenCalledWith({
      message: 'Change the assignment deadline',
      role: 'STUDENT',
    }));
    expect(await screen.findByText('Students can view assignment deadlines, but only instructors can change them.'))
      .toBeInTheDocument();
    expect(screen.queryByRole('dialog', {name: 'Deadline change approval'})).not.toBeInTheDocument();
    expect(agentApi.decideDeadlineChange).not.toHaveBeenCalled();
  });

  it('sends instructor prompts to the AI Agent', async () => {
    agentApi.chat.mockResolvedValue({reply: 'You teach two courses.', pendingAction: null});
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    await user.click(screen.getByRole('button', {name: 'List my courses.'}));

    await waitFor(() => expect(agentApi.chat).toHaveBeenCalledWith({
      message: 'List my courses.',
      role: 'INSTRUCTOR',
    }));
    expect(await screen.findByText('You teach two courses.')).toBeInTheDocument();
    expect(screen.queryByText('Try asking')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'List my courses.'})).not.toBeInTheDocument();
  });

  it('uses the instructor workflow for instructor-advisors', async () => {
    auth.user = {id: 44, name: 'Hybrid', role: 'USER', level: 'INSTRUCTOR_ADVISOR'};
    agentApi.chat.mockResolvedValue({reply: 'Ready.', pendingAction: null});
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    expect(screen.getByText('Instructor workflow')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'List my courses.'}));

    await waitFor(() => expect(agentApi.chat).toHaveBeenCalledWith({
      message: 'List my courses.',
      role: 'INSTRUCTOR',
    }));
  });

  it('toggles the focused Workflow view from the panel header', async () => {
    const onToggleExpand = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowPanel isExpanded={false} onToggleExpand={onToggleExpand}/>);

    await user.click(screen.getByRole('button', {name: 'Expand Workflow'}));

    expect(onToggleExpand).toHaveBeenCalledOnce();
  });

  it('renders markdown in agent replies instead of showing asterisks', async () => {
    agentApi.chat.mockResolvedValue({
      reply: '**Active**\nCSCI-310 — Applied Database Systems\n\n- **Pending:** None\n- **Submitted:** 1',
      pendingAction: null,
    });
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    await user.click(screen.getByRole('button', {name: 'List my courses.'}));

    const activeHeading = await screen.findByText('Active');
    expect(activeHeading.tagName).toBe('STRONG');
    expect(screen.queryByText('**Active**')).not.toBeInTheDocument();
    expect(screen.getByText(/CSCI-310/)).toBeInTheDocument();

    const pendingLabel = screen.getByText('Pending:');
    expect(pendingLabel.tagName).toBe('STRONG');
    expect(pendingLabel.closest('li')).toHaveTextContent('Pending: None');
    expect(screen.getByText('Submitted:').closest('li')).toHaveTextContent('Submitted: 1');
    expect(screen.queryByText(/\*\*Pending:\*\*/)).not.toBeInTheDocument();
  });

  it('renders Markdown and TeX in user questions without changing the API text', async () => {
    agentApi.chat.mockResolvedValue({reply: 'Received.', pendingAction: null});
    const user = userEvent.setup();
    const question = '**Question:** evaluate $x^2$ with `square(x)`.';
    const {container} = render(<WorkflowPanel/>);

    await pasteWorkflowText(user, question);
    await user.click(screen.getByRole('button', {name: 'Run'}));

    await waitFor(() => expect(agentApi.chat).toHaveBeenCalledWith({
      message: question,
      role: 'INSTRUCTOR',
    }));
    expect(screen.getByText('Question:').tagName).toBe('STRONG');
    expect(screen.getByText('square(x)').tagName).toBe('CODE');
    expect(container.querySelector('.katex')).toBeInTheDocument();
  });

  it('requires an explicit Allow or Reject decision for a pending change', async () => {
    agentApi.chat.mockResolvedValue({
      reply: 'Change Assignment A from August 26 to August 27?',
      pendingAction: {actionId: 'action-123', type: 'ASSIGNMENT_DEADLINE_CHANGE'},
    });
    agentApi.decideDeadlineChange.mockResolvedValue({
      reply: 'The deadline change was rejected.',
      pendingAction: null,
    });
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    await pasteWorkflowText(user, 'Move Assignment A');
    await user.click(screen.getByRole('button', {name: 'Run'}));

    const dialog = await screen.findByRole('dialog', {name: 'Deadline change approval'});
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Change Assignment A from August 26 to August 27?')).toBeInTheDocument();
    expect(within(dialog).getByText('The deadline has not changed yet.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/late submission window/i)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', {name: 'Reject'}));

    await waitFor(() => expect(agentApi.decideDeadlineChange).toHaveBeenCalledWith({
      actionId: 'action-123',
      decision: 'REJECT',
    }));
    expect(await screen.findByText('The deadline change was rejected.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the approval dialog open when the deadline update fails', async () => {
    agentApi.chat.mockResolvedValue({
      reply: 'Move Assignment A to August 27 and clear its late window?',
      pendingAction: {actionId: 'action-456', type: 'ASSIGNMENT_DEADLINE_CHANGE'},
    });
    agentApi.decideDeadlineChange.mockRejectedValue(new Error('The LMS rejected this deadline change.'));
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    await user.click(screen.getByRole('button', {name: 'Help me change an assignment deadline.'}));
    const dialog = await screen.findByRole('dialog', {name: 'Deadline change approval'});
    await user.click(within(dialog).getByRole('button', {name: 'Allow'}));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The LMS rejected this deadline change.');
    expect(within(dialog).getByRole('button', {name: 'Reject'})).toBeEnabled();
    expect(screen.getByRole('dialog', {name: 'Deadline change approval'})).toBeInTheDocument();
  });

  it('does not open a stale approval dialog for an incomplete pending action', async () => {
    agentApi.chat.mockResolvedValue({
      reply: '',
      pendingAction: {actionId: 'action-empty', type: 'ASSIGNMENT_DEADLINE_CHANGE'},
      confirmationRequired: true,
    });
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    await user.click(screen.getByRole('button', {name: 'Help me change an assignment deadline.'}));

    expect(await screen.findByText(/incomplete approval request/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks for a Confirm click instead of a yes reply, then opens the deadline dialog', async () => {
    agentApi.chat
      .mockResolvedValueOnce({
        reply: 'Please confirm the course code, assignment title, and the new date.\nIs everything correct?',
        pendingAction: null,
      })
      .mockResolvedValueOnce({
        reply: 'Change Assignment 0 from August 26 to August 25 at 1:00 PM?',
        pendingAction: {actionId: 'action-789', type: 'ASSIGNMENT_DEADLINE_CHANGE'},
      });
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    await pasteWorkflowText(
      user,
      'change the due date of Assignment 0 to August 25, 1:00 pm',
    );
    await user.click(screen.getByRole('button', {name: 'Run'}));

    const detailsDialog = await screen.findByRole('dialog', {name: 'Confirm assignment details'});
    expect(screen.getByLabelText('Tell Workflow what to do')).toHaveAttribute('contenteditable', 'false');
    expect(within(detailsDialog).getByText(/Is everything correct/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', {name: 'Deadline change approval'})).not.toBeInTheDocument();

    await user.click(within(detailsDialog).getByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(agentApi.chat).toHaveBeenCalledTimes(2));
    expect(agentApi.chat).toHaveBeenLastCalledWith({
      message: expect.stringContaining('Original request: change the due date of Assignment 0 to August 25, 1:00 pm'),
      role: 'INSTRUCTOR',
      history: [
        {role: 'user', content: 'change the due date of Assignment 0 to August 25, 1:00 pm'},
        {
          role: 'assistant',
          content: 'Please confirm the course code, assignment title, and the new date.\nIs everything correct?',
        },
      ],
    });
    expect(agentApi.chat.mock.calls[1][0].message).not.toMatch(/^yes$/i);

    const deadlineDialog = await screen.findByRole('dialog', {name: 'Deadline change approval'});
    expect(within(deadlineDialog).getByRole('button', {name: 'Allow'})).toBeInTheDocument();
    expect(screen.queryByRole('dialog', {name: 'Confirm assignment details'})).not.toBeInTheDocument();
    expect(agentApi.decideDeadlineChange).not.toHaveBeenCalled();
  });

  it('cancels a details confirmation without sending yes or applying a deadline change', async () => {
    agentApi.chat.mockResolvedValue({
      reply: "Could you please confirm that you would like to change the deadline for 'Testing' to August 31, 1 PM?",
      pendingAction: null,
    });
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    await pasteWorkflowText(user, 'change Testing Quiz to August 31, 1 PM');
    await user.click(screen.getByRole('button', {name: 'Run'}));

    const detailsDialog = await screen.findByRole('dialog', {name: 'Confirm assignment details'});
    await user.click(within(detailsDialog).getByRole('button', {name: 'Cancel'}));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('The deadline change was cancelled. Send a new request when you are ready.'))
      .toBeInTheDocument();
    expect(agentApi.chat).toHaveBeenCalledTimes(1);
    expect(agentApi.decideDeadlineChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Tell Workflow what to do')).toBeEnabled();
  });

  it('does not treat a greeting after Confirm as the next step', async () => {
    agentApi.chat
      .mockResolvedValueOnce({
        reply: 'Please confirm the course code, assignment title, and the new date.\nIs everything correct?',
        pendingAction: null,
      })
      .mockResolvedValueOnce({
        reply: 'Hello! How can I assist you today?',
        pendingAction: null,
      });
    const user = userEvent.setup();
    render(<WorkflowPanel/>);

    await pasteWorkflowText(user, 'change Assignment 0 to August 25, 1:00 pm');
    await user.click(screen.getByRole('button', {name: 'Run'}));
    await user.click(within(await screen.findByRole('dialog', {name: 'Confirm assignment details'})).getByRole('button', {name: 'Confirm'}));

    expect(await screen.findByText(/The next step is the deadline approval dialog/)).toBeInTheDocument();
    expect(screen.queryByText('Hello! How can I assist you today?')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
