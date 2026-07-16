# PG Management SaaS — Backend Architecture Document

**Scope:** System architecture for a FastAPI/PostgreSQL backend to serve the `pg_manager_mobile` React Native (Expo) client and future multi-property, multi-user use cases.
**Status:** Design only. No implementation code included.
**Author:** System architecture pass, generated 2026-07-15.

---

## 0. Reality Check Before Anything Else

Before designing the backend, it's worth being blunt about what the mobile repo actually is today, because it changes the shape of this project.

1. **The repo contains two unrelated frontends.** At the repo root (and duplicated again under `pgmanagement/`) there is a **Flutter app** (`pubspec.yaml`, `lib/`, `sqflite` local DB, Google Sign-In, backup/export/notification services, income + expense tracking, a Reports screen). Separately, `pg_manager_mobile/` is a **React Native/Expo app** with a completely different, smaller feature set (no expenses, no income tracking, no reports screen, no notifications, no Google auth). These are not two versions of the same app — they're two different products with overlapping names. This document analyzes **`pg_manager_mobile` only**, per your instructions, but if the intent is to eventually retire the Flutter app, its feature set (expenses, income, backup/export, notifications) needs to be a deliberate decision, not something the backend silently ignores.
2. **`pg_manager_mobile` has zero network code.** No `fetch`, no `axios`, no base URL, nothing. It is a fully offline, single-device app built on `zustand` + `AsyncStorage`. "Add a backend" for this app isn't an additive change — it's a rewrite of the entire data layer, plus new screens (login, property switcher, session handling) that don't exist yet.
3. **There is no authentication of any kind today.** Onboarding just asks for a PG name and owner name and stores it locally. There's no login screen, no user concept, no session. JWT auth is being requested for a client that has never had a user account.
4. **There is no multi-property concept today.** `pgDetails` is a single flat object (`{ pgName, ownerName }`). The app assumes exactly one property, permanently. Multi-property architecture is being requested for a client that structurally cannot express more than one property.

None of this blocks the backend design below — but be clear-eyed that shipping this backend also means a substantial mobile rewrite, not just pointing existing screens at new URLs. Section 7 covers this gap in more detail.

---

## 1. Mobile App Analysis

### 1.1 Current Data Models (extracted from `src/store/useStore.js` and screen forms)

The app persists a single JSON blob (`pg-manager-storage`) with four collections. These are the de facto data models the backend must be a superset of.

**PG / Property**
| Field | Type | Notes |
|---|---|---|
| pgName | string | required |
| ownerName | string | required |

Single object, not a list. No ID, no address, no timezone, no currency.

**Room**
| Field | Type | Notes |
|---|---|---|
| id | string (client-generated, not UUID) | `Date.now()` + random suffix |
| roomNumber | string | unique per property (case-insensitive) |
| type | string | free text, but UI offers presets: Single, 2 Sharing, 3 Sharing, 4 Sharing, Custom |
| capacity | int | 1–20, validated client-side |
| isAc | bool | |
| advanceDetails | string | free text, not numeric — likely a data quality problem worth fixing server-side |

Occupancy and "Full/Available" status are **never stored** — they're derived at read time from active guests. This is a good pattern; the backend should preserve it (derived, not cached, to avoid drift).

**Guest**
| Field | Type | Notes |
|---|---|---|
| id | string | client-generated |
| fullName | string | required |
| phone | string | regex-validated, not unique-enforced |
| roomNumber | string | FK by value, not by ID |
| monthlyRent | number | >= 0 |
| aadharNumber | string | **Indian government ID — currently stored in plaintext AsyncStorage with no encryption, no access control** |
| permanentAddress | string | free text |
| profilePicture | string | local `file://` URI from camera/gallery — meaningless outside the device |
| guestType | string | `'permanent'` or `'temporary'`, not enforced as enum |
| stayDuration | number \| null | |
| stayUnit | string | `'days' \| 'months' \| 'years'`, not enforced as enum |
| advancePaid | number \| null | |
| food | bool | |
| foodType | string | e.g. `'veg'`, not enforced as enum |
| active | bool | derived-ish but stored; drives room occupancy |
| joinedAt | ISO datetime | |
| movedOutAt | ISO datetime \| null | |

