import {
  type Donation,
  type DonationStatus,
  isValidTransition,
} from "@/lib/types";

const SEED_DONATIONS: Donation[] = [
  {
    uuid: "354362d8-2080-4ca1-9ede-892e4c6d3a25",
    amount: 5000,
    currency: "USD",
    paymentMethod: "cc",
    nonprofitId: "org1",
    donorId: "donor_01",
    status: "new",
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  },
  {
    uuid: "385cf5cb-9d0a-4f9e-948b-412791755060",
    amount: 10000,
    currency: "USD",
    paymentMethod: "ach",
    nonprofitId: "org2",
    donorId: "donor_02",
    status: "new",
    createdAt: "2026-01-15T10:05:00Z",
    updatedAt: "2026-01-15T10:05:00Z",
  },
  {
    uuid: "86f1c108-102b-447a-9efe-67c2f3b594d8",
    amount: 25000,
    currency: "USD",
    paymentMethod: "crypto",
    nonprofitId: "org1",
    donorId: "donor_03",
    status: "pending",
    createdAt: "2026-01-15T10:10:00Z",
    updatedAt: "2026-01-15T10:12:34Z",
  },
  {
    uuid: "c9b7c4c1-2ca7-465c-bf34-2a80ee7534eb",
    amount: 1500,
    currency: "USD",
    paymentMethod: "venmo",
    nonprofitId: "org3",
    donorId: "donor_04",
    status: "pending",
    createdAt: "2026-01-15T10:15:00Z",
    updatedAt: "2026-01-15T10:17:08Z",
  },
  {
    uuid: "73aff4cc-135d-4840-96b2-9210639528c8",
    amount: 7500,
    currency: "USD",
    paymentMethod: "cc",
    nonprofitId: "org2",
    donorId: "donor_05",
    status: "success",
    createdAt: "2026-01-15T10:20:00Z",
    updatedAt: "2026-01-15T10:21:47Z",
  },
  {
    uuid: "7b789658-cb91-4ae6-bbb6-5cb90a1b1942",
    amount: 3000,
    currency: "USD",
    paymentMethod: "ach",
    nonprofitId: "org3",
    donorId: "donor_06",
    status: "failure",
    createdAt: "2026-01-15T10:25:00Z",
    updatedAt: "2026-01-15T10:43:22Z",
  },
  {
    uuid: "4619db6e-5ddf-4900-9da2-17e55e400ca4",
    amount: 15000,
    currency: "USD",
    paymentMethod: "crypto",
    nonprofitId: "org1",
    donorId: "donor_07",
    status: "new",
    createdAt: "2026-01-15T10:30:00Z",
    updatedAt: "2026-01-15T10:30:00Z",
  },
  {
    uuid: "49ce76af-3134-40e3-99d6-b6e3d7e51de5",
    amount: 20000,
    currency: "USD",
    paymentMethod: "venmo",
    nonprofitId: "org2",
    donorId: "donor_08",
    status: "pending",
    createdAt: "2026-01-15T10:35:00Z",
    updatedAt: "2026-01-15T10:38:51Z",
  },
];

// HMR-safe singleton: attach the Map to globalThis so it survives Next.js
// module reloads during development. Using a Symbol avoids collisions with
// other globals.
const STORE_KEY = Symbol.for("every-org-challenge.donationStore");

type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: Map<string, Donation>;
};

function seed(map: Map<string, Donation>): void {
  map.clear();
  for (const d of SEED_DONATIONS) {
    // Store a shallow copy so external mutation of the seed objects
    // cannot corrupt our state.
    map.set(d.uuid, { ...d });
  }
}

function getStore(): Map<string, Donation> {
  const g = globalThis as GlobalWithStore;
  let existing = g[STORE_KEY];
  if (!existing) {
    existing = new Map<string, Donation>();
    seed(existing);
    g[STORE_KEY] = existing;
  }
  return existing;
}

export function listDonations(): Donation[] {
  return Array.from(getStore().values()).map((d) => ({ ...d }));
}

export function getDonation(uuid: string): Donation | undefined {
  const found = getStore().get(uuid);
  return found ? { ...found } : undefined;
}

export function createDonation(
  d: Donation,
):
  | { ok: true; donation: Donation }
  | { ok: false; reason: "duplicate" } {
  const store = getStore();
  if (store.has(d.uuid)) {
    return { ok: false, reason: "duplicate" };
  }
  const stored: Donation = { ...d };
  store.set(stored.uuid, stored);
  return { ok: true, donation: { ...stored } };
}

export function updateDonationStatus(
  uuid: string,
  newStatus: DonationStatus,
):
  | { ok: true; donation: Donation }
  | { ok: false; reason: "not_found" | "invalid_transition" | "same_status" } {
  const store = getStore();
  const existing = store.get(uuid);
  if (!existing) {
    return { ok: false, reason: "not_found" };
  }
  if (existing.status === newStatus) {
    return { ok: false, reason: "same_status" };
  }
  if (!isValidTransition(existing.status, newStatus)) {
    return { ok: false, reason: "invalid_transition" };
  }
  const updated: Donation = {
    ...existing,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
  store.set(uuid, updated);
  return { ok: true, donation: { ...updated } };
}

export function resetStore(): void {
  seed(getStore());
}
