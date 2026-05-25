# Security Configuration

## Required Environment Variables

Set these before any non-local deployment.

### `CTF_FLAG_SECRET` (critical)

Used for HMAC-SHA256 generation of per-team CTF flags.
If not set, the default sentinel value `CHANGE_ME` is used and
all per-team flags become predictable.

**Generate a strong secret:**
```bash
openssl rand -hex 32
```

**Set before starting the application:**
```bash
export CTF_FLAG_SECRET=<output of the command above>
```

The application will log a prominent warning at startup if this is
not set or is less than 16 characters long.

### `JWT_SECRET` (critical)

Used to sign and verify all JWT tokens. Change from the default in
`application.yml` before any deployment.

---

## CORS Policy

All CTF API endpoints enforce CORS via `SecurityConfig.corsConfigurationSource()`,
which restricts allowed origins to `http://localhost:*` by default.

For production, update `SecurityConfig.corsConfigurationSource()` to list your
actual frontend origin instead of the localhost pattern.

No `@CrossOrigin` annotations exist on any controller — origin policy is
managed exclusively in `SecurityConfig`.

---

## Flag Security

- Per-team flags are generated with HMAC-SHA256 and never stored in plaintext in any API response.
- Flag comparisons always use `MessageDigest.isEqual()` (timing-safe) — never `String.equals()`.
- Docker containers receive the flag only via environment variable injection at spawn time.
- Containers run on isolated per-instance bridge networks with `withInternal(true)` (no internet).

---

**NEVER commit a real `CTF_FLAG_SECRET` to version control.**
