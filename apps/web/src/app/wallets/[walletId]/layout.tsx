import { WalletNav } from "@/components/wallet-nav";
import { SyncIndicator } from "@/components/sync-indicator";
import { RequireAuth } from "@/components/require-auth";
import { BrandMark } from "@/components/brand-logo";

export default function WalletLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { walletId: string };
}) {
  return (
    <RequireAuth>
      <div className="min-h-screen px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header className="flex flex-col gap-6 rounded-[28px] border border-border/70 bg-card/85 p-6 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <BrandMark variant="soft" className="h-12 w-12" />
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Carteira</p>
                  <h1 className="text-2xl font-semibold">Resumo financeiro</h1>
                </div>
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
