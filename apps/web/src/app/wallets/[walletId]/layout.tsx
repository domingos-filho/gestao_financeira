import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";

export default function WalletLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { walletId: string };
}) {
  return (
    <RequireAuth>
      <AppShell walletId={params.walletId}>{children}</AppShell>
    </RequireAuth>
  );
}
