# Agentify

> Self-hostable AI agent orchestration platform.

**Status:** 🚧 Early development (Week 1 of 12-week MVP).

A self-hostable backend for building, deploying, and monitoring AI agents — model-agnostic, multi-tenant, and production-grade. Positioned as a self-hostable alternative to OpenAI Assistants API + LangSmith + Pinecone, unified into one backend.

---

## Tech Stack

- **Runtime:** Node.js 20+ LTS
- **Framework:** NestJS 10+ (TypeScript strict)
- **Database:** PostgreSQL 16+ with `pgvector`
- **Cache & Queue:** Redis 7+ + BullMQ
- **ORM:** Prisma 5+
- **LLM Providers (MVP):** OpenAI, Anthropic
- **Observability:** OpenTelemetry, Prometheus, Pino
- **Deployment:** Docker + docker-compose

## Project Structure

This is a NestJS monorepo:

```
agentify/
├── apps/
│   ├── api/         # Main HTTP API
│   └── worker/      # Background job processors (BullMQ)
├── libs/
│   ├── database/    # Prisma client + repositories
│   ├── llm/         # LLM provider abstraction
│   ├── common/      # Shared DTOs, types, utils
│   └── ...
└── docker/          # Dockerfiles & deployment
```

## Documentation

- [`SETUP.md`](SETUP.md) — Step-by-step local setup guide (commands, daily workflow, troubleshooting)
- [`AGENTIFY_SPEC.md`](AGENTIFY_SPEC.md) — Complete technical specification (24 sections)
- [`PROGRESS.md`](PROGRESS.md) — Learning journey & session tracker

## Getting Started

### Prerequisites

- Node.js 20+ and npm 10+
- Docker Desktop (for local Postgres, Redis, MinIO)

### First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env template (then edit .env if you need to override anything)
cp .env.example .env

# 3. Start local infrastructure (Postgres + Redis + MinIO)
docker compose -f docker-compose.dev.yml up -d

# 4. Run the API in watch mode
npm run start:dev
```

Visit `http://localhost:3000` — should respond with `Hello from Agentify API!`.

### Local services

| Service           | Host port | Notes                                   |
| ----------------- | --------- | --------------------------------------- |
| Postgres+pgvector | `5433`    | User/pass/db: `agentify` / `password` / `agentify` |
| Redis             | `6381`    | No auth (local dev only)                |
| MinIO API         | `9000`    | S3-compatible                           |
| MinIO console     | `9001`    | Login: `minioadmin` / `minioadmin`      |

> Ports are shifted from defaults to avoid conflicts with other local stacks (e.g. another Postgres on 5432).

### Useful commands

```bash
npm run start:dev    # API in watch mode
npm run lint         # ESLint with auto-fix
npm run format       # Prettier write
docker compose -f docker-compose.dev.yml ps      # service status
docker compose -f docker-compose.dev.yml down    # stop services
docker compose -f docker-compose.dev.yml down -v # stop + delete data
```

## License

UNLICENSED — early-stage project, not yet open-sourced.