**Payment**
| Field | Type | Notes |
|---|---|---|
| id | string | client-generated |
| guestId | string | FK |
| guestName | string | **denormalized snapshot** at record time, deliberately kept even if guest is later deleted (ledger integrity) |
| roomNumber | string | denormalized snapshot |
| amount | number | > 0 |
| method | string | one of `UPI, Cash, Bank transfer, Card` (UI-constrained, not enum-enforced) |
| forMonth | string | `'YYYY-MM'`, attribution key for rent-due logic |
| date | ISO datetime | actual payment timestamp |

### 1.2 Business Logic Currently Living Client-Side (`src/lib/rent.js`)

This is the core domain logic and it needs to move server-side, since multi-device/multi-user access means the client can no longer be the source of truth:

- `occupancyOf` / `bedsFreeOf` / `roomStatusOf` — occupancy always derived from active guests assigned to a room, never stored.
- `paidForMonth` / `balanceForMonth` — dues computed by summing payments for a guest within a `forMonth`, subtracted from `monthlyRent`.
- `computeStats` — dashboard aggregate: pending rent, collected this month, total collected, occupancy rate, due-guest list sorted by balance descending.

This reconciliation logic (pending + collected = expected) is a real invariant worth preserving exactly in the service layer — it's the one piece of business logic in the app that's actually well thought out.

### 1.3 Navigation Flow

```
Onboarding (if !onboarded)
  → completes → Main (bottom tabs)

Main (Tab.Navigator)
  ├─ Dashboard
  ├─ Guests        → GuestDetail (stack push)
  ├─ Rooms
  └─ Payments

Stack screens (outside tabs):
  Settings                (from Dashboard)
  GuestDetail             (from Guests list)

Modal group:
  GuestForm       (add/edit guest)
  RoomForm        (add/edit room)
  RecordPayment   (log a payment, optionally guest-preselected)
```

No login/logout flow, no property switcher, no staff/invite flow, no reports screen exists in the navigator today.

### 1.4 Missing Screens That Require Backend Support

These don't exist in `pg_manager_mobile` yet but are implied the moment you add JWT auth + multi-property + multiple staff users:

