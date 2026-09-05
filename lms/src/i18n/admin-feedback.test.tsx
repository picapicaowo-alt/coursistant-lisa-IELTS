import {act, fireEvent, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, expect, it, vi} from 'vitest';
import i18n, {SUPPORTED_LOCALES} from './index';
import {AuditedOperations} from '@/pages/AdminConsolePage/components/AuditedOperations';

const reassign = vi.hoisted(() => vi.fn());
vi.mock('@/apis/services/admin-api', () => ({adminApiService: {reassignPrimaryInstructor: reassign}}));
afterEach(async () => {await act(() => i18n.changeLanguage('en'));});

it.each(['success', 'error'] as const)('retranslates an administrator %s receipt without resubmitting', async outcome => {
  reassign.mockReset();
  if (outcome === 'success') reassign.mockResolvedValue({status: 200, data: null});
  else reassign.mockRejectedValue(new Error('Unlocalized diagnostic'));
  const client = new QueryClient({defaultOptions: {mutations: {retry: false}}});
  render(<QueryClientProvider client={client}><AuditedOperations view="reassign"/></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText(i18n.t('common:admin.courseId')), {target: {value: '71'}});
  fireEvent.change(screen.getByLabelText(i18n.t('common:admin.newInstructorId')), {target: {value: '51'}});
  fireEvent.click(screen.getByRole('button', {name: i18n.t('common:admin.reviewReassign')}));
  fireEvent.click(screen.getByRole('button', {name: i18n.t('common:admin.confirmReassign')}));
  const role = outcome === 'success' ? 'status' : 'alert';
  await screen.findByRole(role);
  for (const locale of SUPPORTED_LOCALES) {
    await act(() => i18n.changeLanguage(locale));
    expect(screen.getByRole(role)).toHaveTextContent(i18n.t(outcome === 'success' ? 'common:admin.reassignSuccess' : 'common:admin.reassignFailed'));
    expect(screen.getByLabelText(i18n.t('common:admin.courseId'))).toHaveValue(71);
    expect(screen.getByLabelText(i18n.t('common:admin.newInstructorId'))).toHaveValue(51);
  }
  expect(reassign).toHaveBeenCalledExactlyOnceWith(71, {primaryInstructorUserId: 51});
});
