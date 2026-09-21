import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n, SUPPORTED_LANGUAGES } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useAcceptTerms, useSaveUserProfile, useSaveFinancialProfile } from "@/app/services/profile";
import { ensureStarterCategories } from "@/app/services/finance";
import { useSaveGoal } from "@/app/services/goals";
import { useStartChallenge } from "@/app/services/coaching";
import { useCreateBudget } from "@/app/services/budget";
import { PRIORITIES, COACHING_STYLES, NOTIFICATION_FREQUENCIES, WEEKDAYS, DISCLAIMER_KEY, CHALLENGE_LIBRARY } from "@/domain/constants";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toCents } from "@/domain/money";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const SUGGESTED_CHALLENGES = {
  reduce_spending: "no_spend_day",
  build_emergency_fund: "emergency_starter",
  save_for_goal: "save_5_today",
  manage_bills: "review_subscription",
  reduce_debt: "save_20_week",
  understand_habits: "log_7_days",
  other: "log_7_days"
};

const BUDGET_TEMPLATES = ["50_30_20", "essential_first", "zero_based", "student", "family", "flexible"];

export default function Onboarding() {
  const { t, language, setLanguage } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const acceptTerms = useAcceptTerms();
  const saveProfile = useSaveUserProfile();
  const saveFinancial = useSaveFinancialProfile();
  const saveGoal = useSaveGoal();
  const startChallenge = useStartChallenge();
  const createBudget = useCreateBudget();

  const [step, setStep] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [prefs, setPrefs] = useState({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid",
    currency: "EUR",
    coaching_style: "practical",
    notification_frequency: "essential_only",
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    weekly_review_day: "Sunday"
  });
  const [priority, setPriority] = useState(null);
  const [snapshot, setSnapshot] = useState({ income: "", essentials: "", cash: "" });
  const [goal, setGoal] = useState({ name: "", type: "emergency_fund", target: "", date: "" });
  const [template, setTemplate] = useState(null);
  const [challenge, setChallenge] = useState(null);

  const TOTAL = 8;
  const snapshotFilled = snapshot.income || snapshot.essentials || snapshot.cash;

  const next = async () => {
    setError(null);
    if (step === 1 && !accepted) { setError(t("validation.required")); return; }
    if (step === 1) {
      try { await acceptTerms.mutateAsync({ language }); } catch (e) { setError(t("common.error")); return; }
    }
    if (step === 5 && goal.target) {
      const cents = toCents(goal.target);
      if (!Number.isInteger(cents) || cents <= 0) { setError(t("validation.amountInvalid")); return; }
    }
    setStep((s) => Math.min(TOTAL, s + 1));
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const cats = await ensureStarterCategories(user.id, t);
      await saveProfile.mutateAsync({
        preferred_language: language,
        timezone: prefs.timezone,
        default_currency: prefs.currency,
        coaching_style: prefs.coaching_style,
        notification_frequency: prefs.notification_frequency,
        quiet_hours_start: prefs.quiet_hours_start,
        quiet_hours_end: prefs.quiet_hours_end,
        weekly_review_day: prefs.weekly_review_day,
        onboarding_completed: true,
        account_status: "active"
      });
      await saveFinancial.mutateAsync({
        monthly_income_target: snapshot.income ? toCents(snapshot.income) : undefined,
        essential_expense_target: snapshot.essentials ? toCents(snapshot.essentials) : undefined,
        current_cash_estimate: snapshot.cash ? toCents(snapshot.cash) : undefined,
        primary_financial_priority: priority || "other",
        preferred_budget_method: template ? template : "no_budget",
        onboarding_step: TOTAL,
        data_confidence_level: snapshotFilled ? "medium" : "low"
      });
      if (goal.name && goal.target) {
        await saveGoal.mutateAsync({ fields: { name: goal.name, goal_type: goal.type, target_amount: toCents(goal.target), target_date: goal.date || undefined, priority: "medium", status: "active" } });
      }
      if (template) {
        await createBudget.mutateAsync({
          templateId: template,
          incomeCents: snapshot.income ? toCents(snapshot.income) : 0,
          essentialCents: snapshot.essentials ? toCents(snapshot.essentials) : 0,
          monthOffset: 0,
          categories: cats
        });
      }
      if (challenge) {
        await startChallenge.mutateAsync({ libraryId: challenge });
      }
      navigate("/", { replace: true });
    } catch (e) {
      setError(e?.errorKey ? t(e.errorKey) : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const text = (v, setter) => ({ value: v, onChange: (e) => setter(e.target.value) });
  const firstAction = t("quick.addExpense");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{t("onboarding.step", { current: step, total: TOTAL })}</p>
          <LanguageSwitcher compact />
        </div>
        <div className="rounded-3xl border bg-card shadow-sm p-6 md:p-8">
          {step === 1 && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">{t("onboarding.welcomeTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("onboarding.welcomeBody")}</p>
              <DisclaimerBanner />
              <label className="flex items-start gap-3 rounded-xl border p-3 text-sm cursor-pointer">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--accent))]" />
                <span>{t("onboarding.acceptAll")}</span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-semibold">{t("onboarding.prefs")}</h1>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t("settings.language")}</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{SUPPORTED_LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("settings.currency")}</Label>
                  <Select value={prefs.currency} onValueChange={(v) => setPrefs({ ...prefs, currency: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{["EUR", "USD", "GBP"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("settings.timezone")}</Label>
                  <Input className="mt-1" {...text(prefs.timezone, (v) => setPrefs({ ...prefs, timezone: v }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("settings.weeklyReviewDay")}</Label>
                  <Select value={prefs.weekly_review_day} onValueChange={(v) => setPrefs({ ...prefs, weekly_review_day: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("settings.coachingStyle")}</Label>
                  <Select value={prefs.coaching_style} onValueChange={(v) => setPrefs({ ...prefs, coaching_style: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{COACHING_STYLES.map((c) => <SelectItem key={c} value={c}>{t("coaching." + c)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("settings.notifications")}</Label>
                  <Select value={prefs.notification_frequency} onValueChange={(v) => setPrefs({ ...prefs, notification_frequency: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{NOTIFICATION_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{t("notif." + f)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t("settings.quietHours")} · {t("common.details")}</Label>
                  <div className="mt-1 flex gap-2">
                    <Input type="time" value={prefs.quiet_hours_start} onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value })} />
                    <Input type="time" value={prefs.quiet_hours_end} onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h1 className="font-display text-2xl font-semibold">{t("onboarding.priority")}</h1>
              {PRIORITIES.map((p) => (
                <label key={p} className={cn("flex items-center gap-3 rounded-xl border p-3 text-sm cursor-pointer transition-colors", priority === p ? "border-accent bg-accent/5" : "hover:bg-muted/50")}>
                  <input type="radio" name="priority" checked={priority === p} onChange={() => setPriority(p)} className="h-4 w-4 accent-[hsl(var(--accent))]" />
                  {t("priority." + p)}
                </label>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-semibold">{t("onboarding.snapshot")}</h1>
              <p className="text-sm text-muted-foreground">{t("onboarding.snapshotPrivacy")}</p>
              <div className="space-y-3">
                <div><Label className="text-xs">{t("onboarding.monthlyIncome")} ({t("common.optional")})</Label><Input className="mt-1" inputMode="decimal" placeholder="2200" {...text(snapshot.income, (v) => setSnapshot({ ...snapshot, income: v }))} /></div>
                <div><Label className="text-xs">{t("onboarding.essentialCosts")} ({t("common.optional")})</Label><Input className="mt-1" inputMode="decimal" placeholder="1150" {...text(snapshot.essentials, (v) => setSnapshot({ ...snapshot, essentials: v }))} /></div>
                <div><Label className="text-xs">{t("onboarding.cashEstimate")} ({t("common.optional")})</Label><Input className="mt-1" inputMode="decimal" placeholder="1800" {...text(snapshot.cash, (v) => setSnapshot({ ...snapshot, cash: v }))} /></div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-semibold">{t("onboarding.firstGoal")}</h1>
              <div><Label className="text-xs">{t("challenges.customTitle")}</Label><Input className="mt-1" placeholder={t("category.savings")} {...text(goal.name, (v) => setGoal({ ...goal, name: v }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t("goals.targetAmount")}</Label>
                  <Input className="mt-1" inputMode="decimal" placeholder="1000" {...text(goal.target, (v) => setGoal({ ...goal, target: v }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("goals.targetDate")} ({t("common.optional")})</Label>
                  <Input className="mt-1" type="date" value={goal.date} onChange={(e) => setGoal({ ...goal, date: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("goals.shareHint")}</p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <h1 className="font-display text-2xl font-semibold">{t("onboarding.firstBudget")}</h1>
              {BUDGET_TEMPLATES.map((tpl) => (
                <label key={tpl} className={cn("flex items-center gap-3 rounded-xl border p-3 text-sm cursor-pointer transition-colors", template === tpl ? "border-accent bg-accent/5" : "hover:bg-muted/50")}>
                  <input type="radio" name="template" checked={template === tpl} onChange={() => setTemplate(tpl)} className="h-4 w-4 accent-[hsl(var(--accent))]" />
                  {t("template." + tpl)}
                </label>
              ))}
            </div>
          )}

          {step === 7 && (
            <div className="space-y-3">
              <h1 className="font-display text-2xl font-semibold">{t("onboarding.firstChallenge")}</h1>
              {["no_spend_day", "log_7_days", "save_5_today"].map((id) => {
                const tpl = CHALLENGE_LIBRARY.find((c) => c.id === id);
                return (
                  <label key={id} className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm cursor-pointer transition-colors", challenge === id ? "border-accent bg-accent/5" : "hover:bg-muted/50")}>
                    <input type="radio" name="challenge" checked={challenge === id} onChange={() => setChallenge(id)} className="mt-1 h-4 w-4 accent-[hsl(var(--accent))]" />
                    <span><span className="font-medium">{t(tpl.titleKey)}</span><br /><span className="text-muted-foreground">{t(tpl.descKey)}</span></span>
                  </label>
                );
              })}
              <p className="text-xs text-muted-foreground">{t("challenges.privacyNote")}</p>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4 text-center py-6">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent"><Check className="h-7 w-7" aria-hidden /></span>
              <h1 className="font-display text-2xl font-semibold">{t("onboarding.finish")}</h1>
              <p className="text-sm text-muted-foreground">{t("onboarding.finishBody")}</p>
              <p className="text-sm font-medium">{t("today.firstAction", { action: firstAction })}</p>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || busy}>
              <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden /> {t("common.back")}
            </Button>
            {step < TOTAL ? (
              <div className="flex gap-2">
                {(step === 4 || step === 5 || step === 6 || step === 7) && (
                  <Button variant="outline" onClick={() => setStep(TOTAL)} disabled={busy}>{t("common.skip")}</Button>
                )}
                <Button onClick={next} disabled={busy}>
                  {t("common.next")} <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden />
                </Button>
              </div>
            ) : (
              <Button onClick={finish} disabled={busy}>{busy ? t("common.loading") : t("onboarding.start")}</Button>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">{t(DISCLAIMER_KEY)}</p>
      </div>
    </div>
  );
}
