// Savings goals. Contributions run through a protected server function (ownership, milestones, rewards, audit).
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { useAuth } from "@/lib/AuthContext";
import { invokeFunction } from "@/adapters/base44/functions";
import { writeAudit } from "./audit";
import { validateText, validateAmountCents, pickFields } from "@/domain/validation";
import { PLAN_LIMITS } from "@/domain/constants";
import { toCents } from "@/domain/money";

export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: () => repo("SavingsGoal").filter({}, "-created_date", 100) });
}

export function useGoalContributions(goalId) {
  return useQuery({
    queryKey: ["contributions", goalId],
    queryFn: () => repo("GoalContribution").filter({ goal_id: goalId }, "-contribution_date", 200),
    enabled: !!goalId
  });
}

export function useSaveGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }) => {
      const clean = pickFields(fields, ["name", "description", "target_amount", "target_date", "priority", "goal_type", "status", "is_shared"]);
      const name = validateText(clean.name, { required: true, maxLength: 80 });
      const target = validateAmountCents(typeof clean.target_amount === "string" ? toCents(clean.target_amount) : clean.target_amount, { min: 1 });
      if (!name.ok) throw { code: "validation_error", errorKey: name.errorKey };
      if (!target.ok) throw { code: "validation_error", errorKey: target.errorKey };
      const data = { ...clean, name: name.value, target_amount: target.value };
      if (id) {
        const updated = await repo("SavingsGoal").update(id, data);
        await writeAudit({ userId: user.id, action: "goal_updated", entityType: "SavingsGoal", entityId: id });
        return updated;
      }
      const goals = await repo("SavingsGoal").filter({ status: "active" }, undefined, 100);
      const profile = (await repo("UserProfile").filter({}, "-created_date", 5))[0];
      const limit = PLAN_LIMITS[profile?.plan || "free"].active_goals;
      if (goals.length >= limit) throw { code: "plan_limit", errorKey: "plan_limit" };
      const created = await repo("SavingsGoal").create({ ...data, user_id: user.id, current_amount: 0, status: clean.status || "active", start_date: new Date().toISOString().slice(0, 10) });
      await writeAudit({ userId: user.id, action: "goal_created", entityType: "SavingsGoal", entityId: created.id, after: { name: data.name } });
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] })
  });
}

// Server-side: validates ownership, updates the goal, awards milestone achievements/points once, writes audit.
export function useContribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, amountCents, contributionDate, note }) =>
      invokeFunction("recordGoalContribution", { goalId, amountCents, contributionDate, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["achievements"] });
      qc.invalidateQueries({ queryKey: ["rewardLedger"] });
    }
  });
}

export function useArchiveGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }) => {
      const updated = await repo("SavingsGoal").update(id, { archived: !!archived, status: archived ? "archived" : "active" });
      await writeAudit({ userId: user.id, action: archived ? "goal_archived" : "goal_restored", entityType: "SavingsGoal", entityId: id });
      return updated;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] })
  });
}