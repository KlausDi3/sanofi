"use client";

import { useState } from "react";
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

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Database, label: "Data Sources", id: "data" },
  { icon: Microscope, label: "Run Analysis", id: "analysis" },
  { icon: FileText, label: "Results", id: "results" },
  { icon: Settings, label: "Settings", id: "settings" },
];

export function Sidebar() {
  const [activeItem, setActiveItem] = useState("dashboard");

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
              active={activeItem === item.id}
              onClick={() => setActiveItem(item.id)}
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
