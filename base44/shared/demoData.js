// Shared demo dataset for HabitMoney Coach ("Alex Martínez" persona, Bilbao, EUR).
// Deterministic, language-parameterised, and fully portable: placeholder names link records; the
// calling function resolves real ids after creation. All money is integer cents.

const NAMES = {
  income: { en: "Income", es: "Ingresos" },
  rent: { en: "Rent or Mortgage", es: "Alquiler o hipoteca" },
  utilities: { en: "Utilities", es: "Suministros" },
  groceries: { en: "Groceries", es: "Supermercado" },
  transport: { en: "Transport", es: "Transporte" },
  insurance: { en: "Insurance", es: "Seguros" },
  healthcare: { en: "Healthcare", es: "Salud" },
  education: { en: "Education", es: "Educación" },
  restaurants: { en: "Restaurants and Takeaway", es: "Restaurantes y comida a domicilio" },
  coffee: { en: "Coffee", es: "Café" },
  shopping: { en: "Shopping", es: "Compras" },
  entertainment: { en: "Entertainment", es: "Ocio" },
  travel: { en: "Travel", es: "Viajes" },
  subscriptions: { en: "Subscriptions", es: "Suscripciones" },
  gifts: { en: "Gifts", es: "Regalos" },
  savings: { en: "Savings", es: "Ahorro" },
  debt: { en: "Debt Payments", es: "Pagos de deuda" },
  transfers: { en: "Transfers", es: "Transferencias" },
  other: { en: "Other", es: "Otro" }
};

const lang = (l, key) => (NAMES[key] && NAMES[key][l]) || NAMES[key].en;

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function d(daysAgo) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

export function demoCategories(userId, language) {
  const defs = [
    ["income", "income", "Banknote", "#1d4ed8", false],
    ["rent", "essential_expense", "Home", "#0f766e", true],
    ["utilities", "essential_expense", "PlugZap", "#0f766e", true],
    ["groceries", "essential_expense", "ShoppingCart", "#0d9488", true],
    ["transport", "essential_expense", "Bus", "#0d9488", true],
    ["insurance", "essential_expense", "ShieldCheck", "#0f766e", true],
    ["healthcare", "essential_expense", "HeartPulse", "#0f766e", true],
    ["education", "essential_expense", "GraduationCap", "#155e75", true],
    ["restaurants", "discretionary_expense", "Utensils", "#b45309", false],
    ["coffee", "discretionary_expense", "Coffee", "#b45309", false],
    ["shopping", "discretionary_expense", "ShoppingBag", "#7c3aed", false],
    ["entertainment", "discretionary_expense", "Clapperboard", "#7c3aed", false],
    ["travel", "discretionary_expense", "Plane", "#7c3aed", false],
    ["subscriptions", "discretionary_expense", "Repeat", "#6d28d9", false],
    ["gifts", "discretionary_expense", "Gift", "#a21caf", false],
    ["savings", "savings", "PiggyBank", "#15803d", false],
    ["debt", "debt_payment", "Landmark", "#9a3412", false],
    ["transfers", "transfer", "ArrowLeftRight", "#64748b", false],
    ["other", "other", "Circle", "#64748b", false]
  ];
  return defs.map(([key, type, icon, color, essential], i) => ({
    user_id: userId,
    name: lang(language, key),
    name_key: "category." + key,
    category_type: type,
    icon,
    color,
    is_essential: essential,
    active: true,
    archived: false,
    display_order: i,
    is_system: true
  }));
}

export function demoAccounts(userId) {
  return [
    { user_id: userId, name: "Cuenta Principal — Kutxabank", type: "current_account", currency: "EUR", institution_name: "Kutxabank", opening_balance: 150000, current_balance: 182340, source: "demo", connection_status: "not_connected", active: true, archived: false },
    { user_id: userId, name: "Cuenta de Ahorro", type: "savings_account", currency: "EUR", institution_name: "Kutxabank", opening_balance: 90000, current_balance: 137000, source: "demo", active: true, archived: false },
    { user_id: userId, name: "Efectivo", type: "cash", currency: "EUR", opening_balance: 6000, current_balance: 4250, source: "demo", active: true, archived: false }
  ];
}

