import React from "react";
import "./BudgetPeriodGuide.css";
import TopRightControls from "../components/TopRightControls.jsx";

const BudgetPeriodGuide = ({ onNavigate = () => {}, theme = "light" }) => {
  return (
    <div className={`budget-period-guide-page ${theme === "dark" ? "is-dark" : ""}`}>
      <header className="budget-period-guide-header">
        <TopRightControls
          className="top-controls"
          activePage="settings"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="budget-period-guide-hero">
          <div className="eyebrow">Budget period</div>
          <h1>How your budget period works</h1>
          <p>
            Your budget period defines the window used to track live performance. It changes what counts as "this
            period" without changing your baseline income, expenses, or debts.
          </p>
        </div>
      </header>

      <main className="budget-period-guide-main">
        <section className="guide-card">
          <h2>What is a budget period?</h2>
          <p>
            Think of it as the scoreboard window for your live budget. When the period resets, the live totals reset.
            Your baseline plan stays the same.
          </p>
          <ul>
            <li>Live totals reset when the period rolls over.</li>
            <li>Baseline income and expenses stay unchanged.</li>
            <li>Debt balances and payoff timelines stay unchanged.</li>
          </ul>
        </section>

        <section className="guide-card">
          <h2>What resets vs. what stays</h2>
          <p>Your history is always saved. Resetting a period never deletes your past data.</p>
          <div className="guide-split">
            <div>
              <h3>Resets each period</h3>
              <ul>
                <li>Live income total.</li>
                <li>Live expense total.</li>
                <li>Live leftover.</li>
                <li>Period alerts &amp; activity tracking.</li>
              </ul>
            </div>
            <div>
              <h3>Stays the same</h3>
              <ul>
                <li>Your baseline income and expense entries.</li>
                <li>Your debt list and payoff plan settings.</li>
                <li>Profile and subscription details.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="guide-card">
          <h2>Period types in plain language</h2>
          <div className="guide-grid">
            <div className="guide-mini-card">
              <h4>Calendar month</h4>
              <p>Runs from the 1st through the last day of the month.</p>
            </div>
            <div className="guide-mini-card">
              <h4>Weekly</h4>
              <p>Every 7 days starting from your chosen anchor date.</p>
            </div>
            <div className="guide-mini-card">
              <h4>Biweekly</h4>
              <p>Every 14 days, good for biweekly pay cycles.</p>
            </div>
            <div className="guide-mini-card">
              <h4>4-week cycle</h4>
              <p>Every 28 days, keeps weeks aligned month to month.</p>
            </div>
            <div className="guide-mini-card">
              <h4>Paycheck-based</h4>
              <p>Resets when you log a new income entry.</p>
            </div>
            <div className="guide-mini-card">
              <h4>Custom start day</h4>
              <p>Pick a day of the month to start your cycle.</p>
            </div>
          </div>
        </section>

        <section className="guide-card">
          <h2>What happens when a new period starts?</h2>
          <p>
            Live totals reset, and the dashboard focuses on fresh activity. If no new income or transactions are logged,
            the app shows estimates from your baseline until activity comes in.
          </p>
          <div className="guide-callout">
            <strong>Tip:</strong> If you use paycheck mode, log your income as soon as it hits. That confirms the
            period and updates your live numbers right away.
          </div>
        </section>

        <section className="guide-card">
          <h2>Quick example</h2>
          <div className="guide-timeline">
            <div>
              <span className="guide-bullet">Week 1</span>
              <p>You log a paycheck and a few expenses. Live totals show your real leftover.</p>
            </div>
            <div>
              <span className="guide-bullet">Week 2</span>
              <p>More spending rolls in. Live totals update inside the same period.</p>
            </div>
            <div>
              <span className="guide-bullet">New period</span>
              <p>Live totals reset, baseline stays the same, and the new cycle begins.</p>
            </div>
          </div>
          <p className="guide-note">
            The goal of budget periods is to help your numbers reflect real life, not trap you in rigid months or
            unrealistic tracking.
          </p>
        </section>

        <div className="guide-footer">
          <button type="button" className="secondary-btn" onClick={() => onNavigate("settings")}>
            Back to settings
          </button>
        </div>
      </main>
    </div>
  );
};

export default BudgetPeriodGuide;
