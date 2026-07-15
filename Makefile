# Algora platform — deployment & dev convenience targets.
#
#   make up        Run the PRE-BUILT platform stack (never builds).
#   make up-full   Platform + CTF worker agent together (single host).
#   make build     The ONLY build path — run on a host with disk + RAM to spare
#                  (build there, push/transfer images, then `make up` on target).
#   make infra     Just postgres+redis+rabbitmq (for native app dev).
#   make prod      Production overlay (locked-down ports, required secrets).
#
# `make up` and `make up-full` NEVER build. Building only happens via
# `make build` / `make prod-build`. This keeps low-disk / low-RAM target hosts
# from accidentally triggering a build.

.PHONY: setup up up-full up-bg down logs logs-backend logs-frontend ps clean \
        build infra prod prod-build db-shell db-migrate

AGENT_COMPOSE := ctf-worker-agent/docker-compose.yml

# ── First-time setup: create .env files from templates if missing ─────────────
setup:
	@test -f .env || cp .env.example .env
	@test -f ctf-worker-agent/.env || cp ctf-worker-agent/.env.example ctf-worker-agent/.env
	@echo "Edit .env (and ctf-worker-agent/.env) with real secrets before 'make up' in production."

# ── Run pre-built images only — NO build here ─────────────────────────────────
# --no-build makes this FAIL if images are missing instead of silently building
# (protects low-disk target hosts). Build first with `make build` elsewhere.
up: setup
	docker compose up -d --no-build

# Single-host deployment: platform + worker agent
up-full: setup
	docker compose up -d --no-build
	docker compose -f $(AGENT_COMPOSE) up -d --no-build

# Backwards-compatible alias for the old detached target
up-bg: up

down:
	docker compose down
	docker compose -f $(AGENT_COMPOSE) down 2>/dev/null || true

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

ps:
	docker compose ps

# Removes containers AND volumes (wipes the database!)
clean:
	docker compose down -v --remove-orphans
	docker compose -f $(AGENT_COMPOSE) down -v --remove-orphans 2>/dev/null || true
	docker image prune -f

# ── The ONLY build path — never run on the low-disk deploy target ─────────────
build:
	docker compose build
	docker compose -f $(AGENT_COMPOSE) build

# ── Daily native dev: infrastructure only ─────────────────────────────────────
# Run the apps natively for hot reload:
#   backend:  cd backend  && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
#   frontend: cd frontend && npm run dev
infra:
	docker compose up -d postgres redis rabbitmq

# ── Production (locked-down overlay). Build separately with prod-build. ────────
prod: setup
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-build:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# ── Database ──────────────────────────────────────────────────────────────────
db-shell:
	docker compose exec postgres psql -U psp_user -d psp_db

# Apply all SQL migration files in order (idempotent — safe to re-run).
# NOTE: `sort -V` is required — a bare shell glob sorts lexicographically, which
# would run migration_v10 before migration_v2 and v4_ctf after v33.
db-migrate:
	@for f in $$(ls backend/src/main/resources/db/migration_v*.sql | sort -V); do \
		echo "== $$f"; \
		docker compose exec -T postgres psql -U psp_user -d psp_db < $$f || exit 1; \
	done
