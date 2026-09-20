import React, { useState } from "react";
import { useI18n } from "@/i18n";
import { useGoals, useSaveGoal, useContribute, useArchiveGoal } from "@/app/services/goals";
import { formatMoney, formatDate, toCents } from "@/domain/money";
import { suggestedContributions } from "@/domain/scenarioMath";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ProgressBar from "@/components/shared/ProgressBar";
import GoalDialog from "@/components/goals/GoalDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Plus, MoreVertical, Pause, CheckCircle2, Archive, PiggyBank } from "lucide-react";

export default function Goals() {
  const { t, language } = useI18n();
  const { data: goals } = useGoals();
  const saveGoal = useSaveGoal();
  const archiveGoal = useArchiveGoal();
  const contribute = useContribute();
  const loc = language === "es" ? "es-ES" : language;
  const fmt = (c) => formatMoney(c, "EUR", loc);

  const [dialog, setDialog] = useState({ open: false, initial: null });
  const [contributeGoal, setContributeGoal] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [milestone, setMilestone] = useState(null);

  const openNew = () => setDialog({ open: true, initial: null });

  const doContribute = async () => {
    setError(null);
    const cents = toCents(amount);
    if (!Number.isInteger(cents) || cents <= 0) { setError(t("validation.amountInvalid")); return; }
    try {
      const res = await contribute.mutateAsync({
        goalId: contributeGoal.id,
        amountCents: cents,
        contributionDate: new Date().toISOString().slice(0, 10),
        note: note.trim() || undefined
      });
      if (res && res.ok) {
        setMilestone(res.milestones && res.milestones.length ? res.milestones[res.milestones.length - 1] : null);
        setAmount("");
        setNote("");
      } else {
        setError(t("common.error"));
      }
    } catch (e) {
      setError(t("common.error"));
    }
  };

  return (
    <div>
      <PageHeader title={t("goals.title")} subtitle={t("goals.shareHint")} action={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" aria-hidden />{t("goals.newGoal")}</Button>} />

      {(goals || []).filter((g) => !g.archived).length === 0 ? (
        <EmptyState icon={Target} title={t("goals.noGoals")} action={<Button onClick={openNew}>{t("goals.newGoal")}</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(goals || []).filter((g) => !g.archived).map((g) => {
            const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
            const sugg = suggestedContributions({ targetCents: g.target_amount, currentCents: g.current_amount, targetDate: g.target_date });
            const tight = sugg.monthly && g.suggested_monthly_contribution && sugg.monthly > g.suggested_monthly_contribution * 1.2;
            return (
              <div key={g.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{t("priority." + (g.priority || "medium"))} · {g.status === "paused" ? t("common.pause") : ""}{g.is_shared ? " · " + t("common.shared") : ""}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-lg p-1.5 hover:bg-muted" aria-label={t("common.actions")}><MoreVertical className="h-4 w-4" aria-hidden /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDialog({ open: true, initial: g })}>{t("common.edit")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => saveGoal.mutate({ id: g.id, fields: { status: g.status === "paused" ? "active" : "paused" } })}>
                        {g.status === "paused" ? t("common.resume") : t("goals.pause")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => saveGoal.mutate({ id: g.id, fields: { status: "completed", completed_at: new Date().toISOString() } })}>{t("goals.complete")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => archiveGoal.mutate({ id: g.id, archived: true })}>{t("common.archive")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <ProgressBar value={g.current_amount} max={g.target_amount} className="mt-4" />
                <p className="mt-2 text-sm font-semibold tabular-nums">{fmt(g.current_amount)} <span className="text-muted-foreground font-normal">{t("common.of")} {fmt(g.target_amount)} · {pct}%</span></p>
                <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                  {g.target_date && <p>{t("goals.targetDate")}: {formatDate(g.target_date, loc)}</p>}
                  {sugg.monthly != null && <p>{t("goals.monthlySuggestion")}: {fmt(sugg.monthly)}</p>}
                  {tight && <p className="text-chart-4">{t("goals.deadlineTight")}</p>}
                </div>
                <Button size="sm" className="mt-3 w-full" onClick={() => { setContributeGoal(g); setAmount(""); setNote(""); setMilestone(null); setError(null); }}>
                  <PiggyBank className="h-4 w-4 mr-1.5" aria-hidden />{t("goals.contribute")}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <GoalDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} initial={dialog.initial} />

      <Dialog open={!!contributeGoal} onOpenChange={(o) => !o && setContributeGoal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("goals.contribute")}{contributeGoal ? " · " + contributeGoal.name : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("common.amount")}</Label>
              <Input className="mt-1" inputMode="decimal" placeholder="25" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("common.notes")} ({t("common.optional")})</Label>
              <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          {milestone && <p className="mt-2 text-sm text-chart-3 font-medium">🎉 {t("goals.milestone")} {milestone}%</p>}
          {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setContributeGoal(null)}>{t("common.close")}</Button>
            <Button onClick={doContribute} disabled={contribute.isPending}>{contribute.isPending ? t("common.loading") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}