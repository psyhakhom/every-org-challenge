// @vitest-environment node
import { describe, test, expect } from "vitest";

import {
  DONATION_STATUSES,
  allowedNextStatuses,
  isValidTransition,
  type DonationStatus,
} from "@/lib/types";

const VALID_PAIRS: ReadonlyArray<[DonationStatus, DonationStatus]> = [
  ["new", "pending"],
  ["pending", "success"],
  ["pending", "failure"],
];

function isValidPair(from: DonationStatus, to: DonationStatus): boolean {
  return VALID_PAIRS.some(([f, t]) => f === from && t === to);
}

describe("isValidTransition — exhaustive matrix", () => {
  for (const from of DONATION_STATUSES) {
    for (const to of DONATION_STATUSES) {
      const expected = isValidPair(from, to);
      test(`${from} -> ${to} => ${expected}`, () => {
        expect(isValidTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe("allowedNextStatuses", () => {
  test("new -> [pending]", () => {
    expect(allowedNextStatuses("new")).toEqual(["pending"]);
  });

  test("pending contains success and failure", () => {
    const next = allowedNextStatuses("pending");
    expect(next).toContain("success");
    expect(next).toContain("failure");
    expect(next.length).toBe(2);
  });

  test("success -> []", () => {
    expect(allowedNextStatuses("success")).toEqual([]);
  });

  test("failure -> []", () => {
    expect(allowedNextStatuses("failure")).toEqual([]);
  });
});
