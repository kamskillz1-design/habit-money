import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useRecurringItems, useCategories, useAccounts, useSaveRecurring, useMarkRecurringPaid } from "@/app/services/finance";
import { formatMoney, formatDate, toCents } from "@/domain/money";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatCard from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CalendarClock, Plus, CheckCircle2, Pause, Pencil, Trophy } from "lucide-react";

const FREQS = ["weekly", "biweekly", "monthly", "quarterly", "yearly"];
const monthlyFactor = (f) => ({ weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[f] || 1);

export default function Bills() {
  const { t, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const { data: items } = useRecurringItems();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const save = useSaveRecurring();
  const markPaid = useMarkRecurringPaid();

  const loc = language === "es" ? "es-ES" : language;
  const fmt = (c) => formatMoney(c, "EUR", loc);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [window, setWindow] = useState("14");
  const [dialog, setDialog] = useState({ open: false, initial: null });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (params.get("new")) {
      setDialog({ open: true, initial: null });
      params.delete("new");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = items || [];
  const activeItems = list.filter((r) => r.status === "active" && !r.archived);
  const subs = activeItems.filter((r) => r.is_subscription);
  const monthlyTotal = activeItems.filter((r) => r.direction === "expense").reduce((a, r) => a + Math.round(r.amount * monthlyFactor(r.frequency)), 0);
  const annualSubs = subs.filter((r) => r.direction === "expense").reduce((a, r) => a + Math.round(r.amount * monthlyFactor(r.frequency) * 12), 0);

  const horizon = window === "all" ? null : new Date(Date.now() + parseInt(window, 10) * 86400000).toISOString().slice(0, 10);
  const upcoming = activeItems
    .filter((r) => r.next_due_date >= todayStr && (!horizon || r.next_due_date <= horizon))
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));

  return (
    <div>
      <PageHeader
        title={t("bills.title")}
        subtitle={t("help.billsBody")}
        action={<Button onClick={() => { setDialog({ open: true, initial: null }); setError(null); }}><Plus className="h-4 w-4 mr-1.5" aria-hidden />{t("bills.newBill")}</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard label={t("bills.monthlyTotal")} value={fmt(monthlyTotal)} icon={CalendarClock} />
        <StatCard label={t("bills.annualEstimate")} value={fmt(annualSubs)} hint={t("bills.subscriptions") + ": " + subs.length} />
      </div>

      <div className="flex gap-2 mb-4">
        {["7", "14", "30", "all"].map((w) => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            className={"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " + (window === w ? "border-accent bg-accent/10 text-accent" : "hover:bg-muted")}
          >
            {w === "all" ? t("common.all") : w === "7" ? t("bills.next7") : w === "14" ? t("bills.next14") : t("bills.next30")}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("bills.noBills")} action={<Button variant="outline" onClick={() => setDialog({ open: true, initial: null })}>{t("bills.newBill")}</Button>} />
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <ul className="divide-y">
            {upcoming.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{t("common.empty")}</li>}
            {upcoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}{r.is_subscription ? " · " + t("bills.subscriptions") : ""}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("bills.nextDue")}: {formatDate(r.next_due_date, loc)} · {t("frequency." + (FREQS.includes(r.frequency) ? r.frequency : "monthly"))}
                    {r.status === "paused" ? " · " + t("common.pause") : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0">{fmt(r.amount)}</p>
                <div className="flex shrink-0 gap-1">
                  {r.is_subscription && (
                    <Button asChild size="sm" variant="ghost" className="text-accent"><Link to="/challenges"><Trophy className="h-3.5 w-3.5" aria-hidden /></Link></Button>
                  )}
                  <button aria-label={t("bills.markPaid")} onClick={() => markPaid.mutate(r)} className="rounded-lg p-1.5 hover:bg-muted"><CheckCircle2 className="h-4 w-4 text-chart-3" aria-hidden /></button>
                  <button aria-label={t("common.pause")} onClick={() => save.mutate({ id: r.id, fields: { status: r.status === "paused" ? "active" : "paused" } })} className="rounded-lg p-1.5 hover:bg-muted"><Pause className="h-4 w-4" aria-hidden /></button>
                  <button aria-label={t("common.edit")} onClick={() => { setDialog({ open: true, initial: r }); setError(null); }} className="rounded-lg p-1.5 hover:bg-muted"><Pencil className="h-4 w-4" aria-hidden /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">{t("help.billsBody")}</p>

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dialog.initial ? t("common.edit") : t("bills.newBill")}</DialogTitle></DialogHeader>
          <RecurringForm initial={dialog.initial} categories={categories} accounts={accounts} save={save} onDone={() => setDialog({ open: false, initial: null })} error={error} setError={setError} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecurringForm({ initial, categories, accounts, save, onDone, error, setError }) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => ({
    name: initial?.name || "",
    amount: initial ? (initial.amount / 100).toFixed(2) : "",
    frequency: initial?.frequency || "monthly",
    next_due_date: initial?.next_due_date || new Date().toISOString().slice(0, 10),
    category_id: initial?.category_id || "",
    account_id: initial?.account_id || "",
    is_subscription: !!initial?.is_subscription,
    reminder_days_before: initial?.reminder_days_before ?? 3,
    notes: initial?.notes || "",
    direction: initial?.direction || "expense"
  }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    const cents = toCents(form.amount);
    if (!form.name.trim() || !Number.isInteger(cents) || cents <= 0) { setError(t("validation.amountInvalid")); return; }
    try {
      await save.mutateAsync({ id: initial?.id, fields: { ...form, amount: cents, category_id: form.category_id || undefined, account_id: form.account_id || undefined, notes: form.notes || undefined } });
      onDone();
    } catch (e) {
      setError(e?.errorKey ? t(e.errorKey) : t("common.error"));
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Label className="text-xs">{t("challenges.customTitle")}</Label>
        <Input className="mt-1" value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">{t("common.amount")}</Label>
        <Input className="mt-1" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">{t("scenario.frequency")}</Label>
        <Select value={form.frequency} onValueChange={(v) => set("frequency", v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>{FREQS.map((f) => <SelectItem key={f} value={f}>{t("frequency." + f)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">{t("bills.nextDue")}</Label>
        <Input className="mt-1" type="date" value={form.next_due_date} onChange={(e) => set("next_due_date", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">{t("common.category")}</Label>
        <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>{(categories || []).filter((c) => c.category_type.includes("expense")).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <label className="col-span-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
        {t("bills.subscriptions")} <Switch checked={form.is_subscription} onCheckedChange={(v) => set("is_subscription", v)} />
      </label>
      <div className="col-span-2">
        <Label className="text-xs">{t("bills.notes")}</Label>
        <Textarea className="mt-1 min-h-[52px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      {error && <p className="col-span-2 text-sm text-destructive" role="alert">{error}</p>}
      <DialogFooter className="col-span-2 mt-2">
        <Button variant="outline" onClick={onDone}>{t("common.cancel")}</Button>
        <Button onClick={submit} disabled={save.isPending}>{t("common.save")}</Button>
      </DialogFooter>
    </div>
  );
}