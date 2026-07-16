# PG Management SaaS — Gemini Implementation Roadmap

**Source documents:** `BACKEND_ARCHITECTURE.md`, `DB_ARCHITECTURE.md`, `IMPLEMENTATION_MILESTONES.md`, and the `pg_manager_mobile` React Native app.
**Purpose:** a milestone-by-milestone build plan where each milestone is directly executable by pasting its prompt into Gemini.

## How to use this document

Every milestone below has four parts: **Objective**, **Dependencies**, **Acceptance Criteria**, and a **Gemini Prompt**.

One structural decision worth explaining rather than hiding: the Gemini prompts are **not** individually self-contained walls of text repeating the entire tech stack, folder structure, and conventions 55 times. That would make this document 4–5x longer, and worse, it would make it *more* error-prone — 55 copies of the same context block means 55 places a future edit to the conventions has to be manually kept in sync. Instead:

1. **Paste Section A once** — as the first message in a Gemini session, or as a saved system instruction if your Gemini setup supports one. This establishes the stack, folder structure, naming conventions, and non-negotiables for the entire project.
2. **Paste each milestone's prompt in order**, one Gemini turn per milestone, inside that same session — so Gemini has the prior milestones' actual generated code in context, not just a description of it. This matters: milestone 1.4 needs to see the real `UserRepository` from 1.3, not a re-description of it.
3. Run the acceptance criteria for a milestone before moving to the next one. If Gemini's output doesn't satisfy them, fix it in that session before proceeding — don't stack unverified milestones on top of each other.

If you're running milestones across separate Gemini sessions (e.g., different days), re-paste Section A at the start of each session, then paste the actual current contents of the files the next milestone depends on (not this document's description of them) so Gemini is grounded in what's really in the repo.

---

## Section A — Gemini Session Setup (paste once per session)

```
You are a senior backend engineer building a production FastAPI backend for a PG (paying-guest hostel) management SaaS. Work strictly incrementally, one milestone at a time, and treat every deliverable as production code — not a prototype.

STACK
- Python 3.12, FastAPI, Pydantic v2
- SQLAlchemy 2.0, fully async (asyncpg driver)
- Alembic for migrations (every migration has a working upgrade() and downgrade())
- PostgreSQL 16
- JWT auth (pyjwt or python-jose), argon2-cffi for password hashing
- pytest + pytest-asyncio for tests, run against a real Postgres test database (not SQLite, not mocked)
- Docker / docker-compose for local dev

PROJECT STRUCTURE (do not deviate without a stated reason)
backend/
  app/
    main.py
    core/          config.py, security.py, exceptions.py
    db/            base.py, session.py
    models/        one file per aggregate (user.py, property.py, room.py, guest.py, payment.py, ...)
    schemas/       Pydantic request/response models, one file per aggregate
    repositories/  one class per aggregate, data access only, no business rules
    services/      business logic and invariants, orchestrates repositories
    api/v1/
      deps.py       get_db, get_current_user, require_property_member, require_role
      routers/      auth.py, properties.py, rooms.py, guests.py, payments.py, stats.py, ...
    tests/          mirrors the app/ structure
  alembic/
  docker/

CONVENTIONS (from DB_ARCHITECTURE.md — follow exactly, do not invent alternatives)
- snake_case, plural table names. Primary key is always `id`.
- Foreign keys: `<singular_table>_id` normally; role-qualified names (`created_by`, `updated_by`, `recorded_by`, `actor_user_id`) when a table has multiple FKs to the same target table.
- Booleans: `is_<state>` / `has_<thing>`.
- Enums: `<domain>_type` or bare domain name (`property_role`, `room_type`, `guest_type`, `payment_method`, `food_type`).
- Timestamps are always `timestamptz`: `created_at`, `updated_at` (maintained by a DB trigger, never set manually in application code), `deleted_at` (soft-delete marker, nullable).
- Constraint/index naming: `ix_<table>__<cols>`, `uq_<table>__<cols>`, `fk_<table>__<col>__<ref_table>`, `ck_<table>__<rule>`.
- Primary keys are UUIDv7 (time-ordered), generated in the application layer before insert — use the `uuid_utils` or `uuid6` package. Never use UUIDv4 for primary keys. Never use auto-increment integers.
- Money is always `NUMERIC(10,2)`, never float.

LAYERING (strict — do not let one layer's concerns leak into another)
- Routers: HTTP concerns only (auth dependency, request/response schema validation, status codes). Never import SQLAlchemy models or write queries in a router.
- Services: own every business rule and invariant (capacity checks, balance calculations, idempotency, authorization decisions beyond "is this a member"). Services call repositories; repositories never call services.
- Repositories: SQLAlchemy queries only. No validation, no business rules, no HTTP exceptions — raise plain domain-agnostic results or let the service layer interpret `None`/empty results.

NON-NEGOTIABLES
- No placeholder code. No `# TODO`, no `pass  # implement later`, no functions that return hardcoded/mocked data instead of querying the database, no commented-out logic "for reference." Every function must be fully implemented and runnable.
- Every endpoint has explicit Pydantic request and response schemas — never return raw ORM objects or bare dicts.
- Every migration must be reversible (`downgrade()` actually undoes `upgrade()`, not a no-op).
- Every service method containing a business rule gets at least one unit test proving that rule (not just a happy-path test).
- When a milestone says "acceptance criteria," treat those as the actual definition of done — if your implementation doesn't satisfy every one of them, it isn't finished.
- Output full file contents for every file you create or modify, clearly labeled with its path. Do not output partial diffs or "...rest unchanged" placeholders.

I will give you one milestone at a time. Acknowledge this context, then wait for the first milestone.
```

---

## Phase 0 — Foundation

### 0.1 — Project scaffolding & config

**Objective:** Stand up the FastAPI project skeleton and typed configuration so every later milestone has a real place to live.

**Dependencies:** none.

**Acceptance criteria:**
- `app/` matches the structure in Section A exactly.
- `pydantic-settings`-based `core/config.py` loads `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `REDIS_URL` from environment, with no hardcoded secrets anywhere in source.
- `GET /health` returns `200 {"status": "ok"}` with zero DB dependency.
- `uvicorn app.main:app --reload` boots cleanly on a fresh checkout with no manual steps beyond `pip install`.

**Gemini prompt:**
> Create the initial FastAPI project skeleton under `backend/app/` exactly matching the PROJECT STRUCTURE in the session setup. Create empty (but valid, importable) `__init__.py` files for every package. Implement `core/config.py` using `pydantic-settings` with a `Settings` class exposing `database_url: str`, `jwt_secret: str`, `jwt_algorithm: str = "HS256"`, `jwt_access_token_expire_minutes: int = 15`, `jwt_refresh_token_expire_days: int = 30`, `redis_url: str`, loaded from a `.env` file. Implement `app/main.py` creating the FastAPI app, wiring a single `GET /health` endpoint that returns `{"status": "ok"}` with no database or Redis dependency, and mounting a placeholder `api/v1` router (empty for now, but the include must be real and functional, not commented out). Add a `pyproject.toml` with all dependencies from the STACK section pinned to specific compatible versions. Add a `.env.example` documenting every setting the config loads. Fully implement every function — no TODOs or stubs.

### 0.2 — Docker Compose (api + postgres + redis)

**Objective:** Reproducible local dev environment with the API, database, and cache wired together.

**Dependencies:** 0.1

**Acceptance criteria:**
- `docker-compose up` starts `api`, `postgres`, and `redis`; the API container can reach both by service name.
- Postgres data persists across `docker-compose down && docker-compose up` via a named volume.
- `.env.example` covers every variable Compose or the app expects.

**Gemini prompt:**
> Write `docker/Dockerfile` for the FastAPI app (multi-stage build, non-root user, based on `python:3.12-slim`) and `docker/docker-compose.yml` defining three services: `api` (builds from the Dockerfile, mounts the source for hot reload in dev, depends on `postgres` and `redis` with healthcheck-based `depends_on`), `postgres` (Postgres 16, named volume for data, exposes 5432), and `redis` (Redis 7, exposes 6379). Wire `DATABASE_URL` and `REDIS_URL` in the `api` service to point at the `postgres`/`redis` service names, not `localhost`. Add healthchecks to `postgres` and `redis` and make `api` wait on them being healthy. Update `.env.example` to match. Fully implement every file — no placeholder values that would fail if used as-is beyond secrets that are genuinely meant to be filled in locally.

### 0.3 — Async DB session + Alembic init

**Objective:** Working async database connectivity and a functioning migration pipeline before any real table exists.

**Dependencies:** 0.2

**Acceptance criteria:**
- `alembic upgrade head` succeeds against an empty database (baseline, zero real tables yet).
- A `get_db` FastAPI dependency yields a working `AsyncSession`; a throwaway test endpoint executing `SELECT 1` returns successfully.
- Async engine is configured with an explicit connection pool size, not library defaults.

**Gemini prompt:**
> Implement `app/db/session.py` with an async SQLAlchemy engine (`create_async_engine`, asyncpg driver) reading `DATABASE_URL` from `core/config.py`'s `Settings`, explicit `pool_size=10` and `max_overflow=20`, and an `async_sessionmaker`. Implement a `get_db` async generator FastAPI dependency in `api/v1/deps.py` that yields a session and ensures it's closed after the request. Initialize Alembic (`alembic init`) configured for async migrations (use `run_async_migrations` pattern in `env.py`), with `sqlalchemy.url` pulled from the same `Settings` object rather than duplicated in `alembic.ini`. Add a temporary `GET /debug/db-check` endpoint using `get_db` that executes `SELECT 1` and returns the result, purely to prove connectivity — note in a comment that this endpoint should be removed once real endpoints exist. Write a pytest-asyncio test hitting this endpoint against a real test database. Fully implement every function — no stubs.

### 0.4 — Base model conventions

**Objective:** Shared ORM building blocks (ID generation, timestamp mixins, naming convention) that every future table migration builds on.

**Dependencies:** 0.3

**Acceptance criteria:**
- Declarative base carries a Postgres naming convention producing `ix_`, `uq_`, `fk_`, `ck_`-prefixed constraint names, verified by generating one throwaway migration and inspecting the output.
- Reusable mixins exist for UUIDv7 `id`, `created_at`/`updated_at`, and `deleted_at`.
- A `set_updated_at()` Postgres trigger function is created via migration; a test updates a throwaway row directly via SQL (not through the ORM) and confirms `updated_at` changes automatically.

