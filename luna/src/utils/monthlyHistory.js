const HISTORY_PREFIX = "monthlyHistory_";
const HISTORY_INDEX_KEY = "monthlyHistoryIndex";

const pad2 = (value) => String(value).padStart(2, "0");

const getMonthKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return getMonthKey(new Date());
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

const parseMonthKey = (key) => {
  if (!key) return null;
  const parts = String(key).split("-");
  if (parts.length !== 2) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return new Date(year, month - 1, 1);
};

const compareMonthKeys = (a, b) => {
  const da = parseMonthKey(a);
  const db = parseMonthKey(b);
  if (!da || !db) return 0;
  return da.getFullYear() * 12 + da.getMonth() - (db.getFullYear() * 12 + db.getMonth());
};

const getMonthGapCount = (currentKey, previousKey) => {
  if (!currentKey || !previousKey) return 0;
  const diff = compareMonthKeys(currentKey, previousKey);
  return diff > 0 ? diff - 1 : 0;
};

const getHistoryKey = (monthKey) => `${HISTORY_PREFIX}${monthKey}`;

const readHistoryIndex = () => {
  try {
    const stored = localStorage.getItem(HISTORY_INDEX_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const writeHistoryIndex = (list) => {
  try {
    localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(list));
  } catch (e) {
    /* ignore */
  }
};

const upsertHistoryIndex = (monthKey) => {
  const list = readHistoryIndex();
  const next = list.includes(monthKey) ? list : [...list, monthKey];
  next.sort(compareMonthKeys);
  writeHistoryIndex(next);
  return next;
};

const readHistoryEntry = (monthKey) => {
  try {
    const stored = localStorage.getItem(getHistoryKey(monthKey));
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

const writeHistoryEntry = (monthKey, data) => {
  try {
    localStorage.setItem(getHistoryKey(monthKey), JSON.stringify(data));
  } catch (e) {
    /* ignore */
  }
};

const fillMissingMonths = (currentKey) => {
  const list = readHistoryIndex();
  if (!list.length) return;
  const lastKey = list[list.length - 1];
  if (compareMonthKeys(lastKey, currentKey) >= 0) return;
  const lastDate = parseMonthKey(lastKey);
  const currentDate = parseMonthKey(currentKey);
  if (!lastDate || !currentDate) return;
  const cursor = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
  while (cursor < currentDate) {
    const gapKey = getMonthKey(cursor);
    if (!list.includes(gapKey)) {
      writeHistoryEntry(gapKey, {
        month: gapKey,
        income: "unknown",
        expenses: "unknown",
        leftover: "unknown",
        snowballExtra: "unknown",
        tier: "unknown",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      list.push(gapKey);
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  list.sort(compareMonthKeys);
  writeHistoryIndex(list);
};

const upsertMonthlyHistory = ({ monthKey, income, expenses, leftover, snowballExtra, tier }) => {
  if (!monthKey) return;
  fillMissingMonths(monthKey);
  const existing = readHistoryEntry(monthKey);
  const createdAt = existing?.createdAt || new Date().toISOString();
  const next = {
    month: monthKey,
    income,
    expenses,
    leftover,
    snowballExtra,
    tier,
    createdAt,
    updatedAt: new Date().toISOString(),
  };
  writeHistoryEntry(monthKey, next);
  upsertHistoryIndex(monthKey);
};

const filterTransactionsByMonth = (transactions = [], monthKey = getMonthKey()) =>
  (transactions || []).filter((txn) => {
    const d = new Date(txn?.date || Date.now());
    if (Number.isNaN(d.getTime())) return false;
    return getMonthKey(d) === monthKey;
  });

export {
  getMonthKey,
  filterTransactionsByMonth,
  readHistoryIndex,
  readHistoryEntry,
  upsertMonthlyHistory,
  compareMonthKeys,
  getMonthGapCount,
};
