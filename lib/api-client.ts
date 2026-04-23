import type {
  ApiError,
  CreateDonationRequest,
  Donation,
  DonationStatus,
  GetDonationsResponse,
} from "@/lib/types";

/**
 * Extract an error message from a non-ok API response.
 * Falls back to the HTTP status text if the body is unreadable or non-JSON.
 */
async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Partial<ApiError>;
    if (body && typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // fall through
  }
  return res.statusText || `Request failed with status ${res.status}`;
}

async function request<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function fetchDonations(): Promise<Donation[]> {
  const data = await request<GetDonationsResponse>("/api/donations");
  return data.donations;
}

export async function fetchDonation(uuid: string): Promise<Donation> {
  return request<Donation>(`/api/donations/${encodeURIComponent(uuid)}`);
}

export async function updateDonationStatus(
  uuid: string,
  status: DonationStatus,
): Promise<Donation> {
  return request<Donation>(
    `/api/donations/${encodeURIComponent(uuid)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export async function createDonation(
  req: CreateDonationRequest,
): Promise<Donation> {
  return request<Donation>("/api/donations", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
