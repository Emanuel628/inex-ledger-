import React, { useEffect, useMemo, useState } from "react";
import "./FeaturesGuide.css";
import TopRightControls from "../components/TopRightControls.jsx";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import { computeSplitPlan } from "../utils/splitPlan";
import { readDebtPlanType } from "../utils/debtStorage";

const FEATURE_SECTIONS = [
  {
    title: "Daily Money",
    items: [
      {
        title: "Live Budget",
        description: "Your financial dashboard. Track spending and watch your leftover grow in real time.",
        route: "livebudget",
      },
      {
        title: "Budget",
        description: "Review your baseline budget plan and the big-picture numbers that guide it.",
        route: "budget",
      },
      {
        title: "Money Map",
        description: "The 3-way split. See exactly how much to spend, save, and put toward your future.",
        route: "split-gps",
      },
    ],
  },
  {
    title: "Debt Strategy",
    items: [
      {
        title: "Loans & Payments",
        description: "Track all debts in one place and see your payoff order and timeline.",
        route: "total-debt",
      },
      {
        title: "Payoff Strategy",
        description: "Understand how the payoff plan works and what to pay each month.",
        route: "snowball-explainer",
      },
      {
        title: "Credit Card Payoff",
        description: "Dive deeper into credit card balances and payoff guidance.",
        route: "credit-payoff",
      },
    ],
  },
  {
    title: "Goals & Savings",
    items: [
      {
        title: "Goals Dashboard",
        description: "Track savings and progress toward future goals.",
        route: "goals",
      },
      {
        title: "Savings",
        description: "Plan savings contributions and milestones.",
        route: "savings",
      },
    ],
  },
  {
    title: "Assets & Net Worth",
    items: [
      {
        title: "Assets",
        description: "Add assets and liabilities to build a clearer net worth view.",
        route: "assets",
      },
    ],
  },
  {
    title: "Onboarding & Profiles",
    items: [
      {
        title: "Income & Expenses",
        description: "Update the baseline income and expense details your plans are built on.",
        route: "onboarding",
      },
      {
        title: "Profile Intake",
        description: "Capture personal context that helps recommendations stay accurate.",
        route: "profile",
      },
      {
        title: "User Profile",
        description: "Manage personal details, email, and password.",
        route: "user-profile",
      },
    ],
  },
  {
    title: "Reports & Recommendations",
    items: [
      {
        title: "Import & Analyze",
        description: "Upload statements and analyze transactions.",
        route: "import",
      },
      {
        title: "Loan Recommendations",
        description: "Rate Optimizer. Discover if you can save money by consolidating or refinancing.",
        route: "loans",
      },
      {
        title: "FICO Score",
        description: "Review your credit score insights.",
        route: "fico",
      },
    ],
  },
  {
    title: "Business Tools",
    items: [
      {
        title: "Business Tools",
        description: "Entrepreneur Mode. Separate your personal and business cash flow effortlessly.",
        route: "business-tools",
      },
    ],
  },
  {
    title: "Account & Billing",
    items: [
      {
        title: "Subscription Controls",
        description: "Manage billing and subscription settings.",
        route: "payment-options",
      },
    ],
  },
];

const toNumber = (value) => {
  const cleaned = String(value ?? "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const loadGoals = () => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(GOALS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

const FeaturesGuide = ({ onNavigate = () => {}, theme = "light" }) => {
  const { profile, totals } = useMoneyProfile();
  const { formatCurrency, preferences } = usePreferences();
  const [goals, setGoals] = useState(() => loadGoals());
  const [planType, setPlanType] = useState(() => readDebtPlanType());

  useEffect(() => {
    const refreshGoals = () => setGoals(loadGoals());
    const refreshPlanType = () => setPlanType(readDebtPlanType());
    window.addEventListener("storage", refreshGoals);
    window.addEventListener("storage", refreshPlanType);
    window.addEventListener("profile-updated", refreshGoals);
    return () => {
      window.removeEventListener("storage", refreshGoals);
      window.removeEventListener("storage", refreshPlanType);
      window.removeEventListener("profile-updated", refreshGoals);
    };
  }, []);

  const tierStage = useMemo(
    () => computeSplitPlan({ income: totals.income, leftover: totals.leftover }).currentStage,
    [totals.income, totals.leftover]
  );
  const isThriving = tierStage.key === "traditional";
  const canChoosePlanType = preferences.premiumAccess && isThriving;
  const effectivePlanType = canChoosePlanType ? planType : "snowball";

  const liveBudgetStat = useMemo(() => {
    const leftover = Number(totals.leftover) || 0;
    if (!Number.isFinite(leftover)) return "Add income to unlock";
    const formatted = formatCurrency(Math.abs(leftover));
    return leftover >= 0 ? `${formatted} remaining` : `${formatted} over`;
  }, [formatCurrency, totals.leftover]);

  const goalsStat = useMemo(() => {
    const totalTargets = (goals || []).reduce((sum, goal) => sum + (Number(goal.amount) || 0), 0);
    if (!totalTargets) return "Add a goal to see progress";
    const savingsBalance = toNumber(profile?.savingsBalance);
    const percent = Math.round(Math.min(savingsBalance / totalTargets, 1) * 100);
    return `${percent}% to targets`;
  }, [goals, profile?.savingsBalance]);

  const featureStats = useMemo(
    () => ({
      livebudget: liveBudgetStat,
      goals: goalsStat,
    }),
    [liveBudgetStat, goalsStat]
  );

  return (
    <div className={`features-guide-page ${theme === "dark" ? "is-dark" : ""}`}>
      <header className="features-guide-header">
        <TopRightControls
          className="top-controls"
          activePage="settings"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="features-guide-hero">
          <div className="eyebrow">Features</div>
          <h1>What each page does</h1>
          <p>
            Use this guide as a quick tour of the tools inside Luna. Pick a page to jump straight in.
          </p>
        </div>
      </header>

      <main className="features-guide-main">
        {FEATURE_SECTIONS.map((section) => (
          <section key={section.title} className="features-guide-card">
            <h2>{section.title}</h2>
            <div className="features-grid">
              {section.items.map((item) => (
                <article key={item.title} className="feature-card">
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {featureStats[item.route] && (
                      <div className="feature-stat">{featureStats[item.route]}</div>
                    )}
                  </div>
                  <button type="button" className="secondary-btn" onClick={() => onNavigate(item.route)}>
                    Open
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
        <div className="features-guide-footer">
          <button type="button" className="secondary-btn" onClick={() => onNavigate("settings")}>
            Back to settings
          </button>
        </div>
      </main>
    </div>
  );
};

export default FeaturesGuide;