- Login / Register / Forgot-Password / Reset-Password
- Property switcher (select active property; "create new property")
- Staff management (invite by email, assign role, revoke access)
- Session/token-expiry handling (silent refresh or forced re-login)
- Reports/analytics screen (the Flutter app has one; the RN app doesn't — worth a deliberate decision, not an oversight)
- Guest document/photo upload with real cloud storage (current camera/gallery picker writes to a local URI only)
- Push notification permission + rent-reminder settings (present in the Flutter app's `notification_service.dart`, absent here)
- Audit/activity log view (useful once multiple staff can edit the same property)

---

## 2. Backend Architecture

### 2.1 Stack

| Layer | Choice | Why |
|---|---|---|
| API framework | FastAPI | async-native, Pydantic validation, OpenAPI for free — matches a mobile client that needs a stable typed contract |
| ORM | SQLAlchemy 2.0 (async) | mature, explicit unit-of-work, works cleanly with the Repository pattern below |
| Migrations | Alembic | schema-as-code, required once more than one environment exists |
| DB | PostgreSQL | relational integrity for money + occupancy invariants; JSONB where genuinely useful (audit diffs); row-level constraints |
| Auth | JWT (access + refresh) | stateless access tokens, revocable refresh tokens stored hashed in DB |
| IDs | UUID v4 (server-generated) | required once IDs are exposed cross-device/cross-user; also removes the current client-side `Date.now()+random` ID scheme, which is not collision-safe across devices |
| Containerization | Docker / docker-compose | reproducible dev + deploy parity |

### 2.2 Layering

```
Client (mobile / future web)
        │  HTTPS + JWT
        ▼
┌─────────────────────────────┐
│  API Layer (FastAPI routers) │  request/response schemas (Pydantic), authn/authz deps, HTTP concerns only
├─────────────────────────────┤
│  Service Layer               │  business rules, invariants (occupancy, dues, tenant scoping), orchestrates repos, raises domain exceptions
├─────────────────────────────┤
│  Repository Layer            │  one repository per aggregate; SQLAlchemy queries only, no business logic
├─────────────────────────────┤
│  Data Layer (PostgreSQL)     │  constraints, indexes, migrations
└─────────────────────────────┘
```

Rule of thumb enforced by this layering: **routers never touch SQLAlchemy directly**, and **repositories never contain a business rule** (e.g. "can't delete a room with guests in it" lives in the service, not the repo). This is what makes the layer testable in isolation — services get tested against fake/mock repositories, repositories get tested against a real test database.

### 2.3 Multi-Property Model

The current app has one implicit property. The backend needs an explicit tenancy model:

```
User ──< PropertyMember >── Property ──< Room ──< Guest ──< Payment
  │                              │
  └── owns 0..N properties       └── PropertyMember.role: owner | manager | staff
```

- A `User` can belong to multiple `Property` records via `PropertyMember`, each with a `role`.
- Every property-scoped table (`Room`, `Guest`, `Payment`, future `Expense`) carries `property_id` directly (not just via a join through Room), so tenant isolation can be enforced with a single indexed column on every query — this matters both for query performance and for making it structurally hard to leak data across properties.
- Authorization is enforced at the service layer via a dependency that resolves `(current_user, property_id) → PropertyMember or 403`, on every property-scoped endpoint. This is the single most important security boundary in the whole system — get this dependency wrong once and every tenant's data is exposed to every other tenant.

### 2.4 Domain Model (ERD, textual)

| Entity | Key Fields | Relationships |
|---|---|---|
| **User** | id (UUID), email (unique), phone, password_hash, full_name, is_active, created_at, updated_at | 1—N PropertyMember |
| **Property** | id (UUID), owner_id (FK User), name, address, city, state, pincode, timezone, currency (default INR), is_active, created_at, updated_at | 1—N Room, Guest, Payment; 1—N PropertyMember |
| **PropertyMember** | id, property_id (FK), user_id (FK), role (enum: owner/manager/staff), invited_at, accepted_at, is_active | unique(property_id, user_id) |
| **Room** | id (UUID), property_id (FK), room_number, type (enum + custom_label), capacity, is_ac, advance_details (numeric, not free text), created_at, updated_at, deleted_at | unique(property_id, room_number); 1—N Guest |
| **Guest** | id (UUID), property_id (FK), room_id (FK, nullable once moved out permanently, or kept for history), full_name, phone, aadhar_number (encrypted), permanent_address, guest_type (enum), stay_duration, stay_unit (enum), monthly_rent (numeric 10,2), advance_paid (numeric, nullable), food (bool), food_type (enum, nullable), active, joined_at, moved_out_at, created_at, updated_at | 1—N Payment; 1—N FileAsset |
| **Payment** | id (UUID), property_id (FK, denormalized), guest_id (FK), amount (numeric 10,2), method (enum), for_month (date, first-of-month), paid_at (timestamptz), recorded_by (FK User), idempotency_key (unique), created_at | — |
| **FileAsset** | id, property_id, guest_id (nullable), url, kind (enum: profile_picture/document), uploaded_by, created_at | replaces the local `file://` URI scheme |
| **RefreshToken** | id, user_id (FK), token_hash, expires_at, revoked_at, device_info | supports multi-device login + revocation |
| **Invite** | id, property_id, email, role, token, expires_at, accepted_at | staff onboarding flow |
| **AuditLog** | id, property_id, actor_user_id, action, entity_type, entity_id, diff (JSONB), created_at | financial + PII changes should be auditable once multiple staff can edit |

Deliberately **not** modeled from the current app, because the RN client doesn't have them — call these out as a scoping decision, not an omission: `Expense`, `Income`, `Notification/Reminder`. These exist in the sibling Flutter app. If they're in scope, say so and they get added in the same pattern (property-scoped, UUID PK, service+repo pair).

Numeric fields (`monthly_rent`, `amount`, `advance_paid`) are `NUMERIC(10,2)`, never `float` — the current client uses JS `Number` for money, which is fine for a single offline device but not for a system doing arithmetic across records and comparing balances; float drift would eventually produce wrong "pending rent" totals.

### 2.5 Authentication & Authorization

- Passwords hashed with **argon2id** (or bcrypt if operational familiarity matters more).
- **Access token**: JWT, short-lived (10–15 min), contains `sub` (user_id), `iat`, `exp`. No property/role claims baked in — those are re-checked per request against `PropertyMember`, so a role revoked mid-session takes effect immediately rather than waiting for token expiry.
- **Refresh token**: opaque random value, stored **hashed** in `RefreshToken` table, long-lived (7–30 days), rotated on every use (old one revoked, new one issued) to limit replay damage if one leaks.
- **Authorization dependency chain**: `get_current_user` → `require_property_member(property_id)` → `require_role(min_role)`. Every property-scoped router depends on this chain; there is no endpoint that touches `Room`/`Guest`/`Payment` without it.
- Rate limiting on `/auth/login` and `/auth/register` specifically (brute-force and enumeration protection) — this is a mobile app that will hold PG owners' financial and tenant government-ID data; login abuse is not a theoretical risk here.

### 2.6 API Surface (v1)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | create user |
| POST | `/auth/login` | issue access + refresh token |
| POST | `/auth/refresh` | rotate tokens |
| POST | `/auth/logout` | revoke refresh token |
| POST | `/auth/password/forgot` | send reset email/OTP |
| POST | `/auth/password/reset` | consume reset token |
| GET | `/auth/me` | current user profile |
| POST | `/properties` | create property |
| GET | `/properties` | list properties current user belongs to |
| GET/PATCH/DELETE | `/properties/{property_id}` | property CRUD |
| POST | `/properties/{property_id}/members` | invite staff |
| GET | `/properties/{property_id}/members` | list members |
| PATCH/DELETE | `/properties/{property_id}/members/{user_id}` | change role / revoke |
| POST | `/properties/{property_id}/rooms` | create room |
| GET | `/properties/{property_id}/rooms` | list rooms (with derived occupancy/status) |
| GET/PATCH/DELETE | `/properties/{property_id}/rooms/{room_id}` | room CRUD |
| POST | `/properties/{property_id}/guests` | create guest |
| GET | `/properties/{property_id}/guests?active=&room_id=&search=` | list/filter guests |
| GET/PATCH/DELETE | `/properties/{property_id}/guests/{guest_id}` | guest CRUD |
| POST | `/properties/{property_id}/guests/{guest_id}/move-out` | deactivate, free bed |
| POST | `/properties/{property_id}/guests/{guest_id}/reactivate` | reactivate, re-validate bed availability |
| POST | `/properties/{property_id}/guests/{guest_id}/photo` | upload profile picture (presigned URL flow) |
| POST | `/properties/{property_id}/payments` | record payment (idempotency-key required) |
| GET | `/properties/{property_id}/payments?month=&guest_id=` | list/filter payments |
| DELETE | `/properties/{property_id}/payments/{payment_id}` | delete (soft, audited — this is money) |
| GET | `/properties/{property_id}/stats/dashboard?month=` | pending rent, collected, occupancy rate, due-guest list |
| GET | `/properties/{property_id}/reports/collections?from=&to=` | new — collections over a range |
| GET | `/properties/{property_id}/reports/export?format=csv` | new — export ledger |

### 2.7 Project Structure

```
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py            # settings via pydantic-settings, env-driven
│   │   ├── security.py          # password hashing, JWT encode/decode
│   │   └── exceptions.py        # domain exception → HTTP mapping
│   ├── db/
│   │   ├── base.py               # declarative base, naming conventions
│   │   └── session.py            # async engine/session factory
│   ├── models/                   # SQLAlchemy ORM models, one file per aggregate
│   ├── schemas/                  # Pydantic request/response models
│   ├── repositories/             # data access, one class per aggregate
│   ├── services/                 # business logic, invariants, orchestration
│   ├── api/v1/
│   │   ├── deps.py               # get_db, get_current_user, require_role
│   │   └── routers/              # auth.py, properties.py, rooms.py, guests.py, payments.py, stats.py
│   └── tests/
├── alembic/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
└── pyproject.toml
```

### 2.8 Repository & Service Pattern

- **Repository**: thin async data-access class per aggregate (`RoomRepository`, `GuestRepository`, …), exposing methods like `get_by_id`, `list_by_property`, `create`, `update`, `soft_delete`. No cross-aggregate logic, no HTTP concerns, no business rules.
- **Service**: owns invariants that today live in `useStore.js` and `rent.js` — e.g. `GuestService.add_guest()` checks room capacity via `RoomRepository`, validates phone format, and only then calls `GuestRepository.create()`. `PaymentService.record_payment()` enforces the idempotency key, recomputes the guest's balance, and is the only place allowed to write a `Payment` row.
- This split exists specifically so occupancy/dues logic can be unit-tested without a database, and so the eventual "who can delete a room with active guests" type of rule has exactly one home instead of being re-implemented per endpoint.

### 2.9 Database Design Notes

- **UUID primary keys** everywhere (`gen_random_uuid()` server-side default via `pgcrypto`/`pgcrypto`-free `uuid-ossp`, or generated in the ORM layer — pick one and be consistent).
- **Soft deletes** (`deleted_at timestamptz null`) on `Room`, `Guest`, `Property` — financial history (payments referencing a guest) must survive guest deletion, mirroring the existing client's deliberate `guestName`/`roomNumber` snapshot behavior on `Payment`.
- **Composite indexes**: `(property_id, room_number)` unique on Room; `(property_id, active)` on Guest for dashboard queries; `(property_id, for_month)` on Payment for monthly reconciliation; `(guest_id, for_month)` on Payment for balance lookups.
- **Constraints**: `capacity BETWEEN 1 AND 20`, `amount > 0`, `monthly_rent >= 0` enforced at the DB level (`CHECK`), not just in Pydantic — client-side validation has already proven itself insufficient once you have more than one write path (API + eventual admin tooling + background jobs).
- **Timestamps**: all `timestamptz`, stored UTC, converted client-side. Property carries its own `timezone` field for display.
- **Money**: `NUMERIC(10,2)`, never float.

### 2.10 File Storage

Profile pictures and future guest documents move from local `file://` URIs to object storage (S3 or S3-compatible, e.g. MinIO for local/dev parity with Docker). Flow: client requests a presigned upload URL from `/properties/{id}/guests/{id}/photo`, uploads directly to storage, backend stores only the resulting object URL/key in `FileAsset`. This keeps large binary traffic off the API servers.

### 2.11 Offline / Sync Strategy — Open Decision, Not Optional Detail

This is the single biggest architectural fork in the whole project and it needs an explicit answer before backend work starts, not after:

- **Option A — Online-only.** Drop `AsyncStorage` persistence entirely; the app becomes a thin client over the API. Simplest to build, weakest for spotty-connectivity use (PG owners are frequently on the ground floor of a building with bad signal, this is a real usage pattern for this vertical).
- **Option B — Offline-first with sync.** Keep local persistence as a cache, add a delta-sync endpoint (`GET /properties/{id}/sync?since=`) and a mutation queue that reconciles on reconnect. Real conflict-resolution design required (last-write-wins is the cheap default but will silently lose data on concurrent edits by two staff members — likely acceptable for a first version, but that's a product decision, not a technical default to sneak in).

Recommendation: **ship Option A first.** The current app's offline-first design made sense when it was single-device, single-user, no backend. The moment multiple staff share one property's data, "offline-first with eventual conflict resolution" becomes a genuinely hard distributed-systems problem, and building it before there's a single paying customer is premature. Revisit Option B only if real usage data shows connectivity is actually a blocker.

### 2.12 Non-Functional Concerns

- **Background jobs**: Celery + Redis (or APScheduler if the job volume stays low) for rent-due reminders, invite-email expiry, scheduled report generation.
- **Caching**: Redis for dashboard stats (`/stats/dashboard`) if property size grows — but don't add this until a real property has enough guests/payments for the aggregate query to be slow; premature caching here just adds invalidation bugs.
- **Observability**: structured logging (structlog), Sentry for error tracking, request-id propagation for tracing a mobile bug report back to a specific API call.
- **Testing**: pytest + pytest-asyncio against a real Postgres test database (via testcontainers or a docker-compose test service) — the occupancy/dues invariants are exactly the kind of logic that looks right and is subtly wrong, so these need real integration tests, not mocked-repository unit tests alone.
- **Rate limiting**: slowapi/Redis-backed, applied globally with a stricter bucket on `/auth/*`.

### 2.13 Docker Topology

```yaml
services:
  api:        # FastAPI + Uvicorn/Gunicorn
  db:         # Postgres 16
  redis:      # cache + Celery broker + rate-limit store
  worker:     # Celery worker (reminders, report generation)
  beat:       # Celery beat (scheduled jobs)
  minio:      # local S3-compatible storage, dev/test only
```

`docker-compose.yml` for local dev; separate hardened images/env config for staging/prod (no MinIO in prod — real S3/equivalent).

---

## 3. Critical Risks & Open Decisions

Ranked by how much damage getting them wrong would do:

1. **Tenant isolation is the whole security model.** If the `require_property_member` dependency has one bypassable path, every PG owner's guest list, phone numbers, and Aadhaar numbers become visible to every other tenant. This needs its own dedicated test suite, not just happy-path coverage.
2. **Aadhaar numbers are a compliance liability, not just a field.** Currently stored in plaintext on-device with no protection. Server-side, this needs encryption at rest, restricted read access (probably manager+ only, not staff), and an answer to India's DPDP Act obligations before this ships to real customers. This is not optional polish — it's the difference between a legal SaaS product and a data breach waiting to happen.
3. **Sync strategy (2.11) must be decided before endpoint design is finalized**, because it changes what "record payment" even means (single atomic write vs. queued mutation with later reconciliation).
4. **Payment idempotency.** The client has zero duplicate-submission protection today. A flaky network + a "did that payment submit?" retry from a PG owner is exactly the failure mode that double-records money. Idempotency keys on `POST /payments` are not a nice-to-have.
5. **Two frontends, one name.** Before backend scope is locked, confirm whether the Flutter app's feature set (expenses, income, backup/export, notifications) is in scope. If it is, `Expense`/`Income` entities belong in this document now — retrofitting them later means revisiting the property-scoping and audit patterns everywhere.

---

## 4. Suggested Rollout Phasing

**Phase 1 (MVP — mirrors current mobile feature set, single property per user, online-only)**
Auth, Property CRUD (single property per user enforced at the service layer even though the schema supports many), Room CRUD, Guest CRUD, Payment record/list, dashboard stats.

**Phase 2 (multi-property + multi-user)**
PropertyMember roles, staff invites, property switcher support, audit log.

**Phase 3 (parity with Flutter prototype, if in scope)**
Expenses, income, reports/export, push notification reminders.

**Phase 4 (hardening)**
Aadhaar encryption + access controls, rate limiting tuning, background job infra, observability stack.

---

## 5. What This Document Deliberately Does Not Cover

Per your instructions: no implementation code, no Alembic migration files, no Pydantic schema definitions, no actual endpoint handler bodies. Those are the next deliverable once the decisions in Section 3 (especially sync strategy and Flutter-feature scope) are actually made — building endpoints against an undecided sync model would mean rebuilding the payment-write path twice.
