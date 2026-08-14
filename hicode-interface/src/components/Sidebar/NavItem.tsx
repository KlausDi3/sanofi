"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  /** Route to navigate to. Omit for entries that are not built yet. */
  href?: string;
  active?: boolean;
  /** Shown on hover for entries without a route, so the greying-out has a reason. */
  disabledHint?: string;
}

const BASE_CLASSES =
  "w-full flex items-center gap-4 px-4 py-3 rounded-full transition-colors text-left";

export function NavItem({
  icon: Icon,
  label,
  href,
  active = false,
  disabledHint = "Not implemented yet",
}: NavItemProps) {
  const content = (
    <>
      <Icon className="w-6 h-6" />
      <span className="font-secondary text-base">{label}</span>
    </>
  );

  // Entries without a route render as visibly unavailable rather than as
  // buttons that highlight but go nowhere — the previous behaviour read as a
  // broken link rather than an unbuilt page.
  if (!href) {
    return (
      <button
        type="button"
        disabled
        title={disabledHint}
        aria-disabled="true"
        className={`${BASE_CLASSES} text-[var(--sidebar-foreground)] opacity-40 cursor-not-allowed`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${BASE_CLASSES} ${
        active
          ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/50"
      }`}
    >
      {content}
    </Link>
  );
}