export function demoTransactions(userId, catByName, acctByName) {
  const r = rng(20260919);
  const tx = [];
  let idem = 0;
  const add = (daysAgo, catKey, dir, amount, merchant, opts = {}) => {
    tx.push({
      user_id: userId,
      account_id: opts.account || acctByName["Cuenta Principal — Kutxabank"],
      category_id: catByName[lang("es", catKey)] || catByName[lang("en", catKey)],
      transaction_date: d(daysAgo),
      amount,
      direction: dir,
      merchant_name: merchant,
      merchant_normalized: merchant.toLowerCase(),
      source: "demo",
      is_recurring: !!opts.recurring,
      is_transfer: !!opts.transfer,
      is_refund: !!opts.refund,
      is_excluded_from_budget: false,
      is_excluded_from_insights: false,
      active: true,
      archived: false,
      idempotency_key: "demo-" + userId + "-" + idem++
    });
  };
  // Salaries
  add(59, "income", "income", 220000, "Nómina — Estudio de arquitectura");
  add(29, "income", "income", 220000, "Nómina — Estudio de arquitectura");
  add(1, "income", "income", 220000, "Nómina — Estudio de arquitectura");
  // Rent + utilities + insurance (recurring)
  add(56, "rent", "expense", 70000, "Alquiler", { recurring: true });
  add(26, "rent", "expense", 70000, "Alquiler", { recurring: true });
  add(52, "utilities", "expense", 8420, "Iberdrola", { recurring: true });
  add(24, "utilities", "expense", 9180, "Iberdrola", { recurring: true });
  add(50, "insurance", "expense", 4350, "Seguro de hogar", { recurring: true });
  add(20, "insurance", "expense", 4350, "Seguro de hogar", { recurring: true });
  // Groceries weekly
  for (let w = 0; w < 9; w++) add(55 - w * 7, "groceries", "expense", 5200 + Math.round(r() * 2400), "Mercadona");
  // Transport
  add(58, "transport", "expense", 3480, "Barik — Bilbao", { recurring: true });
  add(28, "transport", "expense", 3480, "Barik — Bilbao", { recurring: true });
  add(40, "transport", "expense", 1450, "Taxi");
  add(12, "transport", "expense", 980, "Taxi");
  // Restaurants / takeaway
  const resto = [["Bar Gure Toki", 2600], ["Wok Zen", 1850], ["Pizza Napoli", 2240], ["Kebab Doner", 1120], ["Restaurante Victori", 4500], ["Gloria Multitecnicos", 1750], ["Sushi Ito", 3350], ["Burgerteca", 1590], ["Sidreria Zugasti", 2900], ["La Ribera", 3900], ["Pizzeria Bella", 1980], ["Kebab Istanbul", 1080]];
  resto.forEach(([m, a], i) => add(57 - i * 5, "restaurants", "expense", a, m));
  // Coffee
  for (let c = 0; c < 12; c++) add(58 - c * 5, "coffee", "expense", 150 + Math.round(r() * 180), "Café La Gran Vía");
  // Shopping
  add(47, "shopping", "expense", 5890, "Zara");
  add(35, "shopping", "expense", 3200, "Decathlon");
  add(21, "shopping", "expense", 7950, "MediaMarkt");
  add(9, "shopping", "expense", 2450, "Amazon");
  add(3, "shopping", "expense", 4100, "El Corte Inglés");
  // Entertainment
  add(43, "entertainment", "expense", 1100, "Cines Yelmo");
  add(18, "entertainment", "expense", 2400, "Concierto — Bilbao Arena");
  add(7, "entertainment", "expense", 1350, "Museo Guggenheim");
  // Subscriptions (recurring)
  add(55, "subscriptions", "expense", 1399, "Netflix", { recurring: true });
  add(25, "subscriptions", "expense", 1399, "Netflix", { recurring: true });
  add(54, "subscriptions", "expense", 1099, "Spotify", { recurring: true });
  add(24, "subscriptions", "expense", 1099, "Spotify", { recurring: true });
  add(53, "subscriptions", "expense", 3499, "Gimnasio Padura", { recurring: true });
  add(23, "subscriptions", "expense", 3499, "Gimnasio Padura", { recurring: true });
  add(51, "subscriptions", "expense", 999, "Pepephone", { recurring: true });
  add(22, "subscriptions", "expense", 999, "Pepephone", { recurring: true });
  add(49, "subscriptions", "expense", 299, "iCloud", { recurring: true });
  add(19, "subscriptions", "expense", 299, "iCloud", { recurring: true });
  // Gifts, healthcare, education, travel
  add(33, "gifts", "expense", 3500, "Regalo cumpleaños — Ama");
  add(11, "gifts", "expense", 2800, "Regalo — Unai");
  add(38, "healthcare", "expense", 4600, "Farmacia Arriaga");
  add(16, "healthcare", "expense", 6500, "Dentista");
  add(30, "education", "expense", 8500, "Curso Revit");
  add(45, "travel", "expense", 15800, "Vuelo a Lisboa");
  // Savings transfers (excluded from spending — recorded as transfers)
  add(57, "transfers", "transfer_out", 15000, "Transferencia a ahorro", { transfer: true, account: acctByName["Cuenta Principal — Kutxabank"] });
  add(57, "transfers", "transfer_in", 15000, "Transferencia a ahorro", { transfer: true, account: acctByName["Cuenta de Ahorro"] });
  add(27, "transfers", "transfer_out", 10000, "Transferencia a ahorro", { transfer: true, account: acctByName["Cuenta Principal — Kutxabank"] });
  add(27, "transfers", "transfer_in", 10000, "Transferencia a ahorro", { transfer: true, account: acctByName["Cuenta de Ahorro"] });
  add(14, "transfers", "transfer_out", 12000, "Transferencia a ahorro", { transfer: true, account: acctByName["Cuenta Principal — Kutxabank"] });
  add(14, "transfers", "transfer_in", 12000, "Transferencia a ahorro", { transfer: true, account: acctByName["Cuenta de Ahorro"] });
  // Cash top-ups
  add(44, "transfers", "transfer_out", 3000, "Sacar efectivo", { transfer: true, account: acctByName["Cuenta Principal — Kutxabank"] });
  add(44, "transfers", "transfer_in", 3000, "Sacar efectivo", { transfer: true, account: acctByName["Efectivo"] });
  // Refund
  add(6, "shopping", "refund", 7950, "Devolución MediaMarkt", { refund: true });
  // Debt payment
  add(31, "debt", "debt_payment", 12000, "Préstamo coche");
  add(2, "debt", "debt_payment", 12000, "Préstamo coche");
  // Cash coffees
  add(25, "coffee", "expense", 220, "Café — Efectivo", { account: acctByName["Efectivo"] });
  add(10, "coffee", "expense", 180, "Café — Efectivo", { account: acctByName["Efectivo"] });
  return tx;
}

