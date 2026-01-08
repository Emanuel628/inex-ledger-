import React, { useEffect, useMemo, useState } from "react";
import "./ScoreDetails.css";
import TopRightControls from "../components/TopRightControls.jsx";
import {
  getCoachingSuggestion,
  getFinancialHealthScore,
  readScoreSnapshot,
  SCORE_EVENT,
} from "../utils/financialHealthScore";
import { PILLAR_KEYS, PILLAR_LABELS } from "../utils/predictFinancialPillars";

const readScore = () => {
  if (typeof window === "undefined") {
    return {
      status: "insufficient",
      score: null,
      trend: null,
      explanations: null,
      history: [],
      coaching: null,
      confidence: null,
      milestones: [],
      prediction: null,
    };
  }
  try {
    const parsed = readScoreSnapshot();
    if (!parsed) {
      return {
        status: "insufficient",
        score: null,
        trend: null,
        explanations: null,
        history: [],
        coaching: null,
        confidence: null,
        milestones: [],
      };
    }
    const score = Number(parsed?.score);
    const trend = Number(parsed?.trend);
    return {
      status: parsed?.status ?? "ready",
      score: Number.isFinite(score) ? score : null,
      trend: Number.isFinite(trend) ? trend : null,
      explanations: parsed?.explanations,
      history: Array.isArray(parsed?.history) ? parsed.history : [],
      coaching: parsed?.coaching || null,
      confidence: parsed?.confidence || null,
      prediction: parsed?.prediction || null,
      milestones: Array.isArray(parsed?.milestones) ? parsed.milestones : [],
    };
  } catch (e) {
    return {
      status: "insufficient",
      score: null,
      trend: null,
      explanations: null,
      history: [],
      coaching: null,
      confidence: null,
      milestones: [],
      prediction: null,
    };
  }
};

const clampScore = (value) => Math.min(Math.max(Math.round(value), 0), 100);

const CONFIDENCE_EMOJIS = {
  high: "ð",
  medium: "ð",
  low: "â ï¸",
};

const CONFIDENCE_TEXT = {
  high: "Trends are consistent and clear.",
  medium: "Trends are visible but still smoothing out.",
  low: "I need a little more steady history before I can lean in confidently.",
};

const DIRECTION_SUMMARY = {
  improving: "Trending upward. Keep this pace and it should feel stronger in a few periods.",
  stable: "Fairly steady right now. This pillar should stay calm if things continue as they are.",
  softening: "Progress looks like it may slow soon. A little focus will help it keep moving up.",
};

const DIRECTION_TITLES = {
  improving: "Improving",
  stable: "Steady",
  softening: "Softening",
};

const getConfidenceTier = (score = 0) => {
  if (score >= 0.75) return "high";
  if (score >= 0.4) return "medium";
  return "low";
};

const formatStrengthLabel = (value) => {
  if (value >= 0.7) return "Strong";
  if (value >= 0.4) return "Solid";
  return "Gentle";
};

const formatConfidenceLabel = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  return "Low";
};