**Gemini prompt:**
> Implement `app/db/base.py` with a SQLAlchemy 2.0 `DeclarativeBase` subclass carrying a naming convention metadata dict producing `ix_%(table_name)s__%(column_0_N_name)s`, `uq_%(table_name)s__%(column_0_N_name)s`, `fk_%(table_name)s__%(column_0_name)s__%(referred_table_name)s`, `ck_%(table_name)s__%(constraint_name)s`. Implement reusable mixins: `UUIDPrimaryKeyMixin` (a `Mapped[uuid.UUID]` `id` column, Python-side default using a UUIDv7 generator from the `uuid_utils` package — not `uuid4`), `TimestampMixin` (`created_at`, `updated_at` as `Mapped[datetime]` with `timestamptz`, server default `now()`), and `SoftDeleteMixin` (`deleted_at: Mapped[datetime | None]`). Write an Alembic migration that creates a `set_updated_at()` PL/pgSQL trigger function (sets `NEW.updated_at = now()` on any row update) — the function only, no table attaches it yet since no real tables exist. Write a pytest-asyncio test that creates a throwaway table with a raw `CREATE TABLE ... trigger`, updates a row via raw SQL, and asserts `updated_at` advanced without the test setting it. Fully implement every function — no stubs.

### 0.5 — Test infrastructure

**Objective:** A real, isolated test database and a fast, state-clean test run before any business logic exists to test.

**Dependencies:** 0.3

**Acceptance criteria:**
- `pytest` runs against a real, isolated Postgres test database (testcontainers or a dedicated compose test service), not SQLite or a mock.
- Each test runs inside a transaction rolled back afterward — running the same test twice in a row shows no state bleed.
- The (currently empty) suite runs in under 60 seconds.

**Gemini prompt:**
> Set up pytest-asyncio test infrastructure under `app/tests/`. Add a `conftest.py` providing: an `event_loop` fixture appropriate for `pytest-asyncio` in strict mode, a session-scoped fixture that spins up a real Postgres test database (use `testcontainers-python`'s Postgres module, or if Docker-in-Docker isn't available, connect to a `postgres-test` service defined in a `docker-compose.test.yml` you also create), a fixture that runs `alembic upgrade head` against it once per test session, and a function-scoped `db_session` fixture that opens a transaction, yields an `AsyncSession` bound to it, and rolls the transaction back on teardown so no test's writes persist into the next test. Add a `pytest.ini` or `pyproject.toml` `[tool.pytest.ini_options]` section wiring `asyncio_mode = "auto"`. Write one trivial test proving isolation: insert a throwaway row in test A, assert in test B (run after it) that the row does not exist. Fully implement every fixture — no stubs.

### 0.6 — Auth core utilities

**Objective:** Password hashing and JWT encode/decode functions, independent of any database table, ready for the auth service to build on.

**Dependencies:** 0.1

**Acceptance criteria:**
- `hash_password`/`verify_password` round-trip correctly; a wrong password returns `False`.
- `create_access_token`/`decode_token` round-trip a `user_id` claim; expired and tampered tokens are correctly rejected.
- Unit tests cover valid token, expired token, tampered signature, and missing-claim cases.

