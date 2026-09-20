// Budget templates: map a user's income and starter categories to allocation plans. Cents everywhere.
import { sumCents } from "./money";

const alloc = (catKey, plannedCents) => ({ categoryKey: catKey, plannedCents: Math.max(0, Math.round(plannedCents)) });

export function applyBudgetTemplate(templateId, { incomeCents = 0, essentialCents = 0 }, categoriesByType) {
  // categoriesByType: { essential_expense: [cat], discretionary_expense: [cat], savings: [cat], debt_payment: [cat] }
  const plans = [];
  const income = incomeCents || 0;

  if (templateId === "50_30_20") {
    const needs = Math.round(income * 0.5);
    const wants = Math.round(income * 0.3);
    const savings = Math.round(income * 0.2);
    splitEvenly(categoriesByType.essential_expense, needs).forEach((p) => plans.push(p));
    splitEvenly(categoriesByType.discretionary_expense, wants).forEach((p) => plans.push(p));
    splitEvenly(categoriesByType.savings, savings).forEach((p) => plans.push(p));
  } else if (templateId === "essential_first") {
    splitEvenly(categoriesByType.essential_expense, essentialCents || income).forEach((p) => plans.push(p));
    const rest = Math.max(0, income - (essentialCents || 0));
    if (rest > 0) {
      splitEvenly(categoriesByType.discretionary_expense, Math.round(rest * 0.6)).forEach((p) => plans.push(p));
      splitEvenly(categoriesByType.savings, Math.round(rest * 0.4)).forEach((p) => plans.push(p));
    }
  } else if (templateId === "zero_based") {
    splitEvenly(categoriesByType.essential_expense, Math.round(income * 0.6)).forEach((p) => plans.push(p));
    splitEvenly(categoriesByType.discretionary_expense, Math.round(income * 0.25)).forEach((p) => plans.push(p));
    splitEvenly(categoriesByType.savings, Math.round(income * 0.15)).forEach((p) => plans.push(p));
  } else if (templateId === "student") {
    const caps = { rent: 0.35, groceries: 0.15, transport: 0.08, restaurants: 0.12, entertainment: 0.08, savings: 0.05, coffee: 0.04, subscriptions: 0.05 };
    const map = { "category.rentMortgage": "rent", "category.groceries": "groceries", "category.transport": "transport", "category.restaurants": "restaurants", "category.entertainment": "entertainment", "category.savings": "savings", "category.coffee": "coffee", "category.subscriptions": "subscriptions" };
    for (const [catKey, capKey] of Object.entries(map)) plans.push(alloc(catKey, income * caps[capKey]));
  } else if (templateId === "family") {
    const caps = { rent: 0.3, groceries: 0.18, transport: 0.1, utilities: 0.06, education: 0.06, restaurants: 0.08, entertainment: 0.05, savings: 0.1, healthcare: 0.04, gifts: 0.03 };
    const map = { "category.rentMortgage": "rent", "category.groceries": "groceries", "category.transport": "transport", "category.utilities": "utilities", "category.education": "education", "category.restaurants": "restaurants", "category.entertainment": "entertainment", "category.savings": "savings", "category.healthcare": "healthcare", "category.gifts": "gifts" };
    for (const [catKey, capKey] of Object.entries(map)) plans.push(alloc(catKey, income * caps[capKey]));
  } else {
    // flexible: essentials first, remainder unallocated
    splitEvenly(categoriesByType.essential_expense, essentialCents || Math.round(income * 0.6)).forEach((p) => plans.push(p));
  }
  return plans.filter((p) => p.plannedCents > 0);
}

function splitEvenly(categories, total) {
  if (!categories || !categories.length || total <= 0) return [];
  const per = Math.floor(total / categories.length);
  const out = categories.map((c) => alloc(c.name_key, per));
  out[out.length - 1].plannedCents += total - per * categories.length;
  return out;
}

export function plannedTotal(plans) {
  return sumCents(plans, (p) => p.plannedCents);
}