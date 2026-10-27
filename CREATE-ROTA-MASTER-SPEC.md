# Create Rota --- Master Build Specification for Antigravity

## How to use this file

1.  Open your `create-rota` repository/project in Antigravity.

2.  Add this file to the project root, or open it and paste its contents
    into Antigravity.

3.  Give Antigravity this instruction:

    **"Read `CREATE-ROTA-MASTER-SPEC.md` completely. First inspect the
    existing repository and its current state. Then implement the
    project in small, verified milestones, starting with Milestone 0. Do
    not stop after only writing a plan. Build and test the code. If a
    dependency, command, or API fails, diagnose and fix it rather than
    hiding the failure. Do not overwrite working user code. Do not
    commit or push unless I explicitly ask."**

4.  Let Antigravity complete one milestone at a time. Review its summary
    and run the app before asking it to continue.

------------------------------------------------------------------------

# 1. Product definition

**Product name:** Create Rota\
**Repository:** `https://github.com/chandrakiranmalkapuram/create-rota`\
**Product type:** A multi-user staff rota planning and export web
application.

Create Rota is an independent rota builder. It is **not** an employer's
official scheduling system and must not claim to be affiliated with any
employer. Managers use it to plan shifts, check staffing coverage and
contracted hours, and then export/copy the rota into the official system
used by their workplace.

The product should be approachable for first-time users, reliable for
real managers, accessible, mobile-friendly, and suitable for managers at
different companies. Build a real application---not a static mockup,
tutorial, or collection of placeholder buttons.

## Core user promise

"Build a fair, clear staff rota in minutes. Check coverage and
contracted hours, make adjustments, and export it for your workplace."

## Product principles

-   Simple enough for a busy manager to understand without training.
-   Never silently invent staff availability, contracted hours, or
    staffing requirements.
-   Clearly show conflicts, warnings, and assumptions.
-   The manager remains in control: generated rotas are drafts until
    reviewed and approved.
-   Securely separate each user's/organisation's data.
-   Store money/time as precise values; use explicit timezone and date
    rules.
-   No fake success messages. Every visible action must work or be
    clearly marked as not yet available.
-   Keep the interface calm, clean, friendly and professional. Use a
    restrained design system, clear typography, generous spacing, useful
    empty states, helpful validation, and subtle motion only where it
    improves usability.
-   Do not use the employer's branding, logos, or imply an official
    integration.
-   Prefer free/open-source dependencies and local development that
    works on a MacBook.

# 2. Recommended technology

Use a maintained, compatible set of versions and pin dependencies
through lockfiles.

## Frontend

-   React
-   TypeScript with strict mode
-   Vite
-   Tailwind CSS
-   React Router
-   TanStack Query for server state
-   React Hook Form + Zod for forms and validation
-   A consistent accessible component system (shadcn/ui is acceptable)
-   Lucide icons
-   Vitest + Testing Library

## Backend

-   Python 3.12+ where supported
-   FastAPI
-   Pydantic
-   SQLAlchemy 2
-   Alembic migrations
-   PostgreSQL
-   pytest
-   Password hashing with Argon2id or another established secure
    password hash
-   Email integration behind a provider interface, configured only
    through environment variables
-   Structured logging and consistent API error responses

## Scheduling engine

-   Use Google OR-Tools CP-SAT or a similarly appropriate constraint
    solver.
-   Keep scheduling rules separate from HTTP route handlers and database
    models.
-   If a solver cannot be installed in the environment, do not silently
    replace it with random assignment. Explain the limitation and
    provide a deterministic fallback only if explicitly labelled as a
    fallback.
-   Generation must be repeatable when given the same inputs and seed,
    where feasible.

## Local infrastructure and delivery

-   Docker Compose for PostgreSQL and optional local email testing
    service.
-   `.env.example` containing placeholders only.
-   GitHub Actions for linting, tests and build checks.
-   Use migrations; never depend on creating tables manually in a
    database UI.
-   Provide a clear local setup path for macOS.
-   Do not add a paid service as a hard requirement for local
    development.
-   Do not hard-code secrets, API keys, credentials, or production URLs.

# 3. User types and organisation model

Support: - Individual managers who can start alone. - Managers who
belong to a workplace/organisation. - Multiple organisations with strict
data isolation. - A future path for organisation roles, but do not build
complicated enterprise permissions before the core product works.

Initial roles: - `owner`: manages organisation settings and members. -
`manager`: creates and edits staff, requirements, and rotas. - `viewer`:
read-only access, if organisation sharing is implemented in the current
milestone.

