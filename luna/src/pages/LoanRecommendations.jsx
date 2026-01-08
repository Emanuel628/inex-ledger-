import React, { useEffect, useMemo, useState } from "react";
import "./LoanRecommendations.css";
import TopRightControls from "../components/TopRightControls.jsx";
import { usePreferences } from "../contexts/PreferencesContext";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { computeSplitPlan } from "../utils/splitPlan";
import { CREDIT_CARDS_EVENT, loadCreditCards } from "../utils/creditCardsStorage";
import { readDebtCashForm } from "../utils/debtStorage";

const LOAN_OPTIONS = [
  {
    id: "debt-consolidation",
    title: "Debt Consolidation",
    description:
      "Roll multiple balances into a single lower-rate payment. Works best if you can cover the new payment comfortably.",
    rates: "7.5% - 11.5%",
    term: "36 - 60 months",
    tags: ["debt", "consolidation"],
  },
  {
    id: "personal-installment",
    title: "Personal Installment",
    description:
      "Fixed monthly payment, quick approval, and no collateral required. Great for medium-term projects or refinances.",
    rates: "9.5% - 14.5%",
    term: "24 - 60 months",
    tags: ["fixed", "savings"],
  },
  {
    id: "home-equity",
    title: "Home Equity Line",
    description:
      "Use home equity to refinance balances or fund a remodel. Ideal for homeowners with steady income.",
    rates: "4.5% - 6.0%",
    term: "10 - 30 years",
    tags: ["stable", "low-rate"],
  },
  {
    id: "business-line",
    title: "Small Business Line",
    description:
      "Flexible access to cash for contractors or self-employed users. Draw what you need and only pay interest on the balance.",
    rates: "6.0% - 11.0%",
    term: "12 - 24 months",
    tags: ["business", "flex"],
  },
];

const QUICK_TIPS = [
  "Check your credit mix before applying so the rate reflects your payment history.",
  "Compare APRs, not just the advertised rate, to understand total borrowing costs.",
  "Use prequalification offers to avoid hard inquiries when exploring multiple lenders.",
];

