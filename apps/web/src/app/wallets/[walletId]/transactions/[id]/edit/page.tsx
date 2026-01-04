import { TransactionForm } from "@/components/transaction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EditTransactionPage({
  params
}: {
  params: { walletId: string; id: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar transacao</CardTitle>
      </CardHeader>
      <CardContent>
        <TransactionForm walletId={params.walletId} transactionId={params.id} />
      </CardContent>
    </Card>
  );
}
