import React, { useEffect, useRef, useState } from "react";
import "./Onboarding.css";

const STORAGE_KEY = "moneyProfile";

const Onboarding = ({ onNavigate = () => {} }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { name: "", incomes: [], expenses: [] };
    } catch (e) {
      return { name: "", incomes: [], expenses: [] };
    }
  });

  const [showItemModal, setShowItemModal] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [modalType, setModalType] = useState(""); // income | expense
  const [modalLabel, setModalLabel] = useState("");
  const [modalPlaceholder, setModalPlaceholder] = useState("");
  const [modalName, setModalName] = useState("");
  const [modalAmount, setModalAmount] = useState("");

  const [amountCategory, setAmountCategory] = useState("");
  const [amountNameLabel, setAmountNameLabel] = useState("");
  const [amountIsIncome, setAmountIsIncome] = useState(false);
  const [expensesCollapsed, setExpensesCollapsed] = useState(true);

  const hamburgerRef = useRef(null);
  const menuRef = useRef(null);

  const saveProfile = (next) => {
    const toSave = next ?? profile;
    setProfile(toSave);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  };

  useEffect(() => {
    const handler = (e) => {
      if (!menuOpen) return;
      if (
        hamburgerRef.current &&
        !hamburgerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  const goToStep2 = () => {
    const name = document.getElementById("userNameInput")?.value.trim() || profile.name.trim();
    if (!name) {
      alert("Please enter your name.");
      return;
    }
    const next = { ...profile, name };
    saveProfile(next);
    setStep(2);
  };

  const goToStep3 = () => {
    if (profile.incomes.length === 0) {
      alert("Add at least one income entry.");
      return;
    }
    setStep(3);
  };

  const finishSetup = () => {
    saveProfile();
    onNavigate("goals");
  };

  const renderList = (items, isIncome) => {
    if (!items.length) {
      return <div className="small-note">No {isIncome ? "income" : "expenses"} added yet.</div>;
    }
    return items.map((item) => (
      <div key={item.id} className="entry-row">
        <div>
          <strong>{item.category || item.name}</strong>
          {item.name && item.category ? `: ${item.name}` : null}
          <br />${item.amount.toFixed(2)}/month
        </div>
        <button className="delete-btn" onClick={() => deleteItem(isIncome ? "income" : "expense", item.id)}>
          Del
        </button>
      </div>
    ));
  };

  const deleteItem = (type, id) => {
    if (type === "income") {
      const next = { ...profile, incomes: profile.incomes.filter((i) => i.id !== id) };
      saveProfile(next);
    } else {
      const next = { ...profile, expenses: profile.expenses.filter((e) => e.id !== id) };
      saveProfile(next);
    }
  };

  const openItemModal = (type, label, placeholder) => {
    setModalType(type);
    setModalLabel(label);
    setModalPlaceholder(placeholder);
    setModalName("");
    setModalAmount("");
    setShowItemModal(true);
  };

  const saveItemFromModal = () => {
    const name = modalName.trim();
    const amount = Number(modalAmount);
    if (!name) return alert("Name required.");
    if (isNaN(amount) || amount < 0) return alert("Enter valid amount.");
    const newItem = { id: Date.now(), name, amount };
    if (modalType === "income") {
      const next = { ...profile, incomes: [...profile.incomes, newItem] };
      saveProfile(next);
    } else {
      const next = {
        ...profile,
        expenses: [...profile.expenses, { ...newItem, category: modalLabel }],
      };
      saveProfile(next);
    }
    setShowItemModal(false);
  };

  const openAmountOnlyModal = (category, label, type) => {
    setAmountCategory(category);
    setAmountNameLabel(label);
    setAmountIsIncome(type === "income");
    setModalAmount("");
    setShowAmountModal(true);
  };

  const openSalaryModal = () => {
    setAmountCategory("Salary");
    setAmountNameLabel("Salary (Annual)");
    setAmountIsIncome(true);
    setModalAmount("");
    setShowAmountModal(true);
  };

  const saveSalaryAmount = () => {
    const annual = Number(modalAmount);
    if (isNaN(annual) || annual < 0) return alert("Enter valid salary.");
    const monthly = annual / 12;
    const next = {
      ...profile,
      incomes: [...profile.incomes, { id: Date.now(), name: "Salary", category: "Income", amount: monthly }],
    };
    saveProfile(next);
    setShowAmountModal(false);
  };

  const saveAmountOnlyItem = () => {
    if (amountCategory === "Salary") return saveSalaryAmount();
    const amount = Number(modalAmount);
    if (isNaN(amount) || amount < 0) return alert("Invalid amount.");
    const entry = { id: Date.now(), category: amountCategory, name: amountNameLabel, amount };
    if (amountIsIncome) {
      const next = { ...profile, incomes: [...profile.incomes, entry] };
      saveProfile(next);
    } else {
      const next = { ...profile, expenses: [...profile.expenses, entry] };
      saveProfile(next);
    }
    setShowAmountModal(false);
  };

  const totalIncome = profile.incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = profile.expenses.reduce((sum, e) => sum + e.amount, 0);
  const leftover = totalIncome - totalExpenses;

  return (
    <div className="onboarding-page">
      <header>
        <div className="top-controls">
          <div className="menu-container" ref={menuRef}>
            {menuOpen && (
              <div
                style={{ position: "fixed", inset: 0, zIndex: 150, background: "transparent" }}
                onClick={() => setMenuOpen(false)}
              />
            )}
            <div
              className="hamburger"
              ref={hamburgerRef}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((open) => !open);
              }}
            >
              <div />
              <div />
              <div />
            </div>
            <div className="dropdown-menu" style={{ display: menuOpen ? "block" : "none" }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); onNavigate("dashboard"); }}>Dashboard</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); onNavigate("livebudget"); }}>Track Spending</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); onNavigate("snapshot"); }}>Debt Snapshot</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); onNavigate("budget"); }}>Money Coach</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); onNavigate("goals"); }}>Goals</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); onNavigate("import"); }}>Bank Statements</a>
              <a className="active">Onboarding</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); onNavigate("settings"); }}>Settings</a>
              <a
                href="/Local/Luna Login"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  window.location.replace("/Local/Luna Login");
                }}
              >
                Logout
              </a>
            </div>
          </div>
        </div>
        Getting to Know You
      </header>

      <button className="mobile-back-btn" type="button" onClick={() => onNavigate("goals")}>
        ‹
      </button>

      <div className="main">
        {step === 1 && (
          <div className="step active">
            <div style={{ maxWidth: 360, margin: "32px auto 0", textAlign: "center" }}>
              <div className="story-text">
                Hi there, I’m your money guide. What name should I use for you?
              </div>
              <div className="input-bubble">
                <input
                  id="userNameInput"
                  type="text"
                  placeholder="Enter your name"
                  defaultValue={profile.name}
                />
              </div>
              <button className="primary-btn" onClick={goToStep2}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step active">
            <div className="story-bubble">
              <div className="story-text">
                <span>{profile.name || "Friend"}</span>, let’s build your money story.
                <br />
                Tap a bubble to add income or expenses.
              </div>
            </div>

            <div className="bubble-grid">
              <div className="icon-bubble" onClick={openSalaryModal}>
                <div>💼</div>
                <div className="icon-bubble-label">Salary</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Other Income", "Other Income", "income")}>
                <div>➕</div>
                <div className="icon-bubble-label">Other Inc.</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Housing", "Housing", "expense")}>
                🏠
                <div className="icon-bubble-label">Housing</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Car Payment", "Car Payment", "expense")}>
                🚙
                <div className="icon-bubble-label">Car Pay</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Gas", "Gas", "expense")}>
                ⛽
                <div className="icon-bubble-label">Gas</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Car Insurance", "Car Insurance", "expense")}>
                🛡️
              <div className="icon-bubble-label">Car Ins.</div>
            </div>
            <div className="icon-bubble" onClick={() => openAmountOnlyModal("Credit Card Minimums", "Credit Card Minimums", "expense")}>
              <div role="img" aria-label="Credit cards">💳</div>
              <div className="icon-bubble-label">Card Minimums</div>
            </div>
            <div className="icon-bubble" onClick={() => openAmountOnlyModal("Health Insurance", "Health Insurance", "expense")}>
                🏥
                <div className="icon-bubble-label">Health Ins.</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Food", "Food", "expense")}>
                🍔
                <div className="icon-bubble-label">Food</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Electricity", "Electricity", "expense")}>
                💡
                <div className="icon-bubble-label">Electric</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("WiFi", "WiFi", "expense")}>
                🌐
                <div className="icon-bubble-label">WiFi</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Water", "Water", "expense")}>
                🚰
                <div className="icon-bubble-label">Water</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Other Utility", "Other Utility", "expense")}>
                🧰
                <div className="icon-bubble-label">Other Util.</div>
              </div>
              <div className="icon-bubble" onClick={() => openAmountOnlyModal("Fun", "Fun", "expense")}>
                🎮
                <div className="icon-bubble-label">Fun</div>
              </div>
              <div className="icon-bubble" onClick={() => openItemModal("expense", "Custom", "Name this item")}>
                ➕
                <div className="icon-bubble-label">Custom</div>
              </div>
            </div>

            <div className="list-card">
              <h3>Your Income</h3>
              <div id="incomeList">{renderList(profile.incomes, true)}</div>
            </div>
            <div className="list-card">
              <div className="card-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Your Monthly Expenses</h3>
                <button
                  className="text-btn"
                  style={{ margin: 0 }}
                  onClick={() => setExpensesCollapsed((c) => !c)}
                  aria-expanded={!expensesCollapsed}
                  aria-label={expensesCollapsed ? "Expand expenses" : "Collapse expenses"}
                >
                  {expensesCollapsed ? "▼" : "▲"}
                </button>
              </div>
              {!expensesCollapsed && <div id="expenseList">{renderList(profile.expenses, false)}</div>}
            </div>

            <button className="primary-btn" onClick={goToStep3}>
              See My Summary
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="step active">
            <div className="story-bubble">
              <div className="story-text">
                Here's what we learned about your finances, <span className="story-name-highlight">{profile.name}</span>.
              </div>
            </div>
            <div className="summary-box">
              <div className="fade-in-text">
                <h3>Monthly Snapshot</h3>
                <div>
                  <strong>Total Income:</strong> ${totalIncome.toFixed(2)}
                </div>
                <div>
                  <strong>Total Expenses:</strong> ${totalExpenses.toFixed(2)}
                </div>
                <div>
                  <strong>Leftover:</strong> ${leftover.toFixed(2)}
                </div>
              </div>
            </div>
            <button className="primary-btn" onClick={finishSetup}>
              Save & Continue
            </button>
          </div>
        )}
      </div>

      {showItemModal && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setShowItemModal(false)} style={{ display: "flex" }}>
          <div className="modal-content">
            <div className="modal-title">Add {modalLabel}</div>
            <input
              id="modalNameInput"
              type="text"
              placeholder={modalPlaceholder}
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
            />
            <input
              id="modalAmountInput"
              type="number"
              placeholder="Monthly amount"
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
            />
            <button className="primary-btn" onClick={saveItemFromModal}>
              Save
            </button>
          </div>
        </div>
      )}

      {showAmountModal && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setShowAmountModal(false)} style={{ display: "flex" }}>
          <div className="modal-content">
            <div className="modal-title">Add {amountNameLabel || amountCategory}</div>
            <input
              id="amountOnlyInput"
              type="number"
              placeholder={amountCategory === "Salary" ? "Annual salary" : "Amount (can be $0)"}
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
            />
            <button className="primary-btn" onClick={saveAmountOnlyItem}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
