import { WalletNav } from "@/components/wallet-nav";
import { SyncIndicator } from "@/components/sync-indicator";
import { RequireAuth } from "@/components/require-auth";

export default function WalletLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { walletId: string };
}) {
  return (
    <RequireAuth>
      <div className="min-h-screen px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Carteira</p>
                <h1 className="text-2xl font-semibold">Resumo financeiro</h1>
              </div>
              <SyncIndicator walletId={params.walletId} />
            </div>
            <WalletNav walletId={params.walletId} />
          </header>
          <main>{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
