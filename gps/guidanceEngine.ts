import { GPSContext, GPSInput, GPSOutput } from "./types";
import { getFragileGuidance } from "./fragile/fragilePhases";
import { getBalancedGuidance } from "./balanced/balancedPhases";
import { getThrivingGuidance } from "./thriving/thrivingPhases";
import { applyContextNarrative } from "./context/contextHelpers";

const STORAGE_PREFIX = "guidance_seen_";
const PREFERENCE_KEY = "lunaPreferences";
const DEFAULT_GUIDANCE_LEVEL = "normal";
const DEFAULT_TONE_PREFERENCE = "supportive";

const buildStorageKey = (periodKey: string) => `${STORAGE_PREFIX}${periodKey}`;

const computeGuidanceHash = (guidance: GPSOutput): string =>
  `${guidance.eyebrow}|${guidance.title}|${guidance.body}`;

const derivePeriodKey = (context?: GPSContext): string | null => {
  const start = context?.periodStart;
  const end = context?.periodEnd;
  if (!start || !end) return null;
  return `${start}_${end}`;
};

type SeenRecord = {
  lastGuidanceHash: string;
  lastShownAt: number;
};

const readGuidancePreferences = () => {
  if (typeof window === "undefined") {
    return {
      guidanceLevel: DEFAULT_GUIDANCE_LEVEL,
      tonePreference: DEFAULT_TONE_PREFERENCE,
    };
  }
  try {
    const stored = window.localStorage.getItem(PREFERENCE_KEY);
    if (!stored) {
      return {
        guidanceLevel: DEFAULT_GUIDANCE_LEVEL,
        tonePreference: DEFAULT_TONE_PREFERENCE,
      };
    }
    const parsed = JSON.parse(stored);
    return {
      guidanceLevel: typeof parsed.guidanceLevel === "string" ? parsed.guidanceLevel : DEFAULT_GUIDANCE_LEVEL,
      tonePreference: typeof parsed.tonePreference === "string" ? parsed.tonePreference : DEFAULT_TONE_PREFERENCE,
    };
  } catch {
    return {
      guidanceLevel: DEFAULT_GUIDANCE_LEVEL,
      tonePreference: DEFAULT_TONE_PREFERENCE,
    };
  }
};

const applyTonePreference = (guidance: GPSOutput, tonePreference: string): GPSOutput => {
  if (tonePreference === "neutral") {
    if (guidance.tone === "inspired") {
      return { ...guidance, tone: "confidence" };
    }
    if (guidance.tone === "reassurance") {
      return { ...guidance, tone: "confidence" };
    }
  }
  return guidance;
};

const isOptimizationTone = (guidance: GPSOutput) => guidance.tone === "inspired";

const readSeenRecord = (periodKey: string): SeenRecord | null => {
  if (typeof window === "undefined") return null;
  try {
    const payload = window.localStorage.getItem(buildStorageKey(periodKey));
    if (!payload) return null;
    const parsed = JSON.parse(payload);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.lastGuidanceHash === "string" &&
      typeof parsed.lastShownAt === "number"
    ) {
      return parsed as SeenRecord;
    }
  } catch {
    // ignore
  }
  return null;
};

const storeSeenRecord = (periodKey: string, record: SeenRecord) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(buildStorageKey(periodKey), JSON.stringify(record));
  } catch {
    // ignore
  }
};

export function guidanceEngine(input: GPSInput): GPSOutput {
  const fallback: GPSOutput = {
    eyebrow: "Next step",
    title: "Let’s get steady",
    body: "Right now stability matters most. Luna will help you regain footing calmly.",
    tone: "protective",
  };
  let guidance: GPSOutput;
  switch (input.tier) {
    case "fragile":
      guidance = getFragileGuidance(input);
      break;
    case "balanced":
    case "stable":
      guidance = getBalancedGuidance(input);
      break;
    case "thriving":
      guidance = getThrivingGuidance(input);
      break;
    default:
      guidance = fallback;
  }
  const decorated = applyContextNarrative(guidance, input.context, input.tier);
  const preferences = readGuidancePreferences();
  const toned = applyTonePreference(decorated, preferences.tonePreference);
  const periodKey = derivePeriodKey(input.context);
  const guidanceHash = computeGuidanceHash(toned);

  if (preferences.guidanceLevel === "off") {
    return {
      ...toned,
      suppressed: true,
      suppressionReason: "guidance-level-off",
      periodKey: periodKey ?? undefined,
      guidanceHash,
    };
  }

  if (preferences.guidanceLevel === "minimal" && isOptimizationTone(toned)) {
    return {
      ...toned,
      suppressed: true,
      suppressionReason: "guidance-level-minimal",
      periodKey: periodKey ?? undefined,
      guidanceHash,
    };
  }

  if (periodKey) {
    const seen = readSeenRecord(periodKey);
    if (seen && seen.lastGuidanceHash === guidanceHash) {
      return {
        ...toned,
        suppressed: true,
        suppressionReason: "duplicate",
        periodKey,
        guidanceHash,
      };
    }
    storeSeenRecord(periodKey, { lastGuidanceHash: guidanceHash, lastShownAt: Date.now() });
  }

  return {
    ...toned,
    periodKey: periodKey ?? undefined,
    guidanceHash,
  };
}
