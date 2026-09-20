import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Plus, ArrowDownCircle, PiggyBank, CalendarClock, Target, Trophy, FlaskConical, Sunrise, CalendarCheck } from "lucide-react";

const ACTIONS = [
  { to: "/spending?add=expense", labelKey: "quick.addExpense", icon: Plus },
  { to: "/spending?add=income", labelKey: "quick.addIncome", icon: ArrowDownCircle },
  { to: "/goals", labelKey: "quick.addSavings", icon: PiggyBank },
  { to: "/bills?new=1", labelKey: "quick.addBill", icon: CalendarClock },
  { to: "/goals?new=1", labelKey: "quick.createGoal", icon: Target },
  { to: "/challenges", labelKey: "quick.startChallenge", icon: Trophy },
  { to: "/scenario-lab", labelKey: "quick.runScenario", icon: FlaskConical },
  { to: "/weekly-review", labelKey: "quick.reviewProgress", icon: CalendarCheck }
];

export default function QuickActions() {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {ACTIONS.map(({ to, labelKey, icon: Icon }) => (
        <Link
          key={labelKey}
          to={to}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-xs font-medium text-center hover:border-accent/50 hover:bg-accent/5 transition-colors"
        >
          <Icon className="h-5 w-5 text-accent" aria-hidden />
          <span className="leading-tight">{t(labelKey)}</span>
        </Link>
      ))}
    </div>
  );
}