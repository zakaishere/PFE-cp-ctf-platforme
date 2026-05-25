# University Academic Coding Platform 🎓

A scalable, high-performance web platform designed for universities to conduct coding assessments, live exams, and practical assignments (TPs). This repository houses the **Spring Boot Backend Engine**, handling secure user authentication, role-based dashboards, and a specialized asynchronous Docker-based code execution pipeline.

## 🌟 Key Features

* **Role-Based Authentication**: Secure JWT-based access for Students, Teachers, and Admins.
* **Isolated Code Execution**: Student source code safely runs in strictly limited Alpine Docker containers (`--network none`, limited CPU/Memory).
* **High-Performance RAM Disks**: All compilation artifacts and transient files are built on `/dev/shm` (tmpfs), never touching the physical storage disk to maximize speed and prevent disk wear.
* **Asynchronous Queueing**: Code submissions are pushed to a RabbitMQ queue and processed by dedicated concurrent worker pools.
* **Real-time WebSockets**: Students receive instant line-by-line feedback and execution times on their browser without refreshing.
* **Multi-Language Support**: Currently supports Java (via `eclipse-temurin:17-jdk-alpine`) and C++ (via `gcc:14-bookworm`), with extensible templates for Python, C, and JS.
* **Planning Mode**: "Run Only" logic allowing students to perform dry-runs on public test cases without affecting their grading attempt limits.

## 🏗 Architecture & Stack

* **Core Framework**: Java 17 / Spring Boot 3
* **Database**: PostgreSQL (Hibernate/JPA)
* **Message Broker**: RabbitMQ
* **Real-Time Communication**: Spring WebSockets (STOMP)
* **Execution Engine**: Native Java `ProcessBuilder` wrapping Docker CLI

For a deep dive into how the Docker scaling and execution batches work, see the [Engineering Guide](ENGINEERING_GUIDE.md).

## 🚀 Local Development Setup

To spin up the project locally on your machine, check out our step-by-step [Local Setup Guide](LOCAL_SETUP.md). It covers everything from setting up PostgreSQL and RabbitMQ, to compiling the Spring Boot application.

### Fast Execution Overview
```bash
# 1. Start RabbitMQ and PostgreSQL
# 2. Run the Spring Boot Server
./mvnw spring-boot:run
```

## 🧪 Concurrency Testing Tools

This backend is built for scale. To prove the RabbitMQ queueing and thread isolation is completely thread-safe, this repository includes multi-threaded Python stress testers:

* `test_concurrency.py` — Submits dynamic **Java** problems concurrently.
* `test_concurrency_cpp.py` — Submits dynamic **C++** problems concurrently.

**How to test:**
1. Start the Java Backend Server (this automatically seeds 5 Advanced Problems to the database).
2. Run `python3 test_concurrency.py`.
3. Watch the terminal output as the submissions are perfectly multiplexed via Docker containers simultaneously, yielding exact timings and test case assertions.

---
*Built as a final-year engineering project (PFE) prioritizing security, scalability, and seamless user experience.*
