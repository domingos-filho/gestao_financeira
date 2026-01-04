import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  variant?: "solid" | "soft";
};

export function BrandMark({ className, variant = "solid" }: BrandMarkProps) {
  const palette =
    variant === "soft"
      ? {
          bg: "var(--color-card)",
          ring: "var(--color-primary)",
          accent: "var(--color-accent)",
          heart: "var(--color-primary)"
        }
      : {
          bg: "var(--color-primary)",
          ring: "var(--color-primary-fg)",
          accent: "var(--color-accent)",
          heart: "var(--color-primary-fg)"
        };

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Gestao Financeira"
      className={cn("h-12 w-12", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="18" fill={palette.bg} />
      <circle cx="32" cy="32" r="22" fill="none" stroke={palette.ring} strokeWidth="3.5" />
      <circle cx="25" cy="32" r="10.5" fill="none" stroke={palette.accent} strokeWidth="3.5" />
      <circle cx="39" cy="32" r="10.5" fill="none" stroke={palette.accent} strokeWidth="3.5" />
      <path
        d="M32 40c-6-4-10-8-10-13a6.5 6.5 0 0 1 10-5a6.5 6.5 0 0 1 10 5c0 5-4 9-10 13z"
        fill={palette.heart}
      />
    </svg>
  );
}
