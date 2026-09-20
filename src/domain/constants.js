// Portable domain constants. Language-independent values only — all user-facing labels use i18n keys.

export const DISCLAIMER_KEY = "disclaimer.educational";

export const DIRECTIONS = ["income", "expense", "transfer_in", "transfer_out", "savings_contribution", "debt_payment", "refund"];
export const EXPENSE_DIRECTIONS = ["expense", "savings_contribution", "debt_payment"];
export const SOURCES = ["manual", "CSV_import", "open_banking", "recurring_generated", "demo"];

export const COACHING_STYLES = ["gentle", "practical", "motivating", "minimal"];
export const NOTIFICATION_FREQUENCIES = ["none", "essential_only", "daily", "weekly", "personalised"];
export const PRIORITIES = ["reduce_spending", "build_emergency_fund", "save_for_goal", "manage_bills", "reduce_debt", "understand_habits", "other"];
export const BUDGET_METHODS = ["category_budget", "zero_based", "50_30_20", "flexible", "no_budget"];
export const ACCOUNT_TYPES = ["cash", "current_account", "savings_account", "credit_card", "loan", "investment_reference", "other"];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Free = 1 account, 2 active goals; Plus unlimited; Household adds sharing; Premium adds open banking + AI reflection.
export const PLAN_LIMITS = {
  free: { accounts: 1, active_goals: 2, scenario_saves: 3, csv_export_rows: 100 },
  plus: { accounts: Infinity, active_goals: Infinity, scenario_saves: Infinity, csv_export_rows: Infinity },
  household: { accounts: Infinity, active_goals: Infinity, scenario_saves: Infinity, csv_export_rows: Infinity, members: 5 },
  premium: { accounts: Infinity, active_goals: Infinity, scenario_saves: Infinity, csv_export_rows: Infinity, members: 5 }
};

export const STARTER_CATEGORIES = [
  { key: "category.income", type: "income", icon: "Banknote", color: "#1d4ed8", essential: false },
  { key: "category.rentMortgage", type: "essential_expense", icon: "Home", color: "#0f766e", essential: true },
  { key: "category.utilities", type: "essential_expense", icon: "PlugZap", color: "#0f766e", essential: true },
  { key: "category.groceries", type: "essential_expense", icon: "ShoppingCart", color: "#0d9488", essential: true },
  { key: "category.transport", type: "essential_expense", icon: "Bus", color: "#0d9488", essential: true },
  { key: "category.insurance", type: "essential_expense", icon: "ShieldCheck", color: "#0f766e", essential: true },
  { key: "category.healthcare", type: "essential_expense", icon: "HeartPulse", color: "#0f766e", essential: true },
  { key: "category.education", type: "essential_expense", icon: "GraduationCap", color: "#155e75", essential: true },
  { key: "category.restaurants", type: "discretionary_expense", icon: "Utensils", color: "#b45309", essential: false, temptation: true },
  { key: "category.coffee", type: "discretionary_expense", icon: "Coffee", color: "#b45309", essential: false, temptation: true },
  { key: "category.shopping", type: "discretionary_expense", icon: "ShoppingBag", color: "#7c3aed", essential: false, temptation: true },
  { key: "category.entertainment", type: "discretionary_expense", icon: "Clapperboard", color: "#7c3aed", essential: false },
  { key: "category.travel", type: "discretionary_expense", icon: "Plane", color: "#7c3aed", essential: false },
  { key: "category.subscriptions", type: "discretionary_expense", icon: "Repeat", color: "#6d28d9", essential: false },
  { key: "category.gifts", type: "discretionary_expense", icon: "Gift", color: "#a21caf", essential: false },
  { key: "category.savings", type: "savings", icon: "PiggyBank", color: "#15803d", essential: false },
  { key: "category.debtPayments", type: "debt_payment", icon: "Landmark", color: "#9a3412", essential: false },
  { key: "category.transfers", type: "transfer", icon: "ArrowLeftRight", color: "#64748b", essential: false },
  { key: "category.other", type: "other", icon: "Circle", color: "#64748b", essential: false }
];

