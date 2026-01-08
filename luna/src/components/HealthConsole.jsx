import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPeriodRange } from "../utils/budgetPeriod";
import { getStoredVersion } from "../utils/storageManager";
import { buildKey, readNamespacedItem } from "../utils/userStorage";
import "./HealthConsole.css";

const MAX_ENTRIES = 50;
const HEALTH_KEYS = [
  "moneyProfile",
  "liveBudgetTransactions",
  "financialHealthScore",
  "debtPlanType",
  "dashboardHiddenCards",
];
const PERIOD_PREFIXES = ["periodHistory_", "periodHistoryIndex_"];
const EVENTS = [
  "profile-updated",
  "live-budget-updated",
  "health-score-updated",
  "debt-cash-updated",
  "credit-cards-updated",
  "auth-updated",
  "storage-collision",
];

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const safeParse = (value) => {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

const isWatchedKey = (key) => {
  if (!key) return false;
  const matchesBase = (base) => key === base || key.endsWith(`_${base}`);
  if (HEALTH_KEYS.some(matchesBase)) return true;
  return PERIOD_PREFIXES.some((prefix) => key.startsWith(prefix));
};

const formatAmount = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toFixed(2);
};

const diffSummary = (prev, next) => {
  if (Array.isArray(prev) || Array.isArray(next)) {
    const prevLen = Array.isArray(prev) ? prev.length : 0;
    const nextLen = Array.isArray(next) ? next.length : 0;
    if (prevLen === nextLen) return "array length unchanged";
    return `array length ${prevLen} -> ${nextLen}`;
  }
  if (isObject(prev) && isObject(next)) {
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    const changed = [];
    keys.forEach((key) => {
      if (prev[key] !== next[key]) changed.push(key);
    });
    if (!changed.length) return "no object changes";
    return `changed keys: ${changed.slice(0, 12).join(", ")}${changed.length > 12 ? "..." : ""}`;
  }
  if (prev === next) return "no change";
  return `${String(prev)} -> ${String(next)}`;
};

const buildSnapshot = () => {
  if (typeof window === "undefined") {
    return {
      periodKey: "n/a",
      profile: { incomes: 0, expenses: 0, incomeTotal: "0.00", expenseTotal: "0.00" },
      transactions: { total: 0, personal: 0, business: 0 },
      score: { status: "n/a", score: "--" },
      debtPlan: "n/a",
      hiddenCards: 0,
    };
  }

  const profileRaw = readNamespacedItem("moneyProfile");
  const profile = safeParse(profileRaw) || {};
  const profileVersion = getStoredVersion(buildKey("moneyProfile"), profile);
  const incomes = Array.isArray(profile.incomes) ? profile.incomes : [];
  const expenses = Array.isArray(profile.expenses) ? profile.expenses : [];
  const incomeTotal = incomes.reduce(
    (sum, item) => sum + (Number(item?.monthly ?? item?.amount ?? 0) || 0),
    0
  );
  const expenseTotal = expenses.reduce(
    (sum, item) => sum + (Number(item?.monthly ?? item?.amount ?? 0) || 0),
    0
  );

  const transactionsRaw = readNamespacedItem("liveBudgetTransactions");
  const transactions = safeParse(transactionsRaw) || [];
  const transactionsVersion = getStoredVersion(buildKey("liveBudgetTransactions"), transactions);
  const txList = Array.isArray(transactions) ? transactions : [];
  const personalCount = txList.filter(
    (t) => (t?.type === "income" ? t?.incomeType : t?.expenseType) !== "business"
  ).length;
  const businessCount = txList.length - personalCount;

  const preferences = safeParse(localStorage.getItem("lunaPreferences")) || {};
  const period = getPeriodRange(preferences, txList);

  const score = safeParse(readNamespacedItem("financialHealthScore")) || {};
  const scoreValue = Number.isFinite(score?.score) ? score.score : "--";

  const debtPlan = readNamespacedItem("debtPlanType") || "snowball";
  const hiddenCards = safeParse(readNamespacedItem("dashboardHiddenCards")) || [];

  return {
    periodKey: period?.key || "no-period",
    profile: {
      incomes: incomes.length,
      expenses: expenses.length,
      incomeTotal: formatAmount(incomeTotal),
      expenseTotal: formatAmount(expenseTotal),
      version: profileVersion,
    },
    transactions: {
      total: txList.length,
      personal: personalCount,
      business: businessCount,
      version: transactionsVersion,
    },
    score: {
      status: score?.status || "unknown",
      score: scoreValue,
    },
    debtPlan,
    hiddenCards: Array.isArray(hiddenCards) ? hiddenCards.length : 0,
  };
};

