import React, { useMemo } from "react";
import { useI18n } from "@/i18n";
import { useTransactions, useCategories, useRecurringItems } from "@/app/services/finance";
import { useGoals } from "@/app/services/goals";
import { useAllocations } from "@/app/services/budget";
import { useBudgetPeriods } from "@/app/services/budget";
import { useDismissedInsights, useDismissInsight } from "@/app/services/insights";
import { buildInsights } from "@/domain/insights";
import { formatMoney, formatDate } from "@/domain/money";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Button } from "@/components/ui/button";
import { Lightbulb, X, ThumbsDown } from "lucide-react";

const TYPE_ICONS = {
  spending_change: "📊", positive_progress: "🌱", recurring_bill: "📅",
  goal_momentum: "🎯", budget_variance: "🧮", data_quality: "✨"
};

export default function Insights() {
  const { t, language } = useI18n();
  const { data: transactions } = useTransactions();
  const { data: categories } = useCategories();
  const { data: goals } = useGoals();
  const { data: recurring } = useRecurringItems();
  const { data: periods } = useBudgetPeriods();
  const { data: dismissed } = useDismissedInsights();
  const dismiss = useDismissInsight();

  const loc = language === "es" ? "es-ES" : language;
  const fmt = (c) => formatMoney(c, "EUR", loc);

  const period = (periods || []).find((p) => p.status === "active") || (periods || [])[0];
  const { data: allocations } = useAllocations(period?.id);

  const insights = useMemo(() => {
    const all = buildInsights({ transactions: transactions || [], categories: categories || [], goals: goals || [], recurring: recurring || [], allocations: allocations || [] });
    const dismissedKeys = new Set((dismissed || []).map((d) => d.title));
    return all.filter((i) => !dismissedKeys.has(i.key));
  }, [transactions, categories, goals, recurring, allocations, dismissed]);

  const message = (i) => {
    const params = { ...i.params };
    if (typeof params.amount === "number") params.amount = fmt(params.amount);
    return t(i.messageKey, params);
  };

  return (
    <div>
      <PageHeader title={t("insights.title")} subtitle={t("insights.noInsights")} />
      {insights.length === 0 ? (
        <EmptyState icon={Lightbulb} title={t("insights.noInsights")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((i) => (
            <div key={i.key} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">
                  <span aria-hidden className="mr-1.5">{TYPE_ICONS[i.type] || "💡"}</span>
                  {message(i)}
                </p>
                <div className="flex shrink-0 gap-1">
                  <button aria-label={t("insights.dismiss")} onClick={() => dismiss.mutate({ insight: i, status: "dismissed" })} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-3.5 w-3.5" aria-hidden /></button>
                  <button aria-label={t("insights.unhelpful")} onClick={() => dismiss.mutate({ insight: i, status: "unhelpful" })} className="rounded-lg p-1.5 hover:bg-muted"><ThumbsDown className="h-3.5 w-3.5" aria-hidden /></button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {i.period
                  ? t(i.explanationKey, { start: formatDate(i.period.start, loc), end: formatDate(i.period.end, loc) })
                  : t(i.explanationKey)}
              </p>
            </div>
          ))}
        </div>
      )}
      <DisclaimerBanner compact className="mt-8" />
    </div>
  );
}