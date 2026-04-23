import { Suspense } from "react";
import { HandHeart, Loader2 } from "lucide-react";

import { DonationsTable } from "@/components/donations-table";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
        <header className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <HandHeart
              className="size-6 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            Donations Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Review recent donations and move them through their lifecycle.
          </p>
        </header>
        <Suspense
          fallback={
            <div className="flex items-center gap-2 rounded-md border p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading donations…
            </div>
          }
        >
          <DonationsTable />
        </Suspense>
      </main>
    </div>
  );
}
