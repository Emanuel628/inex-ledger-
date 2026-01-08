import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { guidanceEngine } from "../../../gps/guidanceEngine";
import {
  acknowledgeNotification,
  getNotifications,
  getUnreadCount,
  onNotificationStoreUpdate,
  removeNotification,
} from "../lib/notificationStore";
import { getPlanHistory } from "../lib/payPeriodPlannerStore";
import { usePreferences } from "../contexts/PreferencesContext";
import "./NotificationBell.css";

const formatTimestamp = (value) => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "";
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatDateRange = (start, end) => {
  if (!start || !end) return "";
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "";
    const startLabel = startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endLabel = endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${startLabel} - ${endLabel}`;
  } catch {
    return "";
  }
};

const formatCurrencyValue = (value, currency = "USD") => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const TIER_REASSURANCE = {
  critical: "Critical tier means we're steadying essentials and guarding what matters most.",
  fragile: "Fragile isn't failure; it's a signal to keep the buffer growing with gentle habits.",
  steady: "Steady tier keeps things calm while you protect the cushion you built.",
  thriving: "Thriving means momentum can expand without ever losing the cushion.",
};

const NOTIFICATION_SEEN_PREFIX = "notificationSeen_";

const normalizeTier = (tier) => {
  if (!tier) return "fragile";
  if (tier === "steady") return "balanced";
  return tier;
};

const buildNotificationGuidance = (notification, plan, tier) => {
  const snapshot = plan?.snapshot;
  const essentials = plan?.recommendation?.essentials || 0;
  const bufferMonths =
    snapshot?.bufferCurrent && essentials > 0 ? snapshot.bufferCurrent / essentials : 0;
  const projectedLeftover =
    notification.payload?.projectedLeftover ??
    snapshot?.leftoverProjected ??
    notification.payload?.supportiveLine ??
    0;
  const driftFlag =
    notification.type === "DRIFT_ALERT" ||
    snapshot?.driftSignal === "down" ||
    Boolean(notification.payload?.driftMagnitude);
  const improvements = notification.type === "PAY_PERIOD_PLAN" || notification.type === "TIER_CHANGE";
  return guidanceEngine({
    tier: normalizeTier(tier),
    bufferMonths,
    leftoverTrend: projectedLeftover >= 0 ? 1 : -1,
    driftFlag,
    improvements,
    timeInTierDays: 0,
    context: {
      periodStart: plan?.period.start || notification.payload?.periodStart,
      periodEnd: plan?.period.end || notification.payload?.periodEnd,
    },
  });
};

const NotificationBell = ({ onNavigate = () => {} }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());
  const [notifications, setNotifications] = useState(() => getNotifications());
  const planHistory = useMemo(() => getPlanHistory(), [notifications]);
  const { preferences } = usePreferences();
  const seenCache = useRef({});
  const notificationLevel = preferences.notificationLevel || "normal";

  const loadSeenSet = useCallback((periodKey) => {
    if (!periodKey) return null;
    if (seenCache.current[periodKey]) {
      return seenCache.current[periodKey];
    }
      const set = new Set();
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(`${NOTIFICATION_SEEN_PREFIX}${periodKey}`);
        if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach((entry) => {
              if (typeof entry === "string") {
                set.add(entry);
              }
            });
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    seenCache.current[periodKey] = set;
    return set;
  }, []);

  const persistSeenSet = useCallback((periodKey, set) => {
    if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(`${NOTIFICATION_SEEN_PREFIX}${periodKey}`, JSON.stringify(Array.from(set)));
    } catch {
      // ignore
    }
  }, []);

  const shouldRenderGuidance = useCallback(
    (guidance) => {
      if (!guidance) return false;
      if (guidance.suppressed) return false;
      if (notificationLevel === "off") return false;
      if (notificationLevel === "important_only" && guidance.tone === "inspired") return false;
      const periodKey = guidance.periodKey;
      const guidanceHash = guidance.guidanceHash;
      if (!periodKey || !guidanceHash) return true;
      const seen = loadSeenSet(periodKey);
      if (seen.has(guidanceHash)) {
        return false;
      }
      seen.add(guidanceHash);
      persistSeenSet(periodKey, seen);
      return true;
    },
    [loadSeenSet, persistSeenSet, notificationLevel]
  );

  useEffect(() => {
    const handleUpdate = () => {
      setUnreadCount(getUnreadCount());
      setNotifications(getNotifications());
    };
    const unsubscribe = onNotificationStoreUpdate(handleUpdate);
    return unsubscribe;
  }, []);

  const toggleDrawer = () => setDrawerOpen((open) => !open);
  const closeDrawer = () => setDrawerOpen(false);
  const handleAcknowledge = (id) => {
    acknowledgeNotification(id);
  };
  const handlePlanView = (notification) => {
    if (notification.payload?.planId) {
      onNavigate("split-gps");
      acknowledgeNotification(notification.id);
      setDrawerOpen(false);
    }
  };

  const unreadLabel = unreadCount > 1 ? `${unreadCount} new updates` : unreadCount === 1 ? "1 new update" : "No new updates";

  const badgeClass = (tier) => {
    const normalized = tier ? tier.toLowerCase() : "neutral";
    return `notification-item__tier-badge notification-item__tier-badge--${normalized}`;
  };

  return (
    <>
      <button
        type="button"
        className={`notification-bell ${drawerOpen ? "notification-bell--active" : ""}`}
        onClick={toggleDrawer}
        aria-label={`Open notifications (${unreadLabel})`}
        aria-expanded={drawerOpen}
      >
        <svg
          className="notification-bell__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M12 3a4 4 0 0 1 4 4v1.1c0 .7.2 1.4.6 2l.8 1.3c.4.7.6 1.4.6 2.1v.5H6v-.5c0-.7.2-1.4.6-2.1l.8-1.3c.4-.6.6-1.3.6-2V7a4 4 0 0 1 4-4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 19a2 2 0 0 0 4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && <span className="notification-bell__dot" />}
      </button>
      {drawerOpen && (
        <>
          <div className="notification-drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />
          <aside className="notification-drawer" role="dialog" aria-modal="true">
            <header className="notification-drawer__header">
              <div>
                <p className="notification-drawer__title">Financial briefings</p>
                <p className="notification-drawer__subtitle">Updates tuned to your resilience - calm, supportive, purposeful.</p>
              </div>
              <span className="notification-drawer__count">{unreadLabel}</span>
              <button
                type="button"
                className="notification-drawer__close"
                aria-label="Close notifications"
                onClick={closeDrawer}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <div className="notification-drawer__list">
              {notifications.length === 0 ? (
                <p className="notification-drawer__empty">We'll share important shifts right here.</p>
              ) : (
                notifications.map((notification) => {
                  const plan = notification.payload?.planId
                    ? planHistory.find((planItem) => planItem.id === notification.payload.planId)
                    : null;
                  const tier = plan?.tierAtCreation || notification.payload?.tierAtCreation;
                  const reassurance = tier ? TIER_REASSURANCE[tier] : null;
                  const guidance = buildNotificationGuidance(notification, plan, tier);
                  // no visibility gate
                  const periodRange =
                    formatDateRange(plan?.period.start, plan?.period.end) ||
                    formatDateRange(notification.payload?.periodStart, notification.payload?.periodEnd);
                  const projectedLeftover =
                    plan?.snapshot.leftoverProjected ?? notification.payload?.projectedLeftover;
                  const currency = plan?.snapshot.currency ?? notification.payload?.currency ?? "USD";
                  const meaning = notification.payload?.summaryLine || notification.message;
                  const payloadSupportive =
                    notification.payload?.supportiveLine ||
                    "We’ve prepared guidance to keep things steady.";

                  return (
                    <article
                      key={notification.id}
                      className={`notification-item guidance-tone--${guidance.tone} ${
                        notification.acknowledged ? "notification-item--acknowledged" : ""
                      }`}
                      onClick={() => removeNotification(notification.id)}
                    >
                      <div className="notification-item__top">
                        <div>
                          <p className="notification-item__title">{notification.title}</p>
                          {meaning && (
                            <p className="notification-item__subtitle">{meaning}</p>
                          )}
                        </div>
                        {notification.tone && (
                          <span className={`notification-item__tone notification-item__tone--${notification.tone}`}>
                            {notification.tone}
                          </span>
                        )}
                      </div>
                      <p className="notification-item__guidance-eyebrow">{guidance.eyebrow}</p>
                      <p className="notification-item__supportive">{guidance.body}</p>
                      {payloadSupportive && (
                        <p className="notification-item__supportive notification-item__supportive--secondary">
                          {payloadSupportive}
                        </p>
                      )}
                      <div className="notification-item__actions">
                        {notification.payload?.planId && (
                          <button
                            type="button"
                            className="notification-item__action"
                            onClick={(event) => {
                              event.stopPropagation();
                              handlePlanView(notification);
                            }}
                          >
                            View plan
                          </button>
                        )}
                      </div>
                      {(periodRange || tier || projectedLeftover !== undefined) && (
                        <div className="notification-item__footer">
                          {periodRange && <span>{periodRange}</span>}
                          {tier && (
                            <span className={badgeClass(tier)}>
                              {tier.charAt(0).toUpperCase() + tier.slice(1)} tier
                            </span>
                          )}
                          {reassurance && <span className="notification-item__reassurance">{reassurance}</span>}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
};

export default NotificationBell;
