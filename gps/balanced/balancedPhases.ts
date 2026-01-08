import { GPSInput, GPSOutput } from "../types";
import { pickVariant } from "../utils";
import { isBalancedPhase1, isBalancedPhase2, isBalancedPhase3 } from "./balancedHelpers";

const PHASE_ONE_BASE =
  "Cooling the chaos mattered, and now you have stability. Hold the consistency and resist overreaching so this calm can settle.";
const PHASE_ONE_VARIANTS = [
  "Gentle guards protect this new stillness—no need to sprint.",
  "Subtle repetition keeps this fresh calm wired into habit.",
];

const PHASE_TWO_BASE =
  "You’re building cushion muscle and the rhythm is easier. Keep smoothing volatility so every period feels softer.";
const PHASE_TWO_VARIANTS = [
  "The steadiness you’re chairing now is a launchpad for thoughtful goals.",
  "Confidence arrives when consistent habits ripple through the weeks.",
];

const PHASE_THREE_BASE =
  "Stability opens room for purpose. Sketch early goals and use the cushion as the foundation for what comes next.";
const PHASE_THREE_VARIANTS = [
  "Pull on the horizon gently—your safety net already lets you plan further.",
  "Think of the cushion as freedom currency; start designing how it serves you.",
];

const createBalancedPayload = (
  eyebrow: string,
  title: string,
  bodyBase: string,
  variants: string[],
  tone: GPSOutput["tone"],
  input: GPSInput
): GPSOutput => ({
  eyebrow,
  title,
  body: `${bodyBase} ${pickVariant(variants, `${title}-${tone}`, input)}`,
  tone,
});

export const getBalancedGuidance = (input: GPSInput): GPSOutput => {
  if (isBalancedPhase3(input)) {
    return createBalancedPayload(
      "Planning horizon",
      "Now you can look ahead",
      PHASE_THREE_BASE,
      PHASE_THREE_VARIANTS,
      "inspired",
      input
    );
  }
  if (isBalancedPhase2(input)) {
    return createBalancedPayload(
      "Momentum matters",
      "Strength is compounding",
      PHASE_TWO_BASE,
      PHASE_TWO_VARIANTS,
      "confidence",
      input
    );
  }
  if (isBalancedPhase1(input)) {
    return createBalancedPayload(
      "Balanced path",
      "You earned this calm",
      PHASE_ONE_BASE,
      PHASE_ONE_VARIANTS,
      "reassurance",
      input
    );
  }
  return {
    ...createBalancedPayload(
      "Balanced path",
      "You earned this calm",
      PHASE_ONE_BASE,
      PHASE_ONE_VARIANTS,
      "reassurance",
      input
    ),
    body: `${PHASE_ONE_BASE} Stay gentle—stability is new, and every calm choice protects it.`,
  };
};
