"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, "type"> & {
  wrapperClassName?: string;
};

export function PasswordInput({ className, wrapperClassName, disabled, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Input
        {...props}
        type={showPassword ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShowPassword((current) => !current)}
        className={cn(
          "absolute inset-y-0 right-0 flex h-10 w-10 items-center justify-center rounded-r-lg text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          disabled ? "cursor-not-allowed opacity-50" : "hover:text-foreground"
        )}
        aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
        aria-pressed={showPassword}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
