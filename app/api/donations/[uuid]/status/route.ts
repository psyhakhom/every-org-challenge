import { NextResponse } from "next/server";

import type { ApiError } from "@/lib/types";
import { emitDonationEvent, eventTypeForTransition } from "@/lib/events";
import { readJsonBody } from "@/lib/http";
import { getDonation, updateDonationStatus } from "@/lib/store";
import { validateStatusUpdate } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> },
): Promise<NextResponse> {
  const { uuid } = await params;

  const read = await readJsonBody(request);
  if (!read.ok) {
    if (read.reason === "too_large") {
      const err: ApiError = {
        error: "request body exceeds maximum size",
        code: "BODY_TOO_LARGE",
      };
      return NextResponse.json(err, { status: 413 });
    }
    const err: ApiError = { error: "invalid JSON body", code: "INVALID_JSON" };
    return NextResponse.json(err, { status: 400 });
  }

  const parsed = validateStatusUpdate(read.value);
  if (!parsed.ok) {
    const err: ApiError = { error: parsed.error, code: "VALIDATION" };
    return NextResponse.json(err, { status: 400 });
  }

  const result = updateDonationStatus(uuid, parsed.status);
  if (result.ok) {
    const eventType = eventTypeForTransition(parsed.status);
    if (eventType) {
      emitDonationEvent(eventType, result.donation);
    }
    return NextResponse.json(result.donation, { status: 200 });
  }

  if (result.reason === "not_found") {
    const err: ApiError = {
      error: `donation not found: ${uuid}`,
      code: "NOT_FOUND",
    };
    return NextResponse.json(err, { status: 404 });
  }

  if (result.reason === "same_status") {
    const err: ApiError = {
      error: `status already ${parsed.status}`,
      code: "SAME_STATUS",
    };
    return NextResponse.json(err, { status: 409 });
  }

  // invalid_transition — we need the current status for a useful message.
  const current = getDonation(uuid);
  const from = current?.status ?? "unknown";
  const err: ApiError = {
    error: `invalid transition: ${from} -> ${parsed.status}`,
    code: "INVALID_TRANSITION",
  };
  return NextResponse.json(err, { status: 422 });
}
