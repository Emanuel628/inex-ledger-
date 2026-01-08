const DEBT_KEYWORDS = [
  "mortgage",
  "loan",
  "credit",
  "student",
  "auto",
  "car",
  "home",
  "debt",
  "interest",
  "line of credit",
  "financed",
];

const EXCLUDE_DEBT_KEYWORDS = ["insurance", "utilities", "subscription", "premium"];

const toNumber = (value) => {
  const cleaned = String(value ?? "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeNumber = (value) => Number(value) || 0;

const matchDebtKeyword = (text = "") => {
  const target = text.toLowerCase();
  return DEBT_KEYWORDS.some((keyword) => target.includes(keyword));
};

const shouldExcludeExpense = (label = "") => {
  const text = label.toLowerCase();
  return EXCLUDE_DEBT_KEYWORDS.some((keyword) => text.includes(keyword));
};

const estimateApr = (label) => {
  const text = (label || "").toLowerCase();
  if (text.includes("mortgage") || text.includes("home")) return 4;
  if (text.includes("student")) return 4.5;
  if (text.includes("car") || text.includes("auto")) return 6.5;
  if (text.includes("credit")) return 18;
  return 8;
};

export const buildDerivedDebts = (expenses = []) =>
  (expenses || [])
    .map((expense, index) => {
      const label = `${expense.category || ""} ${expense.name || ""}`.trim();
      if (expense.housingType === "Mortgage") return null;
      if (!matchDebtKeyword(label)) return null;
      if (shouldExcludeExpense(label)) return null;
      const balance = Math.max(Number(expense.balance) || 0, 0);
      if (balance <= 0) return null;
      const minPayment = Math.max(Number(expense.amount) || 0, 0);
      const apr = estimateApr(label);
      return {
        id: expense.id ? `expense-${expense.id}` : `expense-${index}`,
        name: expense.name || expense.category || "Debt",
        balance,
        apr,
        minPayment,
        source: "expense",
      };
    })
    .filter(Boolean);

export const normalizeManualDebts = (stored) => {
  if (!stored) return [];
  if (Array.isArray(stored.manualDebts)) {
    return stored.manualDebts.map((debt) => ({
      id: debt.id || `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: debt.type || "other",
      balance: debt.balance ?? "",
      apr: debt.apr ?? "",
      minPayment: debt.minPayment ?? "",
      termMonths: debt.termMonths ?? "",
      originalAmount: debt.originalAmount ?? "",
      notes: debt.notes ?? "",
    }));
  }
  if (stored.housingDebts || stored.carDebts || stored.personalDebts || stored.studentBalance) {
    const debts = [];
    (stored.housingDebts || []).forEach((debt) => {
      debts.push({
        id: `manual-housing-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        type: "mortgage",
        balance: debt.balance ?? "",
        apr: debt.apr ?? "",
        minPayment: debt.min ?? "",
        termMonths: debt.termMonths ?? "",
        originalAmount: "",
        notes: "",
      });
    });
    (stored.carDebts || []).forEach((debt) => {
      debts.push({
        id: `manual-car-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        type: "auto",
        balance: debt.balance ?? "",
        apr: debt.apr ?? "",
        minPayment: debt.min ?? "",
        termMonths: debt.termMonths ?? "",
        originalAmount: "",
        notes: "",
      });
    });
    (stored.personalDebts || []).forEach((debt) => {
      debts.push({
        id: `manual-personal-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        type: "personal",
        balance: debt.balance ?? "",
        apr: debt.apr ?? "",
        minPayment: debt.min ?? "",
        termMonths: debt.termMonths ?? "",
        originalAmount: "",
        notes: "",
      });
    });
    if (stored.studentBalance) {
      debts.push({
        id: `manual-student-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        type: "student",
        balance: stored.studentBalance ?? "",
        apr: stored.studentApr ?? "",
        minPayment: stored.studentDeferred ? "0" : stored.studentMin ?? "",
        termMonths: stored.studentTermMonths ?? "",
        originalAmount: "",
        notes: "",
      });
    }
    return debts;
  }
  if (Array.isArray(stored)) {
    return stored.map((debt, index) => ({
      id: debt.id || `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: debt.type || "other",
      balance: debt.balance ?? "",
      apr: debt.apr ?? "",
      minPayment: debt.minPayment ?? "",
      termMonths: debt.termMonths ?? "",
      originalAmount: debt.originalAmount ?? "",
      notes: debt.notes ?? "",
    }));
  }
  return [];
};

export const buildManualDebts = (manualDebts = [], options = {}) => {
  const { labelDebtType = (type) => type || "Debt" } = options;
  return (manualDebts || [])
    .map((debt, index) => {
      const balance = Math.max(0, toNumber(debt.balance));
      if (!balance) return null;
      const name = debt.name || labelDebtType(debt.type);
      return {
        id: debt.id || `manual-${index}`,
        name,
        balance,
        apr: Math.max(0, toNumber(debt.apr)),
        minPayment: Math.max(0, toNumber(debt.minPayment)),
        termMonths: toNumber(debt.termMonths) || undefined,
        originalAmount: toNumber(debt.originalAmount) || undefined,
        notes: debt.notes || "",
        source: "manual",
        type: debt.type,
      };
    })
    .filter(Boolean);
};

const creditCardToDebtEntry = (card) => {
  if (!card) return null;
  const balance = Math.max(0, Number(card.balance) || 0);
  const minPayment = Math.max(0, Number(card.minPayment) || 0);
  if (balance <= 0 && !card.paid) return null;
  return {
    id: card.id || `card-${card.name || "unknown"}`,
    name: card.name || "Credit Card",
    balance,
    apr: Math.max(0, Number(card.apr) || 0),
    minPayment,
    source: "credit-card",
  };
};

export const buildCreditCardDebts = (cards = []) =>
  (cards || []).map(creditCardToDebtEntry).filter(Boolean);

export const sumDebtBalances = (entries = []) =>
  (entries || []).reduce((sum, debt) => sum + (Number(debt.balance) || 0), 0);

export const computeTotalAssets = ({ assetProfile = { assets: [] }, profile = {} } = {}) => {
  const assets = assetProfile?.assets || [];
  const assetValue = assets.reduce((sum, item) => sum + safeNumber(item.value), 0);
  const savingsBalance = safeNumber(profile.savingsBalance);
  const retirement401k = safeNumber(profile.retirement401k);
  const rothIra = safeNumber(profile.rothIra);
  const investments = safeNumber(profile.investments);
  return assetValue + savingsBalance + retirement401k + rothIra + investments;
};

export const computeDebtEntries = (
  { creditCards = [], manualDebts = null, expenses = [] } = {},
  options = {}
) => {
  const normalizedManual = normalizeManualDebts(manualDebts);
  const manualEntries = buildManualDebts(normalizedManual, options);
  const derivedEntries = buildDerivedDebts(expenses);
  const creditEntries = buildCreditCardDebts(creditCards);
  return [...creditEntries, ...derivedEntries, ...manualEntries].filter(
    (debt) => Number(debt.balance) > 0
  );
};

export const computeFinancialSnapshot = (params = {}, options = {}) => {
  const assetProfile = params.assetProfile || { assets: [] };
  const profile = params.profile || {};
  const savingsValue = safeNumber(profile.savingsBalance);
  const investmentsValue = safeNumber(profile.investments);
  const retirement401kValue = safeNumber(profile.retirement401k);
  const rothIraValue = safeNumber(profile.rothIra);
  const totalAssets = computeTotalAssets({ assetProfile, profile });
  const debtEntries = computeDebtEntries(params, options);
  const totalDebt = sumDebtBalances(debtEntries);
  const canonicalRows = [];
  if (savingsValue > 0) {
    canonicalRows.push({
      id: "auto-savings",
      name: "Cash & savings",
      type: "Cash & savings",
      value: savingsValue,
      removable: false,
      source: "savings",
    });
  }
  if (investmentsValue > 0) {
    canonicalRows.push({
      id: "auto-investments",
      name: "Investments",
      type: "Investments",
      value: investmentsValue,
      removable: false,
      source: "investments",
    });
  }
  if (retirement401kValue > 0) {
    canonicalRows.push({
      id: "auto-401k",
      name: "401(k)",
      type: "401(k)",
      value: retirement401kValue,
      removable: false,
      source: "retirement401k",
    });
  }
  if (rothIraValue > 0) {
    canonicalRows.push({
      id: "auto-ira",
      name: "IRA",
      type: "IRA",
      value: rothIraValue,
      removable: false,
      source: "rothIra",
    });
  }
  const manualAssetRows = (assetProfile.assets || [])
    .map((item, index) => ({
      id: item.id || `asset-${index}`,
      name: item.name || item.type || "Asset",
      type: item.type || "Asset",
      value: safeNumber(item.value),
      removable: true,
      source: "profile",
    }))
    .filter((row) => row.value > 0);
  const assetRows = [...canonicalRows, ...manualAssetRows];
  return {
    totalAssets,
    totalDebt,
    netWorth: totalAssets - totalDebt,
    debtEntries,
    assetRows,
    savingsValue,
    investmentsValue,
    retirement401kValue,
    rothIraValue,
  };
};
