import {describe, expect, it, vi} from 'vitest';

import type {V2ApiClient} from '@/apis';
import {AuthApiService} from './auth-api';

describe('AuthApiService registration', () => {
  it('requests a registration verification code without an authenticated session', async () => {
    const post = vi.fn().mockResolvedValue({status: 200, data: null});
    const service = new AuthApiService({post} as unknown as typeof V2ApiClient);

    await service.sendRegistrationVerification('student@example.com');

    expect(post).toHaveBeenCalledWith(
      '/v1/auth/email-verifications/register',
      undefined,
      expect.objectContaining({
        params: {email: 'student@example.com'},
        skipAuth: true,
        headers: expect.objectContaining({'Idempotency-Key': expect.any(String)}),
      }),
    );
  });

  it('registers through the current v1 auth contract', async () => {
    const post = vi.fn().mockResolvedValue({status: 200, data: null});
    const service = new AuthApiService({post} as unknown as typeof V2ApiClient);
    const request = {
      firstName: 'Student',
      lastName: 'One',
      tenantId: 1,
      email: 'student@example.com',
      password: 'Passw0rd1',
      verificationCode: '123456',
    };

    await service.register(request);

    expect(post).toHaveBeenCalledWith(
      '/v1/auth/register',
      request,
      expect.objectContaining({
        skipAuth: true,
        headers: expect.objectContaining({'Idempotency-Key': expect.any(String)}),
      }),
    );
  });

  it('uses the current verification, reset, and authenticated password routes', async () => {
    const client = {post: vi.fn().mockResolvedValue({status: 200, data: null}), put: vi.fn().mockResolvedValue({status: 200, data: null})};
    const service = new AuthApiService(client as unknown as typeof V2ApiClient);
    const reset = {email: 'student@example.com', verificationCode: '123456', newPassword: 'NewPassw0rd'};
    const change = {currentPassword: 'OldPassw0rd', newPassword: 'NewPassw0rd'};

    await service.sendPasswordResetVerification(reset.email);
    await service.resetPassword(reset);
    await service.changePassword(change);

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/v1/auth/email-verifications/reset',
      undefined,
      expect.objectContaining({
        params: {email: reset.email},
        skipAuth: true,
        headers: expect.objectContaining({'Idempotency-Key': expect.any(String)}),
      }),
    );
    expect(client.post).toHaveBeenNthCalledWith(2, '/v1/auth/password-resets', reset, expect.objectContaining({skipAuth: true, headers: expect.objectContaining({'Idempotency-Key': expect.any(String)})}));
    expect(client.put).toHaveBeenCalledWith('/v1/auth/password', change, expect.objectContaining({headers: expect.objectContaining({'Idempotency-Key': expect.any(String)})}));
  });
});
