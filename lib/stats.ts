import type {
  Donation,
  DonationStatus,
  PaymentMethod,
} from "@/lib/types";

export interface Bucket {
  count: number;
  amount: number;
}

export interface DonationSummary {
  count: number;
  totalAmount: number;
  successCount: number;
  successAmount: number;
  failureCount: number;
  failureAmount: number;
  pendingCount: number;
  pendingAmount: number;
  newCount: number;
  newAmount: number;
  /** success + failure (i.e. terminal donations, the success-rate denominator) */
  terminalCount: number;
  /** success / terminal; null when terminalCount === 0 */
  successRate: number | null;
  byStatus: Record<DonationStatus, Bucket>;
  byMethod: Record<PaymentMethod, Bucket>;
}

const emptyStatusBuckets = (): Record<DonationStatus, Bucket> => ({
  new: { count: 0, amount: 0 },
  pending: { count: 0, amount: 0 },
  success: { count: 0, amount: 0 },
  failure: { count: 0, amount: 0 },
});

const emptyMethodBuckets = (): Record<PaymentMethod, Bucket> => ({
  cc: { count: 0, amount: 0 },
  ach: { count: 0, amount: 0 },
  crypto: { count: 0, amount: 0 },
  venmo: { count: 0, amount: 0 },
});

export function computeSummary(
  donations: readonly Donation[],
): DonationSummary {
  const byStatus = emptyStatusBuckets();
  const byMethod = emptyMethodBuckets();
  let totalAmount = 0;

  for (const d of donations) {
    byStatus[d.status].count += 1;
    byStatus[d.status].amount += d.amount;
    byMethod[d.paymentMethod].count += 1;
    byMethod[d.paymentMethod].amount += d.amount;
    totalAmount += d.amount;
  }

  const terminalCount = byStatus.success.count + byStatus.failure.count;
  const successRate =
    terminalCount > 0 ? byStatus.success.count / terminalCount : null;

  return {
    count: donations.length,
    totalAmount,
    successCount: byStatus.success.count,
    successAmount: byStatus.success.amount,
    failureCount: byStatus.failure.count,
    failureAmount: byStatus.failure.amount,
    pendingCount: byStatus.pending.count,
    pendingAmount: byStatus.pending.amount,
    newCount: byStatus.new.count,
    newAmount: byStatus.new.amount,
    terminalCount,
    successRate,
    byStatus,
    byMethod,
  };
}
