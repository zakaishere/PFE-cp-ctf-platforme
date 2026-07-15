# Algora Platform — Setup & Deployment Guide

A complete, step-by-step guide to running the platform (frontend + backend +
Postgres + Redis + RabbitMQ + Prometheus + Grafana) and the optional **CTF
Worker Agent**.

There are two ways to run it:

- **Option A — Containerized stack** (`docker compose`): best for demos,
  servers, and production. One command brings everything up.
- **Option B — Native dev**: run Postgres/Redis/RabbitMQ in Docker but the
  backend and frontend directly on your machine, with hot reload. Fastest for
  development; auto-creates a default admin.

> **Read this first if you only have one machine and it's low on disk:**
> `make up` never builds. Images must be built once (`make build`) on a host
> with free disk + RAM, then run with `make up`. See
> [Low-disk / split build](#low-disk--building-elsewhere).

---

## 1. Architecture at a glance

| Component | Tech | Container | Host port |
|---|---|---|---|
| Frontend | Next.js 16 (standalone) | `psp-frontend` | 3000 |
| Backend | Spring Boot 3 / Java 17 | `psp-backend` | 8080 |
| Database | PostgreSQL 16 | `psp-postgres` | 5432 |
| Cache | Redis 7 | `psp-redis` | 6379 |
| Queue | RabbitMQ 3.13 | `psp-rabbitmq` | 5672 / 15672 |
| Metrics | Prometheus | `psp-prometheus` | 9090 |
| Dashboards | Grafana | `psp-grafana` | 3001 |
| **CTF Worker Agent** (optional, separate) | FastAPI / Python | `icode-agent-backend` | 8000 |

The **Worker Agent** is an independently deployable service (its own compose
file) that spawns CTF challenge containers. It can run on the same host or a
separate one. If `WORKER_AGENT_URL` is empty, the backend falls back to
spawning CTF instances on the local Docker daemon.

---

## 2. Prerequisites

**Option A (containerized):**
- Docker Engine 24+ with the Compose v2 plugin (`docker compose version`)
- A host with disk + RAM to **build** (≈4 GB RAM, a few GB disk). The **run**
  target can be a 4 GB host (memory budget is tuned for it).
- `make` (optional but recommended — every command below has a `make` shortcut)

**Option B (native dev), additionally:**
- Java 17 (JDK)
- Node.js 20+ (the Docker image uses Node 22)
- Docker (for the infra containers)

---

## 3. Get the code & configure secrets

```bash
git clone <your-repo-url> algora
cd algora

# Create .env files from the templates (idempotent)
make setup
#  → creates ./.env                      (platform)
#  → creates ./ctf-worker-agent/.env     (worker agent)
```

Now **edit `.env`** and set real secrets. Generate strong values:

```bash
openssl rand -hex 32     # use for JWT_SECRET
openssl rand -hex 32     # use for CTF_FLAG_SECRET
```

Minimum you must change in `.env` before any real use:

| Variable | What it is |
|---|---|
| `DB_PASSWORD` | Postgres password |
| `RABBITMQ_PASSWORD` | RabbitMQ password |
| `JWT_SECRET` | Auth token signing key — **min 32 chars** |
| `CTF_FLAG_SECRET` | HMAC key for per-team dynamic flags — **min 32 chars** |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | SMTP credentials for OTP emails (verification, password reset) — **required in prod**, see [§7.1](#71-email--otp-verification) |
| `GRAFANA_PASSWORD` | Grafana admin password |
| `NEXT_PUBLIC_API_BASE_URL` | Server-side API origin. Local: `http://localhost:8080`. Prod: `https://api.yourdomain.com` |

Leave the `WORKER_AGENT_*` vars empty for now — you fill them in later only if
you deploy the Worker Agent ([section 8](#8-ctf-worker-agent-split-deployment)).

Full variable reference: [section 7](#7-environment-variable-reference).

---

## 4. Option A — Containerized full stack

### 4.1 Build the images (once, on a capable host)

```bash
make build          # builds backend, frontend, and the worker agent images
```

> `make build` is the **only** command that builds. `make up` will not.

### 4.2 First boot: create the database schema

The backend runs with `SPRING_PROFILES_ACTIVE=prod`, which uses
`ddl-auto=validate` — it expects the schema to **already exist** and will
refuse to start against an empty database. On a **fresh** Postgres volume you
must bootstrap the schema exactly once:

```bash
# In .env, temporarily enable schema creation for the FIRST boot only:
echo "DDL_AUTO=update" >> .env

make up             # backend creates the schema, then everything starts

# Once it's healthy, revert to validation and restart the backend:
sed -i '/^DDL_AUTO=update/d' .env
docker compose up -d --no-build backend
```

On subsequent deployments the schema already exists, so you skip this and just
run `make up`.

### 4.3 Apply SQL migrations

Schema changes after the initial bootstrap live in
`backend/src/main/resources/db/migration_v*.sql` and are applied in order:

```bash
make db-migrate
```

> **Required:** `migration_v33_audit_admin_domain.sql` widens an audit
> constraint to allow admin-action logging. **Without it, admin actions
> (approve teacher, change CTF config, etc.) fail with HTTP 409.** `make
> db-migrate` applies it along with the rest.

### 4.4 Create the first admin account

The default admin is **only seeded under the `dev`/`seed` profile** — the
containerized `prod` stack does **not** create one. Pick one:

**Method A — seed via a one-boot profile override** (easiest).
The `seed` profile creates an admin. Because `SPRING_PROFILES_ACTIVE` is fixed
to `prod` in `docker-compose.yml`, add a temporary override for a single boot:
```bash
cat > docker-compose.override.yml <<'EOF'
services:
  backend:
    environment:
      SPRING_PROFILES_ACTIVE: prod,seed
EOF
docker compose up -d --no-build backend            # boots with the seeder
docker compose logs backend | grep SEEDER          # confirm admin created
rm docker-compose.override.yml                      # revert
docker compose up -d --no-build backend            # back to prod-only
```
Creates **`admin@university.ac.ma` / `AdminAdmin1`** — **change this password
immediately.** Note: the seeder also adds a **demo teacher**
(`prof@university.ac.ma` / `ProfPass123!`) and sample practice problems. If you
want a clean prod DB with no demo data, use Method B instead.

**Method B — insert manually via SQL** (clean, full control).
`Admin` uses JOINED inheritance (discriminator `user_type='ADMIN'`), so insert
into **both** `users` and `admins`. `password_hash` must be a **bcrypt** hash
(generate one, e.g. `htpasswd -bnBC 12 "" 'YourPassword' | tr -d ':\n'`):
```bash
make db-shell
```
```sql
WITH new_admin AS (
  INSERT INTO users (id, user_type, first_name, last_name, email,
                     password_hash, role, is_email_verified, username, created_at)
  VALUES (gen_random_uuid(), 'ADMIN', 'Super', 'Admin', 'you@example.com',
          '<bcrypt-hash>', 'ADMIN', true, 'superadmin', now())
  RETURNING id
)
INSERT INTO admins (user_id, admin_level) SELECT id, 2 FROM new_admin;
```

### 4.5 Bring it up & verify

```bash
make up                    # or: make up-full   (platform + worker agent)
make ps                    # every service should read "healthy"
```

Verify:
```bash
curl http://localhost:8080/api/actuator/health     # → {"status":"UP"}
curl -I http://localhost:3000                       # → 200
docker stats --no-stream                            # each under its mem_limit
```

Open:
- App: <http://localhost:3000>
- Admin dashboard: <http://localhost:3000/admin> (log in as an ADMIN user)
- Grafana: <http://localhost:3001>

---

## 5. Option B — Native development (hot reload)

```bash
make infra          # starts only postgres + redis + rabbitmq

# Terminal 1 — backend (dev profile: auto-creates schema + seeds data)
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

- Frontend: <http://localhost:3000>  ·  Backend: <http://localhost:8080>
- The `dev` profile uses `ddl-auto=update` (auto schema) **and seeds a default
  admin**:

  | Email | Password |
  |---|---|
  | `admin@university.ac.ma` | `AdminAdmin1` |

  It also seeds a demo teacher and practice problems. **Dev only — never use
  these credentials in production.**

> Native dev still needs `migration_v33` applied if you're pointing at a DB
> that predates it. `dev` profile `ddl-auto=update` does **not** create the
> audit CHECK-constraint change — run the SQL once:
> ```bash
> psql -h localhost -U psp_user -d psp_db -f backend/src/main/resources/db/migration_v33_audit_admin_domain.sql
> ```

---

## 6. Make targets reference

| Command | What it does |
|---|---|
| `make setup` | Create `.env` and `ctf-worker-agent/.env` from templates if missing |
| `make build` | **The only build path** — builds platform + agent images |
| `make up` | Run the pre-built platform stack (`--no-build`; fails if images missing) |
| `make up-full` | Platform **+** worker agent (single host) |
| `make infra` | Only postgres + redis + rabbitmq (for native dev) |
| `make prod` | Production overlay (locked-down ports, required secrets) |
| `make prod-build` | Build with the production overlay |
| `make down` | Stop platform (and agent) containers |
| `make clean` | **Destroys volumes** (wipes the DB) + prunes images |
| `make logs` / `logs-backend` / `logs-frontend` | Follow logs |
| `make ps` | Container status |
| `make db-shell` | `psql` into the database |
| `make db-migrate` | Apply all `migration_v*.sql` in order |

---

## 7. Environment variable reference

### Platform — `.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DB_PASSWORD` | ✅ | `psp_password` | Postgres password |
| `RABBITMQ_USER` | | `psp` | RabbitMQ user |
| `RABBITMQ_PASSWORD` | ✅ | `psp_password` | RabbitMQ password |
| `JWT_SECRET` | ✅ | — | Auth token signing key (≥32 chars) |
| `CTF_FLAG_SECRET` | ✅ | — | HMAC key for dynamic per-team flags (≥32 chars) |
| `MAIL_HOST` | | `smtp.gmail.com` | SMTP host for OTP emails |
| `MAIL_USERNAME` | ✅ | *(empty)* | SMTP account — required in prod, see [§7.1](#71-email--otp-verification) |
| `MAIL_PASSWORD` | ✅ | *(empty)* | SMTP password (Gmail: an **App Password**, not the account password) |
| `GRAFANA_USER` | | `admin` | Grafana admin user |
| `GRAFANA_PASSWORD` | ✅ | `admin_change_me` | Grafana admin password |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | `http://localhost:8080` | Server-side API origin |
| `DDL_AUTO` | | `validate` | Set `update` for first boot on a fresh DB only |
| `WORKER_AGENT_URL` | | *(empty)* | Agent URL, e.g. `http://host.docker.internal:8000`. Empty = agent disabled |
| `WORKER_AGENT_KEY_ID` | | *(empty)* | API key id from the agent's dashboard |
| `WORKER_AGENT_SECRET` | | *(empty)* | API key secret from the agent's dashboard |
| `PLATFORM_INTERNAL_URL` | | `http://host.docker.internal:8080` | URL the agent uses to fetch challenge ZIPs |

> Postgres user/db (`psp_user` / `psp_db`) are fixed in `docker-compose.yml`;
> only the password is a variable.

### 7.1 Email / OTP verification

Registration, email verification, and password reset all send a 6-digit,
15-minute OTP by email (`AuthService` / `EmailService`). This is controlled by
`app.security.disable-verification` in `application-*.yml`:

| Profile | Effective value | Behavior |
|---|---|---|
| `prod` (containerized stack) | `false` | OTP **required** — `MAIL_USERNAME`/`MAIL_PASSWORD` **must** be set or accounts get stuck unverified |
| `dev` (native dev) | `true` | Verification bypassed entirely ("Testing Mode") — no email is ever sent |

If `MAIL_USERNAME`/`MAIL_PASSWORD` are missing in `prod`, the backend logs a
loud warning on boot (`EmailStartupCheck`) but still starts — every OTP send
then silently fails (logged only; the API still returns success, by design,
so `forgot-password` never leaks whether an email is registered).

**Setting up Gmail SMTP** (the default `MAIL_HOST`):
1. Enable 2-Step Verification on the sending Gmail account.
2. Generate an App Password: <https://myaccount.google.com/apppasswords>
3. Set `MAIL_USERNAME=<the gmail address>` and `MAIL_PASSWORD=<the 16-char app password>` in `.env` — **not** the account's normal login password, Gmail rejects that for SMTP.

Any other SMTP provider works too — just change `MAIL_HOST`.

**Spam / abuse handling:** `/api/auth/**` (register, resend-verification,
forgot-password, reset-password) is already covered by the platform's
per-IP rate limiter (`RateLimitInterceptor`) at the **strict** tier — 10
requests/minute per IP. This caps both OTP-spam toward a victim's inbox and
the volume that could get the sending SMTP account flagged/suspended by the
provider. No separate configuration needed.

**Running without real email** (demo/offline): the `app.security.disable-verification`
property is not templated as a compose `${VAR}` today, but Spring Boot's
relaxed env-var binding still reaches it directly (same pattern as
`ctf.flag-secret` → `CTF_FLAG_SECRET`: dots and hyphens both become
underscores). Override it via `docker-compose.override.yml`:
```yaml
services:
  backend:
    environment:
      APP_SECURITY_DISABLE_VERIFICATION: "true"
```
Note this is a demo-only shortcut — no email means no real "forgot password"
recovery path for users either.

### Worker Agent — `ctf-worker-agent/.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `HOST_IP` | ✅ | — | Public IP of the worker host (players connect here) |
| `ADMIN_PASSWORD` | ✅ | — | First agent-admin password (≥12 chars) |
| `JWT_SECRET` | ✅ | — | Agent token signing key (≥16 chars) |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` | | `admin` / … | First agent-admin identity |
| `PORT_MIN` / `PORT_MAX` | | `32000` / `33000` | Port range for spawned challenges |
| `MAX_CONCURRENT_INSTANCES` | | `100` | Cap on running challenge containers |
| `ALLOWED_CORS_ORIGINS` | | `https://worker.yourdomain.com` | Comma-separated allowed origins |

---

## 8. CTF Worker Agent (split deployment)

The agent runs independently — ideal on a **separate host** so untrusted
challenge containers never touch the platform host.

**On the worker host:**
```bash
cd ctf-worker-agent
cp .env.example .env
# edit .env — set HOST_IP (this host's public IP), ADMIN_PASSWORD (≥12 chars),
#              JWT_SECRET (openssl rand -base64 32)

docker compose up -d --build          # first time (builds locally)
curl http://localhost:8000/api/v1/health    # → healthy
```

**Wire the platform to the agent:**
1. Log in to the agent dashboard (`http://<HOST_IP>:8000`) with the admin
   account from `.env`.
2. Create an **API key** (API Keys page). Copy the **key id** and **secret**.
3. In the platform `.env`, set:
   ```
   WORKER_AGENT_URL=http://<HOST_IP>:8000      # or host.docker.internal:8000 if same host
   WORKER_AGENT_KEY_ID=<key id>
   WORKER_AGENT_SECRET=<secret>
   ```
4. **Wire the reverse direction too** — the agent fetches challenge ZIPs *from*
   the platform when building a Docker image (`GET /api/internal/zip/{id}`,
   protected by a short-lived signed token, not open to the internet). The
   default `PLATFORM_INTERNAL_URL=http://host.docker.internal:8080` only
   resolves on the **same** Docker host — on a genuinely separate worker
   server it resolves to nothing useful and image builds will hang or fail.
   Set it in the platform's `.env` to a URL the worker host can actually
   reach:
   ```
   PLATFORM_INTERNAL_URL=https://platform.yourdomain.com   # or http://<platform-public-ip>:8080
   ```
5. Restart the backend: `docker compose up -d --no-build backend`.

> The platform↔agent HMAC key id/secret are **generated at runtime** in the
> agent UI — they are not set as env vars on the agent side. Requests are HMAC-
> signed with a 5-minute timestamp tolerance.
>
> Live CTF **instances** (the actual challenge containers players connect to)
> don't have this same-host limitation — the agent stamps every instance with
> its own `HOST_IP` and the platform relays that directly to the browser, so
> players connect straight to the worker host regardless of where the
> platform runs. Only the ZIP-fetch-for-building path depends on
> `PLATFORM_INTERNAL_URL` being reachable from the worker.

---

## 9. Database & migrations

- **Schema strategy:** `prod` uses `ddl-auto=validate` (fails fast on
  mismatch). `dev` uses `ddl-auto=update` (auto-creates/updates).
- **First boot on a fresh volume:** set `DDL_AUTO=update` once (section 4.2),
  then revert to `validate`.
- **Ongoing changes:** add/apply `backend/src/main/resources/db/migration_v*.sql`
  via `make db-migrate`.
- **`migration_v33` is mandatory** for admin-action audit logging (otherwise
  409 on admin mutations).

Backup / restore:
```bash
docker compose exec -T postgres pg_dump -U psp_user psp_db > backup.sql
docker compose exec -T postgres psql -U psp_user -d psp_db < backup.sql
```

---

## 10. Production hardening

Use the production overlay — it removes host-published infra ports (only the
compose network can reach Postgres/Redis/RabbitMQ), forces `restart: always`,
and requires every secret (no fallbacks, so it fails loudly if `.env` is
incomplete):

```bash
make prod-build      # build with the overlay (on a capable host)
make prod            # docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Also:
- Put a reverse proxy (nginx/Caddy) with TLS in front of the frontend + backend.
- Never expose Grafana (3001) or Prometheus (9090) publicly — tunnel or proxy.
- Rotate `JWT_SECRET` / `CTF_FLAG_SECRET` away from any example value.
- Change the seeded admin password immediately if you used the seeder.

---

## Low-disk / building elsewhere

`make up` uses `--no-build`, so it **cannot** build — it fails if images are
missing. This protects small target hosts. Workflow when the target is tight
on disk/RAM:

1. On a build machine (or CI): `make build`.
2. Push images to a registry **or** save/transfer them:
   ```bash
   docker save psp-backend psp-frontend | gzip > images.tar.gz   # then scp to target
   docker load < images.tar.gz                                    # on the target
   ```
3. On the target: `make up`.

---

## 11. Troubleshooting

| Symptom | Cause & fix |
|---|---|
| Admin actions (approve teacher, CTF config) return **409** | `migration_v33` not applied → `make db-migrate` (or run the SQL file). |
| Backend won't start: *"Schema validation failed"* | Fresh/empty DB with `ddl-auto=validate`. First boot needs `DDL_AUTO=update` once (section 4.2). |
| `make up` errors that an **image is missing** | Expected — `up` never builds. Run `make build` first (or load transferred images). |
| Port **5432 already in use** | A host Postgres is running. Stop it, or change the published port in `docker-compose.yml`, or use `make infra` selectively. |
| Redis restarts / OOM-killed | Don't lower redis `mem_limit` below ~140m; it must exceed `--maxmemory 128mb` + overhead. |
| Backend OOM under load | `mem_limit: 900m` → ~675 MB heap (via `MaxRAMPercentage`, **not** `JAVA_OPTS` — the Dockerfile ignores `JAVA_OPTS`). Raise `mem_limit` if your load needs more. |
| Prometheus shows no healthcheck | Intentional — the `prom/prometheus` image is distroless (no shell/curl), so a `CMD` healthcheck can't run. Non-critical. |
| CTF instances don't spawn | Check `WORKER_AGENT_URL`/key/secret, or (if empty) that the backend can reach `/var/run/docker.sock`. |
| CTF challenge image build hangs/fails on a remote agent | `PLATFORM_INTERNAL_URL` still points at `host.docker.internal` — that only resolves on the same Docker host. Set it to a URL the worker server can actually reach (§8, step 4). |
| Verification/reset OTP emails never arrive | `MAIL_USERNAME`/`MAIL_PASSWORD` unset or wrong — check backend logs on boot for the `EmailStartupCheck` warning. Gmail needs an **App Password**, not the account password. See §7.1. |
| `535 Authentication failed` in backend logs | Wrong Gmail password (using the account password instead of an App Password), or 2-Step Verification isn't enabled on the sending account. |
| Frontend can't reach API in browser | The browser derives the API host from the current URL; ensure the backend is reachable on `:8080` from the client, and `NEXT_PUBLIC_API_BASE_URL` is set for server-side calls. |

---

## Quick reference — fastest paths

**Demo on one capable machine:**
```bash
make setup && make build
echo "DDL_AUTO=update" >> .env && make up      # first boot only
sed -i '/^DDL_AUTO=update/d' .env && docker compose up -d --no-build backend
make db-migrate
# create an admin (section 4.4), then open http://localhost:3000/admin
```

**Local development:**
```bash
make infra
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # admin@university.ac.ma / AdminAdmin1
cd frontend && npm run dev
```
