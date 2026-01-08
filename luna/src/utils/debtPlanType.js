import { writeDebtPlanType } from "./debtStorage";

const getDebtPlanEligibility = ({ premiumAccess, tierKey }) => {
  return Boolean(premiumAccess && tierKey === "traditional");
};

const getActiveDebtPlanType = ({ planTypeKey, premiumAccess, tierKey }) => {
  const isEligible = getDebtPlanEligibility({ premiumAccess, tierKey });
  if (!isEligible) {
    if (planTypeKey === "avalanche") {
      writeDebtPlanType("snowball");
    }
    return "snowball";
  }
  return planTypeKey === "avalanche" ? "avalanche" : "snowball";
};

export { getDebtPlanEligibility, getActiveDebtPlanType };