const formatLogData = (value) => {
  if (value === null || value === undefined) return "";
  try {
    const text = JSON.stringify(value, null, 2);
    if (text.length > 1200) return `${text.slice(0, 1200)}...`;
    return text;
  } catch (e) {
    return String(value);
  }
};

const POSITION_KEY = "healthConsolePosition";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const readPosition = () => {
  if (typeof window === "undefined") return { x: null, y: null };
  try {
    const stored = localStorage.getItem(POSITION_KEY);
    if (!stored) return { x: null, y: null, dock: "br" };
    const parsed = JSON.parse(stored);
    const x = Number(parsed?.x);
    const y = Number(parsed?.y);
    const dock = typeof parsed?.dock === "string" ? parsed.dock : null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { x: null, y: null, dock: dock || "br" };
    }
    return { x, y, dock };
  } catch (e) {
    return { x: null, y: null, dock: "br" };
  }
};

const writePosition = (pos) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
  } catch (e) {
    /* ignore */
  }
};

const TRACE_LIMIT = 3;
const TRACE_THROTTLE_MS = 1500;

const HealthConsole = ({ enabled = false, debugEnabled = false }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [entries, setEntries] = useState([]);
  const [snapshot, setSnapshot] = useState(() => buildSnapshot());
  const [traceEntries, setTraceEntries] = useState([]);
  const [position, setPosition] = useState(() => readPosition());
  const [dragging, setDragging] = useState(false);
  const logRef = useRef(null);
  const panelRef = useRef(null);
  const originalsRef = useRef(null);
  const dragStateRef = useRef(null);
  const lastTraceAtRef = useRef(0);

  const pushEntry = (entry) => {
    setEntries((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
    });
  };

  const recordTrace = ({ key, prevValue, nextValue, source }) => {
    if (key !== "liveBudgetTransactions") return;
    const now = Date.now();
    if (now - lastTraceAtRef.current < TRACE_THROTTLE_MS) return;
    lastTraceAtRef.current = now;

    const prevLen = Array.isArray(prevValue) ? prevValue.length : null;
    const nextLen = Array.isArray(nextValue) ? nextValue.length : null;
    const isWipe = prevLen && nextLen === 0;
    const trace = new Error("liveBudgetTransactions write").stack || "";
    const context = {
      periodKey: snapshot?.periodKey || "unknown",
      previousLength: prevLen,
      nextLength: nextLen,
      wipeDetected: Boolean(isWipe),
      source,
    };

    setTraceEntries((prev) => {
      const next = [
        {
          id: `${now}-${Math.random().toString(16).slice(2)}`,
          time: new Date(),
          trace,
          context,
        },
        ...prev,
      ];
      return next.slice(0, TRACE_LIMIT);
    });
  };

  const handleStorageChange = ({ key, prevValue, nextValue, source }) => {
    if (!isWatchedKey(key)) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "storage",
      key,
      source,
      time: new Date(),
      diff: diffSummary(prevValue, nextValue),
      data: nextValue,
    };
    pushEntry(entry);
    setSnapshot(buildSnapshot());
    recordTrace({ key, prevValue, nextValue, source });
  };

  const handleEvent = (name) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "event",
      key: name,
      source: "this tab",
      time: new Date(),
      diff: "",
      data: null,
    };
    pushEntry(entry);
    setSnapshot(buildSnapshot());
  };

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    setSnapshot(buildSnapshot());

    const originalLocalSet = localStorage.setItem.bind(localStorage);
    const originalLocalRemove = localStorage.removeItem.bind(localStorage);
    const originalSessionSet = sessionStorage.setItem.bind(sessionStorage);
    const originalSessionRemove = sessionStorage.removeItem.bind(sessionStorage);

    originalsRef.current = {
      localSet: originalLocalSet,
      localRemove: originalLocalRemove,
      sessionSet: originalSessionSet,
      sessionRemove: originalSessionRemove,
    };

    localStorage.setItem = (key, value) => {
      const prev = safeParse(localStorage.getItem(key));
      const result = originalLocalSet(key, value);
      handleStorageChange({
        key,
        prevValue: prev,
        nextValue: safeParse(value),
        source: "local (this tab)",
      });
      return result;
    };

    localStorage.removeItem = (key) => {
      const prev = safeParse(localStorage.getItem(key));
      const result = originalLocalRemove(key);
      handleStorageChange({
        key,
        prevValue: prev,
        nextValue: null,
        source: "local (this tab)",
      });
      return result;
    };

    sessionStorage.setItem = (key, value) => {
      const prev = safeParse(sessionStorage.getItem(key));
      const result = originalSessionSet(key, value);
      handleStorageChange({
        key,
        prevValue: prev,
        nextValue: safeParse(value),
        source: "session (this tab)",
      });
      return result;
    };

    sessionStorage.removeItem = (key) => {
      const prev = safeParse(sessionStorage.getItem(key));
      const result = originalSessionRemove(key);
      handleStorageChange({
        key,
        prevValue: prev,
        nextValue: null,
        source: "session (this tab)",
      });
      return result;
    };

    const handleStorageEvent = (event) => {
      if (!event.key) return;
      handleStorageChange({
        key: event.key,
        prevValue: safeParse(event.oldValue),
        nextValue: safeParse(event.newValue),
        source: "storage (other tab)",
      });
    };

    window.addEventListener("storage", handleStorageEvent);
    const eventHandlers = EVENTS.map((evt) => {
      const handler = () => handleEvent(evt);
      window.addEventListener(evt, handler);
      return { evt, handler };
    });

    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      eventHandlers.forEach(({ evt, handler }) => window.removeEventListener(evt, handler));
      if (originalsRef.current) {
        localStorage.setItem = originalsRef.current.localSet;
        localStorage.removeItem = originalsRef.current.localRemove;
        sessionStorage.setItem = originalsRef.current.sessionSet;
        sessionStorage.removeItem = originalsRef.current.sessionRemove;
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!debugEnabled) {
      setTraceEntries([]);
    }
  }, [debugEnabled]);

  useEffect(() => {
    if (!enabled || !dragging) return undefined;
    const handleMove = (event) => {
      if (!dragStateRef.current || !panelRef.current) return;
      const { offsetX, offsetY } = dragStateRef.current;
      const width = panelRef.current.offsetWidth;
      const height = panelRef.current.offsetHeight;
      const maxX = window.innerWidth - width - 8;
      const maxY = window.innerHeight - height - 8;
      const nextX = clamp(event.clientX - offsetX, 8, Math.max(8, maxX));
      const nextY = clamp(event.clientY - offsetY, 8, Math.max(8, maxY));
      setPosition({ x: nextX, y: nextY });
    };
    const handleUp = () => {
      if (panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        const width = panelRef.current.offsetWidth;
        const height = panelRef.current.offsetHeight;
        const maxX = window.innerWidth - width - 8;
        const maxY = window.innerHeight - height - 8;
        const snapThreshold = 24;
        const nextX = clamp(rect.left, 8, Math.max(8, maxX));
        const nextY = clamp(rect.top, 8, Math.max(8, maxY));
        const nearLeft = nextX <= 8 + snapThreshold;
        const nearRight = nextX >= maxX - snapThreshold;
        const nearTop = nextY <= 8 + snapThreshold;
        const nearBottom = nextY >= maxY - snapThreshold;
        if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
          const dock =
            nearTop && nearLeft
              ? "tl"
              : nearTop && nearRight
                ? "tr"
                : nearBottom && nearLeft
                  ? "bl"
                  : "br";
          setPosition({ x: null, y: null, dock });
        } else {
          setPosition({ x: nextX, y: nextY, dock: null });
        }
      }
      setDragging(false);
      dragStateRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [enabled, dragging]);

  useEffect(() => {
    writePosition(position);
  }, [position]);

  useEffect(() => {
    if (!enabled) return undefined;
    const clampPosition = () => {
      if (!panelRef.current || position?.dock) return;
      if (position?.x == null || position?.y == null) return;
      const width = panelRef.current.offsetWidth;
      const height = panelRef.current.offsetHeight;
      const maxX = window.innerWidth - width - 8;
      const maxY = window.innerHeight - height - 8;
      const nextX = clamp(position.x, 8, Math.max(8, maxX));
      const nextY = clamp(position.y, 8, Math.max(8, maxY));
      if (nextX !== position.x || nextY !== position.y) {
        setPosition({ x: nextX, y: nextY, dock: null });
      }
    };
    clampPosition();
    window.addEventListener("resize", clampPosition);
    return () => window.removeEventListener("resize", clampPosition);
  }, [enabled, position]);

  useEffect(() => {
    if (collapsed) return;
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [collapsed, entries]);

  const copyLogs = async () => {
    const text = entries
      .map((entry) => {
        const time = entry.time.toLocaleTimeString();
        const header = `[${entry.type}] ${entry.key} @ ${time} (${entry.source})`;
        const diff = entry.diff ? `diff: ${entry.diff}` : "";
        const data = entry.data ? `data: ${formatLogData(entry.data)}` : "";
        return [header, diff, data].filter(Boolean).join("\n");
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      handleEvent("log-copied");
    } catch (e) {
      handleEvent("copy-failed");
    }
  };

  const clearLogs = () => setEntries([]);

  const resetPosition = () => {
    setPosition({ x: null, y: null, dock: "br" });
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(POSITION_KEY);
      } catch (e) {
        /* ignore */
      }
    }
  };

  const snapshotRows = useMemo(
    () => [
      { label: "Period key", value: snapshot.periodKey },
      {
        label: "Profile incomes",
        value: `${snapshot.profile.incomes} ($${snapshot.profile.incomeTotal}) v${snapshot.profile.version || 1}`,
      },
      {
        label: "Profile expenses",
        value: `${snapshot.profile.expenses} ($${snapshot.profile.expenseTotal})`,
      },
      {
        label: "Live transactions",
        value: `${snapshot.transactions.total} (P${snapshot.transactions.personal} / B${snapshot.transactions.business}) v${snapshot.transactions.version || 1}`,
      },
      { label: "Score", value: `${snapshot.score.status} ${snapshot.score.score}` },
      { label: "Debt plan", value: snapshot.debtPlan },
      { label: "Hidden cards", value: `${snapshot.hiddenCards}` },
    ],
    [snapshot]
  );

  if (!enabled) return null;

  return (
    <div
      ref={panelRef}
      className={`health-console ${collapsed ? "is-collapsed" : ""} ${dragging ? "is-dragging" : ""}`}
      style={
        position?.dock
          ? {
              left: position.dock.includes("l") ? 8 : "auto",
              right: position.dock.includes("r") ? 8 : "auto",
              top: position.dock.includes("t") ? 8 : "auto",
              bottom: position.dock.includes("b") ? 8 : "auto",
            }
          : position?.x != null && position?.y != null
            ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
            : undefined
      }
    >
      <div
        className="health-console-header"
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          if (!panelRef.current) return;
          const rect = panelRef.current.getBoundingClientRect();
          dragStateRef.current = {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
          };
          setPosition((prev) => ({ x: rect.left, y: rect.top, dock: null }));
          setDragging(true);
        }}
      >
        <div className="health-console-title">Health Console</div>
        <div className="health-console-actions">
          <button type="button" className="health-console-btn" onClick={copyLogs}>
            Copy
          </button>
          <button type="button" className="health-console-btn" onClick={clearLogs}>
            Clear
          </button>
          <button
            type="button"
            className="health-console-btn"
            onClick={resetPosition}
          >
            Reset now
          </button>
          <button
            type="button"
            className="health-console-btn"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>
      {!collapsed && (
        <>
          <div className="health-console-snapshot">
            {snapshotRows.map((row) => (
              <div key={row.label} className="health-console-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
            <div className="health-console-reset-note">
              Reset automatically if out of bounds.
            </div>
            {debugEnabled && traceEntries.length > 0 && (
              <div className="health-console-traces">
                <div className="health-console-trace-title">Recent traces</div>
                {traceEntries.map((trace) => (
                  <div key={trace.id} className="health-console-trace">
                    <div className="health-console-trace-head">
                      [trace] liveBudgetTransactions @ {trace.time.toLocaleTimeString()}
                    </div>
                    <div className="health-console-trace-meta">
                      {trace.context.source} | period: {trace.context.periodKey} | prev: {trace.context.previousLength} | next: {trace.context.nextLength}
                    </div>
                    <pre className="health-console-trace-stack">{trace.trace}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="health-console-log" ref={logRef}>
            {entries.length === 0 ? (
              <div className="health-console-empty">Waiting for events...</div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className={`health-console-entry ${entry.type}`}>
                  <div className="health-console-entry-head">
                    <span className="health-console-entry-label">
                      [{entry.type}] {entry.key}
                    </span>
                    <span className="health-console-entry-time">
                      {entry.time.toLocaleTimeString()} | {entry.source}
                    </span>
                  </div>
                  {entry.diff && <div className="health-console-diff">diff: {entry.diff}</div>}
                  {entry.data !== null && entry.data !== undefined && (
                    <pre className="health-console-data">{formatLogData(entry.data)}</pre>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HealthConsole;
