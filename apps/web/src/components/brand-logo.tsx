import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  variant?: "solid" | "outline";
};

export function BrandMark({ className, variant = "solid" }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-2xl",
        variant === "outline" ? "bg-card ring-1 ring-border" : "bg-transparent",
        className
      )}
    >
      <img src="/icons/logo.png" alt="FinanceFlow" className="h-9 w-9 rounded-2xl" />
    </span>
  );
}
