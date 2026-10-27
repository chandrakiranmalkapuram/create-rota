# Create Rota

> **Build a fair, clear staff rota in minutes. Check coverage and contracted hours, make adjustments, and export it for your workplace.**

Create Rota is an independent multi-user rota planning web application. It is **not** an employer's official scheduling system and is not affiliated with any employer. Managers use Create Rota to plan shifts, balance contracted hours, ensure coverage, and export clean rotas (CSV, Excel, PDF, Word) into their official workplace system.

---

## 🏛️ Architecture Overview

The codebase is organized as a clean, modular monorepo:

- **`apps/web`**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Lucide icons, Vitest.
- **`apps/api`**: FastAPI, Python 3.11+, SQLAlchemy 2, Alembic, Pydantic v2, Google OR-Tools CP-SAT constraint solver, pytest.
- **`infra/`**: Docker Compose configuration for local PostgreSQL and Mailpit development email sink.
- **`docs/`**: Architecture, security, and scheduling engine specifications.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22)
- **Python**: 3.11+
- **Docker** (optional for containerized PostgreSQL and Mailpit, or use local SQLite for instant zero-dependency testing)

### 2. Environment Setup
Copy the example environment file to both root and backend:
```bash
cp .env.example .env
```

### 3. Start Database & Local Email (Optional with Docker)
```bash
docker compose -f infra/docker-compose.yml up -d
```
*Note: If Docker is not running, the application can use a local SQLite database for development and testing.*

### 4. Backend Setup & Run
```bash
cd apps/api
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .

# Run database migrations
alembic upgrade head

# Start API server on http://localhost:8000
uvicorn app.main:app --reload --port 8000
```
API Documentation will be available at:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 5. Frontend Setup & Run
In a separate terminal:
```bash
cd apps/web
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Tests & Quality Checks

### Backend Tests (pytest & ruff):
```bash
cd apps/api
source .venv/bin/activate
pytest
ruff check .
```

### Frontend Tests & Type Checking (Vitest & tsc):
```bash
cd apps/web
npm run test:run
npm run build
```

---

## 🔒 Security & Data Isolation
- Strict workspace-level authorization on all API endpoints.
- Insecure direct object reference (IDOR) prevention.
- Passwords hashed with Argon2id.
- Time-limited, single-use tokens for email verification and password resets.
- Zero sensitive data in logs.

---

## 📄 License
Proprietary & Confidential.
