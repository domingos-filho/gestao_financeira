import { CategoryType } from "@gf/shared";

export type DefaultCategorySeed = {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  sortOrder: number;
};

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { name: "Salario", type: CategoryType.INCOME, color: "#11cc95", icon: "briefcase", sortOrder: 1 },
  { name: "Renda extra", type: CategoryType.INCOME, color: "#4fa2ff", icon: "sparkles", sortOrder: 2 },
  { name: "Presentes", type: CategoryType.INCOME, color: "#fca55a", icon: "gift", sortOrder: 3 },
  { name: "Mercado", type: CategoryType.EXPENSE, color: "#e96878", icon: "shopping-cart", sortOrder: 1 },
  { name: "Moradia", type: CategoryType.EXPENSE, color: "#6b5b95", icon: "home", sortOrder: 2 },
  { name: "Transporte", type: CategoryType.EXPENSE, color: "#4fa2ff", icon: "car", sortOrder: 3 },
  { name: "Saude", type: CategoryType.EXPENSE, color: "#11cc95", icon: "heart-pulse", sortOrder: 4 },
  { name: "Educacao", type: CategoryType.EXPENSE, color: "#fca55a", icon: "book-open", sortOrder: 5 }
];
