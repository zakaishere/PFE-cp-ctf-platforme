# Quickstart — 2 servers, minimum manual steps

For a PFE demo, not a hardened production deploy. Two scripts auto-generate
every secret that *can* be auto-generated (DB password, RabbitMQ password,
JWT secret, CTF flag secret, Grafana password, agent admin password, agent
JWT secret). The **one thing that genuinely cannot be scripted** is a Gmail
App Password (Google requires an interactive login + manual generation, no
API for it) — so by default, email is **skipped entirely**: accounts
auto-verify, no OTP is sent. Good enough for a demo. See the bottom of this
file if you want real verification emails.

---

## Server 1 — Platform

```bash
git clone <your-repo-url> algora
cd algora
./quickstart.sh
```

This creates **`algora/.env`** (that's the exact file — repo root, next to
`docker-compose.yml`) from `.env.example` and fills in every secret with a
random value. Re-running it is safe — it never overwrites a value you've
already customized.

```bash
make build                                  # only build path — needs disk+RAM
echo "DDL_AUTO=update" >> .env              # first boot on a fresh DB only
make up
sed -i '/^DDL_AUTO=update/d' .env
docker compose up -d --no-build backend
make db-migrate
make ps                                     # everything should read "healthy"
```

**Create the first admin** (fastest way — one-boot seed profile):
```bash
cat > docker-compose.override.yml <<'EOF'
services:
  backend:
    environment:
      SPRING_PROFILES_ACTIVE: prod,seed
EOF
docker compose up -d --no-build backend
docker compose logs backend | grep SEEDER   # confirm: admin@university.ac.ma / AdminAdmin1
rm docker-compose.override.yml
docker compose up -d --no-build backend
```
Log in with `admin@university.ac.ma` / `AdminAdmin1` and change the password
from the admin dashboard once you're in.

Check it's up: `curl http://localhost:8080/api/actuator/health` → `{"status":"UP"}`
App: `http://localhost:3000` — Admin: `http://localhost:3000/admin`

---

## Server 2 — CTF Worker Agent

```bash
git clone https://github.com/zakaishere/ctf-worker-agent.git
cd ctf-worker-agent
./quickstart.sh
```

This creates **`ctf-worker-agent/.env`** (repo root of *this* repo, next to
its own `docker-compose.yml`) and:
- generates `ADMIN_PASSWORD` and `JWT_SECRET`
- auto-detects this server's public IP and sets `HOST_IP` to it (players
  connect straight to this IP for CTF instances — it must be a real
  reachable address, not `localhost`)

The script prints the generated `ADMIN_PASSWORD` to your terminal — copy it
now, you'll need it in a second.

```bash
docker compose up -d --build
curl http://localhost:8000/api/v1/health
```

---

## Wire the two together

**1. Create an API key on the agent.** Open `http://<Server-2-IP>:8000` in a
browser, log in with `ADMIN_USERNAME` (default `admin`) / the
`ADMIN_PASSWORD` the script printed, go to **API Keys**, create one. Copy the
**key id** and **secret** — shown once.

**2. Point the platform at the agent.** Back on **Server 1**, edit
`algora/.env` (same file the script created) and set:
```
WORKER_AGENT_URL=http://<Server-2-IP>:8000
WORKER_AGENT_KEY_ID=<key id from step 1>
WORKER_AGENT_SECRET=<secret from step 1>
PLATFORM_INTERNAL_URL=http://<Server-1-IP>:8080
```
`PLATFORM_INTERNAL_URL` is the reverse direction — the agent uses it to fetch
challenge ZIPs from the platform when building a Docker image. Leaving it at
the default (`host.docker.internal`) only works if both servers are the same
machine; across two real servers it must be Server 1's real reachable
address.

```bash
docker compose up -d --no-build backend     # restart to pick up the new vars
```

---

## Smoke test

```bash
curl http://<Server-1-IP>:8080/api/actuator/health   # platform
curl http://<Server-2-IP>:8000/api/v1/health          # agent
```
Then, as the admin you created, open a CTF challenge that needs a live
instance and start it — confirm it reaches `RUNNING` and the connection
string points at **Server 2's** IP, not Server 1's.

---

## If you want real OTP emails instead of the default (skipped)

The scripts set `DISABLE_EMAIL_VERIFICATION=true` in `algora/.env` when
`MAIL_USERNAME` is empty. To turn real email on:

1. On the Gmail account you want to send from: enable 2-Step Verification,
   then generate an App Password at
   <https://myaccount.google.com/apppasswords> (2 minutes, must be done in a
   browser, cannot be scripted).
2. In `algora/.env`, set:
   ```
   MAIL_USERNAME=youraccount@gmail.com
   MAIL_PASSWORD=<the 16-char app password>
   DISABLE_EMAIL_VERIFICATION=false
   ```
3. `docker compose up -d --no-build backend`

Full reference for anything not covered here: `SETUP.md`.
