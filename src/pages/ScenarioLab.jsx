import React, { useState } from "react";
import { useI18n } from "@/i18n";
import { useScenarios, useSaveScenario, useArchiveScenario, useScenarioResults, runSavingsScenario, runDebtScenario } from "@/app/services/scenario";
import { SCENARIO_TEMPLATES } from "@/domain/constants";
import { toCents, formatMoney } from "@/domain/money";
import PageHeader from "@/components/shared/PageHeader";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FlaskConical, Save, Archive, Eye } from "lucide-react";

const DEBT_TYPE = "debt_payoff";

export default function ScenarioLab() {
  const { t, language } = useI18n();
  const { data: scenarios } = useScenarios();
  const save = useSaveScenario();
  const archive = useArchiveScenario();
  const loc = language === "es" ? "es-ES" : language;
  const fmt = (c) => formatMoney(c, "EUR", loc);

  const [tplId, setTplId] = useState("save_50_week");
  const [form, setForm] = useState({ start: "", contribution: "50", frequency: "weekly", months: "12", rate: "0", inflation: "0", oneTime: "", debtBalance: "", debtRate: "", debtPayment: "", debtExtra: "100" });
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);

  const isDebt = tplId === "debt_extra" || (viewing && viewing.scenario_type === DEBT_TYPE);
  const tpl = SCENARIO_TEMPLATES.find((x) => x.id === tplId);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const run = () => {
    setError(null);
    if (tpl.type === DEBT_TYPE) {
      const balance = toCents(form.debtBalance);
      const rate = parseFloat(form.debtRate);
      const payment = toCents(form.debtPayment);
      const extra = toCents(form.debtExtra || "0");
      if (!Number.isInteger(balance) || balance <= 0 || !Number.isInteger(payment) || payment <= 0 || !Number.isFinite(rate) || rate < 0) {
        setError(t("validation.amountInvalid"));
        setResult(null);
        return;
      }
      setResult({ kind: "debt", data: runDebtScenario({ balanceCents: balance, annualRatePct: rate, monthlyPaymentCents: payment, extraPaymentCents: Number.isInteger(extra) && extra > 0 ? extra : 0 }) });
    } else {
      const contribution = toCents(form.contribution);
      const start = toCents(form.start || "0");
      const rate = parseFloat(form.rate || "0");
      const months = parseInt(form.months, 10);
      if (!Number.isInteger(contribution) || contribution < 0 || !Number.isFinite(rate) || rate < 0 || !Number.isInteger(months) || months < 1 || months > 600) {
        setError(t("validation.amountInvalid"));
        setResult(null);
        return;
      }
      if (rate > 0 && !ack) { setError(t("scenario.disclaimerAck")); return; }
      setResult({ kind: "savings", data: runSavingsScenario({ startCents: Number.isInteger(start) && start > 0 ? start : 0, contributionCents: Number.isInteger(contribution) ? contribution : 0, frequency: form.frequency, months, annualRatePct: rate, inflationPct: parseFloat(form.inflation || "0") }) });
    }
  };

  const doSave = async () => {
    setError(null);
    if (!ack) { setError(t("scenario.disclaimerAck")); return; }
    try {
      await save.mutateAsync({
        fields: {
          name: t(tpl.nameKey),
          scenario_type: tpl.type,
          duration_months: parseInt(form.months, 10) || 12,
          current_balance: toCents(form.start || "0"),
          recurring_contribution_amount: toCents(form.contribution || "0"),
          contribution_frequency: form.frequency,
          assumed_annual_rate_percentage: parseFloat(form.rate || "0"),
          annual_inflation_percentage: parseFloat(form.inflation || "0"),
          debt_balance: tpl.type === DEBT_TYPE ? toCents(form.debtBalance || "0") : undefined,
          debt_interest_rate_percentage: tpl.type === DEBT_TYPE ? parseFloat(form.debtRate || "0") : undefined,
          extra_debt_payment_amount: tpl.type === DEBT_TYPE ? toCents(form.debtExtra || "0") : undefined
        },
        projection: result?.kind === "savings" ? result.data : null
      });
    } catch (e) {
      setError(e?.errorKey ? t(e.errorKey) : t(e?.code === "plan_limit" ? "plan_limit" : "common.error"));
    }
  };

  return (
    <div>
      <PageHeader title={t("scenario.title")} subtitle={t("disclaimer.estimate") + " " + t("disclaimer.educational")} />

      <div className="flex flex-wrap gap-2 mb-6">
        {SCENARIO_TEMPLATES.map((x) => (
          <button
            key={x.id}
            onClick={() => { setTplId(x.id); setResult(null); setError(null); if (x.id === "save_50_week") setForm((f) => ({ ...f, contribution: "50", frequency: "weekly" })); if (x.id === "save_100_month" || x.id === "cancelSub") setForm((f) => ({ ...f, contribution: x.id === "cancelSub" ? "15" : "100", frequency: "monthly" })); }}
            className={"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " + (tplId === x.id ? "border-accent bg-accent/10 text-accent" : "hover:bg-muted")}
          >
            {t(x.nameKey)}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          {tpl.type !== DEBT_TYPE ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("scenario.startingAmount")}</Label>
                <Input className="mt-1" inputMode="decimal" value={form.start} onChange={(e) => set("start", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t("scenario.contribution")}</Label>
                <Input className="mt-1" inputMode="decimal" value={form.contribution} onChange={(e) => set("contribution", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t("scenario.frequency")}</Label>
                <Select value={form.frequency} onValueChange={(v) => set("frequency", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["weekly", "biweekly", "monthly", "yearly"].map((f) => <SelectItem key={f} value={f}>{t("frequency." + f)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("scenario.duration")}</Label>
                <Input className="mt-1" inputMode="numeric" value={form.months} onChange={(e) => set("months", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t("scenario.rate")}</Label>
                <Input className="mt-1" inputMode="decimal" value={form.rate} onChange={(e) => set("rate", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t("scenario.inflation")}</Label>
                <Input className="mt-1" inputMode="decimal" value={form.inflation} onChange={(e) => set("inflation", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("scenario.debtBalance")}</Label>
                <Input className="mt-1" inputMode="decimal" value={form.debtBalance} onChange={(e) => set("debtBalance", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t("scenario.debtRate")}</Label>
                <Input className="mt-1" inputMode="decimal" value={form.debtRate} onChange={(e) => set("debtRate", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t("scenario.debtPayment")}</Label>
                <Input className="mt-1" inputMode="decimal" value={form.debtPayment} onChange={(e) => set("debtPayment", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{t("scenario.debtExtra")}</Label>
                <Input className="mt-1" inputMode="decimal" value={form.debtExtra} onChange={(e) => set("debtExtra", e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">{t("scenario.debtNote")}</p>
            </div>
          )}

          <label className="mt-4 flex items-start gap-3 rounded-xl border p-3 text-xs cursor-pointer">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--accent))]" />
            <span>{t("scenario.disclaimerAck")}</span>
          </label>

          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}

          <div className="mt-4 flex gap-2">
            <Button onClick={run}><FlaskConical className="h-4 w-4 mr-1.5" aria-hidden />{t("scenario.results")}</Button>
            <Button variant="outline" onClick={doSave} disabled={!result || save.isPending}><Save className="h-4 w-4 mr-1.5" aria-hidden />{t("scenario.save")}</Button>
          </div>
        </div>

        <div>
          {result?.kind === "savings" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label={t("scenario.zeroReturn")} value={fmt(result.data.zeroReturnBalance)} />
                <StatCard label={t("scenario.projected")} value={fmt(result.data.projectedBalance)} tone="accent" />
                <StatCard label={t("scenario.totalContributions")} value={fmt(result.data.totalContributions)} />
                <StatCard label={t("scenario.inflationAdjusted")} value={fmt(result.data.inflationAdjustedValue)} />
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-sm font-semibold mb-2">{t("scenario.monthlyTimeline")}</p>
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={result.data.timeline.map((r) => ({ m: r.month_number, zero: r.zero_return_balance / 100, proj: r.projected_balance / 100 }))}>
                      <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={50} />
                      <Tooltip formatter={(v) => fmt(Math.round(v * 100))} />
                      <Legend />
                      <Line type="monotone" dataKey="zero" name={t("scenario.zeroReturn")} stroke="#0d9488" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="proj" name={t("scenario.projected")} stroke="#1d4ed8" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t("scenario.assumptions")}: {t("scenario.rate")} {form.rate || 0}% · {t("scenario.inflation")} {form.inflation || 0}%</p>
              </div>
            </div>
          )}

          {result?.kind === "debt" && (
            <div className="space-y-4">
              {!result.data.accelerated && <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{t("scenario.notReachable")}</p>}
              {result.data.baseline && result.data.accelerated && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <StatCard label={t("scenario.payoffMonths") + " · " + t("scenario.payoffComparison")} value={result.data.baseline.months + " → " + result.data.accelerated.months} />
                    <StatCard label={t("scenario.totalPaid")} value={fmt(result.data.accelerated.totalPaid)} hint={t("scenario.debtNote")} />
                    <StatCard label={t("scenario.interestPaid")} value={fmt(result.data.accelerated.interestPaid)} />
                    <StatCard label={t("scenario.interestPaid") + " · " + t("scenario.zeroReturn")} value={fmt(result.data.baseline.interestPaid)} tone="muted" />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("scenario.debtNote")}</p>
                </>
              )}
            </div>
          )}

          {!result && <EmptyState icon={FlaskConical} title={t("scenario.templates")} description={t("disclaimer.estimate")} />}
        </div>
      </div>

      <section className="mt-8">
        <p className="mb-3 text-sm font-semibold">{t("scenario.saved")}</p>
        {(scenarios || []).filter((s) => !s.archived).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty.scenarios")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(scenarios || []).filter((s) => !s.archived).map((s) => (
              <div key={s.id} className="rounded-2xl border bg-card p-4">
                <p className="font-semibold text-sm">{s.name && s.name.startsWith("scenario.tpl.") ? t(s.name) : s.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.duration_months} {t("common.details")}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setViewing(s)}><Eye className="h-3.5 w-3.5 mr-1" aria-hidden />{t("common.details")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => archive.mutate(s.id)}><Archive className="h-3.5 w-3.5" aria-hidden /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <DisclaimerBanner className="mt-8" />

      <ViewDialog scenario={viewing} onClose={() => setViewing(null)} fmt={fmt} t={t} />
    </div>
  );
}

function ViewDialog({ scenario, onClose, fmt, t }) {
  const { data: results } = useScenarioResults(scenario?.id);
  return (
    <Dialog open={!!scenario} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{scenario && scenario.name.startsWith("scenario.tpl.") ? t(scenario.name) : scenario?.name}</DialogTitle>
        </DialogHeader>
        {scenario?.scenario_type === DEBT_TYPE ? (
          <div className="text-sm text-muted-foreground">
            <p>{t("scenario.payoffMonths")}: {scenario.baseline_result?.months} → {scenario.projected_result?.months}</p>
            <p>{t("scenario.totalPaid")}: {fmt(scenario.projected_result?.totalPaid || 0)}</p>
            <p className="mt-2">{t("scenario.debtNote")}</p>
          </div>
        ) : results && results.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={results.map((r) => ({ m: r.month_number, zero: r.zero_return_balance / 100, proj: r.projected_balance / 100 }))}>
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(v) => fmt(Math.round(v * 100))} />
                <Legend />
                <Line type="monotone" dataKey="zero" name={t("scenario.zeroReturn")} stroke="#0d9488" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="proj" name={t("scenario.projected")} stroke="#1d4ed8" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("disclaimer.estimate")}</p>
      </DialogContent>
    </Dialog>
  );
}