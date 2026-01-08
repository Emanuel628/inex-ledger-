import React from "react";
import "./MoneyCoachTip.css";

const MoneyCoachTip = ({ condition = true, text }) => {
  if (!condition) return null;
  const message =
    text ||
    "Money Coach tip: dedicate ~30% of your leftover toward debt each month so high-interest balances shrink faster.";
  return <div className="money-coach-tip">{message}</div>;
};

export default MoneyCoachTip;
