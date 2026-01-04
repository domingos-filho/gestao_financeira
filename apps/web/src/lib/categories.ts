import { db, CategoryLocal } from "./db";

type AuthFetch = (path: string, options?: RequestInit) => Promise<Response>;

type CategoryResponse = {
  id: string;
  walletId: string;
  name: string;
  updatedAt?: string;
  createdAt?: string;
};

export async function syncCategories(walletId: string, authFetch: AuthFetch) {
  const res = await authFetch(`/wallets/${walletId}/categories`);
  if (!res.ok) {
    throw new Error("Failed to load categories");
  }

  const data = (await res.json()) as CategoryResponse[];
  const mapped: CategoryLocal[] = data.map((category) => ({
    id: category.id,
    walletId: category.walletId,
    name: category.name,
    updatedAt: category.updatedAt ?? category.createdAt ?? new Date().toISOString()
  }));

  await db.transaction("rw", db.categories_local, async () => {
    await db.categories_local.where("walletId").equals(walletId).delete();
    await db.categories_local.bulkPut(mapped);
  });

  return mapped;
}
