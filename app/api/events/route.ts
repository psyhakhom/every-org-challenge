import { NextResponse } from "next/server";

import { listEvents } from "@/lib/events";
import type { DonationEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

interface GetEventsResponse {
  events: DonationEvent[];
}

export async function GET(): Promise<NextResponse<GetEventsResponse>> {
  return NextResponse.json({ events: listEvents() }, { status: 200 });
}
