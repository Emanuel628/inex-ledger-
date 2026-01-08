import { GPSInput, GPSOutput } from "../types";
import { pickVariant } from "../utils";
import {
  isThrivingMomentum,
  isThrivingIntent,
  isThrivingStewardship,
} from "./thrivingHelpers";

const PHASE_MOMENTUM_BASE =
  "You built this — not by luck but by steady choices. Keep the systems consistent to protect everything here.";
const PHASE_MOMENTUM_VARIANTS = [
  "The quiet rituals that got you here should keep running—they’re the real engine.",
  "Hold the systems steady; each deposit keeps the optionality you already enjoy.",
];

const PHASE_INTENT_BASE =
  "You have room to shape life on purpose. Let goals, rituals, and generosity be the next moves.";
const PHASE_INTENT_VARIANTS = [
  "Use the cushion to craft what freedom actually feels like for you.",
  "Let intention guide the next moves instead of reacting to the clock.",
];

const PHASE_STEWARDSHIP_BASE =
  "It’s not about hoarding — it’s about preserving freedom and giving back. Let long-term resilience guide you.";
const PHASE_STEWARDSHIP_VARIANTS = [
  "The margin you’ve safeguarded now becomes a platform for meaningful impact.",
  "Protecting what you built lets you lean into generosity without panic.",
];

const createThrivingPayload = (
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

export const getThrivingGuidance = (input: GPSInput): GPSOutput => {
  if (isThrivingStewardship(input)) {
    return createThrivingPayload(
      "Stewardship path",
      "Freedom with impact",
      PHASE_STEWARDSHIP_BASE,
      PHASE_STEWARDSHIP_VARIANTS,
      "confidence",
      input
    );
  }
  if (isThrivingIntent(input)) {
    return createThrivingPayload(
      "Purposeful living",
      "Design what comes next",
      PHASE_INTENT_BASE,
      PHASE_INTENT_VARIANTS,
      "inspired",
      input
    );
  }
  if (isThrivingMomentum(input)) {
    return createThrivingPayload(
      "Thriving direction",
      "Momentum is real",
      PHASE_MOMENTUM_BASE,
      PHASE_MOMENTUM_VARIANTS,
      "confidence",
      input
    );
  }
  return createThrivingPayload(
    "Thriving direction",
    "Momentum is real",
    PHASE_MOMENTUM_BASE,
    PHASE_MOMENTUM_VARIANTS,
    "confidence",
    input
  );
};
