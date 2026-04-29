# Donations Service

A small Next.js app for managing donations. An upstream system POSTs new donations into the API, and an operator uses the dashboard to walk each one through its lifecycle.

Storage is in memory, so every restart resets the state. 124 tests cover the API, the UI, and the helpers in between.

## Stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript**
- **Tailwind v4** for styling
- **shadcn/ui** (built on Base UI) for the dashboard primitives — buttons, dropdowns, selects, tables
- **Lucide** for icons, **Sonner** for toasts
- **Vitest** + **Testing Library** for tests

The store is a plain `Map<uuid, Donation>` pinned to `globalThis` so it survives Next's hot reload in dev. Swapping it for a real database is a one-file change — nothing else in the app knows the difference.

## Running it

```bash
npm install
npm run dev    # http://localhost:3000
npm test
```

The dev server starts with eight donations seeded. The test suite finishes in about a second.

## What you see

A single-page dashboard with:

- A **table** of every donation: donor, nonprofit, amount, payment method, status, created date, and an action.
- **Filter dropdowns** above the table — by status and by payment method. Filter state lives in the URL, so links are shareable.
- **Summary cards** below the table — total successfully donated, success rate, amount in flight — plus a bar chart by payment method.
- **Status badges** with icons and colors, so you can scan the table without reading every cell.
- **Action buttons** that only show valid next steps. Terminal rows show `—`.

When you change a donation's status, you get a green confirmation toast. If the change also fires a webhook, you get a second toast.

## The lifecycle

```
  new ──▶ pending ──▶ success
                  ╲
                   ▶ failure
```

That's the whole thing.

- `new` can become `pending`.
- `pending` can become `success` or `failure`.
- `success` and `failure` are final — no reversals, no skips.

The UI hides any button that would cause an invalid transition. The server still validates every request, so a bad call from outside the UI gets a 422.

## API

Every request and response is JSON. Errors come back as `{ "error": "<message>", "code": "<CODE>" }`.

### `GET /api/donations`

Returns every donation under `{ "donations": [...] }`.

### `GET /api/donations/:uuid`

Returns one donation, or 404 if it doesn't exist.

### `POST /api/donations`

Creates a donation. The body is the full donation minus `updatedAt` (the server sets that to match `createdAt`).

- `201` on success
- `400` on a malformed body
- `409` on a duplicate `uuid`

### `PATCH /api/donations/:uuid/status`

Moves a donation along its lifecycle. Body: `{ "status": "<next>" }`.

- `200` with the updated donation
- `400` if the status isn't a valid value
- `404` if the donation doesn't exist
- `409` if the new status equals the current status (see below)
- `422` if the transition isn't legal (e.g. `success → failure`)

If the transition lands in `success` or `failure`, the server also emits a webhook event.

### `GET /api/events`

Returns the webhook event log under `{ "events": [...] }`. Each event has an `id`, a `type` (`donation.success` or `donation.failure`), an ISO `occurredAt`, and a snapshot of the donation at the moment the event fired.

## Design decisions

### What the dashboard does

The brief asks for two things: list every donation, and update a donation's status along valid transitions. Both happen in the table. On top of that:

- **Filters for status and payment method.** Eight rows are easy to eyeball, but the dashboard is shaped for tens-to-hundreds of donations. Filter state lives in the URL, so links work.
- **Summary cards.** An operator scanning the dashboard wants the at-a-glance numbers first, before drilling into rows.
- **Icons everywhere.** Status icons and payment-method icons make the table scannable without reading text.
- **Smart action buttons.** Terminal rows show `—`. `new` rows show one button. `pending` rows show a dropdown with two options. You can't click your way into an invalid transition.
- **Errors as toasts.** Any PATCH failure goes into a Sonner toast and triggers a refetch, so the table can't drift from server truth.
- **Dollars, not cents.** `5000` becomes `$50.00` via `lib/format.ts`.
- **Webhook visibility.** When a transition emits a webhook, you get a second toast saying so. One toast = state changed. Two toasts = state changed *and* a webhook fired. The pairing makes an otherwise invisible side-effect visible to the operator.

### What the dashboard doesn't do

Worth listing because *not* building these is also a decision:

- **No detail page.** The row carries every field an operator needs.
- **No "create donation" form.** `POST /api/donations` is for upstream ingestion, not operator data entry.
- **No delete.** Donations terminate, they don't disappear. A `failure` is distinct from "never happened."
- **No bulk actions.** Multi-select "mark all pending as success" is dangerous when real money is involved.
- **No free-text search.** Filters cover the common case at this data scale.
- **No auth.** The brief calls this an internal dashboard behind a network gate.

### Implementation notes

- **Filtering runs client-side.** One fetch powers the table, the filters, and the summary. The server contract stays simple.
- **Filter state lives in the URL.** `useSearchParams` + `router.replace`. Refresh preserves the selection, the back button works, and unknown values like `?status=frozen` fall back to "All" rather than rendering an empty table.
- **The summary ignores filters.** It's a stable health panel, not a drill-down view. Filtering to `status=success` would always show 100% success rate — not useful.
- **Success rate counts only resolved donations.** Denominator is `success + failure`. New and pending donations don't drag the rate down before they've had a chance to resolve.
- **The UI gates transitions; the server still enforces them.** Belt and suspenders.
- **Optimistic row updates, refetch on error.** A successful PATCH swaps the row immediately. A failed PATCH shows the toast and reloads from the server.
- **Shared transition contract.** Both the API and the UI import `isValidTransition` from `lib/types.ts`. No drift between client and server.
- **Webhooks fire on transition, not on ingest.** A `POST` that lands a donation directly in `success` doesn't emit. Only a `PATCH` into a terminal state does. The event log lives in memory and is exposed at `GET /api/events`.

