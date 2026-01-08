import { useEffect } from "react";
import { getFinancialHealthScore } from "../utils/financialHealthScore";

export const useHealthScoreRunner = () => {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const refresh = () => {
      try {
        getFinancialHealthScore({ forceRefresh: true });
      } catch (error) {
        console.error("Health Score runner failed", error);
      }
    };

    refresh();
    window.addEventListener("live-budget-updated", refresh);
    window.addEventListener("profile-updated", refresh);

    return () => {
      window.removeEventListener("live-budget-updated", refresh);
      window.removeEventListener("profile-updated", refresh);
    };
  }, []);
};
