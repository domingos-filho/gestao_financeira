import { TransactionForm } from "@/components/transaction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EditTransactionPage({
  params
}: {
  params: { walletId: string; id: string };
}) {
  return (
    <div className="grid gap-4 sm:gap-6 animate-rise">
      <div>
        <h2 className="text-xl font-semibold sm:text-2xl">Editar transacao</h2>
        <p className="text-sm text-muted-foreground">Atualize os detalhes da transacao.</p>
      </div>
      <Card>
        <CardHeader className="p-4 sm:p-5">
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <TransactionForm walletId={params.walletId} transactionId={params.id} />
        </CardContent>
      </Card>
    </div>
  );
}
