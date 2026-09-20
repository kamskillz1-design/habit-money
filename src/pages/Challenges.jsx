import React, { useState } from "react";
import { useI18n } from "@/i18n";
import { useChallenges, useStartChallenge, useCompleteChallenge, useUpdateChallengeProgress, useSkipChallenge } from "@/app/services/coaching";
import { CHALLENGE_LIBRARY } from "@/domain/constants";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ProgressBar from "@/components/shared/ProgressBar";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trophy, Plus, Play, CheckCircle2, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Challenges() {
  const { t } = useI18n();
  const { data: challenges } = useChallenges();
  const start = useStartChallenge();
  const complete = useCompleteChallenge();
  const updateProgress = useUpdateChallengeProgress();
  const skip = useSkipChallenge();

  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({ title: "", description: "" });
  const [error, setError] = useState(null);
  const [skipFor, setSkipFor] = useState(null);
  const [skipReason, setSkipReason] = useState("");

  const list = challenges || [];
  const active = list.filter((c) => c.status === "active");
  const done = list.filter((c) => c.status === "completed");

  const title = (c) => (c.title && c.title.startsWith("challenge.")) || (c.title && c.title.startsWith("nudge.")) ? t(c.title) : c.title;

  const checkIn = (c) => {
    const progress = (c.current_progress || 0) + 1;
    if (progress >= (c.target_value || 1)) {
      complete.mutate({ ...c, current_progress: progress });
    } else {
      updateProgress.mutate({ id: c.id, current_progress: progress, target_value: c.target_value });
    }
  };

  return (
    <div>
      <PageHeader
        title={t("challenges.title")}
        subtitle={t("challenges.privacyNote")}
        action={<Button onClick={() => { setCustomOpen(true); setError(null); }}><Plus className="h-4 w-4 mr-1.5" aria-hidden />{t("challenges.custom")}</Button>}
      />

      <section className="mb-8">
        <p className="mb-3 text-sm font-semibold">{t("challenges.active")}</p>
        {active.length === 0 ? (
          <EmptyState icon={Trophy} title={t("challenges.noActive")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((c) => (
              <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="font-semibold">{title(c)}</p>
                <ProgressBar value={c.current_progress} max={c.target_value || 1} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">{c.completion_percentage || 0}% · {c.unit} · {t("challenges.reward", { points: c.reward_points })}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => checkIn(c)}><CheckCircle2 className="h-4 w-4 mr-1" aria-hidden />{t("challenges.checkIn")}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setSkipFor(c); setSkipReason(""); }}>{t("challenges.skip")}</Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{t("challenges.encourage")}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <p className="mb-3 text-sm font-semibold">{t("challenges.library")}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHALLENGE_LIBRARY.map((tpl) => (
            <div key={tpl.id} className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{t(tpl.titleKey)}</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{tpl.difficulty}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t(tpl.descKey)}</p>
              <p className="mt-2 text-xs italic text-muted-foreground">{t(tpl.rulesKey)}</p>
              <p className="mt-2 text-xs text-muted-foreground">{tpl.duration_days} {t("common.details")} · {t("challenges.reward", { points: tpl.points })}</p>
              <Button size="sm" className="mt-3" variant="outline" onClick={() => start.mutate({ libraryId: tpl.id })} disabled={start.isPending}>
                <Play className="h-3.5 w-3.5 mr-1.5" aria-hidden />{t("challenges.start")}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <p className="mb-3 text-sm font-semibold">{t("challenges.completed")}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {done.map((c) => (
              <div key={c.id} className={cn("flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-medium whitespace-nowrap")}>
                <Trophy className="h-4 w-4 text-chart-4" aria-hidden />
                {title(c)}
              </div>
            ))}
          </div>
        </section>
      )}

      <DisclaimerBanner compact className="mt-8" />

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("challenges.custom")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("challenges.customTitle")}</Label>
              <Input className="mt-1" value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t("challenges.customDesc")}</Label>
              <Textarea className="mt-1 min-h-[70px]" value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} />
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCustomOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={async () => {
                setError(null);
                try { await start.mutateAsync({ custom }); setCustomOpen(false); setCustom({ title: "", description: "" }); }
                catch (e) { setError(e?.errorKey ? t(e.errorKey) : t("common.error")); }
              }}
              disabled={start.isPending}
            >
              {t("challenges.start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!skipFor} onOpenChange={(o) => !o && setSkipFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("challenges.skip")}</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">{t("challenges.skipReason")}</Label>
            <Textarea className="mt-1 min-h-[60px]" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSkipFor(null)}>{t("common.cancel")}</Button>
            <Button variant="outline" onClick={() => { skip.mutate({ id: skipFor.id, reason: skipReason }); setSkipFor(null); }}>
              <SkipForward className="h-4 w-4 mr-1.5" aria-hidden />{t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}