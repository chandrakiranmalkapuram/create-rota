# Create Rota — Architecture Overview

## 1. System Components

### Frontend (`apps/web`)
- **Framework**: React 18 with Vite for modern, fast HMR and optimized production bundles.
- **Language**: TypeScript with strict mode enabled.
- **Styling**: Tailwind CSS with custom design tokens for calm, accessible, and responsive user interfaces.
- **Routing**: React Router v6 with authenticated and public route wrappers.
- **Server State**: TanStack Query (React Query) for declarative caching, polling, and mutation management.
- **Forms**: React Hook Form with Zod schema validation.
- **Icons**: Lucide React.
- **Testing**: Vitest with React Testing Library and jsdom.

### Backend (`apps/api`)
- **Framework**: FastAPI (Python 3.11+) offering high performance, automatic OpenAPI documentation, and typed request/response handling.
- **ORM & Data Layer**: SQLAlchemy 2.0 with both async and sync connection capabilities and Alembic migrations.
- **Validation**: Pydantic v2 schemas for strict request/response data contracts.
- **Constraint Solver**: Google OR-Tools CP-SAT engine for fair and mathematically constrained rota generation.
- **Security**: Argon2id password hashing, time-limited single-use tokens, HttpOnly cookies/bearer JWTs, rate-limiting, and disposable-email verification.
- **Testing**: pytest with HTTPX test client.

### Infrastructure & Storage
- **Database**: PostgreSQL 16 (production and local container) with SQLite support for lightweight portable development/testing.
- **Local Dev Email**: Console output mode in dev, or local Mailpit container for visual email inspection.
