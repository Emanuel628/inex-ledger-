export const LATEST_VERSIONS = {
  moneyProfile: 2,
  liveBudgetTransactions: 1,
  financialHealthScore: 2,
  debtCashForm: 2,
  payPeriodPlans: 1,
  payPeriodLatestPlanId: 1,
};

const migrations = {
  moneyProfile: {
    1: (data) => {
      const next = {
        ...data,
        incomes: Array.isArray(data?.incomes) ? data.incomes : [],
        expenses: Array.isArray(data?.expenses) ? data.expenses : [],
        savingsBalance: data?.savingsBalance ?? "",
        savingsMonthly: data?.savingsMonthly ?? "",
        name: data?.name ?? "",
      };
      return { ...next, _version: 2 };
    },
  },
  financialHealthScore: {
    1: (data) => {
      const next = {
        ...data,
        pillars: data?.pillars || { buffer: 0, freedom: 0, stability: 0 },
        explanations: data?.explanations || { buffer: "", freedom: "", stability: "" },
        confidence: data?.confidence || { label: "Early Confidence", detail: "", periods: 0 },
        milestones: Array.isArray(data?.milestones) ? data.milestones : [],
      };
      return { ...next, _version: 2 };
    },
  },
  debtCashForm: {
    1: (data) => {
      const next = {
        ...data,
        manualDebts: (data?.manualDebts || []).map((entry) => ({
          ...entry,
          source: entry?.source || "manual",
        })),
      };
      return { ...next, _version: 2 };
    },
  },
};

export const runMigrations = (key, data, version) => {
  let currentData = data;
  let currentVersion = Number(version) || 1;
  const targetVersion = LATEST_VERSIONS[key] || currentVersion;

  while (currentVersion < targetVersion) {
    const migrateFn = migrations[key]?.[currentVersion];
    if (!migrateFn) break;
    const nextData = migrateFn(currentData);
    currentData = nextData ?? currentData;
    const nextVersion = Number(currentData?._version) || currentVersion + 1;
    if (nextVersion <= currentVersion) {
      break;
    }
    currentVersion = nextVersion;
  }

  return { data: currentData, version: currentVersion };
};
