const MAX_SNOWBALL_MONTHS = 480;

const compareByName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
const compareSnowball = (a, b) => {
  if (a.balance !== b.balance) return a.balance - b.balance;
  if (a.apr !== b.apr) return a.apr - b.apr;
  return compareByName(a, b);
};
const compareAvalanche = (a, b) => {
  if (a.apr !== b.apr) return b.apr - a.apr;
  if (a.balance !== b.balance) return a.balance - b.balance;
  return compareByName(a, b);
};

const runDebtSimulation = (cards, baseExtra, paidRollForward, compareStrategy = compareSnowball) => {
  const activeCards = (cards || [])
    .filter((card) => !card.paid)
    .map((card) => ({
      id: card.id,
      name: card.name || "Balance",
      balance: Math.max(0, Number(card.balance) || 0),
      apr: Math.max(0, Number(card.apr) || 0),
      minPayment: Math.max(0, Number(card.minPayment) || 0),
    }))
    .filter((card) => card.balance > 0);

  if (activeCards.length === 0) {
    return [];
  }

  const entryMap = new Map();
  activeCards.forEach((card) => {
    entryMap.set(card.id, {
      id: card.id,
      name: card.name,
      startBalance: card.balance,
      apr: card.apr,
      minPayment: card.minPayment,
      termMonths: card.termMonths,
      totalInterest: 0,
      months: null,
      extraApplied: 0,
      paidOff: false,
      finalPayment: 0,
    });
  });

  const rollForwardFromPaid =
    typeof paidRollForward === "number"
      ? paidRollForward
      : (cards || []).reduce((sum, card) => sum + (card.paid ? Number(card.rollForward) || 0 : 0), 0);
  let carryover = Number(rollForwardFromPaid) || 0;
  let payoffSequence = 0;
  let month = 0;
  let active = activeCards.map((card) => ({ ...card }));

  while (active.length > 0 && month < MAX_SNOWBALL_MONTHS) {
    month += 1;

    active.forEach((card) => {
      const entry = entryMap.get(card.id);
      const monthlyRate = card.apr > 0 ? card.apr / 100 / 12 : 0;
      const interest = card.balance * monthlyRate;
      card.balance += interest;
      entry.totalInterest += interest;
    });

    active.sort(compareStrategy);

    const target = active[0];
    const targetExtra = Math.max(0, baseExtra + carryover);
    const hasPositivePayment = active.some(
      (card) => card.minPayment > 0 || (card.id === target.id && targetExtra > 0)
    );
    if (!hasPositivePayment) {
      break;
    }
    const targetEntry = entryMap.get(target.id);
    if (targetEntry.extraApplied < targetExtra) {
      targetEntry.extraApplied = targetExtra;
    }

    const payments = [];
    active.forEach((card) => {
      const entry = entryMap.get(card.id);
      let payment = card.minPayment;
      if (card.id === target.id && targetExtra > 0) {
        payment += targetExtra;
      }
      const applied = Math.min(payment, card.balance);
      card.balance -= applied;
      entry.finalPayment = applied;
      payments.push({ card, payment: applied, basePayment: card.minPayment, isTarget: card.id === target.id });
    });

    const paidThisMonth = payments.filter(({ card }) => card.balance <= 1e-8);
    if (paidThisMonth.length > 0) {
      paidThisMonth.forEach(({ card, basePayment }) => {
        const entry = entryMap.get(card.id);
        if (!entry.paidOff) {
          entry.paidOff = true;
          entry.months = month;
          entry.endMonth = month;
          payoffSequence += 1;
          entry.order = payoffSequence;
        }
        carryover += basePayment;
      });
    }

    active = active.filter((card) => card.balance > 1e-8);
  }

  const sortedEntries = Array.from(entryMap.values()).sort((a, b) => {
    if (a.order != null && b.order != null) return a.order - b.order;
    if (a.order != null) return -1;
    if (b.order != null) return 1;
    if (a.startBalance !== b.startBalance) return a.startBalance - b.startBalance;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
  return sortedEntries.map((entry) => ({
    ...entry,
    recommendedPayment: entry.minPayment + (entry.extraApplied || 0),
    projectedPayment: entry.minPayment + (entry.extraApplied || 0),
  }));
};

const runSnowballSimulation = (cards, baseExtra, paidRollForward) =>
  runDebtSimulation(cards, baseExtra, paidRollForward, compareSnowball);
const runAvalancheSimulation = (cards, baseExtra, paidRollForward) =>
  runDebtSimulation(cards, baseExtra, paidRollForward, compareAvalanche);

export { MAX_SNOWBALL_MONTHS, runSnowballSimulation, runAvalancheSimulation };
