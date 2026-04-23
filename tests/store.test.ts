// @vitest-environment node
import { describe, test, expect, beforeEach } from "vitest";

import {
  createDonation,
  getDonation,
  listDonations,
  resetStore,
  updateDonationStatus,
} from "@/lib/store";
import type { Donation } from "@/lib/types";

const SEED_NEW_UUID = "354362d8-2080-4ca1-9ede-892e4c6d3a25";
const SEED_PENDING_UUID = "86f1c108-102b-447a-9efe-67c2f3b594d8";
const SEED_SUCCESS_UUID = "73aff4cc-135d-4840-96b2-9210639528c8";

function makeDonation(overrides: Partial<Donation> = {}): Donation {
  return {
    uuid: "11111111-1111-1111-1111-111111111111",
    amount: 4242,
    currency: "USD",
    paymentMethod: "cc",
    nonprofitId: "org-x",
    donorId: "donor-x",
    status: "new",
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

describe("store", () => {
  beforeEach(() => {
    resetStore();
  });

  test("listDonations returns 8 seeded items after reset", () => {
    expect(listDonations()).toHaveLength(8);
  });

  test("getDonation returns known seed", () => {
    const d = getDonation(SEED_NEW_UUID);
    expect(d).toBeDefined();
    expect(d?.uuid).toBe(SEED_NEW_UUID);
    expect(d?.status).toBe("new");
  });

  test("getDonation returns undefined for unknown uuid", () => {
    expect(getDonation("nope-nope-nope")).toBeUndefined();
  });

  test("createDonation with fresh uuid returns ok and item is listed", () => {
    const fresh = makeDonation();
    const result = createDonation(fresh);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.donation.uuid).toBe(fresh.uuid);
    }
    expect(listDonations()).toHaveLength(9);
    expect(getDonation(fresh.uuid)?.amount).toBe(4242);
  });

  test("createDonation with existing uuid returns duplicate", () => {
    const dup = makeDonation({ uuid: SEED_NEW_UUID });
    const result = createDonation(dup);
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  test("updateDonationStatus unknown uuid returns not_found", () => {
    const result = updateDonationStatus("no-such-uuid", "pending");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("updateDonationStatus with same status returns same_status", () => {
    const result = updateDonationStatus(SEED_NEW_UUID, "new");
    expect(result).toEqual({ ok: false, reason: "same_status" });
  });

  test("updateDonationStatus invalid transition returns invalid_transition", () => {
    const result = updateDonationStatus(SEED_SUCCESS_UUID, "failure");
    expect(result).toEqual({ ok: false, reason: "invalid_transition" });
  });

  test("valid transition updates status and refreshes updatedAt to a later ISO", () => {
    const before = getDonation(SEED_PENDING_UUID);
    expect(before).toBeDefined();
    const result = updateDonationStatus(SEED_PENDING_UUID, "success");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.donation.status).toBe("success");
      expect(result.donation.updatedAt).not.toBe(before?.updatedAt);
      const parsedBefore = Date.parse(before!.updatedAt);
      const parsedAfter = Date.parse(result.donation.updatedAt);
      expect(Number.isNaN(parsedAfter)).toBe(false);
      expect(parsedAfter).toBeGreaterThanOrEqual(parsedBefore);
    }
    const persisted = getDonation(SEED_PENDING_UUID);
    expect(persisted?.status).toBe("success");
  });

  test("returned donations are copies — mutation does not leak into the store", () => {
    const d = getDonation(SEED_NEW_UUID);
    expect(d).toBeDefined();
    if (d) {
      d.amount = -999999;
      d.status = "failure";
    }
    const fresh = getDonation(SEED_NEW_UUID);
    expect(fresh?.amount).not.toBe(-999999);
    expect(fresh?.status).toBe("new");
  });

  test("listDonations returns copies — mutation does not leak", () => {
    const list = listDonations();
    list[0].amount = -1;
    const fresh = listDonations();
    expect(fresh[0].amount).not.toBe(-1);
  });

  test("createDonation return value is a copy", () => {
    const fresh = makeDonation({
      uuid: "22222222-2222-2222-2222-222222222222",
    });
    const result = createDonation(fresh);
    expect(result.ok).toBe(true);
    if (result.ok) {
      result.donation.amount = -1;
      const persisted = getDonation(fresh.uuid);
      expect(persisted?.amount).toBe(4242);
    }
  });
});
