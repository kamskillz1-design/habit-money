// Privacy, consent, data export, and audit trail. Users control their own data end to end.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { useAuth } from "@/lib/AuthContext";
import { writeAudit } from "./audit";
import { validateText } from "@/domain/validation";

export function useConsentRecords() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["consents"],
    queryFn: () => repo("ConsentRecord").filter({}, "-created_date", 200),
    enabled: !!user?.id
  });
}

export function usePrivacyRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["privacyRequests"],
    queryFn: () => repo("PrivacyRequest").filter({}, "-created_date", 100),
    enabled: !!user?.id
  });
}

export function useExportRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["exportRequests"],
    queryFn: () => repo("DataExportRequest").filter({}, "-created_date", 100),
    enabled: !!user?.id
  });
}

export function useAuditLog() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["auditLog"],
    queryFn: () => repo("AuditLog").filter({}, "-created_date", 100),
    enabled: !!user?.id
  });
}

export function useSetConsent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ consent_type, granted }) => {
      const now = new Date().toISOString();
      const record = await repo("ConsentRecord").create({
        user_id: user.id,
        consent_type,
        status: granted ? "granted" : "withdrawn",
        granted_at: granted ? now : undefined,
        withdrawn_at: granted ? undefined : now,
        source: "settings"
      });
      await writeAudit({ userId: user.id, action: granted ? "consent_granted" : "consent_withdrawn", entityType: "ConsentRecord", entityId: record.id, after: { consent_type } });
      return record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consents"] })
  });
}

export function useCreatePrivacyRequest() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ request_type, request_notes }) => {
      const notes = validateText(request_notes, { maxLength: 2000 });
      if (!notes.ok) throw { code: "validation_error", errorKey: notes.errorKey };
      const record = await repo("PrivacyRequest").create({
        user_id: user.id,
        request_type,
        status: "submitted",
        verification_status: "pending",
        requested_at: new Date().toISOString(),
        request_notes: notes.value || undefined
      });
      await writeAudit({ userId: user.id, action: "privacy_request_created", entityType: "PrivacyRequest", entityId: record.id, after: { request_type } });
      return record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["privacyRequests"] })
  });
}

// Export generation stays on the client: only the user's own records are read (RLS-enforced) and
// the file never leaves the device. The request record tracks status, expiry, and download audit.
export function useRequestExport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ export_type }) => {
      const now = new Date();
      const request = await repo("DataExportRequest").create({
        user_id: user.id,
        export_type,
        requested_at: now.toISOString(),
        status: "processing"
      });
      const data = await collectExportData(export_type);
      const expires = new Date(now.getTime() + 7 * 86400000);
      await repo("DataExportRequest").update(request.id, {
        status: "completed",
        completed_at: now.toISOString(),
        expires_at: expires.toISOString(),
        secure_file_reference: "local_download",
        filters: { type: export_type }
      });
      const blob = new Blob([JSON.stringify({ exported_at: now.toISOString(), type: export_type, data }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `habitmoney-export-${export_type}-${now.toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await writeAudit({ userId: user.id, action: "data_export_downloaded", entityType: "DataExportRequest", entityId: request.id });
      return request;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exportRequests"] })
  });
}

async function collectExportData(export_type) {
  const fetchAll = async (name) => repo(name).filter({}, "-created_date", 1000);
  if (export_type === "transactions") return { transactions: await fetchAll("Transaction") };
  if (export_type === "budgets") return { budgetPeriods: await fetchAll("BudgetPeriod"), budgetAllocations: await fetchAll("BudgetAllocation") };
  if (export_type === "goals") return { goals: await fetchAll("SavingsGoal"), contributions: await fetchAll("GoalContribution") };
  if (export_type === "challenges") return { challenges: await fetchAll("UserChallenge") };
  if (export_type === "scenarios") return { scenarios: await fetchAll("Scenario"), scenarioResults: await fetchAll("ScenarioResult") };
  return {
    profile: await fetchAll("UserProfile"),
    financialProfile: await fetchAll("FinancialProfile"),
    accounts: await fetchAll("Account"),
    categories: await fetchAll("Category"),
    transactions: await fetchAll("Transaction"),
    recurringItems: await fetchAll("RecurringItem"),
    budgetPeriods: await fetchAll("BudgetPeriod"),
    goals: await fetchAll("SavingsGoal"),
    contributions: await fetchAll("GoalContribution"),
    challenges: await fetchAll("UserChallenge"),
    scenarios: await fetchAll("Scenario"),
    consents: await fetchAll("ConsentRecord")
  };
}

// Archives every imported record (CSV / open banking / demo). Manual entries are preserved.
export function useDeleteImportedData() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await repo("Transaction").updateMany({ source: { $in: ["CSV_import", "open_banking", "demo"] } }, { $set: { archived: true, active: false } });
      await writeAudit({ userId: user.id, action: "imported_data_deleted", entityType: "Transaction", reason: "user_requested" });
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] })
  });
}