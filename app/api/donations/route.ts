import { NextResponse } from "next/server";

import type { ApiError, GetDonationsResponse } from "@/lib/types";
import { readJsonBody } from "@/lib/http";
import { createDonation, listDonations } from "@/lib/store";
import { validateCreateDonation } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<GetDonationsResponse>> {
  return NextResponse.json({ donations: listDonations() }, { status: 200 });
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
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

  const result = validateCreateDonation(read.value);
  if (!result.ok) {
    const err: ApiError = { error: result.error, code: "VALIDATION" };
    return NextResponse.json(err, { status: 400 });
  }

  const created = createDonation(result.value);
  if (!created.ok) {
    const err: ApiError = {
      error: `duplicate donation uuid: ${result.value.uuid}`,
      code: "DUPLICATE_UUID",
    };
    return NextResponse.json(err, { status: 409 });
  }

  return NextResponse.json(created.donation, { status: 201 });
}
