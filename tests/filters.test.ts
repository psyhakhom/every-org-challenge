// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  filterDonations,
  parseMethodParam,
  parseStatusParam,
} from "@/lib/filters";
import type { Donation } from "@/lib/types";

function d(overrides: Partial<Donation> & Pick<Donation, "uuid">): Donation {
  return {
    uuid: overrides.uuid,
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

const donations: Donation[] = [
  d({ uuid: "1", status: "new", paymentMethod: "cc" }),
  d({ uuid: "2", status: "pending", paymentMethod: "ach" }),
  d({ uuid: "3", status: "success", paymentMethod: "crypto" }),
  d({ uuid: "4", status: "failure", paymentMethod: "venmo" }),
  d({ uuid: "5", status: "pending", paymentMethod: "cc" }),
];

describe("filterDonations", () => {
  test("no filter returns the full list unchanged", () => {
    expect(filterDonations(donations, {})).toEqual(donations);
  });

  test("filter by status narrows the list", () => {
    const pending = filterDonations(donations, { status: "pending" });
    expect(pending.map((x) => x.uuid)).toEqual(["2", "5"]);
  });

  test("filter by payment method narrows the list", () => {
    const cc = filterDonations(donations, { method: "cc" });
    expect(cc.map((x) => x.uuid)).toEqual(["1", "5"]);
  });

  test("status + method filters AND together", () => {
    const pendingCc = filterDonations(donations, {
      status: "pending",
      method: "cc",
    });
    expect(pendingCc.map((x) => x.uuid)).toEqual(["5"]);
  });

  test("null filters are treated as unset", () => {
    expect(
      filterDonations(donations, { status: null, method: null }),
    ).toEqual(donations);
  });

  test("a filter matching nothing returns an empty array", () => {
    const none = filterDonations(donations, {
      status: "success",
      method: "venmo",
    });
    expect(none).toEqual([]);
  });
});

describe("parseStatusParam", () => {
  test("returns the value when it is a valid status", () => {
    expect(parseStatusParam("new")).toBe("new");
    expect(parseStatusParam("pending")).toBe("pending");
    expect(parseStatusParam("success")).toBe("success");
    expect(parseStatusParam("failure")).toBe("failure");
  });

  test("returns null for unknown or missing values", () => {
    expect(parseStatusParam(null)).toBeNull();
    expect(parseStatusParam("")).toBeNull();
    expect(parseStatusParam("frozen")).toBeNull();
    expect(parseStatusParam("NEW")).toBeNull();
  });
});

describe("parseMethodParam", () => {
  test("returns the value when it is a valid payment method", () => {
    expect(parseMethodParam("cc")).toBe("cc");
    expect(parseMethodParam("ach")).toBe("ach");
    expect(parseMethodParam("crypto")).toBe("crypto");
    expect(parseMethodParam("venmo")).toBe("venmo");
  });

  test("returns null for unknown or missing values", () => {
    expect(parseMethodParam(null)).toBeNull();
    expect(parseMethodParam("")).toBeNull();
    expect(parseMethodParam("cash")).toBeNull();
    expect(parseMethodParam("CC")).toBeNull();
  });
});
