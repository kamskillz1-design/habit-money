// Scenario Lab: transparent simulations. Math is portable domain code; persistence is ownership-scoped.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { useAuth } from "@/lib/AuthContext";
import { writeAudit } from "./audit";
import { savingsProjection, debtPayoff } from "@/domain/scenarioMath";
import { validateAmountCents, validateText, pickFields } from "@/domain/validation";
import { PLAN_LIMITS } from "@/domain/constants";
import { toCents } from "@/domain/money";

export function useScenarios() {
  return useQuery({ queryKey: ["scenarios"], queryFn: () => repo("Scenario").filter({}, "-created_date", 100) });
}

export function useScenarioResults(scenarioId) {
  return useQuery({
    queryKey: ["scenarioResults", scenarioId],
    queryFn: () => repo("ScenarioResult").filter({ scenario_id: scenarioId }, "month_number", 130),
    enabled: !!scenarioId
  });
}

// Pure calculation for live preview (before saving).
export function runSavingsScenario(inputs) {
  return savingsProjection(inputs);
}

export function runDebtScenario(inputs) {
  return debtPayoff(inputs);
}

export function useSaveScenario() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fields, projection }) => {
      const clean = pickFields(fields, ["name", "scenario_type", "duration_months", "current_balance", "recurring_contribution_amount", "contribution_frequency", "one_time_contribution_amount", "assumed_annual_rate_percentage", "annual_inflation_percentage", "include_inflation", "debt_balance", "debt_interest_rate_percentage", "extra_debt_payment_amount"]);
      const name = validateText(clean.name, { required: true, maxLength: 80 });
      if (!name.ok) throw { code: "validation_error", errorKey: name.errorKey };
      const months = Math.min(600, Math.max(1, Number(clean.duration_months) || 12));
      const existingCount = (await repo("Scenario").filter({}, undefined, 500)).length;
      const profile = (await repo("UserProfile").filter({}, "-created_date", 5))[0];
      if (existingCount >= PLAN_LIMITS[profile?.plan || "free"].scenario_saves) throw { code: "plan_limit", errorKey: "plan_limit" };
      const start = projection?.timeline?.[0]?.date || new Date().toISOString().slice(0, 10);
      const scenario = await repo("Scenario").create({
        ...clean,
        name: name.value,
        user_id: user.id,
        start_date: start,
        duration_months: months,
        use_zero_return_baseline: true,
        baseline_result: projection ? { zeroReturnBalance: projection.zeroReturnBalance, totalContributions: projection.totalContributions } : undefined,
        projected_result: projection ? { projectedBalance: projection.projectedBalance, inflationAdjustedValue: projection.inflationAdjustedValue } : undefined,
        assumptions_text: projection ? JSON.stringify({ rate: clean.assumed_annual_rate_percentage || 0, inflation: clean.annual_inflation_percentage || 0, frequency: clean.contribution_frequency, months }).slice(0, 500) : undefined,
        disclaimer_acknowledged_at: new Date().toISOString(),
        archived: false
      });
      if (projection?.timeline?.length) {
        const rows = projection.timeline
          .filter((r) => r.month_number > 0)
          .slice(0, 120)
          .map((r) => ({
            user_id: user.id,
            scenario_id: scenario.id,
            month_number: r.month_number,
            date: r.date,
            contribution_amount: r.contribution_amount,
            cumulative_contributions: r.cumulative_contributions,
            projected_balance: r.projected_balance,
            zero_return_balance: r.zero_return_balance,
            estimated_growth_amount: r.estimated_growth_amount,
            inflation_adjusted_value: r.inflation_adjusted_value,
            assumptions_version: "v1"
          }));
        if (rows.length) await repo("ScenarioResult").bulkCreate(rows);
      }
      await writeAudit({ userId: user.id, action: "scenario_saved", entityType: "Scenario", entityId: scenario.id, after: { name: name.value } });
      return scenario;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenarios"] });
      qc.invalidateQueries({ queryKey: ["scenarioResults"] });
    }
  });
}

export function useArchiveScenario() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const updated = await repo("Scenario").update(id, { archived: true });
      await writeAudit({ userId: user.id, action: "scenario_archived", entityType: "Scenario", entityId: id });
      return updated;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenarios"] })
  });
}