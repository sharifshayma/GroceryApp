import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const variants = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "bg-accent text-white hover:opacity-90",
  ghost: "bg-transparent text-ink hover:bg-black/5 border border-border",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizes = {
  sm: "text-sm px-3 py-2.5 min-h-11",
  md: "text-base px-4 py-2.5 min-h-11",
  lg: "text-lg px-6 py-3",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-full font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
