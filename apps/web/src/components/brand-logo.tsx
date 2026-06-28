import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <Image
      src="/icons/logo%20principal.png"
      alt="UniConta"
      width={1230}
      height={369}
      unoptimized
      priority={false}
      className={cn("h-9 w-auto", className)}
    />
  );
}
