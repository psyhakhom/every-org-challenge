// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GET as listGET, POST as listPOST } from "@/app/api/donations/route";
import { GET as detailGET } from "@/app/api/donations/[uuid]/route";
import { PATCH as statusPATCH } from "@/app/api/donations/[uuid]/status/route";
import { listDonations, resetStore } from "@/lib/store";
import { listEvents, resetEvents } from "@/lib/events";
import type { Donation } from "@/lib/types";

const SEED_NEW_UUID = "354362d8-2080-4ca1-9ede-892e4c6d3a25";
const SEED_PENDING_UUID = "86f1c108-102b-447a-9efe-67c2f3b594d8";
const SEED_SUCCESS_UUID = "73aff4cc-135d-4840-96b2-9210639528c8";

function mockReq(method: string, body?: unknown): Request {
  return new Request("http://localhost/test", {
    method,
    body: body === undefined ? null : JSON.stringify(body),
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
  });
}

function rawReq(method: string, rawBody: string): Request {
  return new Request("http://localhost/test", {
    method,
    body: rawBody,
    headers: { "Content-Type": "application/json" },
  });
}

function ctx(uuid: string): { params: Promise<{ uuid: string }> } {
  return { params: Promise.resolve({ uuid }) };
}

function makeCreateBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    uuid: "dddd4444-eeee-5555-ffff-666666666666",
    amount: 1234,
    currency: "USD",
    paymentMethod: "cc",
    nonprofitId: "orgX",
    donorId: "donorX",
    status: "new",
    createdAt: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

describe("GET /api/donations", () => {
  beforeEach(() => {
    resetStore();
    resetEvents();
  });

  test("returns 200 with 8 seeded donations", async () => {
    const res = await listGET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { donations: Donation[] };
    expect(Array.isArray(body.donations)).toBe(true);
    expect(body.donations).toHaveLength(8);
  });
});

describe("GET /api/donations/[uuid]", () => {
  beforeEach(() => {
    resetStore();
    resetEvents();
  });

  test("200 with known seed uuid", async () => {
    const res = await detailGET(mockReq("GET"), ctx(SEED_NEW_UUID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Donation;
    expect(body.uuid).toBe(SEED_NEW_UUID);
    expect(body.status).toBe("new");
  });

  test("404 with unknown uuid", async () => {
    const res = await detailGET(mockReq("GET"), ctx("nope"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.error).toBe("donation not found: nope");
    expect(body.code).toBe("NOT_FOUND");
  });
});

describe("POST /api/donations", () => {
  beforeEach(() => {
    resetStore();
    resetEvents();
  });

  test("201 on happy path, updatedAt === createdAt, appears in list", async () => {
    const body = makeCreateBody();
    const res = await listPOST(mockReq("POST", body));
    expect(res.status).toBe(201);
    const created = (await res.json()) as Donation;
    expect(created.uuid).toBe(body.uuid);
    expect(created.createdAt).toBe(body.createdAt);
    expect(created.updatedAt).toBe(body.createdAt);
    expect(listDonations().some((d) => d.uuid === body.uuid)).toBe(true);
  });

  test("409 on duplicate uuid", async () => {
    const dup = makeCreateBody({ uuid: SEED_NEW_UUID });
    const res = await listPOST(mockReq("POST", dup));
    expect(res.status).toBe(409);
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe(`duplicate donation uuid: ${SEED_NEW_UUID}`);
  });

  test("400 on missing field", async () => {
    const { amount: _omit, ...rest } = makeCreateBody();
    const res = await listPOST(mockReq("POST", rest));
    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe("missing field: amount");
  });

  test("400 on non-JSON body", async () => {
    const res = await listPOST(rawReq("POST", "not-json{"));
    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: string; code: string };
    expect(err.error).toBe("invalid JSON body");
    expect(err.code).toBe("INVALID_JSON");
  });

  test("413 when body exceeds the size cap", async () => {
    const huge = "x".repeat(20_000);
    const res = await listPOST(
      rawReq("POST", JSON.stringify(makeCreateBody({ donorId: huge }))),
    );
    expect(res.status).toBe(413);
    const err = (await res.json()) as { error: string; code: string };
    expect(err.code).toBe("BODY_TOO_LARGE");
    expect(err.error).toBe("request body exceeds maximum size");
  });

  test("409 duplicate response carries code DUPLICATE_UUID", async () => {
    const dup = makeCreateBody({ uuid: SEED_NEW_UUID });
    const res = await listPOST(mockReq("POST", dup));
    const err = (await res.json()) as { error: string; code: string };
    expect(err.code).toBe("DUPLICATE_UUID");
  });

  test("400 validation response carries code VALIDATION", async () => {
    const { amount: _omit, ...rest } = makeCreateBody();
    const res = await listPOST(mockReq("POST", rest));
    const err = (await res.json()) as { error: string; code: string };
    expect(err.code).toBe("VALIDATION");
  });
});

describe("PATCH /api/donations/[uuid]/status", () => {
  beforeEach(() => {
    resetStore();
    resetEvents();
  });

  test("200 on valid transition", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "success" }),
      ctx(SEED_PENDING_UUID),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Donation;
    expect(body.uuid).toBe(SEED_PENDING_UUID);
    expect(body.status).toBe("success");
  });

  test("409 on same status", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "new" }),
      ctx(SEED_NEW_UUID),
    );
    expect(res.status).toBe(409);
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe("status already new");
  });

  test("422 on invalid transition (success -> failure)", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "failure" }),
      ctx(SEED_SUCCESS_UUID),
    );
    expect(res.status).toBe(422);
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe("invalid transition: success -> failure");
  });

  test("404 on unknown uuid", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "pending" }),
      ctx("missing-uuid"),
    );
    expect(res.status).toBe(404);
    const err = (await res.json()) as { error: string; code: string };
    expect(err.error).toBe("donation not found: missing-uuid");
    expect(err.code).toBe("NOT_FOUND");
  });

  test("400 on invalid status value", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "frozen" }),
      ctx(SEED_NEW_UUID),
    );
    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: string; code: string };
    expect(err.error).toBe("invalid status: frozen");
    expect(err.code).toBe("VALIDATION");
  });

  test("400 on non-JSON body", async () => {
    const res = await statusPATCH(
      rawReq("PATCH", "not-json{"),
      ctx(SEED_NEW_UUID),
    );
    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: string; code: string };
    expect(err.error).toBe("invalid JSON body");
    expect(err.code).toBe("INVALID_JSON");
  });

  test("422 invalid-transition response carries code INVALID_TRANSITION", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "failure" }),
      ctx(SEED_SUCCESS_UUID),
    );
    expect(res.status).toBe(422);
    const err = (await res.json()) as { error: string; code: string };
    expect(err.code).toBe("INVALID_TRANSITION");
  });

  test("409 same-status response carries code SAME_STATUS", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "new" }),
      ctx(SEED_NEW_UUID),
    );
    expect(res.status).toBe(409);
    const err = (await res.json()) as { error: string; code: string };
    expect(err.code).toBe("SAME_STATUS");
  });

  test("413 when PATCH body exceeds the size cap", async () => {
    const huge = "x".repeat(20_000);
    const res = await statusPATCH(
      rawReq("PATCH", JSON.stringify({ status: "pending", junk: huge })),
      ctx(SEED_NEW_UUID),
    );
    expect(res.status).toBe(413);
    const err = (await res.json()) as { error: string; code: string };
    expect(err.code).toBe("BODY_TOO_LARGE");
  });
});

