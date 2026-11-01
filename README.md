# Create Rota

> **Build a fair, clear staff rota in minutes. Check coverage and contracted hours, make adjustments, and export it for your workplace.**

Create Rota is an independent multi-tenant rota planning web application. It is **not** an employer's official scheduling system and is not affiliated with any employer. Managers use Create Rota to plan shifts, balance contracted hours, ensure coverage, audit overrides, and export clean, production-ready rotas (CSV, Excel, PDF, Word, Clipboard TSV, and print layouts) into their official workplace systems.

---

## 🏛️ Architecture Overview

The codebase is organized as a modular, production-grade monorepo:

- **`apps/web`**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Lucide icons, Vitest, Testing Library.
- **`apps/api`**: FastAPI, Python 3.11+, SQLAlchemy 2, Alembic, Pydantic v2, Google OR-Tools CP-SAT constraint solver, ReportLab, OpenPyXL, python-docx, pytest, Ruff.
- **`infra/`**: Docker Compose configuration for local PostgreSQL and Mailpit development email sink.
- **`docs/`**: Architecture, security, deployment, and scheduling engine specifications.

---

## ✨ Features & Milestones Completed

### 🔐 Authentication & Multi-Tenant Workspace Isolation (Milestones 1–2)
- Argon2id password hashing, time-limited single-use email verification, and password reset tokens.
- Disposable email filtering with anti-enumeration protection.
- Hard workspace tenant boundaries with role-based access control (`owner`, `admin`, `member`).
- Complete Insecure Direct Object Reference (IDOR) rejection across all workspace resources.

### 👥 Staff Management & Availability (Milestone 3)
- Comprehensive staff profiles distinguishing `full_time`, `restricted_hours`, and `student` categories.
- Contract hour caps, maximum weekly shifts, and consecutive working day limits.
- Mandatory skill assignments (e.g. Supervisor, Till Operator).
- Weekly recurring day-off preferences and approved leave/sickness blocks.

### 🧠 OR-Tools CP-SAT Rota Generation Engine (Milestone 4)
- Automated, constraint-based rota generation using **Google OR-Tools CP-SAT**.
- **Hard Constraints**: Staff active status, skill matching, availability/leave blocks, 11-hour minimum rest between shifts, no overlapping shifts, maximum weekly hours, and consecutive working day limits.
- **Soft Objectives**: Minimize unmet demand slots (weight 10,000) and minimize absolute variance from contracted weekly hours (weight 1).
- **Honest Diagnostics**: Categorized outcomes (`feasible`, `partially_feasible`, `infeasible`, `timeout`) with concrete relaxation suggestions.

### ⏱️ Break Policies & Rota Snapshots (Milestone 5)
- Fully configurable break deduction policies (standard UK/custom shift length thresholds and break durations).
- Real-time calculation of gross shift hours, unpaid breaks, and paid hours.
- Immutable point-in-time rota snapshots with transactional restoration.

### 📅 Weekly Manual Rota Grid & Manager Override Auditing (Milestone 6)
- Interactive 7-day grid (`WeeklyRotaGrid.tsx`) with staff rows, daily coverage indicators, and contract hour progress bars.
- Add, edit, move, copy, reassign, and delete shift actions.
- Real-time preflight validation endpoint (`/validate-shift`) flagging blocking errors and soft warnings.
- Database-backed manager override auditing (`ShiftOverrideAudit`) with actor ID, UTC timestamp, warning code, and tamper-proof notes.
- Cross-week rest validation considering shifts in contiguous previous and subsequent rota weeks.

### 📤 Multi-Format Exports, Lifecycle & Duplication (Milestone 7)
- **Production Exports**:
  - **CSV**: UTF-8 BOM encoding for seamless spreadsheet opening.
  - **Excel (XLSX)**: Styled headers, thin borders, and frozen panes via `openpyxl`.
  - **PDF**: Landscape A4 format with running page numbers (`Page X of Y`) via `reportlab`.
  - **Word (DOCX)**: Formatted schedule tables via `python-docx`.
