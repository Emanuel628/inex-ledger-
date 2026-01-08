import React, { useEffect, useMemo, useState } from "react";
import "../Onboarding.css";
import { readNamespacedItem, writeNamespacedItem } from "../../utils/userStorage";
import { usePreferences } from "../../contexts/PreferencesContext";

const parseNumericInput = (value) => {
  if (value === null || value === undefined) return "";
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (cleaned === "") return "";
  return cleaned;
};

const MonthlyPicture = ({ onNavigate = () => {} }) => {
  const { formatCurrency } = usePreferences();
  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState("");
  const [payPeriod, setPayPeriod] = useState({ frequency: "monthly", anchorDate: "" });

  useEffect(() => {
    try {
      const storedPayPeriod = readNamespacedItem("payPeriod");
      if (storedPayPeriod) {
        const parsed = JSON.parse(storedPayPeriod);
        setPayPeriod({
          frequency: parsed?.frequency || "monthly",
          anchorDate: parsed?.anchorDate || "",
        });
      }
      const storedProfile = readNamespacedItem("moneyProfile");
      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile);
        if (parsedProfile) {
          const existingIncome = (parsedProfile.incomes || [])[0];
          const existingExpense = (parsedProfile.expenses || [])[0];
          if (existingIncome?.monthly) {
            setIncome(String(existingIncome.monthly));
          }
          if (existingExpense?.monthly) {
            setExpenses(String(existingExpense.monthly));
          }
        }
      }
    } catch (error) {
      // ignore parsing issues
    }
  }, []);

  const parsedIncome = Number(income) || 0;
  const parsedExpenses = Number(expenses) || 0;
  const leftover = parsedIncome - parsedExpenses;
  const canContinue = parsedIncome > 0;

  const handleContinue = () => {
    const profile = {
      name: "",
      incomes:
        parsedIncome > 0
          ? [
              {
                id: `income-${Date.now()}`,
                name: "Monthly income",
                category: "Income",
                monthly: parsedIncome,
                incomeType: "personal",
              },
            ]
          : [],
      expenses:
        parsedExpenses > 0
          ? [
              {
                id: `expense-${Date.now()}`,
                name: "Monthly expenses",
                category: "Expense",
                monthly: parsedExpenses,
                expenseType: "personal",
              },
            ]
          : [],
      payPeriod: payPeriod.frequency || "monthly",
      payPeriodAnchor: payPeriod.anchorDate || "",
      savingsBalance: "",
      savingsMonthly: "",
    };
    writeNamespacedItem("moneyProfile", JSON.stringify(profile));
    onNavigate("onboardingSnapshot");
  };

  return (
    <div className="onboarding-page">
      <header className="onboarding-hero">
        <p className="onboarding-eyebrow">Monthly picture</p>
        <h1>Give us your baseline numbers</h1>
        <p className="onboarding-subtitle">
          Close enough is fine—this is just a gentle estimate to start the plan. You can readjust
          anything later.
        </p>
      </header>
      <main className="onboarding-body">
        <section className="onboarding-card">
          <label htmlFor="income-input">Monthly income (after tax)</label>
          <input
            id="income-input"
            type="text"
            value={income}
            onChange={(event) => setIncome(parseNumericInput(event.target.value))}
            placeholder="3,500"
          />

          <label htmlFor="expenses-input">Monthly expenses (bills + basic spending)</label>
          <input
            id="expenses-input"
            type="text"
            value={expenses}
            onChange={(event) => setExpenses(parseNumericInput(event.target.value))}
            placeholder="2,600"
          />

          <p className="onboarding-summary">
            Estimated leftover: <strong>{formatCurrency(leftover)}</strong>
          </p>
          <p className="onboarding-note">Forgot a payment? Add it later in Refine your numbers.</p>
          <button
            type="button"
            className="primary-btn purple-save-btn onboarding-cta"
            onClick={handleContinue}
            disabled={!canContinue}
          >
            See my snapshot
          </button>
        </section>
      </main>
    </div>
  );
};

export default MonthlyPicture;
