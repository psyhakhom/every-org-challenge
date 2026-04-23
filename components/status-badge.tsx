import type { LucideIcon } from "lucide-react";
import { CircleCheck, CircleX, Clock, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DonationStatus } from "@/lib/types";

const STATUS_LABELS: Record<DonationStatus, string> = {
  new: "New",
  pending: "Pending",
  success: "Success",
  failure: "Failure",
};

const STATUS_ICONS: Record<DonationStatus, LucideIcon> = {
  new: Sparkles,
  pending: Clock,
  success: CircleCheck,
  failure: CircleX,
};

interface StatusBadgeProps {
  status: DonationStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status];

  if (status === "success") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400",
          className,
        )}
      >
        <Icon />
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
  if (status === "failure") {
    return (
      <Badge variant="destructive" className={className}>
        <Icon />
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="default" className={className}>
        <Icon />
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={className}>
      <Icon />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export { STATUS_LABELS, STATUS_ICONS };
