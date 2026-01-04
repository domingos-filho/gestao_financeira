import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  variant?: "solid" | "outline";
};

export function BrandMark({ className, variant = "solid" }: BrandMarkProps) {
  const palette =
    variant === "outline"
      ? {
          bg: "#ffffff",
          border: "#22c55e",
          mark: "#22c55e"
        }
      : {
          bg: "#22c55e",
          border: "#22c55e",
          mark: "#ffffff"
        };

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="FinanceFlow"
      className={cn("h-10 w-10", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="16" fill={palette.bg} stroke={palette.border} strokeWidth="2" />
      <rect x="25" y="16" width="8" height="32" rx="4" fill={palette.mark} />
      <rect x="25" y="16" width="18" height="8" rx="4" fill={palette.mark} />
      <rect x="25" y="30" width="14" height="8" rx="4" fill={palette.mark} />
    </svg>
  );
}
