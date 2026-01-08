const pad2 = (value) => String(value).padStart(2, "0");

const DEFAULT_PERIOD = "monthly";

const getPeriodConfig = (preferences = {}) => ({
  mode: preferences.budgetPeriod || DEFAULT_PERIOD,
  startDay: Number(preferences.budgetPeriodStartDay || 1),
  anchorDate: preferences.budgetPeriodAnchor || "",
});

const getStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getMonthKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const addMonths = (date, count) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
};

const addDays = (date, count) => {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
};

const getCustomMonthStart = (now, startDay) => {
  const day = Math.min(Math.max(startDay, 1), 28);
  const current = new Date(now.getFullYear(), now.getMonth(), day);
  if (now >= current) {
    return current;
  }
  return new Date(now.getFullYear(), now.getMonth() - 1, day);
};

const getQuarterStart = (now) => {
  const month = now.getMonth();
  const quarterStart = month - (month % 3);
  return new Date(now.getFullYear(), quarterStart, 1);
};

const getLatestIncomeDate = (transactions = []) => {
  const incomes = (transactions || [])
    .filter((t) => t?.type === "income")
    .map((t) => new Date(t.date || Date.now()))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (!incomes.length) return null;
  incomes.sort((a, b) => b - a);
  return incomes[0];
};

const getPeriodRange = (preferences = {}, transactions = [], now = new Date()) => {
  const { mode, startDay, anchorDate } = getPeriodConfig(preferences);
  const safeNow = now instanceof Date ? now : new Date();

  if (mode === "custom-day") {
    const start = getStartOfDay(getCustomMonthStart(safeNow, startDay));
    const end = addMonths(start, 1);
    return { mode, start, end, key: `${mode}:${getMonthKey(start)}-${pad2(start.getDate())}` };
  }
  if (mode === "quarterly") {
    const start = getStartOfDay(getQuarterStart(safeNow));
    const end = addMonths(start, 3);
    return { mode, start, end, key: `${mode}:${getMonthKey(start)}` };
  }
  if (mode === "weekly" || mode === "biweekly" || mode === "four-week") {
    const days = mode === "weekly" ? 7 : mode === "biweekly" ? 14 : 28;
    const anchor = anchorDate ? new Date(anchorDate) : safeNow;
    const startAnchor = getStartOfDay(anchor);
    const diffDays = Math.floor((getStartOfDay(safeNow) - startAnchor) / (1000 * 60 * 60 * 24));
    const periods = Math.floor(diffDays / days);
    const start = addDays(startAnchor, Math.max(periods, 0) * days);
    const end = addDays(start, days);
    return { mode, start, end, key: `${mode}:${getMonthKey(start)}-${pad2(start.getDate())}` };
  }
  if (mode === "paycheck") {
    const lastIncome = getLatestIncomeDate(transactions);
    const start = getStartOfDay(lastIncome || safeNow);
    const end = addDays(getStartOfDay(safeNow), 1);
    return { mode, start, end, key: `${mode}:${getMonthKey(start)}-${pad2(start.getDate())}` };
  }
  // default monthly
  const start = new Date(safeNow.getFullYear(), safeNow.getMonth(), 1);
  const end = addMonths(start, 1);
  return { mode, start, end, key: `${mode}:${getMonthKey(start)}` };
};

const filterTransactionsByPeriod = (transactions = [], period) => {
  if (!period) return [];
  return (transactions || []).filter((t) => {
    const d = new Date(t?.date || Date.now());
    if (Number.isNaN(d.getTime())) return false;
    return d >= period.start && d < period.end;
  });
};

export {
  DEFAULT_PERIOD,
  getPeriodConfig,
  getPeriodRange,
  filterTransactionsByPeriod,
};
