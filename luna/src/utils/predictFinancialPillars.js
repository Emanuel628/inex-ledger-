import { getFinancialHealthScore } from "./financialHealthScore";

export const PILLAR_KEYS = ["budgetStability", "savingsCushion", "debtMomentum", "consistency"];

export const PILLAR_LABELS = {
  budgetStability: "Stability",
  savingsCushion: "Buffer",
  debtMomentum: "Freedom",
  consistency: "Momentum",
};

const toNumber = (value) => (Number.isFinite(value) ? value : 0);

const linearTrend = (values = []) => {
  if (!values.length) return { slope: 0, confidence: 0 };
  const n = values.length;
  const xAvg = (n - 1) / 2;
  const yAvg = values.reduce((sum, v) => sum + v, 0) / n;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    const dx = index - xAvg;
    numerator += dx * (value - yAvg);
    denominator += dx * dx;
  });
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const residual = values.reduce((sum, value) => sum + Math.pow(value - (yAvg + slope * (values.indexOf(value) - xAvg)), 2), 0);
  const volatility = Math.sqrt(residual / Math.max(n, 1));
  const confidence = Math.max(0, 1 - volatility / 25);
  return { slope, confidence };
};

const describeDirection = (slope) => {
  if (slope > 0.5) return "improving";
  if (slope < -0.5) return "softening";
  return "stable";
};

const projectValue = (latestValue, slope, periods) => toNumber(latestValue) + slope * periods;

export const getPillarPredictions = (history = []) => {
  if (!history.length) return null;

  const latest = history[history.length - 1];
  const pillarSnapshots = history
    .filter((entry) => entry?.pillars)
    .map((entry) => entry.pillars);

  if (!pillarSnapshots.length) return null;

  const lookback = pillarSnapshots.slice(-6);
  const predictions = {};

  PILLAR_KEYS.forEach((key) => {
    const values = lookback.map((pillar) => toNumber(pillar[key]));
    const { slope, confidence } = linearTrend(values);
    const direction = describeDirection(slope);
    const latestValue = toNumber(latest?.pillars?.[key]);
    const projected3 = projectValue(latestValue, slope, 3);
    const projected6 = projectValue(latestValue, slope, 6);
    predictions[key] = {
      label: PILLAR_LABELS[key],
      direction,
      strength: Math.min(Math.abs(slope) * 4, 1),
      confidence,
      projected3: Math.min(Math.max(Math.round(projected3), 0), 100),
      projected6: Math.min(Math.max(Math.round(projected6), 0), 100),
    };
  });

  return predictions;
};

export const buildPredictionContext = () => {
  const latestSnapshot = getFinancialHealthScore();
  const history = latestSnapshot?.history || [];
  return getPillarPredictions(history);
};

export default {
  getPillarPredictions,
  buildPredictionContext,
};