describe("end-to-end flow: POST -> PATCH -> PATCH -> GET", () => {
  beforeEach(() => {
    resetStore();
    resetEvents();
  });

  test("new -> pending -> success round-trip", async () => {
    const body = makeCreateBody({
      uuid: "e2e00000-aaaa-bbbb-cccc-dddddddddddd",
    });

    const created = await listPOST(mockReq("POST", body));
    expect(created.status).toBe(201);

    const toPending = await statusPATCH(
      mockReq("PATCH", { status: "pending" }),
      ctx(body.uuid as string),
    );
    expect(toPending.status).toBe(200);
    const pendingBody = (await toPending.json()) as Donation;
    expect(pendingBody.status).toBe("pending");

    const toSuccess = await statusPATCH(
      mockReq("PATCH", { status: "success" }),
      ctx(body.uuid as string),
    );
    expect(toSuccess.status).toBe(200);

    const final = await detailGET(mockReq("GET"), ctx(body.uuid as string));
    expect(final.status).toBe(200);
    const finalBody = (await final.json()) as Donation;
    expect(finalBody.status).toBe("success");
  });
});

describe("webhook events on PATCH", () => {
  beforeEach(() => {
    resetStore();
    resetEvents();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("new -> pending does not emit an event", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "pending" }),
      ctx(SEED_NEW_UUID),
    );
    expect(res.status).toBe(200);
    expect(listEvents()).toEqual([]);
  });

  test("pending -> success emits a donation.success event with the updated donation", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "success" }),
      ctx(SEED_PENDING_UUID),
    );
    expect(res.status).toBe(200);

    const events = listEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("donation.success");
    expect(events[0].donation.uuid).toBe(SEED_PENDING_UUID);
    expect(events[0].donation.status).toBe("success");
    expect(events[0].id).toMatch(/^evt_/);
  });

  test("pending -> failure emits a donation.failure event", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "failure" }),
      ctx(SEED_PENDING_UUID),
    );
    expect(res.status).toBe(200);

    const events = listEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("donation.failure");
    expect(events[0].donation.status).toBe("failure");
  });

  test("failed PATCH (invalid transition) does not emit", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "failure" }),
      ctx(SEED_SUCCESS_UUID),
    );
    expect(res.status).toBe(422);
    expect(listEvents()).toEqual([]);
  });

  test("failed PATCH (same status) does not emit", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "success" }),
      ctx(SEED_SUCCESS_UUID),
    );
    expect(res.status).toBe(409);
    expect(listEvents()).toEqual([]);
  });

  test("failed PATCH (unknown donation) does not emit", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "success" }),
      ctx("does-not-exist"),
    );
    expect(res.status).toBe(404);
    expect(listEvents()).toEqual([]);
  });

  test("GET /api/events returns the logged events", async () => {
    const { GET: eventsGET } = await import("@/app/api/events/route");
    await statusPATCH(
      mockReq("PATCH", { status: "success" }),
      ctx(SEED_PENDING_UUID),
    );
    const res = await eventsGET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      events: { type: string; donation: Donation }[];
    };
    expect(body.events.length).toBe(1);
    expect(body.events[0].type).toBe("donation.success");
    expect(body.events[0].donation.uuid).toBe(SEED_PENDING_UUID);
  });
});
