import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { WalletAccessGate } from "../src/components/wallet-access-gate";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock
  })
}));

vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "fadomingosf@gmail.com",
      name: "Administrador",
      role: "ADMIN"
    },
    loading: false
  })
}));

vi.mock("../src/lib/wallets", () => ({
  useWallets: () => ({
    data: [],
    isLoading: false
  })
}));

vi.mock("../src/components/require-auth", () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("../src/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>
}));

describe("WalletAccessGate", () => {
  it("keeps the admin on the wallet page even when the wallet is not in the member cache", () => {
    render(
      <WalletAccessGate walletId="wallet-1">
        <div>conteudo protegido</div>
      </WalletAccessGate>
    );

    expect(screen.getByText("conteudo protegido")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
