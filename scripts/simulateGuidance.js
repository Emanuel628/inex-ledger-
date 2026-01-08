const path = require("path");
const root = path.resolve(__dirname, "..");
const { registerTypeScriptCompiler } = require("./registerTypeScript");

registerTypeScriptCompiler();

const { guidanceEngine } = require(path.join(root, "gps/guidanceEngine"));
const { getStatusState } = require(path.join(root, "luna/src/utils/tierStatus"));

const formatGuidance = (day, state, guidance) => {
  console.log(`Day ${day.toString().padStart(2, "0")} — tier=${state.label} tone=${guidance.tone}`);
  console.log(`  ${guidance.title}`);
  console.log(`  ${guidance.body}`);
  console.log("");
};

const runScenario = (title, series) => {
  console.log(`\n=== ${title.toUpperCase()} ===`);
  series.forEach((entry) => {
    const bufferPercent = Math.min(100, Math.round(entry.bufferMonths * 100));
    const status = getStatusState(300, bufferPercent);
    const guidance = guidanceEngine({
      tier: status.level,
      bufferMonths: entry.bufferMonths,
      leftoverTrend: entry.leftoverTrend,
      driftFlag: entry.driftFlag,
      improvements: entry.improvements,
      timeInTierDays: entry.day,
    });
    formatGuidance(entry.day, status, guidance);
  });
};

const createSeries = (length, generator) =>
  Array.from({ length }, (_, idx) => generator(idx + 1));

const fragileGrowth = createSeries(18, (day) => ({
  day,
  bufferMonths: Math.min(0.95, 0.04 + (day - 1) * 0.04),
  leftoverTrend: 1,
  driftFlag: false,
  improvements: day % 3 === 0,
}));

const fragileDrift = createSeries(12, (day) => ({
  day,
  bufferMonths: Math.max(0.25, 0.5 - day * 0.02),
  leftoverTrend: day > 7 ? -1 : 1,
  driftFlag: day > 5,
  improvements: false,
}));

const balancedPlateau = createSeries(20, (day) => ({
  day,
  bufferMonths: Math.min(1.05, 0.7 + day * 0.02),
  leftoverTrend: 1,
  driftFlag: false,
  improvements: day % 5 !== 0,
}));

const thrivingJourney = createSeries(30, (day) => ({
  day,
  bufferMonths: Math.min(1.45, 0.9 + day * 0.02),
  leftoverTrend: 1,
  driftFlag: false,
  improvements: day >= 18,
}));

runScenario("Fragile cushion build", fragileGrowth);
runScenario("Fragile drift warning", fragileDrift);
runScenario("Balanced strengthening", balancedPlateau);
runScenario("Thriving momentum to stewardship", thrivingJourney);