## On duplicate PATCHes

If you PATCH `status: success` to a donation that's already `success`, you get a `409` with `status already success`.

There's no idempotency key, no request log. The state machine handles it — once a donation is in `X`, every future "set to `X`" returns 409. A retrying client that lost the original response can read the 409 as "you're already there" and confirm with a GET.

We considered:

- **`Idempotency-Key` headers (Stripe-style)** — the right pattern for public APIs, but a contract change. Worth it when this opens up to external callers.
- **`If-Match` headers** — solve concurrent edits, not duplicate retries.
- **Time-window dedup** — catches double-clicks but adds fuzzy edges. The UI already disables the button during an in-flight request via `useTransition`.

The same 409 convention applies to `POST` with a duplicate `uuid`: don't silently overwrite.

## Code layout

```
app/
  api/donations/
    route.ts                GET list, POST create
    [uuid]/route.ts         GET one
    [uuid]/status/route.ts  PATCH status; emits events on success/failure
  api/events/route.ts       GET the webhook event log
  page.tsx                  Dashboard shell
  layout.tsx                Root layout (fonts, Toaster)

components/
  donations-table.tsx       Fetches + holds row state, applies URL filters
  donation-filters.tsx      Status + method filter controls
  donation-summary.tsx      Stat cards + by-method breakdown
  status-action.tsx         Renders only the valid next-state controls
  status-badge.tsx          Status pill with icon + color
  ui/                       shadcn primitives

lib/
  types.ts        Shared contract + transition helpers
  store.ts        In-memory store, seed data, HMR-safe singleton
  validation.ts   Runtime validators for POST/PATCH bodies
  events.ts       Webhook event log
  filters.ts      Filter predicate + URL-param parsers
  stats.ts        Summary math
  api-client.ts   Typed fetch wrappers used by the UI
  format.ts       Dollar + date formatting
  http.ts         JSON body reader with size cap
```

## Tests

```bash
npm test
```

124 tests in nine suites, all running on Vitest:

```
tests/types.test.ts          20  the full 4×4 transition matrix
tests/store.test.ts          12  CRUD + seed + copy-on-read
tests/validation.test.ts     26  every validator branch
tests/filters.test.ts        10  filter predicate + URL parsing
tests/stats.test.ts           7  summary math
tests/events.test.ts          8  event emit/list/reset
tests/http.test.ts            5  body cap, malformed JSON
tests/api-donations.test.ts  27  every route handler × every error branch
tests/status-action.test.tsx  9  UI per-status rendering + toast pairing
```

The route handlers are tested by calling them directly with `new Request(...)` — no HTTP server needed.

## Hardening

A few changes beyond the brief, each motivated by a concrete failure mode rather than a generic checklist.

### Body-size cap

`lib/http.ts` enforces a 16 KiB cap on POST/PATCH bodies. A donation serializes to a few hundred bytes; 16 KiB is generous for a real client and small enough to bound an attacker's memory use. The cap is checked twice — against `Content-Length` (cheap reject) and again while streaming (so a chunked sender can't lie about the size). Over-size requests get a `413`.

### Stricter input validation

`lib/validation.ts` is stricter in four places:

- **UUID shape.** `uuid` must match the canonical `8-4-4-4-12` hex form. `"banana"` no longer passes.
- **Strict ISO-8601 dates.** A regex requires `YYYY-MM-DDTHH:MM:SS` plus a timezone (`Z` or `±HH:MM`). The old `Date.parse` check accepted `"2026"` and `"Jan 15 2026"`.
- **Length caps on free-form ids.** `nonprofitId` and `donorId` cap at 128 characters.
- **Amount ceiling.** `amount` must be ≤ $10B in cents. Well below `Number.MAX_SAFE_INTEGER` so totals stay exact.

### Stable error codes

Every non-2xx response carries a `code`: `INVALID_JSON`, `BODY_TOO_LARGE`, `VALIDATION`, `NOT_FOUND`, `DUPLICATE_UUID`, `INVALID_TRANSITION`, `SAME_STATUS`. Clients can branch on the code instead of string-matching the error message.

### Security headers

`next.config.ts` sets four headers on every response:

- `X-Frame-Options: DENY` — no iframing
- `X-Content-Type-Options: nosniff` — JSON stays JSON
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()` — the dashboard uses none of these, so deny everything

### Unpredictable event IDs

Event IDs use `crypto.randomUUID()`, not `Math.random()`. The `evt_` prefix is preserved so log scanners that grep for it keep working.

### What's not in scope

- **Auth / authz.** Out of scope per the brief.
- **Rate limiting.** Would need shared state (Redis, etc.). The body cap bounds per-request cost.
- **HMAC-signed webhooks.** The webhook is a simulation — there's no outbound HTTP to sign.
- **CSRF.** The API is JSON-only with no cookie auth.
- **Content-Security-Policy.** Would need nonce plumbing for Next's inline scripts and Tailwind's inline styles. Skipped rather than half-done.
