import React, { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { useAccounts } from "@/app/services/finance";
import { usePreviewImport, useCommitImport, uploadCsv } from "@/app/services/import";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2 } from "lucide-react";

// Three-step CSV import wizard: upload → column mapping with live preview → result summary.
export default function ImportDialog({ open, onOpenChange }) {
  const { t } = useI18n();
  const { data: accounts } = useAccounts();
  const preview = usePreviewImport();
  const commit = useCommitImport();

  const [step, setStep] = useState("upload");
  const [meta, setMeta] = useState(null); // { headers, rowCount, fileUrl, fileName }
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [defaultDirection, setDefaultDirection] = useState("expense");
  const [accountId, setAccountId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setStep("upload"); setMeta(null); setRows([]); setMapping({});
      setResult(null); setError(null); setDefaultDirection("expense");
    }
  }, [open]);

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const fileUrl = await uploadCsv(file);
      const res = await preview.mutateAsync({ fileUrl });
      if (!res?.ok) throw new Error(res?.code || "error");
      const normalised = Object.fromEntries(
        Object.entries(res.suggested_mapping || {}).map(([k, v]) => [k, v == null ? "none" : String(v)])
      );
      setMeta({ headers: res.headers || [], rowCount: res.row_count || 0, fileUrl, fileName: file.name });
      setRows(res.sample_rows || []);
      setMapping(normalised);
      setAccountId((accounts || [])[0]?.id || "");
      setStep("review");
    } catch (err) {
      setError(t("import.noRows"));
    }
  };

  const colIndex = (v) => (v == null || v === "none" ? null : Number(v));
  const canImport = mapping.date && mapping.date !== "none" && mapping.amount && mapping.amount !== "none" && !!accountId;

  const runImport = async () => {
    setError(null);
    try {
      const res = await commit.mutateAsync({
        fileUrl: meta.fileUrl,
        fileName: meta.fileName,
        mapping,
        defaultDirection,
        accountId
      });
      if (!res?.ok) throw new Error(res?.code || "error");
      setResult(res);
      setStep("done");
    } catch (err) {
      setError(t("import.failed"));
    }
  };

  const columnSelect = (key, optional) => (
    <div>
      <Label className="text-xs">
        {t(`import.${key}Column`)}{optional ? ` (${t("common.optional")})` : ""}
      </Label>
      <Select value={mapping[key] ?? "none"} onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v }))}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">–</SelectItem>
          {(meta?.headers || []).map((h, i) => (
            <SelectItem key={i} value={String(i)}>{h || `#${i + 1}`}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("import.hint")}</p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center hover:bg-muted/40 transition-colors">
              <Upload className="h-8 w-8 text-accent" aria-hidden />
              <span className="text-sm font-medium">{t("import.upload")}</span>
              <span className="text-xs text-muted-foreground">CSV · {t("common.optional")}</span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={pickFile} />
            </label>
            {preview.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {columnSelect("date")}
              {columnSelect("amount")}
              {columnSelect("description", true)}
              {columnSelect("merchant", true)}
              {columnSelect("category", true)}
              <div>
                <Label className="text-xs">{t("import.defaultDirection")}</Label>
                <Select value={defaultDirection} onValueChange={setDefaultDirection}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["expense", "income", "savings_contribution", "debt_payment", "refund"].map((d) => (
                      <SelectItem key={d} value={d}>{t("direction." + d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("import.account")}</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(accounts || []).filter((a) => !a.archived).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold">{t("import.preview")}</p>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {[["date", t("common.date")], ["amount", t("common.amount")], ["description", t("common.details")], ["merchant", t("common.merchant")], ["category", t("common.category")]].map(([key, label]) => (
                        <th key={key} className="px-2 py-1.5 text-left font-medium">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.slice(0, 8).map((row, i) => {
                      const cell = (key) => {
                        const idx = colIndex(mapping[key]);
                        return idx != null ? String(row[idx] ?? "") : "";
                      };
                      return (
                        <tr key={i}>
                          <td className="px-2 py-1.5 whitespace-nowrap">{cell("date")}</td>
                          <td className="px-2 py-1.5 tabular-nums">{cell("amount")}</td>
                          <td className="px-2 py-1.5 max-w-[160px] truncate">{cell("description")}</td>
                          <td className="px-2 py-1.5 max-w-[120px] truncate">{cell("merchant")}</td>
                          <td className="px-2 py-1.5 max-w-[120px] truncate">{cell("category")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{meta?.rowCount ?? 0} · {meta?.fileName}</p>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-chart-3" aria-hidden />
            <p className="text-sm">{t("import.result", {
              accepted: result.accepted_rows, total: result.total_rows,
              duplicates: result.duplicate_rows, rejected: result.rejected_rows
            })}</p>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          {step === "review" && (
            <Button onClick={runImport} disabled={!canImport || commit.isPending}>
              {commit.isPending ? t("common.loading") : t("import.confirm", { count: meta?.rowCount ?? 0 })}
            </Button>
          )}
          {step === "done" && <Button onClick={() => onOpenChange(false)}>{t("common.done")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}