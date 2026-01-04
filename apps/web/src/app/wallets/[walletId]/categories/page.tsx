"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncCategories } from "@/lib/categories";
import { formatDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CategoriesPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const { authFetch } = useAuth();
  const categories = useLiveQuery(
    () => db.categories_local.where("walletId").equals(walletId).toArray(),
    [walletId]
  );

  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    if (!navigator.onLine) return;
    syncCategories(walletId, authFetch).catch(() => null);
  }, [authFetch, walletId]);

  const handleCreate = async () => {
    setMessage(null);
    if (!name.trim()) {
      setMessage("Informe o nome da categoria.");
      return;
    }

    const res = await authFetch(`/wallets/${walletId}/categories`, {
      method: "POST",
      body: JSON.stringify({ name })
    });

    if (!res.ok) {
      setMessage("Nao foi possivel salvar.");
      return;
    }

    const data = (await res.json()) as { id: string; walletId: string; name: string; updatedAt: string };
    await db.categories_local.put({
      id: data.id,
      walletId: data.walletId,
      name: data.name,
      updatedAt: data.updatedAt ?? new Date().toISOString()
    });
    setName("");
    setMessage("Categoria criada.");
  };

  const handleEdit = async (categoryId: string) => {
    if (!editingName.trim()) {
      setMessage("Informe o nome da categoria.");
      return;
    }

    const res = await authFetch(`/wallets/${walletId}/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editingName })
    });

    if (!res.ok) {
      setMessage("Nao foi possivel atualizar.");
      return;
    }

    const data = (await res.json()) as { id: string; walletId: string; name: string; updatedAt: string };
    await db.categories_local.put({
      id: data.id,
      walletId: data.walletId,
      name: data.name,
      updatedAt: data.updatedAt ?? new Date().toISOString()
    });
    setEditingId(null);
    setEditingName("");
    setMessage("Categoria atualizada.");
  };

  return (
    <div className="grid gap-6 animate-rise">
      <div>
        <h1 className="text-2xl font-semibold">Categorias</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas categorias de receitas e despesas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova Categoria</CardTitle>
          <CardDescription>Crie categorias para organizar suas transacoes</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full space-y-2 md:flex-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <Button onClick={handleCreate}>Adicionar</Button>
        </CardContent>
        {message && <CardContent className="pt-0 text-sm text-muted-foreground">{message}</CardContent>}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suas Categorias</CardTitle>
          <CardDescription>Toque para editar uma categoria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(categories ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria.</p>}
          {(categories ?? []).map((category) => (
            <div
              key={category.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              {editingId === category.id ? (
                <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                  <div className="flex gap-2">
                    <Button onClick={() => handleEdit(category.id)}>Salvar</Button>
                    <Button variant="outline" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">Atualizado em {formatDate(category.updatedAt)}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingId(category.id);
                      setEditingName(category.name);
                    }}
                  >
                    Editar
                  </Button>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