export function demoRecurring(userId, catByName, acctByName) {
  const main = acctByName["Cuenta Principal — Kutxabank"];
  return [
    { user_id: userId, name: "Alquiler", category_id: catByName["Alquiler o hipoteca"], account_id: main, amount: 70000, direction: "expense", frequency: "monthly", next_due_date: d(-9), billing_day: 1, merchant_name: "Arrendadora Bilbao", status: "active", active: true, archived: false },
    { user_id: userId, name: "Iberdrola — Luz", category_id: catByName["Suministros"], account_id: main, amount: 8800, direction: "expense", frequency: "monthly", next_due_date: d(-2), billing_day: 5, merchant_name: "Iberdrola", status: "active", active: true, archived: false },
    { user_id: userId, name: "Netflix", category_id: catByName["Suscripciones"], account_id: main, amount: 1399, direction: "expense", frequency: "monthly", next_due_date: d(3), is_subscription: true, merchant_name: "Netflix", status: "active", active: true, archived: false },
    { user_id: userId, name: "Spotify", category_id: catByName["Suscripciones"], account_id: main, amount: 1099, direction: "expense", frequency: "monthly", next_due_date: d(6), is_subscription: true, merchant_name: "Spotify", status: "active", active: true, archived: false },
    { user_id: userId, name: "Gimnasio Padura", category_id: catByName["Suscripciones"], account_id: main, amount: 3499, direction: "expense", frequency: "monthly", next_due_date: d(11), is_subscription: true, merchant_name: "Gimnasio Padura", status: "active", active: true, archived: false },
    { user_id: userId, name: "Pepephone — Móvil", category_id: catByName["Suscripciones"], account_id: main, amount: 999, direction: "expense", frequency: "monthly", next_due_date: d(8), is_subscription: true, merchant_name: "Pepephone", status: "active", active: true, archived: false },
    { user_id: userId, name: "Seguro de hogar", category_id: catByName["Seguros"], account_id: main, amount: 4350, direction: "expense", frequency: "monthly", next_due_date: d(14), merchant_name: "Mapfre", status: "active", active: true, archived: false },
    { user_id: userId, name: "iCloud", category_id: catByName["Suscripciones"], account_id: main, amount: 299, direction: "expense", frequency: "monthly", next_due_date: d(5), is_subscription: true, merchant_name: "Apple", status: "active", active: true, archived: false }
  ];
}

