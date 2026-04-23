// @vitest-environment node
import { describe, test, expect, beforeEach } from "vitest";

import { GET as listGET, POST as listPOST } from "@/app/api/donations/route";
import { GET as detailGET } from "@/app/api/donations/[uuid]/route";
import { PATCH as statusPATCH } from "@/app/api/donations/[uuid]/status/route";
import { listDonations, resetStore } from "@/lib/store";
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
  beforeEach(() => resetStore());

  test("returns 200 with 8 seeded donations", async () => {
    const res = await listGET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { donations: Donation[] };
    expect(Array.isArray(body.donations)).toBe(true);
    expect(body.donations).toHaveLength(8);
  });
});

describe("GET /api/donations/[uuid]", () => {
  beforeEach(() => resetStore());

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
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("donation not found: nope");
  });
});

describe("POST /api/donations", () => {
  beforeEach(() => resetStore());

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
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe("invalid JSON body");
  });
});

describe("PATCH /api/donations/[uuid]/status", () => {
  beforeEach(() => resetStore());

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
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe("donation not found: missing-uuid");
  });

  test("400 on invalid status value", async () => {
    const res = await statusPATCH(
      mockReq("PATCH", { status: "frozen" }),
      ctx(SEED_NEW_UUID),
    );
    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe("invalid status: frozen");
  });

  test("400 on non-JSON body", async () => {
    const res = await statusPATCH(
      rawReq("PATCH", "not-json{"),
      ctx(SEED_NEW_UUID),
    );
    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe("invalid JSON body");
  });
});

describe("end-to-end flow: POST -> PATCH -> PATCH -> GET", () => {
  beforeEach(() => resetStore());

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
