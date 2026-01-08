import { GPSInput, GPSOutput } from "../types";
import { pickVariant } from "../utils";
import { isFragilePhase1, isFragilePhase2, isFragilePhase3, normalizedBuffer } from "./fragileHelpers";

const PHASE_ONE_BASE =
  "Essentials are covered, but there’s no protection yet. A small cushion turns “okay” into “safe.” Even $25–$100 per period builds surprising calm when momentum holds.";
const PHASE_ONE_VARIANTS = [
  "Lean into tiny deposits this week—the calm overshadows how small the number feels.",
  "Every steady deposit whispers “I’m protecting the life I already love.”",
];

const PHASE_TWO_BASE =
  "Your cushion is forming. Staying consistent turns vulnerability into resilience. You’re building safety, one calm decision at a time.";
const PHASE_TWO_VARIANTS = [
  "This rhythmic buffer growth is the quiet hero of every future plan.",
  "Consistency today softens the ripple of tomorrow’s surprises.",
];

const PHASE_THREE_BASE =
  "You’ve made progress — now let’s keep it. A tiny reset keeps things from tipping backward and protects the safety you’re growing.";
const PHASE_THREE_VARIANTS = [
  "A short pause and a small deposit reset the guardrails before stress arrives.",
  "Keep the shield close—steady habits now prevent panic later.",
];

const createPhasePayload = (
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

export const getFragileGuidance = (input: GPSInput): GPSOutput => {
  if (isFragilePhase3(input)) {
    return createPhasePayload(
      "Protect your progress",
      "Let’s guard what you’ve built",
      PHASE_THREE_BASE,
      PHASE_THREE_VARIANTS,
      "protective",
      input
    );
  }
  if (isFragilePhase2(input)) {
    return createPhasePayload(
      "Next tier path",
      "You’re close — keep the rhythm steady",
      PHASE_TWO_BASE,
      PHASE_TWO_VARIANTS,
      "confidence",
      input
    );
  }
  if (isFragilePhase1(input)) {
    return createPhasePayload(
      "Next tier path",
      "You found footing — now let’s make it safer",
      PHASE_ONE_BASE,
      PHASE_ONE_VARIANTS,
      "reassurance",
      input
    );
  }

  return {
    ...createPhasePayload(
      "Next tier path",
      "You found footing — now let’s make it safer",
      PHASE_ONE_BASE,
      PHASE_ONE_VARIANTS,
      "reassurance",
      input
    ),
    body: `You’re still early in fragile. Keep building a cushion — ${Math.round(
      normalizedBuffer(input) * 100
    )}% of one month is already there.`,
  };
};
