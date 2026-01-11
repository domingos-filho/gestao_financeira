"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CategoryType } from "@gf/shared";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { CategoryLocal, db, safeDexie } from "@/lib/db";
import { syncCategories } from "@/lib/categories";
import { formatDate } from "@/lib/date";
import { CATEGORY_ICON_OPTIONS, getCategoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const colorOptions = [
  { value: "#e96878", label: "Rosa" },
  { value: "#fca55a", label: "Laranja" },
  { value: "#4fa2ff", label: "Azul" },
  { value: "#11cc95", label: "Verde" },
  { value: "#ffd348", label: "Amarelo" },
  { value: "#6b5b95", label: "Roxo" }
];

const defaultColorByType: Record<CategoryType, string> = {
  [CategoryType.EXPENSE]: "#e96878",
  [CategoryType.INCOME]: "#11cc95"
};

const typeLabels: Record<CategoryType, string> = {
  [CategoryType.EXPENSE]: "Despesa",
  [CategoryType.INCOME]: "Receita"
};

function sortCategories(list: CategoryLocal[]) {
  return [...list].sort((a, b) => {
    const sortA = a.sortOrder ?? 0;
    const sortB = b.sortOrder ?? 0;
    if (sortA !== sortB) {
      return sortA - sortB;
    }
    return a.name.localeCompare(b.name);
  });
}

function mapErrorMessage(raw?: string) {
  if (!raw) return null;
  const known: Record<string, string> = {
    "Category already exists": "Categoria ja existe.",
    "Category not found": "Categoria nao encontrada.",
    "Target category not found": "Categoria de destino nao encontrada.",
    "Wallet not found": "Carteira nao encontrada."
  };
  return known[raw] ?? raw;
}

async function getErrorMessage(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) {
      return mapErrorMessage(payload.message.join(", ")) ?? fallback;
    }
    if (typeof payload.message === "string") {
      return mapErrorMessage(payload.message) ?? fallback;
    }
  } catch {
    // ignore parsing errors
  }
  return fallback;
}

function toLocalCategory(data: {
  id: string;
  walletId: string;
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
  sortOrder?: number;
  archivedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
}): CategoryLocal {
  return {
    id: data.id,
    walletId: data.walletId,
    name: data.name,
    type: data.type,
    color: data.color ?? defaultColorByType[data.type],
    icon: data.icon ?? "tag",
    sortOrder: data.sortOrder ?? 0,
    archivedAt: data.archivedAt ?? null,
    updatedAt: data.updatedAt ?? data.createdAt ?? new Date().toISOString()
  };
}

