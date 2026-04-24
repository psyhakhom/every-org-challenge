// @vitest-environment node
import { describe, test, expect } from "vitest";

import {
  validateCreateDonation,
  validateStatusUpdate,
} from "@/lib/validation";

function baseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uuid: "aaaa1111-bbbb-2222-cccc-333333333333",
    amount: 500,
    currency: "USD",
    paymentMethod: "cc",
    nonprofitId: "org1",
    donorId: "donor1",
    status: "new",
    createdAt: "2026-02-01T00:00:00Z",
    ...overrides,
  };
}

describe("validateCreateDonation", () => {
  test("happy path returns ok with value and updatedAt === createdAt", () => {
    const body = baseBody();
    const res = validateCreateDonation(body);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.uuid).toBe(body.uuid);
      expect(res.value.amount).toBe(500);
      expect(res.value.currency).toBe("USD");
      expect(res.value.paymentMethod).toBe("cc");
      expect(res.value.status).toBe("new");
      expect(res.value.createdAt).toBe(body.createdAt);
      expect(res.value.updatedAt).toBe(body.createdAt);
    }
  });

  test("rejects non-object body with 'body must be a JSON object'", () => {
    for (const input of [null, undefined, "hello", 42, [1, 2, 3]]) {
      const res = validateCreateDonation(input);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("body must be a JSON object");
      }
    }
  });

  test("missing field error includes the field name", () => {
    const { uuid: _removed, ...rest } = baseBody();
    const res = validateCreateDonation(rest);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("missing field: uuid");
  });

  test("missing amount", () => {
    const { amount: _removed, ...rest } = baseBody();
    const res = validateCreateDonation(rest);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("missing field: amount");
  });

  test("uuid must be non-empty string", () => {
    const res = validateCreateDonation(baseBody({ uuid: "" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("uuid must be a non-empty string");
  });

  test("nonprofitId must be non-empty string", () => {
    const res = validateCreateDonation(baseBody({ nonprofitId: 123 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("nonprofitId must be a non-empty string");
  });

  test("donorId must be non-empty string", () => {
    const res = validateCreateDonation(baseBody({ donorId: "" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("donorId must be a non-empty string");
  });

  test("createdAt must be non-empty string", () => {
    const res = validateCreateDonation(baseBody({ createdAt: "" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("createdAt must be a non-empty string");
  });

  test("amount must be positive integer — wrong type", () => {
    const res = validateCreateDonation(baseBody({ amount: "500" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("amount must be a positive integer");
  });

  test("amount must be positive integer — non-integer", () => {
    const res = validateCreateDonation(baseBody({ amount: 10.5 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("amount must be a positive integer");
  });

  test("amount must be positive integer — zero", () => {
    const res = validateCreateDonation(baseBody({ amount: 0 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("amount must be a positive integer");
  });

  test("amount must be positive integer — negative", () => {
    const res = validateCreateDonation(baseBody({ amount: -1 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("amount must be a positive integer");
  });

  test("non-USD currency rejected", () => {
    const res = validateCreateDonation(baseBody({ currency: "EUR" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid currency: EUR");
  });

  test("invalid paymentMethod rejected", () => {
    const res = validateCreateDonation(baseBody({ paymentMethod: "stripe" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid paymentMethod: stripe");
  });

  test("invalid status rejected", () => {
    const res = validateCreateDonation(baseBody({ status: "frozen" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid status: frozen");
  });

  test("unparsable createdAt rejected", () => {
    const res = validateCreateDonation(baseBody({ createdAt: "not-a-date" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("createdAt is not a valid ISO date");
  });

  test("non-UUID-shaped uuid rejected", () => {
    for (const bad of ["banana", "1234", "aaaa-bbbb-cccc", "x".repeat(36)]) {
      const res = validateCreateDonation(baseBody({ uuid: bad }));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("uuid must be a valid UUID");
    }
  });

  test("lenient ISO strings that Date.parse accepts are now rejected", () => {
    // "2026" parses via Date.parse but is not a full ISO-8601 timestamp.
    for (const bad of ["2026", "2026-01-15", "Jan 15 2026", "2026-01-15T10:00:00"]) {
      const res = validateCreateDonation(baseBody({ createdAt: bad }));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("createdAt is not a valid ISO date");
    }
  });

  test("nonprofitId longer than 128 chars rejected", () => {
    const res = validateCreateDonation(
      baseBody({ nonprofitId: "a".repeat(129) }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok)
      expect(res.error).toBe("nonprofitId must be at most 128 characters");
  });

  test("donorId longer than 128 chars rejected", () => {
    const res = validateCreateDonation(baseBody({ donorId: "a".repeat(129) }));
    expect(res.ok).toBe(false);
    if (!res.ok)
      expect(res.error).toBe("donorId must be at most 128 characters");
  });

  test("amount above the $10B ceiling rejected", () => {
    const res = validateCreateDonation(
      baseBody({ amount: 1_000_000_000_001 }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("amount exceeds maximum allowed");
  });
});

describe("validateStatusUpdate", () => {
  test("happy path", () => {
    const res = validateStatusUpdate({ status: "pending" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.status).toBe("pending");
  });

  test("rejects non-object body", () => {
    for (const input of [null, "x", 5, [1]]) {
      const res = validateStatusUpdate(input);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("body must be a JSON object");
    }
  });

  test("missing status field", () => {
    const res = validateStatusUpdate({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("missing field: status");
  });

  test("unknown status", () => {
    const res = validateStatusUpdate({ status: "frozen" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid status: frozen");
  });

  test("non-string status", () => {
    const res = validateStatusUpdate({ status: 42 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid status: 42");
  });
});
