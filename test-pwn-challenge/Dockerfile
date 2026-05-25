# ── Stage 1: compile ──────────────────────────────────────────────────────────
# gcc:13 has all C headers pre-installed — no libc6-dev dance needed.
FROM gcc:13 AS builder

WORKDIR /build
COPY challenge.c .
RUN gcc -o challenge challenge.c

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# Only socat goes into the final image — no compiler, smaller attack surface.
FROM ubuntu:22.04

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends socat && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /challenge
COPY --from=builder /build/challenge .
RUN chmod 755 challenge

# The platform injects the real flag at runtime via the FLAG env variable.
# This default is only used if the container is run outside the platform.
ENV FLAG=CTF{test_flag_replace_by_platform}

# Port socat will listen on — must match the EXPOSE below.
EXPOSE 4444

# 'fork' is mandatory: without it socat handles only one connection (the
# platform's health-check) and the port goes dead for all players after that.
CMD ["socat", "TCP-LISTEN:4444,reuseaddr,fork", "EXEC:/challenge/challenge"]