const toNumber = (value) => {
  const cleaned = String(value ?? "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeManualDebts = (stored) => {
  if (!stored || typeof stored !== "object") return [];
  if (Array.isArray(stored.manualDebts)) {
    return stored.manualDebts
      .map((debt, index) => ({
        id: debt.id || `manual-${index}`,
        type: debt.type || "other",
        name: debt.name || "",
        balance: toNumber(debt.balance),
        minPayment: toNumber(debt.minPayment),
      }))
      .filter((debt) => debt.balance > 0);
  }
  if (Array.isArray(stored)) {
    return stored
      .map((debt, index) => ({
        id: debt.id || `manual-${index}`,
        type: debt.type || "other",
        name: debt.name || "",
        balance: toNumber(debt.balance),
        minPayment: toNumber(debt.minPayment),
      }))
      .filter((debt) => debt.balance > 0);
  }
  const debts = [];
  (stored.housingDebts || []).forEach((debt, index) => {
    const balance = toNumber(debt.balance);
    if (!balance) return;
    debts.push({
      id: `manual-housing-${index}`,
      type: "mortgage",
      name: "Mortgage",
      balance,
      minPayment: toNumber(debt.min),
    });
  });
  (stored.carDebts || []).forEach((debt, index) => {
    const balance = toNumber(debt.balance);
    if (!balance) return;
    debts.push({
      id: `manual-car-${index}`,
      type: "auto",
      name: "Auto Loan",
      balance,
      minPayment: toNumber(debt.min),
    });
  });
  (stored.personalDebts || []).forEach((debt, index) => {
    const balance = toNumber(debt.balance);
    if (!balance) return;
    debts.push({
      id: `manual-personal-${index}`,
      type: "personal",
      name: "Personal Loan",
      balance,
      minPayment: toNumber(debt.min),
    });
  });
  const studentBalance = toNumber(stored.studentBalance);
  if (studentBalance) {
    debts.push({
      id: "manual-student",
      type: "student",
      name: "Student Loan",
      balance: studentBalance,
      minPayment: toNumber(stored.studentMin),
    });
  }
  return debts;
};

const loadManualDebts = () => {
  const stored = readDebtCashForm();
  return normalizeManualDebts(stored);
};

const isMortgageDebt = (debt) => {
  if (!debt) return false;
  const type = String(debt.type || "").toLowerCase();
  if (type === "mortgage") return true;
  const name = String(debt.name || "").toLowerCase();
  return name.includes("mortgage") || name.includes("home");
};

const LoanRecommendations = ({ onNavigate = () => {} }) => {
  const { formatCurrency } = usePreferences();
  const { profile, totals } = useMoneyProfile();
  const [creditCards, setCreditCards] = useState(() => loadCreditCards());
  const [manualDebts, setManualDebts] = useState(() => loadManualDebts());

  const savingsBalance = useMemo(() => Number(profile.savingsBalance) || 0, [profile.savingsBalance]);
  const hasBusinessIncome = useMemo(
    () => (profile.incomes || []).some((income) => (income.incomeType || "personal") === "business"),
    [profile.incomes]
  );
  const hasMortgageExpense = useMemo(
    () =>
      (profile.expenses || []).some((expense) => {
        if (expense.housingType === "Mortgage") return true;
        const label = `${expense.category || ""} ${expense.name || ""}`.toLowerCase();
        return label.includes("mortgage");
      }),
    [profile.expenses]
  );

  const consumerDebtTotal = useMemo(() => {
    const cardTotal = (creditCards || []).reduce(
      (sum, card) => sum + Math.max(0, toNumber(card?.balance)),
      0
    );
    const manualTotal = (manualDebts || [])
      .filter((debt) => !isMortgageDebt(debt))
      .reduce((sum, debt) => sum + Math.max(0, toNumber(debt.balance)), 0);
    return cardTotal + manualTotal;
  }, [creditCards, manualDebts]);

  useEffect(() => {
    const refreshCards = () => setCreditCards(loadCreditCards());
    window.addEventListener(CREDIT_CARDS_EVENT, refreshCards);
    window.addEventListener("storage", refreshCards);
    return () => {
      window.removeEventListener(CREDIT_CARDS_EVENT, refreshCards);
      window.removeEventListener("storage", refreshCards);
    };
  }, []);

  useEffect(() => {
    const refreshDebts = () => setManualDebts(loadManualDebts());
    window.addEventListener("debt-cash-updated", refreshDebts);
    window.addEventListener("storage", refreshDebts);
    return () => {
      window.removeEventListener("debt-cash-updated", refreshDebts);
      window.removeEventListener("storage", refreshDebts);
    };
  }, []);

  const splitPlan = useMemo(
    () => computeSplitPlan({ income: totals.income, leftover: totals.leftover }),
    [totals.income, totals.leftover]
  );
  const tierLabel = splitPlan.currentStage.label;
  const isCriticalTier = splitPlan.currentStage.key === "critical";
  const hasPositiveCashFlow = totals.leftover > 0;
  const hasComfortableLeftover = totals.leftover >= Math.max(200, totals.income * 0.05);
  const hasStrongLeftover = totals.leftover >= Math.max(500, totals.income * 0.1);
  const hasSavingsBuffer = savingsBalance >= Math.max(500, totals.expenses * 0.5);
  const hasMortgage = hasMortgageExpense || manualDebts.some(isMortgageDebt);
  const allowRecommendations = hasPositiveCashFlow && !isCriticalTier;

  const recommendedReasons = {
    "debt-consolidation":
      "Debt consolidation can lower the overall rate because you have consumer balances and enough leftover cash to cover a single payment.",
    "home-equity":
      "Stable cash flow plus deep savings make a low-rate home equity line a strong option for refinancing or bigger goals.",
    "personal-installment":
      "Your savings and monthly slack mean you can handle a predictable installment loan for big purchases or refinances.",
    "business-line":
      "Business income and steady leftover can support a short-term credit line for operating needs.",
  };

  const recommendedLoanIds = useMemo(() => {
    const ids = new Set();
    if (!allowRecommendations) return ids;
    if (consumerDebtTotal > 0 && hasComfortableLeftover) {
      ids.add("debt-consolidation");
    }
    if (hasStrongLeftover && hasSavingsBuffer) {
      ids.add("personal-installment");
    }
    if (hasStrongLeftover && hasSavingsBuffer && hasMortgage) {
      ids.add("home-equity");
    }
    if (hasBusinessIncome && hasStrongLeftover) {
      ids.add("business-line");
    }
    return ids;
  }, [
    allowRecommendations,
    consumerDebtTotal,
    hasComfortableLeftover,
    hasStrongLeftover,
    hasSavingsBuffer,
    hasMortgage,
    hasBusinessIncome,
  ]);

  const highlightedLoans = useMemo(
    () =>
      LOAN_OPTIONS.map((loan) => ({
        ...loan,
        recommended: recommendedLoanIds.has(loan.id),
        reason: recommendedReasons[loan.id],
      })),
    [recommendedLoanIds]
  );

  const availableLoanOptions = useMemo(
    () =>
      highlightedLoans.filter((loan) => {
        if (loan.id === "debt-consolidation" && consumerDebtTotal <= 0) return false;
        if (loan.id === "home-equity" && !hasMortgage) return false;
        if (loan.id === "business-line" && !hasBusinessIncome) return false;
        return true;
      }),
    [highlightedLoans, consumerDebtTotal, hasMortgage, hasBusinessIncome]
  );

  const statusBlurb = (() => {
    if (consumerDebtTotal <= 0) {
      if (isCriticalTier) {
        return "You're not carrying consumer debt right now, but cash flow is tight. Focus on stability first.";
      }
      return "You're not carrying consumer debt right now, which keeps your options flexible.";
    }
    if (!hasPositiveCashFlow) {
      return "Consumer debt is on file and leftover is currently tight. Prioritize stability before borrowing more.";
    }
    if (hasComfortableLeftover) {
      return "You have consumer debt on file with some leftover to work with. Consolidation could help if the payment fits.";
    }
    return "You have consumer debt on file, but leftover is thin. Focus on breathing room before taking on new debt.";
  })();

  const statusCards = [
    { label: "Consumer debt tracked", value: formatCurrency(consumerDebtTotal) },
    { label: "Leftover cash each month", value: formatCurrency(totals.leftover) },
    { label: "Savings balance", value: formatCurrency(savingsBalance) },
  ];
  const recommendedLoans = highlightedLoans.filter((loan) => loan.recommended);
  const guardrailMessage = allowRecommendations
    ? "If you are exploring loans for convenience rather than necessity, building savings first often costs less long term."
    : "Right now your cash flow is tight, so borrowing would add pressure. Building a small buffer first usually costs less long term.";


  return (
    <div className="loan-page">
      <header className="loan-header">
        <TopRightControls
          className="top-controls"
          activePage="loans"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="loan-hero">
          <p className="loan-eyebrow">Loan recommendations</p>
          <h1>Find a loan structure that fits your reality</h1>
          <p className="loan-subtitle">
            Luna looks at your income, expenses, leftover cash, and goals to highlight loan options that align
            with where you are today. This guidance is educational and based on common lender patterns; actual terms may vary.
          </p>
        </div>
      </header>

      <main className="loan-body">
        <section className="loan-summary-card">
          <h2>How we suggest loans</h2>
          <p>
            We consider your leftover cash, goals, and credit mix to help you understand whether a line of credit,
            installment loan, or business product may fit best. Update income, expenses, or debt balances anytime to refresh recommendations.
          </p>
          <p className="loan-privacy-note">Your privacy comes first.</p>
          <p className="loan-privacy-note">
            We never sell your data, and we'll never check your credit without your permission.
          </p>
        </section>

        <section className="loan-snapshot">
          <h3>Your snapshot</h3>
          <p className="loan-status-blurb">{statusBlurb}</p>
          <p className="loan-tier-note">Aligned with your current tier: {tierLabel}.</p>
        </section>
        <section className="loan-status-grid">
          {statusCards.map((card) => (
            <article key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </section>
        <p className="loan-guardrail">{guardrailMessage}</p>

        <section className="loan-recommendations">
          <h3>Smart suggestions</h3>
          {recommendedLoans.length > 0 ? (
            <div className="loan-grid">
              {recommendedLoans.map((loan) => (
                <article key={loan.id} className="loan-option-card is-recommended">
                  <header>
                    <h4>{loan.title}</h4>
                    <span>{loan.term} term</span>
                  </header>
                  <p>{loan.description}</p>
                  <div className="loan-details">
                    <span>Example APR</span>
                    <strong>{loan.rates}</strong>
                  </div>
                  {loan.reason && <p className="loan-reason">{loan.reason}</p>}
                </article>
              ))}
            </div>
          ) : (
            <p className="loan-fallback">
              {allowRecommendations
                ? "We did not find a strong recommendation based on your current numbers. Update your income, expenses, or debt balances anytime - we'll refresh your recommendations when those numbers change."
                : "We don’t recommend new loans at this stage. Focus on stabilizing cash flow and building a small buffer first."}
            </p>
          )}
        </section>

        <section className="loan-options">
          <h3>Loan types to consider (when appropriate)</h3>
          {availableLoanOptions.length > 0 ? (
            <div className="loan-grid">
              {availableLoanOptions.map((loan) => (
                <article
                  key={loan.id}
                  className={`loan-option-card ${loan.recommended ? "is-recommended" : ""}`}
                >
                  <header>
                    <h4>{loan.title}</h4>
                    <span>{loan.term} term</span>
                  </header>
                  <p>{loan.description}</p>
                  <div className="loan-details">
                    <span>Example APR</span>
                    <strong>{loan.rates}</strong>
                  </div>
                  {loan.recommended && loan.reason && <p className="loan-reason">{loan.reason}</p>}
                </article>
              ))}
            </div>
          ) : (
            <p className="loan-fallback">Add debt or income details to see loan types that fit your profile.</p>
          )}
        </section>

        <section className="loan-tips">
          <h3>Quick tips</h3>
          <ul>
            {QUICK_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default LoanRecommendations;

