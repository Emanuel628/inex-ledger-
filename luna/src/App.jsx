import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Budget from "./pages/Budget.jsx";
import SplitGPS from "./pages/BudgetSplit.jsx";
import CreditCardPayoff from "./pages/CreditCardPayoff.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import GoalsDashboard from "./pages/GoalsDashboard.jsx";
import ImportAnalyze from "./pages/ImportAnalyze.jsx";
import LiveBudget from "./pages/LiveBudget.jsx";
import OnboardingWelcome from "./pages/onboarding/Welcome.jsx";
import OnboardingPayRhythm from "./pages/onboarding/PayRhythm.jsx";
import OnboardingMonthlyPicture from "./pages/onboarding/MonthlyPicture.jsx";
import OnboardingSnapshot from "./pages/onboarding/Snapshot.jsx";
import ProfileIntake from "./pages/ProfileIntake.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import Savings from "./pages/Savings.jsx";
import Assets from "./pages/Assets.jsx";
import Settings from "./pages/Settings.jsx";
import TotalDebtPayoff from "./pages/TotalDebtPayoff.jsx";
import SnowballExplainer from "./pages/SnowballExplainer.jsx";
import LoanRecommendations from "./pages/LoanRecommendations.jsx";
import FicoScore from "./pages/FicoScore.jsx";
import PaymentOptions from "./pages/PaymentOptions.jsx";
import CreateAccount from "./pages/CreateAccount.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import SnapshotIntro from "./pages/SnapshotIntro.jsx";
import SnapshotResult from "./pages/SnapshotResult.jsx";
import RefineNumbers from "./pages/RefineNumbers.jsx";
import BusinessTools from "./pages/BusinessTools.jsx";
import BudgetPeriodGuide from "./pages/BudgetPeriodGuide.jsx";
import FeaturesGuide from "./pages/FeaturesGuide.jsx";
import ScoreDetails from "./pages/ScoreDetails.jsx";
import Security from "./pages/Security.jsx";
import HealthConsole from "./components/HealthConsole.jsx";
import ReconciliationExplorer from "./components/reconciliation/ReconciliationExplorer.jsx";
import { storageManager } from "./utils/storageManager";
import { buildKey } from "./utils/userStorage";
import { useHealthScoreRunner } from "./hooks/useHealthScoreRunner";
import { usePrivacyShield } from "./hooks/usePrivacyShield";
import LunaChat from "./components/ai/LunaChat.jsx";
import "./App.css";
import { usePreferences } from "./contexts/PreferencesContext";
import Success from "./pages/Success.jsx";
import {
  getCurrentUserId,
  hasCompletedOnboarding,
  CURRENT_USER_EVENT,
  ONBOARDING_STATUS_EVENT,
} from "./utils/userStorage";
import { initializeVaultAutoLock, lockVault } from "./security/vaultLock";
import { buildApiUrl } from "./lib/api.js";

const LOGIN_STATUS_KEY = "lunaLoggedIn";
const HEALTH_CONSOLE_KEY = "healthConsoleEnabled";
const HEALTH_CONSOLE_EVENT = "health-console-toggle";
const LUNA_CHAT_KEY = "hideLunaChat";
const LUNA_CHAT_EVENT = "luna-chat-visibility";
const IDENTITY_KEY = "userIdentity";

const levelThemes = {
  1: { "--fortress-glow": "rgba(148, 163, 184, 0.2)", "--accent-color": "#94a3b8" },
  2: { "--fortress-glow": "rgba(59, 130, 246, 0.2)", "--accent-color": "#3b82f6" },
  3: { "--fortress-glow": "rgba(16, 185, 129, 0.2)", "--accent-color": "#10b981" },
  4: { "--fortress-glow": "rgba(168, 85, 247, 0.2)", "--accent-color": "#a855f7" },
};

