import React, { useEffect, useMemo, useState } from "react";
import "./GoalsDashboard.css";
import TopRightControls from "../components/TopRightControls.jsx";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import HeroGlue from "../components/HeroGlue";

const formatNumberInput = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/,/g, "");
  if (str === "") return "";
  const [intPart, decPart] = str.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
};

const GOALS_KEY = "goals";
const TIMELINE_OPTIONS = ["3", "6", "9", "12", "18", "24", "36", "60"];

const defaultMonthlyLeftover = 350; // fallback when leftover data is unavailable

const GOAL_GUIDANCE = {
  car: {
    context: "Is this replacing your current car or dreaming forward?",
    placeholder: "Next Car / Family SUV",
    helper: "Pick what feels steady, not stressful. Luna will adjust gently if life shifts.",
  },
  savings: {
    context: "Is this emergency protection, breathing room, or something meaningful?",
    placeholder: "Emergency Fund / Rainy Day",
    helper: "A small, steady pace keeps the cushion honest without pressure.",
  },
  travel: {
    context: "Is this a near trip or something you’re dreaming toward?",
    placeholder: "Paris 2026 / Disney Trip",
    helper: "Luna will keep timelines calm so this trip feels like a promise, not a panic.",
  },
  home: {
    context: "Are you preparing for a first home, upgrade, or future move?",
    placeholder: "First Home / New Place Fund",
    helper: "Steady steps protect the dream—slow, consistent saving is how it arrives.",
  },
  education: {
    context: "Is this school, skill-building, or something new you want to learn?",
    placeholder: "Coding Bootcamp / Nursing School",
    helper: "A thoughtful timeline keeps your learning investment steady and calm.",
  },
  debt: {
    context: "Which debt do you want to gently shrink?",
    placeholder: "Credit Card / Student Loan",
    helper: "Luna treats this as a protective step, not a punishment.",
  },
  fitness: {
    context: "What body or wellbeing goal are you creating space for?",
    placeholder: "Home Gym / Fitness Retreat",
    helper: "Slow, steady contributions keep momentum and protect your rhythm.",
  },
  retirement: {
    context: "Is this long-term safety you’re building for later?",
    placeholder: "Retirement Nest Egg / Future Calm",
    helper: "Gentle consistency builds optionality years from now without stress today.",
  },
  custom: {
    context: "Tell Luna what this goal means so she can stay gentle.",
    placeholder: "Describe your goal",
    helper: "Pick what feels steady, not stressful. Luna will adjust gently if life shifts.",
  },
};

const normalizeGoalKey = (label = "") =>
  label.toLowerCase().replace(/[^a-z]/g, "");

const getGoalGuidance = (label) => {
  const key = normalizeGoalKey(label);
  return GOAL_GUIDANCE[key] || GOAL_GUIDANCE.custom;
};

const goalTypes = [
  { icon: "\u{1F3E0}", label: "Home" },
  { icon: "\u{1F697}", label: "Car" },
  { icon: "\u{1F4B3}", label: "Debt" },
  { icon: "\u2708\uFE0F", label: "Travel" },
  { icon: "\u{1F4DA}", label: "Education" },
  { icon: "\u{1F4AA}", label: "Fitness" },
  { icon: "\u{1F437}", label: "Savings" },
  { icon: "\u{1F3D6}\uFE0F", label: "Retirement" },
  { icon: "\u2795", label: "Custom" },
];

