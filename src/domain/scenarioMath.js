// Portable, transparent financial math. All results are illustrative estimates — never advice.
// Money values are integer cents. Annual rates are percentages (e.g. 3 means 3%).

const FREQ_PER_YEAR = { weekly: 52, biweekly: 26, monthly: 12, yearly: 1 };

export function contributionsPerYear(frequency) {
  return FREQ_PER_YEAR[frequency] || 12;
}

// Illustrative future value with regular contributions (spec formula), zero-rate baseline always included.
// Returns a month-by-month timeline for display and persistence.
export function savingsProjection({ startCents = 0, contributionCents = 0, frequency = "monthly", months = 12, annualRatePct = 0, inflationPct = 0, startDate = new Date() }) {
  const n = contributionsPerYear(frequency);
  const r = annualRatePct / 100;
  const timeline = [];
  for (let m = 0; m <= months; m++) {
    const t = m / 12;
    const totalContributions = Math.round(contributionCents * n * t);
    const zeroReturn = startCents + totalContributions;
    let projected = zeroReturn;
    if (r > 0) {
      const growthFromContrib = r === 0 ? 0 : contributionCents * (((Math.pow(1 + r / n, n * t) - 1) / (r / n)));
      const growthFromStart = startCents * Math.pow(1 + r, t);
      projected = Math.round(startCents + totalContributions + (growthFromContrib - totalContributions) + (growthFromStart - startCents));
    }
    const inflationAdjusted = inflationPct > 0 ? Math.round(projected / Math.pow(1 + inflationPct / 100, t)) : projected;
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + m);
    timeline.push({
      month_number: m,
      date: date.toISOString().slice(0, 10),
      contribution_amount: contributionCents,
      cumulative_contributions: startCents + totalContributions,
      projected_balance: projected,
      zero_return_balance: zeroReturn,
      estimated_growth_amount: projected - zeroReturn,
      inflation_adjusted_value: inflationAdjusted
    });
  }
  const last = timeline[timeline.length - 1];
  return { timeline, totalContributions: last.cumulative_contributions, zeroReturnBalance: last.zero_return_balance, projectedBalance: last.projected_balance, inflationAdjustedValue: last.inflation_adjusted_value };
}

// Debt payoff comparison: current payment vs extra payment. Returns null months when payment never covers interest.
export function debtPayoff({ balanceCents, annualRatePct = 0, monthlyPaymentCents, extraPaymentCents = 0 }) {
  const run = (payment) => {
    if (payment <= 0) return null;
    const monthlyRate = annualRatePct / 100 / 12;
    let balance = balanceCents;
    let totalPaid = 0;
    let months = 0;
    while (balance > 0 && months < 1200) {
      months++;
      const interest = Math.round(balance * monthlyRate);
      balance = balance + interest - payment;
      totalPaid += payment;
      if (balance <= 0) return { months, totalPaid: totalPaid + balance, interestPaid: totalPaid + balance - balanceCents, remaining: 0 };
    }
    return null; // payment does not cover interest — payoff not reachable
  };
  const baseline = run(monthlyPaymentCents);
  const accelerated = run(monthlyPaymentCents + extraPaymentCents);
  return { baseline, accelerated };
}

// Required weekly/monthly contribution to reach target by date. Cents or null when no date or already reached.
export function suggestedContributions({ targetCents, currentCents, targetDate, now = new Date() }) {
  const remaining = targetCents - currentCents;
  if (remaining <= 0) return { weekly: 0, monthly: 0, remaining: 0, feasible: true };
  if (!targetDate) return { weekly: null, monthly: null, remaining, feasible: null };
  const end = new Date(targetDate + "T00:00:00");
  const days = Math.ceil((end - now) / 86400000);
  if (days <= 0) return { weekly: remaining, monthly: remaining, remaining, feasible: false };
  const weeks = Math.max(1, days / 7);
  const months = Math.max(1, days / 30.44);
  return { weekly: Math.ceil(remaining / weeks), monthly: Math.ceil(remaining / months), remaining, feasible: true };
}

// Explainable safe-to-spend estimate. Every component is user data; result is an estimate, never a guarantee.
export function safeToSpend({ cashEstimateCents = 0, upcomingEssentialBillsCents = 0, remainingEssentialBudgetCents = 0, plannedSavingsCents = 0, debtReserveCents = 0 }) {
  const parts = [
    { key: "cash", amount: cashEstimateCents },
    { key: "bills", amount: -upcomingEssentialBillsCents },
    { key: "essentialBudget", amount: -remainingEssentialBudgetCents },
    { key: "savings", amount: -plannedSavingsCents },
    { key: "debt", amount: -debtReserveCents }
  ];
  const total = parts.reduce((a, p) => a + p.amount, 0);
  return { total, parts };
}