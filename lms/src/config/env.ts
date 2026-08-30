const read = (name: string, value: string | undefined, fallback: string): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (import.meta.env.PROD) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return fallback;
};

export interface AppEnv {
  apiBase: string;
  agentBase: string;
  vocabularyBase: string;
  vocabularyLocalIdentityHeader: boolean;
  environment: string;
  release: string;
  gitSha: string;
}

let cached: AppEnv | undefined;

/** Fail fast when a production build is missing its API origins. */
export const getAppEnv = (): AppEnv => {
  if (cached) return cached;

  cached = {
    apiBase: read('VITE_API_DOMAIN_NAME', import.meta.env.VITE_API_DOMAIN_NAME, '/api'),
    agentBase: read('VITE_AI_AGENT_API_DOMAIN_NAME', import.meta.env.VITE_AI_AGENT_API_DOMAIN_NAME, '/ai-agent'),
    vocabularyBase: read(
      'VITE_VOCABULARY_API_DOMAIN_NAME',
      import.meta.env.VITE_VOCABULARY_API_DOMAIN_NAME,
      '/vocabulary-api',
    ),
    vocabularyLocalIdentityHeader: import.meta.env.DEV
      && import.meta.env.VITE_VOCABULARY_LOCAL_IDENTITY_HEADER === 'true',
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION?.trim() || import.meta.env.MODE,
    gitSha: import.meta.env.VITE_GIT_SHA?.trim() || 'local',
  };
  return cached;
};
