# Donations Service

A small Next.js app that ingests donations through an HTTP API and lets an operator walk them through a short lifecycle from an internal dashboard. Storage is in-memory, so the state resets on every restart; 105 tests cover the API, the state machine, the helpers, the webhook simulation, and the UI.

## Stack

Next.js 16 on the App Router, React 19, TypeScript. Tailwind v4 for styling, shadcn/ui (built on Base UI) for the dashboard primitives, Lucide for icons, Sonner for toasts. Tests run on Vitest with Testing Library for the UI pieces.

The store is a plain `Map<uuid, Donation>` pinned to `globalThis` so it survives Next's dev-mode hot reload. Swapping it for a real database is a single-file change: route handlers never see the implementation.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm test
```

The dev server seeds eight donations on first load. The test suite finishes in about a second.

## API

Every request and response is JSON. Errors come back as `{ "error": "<message>" }` with a specific reason: the validator names the exact field that failed, and invalid transitions are reported like `invalid transition: success -> failure`.

`GET /api/donations` returns every donation under `{ "donations": [...] }`.

`GET /api/donations/:uuid` returns one donation, or 404 if it isn't there.

`POST /api/donations` creates a donation. The body is a complete donation minus `updatedAt`, which the server sets equal to `createdAt` on insert. A duplicate `uuid` returns 409. A malformed body returns 400.

`PATCH /api/donations/:uuid/status` moves a donation through its lifecycle. The body is `{ "status": "<next>" }`. On success you get the updated donation back with a refreshed `updatedAt`. A missing donation is 404. A status outside the enum is 400. A valid enum value that isn't a legal transition is 422. A request whose target status matches the current status is 409 — covered in its own section below. A transition into `success` or `failure` also emits a webhook event; see the webhook section below.

`GET /api/events` returns the simulated-webhook event log under `{ "events": [...] }`. Each event has an `id`, a `type` (`donation.success` or `donation.failure`), an ISO `occurredAt` timestamp, and a snapshot of the donation at the moment the event fired.

## State machine

```
  new ──▶ pending ──▶ success
                  ╲
                   ▶ failure