Every protected backend query must enforce the current user's
organisation membership or ownership. Do not rely only on frontend route
protection. Prevent insecure direct object reference (IDOR) bugs. Add
tests proving one user's data cannot be read or changed by another user.

A user may create a personal workspace at registration. Provide a clear
route to create an organisation or rename their workspace. Avoid a
complex multi-tenant billing system in the MVP.

# 4. Authentication, registration and account security

Implement: - Registration with first name, last name, email and
password. - Login and logout. - Email verification before enabling
sensitive account actions. - Resend-verification flow with rate limiting
and generic responses that do not reveal whether an account exists. -
Password reset using single-use, time-limited tokens. - Secure session
handling. Prefer short-lived access tokens and rotating refresh tokens
in secure, HttpOnly cookies where feasible. If a different architecture
is selected, document its security trade-offs and never store long-lived
secrets in localStorage. - Rate limiting on login, registration,
verification and password reset. - Strong password validation and safe
error messages. - CSRF protection when cookie-based authentication
requires it. - Security headers, input validation, CORS restricted by
configuration, and safe logging that never logs passwords, tokens or
verification links. - Account deletion/export plan documented; implement
account deletion if feasible without risking accidental deletion of
other users' data.

## Disposable email handling

Use a maintained, configurable disposable-email domain list/library
where possible. The check must be server-side and should reject clearly
disposable addresses at registration. Explain that no list is perfect.
Do not block legitimate email providers indiscriminately. Keep the check
behind an interface so the source/list can be updated. Add tests for
normal addresses, malformed addresses, and known disposable domains.

## Email development

The app must run locally without real email credentials. Provide a
development email sink or clearly documented console/outbox mode. In
development, expose verification/reset links only to the local developer
workflow, never in production API responses. In production, send through
a configurable provider. Include `.env.example` values and setup
documentation.

# 5. Main user journey

1.  User visits the landing page.
2.  User registers and verifies email.
3.  User signs in.
4.  Dashboard greets them: **"Hi, \[first name\]! 😊"** with a tiny,
    subtle smile animation that respects reduced-motion settings.
5.  User creates or selects a workspace.
6.  User adds staff and their work rules.
7.  User configures a rota period and staffing demand.
8.  User generates a draft rota.
9.  App shows coverage, hours, fairness indicators, conflicts and
    warnings.
10. User edits shifts manually.
11. User saves a version and marks it reviewed/approved.
12. User exports to CSV, Excel, PDF or Word, or copies a clean table for
    pasting into another workplace system.
13. User can reopen previous rota periods and duplicate a prior rota as
    a starting point.

Every step should be understandable, with clear progress, save status,
and recovery from errors.

# 6. Main application pages

## Public pages

-   Landing page with honest product description and primary call to
    action.
-   Features page or feature section.
-   Privacy page placeholder with truthful privacy details; do not claim
    legal compliance without review.
-   Terms page placeholder clearly labelled for owner/legal review
    before public launch.
-   Login, registration, email verification, forgot password and reset
    password pages.

## Authenticated pages

-   Dashboard: upcoming/current rota, coverage summary, recent rotas,
    quick actions and onboarding checklist.
-   Staff: list, search/filter, add/edit/archive staff, staff detail.
-   Staff profile: employment status, contract, skills, availability,
    time off, preferences and notes.
-   Rota setup: period, week start, staffing requirements and generation
    preferences.
-   Rota editor: grid/calendar/list views if feasible; desktop-first
    efficient editing but fully usable on mobile.
-   Rota history: saved rotas, versions, duplicate, rename, archive and
    delete with confirmation.
-   Organisation/workspace settings.
-   Account settings: name, email status, password and account deletion.
-   Help/guide page with examples.

Use clear loading, empty, error and success states. Keep navigation
consistent. Do not leave dead-end pages or inert controls.

# 7. Staff records and rules

Each staff record should support: - First and last name; optional
display name. - Active/inactive/archived status. - Staff category:
`restricted_hours` (e.g. part-time or limited availability) or
`full_time`. - Contracted paid hours per week; allow a configurable
period contract if needed later. - Minimum and maximum hours per week,
if set. - Maximum shifts per week, if set. - Maximum consecutive working
days, if set. - Minimum rest between shifts, with a safe default and
configurable policy. - Skills/roles, e.g. supervisor, till, kitchen,
first aid; optional. - Availability by weekday and time range. -
Recurring unavailable days, including regular days off. - One-off
unavailable dates and time ranges. - Approved holiday/leave and sickness
blocks. - Optional shift preferences, clearly treated as preferences
rather than guarantees. - Optional notes, visible only to authorised
workspace members.