const loadIdentity = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(IDENTITY_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

const PAGE_MAP = {
  dashboard: Dashboard,
  livebudget: LiveBudget,
  budget: Budget,
  "split-gps": SplitGPS,
  "credit-payoff": CreditCardPayoff,
  "total-debt": TotalDebtPayoff,
  "snowball-explainer": SnowballExplainer,
  goals: GoalsDashboard,
  savings: Savings,
  assets: Assets,
  import: ImportAnalyze,
  onboardingWelcome: OnboardingWelcome,
  onboardingPayRhythm: OnboardingPayRhythm,
  onboardingMonthlyPicture: OnboardingMonthlyPicture,
  onboardingSnapshot: OnboardingSnapshot,
  "snapshot-intro": SnapshotIntro,
  "snapshot-result": SnapshotResult,
  refine: RefineNumbers,
  settings: Settings,
  profile: ProfileIntake,
  "user-profile": UserProfile,
  loans: LoanRecommendations,
  fico: FicoScore,
  "payment-options": PaymentOptions,
  "business-tools": BusinessTools,
  "budget-period-guide": BudgetPeriodGuide,
  "features-guide": FeaturesGuide,
  "score-details": ScoreDetails,
  security: Security,
  success: Success,
  "create-account": CreateAccount,
  "forgot-password": ForgotPassword,
  login: Login,
};

// DebtSnapshot lives under src/archived/DebtSnapshot and is intentionally un-routed.
const VIEW_BODY_CLASSES = {
  dashboard: "dashboard-page",
  livebudget: "live-budget-page",
  budget: "budget-page",
  "split-gps": "split-gps-page",
  "credit-payoff": "cc-page",
  "total-debt": "total-debt-page",
  "snowball-explainer": "snowball-page",
  goals: "goals-page",
  savings: "savings-page",
  assets: "assets-page",
  import: "import-page",
  onboardingWelcome: "onboarding-welcome-page",
  onboardingPayRhythm: "onboarding-pay-rhythm-page",
  onboardingMonthlyPicture: "onboarding-monthly-picture-page",
  onboardingSnapshot: "onboarding-snapshot-page",
  "snapshot-intro": "snapshot-intro-page",
  "snapshot-result": "snapshot-result-page",
  refine: "refine-page",
  settings: "settings-page",
  profile: "profile-page",
  "user-profile": "profile-page",
  loans: "loan-page",
  fico: "fico-score-page",
  "payment-options": "payment-options-page",
  "business-tools": "business-tools-page",
  "budget-period-guide": "budget-period-guide-page",
  "features-guide": "features-guide-page",
  "score-details": "score-details-page",
  security: "security-page",
  success: "success-page",
  "create-account": "create-account-page",
  "forgot-password": "forgot-password-page",
  login: "login-page",
};

const BODY_PAGE_CLASSES = Object.values(VIEW_BODY_CLASSES).filter(Boolean);
const ONBOARDING_FLOW = [
  "onboardingWelcome",
  "onboardingPayRhythm",
  "onboardingMonthlyPicture",
  "onboardingSnapshot",
];
const ONBOARDING_START_VIEW = ONBOARDING_FLOW[0];
const BELLLESS_VIEWS = new Set([
  "login",
  "create-account",
  "dashboard",
  ...ONBOARDING_FLOW,
  "snapshot-intro",
  "snapshot-result",
]);
const PUBLIC_VIEWS = new Set([
  "login",
  "create-account",
  "security",
  ...ONBOARDING_FLOW,
  "snapshot-intro",
  "snapshot-result",
]);
const ONBOARDING_VIEWS = new Set([...ONBOARDING_FLOW, "snapshot-intro", "snapshot-result"]);

const resolveInitialChatHidden = () => {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(LUNA_CHAT_KEY);
  if (stored === "false") return false;
  return true;
};

const resolveSystemTheme = () => {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const resolveThemeValue = (preference) => {
  if (preference === "dark" || preference === "light") return preference;
  return resolveSystemTheme();
};

export default function App() {
  const { preferences, setThemePreference } = usePreferences();
  const readLoginStatus = useCallback(() => {
    if (typeof window === "undefined") return false;
    return (
      localStorage.getItem(LOGIN_STATUS_KEY) === "true" ||
      sessionStorage.getItem(LOGIN_STATUS_KEY) === "true"
    );
  }, []);
  const initialLoggedIn = readLoginStatus();
  const initialUserId = getCurrentUserId();
  const initialOnboardingCompleted = hasCompletedOnboarding(initialUserId);
  const [view, setView] = useState(() => {
    if (!initialLoggedIn) return "login";
    return initialOnboardingCompleted ? "dashboard" : ONBOARDING_START_VIEW;
  });
  const [theme, setTheme] = useState(() => resolveThemeValue(preferences.theme));
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn);
  const [onboardingCompleted, setOnboardingCompletedState] = useState(initialOnboardingCompleted);
  const [healthConsoleEnabled, setHealthConsoleEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "health") return true;
    return localStorage.getItem(HEALTH_CONSOLE_KEY) === "true";
  });
  const [storageReady, setStorageReady] = useState(false);
  const [chatHidden, setChatHidden] = useState(() => resolveInitialChatHidden());
  const [identity, setIdentity] = useState(() => loadIdentity());
  useHealthScoreRunner();
  const setThemeRemembered = useCallback(
    (updater) => {
      setTheme((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        return next || "light";
      });
    },
    []
  );

  const lastSyncedTheme = useRef(preferences.theme);

  useEffect(() => {
    if (lastSyncedTheme.current === theme) return;
    lastSyncedTheme.current = theme;
    setThemePreference(theme);
  }, [setThemePreference, theme]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      if (preferences.theme === "system") {
        setTheme(media.matches ? "dark" : "light");
      }
    };
    syncTheme();
    if (preferences.theme !== "system") return undefined;
    const handleChange = () => syncTheme();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [preferences.theme]);

  useEffect(() => {
    const handleUserChange = () => {
      setOnboardingCompletedState(hasCompletedOnboarding(getCurrentUserId()));
    };
    window.addEventListener(CURRENT_USER_EVENT, handleUserChange);
    return () => window.removeEventListener(CURRENT_USER_EVENT, handleUserChange);
  }, []);

  useEffect(() => {
    const handleOnboardingStatus = () => {
      setOnboardingCompletedState(hasCompletedOnboarding(getCurrentUserId()));
    };
    window.addEventListener(ONBOARDING_STATUS_EVENT, handleOnboardingStatus);
    return () => window.removeEventListener(ONBOARDING_STATUS_EVENT, handleOnboardingStatus);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!onboardingCompleted && !ONBOARDING_VIEWS.has(view)) {
      setView(ONBOARDING_START_VIEW);
      return;
    }
    if (onboardingCompleted && ONBOARDING_VIEWS.has(view)) {
      setView("dashboard");
    }
  }, [isLoggedIn, onboardingCompleted, view]);

  useEffect(() => {
    if (preferences.theme === "system") {
      setTheme(resolveSystemTheme());
      return;
    }
    setTheme(preferences.theme);
  }, [preferences.theme]);

  useEffect(() => {
    storageManager.init([buildKey("moneyProfile"), buildKey("liveBudgetTransactions")]);
    storageManager.setState("localOnly");
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleVisibilityEvent = (event) => {
      const next = event?.detail?.hidden;
      if (typeof next === "boolean") {
        const stored = localStorage.getItem(LUNA_CHAT_KEY);
        if (next === false && stored === "true") {
          return;
        }
        setChatHidden(next);
      }
    };
    const handleStorage = (event) => {
      if (event.key === LUNA_CHAT_KEY) {
        setChatHidden(event.newValue === "true");
      }
    };
    window.addEventListener(LUNA_CHAT_EVENT, handleVisibilityEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(LUNA_CHAT_EVENT, handleVisibilityEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refreshIdentity = () => setIdentity(loadIdentity());
    const storageHandler = (event) => {
      if (!event.key || event.key === IDENTITY_KEY) {
        refreshIdentity();
      }
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener("identity-updated", refreshIdentity);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("identity-updated", refreshIdentity);
    };
  }, []);

  const persistIdentity = useCallback(
    (nextData) => {
      if (typeof window === "undefined" || !nextData) return;
      const base = loadIdentity() || {};
      const merged = { ...base, ...nextData };
      try {
        localStorage.setItem(IDENTITY_KEY, JSON.stringify(merged));
        window.dispatchEvent(new Event("identity-updated"));
      } catch (error) {
        console.error("Unable to persist identity data", error);
      }
      setIdentity(merged);
    },
    [setIdentity]
  );

  const fetchIdentity = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const response = await fetch(buildApiUrl("/api/user/identity"), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) return;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/json")) {
        console.warn("Identity fetch returned non-JSON payload, skipping refresh.");
        return;
      }
      const payload = await response.json();
      persistIdentity(payload);
    } catch (error) {
      console.error("Failed to refresh identity", error);
    }
  }, [persistIdentity]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const initialHidden = resolveInitialChatHidden();
    try {
      localStorage.setItem(LUNA_CHAT_KEY, initialHidden ? "true" : "false");
      window.dispatchEvent(
        new CustomEvent(LUNA_CHAT_EVENT, { detail: { hidden: initialHidden } })
      );
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const matchesNamespacedKey = (eventKey, baseKey) =>
      eventKey === baseKey || eventKey?.endsWith(`_${baseKey}`);
    const handleCollision = async (event) => {
      const key = event?.detail?.key;
      if (!key) return;
      console.error(`DATA OUT OF SYNC: ${key} was updated in another tab.`);
      storageManager.setState("collision");
      if (matchesNamespacedKey(key, "moneyProfile")) {
        storageManager.get(buildKey("moneyProfile"));
        window.dispatchEvent(new CustomEvent("profile-updated"));
      }
      if (matchesNamespacedKey(key, "liveBudgetTransactions")) {
        storageManager.get(buildKey("liveBudgetTransactions"));
        window.dispatchEvent(new CustomEvent("live-budget-updated"));
      }
      storageManager.setState("synced");
    };
    window.addEventListener("storage-collision", handleCollision);
    return () => window.removeEventListener("storage-collision", handleCollision);
  }, []);

    useEffect(() => {
      const setSynced = () => storageManager.setState("synced");
      window.addEventListener("profile-updated", setSynced);
      window.addEventListener("live-budget-updated", setSynced);
      return () => {
        window.removeEventListener("profile-updated", setSynced);
        window.removeEventListener("live-budget-updated", setSynced);
      };
    }, []);

    useEffect(() => {
      const cleanup = initializeVaultAutoLock();
      return () => cleanup();
    }, []);

    useEffect(() => {
      const handleAuthChange = () => lockVault("auth_change");
      window.addEventListener("auth-updated", handleAuthChange);
      return () => window.removeEventListener("auth-updated", handleAuthChange);
    }, []);

    useEffect(() => {
      if (typeof window === "undefined") return undefined;
      const params = new URLSearchParams(window.location.search);
    const urlEnabled = params.get("debug") === "health";
    if (urlEnabled) {
      try {
        localStorage.setItem(HEALTH_CONSOLE_KEY, "true");
      } catch (e) {
        /* ignore */
      }
      setHealthConsoleEnabled(true);
    }
    const syncHealthConsole = () => {
      const enabled = urlEnabled || localStorage.getItem(HEALTH_CONSOLE_KEY) === "true";
      setHealthConsoleEnabled(enabled);
    };
    const handleStorage = (event) => {
      if (event.key === HEALTH_CONSOLE_KEY) {
        syncHealthConsole();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(HEALTH_CONSOLE_EVENT, syncHealthConsole);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(HEALTH_CONSOLE_EVENT, syncHealthConsole);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    body.classList.toggle("dark-mode", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    body.classList.remove(...BODY_PAGE_CLASSES);
    const pageClass = VIEW_BODY_CLASSES[view];
    if (pageClass) {
      body.classList.add(pageClass);
    }
  }, [view]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncAuth = () => {
      const loggedIn =
        localStorage.getItem(LOGIN_STATUS_KEY) === "true" ||
        sessionStorage.getItem(LOGIN_STATUS_KEY) === "true";
      setIsLoggedIn(loggedIn);
    };
    syncAuth();
    window.addEventListener("storage", syncAuth);
    window.addEventListener("auth-updated", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("auth-updated", syncAuth);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn && !PUBLIC_VIEWS.has(view)) {
      setView("login");
    }
  }, [isLoggedIn, view]);

  const CurrentPage = useMemo(() => {
  return PAGE_MAP[view] || Dashboard;
  }, [view]);

  const handleNavigate = useCallback(
    (target) => {
      if (!PAGE_MAP[target] || target === view) {
        return;
      }
      const isAuthed = isLoggedIn || readLoginStatus();
      if (target !== "login" && target !== "create-account" && !isAuthed) {
        setView("login");
        return;
      }
      if (target === "refine" && !onboardingCompleted) {
        setView(ONBOARDING_START_VIEW);
        return;
      }
      if (isAuthed && !onboardingCompleted && !ONBOARDING_VIEWS.has(target)) {
        setView(ONBOARDING_START_VIEW);
        return;
      }
      setView(target);
    },
    [isLoggedIn, onboardingCompleted, view, readLoginStatus]
  );

  useEffect(() => {
    const listener = (event) => {
      const target = event?.detail?.view;
      if (typeof target === "string") {
        handleNavigate(target);
      }
    };
    window.addEventListener("luna-navigate", listener);
    return () => window.removeEventListener("luna-navigate", listener);
  }, [handleNavigate]);

  const privacyShieldActive = usePrivacyShield(preferences.privacyShieldEnabled ?? false);
  const ecosystemLevel = identity?.ecosystem_level ?? identity?.ecosystemLevel ?? 1;
  const levelStyle = levelThemes[ecosystemLevel] || levelThemes[1];

  if (!storageReady) return null;

  return (
    <div
      className={`app-shell ${privacyShieldActive ? "privacy-shield-active" : ""}`}
      style={levelStyle}
    >
      <div className="app-shell__content">
        <CurrentPage
          onNavigate={handleNavigate}
          theme={theme}
          setTheme={setThemeRemembered}
          healthConsoleEnabled={healthConsoleEnabled}
          setHealthConsoleEnabled={setHealthConsoleEnabled}
        />
        <ReconciliationExplorer />
        <HealthConsole enabled={healthConsoleEnabled} debugEnabled={healthConsoleEnabled} />
        {!chatHidden && <LunaChat />}
      </div>
      {privacyShieldActive && <div className="privacy-shield-overlay" aria-hidden="true" />}
    </div>
  );
}

