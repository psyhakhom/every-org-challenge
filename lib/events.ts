import type { Donation } from "@/lib/types";

export type EventType = "donation.success" | "donation.failure";

export interface DonationEvent {
  id: string;
  type: EventType;
  occurredAt: string;
  donation: Donation;
}

const EVENT_LOG_KEY = Symbol.for("every-org-challenge.donationEvents");

type GlobalWithLog = typeof globalThis & {
  [EVENT_LOG_KEY]?: DonationEvent[];
};

function getLog(): DonationEvent[] {
  const g = globalThis as GlobalWithLog;
  if (!g[EVENT_LOG_KEY]) g[EVENT_LOG_KEY] = [];
  return g[EVENT_LOG_KEY];
}

function newEventId(): string {
  // crypto.randomUUID is collision-safe and unpredictable, both of which
  // Math.random is not. Keep the `evt_` prefix so log scanners that grep
  // for it keep working.
  return `evt_${crypto.randomUUID()}`;
}

/**
 * Append a donation lifecycle event to the in-memory log and emit it to
 * the server console. Returns the stored event record.
 *
 * Intentionally synchronous: the operation is O(1) and failing to log
 * should never affect the response to the caller.
 */
export function emitDonationEvent(
  type: EventType,
  donation: Donation,
): DonationEvent {
  const event: DonationEvent = {
    id: newEventId(),
    type,
    occurredAt: new Date().toISOString(),
    donation: { ...donation },
  };
  getLog().push(event);
  console.log(
    `[webhook] ${event.type} ${event.id} uuid=${donation.uuid} donor=${donation.donorId} amount=${donation.amount}`,
  );
  return event;
}

export function listEvents(): DonationEvent[] {
  return getLog().map((e) => ({ ...e, donation: { ...e.donation } }));
}

export function resetEvents(): void {
  const g = globalThis as GlobalWithLog;
  g[EVENT_LOG_KEY] = [];
}

const TERMINAL_EVENT_TYPES: Record<string, EventType> = {
  success: "donation.success",
  failure: "donation.failure",
};

/**
 * Returns the lifecycle event type a donation transition should fire,
 * or null if no event should be emitted for this transition.
 */
export function eventTypeForTransition(
  newStatus: string,
): EventType | null {
  return TERMINAL_EVENT_TYPES[newStatus] ?? null;
}