Validate start/end times, overnight shifts, duplicate conflicts and
impossible combinations. Do not allow archived staff to be assigned new
shifts. Do not assume part-time means a particular number of hours.
Contract values must be entered by the manager.

Avoid storing unnecessary sensitive data. Do not require date of birth,
home address, medical details, or immigration information.

# 8. Rota period and staffing requirements

Allow the manager to choose: - Week starting Sunday
(Sunday--Saturday). - Week starting Monday (Monday--Sunday). - A custom
start and end date. - A single week or multiple weeks, subject to solver
performance and clear limits.

For each date/day, allow staffing requirements to be configured by time
band, not only a single daily headcount. Example: Monday needs 4 people
from 09:00--13:00 and 7 people from 13:00--17:00. Support role/skill
requirements when practical.

Requirements must handle: - Open/close times. - Multiple staffing bands
in a day. - Days with no opening hours. - Overnight shifts where
configured. - Minimum number of people per band. - Optional required
roles/skills per band. - Break rules. - Special dates/one-off opening
hours.

Make configuration quick: duplicate a typical day to other weekdays,
copy last week's requirements, and edit one day at a time.

# 9. Shift and paid-hours rules

Store shift start/end timestamps or local date + time consistently,
using the workspace timezone. Document daylight-saving-time handling.
Validate overnight shifts explicitly.

Each shift supports: - Staff member. - Start and end. - Unpaid break
minutes. - Optional role/skill. - Status: draft, published/approved,
cancelled. - Notes, if needed.

Calculate: - Gross shift duration. - Unpaid break duration. - Paid hours
= gross duration minus unpaid break duration. - Weekly/period totals per
employee. - Difference against contracted hours. - Coverage per time
band. - Overtime/under-hours warnings based on configured thresholds.

Break rules must be configurable. Never assume every break is unpaid or
that a particular legal rule applies universally. Show the assumptions
used for every hours calculation. Use decimal hours or minutes
consistently; avoid floating-point rounding errors in stored values.
Display hours in a human-friendly way.

# 10. Automatic rota generation

The generator must create a **draft**, never silently publish it.

## Hard constraints

-   Respect availability and approved leave/sickness.
-   No overlapping shifts for the same employee.
-   Respect minimum rest between shifts when configured.
-   Respect maximum shifts/consecutive days/hours when configured.
-   Do not assign inactive/archived staff.
-   Only assign required skills when a shift requires them.
-   Respect configured staffing and contract constraints where
    mathematically possible.
-   Enforce valid shift and break durations.

## Soft constraints (preferences to optimise)

-   Meet staffing demand.
-   Keep employees near contracted paid hours.
-   Distribute less desirable shifts fairly.
-   Avoid excessive consecutive work days.
-   Respect staff preferences where possible.
-   Avoid unnecessary split shifts.
-   Keep hours and shift counts balanced over the selected period.

The interface must explain that fairness is based on the configured
rules and is not a guarantee of perfect fairness.

## Solver outcomes

Return one of: - `feasible`: a draft schedule was found. -
`partially_feasible`: a schedule was found but some coverage
requirements remain unmet. - `infeasible`: no schedule satisfies hard
constraints. - `timeout`: solver reached its time limit without a proven
result.

Return actionable diagnostics. Examples: "Tuesday 14:00--18:00 needs 2
more people", "Alex has no availability on this date", "There are not
enough qualified supervisors", or "The contracted-hour targets conflict
with the current staffing demand." Do not claim a schedule is optimal
unless the solver proves it.

If generation fails, retain all user inputs and offer suggestions to
relax selected rules. Never automatically violate a hard constraint just
to fill a shift.

## Manual editing

-   Add, edit, move, copy and delete a shift.
-   Warn about conflicts before saving; block hard violations unless the
    user explicitly changes the relevant policy.
-   Undo/redo if feasible.
-   Autosave or clear save button with visible save status.
-   Confirmation before destructive actions.
-   Keyboard-friendly controls and accessible labels.
-   Show coverage and paid-hour totals updating after edits.

# 11. Rota saving, versions and publishing

-   Save drafts.
-   Keep a version history or at minimum snapshots before significant
    regeneration.
-   Duplicate an existing rota into a new period.
-   Mark reviewed/approved/published only after explicit manager action.
-   Record who made important changes and when, without collecting
    unnecessary data.
