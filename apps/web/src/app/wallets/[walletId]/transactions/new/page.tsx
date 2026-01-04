import { TransactionForm } from "@/components/transaction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewTransactionPage({ params }: { params: { walletId: string } }) {
  return (
    <div className="grid gap-6 animate-rise">
      <div>
        <h2 className="text-2xl font-semibold">Nova transacao</h2>
        <p className="text-sm text-muted-foreground">Registre uma nova entrada ou saida.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm walletId={params.walletId} />
        </CardContent>
      </Card>
    </div>
  );
}
