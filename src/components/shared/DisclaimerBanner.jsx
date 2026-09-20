import React from "react";
import { useI18n } from "@/i18n";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// The educational disclaimer is shown prominently across the app.
export default function DisclaimerBanner({ compact = false, className }) {
  const { t } = useI18n();
  return (
    <div className={cn("rounded-xl border border-border/70 bg-muted/60 px-4 py-3 flex gap-3 items-start", compact && "py-2", className)} role="note">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <p className={cn("text-muted-foreground", compact ? "text-[11px] leading-relaxed" : "text-xs leading-relaxed")}>{t("disclaimer.educational")}</p>
    </div>
  );
}