**Gemini prompt:**
> Implement `app/core/security.py` with: `hash_password(password: str) -> str` and `verify_password(password: str, hashed: str) -> bool` using `argon2-cffi`; `create_access_token(user_id: uuid.UUID) -> str` and `create_refresh_token() -> tuple[str, str]` (returns the raw token and its SHA-256 hash — the raw value is what's sent to the client, only the hash is ever persisted) using settings from `core/config.py` for secret/algorithm/expiry; `decode_access_token(token: str) -> uuid.UUID` that raises a specific `InvalidTokenError` (define this in `core/exceptions.py`) on expiry, bad signature, or missing `sub` claim rather than letting a raw JWT library exception leak upward. Write pytest unit tests (no database needed) covering: correct password verifies, wrong password fails, valid token decodes to the right user id, expired token raises `InvalidTokenError`, tampered-signature token raises `InvalidTokenError`, token missing the `sub` claim raises `InvalidTokenError`. Fully implement every function — no stubs, no `pass`.

---

## Phase 1 — Identity & Auth

### 1.1 — `users` table + migration

**Objective:** The root identity table every other table's audit/ownership fields ultimately point to.

**Dependencies:** 0.4

**Acceptance criteria:**
- Migration matches `DB_ARCHITECTURE.md` §4.1 exactly: `citext` email unique, phone unique nullable, `is_active`, `is_superuser`.
- Inserting `Test@x.com` then `test@x.com` raises a unique-violation (case-insensitive uniqueness proven, not assumed).
- `alembic downgrade -1` cleanly drops the table.

**Gemini prompt:**
> Create the SQLAlchemy model `app/models/user.py` for a `users` table using `UUIDPrimaryKeyMixin` and `TimestampMixin` from `app/db/base.py`, with columns: `email` (Postgres `CITEXT`, unique, not null — enable the `citext` extension in the migration if not already enabled), `phone` (`VARCHAR(20)`, unique, nullable), `password_hash` (`TEXT`, not null), `full_name` (`TEXT`, not null), `is_active` (`BOOLEAN`, not null, default `true`), `is_superuser` (`BOOLEAN`, not null, default `false`). Generate the Alembic migration for this table with a real `downgrade()` that drops it. Write a pytest-asyncio integration test (using the `db_session` fixture from 0.5) that inserts a user with email `Test@Example.com`, then attempts to insert another with email `test@example.com`, and asserts the second raises an `IntegrityError`. Fully implement — no stubs.

### 1.2 — `refresh_tokens` table + migration

**Objective:** Persistent, revocable session storage backing JWT refresh.

**Dependencies:** 0.4

**Acceptance criteria:**
- FK to `users.id` with `ON DELETE CASCADE`.
- `token_hash` has a unique constraint.
- Indexes on `(user_id, revoked_at)` and `(expires_at)` present, confirmed via `\d refresh_tokens` or an information_schema query in a test.

**Gemini prompt:**
> Create `app/models/refresh_token.py` for a `refresh_tokens` table using `UUIDPrimaryKeyMixin`, with columns: `user_id` (`UUID`, FK to `users.id`, `ondelete="CASCADE"`, not null), `token_hash` (`TEXT`, unique, not null), `device_info` (`TEXT`, nullable), `expires_at` (`TIMESTAMPTZ`, not null), `revoked_at` (`TIMESTAMPTZ`, nullable), `created_at` (`TIMESTAMPTZ`, server default `now()`). Add a composite index on `(user_id, revoked_at)` and a single-column index on `expires_at`. Generate the Alembic migration with a working `downgrade()`. Write a pytest-asyncio test that queries `information_schema.indexes` (or uses SQLAlchemy's `inspect`) to assert both indexes exist. Fully implement — no stubs.

### 1.3 — User repository

**Objective:** Data-access layer for users, with zero business logic.

**Dependencies:** 1.1

**Acceptance criteria:**
- Methods: `get_by_id`, `get_by_email`, `create` — no password hashing or validation inside the repository.
- Integration test creates a user via the repository and fetches it back by email with different casing.

**Gemini prompt:**
> Implement `app/repositories/user_repository.py` with a `UserRepository` class taking an `AsyncSession` in its constructor, exposing async methods `get_by_id(user_id: uuid.UUID) -> User | None`, `get_by_email(email: str) -> User | None`, and `create(**fields) -> User` (constructs the model, adds it to the session, flushes, returns it — does not commit; commit is the service/unit-of-work's responsibility). No password hashing, no email validation, no business rules of any kind belong in this class. Write a pytest-asyncio integration test using the `db_session` fixture: create a user with email `Case@Test.com` via `create`, then call `get_by_email("case@test.com")` and assert it returns the same row. Fully implement — no stubs.

### 1.4 — Auth service

**Objective:** Registration, login, refresh, and logout business logic, independent of HTTP.

**Dependencies:** 1.3, 1.2, 0.6

**Acceptance criteria:**
- `register()` rejects a duplicate email with a domain-specific exception, not a raw DB error.
- `login()` returns an access+refresh pair on valid credentials; raises on invalid password without revealing whether the email exists.
- `refresh()` rotates the token — the old refresh token is revoked and reuse of it is rejected.
- Unit tests use a fake/mock repository, no real DB required.

**Gemini prompt:**
> Implement `app/services/auth_service.py` with an `AuthService` class taking a `UserRepository`, a refresh-token repository (create it now as `app/repositories/refresh_token_repository.py` with `create`, `get_by_hash`, `revoke` methods, following the same no-business-logic rule as 1.3), and the utilities from `core/security.py`. Implement: `async def register(email, password, full_name) -> User` — raises `EmailAlreadyExistsError` (define in `core/exceptions.py`) if `get_by_email` finds an existing row, otherwise hashes the password and creates the user; `async def login(email, password) -> tuple[str, str]` — returns `(access_token, raw_refresh_token)`, raises `InvalidCredentialsError` for both "no such email" and "wrong password" cases using the same exception and message so the two aren't distinguishable by the caller; `async def refresh(raw_refresh_token) -> tuple[str, str]` — looks up the token by its hash, raises `InvalidCredentialsError` if not found, revoked, or expired, otherwise revokes it and issues a new access+refresh pair; `async def logout(raw_refresh_token) -> None` — revokes the token if found, no-ops silently if not (don't leak whether a token existed). Write unit tests using `unittest.mock.AsyncMock` for both repositories (no real database): duplicate registration raises `EmailAlreadyExistsError`; login with wrong password and login with nonexistent email both raise the identical `InvalidCredentialsError`; refresh with a valid token returns a new pair and calls `revoke` on the old one; refresh with an already-revoked token raises. Fully implement — no stubs.

### 1.5 — Register + Login endpoints

**Objective:** Expose registration and login over HTTP.

**Dependencies:** 1.4

**Acceptance criteria:**
- `POST /auth/register` returns `201` with no password field anywhere in the response body.
- `POST /auth/login` returns `200` with access+refresh tokens on success, `401` on bad credentials.
- `/docs` reflects both endpoints with correct request/response schemas.

**Gemini prompt:**
> Implement `app/schemas/auth.py` with Pydantic models `RegisterRequest` (email, password, full_name — password with a minimum-length validator), `UserResponse` (id, email, full_name, is_active — explicitly no password field), `LoginRequest` (email, password), and `TokenResponse` (access_token, refresh_token, token_type="bearer"). Implement `app/api/v1/routers/auth.py` with `POST /auth/register` (calls `AuthService.register`, catches `EmailAlreadyExistsError` and returns `409`, returns `201` + `UserResponse` on success) and `POST /auth/login` (calls `AuthService.login`, catches `InvalidCredentialsError` and returns `401`, returns `200` + `TokenResponse` on success). Wire the router into `api/v1/__init__.py`'s aggregate router and into `main.py`. Wire up a real dependency-injection function that constructs `AuthService` with real repositories bound to the request's `AsyncSession` from `get_db`. Write pytest-asyncio integration tests using FastAPI's `AsyncClient` against the real test app: successful registration, duplicate registration returns 409, successful login returns both tokens, login with wrong password returns 401. Fully implement — no stubs.

### 1.6 — Refresh + Logout endpoints

**Objective:** Expose token rotation and revocation over HTTP.

**Dependencies:** 1.4

**Acceptance criteria:**
- `POST /auth/refresh` returns a new token pair; the previous refresh token is unusable afterward (proven by an integration test, not asserted from code reading).
- `POST /auth/logout` revokes the given refresh token; a subsequent refresh attempt with it returns `401`.

**Gemini prompt:**
> Add `RefreshRequest`/`LogoutRequest` Pydantic schemas (both carrying `refresh_token: str`) to `app/schemas/auth.py`. Add `POST /auth/refresh` and `POST /auth/logout` to `app/api/v1/routers/auth.py`, both calling the corresponding `AuthService` methods, both catching `InvalidCredentialsError` and returning `401` for refresh (logout should not error even if the token is already invalid — see 1.4's no-op behavior). Write a pytest-asyncio integration test that: logs in to get a token pair, calls `/auth/refresh` with the refresh token and gets a new pair back, then calls `/auth/refresh` again with the *original* (now-rotated) refresh token and asserts `401`. Write a second test that logs in, calls `/auth/logout`, then attempts `/auth/refresh` with that same token and asserts `401`. Fully implement — no stubs.

### 1.7 — `get_current_user` dependency + `GET /auth/me`

**Objective:** The authentication gate every protected endpoint from here on depends on.

**Dependencies:** 1.5

**Acceptance criteria:**
- Dependency rejects missing, expired, and malformed tokens with `401`, and rejects a valid token belonging to a now-`is_active=false` user.
- `GET /auth/me` returns the authenticated user's own profile only.

**Gemini prompt:**
> Implement `get_current_user` in `app/api/v1/deps.py` as a FastAPI dependency using `fastapi.security.OAuth2PasswordBearer` (or `HTTPBearer`) to extract the token, calling `decode_access_token` from `core/security.py`, looking up the user via `UserRepository.get_by_id`, and raising `HTTPException(401)` for: missing token, malformed/expired/tampered token (catch `InvalidTokenError`), user not found, or `user.is_active is False`. Add `GET /auth/me` to `app/api/v1/routers/auth.py` depending on `get_current_user`, returning the current user as `UserResponse`. Write pytest-asyncio integration tests: valid token returns the correct user; missing Authorization header returns 401; garbage token returns 401; a token for a user subsequently deactivated (update `is_active=False` directly via the repository between token issuance and the request) returns 401. Fully implement — no stubs.

### 1.8 — Auth rate limiting

**Objective:** Protect login/registration from brute-force and enumeration abuse.

**Dependencies:** 1.5, 0.2

**Acceptance criteria:**
- `/auth/login` and `/auth/register` are rate-limited (e.g. 5 requests/minute/IP) backed by Redis.
- Hitting the limit returns `429`.
- The limit does not affect unrelated endpoints.

**Gemini prompt:**
> Add `slowapi` to the project, configured with a Redis-backed storage URI from `core/config.py`'s `redis_url`. Apply a rate limit of `5/minute` to `POST /auth/login` and `POST /auth/register` specifically (not globally). Register the `RateLimitExceeded` exception handler in `main.py` so it returns a clean `429` JSON body rather than an unhandled exception. Write a pytest-asyncio integration test that fires 6 rapid requests at `/auth/login` with bad credentials from the same client and asserts the 6th returns `429` while the first 5 return `401` (bad credentials, not rate-limited yet). Write a second test proving `/health` is unaffected by hitting it more than 5 times in a row and getting `200` every time. Fully implement — no stubs.

---

## Phase 2 — Properties & Access Control

### 2.1 — `properties` table + migration

**Objective:** The tenancy root table every property-scoped table will reference.

**Dependencies:** 1.1

**Acceptance criteria:**
- FK `owner_id → users.id` with `ON DELETE RESTRICT` — deleting a user who owns a property is blocked.
- Defaults present: `timezone = 'Asia/Kolkata'`, `currency = 'INR'`.

**Gemini prompt:**
> Create `app/models/property.py` for a `properties` table using `UUIDPrimaryKeyMixin`, `TimestampMixin`, `SoftDeleteMixin`, with columns: `owner_id` (`UUID`, FK `users.id`, `ondelete="RESTRICT"`, not null), `name` (`TEXT`, not null), `address_line`, `city`, `state` (`TEXT`, nullable), `pincode` (`VARCHAR(10)`, nullable), `country` (`CHAR(2)`, not null, default `'IN'`), `timezone` (`TEXT`, not null, default `'Asia/Kolkata'`), `currency` (`CHAR(3)`, not null, default `'INR'`), `is_active` (`BOOLEAN`, not null, default `true`), `created_by`/`updated_by` (`UUID`, FK `users.id`, `ondelete="SET NULL"`, nullable). Generate the migration, attaching the `set_updated_at()` trigger (from milestone 0.4) to this table. Write a pytest-asyncio integration test: create a user and a property owned by them, attempt to delete the user via raw SQL `DELETE FROM users WHERE id = ...`, and assert it raises a foreign-key violation. Fully implement — no stubs.

### 2.2 — `property_members` table + migration

**Objective:** The access-control join table that makes multi-property, multi-staff possible.

**Dependencies:** 2.1

**Acceptance criteria:**
- FKs `property_id → properties.id ON DELETE CASCADE` and `user_id → users.id ON DELETE CASCADE`.
- `role` enum is `owner`/`manager`/`staff`; unique on `(property_id, user_id)`.

**Gemini prompt:**
> Create a Postgres enum type `property_role` with values `owner`, `manager`, `staff` (as a proper SQLAlchemy/Alembic enum, not a plain string column with an app-level check). Create `app/models/property_member.py` for a `property_members` table using `UUIDPrimaryKeyMixin`, with columns: `property_id` (FK `properties.id`, `ondelete="CASCADE"`, not null), `user_id` (FK `users.id`, `ondelete="CASCADE"`, not null), `role` (the `property_role` enum, not null), `invited_at`, `accepted_at` (`TIMESTAMPTZ`, nullable), `is_active` (`BOOLEAN`, not null, default `true`), `created_at`/`updated_at` from `TimestampMixin`. Add a unique constraint on `(property_id, user_id)`. Generate the migration. Write a pytest-asyncio test that inserts one membership row, attempts to insert a second row with the same `(property_id, user_id)` pair, and asserts an `IntegrityError`. Fully implement — no stubs.

### 2.3 — Property repository

**Objective:** Data access for properties, no authorization logic.

**Dependencies:** 2.1

**Acceptance criteria:**
- Methods: `create`, `get_by_id`, `list_for_user` (joins through `property_members`) — no authorization decisions made here.

**Gemini prompt:**
> Implement `app/repositories/property_repository.py` with a `PropertyRepository` class exposing async methods: `create(**fields) -> Property`, `get_by_id(property_id) -> Property | None` (excludes soft-deleted rows by default), and `list_for_user(user_id) -> list[Property]` (joins `properties` to `property_members` on `property_id`, filters `property_members.user_id == user_id AND property_members.is_active = true AND properties.deleted_at IS NULL`). No role-checking or "can this user do X" logic belongs here — that's the service/dependency layer's job. Write a pytest-asyncio integration test: create two users, one property owned by user A with A as a member, confirm `list_for_user(A.id)` returns it and `list_for_user(B.id)` returns an empty list. Fully implement — no stubs.

### 2.4 — Property service

**Objective:** Creating a property must atomically create both the property row and its owner's membership row.

**Dependencies:** 2.3, 2.2

**Acceptance criteria:**
- Creating a property in one call produces both the `properties` row and a `property_members` row with `role='owner'`, verified to succeed or roll back together.

**Gemini prompt:**
> Implement `app/services/property_service.py` with a `PropertyService` class taking `PropertyRepository` and a new `PropertyMemberRepository` (create `app/repositories/property_member_repository.py` now, following the same data-access-only pattern as prior repositories, with `create`, `get_by_property_and_user`, `list_by_property`, `update_role`, `deactivate` methods). Implement `async def create_property(owner_id, name, address_line, city, state, pincode, timezone, currency) -> Property`: creates the property, then creates a `property_members` row for `owner_id` with `role='owner'`, `accepted_at=now()`, `is_active=true`, within the same database transaction (both use the same `AsyncSession`, and the caller — the router — controls the commit, so a failure partway through leaves nothing committed). Write a pytest-asyncio integration test using the real `db_session` fixture (not mocks, since this test is specifically verifying atomicity across two tables): call `create_property`, then query both tables directly and confirm both rows exist and are correctly linked. Fully implement — no stubs.

### 2.5 — Create + List properties endpoints

**Objective:** Expose property creation and per-user property listing over HTTP.

**Dependencies:** 2.4, 1.7

**Acceptance criteria:**
- `POST /properties` requires auth, returns `201`.
- `GET /properties` returns only properties the authenticated user belongs to — proven with two users and no cross-visibility.

**Gemini prompt:**
> Implement `app/schemas/property.py` with `PropertyCreateRequest` (name, address_line, city, state, pincode, timezone, currency — all with sane optional defaults matching the model) and `PropertyResponse` (all fields including `id`, `owner_id`, timestamps). Implement `app/api/v1/routers/properties.py` with `POST /properties` (depends on `get_current_user`, calls `PropertyService.create_property` with the current user as owner, returns `201`) and `GET /properties` (depends on `get_current_user`, calls `PropertyRepository.list_for_user`, returns a list of `PropertyResponse`). Wire the router into the v1 aggregate router. Write a pytest-asyncio integration test: user A creates a property, user B (separately registered) creates their own; assert `GET /properties` as user A returns only A's property and as user B returns only B's. Fully implement — no stubs.

### 2.6 — Get/Patch/Delete property endpoints

**Objective:** Round out property CRUD.

**Dependencies:** 2.5

**Acceptance criteria:**
- All three reject non-members with `403` (a simple ownership/membership check for now — full role granularity lands in 2.7).
- `DELETE` is a soft delete — the row still exists afterward, just marked deleted.

**Gemini prompt:**
> Add `PropertyUpdateRequest` (all fields optional) to `app/schemas/property.py`. Add `GET /properties/{property_id}`, `PATCH /properties/{property_id}`, `DELETE /properties/{property_id}` to `app/api/v1/routers/properties.py`. For now, implement a simple inline check in each route (to be replaced by the real dependency in 2.7): fetch the caller's membership via `PropertyMemberRepository.get_by_property_and_user`, return `403` if none exists or `is_active` is false. `DELETE` sets `deleted_at = now()` via the repository rather than issuing a SQL `DELETE`. Write pytest-asyncio integration tests: a member can `GET`/`PATCH` their property, a non-member gets `403` on all three, and after `DELETE` a direct repository query (bypassing the "exclude soft-deleted" default) shows the row still present with `deleted_at` set. Fully implement — no stubs.

### 2.7 — `require_property_member` / `require_role` dependency

**Objective:** The single tenant-isolation boundary every property-scoped endpoint from here on depends on.

**Dependencies:** 2.2, 1.7

**Acceptance criteria:**
- Given `(current_user, property_id)`, resolves the caller's role or raises `403`.
- `require_role('manager')` allows `owner`/`manager`, rejects `staff` — proven for all three roles against all three thresholds.
- A user from property A genuinely cannot access property B's data (not just "a different role within the same property").

**Gemini prompt:**
> Implement `require_property_member` and `require_role(min_role: str)` as FastAPI dependency factories in `app/api/v1/deps.py`. `require_property_member` takes `property_id` from the path, depends on `get_current_user`, looks up the membership via `PropertyMemberRepository.get_by_property_and_user`, raises `HTTPException(403)` if no active membership exists, and otherwise returns the membership object (making the caller's role available to the route). `require_role(min_role)` wraps `require_property_member`, additionally checking the resolved role against an ordering `staff < manager < owner`, raising `403` if the caller's role is below `min_role`. Replace the inline checks added in 2.6 with `Depends(require_property_member)` (or `require_role` where a stricter check belongs). Write pytest-asyncio integration tests covering: (a) a table-driven matrix of all 3 actual roles against all 3 `min_role` thresholds, asserting exactly the expected pass/fail for each of the 9 combinations; (b) the critical cross-tenant case — user X is a member of property A only; a request for property B (where X has no membership at all) returns `403`, not data. Fully implement — no stubs.

### 2.8 — Property member list/role-change/revoke endpoints

**Objective:** Let owners and managers manage who has access to a property.

**Dependencies:** 2.7

**Acceptance criteria:**
- `GET /properties/{id}/members` visible to any member; `PATCH`/`DELETE` restricted to `owner`/`manager`.
- A `staff` member attempting a role change gets `403`.
- The last remaining `owner` of a property cannot be revoked or demoted.

**Gemini prompt:**
> Add `PropertyMemberResponse` and `PropertyMemberRoleUpdateRequest` schemas to `app/schemas/property.py`. Add to `app/api/v1/routers/properties.py`: `GET /properties/{property_id}/members` (depends on `require_property_member`, any role), `PATCH /properties/{property_id}/members/{user_id}` (depends on `require_role("manager")`, calls a new `PropertyService.change_member_role` method), `DELETE /properties/{property_id}/members/{user_id}` (same dependency, calls a new `PropertyService.revoke_member` method). In `PropertyService`, implement both methods to first check whether the target is the property's *only remaining* `owner` (query all active members with `role='owner'` for the property; if the target is the sole one and the operation would remove or demote them, raise a `LastOwnerError` mapped to `409` in the router) before proceeding. Write pytest-asyncio integration tests: staff attempting a role change gets `403`; manager successfully changes a staff member to manager; attempting to revoke or demote the property's only owner returns `409` with a clear error, and a second owner can be revoked/demoted successfully once one exists. Fully implement — no stubs.

---

## Phase 3 — Core Domain: Rooms, Guests, Payments

### 3.1 — `rooms` table + migration

**Objective:** Physical room inventory per property.

**Dependencies:** 2.1

**Acceptance criteria:**
- `CHECK (capacity BETWEEN 1 AND 20)`, tested at boundary values (0, 1, 20, 21).
- Partial unique index `(property_id, room_number) WHERE deleted_at IS NULL` — a deleted room's number can be reused, an active one's can't.

**Gemini prompt:**
> Create a Postgres enum `room_type` with values `single`, `double`, `triple`, `quad`, `custom`. Create `app/models/room.py` for a `rooms` table using `UUIDPrimaryKeyMixin`, `TimestampMixin`, `SoftDeleteMixin`, with columns: `property_id` (FK `properties.id`, `ondelete="CASCADE"`, not null), `room_number` (`VARCHAR(20)`, not null), `room_type` (the enum, not null), `custom_type_label` (`TEXT`, nullable — only meaningful when `room_type='custom'`), `capacity` (`SMALLINT`, not null), `is_ac` (`BOOLEAN`, not null, default `false`), `advance_details` (`NUMERIC(10,2)`, nullable), `is_active` (`BOOLEAN`, not null, default `true`), `created_by`/`updated_by` (FK `users.id`, `ondelete="SET NULL"`, nullable). Add `CHECK (capacity BETWEEN 1 AND 20)`. Add a **partial** unique index on `(property_id, room_number)` filtered `WHERE deleted_at IS NULL` (use `postgresql_where` in the SQLAlchemy `Index` construct). Attach the `set_updated_at()` trigger. Generate the migration. Write pytest-asyncio tests: inserting `capacity=0` and `capacity=21` both raise `IntegrityError`, `capacity=1` and `capacity=20` both succeed; create a room, soft-delete it (set `deleted_at`), create a new active room with the same `(property_id, room_number)`, and confirm it succeeds; then confirm creating a *second* active room with that same number fails. Fully implement — no stubs.

### 3.2 — Room repository

**Objective:** Data access for rooms, no capacity/business logic.

**Dependencies:** 3.1

**Acceptance criteria:**
- Methods: `create`, `get_by_id`, `list_by_property`, `update`, `soft_delete`.

**Gemini prompt:**
> Implement `app/repositories/room_repository.py` with a `RoomRepository` class exposing async `create(**fields) -> Room`, `get_by_id(room_id) -> Room | None` (excludes soft-deleted), `list_by_property(property_id) -> list[Room]` (excludes soft-deleted), `update(room_id, **fields) -> Room`, `soft_delete(room_id) -> None` (sets `deleted_at`). No capacity checks, no duplicate-number checks — those belong in the service layer (3.3). Write a pytest-asyncio integration test covering each method against a real test database. Fully implement — no stubs.

### 3.3 — Room service

**Objective:** Enforce room invariants: unique numbering within a property, and the RESTRICT-style guard against deleting a room with any guest history.

**Dependencies:** 3.2

**Acceptance criteria:**
- Rejects a duplicate room number within a property with a domain exception, not a raw constraint-violation leak.
- Rejects deleting a room referenced by any guest (active or historical).

**Gemini prompt:**
> Implement `app/services/room_service.py` with a `RoomService` class taking `RoomRepository`. Implement `async def create_room(property_id, room_number, room_type, custom_type_label, capacity, is_ac, advance_details, created_by) -> Room`: checks for an existing active room with the same `(property_id, room_number)` via the repository first and raises `DuplicateRoomNumberError` (define in `core/exceptions.py`) rather than letting the DB constraint violation surface as a generic 500. Implement `async def delete_room(room_id) -> None`: this milestone can't yet query guests (that table doesn't exist until 3.5) — implement it now querying a raw SQL `SELECT EXISTS (SELECT 1 FROM guests WHERE room_id = :room_id)` guarded so it degrades gracefully (catch the "relation does not exist" case is NOT acceptable — instead, add a one-line note in the docstring that this method's guest-check will be exercised for real starting in milestone 3.7's tests, since the `guests` table will exist by then) and calls `RoomRepository.soft_delete` only if no guest references exist. Write pytest-asyncio unit tests (mocked repository) for the duplicate-number rejection. Fully implement — no stubs; if a genuine ordering constraint makes one specific sub-case untestable until 3.5 lands, say so explicitly in a code comment rather than silently skipping it.

### 3.4 — Room CRUD endpoints

**Objective:** Expose room management over HTTP, property-scoped.

**Dependencies:** 3.3, 2.7

**Acceptance criteria:**
- All routes property-scoped via `require_property_member`/`require_role`.
- List endpoint returns each room with occupancy/status **computed at request time**, not a stored column.

**Gemini prompt:**
> Implement `app/schemas/room.py` with `RoomCreateRequest`, `RoomUpdateRequest`, and `RoomResponse` (including computed `occupied_beds: int` and `status: Literal["Full", "Available"]` fields not present on the ORM model — populate them in the router/service, not the schema itself). Implement `app/api/v1/routers/rooms.py` with `POST /properties/{property_id}/rooms` (depends on `require_role("staff")` — any active member can create), `GET /properties/{property_id}/rooms`, `GET /properties/{property_id}/rooms/{room_id}`, `PATCH /properties/{property_id}/rooms/{room_id}`, `DELETE /properties/{property_id}/rooms/{room_id}`. For now, since `guests` doesn't exist until 3.5, compute `occupied_beds=0` and `status="Available"` for every room — leave a clear, explicit note in the code (not a silent lie) that this becomes real in milestone 3.7, and write the response-shaping code so plugging in the real occupancy query later is a one-line change, not a rewrite. Write pytest-asyncio integration tests for full CRUD, plus a test confirming a `staff`-role user from a *different* property gets `403` on all routes. Fully implement — no stubs beyond the explicitly-noted occupancy placeholder, which is a documented sequencing necessity, not a shortcut.

### 3.5 — `guests` table + migration

**Objective:** The core tenant record — the largest table by row count in the system.

**Dependencies:** 3.1

**Acceptance criteria:**
- All enums (`guest_type`, `stay_unit`, `food_type`) match `DB_ARCHITECTURE.md` §4.5.
- `CHECK` constraints present: `monthly_rent >= 0`, move-out consistency (`active = true OR moved_out_at IS NOT NULL`).

**Gemini prompt:**
> Create Postgres enums: `guest_type` (`permanent`, `temporary`), `stay_unit` (`days`, `months`, `years`), `food_type` (`veg`, `non_veg`, `eggetarian`). Create `app/models/guest.py` for a `guests` table using `UUIDPrimaryKeyMixin`, `TimestampMixin`, `SoftDeleteMixin`, with columns: `property_id` (FK `properties.id`, `ondelete="CASCADE"`, not null — denormalized directly per `DB_ARCHITECTURE.md` §3, not derived only through `room_id`), `room_id` (FK `rooms.id`, `ondelete="RESTRICT"`, not null), `full_name` (`TEXT`, not null), `phone` (`VARCHAR(20)`, not null), `aadhar_number_encrypted` (`BYTEA`, nullable — real encryption lands in milestone 6.4; for now store the UTF-8 bytes of the plaintext value so the column shape and read/write path are correct, and add a `# SECURITY:` comment noting this is not yet encrypted), `aadhar_last4` (`CHAR(4)`, nullable), `permanent_address` (`TEXT`, nullable), `guest_type` (enum, not null, default `'permanent'`), `stay_duration` (`SMALLINT`, nullable), `stay_unit` (enum, nullable), `monthly_rent` (`NUMERIC(10,2)`, not null), `advance_paid` (`NUMERIC(10,2)`, nullable), `has_food` (`BOOLEAN`, not null, default `false`), `food_type` (enum, nullable), `active` (`BOOLEAN`, not null, default `true`), `joined_at` (`DATE`, not null), `moved_out_at` (`DATE`, nullable), `created_by`/`updated_by` (FK `users.id`, `ondelete="SET NULL"`, nullable). Add `CHECK (monthly_rent >= 0)`, `CHECK (advance_paid IS NULL OR advance_paid >= 0)`, `CHECK (active = true OR moved_out_at IS NOT NULL)`. Attach the `set_updated_at()` trigger. Generate the migration. Write pytest-asyncio tests for each constraint: negative rent rejected, negative advance rejected, `active=false` with `moved_out_at=NULL` rejected, `active=false` with a real `moved_out_at` accepted. Fully implement — no stubs.

### 3.6 — Guest repository

**Objective:** Data access for guests with property/room/status filtering.

**Dependencies:** 3.5

**Acceptance criteria:**
- Methods: `create`, `get_by_id`, `list_by_property` (with `active`/`room_id`/`search` filters), `update`, `soft_delete`.

**Gemini prompt:**
> Implement `app/repositories/guest_repository.py` with a `GuestRepository` class exposing async `create(**fields) -> Guest`, `get_by_id(guest_id) -> Guest | None`, `list_by_property(property_id, active: bool | None = None, room_id: uuid.UUID | None = None, search: str | None = None) -> list[Guest]` (all filters optional and combinable; `search` does a case-insensitive `ILIKE` against `full_name` and `phone`), `update(guest_id, **fields) -> Guest`, `soft_delete(guest_id) -> None`. Write pytest-asyncio integration tests covering each filter independently and combined (e.g. `active=True` + `search="ram"`). Fully implement — no stubs.

### 3.7 — Guest service

**Objective:** Port the mobile app's occupancy/validation invariants server-side, with real concurrency safety this time.

**Dependencies:** 3.6, 3.3

**Acceptance criteria:**
- Rejects adding/moving a guest into a full room; allows moving within the same room with no capacity change.
- Room-capacity check and guest creation are atomic — two concurrent requests for the last free bed produce exactly one success.
- Every validation branch from the mobile app's `addGuest`/`updateGuest`/`setGuestActive` (phone format, non-negative rent, room-full checks) is covered by a unit test.

**Gemini prompt:**
> Implement `app/services/guest_service.py` with a `GuestService` class taking `GuestRepository` and `RoomRepository`. Port the logic from the mobile app's `src/lib/rent.js` (`activeOccupants`, `occupancyOf`, `bedsFreeOf`) as pure functions in `app/services/occupancy.py` operating on already-fetched `Room`/`Guest` domain data (not doing their own queries) so they're trivially unit-testable. Implement `async def add_guest(property_id, room_id, ...) -> Guest`: within a single transaction, `SELECT ... FOR UPDATE` the target room row (this row lock is what makes the concurrency guarantee real — without it two concurrent requests can both read "1 bed free" before either commits), compute free beds using `occupancy.py`, raise `RoomFullError` if none, validate phone format against the same regex as the mobile app (`^[+\d][\d\s-]{6,15}$`) and non-negative rent, raise `ValidationError` with a specific field-level message on failure, then create the guest. Implement `async def update_guest(guest_id, ...) -> Guest` with the same room-capacity re-check when `room_id` changes, and `async def set_guest_active(guest_id, active: bool) -> Guest` re-validating bed availability when reactivating. Now also implement `RoomService.delete_room`'s deferred guest-check from milestone 3.3 for real, using `GuestRepository`. Write: (a) unit tests with mocked repositories covering every validation branch; (b) an integration test using two concurrent `asyncio.gather()` calls to `add_guest` against a 1-capacity room with no existing guests, asserting exactly one succeeds and the other raises `RoomFullError`. Fully implement — no stubs.

### 3.8 — Guest CRUD endpoints

**Objective:** Expose guest management over HTTP, property-scoped.

**Dependencies:** 3.7, 2.7

**Acceptance criteria:**
- Property-scoped via `require_property_member`; list endpoint supports `active`/`room_id`/`search` query params.
- Response schema never includes the raw `aadhar_number_encrypted` value, only a masked/last-4 representation.

**Gemini prompt:**
> Implement `app/schemas/guest.py` with `GuestCreateRequest`, `GuestUpdateRequest`, and `GuestResponse` — `GuestResponse` must include `aadhar_last4: str | None` and must **not** include `aadhar_number_encrypted` as a field at all (not even masked — it should be structurally impossible to accidentally serialize it). Implement `app/api/v1/routers/guests.py` with `POST /properties/{property_id}/guests`, `GET /properties/{property_id}/guests` (query params `active`, `room_id`, `search`, all optional, passed through to the repository), `GET .../guests/{guest_id}`, `PATCH .../guests/{guest_id}`, all depending on `require_role("staff")` and calling `GuestService`. On create/update, compute `aadhar_last4` from the incoming `aadhar_number` field server-side (last 4 characters) rather than trusting a client-supplied value. Write pytest-asyncio integration tests: full CRUD; list filtering by each query param; and a test that inspects the raw JSON response body and asserts no key resembling the encrypted Aadhaar value is present. Fully implement — no stubs.

### 3.9 — Guest move-out/reactivate endpoints

**Objective:** Expose the lifecycle transitions that free/reclaim a bed.

**Dependencies:** 3.8

**Acceptance criteria:**
- Move-out sets `active=false`, `moved_out_at=now()`, and frees the bed (observable via the room list endpoint's occupancy).
- Reactivate re-validates bed availability and rejects if the room is now full.

**Gemini prompt:**
> Add `POST /properties/{property_id}/guests/{guest_id}/move-out` and `POST /properties/{property_id}/guests/{guest_id}/reactivate` to `app/api/v1/routers/guests.py`, both depending on `require_role("staff")`, both calling `GuestService.set_guest_active` (from 3.7) with `active=False`/`active=True` respectively. Now also go back and complete the "occupied_beds"/"status" computation in the room list/detail endpoints from milestone 3.4 — replace the placeholder `occupied_beds=0` with a real call into `app/services/occupancy.py` using the property's actual guest data via `GuestRepository.list_by_property(property_id, active=True)`. Write pytest-asyncio integration tests: move a guest out of a 1-capacity room, confirm the room's `GET` response now shows `status="Available"`; add a new guest into that now-free bed; attempt to reactivate the original moved-out guest and confirm it's rejected with the room full again. Fully implement — no stubs, and confirm no placeholder values remain anywhere in the rooms router.

### 3.10 — `payments` table + migration

**Objective:** The financial ledger table — the largest table in the system by long-run volume.

**Dependencies:** 3.5

**Acceptance criteria:**
- `CHECK (amount > 0)`, `CHECK (date_trunc('month', for_month) = for_month)`, unique `(property_id, idempotency_key)` — each individually tested with a violating insert.

**Gemini prompt:**
> Create a Postgres enum `payment_method` with values `upi`, `cash`, `bank_transfer`, `card`. Create `app/models/payment.py` for a `payments` table using `UUIDPrimaryKeyMixin`, `TimestampMixin`, `SoftDeleteMixin`, with columns: `property_id` (FK `properties.id`, `ondelete="CASCADE"`, not null — denormalized), `guest_id` (FK `guests.id`, `ondelete="RESTRICT"`, not null), `amount` (`NUMERIC(10,2)`, not null), `method` (enum, not null), `for_month` (`DATE`, not null), `paid_at` (`TIMESTAMPTZ`, not null, server default `now()`), `recorded_by` (FK `users.id`, `ondelete="SET NULL"`, nullable), `idempotency_key` (`UUID`, not null), `notes` (`TEXT`, nullable). Add `CHECK (amount > 0)` and `CHECK (date_trunc('month', for_month) = for_month)`. Add a unique constraint on `(property_id, idempotency_key)`. Attach the `set_updated_at()` trigger. Generate the migration. Write pytest-asyncio tests: `amount=0` and negative amounts rejected; `for_month` of `2026-07-15` (not the first of the month) rejected, `2026-07-01` accepted; inserting two payments with the same `(property_id, idempotency_key)` — the second rejected. Fully implement — no stubs.

### 3.11 — Payment repository

**Objective:** Data access for payments, no balance math.

**Dependencies:** 3.10

**Acceptance criteria:**
- Methods: `create`, `get_by_id`, `list_by_property` (filterable by `guest_id`/`for_month`), `soft_delete`, plus a lookup by idempotency key.

**Gemini prompt:**
> Implement `app/repositories/payment_repository.py` with a `PaymentRepository` class exposing async `create(**fields) -> Payment`, `get_by_id(payment_id) -> Payment | None`, `get_by_idempotency_key(property_id, idempotency_key) -> Payment | None`, `list_by_property(property_id, guest_id=None, for_month=None) -> list[Payment]`, `soft_delete(payment_id) -> None`. No balance calculation, no idempotency *enforcement logic* (just the lookup) — that decision belongs in the service layer (3.12). Write a pytest-asyncio integration test covering each method. Fully implement — no stubs.

### 3.12 — Payment service

**Objective:** Port the mobile app's dues/balance reconciliation logic, with real idempotency this time.

**Dependencies:** 3.11, 3.7

**Acceptance criteria:**
- Recording a payment twice with the same idempotency key produces exactly one row, not a duplicate.
- Balance calculation matches the mobile app's invariant: pending + collected always equals expected rent, verified against a constructed scenario with a known expected answer.

**Gemini prompt:**
> Port `paidForMonth` and `balanceForMonth` from the mobile app's `src/lib/rent.js` as pure functions in `app/services/rent_reconciliation.py`, operating on already-fetched `Guest`/`list[Payment]` data. Implement `app/services/payment_service.py` with a `PaymentService` class taking `PaymentRepository` and `GuestRepository`. Implement `async def record_payment(property_id, guest_id, amount, method, for_month, idempotency_key, recorded_by, notes=None) -> Payment`: first check `get_by_idempotency_key`; if a payment with that key already exists for this property, return it as-is (idempotent no-op, not an error) rather than creating a duplicate; otherwise validate the guest exists and belongs to `property_id`, validate `amount > 0`, then create the payment. Write: (a) an integration test that calls `record_payment` twice with the identical idempotency key and asserts exactly one row exists in the database afterward and both calls return the same payment id; (b) a unit test replicating a scenario from the mobile app's `computeStats`-adjacent logic — a guest with `monthly_rent=10000`, two payments of 4000 and 3000 for the same month — asserting `balanceForMonth` returns exactly `3000`. Fully implement — no stubs.

### 3.13 — Payment endpoints

**Objective:** Expose payment recording and querying over HTTP.

**Dependencies:** 3.12, 2.7

**Acceptance criteria:**
- `POST .../payments` requires the idempotency key; `DELETE` is a soft delete.
- `GET .../payments?month=&guest_id=` filters correctly against a seeded multi-month, multi-guest dataset.

**Gemini prompt:**
> Implement `app/schemas/payment.py` with `PaymentCreateRequest` (including a required `idempotency_key: uuid.UUID` field), `PaymentResponse`. Implement `app/api/v1/routers/payments.py` with `POST /properties/{property_id}/payments` (depends on `require_role("staff")`, calls `PaymentService.record_payment`), `GET /properties/{property_id}/payments` (query params `guest_id`, `month` — parse `month` as `YYYY-MM` and convert to the first-of-month `date` the repository expects), `DELETE /properties/{property_id}/payments/{payment_id}` (soft delete via the repository). Write pytest-asyncio integration tests: creating a payment without `idempotency_key` returns `422`; seed payments across 3 different months and 2 different guests, then confirm `GET ?month=2026-07` and `GET ?guest_id=<id>` each return exactly the expected subset; confirm `DELETE` leaves the row present with `deleted_at` set rather than gone. Fully implement — no stubs.

### 3.14 — Dashboard stats service

**Objective:** Port the mobile app's `computeStats` aggregate exactly.

**Dependencies:** 3.7, 3.12

**Acceptance criteria:**
- Reproduces `pendingRent`, `collectedThisMonth`, `totalCollected`, `occupancyRate`, `dueGuests` (sorted by balance descending) exactly.
- No divide-by-zero on occupancy rate for a property with zero rooms.

**Gemini prompt:**
> Implement `app/services/stats_service.py` with a `StatsService` class taking `GuestRepository`, `RoomRepository`, `PaymentRepository`. Port `computeStats` from the mobile app's `src/lib/rent.js` line-for-line in logic (not necessarily syntax) as `async def dashboard_stats(property_id, month: date) -> DashboardStats` (define `DashboardStats` as a Pydantic model or dataclass with fields `pending_rent`, `collected_this_month`, `total_collected`, `occupancy_rate`, `total_beds`, `occupied_beds`, `total_rooms`, `active_guests`, `due_guests: list[DueGuest]` where `DueGuest` has `guest_id`, `guest_name`, `balance`, sorted descending by balance). Guard the occupancy-rate division explicitly: `0 if total_beds == 0 else round(occupied_beds / total_beds * 100)`. Write a unit test constructing a fixture with known rooms/guests/payments and asserting every field of the returned `DashboardStats` matches a hand-calculated expected value, plus a separate test for a property with zero rooms confirming `occupancy_rate == 0` and no exception. Fully implement — no stubs.

### 3.15 — Dashboard endpoint

**Objective:** Expose the dashboard aggregate over HTTP.

**Dependencies:** 3.14

**Acceptance criteria:**
- `GET .../stats/dashboard?month=` returns the service output; `month` defaults to the current month when omitted.

**Gemini prompt:**
> Add `GET /properties/{property_id}/stats/dashboard` to a new `app/api/v1/routers/stats.py`, depending on `require_property_member`, accepting an optional `month` query param (`YYYY-MM`, defaulting to the server's current month if omitted — compute this with `date.today().replace(day=1)`, not a client-trusted default), calling `StatsService.dashboard_stats`. Wire the router into the v1 aggregate router. Write a pytest-asyncio integration test seeding a realistic small dataset (a couple of rooms, a few guests, a few payments spanning two months) and asserting the endpoint's JSON response matches the expected aggregate for both the current month and an explicitly-requested prior month. Fully implement — no stubs.

---

## Phase 4 — Staff Collaboration (Invites)

### 4.1 — `invites` table + migration

**Objective:** Pending staff invitations before they become real memberships.

**Dependencies:** 2.2

**Acceptance criteria:**
- FK `property_id → properties.id ON DELETE CASCADE`, unique `token_hash`, `expires_at` present.

**Gemini prompt:**
> Create `app/models/invite.py` for an `invites` table using `UUIDPrimaryKeyMixin`, `TimestampMixin`, with columns: `property_id` (FK `properties.id`, `ondelete="CASCADE"`, not null), `email` (`CITEXT`, not null), `role` (reuse the `property_role` enum from 2.2, not null), `token_hash` (`TEXT`, unique, not null), `invited_by` (FK `users.id`, `ondelete="SET NULL"`, nullable), `expires_at` (`TIMESTAMPTZ`, not null), `accepted_at` (`TIMESTAMPTZ`, nullable). Generate the migration. Write a pytest-asyncio test confirming the unique constraint on `token_hash` rejects a duplicate insert. Fully implement — no stubs.

### 4.2 — Invite service

**Objective:** Generate and validate invite tokens.

**Dependencies:** 4.1

**Acceptance criteria:**
- Generates a random token, stores only its hash; rejects creating a duplicate pending invite for the same email+property.

**Gemini prompt:**
> Implement `app/repositories/invite_repository.py` (standard data-access-only pattern: `create`, `get_by_token_hash`, `get_pending_by_property_and_email`, `list_by_property`, `mark_accepted`). Implement `app/services/invite_service.py` with an `InviteService` class taking `InviteRepository` and `PropertyMemberRepository`. Implement `async def create_invite(property_id, email, role, invited_by) -> tuple[Invite, str]` (returns the invite row and the *raw* token — only this call ever sees the raw value): checks `get_pending_by_property_and_email` first and raises `DuplicateInviteError` if an unexpired, unaccepted invite already exists; generates a cryptographically random token (`secrets.token_urlsafe(32)`), hashes it with SHA-256, stores the hash, sets `expires_at = now() + 7 days`. Write unit tests (mocked repository): duplicate pending invite raises; a valid call returns a token that, when hashed, matches what was passed to `create`. Fully implement — no stubs.

### 4.3 — Create-invite + list-invites endpoints

**Objective:** Let managers/owners invite staff over HTTP.

**Dependencies:** 4.2, 2.7

**Acceptance criteria:**
- Only `owner`/`manager` can create invites; `staff` gets `403`.
- List endpoint shows pending invites with expiry, never the raw token.

**Gemini prompt:**
> Implement `app/schemas/invite.py` with `InviteCreateRequest` (email, role), `InviteResponse` (id, email, role, expires_at, accepted_at — no token field at all), and `InviteCreatedResponse` (extends `InviteResponse` with a one-time `token: str` field, used only for the creation response so the raw token is returned exactly once to the inviter to relay out-of-band). Implement `app/api/v1/routers/invites.py` with `POST /properties/{property_id}/invites` (depends on `require_role("manager")`) returning `InviteCreatedResponse`, and `GET /properties/{property_id}/invites` (depends on `require_role("manager")`) returning a list of `InviteResponse`. Write pytest-asyncio integration tests: `staff` gets `403` on creation; `manager` succeeds and the response includes a token; the list endpoint response body, inspected as raw JSON, never contains a `token` key. Fully implement — no stubs.

### 4.4 — Accept-invite endpoint

**Objective:** Turn a valid invite into a real property membership.

**Dependencies:** 4.3

**Acceptance criteria:**
- Valid, unexpired token creates a `property_members` row with the invited role and marks the invite accepted.
- Expired or already-accepted token returns a clear `4xx`.
- The invited email must match the authenticated user's email.

**Gemini prompt:**
> Implement `async def accept_invite(raw_token, accepting_user) -> PropertyMember` in `InviteService`: hash the token, look it up, raise `InviteNotFoundError` (404) if absent, `InviteExpiredError` (410) if `expires_at < now()` or already accepted, `InviteEmailMismatchError` (403) if `accepting_user.email != invite.email` (case-insensitive compare), otherwise create the `property_members` row via `PropertyMemberRepository` and call `mark_accepted`. Add `POST /invites/accept` (not property-scoped in the path, since the token itself determines the property) to `app/api/v1/routers/invites.py`, depending on `get_current_user`, accepting `{"token": str}`, mapping each service exception to its HTTP status. Write pytest-asyncio integration tests for all four outcomes: success, not-found token, expired token, and email-mismatch (a different registered user attempting to accept someone else's invite). Fully implement — no stubs.

---

## Phase 5 — File Storage

### 5.1 — `file_assets` table + migration

**Objective:** Metadata for uploaded guest photos/documents.

**Dependencies:** 3.5

**Acceptance criteria:**
- FK `guest_id → guests.id ON DELETE CASCADE`, `kind` enum present, `storage_key` not nullable.

**Gemini prompt:**
> Create a Postgres enum `file_kind` with values `profile_picture`, `document`. Create `app/models/file_asset.py` for a `file_assets` table using `UUIDPrimaryKeyMixin`, with columns: `property_id` (FK `properties.id`, `ondelete="CASCADE"`, not null), `guest_id` (FK `guests.id`, `ondelete="CASCADE"`, nullable), `kind` (enum, not null), `storage_key` (`TEXT`, not null), `uploaded_by` (FK `users.id`, `ondelete="SET NULL"`, nullable), `created_at` (`TIMESTAMPTZ`, server default `now()`). Generate the migration. Write a pytest-asyncio test confirming deleting a guest cascades to delete their `file_assets` rows. Fully implement — no stubs.

### 5.2 — MinIO/S3 client + presigned URL utility

**Objective:** Object storage integration, S3-compatible, dev-parity via MinIO.

**Dependencies:** 0.2

**Acceptance criteria:**
- MinIO added to `docker-compose.yml`.
- Utility generates a working presigned PUT and presigned GET URL, tested against the real local MinIO instance with an actual upload/download round-trip.

**Gemini prompt:**
> Add a `minio` service to `docker/docker-compose.yml` (image `minio/minio`, console + API ports exposed, credentials from `.env`). Add `s3_endpoint_url`, `s3_access_key`, `s3_secret_key`, `s3_bucket_name` to `core/config.py`'s `Settings`. Implement `app/core/storage.py` using `boto3` (or `aioboto3` for async consistency with the rest of the stack) with functions `generate_upload_url(object_key: str, content_type: str, expires_in: int = 300) -> str` and `generate_download_url(object_key: str, expires_in: int = 300) -> str`, both producing presigned URLs against the configured S3-compatible endpoint. Write an integration test (not mocked) that: generates an upload URL, performs a real HTTP PUT to it with a small test payload using `httpx`, then generates a download URL for the same key and performs a real HTTP GET, asserting the retrieved bytes match what was uploaded. Fully implement — no stubs; this specifically must not be mocked, since the whole point is proving the presigned-URL flow actually works end-to-end against MinIO.

### 5.3 — Guest photo upload endpoint

**Objective:** Let the mobile app request an upload URL for a guest's profile picture.

**Dependencies:** 5.1, 5.2, 3.8

**Acceptance criteria:**
- Endpoint returns a presigned upload URL plus the `file_assets` row it pre-created.
- Re-uploading supersedes the old profile picture reference rather than duplicating it.

**Gemini prompt:**
> Implement `app/repositories/file_asset_repository.py` (standard pattern: `create`, `get_current_profile_picture(guest_id)`, `list_by_guest`). Implement `app/services/file_service.py` with `async def request_profile_picture_upload(property_id, guest_id, content_type, uploaded_by) -> tuple[FileAsset, str]`: builds an object key like `{property_id}/{guest_id}/{uuid7}.jpg`, creates a `file_assets` row with `kind='profile_picture'`, generates a presigned upload URL via `core/storage.py`, and — if a prior `profile_picture` `FileAsset` exists for this guest — leaves the old row in place (for audit/history) but ensures `get_current_profile_picture` always returns the most recently created one (order by `created_at desc limit 1`, not a boolean "is_current" flag that could get out of sync). Add `POST /properties/{property_id}/guests/{guest_id}/photo` to `app/api/v1/routers/guests.py`, depending on `require_role("staff")`, returning `{"upload_url": str, "file_asset_id": uuid.UUID}`. Write a pytest-asyncio integration test: request an upload URL twice for the same guest, confirm two `file_assets` rows exist but `get_current_profile_picture` returns the second one. Fully implement — no stubs.

---

## Phase 6 — Audit & Compliance

### 6.1 — `audit_logs` table + migration

**Objective:** Append-only history table backing the audit trail.

**Dependencies:** 0.4

**Acceptance criteria:**
- `property_id` nullable, `actor_user_id` FK `ON DELETE SET NULL`, `diff` as `jsonb`.
- Composite indexes `(property_id, created_at)` and `(entity_type, entity_id, created_at)` present.

**Gemini prompt:**
> Create `app/models/audit_log.py` for an `audit_logs` table with a UUIDv7 `id` (generate this table's mixin usage explicitly rather than assuming — same `UUIDPrimaryKeyMixin` as everywhere else, since it's already UUIDv7), columns: `property_id` (FK `properties.id`, `ondelete="CASCADE"`, nullable), `actor_user_id` (FK `users.id`, `ondelete="SET NULL"`, nullable), `action` (`TEXT`, not null), `entity_type` (`TEXT`, not null), `entity_id` (`UUID`, not null), `diff` (`JSONB`, nullable), `created_at` (`TIMESTAMPTZ`, server default `now()`, no `updated_at` — this table is append-only and never updated). Add composite indexes on `(property_id, created_at)` and `(entity_type, entity_id, created_at)`. Generate the migration. Write a pytest-asyncio test confirming both indexes exist via an `information_schema` query. Fully implement — no stubs.

### 6.2 — Audit-log write helper

**Objective:** A single, reusable way to write audit entries so no service hand-rolls its own.

**Dependencies:** 6.1

**Acceptance criteria:**
- One reusable function computes and writes a before/after diff containing only changed fields, not the entire object.

**Gemini prompt:**
> Implement `app/repositories/audit_log_repository.py` (`create` only — this table is never updated or queried by business logic, only written and later read for display). Implement `app/services/audit_service.py` with `async def record_audit(session, actor_user_id, property_id, action, entity_type, entity_id, before: dict | None, after: dict | None) -> None`: computes a diff dict containing only keys whose values differ between `before` and `after` (each changed key mapping to `{"old": ..., "new": ...}`), handling the create case (`before=None`, diff is the full `after`) and delete case (`after=None`, diff is the full `before`) explicitly, then writes the audit row using the same `session`/transaction as the caller (so a rollback of the business operation rolls back the audit entry too — this function must not open its own transaction or call `commit`). Write unit tests: updating one field of a 5-field object produces a diff with exactly one key; a create produces a diff matching the full object; a delete produces a diff matching the full prior object. Fully implement — no stubs.

### 6.3 — Wire audit logging into guest/payment/member mutations

**Objective:** Make every financially or privacy-sensitive mutation actually produce an audit trail.

**Dependencies:** 6.2, 3.7, 3.12, 2.8

**Acceptance criteria:**
- Every create/update/delete on `guests`, `payments`, and `property_members` writes a matching audit row in the same transaction as the mutation.
- Forcing a failure after the mutation rolls back the audit row too — no orphaned entries for failed writes.

**Gemini prompt:**
> Modify `GuestService` (add/update/delete/set_active methods), `PaymentService` (`record_payment`, delete), and `PropertyService` (`change_member_role`, `revoke_member`) to call `record_audit` from `app/services/audit_service.py` immediately after each mutation, within the same session/transaction, passing accurate `before`/`after` snapshots (fetch the row's state before mutating it where an update is involved) and the acting user's id. Use `action` values like `"guest.created"`, `"guest.updated"`, `"payment.recorded"`, `"payment.deleted"`, `"member.role_changed"`. Add a minimal `GET /properties/{property_id}/audit` endpoint (depends on `require_role("manager")`) returning recent audit entries, purely so this milestone's behavior is verifiable end-to-end via HTTP, not just by querying the database directly in a test. Write an integration test that: performs a guest update, then queries the audit endpoint and confirms an entry exists with the correct diff; then performs an operation designed to fail partway through the transaction (e.g. inject a constraint violation) and confirms no audit row was written for the failed attempt. Fully implement — no stubs.

### 6.4 — Aadhaar encryption at rest ⚠

**Objective:** Stop storing a government ID number in plaintext.

**Dependencies:** 3.5

**Acceptance criteria:**
- `aadhar_number_encrypted` is genuinely encrypted (pgcrypto or application-layer AES-GCM), not the plaintext-in-bytea placeholder from milestone 3.5.
- Decryption is only reachable through a role-gated service method — a `staff`-role caller never receives the decrypted value even via a direct service-level attempt, not just a blocked endpoint.

**Gemini prompt:**
> Implement application-layer encryption in `app/core/encryption.py` using AES-256-GCM (the `cryptography` package), with the key read from `core/config.py`'s `Settings` (add an `aadhar_encryption_key` setting, documented in `.env.example` as a base64-encoded 32-byte key, generated via a documented one-line command in a comment). Implement `encrypt_aadhar(plaintext: str) -> bytes` and `decrypt_aadhar(ciphertext: bytes) -> str`, with the nonce stored alongside the ciphertext (prepended, since GCM needs a fresh nonce per encryption and it must be retrievable at decrypt time). Update `GuestService.add_guest`/`update_guest` to call `encrypt_aadhar` before writing `aadhar_number_encrypted`, replacing the milestone-3.5 placeholder. Implement `async def get_decrypted_aadhar(guest_id, requesting_membership) -> str` in `GuestService`, raising `HTTPException(403)`-mappable `InsufficientRoleError` unless `requesting_membership.role in ("owner", "manager")` — check the role in this method itself, not just at the router layer, so the guarantee holds even if a future caller invokes the service directly. Do not add an HTTP endpoint exposing the decrypted value in this milestone unless explicitly needed elsewhere — the acceptance criterion is that the capability is safely gated, not that it's exposed. Write tests: encrypt then decrypt round-trips correctly; two encryptions of the identical plaintext produce different ciphertext (proving the nonce is actually fresh each time); `get_decrypted_aadhar` raises for a `staff`-role membership and succeeds for `manager`/`owner`. Fully implement — no stubs, and do not leave the milestone-3.5 plaintext-placeholder path reachable anywhere.

### 6.5 — Row-Level Security policies ⚠

**Objective:** A second, independent tenant-isolation layer enforced by Postgres itself, not just application code.

**Dependencies:** 2.1, 3.1, 3.5, 3.10

**Acceptance criteria:**
- RLS enabled on `rooms`, `guests`, `payments`, `properties`, `property_members`, with policies checking membership against a session-set `app.current_user_id`.
- A raw query executed as an authenticated-but-non-member session against another property's data returns zero rows, not an error and not the data — proving RLS catches a case where the application-layer check (2.7) is bypassed entirely.

**Gemini prompt:**
> Write an Alembic migration that: enables RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) on `properties`, `property_members`, `rooms`, `guests`, `payments`; creates a policy on each restricting visible rows to those whose `property_id` (or, for `properties` itself, `id`) appears in `SELECT property_id FROM property_members WHERE user_id = current_setting('app.current_user_id')::uuid AND is_active = true`; and creates a Postgres role (or documents the equivalent connection-pooling approach) that the application's normal database user runs as, distinct from a superuser/migration role that bypasses RLS (`BYPASSRLS`) for Alembic itself. Implement a `set_rls_context(session, user_id)` helper called from `get_db` in `api/v1/deps.py` (after `get_current_user` resolves the caller) that executes `SET LOCAL app.current_user_id = :user_id` on the session so every query within that request is scoped. Write an integration test that deliberately bypasses the application-layer `require_property_member` dependency — open a raw session, call `set_rls_context` for a user who is a member of property A only, then execute a raw `SELECT * FROM guests WHERE property_id = :property_b_id` and assert it returns zero rows even though matching rows genuinely exist in the table. This test is the actual point of the milestone: it must prove RLS works independently of the application code path, not just re-test the same 2.7 dependency again. Fully implement — no stubs, and note in a comment which database role Alembic must run as versus which the application connection pool must run as.

---

## Phase 7 — Scale Infrastructure (post-MVP)

### 7.1 — Structured logging + request-id middleware

**Objective:** Make production debugging and support possible.

**Dependencies:** 0.1

**Acceptance criteria:**
- Every log line is JSON-structured with a request-id consistent across all log statements within one request, also returned in a response header.

**Gemini prompt:**
> Implement JSON structured logging using `structlog`, configured in `core/config.py`/`main.py`'s startup. Implement a FastAPI middleware that generates a UUID request-id per incoming request (or reuses an inbound `X-Request-ID` header if present), binds it into `structlog`'s contextvars for the duration of the request (so every log statement anywhere in the call stack during that request automatically includes it with no manual threading), and sets it on the response as an `X-Request-ID` header. Write an integration test that makes a request, captures logs emitted during it (via `structlog`'s testing utilities or a captured stream), and asserts the request-id in the response header matches the request-id present in every captured log line for that request. Fully implement — no stubs.

### 7.2 — CORS + security headers + global exception handler

**Objective:** Baseline production HTTP hygiene.

**Dependencies:** 0.1

**Acceptance criteria:**
- CORS restricted to known origins (configurable, not `*` outside local dev).
- Unhandled exceptions never leak a stack trace to the client.

**Gemini prompt:**
> Add a `cors_allowed_origins: list[str]` setting to `core/config.py`, defaulting to `["http://localhost:8081"]` (the Expo dev server) for local dev, and wire FastAPI's `CORSMiddleware` to it — never default to `["*"]`. Add standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` when not local) via a small middleware. Implement a global exception handler in `main.py` that catches any unhandled exception, logs the full traceback server-side (via the `structlog` setup from 7.1 if already present, otherwise standard logging), and returns a generic `{"detail": "Internal server error", "request_id": ...}` body with `500` — never the raw exception message or traceback to the client. Write integration tests: a request from a disallowed origin doesn't receive CORS headers permitting it; a route that deliberately raises an unhandled exception returns a generic body with no stack trace or exception class name visible in the response. Fully implement — no stubs.

### 7.3 — Celery + Redis worker/beat skeleton

**Objective:** Background job infrastructure, proven to actually run before any real job depends on it.

**Dependencies:** 0.2

**Acceptance criteria:**
- A trivial scheduled task runs on schedule and is visible in worker logs, proving the beat/worker/broker wiring works.

**Gemini prompt:**
> Add `celery` to the project. Implement `app/worker/celery_app.py` configuring Celery with the Redis URL from `core/config.py` as both broker and result backend. Add `worker` and `beat` services to `docker/docker-compose.yml`, both running the same image as `api` but with different entrypoints (`celery -A app.worker.celery_app worker` / `celery -A app.worker.celery_app beat`). Implement one trivial scheduled task `heartbeat()` in `app/worker/tasks.py` that logs a message, scheduled every minute via Celery beat's schedule config. Write a test (can be a lightweight integration test using Celery's eager-mode task execution, or a documented manual verification step if eager mode doesn't adequately prove the beat scheduling — be explicit about which and why) confirming the task actually executes and its log output is observable. Fully implement — no stubs.

### 7.4 — Rent-due reminder scheduled job

**Objective:** The first real background job, built on the Phase 3 dues logic.

**Dependencies:** 7.3, 3.14

**Acceptance criteria:**
- Runs daily, identifies guests with a positive balance for the current month.
- Idempotent across multiple runs in the same day — doesn't re-notify for the same guest/month twice.

**Gemini prompt:**
> Add a `notification_log` table (migration: `id` UUIDv7 PK, `guest_id` FK `guests.id ondelete=CASCADE`, `notification_type` TEXT, `for_month` DATE, `created_at` TIMESTAMPTZ, unique constraint on `(guest_id, notification_type, for_month)` — this unique constraint is what makes idempotency enforceable at the database level, not just in application logic). Implement `rent_due_reminder()` as a Celery task in `app/worker/tasks.py`, scheduled daily via Celery beat: for every active property, call `StatsService.dashboard_stats` (from 3.14) to get `due_guests`, and for each, attempt to insert a `notification_log` row with `notification_type='rent_due'` for the current month — a unique-constraint violation on the insert means it was already notified this month, so catch it and skip rather than erroring the whole task. Log each new notification (actual push-delivery is explicitly out of scope for this milestone — the acceptance criterion is correct identification and idempotent recording, not delivery). Write an integration test: run the task twice in the same day against a fixture with two guests owing rent and one guest fully paid, and assert exactly two `notification_log` rows exist after both runs combined (not four). Fully implement — no stubs.

### 7.5 — `payments` monthly partitioning via `pg_partman` ⚠

**Objective:** Keep the platform's largest table query-fast as it grows into the tens of millions of rows.

**Dependencies:** 3.10

**Acceptance criteria:**
- Existing `payments` data migrates into a partitioned table with zero data loss (row count verified by count query before/after).
- `pg_partman` auto-creates future monthly partitions ahead of need.
- `EXPLAIN` on a `paid_at`-range-filtered query shows partition pruning actually occurring.

**Gemini prompt:**
> Write an Alembic migration that converts `payments` into a range-partitioned table on `paid_at`, partitioned monthly, following this sequence to avoid data loss: create a new partitioned table `payments_partitioned` with an identical schema (all columns, constraints, and indexes from milestone 3.10, since Postgres requires the partition key to be part of any unique constraint — adjust the `(property_id, idempotency_key)` unique constraint to include `paid_at` if required by Postgres's partitioning rules, and note explicitly in a comment if this changes the constraint's semantics at all); create partitions for the past 12 months plus the next 3; copy all existing rows from `payments` into it in batches (not a single unbounded `INSERT ... SELECT` on a large table); verify row counts match; rename tables (`payments` → `payments_old`, `payments_partitioned` → `payments`) inside a transaction; keep `payments_old` around rather than dropping it immediately, with a note to drop it manually after verification. Install and configure `pg_partman` to auto-manage future monthly partition creation on `payments`. Write a verification test/script (can be a standalone script rather than a pytest test, since this is largely a one-time operational migration) that: confirms row counts match before/after, inserts a payment with a `paid_at` far in the future and confirms `pg_partman` (or a manual pre-creation step you configure) has a partition ready for it, and runs `EXPLAIN (FORMAT JSON)` on a `paid_at`-range query, asserting the plan references only the relevant partition(s), not a sequential scan across all of them. Fully implement — this is explicitly one of the milestones most likely to run over 3 hours; do not compress the row-count verification or the `EXPLAIN` proof to save time, since those are the actual evidence the migration achieved anything.

### 7.6 — `audit_logs` monthly partitioning

**Objective:** Apply the same pattern to the second-fastest-growing table.

**Dependencies:** 6.1, 7.5

**Acceptance criteria:**
- Same approach as 7.5, applied to `audit_logs`.

**Gemini prompt:**
> Repeat the exact migration pattern established in milestone 7.5 for the `audit_logs` table, partitioned monthly on `created_at`. Since `audit_logs` is append-only (no updates, no soft-delete), this should be materially simpler — no need to worry about in-flight updates during the cutover. Reuse the same batch-copy, row-count-verification, and `pg_partman` auto-management approach. Write the same category of verification: row-count match and an `EXPLAIN` proof that a `created_at`-range query prunes to the relevant partition(s). Fully implement — no stubs, and explicitly note in the migration's docstring what was reused from 7.5's approach versus what differed.

---

## Closing note

This roadmap is deliberately sequenced so that by the end of **Phase 3**, you have a complete, testable backend matching the current mobile app's feature set — auth, single-property CRUD, rooms, guests, payments, dashboard — all server-backed instead of `AsyncStorage`-backed. That's the point where it's worth pausing to actually wire the mobile app to this backend and use it for real before investing in Phases 4–7. Phases 4 through 7 are real, necessary work for a multi-tenant SaaS product, but they're not what stands between you and a working system.

