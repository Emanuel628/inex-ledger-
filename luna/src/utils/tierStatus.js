export const STATUS_STATES = {
  critical: {
    level: "critical",
    emoji: "🔴",
    label: "Critical",
    message: "Cash flow negative. Let's stabilize.",
    cushionLevel: "weak",
    reassurance: "We've got a plan - you're moving forward.",
    coachPrompt: "Stabilize essentials first before expanding.",
    guidanceTitle: "Next tier = a small positive leftover",
    guidanceSubtitle: "This tier unlocks once your essentials feel safe and your budget shows a tiny breathing room.",
    guidanceLine: "What helps most is honest tracking plus a calm habit that leaves a little extra each period.",
  },
  fragile: {
    level: "fragile",
    emoji: "🟡",
    label: "Fragile",
    message: "Close, let's improve.",
    cushionLevel: "fragile",
    reassurance: "We're watching it - keep the small habits steady.",
    coachPrompt: "Keep the momentum on leftover and guard essentials.",
    guidanceTitle: "Next tier = a dependable cushion",
    guidanceSubtitle: "This tier unlocks when you build a quiet buffer that whispers ‘I’ve got it’.",
    guidanceLine: "Staying gentle and consistent keeps things from tipping backward.",
  },
  stable: {
    level: "stable",
    emoji: "🟢",
    label: "Stable",
    message: "You're holding steady.",
    cushionLevel: "steady",
    reassurance: "Nice and calm - keep protecting what's already working.",
    coachPrompt: "Optimize little wins and keep the buffer cozy.",
    guidanceTitle: "Next tier = strengthening resilience",
    guidanceSubtitle: "This tier opens when a stronger shield lets unexpected shifts feel softer.",
    guidanceLine: "Gradual cushion growth keeps the future calmer.",
  },
  thriving: {
    level: "thriving",
    emoji: "💙",
    label: "Thriving",
    message: "You're ahead.",
    cushionLevel: "strong",
    reassurance: "Momentum is real - let's grow smarter from here.",
    coachPrompt: "Grow opportunity funds and expand playfully.",
    guidanceTitle: "Next tier = purposeful growth",
    guidanceSubtitle: "This tier is about choice—using stability to plant long-term goals.",
    guidanceLine: "We’ll help you shape the life you want on purpose.",
  },
};

export const getStatusState = (leftover, bufferPercent) => {
  const leftoverValue = Number(leftover) || 0;
  const bufferValue = Math.round(Number(bufferPercent) || 0);

  if (leftoverValue < 0) return STATUS_STATES.critical;
  if (bufferValue >= 100 && leftoverValue >= 0) return STATUS_STATES.thriving;
  if (bufferValue < 25) return STATUS_STATES.fragile;
  if (bufferValue >= 65) return STATUS_STATES.stable;
  return STATUS_STATES.stable;
};
