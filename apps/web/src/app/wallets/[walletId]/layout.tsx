import { WalletAccessGate } from "@/components/wallet-access-gate";

export default function WalletLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { walletId: string };
}) {
  return <WalletAccessGate walletId={params.walletId}>{children}</WalletAccessGate>;
}
