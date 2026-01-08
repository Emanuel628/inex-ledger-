import { GPSInput } from "../types";

export const isBalancedPhase1 = (input: GPSInput): boolean =>
  input.bufferMonths >= 0.5 && input.bufferMonths < 0.85 && input.leftoverTrend >= 0;

export const isBalancedPhase2 = (input: GPSInput): boolean =>
  input.bufferMonths >= 0.85 && input.bufferMonths < 1.1 && input.leftoverTrend >= 0;

export const isBalancedPhase3 = (input: GPSInput): boolean =>
  input.bufferMonths >= 1.1 || input.timeInTierDays >= 60;
