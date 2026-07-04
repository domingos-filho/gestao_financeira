import { TransactionForm } from "@/components/transaction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewTransactionPage({ params }: { params: { walletId: string } }) {
  return (
    <div className="grid gap-4 sm:gap-6 animate-rise">
      <div>
        <h2 className="text-xl font-semibold sm:text-2xl">Nova transacao</h2>
        <p className="text-sm text-muted-foreground">Registre uma nova entrada ou saida.</p>
      </div>
      <Card>
        <CardHeader className="p-4 sm:p-5">
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <TransactionForm walletId={params.walletId} />
        </CardContent>
      </Card>
    </div>
  );
}
