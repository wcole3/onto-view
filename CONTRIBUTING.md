# Contributing

## Requirements

- Python 3.11 or newer (3.12 recommended for CI parity)
- Node.js 24+ with npm
- Docker and Docker Compose (for containerized runs)

## Branch naming

Use `feature/<short-description>`, `fix/<short-description>`, or
`docs/<short-description>` branches off `main`.

## Environment setup

```sh
make install-backend
make install-frontend
```

Run the development servers with `make dev-backend` and `make dev-frontend`.

## Pull request rules

- Keep pull requests small and focused on one behavior.
- New behavior requires tests (backend pytest, frontend Vitest, or e2e where
  user-facing).
- Do not commit complete external ontology distributions (for example a full
  CCO checkout) to the repository. Reference them by path or pinned release
  instead.

## Python formatting, linting, and typing

- Format with Ruff: `cd backend && ../.venv/bin/ruff format .`
- Lint with Ruff: `cd backend && ../.venv/bin/ruff check .`
- Type-check with mypy: `cd backend && ../.venv/bin/mypy app`
- The backend must pass all three before review (`make lint-backend`).

## TypeScript formatting, linting, and tests

- Lint with ESLint: `cd frontend && npm run lint`
- Type-check: `cd frontend && npm run typecheck`
- Unit tests: `cd frontend && npm test`
- The frontend must pass all three before review (`make lint-frontend`).

## Fixture files

Keep test fixtures small and hand-written. Generated performance fixtures live
outside the repository (`generated-fixtures/`, git-ignored) and are produced by
`make generate-large`.

## Security review

Any change that touches network fetching, import resolution, or upload handling
requires an explicit security review before merging. See
[SECURITY.md](SECURITY.md).

## Pull request checklist

- [ ] Backend tests pass: `make test-backend`
- [ ] Frontend tests pass: `make test-frontend`
- [ ] Lint and type checks pass: `make lint`
- [ ] New behavior is covered by tests
- [ ] No secrets, large binaries, or external ontology distributions committed
- [ ] Security-sensitive changes flagged for review
