import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PREF_KEY = "lunaPreferences";

export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
];

export const REGION_OPTIONS = [
  { value: "US", label: "United States", currency: "USD" },
  { value: "CA", label: "Canada", currency: "CAD" },
  { value: "EU", label: "Eurozone", currency: "EUR" },
  { value: "GB", label: "United Kingdom", currency: "GBP" },
];

const getCurrencyForRegion = (region) => REGION_OPTIONS.find((opt) => opt.value === region)?.currency;

const ensureCurrencySpacing = (value) =>
  value
    .replace(/^([^\d\s.,]+)(?=\d)/, "$1 ")
    .replace(/(\d)([^\d\s.,]+)$/, "$1 $2");

const DEFAULT_PREFERENCES = {
  language: "en-US",
  currency: "USD",
  region: "US",
  premiumAccess: false,
  businessFeatures: false,
  budgetPeriod: "monthly",
  budgetPeriodStartDay: 1,
  budgetPeriodAnchor: "",
  privacyShieldEnabled: false,
  hardwareKeyEnabled: false,
  theme: "light",
  guidanceLevel: "normal",
  notificationLevel: "normal",
  tonePreference: "supportive",
};

const PreferencesContext = createContext({
  preferences: DEFAULT_PREFERENCES,
  setCurrency: () => {},
  setRegion: () => {},
  setPremiumAccess: () => {},
  setBusinessFeatures: () => {},
  setThemePreference: () => {},
  formatCurrency: () => "",
  formatNumber: () => "",
  setGuidanceLevel: () => {},
  setNotificationLevel: () => {},
  setTonePreference: () => {},
});

export const PreferencesProvider = ({ children }) => {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const initialLoad = useRef(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREF_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
    } catch {
      /* ignore */
    }
  }, [preferences]);

  const getCurrencyFormatter = useCallback(
    (overrides = {}) =>
      new Intl.NumberFormat(preferences.language, {
        style: "currency",
        currency: preferences.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...overrides,
      }),
    [preferences.language, preferences.currency]
  );

  const getNumberFormatter = useCallback(
    (overrides = {}) =>
      new Intl.NumberFormat(preferences.language, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        ...overrides,
      }),
    [preferences.language]
  );

  const formatCurrency = useCallback(
    (value, overrides = {}) => {
      const formatter = getCurrencyFormatter(overrides);
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return ensureCurrencySpacing(formatter.format(0));
      return ensureCurrencySpacing(formatter.format(numeric));
    },
    [getCurrencyFormatter]
  );

  const formatNumber = useCallback(
    (value, overrides = {}) => {
      const formatter = getNumberFormatter(overrides);
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return formatter.format(0);
      return formatter.format(numeric);
    },
    [getNumberFormatter]
  );

  const value = useMemo(
    () => ({
      preferences,
      themePreference: preferences.theme,
      setCurrency: (currency) => setPreferences((prev) => ({ ...prev, currency })),
      setRegion: (region) =>
        setPreferences((prev) => {
          const defaultCurrency = getCurrencyForRegion(region);
          return {
            ...prev,
            region,
            currency: defaultCurrency || prev.currency,
          };
        }),
      setPremiumAccess: (access) =>
        setPreferences((prev) => ({
          ...prev,
          premiumAccess: !!access,
          ...(access ? {} : { businessFeatures: false }),
        })),
      setBusinessFeatures: (enabled) =>
        setPreferences((prev) => ({ ...prev, businessFeatures: !!enabled })),
      setPrivacyShieldEnabled: (enabled) =>
        setPreferences((prev) => ({ ...prev, privacyShieldEnabled: !!enabled })),
      setHardwareKeyEnabled: (enabled) =>
        setPreferences((prev) => ({ ...prev, hardwareKeyEnabled: !!enabled })),
      setThemePreference: (next) =>
        setPreferences((prev) => ({ ...prev, theme: next || "system" })),
      setBudgetPeriod: (budgetPeriod) =>
        setPreferences((prev) => ({ ...prev, budgetPeriod })),
      setBudgetPeriodStartDay: (budgetPeriodStartDay) =>
        setPreferences((prev) => ({ ...prev, budgetPeriodStartDay })),
      setBudgetPeriodAnchor: (budgetPeriodAnchor) =>
        setPreferences((prev) => ({ ...prev, budgetPeriodAnchor })),
      setGuidanceLevel: (level) =>
        setPreferences((prev) => ({ ...prev, guidanceLevel: level || "normal" })),
      setNotificationLevel: (level) =>
        setPreferences((prev) => ({ ...prev, notificationLevel: level || "normal" })),
      setTonePreference: (tone) =>
        setPreferences((prev) => ({ ...prev, tonePreference: tone || "supportive" })),
      formatCurrency,
      formatNumber,
    }),
    [preferences, formatCurrency, formatNumber]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export const usePreferences = () => useContext(PreferencesContext);