export const CHALLENGE_LIBRARY = [
  { id: "no_spend_day", type: "no_spend_day", titleKey: "challenge.noSpendDay", descKey: "challenge.noSpendDayDesc", rulesKey: "challenge.noSpendDayRules", duration_days: 1, target_type: "days_completed", target_value: 1, unit: "days", difficulty: "easy", points: 10 },
  { id: "no_spend_weekend", type: "no_spend_weekend", titleKey: "challenge.noSpendWeekend", descKey: "challenge.noSpendWeekendDesc", rulesKey: "challenge.noSpendWeekendRules", duration_days: 2, target_type: "days_completed", target_value: 2, unit: "days", difficulty: "medium", points: 15 },
  { id: "save_5_today", type: "save_amount", titleKey: "challenge.save5", descKey: "challenge.save5Desc", rulesKey: "challenge.save5Rules", duration_days: 1, target_type: "amount_saved", target_value: 500, unit: "cents", difficulty: "easy", points: 10 },
  { id: "save_20_week", type: "save_amount", titleKey: "challenge.save20", descKey: "challenge.save20Desc", rulesKey: "challenge.save20Rules", duration_days: 7, target_type: "amount_saved", target_value: 2000, unit: "cents", difficulty: "medium", points: 20 },
  { id: "log_7_days", type: "expense_logging_streak", titleKey: "challenge.log7", descKey: "challenge.log7Desc", rulesKey: "challenge.log7Rules", duration_days: 7, target_type: "days_logged", target_value: 7, unit: "days", difficulty: "medium", points: 20 },
  { id: "review_subscription", type: "subscription_review", titleKey: "challenge.reviewSub", descKey: "challenge.reviewSubDesc", rulesKey: "challenge.reviewSubRules", duration_days: 1, target_type: "count", target_value: 1, unit: "reviews", difficulty: "easy", points: 10 },
  { id: "wait_24_hours", type: "wait_24_hours", titleKey: "challenge.wait24", descKey: "challenge.wait24Desc", rulesKey: "challenge.wait24Rules", duration_days: 1, target_type: "count", target_value: 1, unit: "waits", difficulty: "easy", points: 10 },
  { id: "cook_home_3", type: "home_cooking", titleKey: "challenge.cookHome", descKey: "challenge.cookHomeDesc", rulesKey: "challenge.cookHomeRules", duration_days: 7, target_type: "count", target_value: 3, unit: "meals", difficulty: "medium", points: 15 },
  { id: "pack_lunch_5", type: "home_cooking", titleKey: "challenge.packLunch", descKey: "challenge.packLunchDesc", rulesKey: "challenge.packLunchRules", duration_days: 5, target_type: "count", target_value: 5, unit: "lunches", difficulty: "medium", points: 15 },
  { id: "emergency_starter", type: "emergency_fund_starter", titleKey: "challenge.emergencyStarter", descKey: "challenge.emergencyStarterDesc", rulesKey: "challenge.emergencyStarterRules", duration_days: 7, target_type: "amount_saved", target_value: 2500, unit: "cents", difficulty: "easy", points: 15 },
  { id: "budget_check_in", type: "budget_check_in", titleKey: "challenge.budgetCheckIn", descKey: "challenge.budgetCheckInDesc", rulesKey: "challenge.budgetCheckInRules", duration_days: 1, target_type: "count", target_value: 1, unit: "check-ins", difficulty: "easy", points: 10 }
];

export const SCENARIO_TEMPLATES = [
  { id: "save_50_week", type: "weekly_saving", nameKey: "scenario.tpl.save50", contribution: 5000, frequency: "weekly" },
  { id: "save_100_month", type: "savings_growth", nameKey: "scenario.tpl.save100", contribution: 10000, frequency: "monthly" },
  { id: "reduce_takeaway", type: "spending_reduction", nameKey: "scenario.tpl.reduceTakeaway", contribution: 8000, frequency: "monthly" },
  { id: "cancel_15_sub", type: "subscription_cancellation", nameKey: "scenario.tpl.cancelSub", contribution: 1500, frequency: "monthly" },
  { id: "emergency_1000", type: "emergency_fund", nameKey: "scenario.tpl.emergency1000", contribution: 0, frequency: "monthly" },
  { id: "goal_timeline", type: "savings_growth", nameKey: "scenario.tpl.goalTimeline", contribution: 0, frequency: "monthly" },
  { id: "debt_extra_100", type: "debt_payoff", nameKey: "scenario.tpl.debtExtra", contribution: 0, frequency: "monthly" },
  { id: "custom", type: "custom", nameKey: "scenario.tpl.custom", contribution: 0, frequency: "monthly" }
];

export const GOAL_TYPES = ["emergency_fund", "travel", "home", "education", "purchase", "debt_reduction", "buffer", "other"];