-   Prevent accidental duplicate rotas for the same workspace and
    period, or make duplicates explicit.
-   Provide archive and delete with confirmation.
-   Handle concurrent edits safely; do not silently overwrite another
    manager's latest changes.

Publishing in Create Rota means marking the plan as approved within
Create Rota. It does **not** send the rota to an employer's official
system unless a real integration is later implemented and configured.

# 12. Export and copy

Implement working exports: - CSV: reliable, UTF-8,
spreadsheet-friendly. - Excel `.xlsx`: clear columns, readable widths,
frozen headers where appropriate, dates/times and paid hours. - PDF:
print-ready landscape layout when needed, title, date range, workspace
name, generated timestamp and page numbers if supported. - Word `.docx`:
readable rota table. - Copy-to-clipboard: clean tab-separated or table
text suitable for pasting. - Browser print stylesheet.

Exports should include staff name, date/day, shift start/end, unpaid
break, paid hours and role as appropriate. Offer a staff-focused view
and a day/coverage-focused view if feasible. Escape CSV values
correctly. Do not include private notes by default. Display timezone and
break assumptions where useful.

# 13. Data model (starting proposal)

Adjust based on sound engineering judgment, but document any important
changes: - User - EmailVerificationToken - PasswordResetToken -
Workspace/Organisation - WorkspaceMembership - StaffMember - StaffSkill
/ Skill - StaffContract - AvailabilityRule - UnavailabilityBlock -
LeaveBlock - Rota - RotaVersion or RotaSnapshot - Shift -
StaffingRequirement - StaffingRequirementBand - GenerationRun -
AuditEvent

Use UUIDs or another consistent non-guessable identifier strategy. Add
foreign keys, indexes, uniqueness constraints and deletion policies. Use
UTC for stored instants and an explicit IANA timezone
(e.g. `Europe/London`) for each workspace. For purely local rota
dates/times, use a carefully documented local-time representation.
Handle daylight saving explicitly. Do not cascade-delete an
organisation's data accidentally from an ordinary user profile edit.

# 14. API design

Use versioned routes under `/api/v1`. Establish consistent
request/response schemas, validation and errors. Examples: -
`GET /api/v1/health` - `POST /api/v1/auth/register` -
`POST /api/v1/auth/login` - `POST /api/v1/auth/logout` -
`POST /api/v1/auth/verify-email` -
`POST /api/v1/auth/resend-verification` -
`POST /api/v1/auth/forgot-password` -
`POST /api/v1/auth/reset-password` - `GET /api/v1/me` -
`GET/POST /api/v1/workspaces` -
`GET/PATCH /api/v1/workspaces/{workspace_id}` -
`GET/POST /api/v1/staff` - `GET/PATCH/DELETE /api/v1/staff/{staff_id}` -
`GET/POST /api/v1/rotas` - `GET/PATCH/DELETE /api/v1/rotas/{rota_id}` -
`POST /api/v1/rotas/{rota_id}/generate` -
`POST /api/v1/rotas/{rota_id}/shifts` -
`PATCH/DELETE /api/v1/shifts/{shift_id}` -
`POST /api/v1/rotas/{rota_id}/approve` -
`GET /api/v1/rotas/{rota_id}/export?format=csv|xlsx|pdf|docx`

These are examples, not permission to create fake endpoints. Every
endpoint must be implemented, validated and tested before the UI claims
it works. Use pagination for growing lists and filtering/sorting where
useful. Avoid leaking internal stack traces to clients.

# 15. Visual design and accessibility

Create a polished, modern, calm SaaS experience: - Light neutral
background, dark readable text, one restrained primary accent, clear
semantic warning/error colours. - A simple logo/wordmark made from text
or a small calendar/grid icon; no fake corporate branding. - Dashboard
greeting exactly: "Hi, \[first name\]! 😊" with a subtle animation. -
Friendly labels and short helper text. - Staff cards/table that clearly
distinguish restricted-hours and full-time categories. - Rota editor
that makes understaffed periods and conflicts easy to spot without
relying on colour alone. - Responsive layouts for desktop, tablet and
phone. - WCAG-aware colour contrast, semantic headings, visible focus,
keyboard access, labels, screen-reader status messages, reduced-motion
support. - Avoid excessive gradients, giant empty hero sections,
excessive rounded cards, and animations that slow down work. - Do not
use emojis everywhere; keep the dashboard greeting as the intended
friendly touch. - Provide a useful demo/onboarding path using clearly
labelled sample data, never mixed with real data by default.

