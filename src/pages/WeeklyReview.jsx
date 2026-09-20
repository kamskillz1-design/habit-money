import React, { useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { useTransactions, useCategories } from "@/app/services/finance";
import { useGoals } from "@/app/services/goals";
import { useChallenges, useWeeklyReviews, useSaveWeeklyReview } from "@/app/services/coaching";
import { formatMoney, sumCents, formatDate } from "@/domain/money";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarCheck, Receipt, Save } from "lucide-react";

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export default function WeeklyReview() {
  const { t, language } = useI18n();
  const { data: transactions } = useTransactions();
  const { data: categories } = useCategories();
  const { data: goals } = useGoals();
  const { data: challenges } = useChallenges();
  const { data: reviews } = useWeeklyReviews();
  const saveReview = useSaveWeeklyReview();

  const loc = language === "es" ? "es-ES" : language;
  const fmt = (c) => formatMoney(c, "EUR", loc);

  const periodStart = day(-7);
  const periodEnd = day(-1);
  const priorStart = day(-14);

  const existing = (reviews || []).find((r) => r.period_start === periodStart);
  const [reflection, setReflection] = useState({ q1: "", q2: "", q3: "", q4: "", q5: "", focus: "" });
  const [saved, setSaved] = useState(existing?.status === "completed");

  const stats = useMemo(() => {
    const active = (transactions || []).filter((x) => !x.archived && !x.is_excluded_from_budget && !x.is_transfer);
    const inRange = (x, a, b) => x.transaction_date >= a && x.transaction_date <= b;
    const cur = active.filter((x) => inRange(x, periodStart, periodEnd));
    const prior = active.filter((x) => inRange(x, priorStart, periodStart));
    const spending = sumCents(cur.filter((x) => x.direction === "expense"), (x) => x.amount);
    const income = sumCents(cur.filter((x) => x.direction === "income"), (x) => x.amount);
    const savings = sumCents(cur.filter((x) => x.direction === "savings_contribution"), (x) => x.amount);
    const priorSpending = sumCents(prior.filter((x) => x.direction === "expense"), (x) => x.amount);
    const byCat = {};
    cur.filter((x) => x.direction === "expense").forEach((x) => { byCat[x.category_id] = (byCat[x.category_id] || 0) + x.amount; });
    const catById = Object.fromEntries((categories || []).map((c) => [c.id, c]));
    const largest = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const completedChallenges = (challenges || []).filter((c) => c.status === "completed" && c.completed_at && c.completed_at.slice(0, 10) >= periodStart).length;
    return {
      spending, income, savings, priorSpending,
      change: priorSpending > 0 ? spending - priorSpending : null,
      largestCat: largest ? catById[largest[0]]?.name : null,
      largestAmount: largest ? largest[1] : 0,
      completedChallenges,
      goalSummary: (goals || []).filter((g) => g.status === "active").map((g) => `${g.name} ${Math.round((g.current_amount / Math.max(1, g.target_amount)) * 100)}%`).join(" · ")
    };
  }, [transactions, categories, goals, challenges, periodStart, periodEnd, priorStart]);

  const positiveWin = stats.completedChallenges > 0
    ? t("review.winChallenge", { count: stats.completedChallenges })
    : stats.savings > 0 ? t("review.winSavings", { amount: fmt(stats.savings) }) : t("challenges.encourage");

  const doSave = async () => {
    await saveReview.mutateAsync({
      period_start: periodStart,
      period_end: periodEnd,
      total_income: stats.income,
      total_spending: stats.spending,
      total_savings: stats.savings,
      actual_budget_amount: stats.spending,
      largest_category: stats.largestCat || "",
      spending_change_from_prior_period: stats.change || 0,
      goal_progress_summary: stats.goalSummary || "",
      challenge_summary: t("review.winChallenge", { count: stats.completedChallenges }),
      positive_win: positiveWin,
      reflection_prompt: "review.q1",
      user_reflection: [reflection.q1, reflection.q2, reflection.q3, reflection.q4].filter(Boolean).join("\n"),
      next_week_focus: reflection.q5 || reflection.focus,
      completed_at: new Date().toISOString(),
      generated_at: new Date().toISOString(),
      status: "completed"
    });
    setSaved(true);
  };

  if ((transactions || []).length === 0) {
    return (
      <div>
        <PageHeader title={t("review.title")} />
        <EmptyState icon={CalendarCheck} title={t("review.noData")} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("review.title")}
        subtitle={`${formatDate(periodStart, loc)} — ${formatDate(periodEnd, loc)} · ${t("privacy.noSensitiveInference")}`}
        action={saved ? <span className="inline-flex items-center gap-1.5 text-sm text-chart-3 font-medium">✓ {t("review.completed")}</span> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label={t("review.totalSpending")} value={fmt(stats.spending)} icon={Receipt} />
        <StatCard label={t("review.totalIncome")} value={fmt(stats.income)} />
        <StatCard label={t("review.totalSavings")} value={fmt(stats.savings)} />
        <StatCard
          label={t("review.changeVsPrior")}
          value={stats.change === null ? "—" : (stats.change <= 0 ? fmt(-stats.change) : "+" + fmt(stats.change))}
          hint={t("insights.basedOn", { start: formatDate(priorStart, loc), end: formatDate(periodStart, loc) })}
          tone={stats.change !== null && stats.change <= 0 ? "accent" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm font-semibold mb-2">{t("review.largestCategory")}</p>
          <p className="text-2xl font-semibold">{stats.largestCat || "—"}</p>
          {stats.largestCat && <p className="text-xs text-muted-foreground mt-1">{fmt(stats.largestAmount)}</p>}
          <p className="mt-3 text-xs text-muted-foreground">{t("insights.basedOn", { start: formatDate(periodStart, loc), end: formatDate(periodEnd, loc) })}</p>
        </div>
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-semibold mb-2">{t("review.positiveWin")}</p>
          <p className="text-sm">{positiveWin}</p>
          <p className="mt-3 text-xs text-muted-foreground">{t("review.goalProgress")}: {stats.goalSummary || t("common.empty")}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 mb-6">
        <p className="text-sm font-semibold mb-3">{t("review.questions")}</p>
        <div className="space-y-3">
          {["q1", "q2", "q3", "q4"].map((k, i) => (
            <div key={k}>
              <Label className="text-xs text-muted-foreground">{t("review." + k)}</Label>
              <Textarea className="mt-1 min-h-[52px]" value={reflection[k]} onChange={(e) => setReflection((r) => ({ ...r, [k]: e.target.value }))} />
            </div>
          ))}
          <div>
            <Label className="text-xs text-muted-foreground">{t("review.q5")}</Label>
            <Textarea className="mt-1 min-h-[52px]" value={reflection.q5} onChange={(e) => setReflection((r) => ({ ...r, q5: e.target.value }))} />
          </div>
        </div>
        {!saved && (
          <Button className="mt-4" onClick={doSave} disabled={saveReview.isPending}>
            <Save className="h-4 w-4 mr-1.5" aria-hidden />{saveReview.isPending ? t("common.loading") : t("review.save")}
          </Button>
        )}
      </div>

      <DisclaimerBanner compact />
    </div>
  );
}