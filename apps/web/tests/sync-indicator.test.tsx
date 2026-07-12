import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SyncIndicator } from "../src/components/sync-indicator";

describe("SyncIndicator", () => {
  it("shows the last sync timestamp and success state", () => {
    const lastSyncAt = "2026-07-12T10:15:00";
    const formatted = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(lastSyncAt));

    const { container } = render(
      <SyncIndicator
        status="idle"
        lastSyncAt={lastSyncAt}
        lastSyncResult="success"
        runSync={vi.fn()}
        compact
      />
    );

    expect(screen.getByText((content) => content.includes(formatted))).toBeInTheDocument();
    expect(container.querySelector('[data-sync-result="success"]')).toBeInTheDocument();
  });

  it("shows an error state and spins the sync button while syncing", () => {
    const { container } = render(
      <SyncIndicator
        status="syncing"
        lastSyncAt="2026-07-12T10:15:00"
        lastSyncResult="error"
        runSync={vi.fn()}
        compact
      />
    );

    expect(container.querySelector('[data-sync-result="error"]')).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /sincronizar/i });
    const icon = button.querySelector("svg");
    expect(icon).toHaveClass("animate-spin");
  });
});
