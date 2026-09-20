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

// Lists are capped and ownership-scoped; date/filter/sort/pagination happen in the UI over this bounded set.
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

// Seeds the starter category set for the current user, in the active language. Skips when categories exist.
export async function ensureStarterCategories(userId, t) {
  const existing = await repo("Category").filter({}, undefined, 200);
  if (existing.length > 0) return existing;
  const records = STARTER_CATEGORIES.map((c, i) => ({
    user_id: userId,
    name: t(c.key),
    name_key: c.key,
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

export function useSaveTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields, duplicate }) => {
      const clean = pickFields(fields, TRANSACTION_FIELDS);
      const dir = validateEnum(clean.direction, DIRECTIONS);
      const date = validateDate(clean.transaction_date);
      const amount = validateAmountCents(typeof clean.amount === "string" ? toCents(clean.amount) : clean.amount);
      const merchant = validateText(clean.merchant_name, { maxLength: 120 });
      const notes = validateText(clean.notes, { maxLength: 2000 });
      for (const v of [dir, date, amount, merchant, notes]) if (!v.ok) throw { code: "validation_error", errorKey: v.errorKey };
      // Transfers do not count as spending or income; category is not required for them.
      const isTransfer = clean.is_transfer || clean.direction === "transfer_in" || clean.direction === "transfer_out";
      const data = {
        ...clean,
        merchant_name: merchant.value || undefined,
        notes: notes.value || undefined,
        amount: amount.value,
        transaction_date: date.value,
        is_transfer: !!isTransfer,
        category_id: isTransfer ? undefined : clean.category_id || undefined,
        idempotency_key: id ? undefined : `${user.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}`
      };
      if (id) {
        const updated = await repo("Transaction").update(id, data);
        await writeAudit({ userId: user.id, action: "transaction_updated", entityType: "Transaction", entityId: id });
        return updated;
      }
      const created = await repo("Transaction").create({ ...data, user_id: user.id, source: "manual", active: true, archived: false });
      await writeAudit({ userId: user.id, action: duplicate ? "transaction_duplicated" : "transaction_created", entityType: "Transaction", entityId: created.id });
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] })
  });
}

// Archive instead of delete — audit history is preserved.
export function useArchiveTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }) => {
      const updated = await repo("Transaction").update(id, { archived: !!archived, active: !archived });
      await writeAudit({ userId: user.id, action: archived ? "transaction_archived" : "transaction_restored", entityType: "Transaction", entityId: id });
      return updated;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] })
  });
}

export function useRecurringItems() {
  return useQuery({ queryKey: ["recurring"], queryFn: () => repo("RecurringItem").filter({}, "next_due_date", 200) });
}

export function useSaveRecurring() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }) => {
      const clean = pickFields(fields, ["name", "category_id", "account_id", "amount", "direction", "frequency", "next_due_date", "reminder_days_before", "merchant_name", "is_subscription", "status", "notes", "active", "archived"]);
      const name = validateText(clean.name, { required: true, maxLength: 80 });
      const date = validateDate(clean.next_due_date);
      const amount = validateAmountCents(typeof clean.amount === "string" ? toCents(clean.amount) : clean.amount);
      for (const v of [name, date, amount]) if (!v.ok) throw { code: "validation_error", errorKey: v.errorKey };
      if (id) return repo("RecurringItem").update(id, { ...clean, name: name.value, next_due_date: date.value, amount: amount.value });
      return repo("RecurringItem").create({ ...clean, name: name.value, next_due_date: date.value, amount: amount.value, user_id: user.id, active: true, archived: false, status: clean.status || "active" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] })
  });
}

export function useMarkRecurringPaid() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item) => {
      const freqAdd = { weekly: 7, biweekly: 14, monthly: 1, quarterly: 3, yearly: 1 };
      const next = new Date(item.next_due_date + "T00:00:00");
      if (item.frequency === "monthly" || item.frequency === "quarterly") next.setMonth(next.getMonth() + freqAdd[item.frequency]);
      else if (item.frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
      else next.setDate(next.getDate() + freqAdd[item.frequency]);
      await repo("RecurringItem").update(item.id, { next_due_date: next.toISOString().slice(0, 10), last_processed_date: item.next_due_date });
      await writeAudit({ userId: user.id, action: "recurring_marked_paid", entityType: "RecurringItem", entityId: item.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] })
  });
}