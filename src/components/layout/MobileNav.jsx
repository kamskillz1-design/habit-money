import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sunrise, Receipt, Wallet, Target, Menu, FlaskConical, CalendarCheck, Lightbulb, CalendarClock, Medal, ShieldCheck, Settings, LifeBuoy, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const MAIN = [
  { to: "/", labelKey: "nav.today", icon: Sunrise },
  { to: "/spending", labelKey: "nav.spending", icon: Receipt },
  { to: "/budget", labelKey: "nav.budget", icon: Wallet },
  { to: "/goals", labelKey: "nav.goals", icon: Target }
];
const MORE = [
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

export default function MobileNav() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const item = ({ to, labelKey, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      end={to === "/"}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        cn("flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium", isActive ? "text-accent" : "text-muted-foreground")
      }
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className="truncate max-w-full px-1">{t(labelKey)}</span>
    </NavLink>
  );

  return (
    <nav aria-label="Mobile navigation" className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 grid grid-cols-5">
      {MAIN.map(item)}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground" aria-label={t("nav.more") || "More"}>
          <Menu className="h-5 w-5" aria-hidden />
          <span>{t("nav.more") || "More"}</span>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetTitle className="sr-only">{t("app.name")}</SheetTitle>
          <div className="grid grid-cols-3 gap-2 pb-6 pt-2">
            {MORE.map(({ to, labelKey, icon: Icon }) => (
              <button
                key={to}
                onClick={() => { setOpen(false); navigate(to); }}
                className="flex flex-col items-center gap-2 rounded-xl border p-4 text-xs font-medium hover:bg-muted transition-colors"
              >
                <Icon className="h-5 w-5 text-accent" aria-hidden />
                <span className="text-center leading-tight">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}