export function demoGoals(userId) {
  return [
    { user_id: userId, name: "Fondo de emergencia", description: "Un colchón tranquilo para imprevistos", target_amount: 300000, current_amount: 90000, currency: "EUR", start_date: d(120), target_date: d(-240), priority: "high", goal_type: "emergency_fund", status: "active", suggested_monthly_contribution: 10500 },
    { user_id: userId, name: "Viaje de verano", description: "Una semana por la costa gallega", target_amount: 180000, current_amount: 32000, currency: "EUR", start_date: d(90), target_date: d(-260), priority: "medium", goal_type: "travel", status: "active", suggested_monthly_contribution: 14800 },
    { user_id: userId, name: "Portátil nuevo", description: "Para trabajar mejor", target_amount: 120000, current_amount: 45000, currency: "EUR", start_date: d(60), target_date: d(-90), priority: "low", goal_type: "purchase", status: "active", suggested_monthly_contribution: 16600 }
  ];
}

export function demoContributions(userId, goalByName) {
  const rows = [];
  const amounts = [
    ["Fondo de emergencia", 45, 15000], ["Fondo de emergencia", 30, 10000], ["Fondo de emergencia", 16, 10000],
    ["Fondo de emergencia", 5, 5000], ["Fondo de emergencia", 2, 20000],
    ["Viaje de verano", 42, 8000], ["Viaje de verano", 25, 6000], ["Viaje de verano", 8, 9000], ["Viaje de verano", 4, 9000],
    ["Portátil nuevo", 20, 15000], ["Portátil nuevo", 6, 15000]
  ];
  let i = 0;
  for (const [g, days, amt] of amounts) {
    rows.push({ user_id: userId, goal_id: goalByName[g], contribution_date: d(days), amount: amt, source: "manual", note: "Aportación puntual", created_by_user_id: userId });
    i++;
  }
  return rows;
}

export function demoBudget(userId, catByName) {
  const monthOf = (offset) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: start.toLocaleDateString("en", { month: "long", year: "numeric" }) };
  };
  const allocs = [
    ["Alquiler o hipoteca", 70000], ["Suministros", 9000], ["Supermercado", 30000], ["Transporte", 6000],
    ["Restaurantes y comida a domicilio", 14000], ["Café", 2000], ["Compras", 8000], ["Ocio", 3000]
  ];
  const periods = [-1, 0].map((offset) => {
    const m = monthOf(offset);
    return {
      period: {
        user_id: userId, period_start: m.start, period_end: m.end, month_label: m.label,
        income_planned: 220000, income_actual: offset === 0 ? 220000 : 220000,
        total_expense_budget: allocs.reduce((a, [, v]) => a + v, 0),
        total_expense_actual: offset === 0 ? 0 : 161240,
        total_savings_target: 20000, total_savings_actual: offset === 0 ? 0 : 37000,
        budget_method: "category_budget", status: offset === 0 ? "active" : "closed",
        completed_at: offset === 0 ? undefined : d(19)
      },
      allocations: allocs.map(([name, planned]) => ({
        user_id: userId, category_id: catByName[name], planned_amount: planned, actual_amount: offset === 0 ? 0 : Math.round(planned * (0.7 + ((planned % 3000) / 30000))), variance_amount: planned, alert_threshold_percentage: 80
      }))
    };
  });
  return periods;
}

