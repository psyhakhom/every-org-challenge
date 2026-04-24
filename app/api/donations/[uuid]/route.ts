import { NextResponse } from "next/server";

import type { ApiError } from "@/lib/types";
import { getDonation } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> },
): Promise<NextResponse> {
  const { uuid } = await params;
  const donation = getDonation(uuid);
  if (!donation) {
    const err: ApiError = {
      error: `donation not found: ${uuid}`,
      code: "NOT_FOUND",
    };
    return NextResponse.json(err, { status: 404 });
  }
  return NextResponse.json(donation, { status: 200 });
}
