/**
 * =========================
 * ARCHIVED PAGE — NOT ACTIVE
 * =========================
 *
 * Former in-app page.
 * Currently NOT routed, NOT imported, NOT reachable.
 *
 * Preserved for:
 * - Future website use
 * - Marketing / demo
 * - Standalone rendering
 *
 * DO NOT re-link without explicit decision.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./DebtSnapshot.css";
import { runAvalancheSimulation, runSnowballSimulation } from "../utils/snowball";
import HamburgerMenu from "../components/HamburgerMenu";

const MAX_DEBT_COUNT = 3;
const ONBOARDING_STORAGE_KEY = "moneyProfile";

const TIER_MESSAGES = {
  "severity-critical": "We'll stabilize first, then accelerate.",
  "severity-risk": "Fragile - steady the cushion, then the lift begins.",
  "severity-attention": "You're moving forward. Let's keep this steady.",
  "severity-stable": "Momentum is on your side. Let's finish strong.",
};

const DEFAULT_APRS = {
  housing: 4,
  car: 7,
  personal: 10,
  credit: 23.99,
  student: 6,
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const buildPayoffLabel = (months) => {
  if (!Number.isFinite(months) || months <= 0) return "Variable";
  const finishDate = addMonthsToDate(new Date(), months);
  return finishDate.toLocaleString("en-US", { month: "short", year: "numeric" });
};

const buildDebtEntriesFromForm = (form) => {
  const entries = [];
  const metaById = new Map();
  const createEntry = ({ type, index, balance, minPayment, apr }) => {
    const cleanBalance = Math.max(0, balance);
    if (cleanBalance <= 0) return;
    const cleanMin = Math.max(0, minPayment);
    const id = `${type}-${index}`;
    const label =
      type === "mortgage"
        ? `Mortgage ${index}`
        : type === "car"
        ? `Car loan ${index}`
        : type === "personal"
        ? `Personal loan ${index}`
        : type === "credit-card"
        ? "Credit cards"
        : type === "student"
        ? "Student loan"
        : `Debt ${index}`;
    entries.push({
      id,
      name: label,
      balance: cleanBalance,
      minPayment: cleanMin,
      apr,
    });
    metaById.set(id, { type, label });
  };

  form.housingDebts.forEach((debt, idx) => {
    createEntry({
      type: "mortgage",
      index: idx + 1,
      balance: form.housingType === "own" ? num(debt.balance) : 0,
      minPayment: num(debt.min),
      apr: DEFAULT_APRS.housing,
    });
  });
  form.carDebts.forEach((debt, idx) => {
    createEntry({
      type: "car",
      index: idx + 1,
      balance: num(debt.balance),
      minPayment: num(debt.min),
      apr: DEFAULT_APRS.car,
    });
  });
  form.personalDebts.forEach((debt, idx) => {
    createEntry({
      type: "personal",
      index: idx + 1,
      balance: num(debt.balance),
      minPayment: num(debt.min),
      apr: DEFAULT_APRS.personal,
    });
  });
  if (num(form.creditBalance) > 0) {
    createEntry({
      type: "credit-card",
      index: 1,
      balance: num(form.creditBalance),
      minPayment: num(form.creditMin),
      apr: DEFAULT_APRS.credit,
    });
  }
  if (num(form.studentBalance) > 0) {
    createEntry({
      type: "student",
      index: 1,
      balance: num(form.studentBalance),
      minPayment: num(form.studentDeferred ? 0 : form.studentMin),
      apr: DEFAULT_APRS.student,
    });
  }

  return { entries, metaById };
};

const DEBT_TYPE_LABELS = {
  mortgage: "Mortgage",
  car: "Vehicle loan",
  personal: "Personal loan",
  "credit-card": "Credit cards",
  student: "Student loan",
};

const formatDebtTypeLabel = (type) => DEBT_TYPE_LABELS[type] || "Debt";
const createInitialForm = () => ({
  profileType: "single",
  housingType: "rent",
  incomeA: "",
  incomeB: "",
  expensesA: "",
  expensesB: "",
  checking: "",
  savings: "",
  homeValue: "",
  retirement: "",
  investments: "",
  overdraftsA: "",
  overdraftsB: "",
  stressA: "2",
  stressB: "2",
  creditBalance: "",
  creditMin: "",
  studentBalance: "",
  studentMin: "",
  studentDeferred: false,
  housingDebts: [{ min: "", balance: "" }],
  carDebts: [{ balance: "", min: "" }],
  personalDebts: [{ balance: "", min: "" }],
});

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const isFilled = (value) => {
  return value !== undefined && value !== null && String(value).trim() !== "";
};

const formatMonthsToText = (months) => {
  if (!Number.isFinite(months) || months <= 0) return "0 days";
  const totalDays = Math.round(months * 30);
  if (totalDays < 30) return `${totalDays} day${totalDays !== 1 ? "s" : ""}`;
  const wholeMonths = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const parts = [];
  if (wholeMonths > 0) parts.push(`${wholeMonths} month${wholeMonths !== 1 ? "s" : ""}`);
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  return parts.join(", ");
};

const addMonthsToDate = (base, months) => {
  const result = new Date(base);
  result.setMonth(result.getMonth() + months);
  return result;
};

const sumDynamicDebts = (debts, type, housingType) => {
  let defaultApr = 0;
  if (type === "housing") defaultApr = 0.04;
  else if (type === "car") defaultApr = 0.07;
  else if (type === "personal") defaultApr = 0.1;

  return debts.reduce(
    (acc, debt) => {
      const min = num(debt.min);
      const balance = type === "housing" && housingType !== "own" ? 0 : num(debt.balance);
      return {
        totalBalance: acc.totalBalance + balance,
        totalMin: acc.totalMin + min,
        totalAnnualInterest: acc.totalAnnualInterest + balance * defaultApr,
      };
    },
    { totalBalance: 0, totalMin: 0, totalAnnualInterest: 0 }
  );
};

const DebtSnapshot = ({ onNavigate = () => {}, canGoBack = false }) => {
  const [form, setForm] = useState(createInitialForm);
  const [result, setResult] = useState(null);
  const [activeStrategy, setActiveStrategy] = useState("snowball");

  useEffect(() => {
    setActiveStrategy(result?.debtPlan?.strategy ?? "snowball");
  }, [result?.debtPlan?.strategy]);

  const isCouple = form.profileType === "couple";

  useEffect(() => {
    if (form.housingType === "rent") {
      setForm((prev) => ({
        ...prev,
        housingDebts: prev.housingDebts.map((d) => ({ ...d, balance: "" })),
      }));
    }
  }, [form.housingType]);

  const handleChange = useCallback((field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleDebtChange = (type, index, field) => (e) => {
    const value = e.target.value;
    const key = `${type}Debts`;
    setForm((prev) => {
      const updated = [...prev[key]];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, [key]: updated };
    });
  };

  const addDebtInput = (type) => {
    const key = `${type}Debts`;
    setForm((prev) => {
      const list = prev[key];
      if (list.length >= MAX_DEBT_COUNT) return prev;
      const blankDebt = type === "housing" ? { min: "", balance: "" } : { balance: "", min: "" };
      return { ...prev, [key]: [...list, blankDebt] };
    });
  };

  const removeDebtInput = (type) => {
    const key = `${type}Debts`;
    setForm((prev) => {
      const list = prev[key];
      if (list.length > 1) {
        return { ...prev, [key]: list.slice(0, -1) };
      }
      return { ...prev, [key]: [{ ...list[0], balance: "", min: "" }] };
    });
  };

  const resetForm = () => {
    setForm(createInitialForm());
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Prefill from onboarding localStorage (keeps fields editable)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const incomeSum = Array.isArray(parsed.incomes)
        ? parsed.incomes.reduce((sum, i) => sum + Number(i.amount || 0), 0)
        : 0;
      const expenseSum = Array.isArray(parsed.expenses)
        ? parsed.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
        : 0;

      setForm((prev) => ({
        ...prev,
        incomeA: prev.incomeA || (incomeSum ? incomeSum.toFixed(2) : ""),
        expensesA: prev.expensesA || (expenseSum ? expenseSum.toFixed(2) : ""),
      }));
    } catch (e) {
      // ignore malformed storage
    }
  }, []);

  const computeResult = useCallback(() => {
    const I = isCouple ? num(form.incomeA) + num(form.incomeB) : num(form.incomeA);
    const Ebase = isCouple ? num(form.expensesA) + num(form.expensesB) : num(form.expensesA);

    if (isCouple) {
      const missingCoupleFields =
        !isFilled(form.incomeA) ||
        !isFilled(form.expensesA) ||
        !isFilled(form.incomeB) ||
        !isFilled(form.expensesB);
      if (missingCoupleFields) {
        alert("For Couple mode, please enter income and expenses for both Person A and Person B.");
        return null;
      }
    }

    const C = num(form.checking);
    const S = num(form.savings);
    const Vhome = num(form.homeValue);
    const R = num(form.retirement);
    const B = num(form.investments);

    if (I <= 0 || Ebase < 0) {
      alert("Please enter income greater than 0, and non-negative base expenses.");
      return null;
    }

    const housingDebts = sumDynamicDebts(form.housingDebts, "housing", form.housingType);
    const carDebts = sumDynamicDebts(form.carDebts, "car");
    const personalDebts = sumDynamicDebts(form.personalDebts, "personal");

    const Mhome = housingDebts.totalBalance;
    const mortgageMin = housingDebts.totalMin;
    const housingAnnualInterest = housingDebts.totalAnnualInterest;

    const carBalance = carDebts.totalBalance;
    const carMin = carDebts.totalMin;
    const carAnnualInterest = carDebts.totalAnnualInterest;

    const personalBalance = personalDebts.totalBalance;
    const personalMin = personalDebts.totalMin;
    const personalAnnualInterest = personalDebts.totalAnnualInterest;

    const creditBalance = num(form.creditBalance);
    const creditMin = num(form.creditMin);
    const studentBalance = num(form.studentBalance);
    const studentMin = num(form.studentMin);
    const studentDeferred = form.studentDeferred;
    const studentAprFixed = 0.06;
    const studentAnnualInterest = studentBalance * studentAprFixed;

    const Pd = mortgageMin + carMin + creditMin + studentMin + personalMin;
    const E = Ebase + Pd;

    const Oa = num(form.overdraftsA);
    const Ob = num(form.overdraftsB);
    const stressA = num(form.stressA) || 1;
    const stressB = num(form.stressB) || 1;
    const O = isCouple ? Oa + Ob : Oa;
    const sLevel = isCouple ? Math.max(stressA, stressB) : stressA;

    const L = I - E;
    const Mcash = E > 0 ? (C + S) / E : 0;
    const H = Math.max(Vhome - Mhome, 0);
    const Aliq = C + S + 0.7 * B + 0.4 * R + 0.2 * H;
    const Mliq = E > 0 ? Aliq / E : 0;
    const annualIncome = 12 * I;

    const Dcons = creditBalance + personalBalance + carBalance;
    const creditAprDefault = 23.99 / 100;
    const totalAnnualInterest =
      housingAnnualInterest +
      carAnnualInterest +
      personalAnnualInterest +
      studentAnnualInterest +
      creditBalance * creditAprDefault;
    const monthlyConsumerInterest =
      (personalAnnualInterest + carAnnualInterest + creditBalance * creditAprDefault) / 12;
    const interestToIncome = I > 0 ? monthlyConsumerInterest / I : 0;

    const Dall = Dcons + Mhome + studentBalance;
    const debtRatioYear = annualIncome > 0 ? Dall / annualIncome : Infinity;
    const Atot = C + S + B + R + Vhome;
    const NW = Atot - Dall;
    const YNW = annualIncome > 0 ? NW / annualIncome : 0;
    const rd = I > 0 ? Pd / I : 0;
    const rL = I > 0 ? L / I : 0;

    let Scash = 0;
    if (L <= 0) Scash = 0;
    else if (rL >= 0.3) Scash = 25;
    else if (rL >= 0.2) Scash = 20;
    else if (rL >= 0.1) Scash = 15;
    else if (rL >= 0.05) Scash = 10;
    else Scash = 5;

    let Sliq = 0;
    if (Mliq >= 6) Sliq = 25;
    else if (Mliq >= 3) Sliq = 20;
    else if (Mliq >= 1) Sliq = 10;
    else if (Mliq >= 0.25) Sliq = 5;
    else Sliq = 0;

    let SdebtBase = 0;
    if (rd < 0.1) SdebtBase = 25;
    else if (rd < 0.2) SdebtBase = 20;
    else if (rd < 0.35) SdebtBase = 15;
    else if (rd < 0.5) SdebtBase = 8;
    else SdebtBase = 3;
    let Sdebt = Math.max(0, SdebtBase);
    const DconsRatioYear = annualIncome > 0 ? Dcons / annualIncome : Infinity;

    if (Dcons > 0) {
      if (DconsRatioYear >= 1) Sdebt = Math.max(0, Sdebt - 8);
      else if (DconsRatioYear >= 0.5) Sdebt = Math.max(0, Sdebt - 4);
    }
    if (studentDeferred && studentBalance > 0) {
      Sdebt = Math.max(0, Sdebt - 2);
    }

    let Swealth = 0;
    if (YNW >= 5) Swealth = 25;
    else if (YNW >= 3) Swealth = 20;
    else if (YNW >= 1) Swealth = 15;
    else if (YNW >= 0) Swealth = 10;
    else Swealth = 0;

    const overdraftPenalty = Math.min(10, 3 * O);
    let stressPenalty = 0;
    if (sLevel === 2) stressPenalty = 2;
    else if (sLevel === 3) stressPenalty = 5;
    let Sbehav = Math.max(0, 10 - overdraftPenalty - stressPenalty);

    const Sraw = Scash + Sliq + Sdebt + Swealth + Sbehav;
    const SLuna = Math.floor((Sraw / 110) * 100);

    let severityClass = "severity-attention";
    let severityLabel = "Needs Attention";
    let stage = 1;
    if (SLuna >= 80) {
      severityClass = "severity-stable";
      severityLabel = "Stable / Building";
      stage = 3;
    } else if (SLuna >= 60) {
      severityClass = "severity-attention";
      severityLabel = "Stable but Stretched";
      stage = 2;
    } else if (SLuna >= 40) {
      severityClass = "severity-risk";
      severityLabel = "Fragile";
      stage = 1;
    } else {
      severityClass = "severity-critical";
      severityLabel = "Critical";
      stage = 0;
    }

    if (L < 0) {
      stage = 0;
      severityClass = "severity-critical";
      severityLabel = "Critical";
    } else if (Mcash < 0.25 && stage > 1) {
      stage = 1;
      severityClass = "severity-risk";
      severityLabel = "Fragile";
    }

    const leftover = L;
    let allocEmergency = 0;
    let allocDebt = 0;
    let allocGoals = 0;
    let allocFun = 0;
    if (leftover > 0) {
      if (stage === 0) {
        allocEmergency = leftover * 0.8;
        allocDebt = leftover * 0.2;
      } else if (stage === 1) {
        allocEmergency = leftover * 0.6;
        allocDebt = leftover * 0.3;
        allocGoals = leftover * 0.1;
      } else if (stage === 2) {
        if (Mcash < 3) {
          allocEmergency = leftover * 0.3;
          allocDebt = leftover * 0.5;
          allocGoals = leftover * 0.2;
        } else {
          allocEmergency = leftover * 0.1;
          allocDebt = leftover * 0.6;
          allocGoals = leftover * 0.3;
        }
      } else if (stage === 3) {
        if (Mcash < 6) {
          allocEmergency = leftover * 0.2;
          allocDebt = leftover * 0.4;
          allocGoals = leftover * 0.4;
        } else {
          allocEmergency = 0;
          allocDebt = leftover * 0.4;
          allocGoals = leftover * 0.4;
          allocFun = leftover * 0.2;
        }
      }
    }

    let targetMonths = 1;
    if (stage === 2) targetMonths = 3;
    else if (stage === 3) targetMonths = 6;
    const currentEmergency = C + S;
    const targetEmergency = targetMonths * E;
    const emergencyNeeded = Math.max(0, targetEmergency - currentEmergency);
    const monthsToEmergency = allocEmergency > 0 ? Math.ceil(emergencyNeeded / allocEmergency) : null;

    const warnings = [];
    if (leftover < 0) {
      warnings.push("You are spending more than you bring in each month.");
    } else if (leftover < 0.1 * I) {
      warnings.push("Your monthly leftover is very small compared to your income, which makes surprise expenses stressful.");
    }
    if (Mcash < 0.25) {
      warnings.push("You have almost no cash buffer -- even a small surprise could push you into overdraft or more debt.");
    } else if (Mcash < 1) {
      warnings.push("You have less than 1 month of expenses saved in cash.");
    } else if (Mcash < 3) {
      warnings.push("Your emergency savings are below the commonly recommended 3 months of expenses.");
    }
    if (Dcons > 0 && DconsRatioYear >= 1) {
      warnings.push(`Your consumer debt ($${Dcons.toFixed(0)}) is dangerously high, exceeding your entire yearly income.`);
    }
    if (Dcons > 0 && interestToIncome > 0.05) {
      warnings.push(
        `A significant portion of your income (${(interestToIncome * 100).toFixed(
          1
        )}%) is likely being paid in high-interest charges alone. Your extra payments need to be aggressive.`
      );
    }
    if (studentDeferred && studentBalance > 0) {
      warnings.push(
        "Your student loans are deferred, which gives you temporary cashflow relief, but the debt principal is still a long-term risk."
      );
    }
    if (debtRatioYear > 0.5) {
      warnings.push("Your total debt (including home and loans) is very high compared to your yearly income.");
    }
    if (NW < 0) warnings.push("Right now you owe more than you own (negative net worth).");
    if (O >= 2) {
      warnings.push(`You have had ${O} overdrafts recently, which is a sign that your checking balance often runs too close to zero.`);
    }

    const planBlocks = [];
    if (leftover <= 0) {
      const requiredCut = Math.abs(leftover) + 0.05 * I;
      planBlocks.push({
        title: "1. Stop going backward each month",
        body: `You are currently short about $${Math.abs(leftover).toFixed(
          2
        )} every month. To get to break-even plus a small cushion, aim to cut roughly $${requiredCut.toFixed(
          2
        )} from non-essentials like eating out, shopping, and subscriptions.`,
      });
    } else {
      const list = [
        { label: "into your emergency savings", amount: allocEmergency },
        { label: "toward debt payoff (above the minimums)", amount: allocDebt },
        { label: "saved for goals (car, move, trip, etc.)", amount: allocGoals },
      ];
      if (allocFun > 0) list.push({ label: "as flex / fun money so it's not punishment", amount: allocFun });
      planBlocks.push({
        title: `How to use your leftover $${leftover.toFixed(2)} each month`,
        list,
      });
    }

    if (emergencyNeeded > 0 && allocEmergency > 0) {
      planBlocks.push({
        title: "Build your safety buffer",
        body: `Right now your cash covers about ~${formatMonthsToText(Mcash)} of expenses. For your situation, a safer target is around ${targetMonths} month(s), or roughly $${targetEmergency.toFixed(
          2
        )} in total savings. That means you still need about $${emergencyNeeded.toFixed(
          2
        )}. If you consistently save $${allocEmergency.toFixed(
          2
        )} each month, you can reach that level in about ${monthsToEmergency} month(s).`,
        list:
          leftover > 0
            ? [
                { label: "toward your emergency savings", amount: allocEmergency },
                { label: "toward debt payoff (above minimums)", amount: allocDebt },
                { label: "toward goals/flex", amount: allocGoals + allocFun },
              ]
            : undefined,
      });
    } else if (Mcash >= targetMonths) {
      planBlocks.push({
        title: "Your emergency fund is in a decent place",
        body: `You currently have about ~${formatMonthsToText(
          Mcash
        )} of expenses saved in cash. That gives you reasonable protection from surprises. From here, you can lean more into debt payoff and future goals.`,
      });
    }

    if (Dall > 0 || Pd > 0) {
      const msrPercent = (rd * 100).toFixed(1);
      if (interestToIncome > 0.05) {
        planBlocks.push({
          title: "Priority: High-Interest Consumer Debt",
          body: `With an estimated $${monthlyConsumerInterest.toFixed(
            2
          )} per month going to interest, your first priority (after minimum emergency savings) should be debt. Use the debt allocation of $${allocDebt.toFixed(
            2
          )} to attack the highest-interest balance first.`,
        });
      } else if (rd >= 0.5) {
        const overMax = Pd - I * 0.36;
        planBlocks.push({
          title: "Your debt is taking over the budget",
          body: `Your required debt payments are about ${msrPercent}% of your income (Monthly Debt Service Ratio). Right now you're roughly $${overMax.toFixed(2)} above the upper recommended limit (36%). For now, avoid new debt, keep everything current, and focus your extra $${allocDebt.toFixed(2)} each month on the one debt that feels most urgent.`,
        });
      } else if (rd >= 0.36) {
        const overMax = Pd - I * 0.36;
        planBlocks.push({
          title: "Debt is putting pressure on your cashflow",
          body: `Your required debt payments are about ${msrPercent}% of income, a bit above the common safe range (under about 36%). You're about $${overMax.toFixed(2)} above the upper suggested level. Use the extra $${allocDebt.toFixed(2)} each month to attack one specific balance until it's gone.`,
        });
      } else if (rd >= 0.2) {
        planBlocks.push({
          title: "Your debt load is workable, but worth shrinking",
          body: `Your debt payments are about ${msrPercent}% of your income. That's within a typical range. Send the extra $${allocDebt.toFixed(2)} each month to the highest-interest balance.`,
        });
      } else {
        planBlocks.push({
          title: "Debt is not the main problem -- that's good",
          body: `Your debt payments are about ${msrPercent}% of income, which is relatively low. You still benefit from sending $${allocDebt.toFixed(2)} extra each month to one balance, but your main wins will likely come from growing savings and goals.`,
        });
      }
    }

    if (H > 0 && Mcash < 1) {
      planBlocks.push({
        title: "House-rich, cash-poor",
        body: `You have about $${H.toFixed(
          2
        )} in home equity, which is great long-term. But your cash buffer is still thin. Prioritize building liquid savings so your house doesn't have to be your emergency plan.`,
      });
    } else if (R > 0 && Mcash < 1) {
      planBlocks.push({
        title: "Strong retirement, low cash",
        body: `You've built around ${R.toFixed(2)} in retirement accounts. Try to avoid tapping those if possible. Instead, use this plan to build up cash so your retirement money can stay invested and growing.`,
      });
    }

    if (O >= 2) {
      planBlocks.push({
        title: "Break the overdraft cycle",
        bullets: [
          "Move bill due dates closer to payday where possible",
          "Keep a small \"do not touch\" buffer in checking (even $50-$100 at first)",
          "Turn on low-balance alerts so you see issues before they become overdrafts",
        ],
      });
    }
    if (sLevel === 3) {
      planBlocks.push({
        title: "When money stress is high, keep the plan simple",
        bullets: [
          "First: move money to your emergency fund",
          "Second: send the agreed amount to one priority debt",
          "Third: keep a small amount for something that makes life feel okay",
        ],
      });
    }
    if (planBlocks.length === 0) {
      planBlocks.push({
        title: "Your numbers look fairly balanced",
        body: "You can keep going as you are, but setting clear monthly targets for savings, debt payoff, and goals will help you move forward on purpose instead of by accident.",
      });
    }

    const { entries: debtEntries, metaById } = buildDebtEntriesFromForm(form);
    const baseExtraDebt = Math.max(0, allocDebt);

    const mapSimulationResults = (simulation = []) => {
      if (!simulation.length) return [];
      const mapped = simulation.map((entry, index) => {
        const meta = metaById.get(entry.id) || {};
        const payoffMonths = entry.endMonth ?? entry.months ?? 0;
        return {
          ...entry,
          name: entry.name || meta.label || `Debt ${index + 1}`,
          balance: entry.startBalance,
          order: entry.order ?? index + 1,
          type: meta.type,
          finishLabel: payoffMonths > 0 ? buildPayoffLabel(payoffMonths) : "Variable",
        };
      });
      mapped.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return mapped;
    };

    const snowballSimulation = debtEntries.length
      ? runSnowballSimulation(debtEntries, baseExtraDebt, 0)
      : [];
    const avalancheSimulation = debtEntries.length
      ? runAvalancheSimulation(debtEntries, baseExtraDebt, 0)
      : [];

    const planEntriesByStrategy = {
      snowball: mapSimulationResults(snowballSimulation),
      avalanche: mapSimulationResults(avalancheSimulation),
    };
    const planStrategy = stage >= 2 ? "avalanche" : "snowball";
    const selectedEntries = planEntriesByStrategy[planStrategy] ?? [];
    const payoffTimelineMonths = selectedEntries.reduce(
      (max, entry) => Math.max(max, entry.endMonth ?? entry.months ?? 0),
      0
    );
    const estimatedPayoffLabel =
      selectedEntries.length > 0
        ? payoffTimelineMonths > 0
          ? buildPayoffLabel(payoffTimelineMonths)
          : "Variable"
        : "Add debts to begin";
    const planModeLabel =
      stage >= 3 ? "Avalanche (Active)" : stage === 2 ? "Avalanche (Locked)" : "Snowball";
    const planModeDescription =
      stage >= 3
        ? "You’re minimizing interest and finishing faster overall."
        : stage === 2
        ? "This unlocks once your plan is stable and your cushion is calm."
        : "Best for motivation and consistent wins.";
    const monthlyPlan = {
      minPayments: Pd,
      extra: baseExtraDebt,
      priorityDebtName: selectedEntries[0]?.name,
    };

    return {
      I,
      E,
      leftover,
      C,
      S,
      Mcash,
      Mliq,
      Mhome,
      carBalance,
      personalBalance,
      creditBalance,
      Dall,
      Pd,
      rd,
      monthlyConsumerInterest,
      NW,
      severityClass,
      severityLabel,
      SLuna,
      warnings,
      planStage: stage,
      planBlocks,
      profileText: isCouple ? "Couple (combined household)" : "Single",
      mcashDisplay: `(~${formatMonthsToText(Mcash)})`,
      mliqDisplay: `(~${formatMonthsToText(Mliq)})`,
      totalDebt: Dall,
      debtPlan: {
        entries: selectedEntries,
        entriesByStrategy: planEntriesByStrategy,
        strategy: planStrategy,
        planModeLabel,
        planModeDescription,
        estimatedPayoffLabel,
        payoffTimelineMonths,
        monthlyPlan,
      },
    };
  }, [form, isCouple]);

  const onSubmit = (e) => {
    e.preventDefault();
    const res = computeResult();
    if (res) setResult(res);
  };

  const refreshPlan = useCallback(() => {
    const res = computeResult();
    if (res) setResult(res);
  }, [computeResult]);

  const scrollToForm = useCallback(() => {
    if (typeof document === "undefined") return;
    const formEl = document.getElementById("debtForm");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const debtCountReached = useMemo(
    () => ({
      housing: form.housingDebts.length >= MAX_DEBT_COUNT,
      car: form.carDebts.length >= MAX_DEBT_COUNT,
      personal: form.personalDebts.length >= MAX_DEBT_COUNT,
    }),
    [form]
  );

  const hasValue = (v) => v !== "" && v !== null && v !== undefined;
  const hasDebtValues = (debts) => debts.some((d) => hasValue(d.balance) || hasValue(d.min));
  const hasDataForReset = useMemo(() => {
    return (
      hasValue(form.incomeA) ||
      hasValue(form.incomeB) ||
      hasValue(form.expensesA) ||
      hasValue(form.expensesB) ||
      hasValue(form.checking) ||
      hasValue(form.savings) ||
      hasValue(form.homeValue) ||
      hasValue(form.retirement) ||
      hasValue(form.investments) ||
      hasValue(form.creditBalance) ||
      hasValue(form.creditMin) ||
      hasValue(form.studentBalance) ||
      hasValue(form.studentMin) ||
      hasValue(form.overdraftsA) ||
      hasValue(form.overdraftsB) ||
      hasDebtValues(form.housingDebts) ||
      hasDebtValues(form.carDebts) ||
      hasDebtValues(form.personalDebts)
    );
  }, [form]);

  const planEntriesByStrategy =
    result?.debtPlan?.entriesByStrategy ?? { snowball: [], avalanche: [] };
  const planStage = result?.planStage ?? 0;
  const monthlyPlan = result?.debtPlan?.monthlyPlan ?? {};
  const totalDebt = result?.totalDebt ?? 0;
  const trackedDebts = Math.max(
    planEntriesByStrategy.snowball?.length ?? 0,
    planEntriesByStrategy.avalanche?.length ?? 0
  );
  const activePlanEntries = planEntriesByStrategy[activeStrategy] ?? [];
  const hasDebts = activePlanEntries.length > 0;
  const monthlyPlanTotal = (monthlyPlan.minPayments ?? 0) + (monthlyPlan.extra ?? 0);
  const canUseAvalanche = planStage >= 3;
  const isAvalancheLocked = planStage === 2;
  const statusPlanLabel = activeStrategy === "avalanche" ? "Avalanche" : "Snowball";

  return (
    <div className="container">
      <div className="top-controls">
        <HamburgerMenu
          activePage="snapshot"
          onNavigate={onNavigate}
          logoutHref="/Local/Luna Login"
        />
      </div>

      {canGoBack && (
        <button className="mobile-back-btn" type="button" onClick={() => onNavigate("back")}>
          &lt;
        </button>
      )}
      {hasDataForReset && (
        <button className="reset-fab" type="button" onClick={resetForm}>
          RESET
        </button>
      )}

      <form id="debtForm" className="card" onSubmit={onSubmit}>
        <h2>Financial Snapshot</h2>

        <div className="input-group-title">Profile Type</div>
        <label className="profile-radio-label">
          <input
            type="radio"
            name="profileType"
            value="single"
            checked={form.profileType === "single"}
            onChange={handleChange("profileType")}
          />
          Single
        </label>
        <label className="profile-radio-label">
          <input
            type="radio"
            name="profileType"
            value="couple"
            checked={form.profileType === "couple"}
            onChange={handleChange("profileType")}
          />
          Couple (two people, combined plan)
        </label>
        <small
          id="coupleNote"
          style={{
            display: form.profileType === "couple" ? "block" : "none",
            color: "#4f7bab",
            marginTop: 4,
          }}
        >
          In Couple mode, income and expenses are entered separately for each person, but the plan is based on the
          combined household.
        </small>

        <div className="input-group-title">Monthly Cashflow</div>
        <div className="dual-columns">
          <div className="dual-column">
            <div className="subsection-label">Person A</div>
            <label htmlFor="incomeA">Monthly income (after taxes)</label>
            <input
              id="incomeA"
              type="number"
              value={form.incomeA}
              onChange={handleChange("incomeA")}
              placeholder="e.g. 4409.38"
            />

            <label htmlFor="expensesA">Base Monthly Living Costs (EXCLUDE all loan payments)</label>
            <input
              id="expensesA"
              type="number"
              value={form.expensesA}
              onChange={handleChange("expensesA")}
              placeholder="e.g. 2800"
            />

            <small style={{ color: "#4f7bab", fontSize: "0.85rem", display: "block", marginTop: 4 }}>
              <b>What counts as a monthly expense?</b>
              <br />
              Include all normal life costs you would still have even with <u>no debt</u>: rent, utilities, groceries,
              insurance, gas, childcare, subscriptions, pets, and fun money.
              <br />
              <br />
              <b>Do NOT include:</b> mortgage, car, personal loans, or student loans. Those are entered separately below.
            </small>
          </div>

          {isCouple && (
            <div className="dual-column" id="personBIncomeCol">
              <div className="subsection-label">Person B</div>
              <label htmlFor="incomeB">Monthly income (after taxes)</label>
              <input
                id="incomeB"
                type="number"
                value={form.incomeB}
                onChange={handleChange("incomeB")}
                placeholder="e.g. 3200"
              />

              <label htmlFor="expensesB">Base Monthly Living Costs (EXCLUDE all loan payments)</label>
              <input
                id="expensesB"
                type="number"
                value={form.expensesB}
                onChange={handleChange("expensesB")}
                placeholder="e.g. 2100"
              />

              <small style={{ color: "#4f7bab", fontSize: "0.85rem", display: "block", marginTop: 4 }}>
                <b>What counts as a monthly expense?</b>
                <br />
                Include all normal life costs you would still have even with <u>no debt</u>: rent, utilities, groceries,
                insurance, gas, childcare, subscriptions, pets, and fun money.
                <br />
                <br />
                <b>Do NOT include:</b> mortgage, car, personal loans, or student loans. Those are entered separately below.
              </small>
            </div>
          )}
        </div>

        <div className="input-group-title">Debt & Cash</div>

        <details className="debt-section" open>
          <summary>{`\u{1F3E0} Housing Loans (Mortgages/Rent)`}</summary>
          <div className="input-group-title" style={{ borderTop: "none", paddingTop: 0 }}>
            Ownership Status
          </div>
          <label className="profile-radio-label">
            <input
              type="radio"
              name="housing-type"
              value="rent"
              checked={form.housingType === "rent"}
              onChange={handleChange("housingType")}
            />
            {`\u{1F3E1} Renting`}
          </label>
          <label className="profile-radio-label">
            <input
              type="radio"
              name="housing-type"
              value="own"
              checked={form.housingType === "own"}
              onChange={handleChange("housingType")}
            />
            {`\u{1F307} Owning (Mortgage)`}
          </label>

          <div id="housingContainer">
            {form.housingDebts.map((debt, idx) => (
              <div key={`housing-${idx}`} className="debt-input-group" data-type="housing">
                <label htmlFor={`housingMin${idx}`}>
                  {form.housingType === "own" ? "Full Monthly Payment (Mortgage)" : "Full Monthly Payment"}
                </label>
                <input
                  id={`housingMin${idx}`}
                  type="number"
                  placeholder="e.g. 1800"
                  value={debt.min}
                  onChange={handleDebtChange("housing", idx, "min")}
                />

                <div
                  className="housing-owner-fields"
                  style={{ display: form.housingType === "own" ? "block" : "none" }}
                >
                  <label htmlFor={`housingBalance${idx}`}>Remaining Mortgage Balance</label>
                  <input
                    id={`housingBalance${idx}`}
                    type="number"
                    placeholder="e.g. 250000"
                    value={debt.balance}
                    onChange={handleDebtChange("housing", idx, "balance")}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="debt-controls">
            <button
              type="button"
              className="remove-btn"
              onClick={(e) => {
                e.preventDefault();
                removeDebtInput("housing");
              }}
            >
              -
            </button>
            <button
              type="button"
              disabled={debtCountReached.housing}
              onClick={(e) => {
                e.preventDefault();
                addDebtInput("housing");
              }}
            >
              +
            </button>
          </div>
        </details>

        <details className="debt-section">
          <summary>{`\u{1F697} Car Loans`}</summary>
          <div id="carContainer">
            {form.carDebts.map((debt, idx) => (
              <div key={`car-${idx}`} className="debt-input-group" data-type="car">
                <label htmlFor={`carBalance${idx}`}>Car Loan Balance</label>
                <input
                  id={`carBalance${idx}`}
                  type="number"
                  placeholder="e.g. 18000"
                  value={debt.balance}
                  onChange={handleDebtChange("car", idx, "balance")}
                />

                <label htmlFor={`carMin${idx}`}>Required monthly payment</label>
                <input
                  id={`carMin${idx}`}
                  type="number"
                  placeholder="e.g. 400"
                  value={debt.min}
                  onChange={handleDebtChange("car", idx, "min")}
                />
              </div>
            ))}
          </div>

          <div className="debt-controls">
            <button
              type="button"
              className="remove-btn"
              onClick={(e) => {
                e.preventDefault();
                removeDebtInput("car");
              }}
            >
              -
            </button>
            <button
              type="button"
              disabled={debtCountReached.car}
              onClick={(e) => {
                e.preventDefault();
                addDebtInput("car");
              }}
            >
              +
            </button>
          </div>
        </details>

        <details className="debt-section">
          <summary>{`\u{1F4C4} Personal Loans`}</summary>
          <div id="personalContainer">
            {form.personalDebts.map((debt, idx) => (
              <div key={`personal-${idx}`} className="debt-input-group" data-type="personal">
                <label htmlFor={`personalBalance${idx}`}>Personal Loan Balance</label>
                <input
                  id={`personalBalance${idx}`}
                  type="number"
                  placeholder="e.g. 5000"
                  value={debt.balance}
                  onChange={handleDebtChange("personal", idx, "balance")}
                />

                <label htmlFor={`personalMin${idx}`}>Required monthly payment</label>
                <input
                  id={`personalMin${idx}`}
                  type="number"
                  placeholder="e.g. 180"
                  value={debt.min}
                  onChange={handleDebtChange("personal", idx, "min")}
                />
              </div>
            ))}
          </div>

          <div className="debt-controls">
            <button
              type="button"
              className="remove-btn"
              onClick={(e) => {
                e.preventDefault();
                removeDebtInput("personal");
              }}
            >
              -
            </button>
            <button
              type="button"
              disabled={debtCountReached.personal}
              onClick={(e) => {
                e.preventDefault();
                addDebtInput("personal");
              }}
            >
              +
            </button>
          </div>
        </details>

        <details className="debt-section">
          <summary>{`\u{1F4B3} Credit cards`}</summary>
          <div className="debt-input-group">
            <label htmlFor="creditBalance">Total credit card balance</label>
            <input
              id="creditBalance"
              type="number"
              placeholder="e.g. 6500"
              value={form.creditBalance}
              onChange={handleChange("creditBalance")}
            />

            <label htmlFor="creditMin">Total minimum monthly payment on cards</label>
            <input
              id="creditMin"
              type="number"
              placeholder="e.g. 200"
              value={form.creditMin}
              onChange={handleChange("creditMin")}
            />
          </div>
        </details>

        <details className="debt-section">
          <summary>{`\u{1F393} Student loans (optional, if you have any)`}</summary>
          <div className="debt-input-group">
            <label htmlFor="studentBalance">Student loan balance</label>
            <input
              id="studentBalance"
              type="number"
              placeholder="e.g. 30000"
              value={form.studentBalance}
              onChange={handleChange("studentBalance")}
            />

            <label htmlFor="studentMin">Student loan required monthly payment</label>
            <input
              id="studentMin"
              type="number"
              placeholder="e.g. 250"
              value={form.studentMin}
              onChange={handleChange("studentMin")}
            />

            <div className="checkbox-group">
              <input
                type="checkbox"
                id="studentDeferred"
                checked={form.studentDeferred}
                onChange={handleChange("studentDeferred")}
              />
              <label htmlFor="studentDeferred" style={{ display: "inline-block", margin: 0 }}>
                Loan is currently deferred or on an IDR plan.
              </label>
            </div>
          </div>
        </details>

        <label htmlFor="checking">Checking account balance</label>
        <input
          id="checking"
          type="number"
          placeholder="e.g. 160"
          value={form.checking}
          onChange={handleChange("checking")}
        />

        <label htmlFor="savings">Savings account balance</label>
        <input
          id="savings"
          type="number"
          placeholder="e.g. 0.01"
          value={form.savings}
          onChange={handleChange("savings")}
        />

        <div className="input-group-title">Assets (optional)</div>
        <label htmlFor="homeValue">Total value of all properties</label>
        <input
          id="homeValue"
          type="number"
          placeholder="e.g. 300000"
          value={form.homeValue}
          onChange={handleChange("homeValue")}
        />

        <label htmlFor="retirement">Retirement accounts total (401k, IRA, etc.)</label>
        <input
          id="retirement"
          type="number"
          placeholder="e.g. 20000"
          value={form.retirement}
          onChange={handleChange("retirement")}
        />

        <label htmlFor="investments">Investments / brokerage / crypto</label>
        <input
          id="investments"
          type="number"
          placeholder="e.g. 8000"
          value={form.investments}
          onChange={handleChange("investments")}
        />

        <div className="input-group-title">Behavior & Stress</div>
        <div className="dual-columns">
          <div className="dual-column">
            <div className="subsection-label">Person A</div>
            <label htmlFor="overdraftsA">Overdrafts in the last 90 days</label>
            <input
              id="overdraftsA"
              type="number"
              placeholder="e.g. 0"
              value={form.overdraftsA}
              onChange={handleChange("overdraftsA")}
            />

              <label htmlFor="stressA">Money stress level</label>
              <select id="stressA" value={form.stressA} onChange={handleChange("stressA")}>
                <option value="1">{`\u{1F60C} Not very stressed`}</option>
                <option value="2">{`\u{1F610} Somewhat stressed`}</option>
                <option value="3">{`\u{1F630} Very stressed`}</option>
              </select>
          </div>

          {isCouple && (
            <div className="dual-column" id="personBBehaviorCol">
              <div className="subsection-label">Person B</div>
              <label htmlFor="overdraftsB">Overdrafts in the last 90 days</label>
              <input
                id="overdraftsB"
                type="number"
                placeholder="e.g. 0"
                value={form.overdraftsB}
                onChange={handleChange("overdraftsB")}
              />

              <label htmlFor="stressB">Money stress level</label>
              <select id="stressB" value={form.stressB} onChange={handleChange("stressB")}>
                <option value="1">{`\u{1F60C} Not very stressed`}</option>
                <option value="2">{`\u{1F610} Somewhat stressed`}</option>
                <option value="3">{`\u{1F630} Very stressed`}</option>
              </select>
            </div>
          )}
        </div>

        <button className="submit-btn" type="submit">
          Submit
        </button>
      </form>

      {result && (
        <section className="debt-gameplan-result">
          <div className="gameplan-hero">
            <div className="gameplan-hero-copy">
              <p className="gameplan-eyebrow">TOTAL DEBT</p>
              <h1>Your debt gameplan</h1>
              <p className="gameplan-subtitle">See what you owe, what comes next, and how progress stays steady.</p>
              <p className="gameplan-support">This is a calm plan. Every debt keeps its minimum, and extra goes to one target at a time.</p>
              <p className="gameplan-stage">{result.severityLabel}</p>
              <p className="gameplan-stage-note">{TIER_MESSAGES[result.severityClass]}</p>
            </div>
            <div className="gameplan-status-card">
              <div className="status-row">
                <span>Current plan</span>
                <strong>{statusPlanLabel}</strong>
              </div>
              <div className="status-row">
                <span>Monthly plan total</span>
                <strong>{currencyFormatter.format(monthlyPlanTotal)}</strong>
              </div>
              <div className="status-row">
                <span>Estimated payoff</span>
                <strong>{result.debtPlan?.estimatedPayoffLabel ?? "Add debts to begin"}</strong>
              </div>
              {isAvalancheLocked && (
                <p className="status-note">Avalanche unlocks when your cushion is steady.</p>
              )}
            </div>
          </div>

          <section className="plan-summary-section">
            <div className="section-heading">
              <h3>Your Plan</h3>
              <p>Keep totals honest so the plan refreshes quietly.</p>
            </div>
            <div className="plan-summary-tiles">
              <article className="summary-tile">
                <p className="tile-label">Total debt</p>
                <strong>{totalDebt > 0 ? `${currencyFormatter.format(totalDebt)} owed` : "Add debts to begin"}</strong>
                <p className="tile-caption">{`${trackedDebts} debt${trackedDebts === 1 ? "" : "s"} tracked`}</p>
              </article>
              <article className="summary-tile">
                <p className="tile-label">Monthly plan</p>
                <strong>{`${currencyFormatter.format(monthlyPlanTotal)}/mo total`}</strong>
                <p className="tile-caption">{`${currencyFormatter.format(monthlyPlan.minPayments ?? 0)} minimums + ${currencyFormatter.format(monthlyPlan.extra ?? 0)} extra`}</p>
              </article>
              <article className="summary-tile plan-toggle-tile">
                <p className="tile-label">Plan type</p>
                <div className="plan-toggle-buttons">
                  <button
                    type="button"
                    className={`plan-toggle-button ${activeStrategy === "snowball" ? "active" : ""}`}
                    onClick={() => setActiveStrategy("snowball")}
                  >
                    Snowball
                  </button>
                  <button
                    type="button"
                    className={`plan-toggle-button ${activeStrategy === "avalanche" ? "active" : ""}`}
                    disabled={!canUseAvalanche}
                    onClick={() => {
                      if (canUseAvalanche) setActiveStrategy("avalanche");
                    }}
                  >
                    Avalanche
                  </button>
                </div>
                {!canUseAvalanche && (
                  <p className="tile-note">Avalanche unlocks when your cushion is steady.</p>
                )}
              </article>
            </div>
          </section>

          <section className="payoff-target-section">
            <div className="section-heading">
              <h3>Your Target</h3>
              <p>Here is what happens next.</p>
            </div>
            {hasDebts ? (
              <div className="payoff-order-list">
                {activePlanEntries.map((entry, index) => (
                  <article key={entry.id} className="payoff-order-card">
                    <div className="payoff-order-left">
                      {index === 0 && <span className="next-badge">NEXT</span>}
                      <div className="debt-target-info">
                        <strong>{entry.name}</strong>
                        <div className="debt-target-meta">
                          <span>Balance {currencyFormatter.format(entry.balance ?? 0)}</span>
                          <span>APR {entry.apr?.toFixed(2) ?? "0.00"}%</span>
                          <span>Min {currencyFormatter.format(entry.minPayment ?? 0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="payoff-order-right">
                      <span className="finish-label">{entry.finishLabel || "Variable"}</span>
                      {index === 0 && <p className="payoff-target-note">Extra payment goes here first.</p>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">Add your first debt to generate your payoff order.</div>
            )}
          </section>

          <section className="debt-working-section">
            <div className="section-heading debt-heading-with-action">
              <div>
                <h3>Your Debts</h3>
                <p>Keep balances up to date so the plan reflects what you actually owe.</p>
              </div>
              <button type="button" className="primary-btn" onClick={scrollToForm}>
                Add debt
              </button>
            </div>
            {hasDebts ? (
              <div className="debt-rows">
                {activePlanEntries.map((entry) => (
                  <article key={entry.id} className="debt-row">
                    <div>
                      <strong>{entry.name}</strong>
                      <span>{formatDebtTypeLabel(entry.type)}</span>
                    </div>
                    <div className="debt-row-values">
                      <span>{currencyFormatter.format(entry.balance ?? 0)}</span>
                      <span>APR {entry.apr?.toFixed(2) ?? "0.00"}%</span>
                      <span>Min {currencyFormatter.format(entry.minPayment ?? 0)}</span>
                    </div>
                    <div className="debt-row-actions">
                      <button type="button" className="ghost-btn" onClick={scrollToForm}>
                        Edit
                      </button>
                      <button type="button" className="ghost-btn" onClick={scrollToForm}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">No debts tracked yet. Add one to start your plan.</div>
            )}
          </section>

          <section className="payoff-details-section">
            <div className="section-heading">
              <h3>Payoff details</h3>
              <p>One clean table for every estimate.</p>
            </div>
            {hasDebts ? (
              <div className="payoff-details-table-wrapper">
                <table className="payoff-details-table">
                  <thead>
                    <tr>
                      <th>Debt</th>
                      <th>Order #</th>
                      <th>APR</th>
                      <th>Est payoff</th>
                      <th>Interest est.</th>
                      <th>Recommended payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePlanEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.name}</td>
                        <td>{entry.order ?? "-"}</td>
                        <td>{entry.apr ? `${entry.apr.toFixed(2)}%` : "-"}</td>
                        <td>{entry.finishLabel || "Variable"}</td>
                        <td>
                          {entry.totalInterest
                            ? currencyFormatter.format(entry.totalInterest)
                            : "-"}
                        </td>
                        <td>{currencyFormatter.format(entry.recommendedPayment ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">Add debts to see payoff estimates.</div>
            )}
          </section>

          <section className="utility-strip">
            <p>Missing debts? Update expenses or refresh.</p>
            <div className="utility-actions">
              <button type="button" className="utility-btn" onClick={scrollToForm}>
                Update expenses
              </button>
              <button type="button" className="utility-btn" onClick={refreshPlan}>
                Refresh debts
              </button>
            </div>
          </section>
        </section>
      )}
    </div>
  );
};

export default DebtSnapshot;


