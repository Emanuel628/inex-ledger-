const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const SPLIT_GUIDANCE = [
  {
    key: "needs",
    label: "Stability / Buffer",
    detail:
      "Money that protects you from surprises and keeps life steady. This strengthens your safety net so essential bills, income stability, and peace of mind stay secure.",
  },
  {
    key: "wants",
    label: "Joy / Lifestyle",
    detail:
      "Spending that makes life feel livable and enjoyable -- intentional, steady, and done after stability is protected.",
  },
  {
    key: "savings",
    label: "Progress (Savings & Debt)",
    detail:
      "Money that moves you forward: building savings, reducing debt faster, and improving long-term financial security with consistency.",
  },
];

export const SPLIT_STAGES = [
  {
    key: "critical",
    label: "Critical / Survival",
    ratioMax: 0.05,
    experience:
      "Every dollar needs a job right now - mostly essentials and rebuilding a small safety buffer.",
    focus: "Cover essentials, stop discretionary drains, and rebuild a buffer.",
    variants: [
      {
        label: "Crisis (90 / 5 / 5)",
        needs: 90,
        wants: 5,
        savings: 5,
        note: "Lock spending to essentials and stabilize cash flow before expanding any buckets.",
      },
      {
        label: "Survival (85 / 10 / 5)",
        needs: 85,
        wants: 10,
        savings: 5,
        note: "Keep joy/lifestyle minimal while slowly rebuilding a small safety buffer to handle shocks.",
      },
    ],
  },
  {
    key: "tight",
    label: "Steady",
    ratioMax: 0.12,
    experience: "Bills are covered but leftover cash still feels fragile.",
    focus: "Protect buffers, control spending, and celebrate small wins.",
    variants: [
      {
        label: "Steady (60 / 25 / 15)",
        needs: 60,
        wants: 25,
        savings: 15,
        note: "Hold spending steady so leftover builds the next safety net layer.",
      },
    ],
  },
  {
    key: "balanced",
    label: "Balanced Reality",
    ratioMax: 0.2,
    experience: "Meaningful discretion; you can save and enjoy life.",
    focus: "Consistency and optimization on joy/lifestyle and progress.",
    variants: [
      {
        label: "Balanced (55 / 25 / 20)",
        needs: 55,
        wants: 25,
        savings: 20,
        note: "Automate progress and keep joy/lifestyle meaningful, not reckless.",
      },
    ],
  },
  {
    key: "traditional",
    label: "Traditional / Optimized",
    ratioMax: 0.5,
    experience: "Leftover is healthy enough that traditional budgeting benchmarks can work without strain.",
    focus: "Growth, investing, and long-term planning become primary.",
    variants: [
      {
        label: "Traditional (50 / 30 / 20)",
        needs: 50,
        wants: 30,
        savings: 20,
        note: "Traditional benchmarks like 50/30/20 are common, but Luna still prioritizes leftover health.",
      },
      {
        label: "Optimized (45 / 35 / 20)",
        needs: 45,
        wants: 35,
        savings: 20,
        note: "Push joy/lifestyle slightly higher while funneling more to investing.",
      },
    ],
  },
  {
    key: "sovereign",
    label: "Sovereign / Elite",
    ratioMax: Infinity,
    experience: "Your money is now engineering your future. Lifestyle creep is the enemy.",
    focus: "Cap lifestyle, build opportunity capital, and accelerate asset velocity.",
    variants: [
      {
        label: "Sovereign (40 / 30 / 30)",
        needs: 40,
        wants: 30,
        savings: 30,
        note: "Preserve the margin: keep lifestyle flat, build a strike fund, and pour every raise into progress.",
      },
    ],
  },
];

export const SLIDER_CAP = 0.25;

export const computeSplitPlan = ({ income = 0, leftover = 0 }) => {
  const safeRatio = income > 0 ? Math.max(leftover / income, 0) : 0;
  const stageMatch = SPLIT_STAGES.findIndex((stage) => safeRatio <= stage.ratioMax);
  const stageIndex = stageMatch === -1 ? SPLIT_STAGES.length - 1 : Math.max(stageMatch, 0);
  const currentStage = SPLIT_STAGES[Math.min(stageIndex, SPLIT_STAGES.length - 1)];
  const prevThreshold = stageIndex > 0 ? SPLIT_STAGES[stageIndex - 1].ratioMax : 0;
  const range = Math.max(currentStage.ratioMax - prevThreshold, Number.EPSILON);
  const normalizedProgress =
    currentStage.ratioMax === Infinity ? 1 : clamp((safeRatio - prevThreshold) / range, 0, 1);
  const variantIndex = Math.min(
    currentStage.variants.length - 1,
    Math.floor(normalizedProgress * currentStage.variants.length)
  );
  const recommendedVariant =
    currentStage.variants[Math.max(0, variantIndex)] || currentStage.variants[0];

  const variantRatios = {
    needs: recommendedVariant.needs / 100,
    wants: recommendedVariant.wants / 100,
    savings: recommendedVariant.savings / 100,
  };

  const baseLeftover = Math.max(leftover, 0);
  const allocationRows = SPLIT_GUIDANCE.map((item) => ({
    ...item,
    ratio: variantRatios[item.key] ?? 0,
    amount: baseLeftover * (variantRatios[item.key] ?? 0),
  }));

  const recommendedAmounts = allocationRows.reduce(
    (acc, row) => ({ ...acc, [row.key]: row.amount }),
    {}
  );

  const sliderPercent = income > 0 ? Math.min(safeRatio / SLIDER_CAP, 1) * 100 : 0;
  const flowPercentLabel =
    income > 0 ? `Leftover ratio: ${(safeRatio * 100).toFixed(1)}%` : "Add income to unlock the view";
  const nextStage = SPLIT_STAGES[Math.min(stageIndex + 1, SPLIT_STAGES.length - 1)];
  const hasNextStage = stageIndex < SPLIT_STAGES.length - 1;
  const nextThreshold =
    hasNextStage && Number.isFinite(currentStage.ratioMax)
      ? currentStage.ratioMax
      : null;

  return {
    safeRatio,
    sliderPercent,
    flowPercentLabel,
    stageIndex,
    currentStage,
    nextStage: hasNextStage ? nextStage : null,
    nextThreshold,
    recommendedVariant,
    allocationRows,
    recommendedAmounts,
  };
};

