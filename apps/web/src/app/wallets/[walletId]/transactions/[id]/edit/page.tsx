import { TransactionForm } from "@/components/transaction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EditTransactionPage({
  params
}: {
  params: { walletId: string; id: string };
}) {
  return (
    <div className="grid gap-6 animate-rise">
      <div>
        <h2 className="text-2xl font-semibold">Editar transacao</h2>
        <p className="text-sm text-muted-foreground">Atualize os detalhes da transacao.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm walletId={params.walletId} transactionId={params.id} />
        </CardContent>
      </Card>
    </div>
  );
}