- **Spreadsheet Security**: Formula-injection sanitization stripping leading whitespace/control characters (`=`, `+`, `-`, `@`, `\t`, `\r`) while preserving native numeric types.
- **Clipboard & Print**: One-click TSV clipboard copy with accessible screen-reader live announcements, plus a clean landscape browser print stylesheet.
- **Rota Duplication**: Clone existing rotas into new date ranges with day-offset shift and demand mapping, date-duration checks, and active period collision protection.
- **Lifecycle Management**: Dedicated endpoints for `/approve` (publishing requires at least 1 shift), `/unpublish`, `/archive`, and `/unarchive` with strict mutation locking on non-draft rotas.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v20 and v22)
- **Python**: 3.11+
- **Docker** (optional: use Docker Compose for PostgreSQL + Mailpit, or use local SQLite for instant zero-dependency testing)

### 2. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```

### 3. Backend Setup & Run
```bash
cd apps/api
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[dev]"

# Run database migrations
alembic upgrade head

# Start FastAPI server on http://localhost:8000
uvicorn app.main:app --reload --port 8000
```

API Documentation & health check:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 4. Frontend Setup & Run
In a separate terminal:
```bash
cd apps/web
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing & Verification

### Backend Tests & Ruff Linter
```bash
cd apps/api
source .venv/bin/activate

# Run all 70 unit and integration tests
pytest -v

# Run Ruff linting
ruff check .
```

### Frontend Tests, TypeScript Validation & Build
```bash
cd apps/web

# Run all 40 Vitest frontend tests
npm run test:run

# TypeScript type check
npx tsc --noEmit

# Production build bundle
npm run build
```

### Database Migration Chain Verification
```bash
cd apps/api
source .venv/bin/activate

# Downgrade to baseline override audit migration
alembic downgrade 0006_shift_override_audits

# Upgrade back to head (0007_rota_publishing_metadata)
alembic upgrade head
```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new user account |
| `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT access token |
| `GET` | `/api/v1/auth/me` | Current authenticated user profile |
| `GET` | `/api/v1/workspaces` | List accessible workspaces |
| `POST` | `/api/v1/workspaces` | Create a new workspace |
| `GET/POST` | `/api/v1/workspaces/{ws_id}/staff` | List or create staff members |
| `PATCH/DELETE`| `/api/v1/workspaces/{ws_id}/staff/{id}` | Edit or archive staff members |
| `GET` | `/api/v1/workspaces/{ws_id}/rotas` | List rotas with pagination & status filters (`all`, `draft`, `published`, `archived`) |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas` | Create a new rota period & demand template |
| `GET` | `/api/v1/workspaces/{ws_id}/rotas/{id}` | Retrieve complete rota details, shifts, runs, & snapshots |
| `PATCH` | `/api/v1/workspaces/{ws_id}/rotas/{id}` | Update rota name (draft status only) |
| `DELETE` | `/api/v1/workspaces/{ws_id}/rotas/{id}` | Permanently delete draft or archived rota |
| `PUT` | `/api/v1/workspaces/{ws_id}/rotas/{id}/requirements` | Bulk update daily staffing demand bands |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/copy-requirements` | Copy daily demand to multiple target dates |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/generate` | Trigger OR-Tools CP-SAT rota solver |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/shifts` | Manually add a shift |
| `PATCH/DELETE`| `/api/v1/workspaces/{ws_id}/rotas/{id}/shifts/{s_id}` | Edit, move, or delete a shift |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/shifts/{s_id}/copy` | Duplicate a shift to target date |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/validate-shift` | Validate proposed shift change & audit warnings |
| `GET/POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/snapshots` | List or create rota snapshots |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/snapshots/{s_id}/restore` | Transactionally restore rota to a previous snapshot |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/approve` | Publish rota (locks shifts; requires ≥1 shift) |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/unpublish` | Revert published rota back to editable draft |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/archive` | Move rota to historical archive |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/unarchive` | Restore archived rota back to draft |
| `POST` | `/api/v1/workspaces/{ws_id}/rotas/{id}/duplicate` | Duplicate rota to new period with day offsets |
| `GET` | `/api/v1/workspaces/{ws_id}/rotas/{id}/export` | Export rota in CSV, XLSX, PDF, or DOCX format |

---

## 🔒 Security & Data Integrity

- **Tenant Isolation**: Every database query filters by `workspace_id` verified via JWT authorization dependencies.
- **Audit Trails**: Manager overrides are preserved in dedicated `shift_override_audits` records with warning codes and actor IDs.
- **Export Sanitization**: Untrusted spreadsheet text is escaped against formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Data Minimization**: Medical diagnostic notes and exact home addresses are never requested or stored.
- **Immutability**: Published and archived rotas reject shift and requirement mutations at the API level.

---

## 📄 License

Proprietary & Confidential.
