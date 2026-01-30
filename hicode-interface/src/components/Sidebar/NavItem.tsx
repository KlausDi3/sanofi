"use client";

import { LucideIcon } from "lucide-react";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function NavItem({ icon: Icon, label, active = false, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-4 px-4 py-3 rounded-full transition-colors
        ${active
          ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/50"
        }
      `}
    >
      <Icon className="w-6 h-6" />
      <span className="font-secondary text-base">{label}</span>
    </button>
  );
}
