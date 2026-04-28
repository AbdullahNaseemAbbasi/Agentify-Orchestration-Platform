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

- [`AGENTIFY_SPEC.md`](AGENTIFY_SPEC.md) — Complete technical specification (24 sections)
- [`PROGRESS.md`](PROGRESS.md) — Learning journey & session tracker

## Getting Started

> ⚠️ Setup instructions will be added once the foundation modules are implemented.

## License

UNLICENSED — early-stage project, not yet open-sourced.
