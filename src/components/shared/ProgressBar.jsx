import React from "react";
import { cn } from "@/lib/utils";

export default function ProgressBar({ value = 0, max = 100, className }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / Math.max(1, max)) * 100)));
  const tone = pct >= 100 ? "bg-chart-5" : pct >= 80 ? "bg-chart-4" : "bg-accent";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all duration-500", tone)} style={{ width: pct + "%" }} />
    </div>
  );
}