export function demoChallenges(userId) {
  return [
    { user_id: userId, title: "challenge.log7", description: "challenge.log7Desc", challenge_type: "expense_logging_streak", start_date: d(40), end_date: d(33), target_value: 7, current_progress: 7, unit: "days", status: "completed", completion_percentage: 100, reward_points: 20, completed_at: d(33) },
    { user_id: userId, title: "challenge.save5", description: "challenge.save5Desc", challenge_type: "save_amount", start_date: d(25), end_date: d(24), target_value: 500, current_progress: 500, unit: "cents", status: "completed", completion_percentage: 100, reward_points: 10, completed_at: d(24) },
    { user_id: userId, title: "challenge.budgetCheckIn", description: "challenge.budgetCheckInDesc", challenge_type: "budget_check_in", start_date: d(12), end_date: d(11), target_value: 1, current_progress: 1, unit: "check-ins", status: "completed", completion_percentage: 100, reward_points: 10, completed_at: d(11) },
    { user_id: userId, title: "challenge.noSpendDay", description: "challenge.noSpendDayDesc", challenge_type: "no_spend_day", start_date: d(1), end_date: d(0), target_value: 1, current_progress: 0, unit: "days", status: "active", completion_percentage: 0, reward_points: 10 },
    { user_id: userId, title: "challenge.cookHome", description: "challenge.cookHomeDesc", challenge_type: "home_cooking", start_date: d(3), end_date: d(-4), target_value: 3, current_progress: 1, unit: "meals", status: "active", completion_percentage: 33, reward_points: 15 }
  ];
}

export function demoCheckIns(userId) {
  const conf = ["high", "neutral", "high", "very_high", "neutral", "low", "high", "neutral", "high", "very_high"];
  return conf.map((c, i) => ({
    user_id: userId, check_in_date: d(i + 1), spending_confidence: c, spent_intentionally: i % 3 !== 2,
    completed_challenge_action: i === 0 || i === 4,
    note: i === 3 ? "Semana tranquila con los gastos" : undefined,
    selected_focus_for_tomorrow: i === 6 ? "Mirar las suscripciones" : undefined
  }));
}

export function demoNudges(userId) {
  return [
    { user_id: userId, nudge_type: "positive_reinforcement", title: "nudge.positive_reinforcement", message: "nudge.positive_reinforcement", explanation: "Sent every few days based on your own activity.", recommended_action: "today.firstAction", action_url: "/", priority: "normal", scheduled_at: d(1), displayed_at: d(1), status: "displayed", unique_deduplication_key: "demo-pr-1" },
    { user_id: userId, nudge_type: "upcoming_bill", title: "nudge.upcoming_bill", message: "nudge.upcoming_bill", explanation: "Shown because you track bills and one is due within your reminder window.", recommended_action: "bills.title", action_url: "/bills", priority: "normal", scheduled_at: d(2), displayed_at: d(2), status: "displayed", unique_deduplication_key: "demo-bill-1" },
    { user_id: userId, nudge_type: "challenge_progress", title: "nudge.challenge_progress", message: "nudge.challenge_progress", explanation: "Shown because you have an active challenge — skipping is always fine.", recommended_action: "challenges.title", action_url: "/challenges", priority: "low", scheduled_at: d(2), displayed_at: d(2), status: "displayed", unique_deduplication_key: "demo-ch-1" },
    { user_id: userId, nudge_type: "weekly_review", title: "nudge.weekly_review", message: "nudge.weekly_review", explanation: "Your review day is coming up.", recommended_action: "review.title", action_url: "/weekly-review", priority: "normal", scheduled_at: d(3), displayed_at: d(3), status: "acted_on", acted_at: d(3), unique_deduplication_key: "demo-wr-1" },
    { user_id: userId, nudge_type: "data_quality", title: "nudge.data_quality", message: "nudge.data_quality", explanation: "Shown when some entries have no category.", recommended_action: "spending.title", action_url: "/spending", priority: "low", scheduled_at: d(4), displayed_at: d(4), status: "dismissed", dismissed_at: d(4), unique_deduplication_key: "demo-dq-1" },
    { user_id: userId, nudge_type: "goal_progress", title: "nudge.goal_progress", message: "nudge.goal_progress", explanation: "Shown after a contribution you recorded.", recommended_action: "goals.title", action_url: "/goals", priority: "normal", scheduled_at: d(5), displayed_at: d(5), status: "acted_on", acted_at: d(5), unique_deduplication_key: "demo-gp-1" },
    { user_id: userId, nudge_type: "transaction_logging", title: "nudge.transaction_logging", message: "nudge.transaction_logging", explanation: "A gentle option on days with no entries — never required.", recommended_action: "spending.title", action_url: "/spending", priority: "low", scheduled_at: d(7), displayed_at: d(7), status: "expired", unique_deduplication_key: "demo-tl-1" },
    { user_id: userId, nudge_type: "subscription_review", title: "challenge.reviewSub", message: "challenge.reviewSubDesc", explanation: "Occasional reminder that a subscription review challenge exists.", recommended_action: "challenges.title", action_url: "/challenges", priority: "low", scheduled_at: d(10), displayed_at: d(10), status: "displayed", unique_deduplication_key: "demo-sr-1" }
  ];
}

