.DEFAULT_GOAL := help

VENV := .venv

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  %-20s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install-backend: ## Create/install the backend environment
	@if command -v uv >/dev/null 2>&1; then \
		uv venv $(VENV) && uv pip install -e "backend[dev]"; \
	else \
		python3 -m venv $(VENV) && $(VENV)/bin/pip install --upgrade pip && $(VENV)/bin/pip install -e "backend[dev]"; \
	fi

install-frontend: ## Run locked frontend install
	cd frontend && npm ci

dev-backend: ## Start the FastAPI development server
	$(VENV)/bin/uvicorn app.main:app --reload --port 8000

dev-frontend: ## Start the Vite development server
	cd frontend && npm run dev

test-backend: ## Run backend tests (pytest)
	$(VENV)/bin/python -m pytest backend/tests

test-frontend: ## Run frontend tests (Vitest)
	cd frontend && npm test

test: test-backend test-frontend ## Run both test suites

lint-backend: ## Run Ruff and mypy on the backend
	cd backend && ../$(VENV)/bin/ruff check . && ../$(VENV)/bin/mypy app

lint-frontend: ## Run ESLint and TypeScript checking on the frontend
	cd frontend && npm run lint && npm run typecheck

lint: lint-backend lint-frontend ## Run all lint checks

format: ## Format backend and frontend
	cd backend && ../$(VENV)/bin/ruff format . && ../$(VENV)/bin/ruff check --fix .
	cd frontend && npm exec eslint . --fix

e2e: ## Run Playwright end-to-end tests
	cd frontend && npm run e2e

docker-up: ## Start the Docker Compose stack
	docker compose up -d --build

docker-down: ## Stop the Docker Compose stack
	docker compose down

generate-large: ## Generate synthetic performance fixtures
	$(VENV)/bin/python scripts/generate_large_fixture.py

cco-smoke: ## Run the CCO compatibility smoke test
	$(VENV)/bin/python scripts/cco_smoke_test.py

clean: ## Delete build and cache output (not user data)
	rm -rf frontend/dist playwright-report test-results .pytest_cache .mypy_cache .ruff_cache coverage.xml .coverage htmlcov
	find . -type d -name __pycache__ -not -path "./$(VENV)/*" -exec rm -rf {} +
