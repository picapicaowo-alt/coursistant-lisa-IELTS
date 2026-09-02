import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {AdminApiService} from './admin-api';

const client = {get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn()};
const service = new AdminApiService(client as unknown as typeof V2ApiClient);

describe('AdminApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses system-admin tenant CRUD routes', async () => {
    const payload = {name: 'West Campus', timezone: 'America/Los_Angeles'};
    client.get.mockResolvedValue({status: 200, data: []});
    client.post.mockResolvedValue({status: 200, data: {id: 2}});
    client.patch.mockResolvedValue({status: 200, data: {id: 2}});
    client.delete.mockResolvedValue({status: 200, data: null});
    await service.listTenants();
    await service.createTenant(payload);
    await service.updateTenant(2, payload);
    await service.deleteTenant(2);
    expect(client.get).toHaveBeenCalledWith('/v2/admin/tenants');
    expect(client.post).toHaveBeenCalledWith('/v2/admin/tenants', payload, expect.objectContaining({headers: expect.any(Object)}));
    expect(client.patch).toHaveBeenCalledWith('/v2/admin/tenants/2', payload, expect.objectContaining({headers: expect.any(Object)}));
    expect(client.delete).toHaveBeenCalledWith('/v2/admin/tenants/2', expect.objectContaining({headers: expect.any(Object)}));
  });

  it('keeps system and tenant managed-user scopes distinct', async () => {
    const systemRequest = {email: 'instructor@example.com', firstName: 'Ivy', lastName: 'Instructor', role: 'USER' as const, level: 'INSTRUCTOR' as const, tenantId: 2};
    const roleRequest = {role: 'TENANT_ADMIN' as const, level: 'NOT_APPLICABLE' as const};
    client.post.mockResolvedValue({status: 200, data: 41});
    client.put.mockResolvedValue({status: 200, data: null});
    await service.createManagedUser('system', systemRequest);
    await service.changeManagedUserRole('tenant', 41, roleRequest);
    await service.disableManagedUser('tenant', 41);
    expect(client.post).toHaveBeenNthCalledWith(1, '/v2/system/managed-users', systemRequest, expect.objectContaining({headers: expect.any(Object)}));
    expect(client.put).toHaveBeenCalledWith('/v2/tenant/managed-users/41/role', roleRequest, expect.objectContaining({headers: expect.any(Object)}));
    expect(client.post).toHaveBeenNthCalledWith(2, '/v2/tenant/managed-users/41/disable', undefined, expect.objectContaining({headers: expect.any(Object)}));
  });

  it('uses tenant directory, audit, and account re-enable contracts', async () => {
    client.get.mockResolvedValue({status: 200, data: {items: []}});
    client.post.mockResolvedValue({status: 200, data: null});

    await service.listTenantUsers({q: 'advisor', page: 0, size: 20});
    await service.getTenantUser(41);
    await service.listTenantAuditEvents({targetUserId: 41, page: 0, size: 20});
    await service.enableTenantManagedUser(41);

    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/tenant/users', {params: {q: 'advisor', page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/tenant/users/41');
    expect(client.get).toHaveBeenNthCalledWith(3, '/v2/tenant/audit-events', {params: {targetUserId: 41, page: 0, size: 20}});
    expect(client.post).toHaveBeenCalledWith('/v2/tenant/managed-users/41/enable');
  });

  it('serializes repeated levels and uses CAS-protected staff maintenance routes', async () => {
    client.get.mockResolvedValue({status: 200, data: {items: []}});
    client.patch.mockResolvedValue({status: 200, data: {}});

    await service.listTenantUsers({role: 'USER', levels: ['ADVISOR', 'INSTRUCTOR_ADVISOR'], status: 'ACTIVE'});
    await service.patchTenantManagedUser(41, {expectedAccountVersion: 2, firstName: 'Lisa'}, 'patch-41');
    await service.getTenantManagedUserDisableBlockers(41);

    const params = client.get.mock.calls[0][1].params as URLSearchParams;
    expect(params.getAll('levels')).toEqual(['ADVISOR', 'INSTRUCTOR_ADVISOR']);
    expect(params.get('role')).toBe('USER');
    expect(client.patch).toHaveBeenCalledWith('/v2/tenant/managed-users/41', {expectedAccountVersion: 2, firstName: 'Lisa'}, {headers: {'Idempotency-Key': 'patch-41'}});
    expect(client.get).toHaveBeenLastCalledWith('/v2/tenant/managed-users/41/disable-blockers');
  });

  it('uses the audited system operation contracts', async () => {
    client.patch.mockResolvedValue({status: 200, data: {id: 41, tenantId: 2}});
    client.post.mockResolvedValue({status: 200, data: null});

    await service.changeUserTenant(41, {tenantId: 2});
    await service.reassignPrimaryInstructor(37, {primaryInstructorUserId: 443});
    await service.correctAssignmentGrade({assignmentId: 57, studentUserId: 438, score: 9.5, reason: 'Appeal approved'});

    expect(client.patch).toHaveBeenCalledWith('/v2/admin/users/41/tenant', {tenantId: 2}, expect.objectContaining({headers: expect.any(Object)}));
    expect(client.post).toHaveBeenNthCalledWith(1, '/v2/courses/37/primary-instructor', {primaryInstructorUserId: 443}, expect.objectContaining({headers: expect.any(Object)}));
    expect(client.post).toHaveBeenNthCalledWith(2, '/v2/system/grade-corrections/assignments', {assignmentId: 57, studentUserId: 438, score: 9.5, reason: 'Appeal approved'}, expect.objectContaining({headers: expect.any(Object)}));
  });

  it('uses the auth-contract administrator and user detail routes', async () => {
    client.get.mockResolvedValue({status: 200, data: {}});

    await service.listAdmins({email: 'admin@example.com', status: 'ACTIVE'});
    await service.getAdmin(12);
    await service.getUser(41);

    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/admins', {params: {query: {email: 'admin@example.com', status: 'ACTIVE'}}});
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/admins/12');
    expect(client.get).toHaveBeenNthCalledWith(3, '/v2/users/41');
  });
});
