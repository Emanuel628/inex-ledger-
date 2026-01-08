import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./TotalDebtPayoff.css";
import { usePreferences } from "../contexts/PreferencesContext";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import TopRightControls from "../components/TopRightControls.jsx";
import { runAvalancheSimulation, runSnowballSimulation } from "../utils/snowball";
import { getActiveDebtPlanType, getDebtPlanEligibility } from "../utils/debtPlanType";
import { computeSplitPlan } from "../utils/splitPlan";
import { CREDIT_CARDS_EVENT, loadCreditCards, saveCreditCards } from "../utils/creditCardsStorage";
import {
  buildCreditCardDebts,
  buildDerivedDebts,
  buildManualDebts,
  normalizeManualDebts,
} from "../utils/financialTotals";

const MAX_DEBT_INPUTS = 3;

const formatNumberInput = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/,/g, "");
  if (str === "") return "";
  const [intPart, decPart] = str.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
};

const initialDebtCashForm = {
  housingDebts: [{ min: "", balance: "", apr: "", termMonths: "" }],
  carDebts: [{ balance: "", min: "", apr: "", termMonths: "" }],
  personalDebts: [{ balance: "", min: "", apr: "", termMonths: "" }],
  studentBalance: "",
  studentMin: "",
  studentApr: "",
  studentTermMonths: "",
  studentDeferred: false,
};

