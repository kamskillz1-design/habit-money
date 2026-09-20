import { repo } from "@/adapters/base44/entities";
import { requireUser } from "@/adapters/base44/auth";

export async function recordGoalContribution(body = {}) {
  const user = await requireUser();
  const { goalId, amountCents, contributionDate, note } = body || {};

  if (!goalId || typeof goalId !== "string") {
    return { ok: false, error: "goalId is required", code: "validation_error" };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 1000000000) {
    return { ok: false, error: "amountCents must be a positive integer", code: "validation_error" };
  }
  if (!contributionDate || !/^\d{4}-\d{2}-\d{2}$/.test(contributionDate)) {
    return { ok: false, error: "contributionDate must be YYYY-MM-DD", code: "validation_error" };
  }
  const safeNote = note ? String(note).slice(0, 500) : undefined;

  const goal = await repo("SavingsGoal").get(goalId);
  if (!goal) {
    return { ok: false, error: "Goal not found", code: "not_found" };
  }

  const now = new Date().toISOString();
  const contribution = await repo("GoalContribution").create({
    user_id: user.id,
    goal_id: goalId,
    amount: amountCents,
    contribution_date: contributionDate,
    source: "manual",
    note: safeNote,
    created_by_user_id: user.id
  });

  const newAmount = (goal.current_amount || 0) + amountCents;
  const target = goal.target_amount || 0;
  const pct = target > 0 ? Math.min(100, Math.floor((newAmount * 100) / target)) : 0;
  const completed = target > 0 && newAmount >= target;

  let weekly = null;
  let monthly = null;
  if (goal.target_date) {
    const end = new Date(goal.target_date + "T00:00:00");
    const days = Math.ceil((end - new Date()) / 86400000);
    const remaining = Math.max(0, target - newAmount);
    if (remaining > 0 && days > 0) {
      weekly = Math.ceil(remaining / Math.max(1, days / 7));
      monthly = Math.ceil(remaining / Math.max(1, days / 30.44));
    } else if (remaining > 0) {
      weekly = remaining;
      monthly = remaining;
    }
  }

  const goalPatch = {
    current_amount: newAmount,
    status: completed ? "completed" : (goal.status || "active"),
  };
  if (weekly !== null) goalPatch.suggested_weekly_contribution = weekly;
  if (monthly !== null) goalPatch.suggested_monthly_contribution = monthly;
  if (completed) goalPatch.completed_at = now;
  await repo("SavingsGoal").update(goalId, goalPatch);

  const milestones = [25, 50, 75, 100].filter((m) => pct >= m);
  let pointsEarned = 0;
  const earnedMilestones = [];
  for (const m of milestones) {
    const existing = await repo("Achievement").filter(
      { user_id: user.id, related_entity_id: goalId, achievement_type: "savings_milestone", progress_value: m },
      undefined,
      1
    );
    if (existing && existing.length > 0) continue;
    await repo("Achievement").create({
      user_id: user.id,
      achievement_type: "savings_milestone",
      title: "savings_milestone",
      description: "Reached " + m + "% of a savings goal",
      earned_at: now,
      progress_value: m,
      target_value: 100,
      badge_icon: "Medal",
      related_entity_type: "SavingsGoal",
      related_entity_id: goalId
    });
    const ledger = await repo("RewardLedger").filter(
      { user_id: user.id, reason: "savings_milestone_" + m, related_entity_id: goalId },
      undefined,
      1
    );
    if (!ledger || ledger.length === 0) {
      pointsEarned += 5;
      await repo("RewardLedger").create({
        user_id: user.id,
        points_change: 5,
        reason: "savings_milestone_" + m,
        related_entity_type: "SavingsGoal",
        related_entity_id: goalId
      });
    }
    earnedMilestones.push(m);
  }

  await repo("AuditLog").create({
    user_id: user.id,
    actor_user_id: user.id,
    action: "goal_contribution_created",
    entity_type: "SavingsGoal",
    entity_id: goalId,
    occurred_at: now,
    safe_after_summary: JSON.stringify({ current_amount: newAmount, pct, completed }).slice(0, 300)
  });

  return {
    ok: true,
    contribution_id: contribution.id,
    current_amount: newAmount,
    percentage: pct,
    milestones: earnedMilestones,
    points_earned: pointsEarned,
    completed
  };
}
