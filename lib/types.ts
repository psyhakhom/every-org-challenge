export type PaymentMethod = "cc" | "ach" | "crypto" | "venmo";

export type DonationStatus = "new" | "pending" | "success" | "failure";

export interface Donation {
  uuid: string;
  amount: number;
  currency: "USD";
  paymentMethod: PaymentMethod;
  nonprofitId: string;
  donorId: string;
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDonationRequest {
  uuid: string;
  amount: number;
  currency: "USD";
  paymentMethod: PaymentMethod;
  nonprofitId: string;
  donorId: string;
  status: DonationStatus;
  createdAt: string;
}

export interface UpdateDonationStatusRequest {
  status: DonationStatus;
}

export interface GetDonationsResponse {
  donations: Donation[];
}

export interface ApiError {
  error: string;
  code?: string;
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "cc",
  "ach",
  "crypto",
  "venmo",
] as const;

export const DONATION_STATUSES: readonly DonationStatus[] = [
  "new",
  "pending",
  "success",
  "failure",
] as const;

const TRANSITIONS: Record<DonationStatus, readonly DonationStatus[]> = {
  new: ["pending"],
  pending: ["success", "failure"],
  success: [],
  failure: [],
};

export function allowedNextStatuses(
  current: DonationStatus,
): readonly DonationStatus[] {
  return TRANSITIONS[current];
}

export function isValidTransition(
  from: DonationStatus,
  to: DonationStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}
