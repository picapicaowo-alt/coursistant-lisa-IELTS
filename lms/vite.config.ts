import {defineConfig, loadEnv} from 'vite'
import {resolve} from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const tokensPath = resolve(__dirname, './src/styles/_tokens.scss').replace(/\\/g, '/')

type ProxyRequest = {removeHeader: (name: string) => void}
type ProxyServer = {on: (event: string, handler: (request: ProxyRequest) => void) => void}

// The Dev backend only allows its public origin. Browser requests are
// same-origin from the frontend's perspective, so the proxy must not forward
// localhost/LAN Origin values and accidentally turn them into CORS requests.
const stripForwardedOrigin = (proxy: ProxyServer): void => {
  proxy.on('proxyReq', proxyRequest => {
    proxyRequest.removeHeader('origin')
  })
}

// https://vite.dev/config/
export default defineConfig(({mode}) => {
  // auto load .env.development / .env.production
  const env = loadEnv(mode, process.cwd(), '')

  // Where the dev proxy forwards to. Built from the same variables the app
  // uses so there is only one place to change the backend host.
  const apiTarget =
    `${env.VITE_BASE_PROTOCOL}://${env.VITE_BASE_DOMAIN}:${env.VITE_BASE_PORT}`
  const apiPath = env.VITE_BASE_PATH || '/api'
  const aiAgentPath = env.VITE_AI_AGENT_API_DOMAIN_NAME || '/ai-agent'
  // Fallback only. Dev advising LMS is 8083; do not assume Workflow still lives there.
  const aiAgentTarget = env.VITE_AI_AGENT_TARGET || 'https://dev.xlearnedu.com:8083'
  const studySupportPath = env.VITE_STUDY_SUPPORT_API_DOMAIN_NAME || '/study-support'
  const studySupportTarget = env.VITE_STUDY_SUPPORT_TARGET || 'https://dev.xlearnedu.com:8090'
  const vocabularyPath = env.VITE_VOCABULARY_API_DOMAIN_NAME || '/vocabulary-api'
  const vocabularyTarget = env.VITE_VOCABULARY_API_TARGET

  const agentProxy = (pathPrefix: string, target: string) => ({
    target,
    changeOrigin: true,
    secure: false,
    rewrite: (path: string) => path.replace(new RegExp(`^${pathPrefix}`), ''),
    configure: stripForwardedOrigin,
  })

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "src": resolve(__dirname, './src'),
        "@": resolve(__dirname, './src'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Design tokens are available in every .scss file as `t.$brand` etc.
          // without an explicit @use. See src/styles/_tokens.scss.
          //
          // The token files themselves are skipped: _tokens.scss would import
          // itself, and tokens.global.scss declares the namespace on its own.
          additionalData: (source: string, filename: string) => {
            const path = filename.replace(/\\/g, '/')
            if (path.includes('/src/styles/_tokens.scss') || path.includes('/src/styles/tokens.global.scss')) {
              return source
            }
            // Sass ignores a BOM at the start of a file but not after
            // additionalData prepends tokens. See docs/adr/0001-dev-proxy-and-error-reporting.md.
            return `@use "${tokensPath}" as t;\n${source.replace(/^﻿/, '')}`
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 13005,
      allowedHosts: [
        'dev.xlearnedu.com',
        'ec2.dev.xlearnedu.com',
        'localhost',
        '127.0.0.1',
      ],
      // Same-origin proxy: refresh cookie is SameSite=Lax, and the backend's
      // duplicated CORS ACAO headers break cross-origin XHR. See ADR 0001.
      proxy: {
        [apiPath]: {
          target: apiTarget,
          changeOrigin: true,
          // Drop the cookie's Domain attribute so it binds to localhost
          // instead of being rejected as a foreign-domain cookie.
          cookieDomainRewrite: '',
          configure: stripForwardedOrigin,
        },
        [aiAgentPath]: agentProxy(aiAgentPath, aiAgentTarget),
        [studySupportPath]: agentProxy(studySupportPath, studySupportTarget),
        ...(vocabularyTarget
          ? {[vocabularyPath]: agentProxy(vocabularyPath, vocabularyTarget)}
          : {}),
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/setupTests.ts'],
      transformMode: {
        web: [/\.tsx$/]
      },
      mockReset: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html']
      },
      include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**']
    }
  }
})
