// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {loadEnv} from 'vite';

const apiKeys = [
  'VITE_API_DOMAIN_NAME',
  'VITE_PROFILE_API_DOMAIN_NAME',
  'VITE_PROFILE_API_AVATAR_DOMAIN_NAME',
  'VITE_SIGNUP_API_DOMAIN_NAME',
  'VITE_CHAT_API_DOMAIN_NAME',
  'VITE_COURSE_API_DOMAIN_NAME',
  'VITE_TOKEN_CHECK_API_DOMAIN_NAME',
  'VITE_ANNOUNCEMENT_API_DOMAIN_NAME',
  'VITE_ASSIGNMENT_API_DOMAIN_NAME',
  'VITE_CALENDAR_API_DOMAIN_NAME',
  'VITE_GROUPING_API_DOMAIN_NAME',
] as const;

describe('training frontend deployment environments', () => {
  it('resolves every production LMS API alias to the Tokyo API', () => {
    const env = loadEnv('production', process.cwd());
    for (const key of apiKeys) {
      expect(env[key], key).toBe('https://api-cn.xlearnedu.com/api');
    }
    expect(env.VITE_BASE_DOMAIN).toBe('api-cn.xlearnedu.com');
    expect(env.VITE_BASE_PORT).toBe('443');
    expect(env.VITE_VOCABULARY_API_DOMAIN_NAME).toBe('https://api-cn.xlearnedu.com/vocabulary-api');
  });

  it('does not inherit USC, Dev or the unconfirmed legacy chat origin in production', () => {
    const env = loadEnv('production', process.cwd());
    expect(env.VITE_STATIC_BASE_URL).toBeUndefined();
    expect(env.VITE_ROCKETCHAT_BASE_URL).toBeUndefined();
    expect(Object.values(env).join('\n')).not.toMatch(/usc\.xlearnedu\.com|dev\.xlearnedu\.com|dev\.chat\.xlearnedu\.com/);
  });

  it('preserves the independent Dev API proxy configuration', () => {
    const env = loadEnv('development', process.cwd());
    expect(env.VITE_API_DOMAIN_NAME).toBe('/api');
    expect(env.VITE_BASE_DOMAIN).toBe('dev.xlearnedu.com');
    expect(env.VITE_BASE_PORT).toBe('8083');
  });
});
