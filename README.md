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

## 📅 Milestone 4: Rota Generation Engine

Milestone 4 introduces automated, constraint-based rota generation using **Google OR-Tools CP-SAT**:

- **Rota Periods & Staffing Demand**: Flexible start/end date selection, daily time bands, required headcount, and optional mandatory skills.
- **Quick Day Copy**: Easily copy Monday's demand or custom day requirements to other days in the period.
- **OR-Tools Constraint Engine**:
  - **Mandatory Hard Constraints**: Active staff only, skills/roles matching, weekly availability & recurring days off, approved leave/sickness blocks (`UnavailabilityBlock`), no overlapping shifts, 11-hour minimum rest between shifts, maximum shifts per week, maximum hours per week, and consecutive working day limits.
  - **Soft Objectives**: Minimize unmet demand slots (weight 10,000) and minimize absolute deviation from contracted weekly hours (weight 1).
- **Honest Solver Outcomes & Diagnostics**:
  - `feasible`: 100% coverage achieved.
  - `partially_feasible`: Valid partial schedule with specific diagnostics on unfilled slots.
  - `infeasible`: Clear explanation of conflicting constraints (e.g. missing skills or 0 active staff).
  - `timeout`: Solver reached configured time limit.
- **Multi-Tenant Workspace Isolation**: Full IDOR protection ensuring rotas and generated shifts are strictly isolated per workspace.

---

## 🚀 Quick Start (Local Development on macOS)

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22)
- **Python**: 3.11+
- **Docker** (optional for containerized PostgreSQL and Mailpit, or use local SQLite for instant zero-dependency testing)

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```

### 3. Backend Setup & Run (macOS)
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

### 4. Frontend Setup & Run (macOS)
In a separate terminal:
```bash
cd apps/web
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Tests & Quality Checks

### Backend Tests & Ruff Linter:
```bash
cd apps/api
source .venv/bin/activate

# Run all 35 unit & integration tests
pytest

# Run Ruff linter checks
ruff check .
```

### Frontend Tests, TypeScript Validation, & Build:
```bash
cd apps/web

# Run all 22 Vitest frontend tests
npm run test:run

# Type checking
npx tsc --noEmit

# Production build bundle
npm run build
```

---

## 📡 API Endpoints (Milestone 4 Additions)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/workspaces/{ws_id}/rotas` | List rotas with pagination & status filters |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas` | Create a new rota period & template demand |
| `GET` | `/api/v1/workspaces/{ws_id}/rotas/{rota_id}` | Retrieve rota with requirements, shifts, & latest run |
| `PATCH` | `/api/v1/workspaces/{ws_id}/rotas/{rota_id}` | Update rota name or status |
| `DELETE` | `/api/v1/workspaces/{ws_id}/rotas/{rota_id}` | Delete rota & cascaded requirements/shifts |
| `PUT` | `/api/v1/workspaces/{ws_id}/rotas/{rota_id}/requirements` | Bulk update daily staffing time bands |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{rota_id}/copy-requirements` | Copy daily demand to multiple target dates |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{rota_id}/generate` | Run OR-Tools CP-SAT constraint generation engine |

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
