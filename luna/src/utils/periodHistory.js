import { getPeriodRange } from "./budgetPeriod";

const HISTORY_PREFIX = "periodHistory_";
const HISTORY_INDEX_PREFIX = "periodHistoryIndex_";

const safeKey = (value) => String(value || "").replace(/[:]/g, "_");

const getHistoryKey = (periodKey) => `${HISTORY_PREFIX}${safeKey(periodKey)}`;
const getIndexKey = (mode) => `${HISTORY_INDEX_PREFIX}${mode || "monthly"}`;

const readHistoryIndex = (mode) => {
  try {
    const stored = localStorage.getItem(getIndexKey(mode));
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const writeHistoryIndex = (mode, list) => {
  try {
    localStorage.setItem(getIndexKey(mode), JSON.stringify(list));
  } catch (e) {
    /* ignore */
  }
};

const readHistoryEntry = (periodKey) => {
  try {
    const stored = localStorage.getItem(getHistoryKey(periodKey));
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

const writeHistoryEntry = (periodKey, data) => {
  try {
    localStorage.setItem(getHistoryKey(periodKey), JSON.stringify(data));
  } catch (e) {
    /* ignore */
  }
};

const comparePeriodKeys = (a, b) => {
  const parse = (key) => {
    if (!key) return null;
    const parts = key.split(":");
    if (parts.length !== 2) return null;
    const datePart = parts[1].split("-").slice(0, 3).join("-");
    const date = new Date(datePart);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };
  const da = parse(a);
  const db = parse(b);
  if (!da || !db) return 0;
  return da.getTime() - db.getTime();
};

const upsertHistoryIndex = (mode, periodKey) => {
  const list = readHistoryIndex(mode);
  const next = list.includes(periodKey) ? list : [...list, periodKey];
  next.sort(comparePeriodKeys);
  writeHistoryIndex(mode, next);
  return next;
};

const fillMissingPeriods = (preferences, currentKey) => {
  const { mode } = getPeriodRange(preferences);
  if (mode === "paycheck") return;
  const list = readHistoryIndex(mode);
  if (!list.length) return;
  const lastKey = list[list.length - 1];
  if (comparePeriodKeys(lastKey, currentKey) >= 0) return;

  const parseStart = (key) => {
    const datePart = key.split(":")[1];
    const parts = datePart.split("-");
    const start = new Date(parts[0], Number(parts[1]) - 1, Number(parts[2]) || 1);
    return Number.isNaN(start.getTime()) ? null : start;
  };

  const lastStart = parseStart(lastKey);
  if (!lastStart) return;

  let cursor = new Date(lastStart);
  const maxIterations = 36;
  let iterations = 0;
  while (iterations < maxIterations) {
    iterations += 1;
    const nextRange = getPeriodRange(preferences, [], cursor);
    if (!nextRange?.key) break;
    if (comparePeriodKeys(nextRange.key, currentKey) >= 0) break;
    if (!list.includes(nextRange.key)) {
      writeHistoryEntry(nextRange.key, {
        periodKey: nextRange.key,
        mode,
        income: "unknown",
        expenses: "unknown",
        leftover: "unknown",
        snowballExtra: "unknown",
        tier: "unknown",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      list.push(nextRange.key);
    }
    cursor = nextRange.end;
  }
  list.sort(comparePeriodKeys);
  writeHistoryIndex(mode, list);
};

const upsertPeriodHistory = ({ preferences, periodKey, income, expenses, leftover, snowballExtra, tier }) => {
  if (!periodKey) return;
  const { mode } = getPeriodRange(preferences);
  fillMissingPeriods(preferences, periodKey);
  const existing = readHistoryEntry(periodKey);
  const createdAt = existing?.createdAt || new Date().toISOString();
  const next = {
    periodKey,
    mode,
    income,
    expenses,
    leftover,
    snowballExtra,
    tier,
    createdAt,
    updatedAt: new Date().toISOString(),
  };
  writeHistoryEntry(periodKey, next);
  upsertHistoryIndex(mode, periodKey);
};

const getPeriodGapCount = (preferences, currentKey, previousKey) => {
  const { mode } = getPeriodRange(preferences);
  if (!currentKey || !previousKey) return 0;
  if (mode === "paycheck") return 0;
  const diff = comparePeriodKeys(currentKey, previousKey);
  if (diff <= 0) return 0;
  // treat each index step as a period
  const list = readHistoryIndex(mode);
  const currentIdx = list.indexOf(currentKey);
  const prevIdx = list.indexOf(previousKey);
  if (currentIdx > -1 && prevIdx > -1) {
    return Math.max(currentIdx - prevIdx - 1, 0);
  }
  return 0;
};

export {
  readHistoryIndex,
  readHistoryEntry,
  upsertPeriodHistory,
  getPeriodGapCount,
  comparePeriodKeys,
};
