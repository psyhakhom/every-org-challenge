import { NextResponse } from "next/server";

import type { ApiError } from "@/lib/types";
import { emitDonationEvent, eventTypeForTransition } from "@/lib/events";
import { getDonation, updateDonationStatus } from "@/lib/store";
import { validateStatusUpdate } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> },
): Promise<NextResponse> {
  const { uuid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const err: ApiError = { error: "invalid JSON body" };
    return NextResponse.json(err, { status: 400 });
  }

  const parsed = validateStatusUpdate(body);
  if (!parsed.ok) {
    const err: ApiError = { error: parsed.error };
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
    const err: ApiError = { error: `donation not found: ${uuid}` };
    return NextResponse.json(err, { status: 404 });
  }

  if (result.reason === "same_status") {
    const err: ApiError = {
      error: `status already ${parsed.status}`,
    };
    return NextResponse.json(err, { status: 409 });
  }

  // invalid_transition — we need the current status for a useful message.
  const current = getDonation(uuid);
  const from = current?.status ?? "unknown";
  const err: ApiError = {
    error: `invalid transition: ${from} -> ${parsed.status}`,
  };
  return NextResponse.json(err, { status: 422 });
}
