import type { LucideIcon } from "lucide-react";
import { BookOpen, Briefcase, Car, Gift, HeartPulse, Home, ShoppingCart, Sparkles, Tag } from "lucide-react";

export type CategoryIconOption = {
  value: string;
  label: string;
  Icon: LucideIcon;
};

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { value: "tag", label: "Geral", Icon: Tag },
  { value: "shopping-cart", label: "Compras", Icon: ShoppingCart },
  { value: "home", label: "Casa", Icon: Home },
  { value: "car", label: "Transporte", Icon: Car },
  { value: "heart-pulse", label: "Saude", Icon: HeartPulse },
  { value: "book-open", label: "Educacao", Icon: BookOpen },
  { value: "gift", label: "Presentes", Icon: Gift },
  { value: "briefcase", label: "Trabalho", Icon: Briefcase },
  { value: "sparkles", label: "Extra", Icon: Sparkles }
];

const CATEGORY_ICON_MAP = new Map(CATEGORY_ICON_OPTIONS.map((option) => [option.value, option.Icon]));

export function getCategoryIcon(value?: string | null): LucideIcon {
  return CATEGORY_ICON_MAP.get(value ?? "") ?? Tag;
}
