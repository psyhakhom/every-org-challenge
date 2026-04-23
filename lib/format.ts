/**
 * Format a cent-valued integer amount into a human-readable currency string.
 * e.g. formatAmount(5000, "USD") -> "$50.00"
 */
export function formatAmount(cents: number, currency: "USD"): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(dollars);
}

/**
 * Format an ISO timestamp into a human-readable date+time string.
 * e.g. formatDateTime("2026-01-15T15:00:00.000Z") -> "Jan 15, 2026, 10:00 AM"
 *
 * Falls back to the raw string if the input can't be parsed.
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
