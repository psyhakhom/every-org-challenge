// @vitest-environment node
import { describe, expect, test } from "vitest";

import { computeSummary } from "@/lib/stats";
import type { Donation } from "@/lib/types";

function d(overrides: Partial<Donation> & Pick<Donation, "uuid">): Donation {
  return {
    amount: 1000,
    currency: "USD",
    paymentMethod: "cc",
    nonprofitId: "org1",
    donorId: "donor_x",
    status: "new",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeSummary", () => {
  test("empty list returns zeros and null success rate", () => {
    const s = computeSummary([]);
    expect(s.count).toBe(0);
    expect(s.totalAmount).toBe(0);
    expect(s.terminalCount).toBe(0);
    expect(s.successRate).toBeNull();
    expect(s.byStatus.new).toEqual({ count: 0, amount: 0 });
    expect(s.byMethod.cc).toEqual({ count: 0, amount: 0 });
  });

  test("aggregates counts and amounts by status", () => {
    const s = computeSummary([
      d({ uuid: "1", amount: 100, status: "new" }),
      d({ uuid: "2", amount: 200, status: "pending" }),
      d({ uuid: "3", amount: 300, status: "success" }),
      d({ uuid: "4", amount: 400, status: "success" }),
      d({ uuid: "5", amount: 500, status: "failure" }),
    ]);
    expect(s.count).toBe(5);
    expect(s.totalAmount).toBe(1500);
    expect(s.successCount).toBe(2);
    expect(s.successAmount).toBe(700);
    expect(s.failureCount).toBe(1);
    expect(s.failureAmount).toBe(500);
    expect(s.pendingCount).toBe(1);
    expect(s.pendingAmount).toBe(200);
    expect(s.newCount).toBe(1);
    expect(s.newAmount).toBe(100);
  });

  test("aggregates counts and amounts by payment method", () => {
    const s = computeSummary([
      d({ uuid: "1", amount: 100, paymentMethod: "cc" }),
      d({ uuid: "2", amount: 200, paymentMethod: "cc" }),
      d({ uuid: "3", amount: 300, paymentMethod: "ach" }),
      d({ uuid: "4", amount: 400, paymentMethod: "crypto" }),
      d({ uuid: "5", amount: 500, paymentMethod: "venmo" }),
    ]);
    expect(s.byMethod.cc).toEqual({ count: 2, amount: 300 });
    expect(s.byMethod.ach).toEqual({ count: 1, amount: 300 });
    expect(s.byMethod.crypto).toEqual({ count: 1, amount: 400 });
    expect(s.byMethod.venmo).toEqual({ count: 1, amount: 500 });
  });

  test("success rate excludes new and pending from the denominator", () => {
    const s = computeSummary([
      d({ uuid: "1", status: "success" }),
      d({ uuid: "2", status: "success" }),
      d({ uuid: "3", status: "failure" }),
      d({ uuid: "4", status: "pending" }),
      d({ uuid: "5", status: "new" }),
    ]);
    expect(s.terminalCount).toBe(3);
    expect(s.successRate).toBeCloseTo(2 / 3);
  });

  test("success rate is null when no donation has reached a terminal state", () => {
    const s = computeSummary([
      d({ uuid: "1", status: "new" }),
      d({ uuid: "2", status: "pending" }),
    ]);
    expect(s.terminalCount).toBe(0);
    expect(s.successRate).toBeNull();
  });

  test("success rate is 1 when every terminal donation succeeded", () => {
    const s = computeSummary([
      d({ uuid: "1", status: "success" }),
      d({ uuid: "2", status: "success" }),
      d({ uuid: "3", status: "pending" }),
    ]);
    expect(s.successRate).toBe(1);
  });

  test("success rate is 0 when every terminal donation failed", () => {
    const s = computeSummary([
      d({ uuid: "1", status: "failure" }),
      d({ uuid: "2", status: "failure" }),
    ]);
    expect(s.successRate).toBe(0);
  });
});
