import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({ label, value, hint, icon: Icon, tone = "default", className, children }) {
  const tones = {
    default: "bg-card",
    accent: "bg-accent/10 border-accent/20",
    primary: "bg-primary text-primary-foreground",
    muted: "bg-muted"
  };
  return (
    <div className={cn("rounded-2xl border border-border/70 p-4 shadow-sm", tones[tone], className)}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-xs font-medium uppercase tracking-wide", tone === "primary" ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", tone === "primary" ? "text-primary-foreground/80" : "text-accent")} aria-hidden />}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight", tone === "primary" ? "text-primary-foreground" : "text-foreground")}>{value}</p>
      {hint && <p className={cn("mt-1 text-xs", tone === "primary" ? "text-primary-foreground/70" : "text-muted-foreground")}>{hint}</p>}
      {children}
    </div>
  );
}