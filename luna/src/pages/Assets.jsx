import React, { useEffect, useMemo, useState } from "react";
import "./Assets.css";
import TopRightControls from "../components/TopRightControls.jsx";
import { useMoneyProfile } from "../hooks/useMoneyProfile";
import { useAssetProfile } from "../hooks/useAssetProfile";
import { usePreferences } from "../contexts/PreferencesContext";
import { CREDIT_CARDS_EVENT, loadCreditCards } from "../utils/creditCardsStorage";
import { readDebtCashForm } from "../utils/debtStorage";
import { computeFinancialSnapshot } from "../utils/financialTotals";

const ASSET_KEY = "assetProfile";

const ASSET_TYPES = [
  "Cash & savings",
  "Investments",
  "401(k)",
  "IRA",
  "Home equity",
  "Vehicle",
  "Business",
  "Other",
];

const formatNumberInput = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/,/g, "");
  if (str === "") return "";
  const [intPart, decPart] = str.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
};

const Assets = ({ onNavigate = () => {} }) => {
  const { profile } = useMoneyProfile();
  const { profile: assetProfile, refreshProfile } = useAssetProfile();
  const { formatCurrency } = usePreferences();
const [form, setForm] = useState({ type: "", name: "", value: "" });
  const assets = assetProfile.assets || [];
  const [saveMessage, setSaveMessage] = useState("");
  const [toastKey, setToastKey] = useState(0);
  const [creditCards, setCreditCards] = useState(() => loadCreditCards());
  const [debtCashForm, setDebtCashForm] = useState(null);
  const financialSnapshot = useMemo(
    () =>
      computeFinancialSnapshot({
        assetProfile,
        profile,
        creditCards,
        manualDebts: debtCashForm,
        expenses: profile.expenses || [],
      }),
    [assetProfile, profile, creditCards, debtCashForm]
  );
  const { totalAssets, totalDebt, netWorth, assetRows } = financialSnapshot;

  React.useEffect(() => {
    const loadDebtCash = () => {
      setDebtCashForm(readDebtCashForm());
    };
    loadDebtCash();
    window.addEventListener("debt-cash-updated", loadDebtCash);
    window.addEventListener("storage", loadDebtCash);
    return () => {
      window.removeEventListener("debt-cash-updated", loadDebtCash);
      window.removeEventListener("storage", loadDebtCash);
    };
  }, []);

  useEffect(() => {
    const refreshCards = () => setCreditCards(loadCreditCards());
    refreshCards();
    window.addEventListener(CREDIT_CARDS_EVENT, refreshCards);
    window.addEventListener("storage", refreshCards);
    return () => {
      window.removeEventListener(CREDIT_CARDS_EVENT, refreshCards);
      window.removeEventListener("storage", refreshCards);
    };
  }, []);

  const saveAssets = (nextAssets) => {
    try {
      localStorage.setItem(ASSET_KEY, JSON.stringify({ assets: nextAssets }));
      window.dispatchEvent(new Event("asset-updated"));
      refreshProfile();
    } catch (e) {
      /* ignore */
    }
  };

  const addAsset = () => {
    const value = Number(String(form.value).replace(/,/g, ""));
    if (!value || value <= 0) {
      setSaveMessage("Enter a value");
      setToastKey((prev) => prev + 1);
      return;
    }
    const selectedType = form.type || ASSET_TYPES[0];
    const newAsset = {
      id: Date.now(),
      type: selectedType,
      name: form.name || selectedType,
      value,
    };
    saveAssets([...assets, newAsset]);
    setForm({ type: "", name: "", value: "" });
    setSaveMessage("Asset added");
    setToastKey((prev) => prev + 1);
  };

  const removeAsset = (id) => {
    const next = assets.filter((item) => item.id !== id);
    saveAssets(next);
  };

  useEffect(() => {
    if (!saveMessage) return;
    const timeoutId = window.setTimeout(() => setSaveMessage(""), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  return (
    <div className="assets-page">
      <TopRightControls
        className="top-controls"
        activePage="assets"
        onNavigate={onNavigate}
        logoutHref="/Local/Luna Login"
      />
      <header className="assets-hero">
        <div className="assets-eyebrow">Assets &amp; Net Worth</div>
        <h1>Your full financial snapshot</h1>
        <p>See what you own, what you owe, and how everything fits together.</p>
      </header>
      <section className="assets-summary">
        <div>
          <span>Total assets</span>
          <strong>{formatCurrency(totalAssets)}</strong>
        </div>
        <div>
          <span>Total debts</span>
          <strong>{formatCurrency(totalDebt)}</strong>
        </div>
        <div>
          <span>Net worth</span>
          <strong className={netWorth >= 0 ? "pos" : "neg"}>{formatCurrency(netWorth)}</strong>
        </div>
      </section>

      <section className="assets-list">
        <h2>Assets</h2>
        {assetRows.length === 0 ? (
          <div className="assets-empty">No assets added.</div>
        ) : (
          assetRows.map((row) => (
            <div key={row.id} className="assets-row">
              <div className="assets-row-labels">
                <strong>{row.name}</strong>
                <span className="assets-note">{row.type}</span>
              </div>
              <div className="assets-row-right">
                <div className="assets-value">{formatCurrency(row.value)}</div>
                {row.removable && (
                  <button
                    className="assets-remove"
                    type="button"
                    onClick={() => removeAsset(row.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="assets-form">
        <h2>Add an asset</h2>
        <div className="asset-stack">
          <div className="asset-field">
            <label>Asset type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              required
            >
              <option value="" disabled hidden>
                Select asset type
              </option>
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="asset-field">
            <label>Asset name (optional)</label>
            <input
              type="text"
              className="asset-input-top"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Home equity"
            />
          </div>
          <div className="asset-field">
            <label>Current value</label>
            <input
              type="text"
              inputMode="decimal"
              className="asset-input-top"
              value={formatNumberInput(form.value)}
              onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value.replace(/,/g, "") }))}
              placeholder="e.g. 15000"
            />
          </div>
        </div>
        <div className="assets-actions">
          {saveMessage ? (
            <span key={toastKey} className="assets-save-toast">
              {saveMessage}
            </span>
          ) : null}
          <button className="primary-btn purple-save-btn" type="button" onClick={addAsset}>
            Add asset
          </button>
        </div>
      </section>
    </div>
  );
};

export default Assets;