# 16. Privacy and security

-   Enforce workspace-level authorisation in the backend on every
    read/write.
-   Use secure password hashing, time-limited one-use tokens and rate
    limits.
-   Validate and normalise input server-side.
-   Use parameterised ORM queries; avoid SQL injection.
-   Prevent XSS by escaping output and avoiding unsafe HTML rendering.
-   Configure CORS narrowly.
-   Keep secrets in environment variables and use a production secret
    manager at deployment.
-   No sensitive data in logs.
-   Restrict upload functionality unless necessary; if added, validate
    type/size and scan safely.
-   Use HTTPS in production.
-   Provide database backups and restore documentation before real
    customer use.
-   Add security and data-isolation tests.
-   Include a privacy notice that truthfully describes data collected,
    use, storage, deletion and email processing. Do not claim GDPR
    compliance or legal approval without professional review.
-   Do not collect medical details for sickness; store only the
    unavailability dates/reason category needed for scheduling.
-   Avoid storing exact staff home addresses or other unnecessary
    personal information.

# 17. Testing and quality gates

## Backend tests

-   Registration/login and token flows.
-   Email verification and password reset expiry/one-time use.
-   Disposable email validation.
-   Workspace membership/authorisation.
-   Cross-user data isolation and IDOR attempts.
-   Staff CRUD and archive behaviour.
-   Availability/leave and overnight shifts.
-   Paid-hour and break calculations.
-   Coverage calculations.
-   Scheduling hard constraints and solver outcome diagnostics.
-   Rota edits, versions and approval.
-   Export content and escaping.
-   Database migrations.

## Frontend tests

-   Registration/login form validation.
-   Protected navigation.
-   Staff add/edit and category display.
-   Rota period setup.
-   Rota editor warnings and totals.
-   Generation loading, success, partial and failure states.
-   Export actions.
-   Accessible labels and keyboard-critical flows.

## Quality checks

-   Format and lint frontend/backend.
-   Type-check TypeScript.
-   Run all tests.
-   Build frontend for production.
-   Start backend and check health.
-   Run database migrations on a clean database.
-   Ensure `.env`, secrets, tokens, database files, virtual
    environments, build output and dependencies are ignored.
-   Add GitHub Actions CI that runs tests and build checks.
-   Do not claim a test passed unless the command actually ran and
    passed.
-   Report any checks that could not run and why.

# 18. Local development experience

A new developer should be able to clone the repository and follow the
README without guesswork.

Provide: - A clear directory tree. - Required tool versions. -
`.env.example`. - One-command or minimal-command startup, ideally via
Docker Compose. - Exact commands for database startup, migrations,
frontend/backend startup, tests, linting and shutdown. - Health check
instructions. - Troubleshooting for occupied ports, missing environment
variables, database connection failures and migration errors. -
Development email verification instructions. - Seed/demo command that
creates clearly labelled sample data without running automatically
against production. - No need for paid accounts to run the core
application locally.

Suggested directory layout (adapt if justified):

``` text
create-rota/
  apps/
    web/
      src/
      tests/
      package.json
      vite.config.ts
    api/
      app/
        api/
        core/
        db/
        models/
        schemas/
        services/
        scheduling/
        exports/
      tests/
      pyproject.toml
      alembic.ini
  infra/
    docker-compose.yml
  docs/
    architecture.md
    security.md
    scheduling-rules.md
    deployment.md
  .github/workflows/ci.yml
  .env.example
  .gitignore
  README.md
  CREATE-ROTA-MASTER-SPEC.md
```

Do not force this exact structure if the repository already contains a
good, working alternative. Avoid duplicate package managers or duplicate
backend entry points.

# 19. Deployment readiness

Prepare deployment documentation for a low-cost setup, but do not
automatically create paid resources or deploy without permission.

-   Frontend and API should support separate or combined deployment.
-   Database migrations run as a controlled deployment step.
-   Health/readiness endpoints.
-   Configurable public API URL and frontend origin.
-   Production CORS and cookie settings documented.
-   Secure secrets and database URL supplied through the deployment
    platform.
-   Logs and error handling without sensitive details.
-   Backup/restore plan.
-   CI must pass before a release.
-   Document that a free hosting tier may sleep, impose limits, or
    change pricing.
-   Do not promise permanent free hosting.
-   No production credentials in repository or logs.

# 20. Milestone plan --- implement in this order