export function demoAchievements(userId) {
  const a = (type, days, icon, extra = {}) => ({ user_id: userId, achievement_type: type, title: type, description: type, earned_at: d(days), badge_icon: icon, is_visible: true, ...extra });
  return [
    a("first_transaction", 60, "Receipt"),
    a("first_budget", 55, "Wallet"),
    a("first_goal", 54, "Target"),
    a("first_contribution", 45, "PiggyBank"),
    a("first_challenge", 40, "Rocket"),
    a("challenge_streak", 33, "Flame"),
    a("savings_milestone", 16, "Medal", { progress_value: 25, target_value: 100, related_entity_type: "SavingsGoal" }),
    a("weekly_review_streak", 21, "CalendarCheck"),
    a("no_spend_streak", 24, "Leaf"),
    a("data_cleanup", 15, "Sparkles")
  ];
}

export function demoRewards(userId) {
  const entries = [
    [40, "first_challenge", 10], [33, "challenge_completed:log7", 20], [25, "challenge_completed:save5", 10],
    [24, "no_spend_streak", 5], [21, "weekly_review_streak", 5], [16, "savings_milestone_25", 5],
    [12, "challenge_completed:budgetCheckIn", 10], [11, "data_cleanup", 5]
  ];
  let balance = 0;
  return entries.map(([days, reason, pts]) => {
    balance += pts;
    return { user_id: userId, points_change: pts, reason, balance_after: balance, related_entity_type: "UserChallenge" };
  });
}

export function demoReviews(userId) {
  const mk = (week) => {
    const end = new Date(Date.now() - (week * 7 + 1) * 86400000);
    const start = new Date(end.getTime() - 6 * 86400000);
    return {
      user_id: userId,
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      total_income: week === 1 ? 220000 : 0,
      total_spending: [62340, 58120, 71460][week - 1],
      total_savings: [10000, 15000, 12000][week - 1],
      planned_budget_amount: 142000,
      actual_budget_amount: [62340, 58120, 71460][week - 1],
      largest_category: "Supermercado",
      spending_change_from_prior_period: [-3220, -9110, 13340][week - 1],
      goal_progress_summary: "Fondo de emergencia +10000 · Viaje de verano +9000",
      challenge_summary: "1 completado",
      positive_win: "Cocinaste en casa tres veces",
      reflection_prompt: "review.q1",
      user_reflection: week === 1 ? "Me sorprendió lo poco que gasté en cafés" : undefined,
      next_week_focus: week === 1 ? "Revisar suscripciones" : undefined,
      completed_at: end.toISOString(),
      generated_at: end.toISOString(),
      status: "completed"
    };
  };
  return [mk(1), mk(2), mk(3)];
}

