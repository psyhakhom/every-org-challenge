import { NextResponse } from "next/server";

import type { ApiError, GetDonationsResponse } from "@/lib/types";
import { createDonation, listDonations } from "@/lib/store";
import { validateCreateDonation } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<GetDonationsResponse>> {
  return NextResponse.json({ donations: listDonations() }, { status: 200 });
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const err: ApiError = { error: "invalid JSON body" };
    return NextResponse.json(err, { status: 400 });
  }

  const result = validateCreateDonation(body);
  if (!result.ok) {
    const err: ApiError = { error: result.error };
    return NextResponse.json(err, { status: 400 });
  }

  const created = createDonation(result.value);
  if (!created.ok) {
    const err: ApiError = {
      error: `duplicate donation uuid: ${result.value.uuid}`,
    };
    return NextResponse.json(err, { status: 409 });
  }

  return NextResponse.json(created.donation, { status: 201 });
}
