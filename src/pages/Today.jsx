import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useUserProfile, useFinancialProfile } from "@/app/services/profile";
import { useTransactions, useCategories, useAccounts, useRecurringItems } from "@/app/services/finance";
import { useGoals } from "@/app/services/goals";
import { useChallenges, useAchievements, useNudges, useRewardLedger, useWeeklyReviews } from "@/app/services/coaching";
import { useBudgetPeriods, useAllocations } from "@/app/services/budget";
import { formatMoney, formatDate, sumCents } from "@/domain/money";
import { weekSpendingTotal } from "@/domain/insights";
import SafeToSpendCard from "@/components/today/SafeToSpendCard";
import QuickActions from "@/components/today/QuickActions";
import CheckInCard from "@/components/today/CheckInCard";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import ProgressBar from "@/components/shared/ProgressBar";
import { useLoadDemoData } from "@/app/services/demo";
import { Button } from "@/components/ui/button";
import { Plus, CalendarClock, Trophy, Medal, Lightbulb, Target, Receipt } from "lucide-react";

export default function Today() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const { data: finProfile } = useFinancialProfile();
  const { data: transactions, isLoading: txLoading } = useTransactions();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: recurring } = useRecurringItems();
  const { data: goals } = useGoals();
  const { data: challenges } = useChallenges();
  const { data: achievements } = useAchievements();
  const { data: nudges } = useNudges();
  const { data: ledger } = useRewardLedger();
  const { data: reviews } = useWeeklyReviews();
  const { data: periods } = useBudgetPeriods();
  const demo = useLoadDemoData();

  const todayStr = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const currency = profile?.default_currency || "EUR";
  const loc = language === "es" ? "es-ES" : language;

  // Hooks must run before any early return, so the active period is resolved here.
  const period = (periods || []).find((p) => p.status === "active" && p.period_start <= todayStr && p.period_end >= todayStr);
  const { data: allocations } = useAllocations(period?.id);

  if (txLoading) {
    return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" role="status" /></div>;
  }

  const hasData = (transactions?.length || 0) > 0 || (accounts?.length || 0) > 0;
  if (!hasData) {
    return (
      <div className="py-10">
        <h1 className="font-display text-3xl font-semibold mb-2">{t("today.greetingMorning")}, {profile?.full_name || user?.email?.split("@")[0]} 👋</h1>
        <p className="text-muted-foreground mb-8">{t("app.tagline")}</p>
        <EmptyState
          icon={Receipt}
          title={t("empty.transactions")}
          description={t("onboarding.welcomeBody")}
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link to="/spending?add=expense">{t("quick.addExpense")}</Link></Button>
              <Button variant="outline" onClick={() => demo.mutate()} disabled={demo.isPending}>{demo.isPending ? t("common.loading") : t("settings.demoData")}</Button>
            </div>
          }
        />
      </div>
    );
  }

  const activeTx = (transactions || []).filter((x) => !x.archived);
  const catById = {};
  (categories || []).forEach((c) => (catById[c.id] = c));

  // Safe-to-spend components (all user data, explained in the card).
  const cashCents = finProfile?.current_cash_estimate ?? sumCents((accounts || []).filter((a) => a.include_in_cashflow !== false), (a) => a.current_balance || 0);
  const upcoming = (recurring || []).filter((r) => r.status === "active" && !r.archived && r.direction === "expense" && r.next_due_date >= todayStr && r.next_due_date <= in14);
  const billsCents = sumCents(upcoming, (r) => r.amount);

  // Actuals are computed from eligible transactions in the active period.
  const periodTx = activeTx.filter((x) => x.transaction_date >= (period?.period_start || "0000") && x.transaction_date <= (period?.period_end || "9999") && !x.is_excluded_from_budget && !x.is_transfer);
  const actualsByCat = {};
  periodTx.filter((x) => x.direction === "expense").forEach((x) => {
    actualsByCat[x.category_id] = (actualsByCat[x.category_id] || 0) + x.amount;
  });
  const plannedTotal = period?.total_expense_budget || 0;
  const actualTotal = Object.values(actualsByCat).reduce((a, b) => a + b, 0);
  const essentialRemaining = (allocations || [])
    .filter((a) => catById[a.category_id]?.is_essential)
    .reduce((acc, a) => acc + Math.max(0, (a.planned_amount || 0) - (actualsByCat[a.category_id] || 0)), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("today.greetingMorning") : hour < 19 ? t("today.greetingAfternoon") : t("today.greetingEvening");
  const weekSpending = weekSpendingTotal(activeTx);
  const activeChallenge = (challenges || []).find((c) => c.status === "active");
  const topGoal = (goals || []).find((g) => g.status === "active");
  const latestNudge = (nudges || []).filter((n) => n.status === "displayed" || n.status === "scheduled")[0];
  const uncategorised = activeTx.filter((x) => !x.category_id && !x.is_transfer).length;
  const points = ledger?.length ? ledger[0].balance_after || sumCents(ledger, (l) => l.points_change) : 0;
  const reviewDue = !(reviews || []).some((r) => r.period_end >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));

  const fmt = (cents) => formatMoney(cents, currency, loc);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">{greeting}, {profile?.full_name || user?.email?.split("@")[0]}</h1>
        {finProfile?.primary_financial_priority && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Target className="h-3.5 w-3.5" aria-hidden />
            {t("priority." + finProfile.primary_financial_priority)}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {finProfile?.safe_to_spend_enabled !== false ? (
          <SafeToSpendCard
            cashCents={cashCents}
            billsCents={billsCents}
            essentialBudgetCents={essentialRemaining}
            savingsCents={period?.total_savings_target || 0}
            currency={currency}
          />
        ) : null}
        <StatCard label={t("today.weekSpending")} value={fmt(weekSpending)} icon={Receipt} />
        <StatCard label={t("today.budgetHealth")} value={plannedTotal > 0 ? Math.min(100, Math.round((actualTotal / plannedTotal) * 100)) + "%" : "—"} icon={Medal}
          hint={plannedTotal > 0 ? `${fmt(actualTotal)} / ${fmt(plannedTotal)}` : t("budget.noBudget")}>
          {plannedTotal > 0 && <ProgressBar value={actualTotal} max={plannedTotal} className="mt-3" />}
        </StatCard>

        {topGoal && (
          <StatCard label={t("today.goalProgress") + " · " + topGoal.name} value={fmt(topGoal.current_amount)} icon={Target} hint={`${t("common.of")} ${fmt(topGoal.target_amount)}`}>
            <ProgressBar value={topGoal.current_amount} max={topGoal.target_amount} className="mt-3" />
          </StatCard>
        )}

        {activeChallenge && (
          <StatCard label={t("today.activeChallenge")} value={t(activeChallenge.title)} icon={Trophy}
            hint={`${activeChallenge.completion_percentage || 0}% · ${activeChallenge.unit}`}>
            <ProgressBar value={activeChallenge.current_progress || 0} max={activeChallenge.target_value || 1} className="mt-3" />
            <Button asChild size="sm" variant="outline" className="mt-3 w-full"><Link to="/challenges">{t("challenges.checkIn")}</Link></Button>
          </StatCard>
        )}

        <StatCard label={t("today.upcomingBillsTitle")} value={fmt(billsCents)} icon={CalendarClock} hint={t("bills.next14")}>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {upcoming.slice(0, 3).map((r) => (
              <div key={r.id} className="flex justify-between gap-2">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0">{formatDate(r.next_due_date, loc)}</span>
              </div>
            ))}
            {upcoming.length === 0 && <span>{t("bills.noBills")}</span>}
          </div>
          <Button asChild size="sm" variant="ghost" className="mt-1 w-full text-accent"><Link to="/bills">{t("common.details")}</Link></Button>
        </StatCard>

        <StatCard label={t("today.streaks")} value={points + " pts"} icon={Medal} hint={t("achievements.pointsNote")}>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div>{t("achievements.challengeStreak")}: {(challenges || []).filter((c) => c.status === "completed").length}</div>
            <div>{t("achievements.reviewStreak")}: {(reviews || []).filter((r) => r.status === "completed").length}</div>
          </div>
        </StatCard>

        {reviewDue && (
          <StatCard label={t("today.reviewReminder")} value={t("review.generate")} icon={CalendarClock} tone="accent">
            <Button asChild size="sm" variant="outline" className="mt-3 w-full"><Link to="/weekly-review">{t("common.review")}</Link></Button>
          </StatCard>
        )}

        {uncategorised > 0 && (
          <StatCard label={t("today.dataQuality")} value={t("today.uncategorised", { count: uncategorised })} icon={Lightbulb} tone="muted">
            <Button asChild size="sm" variant="ghost" className="mt-2 w-full text-accent"><Link to="/spending">{t("common.review")}</Link></Button>
          </StatCard>
        )}

        <CheckInCard />

        {latestNudge && (
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:col-span-2 lg:col-span-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t("today.dailyNudge")}</p>
                <p className="mt-1 text-sm font-medium">{latestNudge.title.startsWith("challenge.") || latestNudge.title.startsWith("nudge.") ? t(latestNudge.title) : latestNudge.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{latestNudge.message?.startsWith("challenge.") || latestNudge.message?.startsWith("nudge.") ? t(latestNudge.message) : latestNudge.message}</p>
                {latestNudge.explanation && <p className="mt-2 text-xs italic text-muted-foreground">{t("today.whyThisNudge")} {latestNudge.explanation}</p>}
              </div>
              {latestNudge.action_url && <Button asChild size="sm" variant="outline"><Link to={latestNudge.action_url}>{t("common.details")}</Link></Button>}
            </div>
          </div>
        )}
      </div>

      <section aria-label={t("today.quickActions")}>
        <p className="mb-2 text-sm font-semibold">{t("today.quickActions")}</p>
        <QuickActions />
      </section>

      {(achievements || []).length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">{t("achievements.earned")}</p>
            <Link to="/achievements" className="text-xs font-medium text-accent hover:underline">{t("common.all")}</Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(achievements || []).slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-medium whitespace-nowrap">
                <Medal className="h-4 w-4 text-chart-4" aria-hidden />
                {t("achievement." + a.achievement_type)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}