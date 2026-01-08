import React, { useEffect } from "react";
import "./Dashboard.css";
import TopRightControls from "../components/TopRightControls.jsx";
import { useGuidance } from "../hooks/useGuidance";
import { formatCurrency } from "../utils/formatCurrency";

export default function Dashboard({ onNavigate = () => {} }) {
  const {
    winningGuidance,
    paceStatus,
    coreCashflow,
    dailyRemaining,
    safetyCushion,
    cushionPercent,
    cushionDaysLabel,
    balancedPathTitle,
    balancedPathBody,
  } = useGuidance();

  useEffect(() => {
    console.log("DASHBOARD V2 MOUNTED");
  }, []);

  const showOptimizeCTA = winningGuidance?.key === "P4_OPTIMIZE";

  const hudSummary =
    "You've reached a steady state. Maintain consistency and avoid unnecessary strain while this stability settles.";

  return (
    <>
      <TopRightControls
        className="dashboard-topRightControls"
        onNavigate={onNavigate}
      />

      <div className="dashboardPage">
        <div className="dashboardColumn">
          <div className="dashCard hudCard">
            <div className="hudTitle">LUNA HUD</div>

            <div className="hudInner">
              <div className="hudRow">
                <span className="hudLabel">STATUS</span>
                <div className="hudValue">
                  <span className="hudPrimaryValue">Stable &middot; Tier 3</span>
                  <span className="hudSecondaryValue">Holding</span>
                </div>
              </div>

              <div className="hudRow">
                <span className="hudLabel">SUMMARY</span>
                <div className="hudValue">
                  <p className="hudSummaryText">{hudSummary}</p>
                </div>
              </div>
            </div>

            {showOptimizeCTA && (
              <div className="hudCTA">
                <button className="primaryCTA">Move Surplus to Snowball</button>
              </div>
            )}
          </div>

          <div className="dashCard">
            <div className="cardHeader">TRACK SPENDING</div>
            <h2>Track spending for clarity</h2>
            <p className="cardSubtext">
              This keeps your Financial GPS data fresh and dependable.
            </p>

            <div className="progressBar">
              <div
                className="progressFill"
                style={{ width: `${paceStatus.percent}%` }}
              />
            </div>

            <div className="paceStatus">{paceStatus.label}</div>

            <div className="cardCTA">
              <button className="secondaryCTA">Open Tracker</button>
            </div>
          </div>

          <div className="dashCard">
            <div className="cardHeader">CORE CASHFLOW (AFTER BILLS)</div>

            <div className="moneyValue mainAmount">
              {formatCurrency(coreCashflow)}
            </div>

            <p className="cardSubtext">
              Income minus fixed obligations and essentials
            </p>

            <p className="cardMeta">
              <span className="moneyValue">
                {formatCurrency(dailyRemaining)}
              </span>{" "}
              per day remaining
            </p>
          </div>

          <div className="dashCard">
            <div className="cardHeader">SAFETY CUSHION</div>

            <div className="moneyValue mainAmount">
              {formatCurrency(safetyCushion)}
            </div>

            <p className="cardSubtext">
              {safetyCushion <= 0
                ? "No emergency buffer yet"
                : "Room for life to happen"}
            </p>

            <div className="progressBar">
              <div
                className="progressFill"
                style={{ width: `${cushionPercent}%` }}
              />
            </div>

            <div className="cardMeta">{cushionPercent}% of one month of expenses</div>
            <div className="cardMeta muted">{cushionDaysLabel}</div>
          </div>

          <div className="dashCard">
            <div className="cardHeader">BALANCED PATH</div>

            <h3>{balancedPathTitle}</h3>
            <p className="cardSubtext">{balancedPathBody}</p>
          </div>
        </div>
      </div>
    </>
  );
}
