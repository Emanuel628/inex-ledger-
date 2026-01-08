import React, { useMemo } from "react";
import "./FicoScore.css";
import TopRightControls from "../components/TopRightControls.jsx";
import HeroGlue from "../components/HeroGlue";
import { computeSplitPlan } from "../utils/splitPlan";
import { useMoneyProfile } from "../hooks/useMoneyProfile";

const SCORE_ROWS = [
  { label: "FICO Score", value: "720 (preview)", fill: 72, variant: "good" },
  { label: "Payment History", value: "98% on-time (preview)", fill: 98, variant: "good" },
  { label: "Utilization", value: "12% (preview)", fill: 12, variant: "good" },
  { label: "Age of Credit", value: "5.4 yrs (preview)", fill: 45, variant: "warn" },
];

const POSITIVE_HISTORY = [
  {
    title: "Consistent payments",
    detail: "98% of payments are on time, keeping the most important factor aligned.",
  },
  {
    title: "Low utilization",
    detail: "Using 12% of your credit lines leaves room to grow and prevents rate increases.",
  },
  {
    title: "Balanced account mix",
    detail: "Installment and revolving accounts are both active, helping your profile stay resilient.",
  },
];

const NEGATIVE_HISTORY = [
  {
    title: "Shorter credit age",
    detail: "Average account age is 5.4 years; keep older accounts open and active.",
  },
  {
    title: "Recent inquiries",
    detail: "Hold off on new applications for at least six months to avoid extra hard-pull hits.",
  },
  {
    title: "Limited installment history",
    detail: "If an installment loan naturally becomes part of your plans later, it can help diversify your profile.",
  },
];

const SCORE_MOVERS = [
  { title: "Payment history", detail: "Highest impact on score health." },
  { title: "Utilization", detail: "High impact and improves quickly with lower balances." },
  { title: "Credit age", detail: "Slow, long-term factor that grows with time." },
];

const IMPROVEMENT_TIPS = [
  {
    title: "Keep autopay active",
    detail: "Automate every monthly payment so that on-time streak stays intact.",
  },
  {
    title: "Pay down revolving balances",
    detail: "Lower card balances to keep utilization comfortably below 10%.",
  },
  {
    title: "Mind new credit",
    detail: "Pause hard inquiries and only open new lines when you are ready to keep history steady.",
  },
];

const FicoScore = ({ onNavigate = () => {} }) => {
  const { totals } = useMoneyProfile();
  const tierContext = useMemo(() => {
    const stage = computeSplitPlan({ income: totals.income, leftover: totals.leftover }).currentStage;
    const messages = {
      critical: "Stability first - steady habits will lift your score over time. Next step: keep payments on time and avoid new credit.",
      tight: "Keep payment habits strong while you build a bigger buffer. Next step: keep utilization low each month.",
      balanced: "Your stability supports gradual credit improvement. Next step: keep older accounts open and active.",
      traditional: "You can lean into credit optimization with confidence. Next step: be selective with new credit and protect your history.",
    };
    return { label: stage.label, message: messages[stage.key] || "" };
  }, [totals.income, totals.leftover]);

  return (
    <div className="fico-score-page">
      <header className="fico-score-header">
        <TopRightControls
          className="top-controls"
          activePage="fico"
          onNavigate={onNavigate}
          logoutHref="/Local/Luna Login"
        />
        <div className="header-text">
          <h1>FICO Score</h1>
          <p>See the most important parts of your credit health, and the calm, steady steps that strengthen it over time.</p>
        </div>
      </header>
      <HeroGlue
        role="OPTIMIZE"
        why="These credit signals help Luna understand your long-term financial resilience so advice stays realistic and grounded in how lenders view your profile."
        reassurance="Your score is a reflection of choices over time—not a judgment. We focus on steady steps that strengthen your future, not pressure."
      />

      <main className="fico-score-main">
        <section className="fico-scoreboard-card">
          <div className="card-title-row">
            <div>
              <h2>Scoreboard</h2>
          <p className="hero-subtitle">Preview values shown. Connect accounts later for live FICO updates.</p>
            </div>
          </div>
          <div className="fico-table">
            {SCORE_ROWS.map((row) => (
              <div className="fico-row" key={row.label}>
                <div className="fico-row-header">
                  <div className="label">{row.label}</div>
                  <div className="value">{row.value}</div>
                </div>
                <div className={`mini-bar ${row.variant}`}>
                  <div className={`mini-fill ${row.variant}`} style={{ "--fill": `${row.fill}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="helper subtle">
            Guidance is educational and based on typical FICO behavior. Lender scoring models may vary.
          </div>
        </section>

        <section className="fico-status-card">
          <div className="fico-status-label">Overall Status</div>
          <div className="fico-status-value">Stable</div>
          <div className="fico-status-risk">Risk level: Low</div>
          <p className="fico-status-detail">Your credit profile looks healthy with a few areas to strengthen over time.</p>
          <p className="fico-tier-note">
            Tier context: {tierContext.label}. {tierContext.message}
          </p>
          <div className="fico-luna-note">
            Credit doesn’t improve with hacks or panic decisions. Luna focuses on consistency, stability, and strategic moves that protect your progress and future opportunities.
          </div>
        </section>

        <section className="fico-score-movers">
          <div className="fico-actions-header">
            <h3>Biggest score movers</h3>
            <p>Focus energy on the factors that shift scores most.</p>
          </div>
          <div className="fico-action-list">
            {SCORE_MOVERS.map((item) => (
              <article key={item.title} className="fico-action-tip">
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="fico-history-grid">
          <article className="fico-history-card positive">
            <header>
              <h3>Positive history</h3>
              <p>Keep these strengths in place.</p>
            </header>
            <ul>
              {POSITIVE_HISTORY.map((item) => (
                <li key={item.title}>
                  <h4>{item.title}</h4>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ul>
          </article>
          <article className="fico-history-card negative">
            <header>
              <h3>Areas to improve</h3>
              <p>Small adjustments grow over time.</p>
            </header>
            <ul>
              {NEGATIVE_HISTORY.map((item) => (
                <li key={item.title}>
                  <h4>{item.title}</h4>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="fico-actions">
          <div className="fico-actions-header">
            <h3>Actions that move the needle</h3>
            <p>Track these healthy habits to keep your score trending upward.</p>
          </div>
          <div className="fico-action-list">
            {IMPROVEMENT_TIPS.map((tip) => (
              <article key={tip.title} className="fico-action-tip">
                <h4>{tip.title}</h4>
                <p>{tip.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default FicoScore;
