import React, { useState } from "react";
import { useI18n } from "@/i18n";
import { formatMoney } from "@/domain/money";
import { safeToSpend } from "@/domain/scenarioMath";
import { ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import StatCard from "@/components/shared/StatCard";

// Explainable estimate — every component of the calculation is shown, and it can be disabled.
export default function SafeToSpendCard({ cashCents, billsCents, essentialBudgetCents, savingsCents, currency, onDisable }) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const result = safeToSpend({
    cashEstimateCents: cashCents,
    upcomingEssentialBillsCents: billsCents,
    remainingEssentialBudgetCents: essentialBudgetCents,
    plannedSavingsCents: savingsCents
  });
  const rows = [
    { key: "today.cashEstimate", amount: cashCents },
    { key: "today.upcomingBills", amount: -billsCents },
    { key: "today.essentialBudget", amount: -essentialBudgetCents },
    { key: "today.plannedSavings", amount: -savingsCents }
  ];
  return (
    <StatCard
      label={t("today.safeToSpend")}
      value={formatMoney(result.total, currency, language === "es" ? "es-ES" : language)}
      icon={EyeOff}
      className="sm:col-span-2"
      hint={t("today.safeToSpendHint")}
    >
      <button onClick={() => setOpen(!open)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
        {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
        {open ? t("today.hideCalculation") : t("today.showCalculation")}
      </button>
      {open && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-muted/60 p-3 text-xs">
          {rows.map((r) => (
            <div key={r.key} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t(r.key)}</span>
              <span className="font-medium tabular-nums">{formatMoney(r.amount, currency)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-2 border-t border-border pt-1.5">
            <span className="font-semibold">{t("today.safeToSpend")}</span>
            <span className="font-semibold tabular-nums">{formatMoney(result.total, currency)}</span>
          </div>
        </div>
      )}
    </StatCard>
  );
}