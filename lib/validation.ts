import {
  DONATION_STATUSES,
  PAYMENT_METHODS,
  type Donation,
  type DonationStatus,
  type PaymentMethod,
} from "@/lib/types";

type ValidationOk = { ok: true; value: Donation };
type ValidationErr = { ok: false; error: string };

const REQUIRED_FIELDS = [
  "uuid",
  "amount",
  "currency",
  "paymentMethod",
  "nonprofitId",
  "donorId",
  "status",
  "createdAt",
] as const;

// Canonical 8-4-4-4-12 hex shape. Lenient on version/variant nibbles
// so any well-formed UUID from upstream processors is accepted.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Strict ISO-8601 with date + time, optional fractional seconds, and
// a required timezone designator (Z or ±HH:MM). Rejects permissive
// Date.parse inputs like "2026" or "Jan 1".
const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

// A caller-chosen identifier cap. Long enough for any reasonable upstream
// id scheme, short enough that a pathological field can't balloon memory.
export const MAX_ID_LENGTH = 128;

// Sanity ceiling on a single donation amount ($10B in cents). Well below
// Number.MAX_SAFE_INTEGER so arithmetic on totals stays exact, and any
// legitimate donation fits comfortably.
export const MAX_AMOUNT_CENTS = 1_000_000_000_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export function validateCreateDonation(
  input: unknown,
): ValidationOk | ValidationErr {
  if (!isRecord(input)) {
    return { ok: false, error: "body must be a JSON object" };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in input)) {
      return { ok: false, error: `missing field: ${field}` };
    }
  }

  const {
    uuid,
    amount,
    currency,
    paymentMethod,
    nonprofitId,
    donorId,
    status,
    createdAt,
  } = input;

  if (!isNonEmptyString(uuid)) {
    return { ok: false, error: "uuid must be a non-empty string" };
  }
  if (!UUID_REGEX.test(uuid)) {
    return { ok: false, error: "uuid must be a valid UUID" };
  }
  if (!isNonEmptyString(nonprofitId)) {
    return { ok: false, error: "nonprofitId must be a non-empty string" };
  }
  if (nonprofitId.length > MAX_ID_LENGTH) {
    return {
      ok: false,
      error: `nonprofitId must be at most ${MAX_ID_LENGTH} characters`,
    };
  }
  if (!isNonEmptyString(donorId)) {
    return { ok: false, error: "donorId must be a non-empty string" };
  }
  if (donorId.length > MAX_ID_LENGTH) {
    return {
      ok: false,
      error: `donorId must be at most ${MAX_ID_LENGTH} characters`,
    };
  }
  if (!isNonEmptyString(createdAt)) {
    return { ok: false, error: "createdAt must be a non-empty string" };
  }

  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    return { ok: false, error: "amount must be a positive integer" };
  }
  if (amount > MAX_AMOUNT_CENTS) {
    return { ok: false, error: "amount exceeds maximum allowed" };
  }

  if (currency !== "USD") {
    return { ok: false, error: `invalid currency: ${String(currency)}` };
  }

  if (
    typeof paymentMethod !== "string" ||
    !PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)
  ) {
    return {
      ok: false,
      error: `invalid paymentMethod: ${String(paymentMethod)}`,
    };
  }

  if (
    typeof status !== "string" ||
    !DONATION_STATUSES.includes(status as DonationStatus)
  ) {
    return { ok: false, error: `invalid status: ${String(status)}` };
  }

  if (!ISO_DATE_REGEX.test(createdAt) || Number.isNaN(Date.parse(createdAt))) {
    return { ok: false, error: "createdAt is not a valid ISO date" };
  }

  const donation: Donation = {
    uuid,
    amount,
    currency: "USD",
    paymentMethod: paymentMethod as PaymentMethod,
    nonprofitId,
    donorId,
    status: status as DonationStatus,
    createdAt,
    // Initial updatedAt equals createdAt per spec.
    updatedAt: createdAt,
  };

  return { ok: true, value: donation };
}

type StatusOk = { ok: true; status: DonationStatus };
type StatusErr = { ok: false; error: string };

export function validateStatusUpdate(
  input: unknown,
): StatusOk | StatusErr {
  if (!isRecord(input)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  if (!("status" in input)) {
    return { ok: false, error: "missing field: status" };
  }
  const { status } = input;
  if (
    typeof status !== "string" ||
    !DONATION_STATUSES.includes(status as DonationStatus)
  ) {
    return { ok: false, error: `invalid status: ${String(status)}` };
  }
  return { ok: true, status: status as DonationStatus };
}
