"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Microscope,
  FileText,
  Settings,
  ChevronDown,
  BrainCircuit,
} from "lucide-react";
import { NavItem } from "./NavItem";
import { recallJobId, withJobId } from "@/lib/jobSession";

// `href: undefined` marks an entry that has no page behind it yet. They stay
// listed because they are the agreed information architecture, but they render
// as disabled rather than as working links.
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", href: undefined },
  { icon: Database, label: "Data Sources", id: "data", href: undefined },
  { icon: Microscope, label: "Run Analysis", id: "analysis", href: "/analysis" },
  { icon: FileText, label: "Results", id: "results", href: "/results" },
  { icon: Settings, label: "Settings", id: "settings", href: undefined },
];

export function Sidebar() {
  const pathname = usePathname();
  const [jobId, setJobId] = useState<string | null>(null);

  // localStorage is not available during render on the server, so the job id
  // is picked up after mount. Re-read on navigation: a run started on
  // /analysis should be reachable from /results without a reload.
  useEffect(() => {
    setJobId(recallJobId());
  }, [pathname]);

  return (
    <aside className="w-[280px] h-full bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-[var(--primary)]" />
          <span className="font-primary text-lg font-bold text-[var(--primary)]">
            HICODE
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <p className="px-4 mb-4 text-sm font-primary text-[var(--sidebar-foreground)]">
          Analysis
        </p>
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              // Carry the current run across, so opening Results shows the run
              // you just did instead of an empty page.
              href={item.href ? withJobId(item.href, jobId) : undefined}
              active={item.href ? pathname === item.href : false}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-8 py-6 border-t border-[var(--sidebar-border)]">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-secondary text-base text-[var(--sidebar-accent-foreground)]">
              Researcher
            </p>
            <p className="font-secondary text-base text-[var(--sidebar-foreground)]">
              research@sanofi.com
            </p>
          </div>
          <ChevronDown className="w-6 h-6 text-[var(--sidebar-foreground)]" />
        </div>
      </div>
    </aside>
  );
}
