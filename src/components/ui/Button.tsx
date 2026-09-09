import Link from "next/link";

import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-fg text-bg hover:bg-fg/85 disabled:bg-line-strong disabled:text-bg",
  outline:
    "border border-fg text-fg hover:bg-fg hover:text-bg disabled:border-line disabled:text-line-strong disabled:hover:bg-transparent disabled:hover:text-line-strong",
  ghost: "text-fg hover:opacity-60 disabled:text-line-strong",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.6875rem]",
  md: "h-11 px-6 text-[0.75rem]",
  lg: "h-14 px-8 text-[0.8125rem]",
};

const BASE =
  "inline-flex items-center justify-center gap-2 uppercase tracking-[0.14em] transition-colors duration-200 disabled:cursor-not-allowed";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {children}
    </Link>
  );
}
