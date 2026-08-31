import {describe, expect, it} from 'vitest';
import {normalizeManagedUser, normalizeManagedUsers} from './adminDirectory';

describe('normalizeManagedUsers', () => {
  const user = {id: 7, tenantId: 2, email: 'advisor@example.test', role: 'USER', level: 'ADVISOR', status: 'ACTIVE'};

  it('accepts array and paged directory payloads', () => {
    expect(normalizeManagedUsers([user])).toEqual([user]);
    expect(normalizeManagedUsers({items: [user]})).toEqual([user]);
    expect(normalizeManagedUsers({content: [user]})).toEqual([user]);
  });

  it('drops malformed directory rows', () => {
    expect(normalizeManagedUsers({items: [{id: '7'}, null]})).toEqual([]);
  });

  it('narrows a tenant user detail', () => {
    expect(normalizeManagedUser(user)).toEqual(user);
    expect(normalizeManagedUser({id: 7})).toBeNull();
  });
});
