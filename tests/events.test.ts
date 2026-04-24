// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  emitDonationEvent,
  eventTypeForTransition,
  listEvents,
  resetEvents,
} from "@/lib/events";
import type { Donation } from "@/lib/types";

function donation(overrides: Partial<Donation> = {}): Donation {
  return {
    uuid: "1111-1111",
    amount: 1000,
    currency: "USD",
    paymentMethod: "cc",
    nonprofitId: "org1",
    donorId: "donor_01",
    status: "success",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("eventTypeForTransition", () => {
  test("maps terminal statuses to their event type", () => {
    expect(eventTypeForTransition("success")).toBe("donation.success");
    expect(eventTypeForTransition("failure")).toBe("donation.failure");
  });

  test("returns null for non-terminal statuses", () => {
    expect(eventTypeForTransition("new")).toBeNull();
    expect(eventTypeForTransition("pending")).toBeNull();
  });

  test("returns null for unknown input", () => {
    expect(eventTypeForTransition("frozen")).toBeNull();
    expect(eventTypeForTransition("")).toBeNull();
  });
});

describe("emitDonationEvent + listEvents + resetEvents", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetEvents();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("emit appends an event with id, type, occurredAt, and a copy of the donation", () => {
    const d = donation({ uuid: "abc", status: "success" });
    const ev = emitDonationEvent("donation.success", d);

    expect(ev.type).toBe("donation.success");
    expect(ev.id).toMatch(/^evt_/);
    expect(new Date(ev.occurredAt).getTime()).not.toBeNaN();
    expect(ev.donation.uuid).toBe("abc");
  });

  test("emit writes a [webhook] line to the console", () => {
    emitDonationEvent("donation.failure", donation({ status: "failure" }));
    expect(logSpy).toHaveBeenCalledTimes(1);
    const [msg] = logSpy.mock.calls[0];
    expect(msg).toMatch(/^\[webhook\] donation\.failure /);
  });

  test("listEvents returns stored events in insertion order", () => {
    emitDonationEvent("donation.success", donation({ uuid: "a" }));
    emitDonationEvent("donation.failure", donation({ uuid: "b" }));
    const events = listEvents();
    expect(events.map((e) => e.donation.uuid)).toEqual(["a", "b"]);
    expect(events.map((e) => e.type)).toEqual([
      "donation.success",
      "donation.failure",
    ]);
  });

  test("returned records are copies — mutating them does not corrupt the log", () => {
    emitDonationEvent("donation.success", donation({ uuid: "a" }));
    const firstRead = listEvents();
    firstRead[0].donation.uuid = "tampered";
    const secondRead = listEvents();
    expect(secondRead[0].donation.uuid).toBe("a");
  });

  test("resetEvents empties the log", () => {
    emitDonationEvent("donation.success", donation());
    expect(listEvents().length).toBe(1);
    resetEvents();
    expect(listEvents()).toEqual([]);
  });
});
