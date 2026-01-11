import { CategoryType } from "@gf/shared";
import { db, CategoryLocal } from "./db";

type AuthFetch = (path: string, options?: RequestInit) => Promise<Response>;

type CategoryResponse = {
  id: string;
  walletId: string;
  name: string;
  type: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
  archivedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

export async function syncCategories(walletId: string, authFetch: AuthFetch) {
  const res = await authFetch(`/wallets/${walletId}/categories`);
  if (!res.ok) {
    throw new Error("Failed to load categories");
  }

  const data = (await res.json()) as CategoryResponse[];
  const mapped: CategoryLocal[] = data.map((category) => {
    const nextType = category.type === CategoryType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
    return {
      id: category.id,
      walletId: category.walletId,
      name: category.name,
      type: nextType,
      color: category.color ?? "#4fa2ff",
      icon: category.icon ?? "tag",
      sortOrder: category.sortOrder ?? 0,
      archivedAt: category.archivedAt ?? null,
      updatedAt: category.updatedAt ?? category.createdAt ?? new Date().toISOString()
    };
  });

  await db.transaction("rw", db.categories_local, async () => {
    await db.categories_local.where("walletId").equals(walletId).delete();
    await db.categories_local.bulkPut(mapped);
  });

  return mapped;
}