const ScoreDetails = ({ onNavigate = () => {}, theme = "light" }) => {
  const [scoreState, setScoreState] = useState(() => readScore());
  const [debugTier, setDebugTier] = useState("critical");
  const [debugPillar, setDebugPillar] = useState("budgetStability");
  const [debugDirection, setDebugDirection] = useState("flat");
  const [qaMode, setQaMode] = useState("new");
  const [qaHistory, setQaHistory] = useState(1);
  const [qaVolatility, setQaVolatility] = useState("low");
  const [qaWeakestPillar, setQaWeakestPillar] = useState("budgetStability");
  const [qaTrend, setQaTrend] = useState("stable");
  const [qaCompare, setQaCompare] = useState(false);
  const [qaCompareVolatility, setQaCompareVolatility] = useState("high");
  const [qaComparePillar, setQaComparePillar] = useState("debtMomentum");
  const [qaCompareTrend, setQaCompareTrend] = useState("softening");

  useEffect(() => {
    getFinancialHealthScore({ forceRefresh: true });
    const refresh = () => setScoreState(readScore());
    window.addEventListener("storage", refresh);
    window.addEventListener(SCORE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SCORE_EVENT, refresh);
    };
  }, []);

  const scoreReady = scoreState.status === "ready" && Number.isFinite(scoreState.score);
  const scoreValue = clampScore(scoreReady ? scoreState.score : 0);
  const trendValue = Number.isFinite(scoreState.trend) ? scoreState.trend : 0;
  const scoreTier =
    scoreValue >= 75 ? "Thriving" : scoreValue >= 50 ? "Balanced" : scoreValue >= 25 ? "Tight" : "Critical";

  const ring = useMemo(() => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - scoreValue / 100);
    return { radius, circumference, offset };
  }, [scoreValue]);

  const scoreHistory = useMemo(
    () => (Array.isArray(scoreState.history) ? scoreState.history : []),
    [scoreState.history]
  );
  const trendHistory = useMemo(() => scoreHistory.slice(-12), [scoreHistory]);
  const formatPeriodLabel = (periodKey = "") => {
    const parts = String(periodKey).split(":");
    const key = parts[1] || parts[0];
    return key.replace(/-/g, "/");
  };
  const trendData = useMemo(() => {
    const history = trendHistory.filter((item) => Number.isFinite(item?.score));
    if (history.length < 2) return null;
    const scores = history.map((item) => item.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const width = 320;
    const height = 64;
    const pad = 6;
    const range = Math.max(max - min, 1);
    const step = (width - pad * 2) / (scores.length - 1);
    const points = scores
      .map((score, index) => {
        const x = pad + index * step;
        const y = height - pad - ((score - min) / range) * (height - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
    const delta = scores[scores.length - 1] - scores[0];
    const direction =
      delta >= 7
        ? "Strongly Improving"
        : delta >= 3
          ? "Improving"
          : delta <= -7
            ? "Strongly Softening"
            : delta <= -3
              ? "Softening"
              : "Stable";
    return {
      points,
      width,
      height,
      labels: history.map((item) => formatPeriodLabel(item.periodKey)),
      scores,
      direction,
    };
  }, [trendHistory]);

  const predictionData = scoreState.prediction;
  const predictionEntries = predictionData?.entries || {};
  const hasPredictionCards =
    scoreReady && predictionEntries && Object.keys(predictionEntries).length > 0;
  const confidenceHighlight = predictionData?.confidenceLabel;
  const confidenceEmoji = confidenceHighlight ? CONFIDENCE_EMOJIS[confidenceHighlight] : null;
  const confidenceHeadlineLabel = confidenceHighlight
    ? formatConfidenceLabel(confidenceHighlight)
    : null;
  const predictionsHistoryLength = predictionData?.historyLength || 0;
  const predictionSummaryText = confidenceHighlight ? CONFIDENCE_TEXT[confidenceHighlight] : null;
  const predictionSubtitle = predictionsHistoryLength
    ? `Using ${predictionsHistoryLength} verified periods to ground the forecast.`
    : "Collect a few more steady periods before Luna can predict a direction.";

  const explanationData = scoreState.explanations;
  const explanationItems = Array.isArray(explanationData)
    ? explanationData
    : explanationData?.items || [];
  const explanationSummary = Array.isArray(explanationData)
    ? null
    : explanationData?.summary || null;
  const showCoachingDebug =
    typeof window !== "undefined" && window.location.search.includes("debug=coaching");
  const showQaDebug = typeof window !== "undefined" && window.location.search.includes("debug=qa");
  const debugEmotion =
    debugTier === "critical"
      ? "Stabilizing"
      : debugTier === "tight"
        ? "Supportive"
        : debugTier === "balanced"
          ? "Momentum-building"
          : "Empowering";
  const debugMessage = showCoachingDebug
    ? getCoachingSuggestion({
        tierKey: debugTier,
        pillarKey: debugPillar,
        direction: debugDirection,
      })
    : null;
  const buildQaContext = (config) => {
    const historyLength = Number(config.history) || 0;
    const volatility = config.volatility;
    const weakestPillar = config.weakestPillar;
    const trendLabel = config.trend;
    const confidence =
      historyLength < 2
        ? "Early Confidence"
        : historyLength < 4
          ? "Growing Confidence"
          : volatility === "low"
            ? "High Confidence"
            : "Growing Confidence";
    const coaching = getCoachingSuggestion({
      tierKey: config.tier,
      pillarKey: weakestPillar,
      direction: trendLabel === "improving" ? "up" : trendLabel === "softening" ? "down" : "flat",
    });
    return {
      confidence,
      coaching,
      reasoning: `history length: ${historyLength}, volatility: ${volatility}, weakest pillar: ${weakestPillar}`,
    };
  };
  const qaScenario = useMemo(() => {
    if (!showQaDebug) return null;
    if (qaMode === "new") {
      return {
        status: "insufficient",
        confidence: null,
        coaching: null,
        milestones: [],
        trend: "Hidden (insufficient data)",
        notes: "No score, no trends, no milestones. Tone should be calm and reassuring.",
      };
    }
    if (qaMode === "chaotic") {
      return {
        status: "ready",
        confidence: { label: "Growing Confidence" },
        coaching: "A few gaps showed up. One completed period in a row rebuilds confidence quickly.",
        milestones: [],
        trend: "Softening",
        notes: "Tone should stay stabilizing and non-judgmental.",
      };
    }
    if (qaMode === "thriving") {
      return {
        status: "ready",
        confidence: { label: "High Confidence" },
        coaching: "Your foundation is strong. Keep momentum steady or increase savings to build long-term power.",
        milestones: [
          {
            key: "tier-thriving",
            title: "Reached Thriving",
            message: "You reached Thriving. Your progress is consistent and strong.",
          },
        ],
        trend: "Improving",
        notes: "Tone should feel proud, grounded, and future-focused.",
      };
    }
    if (qaMode === "streak") {
      return {
        status: "ready",
        confidence: { label: "High Confidence" },
        coaching: "Consistency is strong. Keep the streak to maintain long-term momentum.",
        milestones: [
          {
            key: "stability-streak",
            title: "Stability streak",
            message: "You have stayed engaged for three periods. Consistency is building strength.",
          },
          {
            key: "momentum-streak",
            title: "Momentum streak",
            message: "Your score improved three periods in a row. That is strong momentum.",
          },
        ],
        trend: "Stable",
        notes: "Tone should feel calm, reinforcing, and not repetitive.",
      };
    }
    return null;
  }, [qaMode, showQaDebug]);
  const qaTier = useMemo(
    () => (qaMode === "new" ? "critical" : qaMode === "chaotic" ? "tight" : qaMode === "thriving" ? "traditional" : "balanced"),
    [qaMode]
  );
  const qaContext = useMemo(
    () =>
      buildQaContext({
        tier: qaTier,
        history: qaHistory,
        volatility: qaVolatility,
        weakestPillar: qaWeakestPillar,
        trend: qaTrend,
      }),
    [qaHistory, qaVolatility, qaWeakestPillar, qaTrend, qaTier]
  );
  const qaCompareContext = useMemo(
    () =>
      buildQaContext({
        tier: qaTier,
        history: qaHistory,
        volatility: qaCompareVolatility,
        weakestPillar: qaComparePillar,
        trend: qaCompareTrend,
      }),
    [qaHistory, qaCompareVolatility, qaComparePillar, qaCompareTrend, qaTier]
  );

  return (
    <div className={`score-details-page ${theme === "dark" ? "is-dark" : ""}`}>
      <header className="score-details-header">
        <TopRightControls
          className="top-controls"
          activePage="settings"
          onNavigate={onNavigate}
          logoutHref="/Local/BudgetIQ Login"
        />
        <div className="score-details-hero">
          <div className="eyebrow">Financial Health</div>
          <h1>Score Details</h1>
          <p>See which metrics the OS is modeling and how the score reflects your verified activity.</p>
          <p className="score-hero-note">
            These are deterministic insights derived from your snapshot—never personalized financial advice.
          </p>
        </div>
      </header>

      <main className="score-details-main">
        {scoreReady ? (
          <>
            <section className="score-details-card">
              <div className={`score-details-ring tier-${scoreTier.toLowerCase()}`}>
                <svg viewBox="0 0 140 140" aria-hidden="true">
                  <circle className="score-ring-bg" cx="70" cy="70" r={ring.radius} />
                  <circle
                    className="score-ring-fill"
                    cx="70"
                    cy="70"
                    r={ring.radius}
                    strokeDasharray={ring.circumference}
                    strokeDashoffset={ring.offset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="score-ring-center">
                  <div className="score-value">{scoreValue}</div>
                  <div className="score-out-of">/ 100</div>
                </div>
              </div>
              <div className="score-details-meta">
                <div className="score-label">Financial Health Score</div>
                <div className="score-tier">{scoreTier}</div>
                <div className={`score-trend ${trendValue >= 0 ? "is-up" : "is-down"}`}>
                  {trendValue >= 0 ? `+${trendValue}` : trendValue} this month
                </div>
                <div className="score-note">
                  Updated each period based on budget stability, debt momentum, savings cushion, and consistency.
                </div>
                <div className="score-note-sub">
                  The score models your status; consult your advisor before acting on any large deployments.
                </div>
              </div>
            </section>

            {trendData ? (
              <section className="score-trend-panel">
                <div className="score-trend-header">
                  <div>
                    <h2>Score Trend</h2>
                    <p>Last {trendData.scores.length} periods</p>
                  </div>
                  <div className={`score-trend-direction is-${trendData.direction.toLowerCase().replace(/\s+/g, "-")}`}>
                    {trendData.direction}
                  </div>
                </div>
                <div className="score-trend-chart">
                  <svg viewBox={`0 0 ${trendData.width} ${trendData.height}`} aria-hidden="true">
                    <polyline className="score-trend-line" points={trendData.points} />
                  </svg>
                  <div className="score-trend-dots">
                    {trendData.scores.map((value, index) => (
                      <div
                        key={`${trendData.labels[index]}-${value}`}
                        className="trend-dot"
                        title={`${trendData.labels[index]}: ${value}`}
                      >
                        <div className="trend-dot-value">{value}</div>
                        <div className="trend-dot-label">{trendData.labels[index]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {scoreReady ? (
              <section className="score-predictions-panel">
                <div className="score-predictions-header">
                  <div>
                    <h2>Where You're Headed</h2>
                    <p className="score-predictions-tagline">
                      Based on your recent progress, here is what your financial momentum looks like.
                    </p>
                    <p className="score-predictions-subtitle">{predictionSubtitle}</p>
                    {predictionSummaryText ? (
                      <p className="score-predictions-note">{predictionSummaryText}</p>
                    ) : null}
                  </div>
                  {confidenceHeadlineLabel ? (
                    <div
                      className={`score-predictions-pill confidence-${confidenceHighlight || "low"}`}
                    >
                      <span className="score-predictions-pill-icon">{confidenceEmoji}</span>
                      <span>
                        {confidenceHeadlineLabel} Confidence
                      </span>
                    </div>
                  ) : null}
                </div>
                {hasPredictionCards ? (
                  <div className="prediction-card-grid">
                    {PILLAR_KEYS.map((key) => {
                      const entry = predictionEntries[key];
                      if (!entry) return null;
                      const direction = entry.direction || "stable";
                      const strengthLabel = formatStrengthLabel(entry.strength);
                      const pillarConfidenceTier = getConfidenceTier(entry.confidence);
                      const pillarConfidenceLabel = formatConfidenceLabel(pillarConfidenceTier);
                      const directionCopy = DIRECTION_SUMMARY[direction] || DIRECTION_SUMMARY.stable;
                      const pillarLabel = PILLAR_LABELS[key] || key;
                      const showCardCTA =
                        direction === "softening" && pillarConfidenceTier !== "low";
                      return (
                        <article key={key} className="prediction-card">
                          <div className="prediction-card-top">
                            <div className="prediction-card-title">{pillarLabel}</div>
                            <div className="prediction-card-direction">
                              {DIRECTION_TITLES[direction] || "Steady"}
                            </div>
                          </div>
                          <div className="prediction-card-strength">{strengthLabel} traction</div>
                          <p className="prediction-card-summary">{directionCopy}</p>
                          <div className="prediction-card-confidence">
                            <span className="prediction-card-confidence-icon">
                              {CONFIDENCE_EMOJIS[pillarConfidenceTier]}
                            </span>
                            <span>
                              Confidence: <strong>{pillarConfidenceLabel}</strong> â{" "}
                              {CONFIDENCE_TEXT[pillarConfidenceTier]}
                            </span>
                          </div>
                          {showCardCTA ? (
                            <button type="button" className="prediction-cta" onClick={() => onNavigate("budget")}>
                              Want help staying on track?
                            </button>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="score-predictions-empty">
                    <p>
                      Luna needs a few more verified periods before I can project a confident direction.
                      Keep building the story and Iâll share what comes next.
                    </p>
                  </div>
                )}
              </section>
            ) : null}

            {scoreState.coaching ? (
              <section className="score-coaching-panel">
                <div className="score-coaching-header">
                  <h2>Next Best Step</h2>
                  <span>Guidance for your next period</span>
                </div>
                <p>{scoreState.coaching}</p>
              </section>
            ) : null}

            {scoreState.confidence ? (
              <section className="score-confidence-panel">
                <div className="score-confidence-header">
                  <h2>Confidence</h2>
                  <span>{scoreState.confidence.label}</span>
                </div>
                <p>{scoreState.confidence.detail}</p>
              </section>
            ) : null}

            {scoreState.milestones && scoreState.milestones.length ? (
              <section className="score-milestones-panel">
                <div className="score-milestones-header">
                  <h2>Milestones</h2>
                  <span>Recent wins</span>
                </div>
                <div className="score-milestones-grid">
                  {scoreState.milestones.slice(-3).reverse().map((milestone) => (
                    <div key={milestone.key} className="score-milestone-card">
                      <div className="score-milestone-title">{milestone.title}</div>
                      <div className="score-milestone-message">{milestone.message}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="score-explanations">
              <div className="score-explanations-header">
                <h2>Why Your Score Changed</h2>
                <p>Top drivers from this period with calm, actionable insight.</p>
              </div>
              {explanationSummary ? (
                <div className={`score-explanation-summary tone-${explanationSummary.tone || "neutral"}`}>
                  {explanationSummary.message}
                </div>
              ) : null}
              <div className="score-explanation-grid">
                {explanationItems.length ? (
                  explanationItems.map((item, index) => {
                    const delta = Number.isFinite(item?.delta) ? item.delta : 0;
                    return (
                      <article key={`${item?.key || "explanation"}-${index}`} className={`score-explanation-card tone-${item?.tone || "neutral"}`}>
                        <div className="score-explanation-top">
                          <div className="score-explanation-title">{item?.title || "Score Update"}</div>
                          <div className={`score-explanation-delta ${delta >= 0 ? "is-up" : "is-down"}`}>
                            {delta >= 0 ? `+${delta}` : delta} pts
                          </div>
                        </div>
                        <p>{item?.message || "Your score adjusted based on recent progress."}</p>
                      </article>
                    );
                  })
                ) : explanationSummary ? null : (
                  <div className="score-explanation-empty">
                    No major movement yet â keep going and the story will appear here.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="score-details-empty">
            <h2>Your Financial Health Score isn't ready yet</h2>
            <p>
              Luna needs real financial activity before we can calculate your score. Add your information and begin
              your first budgeting period â once there's meaningful activity, we will build your score for you.
            </p>
            <div className="score-details-checklist">
              <div className="checklist-title">What unlocks your score:</div>
              <ul>
                <li>Add your income</li>
                <li>Track spending and complete a budgeting period</li>
                <li>Add debts or savings if you have them</li>
              </ul>
            </div>
          </section>
        )}

        <section className="score-details-grid">
          <article className="score-details-panel">
            <h2>Budget Stability</h2>
            <p>How consistently your spending stays aligned to your plan each period.</p>
          </article>
          <article className="score-details-panel">
            <h2>Debt Momentum</h2>
            <p>How your payoff trajectory is improving based on balances and extra payments.</p>
          </article>
          <article className="score-details-panel">
            <h2>Savings Cushion</h2>
            <p>How your emergency fund and savings buffer are growing.</p>
          </article>
          <article className="score-details-panel">
            <h2>Consistency / Financial Behavior</h2>
            <p>How reliably you stick with the plan and keep behavior aligned over time.</p>
          </article>
        </section>

        {showCoachingDebug ? (
          <section className="score-debug-panel">
            <div className="score-debug-header">
              <h2>Coaching Debug</h2>
              <span>Preview tier + pillar tone</span>
            </div>
            <div className="score-debug-grid">
              <label>
                Tier
                <select value={debugTier} onChange={(event) => setDebugTier(event.target.value)}>
                  <option value="critical">Critical</option>
                  <option value="tight">Tight</option>
                  <option value="balanced">Balanced</option>
                  <option value="traditional">Thriving</option>
                </select>
              </label>
              <label>
                Weakest pillar
                <select value={debugPillar} onChange={(event) => setDebugPillar(event.target.value)}>
                  <option value="budgetStability">Budget Stability</option>
                  <option value="debtMomentum">Debt Momentum</option>
                  <option value="savingsCushion">Savings Cushion</option>
                  <option value="consistency">Consistency</option>
                </select>
              </label>
              <label>
                Trend direction
                <select value={debugDirection} onChange={(event) => setDebugDirection(event.target.value)}>
                  <option value="up">Improving</option>
                  <option value="flat">Stable</option>
                  <option value="down">Softening</option>
                </select>
              </label>
            </div>
            <div className="score-debug-output">
              <div className="score-debug-emotion">{debugEmotion}</div>
              <div>{debugMessage || "No coaching message available."}</div>
            </div>
          </section>
        ) : null}

        {showQaDebug ? (
          <section className="score-debug-panel score-qa-panel">
            <div className="score-debug-header">
              <h2>QA Simulator</h2>
              <span>Preview emotional states</span>
            </div>
            <div className="score-debug-grid">
              <label>
                Scenario
                <select value={qaMode} onChange={(event) => setQaMode(event.target.value)}>
                  <option value="new">Brand new user</option>
                  <option value="chaotic">Inconsistent / chaotic</option>
                  <option value="thriving">Thriving entry</option>
                  <option value="streak">Long-streak stable</option>
                </select>
              </label>
              <label>
                History length
                <select value={qaHistory} onChange={(event) => setQaHistory(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 9, 12].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Volatility
                <select value={qaVolatility} onChange={(event) => setQaVolatility(event.target.value)}>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                Weakest pillar
                <select value={qaWeakestPillar} onChange={(event) => setQaWeakestPillar(event.target.value)}>
                  <option value="budgetStability">Budget Stability</option>
                  <option value="debtMomentum">Debt Momentum</option>
                  <option value="savingsCushion">Savings Cushion</option>
                  <option value="consistency">Consistency</option>
                </select>
              </label>
              <label>
                Trend
                <select value={qaTrend} onChange={(event) => setQaTrend(event.target.value)}>
                  <option value="improving">Improving</option>
                  <option value="stable">Stable</option>
                  <option value="softening">Softening</option>
                </select>
              </label>
            </div>
            <div className="score-debug-output">
              <div className="score-debug-emotion">{qaScenario?.status === "ready" ? "Active" : "Locked"}</div>
              <div>{qaScenario?.notes}</div>
            </div>
            <div className="score-qa-context">
              <div>
                <strong>Reasoning:</strong> {qaContext.reasoning}
              </div>
              <div>
                <strong>Confidence:</strong> {qaContext.confidence}
              </div>
              <div>
                <strong>Coaching:</strong> {qaContext.coaching || "None"}
              </div>
            </div>
            <div className="score-qa-grid">
              <div>
                <strong>Confidence:</strong> {qaScenario?.confidence?.label || "Hidden"}
              </div>
              <div>
                <strong>Trend:</strong> {qaScenario?.trend}
              </div>
              <div>
                <strong>Coaching:</strong> {qaScenario?.coaching || "None"}
              </div>
              <div>
                <strong>Milestones:</strong>{" "}
                {qaScenario?.milestones?.length
                  ? qaScenario.milestones.map((milestone) => milestone.title).join(", ")
                  : "None"}
              </div>
            </div>
            <div className="score-qa-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  const pillars = ["budgetStability", "debtMomentum", "savingsCushion", "consistency"];
                  const trends = ["improving", "stable", "softening"];
                  const vols = ["low", "moderate", "high"];
                  setQaWeakestPillar(pillars[Math.floor(Math.random() * pillars.length)]);
                  setQaTrend(trends[Math.floor(Math.random() * trends.length)]);
                  setQaVolatility(vols[Math.floor(Math.random() * vols.length)]);
                  setQaHistory([1, 2, 3, 4, 5, 6, 9, 12][Math.floor(Math.random() * 8)]);
                }}
              >
                Randomize state
              </button>
              <label className="score-qa-toggle">
                <input type="checkbox" checked={qaCompare} onChange={(e) => setQaCompare(e.target.checked)} />
                Contrast mode
              </label>
            </div>
            {qaCompare ? (
              <div className="score-qa-compare">
                <div className="score-qa-compare-controls">
                  <label>
                    Volatility
                    <select value={qaCompareVolatility} onChange={(event) => setQaCompareVolatility(event.target.value)}>
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label>
                    Weakest pillar
                    <select value={qaComparePillar} onChange={(event) => setQaComparePillar(event.target.value)}>
                      <option value="budgetStability">Budget Stability</option>
                      <option value="debtMomentum">Debt Momentum</option>
                      <option value="savingsCushion">Savings Cushion</option>
                      <option value="consistency">Consistency</option>
                    </select>
                  </label>
                  <label>
                    Trend
                    <select value={qaCompareTrend} onChange={(event) => setQaCompareTrend(event.target.value)}>
                      <option value="improving">Improving</option>
                      <option value="stable">Stable</option>
                      <option value="softening">Softening</option>
                    </select>
                  </label>
                </div>
                <div className="score-qa-compare-output">
                  <div>
                    <strong>Reasoning:</strong> {qaCompareContext.reasoning}
                  </div>
                  <div>
                    <strong>Confidence:</strong> {qaCompareContext.confidence}
                  </div>
                  <div>
                    <strong>Coaching:</strong> {qaCompareContext.coaching || "None"}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <p className="helper-note score-details-disclaimer">
          Your financial health score is a deterministic snapshot modeled by the OS. Billing identity stays in a separate silo and links to the encrypted vault only via the blind UUID you control, and every export, sync, or purge is logged for compliance.
        </p>

        <div className="score-details-footer">
          <button type="button" className="secondary-btn" onClick={() => onNavigate("dashboard")}>
            Back to dashboard
          </button>
        </div>
      </main>
    </div>
  );
};

export default ScoreDetails;

