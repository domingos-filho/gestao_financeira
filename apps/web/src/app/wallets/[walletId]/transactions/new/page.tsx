import { TransactionForm } from "@/components/transaction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewTransactionPage({ params }: { params: { walletId: string } }) {
  return (
    <Card className="border-border/60 bg-card/85">
      <CardHeader>
        <CardTitle>Nova transacao</CardTitle>
      </CardHeader>
      <CardContent>
        <TransactionForm walletId={params.walletId} />
      </CardContent>
    </Card>
  );
}
