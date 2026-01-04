import { TransactionForm } from "@/components/transaction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EditTransactionPage({
  params
}: {
  params: { walletId: string; id: string };
}) {
  return (
    <Card className="border-border/60 bg-card/85">
      <CardHeader>
        <CardTitle>Editar transacao</CardTitle>
      </CardHeader>
      <CardContent>
        <TransactionForm walletId={params.walletId} transactionId={params.id} />
      </CardContent>
    </Card>
  );
}
