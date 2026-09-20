// Budget application service: periods, allocations, actual recalculation, closeout.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { useAuth } from "@/lib/AuthContext";
import { writeAudit } from "./audit";
import { applyBudgetTemplate } from "@/domain/budgetTemplates";
import { sumCents } from "@/domain/money";

export function useBudgetPeriods() {
  return useQuery({ queryKey: ["budgetPeriods"], queryFn: () => repo("BudgetPeriod").filter({}, "-period_start", 60) });
}

export function useAllocations(periodId) {
  return useQuery({
    queryKey: ["allocations", periodId],
    queryFn: () => repo("BudgetAllocation").filter({ budget_period_id: periodId }, "created_date", 100),
    enabled: !!periodId
  });
}

export function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: start.toLocaleDateString("en", { month: "long", year: "numeric" }) };
}

export function useCreateBudget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, incomeCents, essentialCents, monthOffset = 0, categories }) => {
      const range = monthRange(monthOffset);
      const byType = {};
      for (const c of categories) {
        byType[c.category_type] = byType[c.category_type] || [];
        byType[c.category_type].push(c);
      }
      const plans = applyBudgetTemplate(templateId, { incomeCents, essentialCents }, byType);
      const period = await repo("BudgetPeriod").create({
        user_id: user.id,
        period_start: range.start,
        period_end: range.end,
        month_label: range.label,
        income_planned: incomeCents,
        budget_method: templateId === "flexible" ? "flexible" : templateId === "50_30_20" ? "50_30_20" : "category_budget",
        status: "active",
        total_expense_budget: sumCents(plans, (p) => p.plannedCents)
      });
      const catByName = {};
      for (const c of categories) catByName[c.name] = c;
      const allocations = plans
        .map((p) => catByName[p.categoryKey])
        .filter(Boolean)
        .map((cat) => ({ user_id: user.id, budget_period_id: period.id, category_id: cat.id, planned_amount: plans.find((p) => p.categoryKey === cat.name).plannedCents, actual_amount: 0, variance_amount: plans.find((p) => p.categoryKey === cat.name).plannedCents, alert_threshold_percentage: 80 }));
      if (allocations.length) await repo("BudgetAllocation").bulkCreate(allocations);
      await writeAudit({ userId: user.id, action: "budget_created", entityType: "BudgetPeriod", entityId: period.id, after: { template: templateId, allocations: allocations.length } });
      return period;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgetPeriods"] })
  });
}

export function useUpdateAllocation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, planned_amount, notes }) => {
      const updated = await repo("BudgetAllocation").update(id, { planned_amount, variance_amount: planned_amount, ...(notes !== undefined ? { notes } : {}) });
      await writeAudit({ userId: user.id, action: "budget_allocation_updated", entityType: "BudgetAllocation", entityId: id });
      return updated;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allocations"] })
  });
}

// Persists recalculated actuals (from eligible transactions) and calm threshold alerts — no duplicates per threshold.
export async function persistActuals({ allocations, actualsByCategory, userId }) {
  for (const a of allocations) {
    const actual = actualsByCategory[a.category_id] || 0;
    if ((a.actual_amount || 0) !== actual) {
      await repo("BudgetAllocation").update(a.id, { actual_amount: actual, variance_amount: (a.planned_amount || 0) - actual });
    }
  }
}

export function useClosePeriod() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ periodId, totals }) => {
      const updated = await repo("BudgetPeriod").update(periodId, { status: "closed", completed_at: new Date().toISOString(), income_actual: totals.income, total_expense_actual: totals.expense, total_savings_actual: totals.savings });
      await writeAudit({ userId: user.id, action: "budget_closed", entityType: "BudgetPeriod", entityId: periodId });
      return updated;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgetPeriods"] })
  });
}