export function demoScenarios(userId) {
  const timeline = (start, contribution, months, perYear) => {
    const rows = [];
    let cumul = start;
    for (let m = 1; m <= months; m++) {
      cumul = start + contribution * Math.round(perYear * (m / 12));
      const date = new Date();
      date.setMonth(date.getMonth() + m);
      rows.push({
        user_id: userId, month_number: m, date: date.toISOString().slice(0, 10),
        contribution_amount: contribution, cumulative_contributions: cumul,
        projected_balance: cumul, zero_return_balance: cumul, estimated_growth_amount: 0,
        inflation_adjusted_value: cumul, assumptions_version: "demo-v1"
      });
    }
    return rows;
  };
  const now = new Date().toISOString().slice(0, 10);
  return [
    {
      scenario: { user_id: userId, name: "scenario.tpl.save50", scenario_type: "weekly_saving", start_date: now, duration_months: 12, current_balance: 90000, recurring_contribution_amount: 5000, contribution_frequency: "weekly", assumed_annual_rate_percentage: 0, use_zero_return_baseline: true, disclaimer_acknowledged_at: now, archived: false },
      results: timeline(90000, 5000, 12, 52)
    },
    {
      scenario: { user_id: userId, name: "scenario.tpl.save100", scenario_type: "savings_growth", start_date: now, duration_months: 24, current_balance: 0, recurring_contribution_amount: 10000, contribution_frequency: "monthly", assumed_annual_rate_percentage: 0, use_zero_return_baseline: true, disclaimer_acknowledged_at: now, archived: false },
      results: timeline(0, 10000, 24, 12)
    },
    {
      scenario: { user_id: userId, name: "scenario.tpl.cancelSub", scenario_type: "subscription_cancellation", start_date: now, duration_months: 12, current_balance: 0, recurring_contribution_amount: 1399, contribution_frequency: "monthly", assumed_annual_rate_percentage: 0, use_zero_return_baseline: true, disclaimer_acknowledged_at: now, archived: false },
      results: timeline(0, 1399, 12, 12)
    },
    {
      scenario: { user_id: userId, name: "scenario.tpl.emergency1000", scenario_type: "emergency_fund", start_date: now, duration_months: 6, current_balance: 90000, recurring_contribution_amount: 2000, contribution_frequency: "monthly", assumed_annual_rate_percentage: 0, use_zero_return_baseline: true, disclaimer_acknowledged_at: now, archived: false },
      results: timeline(90000, 2000, 6, 12)
    },
    {
      scenario: { user_id: userId, name: "scenario.tpl.debtExtra", scenario_type: "debt_payoff", start_date: now, duration_months: 40, current_balance: 0, debt_balance: 1200000, debt_interest_rate_percentage: 18, extra_debt_payment_amount: 10000, use_zero_return_baseline: true, disclaimer_acknowledged_at: now, archived: false, baseline_result: { months: 47, totalPaid: 1410000 }, projected_result: { months: 35, totalPaid: 1290000 } },
      results: []
    }
  ];
}

export function demoMisc(userId, ownerEmail) {
  return {
    importBatch: { user_id: userId, source: "demo", source_file_name: "export-kutxabank-sep.csv", file_size: 48213, imported_at: d(15), status: "completed", total_rows: 42, accepted_rows: 37, duplicate_rows: 3, rejected_rows: 2, completed_at: d(15) },
    exportRequest: { user_id: userId, export_type: "transactions", requested_at: d(8), status: "completed", secure_file_reference: "local_download", completed_at: d(8), expires_at: d(-1), downloaded_at: d(8) },
    household: { owner_user_id: userId, name: "Hogar Martínez", default_currency: "EUR", timezone: "Europe/Madrid", active: true, sharing_description: "Objetivos y presupuestos compartidos; datos privados por defecto.", member_user_ids: [] },
    membership: { household_id: null, user_id: "invited-demo-member", role: "member", status: "invited", can_view_shared_transactions: false, can_add_shared_transactions: false, can_manage_shared_budget: true, can_manage_shared_goals: true, invited_at: d(6) }
  };
}