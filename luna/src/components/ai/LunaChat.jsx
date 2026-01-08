import React, { useEffect, useMemo, useState } from "react";
import { storageManager } from "../../utils/storageManager";
import { buildKey } from "../../utils/userStorage";
import PrivacyNut from "../PrivacyNut";
import "./LunaChat.css";

const QUICK_ACTIONS = [
  { label: "How am I doing?", prompt: "Show me the latest insight based on verified activity." },
  { label: "Help me save", prompt: "Model how to increase cash saved this month." },
  { label: "Can I buy coffee?", prompt: "Model whether a $12 purchase fits this cycle." },
];

const INSIGHT_STORAGE_KEY = "lunaChatIsOpen";

const getLunaResponse = (input = "", health = {}) => {
  const text = input.toLowerCase();
  const score = health?.score || 0;
  const verifiedCount = health?.verifiedCount || 0;
  const liquidityLabel = health?.pillars?.liquidity?.label || "steady";

  if (verifiedCount === 0) {
    return "Hey! My dashboard is still quiet. Once you verify a few transactions in the explorer, I can give you the real inside scoop.";
  }

  if (verifiedCount < 5) {
    return "I don't yet have enough verified history to respond confidently. Verify a few more transactions and I'll bring the numbers you can trust.";
  }

  if (text.includes("hi") || text.includes("hello") || text.includes("hey")) {
    if (score > 80) {
      return `Hi! You're killing it—score ${score} is impressive. Anything you want to optimize today?`;
    }
    return `Hey there! We're steady at ${score}, and ${liquidityLabel} liquidity means there's room to breathe. Want some ideas?`;
  }

  if (text.includes("afford") || text.includes("buy")) {
    return "Great question. Since I only read your verified activity, let's open your Adherence pillar together and see how a purchase affects the plan.";
  }

  return `I'm modeling your ${liquidityLabel.toLowerCase()} liquidity and ${score} score to keep the insights aligned with the data. What's on your mind?`;
};

const generateMockResponse = (question = "", health = {}, profile = {}) => {
  const score = health?.score ?? "--";
  const trend = health?.trend ?? 0;
  const liquidity = Math.round(health?.pillarInsights?.liquidity?.score || 0);
  const verifiedCount = health?.verifiedCount || 0;

  if (/afford|buy/i.test(question)) {
    if (liquidity >= 70) {
      return "You have a healthy buffer right now. That purchase keeps you above the 3-month cushion, so it looks doable without disturbing the plan.";
    }
    if (liquidity >= 40) {
      return 'You can afford it, but it dips liquidity below "strong." Maybe pause until the next income pulse to keep the trend steady.';
    }
    return "Hold off for now. Liquidity is still building and that purchase would stretch the verified runway.";
  }

  if (/score|trend|change|why/i.test(question)) {
    const direction = trend >= 3 ? "upward" : trend <= -3 ? "downward" : "steady";
    return `Score ${score} is ${direction}. Verified data (${verifiedCount} txns) keeps me honest. Focused wins in liquidity or savings will tip it upward.`;
  }

  if (/liquidity|buffer|months/i.test(question)) {
    return `Liquidity is ${liquidity}/100 and ${health?.pillarInsights?.liquidity?.label || "steady"} buffer status. Keep building that cushion and you're golden.`;
  }

  return getLunaResponse(question, health);
};

const getTopExpenseCategory = (profile = {}) => {
  const buckets = new Map();
  (profile.expenses || []).forEach((entry) => {
    const key = (entry.category || entry.name || "Other").trim();
    if (!key) return;
    buckets.set(key, (buckets.get(key) || 0) + Number(entry.amount || 0));
  });
  let winner = null;
  buckets.forEach((value, key) => {
    if (!winner || value > winner.value) {
      winner = { key, value };
    }
  });
  return winner ? `${winner.key} ($${Math.round(Math.abs(winner.value))})` : "No spend yet";
};

const buildContextHeader = (health = {}, profile = {}) => {
  const liquidity = Math.round(health?.pillarInsights?.liquidity?.score || 0);
  const savings = Math.round(health?.pillarInsights?.savingsRate?.score || 0);
  const verified = health?.verifiedCount || 0;
  const status = health?.statusDetail || "Score not ready yet";
  const topCategory = getTopExpenseCategory(profile);
  return `Liquidity ${liquidity}/100 - Savings ${savings}/100 - Verified ${verified} txns - Focus: ${topCategory} - ${status}`;
};

