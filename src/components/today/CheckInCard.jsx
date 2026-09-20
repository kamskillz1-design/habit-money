import React, { useState } from "react";
import { useI18n } from "@/i18n";
import { useSubmitCheckIn, useCheckIn } from "@/app/services/coaching";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sunrise, CheckCircle2 } from "lucide-react";

const LEVELS = ["very_low", "low", "neutral", "high", "very_high"];

export default function CheckInCard() {
  const { t } = useI18n();
  const submit = useSubmitCheckIn();
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = useCheckIn(today);
  const [confidence, setConfidence] = useState("neutral");
  const [intentional, setIntentional] = useState(true);
  const [note, setNote] = useState("");
  const [focus, setFocus] = useState("");

  if (existing) {
    return (
      <div id="checkin" className="rounded-2xl border border-chart-3/30 bg-chart-3/5 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-chart-3" aria-hidden />
          <p className="text-sm font-semibold">{t("today.checkInDone")}</p>
        </div>
      </div>
    );
  }

  return (
    <div id="checkin" className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sunrise className="h-4 w-4 text-accent" aria-hidden />
        <p className="text-sm font-semibold">{t("today.checkIn")}</p>
      </div>
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">{t("checkin.spendingConfidence")}</Label>
          <Select value={confidence} onValueChange={setConfidence}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{t("checkin." + l)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <Label className="text-xs">{t("checkin.spentIntentionally")}</Label>
          <Switch checked={intentional} onCheckedChange={setIntentional} aria-label={t("checkin.spentIntentionally")} />
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("checkin.note")} className="min-h-[60px] text-sm" />
        <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder={t("checkin.focusTomorrow")} className="text-sm" />
        <Button
          size="sm"
          className="w-full"
          disabled={submit.isPending}
          onClick={() => submit.mutate({ spending_confidence: confidence, spent_intentionally: intentional, note: note.trim() || undefined, selected_focus_for_tomorrow: focus.trim() || undefined })}
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" aria-hidden />
          {t("checkin.submit")}
        </Button>
      </div>
    </div>
  );
}