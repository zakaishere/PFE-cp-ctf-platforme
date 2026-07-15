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
# /var/run/docker.sock. curl: container healthcheck.
# Runs as root because it needs the docker socket + /dev/shm workdir; the
# container itself is the isolation boundary here.
RUN apk add --no-cache docker-cli curl

COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
