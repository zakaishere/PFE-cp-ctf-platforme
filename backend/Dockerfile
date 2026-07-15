# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app

# Cache dependencies first — pom changes invalidate this layer, source changes don't
COPY pom.xml .
RUN mvn -q dependency:go-offline

COPY src ./src
RUN mvn -q package -DskipTests

# ── Stage 2: run ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# docker-cli: the judge pipeline (DockerService) shells out to `docker run`,
# and the CTF local-instance mode talks to the daemon — both via the mounted
# /var/run/docker.sock. curl: container healthcheck. postgresql-client: psql
# for docker-entrypoint.sh's automatic schema bootstrap. coreutils: GNU sort
# -V (version sort) for correct migration_v2/v10/v33 numeric ordering —
# BusyBox's built-in sort doesn't reliably support -V.
# Runs as root because it needs the docker socket + /dev/shm workdir; the
# container itself is the isolation boundary here.
RUN apk add --no-cache docker-cli curl postgresql-client coreutils

COPY --from=builder /app/target/*.jar app.jar
# schema.sql (base tables) + db/migration_v*.sql, applied automatically on
# every boot by docker-entrypoint.sh before the JVM starts — see that file
# for why this can't be a Spring-side CommandLineRunner instead.
COPY --from=builder /app/target/classes/schema.sql schema/schema.sql
COPY --from=builder /app/target/classes/db/migration_v*.sql schema/
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
