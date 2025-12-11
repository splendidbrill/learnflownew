"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none";

    const variants: Record<string, string> = {
      default: "",
      outline: "border",
      ghost: "",
      link: ""
    };

    const sizes: Record<string, string> = {
      default: "",
      sm: "",
      lg: "",
      icon: ""
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant ?? "default"],
          sizes[size ?? "default"],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
