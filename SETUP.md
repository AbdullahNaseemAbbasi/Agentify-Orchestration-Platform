# SETUP.md — Local Development Quickstart

> Sab commands jo aap ko chahiye kisi bhi machine pe project chalane ke liye. Roman Urdu + English mixed.

---

## Step 0: Prerequisites (One-Time)

Pehli baar machine pe install karo:

| Software           | Version | Download                                          |
| ------------------ | ------- | ------------------------------------------------- |
| **Node.js**        | 20+ LTS | https://nodejs.org/                               |
| **Docker Desktop** | Latest  | https://www.docker.com/products/docker-desktop   |
| **Git**            | 2+      | https://git-scm.com/ (or GitHub Desktop)          |

### Verify installation

```bash
node --version    # v20.x.x
npm --version     # 10.x.x
docker --version  # 20+
git --version     # 2+
```

Koi bhi "not found" → install karo.

---

## Step 1: Clone the Repo

### GitHub Desktop

1. **File → Clone repository**
2. URL paste karo: `https://github.com/AbdullahNaseemAbbasi/Agentify-Orchestration-Platform.git`
3. Local path choose karo (e.g., `D:\Projects\Agentify`)
4. **Clone**

### Or via command line

```bash
git clone https://github.com/AbdullahNaseemAbbasi/Agentify-Orchestration-Platform.git
cd Agentify-Orchestration-Platform
```

---

## Step 2: Install Dependencies

Project folder ke andar (terminal):

```bash
npm install
```

~30–60 seconds. 486 packages download honge `node_modules/` mein.

---

## Step 3: Environment File

`.env.example` mein dummy values hain — local dev ke liye yehi theek hain. Copy kar do:

```bash
# Windows cmd
copy .env.example .env

# Bash / Git Bash / WSL
cp .env.example .env
```

> ⚠️ `.env` `.gitignore` mein hai — kabhi commit nahi hogi.

---

## Step 4: Start Docker Desktop

Docker Desktop kholo (Start menu). **Wait for "Engine running"** (green icon, ~30 seconds).

Verify:

```bash
docker info
```

Output mein "Server: ... Running" dikhe = ready ho.

---

## Step 5: Start Database Stack

```bash
docker compose -f docker-compose.dev.yml up -d
```

**Pehli baar:** ~2-3 minutes (images download). **Doosri baar se:** ~5-10 seconds.

### Verify all services healthy

```bash
docker compose -f docker-compose.dev.yml ps
```

Expected:

```
agentify-postgres   Up X seconds (healthy)   0.0.0.0:5433->5432/tcp
agentify-redis      Up X seconds (healthy)   0.0.0.0:6381->6379/tcp
agentify-minio      Up X seconds (healthy)   0.0.0.0:9000-9001->9000-9001/tcp
```

⚠️ Port conflict aaye to ports already use ho rahe hain (doosri Postgres/Redis instances). Adjust required.

---

## Step 6: Run the API

```bash
npm run start:dev
```

Terminal output:

```
[Bootstrap] Agentify API listening on http://localhost:3000
```

Watch mode hai — file save karne pe automatically restart hoga.

---

## Step 7: Verify End-to-End

**Naya terminal** (purana NestJS busy hai):

```bash
curl http://localhost:3000
```

Expected: `Hello from Agentify API!`

Or browser mein **http://localhost:3000** — text dikhe ga.

✅ **Sab working!**

---

## 📋 Daily Workflow

### Start a session

```bash
# Make sure Docker Desktop is running

# Terminal 1: containers
docker compose -f docker-compose.dev.yml up -d

# Terminal 2: API (occupies terminal)
npm run start:dev
```

### Pull latest code

```bash
git pull origin main
# OR via GitHub Desktop: "Fetch origin" → "Pull"
```

After pull, agar `package.json` change hua:

```bash
npm install
```

### End a session

```bash
# Terminal 2 (NestJS): Ctrl+C
# Terminal 1: stop containers
docker compose -f docker-compose.dev.yml down
```

> Data persist rahega — `volumes` Docker manage karta hai. Next time start karne pe DB ka data wahi rahega.

### Full reset (DELETES DATA)

```bash
docker compose -f docker-compose.dev.yml down -v
```

`-v` = volumes delete = fresh DB. Sirf tab use karo jab seedha clean slate chahiye.

---

## 🧰 Common Commands Cheatsheet

### Code quality

```bash
npm run lint          # ESLint + auto-fix
npm run lint:check    # check only (CI-style)
npm run format        # Prettier write
npm run format:check  # check only
```

### Build (production)

```bash
npm run build         # compile TS → dist/
npm run start:prod    # run from dist/
```

### Docker inspection

```bash
# Logs
docker compose -f docker-compose.dev.yml logs           # all
docker compose -f docker-compose.dev.yml logs postgres  # one service
docker compose -f docker-compose.dev.yml logs -f redis  # follow live

# Restart one service
docker compose -f docker-compose.dev.yml restart redis

# Get a shell inside Postgres
docker exec -it agentify-postgres psql -U agentify -d agentify

# Get Redis CLI
docker exec -it agentify-redis redis-cli
```

---

## 🌐 Local Service Access

| Service             | URL / Port                           | Credentials                       |
| ------------------- | ------------------------------------ | --------------------------------- |
| API                 | http://localhost:3000                | —                                 |
| Postgres            | `localhost:5433`                     | `agentify` / `password` / `agentify` |
| Redis               | `localhost:6381`                     | no auth (local)                   |
| MinIO API           | http://localhost:9000                | `minioadmin` / `minioadmin`       |
| MinIO Console (web) | http://localhost:9001                | `minioadmin` / `minioadmin`       |

> Ports shifted from defaults (5432, 6379) — Abdullah's machines often have other Postgres/Redis instances on standard ports. Change in `.env` and `docker-compose.dev.yml` if you ever need different ones.

---

## 🆘 Troubleshooting

### `npm install` fails

```bash
npm cache clean --force
rm -rf node_modules package-lock.json   # Bash
# OR Windows cmd:
rmdir /s /q node_modules
del package-lock.json

npm install
```

### Port already in use

```bash
# Windows: dekho port pe kaun hai
netstat -ano | findstr :3000
netstat -ano | findstr :5433

# Bash
lsof -i :3000
```

Solution: Doosre process stop karo, or `.env` mein `PORT=3001` set karo.

### Docker containers won't start

```bash
# Restart Docker Desktop, phir:
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d

# Logs see for errors:
docker compose -f docker-compose.dev.yml logs
```

### `Cannot connect to Docker daemon`

Docker Desktop start nahi hua. Khol lo, wait for green icon, retry.

### Postgres "could not connect" from API

Check krne ke liye:

```bash
docker compose -f docker-compose.dev.yml ps   # postgres healthy?
cat .env                                      # DATABASE_URL right port (5433)?
```

---

## 📝 Quick Summary Card

```bash
# ===== ONE-TIME (fresh clone) =====
cd Agentify-Orchestration-Platform
npm install
cp .env.example .env                            # or 'copy' on Windows cmd

# ===== EVERY SESSION (start) =====
docker compose -f docker-compose.dev.yml up -d
npm run start:dev

# ===== TEST =====
curl http://localhost:3000     # → "Hello from Agentify API!"

# ===== EVERY SESSION (end) =====
# Ctrl+C the API
docker compose -f docker-compose.dev.yml down
```

---

## See Also

- [`README.md`](README.md) — high-level project overview
- [`PROGRESS.md`](PROGRESS.md) — current learning state and next steps
- [`AGENTIFY_SPEC.md`](AGENTIFY_SPEC.md) — full technical specification
