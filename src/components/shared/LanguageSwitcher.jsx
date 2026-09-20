import React from "react";
import { useI18n } from "@/i18n";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Languages, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// The single language switcher — it only talks to the central language controller.
export default function LanguageSwitcher({ compact = false }) {
  const { language, setLanguage, supportedLanguages, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors", compact && "px-2")}
        aria-label={t("settings.language")}
      >
        <Languages className="h-4 w-4" aria-hidden />
        <span>{language.toUpperCase()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {supportedLanguages.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => setLanguage(l.code)} className="flex items-center justify-between gap-2">
            <span>{l.label}</span>
            {language === l.code && <Check className="h-4 w-4 text-accent" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}