"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bitcoin,
  CircleCheck,
  Clock,
  CreditCard,
  Landmark,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { formatAmount } from "@/lib/format";
import { computeSummary } from "@/lib/stats";
import type { Donation, PaymentMethod } from "@/lib/types";
import { PAYMENT_METHODS } from "@/lib/types";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cc: "Credit Card",
  ach: "ACH",
  crypto: "Crypto",
  venmo: "Venmo",
};

const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cc: CreditCard,
  ach: Landmark,
  crypto: Bitcoin,
  venmo: Smartphone,
};

interface DonationSummaryProps {
  donations: readonly Donation[];
}

export function DonationSummary({ donations }: DonationSummaryProps) {
  const s = computeSummary(donations);

  if (s.count === 0) return null;

  const inFlightAmount = s.pendingAmount + s.newAmount;
  const inFlightCount = s.pendingCount + s.newCount;
  const successRatePct =
    s.successRate !== null ? Math.round(s.successRate * 100) : null;

  const methodAmounts = PAYMENT_METHODS.map((m) => s.byMethod[m].amount);
  const maxMethodAmount = Math.max(0, ...methodAmounts);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={CircleCheck}
          label="Successfully donated"
          value={formatAmount(s.successAmount, "USD")}
          sub={`across ${s.successCount} donation${s.successCount === 1 ? "" : "s"}`}
          accent="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Success rate"
          value={successRatePct !== null ? `${successRatePct}%` : "—"}
          sub={
            s.terminalCount > 0
              ? `${s.successCount} of ${s.terminalCount} resolved`
              : "No resolved donations yet"
          }
        />
        <StatCard
          icon={Clock}
          label="In flight"
          value={formatAmount(inFlightAmount, "USD")}
          sub={`${inFlightCount} donation${inFlightCount === 1 ? "" : "s"} unresolved`}
        />
      </div>

      <div className="rounded-md border bg-background p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="size-3.5" aria-hidden="true" />
          By payment method
        </div>
        <div className="flex flex-col gap-2.5">
          {PAYMENT_METHODS.map((m) => {
            const bucket = s.byMethod[m];
            const Icon = PAYMENT_METHOD_ICONS[m];
            const pct =
              maxMethodAmount > 0 ? (bucket.amount / maxMethodAmount) * 100 : 0;
            return (
              <div
                key={m}
                className="flex items-center gap-3 text-sm"
                aria-label={`${PAYMENT_METHOD_LABELS[m]}: ${formatAmount(bucket.amount, "USD")} across ${bucket.count} donation${bucket.count === 1 ? "" : "s"}`}
              >
                <div className="flex w-32 shrink-0 items-center gap-1.5">
                  <Icon
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {PAYMENT_METHOD_LABELS[m]}
                </div>
                <div
                  className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-emerald-500/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-24 shrink-0 text-right tabular-nums">
                  {formatAmount(bucket.amount, "USD")}
                </div>
                <div className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {bucket.count}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent?: "emerald";
}

function StatCard({ icon: Icon, label, value, sub, accent }: StatCardProps) {
  const valueClass =
    accent === "emerald"
      ? "mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
      : "mt-1 text-2xl font-semibold tabular-nums";
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className={valueClass}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
