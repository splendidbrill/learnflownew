"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      default: "",
      outline: "border",
      ghost: "",
      link: "",
    };
    
    const sizes = {
      default: "",
      sm: "",
      lg: "",
      icon: "",
    };

    const variantClass = variant ? variants[variant] : "";
    const sizeClass = size ? sizes[size] : "";
    
    return (
      <button
        className={cn(baseStyles, variantClass, sizeClass, className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };