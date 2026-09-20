import React, { useState } from "react";
import { useI18n } from "@/i18n";
import { useSaveGoal } from "@/app/services/goals";
import { GOAL_TYPES, PRIORITIES } from "@/domain/constants";
import { toCents } from "@/domain/money";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function GoalDialog({ open, onOpenChange, initial, onSaved }) {
  const { t } = useI18n();
  const saveGoal = useSaveGoal();
  const [form, setForm] = useState({ name: "", goal_type: "emergency_fund", target_amount: "", target_date: "", priority: "medium", description: "" });
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setLoaded(initial?.id || "new");
      setForm(initial
        ? { name: initial.name, goal_type: initial.goal_type || "other", target_amount: (initial.target_amount / 100).toFixed(2), target_date: initial.target_date || "", priority: initial.priority || "medium", description: initial.description || "" }
        : { name: "", goal_type: "emergency_fund", target_amount: "", target_date: "", priority: "medium", description: "" });
    }
  }, [open, initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    const cents = toCents(form.target_amount);
    if (!form.name.trim()) { setError(t("validation.required")); return; }
    if (!Number.isInteger(cents) || cents <= 0) { setError(t("validation.amountInvalid")); return; }
    try {
      await saveGoal.mutateAsync({
        id: initial?.id,
        fields: {
          name: form.name,
          goal_type: form.goal_type,
          target_amount: cents,
          target_date: form.target_date || undefined,
          priority: form.priority,
          description: form.description || undefined,
          status: initial?.status || "active"
        }
      });
      onOpenChange(false);
      onSaved && onSaved();
    } catch (e) {
      setError(e?.errorKey ? t(e.errorKey) : t(e?.code === "plan_limit" ? "plan_limit" : "common.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? t("common.edit") : t("goals.newGoal")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">{t("challenges.customTitle")}</Label>
            <Input className="mt-1" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("common.category")}</Label>
            <Select value={form.goal_type} onValueChange={(v) => set("goal_type", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{GOAL_TYPES.map((g) => <SelectItem key={g} value={g}>{g.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("goals.priority")}</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t("priority." + p)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("goals.targetAmount")}</Label>
            <Input className="mt-1" inputMode="decimal" value={form.target_amount} onChange={(e) => set("target_amount", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("goals.targetDate")}</Label>
            <Input className="mt-1" type="date" value={form.target_date} onChange={(e) => set("target_date", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">{t("common.notes")}</Label>
            <Textarea className="mt-1 min-h-[56px]" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={saveGoal.isPending}>{saveGoal.isPending ? t("common.loading") : t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}