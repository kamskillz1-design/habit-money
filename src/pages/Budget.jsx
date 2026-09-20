import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useBudgetPeriods, useAllocations, useCreateBudget, useUpdateAllocation, useClosePeriod, persistActuals } from "@/app/services/budget";
import { useTransactions, useCategories } from "@/app/services/finance";
import { useFinancialProfile } from "@/app/services/profile";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatCard from "@/components/shared/StatCard";
import ProgressBar from "@/components/shared/ProgressBar";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, sumCents, toCents } from "@/domain/money";
import { Wallet, Plus, Trophy, Pencil, MoreHorizontal } from "lucide-react";

const TEMPLATES = ["50_30_20", "essential_first", "zero_based", "student", "family", "flexible"];

export default function Budget() {
  const { t, language } = useI18n();
  const qc = useQueryClient();
  const { data: periods } = useBudgetPeriods();
  const { data: transactions } = useTransactions();
  const { data: categories } = useCategories();
  const { data: finProfile } = useFinancialProfile();
  const createBudget = useCreateBudget();
  const updateAllocation = useUpdateAllocation();
  const closePeriod = useClosePeriod();

  const todayStr = new Date().toISOString().slice(0, 10);
  const periodList = periods || [];
  const active = periodList.find((p) => p.status === "active" && p.period_start <= todayStr && p.period_end >= todayStr);
  const [selectedId, setSelectedId] = useState(null);
  const currentId = selectedId || active?.id || periodList[0]?.id;
  const period = periodList.find((p) => p.id === currentId);
  const { data: allocations } = useAllocations(currentId);
  const catById = useMemo(() => Object.fromEntries((categories || []).map((c) => [c.id, c])), [categories]);
  const loc = language === "es" ? "es-ES" : language;
  const fmt = (c) => formatMoney(c, period ? "EUR" : "EUR", loc);

  const [createOpen, setCreateOpen] = useState(false);
  const [template, setTemplate] = useState("50_30_20");
  const [income, setIncome] = useState("");
  const [essentials, setEssentials] = useState("");
  const [editAlloc, setEditAlloc] = useState(null);
  const [editValue, setEditValue] = useState("");

  const actualsByCat = useMemo(() => {
    const map = {};
    (transactions || [])
      .filter((x) => !x.archived && !x.is_excluded_from_budget && !x.is_transfer && x.direction === "expense" && period && x.transaction_date >= period.period_start && x.transaction_date <= period.period_end)
      .forEach((x) => { map[x.category_id] = (map[x.category_id] || 0) + x.amount; });
    return map;
  }, [transactions, period]);

  // Persist recalculated actuals once per period (idempotent — only changed rows update).
  const persistedRef = useRef(null);
  useEffect(() => {
    if (!allocations || !period || !finProfile) return;
    const key = period.id + ":" + sumCents(Object.values(actualsByCat));
    if (persistedRef.current === key) return;
    persistedRef.current = key;
    const changed = allocations.filter((a) => (a.actual_amount || 0) !== (actualsByCat[a.category_id] || 0));
    if (changed.length > 0) {
      persistActuals({ allocations, actualsByCategory: actualsByCat, userId: "current" }).then(() => qc.invalidateQueries({ queryKey: ["allocations"] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocations, actualsByCat, period]);

  const openCreate = () => {
    setIncome(finProfile?.monthly_income_target ? (finProfile.monthly_income_target / 100).toFixed(0) : "");
    setEssentials(finProfile?.essential_expense_target ? (finProfile.essential_expense_target / 100).toFixed(0) : "");
    setCreateOpen(true);
  };

  const doCreate = async () => {
    try {
      const p = await createBudget.mutateAsync({
        templateId: template,
        incomeCents: income ? toCents(income) : 0,
        essentialCents: essentials ? toCents(essentials) : 0,
        monthOffset: 0,
        categories: categories || []
      });
      setSelectedId(p.id);
      setCreateOpen(false);
    } catch (e) { /* validation prevents invalid creates */ }
  };

  const actualTotal = sumCents(allocations || [], (a) => actualsByCat[a.category_id] || 0);

  return (
    <div>
      <PageHeader
        title={t("budget.title")}
        subtitle={t("budget.allocations")}
        action={
          <>
            {periodList.length > 0 && (
              <Select value={currentId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periodList.map((p) => <SelectItem key={p.id} value={p.id}>{p.month_label} {p.status === "closed" ? "· " + t("common.done") : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" aria-hidden />{t("budget.createWizard")}</Button>
          </>
        }
      />

      {periodList.length === 0 ? (
        <EmptyState icon={Wallet} title={t("budget.noBudget")} description={t("budget.createWizard")} action={<Button onClick={openCreate}>{t("budget.createWizard")}</Button>} />
      ) : period && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <StatCard label={t("budget.income")} value={fmt(period.income_actual || period.income_planned || 0)} hint={`${t("common.planned")}: ${fmt(period.income_planned || 0)}`} icon={Plus} />
            <StatCard label={t("budget.expenses")} value={`${Math.round((actualTotal / Math.max(1, period.total_expense_budget)) * 100)}%`} hint={`${fmt(actualTotal)} / ${fmt(period.total_expense_budget || 0)}`} icon={Wallet}>
              <ProgressBar value={actualTotal} max={period.total_expense_budget || 1} className="mt-3" />
            </StatCard>
            <StatCard label={t("budget.savings")} value={fmt(period.total_savings_target || 0)} hint={t("goals.monthlySuggestion")} icon={Trophy} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(allocations || []).map((a) => {
              const actual = actualsByCat[a.category_id] || 0;
              const planned = a.planned_amount || 0;
              const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
              const threshold = a.alert_threshold_percentage || 80;
              const alert = pct >= 100 ? "over" : pct >= threshold ? "watch" : "ok";
              return (
                <div key={a.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{catById[a.category_id]?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{fmt(actual)} / {fmt(planned)} · {t("common.remaining")}: {fmt(Math.max(0, planned - actual))}</p>
                    </div>
                    <Popover>
                      <PopoverTrigger className="rounded-lg p-1.5 hover:bg-muted" aria-label={t("common.actions")}><MoreHorizontal className="h-4 w-4" aria-hidden /></PopoverTrigger>
                      <PopoverContent className="w-56 text-sm">
                        <button className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted" onClick={() => { setEditAlloc(a); setEditValue((planned / 100).toFixed(2)); }}>
                          <Pencil className="inline h-3.5 w-3.5 mr-2" aria-hidden />{t("budget.moveAmount")}
                        </button>
                        <Link to="/challenges" className="block rounded-lg px-2 py-1.5 hover:bg-muted"><Trophy className="inline h-3.5 w-3.5 mr-2" aria-hidden />{t("quick.startChallenge")}</Link>
                        <button className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted" onClick={() => updateAllocation.mutate({ id: a.id, planned_amount: planned, notes: (a.notes ? a.notes + "\n" : "") + "Planned exception noted" })}>
                          {t("budget.markException")}
                        </button>
                        <button className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted" onClick={() => updateAllocation.mutate({ id: a.id, planned_amount: planned, alert_threshold_percentage: 200 })}>
                          {t("budget.paused")}
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <ProgressBar value={actual} max={planned || 1} className="mt-3" />
                  {alert !== "ok" && (
                    <p className={alert === "over" ? "mt-2 text-xs text-destructive" : "mt-2 text-xs text-chart-4"}>
                      {alert === "over" ? t("budget.alert100") : t("budget.alert80", { pct })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {period.status === "active" && period.period_end < todayStr && (
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => closePeriod.mutate({ periodId: period.id, totals: { income: sumCents((transactions || []).filter((x) => !x.archived && x.direction === "income" && x.transaction_date >= period.period_start && x.transaction_date <= period.period_end), (x) => x.amount), expense: actualTotal, savings: sumCents((transactions || []).filter((x) => !x.archived && x.direction === "savings_contribution" && x.transaction_date >= period.period_start && x.transaction_date <= period.period_end), (x) => x.amount) } })}
            >
              {t("budget.closeout")}
            </Button>
          )}
          <DisclaimerBanner compact className="mt-6" />
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("budget.createWizard")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("budget.template")}</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TEMPLATES.map((x) => <SelectItem key={x} value={x}>{t("template." + x)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("onboarding.monthlyIncome")}</Label>
              <Input className="mt-1" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("onboarding.essentialCosts")}</Label>
              <Input className="mt-1" inputMode="decimal" value={essentials} onChange={(e) => setEssentials(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={doCreate} disabled={createBudget.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAlloc} onOpenChange={(o) => !o && setEditAlloc(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("budget.moveAmount")}</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">{t("common.amount")}</Label>
            <Input className="mt-1" inputMode="decimal" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditAlloc(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => { const cents = toCents(editValue); if (Number.isInteger(cents) && cents >= 0) updateAllocation.mutate({ id: editAlloc.id, planned_amount: cents }); setEditAlloc(null); }}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}