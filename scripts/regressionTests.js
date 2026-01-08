const assert = (condition, message) => {
  if (!condition) {
    console.error("Regression check failed:", message);
    process.exit(1);
  }
};

const stubLocalStorage = () => {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
};

global.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};
global.localStorage = stubLocalStorage();

const path = require("path");
const root = path.resolve(__dirname, "..");

const { registerTypeScriptCompiler } = require("./registerTypeScript");

registerTypeScriptCompiler();
const { getStatusState } = require(path.join(root, "luna/src/utils/tierStatus"));
const {
  setCurrentUserId,
  getCurrentUserId,
  markOnboardingComplete,
  hasCompletedOnboarding,
  clearOnboardingFlag,
} = require(path.join(root, "luna/src/utils/userStorage"));

const calcBufferPercent = (savingsBalance, expenses) => {
  const normalizedSavings = Number(savingsBalance) || 0;
  const rawExpenses = Number(expenses) || 0;
  const normalizedExpenses = Math.max(rawExpenses, 1);
  const percent = Math.round(((normalizedSavings / normalizedExpenses) * 100) || 0);
  return Math.min(100, Math.max(0, percent));
};

const { guidanceEngine } = require(path.join(root, "gps/guidanceEngine"));
const VALID_TONES = ["reassurance", "confidence", "protective", "inspired"];

const assertGuidanceFields = (guidance) => {
  assert(guidance, "guidance should exist");
  assert(typeof guidance.eyebrow === "string" && guidance.eyebrow.length, "eyebrow must be present");
  assert(typeof guidance.title === "string" && guidance.title.length, "title must be present");
  assert(typeof guidance.body === "string" && guidance.body.length, "body must be present");
  assert(VALID_TONES.includes(guidance.tone), `tone must be valid (${guidance.tone})`);
};

const testGuidanceNarrative = () => {
  const balancedPhase1 = guidanceEngine({
    tier: "stable",
    bufferMonths: 0.6,
    leftoverTrend: 1,
    driftFlag: false,
    improvements: false,
    timeInTierDays: 10,
  });
  assertGuidanceFields(balancedPhase1);
  assert(balancedPhase1.tone === "reassurance", "balanced phase 1 tone should reassure");

  const balancedPhase2 = guidanceEngine({
    tier: "stable",
    bufferMonths: 0.9,
    leftoverTrend: 1,
    driftFlag: false,
    improvements: true,
    timeInTierDays: 35,
  });
  assertGuidanceFields(balancedPhase2);
  assert(balancedPhase2.tone === "confidence", "balanced phase 2 should sound confident");

  const balancedPhase3 = guidanceEngine({
    tier: "stable",
    bufferMonths: 1.2,
    leftoverTrend: 1,
    driftFlag: false,
    improvements: true,
    timeInTierDays: 80,
  });
  assertGuidanceFields(balancedPhase3);
  assert(balancedPhase3.tone === "inspired", "balanced phase 3 should feel intentional");

  const thrivingMomentum = guidanceEngine({
    tier: "thriving",
    bufferMonths: 1.1,
    leftoverTrend: 1,
    driftFlag: false,
    improvements: false,
    timeInTierDays: 20,
  });
  assertGuidanceFields(thrivingMomentum);
  assert(thrivingMomentum.tone === "confidence", "thriving momentum should stay grounded");

  const thrivingIntent = guidanceEngine({
    tier: "thriving",
    bufferMonths: 1.3,
    leftoverTrend: 1,
    driftFlag: false,
    improvements: true,
    timeInTierDays: 40,
  });
  assertGuidanceFields(thrivingIntent);
  assert(thrivingIntent.tone === "inspired", "thriving intent should inspire");

  const thrivingSteward = guidanceEngine({
    tier: "thriving",
    bufferMonths: 1.4,
    leftoverTrend: 1,
    driftFlag: false,
    improvements: true,
    timeInTierDays: 150,
  });
  assertGuidanceFields(thrivingSteward);
  assert(thrivingSteward.tone === "confidence", "thriving stewardship should stay reflective");

  const fragileGuidance = guidanceEngine({
    tier: "fragile",
    bufferMonths: 0.1,
    leftoverTrend: 1,
    driftFlag: false,
    improvements: false,
    timeInTierDays: 5,
  });
  assertGuidanceFields(fragileGuidance);
  assert(
    fragileGuidance.tone !== "inspired" && fragileGuidance.tone !== "confidence",
    "fragile guidance should stay gentle"
  );

  const fallback = guidanceEngine({
    tier: "critical",
    bufferMonths: 0,
    leftoverTrend: -1,
    driftFlag: true,
    improvements: false,
    timeInTierDays: 1,
  });
  assertGuidanceFields(fallback);
  assert(fallback.tone === "protective", "fallback should remain protective");

  const thrivingWithNoBuffer = guidanceEngine({
    tier: "thriving",
    bufferMonths: 0,
    leftoverTrend: 1,
    driftFlag: false,
    improvements: true,
    timeInTierDays: 120,
  });
  assertGuidanceFields(thrivingWithNoBuffer);
  assert(
    thrivingWithNoBuffer.tone !== "protective",
    "thriving guidance should never switch to protective"
  );
};

const testTierLogic = () => {
  const expectations = [
    { leftover: 1000, buffer: 120, level: "thriving" },
    { leftover: 200, buffer: 70, level: "stable" },
    { leftover: 50, buffer: 20, level: "fragile" },
    { leftover: -10, buffer: 40, level: "critical" },
  ];
  expectations.forEach(({ leftover, buffer, level }) => {
    const state = getStatusState(leftover, buffer);
    assert(state.level === level, `tier should be ${level} for leftover ${leftover} and buffer ${buffer}`);
  });
  const nonThriving = getStatusState(1200, 80);
  assert(nonThriving.level !== "thriving", "thriving should require a full cushion");
};

const testBufferMath = () => {
  assert(calcBufferPercent(500, 250) === 100, "buffers above 100% should cap at 100");
  assert(calcBufferPercent(50, 200) === 25, "buffers should round to whole numbers");
  assert(calcBufferPercent(-100, 300) === 0, "buffers cannot go negative");
  assert(calcBufferPercent(0, 0) === 0, "zero expenses should normalize to 1");
};

const testOnboardingRouting = () => {
  const testUser = "user-regression";
  setCurrentUserId(testUser);
  assert(getCurrentUserId() === testUser, "current user should be stored");
  assert(!hasCompletedOnboarding(testUser), "onboarding should start as incomplete");
  markOnboardingComplete(testUser);
  assert(hasCompletedOnboarding(testUser), "onboarding flag should flip to true");
  clearOnboardingFlag(testUser);
  assert(!hasCompletedOnboarding(testUser), "onboarding flag should clear when requested");
};

const run = () => {
  testTierLogic();
  testBufferMath();
  testOnboardingRouting();
  testGuidanceNarrative();
  console.log("Regression checks passed.");
};

run();
