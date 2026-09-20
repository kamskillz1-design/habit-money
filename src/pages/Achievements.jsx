import React from "react";
import { useI18n } from "@/i18n";
import { useAchievements, useRewardLedger, useChallenges, useWeeklyReviews } from "@/app/services/coaching";
import { formatDate } from "@/domain/money";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatCard from "@/components/shared/StatCard";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Medal, Flame, CalendarCheck, Trophy, Sparkles, Award, Rocket, PiggyBank, Target, Wallet, Receipt, Leaf, Circle } from "lucide-react";

const ICONS = {
  Medal, Flame, CalendarCheck, Trophy, Sparkles, Award, Rocket, PiggyBank, Target, Wallet, Receipt, Leaf, Circle
};

export default function Achievements() {
  const { t, language } = useI18n();
  const { data: achievements } = useAchievements();
  const { data: ledger } = useRewardLedger();
  const { data: challenges } = useChallenges();
  const { data: reviews } = useWeeklyReviews();
  const loc = language === "es" ? "es-ES" : language;

  const points = ledger?.length ? ledger[0].balance_after ?? ledger.reduce((a, l) => a + l.points_change, 0) : 0;
  const completedChallenges = (challenges || []).filter((c) => c.status === "completed").length;
  const completedReviews = (reviews || []).filter((r) => r.status === "completed").length;
  const milestones = (achievements || []).filter((a) => a.achievement_type === "savings_milestone");

  return (
    <div>
      <PageHeader title={t("achievements.title")} subtitle={t("achievements.pointsNote")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label={t("achievements.points")} value={points} icon={Sparkles} tone="accent" hint={t("achievements.pointsNote")} />
        <StatCard label={t("achievements.challengeStreak")} value={completedChallenges} icon={Trophy} />
        <StatCard label={t("achievements.reviewStreak")} value={completedReviews} icon={CalendarCheck} />
        <StatCard label={t("achievements.milestones")} value={milestones.length} icon={Medal} />
      </div>

      {(achievements || []).length === 0 ? (
        <EmptyState icon={Medal} title={t("achievements.noAchievements")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {(achievements || []).filter((a) => a.is_visible !== false).map((a) => {
            const Icon = ICONS[a.badge_icon] || Medal;
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">{t("achievement." + a.achievement_type)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(a.earned_at?.slice(0, 10), loc)}{a.progress_value ? ` · ${a.progress_value}%` : ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section>
        <p className="mb-3 text-sm font-semibold">{t("achievements.history")}</p>
        <div className="rounded-2xl border bg-card overflow-hidden">
          {(ledger || []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("common.empty")}</p>
          ) : (
            <ul className="divide-y">
              {(ledger || []).map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{l.reason.replace(/_/g, " ")}</span>
                  <span className="font-semibold tabular-nums text-chart-3">+{l.points_change}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <DisclaimerBanner compact className="mt-8" />
    </div>
  );
}