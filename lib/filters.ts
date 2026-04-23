import type {
  Donation,
  DonationStatus,
  PaymentMethod,
} from "@/lib/types";
import { DONATION_STATUSES, PAYMENT_METHODS } from "@/lib/types";

export interface DonationFilter {
  status?: DonationStatus | null;
  method?: PaymentMethod | null;
}

export function filterDonations(
  donations: readonly Donation[],
  filter: DonationFilter,
): Donation[] {
  return donations.filter((d) => {
    if (filter.status && d.status !== filter.status) return false;
    if (filter.method && d.paymentMethod !== filter.method) return false;
    return true;
  });
}

export function parseStatusParam(raw: string | null): DonationStatus | null {
  if (raw && (DONATION_STATUSES as readonly string[]).includes(raw)) {
    return raw as DonationStatus;
  }
  return null;
}

export function parseMethodParam(raw: string | null): PaymentMethod | null {
  if (raw && (PAYMENT_METHODS as readonly string[]).includes(raw)) {
    return raw as PaymentMethod;
  }
  return null;
}
