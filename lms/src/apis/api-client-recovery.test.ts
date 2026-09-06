import axios, {AxiosError, AxiosHeaders, type AxiosAdapter} from 'axios';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ApiClient} from './api-client';

const success = (config: Parameters<AxiosAdapter>[0], data: unknown) => ({
  config, data: {status: 200, code: 'SUCCESS', data}, status: 200,
  statusText: 'OK', headers: new AxiosHeaders(),
});
const rejectResponse = (config: Parameters<AxiosAdapter>[0], status: number) => Promise.reject(new AxiosError(
  'Request failed', String(status), config, undefined,
  {...success(config, null), status, data: {status, code: status === 403 ? 'ACCESS_DENIED' : 'UNAVAILABLE'}},
));

afterEach(() => {localStorage.clear(); vi.restoreAllMocks();});

describe('session recovery through real Axios interceptors', () => {
  it.each([403, 409, 503])('preserves the recovered session and the business error %s', async status => {
    localStorage.setItem('accToken', 'expired-fixture-token');
    const expired = vi.fn();
    const client = new ApiClient({baseURL: '/api', refreshPath: '/refresh', onSessionExpired: expired});
    vi.spyOn(axios, 'post').mockResolvedValue({data: {data: 'rotated-fixture-token'}});
    let requests = 0;
    client.getClient().defaults.adapter = config => rejectResponse(config, ++requests === 1 ? 401 : status);
    await expect(client.get('/protected')).rejects.toMatchObject({code: status});
    expect(expired).not.toHaveBeenCalled();
    expect(localStorage.getItem('accToken')).toBe('rotated-fixture-token');
    expect(requests).toBe(2);
  });

  it.each([null, 'replacement-fixture-token'])('does not overwrite a changed session during refresh: %s', async replacement => {
    localStorage.setItem('accToken', 'expired-fixture-token');
    const expired = vi.fn();
    const client = new ApiClient({baseURL: '/api', refreshPath: '/refresh', onSessionExpired: expired});
    let resolveRefresh!: (value: unknown) => void;
    const refresh = vi.spyOn(axios, 'post').mockImplementation(() => new Promise(resolve => {resolveRefresh = resolve;}));
    const requests = vi.fn<AxiosAdapter>(config => rejectResponse(config, 401));
    client.getClient().defaults.adapter = requests;
    const result = client.get('/protected').catch(error => error);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    if (replacement) localStorage.setItem('accToken', replacement);
    else localStorage.removeItem('accToken');
    resolveRefresh({data: {data: 'late-fixture-token'}});
    await expect(result).resolves.toMatchObject({code: 401});
    expect(localStorage.getItem('accToken')).toBe(replacement);
    expect(requests).toHaveBeenCalledOnce();
    expect(expired).not.toHaveBeenCalled();
  });

  it('does not end a replacement session when the previous refresh fails late', async () => {
    localStorage.setItem('accToken', 'expired-fixture-token');
    const expired = vi.fn();
    const client = new ApiClient({baseURL: '/api', refreshPath: '/refresh', onSessionExpired: expired});
    let rejectRefresh!: (reason: Error) => void;
    const refresh = vi.spyOn(axios, 'post').mockImplementation(() => new Promise((_resolve, reject) => {rejectRefresh = reject;}));
    client.getClient().defaults.adapter = config => rejectResponse(config, 401);
    const result = client.get('/protected').catch(error => error);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    localStorage.setItem('accToken', 'replacement-fixture-token');
    rejectRefresh(new Error('Refresh service unavailable'));
    await expect(result).resolves.toMatchObject({code: 401});
    expect(expired).not.toHaveBeenCalled();
    expect(localStorage.getItem('accToken')).toBe('replacement-fixture-token');
  });

  it('discards an old account response before it can update the replacement account', async () => {
    localStorage.setItem('user', JSON.stringify({userId: 1, role: 'USER', level: 'STUDENT'}));
    const client = new ApiClient({baseURL: '/api'});
    let release!: () => void;
    client.getClient().defaults.adapter = config => new Promise(resolve => {release = () => resolve(success(config, {owner: 1}));});
    const result = client.get('/profile').catch(error => error);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    localStorage.setItem('user', JSON.stringify({userId: 2, role: 'USER', level: 'STUDENT'}));
    release();
    expect(axios.isCancel(await result)).toBe(true);
  });

  it('reuses a token already refreshed by a parallel request for the same account', async () => {
    localStorage.setItem('user', JSON.stringify({userId: 1, role: 'USER', level: 'STUDENT'}));
    localStorage.setItem('accToken', 'expired-fixture-token');
    const client = new ApiClient({baseURL: '/api', refreshPath: '/refresh'});
    const refresh = vi.spyOn(axios, 'post');
    const tokens: unknown[] = [];
    client.getClient().defaults.adapter = config => {
      tokens.push(config.headers.Authorization);
      if (tokens.length === 1) {
        localStorage.setItem('accToken', 'already-refreshed-fixture-token');
        return rejectResponse(config, 401);
      }
      return Promise.resolve(success(config, null));
    };
    await client.get('/protected');
    expect(tokens).toEqual(['Bearer expired-fixture-token', 'Bearer already-refreshed-fixture-token']);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ends an unrecoverable core session after the refreshed request is also refused', async () => {
    localStorage.setItem('accToken', 'expired-fixture-token');
    const expired = vi.fn();
    const client = new ApiClient({baseURL: '/api', refreshPath: '/refresh', onSessionExpired: expired});
    vi.spyOn(axios, 'post').mockResolvedValue({data: {data: 'rotated-fixture-token'}});
    client.getClient().defaults.adapter = config => rejectResponse(config, 401);
    await expect(client.get('/protected')).rejects.toMatchObject({code: 401});
    expect(expired).toHaveBeenCalledOnce();
    expect(localStorage.getItem('accToken')).toBeNull();
  });

  it('uses a token changed in another tab instead of retaining its first token', async () => {
    localStorage.setItem('accToken', 'first-fixture-token');
    const client = new ApiClient({baseURL: '/api'});
    const tokens: unknown[] = [];
    client.getClient().defaults.adapter = async config => {
      tokens.push(config.headers.Authorization);
      return success(config, null);
    };
    await client.get('/protected');
    localStorage.setItem('accToken', 'second-fixture-token');
    await client.get('/protected');
    localStorage.removeItem('accToken');
    await client.get('/protected');
    expect(tokens).toEqual(['Bearer first-fixture-token', 'Bearer second-fixture-token', undefined]);
  });
});
