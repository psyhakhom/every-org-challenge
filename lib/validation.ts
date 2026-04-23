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
  if (!isNonEmptyString(nonprofitId)) {
    return { ok: false, error: "nonprofitId must be a non-empty string" };
  }
  if (!isNonEmptyString(donorId)) {
    return { ok: false, error: "donorId must be a non-empty string" };
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

  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) {
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
