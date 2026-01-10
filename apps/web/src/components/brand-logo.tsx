import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      src="/icons/logo%20principal.png"
      alt="UniConta"
      className={cn("h-9 w-auto", className)}
    />
  );
}