const GoalsDashboard = ({ onNavigate = () => {} }) => {
  const [goals, setGoals] = useState(() => {
    try {
      const stored = localStorage.getItem(GOALS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("");
  const [customMonths, setCustomMonths] = useState("");
  const [editingId, setEditingId] = useState(null);
  const { formatCurrency } = usePreferences();
  const [previewGoal, setPreviewGoal] = useState(null);
  const { totals } = useMoneyProfile();

  const monthlyLeftover = totals.leftover > 0 ? totals.leftover : defaultMonthlyLeftover;

  useEffect(() => {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }, [goals]);


  const totalAmount = useMemo(
    () => goals.reduce((sum, g) => sum + (Number(g.amount) || 0), 0),
    [goals]
  );

  const resetModal = () => {
    setDetail("");
    setAmount("");
    setMonths("");
    setCustomMonths("");
    setSelectedIcon("");
    setSelectedType("");
    setEditingId(null);
  };

  const selectGoal = (icon, type) => {
    resetModal();
    setSelectedIcon(icon);
    setSelectedType(type);
    setModalOpen(true);
  };

  const addGoal = () => {
    const total = Number(String(amount).replace(/,/g, ""));
    if (!total || total <= 0) {
      alert("Enter a valid goal amount");
      return;
    }

    const chosenMonths = months === "custom" ? Number(customMonths) : Number(months);
    const mths = Math.max(1, chosenMonths || Math.ceil(total / monthlyLeftover));
    const monthly = Math.ceil(total / mths);
    const label = selectedType === "Custom" && detail ? detail : selectedType || "Goal";

    const newGoal = {
      id: Date.now(),
      type: label,
      icon: selectedIcon || "\u{1F3AF}", // dYZ_
      detail,
      amount: total,
      monthly,
      months: mths,
      completed: false,
      category: selectedType || "Custom",
    };

    setGoals((prev) => [...prev, newGoal]);
    setModalOpen(false);
  };

  const handleSkip = () => {
    onNavigate("dashboard");
  };

  const openDetails = (id) => {
    const goal = goals.find((g) => g.id === id);
    setEditingId(id);
    setDetail(goal?.detail || "");
    setAmount(goal ? String(goal.amount || "") : "");
    setMonths(goal ? String(goal.months || "") : "");
    setModalOpen(true);
    setCustomMonths(goal ? String(goal.months || "") : "");
  };

  const openPreview = (goal) => setPreviewGoal(goal);
  const closePreview = () => setPreviewGoal(null);
  const editFromPreview = () => {
    if (!previewGoal) return;
    setEditingId(previewGoal.id);
    setDetail(previewGoal.detail || "");
    setAmount(String(previewGoal.amount || ""));
    setModalOpen(true);
    setPreviewGoal(null);
  };

  const currentGoal = goals.find((g) => g.id === editingId);

  const saveEdit = () => {
    if (!currentGoal) return;
    const total = Number(String(amount || currentGoal.amount).replace(/,/g, ""));
    if (!total || total <= 0) {
      alert("Enter a valid goal amount");
      return;
    }
    const chosenMonths = months === "custom" ? Number(customMonths) : Number(months || currentGoal.months);
    const mths = Math.max(1, chosenMonths || Math.ceil(total / monthlyLeftover));
    const monthly = Math.ceil(total / mths);

    setGoals((prev) =>
      prev.map((g) =>
        g.id === editingId
          ? {
              ...g,
              detail: detail || g.detail,
              amount: total,
              monthly,
              months: mths,
              type: detail || g.type,
            }
          : g
      )
    );
    setModalOpen(false);
  };

  const deleteGoal = (id) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setModalOpen(false);
  };

  const renderModalContent = () => {
    if (!modalOpen) return null;

    if (editingId && currentGoal) {
      const editGuidance = getGoalGuidance(currentGoal.category || currentGoal.type);
      return (
        <div className="modal-box">
          <h3>
            {currentGoal.icon} {currentGoal.type}
          </h3>
          <p className="modal-copy">{editGuidance.context}</p>
          <input
            id="detail-edit"
            placeholder={editGuidance.placeholder}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
          <p className="modal-copy">About how much do you think you’ll need?</p>
          <input
            id="amount-edit"
            type="text"
            inputMode="decimal"
            placeholder="$"
            value={formatNumberInput(amount)}
            onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => setAmount(e.target.value.replace(/,/g, ""))}
          />
          <select
            id="months-edit"
            className="timeline-select"
            value={months || currentGoal?.months || ""}
            onChange={(e) => {
              const val = e.target.value;
              setMonths(val);
              if (val !== "custom") setCustomMonths("");
            }}
          >
            <option value="">Choose timeline</option>
            {TIMELINE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} months
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
          <p className="modal-copy">{editGuidance.helper}</p>
          {months === "custom" && (
            <input
              id="custom-months-edit"
              type="number"
              min="1"
              placeholder="Custom months"
              value={customMonths}
              onChange={(e) => setCustomMonths(e.target.value)}
            />
          )}
          <button className="save-btn purple-save-btn" onClick={saveEdit}>
            Save
          </button>
          <button className="danger-btn save-btn purple-save-btn" onClick={() => deleteGoal(currentGoal.id)}>
            Delete
          </button>
          <p className="modal-helper">You can change this anytime. Goals grow with you, not against you.</p>
        </div>
      );
    }

    if (selectedType) {
      const guidance = getGoalGuidance(selectedType);
      const heading = selectedType === "Custom" ? "Custom Goal" : `${selectedType} Goal`;
      return (
        <div className="modal-box">
          <h3>{heading}</h3>
          <p className="modal-copy">{guidance.context}</p>
          <input
            id="detail"
            placeholder={guidance.placeholder}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
          <p className="modal-copy">About how much do you think you’ll need?</p>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="$"
            value={formatNumberInput(amount)}
            onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => setAmount(e.target.value.replace(/,/g, ""))}
          />
          <select
            id="months"
            className="timeline-select"
            value={months}
            onChange={(e) => {
              const val = e.target.value;
              setMonths(val);
              if (val !== "custom") setCustomMonths("");
            }}
          >
            <option value="">Choose timeline</option>
            {TIMELINE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} months
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
          <p className="modal-copy">{guidance.helper}</p>
          {months === "custom" && (
            <input
              id="custom-months"
              type="number"
              min="1"
              placeholder="Custom months"
              value={customMonths}
              onChange={(e) => setCustomMonths(e.target.value)}
            />
          )}
          <button className="save-btn purple-save-btn" onClick={addGoal}>
            Add Goal
          </button>
          <p className="modal-helper">You can change this anytime. Goals grow with you, not against you.</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="goals-page">
      <header>
        <TopRightControls
          className="top-controls"
          activePage="goals"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="goals-title-group">
          <h1>Your Goals</h1>
          <p className="goals-subtitle">Gentle direction for where you'd like life to go.</p>
        </div>
      </header>
      <HeroGlue
        role="Direction"
        why="Clarity about what you want helps Luna understand how your leftover can support what matters—without pressure, deadlines, or guilt."
      />
      <div className="container">
        <div className="warm-prompt">
          <p className="plan-title">Plan the goals that matter to you.</p>
          <p className="warm-sub">Think of these as guideposts, not commands.</p>
          <p className="warm-sub">
            Pick a goal to explore what steady progress could look like. Luna will show realistic timelines and calm, sustainable paths.
          </p>
        </div>

        <div className="card main">
          <p className="goal-instruction">Choose a goal type to begin.</p>
          <div className="goal-type-grid">
            {goalTypes.map((g) => (
              <div key={g.label} className="goal-type" onClick={() => selectGoal(g.icon, g.label)}>
                <div className="icon">{g.icon}</div>
                <div className="label">{g.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card goals-summary-card">
          <div className="goals-summary-header">
            <div>
              <h3>Active Goals</h3>
              <p className="small-note">
                {goals.length > 0
                  ? `${goals.length} goal${goals.length === 1 ? "" : "s"} - ${formatCurrency(totalAmount)} total`
                  : "No active goals yet. Whenever you're ready, pick something that matters to you."}
              </p>
            </div>
            {goals.length > 0 && (
              <span className="text-muted">
                {`Monthly estimate based on ~${formatCurrency(monthlyLeftover, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}`}
              </span>
            )}
          </div>

          {goals.length === 0 ? null : (
            <div className="goal-list">
              {goals.map((g) => (
                <div key={g.id} className="goal-item" onClick={() => openPreview(g)}>
                  <div className="goal-item-meta">
                    <span className="goal-item-icon">{g.icon}</span>
                    <div>
                      <div className="goal-item-type">{g.type}</div>
                      <p className="goal-item-detail">{g.detail || "No description yet."}</p>
                    </div>
                  </div>
                  <div className="goal-item-metrics">
                    <div className="goal-item-amount">{formatCurrency(g.amount)}</div>
                    <div className="goal-item-timeline">{g.months ? `${g.months} mo` : "Timeline TBD"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="small-note lighten">
            Luna will estimate realistic timelines and suggest calm monthly progress so you can see what steady movement feels like.
          </p>
          <p className="small-note lighten">Not a mandate — just honest guidance.</p>
          </div>
      </div>

      {modalOpen && (
        <div
          className="modal"
          style={{ display: "flex" }}
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          {renderModalContent()}
        </div>
      )}
      {previewGoal && (
        <div className="preview-overlay" onClick={(e) => e.target === e.currentTarget && closePreview()}>
          <div className="preview-card">
            <div className="preview-icon">{previewGoal.icon}</div>
            <h3>{previewGoal.type}</h3>
            <p className="preview-detail">{previewGoal.detail || "No description yet."}</p>
            <div className="preview-grid">
              <div>
                <div className="label">Total</div>
                  <div className="value">{formatCurrency(previewGoal.amount || 0)}</div>
                </div>
              <div>
                <div className="label">Monthly</div>
                  <div className="value">{formatCurrency(previewGoal.monthly || 0)}</div>
                </div>
              <div>
                <div className="label">Timeline</div>
                <div className="value">{previewGoal.months ? `${previewGoal.months} months` : "N/A"}</div>
              </div>
            </div>
            <div className="preview-actions">
              <button className="primary-btn" onClick={editFromPreview}>
                Edit Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsDashboard;
