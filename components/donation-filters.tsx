"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bitcoin,
  CreditCard,
  Landmark,
  Smartphone,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_ICONS, STATUS_LABELS } from "@/components/status-badge";
import {
  DONATION_STATUSES,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/types";
import { parseMethodParam, parseStatusParam } from "@/lib/filters";

const ALL = "all";

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

interface DonationFiltersProps {
  totalCount: number;
  visibleCount: number;
}

export function DonationFilters({
  totalCount,
  visibleCount,
}: DonationFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = parseStatusParam(searchParams.get("status")) ?? ALL;
  const method = parseMethodParam(searchParams.get("method")) ?? ALL;
  const hasActive = status !== ALL || method !== ALL;

  const update = useCallback(
    (key: "status" | "method", value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value === ALL) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const filtered = hasActive;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={status} onValueChange={(v) => update("status", v ?? ALL)}>
        <SelectTrigger size="sm" className="min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {DONATION_STATUSES.map((s) => {
            const Icon = STATUS_ICONS[s];
            return (
              <SelectItem key={s} value={s}>
                <Icon className="size-3.5" />
                {STATUS_LABELS[s]}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Select value={method} onValueChange={(v) => update("method", v ?? ALL)}>
        <SelectTrigger size="sm" className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All payment methods</SelectItem>
          {PAYMENT_METHODS.map((m) => {
            const Icon = PAYMENT_METHOD_ICONS[m];
            return (
              <SelectItem key={m} value={m}>
                <Icon className="size-3.5" />
                {PAYMENT_METHOD_LABELS[m]}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {hasActive && (
        <Button variant="ghost" size="sm" onClick={clear}>
          <X className="size-3.5" />
          Clear
        </Button>
      )}

      <span className="ml-auto text-sm text-muted-foreground tabular-nums">
        {filtered
          ? `Showing ${visibleCount} of ${totalCount}`
          : `${totalCount} donation${totalCount === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}
