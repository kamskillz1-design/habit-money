import { repo } from "@/adapters/base44/entities";
import { requireUser } from "@/adapters/base44/auth";
import {
  demoCategories, demoAccounts, demoTransactions, demoRecurring, demoGoals, demoContributions,
  demoBudget, demoChallenges, demoCheckIns, demoNudges, demoAchievements, demoRewards,
  demoReviews, demoScenarios, demoMisc
} from "../../../base44/shared/demoData.js";

export async function loadDemoData(body = {}) {
  const user = await requireUser();
  const language = body.language === "en" || body.language === "es" ? body.language : "es";

  const existing = await repo("ImportBatch").filter({ user_id: user.id, source: "demo" }, undefined, 1);
  if (existing && existing.length > 0) {
    return { ok: true, already_loaded: true };
  }

  const userId = user.id;
  const cats = await repo("Category").bulkCreate(demoCategories(userId, language));
  const catByName = {};
  for (const c of cats) catByName[c.name] = c.id;

  const accts = await repo("Account").bulkCreate(demoAccounts(userId));
  const acctByName = {};
  for (const a of accts) acctByName[a.name] = a.id;

  await repo("Transaction").bulkCreate(demoTransactions(userId, catByName, acctByName));
  await repo("RecurringItem").bulkCreate(demoRecurring(userId, catByName, acctByName));

  const goals = await repo("SavingsGoal").bulkCreate(demoGoals(userId));
  const goalByName = {};
  for (const g of goals) goalByName[g.name] = g.id;
  if (goals[1]) {
    await repo("SavingsGoal").update(goals[1].id, {
      is_shared: true,
      description: (goals[1].description || "") + " (compartida con el hogar)"
    });
  }

  await repo("GoalContribution").bulkCreate(demoContributions(userId, goalByName));

  const misc = demoMisc(userId, user.email);
  for (const { period, allocations } of demoBudget(userId, catByName)) {
    const created = await repo("BudgetPeriod").create(period);
    await repo("BudgetAllocation").bulkCreate(allocations.map((a) => ({ ...a, budget_period_id: created.id })));
  }

  await repo("UserChallenge").bulkCreate(demoChallenges(userId));
  await repo("DailyCheckIn").bulkCreate(demoCheckIns(userId));
  await repo("Nudge").bulkCreate(demoNudges(userId));
  await repo("Achievement").bulkCreate(demoAchievements(userId));
  await repo("RewardLedger").bulkCreate(demoRewards(userId));
  await repo("WeeklyReview").bulkCreate(demoReviews(userId));

  for (const { scenario, results } of demoScenarios(userId)) {
    const created = await repo("Scenario").create(scenario);
    if (results.length > 0) {
      await repo("ScenarioResult").bulkCreate(results.map((r) => ({ ...r, scenario_id: created.id })));
    }
  }

  await repo("ImportBatch").create(misc.importBatch);
  await repo("DataExportRequest").create(misc.exportRequest);
  const household = await repo("Household").create(misc.household);
  try {
    await repo("HouseholdMembership").create({ ...misc.membership, household_id: household.id, user_id: userId });
  } catch (e) {
    // Demo placeholder member id is not a real auth user; owner row is enough.
  }

  await repo("AuditLog").create({
    user_id: userId, actor_user_id: userId, action: "demo_data_loaded",
    entity_type: "UserProfile", entity_id: userId, occurred_at: new Date().toISOString(),
    safe_after_summary: '{"demo":true}'
  });

  return { ok: true, loaded: true };
}
