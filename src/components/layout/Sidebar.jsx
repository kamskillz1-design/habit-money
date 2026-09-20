import React from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "@/i18n";
import {
  Sunrise, Receipt, Wallet, Target, Trophy, FlaskConical, CalendarCheck,
  Lightbulb, CalendarClock, Medal, ShieldCheck, Settings, LifeBuoy, Sparkles, Users
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", labelKey: "nav.today", icon: Sunrise },
  { to: "/spending", labelKey: "nav.spending", icon: Receipt },
  { to: "/budget", labelKey: "nav.budget", icon: Wallet },
  { to: "/goals", labelKey: "nav.goals", icon: Target },
  { to: "/challenges", labelKey: "nav.challenges", icon: Trophy },
  { to: "/scenario-lab", labelKey: "nav.scenarioLab", icon: FlaskConical },
  { to: "/weekly-review", labelKey: "nav.weeklyReview", icon: CalendarCheck },
  { to: "/insights", labelKey: "nav.insights", icon: Lightbulb },
  { to: "/bills", labelKey: "nav.bills", icon: CalendarClock },
  { to: "/achievements", labelKey: "nav.achievements", icon: Medal },
  { to: "/household", labelKey: "nav.household", icon: Users },
  { to: "/privacy", labelKey: "nav.privacy", icon: ShieldCheck },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
  { to: "/help", labelKey: "nav.help", icon: LifeBuoy }
];

export default function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40">
      <div className="flex items-center gap-2.5 px-6 h-16">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-white">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="font-heading font-semibold tracking-tight text-[15px]">{t("app.name")}</p>
          <p className="text-[11px] text-sidebar-foreground/60">{t("app.tagline")}</p>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}