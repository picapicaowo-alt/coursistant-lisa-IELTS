# Vocabulary service

## Scope and isolation

- Frontend branch: `codex/vocabulary-local-prototype`
- Frontend worktree: an isolated worktree of the authorized frontend repository
- Standalone API: an independent sibling Git repository with no 8083 remote
- Frontend URL: `http://127.0.0.1:13005/vocabulary`
- API URL: `http://127.0.0.1:18083`

The localhost prototype does not inspect or modify the LMS 8083 backend. Vite
proxies `/vocabulary-api` to the standalone localhost service.

## Dev deployment

- The React application remains part of the static 8085 frontend release.
- The independent Vocabulary API runs as its own loopback-only service and
  stores progress in its own durable SQLite database.
- Nginx routes the same-origin `/vocabulary-api` prefix to that service. It is
  intentionally separate from the existing `/api` → 8083 route.
- In Dev, the API verifies the existing LMS bearer token against the configured
  current-user identity endpoint and accepts only `STUDENT` identities. The
  browser never supplies or chooses its own student ID.
- API releases and progress data are separated so an application rollback does
  not roll back or erase student learning history.

## Contract ownership

`docs/api/vocabulary.openapi.yaml` is the portable boundary between the React
feature and a future backend implementation. Student identity is supplied by
the authenticated gateway in production; only the standalone localhost
adapter accepts `X-Student-Id`.

The catalogue is read-only application data. The included JSON file contains
original demonstration copy so the flow can be reviewed without claiming a
Cambridge licence. Production content must be supplied and approved separately.

## Implemented PRD 4.9 behavior

- Student-only, global library that is independent of courses and reports.
- List filters, continue card, list progress, units, completion count, and due
  review count.
- Remember mode shows the complete card, allows previous/next and optional
  shuffle, and never writes ratings or completion.
- Test mode always shuffles. Rating controls remain visible on the word side,
  but unlock only after the student deliberately flips the card to check the
  complete answer. One immutable rating is then accepted before advance.
- `Kind of know` requires one later unaided `Know well`; `Don't remember`
  requires two later, separated `Know well` recalls.
- Weak words never repeat immediately. Same-session retry loops are bounded;
  unfinished words carry forward and are prioritised next time.
- Position, reveal state, rating history, current-pass progress, completion
  count, and long-term due scheduling persist in SQLite.
- A blocking session is identified by mode, status, and exact card position.
  Students can resume it or explicitly end it after confirmation; ending keeps
  submitted ratings but discards the resumable position and does not award
  completion.
- Completing every word increments the unit count and starts a fresh repeatable
  pass without deleting long-term history.

The prior Korean flashcards repository informed deck/card separation and the
idea of a pure scheduling engine. Its single-user assumptions, editable decks,
Prisma schema, backup/import behavior, and authentication were not copied.

## Local run

In three terminals:

```bash
cd <vocabulary-api-worktree>
npm install
npm run dev
```

```bash
cd <frontend-worktree>/lms
npm run dev:mock-api
```

```bash
cd <frontend-worktree>/lms
VITE_BASE_PROTOCOL=http VITE_BASE_DOMAIN=127.0.0.1 VITE_BASE_PORT=18081 npm run dev -- --host 127.0.0.1
```

The mock LMS process is only for a local student login. It is not part of the
Vocabulary API and is not required when the browser already has a valid LMS
session.

## Optional future 8083 handoff

If Vocabulary is later absorbed into 8083, the backend owner should implement
the OpenAPI unchanged behind the same-origin `/vocabulary-api` gateway, migrate
catalogue and progress tables deliberately, and import the scheduling engine's
invariant tests. The localhost identity header must never be enabled in a
deployed build.