export default function CategoriesPage({ params }: { params: { walletId: string } }) {
  const { walletId } = params;
  const { authFetch } = useAuth();
  const categories = useLiveQuery(
    () => safeDexie(() => db.categories_local.where("walletId").equals(walletId).toArray(), []),
    [walletId]
  );

  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>(CategoryType.EXPENSE);
  const [color, setColor] = useState(defaultColorByType[CategoryType.EXPENSE]);
  const [icon, setIcon] = useState("tag");
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingType, setEditingType] = useState<CategoryType>(CategoryType.EXPENSE);
  const [editingColor, setEditingColor] = useState(defaultColorByType[CategoryType.EXPENSE]);
  const [editingIcon, setEditingIcon] = useState("tag");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [seedLoading, setSeedLoading] = useState(false);

  useEffect(() => {
    if (!navigator.onLine) return;
    syncCategories(walletId, authFetch).catch(() => null);
  }, [authFetch, walletId]);

  const activeByType = useMemo(() => {
    const active = (categories ?? []).filter((category) => !category.archivedAt);
    return {
      [CategoryType.EXPENSE]: sortCategories(active.filter((category) => category.type === CategoryType.EXPENSE)),
      [CategoryType.INCOME]: sortCategories(active.filter((category) => category.type === CategoryType.INCOME))
    };
  }, [categories]);

  const archivedCategories = useMemo(() => {
    const archived = (categories ?? []).filter((category) => category.archivedAt);
    return sortCategories(archived);
  }, [categories]);

  const hasAnyCategories = (categories ?? []).length > 0;

  const handleTypeChange = (nextType: CategoryType) => {
    if (color === defaultColorByType[type]) {
      setColor(defaultColorByType[nextType]);
    }
    setType(nextType);
  };

  const handleEditTypeChange = (nextType: CategoryType) => {
    if (editingColor === defaultColorByType[editingType]) {
      setEditingColor(defaultColorByType[nextType]);
    }
    setEditingType(nextType);
  };

  const handleCreate = async () => {
    setMessage(null);
    if (!name.trim()) {
      setMessage("Informe o nome da categoria.");
      return;
    }

    const res = await authFetch(`/wallets/${walletId}/categories`, {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        type,
        color,
        icon
      })
    });

    if (!res.ok) {
      setMessage(await getErrorMessage(res, "Nao foi possivel salvar."));
      return;
    }

    const data = (await res.json()) as {
      id: string;
      walletId: string;
      name: string;
      type: CategoryType;
      color?: string;
      icon?: string;
      sortOrder?: number;
      archivedAt?: string | null;
      updatedAt?: string;
      createdAt?: string;
    };
    await db.categories_local.put(toLocalCategory(data));
    setName("");
    setMessage("Categoria criada.");
  };

  const startEdit = (category: CategoryLocal) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setEditingType(category.type);
    setEditingColor(category.color ?? defaultColorByType[category.type]);
    setEditingIcon(category.icon ?? "tag");
    setDeleteId(null);
    setDeleteTargetId("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingType(CategoryType.EXPENSE);
    setEditingColor(defaultColorByType[CategoryType.EXPENSE]);
    setEditingIcon("tag");
  };

  const handleEdit = async (category: CategoryLocal) => {
    if (!editingId) return;
    setMessage(null);
    if (!editingName.trim()) {
      setMessage("Informe o nome da categoria.");
      return;
    }

    setBusyId(category.id);
    const res = await authFetch(`/wallets/${walletId}/categories/${category.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editingName.trim(),
        type: editingType,
        color: editingColor,
        icon: editingIcon
      })
    });
    setBusyId(null);

    if (!res.ok) {
      setMessage(await getErrorMessage(res, "Nao foi possivel atualizar."));
      return;
    }

    const data = (await res.json()) as {
      id: string;
      walletId: string;
      name: string;
      type: CategoryType;
      color?: string;
      icon?: string;
      sortOrder?: number;
      archivedAt?: string | null;
      updatedAt?: string;
      createdAt?: string;
    };
    await db.categories_local.put(toLocalCategory(data));
    cancelEdit();
    setMessage("Categoria atualizada.");
  };

  const handleArchive = async (category: CategoryLocal, archived: boolean) => {
    setMessage(null);
    setBusyId(category.id);
    const res = await authFetch(`/wallets/${walletId}/categories/${category.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived })
    });
    setBusyId(null);

    if (!res.ok) {
      setMessage(await getErrorMessage(res, "Nao foi possivel atualizar."));
      return;
    }

    const data = (await res.json()) as {
      id: string;
      walletId: string;
      name: string;
      type: CategoryType;
      color?: string;
      icon?: string;
      sortOrder?: number;
      archivedAt?: string | null;
      updatedAt?: string;
      createdAt?: string;
    };
    await db.categories_local.put(toLocalCategory(data));
    setMessage(archived ? "Categoria arquivada." : "Categoria restaurada.");
  };

  const handleMove = async (category: CategoryLocal, direction: -1 | 1) => {
    const list = activeByType[category.type];
    const index = list.findIndex((item) => item.id === category.id);
    const target = list[index + direction];
    if (!target) return;

    setMessage(null);
    setBusyId(category.id);
    const resA = await authFetch(`/wallets/${walletId}/categories/${category.id}`, {
      method: "PATCH",
      body: JSON.stringify({ sortOrder: target.sortOrder })
    });
    const resB = await authFetch(`/wallets/${walletId}/categories/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({ sortOrder: category.sortOrder })
    });
    setBusyId(null);

    if (!resA.ok || !resB.ok) {
      setMessage("Nao foi possivel reordenar.");
      return;
    }

    await db.categories_local.put({ ...category, sortOrder: target.sortOrder, updatedAt: new Date().toISOString() });
    await db.categories_local.put({ ...target, sortOrder: category.sortOrder, updatedAt: new Date().toISOString() });
  };

  const handleDelete = async (category: CategoryLocal) => {
    setMessage(null);
    setBusyId(category.id);
    const res = await authFetch(`/wallets/${walletId}/categories/${category.id}`, {
      method: "DELETE",
      body: JSON.stringify({ reassignTo: deleteTargetId || null })
    });
    setBusyId(null);

    if (!res.ok) {
      setMessage(await getErrorMessage(res, "Nao foi possivel excluir."));
      return;
    }

    await db.categories_local.delete(category.id);
    await db.transactions_local
      .where("walletId")
      .equals(walletId)
      .and((tx) => tx.categoryId === category.id)
      .modify({ categoryId: deleteTargetId || null, updatedAt: new Date().toISOString() });

    setDeleteId(null);
    setDeleteTargetId("");
    setMessage("Categoria excluida.");
  };

  const handleSeedDefaults = async () => {
    setMessage(null);
    setSeedLoading(true);
    const res = await authFetch(`/wallets/${walletId}/categories/seed`, { method: "POST" });
    setSeedLoading(false);

    if (!res.ok) {
      setMessage(await getErrorMessage(res, "Nao foi possivel criar categorias padrao."));
      return;
    }

    await syncCategories(walletId, authFetch).catch(() => null);
    setMessage("Categorias padrao criadas.");
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
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="flex flex-wrap gap-2">
                {[CategoryType.EXPENSE, CategoryType.INCOME].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`rounded-full border px-4 py-1 text-xs font-semibold ${
                      type === option
                        ? "border-transparent bg-primary text-primaryForeground"
                        : "border-border text-muted-foreground"
                    }`}
                    onClick={() => handleTypeChange(option)}
                  >
                    {typeLabels[option]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icone</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICON_OPTIONS.map((option) => {
                const Icon = option.Icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                      icon === option.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                    onClick={() => setIcon(option.value)}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 ${
                    color === option.value ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: option.value }}
                  onClick={() => setColor(option.value)}
                  aria-label={option.label}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleCreate}>Adicionar</Button>
            {message && <span className="text-sm text-muted-foreground">{message}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suas Categorias</CardTitle>
          <CardDescription>Organize, edite, arquive e reordene categorias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasAnyCategories && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
              <Button variant="outline" onClick={handleSeedDefaults} disabled={seedLoading}>
                {seedLoading ? "Criando..." : "Gerar categorias padrao"}
              </Button>
            </div>
          )}

          {hasAnyCategories && (
            <>
              {[CategoryType.EXPENSE, CategoryType.INCOME].map((groupType) => (
                <div key={groupType} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{typeLabels[groupType]}</h3>
                    <span className="text-xs text-muted-foreground">{activeByType[groupType].length} itens</span>
                  </div>
                  {activeByType[groupType].length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria ativa.</p>
                  )}
                  {activeByType[groupType].map((category) => {
                    const Icon = getCategoryIcon(category.icon);
                    const displayColor = category.color ?? defaultColorByType[category.type];
                    const isEditing = editingId === category.id;
                    const isBusy = busyId === category.id;
                    const list = activeByType[groupType];
                    const index = list.findIndex((item) => item.id === category.id);
                    const canMoveUp = index > 0;
                    const canMoveDown = index < list.length - 1;
                    const showDelete = deleteId === category.id;
                    const reassignOptions = list.filter((item) => item.id !== category.id);

                    return (
                      <div
                        key={category.id}
                        className="rounded-lg border border-border bg-card px-4 py-3"
                      >
                        {isEditing ? (
                          <div className="grid gap-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>Tipo</Label>
                                <div className="flex flex-wrap gap-2">
                                  {[CategoryType.EXPENSE, CategoryType.INCOME].map((option) => (
                                    <button
                                      key={option}
                                      type="button"
                                      className={`rounded-full border px-4 py-1 text-xs font-semibold ${
                                        editingType === option
                                          ? "border-transparent bg-primary text-primaryForeground"
                                          : "border-border text-muted-foreground"
                                      }`}
                                      onClick={() => handleEditTypeChange(option)}
                                    >
                                      {typeLabels[option]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Icone</Label>
                              <div className="flex flex-wrap gap-2">
                                {CATEGORY_ICON_OPTIONS.map((option) => {
                                  const IconOption = option.Icon;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                                        editingIcon === option.value
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border text-muted-foreground"
                                      }`}
                                      onClick={() => setEditingIcon(option.value)}
                                      aria-label={option.label}
                                      title={option.label}
                                    >
                                      <IconOption className="h-4 w-4" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Cor</Label>
                              <div className="flex flex-wrap gap-2">
                                {colorOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    className={`h-8 w-8 rounded-full border-2 ${
                                      editingColor === option.value ? "border-foreground" : "border-transparent"
                                    }`}
                                    style={{ backgroundColor: option.value }}
                                    onClick={() => setEditingColor(option.value)}
                                    aria-label={option.label}
                                    title={option.label}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button onClick={() => handleEdit(category)} disabled={isBusy}>
                                Salvar
                              </Button>
                              <Button variant="outline" onClick={cancelEdit} disabled={isBusy}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <span
                                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                                  style={{ backgroundColor: `${displayColor}1A`, color: displayColor }}
                                >
                                  <Icon className="h-4 w-4" />
                                </span>
                                <div>
                                  <p className="font-medium">{category.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Atualizado em {formatDate(category.updatedAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  variant="ghost"
                                  onClick={() => handleMove(category, -1)}
                                  disabled={isBusy || !canMoveUp}
                                  aria-label="Mover acima"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => handleMove(category, 1)}
                                  disabled={isBusy || !canMoveDown}
                                  aria-label="Mover abaixo"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" onClick={() => startEdit(category)} disabled={isBusy}>
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => handleArchive(category, true)}
                                  disabled={isBusy}
                                >
                                  <Archive className="h-4 w-4" />
                                  <span className="sr-only">Arquivar</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setDeleteId(category.id);
                                    setDeleteTargetId("");
                                  }}
                                  disabled={isBusy}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Excluir</span>
                                </Button>
                              </div>
                            </div>

                            {showDelete && (
                              <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm">
                                <p className="font-medium">Reatribuir transacoes?</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Escolha uma categoria ou mova para Sem categoria.
                                </p>
                                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                                  <select
                                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 md:max-w-xs"
                                    value={deleteTargetId}
                                    onChange={(event) => setDeleteTargetId(event.target.value)}
                                  >
                                    <option value="">Sem categoria</option>
                                    {reassignOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.name}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="ghost"
                                      onClick={() => handleDelete(category)}
                                      disabled={isBusy}
                                    >
                                      Confirmar exclusao
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setDeleteId(null);
                                        setDeleteTargetId("");
                                      }}
                                      disabled={isBusy}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {archivedCategories.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Arquivadas</h3>
                    <span className="text-xs text-muted-foreground">{archivedCategories.length} itens</span>
                  </div>
                  {archivedCategories.map((category) => {
                    const Icon = getCategoryIcon(category.icon);
                    const displayColor = category.color ?? defaultColorByType[category.type];
                    const isBusy = busyId === category.id;
                    const showDelete = deleteId === category.id;
                    const reassignOptions = activeByType[category.type];
                    return (
                      <div
                        key={category.id}
                        className="rounded-lg border border-border bg-card px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-10 w-10 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${displayColor}1A`, color: displayColor }}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-medium">{category.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Arquivada em {formatDate(category.archivedAt ?? category.updatedAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() => handleArchive(category, false)}
                              disabled={isBusy}
                            >
                              <ArchiveRestore className="h-4 w-4" />
                              Restaurar
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setDeleteId(category.id);
                                setDeleteTargetId("");
                              }}
                              disabled={isBusy}
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </Button>
                          </div>
                        </div>

                        {showDelete && (
                          <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm">
                            <p className="font-medium">Reatribuir transacoes?</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Escolha uma categoria ou mova para Sem categoria.
                            </p>
                            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                              <select
                                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 md:max-w-xs"
                                value={deleteTargetId}
                                onChange={(event) => setDeleteTargetId(event.target.value)}
                              >
                                <option value="">Sem categoria</option>
                                {reassignOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="ghost"
                                  onClick={() => handleDelete(category)}
                                  disabled={isBusy}
                                >
                                  Confirmar exclusao
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setDeleteId(null);
                                    setDeleteTargetId("");
                                  }}
                                  disabled={isBusy}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
