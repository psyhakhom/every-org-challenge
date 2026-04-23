"use client";

import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bitcoin,
  CreditCard,
  Inbox,
  Landmark,
  Loader2,
  RefreshCw,
  Smartphone,
  TriangleAlert,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusAction } from "@/components/status-action";
import { StatusBadge } from "@/components/status-badge";
import { fetchDonations } from "@/lib/api-client";
import { formatAmount, formatDateTime } from "@/lib/format";
import type { Donation, PaymentMethod } from "@/lib/types";

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

type LoadState = "idle" | "loading" | "error";

export function DonationsTable() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDonations();
      setDonations(data);
      setErrorMessage(null);
      setState("idle");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load donations.";
      setErrorMessage(message);
      setState("error");
    }
  }, []);

  const reload = useCallback(() => {
    setState("loading");
    setErrorMessage(null);
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDonations();
        if (cancelled) return;
        setDonations(data);
        setErrorMessage(null);
        setState("idle");
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load donations.";
        setErrorMessage(message);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdated = useCallback((updated: Donation) => {
    setDonations((curr) =>
      curr.map((d) => (d.uuid === updated.uuid ? updated : d)),
    );
  }, []);

  const handleError = useCallback(() => {
    void load();
  }, [load]);

  if (state === "loading" && donations.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading donations…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6">
        <div className="mb-3 flex items-start gap-2">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p className="text-sm text-destructive">
            {errorMessage ?? "Failed to load donations."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={reload}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  if (donations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border p-10 text-sm text-muted-foreground">
        <Inbox className="size-8 opacity-60" aria-hidden="true" />
        No donations yet.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Donor</TableHead>
            <TableHead>Nonprofit</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {donations.map((d) => {
            const MethodIcon = PAYMENT_METHOD_ICONS[d.paymentMethod];
            return (
              <TableRow key={d.uuid}>
                <TableCell className="font-mono text-xs">{d.donorId}</TableCell>
                <TableCell className="font-mono text-xs">
                  {d.nonprofitId}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(d.amount, d.currency)}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <MethodIcon
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {PAYMENT_METHOD_LABELS[d.paymentMethod]}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={d.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(d.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <StatusAction
                    donation={d}
                    onUpdated={handleUpdated}
                    onError={handleError}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
