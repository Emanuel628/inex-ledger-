import React, { useMemo } from "react";
import { getPeriodRange } from "../utils/budgetPeriod";
import "./PayPeriodCalendar.css";

const PERIOD_MODE_MAP = {
  weekly: "weekly",
  biweekly: "biweekly",
  monthly: "monthly",
  threeMonths: "quarterly",
  quarterly: "quarterly",
  "four-week": "four-week",
  "custom-day": "custom-day",
  annual: "annual",
  paycheck: "paycheck",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const normalizeISODate = (value) => {
  if (!value) return "";
  const normalized = new Date(value);
  if (Number.isNaN(normalized.getTime())) return "";
  return normalized.toISOString().split("T")[0];
};

const mapToMode = (period) => PERIOD_MODE_MAP[period] || "monthly";

const buildRange = ({ period, startDay, anchorDate }) => {
  if (!period) return null;
  const mode = mapToMode(period);
  const prefs = { budgetPeriod: mode };
  if (mode === "custom-day" && startDay) {
    prefs.budgetPeriodStartDay = Number(startDay) || 1;
  }
  if (anchorDate) {
    prefs.budgetPeriodAnchor = anchorDate;
  }
  return getPeriodRange(prefs);
};

const formatShortRange = (start, end) => {
  if (!start) return "";
  const endDate = end ? new Date(end) : null;
  if (endDate) {
    endDate.setDate(endDate.getDate() - 1);
  }
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  const startLabel = formatter.format(start);
  const endLabel = endDate ? formatter.format(endDate) : null;
  return endLabel ? `${startLabel} — ${endLabel}` : startLabel;
};

const PayPeriodCalendar = ({
  period = "monthly",
  label,
  startDay,
  anchorDate,
  onAnchorDateChange,
  className = "",
}) => {
  const range = useMemo(() => buildRange({ period, startDay, anchorDate }), [
    period,
    startDay,
    anchorDate,
  ]);
  if (!range) return null;

  const seedLabel = label || period;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isActive = range.start <= today && today < range.end;
  const activeLabel = isActive
    ? "This period is active; log income on payday to confirm."
    : "Not within the current period yet. Log income to start it.";

  const durationDays = Math.max(1, Math.round((range.end - range.start) / MS_PER_DAY));
  const durationLabel = `${durationDays} day${durationDays === 1 ? "" : "s"}`;
  const displayAnchor = normalizeISODate(anchorDate) || normalizeISODate(range.start);
  const anchorNote = anchorDate
    ? "Anchor date locks in this cycle."
    : onAnchorDateChange
      ? "Pick your next paycheck to anchor a new cycle."
      : "Log your next paycheck to confirm this period.";
  const anchorInputId = `pay-period-anchor-${period}-${startDay ?? "auto"}-${displayAnchor || "start"}`;

  const inputProps = onAnchorDateChange
    ? {
        onChange: (event) => onAnchorDateChange(event.target.value),
      }
    : {
        readOnly: true,
      };

  return (
    <div className={`pay-period-calendar ${className}`}>
      <div className="pay-period-calendar__info">
        <div>
          <div className="pay-period-calendar__title">{seedLabel} pay period</div>
          <div className="pay-period-calendar__range">{formatShortRange(range.start, range.end)}</div>
        </div>
        <div className="pay-period-calendar__duration-info">
          <span className="pay-period-calendar__duration-label">Duration</span>
          <strong className="pay-period-calendar__duration-value">{durationLabel}</strong>
        </div>
      </div>
      <div className="pay-period-calendar__picker-row">
        <div className="pay-period-calendar__picker">
          <label className="pay-period-calendar__picker-label" htmlFor={anchorInputId}>
            Anchor date
          </label>
          <input
            type="date"
            id={anchorInputId}
            className="pay-period-calendar__picker-input"
            value={displayAnchor}
            {...inputProps}
          />
          <span className="pay-period-calendar__picker-note">{anchorNote}</span>
        </div>
      </div>
      <div className="pay-period-calendar__active-note">{activeLabel}</div>
    </div>
  );
};

export default PayPeriodCalendar;
