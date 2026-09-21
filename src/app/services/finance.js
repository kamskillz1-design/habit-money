// Accounts, categories, transactions, recurring bills. Ownership is enforced server-side by row-level security.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { useAuth } from "@/lib/AuthContext";
import { writeAudit } from "./audit";
import { validateAmountCents, validateDate, validateEnum, validateText, pickFields } from "@/domain/validation";
import { DIRECTIONS, STARTER_CATEGORIES, PLAN_LIMITS } from "@/domain/constants";
import { toCents } from "@/domain/money";

const TRANSACTION_FIELDS = ["account_id", "category_id", "transaction_date", "amount", "direction", "merchant_name", "notes", "is_recurring", "is_transfer", "is_refund", "is_excluded_from_budget", "is_excluded_from_insights", "is_shared"];

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: () => repo("Account").filter({}, "-created_date", 100) });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => repo("Category").filter({}, "display_order", 100) });
}

export function useTransactions(limit = 500) {
  return useQuery({ queryKey: ["transactions"], queryFn: () => repo("Transaction").filter({}, "-transaction_date", limit) });
}

export function useSaveAccount() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }) => {
      const clean = pickFields(fields, ["name", "type", "currency", "institution_name", "opening_balance", "current_balance", "include_in_cashflow", "include_in_net_worth"]);
      if (id) {
        const updated = await repo("Account").update(id, clean);
        await writeAudit({ userId: user.id, action: "account_updated", entityType: "Account", entityId: id, after: { name: clean.name } });
        return updated;
      }
      const accounts = await repo("Account").filter({}, undefined, 500);
      const profile = (await repo("UserProfile").filter({}, "-created_date", 5))[0];
      const limit = PLAN_LIMITS[profile?.plan || "free"].accounts;
      if (accounts.length >= limit) throw { code: "plan_limit", error: "plan_limit" };
      const created = await repo("Account").create({ ...clean, user_id: user.id, source: "manual", connection_status: "not_connected", active: true, archived: false });
      await writeAudit({ userId: user.id, action: "account_created", entityType: "Account", entityId: created.id, after: { name: clean.name, type: clean.type } });
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] })
  });
}

export async function ensureStarterCategories(userId, t) {
  const existing = await repo("Category").filter({}, undefined, 200);
  if (existing.length > 0) return existing;
  const records = STARTER_CATEGORIES.map((c, i) => ({
    user_id: userId,
    name: t(c.key),
    category_type: c.type,
    icon: c.icon,
    color: c.color,
    is_essential: !!c.essential,
    is_temptation_category: !!c.temptation,
    active: true,
    archived: false,
    display_order: i,
    is_system: true
  }));
  return repo("Category").bulkCreate(records);
}

export function useSaveCategory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }) => {
      const clean = pickFields(fields, ["name", "category_type", "icon", "color", "is_essential", "default_budget_amount", "active", "archived", "display_order"]);
      const name = validateText(clean.name, { required: true, maxLength: 60 });
      if (!name.ok) throw { code: "validation_error", errorKey: name.errorKey };
      if (id) return repo("Category").update(id, { ...clean, name: name.value });
      return repo("Category").create({ ...clean, name: name.value, user_id: user.id, active: true, archived: false });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] })
  });
}
