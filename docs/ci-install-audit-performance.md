# Frontend installation and audit performance

## Scope and decision

Frontend build tooling only. No backend, server configuration, application API,
dependency version, registry URL or lockfile is changed by this optimization.

On 2026-09-03, local registry ping returned in 0.13 seconds while the npm bulk
advisory POST established TLS but returned no response before a 12-second cap.
A separately bounded `npm audit` reproduced the endpoint timeout. npm's default
fetch timeout was 300 seconds. GitHub runs 33820648904 and 33826579636 spent
3m44s and 7m05s in installation, versus 13s and 12s building. Their logs do not
provide enough detail to attribute all installation time to audit rather than
downloads. The mixed registry URLs in the lockfile remain unchanged.

Installation now skips its implicit online audit. A separate, parallel audit job
checks the lockfile **without installing dependencies**. This removes audit from
the frontend checks' critical path without treating unavailable results as safe.
There is no `continue-on-error`, severity exemption, offline clean fallback or
automatic `npm audit fix`. Existing moderate findings still fail the audit job;
this optimization does not resolve them or make the entire workflow green.
Repository branch-protection settings are not changed; maintainers must require
the `dependency-audit` check if they want it enforced as a protected merge gate.

## Commands (from `lms/`, Node 22.18+)

```sh
npm run deps:ci
npm run deps:audit
npm run ci:step -- build:dev
```

- `deps:ci`: immutable `npm ci`, no inline audit, funding output disabled, prefer cached
  packages, 30-second request timeout, one retry with bounded backoff, and a
  three-minute whole-command cap. It still validates lockfile/package integrity.
- `deps:audit`: full lockfile audit, explicitly online, no omitted development
  dependencies, 15-second request timeout, no retries and a 45-second total cap.
  Termination has up to two additional seconds of grace before forced cleanup.
- `ci:step -- <package-script> [arguments]`: the existing command and exit status
  are preserved, with a 15-minute cap. Use it for local lint/typecheck/tests/build
  as well as CI. Normal build and test commands are unchanged.
- Each runner reports start, a heartbeat every 15 seconds and completion time.
  GitHub step summaries preserve timings. A new commit cancels obsolete runs
  for the same PR/ref, but does not skip any check on the latest revision.
- GitHub's npm package cache is retained. The new audit job needs no package or
  browser installation. Playwright installation and the full test suite remain.

Audit output is saved under ignored `lms/artifacts/ci/`: `npm-audit.json` is the
raw response, and `audit-status.json` records status, counts when available,
duration, timestamp and exit information. CI uploads these even after failure.
Earlier reports are invalidated before a new audit begins.

| Status | Exit | Meaning |
| --- | --- | --- |
| `clean` | 0 | Valid report with no vulnerabilities and a successful npm exit |
| `vulnerabilities` | 1 | Valid report with findings, including moderate findings |
| `incomplete` | 2 | Timeout, interruption, network/command error or invalid report |

These scripts do not publish assets. Use the normal clean, merged worktree
release procedure and checksum/acceptance gates after verification; do not
reinstall over an active development server's `node_modules` to benchmark speed.

## Remaining security work

The previously observed five affected packages are `@humanfs/node`,
`@tiptap/core`, `@xmldom/xmldom`, `fflate` and `speech-rule-engine`. They are not
claimed to be a complete current vulnerability inventory. In particular the
Tiptap maintainer rates its advisory High despite npm's moderate classification.
Dependency remediation needs a compatibility-reviewed change. Historical text
in `PROJECT_STANDARDS.md` saying the audit is clean is not current evidence.

## Tooling regression checks

```sh
npm run typecheck:ci-tools
npm run test:ci-tools
npm exec -- eslint scripts/ci.ts scripts/ci.node-check.ts --max-warnings=0
```

Run `actionlint .github/workflows/ci.yml` from the repository root. Validate a
real locked install in a disposable directory, and separately exercise the live
bounded audit. A local install timing is not a measured GitHub CI speedup.

The Node-native test uses a `.node-check.ts` suffix so Vitest does not discover
and run it again with the application's browser-oriented test environment.

### Local evidence, 2026-09-03

- A disposable install using the unchanged lockfile completed in **25.7s**
  (673 packages). The active development `node_modules` was not replaced.
- The real online audit returned **incomplete** after **17.5s**, with process
  exit 2 from the wrapper. npm itself returned a network timeout, not a report.
- Type checking, focused ESLint, workflow actionlint and all 11 tooling tests
  passed. Tests cover clean/finding/incomplete reports, malformed counts, exit
  propagation, heartbeats, timeouts, spawn failure and POSIX descendant cleanup.
- Production build through the timed wrapper passed in **17.1s**, writing to a
  disposable output directory without replacing the active preview's assets.
- The existing deprecated xmldom and npm install-script approval warnings remain;
  this change neither suppresses them nor changes approval configuration.
- No GitHub run or deployment has been initiated for this local change.