const DebtCashForm = ({
  form,
  onChange,
  onFormattedChange,
  onDebtChange,
  onAddDebt,
  onRemoveDebt,
}) => {
  const debtCountReached = {
    housing: form.housingDebts.length >= MAX_DEBT_INPUTS,
    car: form.carDebts.length >= MAX_DEBT_INPUTS,
    personal: form.personalDebts.length >= MAX_DEBT_INPUTS,
  };

  return (
    <section className="td-debt-cash-section">
      <div className="input-group-title">Debt &amp; Cash</div>

      <details className="debt-section" open>
        <summary>{`\u{1F3E0} Housing Loans (Mortgages)`}</summary>

                <div id="housingContainer">
                  {form.housingDebts.map((debt, idx) => (
                    <div key={`housing-${idx}`} className="debt-input-group" data-type="housing">
                      <label htmlFor={`housingMin${idx}`}>Full Monthly Payment (Mortgage)</label>
                      <input
                        id={`housingMin${idx}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 1800"
                  value={formatNumberInput(debt.min)}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={onDebtChange("housing", idx, "min")}
                />
                      <div className="td-form-hint">
                        Use principal + interest only. Escrow (taxes/insurance) does not reduce the balance and can
                        make payoff timelines look faster than they really are.
                      </div>

                      <div className="housing-owner-fields">
                        <label htmlFor={`housingBalance${idx}`}>Remaining Mortgage Balance</label>
                        <input
                          id={`housingBalance${idx}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g. 250000"
                          value={formatNumberInput(debt.balance)}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={onDebtChange("housing", idx, "balance")}
                        />
                      </div>
              <label htmlFor={`housingApr${idx}`}>APR (%)</label>
              <input
                id={`housingApr${idx}`}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 4.25"
                value={debt.apr}
                onChange={onDebtChange("housing", idx, "apr")}
              />
              <label htmlFor={`housingTerm${idx}`}>Remaining term (months)</label>
              <input
                id={`housingTerm${idx}`}
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 360"
                value={debt.termMonths}
                onChange={onDebtChange("housing", idx, "termMonths")}
              />
            </div>
          ))}
        </div>

        <div className="debt-controls">
          <button type="button" className="remove-btn" onClick={(e) => { e.preventDefault(); onRemoveDebt("housing"); }}>
            -
          </button>
          <button type="button" disabled={debtCountReached.housing} onClick={(e) => { e.preventDefault(); onAddDebt("housing"); }}>
            +
          </button>
        </div>
      </details>

      <details className="debt-section">
        <summary>{`\u{1F697} Car Loans`}</summary>
        <div id="carContainer">
          {form.carDebts.map((debt, idx) => (
            <div key={`car-${idx}`} className="debt-input-group" data-type="car">
              <label htmlFor={`carBalance${idx}`}>Car Loan Balance</label>
              <input
                id={`carBalance${idx}`}
                type="text"
                inputMode="decimal"
                placeholder="e.g. 18000"
                value={formatNumberInput(debt.balance)}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={onDebtChange("car", idx, "balance")}
              />

              <label htmlFor={`carMin${idx}`}>Required monthly payment</label>
              <input
                id={`carMin${idx}`}
                type="text"
                inputMode="decimal"
                placeholder="e.g. 400"
                value={formatNumberInput(debt.min)}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={onDebtChange("car", idx, "min")}
              />
              <label htmlFor={`carApr${idx}`}>APR (%)</label>
              <input
                id={`carApr${idx}`}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 6.50"
                value={debt.apr}
                onChange={onDebtChange("car", idx, "apr")}
              />
              <label htmlFor={`carTerm${idx}`}>Remaining term (months)</label>
              <input
                id={`carTerm${idx}`}
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 60"
                value={debt.termMonths}
                onChange={onDebtChange("car", idx, "termMonths")}
              />
            </div>
          ))}
        </div>

        <div className="debt-controls">
          <button type="button" className="remove-btn" onClick={(e) => { e.preventDefault(); onRemoveDebt("car"); }}>
            -
          </button>
          <button type="button" disabled={debtCountReached.car} onClick={(e) => { e.preventDefault(); onAddDebt("car"); }}>
            +
          </button>
        </div>
      </details>

      <details className="debt-section">
        <summary>{`\u{1F4C4} Personal Loans`}</summary>
        <div id="personalContainer">
          {form.personalDebts.map((debt, idx) => (
            <div key={`personal-${idx}`} className="debt-input-group" data-type="personal">
              <label htmlFor={`personalBalance${idx}`}>Personal Loan Balance</label>
              <input
                id={`personalBalance${idx}`}
                type="text"
                inputMode="decimal"
                placeholder="e.g. 5000"
                value={formatNumberInput(debt.balance)}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={onDebtChange("personal", idx, "balance")}
              />

              <label htmlFor={`personalMin${idx}`}>Required monthly payment</label>
              <input
                id={`personalMin${idx}`}
                type="text"
                inputMode="decimal"
                placeholder="e.g. 180"
                value={formatNumberInput(debt.min)}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={onDebtChange("personal", idx, "min")}
              />
              <label htmlFor={`personalApr${idx}`}>APR (%)</label>
              <input
                id={`personalApr${idx}`}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 12.00"
                value={debt.apr}
                onChange={onDebtChange("personal", idx, "apr")}
              />
              <label htmlFor={`personalTerm${idx}`}>Remaining term (months)</label>
              <input
                id={`personalTerm${idx}`}
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 36"
                value={debt.termMonths}
                onChange={onDebtChange("personal", idx, "termMonths")}
              />
            </div>
          ))}
        </div>

        <div className="debt-controls">
          <button type="button" className="remove-btn" onClick={(e) => { e.preventDefault(); onRemoveDebt("personal"); }}>
            -
          </button>
          <button type="button" disabled={debtCountReached.personal} onClick={(e) => { e.preventDefault(); onAddDebt("personal"); }}>
            +
          </button>
        </div>
      </details>

      <details className="debt-section">
        <summary>{`\u{1F393} Student loans (optional, if you have any)`}</summary>
        <div className="debt-input-group">
          <label htmlFor="studentBalance">Student loan balance</label>
          <input
            id="studentBalance"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 30000"
            value={formatNumberInput(form.studentBalance)}
            onWheel={(e) => e.currentTarget.blur()}
            onChange={onFormattedChange("studentBalance")}
          />

          <label htmlFor="studentMin">Student loan required monthly payment</label>
          <input
            id="studentMin"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 250"
            value={formatNumberInput(form.studentMin)}
            onWheel={(e) => e.currentTarget.blur()}
            onChange={onFormattedChange("studentMin")}
          />
          <label htmlFor="studentApr">Student loan APR (%)</label>
          <input
            id="studentApr"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 5.75"
            value={form.studentApr}
            onChange={onChange("studentApr")}
          />
          <label htmlFor="studentTerm">Remaining term (months)</label>
          <input
            id="studentTerm"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 120"
            value={form.studentTermMonths}
            onChange={onChange("studentTermMonths")}
          />

          <div className="checkbox-group">
            <input
              type="checkbox"
              id="studentDeferred"
              checked={form.studentDeferred}
              onChange={onChange("studentDeferred")}
            />
            <label htmlFor="studentDeferred" style={{ display: "inline-block", margin: 0 }}>
              Loan is currently deferred or on an IDR plan.
            </label>
          </div>
        </div>
      </details>

    </section>
  );
};

const DEBT_TYPES = [
  { key: "mortgage", label: "Mortgage" },
  { key: "auto", label: "Auto Loan" },
  { key: "personal", label: "Personal Loan" },
  { key: "student", label: "Student Loan" },
  { key: "other", label: "Other" },
];

const createDebtId = () => `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const DebtPanel = ({
  isOpen,
  mode,
  draft,
  showAdvanced,
  error,
  showSaved,
  onClose,
  onSave,
  onChange,
  onToggleAdvanced,
  onSelectType,
  onToggleDeferred,
}) => {
  if (!isOpen) return null;
  return (
    <div className="td-debt-panel-backdrop" role="dialog" aria-modal="true">
      <div className="td-debt-panel">
        <header className="td-debt-panel-header">
          <div className="td-debt-panel-header-text">
            <h3>{mode === "edit" ? "Edit debt" : "Add debt"}</h3>
            <p>Capture the essentials now. You can add details anytime.</p>
          </div>
          <button type="button" className="td-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="td-debt-panel-body">

          <section className="td-debt-panel-section">
            <div className="td-panel-step">Step 1 - Choose type</div>
            <div className="td-type-options">
              {DEBT_TYPES.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  className={`td-type-btn ${draft.type === type.key ? "is-active" : ""}`}
                  onClick={() => onSelectType(type.key)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </section>

          <section className="td-debt-panel-section">
            <div className="td-panel-step">Step 2 - Required fields</div>
            <div className="td-field-grid">
              <label>
                Balance
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 12,500"
                  value={formatNumberInput(draft.balance)}
                  onChange={onChange("balance")}
                />
              </label>
              <label>
                APR
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 7.5"
                  value={draft.apr}
                  onChange={onChange("apr")}
                />
              </label>
              <label>
                Minimum payment
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 220"
                  value={formatNumberInput(draft.minPayment)}
                  onChange={onChange("minPayment")}
                  disabled={draft.studentDeferred}
                />
              </label>
              <div className="td-form-hint">
                {draft.type === "mortgage"
                  ? "Use the full required mortgage payment (PITI), not just principal and interest."
                  : draft.type === "student" && draft.studentDeferred
                  ? "Deferred or IDR selected. Minimum payment is set to $0."
                  : "Enter the required minimum payment due each month."}
              </div>
              {draft.type === "student" && (
                <label className="td-checkbox-group">
                  <input
                    type="checkbox"
                    checked={draft.studentDeferred}
                    onChange={onToggleDeferred}
                  />
                  Loan is deferred or on an IDR plan (minimum $0).
                </label>
              )}
            </div>
          </section>

          <section className="td-debt-panel-section">
            <button type="button" className="td-advanced-toggle" onClick={onToggleAdvanced}>
              {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
            </button>
            {showAdvanced && (
              <div className="td-advanced-fields">
                <label>
                  Remaining term (months)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 48"
                    value={draft.termMonths}
                    onChange={onChange("termMonths")}
                  />
                </label>
                <label>
                  Original amount
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 20,000"
                    value={formatNumberInput(draft.originalAmount)}
                    onChange={onChange("originalAmount")}
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    rows="3"
                    placeholder="Anything else you want to remember"
                    value={draft.notes}
                    onChange={onChange("notes")}
                  />
                </label>
              </div>
            )}
          </section>

          {error ? <div className="td-form-error">{error}</div> : null}
        </div>

        <footer className="td-debt-panel-footer">
          {showSaved ? <span className="td-saved-note">Saved</span> : null}
          <button type="button" className="td-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="td-save-btn" onClick={onSave}>
            Save debt
          </button>
        </footer>
      </div>
    </div>
  );
};

const getTransactionType = (txn) =>
  txn.type === "expense" ? (txn.expenseType || "personal") : (txn.incomeType || "personal");

const toNumber = (value) => {
  const cleaned = String(value ?? "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareByName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
const compareSnowball = (a, b) => {
  const balanceA = Number(a.balance) || 0;
  const balanceB = Number(b.balance) || 0;
  if (balanceA !== balanceB) return balanceA - balanceB;
  const aprA = Number(a.apr) || 0;
  const aprB = Number(b.apr) || 0;
  if (aprA !== aprB) return aprA - aprB;
  return compareByName(a, b);
};
const compareAvalanche = (a, b) => {
  const aprA = Number(a.apr) || 0;
  const aprB = Number(b.apr) || 0;
  if (aprA !== aprB) return aprB - aprA;
  const balanceA = Number(a.balance) || 0;
  const balanceB = Number(b.balance) || 0;
  if (balanceA !== balanceB) return balanceA - balanceB;
  return compareByName(a, b);
};

const getDebtTypeLabel = (type) => {
  const match = DEBT_TYPES.find((item) => item.key === type);
  return match ? match.label : "Debt";
};

const formatDuration = (months) => {
  if (!months || months <= 0 || !Number.isFinite(months)) return "Variable";
  const yrs = Math.floor(months / 12);
  const mths = Math.round(months % 12);
  const parts = [];
  if (yrs > 0) parts.push(`${yrs} year${yrs === 1 ? "" : "s"}`);
  if (mths > 0) parts.push(`${mths} month${mths === 1 ? "" : "s"}`);
  return parts.length === 0 ? "Less than a month" : parts.join(" and ");
};

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const formatFinishLabel = (months) => {
  if (!months || months <= 0 || !Number.isFinite(months)) return "";
  const finish = addMonths(new Date(), months);
  return finish.toLocaleString("en-US", { month: "short", year: "numeric" });
};

const DEBT_CASH_KEY = "debtCashForm";
const PLAN_TYPE_KEY = "debtPlanType";

const readPlanType = () => {
  if (typeof window === "undefined") return "snowball";
  try {
    const stored = localStorage.getItem(PLAN_TYPE_KEY);
    return stored === "avalanche" ? "avalanche" : "snowball";
  } catch (e) {
    return "snowball";
  }
};

  const TotalDebtPayoff = ({ onNavigate = () => {} }) => {
    const { profile, totals, refreshProfile } = useMoneyProfile();
    const tierContext = useMemo(() => {
      const stage = computeSplitPlan({ income: totals.income, leftover: totals.leftover }).currentStage;
    const guidance = {
      critical:
        "This season is demanding, so stability comes first while steady progress continues. Avoid adding new debt and stick to this order to keep momentum safe.",
      tight:
        "You have some breathing room. Keep progress steady while you protect your buffer and stay consistent with this order.",
      balanced:
        "You're in a stable position. Keep progress steady while you protect savings and avoid new debt.",
      traditional:
        "You're in a strong position. Stay consistent and keep your payoff order focused so progress stays efficient.",
    };
    const details = {
      critical: {
        why: "Stability protects you while you work the plan.",
        changes:
          "This tier improves as leftover becomes positive and stays there consistently.",
        improves: "Even small, steady extra payments reduce your payoff time over time.",
      },
      tight: {
        why: "Consistency keeps momentum steady without adding pressure.",
        changes:
          "As leftover grows, your tier strengthens and the plan can accelerate safely.",
        improves: "Keeping extra payments consistent has the biggest impact on payoff time here.",
      },
      balanced: {
        why: "Your leftover supports steady progress without sacrificing essentials.",
        changes:
          "Maintaining steady leftover keeps this tier stable and opens faster payoff options.",
        improves: "Directing extra payments consistently keeps your payoff time moving down.",
      },
      traditional: {
        why: "Your leftover is strong enough to support efficient payoff choices.",
        changes:
          "Staying consistent keeps you in this tier and improves your payoff timeline.",
        improves: "Keeping extra payments focused on the top debt shortens payoff time fastest.",
      },
    };
    return {
      key: stage.key,
      label: stage.label,
      guidance: guidance[stage.key] || "",
      details: details[stage.key] || details.critical,
    };
    }, [totals.income, totals.leftover]);
  const [creditCards, setCreditCards] = useState(() => loadCreditCards());
  const [manualDebts, setManualDebts] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(DEBT_CASH_KEY);
      return stored ? normalizeManualDebts(JSON.parse(stored)) : [];
    } catch (e) {
      return [];
    }
  });
  const [isDebtPanelOpen, setIsDebtPanelOpen] = useState(false);
  const [debtPanelMode, setDebtPanelMode] = useState("add");
    const [draftDebt, setDraftDebt] = useState({
      id: "",
      type: "",
      balance: "",
      apr: "",
      minPayment: "",
      studentDeferred: false,
      termMonths: "",
      originalAmount: "",
      notes: "",
    });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const { formatCurrency, preferences } = usePreferences();
  const [planType, setPlanType] = useState(() => readPlanType());

  const buildDebtEntries = useCallback(() => {
    const cards = buildCreditCardDebts(creditCards);
    const derived = buildDerivedDebts(profile.expenses || []);
    return [...cards, ...derived];
  }, [creditCards, profile.expenses]);

  const [debtEntries, setDebtEntries] = useState(() => buildDebtEntries());
  const manualDebtEntries = useMemo(
    () => buildManualDebts(manualDebts, { labelDebtType: getDebtTypeLabel }),
    [manualDebts]
  );
  const allDebtEntries = useMemo(
    () => [...debtEntries, ...manualDebtEntries],
    [debtEntries, manualDebtEntries]
  );

  const handleAddDebtClick = useCallback(() => {
    setDebtPanelMode("add");
      setDraftDebt({
        id: "",
        type: "",
        balance: "",
        apr: "",
        minPayment: "",
        studentDeferred: false,
        termMonths: "",
        originalAmount: "",
        notes: "",
      });
    setShowAdvanced(false);
    setFormError("");
    setIsDebtPanelOpen(true);
  }, []);

  const handleEditDebt = useCallback((debt) => {
    setDebtPanelMode("edit");
      setDraftDebt({
        id: debt.id,
        type: debt.type || "other",
        balance: debt.balance ?? "",
        apr: debt.apr ?? "",
        minPayment: debt.minPayment ?? "",
        studentDeferred: Boolean(debt.studentDeferred),
        termMonths: debt.termMonths ?? "",
        originalAmount: debt.originalAmount ?? "",
        notes: debt.notes ?? "",
      });
      setShowAdvanced(Boolean(debt.termMonths || debt.originalAmount || debt.notes));
    setFormError("");
    setIsDebtPanelOpen(true);
  }, []);

  const handleDraftChange = useCallback(
    (field) => (event) => {
      const raw = ["balance", "minPayment", "originalAmount"].includes(field)
        ? event.target.value.replace(/,/g, "")
        : event.target.value;
      setDraftDebt((prev) => ({ ...prev, [field]: raw }));
    },
    []
  );

    const handleSelectDebtType = useCallback((type) => {
      setDraftDebt((prev) => ({
        ...prev,
        type,
        studentDeferred: type === "student" ? prev.studentDeferred : false,
      }));
    }, []);

    const handleDeferredToggle = useCallback(() => {
      setDraftDebt((prev) => {
        const nextDeferred = !prev.studentDeferred;
        return {
          ...prev,
          studentDeferred: nextDeferred,
          minPayment: nextDeferred ? "0" : prev.minPayment,
        };
      });
    }, []);

  const handleSaveDebt = useCallback(() => {
    if (!draftDebt.type) {
      setFormError("Choose a debt type to continue.");
      return;
    }
    if (!toNumber(draftDebt.balance)) {
      setFormError("Enter a balance greater than 0.");
      return;
    }
    if (!draftDebt.studentDeferred && !toNumber(draftDebt.minPayment)) {
      setFormError("Enter a minimum payment.");
      return;
    }
    const nextDebt = {
      ...draftDebt,
      id: draftDebt.id || createDebtId(),
    };
    setManualDebts((prev) => {
      if (debtPanelMode === "edit") {
        return prev.map((item) => (item.id === nextDebt.id ? nextDebt : item));
      }
      return [...prev, nextDebt];
    });
    setShowSaved(true);
    setIsDebtPanelOpen(false);
  }, [debtPanelMode, draftDebt]);

  const handleRemoveDebt = useCallback(
    (debt) => {
      if (debt.source === "manual") {
        setManualDebts((prev) => prev.filter((item) => item.id !== debt.id));
        return;
      }
      if (debt.source === "credit-card") {
        const nextCards = creditCards.filter(
          (card) => card.id !== debt.id && `card-${card.name || "unknown"}` !== debt.id
        );
        saveCreditCards(nextCards);
        setCreditCards(nextCards);
        return;
      }
      onNavigate("onboarding");
    },
    [creditCards, onNavigate]
  );

  const handleEditDebtCard = useCallback(
    (debt) => {
      if (debt.source === "manual") {
        handleEditDebt(debt);
        return;
      }
      if (debt.source === "expense") {
        onNavigate("onboarding");
        return;
      }
      if (debt.source === "credit-card") {
        onNavigate("credit-card-payoff");
      }
    },
    [handleEditDebt, onNavigate]
  );

  const handleRefreshFromExpenses = useCallback(() => {
    setDebtEntries(buildDebtEntries());
  }, [buildDebtEntries]);

  const handleUpdateExpenses = useCallback(() => {
    refreshProfile();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("profile-updated"));
    }
  }, [refreshProfile]);

  useEffect(() => {
    setDebtEntries(buildDebtEntries());
  }, [buildDebtEntries]);

  useEffect(() => {
    try {
      localStorage.setItem(DEBT_CASH_KEY, JSON.stringify({ manualDebts }));
      window.dispatchEvent(new Event("debt-cash-updated"));
    } catch (e) {
      /* ignore */
    }
  }, [manualDebts]);

  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), 1800);
    return () => clearTimeout(timer);
  }, [showSaved]);

  useEffect(() => {
    const refreshCards = () => {
      const cards = loadCreditCards();
      setCreditCards(cards);
      setDebtEntries(buildDebtEntries());
    };
    window.addEventListener(CREDIT_CARDS_EVENT, refreshCards);
    return () => window.removeEventListener(CREDIT_CARDS_EVENT, refreshCards);
  }, [buildDebtEntries]);

  const canChoosePlanType = getDebtPlanEligibility({
    premiumAccess: preferences.premiumAccess,
    tierKey: tierContext.key,
  });
  const effectivePlanType = getActiveDebtPlanType({
    planTypeKey: planType,
    premiumAccess: preferences.premiumAccess,
    tierKey: tierContext.key,
  });

  useEffect(() => {
    if (!canChoosePlanType && planType !== "snowball") {
      setPlanType("snowball");
      try {
        localStorage.setItem(PLAN_TYPE_KEY, "snowball");
      } catch (e) {
        /* ignore */
      }
    }
  }, [canChoosePlanType, planType]);

  const debtEntriesWithBalance = useMemo(
    () => allDebtEntries.filter((debt) => Number(debt.balance) > 0),
    [allDebtEntries]
  );
  const hasDebts = debtEntriesWithBalance.length > 0;
  const priorityOrder = useMemo(() => {
    const next = [...debtEntriesWithBalance];
    const comparator = effectivePlanType === "avalanche" ? compareAvalanche : compareSnowball;
    next.sort(comparator);
    return next;
  }, [debtEntriesWithBalance, effectivePlanType]);
  const currentTargetId = priorityOrder[0]?.id;
  const priorityPositionById = useMemo(
    () => new Map(priorityOrder.map((debt, index) => [debt.id, index + 1])),
    [priorityOrder]
  );

  const totalDebt = debtEntriesWithBalance.reduce((sum, debt) => sum + (Number(debt.balance) || 0), 0);
  const derivedCount = debtEntriesWithBalance.filter((debt) => debt.source === "expense").length;
  const totalMinimums = debtEntriesWithBalance.reduce((sum, debt) => sum + (Number(debt.minPayment) || 0), 0);

  const leftover = totals?.leftover ?? 0;
  const availableForSnowball = Math.max(0, leftover);
  const debtAllocationPct = 0.3;
  const baseExtra = availableForSnowball * debtAllocationPct;
  const payoffPower = totalMinimums + baseExtra;

    const plan = useMemo(() => {
      const entries =
        effectivePlanType === "avalanche"
          ? runAvalancheSimulation(debtEntriesWithBalance, baseExtra, 0)
          : runSnowballSimulation(debtEntriesWithBalance, baseExtra, 0);
      return entries.map((entry, index) => {
        const termOverride = Number(entry.termMonths) || 0;
        const payoffEstimateMonths = termOverride > 0 ? termOverride : entry.months ?? null;
        const endMonth = termOverride > 0 ? termOverride : entry.endMonth;
        const isTarget = entry.id === currentTargetId;
        return {
          ...entry,
          balance: entry.startBalance,
          order: entry.order ?? index + 1,
          isTarget,
          payoffEstimateMonths,
          endMonth,
          currentRecommendedPayment: entry.minPayment + (isTarget ? baseExtra : 0),
        };
      });
    }, [debtEntriesWithBalance, baseExtra, effectivePlanType, currentTargetId]);

  const planById = useMemo(() => new Map(plan.map((entry) => [entry.id, entry])), [plan]);
  const buildImpactSummary = useCallback(
    (entries) => {
      if (!entries || entries.length === 0) return null;
      const totalInterest = entries.reduce((sum, entry) => sum + (Number(entry.totalInterest) || 0), 0);
      const totalPaid = entries.reduce((sum, entry) => {
        const principal = Number(entry.startBalance) || 0;
        const interest = Number(entry.totalInterest) || 0;
        return sum + principal + interest;
      }, 0);
      const timelineMonths = entries.reduce((max, entry) => {
        return Math.max(max, entry.endMonth || entry.payoffEstimateMonths || entry.months || 0);
      }, 0);
      return {
        totalInterest,
        totalPaid,
        finishLabel: timelineMonths ? formatFinishLabel(timelineMonths) : "Variable",
      };
    },
    []
  );
  const impactSummary = useMemo(() => {
    if (debtEntriesWithBalance.length === 0) return null;
    const snowballEntries = runSnowballSimulation(debtEntriesWithBalance, baseExtra, 0);
    const avalancheEntries = runAvalancheSimulation(debtEntriesWithBalance, baseExtra, 0);
    const snowball = buildImpactSummary(snowballEntries);
    const avalanche = buildImpactSummary(avalancheEntries);
    if (!snowball || !avalanche) return null;
    return { snowball, avalanche };
  }, [debtEntriesWithBalance, baseExtra, buildImpactSummary]);
  const payoffOrder = useMemo(
    () =>
      priorityOrder.map((debt, index) => {
        const payoffEntry = planById.get(debt.id);
        const payoffEstimateMonths = payoffEntry?.payoffEstimateMonths ?? null;
        return {
          id: debt.id,
          name: debt.name,
          payoffEstimateMonths,
          order: index + 1,
        };
      }),
    [priorityOrder, planById]
  );

  const formatAprDisplay = useCallback((debt) => {
    const value = Number(debt?.apr) || 0;
    const type = debt?.type || "";
    if (!Number.isFinite(value) || value <= 0) return "0.00%";
    if (type === "mortgage" && value > 12) return "12%+";
    if (value > 25) return "25%+";
    return `${value.toFixed(2)}%`;
  }, []);

  const timelineMonths = plan.reduce((max, entry) => {
    return Math.max(max, entry.endMonth || entry.payoffEstimateMonths || entry.months || 0);
  }, 0);
  const payoffTimelineSummary = timelineMonths
    ? `${timelineMonths} months / ${(timelineMonths / 12).toFixed(1)} years`
    : "Variable";
  const planTypeLabel = effectivePlanType === "avalanche" ? "Avalanche" : "Snowball";
  const planLower = effectivePlanType === "avalanche" ? "avalanche" : "snowball";

  const getDebtCategoryLabel = (debt) => {
    if (debt.type) return getDebtTypeLabel(debt.type);
    const lower = (debt.name || "").toLowerCase();
    if (/mortgage|home/.test(lower)) return "Mortgage";
    if (/car|auto|vehicle/.test(lower)) return "Vehicle";
    if (/personal/.test(lower)) return "Personal loan";
    if (/student/.test(lower)) return "Student loan";
    if (/credit|card/.test(lower)) return "Credit card";
    return "Other debt";
  };

  return (
    <div className="total-debt-page">
      <TopRightControls
        className="top-controls"
        activePage="total-debt"
        onNavigate={onNavigate}
        logoutHref="/Local/Luna Login"
      />

      <header className="td-hero">
        <div className="td-eyebrow">Total Debt</div>
        <h1 className="td-heading">Your Debt Snapshot</h1>
        <p className="td-subtitle">
          See everything you owe in one place, with a plan that keeps progress steady.
        </p>
      </header>

      <h2 className="td-summary-title">Summary</h2>
        <section className="td-summary-bar">
        <div className="td-summary-card">
          <span>Total Debt</span>
          <strong>{debtEntriesWithBalance.length ? formatCurrency(totalDebt) : "Add debts to begin"}</strong>
        </div>
          <div className="td-summary-card">
            <span>Estimated Payoff</span>
            <strong>{payoffTimelineSummary}</strong>
            <small>Based on your current payments and future roll-over increases from the {planLower} plan.</small>
          </div>
        <div className="td-summary-card">
          <span>Plan Type</span>
          <strong>{planTypeLabel}</strong>
          <div className="td-plan-type-details">
            <div className="td-plan-type-row">
              {planTypeLabel === "Snowball" ? (
                <small>Best for motivation and steady psychological wins.</small>
              ) : (
                <>
                  <span>Avalanche (Premium + Thriving)</span>
                  <small>Unlocks automatically once your stability remains strong.</small>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="td-plan-link"
            onClick={() => onNavigate("snowball-explainer")}
          >
            How your plan works
          </button>
        </div>
        </section>
        {impactSummary && (
          <section className="td-total-cost-card">
            <div className="td-total-cost-header">
              <div>
                <div className="td-total-cost-title">Total Cost Summary</div>
                <div className="td-total-cost-sub">
                  Using your current numbers, Snowball and Avalanche result in the same total cost. Differences only appear if balances or interest rates change.
                </div>
              </div>
            </div>
            <div className="td-total-cost-table">
              <div className="td-total-cost-row td-total-cost-head">
                <span />
                <span>Snowball</span>
                <span>Avalanche</span>
              </div>
              <div className="td-total-cost-row">
                <span>Total amount paid</span>
                <strong>{formatCurrency(impactSummary.snowball.totalPaid)}</strong>
                <strong>{formatCurrency(impactSummary.avalanche.totalPaid)}</strong>
              </div>
              <div className="td-total-cost-row td-total-interest-row">
                <span>Total interest paid</span>
                <strong>{formatCurrency(impactSummary.snowball.totalInterest)}</strong>
                <strong>{formatCurrency(impactSummary.avalanche.totalInterest)}</strong>
              </div>
              <div className="td-total-cost-row">
                <span>Estimated payoff completion date</span>
                <strong>{impactSummary.snowball.finishLabel}</strong>
                <strong>{impactSummary.avalanche.finishLabel}</strong>
              </div>
            </div>
          </section>
        )}

      <section className="td-tier-context">
        <div className="td-label">Tier Lens: {tierContext.label}</div>
        <p className="td-note">{tierContext.guidance}</p>
        <details className="td-tier-details">
          <summary>
            <span>Why This Matters</span>
            <span className="td-tier-details-action">Supportive context</span>
          </summary>
          <div className="td-tier-details-body">
            <div>
              <strong>Why this tier</strong>
              <p>{tierContext.details.why}</p>
            </div>
            <div>
              <strong>What changes the tier</strong>
              <p>{tierContext.details.changes}</p>
            </div>
            <div>
              <strong>What improves payoff time</strong>
              <p>{tierContext.details.improves}</p>
            </div>
          </div>
        </details>
      </section>


      {hasDebts && (
        <section className="td-order">
          <div className="td-section-heading">
            <h2>Payoff Order</h2>
            <p className="td-note">
              This list follows the {planLower} logic so you can see what gets paid first and how the order shifts as each debt clears.
            </p>
          </div>
          <div className="td-order-card">
            <ol className="td-order-list">
                {payoffOrder.map((entry) => (
                <li key={entry.id} className="td-order-row">
                  <div className="td-order-main">
                    <strong>{entry.name}</strong>
                  </div>
                  <div className="td-order-position">
                    <span>Position</span>
                    <strong>{entry.order}</strong>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {hasDebts ? (
        <section className="td-debt-summary">
          <div className="td-debt-summary-grid">
            <div className="td-debt-summary-left">
              <h2>Your Debts</h2>
              <p className="td-note">
                Everything you're paying toward is listed here. Update balances or APRs anytime to keep your plan accurate.
              </p>
              <div className="td-debt-actions">
                <div className="td-debt-action-stack">
                  <button
                    type="button"
                    className="primary-btn purple-save-btn td-add-debt-btn"
                    onClick={handleAddDebtClick}
                  >
                    + Add Debt
                  </button>
                  <span className="td-debt-count">
                    {debtEntriesWithBalance.length} Debt{debtEntriesWithBalance.length === 1 ? "" : "s"} Tracked
                  </span>
                </div>
              </div>
            </div>
            <div className="td-debt-summary-right">
              <div className="td-debt-list">
                {debtEntriesWithBalance.map((debt) => {
                  const payoffEntry = planById.get(debt.id);
                  const payoffEstimate = payoffEntry?.payoffEstimateMonths
                    ? formatDuration(payoffEntry.payoffEstimateMonths)
                    : "Variable";
                  const orderLabel = priorityPositionById.get(debt.id) ?? "-";
                  const isManual = debt.source === "manual";
                  const isCreditCard = debt.source === "credit-card";
                  const canRemove = isManual || isCreditCard;
                  const sourceLabel =
                    debt.source === "expense"
                      ? `Tracked debt - ${getDebtCategoryLabel(debt)}`
                      : debt.source === "manual"
                      ? `Manual entry - ${getDebtCategoryLabel(debt)}`
                      : "Tracked debt - Credit card";
                  return (
                    <article key={debt.id} className="td-debt-card">
                      <header className="td-debt-card-header">
                        <div>
                          <h3>{debt.name}</h3>
                          <span className="td-debt-source">{sourceLabel}</span>
                        </div>
                        <div className="td-debt-order-pill">
                          <span>Order</span>
                          <strong>{orderLabel}</strong>
                        </div>
                      </header>
                      <div className="td-debt-card-stats">
                        <div className="td-debt-card-stat">
                          <span>Balance</span>
                          <strong>{formatCurrency(debt.balance)}</strong>
                        </div>
                        <div className="td-debt-card-stat">
                          <span>APR</span>
                          <strong>{formatAprDisplay(debt)}</strong>
                        </div>
                        <div className="td-debt-card-stat">
                          <span>Minimum</span>
                          <strong>{formatCurrency(debt.minPayment)}</strong>
                        </div>
                      </div>
                      <div className="td-debt-card-payoff">
                        <span>Estimated payoff (includes roll-overs)</span>
                        <strong>{payoffEstimate}</strong>
                      </div>
                      <div className="td-debt-card-actions">
                        <button
                          type="button"
                          className="td-secondary-btn td-card-btn"
                          onClick={() => handleEditDebtCard(debt)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="td-secondary-btn td-card-btn td-danger-btn"
                          onClick={() => handleRemoveDebt(debt)}
                          disabled={!canRemove}
                          title={
                            canRemove ? "Remove this debt" : "Managed in Expenses - update it there"
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="td-empty-state-section">
          <div className="td-debt-empty-state-card">
            <h3>No debts tracked yet</h3>
            <p>Add entries to get started and build your payoff order.</p>
            <button
              type="button"
              className="primary-btn purple-save-btn td-empty-add-btn"
              onClick={handleAddDebtClick}
            >
              + Add Debt
            </button>
          </div>
        </section>
      )}

      <section className="td-monthly-plan">
        <div className="td-monthly-plan-card">
          <div className="td-monthly-plan-header">
            <div>
              <span className="td-label">Your Monthly Plan</span>
            </div>
            <div className="td-monthly-total">
              You're paying <strong>{formatCurrency(payoffPower)}</strong> / month
            </div>
          </div>
          <div className="td-monthly-plan-details">
            <div>
              <span>Minimum payments</span>
              <strong>{formatCurrency(totalMinimums)}</strong>
            </div>
            <div>
              <span>Extra {planLower}</span>
              <strong>{formatCurrency(baseExtra)}</strong>
            </div>
          </div>
          <div className="td-note">If your leftover increases, your payoff timeline improves.</div>
        </div>
      </section>

        <DebtPanel
          isOpen={isDebtPanelOpen}
          mode={debtPanelMode}
          draft={draftDebt}
          showAdvanced={showAdvanced}
          error={formError}
          showSaved={showSaved}
          onClose={() => setIsDebtPanelOpen(false)}
          onSave={handleSaveDebt}
          onChange={handleDraftChange}
          onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
          onSelectType={handleSelectDebtType}
          onToggleDeferred={handleDeferredToggle}
        />

      <section className="td-expense-reference">
        <div>
          <h3>Keep This Accurate</h3>
          <p>Update expenses if debts are missing, then refresh to pull in new items.</p>
        </div>
        <button type="button" className="td-secondary-btn" onClick={handleUpdateExpenses}>
          Update expenses
        </button>
        <button type="button" className="td-secondary-btn" onClick={handleRefreshFromExpenses}>
          Refresh debts {derivedCount > 0 ? `(${derivedCount} synced)` : ""}
        </button>
      </section>
    </div>
  );
};

export default TotalDebtPayoff;