```

That's the whole machine. `new` can only become `pending`. `pending` can only become `success` or `failure`. Both terminal states are sinks. No reversals, no skips, no cycles. Anything else is rejected with 422.

The UI enforces the same rules a layer higher so illegal transitions never reach the wire. Terminal rows show `—` in the Actions column with no control at all. `new` rows render a single "Mark pending" button. `pending` rows render a dropdown with exactly two options. The server validation still holds the line, though, and the dashboard reconciles against it on every failure.

## Design decisions

Notes on the non-obvious choices in the code, so the next reader doesn't have to reverse-engineer them. The duplicate-`PATCH` question gets its own section below since it's the core judgment the spec invited.

**Filtering runs client-side.** The backend contract stays simple and the single fetched list powers the table, the summary, and any future view. Query-param filters (`?status=&method=`) on the API would matter for larger datasets; for a dashboard that works on dozens of donations at a time, the round-trip cost isn't worth the added surface.

**Filter state lives in the URL.** `useSearchParams` + `router.replace({ scroll: false })`. Views become link-shareable, the browser back button works as expected, and a refresh preserves the user's selection. Unknown values like `?status=frozen` fall back to "All" rather than rendering an empty table.

**The summary is independent of filters.** The stat cards and by-payment-method breakdown always show store-wide totals — they don't shift around as the user filters the table. The filter row's "Showing N of M" already communicates the filtered scope for the table, and a filter-respecting summary tends to produce trivial numbers under common drill-downs (filter `status=success` → success rate 100%). The summary's job is to be a stable at-a-glance health panel; per-slice exploration is a separate view we haven't needed yet.

**Success rate is measured over resolved donations only.** Denominator is `success + failure`; `new` and `pending` are excluded. Measuring against total count would drag the rate down whenever a batch of donations lands and hasn't processed yet, conflating "how good is our processing" with "how busy are we right now."

**The UI gates transitions; the server still enforces them.** The actions column renders only the valid next-step controls per row, so an invalid transition can't be expressed by a click. The server's 422 check remains the source of truth, and the dashboard reconciles via refetch on any failure, but not offering impossible options keeps the operator's job unambiguous.

**Optimistic row updates, refetch on error.** On a successful PATCH the table swaps in the server's authoritative response immediately. On failure the toast surfaces the server message and the list reloads rather than trusting stale local state.

**Shared transition contract.** `lib/types.ts` exports `isValidTransition` and `allowedNextStatuses`, and both the API validator and the UI's action component consume them. The answer to "what's allowed from here" lives in exactly one place, so there's no drift between client and server.

**Webhook events fire on transitions, not on ingest.** A `POST /api/donations` that creates a donation already in `success` or `failure` state does not emit an event; only a `PATCH` that moves a donation into a terminal state does. The semantic is "this donation reached a terminal state," which happens at the moment of transition, not the moment of data entry. Events are emitted synchronously from the route handler after the store update lands, logged to the server console, and appended to an in-memory log exposed at `GET /api/events`. Event emission is deliberately outside the store — stores stay a pure data layer, side effects happen at the application boundary. A real-URL fan-out via a `WEBHOOK_URL` env var would slot in here with minimal disruption to the existing tests.

## On duplicate `PATCH`es

The spec requires that a `PATCH` whose target status equals the current status return 409. It deliberately leaves the rest open.

We stop at the minimum: 409 if and only if the requested status matches the donation's current status, derived statelessly from the live resource on each request. No request log, no idempotency key, no time-based dedup. The state machine does most of the work for us. Because it's monotonic and terminal, once a donation sits in `X`, every future "set status to `X`" returns 409 — which happens to be the honest answer.

That leaves one awkward case: a client that successfully PATCHed, lost the response, and retries. They get back 409 with something like `status already success`. The useful way to read that message is *"you're already there"* — a retrying client can treat a 409 whose target matches the server's current status as an effective no-op success, and confirm with a GET if they want certainty. It isn't as ergonomic as proper idempotency keys, but it doesn't cost us anything in complexity, and it doesn't require an API-contract change the spec never describes.

A few alternatives we considered and passed on:

**Idempotency-Key headers**, Stripe-style, are the right pattern for public APIs that get hammered by retry-heavy clients. They're also a contract change — a new required header and a response cache on the server. Worth the work when this service opens up to external callers; overkill for an internal dashboard.

**`If-Match` optimistic locking** solves concurrent modification, not duplicate retries. "Two admins pressed the button at the same time" is a different failure mode than "one admin's button press fired twice." A single-operator internal tool doesn't need it.

**Time-window dedup** on `(uuid, status)` catches double-clicks but introduces fuzzy edges and another piece of server state. The UI already disables the button during an in-flight request via `useTransition`, and the state machine absorbs the rest.

The same 409 convention applies to `POST`: a duplicate `uuid` returns 409 rather than overwriting, for the same "don't silently clobber" reason.

## Code layout

```
app/api/donations/
  route.ts                      GET list, POST create
  [uuid]/route.ts               GET one
  [uuid]/status/route.ts        PATCH status; emits events on success/failure
app/api/events/route.ts         GET the simulated-webhook event log
app/page.tsx                    Dashboard shell (server component)
components/
  donations-table.tsx           Owns the fetch + row state; applies URL filters
  donation-filters.tsx          Status + payment-method filter controls
  donation-summary.tsx          Stat cards + by-method breakdown (global)
  status-action.tsx             Renders only the valid next-state controls
  status-badge.tsx              Status pill with icon + color
  ui/                           shadcn primitives
lib/
  types.ts                      Shared contract + transition helpers
  store.ts                      In-memory store, seed data, HMR-safe singleton
  validation.ts                 Runtime validators for POST/PATCH bodies
  events.ts                     Webhook event log + emit/list/reset helpers
  filters.ts                    filterDonations + URL-param parsers
  stats.ts                      computeSummary for the summary view
  api-client.ts                 Typed fetch wrappers used by the UI
  format.ts                     Dollar + date formatting
tests/                          Vitest suites, one per concern
```

## Tests

The suite covers the transition matrix exhaustively — every `(from, to)` pair in a 4×4 grid — the store's CRUD and its copy semantics, every validator error branch, each route handler invoked directly with `new Request(...)` (no HTTP server needed), the filter and summary helpers against hand-picked inputs, and the UI action component's per-status rendering with the api-client and toast stack mocked out.

```bash
npm test
```