const LunaChat = () => {
  const healthData = storageManager.get(buildKey("financialHealthScore")) || {};
  const profile = storageManager.get(buildKey("moneyProfile")) || {};
  const contextString = useMemo(() => buildContextHeader(healthData, profile), [healthData, profile]);
  const hasContextualPulse = useMemo(
    () => (healthData?.verifiedCount || 0) >= 5 && Boolean(contextString),
    [healthData, contextString]
  );
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(INSIGHT_STORAGE_KEY) === "true";
  });
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);

  useEffect(() => {
    if (tooltipDismissed) return undefined;
    const timer = setTimeout(() => setTooltipDismissed(true), 6500);
    return () => clearTimeout(timer);
  }, [tooltipDismissed]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.localStorage.setItem(INSIGHT_STORAGE_KEY, isOpen ? "true" : "false");
    return undefined;
  }, [isOpen]);

  const openSecurityPage = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("luna-navigate", { detail: { view: "security" } }));
  };

  const sendMessage = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setThinking(true);
    setQuickActionsVisible(true);
    window.setTimeout(() => {
      const reply = generateMockResponse(trimmed, healthData, profile);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      setThinking(false);
    }, 600);
  };

  const handleQuickAction = (prompt) => {
    setQuickActionsVisible(true);
    sendMessage(prompt);
  };
  const openChat = () => setIsOpen(true);
  const closeChat = () => setIsOpen(false);
  const statusBadge = useMemo(() => {
    const liquidity = Math.round(healthData?.pillarInsights?.liquidity?.score || 0);
    const scoreValue = Math.round(healthData?.score || 0);
    const status = healthData?.statusDetail || "Score not ready yet";
    if (!hasContextualPulse) {
      return "Verify a handful of transactions to unlock contextual insights.";
    }
    return `Activity Score ${scoreValue} - Liquidity ${liquidity}/100 - ${status}`;
  }, [healthData, hasContextualPulse]);
  const handleInputFocus = () => setQuickActionsVisible(true);
  const legalTooltip =
    "Deterministic insights modeled from verified activity. These comments are descriptive, not personalized financial advice.";

  return (
    <div className={`luna-chat-shell ${isOpen ? "is-open" : "is-collapsed"}`}>
      {!isOpen && (
        <button type="button" className="luna-chat-tab" onClick={openChat} aria-label="Open Luna AI">
          <span className="luna-chat-tab-icon" aria-hidden="true">
            +
          </span>
          <span className="luna-chat-tab-label">Luna AI</span>
        </button>
      )}
      {isOpen && (
        <section className="luna-chat-widget" aria-live="polite">
          <div className="chat-panel">
            <header className="chat-header">
              <button
                type="button"
                className="chat-minimize"
                onClick={closeChat}
                aria-label="Minimize Luna chat"
              >
                <span aria-hidden="true">−</span>
              </button>
              <div className="chat-header-main">
                <div className="chat-status-badge" aria-live="polite">
                  {statusBadge}
                </div>
                <h3 className="chat-title">
                  Luna AI
                  <span className="chat-title-subtext">
                    Contextual insights share calm summaries of your verified activity.
                    <span className="chat-legal-link" title={legalTooltip}>
                      Deterministic observations, not personalized advice.
                    </span>
                  </span>
                </h3>
                {hasContextualPulse && !tooltipDismissed && (
                  <div className="chat-tooltip" role="status">
                    Insights here stay grounded in your real numbers.
                  </div>
                )}
              </div>
              <div className="chat-header-actions">
                <PrivacyNut message="Luna only sees your Health Score—never your password." />
              </div>
            </header>
            <div className="chat-context">
              <p>{contextString}</p>
            </div>
            <div className="chat-messages" role="log">
              {messages.map((entry, index) => (
                <article key={`${entry.role}-${index}`} className={`chat-message chat-message-${entry.role}`}>
                  <p>{entry.text}</p>
                </article>
              ))}
              {thinking && (
                <div className="chat-typing" role="status" aria-live="polite">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span className="typing-label">Thinking...</span>
                </div>
              )}
            </div>
            {quickActionsVisible && (
              <div className="chat-actions">
                {QUICK_ACTIONS.map((action) => (
                  <button type="button" key={action.label} className="chat-quick-action" onClick={() => handleQuickAction(action.prompt)}>
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            <footer className="chat-footer">
              <input
                placeholder="Ask Luna..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onFocus={handleInputFocus}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    sendMessage(input);
                  }
                }}
              />
              <button type="button" onClick={() => sendMessage(input)} className="chat-send">
                Send
              </button>
            </footer>
            <div className="chat-footer-meta">
              <button
                type="button"
                className="chat-footer-link"
                onClick={openSecurityPage}
                title={legalTooltip}
              >
                Security &amp; Privacy
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default LunaChat;
