# Donations Service

A small full-stack app that ingests and processes donations and exposes an internal dashboard for reviewing and updating them.

- **Backend** — Next.js App Router route handlers over an HMR-safe in-memory store, seeded with 8 sample donations.
- **Frontend** — React client dashboard (shadcn/ui + Lucide) with optimistic status updates and toast-surfaced errors.
- **Tests** — 73 Vitest tests covering the transition matrix, the store, validation, every route handler, and the UI action component.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| UI | shadcn/ui (Base UI primitives), Lucide icons, Sonner toasts |
| Tests | Vitest + Testing Library (jsdom) |
| Storage | In-memory `Map<uuid, Donation>`, singleton-pinned to `globalThis` so it survives HMR |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # run the Vitest suite
npx tsc --noEmit   # type-check
npm run lint       # ESLint
```

## API

All responses are JSON. Errors have the shape `{ "error": string }`.

### `POST /api/donations`
Ingest a donation.

**Body**: full `Donation` minus `updatedAt` (server sets it equal to `createdAt` on create).

| Status | When |
|---|---|
| `201` | Created. Body is the stored `Donation`. |
| `409` | A donation with the same `uuid` already exists. |
| `400` | Payload is malformed — missing field, wrong type, bad enum value, non-positive amount, non-parseable `createdAt`, etc. |

### `GET /api/donations`
List all donations.

**Response**: `{ "donations": Donation[] }`, always `200`.

### `GET /api/donations/:uuid`
Fetch one.

| Status | When |
|---|---|
| `200` | Body is the `Donation`. |
| `404` | No donation with that `uuid`. |

### `PATCH /api/donations/:uuid/status`
Move a donation through its lifecycle.

**Body**: `{ "status": DonationStatus }`.

| Status | When |
|---|---|
| `200` | Valid transition. Body is the updated `Donation` with a refreshed `updatedAt`. |
| `404` | No donation with that `uuid`. |
| `409` | Target status equals the donation's current status. See [Idempotency](#idempotency-and-409-on-patch). |
| `422` | Target status is a valid enum value but not a valid transition from the current status. |
| `400` | Body is malformed or `status` isn't one of `new \| pending \| success \| failure`. |

## State machine

```
  ┌─────┐     ┌─────────┐     ┌──────────┐
  │ new │ ──▶ │ pending │ ──▶ │ success  │
  └─────┘     │         │     └──────────┘
              │         │     ┌──────────┐
              │         │ ──▶ │ failure  │
              └─────────┘     └──────────┘
```

- `new → pending` — allowed
- `pending → success` — allowed
- `pending → failure` — allowed
- Everything else (including the reverse transitions, `new → success` short-circuits, and any move out of a terminal state) is rejected with `422`.

The machine is monotonic and terminal: a donation never re-enters an earlier state, and `success`/`failure` are sinks.

## Idempotency and 409 on `PATCH`

The spec mandates a floor: if `target === current`, return `409`. Beyond that it's intentionally open.

**Our rule**: `409` is returned **only** when the target status equals the donation's current status — a stateless derivation from the live resource. No request history is kept, no idempotency key is required.

**Why this choice.** The state machine is monotonic and terminal, which collapses most "duplicate" ambiguity:

- Once a donation sits in `X`, any request to `set status to X` will `409` forever. That's correct: the state is already where the caller wanted it.
- A client that retries a successful `PATCH` (e.g. after a lost connection) gets `409` with `error: "status already <target>"`. That response is actionable — a retrying client can treat *"409 whose target matches the server's current status"* as **effective success**, confirmable with a follow-up `GET`.
- The code is one line in the store (`if (existing.status === newStatus) return { ok: false, reason: "same_status" }`). No TTL maps, no server-side request logs, no new headers.

**What we rejected, and why.**

| Approach | Why not |
|---|---|
| **Convert same-status to `200`** (treat as silently idempotent) | Violates the spec floor ("`409` at minimum"). |
| **Idempotency-Key header (Stripe-style)** | Cleanest retry semantics, but requires a contract change the spec doesn't mention. Worth adopting if this service ever serves untrusted or retry-heavy clients. |
| **`If-Match: <updatedAt>` optimistic locking** | Solves *concurrent modification* (two admins racing), not *duplicate retries*. Different problem. Not needed for a single-admin internal dashboard; revisit if we open this up to multiple writers. |
| **Time-window dedup on `(uuid, status)`** | Fuzzy at the edges, requires state, and the terminal state machine already absorbs the common cases it would catch. |

**409 also appears on `POST`** for duplicate `uuid`. Same stateless rule: if a donation with that `uuid` already exists, we return `409` rather than overwriting. Retries with a new `uuid` succeed; retries with the same `uuid` keep the original intact.

## UI behavior

The dashboard enforces the state machine at the interaction layer so invalid transitions can't even be expressed:

- `success` and `failure` rows render a muted `—` in the Actions column — no control at all.
- `new` rows render a single `Mark pending` button.
- `pending` rows render a dropdown with `Mark success` and `Mark failure` — its only two valid exits.

On a successful `PATCH`, the row is updated in place with the server-returned `Donation`. On failure, the error from the API is surfaced via a Sonner toast and the table refetches to resync with server truth. Amounts render in dollars (`$50.00`), never cents.

## Project layout

```
app/
  api/donations/
    route.ts                       GET list, POST create
    [uuid]/route.ts                GET one
    [uuid]/status/route.ts         PATCH status
  layout.tsx                       Root layout + Toaster
  page.tsx                         Dashboard shell
components/
  donations-table.tsx              Table, loading / error / empty states
  status-action.tsx                Valid-transitions-only action control
  status-badge.tsx                 Status badge with icon + color
  ui/                              shadcn primitives (Button, Table, Badge, DropdownMenu, Sonner, …)
lib/
  types.ts                         Shared contract: Donation, DonationStatus, transition helpers
  store.ts                         HMR-safe singleton Map, seed data, mutations
  validation.ts                    Runtime validators for POST/PATCH bodies
  api-client.ts                    Typed fetch helpers used by the UI
  format.ts                        Dollar + date formatting
tests/
  types.test.ts                    Exhaustive 4×4 transition matrix
  store.test.ts                    CRUD + copy semantics
  validation.test.ts               Every error-message branch
  api-donations.test.ts            Route handlers invoked with new Request()
  status-action.test.tsx           UI branching + mocked api-client + sonner
```

## Tests

```bash
npm test
```

All 73 tests run in ~1s. Route-handler tests call the Next.js App Router handlers directly with a `new Request(...)` — no HTTP server, no port binding. UI tests use Testing Library with `vi.mock`-ed `@/lib/api-client` and `sonner`.
