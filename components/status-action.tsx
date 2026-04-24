"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock,
  Loader2,
  Sparkles,
  Webhook,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_LABELS } from "@/components/status-badge";
import { updateDonationStatus } from "@/lib/api-client";
import { allowedNextStatuses } from "@/lib/types";
import type { Donation, DonationStatus } from "@/lib/types";

const ACTION_ICONS: Record<DonationStatus, LucideIcon> = {
  new: Sparkles,
  pending: Clock,
  success: CircleCheck,
  failure: CircleX,
};

interface StatusActionProps {
  donation: Donation;
  onUpdated: (updated: Donation) => void;
  onError?: (err: Error) => void;
}

export function StatusAction({
  donation,
  onUpdated,
  onError,
}: StatusActionProps) {
  const [pending, startTransition] = useTransition();
  const next = allowedNextStatuses(donation.status);

  if (next.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const runUpdate = (status: DonationStatus) => {
    startTransition(async () => {
      try {
        const updated = await updateDonationStatus(donation.uuid, status);
        onUpdated(updated);
        toast.success(`Marked ${STATUS_LABELS[status].toLowerCase()}`);
        if (status === "success" || status === "failure") {
          toast.info(`Webhook emitted: donation.${status}`, {
            icon: <Webhook className="size-4" aria-hidden="true" />,
            description: "See GET /api/events",
          });
        }
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to update donation.");
        toast.error(error.message);
        onError?.(error);
      }
    });
  };

  if (next.length === 1) {
    const only = next[0];
    const Icon = ACTION_ICONS[only];
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => runUpdate(only)}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Icon className="size-3.5" />
        )}
        Mark {STATUS_LABELS[only].toLowerCase()}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Update status
            <ChevronDown className="ml-1 size-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {next.map((s) => {
          const Icon = ACTION_ICONS[s];
          return (
            <DropdownMenuItem key={s} onClick={() => runUpdate(s)}>
              <Icon className="size-3.5" />
              Mark {STATUS_LABELS[s].toLowerCase()}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
