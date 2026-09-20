import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useConsentRecords, useSetConsent, usePrivacyRequests, useCreatePrivacyRequest, useExportRequests, useRequestExport, useAuditLog, useDeleteImportedData } from "@/app/services/privacy";
import PageHeader from "@/components/shared/PageHeader";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Download, Trash2, Lock } from "lucide-react";

const CONSENTS = ["marketing_email", "product_updates_email", "push_notifications", "analytics_optional", "household_sharing"];
const REQUEST_TYPES = ["data_access", "data_export", "correction", "anonymisation", "deletion", "account_closure", "consent_withdrawal"];
const EXPORT_TYPES = ["transactions", "budgets", "goals", "challenges", "scenarios", "full_personal_data"];

export default function Privacy() {
  const { t, language } = useI18n();
  const { data: consents } = useConsentRecords();
  const setConsent = useSetConsent();
  const { data: requests } = usePrivacyRequests();
  const createRequest = useCreatePrivacyRequest();
  const { data: exports } = useExportRequests();
  const requestExport = useRequestExport();
  const { data: auditLog } = useAuditLog();
  const deleteImported = useDeleteImportedData();

  const [reqType, setReqType] = useState("data_export");
  const [reqNotes, setReqNotes] = useState("");
  const [reqDone, setReqDone] = useState(false);
  const [exportType, setExportType] = useState("transactions");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const loc = language === "es" ? "es-ES" : language;
  const today = new Date().toISOString().slice(0, 10);

  // Current consent state = latest record per type.
  const state = {};
  (consents || []).forEach((c) => {
    if (c.status === "granted") state[c.consent_type] = true;
    else if (c.status === "withdrawn") state[c.consent_type] = false;
  });
  const accepted = {};
  (consents || []).forEach((c) => { if (c.status === "granted") accepted[c.consent_type] = true; });

  return (
    <div className="space-y-8">
      <PageHeader title={t("privacy.title")} subtitle={t("privacy.noSensitiveInference")} />

      <DisclaimerBanner />

      <section>
        <p className="mb-3 text-sm font-semibold">{t("privacy.consents")}</p>
        <p className="mb-3 text-xs text-muted-foreground">{t("privacy.marketingNote")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONSENTS.map((c) => (
            <label key={c} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
              <span>{t("consent." + c)}</span>
              <Switch
                checked={state[c] ?? false}
                onCheckedChange={(v) => setConsent.mutate({ consent_type: c, granted: v })}
                aria-label={t("consent." + c)}
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("consent.terms_of_service")}: {accepted.terms_of_service ? t("consent.granted") : t("consent.withdrawn")} ·
          {" "}{t("consent.privacy_policy")}: {accepted.privacy_policy ? t("consent.granted") : t("consent.withdrawn")} ·
          {" "}{t("consent.financial_education_disclaimer")}: {accepted.financial_education_disclaimer ? t("consent.granted") : t("consent.withdrawn")}
        </p>
      </section>

      <section>
        <p className="mb-3 text-sm font-semibold">{t("privacy.exportData")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={exportType} onValueChange={setExportType}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>{EXPORT_TYPES.map((e) => <SelectItem key={e} value={e}>{e.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => requestExport.mutate({ export_type: exportType })} disabled={requestExport.isPending}>
            <Download className="h-4 w-4 mr-1.5" aria-hidden />{requestExport.isPending ? t("common.loading") : t("privacy.requestExport")}
          </Button>
        </div>
        {(exports || []).length > 0 && (
          <div className="mt-3 space-y-1.5">
            {(exports || []).slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">{e.export_type.replace(/_/g, " ")} · {new Date(e.requested_at).toLocaleDateString(loc)}</span>
                <span className="text-xs font-medium">{e.expires_at && e.expires_at.slice(0, 10) < today ? t("privacy.expired") : t("requestStatus.completed")}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="mb-3 text-sm font-semibold">{t("privacy.requests")}</p>
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <Select value={reqType} onValueChange={setReqType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{REQUEST_TYPES.map((r) => <SelectItem key={r} value={r}>{t("request." + r)}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea placeholder={t("privacy.requestNotes")} value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} className="min-h-[70px]" />
          {reqDone && <p className="text-sm text-chart-3">✓ {t("privacy.requestSubmitted")}</p>}
          <Button
            onClick={async () => {
              await createRequest.mutateAsync({ request_type: reqType, request_notes: reqNotes });
              setReqNotes("");
              setReqDone(true);
            }}
            disabled={createRequest.isPending}
          >
            {createRequest.isPending ? t("common.loading") : t("privacy.submit")}
          </Button>
        </div>
        {(requests || []).length > 0 && (
          <div className="mt-3 space-y-1.5">
            {(requests || []).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">{t("request." + r.request_type)}</span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{t("requestStatus." + r.status)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="mb-3 text-sm font-semibold">{t("privacy.deleteImported")}</p>
        {!confirmDelete ? (
          <Button variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4 mr-1.5" aria-hidden />{t("privacy.deleteImported")}</Button>
        ) : (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm">{t("privacy.deleteImportedConfirm")}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="destructive" onClick={() => { deleteImported.mutate(); setConfirmDelete(false); }}>{t("common.confirm")}</Button>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button>
            </div>
          </div>
        )}
      </section>

      <section>
        <p className="mb-3 text-sm font-semibold">{t("privacy.security")}</p>
        <div className="rounded-2xl border bg-card overflow-hidden">
          {(auditLog || []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("privacy.activityEmpty")}</p>
          ) : (
            <ul className="divide-y max-h-72 overflow-y-auto">
              {(auditLog || []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{a.action.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(a.occurred_at).toLocaleString(loc)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        <Link to="/help" className="text-accent hover:underline">{t("help.privacy")}</Link> · {t("help.notAdviceBody")}
      </p>
    </div>
  );
}