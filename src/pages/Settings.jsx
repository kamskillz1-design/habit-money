import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n, SUPPORTED_LANGUAGES } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useUserProfile, useFinancialProfile, useSaveUserProfile, useSaveFinancialProfile } from "@/app/services/profile";
import { useAccounts } from "@/app/services/finance";
import { useGoals } from "@/app/services/goals";
import { PLAN_LIMITS, COACHING_STYLES, NOTIFICATION_FREQUENCIES, WEEKDAYS } from "@/domain/constants";
import { useLoadDemoData } from "@/app/services/demo";
import { toCents } from "@/domain/money";
import PageHeader from "@/components/shared/PageHeader";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, LogOut, Check } from "lucide-react";

export default function Settings() {
  const { t, language, setLanguage } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useUserProfile();
  const { data: finProfile } = useFinancialProfile();
  const saveProfile = useSaveUserProfile();
  const saveFinancial = useSaveFinancialProfile();
  const { data: accounts } = useAccounts();
  const { data: goals } = useGoals();
  const demo = useLoadDemoData();

  const [form, setForm] = useState(null);
  const [fin, setFin] = useState(null);
  const [saved, setSaved] = useState(false);

  const pf = form || {
    full_name: profile?.full_name || user?.full_name || "",
    timezone: profile?.timezone || "Europe/Madrid",
    default_currency: profile?.default_currency || "EUR",
    coaching_style: profile?.coaching_style || "practical",
    notification_frequency: profile?.notification_frequency || "essential_only",
    quiet_hours_start: profile?.quiet_hours_start || "22:00",
    quiet_hours_end: profile?.quiet_hours_end || "08:00",
    weekly_review_day: profile?.weekly_review_day || "Sunday"
  };
  const fp = fin || {
    income: finProfile?.monthly_income_target ? (finProfile.monthly_income_target / 100).toFixed(0) : "",
    essentials: finProfile?.essential_expense_target ? (finProfile.essential_expense_target / 100).toFixed(0) : "",
    cash: finProfile?.current_cash_estimate ? (finProfile.current_cash_estimate / 100).toFixed(0) : "",
    emergency: finProfile?.emergency_fund_target ? (finProfile.emergency_fund_target / 100).toFixed(0) : "",
    safeToSpend: finProfile?.safe_to_spend_enabled !== false
  };

  const setP = (k, v) => { setForm({ ...pf, [k]: v }); setSaved(false); };
  const setF = (k, v) => { setFin({ ...fp, [k]: v }); setSaved(false); };

  const save = async () => {
    await saveProfile.mutateAsync(pf);
    await saveFinancial.mutateAsync({
      monthly_income_target: fp.income ? toCents(fp.income) : undefined,
      essential_expense_target: fp.essentials ? toCents(fp.essentials) : undefined,
      current_cash_estimate: fp.cash ? toCents(fp.cash) : undefined,
      emergency_fund_target: fp.emergency ? toCents(fp.emergency) : undefined,
      safe_to_spend_enabled: fp.safeToSpend
    });
    setSaved(true);
  };

  const plan = profile?.plan || "free";
  const limits = PLAN_LIMITS[plan];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("settings.title")}
        action={<Button onClick={save} disabled={saveProfile.isPending || saveFinancial.isPending}>{saveProfile.isPending ? t("common.loading") : t("common.save")}</Button>}
      />
      {saved && <p className="inline-flex items-center gap-1.5 text-sm text-chart-3 font-medium"><Check className="h-4 w-4" aria-hidden />{t("settings.saved")}</p>}

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs">{t("settings.profile")}</Label>
          <Input className="mt-1" value={pf.full_name} onChange={(e) => setP("full_name", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{t("settings.language")}</Label>
          <Select value={language} onValueChange={(v) => { setLanguage(v); setP("preferred_language", v); }}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{SUPPORTED_LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("settings.currency")}</Label>
          <Select value={pf.default_currency} onValueChange={(v) => setP("default_currency", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{["EUR", "USD", "GBP"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("settings.timezone")}</Label>
          <Input className="mt-1" value={pf.timezone} onChange={(e) => setP("timezone", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{t("settings.coachingStyle")}</Label>
          <Select value={pf.coaching_style} onValueChange={(v) => setP("coaching_style", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{COACHING_STYLES.map((c) => <SelectItem key={c} value={c}>{t("coaching." + c)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("settings.notifications")}</Label>
          <Select value={pf.notification_frequency} onValueChange={(v) => setP("notification_frequency", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{NOTIFICATION_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{t("notif." + f)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("settings.quietHours")}</Label>
          <div className="mt-1 flex gap-2">
            <Input type="time" value={pf.quiet_hours_start} onChange={(e) => setP("quiet_hours_start", e.target.value)} />
            <Input type="time" value={pf.quiet_hours_end} onChange={(e) => setP("quiet_hours_end", e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">{t("settings.weeklyReviewDay")}</Label>
          <Select value={pf.weekly_review_day} onValueChange={(v) => setP("weekly_review_day", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </section>

      <section>
        <p className="mb-3 text-sm font-semibold">{t("onboarding.snapshot")}</p>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <Label className="text-xs">{t("onboarding.monthlyIncome")}</Label>
            <Input className="mt-1" inputMode="decimal" value={fp.income} onChange={(e) => setF("income", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("onboarding.essentialCosts")}</Label>
            <Input className="mt-1" inputMode="decimal" value={fp.essentials} onChange={(e) => setF("essentials", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("onboarding.cashEstimate")}</Label>
            <Input className="mt-1" inputMode="decimal" value={fp.cash} onChange={(e) => setF("cash", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("goals.title")} · {t("category.savings")}</Label>
            <Input className="mt-1" inputMode="decimal" value={fp.emergency} onChange={(e) => setF("emergency", e.target.value)} />
          </div>
        </div>
        <label className="mt-3 flex items-center justify-between rounded-xl border px-4 py-3 text-sm max-w-md">
          {t("today.safeToSpend")}
          <Switch checked={fp.safeToSpend} onCheckedChange={(v) => setF("safeToSpend", v)} aria-label={t("today.safeToSpend")} />
        </label>
      </section>

      <section>
        <p className="mb-2 text-sm font-semibold">{t("settings.plan")}: <span className="uppercase text-accent">{plan}</span></p>
        <p className="text-xs text-muted-foreground">
          {t("settings.planLimits")}: {t("account.accounts")} {accounts?.length || 0}/{limits.accounts === Infinity ? "∞" : limits.accounts} ·
          {" "}{t("nav.goals")} {(goals || []).filter((g) => g.status === "active").length}/{limits.active_goals === Infinity ? "∞" : limits.active_goals}
        </p>
      </section>

      <section>
        <p className="mb-2 text-sm font-semibold">{t("settings.demoData")}</p>
        <p className="mb-2 text-xs text-muted-foreground">{t("settings.demoDataHint")}</p>
        <Button variant="outline" onClick={() => demo.mutate()} disabled={demo.isPending}>
          <Sparkles className="h-4 w-4 mr-1.5" aria-hidden />{demo.isPending ? t("common.loading") : t("settings.demoData")}
        </Button>
      </section>

      <section>
        <p className="mb-2 text-sm font-semibold">{t("auth.account")}</p>
        <p className="text-xs text-muted-foreground mb-2">{user?.email} · {t("settings.security")}: <button className="text-accent hover:underline" onClick={() => navigate("/privacy")}>{t("privacy.security")}</button></p>
        <Button variant="outline" onClick={() => logout("/login")}><LogOut className="h-4 w-4 mr-1.5" aria-hidden />{t("auth.signOut")}</Button>
      </section>

      <DisclaimerBanner />
    </div>
  );
}