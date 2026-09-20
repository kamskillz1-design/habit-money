// Transparent, explainable insight generation. Pure function of user-approved data.
// Every insight names the data it used and carries an explanation. No judgments, no sensitive inference.

import { EXPENSE_DIRECTIONS } from "./constants";
import { sumCents } from "./money";

export function buildInsights({ transactions, categories, goals, recurring, allocations, now = new Date() }) {
  const insights = [];
  const catById = {};
  (categories || []).forEach((c) => (catById[c.id] = c));
  const active = (transactions || []).filter((t) => !t.archived && !t.is_excluded_from_insights);
  const expenses = active.filter((t) => t.direction === "expense");

  const inRange = (t, start, end) => t.transaction_date >= start && t.transaction_date <= end;
  const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

  // 1. Uncategorised transactions (data quality)
  const uncategorised = active.filter((t) => !t.category_id && !t.is_transfer);
  if (uncategorised.length > 0) {
    insights.push({
      key: `data_quality:uncategorised:${uncategorised.length}`,
      type: "data_quality",
      titleKey: "insights.title",
      messageKey: "today.uncategorised",
      params: { count: uncategorised.length },
      explanationKey: "insights.basedOn",
      period: { start: daysAgo(60), end: now.toISOString().slice(0, 10) }
    });
  }

  // 2. Category spending change vs prior 4-week period
  const curStart = daysAgo(28);
  const prevStart = daysAgo(56);
  const byCat = (list, start, end) => {
    const map = {};
    list.filter((t) => inRange(t, start, end)).forEach((t) => {
      map[t.category_id] = (map[t.category_id] || 0) + t.amount;
    });
    return map;
  };
  const cur = byCat(expenses, curStart, now.toISOString().slice(0, 10));
  const prev = byCat(expenses, prevStart, curStart);
  for (const [catId, amount] of Object.entries(cur)) {
    const prior = prev[catId] || 0;
    if (prior > 2000 && Math.abs(amount - prior) / prior > 0.15) {
      const diff = amount - prior;
      insights.push({
        key: `spending_change:${catId}`,
        type: diff < 0 ? "positive_progress" : "spending_change",
        titleKey: "insights.title",
        messageKey: diff < 0 ? "insights.spendingLower" : "insights.spendingHigher",
        params: { category: catById[catId]?.name || "", amount: diff < 0 ? prior - amount : amount - prior },
        explanationKey: "insights.explainCategory",
        period: { start: prevStart, end: now.toISOString().slice(0, 10) },
        related_category_id: catId
      });
    }
  }

  // 3. Upcoming recurring bills in next 10 days
  const soon = (recurring || []).filter((r) => r.status === "active" && !r.archived && r.next_due_date <= new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  if (soon.length > 0) {
    insights.push({
      key: `recurring_bill:${soon.length}:${soon[0].next_due_date}`,
      type: "recurring_bill",
      titleKey: "insights.title",
      messageKey: "insights.billsSoon",
      params: { count: soon.length },
      explanationKey: "insights.basedOn",
      period: { start: now.toISOString().slice(0, 10), end: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) }
    });
  }

  // 4. Goal milestones
  (goals || []).filter((g) => g.status === "active").forEach((g) => {
    const pct = g.target_amount > 0 ? Math.floor((g.current_amount / g.target_amount) * 100) : 0;
    if (pct >= 50 && pct < 100) {
      insights.push({
        key: `goal_momentum:${g.id}`,
        type: "goal_momentum",
        titleKey: "insights.title",
        messageKey: "insights.goalHalfway",
        params: { name: g.name, pct },
        explanationKey: "insights.explainGeneric",
        period: null,
        related_goal_id: g.id
      });
    }
  });

  // 5. Budget categories at 80%+
  (allocations || []).forEach((a) => {
    if ((a.planned_amount || 0) > 0 && (a.actual_amount || 0) >= (a.planned_amount || 0) * 0.8) {
      insights.push({
        key: `budget_variance:${a.id}`,
        type: "budget_variance",
        titleKey: "insights.title",
        messageKey: "insights.budgetAt80",
        params: { category: catById[a.category_id]?.name || "", pct: Math.round(((a.actual_amount || 0) / a.planned_amount) * 100) },
        explanationKey: "insights.explainGeneric",
        period: null,
        related_category_id: a.category_id
      });
    }
  });

  // 6. Positive: challenges completed this month
  return insights;
}

export function weekSpendingTotal(transactions, now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  const startStr = start.toISOString().slice(0, 10);
  return sumCents(
    (transactions || []).filter((t) => !t.archived && !t.is_excluded_from_budget && t.direction === "expense" && t.transaction_date >= startStr),
    (t) => t.amount
  );
}