import React, { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { useSaveTransaction } from "@/app/services/finance";
import { useShareWithHousehold } from "@/app/services/household";
import { DIRECTIONS } from "@/domain/constants";
import { toCents } from "@/domain/money";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// Manual transaction entry: validated at the service boundary, archived rather than deleted.
export default function TransactionDialog({ open, onOpenChange, initial, accounts, categories, defaultDirection = "expense", onDone }) {
  const { t } = useI18n();
  const save = useSaveTransaction();
  const share = useShareWithHousehold();
  const [form, setForm] = useState(() => empty(defaultDirection));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setForm(initial ? fromTransaction(initial) : empty(defaultDirection));
    }
  }, [open, initial, defaultDirection]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    try {
      const saved = await save.mutateAsync({
        id: initial?.id,
        fields: {
          account_id: form.account_id || accounts?.[0]?.id,
          category_id: form.is_transfer ? undefined : form.category_id,
          transaction_date: form.transaction_date,
          amount: toCents(form.amount),
          direction: form.is_transfer ? (form.direction === "income" ? "transfer_in" : "transfer_out") : form.direction,
          merchant_name: form.merchant_name || undefined,
          notes: form.notes || undefined,
          is_transfer: form.is_transfer,
          is_refund: form.is_refund,
          is_recurring: form.is_recurring,
          is_excluded_from_budget: !form.include_budget,
          is_excluded_from_insights: !form.include_insights
        }
      });
      if (form.share && saved?.id) {
        try { await share.mutateAsync({ entity: "Transaction", id: saved.id }); } catch (e) { /* sharing is best-effort; the transaction itself saved */ }
      }
      onOpenChange(false);
      onDone && onDone();
    } catch (e) {
      setError(e?.errorKey ? t(e.errorKey) : t("common.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? t("spending.editTransaction") : t("spending.addTransaction")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{t("common.date")}</Label>
            <Input type="date" className="mt-1" value={form.transaction_date} onChange={(e) => set("transaction_date", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("common.account")}</Label>
            <Select value={form.account_id || accounts?.[0]?.id} onValueChange={(v) => set("account_id", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(accounts || []).filter((a) => !a.archived).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("common.amount")}</Label>
            <Input className="mt-1" inputMode="decimal" placeholder="12,50" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("common.status")}</Label>
            <Select value={form.direction} onValueChange={(v) => set("direction", v)} disabled={form.is_transfer}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["income", "expense", "savings_contribution", "debt_payment", "refund"].map((d) => <SelectItem key={d} value={d}>{t("direction." + d)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className={form.is_transfer ? "opacity-40 pointer-events-none" : ""}>
            <Label className="text-xs">{t("common.category")}</Label>
            <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(categories || []).filter((c) => !c.archived).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("common.merchant")}</Label>
            <Input className="mt-1" value={form.merchant_name} onChange={(e) => set("merchant_name", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">{t("common.notes")}</Label>
            <Textarea className="mt-1 min-h-[60px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            {t("spending.markAsTransfer")} <Switch checked={form.is_transfer} onCheckedChange={(v) => set("is_transfer", v)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            {t("spending.recurring")} <Switch checked={form.is_recurring} onCheckedChange={(v) => set("is_recurring", v)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            {t("spending.includeInBudget")} <Switch checked={form.include_budget} onCheckedChange={(v) => set("include_budget", v)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            {t("spending.includeInInsights")} <Switch checked={form.include_insights} onCheckedChange={(v) => set("include_insights", v)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            {t("spending.shareWithHousehold")} <Switch checked={form.share} onCheckedChange={(v) => set("share", v)} />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? t("common.loading") : t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function empty(direction) {
  return {
    transaction_date: new Date().toISOString().slice(0, 10),
    amount: "",
    direction,
    category_id: "",
    merchant_name: "",
    notes: "",
    is_transfer: false,
    is_recurring: false,
    is_refund: false,
    include_budget: true,
    include_insights: true,
    share: false
  };
}

function fromTransaction(tx) {
  return {
    transaction_date: tx.transaction_date,
    amount: (tx.amount / 100).toFixed(2),
    direction: tx.direction,
    category_id: tx.category_id || "",
    merchant_name: tx.merchant_name || "",
    notes: tx.notes || "",
    is_transfer: !!tx.is_transfer,
    is_recurring: !!tx.is_recurring,
    is_refund: !!tx.is_refund,
    include_budget: !tx.is_excluded_from_budget,
    include_insights: !tx.is_excluded_from_insights,
    share: !!tx.is_shared
  };
}