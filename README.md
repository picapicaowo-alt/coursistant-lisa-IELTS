# Coursistant Training Frontend

Independent frontend for the training-institution product (IELTS and similar
programs). Application code lives under [`lms/`](./lms/).

Authorized repository: **https://github.com/picapicaowo-alt/coursistant-lisa-IELTS**

This codebase was forked from the university LMS frontend and keeps the same
React 18 + TypeScript + Vite stack. It is a separate product.

Start here:

1. [`AGENTS.md`](./AGENTS.md) — frontend ownership boundary and checks
2. [`CONTRIBUTING.md`](./CONTRIBUTING.md) — setup, workflow, and lockfiles
3. [`lms/PROJECT_STANDARDS.md`](./lms/PROJECT_STANDARDS.md) — architecture
4. [`docs/README.md`](./docs/README.md) — consumed OpenAPI and current A/B scope
5. [`lms/src/README.md`](./lms/src/README.md) — live module map

The explicitly authorized AWS Tokyo pilot infrastructure is isolated under
[`infrastructure/`](./infrastructure/). Its Terraform workflow, ownership,
security controls, and backend handoff are documented independently from the
browser application.
