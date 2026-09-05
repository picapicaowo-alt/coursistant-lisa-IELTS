# Tokyo frontend deployment

This repository owns the independent training frontend. Its production build targets Tokyo; it is not a USC deployment target. Dev 8085 retains its existing development-mode configuration.

## Confirmed frontend targets

| Setting | Value |
| --- | --- |
| Public frontend | `https://app.xlearnedu.com` |
| Public LMS API | `https://api-cn.xlearnedu.com/api` |
| AWS account | `658424472610` |
| S3 region | `ap-northeast-1` |
| Frontend bucket | `coursistant-ielts-pilot-web-658424472610` |
| CloudFront distribution | `E2ZS5X94S7X4YW` |
| Build | `npm ci`, required frontend checks, `npm run build` |

Revalidate the AWS identity and distribution alias/origin before each release. These are public deployment identifiers, not credentials. Never upload backend artifacts into this frontend bucket.

## Configuration ownership

`lms/.env.production` defines the Tokyo API host once, and all legacy LMS API aliases resolve to the same absolute API base. The shared client already uses credentialed requests. The API owner must allow the exact frontend origin, supported preflights and actual responses; refresh remains an HttpOnly-cookie flow.

Removed production-only inputs:

- The USC base host is replaced by the confirmed Tokyo API host.
- `VITE_STATIC_BASE_URL` was only declared in a type and had no runtime consumer; Vite serves application assets from the frontend origin.
- `VITE_ROCKETCHAT_BASE_URL` pointed at an unconfirmed legacy service. Its guarded logout consumer tolerates absence, and the legacy chat page is not part of the active training route tree.

Vocabulary uses `https://api-cn.xlearnedu.com/vocabulary-api`, which proxies to the independent Vocabulary service and verifies the student's LMS bearer token. Its credentialed CORS responses allow the exact frontend origin. A relative `/vocabulary-api` path on the frontend S3 origin returns SPA HTML and must not be used as its Production API base.

Independent Workflow/AI Agent and Study Support paths are preserved, not silently reassigned to the LMS API. Their Tokyo public services remain outside this release's authenticated acceptance until confirmed. An S3 SPA fallback is not proof that any such API is live.

The existing legacy chat-cookie cleanup includes old domain strings. It only expires cookies and does not make network requests; do not confuse these literals with configured production API destinations. Preserve that compatibility logic during this scoped environment change.

## Release and rollback

1. Use an isolated checkout of the reviewed source revision, with any scoped release-config commit explicitly recorded. Do not deploy the unrelated dirty active worktree.
2. Run the appropriate lint, both typechecks, unit tests, production build and isolated browser tests. Record exact results and source/config hashes.
3. Scan generated assets for unintended USC or Dev request origins. Confirm all executable LMS API bases resolve to the approved Tokyo API. Keep compatibility-only literals separate from request destinations.
4. Record the existing `index.html` S3 VersionId and preserve its bytes before changing anything. Ensure bucket versioning is enabled.
5. Upload a versioned artifact snapshot under `releases/<release-id>/`, then upload static assets to their application paths without deleting previous assets. Hashed assets may be immutable; HTML and release metadata must revalidate.
6. Upload the new `index.html` last as the cutover point. Invalidate the affected CloudFront cache and wait for completion.
7. Verify the public root, login and nested routes, entry JS/CSS, release revision and artifact hashes. Then verify actual browser login, reload, refresh and permitted role pages in the designated test tenant.
8. For a critical failure, restore the prior `index.html` version and matching release metadata, then invalidate and verify again. Retain old hashed assets. Frontend rollback does not change backend data or releases.

A successful build, fixture test or HTTP 200 is not authenticated business acceptance. Publish release and test evidence separately, without tokens, cookies or passwords.

This workflow changes only frontend objects and CloudFront cache state. It does not change CloudFront routing, backend services, IAM, databases or infrastructure configuration.
