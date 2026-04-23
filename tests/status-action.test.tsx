import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Donation, DonationStatus } from "@/lib/types";

const updateDonationStatusMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  updateDonationStatus: (...args: unknown[]) =>
    updateDonationStatusMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

// Import AFTER the mocks so StatusAction wires up to the mocks.
import { StatusAction } from "@/components/status-action";

function makeDonation(status: DonationStatus): Donation {
  return {
    uuid: "test-uuid",
    amount: 1000,
    currency: "USD",
    paymentMethod: "cc",
    nonprofitId: "org1",
    donorId: "donor1",
    status,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  };
}

describe("<StatusAction />", () => {
  beforeEach(() => {
    updateDonationStatusMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  test("terminal status success — renders em dash, no button/menu", () => {
    render(
      <StatusAction donation={makeDonation("success")} onUpdated={() => {}} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("terminal status failure — renders em dash, no button/menu", () => {
    render(
      <StatusAction donation={makeDonation("failure")} onUpdated={() => {}} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("status new — renders single Button matching /mark pending/i", () => {
    render(
      <StatusAction donation={makeDonation("new")} onUpdated={() => {}} />,
    );
    const btn = screen.getByRole("button", { name: /mark pending/i });
    expect(btn).toBeInTheDocument();
    // No dropdown-update-status button.
    expect(
      screen.queryByRole("button", { name: /update status/i }),
    ).not.toBeInTheDocument();
  });

  test("status new — clicking the button calls updateDonationStatus with 'pending'", async () => {
    const user = userEvent.setup();
    const donation = makeDonation("new");
    const updated = { ...donation, status: "pending" as DonationStatus };
    updateDonationStatusMock.mockResolvedValue(updated);
    const onUpdated = vi.fn();

    render(<StatusAction donation={donation} onUpdated={onUpdated} />);
    await user.click(screen.getByRole("button", { name: /mark pending/i }));

    await waitFor(() => {
      expect(updateDonationStatusMock).toHaveBeenCalledWith(
        "test-uuid",
        "pending",
      );
    });
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(updated);
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalled();
    });
  });

  test("status pending — renders /update status/i trigger, menu reveals success + failure options, clicking 'Mark success' calls API + onUpdated + toast", async () => {
    const user = userEvent.setup();
    const donation = makeDonation("pending");
    const updated = { ...donation, status: "success" as DonationStatus };
    updateDonationStatusMock.mockResolvedValue(updated);
    const onUpdated = vi.fn();

    render(<StatusAction donation={donation} onUpdated={onUpdated} />);

    const trigger = screen.getByRole("button", { name: /update status/i });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);

    // Both options appear after opening the menu.
    const markSuccess = await screen.findByText(/mark success/i);
    const markFailure = await screen.findByText(/mark failure/i);
    expect(markSuccess).toBeInTheDocument();
    expect(markFailure).toBeInTheDocument();

    await user.click(markSuccess);

    await waitFor(() => {
      expect(updateDonationStatusMock).toHaveBeenCalledWith(
        "test-uuid",
        "success",
      );
    });
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(updated);
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalled();
    });
  });

  test("on API error — toast.error called with message, onError invoked, onUpdated NOT called", async () => {
    const user = userEvent.setup();
    const donation = makeDonation("new");
    const boom = new Error("boom");
    updateDonationStatusMock.mockRejectedValue(boom);
    const onUpdated = vi.fn();
    const onError = vi.fn();

    render(
      <StatusAction
        donation={donation}
        onUpdated={onUpdated}
        onError={onError}
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark pending/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("boom");
    });
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(boom);
    });
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
