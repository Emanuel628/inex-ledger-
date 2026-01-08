import { useCallback, useEffect, useMemo, useState } from "react";
import { storageManager } from "../utils/storageManager";
import { buildKey } from "../utils/userStorage";

const PROFILE_KEY = "moneyProfile";
const IDENTITY_KEY = "userIdentity";

const getProfileStorageKey = () => buildKey(PROFILE_KEY);
const getIdentityStorageKey = () => buildKey(IDENTITY_KEY);

const defaultProfile = {
  incomes: [],
  expenses: [],
  savingsBalance: "",
  savingsMonthly: "",
  name: "",
};

const readIdentityFirstName = () => {
  if (typeof window === "undefined") return "";
  try {
    const stored =
      localStorage.getItem(getIdentityStorageKey()) ?? localStorage.getItem(IDENTITY_KEY);
    if (!stored) return "";
    const parsed = JSON.parse(stored);
    return (parsed?.firstName || "").trim();
  } catch (e) {
    return "";
  }
};

const safeParseProfile = () => {
  if (typeof window === "undefined") return defaultProfile;
  try {
    const parsed = storageManager.get(getProfileStorageKey()) ?? storageManager.get(PROFILE_KEY);
    if (!parsed) {
      const identityName = readIdentityFirstName();
      return identityName
        ? { ...defaultProfile, name: identityName }
        : defaultProfile;
    }
    if (!parsed || typeof parsed !== "object") {
      const identityName = readIdentityFirstName();
      return identityName
        ? { ...defaultProfile, name: identityName }
        : defaultProfile;
    }
    const identityName = readIdentityFirstName();
    const next = { ...defaultProfile, ...parsed };
    if (identityName) {
      next.name = identityName;
    }
    return next;
  } catch (e) {
    const identityName = readIdentityFirstName();
    return identityName
      ? { ...defaultProfile, name: identityName }
      : defaultProfile;
  }
};

const amountForEntry = (entry = {}) => Number(entry.monthly ?? entry.amount ?? 0) || 0;
const isPersonalIncome = (item) => (item?.incomeType || "personal") === "personal";
const isPersonalExpense = (item) => (item?.expenseType || "personal") === "personal";

export const useMoneyProfile = () => {
  const [profile, setProfile] = useState(safeParseProfile);

  const refreshProfile = useCallback(() => {
    setProfile(safeParseProfile());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const matchesKey = (eventKey, base) =>
      !eventKey ? false : eventKey === base || eventKey.endsWith(`_${base}`);
    const storageHandler = (event) => {
      if (!event.key) {
        refreshProfile();
        return;
      }
      if (matchesKey(event.key, PROFILE_KEY) || matchesKey(event.key, IDENTITY_KEY)) {
        refreshProfile();
      }
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener("profile-updated", refreshProfile);
    window.addEventListener("identity-updated", refreshProfile);
    window.addEventListener("luna-current-user-changed", refreshProfile);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("profile-updated", refreshProfile);
      window.removeEventListener("identity-updated", refreshProfile);
      window.removeEventListener("luna-current-user-changed", refreshProfile);
    };
  }, [refreshProfile]);

  const personalIncomes = useMemo(
    () => (profile.incomes || []).filter(isPersonalIncome),
    [profile.incomes]
  );

  const personalExpenses = useMemo(
    () => (profile.expenses || []).filter(isPersonalExpense),
    [profile.expenses]
  );

  const baseIncome = useMemo(
    () => personalIncomes.reduce((sum, item) => sum + amountForEntry(item), 0),
    [personalIncomes]
  );

  const baseExpenses = useMemo(
    () => personalExpenses.reduce((sum, item) => sum + amountForEntry(item), 0),
    [personalExpenses]
  );

  const totals = useMemo(() => {
    const income = baseIncome;
    const expenses = baseExpenses;
    const leftover = income - expenses;
    return { income, expenses, leftover };
  }, [baseIncome, baseExpenses]);

  const expenseCategories = useMemo(() => {
    const map = new Map();
    personalExpenses.forEach((exp) => {
      const key = exp.category || exp.name || "Other";
      map.set(key, (map.get(key) || 0) + amountForEntry(exp));
    });
    return Array.from(map.entries()).map(([key, total]) => ({ key, total }));
  }, [personalExpenses]);

  return {
    profile,
    totals,
    baseIncome,
    baseExpenses,
    expenseCategories,
    refreshProfile,
  };
};