**Important:** Do not attempt a huge untested one-shot implementation.
Finish and verify each milestone, then continue. Keep the application
runnable after each milestone.

## Milestone 0 --- Inspect and establish baseline

-   Inspect all repository files, git status and existing decisions.
-   Preserve the existing README and `.gitignore` content unless an
    update is necessary.
-   Report the current state and proposed file changes.
-   Do not delete or replace existing work.
-   Create a concise implementation plan and then begin implementation.

## Milestone 1 --- Working foundation

-   Set up frontend and backend.
-   Configure PostgreSQL with Docker Compose.
-   Configure environment variables and safe defaults.
-   Add health endpoints, migrations, linting, tests and CI.
-   Build a responsive public landing page and app shell.
-   Confirm clean local startup and production frontend build.

## Milestone 2 --- Authentication and workspace isolation

-   Registration, login/logout, email verification, reset password,
    development email sink.
-   Disposable-email checking behind an interface.
-   User/workspace/membership models.
-   Backend authorisation and isolation tests.
-   Dashboard greeting and onboarding.

## Milestone 3 --- Staff management

-   Staff list and detail pages.
-   Create/edit/archive staff.
-   Contract hours, category, skills, availability, recurring days off
    and leave blocks.
-   Validation and tests.

## Milestone 4 --- Rota configuration

-   Week/period selection.
-   Workspace timezone.
-   Daily and time-band staffing requirements.
-   Role/skill demand.
-   Copy requirements from weekdays or previous periods.

## Milestone 5 --- Scheduling engine

-   Isolated solver service.
-   Hard and soft constraints.
-   Generation run tracking and diagnostic results.
-   Unit tests for feasible, partial, infeasible and timeout scenarios.
-   Do not make unsupported claims about legal compliance.

## Milestone 6 --- Rota editor

-   Display generated draft.
-   Add/edit/move/copy/delete shifts.
-   Coverage and contracted-hour summaries.
-   Validation, conflicts, save status and version snapshots.
-   Keyboard and mobile usability.

## Milestone 7 --- Exports and history

-   CSV, XLSX, PDF, DOCX.
-   Copy-to-clipboard and print stylesheet.
-   Saved rotas, duplication, approval, archive and delete.
-   Verify exported content in tests.

## Milestone 8 --- Hardening and release candidate

-   End-to-end user journey.
-   Accessibility review.
-   Security and cross-tenant tests.
-   Performance review of solver and large rota periods.
-   Documentation, backup/restore and deployment guide.
-   CI verification and release checklist.

After each milestone, report: 1. What was implemented. 2. Files
created/changed. 3. Commands actually run and their results. 4. Known
issues or unverified checks. 5. Exact local run/test commands. 6. Next
milestone. Do not mark a milestone complete if its acceptance criteria
are not met.

# 21. Definition of done

The product is not "complete" merely because the homepage looks good. A
usable MVP must allow a manager to:

-   Register, verify email, sign in and reset password.
-   Create a workspace and securely manage its staff.
-   Configure contracts, availability, time off and staffing demand.
-   Generate a draft rota with honest diagnostics.
-   Manually edit and save shifts.
-   See paid hours, breaks, coverage and conflicts update correctly.
-   Save and reopen rotas.
-   Export usable CSV, Excel, PDF and Word files.
-   Use the application on desktop and mobile.
-   Have confidence that another user cannot access their private data.
-   Run tests and builds with documented commands.

If any capability is incomplete, label it honestly in the UI and
documentation.

# 22. Rules for Antigravity while implementing

-   Read this specification fully before coding.
-   Inspect the repository before modifying it.
-   Make small changes, run checks, fix errors and continue.
-   Do not produce only a plan or a static mockup.
-   Do not put the entire application in one file.
-   Do not use hard-coded demo data as if it were database data.
-   Do not use fake API responses in production paths.
-   Do not add buttons that do nothing.
-   Do not swallow exceptions or disable tests to make checks pass.
-   Do not weaken authentication or authorisation to simplify
    development.
-   Do not silently ignore failed commands.
-   Do not add secrets or `.env` files to Git.
-   Do not commit, push, publish, or deploy unless explicitly
    instructed.
-   Ask the user only when a genuine product decision or credential is
    required. Otherwise choose a safe, documented default and keep
    moving.
-   If a tool or library is unavailable, explain the limitation, select
    a reasonable alternative, and update documentation.
-   At the end of each milestone, provide concise, beginner-friendly
    instructions with exact commands and where to run them.
