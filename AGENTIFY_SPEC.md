# Agentify — AI Agent Orchestration Platform

## Complete Technical Specification & Implementation Guide

**Document Version:** 1.0
**Target Audience:** Development team / AI coding assistants (Claude Code)
**Project Codename:** Agentify (rename as desired)
**Last Updated:** April 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Feature Scope](#2-feature-scope)
3. [Tech Stack](#3-tech-stack)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Project Folder Structure](#5-project-folder-structure)
6. [Database Schema](#6-database-schema)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Core Modules Specification](#8-core-modules-specification)
9. [REST API Endpoints](#9-rest-api-endpoints)
10. [Agent Runtime Engine](#10-agent-runtime-engine)
11. [RAG Pipeline](#11-rag-pipeline)
12. [Tool Execution System](#12-tool-execution-system)
13. [Memory System](#13-memory-system)
14. [Background Jobs (BullMQ)](#14-background-jobs-bullmq)
15. [Streaming Responses (SSE)](#15-streaming-responses-sse)
16. [Webhooks System](#16-webhooks-system)
17. [Rate Limiting & Quotas](#17-rate-limiting--quotas)
18. [Observability & Tracing](#18-observability--tracing)
19. [Security Requirements](#19-security-requirements)
20. [Environment Variables](#20-environment-variables)
21. [Docker & Deployment](#21-docker--deployment)
22. [Development Phases (Roadmap)](#22-development-phases-roadmap)
23. [Testing Strategy](#23-testing-strategy)
24. [Coding Standards](#24-coding-standards)

---

## 1. Executive Summary

**Agentify** is a self-hostable, multi-tenant backend platform for building, deploying, and monitoring AI agents. It provides the infrastructure layer between LLM providers (OpenAI, Anthropic, Google, local models) and end-user applications.

Developers use Agentify to:
- Define AI agents with custom system prompts, tools, and knowledge bases
- Execute agents via REST APIs with full observability
- Manage agent memory across sessions
- Track token usage and costs per workspace
- Integrate via webhooks and SDKs

**Positioning:** A self-hostable alternative to OpenAI Assistants API + LangSmith + Pinecone, unified into one production-ready backend.

### Key Differentiators

- **Model-agnostic** — works with any LLM provider via unified abstraction
- **Self-hostable** — customers own their data and infrastructure
- **Multi-tenant** — workspace isolation from day one
- **Observable** — full execution traces, cost attribution, latency metrics
- **Production-grade** — queues, retries, rate limiting, circuit breakers

### Target Users

- SaaS companies needing embedded AI agents
- Agencies building custom AI solutions for clients
- Enterprises requiring on-premise AI orchestration
- Developers who want OpenAI Assistants API but self-hosted

---

## 2. Feature Scope

### 2.1 MVP (Phase 1) — 6–8 weeks

- User authentication (JWT access + refresh tokens)
- Workspace management (multi-tenant)
- Role-based access control (Owner, Admin, Member, Viewer)
- API key generation and management (server-to-server auth)
- Agent CRUD operations
- Tool definitions (function calling with JSON schema)
- Knowledge base management (document upload, chunking, embedding)
- Vector search via pgvector
- Agent execution engine (synchronous + streaming)
- Conversation thread management
- Short-term and long-term memory
- Token usage tracking per run
- Basic observability (execution traces)
- LLM provider abstraction (OpenAI + Anthropic minimum)
- OpenAPI/Swagger documentation
- Docker Compose for local development

### 2.2 Phase 2 — 4–6 weeks

- Webhook delivery system (async agent completions)
- Rate limiting per workspace plan
- Usage-based billing integration (Stripe)
- Advanced tracing dashboard (timeline views)
- Multi-step agent workflows (directed graph execution)
- Additional LLM providers (Google Gemini, Groq, Ollama)
- Scheduled agent runs (cron-based)
- Team invitations and role management UI
- Audit logs
- File attachments in conversations

### 2.3 Phase 3 — Future Considerations

- Visual agent builder (drag-and-drop UI)
- Agent-to-agent collaboration (multi-agent systems)
- Custom model fine-tuning integration
- A/B testing for prompts
- Evaluation framework (golden datasets)
- Voice input/output support
- Browser automation tools (Playwright)
- Code execution sandbox (WebAssembly/Firecracker)

---

## 3. Tech Stack

### Backend
- **Runtime:** Node.js 20+ LTS
- **Framework:** NestJS 10+
- **Language:** TypeScript 5+ (strict mode enabled)
- **ORM:** Prisma 5+
- **Validation:** class-validator + class-transformer
- **API Documentation:** Swagger (OpenAPI 3.0)

### Data Layer
- **Primary Database:** PostgreSQL 16+ with `pgvector` extension
- **Cache & Queue Store:** Redis 7+
- **Object Storage:** S3-compatible — MinIO (local), Supabase Storage or AWS S3 (cloud)

### Queue & Background Processing
- **Queue Library:** BullMQ (Redis-backed)
- **Worker Pattern:** Separate worker processes for isolation

### AI / ML
- **LLM Providers (MVP):** OpenAI, Anthropic
- **LLM Providers (Phase 2):** Google Gemini, Groq, OpenRouter, Ollama
- **Embeddings:** OpenAI `text-embedding-3-small` (default), configurable
- **Vector Index:** pgvector HNSW

### Observability
- **Tracing:** OpenTelemetry
- **Metrics:** Prometheus (scraped via `/metrics`)
- **Logging:** Pino (JSON structured logs)

### DevOps
- **Containers:** Docker 24+ with multi-stage builds
- **Orchestration (Dev):** docker-compose
- **CI/CD:** GitHub Actions
- **Reverse Proxy:** Nginx or Traefik

### Frontend (Optional Dashboard — Phase 2)
- Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui

---

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATIONS                      │
│       (Web Apps, Mobile Apps, Server-to-Server Integrations)    │
└────────────┬─────────────────────────────┬──────────────────────┘
             │ REST API / SSE              │ Webhooks (outbound)
             ▼                             ▲
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (NestJS)                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Auth Guard │→ │ Rate Limiter │→ │ Workspace Scope Resolver│  │
│  └────────────┘  └──────────────┘  └─────────────────────────┘  │
└────┬──────────────┬──────────────┬───────────────┬─────────────┘
     │              │              │               │
     ▼              ▼              ▼               ▼
┌─────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────────┐
│ Agents  │  │ Runtime  │  │ Knowledge    │  │ Observability │
│ Service │  │ Engine   │  │ Base Service │  │ Service       │
└────┬────┘  └────┬─────┘  └──────┬───────┘  └───────┬───────┘
     │            │               │                   │
     │            ▼               ▼                   │
     │    ┌──────────────┐ ┌──────────────┐          │
     │    │ LLM Provider │ │ Vector Store │          │
     │    │ Abstraction  │ │ (pgvector)   │          │
     │    └──────┬───────┘ └──────────────┘          │
     │           │                                    │
     │           ▼                                    │
     │    ┌──────────────┐                           │
     │    │ OpenAI /     │                           │
     │    │ Anthropic /  │                           │
     │    │ Local LLMs   │                           │
     │    └──────────────┘                           │
     │                                                │
     ▼                                                ▼
┌──────────────────────────────────────────────────────────┐
│                     PostgreSQL (primary)                  │
│        Users, Workspaces, Agents, Runs, Memory, etc.     │
└──────────────────────────────────────────────────────────┘
     ▲                                                ▲
     │                                                │
┌────┴────────────────────────────────────────────────┴─────┐
│                   BullMQ Workers (separate procs)          │
│   • Agent Run Executor  • Webhook Dispatcher               │
│   • Embedding Indexer   • Usage Aggregator                 │
└───────────────────┬───────────────────────────────────────┘
                    │
                    ▼
              ┌──────────┐
              │  Redis   │  (Queues + Cache + Rate Limit buckets)
              └──────────┘
```

### Request Flow Example: Synchronous Agent Run

1. Client sends `POST /v1/agents/:id/runs` with `Authorization: Bearer <jwt>` or `X-API-Key: <key>`
2. `AuthGuard` validates credentials, attaches `user` and `workspace` to request
3. `RateLimitGuard` checks Redis bucket for workspace quota
4. `RunsController` receives request, validates DTO
5. `RunsService` creates a `Run` record in DB with status `PENDING`
6. `AgentRuntimeService` loads agent config (system prompt, tools, KB refs, model)
7. Runtime loads conversation memory (previous messages in thread)
8. Runtime executes reasoning loop:
   - Calls LLM with messages + tool definitions
   - If tool call requested → executes tool → appends result → loops
   - If final message → breaks loop
9. Runtime persists messages, token usage, trace data
10. Response returned to client with `run_id`, final message, usage stats

---

## 5. Project Folder Structure

Monorepo structure using NestJS workspaces:

```
agentify/
├── apps/
│   ├── api/                        # Main HTTP API
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── config/
│   │   │   │   ├── config.module.ts
│   │   │   │   ├── env.validation.ts
│   │   │   │   └── swagger.config.ts
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── current-user.decorator.ts
│   │   │   │   │   ├── current-workspace.decorator.ts
│   │   │   │   │   └── roles.decorator.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   │   ├── api-key-auth.guard.ts
│   │   │   │   │   ├── roles.guard.ts
│   │   │   │   │   └── rate-limit.guard.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── logging.interceptor.ts
│   │   │   │   │   └── transform.interceptor.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── http-exception.filter.ts
│   │   │   │   └── pipes/
│   │   │   │       └── zod-validation.pipe.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── workspaces/
│   │   │   │   ├── api-keys/
│   │   │   │   ├── agents/
│   │   │   │   ├── tools/
│   │   │   │   ├── knowledge-bases/
│   │   │   │   ├── documents/
│   │   │   │   ├── threads/
│   │   │   │   ├── messages/
│   │   │   │   ├── runs/
│   │   │   │   ├── memory/
│   │   │   │   ├── llm-providers/
│   │   │   │   ├── webhooks/
│   │   │   │   ├── usage/
│   │   │   │   ├── billing/
│   │   │   │   └── traces/
│   │   │   └── health/
│   │   ├── test/
│   │   └── tsconfig.app.json
│   │
│   ├── worker/                     # Background job processors
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── processors/
│   │   │   │   ├── agent-run.processor.ts
│   │   │   │   ├── embedding.processor.ts
│   │   │   │   ├── webhook.processor.ts
│   │   │   │   └── usage-aggregation.processor.ts
│   │   │   └── worker.module.ts
│   │   └── tsconfig.app.json
│   │
│   └── webhook-dispatcher/         # Dedicated webhook service (optional split)
│
├── libs/
│   ├── database/                   # Prisma client + repositories
│   │   ├── src/
│   │   │   ├── prisma.service.ts
│   │   │   └── database.module.ts
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   │
│   ├── llm/                        # LLM provider abstraction
│   │   ├── src/
│   │   │   ├── interfaces/
│   │   │   │   └── llm-provider.interface.ts
│   │   │   ├── providers/
│   │   │   │   ├── openai.provider.ts
│   │   │   │   ├── anthropic.provider.ts
│   │   │   │   └── ollama.provider.ts
│   │   │   ├── llm.service.ts
│   │   │   └── llm.module.ts
│   │
│   ├── embeddings/                 # Embedding provider abstraction
│   ├── vector/                     # pgvector utilities
│   ├── common/                     # Shared DTOs, types, utils
│   │   ├── src/
│   │   │   ├── dto/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   │   ├── crypto.util.ts
│   │   │   │   ├── pagination.util.ts
│   │   │   │   └── tokenizer.util.ts
│   │   │   └── constants/
│   │
│   ├── queue/                      # BullMQ setup + queue definitions
│   ├── cache/                      # Redis cache wrapper
│   ├── tracing/                    # OpenTelemetry setup
│   └── tools/                      # Built-in tool implementations
│       ├── src/
│       │   ├── http-request.tool.ts
│       │   ├── web-search.tool.ts
│       │   ├── database-query.tool.ts
│       │   └── tool.registry.ts
│
├── docker/
│   ├── api.Dockerfile
│   ├── worker.Dockerfile
│   └── nginx.conf
├── scripts/
│   ├── seed.ts
│   └── generate-api-key.ts
├── test/
│   ├── e2e/
│   └── fixtures/
├── docker-compose.yml              # Production-like
├── docker-compose.dev.yml          # Local development
├── .env.example
├── .eslintrc.js
├── .prettierrc
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. Database Schema

Complete Prisma schema. All tables use UUID primary keys, `created_at` and `updated_at` timestamps, and soft-delete where marked.

### 6.1 `schema.prisma` (Complete)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

// ============================================
// USERS & WORKSPACES
// ============================================

model User {
  id             String    @id @default(uuid())
  email          String    @unique
  passwordHash   String
  name           String
  emailVerified  Boolean   @default(false)
  avatarUrl      String?
  lastLoginAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  memberships    WorkspaceMember[]
  ownedWorkspaces Workspace[]      @relation("WorkspaceOwner")
  refreshTokens  RefreshToken[]

  @@index([email])
  @@map("users")
}

model RefreshToken {
  id         String   @id @default(uuid())
  userId     String
  tokenHash  String   @unique
  expiresAt  DateTime
  revokedAt  DateTime?
  userAgent  String?
  ipAddress  String?
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

model Workspace {
  id         String   @id @default(uuid())
  slug       String   @unique
  name       String
  ownerId    String
  plan       Plan     @default(FREE)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  deletedAt  DateTime?

  owner      User              @relation("WorkspaceOwner", fields: [ownerId], references: [id])
  members    WorkspaceMember[]
  apiKeys    ApiKey[]
  agents     Agent[]
  knowledgeBases KnowledgeBase[]
  threads    Thread[]
  runs       Run[]
  usageEvents UsageEvent[]
  webhookEndpoints WebhookEndpoint[]

  @@map("workspaces")
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

model WorkspaceMember {
  id           String   @id @default(uuid())
  workspaceId  String
  userId       String
  role         Role     @default(MEMBER)
  invitedById  String?
  joinedAt     DateTime @default(now())

  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@index([userId])
  @@map("workspace_members")
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

model ApiKey {
  id           String   @id @default(uuid())
  workspaceId  String
  name         String
  keyHash      String   @unique        // store only SHA-256 hash
  keyPrefix    String                  // first 8 chars for display (e.g., "agt_xxxx...")
  scopes       String[]                // e.g., ["agents:read", "agents:execute"]
  lastUsedAt   DateTime?
  expiresAt    DateTime?
  revokedAt    DateTime?
  createdById  String
  createdAt    DateTime @default(now())

  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([keyHash])
  @@map("api_keys")
}

// ============================================
// AGENTS & TOOLS
// ============================================

model Agent {
  id              String   @id @default(uuid())
  workspaceId     String
  name            String
  description     String?
  systemPrompt    String   @db.Text
  model           String                  // e.g., "gpt-4o", "claude-sonnet-4-5"
  provider        String                  // "openai" | "anthropic" | etc.
  temperature     Float    @default(0.7)
  maxTokens       Int      @default(4096)
  topP            Float?
  responseFormat  Json?                   // { type: "json_object", schema: {...} }
  toolChoice      String   @default("auto") // "auto" | "none" | "required"
  maxSteps        Int      @default(10)     // max reasoning loop iterations
  isActive        Boolean  @default(true)
  createdById     String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  workspace       Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tools           AgentTool[]
  knowledgeBases  AgentKnowledgeBase[]
  threads         Thread[]
  runs            Run[]

  @@index([workspaceId])
  @@map("agents")
}

model Tool {
  id            String   @id @default(uuid())
  workspaceId   String
  name          String                  // function name, e.g., "get_weather"
  description   String   @db.Text
  parameters    Json                    // JSON Schema for parameters
  type          ToolType @default(HTTP)
  // For HTTP tools:
  httpMethod    String?                 // GET, POST, etc.
  httpUrl       String?                 // URL template with {{param}}
  httpHeaders   Json?
  httpBody      Json?                   // body template
  httpAuthType  String?                 // "none", "bearer", "basic", "api_key"
  httpAuthValue String?                 // encrypted credentials
  // For built-in tools:
  builtInType   String?                 // "web_search", "code_exec", etc.
  // For MCP tools (future):
  mcpServerUrl  String?

  timeoutMs     Int      @default(30000)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  agentTools    AgentTool[]

  @@index([workspaceId])
  @@map("tools")
}

enum ToolType {
  HTTP
  BUILT_IN
  MCP
}

model AgentTool {
  id        String   @id @default(uuid())
  agentId   String
  toolId    String
  createdAt DateTime @default(now())

  agent     Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
  tool      Tool     @relation(fields: [toolId], references: [id], onDelete: Cascade)

  @@unique([agentId, toolId])
  @@map("agent_tools")
}

// ============================================
// KNOWLEDGE BASES & DOCUMENTS
// ============================================

model KnowledgeBase {
  id             String   @id @default(uuid())
  workspaceId    String
  name           String
  description    String?
  embeddingModel String   @default("text-embedding-3-small")
  chunkSize      Int      @default(1000)
  chunkOverlap   Int      @default(200)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  workspace      Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  documents      Document[]
  agents         AgentKnowledgeBase[]

  @@index([workspaceId])
  @@map("knowledge_bases")
}

model AgentKnowledgeBase {
  id               String   @id @default(uuid())
  agentId          String
  knowledgeBaseId  String
  topK             Int      @default(5)
  minSimilarity    Float    @default(0.7)
  createdAt        DateTime @default(now())

  agent            Agent         @relation(fields: [agentId], references: [id], onDelete: Cascade)
  knowledgeBase    KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)

  @@unique([agentId, knowledgeBaseId])
  @@map("agent_knowledge_bases")
}

model Document {
  id              String         @id @default(uuid())
  knowledgeBaseId String
  name            String
  source          String         // "upload", "url", "text"
  sourceUrl       String?
  mimeType        String?
  sizeBytes       Int?
  status          DocumentStatus @default(PENDING)
  errorMessage    String?
  metadata        Json?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  knowledgeBase   KnowledgeBase  @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)
  chunks          DocumentChunk[]

  @@index([knowledgeBaseId])
  @@index([status])
  @@map("documents")
}

enum DocumentStatus {
  PENDING
  PROCESSING
  INDEXED
  FAILED
}

model DocumentChunk {
  id          String                   @id @default(uuid())
  documentId  String
  chunkIndex  Int
  content     String                   @db.Text
  tokenCount  Int
  embedding   Unsupported("vector(1536)")?  // 1536 for text-embedding-3-small
  metadata    Json?
  createdAt   DateTime                 @default(now())

  document    Document                 @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@map("document_chunks")
}

// Note: Create HNSW index via raw SQL migration:
// CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);

// ============================================
// THREADS, MESSAGES, RUNS
// ============================================

model Thread {
  id           String   @id @default(uuid())
  workspaceId  String
  agentId      String
  externalId   String?                    // client-provided identifier
  title        String?
  metadata     Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  agent        Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)
  messages     Message[]
  runs         Run[]

  @@index([workspaceId, agentId])
  @@index([externalId])
  @@map("threads")
}

model Message {
  id         String      @id @default(uuid())
  threadId   String
  runId      String?
  role       MessageRole
  content    String      @db.Text
  toolCalls  Json?                        // for assistant messages with tool calls
  toolCallId String?                      // for tool result messages
  name       String?                      // tool name for tool messages
  metadata   Json?
  createdAt  DateTime    @default(now())

  thread     Thread      @relation(fields: [threadId], references: [id], onDelete: Cascade)
  run        Run?        @relation(fields: [runId], references: [id], onDelete: SetNull)

  @@index([threadId])
  @@index([runId])
  @@map("messages")
}

enum MessageRole {
  SYSTEM
  USER
  ASSISTANT
  TOOL
}

model Run {
  id               String    @id @default(uuid())
  workspaceId      String
  agentId          String
  threadId         String
  status           RunStatus @default(PENDING)
  startedAt        DateTime?
  completedAt      DateTime?
  failedAt         DateTime?
  errorCode        String?
  errorMessage     String?
  inputTokens      Int       @default(0)
  outputTokens     Int       @default(0)
  totalTokens      Int       @default(0)
  estimatedCostUsd Decimal   @default(0) @db.Decimal(10, 6)
  stepCount        Int       @default(0)
  model            String
  provider         String
  metadata         Json?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  workspace        Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  agent            Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)
  thread           Thread    @relation(fields: [threadId], references: [id], onDelete: Cascade)
  messages         Message[]
  traces           TraceSpan[]
  usageEvents      UsageEvent[]

  @@index([workspaceId, status])
  @@index([agentId])
  @@index([threadId])
  @@map("runs")
}

enum RunStatus {
  PENDING
  IN_PROGRESS
  REQUIRES_ACTION
  COMPLETED
  FAILED
  CANCELLED
  TIMEOUT
}

// ============================================
// MEMORY (long-term, separate from messages)
// ============================================

model Memory {
  id           String                       @id @default(uuid())
  workspaceId  String
  agentId      String
  threadId     String?                      // null = workspace-level memory
  userId       String?                      // optional end-user scoping
  key          String                       // semantic key, e.g., "user_preferences"
  content      String                       @db.Text
  embedding    Unsupported("vector(1536)")?
  importance   Float                        @default(0.5)
  metadata     Json?
  expiresAt    DateTime?
  createdAt    DateTime                     @default(now())
  updatedAt    DateTime                     @updatedAt

  @@index([workspaceId, agentId, threadId])
  @@index([userId])
  @@map("memories")
}

// ============================================
// OBSERVABILITY
// ============================================

model TraceSpan {
  id          String   @id @default(uuid())
  runId       String
  parentSpanId String?
  name        String                  // "llm.completion", "tool.call", "rag.search"
  kind        String                  // "llm" | "tool" | "retrieval" | "memory"
  startedAt   DateTime
  endedAt     DateTime?
  durationMs  Int?
  input       Json?
  output      Json?
  error       Json?
  metadata    Json?

  run         Run      @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId])
  @@index([parentSpanId])
  @@map("trace_spans")
}

// ============================================
// USAGE & BILLING
// ============================================

model UsageEvent {
  id               String   @id @default(uuid())
  workspaceId      String
  runId            String?
  eventType        String              // "llm.tokens", "embedding.tokens", "storage.bytes"
  model            String?
  provider         String?
  inputTokens      Int?
  outputTokens     Int?
  quantity         Decimal  @db.Decimal(14, 4)
  unitCostUsd      Decimal  @db.Decimal(10, 8)
  totalCostUsd     Decimal  @db.Decimal(10, 6)
  occurredAt       DateTime @default(now())

  workspace        Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  run              Run?      @relation(fields: [runId], references: [id], onDelete: SetNull)

  @@index([workspaceId, occurredAt])
  @@index([runId])
  @@map("usage_events")
}

// ============================================
// WEBHOOKS
// ============================================

model WebhookEndpoint {
  id           String   @id @default(uuid())
  workspaceId  String
  url          String
  secret       String                  // for HMAC signing
  events       String[]                // ["run.completed", "run.failed", ...]
  isActive     Boolean  @default(true)
  description  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  deliveries   WebhookDelivery[]

  @@index([workspaceId])
  @@map("webhook_endpoints")
}

model WebhookDelivery {
  id                 String   @id @default(uuid())
  endpointId         String
  eventType          String
  payload            Json
  status             String              // "pending" | "delivered" | "failed"
  attemptCount       Int      @default(0)
  lastAttemptAt      DateTime?
  nextAttemptAt      DateTime?
  responseStatusCode Int?
  responseBody       String?  @db.Text
  createdAt          DateTime @default(now())

  endpoint           WebhookEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  @@index([endpointId])
  @@index([status, nextAttemptAt])
  @@map("webhook_deliveries")
}

// ============================================
// AUDIT LOGS
// ============================================

model AuditLog {
  id           String   @id @default(uuid())
  workspaceId  String
  actorId      String?              // user id, null if system/api-key
  actorType    String               // "user" | "api_key" | "system"
  action       String               // "agent.created", "api_key.revoked", ...
  resourceType String
  resourceId   String
  metadata     Json?
  ipAddress    String?
  userAgent    String?
  occurredAt   DateTime @default(now())

  @@index([workspaceId, occurredAt])
  @@index([resourceType, resourceId])
  @@map("audit_logs")
}
```

### 6.2 Required Raw SQL Migrations

After initial `prisma migrate`, add:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_memories_embedding
  ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Partial indexes for active records
CREATE INDEX idx_agents_active ON agents (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users (email) WHERE deleted_at IS NULL;
```

---

## 7. Authentication & Authorization

### 7.1 Authentication Mechanisms

**Two auth methods supported:**

1. **JWT Bearer tokens** (for dashboard / user-facing operations)
   - Access token: 15 min expiry
   - Refresh token: 30 days expiry, rotated on use, stored hashed in DB
   - Algorithm: RS256 (asymmetric) — easier to verify in gateways/services

2. **API Keys** (for server-to-server integrations)
   - Format: `agt_live_<32-char-random>` or `agt_test_<32-char-random>`
   - Stored as SHA-256 hash in DB, never plaintext
   - Scoped permissions (`agents:read`, `agents:execute`, `kb:write`, etc.)
   - Optional expiration and IP allowlist

### 7.2 Auth Flow

**Signup:**
```
POST /v1/auth/signup
→ validate email/password
→ hash password with argon2id
→ create User + default Workspace + WorkspaceMember (OWNER)
→ generate email verification token
→ send verification email
→ return 201 with user info (no tokens until verified)
```

**Login:**
```
POST /v1/auth/login
→ lookup user by email
→ verify password (argon2id)
→ generate access + refresh tokens
→ store refresh token hash in DB
→ return { access_token, refresh_token, user }
```

**Refresh:**
```
POST /v1/auth/refresh
→ verify refresh token signature
→ look up hashed version in DB
→ verify not revoked, not expired
→ rotate: revoke old token, issue new pair
→ return new tokens
```

**Logout:**
```
POST /v1/auth/logout
→ revoke refresh token in DB
→ 204 No Content
```

### 7.3 JWT Payload Structure

```typescript
// Access Token
{
  sub: string;           // user id
  email: string;
  workspaces: Array<{
    id: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  }>;
  type: 'access';
  iat: number;
  exp: number;
  jti: string;           // unique token id
}
```

### 7.4 Authorization (RBAC)

Role capabilities:

| Action                 | OWNER | ADMIN | MEMBER | VIEWER |
|------------------------|-------|-------|--------|--------|
| Manage billing         | ✅    | ❌    | ❌     | ❌     |
| Delete workspace       | ✅    | ❌    | ❌     | ❌     |
| Invite members         | ✅    | ✅    | ❌     | ❌     |
| Manage API keys        | ✅    | ✅    | ❌     | ❌     |
| Create/edit agents     | ✅    | ✅    | ✅     | ❌     |
| Execute agents         | ✅    | ✅    | ✅     | ✅     |
| View logs/traces       | ✅    | ✅    | ✅     | ✅     |

Enforced via `@Roles()` decorator + `RolesGuard`.

### 7.5 Workspace Scoping

**Every query must be scoped to current workspace.**

Implementation: `CurrentWorkspace` decorator extracts workspace from JWT or API key context. All services accept `workspaceId` as first parameter and include it in every Prisma `where` clause.

Example:
```typescript
@Get()
findAll(@CurrentWorkspace() workspace: WorkspaceContext) {
  return this.agentsService.findAll(workspace.id);
}

// In service:
findAll(workspaceId: string) {
  return this.prisma.agent.findMany({
    where: { workspaceId, deletedAt: null },
  });
}
```

---

## 8. Core Modules Specification

### 8.1 Auth Module

**Responsibilities:** Signup, login, refresh, logout, email verification, password reset.

**Key Services:**
- `AuthService` — orchestration
- `PasswordService` — argon2id hashing/verification
- `TokenService` — JWT generation/verification
- `EmailService` — transactional emails (use Resend / SendGrid / SMTP abstraction)

**Dependencies:** `UsersService`, `WorkspacesService`, `PrismaService`

### 8.2 Workspaces Module

**Responsibilities:** CRUD workspaces, manage members, role assignments, invitations.

**Key Services:** `WorkspacesService`, `MembersService`, `InvitationsService`

### 8.3 API Keys Module

**Responsibilities:** Generate, list, revoke API keys. Show plaintext only once at creation.

**Key Logic:**
```typescript
async create(workspaceId: string, dto: CreateApiKeyDto) {
  const plainKey = `agt_live_${crypto.randomBytes(24).toString('base64url')}`;
  const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
  const keyPrefix = plainKey.slice(0, 12);

  const apiKey = await this.prisma.apiKey.create({
    data: { workspaceId, keyHash, keyPrefix, ... },
  });

  return { ...apiKey, key: plainKey }; // plaintext returned ONCE
}
```

### 8.4 Agents Module

**Responsibilities:** CRUD agents, attach tools, attach knowledge bases, validate config.

**Validation Rules:**
- `systemPrompt` max 32,000 chars
- `model` must be supported by selected `provider`
- `maxSteps` between 1 and 50
- `temperature` between 0 and 2

### 8.5 Tools Module

**Responsibilities:** CRUD tool definitions. Validate JSON schema for parameters.

**Tool Types:**
- **HTTP:** user-defined REST endpoint that the agent can invoke
- **BUILT_IN:** platform-provided (web search, code exec, calculator, etc.)
- **MCP:** Model Context Protocol server integration (Phase 2)

### 8.6 Knowledge Bases Module

**Responsibilities:** Create KBs, upload documents, manage chunking config, search.

### 8.7 Documents Module

**Responsibilities:** Upload, parse, chunk, embed documents. Async via BullMQ.

**Document Processing Flow:**
1. `POST /v1/knowledge-bases/:id/documents` with file or URL
2. Upload raw file to object storage
3. Create `Document` record with status `PENDING`
4. Enqueue `document.process` job
5. Worker: download → extract text (pdf-parse, mammoth, unified) → chunk (recursive character splitter) → embed in batches → insert `DocumentChunk` rows
6. Update document status to `INDEXED` or `FAILED`

**Supported Formats:** PDF, DOCX, TXT, MD, HTML, CSV, JSON

### 8.8 Threads Module

**Responsibilities:** Manage conversation threads. Thread = persistent conversation between user and agent.

### 8.9 Messages Module

**Responsibilities:** Read messages within a thread. Messages are created by the Runtime, not directly via API (except for seeding `SYSTEM`/`USER` messages).

### 8.10 Runs Module

**Responsibilities:** Create runs (execute an agent), track status, stream output.

**Run Lifecycle:**
```
PENDING → IN_PROGRESS → (REQUIRES_ACTION ↔ IN_PROGRESS) → COMPLETED | FAILED | CANCELLED | TIMEOUT
```

### 8.11 Memory Module

**Responsibilities:** Store and retrieve long-term memories. Semantic search via embeddings.

### 8.12 LLM Providers Module

**Responsibilities:** Unified interface over OpenAI, Anthropic, etc.

**Interface:**
```typescript
interface LlmProvider {
  name: string;
  completion(params: CompletionParams): Promise<CompletionResponse>;
  completionStream(params: CompletionParams): AsyncIterable<CompletionChunk>;
  supportsToolCalling: boolean;
  countTokens(text: string, model: string): number;
  estimateCost(inputTokens: number, outputTokens: number, model: string): number;
}
```

### 8.13 Webhooks Module

**Responsibilities:** CRUD webhook endpoints, deliver events.

### 8.14 Usage Module

**Responsibilities:** Aggregate usage events, expose dashboards data, enforce quotas.

### 8.15 Billing Module (Phase 2)

**Responsibilities:** Stripe integration, plan management, invoice generation.

### 8.16 Traces Module

**Responsibilities:** Read trace spans for observability dashboard.

---

## 9. REST API Endpoints

All endpoints prefixed with `/v1`. Return format:

```json
{
  "data": { ... },       // or array
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

Error format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Agent not found",
    "details": { ... }
  }
}
```

### 9.1 Auth

| Method | Path                         | Description                     | Auth     |
|--------|------------------------------|---------------------------------|----------|
| POST   | `/auth/signup`               | Create account                  | Public   |
| POST   | `/auth/login`                | Login with email/password       | Public   |
| POST   | `/auth/refresh`              | Rotate refresh token            | Public   |
| POST   | `/auth/logout`               | Revoke refresh token            | JWT      |
| POST   | `/auth/verify-email`         | Verify email with token         | Public   |
| POST   | `/auth/request-password-reset` | Send password reset email     | Public   |
| POST   | `/auth/reset-password`       | Reset password with token       | Public   |
| GET    | `/auth/me`                   | Current user info               | JWT      |

### 9.2 Workspaces

| Method | Path                                    | Description               |
|--------|-----------------------------------------|---------------------------|
| GET    | `/workspaces`                           | List my workspaces        |
| POST   | `/workspaces`                           | Create workspace          |
| GET    | `/workspaces/:id`                       | Get workspace             |
| PATCH  | `/workspaces/:id`                       | Update workspace          |
| DELETE | `/workspaces/:id`                       | Delete workspace          |
| GET    | `/workspaces/:id/members`               | List members              |
| POST   | `/workspaces/:id/members/invite`        | Invite member             |
| PATCH  | `/workspaces/:id/members/:memberId`     | Change role               |
| DELETE | `/workspaces/:id/members/:memberId`     | Remove member             |

### 9.3 API Keys

| Method | Path                                | Description                        |
|--------|-------------------------------------|------------------------------------|
| GET    | `/api-keys`                         | List (workspace-scoped)            |
| POST   | `/api-keys`                         | Create (returns plaintext once)    |
| DELETE | `/api-keys/:id`                     | Revoke                             |

### 9.4 Agents

| Method | Path                                | Description                   |
|--------|-------------------------------------|-------------------------------|
| GET    | `/agents`                           | List agents                   |
| POST   | `/agents`                           | Create agent                  |
| GET    | `/agents/:id`                       | Get agent                     |
| PATCH  | `/agents/:id`                       | Update agent                  |
| DELETE | `/agents/:id`                       | Delete agent (soft)           |
| POST   | `/agents/:id/tools`                 | Attach tool                   |
| DELETE | `/agents/:id/tools/:toolId`         | Detach tool                   |
| POST   | `/agents/:id/knowledge-bases`       | Attach KB                     |
| DELETE | `/agents/:id/knowledge-bases/:kbId` | Detach KB                     |
| POST   | `/agents/:id/runs`                  | Execute agent (sync)          |
| POST   | `/agents/:id/runs/stream`           | Execute agent (SSE stream)    |

### 9.5 Tools

| Method | Path                | Description        |
|--------|---------------------|--------------------|
| GET    | `/tools`            | List tools         |
| POST   | `/tools`            | Create tool        |
| GET    | `/tools/:id`        | Get tool           |
| PATCH  | `/tools/:id`        | Update tool        |
| DELETE | `/tools/:id`        | Delete tool        |
| POST   | `/tools/:id/test`   | Test tool invocation |

### 9.6 Knowledge Bases

| Method | Path                                           | Description              |
|--------|------------------------------------------------|--------------------------|
| GET    | `/knowledge-bases`                             | List KBs                 |
| POST   | `/knowledge-bases`                             | Create KB                |
| GET    | `/knowledge-bases/:id`                         | Get KB                   |
| PATCH  | `/knowledge-bases/:id`                         | Update KB                |
| DELETE | `/knowledge-bases/:id`                         | Delete KB                |
| POST   | `/knowledge-bases/:id/search`                  | Semantic search          |
| GET    | `/knowledge-bases/:id/documents`               | List documents           |
| POST   | `/knowledge-bases/:id/documents`               | Upload document          |
| DELETE | `/knowledge-bases/:id/documents/:docId`        | Delete document          |
| POST   | `/knowledge-bases/:id/documents/:docId/reindex`| Reindex document         |

### 9.7 Threads & Runs

| Method | Path                                    | Description                 |
|--------|-----------------------------------------|-----------------------------|
| GET    | `/threads`                              | List threads (filterable)   |
| POST   | `/threads`                              | Create thread               |
| GET    | `/threads/:id`                          | Get thread                  |
| DELETE | `/threads/:id`                          | Delete thread               |
| GET    | `/threads/:id/messages`                 | List messages               |
| POST   | `/threads/:id/messages`                 | Append user message         |
| GET    | `/runs/:id`                             | Get run status              |
| POST   | `/runs/:id/cancel`                      | Cancel run                  |
| POST   | `/runs/:id/submit-tool-outputs`         | Submit tool results (if REQUIRES_ACTION) |
| GET    | `/runs/:id/traces`                      | Get execution traces        |

### 9.8 Memory

| Method | Path                     | Description                 |
|--------|--------------------------|-----------------------------|
| GET    | `/memories`              | List memories (filterable)  |
| POST   | `/memories`              | Create memory               |
| GET    | `/memories/:id`          | Get memory                  |
| PATCH  | `/memories/:id`          | Update memory               |
| DELETE | `/memories/:id`          | Delete memory               |
| POST   | `/memories/search`       | Semantic search             |

### 9.9 Webhooks

| Method | Path                                | Description                |
|--------|-------------------------------------|----------------------------|
| GET    | `/webhooks`                         | List endpoints             |
| POST   | `/webhooks`                         | Create endpoint            |
| PATCH  | `/webhooks/:id`                     | Update endpoint            |
| DELETE | `/webhooks/:id`                     | Delete endpoint            |
| GET    | `/webhooks/:id/deliveries`          | List delivery attempts     |
| POST   | `/webhooks/:id/deliveries/:deliveryId/retry` | Retry delivery    |

### 9.10 Usage & Analytics

| Method | Path                      | Description                       |
|--------|---------------------------|-----------------------------------|
| GET    | `/usage/summary`          | Aggregated usage (daily/monthly)  |
| GET    | `/usage/events`           | Raw usage events (paginated)      |

### 9.11 Health & Meta

| Method | Path         | Description              |
|--------|--------------|--------------------------|
| GET    | `/health`    | Liveness probe           |
| GET    | `/ready`     | Readiness probe (DB+Redis reachable) |
| GET    | `/metrics`   | Prometheus metrics       |

---

## 10. Agent Runtime Engine

The heart of the system. Implements the reasoning loop with tool use, RAG, and memory.

### 10.1 Runtime Algorithm (Pseudocode)

```
function execute(agent, thread, userInput):
  run = createRun(agent, thread, status=IN_PROGRESS)
  trace = startTrace(run)

  messages = [systemPrompt(agent)]
  messages += loadThreadHistory(thread, limit=contextWindow)

  if agent.knowledgeBases:
    ragResults = searchRelevantChunks(agent, userInput)
    messages += formatRagContext(ragResults)

  memoryResults = searchMemory(agent, thread, userInput)
  messages += formatMemoryContext(memoryResults)

  messages.append({ role: USER, content: userInput })
  persistMessage(USER, userInput)

  toolDefinitions = buildToolSchemas(agent.tools)
  step = 0

  while step < agent.maxSteps:
    step++
    updateRun(run, stepCount=step)

    llmSpan = trace.startSpan("llm.completion", { model, step })
    response = llm.completion({
      model: agent.model,
      messages,
      tools: toolDefinitions,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    })
    llmSpan.end({ usage: response.usage })

    recordUsage(run, response.usage)

    if response.finishReason == "tool_calls":
      assistantMsg = persistMessage(ASSISTANT, response.content, response.toolCalls)
      messages.append(assistantMsg)

      for toolCall in response.toolCalls:
        toolSpan = trace.startSpan("tool.call", { name: toolCall.name })
        try:
          result = executeTool(toolCall, workspace)
          toolSpan.end({ output: result })
        catch (error):
          result = { error: error.message }
          toolSpan.end({ error })

        toolMsg = persistMessage(TOOL, result, toolCallId=toolCall.id)
        messages.append(toolMsg)

      continue

    else if response.finishReason == "stop":
      persistMessage(ASSISTANT, response.content)
      updateRun(run, status=COMPLETED, completedAt=now())
      extractAndStoreMemories(agent, thread, messages)
      emitWebhook("run.completed", run)
      return run

    else:
      updateRun(run, status=FAILED, errorMessage=`unexpected finish: ${response.finishReason}`)
      return run

  updateRun(run, status=FAILED, errorCode="MAX_STEPS_EXCEEDED")
  emitWebhook("run.failed", run)
  return run
```

### 10.2 Context Window Management

Models have limited context windows (e.g., 128K tokens for GPT-4o, 200K for Claude). Runtime must:

1. Count tokens for each message (use provider's tokenizer: `tiktoken` for OpenAI, `@anthropic-ai/tokenizer` for Anthropic).
2. Reserve space for: system prompt + tool schemas + output buffer (e.g., `maxTokens`).
3. If thread history exceeds remaining budget:
   - Summarize older messages into a single summary message (sliding window with summarization).
   - Or drop oldest messages (simple but lossy).

### 10.3 Tool Call Validation

Before executing any tool call:
- Validate arguments against tool's JSON schema
- Check tool is attached to this agent
- Check workspace permissions
- Apply timeout (default 30s, configurable per tool)
- Catch and format errors as tool results (don't crash the run)

### 10.4 Run Cancellation

Cancellation via `POST /runs/:id/cancel`:
- Set a Redis key `run:cancel:<runId>` with TTL
- Runtime checks this key before each LLM call
- If set → updates run status to `CANCELLED`, exits loop
- Workers poll this key too (for async runs)

---

## 11. RAG Pipeline

### 11.1 Document Ingestion Flow

```
User uploads file
    │
    ▼
Save to object storage (S3/MinIO)
    │
    ▼
Create Document row (status=PENDING)
    │
    ▼
Enqueue "document.process" job
    │
    ▼
┌────────── Worker picks up job ──────────┐
│                                          │
│  1. Download file from storage          │
│  2. Extract text (format-specific):     │
│     • PDF: pdf-parse / unpdf            │
│     • DOCX: mammoth                     │
│     • HTML: cheerio + readability       │
│     • MD/TXT: direct                    │
│  3. Clean text (normalize whitespace)   │
│  4. Chunk with RecursiveCharacterSplit  │
│     (chunkSize, chunkOverlap from KB)   │
│  5. Batch embed (OpenAI batch API)      │
│  6. Insert DocumentChunk rows           │
│     (with embedding vector)             │
│  7. Update Document status=INDEXED      │
│                                          │
└──────────────────────────────────────────┘
```

### 11.2 Chunking Strategy

Use recursive character splitter:
- Split by `\n\n`, then `\n`, then `. `, then ` `, then char
- Respect chunk size (default 1000 chars, configurable per KB)
- Apply overlap (default 200 chars)
- Track metadata: source document, page number (for PDFs), chunk index

### 11.3 Embedding

- Default model: `text-embedding-3-small` (1536 dimensions, cheap)
- Batch up to 100 chunks per API call
- Retry with exponential backoff on rate limits
- Store embedding in `document_chunks.embedding` (pgvector)

### 11.4 Retrieval (Semantic Search)

```sql
SELECT
  dc.id, dc.content, d.name as document_name,
  1 - (dc.embedding <=> $1::vector) AS similarity
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
WHERE d.knowledge_base_id = ANY($2::uuid[])
  AND 1 - (dc.embedding <=> $1::vector) >= $3
ORDER BY dc.embedding <=> $1::vector
LIMIT $4;
```

### 11.5 Injection into Prompt

```
<context>
Retrieved from knowledge base:

[Source: product-docs.pdf]
Agentify supports streaming responses via Server-Sent Events...

[Source: faq.md]
Yes, you can host Agentify on your own infrastructure...
</context>

User question: How do I stream responses?
```

### 11.6 Future Enhancements

- **Hybrid search:** combine vector similarity with BM25 keyword search
- **Reranking:** use Cohere Rerank or similar to reorder top-N results
- **Query expansion:** let LLM rewrite user query into better search query

---

## 12. Tool Execution System

### 12.1 Tool Schema (what LLM sees)

```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get current weather for a city",
    "parameters": {
      "type": "object",
      "properties": {
        "city": { "type": "string", "description": "City name" },
        "unit": { "type": "string", "enum": ["celsius", "fahrenheit"] }
      },
      "required": ["city"]
    }
  }
}
```

### 12.2 HTTP Tool Executor

For user-defined HTTP tools:
- Validate arguments against JSON schema (Ajv)
- Template URL, headers, body with Handlebars: `https://api.example.com/weather/{{city}}`
- Apply auth (bearer, basic, api-key)
- Execute with axios + timeout
- Capture response body and status code
- Return stringified response to LLM

**Security:**
- Block private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
- Block localhost and metadata endpoints (169.254.169.254)
- Max response size: 1 MB
- Max timeout: 60s (hard cap)

### 12.3 Built-in Tools

Initial set:

| Tool            | Description                                  |
|-----------------|----------------------------------------------|
| `web_search`    | Search the web (via Tavily/Serper API)       |
| `fetch_url`     | Fetch and extract text from a URL            |
| `calculator`    | Safe math expression evaluator               |
| `current_time`  | Get current datetime in timezone             |
| `knowledge_search` | Explicit RAG search (agent-requested)     |

### 12.4 Tool Result Handling

- If result is > 8000 tokens → truncate with "...[truncated]" marker
- If JSON → pretty-print with 2-space indent
- If binary/image → return URL or description (never raw bytes to LLM)
- On error → return `{ "error": true, "message": "...", "code": "..." }`

---

## 13. Memory System

Three memory layers:

### 13.1 Short-term (Thread Messages)

Implemented via `messages` table. Loaded into context on each run. Managed by context window logic.

### 13.2 Long-term (Semantic Memory)

`memories` table. Vector-searchable. Scopes:
- **Workspace-level:** shared facts about the org (`threadId=null, userId=null`)
- **User-level:** facts about a specific end user (`userId=...`)
- **Thread-level:** durable facts within a thread (`threadId=...`)

### 13.3 Memory Extraction

After each run completes, optionally extract memories:
1. Build a "memory extraction" prompt with the full conversation
2. Ask LLM: "Extract durable facts about the user or context. Format as JSON array of { key, content, importance }."
3. Embed and store each extracted memory

This is an optional step — can be toggled per-agent via `extractMemory: boolean`.

### 13.4 Memory Retrieval

Before each run:
1. Embed the current user input
2. Search memories scoped to (workspace + agent + thread/user) by cosine similarity
3. Filter by `importance >= threshold`
4. Include top-K in system prompt:

```
<memories>
- The user's name is Abdullah.
- User prefers TypeScript over JavaScript.
- User is building a multi-tenant SaaS.
</memories>
```

---

## 14. Background Jobs (BullMQ)

### 14.1 Queue Definitions

| Queue Name          | Purpose                                     | Concurrency |
|---------------------|---------------------------------------------|-------------|
| `agent-run`         | Execute agent runs asynchronously           | 10          |
| `document-process`  | Parse, chunk, embed documents               | 5           |
| `webhook-dispatch`  | Deliver outbound webhooks                   | 20          |
| `usage-aggregation` | Roll up usage events (hourly/daily)         | 1           |
| `memory-extraction` | Extract memories from completed runs        | 5           |

### 14.2 Job Configuration Standards

```typescript
const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};
```

### 14.3 Retry & Dead Letter

- Failed jobs after all retries → move to dead letter queue
- Expose dead letter queue via admin API (`GET /admin/dead-jobs`)
- Alert via Slack/Discord webhook on dead job accumulation

### 14.4 Scheduled Jobs

Use BullMQ repeatable jobs:
- Usage aggregation: every hour
- Clean expired refresh tokens: daily
- Clean expired memories: daily
- Retry stuck webhook deliveries: every 5 min

---

## 15. Streaming Responses (SSE)

### 15.1 Endpoint

`POST /v1/agents/:id/runs/stream`

Returns `Content-Type: text/event-stream` with the following event types:

```
event: run.created
data: {"run_id":"...","status":"IN_PROGRESS"}

event: message.delta
data: {"delta":"Hello"}

event: message.delta
data: {"delta":" world"}

event: tool_call.started
data: {"tool":"get_weather","arguments":{"city":"Karachi"}}

event: tool_call.completed
data: {"tool":"get_weather","output":{"temp":32}}

event: message.completed
data: {"message_id":"..."}

event: run.completed
data: {"run_id":"...","usage":{"input_tokens":123,"output_tokens":45}}
```

### 15.2 Implementation (NestJS)

```typescript
@Post(':id/runs/stream')
@Sse()
async streamRun(@Param('id') id: string, @Body() dto: RunAgentDto) {
  return this.runtimeService.executeStream(id, dto);
}
```

`executeStream` returns an `Observable<MessageEvent>`. Internally uses an async generator bridged to RxJS.

### 15.3 Client Disconnection

Detect client disconnect → mark run as `CANCELLED` (similar to explicit cancel).

---

## 16. Webhooks System

### 16.1 Event Types

- `run.created`
- `run.completed`
- `run.failed`
- `run.cancelled`
- `document.indexed`
- `document.failed`

### 16.2 Payload Format

```json
{
  "id": "evt_abc123",
  "type": "run.completed",
  "created": 1735000000,
  "workspace_id": "ws_...",
  "data": {
    "run_id": "run_...",
    "agent_id": "agent_...",
    "thread_id": "thread_...",
    "status": "COMPLETED",
    "usage": { "input_tokens": 123, "output_tokens": 45 }
  }
}
```

### 16.3 Signature

Sign payload with HMAC-SHA256 using endpoint secret. Send as header:

```
X-Agentify-Signature: t=1735000000,v1=<hex_digest>
X-Agentify-Event-Id: evt_abc123
X-Agentify-Event-Type: run.completed
```

Digest is computed over: `<timestamp>.<raw_body>`

### 16.4 Delivery & Retry

- Max 5 attempts, exponential backoff (1m, 5m, 30m, 2h, 12h)
- Timeout per attempt: 10s
- Success: HTTP 2xx response
- Failure: non-2xx, timeout, connection error
- Delivery status tracked in `webhook_deliveries`

---

## 17. Rate Limiting & Quotas

### 17.1 Plan Limits (Defaults)

| Plan        | Runs/month | Tokens/month | KB docs | Members | Webhook endpoints |
|-------------|------------|--------------|---------|---------|-------------------|
| FREE        | 1,000      | 500,000      | 50      | 2       | 1                 |
| PRO         | 50,000     | 5,000,000    | 1,000   | 10      | 10                |
| ENTERPRISE  | unlimited  | custom       | custom  | custom  | unlimited         |

### 17.2 Request Rate Limits

Per workspace:
- 60 req/min burst, 600 req/hour sustained (FREE)
- 300 req/min, 10,000/hour (PRO)
- Custom (ENTERPRISE)

Implementation: `RateLimitGuard` using Redis sliding window.

### 17.3 Quota Enforcement

Before creating a run:
```typescript
const usage = await this.usageService.getCurrentMonthUsage(workspaceId);
if (usage.runs >= plan.runsLimit) {
  throw new PaymentRequiredException('Run quota exceeded');
}
```

---

## 18. Observability & Tracing

### 18.1 Application Logs

Structured JSON via Pino:
```json
{
  "level":"info",
  "time":"2026-04-22T12:34:56.789Z",
  "req_id":"abc",
  "workspace_id":"ws_...",
  "msg":"agent run started",
  "agent_id":"agent_...",
  "run_id":"run_..."
}
```

### 18.2 OpenTelemetry Traces

Auto-instrument NestJS + Prisma + Redis + HTTP. Custom spans for:
- `agent.run`
- `llm.completion`
- `tool.call`
- `rag.search`
- `memory.search`

Export to OTLP collector (Jaeger/Tempo/Honeycomb compatible).

### 18.3 Metrics (Prometheus)

Exposed at `/metrics`:
- `http_requests_total{method, route, status}`
- `http_request_duration_seconds{method, route}`
- `agent_runs_total{workspace, agent, status}`
- `agent_run_duration_seconds{workspace, agent}`
- `llm_tokens_total{provider, model, type}` (type=input|output)
- `llm_cost_usd_total{provider, model}`
- `queue_jobs_active{queue}`
- `queue_jobs_completed_total{queue, status}`

### 18.4 Custom Trace Storage

`trace_spans` table stores execution traces for user-facing observability dashboard. Retention: 30 days (configurable per plan).

---

## 19. Security Requirements

### 19.1 Password Handling

- Hash with argon2id (memory=64MB, iterations=3, parallelism=4)
- Never log passwords
- Min length 10, require mix of char types

### 19.2 Secret Storage

- Tool credentials (API keys, bearer tokens): encrypted with AES-256-GCM
- Encryption key from `ENCRYPTION_KEY` env var (32 bytes, base64)
- Rotate via key versioning

### 19.3 SSRF Protection

- Reject private IP ranges for HTTP tools and URL fetching
- Use an allowlist mode optionally (workspace-configurable)

### 19.4 Injection Prevention

- All DB queries via Prisma (parameterized)
- Never interpolate user input into raw SQL
- Sanitize file names on upload

### 19.5 CORS

Configurable per deployment. Default: reject cross-origin. For dashboard: specific origin allowlist.

### 19.6 Content Security

- Validate uploaded file MIME types
- Virus scan uploads (ClamAV optional)
- Max file size per plan (10MB FREE, 100MB PRO)

### 19.7 Prompt Injection Awareness

Document this as a known concern. Mitigations:
- Clearly separate system prompt from user content in UI
- Never auto-execute tool calls that modify external state without confirmation (for Phase 2)
- Log all tool calls for audit

### 19.8 Audit Logging

All security-relevant actions written to `audit_logs`:
- Auth events (login, logout, failed login, password change)
- API key create/revoke
- Member role changes
- Workspace deletion
- Tool execution failures

---

## 20. Environment Variables

```env
# App
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
APP_URL=http://localhost:3000
DASHBOARD_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://agentify:password@localhost:5432/agentify

# Redis
REDIS_URL=redis://localhost:6379
REDIS_TLS=false

# JWT
JWT_PRIVATE_KEY=<PEM contents>
JWT_PUBLIC_KEY=<PEM contents>
JWT_ACCESS_TTL=900        # 15 min
JWT_REFRESH_TTL=2592000   # 30 days

# Encryption
ENCRYPTION_KEY=<base64 32-byte key>

# Object Storage (S3-compatible)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=agentify-uploads
S3_FORCE_PATH_STYLE=true

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434

# Embeddings
DEFAULT_EMBEDDING_MODEL=text-embedding-3-small
DEFAULT_EMBEDDING_DIMENSIONS=1536

# Email (SMTP or API)
EMAIL_PROVIDER=smtp         # smtp | resend | sendgrid
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM="Agentify <noreply@agentify.dev>"

# Built-in Tool APIs
TAVILY_API_KEY=...
SERPER_API_KEY=...

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=agentify-api
PROMETHEUS_ENABLED=true

# Rate Limiting
RATE_LIMIT_ENABLED=true

# Feature Flags
FEATURE_WEBHOOKS=true
FEATURE_BILLING=false

# Stripe (Phase 2)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 21. Docker & Deployment

### 21.1 docker-compose.dev.yml

```yaml
version: "3.9"
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: agentify
      POSTGRES_PASSWORD: password
      POSTGRES_DB: agentify
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redisdata:/data"]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: ["miniodata:/data"]

  # Optional observability stack
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports: ["16686:16686", "4318:4318"]
    environment:
      COLLECTOR_OTLP_ENABLED: "true"

volumes:
  pgdata:
  redisdata:
  miniodata:
```

### 21.2 api.Dockerfile (Multi-stage)

```dockerfile
# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build -- --workspace=api

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
EXPOSE 3000
CMD ["node", "dist/apps/api/main.js"]
```

### 21.3 Production Deployment Options

- **Self-hosted VPS:** docker-compose with Caddy/Traefik reverse proxy
- **Kubernetes:** Helm chart (provide `helm/` directory)
- **Managed:** Fly.io, Railway, Render (straightforward with Dockerfile)

### 21.4 Database Migration Strategy

- `prisma migrate deploy` runs on container startup (or init container)
- Raw SQL migrations for pgvector indexes
- Always backward-compatible migrations (never drop columns without deprecation)

---

## 22. Development Phases (Roadmap)

### Week 1–2: Foundation
- Initialize NestJS monorepo
- Set up Prisma + PostgreSQL + pgvector
- Configure Docker Compose
- Implement base `config`, `database`, `common` libs
- Set up logging, error handling, validation

### Week 3: Auth & Users
- Auth module (signup, login, refresh, logout)
- Users module
- Workspaces + members
- API keys module
- RBAC guards and decorators

### Week 4: Agents & Tools
- Agents CRUD
- Tools CRUD (HTTP tools first)
- Tool JSON schema validation
- Agent-Tool attachment

### Week 5–6: Knowledge Base & RAG
- Knowledge base CRUD
- Document upload to S3/MinIO
- Document processing worker (parse + chunk + embed)
- Vector search via pgvector
- Agent-KB attachment

### Week 7–8: Agent Runtime
- LLM provider abstraction (OpenAI, Anthropic)
- Synchronous run execution
- Thread + message management
- Tool execution with schema validation
- Token counting and usage recording

### Week 9: Streaming & Async
- SSE streaming endpoint
- Async runs via BullMQ
- Run cancellation

### Week 10: Memory
- Memory module
- Memory extraction post-run
- Semantic memory retrieval

### Week 11: Observability & Webhooks
- Trace spans recording
- Prometheus metrics
- Webhook endpoints + delivery

### Week 12: Polish
- Swagger docs complete
- Rate limiting
- Quota enforcement
- Comprehensive tests
- Deployment guide
- README with examples

### Post-MVP
- Stripe billing
- Advanced LLM providers
- Multi-step workflows
- Dashboard UI

---

## 23. Testing Strategy

### 23.1 Unit Tests (Jest)

- All services tested with mocked Prisma (use `jest-mock-extended`)
- All utility functions
- All guards and decorators

Target coverage: 80%+ for services and guards.

### 23.2 Integration Tests

- Tests run against real Postgres + Redis (via Testcontainers)
- Cover happy paths for each module
- Cover key failure modes (unauthorized, not found, validation errors)

### 23.3 E2E Tests (Supertest)

- Full workflows:
  - User signup → create workspace → create agent → create API key → execute agent → verify response
  - Upload document → verify indexed → search returns relevant chunks
  - Execute agent with tool call → verify tool invoked → verify final message
- Mock LLM responses via MSW or a fake provider

### 23.4 Load Testing (k6)

- Target: 100 concurrent agent runs
- Target: 1000 requests/sec on `/health`
- Identify bottlenecks (DB connections, Redis throughput)

### 23.5 Test Data Seeding

`scripts/seed.ts` creates:
- Demo user (email: demo@agentify.dev, password: demo1234)
- Demo workspace
- Sample agents (support bot, research assistant)
- Sample tools
- Sample knowledge base with a few docs

---

## 24. Coding Standards

### 24.1 TypeScript

- `strict: true` in tsconfig
- No `any` without explicit justification
- Prefer interfaces over types for public APIs

### 24.2 NestJS Conventions

- One module per domain
- Controllers thin, Services contain logic
- DTOs for all request/response shapes
- Use `class-validator` decorators on DTOs
- Use `@ApiProperty()` on DTOs for Swagger

### 24.3 File Naming

- kebab-case for files: `agent-runtime.service.ts`
- PascalCase for classes: `AgentRuntimeService`
- Constants UPPER_SNAKE: `MAX_AGENT_STEPS`

### 24.4 Error Handling

- Use NestJS built-in exceptions (`NotFoundException`, etc.)
- Domain-specific errors: extend a base `AppException` with `code`, `message`, `statusCode`
- Never leak internal details in production error responses

### 24.5 Git Workflow

- Trunk-based development on `main`
- Feature branches: `feat/<name>`, `fix/<name>`
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- PR requires passing CI + 1 review

### 24.6 CI Pipeline (GitHub Actions)

- On every PR:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:e2e` (with Postgres+Redis services)
  - `docker build`
- On merge to `main`:
  - Build and push Docker images
  - Deploy to staging

---

## Appendix A: Glossary

- **Agent:** Configured AI persona with system prompt, tools, knowledge bases, and model settings.
- **Thread:** Persistent conversation session between a user and an agent.
- **Run:** A single execution of an agent on a thread, producing one or more messages.
- **Tool:** A function the agent can invoke (HTTP endpoint, built-in action, MCP server).
- **Knowledge Base:** A collection of documents embedded for retrieval.
- **Memory:** Durable facts extracted from conversations, semantically searchable.
- **Workspace:** Tenant boundary — all resources scoped to a workspace.
- **Trace Span:** A recorded unit of work within a run (LLM call, tool call, RAG search).

---

## Appendix B: Example API Usage

### Create Agent

```bash
curl -X POST https://api.agentify.dev/v1/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Bot",
    "description": "Answers customer support questions",
    "systemPrompt": "You are a helpful customer support assistant for Acme Corp...",
    "model": "claude-sonnet-4-5",
    "provider": "anthropic",
    "temperature": 0.3,
    "maxTokens": 2048,
    "maxSteps": 8
  }'
```

### Execute Agent

```bash
curl -X POST https://api.agentify.dev/v1/agents/agent_abc/runs \
  -H "X-API-Key: agt_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "thread_xyz",
    "input": "How do I reset my password?"
  }'
```

### Stream Agent

```bash
curl -N -X POST https://api.agentify.dev/v1/agents/agent_abc/runs/stream \
  -H "X-API-Key: agt_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "thread_xyz",
    "input": "Tell me a story"
  }'
```

---

## Appendix C: Instructions for Claude Code

When implementing this project, please follow these guidelines:

1. **Read the entire document first** before starting implementation.
2. **Follow the phase roadmap** — don't try to build everything at once.
3. **Start with the folder structure** exactly as specified in Section 5.
4. **Generate the Prisma schema first**, run initial migration, verify DB works.
5. **For each module:** create module → DTOs → service → controller → tests → wire into AppModule.
6. **Write integration tests as you go**, not at the end.
7. **Never commit secrets.** Use `.env.example` as a template; real `.env` stays local.
8. **Ask for clarification** if a requirement is ambiguous rather than guessing.
9. **Use the exact enum values and field names** specified in the schema.
10. **Respect the API response shape** (`{ data, meta }` / `{ error }`) consistently.

When uncertain between two implementation paths, prefer:
- **Simpler** over clever
- **Explicit** over magic
- **Tested** over "works on my machine"
- **Documented** over self-explanatory

---

**END OF DOCUMENT**
