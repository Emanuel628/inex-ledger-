import React, { useMemo, useState } from "react";
import "./RefineNumbers.css";
import { guidanceEngine } from "../../../gps/guidanceEngine";
import { buildKey } from "../utils/userStorage";
import { storageManager } from "../utils/storageManager";
import { getStatusState } from "../utils/tierStatus";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import TopRightControls from "../components/TopRightControls.jsx";

const PROFILE_KEY = "moneyProfile";

const parseCurrencyInput = (value) => {
  if (value === null || value === undefined) return "";
  const numeric = String(value).replace(/[^0-9.]/g, "");
  const parts = numeric.split(".");
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join("")}`;
  }
  return numeric;
};

const persistProfile = (profile) => {
  const key = buildKey(PROFILE_KEY);
  storageManager.set(key, profile);
  window.dispatchEvent(new Event("profile-updated"));
};

const RefineNumbers = ({ onNavigate = () => {} }) => {
  const { profile, totals, refreshProfile } = useMoneyProfile();
  const { formatCurrency } = usePreferences();
  const [incomeForm, setIncomeForm] = useState({ name: "", amount: "" });
  const [expenseForm, setExpenseForm] = useState({ name: "", amount: "", category: "" });
  const [status, setStatus] = useState("");

  const totalIncome = useMemo(() => {
    const incomes = profile?.incomes || [];
    return incomes.reduce((sum, entry) => sum + Number(entry.monthly ?? entry.amount ?? 0), 0);
  }, [profile]);

  const totalExpenses = useMemo(() => {
    const expenses = profile?.expenses || [];
    return expenses.reduce((sum, entry) => sum + Number(entry.monthly ?? entry.amount ?? 0), 0);
  }, [profile]);

  const leftover = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);
  const savingsBalance = Number(profile?.savingsBalance) || 0;
  const rawExpenses = Number(totalExpenses) || 0;
  const normalizedExpenses = Math.max(rawExpenses, 1);
  const savingsPercent = Math.round(((savingsBalance / normalizedExpenses) * 100) || 0);
  const bufferPercent = Math.min(100, Math.max(0, savingsPercent));
  const bufferMonths = Math.min(1, Math.max(0, savingsBalance / normalizedExpenses));
  const statusState = useMemo(() => getStatusState(leftover, bufferPercent), [leftover, bufferPercent]);
  const guidance = useMemo(
    () =>
      guidanceEngine({
        tier: statusState.level,
        bufferMonths,
        leftoverTrend: leftover >= 0 ? 1 : -1,
        driftFlag: false,
        improvements: false,
        timeInTierDays: 0,
      }),
    [statusState.level, bufferMonths, leftover]
  );
  const cushionSubline =
    savingsBalance > 0 ? "Room for life to happen" : "No emergency buffer yet";

  const commitProfile = (next) => {
    persistProfile(next);
    refreshProfile();
    setStatus("Numbers updated.");
  };

  const addIncome = () => {
    const amount = Number(incomeForm.amount);
    if (!incomeForm.name.trim() || !Number.isFinite(amount) || amount < 0) {
      setStatus("Enter a name and positive amount for the income source.");
      return;
    }
    const next = {
      ...profile,
      incomes: [
        ...(profile?.incomes || []),
        {
          id: Date.now(),
          name: incomeForm.name.trim(),
          amount,
          category: "Income",
        },
      ],
    };
    commitProfile(next);
    setIncomeForm({ name: "", amount: "" });
  };

  const addExpense = () => {
    const amount = Number(expenseForm.amount);
    if (!expenseForm.name.trim() || !Number.isFinite(amount) || amount < 0) {
      setStatus("Enter a name and positive amount for the expense.");
      return;
    }
    const next = {
      ...profile,
      expenses: [
        ...(profile?.expenses || []),
        {
          id: Date.now(),
          name: expenseForm.name.trim(),
          amount,
          category: expenseForm.category.trim() || "Expense",
        },
      ],
    };
    commitProfile(next);
    setExpenseForm({ name: "", amount: "", category: "" });
  };

  const removeEntry = (type, id) => {
    if (type === "income") {
      const incomes = (profile?.incomes || []).filter((item) => item.id !== id);
      commitProfile({ ...profile, incomes });
      return;
    }
    const expenses = (profile?.expenses || []).filter((item) => item.id !== id);
    commitProfile({ ...profile, expenses });
  };

  const hasData = Boolean((profile?.incomes?.length || 0) + (profile?.expenses?.length || 0));

  return (
    <div className="refine-page">
      <div className="refine-top-controls">
        <TopRightControls activePage="refine" onNavigate={onNavigate} />
      </div>
      <header className="refine-hero">
        <div>
          <p className="refine-eyebrow">Refine your numbers</p>
          <h1>Adjust income, expenses, and leftover anytime.</h1>
          <p className="refine-subtitle">
            This optional board keeps your financial story accurate. Save confidently—the dashboard updates everywhere.
          </p>
        </div>
        <button type="button" className="ghost-btn" onClick={() => onNavigate("dashboard")}>
          Back to dashboard
        </button>
      </header>

      <section className="refine-summary">
        <article>
          <span>Monthly income</span>
          <strong>{formatCurrency(totalIncome)}</strong>
        </article>
        <article>
          <span>Monthly expenses</span>
          <strong>{formatCurrency(totalExpenses)}</strong>
        </article>
        <article>
          <span>Leftover</span>
          <strong>{formatCurrency(leftover)}</strong>
        </article>
      </section>
      <section className="refine-guidance-card">
        <p className="refine-guidance-eyebrow">{guidance.eyebrow}</p>
        <h2 className={`refine-guidance-title refine-guidance-title--${guidance.tone}`}>
          {guidance.title}
        </h2>
        <p className="refine-guidance-body">{guidance.body}</p>
      </section>
      <p className="refine-snapshot-note">
        Every tweak here keeps the dashboard aligned so your cushion story stays honest and calm.
      </p>
      <section className="refine-insight">
        <div>
          <p className="refine-insight-eyebrow">Safety cushion</p>
          <strong>{formatCurrency(savingsBalance)}</strong>
          <p className="refine-insight-subline">{cushionSubline}</p>
          <span className="refine-insight-meta">{bufferPercent}% of one month of expenses</span>
        </div>
        <div
          className="refine-insight-meter"
          aria-label={`Buffer at ${bufferPercent}% of ${formatCurrency(normalizedExpenses)}`}
        >
          <span className="refine-insight-fill" style={{ width: `${bufferPercent}%` }} />
        </div>
        <p className="refine-insight-copy">
          {savingsBalance > 0
            ? "Keep pouring into this cushion so little shocks stay calm."
            : "Start with $25-$100 per period; momentum stacks up when habits stay steady."}
        </p>
      </section>

      <section className="refine-grid">
        <div className="refine-card">
          <div className="card-heading">
            <div>
              <h2>Income sources</h2>
              <p>Add or remove everything that lands here.</p>
            </div>
          </div>
          <div className="refine-form">
            <label>
              Name
              <input
                type="text"
                value={incomeForm.name}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Salary, side hustle, child support..."
              />
            </label>
            <label>
              Monthly amount
              <input
                type="text"
                value={incomeForm.amount}
                onChange={(event) =>
                  setIncomeForm((prev) => ({ ...prev, amount: parseCurrencyInput(event.target.value) }))
                }
                placeholder="0"
              />
            </label>
            <button type="button" className="primary-btn purple-save-btn" onClick={addIncome}>
              Add income
            </button>
          </div>
          <div className="refine-list">
            {hasData && profile?.incomes?.length ? (
              profile.incomes.map((item) => (
                <div key={item.id} className="refine-list-row">
                  <div>
                    <strong>{item.name}</strong>
                    <p>{formatCurrency(item.amount ?? item.monthly ?? 0)}</p>
                  </div>
                  <button className="ghost-btn danger" type="button" onClick={() => removeEntry("income", item.id)}>
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="refine-empty">No income sources yet.</p>
            )}
          </div>
        </div>

        <div className="refine-card">
          <div className="card-heading">
            <div>
              <h2>Expenses</h2>
              <p>Track anything you pay each month.</p>
            </div>
          </div>
          <div className="refine-form">
            <label>
              Name
              <input
                type="text"
                value={expenseForm.name}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Housing, utilities, groceries..."
              />
            </label>
            <label>
              Monthly amount
              <input
                type="text"
                value={expenseForm.amount}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, amount: parseCurrencyInput(event.target.value) }))
                }
                placeholder="0"
              />
            </label>
            <label>
              Category
              <input
                type="text"
                value={expenseForm.category}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Housing, utilities, etc."
              />
            </label>
            <button type="button" className="primary-btn purple-save-btn" onClick={addExpense}>
              Add expense
            </button>
          </div>
          <div className="refine-list">
            {hasData && profile?.expenses?.length ? (
              profile.expenses.map((item) => (
                <div key={item.id} className="refine-list-row">
                  <div>
                    <strong>{item.name}</strong>
                    <p>{formatCurrency(item.amount ?? item.monthly ?? 0)}</p>
                  </div>
                  <button className="ghost-btn danger" type="button" onClick={() => removeEntry("expense", item.id)}>
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="refine-empty">No expense entries yet.</p>
            )}
          </div>
        </div>
      </section>

      {status && <div className="refine-status">{status}</div>}
    </div>
  );
};

export default RefineNumbers;
